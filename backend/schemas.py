from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# User schemas
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Fault report schemas
class FaultReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: Optional[str] = None
    fault_type: Optional[str] = None

class FaultReportResponse(BaseModel):
    id: int
    fault_type: Optional[str]
    severity: Optional[str]
    confidence: Optional[float]
    description: Optional[str]
    status: str
    latitude: float
    longitude: float
    photo_url: Optional[str]
    video_url: Optional[str]
    ai_result: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

# Road schemas
class RoadResponse(BaseModel):
    id: int
    name: Optional[str]
    road_type: Optional[str]
    fault_count: int
    severity: str
    status: str
    last_reported: Optional[datetime]

    class Config:
        from_attributes = True