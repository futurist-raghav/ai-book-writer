"""Monetization validation schemas."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# Subscription tiers
class SubscriptionTierInfo(BaseModel):
    """Subscription tier features."""
    tier: str
    books_limit: int
    collaborators_limit: int
    storage_gb: int
    beta_readers_limit: int
    monthly_price_cents: int
    annual_price_cents: int


class AuthorSubscriptionCreate(BaseModel):
    """Create subscription."""
    tier: str
    billing_cycle: str = "monthly"
    auto_renew: bool = True


class AuthorSubscriptionResponse(BaseModel):
    """Subscription response."""
    id: str
    user_id: str
    tier: str
    status: str
    billing_cycle: str
    monthly_price_cents: Optional[int]
    books_limit: int
    collaborators_limit: int
    storage_gb: int
    next_billing_date: Optional[datetime]
    activated_at: datetime
    created_at: datetime
    
    class Config:
        orm_mode = True


# Royalties
class MarketplaceRoyaltyCreate(BaseModel):
    """Create royalty record."""
    book_id: str
    royalty_percentage: float = 0.30


class MarketplaceRoyaltyResponse(BaseModel):
    """Royalty response."""
    id: str
    book_id: str
    user_id: str
    total_sales: int
    total_revenue_cents: int
    royalty_percentage: float
    total_royalty_cents: int
    payouts_paid_cents: int
    author_earnings_cents: int
    last_payout_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        orm_mode = True


class RoyaltyPayoutRequest(BaseModel):
    """Request royalty payout."""
    minimum_amount_cents: int = 50000  # $500 minimum


# Affiliate links
class AffiliateLinkCreate(BaseModel):
    """Create affiliate link."""
    book_id: str
    source: Optional[str] = None
    custom_label: Optional[str] = None


class AffiliateLinkResponse(BaseModel):
    """Affiliate link response."""
    id: str
    book_id: str
    code: str
    short_url: Optional[str]
    clicks: int
    conversions: int
    conversion_rate: float
    revenue_cents: int
    commission_earned_cents: int
    is_active: bool
    source: Optional[str]
    created_at: datetime
    
    class Config:
        orm_mode = True


# Pricing recommendations
class PricingRecommendationResponse(BaseModel):
    """Pricing recommendation."""
    id: str
    book_id: str
    current_price_cents: Optional[int]
    recommended_price_cents: Optional[int]
    price_confidence: float
    predicted_revenue_lift: float
    sales_at_current: int
    predicted_sales_at_recommended: int
    recommendation_reason: Optional[str]
    expires_at: Optional[datetime]
    
    class Config:
        orm_mode = True


# Courses
class CourseLessonCreate(BaseModel):
    """Create course lesson."""
    title: str
    content: str
    duration_minutes: int
    video_url: Optional[str] = None
    order: int = 0


class CourseModuleCreate(BaseModel):
    """Create course module."""
    title: str
    description: Optional[str] = None
    price_cents: Optional[int] = None
    lessons: List[CourseLessonCreate] = []


class CourseModuleResponse(BaseModel):
    """Course response."""
    id: str
    author_id: str
    title: str
    description: Optional[str]
    slug: str
    lesson_count: int
    total_duration_minutes: int
    price_cents: Optional[int]
    enrolled_count: int
    average_rating: float
    is_published: bool
    created_at: datetime
    
    class Config:
        orm_mode = True


class CourseEnrollmentCreate(BaseModel):
    """Enroll in course."""
    course_id: str


# Patrons
class PatronTierCreate(BaseModel):
    """Create patron tier."""
    name: str
    price_cents: int
    perks: List[str]


class PatronAccountCreate(BaseModel):
    """Create patron account."""
    slug: str
    tiers: List[PatronTierCreate]


class PatronAccountResponse(BaseModel):
    """Patron account response."""
    id: str
    creator_id: str
    slug: str
    patron_count: int
    monthly_revenue_cents: int
    tiers: List[Dict[str, Any]]
    exclusive_posts_enabled: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        orm_mode = True


class DashboardMetrics(BaseModel):
    """Monetization dashboard metrics."""
    subscription_tier: str
    monthly_revenue: int
    total_earnings: int
    active_affiliate_links: int
    patron_count: int
    course_enrollments: int
    books_published: int
    beta_readers_engaged: int
