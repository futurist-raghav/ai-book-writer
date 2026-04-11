"""
Section Approval Schemas
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserResponse


class SectionApprovalCreate(BaseModel):
    """Mark section as ready for review."""
    section_number: int
    content_snapshot: str | None = None


class SectionApprovalReview(BaseModel):
    """Review a section (approve or request changes)."""
    status: str  # approved or changes_requested
    review_notes: str | None = None


class SectionApprovalResponse(BaseModel):
    """Response for section approval status."""
    id: UUID
    chapter_id: UUID
    section_number: int
    
    status: str
    locked: bool
    
    marked_ready_by: UUID | None = None
    marked_by_user: UserResponse | None = None
    marked_ready_at: datetime | None = None
    
    reviewed_by: UUID | None = None
    reviewed_by_user: UserResponse | None = None
    reviewed_at: datetime | None = None
    
    review_notes: str | None = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChapterApprovalStatusResponse(BaseModel):
    """Overall approval status for a chapter."""
    chapter_id: UUID
    total_sections: int
    approved_count: int
    ready_for_review_count: int
    changes_requested_count: int
    draft_count: int
    sections: list[SectionApprovalResponse]
    
    class Config:
        from_attributes = True


class BatchApprovalAction(BaseModel):
    """Batch approve or request changes on multiple sections."""
    section_numbers: list[int]
    action: str  # approve or request_changes
    review_notes: str | None = None
