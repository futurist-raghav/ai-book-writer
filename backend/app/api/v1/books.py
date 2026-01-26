"""
Books API Routes

Handles book management and export.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book, BookChapter, BookStatus
from app.models.chapter import Chapter
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
    BookResponse,
    BookUpdate,
)
from app.schemas.chapter import ChapterListResponse
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter()


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
):
    """
    List all books for the authenticated user.
    """
    query = select(Book).where(Book.user_id == user_id)

    if status_filter:
        query = query.where(Book.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(Book.updated_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    query = query.options(selectinload(Book.chapter_associations))

    result = await db.execute(query)
    books = result.scalars().all()

    items = [
        BookListResponse(
            id=b.id,
            title=b.title,
            subtitle=b.subtitle,
            author_name=b.author_name,
            book_type=b.book_type,
            status=b.status,
            word_count=b.word_count,
            chapter_count=len(b.chapter_associations),
            created_at=b.created_at,
        )
        for b in books
    ]

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
    book = Book(
        title=book_data.title,
        subtitle=book_data.subtitle,
        author_name=book_data.author_name,
        description=book_data.description,
        book_type=book_data.book_type,
        genres=book_data.genres,
        tags=book_data.tags,
        status=BookStatus.DRAFT.value,
        user_id=user_id,
    )

    db.add(book)
    await db.flush()

    # Add chapters if provided
    if book_data.chapter_ids:
        for idx, chapter_id in enumerate(book_data.chapter_ids):
            # Verify chapter belongs to user
            chapter_result = await db.execute(
                select(Chapter).where(
                    Chapter.id == chapter_id, Chapter.user_id == user_id
                )
            )
            if chapter_result.scalar_one_or_none():
                book_chapter = BookChapter(
                    book_id=book.id,
                    chapter_id=chapter_id,
                    order_index=idx,
                )
                db.add(book_chapter)

    await db.flush()
    await db.refresh(book)

    return BookResponse(
        id=book.id,
        title=book.title,
        subtitle=book.subtitle,
        author_name=book.author_name,
        description=book.description,
        cover_image_url=book.cover_image_url,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
        status=book.status,
        is_public=book.is_public,
        word_count=book.word_count,
        chapter_count=len(book_data.chapter_ids) if book_data.chapter_ids else 0,
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
                    chapter_number=chapter.chapter_number,
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
        cover_image_url=book.cover_image_url,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
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
        .options(selectinload(Book.chapter_associations))
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    update_data = book_data.model_dump(exclude_unset=True)
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
        cover_image_url=book.cover_image_url,
        book_type=book.book_type,
        genres=book.genres,
        tags=book.tags,
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
        if chapter_result.scalar_one_or_none():
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

    for idx, chapter_id in enumerate(reorder_data.chapter_ids):
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

    # TODO: Queue export task and generate file
    # For now, return placeholder response

    # Update book export info
    book.last_exported_at = datetime.now(timezone.utc)
    book.last_export_format = export_data.format
    await db.flush()

    # Calculate expiry (24 hours from now)
    expires_at = datetime.now(timezone.utc).replace(
        hour=datetime.now(timezone.utc).hour + 24
    )

    return BookExportResponse(
        id=book.id,
        format=export_data.format,
        download_url=f"/api/v1/books/{book_id}/download/{export_data.format}",
        file_size=0,  # TODO: Calculate actual size
        expires_at=expires_at,
        message=f"Book export to {export_data.format.upper()} queued. Download will be available shortly.",
    )
