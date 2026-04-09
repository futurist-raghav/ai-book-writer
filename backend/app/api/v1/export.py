"""
Export/Publishing API Routes

Handles book export and publishing operations.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
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
