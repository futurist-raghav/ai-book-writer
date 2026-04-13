"""Bibliography API Router (P2.4)

Endpoints for managing bibliography entries and citations in chapters.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.dependencies import get_db
from app.models.bibliography import Bibliography, ChapterCitation
from app.models.book import Book
from app.models.chapter import Chapter
from app.schemas.bibliography import (
    BibliographyCreateRequest,
    BibliographyUpdateRequest,
    BibliographyResponse,
    BibliographyListResponse,
    ChapterCitationCreateRequest,
    ChapterCitationUpdateRequest,
    ChapterCitationResponse,
    ChapterCitationsListResponse,
    FormattedCitationResponse,
)
from app.core.dependencies import get_current_user
from app.core.citations import format_citation
from app.models.user import User


router = APIRouter(prefix="/books", tags=["bibliography"])


# ============================================================================
# Bibliography CRUD Endpoints
# ============================================================================

@router.post("/{book_id}/bibliography", response_model=BibliographyResponse, status_code=status.HTTP_201_CREATED)
async def create_bibliography(
    book_id: UUID,
    request: BibliographyCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new bibliography entry for the book"""
    
    # Verify book exists and user is collaborator
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Create entry
    entry = Bibliography(
        book_id=book_id,
        title=request.title,
        authors=request.authors,
        year=request.year,
        source_type=request.source_type,
        source_url=request.source_url,
        notes=request.notes,
        citation_formats={}  # Will be populated when citations are created
    )
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return entry


@router.get("/{book_id}/bibliography", response_model=BibliographyListResponse)
async def list_bibliography(
    book_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List bibliography entries for a book"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Query entries
    skip = (page - 1) * page_size
    entries = db.query(Bibliography).filter(
        and_(Bibliography.book_id == book_id, Bibliography.is_deleted == False)
    ).offset(skip).limit(page_size).all()
    
    total = db.query(Bibliography).filter(
        and_(Bibliography.book_id == book_id, Bibliography.is_deleted == False)
    ).count()
    
    return BibliographyListResponse(
        items=entries,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{book_id}/bibliography/{bibliography_id}", response_model=BibliographyResponse)
async def get_bibliography(
    book_id: UUID,
    bibliography_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific bibliography entry"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get entry
    entry = db.query(Bibliography).filter(
        and_(Bibliography.id == bibliography_id, Bibliography.book_id == book_id, Bibliography.is_deleted == False)
    ).first()
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bibliography entry not found")
    
    return entry


@router.patch("/{book_id}/bibliography/{bibliography_id}", response_model=BibliographyResponse)
async def update_bibliography(
    book_id: UUID,
    bibliography_id: UUID,
    request: BibliographyUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a bibliography entry"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get entry
    entry = db.query(Bibliography).filter(
        and_(Bibliography.id == bibliography_id, Bibliography.book_id == book_id)
    ).first()
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bibliography entry not found")
    
    # Update fields
    if request.title is not None:
        entry.title = request.title
    if request.authors is not None:
        entry.authors = request.authors
    if request.year is not None:
        entry.year = request.year
    if request.source_type is not None:
        entry.source_type = request.source_type
    if request.source_url is not None:
        entry.source_url = request.source_url
    if request.notes is not None:
        entry.notes = request.notes
    
    db.commit()
    db.refresh(entry)
    
    return entry


@router.delete("/{book_id}/bibliography/{bibliography_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bibliography(
    book_id: UUID,
    bibliography_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a bibliography entry (soft delete with cascade)"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get entry
    entry = db.query(Bibliography).filter(
        and_(Bibliography.id == bibliography_id, Bibliography.book_id == book_id)
    ).first()
    
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bibliography entry not found")
    
    # Soft delete (cascade to orphaned citations happens in database)
    entry.is_deleted = True
    db.commit()


# ============================================================================
# Chapter Citation Endpoints
# ============================================================================

@router.post("/chapters/{chapter_id}/citations", response_model=ChapterCitationResponse, status_code=status.HTTP_201_CREATED)
async def add_chapter_citation(
    chapter_id: UUID,
    request: ChapterCitationCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Link a chapter to a bibliography source (create citation)"""
    
    # Verify chapter exists and user owns it
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.user_id == user.id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    
    # Verify bibliography exists
    bib = db.query(Bibliography).filter(Bibliography.id == request.bibliography_id).first()
    if not bib:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bibliography entry not found")
    
    # Create citation
    citation = ChapterCitation(
        chapter_id=chapter_id,
        bibliography_id=request.bibliography_id,
        page_number=request.page_number,
        context_offset=request.context_offset,
        context_snippet=request.context_snippet,
        citation_format=request.citation_format,
    )
    
    db.add(citation)
    db.commit()
    db.refresh(citation)
    
    return citation


@router.get("/chapters/{chapter_id}/citations", response_model=ChapterCitationsListResponse)
async def get_chapter_citations(
    chapter_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all citations for a chapter"""
    
    # Verify chapter exists
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.user_id == user.id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    
    # Get citations
    citations = db.query(ChapterCitation).filter(ChapterCitation.chapter_id == chapter_id).all()
    
    return ChapterCitationsListResponse(
        items=citations,
        total=len(citations)
    )


@router.delete("/chapters/{chapter_id}/citations/{citation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_chapter_citation(
    chapter_id: UUID,
    citation_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove a citation from a chapter"""
    
    # Verify chapter exists
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.user_id == user.id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    
    # Get citation
    citation = db.query(ChapterCitation).filter(
        and_(ChapterCitation.id == citation_id, ChapterCitation.chapter_id == chapter_id)
    ).first()
    
    if not citation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citation not found")
    
    db.delete(citation)
    db.commit()


# ============================================================================
# Export Endpoints
# ============================================================================

@router.get("/{book_id}/bibliography-formatted", response_model=list[FormattedCitationResponse])
async def get_formatted_bibliography(
    book_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all bibliography entries with formatted citations for export"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get entries with citation counts
    entries = db.query(Bibliography).filter(
        and_(Bibliography.book_id == book_id, Bibliography.is_deleted == False)
    ).all()
    
    result = []
    for entry in entries:
        citation_count = db.query(ChapterCitation).filter(
            ChapterCitation.bibliography_id == entry.id
        ).count()
        
        result.append(FormattedCitationResponse(
            id=entry.id,
            title=entry.title,
            authors=entry.authors,
            year=entry.year,
            source_type=entry.source_type,
            apa=format_citation(entry, 'apa'),
            mla=format_citation(entry, 'mla'),
            chicago=format_citation(entry, 'chicago'),
            ieee=format_citation(entry, 'ieee'),
            citation_count=citation_count,
        ))
    
    return result
