"""
Author Community & Networking Routes
Handles author discovery, profiles, messaging, and beta reader matching
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import User, Book, AuthorProfile, AuthorMessage, BetaReaderMatch
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class AuthorProfileBase(BaseModel):
    bio: Optional[str] = None
    genres: List[str] = []  # e.g., ["science fiction", "mystery"]
    writing_style: Optional[str] = None
    looking_for_beta_readers: bool = False
    looking_to_beta_read: bool = False
    social_links: dict = {}  # { "twitter": "...", "instagram": "...", "website": "..." }

class AuthorProfileUpdate(AuthorProfileBase):
    pass

class AuthorProfileResponse(AuthorProfileBase):
    user_id: str
    username: str
    email: str
    books_count: int
    total_readers: int
    avg_rating: float
    beta_reader_requests: int
    created_at: datetime
    updated_at: datetime

class AuthorCardResponse(BaseModel):
    """Lightweight author card for directory listings"""
    user_id: str
    username: str
    bio: Optional[str]
    genres: List[str]
    books_count: int
    avg_rating: float
    looking_for_beta_readers: bool
    created_at: datetime

class AuthorMessageBase(BaseModel):
    recipient_id: str
    subject: str
    body: str

class AuthorMessageResponse(BaseModel):
    message_id: str
    sender_id: str
    sender_username: str
    recipient_id: str
    subject: str
    body: str
    read: bool
    created_at: datetime

class BetaReaderMatchResponse(BaseModel):
    """Match between author seeking beta readers and author willing to beta read"""
    match_id: str
    author_id: str
    author_username: str
    author_bio: Optional[str]
    author_genres: List[str]
    reader_id: str
    reader_username: str
    reader_bio: Optional[str]
    reader_genres: List[str]
    match_score: float  # 0-100, based on genre overlap and experience
    requested_at: datetime

class AuthorDiscoveryFilters(BaseModel):
    query: Optional[str] = None  # Search by username or bio
    genres: Optional[List[str]] = None  # Filter by genres
    min_books: int = 0
    min_rating: float = 0.0
    looking_for_beta: Optional[bool] = None
    sort_by: str = "recent"  # recent, popular, rating, books

# ==================== Author Directory ====================

@router.get("/authors", response_model=List[AuthorCardResponse])
async def discover_authors(
    query: Optional[str] = Query(None),
    genres: Optional[str] = Query(None),  # comma-separated
    min_books: int = Query(0),
    min_rating: float = Query(0.0),
    looking_for_beta: Optional[bool] = Query(None),
    sort_by: str = Query("recent"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db)
):
    """
    Discover authors by genre, rating, books published.
    Returns lightweight author cards for directory browsing.
    """
    try:
        # Build query
        stmt = select(
            User.id,
            User.username,
            AuthorProfile.bio,
            AuthorProfile.genres,
            func.count(distinct(Book.id)).label('books_count'),
            func.coalesce(func.avg(Book.average_rating), 0.0).label('avg_rating')
        ).join(
            AuthorProfile, AuthorProfile.user_id == User.id, isouter=True
        ).join(
            Book, Book.author_id == User.id, isouter=True
        )

        # Apply filters
        if query:
            stmt = stmt.where(
                or_(
                    User.username.ilike(f"%{query}%"),
                    AuthorProfile.bio.ilike(f"%{query}%") if AuthorProfile.bio else False
                )
            )

        if genres:
            genre_list = [g.strip().lower() for g in genres.split(",")]
            stmt = stmt.where(
                AuthorProfile.genres.overlap(genre_list)
            )

        if min_books > 0:
            stmt = stmt.having(func.count(distinct(Book.id)) >= min_books)

        if min_rating > 0:
            stmt = stmt.having(func.coalesce(func.avg(Book.average_rating), 0.0) >= min_rating)

        if looking_for_beta is not None:
            stmt = stmt.where(AuthorProfile.looking_for_beta_readers == looking_for_beta)

        # Sort
        if sort_by == "rating":
            stmt = stmt.order_by(desc(func.coalesce(func.avg(Book.average_rating), 0.0)))
        elif sort_by == "books":
            stmt = stmt.order_by(desc(func.count(distinct(Book.id))))
        else:  # recent
            stmt = stmt.order_by(desc(User.created_at))

        stmt = stmt.group_by(User.id, AuthorProfile.id).limit(limit).offset(offset)

        result = await db.execute(stmt)
        rows = result.fetchall()

        return [
            AuthorCardResponse(
                user_id=row[0],
                username=row[1],
                bio=row[2],
                genres=row[3] or [],
                books_count=row[4],
                avg_rating=float(row[5]),
                looking_for_beta_readers=True,  # Placeholder
                created_at=row.created_at if hasattr(row, 'created_at') else datetime.now()
            )
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error discovering authors: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to discover authors")


@router.get("/authors/{author_id}", response_model=AuthorProfileResponse)
async def get_author_profile(
    author_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed author profile including books, ratings, bio"""
    try:
        stmt = select(User).where(User.id == author_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="Author not found")

        # Get profile and stats
        profile_stmt = select(AuthorProfile).where(AuthorProfile.user_id == author_id)
        profile_result = await db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()

        books_stmt = select(
            func.count(Book.id),
            func.coalesce(func.avg(Book.average_rating), 0.0)
        ).where(Book.author_id == author_id)
        books_result = await db.execute(books_stmt)
        books_count, avg_rating = books_result.one()

        return AuthorProfileResponse(
            user_id=user.id,
            username=user.username,
            email=user.email,
            bio=profile.bio if profile else None,
            genres=profile.genres if profile else [],
            writing_style=profile.writing_style if profile else None,
            looking_for_beta_readers=profile.looking_for_beta_readers if profile else False,
            looking_to_beta_read=profile.looking_to_beta_read if profile else False,
            social_links=profile.social_links if profile else {},
            books_count=books_count or 0,
            total_readers=0,  # Placeholder: aggregate from book readers
            avg_rating=float(avg_rating) if avg_rating else 0.0,
            beta_reader_requests=0,  # Placeholder: count incoming requests
            created_at=user.created_at,
            updated_at=profile.updated_at if profile else user.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting author profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get author profile")


@router.put("/authors/{author_id}/profile", response_model=AuthorProfileResponse)
async def update_author_profile(
    author_id: str,
    profile_update: AuthorProfileUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update author's profile (bio, genres, beta reader status, social links)"""
    if current_user.id != author_id:
        raise HTTPException(status_code=403, detail="Cannot update other authors' profiles")

    try:
        stmt = select(AuthorProfile).where(AuthorProfile.user_id == author_id)
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            profile = AuthorProfile(user_id=author_id)

        # Update fields
        if profile_update.bio is not None:
            profile.bio = profile_update.bio
        if profile_update.genres:
            profile.genres = profile_update.genres
        if profile_update.writing_style is not None:
            profile.writing_style = profile_update.writing_style
        profile.looking_for_beta_readers = profile_update.looking_for_beta_readers
        profile.looking_to_beta_read = profile_update.looking_to_beta_read
        if profile_update.social_links:
            profile.social_links = profile_update.social_links

        profile.updated_at = datetime.utcnow()
        db.add(profile)
        await db.commit()

        return await get_author_profile(author_id, db)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating author profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


# ==================== Author Messaging ====================

@router.post("/messages/send", response_model=AuthorMessageResponse)
async def send_message(
    message: AuthorMessageBase,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send message to another author"""
    try:
        if message.recipient_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot message yourself")

        # Check recipient exists
        recipient_stmt = select(User).where(User.id == message.recipient_id)
        recipient = await db.execute(recipient_stmt)
        if not recipient.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Recipient not found")

        # Create message (requires AuthorMessage model)
        new_message = AuthorMessage(
            sender_id=current_user.id,
            recipient_id=message.recipient_id,
            subject=message.subject,
            body=message.body,
            read=False
        )
        db.add(new_message)
        await db.commit()

        return AuthorMessageResponse(
            message_id=new_message.id,
            sender_id=new_message.sender_id,
            sender_username=current_user.username,
            recipient_id=new_message.recipient_id,
            subject=new_message.subject,
            body=new_message.body,
            read=new_message.read,
            created_at=new_message.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/messages/inbox", response_model=List[AuthorMessageResponse])
async def get_inbox(
    unread_only: bool = Query(False),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get inbox messages for current user"""
    try:
        stmt = select(AuthorMessage).where(
            AuthorMessage.recipient_id == current_user.id
        )

        if unread_only:
            stmt = stmt.where(AuthorMessage.read == False)

        stmt = stmt.order_by(desc(AuthorMessage.created_at)).limit(limit).offset(offset)

        result = await db.execute(stmt)
        messages = result.scalars().all()

        return [
            AuthorMessageResponse(
                message_id=msg.id,
                sender_id=msg.sender_id,
                sender_username=msg.sender.username,  # Requires relationship
                recipient_id=msg.recipient_id,
                subject=msg.subject,
                body=msg.body,
                read=msg.read,
                created_at=msg.created_at
            )
            for msg in messages
        ]
    except Exception as e:
        logger.error(f"Error getting inbox: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get inbox")


@router.put("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark message as read"""
    try:
        stmt = select(AuthorMessage).where(AuthorMessage.id == message_id)
        result = await db.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if message.recipient_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot mark other users' messages as read")

        message.read = True
        await db.commit()

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error marking message as read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark message as read")


# ==================== Beta Reader Matching ====================

@router.post("/beta-reader-matches/request")
async def request_beta_reader_match(
    target_author_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Request to be matched as beta reader with another author"""
    try:
        if not current_user.profile or not current_user.profile.looking_to_beta_read:
            raise HTTPException(status_code=400, detail="Profile not set up for beta reading")

        # Check if match exists
        existing = await db.execute(
            select(BetaReaderMatch).where(
                and_(
                    BetaReaderMatch.author_id == target_author_id,
                    BetaReaderMatch.reader_id == current_user.id
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Match already requested")

        # Calculate match score based on genre overlap
        author_profile = await db.execute(
            select(AuthorProfile).where(AuthorProfile.user_id == target_author_id)
        )
        author_prof = author_profile.scalar_one_or_none()

        reader_genres = set(current_user.profile.genres or [])
        author_genres = set(author_prof.genres or []) if author_prof else set()
        overlap = len(reader_genres & author_genres)
        total = len(reader_genres | author_genres)
        match_score = (overlap / total * 100) if total > 0 else 50.0

        # Create match
        new_match = BetaReaderMatch(
            author_id=target_author_id,
            reader_id=current_user.id,
            match_score=match_score
        )
        db.add(new_match)
        await db.commit()

        return {"status": "success", "match_score": match_score}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error requesting beta reader match: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to request match")


@router.get("/beta-reader-matches", response_model=List[BetaReaderMatchResponse])
async def get_beta_reader_matches(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get beta reader matches for current author"""
    try:
        stmt = select(BetaReaderMatch).where(
            BetaReaderMatch.author_id == current_user.id
        ).order_by(desc(BetaReaderMatch.match_score))

        result = await db.execute(stmt)
        matches = result.scalars().all()

        return [
            BetaReaderMatchResponse(
                match_id=match.id,
                author_id=current_user.id,
                author_username=current_user.username,
                author_bio=current_user.profile.bio if current_user.profile else None,
                author_genres=current_user.profile.genres if current_user.profile else [],
                reader_id=match.reader.id,
                reader_username=match.reader.username,
                reader_bio=match.reader.profile.bio if match.reader.profile else None,
                reader_genres=match.reader.profile.genres if match.reader.profile else [],
                match_score=match.match_score,
                requested_at=match.created_at
            )
            for match in matches
        ]
    except Exception as e:
        logger.error(f"Error getting beta reader matches: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get matches")


# Helper function (placeholder - needs proper auth context)
async def get_current_user(db: AsyncSession = Depends(get_db)):
    """Placeholder - should use actual auth middleware"""
    # This should use JWT token from request
    return None
