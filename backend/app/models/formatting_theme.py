"""
Formatting Theme Model

Pre-built and custom formatting themes for book compilation.
"""

from typing import TYPE_CHECKING, Optional

from datetime import datetime, timezone
import uuid

from sqlalchemy import String, Text, UUID, DateTime, Boolean, Integer, JSON, ForeignKey, Float, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FormattingTheme(Base):
    """
    Formatting theme for book compilation.
    Includes fonts, colors, spacing, margins for different output formats.
    """
    
    __tablename__ = "formatting_themes"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    
    # Theme identity
    name: Mapped[str] = mapped_column(String(100), nullable=False) # "Novel Classic", "Academic Pro", etc.
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False) # True if built-in theme
    is_custom: Mapped[bool] = mapped_column(Boolean, default=True) # True if user-created
    theme_type: Mapped[str] = mapped_column(String(50), nullable=False) # novel, academic, screenplay, textbook, poetry
    
    # Font configuration
    body_font_family: Mapped[str] = mapped_column(String(100), default="Garamond") # serif or sans-serif
    body_font_size: Mapped[int] = mapped_column(Integer, default=12) # pt
    heading1_font_family: Mapped[str] = mapped_column(String(100), default="Garamond")
    heading1_font_size: Mapped[int] = mapped_column(Integer, default=24)
    heading2_font_size: Mapped[int] = mapped_column(Integer, default=18)
    heading3_font_size: Mapped[int] = mapped_column(Integer, default=14)
    heading_weight: Mapped[str] = mapped_column(String(50), default="bold") # bold, 700, etc.
    line_height: Mapped[str] = mapped_column(String(20), default="1.5") # 1.5, 2.0, etc.
    letter_spacing: Mapped[str] = mapped_column(String(20), default="normal") # normal, px, em values
    
    # Color configuration
    text_color: Mapped[str] = mapped_column(String(7), default="#000000") # hex color
    background_color: Mapped[str] = mapped_column(String(7), default="#FFFFFF")
    heading_color: Mapped[str] = mapped_column(String(7), default="#000000")
    accent_color: Mapped[str] = mapped_column(String(7), default="#333333")
    link_color: Mapped[str] = mapped_column(String(7), default="#0066CC")
    
    # Spacing configuration (in inches or cm for print)
    margin_top: Mapped[str] = mapped_column(String(20), default="1in")
    margin_bottom: Mapped[str] = mapped_column(String(20), default="1in")
    margin_left: Mapped[str] = mapped_column(String(20), default="1in")
    margin_right: Mapped[str] = mapped_column(String(20), default="1in")
    paragraph_spacing: Mapped[str] = mapped_column(String(20), default="0.2in") # Space between paragraphs
    paragraph_indent: Mapped[str] = mapped_column(String(20), default="0.5in") # First line indent
    
    # Page configuration
    page_width: Mapped[str] = mapped_column(String(20), default="6in") # For ebook
    page_height: Mapped[str] = mapped_column(String(20), default="9in")
    page_orientation: Mapped[str] = mapped_column(String(20), default="portrait") # portrait or landscape
    
    # Advanced options
    widows_orphans_control: Mapped[bool] = mapped_column(Boolean, default=True) # Prevent widow/orphan lines
    keep_with_next: Mapped[bool] = mapped_column(Boolean, default=True) # Headings stay with content
    page_break_style: Mapped[str] = mapped_column(String(50), default="auto") # auto, always, avoid, left, right
    
    # Export-specific config (JSON for flexibility)
    export_formats = Column(JSON, default={
        "pdf": {"enabled": True, "paper_size": "Letter"},
        "epub": {"enabled": True, "reflowable": True},
        "mobi": {"enabled": True, "optimized_for_kindle": True},
        "docx": {"enabled": True, "track_changes": False},
    })
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    
    def __repr__(self):
        return f"<FormattingTheme({self.name}, {self.theme_type})>"


class ThemePreset(Base):
    """
    Built-in theme presets (Novel, Academic, Screenplay, etc.)
    Referenced by theme_id when users apply a preset.
    """
    
    __tablename__ = "theme_presets"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    
    # Preset identity
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False) # novel-classic, academic-formal, etc.
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), nullable=False) # novel, academic, screenplay, textbook, poetry
    order_index: Mapped[int] = mapped_column(Integer, default=0) # Display order
    
    # Thumbnail/preview
    preview_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Configuration (stored as JSON for flexibility)
    config: Mapped[dict] = mapped_column(JSON, nullable=False) # Entire FormattingTheme config
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    def __repr__(self):
        return f"<ThemePreset({self.slug})>"
