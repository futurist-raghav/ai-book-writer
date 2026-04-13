"""
Front/Back Matter Configuration Model

Stores configuration for front matter (title page, TOC, etc.) and back matter (index, glossary, etc.)
"""

from typing import TYPE_CHECKING, Optional

from datetime import datetime, timezone
import uuid

from sqlalchemy import String, Text, UUID, DateTime, Boolean, JSON, ForeignKey, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MatterConfig(Base):
    """
    Front and back matter configuration for a book.
    Stores settings for which components to include and their metadata.
    """
    
    __tablename__ = "matter_configs"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Front matter settings
    include_title_page: Mapped[bool] = mapped_column(Boolean, default=True)
    include_copyright_page: Mapped[bool] = mapped_column(Boolean, default=True)
    include_dedication: Mapped[bool] = mapped_column(Boolean, default=False)
    include_acknowledgments: Mapped[bool] = mapped_column(Boolean, default=False)
    include_preface: Mapped[bool] = mapped_column(Boolean, default=False)
    include_introduction: Mapped[bool] = mapped_column(Boolean, default=False)
    include_toc: Mapped[bool] = mapped_column(Boolean, default=True)
    toc_include_subsections: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Front matter content
    title_page_custom_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Additional text for title page
    copyright_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Custom copyright notice
    dedication_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acknowledgments_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    preface_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    introduction_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Back matter settings
    include_epilogue: Mapped[bool] = mapped_column(Boolean, default=False)
    include_afterword: Mapped[bool] = mapped_column(Boolean, default=False)
    include_about_author: Mapped[bool] = mapped_column(Boolean, default=False)
    include_glossary: Mapped[bool] = mapped_column(Boolean, default=False)
    glossary_type: Mapped[str] = mapped_column(String(50), default="auto") # auto or manual
    include_index: Mapped[bool] = mapped_column(Boolean, default=False)
    index_type: Mapped[str] = mapped_column(String(50), default="auto") # auto or manual
    include_bibliography: Mapped[bool] = mapped_column(Boolean, default=False)
    include_appendices: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Back matter content
    epilogue_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    afterword_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    about_author_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manual_glossary_entries: Mapped[dict] = mapped_column(JSON, default={}) # Custom glossary terms
    appendices: Mapped[dict] = mapped_column(JSON, default=[]) # List of appendices with titles/content
    
    # Metadata
    author_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publisher_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publication_year: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    isbn: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    edition: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    
    def __repr__(self):
        return f"<MatterConfig(book_id={self.book_id})>"
