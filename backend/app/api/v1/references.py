"""
References API Routes

Handles citation and bibliography management for books.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
from app.models.reference import Reference
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.reference import (
    BibliographyResponse,
    ReferenceCreate,
    ReferenceGenerateCitations,
    ReferenceListResponse,
    ReferenceResponse,
    ReferenceUpdate,
)

router = APIRouter()


def _generate_citation(reference: Reference, format: str) -> str:
    """Generate citation in the requested format."""
    authors_str = ", ".join(reference.authors) if reference.authors else "Unknown"
    title = reference.title

    if format == "apa":
        year = reference.metadata.get("year", "n.d.")
        return f"{authors_str} ({year}). {title}."

    elif format == "mla":
        year = reference.metadata.get("year", "")
        year_str = f" {year}" if year else ""
        return f"{authors_str}. \"{title}.\" {year_str}"

    elif format == "chicago":
        year = reference.metadata.get("year", "")
        return f"{authors_str}, {title}. Accessed {year}."

    elif format == "ieee":
        year = reference.metadata.get("year", "")
        year_str = f", {year}" if year else ""
        return f"[1] {authors_str}, \"${title},\"{year_str}."

    elif format == "harvard":
        year = reference.metadata.get("year", "n.d.")
        return f"{authors_str}, {year}. {title}."

    return title


@router.get(
    "/books/{book_id}/references",
    response_model=PaginatedResponse[ReferenceListResponse],
    summary="List references for a book",
)
async def list_references(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    source_type: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|title|source_type)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """
    List all references for a specific book.
    """
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
    query = select(Reference).where(Reference.book_id == book_id)

    if source_type:
        query = query.where(Reference.source_type == source_type)

    if tag:
        query = query.where(Reference.tags.contains([tag]))

    # Count total
    total_result = await db.execute(select(func.count(Reference.id)).select_from(Reference).where(Reference.book_id == book_id))
    total = total_result.scalar() or 0

    # Apply sorting
    sort_column = (
        Reference.title
        if sort_by == "title"
        else Reference.source_type if sort_by == "source_type" else Reference.created_at
    )
    query = query.order_by(desc(sort_column) if sort_order == "desc" else sort_column)

    # Apply pagination
    query = query.offset((page - 1) * limit).limit(limit)

    # Execute
    result = await db.execute(query)
    references = result.scalars().all()

    # Build response
    items = [ReferenceResponse.model_validate(ref) for ref in references]
    total_pages = (total + limit - 1) // limit

    return PaginatedResponse(
        data=ReferenceListResponse(
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
    "/books/{book_id}/references/{reference_id}",
    response_model=ReferenceResponse,
    summary="Get a specific reference",
)
async def get_reference(
    book_id: uuid.UUID,
    reference_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get a specific reference by ID."""
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

    # Get reference
    result = await db.execute(
        select(Reference).where(
            Reference.id == reference_id,
            Reference.book_id == book_id,
        )
    )
    reference = result.scalar_one_or_none()
    if not reference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found",
        )

    return ReferenceResponse.model_validate(reference)


@router.post(
    "/books/{book_id}/references",
    response_model=ReferenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new reference",
)
async def create_reference(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    reference_data: ReferenceCreate,
):
    """Create a new reference for a book."""
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

    # Create reference
    reference = Reference(
        id=uuid.uuid4(),
        book_id=book_id,
        source_type=reference_data.source_type,
        title=reference_data.title,
        authors=reference_data.authors,
        url=reference_data.url,
        metadata=reference_data.metadata,
        notes=reference_data.notes,
        tags=reference_data.tags,
        citation_format=reference_data.citation_format,
    )

    # Generate citations
    for fmt in ["apa", "mla", "chicago", "ieee", "harvard"]:
        citation = _generate_citation(reference, fmt)
        if fmt == "apa":
            reference.apa_citation = citation
        elif fmt == "mla":
            reference.mla_citation = citation
        elif fmt == "chicago":
            reference.chicago_citation = citation
        elif fmt == "ieee":
            reference.ieee_citation = citation
        elif fmt == "harvard":
            reference.harvard_citation = citation

    db.add(reference)
    await db.commit()
    await db.refresh(reference)

    return ReferenceResponse.model_validate(reference)


@router.put(
    "/books/{book_id}/references/{reference_id}",
    response_model=ReferenceResponse,
    summary="Update a reference",
)
async def update_reference(
    book_id: uuid.UUID,
    reference_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    reference_data: ReferenceUpdate,
):
    """Update an existing reference."""
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

    # Get reference
    result = await db.execute(
        select(Reference).where(
            Reference.id == reference_id,
            Reference.book_id == book_id,
        )
    )
    reference = result.scalar_one_or_none()
    if not reference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found",
        )

    # Update fields
    if reference_data.source_type is not None:
        reference.source_type = reference_data.source_type
    if reference_data.title is not None:
        reference.title = reference_data.title
    if reference_data.authors is not None:
        reference.authors = reference_data.authors
    if reference_data.url is not None:
        reference.url = reference_data.url
    if reference_data.metadata is not None:
        reference.metadata = reference_data.metadata
    if reference_data.notes is not None:
        reference.notes = reference_data.notes
    if reference_data.tags is not None:
        reference.tags = reference_data.tags
    if reference_data.citation_format is not None:
        reference.citation_format = reference_data.citation_format

    # Regenerate citations
    for fmt in ["apa", "mla", "chicago", "ieee", "harvard"]:
        citation = _generate_citation(reference, fmt)
        if fmt == "apa":
            reference.apa_citation = citation
        elif fmt == "mla":
            reference.mla_citation = citation
        elif fmt == "chicago":
            reference.chicago_citation = citation
        elif fmt == "ieee":
            reference.ieee_citation = citation
        elif fmt == "harvard":
            reference.harvard_citation = citation

    reference.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(reference)

    return ReferenceResponse.model_validate(reference)


@router.delete(
    "/books/{book_id}/references/{reference_id}",
    response_model=MessageResponse,
    summary="Delete a reference",
)
async def delete_reference(
    book_id: uuid.UUID,
    reference_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Delete a reference."""
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

    # Get reference
    result = await db.execute(
        select(Reference).where(
            Reference.id == reference_id,
            Reference.book_id == book_id,
        )
    )
    reference = result.scalar_one_or_none()
    if not reference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found",
        )

    # Delete
    await db.delete(reference)
    await db.commit()

    return MessageResponse(message="Reference deleted successfully")


@router.post(
    "/books/{book_id}/references/{reference_id}/citations",
    response_model=dict,
    summary="Generate citations",
)
async def generate_citations(
    book_id: uuid.UUID,
    reference_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    request: ReferenceGenerateCitations,
):
    """Generate citations in requested formats."""
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

    # Get reference
    result = await db.execute(
        select(Reference).where(
            Reference.id == reference_id,
            Reference.book_id == book_id,
        )
    )
    reference = result.scalar_one_or_none()
    if not reference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found",
        )

    # Generate citations
    citations = {}
    for fmt in request.formats:
        citations[fmt] = _generate_citation(reference, fmt)

    return citations


@router.get(
    "/books/{book_id}/bibliography",
    response_model=BibliographyResponse,
    summary="Generate bibliography",
)
async def generate_bibliography(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    format: str = Query("apa", pattern="^(apa|mla|chicago|ieee|harvard)$"),
):
    """Generate a formatted bibliography for all references."""
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

    # Get all references
    result = await db.execute(
        select(Reference)
        .where(Reference.book_id == book_id)
        .order_by(Reference.title)
    )
    references = result.scalars().all()

    # Generate bibliography
    citations = []
    for reference in references:
        citation = _generate_citation(reference, format)
        citations.append(citation)

    bibliography_content = "\n\n".join(citations)

    return BibliographyResponse(
        format=format,
        content=bibliography_content,
        entry_count=len(references),
        generated_at=datetime.now(timezone.utc),
    )
