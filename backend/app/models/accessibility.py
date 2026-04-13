"""Accessibility validation models and scanning for published content."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Enum as SQLEnum, String, Text, DateTime, Boolean, Integer, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AccessibilityIssueSeverity(str, Enum):
    """Severity levels for accessibility issues."""

    ERROR = "error"  # Critical accessibility barrier
    WARNING = "warning"  # Significant accessibility issue
    INFO = "info"  # Minor improvement opportunity


class AccessibilityIssueType(str, Enum):
    """Types of accessibility issues detected."""

    MISSING_ALT_TEXT = "missing_alt_text"
    LOW_COLOR_CONTRAST = "low_color_contrast"
    MISSING_HEADING = "missing_heading"
    BROKEN_HEADING_HIERARCHY = "broken_heading_hierarchy"
    MISSING_TABLE_HEADER = "missing_table_header"
    INACCESSIBLE_TABLE = "inaccessible_table"
    UNLABELED_FORM_INPUT = "unlabeled_form_input"
    MISSING_LANGUAGE_DECLARATION = "missing_language_declaration"
    MISSING_PAGE_TITLE = "missing_page_title"
    POOR_LINK_TEXT = "poor_link_text"
    MISSING_ARIA_LABEL = "missing_aria_label"


class AccessibilityScan(Base):
    """Accessibility scan report for a book."""

    __tablename__ = "accessibility_scans"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Foreign Key
    book_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Scan Metadata
    scan_type: Mapped[str] = mapped_column(String(50), default="full")  # "full", "chapter", "format"
    format_scanned: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "pdf", "epub", "web"
    chapter_id: Mapped[Optional[str]] = mapped_column(String(36), default=None)

    # Issue Counts
    total_issues: Mapped[int] = mapped_column(default=0)
    error_count: Mapped[int] = mapped_column(default=0)
    warning_count: Mapped[int] = mapped_column(default=0)
    info_count: Mapped[int] = mapped_column(default=0)

    # Specific Issue Counts
    missing_alt_text_count: Mapped[int] = mapped_column(default=0)
    contrast_issues_count: Mapped[int] = mapped_column(default=0)
    heading_issues_count: Mapped[int] = mapped_column(default=0)
    table_issues_count: Mapped[int] = mapped_column(default=0)
    form_issues_count: Mapped[int] = mapped_column(default=0)

    # Accessibility Score
    accessibility_score: Mapped[int] = mapped_column(default=100)  # 0-100 score
    wcag_level: Mapped[Optional[str]] = mapped_column(String(10), default=None)  # "A", "AA", "AAA"

    # Issue Details (stored as JSON)
    issues: Mapped[Optional[dict]] = mapped_column(JSON, default=None)  # Array of issue objects

    # Compliance Checks
    wcag_2_1_compliant: Mapped[bool] = mapped_column(default=False)
    wcag_2_1_aa_compliant: Mapped[bool] = mapped_column(default=False)
    wcag_2_1_aaa_compliant: Mapped[bool] = mapped_column(default=False)
    section_508_compliant: Mapped[bool] = mapped_column(default=False)

    # Content Scanned
    paragraphs_checked: Mapped[int] = mapped_column(default=0)
    images_checked: Mapped[int] = mapped_column(default=0)
    links_checked: Mapped[int] = mapped_column(default=0)
    tables_checked: Mapped[int] = mapped_column(default=0)
    headings_checked: Mapped[int] = mapped_column(default=0)
    forms_checked: Mapped[int] = mapped_column(default=0)

    # Scan Configuration
    check_alt_text: Mapped[bool] = mapped_column(default=True)
    check_contrast: Mapped[bool] = mapped_column(default=True)
    check_heading_hierarchy: Mapped[bool] = mapped_column(default=True)
    check_table_headers: Mapped[bool] = mapped_column(default=True)
    check_form_labels: Mapped[bool] = mapped_column(default=True)
    check_link_text: Mapped[bool] = mapped_column(default=True)
    contrast_ratio_level: Mapped[str] = mapped_column(
        default="aa"
    )  # "a", "aa", "aaa" for WCAG levels

    # Report Metadata
    scan_status: Mapped[str] = mapped_column(default="completed")  # "pending", "in_progress", "completed", "failed"
    error_message: Mapped[Optional[str]] = mapped_column(Text, default=None)

    # Fixes Applied
    auto_fixes_available: Mapped[int] = mapped_column(default=0)
    fixes_applied_count: Mapped[int] = mapped_column(default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<AccessibilityScan book_id={self.book_id} score={self.accessibility_score}>"


class AccessibilityRecommendation(Base):
    """Accessibility improvement recommendations for a book."""

    __tablename__ = "accessibility_recommendations"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Foreign Key
    book_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    scan_id: Mapped[Optional[str]] = mapped_column(String(36), default=None)

    # Recommendation
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[AccessibilityIssueSeverity] = mapped_column(
        SQLEnum(AccessibilityIssueSeverity), default=AccessibilityIssueSeverity.WARNING
    )

    # Action Steps
    steps_to_fix: Mapped[Optional[str]] = mapped_column(Text, default=None)  # JSON array
    affected_locations: Mapped[Optional[str]] = mapped_column(Text, default=None)  # JSON array

    # Status
    status: Mapped[str] = mapped_column(default="open")  # "open", "accepted", "dismissed", "completed"
    priority: Mapped[int] = mapped_column(default=5)  # 1-10 priority level

    # Implementation
    implementation_difficulty: Mapped[str] = mapped_column(default="medium")  # "easy", "medium", "hard"
    estimated_time_minutes: Mapped[Optional[int]] = mapped_column(Integer, default=None)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<AccessibilityRecommendation book_id={self.book_id} type={self.issue_type}>"
