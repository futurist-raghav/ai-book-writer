"""
Marketplace Routes

API endpoints for marketplace template browsing, searching, and management.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.models import User
from app.schemas.marketplace_schema import (
    MarketplaceTemplateResponse,
    MarketplaceTemplateDetailResponse,
    MarketplaceTemplateListResponse,
    MarketplaceTemplateInput,
    TemplateReviewInput,
    TemplateReviewResponse,
    TemplateCategoryResponse,
)
from app.services.marketplace_service import MarketplaceService
from app.core.db import get_db


router = APIRouter(prefix="/api/v1/marketplace", tags=["marketplace"])


@router.get("/templates", response_model=MarketplaceTemplateListResponse)
def search_templates(
    db: Session = Depends(get_db),
    query: Optional[str] = Query(None, min_length=1),
    category: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=1, le=5),
    sort_by: str = Query("popularity", regex="^(popularity|rating|newest|price_low|price_high)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Search marketplace templates.
    
    - **query**: Search by name or description
    - **category**: Filter by category
    - **min_rating**: Minimum average rating (1-5)
    - **sort_by**: Sort order (popularity, rating, newest, price_low, price_high)
    - **page**: Page number (1-indexed)
    - **page_size**: Items per page (max 100)
    """
    templates, total = MarketplaceService.search_templates(
        db=db,
        query=query,
        category=category,
        min_rating=min_rating,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )

    items = [
        MarketplaceTemplateResponse.model_validate(t) for t in templates
    ]

    pages = (total + page_size - 1) // page_size

    return MarketplaceTemplateListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/templates/{template_id}", response_model=MarketplaceTemplateDetailResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
):
    """Get detailed information about a template."""
    template = MarketplaceService.get_template_by_id(db, template_id)
    reviews, _ = MarketplaceService.get_template_reviews(db, template_id, page_size=100)

    return MarketplaceTemplateDetailResponse(
        **template.__dict__,
        reviews=[TemplateReviewResponse.model_validate(r) for r in reviews],
    )


@router.post("/templates", response_model=MarketplaceTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template_input: MarketplaceTemplateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new marketplace template.
    
    Only authenticated users can create templates.
    """
    template = MarketplaceService.create_template(
        db=db,
        creator_id=current_user.id,
        name=template_input.name,
        description=template_input.description,
        category=template_input.category,
        cover_image_url=template_input.cover_image_url,
        price=template_input.price,
        is_public=template_input.is_public,
        base_template_id=template_input.base_template_id,
    )

    return MarketplaceTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=MarketplaceTemplateResponse)
def update_template(
    template_id: str,
    template_input: MarketplaceTemplateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a marketplace template."""
    template = MarketplaceService.update_template(
        db=db,
        template_id=template_id,
        creator_id=current_user.id,
        name=template_input.name,
        description=template_input.description,
        category=template_input.category,
        cover_image_url=template_input.cover_image_url,
        price=template_input.price,
        is_public=template_input.is_public,
    )

    return MarketplaceTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a marketplace template."""
    MarketplaceService.delete_template(db, template_id, current_user.id)
    return None


@router.post("/templates/{template_id}/download", status_code=status.HTTP_200_OK)
def download_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a template download."""
    template = MarketplaceService.get_template_by_id(db, template_id)
    MarketplaceService.increment_downloads(db, template_id)

    return {"message": "Template downloaded successfully"}


@router.post("/templates/{template_id}/reviews", response_model=TemplateReviewResponse, status_code=status.HTTP_201_CREATED)
def add_review(
    template_id: str,
    review_input: TemplateReviewInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a review to a template."""
    review = MarketplaceService.add_review(
        db=db,
        template_id=template_id,
        reviewer_id=current_user.id,
        rating=review_input.rating,
        comment=review_input.comment,
    )

    return TemplateReviewResponse.model_validate(review)


@router.get("/templates/{template_id}/reviews")
def get_reviews(
    template_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get reviews for a template."""
    reviews, total = MarketplaceService.get_template_reviews(
        db, template_id, page, page_size
    )

    pages = (total + page_size - 1) // page_size

    return {
        "items": [TemplateReviewResponse.model_validate(r) for r in reviews],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/categories", response_model=list[TemplateCategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
):
    """Get all template categories."""
    categories = MarketplaceService.get_categories(db)
    return [TemplateCategoryResponse.model_validate(c) for c in categories]


@router.get("/trending", response_model=list[MarketplaceTemplateResponse])
def get_trending(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get trending marketplace templates."""
    templates = MarketplaceService.get_trending_templates(db, limit)
    return [MarketplaceTemplateResponse.model_validate(t) for t in templates]


@router.get("/my-templates", response_model=MarketplaceTemplateListResponse)
def get_my_templates(
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get templates created by current user."""
    templates, total = MarketplaceService.get_user_templates(
        db, current_user.id, page, page_size
    )

    items = [
        MarketplaceTemplateResponse.model_validate(t) for t in templates
    ]

    pages = (total + page_size - 1) // page_size

    return MarketplaceTemplateListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
