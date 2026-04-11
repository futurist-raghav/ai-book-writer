"""Schemas for export bundle configurations."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ExportBundleConfig(BaseModel):
    """Configuration options for a specific export bundle."""

    # Content
    include_front_matter: bool = True
    include_back_matter: bool = True
    include_toc: bool = True
    include_bookmarks: bool = True

    # Metadata
    include_metadata: bool = True
    include_keywords: bool = True
    include_author_bio: bool = True

    # Formatting
    preserve_formatting: bool = True
    use_embedded_fonts: bool = True
    compress_images: bool = False
    image_dpi: int = 300


class ExportBundleUpdate(BaseModel):
    """Update payload for export bundle configuration."""

    # Bundle Type specific configs
    primary_format: str | None = None
    include_secondary_formats: bool | None = None
    secondary_formats: str | None = None

    # Content Options
    include_front_matter: bool | None = None
    include_back_matter: bool | None = None
    include_toc: bool | None = None
    include_bookmarks: bool | None = None

    # Metadata
    include_metadata: bool | None = None
    include_keywords: bool | None = None
    include_author_bio: bool | None = None

    # Formatting
    preserve_formatting: bool | None = None
    use_embedded_fonts: bool | None = None
    compress_images: bool | None = None
    image_dpi: int | None = None

    # KDP Specific
    kdp_enabled: bool | None = None
    kdp_trim_size: str | None = None
    kdp_paper_type: str | None = None
    kdp_bleed_enabled: bool | None = None

    # Agent Submission Specific
    agent_enabled: bool | None = None
    agent_format: str | None = None
    agent_double_spaced: bool | None = None
    agent_include_page_numbers: bool | None = None
    agent_include_word_count: bool | None = None

    # Beta Reader Specific
    beta_enabled: bool | None = None
    beta_include_comments_enabled: bool | None = None
    beta_include_line_numbers: bool | None = None
    beta_wide_margins: bool | None = None
    beta_margin_size_inches: float | None = None

    # Print Specific
    print_enabled: bool | None = None
    print_trim_size: str | None = None
    print_color_mode: str | None = None
    print_binding_type: str | None = None
    print_include_bleed: bool | None = None
    print_bleed_size_inches: float | None = None

    # E-book Specific
    ebook_enabled: bool | None = None
    ebook_include_drm: bool | None = None
    ebook_include_enhanced_fonts: bool | None = None


class ExportBundleResponse(BaseModel):
    """Complete export bundle response."""

    id: str
    book_id: str

    # Bundle Type
    bundle_type: str

    # Export Configuration
    primary_format: str
    include_secondary_formats: bool
    secondary_formats: Optional[str]

    # Content Options
    include_front_matter: bool
    include_back_matter: bool
    include_toc: bool
    include_bookmarks: bool

    # Metadata
    include_metadata: bool
    include_keywords: bool
    include_author_bio: bool

    # Formatting
    preserve_formatting: bool
    use_embedded_fonts: bool
    compress_images: bool
    image_dpi: int

    # KDP Specific
    kdp_enabled: bool
    kdp_trim_size: Optional[str]
    kdp_paper_type: Optional[str]
    kdp_bleed_enabled: bool

    # Agent Submission Specific
    agent_enabled: bool
    agent_format: Optional[str]
    agent_double_spaced: bool
    agent_include_page_numbers: bool
    agent_include_word_count: bool

    # Beta Reader Specific
    beta_enabled: bool
    beta_include_comments_enabled: bool
    beta_include_line_numbers: bool
    beta_wide_margins: bool
    beta_margin_size_inches: float

    # Print Specific
    print_enabled: bool
    print_trim_size: Optional[str]
    print_color_mode: Optional[str]
    print_binding_type: Optional[str]
    print_include_bleed: bool
    print_bleed_size_inches: float

    # E-book Specific
    ebook_enabled: bool
    ebook_include_drm: bool
    ebook_include_enhanced_fonts: bool

    # Export History
    last_exported_at: Optional[datetime]
    export_count: int

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExportBundleListResponse(BaseModel):
    """List of export bundles for a book."""

    book_id: str
    bundles: List[ExportBundleResponse]
    available_bundle_types: List[str] = Field(
        default=["kdp", "agent", "beta", "print", "ebook"]
    )


class ExportBundleExecuteRequest(BaseModel):
    """Request to execute/download an export bundle."""

    bundle_id: str
    format: str = "pdf"  # Override format if needed
    include_draft_chapters: bool = False


class ExportBundleExecuteResponse(BaseModel):
    """Response when executing an export."""

    success: bool
    message: str
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    estimated_download_time_seconds: Optional[int] = None
    created_at: datetime
