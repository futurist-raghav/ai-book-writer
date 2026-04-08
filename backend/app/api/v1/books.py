"""
Books API Routes

Handles book management and export.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book, BookChapter, BookStatus
from app.models.chapter import Chapter, ChapterStatus
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
    BookPinUpdate,
    BookResponse,
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
