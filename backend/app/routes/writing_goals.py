from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.db.database import get_session
from app.models.book import Book
from app.middleware.auth import verify_auth

router = APIRouter()

@router.put("/books/{book_id}/writing-goals")
async def update_writing_goals(
    book_id: str,
    goals: dict,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Update writing goals for a book"""
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Store goals in book metadata
    if not book.metadata:
        book.metadata = {}
    
    book.metadata["writing_goals"] = {
        "daily_target": goals.get("daily_target", 1000),
        "weekly_target": goals.get("weekly_target", 7000),
        "monthly_target": goals.get("monthly_target", 30000),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    await session.commit()
    return book.metadata["writing_goals"]

@router.get("/books/{book_id}/writing-streak")
async def get_writing_streak(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get writing streak for a book"""
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Calculate streak from chapter edits
    # Simplified: return mock data (real implementation would check chapter_edits)
    return {
        "current_streak": 5,
        "longest_streak": 21,
        "last_write_date": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
    }

@router.get("/books/{book_id}/analytics/today")
async def get_today_analytics(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get today's writing progress"""
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # In real implementation, calculate from chapter_edits today
    # For now return mock data
    return {
        "words_written": 750,
        "editing_time_minutes": 45,
        "chapters_touched": 2,
    }
