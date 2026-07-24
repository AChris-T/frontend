import logging
import os

import geopandas as gpd
from sqlalchemy import text

from database import engine

logger = logging.getLogger(__name__)

GPKG_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "data",
    "UI_Campus_Roads.gpkg",
)


def seed_roads_if_empty() -> None:
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM roads")).scalar()

    if count and count > 0:
        print(f"✅ Roads table already has {count} segments — skipping import")
        logger.info("Roads table already has %s segments — skipping import", count)
        return

    if not os.path.exists(GPKG_PATH):
        print(f"⚠️ Roads table is empty and campus road data was not found at {GPKG_PATH}")
        logger.warning(
            "Roads table is empty and campus road data was not found at %s",
            GPKG_PATH,
        )
        return

    print(f"📍 Importing campus roads from {GPKG_PATH}")
    logger.info("Importing campus roads from %s", GPKG_PATH)
    gdf = gpd.read_file(GPKG_PATH).to_crs("EPSG:4326")
    gdf = gdf.rename_geometry("geom")
    gdf = gdf[
        ["segment_id", "name", "road_type", "fault_count", "severity", "status", "geom"]
    ].copy()
    gdf["fault_count"] = gdf["fault_count"].fillna(0).astype(int)
    gdf["severity"] = gdf["severity"].fillna("none")
    gdf["status"] = gdf["status"].fillna("good")
    gdf["name"] = gdf["name"].fillna("Unnamed Road")

    gdf.to_postgis(name="roads", con=engine, if_exists="append", index=False)
    print(f"✅ Imported {len(gdf)} road segments")
    logger.info("Imported %s road segments", len(gdf))
