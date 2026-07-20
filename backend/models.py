from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    reports = relationship("FaultReport", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Road(Base):
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True, index=True)
    segment_id = Column(Integer)
    name = Column(String(200))
    road_type = Column(String(50))
    fault_count = Column(Integer, default=0)
    severity = Column(String(20), default="none")
    status = Column(String(20), default="good")
    last_reported = Column(DateTime, nullable=True)
    geom = Column(Geometry("LINESTRING", srid=4326))

    reports = relationship("FaultReport", back_populates="road")


class FaultReport(Base):
    __tablename__ = "fault_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=True)
    reporter_email = Column(String(150), nullable=True)
    fault_type = Column(String(50))
    severity = Column(String(20))
    confidence = Column(Float)
    description = Column(Text)
    status = Column(String(30), default="reported")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    photo_url = Column(Text)
    video_url = Column(Text)
    ai_result = Column(JSONB)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)

    user = relationship("User", back_populates="reports")
    road = relationship("Road", back_populates="reports")
    status_history = relationship("StatusHistory", back_populates="report")
    notifications = relationship("Notification", back_populates="report")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("fault_reports.id"))
    old_status = Column(String(30))
    new_status = Column(String(30))
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=datetime.now)
    note = Column(Text)

    report = relationship("FaultReport", back_populates="status_history")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    report_id = Column(Integer, ForeignKey("fault_reports.id"))
    email_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", back_populates="notifications")
    report = relationship("FaultReport", back_populates="notifications")