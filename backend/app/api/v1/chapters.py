"""
Chapters API Routes

Handles chapter management and compilation.
"""

import uuid
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher, unified_diff
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import BookChapter
from app.models.chapter import Chapter, ChapterEvent, ChapterStatus, ChapterWorkflowStatus
from app.models.chapter_version import ChapterVersion
from app.models.event import Event
from app.models.user import User
from app.services.llm.gemini_service import get_gemini_service
from app.schemas.chapter import (
    ChapterChatRequest,
    ChapterChatResponse,
    ChapterCompileRequest,
    ChapterCompileResponse,
    ChapterConsistencyResponse,
    ChapterEntityExtractionResponse,
    ChapterExpandNotesRequest,
    ChapterExpandNotesResponse,
    ChapterSummaryResponse,
    ChapterOutlineResponse,
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
    ConsistencyIssue,
    ConsistencyIssueReference,
    ExtractedEntity,
    ExtractedEntityReference,
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

MONTH_ALIASES: Dict[str, str] = {
    "jan": "january",
    "january": "january",
    "feb": "february",
    "february": "february",
    "mar": "march",
    "march": "march",
    "apr": "april",
    "april": "april",
    "may": "may",
    "jun": "june",
    "june": "june",
    "jul": "july",
    "july": "july",
    "aug": "august",
    "august": "august",
    "sep": "september",
    "sept": "september",
    "september": "september",
    "oct": "october",
    "october": "october",
    "nov": "november",
    "november": "november",
    "dec": "december",
    "december": "december",
}

BASE_CONSISTENCY_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "if",
    "then",
    "this",
    "that",
    "these",
    "those",
    "while",
    "when",
    "where",
    "after",
    "before",
    "during",
    "through",
    "into",
    "onto",
    "within",
    "without",
    "because",
    "however",
    "therefore",
    "chapter",
    "part",
    "section",
    "scene",
    "event",
    "story",
    "memoir",
    "book",
    "project",
    "draft",
    "outline",
    "summary",
    "today",
    "tomorrow",
    "yesterday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "spring",
    "summer",
    "autumn",
    "fall",
    "winter",
    "north",
    "south",
    "east",
    "west",
}
CONSISTENCY_STOPWORDS = BASE_CONSISTENCY_STOPWORDS.union(set(MONTH_ALIASES.keys()))

YEAR_MENTION_PATTERN = re.compile(r"\b(1[6-9]\d{2}|20\d{2}|2100)\b")
MONTH_PATTERN_FRAGMENT = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)
DATE_WITH_YEAR_PATTERN = re.compile(
    rf"\b({MONTH_PATTERN_FRAGMENT})\s+(\d{{1,2}}),\s*(1[6-9]\d{{2}}|20\d{{2}}|2100)\b",
    re.IGNORECASE,
)
LOCATION_MENTION_PATTERN = re.compile(
    r"\b(?:in|at|from|to|into|near|around|inside|outside|across|toward|towards|within)\s+"
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b"
)
OBJECT_MENTION_PATTERN = re.compile(
    r"\b(?:the|a|an)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b"
)

TERMINOLOGY_CONFLICT_PAIRS: List[Tuple[str, str]] = [
    ("internet", "web"),
    ("application", "app"),
    ("customer", "user"),
]

APPEARANCE_COLOR_NORMALIZATION: Dict[str, str] = {
    "black": "black",
    "brown": "brown",
    "blonde": "blonde",
    "blond": "blonde",
    "red": "red",
    "auburn": "auburn",
    "gray": "gray",
    "grey": "gray",
    "white": "white",
    "silver": "silver",
    "gold": "gold",
    "golden": "gold",
    "ginger": "ginger",
    "hazel": "hazel",
    "amber": "amber",
    "blue": "blue",
    "green": "green",
    "violet": "violet",
}

CHARACTER_APPEARANCE_PATTERNS = [
    re.compile(
        r"\b(?P<name>[A-Z][a-z]{2,})\s+"
        r"(?:has|had|with|wears|wore)\s+"
        r"(?:[a-z]+\s+){0,3}?"
        r"(?P<color>[A-Za-z]+)\s+"
        r"(?P<attribute>hair|eyes?)\b"
    ),
    re.compile(
        r"\b(?P<name>[A-Z][a-z]{2,})'s\s+"
        r"(?P<attribute>hair|eyes?)\s+"
        r"(?:is|was|were|looks?|looked|appears?|appeared|turned)?\s*"
        r"(?:[a-z]+\s+){0,3}?"
        r"(?P<color>[A-Za-z]+)\b"
    ),
    re.compile(
        r"\b(?P<name>[A-Z][a-z]{2,})\b"
        r"[^.\n!?]{0,70}?"
        r"(?P<color>[A-Za-z]+)\s+"
        r"(?P<attribute>hair|eyes?)\b"
    ),
]


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


def _get_pov_character(chapter: Chapter) -> Optional[str]:
    """Read optional POV character from chapter generation settings."""
    settings = chapter.generation_settings if isinstance(chapter.generation_settings, dict) else {}
    value = settings.get("pov_character")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _set_pov_character(chapter: Chapter, pov_character: Optional[str]) -> None:
    """Persist optional POV character in chapter generation settings."""
    settings = chapter.generation_settings if isinstance(chapter.generation_settings, dict) else {}
    updated = dict(settings)

    if isinstance(pov_character, str) and pov_character.strip():
        updated["pov_character"] = pov_character.strip()
    else:
        updated.pop("pov_character", None)

    chapter.generation_settings = updated


def _chapter_source_text(chapter: Chapter) -> str:
    """Build source text for summary and outline generation."""
    compiled = (chapter.compiled_content or "").strip()
    if compiled:
        return compiled

    description = (chapter.description or "").strip()
    if description:
        return description

    parts: List[str] = []
    for assoc in sorted(chapter.event_associations, key=lambda item: item.order_index):
        event = assoc.event
        title = (event.title or "").strip()
        content = (assoc.custom_content or event.content or event.summary or "").strip()
        if title and content:
            parts.append(f"{title}: {content}")
        elif content:
            parts.append(content)

    return "\n\n".join(parts).strip()


def _fallback_summary(chapter: Chapter, source_text: str) -> str:
    """Create deterministic summary when AI provider is unavailable."""
    cleaned = re.sub(r"\s+", " ", source_text).strip()
    if not cleaned:
        return f"{chapter.title} is prepared for drafting. Add events or content to generate a richer summary."

    sentence_like = re.split(r"(?<=[.!?])\s+", cleaned)
    summary = " ".join(sentence_like[:2]).strip()
    if not summary:
        summary = cleaned[:320].strip()
    return summary


def _parse_outline_sections(outline_text: str) -> List[str]:
    """Extract ordered bullet sections from outline text."""
    sections: List[str] = []
    for raw_line in outline_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized = re.sub(r"^[-*\d\.)\s]+", "", line).strip()
        if normalized:
            sections.append(normalized)

    return sections[:12]


def _fallback_outline(chapter: Chapter) -> List[str]:
    """Create deterministic outline when AI provider is unavailable."""
    sections: List[str] = []

    for assoc in sorted(chapter.event_associations, key=lambda item: item.order_index):
        title = (assoc.event.title or "").strip()
        summary = (assoc.event.summary or "").strip()
        if title and summary:
            sections.append(f"{title}: {summary}")
        elif title:
            sections.append(title)

    if sections:
        return sections[:10]

    return [
        "Hook and establish the scene",
        "Introduce central tension or question",
        "Deepen stakes with concrete detail",
        "Reach a turning point",
        "Close with reflection or transition",
    ]


def _parse_note_points(notes_text: str) -> List[str]:
    """Parse note bullets/lines into ordered points."""
    points: List[str] = []

    for raw_line in notes_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        cleaned = re.sub(r"^[-*\d\.)\s]+", "", line).strip()
        if cleaned:
            points.append(cleaned)

    if points:
        return points[:24]

    fallback_points = [
        part.strip()
        for part in re.split(r"[\.;]\s+", notes_text)
        if part and part.strip()
    ]
    return fallback_points[:24]


def _ensure_sentence(value: str) -> str:
    """Ensure text point ends with sentence punctuation."""
    normalized = value.strip()
    if not normalized:
        return ""
    if normalized[-1] in ".!?":
        return normalized
    return f"{normalized}."


def _fallback_expand_notes(chapter_title: str, notes_text: str) -> str:
    """Create deterministic prose expansion when AI provider is unavailable."""
    points = _parse_note_points(notes_text)
    if not points:
        return _normalize_spaces(notes_text)

    transition_prefixes = [
        "To begin,",
        "Next,",
        "Then,",
        "As events unfold,",
        "Under mounting pressure,",
        "Finally,",
    ]

    paragraphs: List[str] = []
    for index, point in enumerate(points):
        sentence = _ensure_sentence(point)
        if not sentence:
            continue

        prefix = transition_prefixes[min(index, len(transition_prefixes) - 1)]
        paragraphs.append(f"{prefix} {sentence}")

    lead = (
        f"{chapter_title} develops through connected beats that preserve the intent of your notes."
        if chapter_title
        else "This section develops through connected beats that preserve the intent of your notes."
    )

    return "\n\n".join([lead, *paragraphs])


def _build_diff_preview(notes_text: str, expanded_text: str, context_lines: int = 2) -> str:
    """Build a compact unified diff preview between notes and expanded prose."""
    diff_lines = list(
        unified_diff(
            notes_text.splitlines(),
            expanded_text.splitlines(),
            fromfile="notes",
            tofile="expanded",
            lineterm="",
            n=context_lines,
        )
    )

    if not diff_lines:
        return "No textual diff available."

    return "\n".join(diff_lines[:220])


def _normalize_spaces(value: str) -> str:
    """Normalize whitespace for compact previews and snippets."""
    return re.sub(r"\s+", " ", value).strip()


def _build_consistency_excerpt(source_text: str, token: str, radius: int = 90) -> Optional[str]:
    """Return a short excerpt around the first token match."""
    if not source_text.strip() or not token.strip():
        return None

    start_index = source_text.lower().find(token.lower())
    if start_index < 0:
        return None

    end_index = start_index + len(token)
    slice_start = max(0, start_index - radius)
    slice_end = min(len(source_text), end_index + radius)
    excerpt = _normalize_spaces(source_text[slice_start:slice_end])
    return excerpt or None


def _chapter_consistency_text(chapter: Chapter) -> str:
    """Build text used for consistency checks."""
    primary = _chapter_source_text(chapter)
    if primary:
        return primary

    fallback_parts = [
        (chapter.summary or "").strip(),
        (chapter.description or "").strip(),
    ]
    return "\n\n".join([part for part in fallback_parts if part]).strip()


def _chapter_reference_payload(
    chapter_data: Dict[str, Any],
    matched_text: Optional[str] = None,
    excerpt: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a consistency issue reference payload."""
    return {
        "chapter_id": chapter_data["chapter_id"],
        "chapter_title": chapter_data["chapter_title"],
        "chapter_number": chapter_data["chapter_number"],
        "chapter_order": chapter_data["chapter_order"],
        "matched_text": matched_text,
        "excerpt": excerpt,
    }


def _extract_character_candidates(text: str) -> List[str]:
    """Extract likely character-name tokens from text."""
    candidates: List[str] = []

    for match in re.finditer(r"\b[A-Z][a-z]{2,}\b", text):
        token = match.group(0).strip()
        token_lower = token.lower()
        if token_lower in CONSISTENCY_STOPWORDS:
            continue
        candidates.append(token)

    return candidates


def _extract_location_candidates(text: str) -> List[str]:
    """Extract likely location mentions from text."""
    candidates: List[str] = []

    for match in LOCATION_MENTION_PATTERN.finditer(text):
        token = match.group(1).strip()
        first_word = token.split()[0].lower()
        if first_word in CONSISTENCY_STOPWORDS:
            continue
        candidates.append(token)

    return candidates


def _extract_object_candidates(text: str) -> List[str]:
    """Extract likely named object mentions from text."""
    candidates: List[str] = []

    for match in OBJECT_MENTION_PATTERN.finditer(text):
        token = match.group(1).strip()
        first_word = token.split()[0].lower()
        if first_word in CONSISTENCY_STOPWORDS:
            continue
        if token.lower() in CONSISTENCY_STOPWORDS:
            continue
        candidates.append(token)

    return candidates


def _normalize_entity_token(value: str) -> str:
    """Normalize a discovered entity token for grouping."""
    cleaned = re.sub(r"[^a-z0-9\s'-]", " ", value.lower())
    return _normalize_spaces(cleaned)


def _upsert_extracted_entity_occurrence(
    entity_occurrences: Dict[Tuple[str, str], Dict[str, Any]],
    chapter_data: Dict[str, Any],
    source_text: str,
    entity_type: str,
    token: str,
    mention_count: int,
) -> None:
    """Track extracted entity mention counts and chapter references."""
    if mention_count <= 0:
        return

    normalized = _normalize_entity_token(token)
    if not normalized:
        return

    key = (entity_type, normalized)
    bucket = entity_occurrences.get(key)
    if not bucket:
        bucket = {
            "entity_type": entity_type,
            "normalized_name": normalized,
            "name_counts": Counter(),
            "frequency": 0,
            "references": {},
        }
        entity_occurrences[key] = bucket

    bucket["name_counts"][token] += mention_count
    bucket["frequency"] += mention_count

    chapter_id = chapter_data["chapter_id"]
    existing_reference = bucket["references"].get(chapter_id)
    if existing_reference:
        existing_reference["mentions"] += mention_count
        if not existing_reference.get("context_snippet"):
            existing_reference["context_snippet"] = _build_consistency_excerpt(source_text, token)
        return

    bucket["references"][chapter_id] = {
        "chapter_id": chapter_data["chapter_id"],
        "chapter_title": chapter_data["chapter_title"],
        "chapter_number": chapter_data["chapter_number"],
        "chapter_order": chapter_data["chapter_order"],
        "mentions": mention_count,
        "context_snippet": _build_consistency_excerpt(source_text, token),
    }


def _map_extraction_type_to_entity_type(extraction_type: str) -> str:
    """Map extracted entity type to Entity model type.
    
    Extraction types: character, location, object
    Entity types: character, location, concept, faction, item, theme, custom
    """
    type_map = {
        "character": "character",
        "location": "location",
        "object": "item",  # Generic objects map to "item" type
    }
    return type_map.get(extraction_type, "concept")


def _run_entity_extraction(chapters_data: List[Dict[str, Any]]) -> List[ExtractedEntity]:
    """Extract character/location/object entities from chapter text deterministically."""
    entity_occurrences: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for chapter_data in chapters_data:
        text = chapter_data.get("text", "")
        if not text:
            continue

        location_counter = Counter(
            token for token in _extract_location_candidates(text) if token
        )
        location_norms = {
            _normalize_entity_token(token)
            for token in location_counter
            if _normalize_entity_token(token)
        }

        object_counter = Counter(
            token for token in _extract_object_candidates(text) if token
        )
        object_counter = Counter(
            {
                token: count
                for token, count in object_counter.items()
                if _normalize_entity_token(token) not in location_norms
            }
        )
        object_norm_counts: Dict[str, int] = defaultdict(int)
        for token, count in object_counter.items():
            normalized_token = _normalize_entity_token(token)
            if normalized_token:
                object_norm_counts[normalized_token] += count

        character_counter = Counter(
            token for token in _extract_character_candidates(text) if token
        )
        character_counter = Counter(
            {
                token: count
                for token, count in character_counter.items()
                if _normalize_entity_token(token) not in location_norms
                and (
                    _normalize_entity_token(token) not in object_norm_counts
                    or object_norm_counts[_normalize_entity_token(token)] < count
                )
            }
        )
        character_norms = {
            _normalize_entity_token(token)
            for token in character_counter
            if _normalize_entity_token(token)
        }

        object_counter = Counter(
            {
                token: count
                for token, count in object_counter.items()
                if _normalize_entity_token(token) not in character_norms
            }
        )

        for token, count in location_counter.items():
            _upsert_extracted_entity_occurrence(
                entity_occurrences=entity_occurrences,
                chapter_data=chapter_data,
                source_text=text,
                entity_type="location",
                token=token,
                mention_count=count,
            )

        for token, count in character_counter.items():
            _upsert_extracted_entity_occurrence(
                entity_occurrences=entity_occurrences,
                chapter_data=chapter_data,
                source_text=text,
                entity_type="character",
                token=token,
                mention_count=count,
            )

        for token, count in object_counter.items():
            _upsert_extracted_entity_occurrence(
                entity_occurrences=entity_occurrences,
                chapter_data=chapter_data,
                source_text=text,
                entity_type="object",
                token=token,
                mention_count=count,
            )

    entities: List[ExtractedEntity] = []
    for bucket in entity_occurrences.values():
        references_raw = sorted(
            bucket["references"].values(),
            key=lambda ref: (ref["chapter_order"], ref["chapter_number"], ref["chapter_title"]),
        )
        if not references_raw:
            continue

        display_name = bucket["name_counts"].most_common(1)[0][0]
        frequency = int(bucket["frequency"])
        entity_type = str(bucket["entity_type"])

        if entity_type == "object" and frequency <= 1 and len(display_name.split()) == 1:
            continue

        first_reference = references_raw[0]
        entity_id_token = bucket["normalized_name"].replace(" ", "-").replace("'", "")

        entities.append(
            ExtractedEntity(
                id=f"{entity_type}-{entity_id_token}",
                name=display_name,
                entity_type=entity_type,
                frequency=frequency,
                first_mention_chapter_id=first_reference["chapter_id"],
                first_mention_chapter_title=first_reference["chapter_title"],
                first_mention_chapter_number=first_reference["chapter_number"],
                first_mention_chapter_order=first_reference["chapter_order"],
                context_snippet=first_reference.get("context_snippet"),
                references=[
                    ExtractedEntityReference(**reference)
                    for reference in references_raw[:12]
                ],
            )
        )

    entities.sort(key=lambda item: (-item.frequency, item.name.lower(), item.entity_type))
    return entities[:80]


def _group_similar_terms(
    term_occurrences: Dict[str, List[Dict[str, Any]]],
    similarity_threshold: float,
) -> List[List[str]]:
    """Group terms that look like spelling variants of each other."""
    ordered_terms = sorted(
        [term for term, refs in term_occurrences.items() if refs],
        key=lambda term: (-len(term_occurrences[term]), term.lower()),
    )

    grouped: List[List[str]] = []
    consumed: set[str] = set()

    for base in ordered_terms:
        if base in consumed:
            continue

        cluster = [base]
        for candidate in ordered_terms:
            if candidate == base or candidate in consumed:
                continue

            if base[0].lower() != candidate[0].lower():
                continue

            if abs(len(base) - len(candidate)) > 3:
                continue

            similarity = SequenceMatcher(None, base.lower(), candidate.lower()).ratio()
            if similarity >= similarity_threshold:
                cluster.append(candidate)

        if len(cluster) > 1:
            grouped.append(cluster)
            consumed.update(cluster)

    return grouped


def _select_canonical_value(
    cluster: List[str],
    term_occurrences: Dict[str, List[Dict[str, Any]]],
) -> str:
    """Choose a canonical spelling/value for a term cluster."""
    return sorted(
        cluster,
        key=lambda term: (-len(term_occurrences[term]), len(term), term.lower()),
    )[0]


def _build_unique_references(references: List[Dict[str, Any]]) -> List[ConsistencyIssueReference]:
    """Collapse duplicate chapter references while keeping useful excerpts."""
    deduped: Dict[Any, Dict[str, Any]] = {}

    for reference in references:
        chapter_id = reference["chapter_id"]
        existing = deduped.get(chapter_id)

        if not existing:
            deduped[chapter_id] = reference
            continue

        if not existing.get("excerpt") and reference.get("excerpt"):
            deduped[chapter_id] = reference

    sorted_refs = sorted(
        deduped.values(),
        key=lambda ref: (ref["chapter_order"], ref["chapter_number"], ref["chapter_title"]),
    )
    return [ConsistencyIssueReference(**ref) for ref in sorted_refs[:12]]


def _detect_character_name_variations(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Detect likely character spelling variations across chapters."""
    token_occurrences: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for chapter_data in chapters_data:
        text = chapter_data.get("text", "")
        if not text:
            continue

        for token in _extract_character_candidates(text):
            token_occurrences[token].append(
                _chapter_reference_payload(
                    chapter_data,
                    matched_text=token,
                    excerpt=_build_consistency_excerpt(text, token),
                )
            )

    groups = _group_similar_terms(token_occurrences, similarity_threshold=0.82)
    issues: List[ConsistencyIssue] = []

    for index, cluster in enumerate(groups, start=1):
        canonical = _select_canonical_value(cluster, token_occurrences)
        variants = sorted(cluster, key=lambda token: (token != canonical, token.lower()))
        references = _build_unique_references(
            [ref for token in variants for ref in token_occurrences[token]]
        )

        if len(references) < 2:
            continue

        issue_label = ", ".join(variants[:3])
        if len(variants) > 3:
            issue_label += ", ..."

        issues.append(
            ConsistencyIssue(
                id=f"character-{index}-{canonical.lower()}",
                issue_type="character_name_variation",
                severity="high" if len(references) >= 3 else "medium",
                title=f"Character name variation detected ({issue_label})",
                description=(
                    "Likely the same character appears with multiple spellings across chapters. "
                    "Confirm the canonical name and normalize mentions."
                ),
                canonical_value=canonical,
                variants=variants,
                references=references,
                fix_suggestions=[
                    f'Use "{canonical}" as the canonical spelling in affected chapters.',
                    "If these are different characters, add clearer descriptors to distinguish them.",
                ],
            )
        )

    return issues


def _detect_location_name_variations(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Detect likely location naming variations across chapters."""
    token_occurrences: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for chapter_data in chapters_data:
        text = chapter_data.get("text", "")
        if not text:
            continue

        for token in _extract_location_candidates(text):
            token_occurrences[token].append(
                _chapter_reference_payload(
                    chapter_data,
                    matched_text=token,
                    excerpt=_build_consistency_excerpt(text, token),
                )
            )

    groups = _group_similar_terms(token_occurrences, similarity_threshold=0.84)
    issues: List[ConsistencyIssue] = []

    for index, cluster in enumerate(groups, start=1):
        canonical = _select_canonical_value(cluster, token_occurrences)
        variants = sorted(cluster, key=lambda token: (token != canonical, token.lower()))
        references = _build_unique_references(
            [ref for token in variants for ref in token_occurrences[token]]
        )

        if len(references) < 2:
            continue

        issue_label = ", ".join(variants[:3])
        if len(variants) > 3:
            issue_label += ", ..."

        issues.append(
            ConsistencyIssue(
                id=f"location-{index}-{canonical.lower().replace(' ', '-')}",
                issue_type="location_name_variation",
                severity="medium",
                title=f"Location name variation detected ({issue_label})",
                description=(
                    "A place appears with multiple similar names across chapters. "
                    "Verify the canonical location name for continuity."
                ),
                canonical_value=canonical,
                variants=variants,
                references=references,
                fix_suggestions=[
                    f'Normalize related location mentions to "{canonical}" where appropriate.',
                    "If variants represent different places, add clarifying context in each chapter.",
                ],
            )
        )

    return issues


def _count_term_mentions(text: str, term: str) -> int:
    """Count case-insensitive term mentions with word boundaries."""
    escaped = re.escape(term.strip())
    escaped = escaped.replace(r"\ ", r"\s+").replace(r"\-", r"[-\s]?")
    pattern = re.compile(rf"\b{escaped}\b", re.IGNORECASE)
    return len(pattern.findall(text))


def _detect_terminology_inconsistencies(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Detect mixed terminology usage patterns across chapter material."""
    issues: List[ConsistencyIssue] = []
    issue_index = 1

    for primary_term, alternate_term in TERMINOLOGY_CONFLICT_PAIRS:
        primary_mentions_total = 0
        alternate_mentions_total = 0
        primary_references: List[Dict[str, Any]] = []
        alternate_references: List[Dict[str, Any]] = []

        for chapter_data in chapters_data:
            text = chapter_data.get("text", "")
            if not text:
                continue

            primary_mentions = _count_term_mentions(text, primary_term)
            alternate_mentions = _count_term_mentions(text, alternate_term)

            if primary_mentions > 0:
                primary_mentions_total += primary_mentions
                primary_references.append(
                    _chapter_reference_payload(
                        chapter_data,
                        matched_text=f"{primary_term} x{primary_mentions}",
                        excerpt=_build_consistency_excerpt(text, primary_term),
                    )
                )

            if alternate_mentions > 0:
                alternate_mentions_total += alternate_mentions
                alternate_references.append(
                    _chapter_reference_payload(
                        chapter_data,
                        matched_text=f"{alternate_term} x{alternate_mentions}",
                        excerpt=_build_consistency_excerpt(text, alternate_term),
                    )
                )

        if primary_mentions_total == 0 or alternate_mentions_total == 0:
            continue

        references = _build_unique_references(primary_references + alternate_references)
        if len(references) < 2:
            continue

        canonical = primary_term if primary_mentions_total >= alternate_mentions_total else alternate_term
        combined_mentions = primary_mentions_total + alternate_mentions_total

        issues.append(
            ConsistencyIssue(
                id=f"terminology-{issue_index}-{canonical.replace(' ', '-')}",
                issue_type="terminology_inconsistency",
                severity="medium" if combined_mentions >= 8 else "low",
                title=f"Terminology inconsistency detected ({primary_term} vs {alternate_term})",
                description=(
                    "Both terminology variants are used across chapter text. "
                    "Choose one preferred term to keep language consistent."
                ),
                canonical_value=canonical,
                variants=[
                    f"{primary_term} ({primary_mentions_total})",
                    f"{alternate_term} ({alternate_mentions_total})",
                ],
                references=references,
                fix_suggestions=[
                    f'Prefer "{canonical}" as the canonical term unless contextual nuance requires variation.',
                    "If both forms are intentional, add style-guide notes for where each term should appear.",
                ],
            )
        )
        issue_index += 1

    return issues


def _normalize_appearance_color(value: str) -> Optional[str]:
    """Normalize color tokens used in appearance detection."""
    if not value:
        return None

    return APPEARANCE_COLOR_NORMALIZATION.get(value.strip().lower())


def _normalize_appearance_attribute(value: str) -> Optional[str]:
    """Normalize appearance attribute labels."""
    lowered = value.strip().lower()
    if lowered.startswith("eye"):
        return "eyes"
    if lowered == "hair":
        return "hair"
    return None


def _extract_character_appearance_mentions(chapter_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract character appearance mentions from chapter text."""
    text = chapter_data.get("text", "")
    if not text:
        return []

    mentions: List[Dict[str, Any]] = []
    seen: set[Tuple[int, str, str, str]] = set()

    for pattern in CHARACTER_APPEARANCE_PATTERNS:
        for match in pattern.finditer(text):
            name = (match.group("name") or "").strip()
            if not name or name.lower() in CONSISTENCY_STOPWORDS:
                continue

            color = _normalize_appearance_color(match.group("color") or "")
            if not color:
                continue

            attribute = _normalize_appearance_attribute(match.group("attribute") or "")
            if not attribute:
                continue

            match_text = _normalize_spaces(match.group(0) or "")
            if not match_text:
                continue

            dedupe_key = (match.start(), name.lower(), attribute, color)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            mentions.append(
                {
                    "name": name,
                    "name_key": _normalize_entity_token(name),
                    "attribute": attribute,
                    "color": color,
                    "reference": _chapter_reference_payload(
                        chapter_data,
                        matched_text=match_text,
                        excerpt=_build_consistency_excerpt(text, match_text),
                    ),
                }
            )

    return mentions


def _detect_character_appearance_inconsistencies(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Detect conflicting character appearance details across chapters."""
    grouped_mentions: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for chapter_data in chapters_data:
        for mention in _extract_character_appearance_mentions(chapter_data):
            key = (mention["name_key"], mention["attribute"])
            bucket = grouped_mentions.get(key)
            if not bucket:
                bucket = {
                    "name_counts": Counter(),
                    "value_counts": Counter(),
                    "references_by_value": defaultdict(list),
                }
                grouped_mentions[key] = bucket

            bucket["name_counts"][mention["name"]] += 1
            bucket["value_counts"][mention["color"]] += 1
            bucket["references_by_value"][mention["color"]].append(mention["reference"])

    issues: List[ConsistencyIssue] = []
    issue_index = 1

    for (_, attribute), bucket in sorted(grouped_mentions.items()):
        value_counts: Counter = bucket["value_counts"]
        if len(value_counts) <= 1:
            continue

        canonical_name = bucket["name_counts"].most_common(1)[0][0]
        ordered_values = sorted(
            value_counts.keys(),
            key=lambda value: (-value_counts[value], value),
        )

        references = _build_unique_references(
            [
                reference
                for value in ordered_values
                for reference in bucket["references_by_value"][value]
            ]
        )

        if len(references) < 2:
            continue

        variants = [f"{value} {attribute}" for value in ordered_values]

        issues.append(
            ConsistencyIssue(
                id=f"appearance-{issue_index}-{canonical_name.lower()}-{attribute}",
                issue_type="character_appearance_inconsistency",
                severity="high" if len(ordered_values) > 2 else "medium",
                title=f"Character appearance drift detected ({canonical_name} {attribute})",
                description=(
                    f"{canonical_name}'s {attribute} is described with conflicting details across chapters. "
                    "Choose one canonical description or add explicit in-story change context."
                ),
                canonical_value=None,
                variants=variants,
                references=references,
                fix_suggestions=[
                    f"Align {canonical_name}'s {attribute} description to one canonical color across relevant chapters.",
                    "If the change is intentional, add clear transition context (e.g., dye, disguise, injury, lighting).",
                ],
            )
        )
        issue_index += 1

    return issues


def _normalize_month_token(token: str) -> str:
    """Normalize month aliases to full lowercase names."""
    lowered = token.strip().lower().rstrip(".")
    return MONTH_ALIASES.get(lowered, lowered)


def _detect_timeline_inconsistencies(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Detect timeline/date inconsistencies across chapter content."""
    issues: List[ConsistencyIssue] = []

    date_mentions: Dict[str, Dict[int, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    chapter_year_summaries: List[Dict[str, Any]] = []

    for chapter_data in chapters_data:
        text = chapter_data.get("text", "")
        if not text:
            continue

        years = [int(match.group(1)) for match in YEAR_MENTION_PATTERN.finditer(text)]
        if years:
            counts = Counter(years)
            chapter_year_summaries.append(
                {
                    **chapter_data,
                    "dominant_year": counts.most_common(1)[0][0],
                    "year_count": len(years),
                }
            )

        for match in DATE_WITH_YEAR_PATTERN.finditer(text):
            month = _normalize_month_token(match.group(1))
            day = int(match.group(2))
            year = int(match.group(3))
            date_key = f"{month} {day}"
            surface = match.group(0)

            date_mentions[date_key][year].append(
                _chapter_reference_payload(
                    chapter_data,
                    matched_text=surface,
                    excerpt=_build_consistency_excerpt(text, surface),
                )
            )

    timeline_issue_index = 1

    for date_key, year_map in sorted(date_mentions.items()):
        if len(year_map) <= 1:
            continue

        years = sorted(year_map.keys())
        references = _build_unique_references(
            [reference for year in years for reference in year_map[year]]
        )
        if len(references) < 2:
            continue

        issues.append(
            ConsistencyIssue(
                id=f"timeline-date-{timeline_issue_index}",
                issue_type="timeline_inconsistency",
                severity="high",
                title=f"Date conflict for {date_key.title()}",
                description=(
                    f"The same calendar date appears with conflicting years ({', '.join(str(year) for year in years)})."
                ),
                canonical_value=None,
                variants=[f"{date_key.title()}, {year}" for year in years],
                references=references,
                fix_suggestions=[
                    "Verify which year is correct and align all chapter mentions.",
                    "If one reference is a flashback, add explicit temporal framing in text.",
                ],
            )
        )
        timeline_issue_index += 1

    ordered_years = sorted(
        chapter_year_summaries,
        key=lambda chapter_data: (
            chapter_data["chapter_order"],
            chapter_data["chapter_number"],
            chapter_data["chapter_title"],
        ),
    )

    for index in range(1, len(ordered_years)):
        previous = ordered_years[index - 1]
        current = ordered_years[index]

        previous_year = previous.get("dominant_year")
        current_year = current.get("dominant_year")
        if previous_year is None or current_year is None:
            continue

        if current_year + 1 >= previous_year:
            continue

        references = _build_unique_references(
            [
                _chapter_reference_payload(previous, matched_text=str(previous_year)),
                _chapter_reference_payload(current, matched_text=str(current_year)),
            ]
        )

        issues.append(
            ConsistencyIssue(
                id=f"timeline-order-{timeline_issue_index}",
                issue_type="timeline_inconsistency",
                severity="medium",
                title="Possible timeline regression between consecutive chapters",
                description=(
                    f"Chapter {previous['chapter_number']} is dominated by {previous_year} while "
                    f"chapter {current['chapter_number']} shifts to {current_year}."
                ),
                canonical_value=None,
                variants=[str(previous_year), str(current_year)],
                references=references,
                fix_suggestions=[
                    "Confirm whether this is an intentional flashback or a continuity error.",
                    "Add timeline cues if chronology intentionally jumps.",
                ],
            )
        )
        timeline_issue_index += 1

    return issues


def _run_consistency_checks(chapters_data: List[Dict[str, Any]]) -> List[ConsistencyIssue]:
    """Run all deterministic consistency checks for chapter material."""
    issues: List[ConsistencyIssue] = []
    issues.extend(_detect_character_name_variations(chapters_data))
    issues.extend(_detect_character_appearance_inconsistencies(chapters_data))
    issues.extend(_detect_terminology_inconsistencies(chapters_data))
    issues.extend(_detect_timeline_inconsistencies(chapters_data))
    issues.extend(_detect_location_name_variations(chapters_data))

    severity_order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(
        key=lambda issue: (
            severity_order.get(issue.severity, 1),
            issue.issue_type,
            issue.title.lower(),
        )
    )
    return issues[:30]


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
            pov_character=_get_pov_character(c),
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

    _set_pov_character(chapter, chapter_data.pov_character)

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
        pov_character=_get_pov_character(chapter),
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
        pov_character=_get_pov_character(chapter),
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

    pov_character_provided = "pov_character" in update_data
    pov_character_value = update_data.pop("pov_character", None)

    for field, value in update_data.items():
        setattr(chapter, field, value)

    if pov_character_provided:
        _set_pov_character(chapter, pov_character_value)

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
        pov_character=_get_pov_character(chapter),
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
        pov_character=_get_pov_character(chapter),
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

    # Auto-create version snapshot
    version_snapshot = ChapterVersion(
        chapter_id=chapter.id,
        user_id=user_id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        compiled_content=chapter.compiled_content,
        summary=chapter.summary,
        word_count=chapter.word_count,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        version_name=None,  # Auto-snapshots don't have custom names
        change_description="Auto-snapshot created during chapter compilation",
        is_auto_snapshot=True,
    )
    db.add(version_snapshot)

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
    "/{chapter_id}/generate-summary",
    response_model=ChapterSummaryResponse,
    summary="Generate chapter summary",
)
async def generate_chapter_summary(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Generate and persist a concise chapter summary."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations).selectinload(ChapterEvent.event))
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    source_text = _chapter_source_text(chapter)
    generated_summary = ""

    if source_text:
        try:
            gemini = get_gemini_service()
            generated_summary = await gemini.generate(
                prompt=(
                    "Generate a concise 2-4 sentence chapter summary. "
                    "Focus on major beats, stakes, and emotional movement.\n\n"
                    f"Chapter title: {chapter.title}\n"
                    f"Chapter content:\n{source_text[:14000]}"
                ),
                system_instruction=(
                    "You summarize long-form chapters for authors. Preserve factual accuracy, "
                    "avoid invention, and keep tone clear and publication-ready."
                ),
                temperature=0.4,
                max_tokens=280,
            )
        except Exception:
            generated_summary = ""

    summary_text = generated_summary.strip() or _fallback_summary(chapter, source_text)
    summary_text = re.sub(r"\s+", " ", summary_text).strip()
    chapter.summary = summary_text
    generated_at = datetime.now(timezone.utc)

    await db.flush()

    return ChapterSummaryResponse(
        chapter_id=chapter.id,
        summary=summary_text,
        generated_at=generated_at,
        message="Chapter summary generated",
    )


@router.post(
    "/{chapter_id}/generate-outline",
    response_model=ChapterOutlineResponse,
    summary="Generate chapter outline",
)
async def generate_chapter_outline(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Generate a structured chapter outline from current chapter material."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations).selectinload(ChapterEvent.event))
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    source_text = _chapter_source_text(chapter)
    generated_outline = ""

    if source_text:
        try:
            gemini = get_gemini_service()
            generated_outline = await gemini.generate(
                prompt=(
                    "Create a practical chapter outline with 5-8 bullet points. "
                    "Each point should be a distinct scene/section objective.\n\n"
                    f"Chapter title: {chapter.title}\n"
                    f"Chapter material:\n{source_text[:14000]}"
                ),
                system_instruction=(
                    "You are an outlining assistant for authors. Return concise, actionable "
                    "outline points in clear sequence."
                ),
                temperature=0.45,
                max_tokens=520,
            )
        except Exception:
            generated_outline = ""

    sections = _parse_outline_sections(generated_outline)
    if not sections:
        sections = _fallback_outline(chapter)

    outline_text = generated_outline.strip()
    if not outline_text:
        outline_text = "\n".join([f"- {section}" for section in sections])

    workspace = _ensure_workspace_settings(chapter)
    generated_at = datetime.now(timezone.utc)
    workspace["generated_outline"] = sections
    workspace["generated_outline_text"] = outline_text
    workspace["outline_generated_at"] = generated_at.isoformat()
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    return ChapterOutlineResponse(
        chapter_id=chapter.id,
        outline=outline_text,
        sections=sections,
        generated_at=generated_at,
        message="Chapter outline generated",
    )


@router.post(
    "/{chapter_id}/expand-notes",
    response_model=ChapterExpandNotesResponse,
    summary="Expand chapter notes",
)
async def expand_chapter_notes(
    chapter_id: uuid.UUID,
    payload: ChapterExpandNotesRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Expand writer notes into draft prose and return a diff preview."""
    chapter_result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    notes_text = payload.notes.strip()
    if len(notes_text) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notes must include meaningful content",
        )

    expanded_text = ""
    try:
        gemini = get_gemini_service()
        expanded_text = await gemini.generate(
            prompt=(
                "Expand the following chapter notes into coherent draft prose. "
                "Preserve all explicit facts, event order, and named entities from the notes.\n\n"
                f"Chapter title: {chapter.title}\n"
                f"Preferred tone: {payload.tone or chapter.tone or 'adaptive'}\n"
                f"Preserve writer commitment: {'yes' if payload.preserve_writer_commitment else 'no'}\n"
                f"Notes:\n{notes_text[:12000]}"
            ),
            system_instruction=(
                "You are a precise drafting assistant for authors. Expand notes into readable prose "
                "without inventing facts, and keep the author's intent intact."
            ),
            temperature=0.55,
            max_tokens=1400,
        )
    except Exception:
        expanded_text = ""

    if expanded_text and expanded_text.strip():
        expanded_text = re.sub(r"\n{3,}", "\n\n", expanded_text.strip())
    else:
        expanded_text = _fallback_expand_notes(chapter.title or "", notes_text)

    diff_preview = _build_diff_preview(notes_text, expanded_text)
    generated_at = datetime.now(timezone.utc)

    workspace = _ensure_workspace_settings(chapter)
    workspace["last_notes_expansion_at"] = generated_at.isoformat()
    workspace["last_notes_expansion_preview"] = expanded_text[:800]
    workspace["last_notes_diff_preview"] = diff_preview[:1600]
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    return ChapterExpandNotesResponse(
        chapter_id=chapter.id,
        expanded_text=expanded_text,
        diff_preview=diff_preview,
        generated_at=generated_at,
        message="Chapter notes expanded",
    )


@router.post(
    "/{chapter_id}/check-consistency",
    response_model=ChapterConsistencyResponse,
    summary="Check chapter consistency",
)
async def check_chapter_consistency(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Run deterministic consistency checks across related chapters."""
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

    linked_book_id: Optional[uuid.UUID] = None
    if chapter.book_associations:
        ordered_associations = sorted(chapter.book_associations, key=lambda assoc: assoc.order_index)
        for association in ordered_associations:
            if association.book_id:
                linked_book_id = association.book_id
                break

    if linked_book_id:
        chapters_result = await db.execute(
            select(Chapter)
            .join(BookChapter, BookChapter.chapter_id == Chapter.id)
            .where(BookChapter.book_id == linked_book_id, Chapter.user_id == user_id)
            .order_by(BookChapter.order_index, Chapter.chapter_number, Chapter.created_at)
            .options(
                selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
                selectinload(Chapter.book_associations),
            )
        )
    else:
        chapters_result = await db.execute(
            select(Chapter)
            .where(Chapter.user_id == user_id)
            .order_by(Chapter.order_index, Chapter.chapter_number, Chapter.created_at)
            .options(
                selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
                selectinload(Chapter.book_associations),
            )
        )

    related_chapters = list(chapters_result.scalars().unique().all())

    chapter_payload: List[Dict[str, Any]] = []
    for related in related_chapters:
        chapter_order = related.order_index
        if linked_book_id:
            matching_assoc = next(
                (assoc for assoc in related.book_associations if assoc.book_id == linked_book_id),
                None,
            )
            if matching_assoc:
                chapter_order = matching_assoc.order_index

        chapter_payload.append(
            {
                "chapter_id": related.id,
                "chapter_title": related.title,
                "chapter_number": related.chapter_number,
                "chapter_order": chapter_order,
                "text": _chapter_consistency_text(related),
            }
        )

    issues = _run_consistency_checks(chapter_payload)
    generated_at = datetime.now(timezone.utc)

    workspace = _ensure_workspace_settings(chapter)
    workspace["last_consistency_check_at"] = generated_at.isoformat()
    workspace["last_consistency_issue_count"] = len(issues)
    workspace["last_consistency_scope"] = "book" if linked_book_id else "account"
    if linked_book_id:
        workspace["last_consistency_book_id"] = str(linked_book_id)
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    scope_label = "linked project chapters" if linked_book_id else "all user chapters"
    if issues:
        message = (
            f"Found {len(issues)} potential consistency issue(s) across {scope_label}."
        )
    else:
        message = f"No major consistency issues detected across {scope_label}."

    return ChapterConsistencyResponse(
        chapter_id=chapter.id,
        generated_at=generated_at,
        issue_count=len(issues),
        issues=issues,
        message=message,
    )


@router.post(
    "/{chapter_id}/extract-entities",
    response_model=ChapterEntityExtractionResponse,
    summary="Extract discovered entities",
)
async def extract_chapter_entities(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Extract discovered character/location/object entities from related chapter text."""
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

    linked_book_id: Optional[uuid.UUID] = None
    if chapter.book_associations:
        ordered_associations = sorted(chapter.book_associations, key=lambda assoc: assoc.order_index)
        for association in ordered_associations:
            if association.book_id:
                linked_book_id = association.book_id
                break

    if linked_book_id:
        chapters_result = await db.execute(
            select(Chapter)
            .join(BookChapter, BookChapter.chapter_id == Chapter.id)
            .where(BookChapter.book_id == linked_book_id, Chapter.user_id == user_id)
            .order_by(BookChapter.order_index, Chapter.chapter_number, Chapter.created_at)
            .options(
                selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
                selectinload(Chapter.book_associations),
            )
        )
    else:
        chapters_result = await db.execute(
            select(Chapter)
            .where(Chapter.user_id == user_id)
            .order_by(Chapter.order_index, Chapter.chapter_number, Chapter.created_at)
            .options(
                selectinload(Chapter.event_associations).selectinload(ChapterEvent.event),
                selectinload(Chapter.book_associations),
            )
        )

    related_chapters = list(chapters_result.scalars().unique().all())

    chapter_payload: List[Dict[str, Any]] = []
    for related in related_chapters:
        chapter_order = related.order_index
        if linked_book_id:
            matching_assoc = next(
                (assoc for assoc in related.book_associations if assoc.book_id == linked_book_id),
                None,
            )
            if matching_assoc:
                chapter_order = matching_assoc.order_index

        chapter_payload.append(
            {
                "chapter_id": related.id,
                "chapter_title": related.title,
                "chapter_number": related.chapter_number,
                "chapter_order": chapter_order,
                "text": _chapter_consistency_text(related),
            }
        )

    entities = _run_entity_extraction(chapter_payload)
    generated_at = datetime.now(timezone.utc)

    # Persist extracted entities to Entities table if book is linked
    if linked_book_id:
        from app.models.entity import Entity
        
        created_entities = []
        for extracted_entity in entities:
            # Map extraction entity_type to Entity type
            entity_type = _map_extraction_type_to_entity_type(extracted_entity.entity_type)
            
            # Create Entity record
            entity = Entity(
                book_id=linked_book_id,
                type=entity_type,
                name=extracted_entity.name,
                description=extracted_entity.context_snippet,
                entity_metadata={
                    "extraction_frequency": extracted_entity.frequency,
                    "extraction_first_mention_chapter_id": str(extracted_entity.first_mention_chapter_id),
                    "extraction_context": extracted_entity.context_snippet,
                },
            )
            db.add(entity)
            created_entities.append(entity)
        
        await db.flush()  # Get IDs without committing
        
        # Update entities with their db IDs
        for created_entity, extracted_entity in zip(created_entities, entities):
            extracted_entity.db_entity_id = created_entity.id

    workspace = _ensure_workspace_settings(chapter)
    workspace["last_entity_extraction_at"] = generated_at.isoformat()
    workspace["last_entity_extraction_count"] = len(entities)
    workspace["last_entity_extraction_scope"] = "book" if linked_book_id else "account"
    if linked_book_id:
        workspace["last_entity_extraction_book_id"] = str(linked_book_id)
    _persist_workspace_settings(chapter, workspace)

    await db.flush()

    scope_label = "linked project chapters" if linked_book_id else "all user chapters"
    message = (
        f"Extracted {len(entities)} discovered entit{'y' if len(entities) == 1 else 'ies'} "
        f"from {scope_label}."
    )

    return ChapterEntityExtractionResponse(
        chapter_id=chapter.id,
        generated_at=generated_at,
        entity_count=len(entities),
        entities=entities,
        message=message,
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
