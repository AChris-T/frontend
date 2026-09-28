from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload
from typing import List, Literal, Optional
from database import get_db
import models, schemas, auth
from datetime import datetime
from notifier import notify_status_changed, reporter_email_for
from geocoding import reverse_geocode
import rescan_service

router = APIRouter(prefix="/admin", tags=["Admin"])

VALID_STATUSES = {"reported", "in_progress", "fixed", "rejected"}


class BulkStatusUpdate(BaseModel):
    ids: List[int]
    status: str
    note: Optional[str] = None


class BulkIds(BaseModel):
    ids: List[int]


class RescanRequest(BaseModel):
    scope: Literal["all", "ids", "unscanned"] = "all"
    ids: Optional[List[int]] = None


class GeocodeRequest(BaseModel):
    only_missing: bool = True


def _serialize(r: models.FaultReport) -> dict:
    road_name = r.road.name if r.road else None
    return {
        "id": r.id,
        "fault_type": r.fault_type,
        "severity": r.severity,
        "confidence": r.confidence,
        "description": r.description,
        "status": r.status,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "location_name": r.location_name,
        "address": r.address,
        "photo_url": r.photo_url,
        "thumb_url": r.thumb_url,
        "video_url": r.video_url,
        "ai_result": r.ai_result,
        "road_id": r.road_id,
        "road_name": road_name,
        "road_type": r.road.road_type if r.road else None,
        "user_id": r.user_id,
        "reporter_name": r.user.full_name if r.user else None,
        "reporter_email": r.user.email if r.user else r.reporter_email,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _get_report(db: Session, report_id: int) -> models.FaultReport:
    report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def _apply_status(db: Session, report: models.FaultReport, new_status: str, note: Optional[str],
                  admin: models.User, background_tasks: BackgroundTasks) -> str:
    old_status = report.status
    report.status = new_status
    report.updated_at = datetime.now()
    db.add(models.StatusHistory(
        report_id=report.id,
        old_status=old_status,
        new_status=new_status,
        changed_by=admin.id,
        note=note,
    ))
    rescan_service.recompute_road_severity(db, report.road_id)

    target_email = reporter_email_for(db, report)
    if target_email and old_status != new_status:
        background_tasks.add_task(notify_status_changed, report.id, target_email, old_status, new_status, note)
    return old_status


@router.get("/dashboard")
def get_dashboard(
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    counts = dict(db.query(
        models.FaultReport.status, func.count(models.FaultReport.id)
    ).group_by(models.FaultReport.status).all())

    affected_roads = db.query(models.FaultReport.road_id).filter(
        models.FaultReport.road_id.isnot(None),
        models.FaultReport.status.in_(rescan_service.OPEN_STATUSES),
    ).distinct().count()

    return {
        "total_reports": sum(counts.values()),
        "total_roads": db.query(models.Road).count(),
        "affected_roads": affected_roads,
        "pending": counts.get("reported", 0),
        "in_progress": counts.get("in_progress", 0),
        "fixed": counts.get("fixed", 0),
        "rejected": counts.get("rejected", 0),
        "total_users": db.query(models.User).count(),
    }


@router.get("/reports")
def get_all_reports(
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    reports = db.query(models.FaultReport).options(
        joinedload(models.FaultReport.road), joinedload(models.FaultReport.user)
    ).order_by(models.FaultReport.created_at.desc()).all()
    return [_serialize(r) for r in reports]


@router.get("/reports/{report_id}")
def get_report_detail(
    report_id: int,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    report = _get_report(db, report_id)
    history = db.query(models.StatusHistory, models.User.full_name).outerjoin(
        models.User, models.User.id == models.StatusHistory.changed_by
    ).filter(models.StatusHistory.report_id == report_id).order_by(models.StatusHistory.changed_at).all()
    notifications = db.query(models.Notification).filter(
        models.Notification.report_id == report_id
    ).order_by(models.Notification.created_at).all()

    return {
        **_serialize(report),
        "status_history": [
            {
                "old_status": h.old_status,
                "new_status": h.new_status,
                "note": h.note,
                "changed_by": name,
                "changed_at": h.changed_at,
            } for h, name in history
        ],
        "notifications": [
            {
                "message": n.message,
                "email_sent": n.email_sent,
                "sent_at": n.sent_at,
                "created_at": n.created_at,
            } for n in notifications
        ],
    }


@router.put("/reports/bulk-status")
def bulk_update_status(
    payload: BulkStatusUpdate,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'")
    reports = db.query(models.FaultReport).filter(models.FaultReport.id.in_(payload.ids)).all()
    for report in reports:
        if report.status != payload.status:
            _apply_status(db, report, payload.status, payload.note, admin, background_tasks)
    db.commit()
    return {"message": f"Updated {len(reports)} report(s)", "updated": [r.id for r in reports]}


@router.put("/reports/{report_id}/status")
def update_report_status(
    report_id: int,
    status_update: schemas.StatusUpdate,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    if status_update.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status_update.status}'")
    report = _get_report(db, report_id)
    old_status = _apply_status(db, report, status_update.status, status_update.note, admin, background_tasks)
    db.commit()

    return {
        "message": "Status updated successfully",
        "report_id": report_id,
        "old_status": old_status,
        "new_status": status_update.status
    }


def _delete_report(db: Session, report: models.FaultReport):
    road_id = report.road_id
    db.query(models.Notification).filter(models.Notification.report_id == report.id).delete()
    db.query(models.StatusHistory).filter(models.StatusHistory.report_id == report.id).delete()
    db.delete(report)
    db.flush()
    if road_id:
        db.execute(text(
            "UPDATE roads SET fault_count = GREATEST(fault_count - 1, 0) WHERE id = :id"
        ), {"id": road_id})
        rescan_service.recompute_road_severity(db, road_id)


@router.post("/reports/bulk-delete")
def bulk_delete(
    payload: BulkIds,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    reports = db.query(models.FaultReport).filter(models.FaultReport.id.in_(payload.ids)).all()
    for report in reports:
        _delete_report(db, report)
    db.commit()
    return {"message": f"Deleted {len(reports)} report(s)", "deleted": [r.id for r in reports]}


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    _delete_report(db, _get_report(db, report_id))
    db.commit()
    return {"message": "Report deleted successfully", "report_id": report_id}


# ─────────────────────────────────────────────
# AI RESCAN
# ─────────────────────────────────────────────
@router.post("/reports/{report_id}/rescan")
def rescan_one(
    report_id: int,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    report = _get_report(db, report_id)
    summary = rescan_service.rescan_report(db, report)
    if not summary.get("ok"):
        raise HTTPException(status_code=422, detail=summary.get("message") or "Rescan failed")
    db.refresh(report)
    return {"summary": summary, "report": _serialize(report)}


@router.post("/rescan")
def start_rescan(
    payload: RescanRequest,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.FaultReport.id).filter(
        (models.FaultReport.photo_url.isnot(None)) | (models.FaultReport.video_url.isnot(None))
    )
    if payload.scope == "ids":
        query = query.filter(models.FaultReport.id.in_(payload.ids or []))
    ids = [row[0] for row in query.order_by(models.FaultReport.id.desc()).all()]
    if payload.scope == "unscanned":
        rescanned = {
            r.id for r in db.query(models.FaultReport).filter(models.FaultReport.id.in_(ids)).all()
            if (r.ai_result or {}).get("rescanned_at")
        }
        ids = [i for i in ids if i not in rescanned]
    if not ids:
        raise HTTPException(status_code=400, detail="No reports with media to rescan")
    return rescan_service.start_rescan_job(ids)


@router.get("/rescan/status")
def rescan_status(admin: models.User = Depends(auth.get_admin_user)):
    return rescan_service.job_status("rescan")


# ─────────────────────────────────────────────
# LOCATION / GEOCODING
# ─────────────────────────────────────────────
@router.post("/reports/{report_id}/geocode")
def geocode_one(
    report_id: int,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    report = _get_report(db, report_id)
    name, address = reverse_geocode(report.latitude, report.longitude)
    if not (name or address):
        raise HTTPException(status_code=502, detail="Could not resolve this location")
    report.location_name = (name or "")[:200] or None
    report.address = address
    db.commit()
    return {"location_name": report.location_name, "address": report.address}


@router.post("/geocode")
def start_geocode(payload: GeocodeRequest, admin: models.User = Depends(auth.get_admin_user)):
    return rescan_service.start_geocode_job(payload.only_missing)


@router.get("/geocode/status")
def geocode_status(admin: models.User = Depends(auth.get_admin_user)):
    return rescan_service.job_status("geocode")


@router.post("/create-admin")
def create_admin(
    user_data: schemas.UserRegister,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    from auth import hash_password
    new_admin = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role="admin"
    )
    db.add(new_admin)
    db.commit()

    return {"message": "Admin created successfully"}
