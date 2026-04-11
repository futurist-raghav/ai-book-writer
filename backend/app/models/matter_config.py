"""
Front/Back Matter Configuration Model

Stores configuration for front matter (title page, TOC, etc.) and back matter (index, glossary, etc.)
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, Text, UUID, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class MatterConfig(Base):
    """
    Front and back matter configuration for a book.
    Stores settings for which components to include and their metadata.
    """
    
    __tablename__ = "matter_configs"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Front matter settings
    include_title_page = Column(Boolean, default=True)
    include_copyright_page = Column(Boolean, default=True)
    include_dedication = Column(Boolean, default=False)
    include_acknowledgments = Column(Boolean, default=False)
    include_preface = Column(Boolean, default=False)
    include_introduction = Column(Boolean, default=False)
    include_toc = Column(Boolean, default=True)
    toc_include_subsections = Column(Boolean, default=True)
    
    # Front matter content
    title_page_custom_text = Column(Text, nullable=True)  # Additional text for title page
    copyright_text = Column(Text, nullable=True)  # Custom copyright notice
    dedication_text = Column(Text, nullable=True)
    acknowledgments_text = Column(Text, nullable=True)
    preface_text = Column(Text, nullable=True)
    introduction_text = Column(Text, nullable=True)
    
    # Back matter settings
    include_epilogue = Column(Boolean, default=False)
    include_afterword = Column(Boolean, default=False)
    include_about_author = Column(Boolean, default=False)
    include_glossary = Column(Boolean, default=False)
    glossary_type = Column(String(50), default="auto")  # auto or manual
    include_index = Column(Boolean, default=False)
    index_type = Column(String(50), default="auto")  # auto or manual
    include_bibliography = Column(Boolean, default=False)
    include_appendices = Column(Boolean, default=False)
    
    # Back matter content
    epilogue_text = Column(Text, nullable=True)
    afterword_text = Column(Text, nullable=True)
    about_author_text = Column(Text, nullable=True)
    manual_glossary_entries = Column(JSON, default={})  # Custom glossary terms
    appendices = Column(JSON, default=[])  # List of appendices with titles/content
    
    # Metadata
    author_name = Column(String(255), nullable=True)
    publisher_name = Column(String(255), nullable=True)
    publication_year = Column(String(4), nullable=True)
    isbn = Column(String(20), nullable=True)
    edition = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    
    def __repr__(self):
        return f"<MatterConfig(book_id={self.book_id})>"
