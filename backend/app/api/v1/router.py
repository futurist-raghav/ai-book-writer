"""
API v1 Router

Combines all API routes into a single router.
"""

from fastapi import APIRouter

from app.api.v1 import ai, audio, auth, books, chapters, chapter_versions, chapter_edits, section_approvals, formatting_themes, matter_config, device_preview, export_bundle, book_metadata, accessibility, collaboration, collaborator_roles, comments, custom_fields, entities, events, export, flow_engine, references, suggestions, transcriptions, bibliography, workspace_customization, import_export, glossary, realtime, workspace, marketplace_template, agents, analytics, public_share, public_comments, classroom, writing_performance
from app.routes import marketplace_analytics

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
api_router.include_router(chapter_edits.router, prefix="", tags=["Chapter Edit History"])
api_router.include_router(section_approvals.router, prefix="", tags=["Section Approval"])
api_router.include_router(formatting_themes.router, prefix="", tags=["Formatting Themes"])
api_router.include_router(matter_config.router, prefix="", tags=["Front/Back Matter"])
api_router.include_router(device_preview.router, prefix="", tags=["Device Preview"])
api_router.include_router(export_bundle.router, prefix="", tags=["Export Bundles"])
api_router.include_router(book_metadata.router, prefix="", tags=["Book Metadata"])
api_router.include_router(accessibility.router, prefix="", tags=["Accessibility"])
api_router.include_router(books.router, prefix="/books", tags=["Books"])
api_router.include_router(entities.router, prefix="", tags=["Entities"])
api_router.include_router(references.router, prefix="", tags=["References"])
api_router.include_router(bibliography.router, tags=["Bibliography & Citations"])
api_router.include_router(glossary.router, tags=["Glossary & Terms"])
api_router.include_router(comments.router, tags=["Comments"])
api_router.include_router(suggestions.router, tags=["Suggestions"])
api_router.include_router(collaborator_roles.router, tags=["Collaborators & Roles"])
api_router.include_router(workspace_customization.router, tags=["Workspace Customization"])
api_router.include_router(workspace.router, prefix="", tags=["Workspaces"])
api_router.include_router(custom_fields.router, tags=["Custom Fields"])
api_router.include_router(collaboration.router, prefix="", tags=["Collaboration"])
api_router.include_router(realtime.router, tags=["Real-time Collaboration"])
api_router.include_router(export.router, prefix="", tags=["Publishing & Exports"])
api_router.include_router(import_export.router, tags=["Import & Export"])
api_router.include_router(marketplace_template.router, tags=["Template Marketplace"])
api_router.include_router(marketplace_analytics.router, tags=["Template Marketplace"])
api_router.include_router(agents.router, tags=["AI Agents"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(public_share.router, tags=["Public Sharing & Feedback"])
api_router.include_router(public_comments.router, tags=["Public Comments & Ratings"])
api_router.include_router(classroom.router, tags=["Classrooms & Learning"])
api_router.include_router(writing_performance.router, tags=["Writing Performance"])
