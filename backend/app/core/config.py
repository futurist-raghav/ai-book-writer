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

    # Runtime concurrency (used by gunicorn/uvicorn workers in production)
    WEB_CONCURRENCY: int = 4
    UVICORN_TIMEOUT: int = 120
    UVICORN_GRACEFUL_TIMEOUT: int = 30
    UVICORN_KEEPALIVE: int = 5

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into a list."""
        parsed = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

        # Keep local development reliable even when environment overrides are incomplete.
        if self.ENVIRONMENT.lower() == "development":
            dev_defaults = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3001",
                "capacitor://localhost",
                "ionic://localhost",
            ]
            merged = parsed + dev_defaults
        else:
            merged = parsed

        # Preserve order while removing duplicates.
        return list(dict.fromkeys(merged))

    # Database
    DATABASE_URL: str = "postgresql://aibook_user:password@localhost:5432/aibook"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_STATEMENT_TIMEOUT_MS: int = 30000

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
    PREFERRED_STT_SERVICE: str = "openai"
    STT_PROVIDER: str = "openai"
    WHISPER_TIMEOUT_SECONDS: int = 3600
    WHISPER_VM_BASE_URL: Optional[str] = None
    WHISPER_VM_MODEL_NAME: str = "large-v3"
    WHISPER_VM_DEFAULT_TASK: str = "transcribe"
    WHISPER_VM_OUTPUT_FORMAT: str = "json"
    WHISPER_VM_ENCODE: bool = True
    WHISPER_VM_WORD_TIMESTAMPS: bool = False

    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_AI_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY_1: Optional[str] = None
    GOOGLE_GEMINI_API_KEY_2: Optional[str] = None
    GOOGLE_GEMINI_API_KEY_3: Optional[str] = None
    GOOGLE_GEMINI_MODEL: str = "gemini-3-flash-preview"
    ANTHROPIC_API_KEY: Optional[str] = None

    @property
    def gemini_api_keys(self) -> List[str]:
        """Get ordered Gemini API keys with backward compatibility support."""
        keys = [
            self.GOOGLE_GEMINI_API_KEY_1,
            self.GOOGLE_GEMINI_API_KEY_2,
            self.GOOGLE_GEMINI_API_KEY_3,
            self.GOOGLE_GEMINI_API_KEY,
            self.GOOGLE_AI_API_KEY,
        ]
        # Preserve order while removing empty values and duplicates.
        return list(dict.fromkeys([key for key in keys if key]))

    @field_validator("PREFERRED_STT_SERVICE", "STT_PROVIDER")
    @classmethod
    def validate_stt_provider(cls, value: str) -> str:
        """Restrict STT provider values to supported options."""
        normalized = value.strip().lower()
        if normalized not in {"openai", "whisper_vm"}:
            raise ValueError("STT provider must be 'openai' or 'whisper_vm'")
        return normalized

    @field_validator("WHISPER_VM_OUTPUT_FORMAT")
    @classmethod
    def validate_whisper_vm_output_format(cls, value: str) -> str:
        """Validate supported output formats for whisper-asr-webservice."""
        normalized = value.strip().lower()
        if normalized not in {"json", "txt", "vtt", "srt", "tsv"}:
            raise ValueError("WHISPER_VM_OUTPUT_FORMAT must be one of: json, txt, vtt, srt, tsv")
        return normalized

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
