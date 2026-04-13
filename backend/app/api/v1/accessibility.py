"""Accessibility checking and validation API endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.dependencies import get_current_user, get_db
from app.models import Book, AccessibilityScan, AccessibilityRecommendation, User
from app.schemas.accessibility import (
    AccessibilityScanExecuteRequest,
    AccessibilityScanResponse,
    AccessibilityScanHistoryResponse,
    AccessibilityRecommendationResponse,
    AccessibilityRecommendationsListResponse,
    AccessibilityRecommendationUpdate,
)

router = APIRouter()


@router.post(
    "/books/{book_id}/accessibility/scan",
    response_model=AccessibilityScanResponse,
    tags=["Accessibility"],
)
async def execute_accessibility_scan(
    book_id: str,
    payload: AccessibilityScanExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessibilityScanResponse:
    """Execute an accessibility scan on a book."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Create scan record
    scan = AccessibilityScan(
        book_id=book_id,
        scan_type=payload.scan_type,
        format_scanned=payload.format_to_scan,
        chapter_id=payload.chapter_id,
        scan_status="pending",
    )
    db.add(scan)
    await db.commit()

    # TODO: Queue background job for actual scanning
    # For now, mock some results
    scan.scan_status = "completed"
    scan.completed_at = datetime.now(timezone.utc)
    scan.total_issues = 8  # Mock data
    scan.error_count = 2
    scan.warning_count = 4
    scan.info_count = 2
    scan.accessibility_score = 72
    scan.wcag_level = "AA"
    scan.wcag_2_1_aa_compliant = False

    # Mock issues
    scan.issues = [
        {
            "type": "missing_alt_text",
            "severity": "error",
            "message": "Image missing alternative text",
            "location": "Chapter 3, page 5",
            "suggestion": "Provide descriptive alt text for the cover image",
            "wcag_criterion": "1.1.1",
        },
        {
            "type": "low_color_contrast",
            "severity": "warning",
            "message": "Text/background color contrast below 4.5:1",
            "location": "Footer",
            "wcag_criterion": "1.4.3",
        },
    ]

    await db.commit()
    await db.refresh(scan)

    return AccessibilityScanResponse.model_validate(scan)


@router.get(
    "/books/{book_id}/accessibility/scan/latest",
    response_model=AccessibilityScanResponse,
    tags=["Accessibility"],
)
async def get_latest_accessibility_scan(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessibilityScanResponse:
    """Get the latest accessibility scan for a book."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get latest scan
    stmt = (
        select(AccessibilityScan)
        .filter(AccessibilityScan.book_id == book_id)
        .order_by(desc(AccessibilityScan.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    scan = result.scalars().first()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No accessibility scans found. Run a scan to get started.",
        )

    return AccessibilityScanResponse.model_validate(scan)


@router.get(
    "/books/{book_id}/accessibility/scan/history",
    response_model=AccessibilityScanHistoryResponse,
    tags=["Accessibility"],
)
async def get_accessibility_scan_history(
    book_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessibilityScanHistoryResponse:
    """Get accessibility scan history for a book."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get scan history
    stmt = (
        select(AccessibilityScan)
        .filter(AccessibilityScan.book_id == book_id)
        .order_by(desc(AccessibilityScan.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    scans = result.scalars().all()

    scan_responses = [AccessibilityScanResponse.model_validate(s) for s in scans]

    # Calculate trend
    trend = None
    if len(scan_responses) >= 2:
        latest = scan_responses[0].accessibility_score
        previous = scan_responses[1].accessibility_score
        if latest > previous:
            trend = "improving"
        elif latest < previous:
            trend = "declining"
        else:
            trend = "stable"

    return AccessibilityScanHistoryResponse(
        book_id=book_id,
        total_scans=len(scans),
        latest_score=scan_responses[0].accessibility_score if scan_responses else 0,
        previous_score=scan_responses[1].accessibility_score if len(scan_responses) > 1 else None,
        score_trend=trend,
        scans=scan_responses,
    )


@router.get(
    "/books/{book_id}/accessibility/recommendations",
    response_model=AccessibilityRecommendationsListResponse,
    tags=["Accessibility"],
)
async def get_accessibility_recommendations(
    book_id: str,
    status_filter: str = "open",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessibilityRecommendationsListResponse:
    """Get accessibility recommendations for a book."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get recommendations
    stmt = select(AccessibilityRecommendation).filter(
        AccessibilityRecommendation.book_id == book_id
    )
    if status_filter and status_filter != "all":
        stmt = stmt.filter(AccessibilityRecommendation.status == status_filter)
    stmt = stmt.order_by(desc(AccessibilityRecommendation.priority))

    result = await db.execute(stmt)
    recommendations = result.scalars().all()

    recommendation_responses = [
        AccessibilityRecommendationResponse.model_validate(r) for r in recommendations
    ]

    open_count = len([r for r in recommendations if r.status == "open"])
    completed_count = len([r for r in recommendations if r.status == "completed"])
    high_priority_count = len([r for r in recommendations if r.priority >= 8])

    return AccessibilityRecommendationsListResponse(
        book_id=book_id,
        total_recommendations=len(recommendations),
        open_count=open_count,
        completed_count=completed_count,
        high_priority_count=high_priority_count,
        recommendations=recommendation_responses,
    )


@router.patch(
    "/books/{book_id}/accessibility/recommendations/{recommendation_id}",
    response_model=AccessibilityRecommendationResponse,
    tags=["Accessibility"],
)
async def update_accessibility_recommendation(
    book_id: str,
    recommendation_id: str,
    payload: AccessibilityRecommendationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessibilityRecommendationResponse:
    """Update an accessibility recommendation status."""
    # Verify book exists and user has access
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get recommendation
    recommendation = await db.get(AccessibilityRecommendation, recommendation_id)
    if not recommendation or recommendation.book_id != book_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found"
        )

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(recommendation, field):
            setattr(recommendation, field, value)

    await db.commit()
    await db.refresh(recommendation)

    return AccessibilityRecommendationResponse.model_validate(recommendation)


@router.get(
    "/accessibility/wcag-guidelines",
    tags=["Accessibility"],
)
async def get_wcag_guidelines() -> dict:
    """Get WCAG guidelines and accessibility best practices."""
    return {
        "wcag_versions": [
            {
                "version": "WCAG 2.1",
                "url": "https://www.w3.org/WAI/WCAG21/quickref/",
                "levels": ["A", "AA", "AAA"],
            },
            {
                "version": "WCAG 3.0 (Draft)",
                "url": "https://www.w3.org/WAI/wcag3/explainer/",
                "status": "draft",
            },
        ],
        "accessibility_checks": [
            {
                "id": "alt_text",
                "name": "Alternative Text",
                "criterion": "1.1.1",
                "level": "A",
                "description": "All images and graphics must have descriptive alternative text",
                "tips": [
                    "Be concise and specific",
                    "Describe the content and function of the image",
                    "For decorative images, use empty alt text",
                    "Avoid starting with 'image of' or 'picture of'",
                ],
            },
            {
                "id": "color_contrast",
                "name": "Color Contrast",
                "criterion": "1.4.3",
                "level": "AA",
                "description": "Text must have sufficient contrast with its background",
                "thresholds": {
                    "normal_text": "4.5:1",
                    "large_text": "3:1",
                    "graphics": "3:1",
                },
            },
            {
                "id": "heading_hierarchy",
                "name": "Proper Heading Structure",
                "criterion": "1.3.1",
                "level": "A",
                "description": "Headings must follow a logical hierarchy (H1, H2, H3, etc.)",
                "tips": [
                    "Use only one H1 per page (document title)",
                    "Don't skip heading levels",
                    "Use headings for structure, not styling",
                ],
            },
            {
                "id": "table_headers",
                "name": "Table Accessibility",
                "criterion": "1.3.1",
                "level": "A",
                "description": "Tables must properly identify row and column headers",
                "tips": [
                    "Mark header cells properly",
                    "Use scope attributes for headers",
                    "Avoid complex nested table structures",
                ],
            },
            {
                "id": "link_text",
                "name": "Link Text",
                "criterion": "2.4.4",
                "level": "A",
                "description": "Links must have descriptive text that makes sense out of context",
                "tips": [
                    'Avoid generic text like "click here" or "read more"',
                    "Provide context for what the link does",
                    "If image is a link, ensure it has alt text",
                ],
            },
        ],
        "tools": [
            {
                "name": "WAVE",
                "type": "Browser Extension",
                "url": "https://wave.webaim.org/",
                "description": "Visual feedback tool for web accessibility",
            },
            {
                "name": "axe DevTools",
                "type": "Browser Extension",
                "url": "https://www.deque.com/axe/devtools/",
                "description": "Automated accessibility testing",
            },
            {
                "name": "Lighthouse",
                "type": "Browser Tool",
                "url": "https://chromedev​eloper.tools/docs/lighthouse",
                "description": "Google Chrome's accessibility audit",
            },
        ],
    }
