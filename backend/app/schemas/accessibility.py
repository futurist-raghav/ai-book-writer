"""Schemas for accessibility scanning and reporting."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AccessibilityIssue(BaseModel):
    """An individual accessibility issue found during scan."""

    type: str
    severity: str  # "error", "warning", "info"
    message: str
    location: Optional[str] = None  # Chapter/page/section reference
    line_number: Optional[int] = None
    suggestion: Optional[str] = None
    wcag_criterion: Optional[str] = None  # e.g., "1.1.1", "1.4.3"


class AccessibilityScanUpdate(BaseModel):
    """Update payload for accessibility scan."""

    # Scan Configuration
    check_alt_text: Optional[bool] = None
    check_contrast: Optional[bool] = None
    check_heading_hierarchy: Optional[bool] = None
    check_table_headers: Optional[bool] = None
    check_form_labels: Optional[bool] = None
    check_link_text: Optional[bool] = None
    contrast_ratio_level: Optional[str] = None

    # Status
    status: Optional[str] = None


class AccessibilityScanResponse(BaseModel):
    """Complete accessibility scan report."""

    id: str
    book_id: str
    scan_type: str
    format_scanned: Optional[str]
    chapter_id: Optional[str]

    # Issue Counts
    total_issues: int
    error_count: int
    warning_count: int
    info_count: int

    # Specific Issue Counts
    missing_alt_text_count: int
    contrast_issues_count: int
    heading_issues_count: int
    table_issues_count: int
    form_issues_count: int

    # Accessibility Score
    accessibility_score: int
    wcag_level: Optional[str]

    # Issue Details
    issues: Optional[List[AccessibilityIssue]] = None

    # Compliance
    wcag_2_1_compliant: bool
    wcag_2_1_aa_compliant: bool
    wcag_2_1_aaa_compliant: bool
    section_508_compliant: bool

    # Content Scanned
    paragraphs_checked: int
    images_checked: int
    links_checked: int
    tables_checked: int
    headings_checked: int
    forms_checked: int

    # Status
    scan_status: str
    auto_fixes_available: int

    created_at: datetime
    completed_at: Optional[datetime]
    updated_at: datetime

    class Config:
        from_attributes = True


class AccessibilityRecommendationResponse(BaseModel):
    """Accessibility improvement recommendation."""

    id: str
    book_id: str
    scan_id: Optional[str]
    title: str
    description: str
    issue_type: str
    severity: str
    steps_to_fix: Optional[str] = None
    affected_locations: Optional[str] = None
    status: str
    priority: int
    implementation_difficulty: str
    estimated_time_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccessibilityRecommendationUpdate(BaseModel):
    """Update payload for accessibility recommendation."""

    status: Optional[str] = None
    priority: Optional[int] = None
    steps_to_fix: Optional[str] = None


class AccessibilityRecommendationsListResponse(BaseModel):
    """List of accessibility recommendations for a book."""

    book_id: str
    total_recommendations: int
    open_count: int
    completed_count: int
    high_priority_count: int
    recommendations: List[AccessibilityRecommendationResponse]


class AccessibilityScanExecuteRequest(BaseModel):
    """Request to execute an accessibility scan."""

    scan_type: str = "full"  # "full", "chapter", "format"
    format_to_scan: Optional[str] = None  # "pdf", "epub", "web"
    chapter_id: Optional[str] = None


class AccessibilityScanHistoryResponse(BaseModel):
    """Historical accessibility scan data."""

    book_id: str
    total_scans: int
    latest_score: int
    previous_score: Optional[int] = None
    score_trend: Optional[str] = None  # "improving", "stable", "declining"
    scans: List[AccessibilityScanResponse]
