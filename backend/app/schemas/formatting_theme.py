"""
Formatting Theme Schemas
"""

from datetime import datetime
from uuid import UUID
from typing import Optional, Dict, Any

from pydantic import BaseModel


class FormattingThemeCreate(BaseModel):
    """Create a new formatting theme."""
    name: str
    description: str | None = None
    theme_type: str  # novel, academic, screenplay, textbook, poetry
    
    # Font config
    body_font_family: str = "Garamond"
    body_font_size: int = 12
    heading1_font_family: str = "Garamond"
    heading1_font_size: int = 24
    heading2_font_size: int = 18
    heading3_font_size: int = 14
    line_height: str = "1.5"
    
    # Color config
    text_color: str = "#000000"
    background_color: str = "#FFFFFF"
    heading_color: str = "#000000"
    accent_color: str = "#333333"
    
    # Spacing config
    margin_top: str = "1in"
    margin_bottom: str = "1in"
    margin_left: str = "1in"
    margin_right: str = "1in"
    paragraph_indent: str = "0.5in"


class FormattingThemeUpdate(BaseModel):
    """Update formatting theme properties."""
    name: str | None = None
    description: str | None = None
    body_font_family: str | None = None
    body_font_size: int | None = None
    line_height: str | None = None
    text_color: str | None = None
    heading_color: str | None = None
    margin_top: str | None = None
    margin_bottom: str | None = None
    margin_left: str | None = None
    margin_right: str | None = None
    widows_orphans_control: bool | None = None


class FormattingThemeResponse(BaseModel):
    """Response for a formatting theme."""
    id: UUID
    book_id: UUID
    name: str
    description: str | None
    theme_type: str
    is_preset: bool
    is_custom: bool
    
    # Font config
    body_font_family: str
    body_font_size: int
    heading1_font_size: int
    line_height: str
    
    # Color config
    text_color: str
    heading_color: str
    
    # Spacing config
    margin_top: str
    margin_left: str
    margin_right: str
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ThemePresetResponse(BaseModel):
    """Response for a theme preset."""
    id: UUID
    slug: str
    display_name: str
    description: str | None
    category: str
    preview_image_url: str | None
    config: Dict[str, Any]
    
    class Config:
        from_attributes = True


class BookThemesResponse(BaseModel):
    """Response for all themes in a book."""
    book_id: UUID
    custom_themes: list[FormattingThemeResponse]
    presets: list[ThemePresetResponse]
    
    class Config:
        from_attributes = True
