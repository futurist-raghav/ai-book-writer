"""Monetization services."""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from uuid import uuid4
from app.models.monetization import (
    AuthorSubscription,
    MarketplaceRoyalty,
    AffiliateLink,
    PricingRecommendation,
    CourseModule,
    PatronAccount,
)
from app.schemas.monetization import (
    AuthorSubscriptionCreate,
    MarketplaceRoyaltyCreate,
    AffiliateLinkCreate,
    CourseModuleCreate,
    PatronAccountCreate,
)


class SubscriptionService:
    """Subscription management service."""
    
    TIER_FEATURES = {
        "free": {"books_limit": 3, "collaborators_limit": 1, "storage_gb": 5, "beta_readers_limit": 0},
        "pro": {"books_limit": 25, "collaborators_limit": 5, "storage_gb": 100, "beta_readers_limit": 10},
        "studio": {"books_limit": 100, "collaborators_limit": 20, "storage_gb": 500, "beta_readers_limit": 50},
        "publisher": {"books_limit": 500, "collaborators_limit": 100, "storage_gb": 2000, "beta_readers_limit": 200},
    }
    
    @staticmethod
    def get_or_create(db: Session, user_id: str) -> AuthorSubscription:
        """Get or create free subscription."""
        sub = db.query(AuthorSubscription).filter(AuthorSubscription.user_id == user_id).first()
        if not sub:
            features = SubscriptionService.TIER_FEATURES.get("free", {})
            sub = AuthorSubscription(
                id=str(uuid4()),
                user_id=user_id,
                tier="free",
                status="active",
                features=features,
                **features,
            )
            db.add(sub)
            db.commit()
        return sub
    
    @staticmethod
    def upgrade(db: Session, user_id: str, data: AuthorSubscriptionCreate) -> AuthorSubscription:
        """Upgrade subscription tier."""
        sub = SubscriptionService.get_or_create(db, user_id)
        
        features = SubscriptionService.TIER_FEATURES.get(data.tier, {})
        sub.tier = data.tier
        sub.status = "active"
        sub.billing_cycle = data.billing_cycle
        sub.auto_renew = 1 if data.auto_renew else 0
        sub.is_trial = 1
        sub.trial_ends_at = datetime.utcnow() + timedelta(days=14)  # 14-day trial
        
        # Update limits
        for key, val in features.items():
            setattr(sub, key, val)
        
        db.commit()
        return sub
    
    @staticmethod
    def cancel(db: Session, user_id: str) -> AuthorSubscription:
        """Cancel subscription."""
        sub = db.query(AuthorSubscription).filter(AuthorSubscription.user_id == user_id).first()
        if sub:
            sub.status = "cancelled"
            sub.cancelled_at = datetime.utcnow()
            db.commit()
        return sub


class RoyaltyService:
    """Royalty management service."""
    
    @staticmethod
    def initialize_book(db: Session, book_id: str, user_id: str) -> MarketplaceRoyalty:
        """Initialize royalty tracking for book."""
        existing = db.query(MarketplaceRoyalty).filter(MarketplaceRoyalty.book_id == book_id).first()
        if existing:
            return existing
        
        royalty = MarketplaceRoyalty(
            id=str(uuid4()),
            book_id=book_id,
            user_id=user_id,
            royalty_percentage=0.30,
        )
        db.add(royalty)
        db.commit()
        return royalty
    
    @staticmethod
    def record_sale(db: Session, book_id: str, price_cents: int, platform: str = "marketplace") -> MarketplaceRoyalty:
        """Record book sale."""
        royalty = db.query(MarketplaceRoyalty).filter(MarketplaceRoyalty.book_id == book_id).first()
        if not royalty:
            return None
        
        royalty.total_sales += 1
        royalty.total_revenue_cents += price_cents
        
        # Calculate earnings
        gross_royalty = int(price_cents * royalty.royalty_percentage)
        platform_fee = int(gross_royalty * royalty.platform_fee_percent)
        
        royalty.total_royalty_cents += gross_royalty
        royalty.author_earnings_cents += (gross_royalty - platform_fee)
        royalty.updated_at = datetime.utcnow()
        
        # Check for payout threshold ($500)
        if royalty.author_earnings_cents >= 50000 and not royalty.next_payout_at:
            royalty.next_payout_at = datetime.utcnow() + timedelta(days=5)  # Payout in 5 days
        
        db.commit()
        return royalty
    
    @staticmethod
    def get_by_book(db: Session, book_id: str) -> MarketplaceRoyalty:
        """Get royalty info for book."""
        return db.query(MarketplaceRoyalty).filter(MarketplaceRoyalty.book_id == book_id).first()
    
    @staticmethod
    def get_user_royalties(db: Session, user_id: str) -> list:
        """Get all royalties for user."""
        return db.query(MarketplaceRoyalty).filter(MarketplaceRoyalty.user_id == user_id).all()


class AffiliateService:
    """Affiliate link management."""
    
    @staticmethod
    def create_link(db: Session, user_id: str, data: AffiliateLinkCreate) -> AffiliateLink:
        """Create affiliate link."""
        code = f"{user_id[:8]}-{str(uuid4())[:8]}".lower()
        
        link = AffiliateLink(
            id=str(uuid4()),
            book_id=data.book_id,
            user_id=user_id,
            code=code,
            source=data.source,
            custom_label=data.custom_label,
        )
        db.add(link)
        db.commit()
        return link
    
    @staticmethod
    def track_click(db: Session, code: str) -> AffiliateLink:
        """Track affiliate link click."""
        link = db.query(AffiliateLink).filter(AffiliateLink.code == code).first()
        if link:
            link.clicks += 1
            db.commit()
        return link
    
    @staticmethod
    def record_conversion(db: Session, code: str, revenue_cents: int) -> AffiliateLink:
        """Record affiliate conversion."""
        link = db.query(AffiliateLink).filter(AffiliateLink.code == code).first()
        if link:
            link.conversions += 1
            link.revenue_cents += revenue_cents
            
            commission = int(revenue_cents * link.commission_percent)
            link.commission_earned_cents += commission
            
            if link.clicks > 0:
                link.conversion_rate = link.conversions / link.clicks
            
            db.commit()
        return link
    
    @staticmethod
    def get_by_code(db: Session, code: str) -> AffiliateLink:
        """Get link by code."""
        return db.query(AffiliateLink).filter(AffiliateLink.code == code).first()
    
    @staticmethod
    def get_by_book(db: Session, book_id: str) -> list:
        """Get all affiliate links for book."""
        return db.query(AffiliateLink).filter(AffiliateLink.book_id == book_id).all()


class PricingService:
    """AI pricing recommendations."""
    
    @staticmethod
    def generate_recommendation(db: Session, book_id: str, current_price: int, genre: str) -> PricingRecommendation:
        """Generate pricing recommendation."""
        # Simple heuristic: recommend 10-20% higher if current is low (under $5)
        # This is a placeholder for actual ML model
        if current_price < 500:
            recommended = int(current_price * 1.15)
            confidence = 0.75
            revenue_lift = 0.12
        elif current_price < 1000:
            recommended = int(current_price * 1.05)
            confidence = 0.80
            revenue_lift = 0.05
        else:
            recommended = int(current_price * 0.95)
            confidence = 0.70
            revenue_lift = -0.05
        
        rec = PricingRecommendation(
            id=str(uuid4()),
            book_id=book_id,
            current_price_cents=current_price,
            recommended_price_cents=recommended,
            price_confidence=confidence,
            genre=genre,
            predicted_revenue_lift=revenue_lift,
            recommendation_reason=f"Market analysis for {genre} category suggests optimal price at ${recommended/100:.2f}",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        
        existing = db.query(PricingRecommendation).filter(PricingRecommendation.book_id == book_id).first()
        if existing:
            db.delete(existing)
        
        db.add(rec)
        db.commit()
        return rec
    
    @staticmethod
    def apply_recommendation(db: Session, rec_id: str) -> PricingRecommendation:
        """Apply recommendation to book."""
        rec = db.query(PricingRecommendation).filter(PricingRecommendation.id == rec_id).first()
        if rec:
            rec.is_applied = 1
            rec.applied_at = datetime.utcnow()
            db.commit()
        return rec


class CourseService:
    """Course creation and management."""
    
    @staticmethod
    def create_course(db: Session, author_id: str, data: CourseModuleCreate) -> CourseModule:
        """Create course module."""
        slug = data.title.lower().replace(" ", "-")[:100]
        
        course = CourseModule(
            id=str(uuid4()),
            author_id=author_id,
            title=data.title,
            description=data.description,
            slug=slug,
            price_cents=data.price_cents,
            lesson_count=len(data.lessons),
        )
        db.add(course)
        
        # Add lessons (TODO: course_lessons table)
        total_duration = sum(lesson.duration_minutes for lesson in data.lessons)
        course.total_duration_minutes = total_duration
        
        db.commit()
        return course
    
    @staticmethod
    def publish_course(db: Session, course_id: str) -> CourseModule:
        """Publish course."""
        course = db.query(CourseModule).filter(CourseModule.id == course_id).first()
        if course:
            course.is_published = 1
            course.published_at = datetime.utcnow()
            db.commit()
        return course
    
    @staticmethod
    def get_by_author(db: Session, author_id: str) -> list:
        """Get courses by author."""
        return db.query(CourseModule).filter(CourseModule.author_id == author_id).all()


class PatronService:
    """Patron management (Patreon-like)."""
    
    @staticmethod
    def create_account(db: Session, creator_id: str, data: PatronAccountCreate) -> PatronAccount:
        """Create patron account."""
        account = PatronAccount(
            id=str(uuid4()),
            creator_id=creator_id,
            slug=data.slug,
            tiers=[tier.dict() for tier in data.tiers],
        )
        db.add(account)
        db.commit()
        return account
    
    @staticmethod
    def add_patron(db: Session, account_id: str, patron_id: str, tier_name: str) -> PatronAccount:
        """Add new patron."""
        account = db.query(PatronAccount).filter(PatronAccount.id == account_id).first()
        if account:
            # Find tier price
            tier_price = next((t.get("price_cents", 0) for t in account.tiers if t.get("name") == tier_name), 0)
            
            account.patron_count += 1
            account.monthly_revenue_cents += tier_price
            db.commit()
        
        return account
    
    @staticmethod
    def get_by_creator(db: Session, creator_id: str) -> PatronAccount:
        """Get patron account by creator."""
        return db.query(PatronAccount).filter(PatronAccount.creator_id == creator_id).first()
