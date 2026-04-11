"""Export bundle management API endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.dependencies import get_current_user, get_db
from app.models import Book, ExportBundle, User
from app.schemas.export_bundle import (
    ExportBundleExecuteRequest,
    ExportBundleExecuteResponse,
    ExportBundleListResponse,
    ExportBundleResponse,
    ExportBundleUpdate,
)

router = APIRouter()


@router.get(
    "/books/{book_id}/export-bundles",
    response_model=ExportBundleListResponse,
    tags=["Export Bundles"],
)
async def get_export_bundles(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportBundleListResponse:
    """Get all export bundles for a book (creates presets if missing)."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get existing bundles
    stmt = select(ExportBundle).filter(ExportBundle.book_id == book_id)
    result = await db.execute(stmt)
    bundles = result.scalars().all()

    # Create default bundles if missing
    if not bundles:
        bundle_types = ["kdp", "agent", "beta", "print", "ebook"]
        for bundle_type in bundle_types:
            bundle = ExportBundle(
                book_id=book_id,
                bundle_type=bundle_type,
                primary_format="pdf" if bundle_type != "kindle" else "mobi",
            )
            db.add(bundle)
        await db.commit()

        # Fetch created bundles
        result = await db.execute(stmt)
        bundles = result.scalars().all()

    bundle_responses = [ExportBundleResponse.model_validate(b) for b in bundles]
    return ExportBundleListResponse(
        book_id=book_id,
        bundles=bundle_responses,
    )


@router.get(
    "/books/{book_id}/export-bundles/{bundle_type}",
    response_model=ExportBundleResponse,
    tags=["Export Bundles"],
)
async def get_export_bundle(
    book_id: str,
    bundle_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportBundleResponse:
    """Get a specific export bundle by type."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get bundle
    stmt = select(ExportBundle).filter(
        ExportBundle.book_id == book_id,
        ExportBundle.bundle_type == bundle_type,
    )
    result = await db.execute(stmt)
    bundle = result.scalars().first()

    if not bundle:
        # Create default bundle if missing
        bundle = ExportBundle(
            book_id=book_id,
            bundle_type=bundle_type,
            primary_format="pdf",
        )
        db.add(bundle)
        await db.commit()
        await db.refresh(bundle)

    return ExportBundleResponse.model_validate(bundle)


@router.patch(
    "/books/{book_id}/export-bundles/{bundle_type}",
    response_model=ExportBundleResponse,
    tags=["Export Bundles"],
)
async def update_export_bundle(
    book_id: str,
    bundle_type: str,
    payload: ExportBundleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportBundleResponse:
    """Update an export bundle configuration."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get bundle
    stmt = select(ExportBundle).filter(
        ExportBundle.book_id == book_id,
        ExportBundle.bundle_type == bundle_type,
    )
    result = await db.execute(stmt)
    bundle = result.scalars().first()

    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export bundle not found")

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(bundle, field):
            setattr(bundle, field, value)

    await db.commit()
    await db.refresh(bundle)

    return ExportBundleResponse.model_validate(bundle)


@router.post(
    "/books/{book_id}/export-bundles/{bundle_type}/execute",
    response_model=ExportBundleExecuteResponse,
    tags=["Export Bundles"],
)
async def execute_export_bundle(
    book_id: str,
    bundle_type: str,
    payload: ExportBundleExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportBundleExecuteResponse:
    """Execute an export bundle (generate and queue download)."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get bundle
    stmt = select(ExportBundle).filter(
        ExportBundle.book_id == book_id,
        ExportBundle.bundle_type == bundle_type,
    )
    result = await db.execute(stmt)
    bundle = result.scalars().first()

    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export bundle not found")

    # Update export history
    bundle.last_exported_at = datetime.now(timezone.utc)
    bundle.export_count += 1

    await db.commit()
    await db.refresh(bundle)

    # TODO: Queue export job in background task queue (Celery)
    # For now, return success with placeholder file URL
    return ExportBundleExecuteResponse(
        success=True,
        message=f"Export job queued for {bundle_type} bundle",
        file_url=f"/api/v1/books/{book_id}/export-bundles/{bundle_type}/download",
        file_size_bytes=None,  # Will be updated when export completes
        estimated_download_time_seconds=30,
        created_at=datetime.now(timezone.utc),
    )


@router.get(
    "/books/{book_id}/export-bundles/presets",
    tags=["Export Bundles"],
)
async def get_export_bundle_presets() -> dict:
    """Get predefined export bundle templates and configurations."""
    return {
        "bundles": [
            {
                "id": "kdp",
                "name": "Amazon KDP",
                "icon": "📘",
                "description": "Kindle Direct Publishing - Optimized for Amazon's publishing platform",
                "formats": ["pdf", "epub", "mobi"],
                "default_config": {
                    "primary_format": "pdf",
                    "kdp_enabled": True,
                    "kdp_trim_size": "6x9",
                    "kdp_paper_type": "white",
                    "kdp_bleed_enabled": False,
                    "include_front_matter": True,
                    "include_back_matter": True,
                },
            },
            {
                "id": "agent",
                "name": "Literary Agent",
                "icon": "📄",
                "description": "Professional manuscript submission format for literary agents",
                "formats": ["docx", "pdf"],
                "default_config": {
                    "primary_format": "docx",
                    "agent_enabled": True,
                    "agent_double_spaced": True,
                    "agent_include_page_numbers": True,
                    "agent_include_word_count": True,
                    "preserve_formatting": False,
                },
            },
            {
                "id": "beta",
                "name": "Beta Readers",
                "icon": "👥",
                "description": "Reader-friendly PDF with wide margins for feedback",
                "formats": ["pdf"],
                "default_config": {
                    "primary_format": "pdf",
                    "beta_enabled": True,
                    "beta_include_comments_enabled": True,
                    "beta_include_line_numbers": True,
                    "beta_wide_margins": True,
                    "beta_margin_size_inches": 1.5,
                },
            },
            {
                "id": "print",
                "name": "Print-On-Demand",
                "icon": "🖨️",
                "description": "Print-ready PDF with bleeds and color settings",
                "formats": ["pdf"],
                "default_config": {
                    "primary_format": "pdf",
                    "print_enabled": True,
                    "print_trim_size": "6x9",
                    "print_color_mode": "bw",
                    "print_binding_type": "perfect",
                    "print_include_bleed": True,
                    "print_bleed_size_inches": 0.125,
                    "image_dpi": 300,
                },
            },
            {
                "id": "ebook",
                "name": "E-Book",
                "icon": "📱",
                "description": "E-book optimized format for multiple platforms",
                "formats": ["epub", "mobi"],
                "default_config": {
                    "primary_format": "epub",
                    "ebook_enabled": True,
                    "ebook_include_drm": False,
                    "ebook_include_enhanced_fonts": True,
                    "compress_images": True,
                    "image_dpi": 150,
                },
            },
        ],
        "trim_sizes": [
            {"id": "6x9", "name": "6\" × 9\" (Standard Paperback)", "category": "print"},
            {"id": "8x10", "name": "8\" × 10\" (Hardcover)", "category": "print"},
            {"id": "5x8", "name": "5\" × 8\" (Mass Market)", "category": "print"},
            {"id": "a4", "name": "A4 (210 × 297 mm)", "category": "print"},
        ],
        "formats": [
            {"id": "pdf", "label": "PDF", "icon": "📄"},
            {"id": "epub", "label": "EPUB", "icon": "📗"},
            {"id": "mobi", "label": "MOBI (Kindle)", "icon": "📘"},
            {"id": "docx", "label": "Word Document", "icon": "📝"},
            {"id": "html", "label": "HTML", "icon": "🌐"},
        ],
    }
