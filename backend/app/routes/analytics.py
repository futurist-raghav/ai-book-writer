from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from app.db.database import get_session
from app.models.book import Book
from app.models.public_share import PublicShare, BookFeedback
from app.middleware.auth import verify_auth

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/global")
async def get_global_analytics(
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get global analytics for all user's books"""
    # Get user's books
    result = await session.execute(
        select(Book).where(Book.user_id == current_user.id)
    )
    books = result.scalars().all()
    book_ids = [b.id for b in books]

    # Get public shares for user's books
    result = await session.execute(
        select(PublicShare).where(PublicShare.book_id.in_(book_ids))
    )
    shares = result.scalars().all()
    share_ids = [s.id for s in shares]

    # Aggregate stats
    total_comments = 0
    total_positive = 0
    total_neutral = 0
    total_negative = 0
    
    if share_ids:
        result = await session.execute(
            select(BookFeedback).where(BookFeedback.share_id.in_(share_ids))
        )
        feedback = result.scalars().all()
        total_comments = len(feedback)
        
        # Sentiment analysis (simplified)
        for fb in feedback:
            if fb.content:
                text = fb.content.lower()
                if any(word in text for word in ['great', 'excellent', 'loved', 'amazing', 'wonderful']):
                    total_positive += 1
                elif any(word in text for word in ['bad', 'poor', 'hate', 'terrible']):
                    total_negative += 1
                else:
                    total_neutral += 1

    # Get top books
    top_books = []
    for book in books:
        # Count views/comments per book
        result = await session.execute(
            select(PublicShare).where(PublicShare.book_id == book.id)
        )
        book_shares = result.scalars().all()
        
        book_comments = 0
        book_ratings = 0
        total_rating = 0
        
        for share in book_shares:
            result = await session.execute(
                select(BookFeedback).where(BookFeedback.share_id == share.id)
            )
            share_feedback = result.scalars().all()
            book_comments += len([f for f in share_feedback if f.content])
            rated_feedback = [f for f in share_feedback if f.rating is not None]
            book_ratings = len(rated_feedback)
            total_rating = sum(f.rating for f in rated_feedback) if rated_feedback else 0
        
        avg_rating = total_rating / book_ratings if book_ratings > 0 else 0
        
        top_books.append({
            "id": book.id,
            "title": book.title,
            "views": len(book_shares) * 10,  # Placeholder calculation
            "comments": book_comments,
            "rating": avg_rating,
        })

    # Sort by views descending and take top 10
    top_books.sort(key=lambda x: x["views"], reverse=True)
    top_books = top_books[:10]

    # Generate trends (last 30 days)
    trends = []
    for i in range(30):
        date = (datetime.utcnow() - timedelta(days=30-i)).date()
        trends.append({
            "date": date.isoformat(),
            "views": (i + 1) * 5,  # Placeholder
            "comments": (i + 1) * 2,  # Placeholder
            "ratings": (i + 1),  # Placeholder
        })

    return {
        "overview": {
            "total_books": len(books),
            "total_shares": len(shares),
            "total_views": len(shares) * 50,  # Placeholder
            "total_comments": total_comments,
            "average_rating": sum(b["rating"] for b in top_books) / len(top_books) if top_books else 0,
        },
        "trends": trends,
        "top_books": top_books,
        "sentiment": {
            "positive": total_positive,
            "neutral": total_neutral,
            "negative": total_negative,
        },
    }

@router.get("/global/export")
async def export_global_analytics(
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Export global analytics as CSV"""
    from io import StringIO
    import csv
    
    # Get analytics data
    result = await session.execute(
        select(Book).where(Book.user_id == current_user.id)
    )
    books = result.scalars().all()
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Book Title', 'Public Shares', 'Comments', 'Average Rating', 'Date Exported'])
    
    for book in books:
        result = await session.execute(
            select(PublicShare).where(PublicShare.book_id == book.id)
        )
        shares = result.scalars().all()
        
        total_comments = 0
        total_rating = 0
        count = 0
        
        for share in shares:
            result = await session.execute(
                select(BookFeedback).where(BookFeedback.share_id == share.id)
            )
            feedback = result.scalars().all()
            total_comments += len(feedback)
            
            for fb in feedback:
                if fb.rating:
                    total_rating += fb.rating
                    count += 1
        
        avg_rating = total_rating / count if count > 0 else 0
        writer.writerow([
            book.title,
            len(shares),
            total_comments,
            f"{avg_rating:.1f}",
            datetime.utcnow().isoformat(),
        ])
    
    return output.getvalue()
