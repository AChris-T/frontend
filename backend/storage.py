import os
import shutil
import uuid
from typing import Tuple
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = "uploads"

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")

R2_ENABLED = all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL])

_client = None
if R2_ENABLED:
    import boto3
    _client = boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def upload_file(file: UploadFile, subfolder: str) -> Tuple[str, str]:
    """Saves the upload locally (needed for local AI analysis either way),
    then mirrors it to R2 if configured.

    Returns (public_url, local_path) — public_url is what gets stored on the
    report (an absolute R2 URL when configured, otherwise the same relative
    /uploads/... path as before); local_path is always a real filesystem
    path for ai_service to read.
    """
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    local_dir = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)

    with open(local_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    if R2_ENABLED:
        key = f"{subfolder}/{filename}"
        with open(local_path, "rb") as f:
            _client.upload_fileobj(
                f, R2_BUCKET_NAME, key,
                ExtraArgs={"ContentType": file.content_type or "application/octet-stream"}
            )
        return f"{R2_PUBLIC_URL.rstrip('/')}/{key}", local_path

    return f"/{local_path.replace(os.sep, '/')}", local_path


THUMB_WIDTH = 640


def make_thumbnail(local_path: str, source_url: str = None) -> str:
    """Creates a small JPEG preview of a photo (EXIF-rotated, 640px wide) and
    stores it next to the original. Returns its public URL / relative path.

    Report photos are full-size phone images (often 5-10 MB); the dashboard
    shows these thumbnails in tables, cards and map popups instead.
    """
    from io import BytesIO
    from PIL import Image, ImageOps

    with Image.open(local_path) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((THUMB_WIDTH, THUMB_WIDTH * 2))
        buf = BytesIO()
        img.save(buf, "JPEG", quality=78, optimize=True, progressive=True)
    data = buf.getvalue()

    # Name the thumbnail after the original photo (not a temp download path).
    base = os.path.basename((source_url or local_path).split("?")[0])
    name = f"{os.path.splitext(base)[0]}.jpg"
    if R2_ENABLED:
        key = f"thumbs/{name}"
        _client.put_object(Bucket=R2_BUCKET_NAME, Key=key, Body=data, ContentType="image/jpeg",
                           CacheControl="public, max-age=31536000, immutable")
        return f"{R2_PUBLIC_URL.rstrip('/')}/{key}"

    thumb_dir = os.path.join(UPLOAD_DIR, "thumbs")
    os.makedirs(thumb_dir, exist_ok=True)
    thumb_path = os.path.join(thumb_dir, name)
    with open(thumb_path, "wb") as f:
        f.write(data)
    return f"/{thumb_path.replace(os.sep, '/')}"


def cleanup_local(*paths: str):
    """Removes local temp copies once they're no longer needed — only safe
    to call when R2 holds the permanent copy."""
    if not R2_ENABLED:
        return
    for path in paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


EMAIL_LOGO_KEY = "branding/ui-logo.png"
EMAIL_LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "ui-logo.png")
_email_logo_url = None


def email_logo_url():
    """Public R2 URL of the University of Ibadan logo used in emails.

    Uploads assets/ui-logo.png to the bucket the first time it's needed.
    Returns None when R2 isn't configured (the frontend then falls back to
    its own /email/ui-logo.png).
    """
    global _email_logo_url
    if _email_logo_url or not R2_ENABLED:
        return _email_logo_url
    try:
        try:
            _client.head_object(Bucket=R2_BUCKET_NAME, Key=EMAIL_LOGO_KEY)
        except Exception:
            with open(EMAIL_LOGO_PATH, "rb") as f:
                _client.put_object(Bucket=R2_BUCKET_NAME, Key=EMAIL_LOGO_KEY, Body=f.read(),
                                   ContentType="image/png", CacheControl="public, max-age=31536000")
        _email_logo_url = f"{R2_PUBLIC_URL.rstrip('/')}/{EMAIL_LOGO_KEY}"
    except Exception as e:
        print(f"[warn] Could not upload email logo to R2: {e}")
    return _email_logo_url
