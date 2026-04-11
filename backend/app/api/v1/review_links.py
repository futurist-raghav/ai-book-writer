"""
Review Links API Routes

Enables authors to generate sharable read-only links for beta reader feedback.
"""

import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
from app.models.review_link import ReviewLink, ReviewerComment
from app.schemas.review_link import ReviewLinkCreate, ReviewLinkResponse, ReviewFeedbackCollectionResponse, ReviewerFeedback

router = APIRouter(prefix="/api/v1", tags=["review-links"])


@router.post("/books/{book_id}/review-links", response_model=ReviewLinkResponse)
async def create_review_link(
    book_id: uuid.UUID,
    request: ReviewLinkCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Generate a shareable review link for beta reader feedback.
    
    Beta readers can access chapters read-only and leave structured feedback.
    No login required - just share the link.
    """
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Generate unique share code
    share_code = secrets.token_urlsafe(16)  # ~128-bit entropy
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=request.expires_in_days or 30
    )

    # Determine chapters to include
    chapter_ids = request.chapter_ids or []
    if not chapter_ids:
        # Include all chapters if none specified
        chapters_result = await db.execute(
            select(func.count(BookChapter.id)).where(BookChapter.book_id == book_id)
        )
        chapter_count = chapters_result.scalar() or 0
    else:
        chapter_count = len(chapter_ids)

    # Create review link in database
    review_link = ReviewLink(
        id=uuid.uuid4(),
        book_id=book_id,
        share_code=share_code,
        expires_at=expires_at,
        created_by=user_id,
        allow_comments=request.allow_comments,
        password_hash=None,  # TODO: hash password if provided
        chapters_included=chapter_count,
        is_active=True,
    )

    db.add(review_link)
    await db.flush()

    review_url = f"{settings.FRONTEND_URL}/review/{share_code}"

    return ReviewLinkResponse(
        link_id=str(review_link.id),
        book_id=str(book_id),
        review_url=review_url,
        share_code=share_code,
        chapters_included=chapter_count,
        expires_at=expires_at,
        created_at=review_link.created_at,
        status="active",
        viewer_count=0,
        comment_count=0,
        allow_comments=request.allow_comments,
    )


@router.get("/review/{share_code}/chapters", response_model=list)
async def get_review_link_chapters(
    share_code: str,
    db: AsyncSessionDep,
):
    """
    Get chapters for a review link (public endpoint - no auth required).
    
    Used by beta readers to view available chapters.
    """
    # Find the review link
    link_result = await db.execute(
        select(ReviewLink)
        .where(ReviewLink.share_code == share_code, ReviewLink.is_active == True)
    )
    review_link = link_result.scalar_one_or_none()

    if not review_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review link not found or has expired",
        )

    # Check if link has expired
    if review_link.expires_at < datetime.now(timezone.utc):
        review_link.is_active = False
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Review link has expired",
        )

    # Get chapters for this book
    chapters_result = await db.execute(
        select(Chapter).where(Chapter.book_id == review_link.book_id).order_by(Chapter.order_index)
    )
    chapters = chapters_result.scalars().all()

    return [
        {
            "id": str(ch.id),
            "title": ch.title,
            "chapter_number": ch.chapter_number,
            "summary": ch.summary,
        }
        for ch in chapters
    ]


@router.get("/review/{share_code}/chapters/{chapter_id}")
async def get_review_chapter_content(
    share_code: str,
    chapter_id: uuid.UUID,
    db: AsyncSessionDep,
):
    """
    Get chapter content for review (public endpoint - no auth required).
    
    Beta readers use this to read chapters and leave feedback.
    """
    # Find the review link
    link_result = await db.execute(
        select(ReviewLink)
        .where(ReviewLink.share_code == share_code, ReviewLink.is_active == True)
    )
    review_link = link_result.scalar_one_or_none()

    if not review_link or review_link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review link not found or expired",
        )

    # Get chapter
    chapter_result = await db.execute(
        select(Chapter).where(
            Chapter.id == chapter_id,
            Chapter.book_id == review_link.book_id,
        )
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    return {
        "id": str(chapter.id),
        "title": chapter.title,
        "chapter_number": chapter.chapter_number,
        "content": chapter.content,  # Read-only
        "word_count": len(chapter.content.split()) if chapter.content else 0,
    }


@router.post("/review/{share_code}/feedback")
async def submit_review_feedback(
    share_code: str,
    chapter_id: uuid.UUID,
    feedback: dict,  # {position, context_text, feedback_text, feedback_type, reviewer_name}
    db: AsyncSessionDep,
):
    """
    Submit feedback on a chapter (public endpoint - no auth required).
    
    Beta readers leave feedback without needing an account.
    """
    # Find the review link
    link_result = await db.execute(
        select(ReviewLink)
        .where(ReviewLink.share_code == share_code, ReviewLink.is_active == True)
    )
    review_link = link_result.scalar_one_or_none()

    if not review_link or not review_link.allow_comments:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Comments are not allowed for this review link",
        )

    if review_link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Review link has expired",
        )

    # Save the feedback
    comment = ReviewerComment(
        id=uuid.uuid4(),
        review_link_id=review_link.id,
        chapter_id=chapter_id,
        position=feedback.get("position", 0),
        context_text=feedback.get("context_text", ""),
        feedback_text=feedback.get("feedback_text", ""),
        feedback_type=feedback.get("feedback_type", "general"),
        reviewer_name=feedback.get("reviewer_name", "Anonymous"),
        created_at=datetime.now(timezone.utc),
    )

    db.add(comment)
    await db.flush()

    return {
        "message": "Feedback submitted successfully",
        "feedback_id": str(comment.id),
    }


@router.get("/books/{book_id}/review-links", response_model=List[ReviewLinkResponse])
async def list_review_links(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    List all review links for a book (owner only).
    
    Shows status, viewer count, comment count, expiration.
    """
    # Verify ownership
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get all review links
    links_result = await db.execute(
        select(ReviewLink)
        .where(ReviewLink.book_id == book_id)
        .order_by(ReviewLink.created_at.desc())
    )
    links = links_result.scalars().all()

    # Get stats for each link
    response = []
    for link in links:
        # Count comments
        comments_result = await db.execute(
            select(func.count(ReviewerComment.id)).where(
                ReviewerComment.review_link_id == link.id
            )
        )
        comment_count = comments_result.scalar() or 0

        status_val = "expired" if link.expires_at < datetime.now(timezone.utc) else "active"
        if not link.is_active:
            status_val = "disabled"

        response.append(
            ReviewLinkResponse(
                link_id=str(link.id),
                book_id=str(link.book_id),
                review_url=f"{settings.FRONTEND_URL}/review/{link.share_code}",
                share_code=link.share_code,
                chapters_included=link.chapters_included,
                expires_at=link.expires_at,
                created_at=link.created_at,
                status=status_val,
                viewer_count=0,  # TODO: implement viewer tracking
                comment_count=comment_count,
                allow_comments=link.allow_comments,
            )
        )

    return response


@router.get("/books/{book_id}/review-feedback", response_model=ReviewFeedbackCollectionResponse)
async def get_review_feedback(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get all feedback from review links for a book (owner only).
    
    Aggregates feedback by chapter, type, and shows common issues.
    """
    # Verify ownership
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get all review links for this book
    links_result = await db.execute(
        select(ReviewLink).where(ReviewLink.book_id == book_id)
    )
    links = links_result.scalars().all()
    link_ids = [link.id for link in links]

    if not link_ids:
        return ReviewFeedbackCollectionResponse(
            link_id="",
            book_id=str(book_id),
            reviewer_count=0,
            total_comments=0,
            feedback_by_chapter={},
            feedback_by_type={},
            common_issues=[],
            created_at=datetime.now(timezone.utc),
        )

    # Get all comments across all review links
    comments_result = await db.execute(
        select(ReviewerComment)
        .where(ReviewerComment.review_link_id.in_(link_ids))
        .order_by(ReviewerComment.created_at.desc())
    )
    comments = comments_result.scalars().all()

    # Aggregate feedback
    feedback_by_chapter = {}
    feedback_by_type = {}
    reviewer_names = set()

    for comment in comments:
        # By chapter
        if str(comment.chapter_id) not in feedback_by_chapter:
            feedback_by_chapter[str(comment.chapter_id)] = []

        feedback_by_chapter[str(comment.chapter_id)].append(
            ReviewerFeedback(
                chapter_id=str(comment.chapter_id),
                chapter_title="",  # TODO: load chapter title
                position=comment.position,
                context_text=comment.context_text,
                feedback_text=comment.feedback_text,
                feedback_type=comment.feedback_type,
                created_at=comment.created_at,
                reviewer_name=comment.reviewer_name,
            )
        )

        # By type
        feedback_by_type[comment.feedback_type] = feedback_by_type.get(comment.feedback_type, 0) + 1
        if comment.reviewer_name and comment.reviewer_name != "Anonymous":
            reviewer_names.add(comment.reviewer_name)

    return ReviewFeedbackCollectionResponse(
        link_id=str(links[0].id) if links else "",
        book_id=str(book_id),
        reviewer_count=len(reviewer_names),
        total_comments=len(comments),
        feedback_by_chapter=feedback_by_chapter,
        feedback_by_type=feedback_by_type,
        common_issues=[],  # TODO: extract common themes from feedback_text
        created_at=datetime.now(timezone.utc),
    )
