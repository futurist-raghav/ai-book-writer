"""
Flow Engine API Routes

Endpoints for managing timeline events, dependencies, and chapter-event linking.
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models import Book, FlowEvent, FlowDependency, FlowChapterEvent, User, Chapter
from app.schemas.flow_engine import (
    FlowEventCreateRequest,
    FlowEventUpdateRequest,
    FlowEventResponse,
    FlowEventDetailResponse,
    FlowEventListResponse,
    FlowDependencyCreateRequest,
    FlowDependencyResponse,
    FlowTimelineResponse,
    FlowTimelineEventResponse,
    FlowChapterEventRequest,
    FlowChapterEventResponse,
)

router = APIRouter(prefix="/books/{book_id}/events", tags=["flow-engine"])


@router.get(
    "",
    response_model=FlowEventListResponse,
    summary="List flow events for a book",
    description="Get paginated list of flow events with optional filtering by type, status, or timeline range.",
)
async def list_flow_events(
    book_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = Query("timeline_position", pattern="^(timeline_position|created_at|title)$"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowEventListResponse:
    """
    Get all flow events for a book.

    Query Parameters:
    - page: Page number (1-indexed)
    - limit: Results per page (1-100, default 10)
    - event_type: Filter by event type (scene, beat, milestone, act, chapter, subplot, branch, custom)
    - status: Filter by status (planned, in_progress, completed, blocked)
    - sort_by: Sort field (timeline_position, created_at, title)
    - sort_order: Sort direction (asc, desc)
    """

    # Check book ownership/access
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Build query
    query = select(FlowEvent).where(FlowEvent.book_id == book_id)

    if event_type:
        query = query.where(FlowEvent.event_type == event_type)
    if status:
        query = query.where(FlowEvent.status == status)

    # Sorting
    sort_col = getattr(FlowEvent, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col)

    # Pagination
    total = await db.scalar(select(func.count(FlowEvent.id)).where(FlowEvent.book_id == book_id))
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    events = await db.scalars(query)
    has_more = (offset + limit) < total

    return FlowEventListResponse(
        events=[FlowEventResponse.model_validate(evt) for evt in events],
        total_count=total,
        page=page,
        limit=limit,
        has_more=has_more,
    )


@router.get(
    "/timeline",
    response_model=FlowTimelineResponse,
    summary="Get timeline view of events",
    description="Get all events in chronological order with dependency information for Gantt visualization.",
)
async def get_timeline(
    book_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowTimelineResponse:
    """
    Get timeline view of all events in a book.

    Returns events sorted by timeline_position with:
    - parent_event_ids: Events that must complete before this one
    - blocking_event_ids: Events blocked by this one
    """

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get all events ordered by timeline position
    events_stmt = (
        select(FlowEvent)
        .where(FlowEvent.book_id == book_id)
        .order_by(FlowEvent.timeline_position)
    )
    events = await db.scalars(events_stmt)

    # Build timeline response with dependencies
    timeline_events = []
    for event in events:
        # Get parent events (events that must complete first)
        parent_stmt = select(FlowDependency.from_event_id).where(
            FlowDependency.to_event_id == event.id
        )
        parents = await db.scalars(parent_stmt)

        # Get blocking events (events blocked by this one)
        blocking_stmt = select(FlowDependency.to_event_id).where(
            FlowDependency.from_event_id == event.id
        )
        blocking = await db.scalars(blocking_stmt)

        # Count chapters for this event
        chapter_count_stmt = select(func.count(FlowChapterEvent.chapter_id)).where(
            FlowChapterEvent.event_id == event.id
        )
        chapter_count = await db.scalar(chapter_count_stmt) or 0

        timeline_events.append(
            FlowTimelineEventResponse(
                id=event.id,
                title=event.title,
                event_type=event.event_type,
                timeline_position=event.timeline_position,
                duration=event.duration,
                status=event.status,
                order_index=event.order_index,
                chapter_count=chapter_count,
                parent_event_ids=list(parents),
                blocking_event_ids=list(blocking),
            )
        )

    # Calculate timeline range
    positions = [evt.timeline_position for evt in timeline_events]
    timeline_range = {
        "start_position": min(positions) if positions else 0,
        "end_position": max(positions) if positions else 1000,
    }

    return FlowTimelineResponse(
        book_id=book_id,
        total_events=len(timeline_events),
        timeline_range=timeline_range,
        events=timeline_events,
    )


@router.get(
    "/{event_id}",
    response_model=FlowEventDetailResponse,
    summary="Get flow event details",
    description="Get a specific flow event with all dependencies and linked chapters.",
)
async def get_flow_event(
    book_id: UUID,
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowEventDetailResponse:
    """Get a single flow event with all relationships."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get event with relationships loaded
    stmt = (
        select(FlowEvent)
        .where(and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id))
        .options(
            selectinload(FlowEvent.dependencies_from),
            selectinload(FlowEvent.dependencies_to),
        )
    )
    event = await db.scalar(stmt)

    if not event:
        raise HTTPException(status_code=404, detail="Flow event not found")

    # Count chapters
    chapter_count_stmt = select(func.count(FlowChapterEvent.chapter_id)).where(
        FlowChapterEvent.event_id == event_id
    )
    chapter_count = await db.scalar(chapter_count_stmt) or 0

    response = FlowEventDetailResponse.model_validate(event)
    response.chapter_count = chapter_count
    response.dependencies_from = [
        FlowDependencyResponse.model_validate(dep) for dep in event.dependencies_from
    ]
    response.dependencies_to = [
        FlowDependencyResponse.model_validate(dep) for dep in event.dependencies_to
    ]

    return response


@router.post(
    "",
    response_model=FlowEventResponse,
    status_code=201,
    summary="Create a new flow event",
    description="Create a new timeline event in a book.",
)
async def create_flow_event(
    book_id: UUID,
    request: FlowEventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowEventResponse:
    """Create a new flow event."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Create event
    event = FlowEvent(
        book_id=book_id,
        title=request.title,
        description=request.description,
        event_type=request.event_type,
        timeline_position=request.timeline_position,
        duration=request.duration,
        status=request.status,
        event_event_dependency_metadata=request.metadata or {},
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    return FlowEventResponse.model_validate(event)


@router.patch(
    "/{event_id}",
    response_model=FlowEventResponse,
    summary="Update a flow event",
    description="Update an existing flow event.",
)
async def update_flow_event(
    book_id: UUID,
    event_id: UUID,
    request: FlowEventUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowEventResponse:
    """Update a flow event."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get event
    stmt = select(FlowEvent).where(and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id))
    event = await db.scalar(stmt)

    if not event:
        raise HTTPException(status_code=404, detail="Flow event not found")

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    db.add(event)
    await db.commit()
    await db.refresh(event)

    return FlowEventResponse.model_validate(event)


@router.delete(
    "/{event_id}",
    status_code=204,
    summary="Delete a flow event",
    description="Delete a flow event and all related dependencies and chapter links.",
)
async def delete_flow_event(
    book_id: UUID,
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """Delete a flow event."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get event
    stmt = select(FlowEvent).where(and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id))
    event = await db.scalar(stmt)

    if not event:
        raise HTTPException(status_code=404, detail="Flow event not found")

    await db.delete(event)
    await db.commit()


# Dependency endpoints
@router.post(
    "/{event_id}/dependencies",
    response_model=FlowDependencyResponse,
    status_code=201,
    summary="Create event dependency",
    description="Create a dependency between two events. The {event_id} is the source event.",
)
async def create_dependency(
    book_id: UUID,
    event_id: UUID,
    request: FlowDependencyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowDependencyResponse:
    """
    Create a dependency where event_id blocks/triggers/precedes to_event_id.

    Prevents circular dependencies (from_event_id != to_event_id).
    """

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Validate both events exist and belong to book
    from_event_stmt = select(FlowEvent).where(
        and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id)
    )
    from_event = await db.scalar(from_event_stmt)
    if not from_event:
        raise HTTPException(status_code=404, detail="Source event not found")

    to_event_stmt = select(FlowEvent).where(
        and_(FlowEvent.id == request.to_event_id, FlowEvent.book_id == book_id)
    )
    to_event = await db.scalar(to_event_stmt)
    if not to_event:
        raise HTTPException(status_code=404, detail="Target event not found")

    # Prevent self-dependency
    if event_id == request.to_event_id:
        raise HTTPException(status_code=400, detail="Cannot create self-dependency")

    # Check for existing dependency
    existing = await db.scalar(
        select(FlowDependency).where(
            and_(
                FlowDependency.from_event_id == event_id,
                FlowDependency.to_event_id == request.to_event_id,
            )
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Dependency already exists")

    # Create dependency
    dependency = FlowDependency(
        from_event_id=event_id,
        to_event_id=request.to_event_id,
        dependency_type=request.dependency_type,
        event_event_dependency_metadata=request.metadata or {},
    )

    db.add(dependency)
    await db.commit()
    await db.refresh(dependency)

    return FlowDependencyResponse.model_validate(dependency)


@router.get(
    "/{event_id}/dependencies",
    response_model=dict,
    summary="Get event dependencies",
    description="Get all dependencies for an event (both incoming and outgoing).",
)
async def get_dependencies(
    book_id: UUID,
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """Get all dependencies for an event."""

    # Check book ownership and event exists
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    event_stmt = select(FlowEvent).where(
        and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id)
    )
    event = await db.scalar(event_stmt)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get dependencies
    from_deps_stmt = select(FlowDependency).where(FlowDependency.from_event_id == event_id)
    to_deps_stmt = select(FlowDependency).where(FlowDependency.to_event_id == event_id)

    from_deps = await db.scalars(from_deps_stmt)
    to_deps = await db.scalars(to_deps_stmt)

    return {
        "outgoing": [FlowDependencyResponse.model_validate(dep) for dep in from_deps],
        "incoming": [FlowDependencyResponse.model_validate(dep) for dep in to_deps],
    }


@router.delete(
    "/{event_id}/dependencies/{to_event_id}",
    status_code=204,
    summary="Delete event dependency",
    description="Delete a dependency between two events.",
)
async def delete_dependency(
    book_id: UUID,
    event_id: UUID,
    to_event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """Delete a dependency."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get dependency
    dep_stmt = select(FlowDependency).where(
        and_(
            FlowDependency.from_event_id == event_id,
            FlowDependency.to_event_id == to_event_id,
        )
    )
    dependency = await db.scalar(dep_stmt)

    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")

    await db.delete(dependency)
    await db.commit()


# Chapter-Event linking endpoints
@router.post(
    "/{event_id}/chapters",
    response_model=FlowChapterEventResponse,
    status_code=201,
    summary="Link chapter to event",
    description="Associate a chapter with a flow event.",
)
async def link_chapter_to_event(
    book_id: UUID,
    event_id: UUID,
    request: FlowChapterEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> FlowChapterEventResponse:
    """Link a chapter to a flow event."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Verify event exists
    event_stmt = select(FlowEvent).where(
        and_(FlowEvent.id == event_id, FlowEvent.book_id == book_id)
    )
    event = await db.scalar(event_stmt)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify chapter exists (can be in any book actually, but good to check)
    chapter_stmt = select(Chapter).where(Chapter.id == request.chapter_id)
    chapter = await db.scalar(chapter_stmt)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Check for existing link
    existing = await db.scalar(
        select(FlowChapterEvent).where(
            and_(
                FlowChapterEvent.chapter_id == request.chapter_id,
                FlowChapterEvent.event_id == event_id,
            )
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Chapter already linked to this event")

    # Create link
    link = FlowChapterEvent(
        chapter_id=request.chapter_id,
        event_id=event_id,
        order_index=request.order_index,
    )

    db.add(link)
    await db.commit()
    await db.refresh(link)

    return FlowChapterEventResponse.model_validate(link)


@router.delete(
    "/{event_id}/chapters/{chapter_id}",
    status_code=204,
    summary="Unlink chapter from event",
    description="Remove association between a chapter and event.",
)
async def unlink_chapter_from_event(
    book_id: UUID,
    event_id: UUID,
    chapter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """Unlink a chapter from a flow event."""

    # Check book ownership
    book_stmt = select(Book).where(Book.id == book_id)
    book = await db.scalar(book_stmt)
    if not book or book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this book")

    # Get link
    link_stmt = select(FlowChapterEvent).where(
        and_(
            FlowChapterEvent.chapter_id == chapter_id,
            FlowChapterEvent.event_id == event_id,
        )
    )
    link = await db.scalar(link_stmt)

    if not link:
        raise HTTPException(status_code=404, detail="Chapter not linked to this event")

    await db.delete(link)
    await db.commit()
