"""
Reverse geocoding for fault reports.

Uses the Google Geocoding API when GOOGLE_MAPS_API_KEY is set, otherwise falls
back to OpenStreetMap Nominatim (free, rate limited to 1 request/second), so a
report always ends up with a human-readable location instead of
"Unnamed Road".
"""

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from typing import Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
USER_AGENT = "ui-road-monitor/1.0 (road fault reporting)"

# Nominatim's usage policy allows at most one request per second.
_nominatim_lock = threading.Lock()
_last_nominatim_call = 0.0


def _get_json(url: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def _google(lat: float, lon: float) -> Optional[Tuple[str, str]]:
    params = urllib.parse.urlencode({"latlng": f"{lat},{lon}", "key": GOOGLE_MAPS_API_KEY})
    data = _get_json(f"https://maps.googleapis.com/maps/api/geocode/json?{params}")
    results = data.get("results") or []
    if not results:
        return None

    address = results[0].get("formatted_address")
    name = None
    for result in results:
        for component in result.get("address_components", []):
            types = component.get("types", [])
            if "route" in types and component.get("long_name") not in (None, "Unnamed Road"):
                name = component["long_name"]
                break
            if not name and ("point_of_interest" in types or "premise" in types):
                name = component.get("long_name")
        if name:
            break
    return (name or (address.split(",")[0] if address else None), address)


def _nominatim(lat: float, lon: float) -> Optional[Tuple[str, str]]:
    global _last_nominatim_call
    with _nominatim_lock:
        wait = 1.05 - (time.time() - _last_nominatim_call)
        if wait > 0:
            time.sleep(wait)
        params = urllib.parse.urlencode({
            "format": "json", "lat": lat, "lon": lon, "zoom": 18, "addressdetails": 1,
        })
        try:
            data = _get_json(f"https://nominatim.openstreetmap.org/reverse?{params}")
        finally:
            _last_nominatim_call = time.time()

    if not data or data.get("error"):
        return None

    parts = data.get("address") or {}
    road = (parts.get("road") or parts.get("pedestrian") or parts.get("footway")
            or parts.get("path") or parts.get("residential"))
    landmark = data.get("name") or parts.get("amenity") or parts.get("building") or parts.get("shop")
    if road and landmark and landmark != road:
        name = f"{road} · near {landmark}"
    else:
        name = road or landmark or parts.get("suburb") or parts.get("neighbourhood")
    return (name, data.get("display_name"))


def reverse_geocode(lat: float, lon: float) -> Tuple[Optional[str], Optional[str]]:
    """Returns (location_name, full_address); either may be None on failure."""
    if lat is None or lon is None:
        return None, None

    providers = [_google, _nominatim] if GOOGLE_MAPS_API_KEY else [_nominatim]
    for provider in providers:
        for attempt in range(2):  # one retry — Nominatim times out intermittently
            try:
                result = provider(lat, lon)
                if result and (result[0] or result[1]):
                    return result
                break
            except Exception as e:
                print(f"[warn] Geocoding via {provider.__name__} failed for {lat},{lon} (attempt {attempt + 1}): {e}")
    return None, None


def fill_report_location(report_id: int):
    """Background task: geocode one report and save its location fields."""
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        report = db.query(models.FaultReport).filter(models.FaultReport.id == report_id).first()
        if not report:
            return
        name, address = reverse_geocode(report.latitude, report.longitude)
        if name or address:
            report.location_name = (name or "")[:200] or None
            report.address = address
            db.commit()
    finally:
        db.close()
