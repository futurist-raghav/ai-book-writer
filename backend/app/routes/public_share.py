from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import uuid4
from datetime import datetime

from app.core.dependencies import get_db as get_session
from app.models.book import Book
from app.models.public_share import PublicShare, BookFeedback
from app.schemas.public_share import (
    PublicShareResponse,
    PublicShareCreate,
    PublicShareUpdate,
)

router = APIRouter()

@router.get("/books/{book_id}/public-share", response_model=PublicShareResponse | None)
async def get_public_share(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get public share settings for a book"""
    # Verify user owns the book
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get share settings
    result = await session.execute(
        select(PublicShare).where(PublicShare.book_id == book_id)
    )
    share = result.scalar_one_or_none()
    return share

@router.post("/books/{book_id}/public-share", response_model=PublicShareResponse)
async def create_public_share(
    book_id: str,
    data: PublicShareCreate,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Create a public share link for a book"""
    # Verify user owns the book
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    # Check if share already exists
    result = await session.execute(
        select(PublicShare).where(PublicShare.book_id == book_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Share link already exists")

    # Create new share link
    share_url = f"share/{uuid4().hex[:12]}"
    share = PublicShare(
        book_id=book_id,
        share_url=share_url,
        is_public=True,
        allow_comments=data.allow_comments,
        allow_ratings=data.allow_ratings,
    )
    session.add(share)
    await session.commit()
    await session.refresh(share)
    return share

@router.put("/books/{book_id}/public-share", response_model=PublicShareResponse)
async def update_public_share(
    book_id: str,
    data: PublicShareUpdate,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Update public share settings"""
    # Verify user owns the book
    book = await session.get(Book, book_id)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get share settings
    result = await session.execute(
        select(PublicShare).where(PublicShare.book_id == book_id)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    # Update settings
    if data.is_public is not None:
        share.is_public = data.is_public
    if data.allow_comments is not None:
        share.allow_comments = data.allow_comments
    if data.allow_ratings is not None:
        share.allow_ratings = data.allow_ratings

    await session.commit()
    await session.refresh(share)
    return share

@router.get("/share/{share_url}")
async def view_public_share(
    share_url: str,
    session: AsyncSession = Depends(get_session),
):
    """Public endpoint to view a shared book (no auth required)"""
    # Get share settings
    result = await session.execute(
        select(PublicShare).where(
            (PublicShare.share_url == share_url) & (PublicShare.is_public == True)
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found or not public")

    # Get book data
    book = await session.get(Book, share.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return {
        "book": {
            "id": book.id,
            "title": book.title,
            "description": book.description,
            "cover_url": book.cover_url,
        },
        "share": {
            "allow_comments": share.allow_comments,
            "allow_ratings": share.allow_ratings,
        },
    }

@router.post("/share/{share_url}/comments")
async def create_comment(
    share_url: str,
    data: dict,
    session: AsyncSession = Depends(get_session),
):
    """Create a comment on a public share (no auth required)"""
    # Get share settings
    result = await session.execute(
        select(PublicShare).where(
            (PublicShare.share_url == share_url) & (PublicShare.is_public == True)
        )
    )
    share = result.scalar_one_or_none()
    if not share or not share.allow_comments:
        raise HTTPException(status_code=404, detail="Comments not allowed")

    # Create comment
    comment = BookFeedback(
        share_id=share.id,
        reader_name=data.get("reader_name"),
        reader_email=data.get("reader_email"),
        content=data.get("content"),
        reply_to=data.get("reply_to"),
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment

@router.get("/share/{share_url}/comments")
async def get_comments(
    share_url: str,
    session: AsyncSession = Depends(get_session),
):
    """Get comments for a public share"""
    # Get share settings
    result = await session.execute(
        select(PublicShare).where(PublicShare.share_url == share_url)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    # Get comments
    result = await session.execute(
        select(BookFeedback)
        .where((BookFeedback.share_id == share.id) & (BookFeedback.reply_to.is_(None)))
        .order_by(BookFeedback.created_at.desc())
    )
    comments = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "share_id": c.share_id,
            "reader_name": c.reader_name,
            "reader_email": c.reader_email,
            "content": c.content,
            "created_at": c.created_at,
            "likes": c.likes,
            "replies": [],
        }
        for c in comments
    ]

@router.post("/share/{share_url}/ratings")
async def create_rating(
    share_url: str,
    data: dict,
    session: AsyncSession = Depends(get_session),
):
    """Create a rating for a public share"""
    # Get share settings
    result = await session.execute(
        select(PublicShare).where(
            (PublicShare.share_url == share_url) & (PublicShare.is_public == True)
        )
    )
    share = result.scalar_one_or_none()
    if not share or not share.allow_ratings:
        raise HTTPException(status_code=404, detail="Ratings not allowed")

    rating = data.get("rating")
    if not rating or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    # Create rating feedback
    feedback = BookFeedback(
        share_id=share.id,
        rating=float(rating),
        content="Rating only",
    )
    session.add(feedback)
    await session.commit()
    await session.refresh(feedback)
    return feedback

@router.get("/share/{share_url}/ratings")
async def get_ratings(
    share_url: str,
    session: AsyncSession = Depends(get_session),
):
    """Get rating statistics for a public share"""
    # Get share settings
    result = await session.execute(
        select(PublicShare).where(PublicShare.share_url == share_url)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    # Get ratings (filter for feedback with ratings only)
    result = await session.execute(
        select(BookFeedback)
        .where((BookFeedback.share_id == share.id) & (BookFeedback.rating.isnot(None)))
    )
    feedback_list = result.scalars().all()

    if not feedback_list:
        return {
            "average_rating": 0,
            "total_ratings": 0,
            "distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        }

    total = len(feedback_list)
    avg = sum(f.rating for f in feedback_list) / total
    ratings = [int(f.rating) for f in feedback_list]
    distribution = {i: sum(1 for r in ratings if r == i) for i in range(1, 6)}

    return {
        "average_rating": avg,
        "total_ratings": total,
        "distribution": distribution,
    }

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Delete a comment (admin/owner only)"""
    comment = await session.get(BookFeedback, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Check permissions: user must own the share's book
    share = await session.get(PublicShare, comment.share_id)
    book = await session.get(Book, share.book_id)
    if book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await session.delete(comment)
    await session.commit()
    return {"deleted": True}
