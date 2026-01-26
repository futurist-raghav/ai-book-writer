"""
Common Schema Components

Shared schema components used across the application.
"""

from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""

    created_at: datetime
    updated_at: datetime


class IDMixin(BaseModel):
    """Mixin for ID field."""

    id: UUID


# Generic type for pagination
T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""

    items: List[T]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def create(
        cls,
        items: List[T],
        total: int,
        page: int,
        limit: int,
    ) -> "PaginatedResponse[T]":
        """Create a paginated response."""
        pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response."""

    detail: str
    error_code: Optional[str] = None
