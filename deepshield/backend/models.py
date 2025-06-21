"""
Database models for DeepShield
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum
import uuid


Base = declarative_base()


class DetectionStatus(str, Enum):
    """Detection result status"""
    AUTHENTIC = "authentic"
    DEEPFAKE = "deepfake"
    UNCERTAIN = "uncertain"


class ComplaintStatus(str, Enum):
    """Complaint processing status"""
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ComplaintCategory(str, Enum):
    """Complaint categories"""
    HARASSMENT = "harassment"
    IMPERSONATION = "impersonation"
    IDENTITY_THEFT = "identity_theft"
    CYBERBULLYING = "cyberbullying"
    FRAUD = "fraud"
    REVENGE_PORN = "revenge_porn"
    DEFAMATION = "defamation"
    OTHER = "other"


class User(Base):
    """User model with enhanced fields"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    login_count = Column(Integer, default=0)
    
    # Profile information
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone_number = Column(String(20))
    country = Column(String(100))
    
    # Relationships
    media_uploads = relationship("MediaUpload", back_populates="user")
    complaints = relationship("Complaint", back_populates="user")
    otps = relationship("OTP", back_populates="user")
    
    def __repr__(self):
        return f"<User(email='{self.email}')>"


class OTP(Base):
    """Enhanced OTP model with security features"""
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String(255), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True))
    ip_address = Column(String(45))  # IPv6 support
    user_agent = Column(Text)
    attempts = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="otps")
    
    def __repr__(self):
        return f"<OTP(email='{self.email}', used={self.is_used})>"


class MediaUpload(Base):
    """Enhanced media upload model"""
    __tablename__ = "media_uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # File information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64))  # SHA-256 hash
    
    # Detection results
    detection_result = Column(String(20), nullable=False)
    confidence_score = Column(Float, nullable=False)
    processing_time = Column(Float)  # seconds
    model_version = Column(String(50))
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    ip_address = Column(String(45))
    
    # Analysis details (JSON stored as text)
    analysis_details = Column(Text)  # JSON string
    
    # Relationships
    user = relationship("User", back_populates="media_uploads")
    
    def __repr__(self):
        return f"<MediaUpload(filename='{self.filename}', result='{self.detection_result}')>"


class Complaint(Base):
    """Enhanced complaint model"""
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Complaint content
    complaint_text = Column(Text, nullable=False)
    complaint_type = Column(String(20), default="text")  # text, voice, video
    
    # Classification
    classification_category = Column(String(50))
    classification_confidence = Column(Float)
    
    # Status tracking
    status = Column(String(20), default=ComplaintStatus.SUBMITTED)
    priority = Column(String(10), default="medium")  # low, medium, high, critical
    
    # Additional information
    incident_date = Column(DateTime(timezone=True))
    source_url = Column(String(1000))
    impact_level = Column(String(20))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))
    
    # Case management
    case_number = Column(String(50), unique=True)
    assigned_officer = Column(String(100))
    
    # Relationships
    user = relationship("User", back_populates="complaints")
    
    def __repr__(self):
        return f"<Complaint(id={self.id}, status='{self.status}')>"


class AuditLog(Base):
    """Audit log for security and compliance"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Event details
    event_type = Column(String(50), nullable=False)  # login, upload, complaint, etc.
    event_description = Column(Text)
    
    # Request details
    ip_address = Column(String(45))
    user_agent = Column(Text)
    endpoint = Column(String(200))
    method = Column(String(10))
    
    # Response details
    status_code = Column(Integer)
    response_time = Column(Float)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<AuditLog(event='{self.event_type}', user_id={self.user_id})>"


class SystemMetrics(Base):
    """System performance metrics"""
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Metrics
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(20))
    
    # Metadata
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    tags = Column(Text)  # JSON string for additional tags
    
    def __repr__(self):
        return f"<SystemMetrics(name='{self.metric_name}', value={self.metric_value})>"