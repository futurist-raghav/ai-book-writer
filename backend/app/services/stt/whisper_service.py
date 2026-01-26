"""
OpenAI Whisper Service

Handles speech-to-text transcription using OpenAI's Whisper API.
"""

import os
import time
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel

from app.core.config import settings


class TranscriptionSegment(BaseModel):
    """A segment of transcription with timestamps."""

    start: float
    end: float
    text: str


class TranscriptionWord(BaseModel):
    """A word with timestamp."""

    start: float
    end: float
    word: str


class TranscriptionResult(BaseModel):
    """Result of a transcription."""

    text: str
    language: Optional[str] = None
    language_probability: Optional[float] = None
    segments: List[TranscriptionSegment] = []
    words: List[TranscriptionWord] = []
    duration: Optional[float] = None
    processing_time: float = 0


class WhisperService:
    """Service for transcribing audio using OpenAI Whisper API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Whisper service.

        Args:
            api_key: OpenAI API key. If not provided, uses settings.
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.base_url = "https://api.openai.com/v1"
        self.model = "whisper-1"

        if not self.api_key:
            raise ValueError("OpenAI API key is required for Whisper service")

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        response_format: str = "verbose_json",
        temperature: float = 0,
    ) -> TranscriptionResult:
        """
        Transcribe an audio file using Whisper API.

        Args:
            audio_path: Path to the audio file.
            language: ISO 639-1 language code (optional, auto-detected if not provided).
            prompt: Optional prompt to guide the transcription.
            response_format: Response format (json, text, srt, verbose_json, vtt).
            temperature: Sampling temperature (0-1).

        Returns:
            TranscriptionResult with text and segments.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.time()

        async with httpx.AsyncClient(timeout=600.0) as client:
            # Prepare the request
            with open(audio_path, "rb") as audio_file:
                files = {"file": (os.path.basename(audio_path), audio_file)}

                data = {
                    "model": self.model,
                    "response_format": response_format,
                    "temperature": str(temperature),
                }

                if language:
                    data["language"] = language

                if prompt:
                    data["prompt"] = prompt

                # Request word-level timestamps
                if response_format == "verbose_json":
                    data["timestamp_granularities[]"] = ["word", "segment"]

                response = await client.post(
                    f"{self.base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    data=data,
                )

        processing_time = time.time() - start_time

        if response.status_code != 200:
            raise Exception(f"Whisper API error: {response.text}")

        result_data = response.json()

        # Parse response
        segments = []
        words = []

        if "segments" in result_data:
            for seg in result_data["segments"]:
                segments.append(
                    TranscriptionSegment(
                        start=seg.get("start", 0),
                        end=seg.get("end", 0),
                        text=seg.get("text", "").strip(),
                    )
                )

        if "words" in result_data:
            for word_data in result_data["words"]:
                words.append(
                    TranscriptionWord(
                        start=word_data.get("start", 0),
                        end=word_data.get("end", 0),
                        word=word_data.get("word", "").strip(),
                    )
                )

        return TranscriptionResult(
            text=result_data.get("text", "").strip(),
            language=result_data.get("language"),
            segments=segments,
            words=words,
            duration=result_data.get("duration"),
            processing_time=processing_time,
        )

    async def translate(
        self,
        audio_path: str,
        prompt: Optional[str] = None,
        response_format: str = "verbose_json",
        temperature: float = 0,
    ) -> TranscriptionResult:
        """
        Translate audio to English using Whisper API.

        Args:
            audio_path: Path to the audio file.
            prompt: Optional prompt to guide the translation.
            response_format: Response format.
            temperature: Sampling temperature.

        Returns:
            TranscriptionResult with translated text.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.time()

        async with httpx.AsyncClient(timeout=600.0) as client:
            with open(audio_path, "rb") as audio_file:
                files = {"file": (os.path.basename(audio_path), audio_file)}

                data = {
                    "model": self.model,
                    "response_format": response_format,
                    "temperature": str(temperature),
                }

                if prompt:
                    data["prompt"] = prompt

                response = await client.post(
                    f"{self.base_url}/audio/translations",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    data=data,
                )

        processing_time = time.time() - start_time

        if response.status_code != 200:
            raise Exception(f"Whisper API error: {response.text}")

        result_data = response.json()

        segments = []
        if "segments" in result_data:
            for seg in result_data["segments"]:
                segments.append(
                    TranscriptionSegment(
                        start=seg.get("start", 0),
                        end=seg.get("end", 0),
                        text=seg.get("text", "").strip(),
                    )
                )

        return TranscriptionResult(
            text=result_data.get("text", "").strip(),
            language="en",  # Translation is always to English
            segments=segments,
            duration=result_data.get("duration"),
            processing_time=processing_time,
        )


# Singleton instance
_whisper_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    """Get or create the Whisper service singleton."""
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperService()
    return _whisper_service
