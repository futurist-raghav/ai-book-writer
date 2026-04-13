"""Glossary API routes for P3.8.

Provides endpoints for extracting, managing, and confirming glossary entries.
"""

import time
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.dependencies import get_db, get_current_user
from app.models import User, Book, GlossaryEntry, Chapter
from app.schemas.glossary import (
    GlossaryEntryCreate,
    GlossaryEntryUpdate,
    GlossaryEntryResponse,
    GlossaryExtractionInput,
    GlossaryExtractionResponse,
    GlossaryExtractionCandidate,
    GlossaryListResponse,
)
from app.services.glossary_service import (
    extract_glossary_candidates,
    save_glossary_candidates,
)


router = APIRouter(prefix="/books/{book_id}/glossary", tags=["glossary"])


@router.post("/extract", response_model=GlossaryExtractionResponse)
async def extract_glossary(
    book_id: str,
    input_data: GlossaryExtractionInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract glossary candidates from all chapters.
    
    Analyzes chapter content to identify potential glossary terms based on:
    - Capitalization patterns (proper nouns)
    - Frequency analysis
    - Definition patterns ("X is defined as...")
    - Technical terminology
    
    Args:
        book_id: Book ID to extract from
        input_data: Extraction parameters (confidence_threshold, max_terms)
        
    Returns:
        List of candidate terms with confidence scores and frequency data
    """
    # Verify user has access to book
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get chapters to analyze
    start_time = time.time()
    
    chapters_query = db.query(Chapter).filter(Chapter.book_id == book_id)
    if input_data.include_chapters:
        chapters_query = chapters_query.filter(Chapter.id.in_(input_data.include_chapters))
    
    chapters_list = chapters_query.all()
    if not chapters_list:
        raise HTTPException(status_code=400, detail="No chapters found to analyze")
    
    # Prepare chapter data
    chapters_data = [
        (ch.id, ch.title or "Untitled", ch.compiled_content or "")
        for ch in chapters_list
    ]
    
    # Extract candidates
    try:
        candidates = extract_glossary_candidates(
            chapters_data,
            confidence_threshold=input_data.confidence_threshold,
            max_terms=input_data.max_terms,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    
    extraction_time_ms = int((time.time() - start_time) * 1000)
    
    return GlossaryExtractionResponse(
        candidates=[GlossaryExtractionCandidate(**c) for c in candidates],
        analyzed_chapters=len(chapters_data),
        total_terms_found=len(candidates),
        extraction_time_ms=extraction_time_ms,
        note="Review candidates and confirm which terms to add to glossary",
    )


@router.post("/confirm-extraction", response_model=GlossaryListResponse)
async def confirm_glossary_extraction(
    book_id: str,
    terms: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm extracted glossary terms and save them.
    
    Args:
        book_id: Book ID
        terms: List of term text to save
        
    Returns:
        Updated glossary list
    """
    # Verify access
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get suggested (unconfirmed) entries that match these terms
    entries = db.query(GlossaryEntry).filter(
        GlossaryEntry.book_id == book_id,
        GlossaryEntry.term.in_(terms),
        GlossaryEntry.confirmed == False,
        GlossaryEntry.user_defined == False,
    ).all()
    
    # Confirm them
    for entry in entries:
        entry.confirmed = True
    
    db.commit()
    
    # Return updated list
    return _get_glossary_list(book_id, db, current_user)


@router.get("", response_model=GlossaryListResponse)
async def list_glossary(
    book_id: str,
    confirmed_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all glossary entries for a book.
    
    Args:
        book_id: Book ID
        confirmed_only: Filter to only confirmed entries
        
    Returns:
        Paginated glossary entries
    """
    # Verify access
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    return _get_glossary_list(book_id, db, current_user, confirmed_only=confirmed_only)


def _get_glossary_list(
    book_id: str,
    db: Session,
    current_user: User,
    confirmed_only: bool = False,
) -> GlossaryListResponse:
    """Helper to get glossary list."""
    query = db.query(GlossaryEntry).filter(GlossaryEntry.book_id == book_id)
    
    if confirmed_only:
        query = query.filter(GlossaryEntry.confirmed == True)
    
    entries = query.order_by(desc(GlossaryEntry.frequency)).all()
    
    confirmed_count = sum(1 for e in entries if e.confirmed)
    suggested_count = sum(1 for e in entries if not e.confirmed)
    
    return GlossaryListResponse(
        entries=[GlossaryEntryResponse.from_orm(e) for e in entries],
        total=len(entries),
        confirmed=confirmed_count,
        suggested=suggested_count,
    )


@router.get("/{entry_id}", response_model=GlossaryEntryResponse)
async def get_glossary_entry(
    book_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific glossary entry."""
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    entry = db.query(GlossaryEntry).filter(
        GlossaryEntry.id == entry_id,
        GlossaryEntry.book_id == book_id,
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Glossary entry not found")
    
    return GlossaryEntryResponse.from_orm(entry)


@router.post("", response_model=GlossaryEntryResponse)
async def create_glossary_entry(
    book_id: str,
    payload: GlossaryEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new glossary entry."""
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Check for duplicate
    existing = db.query(GlossaryEntry).filter(
        GlossaryEntry.book_id == book_id,
        GlossaryEntry.term == payload.term,
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Term already exists in glossary")
    
    entry = GlossaryEntry(
        id=str(uuid.uuid4()),
        book_id=book_id,
        term=payload.term,
        definition=payload.definition,
        definition_source=payload.definition_source,
        part_of_speech=payload.part_of_speech,
        context=payload.context,
        user_defined=payload.user_defined,
        confirmed=True if payload.user_defined else False,
    )
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return GlossaryEntryResponse.from_orm(entry)


@router.patch("/{entry_id}", response_model=GlossaryEntryResponse)
async def update_glossary_entry(
    book_id: str,
    entry_id: str,
    payload: GlossaryEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a glossary entry."""
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    entry = db.query(GlossaryEntry).filter(
        GlossaryEntry.id == entry_id,
        GlossaryEntry.book_id == book_id,
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Glossary entry not found")
    
    # Update fields
    if payload.definition is not None:
        entry.definition = payload.definition
    if payload.definition_source is not None:
        entry.definition_source = payload.definition_source
    if payload.part_of_speech is not None:
        entry.part_of_speech = payload.part_of_speech
    if payload.context is not None:
        entry.context = payload.context
    if payload.confirmed is not None:
        entry.confirmed = payload.confirmed
    
    db.commit()
    db.refresh(entry)
    
    return GlossaryEntryResponse.from_orm(entry)


@router.delete("/{entry_id}", status_code=204)
async def delete_glossary_entry(
    book_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a glossary entry."""
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    entry = db.query(GlossaryEntry).filter(
        GlossaryEntry.id == entry_id,
        GlossaryEntry.book_id == book_id,
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Glossary entry not found")
    
    db.delete(entry)
    db.commit()
