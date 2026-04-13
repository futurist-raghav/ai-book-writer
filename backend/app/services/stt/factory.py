"""
STT Service Factory

Provides factory functions for creating and managing Speech-to-Text services.
Supports multiple providers: OpenAI Whisper, self-hosted Whisper, and Gemma 4.
"""

from typing import Optional, Union

from app.core.config import settings
from app.services.stt.whisper_service import WhisperService
from app.services.stt.gemma4_service import Gemma4Service, Gemma4StreamingService


# Service singletons
_stt_service: Optional[Union[WhisperService, Gemma4Service]] = None
_gemma4_service: Optional[Gemma4Service] = None
_gemma4_streaming_service: Optional[Gemma4StreamingService] = None


def get_stt_service() -> Union[WhisperService, Gemma4Service]:
    """
    Get or create the configured STT service singleton.
    
    Selection based on STT_PROVIDER:
    - 'openai': WhisperService with OpenAI Whisper API
    - 'whisper_vm': WhisperService with self-hosted Whisper
    - 'gemma4': Gemma4Service with Ollama-hosted Gemma
    
    Returns:
        WhisperService or Gemma4Service instance
    
    Raises:
        ValueError: If provider configuration is incomplete
    """
    global _stt_service
    
    if _stt_service is not None:
        return _stt_service
    
    provider = (settings.STT_PROVIDER or settings.PREFERRED_STT_SERVICE).strip().lower()
    
    if provider == "gemma4":
        _stt_service = Gemma4Service(
            base_url=settings.GEMMA4_BASE_URL,
            model=settings.GEMMA4_MODEL,
        )
    else:
        # Default to Whisper (openai or whisper_vm)
        _stt_service = WhisperService()
    
    return _stt_service


def get_gemma4_service() -> Gemma4Service:
    """
    Get or create the Gemma 4 service singleton.
    
    Returns:
        Gemma4Service instance
    
    Raises:
        ValueError: If Gemma 4 is not properly configured
    """
    global _gemma4_service
    
    if _gemma4_service is None:
        _gemma4_service = Gemma4Service(
            base_url=settings.GEMMA4_BASE_URL,
            model=settings.GEMMA4_MODEL,
        )
    
    return _gemma4_service


def get_gemma4_streaming_service() -> Gemma4StreamingService:
    """
    Get or create the Gemma 4 streaming service singleton.
    
    Returns:
        Gemma4StreamingService instance
    
    Raises:
        ValueError: If Gemma 4 is not properly configured
    """
    global _gemma4_streaming_service
    
    if _gemma4_streaming_service is None:
        _gemma4_streaming_service = Gemma4StreamingService(
            base_url=settings.GEMMA4_BASE_URL,
            model=settings.GEMMA4_MODEL,
        )
    
    return _gemma4_streaming_service


def get_whisper_service() -> WhisperService:
    """
    Get or create the Whisper service singleton.
    
    Returns:
        WhisperService instance
    """
    svc = get_stt_service()
    if isinstance(svc, WhisperService):
        return svc
    raise RuntimeError("Current STT provider is not Whisper")


def reset_stt_services() -> None:
    """
    Reset all STT service singletons.
    Useful for testing or configuration changes.
    """
    global _stt_service, _gemma4_service, _gemma4_streaming_service
    _stt_service = None
    _gemma4_service = None
    _gemma4_streaming_service = None
