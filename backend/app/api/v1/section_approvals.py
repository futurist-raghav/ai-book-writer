"""
Section Approval Workflow Endpoints

Mark sections ready for review, approve/request changes.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib

from app.core.dependencies import AsyncSessionDep, get_current_user
from app.models.chapter import Chapter
from app.models.section_approval import SectionApproval
from app.models.user import User
from app.schemas.section_approval import (
    SectionApprovalCreate,
    SectionApprovalReview,
    SectionApprovalResponse,
    ChapterApprovalStatusResponse,
    BatchApprovalAction,
)


router = APIRouter(prefix="/books/{book_id}/chapters/{chapter_id}", tags=["Section Approval"])


def hash_content(content: str) -> str:
    """Generate hash of content for change detection."""
    return hashlib.sha256(content.encode()).hexdigest()


@router.post("/sections/{section_number}/mark-ready", response_model=SectionApprovalResponse)
async def mark_section_ready_for_review(
    book_id: UUID,
    chapter_id: UUID,
    section_number: int,
    body: SectionApprovalCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Mark a section as ready for review.
    
    Creates or updates approval record, takes content snapshot.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    chapter = chapter_result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Check if approval record exists
    approval_result = await session.execute(
        select(SectionApproval).where(
            SectionApproval.chapter_id == chapter_id,
            SectionApproval.section_number == section_number,
        )
    )
    approval = approval_result.scalar_one_or_none()
    
    content_snapshot = body.content_snapshot or ""
    
    if approval:
        # Update existing
        approval.status = "ready_for_review"
        approval.marked_ready_by = current_user.id
        approval.marked_ready_at = func.now()
        approval.content_snapshot = content_snapshot
        approval.content_hash = hash_content(content_snapshot)
        approval.locked = False
    else:
        # Create new
        approval = SectionApproval(
            chapter_id=chapter_id,
            section_number=section_number,
            status="ready_for_review",
            marked_ready_by=current_user.id,
            content_snapshot=content_snapshot,
            content_hash=hash_content(content_snapshot),
        )
        session.add(approval)
    
    await session.commit()
    await session.refresh(approval)
    
    return approval


@router.post("/sections/{section_number}/review", response_model=SectionApprovalResponse)
async def review_section(
    book_id: UUID,
    chapter_id: UUID,
    section_number: int,
    review: SectionApprovalReview,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Review a section: approve or request changes.
    
    Approved sections can be locked to prevent editing.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get or create approval record
    approval_result = await session.execute(
        select(SectionApproval).where(
            SectionApproval.chapter_id == chapter_id,
            SectionApproval.section_number == section_number,
        )
    )
    approval = approval_result.scalar_one_or_none()
    
    if not approval:
        raise HTTPException(status_code=404, detail="Section not found in approval system")
    
    # Update review
    approval.status = review.status  # approved or changes_requested
    approval.reviewed_by = current_user.id
    approval.reviewed_at = func.now()
    approval.review_notes = review.review_notes
    approval.locked = (review.status == "approved")
    
    await session.commit()
    await session.refresh(approval)
    
    return approval


@router.post("/sections/batch-review", response_model=list[SectionApprovalResponse])
async def batch_review_sections(
    book_id: UUID,
    chapter_id: UUID,
    batch: BatchApprovalAction,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Approve or request changes on multiple sections at once.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get all approval records for these sections
    approvals_result = await session.execute(
        select(SectionApproval).where(
            SectionApproval.chapter_id == chapter_id,
            SectionApproval.section_number.in_(batch.section_numbers),
        )
    )
    approvals = approvals_result.scalars().all()
    
    # Update all
    for approval in approvals:
        approval.status = "approved" if batch.action == "approve" else "changes_requested"
        approval.reviewed_by = current_user.id
        approval.reviewed_at = func.now()
        approval.review_notes = batch.review_notes
        approval.locked = (batch.action == "approve")
    
    await session.commit()
    
    return approvals


@router.get("/approval-status", response_model=ChapterApprovalStatusResponse)
async def get_chapter_approval_status(
    book_id: UUID,
    chapter_id: UUID,
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get overall approval status for the chapter.
    
    Shows counts and details for each section.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    chapter = chapter_result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get all approvals
    approvals_result = await session.execute(
        select(SectionApproval)
        .where(SectionApproval.chapter_id == chapter_id)
        .order_by(SectionApproval.section_number)
    )
    approvals = approvals_result.scalars().all()
    
    # Count by status
    approved = len([a for a in approvals if a.status == "approved"])
    ready = len([a for a in approvals if a.status == "ready_for_review"])
    changes = len([a for a in approvals if a.status == "changes_requested"])
    draft = len([a for a in approvals if a.status == "draft"])
    
    # Estimate total sections from content (rough word count / avg words per section)
    content = chapter.content or ""
    word_count = len(content.split())
    avg_words_per_section = 200
    total_sections = max(len(approvals), (word_count // avg_words_per_section) or 1)
    
    return ChapterApprovalStatusResponse(
        chapter_id=chapter_id,
        total_sections=total_sections,
        approved_count=approved,
        ready_for_review_count=ready,
        changes_requested_count=changes,
        draft_count=draft,
        sections=[SectionApprovalResponse.from_attributes(a) for a in approvals],
    )


@router.delete("/sections/{section_number}/approval")
async def clear_section_approval(
    book_id: UUID,
    chapter_id: UUID,
    section_number: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Clear approval status from a section.
    Allows editing of previously approved sections.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Delete approval record
    approval_result = await session.execute(
        select(SectionApproval).where(
            SectionApproval.chapter_id == chapter_id,
            SectionApproval.section_number == section_number,
        )
    )
    approval = approval_result.scalar_one_or_none()
    
    if approval:
        await session.delete(approval)
        await session.commit()
    
    return {"success": True, "message": f"Cleared approval for section {section_number}"}
