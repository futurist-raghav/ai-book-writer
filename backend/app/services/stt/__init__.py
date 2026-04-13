# Speech-to-Text Services

from app.services.stt.whisper_service import (
    WhisperService,
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionWord,
    get_whisper_service,
)

from app.services.stt.gemma4_service import (
    Gemma4Service,
    Gemma4StreamingService,
)

from app.services.stt.factory import (
    get_stt_service,
    get_gemma4_service,
    get_gemma4_streaming_service,
    reset_stt_services,
)

__all__ = [
    # Whisper
    "WhisperService",
    "get_whisper_service",
    # Gemma 4
    "Gemma4Service",
    "Gemma4StreamingService",
    "get_gemma4_service",
    "get_gemma4_streaming_service",
    # Factory
    "get_stt_service",
    "reset_stt_services",
    # Types
    "TranscriptionResult",
    "TranscriptionSegment",
    "TranscriptionWord",
]
