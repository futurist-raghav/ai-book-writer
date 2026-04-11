"""Device preview configuration API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models import Book, DevicePreviewConfig, User
from app.schemas.device_preview import DevicePreviewConfigResponse, DevicePreviewConfigUpdate

router = APIRouter()


@router.get(
    "/books/{book_id}/device-preview",
    response_model=DevicePreviewConfigResponse,
    tags=["Device Preview"],
)
async def get_device_preview_config(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DevicePreviewConfigResponse:
    """Get device preview configuration for a book (creates default if missing)."""
    from sqlalchemy import select

    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create config
    stmt = select(DevicePreviewConfig).filter(DevicePreviewConfig.book_id == book_id)
    result = await db.execute(stmt)
    config = result.scalars().first()

    if not config:
        # Create default config
        config = DevicePreviewConfig(book_id=book_id)
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return DevicePreviewConfigResponse.model_validate(config)


@router.patch(
    "/books/{book_id}/device-preview",
    response_model=DevicePreviewConfigResponse,
    tags=["Device Preview"],
)
async def update_device_preview_config(
    book_id: str,
    payload: DevicePreviewConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DevicePreviewConfigResponse:
    """Update device preview configuration for a book."""
    from sqlalchemy import select

    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create config
    stmt = select(DevicePreviewConfig).filter(DevicePreviewConfig.book_id == book_id)
    result = await db.execute(stmt)
    config = result.scalars().first()

    if not config:
        config = DevicePreviewConfig(book_id=book_id)
        db.add(config)

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(config, field):
            setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return DevicePreviewConfigResponse.model_validate(config)


@router.post(
    "/books/{book_id}/device-preview/reset",
    response_model=DevicePreviewConfigResponse,
    tags=["Device Preview"],
)
async def reset_device_preview_config(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DevicePreviewConfigResponse:
    """Reset device preview configuration to defaults."""
    from sqlalchemy import select

    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create config
    stmt = select(DevicePreviewConfig).filter(DevicePreviewConfig.book_id == book_id)
    result = await db.execute(stmt)
    config = result.scalars().first()

    if not config:
        # Create new default config
        config = DevicePreviewConfig(book_id=book_id)
        db.add(config)
    else:
        # Reset to defaults by creating a new instance and copying values
        defaults = DevicePreviewConfig(book_id=book_id)
        for column in DevicePreviewConfig.__table__.columns:
            if column.name not in ("id", "book_id", "created_at"):
                setattr(config, column.name, getattr(defaults, column.name))

    await db.commit()
    await db.refresh(config)

    return DevicePreviewConfigResponse.model_validate(config)


@router.get(
    "/device-preview/presets",
    tags=["Device Preview"],
)
async def get_device_presets() -> dict:
    """Get predefined device presets and specifications."""
    return {
        "devices": [
            {
                "id": "kindle_6",
                "name": "Kindle 6\"",
                "category": "e-reader",
                "description": "Standard Amazon Kindle 6-inch e-reader",
                "width_px": 600,
                "height_px": 800,
                "margin_px": 40,
                "diagonal_inches": 6.0,
                "color_support": False,
                "typical_font_sizes": [10, 11, 12, 13, 14],
            },
            {
                "id": "kindle_pw",
                "name": "Kindle Paperwhite 7\"",
                "category": "e-reader",
                "description": "Amazon Kindle Paperwhite 7-inch e-reader with backlight",
                "width_px": 758,
                "height_px": 1024,
                "margin_px": 50,
                "diagonal_inches": 7.0,
                "color_support": False,
                "typical_font_sizes": [11, 12, 13, 14, 15],
            },
            {
                "id": "tablet",
                "name": "iPad / Tablet",
                "category": "device",
                "description": "iPad (10.2\" or larger) / Android tablet",
                "width_px": 1024,
                "height_px": 1366,
                "margin_px": 80,
                "diagonal_inches": 10.0,
                "color_support": True,
                "typical_font_sizes": [12, 13, 14, 15, 16],
            },
            {
                "id": "phone",
                "name": "Smartphone",
                "category": "device",
                "description": "iPhone or Android smartphone (5-6\")",
                "width_px": 414,
                "height_px": 896,
                "margin_px": 20,
                "diagonal_inches": 5.8,
                "color_support": True,
                "typical_font_sizes": [14, 15, 16, 17, 18],
            },
            {
                "id": "print_6x9",
                "name": "Print 6x9\"",
                "category": "print",
                "description": "Standard paperback binding (6\" × 9\")",
                "width_px": 432,
                "height_px": 648,
                "margin_top_px": 60,
                "margin_bottom_px": 60,
                "margin_left_px": 48,
                "margin_right_px": 48,
                "diagonal_inches": 10.8,
                "color_support": False,
                "typical_font_sizes": [10, 11, 12],
            },
            {
                "id": "print_8x10",
                "name": "Print 8x10\"",
                "category": "print",
                "description": "Large hardcover binding (8\" × 10\")",
                "width_px": 576,
                "height_px": 720,
                "margin_top_px": 80,
                "margin_bottom_px": 80,
                "margin_left_px": 64,
                "margin_right_px": 64,
                "diagonal_inches": 12.8,
                "color_support": False,
                "typical_font_sizes": [11, 12, 13],
            },
            {
                "id": "print_a4",
                "name": "Print A4",
                "category": "print",
                "description": "European standard A4 (210 × 297 mm / 8.3\" × 11.7\")",
                "width_px": 794,
                "height_px": 1123,
                "margin_top_px": 80,
                "margin_bottom_px": 80,
                "margin_left_px": 80,
                "margin_right_px": 80,
                "diagonal_inches": 11.7,
                "color_support": False,
                "typical_font_sizes": [10, 11, 12],
            },
            {
                "id": "web",
                "name": "Web / Desktop",
                "category": "digital",
                "description": "Desktop browser or web reader",
                "width_px": 900,
                "height_px": 1200,
                "margin_px": 60,
                "diagonal_inches": 15.0,
                "color_support": True,
                "typical_font_sizes": [12, 13, 14, 15, 16],
            },
        ],
        "categories": {
            "e-reader": {"label": "E-Readers", "icon": "📱", "color": "bg-amber-100"},
            "device": {"label": "Tablets & Phones", "icon": "📲", "color": "bg-blue-100"},
            "print": {"label": "Print", "icon": "🖨️", "color": "bg-purple-100"},
            "digital": {"label": "Digital", "icon": "💻", "color": "bg-green-100"},
        },
    }
