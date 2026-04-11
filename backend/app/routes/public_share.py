from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4

from app.db.database import get_session
from app.models.book import Book
from app.models.public_share import PublicShare
from app.schemas.public_share import (
    PublicShareResponse,
    PublicShareCreate,
    PublicShareUpdate,
)
from app.middleware.auth import verify_auth

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
