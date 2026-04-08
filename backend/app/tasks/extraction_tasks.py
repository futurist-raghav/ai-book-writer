"""
Event Extraction Background Tasks

Handles extracting narrative events from transcriptions using AI.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from celery import shared_task
from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.config import settings
from app.models.audio import AudioFile, AudioStatus
from app.models.book import Book, BookChapter
from app.models.chapter import Chapter, ChapterEvent
from app.models.event import Event, EventStatus
from app.models.transcription import Transcription
from app.models.user import User
from app.services.llm.gemini_service import get_gemini_service


def _fallback_events_from_text(transcription_text: str) -> List[Dict[str, Any]]:
    """Create deterministic event slices when AI extraction is disabled/unavailable."""
    chunks = [part.strip() for part in transcription_text.split("\n\n") if part.strip()]
    if not chunks:
        cleaned = transcription_text.strip()
        if cleaned:
            chunks = [cleaned]

    events: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks[:12], start=1):
        title_seed = " ".join(chunk.replace("\n", " ").split()[:8]).strip()
        title = title_seed if title_seed else f"Event {index}"
        if len(title) > 80:
            title = f"{title[:77]}..."
        events.append(
            {
                "title": title,
                "summary": chunk[:220],
                "content": chunk,
                "category": "other",
                "tags": ["transcript"],
                "location": None,
                "people": [],
                "sentiment": "neutral",
                "emotions": [],
            }
        )

    return events


async def _extract_events_async(
    transcription_id: str,
    user_id: str,
    chapter_id: str | None = None,
) -> dict:
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

        chapter = None
        if chapter_id:
            chapter_uuid = None
            try:
                chapter_uuid = uuid.UUID(str(chapter_id))
            except (TypeError, ValueError):
                chapter_uuid = None

            if chapter_uuid is not None:
                chapter_result = await db.execute(
                    select(Chapter).where(
                        Chapter.id == chapter_uuid,
                        Chapter.user_id == user_id,
                    )
                )
                chapter = chapter_result.scalar_one_or_none()

        if chapter and isinstance(chapter.generation_settings, dict):
            workspace = chapter.generation_settings.get("workspace")
            if isinstance(workspace, dict) and workspace.get("base_context"):
                if user_context is None:
                    user_context = {}
                user_context["chapter_base_context"] = workspace.get("base_context")
                user_context["chapter_writing_form"] = workspace.get("writing_form")
                user_context["chapter_title"] = chapter.title

        ai_enabled = bool(user.ai_assist_enabled) if user else True
        if chapter is not None:
            if chapter.ai_enhancement_enabled is not None:
                ai_enabled = bool(chapter.ai_enhancement_enabled)
            else:
                book_result = await db.execute(
                    select(Book)
                    .join(BookChapter, BookChapter.book_id == Book.id)
                    .where(BookChapter.chapter_id == chapter.id)
                    .order_by(BookChapter.order_index.asc())
                    .limit(1)
                )
                book = book_result.scalar_one_or_none()
                if book is not None:
                    ai_enabled = bool(book.ai_enhancement_enabled)

        try:
            # Update audio file status if exists
            audio_result = await db.execute(
                select(AudioFile).where(AudioFile.id == transcription.audio_file_id)
            )
            audio_file = audio_result.scalar_one_or_none()
            if audio_file:
                audio_file.status = AudioStatus.PROCESSING.value
                await db.commit()

            if ai_enabled:
                try:
                    gemini = get_gemini_service()
                    extracted_events = await gemini.extract_events(
                        transcription=transcription.text,
                        user_context=user_context,
                    )
                except Exception:
                    extracted_events = _fallback_events_from_text(transcription.text)
            else:
                extracted_events = _fallback_events_from_text(transcription.text)

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
                    extraction_model=settings.GOOGLE_GEMINI_MODEL,
                    status=EventStatus.EXTRACTED.value,
                    order_index=max_order + i + 1,
                    transcription_id=transcription.id,
                    user_id=user_id,
                )
                db.add(event)
                created_events.append(event)

            await db.flush()

            if chapter and created_events:
                current_order_result = await db.execute(
                    select(ChapterEvent.order_index)
                    .where(ChapterEvent.chapter_id == chapter.id)
                    .order_by(ChapterEvent.order_index.desc())
                    .limit(1)
                )
                current_order = current_order_result.scalar()
                current_order = current_order if current_order is not None else -1

                for index, event in enumerate(created_events):
                    chapter_event = ChapterEvent(
                        chapter_id=chapter.id,
                        event_id=event.id,
                        order_index=current_order + index + 1,
                    )
                    db.add(chapter_event)

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
                "chapter_id": chapter_id,
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
def extract_events(
    self,
    transcription_id: str,
    user_id: str,
    chapter_id: str | None = None,
) -> dict:
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
        return loop.run_until_complete(
            _extract_events_async(transcription_id, user_id, chapter_id)
        )
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
        extract_result = extract_events(
            transcription_id,
            user_id,
            transcribe_result.get("chapter_id"),
        )
        return {
            "transcription": transcribe_result,
            "extraction": extract_result,
        }

    return transcribe_result
