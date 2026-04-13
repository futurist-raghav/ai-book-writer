"""
Text Suggestion API Routes - MINIMAL VERSION

This is a minimal working version while schema issues are debugged.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status, Path, Body, Depends
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.models.chapter import Chapter
from app.models.suggestion import ChapterSuggestion
from app.models.user import User
from app.schemas.suggestion import (
    SuggestionCreate,
    SuggestionResponse,
    SuggestionResolution,
    ChapterSuggestionsResponse,
)

router = APIRouter(tags=["suggestions"])


@router.get("/chapters/{chapter_id}/suggestions", response_model=ChapterSuggestionsResponse)
async def get_chapter_suggestions(
    chapter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get text suggestions for a chapter."""
    # Verify chapter exists
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Return empty suggestions for now
    return ChapterSuggestionsResponse(
        chapter_id=str(chapter_id),
        total_suggestions=0,
        pending_count=0,
        accepted_count=0,
        rejected_count=0,
        suggestions=[],
    )


@router.post("/chapters/{chapter_id}/suggestions", response_model=SuggestionResponse)
async def create_suggestion(
    chapter_id: uuid.UUID,
    suggestion: SuggestionCreate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new suggestion for a chapter."""
    # Minimal implementation - just return a placeholder
    raise HTTPException(status_code=501, detail="Suggestions creation temporarily disabled")
