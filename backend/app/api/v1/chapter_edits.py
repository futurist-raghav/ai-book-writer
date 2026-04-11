"""
Chapter Edit History Endpoints

Track and view edit history with author attribution.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AsyncSessionDep, get_current_user
from app.models.chapter import Chapter
from app.models.chapter_edit import ChapterEdit
from app.models.user import User
from app.schemas.chapter_edit import (
    ChapterEditCreate,
    ChapterEditResponse,
    ChapterEditHistoryResponse,
    ChapterEditsByUserResponse,
)


router = APIRouter(prefix="/books/{book_id}/chapters/{chapter_id}", tags=["Chapter Edit History"])


@router.post("/edits", response_model=ChapterEditResponse)
async def record_chapter_edit(
    book_id: UUID,
    chapter_id: UUID,
    edit: ChapterEditCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Record a new edit to a chapter.
    
    Automatically tracks character and word counts for the diff.
    """
    # Verify chapter exists in this book
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    chapter = chapter_result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Count characters and words
    def count_words(text: str) -> int:
        return len(text.split()) if text else 0
    
    char_before = len(edit.content_before or "")
    char_after = len(edit.content_after)
    word_before = count_words(edit.content_before or "")
    word_after = count_words(edit.content_after)
    
    # Create edit record
    chapter_edit = ChapterEdit(
        chapter_id=chapter_id,
        author_id=current_user.id,
        content_before=edit.content_before,
        content_after=edit.content_after,
        char_count_before=char_before,
        char_count_after=char_after,
        word_count_before=word_before,
        word_count_after=word_after,
        edit_type=edit.edit_type,
        change_description=edit.change_description,
    )
    
    session.add(chapter_edit)
    await session.commit()
    await session.refresh(chapter_edit)
    
    return chapter_edit


@router.get("/edit-history", response_model=ChapterEditHistoryResponse)
async def get_chapter_edit_history(
    book_id: UUID,
    chapter_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get complete edit history for a chapter.
    
    Returns all edits in reverse chronological order.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get all edits
    edits_result = await session.execute(
        select(ChapterEdit)
        .where(ChapterEdit.chapter_id == chapter_id)
        .order_by(desc(ChapterEdit.created_at))
        .offset(skip)
        .limit(limit)
    )
    edits = edits_result.scalars().all()
    
    # Load authors
    author_ids = {edit.author_id for edit in edits}
    if author_ids:
        authors_result = await session.execute(
            select(User).where(User.id.in_(author_ids))
        )
        authors_map = {user.id: user for user in authors_result.scalars()}
        for edit in edits:
            edit.author = authors_map.get(edit.author_id)
    
    # Get total count
    count_result = await session.execute(
        select(func.count(ChapterEdit.id)).where(ChapterEdit.chapter_id == chapter_id)
    )
    total = count_result.scalar() or 0
    
    return ChapterEditHistoryResponse(
        chapter_id=chapter_id,
        total_edits=total,
        editors=list(author_ids),
        edits=[ChapterEditResponse.from_attributes(edit) for edit in edits],
    )


@router.get("/edit-history/by-user/{user_id}", response_model=ChapterEditsByUserResponse)
async def get_chapter_edits_by_user(
    book_id: UUID,
    chapter_id: UUID,
    user_id: UUID,
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get all edits made by a specific user to this chapter.
    
    Useful for tracking individual contributor's changes.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get user
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    # Get edits by user
    edits_result = await session.execute(
        select(ChapterEdit)
        .where(ChapterEdit.chapter_id == chapter_id, ChapterEdit.author_id == user_id)
        .order_by(desc(ChapterEdit.created_at))
    )
    edits = edits_result.scalars().all()
    
    # Calculate totals
    total_char_delta = sum(edit.char_delta for edit in edits)
    total_word_delta = sum(edit.word_delta for edit in edits)
    
    return ChapterEditsByUserResponse(
        author_id=user_id,
        author=user,
        edit_count=len(edits),
        total_char_delta=total_char_delta,
        total_word_delta=total_word_delta,
        edits=[ChapterEditResponse.from_attributes(edit) for edit in edits],
    )


@router.post("/edits/{edit_id}/rollback", response_model=dict)
async def rollback_to_edit(
    book_id: UUID,
    chapter_id: UUID,
    edit_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Rollback chapter content to a specific previous edit.
    
    Creates a new edit record documenting the rollback.
    """
    # Verify chapter exists
    chapter_result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    chapter = chapter_result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get the target edit
    target_edit_result = await session.execute(
        select(ChapterEdit).where(
            ChapterEdit.id == edit_id,
            ChapterEdit.chapter_id == chapter_id,
        )
    )
    target_edit = target_edit_result.scalar_one_or_none()
    if not target_edit:
        raise HTTPException(status_code=404, detail="Edit version not found")
    
    # Get current content
    current_content = chapter.content
    rollback_content = target_edit.content_after
    
    # Create rollback edit record
    rollback_edit = ChapterEdit(
        chapter_id=chapter_id,
        author_id=current_user.id,
        content_before=current_content,
        content_after=rollback_content,
        char_count_before=len(current_content or ""),
        char_count_after=len(rollback_content or ""),
        word_count_before=len((current_content or "").split()),
        word_count_after=len((rollback_content or "").split()),
        edit_type="rollback",
        change_description=f"Rolled back to version from {target_edit.author.email}",
    )
    
    # Update chapter content
    chapter.content = rollback_content
    
    session.add(rollback_edit)
    await session.commit()
    
    return {
        "success": True,
        "message": f"Rolled back to edit {edit_id}",
        "chapter_id": str(chapter_id),
        "content_length": len(rollback_content),
    }
