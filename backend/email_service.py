import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

STATUS_COLORS = {
    "reported": "#fab219",
    "in_progress": "#2a78d6",
    "fixed": "#0ca30c",
    "rejected": "#898781",
}
STATUS_LABELS = {
    "reported": "Reported",
    "in_progress": "In Progress",
    "fixed": "Fixed",
    "rejected": "Rejected",
}
STATUS_MESSAGES = {
    "in_progress": "Good news — our Works &amp; Maintenance team has started work on this fault.",
    "fixed": "This fault has been fixed. Thank you for helping keep the campus roads safe!",
    "rejected": "After review, this report has been closed. See the note below for details.",
}


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    try:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_pass = os.getenv("GMAIL_PASSWORD")

        msg = MIMEMultipart()
        msg["From"] = f"UI Road Monitor <{gmail_user}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(gmail_user, gmail_pass)
            smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def _shell(preheader: str, content_html: str) -> str:
    return f"""<html><body style="margin:0;padding:0;background:#f9f9f7;font-family:{FONT_STACK};">
<span style="display:none;font-size:1px;color:#f9f9f7;">{preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(11,11,11,0.06);">
<tr><td style="background:#2a78d6;padding:28px 32px;">
<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.2px;">UI Road Monitor</span>
<div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:2px;">Road Infrastructure Monitoring &middot; University of Ibadan</div>
</td></tr>
<tr><td style="padding:32px;">{content_html}</td></tr>
<tr><td style="padding:20px 32px;background:#f9f9f7;border-top:1px solid #e1e0d9;">
<p style="margin:0;color:#898781;font-size:12px;line-height:1.6;">
This is an automated message from UI Road Monitor. Please do not reply directly to this email.<br/>
&copy; 2026 UI Road Monitor &mdash; Faculty of Technology, University of Ibadan.</p>
</td></tr>
</table></td></tr></table></body></html>"""


def _info_row(label: str, value: str) -> str:
    return f"""<tr>
<td style="padding:8px 0;color:#898781;font-size:13px;border-bottom:1px solid #e1e0d9;">{label}</td>
<td style="padding:8px 0;color:#0b0b0b;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e1e0d9;">{value}</td>
</tr>"""


def _button(label: str, url: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
<tr><td style="border-radius:10px;background:#2a78d6;">
<a href="{url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">{label}</a>
</td></tr></table>"""


def report_received_email(report_id: int, fault_label: str, severity: str, location_label: str) -> str:
    content = f"""
<h1 style="margin:0 0 8px;color:#0b0b0b;font-size:22px;font-weight:700;">Report received</h1>
<p style="margin:0 0 24px;color:#52514e;font-size:14px;line-height:1.6;">
Thanks for reporting a road fault. Our team has logged it and will review it shortly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{_info_row("Report ID", f"#{report_id}")}
{_info_row("Fault Type", fault_label)}
{_info_row("Severity", severity.upper() if severity else "—")}
{_info_row("Location", location_label)}
</table>
<p style="margin:20px 0 0;color:#52514e;font-size:13px;line-height:1.6;">
We'll email you again as soon as the status of this report changes.</p>
{_button("Visit UI Road Monitor", FRONTEND_URL)}"""
    return _shell(f"Report #{report_id} received — UI Road Monitor", content)


def status_update_email(report_id: int, status: str, note: str = None) -> str:
    color = STATUS_COLORS.get(status, "#898781")
    label = STATUS_LABELS.get(status, status.replace("_", " ").title())
    message = STATUS_MESSAGES.get(status, "The status of your report has been updated.")

    note_html = ""
    if note:
        note_html = f"""
<div style="margin-top:20px;padding:14px 16px;background:#f9f9f7;border-radius:10px;border:1px solid #e1e0d9;">
<p style="margin:0 0 4px;color:#898781;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Note from the team</p>
<p style="margin:0;color:#52514e;font-size:13px;line-height:1.5;">{note}</p>
</div>"""

    content = f"""
<h1 style="margin:0 0 8px;color:#0b0b0b;font-size:22px;font-weight:700;">Report #{report_id} update</h1>
<p style="margin:0 0 20px;color:#52514e;font-size:14px;line-height:1.6;">{message}</p>
<span style="display:inline-block;padding:6px 14px;border-radius:999px;background:{color};color:#ffffff;font-size:13px;font-weight:700;">{label}</span>
{note_html}
{_button("Visit UI Road Monitor", FRONTEND_URL)}"""
    return _shell(f"Report #{report_id} is now {label} — UI Road Monitor", content)
