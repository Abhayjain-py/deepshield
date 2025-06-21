"""
Configuration management for DeepShield backend
"""
import os
from typing import List, Optional
from pydantic import BaseSettings, validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with validation"""
    
    # Application
    app_name: str = "DeepShield API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Database
    database_url: str = "sqlite:///./deepshield.db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # OTP
    otp_expiry_minutes: int = 10
    otp_length: int = 6
    
    # File Upload
    max_file_size: int = 52428800  # 50MB
    upload_dir: str = "./uploads"
    allowed_extensions: List[str] = [
        "jpg", "jpeg", "png", "gif", "bmp", "webp",  # Images
        "mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"  # Videos
    ]
    allowed_mime_types: List[str] = [
        "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp",
        "video/mp4", "video/avi", "video/quicktime", "video/x-msvideo",
        "video/x-flv", "video/webm", "video/x-matroska"
    ]
    
    # CORS
    allowed_origins: List[str] = ["*"]
    allowed_methods: List[str] = ["*"]
    allowed_headers: List[str] = ["*"]
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600  # 1 hour
    
    # Email (for production)
    smtp_server: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True
    
    # AI Model
    model_confidence_threshold: float = 0.7
    model_batch_size: int = 1
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "deepshield.log"
    
    # Redis (for production caching)
    redis_url: Optional[str] = None
    
    # Monitoring
    enable_metrics: bool = False
    metrics_port: int = 9090
    
    @validator('allowed_origins', pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    @validator('upload_dir')
    def create_upload_dir(cls, v):
        os.makedirs(v, exist_ok=True)
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export settings instance
settings = get_settings()