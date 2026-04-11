from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List
from app.database import get_session
from app.models import MarketplaceTemplate, MarketplaceReview
from app.middleware import verify_auth

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class TemplateAnalytics(BaseModel):
    template_id: str
    template_name: str
    views: int
    ratings: int
    average_rating: float
    downloads: int
    uses: int
    created_at: str
    last_used: str


class TrendPoint(BaseModel):
    date: str
    views: int
    downloads: int


class AnalyticsSummary(BaseModel):
    total_views: int
    total_downloads: int
    total_uses: int
    templates: List[TemplateAnalytics]
    trends: List[TrendPoint]


@router.get("/analytics")
async def get_template_analytics(
    period: str = "30d",
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(verify_auth)
):
    """Get analytics for user's published templates"""
    
    # Determine date threshold
    date_map = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "all": 999999
    }
    days = date_map.get(period, 30)
    threshold_date = datetime.utcnow() - timedelta(days=days)
    
    # Get user's published templates
    stmt = select(MarketplaceTemplate).where(
        (MarketplaceTemplate.creator_id == user_id) &
        (MarketplaceTemplate.is_public == True)
    )
    result = await session.execute(stmt)
    templates = result.scalars().all()
    
    if not templates:
        return AnalyticsSummary(
            total_views=0,
            total_downloads=0,
            total_uses=0,
            templates=[],
            trends=[]
        )
    
    template_ids = [str(t.id) for t in templates]
    
    # Get reviews/ratings for analytics
    stmt = select(MarketplaceReview).where(
        MarketplaceReview.template_id.in_(template_ids)
    )
    result = await session.execute(stmt)
    reviews = result.scalars().all()
    
    # Calculate analytics per template
    template_analytics = []
    total_views = 0
    total_downloads = 0
    total_uses = 0
    
    for template in templates:
        template_reviews = [r for r in reviews if str(r.template_id) == str(template.id)]
        
        # Use metadata for tracking views, downloads, uses
        metadata = template.metadata or {}
        views = metadata.get("views", 0)
        downloads = metadata.get("downloads", 0)
        uses = metadata.get("uses", 0)
        
        avg_rating = 0.0
        if template_reviews:
            avg_rating = sum(r.rating for r in template_reviews) / len(template_reviews)
        
        total_views += views
        total_downloads += downloads
        total_uses += uses
        
        last_used = metadata.get("last_used", template.updated_at)
        
        template_analytics.append(TemplateAnalytics(
            template_id=str(template.id),
            template_name=template.name,
            views=views,
            ratings=len(template_reviews),
            average_rating=round(avg_rating, 1),
            downloads=downloads,
            uses=uses,
            created_at=template.created_at.isoformat(),
            last_used=last_used if isinstance(last_used, str) else last_used.isoformat()
        ))
    
    # Generate trends (mock data - can be enhanced with actual tracking)
    trends = []
    current_date = datetime.utcnow()
    for i in range(min(30, days)):
        day_date = current_date - timedelta(days=i)
        # Simple mock: gradual trend
        trends.append(TrendPoint(
            date=day_date.isoformat(),
            views=int(total_views * 0.7 * (1 - i / 30)),
            downloads=int(total_downloads * 0.7 * (1 - i / 30))
        ))
    trends.reverse()
    
    return AnalyticsSummary(
        total_views=total_views,
        total_downloads=total_downloads,
        total_uses=total_uses,
        templates=template_analytics,
        trends=trends
    )
