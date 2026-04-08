"""
Chapters API Routes

Handles chapter management and compilation.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import BookChapter
from app.models.chapter import Chapter, ChapterEvent, ChapterStatus, ChapterWorkflowStatus
from app.models.event import Event
from app.models.user import User
from app.services.llm.gemini_service import get_gemini_service
from app.schemas.chapter import (
    ChapterChatRequest,
    ChapterChatResponse,
    ChapterCompileRequest,
    ChapterCompileResponse,
    ChapterContextGenerateRequest,
    ChapterContextResponse,
    ChapterContextUpdate,
    ChapterCreate,
    ChapterDetailResponse,
    ChapterEventAdd,
    ChapterEventReorder,
    ChapterEventResponse,
    ChapterListResponse,
    ChapterProjectReference,
    ChapterResponse,
    ChapterUpdate,
    ChapterWorkspaceResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.event import EventListResponse

router = APIRouter()


SUPPORTED_WRITING_FORMS = {
    "memoir",
    "autobiography",
    "novel",
    "business",
    "self_help",
    "essay",
    "journal",
    "screenplay",
}

SUPPORTED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
SUPPORTED_DOCUMENT_SUFFIXES = {".txt", ".md", ".pdf", ".docx"}


def _normalize_writing_form(
    explicit_form: Optional[str],
    chapter: Chapter,
    user: Optional[User],
) -> str:
    """Resolve writing form with sensible defaults."""
    candidates = [
        explicit_form,
        chapter.writing_style,
        user.writing_style if user else None,
    ]
    for candidate in candidates:
        if not candidate:
            continue
        normalized = candidate.strip().lower().replace(" ", "_")
        if normalized in SUPPORTED_WRITING_FORMS:
            return normalized
    return "memoir"


def _resolve_ai_enhancement_enabled(chapter: Chapter, user: Optional[User]) -> bool:
    """Resolve effective AI enhancement preference (chapter > book > user)."""
    if chapter.ai_enhancement_enabled is not None:
        return bool(chapter.ai_enhancement_enabled)

    if chapter.book_associations:
        first_assoc = sorted(chapter.book_associations, key=lambda assoc: assoc.order_index)[0]
        if first_assoc.book and first_assoc.book.ai_enhancement_enabled is not None:
            return bool(first_assoc.book.ai_enhancement_enabled)

    if user is not None:
        return bool(user.ai_assist_enabled)

    return True


def _workspace_assets(chapter: Chapter) -> List[Dict[str, Any]]:
    """Return workspace asset list from generation settings."""
    workspace = _ensure_workspace_settings(chapter)
    assets = workspace.get("assets")
    if not isinstance(assets, list):
        assets = []
    return [asset for asset in assets if isinstance(asset, dict)]


def _chapter_asset_dir(user_id: uuid.UUID, chapter_id: uuid.UUID) -> Path:
    """Return chapter-specific asset storage directory."""
    path = Path(settings.LOCAL_STORAGE_PATH) / "chapter_assets" / str(user_id) / str(chapter_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _extract_document_text(file_path: Path) -> str:
    """Extract plain text from supported document types."""
    suffix = file_path.suffix.lower()

    if suffix in {".txt", ".md"}:
        return file_path.read_text(encoding="utf-8", errors="ignore").strip()

    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        parts: List[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text.strip())
        return "\n\n".join(parts).strip()

    if suffix == ".docx":
        from docx import Document

        document = Document(str(file_path))
        return "\n".join([p.text.strip() for p in document.paragraphs if p.text.strip()]).strip()

    return ""


def _ensure_workspace_settings(chapter: Chapter) -> Dict[str, Any]:
    """Ensure chapter generation settings include a workspace object."""
    settings = chapter.generation_settings if isinstance(chapter.generation_settings, dict) else {}
    settings = dict(settings)
    workspace = settings.get("workspace")
    if not isinstance(workspace, dict):
        workspace = {}
    workspace.setdefault("assets", [])
    settings["workspace"] = dict(workspace)
    chapter.generation_settings = settings
    return settings["workspace"]


def _persist_workspace_settings(chapter: Chapter, workspace: Dict[str, Any]) -> None:
    """Persist workspace updates by replacing the top-level JSON object."""
    settings = chapter.generation_settings if isinstance(chapter.generation_settings, dict) else {}
    updated = dict(settings)
    updated["workspace"] = dict(workspace)
    chapter.generation_settings = updated


def _parse_workspace_timestamp(value: Any) -> datetime:
    """Parse stored workspace timestamps defensively."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _chapter_event_payload(chapter: Chapter) -> List[Dict[str, str]]:
    """Build an ordered event payload for AI requests."""
    payload: List[Dict[str, str]] = []
    for assoc in sorted(chapter.event_associations, key=lambda item: item.order_index):
        event = assoc.event
        payload.append(
            {
                "title": event.title,
                "summary": event.summary or "",
                "content": (assoc.custom_content or event.content or "").strip(),
            }
        )
    return payload


def _build_base_context_text(
    chapter: Chapter,
    user: Optional[User],
    writing_form: str,
) -> str:
    """Create the base context text used by chapter workspace AI."""
    project_title = None
    if chapter.book_associations:
        first_assoc = sorted(chapter.book_associations, key=lambda assoc: assoc.order_index)[0]
        if first_assoc.book:
            project_title = first_assoc.book.title

    event_lines: List[str] = []
    for event in _chapter_event_payload(chapter)[:12]:
        if event["summary"]:
            event_lines.append(f"- {event['title']}: {event['summary']}")
        else:
            event_lines.append(f"- {event['title']}")

    preferred_tense = (user.preferred_tense if user and user.preferred_tense else "past").lower()
    preferred_perspective = (
        user.preferred_perspective if user and user.preferred_perspective else "first"
    ).lower()

    event_section = "\n".join(event_lines) if event_lines else "- No events linked yet."
    project_line = project_title or "Standalone Chapter Project"

    return (
        "# Chapter Base Context\n"
        f"Project: {project_line}\n"
        f"Chapter: {chapter.title}\n"
        f"Writing Form: {writing_form}\n"
        f"Preferred Tense: {preferred_tense}\n"
        f"Preferred Perspective: {preferred_perspective}\n"
        "\n"
        "## Writer Commitment Guardrails\n"
        "- Preserve the author's truth, lived details, and intention.\n"
        "- Do not fabricate facts, timelines, or outcomes.\n"
        "- Reframe wording for clarity and emotional precision without changing meaning.\n"
        "\n"
        "## Story Objective\n"
        "Write deeply and completely so a reader can feel what the author means, while keeping"
        " the author's authentic voice and commitment.\n"
        "\n"
        "## Event Spine\n"
        f"{event_section}\n"
        "\n"
        "## AI Role For Listening + STT + Organization\n"
        "- Convert speech/transcripts into clean event notes.\n"
        "- Organize notes into a coherent chapter arc.\n"
        "- Expand and reframe language deliberately for stronger reader impact.\n"
        "- Keep the author's message intact.\n"
    )


def _fallback_reframing_response(
    message: str,
    chapter: Chapter,
    event_payload: List[Dict[str, str]],
) -> Tuple[str, str]:
    """Deterministic fallback response when LLM provider is unavailable."""
    anchor_text = "\n\n".join(
        [
            item["content"]
            for item in event_payload
            if item["content"]
        ][:3]
    )
    rewritten_excerpt = (
        chapter.compiled_content[:1200].strip()
        if chapter.compiled_content
        else anchor_text[:1200].strip()
    )
    if not rewritten_excerpt:
        rewritten_excerpt = (
            "Start with a concrete scene, then reflect on what changed inside you, and finish "
            "with the lesson your reader should carry forward."
        )

    assistant_message = (
        "I kept your story commitment intact and prepared a deliberate reframing pass.\n\n"
        f"Your focus: {message.strip()}\n\n"
        "Recommended structure:\n"
        "1. Open with sensory detail from the key scene.\n"
        "2. Expand the inner conflict and stakes.\n"
        "3. Clarify the turning point and why it mattered.\n"
        "4. End with reflection that lands emotionally.\n\n"
        "Reframed excerpt:\n"
        f"{rewritten_excerpt}"
    )
    return assistant_message, rewritten_excerpt


async def _ensure_base_context(
    chapter: Chapter,
    user: Optional[User],
    writing_form: Optional[str] = None,
    force: bool = False,
) -> Tuple[str, str, datetime]:
    """Return and persist base context for chapter workspace."""
    workspace = _ensure_workspace_settings(chapter)
    resolved_writing_form = _normalize_writing_form(writing_form, chapter, user)

    existing_context = workspace.get("base_context")
    if existing_context and not force:
        generated_at = _parse_workspace_timestamp(workspace.get("generated_at"))
        workspace["writing_form"] = resolved_writing_form
        _persist_workspace_settings(chapter, workspace)
        return str(existing_context), resolved_writing_form, generated_at

    base_context = _build_base_context_text(
        chapter=chapter,
        user=user,
        writing_form=resolved_writing_form,
    )
    now = datetime.now(timezone.utc)
    workspace["base_context"] = base_context
    workspace["generated_at"] = now.isoformat()
    workspace["writing_form"] = resolved_writing_form
    workspace.setdefault("chat_history", [])
    _persist_workspace_settings(chapter, workspace)
    return base_context, resolved_writing_form, now


def _serialize_chapter_events(chapter: Chapter) -> List[ChapterEventResponse]:
    """Serialize chapter-event associations to API response objects."""
    events: List[ChapterEventResponse] = []
    for assoc in sorted(chapter.event_associations, key=lambda item: item.order_index):
        event = assoc.event
        events.append(
            ChapterEventResponse(
                event_id=event.id,
                order_index=assoc.order_index,
                custom_content=assoc.custom_content,
                transition_text=assoc.transition_text,
                event=EventListResponse(
                    id=event.id,
                    title=event.title,
                    summary=event.summary,
                    category=event.category,
                    tags=event.tags,
                    event_date=event.event_date,
                    status=event.status,
                    is_featured=event.is_featured,
                    word_count=event.word_count,
                    created_at=event.created_at,
                ),
            )
        )
    return events


def _chapter_target_progress(chapter: Chapter) -> Optional[float]:
    """Compute progress against chapter target words."""
    if not chapter.word_count_target or chapter.word_count_target <= 0:
        return None
    progress = (chapter.word_count / chapter.word_count_target) * 100
    return round(min(progress, 100.0), 2)


@router.get(
    "",
    response_model=PaginatedResponse[ChapterListResponse],
    summary="List chapters",
)
async def list_chapters(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    workflow_status_filter: Optional[str] = Query(None, alias="workflow_status"),
    chapter_type: Optional[str] = Query(None),
):
    """
    List all chapters for the authenticated user.
    """
    query = select(Chapter).where(Chapter.user_id == user_id)

    if status_filter:
        query = query.where(Chapter.status == status_filter)

    if workflow_status_filter:
        query = query.where(Chapter.workflow_status == workflow_status_filter)

    if chapter_type:
        query = query.where(Chapter.chapter_type == chapter_type)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(Chapter.chapter_number, Chapter.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    query = query.options(
        selectinload(Chapter.event_associations),
        selectinload(Chapter.book_associations).selectinload(BookChapter.book),
    )

    result = await db.execute(query)
    chapters = result.scalars().all()

    items = [
        ChapterListResponse(
            id=c.id,
            title=c.title,
            subtitle=c.subtitle,
            summary=c.summary,
            chapter_number=c.chapter_number,
            chapter_type=c.chapter_type,
            workflow_status=c.workflow_status,
            word_count_target=c.word_count_target,
            target_progress_percent=_chapter_target_progress(c),
            timeline_position=c.timeline_position,
            ai_enhancement_enabled=c.ai_enhancement_enabled,
            status=c.status,
            word_count=c.word_count,
            event_count=len(c.event_associations),
            projects=[
                ChapterProjectReference(
                    id=assoc.book.id,
                    title=assoc.book.title,
                    order_index=assoc.order_index,
                )
                for assoc in sorted(c.book_associations, key=lambda item: item.order_index)
                if assoc.book is not None
            ],
            created_at=c.created_at,
        )
        for c in chapters
    ]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create chapter",
)
async def create_chapter(
    chapter_data: ChapterCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a new chapter.
    """
    # Get next chapter number if not provided
    chapter_number = chapter_data.chapter_number
    if not chapter_number:
        result = await db.execute(
            select(func.max(Chapter.chapter_number)).where(Chapter.user_id == user_id)
        )
        max_num = result.scalar() or 0
        chapter_number = max_num + 1

    # Get next order index
    result = await db.execute(
        select(func.max(Chapter.order_index)).where(Chapter.user_id == user_id)
    )
    max_order = result.scalar() or 0
    resolved_order_index = (
        chapter_data.display_order
        if chapter_data.display_order is not None
        else (max_order + 1)
    )

    chapter = Chapter(
        title=chapter_data.title,
        subtitle=chapter_data.subtitle,
        description=chapter_data.description,
        summary=chapter_data.summary,
        chapter_number=chapter_number,
        order_index=resolved_order_index,
        chapter_type=chapter_data.chapter_type or "chapter",
        workflow_status=chapter_data.workflow_status or ChapterWorkflowStatus.DRAFT.value,
        word_count_target=chapter_data.word_count_target,
        timeline_position=chapter_data.timeline_position,
        writing_style=chapter_data.writing_style,
        tone=chapter_data.tone,
        ai_enhancement_enabled=chapter_data.ai_enhancement_enabled,
        status=ChapterStatus.DRAFT.value,
        user_id=user_id,
    )

    db.add(chapter)
    await db.flush()

    # Add events if provided
    if chapter_data.event_ids:
        for idx, event_id in enumerate(chapter_data.event_ids):
            # Verify event belongs to user
            event_result = await db.execute(
                select(Event).where(Event.id == event_id, Event.user_id == user_id)
            )
            if event_result.scalar_one_or_none():
                chapter_event = ChapterEvent(
                    chapter_id=chapter.id,
                    event_id=event_id,
                    order_index=idx,
                )
                db.add(chapter_event)

    await db.flush()

    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter.id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = chapter_result.scalar_one()

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    await _ensure_base_context(chapter=chapter, user=user)

    await db.refresh(chapter)

    return ChapterResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        summary=chapter.summary,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        word_count_target=chapter.word_count_target,
        target_progress_percent=_chapter_target_progress(chapter),
        timeline_position=chapter.timeline_position,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        ai_enhancement_enabled=chapter.ai_enhancement_enabled,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter_data.event_ids) if chapter_data.event_ids else 0,
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
    )


@router.get(
    "/{chapter_id}",
    response_model=ChapterDetailResponse,
    summary="Get chapter details",
)
async def get_chapter(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get full chapter details with events.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event)
        )
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    events = _serialize_chapter_events(chapter)

    return ChapterDetailResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        summary=chapter.summary,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        word_count_target=chapter.word_count_target,
        target_progress_percent=_chapter_target_progress(chapter),
        timeline_position=chapter.timeline_position,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        ai_enhancement_enabled=chapter.ai_enhancement_enabled,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter.event_associations),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
        events=events,
    )


@router.put(
    "/{chapter_id}",
    response_model=ChapterResponse,
    summary="Update chapter",
)
@router.patch(
    "/{chapter_id}",
    response_model=ChapterResponse,
    summary="Partially update chapter",
)
async def update_chapter(
    chapter_id: uuid.UUID,
    chapter_data: ChapterUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update chapter metadata.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations))
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    update_data = chapter_data.model_dump(exclude_unset=True)
    if "display_order" in update_data and "order_index" not in update_data:
        update_data["order_index"] = update_data["display_order"]
    update_data.pop("display_order", None)

    for field, value in update_data.items():
        setattr(chapter, field, value)

    await db.flush()
    await db.refresh(chapter)

    return ChapterResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        summary=chapter.summary,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        word_count_target=chapter.word_count_target,
        target_progress_percent=_chapter_target_progress(chapter),
        timeline_position=chapter.timeline_position,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        ai_enhancement_enabled=chapter.ai_enhancement_enabled,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter.event_associations),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
    )


@router.delete(
    "/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete chapter",
)
async def delete_chapter(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete a chapter.
    """
    result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    await db.delete(chapter)


@router.post(
    "/{chapter_id}/events",
    response_model=MessageResponse,
    summary="Add events to chapter",
)
async def add_events_to_chapter(
    chapter_id: uuid.UUID,
    event_data: ChapterEventAdd,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Add events to a chapter.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations))
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Get current max order
    max_order = max([ea.order_index for ea in chapter.event_associations], default=-1)

    added_count = 0
    for event_id in event_data.event_ids:
        # Verify event belongs to user and not already in chapter
        event_result = await db.execute(
            select(Event).where(Event.id == event_id, Event.user_id == user_id)
        )
        if event_result.scalar_one_or_none():
            # Check if already in chapter
            existing = await db.execute(
                select(ChapterEvent).where(
                    ChapterEvent.chapter_id == chapter_id,
                    ChapterEvent.event_id == event_id,
                )
            )
            if not existing.scalar_one_or_none():
                max_order += 1
                chapter_event = ChapterEvent(
                    chapter_id=chapter_id,
                    event_id=event_id,
                    order_index=max_order,
                )
                db.add(chapter_event)
                added_count += 1

    await db.flush()

    return MessageResponse(message=f"Added {added_count} events to chapter")


@router.delete(
    "/{chapter_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove event from chapter",
)
async def remove_event_from_chapter(
    chapter_id: uuid.UUID,
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Remove an event from a chapter.
    """
    # Verify chapter belongs to user
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Find and delete the association
    result = await db.execute(
        select(ChapterEvent).where(
            ChapterEvent.chapter_id == chapter_id,
            ChapterEvent.event_id == event_id,
        )
    )
    chapter_event = result.scalar_one_or_none()

    if chapter_event:
        await db.delete(chapter_event)


@router.post(
    "/{chapter_id}/events/reorder",
    response_model=MessageResponse,
    summary="Reorder events in chapter",
)
@router.put(
    "/{chapter_id}/events/reorder",
    response_model=MessageResponse,
    summary="Reorder events in chapter",
)
@router.patch(
    "/{chapter_id}/events/reorder",
    response_model=MessageResponse,
    summary="Partially reorder events in chapter",
)
async def reorder_chapter_events(
    chapter_id: uuid.UUID,
    reorder_data: ChapterEventReorder,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reorder events within a chapter.
    """
    # Verify chapter belongs to user
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    if reorder_data.event_orders:
        for item in reorder_data.event_orders:
            result = await db.execute(
                select(ChapterEvent).where(
                    ChapterEvent.chapter_id == chapter_id,
                    ChapterEvent.event_id == item.event_id,
                )
            )
            chapter_event = result.scalar_one_or_none()
            if chapter_event:
                chapter_event.order_index = item.order_index
    else:
        for idx, event_id in enumerate(reorder_data.event_ids or []):
            result = await db.execute(
                select(ChapterEvent).where(
                    ChapterEvent.chapter_id == chapter_id,
                    ChapterEvent.event_id == event_id,
                )
            )
            chapter_event = result.scalar_one_or_none()
            if chapter_event:
                chapter_event.order_index = idx

    await db.flush()

    return MessageResponse(message="Events reordered successfully")


@router.get(
    "/{chapter_id}/workspace",
    response_model=ChapterWorkspaceResponse,
    summary="Get chapter writing workspace",
)
async def get_chapter_workspace(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get chapter detail enriched with AI workspace context."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    base_context, writing_form, generated_at = await _ensure_base_context(
        chapter=chapter,
        user=user,
    )
    effective_ai = _resolve_ai_enhancement_enabled(chapter, user)
    workspace = _ensure_workspace_settings(chapter)
    assets = _workspace_assets(chapter)
    chat_history = workspace.get("chat_history")
    if not isinstance(chat_history, list):
        chat_history = []
    recent_chat = [
        {
            "role": str(turn.get("role", "assistant")),
            "content": str(turn.get("content", "")),
            "created_at": str(turn.get("created_at", "")),
        }
        for turn in chat_history[-12:]
        if isinstance(turn, dict)
    ]

    await db.flush()

    refreshed_chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = refreshed_chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    events = _serialize_chapter_events(chapter)

    return ChapterWorkspaceResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        summary=chapter.summary,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        word_count_target=chapter.word_count_target,
        target_progress_percent=_chapter_target_progress(chapter),
        timeline_position=chapter.timeline_position,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter.event_associations),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
        events=events,
        writing_form=writing_form,
        base_context=base_context,
        context_generated_at=generated_at,
        chat_turns=len(chat_history) // 2,
        recent_chat=recent_chat,
        ai_enhancement_enabled=chapter.ai_enhancement_enabled,
        effective_ai_enhancement_enabled=effective_ai,
        assets=[
            {
                "id": str(asset.get("id", "")),
                "asset_type": str(asset.get("asset_type", "document")),
                "filename": str(asset.get("filename", "")),
                "path": str(asset.get("path", "")),
                "size_bytes": int(asset.get("size_bytes", 0) or 0),
                "created_at": str(asset.get("created_at", "")),
                "extracted_text_preview": (
                    str(asset.get("extracted_text", ""))[:240]
                    if asset.get("asset_type") == "document"
                    else None
                ),
            }
            for asset in assets
        ],
    )


@router.post(
    "/{chapter_id}/context/generate",
    response_model=ChapterContextResponse,
    summary="Generate chapter base context",
)
async def generate_chapter_context(
    chapter_id: uuid.UUID,
    payload: ChapterContextGenerateRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Generate or regenerate base context for chapter workspace."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    base_context, writing_form, generated_at = await _ensure_base_context(
        chapter=chapter,
        user=user,
        writing_form=payload.writing_form,
        force=payload.force,
    )
    await db.flush()

    return ChapterContextResponse(
        chapter_id=chapter.id,
        writing_form=writing_form,
        base_context=base_context,
        generated_at=generated_at,
        message="Chapter base context generated",
    )


@router.put(
    "/{chapter_id}/context",
    response_model=ChapterContextResponse,
    summary="Update chapter base context",
)
async def update_chapter_context(
    chapter_id: uuid.UUID,
    payload: ChapterContextUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Manually update chapter base context text."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.book_associations).selectinload(BookChapter.book))
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    resolved_writing_form = _normalize_writing_form(payload.writing_form, chapter, user)
    workspace = _ensure_workspace_settings(chapter)
    now = datetime.now(timezone.utc)
    workspace["base_context"] = payload.base_context.strip()
    workspace["writing_form"] = resolved_writing_form
    workspace["generated_at"] = now.isoformat()
    workspace.setdefault("chat_history", [])
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    return ChapterContextResponse(
        chapter_id=chapter.id,
        writing_form=resolved_writing_form,
        base_context=workspace["base_context"],
        generated_at=now,
        message="Chapter base context updated",
    )


@router.post(
    "/{chapter_id}/chat",
    response_model=ChapterChatResponse,
    summary="Chapter writing chat",
)
async def chapter_chat(
    chapter_id: uuid.UUID,
    payload: ChapterChatRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Run a writing chat turn for a chapter workspace."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    base_context, writing_form, _ = await _ensure_base_context(
        chapter=chapter,
        user=user,
        writing_form=payload.writing_form,
    )
    effective_ai = _resolve_ai_enhancement_enabled(chapter, user)
    workspace = _ensure_workspace_settings(chapter)

    chat_history = workspace.get("chat_history")
    if not isinstance(chat_history, list):
        chat_history = []

    event_payload = _chapter_event_payload(chapter)
    source_notes = "\n\n".join(
        [
            f"Event: {item['title']}\nSummary: {item['summary']}\nContent: {item['content']}"
            for item in event_payload[:8]
        ]
    )
    workspace_assets = _workspace_assets(chapter)
    document_source_notes = "\n\n".join(
        [
            f"Document: {asset.get('filename', 'source')}\n{str(asset.get('extracted_text', '')).strip()}"
            for asset in workspace_assets
            if str(asset.get("asset_type", "")) == "document" and str(asset.get("extracted_text", "")).strip()
        ][:2]
    )
    if not source_notes:
        source_notes = "No event notes are linked to this chapter yet."
    if document_source_notes:
        source_notes = f"{source_notes}\n\nImported source material:\n{document_source_notes}"

    history_for_prompt = "\n\n".join(
        [
            f"{turn.get('role', 'assistant').upper()}: {turn.get('content', '')}"
            for turn in chat_history[-8:]
            if isinstance(turn, dict)
        ]
    )
    existing_draft = chapter.compiled_content if payload.include_current_compiled_content else ""

    system_instruction = (
        "You are a chapter writing partner for long-form books. Preserve writer commitment, "
        "facts, and storytelling intention. Never overwrite with fabricated claims. Reframe language "
        "to be clearer, more deliberate, emotionally resonant, and complete."
    )

    prompt = (
        f"Base context:\n{base_context}\n\n"
        f"Writing form: {writing_form}\n"
        f"Rewrite depth: {payload.rewrite_depth}\n"
        f"Preserve commitment: {payload.preserve_writer_commitment}\n\n"
        f"Recent chat history:\n{history_for_prompt or 'No previous turns.'}\n\n"
        f"Current chapter draft:\n{existing_draft or 'No current compiled draft.'}\n\n"
        f"Source notes:\n{source_notes}\n\n"
        f"Writer request:\n{payload.message}\n\n"
        "Respond with:\n"
        "1) A short understanding of what the writer wants.\n"
        "2) Concrete guidance for deepening the chapter.\n"
        "3) A rewritten excerpt that keeps the writer's meaning but improves deliberate impact."
    )

    if effective_ai:
        try:
            gemini = get_gemini_service()
            assistant_message = await gemini.generate(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.55 if payload.rewrite_depth == "light" else 0.72,
                max_tokens=4096,
            )
            rewritten_excerpt = assistant_message
        except Exception:
            assistant_message, rewritten_excerpt = _fallback_reframing_response(
                message=payload.message,
                chapter=chapter,
                event_payload=event_payload,
            )
    else:
        assistant_message, rewritten_excerpt = _fallback_reframing_response(
            message=payload.message,
            chapter=chapter,
            event_payload=event_payload,
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    chat_history.extend(
        [
            {"role": "user", "content": payload.message.strip(), "created_at": now_iso},
            {
                "role": "assistant",
                "content": assistant_message,
                "created_at": now_iso,
                "rewritten_excerpt": rewritten_excerpt,
            },
        ]
    )
    workspace["chat_history"] = chat_history[-20:]
    workspace["writing_form"] = writing_form
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    return ChapterChatResponse(
        chapter_id=chapter.id,
        writing_form=writing_form,
        assistant_message=assistant_message,
        rewritten_excerpt=rewritten_excerpt,
        metadata={
            "source_events": len(event_payload),
            "chat_turns": len(workspace["chat_history"]) // 2,
        },
    )


@router.post(
    "/{chapter_id}/compile",
    response_model=ChapterCompileResponse,
    summary="Compile chapter content",
)
async def compile_chapter(
    chapter_id: uuid.UUID,
    compile_data: ChapterCompileRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Compile chapter content from events using AI.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
            selectinload(Chapter.book_associations).selectinload(BookChapter.book),
        )
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    if not chapter.event_associations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter has no events to compile",
        )

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    base_context, writing_form, _ = await _ensure_base_context(
        chapter=chapter,
        user=user,
        writing_form=compile_data.writing_style,
        force=compile_data.regenerate,
    )
    effective_ai = _resolve_ai_enhancement_enabled(chapter, user)

    event_payload = _chapter_event_payload(chapter)

    compiled_content: Optional[str] = None
    if effective_ai:
        try:
            gemini = get_gemini_service()
            compiled_content = await gemini.format_chapter(
                events=event_payload,
                writing_style=writing_form,
                tone=compile_data.tone or chapter.tone,
                user_preferences={
                    "base_context": base_context,
                    "preferred_tense": user.preferred_tense,
                    "preferred_perspective": user.preferred_perspective,
                    "preserve_writer_commitment": True,
                },
            )
        except Exception:
            compiled_content = None

    if not compiled_content:
        compiled_parts = []
        for assoc in sorted(chapter.event_associations, key=lambda item: item.order_index):
            event = assoc.event
            content = (assoc.custom_content or event.content or "").strip()
            if content:
                compiled_parts.append(content)
            if assoc.transition_text:
                compiled_parts.append(assoc.transition_text.strip())

        preface = (
            "This chapter draft was organized from your story notes while preserving your "
            "core meaning and narrative commitment."
        )
        compiled_body = "\n\n".join(compiled_parts)
        compiled_content = f"{preface}\n\n{compiled_body}" if compiled_body else preface

    if not compiled_content:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compile chapter content",
        )

    chapter.compiled_content = compiled_content
    chapter.last_compiled_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(chapter)

    return ChapterCompileResponse(
        id=chapter.id,
        compiled_content=chapter.compiled_content,
        word_count=chapter.word_count,
        compiled_at=chapter.last_compiled_at,
        message="Chapter compiled successfully",
    )


@router.post(
    "/{chapter_id}/assets/upload",
    summary="Upload chapter workspace asset",
)
async def upload_chapter_asset(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    file: UploadFile = File(...),
    asset_type: Optional[str] = Form(None),
):
    """Upload image/doc assets for chapter workspace context."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.book_associations).selectinload(BookChapter.book))
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    suffix = Path(file.filename).suffix.lower()
    inferred_type = "image" if suffix in SUPPORTED_IMAGE_SUFFIXES else "document"
    resolved_type = (asset_type or inferred_type).strip().lower()

    if resolved_type == "image" and suffix not in SUPPORTED_IMAGE_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format",
        )

    if resolved_type == "document" and suffix not in SUPPORTED_DOCUMENT_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported document format. Use txt, md, pdf, or docx",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    # Keep workspace assets lightweight for quick collaboration flows.
    max_size_bytes = 25 * 1024 * 1024
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset is too large. Max size is 25MB",
        )

    safe_name = f"{uuid.uuid4()}-{Path(file.filename).name}"
    target_dir = _chapter_asset_dir(user_id, chapter_id)
    target_path = target_dir / safe_name
    target_path.write_bytes(content)

    extracted_text = ""
    if resolved_type == "document":
        try:
            extracted_text = _extract_document_text(target_path)
        except Exception:
            extracted_text = ""

    workspace = _ensure_workspace_settings(chapter)
    assets = _workspace_assets(chapter)
    created_at = datetime.now(timezone.utc).isoformat()
    asset_entry: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "asset_type": resolved_type,
        "filename": file.filename,
        "path": str(target_path),
        "size_bytes": len(content),
        "created_at": created_at,
    }
    if extracted_text:
        asset_entry["extracted_text"] = extracted_text[:30000]

    assets.append(asset_entry)
    workspace["assets"] = assets[-50:]
    _persist_workspace_settings(chapter, workspace)
    await db.flush()

    return {
        "message": "Asset uploaded",
        "asset": {
            "id": asset_entry["id"],
            "asset_type": asset_entry["asset_type"],
            "filename": asset_entry["filename"],
            "path": asset_entry["path"],
            "size_bytes": asset_entry["size_bytes"],
            "created_at": asset_entry["created_at"],
            "extracted_text_preview": extracted_text[:240] if extracted_text else None,
        },
    }
