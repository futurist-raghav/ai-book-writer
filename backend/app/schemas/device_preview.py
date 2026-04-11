"""Schemas for device preview configurations."""

from datetime import datetime

from pydantic import BaseModel, Field


class DevicePresetConfig(BaseModel):
    """Configuration for a single device preset."""

    enabled: bool
    width_px: int
    height_px: int
    margin_px: int | None = None
    margin_top_px: int | None = None
    margin_bottom_px: int | None = None
    margin_left_px: int | None = None
    margin_right_px: int | None = None
    font_size_pt: float
    line_height: float


class DevicePreviewConfigUpdate(BaseModel):
    """Update payload for device preview configuration."""

    # Kindle 6"
    kindle_6_enabled: bool | None = None
    kindle_6_width_px: int | None = None
    kindle_6_height_px: int | None = None
    kindle_6_margin_px: int | None = None
    kindle_6_font_size_pt: float | None = None
    kindle_6_line_height: float | None = None

    # Kindle Paperwhite 7"
    kindle_pw_enabled: bool | None = None
    kindle_pw_width_px: int | None = None
    kindle_pw_height_px: int | None = None
    kindle_pw_margin_px: int | None = None
    kindle_pw_font_size_pt: float | None = None
    kindle_pw_line_height: float | None = None

    # Tablet
    tablet_enabled: bool | None = None
    tablet_width_px: int | None = None
    tablet_height_px: int | None = None
    tablet_margin_px: int | None = None
    tablet_font_size_pt: float | None = None
    tablet_line_height: float | None = None

    # Phone
    phone_enabled: bool | None = None
    phone_width_px: int | None = None
    phone_height_px: int | None = None
    phone_margin_px: int | None = None
    phone_font_size_pt: float | None = None
    phone_line_height: float | None = None

    # Print 6x9"
    print_6x9_enabled: bool | None = None
    print_6x9_width_px: int | None = None
    print_6x9_height_px: int | None = None
    print_6x9_margin_top_px: int | None = None
    print_6x9_margin_bottom_px: int | None = None
    print_6x9_margin_left_px: int | None = None
    print_6x9_margin_right_px: int | None = None
    print_6x9_font_size_pt: float | None = None
    print_6x9_line_height: float | None = None

    # Print 8x10"
    print_8x10_enabled: bool | None = None
    print_8x10_width_px: int | None = None
    print_8x10_height_px: int | None = None
    print_8x10_margin_top_px: int | None = None
    print_8x10_margin_bottom_px: int | None = None
    print_8x10_margin_left_px: int | None = None
    print_8x10_margin_right_px: int | None = None
    print_8x10_font_size_pt: float | None = None
    print_8x10_line_height: float | None = None

    # Print A4
    print_a4_enabled: bool | None = None
    print_a4_width_px: int | None = None
    print_a4_height_px: int | None = None
    print_a4_margin_top_px: int | None = None
    print_a4_margin_bottom_px: int | None = None
    print_a4_margin_left_px: int | None = None
    print_a4_margin_right_px: int | None = None
    print_a4_font_size_pt: float | None = None
    print_a4_line_height: float | None = None

    # Web
    web_enabled: bool | None = None
    web_width_px: int | None = None
    web_height_px: int | None = None
    web_margin_px: int | None = None
    web_font_size_pt: float | None = None
    web_line_height: float | None = None
    web_max_width_px: int | None = None

    # Global settings
    show_chapter_breaks: bool | None = None
    show_page_numbers: bool | None = None
    show_margins: bool | None = None
    show_grid: bool | None = None


class DevicePreviewConfigResponse(BaseModel):
    """Complete device preview configuration response."""

    id: str
    book_id: str

    # Kindle 6"
    kindle_6_enabled: bool
    kindle_6_width_px: int
    kindle_6_height_px: int
    kindle_6_margin_px: int
    kindle_6_font_size_pt: float
    kindle_6_line_height: float

    # Kindle Paperwhite 7"
    kindle_pw_enabled: bool
    kindle_pw_width_px: int
    kindle_pw_height_px: int
    kindle_pw_margin_px: int
    kindle_pw_font_size_pt: float
    kindle_pw_line_height: float

    # Tablet
    tablet_enabled: bool
    tablet_width_px: int
    tablet_height_px: int
    tablet_margin_px: int
    tablet_font_size_pt: float
    tablet_line_height: float

    # Phone
    phone_enabled: bool
    phone_width_px: int
    phone_height_px: int
    phone_margin_px: int
    phone_font_size_pt: float
    phone_line_height: float

    # Print 6x9"
    print_6x9_enabled: bool
    print_6x9_width_px: int
    print_6x9_height_px: int
    print_6x9_margin_top_px: int
    print_6x9_margin_bottom_px: int
    print_6x9_margin_left_px: int
    print_6x9_margin_right_px: int
    print_6x9_font_size_pt: float
    print_6x9_line_height: float

    # Print 8x10"
    print_8x10_enabled: bool
    print_8x10_width_px: int
    print_8x10_height_px: int
    print_8x10_margin_top_px: int
    print_8x10_margin_bottom_px: int
    print_8x10_margin_left_px: int
    print_8x10_margin_right_px: int
    print_8x10_font_size_pt: float
    print_8x10_line_height: float

    # Print A4
    print_a4_enabled: bool
    print_a4_width_px: int
    print_a4_height_px: int
    print_a4_margin_top_px: int
    print_a4_margin_bottom_px: int
    print_a4_margin_left_px: int
    print_a4_margin_right_px: int
    print_a4_font_size_pt: float
    print_a4_line_height: float

    # Web
    web_enabled: bool
    web_width_px: int
    web_height_px: int
    web_margin_px: int
    web_font_size_pt: float
    web_line_height: float
    web_max_width_px: int

    # Global settings
    show_chapter_breaks: bool
    show_page_numbers: bool
    show_margins: bool
    show_grid: bool

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
