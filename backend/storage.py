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
