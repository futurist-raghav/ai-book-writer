"""FastAPI routes for publishing pipeline."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.publishing_pipeline import (
    PublishingProfileCreate,
    PublishingProfileResponse,
    PublishingQueueCreate,
    PublishingQueueResponse,
    PublishingMetricsResponse,
    IsbnRequestCreate,
    IsbnRequestResponse,
)
from app.services.publishing_pipeline import PublishingService


router = APIRouter(prefix="/publishing", tags=["Publishing Pipeline"])


@router.post("/profiles", response_model=PublishingProfileResponse)
def create_publishing_profile(
    profile_data: PublishingProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create publishing profile for book."""
    # Verify user owns book
    from app.models import Book
    book = db.query(Book).filter_by(id=profile_data.book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    profile = PublishingService.create_profile(db, profile_data)
    return profile


@router.get("/profiles/{book_id}", response_model=PublishingProfileResponse)
def get_publishing_profile(
    book_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get publishing profile for book."""
    from app.models import Book
    book = db.query(Book).filter_by(id=book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    profile = PublishingService.get_profile(db, book_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/queue", response_model=PublishingQueueResponse)
def queue_for_publishing(
    queue_data: PublishingQueueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue book for publishing."""
    from app.models import Book
    book = db.query(Book).filter_by(id=queue_data.book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    queue_item = PublishingService.queue_for_publishing(db, queue_data)
    return queue_item


@router.get("/queue/{book_id}", response_model=list[PublishingQueueResponse])
def get_publishing_queue(
    book_id: str,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get publishing queue for book."""
    from app.models import Book
    book = db.query(Book).filter_by(id=book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    queue_items = PublishingService.get_queue_items(db, book_id, status)
    return queue_items


@router.get("/metrics/{book_id}", response_model=PublishingMetricsResponse)
def get_publishing_metrics(
    book_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get publishing metrics for book."""
    from app.models import Book
    book = db.query(Book).filter_by(id=book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    metrics = PublishingService.get_or_create_metrics(db, book_id)
    return metrics


@router.post("/isbn-request", response_model=IsbnRequestResponse)
def request_isbn(
    request_data: IsbnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request ISBN for book."""
    from app.models import Book
    book = db.query(Book).filter_by(id=request_data.book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    isbn_request = PublishingService.request_isbn(db, request_data.book_id, request_data.provider)
    return isbn_request
