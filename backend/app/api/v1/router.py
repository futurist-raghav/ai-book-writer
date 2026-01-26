"""
API v1 Router

Combines all API routes into a single router.
"""

from fastapi import APIRouter

from app.api.v1 import audio, auth, books, chapters, events, transcriptions

api_router = APIRouter()

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(audio.router, prefix="/audio", tags=["Audio Files"])
api_router.include_router(
    transcriptions.router, prefix="/transcriptions", tags=["Transcriptions"]
)
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(chapters.router, prefix="/chapters", tags=["Chapters"])
api_router.include_router(books.router, prefix="/books", tags=["Books"])
