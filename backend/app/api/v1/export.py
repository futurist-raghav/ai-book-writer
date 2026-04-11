"""
Export/Publishing API Routes

Handles book export and publishing operations.
"""

import uuid
import html
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book, BookChapter
from app.models.export import Export, ExportFormat, ExportStatus
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.export import (
    ExportCreate,
    ExportDownloadResponse,
    ExportListResponse,
    ExportMetadataResponse,
    ExportProgressResponse,
    ExportResponse,
)

router = APIRouter()


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_ALT_ATTR_RE = re.compile(r"\balt\s*=\s*(['\"])(.*?)\1", re.IGNORECASE | re.DOTALL)
_HEADING_TAG_RE = re.compile(r"<h([1-6])\b[^>]*>", re.IGNORECASE)
_MARKDOWN_HEADING_RE = re.compile(r"^\s*(#{1,6})\s+.+$", re.MULTILINE)
_TABLE_TAG_RE = re.compile(r"<table\b[^>]*>.*?</table>", re.IGNORECASE | re.DOTALL)
_TH_TAG_RE = re.compile(r"<th\b", re.IGNORECASE)
_CAPTION_TAG_RE = re.compile(r"<caption\b", re.IGNORECASE)


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    normalized = normalized.strip("-")
    return normalized or "section"


def _plain_text(raw: Optional[str]) -> str:
    if not raw:
        return ""
    return _HTML_TAG_RE.sub(" ", raw).strip()


def _word_count(raw: Optional[str]) -> int:
    text = _plain_text(raw)
    return len(text.split()) if text else 0


def _estimate_pages(words: int, words_per_page: int = 250) -> int:
    if words <= 0:
        return 1
    return max(1, math.ceil(words / words_per_page))


def _paragraph_metrics(raw: str) -> dict:
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    if not paragraphs and raw.strip():
        paragraphs = [raw.strip()]

    paragraph_word_counts = [len(p.split()) for p in paragraphs]
    longest_paragraph_words = max(paragraph_word_counts, default=0)
    long_paragraph_count = len([count for count in paragraph_word_counts if count >= 180])
    short_paragraph_count = len([count for count in paragraph_word_counts if 0 < count <= 8])

    return {
        "paragraph_count": len(paragraphs),
        "longest_paragraph_words": longest_paragraph_words,
        "long_paragraph_count": long_paragraph_count,
        "short_paragraph_count": short_paragraph_count,
    }


def _hex_to_rgb(hex_color: Optional[str]) -> Optional[tuple[int, int, int]]:
    if not hex_color:
        return None

    raw_value = str(hex_color).strip().lstrip("#")
    if len(raw_value) == 3:
        raw_value = "".join(char * 2 for char in raw_value)

    if len(raw_value) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", raw_value):
        return None

    return (
        int(raw_value[0:2], 16),
        int(raw_value[2:4], 16),
        int(raw_value[4:6], 16),
    )


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    def _channel_luminance(value: int) -> float:
        srgb = value / 255.0
        if srgb <= 0.03928:
            return srgb / 12.92
        return ((srgb + 0.055) / 1.055) ** 2.4

    red, green, blue = rgb
    return (
        (0.2126 * _channel_luminance(red))
        + (0.7152 * _channel_luminance(green))
        + (0.0722 * _channel_luminance(blue))
    )


def _contrast_ratio(
    text_color: Optional[str], background_color: Optional[str]
) -> Optional[float]:
    text_rgb = _hex_to_rgb(text_color)
    background_rgb = _hex_to_rgb(background_color)
    if not text_rgb or not background_rgb:
        return None

    text_luminance = _relative_luminance(text_rgb)
    background_luminance = _relative_luminance(background_rgb)
    lighter = max(text_luminance, background_luminance)
    darker = min(text_luminance, background_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def _heading_levels(raw: str) -> list[int]:
    heading_positions: list[tuple[int, int]] = []

    for heading_match in _HEADING_TAG_RE.finditer(raw):
        heading_positions.append((heading_match.start(), int(heading_match.group(1))))

    for markdown_match in _MARKDOWN_HEADING_RE.finditer(raw):
        heading_positions.append((markdown_match.start(), len(markdown_match.group(1))))

    heading_positions.sort(key=lambda item: item[0])
    return [level for _position, level in heading_positions]


def _normalize_accessibility_history(raw_history: object) -> list[dict]:
    if not isinstance(raw_history, list):
        return []

    normalized: list[dict] = []
    for entry in raw_history:
        if not isinstance(entry, dict):
            continue

        checked_at = entry.get("checked_at")
        accessibility_score = entry.get("accessibility_score")
        total_issues = entry.get("total_issues")
        wcag_level = entry.get("wcag_level")
        issues_by_severity = entry.get("issues_by_severity")

        if not isinstance(checked_at, str):
            continue
        if not isinstance(accessibility_score, int):
            continue
        if not isinstance(total_issues, int):
            continue
        if not isinstance(wcag_level, str):
            wcag_level = "Needs Improvement"
        if not isinstance(issues_by_severity, dict):
            issues_by_severity = {"error": 0, "warning": 0, "info": 0}

        normalized.append(
            {
                "checked_at": checked_at,
                "accessibility_score": max(0, min(100, accessibility_score)),
                "total_issues": max(0, total_issues),
                "wcag_level": wcag_level,
                "issues_by_severity": {
                    "error": int(issues_by_severity.get("error", 0) or 0),
                    "warning": int(issues_by_severity.get("warning", 0) or 0),
                    "info": int(issues_by_severity.get("info", 0) or 0),
                },
            }
        )

    return normalized


def _build_accessibility_history_summary(history_entries: list[dict]) -> dict:
    latest_score = history_entries[0]["accessibility_score"] if history_entries else 0
    previous_score = (
        history_entries[1]["accessibility_score"] if len(history_entries) > 1 else None
    )

    score_trend: Optional[str] = None
    if previous_score is not None:
        if latest_score > previous_score:
            score_trend = "improving"
        elif latest_score < previous_score:
            score_trend = "declining"
        else:
            score_trend = "stable"

    return {
        "total_scans": len(history_entries),
        "latest_score": latest_score,
        "previous_score": previous_score,
        "score_trend": score_trend,
        "scans": history_entries[:10],
    }


def _build_accessibility_recommendations(issues: list[dict]) -> list[dict]:
    category_summary: dict[str, dict] = {}
    severity_rank = {"error": 3, "warning": 2, "info": 1}

    for issue in issues:
        category = str(issue.get("category") or "general")
        severity = str(issue.get("severity") or "info")
        summary = category_summary.get(category)
        if summary is None:
            summary = {
                "count": 0,
                "severity": severity,
                "severity_rank": severity_rank.get(severity, 1),
                "sample_recommendation": str(issue.get("recommendation") or ""),
            }
            category_summary[category] = summary

        summary["count"] += 1
        if severity_rank.get(severity, 1) > summary["severity_rank"]:
            summary["severity"] = severity
            summary["severity_rank"] = severity_rank.get(severity, 1)

    templates = {
        "alt_text": {
            "title": "Add descriptive alt text",
            "description": "Provide descriptive alt text for informative images and intentional empty alt text for decorative visuals.",
            "priority": 8,
            "implementation_difficulty": "easy",
            "estimated_time_minutes": 20,
        },
        "contrast": {
            "title": "Improve text contrast",
            "description": "Adjust text and background colors to meet WCAG contrast thresholds for readability.",
            "priority": 9,
            "implementation_difficulty": "medium",
            "estimated_time_minutes": 25,
        },
        "heading_hierarchy": {
            "title": "Fix heading structure",
            "description": "Use sequential heading levels so assistive technologies can navigate chapter structure correctly.",
            "priority": 7,
            "implementation_difficulty": "easy",
            "estimated_time_minutes": 20,
        },
        "table_structure": {
            "title": "Improve table accessibility",
            "description": "Add table headers and captions so readers can understand table context and relationships.",
            "priority": 6,
            "implementation_difficulty": "medium",
            "estimated_time_minutes": 30,
        },
        "metadata": {
            "title": "Complete metadata fields",
            "description": "Fill key publishing metadata (author, publisher, publication date, identifiers) to improve assistive compatibility.",
            "priority": 5,
            "implementation_difficulty": "easy",
            "estimated_time_minutes": 15,
        },
    }

    recommendations: list[dict] = []
    for index, (category, summary) in enumerate(category_summary.items(), start=1):
        template = templates.get(category, None)
        title = (
            template["title"]
            if template
            else f"Address {category.replace('_', ' ')} issues"
        )
        description = (
            template["description"]
            if template
            else f"Resolve {summary['count']} issue(s) detected in {category.replace('_', ' ')} checks."
        )

        recommendations.append(
            {
                "id": f"rec-{index}",
                "title": title,
                "description": description,
                "issue_type": category,
                "severity": summary["severity"],
                "status": "open",
                "priority": int(template["priority"] if template else (summary["severity_rank"] * 3)),
                "implementation_difficulty": (
                    template["implementation_difficulty"] if template else "medium"
                ),
                "estimated_time_minutes": int(
                    (template["estimated_time_minutes"] if template else 20)
                    + max(summary["count"] - 1, 0) * 5
                ),
                "steps_to_fix": summary["sample_recommendation"],
            }
        )

    recommendations.sort(key=lambda item: item["priority"], reverse=True)
    return recommendations


@router.get(
    "/books/{book_id}/exports",
    response_model=PaginatedResponse[ExportListResponse],
    summary="List exports for a book",
)
async def list_exports(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    format: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """List all exports for a book."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Build query
    query = select(Export).where(Export.book_id == book_id)

    if format:
        query = query.where(Export.format == format)

    if status_filter:
        query = query.where(Export.status == status_filter)

    # Count total
    total_result = await db.execute(
        select(func.count(Export.id)).where(Export.book_id == book_id)
    )
    total = total_result.scalar() or 0

    # Apply sorting and pagination
    query = query.order_by(Export.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    exports = result.scalars().all()

    # Build responses
    items = [ExportResponse.model_validate(exp) for exp in exports]
    total_pages = (total + limit - 1) // limit

    return PaginatedResponse(
        data=ExportListResponse(
            data=items,
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        ),
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.get(
    "/books/{book_id}/exports/{export_id}",
    response_model=ExportResponse,
    summary="Get export details",
)
async def get_export(
    book_id: uuid.UUID,
    export_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get details of a specific export."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get export
    result = await db.execute(
        select(Export).where(
            Export.id == export_id,
            Export.book_id == book_id,
        )
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )

    return ExportResponse.model_validate(export)


@router.post(
    "/books/{book_id}/exports",
    response_model=ExportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create export",
)
async def create_export(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    export_data: ExportCreate,
):
    """Create a new export for a book."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Validate format
    try:
        ExportFormat(export_data.format)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid format: {export_data.format}",
        )

    # Create export
    export = Export(
        id=uuid.uuid4(),
        book_id=book_id,
        initiated_by=user_id,
        format=export_data.format,
        export_options=export_data.options.model_dump(),
        status=ExportStatus.PENDING.value,
        title=export_data.title or book.title,
        description=export_data.description or book.description,
    )

    db.add(export)
    await db.commit()
    await db.refresh(export)

    # TODO: Queue export job for processing (Celery task, etc.)

    return ExportResponse.model_validate(export)


@router.get(
    "/books/{book_id}/exports/{export_id}/progress",
    response_model=ExportProgressResponse,
    summary="Get export progress",
)
async def get_export_progress(
    book_id: uuid.UUID,
    export_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get progress of an ongoing export."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get export
    result = await db.execute(
        select(Export).where(
            Export.id == export_id,
            Export.book_id == book_id,
        )
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )

    # Calculate progress
    progress_map = {
        ExportStatus.PENDING.value: 0,
        ExportStatus.PROCESSING.value: 50,
        ExportStatus.COMPLETED.value: 100,
        ExportStatus.FAILED.value: 0,
    }

    return ExportProgressResponse(
        export_id=export.id,
        status=export.status,
        progress_percent=progress_map.get(export.status, 0),
        current_step="Generating export..." if export.status == ExportStatus.PROCESSING.value else None,
    )


@router.get(
    "/books/{book_id}/export-metadata",
    response_model=ExportMetadataResponse,
    summary="Get export metadata",
)
async def get_export_metadata(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get metadata for export generation."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Calculate metadata
    word_count = book.word_count
    chapter_count = book.chapter_count
    estimated_pages = max(1, word_count // 250)  # Rough estimate: 250 words per page

    return ExportMetadataResponse(
        book_id=book.id,
        title=book.title,
        author=book.author_name,
        description=book.description,
        word_count=word_count,
        chapter_count=chapter_count,
        estimated_pages=estimated_pages,
    )


@router.get(
    "/books/{book_id}/exports/{export_id}/download",
    response_model=ExportDownloadResponse,
    summary="Get export download URL",
)
async def get_export_download(
    book_id: uuid.UUID,
    export_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get a download URL for a completed export."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get export
    result = await db.execute(
        select(Export).where(
            Export.id == export_id,
            Export.book_id == book_id,
        )
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )

    if export.status != ExportStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Export not ready for download (status: {export.status})",
        )

    if not export.file_path:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export file not found",
        )

    # Generate download URL (in real implementation, use signed S3 URLs or similar)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    file_name = f"{book.title.replace(' ', '_')}_{export.format.upper()}"

    return ExportDownloadResponse(
        export_id=export.id,
        file_name=file_name,
        file_size=export.file_size or 0,
        download_url=f"/api/v1/books/{book_id}/exports/{export_id}/file",
        expires_at=expires_at,
        format=export.format,
    )


@router.delete(
    "/books/{book_id}/exports/{export_id}",
    response_model=MessageResponse,
    summary="Delete export",
)
async def delete_export(
    book_id: uuid.UUID,
    export_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Delete an export."""
    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get export
    result = await db.execute(
        select(Export).where(
            Export.id == export_id,
            Export.book_id == book_id,
        )
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found",
        )

    # Delete
    await db.delete(export)
    await db.commit()

    return MessageResponse(message="Export deleted successfully")


@router.get(
    "/books/{book_id}/compile-preview",
    summary="Generate compile preview",
)
async def get_compile_preview(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    include_front_matter: bool = Query(True),
    include_back_matter: bool = Query(True),
    include_toc: bool = Query(True),
    page_size: str = Query("letter"),
    font_size: int = Query(12, ge=8, le=24),
    line_spacing: float = Query(1.5, ge=1.0, le=2.5),
    preview_mode: str = Query("print", pattern="^(print|ebook|submission)$"),
):
    """Generate a deterministic, paginated compile preview for publishing workflows."""
    book_result = await db.execute(
        select(Book)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
        .where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    project_settings = book.project_settings if isinstance(book.project_settings, dict) else {}
    publishing_layout = project_settings.get("publishing_layout")
    if not isinstance(publishing_layout, dict):
        publishing_layout = {}

    title_page_config = publishing_layout.get("title_page")
    if not isinstance(title_page_config, dict):
        title_page_config = {}

    toc_config = publishing_layout.get("toc")
    if not isinstance(toc_config, dict):
        toc_config = {}

    words_per_page_map = {
        "print": 250,
        "ebook": 320,
        "submission": 280,
    }
    words_per_page = words_per_page_map.get(preview_mode, 250)

    sections = []

    def add_section(section_type: str, title: str, content: Optional[str]) -> None:
        text = _plain_text(content)
        words = _word_count(text)
        anchor = _slugify(f"{section_type}-{title}")
        paragraph_metrics = _paragraph_metrics(text)
        section = {
            "type": section_type,
            "title": title,
            "anchor": anchor,
            "word_count": words,
            "estimated_pages": _estimate_pages(words, words_per_page=words_per_page),
            "excerpt": text[:600],
            "has_content": bool(text),
            "paragraph_count": paragraph_metrics["paragraph_count"],
            "longest_paragraph_words": paragraph_metrics["longest_paragraph_words"],
            "long_paragraph_count": paragraph_metrics["long_paragraph_count"],
            "short_paragraph_count": paragraph_metrics["short_paragraph_count"],
        }
        sections.append(section)

    title_page_lines = []
    title_page_title = str(title_page_config.get("title") or book.title or "").strip()
    title_page_subtitle = str(title_page_config.get("subtitle") or book.subtitle or "").strip()
    title_page_author = str(title_page_config.get("author") or book.author_name or "").strip()
    title_page_tagline = str(title_page_config.get("tagline") or "").strip()

    if title_page_title:
        title_page_lines.append(title_page_title)
    if title_page_subtitle:
        title_page_lines.append(title_page_subtitle)
    if title_page_author:
        title_page_lines.append(f"By {title_page_author}")
    if title_page_tagline:
        title_page_lines.append(title_page_tagline)

    if title_page_lines:
        add_section("title_page", "Title Page", "\n".join(title_page_lines))

    if include_front_matter:
        add_section("front_matter", "Dedication", book.dedication)
        add_section("front_matter", "Acknowledgments", book.acknowledgments)
        add_section("front_matter", "Preface", book.preface)
        add_section("front_matter", "Introduction", book.introduction)

    chapter_associations = sorted(
        list(book.chapter_associations), key=lambda assoc: assoc.order_index
    )

    if include_toc:
        toc_mode = str(toc_config.get("mode") or "auto").strip().lower()
        toc_entries = toc_config.get("entries")
        toc_lines = []

        if toc_mode == "manual" and isinstance(toc_entries, list):
            for entry in toc_entries:
                if isinstance(entry, dict):
                    title = str(entry.get("title") or "").strip()
                    page = str(entry.get("page") or "").strip()
                    if not title:
                        continue
                    toc_lines.append(f"{title} {page}".strip())

        if not toc_lines:
            for assoc in chapter_associations:
                chapter = assoc.chapter
                if chapter:
                    chapter_number = chapter.chapter_number or (assoc.order_index + 1)
                    toc_lines.append(f"Chapter {chapter_number}: {chapter.title}")
        add_section("toc", "Table of Contents", "\n".join(toc_lines))

    for assoc in chapter_associations:
        chapter = assoc.chapter
        if chapter is None:
            continue
        chapter_number = chapter.chapter_number or (assoc.order_index + 1)
        chapter_content = chapter.compiled_content or chapter.description or chapter.summary or ""
        add_section(
            "chapter",
            f"Chapter {chapter_number}: {chapter.title}",
            chapter_content,
        )

    if include_back_matter:
        add_section("back_matter", "Epilogue", book.epilogue)
        add_section("back_matter", "Afterword", book.afterword)
        add_section("back_matter", "About the Author", book.about_author)

    sections = [section for section in sections if section["has_content"]]

    pagination = []
    current_page = 1
    layout_warnings = []
    for section in sections:
        start_page = current_page
        end_page = current_page + section["estimated_pages"] - 1
        pagination.append(
            {
                "type": section["type"],
                "title": section["title"],
                "anchor": section["anchor"],
                "start_page": start_page,
                "end_page": end_page,
            }
        )
        current_page = end_page + 1

        if section["word_count"] < 120:
            layout_warnings.append(
                {
                    "section": section["title"],
                    "warning": "Very short section may cause orphan/widow layout in print.",
                }
            )

        if section["long_paragraph_count"] > 0:
            layout_warnings.append(
                {
                    "section": section["title"],
                    "warning": "Long paragraph detected; consider splitting to reduce page-flow breaks.",
                }
            )

    total_words = sum(section["word_count"] for section in sections)
    estimated_pages = max(1, current_page - 1)

    preview_sections = []
    for section in sections:
        excerpt_html = html.escape(section["excerpt"]).replace("\n", "<br/>")
        preview_sections.append(
            ""
            f"<section id='{html.escape(section['anchor'])}' class='compile-preview-section' data-type='{html.escape(section['type'])}'>"
            f"<h2>{html.escape(section['title'])}</h2>"
            f"<p>{excerpt_html or '<em>No content</em>'}</p>"
            "<div class='page-break'></div>"
            "</section>"
        )

    preview_html = (
        "<article class='compile-preview'>"
        f"<header><h1>{html.escape(book.title)}</h1>"
        f"<p>Author: {html.escape(book.author_name or 'Unknown')}</p>"
        f"<p>Mode: {html.escape(preview_mode.title())} | {page_size.upper()} | {font_size}pt | {line_spacing:.2f} spacing</p></header>"
        + "".join(preview_sections)
        + "</article>"
    )

    sections_with_short_content = len([section for section in sections if section["word_count"] < 120])
    sections_with_long_paragraphs = len([section for section in sections if section["long_paragraph_count"] > 0])

    return {
        "book_id": str(book.id),
        "title": book.title,
        "author": book.author_name,
        "page_size": page_size,
        "font_size": font_size,
        "line_spacing": line_spacing,
        "preview_mode": preview_mode,
        "total_sections": len(sections),
        "total_word_count": total_words,
        "estimated_pages": estimated_pages,
        "sections": sections,
        "pagination": pagination,
        "layout_warnings": layout_warnings,
        "layout_diagnostics": {
            "words_per_page": words_per_page,
            "sections_with_short_content": sections_with_short_content,
            "sections_with_long_paragraphs": sections_with_long_paragraphs,
        },
        "preview_html": preview_html,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/books/{book_id}/accessibility-checks",
    summary="Run accessibility checks for publishing output",
)
async def get_accessibility_checks(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Analyze publishing accessibility issues for alt text, headings, tables, contrast, and metadata."""
    book_result = await db.execute(
        select(Book)
        .options(
            selectinload(Book.chapter_associations).selectinload(BookChapter.chapter)
        )
        .where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    issues: list[dict] = []
    images_checked = 0
    tables_checked = 0
    headings_checked = 0

    def add_issue(
        severity: str,
        category: str,
        section: str,
        message: str,
        recommendation: str,
    ) -> None:
        issues.append(
            {
                "id": f"issue-{len(issues) + 1}",
                "severity": severity,
                "category": category,
                "section": section,
                "message": message,
                "recommendation": recommendation,
            }
        )

    project_settings = (
        dict(book.project_settings) if isinstance(book.project_settings, dict) else {}
    )
    publishing_metadata = project_settings.get("publishing_metadata")
    if not isinstance(publishing_metadata, dict):
        publishing_metadata = {}

    theme_settings = project_settings.get("formatting_theme")
    if not isinstance(theme_settings, dict):
        theme_settings = {}

    text_color = str(theme_settings.get("text_color") or "#000000")
    background_color = str(theme_settings.get("background_color") or "#FFFFFF")
    contrast = _contrast_ratio(text_color, background_color)

    if contrast is None:
        add_issue(
            severity="warning",
            category="contrast",
            section="Theme",
            message="Unable to validate text/background contrast because one or more color values are invalid.",
            recommendation="Use valid hex colors (for example #000000 and #FFFFFF) in formatting theme settings.",
        )
    elif contrast < 3.0:
        add_issue(
            severity="error",
            category="contrast",
            section="Theme",
            message=f"Low text contrast ratio detected ({contrast:.2f}:1).",
            recommendation="Increase contrast to at least 4.5:1 for normal text to improve readability and WCAG AA conformance.",
        )
    elif contrast < 4.5:
        add_issue(
            severity="warning",
            category="contrast",
            section="Theme",
            message=f"Contrast ratio is below WCAG AA for normal text ({contrast:.2f}:1).",
            recommendation="Target at least 4.5:1 for body text, or use larger font sizes with stronger weight.",
        )

    if not book.author_name:
        add_issue(
            severity="warning",
            category="metadata",
            section="Metadata",
            message="Author metadata is missing.",
            recommendation="Set the author name in publishing metadata to improve document accessibility metadata completeness.",
        )

    if not publishing_metadata.get("publisher"):
        add_issue(
            severity="info",
            category="metadata",
            section="Metadata",
            message="Publisher metadata is not set.",
            recommendation="Set publisher information so exported documents include richer publication metadata.",
        )

    if not publishing_metadata.get("isbn"):
        add_issue(
            severity="info",
            category="metadata",
            section="Metadata",
            message="ISBN metadata is not set.",
            recommendation="Add ISBN metadata when available for better cataloging and assistive reading system references.",
        )

    if not publishing_metadata.get("publication_date"):
        add_issue(
            severity="info",
            category="metadata",
            section="Metadata",
            message="Publication date metadata is missing.",
            recommendation="Set publication date in publishing metadata to complete export document properties.",
        )

    chapter_associations = sorted(
        list(book.chapter_associations), key=lambda assoc: assoc.order_index
    )

    for association in chapter_associations:
        chapter = association.chapter
        if chapter is None:
            continue

        chapter_number = chapter.chapter_number or (association.order_index + 1)
        section_label = f"Chapter {chapter_number}: {chapter.title}"
        chapter_content = chapter.compiled_content or chapter.description or chapter.summary or ""
        if not chapter_content.strip():
            continue

        image_matches = list(_IMG_TAG_RE.finditer(chapter_content))
        images_checked += len(image_matches)
        for image_index, image_match in enumerate(image_matches, start=1):
            image_tag = image_match.group(0)
            alt_match = _ALT_ATTR_RE.search(image_tag)
            if not alt_match or not alt_match.group(2).strip():
                add_issue(
                    severity="warning",
                    category="alt_text",
                    section=section_label,
                    message=f"Image {image_index} is missing descriptive alt text.",
                    recommendation="Add concise alt text that describes the image content or mark decorative images with empty alt text intentionally.",
                )

        heading_levels = _heading_levels(chapter_content)
        headings_checked += len(heading_levels)
        if heading_levels:
            if heading_levels[0] > 1:
                add_issue(
                    severity="warning",
                    category="heading_hierarchy",
                    section=section_label,
                    message=f"Heading structure starts at H{heading_levels[0]} instead of H1.",
                    recommendation="Start each chapter structure at H1, then descend sequentially to improve screen reader navigation.",
                )

            for previous_level, current_level in zip(heading_levels, heading_levels[1:]):
                if current_level - previous_level > 1:
                    add_issue(
                        severity="warning",
                        category="heading_hierarchy",
                        section=section_label,
                        message=f"Heading level jumps from H{previous_level} to H{current_level}.",
                        recommendation="Avoid skipping heading levels (for example H2 -> H4). Use a sequential heading hierarchy.",
                    )
                    break

        table_matches = list(_TABLE_TAG_RE.finditer(chapter_content))
        tables_checked += len(table_matches)
        for table_index, table_match in enumerate(table_matches, start=1):
            table_html = table_match.group(0)
            if not _TH_TAG_RE.search(table_html):
                add_issue(
                    severity="warning",
                    category="table_structure",
                    section=section_label,
                    message=f"Table {table_index} has no header cells (<th>).",
                    recommendation="Add header cells (<th>) and scope attributes when appropriate to improve assistive navigation.",
                )

            if not _CAPTION_TAG_RE.search(table_html):
                add_issue(
                    severity="info",
                    category="table_structure",
                    section=section_label,
                    message=f"Table {table_index} has no caption.",
                    recommendation="Add table captions to provide context for screen reader users.",
                )

    issues_by_severity = {
        "error": len([issue for issue in issues if issue["severity"] == "error"]),
        "warning": len([issue for issue in issues if issue["severity"] == "warning"]),
        "info": len([issue for issue in issues if issue["severity"] == "info"]),
    }

    accessibility_score = max(
        0,
        100
        - (issues_by_severity["error"] * 25)
        - (issues_by_severity["warning"] * 10)
        - (issues_by_severity["info"] * 3),
    )

    contrast_meets_aa = contrast is not None and contrast >= 4.5
    contrast_meets_aaa = contrast is not None and contrast >= 7.0

    wcag_aa_compliant = issues_by_severity["error"] == 0 and contrast_meets_aa
    wcag_aaa_compliant = (
        wcag_aa_compliant
        and contrast_meets_aaa
        and issues_by_severity["warning"] == 0
    )

    if wcag_aaa_compliant:
        wcag_level = "AAA"
    elif wcag_aa_compliant:
        wcag_level = "AA"
    elif issues_by_severity["error"] == 0:
        wcag_level = "A"
    else:
        wcag_level = "Needs Improvement"

    metadata_complete = bool(
        book.title
        and (book.author_name or publishing_metadata.get("author"))
        and publishing_metadata.get("publisher")
        and publishing_metadata.get("publication_date")
    )

    checked_at = datetime.now(timezone.utc).isoformat()
    recommendations = _build_accessibility_recommendations(issues)

    historical_entries = _normalize_accessibility_history(
        project_settings.get("publishing_accessibility_history")
    )
    latest_scan_summary = {
        "checked_at": checked_at,
        "accessibility_score": accessibility_score,
        "total_issues": len(issues),
        "wcag_level": wcag_level,
        "issues_by_severity": issues_by_severity,
    }
    updated_history = [latest_scan_summary, *historical_entries][:25]
    project_settings["publishing_accessibility_history"] = updated_history
    book.project_settings = project_settings
    db.add(book)
    await db.commit()

    history_summary = _build_accessibility_history_summary(updated_history)

    return {
        "book_id": str(book.id),
        "checked_at": checked_at,
        "total_issues": len(issues),
        "issues_by_severity": issues_by_severity,
        "accessibility_score": accessibility_score,
        "wcag_level": wcag_level,
        "wcag_aa_compliant": wcag_aa_compliant,
        "wcag_aaa_compliant": wcag_aaa_compliant,
        "history_summary": history_summary,
        "recommendations": {
            "total_recommendations": len(recommendations),
            "open_count": len([item for item in recommendations if item["status"] == "open"]),
            "recommendations": recommendations,
        },
        "issues": issues,
        "checks": {
            "images_checked": images_checked,
            "tables_checked": tables_checked,
            "headings_checked": headings_checked,
            "contrast_ratio": round(contrast, 2) if contrast is not None else None,
            "text_color": text_color,
            "background_color": background_color,
            "metadata_complete": metadata_complete,
        },
    }


@router.get(
    "/books/{book_id}/accessibility-checks/history",
    summary="Get publishing accessibility check history",
)
async def get_accessibility_checks_history(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get the stored publishing accessibility check history for a book."""
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    project_settings = book.project_settings if isinstance(book.project_settings, dict) else {}
    history_entries = _normalize_accessibility_history(
        project_settings.get("publishing_accessibility_history")
    )
    return _build_accessibility_history_summary(history_entries)


@router.get(
    "/books/{book_id}/accessibility-checks/wcag-guidelines",
    summary="Get WCAG guidance for publishing accessibility checks",
)
async def get_accessibility_check_guidelines(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Return WCAG guidance payload scoped to publishing accessibility checks."""
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    return {
        "wcag_versions": [
            {
                "version": "WCAG 2.1",
                "url": "https://www.w3.org/WAI/WCAG21/quickref/",
                "levels": ["A", "AA", "AAA"],
            },
            {
                "version": "WCAG 2.2",
                "url": "https://www.w3.org/WAI/WCAG22/quickref/",
                "levels": ["A", "AA", "AAA"],
            },
        ],
        "accessibility_checks": [
            {
                "id": "alt_text",
                "name": "Alternative Text",
                "criterion": "1.1.1",
                "level": "A",
                "description": "Images should include descriptive alt text unless they are purely decorative.",
                "tips": [
                    "Describe the image purpose, not every visual detail.",
                    "Use empty alt text for decorative images.",
                ],
            },
            {
                "id": "color_contrast",
                "name": "Color Contrast",
                "criterion": "1.4.3",
                "level": "AA",
                "description": "Body text should maintain sufficient contrast against background colors.",
                "thresholds": {
                    "normal_text": "4.5:1",
                    "large_text": "3:1",
                    "enhanced_aaa": "7:1",
                },
            },
            {
                "id": "heading_hierarchy",
                "name": "Heading Hierarchy",
                "criterion": "1.3.1",
                "level": "A",
                "description": "Headings should form a logical, sequential outline structure.",
                "tips": [
                    "Start with H1, then descend sequentially.",
                    "Avoid skipping heading levels.",
                ],
            },
            {
                "id": "table_structure",
                "name": "Table Structure",
                "criterion": "1.3.1",
                "level": "A",
                "description": "Tables should include header cells and helpful captions for context.",
                "tips": [
                    "Use <th> for header cells.",
                    "Add captions when the table needs context.",
                ],
            },
        ],
        "tools": [
            {
                "name": "WAVE",
                "type": "Browser Extension",
                "url": "https://wave.webaim.org/",
            },
            {
                "name": "axe DevTools",
                "type": "Browser Extension",
                "url": "https://www.deque.com/axe/devtools/",
            },
            {
                "name": "Lighthouse",
                "type": "Browser Tool",
                "url": "https://developer.chrome.com/docs/lighthouse/",
            },
        ],
    }
