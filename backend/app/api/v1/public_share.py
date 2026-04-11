"""
API endpoints for public sharing and feedback.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
import secrets
from datetime import datetime
from app.db import get_session
from app.auth import get_current_user
from app.models import User, Book, PublicShare, BookFeedback, BookRating
from app.schemas.public_share_schema import (
    PublicShareCreate,
    PublicShareUpdate,
    PublicShareResponse,
    BookFeedbackCreate,
    BookFeedbackResponse,
    BookRatingResponse,
    PublicShareDetailResponse,
)

router = APIRouter(prefix="/public", tags=["Public Sharing"])


@router.post("/shares", response_model=PublicShareResponse)
async def create_public_share(
    book_id: str,
    share_data: PublicShareCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a public share link for a book."""
    # Verify ownership
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Generate unique share token
    share_token = secrets.token_urlsafe(32)

    # Create share
    share = PublicShare(
        book_id=book_id,
        share_token=share_token,
        allow_comments=share_data.allow_comments,
        allow_ratings=share_data.allow_ratings,
        password=share_data.password,
        expires_at=share_data.expires_at,
    )
    session.add(share)
    await session.commit()

    return PublicShareResponse.from_orm(share)


@router.get("/shares/{book_id}", response_model=PublicShareResponse)
async def get_public_share(
    book_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get public share for a book (owner only)."""
    # Verify ownership
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get share
    query_result = await session.execute(
        session.query(PublicShare).filter(PublicShare.book_id == book_id)
    )
    share = query_result.scalar()
    if not share:
        raise HTTPException(status_code=404, detail="Public share not found")

    return PublicShareResponse.from_orm(share)


@router.patch("/shares/{book_id}", response_model=PublicShareResponse)
async def update_public_share(
    book_id: str,
    share_data: PublicShareUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update public share settings (owner only)."""
    # Verify ownership
    query_result = await session.execute(
        session.query(Book).filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
    )
    book = query_result.scalar()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get share
    query_result = await session.execute(
        session.query(PublicShare).filter(PublicShare.book_id == book_id)
    )
    share = query_result.scalar()
    if not share:
        raise HTTPException(status_code=404, detail="Public share not found")

    # Update
    share.is_active = share_data.is_active
    share.allow_comments = share_data.allow_comments
    share.allow_ratings = share_data.allow_ratings
    share.password = share_data.password
    share.expires_at = share_data.expires_at
    await session.commit()

    return PublicShareResponse.from_orm(share)


@router.post("/shares/{share_token}/feedback", response_model=BookFeedbackResponse)
async def submit_feedback(
    share_token: str,
    feedback_data: BookFeedbackCreate,
    session: AsyncSession = Depends(get_session),
):
    """Submit feedback on a public share (public endpoint)."""
    # Get share
    query_result = await session.execute(
        session.query(PublicShare).filter(PublicShare.share_token == share_token)
    )
    share = query_result.scalar()
    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Share not found or inactive")

    # Check expiration
    if share.expires_at and share.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share has expired")

    # Check feedback enabled
    if not share.allow_comments:
        raise HTTPException(
            status_code=403, detail="Comments are disabled for this share"
        )

    # Create feedback
    feedback = BookFeedback(
        share_id=share.id,
        reader_name=feedback_data.reader_name,
        reader_email=feedback_data.reader_email,
        rating=feedback_data.rating if share.allow_ratings else None,
        title=feedback_data.title,
        content=feedback_data.content,
        feedback_type=feedback_data.feedback_type,
    )
    session.add(feedback)

    # Update ratings if applicable
    if feedback_data.rating and share.allow_ratings:
        query_result = await session.execute(
            session.query(BookRating).filter(BookRating.book_id == share.book_id)
        )
        rating = query_result.scalar()
        if not rating:
            rating = BookRating(book_id=share.book_id)
            session.add(rating)

        rating.total_ratings += 1
        rating_int = int(feedback_data.rating)
        if rating_int == 1:
            rating.rating_1_count += 1
        elif rating_int == 2:
            rating.rating_2_count += 1
        elif rating_int == 3:
            rating.rating_3_count += 1
        elif rating_int == 4:
            rating.rating_4_count += 1
        elif rating_int == 5:
            rating.rating_5_count += 1

        # Recalculate average
        total_sum = (
            rating.rating_1_count * 1
            + rating.rating_2_count * 2
            + rating.rating_3_count * 3
            + rating.rating_4_count * 4
            + rating.rating_5_count * 5
        )
        rating.average_rating = (
            total_sum / rating.total_ratings if rating.total_ratings > 0 else 0
        )

    await session.commit()
    return BookFeedbackResponse.from_orm(feedback)


@router.get("/shares/{share_token}/feedback", response_model=list[BookFeedbackResponse])
async def get_feedback(
    share_token: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """Get feedback for a public share (public endpoint, respects privacy)."""
    # Get share
    query_result = await session.execute(
        session.query(PublicShare).filter(PublicShare.share_token == share_token)
    )
    share = query_result.scalar()
    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Share not found or inactive")

    # Get feedback
    query = (
        session.query(BookFeedback)
        .filter(BookFeedback.share_id == share.id)
        .order_by(BookFeedback.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(query)
    feedback_list = result.scalars().all()

    # Anonymize emails
    responses = [BookFeedbackResponse.from_orm(f) for f in feedback_list]
    for response in responses:
        if response.reader_email:
            # Only show domain
            response.reader_email = f"***@{response.reader_email.split('@')[1]}"

    return responses


@router.get("/shares/{share_token}/ratings", response_model=BookRatingResponse)
async def get_ratings(
    share_token: str,
    session: AsyncSession = Depends(get_session),
):
    """Get aggregated ratings for a public share (public endpoint)."""
    # Get share
    query_result = await session.execute(
        session.query(PublicShare).filter(PublicShare.share_token == share_token)
    )
    share = query_result.scalar()
    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Share not found or inactive")

    # Get ratings
    query_result = await session.execute(
        session.query(BookRating).filter(BookRating.book_id == share.book_id)
    )
    rating = query_result.scalar()
    if not rating:
        raise HTTPException(status_code=404, detail="No ratings yet")

    return BookRatingResponse.from_orm(rating)
