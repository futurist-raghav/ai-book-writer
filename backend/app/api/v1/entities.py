"""
Entities API Routes (v1)

Endpoints for managing project entities (characters, locations, concepts, etc.).
"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.entity import Entity, EntityReference
from app.models.book import Book
from app.models.chapter import Chapter
from app.schemas.entity import (
    EntityCreateRequest,
    EntityUpdateRequest,
    EntityResponse,
    EntityListResponse,
    EntityWithChapterReferences,
    EntityChaptersResponse,
    ChapterReferenceResponse,
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
        entity_metadata=request.metadata or {},
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
        entity.entity_metadata = request.metadata

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


@router.get("/{book_id}/entities/{entity_id}/chapters", response_model=EntityChaptersResponse)
async def get_entity_chapters(
    book_id: UUID,
    entity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityChaptersResponse:
    """
    Get all chapters where an entity appears with mention counts and context.
    
    Returns the entity with a list of chapters that mention it, including:
    - Mention count (how many times mentioned in that chapter)
    - Context snippet (text sample showing the entity)
    - Extraction metadata (confidence, tags, etc.)
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

    # Get all chapter references for this entity
    references_query = (
        select(
            EntityReference,
            Chapter.id,
            Chapter.title,
            Chapter.chapter_number,
        )
        .join(Chapter, EntityReference.chapter_id == Chapter.id)
        .where(EntityReference.entity_id == entity_id)
        .order_by(Chapter.chapter_number.asc())
    )
    result = await db.execute(references_query)
    rows = result.all()

    # Build chapter references list
    chapters = []
    total_mentions = 0
    for ref, chapter_id, chapter_title, chapter_number in rows:
        total_mentions += ref.mention_count
        chapters.append(
            ChapterReferenceResponse(
                chapter_id=chapter_id,
                chapter_title=chapter_title,
                chapter_number=chapter_number,
                mention_count=ref.mention_count,
                context_snippet=ref.context_snippet,
                extraction_metadata=ref.extraction_metadata,
            )
        )

    return EntityChaptersResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        entity_type=entity.type,
        total_mentions=total_mentions,
        chapters=chapters,
    )
