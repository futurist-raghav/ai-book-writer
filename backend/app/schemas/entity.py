"""
Entity Schemas

Pydantic models for entity request/response handling.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.entity import EntityType


class EntityMetadata(BaseModel):
    """Flexible metadata container for entity-specific attributes."""

    class Config:
        extra = "allow"  # Allow any additional fields


class EntityCreateRequest(BaseModel):
    """Request model for creating an entity."""

    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default=EntityType.CHARACTER.value)
    description: Optional[str] = None
    metadata: Optional[dict] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Aragorn",
                "type": "character",
                "description": "Ranger from the North",
                "metadata": {
                    "age": 87,
                    "gender": "male",
                    "role": "protagonist",
                },
            }
        }


class EntityUpdateRequest(BaseModel):
    """Request model for updating an entity."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    metadata: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Updated description",
                "metadata": {
                    "age": 88,
                },
            }
        }


class EntityResponse(BaseModel):
    """Response model for entity data."""

    id: UUID
    book_id: UUID
    name: str
    type: str
    description: Optional[str]
    metadata: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EntityListResponse(BaseModel):
    """Response model for entity list."""

    entities: list[EntityResponse]
    total_count: int
    by_type: dict[str, int] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "entities": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "book_id": "550e8400-e29b-41d4-a716-446655440001",
                        "name": "Aragorn",
                        "type": "character",
                        "description": "Ranger",
                        "metadata": {"age": 87},
                        "created_at": "2026-04-10T10:00:00",
                        "updated_at": "2026-04-10T10:00:00",
                    }
                ],
                "total_count": 1,
                "by_type": {"character": 1},
            }
        }


class EntityWithChapterReferences(EntityResponse):
    """Entity with chapter references where it appears."""

    chapter_mentions: Optional[int] = 0
    first_mention_chapter_id: Optional[UUID] = None
    first_mention_chapter_title: Optional[str] = None

    class Config:
        from_attributes = True
