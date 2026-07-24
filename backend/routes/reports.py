from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from database import get_db
import models, schemas, auth
from typing import Optional
from datetime import datetime
import os, shutil, uuid
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_service import analyze_image, analyze_video
from email_service import send_email, report_received_email
import storage

router = APIRouter(prefix="/reports", tags=["Fault Reports"])

UPLOAD_DIR = "uploads"


def find_nearest_road(lat: float, lon: float, db: Session) -> Optional[int]:
    try:
        result = db.execute(text("""
            SELECT id FROM roads
            WHERE geom IS NOT NULL
            ORDER BY ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            )
            LIMIT 1
        """), {"lat": lat, "lon": lon})
        row = result.fetchone()
        return row.id if row else None
    except ProgrammingError:
        db.rollback()
        return None


# ─────────────────────────────────────────────
# SCAN ENDPOINT — immediate AI scan before submit
# ─────────────────────────────────────────────
@router.post("/scan")
async def scan_media(
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
):
    photo_path = None
    video_path = None

    try:
        if photo:
            ext = os.path.splitext(photo.filename)[1]
            filename = f"scan_{uuid.uuid4()}{ext}"
            photo_dir = os.path.join(UPLOAD_DIR, "photos")
            os.makedirs(photo_dir, exist_ok=True)
            photo_path = os.path.join(photo_dir, filename)
            with open(photo_path, "wb") as f:
                shutil.copyfileobj(photo.file, f)
            result = analyze_image(photo_path)

        elif video:
            ext = os.path.splitext(video.filename)[1]
            filename = f"scan_{uuid.uuid4()}{ext}"
            video_dir = os.path.join(UPLOAD_DIR, "videos")
            os.makedirs(video_dir, exist_ok=True)
            video_path = os.path.join(video_dir, filename)
            with open(video_path, "wb") as f:
                shutil.copyfileobj(video.file, f)
            result = analyze_video(video_path)

        else:
            return {
                "fault_detected": False,
                "message": "No media provided"
            }

        return result

    except Exception as e:
        print(f"❌ Scan error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "fault_detected": False,
            "message": f"Scan error: {str(e)}"
        }


# ─────────────────────────────────────────────
# SUBMIT REPORT
# ─────────────────────────────────────────────
@router.post("")
async def create_report(
    background_tasks: BackgroundTasks,
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: Optional[str] = Form(None),
    fault_type: Optional[str] = Form(None),
    severity: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    ai_scan_result: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    # Find nearest road
    road_id = find_nearest_road(latitude, longitude, db)
    road = db.query(models.Road).filter(models.Road.id == road_id).first() if road_id else None
    reporter_email = email or (current_user.email if current_user else None)

    # Save files
    photo_url = None
    video_url = None
    photo_path = None
    video_path = None

    if photo:
        photo_url, photo_path = storage.upload_file(photo, "photos")

    if video:
        video_url, video_path = storage.upload_file(video, "videos")

    # Parse AI scan result if provided
    import json
    parsed_ai_result = None
    if ai_scan_result:
        try:
            parsed_ai_result = json.loads(ai_scan_result)
        except Exception:
            parsed_ai_result = None

    # Create report with user confirmed values
    report = models.FaultReport(
        user_id=current_user.id if current_user else None,
        road_id=road_id,
        reporter_email=reporter_email,
        latitude=latitude,
        longitude=longitude,
        description=description,
        photo_url=photo_url,
        video_url=video_url,
        status="reported",
        fault_type=fault_type or "analyzing",
        severity=severity or "low",
        confidence=parsed_ai_result.get("confidence", 0) if parsed_ai_result else 0,
        ai_result=parsed_ai_result,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    db.add(report)

    # Update road fault count
    if road_id:
        db.execute(text("""
            UPDATE roads
            SET fault_count = fault_count + 1,
                last_reported = NOW()
            WHERE id = :road_id
        """), {"road_id": road_id})

        # Update road severity
        if severity:
            db.execute(text("""
                UPDATE roads
                SET severity = CASE
                    WHEN :severity = 'high' THEN 'high'
                    WHEN :severity = 'medium' AND severity != 'high' THEN 'medium'
                    WHEN :severity = 'low' AND severity = 'none' THEN 'low'
                    ELSE severity
                END
                WHERE id = :road_id
            """), {"severity": severity, "road_id": road_id})

    db.commit()
    db.refresh(report)

    # If no AI scan was done yet, run in background — otherwise the local
    # temp copies are dead weight once R2 holds the permanent copy.
    if not parsed_ai_result and (photo_path or video_path):
        background_tasks.add_task(
            run_ai_analysis,
            report.id,
            photo_path,
            video_path,
            fault_type or "analyzing",
            severity or "low"
        )
    else:
        storage.cleanup_local(photo_path, video_path)

    # Send confirmation email
    if reporter_email:
        location_label = road.name if road and road.name else f"{latitude:.5f}, {longitude:.5f}"
        background_tasks.add_task(
            send_email,
            reporter_email,
            f"Report #{report.id} received — UI Road Monitor",
            report_received_email(
                report.id,
                (fault_type or "Pending AI Analysis").replace('_', ' ').title(),
                severity or "low",
                location_label
            )
        )

    return {
        "message": "Report submitted successfully",
        "report_id": report.id,
        "road_id": road_id,
        "status": "reported",
        "fault_type": fault_type,
        "severity": severity
    }


# ─────────────────────────────────────────────
# BACKGROUND AI ANALYSIS
# ─────────────────────────────────────────────
def run_ai_analysis(
    report_id: int,
    photo_path: str,
    video_path: str,
    user_fault_type: str,
    user_severity: str
):
    from database import SessionLocal
    db = SessionLocal()
    try:
        ai_result = None

        if photo_path and os.path.exists(photo_path):
            print(f"🤖 Analyzing photo for report #{report_id}")
            ai_result = analyze_image(photo_path)
        elif video_path and os.path.exists(video_path):
            print(f"🤖 Analyzing video for report #{report_id}")
            ai_result = analyze_video(video_path)

        report = db.query(models.FaultReport).filter(
            models.FaultReport.id == report_id
        ).first()

        if report:
            if ai_result and ai_result.get('fault_detected'):
                ai_confidence = ai_result.get('confidence', 0)

                if ai_confidence >= 0.5:
                    # High confidence — trust AI
                    final_fault_type = ai_result.get('fault_type', user_fault_type)
                    final_severity = ai_result.get('severity', user_severity)
                else:
                    # Low confidence — keep user input
                    final_fault_type = user_fault_type
                    final_severity = user_severity

                report.fault_type = final_fault_type
                report.severity = final_severity
                report.confidence = ai_result.get('confidence', 0)
                report.ai_result = {
                    **ai_result,
                    'user_reported_fault': user_fault_type,
                    'user_reported_severity': user_severity,
                    'ai_confirmed': ai_confidence >= 0.5
                }
            else:
                # No detection — keep user input
                report.fault_type = user_fault_type
                report.severity = user_severity
                report.confidence = 0
                report.ai_result = {
                    'fault_detected': False,
                    'user_reported_fault': user_fault_type,
                    'user_reported_severity': user_severity,
                    'ai_confirmed': False,
                    'message': 'No fault detected by AI — using user reported values'
                }

            report.updated_at = datetime.now()

            # Update road severity
            if report.road_id:
                db.execute(text("""
                    UPDATE roads
                    SET severity = CASE
                        WHEN :severity = 'high' THEN 'high'
                        WHEN :severity = 'medium' AND severity != 'high' THEN 'medium'
                        WHEN :severity = 'low' AND severity = 'none' THEN 'low'
                        ELSE severity
                    END
                    WHERE id = :road_id
                """), {
                    "severity": report.severity,
                    "road_id": report.road_id
                })

            db.commit()
            print(f"✅ Report #{report_id} — fault: {report.fault_type}, severity: {report.severity}")

    except Exception as e:
        print(f"❌ AI analysis failed for report #{report_id}: {e}")
    finally:
        db.close()
        storage.cleanup_local(photo_path, video_path)


# ─────────────────────────────────────────────
# GET MY REPORTS (logged in user)
# ─────────────────────────────────────────────
@router.get("/my-reports")
def get_my_reports(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    reports = db.query(models.FaultReport).filter(
        models.FaultReport.user_id == current_user.id
    ).order_by(models.FaultReport.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "fault_type": r.fault_type,
            "severity": r.severity,
            "confidence": r.confidence,
            "status": r.status,
            "photo_url": r.photo_url,
            "video_url": r.video_url,
            "ai_result": r.ai_result,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "road_id": r.road_id,
            "created_at": r.created_at,
            "updated_at": r.updated_at
        } for r in reports
    ]


# ─────────────────────────────────────────────
# GET SINGLE REPORT
# ─────────────────────────────────────────────
@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.FaultReport).filter(
        models.FaultReport.id == report_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "fault_type": report.fault_type,
        "severity": report.severity,
        "confidence": report.confidence,
        "status": report.status,
        "photo_url": report.photo_url,
        "video_url": report.video_url,
        "ai_result": report.ai_result,
        "description": report.description,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "road_id": report.road_id,
        "created_at": report.created_at,
        "updated_at": report.updated_at
    }