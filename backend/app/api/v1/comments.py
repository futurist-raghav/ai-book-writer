"""
Comments API Routes

Handles chapter comments, mentions, and notification workflows.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.chapter import Chapter
from app.models.comment import ChapterComment, CommentReply, CommentNotification
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentResponse,
    CommentReplyCreate,
    CommentReplyResponse,
    ChapterCommentsResponse,
    CommentNotification as CommentNotificationSchema,
)

router = APIRouter(prefix="/api/v1", tags=["comments"])


async def _build_comment_response(comment: ChapterComment, db) -> CommentResponse:
    """Build a comment response with all details."""
    authors = await db.execute(
        select(User).where(User.id == comment.author_id)
    )
    author = authors.scalar_one_or_none()
    
    # Get reply count
    replies = await db.execute(
        select(func.count(CommentReply.id)).where(CommentReply.comment_id == comment.id)
    )
    reply_count = replies.scalar() or 0
    
    return CommentResponse(
        id=str(comment.id),
        chapter_id=str(comment.chapter_id),
        author_id=str(comment.author_id),
        author_name=author.full_name if author else "Unknown",
        author_avatar=author.avatar_url if author else None,
        content=comment.content,
        position=comment.position,
        context_text=comment.context_text,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        is_resolved=comment.is_resolved,
        resolved_by=str(comment.resolved_by) if comment.resolved_by else None,
        resolved_at=comment.resolved_at,
        mentions=[],  # TODO: parse mentioned_users
        reply_count=reply_count,
        likes=comment.likes,
    )


@router.post("/chapters/{chapter_id}/comments", response_model=CommentResponse)
async def create_comment(
    chapter_id: uuid.UUID,
    request: CommentCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a comment on a chapter.
    
    Can be:
    - General comment on the chapter
    - Inline comment at a specific position
    - Mention other collaborators with @username
    """
    # Verify chapter exists and user has access
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # TODO: Verify user has access to this chapter (owner or collaborator)

    # Create comment
    comment = ChapterComment(
        id=uuid.uuid4(),
        chapter_id=chapter_id,
        author_id=user_id,
        content=request.content,
        position=request.position,
        context_text=request.context_text,
        mentioned_users=request.mentioned_users,
    )

    db.add(comment)
    await db.flush()

    # Create notifications for mentioned users
    if request.mentioned_users:
        for mentioned_user_id in request.mentioned_users:
            notification = CommentNotification(
                id=uuid.uuid4(),
                user_id=uuid.UUID(mentioned_user_id),
                comment_id=comment.id,
                type="mention",
                trigger_user_id=user_id,
                message=f"You were mentioned in a comment on chapter {chapter.title}",
            )
            db.add(notification)

    await db.flush()

    return await _build_comment_response(comment, db)


@router.get("/chapters/{chapter_id}/comments", response_model=ChapterCommentsResponse)
async def get_chapter_comments(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    resolved_only: bool = Query(False),
):
    """
    Get all comments on a chapter.
    
    Can filter by resolved status.
    """
    # Verify chapter exists
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Get comments
    query = select(ChapterComment).where(ChapterComment.chapter_id == chapter_id)
    if resolved_only:
        query = query.where(ChapterComment.is_resolved == True)
    
    query = query.order_by(ChapterComment.created_at.desc())
    
    comments_result = await db.execute(query)
    comments = comments_result.scalars().all()

    # Get unresolved count
    unresolved_result = await db.execute(
        select(func.count(ChapterComment.id)).where(
            and_(
                ChapterComment.chapter_id == chapter_id,
                ChapterComment.is_resolved == False,
            )
        )
    )
    unresolved_count = unresolved_result.scalar() or 0

    # Build responses
    comment_responses = []
    for comment in comments:
        comment_responses.append(await _build_comment_response(comment, db))

    return ChapterCommentsResponse(
        chapter_id=str(chapter_id),
        total_comments=len(comments),
        unresolved_count=unresolved_count,
        comments=comment_responses,
    )


@router.post("/chapters/{chapter_id}/comments/{comment_id}/reply", response_model=CommentReplyResponse)
async def reply_to_comment(
    chapter_id: uuid.UUID,
    comment_id: uuid.UUID,
    request: CommentReplyCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reply to a comment.
    
    Can mention users and notify them.
    """
    # Verify comment exists
    comment_result = await db.execute(
        select(ChapterComment).where(ChapterComment.id == comment_id)
    )
    comment = comment_result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Create reply
    reply = CommentReply(
        id=uuid.uuid4(),
        comment_id=comment_id,
        author_id=user_id,
        content=request.content,
        mentioned_users=request.mentioned_users,
    )

    db.add(reply)
    await db.flush()

    # Notify original comment author
    if comment.author_id != user_id:
        author_notification = CommentNotification(
            id=uuid.uuid4(),
            user_id=comment.author_id,
            comment_id=comment_id,
            type="reply",
            trigger_user_id=user_id,
            message="Someone replied to your comment",
        )
        db.add(author_notification)

    # Notify mentioned users
    if request.mentioned_users:
        for mentioned_user_id in request.mentioned_users:
            if mentioned_user_id != str(user_id):
                notification = CommentNotification(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(mentioned_user_id),
                    comment_id=comment_id,
                    type="mention",
                    trigger_user_id=user_id,
                    message="You were mentioned in a comment reply",
                )
                db.add(notification)

    await db.flush()

    # Build reply response
    author_result = await db.execute(
        select(User).where(User.id == reply.author_id)
    )
    author = author_result.scalar_one_or_none()

    return CommentReplyResponse(
        id=str(reply.id),
        comment_id=str(reply.comment_id),
        author_id=str(reply.author_id),
        author_name=author.full_name if author else "Unknown",
        author_avatar=author.avatar_url if author else None,
        content=reply.content,
        created_at=reply.created_at,
        updated_at=reply.updated_at,
        mentions=[],
        likes=reply.likes,
    )


@router.patch("/chapters/{chapter_id}/comments/{comment_id}/resolve", response_model=CommentResponse)
async def resolve_comment(
    chapter_id: uuid.UUID,
    comment_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Mark a comment as resolved.
    
    Only the comment author or chapter owner can resolve.
    """
    comment_result = await db.execute(
        select(ChapterComment).where(ChapterComment.id == comment_id)
    )
    comment = comment_result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Verify permission (comment author or chapter owner)
    # TODO: Check actual permissions

    comment.is_resolved = True
    comment.resolved_by = user_id
    comment.resolved_at = datetime.now(timezone.utc)
    await db.flush()

    # Notify comment author if different user
    if comment.author_id != user_id:
        notification = CommentNotification(
            id=uuid.uuid4(),
            user_id=comment.author_id,
            comment_id=comment_id,
            type="resolved",
            trigger_user_id=user_id,
            message="Your comment was resolved",
        )
        db.add(notification)
        await db.flush()

    return await _build_comment_response(comment, db)


@router.get("/notifications", response_model=List[CommentNotificationSchema])
async def get_notifications(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    unread_only: bool = Query(False),
):
    """
    Get comment notifications for the current user.
    
    Can filter by unread status.
    """
    query = select(CommentNotification).where(CommentNotification.user_id == user_id)
    
    if unread_only:
        query = query.where(CommentNotification.is_read == False)
    
    query = query.order_by(CommentNotification.created_at.desc())
    
    notifications_result = await db.execute(query)
    notifications = notifications_result.scalars().all()

    return [
        CommentNotificationSchema(
            id=str(notif.id),
            user_id=str(notif.user_id),
            type=notif.type,
            comment_id=str(notif.comment_id),
            chapter_id="",  # TODO: load chapter_id from comment
            trigger_user_id=str(notif.trigger_user_id),
            trigger_user_name="",  # TODO: load user name
            message=notif.message,
            is_read=notif.is_read,
            created_at=notif.created_at,
        )
        for notif in notifications
    ]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Mark a notification as read.
    """
    notification_result = await db.execute(
        select(CommentNotification).where(
            and_(
                CommentNotification.id == notification_id,
                CommentNotification.user_id == user_id,
            )
        )
    )
    notification = notification_result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    await db.flush()

    return {"message": "Notification marked as read"}
