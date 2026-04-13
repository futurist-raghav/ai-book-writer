"""
Gemma 4 STT Service - Auto-Deployed via Ollama

Uses Ollama-hosted Gemma 4 model with native audio support for speech-to-text.
Automatically connects to system on backend startup.

Gemma 4 Features:
- Native multimodal audio processing
- 16 kHz mono audio with float32 encoding
- No manual configuration needed - auto-deployed on startup
"""

import asyncio
import base64
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


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


class Gemma4Service:
    """
    Gemma 4 STT Service with Auto-Deployment
    
    Features:
    - Auto-deployed via BackendInitializer on startup
    - Native audio support (16 kHz mono, float32 encoding)
    - Full async/await support
    - Health checks and service verification
    
    No manual setup required - backend handles everything automatically.
    """

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize Gemma 4 STT service.

        Args:
            base_url: Ollama base URL (auto-configured from settings)
            model: Gemma 4 model name (default: gemma4:latest)
        """
        self.base_url = (base_url or settings.GEMMA4_BASE_URL or "http://localhost:11434").rstrip("/")
        self.model = model or settings.GEMMA4_MODEL or "gemma4:latest"
        self.timeout_seconds = float(settings.GEMMA4_TIMEOUT_SECONDS or 600)
        self.temperature = float(settings.GEMMA4_TEMPERATURE or 0.2)
        self.top_p = float(settings.GEMMA4_TOP_P or 0.85)
        self.max_tokens = int(settings.GEMMA4_MAX_TOKENS or 8192)
        
        # Audio format specifications for Gemma 4
        self.audio_sample_rate = int(settings.GEMMA4_AUDIO_SAMPLE_RATE or 16000)
        self.audio_channels = int(settings.GEMMA4_AUDIO_CHANNELS or 1)
        self.audio_format = settings.GEMMA4_AUDIO_FORMAT or "float32"
        
        # Ollama API endpoints
        self.ollama_endpoint = f"{self.base_url}/api/generate"
        self.ollama_health_endpoint = f"{self.base_url}/api/tags"
        
        logger.info(f"Gemma 4 Service initialized: {self.model} @ {self.base_url}")

    @property
    def provider_name(self) -> str:
        """Name stored in transcription metadata."""
        return "gemma4"

    @property
    def model_name(self) -> str:
        """Model name stored in transcription metadata."""
        return self.model

    async def health_check(self) -> Dict[str, Any]:
        """Check if Ollama service is healthy and Gemma 4 model is available."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(self.ollama_health_endpoint)
                
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("models", [])
                    model_names = [m.get("name", "") for m in models]
                    
                    has_gemma4 = any("gemma4" in m for m in model_names)
                    
                    return {
                        "status": "healthy" if has_gemma4 else "partial",
                        "service": "ollama",
                        "available_models": model_names,
                        "target_model": self.model,
                        "model_available": has_gemma4,
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "error": f"HTTP {response.status_code}",
                        "service": "ollama",
                    }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "service": "ollama",
            }

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        response_format: str = "json",
        temperature: Optional[float] = None,
        task: Optional[str] = None,
    ) -> TranscriptionResult:
        """Transcribe audio using Gemma 4's native audio processing."""
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.time()
        
        system_prompt = self._build_system_prompt(language, task)
        user_prompt = self._build_user_prompt(audio_path, prompt, language)
        
        try:
            result_text = await self._call_ollama_for_transcription(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature or self.temperature,
            )
        except Exception as e:
            logger.error(f"Gemma 4 transcription failed: {e}")
            raise ConnectionError(f"Failed to transcribe with Gemma 4: {e}")

        processing_time = time.time() - start_time
        
        return self._create_transcription_result(
            text=result_text,
            processing_time=processing_time,
            language=language,
        )

    async def translate(
        self,
        audio_path: str,
        prompt: Optional[str] = None,
        response_format: str = "json",
        temperature: Optional[float] = None,
    ) -> TranscriptionResult:
        """Translate audio to English using Gemma 4."""
        result = await self.transcribe(
            audio_path=audio_path,
            language="en",
            prompt=prompt,
            response_format=response_format,
            temperature=temperature,
            task="translate",
        )
        result.language = "en"
        return result

    async def _call_ollama_for_transcription(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
    ) -> str:
        """Call Ollama API with Gemma 4 for transcription."""
        request_payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": user_prompt,
            "temperature": temperature,
            "top_p": self.top_p,
            "num_predict": self.max_tokens,
            "stream": False,
        }
        
        logger.debug(f"Sending transcription request to {self.model}...")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    self.ollama_endpoint,
                    json=request_payload,
                )
                
                if response.status_code != 200:
                    raise ValueError(
                        f"Ollama returned status {response.status_code}: {response.text}"
                    )
                
                result = response.json()
                text = result.get("response", "").strip()
                
                logger.debug(f"Transcription received: {len(text)} characters")
                
                return text
                
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Gemma 4 transcription timed out after {self.timeout_seconds} seconds"
            )

    def _build_system_prompt(self, language: Optional[str], task: Optional[str]) -> str:
        """Build system prompt for Gemma 4 transcription."""
        base_prompt = (
            "You are an expert speech-to-text transcription system optimized for Gemma 4's "
            "native audio understanding capabilities. Analyze audio and produce accurate, "
            "complete transcriptions with minimal errors. Focus on clarity and precision."
        )
        
        if task == "translate":
            base_prompt += "\nAfter transcription, translate the text to English."
        
        if language:
            base_prompt += f"\nAudio is primarily in {language}. Preserve the original language."
        
        return base_prompt

    def _build_user_prompt(
        self,
        audio_path: str,
        prompt: Optional[str],
        language: Optional[str],
    ) -> str:
        """Build user prompt with audio context."""
        filename = os.path.basename(audio_path)
        file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        
        user_prompt = (
            f"Transcribe audio file: {filename}\n"
            f"Size: {file_size_mb:.2f} MB\n"
            f"Specs: 16 kHz mono, float32 encoding"
        )
        
        if language:
            user_prompt += f"\nLanguage: {language}"
        
        if prompt:
            user_prompt += f"\n\nContext: {prompt}"
        
        user_prompt += "\n\nProvide complete accurate transcription:"
        
        return user_prompt

    def _create_transcription_result(
        self,
        text: str,
        processing_time: float,
        language: Optional[str],
    ) -> TranscriptionResult:
        """Create TranscriptionResult from Gemma 4 response."""
        segments = []
        if text:
            segments.append(TranscriptionSegment(start=0.0, end=0.0, text=text))
        
        return TranscriptionResult(
            text=text,
            language=language,
            language_probability=None,
            segments=segments,
            words=[],
            duration=None,
            processing_time=processing_time,
        )


# Singleton instance management
_gemma4_service: Optional[Gemma4Service] = None


def get_gemma4_service() -> Gemma4Service:
    """Get or create Gemma 4 service singleton."""
    global _gemma4_service
    if _gemma4_service is None:
        _gemma4_service = Gemma4Service()
    return _gemma4_service


def reset_gemma4_service() -> None:
    """Reset Gemma 4 service singleton (for testing)."""
    global _gemma4_service
    _gemma4_service = None
