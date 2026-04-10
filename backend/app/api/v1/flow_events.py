"""
Flow Engine API Routes

Handles flow events, timeline management, and dependency tracking.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.flow_engine import FlowChapterEvent, FlowDependency, FlowEvent
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.flow_event import (
    DependencyGraphResponse,
    DependencyGraphNode,
    FlowChapterEventLink,
    FlowDependencyCreate,
    FlowDependencyResponse,
    FlowDependencyTypeEnum,
    FlowEventCreate,
    FlowEventDetailResponse,
    FlowEventResponse,
    FlowEventStatusEnum,
    FlowEventTypeEnum,
    FlowEventUpdate,
    TimelineEventResponse,
    TimelineResponse,
)

router = APIRouter()


# Helper functions
async def _get_book(book_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSessionDep) -> Book:
    """Get book and verify ownership."""
    result = await session.execute(
        select(Book).where(
            and_(Book.id == book_id, Book.user_id == user_id)
        )
    )
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


async def _get_flow_event(event_id: uuid.UUID, book_id: uuid.UUID, session: AsyncSessionDep) -> FlowEvent:
    """Get flow event and verify it belongs to the book."""
    result = await session.execute(
        select(FlowEvent).where(
            and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id)
        ).options(
            selectinload(FlowEvent.dependencies_from),
            selectinload(FlowEvent.dependencies_to),
            selectinload(FlowEvent.chapter_associations),
        )
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow event not found")
    return event


# CRUD Endpoints for Flow Events


@router.post(
    "/books/{book_id}/flow-events",
    response_model=FlowEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new flow event"
)
async def create_flow_event(
    book_id: uuid.UUID,
    event_data: FlowEventCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Create a new flow event for a book."""
    await _get_book(book_id, user_id, db)
    
    flow_event = FlowEvent(
        id=uuid.uuid4(),
        book_id=book_id,
        **event_data.model_dump(),
    )
    
    db.add(flow_event)
    await db.commit()
    await db.refresh(flow_event)
    
    return flow_event


@router.get(
    "/books/{book_id}/flow-events",
    response_model=PaginatedResponse[FlowEventResponse],
    summary="List all flow events for a book"
)
async def list_flow_events(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    event_type: Optional[FlowEventTypeEnum] = None,
    status_filter: Optional[FlowEventStatusEnum] = Query(None, alias="status"),
):
    """List all flow events for a book, with optional filtering."""
    await _get_book(book_id, user_id, db)
    
    query = select(FlowEvent).where(FlowEvent.book_id == book_id)
    
    if event_type:
        query = query.where(FlowEvent.event_type == event_type)
    if status_filter:
        query = query.where(FlowEvent.status == status_filter)
    
    # Get total count
    count_result = await db.execute(select(func.count()).select_from(FlowEvent).where(FlowEvent.book_id == book_id))
    total = count_result.scalars().first() or 0
    
    # Get paginated results
    query = query.order_by(asc(FlowEvent.timeline_position), asc(FlowEvent.order_index))
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return PaginatedResponse(
        data=events,
        total=total,
        page=page,
        limit=limit
    )


@router.get(
    "/books/{book_id}/flow-events/{event_id}",
    response_model=FlowEventDetailResponse,
    summary="Get a specific flow event with dependencies"
)
async def get_flow_event(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get a specific flow event with all its dependencies."""
    await _get_book(book_id, user_id, db)
    event = await _get_flow_event(event_id, book_id, db)
    return event


@router.patch(
    "/books/{book_id}/flow-events/{event_id}",
    response_model=FlowEventResponse,
    summary="Update a flow event"
)
async def update_flow_event(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    event_data: FlowEventUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Update a flow event."""
    await _get_book(book_id, user_id, db)
    event = await _get_flow_event(event_id, book_id, db)
    
    # Update only provided fields
    update_data = event_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    
    await db.commit()
    await db.refresh(event)
    return event


@router.delete(
    "/books/{book_id}/flow-events/{event_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a flow event"
)
async def delete_flow_event(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Delete a flow event (cascades to dependencies and chapter associations)."""
    await _get_book(book_id, user_id, db)
    event = await _get_flow_event(event_id, book_id, db)
    
    await db.delete(event)
    await db.commit()
    
    return MessageResponse(message="Flow event deleted successfully")


# Dependency Management Endpoints


@router.post(
    "/books/{book_id}/flow-events/{event_id}/dependencies",
    response_model=FlowDependencyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a dependency"
)
async def add_dependency(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    dep_data: FlowDependencyCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Add a dependency between two flow events."""
    await _get_book(book_id, user_id, db)
    
    # Verify both events exist in the book
    from_event = await _get_flow_event(event_id, book_id, db)
    to_event = await _get_flow_event(dep_data.to_event_id, book_id, db)
    
    # Check if dependency already exists
    existing = await db.execute(
        select(FlowDependency).where(
            and_(
                FlowDependency.from_event_id == event_id,
                FlowDependency.to_event_id == dep_data.to_event_id
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dependency already exists"
        )
    
    dependency = FlowDependency(
        id=uuid.uuid4(),
        from_event_id=event_id,
        to_event_id=dep_data.to_event_id,
        dependency_type=dep_data.dependency_type,
        metadata=dep_data.metadata or {},
    )
    
    db.add(dependency)
    await db.commit()
    await db.refresh(dependency)
    
    return dependency


@router.get(
    "/books/{book_id}/flow-events/{event_id}/dependencies",
    response_model=List[FlowDependencyResponse],
    summary="Get dependencies for a flow event"
)
async def get_event_dependencies(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get all dependencies for a specific flow event."""
    await _get_book(book_id, user_id, db)
    event = await _get_flow_event(event_id, book_id, db)
    
    # Combine incoming and outgoing dependencies
    return event.dependencies_from + event.dependencies_to


@router.delete(
    "/books/{book_id}/flow-events/{event_id}/dependencies/{target_event_id}",
    response_model=MessageResponse,
    summary="Remove a dependency"
)
async def remove_dependency(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    target_event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Remove a dependency between two flow events."""
    await _get_book(book_id, user_id, db)
    await _get_flow_event(event_id, book_id, db)
    await _get_flow_event(target_event_id, book_id, db)
    
    # Try to find dependency in either direction
    dependency = await db.execute(
        select(FlowDependency).where(
            or_(
                and_(FlowDependency.from_event_id == event_id, FlowDependency.to_event_id == target_event_id),
                and_(FlowDependency.from_event_id == target_event_id, FlowDependency.to_event_id == event_id)
            )
        )
    )
    dep = dependency.scalars().first()
    
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dependency not found")
    
    await db.delete(dep)
    await db.commit()
    
    return MessageResponse(message="Dependency removed successfully")


# Timeline & Graph Query Endpoints


@router.get(
    "/books/{book_id}/timeline",
    response_model=TimelineResponse,
    summary="Get timeline view of all events"
)
async def get_timeline(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get timeline view with all events sorted by position."""
    await _get_book(book_id, user_id, db)
    
    # Get all events ordered by timeline position
    result = await db.execute(
        select(FlowEvent)
        .where(FlowEvent.book_id == book_id)
        .options(
            selectinload(FlowEvent.dependencies_from),
            selectinload(FlowEvent.dependencies_to)
        )
        .order_by(asc(FlowEvent.timeline_position), asc(FlowEvent.order_index))
    )
    events = result.scalars().all()
    
    # Convert to timeline response format
    timeline_events = []
    for event in events:
        blocked_by = len(event.dependencies_to)  # Events blocking this one
        blocks = len(event.dependencies_from)     # Events this one blocks
        
        timeline_events.append(TimelineEventResponse(
            id=event.id,
            title=event.title,
            event_type=event.event_type,
            status=event.status,
            timeline_position=event.timeline_position,
            duration=event.duration,
            has_dependencies=bool(event.dependencies_from or event.dependencies_to),
            blocked_by_count=blocked_by,
            blocks_count=blocks,
        ))
    
    return TimelineResponse(
        book_id=book_id,
        events=timeline_events,
        total_events=len(events)
    )


@router.get(
    "/books/{book_id}/dependencies",
    response_model=DependencyGraphResponse,
    summary="Get full dependency graph"
)
async def get_dependency_graph(
    book_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Get the complete dependency graph for a book."""
    await _get_book(book_id, user_id, db)
    
    # Get all events with dependencies
    result = await db.execute(
        select(FlowEvent)
        .where(FlowEvent.book_id == book_id)
        .options(
            selectinload(FlowEvent.dependencies_from),
            selectinload(FlowEvent.dependencies_to)
        )
    )
    events = result.scalars().all()
    
    # Build graph nodes
    nodes = []
    for event in events:
        # Get all events this one depends on (blocked by or triggered by)
        dependent_ids = [dep.to_event_id for dep in event.dependencies_to]
        
        nodes.append(DependencyGraphNode(
            id=event.id,
            title=event.title,
            event_type=event.event_type,
            status=event.status,
            dependencies=dependent_ids,
        ))
    
    # TODO: Implement cycle detection
    has_cycles = False
    
    return DependencyGraphResponse(
        book_id=book_id,
        nodes=nodes,
        has_cycles=has_cycles,
    )


# Chapter Association Endpoints


@router.post(
    "/books/{book_id}/flow-events/{event_id}/chapters",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Link chapter to flow event"
)
async def link_chapter_to_event(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    link_data: FlowChapterEventLink,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Link a chapter to a flow event."""
    await _get_book(book_id, user_id, db)
    await _get_flow_event(event_id, book_id, db)
    
    # Verify chapter exists and belongs to book
    chapter_result = await db.execute(
        select(Chapter).where(
            and_(Chapter.id == link_data.chapter_id, Chapter.book_id == book_id)
        )
    )
    if not chapter_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    
    # Check if association already exists
    existing = await db.execute(
        select(FlowChapterEvent).where(
            and_(
                FlowChapterEvent.chapter_id == link_data.chapter_id,
                FlowChapterEvent.event_id == event_id
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter is already linked to this event"
        )
    
    association = FlowChapterEvent(
        chapter_id=link_data.chapter_id,
        event_id=event_id,
        order_index=link_data.order_index,
    )
    
    db.add(association)
    await db.commit()
    
    return MessageResponse(message="Chapter linked to flow event successfully")


@router.delete(
    "/books/{book_id}/flow-events/{event_id}/chapters/{chapter_id}",
    response_model=MessageResponse,
    summary="Unlink chapter from flow event"
)
async def unlink_chapter_from_event(
    book_id: uuid.UUID,
    event_id: uuid.UUID,
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """Unlink a chapter from a flow event."""
    await _get_book(book_id, user_id, db)
    await _get_flow_event(event_id, book_id, db)
    
    association = await db.execute(
        select(FlowChapterEvent).where(
            and_(
                FlowChapterEvent.chapter_id == chapter_id,
                FlowChapterEvent.event_id == event_id
            )
        )
    )
    assoc = association.scalars().first()
    
    if not assoc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter association not found")
    
    await db.delete(assoc)
    await db.commit()
    
    return MessageResponse(message="Chapter unlinked from flow event successfully")
