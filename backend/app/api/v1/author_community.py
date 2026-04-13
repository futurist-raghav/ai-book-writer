"""FastAPI routes for author community."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.author_community import (
    AuthorProfileResponse,
    BetaReaderProfileCreate,
    BetaReaderProfileResponse,
    BetaReaderMatchCreate,
    BetaReaderMatchResponse,
    WritingGroupCreate,
    WritingGroupResponse,
    AuthorMessageCreate,
    AuthorMessageResponse,
    AuthorCollaborationCreate,
    AuthorCollaborationResponse,
    PublicAuthorPageResponse,
)
from app.services.author_community import (
    AuthorCommunityService,
    BetaReaderService,
    WritingGroupService,
    AuthorMessagingService,
    AuthorCollaborationService,
)


router = APIRouter(prefix="/community", tags=["Author Community"])


# Author Profiles
@router.get("/profile/{user_id}", response_model=AuthorProfileResponse)
def get_author_profile(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get author profile."""
    profile = AuthorCommunityService.get_or_create_profile(db, user_id)
    return profile


@router.patch("/profile", response_model=AuthorProfileResponse)
def update_author_profile(
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's author profile."""
    profile = AuthorCommunityService.update_profile(db, current_user.id, updates)
    return profile


# Public Author Pages
@router.get("/page/{user_id}", response_model=PublicAuthorPageResponse)
def get_public_author_page(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get public author page."""
    page = AuthorCommunityService.get_or_create_page(db, user_id)
    return page


# Beta Reader Profiles
@router.post("/beta-reader/profile", response_model=BetaReaderProfileResponse)
def create_beta_reader_profile(
    profile_data: BetaReaderProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create beta reader profile."""
    profile = BetaReaderService.create_profile(db, current_user.id, profile_data)
    return profile


# Beta Reader Matching
@router.post("/beta-reader/match", response_model=BetaReaderMatchResponse)
def request_beta_reader(
    match_data: BetaReaderMatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request beta reader for book."""
    from app.models import Book
    book = db.query(Book).filter_by(id=match_data.book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    match = BetaReaderService.request_match(db, match_data)
    match.author_id = current_user.id
    db.commit()
    db.refresh(match)
    return match


@router.patch("/beta-reader/match/{match_id}", response_model=BetaReaderMatchResponse)
def update_match_status(
    match_id: str,
    status: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update beta reader match status."""
    match = BetaReaderService.update_match_status(db, match_id, status["status"])
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


# Writing Groups
@router.post("/groups", response_model=WritingGroupResponse)
def create_writing_group(
    group_data: WritingGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create writing group."""
    group = WritingGroupService.create_group(db, current_user.id, group_data)
    return group


@router.get("/groups", response_model=list[WritingGroupResponse])
def search_writing_groups(
    genre: str = Query(None),
    writing_stage: str = Query(None),
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Search writing groups."""
    groups = WritingGroupService.search_groups(db, genre, writing_stage, limit)
    return groups


@router.post("/groups/{group_id}/join")
def join_writing_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join writing group."""
    member = WritingGroupService.join_group(db, group_id, current_user.id)
    if not member:
        raise HTTPException(status_code=400, detail="Could not join group")
    return {"status": "joined"}


# Messaging
@router.post("/messages", response_model=AuthorMessageResponse)
def send_message(
    message_data: AuthorMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send message to another author."""
    message = AuthorMessagingService.send_message(db, current_user.id, message_data)
    return message


@router.get("/conversation/{user_id}", response_model=list[AuthorMessageResponse])
def get_conversation(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get conversation with another author."""
    messages = AuthorMessagingService.get_conversation(db, current_user.id, user_id)
    return messages


@router.patch("/messages/{message_id}/read")
def mark_message_read(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark message as read."""
    message = AuthorMessagingService.mark_as_read(db, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "read"}


# Collaboration
@router.post("/collaborate", response_model=AuthorCollaborationResponse)
def request_collaboration(
    collab_data: AuthorCollaborationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request collaboration with another author."""
    collab = AuthorCollaborationService.request_collaboration(db, current_user.id, collab_data)
    return collab


@router.patch("/collaborate/{collab_id}", response_model=AuthorCollaborationResponse)
def update_collaboration_status(
    collab_id: str,
    status: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update collaboration status."""
    collab = AuthorCollaborationService.update_status(db, collab_id, status["status"])
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration not found")
    return collab
