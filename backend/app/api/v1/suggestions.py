"""
Text Suggestion API Routes

Handles Track Changes style suggestions with accept/reject workflow.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.chapter import Chapter
from app.models.suggestion import TextSuggestion
from app.models.user import User
from app.schemas.suggestion import (
    SuggestionCreate,
    SuggestionResponse,
    SuggestionResolution,
    ChapterSuggestionsResponse,
)

router = APIRouter(prefix="/api/v1", tags=["suggestions"])


async def _build_suggestion_response(suggestion: TextSuggestion, db) -> SuggestionResponse:
    """Build a suggestion response with author details."""
    author_result = await db.execute(
        select(User).where(User.id == suggestion.author_id)
    )
    author = author_result.scalar_one_or_none()
    
    resolver = None
    resolver_name = None
    if suggestion.resolved_by:
        resolver_result = await db.execute(
            select(User).where(User.id == suggestion.resolved_by)
        )
        resolver = resolver_result.scalar_one_or_none()
        resolver_name = resolver.full_name if resolver else None
    
    return SuggestionResponse(
        id=str(suggestion.id),
        chapter_id=str(suggestion.chapter_id),
        author_id=str(suggestion.author_id),
        author_name=author.full_name if author else "Unknown",
        author_avatar=author.avatar_url if author else None,
        original_position=suggestion.original_position,
        original_text=suggestion.original_text,
        suggested_text=suggestion.suggested_text,
        context_before=suggestion.context_before,
        context_after=suggestion.context_after,
        change_type=suggestion.change_type,
        confidence_score=suggestion.confidence_score,
        reason=suggestion.reason,
        is_accepted=suggestion.is_accepted,
        is_rejected=suggestion.is_rejected,
        resolved_by=str(suggestion.resolved_by) if suggestion.resolved_by else None,
        resolved_by_name=resolver_name,
        resolved_at=suggestion.resolved_at,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )


@router.post("/chapters/{chapter_id}/suggestions", response_model=SuggestionResponse)
async def create_suggestion(
    chapter_id: uuid.UUID,
    request: SuggestionCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a text suggestion (Track Changes).
    
    Can be:
    - Manual suggestion from collaborator
    - AI-generated suggestion (e.g., grammar, tone improvement)
    """
    # Verify chapter exists
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Create suggestion
    suggestion = TextSuggestion(
        id=uuid.uuid4(),
        chapter_id=chapter_id,
        author_id=user_id,
        original_position=request.original_position,
        original_text=request.original_text,
        suggested_text=request.suggested_text,
        context_before=request.context_before,
        context_after=request.context_after,
        change_type=request.change_type,
        confidence_score=request.confidence_score or 100,
        reason=request.reason,
    )

    db.add(suggestion)
    await db.flush()

    return await _build_suggestion_response(suggestion, db)


@router.get("/chapters/{chapter_id}/suggestions", response_model=ChapterSuggestionsResponse)
async def get_chapter_suggestions(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    status_filter: str = Query("pending", description="pending, accepted, rejected, or all"),
):
    """
    Get text suggestions for a chapter.
    
    Can filter by status (pending, accepted, rejected, all).
    """
    # Verify chapter exists
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Build query
    query = select(TextSuggestion).where(TextSuggestion.chapter_id == chapter_id)
    
    if status_filter == "pending":
        query = query.where(
            and_(
                TextSuggestion.is_accepted == False,
                TextSuggestion.is_rejected == False,
            )
        )
    elif status_filter == "accepted":
        query = query.where(TextSuggestion.is_accepted == True)
    elif status_filter == "rejected":
        query = query.where(TextSuggestion.is_rejected == True)
    
    query = query.order_by(TextSuggestion.created_at.asc())
    
    suggestions_result = await db.execute(query)
    suggestions = suggestions_result.scalars().all()

    # Get counts
    all_result = await db.execute(
        select(func.count(TextSuggestion.id)).where(TextSuggestion.chapter_id == chapter_id)
    )
    total = all_result.scalar() or 0
    
    pending_result = await db.execute(
        select(func.count(TextSuggestion.id)).where(
            and_(
                TextSuggestion.chapter_id == chapter_id,
                TextSuggestion.is_accepted == False,
                TextSuggestion.is_rejected == False,
            )
        )
    )
    pending = pending_result.scalar() or 0
    
    accepted_result = await db.execute(
        select(func.count(TextSuggestion.id)).where(
            and_(
                TextSuggestion.chapter_id == chapter_id,
                TextSuggestion.is_accepted == True,
            )
        )
    )
    accepted = accepted_result.scalar() or 0
    
    rejected_result = await db.execute(
        select(func.count(TextSuggestion.id)).where(
            and_(
                TextSuggestion.chapter_id == chapter_id,
                TextSuggestion.is_rejected == True,
            )
        )
    )
    rejected = rejected_result.scalar() or 0

    # Build responses
    suggestion_responses = []
    for suggestion in suggestions:
        suggestion_responses.append(await _build_suggestion_response(suggestion, db))

    return ChapterSuggestionsResponse(
        chapter_id=str(chapter_id),
        total_suggestions=total,
        pending_count=pending,
        accepted_count=accepted,
        rejected_count=rejected,
        suggestions=suggestion_responses,
    )


@router.patch("/chapters/{chapter_id}/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def resolve_suggestion(
    chapter_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    request: SuggestionResolution,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Accept or reject a text suggestion.
    
    If accepted, the suggested text is applied to chapter content.
    If rejected, no changes are made to chapter.
    """
    suggestion_result = await db.execute(
        select(TextSuggestion).where(TextSuggestion.id == suggestion_id)
    )
    suggestion = suggestion_result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found",
        )

    # Verify chapter matches
    if suggestion.chapter_id != chapter_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suggestion does not belong to this chapter",
        )

    # Resolve suggestion
    if request.action.lower() == "accept":
        suggestion.is_accepted = True
        suggestion.is_rejected = False
        # NOTE: Actual text replacement happens in frontend
        # Backend just tracks the acceptance
    elif request.action.lower() == "reject":
        suggestion.is_accepted = False
        suggestion.is_rejected = True
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be 'accept' or 'reject'",
        )

    suggestion.resolved_by = user_id
    suggestion.resolved_at = datetime.now(timezone.utc)
    await db.flush()

    return await _build_suggestion_response(suggestion, db)


@router.post("/chapters/{chapter_id}/suggestions/batch-resolve")
async def batch_resolve_suggestions(
    chapter_id: uuid.UUID,
    request: dict,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Accept or reject multiple suggestions at once.
    
    Request body:
    {
        "action": "accept" or "reject",
        "suggestion_ids": ["id1", "id2", ...]
    }
    """
    action = request.get("action", "").lower()
    suggestion_ids = request.get("suggestion_ids", [])
    
    if action not in ["accept", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be 'accept' or 'reject'",
        )
    
    if not suggestion_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="suggestion_ids must not be empty",
        )

    # Fetch all suggestions
    query = select(TextSuggestion).where(
        and_(
            TextSuggestion.chapter_id == chapter_id,
            TextSuggestion.id.in_([uuid.UUID(sid) for sid in suggestion_ids]),
        )
    )
    result = await db.execute(query)
    suggestions = result.scalars().all()

    # Update all suggestions
    now = datetime.now(timezone.utc)
    for suggestion in suggestions:
        if action == "accept":
            suggestion.is_accepted = True
            suggestion.is_rejected = False
        else:
            suggestion.is_accepted = False
            suggestion.is_rejected = True
        
        suggestion.resolved_by = user_id
        suggestion.resolved_at = now

    await db.flush()

    return {
        "message": f"{len(suggestions)} suggestions {action}ed",
        "count": len(suggestions),
    }


@router.delete("/chapters/{chapter_id}/suggestions/{suggestion_id}")
async def delete_suggestion(
    chapter_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete a text suggestion (only pending suggestions can be deleted).
    """
    suggestion_result = await db.execute(
        select(TextSuggestion).where(TextSuggestion.id == suggestion_id)
    )
    suggestion = suggestion_result.scalar_one_or_none()

    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found",
        )

    # Only pending suggestions can be deleted
    if suggestion.is_accepted or suggestion.is_rejected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending suggestions can be deleted",
        )

    await db.delete(suggestion)
    await db.flush()

    return {"message": "Suggestion deleted"}

router = APIRouter(
    prefix="/chapters/{chapter_id}/suggestions",
    tags=["Suggestions"],
)


@router.post("", response_model=SuggestionResponse)
async def create_suggestion(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion: SuggestionCreate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new suggestion for a chapter.
    
    **Request Body:**
    - `suggestion_type`: Type of suggestion (rewrite, expand, shorten, rephrase, tone, grammar)
    - `text_before`: Original text being suggested
    - `text_after`: Suggested replacement text
    - `position`: Position in chapter (start index)
    - `length`: Length of original text
    - `reason`: Why this suggestion is made (optional)
    
    **Returns:** Created suggestion with ID, status, and metadata
    """
    # Verify chapter exists and user has access
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Verify user has write access to chapter's book
    if chapter.book_id and str(chapter.book.id) != str(current_user.id):
        # Check collaboration permissions
        is_collaborator = any(
            c.id == current_user.id for c in chapter.book.collaborators
        )
        if not is_collaborator and chapter.book.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="No access to this chapter")
    
    # Create suggestion
    new_suggestion = ChapterSuggestion(
        chapter_id=chapter_id,
        author_id=current_user.id,
        suggestion_type=suggestion.suggestion_type,
        text_before=suggestion.text_before,
        text_after=suggestion.text_after,
        position=suggestion.position,
        length=suggestion.length,
        reason=suggestion.reason or "",
        status="pending",
        created_at=datetime.utcnow(),
    )
    
    db.add(new_suggestion)
    await db.commit()
    await db.refresh(new_suggestion, ["author"])
    
    return new_suggestion


@router.get("", response_model=SuggestionListResponse)
async def list_suggestions(
    chapter_id: str = Path(..., description="Chapter ID"),
    status: Optional[str] = Query(None, description="Filter by status (pending/accepted/rejected)"),
    author_id: Optional[str] = Query(None, description="Filter by author"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List suggestions for a chapter with optional filtering.
    
    **Query Parameters:**
    - `status`: Filter by pending/accepted/rejected (optional)
    - `author_id`: Filter by suggestion author (optional)
    - `skip`: Pagination offset (default: 0)
    - `limit`: Max results (default: 20, max: 100)
    
    **Returns:** Paginated list of suggestions with author info and metadata
    """
    # Verify chapter exists
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Build query with filters
    filters = [ChapterSuggestion.chapter_id == chapter_id]
    
    if status:
        filters.append(ChapterSuggestion.status == status)
    
    if author_id:
        filters.append(ChapterSuggestion.author_id == author_id)
    
    # Count total
    count_stmt = select(Chapter).where(and_(*filters))
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Fetch paginated results
    stmt = (
        select(ChapterSuggestion)
        .where(and_(*filters))
        .options(joinedload(ChapterSuggestion.author))
        .order_by(ChapterSuggestion.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    suggestions = result.unique().scalars().all()
    
    return SuggestionListResponse(
        items=suggestions,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.put("/{suggestion_id}/accept", response_model=SuggestionResponse)
async def accept_suggestion(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion_id: str = Path(..., description="Suggestion ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a suggestion and apply it to the chapter.
    Marks suggestion as 'accepted' and updates chapter content.
    
    **URL Parameters:**
    - `chapter_id`: Chapter containing the suggestion
    - `suggestion_id`: Suggestion to accept
    
    **Returns:** Updated suggestion with accepted status and timestamp
    """
    # Fetch suggestion
    stmt = select(ChapterSuggestion).where(
        and_(
            ChapterSuggestion.id == suggestion_id,
            ChapterSuggestion.chapter_id == chapter_id,
        )
    ).options(joinedload(ChapterSuggestion.author))
    
    result = await db.execute(stmt)
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Fetch chapter
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Verify user has write access
    if chapter.book_id and chapter.book.author_id != current_user.id:
        is_collaborator = any(
            c.id == current_user.id for c in chapter.book.collaborators
        )
        if not is_collaborator:
            raise HTTPException(status_code=403, detail="No permission to accept suggestions")
    
    # Apply suggestion to chapter content (if not already applied)
    if suggestion.status == "pending":
        # Simple text replacement using position/length
        content = chapter.content or ""
        try:
            updated_content = (
                content[:suggestion.position]
                + suggestion.text_after
                + content[suggestion.position + suggestion.length:]
            )
            chapter.content = updated_content
            chapter.updated_at = datetime.utcnow()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to apply suggestion: {str(e)}"
            )
    
    # Mark suggestion as accepted
    suggestion.status = "accepted"
    suggestion.updated_at = datetime.utcnow()
    suggestion.accepted_at = datetime.utcnow()
    
    db.add(chapter)
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion, ["author"])
    
    return suggestion


@router.put("/{suggestion_id}/reject", response_model=SuggestionResponse)
async def reject_suggestion(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion_id: str = Path(..., description="Suggestion ID"),
    reason: Optional[str] = Body(None, description="Reason for rejection"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a suggestion without applying it.
    Marks suggestion as 'rejected' with optional reason.
    
    **URL Parameters:**
    - `chapter_id`: Chapter containing the suggestion
    - `suggestion_id`: Suggestion to reject
    
    **Body:**
    - `reason`: Optional reason for rejection (string)
    
    **Returns:** Updated suggestion with rejected status
    """
    # Fetch suggestion
    stmt = select(ChapterSuggestion).where(
        and_(
            ChapterSuggestion.id == suggestion_id,
            ChapterSuggestion.chapter_id == chapter_id,
        )
    ).options(joinedload(ChapterSuggestion.author))
    
    result = await db.execute(stmt)
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Fetch chapter for permission check
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Verify user has write access
    if chapter.book_id and chapter.book.author_id != current_user.id:
        is_collaborator = any(
            c.id == current_user.id for c in chapter.book.collaborators
        )
        if not is_collaborator:
            raise HTTPException(status_code=403, detail="No permission to reject suggestions")
    
    # Mark as rejected
    suggestion.status = "rejected"
    suggestion.updated_at = datetime.utcnow()
    suggestion.rejection_reason = reason or ""
    
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion, ["author"])
    
    return suggestion


@router.delete("/{suggestion_id}")
async def delete_suggestion(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion_id: str = Path(..., description="Suggestion ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a suggestion (pending only).
    Only author or chapter owner can delete.
    
    **URL Parameters:**
    - `chapter_id`: Chapter containing the suggestion
    - `suggestion_id`: Suggestion to delete
    
    **Returns:** Success message
    """
    # Fetch suggestion
    stmt = select(ChapterSuggestion).where(
        and_(
            ChapterSuggestion.id == suggestion_id,
            ChapterSuggestion.chapter_id == chapter_id,
        )
    )
    
    result = await db.execute(stmt)
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Can't delete accepted/rejected suggestions
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete {suggestion.status} suggestion"
        )
    
    # Fetch chapter for permission check
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    # Verify user is author or chapter owner
    is_author = suggestion.author_id == current_user.id
    is_owner = chapter.book.author_id == current_user.id if chapter else False
    
    if not (is_author or is_owner):
        raise HTTPException(status_code=403, detail="No permission to delete suggestion")
    
    await db.delete(suggestion)
    await db.commit()
    
    return {"status": "deleted", "message": "Suggestion deleted successfully"}


@router.post("/{suggestion_id}/batch-accept")
async def batch_accept_suggestions(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion_ids: List[str] = Body(..., description="List of suggestion IDs to accept"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept multiple suggestions at once.
    Applies all suggestions in order and marks them accepted.
    
    **URL Parameters:**
    - `chapter_id`: Chapter containing the suggestions
    
    **Body:**
    - `suggestion_ids`: Array of suggestion IDs to accept
    
    **Returns:** Details of accepted suggestions and updated chapter content
    """
    # Fetch chapter
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Verify permissions
    if chapter.book.author_id != current_user.id:
        is_collaborator = any(
            c.id == current_user.id for c in chapter.book.collaborators
        )
        if not is_collaborator:
            raise HTTPException(status_code=403, detail="No permission to accept suggestions")
    
    # Fetch all suggestions in order (by position, ascending)
    stmt = (
        select(ChapterSuggestion)
        .where(
            and_(
                ChapterSuggestion.chapter_id == chapter_id,
                ChapterSuggestion.id.in_(suggestion_ids),
                ChapterSuggestion.status == "pending",
            )
        )
        .order_by(ChapterSuggestion.position)
    )
    
    result = await db.execute(stmt)
    suggestions = result.scalars().all()
    
    if not suggestions:
        raise HTTPException(status_code=400, detail="No pending suggestions found")
    
    # Apply suggestions in order, tracking offset changes
    content = chapter.content or ""
    offset = 0
    accepted_ids = []
    
    for suggestion in suggestions:
        try:
            # Adjust position based on previous replacements
            adjusted_pos = suggestion.position + offset
            
            # Replace text
            content = (
                content[:adjusted_pos]
                + suggestion.text_after
                + content[adjusted_pos + suggestion.length:]
            )
            
            # Update offset for next suggestion
            offset += len(suggestion.text_after) - suggestion.length
            
            # Mark as accepted
            suggestion.status = "accepted"
            suggestion.updated_at = datetime.utcnow()
            suggestion.accepted_at = datetime.utcnow()
            accepted_ids.append(suggestion.id)
            
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to apply suggestion {suggestion.id}: {str(e)}"
            )
    
    # Update chapter content
    chapter.content = content
    chapter.updated_at = datetime.utcnow()
    
    db.add(chapter)
    for suggestion in suggestions:
        db.add(suggestion)
    
    await db.commit()
    
    return {
        "status": "success",
        "accepted_count": len(accepted_ids),
        "accepted_ids": accepted_ids,
        "chapter_content_updated": True,
        "message": f"Successfully accepted {len(accepted_ids)} suggestion(s)",
    }


@router.post("/{suggestion_id}/batch-reject")
async def batch_reject_suggestions(
    chapter_id: str = Path(..., description="Chapter ID"),
    suggestion_ids: List[str] = Body(..., description="List of suggestion IDs to reject"),
    reason: Optional[str] = Body(None, description="Reason for bulk rejection"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject multiple suggestions at once.
    Marks all suggestions as rejected with optional reason.
    
    **URL Parameters:**
    - `chapter_id`: Chapter containing the suggestions
    
    **Body:**
    - `suggestion_ids`: Array of suggestion IDs to reject
    - `reason`: Optional reason for rejection (applied to all)
    
    **Returns:** Count of rejected suggestions
    """
    # Fetch chapter
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Verify permissions
    if chapter.book.author_id != current_user.id:
        is_collaborator = any(
            c.id == current_user.id for c in chapter.book.collaborators
        )
        if not is_collaborator:
            raise HTTPException(status_code=403, detail="No permission to reject suggestions")
    
    # Fetch all suggestions
    stmt = select(ChapterSuggestion).where(
        and_(
            ChapterSuggestion.chapter_id == chapter_id,
            ChapterSuggestion.id.in_(suggestion_ids),
            ChapterSuggestion.status == "pending",
        )
    )
    
    result = await db.execute(stmt)
    suggestions = result.scalars().all()
    
    if not suggestions:
        raise HTTPException(status_code=400, detail="No pending suggestions found")
    
    # Mark all as rejected
    for suggestion in suggestions:
        suggestion.status = "rejected"
        suggestion.updated_at = datetime.utcnow()
        suggestion.rejection_reason = reason or ""
        db.add(suggestion)
    
    await db.commit()
    
    return {
        "status": "success",
        "rejected_count": len(suggestions),
        "message": f"Successfully rejected {len(suggestions)} suggestion(s)",
    }
