"""Book metadata management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.dependencies import get_current_user, get_db
from app.models import Book, BookMetadata, User
from app.schemas.book_metadata import BookMetadataResponse, BookMetadataUpdate

router = APIRouter()


@router.get(
    "/books/{book_id}/metadata",
    response_model=BookMetadataResponse,
    tags=["Book Metadata"],
)
async def get_book_metadata(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookMetadataResponse:
    """Get book metadata (creates default if missing)."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create metadata
    stmt = select(BookMetadata).filter(BookMetadata.book_id == book_id)
    result = await db.execute(stmt)
    metadata = result.scalars().first()

    if not metadata:
        # Create default metadata
        metadata = BookMetadata(book_id=book_id, primary_language="en")
        db.add(metadata)
        await db.commit()
        await db.refresh(metadata)

    return BookMetadataResponse.model_validate(metadata)


@router.patch(
    "/books/{book_id}/metadata",
    response_model=BookMetadataResponse,
    tags=["Book Metadata"],
)
async def update_book_metadata(
    book_id: str,
    payload: BookMetadataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookMetadataResponse:
    """Update book metadata."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create metadata
    stmt = select(BookMetadata).filter(BookMetadata.book_id == book_id)
    result = await db.execute(stmt)
    metadata = result.scalars().first()

    if not metadata:
        metadata = BookMetadata(book_id=book_id)
        db.add(metadata)

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(metadata, field):
            setattr(metadata, field, value)

    await db.commit()
    await db.refresh(metadata)

    return BookMetadataResponse.model_validate(metadata)


@router.post(
    "/books/{book_id}/metadata/reset",
    response_model=BookMetadataResponse,
    tags=["Book Metadata"],
)
async def reset_book_metadata(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookMetadataResponse:
    """Reset book metadata to defaults."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get or create metadata
    stmt = select(BookMetadata).filter(BookMetadata.book_id == book_id)
    result = await db.execute(stmt)
    metadata = result.scalars().first()

    if not metadata:
        metadata = BookMetadata(book_id=book_id, primary_language="en")
        db.add(metadata)
    else:
        # Reset to defaults
        defaults = BookMetadata(book_id=book_id, primary_language="en")
        for column in BookMetadata.__table__.columns:
            if column.name not in ("id", "book_id", "created_at"):
                setattr(metadata, column.name, getattr(defaults, column.name))

    await db.commit()
    await db.refresh(metadata)

    return BookMetadataResponse.model_validate(metadata)


@router.get(
    "/metadata/classifications",
    tags=["Book Metadata"],
)
async def get_metadata_classifications() -> dict:
    """Get predefined metadata classifications and options."""
    return {
        "genres": [
            "Fiction",
            "Science Fiction",
            "Fantasy",
            "Mystery",
            "Thriller",
            "Romance",
            "Historical Fiction",
            "Literary Fiction",
            "Autobiography",
            "Biography",
            "Self-Help",
            "Business",
            "Education",
            "Science",
            "History",
            "Art",
            "Other",
        ],
        "reading_levels": [
            "Children (5-8)",
            "Early Readers (8-12)",
            "Young Adult (12-18)",
            "New Adult (18-25)",
            "Adult",
            "Senior",
            "Academic",
        ],
        "age_groups": [
            "0-3",
            "3-5",
            "5-8",
            "8-12",
            "12-15",
            "15-18",
            "18-25",
            "25-35",
            "35-50",
            "50+",
        ],
        "license_types": [
            {
                "id": "all-rights-reserved",
                "name": "All Rights Reserved",
                "description": "Standard copyright. Author retains all rights.",
            },
            {
                "id": "cc-by",
                "name": "Creative Commons Attribution",
                "description": "Allow others to use with attribution.",
            },
            {
                "id": "cc-by-sa",
                "name": "Creative Commons Attribution-ShareAlike",
                "description": "Allow modification and sharing with attribution.",
            },
            {
                "id": "cc-by-nd",
                "name": "Creative Commons Attribution-NoDerivatives",
                "description": "Allow sharing but not modification.",
            },
            {
                "id": "cc0",
                "name": "Public Domain (CC0)",
                "description": "Release all rights. Anyone can use freely.",
            },
        ],
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "it", "name": "Italian"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ru", "name": "Russian"},
            {"code": "ja", "name": "Japanese"},
            {"code": "zh", "name": "Chinese"},
            {"code": "ko", "name": "Korean"},
            {"code": "ar", "name": "Arabic"},
            {"code": "hi", "name": "Hindi"},
        ],
        "contributor_roles": [
            "Editor",
            "Copy Editor",
            "Proofreader",
            "Cover Designer",
            "Illustrator",
            "Translator",
            "Narrator",
            "Producer (Audio)",
            "Advisor",
            "Consultant",
        ],
        "bisac_categories": [
            {
                "code": "FIC000000",
                "category": "FICTION",
                "subcategories": [
                    "FIC000100",
                    "FIC002000",
                    "FIC006000",
                    "FIC009000",
                    "FIC012000",
                    "FIC017000",
                ],
            },
            {
                "code": "SCI000000",
                "category": "SCIENCE FICTION",
                "subcategories": [
                    "SCI000100",
                    "SCI000200",
                    "SCI000300",
                ],
            },
            {
                "code": "FAD000000",
                "category": "FANTASY",
                "subcategories": [
                    "FAD000100",
                    "FAD000200",
                ],
            },
            {
                "code": "BIO000000",
                "category": "BIOGRAPHY & AUTOBIOGRAPHY",
                "subcategories": [
                    "BIO000100",
                    "BIO000200",
                ],
            },
            {
                "code": "BUS000000",
                "category": "BUSINESS & ECONOMICS",
                "subcategories": [
                    "BUS000100",
                    "BUS000200",
                    "BUS000300",
                ],
            },
            {
                "code": "SEL000000",
                "category": "SELF-HELP",
                "subcategories": [
                    "SEL000100",
                    "SEL000200",
                    "SEL000300",
                ],
            },
        ],
        "rights_regions": [
            "USA",
            "Canada",
            "UK & Commonwealth",
            "EU",
            "Australia & NZ",
            "Worldwide",
            "Other",
        ],
        "purchase_platforms": [
            {"id": "amazon", "name": "Amazon", "url": "https://amazon.com"},
            {"id": "apple", "name": "Apple Books", "url": "https://books.apple.com"},
            {"id": "google", "name": "Google Play", "url": "https://play.google.com/books"},
            {"id": "kobo", "name": "Kobo", "url": "https://kobo.com"},
            {"id": "smashwords", "name": "Smashwords", "url": "https://smashwords.com"},
            {"id": "draft2digital", "name": "Draft2Digital", "url": "https://draft2digital.com"},
            {"id": "bookbaby", "name": "BookBaby", "url": "https://bookbaby.com"},
        ],
    }
