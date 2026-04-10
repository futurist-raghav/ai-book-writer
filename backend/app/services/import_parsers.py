"""Import parsers for DOCX, Markdown, Fountain formats (P2.7)"""

import re
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass


@dataclass
class ParsedSection:
    """Represents a parsed section/chapter"""
    title: str
    content: str
    level: int  # heading level (1-6)
    word_count: int


class MarkdownParser:
    """Parse Markdown files into chapters"""
    
    @staticmethod
    def estimate_structure(content: str) -> Dict:
        """Estimate document structure"""
        h1_count = len(re.findall(r'^# [^\n]+', content, re.MULTILINE))
        h2_count = len(re.findall(r'^## [^\n]+', content, re.MULTILINE))
        return {
            "heading1_count": h1_count,
            "heading2_count": h2_count,
            "estimated_chapters": h1_count if h1_count > 0 else h2_count,
            "total_characters": len(content),
        }
    
    @staticmethod
    def parse(content: str, split_by: str = "h1") -> List[ParsedSection]:
        """
        Parse Markdown into sections
        split_by: 'h1' (chapters), 'h2' (sections), 'h3' (scenes)
        """
        pattern = r'^(#{1,3}) ([^\n]+)\n((?:(?!^#{1,3} ).*\n?)*)'
        matches = re.finditer(pattern, content, re.MULTILINE)
        
        sections = []
        for match in matches:
            hashes, title, body = match.groups()
            level = len(hashes)
            
            # Apply split filter
            if split_by == "h1" and level != 1:
                continue
            elif split_by == "h2" and level > 2:
                continue
            
            word_count = len(body.split())
            sections.append(ParsedSection(
                title=title.strip(),
                content=body.strip(),
                level=level,
                word_count=word_count,
            ))
        
        return sections


class FountainParser:
    """Parse Fountain screenwriting format"""
    
    @staticmethod
    def estimate_structure(content: str) -> Dict:
        """Estimate document structure"""
        scene_count = len(re.findall(r'^(INT\.|EXT\.|I\/E\.)', content, re.MULTILINE))
        return {
            "scene_count": scene_count,
            "estimated_chapters": max(1, scene_count // 5),  # ~5 scenes per chapter
            "total_characters": len(content),
        }
    
    @staticmethod
    def parse(content: str) -> List[ParsedSection]:
        """Parse Fountain into scenes/chapters"""
        # Split by scene headings (INT./EXT./I.E.)
        pattern = r'^(INT\.|EXT\.|I\/E\.) ([^\n]+).*?\n((?:(?!^(INT\.|EXT\.|I\/E\.)).*\n?)*)'
        matches = re.finditer(pattern, content, re.MULTILINE)
        
        sections = []
        for match in matches:
            location_type, location, body = match.groups()
            title = f"{location_type} {location}".strip()
            word_count = len(body.split())
            
            sections.append(ParsedSection(
                title=title,
                content=body.strip(),
                level=1,
                word_count=word_count,
            ))
        
        return sections


class DOCXParser:
    """Parse DOCX files into chapters (requires python-docx)"""
    
    @staticmethod
    def estimate_structure(paragraphs_list: List) -> Dict:
        """Estimate structure from paragraphs"""
        heading_count = sum(1 for p in paragraphs_list if p.get('is_heading'))
        return {
            "heading_count": heading_count,
            "estimated_chapters": max(1, heading_count),
            "total_characters": sum(len(p.get('text', '')) for p in paragraphs_list),
        }
    
    @staticmethod
    def parse(paragraphs_list: List, split_by: str = "heading1") -> List[ParsedSection]:
        """
        Parse DOCX paragraphs into sections
        split_by: 'heading1', 'heading2', 'page_break'
        """
        sections = []
        current_section = None
        
        for para in paragraphs_list:
            text = para.get('text', '').strip()
            style = para.get('style', '')
            is_heading = para.get('is_heading', False)
            heading_level = para.get('heading_level', 0)
            
            # Check if this is a split point
            if is_heading:
                if split_by == "heading1" and heading_level == 1:
                    if current_section:
                        sections.append(current_section)
                    current_section = ParsedSection(
                        title=text,
                        content="",
                        level=heading_level,
                        word_count=0,
                    )
                elif split_by == "heading2" and heading_level <= 2:
                    if current_section:
                        sections.append(current_section)
                    current_section = ParsedSection(
                        title=text,
                        content="",
                        level=heading_level,
                        word_count=0,
                    )
            
            # Add content to current section
            if current_section is not None and text:
                current_section.content += text + "\n"
                current_section.word_count = len(current_section.content.split())
        
        # Add final section
        if current_section:
            sections.append(current_section)
        
        return sections


class PlainTextParser:
    """Parse plain text with heuristics"""
    
    @staticmethod
    def estimate_structure(content: str) -> Dict:
        """Estimate structure"""
        lines = content.split('\n')
        # Count lines that look like headings (short lines followed by content)
        heading_like = 0
        for i, line in enumerate(lines[:-1]):
            if len(line) < 100 and len(line) > 0 and len(lines[i+1]) > len(line):
                heading_like += 1
        
        return {
            "heading_like_count": heading_like,
            "estimated_chapters": max(1, heading_like // 3),
            "total_characters": len(content),
        }
    
    @staticmethod
    def parse(content: str) -> List[ParsedSection]:
        """Simple heuristic parsing - split by blank lines > 2"""
        # Very basic: split by multiple blank lines
        sections_text = re.split(r'\n\s*\n\s*\n', content)
        
        sections = []
        for i, section_text in enumerate(sections_text):
            lines = section_text.strip().split('\n')
            if not lines:
                continue
            
            # Use first line as title if short, otherwise generic
            title = lines[0][:100] if lines[0] else f"Section {i+1}"
            word_count = len(section_text.split())
            
            sections.append(ParsedSection(
                title=title,
                content=section_text.strip(),
                level=1,
                word_count=word_count,
            ))
        
        return sections
