"""Import Source Models (P2.7)"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Text, JSON, ForeignKey, DateTime, Enum as SQLEnum, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base


class ImportFormat(str, Enum):
    """Supported import formats"""
    DOCX = "docx"
    MARKDOWN = "markdown"
    FOUNTAIN = "fountain"
    TEXT = "text"


class ImportStatus(str, Enum):
    """Status of import operation"""
    PENDING = "pending"
    PROCESSING = "processing"
    PREVIEW = "preview"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportSource(Base):
    """Tracks import sources and history"""
    __tablename__ = "import_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    format = Column(String(50), nullable=False)  # docx, markdown, fountain, text
    status = Column(String(50), default="preview")  # pending, processing, preview, completed, failed
    file_size = Column(Integer)  # bytes
    total_characters = Column(Integer)  # for word count estimation
    detected_structure = Column(JSON)  # { heading_count, section_count, estimated_chapters }
    import_settings = Column(JSON)  # { split_by: 'heading1', create_chapters: true, etc }
    error_message = Column(Text)  # if import failed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    book = relationship("Book", foreign_keys=[book_id])

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "book_id": str(self.book_id),
            "filename": self.filename,
            "format": self.format,
            "status": self.status,
            "file_size": self.file_size,
            "total_characters": self.total_characters,
            "detected_structure": self.detected_structure,
            "import_settings": self.import_settings,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ImportedContent(Base):
    """Stores previewed/imported content from imports"""
    __tablename__ = "imported_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_source_id = Column(UUID(as_uuid=True), ForeignKey("import_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    section_index = Column(Integer, nullable=False)  # Which section/chapter
    title = Column(String(255))
    content = Column(Text, nullable=False)
    content_type = Column(String(50))  # chapter, section, scene
    estimated_word_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    import_source = relationship("ImportSource", foreign_keys=[import_source_id])

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "import_source_id": str(self.import_source_id),
            "section_index": self.section_index,
            "title": self.title,
            "content": self.content,
            "content_type": self.content_type,
            "estimated_word_count": self.estimated_word_count,
            "created_at": self.created_at.isoformat(),
        }
