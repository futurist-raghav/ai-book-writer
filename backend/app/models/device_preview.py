"""Device preview configuration for different formats and devices."""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DevicePreviewConfig(Base):
    """Configuration for device-specific preview rendering."""

    __tablename__ = "device_preview_configs"
    __table_args__ = (
        UniqueConstraint("book_id", name="uq_device_preview_config_book_id"),
    )

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Foreign Key
    book_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Device-specific configurations
    # Kindle 6" e-reader
    kindle_6_enabled: Mapped[bool] = mapped_column(default=True)
    kindle_6_width_px: Mapped[int] = mapped_column(default=600)
    kindle_6_height_px: Mapped[int] = mapped_column(default=800)
    kindle_6_margin_px: Mapped[int] = mapped_column(default=40)
    kindle_6_font_size_pt: Mapped[float] = mapped_column(Float, default=12.0)
    kindle_6_line_height: Mapped[float] = mapped_column(Float, default=1.5)

    # Kindle Paperwhite 7" e-reader
    kindle_pw_enabled: Mapped[bool] = mapped_column(default=True)
    kindle_pw_width_px: Mapped[int] = mapped_column(default=758)
    kindle_pw_height_px: Mapped[int] = mapped_column(default=1024)
    kindle_pw_margin_px: Mapped[int] = mapped_column(default=50)
    kindle_pw_font_size_pt: Mapped[float] = mapped_column(Float, default=13.0)
    kindle_pw_line_height: Mapped[float] = mapped_column(Float, default=1.6)

    # iPad / Tablet (7-10")
    tablet_enabled: Mapped[bool] = mapped_column(default=True)
    tablet_width_px: Mapped[int] = mapped_column(default=1024)
    tablet_height_px: Mapped[int] = mapped_column(default=1366)
    tablet_margin_px: Mapped[int] = mapped_column(default=80)
    tablet_font_size_pt: Mapped[float] = mapped_column(Float, default=14.0)
    tablet_line_height: Mapped[float] = mapped_column(Float, default=1.7)

    # Phone / Mobile (5-6")
    phone_enabled: Mapped[bool] = mapped_column(default=False)
    phone_width_px: Mapped[int] = mapped_column(default=414)
    phone_height_px: Mapped[int] = mapped_column(default=896)
    phone_margin_px: Mapped[int] = mapped_column(default=20)
    phone_font_size_pt: Mapped[float] = mapped_column(Float, default=16.0)
    phone_line_height: Mapped[float] = mapped_column(Float, default=1.8)

    # Print - 6x9" paperback
    print_6x9_enabled: Mapped[bool] = mapped_column(default=True)
    print_6x9_width_px: Mapped[int] = mapped_column(default=432)
    print_6x9_height_px: Mapped[int] = mapped_column(default=648)
    print_6x9_margin_top_px: Mapped[int] = mapped_column(default=60)
    print_6x9_margin_bottom_px: Mapped[int] = mapped_column(default=60)
    print_6x9_margin_left_px: Mapped[int] = mapped_column(default=48)
    print_6x9_margin_right_px: Mapped[int] = mapped_column(default=48)
    print_6x9_font_size_pt: Mapped[float] = mapped_column(Float, default=11.0)
    print_6x9_line_height: Mapped[float] = mapped_column(Float, default=1.5)

    # Print - 8x10" hardcover
    print_8x10_enabled: Mapped[bool] = mapped_column(default=True)
    print_8x10_width_px: Mapped[int] = mapped_column(default=576)
    print_8x10_height_px: Mapped[int] = mapped_column(default=720)
    print_8x10_margin_top_px: Mapped[int] = mapped_column(default=80)
    print_8x10_margin_bottom_px: Mapped[int] = mapped_column(default=80)
    print_8x10_margin_left_px: Mapped[int] = mapped_column(default=64)
    print_8x10_margin_right_px: Mapped[int] = mapped_column(default=64)
    print_8x10_font_size_pt: Mapped[float] = mapped_column(Float, default=12.0)
    print_8x10_line_height: Mapped[float] = mapped_column(Float, default=1.6)

    # Print - A4 (210x297mm @ 96dpi ≈ 794x1123px)
    print_a4_enabled: Mapped[bool] = mapped_column(default=False)
    print_a4_width_px: Mapped[int] = mapped_column(default=794)
    print_a4_height_px: Mapped[int] = mapped_column(default=1123)
    print_a4_margin_top_px: Mapped[int] = mapped_column(default=80)
    print_a4_margin_bottom_px: Mapped[int] = mapped_column(default=80)
    print_a4_margin_left_px: Mapped[int] = mapped_column(default=80)
    print_a4_margin_right_px: Mapped[int] = mapped_column(default=80)
    print_a4_font_size_pt: Mapped[float] = mapped_column(Float, default=11.0)
    print_a4_line_height: Mapped[float] = mapped_column(Float, default=1.5)

    # Web / Desktop display
    web_enabled: Mapped[bool] = mapped_column(default=True)
    web_width_px: Mapped[int] = mapped_column(default=900)
    web_height_px: Mapped[int] = mapped_column(default=1200)
    web_margin_px: Mapped[int] = mapped_column(default=60)
    web_font_size_pt: Mapped[float] = mapped_column(Float, default=14.0)
    web_line_height: Mapped[float] = mapped_column(Float, default=1.6)
    web_max_width_px: Mapped[int] = mapped_column(default=1200)

    # Global display settings
    show_chapter_breaks: Mapped[bool] = mapped_column(default=True)
    show_page_numbers: Mapped[bool] = mapped_column(default=True)
    show_margins: Mapped[bool] = mapped_column(default=True)
    show_grid: Mapped[bool] = mapped_column(default=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<DevicePreviewConfig book_id={self.book_id}>"
