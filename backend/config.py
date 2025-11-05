"""
Configuration settings for the FastAPI backend.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    API_TITLE: str = "Airfoil Analysis API"
    API_VERSION: str = "1.0.0"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.netlify.app",  # For Netlify deployments
    ]
    
    # Database (Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""  # For server-side operations
    
    # Redis (for job queue)
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: Optional[str] = None
    
    # Job Queue Settings
    JOB_QUEUE_NAME: str = "airfoil_analysis_queue"
    MAX_CONCURRENT_JOBS: int = 5
    
    # Analysis Settings
    DEFAULT_ALPHA_STEP: float = 0.5
    MAX_ALPHA_RANGE: float = 40.0  # degrees
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

