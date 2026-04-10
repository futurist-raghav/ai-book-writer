"""Glossary extraction service for P3.8.

Analyzes chapters and extracts potential glossary terms using:
- Capitalization patterns (proper nouns)
- Frequency analysis
- Contextual relevance
- NLP-style detection (common definitions)
"""

import re
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict, Counter
import time
from sqlalchemy.orm import Session
from app.models import GlossaryEntry, Chapter, Book


# Common words to exclude from glossary extraction
COMMON_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'that',
    'this', 'those', 'these', 'which', 'who', 'whom', 'what', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'either',
    'neither', 'some', 'any', 'much', 'many', 'most', 'least', 'more',
    'less', 'such', 'no', 'not', 'only', 'my', 'your', 'his', 'her',
    'its', 'our', 'their', 'what', 'which', 'who', 'it', 'he', 'she',
    'we', 'they', 'i', 'me', 'him', 'us', 'them', 'then', 'than',
    'there', 'down', 'up', 'out', 'just', 'now', 'about', 'so', 'if',
    'after', 'before', 'between', 'through', 'during', 'while', 'until',
    'unless', 'although', 'because', 'since', 'yet', 'however', 'therefore',
}

# Patterns to skip (likely not real terms)
SKIP_PATTERNS = [
    r'^[0-9]+$',  # pure numbers
    r'^[^a-z0-9\s]+$',  # only special chars
    r'\d{4,}',  # year numbers
]


def extract_capitalized_terms(text: str, min_length: int = 3, max_length: int = 50) -> Dict[str, int]:
    """Extract capitalized terms (proper nouns, technical terms) from text.
    
    Args:
        text: Text to extract from
        min_length: Minimum term length
        max_length: Maximum term length
        
    Returns:
        Counter of terms with their frequencies
    """
    if not text:
        return {}
    
    # Find capitalized words/phrases (1-3 words)
    pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b'
    matches = re.findall(pattern, text)
    
    # Filter and count
    terms = {}
    for term in matches:
        if len(term) < min_length or len(term) > max_length:
            continue
        if term in COMMON_WORDS or any(term.lower() in common.lower() for common in COMMON_WORDS):
            continue
        
        term_lower = term.lower()
        terms[term_lower] = terms.get(term_lower, 0) + 1
    
    return terms


def extract_technical_terms(text: str) -> Dict[str, int]:
    """Extract technical/specialized terms using heuristics.
    
    Targets: terms in context like "is defined as", "refers to", etc.
    
    Args:
        text: Text to extract from
        
    Returns:
        Counter of potential technical terms
    """
    if not text:
        return {}
    
    terms = {}
    
    # Pattern: "X is defined as/refers to"
    definition_pattern = r'(\w+(?:\s+\w+)?)\s+(?:is|are)?\s*(?:defined as|refers to|means|is an?)\s+([^.!?]+)'
    matches = re.finditer(definition_pattern, text, re.IGNORECASE)
    for match in matches:
        term = match.group(1).strip()
        if len(term) >= 3 and len(term) <= 50:
            term_lower = term.lower()
            terms[term_lower] = terms.get(term_lower, 0) + 2  # boost weight for defined terms
    
    # Pattern: "X: a/the [description]" (common glossary format)
    glossary_pattern = r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:\s+(?:a|an|the)?\s+([^.!?]{10,})'
    matches = re.finditer(glossary_pattern, text)
    for match in matches:
        term = match.group(1).strip()
        if len(term) >= 3 and len(term) <= 50:
            term_lower = term.lower()
            terms[term_lower] = terms.get(term_lower, 0) + 3  # highest boost for glossary format
    
    return terms


def assign_part_of_speech(term: str) -> Optional[str]:
    """Guess part of speech for a term.
    
    Simple heuristic-based approach.
    
    Args:
        term: The term to classify
        
    Returns:
        part_of_speech or None
    """
    term_lower = term.lower()
    
    # Very simple heuristics
    if term_lower.endswith(('ing', 'ed')):
        return 'verb'
    if term_lower.endswith(('tion', 'sion', 'ity', 'ness')):
        return 'noun'
    if term_lower.endswith(('ly', 'able')):
        return 'adjective'
    
    # Check if proper noun (starts with capital)
    if term[0].isupper():
        return 'proper_noun'
    
    return None


def calculate_extraction_confidence(
    term: str,
    frequency: int,
    text_length: int,
    from_definitions: bool = False
) -> float:
    """Calculate confidence score for a term extraction.
    
    Args:
        term: The extracted term
        frequency: How many times it appears
        text_length: Total text length (for normalization)
        from_definitions: Whether extracted from definition patterns
        
    Returns:
        Confidence score 0.0-1.0
    """
    # Base score from frequency (normalize by text length)
    frequency_score = min(1.0, frequency / max(1, text_length / 1000))
    
    # Length score (longer terms are more likely to be meaningful)
    term_words = len(term.split())
    length_score = min(1.0, term_words / 3.0)
    
    # Definition score (high if found in definition patterns)
    definition_score = 0.8 if from_definitions else 0.0
    
    # Combine with weights
    confidence = (frequency_score * 0.4) + (length_score * 0.3) + (definition_score * 0.3)
    
    return min(1.0, max(0.0, confidence))


def extract_glossary_candidates(
    chapters: List[Tuple[str, str, str]],  # (chapter_id, title, content)
    confidence_threshold: float = 0.65,
    max_terms: int = 100
) -> List[Dict]:
    """Extract glossary candidates from chapters.
    
    Args:
        chapters: List of (chapter_id, title, content) tuples
        confidence_threshold: Minimum confidence to include (0.0-1.0)
        max_terms: Maximum candidates to return
        
    Returns:
        List of candidate terms with metadata
    """
    all_terms = {}  # term -> {frequency, chapters, context, from_definitions}
    chapter_mentions = defaultdict(lambda: defaultdict(int))
    total_text_length = 0
    definition_mentions = set()
    
    # First pass: collect terms
    for chapter_id, title, content in chapters:
        if not content:
            continue
        
        total_text_length += len(content)
        
        # Extract different types of terms
        capitalized = extract_capitalized_terms(content)
        technical = extract_technical_terms(content)
        
        # Merge and track
        for term, freq in capitalized.items():
            if term not in all_terms:
                all_terms[term] = {'frequency': 0, 'chapters': set(), 'from_definitions': False}
            all_terms[term]['frequency'] += freq
            all_terms[term]['chapters'].add(chapter_id)
            chapter_mentions[term][chapter_id] += freq
        
        for term, freq in technical.items():
            if term not in all_terms:
                all_terms[term] = {'frequency': 0, 'chapters': set(), 'from_definitions': False}
            all_terms[term]['frequency'] += freq
            all_terms[term]['chapters'].add(chapter_id)
            all_terms[term]['from_definitions'] = True
            definition_mentions.add(term)
            chapter_mentions[term][chapter_id] += freq
    
    # Second pass: score and filter
    candidates = []
    for term, term_data in all_terms.items():
        frequency = term_data['frequency']
        
        # Skip common words and very rare terms
        if term in COMMON_WORDS or frequency < 2:
            continue
        
        # Skip patterns
        if any(re.search(pattern, term) for pattern in SKIP_PATTERNS):
            continue
        
        confidence = calculate_extraction_confidence(
            term,
            frequency,
            total_text_length,
            from_definitions=term_data['from_definitions']
        )
        
        if confidence < confidence_threshold:
            continue
        
        # Extract sample context  
        sample_context = None
        for chapter_id, title, content in chapters:
            if chapter_id in term_data['chapters']:
                pattern = f'(?:[^.!?]*\\b{re.escape(term)}\\b[^.!?]*[.!?])'
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    sample_context = matches[0].strip()[:200]
                    break
        
        candidates.append({
            'term': term,
            'frequency': frequency,
            'confidence': confidence,
            'part_of_speech': assign_part_of_speech(term),
            'sample_context': sample_context,
            'chapter_mentions': dict(chapter_mentions[term]),
            'from_chapters': list(term_data['chapters']),
            'from_definitions': term_data['from_definitions'],
        })
    
    # Sort by confidence and frequency
    candidates.sort(
        key=lambda x: (x['confidence'], x['frequency']),
        reverse=True
    )
    
    # Limit to max_terms
    return candidates[:max_terms]


def save_glossary_candidates(
    db: Session,
    book_id: str,
    candidates: List[Dict],
    overwrite_existing: bool = False
) -> List[GlossaryEntry]:
    """Save extracted candidates to database.
    
    Args:
        db: Database session
        book_id: Book ID to save for
        candidates: List of candidate dicts from extract_glossary_candidates
        overwrite_existing: Whether to replace existing suggested terms
        
    Returns:
        Saved GlossaryEntry objects
    """
    import uuid
    
    saved = []
    
    for candidate in candidates:
        term = candidate['term']
        
        # Check if already exists
        existing = db.query(GlossaryEntry).filter(
            GlossaryEntry.book_id == book_id,
            GlossaryEntry.term == term
        ).first()
        
        if existing:
            if overwrite_existing and not existing.user_defined:
                # Update the existing entry if not user-defined
                existing.frequency = candidate['frequency']
                existing.part_of_speech = candidate['part_of_speech']
                existing.context = candidate['sample_context']
                existing.chapter_mentions = candidate['chapter_mentions']
                db.commit()
                saved.append(existing)
            continue
        
        # Create new entry
        entry = GlossaryEntry(
            id=str(uuid.uuid4()),
            book_id=book_id,
            term=term,
            frequency=candidate['frequency'],
            part_of_speech=candidate['part_of_speech'],
            context=candidate['sample_context'],
            chapter_mentions=candidate['chapter_mentions'],
            confirmed=False,
            user_defined=False,
        )
        db.add(entry)
        saved.append(entry)
    
    db.commit()
    return saved
