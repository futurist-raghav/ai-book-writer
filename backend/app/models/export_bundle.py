"""Export bundle configurations for different submission modes."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from sqlalchemy import Enum as SQLEnum, String, Text, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ExportBundleType(str, Enum):
    """Types of export bundles available."""

    KDP = "kdp"  # Amazon KDP (Kindle Direct Publishing)
    AGENT = "agent"  # Literary agent submission
    BETA = "beta"  # Beta reader feedback version
    PRINT = "print"  # Print-on-demand ready PDF
    EBOOK = "ebook"  # Generic e-book format


class ExportBundleFormat(str, Enum):
    """File formats for export bundles."""

    PDF = "pdf"
    EPUB = "epub"
    MOBI = "mobi"
    DOCX = "docx"
    HTML = "html"
    ZIP = "zip"  # Multiple formats bundled


class ExportBundle(Base):
    """Configuration for optimized export bundles for different channels."""

    __tablename__ = "export_bundles"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Foreign Keys
    book_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Bundle Type
    bundle_type: Mapped[ExportBundleType] = mapped_column(SQLEnum(ExportBundleType), nullable=False)

    # Export Configuration
    primary_format: Mapped[ExportBundleFormat] = mapped_column(
        SQLEnum(ExportBundleFormat), default=ExportBundleFormat.PDF
    )
    include_secondary_formats: Mapped[bool] = mapped_column(default=False)
    secondary_formats: Mapped[Optional[str]] = mapped_column(String(500), default=None)  # JSON array

    # Content Options
    include_front_matter: Mapped[bool] = mapped_column(default=True)
    include_back_matter: Mapped[bool] = mapped_column(default=True)
    include_toc: Mapped[bool] = mapped_column(default=True)
    include_bookmarks: Mapped[bool] = mapped_column(default=True)

    # Metadata
    include_metadata: Mapped[bool] = mapped_column(default=True)
    include_keywords: Mapped[bool] = mapped_column(default=True)
    include_author_bio: Mapped[bool] = mapped_column(default=True)

    # Formatting
    preserve_formatting: Mapped[bool] = mapped_column(default=True)
    use_embedded_fonts: Mapped[bool] = mapped_column(default=True)
    compress_images: Mapped[bool] = mapped_column(default=False)
    image_dpi: Mapped[int] = mapped_column(default=300)

    # KDP Specific
    kdp_enabled: Mapped[bool] = mapped_column(default=False)
    kdp_trim_size: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "6x9", "8x10", etc.
    kdp_paper_type: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "white", "cream"
    kdp_bleed_enabled: Mapped[bool] = mapped_column(default=False)

    # Agent Submission Specific
    agent_enabled: Mapped[bool] = mapped_column(default=False)
    agent_format: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "docx", "pdf"
    agent_double_spaced: Mapped[bool] = mapped_column(default=True)
    agent_include_page_numbers: Mapped[bool] = mapped_column(default=True)
    agent_include_word_count: Mapped[bool] = mapped_column(default=True)

    # Beta Reader Specific
    beta_enabled: Mapped[bool] = mapped_column(default=False)
    beta_include_comments_enabled: Mapped[bool] = mapped_column(default=True)
    beta_include_line_numbers: Mapped[bool] = mapped_column(default=True)
    beta_wide_margins: Mapped[bool] = mapped_column(default=True)
    beta_margin_size_inches: Mapped[float] = mapped_column(default=1.5)

    # Print Specific
    print_enabled: Mapped[bool] = mapped_column(default=False)
    print_trim_size: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "6x9", "8x10", "a4"
    print_color_mode: Mapped[Optional[str]] = mapped_column(String(20), default="bw")  # "bw", "color"
    print_binding_type: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "perfect", "spiral"
    print_include_bleed: Mapped[bool] = mapped_column(default=True)
    print_bleed_size_inches: Mapped[float] = mapped_column(default=0.125)

    # E-book Specific
    ebook_enabled: Mapped[bool] = mapped_column(default=False)
    ebook_include_drm: Mapped[bool] = mapped_column(default=False)
    ebook_include_enhanced_fonts: Mapped[bool] = mapped_column(default=True)

    # Export History
    last_exported_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    export_count: Mapped[int] = mapped_column(default=0)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<ExportBundle book_id={self.book_id} type={self.bundle_type}>"
