"""
Enhanced DeepShield FastAPI Application
"""
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from sqlalchemy.orm import Session
import logging
import time
from contextlib import asynccontextmanager

# Local imports
from .config import settings
from .database import get_db, DatabaseManager
from .models import User, MediaUpload, Complaint
from .services import UserService, OTPService, MediaService, ComplaintService, DashboardService, AuditService
from .security import SecurityManager, rate_limiter, get_current_user
from .ai_detector import deepfake_detector, complaint_classifier

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(settings.log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting DeepShield API...")
    DatabaseManager.init_db()
    logger.info("Database initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down DeepShield API...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-Powered Deepfake Detection and Complaint Management System",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

if not settings.debug:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.deepshield.com"]
    )


# Middleware for request logging and security
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests and add security headers"""
    start_time = time.time()
    
    # Get client info
    client_ip = SecurityManager.get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log request
    logger.info(
        f"{request.method} {request.url.path} - "
        f"{response.status_code} - {process_time:.3f}s - {client_ip}"
    )
    
    return response


# Exception handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    client_ip = SecurityManager.get_client_ip(request)
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {client_ip}")
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    client_ip = SecurityManager.get_client_ip(request)
    logger.error(f"Unhandled exception: {exc} - {client_ip}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Health check endpoints
@app.get("/", tags=["Health"])
async def root():
    """API health check"""
    return {
        "message": "DeepShield API is running",
        "version": settings.app_version,
        "status": "healthy"
    }


@app.get("/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Detailed health check"""
    try:
        # Check database
        db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "unhealthy",
        "database": db_status,
        "version": settings.app_version,
        "timestamp": time.time()
    }


# Authentication endpoints
@app.post("/auth/send-otp", tags=["Authentication"])
async def send_otp(
    request: Request,
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """Send OTP to email address"""
    client_ip = SecurityManager.get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    
    try:
        result = await OTPService.send_otp(db, email, client_ip, user_agent)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send OTP error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP"
        )


@app.post("/auth/verify-otp", tags=["Authentication"])
async def verify_otp(
    request: Request,
    email: str = Form(...),
    otp: str = Form(...),
    db: Session = Depends(get_db)
):
    """Verify OTP and authenticate user"""
    client_ip = SecurityManager.get_client_ip(request)
    
    try:
        result = OTPService.verify_otp(db, email, otp, client_ip)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify OTP error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify OTP"
        )


# Media detection endpoints
@app.post("/media/detect", tags=["Detection"])
async def detect_deepfake(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and analyze media for deepfake detection"""
    client_ip = SecurityManager.get_client_ip(request)
    
    # Rate limiting
    if not rate_limiter.is_allowed(f"detect:{client_ip}", limit=10, window=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many detection requests. Please try again later."
        )
    
    try:
        result = await MediaService.upload_and_detect(
            db, file, current_user["sub"], client_ip
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process media file"
        )


# Complaint endpoints
@app.post("/complaints/submit", tags=["Complaints"])
async def submit_complaint(
    request: Request,
    complaint_text: str = Form(...),
    complaint_type: str = Form("text"),
    incident_date: str = Form(None),
    source_url: str = Form(None),
    impact_level: str = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a complaint for review"""
    client_ip = SecurityManager.get_client_ip(request)
    
    # Rate limiting
    if not rate_limiter.is_allowed(f"complaint:{client_ip}", limit=5, window=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many complaint submissions. Please try again later."
        )
    
    try:
        # Prepare additional data
        additional_data = {}
        if incident_date:
            from datetime import datetime
            additional_data['incident_date'] = datetime.fromisoformat(incident_date)
        if source_url:
            additional_data['source_url'] = source_url
        if impact_level:
            additional_data['impact_level'] = impact_level
        
        result = await ComplaintService.submit_complaint(
            db, current_user["sub"], complaint_text, complaint_type, **additional_data
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complaint submission error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit complaint"
        )


# Dashboard endpoints
@app.get("/dashboard", tags=["Dashboard"])
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user dashboard data"""
    try:
        result = DashboardService.get_user_dashboard(db, current_user["sub"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load dashboard data"
        )


# User profile endpoints
@app.get("/profile", tags=["Profile"])
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user profile information"""
    try:
        user = UserService.get_user_by_email(db, current_user["sub"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone_number": user.phone_number,
            "country": user.country,
            "member_since": user.created_at.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "login_count": user.login_count,
            "is_verified": user.is_verified
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load profile"
        )


# Admin endpoints (if needed)
@app.get("/admin/stats", tags=["Admin"])
async def get_admin_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get system statistics (admin only)"""
    # In production, add admin role check
    try:
        total_users = db.query(User).count()
        total_uploads = db.query(MediaUpload).count()
        total_complaints = db.query(Complaint).count()
        deepfake_detections = db.query(MediaUpload).filter(
            MediaUpload.detection_result == "Deepfake"
        ).count()
        
        return {
            "total_users": total_users,
            "total_uploads": total_uploads,
            "total_complaints": total_complaints,
            "deepfake_detections": deepfake_detections,
            "detection_rate": round(deepfake_detections / max(total_uploads, 1) * 100, 2)
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load statistics"
        )


# Legacy endpoints for backward compatibility
@app.post("/send-otp", include_in_schema=False)
async def legacy_send_otp(request: Request, email: str = Form(...), db: Session = Depends(get_db)):
    """Legacy endpoint - redirects to new auth endpoint"""
    return await send_otp(request, email, db)


@app.post("/verify-otp", include_in_schema=False)
async def legacy_verify_otp(request: Request, email: str = Form(...), otp: str = Form(...), db: Session = Depends(get_db)):
    """Legacy endpoint - redirects to new auth endpoint"""
    return await verify_otp(request, email, otp, db)


@app.post("/detect", include_in_schema=False)
async def legacy_detect(request: Request, file: UploadFile = File(...), user_email: str = Form(...), db: Session = Depends(get_db)):
    """Legacy endpoint - requires authentication now"""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="This endpoint requires authentication. Please use /media/detect with a valid token."
    )


@app.post("/complaint", include_in_schema=False)
async def legacy_complaint(request: Request, user_email: str = Form(...), complaint_text: str = Form(...), complaint_type: str = Form("text"), db: Session = Depends(get_db)):
    """Legacy endpoint - requires authentication now"""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="This endpoint requires authentication. Please use /complaints/submit with a valid token."
    )


@app.get("/dashboard/{user_email}", include_in_schema=False)
async def legacy_dashboard(user_email: str, db: Session = Depends(get_db)):
    """Legacy endpoint - requires authentication now"""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="This endpoint requires authentication. Please use /dashboard with a valid token."
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )