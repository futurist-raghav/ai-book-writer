"""Schemas for Import/Export endpoints (P2.7)"""

from typing import List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class ImportFormatEnum(str, Enum):
    """Supported import formats"""
    DOCX = "docx"
    MARKDOWN = "markdown"
    FOUNTAIN = "fountain"
    TEXT = "text"


class ImportStatusEnum(str, Enum):
    """Import status"""
    PENDING = "pending"
    PROCESSING = "processing"
    PREVIEW = "preview"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportedSectionResponse(BaseModel):
    """Single section from preview"""
    section_index: int
    title: str
    content: str
    estimated_word_count: int
    content_type: str = "text"  # text, dialogue, stage_direction
    
    class Config:
        from_attributes = True


class ImportPreviewResponse(BaseModel):
    """Preview of import structure"""
    source_id: int
    filename: str
    format: str
    total_sections: int
    total_word_count: int
    detected_structure: dict  # heading counts, etc.
    sections: List[ImportedSectionResponse]
    
    class Config:
        from_attributes = True


class ImportApplyRequest(BaseModel):
    """Apply import and create chapters"""
    source_id: int
    section_indices: Optional[List[int]] = None  # If None, import all
    create_as_chapters: bool = True
    split_by: str = "auto"  # auto, h1, h2, scene
    parent_part_id: Optional[int] = None  # Create chapters under a part
    start_at_chapter_number: int = 1


class ImportApplyResponse(BaseModel):
    """Result of import apply"""
    import_source_id: int
    chapters_created: int
    total_word_count: int
    created_chapter_ids: List[int]
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


class ImportSourceResponse(BaseModel):
    """Get import source details"""
    id: int
    book_id: int
    filename: str
    format: str
    status: str
    file_size: int
    total_characters: int
    detected_structure: dict
    import_settings: dict
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ImportListResponse(BaseModel):
    """List import sources"""
    id: int
    filename: str
    format: str
    status: str
    created_at: datetime
    total_characters: int
    
    class Config:
        from_attributes = True


# Export schemas (for later)
class ExportFormatEnum(str, Enum):
    """Export formats"""
    MARKDOWN = "markdown"
    DOCX = "docx"
    PDF = "pdf"
    EPUB = "epub"


class ExportRequest(BaseModel):
    """Create export"""
    format: ExportFormatEnum
    include_metadata: bool = True
    include_comments: bool = False
    include_placeholders: bool = False
    filename_template: str = "{book_title} - {date}.{ext}"


class ExportResponse(BaseModel):
    """Export result"""
    export_id: int
    format: str
    status: str
    download_url: Optional[str]
    filename: str
    file_size: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True
