"""
Chapter Edit History Model

Tracks every edit to a chapter with author and timestamp.
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, Text, UUID, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChapterEdit(Base):
    """
    Track individual edits to chapters with author attribution.
    Records: who, what, when for every change.
    """
    
    __tablename__ = "chapter_edits"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    
    # Content before and after
    content_before = Column(Text, nullable=True)
    content_after = Column(Text, nullable=False)
    
    # Edit metadata
    char_count_before = Column(Integer, default=0)
    char_count_after = Column(Integer, default=0)
    word_count_before = Column(Integer, default=0)
    word_count_after = Column(Integer, default=0)
    
    # Type of edit
    edit_type = Column(String(50))  # full_rewrite, partial_edit, grammar_fix, etc.
    change_description = Column(String(500), nullable=True)  # "Fixed typos", "Rewrote paragraph 3"
    
    # Timestamp
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    author = relationship("User", foreign_keys=[author_id])
    
    def __repr__(self):
        return f"<ChapterEdit({self.author_id}, {self.edit_type})>"
    
    @property
    def char_delta(self) -> int:
        """Net change in characters."""
        return self.char_count_after - self.char_count_before
    
    @property
    def word_delta(self) -> int:
        """Net change in words."""
        return self.word_count_after - self.word_count_before
