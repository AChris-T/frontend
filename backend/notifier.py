"""
Email notifications for fault reports.

Emails are rendered and sent by the Next.js frontend with Nodemailer
(POST {FRONTEND_URL}/api/notify, authenticated with NOTIFY_SECRET). If that
webhook isn't configured or fails, falls back to the SMTP sender in
email_service.py so a notification is never silently lost.
"""

import json
import os
import urllib.request
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

from email_service import send_email, report_received_email, status_update_email

load_dotenv()

NOTIFY_SECRET = os.getenv("NOTIFY_SECRET")
NOTIFY_URL = os.getenv("NOTIFY_URL") or (
    f"{os.getenv('FRONTEND_URL', '').strip().rstrip('/')}/api/notify"
    if os.getenv("FRONTEND_URL") else None
)


def _post_to_nodemailer(payload: dict) -> bool:
    if not (NOTIFY_SECRET and NOTIFY_URL):
        return False
    try:
        req = urllib.request.Request(
            NOTIFY_URL,
            data=json.dumps(payload, default=str).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-notify-secret": NOTIFY_SECRET},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            body = json.loads(res.read().decode("utf-8") or "{}")
            return bool(body.get("sent"))
    except Exception as e:
        print(f"[warn] Nodemailer webhook failed ({NOTIFY_URL}): {e}")
        return False


def _report_payload(report) -> dict:
    return {
        "id": report.id,
        "fault_type": report.fault_type,
        "severity": report.severity,
        "confidence": report.confidence,
        "status": report.status,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "location_name": getattr(report, "location_name", None),
        "address": getattr(report, "address", None),
        "road_name": report.road.name if getattr(report, "road", None) else None,
        # The small thumbnail, so emails don't embed a multi-MB original.
        "photo_url": getattr(report, "thumb_url", None) or report.photo_url,
        "description": report.description,
        "created_at": report.created_at,
    }


def _location_label(report) -> str:
    road = report.road.name if getattr(report, "road", None) else None
    return (getattr(report, "location_name", None)
            or (road if road and road != "Unnamed Road" else None)
            or f"{report.latitude:.5f}, {report.longitude:.5f}")


def _record(db, report, email_sent: bool, message: str):
    import models
    db.add(models.Notification(
        user_id=report.user_id,
        report_id=report.id,
        email_sent=email_sent,
        sent_at=datetime.now() if email_sent else None,
        message=message,
    ))
    db.commit()


def notify_report_received(report_id: int, to_email: str):
    """Background task: confirmation email after a report is submitted."""
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
        if not report:
            return

        # Give the location geocoder a moment so the email can show a real place name.
        if not report.location_name:
            from geocoding import reverse_geocode
            name, address = reverse_geocode(report.latitude, report.longitude)
            if name or address:
                report.location_name = (name or "")[:200] or None
                report.address = address
                db.commit()

        sent = _post_to_nodemailer({
            "event": "report_received",
            "to": to_email,
            "report": _report_payload(report),
        })
        if not sent:
            sent = send_email(
                to_email,
                f"Report #{report.id} received — UI Road Monitor",
                report_received_email(
                    report.id,
                    (report.fault_type or "Pending AI Analysis").replace("_", " ").title(),
                    report.severity or "low",
                    _location_label(report),
                ),
            )
        _record(db, report, sent, "Report received confirmation")
    finally:
        db.close()


def notify_status_changed(report_id: int, to_email: str, old_status: str, new_status: str, note: Optional[str]):
    """Background task: email the reporter when an admin changes the status."""
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
        if not report:
            return

        sent = _post_to_nodemailer({
            "event": "status_changed",
            "to": to_email,
            "old_status": old_status,
            "new_status": new_status,
            "note": note,
            "report": _report_payload(report),
        })
        if not sent:
            sent = send_email(
                to_email,
                f"Report #{report.id} is now {new_status.replace('_', ' ').title()} — UI Road Monitor",
                status_update_email(report.id, new_status, note),
            )
        _record(db, report, sent, f"Status changed from {old_status} to {new_status}")
    finally:
        db.close()


def reporter_email_for(db, report) -> Optional[str]:
    import models
    if report.user_id:
        user = db.query(models.User).filter(models.User.id == report.user_id).first()
        if user:
            return user.email
    return report.reporter_email
