"""
Text Suggestion API Routes (DISABLED TEMPORARILY)

This file has been disabled to allow backend startup.
Restore suggestions.py from version control once issues are fixed.
"""
from fastapi import APIRouter

router = APIRouter(tags=["suggestions"])

@router.get("/health-check", tags=["Suggestions"])
async def suggestions_health_check():
    """Confirmation that suggestions module is disabled."""
    return {"status": "suggestions_routes_disabled_for_debugging"}
