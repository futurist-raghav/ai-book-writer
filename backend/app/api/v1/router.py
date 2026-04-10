"""
API v1 Router

Combines all API routes into a single router.
"""

from fastapi import APIRouter

from app.api.v1 import ai, audio, auth, books, chapters, chapter_versions, collaboration, custom_fields, entities, events, export, flow_engine, references, transcriptions, bibliography, workspace_customization

api_router = APIRouter()

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
api_router.include_router(audio.router, prefix="/audio", tags=["Audio Files"])
api_router.include_router(
    transcriptions.router, prefix="/transcriptions", tags=["Transcriptions"]
)
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(flow_engine.router, tags=["Flow Engine"])
api_router.include_router(chapters.router, prefix="/chapters", tags=["Chapters"])
api_router.include_router(chapter_versions.router, prefix="", tags=["Chapter Versions"])
api_router.include_router(books.router, prefix="/books", tags=["Books"])
api_router.include_router(entities.router, prefix="", tags=["Entities"])
api_router.include_router(references.router, prefix="", tags=["References"])
api_router.include_router(bibliography.router, tags=["Bibliography & Citations"])
api_router.include_router(workspace_customization.router, tags=["Workspace Customization"])
api_router.include_router(custom_fields.router, tags=["Custom Fields"])
api_router.include_router(collaboration.router, prefix="", tags=["Collaboration"])
api_router.include_router(export.router, prefix="", tags=["Publishing & Exports"])
