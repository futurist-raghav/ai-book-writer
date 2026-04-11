from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import asyncio
import json
from app.db.database import get_session
from app.middleware.auth import verify_auth
from app.services.ai_agents import (
    research_agent,
    factcheck_agent,
    tone_analyze_agent,
    citation_agent,
)

router = APIRouter(prefix="/ai/agents", tags=["AI Agents"])

async def stream_response(generator):
    """Stream JSON responses line by line"""
    try:
        async for chunk in generator:
            if chunk:
                yield json.dumps({"data": chunk}).encode() + b"\n"
    except Exception as e:
        yield json.dumps({"error": str(e)}).encode() + b"\n"

@router.post("/research/stream")
async def research_stream(
    data: dict,
    session = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Stream research results as they're found"""
    topic = data.get("topic")
    if not topic:
        raise HTTPException(status_code=400, detail="Topic required")
    
    async def generate():
        async for chunk in research_agent.stream(topic, current_user.id):
            yield chunk
    
    return StreamingResponse(
        stream_response(generate()),
        media_type="application/x-ndjson"
    )

@router.post("/factcheck/stream")
async def factcheck_stream(
    data: dict,
    session = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Stream fact-check results as they're verified"""
    text = data.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    
    async def generate():
        async for chunk in factcheck_agent.stream(text, current_user.id):
            yield chunk
    
    return StreamingResponse(
        stream_response(generate()),
        media_type="application/x-ndjson"
    )

@router.post("/tone/stream")
async def tone_stream(
    data: dict,
    session = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Stream tone analysis as text is processed"""
    text = data.get("text")
    genre = data.get("genre", "fiction")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    
    async def generate():
        async for chunk in tone_analyze_agent.stream(text, genre, current_user.id):
            yield chunk
    
    return StreamingResponse(
        stream_response(generate()),
        media_type="application/x-ndjson"
    )

@router.post("/cite/stream")
async def cite_stream(
    data: dict,
    session = Depends(get_session),
    current_user = Depends(verify_auth),
):
    """Stream bibliography generation as citations are created"""
    sources = data.get("sources", [])
    style = data.get("style", "APA")
    
    if not sources:
        raise HTTPException(status_code=400, detail="Sources required")
    
    async def generate():
        async for chunk in citation_agent.stream(sources, style, current_user.id):
            yield chunk
    
    return StreamingResponse(
        stream_response(generate()),
        media_type="application/x-ndjson"
    )
