"""
Event Extraction Background Tasks

Handles extracting narrative events from transcriptions using AI.
"""

import asyncio
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.audio import AudioFile, AudioStatus
from app.models.event import Event, EventStatus
from app.models.transcription import Transcription
from app.models.user import User
from app.services.llm.gemini_service import get_gemini_service


async def _extract_events_async(transcription_id: str, user_id: str) -> dict:
    """
    Async implementation of event extraction.

    Args:
        transcription_id: UUID of the transcription.
        user_id: UUID of the user.

    Returns:
        Dictionary with extraction result info.
    """
    async with async_session_maker() as db:
        # Get transcription
        result = await db.execute(
            select(Transcription).where(Transcription.id == transcription_id)
        )
        transcription = result.scalar_one_or_none()

        if not transcription:
            return {"error": "Transcription not found", "transcription_id": transcription_id}

        # Get user for context
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        user_context = None
        if user:
            user_context = {
                "writing_style": user.writing_style,
                "preferred_tense": user.preferred_tense,
                "preferred_perspective": user.preferred_perspective,
                "preferences": user.writing_preferences,
            }

        try:
            # Update audio file status if exists
            audio_result = await db.execute(
                select(AudioFile).where(AudioFile.id == transcription.audio_file_id)
            )
            audio_file = audio_result.scalar_one_or_none()
            if audio_file:
                audio_file.status = AudioStatus.PROCESSING.value
                await db.commit()

            # Get Gemini service
            gemini = get_gemini_service()

            # Extract events
            extracted_events = await gemini.extract_events(
                transcription=transcription.text,
                user_context=user_context,
            )

            # Get current max order index
            max_order_result = await db.execute(
                select(Event.order_index)
                .where(Event.user_id == user_id)
                .order_by(Event.order_index.desc())
                .limit(1)
            )
            max_order = max_order_result.scalar() or 0

            # Create event records
            created_events = []
            for i, event_data in enumerate(extracted_events):
                event = Event(
                    title=event_data.get("title", "Untitled Event"),
                    summary=event_data.get("summary"),
                    content=event_data.get("content", ""),
                    original_text=event_data.get("content", ""),
                    category=event_data.get("category"),
                    tags=event_data.get("tags"),
                    location=event_data.get("location"),
                    people=event_data.get("people"),
                    sentiment=event_data.get("sentiment"),
                    emotions=event_data.get("emotions"),
                    extraction_confidence=0.8,  # Default confidence
                    extraction_model="gemini-1.5-flash",
                    status=EventStatus.EXTRACTED.value,
                    order_index=max_order + i + 1,
                    transcription_id=transcription.id,
                    user_id=user_id,
                )
                db.add(event)
                created_events.append(event)

            # Update audio file status
            if audio_file:
                audio_file.status = AudioStatus.PROCESSED.value
                audio_file.processed_at = datetime.now(timezone.utc)

            await db.commit()

            return {
                "success": True,
                "transcription_id": transcription_id,
                "events_created": len(created_events),
                "event_ids": [str(e.id) for e in created_events],
            }

        except Exception as e:
            # Update status to failed
            if audio_file:
                audio_file.status = AudioStatus.FAILED.value
                audio_file.error_message = f"Event extraction failed: {str(e)}"
                await db.commit()

            return {
                "error": str(e),
                "transcription_id": transcription_id,
            }


@shared_task(
    name="tasks.extract_events",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def extract_events(self, transcription_id: str, user_id: str) -> dict:
    """
    Celery task to extract events from a transcription.

    Args:
        transcription_id: UUID of the transcription.
        user_id: UUID of the user.

    Returns:
        Dictionary with extraction result info.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_extract_events_async(transcription_id, user_id))
    finally:
        loop.close()


@shared_task(name="tasks.process_audio_complete")
def process_audio_complete(audio_id: str, user_id: str) -> dict:
    """
    Chain task: transcribe audio and then extract events.

    Args:
        audio_id: UUID of the audio file.
        user_id: UUID of the user.

    Returns:
        Dictionary with processing result.
    """
    from app.tasks.transcription_tasks import transcribe_audio

    # First transcribe
    transcribe_result = transcribe_audio(audio_id)

    if "error" in transcribe_result:
        return transcribe_result

    # Then extract events
    transcription_id = transcribe_result.get("transcription_id")
    if transcription_id:
        extract_result = extract_events(transcription_id, user_id)
        return {
            "transcription": transcribe_result,
            "extraction": extract_result,
        }

    return transcribe_result
