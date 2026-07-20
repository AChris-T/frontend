from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
import models, schemas
from typing import List

router = APIRouter(prefix="/roads", tags=["Roads"])

@router.get("", response_model=List[schemas.RoadResponse])
def get_all_roads(db: Session = Depends(get_db)):
    roads = db.query(models.Road).all()
    return roads

@router.get("/{road_id}", response_model=schemas.RoadResponse)
def get_road(road_id: int, db: Session = Depends(get_db)):
    road = db.query(models.Road).filter(models.Road.id == road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail="Road not found")
    return road

@router.get("/{road_id}/reports")
def get_road_reports(road_id: int, db: Session = Depends(get_db)):
    road = db.query(models.Road).filter(models.Road.id == road_id).first()
    if not road:
        raise HTTPException(status_code=404, detail="Road not found")
    
    reports = db.query(models.FaultReport).filter(
        models.FaultReport.road_id == road_id
    ).order_by(models.FaultReport.created_at.desc()).all()

    return {
        "road": {
            "id": road.id,
            "name": road.name,
            "road_type": road.road_type,
            "fault_count": road.fault_count,
            "severity": road.severity,
            "status": road.status
        },
        "reports": [
            {
                "id": r.id,
                "fault_type": r.fault_type,
                "severity": r.severity,
                "confidence": r.confidence,
                "status": r.status,
                "photo_url": r.photo_url,
                "video_url": r.video_url,
                "ai_result": r.ai_result,
                "created_at": r.created_at
            } for r in reports
        ],
        "total": len(reports)
    }

@router.get("/geojson/all")
def get_roads_geojson(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT 
            id, name, road_type, fault_count, 
            severity, status,
            ST_AsGeoJSON(geom)::json as geometry
        FROM roads
        WHERE geom IS NOT NULL
    """))
    
    features = []
    for row in result:
        features.append({
            "type": "Feature",
            "geometry": row.geometry,
            "properties": {
                "id": row.id,
                "name": row.name,
                "road_type": row.road_type,
                "fault_count": row.fault_count,
                "severity": row.severity,
                "status": row.status
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

@router.get("/nearest/point")
def get_nearest_road(lat: float, lon: float, db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT 
            id, name, road_type, fault_count, severity, status,
            ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) as distance
        FROM roads
        WHERE geom IS NOT NULL
        ORDER BY distance
        LIMIT 1
    """), {"lat": lat, "lon": lon})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No roads found")
    
    return {
        "id": row.id,
        "name": row.name,
        "road_type": row.road_type,
        "fault_count": row.fault_count,
        "severity": row.severity,
        "status": row.status,
        "distance_meters": round(row.distance, 2)
    }