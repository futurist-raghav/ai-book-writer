"""Monetization API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.monetization import (
    SubscriptionService,
    RoyaltyService,
    AffiliateService,
    PricingService,
    CourseService,
    PatronService,
)
from app.schemas.monetization import (
    AuthorSubscriptionCreate,
    AuthorSubscriptionResponse,
    AffiliateLinkCreate,
    AffiliateLinkResponse,
    CourseModuleCreate,
    CourseModuleResponse,
    PatronAccountCreate,
    PatronAccountResponse,
    DashboardMetrics,
)


router = APIRouter(prefix="/monetization", tags=["monetization"])


# Subscriptions
@router.get("/subscription", response_model=AuthorSubscriptionResponse)
def get_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current subscription."""
    sub = SubscriptionService.get_or_create(db, current_user.id)
    return sub


@router.post("/subscription/upgrade", response_model=AuthorSubscriptionResponse)
def upgrade_subscription(data: AuthorSubscriptionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Upgrade subscription tier."""
    sub = SubscriptionService.upgrade(db, current_user.id, data)
    return sub


@router.post("/subscription/cancel")
def cancel_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Cancel subscription."""
    sub = SubscriptionService.cancel(db, current_user.id)
    return {"status": "cancelled", "cancelled_at": sub.cancelled_at}


# Royalties
@router.get("/royalties")
def get_user_royalties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all royalties for user."""
    royalties = RoyaltyService.get_user_royalties(db, current_user.id)
    return [
        {
            "id": r.id,
            "book_id": r.book_id,
            "total_sales": r.total_sales,
            "total_earnings_cents": r.author_earnings_cents,
            "next_payout_at": r.next_payout_at,
        }
        for r in royalties
    ]


@router.get("/royalties/{book_id}")
def get_book_royalties(book_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get royalties for specific book."""
    royalty = RoyaltyService.get_by_book(db, book_id)
    if not royalty or royalty.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Royalty not found")
    
    return {
        "id": royalty.id,
        "book_id": royalty.book_id,
        "total_sales": royalty.total_sales,
        "total_revenue_cents": royalty.total_revenue_cents,
        "total_royalty_cents": royalty.total_royalty_cents,
        "author_earnings_cents": royalty.author_earnings_cents,
        "platform_fee_percent": royalty.platform_fee_percent,
        "payouts_paid_cents": royalty.payouts_paid_cents,
        "next_payout_at": royalty.next_payout_at,
    }


# Affiliate links
@router.post("/affiliate/links", response_model=AffiliateLinkResponse)
def create_affiliate_link(data: AffiliateLinkCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create affiliate link for book."""
    link = AffiliateService.create_link(db, current_user.id, data)
    return link


@router.get("/affiliate/links")
def get_affiliate_links(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all affiliate links for user."""
    # TODO: Implement proper user-scoped query
    return {"message": "Implement affiliate links query"}


@router.get("/affiliate/links/{code}/stats")
def get_link_stats(code: str, db: Session = Depends(get_db)):
    """Get affiliate link stats by code."""
    link = AffiliateService.get_by_code(db, code)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {
        "code": link.code,
        "clicks": link.clicks,
        "conversions": link.conversions,
        "conversion_rate": link.conversion_rate,
        "revenue_cents": link.revenue_cents,
        "commission_earned_cents": link.commission_earned_cents,
    }


# Pricing recommendations
@router.get("/pricing/recommendations/{book_id}")
def get_pricing_recommendation(book_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get pricing recommendation for book."""
    # Verify ownership
    from app.models.book import Book
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    
    return {"message": "Generate pricing recommendation"}


@router.post("/pricing/recommendations/{book_id}/apply")
def apply_pricing_recommendation(book_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Apply pricing recommendation."""
    return {"message": "Applied recommendation"}


# Courses
@router.post("/courses", response_model=CourseModuleResponse)
def create_course(data: CourseModuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create new course."""
    course = CourseService.create_course(db, current_user.id, data)
    return course


@router.get("/courses")
def get_user_courses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get courses by author."""
    courses = CourseService.get_by_author(db, current_user.id)
    return [
        {
            "id": c.id,
            "title": c.title,
            "slug": c.slug,
            "lesson_count": c.lesson_count,
            "enrolled_count": c.enrolled_count,
            "price_cents": c.price_cents,
        }
        for c in courses
    ]


@router.post("/courses/{course_id}/publish")
def publish_course(course_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Publish course."""
    from app.models.monetization import CourseModule
    course = db.query(CourseModule).filter(CourseModule.id == course_id).first()
    if not course or course.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = CourseService.publish_course(db, course_id)
    return {"status": "published", "published_at": course.published_at}


# Patron accounts
@router.post("/patron/account", response_model=PatronAccountResponse)
def create_patron_account(data: PatronAccountCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create patron account."""
    account = PatronService.create_account(db, current_user.id, data)
    return account


@router.get("/patron/account", response_model=PatronAccountResponse)
def get_patron_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get patron account for creator."""
    from app.models.monetization import PatronAccount
    account = db.query(PatronAccount).filter(PatronAccount.creator_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Patron account not found")
    return account


# Dashboard
@router.get("/dashboard", response_model=DashboardMetrics)
def get_monetization_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get monetization dashboard metrics."""
    # Get subscription
    sub = SubscriptionService.get_or_create(db, current_user.id)
    
    # Get royalties
    royalties = RoyaltyService.get_user_royalties(db, current_user.id)
    monthly_revenue = sum(r.author_earnings_cents for r in royalties) // 100  # Convert to dollars
    total_earnings = sum(r.author_earnings_cents for r in royalties)
    
    # Get courses
    courses = CourseService.get_by_author(db, current_user.id)
    course_enrollments = sum(c.enrolled_count for c in courses)
    
    # Get patron account
    from app.models.monetization import PatronAccount, AffiliateLink
    patron = PatronService.get_by_creator(db, current_user.id)
    patron_count = patron.patron_count if patron else 0
    
    # Get affiliate links
    from app.models.book import Book
    books = db.query(Book).filter(Book.user_id == current_user.id).all()
    affiliate_links_count = 0
    for book in books:
        links = AffiliateService.get_by_book(db, book.id)
        affiliate_links_count += len([l for l in links if l.is_active])
    
    return DashboardMetrics(
        subscription_tier=sub.tier,
        monthly_revenue=monthly_revenue,
        total_earnings=total_earnings,
        active_affiliate_links=affiliate_links_count,
        patron_count=patron_count,
        course_enrollments=course_enrollments,
        books_published=len(books),
        beta_readers_engaged=0,  # TODO: Calculate from collaborations
    )
