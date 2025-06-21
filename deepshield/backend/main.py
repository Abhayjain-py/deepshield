from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
import random
import uuid
import os
import json
from typing import Optional
import aiofiles

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./deepshield.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class OTP(Base):
    __tablename__ = "otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    otp_code = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_used = Column(Integer, default=0)

class MediaUpload(Base):
    __tablename__ = "media_uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True)
    filename = Column(String)
    file_type = Column(String)
    detection_result = Column(String)
    confidence_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class Complaint(Base):
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True)
    complaint_text = Column(Text)
    complaint_type = Column(String)  # text or voice
    classification_category = Column(String)
    classification_confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI(title="DeepShield API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create uploads directory
os.makedirs("uploads", exist_ok=True)

@app.get("/")
async def root():
    return {"message": "DeepShield API is running"}

@app.post("/send-otp")
async def send_otp(email: str = Form(...), db: Session = Depends(get_db)):
    """Send OTP to email (simulated)"""
    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Store OTP in database
    otp_entry = OTP(
        email=email,
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(otp_entry)
    db.commit()
    
    # In a real app, you would send email here
    # For demo purposes, we'll return the OTP (remove in production)
    return {
        "message": "OTP sent successfully",
        "otp": otp_code,  # Remove this in production
        "email": email
    }

@app.post("/verify-otp")
async def verify_otp(email: str = Form(...), otp: str = Form(...), db: Session = Depends(get_db)):
    """Verify OTP and create/login user"""
    # Find valid OTP
    otp_entry = db.query(OTP).filter(
        OTP.email == email,
        OTP.otp_code == otp,
        OTP.is_used == 0,
        OTP.expires_at > datetime.utcnow()
    ).first()
    
    if not otp_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Mark OTP as used
    otp_entry.is_used = 1
    db.commit()
    
    # Create or get user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)
        db.commit()
    
    # Generate session token (simplified)
    session_token = str(uuid.uuid4())
    
    return {
        "message": "OTP verified successfully",
        "session_token": session_token,
        "email": email
    }

@app.post("/detect")
async def detect_deepfake(
    file: UploadFile = File(...),
    user_email: str = Form(...),
    db: Session = Depends(get_db)
):
    """Detect deepfake in uploaded media"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "video/mp4", "video/webm", "video/avi"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    # Save uploaded file
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"uploads/{unique_filename}"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Simulate deepfake detection
    is_deepfake = random.choice([True, False])
    confidence = random.uniform(60, 99)
    
    detection_result = "Deepfake" if is_deepfake else "Authentic"
    
    # Store in database
    media_upload = MediaUpload(
        user_email=user_email,
        filename=unique_filename,
        file_type=file.content_type,
        detection_result=detection_result,
        confidence_score=confidence
    )
    db.add(media_upload)
    db.commit()
    
    return {
        "filename": file.filename,
        "detection_result": detection_result,
        "confidence_score": round(confidence, 1),
        "file_id": media_upload.id,
        "message": f"Detection complete: {detection_result} ({confidence:.1f}% confidence)"
    }

@app.post("/complaint")
async def submit_complaint(
    user_email: str = Form(...),
    complaint_text: str = Form(...),
    complaint_type: str = Form("text"),
    db: Session = Depends(get_db)
):
    """Submit a complaint (text or voice)"""
    # Simulate NLP classification
    categories = ["harassment", "impersonation", "identity_theft", "cyberbullying", "fraud"]
    classification_category = random.choice(categories)
    classification_confidence = random.uniform(70, 95)
    
    # If it's a voice complaint, simulate transcription
    if complaint_type == "voice":
        complaint_text = f"[Voice Transcription] {complaint_text}"
    
    # Store complaint
    complaint = Complaint(
        user_email=user_email,
        complaint_text=complaint_text,
        complaint_type=complaint_type,
        classification_category=classification_category,
        classification_confidence=classification_confidence
    )
    db.add(complaint)
    db.commit()
    
    return {
        "message": "Complaint submitted successfully",
        "complaint_id": complaint.id,
        "classification": {
            "category": classification_category,
            "confidence": round(classification_confidence, 1)
        }
    }

@app.get("/dashboard/{user_email}")
async def get_dashboard_data(user_email: str, db: Session = Depends(get_db)):
    """Get user dashboard data"""
    # Get media uploads
    media_uploads = db.query(MediaUpload).filter(MediaUpload.user_email == user_email).all()
    
    # Get complaints
    complaints = db.query(Complaint).filter(Complaint.user_email == user_email).all()
    
    return {
        "media_uploads": [
            {
                "id": upload.id,
                "filename": upload.filename,
                "detection_result": upload.detection_result,
                "confidence_score": upload.confidence_score,
                "created_at": upload.created_at.isoformat()
            }
            for upload in media_uploads
        ],
        "complaints": [
            {
                "id": complaint.id,
                "complaint_text": complaint.complaint_text[:100] + "..." if len(complaint.complaint_text) > 100 else complaint.complaint_text,
                "complaint_type": complaint.complaint_type,
                "classification_category": complaint.classification_category,
                "classification_confidence": complaint.classification_confidence,
                "created_at": complaint.created_at.isoformat()
            }
            for complaint in complaints
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

