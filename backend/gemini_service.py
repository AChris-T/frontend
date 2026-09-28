"""
UI Road Monitor — Gemini Vision fault detection.

Sends the uploaded photo straight to Gemini and asks it to identify road
surface faults. This is the primary detector; ai_service.py falls back to
its OpenCV heuristics if this returns None (missing/invalid API key, network
error, quota, etc.) so a scan never hard-fails just because Gemini is down.
"""

import os
import time
from typing import List, Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
# Tried in order after GEMINI_MODEL. On the free tier every model has its own
# daily quota, so when one runs out (or is overloaded) the next one answers.
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv(
        "GEMINI_FALLBACK_MODELS",
        "gemini-3.7-flash,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-3.5-flash",
    ).split(",") if m.strip()
]
MODELS = list(dict.fromkeys([GEMINI_MODEL, *GEMINI_FALLBACK_MODELS]))
MAX_IMAGE_SIDE = 1600   # photos are downscaled before upload (phone originals are ~9 MB)
VIDEO_FRAMES = 6        # key frames sent to Gemini (in one request) for a video
REQUEST_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_MS", "45000"))

FAULT_TYPES = [
    "pothole",
    "alligator_crack",
    "longitudinal_crack",
    "transverse_crack",
    "rutting",
]

_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}

_PROMPT = f"""You are a pavement engineer inspecting a photo of a road surface for
damage. Identify every distinct fault visible in the image, using only these
fault types:

- pothole: a bowl-shaped hole/depression with exposed soil, gravel, or base material
- alligator_crack: a dense network of interconnected cracks resembling alligator/reptile skin (fatigue cracking)
- longitudinal_crack: a crack running roughly parallel to the direction of travel/road centerline
- transverse_crack: a crack running roughly perpendicular to the direction of travel
- rutting: a longitudinal depression/groove in the wheel path from surface deformation

Rules:
- Only report a fault type if you can actually see evidence of it in the image.
- If the image does not show a road surface, or the road surface has no visible damage, return fault_detected=false with an empty detections list.
- confidence is your certainty for that specific detection, from 0.0 to 1.0.
- evidence is a short (<20 words) factual description of what you observed, e.g. "circular depression with exposed gravel, roughly 40cm wide".
- Do not invent faults that are not visibly present.
"""


class _FaultDetection(BaseModel):
    fault_type: Literal[
        "pothole",
        "alligator_crack",
        "longitudinal_crack",
        "transverse_crack",
        "rutting",
    ]
    confidence: float
    evidence: str


class _RoadFaultAnalysis(BaseModel):
    fault_detected: bool
    detections: List[_FaultDetection]
    summary: str


def _get_severity(confidence: float) -> str:
    if confidence >= 0.75:
        return "high"
    elif confidence >= 0.50:
        return "medium"
    return "low"


_client = None
_client_init_failed = False

# Per-model back-off: model -> timestamp until which it is skipped.
_blocked_until: dict = {}
last_error: Optional[str] = None


def quota_exhausted() -> bool:
    """True when every configured Gemini model is currently blocked (quota / unavailable)."""
    now = time.time()
    return all(_blocked_until.get(m, 0) > now for m in MODELS)


def _block(model: str, message: str):
    import re
    if "NOT_FOUND" in message or "404" in message:
        wait = 24 * 3600                      # retired model name
    elif "PerDay" in message:
        wait = 3600                           # daily quota: won't return in seconds
    else:
        match = re.search(r"retry in ([\d.]+)s", message)
        wait = float(match.group(1)) + 1 if match else 60
    _blocked_until[model] = time.time() + wait


def _get_client():
    global _client, _client_init_failed
    if _client is not None or _client_init_failed:
        return _client

    if not GEMINI_API_KEY:
        print("[gemini] GEMINI_API_KEY not set - Gemini detection disabled")
        _client_init_failed = True
        return None

    try:
        from google import genai
        from google.genai import types
        # Overloaded models can hang for ~50s before failing; give up sooner
        # and let the next model in the chain answer.
        _client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS))
        return _client
    except Exception as e:
        print(f"[gemini] client init failed: {e}")
        _client_init_failed = True
        return None


def _jpeg_bytes(image) -> bytes:
    """Downscale a PIL image and encode it as JPEG for upload."""
    from io import BytesIO
    image = image.convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buf = BytesIO()
    image.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def _image_part(image_path: str):
    from google.genai import types
    try:
        from PIL import Image, ImageOps
        with Image.open(image_path) as img:
            data = _jpeg_bytes(ImageOps.exif_transpose(img))
        return types.Part.from_bytes(data=data, mime_type="image/jpeg")
    except Exception:
        # Formats PIL can't open (e.g. HEIC without a plugin): send the original bytes.
        with open(image_path, "rb") as f:
            data = f.read()
        mime = _MIME_TYPES.get(os.path.splitext(image_path)[1].lower(), "image/jpeg")
        return types.Part.from_bytes(data=data, mime_type=mime)


def _video_frame_parts(video_path: str) -> list:
    """Evenly spaced key frames from a video, as JPEG parts."""
    import cv2
    from PIL import Image
    from google.genai import types

    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    positions = [int(total * (i + 0.5) / VIDEO_FRAMES) for i in range(VIDEO_FRAMES)] if total else [0]
    parts = []
    for pos in positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ok, frame = cap.read()
        if not ok:
            continue
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        parts.append(types.Part.from_bytes(data=_jpeg_bytes(image), mime_type="image/jpeg"))
    cap.release()
    return parts


def _generate(parts: list, prompt: str):
    """Runs the request through the model chain. Returns (parsed, model) or (None, None)."""
    global last_error
    from google.genai import types

    client = _get_client()
    if client is None:
        last_error = "GEMINI_API_KEY is not configured"
        return None, None

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=_RoadFaultAnalysis,
        temperature=0.1,
    )
    for model in MODELS:
        if _blocked_until.get(model, 0) > time.time():
            continue
        for attempt in range(2):  # one retry, only for transient server errors
            try:
                response = client.models.generate_content(model=model, contents=[*parts, prompt], config=config)
                if response.parsed is None:
                    last_error = f"{model} returned no parsed result"
                    break
                return response.parsed, model
            except Exception as e:
                message = str(e)
                last_error = f"{model}: {message[:200]}"
                print(f"[gemini] {model} attempt {attempt + 1} failed: {message[:200]}")
                if any(code in message for code in ("429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND")):
                    _block(model, message)
                    break
                if any(code in message for code in ("503", "UNAVAILABLE")) or "timed out" in message.lower():
                    # Overloaded / slow: skip it for a couple of minutes and try the next model now.
                    _blocked_until[model] = time.time() + 120
                    break
                if any(code in message for code in ("500", "INTERNAL")) and attempt == 0:
                    time.sleep(2)
                    continue
                break
    return None, None


def _to_result(parsed, model: str, extra: Optional[dict] = None) -> dict:
    detections = [
        {
            "fault_type": d.fault_type,
            "confidence": round(max(0.0, min(1.0, d.confidence)), 3),
            "severity": _get_severity(d.confidence),
            "method": "gemini",
            "evidence": d.evidence,
        }
        for d in parsed.detections
        if d.fault_type in FAULT_TYPES
    ]
    detections.sort(key=lambda d: d["confidence"], reverse=True)

    base = {"engine": "gemini", "model": model, "summary": parsed.summary, **(extra or {})}
    print(f"[gemini] {model}: {len(detections)} fault(s) - {parsed.summary}")

    if not detections:
        return {
            **base,
            "fault_detected": False,
            "fault_type": "none",
            "severity": "none",
            "confidence": 0,
            "all_detections": [],
            "total_faults": 0,
            "message": parsed.summary or "No road fault detected — please select fault type manually",
        }

    primary = detections[0]
    return {
        **base,
        "fault_detected": True,
        "fault_type": primary["fault_type"],
        "severity": primary["severity"],
        "confidence": primary["confidence"],
        "all_detections": detections,
        "total_faults": len(detections),
        "message": f"{len(detections)} fault(s) detected: " + ", ".join(d["fault_type"] for d in detections),
    }


def analyze_image_gemini(image_path: str) -> Optional[dict]:
    """
    Ask Gemini to identify road faults in the image at image_path.
    Returns the same result shape as ai_service.analyze_image(), or None if
    no Gemini model could answer (callers decide whether to fall back).
    """
    global last_error
    try:
        part = _image_part(image_path)
    except OSError as e:
        last_error = f"Could not read {image_path}: {e}"
        return None
    parsed, model = _generate([part], _PROMPT)
    return _to_result(parsed, model) if parsed is not None else None


def analyze_video_gemini(video_path: str) -> Optional[dict]:
    """Sends key frames of a video to Gemini in a single request."""
    global last_error
    try:
        parts = _video_frame_parts(video_path)
    except Exception as e:
        last_error = f"Could not read video frames: {e}"
        return None
    if not parts:
        last_error = "Could not extract any frames from the video"
        return None
    prompt = (
        f"The {len(parts)} images are evenly spaced frames from one video of the same stretch of road. "
        "Report each distinct fault type visible in any frame once.\n\n" + _PROMPT
    )
    parsed, model = _generate(parts, prompt)
    return _to_result(parsed, model, {"frames_analyzed": len(parts)}) if parsed is not None else None
