"""
Chapter Edit History Schemas
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserResponse


class ChapterEditCreate(BaseModel):
    """Create a new edit record."""
    content_before: str | None = None
    content_after: str
    edit_type: str
    change_description: str | None = None


class ChapterEditResponse(BaseModel):
    """Response for a single edit."""
    id: UUID
    author_id: UUID
    author: UserResponse | None = None
    created_at: datetime
    
    edit_type: str
    change_description: str | None = None
    
    char_count_before: int
    char_count_after: int
    word_count_before: int
    word_count_after: int
    char_delta: int
    word_delta: int
    
    class Config:
        from_attributes = True


class ChapterEditHistoryResponse(BaseModel):
    """Response for chapter edit history."""
    chapter_id: UUID
    total_edits: int
    editors: list[UUID]
    edits: list[ChapterEditResponse]
    
    class Config:
        from_attributes = True


class ChapterEditsByUserResponse(BaseModel):
    """Response grouped by author."""
    author_id: UUID
    author: UserResponse | None = None
    edit_count: int
    total_char_delta: int
    total_word_delta: int
    edits: list[ChapterEditResponse]
    
    class Config:
        from_attributes = True
