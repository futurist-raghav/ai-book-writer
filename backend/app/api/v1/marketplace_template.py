from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import select, func, and_, or_
from sqlalchemy import desc

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.marketplace_template import (
    MarketplaceTemplate,
    TemplateReview,
    TemplateCategory,
    template_favorites,
)
from app.schemas.marketplace_template import (
    MarketplaceTemplateCreate,
    MarketplaceTemplateUpdate,
    MarketplaceTemplateResponse,
    MarketplaceTemplateDetailResponse,
    MarketplaceTemplateListResponse,
    TemplateReviewCreate,
    TemplateReviewResponse,
    TemplateReviewListResponse,
    TemplateCategoryResponse,
    TemplateCategoryListResponse,
    TemplateSearchQuery,
)

router = APIRouter(prefix="/templates/marketplace", tags=["Template Marketplace"])


# ============================================================================
# BROWSE & SEARCH
# ============================================================================


@router.get("", response_model=MarketplaceTemplateListResponse)
async def browse_marketplace(
    db: AsyncSession = Depends(get_db),
    category: str = Query(None),
    tags: list[str] = Query([]),
    min_rating: float = Query(0, ge=0, le=5),
    sort_by: str = Query("popularity"),  # popularity, rating, recent, trending
    featured_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Browse marketplace templates with filtering and sorting"""
    
    # Build base query
    query = select(MarketplaceTemplate).where(MarketplaceTemplate.is_public == True)
    
    # Apply filters
    if category:
        query = query.where(MarketplaceTemplate.category == category)
    
    if tags:
        # Templates must have at least one tag match
        for tag in tags:
            query = query.where(MarketplaceTemplate.tags.contains([tag]))
    
    if min_rating > 0:
        query = query.where(
            MarketplaceTemplate.rating_count > 0,
            (MarketplaceTemplate.rating_sum / MarketplaceTemplate.rating_count) >= min_rating
        )
    
    if featured_only:
        query = query.where(MarketplaceTemplate.is_featured == True)
    
    # Apply sorting
    if sort_by == "rating":
        query = query.order_by(desc(MarketplaceTemplate.rating_sum / MarketplaceTemplate.rating_count))
    elif sort_by == "recent":
        query = query.order_by(desc(MarketplaceTemplate.created_at))
    elif sort_by == "trending":
        # Trending = recent + high usage
        query = query.order_by(desc(MarketplaceTemplate.usage_count), desc(MarketplaceTemplate.created_at))
    else:  # popularity (default)
        query = query.order_by(desc(MarketplaceTemplate.usage_count), desc(MarketplaceTemplate.rating_sum))
    
    # Get total count
    result = await db.execute(
        select(func.count(MarketplaceTemplate.id)).where(
            MarketplaceTemplate.is_public == True
        )
    )
    total_count = result.scalar() or 0
    
    # Get featured templates (up to 6)
    result = await db.execute(
        select(MarketplaceTemplate)
        .where(MarketplaceTemplate.is_featured == True)
        .order_by(desc(MarketplaceTemplate.usage_count))
        .limit(6)
    )
    featured = result.scalars().all()
    
    # Get paginated results
    result = await db.execute(query.offset(skip).limit(limit))
    templates = result.scalars().all()
    
    return MarketplaceTemplateListResponse(
        total_count=total_count,
        templates=[MarketplaceTemplateResponse.from_orm(t) for t in templates],
        featured_templates=[MarketplaceTemplateResponse.from_orm(t) for t in featured] if not skip else None,
    )


@router.get("/search", response_model=MarketplaceTemplateListResponse)
async def search_templates(
    db: AsyncSession = Depends(get_db),
    q: str = Query("", min_length=1),
    category: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Search marketplace templates by name/description"""
    query = select(MarketplaceTemplate).where(
        MarketplaceTemplate.is_public == True,
        or_(
            MarketplaceTemplate.name.ilike(f"%{q}%"),
            MarketplaceTemplate.description.ilike(f"%{q}%"),
        ),
    )
    
    if category:
        query = query.where(MarketplaceTemplate.category == category)
    
    # Get total
    result = await db.execute(
        select(func.count(MarketplaceTemplate.id)).where(
            MarketplaceTemplate.is_public == True,
            or_(
                MarketplaceTemplate.name.ilike(f"%{q}%"),
                MarketplaceTemplate.description.ilike(f"%{q}%"),
            ),
        )
    )
    total_count = result.scalar() or 0
    
    # Get results
    result = await db.execute(query.offset(skip).limit(limit))
    templates = result.scalars().all()
    
    return MarketplaceTemplateListResponse(
        total_count=total_count,
        templates=[MarketplaceTemplateResponse.from_orm(t) for t in templates],
    )


@router.get("/categories", response_model=TemplateCategoryListResponse)
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Get all template categories"""
    result = await db.execute(
        select(TemplateCategory).order_by(TemplateCategory.order)
    )
    categories = result.scalars().all()
    
    return TemplateCategoryListResponse(
        categories=[TemplateCategoryResponse.from_orm(c) for c in categories]
    )


# ============================================================================
# TEMPLATE DETAIL
# ============================================================================


@router.get("/{template_id}", response_model=MarketplaceTemplateDetailResponse)
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get template details with reviews"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template or (not template.is_public and template.creator_id != current_user.id):
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get reviews
    result = await db.execute(
        select(TemplateReview)
        .where(TemplateReview.template_id == template_id)
        .order_by(desc(TemplateReview.created_at))
    )
    reviews = result.scalars().all()
    
    # Check if user has favorited
    result = await db.execute(
        select(MarketplaceTemplate)
        .where(MarketplaceTemplate.id == template_id)
        .select_from(template_favorites)
        .where(template_favorites.c.user_id == current_user.id)
    )
    is_favorited = result.scalar_one_or_none() is not None
    
    # Increment view tracking
    template.usage_count += 1
    await db.commit()
    
    return MarketplaceTemplateDetailResponse(
        **MarketplaceTemplateResponse.from_orm(template).dict(),
        chapter_structure=template.chapter_structure,
        initial_metadata=template.initial_metadata,
        formatting_preset=template.formatting_preset,
        matter_config=template.matter_config,
        sample_content=template.sample_content,
        reviews=[TemplateReviewResponse.from_orm(r) for r in reviews],
        is_favorited=is_favorited,
    )


# ============================================================================
# CREATE & MANAGE (User's own templates)
# ============================================================================


@router.post("", response_model=MarketplaceTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_marketplace_template(
    request: MarketplaceTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create and publish a marketplace template"""
    template = MarketplaceTemplate(
        creator_id=current_user.id,
        **request.dict(),
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


@router.get("/user/my-templates", response_model=MarketplaceTemplateListResponse)
async def list_my_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List current user's published templates"""
    result = await db.execute(
        select(func.count(MarketplaceTemplate.id)).where(
            MarketplaceTemplate.creator_id == current_user.id
        )
    )
    total_count = result.scalar() or 0
    
    result = await db.execute(
        select(MarketplaceTemplate)
        .where(MarketplaceTemplate.creator_id == current_user.id)
        .order_by(desc(MarketplaceTemplate.created_at))
        .offset(skip)
        .limit(limit)
    )
    templates = result.scalars().all()
    
    return MarketplaceTemplateListResponse(
        total_count=total_count,
        templates=[MarketplaceTemplateResponse.from_orm(t) for t in templates],
    )


@router.patch("/{template_id}", response_model=MarketplaceTemplateResponse)
async def update_marketplace_template(
    template_id: str,
    request: MarketplaceTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update template (creator only)"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot update template you don't own")
    
    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_marketplace_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete template (creator only)"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete template you don't own")
    
    await db.delete(template)
    await db.commit()


# ============================================================================
# REVIEWS
# ============================================================================


@router.get("/{template_id}/reviews", response_model=TemplateReviewListResponse)
async def get_template_reviews(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get reviews for a template"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    result = await db.execute(
        select(func.count(TemplateReview.id)).where(
            TemplateReview.template_id == template_id
        )
    )
    total_count = result.scalar() or 0
    
    result = await db.execute(
        select(TemplateReview)
        .where(TemplateReview.template_id == template_id)
        .order_by(desc(TemplateReview.created_at))
        .offset(skip)
        .limit(limit)
    )
    reviews = result.scalars().all()
    
    return TemplateReviewListResponse(
        total_count=total_count,
        reviews=[TemplateReviewResponse.from_orm(r) for r in reviews],
        average_rating=template.average_rating,
    )


@router.post("/{template_id}/reviews", response_model=TemplateReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    template_id: str,
    request: TemplateReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a review for a template"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if already reviewed
    result = await db.execute(
        select(TemplateReview).where(
            (TemplateReview.template_id == template_id)
            & (TemplateReview.reviewer_id == current_user.id)
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this template")
    
    review = TemplateReview(
        template_id=template_id,
        reviewer_id=current_user.id,
        **request.dict(),
    )
    
    # Update template rating
    template.rating_sum += request.rating
    template.rating_count += 1
    
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return review


# ============================================================================
# FAVORITES
# ============================================================================


@router.post("/{template_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def favorite_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add template to favorites"""
    result = await db.execute(
        select(MarketplaceTemplate).where(MarketplaceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if already favorited
    result = await db.execute(
        select(MarketplaceTemplate)
        .select_from(template_favorites)
        .where(
            (template_favorites.c.template_id == template_id)
            & (template_favorites.c.user_id == current_user.id)
        )
    )
    
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already in favorites")
    
    # Add to favorites
    stmt = template_favorites.insert().values(
        user_id=current_user.id,
        template_id=template_id,
    )
    await db.execute(stmt)
    await db.commit()


@router.delete("/{template_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def unfavorite_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove template from favorites"""
    stmt = template_favorites.delete().where(
        (template_favorites.c.template_id == template_id)
        & (template_favorites.c.user_id == current_user.id)
    )
    await db.execute(stmt)
    await db.commit()


@router.get("/user/favorites", response_model=MarketplaceTemplateListResponse)
async def list_favorite_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List user's favorite templates"""
    result = await db.execute(
        select(func.count(MarketplaceTemplate.id))
        .select_from(template_favorites)
        .where(template_favorites.c.user_id == current_user.id)
    )
    total_count = result.scalar() or 0
    
    result = await db.execute(
        select(MarketplaceTemplate)
        .select_from(template_favorites)
        .where(template_favorites.c.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    templates = result.scalars().all()
    
    return MarketplaceTemplateListResponse(
        total_count=total_count,
        templates=[MarketplaceTemplateResponse.from_orm(t) for t in templates],
    )
