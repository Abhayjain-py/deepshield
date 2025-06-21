"""
Security utilities and middleware
"""
import hashlib
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import logging
from .config import settings

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Security
security = HTTPBearer()


class SecurityManager:
    """Security utilities manager"""
    
    @staticmethod
    def generate_otp(length: int = None) -> str:
        """Generate secure OTP"""
        length = length or settings.otp_length
        return ''.join(secrets.choice('0123456789') for _ in range(length))
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
    
    @staticmethod
    def hash_file(file_content: bytes) -> str:
        """Generate SHA-256 hash of file content"""
        return hashlib.sha256(file_content).hexdigest()
    
    @staticmethod
    def generate_case_number() -> str:
        """Generate unique case number for complaints"""
        timestamp = datetime.now().strftime("%Y%m%d")
        random_part = secrets.token_hex(4).upper()
        return f"DS-{timestamp}-{random_part}"
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename for safe storage"""
        import re
        # Remove or replace dangerous characters
        filename = re.sub(r'[^\w\-_\.]', '_', filename)
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250] + ('.' + ext if ext else '')
        return filename
    
    @staticmethod
    def validate_file_type(filename: str, content_type: str) -> bool:
        """Validate file type against allowed types"""
        if not filename or not content_type:
            return False
        
        # Check file extension
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if file_ext not in settings.allowed_extensions:
            return False
        
        # Check MIME type
        if content_type not in settings.allowed_mime_types:
            return False
        
        return True
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Get client IP address from request"""
        # Check for forwarded headers (proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host if request.client else "unknown"


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = {}
    
    def is_allowed(self, key: str, limit: int = None, window: int = None) -> bool:
        """Check if request is allowed based on rate limit"""
        limit = limit or settings.rate_limit_requests
        window = window or settings.rate_limit_window
        
        now = datetime.now()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if (now - req_time).total_seconds() < window
        ]
        
        # Check limit
        if len(self.requests[key]) >= limit:
            return False
        
        # Add current request
        self.requests[key].append(now)
        return True


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_current_user(credentials: HTTPAuthorizationCredentials = security):
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = SecurityManager.verify_token(token)
    return payload


class SecurityMiddleware:
    """Security middleware for additional protection"""
    
    @staticmethod
    def add_security_headers(response):
        """Add security headers to response"""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response