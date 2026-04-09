"""
Collaboration API Routes

Handles team collaboration, comments, and activity tracking for books.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, func, select

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
from app.models.collaboration import Activity, ActivityType, BookComment, Collaborator, CollaboratorRole
from app.models.user import User
from app.schemas.collaboration import (
    ActivityListResponse,
    ActivityResponse,
    BookCommentCreate,
    BookCommentListResponse,
    BookCommentResponse,
    BookCommentUpdate,
    CollaboratorInvite,
    CollaboratorListResponse,
    CollaboratorResponse,
    CollaboratorRoleUpdate,
    CollaborationSummaryResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter()


async def _log_activity(
    db: AsyncSessionDep,
    book_id: uuid.UUID,
    actor_id: uuid.UUID,
    activity_type: str,
    title: str,
    description: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Activity:
    """Helper to log activity."""
    activity = Activity(
        id=uuid.uuid4(),
        book_id=book_id,
        actor_id=actor_id,
        activity_type=activity_type,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(activity)
    await db.flush()
    return activity


@router.get(
    "/books/{book_id}/collaboration",
    response_model=CollaborationSummaryResponse,
    summary="Get collaboration summary",
)
async def get_collaboration_summary(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get collaboration overview for a book."""
    # Verify book exists and user has access
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get collaborator counts
    collab_result = await db.execute(
        select(func.count(Collaborator.id)).where(Collaborator.book_id == book_id)
    )
    total_collaborators = collab_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count(Collaborator.id)).where(
            Collaborator.book_id == book_id,
            Collaborator.is_accepted == False,
        )
    )
    pending_invitations = pending_result.scalar() or 0

    active_collab = total_collaborators - pending_invitations

    # Get comment counts
    comment_result = await db.execute(
        select(func.count(BookComment.id)).where(BookComment.book_id == book_id)
    )
    total_comments = comment_result.scalar() or 0

    unresolved_result = await db.execute(
        select(func.count(BookComment.id)).where(
            BookComment.book_id == book_id,
            BookComment.is_resolved == False,
        )
    )
    unresolved_comments = unresolved_result.scalar() or 0

    # Get recent activities
    activities_result = await db.execute(
        select(Activity)
        .where(Activity.book_id == book_id)
        .order_by(desc(Activity.created_at))
        .limit(10)
    )
    recent_activities = [ActivityResponse.model_validate(a) for a in activities_result.scalars().all()]

    return CollaborationSummaryResponse(
        book_id=book_id,
        collaborators_count=total_collaborators,
        pending_invitations=pending_invitations,
        active_collaborators=active_collab,
        unresolved_comments=unresolved_comments,
        total_comments=total_comments,
        recent_activities=recent_activities,
    )


@router.get(
    "/books/{book_id}/collaborators",
    response_model=PaginatedResponse[CollaboratorListResponse],
    summary="List collaborators",
)
async def list_collaborators(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None),
    accepted_only: bool = Query(True),
):
    """List all collaborators for a book."""
    # Verify book exists and user has access
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Build query
    query = select(Collaborator).where(Collaborator.book_id == book_id)

    if accepted_only:
        query = query.where(Collaborator.is_accepted == True)

    if role:
        query = query.where(Collaborator.role == role)

    # Count total
    total_result = await db.execute(
        select(func.count(Collaborator.id)).where(Collaborator.book_id == book_id)
    )
    total = total_result.scalar() or 0

    # Apply pagination and execute
    query = query.order_by(Collaborator.invited_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    collaborators = result.scalars().all()

    # Build responses with user details
    items = []
    for collab in collaborators:
        # Get user details
        user_result = await db.execute(select(User).where(User.id == collab.user_id))
        user = user_result.scalar_one_or_none()

        items.append(
            CollaboratorResponse(
                id=collab.id,
                book_id=collab.book_id,
                user_id=collab.user_id,
                user_email=user.email if user else None,
                user_name=user.username if user else None,
                role=collab.role,
                is_accepted=collab.is_accepted,
                invited_at=collab.invited_at,
                accepted_at=collab.accepted_at,
                created_at=collab.invited_at,
                updated_at=collab.accepted_at or collab.invited_at,
            )
        )

    total_pages = (total + limit - 1) // limit

    return PaginatedResponse(
        data=CollaboratorListResponse(
            data=items,
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        ),
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.post(
    "/books/{book_id}/collaborators/invite",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a collaborator",
)
async def invite_collaborator(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    invite_data: CollaboratorInvite,
):
    """Invite a user as collaborator to the book."""
    # Verify book exists and user is owner
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found or not authorized",
        )

    # Find user by email
    user_result = await db.execute(select(User).where(User.email == invite_data.email))
    invite_user = user_result.scalar_one_or_none()
    if not invite_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if already collaborator
    existing = await db.execute(
        select(Collaborator).where(
            Collaborator.book_id == book_id,
            Collaborator.user_id == invite_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a collaborator",
        )

    # Create collaborator
    collaborator = Collaborator(
        id=uuid.uuid4(),
        book_id=book_id,
        user_id=invite_user.id,
        role=invite_data.role,
        is_accepted=False,
    )
    db.add(collaborator)

    # Log activity
    await _log_activity(
        db,
        book_id,
        user_id,
        ActivityType.COLLABORATOR_ADDED.value,
        f"Invited {invite_user.username} as {invite_data.role}",
        entity_type="collaborator",
        entity_id=str(collaborator.id),
    )

    await db.commit()
    await db.refresh(collaborator)

    return CollaboratorResponse(
        id=collaborator.id,
        book_id=collaborator.book_id,
        user_id=collaborator.user_id,
        user_email=invite_user.email,
        user_name=invite_user.username,
        role=collaborator.role,
        is_accepted=collaborator.is_accepted,
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
        created_at=collaborator.invited_at,
        updated_at=collaborator.accepted_at or collaborator.invited_at,
    )


@router.put(
    "/books/{book_id}/collaborators/{collaborator_id}/role",
    response_model=CollaboratorResponse,
    summary="Update collaborator role",
)
async def update_collaborator_role(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    role_data: CollaboratorRoleUpdate,
):
    """Update a collaborator's role."""
    # Verify book exists and user is owner
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(
            Collaborator.id == collaborator_id,
            Collaborator.book_id == book_id,
        )
    )
    collaborator = collab_result.scalar_one_or_none()
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    old_role = collaborator.role
    collaborator.role = role_data.role

    # Log activity
    await _log_activity(
        db,
        book_id,
        user_id,
        ActivityType.COLLABORATOR_ADDED.value,
        f"Changed role from {old_role} to {role_data.role}",
        entity_type="collaborator",
        entity_id=str(collaborator.id),
    )

    await db.commit()
    await db.refresh(collaborator)

    # Get user details
    user_result = await db.execute(select(User).where(User.id == collaborator.user_id))
    collab_user = user_result.scalar_one_or_none()

    return CollaboratorResponse(
        id=collaborator.id,
        book_id=collaborator.book_id,
        user_id=collaborator.user_id,
        user_email=collab_user.email if collab_user else None,
        user_name=collab_user.username if collab_user else None,
        role=collaborator.role,
        is_accepted=collaborator.is_accepted,
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
        created_at=collaborator.invited_at,
        updated_at=collaborator.accepted_at or collaborator.invited_at,
    )


@router.delete(
    "/books/{book_id}/collaborators/{collaborator_id}",
    response_model=MessageResponse,
    summary="Remove collaborator",
)
async def remove_collaborator(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Remove a collaborator from the book."""
    # Verify book exists and user is owner
    book_result = await db.execute(
        select(Book).where(Book.id == book_id, Book.user_id == user_id)
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(
            Collaborator.id == collaborator_id,
            Collaborator.book_id == book_id,
        )
    )
    collaborator = collab_result.scalar_one_or_none()
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    # Log activity
    user_result = await db.execute(select(User).where(User.id == collaborator.user_id))
    collab_user = user_result.scalar_one_or_none()

    await _log_activity(
        db,
        book_id,
        user_id,
        ActivityType.COLLABORATOR_REMOVED.value,
        f"Removed {collab_user.username if collab_user else 'user'} from project",
        entity_type="collaborator",
        entity_id=str(collaborator.id),
    )

    # Delete
    await db.delete(collaborator)
    await db.commit()

    return MessageResponse(message="Collaborator removed successfully")


@router.get(
    "/books/{book_id}/comments",
    response_model=PaginatedResponse[BookCommentListResponse],
    summary="List comments",
)
async def list_comments(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unresolved_only: bool = Query(False),
    target_type: Optional[str] = Query(None),
):
    """List all comments for a book."""
    # Verify book exists
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Build query
    query = select(BookComment).where(BookComment.book_id == book_id)

    if unresolved_only:
        query = query.where(BookComment.is_resolved == False)

    if target_type:
        query = query.where(BookComment.target_type == target_type)

    # Count total
    total_result = await db.execute(
        select(func.count(BookComment.id)).where(BookComment.book_id == book_id)
    )
    total = total_result.scalar() or 0

    # Apply pagination and execute
    query = query.order_by(BookComment.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    comments = result.scalars().all()

    # Build responses
    items = []
    for comment in comments:
        author = None
        if comment.author_id:
            author_result = await db.execute(select(User).where(User.id == comment.author_id))
            author = author_result.scalar_one_or_none()

        items.append(
            BookCommentResponse(
                id=comment.id,
                book_id=comment.book_id,
                author_id=comment.author_id,
                author_name=author.username if author else None,
                content=comment.content,
                target_type=comment.target_type,
                target_id=comment.target_id,
                is_resolved=comment.is_resolved,
                created_at=comment.created_at,
                resolved_at=comment.resolved_at,
                updated_at=comment.updated_at,
            )
        )

    total_pages = (total + limit - 1) // limit

    return PaginatedResponse(
        data=BookCommentListResponse(
            data=items,
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        ),
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.post(
    "/books/{book_id}/comments",
    response_model=BookCommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a comment",
)
async def create_comment(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    comment_data: BookCommentCreate,
):
    """Create a new comment on a book."""
    # Verify book exists
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Create comment
    comment = BookComment(
        id=uuid.uuid4(),
        book_id=book_id,
        author_id=user_id,
        content=comment_data.content,
        target_type=comment_data.target_type,
        target_id=comment_data.target_id,
    )
    db.add(comment)

    # Log activity
    await _log_activity(
        db,
        book_id,
        user_id,
        ActivityType.COMMENT_ADDED.value,
        f"Added comment on {comment_data.target_type}",
        entity_type="comment",
        entity_id=str(comment.id),
    )

    await db.commit()
    await db.refresh(comment)

    # Get author details
    author_result = await db.execute(select(User).where(User.id == user_id))
    author = author_result.scalar_one_or_none()

    return BookCommentResponse(
        id=comment.id,
        book_id=comment.book_id,
        author_id=comment.author_id,
        author_name=author.username if author else None,
        content=comment.content,
        target_type=comment.target_type,
        target_id=comment.target_id,
        is_resolved=comment.is_resolved,
        created_at=comment.created_at,
        resolved_at=comment.resolved_at,
        updated_at=comment.updated_at,
    )


@router.put(
    "/books/{book_id}/comments/{comment_id}",
    response_model=BookCommentResponse,
    summary="Update comment",
)
async def update_comment(
    book_id: uuid.UUID,
    comment_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    comment_data: BookCommentUpdate,
):
    """Update a comment."""
    # Get comment
    comment_result = await db.execute(
        select(BookComment).where(
            BookComment.id == comment_id,
            BookComment.book_id == book_id,
        )
    )
    comment = comment_result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Only author or book owner can update
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()

    if comment.author_id != user_id and book.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this comment",
        )

    # Update fields
    if comment_data.content is not None:
        comment.content = comment_data.content

    if comment_data.is_resolved is not None:
        old_resolved = comment.is_resolved
        comment.is_resolved = comment_data.is_resolved
        if comment_data.is_resolved and not old_resolved:
            comment.resolved_at = datetime.now(timezone.utc)

            # Log activity
            await _log_activity(
                db,
                book_id,
                user_id,
                ActivityType.COMMENT_RESOLVED.value,
                "Resolved comment",
                entity_type="comment",
                entity_id=str(comment.id),
            )

    comment.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)

    # Get author details
    author_result = await db.execute(select(User).where(User.id == comment.author_id))
    author = author_result.scalar_one_or_none()

    return BookCommentResponse(
        id=comment.id,
        book_id=comment.book_id,
        author_id=comment.author_id,
        author_name=author.username if author else None,
        content=comment.content,
        target_type=comment.target_type,
        target_id=comment.target_id,
        is_resolved=comment.is_resolved,
        created_at=comment.created_at,
        resolved_at=comment.resolved_at,
        updated_at=comment.updated_at,
    )


@router.delete(
    "/books/{book_id}/comments/{comment_id}",
    response_model=MessageResponse,
    summary="Delete comment",
)
async def delete_comment(
    book_id: uuid.UUID,
    comment_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Delete a comment."""
    # Get comment
    comment_result = await db.execute(
        select(BookComment).where(
            BookComment.id == comment_id,
            BookComment.book_id == book_id,
        )
    )
    comment = comment_result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Only author or book owner can delete
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()

    if comment.author_id != user_id and book.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment",
        )

    # Delete
    await db.delete(comment)
    await db.commit()

    return MessageResponse(message="Comment deleted successfully")


@router.get(
    "/books/{book_id}/activities",
    response_model=PaginatedResponse[ActivityListResponse],
    summary="List activities",
)
async def list_activities(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    activity_type: Optional[str] = Query(None),
):
    """List activity log for a book."""
    # Verify book exists
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Build query
    query = select(Activity).where(Activity.book_id == book_id)

    if activity_type:
        query = query.where(Activity.activity_type == activity_type)

    # Count total
    total_result = await db.execute(
        select(func.count(Activity.id)).where(Activity.book_id == book_id)
    )
    total = total_result.scalar() or 0

    # Apply pagination and execute
    query = query.order_by(Activity.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    activities = result.scalars().all()

    # Build responses
    items = []
    for activity in activities:
        actor = None
        if activity.actor_id:
            actor_result = await db.execute(select(User).where(User.id == activity.actor_id))
            actor = actor_result.scalar_one_or_none()

        items.append(
            ActivityResponse(
                id=activity.id,
                book_id=activity.book_id,
                actor_id=activity.actor_id,
                actor_name=actor.username if actor else None,
                activity_type=activity.activity_type,
                title=activity.title,
                description=activity.description,
                entity_type=activity.entity_type,
                entity_id=activity.entity_id,
                created_at=activity.created_at,
            )
        )

    total_pages = (total + limit - 1) // limit

    return PaginatedResponse(
        data=ActivityListResponse(
            data=items,
            total=total,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        ),
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )
