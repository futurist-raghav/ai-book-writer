from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from app.core.dependencies import get_db as get_session
from app.models.agent_usage import AgentUsage

router = APIRouter(prefix="/ai/agents", tags=["AI Agents"])

@router.get("/usage/stats")
async def get_usage_stats(
    days: int = 30,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get agent usage statistics for current user"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await session.execute(
        select(AgentUsage).where(
            (AgentUsage.user_id == current_user.id) &
            (AgentUsage.created_at >= cutoff_date)
        )
    )
    usage = result.scalars().all()
    
    # Aggregate by agent type
    stats = {}
    for u in usage:
        agent_type = u.agent_type
        if agent_type not in stats:
            stats[agent_type] = {"count": 0, "total_tokens": 0}
        stats[agent_type]["count"] += 1
        stats[agent_type]["total_tokens"] += u.tokens_used or 0
    
    return {
        "total_requests": len(usage),
        "by_agent": stats,
        "period_days": days,
    }

@router.get("/usage/remaining")
async def get_usage_remaining(
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Get remaining agent usage quota for current user"""
    # Daily quota: 100 requests per user
    today = datetime.utcnow().date()
    result = await session.execute(
        select(func.count(AgentUsage.id)).where(
            (AgentUsage.user_id == current_user.id) &
            (func.date(AgentUsage.created_at) == today)
        )
    )
    used_today = result.scalar() or 0
    remaining = max(0, 100 - used_today)
    
    return {
        "quota_per_day": 100,
        "used_today": used_today,
        "remaining": remaining,
        "reset_at": (datetime.utcnow().replace(hour=0, minute=0, second=0) + timedelta(days=1)).isoformat(),
    }

@router.post("/usage/log")
async def log_usage(
    data: dict,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Log an agent usage event"""
    agent_type = data.get("agent_type")
    tokens_used = data.get("tokens_used", 0)
    input_text = data.get("input_text", "")
    
    if not agent_type:
        raise HTTPException(status_code=400, detail="agent_type required")
    
    # Check daily quota
    today = datetime.utcnow().date()
    result = await session.execute(
        select(func.count(AgentUsage.id)).where(
            (AgentUsage.user_id == current_user.id) &
            (func.date(AgentUsage.created_at) == today)
        )
    )
    used_today = result.scalar() or 0
    
    if used_today >= 100:
        raise HTTPException(status_code=429, detail="Daily quota exceeded")
    
    # Log usage
    usage = AgentUsage(
        user_id=current_user.id,
        agent_type=agent_type,
        tokens_used=tokens_used,
        input_chars=len(input_text),
        created_at=datetime.utcnow(),
    )
    session.add(usage)
    await session.commit()
    
    return {"logged": True, "remaining": 100 - (used_today + 1)}
