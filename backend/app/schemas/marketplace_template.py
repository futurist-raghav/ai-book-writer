from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class TemplateReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = None
    content: Optional[str] = None


class TemplateReviewResponse(BaseModel):
    id: str
    rating: int
    title: Optional[str] = None
    content: Optional[str] = None
    helpful_count: int
    reviewer_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateCategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    order: int
    template_count: int

    class Config:
        from_attributes = True


class MarketplaceTemplateCreate(BaseModel):
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None
    sample_content: Optional[str] = None
    tags: List[str] = []
    is_public: bool = True


class MarketplaceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None
    sample_content: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None


class MarketplaceTemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    creator_id: str
    is_featured: bool
    is_verified: bool
    tags: List[str]
    usage_count: int
    rating_count: int
    average_rating: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarketplaceTemplateDetailResponse(MarketplaceTemplateResponse):
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None
    sample_content: Optional[str] = None
    reviews: List[TemplateReviewResponse] = []
    is_favorited: bool = False


class MarketplaceTemplateListResponse(BaseModel):
    total_count: int
    templates: List[MarketplaceTemplateResponse]
    featured_templates: Optional[List[MarketplaceTemplateResponse]] = None


class TemplateReviewListResponse(BaseModel):
    total_count: int
    reviews: List[TemplateReviewResponse]
    average_rating: float


class TemplateCategoryListResponse(BaseModel):
    categories: List[TemplateCategoryResponse]


class TemplateSearchQuery(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    sort_by: str = "popularity"  # popularity, rating, recent, trending
    featured_only: bool = False
