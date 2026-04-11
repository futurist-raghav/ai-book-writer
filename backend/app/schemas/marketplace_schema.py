"""
Marketplace Template Schemas

Defines Pydantic models for template-related API requests and responses.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, validator
from datetime import datetime


class TemplateReviewInput(BaseModel):
    """Input model for creating a template review."""
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class TemplateReviewResponse(BaseModel):
    """Response model for a template review."""
    id: str
    template_id: str
    reviewer_id: str
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MarketplaceTemplateInput(BaseModel):
    """Input model for creating/updating a marketplace template."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10, max_length=2000)
    category: str = Field(..., description="Template category")
    cover_image_url: Optional[str] = None
    price: float = Field(default=0.0, ge=0)
    is_public: bool = Field(default=False)
    base_template_id: Optional[str] = None


class MarketplaceTemplateResponse(BaseModel):
    """Response model for a marketplace template."""
    id: str
    name: str
    description: str
    category: str
    cover_image_url: Optional[str]
    price: float
    is_public: bool
    creator_id: str
    average_rating: Optional[float]
    review_count: int
    downloads: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarketplaceTemplateDetailResponse(BaseModel):
    """Detailed response model for a marketplace template."""
    id: str
    name: str
    description: str
    category: str
    cover_image_url: Optional[str]
    price: float
    is_public: bool
    creator_id: str
    base_template_id: Optional[str]
    average_rating: Optional[float]
    review_count: int
    downloads: int
    reviews: List[TemplateReviewResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarketplaceTemplateListResponse(BaseModel):
    """List response for marketplace templates."""
    items: List[MarketplaceTemplateResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TemplateCategoryResponse(BaseModel):
    """Response model for template categories."""
    id: str
    name: str
    description: Optional[str]
    template_count: int
    popular: bool

    class Config:
        from_attributes = True
