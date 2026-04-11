"""Monetization and subscription models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, JSON, Text, Boolean, Enum
from sqlalchemy.orm import relationship
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
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Tier info
    tier = Column(String(50), default="free")  # free, pro, studio, publisher
    
    # Features (JSON for flexibility)
    features = Column(JSON, default={})
    
    # Billing
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    
    # Pricing
    monthly_price_cents = Column(Integer, nullable=True)
    annual_price_cents = Column(Integer, nullable=True)
    billing_cycle = Column(String(50), default="monthly")  # monthly, annual
    
    # Status
    status = Column(String(50), default="active")
    is_trial = Column(Integer, default=0)
    trial_ends_at = Column(DateTime, nullable=True)
    
    # Renewal
    next_billing_date = Column(DateTime, nullable=True)
    auto_renew = Column(Integer, default=1)
    
    # Limits
    books_limit = Column(Integer, default=3)
    collaborators_limit = Column(Integer, default=5)
    storage_gb = Column(Integer, default=10)
    beta_readers_limit = Column(Integer, default=10)
    
    # Usage
    books_created = Column(Integer, default=0)
    collaborators_added = Column(Integer, default=0)
    storage_used_mb = Column(Integer, default=0)
    
    # Dates
    activated_at = Column(DateTime, default=datetime.utcnow)
    renewed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class MarketplaceRoyalty(Base):
    """Royalty tracking for books sold through marketplace."""
    
    __tablename__ = "marketplace_royalties"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Sales data
    total_sales = Column(Integer, default=0)
    total_revenue_cents = Column(Integer, default=0)  # gross
    
    # Royalty calculation
    royalty_percentage = Column(Float, default=0.30)  # 30% default
    total_royalty_cents = Column(Integer, default=0)  # gross * percentage
    
    # Payouts
    payouts_pending_cents = Column(Integer, default=0)
    payouts_paid_cents = Column(Integer, default=0)
    last_payout_at = Column(DateTime, nullable=True)
    next_payout_at = Column(DateTime, nullable=True)
    
    # Marketplace share
    platform_fee_percent = Column(Float, default=0.30)  # Platform takes 30%
    author_earnings_cents = Column(Integer, default=0)  # royalty - platform fee
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    user = relationship("User", foreign_keys=[user_id])


class AffiliateLink(Base):
    """Affiliate link for book promotion."""
    
    __tablename__ = "affiliate_links"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Link data
    code = Column(String(50), unique=True, index=True)
    short_url = Column(String(500), nullable=True)
    
    # Tracking
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    
    # Revenue
    revenue_cents = Column(Integer, default=0)
    commission_percent = Column(Float, default=0.15)  # 15% commission
    commission_earned_cents = Column(Integer, default=0)
    
    # Usage
    source = Column(String(100), nullable=True)  # website, social, newsletter, etc.
    custom_label = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    user = relationship("User", foreign_keys=[user_id])


class PricingRecommendation(Base):
    """AI-generated pricing recommendations."""
    
    __tablename__ = "pricing_recommendations"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Current pricing
    current_price_cents = Column(Integer, nullable=True)
    current_price_tier = Column(String(50), nullable=True)  # economy, standard, premium
    
    # Recommendations
    recommended_price_cents = Column(Integer, nullable=True)
    price_confidence = Column(Float, default=0.0)  # 0.0-1.0
    
    # Analysis data
    genre = Column(String(100), nullable=True)
    comparable_books_count = Column(Integer, default=0)
    avg_competitor_price_cents = Column(Integer, nullable=True)
    
    # Elasticity prediction
    sales_at_current = Column(Integer, default=0)
    predicted_sales_at_recommended = Column(Integer, default=0)
    predicted_revenue_lift = Column(Float, default=0.0)  # percentage
    
    # Reasoning
    recommendation_reason = Column(Text, nullable=True)
    
    # Status
    is_applied = Column(Integer, default=0)
    applied_at = Column(DateTime, nullable=True)
    
    generated_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # recommendations expire after 30 days
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class CourseModule(Base):
    """Course creation for author teaching."""
    
    __tablename__ = "course_modules"
    
    id = Column(String(36), primary_key=True, index=True)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Course info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    slug = Column(String(100), unique=True, index=True)
    
    # Curriculum
    lesson_count = Column(Integer, default=0)
    total_duration_minutes = Column(Integer, default=0)
    
    # Pricing
    price_cents = Column(Integer, nullable=True)
    discount_percent = Column(Integer, default=0)
    
    # Status
    is_published = Column(Integer, default=0)
    is_featured = Column(Integer, default=0)
    
    # Stats
    enrolled_count = Column(Integer, default=0)
    completion_rate = Column(Float, default=0.0)
    average_rating = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    
    # Relationships
    author = relationship("User", foreign_keys=[author_id])


class PatronAccount(Base):
    """Patreon-like patron management."""
    
    __tablename__ = "patron_accounts"
    
    id = Column(String(36), primary_key=True, index=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Account
    stripe_account_id = Column(String(100), nullable=True)
    slug = Column(String(100), unique=True, index=True)
    
    # Tiers (patron levels)
    tiers = Column(JSON, default=[])  # [{"name": "Bronze", "price_cents": 500, "perks": [...]}]
    
    # Stats
    patron_count = Column(Integer, default=0)
    monthly_revenue_cents = Column(Integer, default=0)
    
    # Content access
    exclusive_posts_enabled = Column(Integer, default=0)
    discord_link = Column(String(500), nullable=True)
    
    # Status
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
