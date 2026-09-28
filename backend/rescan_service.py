"""
Admin AI rescans: re-run fault detection on a report's stored photo/video with
Gemini and save the new result, keeping the previous one for comparison.

Rescans use Gemini only (never the OpenCV heuristics): if no Gemini model can
answer, the rescan fails and the report is left unchanged.

Bulk rescans and address backfills run in a background thread; their progress
lives in memory (one job of each kind at a time), which the admin dashboard
polls.
"""

import os
import tempfile
import threading
import urllib.request
from datetime import datetime
from typing import List, Optional

from sqlalchemy import text

import gemini_service
from gemini_service import analyze_image_gemini, analyze_video_gemini

SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
OPEN_STATUSES = ("reported", "in_progress")


def _local_copy(url: str, suffix: str) -> tuple[Optional[str], bool]:
    """Returns (path, is_temp). Downloads remote (R2) media to a temp file."""
    if not url:
        return None, False
    if url.startswith("http"):
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        req = urllib.request.Request(url, headers={"User-Agent": "ui-road-monitor-rescan/1.0"})
        with urllib.request.urlopen(req, timeout=60) as res, open(path, "wb") as f:
            f.write(res.read())
        return path, True
    path = url.lstrip("/")
    return (path if os.path.exists(path) else None), False


def _suffix(url: str, default: str) -> str:
    ext = os.path.splitext(url.split("?")[0])[1].lower()
    return ext or default


def recompute_road_severity(db, road_id: Optional[int]):
    """Road severity = worst severity among its open reports."""
    if not road_id:
        return
    import models
    rows = db.query(models.FaultReport.severity).filter(
        models.FaultReport.road_id == road_id,
        models.FaultReport.status.in_(OPEN_STATUSES),
    ).all()
    worst = max((r[0] for r in rows if r[0] in SEVERITY_RANK), key=lambda s: SEVERITY_RANK[s], default="none")
    db.execute(text("UPDATE roads SET severity = :sev WHERE id = :id"), {"sev": worst, "id": road_id})


def result_engine(result: Optional[dict]) -> Optional[str]:
    """Which detector produced an ai_result: 'gemini', 'opencv' or None."""
    if not result:
        return None
    if result.get("engine"):
        return result["engine"]
    methods = {d.get("method") for d in result.get("all_detections") or []}
    if "gemini" in methods:
        return "gemini"
    return "opencv" if methods or result.get("fault_detected") is not None else None


def gemini_quota_exhausted() -> bool:
    return gemini_service.quota_exhausted()


def rescan_report(db, report) -> dict:
    """Re-runs AI detection on one report and saves the result. Returns a summary."""
    media_url = report.photo_url or report.video_url
    if not media_url:
        return {"report_id": report.id, "ok": False, "skipped": True, "message": "No photo or video to scan"}

    is_photo = bool(report.photo_url)
    path, is_temp = None, False
    try:
        path, is_temp = _local_copy(media_url, _suffix(media_url, ".jpg" if is_photo else ".mp4"))
        if not path:
            return {"report_id": report.id, "ok": False, "message": "Media file could not be found"}

        result = analyze_image_gemini(path) if is_photo else analyze_video_gemini(path)
        if is_photo and not report.thumb_url:
            try:
                import storage
                report.thumb_url = storage.make_thumbnail(path, report.photo_url)
            except Exception as e:
                print(f"[warn] Thumbnail generation failed for #{report.id}: {e}")
    except Exception as e:
        return {"report_id": report.id, "ok": False, "message": f"Scan failed: {e}"}
    finally:
        if is_temp and path and os.path.exists(path):
            os.remove(path)

    if result is None:
        reason = gemini_service.last_error or "no Gemini model responded"
        if gemini_service.quota_exhausted():
            reason = "all Gemini models are over their quota or unavailable right now"
        return {
            "report_id": report.id,
            "ok": False,
            "gemini_unavailable": True,
            "message": f"Gemini could not analyse this report ({reason}). The report was left unchanged.",
        }

    old = report.ai_result or {}
    new_engine = "gemini"
    old_engine = result_engine(old)
    now = datetime.now().isoformat()

    previous = {
        "fault_type": report.fault_type,
        "severity": report.severity,
        "confidence": report.confidence,
        "engine": old_engine,
        "all_detections": old.get("all_detections") or [],
        "scanned_at": old.get("rescanned_at") or (report.created_at.isoformat() if report.created_at else None),
    }
    history = list(old.get("scan_history") or [])[-4:] + [previous]

    changed = False
    if result.get("fault_detected"):
        new_type = result.get("fault_type") or report.fault_type
        new_sev = result.get("severity") or report.severity
        changed = new_type != report.fault_type or new_sev != report.severity
        report.fault_type = new_type
        report.severity = new_sev
        report.confidence = result.get("confidence", 0)

    report.ai_result = {
        **result,
        "engine": new_engine,
        "rescanned_at": now,
        "rescan_count": int(old.get("rescan_count") or 0) + 1,
        "scan_history": history,
    }
    report.updated_at = datetime.now()
    recompute_road_severity(db, report.road_id)
    db.commit()

    return {
        "report_id": report.id,
        "ok": True,
        "fault_detected": bool(result.get("fault_detected")),
        "changed": changed,
        "fault_type": report.fault_type,
        "severity": report.severity,
        "confidence": report.confidence,
        "previous": previous,
        "message": result.get("message"),
    }


# ─────────────────────────────────────────────
# Background jobs
# ─────────────────────────────────────────────
_lock = threading.Lock()
_jobs = {
    "rescan": {"running": False},
    "geocode": {"running": False},
}


def job_status(kind: str) -> dict:
    with _lock:
        return dict(_jobs[kind])


def _update(kind: str, **fields):
    with _lock:
        _jobs[kind].update(fields)


def _start(kind: str, total: int, target) -> dict:
    with _lock:
        if _jobs[kind].get("running"):
            return {"started": False, **_jobs[kind]}
        _jobs[kind] = {
            "running": True, "total": total, "done": 0, "succeeded": 0, "failed": 0,
            "changed": 0, "skipped": 0, "kept": 0, "current_id": None, "results": [], "stopped_reason": None,
            "started_at": datetime.now().isoformat(), "finished_at": None,
        }
    threading.Thread(target=target, daemon=True).start()
    return {"started": True, **job_status(kind)}


def start_rescan_job(report_ids: List[int]) -> dict:
    def run():
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            for report_id in report_ids:
                if gemini_quota_exhausted():
                    _update("rescan", stopped_reason=(
                        "Every Gemini model is over its quota or unavailable, so the rescan stopped. "
                        "Reports not reached keep their current results. Free-tier quotas reset daily; "
                        "enable billing on the Gemini API key to rescan everything in one go."
                    ))
                    break
                _update("rescan", current_id=report_id)
                report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
                if not report:
                    summary = {"report_id": report_id, "ok": False, "message": "Report not found"}
                else:
                    try:
                        summary = rescan_report(db, report)
                    except Exception as e:
                        db.rollback()
                        summary = {"report_id": report_id, "ok": False, "message": str(e)}
                with _lock:
                    job = _jobs["rescan"]
                    job["done"] += 1
                    if summary.get("skipped"):
                        job["skipped"] += 1
                    elif summary.get("kept"):
                        job["kept"] += 1
                    elif summary.get("ok"):
                        job["succeeded"] += 1
                        job["changed"] += 1 if summary.get("changed") else 0
                    else:
                        job["failed"] += 1
                    job["results"] = (job["results"] + [summary])[-200:]
        finally:
            db.close()
            _update("rescan", running=False, current_id=None, finished_at=datetime.now().isoformat())

    return _start("rescan", len(report_ids), run)


def start_geocode_job(only_missing: bool = True) -> dict:
    from database import SessionLocal
    import models
    from geocoding import reverse_geocode

    db = SessionLocal()
    try:
        query = db.query(models.FaultReport.id)
        if only_missing:
            query = query.filter(models.FaultReport.location_name.is_(None))
        ids = [row[0] for row in query.order_by(models.FaultReport.id.desc()).all()]
    finally:
        db.close()

    def run():
        db = SessionLocal()
        try:
            for report_id in ids:
                _update("geocode", current_id=report_id)
                report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
                ok = False
                if report:
                    name, address = reverse_geocode(report.latitude, report.longitude)
                    if name or address:
                        report.location_name = (name or "")[:200] or None
                        report.address = address
                        db.commit()
                        ok = True
                with _lock:
                    job = _jobs["geocode"]
                    job["done"] += 1
                    job["succeeded" if ok else "failed"] += 1
        finally:
            db.close()
            _update("geocode", running=False, current_id=None, finished_at=datetime.now().isoformat())

    return _start("geocode", len(ids), run)
