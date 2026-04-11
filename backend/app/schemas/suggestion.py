"""
Text Suggestion Schemas

Request/response models for Track Changes suggestions.
"""

from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field


class ChangeType(str, Enum):
    """Type of text change suggested."""
    edit = "edit"
    insert = "insert"
    delete = "delete"


class SuggestionCreate(BaseModel):
    """Create a new text suggestion."""
    original_position: int = Field(..., ge=0, description="Position in chapter text where change starts")
    original_text: str = Field(..., description="Original text being replaced")
    suggested_text: str = Field(..., description="Suggested replacement text")
    context_before: Optional[str] = Field(None, description="Text before change for UI context")
    context_after: Optional[str] = Field(None, description="Text after change for UI context")
    change_type: ChangeType = Field(default=ChangeType.edit, description="Type of change")
    confidence_score: Optional[int] = Field(None, ge=0, le=100, description="AI confidence if auto-generated")
    reason: Optional[str] = Field(None, description="Why this suggestion was made")


class SuggestionResponse(BaseModel):
    """Text suggestion detail."""
    id: str
    chapter_id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str]
    
    original_position: int
    original_text: str
    suggested_text: str
    context_before: Optional[str]
    context_after: Optional[str]
    
    change_type: ChangeType
    confidence_score: int
    reason: Optional[str]
    
    is_accepted: bool
    is_rejected: bool
    resolved_by: Optional[str]
    resolved_by_name: Optional[str]
    resolved_at: Optional[datetime]
    
    created_at: datetime
    updated_at: datetime


class SuggestionResolution(BaseModel):
    """Accept or reject a suggestion."""
    action: str = Field(..., description="'accept' or 'reject'")
    reason: Optional[str] = Field(None, description="Optional reason for resolution")


class ChapterSuggestionsResponse(BaseModel):
    """All suggestions for a chapter."""
    chapter_id: str
    total_suggestions: int
    pending_count: int
    accepted_count: int
    rejected_count: int
    suggestions: List[SuggestionResponse] = []
