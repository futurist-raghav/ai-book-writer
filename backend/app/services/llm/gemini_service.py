"""
Google Gemini Service

Handles text generation and processing using Google's Gemini API.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiService:
    """Service for text generation using Google Gemini API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini service.

        Args:
            api_key: Google AI API key. If not provided, uses settings.
        """
        if api_key:
            self.api_keys = [api_key]
        else:
            self.api_keys = settings.gemini_api_keys

        if not self.api_keys:
            raise ValueError("At least one Google Gemini API key is required")

        self.model_name = settings.GOOGLE_GEMINI_MODEL
        self._next_key_index = 0
        self._configure_lock = asyncio.Lock()

    @staticmethod
    def _is_key_failover_error(error: Exception) -> bool:
        """Return True when an error indicates the next API key should be tried."""
        error_text = str(error).lower()
        indicators = [
            "rate limit",
            "resource_exhausted",
            "quota",
            "429",
            "too many requests",
            "api key not valid",
            "invalid api key",
            "permission denied",
            "forbidden",
            "unauthenticated",
        ]
        return any(indicator in error_text for indicator in indicators)

    def _ordered_keys_for_attempt(self) -> List[str]:
        """Get keys in round-robin order so traffic is naturally distributed."""
        if len(self.api_keys) == 1:
            return self.api_keys

        start_index = self._next_key_index % len(self.api_keys)
        self._next_key_index = (start_index + 1) % len(self.api_keys)
        return self.api_keys[start_index:] + self.api_keys[:start_index]

    async def _build_model_for_key(
        self,
        api_key: str,
        generation_config: genai.GenerationConfig,
        system_instruction: Optional[str] = None,
    ) -> genai.GenerativeModel:
        """Build a configured Gemini model for a specific API key."""
        async with self._configure_lock:
            genai.configure(api_key=api_key)
            if system_instruction:
                return genai.GenerativeModel(
                    self.model_name,
                    system_instruction=system_instruction,
                    generation_config=generation_config,
                )
            return genai.GenerativeModel(
                self.model_name,
                generation_config=generation_config,
            )

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        json_mode: bool = False,
    ) -> str:
        """
        Generate text using Gemini.

        Args:
            prompt: The prompt to generate from.
            system_instruction: Optional system instruction.
            temperature: Sampling temperature (0-2).
            max_tokens: Maximum tokens to generate.
            json_mode: Whether to expect JSON output.

        Returns:
            Generated text.
        """
        generation_config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        if json_mode:
            generation_config.response_mime_type = "application/json"

        last_error: Optional[Exception] = None
        ordered_keys = self._ordered_keys_for_attempt()

        for index, key in enumerate(ordered_keys):
            try:
                model = await self._build_model_for_key(
                    api_key=key,
                    generation_config=generation_config,
                    system_instruction=system_instruction,
                )
                response = await model.generate_content_async(prompt)
                return response.text or ""
            except Exception as error:  # pragma: no cover - network/provider failures
                last_error = error
                is_last_key = index == len(ordered_keys) - 1
                should_failover = self._is_key_failover_error(error)

                if should_failover and not is_last_key:
                    logger.warning(
                        "Gemini request failed for key index %s, rotating to next key: %s",
                        index,
                        error,
                    )
                    continue

                raise

        if last_error:
            raise last_error

        raise RuntimeError("Gemini generation failed without a specific error")

    async def extract_events(
        self,
        transcription: str,
        user_context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extract narrative events from a transcription.

        Args:
            transcription: The transcribed text.
            user_context: Optional context about the user (writing style, etc.).

        Returns:
            List of extracted events.
        """
        system_instruction = """You are an expert at extracting narrative events from personal stories and memoirs.
        
Your task is to identify discrete events, stories, or experiences from the transcription.
Each event should be a self-contained narrative unit that could potentially become part of a book chapter.

For each event, extract:
- title: A concise, descriptive title
- summary: A brief 1-2 sentence summary
- content: The narrative text of the event, cleaned up and formatted
- category: One of: childhood, education, career, family, relationships, travel, health, achievement, challenge, daily_life, other
- tags: Relevant tags/keywords
- event_date_approximate: Approximate date if mentioned (year, decade, or specific date)
- location: Where the event took place if mentioned
- people: People mentioned with their relationships
- sentiment: positive, negative, neutral, or mixed
- emotions: List of emotions expressed (happy, sad, nostalgic, proud, fearful, etc.)

Output as a JSON array of events."""

        prompt = f"""Analyze this transcription and extract all distinct narrative events:

TRANSCRIPTION:
{transcription}

{f"USER CONTEXT: {json.dumps(user_context)}" if user_context else ""}

Extract events as JSON array with the following structure:
[
  {{
    "title": "string",
    "summary": "string",
    "content": "string",
    "category": "string",
    "tags": ["string"],
    "event_date_approximate": "string or null",
    "location": "string or null",
    "people": [{{"name": "string", "relationship": "string"}}],
    "sentiment": "string",
    "emotions": ["string"]
  }}
]"""

        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.3,  # Lower temperature for more consistent extraction
            max_tokens=8192,
            json_mode=True,
        )

        try:
            events = json.loads(response)
            return events if isinstance(events, list) else []
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re

            json_match = re.search(r"\[[\s\S]*\]", response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return []

    async def format_chapter(
        self,
        events: List[Dict[str, Any]],
        writing_style: str = "narrative",
        tone: Optional[str] = None,
        user_preferences: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Format events into a cohesive chapter.

        Args:
            events: List of events to include in the chapter.
            writing_style: Writing style (narrative, journal, memoir, fiction).
            tone: Desired tone (reflective, humorous, dramatic, etc.).
            user_preferences: User's writing preferences.

        Returns:
            Formatted chapter text.
        """
        system_instruction = f"""You are a skilled writer helping to create memoir and autobiography content.
        
Your task is to take a series of events and weave them into a cohesive, engaging chapter.
Maintain the author's voice while improving flow and readability.

Writing Style: {writing_style}
{f"Tone: {tone}" if tone else ""}

Guidelines:
- Preserve the authentic voice and personal details
- Add smooth transitions between events
- Maintain chronological or thematic flow
- Keep the narrative engaging and readable
- Don't add fictional elements or change facts
- Preserve important quotes and specific details"""

        events_text = "\n\n---\n\n".join(
            [
                f"Event: {e.get('title', 'Untitled')}\n{e.get('content', '')}"
                for e in events
            ]
        )

        prompt = f"""Create a cohesive chapter from these events:

{events_text}

{f"User preferences: {json.dumps(user_preferences)}" if user_preferences else ""}

Write the chapter maintaining smooth transitions and narrative flow."""

        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.7,
            max_tokens=8192,
        )

        return response

    async def improve_text(
        self,
        text: str,
        instructions: str,
    ) -> str:
        """
        Improve or edit text based on instructions.

        Args:
            text: The text to improve.
            instructions: Specific instructions for improvement.

        Returns:
            Improved text.
        """
        system_instruction = """You are a skilled editor helping to improve memoir and autobiography content.
Maintain the author's voice while making the requested improvements.
Don't add fictional elements or change the meaning of the content."""

        prompt = f"""Improve this text following these instructions:

INSTRUCTIONS:
{instructions}

TEXT:
{text}

Provide the improved text:"""

        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.5,
            max_tokens=4096,
        )

        return response


# Singleton instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create the Gemini service singleton."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
