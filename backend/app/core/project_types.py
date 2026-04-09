"""
Project Type Configuration

Defines all supported writing project types and their configurations.
This allows The Editorial Sanctuary to adapt to different writing formats,
from novels to screenplays to academic textbooks.
"""

from enum import Enum
from typing import List, Dict, Any


class ProjectType(str, Enum):
    """All supported project types."""
    
    # Fiction & Creative
    NOVEL = "novel"
    MEMOIR = "memoir"
    SHORT_STORY_COLLECTION = "short_story_collection"
    POETRY_COLLECTION = "poetry_collection"
    FANFICTION = "fanfiction"
    INTERACTIVE_FICTION = "interactive_fiction"
    
    # Screenplay & Visual
    SCREENPLAY = "screenplay"
    TV_SERIES_BIBLE = "tv_series_bible"
    GRAPHIC_NOVEL_SCRIPT = "graphic_novel_script"
    COMIC_SCRIPT = "comic_script"
    
    # Audio & Music
    SONGWRITING_PROJECT = "songwriting_project"
    PODCAST_SCRIPT = "podcast_script"
    AUDIOBOOK_SCRIPT = "audiobook_script"
    
    # Educational & Academic
    RESEARCH_PAPER = "research_paper"
    THESIS_DISSERTATION = "thesis_dissertation"
    K12_TEXTBOOK = "k12_textbook"
    COLLEGE_TEXTBOOK = "college_textbook"
    ACADEMIC_COURSE = "academic_course"
    
    # Professional & Technical
    TECHNICAL_DOCUMENTATION = "technical_documentation"
    BUSINESS_BOOK = "business_book"
    MANAGEMENT_BOOK = "management_book"
    SELF_HELP_BOOK = "self_help_book"
    LEGAL_DOCUMENT = "legal_document"
    
    # Other
    PERSONAL_JOURNAL = "personal_journal"
    EXPERIMENTAL = "experimental"


class ProjectTypeConfig:
    """Configuration for each project type."""
    
    @staticmethod
    def get_display_name(project_type: ProjectType) -> str:
        """Get human-readable name for project type."""
        names = {
            ProjectType.NOVEL: "Novel",
            ProjectType.MEMOIR: "Memoir",
            ProjectType.SHORT_STORY_COLLECTION: "Short Story Collection",
            ProjectType.POETRY_COLLECTION: "Poetry Collection",
            ProjectType.FANFICTION: "Fanfiction",
            ProjectType.INTERACTIVE_FICTION: "Interactive Fiction",
            ProjectType.SCREENPLAY: "Screenplay",
            ProjectType.TV_SERIES_BIBLE: "TV Series Bible",
            ProjectType.GRAPHIC_NOVEL_SCRIPT: "Graphic Novel Script",
            ProjectType.COMIC_SCRIPT: "Comic Script",
            ProjectType.SONGWRITING_PROJECT: "Songwriting Project",
            ProjectType.PODCAST_SCRIPT: "Podcast Script",
            ProjectType.AUDIOBOOK_SCRIPT: "Audiobook Script",
            ProjectType.RESEARCH_PAPER: "Research Paper",
            ProjectType.THESIS_DISSERTATION: "Thesis/Dissertation",
            ProjectType.K12_TEXTBOOK: "K-12 Textbook",
            ProjectType.COLLEGE_TEXTBOOK: "College Textbook",
            ProjectType.ACADEMIC_COURSE: "Academic Course",
            ProjectType.TECHNICAL_DOCUMENTATION: "Technical Documentation",
            ProjectType.BUSINESS_BOOK: "Business Book",
            ProjectType.MANAGEMENT_BOOK: "Management Book",
            ProjectType.SELF_HELP_BOOK: "Self-Help Book",
            ProjectType.LEGAL_DOCUMENT: "Legal Document",
            ProjectType.PERSONAL_JOURNAL: "Personal Journal",
            ProjectType.EXPERIMENTAL: "Experimental",
        }
        return names.get(project_type, project_type.value)
    
    @staticmethod
    def get_structure_unit_name(project_type: ProjectType) -> str:
        """Get the primary structure unit name (chapter, scene, song track, etc.)."""
        names = {
            ProjectType.NOVEL: "Chapters",
            ProjectType.MEMOIR: "Chapters",
            ProjectType.SHORT_STORY_COLLECTION: "Stories",
            ProjectType.POETRY_COLLECTION: "Poems",
            ProjectType.FANFICTION: "Chapters",
            ProjectType.INTERACTIVE_FICTION: "Sections",
            ProjectType.SCREENPLAY: "Scenes",
            ProjectType.TV_SERIES_BIBLE: "Episodes",
            ProjectType.GRAPHIC_NOVEL_SCRIPT: "Scenes",
            ProjectType.COMIC_SCRIPT: "Panels",
            ProjectType.SONGWRITING_PROJECT: "Tracks",
            ProjectType.PODCAST_SCRIPT: "Episodes",
            ProjectType.AUDIOBOOK_SCRIPT: "Chapters",
            ProjectType.RESEARCH_PAPER: "Sections",
            ProjectType.THESIS_DISSERTATION: "Chapters",
            ProjectType.K12_TEXTBOOK: "Lessons",
            ProjectType.COLLEGE_TEXTBOOK: "Chapters",
            ProjectType.ACADEMIC_COURSE: "Modules",
            ProjectType.TECHNICAL_DOCUMENTATION: "Sections",
            ProjectType.BUSINESS_BOOK: "Chapters",
            ProjectType.MANAGEMENT_BOOK: "Chapters",
            ProjectType.SELF_HELP_BOOK: "Chapters",
            ProjectType.LEGAL_DOCUMENT: "Sections",
            ProjectType.PERSONAL_JOURNAL: "Entries",
            ProjectType.EXPERIMENTAL: "Sections",
        }
        return names.get(project_type, "Chapters")
    
    @staticmethod
    def get_entity_type_names(project_type: ProjectType) -> Dict[str, str]:
        """Get adapted entity type names for this project type."""
        configs = {
            ProjectType.NOVEL: {
                "page_name": "Characters & World",
                "character_label": "Characters",
                "location_label": "Locations",
                "concept_label": "Concepts",
                "entity_types": ["character", "location", "faction", "object", "magic_system", "custom"],
            },
            ProjectType.MEMOIR: {
                "page_name": "People & Places",
                "character_label": "People",
                "location_label": "Locations",
                "concept_label": "Life Events",
                "entity_types": ["person", "location", "relationship", "event", "custom"],
            },
            ProjectType.POETRY_COLLECTION: {
                "page_name": "Themes & Symbols",
                "character_label": "Personas",
                "location_label": "Settings",
                "concept_label": "Motifs",
                "entity_types": ["symbol", "motif", "persona", "setting", "custom"],
            },
            ProjectType.SCREENPLAY: {
                "page_name": "Cast & Locations",
                "character_label": "Characters",
                "location_label": "Locations",
                "concept_label": "Props",
                "entity_types": ["character", "location", "prop", "custom"],
            },
            ProjectType.SONGWRITING_PROJECT: {
                "page_name": "Themes & References",
                "character_label": "Personas",
                "location_label": "Scenes",
                "concept_label": "Motifs",
                "entity_types": ["persona", "motif", "scene", "reference", "custom"],
            },
            ProjectType.RESEARCH_PAPER: {
                "page_name": "Concepts & Sources",
                "character_label": "Researchers",
                "location_label": "Institutions",
                "concept_label": "Key Concepts",
                "entity_types": ["concept", "theory", "method", "researcher", "institution", "custom"],
            },
            ProjectType.K12_TEXTBOOK: {
                "page_name": "Concepts & Key Terms",
                "character_label": "Key Concepts",
                "location_label": "Case Studies",
                "concept_label": "Definitions",
                "entity_types": ["concept", "definition", "example", "case_study", "exercise", "custom"],
            },
            ProjectType.TECHNICAL_DOCUMENTATION: {
                "page_name": "Components & Systems",
                "character_label": "Components",
                "location_label": "Subsystems",
                "concept_label": "Procedures",
                "entity_types": ["component", "system", "procedure", "command", "definition", "custom"],
            },
            ProjectType.BUSINESS_BOOK: {
                "page_name": "Frameworks & Case Studies",
                "character_label": "Stakeholders",
                "location_label": "Case Studies",
                "concept_label": "Frameworks",
                "entity_types": ["framework", "case_study", "stakeholder", "principle", "custom"],
            },
        }
        
        # Return specific config or fallback to generic
        if project_type in configs:
            return configs[project_type]
        
        return {
            "page_name": "Entities",
            "character_label": "Items",
            "location_label": "Locations",
            "concept_label": "Concepts",
            "entity_types": ["entity", "custom"],
        }
    
    @staticmethod
    def get_flow_page_name(project_type: ProjectType) -> str:
        """Get the name for the flow/timeline/progression page."""
        names = {
            ProjectType.NOVEL: "Plot Spine",
            ProjectType.MEMOIR: "Life Timeline",
            ProjectType.POETRY_COLLECTION: "Thematic Flow",
            ProjectType.SCREENPLAY: "Scene Progression",
            ProjectType.SONGWRITING_PROJECT: "Album Arc",
            ProjectType.RESEARCH_PAPER: "Argument Flow",
            ProjectType.K12_TEXTBOOK: "Learning Flow",
            ProjectType.COLLEGE_TEXTBOOK: "Course Flow",
            ProjectType.TECHNICAL_DOCUMENTATION: "Process Flow",
            ProjectType.BUSINESS_BOOK: "Framework Progression",
        }
        return names.get(project_type, "Timeline")
    
    @staticmethod
    def get_milestone_names(project_type: ProjectType) -> List[str]:
        """Get milestone markers appropriate for this project type."""
        milestones = {
            ProjectType.NOVEL: ["Outline Complete", "Act 1 Draft", "Midpoint Reached", "Act 3 Draft", "First Draft Done", "Revision Complete"],
            ProjectType.RESEARCH_PAPER: ["Research Complete", "Outline Done", "Draft 1", "Literature Review", "Analysis Complete", "Final Review"],
            ProjectType.K12_TEXTBOOK: ["Syllabus Mapped", "All Chapters Drafted", "Exercises Added", "Teacher Guide", "Review Complete"],
            ProjectType.SCREENPLAY: ["Outline Done", "Act 1 Complete", "Act 2A Complete", "Act 2B Complete", "Act 3 Complete", "Formatting Done"],
            ProjectType.SONGWRITING_PROJECT: ["All Lyrics Written", "All Music Composed", "All Tracks Recorded", "Mixing Done", "Ready to Release"],
        }
        
        return milestones.get(project_type, ["Draft Complete", "Revision Complete", "Ready for Review"])
    
    @staticmethod
    def get_visible_modules(project_type: ProjectType) -> List[str]:
        """Get which sidebar modules should be visible for this project type."""
        modules = {
            # Fiction & Creative - all modules
            ProjectType.NOVEL: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
            ProjectType.MEMOIR: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
            ProjectType.POETRY_COLLECTION: ["overview", "structure", "entities", "notes_voice", "media", "settings"],
            ProjectType.SCREENPLAY: ["overview", "structure", "entities", "flow", "notes_voice", "media", "publishing", "settings"],
            ProjectType.SONGWRITING_PROJECT: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
            
            # Academic & Research - heavy on references
            ProjectType.RESEARCH_PAPER: ["overview", "structure", "entities", "references", "notes_voice", "media", "publishing", "settings"],
            ProjectType.THESIS_DISSERTATION: ["overview", "structure", "entities", "references", "notes_voice", "media", "publishing", "settings"],
            ProjectType.K12_TEXTBOOK: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "settings"],
            ProjectType.COLLEGE_TEXTBOOK: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "collaboration", "settings"],
            
            # Technical & Professional
            ProjectType.TECHNICAL_DOCUMENTATION: ["overview", "structure", "entities", "flow", "media", "publishing", "settings"],
            ProjectType.BUSINESS_BOOK: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "settings"],
            
            # Default - show all
            ProjectType.EXPERIMENTAL: ["overview", "structure", "entities", "flow", "notes_voice", "references", "media", "collaboration", "publishing", "settings"],
        }
        
        return modules.get(project_type, ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"])


# All project types grouped by category
PROJECT_TYPE_CATEGORIES = {
    "Fiction & Creative": [
        ProjectType.NOVEL,
        ProjectType.MEMOIR,
        ProjectType.SHORT_STORY_COLLECTION,
        ProjectType.POETRY_COLLECTION,
        ProjectType.FANFICTION,
    ],
    "Screenplay & Visual": [
        ProjectType.SCREENPLAY,
        ProjectType.TV_SERIES_BIBLE,
        ProjectType.GRAPHIC_NOVEL_SCRIPT,
    ],
    "Audio & Music": [
        ProjectType.SONGWRITING_PROJECT,
        ProjectType.PODCAST_SCRIPT,
    ],
    "Academic & Research": [
        ProjectType.RESEARCH_PAPER,
        ProjectType.THESIS_DISSERTATION,
        ProjectType.K12_TEXTBOOK,
        ProjectType.COLLEGE_TEXTBOOK,
        ProjectType.ACADEMIC_COURSE,
    ],
    "Professional & Technical": [
        ProjectType.TECHNICAL_DOCUMENTATION,
        ProjectType.BUSINESS_BOOK,
        ProjectType.MANAGEMENT_BOOK,
        ProjectType.SELF_HELP_BOOK,
    ],
}
