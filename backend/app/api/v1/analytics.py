"""
Analytics API endpoints for writing insights and metrics.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db as get_session, get_current_user
from app.models import User, Book
from app.services.analytics import AnalyticsService
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])


# Response Models
class DailyWritingData(BaseModel):
    date: Optional[str]
    words_written: int
    edits: int


class VelocityResponse(BaseModel):
    period_days: int
    total_words: int
    avg_words_per_day: float
    daily_breakdown: List[DailyWritingData]


class ProductivityResponse(BaseModel):
    period_days: int
    days_written: int
    sessions_per_week: float
    consistency_score: float


class PacingResponse(BaseModel):
    current_word_count: int
    word_count_goal: int
    progress_percent: float
    words_remaining: int
    estimated_days_to_completion: Optional[float]
    estimated_completion_date: Optional[str]


class ChapterBreakdownItem(BaseModel):
    chapter_id: str
    chapter_number: int
    title: str
    word_count: int
    type: str
    status: str


class FullAnalyticsResponse(BaseModel):
    book_id: str
    period_days: int
    generated_at: str
    velocity: VelocityResponse
    productivity: ProductivityResponse
    pacing: PacingResponse
    chapter_breakdown: List[ChapterBreakdownItem]


# Endpoints
@router.get("/books/{book_id}/velocity", response_model=VelocityResponse)
async def get_writing_velocity(
    book_id: str,
    days: int = 30,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> VelocityResponse:
    """
    Get writing velocity (words per day) for a book.
    
    Args:
        book_id: The book ID
        days: Number of days to analyze (default: 30)
    
    Returns:
        Velocity metrics with daily breakdown
    """
    # Verify user has access to book
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Calculate velocity
    velocity_data = await AnalyticsService.get_writing_velocity(session, book_id, days)
    return VelocityResponse(**velocity_data)


@router.get("/books/{book_id}/productivity", response_model=ProductivityResponse)
async def get_productivity_metrics(
    book_id: str,
    days: int = 30,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProductivityResponse:
    """
    Get productivity metrics (days written, sessions/week, consistency).
    """
    # Verify user has access to book
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Calculate productivity
    productivity_data = await AnalyticsService.get_productivity_metrics(
        session, book_id, days
    )
    return ProductivityResponse(**productivity_data)


@router.get("/books/{book_id}/pacing", response_model=PacingResponse)
async def get_pacing_analysis(
    book_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PacingResponse:
    """
    Get pacing analysis: progress vs goals, estimated completion.
    """
    # Verify user has access to book
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Calculate pacing
    pacing_data = await AnalyticsService.get_pacing_analysis(session, book_id)
    return PacingResponse(**pacing_data)


@router.get("/books/{book_id}/chapter-breakdown", response_model=List[ChapterBreakdownItem])
async def get_chapter_breakdown(
    book_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> List[ChapterBreakdownItem]:
    """
    Get word count breakdown by chapter.
    """
    # Verify user has access to book
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get breakdown
    breakdown_data = await AnalyticsService.get_chapter_breakdown(session, book_id)
    return [ChapterBreakdownItem(**item) for item in breakdown_data]


@router.get("/books/{book_id}/full", response_model=FullAnalyticsResponse)
async def get_full_analytics(
    book_id: str,
    days: int = 30,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FullAnalyticsResponse:
    """
    Get comprehensive analytics dashboard for a book.
    
    Args:
        book_id: The book ID
        days: Number of days to analyze (default: 30)
    
    Returns:
        Complete analytics report with velocity, productivity, pacing, and chapter breakdown
    """
    # Verify user has access to book
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get full analytics
    analytics_data = await AnalyticsService.get_full_analytics(session, book_id, days)
    return FullAnalyticsResponse(**analytics_data)
