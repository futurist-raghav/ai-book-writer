"""
User Schemas

Request and response schemas for user-related endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin

MAX_BCRYPT_PASSWORD_BYTES = 72


# ============== Request Schemas ==============


class UserCreate(BaseModel):
    """Schema for user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)
    ai_assist_enabled: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
            raise ValueError("Password must be 72 UTF-8 bytes or fewer")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user profile."""

    full_name: Optional[str] = Field(None, max_length=255)
    writing_style: Optional[str] = Field(None, max_length=50)
    preferred_tense: Optional[str] = Field(None, max_length=20)
    preferred_perspective: Optional[str] = Field(None, max_length=20)
    ai_assist_enabled: Optional[bool] = None


class WritingProfileUpdate(BaseModel):
    """Schema for updating writing preferences."""

    writing_style: Optional[str] = None  # narrative, journal, memoir, fiction
    preferred_tense: Optional[str] = None  # past, present
    preferred_perspective: Optional[str] = None  # first, third
    writing_preferences: Optional[dict] = None
    ai_assist_enabled: Optional[bool] = None


class PasswordChange(BaseModel):
    """Schema for changing password."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
            raise ValueError("Password must be 72 UTF-8 bytes or fewer")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


# ============== Response Schemas ==============


class UserResponse(BaseSchema, IDMixin, TimestampMixin):
    """Schema for user response."""

    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    writing_style: Optional[str] = None
    preferred_tense: Optional[str] = None
    preferred_perspective: Optional[str] = None
    ai_assist_enabled: bool
    last_login: Optional[datetime] = None


class UserProfileResponse(UserResponse):
    """Extended user profile response."""

    writing_preferences: Optional[dict] = None


class TokenResponse(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str
