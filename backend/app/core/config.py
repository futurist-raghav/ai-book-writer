"""
Application Configuration

Manages all environment variables and application settings using Pydantic Settings.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "AI Book Writer"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # API
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # Database
    DATABASE_URL: str = "postgresql://aibook_user:password@localhost:5432/aibook"

    @property
    def async_database_url(self) -> str:
        """Convert sync database URL to async."""
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # JWT Authentication
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI Service API Keys
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_AI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Storage
    STORAGE_BACKEND: str = "local"  # local, gcs, s3
    LOCAL_STORAGE_PATH: str = "./storage"

    # Google Cloud Storage
    GCS_BUCKET_NAME: Optional[str] = None
    GCS_PROJECT_ID: Optional[str] = None

    # AWS S3
    AWS_S3_BUCKET: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # ChromaDB
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001

    # Logging
    LOG_LEVEL: str = "INFO"

    # File Upload Limits
    MAX_AUDIO_FILE_SIZE_MB: int = 500
    ALLOWED_AUDIO_FORMATS: str = "mp3,wav,m4a,flac,ogg,webm"

    @property
    def allowed_audio_formats_list(self) -> List[str]:
        """Parse ALLOWED_AUDIO_FORMATS into a list."""
        return [fmt.strip().lower() for fmt in self.ALLOWED_AUDIO_FORMATS.split(",")]

    @property
    def max_audio_file_size_bytes(self) -> int:
        """Convert MB to bytes."""
        return self.MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Using lru_cache ensures settings are only loaded once.
    """
    return Settings()


# Export settings instance for convenience
settings = get_settings()
