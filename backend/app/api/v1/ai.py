"""
AI Assistant API Routes

Provides AI-powered writing assistance with project context awareness.
Integrates Claude for intelligent chapter writing, character development,
world building guidance, and more.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from app.core.dependencies import get_current_user
import anthropic

router = APIRouter()

# Initialize Anthropic client
client = anthropic.Anthropic()


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class AiChatRequest(BaseModel):
    messages: List[ChatMessage]
    system: str
    chapter_id: Optional[str] = None
    assistance_type: str = 'general'  # general, character, world, dialogue, plot


class AiChatResponse(BaseModel):
    response: str
    tokens_used: Optional[int] = None
    chapter_id: Optional[str] = None


@router.post("/chat", response_model=AiChatResponse)
async def chat_with_ai(
    request: AiChatRequest,
    current_user = Depends(get_current_user),
):
    """
    Chat with Claude about the current writing project.
    
    The AI has access to:
    - Project metadata (genre, themes, writing style, tone)
    - Current chapter content and synopsis
    - All characters and their relationships
    - World building elements
    - Events and their connections
    - Recent audio notes and transcriptions
    
    The AI can provide specialized assistance based on:
    - Character consistency and development
    - Plot suggestions and event sequencing
    - Dialogue writing with character voice
    - World building coherence
    - Genre-specific guidance
    - Cross-chapter continuity
    """
    
    try:
        # Convert our message format to Anthropic format
        messages_for_api = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # Call Claude API
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",  # Use your preferred Claude model
            max_tokens=2048,
            system=request.system,
            messages=messages_for_api,
        )
        
        # Extract the response
        assistant_message = response.content[0].text
        
        return AiChatResponse(
            response=assistant_message,
            tokens_used=response.usage.output_tokens if hasattr(response, 'usage') else None,
            chapter_id=request.chapter_id,
        )
        
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI API Error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Chat Error: {str(e)}"
        )


class StyleGuideRequest(BaseModel):
    """Generate a style guide based on project metadata"""
    genres: List[str]
    themes: List[str]
    book_type: str
    writing_form: str  # narrative, memoir, chronological, descriptive
    writing_tone: str  # neutral, reflective, dramatic, analytical
    target_audience: Optional[str] = None


class StyleGuideResponse(BaseModel):
    """Generated style guide for the book"""
    title: str
    overview: str
    character_guidelines: str
    dialogue_guidelines: str
    pacing_guidelines: str
    tone_guidelines: str
    genre_specific_tips: str


@router.post("/style-guide", response_model=StyleGuideResponse)
async def generate_style_guide(
    request: StyleGuideRequest,
    current_user = Depends(get_current_user),
):
    """
    Generate a comprehensive style guide for the project based on genre, themes, and writing preferences.
    
    This helps maintain consistency across the manuscript and provides Claude with clear guidelines.
    """
    
    try:
        prompt = f"""Generate a detailed style guide for a {', '.join(request.genres)} book with the following specifications:

BOOK TYPE: {request.book_type}
THEMES: {', '.join(request.themes)}
WRITING FORM: {request.writing_form}
TONE: {request.writing_tone}
TARGET AUDIENCE: {request.target_audience or 'General'}

Provide guidance on:
1. Character Development: How characters should be portrayed and developed
2. Dialogue: Guidelines for character dialogue and voice
3. Pacing: How to structure scenes and maintain momentum
4. Tone: How to maintain the specified tone throughout
5. Genre-Specific Tips: Best practices for this combination of genres

Format the response as clear, actionable sections."""

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        guide_text = response.content[0].text
        
        # Parse the response into sections
        sections = {
            "title": f"Style Guide: {', '.join(request.genres)}",
            "overview": guide_text[:500],
            "character_guidelines": extract_section(guide_text, "Character"),
            "dialogue_guidelines": extract_section(guide_text, "Dialogue"),
            "pacing_guidelines": extract_section(guide_text, "Pacing"),
            "tone_guidelines": extract_section(guide_text, "Tone"),
            "genre_specific_tips": extract_section(guide_text, "Genre"),
        }
        
        return StyleGuideResponse(**sections)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Style Guide Generation Error: {str(e)}"
        )


class WritingPromptsRequest(BaseModel):
    """Generate writing prompts for a specific chapter"""
    chapter_title: str
    genre: List[str]
    themes: List[str]
    character_names: Optional[List[str]] = None
    world_context: Optional[str] = None
    tone: str = "neutral"


class WritingPrompt(BaseModel):
    prompt: str
    difficulty: str  # easy, medium, hard
    estimated_words: int


class WritingPromptsResponse(BaseModel):
    prompts: List[WritingPrompt]


@router.post("/writing-prompts", response_model=WritingPromptsResponse)
async def generate_writing_prompts(
    request: WritingPromptsRequest,
    current_user = Depends(get_current_user),
):
    """
    Generate 3 writing prompts to help kickstart chapter writing.
    
    Prompts are customized based on:
    - Chapter title and context
    - Genre and themes
    - Involved characters
    - World building context
    - Desired tone
    """
    
    try:
        character_context = f"\nKey Characters: {', '.join(request.character_names)}" if request.character_names else ""
        world_context = f"\nWorld Context: {request.world_context}" if request.world_context else ""
        
        prompt = f"""Generate 3 writing prompts for the following chapter:

CHAPTER TITLE: {request.chapter_title}
GENRES: {', '.join(request.genre)}
THEMES: {', '.join(request.themes)}
TONE: {request.tone}{character_context}{world_context}

Create prompts that:
1. Are specific to this chapter but leave room for creativity
2. Incorporate the characters and world context
3. Guide the writer toward exploring the themes
4. Vary in difficulty (easy, medium, hard)

For each prompt, estimate the word count needed to adequately address it.

Format as:
PROMPT 1 (Difficulty: Easy, ~500 words):
[prompt text]

PROMPT 2 (Difficulty: Medium, ~1000 words):
[prompt text]

PROMPT 3 (Difficulty: Hard, ~2000 words):
[prompt text]"""

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        prompts_text = response.content[0].text
        prompts = parse_writing_prompts(prompts_text)
        
        return WritingPromptsResponse(prompts=prompts)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Writing Prompts Generation Error: {str(e)}"
        )


# ==================== HELPER FUNCTIONS ====================

def extract_section(text: str, section_name: str) -> str:
    """Extract a section from the generated guide text."""
    lines = text.split('\n')
    section_text = []
    in_section = False
    
    for line in lines:
        if section_name.lower() in line.lower():
            in_section = True
            continue
        if in_section:
            if line.startswith('#') or line.startswith('---'):
                break
            section_text.append(line)
    
    return '\n'.join(section_text).strip()[:1000]  # Limit to 1000 chars


def parse_writing_prompts(text: str) -> List[WritingPrompt]:
    """Parse writing prompts from Claude response."""
    prompts = []
    
    sections = text.split('PROMPT')
    for i, section in enumerate(sections[1:], 1):  # Skip the first empty split
        lines = section.strip().split('\n', 1)
        if len(lines) >= 2:
            header = lines[0]
            content = lines[1]
            
            difficulty = "medium"
            if "easy" in header.lower():
                difficulty = "easy"
            elif "hard" in header.lower():
                difficulty = "hard"
            
            words = 500  # Default
            if "~" in header:
                try:
                    words = int(header.split("~")[1].split()[0])
                except (IndexError, ValueError):
                    pass
            
            prompts.append(WritingPrompt(
                prompt=content.strip(),
                difficulty=difficulty,
                estimated_words=words
            ))
    
    return prompts
