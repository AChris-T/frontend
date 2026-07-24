from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import test_connection, engine, Base, DATABASE_URL
from routes import users, roads, reports, admin
import models
import psycopg2
import uvicorn

app = FastAPI(
    title="UI Road Monitor API",
    description="GIS-Based Road Infrastructure Condition Monitoring System",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    # Create the PostGIS extension using a raw psycopg2 connection with
    # autocommit enabled. This guarantees the extension is fully committed
    # to the database before anything else tries to use spatial types.
    # Doing this through SQLAlchemy's connection pool can leave the
    # extension invisible to other pooled connections, so we go around it.
    raw_conn = psycopg2.connect(DATABASE_URL)
    try:
        raw_conn.autocommit = True
        with raw_conn.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    finally:
        raw_conn.close()

    # Dispose of the SQLAlchemy engine's connection pool so that any
    # connections cached before the extension existed are discarded.
    # Subsequent connections will be created fresh and will see PostGIS.
    engine.dispose()

    # Create all tables defined in models.py that do not yet exist.
    # This does not drop or modify existing tables.
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include all routes
app.include_router(users.router)
app.include_router(roads.router)
app.include_router(reports.router)
app.include_router(admin.router)

@app.get("/")
def root():
    return {
        "message": "UI Road Monitor API is running",
        "version": "1.0.0",
        "status": "active"
    }

@app.get("/health")
def health():
    connected, error = test_connection()
    return {
        "status": "healthy",
        "database": "connected" if connected else "disconnected",
        "database_error": error
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)