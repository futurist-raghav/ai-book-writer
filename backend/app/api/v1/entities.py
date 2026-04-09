"""
Entities API Routes (v1)

Endpoints for managing project entities (characters, locations, concepts, etc.).
"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.entity import Entity
from app.models.book import Book
from app.schemas.entity import (
    EntityCreateRequest,
    EntityUpdateRequest,
    EntityResponse,
    EntityListResponse,
    EntityWithChapterReferences,
)

router = APIRouter(prefix="/api/v1/books", tags=["entities"])


@router.get("/{book_id}/entities", response_model=EntityListResponse)
async def list_entities(
    book_id: UUID,
    entity_type: str = Query(None, description="Filter by entity type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityListResponse:
    """
    List all entities for a book.

    Optionally filter by type (character, location, concept, faction, item, theme, custom).
    """
    # Verify book ownership
    book_query = select(Book).where(
        Book.id == book_id,
        Book.user_id == current_user.id,
    )
    result = await db.execute(book_query)
    book = result.scalars().first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Query entities
    query = select(Entity).where(Entity.book_id == book_id)
    if entity_type:
        query = query.where(Entity.type == entity_type)

    result = await db.execute(query)
    entities = result.scalars().all()

    # Count by type
    type_counts = {}
    for entity in entities:
        type_counts[entity.type] = type_counts.get(entity.type, 0) + 1

    response_entities = [EntityResponse.model_validate(e) for e in entities]
    return EntityListResponse(
        entities=response_entities,
        total_count=len(entities),
        by_type=type_counts,
    )


@router.get("/{book_id}/entities/{entity_id}", response_model=EntityResponse)
async def get_entity(
    book_id: UUID,
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityResponse:
    """Get a specific entity by ID."""
    # Verify book ownership
    book_query = select(Book).where(
        Book.id == book_id,
        Book.user_id == current_user.id,
    )
    result = await db.execute(book_query)
    book = result.scalars().first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get entity
    entity_query = select(Entity).where(
        Entity.id == entity_id,
        Entity.book_id == book_id,
    )
    result = await db.execute(entity_query)
    entity = result.scalars().first()

    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )

    return EntityResponse.model_validate(entity)


@router.post("/{book_id}/entities", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def create_entity(
    book_id: UUID,
    request: EntityCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityResponse:
    """Create a new entity for a book."""
    # Verify book ownership
    book_query = select(Book).where(
        Book.id == book_id,
        Book.user_id == current_user.id,
    )
    result = await db.execute(book_query)
    book = result.scalars().first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Create entity
    entity = Entity(
        book_id=book_id,
        name=request.name,
        type=request.type,
        description=request.description,
        metadata=request.metadata or {},
    )

    db.add(entity)
    await db.commit()
    await db.refresh(entity)

    return EntityResponse.model_validate(entity)


@router.patch("/{book_id}/entities/{entity_id}", response_model=EntityResponse)
async def update_entity(
    book_id: UUID,
    entity_id: UUID,
    request: EntityUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityResponse:
    """Update an existing entity."""
    # Verify book ownership
    book_query = select(Book).where(
        Book.id == book_id,
        Book.user_id == current_user.id,
    )
    result = await db.execute(book_query)
    book = result.scalars().first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get entity
    entity_query = select(Entity).where(
        Entity.id == entity_id,
        Entity.book_id == book_id,
    )
    result = await db.execute(entity_query)
    entity = result.scalars().first()

    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )

    # Update fields
    if request.name is not None:
        entity.name = request.name
    if request.description is not None:
        entity.description = request.description
    if request.metadata is not None:
        entity.metadata = request.metadata

    await db.commit()
    await db.refresh(entity)

    return EntityResponse.model_validate(entity)


@router.delete("/{book_id}/entities/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(
    book_id: UUID,
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an entity."""
    # Verify book ownership
    book_query = select(Book).where(
        Book.id == book_id,
        Book.user_id == current_user.id,
    )
    result = await db.execute(book_query)
    book = result.scalars().first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get and delete entity
    entity_query = select(Entity).where(
        Entity.id == entity_id,
        Entity.book_id == book_id,
    )
    result = await db.execute(entity_query)
    entity = result.scalars().first()

    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )

    await db.delete(entity)
    await db.commit()
