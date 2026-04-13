"""Monetization and subscription models."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Float, JSON, Text, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
import enum


class SubscriptionTier(str, enum.Enum):
    """Subscription tier levels."""
    FREE = "free"
    PRO = "pro"
    STUDIO = "studio"
    PUBLISHER = "publisher"


class PaymentStatus(str, enum.Enum):
    """Payment status."""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"
    FAILED = "failed"


class AuthorSubscription(Base):
    """Author subscription management."""
    
    __tablename__ = "author_subscriptions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Tier info
    tier: Mapped[str] = mapped_column(String(50), default="free") # free, pro, studio, publisher
    
    # Features (JSON for flexibility)
    features: Mapped[dict] = mapped_column(JSON, default={})
    
    # Billing
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Pricing
    monthly_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    annual_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    billing_cycle: Mapped[str] = mapped_column(String(50), default="monthly") # monthly, annual
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="active")
    is_trial: Mapped[int] = mapped_column(Integer, default=0)
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Renewal
    next_billing_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    auto_renew: Mapped[int] = mapped_column(Integer, default=1)
    
    # Limits
    books_limit: Mapped[int] = mapped_column(Integer, default=3)
    collaborators_limit: Mapped[int] = mapped_column(Integer, default=5)
    storage_gb: Mapped[int] = mapped_column(Integer, default=10)
    beta_readers_limit: Mapped[int] = mapped_column(Integer, default=10)
    
    # Usage
    books_created: Mapped[int] = mapped_column(Integer, default=0)
    collaborators_added: Mapped[int] = mapped_column(Integer, default=0)
    storage_used_mb: Mapped[int] = mapped_column(Integer, default=0)
    
    # Dates
    activated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    renewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class MarketplaceRoyalty(Base):
    """Royalty tracking for books sold through marketplace."""
    
    __tablename__ = "marketplace_royalties"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Sales data
    total_sales: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue_cents: Mapped[int] = mapped_column(Integer, default=0) # gross
    
    # Royalty calculation
    royalty_percentage: Mapped[float] = mapped_column(Float, default=0.30) # 30% default
    total_royalty_cents: Mapped[int] = mapped_column(Integer, default=0) # gross * percentage
    
    # Payouts
    payouts_pending_cents: Mapped[int] = mapped_column(Integer, default=0)
    payouts_paid_cents: Mapped[int] = mapped_column(Integer, default=0)
    last_payout_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_payout_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Marketplace share
    platform_fee_percent: Mapped[float] = mapped_column(Float, default=0.30) # Platform takes 30%
    author_earnings_cents: Mapped[int] = mapped_column(Integer, default=0) # royalty - platform fee
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    user = relationship("User", foreign_keys=[user_id])


class AffiliateLink(Base):
    """Affiliate link for book promotion."""
    
    __tablename__ = "affiliate_links"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Link data
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    short_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Tracking
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    conversion_rate: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Revenue
    revenue_cents: Mapped[int] = mapped_column(Integer, default=0)
    commission_percent: Mapped[float] = mapped_column(Float, default=0.15) # 15% commission
    commission_earned_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    # Usage
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # website, social, newsletter, etc.
    custom_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    user = relationship("User", foreign_keys=[user_id])


class PricingRecommendation(Base):
    """AI-generated pricing recommendations."""
    
    __tablename__ = "pricing_recommendations"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Current pricing
    current_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_price_tier: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # economy, standard, premium
    
    # Recommendations
    recommended_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price_confidence: Mapped[float] = mapped_column(Float, default=0.0) # 0.0-1.0
    
    # Analysis data
    genre: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    comparable_books_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_competitor_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Elasticity prediction
    sales_at_current: Mapped[int] = mapped_column(Integer, default=0)
    predicted_sales_at_recommended: Mapped[int] = mapped_column(Integer, default=0)
    predicted_revenue_lift: Mapped[float] = mapped_column(Float, default=0.0) # percentage
    
    # Reasoning
    recommendation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    is_applied: Mapped[int] = mapped_column(Integer, default=0)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True) # recommendations expire after 30 days
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class CourseModule(Base):
    """Course creation for author teaching."""
    
    __tablename__ = "course_modules"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Course info
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Curriculum
    lesson_count: Mapped[int] = mapped_column(Integer, default=0)
    total_duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Pricing
    price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status
    is_published: Mapped[int] = mapped_column(Integer, default=0)
    is_featured: Mapped[int] = mapped_column(Integer, default=0)
    
    # Stats
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0)
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    author = relationship("User", foreign_keys=[author_id])


class PatronAccount(Base):
    """Patreon-like patron management."""
    
    __tablename__ = "patron_accounts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Account
    stripe_account_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Tiers (patron levels)
    tiers: Mapped[dict] = mapped_column(JSON, default=[]) # [{"name": "Bronze", "price_cents": 500, "perks": [...]}]
    
    # Stats
    patron_count: Mapped[int] = mapped_column(Integer, default=0)
    monthly_revenue_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    # Content access
    exclusive_posts_enabled: Mapped[int] = mapped_column(Integer, default=0)
    discord_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
