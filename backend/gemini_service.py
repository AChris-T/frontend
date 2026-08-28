"""
UI Road Monitor — Gemini Vision fault detection.

Sends the uploaded photo straight to Gemini and asks it to identify road
surface faults. This is the primary detector; ai_service.py falls back to
its OpenCV heuristics if this returns None (missing/invalid API key, network
error, quota, etc.) so a scan never hard-fails just because Gemini is down.
"""

import os
from typing import List, Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

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


def _get_client():
    global _client, _client_init_failed
    if _client is not None or _client_init_failed:
        return _client

    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not set — Gemini detection disabled")
        _client_init_failed = True
        return None

    try:
        from google import genai
        _client = genai.Client(api_key=GEMINI_API_KEY)
        return _client
    except Exception as e:
        print(f"❌ Gemini client init failed: {e}")
        _client_init_failed = True
        return None


def analyze_image_gemini(image_path: str) -> Optional[dict]:
    """
    Ask Gemini to identify road faults in the image at image_path.
    Returns the same result shape as ai_service.analyze_image(), or None if
    Gemini could not be used (caller should fall back to OpenCV detection).
    """
    client = _get_client()
    if client is None:
        return None

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except OSError as e:
        print(f"❌ Gemini: could not read {image_path}: {e}")
        return None

    if not image_bytes:
        return None

    ext = os.path.splitext(image_path)[1].lower()
    mime_type = _MIME_TYPES.get(ext, "image/jpeg")

    try:
        from google.genai import types

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                _PROMPT,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_RoadFaultAnalysis,
                temperature=0.1,
            ),
        )

        parsed: _RoadFaultAnalysis = response.parsed
        if parsed is None:
            print("⚠️ Gemini returned no parsed result")
            return None

    except Exception as e:
        print(f"❌ Gemini analysis error: {e}")
        return None

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

    print(f"\n  🤖 Gemini: {len(detections)} fault(s) — {parsed.summary}")
    for d in detections:
        print(f"     → {d['fault_type']} | {d['severity']} | conf={d['confidence']}")

    if not detections:
        return {
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
        "fault_detected": True,
        "fault_type": primary["fault_type"],
        "severity": primary["severity"],
        "confidence": primary["confidence"],
        "all_detections": detections,
        "total_faults": len(detections),
        "message": f"{len(detections)} fault(s) detected: " +
                   ", ".join(d["fault_type"] for d in detections),
    }
