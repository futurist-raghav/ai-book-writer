"""
Collaborator Management API Routes

Handles inviting collaborators, managing roles, and enforcing permissions.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
from app.models.collaboration import Collaborator, CollaboratorRole
from app.models.user import User
from app.schemas.collaborator import (
    CollaboratorInvite,
    CollaboratorUpdate,
    CollaboratorResponse,
    BookCollaboratorsResponse,
    CollaboratorInviteResponse,
)

router = APIRouter(prefix="/api/v1", tags=["collaborators"])


async def _build_collaborator_response(collaborator: Collaborator, db) -> CollaboratorResponse:
    """Build a collaborator response with user details."""
    user_result = await db.execute(
        select(User).where(User.id == collaborator.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    section_ids = None
    if collaborator.section_ids:
        section_ids = collaborator.section_ids.split(",")
    
    return CollaboratorResponse(
        id=str(collaborator.id),
        book_id=str(collaborator.book_id),
        user_id=str(collaborator.user_id),
        user_name=user.full_name if user else "Unknown",
        user_email=user.email if user else "unknown@example.com",
        user_avatar=user.avatar_url if user else None,
        role=collaborator.role,
        section_ids=section_ids,
        status=collaborator.status,
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
        rejected_at=collaborator.rejected_at,
        removed_at=collaborator.removed_at,
        created_at=collaborator.created_at,
        updated_at=collaborator.updated_at,
    )


@router.get("/books/{book_id}/collaborators", response_model=BookCollaboratorsResponse)
async def list_collaborators(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get all collaborators for a book.
    
    Only book owner and active collaborators can view this list.
    """
    # Verify book exists and user has access
    book_result = await db.execute(
        select(Book).where(Book.id == book_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Verify user is owner or collaborator
    is_owner = book.author_id == user_id
    collaborator_result = await db.execute(
        select(Collaborator).where(
            and_(
                Collaborator.book_id == book_id,
                Collaborator.user_id == user_id,
                Collaborator.status == "active",
            )
        )
    )
    is_collaborator = collaborator_result.scalar_one_or_none() is not None

    if not is_owner and not is_collaborator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view collaborators",
        )

    # Get all collaborators
    query = select(Collaborator).where(Collaborator.book_id == book_id)
    result = await db.execute(query)
    collaborators = result.scalars().all()

    # Build responses
    collab_responses = []
    for collab in collaborators:
        collab_responses.append(await _build_collaborator_response(collab, db))

    return BookCollaboratorsResponse(
        book_id=str(book_id),
        total_collaborators=len(collaborators),
        collaborators=collab_responses,
    )


@router.post("/books/{book_id}/collaborators/invite", response_model=CollaboratorInviteResponse)
async def invite_collaborator(
    book_id: uuid.UUID,
    request: CollaboratorInvite,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Invite a new collaborator to a book.
    
    Only book owner can invite collaborators.
    Sends email with invitation link.
    """
    # Verify book exists
    book_result = await db.execute(
        select(Book).where(Book.id == book_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Verify user is owner
    if book.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only book owner can invite collaborators",
        )

    # Check if user with email exists
    user_result = await db.execute(
        select(User).where(User.email == request.email)
    )
    invited_user = user_result.scalar_one_or_none()

    if not invited_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {request.email} not found. They must create an account first.",
        )

    # Check if already a collaborator
    existing_result = await db.execute(
        select(Collaborator).where(
            and_(
                Collaborator.book_id == book_id,
                Collaborator.user_id == invited_user.id,
            )
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator on this book",
        )

    # Create invitation
    section_ids = None
    if request.section_ids:
        section_ids = ",".join(request.section_ids)

    collaborator = Collaborator(
        id=uuid.uuid4(),
        book_id=book_id,
        user_id=invited_user.id,
        role=request.role,
        section_ids=section_ids,
        status="invited",
        invited_at=datetime.now(timezone.utc),
    )

    db.add(collaborator)
    await db.flush()

    # TODO: Send invitation email

    return CollaboratorInviteResponse(
        id=str(collaborator.id),
        book_id=str(collaborator.book_id),
        email=invited_user.email,
        role=collaborator.role,
        status=collaborator.status,
        created_at=collaborator.created_at,
    )


@router.patch("/books/{book_id}/collaborators/{collaborator_id}", response_model=CollaboratorResponse)
async def update_collaborator(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    request: CollaboratorUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update a collaborator's role and permissions.
    
    Only book owner can update collaborators.
    """
    # Verify book exists
    book_result = await db.execute(
        select(Book).where(Book.id == book_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Verify user is owner
    if book.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only book owner can update collaborators",
        )

    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(Collaborator.id == collaborator_id)
    )
    collaborator = collab_result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    # Verify collaborator belongs to book
    if collaborator.book_id != book_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Collaborator does not belong to this book",
        )

    # Update role if provided
    if request.role:
        collaborator.role = request.role

    # Update section permissions if provided
    if request.section_ids is not None:
        if request.section_ids:
            collaborator.section_ids = ",".join(request.section_ids)
        else:
            collaborator.section_ids = None

    collaborator.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return await _build_collaborator_response(collaborator, db)


@router.post("/books/{book_id}/collaborators/{collaborator_id}/accept")
async def accept_invitation(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Accept a collaboration invitation.
    
    User must be the one invited.
    """
    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(Collaborator.id == collaborator_id)
    )
    collaborator = collab_result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Verify user is invitee
    if collaborator.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot accept invitations for other users",
        )

    # Verify invitation is pending
    if collaborator.status != "invited":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation status is {collaborator.status}, cannot accept",
        )

    # Accept invitation
    collaborator.status = "active"
    collaborator.accepted_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "message": "Invitation accepted",
        "status": "active",
    }


@router.post("/books/{book_id}/collaborators/{collaborator_id}/reject")
async def reject_invitation(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reject a collaboration invitation.
    
    User must be the one invited.
    """
    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(Collaborator.id == collaborator_id)
    )
    collaborator = collab_result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Verify user is invitee
    if collaborator.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot reject invitations for other users",
        )

    # Verify invitation is pending
    if collaborator.status != "invited":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation status is {collaborator.status}, cannot reject",
        )

    # Reject invitation
    collaborator.status = "rejected"
    collaborator.rejected_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "message": "Invitation rejected",
        "status": "rejected",
    }


@router.delete("/books/{book_id}/collaborators/{collaborator_id}")
async def remove_collaborator(
    book_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Remove a collaborator from a book.
    
    Only book owner can remove collaborators.
    """
    # Verify book exists
    book_result = await db.execute(
        select(Book).where(Book.id == book_id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Verify user is owner
    if book.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only book owner can remove collaborators",
        )

    # Get collaborator
    collab_result = await db.execute(
        select(Collaborator).where(Collaborator.id == collaborator_id)
    )
    collaborator = collab_result.scalar_one_or_none()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    # Remove collaborator
    collaborator.status = "removed"
    collaborator.removed_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "message": "Collaborator removed",
        "status": "removed",
    }
