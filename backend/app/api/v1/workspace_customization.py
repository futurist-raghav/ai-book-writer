"""Workspace Customization API Router (P2.5)

Endpoints for managing workspace terminology and layout preferences.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.workspace_customization import WorkspaceCustomization
from app.models.book import Book
from app.schemas.workspace_customization import (
    WorkspaceCustomizationRequest,
    WorkspaceCustomizationResponse,
    WorkspaceTerminology,
)
from app.core.dependencies import get_current_user
from app.models.user import User


router = APIRouter(prefix="/books", tags=["Workspace Customization"])


@router.get("/{book_id}/workspace-customization", response_model=WorkspaceCustomizationResponse)
async def get_workspace_customization(
    book_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get workspace customization settings for a book"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get or create customization
    customization = db.query(WorkspaceCustomization).filter(
        WorkspaceCustomization.book_id == book_id
    ).first()
    
    if not customization:
        # Create default customization
        customization = WorkspaceCustomization(book_id=book_id)
        db.add(customization)
        db.commit()
        db.refresh(customization)
    
    return customization


@router.patch("/{book_id}/workspace-customization", response_model=WorkspaceCustomizationResponse)
async def update_workspace_customization(
    book_id: UUID,
    request: WorkspaceCustomizationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update workspace customization settings"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get or create customization
    customization = db.query(WorkspaceCustomization).filter(
        WorkspaceCustomization.book_id == book_id
    ).first()
    
    if not customization:
        customization = WorkspaceCustomization(book_id=book_id)
        db.add(customization)
    
    # Update fields
    if request.terminology:
        customization.terminology = request.terminology.dict()
    if request.layout_preferences is not None:
        customization.layout_preferences = request.layout_preferences
    
    db.commit()
    db.refresh(customization)
    
    return customization


@router.post("/{book_id}/workspace-customization/reset", response_model=WorkspaceCustomizationResponse)
async def reset_workspace_customization(
    book_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reset workspace customization to defaults"""
    
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Get or create customization
    customization = db.query(WorkspaceCustomization).filter(
        WorkspaceCustomization.book_id == book_id
    ).first()
    
    if not customization:
        customization = WorkspaceCustomization(book_id=book_id)
    else:
        # Reset to defaults
        customization.terminology = {
            "characters_label": "Characters",
            "world_building_label": "World Building",
            "timeline_label": "Timeline",
            "flow_label": "Outline",
            "notes_label": "Notes",
            "references_label": "References",
            "part_singular": "Part",
            "part_plural": "Parts",
            "chapter_singular": "Chapter",
            "chapter_plural": "Chapters",
            "section_singular": "Section",
            "section_plural": "Sections",
        }
        customization.layout_preferences = {}
    
    db.add(customization)
    db.commit()
    db.refresh(customization)
    
    return customization
