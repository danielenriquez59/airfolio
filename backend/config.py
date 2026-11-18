"""
Configuration settings for the FastAPI backend.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union


class Settings(BaseSettings):
    """Application settings"""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.netlify.app",  # For Netlify deployments
    ]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS_ORIGINS from string or list"""
        if isinstance(v, str):
            # Handle comma-separated string
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # Database (Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""  # For server-side operations

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # older .env files still set SUPABASE_KEY and REDIS_*


settings = Settings()

