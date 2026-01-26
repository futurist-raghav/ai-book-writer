"""
Anthropic Claude Service

Handles advanced text generation and book assembly using Claude API.
"""

import json
from typing import Any, Dict, List, Optional

import anthropic

from app.core.config import settings


class ClaudeService:
    """Service for text generation using Anthropic Claude API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Claude service.

        Args:
            api_key: Anthropic API key. If not provided, uses settings.
        """
        self.api_key = api_key or settings.ANTHROPIC_API_KEY

        if not self.api_key:
            raise ValueError("Anthropic API key is required for Claude service")

        self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-20250514"

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """
        Generate text using Claude.

        Args:
            prompt: The prompt to generate from.
            system: Optional system prompt.
            temperature: Sampling temperature (0-1).
            max_tokens: Maximum tokens to generate.

        Returns:
            Generated text.
        """
        messages = [{"role": "user", "content": prompt}]

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            messages=messages,
        )

        return response.content[0].text

    async def assemble_book(
        self,
        chapters: List[Dict[str, Any]],
        book_metadata: Dict[str, Any],
        front_matter: Optional[Dict[str, str]] = None,
        back_matter: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Assemble chapters into a complete book with proper flow.

        Args:
            chapters: List of chapter content with metadata.
            book_metadata: Book title, author, description, etc.
            front_matter: Optional dedication, preface, etc.
            back_matter: Optional epilogue, afterword, etc.

        Returns:
            Assembled book content.
        """
        system = """You are an expert book editor specializing in memoirs and autobiographies.
        
Your task is to assemble chapters into a cohesive book, ensuring:
- Smooth transitions between chapters
- Consistent voice and tone throughout
- Proper pacing and narrative arc
- Engaging opening and satisfying conclusion
- No factual changes to the author's stories"""

        # Build chapter list
        chapters_text = ""
        for i, ch in enumerate(chapters, 1):
            chapters_text += f"\n\n{'='*60}\nCHAPTER {i}: {ch.get('title', 'Untitled')}\n{'='*60}\n\n"
            chapters_text += ch.get("content", "")

        prompt = f"""Assemble these chapters into a cohesive book:

BOOK METADATA:
Title: {book_metadata.get('title', 'Untitled')}
Author: {book_metadata.get('author_name', 'Unknown')}
Description: {book_metadata.get('description', '')}

{f"FRONT MATTER: {json.dumps(front_matter)}" if front_matter else ""}

CHAPTERS:
{chapters_text}

{f"BACK MATTER: {json.dumps(back_matter)}" if back_matter else ""}

Please:
1. Review the overall narrative arc
2. Suggest and add brief transition paragraphs between chapters if needed
3. Ensure the opening is engaging
4. Ensure the conclusion is satisfying
5. Maintain the author's voice throughout

Provide the assembled book with any necessary transitions."""

        response = await self.generate(
            prompt=prompt,
            system=system,
            temperature=0.5,
            max_tokens=16384,
        )

        return response

    async def generate_front_matter(
        self,
        book_content_summary: str,
        book_metadata: Dict[str, Any],
        matter_type: str,  # dedication, acknowledgments, preface, introduction
    ) -> str:
        """
        Generate front matter for a book.

        Args:
            book_content_summary: Summary of book content.
            book_metadata: Book metadata.
            matter_type: Type of front matter to generate.

        Returns:
            Generated front matter text.
        """
        prompts = {
            "dedication": """Write a heartfelt dedication for this book. It should be personal and meaningful.
Keep it brief (1-3 sentences).""",
            "acknowledgments": """Write acknowledgments for this book. Include thanks to those who helped
with the stories and writing process. Keep it genuine and personal (1-2 paragraphs).""",
            "preface": """Write a preface explaining why this book was written and what readers can expect.
Include the author's motivation and the significance of sharing these stories (2-3 paragraphs).""",
            "introduction": """Write an introduction that sets the stage for the stories that follow.
Provide context about the time period, setting, or themes (2-4 paragraphs).""",
        }

        system = """You are helping an author create front matter for their memoir.
Write in first person from the author's perspective.
Keep the tone authentic and personal.
Don't invent specific names or details not provided."""

        prompt = f"""Create {matter_type} for this book:

BOOK: {book_metadata.get('title', 'Untitled')}
AUTHOR: {book_metadata.get('author_name', 'The Author')}
ABOUT: {book_metadata.get('description', '')}

BOOK SUMMARY:
{book_content_summary}

{prompts.get(matter_type, 'Generate appropriate front matter.')}"""

        response = await self.generate(
            prompt=prompt,
            system=system,
            temperature=0.7,
            max_tokens=2048,
        )

        return response

    async def quality_review(
        self,
        text: str,
        review_type: str = "general",
    ) -> Dict[str, Any]:
        """
        Review text for quality and provide suggestions.

        Args:
            text: Text to review.
            review_type: Type of review (general, grammar, flow, consistency).

        Returns:
            Review results with suggestions.
        """
        system = """You are a professional book editor reviewing memoir content.
Provide constructive feedback to improve the writing while preserving the author's voice.
Don't suggest adding fictional elements."""

        review_instructions = {
            "general": "Provide overall feedback on the writing quality, engagement, and areas for improvement.",
            "grammar": "Focus on grammar, punctuation, and sentence structure issues.",
            "flow": "Analyze the narrative flow, pacing, and transitions.",
            "consistency": "Check for consistency in voice, tone, and factual details.",
        }

        prompt = f"""Review this text and provide feedback:

{review_instructions.get(review_type, review_instructions['general'])}

TEXT:
{text}

Provide your review as JSON:
{{
  "overall_score": 1-10,
  "strengths": ["list of strengths"],
  "areas_for_improvement": ["list of areas to improve"],
  "specific_suggestions": [
    {{"location": "quote or description", "issue": "what's wrong", "suggestion": "how to fix"}}
  ],
  "summary": "brief overall summary"
}}"""

        response = await self.generate(
            prompt=prompt,
            system=system,
            temperature=0.3,
            max_tokens=4096,
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"summary": response, "overall_score": 0}


# Singleton instance
_claude_service: Optional[ClaudeService] = None


def get_claude_service() -> ClaudeService:
    """Get or create the Claude service singleton."""
    global _claude_service
    if _claude_service is None:
        _claude_service = ClaudeService()
    return _claude_service
