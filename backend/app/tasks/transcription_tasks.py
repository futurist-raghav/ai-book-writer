"""
Transcription Background Tasks

Handles audio transcription using speech-to-text services.
"""

import asyncio
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.audio import AudioFile, AudioStatus
from app.models.transcription import Transcription, TranscriptionStatus
from app.services.stt.whisper_service import get_whisper_service


async def _transcribe_audio_async(audio_id: str) -> dict:
    """
    Async implementation of audio transcription.

    Args:
        audio_id: UUID of the audio file to transcribe.

    Returns:
        Dictionary with transcription result info.
    """
    async with async_session_maker() as db:
        # Get audio file
        result = await db.execute(
            select(AudioFile).where(AudioFile.id == audio_id)
        )
        audio_file = result.scalar_one_or_none()

        if not audio_file:
            return {"error": "Audio file not found", "audio_id": audio_id}

        try:
            # Update status to transcribing
            audio_file.status = AudioStatus.TRANSCRIBING.value
            await db.commit()

            # Get Whisper service
            whisper = get_whisper_service()

            # Transcribe
            transcription_result = await whisper.transcribe(
                audio_path=audio_file.file_path,
            )

            # Create or update transcription record
            existing_result = await db.execute(
                select(Transcription).where(
                    Transcription.audio_file_id == audio_file.id
                )
            )
            transcription = existing_result.scalar_one_or_none()

            if transcription:
                # Update existing
                transcription.text = transcription_result.text
                transcription.segments = [
                    s.model_dump() for s in transcription_result.segments
                ]
                transcription.words = [
                    w.model_dump() for w in transcription_result.words
                ]
                transcription.language = transcription_result.language
                transcription.processing_time = transcription_result.processing_time
                transcription.status = TranscriptionStatus.COMPLETED.value
                transcription.error_message = None
            else:
                # Create new
                transcription = Transcription(
                    text=transcription_result.text,
                    segments=[s.model_dump() for s in transcription_result.segments],
                    words=[w.model_dump() for w in transcription_result.words],
                    language=transcription_result.language,
                    stt_service="whisper",
                    stt_model="whisper-1",
                    processing_time=transcription_result.processing_time,
                    status=TranscriptionStatus.COMPLETED.value,
                    audio_file_id=audio_file.id,
                )
                db.add(transcription)

            # Update audio file status
            audio_file.status = AudioStatus.TRANSCRIBED.value
            audio_file.duration = transcription_result.duration
            audio_file.processed_at = datetime.now(timezone.utc)

            await db.commit()

            return {
                "success": True,
                "audio_id": audio_id,
                "transcription_id": str(transcription.id),
                "word_count": transcription.word_count,
                "language": transcription_result.language,
            }

        except Exception as e:
            # Update status to failed
            audio_file.status = AudioStatus.FAILED.value
            audio_file.error_message = str(e)

            # Update transcription if exists
            existing_result = await db.execute(
                select(Transcription).where(
                    Transcription.audio_file_id == audio_file.id
                )
            )
            transcription = existing_result.scalar_one_or_none()
            if transcription:
                transcription.status = TranscriptionStatus.FAILED.value
                transcription.error_message = str(e)

            await db.commit()

            return {
                "error": str(e),
                "audio_id": audio_id,
            }


@shared_task(
    name="tasks.transcribe_audio",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def transcribe_audio(self, audio_id: str) -> dict:
    """
    Celery task to transcribe an audio file.

    Args:
        audio_id: UUID of the audio file to transcribe.

    Returns:
        Dictionary with transcription result info.
    """
    # Run async function in event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_transcribe_audio_async(audio_id))
    finally:
        loop.close()
