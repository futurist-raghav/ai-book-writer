"""
Events API Routes

Handles event management and organization.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.event import Event, EventStatus
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventReorderRequest,
    EventResponse,
    EventUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[EventListResponse],
    summary="List events",
)
async def list_events(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    featured_only: bool = False,
    search: Optional[str] = None,
):
    """
    List all events for the authenticated user.
    """
    query = select(Event).where(Event.user_id == user_id)

    # Apply filters
    if category:
        query = query.where(Event.category == category)

    if tag:
        query = query.where(Event.tags.contains([tag]))

    if status_filter:
        query = query.where(Event.status == status_filter)

    if featured_only:
        query = query.where(Event.is_featured == True)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Event.title.ilike(search_filter))
            | (Event.content.ilike(search_filter))
            | (Event.summary.ilike(search_filter))
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(Event.order_index, Event.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    events = result.scalars().all()

    items = [
        EventListResponse(
            id=e.id,
            title=e.title,
            summary=e.summary,
            category=e.category,
            tags=e.tags,
            event_date=e.event_date,
            status=e.status,
            is_featured=e.is_featured,
            word_count=e.word_count,
            created_at=e.created_at,
        )
        for e in events
    ]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.get(
    "/categories",
    response_model=List[str],
    summary="Get event categories",
)
async def get_categories(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get list of unique categories used by the user.
    """
    result = await db.execute(
        select(Event.category)
        .where(Event.user_id == user_id, Event.category.isnot(None))
        .distinct()
    )
    categories = result.scalars().all()
    return [c for c in categories if c]


@router.get(
    "/tags",
    response_model=List[str],
    summary="Get event tags",
)
async def get_tags(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get list of unique tags used by the user.
    """
    result = await db.execute(
        select(Event.tags).where(Event.user_id == user_id, Event.tags.isnot(None))
    )
    all_tags = result.scalars().all()

    # Flatten and dedupe
    unique_tags = set()
    for tags in all_tags:
        if tags:
            unique_tags.update(tags)

    return sorted(list(unique_tags))


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create event manually",
)
async def create_event(
    event_data: EventCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a new event manually (not from transcription).
    """
    # Get next order index
    result = await db.execute(
        select(func.max(Event.order_index)).where(Event.user_id == user_id)
    )
    max_order = result.scalar() or 0

    event = Event(
        title=event_data.title,
        summary=event_data.summary,
        content=event_data.content,
        category=event_data.category,
        subcategory=event_data.subcategory,
        tags=event_data.tags,
        event_date=event_data.event_date,
        event_date_precision=event_data.event_date_precision,
        age_at_event=event_data.age_at_event,
        location=event_data.location,
        people=[p.model_dump() for p in event_data.people] if event_data.people else None,
        sentiment=event_data.sentiment,
        emotions=event_data.emotions,
        status=EventStatus.DRAFT.value,
        order_index=max_order + 1,
        user_id=user_id,
    )

    db.add(event)
    await db.flush()
    await db.refresh(event)

    return event


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get event details",
)
async def get_event(
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get full details of an event.
    """
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return event


@router.put(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update event",
)
async def update_event(
    event_id: uuid.UUID,
    event_data: EventUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update an event.
    """
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    update_data = event_data.model_dump(exclude_unset=True)

    # Handle nested objects
    if "people" in update_data and update_data["people"]:
        update_data["people"] = [
            p.model_dump() if hasattr(p, "model_dump") else p
            for p in update_data["people"]
        ]

    if "location_details" in update_data and update_data["location_details"]:
        ld = update_data["location_details"]
        update_data["location_details"] = ld.model_dump() if hasattr(ld, "model_dump") else ld

    for field, value in update_data.items():
        setattr(event, field, value)

    await db.flush()
    await db.refresh(event)

    return event


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete event",
)
async def delete_event(
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete an event.
    """
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    await db.delete(event)


@router.post(
    "/reorder",
    response_model=MessageResponse,
    summary="Reorder events",
)
async def reorder_events(
    reorder_data: EventReorderRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reorder events by providing list of event IDs in desired order.
    """
    for idx, event_id in enumerate(reorder_data.event_ids):
        result = await db.execute(
            select(Event).where(Event.id == event_id, Event.user_id == user_id)
        )
        event = result.scalar_one_or_none()

        if event:
            event.order_index = idx

    await db.flush()

    return MessageResponse(message="Events reordered successfully")


@router.post(
    "/{event_id}/feature",
    response_model=EventResponse,
    summary="Toggle featured status",
)
async def toggle_featured(
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Toggle the featured status of an event.
    """
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    event.is_featured = not event.is_featured
    await db.flush()
    await db.refresh(event)

    return event
