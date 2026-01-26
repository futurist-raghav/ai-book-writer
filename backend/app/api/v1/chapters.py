"""
Chapters API Routes

Handles chapter management and compilation.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.chapter import Chapter, ChapterEvent, ChapterStatus
from app.models.event import Event
from app.schemas.chapter import (
    ChapterCompileRequest,
    ChapterCompileResponse,
    ChapterCreate,
    ChapterDetailResponse,
    ChapterEventAdd,
    ChapterEventReorder,
    ChapterEventResponse,
    ChapterListResponse,
    ChapterResponse,
    ChapterUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.event import EventListResponse

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[ChapterListResponse],
    summary="List chapters",
)
async def list_chapters(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """
    List all chapters for the authenticated user.
    """
    query = select(Chapter).where(Chapter.user_id == user_id)

    if status_filter:
        query = query.where(Chapter.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(Chapter.chapter_number, Chapter.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    query = query.options(selectinload(Chapter.event_associations))

    result = await db.execute(query)
    chapters = result.scalars().all()

    items = [
        ChapterListResponse(
            id=c.id,
            title=c.title,
            subtitle=c.subtitle,
            chapter_number=c.chapter_number,
            status=c.status,
            word_count=c.word_count,
            event_count=len(c.event_associations),
            created_at=c.created_at,
        )
        for c in chapters
    ]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create chapter",
)
async def create_chapter(
    chapter_data: ChapterCreate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Create a new chapter.
    """
    # Get next chapter number if not provided
    chapter_number = chapter_data.chapter_number
    if not chapter_number:
        result = await db.execute(
            select(func.max(Chapter.chapter_number)).where(Chapter.user_id == user_id)
        )
        max_num = result.scalar() or 0
        chapter_number = max_num + 1

    # Get next order index
    result = await db.execute(
        select(func.max(Chapter.order_index)).where(Chapter.user_id == user_id)
    )
    max_order = result.scalar() or 0

    chapter = Chapter(
        title=chapter_data.title,
        subtitle=chapter_data.subtitle,
        description=chapter_data.description,
        chapter_number=chapter_number,
        order_index=max_order + 1,
        writing_style=chapter_data.writing_style,
        tone=chapter_data.tone,
        status=ChapterStatus.DRAFT.value,
        user_id=user_id,
    )

    db.add(chapter)
    await db.flush()

    # Add events if provided
    if chapter_data.event_ids:
        for idx, event_id in enumerate(chapter_data.event_ids):
            # Verify event belongs to user
            event_result = await db.execute(
                select(Event).where(Event.id == event_id, Event.user_id == user_id)
            )
            if event_result.scalar_one_or_none():
                chapter_event = ChapterEvent(
                    chapter_id=chapter.id,
                    event_id=event_id,
                    order_index=idx,
                )
                db.add(chapter_event)

    await db.flush()
    await db.refresh(chapter)

    return ChapterResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter_data.event_ids) if chapter_data.event_ids else 0,
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
    )


@router.get(
    "/{chapter_id}",
    response_model=ChapterDetailResponse,
    summary="Get chapter details",
)
async def get_chapter(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get full chapter details with events.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event)
        )
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Build events list
    events = []
    for assoc in chapter.event_associations:
        event = assoc.event
        events.append(
            ChapterEventResponse(
                event_id=event.id,
                order_index=assoc.order_index,
                custom_content=assoc.custom_content,
                transition_text=assoc.transition_text,
                event=EventListResponse(
                    id=event.id,
                    title=event.title,
                    summary=event.summary,
                    category=event.category,
                    tags=event.tags,
                    event_date=event.event_date,
                    status=event.status,
                    is_featured=event.is_featured,
                    word_count=event.word_count,
                    created_at=event.created_at,
                ),
            )
        )

    return ChapterDetailResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter.event_associations),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
        events=events,
    )


@router.put(
    "/{chapter_id}",
    response_model=ChapterResponse,
    summary="Update chapter",
)
async def update_chapter(
    chapter_id: uuid.UUID,
    chapter_data: ChapterUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update chapter metadata.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations))
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    update_data = chapter_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chapter, field, value)

    await db.flush()
    await db.refresh(chapter)

    return ChapterResponse(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        description=chapter.description,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        writing_style=chapter.writing_style,
        tone=chapter.tone,
        status=chapter.status,
        compiled_content=chapter.compiled_content,
        last_compiled_at=chapter.last_compiled_at,
        word_count=chapter.word_count,
        event_count=len(chapter.event_associations),
        created_at=chapter.created_at,
        updated_at=chapter.updated_at,
    )


@router.delete(
    "/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete chapter",
)
async def delete_chapter(
    chapter_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete a chapter.
    """
    result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    await db.delete(chapter)


@router.post(
    "/{chapter_id}/events",
    response_model=MessageResponse,
    summary="Add events to chapter",
)
async def add_events_to_chapter(
    chapter_id: uuid.UUID,
    event_data: ChapterEventAdd,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Add events to a chapter.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(selectinload(Chapter.event_associations))
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Get current max order
    max_order = max([ea.order_index for ea in chapter.event_associations], default=-1)

    added_count = 0
    for event_id in event_data.event_ids:
        # Verify event belongs to user and not already in chapter
        event_result = await db.execute(
            select(Event).where(Event.id == event_id, Event.user_id == user_id)
        )
        if event_result.scalar_one_or_none():
            # Check if already in chapter
            existing = await db.execute(
                select(ChapterEvent).where(
                    ChapterEvent.chapter_id == chapter_id,
                    ChapterEvent.event_id == event_id,
                )
            )
            if not existing.scalar_one_or_none():
                max_order += 1
                chapter_event = ChapterEvent(
                    chapter_id=chapter_id,
                    event_id=event_id,
                    order_index=max_order,
                )
                db.add(chapter_event)
                added_count += 1

    await db.flush()

    return MessageResponse(message=f"Added {added_count} events to chapter")


@router.delete(
    "/{chapter_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove event from chapter",
)
async def remove_event_from_chapter(
    chapter_id: uuid.UUID,
    event_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Remove an event from a chapter.
    """
    # Verify chapter belongs to user
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    # Find and delete the association
    result = await db.execute(
        select(ChapterEvent).where(
            ChapterEvent.chapter_id == chapter_id,
            ChapterEvent.event_id == event_id,
        )
    )
    chapter_event = result.scalar_one_or_none()

    if chapter_event:
        await db.delete(chapter_event)


@router.post(
    "/{chapter_id}/events/reorder",
    response_model=MessageResponse,
    summary="Reorder events in chapter",
)
async def reorder_chapter_events(
    chapter_id: uuid.UUID,
    reorder_data: ChapterEventReorder,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Reorder events within a chapter.
    """
    # Verify chapter belongs to user
    chapter_result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    if not chapter_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    for idx, event_id in enumerate(reorder_data.event_ids):
        result = await db.execute(
            select(ChapterEvent).where(
                ChapterEvent.chapter_id == chapter_id,
                ChapterEvent.event_id == event_id,
            )
        )
        chapter_event = result.scalar_one_or_none()
        if chapter_event:
            chapter_event.order_index = idx

    await db.flush()

    return MessageResponse(message="Events reordered successfully")


@router.post(
    "/{chapter_id}/compile",
    response_model=ChapterCompileResponse,
    summary="Compile chapter content",
)
async def compile_chapter(
    chapter_id: uuid.UUID,
    compile_data: ChapterCompileRequest,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Compile chapter content from events using AI.
    """
    result = await db.execute(
        select(Chapter)
        .where(Chapter.id == chapter_id, Chapter.user_id == user_id)
        .options(
            selectinload(Chapter.event_associations).selectinload(ChapterEvent.event)
        )
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    if not chapter.event_associations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter has no events to compile",
        )

    # For now, simple concatenation. TODO: Use AI for proper compilation
    compiled_parts = []
    for assoc in sorted(chapter.event_associations, key=lambda x: x.order_index):
        event = assoc.event
        content = assoc.custom_content or event.content
        compiled_parts.append(content)
        if assoc.transition_text:
            compiled_parts.append(assoc.transition_text)

    compiled_content = "\n\n".join(compiled_parts)

    chapter.compiled_content = compiled_content
    chapter.last_compiled_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(chapter)

    return ChapterCompileResponse(
        id=chapter.id,
        compiled_content=chapter.compiled_content,
        word_count=chapter.word_count,
        compiled_at=chapter.last_compiled_at,
        message="Chapter compiled successfully",
    )
