"""
Marketplace Service

Handles marketplace template operations including browsing, searching, and management.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from fastapi import HTTPException, status
from app.models import MarketplaceTemplate, TemplateReview, TemplateCategory, User


class MarketplaceService:
    """Service for marketplace template operations."""

    @staticmethod
    def search_templates(
        db: Session,
        query: Optional[str] = None,
        category: Optional[str] = None,
        min_rating: Optional[float] = None,
        sort_by: str = "popularity",
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[MarketplaceTemplate], int]:
        """
        Search for marketplace templates.
        
        Args:
            db: Database session
            query: Search query string
            category: Filter by category
            min_rating: Minimum average rating
            sort_by: Sort order (popularity, rating, newest, price_low, price_high)
            page: Page number (1-indexed)
            page_size: Number of templates per page
            
        Returns:
            Tuple of (templates, total_count)
        """
        base_query = db.query(MarketplaceTemplate).filter(
            MarketplaceTemplate.is_public == True
        )

        if query:
            base_query = base_query.filter(
                (MarketplaceTemplate.name.ilike(f"%{query}%")) |
                (MarketplaceTemplate.description.ilike(f"%{query}%"))
            )

        if category:
            base_query = base_query.filter(MarketplaceTemplate.category == category)

        if min_rating is not None:
            base_query = base_query.filter(
                MarketplaceTemplate.average_rating >= min_rating
            )

        # Apply sorting
        if sort_by == "rating":
            base_query = base_query.order_by(
                desc(MarketplaceTemplate.average_rating)
            )
        elif sort_by == "newest":
            base_query = base_query.order_by(desc(MarketplaceTemplate.created_at))
        elif sort_by == "price_low":
            base_query = base_query.order_by(MarketplaceTemplate.price)
        elif sort_by == "price_high":
            base_query = base_query.order_by(desc(MarketplaceTemplate.price))
        else:  # popularity
            base_query = base_query.order_by(desc(MarketplaceTemplate.downloads))

        total = base_query.count()

        # Apply pagination
        templates = base_query.offset((page - 1) * page_size).limit(page_size).all()

        return templates, total

    @staticmethod
    def get_template_by_id(db: Session, template_id: str) -> MarketplaceTemplate:
        """Get a single template by ID."""
        template = db.query(MarketplaceTemplate).filter(
            MarketplaceTemplate.id == template_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        return template

    @staticmethod
    def create_template(
        db: Session,
        creator_id: str,
        name: str,
        description: str,
        category: str,
        cover_image_url: Optional[str] = None,
        price: float = 0.0,
        is_public: bool = False,
        base_template_id: Optional[str] = None,
    ) -> MarketplaceTemplate:
        """Create a new marketplace template."""
        template = MarketplaceTemplate(
            name=name,
            description=description,
            category=category,
            cover_image_url=cover_image_url,
            price=price,
            is_public=is_public,
            creator_id=creator_id,
            base_template_id=base_template_id,
            average_rating=None,
            review_count=0,
            downloads=0,
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return template

    @staticmethod
    def update_template(
        db: Session,
        template_id: str,
        creator_id: str,
        **kwargs
    ) -> MarketplaceTemplate:
        """Update a marketplace template."""
        template = MarketplaceService.get_template_by_id(db, template_id)
        
        if template.creator_id != creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only template creator can update"
            )
        
        for key, value in kwargs.items():
            if hasattr(template, key) and value is not None:
                setattr(template, key, value)
        
        db.commit()
        db.refresh(template)
        
        return template

    @staticmethod
    def delete_template(
        db: Session,
        template_id: str,
        creator_id: str,
    ) -> None:
        """Delete a marketplace template."""
        template = MarketplaceService.get_template_by_id(db, template_id)
        
        if template.creator_id != creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only template creator can delete"
            )
        
        db.delete(template)
        db.commit()

    @staticmethod
    def increment_downloads(db: Session, template_id: str) -> None:
        """Increment download count for a template."""
        template = MarketplaceService.get_template_by_id(db, template_id)
        template.downloads += 1
        db.commit()

    @staticmethod
    def add_review(
        db: Session,
        template_id: str,
        reviewer_id: str,
        rating: int,
        comment: Optional[str] = None,
    ) -> TemplateReview:
        """Add a review to a template."""
        template = MarketplaceService.get_template_by_id(db, template_id)

        # Check if reviewer already reviewed this template
        existing_review = db.query(TemplateReview).filter(
            and_(
                TemplateReview.template_id == template_id,
                TemplateReview.reviewer_id == reviewer_id,
            )
        ).first()

        if existing_review:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already reviewed this template"
            )

        review = TemplateReview(
            template_id=template_id,
            reviewer_id=reviewer_id,
            rating=rating,
            comment=comment,
        )

        db.add(review)
        db.flush()

        # Update template rating
        reviews = db.query(TemplateReview).filter(
            TemplateReview.template_id == template_id
        ).all()
        
        avg_rating = sum(r.rating for r in reviews) / len(reviews)
        template.average_rating = avg_rating
        template.review_count = len(reviews)

        db.commit()
        db.refresh(review)

        return review

    @staticmethod
    def get_template_reviews(
        db: Session,
        template_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[TemplateReview], int]:
        """Get reviews for a template."""
        base_query = db.query(TemplateReview).filter(
            TemplateReview.template_id == template_id
        ).order_by(desc(TemplateReview.created_at))

        total = base_query.count()
        reviews = base_query.offset((page - 1) * page_size).limit(page_size).all()

        return reviews, total

    @staticmethod
    def get_categories(db: Session) -> List[TemplateCategory]:
        """Get all template categories with counts."""
        categories = db.query(TemplateCategory).all()
        
        for category in categories:
            count = db.query(MarketplaceTemplate).filter(
                and_(
                    MarketplaceTemplate.category == category.name,
                    MarketplaceTemplate.is_public == True,
                )
            ).count()
            category.template_count = count

        return categories

    @staticmethod
    def get_trending_templates(
        db: Session,
        limit: int = 10,
    ) -> List[MarketplaceTemplate]:
        """Get trending templates (high rating + recent downloads)."""
        templates = db.query(MarketplaceTemplate).filter(
            MarketplaceTemplate.is_public == True
        ).order_by(
            desc(MarketplaceTemplate.average_rating),
            desc(MarketplaceTemplate.downloads),
        ).limit(limit).all()

        return templates

    @staticmethod
    def get_user_templates(
        db: Session,
        creator_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[MarketplaceTemplate], int]:
        """Get templates created by a user."""
        base_query = db.query(MarketplaceTemplate).filter(
            MarketplaceTemplate.creator_id == creator_id
        ).order_by(desc(MarketplaceTemplate.updated_at))

        total = base_query.count()
        templates = base_query.offset((page - 1) * page_size).limit(page_size).all()

        return templates, total
