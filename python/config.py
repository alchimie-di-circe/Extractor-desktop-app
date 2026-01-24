"""Configuration for Cagent sidecar server."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment or defaults"""
    
    HOST: str = "127.0.0.1"
    PORT: int = 8765
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
