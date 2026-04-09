"""
Books API Routes

Handles book management and export.
"""

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.core.project_templates import get_project_template
from app.models.book import Book, BookChapter, BookStatus
from app.models.chapter import Chapter, ChapterStatus, ChapterWorkflowStatus
from app.services.llm.gemini_service import get_gemini_service
from app.schemas.book import (
    BookBackMatterUpdate,
    BookChapterAdd,
    BookChapterReorder,
    BookChapterResponse,
    BookCreate,
    BookDetailResponse,
    BookExportRequest,
    BookExportResponse,
    BookFrontMatterUpdate,
    BookListResponse,
    BookOutlineGenerateRequest,
    BookOutlineResponse,
    BookOutlineSection,
    BookPinUpdate,
    BookResponse,
    BookSynopsisGenerateRequest,
    BookSynopsisResponse,
    BookTemplateApplyRequest,
    BookUpdate,
)
from app.schemas.chapter import ChapterListResponse
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter()


def _count_words(text: Optional[str]) -> int:
    if not text:
        return 0
    return len(text.split())


def _book_matter_word_count(book: Book) -> int:
    """Compute words from front/back matter fields only (no relationship access)."""
    return sum(
        _count_words(text)
        for text in [
            book.dedication,
            book.acknowledgments,
            book.preface,
            book.introduction,
            book.epilogue,
            book.afterword,
            book.about_author,
        ]
    )


def _target_progress_percent(word_count: int, target_word_count: Optional[int]) -> Optional[float]:
    """Compute progress against a target word count."""
    if not target_word_count or target_word_count <= 0:
        return None
    progress = (word_count / target_word_count) * 100
    return round(min(progress, 100.0), 2)


SCREENPLAY_PROJECT_TYPES = {
    "screenplay",
    "tv_series_bible",
    "graphic_novel_script",
    "comic_script",
    "podcast_script",
    "audiobook_script",
}

ACADEMIC_PROJECT_TYPES = {
    "research_paper",
    "thesis_dissertation",
    "k12_textbook",
    "college_textbook",
    "academic_course",
    "technical_documentation",
    "legal_document",
}

NONFICTION_PROJECT_TYPES = {
    "memoir",
    "business_book",
    "management_book",
    "self_help_book",
    "personal_journal",
}

SONGWRITING_PROJECT_TYPES = {"songwriting_project"}

SYNOPSIS_MAX_TOKENS = {
    "one_page": 900,
    "three_page": 1800,
    "full": 2600,
}

SYNOPSIS_LENGTH_LABELS = {
    "one_page": "one-page",
    "three_page": "three-page",
    "full": "full-length",
}


def _resolve_outline_style(project_type: Optional[str]) -> str:
    """Map project type to an outline structure style."""
    normalized = (project_type or "").strip().lower()

    if normalized in SCREENPLAY_PROJECT_TYPES:
        return "screenplay"
    if normalized in ACADEMIC_PROJECT_TYPES:
        return "academic"
    if normalized in NONFICTION_PROJECT_TYPES:
        return "nonfiction"
    if normalized in SONGWRITING_PROJECT_TYPES:
        return "song"
    return "fiction"


def _default_outline_count_for_style(style: str) -> int:
    """Return sensible chapter/section counts by outline style."""
    defaults = {
        "fiction": 12,
        "nonfiction": 10,
        "academic": 8,
        "screenplay": 15,
        "song": 6,
    }
    return defaults.get(style, 10)


def _truncate_context_hint(value: Optional[str], max_words: int = 18) -> str:
    """Return a short context snippet for generated summaries."""
    if not value:
        return ""

    words = [part.strip() for part in value.split() if part.strip()]
    if not words:
        return ""

    if len(words) <= max_words:
        return " ".join(words)

    return " ".join(words[:max_words]) + "..."


def _part_for_outline(style: str, index: int, total: int) -> Tuple[Optional[int], Optional[str]]:
    """Resolve part metadata for a section by style and order."""
    if total <= 0:
        return None, None

    if style in {"fiction", "screenplay"}:
        ratio = (index + 1) / total
        if ratio <= 0.30:
            return 1, "Act I - Setup"
        if ratio <= 0.80:
            return 2, "Act II - Development"
        return 3, "Act III - Resolution"

    if style == "academic":
        unit_number = (index // 3) + 1
        return unit_number, f"Unit {unit_number}"

    if style == "nonfiction":
        part_number = (index // 4) + 1
        return part_number, f"Part {part_number}"

    if style == "song":
        return 1, "Composition"

    return None, None


def _outline_seed_sections(style: str) -> List[Dict[str, str]]:
    """Return seed sections for each outline style."""
    if style == "screenplay":
        return [
            {"title": "Opening Scene", "summary": "Establish visual tone, genre promise, and central question.", "chapter_type": "scene"},
            {"title": "Inciting Image", "summary": "Introduce disruption that forces the protagonist into motion.", "chapter_type": "scene"},
            {"title": "Refusal and Stakes", "summary": "Clarify what can be lost if the protagonist stays passive.", "chapter_type": "scene"},
            {"title": "Crossing the Threshold", "summary": "Commit to the story journey with a decisive action.", "chapter_type": "scene"},
            {"title": "Early Complication", "summary": "Show immediate fallout and raise dramatic pressure.", "chapter_type": "scene"},
            {"title": "Rising Opposition", "summary": "Escalate conflict with an active opposing force.", "chapter_type": "scene"},
            {"title": "Midpoint Turn", "summary": "Deliver a reveal or reversal that changes the plan.", "chapter_type": "scene"},
            {"title": "Counterattack", "summary": "Push characters into a stronger confrontation path.", "chapter_type": "scene"},
            {"title": "Internal Break", "summary": "Show emotional fracture or team breakdown.", "chapter_type": "scene"},
            {"title": "Lowest Point", "summary": "Force a major loss that appears to end success.", "chapter_type": "scene"},
            {"title": "New Commitment", "summary": "Characters regroup with a final strategy.", "chapter_type": "scene"},
            {"title": "Final Approach", "summary": "Set up the climactic confrontation.", "chapter_type": "scene"},
            {"title": "Climactic Confrontation", "summary": "Resolve the central dramatic conflict directly.", "chapter_type": "scene"},
            {"title": "Immediate Aftermath", "summary": "Show consequences of the climax on key relationships.", "chapter_type": "scene"},
            {"title": "Closing Image", "summary": "End with a transformed image that echoes the opening.", "chapter_type": "scene"},
        ]

    if style == "academic":
        return [
            {"title": "Abstract and Scope", "summary": "Define research scope, motivation, and expected contribution.", "chapter_type": "section"},
            {"title": "Background and Literature", "summary": "Summarize prior work and identify unresolved gaps.", "chapter_type": "section"},
            {"title": "Research Questions", "summary": "State hypotheses, assumptions, and evaluation criteria.", "chapter_type": "section"},
            {"title": "Methodology", "summary": "Describe methods, datasets, and procedural steps.", "chapter_type": "section"},
            {"title": "Implementation or Study Design", "summary": "Detail execution decisions and reproducibility factors.", "chapter_type": "section"},
            {"title": "Results and Analysis", "summary": "Present findings and interpret patterns with evidence.", "chapter_type": "section"},
            {"title": "Discussion and Limitations", "summary": "Critically assess implications, constraints, and alternatives.", "chapter_type": "section"},
            {"title": "Conclusion and Future Work", "summary": "Synthesize outcomes and propose next research directions.", "chapter_type": "section"},
        ]

    if style == "nonfiction":
        return [
            {"title": "Introduction", "summary": "Define the core problem and the reader promise.", "chapter_type": "chapter"},
            {"title": "Why This Matters", "summary": "Provide context and urgency with concrete stakes.", "chapter_type": "chapter"},
            {"title": "Core Principle 1", "summary": "Introduce the first major principle with examples.", "chapter_type": "chapter"},
            {"title": "Core Principle 2", "summary": "Deepen framework with practical application guidance.", "chapter_type": "chapter"},
            {"title": "Core Principle 3", "summary": "Address edge cases and implementation pitfalls.", "chapter_type": "chapter"},
            {"title": "Case Study", "summary": "Demonstrate outcomes using a detailed narrative example.", "chapter_type": "chapter"},
            {"title": "Execution Playbook", "summary": "Translate principles into repeatable actionable steps.", "chapter_type": "chapter"},
            {"title": "Sustaining Momentum", "summary": "Cover habits, metrics, and long-term consistency.", "chapter_type": "chapter"},
            {"title": "Advanced Strategies", "summary": "Provide higher-level tactics for experienced readers.", "chapter_type": "chapter"},
            {"title": "Conclusion", "summary": "Recap key takeaways and define the next commitment.", "chapter_type": "chapter"},
        ]

    if style == "song":
        return [
            {"title": "Verse 1", "summary": "Set perspective, imagery, and thematic hook.", "chapter_type": "section"},
            {"title": "Pre-Chorus", "summary": "Raise emotional tension toward the refrain.", "chapter_type": "section"},
            {"title": "Chorus", "summary": "Deliver core message with memorable phrasing.", "chapter_type": "section"},
            {"title": "Verse 2", "summary": "Advance narrative while varying imagery and detail.", "chapter_type": "section"},
            {"title": "Bridge", "summary": "Introduce contrast or revelation before final refrain.", "chapter_type": "section"},
            {"title": "Final Chorus and Outro", "summary": "Resolve tone and leave a lasting motif.", "chapter_type": "section"},
        ]

    return [
        {"title": "Opening Hook", "summary": "Establish setting, voice, and immediate narrative tension.", "chapter_type": "chapter"},
        {"title": "Inciting Incident", "summary": "Introduce the event that disrupts normal life.", "chapter_type": "chapter"},
        {"title": "First Commitment", "summary": "Show the protagonist choosing a risky direction.", "chapter_type": "chapter"},
        {"title": "New Terrain", "summary": "Expand the world and reveal new alliances and risks.", "chapter_type": "chapter"},
        {"title": "First Setback", "summary": "Deliver a meaningful failure that raises stakes.", "chapter_type": "chapter"},
        {"title": "Midpoint Reveal", "summary": "Introduce a turning revelation that reframes goals.", "chapter_type": "chapter"},
        {"title": "Escalation", "summary": "Increase pressure through external and internal conflict.", "chapter_type": "chapter"},
        {"title": "Fracture", "summary": "Show relationships and plans beginning to fail.", "chapter_type": "chapter"},
        {"title": "Lowest Point", "summary": "Force the hardest loss and deepest doubt.", "chapter_type": "chapter"},
        {"title": "Final Strategy", "summary": "Recommit with a focused plan for resolution.", "chapter_type": "chapter"},
        {"title": "Climax", "summary": "Resolve the central conflict at maximum intensity.", "chapter_type": "chapter"},
        {"title": "Resolution", "summary": "Close arcs and show the transformed status quo.", "chapter_type": "chapter"},
    ]


def _build_project_outline_sections(
    project_type: Optional[str],
    chapter_count: int,
    project_context: Optional[str],
) -> Tuple[str, List[Dict[str, Any]]]:
    """Generate deterministic outline sections for a project type."""
    style = _resolve_outline_style(project_type)
    seed_sections = _outline_seed_sections(style)
    sections: List[Dict[str, Any]] = []

    for index in range(chapter_count):
        if index < len(seed_sections):
            base = dict(seed_sections[index])
        else:
            section_number = index + 1
            if style == "screenplay":
                base = {
                    "title": f"Scene {section_number}: Story Beat",
                    "summary": "Advance conflict and reveal a new dramatic obstacle.",
                    "chapter_type": "scene",
                }
            elif style == "academic":
                base = {
                    "title": f"Section {section_number}: Supporting Analysis",
                    "summary": "Add supporting analysis and evidence for the thesis.",
                    "chapter_type": "section",
                }
            elif style == "song":
                base = {
                    "title": f"Section {section_number}: Motif Development",
                    "summary": "Evolve lyrical motif while preserving tonal continuity.",
                    "chapter_type": "section",
                }
            elif style == "nonfiction":
                base = {
                    "title": f"Chapter {section_number}: Applied Insight",
                    "summary": "Apply the framework to a practical scenario.",
                    "chapter_type": "chapter",
                }
            else:
                base = {
                    "title": f"Chapter {section_number}: Escalation Beat",
                    "summary": "Increase narrative stakes and character pressure.",
                    "chapter_type": "chapter",
                }

        part_number, part_title = _part_for_outline(style, index, chapter_count)
        base["part_number"] = part_number
        base["part_title"] = part_title
        sections.append(base)

    context_hint = _truncate_context_hint(project_context)
    if context_hint and sections:
        sections[0]["summary"] = (
            f"{sections[0]['summary']} Keep aligned with project context: {context_hint}"
        )
        if len(sections) > 1:
            sections[-1]["summary"] = (
                f"{sections[-1]['summary']} Resolve the core promise from project context."
            )

    return style, sections


def _chapter_synopsis_seed(chapter: Chapter) -> str:
    """Build a concise chapter seed text for synopsis generation."""
    for source in [chapter.summary, chapter.description, chapter.compiled_content]:
        cleaned = (source or "").strip()
        if cleaned:
            return _truncate_context_hint(cleaned, max_words=42)
    return "No chapter summary available yet."


def _chapter_synopsis_digest(book: Book) -> List[Dict[str, Any]]:
    """Build ordered chapter digest entries for synopsis prompts/fallbacks."""
    digest: List[Dict[str, Any]] = []

    for association in sorted(book.chapter_associations, key=lambda assoc: assoc.order_index):
        chapter = association.chapter
        if not chapter:
            continue

        digest.append(
            {
                "chapter_id": chapter.id,
                "order": association.order_index + 1,
                "title": chapter.title,
                "chapter_type": chapter.chapter_type,
                "summary": _chapter_synopsis_seed(chapter),
            }
        )

    return digest


def _fallback_project_synopsis(
    book_title: str,
    project_type: str,
    length: str,
    project_context: Optional[str],
    chapter_digest: List[Dict[str, Any]],
) -> str:
    """Generate deterministic synopsis text when AI generation is unavailable."""
    if not chapter_digest:
        base_context = _truncate_context_hint(project_context, max_words=30)
        context_sentence = (
            f"The core focus is {base_context}." if base_context else "The core narrative focus is still being refined."
        )
        return (
            f"{book_title} is a {project_type.replace('_', ' ')} project in active development. "
            f"{context_sentence} Add chapter drafts to unlock detailed synopsis generation."
        )

    opening = chapter_digest[0]
    middle = chapter_digest[len(chapter_digest) // 2]
    closing = chapter_digest[-1]
    context_hint = _truncate_context_hint(project_context, max_words=24)
    context_sentence = (
        f"Project context: {context_hint}." if context_hint else "Project context remains flexible while drafting evolves."
    )

    if length == "one_page":
        return "\n\n".join(
            [
                f"{book_title} is a {project_type.replace('_', ' ')} narrative that moves from '{opening['title']}' into a sustained escalation of stakes. {context_sentence}",
                f"The opening establishes {opening['summary']}",
                f"By the midpoint, '{middle['title']}' reframes the central objective through {middle['summary']}",
                f"The conclusion in '{closing['title']}' resolves the main arc through {closing['summary']}",
            ]
        )

    if length == "three_page":
        selected = chapter_digest[: min(10, len(chapter_digest))]
        paragraphs = [
            f"{book_title} unfolds as a {project_type.replace('_', ' ')} project with a clear progression from setup to resolution. {context_sentence}",
            "The developing arc follows these major beats:",
        ]

        paragraphs.extend(
            [
                f"{entry['order']}. {entry['title']}: {entry['summary']}"
                for entry in selected
            ]
        )

        if len(chapter_digest) > len(selected):
            paragraphs.append(
                "Additional later chapters continue this trajectory with deeper complications and final synthesis."
            )

        return "\n\n".join(paragraphs)

    sections = chapter_digest[: min(18, len(chapter_digest))]
    lines = [
        f"{book_title} - Full Synopsis Draft",
        f"Project type: {project_type.replace('_', ' ')}",
        context_sentence,
        "",
    ]
    lines.extend(
        [
            f"{entry['order']}. {entry['title']} ({entry['chapter_type']}): {entry['summary']}"
            for entry in sections
        ]
    )

    if len(chapter_digest) > len(sections):
        lines.append("")
        lines.append("Further chapters continue the progression with expanded detail and closing resolution beats.")

    return "\n".join(lines).strip()


@router.get(
    "",
    response_model=PaginatedResponse[BookListResponse],
    summary="List books",
)
async def list_books(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_type: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    pinned: Optional[bool] = Query(None),
    sort_by: str = Query("updated_at", pattern="^(updated_at|created_at|title|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """
    List all books for the authenticated user.
    """
    query = select(Book).where(Book.user_id == user_id)

    if status_filter:
        requested_statuses = [item.strip() for item in status_filter.split(",") if item.strip()]
        if requested_statuses:
            query = query.where(Book.status.in_(requested_statuses))

    if project_type:
        query = query.where(
            or_(
                Book.project_type == project_type,
                Book.book_type == project_type,
            )
        )

    if genre:
        query = query.where(Book.genres.any(genre))

    if pinned is not None:
        query = query.where(Book.is_pinned == pinned)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    sort_map = {
        "updated_at": Book.updated_at,
        "created_at": Book.created_at,
        "title": Book.title,
        "status": Book.status,
    }
    sort_column = sort_map.get(sort_by, Book.updated_at)
    sort_direction = asc if sort_order == "asc" else desc
    query = query.order_by(Book.is_pinned.desc(), sort_direction(sort_column))
    query = query.offset((page - 1) * limit).limit(limit)
    query = query.options(
        selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
    )

    result = await db.execute(query)
    books = result.scalars().all()

    items = []
    for b in books:
        word_count = b.word_count
        items.append(
            BookListResponse(
                id=b.id,
                title=b.title,
                subtitle=b.subtitle,
                author_name=b.author_name,
                cover_image_url=b.cover_image_url,
                cover_color=b.cover_color,
                project_context=b.project_context,
                project_type=b.project_type or b.book_type,
                genres=b.genres,
                labels=b.labels,
                target_word_count=b.target_word_count,
                target_progress_percent=_target_progress_percent(word_count, b.target_word_count),
                deadline_at=b.deadline_at,
                is_pinned=b.is_pinned,
                default_writing_form=b.default_writing_form,
                default_chapter_tone=b.default_chapter_tone,
                ai_enhancement_enabled=b.ai_enhancement_enabled,
                book_type=b.book_type,
                status=b.status,
                word_count=word_count,
                chapter_count=len(b.chapter_associations),
                created_at=b.created_at,
                updated_at=b.updated_at,
            )
        )

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "",
    response_model=BookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create book",
)
async def create_book(
    book_data: BookCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a new book.
    """
    requested_status = (book_data.status or BookStatus.IN_PROGRESS.value).lower()
    valid_statuses = {status.value for status in BookStatus}
    if requested_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid book status: {requested_status}",
        )

    resolved_genres = book_data.genres
    if not resolved_genres and book_data.genre:
        resolved_genres = [book_data.genre]

    book = Book(
        title=book_data.title,
        subtitle=book_data.subtitle,
        author_name=book_data.author_name,
        description=book_data.description,
        project_context=book_data.project_context,
        project_settings=book_data.project_settings,
        project_metadata=book_data.metadata,
        cover_image_url=book_data.cover_image_url,
        cover_color=book_data.cover_color,
        project_type=book_data.project_type or book_data.book_type,
        book_type=book_data.book_type or book_data.project_type,
        genres=resolved_genres,
        tags=book_data.tags,
        labels=book_data.labels,
        target_word_count=book_data.target_word_count,
        deadline_at=book_data.deadline_at,
        is_pinned=bool(book_data.is_pinned),
        default_writing_form=book_data.default_writing_form,
        default_chapter_tone=book_data.default_chapter_tone,
        ai_enhancement_enabled=book_data.ai_enhancement_enabled,
        status=requested_status,
        user_id=user_id,
    )

    db.add(book)
    await db.flush()

    # Add chapters if provided
    chapter_count = 0
    chapter_word_count = 0

    if book_data.auto_create_chapters > 0:
        max_number_result = await db.execute(
            select(func.max(Chapter.chapter_number)).where(Chapter.user_id == user_id)
        )
        next_chapter_number = (max_number_result.scalar() or 0) + 1

        max_order_result = await db.execute(
            select(func.max(Chapter.order_index)).where(Chapter.user_id == user_id)
        )
        next_order_index = (max_order_result.scalar() or 0) + 1

        for index in range(book_data.auto_create_chapters):
            chapter = Chapter(
                title=f"Chapter {next_chapter_number + index}",
                chapter_number=next_chapter_number + index,
                order_index=next_order_index + index,
                writing_style=book.default_writing_form,
                tone=book.default_chapter_tone,
                ai_enhancement_enabled=book.ai_enhancement_enabled,
                status=ChapterStatus.DRAFT.value,
                user_id=user_id,
            )
            db.add(chapter)
            await db.flush()

            db.add(
                BookChapter(
                    book_id=book.id,
                    chapter_id=chapter.id,
                    order_index=index,
                )
            )
            chapter_count += 1

    if book_data.chapter_ids:
        initial_index = chapter_count
        for idx, chapter_id in enumerate(book_data.chapter_ids):
            # Verify chapter belongs to user
            chapter_result = await db.execute(
                select(Chapter).where(
                    Chapter.id == chapter_id, Chapter.user_id == user_id
                )
            )
            chapter = chapter_result.scalar_one_or_none()
            if chapter:
                conflict_result = await db.execute(
                    select(BookChapter).where(BookChapter.chapter_id == chapter_id)
                )
                conflict = conflict_result.scalar_one_or_none()
                if conflict:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Chapter '{chapter.title}' is already linked to another project",
                    )

                book_chapter = BookChapter(
                    book_id=book.id,
                    chapter_id=chapter_id,
                    order_index=initial_index + idx,
                )
                db.add(book_chapter)
                chapter_count += 1
                chapter_word_count += chapter.word_count

    await db.flush()
    await db.refresh(book)

    total_word_count = chapter_word_count + _book_matter_word_count(book)

    return BookResponse(
        id=book.id,
        title=book.title,
        subtitle=book.subtitle,
        author_name=book.author_name,
        description=book.description,
        project_context=book.project_context,
        project_settings=book.project_settings,
        cover_image_url=book.cover_image_url,
        cover_color=book.cover_color,
        project_type=book.project_type or book.book_type,
        metadata=book.project_metadata,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
        labels=book.labels,
        target_word_count=book.target_word_count,
        target_progress_percent=_target_progress_percent(total_word_count, book.target_word_count),
        deadline_at=book.deadline_at,
        is_pinned=book.is_pinned,
        default_writing_form=book.default_writing_form,
        default_chapter_tone=book.default_chapter_tone,
        ai_enhancement_enabled=book.ai_enhancement_enabled,
        status=book.status,
        is_public=book.is_public,
        word_count=total_word_count,
        chapter_count=chapter_count,
        last_exported_at=book.last_exported_at,
        last_export_format=book.last_export_format,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.get(
    "/{book_id}",
    response_model=BookDetailResponse,
    summary="Get book details",
)
async def get_book(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get full book details with chapters.
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Build chapters list
    chapters = []
    for assoc in sorted(book.chapter_associations, key=lambda x: x.order_index):
        chapter = assoc.chapter
        chapters.append(
            BookChapterResponse(
                chapter_id=chapter.id,
                order_index=assoc.order_index,
                part_number=assoc.part_number,
                part_title=assoc.part_title,
                chapter=ChapterListResponse(
                    id=chapter.id,
                    title=chapter.title,
                    subtitle=chapter.subtitle,
                    summary=chapter.summary,
                    chapter_number=chapter.chapter_number,
                    chapter_type=chapter.chapter_type,
                    workflow_status=chapter.workflow_status,
                    word_count_target=chapter.word_count_target,
                    target_progress_percent=chapter.target_progress_percent,
                    timeline_position=chapter.timeline_position,
                    status=chapter.status,
                    word_count=chapter.word_count,
                    event_count=0,  # TODO: Load this properly
                    created_at=chapter.created_at,
                ),
            )
        )

    return BookDetailResponse(
        id=book.id,
        title=book.title,
        subtitle=book.subtitle,
        author_name=book.author_name,
        description=book.description,
        project_context=book.project_context,
        project_settings=book.project_settings,
        cover_image_url=book.cover_image_url,
        cover_color=book.cover_color,
        project_type=book.project_type or book.book_type,
        metadata=book.project_metadata,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
        labels=book.labels,
        target_word_count=book.target_word_count,
        target_progress_percent=book.target_progress_percent,
        deadline_at=book.deadline_at,
        is_pinned=book.is_pinned,
        default_writing_form=book.default_writing_form,
        default_chapter_tone=book.default_chapter_tone,
        ai_enhancement_enabled=book.ai_enhancement_enabled,
        status=book.status,
        is_public=book.is_public,
        word_count=book.word_count,
        chapter_count=len(book.chapter_associations),
        last_exported_at=book.last_exported_at,
        last_export_format=book.last_export_format,
        dedication=book.dedication,
        acknowledgments=book.acknowledgments,
        preface=book.preface,
        introduction=book.introduction,
        epilogue=book.epilogue,
        afterword=book.afterword,
        about_author=book.about_author,
        chapters=chapters,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.put(
    "/{book_id}",
    response_model=BookResponse,
    summary="Update book",
)
@router.patch(
    "/{book_id}",
    response_model=BookResponse,
    summary="Partially update book",
)
async def update_book(
    book_id: uuid.UUID,
    book_data: BookUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update book metadata.
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    update_data = book_data.model_dump(exclude_unset=True)

    if "project_type" in update_data and "book_type" not in update_data:
        update_data["book_type"] = update_data["project_type"]
    elif "book_type" in update_data and "project_type" not in update_data:
        update_data["project_type"] = update_data["book_type"]

    if "metadata" in update_data and "project_metadata" not in update_data:
        update_data["project_metadata"] = update_data["metadata"]
    update_data.pop("metadata", None)

    if "genre" in update_data and "genres" not in update_data:
        update_data["genres"] = [update_data["genre"]] if update_data["genre"] else None
    update_data.pop("genre", None)

    for field, value in update_data.items():
        setattr(book, field, value)

    await db.flush()
    await db.refresh(book)

    return BookResponse(
        id=book.id,
        title=book.title,
        subtitle=book.subtitle,
        author_name=book.author_name,
        description=book.description,
        project_context=book.project_context,
        project_settings=book.project_settings,
        cover_image_url=book.cover_image_url,
        cover_color=book.cover_color,
        project_type=book.project_type or book.book_type,
        metadata=book.project_metadata,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
        labels=book.labels,
        target_word_count=book.target_word_count,
        target_progress_percent=book.target_progress_percent,
        deadline_at=book.deadline_at,
        is_pinned=book.is_pinned,
        default_writing_form=book.default_writing_form,
        default_chapter_tone=book.default_chapter_tone,
        ai_enhancement_enabled=book.ai_enhancement_enabled,
        status=book.status,
        is_public=book.is_public,
        word_count=book.word_count,
        chapter_count=len(book.chapter_associations),
        last_exported_at=book.last_exported_at,
        last_export_format=book.last_export_format,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.put(
    "/{book_id}/front-matter",
    response_model=BookDetailResponse,
    summary="Update front matter",
)
@router.patch(
    "/{book_id}/front-matter",
    response_model=BookDetailResponse,
    summary="Partially update front matter",
)
async def update_front_matter(
    book_id: uuid.UUID,
    front_matter: BookFrontMatterUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update book front matter (dedication, acknowledgments, preface, introduction).
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    update_data = front_matter.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)

    await db.flush()
    await db.refresh(book)

    # Return full detail response
    return await get_book(book_id, user_id, db)


@router.put(
    "/{book_id}/back-matter",
    response_model=BookDetailResponse,
    summary="Update back matter",
)
@router.patch(
    "/{book_id}/back-matter",
    response_model=BookDetailResponse,
    summary="Partially update back matter",
)
async def update_back_matter(
    book_id: uuid.UUID,
    back_matter: BookBackMatterUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update book back matter (epilogue, afterword, about author).
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    update_data = back_matter.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)

    await db.flush()
    await db.refresh(book)

    # Return full detail response
    return await get_book(book_id, user_id, db)


@router.delete(
    "/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete book",
)
async def delete_book(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete a book.
    """
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    await db.delete(book)


@router.post(
    "/{book_id}/duplicate",
    response_model=BookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate book",
)
async def duplicate_book(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Duplicate a project and keep chapter links/order."""
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    source_book = result.scalar_one_or_none()

    if not source_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    copied_title = f"{source_book.title} (Copy)"
    if len(copied_title) > 255:
        copied_title = f"{source_book.title[:248]} (Copy)"

    duplicate = Book(
        title=copied_title,
        subtitle=source_book.subtitle,
        author_name=source_book.author_name,
        description=source_book.description,
        project_context=source_book.project_context,
        project_settings=source_book.project_settings,
        project_metadata=source_book.project_metadata,
        cover_image_url=source_book.cover_image_url,
        cover_color=source_book.cover_color,
        project_type=source_book.project_type,
        book_type=source_book.book_type,
        genres=source_book.genres,
        tags=source_book.tags,
        labels=source_book.labels,
        target_word_count=source_book.target_word_count,
        deadline_at=source_book.deadline_at,
        default_writing_form=source_book.default_writing_form,
        default_chapter_tone=source_book.default_chapter_tone,
        ai_enhancement_enabled=source_book.ai_enhancement_enabled,
        status=BookStatus.DRAFT.value,
        is_public=False,
        is_pinned=False,
        dedication=source_book.dedication,
        acknowledgments=source_book.acknowledgments,
        preface=source_book.preface,
        introduction=source_book.introduction,
        epilogue=source_book.epilogue,
        afterword=source_book.afterword,
        about_author=source_book.about_author,
        user_id=user_id,
    )
    db.add(duplicate)
    await db.flush()

    for assoc in sorted(source_book.chapter_associations, key=lambda item: item.order_index):
        db.add(
            BookChapter(
                book_id=duplicate.id,
                chapter_id=assoc.chapter_id,
                order_index=assoc.order_index,
                part_number=assoc.part_number,
                part_title=assoc.part_title,
            )
        )

    await db.flush()
    await db.refresh(duplicate)

    # Use source counts because chapter associations are duplicated one-to-one.
    source_word_count = source_book.word_count
    source_chapter_count = len(source_book.chapter_associations)

    return BookResponse(
        id=duplicate.id,
        title=duplicate.title,
        subtitle=duplicate.subtitle,
        author_name=duplicate.author_name,
        description=duplicate.description,
        project_context=duplicate.project_context,
        project_settings=duplicate.project_settings,
        cover_image_url=duplicate.cover_image_url,
        cover_color=duplicate.cover_color,
        project_type=duplicate.project_type or duplicate.book_type,
        metadata=duplicate.project_metadata,
        book_type=duplicate.book_type,
        genres=duplicate.genres,
        tags=duplicate.tags,
        labels=duplicate.labels,
        target_word_count=duplicate.target_word_count,
        target_progress_percent=_target_progress_percent(source_word_count, duplicate.target_word_count),
        deadline_at=duplicate.deadline_at,
        is_pinned=duplicate.is_pinned,
        default_writing_form=duplicate.default_writing_form,
        default_chapter_tone=duplicate.default_chapter_tone,
        ai_enhancement_enabled=duplicate.ai_enhancement_enabled,
        status=duplicate.status,
        is_public=duplicate.is_public,
        word_count=source_word_count,
        chapter_count=source_chapter_count,
        last_exported_at=duplicate.last_exported_at,
        last_export_format=duplicate.last_export_format,
        created_at=duplicate.created_at,
        updated_at=duplicate.updated_at,
    )


@router.post(
    "/{book_id}/archive",
    response_model=MessageResponse,
    summary="Archive book",
)
async def archive_book(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Archive a project."""
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    book.status = BookStatus.ARCHIVED.value
    await db.flush()
    return MessageResponse(message="Project archived")


@router.post(
    "/{book_id}/restore",
    response_model=MessageResponse,
    summary="Restore archived book",
)
async def restore_book(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Restore an archived project to active work."""
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    book.status = BookStatus.IN_PROGRESS.value
    await db.flush()
    return MessageResponse(message="Project restored")


@router.post(
    "/{book_id}/pin",
    response_model=MessageResponse,
    summary="Pin or unpin book",
)
async def pin_book(
    book_id: uuid.UUID,
    payload: BookPinUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Pin/unpin a project for priority placement."""
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    book.is_pinned = payload.is_pinned
    await db.flush()
    return MessageResponse(message="Project pin status updated")


@router.post(
    "/{book_id}/apply-template",
    response_model=MessageResponse,
    summary="Apply template to book",
)
async def apply_template_to_book(
    book_id: uuid.UUID,
    template_data: BookTemplateApplyRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Apply a project template by creating and linking starter chapters."""
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(selectinload(Book.chapter_associations))
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    template = get_project_template(template_data.template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    template_project_type = template.get("project_type")
    book_project_type = book.project_type or book.book_type
    if (
        template_project_type
        and book_project_type
        and template_project_type != book_project_type
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Template '{template.get('name')}' expects project type "
                f"'{template_project_type}', but project uses '{book_project_type}'"
            ),
        )

    existing_associations = list(book.chapter_associations)
    if template_data.replace_existing and existing_associations:
        existing_chapter_ids = [assoc.chapter_id for assoc in existing_associations]
        chapters_result = await db.execute(
            select(Chapter).where(
                Chapter.id.in_(existing_chapter_ids),
                Chapter.user_id == user_id,
            )
        )
        for chapter in chapters_result.scalars().all():
            await db.delete(chapter)
        await db.flush()
        await db.refresh(book, attribute_names=["chapter_associations"])

    max_chapter_number_result = await db.execute(
        select(func.max(Chapter.chapter_number)).where(Chapter.user_id == user_id)
    )
    next_chapter_number = (max_chapter_number_result.scalar() or 0) + 1

    max_order_result = await db.execute(
        select(func.max(Chapter.order_index)).where(Chapter.user_id == user_id)
    )
    next_order_index = (max_order_result.scalar() or 0) + 1

    current_book_max_order = max(
        [assoc.order_index for assoc in book.chapter_associations],
        default=-1,
    )
    book_order_start = current_book_max_order + 1

    chapter_structure = template.get("chapter_structure") or []
    created_count = 0

    for idx, chapter_template in enumerate(chapter_structure):
        chapter = Chapter(
            title=chapter_template.get("title") or f"Chapter {next_chapter_number + idx}",
            chapter_number=next_chapter_number + idx,
            order_index=next_order_index + idx,
            chapter_type=chapter_template.get("chapter_type") or "chapter",
            writing_style=book.default_writing_form,
            tone=book.default_chapter_tone,
            ai_enhancement_enabled=book.ai_enhancement_enabled,
            status=ChapterStatus.DRAFT.value,
            user_id=user_id,
        )
        db.add(chapter)
        await db.flush()

        db.add(
            BookChapter(
                book_id=book.id,
                chapter_id=chapter.id,
                order_index=book_order_start + idx,
                part_number=chapter_template.get("part_number")
                if template_data.include_parts
                else None,
                part_title=chapter_template.get("part_title")
                if template_data.include_parts
                else None,
            )
        )
        created_count += 1

    current_metadata = book.project_metadata or {}
    template_initial_metadata = template.get("initial_metadata") or {}
    book.project_metadata = {
        **current_metadata,
        **template_initial_metadata,
        "template_id": template.get("id"),
        "template_name": template.get("name"),
        "template_chapter_count": template.get("chapter_count") or created_count,
        "template_applied_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.flush()

    return MessageResponse(
        message=f"Applied template '{template.get('name')}' with {created_count} sections"
    )


@router.post(
    "/{book_id}/generate-outline",
    response_model=BookOutlineResponse,
    summary="Generate project outline",
)
async def generate_project_outline(
    book_id: uuid.UUID,
    payload: BookOutlineGenerateRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Generate project-level outline sections and optionally create chapter drafts."""
    if payload.replace_existing and not payload.auto_create_chapters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="replace_existing requires auto_create_chapters=true",
        )

    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    project_type = book.project_type or book.book_type or "novel"
    style = _resolve_outline_style(project_type)
    chapter_count = payload.chapter_count or _default_outline_count_for_style(style)
    style, sections_data = _build_project_outline_sections(
        project_type=project_type,
        chapter_count=chapter_count,
        project_context=book.project_context or book.description,
    )

    generated_at = datetime.now(timezone.utc)
    created_chapter_ids: List[uuid.UUID] = []

    if payload.auto_create_chapters:
        if payload.replace_existing and book.chapter_associations:
            existing_chapter_ids = [assoc.chapter_id for assoc in book.chapter_associations]
            chapters_result = await db.execute(
                select(Chapter).where(
                    Chapter.id.in_(existing_chapter_ids),
                    Chapter.user_id == user_id,
                )
            )
            for chapter in chapters_result.scalars().all():
                await db.delete(chapter)
            await db.flush()
            await db.refresh(book, attribute_names=["chapter_associations"])

        max_chapter_number_result = await db.execute(
            select(func.max(Chapter.chapter_number)).where(Chapter.user_id == user_id)
        )
        next_chapter_number = (max_chapter_number_result.scalar() or 0) + 1

        max_order_result = await db.execute(
            select(func.max(Chapter.order_index)).where(Chapter.user_id == user_id)
        )
        next_order_index = (max_order_result.scalar() or 0) + 1

        current_book_max_order = max(
            [assoc.order_index for assoc in book.chapter_associations],
            default=-1,
        )
        book_order_start = current_book_max_order + 1

        for idx, section in enumerate(sections_data):
            chapter = Chapter(
                title=section["title"],
                summary=section["summary"],
                chapter_number=next_chapter_number + idx,
                order_index=next_order_index + idx,
                chapter_type=section.get("chapter_type") or "chapter",
                workflow_status=ChapterWorkflowStatus.OUTLINE.value,
                writing_style=book.default_writing_form,
                tone=book.default_chapter_tone,
                ai_enhancement_enabled=book.ai_enhancement_enabled,
                status=ChapterStatus.DRAFT.value,
                user_id=user_id,
            )
            db.add(chapter)
            await db.flush()

            created_chapter_ids.append(chapter.id)

            db.add(
                BookChapter(
                    book_id=book.id,
                    chapter_id=chapter.id,
                    order_index=book_order_start + idx,
                    part_number=section.get("part_number"),
                    part_title=section.get("part_title"),
                )
            )

        await db.flush()

    current_metadata = book.project_metadata or {}
    book.project_metadata = {
        **current_metadata,
        "last_outline_generated_at": generated_at.isoformat(),
        "last_outline_chapter_count": chapter_count,
        "last_outline_style": style,
        "last_outline_project_type": project_type,
        "last_outline_auto_created": payload.auto_create_chapters,
        "last_outline_created_count": len(created_chapter_ids),
    }
    await db.flush()

    sections = [
        BookOutlineSection(
            order_index=index + 1,
            title=section["title"],
            summary=section["summary"],
            chapter_type=section.get("chapter_type") or "chapter",
            part_number=section.get("part_number"),
            part_title=section.get("part_title"),
        )
        for index, section in enumerate(sections_data)
    ]

    if payload.auto_create_chapters:
        message = (
            f"Generated {chapter_count} outline section(s) and created "
            f"{len(created_chapter_ids)} chapter draft(s)."
        )
    else:
        message = (
            f"Generated {chapter_count} outline section(s). "
            "Set auto_create_chapters=true to create chapter drafts from this outline."
        )

    return BookOutlineResponse(
        book_id=book.id,
        project_type=project_type,
        generated_at=generated_at,
        chapter_count=chapter_count,
        sections=sections,
        created_chapter_ids=created_chapter_ids,
        message=message,
    )


@router.post(
    "/{book_id}/generate-synopsis",
    response_model=BookSynopsisResponse,
    summary="Generate project synopsis",
)
async def generate_project_synopsis(
    book_id: uuid.UUID,
    payload: BookSynopsisGenerateRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Generate a project synopsis for pitch and planning workflows."""
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    chapter_digest = _chapter_synopsis_digest(book)
    if not chapter_digest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one chapter before generating a synopsis",
        )

    project_type = book.project_type or book.book_type or "novel"
    synopsis_length = payload.length
    context_hint = _truncate_context_hint(book.project_context or book.description, max_words=36)

    chapter_digest_text = "\n".join(
        [
            f"{entry['order']}. {entry['title']} ({entry['chapter_type']}): {entry['summary']}"
            for entry in chapter_digest[:36]
        ]
    )

    synopsis_text = ""
    try:
        gemini = get_gemini_service()
        synopsis_text = await gemini.generate(
            prompt=(
                "Generate a polished project synopsis suitable for pitching and planning. "
                f"Length target: {SYNOPSIS_LENGTH_LABELS[synopsis_length]}.\n"
                "Preserve factual chapter progression and avoid introducing unsupported plot points.\n\n"
                f"Project title: {book.title}\n"
                f"Project type: {project_type}\n"
                f"Project context: {context_hint or 'Not provided'}\n\n"
                "Chapter digest:\n"
                f"{chapter_digest_text}"
            ),
            system_instruction=(
                "You are an editorial synopsis assistant. Produce clear, market-ready synopsis prose "
                "with coherent arc progression and no fabricated details beyond provided chapter signals."
            ),
            temperature=0.45,
            max_tokens=SYNOPSIS_MAX_TOKENS[synopsis_length],
        )
    except Exception:
        synopsis_text = ""

    if synopsis_text and synopsis_text.strip():
        synopsis_text = re.sub(r"\n{3,}", "\n\n", synopsis_text.strip())
    else:
        synopsis_text = _fallback_project_synopsis(
            book_title=book.title,
            project_type=project_type,
            length=synopsis_length,
            project_context=book.project_context or book.description,
            chapter_digest=chapter_digest,
        )

    generated_at = datetime.now(timezone.utc)
    current_metadata = book.project_metadata or {}
    synopsis_metadata = current_metadata.get("generated_synopsis")
    if not isinstance(synopsis_metadata, dict):
        synopsis_metadata = {}

    synopsis_metadata[synopsis_length] = {
        "text": synopsis_text,
        "generated_at": generated_at.isoformat(),
        "chapter_count": len(chapter_digest),
    }

    book.project_metadata = {
        **current_metadata,
        "generated_synopsis": synopsis_metadata,
        "last_synopsis_generated_at": generated_at.isoformat(),
        "last_synopsis_length": synopsis_length,
    }

    await db.flush()

    return BookSynopsisResponse(
        book_id=book.id,
        length=synopsis_length,
        synopsis=synopsis_text,
        generated_at=generated_at,
        chapter_count=len(chapter_digest),
        message=f"Generated {SYNOPSIS_LENGTH_LABELS[synopsis_length]} synopsis.",
    )


@router.post(
    "/{book_id}/chapters",
    response_model=MessageResponse,
    summary="Add chapters to book",
)
async def add_chapters_to_book(
    book_id: uuid.UUID,
    chapter_data: BookChapterAdd,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Add chapters to a book.
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(selectinload(Book.chapter_associations))
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get current max order
    max_order = max([bc.order_index for bc in book.chapter_associations], default=-1)

    added_count = 0
    for chapter_id in chapter_data.chapter_ids:
        # Verify chapter belongs to user and not already in book
        chapter_result = await db.execute(
            select(Chapter).where(
                Chapter.id == chapter_id, Chapter.user_id == user_id
            )
        )
        chapter = chapter_result.scalar_one_or_none()
        if chapter:
            existing_other_project = await db.execute(
                select(BookChapter).where(
                    BookChapter.chapter_id == chapter_id,
                    BookChapter.book_id != book_id,
                )
            )
            if existing_other_project.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Chapter '{chapter.title}' is already linked to another project",
                )

            # Check if already in book
            existing = await db.execute(
                select(BookChapter).where(
                    BookChapter.book_id == book_id,
                    BookChapter.chapter_id == chapter_id,
                )
            )
            if not existing.scalar_one_or_none():
                max_order += 1
                book_chapter = BookChapter(
                    book_id=book_id,
                    chapter_id=chapter_id,
                    order_index=max_order,
                )
                db.add(book_chapter)
                added_count += 1

    await db.flush()

    return MessageResponse(message=f"Added {added_count} chapters to book")


@router.delete(
    "/{book_id}/chapters/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove chapter from book",
)
async def remove_chapter_from_book(
    book_id: uuid.UUID,
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Remove a chapter from a book.
    """
    # Verify book belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    if not book_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Find and delete the association
    result = await db.execute(
        select(BookChapter).where(
            BookChapter.book_id == book_id,
            BookChapter.chapter_id == chapter_id,
        )
    )
    book_chapter = result.scalar_one_or_none()

    if book_chapter:
        await db.delete(book_chapter)


@router.post(
    "/{book_id}/chapters/reorder",
    response_model=MessageResponse,
    summary="Reorder chapters in book",
)
@router.put(
    "/{book_id}/chapters/reorder",
    response_model=MessageResponse,
    summary="Reorder chapters in book",
)
@router.patch(
    "/{book_id}/chapters/reorder",
    response_model=MessageResponse,
    summary="Partially reorder chapters in book",
)
async def reorder_book_chapters(
    book_id: uuid.UUID,
    reorder_data: BookChapterReorder,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reorder chapters within a book.
    """
    # Verify book belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    if not book_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    if reorder_data.chapter_orders:
        for item in reorder_data.chapter_orders:
            result = await db.execute(
                select(BookChapter).where(
                    BookChapter.book_id == book_id,
                    BookChapter.chapter_id == item.chapter_id,
                )
            )
            book_chapter = result.scalar_one_or_none()
            if book_chapter:
                book_chapter.order_index = item.order_index
    else:
        for idx, chapter_id in enumerate(reorder_data.chapter_ids or []):
            result = await db.execute(
                select(BookChapter).where(
                    BookChapter.book_id == book_id,
                    BookChapter.chapter_id == chapter_id,
                )
            )
            book_chapter = result.scalar_one_or_none()
            if book_chapter:
                book_chapter.order_index = idx

    await db.flush()

    return MessageResponse(message="Chapters reordered successfully")


@router.post(
    "/{book_id}/export",
    response_model=BookExportResponse,
    summary="Export book",
)
async def export_book(
    book_id: uuid.UUID,
    export_data: BookExportRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Export book to specified format.
    """
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id, Book.user_id == user_id)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    if not book.chapter_associations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Book has no chapters to export",
        )

    from app.tasks.export_tasks import _export_book_async

    export_options = export_data.model_dump(exclude={"format"})
    export_result = await _export_book_async(
        book_id=str(book_id),
        user_id=str(user_id),
        export_format=export_data.format,
        options=export_options,
    )

    if "error" in export_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {export_result['error']}",
        )

    filename = export_result.get("filename")
    file_size = int(export_result.get("file_size") or 0)
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export failed: missing output filename",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    return BookExportResponse(
        id=book.id,
        format=export_data.format,
        download_url=f"/api/v1/books/{book_id}/download/{filename}",
        file_size=file_size,
        expires_at=expires_at,
        message=f"Book exported to {export_data.format.upper()} successfully.",
    )


@router.get(
    "/{book_id}/download/{filename}",
    summary="Download exported book file",
)
async def download_exported_book(
    book_id: uuid.UUID,
    filename: str,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Download an exported file for a book.
    """
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    export_dir = os.path.abspath(
        os.path.join(settings.LOCAL_STORAGE_PATH, "exports", str(user_id))
    )
    requested_path = os.path.abspath(os.path.join(export_dir, filename))

    # Guard against path traversal.
    if not requested_path.startswith(f"{export_dir}{os.sep}"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename",
        )

    if not os.path.exists(requested_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file not found",
        )

    return FileResponse(
        path=requested_path,
        filename=filename,
        media_type="application/octet-stream",
    )
