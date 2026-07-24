from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db, test_connection
from routes import users, roads, reports, admin
import os
import uvicorn


def _cors_origins() -> list[str]:
    origins: list[str] = []
    frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend:
        origins.append(frontend)
    extra = os.getenv("CORS_ORIGINS", "")
    for origin in extra.split(","):
        origin = origin.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)
    return origins or ["*"]


app = FastAPI(
    title="UI Road Monitor API",
    description="GIS-Based Road Infrastructure Condition Monitoring System",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
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
