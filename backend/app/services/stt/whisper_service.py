"""
Whisper STT Service

Supports both OpenAI Whisper API and self-hosted whisper-asr-webservice.
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
    """Service for transcribing audio via OpenAI or self-hosted Whisper."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Whisper service.

        Args:
            api_key: OpenAI API key override for OpenAI provider mode.
        """
        configured_provider = settings.STT_PROVIDER or settings.PREFERRED_STT_SERVICE
        self.provider = configured_provider.strip().lower()

        self.openai_api_key = api_key or settings.OPENAI_API_KEY
        self.openai_base_url = "https://api.openai.com/v1"
        self.openai_model = "whisper-1"

        self.vm_base_url = (settings.WHISPER_VM_BASE_URL or "").rstrip("/")
        self.vm_model = settings.WHISPER_VM_MODEL_NAME
        self.vm_default_task = settings.WHISPER_VM_DEFAULT_TASK
        self.vm_output_format = settings.WHISPER_VM_OUTPUT_FORMAT
        self.vm_encode = settings.WHISPER_VM_ENCODE
        self.vm_word_timestamps = settings.WHISPER_VM_WORD_TIMESTAMPS

        self.timeout_seconds = float(settings.WHISPER_TIMEOUT_SECONDS)

        if self.provider == "openai" and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when STT_PROVIDER=openai")

        if self.provider == "whisper_vm" and not self.vm_base_url:
            raise ValueError("WHISPER_VM_BASE_URL is required when STT_PROVIDER=whisper_vm")

    @property
    def provider_name(self) -> str:
        """Name stored in transcription metadata."""
        return "whisper_vm" if self.provider == "whisper_vm" else "openai_whisper"

    @property
    def model_name(self) -> str:
        """Model name stored in transcription metadata."""
        return self.vm_model if self.provider == "whisper_vm" else self.openai_model

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        response_format: str = "verbose_json",
        temperature: float = 0,
        task: Optional[str] = None,
    ) -> TranscriptionResult:
        """
        Transcribe an audio file using configured STT provider.

        Args:
            audio_path: Path to the audio file.
            language: ISO 639-1 language code (optional, auto-detected if not provided).
            prompt: Optional prompt to guide the transcription.
            response_format: Response format (json, text, srt, verbose_json, vtt).
            temperature: Sampling temperature (0-1).
            task: Optional explicit task override (transcribe or translate).

        Returns:
            TranscriptionResult with text and segments.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.time()

        if self.provider == "whisper_vm":
            result_data = await self._transcribe_with_vm(
                audio_path=audio_path,
                language=language,
                prompt=prompt,
                response_format=response_format,
                task=task,
            )
        else:
            result_data = await self._transcribe_with_openai(
                audio_path=audio_path,
                language=language,
                prompt=prompt,
                response_format=response_format,
                temperature=temperature,
            )

        processing_time = time.time() - start_time
        return self._parse_transcription_result(
            result_data=result_data,
            processing_time=processing_time,
            fallback_language=language,
        )

    async def translate(
        self,
        audio_path: str,
        prompt: Optional[str] = None,
        response_format: str = "verbose_json",
        temperature: float = 0,
    ) -> TranscriptionResult:
        """
        Translate audio to English using configured STT provider.

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

        if self.provider == "whisper_vm":
            return await self.transcribe(
                audio_path=audio_path,
                language="en",
                prompt=prompt,
                response_format=response_format,
                temperature=temperature,
                task="translate",
            )

        start_time = time.time()
        result_data = await self._translate_with_openai(
            audio_path=audio_path,
            prompt=prompt,
            response_format=response_format,
            temperature=temperature,
        )
        processing_time = time.time() - start_time

        parsed = self._parse_transcription_result(
            result_data=result_data,
            processing_time=processing_time,
            fallback_language="en",
        )
        parsed.language = "en"
        return parsed

    async def _transcribe_with_openai(
        self,
        audio_path: str,
        language: Optional[str],
        prompt: Optional[str],
        response_format: str,
        temperature: float,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            with open(audio_path, "rb") as audio_file:
                files = {"file": (os.path.basename(audio_path), audio_file)}

                data = {
                    "model": self.openai_model,
                    "response_format": response_format,
                    "temperature": str(temperature),
                }

                if language:
                    data["language"] = language

                if prompt:
                    data["prompt"] = prompt

                if response_format == "verbose_json":
                    data["timestamp_granularities[]"] = ["word", "segment"]

                response = await client.post(
                    f"{self.openai_base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.openai_api_key}"},
                    files=files,
                    data=data,
                )

        if response.status_code != 200:
            raise Exception(f"Whisper API error: {response.text}")

        return response.json()

    async def _translate_with_openai(
        self,
        audio_path: str,
        prompt: Optional[str],
        response_format: str,
        temperature: float,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            with open(audio_path, "rb") as audio_file:
                files = {"file": (os.path.basename(audio_path), audio_file)}

                data = {
                    "model": self.openai_model,
                    "response_format": response_format,
                    "temperature": str(temperature),
                }

                if prompt:
                    data["prompt"] = prompt

                response = await client.post(
                    f"{self.openai_base_url}/audio/translations",
                    headers={"Authorization": f"Bearer {self.openai_api_key}"},
                    files=files,
                    data=data,
                )

        if response.status_code != 200:
            raise Exception(f"Whisper API error: {response.text}")

        return response.json()

    async def _transcribe_with_vm(
        self,
        audio_path: str,
        language: Optional[str],
        prompt: Optional[str],
        response_format: str,
        task: Optional[str],
    ) -> Dict[str, Any]:
        output_format_map = {
            "verbose_json": "json",
            "json": "json",
            "text": "txt",
            "txt": "txt",
            "vtt": "vtt",
            "srt": "srt",
            "tsv": "tsv",
        }
        output_format = output_format_map.get(response_format, self.vm_output_format)

        params: Dict[str, Any] = {
            "task": task or self.vm_default_task,
            "output": output_format,
            "encode": str(self.vm_encode).lower(),
        }

        if language:
            params["language"] = language

        if self.vm_word_timestamps:
            params["word_timestamps"] = "true"

        if prompt:
            params["initial_prompt"] = prompt

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            with open(audio_path, "rb") as audio_file:
                files = {"audio_file": (os.path.basename(audio_path), audio_file)}
                response = await client.post(
                    f"{self.vm_base_url}/asr",
                    params=params,
                    files=files,
                )

        if response.status_code != 200:
            raise Exception(f"Whisper VM API error: {response.text}")

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()

        return {
            "text": response.text.strip(),
            "language": language,
            "segments": [],
            "words": [],
        }

    def _parse_transcription_result(
        self,
        result_data: Dict[str, Any],
        processing_time: float,
        fallback_language: Optional[str] = None,
    ) -> TranscriptionResult:
        segments = []
        words = []

        for seg in result_data.get("segments", []) or []:
            segments.append(
                TranscriptionSegment(
                    start=float(seg.get("start", 0) or 0),
                    end=float(seg.get("end", 0) or 0),
                    text=str(seg.get("text", "")).strip(),
                )
            )

        for word_data in result_data.get("words", []) or []:
            word_text = word_data.get("word") or word_data.get("text") or ""
            words.append(
                TranscriptionWord(
                    start=float(word_data.get("start", 0) or 0),
                    end=float(word_data.get("end", 0) or 0),
                    word=str(word_text).strip(),
                )
            )

        duration_raw = result_data.get("duration")
        duration = None
        if isinstance(duration_raw, (int, float, str)) and str(duration_raw).strip():
            try:
                duration = float(duration_raw)
            except ValueError:
                duration = None

        text = str(result_data.get("text", "")).strip()
        return TranscriptionResult(
            text=text,
            language=result_data.get("language") or fallback_language,
            segments=segments,
            words=words,
            duration=duration,
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
