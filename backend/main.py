from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import test_connection, engine, Base
from routes import users, roads, reports, admin
import models
import uvicorn

app = FastAPI(
    title="UI Road Monitor API",
    description="GIS-Based Road Infrastructure Condition Monitoring System",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    # Ensure the PostGIS extension is enabled before creating tables that use
    # spatial types (e.g. Geometry columns). Without this, PostgreSQL raises
    # "type geometry does not exist" when create_all() runs.
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()

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