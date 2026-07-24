from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db, test_connection
from routes import users, roads, reports, admin
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="UI Road Monitor API",
    description="GIS-Based Road Infrastructure Condition Monitoring System",
    version="1.0.0",
    lifespan=lifespan,
)

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