"""
Transcription API Routes

Handles transcription viewing and editing.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.audio import AudioFile
from app.models.transcription import Transcription, TranscriptionStatus
from app.schemas.common import PaginatedResponse
from app.schemas.transcription import (
    TranscriptionResponse,
    TranscriptionStatusResponse,
    TranscriptionSummaryResponse,
    TranscriptionUpdate,
)

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[TranscriptionSummaryResponse],
    summary="List transcriptions",
)
async def list_transcriptions(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """
    List all transcriptions for the authenticated user.
    """
    # Query with join to filter by user
    query = (
        select(Transcription)
        .join(AudioFile)
        .where(AudioFile.user_id == user_id)
    )

    if status_filter:
        query = query.where(Transcription.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.order_by(Transcription.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    transcriptions = result.scalars().all()

    items = []
    for t in transcriptions:
        items.append(
            TranscriptionSummaryResponse(
                id=t.id,
                text=t.text[:500] if t.text else "",
                language=t.language,
                status=t.status,
                word_count=t.word_count,
                created_at=t.created_at,
                audio_file_id=t.audio_file_id,
            )
        )

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.get(
    "/{transcription_id}",
    response_model=TranscriptionResponse,
    summary="Get transcription details",
)
async def get_transcription(
    transcription_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get full transcription with segments.
    """
    result = await db.execute(
        select(Transcription)
        .join(AudioFile)
        .where(
            Transcription.id == transcription_id,
            AudioFile.user_id == user_id,
        )
    )
    transcription = result.scalar_one_or_none()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcription not found",
        )

    return TranscriptionResponse(
        id=transcription.id,
        text=transcription.text,
        segments=transcription.segments,
        words=transcription.words,
        language=transcription.language,
        language_probability=transcription.language_probability,
        stt_service=transcription.stt_service,
        stt_model=transcription.stt_model,
        status=transcription.status,
        error_message=transcription.error_message,
        processing_time=transcription.processing_time,
        is_edited=transcription.is_edited,
        word_count=transcription.word_count,
        audio_file_id=transcription.audio_file_id,
        created_at=transcription.created_at,
        updated_at=transcription.updated_at,
    )


@router.put(
    "/{transcription_id}",
    response_model=TranscriptionResponse,
    summary="Update transcription",
)
async def update_transcription(
    transcription_id: uuid.UUID,
    transcription_data: TranscriptionUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update transcription text (user corrections).
    """
    result = await db.execute(
        select(Transcription)
        .join(AudioFile)
        .where(
            Transcription.id == transcription_id,
            AudioFile.user_id == user_id,
        )
    )
    transcription = result.scalar_one_or_none()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcription not found",
        )

    # Track edit history
    if transcription.edit_history is None:
        transcription.edit_history = []

    transcription.edit_history.append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "previous_text": transcription.text[:1000],  # Store first 1000 chars
        }
    )

    # Update transcription
    transcription.text = transcription_data.text
    if transcription_data.segments:
        transcription.segments = [s.model_dump() for s in transcription_data.segments]
    transcription.is_edited = True

    await db.flush()
    await db.refresh(transcription)

    return TranscriptionResponse(
        id=transcription.id,
        text=transcription.text,
        segments=transcription.segments,
        words=transcription.words,
        language=transcription.language,
        language_probability=transcription.language_probability,
        stt_service=transcription.stt_service,
        stt_model=transcription.stt_model,
        status=transcription.status,
        error_message=transcription.error_message,
        processing_time=transcription.processing_time,
        is_edited=transcription.is_edited,
        word_count=transcription.word_count,
        audio_file_id=transcription.audio_file_id,
        created_at=transcription.created_at,
        updated_at=transcription.updated_at,
    )


@router.get(
    "/audio/{audio_id}",
    response_model=TranscriptionResponse,
    summary="Get transcription by audio file",
)
async def get_transcription_by_audio(
    audio_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get transcription for a specific audio file.
    """
    result = await db.execute(
        select(Transcription)
        .join(AudioFile)
        .where(
            Transcription.audio_file_id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    transcription = result.scalar_one_or_none()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcription not found for this audio file",
        )

    return TranscriptionResponse(
        id=transcription.id,
        text=transcription.text,
        segments=transcription.segments,
        words=transcription.words,
        language=transcription.language,
        language_probability=transcription.language_probability,
        stt_service=transcription.stt_service,
        stt_model=transcription.stt_model,
        status=transcription.status,
        error_message=transcription.error_message,
        processing_time=transcription.processing_time,
        is_edited=transcription.is_edited,
        word_count=transcription.word_count,
        audio_file_id=transcription.audio_file_id,
        created_at=transcription.created_at,
        updated_at=transcription.updated_at,
    )


@router.post(
    "/{transcription_id}/extract-events",
    summary="Extract events from transcription",
)
async def extract_events(
    transcription_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Trigger AI event extraction from a transcription.
    """
    result = await db.execute(
        select(Transcription)
        .join(AudioFile)
        .where(
            Transcription.id == transcription_id,
            AudioFile.user_id == user_id,
        )
    )
    transcription = result.scalar_one_or_none()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcription not found",
        )

    if transcription.status != TranscriptionStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcription is not complete",
        )

    # TODO: Queue event extraction task
    # from app.tasks.extraction_tasks import extract_events
    # extract_events.delay(str(transcription.id), str(user_id))

    return {
        "message": "Event extraction queued",
        "transcription_id": transcription_id,
    }
