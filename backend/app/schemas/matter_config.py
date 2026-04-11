"""
Front/Back Matter Config Schemas
"""

from datetime import datetime
from uuid import UUID
from typing import Optional, Dict, Any, List

from pydantic import BaseModel


class MatterConfigUpdate(BaseModel):
    """Update front/back matter configuration."""
    
    # Front matter toggles
    include_title_page: bool | None = None
    include_copyright_page: bool | None = None
    include_dedication: bool | None = None
    include_acknowledgments: bool | None = None
    include_preface: bool | None = None
    include_introduction: bool | None = None
    include_toc: bool | None = None
    toc_include_subsections: bool | None = None
    
    # Front matter content
    title_page_custom_text: str | None = None
    copyright_text: str | None = None
    dedication_text: str | None = None
    acknowledgments_text: str | None = None
    preface_text: str | None = None
    introduction_text: str | None = None
    
    # Back matter toggles
    include_epilogue: bool | None = None
    include_afterword: bool | None = None
    include_about_author: bool | None = None
    include_glossary: bool | None = None
    glossary_type: str | None = None
    include_index: bool | None = None
    include_bibliography: bool | None = None
    include_appendices: bool | None = None
    
    # Back matter content
    epilogue_text: str | None = None
    afterword_text: str | None = None
    about_author_text: str | None = None
    manual_glossary_entries: Dict[str, str] | None = None
    appendices: List[Dict[str, Any]] | None = None
    
    # Metadata
    author_name: str | None = None
    publisher_name: str | None = None
    publication_year: str | None = None
    isbn: str | None = None
    edition: str | None = None


class MatterConfigResponse(BaseModel):
    """Response for matter configuration."""
    id: UUID
    book_id: UUID
    
    # Front matter
    include_title_page: bool
    include_copyright_page: bool
    include_dedication: bool
    include_acknowledgments: bool
    include_preface: bool
    include_introduction: bool
    include_toc: bool
    toc_include_subsections: bool
    
    title_page_custom_text: str | None
    copyright_text: str | None
    dedication_text: str | None
    acknowledgments_text: str | None
    
    # Back matter
    include_epilogue: bool
    include_afterword: bool
    include_about_author: bool
    include_glossary: bool
    glossary_type: str
    include_index: bool
    include_bibliography: bool
    include_appendices: bool
    
    epilogue_text: str | None
    afterword_text: str | None
    about_author_text: str | None
    manual_glossary_entries: Dict[str, str]
    appendices: List[Dict[str, Any]]
    
    # Metadata
    author_name: str | None
    publisher_name: str | None
    publication_year: str | None
    isbn: str | None
    edition: str | None
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
