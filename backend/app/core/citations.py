"""Citation Formatting Utilities (P2.4

Formats bibliography entries into various citation styles.
"""

from typing import Optional, List
from app.models.bibliography import Bibliography


def format_authors(authors: Optional[List[str]], format_style: str) -> str:
    """Format author list based on citation style"""
    if not authors:
        return ""
    
    if format_style == "apa":
        # Last, First; Last, First; & Last, First
        formatted = []
        for i, author in enumerate(authors):
            formatted.append(author)
        
        if len(formatted) == 1:
            return formatted[0]
        elif len(formatted) == 2:
            return f"{formatted[0]} & {formatted[1]}"
        else:
            return ", ".join(formatted[:-1]) + f" & {formatted[-1]}"
    
    elif format_style == "mla":
        # Last, First., et al.
        if len(authors) > 1:
            return f"{authors[0]}, et al."
        return authors[0]
    
    elif format_style == "chicago":
        # Last, First, Last, First, etc.
        return ", ".join(authors)
    
    elif format_style == "ieee":
        # Initials. Last, Initials. Last
        formatted = []
        for author in authors:
            parts = author.split()
            if len(parts) >= 2:
                initials = ".".join([p[0].upper() for p in parts[:-1]])
                formatted.append(f"{initials}. {parts[-1]}")
            else:
                formatted.append(parts[0])
        return ", ".join(formatted[:3]) + ("..." if len(formatted) > 3 else "")
    
    return ", ".join(authors)


def format_citation(bibliography: Bibliography, style: str) -> str:
    """Format a bibliography entry into a citation string"""
    
    authors = format_authors(bibliography.authors, style)
    title = bibliography.title or "Untitled"
    year = f" ({bibliography.year})" if bibliography.year else ""
    url = f" Retrieved from {bibliography.source_url}" if bibliography.source_url else ""
    
    if style == "apa":
        # APA: Author(s) (Year). Title. Source type. URL
        return f"{authors}{year}. {title}. {bibliography.source_type or 'Source'}.{url}"
    
    elif style == "mla":
        # MLA: Author(s). "Title." Source Type, Year. URL
        return f'{authors}. "{title}." {bibliography.source_type or "Source"}, {bibliography.year or "n.d."}.{url}'
    
    elif style == "chicago":
        # Chicago: Author(s). Title. Source Type, Year. URL
        return f"{authors}. *{title}*. {bibliography.source_type or 'Source'}, {bibliography.year or 'n.d.'}.{url}"
    
    elif style == "ieee":
        # IEEE: [#] Initials. Last, "Title," Source type, Year, URL.
        return f"[1] {authors}, \"{title},\" {bibliography.source_type or 'source'}, {bibliography.year or 'n.d.'}.{url}"
    
    return f"{authors}. {title}. {year}"


def generate_bibliography_text(entries: List[Bibliography], style: str = "apa") -> str:
    """Generate a formatted bibliography section"""
    
    if not entries:
        return ""
    
    lines = []
    
    if style == "apa":
        lines.append("References\n")
    elif style == "mla":
        lines.append("Works Cited\n")
    elif style == "chicago":
        lines.append("Bibliography\n")
    elif style == "ieee":
        lines.append("References\n")
    
    # Sort by authors then year
    sorted_entries = sorted(
        entries,
        key=lambda e: (
            (e.authors[0] if e.authors else ""),
            e.year or 0
        )
    )
    
    for i, entry in enumerate(sorted_entries, 1):
        citation = format_citation(entry, style)
        if style == "ieee":
            lines.append(f"[{i}] {citation}")
        else:
            lines.append(citation)
        lines.append("")
    
    return "\n".join(lines)
