from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from datetime import datetime
from email_service import send_email, status_update_email

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/dashboard")
def get_dashboard(
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    total_reports = db.query(models.FaultReport).count()
    total_roads = db.query(models.Road).count()
    
    pending = db.query(models.FaultReport).filter(
        models.FaultReport.status == "reported"
    ).count()
    
    in_progress = db.query(models.FaultReport).filter(
        models.FaultReport.status == "in_progress"
    ).count()
    
    fixed = db.query(models.FaultReport).filter(
        models.FaultReport.status == "fixed"
    ).count()

    return {
        "total_reports": total_reports,
        "total_roads": total_roads,
        "pending": pending,
        "in_progress": in_progress,
        "fixed": fixed
    }

@router.get("/reports")
def get_all_reports(
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    reports = db.query(models.FaultReport).order_by(
        models.FaultReport.created_at.desc()
    ).all()

    return [
        {
            "id": r.id,
            "fault_type": r.fault_type,
            "severity": r.severity,
            "confidence": r.confidence,
            "description": r.description,
            "status": r.status,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "photo_url": r.photo_url,
            "video_url": r.video_url,
            "ai_result": r.ai_result,
            "road_id": r.road_id,
            "road_name": r.road.name if r.road else None,
            "user_id": r.user_id,
            "reporter_email": r.reporter_email,
            "created_at": r.created_at,
            "updated_at": r.updated_at
        } for r in reports
    ]

@router.put("/reports/{report_id}/status")
def update_report_status(
    report_id: int,
    status_update: schemas.StatusUpdate,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    report = db.query(models.FaultReport).filter(
        models.FaultReport.id == report_id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    old_status = report.status

    # Update status
    report.status = status_update.status
    report.updated_at = datetime.now()

    # Save status history
    history = models.StatusHistory(
        report_id=report.id,
        old_status=old_status,
        new_status=status_update.status,
        changed_by=admin.id,
        note=status_update.note
    )
    db.add(history)
    db.commit()

    # Send email to whichever contact we have — the account (if any) or the
    # email captured at submission time for anonymous reports.
    user = db.query(models.User).filter(models.User.id == report.user_id).first() if report.user_id else None
    target_email = user.email if user else report.reporter_email

    if target_email:
        email_sent = send_email(
            target_email,
            f"Report #{report.id} is now {status_update.status.replace('_', ' ').title()} — UI Road Monitor",
            status_update_email(report.id, status_update.status, status_update.note)
        )

        notification = models.Notification(
            user_id=user.id if user else None,
            report_id=report.id,
            email_sent=email_sent,
            sent_at=datetime.now() if email_sent else None,
            message=f"Status changed from {old_status} to {status_update.status}"
        )
        db.add(notification)
        db.commit()

    return {
        "message": "Status updated successfully",
        "report_id": report_id,
        "old_status": old_status,
        "new_status": status_update.status
    }

@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int,
    admin: models.User = Depends(auth.get_admin_user),
    db: Session = Depends(get_db)
):
    report = db.query(models.FaultReport).filter(
        models.FaultReport.id == report_id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    db.query(models.Notification).filter(models.Notification.report_id == report_id).delete()
    db.query(models.StatusHistory).filter(models.StatusHistory.report_id == report_id).delete()
    db.delete(report)
    db.commit()

    return {"message": "Report deleted successfully", "report_id": report_id}

@router.post("/create-admin")
def create_admin(
    user_data: schemas.UserRegister,
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    from auth import hash_password
    admin = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role="admin"
    )
    db.add(admin)
    db.commit()

    return {"message": "Admin created successfully"}