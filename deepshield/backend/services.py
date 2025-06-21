"""
Business logic services for DeepShield
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
import aiofiles
import json

from .models import User, OTP, MediaUpload, Complaint, AuditLog
from .security import SecurityManager, rate_limiter
from .ai_detector import deepfake_detector, complaint_classifier
from .config import settings

logger = logging.getLogger(__name__)


class UserService:
    """User management service"""
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get user by email"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def create_user(db: Session, email: str, **kwargs) -> User:
        """Create new user"""
        user = User(email=email, **kwargs)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created new user: {email}")
        return user
    
    @staticmethod
    def update_user_login(db: Session, user: User) -> User:
        """Update user login information"""
        user.last_login = datetime.utcnow()
        user.login_count += 1
        db.commit()
        db.refresh(user)
        return user


class OTPService:
    """OTP management service"""
    
    @staticmethod
    async def send_otp(db: Session, email: str, ip_address: str, user_agent: str) -> Dict[str, Any]:
        """Send OTP to user email"""
        # Rate limiting
        if not rate_limiter.is_allowed(f"otp:{ip_address}", limit=5, window=3600):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP requests. Please try again later."
            )
        
        # Generate OTP
        otp_code = SecurityManager.generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=settings.otp_expiry_minutes)
        
        # Get or create user
        user = UserService.get_user_by_email(db, email)
        if not user:
            user = UserService.create_user(db, email)
        
        # Create OTP record
        otp = OTP(
            user_id=user.id,
            email=email,
            otp_code=otp_code,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(otp)
        db.commit()
        
        # In production, send email here
        # await EmailService.send_otp_email(email, otp_code)
        
        logger.info(f"OTP sent to {email}")
        return {
            "message": "OTP sent successfully",
            "otp": otp_code,  # Remove in production
            "email": email,
            "expires_in": settings.otp_expiry_minutes
        }
    
    @staticmethod
    def verify_otp(db: Session, email: str, otp_code: str, ip_address: str) -> Dict[str, Any]:
        """Verify OTP and create session"""
        # Find valid OTP
        otp = db.query(OTP).filter(
            OTP.email == email,
            OTP.otp_code == otp_code,
            OTP.is_used == False,
            OTP.expires_at > datetime.utcnow()
        ).first()
        
        if not otp:
            # Log failed attempt
            if otp := db.query(OTP).filter(
                OTP.email == email,
                OTP.otp_code == otp_code
            ).first():
                otp.attempts += 1
                db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP"
            )
        
        # Mark OTP as used
        otp.is_used = True
        otp.used_at = datetime.utcnow()
        db.commit()
        
        # Get user and update login info
        user = UserService.get_user_by_email(db, email)
        user = UserService.update_user_login(db, user)
        
        # Create access token
        token_data = {"sub": user.email, "user_id": user.id}
        access_token = SecurityManager.create_access_token(token_data)
        
        # Log successful login
        AuditService.log_event(
            db, user.id, "login", f"Successful OTP login from {ip_address}"
        )
        
        logger.info(f"OTP verified for {email}")
        return {
            "message": "OTP verified successfully",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "email": user.email,
                "id": user.id,
                "created_at": user.created_at.isoformat()
            }
        }


class MediaService:
    """Media upload and detection service"""
    
    @staticmethod
    async def upload_and_detect(
        db: Session, 
        file: UploadFile, 
        user_email: str,
        ip_address: str
    ) -> Dict[str, Any]:
        """Upload file and perform deepfake detection"""
        # Validate file
        if not SecurityManager.validate_file_type(file.filename, file.content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type"
            )
        
        # Check file size
        if file.size > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {settings.max_file_size} bytes"
            )
        
        # Get user
        user = UserService.get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(settings.upload_dir, unique_filename)
        
        try:
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Calculate file hash
            file_hash = SecurityManager.hash_file(content)
            
            # Perform detection
            detection_result = await deepfake_detector.detect_deepfake(
                file_path, file.content_type
            )
            
            # Save to database
            media_upload = MediaUpload(
                user_id=user.id,
                filename=unique_filename,
                original_filename=SecurityManager.sanitize_filename(file.filename),
                file_path=file_path,
                file_type=file.content_type,
                file_size=file.size,
                file_hash=file_hash,
                detection_result=detection_result['detection_result'],
                confidence_score=detection_result['confidence_score'],
                processing_time=detection_result['processing_time'],
                model_version=detection_result['model_version'],
                processed_at=datetime.utcnow(),
                ip_address=ip_address,
                analysis_details=json.dumps(detection_result.get('analysis_details', {}))
            )
            
            db.add(media_upload)
            db.commit()
            db.refresh(media_upload)
            
            # Log event
            AuditService.log_event(
                db, user.id, "media_upload", 
                f"Uploaded {file.filename}, result: {detection_result['detection_result']}"
            )
            
            # Clean up file after processing (optional)
            # os.remove(file_path)
            
            logger.info(f"Media processed: {file.filename} -> {detection_result['detection_result']}")
            
            return {
                "file_id": media_upload.id,
                "filename": file.filename,
                "detection_result": detection_result['detection_result'],
                "confidence_score": detection_result['confidence_score'],
                "processing_time": detection_result['processing_time'],
                "message": f"Detection complete: {detection_result['detection_result']} ({detection_result['confidence_score']}% confidence)"
            }
            
        except Exception as e:
            # Clean up file on error
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Media processing error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing media file"
            )


class ComplaintService:
    """Complaint management service"""
    
    @staticmethod
    async def submit_complaint(
        db: Session,
        user_email: str,
        complaint_text: str,
        complaint_type: str = "text",
        **additional_data
    ) -> Dict[str, Any]:
        """Submit and classify complaint"""
        # Get user
        user = UserService.get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Classify complaint
        classification = await complaint_classifier.classify_complaint(
            complaint_text, complaint_type
        )
        
        # Generate case number
        case_number = SecurityManager.generate_case_number()
        
        # Create complaint record
        complaint = Complaint(
            user_id=user.id,
            complaint_text=complaint_text,
            complaint_type=complaint_type,
            classification_category=classification['category'],
            classification_confidence=classification['confidence'],
            case_number=case_number,
            **additional_data
        )
        
        db.add(complaint)
        db.commit()
        db.refresh(complaint)
        
        # Log event
        AuditService.log_event(
            db, user.id, "complaint_submitted",
            f"Submitted complaint {case_number}, category: {classification['category']}"
        )
        
        logger.info(f"Complaint submitted: {case_number}")
        
        return {
            "message": "Complaint submitted successfully",
            "complaint_id": complaint.id,
            "case_number": case_number,
            "classification": {
                "category": classification['category'],
                "confidence": classification['confidence']
            }
        }


class DashboardService:
    """Dashboard data service"""
    
    @staticmethod
    def get_user_dashboard(db: Session, user_email: str) -> Dict[str, Any]:
        """Get comprehensive dashboard data for user"""
        user = UserService.get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get media uploads
        media_uploads = db.query(MediaUpload).filter(
            MediaUpload.user_id == user.id
        ).order_by(MediaUpload.created_at.desc()).all()
        
        # Get complaints
        complaints = db.query(Complaint).filter(
            Complaint.user_id == user.id
        ).order_by(Complaint.created_at.desc()).all()
        
        # Calculate statistics
        total_uploads = len(media_uploads)
        deepfake_count = sum(1 for upload in media_uploads if upload.detection_result == 'Deepfake')
        complaint_count = len(complaints)
        
        # Calculate protection score
        protection_score = DashboardService._calculate_protection_score(
            total_uploads, deepfake_count, complaint_count
        )
        
        return {
            "user": {
                "email": user.email,
                "member_since": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None
            },
            "statistics": {
                "total_uploads": total_uploads,
                "deepfake_count": deepfake_count,
                "complaint_count": complaint_count,
                "protection_score": protection_score
            },
            "media_uploads": [
                {
                    "id": upload.id,
                    "filename": upload.original_filename,
                    "detection_result": upload.detection_result,
                    "confidence_score": upload.confidence_score,
                    "created_at": upload.created_at.isoformat(),
                    "processing_time": upload.processing_time
                }
                for upload in media_uploads[:20]  # Limit to recent 20
            ],
            "complaints": [
                {
                    "id": complaint.id,
                    "case_number": complaint.case_number,
                    "complaint_text": complaint.complaint_text[:200] + "..." if len(complaint.complaint_text) > 200 else complaint.complaint_text,
                    "complaint_type": complaint.complaint_type,
                    "classification_category": complaint.classification_category,
                    "classification_confidence": complaint.classification_confidence,
                    "status": complaint.status,
                    "created_at": complaint.created_at.isoformat()
                }
                for complaint in complaints[:10]  # Limit to recent 10
            ]
        }
    
    @staticmethod
    def _calculate_protection_score(total_uploads: int, deepfake_count: int, complaint_count: int) -> int:
        """Calculate user protection score"""
        base_score = 85
        
        # Bonus for activity
        if total_uploads > 0:
            base_score += min(total_uploads * 2, 10)
        
        # Penalty for deepfakes found
        if deepfake_count > 0:
            penalty = min(deepfake_count * 5, 20)
            base_score -= penalty
        
        # Bonus for filing complaints (shows awareness)
        if complaint_count > 0:
            base_score += min(complaint_count * 3, 15)
        
        return max(60, min(100, base_score))


class AuditService:
    """Audit logging service"""
    
    @staticmethod
    def log_event(
        db: Session,
        user_id: Optional[int],
        event_type: str,
        description: str,
        **metadata
    ):
        """Log audit event"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                event_type=event_type,
                event_description=description,
                **metadata
            )
            db.add(audit_log)
            db.commit()
        except Exception as e:
            logger.error(f"Audit logging error: {e}")