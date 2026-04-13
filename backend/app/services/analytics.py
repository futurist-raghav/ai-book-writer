"""
Analytics service for computing writing metrics and insights.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Book, Chapter, ChapterVersion
import json


class AnalyticsService:
    """Compute writing analytics for books and projects."""

    @staticmethod
    async def get_writing_velocity(
        session: AsyncSession,
        book_id: str,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Calculate writing velocity (words per day) for a book over N days.
        Returns daily breakdown and trend.
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get all versions created in the date range
        query = (
            session.query(
                func.date(ChapterVersion.created_at).label("date"),
                func.sum(ChapterVersion.word_count).label("total_words"),
                func.count(ChapterVersion.id).label("edit_count"),
            )
            .join(Chapter)
            .filter(
                and_(
                    Chapter.book_id == book_id,
                    ChapterVersion.created_at >= start_date,
                    ChapterVersion.created_at <= end_date,
                )
            )
            .group_by(func.date(ChapterVersion.created_at))
            .order_by(func.date(ChapterVersion.created_at))
        )

        result = await session.execute(query)
        rows = result.all()

        # Build daily breakdown
        daily_data = []
        total_words = 0
        for row in rows:
            date, words, edits = row
            total_words += words or 0
            daily_data.append({
                "date": date.isoformat() if date else None,
                "words_written": words or 0,
                "edits": edits or 0,
            })

        # Calculate average
        avg_words_per_day = total_words / days if days > 0 else 0

        return {
            "period_days": days,
            "total_words": total_words,
            "avg_words_per_day": round(avg_words_per_day, 2),
            "daily_breakdown": daily_data,
        }

    @staticmethod
    async def get_productivity_metrics(
        session: AsyncSession,
        book_id: str,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Calculate productivity metrics: days written, sessions/week, consistency.
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Count unique days with writes
        query = (
            session.query(func.count(func.distinct(func.date(ChapterVersion.created_at))))
            .join(Chapter)
            .filter(
                and_(
                    Chapter.book_id == book_id,
                    ChapterVersion.created_at >= start_date,
                    ChapterVersion.created_at <= end_date,
                )
            )
        )

        result = await session.execute(query)
        days_written = result.scalar() or 0

        # Calculate sessions per week (approximate as days written / weeks)
        weeks = max(1, days // 7)
        sessions_per_week = days_written / weeks if weeks > 0 else 0

        # Consistency score (0-100): how many days they actually wrote
        consistency_score = round((days_written / days) * 100, 1) if days > 0 else 0

        return {
            "period_days": days,
            "days_written": days_written,
            "sessions_per_week": round(sessions_per_week, 2),
            "consistency_score": consistency_score,
        }

    @staticmethod
    async def get_pacing_analysis(
        session: AsyncSession,
        book_id: str,
    ) -> Dict[str, Any]:
        """
        Analyze pacing: current progress vs targets, estimated completion.
        """
        # Get book
        query = session.query(Book).filter(Book.id == book_id)
        result = await session.execute(query)
        book = result.scalar()

        if not book:
            return {"error": "Book not found"}

        # Get total word count from all chapters
        query = session.query(func.sum(Chapter.word_count)).filter(
            Chapter.book_id == book_id
        )
        result = await session.execute(query)
        total_words = result.scalar() or 0

        # Get word count target if set
        word_count_goal = book.metadata.get("word_count_goal", 0) if book.metadata else 0
        progress_percent = (
            (total_words / word_count_goal * 100) if word_count_goal > 0 else 0
        )

        # Estimate completion time based on 30-day velocity
        vel_result = await AnalyticsService.get_writing_velocity(
            session, book_id, days=30
        )
        avg_velocity = vel_result.get("avg_words_per_day", 0)

        if avg_velocity > 0 and word_count_goal > 0:
            words_remaining = max(0, word_count_goal - total_words)
            days_to_completion = words_remaining / avg_velocity
            estimated_completion = datetime.utcnow() + timedelta(days=days_to_completion)
        else:
            days_to_completion = None
            estimated_completion = None

        return {
            "current_word_count": total_words,
            "word_count_goal": word_count_goal,
            "progress_percent": round(progress_percent, 1),
            "words_remaining": max(0, word_count_goal - total_words),
            "estimated_days_to_completion": (
                round(days_to_completion, 1) if days_to_completion else None
            ),
            "estimated_completion_date": (
                estimated_completion.isoformat() if estimated_completion else None
            ),
        }

    @staticmethod
    async def get_chapter_breakdown(
        session: AsyncSession,
        book_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Get word count breakdown by chapter.
        """
        query = (
            session.query(Chapter)
            .filter(Chapter.book_id == book_id)
            .order_by(Chapter.order_index)
        )
        result = await session.execute(query)
        chapters = result.scalars().all()

        breakdown = []
        for chapter in chapters:
            breakdown.append({
                "chapter_id": chapter.id,
                "chapter_number": chapter.order_index,
                "title": chapter.title,
                "word_count": chapter.word_count or 0,
                "type": chapter.chapter_type,
                "status": chapter.workflow_status,
            })

        return breakdown

    @staticmethod
    async def get_full_analytics(
        session: AsyncSession,
        book_id: str,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Get comprehensive analytics dashboard for a book.
        """
        velocity = await AnalyticsService.get_writing_velocity(session, book_id, days)
        productivity = await AnalyticsService.get_productivity_metrics(
            session, book_id, days
        )
        pacing = await AnalyticsService.get_pacing_analysis(session, book_id)
        breakdown = await AnalyticsService.get_chapter_breakdown(session, book_id)

        return {
            "book_id": book_id,
            "period_days": days,
            "generated_at": datetime.utcnow().isoformat(),
            "velocity": velocity,
            "productivity": productivity,
            "pacing": pacing,
            "chapter_breakdown": breakdown,
        }
