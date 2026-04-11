"""API endpoints for public comments and ratings."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.db import get_db
from app.models import PublicComment, PublicRating, PublicShare
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/public", tags=["public-comments"])


# ============================================================================
# Schemas
# ============================================================================


class CommentCreate(BaseModel):
    """Create comment on public share."""
    content: str = Field(..., min_length=1)
    reader_name: Optional[str] = None
    reader_email: Optional[str] = None
    comment_type: Optional[str] = None


class CommentResponse(BaseModel):
    """Comment response."""
    id: str
    public_share_id: str
    reader_name: Optional[str]
    content: str
    comment_type: Optional[str]
    likes: int
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RatingCreate(BaseModel):
    """Create rating on public share."""
    rating: int = Field(..., ge=1, le=5)
    reader_name: Optional[str] = None
    reader_email: Optional[str] = None
    title: Optional[str] = None
    review_text: Optional[str] = None


class RatingResponse(BaseModel):
    """Rating response."""
    id: str
    public_share_id: str
    rating: int
    reader_name: Optional[str]
    title: Optional[str]
    review_text: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RatingsStats(BaseModel):
    """Rating statistics."""
    average_rating: float
    total_ratings: int
    rating_distribution: dict  # {1: count, 2: count, ...}


# ============================================================================
# Comment Endpoints
# ============================================================================


@router.post("/shares/{share_token}/comments", response_model=CommentResponse)
async def create_comment(
    share_token: str,
    comment: CommentCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add comment to public share (public endpoint)."""
    # Verify share exists and is active
    query = select(PublicShare).where(PublicShare.share_token == share_token)
    result = await db.execute(query)
    share = result.scalar_one_or_none()

    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Share not found or inactive")

    if not share.allow_comments:
        raise HTTPException(status_code=403, detail="Comments disabled")

    # Create comment
    new_comment = PublicComment(
        id=str(uuid.uuid4()),
        public_share_id=share.id,
        content=comment.content,
        reader_name=comment.reader_name,
        reader_email=comment.reader_email,
        comment_type=comment.comment_type,
        is_approved=True,  # Auto-approve for now
    )

    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)

    return new_comment


@router.get("/shares/{share_token}/comments", response_model=List[CommentResponse])
async def list_comments(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> list:
    """Get all comments for public share (public endpoint)."""
    # Verify share exists
    query = select(PublicShare).where(PublicShare.share_token == share_token)
    result = await db.execute(query)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    # Get approved comments
    query = (
        select(PublicComment)
        .where(
            (PublicComment.public_share_id == share.id)
            & (PublicComment.is_approved == True)
        )
        .order_by(desc(PublicComment.created_at))
    )
    result = await db.execute(query)
    comments = result.scalars().all()

    return comments


# ============================================================================
# Rating Endpoints
# ============================================================================


@router.post("/shares/{share_token}/ratings", response_model=RatingResponse)
async def create_rating(
    share_token: str,
    rating: RatingCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Submit rating for public share (public endpoint)."""
    # Verify share exists and is active
    query = select(PublicShare).where(PublicShare.share_token == share_token)
    result = await db.execute(query)
    share = result.scalar_one_or_none()

    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Share not found or inactive")

    if not share.allow_ratings:
        raise HTTPException(status_code=403, detail="Ratings disabled")

    # Create rating
    new_rating = PublicRating(
        id=str(uuid.uuid4()),
        public_share_id=share.id,
        rating=rating.rating,
        reader_name=rating.reader_name,
        reader_email=rating.reader_email,
        title=rating.title,
        review_text=rating.review_text,
    )

    db.add(new_rating)
    await db.commit()
    await db.refresh(new_rating)

    return new_rating


@router.get("/shares/{share_token}/ratings", response_model=List[RatingResponse])
async def list_ratings(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> list:
    """Get all ratings for public share (public endpoint)."""
    # Verify share exists
    query = select(PublicShare).where(PublicShare.share_token == share_token)
    result = await db.execute(query)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    # Get ratings
    query = (
        select(PublicRating)
        .where(PublicRating.public_share_id == share.id)
        .order_by(desc(PublicRating.created_at))
    )
    result = await db.execute(query)
    ratings = result.scalars().all()

    return ratings


@router.get("/shares/{share_token}/ratings/stats", response_model=RatingsStats)
async def get_ratings_stats(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get rating statistics for public share."""
    # Verify share exists
    query = select(PublicShare).where(PublicShare.share_token == share_token)
    result = await db.execute(query)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    # Get all ratings
    query = select(PublicRating).where(PublicRating.public_share_id == share.id)
    result = await db.execute(query)
    ratings = result.scalars().all()

    if not ratings:
        return {
            "average_rating": 0,
            "total_ratings": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        }

    # Calculate stats
    total = len(ratings)
    avg = sum(r.rating for r in ratings) / total if ratings else 0
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings:
        distribution[r.rating] += 1

    return {
        "average_rating": round(avg, 2),
        "total_ratings": total,
        "rating_distribution": distribution,
    }
