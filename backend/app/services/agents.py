"""
Premium AI Agents Service

Provides specialized AI capabilities:
- Research Agent: Gather curated information on topics
- Fact-Checker Agent: Verify claims in manuscripts
- Tone Coach Agent: Analyze and suggest tone improvements
- Citation Agent: Generate bibliography from research
"""

import json
from typing import Optional
import anthropic  # Using Claude if available, fallback to Gemini

# Initialize Claude client (or Gemini as fallback)
try:
    ai_client = anthropic.Anthropic()
    AI_MODEL = "claude-3-5-sonnet-20241022"
except:
    # Fallback to Gemini
    import google.generativeai as genai
    AI_MODEL = "gemini-2.0-flash"


class ResearchAgent:
    """Research Assistant Agent - Gather curated information on topics"""
    
    @staticmethod
    async def execute(topic: str, context_length: int = 2000) -> dict:
        """
        Research a topic and return curated sources, facts, and citations.
        
        Args:
            topic: Topic to research
            context_length: Max length of returned context
            
        Returns:
            {
                "topic": str,
                "summary": str,
                "facts": [{"fact": str, "confidence": 0-1}],
                "sources": [{"title": str, "url": str, "relevance": 0-1}],
                "citations": [{"text": str, "authors": [...], "year": int}]
            }
        """
        prompt = f"""You are a research assistant. Research the following topic and provide:
1. A brief summary (2-3 sentences)
2. Key facts with confidence levels (5-7 facts)
3. Recommended sources (3-5 sources with URLs if possible)
4. Citation-ready summaries

Topic: {topic}

Return as JSON with keys: summary, facts, sources, citations"""

        try:
            message = ai_client.messages.create(
                model=AI_MODEL,
                max_tokens=context_length,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse JSON response
            response_text = message.content[0].text
            # Try to extract JSON from response
            try:
                result = json.loads(response_text)
            except:
                # If not valid JSON, structure it
                result = {
                    "summary": response_text[:500],
                    "facts": [],
                    "sources": [],
                    "citations": []
                }
            
            result["topic"] = topic
            return result
        except Exception as e:
            return {
                "topic": topic,
                "error": str(e),
                "summary": "",
                "facts": [],
                "sources": [],
                "citations": []
            }


class FactCheckerAgent:
    """Fact-Checker Agent - Verify claims in manuscripts"""
    
    @staticmethod
    async def execute(text_snippet: str, knowledge_domain: str = "general") -> dict:
        """
        Fact-check a manuscript snippet.
        
        Args:
            text_snippet: Text to fact-check
            knowledge_domain: Domain for fact-checking (general, historical, scientific, etc.)
            
        Returns:
            {
                "snippet": str,
                "claims": [{"claim": str, "verified": bool, "evidence": str, "confidence": 0-1}],
                "overall_accuracy": 0-1,
                "suggestions": [str]
            }
        """
        prompt = f"""You are a fact-checker. Analyze the following text and identify key claims. 
For each claim, indicate if it's verified, disputed, or uncertain.

Domain: {knowledge_domain}

Text to check:
{text_snippet}

Return as JSON with keys: claims (array of {{claim, verified, evidence, confidence}}), overall_accuracy, suggestions"""

        try:
            message = ai_client.messages.create(
                model=AI_MODEL,
                max_tokens=1500,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = message.content[0].text
            try:
                result = json.loads(response_text)
            except:
                result = {
                    "claims": [],
                    "overall_accuracy": 0.5,
                    "suggestions": [response_text[:200]]
                }
            
            result["snippet"] = text_snippet[:200]
            return result
        except Exception as e:
            return {
                "snippet": text_snippet[:200],
                "error": str(e),
                "claims": [],
                "overall_accuracy": 0,
                "suggestions": []
            }


class ToneCoachAgent:
    """Tone Coach Agent - Analyze and suggest tone improvements"""
    
    @staticmethod
    async def execute(text: str, genre: str = "novel", project_type: str = "novel") -> dict:
        """
        Analyze tone and suggest improvements.
        
        Args:
            text: Text to analyze
            genre: Genre (fantasy, mystery, romance, etc.)
            project_type: Project type (novel, screenplay, academic, etc.)
            
        Returns:
            {
                "detected_tone": str,
                "tone_qualities": [str],
                "suggestions": [{"issue": str, "suggestion": str, "alternative": str}],
                "matches_genre": bool,
                "improvements": [str]
            }
        """
        prompt = f"""You are a tone coach for {project_type} writers. Analyze the tone of this text and provide feedback.

Genre: {genre}
Project Type: {project_type}

Text:
{text}

Return as JSON with keys: 
- detected_tone (1-2 words describing tone)
- tone_qualities (array of descriptors)
- suggestions (array of {{issue, suggestion, alternative}})
- matches_genre (boolean)
- improvements (array of specific improvements)"""

        try:
            message = ai_client.messages.create(
                model=AI_MODEL,
                max_tokens=1200,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = message.content[0].text
            try:
                result = json.loads(response_text)
            except:
                result = {
                    "detected_tone": "neutral",
                    "tone_qualities": [],
                    "suggestions": [],
                    "matches_genre": True,
                    "improvements": [response_text[:300]]
                }
            
            return result
        except Exception as e:
            return {
                "error": str(e),
                "detected_tone": "error",
                "tone_qualities": [],
                "suggestions": [],
                "matches_genre": False,
                "improvements": []
            }


class CitationAgent:
    """Citation Agent - Generate bibliography from research results"""
    
    @staticmethod
    async def execute(research_results: str, citation_style: str = "APA") -> dict:
        """
        Generate citations from research results.
        
        Args:
            research_results: Search/research results to cite
            citation_style: Citation style (APA, MLA, Chicago, Harvard)
            
        Returns:
            {
                "style": str,
                "citations": [str],  # Formatted citations
                "bibliography_entries": [{"text": str, "source": str, "authors": [str]}]
            }
        """
        prompt = f"""Extract bibliographic information and generate {citation_style} citations from this research:

{research_results}

Return as JSON with keys:
- style (citation style used)
- citations (array of formatted citations in {citation_style} style)  
- bibliography_entries (array of {{text, source, authors}})"""

        try:
            message = ai_client.messages.create(
                model=AI_MODEL,
                max_tokens=1500,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = message.content[0].text
            try:
                result = json.loads(response_text)
            except:
                result = {
                    "style": citation_style,
                    "citations": [response_text[:300]],
                    "bibliography_entries": []
                }
            
            return result
        except Exception as e:
            return {
                "error": str(e),
                "style": citation_style,
                "citations": [],
                "bibliography_entries": []
            }


# Agent registry
AGENTS = {
    "research": ResearchAgent,
    "fact-check": FactCheckerAgent,
    "tone-analyze": ToneCoachAgent,
    "cite": CitationAgent,
}
