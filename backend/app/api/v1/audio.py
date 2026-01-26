"""
Audio API Routes

Handles audio file upload, management, and processing.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from app.core.config import settings
from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.audio import AudioFile, AudioStatus
from app.schemas.audio import (
    AudioListResponse,
    AudioMetadata,
    AudioResponse,
    AudioStatusResponse,
    AudioUpdate,
    AudioUploadResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter()


def get_storage_path(user_id: str, filename: str) -> str:
    """Generate storage path for audio file."""
    user_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "audio", user_id)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, filename)


def validate_audio_file(file: UploadFile) -> None:
    """Validate uploaded audio file."""
    # Check file extension
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in settings.allowed_audio_formats_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported audio format. Allowed: {', '.join(settings.allowed_audio_formats_list)}",
            )

    # Check content type
    if file.content_type and not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an audio file",
        )


@router.post(
    "/upload",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an audio file",
)
async def upload_audio(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
):
    """
    Upload an audio file for processing.

    The file will be queued for transcription after upload.
    """
    validate_audio_file(file)

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > settings.max_audio_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_AUDIO_FILE_SIZE_MB}MB",
        )

    # Generate unique filename
    original_filename = file.filename or "audio"
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "mp3"
    unique_filename = f"{uuid.uuid4()}.{ext}"

    # Save file
    file_path = get_storage_path(user_id, unique_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse tags
    tag_list = None
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    # Create database record
    audio_file = AudioFile(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "audio/mpeg",
        file_format=ext,
        title=title,
        description=description,
        tags=tag_list,
        status=AudioStatus.UPLOADED.value,
        user_id=user_id,
    )

    db.add(audio_file)
    await db.flush()
    await db.refresh(audio_file)

    # TODO: Queue transcription task
    # from app.tasks.transcription_tasks import transcribe_audio
    # transcribe_audio.delay(str(audio_file.id))

    return AudioUploadResponse(
        id=audio_file.id,
        filename=audio_file.filename,
        status=audio_file.status,
        message="Audio file uploaded successfully. Transcription will begin shortly.",
    )


@router.get(
    "",
    response_model=PaginatedResponse[AudioListResponse],
    summary="List audio files",
)
async def list_audio_files(
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    tag: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    List all audio files for the authenticated user.
    """
    # Base query
    query = select(AudioFile).where(AudioFile.user_id == user_id)

    # Apply filters
    if status_filter:
        query = query.where(AudioFile.status == status_filter)

    if tag:
        query = query.where(AudioFile.tags.contains([tag]))

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (AudioFile.title.ilike(search_filter))
            | (AudioFile.original_filename.ilike(search_filter))
            | (AudioFile.description.ilike(search_filter))
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(AudioFile.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    audio_files = result.scalars().all()

    return PaginatedResponse.create(
        items=[AudioListResponse.model_validate(af) for af in audio_files],
        total=total,
        page=page,
        limit=limit,
    )


@router.get(
    "/{audio_id}",
    response_model=AudioResponse,
    summary="Get audio file details",
)
async def get_audio_file(
    audio_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get details of a specific audio file.
    """
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    audio_file = result.scalar_one_or_none()

    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    return audio_file


@router.put(
    "/{audio_id}",
    response_model=AudioResponse,
    summary="Update audio file metadata",
)
async def update_audio_file(
    audio_id: uuid.UUID,
    audio_data: AudioUpdate,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Update metadata for an audio file.
    """
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    audio_file = result.scalar_one_or_none()

    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    # Update fields
    update_data = audio_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(audio_file, field, value)

    await db.flush()
    await db.refresh(audio_file)

    return audio_file


@router.delete(
    "/{audio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete audio file",
)
async def delete_audio_file(
    audio_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Delete an audio file and its associated data.
    """
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    audio_file = result.scalar_one_or_none()

    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    # Delete physical file
    if os.path.exists(audio_file.file_path):
        os.remove(audio_file.file_path)

    # Delete database record (cascade will handle transcription and events)
    await db.delete(audio_file)


@router.get(
    "/{audio_id}/status",
    response_model=AudioStatusResponse,
    summary="Get audio processing status",
)
async def get_audio_status(
    audio_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Get the current processing status of an audio file.
    """
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    audio_file = result.scalar_one_or_none()

    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    # Calculate progress based on status
    progress_map = {
        AudioStatus.PENDING.value: 0,
        AudioStatus.UPLOADING.value: 10,
        AudioStatus.UPLOADED.value: 20,
        AudioStatus.TRANSCRIBING.value: 50,
        AudioStatus.TRANSCRIBED.value: 70,
        AudioStatus.PROCESSING.value: 85,
        AudioStatus.PROCESSED.value: 100,
        AudioStatus.FAILED.value: 0,
    }

    return AudioStatusResponse(
        id=audio_file.id,
        status=audio_file.status,
        progress=progress_map.get(audio_file.status, 0),
        error_message=audio_file.error_message,
    )


@router.post(
    "/{audio_id}/retry",
    response_model=MessageResponse,
    summary="Retry failed transcription",
)
async def retry_transcription(
    audio_id: uuid.UUID,
    user_id: CurrentUserIdDep,
    db: AsyncSessionDep,
):
    """
    Retry transcription for a failed audio file.
    """
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_id,
            AudioFile.user_id == user_id,
        )
    )
    audio_file = result.scalar_one_or_none()

    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    if audio_file.status not in [AudioStatus.FAILED.value, AudioStatus.UPLOADED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file is not in a retryable state",
        )

    # Reset status
    audio_file.status = AudioStatus.UPLOADED.value
    audio_file.error_message = None
    await db.flush()

    # TODO: Queue transcription task
    # from app.tasks.transcription_tasks import transcribe_audio
    # transcribe_audio.delay(str(audio_file.id))

    return MessageResponse(message="Transcription queued for retry")
