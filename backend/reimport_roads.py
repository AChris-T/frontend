import geopandas as gpd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

GPKG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "UI_Campus_Roads.gpkg")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

print("Connecting to database...")

# Step 1 — Clear existing roads and reset fault reports road_id
with engine.connect() as conn:
    conn.execute(text("UPDATE fault_reports SET road_id = NULL"))
    conn.execute(text("DELETE FROM roads"))
    conn.execute(text("ALTER SEQUENCE roads_id_seq RESTART WITH 1"))
    conn.commit()
    print("✅ Old roads cleared")

# Step 2 — Load clean road file
print("Loading clean road network...")
gdf = gpd.read_file(GPKG_PATH)
gdf = gdf.to_crs("EPSG:4326")

# Rename geometry column
gdf = gdf.rename_geometry('geom')

# Select only needed columns
gdf_clean = gdf[['segment_id', 'name', 'road_type',
                  'fault_count', 'severity', 'status', 'geom']].copy()

gdf_clean['fault_count'] = gdf_clean['fault_count'].fillna(0).astype(int)
gdf_clean['severity'] = gdf_clean['severity'].fillna('none')
gdf_clean['status'] = gdf_clean['status'].fillna('good')
gdf_clean['name'] = gdf_clean['name'].fillna('Unnamed Road')

print(f"Importing {len(gdf_clean)} clean campus roads...")

gdf_clean.to_postgis(
    name='roads',
    con=engine,
    if_exists='append',
    index=False
)

# Step 3 — Verify
with engine.connect() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM roads")).scalar()
    print(f"✅ Database now has {count} road segments")

    # Check no Akinyele Road
    akinyele = conn.execute(text(
        "SELECT COUNT(*) FROM roads WHERE name = 'Akinyele Road'"
    )).scalar()
    print(f"✅ Akinyele Road in database: {akinyele} (should be 0)")

    # Show sample
    result = conn.execute(text(
        "SELECT name, road_type FROM roads WHERE name != 'Unnamed Road' LIMIT 10"
    ))
    print("\nSample named roads in database:")
    for row in result:
        print(f"  - {row[0]} ({row[1]})")