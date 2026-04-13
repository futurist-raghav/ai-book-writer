"""
Health Check Endpoints

Provides health check endpoints for various services, including STT providers.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str
    timestamp: str
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class STTHealthResponse(BaseModel):
    """STT service health response."""
    status: str
    provider: str
    available: bool
    model: str
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    General health check endpoint.
    
    Returns:
        HealthResponse with service status
    """
    from datetime import datetime
    return HealthResponse(
        status="healthy",
        service="ai-book-writer-backend",
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/health/stt", response_model=STTHealthResponse)
async def stt_health_check():
    """
    Speech-to-Text service health check.
    
    Returns health status of configured STT provider.
    
    Returns:
        STTHealthResponse with provider details
    """
    from app.services.stt.factory import get_stt_service
    
    try:
        service = get_stt_service()
        provider = settings.STT_PROVIDER or settings.PREFERRED_STT_SERVICE
        
        return STTHealthResponse(
            status="healthy",
            provider=provider,
            available=True,
            model=service.model_name,
            details={
                "provider_name": service.provider_name,
                "model": service.model_name,
            },
        )
    except Exception as e:
        return STTHealthResponse(
            status="unhealthy",
            provider=settings.STT_PROVIDER or settings.PREFERRED_STT_SERVICE,
            available=False,
            model="unknown",
            error=str(e),
        )


@router.get("/health/gemma4", response_model=STTHealthResponse)
async def gemma4_health_check():
    """
    Gemma 4 STT service health check.
    
    Checks if Ollama and Gemma model are available.
    
    Returns:
        STTHealthResponse with Gemma 4 status
    
    Raises:
        HTTPException: If Gemma 4 is not configured
    """
    if not settings.GEMMA4_BASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemma 4 is not configured (GEMMA4_BASE_URL not set)",
        )
    
    try:
        from app.services.stt.factory import get_gemma4_service
        
        service = get_gemma4_service()
        health = await service.health_check()
        
        return STTHealthResponse(
            status=health.get("status", "unknown"),
            provider="gemma4",
            available=health.get("status") == "healthy",
            model=settings.GEMMA4_MODEL,
            details=health,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gemma 4 configuration error: {str(e)}",
        )
    except Exception as e:
        return STTHealthResponse(
            status="unhealthy",
            provider="gemma4",
            available=False,
            model=settings.GEMMA4_MODEL,
            error=str(e),
        )


@router.get("/health/whisper", response_model=STTHealthResponse)
async def whisper_health_check():
    """
    Whisper STT service health check.
    
    Checks if Whisper service is available (OpenAI or self-hosted).
    
    Returns:
        STTHealthResponse with Whisper status
    """
    provider = "openai" if settings.STT_PROVIDER == "openai" else "whisper_vm"
    
    try:
        if settings.STT_PROVIDER == "openai":
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not configured")
            
            return STTHealthResponse(
                status="healthy" if settings.OPENAI_API_KEY else "unhealthy",
                provider=provider,
                available=bool(settings.OPENAI_API_KEY),
                model="whisper-1",
                details={
                    "api_key_configured": bool(settings.OPENAI_API_KEY),
                    "model": "whisper-1",
                    "endpoint": "https://api.openai.com/v1",
                },
            )
        else:
            if not settings.WHISPER_VM_BASE_URL:
                raise ValueError("WHISPER_VM_BASE_URL not configured")
            
            # Try to reach the Whisper VM
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                try:
                    response = await client.get(
                        f"{settings.WHISPER_VM_BASE_URL}/health"
                    )
                    is_healthy = response.status_code == 200
                except Exception:
                    is_healthy = False
            
            return STTHealthResponse(
                status="healthy" if is_healthy else "unhealthy",
                provider=provider,
                available=is_healthy,
                model=settings.WHISPER_VM_MODEL_NAME,
                details={
                    "base_url": settings.WHISPER_VM_BASE_URL,
                    "model": settings.WHISPER_VM_MODEL_NAME,
                },
            )
    except Exception as e:
        return STTHealthResponse(
            status="unhealthy",
            provider=provider,
            available=False,
            model="unknown",
            error=str(e),
        )
