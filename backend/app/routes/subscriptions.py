"""
Subscription & Monetization Routes
Handles subscription tiers, limits, and feature gating
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class SubscriptionTier(BaseModel):
    tier_id: str
    name: str
    price_monthly: float
    price_annual: float
    description: str
    features: list[str]
    limits: dict

class UserSubscription(BaseModel):
    subscription_id: str
    user_id: str
    tier: str
    status: str  # active, cancelled, expired
    started_at: datetime
    renews_at: datetime
    cancel_at_end: bool

class UsageData(BaseModel):
    chapters_created: int
    chapter_limit: int
    templates_used: int
    template_limit: int
    collaborators_count: int
    collaborators_limit: int
    ai_requests_used: int
    ai_requests_limit: int

# ==================== Subscription Tiers ====================

SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "price_annual": 0,
        "description": "Perfect for getting started",
        "features": [
            "Up to 3 projects",
            "Unlimited chapters & editing",
            "AI Assistant (100 requests/month)",
            "Writing performance tracking",
            "Basic export (PDF, EPUB, DOCX)",
            "Community access",
        ],
        "limits": {
            "projects": 3,
            "collaborators_per_project": 0,
            "templates": 5,
            "ai_requests_monthly": 100,
            "export_formats": ["pdf", "epub", "docx", "html"],
            "storage_gb": 1,
        },
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 9.99,
        "price_annual": 99.90,  # 20% discount
        "description": "For serious writers",
        "features": [
            "Unlimited projects",
            "Unlimited chapters & editing",
            "AI Assistant (1,000 requests/month)",
            "Writing performance & analytics",
            "Advanced export (all formats + custom styles)",
            "Up to 5 collaborators per project",
            "Beta reader tools",
            "Publishing pipeline access",
            "Priority support",
        ],
        "limits": {
            "projects": None,  # unlimited
            "collaborators_per_project": 5,
            "templates": None,
            "ai_requests_monthly": 1000,
            "export_formats": ["pdf", "epub", "docx", "html", "latex", "markdown"],
            "storage_gb": 50,
        },
    },
    "studio": {
        "name": "Studio",
        "price_monthly": 29.99,
        "price_annual": 299.90,  # 20% discount
        "description": "For teams and professionals",
        "features": [
            "Unlimited projects & chapters",
            "AI Assistant (5,000 requests/month)",
            "Unlimited collaborators per project",
            "Advanced analytics dashboard",
            "Custom export formats & styles",
            "Writing groups & team workspaces",
            "Course creation tools",
            "Template marketplace (publish & earn)",
            "Direct publishing integration (KDP, IngramSpark)",
            "Advanced API access",
            "Dedicated support & training",
        ],
        "limits": {
            "projects": None,
            "collaborators_per_project": None,
            "templates": None,
            "ai_requests_monthly": 5000,
            "export_formats": ["all"],
            "storage_gb": 500,
        },
    },
}


@router.get("/subscriptions/tiers")
async def get_subscription_tiers():
    """Get all available subscription tiers"""
    return {
        "tiers": [
            {
                "tier_id": tier_id,
                **tier_details,
            }
            for tier_id, tier_details in SUBSCRIPTION_TIERS.items()
        ]
    }


@router.get("/subscriptions/current")
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
):
    """Get user's current subscription"""
    # For now, return mock data - in production, query UserSubscription model
    return {
        "subscription_id": f"sub_{current_user.id}",
        "tier": "free",
        "name": "Free",
        "status": "active",
        "started_at": current_user.created_at.isoformat(),
        "renews_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "can_upgrade": True,
        "cancel_at_end": False,
    }


@router.post("/subscriptions/upgrade/{tier_id}")
async def upgrade_subscription(
    tier_id: str,
    current_user: User = Depends(get_current_user),
):
    """Upgrade user subscription to new tier"""
    if tier_id not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    tier = SUBSCRIPTION_TIERS[tier_id]
    return {
        "status": "upgrade_initiated",
        "from_tier": "free",
        "to_tier": tier_id,
        "new_tier_name": tier["name"],
        "price": f"${tier['price_monthly']}/month",
        "next_billing": (datetime.utcnow() + timedelta(days=30)).isoformat(),
    }


@router.post("/subscriptions/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
):
    """Cancel user subscription"""
    return {
        "status": "cancellation_initiated",
        "cancelled_at": datetime.utcnow().isoformat(),
        "downgrade_to": "free",
        "effective_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
    }


# ==================== Usage & Limits ====================

@router.get("/subscriptions/usage")
async def get_subscription_usage(
    current_user: User = Depends(get_current_user),
):
    """Get user's current usage vs limits"""
    # Mock data - in production, calculate from actual user data
    return {
        "tier": "free",
        "tier_name": "Free Plan",
        "usage": {
            "chapters_created": 5,
            "chapter_limit": None,
            "templates_used": 2,
            "template_limit": 5,
            "collaborators": 0,
            "collaborators_limit": 0,
            "ai_requests_monthly": 45,
            "ai_requests_limit": 100,
            "storage_gb": 0.3,
            "storage_limit_gb": 1,
        },
        "limits": SUBSCRIPTION_TIERS["free"]["limits"],
        "warnings": [
            {"feature": "AI Requests", "used": 45, "limit": 100, "percent": 45},
        ],
    }


# ==================== Billing & Invoices ====================

@router.get("/subscriptions/billing-history")
async def get_billing_history(
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, le=100),
):
    """Get user's billing history"""
    return {
        "invoices": [
            {
                "invoice_id": f"inv_{i}",
                "date": (datetime.utcnow() - timedelta(days=30 * i)).isoformat(),
                "amount": "$9.99",
                "status": "paid",
                "description": "Monthly subscription - Pro",
            }
            for i in range(limit)
        ],
        "total_count": limit,
    }


@router.get("/subscriptions/payment-method")
async def get_payment_method(
    current_user: User = Depends(get_current_user),
):
    """Get user's payment method"""
    return {
        "has_payment_method": False,
        "payment_methods": [],
        "message": "Add a payment method to upgrade your plan",
    }


# Helper function (placeholder)
async def get_current_user():
    return None
