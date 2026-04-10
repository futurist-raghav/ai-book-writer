"""
Bibliography and Citations API Router
Handles CRUD operations for sources and chapter citations
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import uuid4
from typing import List, Optional

from app.core.dependencies import get_db, get_current_user
from app.models import User, Book, Chapter, Bibliography, ChapterCitation
from app.schemas import BibliographyResponse, ChapterCitationResponse, BibliographyCreateRequest

router = APIRouter(prefix="/books/{book_id}", tags=["bibliography"])


# ============================================================================
# BIBLIOGRAPHY CRUD
# ============================================================================


@router.get("/bibliography", response_model=List[BibliographyResponse])
async def list_bibliography(
    book_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    source_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all bibliography sources for a book"""
    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    query = select(Bibliography).where(Bibliography.book_id == book_id)

    if source_type:
        query = query.where(Bibliography.source_type == source_type)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    sources = result.scalars().all()

    return sources


@router.post("/bibliography", response_model=BibliographyResponse)
async def create_bibliography(
    book_id: str,
    req: BibliographyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new bibliography source"""
    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    source = Bibliography(
        id=str(uuid4()),
        book_id=book_id,
        title=req.title,
        authors=req.authors,
        year=req.year,
        source_url=req.source_url,
        source_type=req.source_type,
        citation_formats=req.citation_formats or {},
        notes=req.notes,
    )

    db.add(source)
    await db.commit()
    await db.refresh(source)

    return source


@router.get("/bibliography/{source_id}", response_model=BibliographyResponse)
async def get_bibliography(
    book_id: str,
    source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific bibliography source"""
    source = await db.get(Bibliography, source_id)
    if not source or source.book_id != book_id:
        raise HTTPException(status_code=404, detail="Source not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return source


@router.patch("/bibliography/{source_id}", response_model=BibliographyResponse)
async def update_bibliography(
    book_id: str,
    source_id: str,
    req: BibliographyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a bibliography source"""
    source = await db.get(Bibliography, source_id)
    if not source or source.book_id != book_id:
        raise HTTPException(status_code=404, detail="Source not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    source.title = req.title
    source.authors = req.authors
    source.year = req.year
    source.source_url = req.source_url
    source.source_type = req.source_type
    source.citation_formats = req.citation_formats or {}
    source.notes = req.notes

    await db.commit()
    await db.refresh(source)

    return source


@router.delete("/bibliography/{source_id}")
async def delete_bibliography(
    book_id: str,
    source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a bibliography source"""
    source = await db.get(Bibliography, source_id)
    if not source or source.book_id != book_id:
        raise HTTPException(status_code=404, detail="Source not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(source)
    await db.commit()

    return {"detail": "Deleted"}


# ============================================================================
# CHAPTER CITATIONS
# ============================================================================


@router.get("/chapters/{chapter_id}/citations", response_model=List[ChapterCitationResponse])
async def get_chapter_citations(
    book_id: str,
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all citations in a chapter"""
    # Verify chapter belongs to book
    chapter = await db.get(Chapter, chapter_id)
    if not chapter or chapter.book_id != book_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = (
        select(ChapterCitation)
        .where(ChapterCitation.chapter_id == chapter_id)
        .order_by(ChapterCitation.citation_number)
    )
    result = await db.execute(query)
    citations = result.scalars().all()

    return citations


@router.post("/chapters/{chapter_id}/citations", response_model=ChapterCitationResponse)
async def add_chapter_citation(
    book_id: str,
    chapter_id: str,
    req: dict,  # { "bibliography_id": "...", "page_number": "42", "context_offset": 1234 }
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a citation to a chapter"""
    # Verify chapter
    chapter = await db.get(Chapter, chapter_id)
    if not chapter or chapter.book_id != book_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Verify bibliography source
    bibliography = await db.get(Bibliography, req.get("bibliography_id"))
    if not bibliography or bibliography.book_id != book_id:
        raise HTTPException(status_code=404, detail="Bibliography source not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get next citation number
    count_query = select(func.count(ChapterCitation.id)).where(
        ChapterCitation.chapter_id == chapter_id
    )
    result = await db.execute(count_query)
    citation_number = result.scalar() + 1

    citation = ChapterCitation(
        id=str(uuid4()),
        chapter_id=chapter_id,
        bibliography_id=bibliography.id,
        citation_number=citation_number,
        page_number=req.get("page_number"),
        context_offset=req.get("context_offset"),
        context_snippet=req.get("context_snippet"),
    )

    db.add(citation)
    await db.commit()
    await db.refresh(citation)

    return citation


@router.delete("/chapters/{chapter_id}/citations/{citation_id}")
async def remove_chapter_citation(
    book_id: str,
    chapter_id: str,
    citation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a citation from a chapter"""
    citation = await db.get(ChapterCitation, citation_id)
    if not citation or citation.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Citation not found")

    # Verify chapter
    chapter = await db.get(Chapter, chapter_id)
    if not chapter or chapter.book_id != book_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(citation)
    await db.commit()

    return {"detail": "Deleted"}


# ============================================================================
# AUTO-GENERATE BIBLIOGRAPHY
# ============================================================================


@router.post("/chapters/{chapter_id}/generate-bibliography")
async def suggest_citations(
    book_id: str,
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-powered: Analyze chapter and suggest places where citations would help
    Returns list of positions and suggested citation types
    """
    # Verify chapter
    chapter = await db.get(Chapter, chapter_id)
    if not chapter or chapter.book_id != book_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # TODO: Call AI service to analyze chapter content
    # Returns: { "suggestions": [ { "offset": 1234, "text": "...", "type": "claim|statistic|quote" } ] }

    return {
        "suggestions": [
            {
                "offset": 100,
                "text": "This claim needs supporting evidence",
                "suggestion_type": "claim",
            }
        ]
    }


@router.post("/bibliography/generate-from-text")
async def extract_bibliography_from_text(
    book_id: str,
    text: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Extract bibliography references from text
    Parses common citation formats and creates entries
    """
    # Verify access
    book = await db.get(Book, book_id)
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Book not found")

    # TODO: Parse text for citations (e.g., "cited in Smith et al., 2020")
    # Create Bibliography entries

    return {"created": 0, "duplicates": 0}
