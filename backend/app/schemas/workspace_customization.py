"""Workspace Customization Settings (P2.5)

Allow users to rename sidebar modules and chapter hierarchy terms.
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


# ============================================================================
# Workspace Terminology
# ============================================================================

class WorkspaceTerminology(BaseModel):
    """Custom terminology for workspace modules and chapter types"""
    # Sidebar module names
    characters_label: str = Field("Characters", description="Default: 'Characters'")
    world_building_label: str = Field("World Building", description="Default: 'World Building'")
    timeline_label: str = Field("Timeline", description="Default: 'Timeline'")
    flow_label: str = Field("Outline", description="Default: 'Outline' (or Flow/Plot)")
    notes_label: str = Field("Notes", description="Default: 'Notes'")
    references_label: str = Field("References", description="Default: 'References'")
    
    # Chapter hierarchy terms
    part_singular: str = Field("Part", description="e.g., Book, Section, Unit")
    part_plural: str = Field("Parts", description="Plural form")
    chapter_singular: str = Field("Chapter", description="e.g., Scene, Lesson, Section")
    chapter_plural: str = Field("Chapters", description="Plural form")
    section_singular: str = Field("Section", description="e.g., Subsection, Page, Beat")
    section_plural: str = Field("Sections", description="Plural form")


class WorkspaceCustomizationRequest(BaseModel):
    """Request to update workspace customization"""
    terminology: Optional[WorkspaceTerminology] = None
    layout_preferences: Optional[Dict[str, Any]] = None  # Sidebar collapsed state, panel widths, etc.


class WorkspaceCustomizationResponse(BaseModel):
    """Response with workspace settings"""
    id: UUID
    book_id: UUID
    terminology: WorkspaceTerminology
    layout_preferences: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
