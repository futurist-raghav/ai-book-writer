from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.agents import AGENTS, ResearchAgent, FactCheckerAgent, ToneCoachAgent, CitationAgent
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai/agents", tags=["AI Agents"])


# Request/Response Models
class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    context_length: int = Field(default=2000, ge=500, le=5000)
    

class ResearchResponse(BaseModel):
    topic: str
    summary: str
    facts: list = []
    sources: list = []
    citations: list = []


class FactCheckRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=5000)
    knowledge_domain: str = Field(default="general", max_length=100)


class FactCheckResponse(BaseModel):
    snippet: str
    claims: list = []
    overall_accuracy: float
    suggestions: list = []


class ToneAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=5000)
    genre: str = Field(default="novel", max_length=100)
    project_type: str = Field(default="novel", max_length=100)


class ToneAnalyzeResponse(BaseModel):
    detected_tone: str
    tone_qualities: list = []
    suggestions: list = []
    matches_genre: bool
    improvements: list = []


class CitationRequest(BaseModel):
    research_results: str = Field(..., min_length=50, max_length=10000)
    citation_style: str = Field(default="APA", regex="^(APA|MLA|Chicago|Harvard)$")


class CitationResponse(BaseModel):
    style: str
    citations: list = []
    bibliography_entries: list = []


# ============================================================================
# RESEARCH AGENT
# ============================================================================

@router.post("/research", response_model=ResearchResponse)
async def research(
    request: ResearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Research a topic using the AI Research Agent"""
    try:
        result = await ResearchAgent.execute(
            topic=request.topic,
            context_length=request.context_length
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")


# ============================================================================
# FACT-CHECKER AGENT
# ============================================================================

@router.post("/fact-check", response_model=FactCheckResponse)
async def fact_check(
    request: FactCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fact-check manuscript text using the Fact-Checker Agent"""
    try:
        result = await FactCheckerAgent.execute(
            text_snippet=request.text,
            knowledge_domain=request.knowledge_domain
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fact-checking failed: {str(e)}")


# ============================================================================
# TONE COACH AGENT
# ============================================================================

@router.post("/tone-analyze", response_model=ToneAnalyzeResponse)
async def tone_analyze(
    request: ToneAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze text tone using the Tone Coach Agent"""
    try:
        result = await ToneCoachAgent.execute(
            text=request.text,
            genre=request.genre,
            project_type=request.project_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tone analysis failed: {str(e)}")


# ============================================================================
# CITATION AGENT
# ============================================================================

@router.post("/cite", response_model=CitationResponse)
async def cite(
    request: CitationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate citations from research results"""
    try:
        result = await CitationAgent.execute(
            research_results=request.research_results,
            citation_style=request.citation_style
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Citation generation failed: {str(e)}")
