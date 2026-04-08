"""
Transcription Background Tasks

Handles audio transcription using speech-to-text services.
"""

import asyncio
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.book import Book, BookChapter
from app.models.audio import AudioFile, AudioStatus
from app.models.chapter import Chapter
from app.models.transcription import Transcription, TranscriptionStatus
from app.models.user import User
from app.services.llm.gemini_service import get_gemini_service
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

            metadata = audio_file.file_metadata if isinstance(audio_file.file_metadata, dict) else {}
            task_mode = str(metadata.get("transcription_mode", "transcribe")).strip().lower()
            if task_mode not in {"transcribe", "translate"}:
                task_mode = "transcribe"

            chapter_id_value = metadata.get("chapter_id")
            chapter_uuid = None
            chapter_id_str = None
            if chapter_id_value:
                try:
                    chapter_uuid = uuid.UUID(str(chapter_id_value))
                    chapter_id_str = str(chapter_uuid)
                except (TypeError, ValueError):
                    chapter_uuid = None
                    chapter_id_str = None

            # Get Whisper service
            whisper = get_whisper_service()
            stt_service = whisper.provider_name
            stt_model = whisper.model_name

            if task_mode == "translate":
                transcription_result = await whisper.translate(
                    audio_path=audio_file.file_path,
                )
            else:
                transcription_result = await whisper.transcribe(
                    audio_path=audio_file.file_path,
                )

            user_result = await db.execute(select(User).where(User.id == audio_file.user_id))
            user = user_result.scalar_one_or_none()

            ai_enabled = bool(user.ai_assist_enabled) if user else True
            chapter = None
            if chapter_uuid is not None:
                chapter_result = await db.execute(
                    select(Chapter).where(
                        Chapter.id == chapter_uuid,
                        Chapter.user_id == audio_file.user_id,
                    )
                )
                chapter = chapter_result.scalar_one_or_none()

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

            final_text = transcription_result.text
            ai_enhanced = False
            if ai_enabled and final_text.strip():
                try:
                    gemini = get_gemini_service()
                    final_text = await gemini.improve_text(
                        text=final_text,
                        instructions=(
                            "Improve wording clarity and explanation quality while preserving "
                            "facts, intent, chronology, and voice. Do not invent details."
                        ),
                    )
                    ai_enhanced = True
                except Exception:
                    ai_enhanced = False

            # Create or update transcription record
            existing_result = await db.execute(
                select(Transcription).where(
                    Transcription.audio_file_id == audio_file.id
                )
            )
            transcription = existing_result.scalar_one_or_none()

            if transcription:
                # Update existing
                transcription.text = final_text
                transcription.segments = [
                    s.model_dump() for s in transcription_result.segments
                ]
                transcription.words = [
                    w.model_dump() for w in transcription_result.words
                ]
                transcription.language = transcription_result.language
                transcription.stt_service = stt_service
                transcription.stt_model = stt_model
                transcription.task_mode = task_mode
                transcription.ai_enhanced = ai_enhanced
                transcription.processing_time = transcription_result.processing_time
                transcription.status = TranscriptionStatus.COMPLETED.value
                transcription.error_message = None
            else:
                # Create new
                transcription = Transcription(
                    text=final_text,
                    segments=[s.model_dump() for s in transcription_result.segments],
                    words=[w.model_dump() for w in transcription_result.words],
                    language=transcription_result.language,
                    stt_service=stt_service,
                    stt_model=stt_model,
                    task_mode=task_mode,
                    ai_enhanced=ai_enhanced,
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
                "task_mode": task_mode,
                "ai_enhanced": ai_enhanced,
                "chapter_id": chapter_id_str,
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
