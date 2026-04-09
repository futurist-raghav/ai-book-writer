/**
 * Project Type Configuration - Frontend
 * Mirrors the backend configuration to adapt UI, modules, and terminology
 * to different writing formats.
 */

export enum ProjectType {
  // Fiction & Creative
  NOVEL = "novel",
  MEMOIR = "memoir",
  SHORT_STORY_COLLECTION = "short_story_collection",
  POETRY_COLLECTION = "poetry_collection",
  FANFICTION = "fanfiction",
  INTERACTIVE_FICTION = "interactive_fiction",

  // Screenplay & Visual
  SCREENPLAY = "screenplay",
  TV_SERIES_BIBLE = "tv_series_bible",
  GRAPHIC_NOVEL_SCRIPT = "graphic_novel_script",
  COMIC_SCRIPT = "comic_script",

  // Audio & Music
  SONGWRITING_PROJECT = "songwriting_project",
  PODCAST_SCRIPT = "podcast_script",
  AUDIOBOOK_SCRIPT = "audiobook_script",

  // Educational & Academic
  RESEARCH_PAPER = "research_paper",
  THESIS_DISSERTATION = "thesis_dissertation",
  K12_TEXTBOOK = "k12_textbook",
  COLLEGE_TEXTBOOK = "college_textbook",
  ACADEMIC_COURSE = "academic_course",

  // Professional & Technical
  TECHNICAL_DOCUMENTATION = "technical_documentation",
  BUSINESS_BOOK = "business_book",
  MANAGEMENT_BOOK = "management_book",
  SELF_HELP_BOOK = "self_help_book",
  LEGAL_DOCUMENT = "legal_document",

  // Other
  PERSONAL_JOURNAL = "personal_journal",
  EXPERIMENTAL = "experimental",
}

export interface ProjectTypeConfig {
  displayName: string;
  structureUnitName: string;
  flowPageName: string;
  entityConfig: {
    pageName: string;
    characterLabel: string;
    locationLabel: string;
    conceptLabel: string;
    entityTypes: string[];
  };
  visibleModules: string[];
  milestoneNames: string[];
  aiAssistantMode: 'fiction' | 'academic' | 'technical' | 'songwriting' | 'screenplay' | 'generic';
}

export class ProjectTypeConfigService {
  static getDisplayName(type: ProjectType): string {
    const names: Record<ProjectType, string> = {
      [ProjectType.NOVEL]: "Novel",
      [ProjectType.MEMOIR]: "Memoir",
      [ProjectType.SHORT_STORY_COLLECTION]: "Short Story Collection",
      [ProjectType.POETRY_COLLECTION]: "Poetry Collection",
      [ProjectType.FANFICTION]: "Fanfiction",
      [ProjectType.INTERACTIVE_FICTION]: "Interactive Fiction",
      [ProjectType.SCREENPLAY]: "Screenplay",
      [ProjectType.TV_SERIES_BIBLE]: "TV Series Bible",
      [ProjectType.GRAPHIC_NOVEL_SCRIPT]: "Graphic Novel Script",
      [ProjectType.COMIC_SCRIPT]: "Comic Script",
      [ProjectType.SONGWRITING_PROJECT]: "Songwriting Project",
      [ProjectType.PODCAST_SCRIPT]: "Podcast Script",
      [ProjectType.AUDIOBOOK_SCRIPT]: "Audiobook Script",
      [ProjectType.RESEARCH_PAPER]: "Research Paper",
      [ProjectType.THESIS_DISSERTATION]: "Thesis/Dissertation",
      [ProjectType.K12_TEXTBOOK]: "K-12 Textbook",
      [ProjectType.COLLEGE_TEXTBOOK]: "College Textbook",
      [ProjectType.ACADEMIC_COURSE]: "Academic Course",
      [ProjectType.TECHNICAL_DOCUMENTATION]: "Technical Documentation",
      [ProjectType.BUSINESS_BOOK]: "Business Book",
      [ProjectType.MANAGEMENT_BOOK]: "Management Book",
      [ProjectType.SELF_HELP_BOOK]: "Self-Help Book",
      [ProjectType.LEGAL_DOCUMENT]: "Legal Document",
      [ProjectType.PERSONAL_JOURNAL]: "Personal Journal",
      [ProjectType.EXPERIMENTAL]: "Experimental",
    };
    return names[type] || type;
  }

  static getConfig(type: ProjectType): ProjectTypeConfig {
    const configs: Record<ProjectType, ProjectTypeConfig> = {
      [ProjectType.NOVEL]: {
        displayName: "Novel",
        structureUnitName: "Chapters",
        flowPageName: "Plot Spine",
        entityConfig: {
          pageName: "Characters & World",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Concepts",
          entityTypes: ["character", "location", "faction", "object", "magic_system", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
        milestoneNames: ["Outline Complete", "Act 1 Draft", "Midpoint Reached", "Act 3 Draft", "First Draft Done", "Revision Complete"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.MEMOIR]: {
        displayName: "Memoir",
        structureUnitName: "Chapters",
        flowPageName: "Life Timeline",
        entityConfig: {
          pageName: "People & Places",
          characterLabel: "People",
          locationLabel: "Locations",
          conceptLabel: "Life Events",
          entityTypes: ["person", "location", "relationship", "event", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
        milestoneNames: ["Outline Complete", "Foundation Written", "Midpoint Reached", "Revision Complete", "Ready for Review"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.POETRY_COLLECTION]: {
        displayName: "Poetry Collection",
        structureUnitName: "Poems",
        flowPageName: "Collection Arc",
        entityConfig: {
          pageName: "Themes & Symbols",
          characterLabel: "Personas",
          locationLabel: "Settings",
          conceptLabel: "Motifs",
          entityTypes: ["symbol", "motif", "persona", "setting", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "notes_voice", "media", "settings"],
        milestoneNames: ["Theme Identified", "First Drafts", "Revisions", "Final Collections"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.SCREENPLAY]: {
        displayName: "Screenplay",
        structureUnitName: "Scenes",
        flowPageName: "Scene Progression",
        entityConfig: {
          pageName: "Cast & Locations",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Props",
          entityTypes: ["character", "location", "prop", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "publishing", "settings"],
        milestoneNames: ["Outline Done", "Act 1 Complete", "Act 2A Complete", "Act 2B Complete", "Act 3 Complete", "Formatting Done"],
        aiAssistantMode: 'screenplay',
      },
      [ProjectType.SONGWRITING_PROJECT]: {
        displayName: "Songwriting Project",
        structureUnitName: "Tracks",
        flowPageName: "Album Arc",
        entityConfig: {
          pageName: "Themes & References",
          characterLabel: "Personas",
          locationLabel: "Scenes",
          conceptLabel: "Motifs",
          entityTypes: ["persona", "motif", "scene", "reference", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
        milestoneNames: ["All Lyrics Written", "All Music Composed", "All Tracks Recorded", "Mixing Done", "Ready to Release"],
        aiAssistantMode: 'songwriting',
      },
      [ProjectType.RESEARCH_PAPER]: {
        displayName: "Research Paper",
        structureUnitName: "Sections",
        flowPageName: "Argument Flow",
        entityConfig: {
          pageName: "Concepts & Sources",
          characterLabel: "Researchers",
          locationLabel: "Institutions",
          conceptLabel: "Key Concepts",
          entityTypes: ["concept", "theory", "method", "researcher", "institution", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "references", "notes_voice", "media", "publishing", "settings"],
        milestoneNames: ["Research Complete", "Outline Done", "Draft 1", "Literature Review", "Analysis Complete", "Final Review"],
        aiAssistantMode: 'academic',
      },
      [ProjectType.THESIS_DISSERTATION]: {
        displayName: "Thesis/Dissertation",
        structureUnitName: "Chapters",
        flowPageName: "Research Progression",
        entityConfig: {
          pageName: "Concepts & Resources",
          characterLabel: "Key Researchers",
          locationLabel: "Institutions",
          conceptLabel: "Theories",
          entityTypes: ["theory", "method", "concept", "finding", "resource", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "references", "notes_voice", "media", "publishing", "collaboration", "settings"],
        milestoneNames: ["Research Proposal", "Literature Review", "Methodology", "Data Collection", "Analysis", "Draft Complete", "Defense Ready"],
        aiAssistantMode: 'academic',
      },
      [ProjectType.K12_TEXTBOOK]: {
        displayName: "K-12 Textbook",
        structureUnitName: "Lessons",
        flowPageName: "Learning Flow",
        entityConfig: {
          pageName: "Concepts & Terms",
          characterLabel: "Key Concepts",
          locationLabel: "Case Studies",
          conceptLabel: "Definitions",
          entityTypes: ["concept", "definition", "example", "case_study", "exercise", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "settings"],
        milestoneNames: ["Syllabus Mapped", "All Chapters Drafted", "Exercises Added", "Teacher Guide", "Review Complete"],
        aiAssistantMode: 'academic',
      },
      [ProjectType.COLLEGE_TEXTBOOK]: {
        displayName: "College Textbook",
        structureUnitName: "Chapters",
        flowPageName: "Course Flow",
        entityConfig: {
          pageName: "Concepts & Cases",
          characterLabel: "Key Concepts",
          locationLabel: "Case Studies",
          conceptLabel: "Principles",
          entityTypes: ["concept", "principle", "case_study", "application", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "collaboration", "settings"],
        milestoneNames: ["Curriculum Mapped", "Chapter Outlines", "First Draft", "Exercises Added", "Peer Review", "Final Revision"],
        aiAssistantMode: 'academic',
      },
      [ProjectType.TECHNICAL_DOCUMENTATION]: {
        displayName: "Technical Documentation",
        structureUnitName: "Sections",
        flowPageName: "Process Flow",
        entityConfig: {
          pageName: "Components & Systems",
          characterLabel: "Components",
          locationLabel: "Subsystems",
          conceptLabel: "Procedures",
          entityTypes: ["component", "system", "procedure", "command", "definition", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "media", "publishing", "settings"],
        milestoneNames: ["Architecture Mapped", "API Documented", "Examples Added", "Screenshots Done", "Review Complete"],
        aiAssistantMode: 'technical',
      },
      [ProjectType.BUSINESS_BOOK]: {
        displayName: "Business Book",
        structureUnitName: "Chapters",
        flowPageName: "Framework Progression",
        entityConfig: {
          pageName: "Frameworks & Cases",
          characterLabel: "Stakeholders",
          locationLabel: "Case Studies",
          conceptLabel: "Frameworks",
          entityTypes: ["framework", "case_study", "stakeholder", "principle", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "settings"],
        milestoneNames: ["Outline Complete", "Framework Defined", "Cases Added", "Examples Drafted", "Revision Complete"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.EXPERIMENTAL]: {
        displayName: "Experimental",
        structureUnitName: "Sections",
        flowPageName: "Timeline",
        entityConfig: {
          pageName: "Entities",
          characterLabel: "Items",
          locationLabel: "Locations",
          conceptLabel: "Concepts",
          entityTypes: ["entity", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "references", "media", "collaboration", "publishing", "settings"],
        milestoneNames: ["Outline Complete", "Draft Done", "Review Complete"],
        aiAssistantMode: 'generic',
      },
      // Default fallbacks for unmapped types
      [ProjectType.SHORT_STORY_COLLECTION]: {
        displayName: "Short Story Collection",
        structureUnitName: "Stories",
        flowPageName: "Collection Arc",
        entityConfig: {
          pageName: "Characters & Settings",
          characterLabel: "Characters",
          locationLabel: "Settings",
          conceptLabel: "Themes",
          entityTypes: ["character", "location", "theme", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "notes_voice", "media", "settings"],
        milestoneNames: ["Story Outlined", "Draft Complete", "Revision Done"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.FANFICTION]: {
        displayName: "Fanfiction",
        structureUnitName: "Chapters",
        flowPageName: "Plot Progression",
        entityConfig: {
          pageName: "Characters & Settings",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Plot Points",
          entityTypes: ["character", "location", "plot_point", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
        milestoneNames: ["Outline Done", "Act 1", "Act 2", "Act 3", "Complete"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.INTERACTIVE_FICTION]: {
        displayName: "Interactive Fiction",
        structureUnitName: "Sections",
        flowPageName: "Story Map",
        entityConfig: {
          pageName: "World & Choices",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Choices",
          entityTypes: ["character", "location", "choice", "branch", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "settings"],
        milestoneNames: ["Structure Mapped", "Branches Drafted", "Paths Reviewed"],
        aiAssistantMode: 'fiction',
      },
      [ProjectType.TV_SERIES_BIBLE]: {
        displayName: "TV Series Bible",
        structureUnitName: "Episodes",
        flowPageName: "Season Arc",
        entityConfig: {
          pageName: "Cast & World",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Themes",
          entityTypes: ["character", "location", "theme", "episode_arc", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "publishing", "settings"],
        milestoneNames: ["Bible Outline", "Cast Defined", "Seasons Planned", "Pilot Script"],
        aiAssistantMode: 'screenplay',
      },
      [ProjectType.GRAPHIC_NOVEL_SCRIPT]: {
        displayName: "Graphic Novel Script",
        structureUnitName: "Scenes",
        flowPageName: "Panel Flow",
        entityConfig: {
          pageName: "Cast & Visuals",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Visual Motifs",
          entityTypes: ["character", "location", "visual_motif", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "media", "publishing", "settings"],
        milestoneNames: ["Script Complete", "Panel Layout", "Visual Design", "Lettering"],
        aiAssistantMode: 'screenplay',
      },
      [ProjectType.COMIC_SCRIPT]: {
        displayName: "Comic Script",
        structureUnitName: "Issues",
        flowPageName: "Story Arc",
        entityConfig: {
          pageName: "Characters & Arcs",
          characterLabel: "Characters",
          locationLabel: "Locations",
          conceptLabel: "Plot Points",
          entityTypes: ["character", "location", "plot_point", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "media", "publishing", "settings"],
        milestoneNames: ["Series Bible", "Issue Outlines", "Scripts", "Visual Brief"],
        aiAssistantMode: 'screenplay',
      },
      [ProjectType.PODCAST_SCRIPT]: {
        displayName: "Podcast Script",
        structureUnitName: "Episodes",
        flowPageName: "Season Arc",
        entityConfig: {
          pageName: "Themes & Guests",
          characterLabel: "Hosts/Guests",
          locationLabel: "Topics",
          conceptLabel: "Segments",
          entityTypes: ["host", "guest", "topic", "segment", "custom"],
        },
        visibleModules: ["overview", "structure", "notes_voice", "media", "publishing", "settings"],
        milestoneNames: ["Format Defined", "episodes Scripted", "Show Bible"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.AUDIOBOOK_SCRIPT]: {
        displayName: "Audiobook Script",
        structureUnitName: "Chapters",
        flowPageName: "Audio Timeline",
        entityConfig: {
          pageName: "Characters & Audio",
          characterLabel: "Character Voices",
          locationLabel: "Settings",
          conceptLabel: "Audio Cues",
          entityTypes: ["voice", "setting", "audio_cue", "audio_effect", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "media", "publishing", "settings"],
        milestoneNames: ["Manuscript Ready", "Voice Roles Assigned", "Audio Brief"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.ACADEMIC_COURSE]: {
        displayName: "Academic Course",
        structureUnitName: "Modules",
        flowPageName: "Course Flow",
        entityConfig: {
          pageName: "Topics & Resources",
          characterLabel: "Key Concepts",
          locationLabel: "Resources",
          conceptLabel: "Learning Objectives",
          entityTypes: ["concept", "learning_objective", "resource", "assessment", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "collaboration", "settings"],
        milestoneNames: ["Syllabus Ready", "Content Drafted", "Assessments", "Materials Ready"],
        aiAssistantMode: 'academic',
      },
      [ProjectType.MANAGEMENT_BOOK]: {
        displayName: "Management Book",
        structureUnitName: "Chapters",
        flowPageName: "Framework Progression",
        entityConfig: {
          pageName: "Frameworks & Teams",
          characterLabel: "Team Roles",
          locationLabel: "Organizations",
          conceptLabel: "Processes",
          entityTypes: ["team_role", "organization", "process", "framework", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "references", "media", "publishing", "settings"],
        milestoneNames: ["Framework Ready", "Chapter Outline", "Case Studies", "Examples"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.SELF_HELP_BOOK]: {
        displayName: "Self-Help Book",
        structureUnitName: "Chapters",
        flowPageName: "Journey Arc",
        entityConfig: {
          pageName: "Concepts & Strategies",
          characterLabel: "Personas",
          locationLabel: "Scenarios",
          conceptLabel: "Strategies",
          entityTypes: ["persona", "scenario", "strategy", "exercise", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "flow", "notes_voice", "media", "publishing", "settings"],
        milestoneNames: ["Core Idea", "Chapters Outlined", "Exercises", "Ready to Publish"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.LEGAL_DOCUMENT]: {
        displayName: "Legal Document",
        structureUnitName: "Sections",
        flowPageName: "Document Flow",
        entityConfig: {
          pageName: "Clauses & References",
          characterLabel: "Parties",
          locationLabel: "Jurisdictions",
          conceptLabel: "Definitions",
          entityTypes: ["party", "jurisdiction", "definition", "clause", "custom"],
        },
        visibleModules: ["overview", "structure", "entities", "references", "publishing", "settings"],
        milestoneNames: ["Draft 1", "Legal Review", "Amendment Round", "Final"],
        aiAssistantMode: 'generic',
      },
      [ProjectType.PERSONAL_JOURNAL]: {
        displayName: "Personal Journal",
        structureUnitName: "Entries",
        flowPageName: "Timeline",
        entityConfig: {
          pageName: "Themes & Reflections",
          characterLabel: "People",
          locationLabel: "Places",
          conceptLabel: "Themes",
          entityTypes: ["person", "place", "theme", "reflection", "custom"],
        },
        visibleModules: ["overview", "structure", "notes_voice", "media", "settings"],
        milestoneNames: ["Entry Started", "Year Complete"],
        aiAssistantMode: 'generic',
      },
    };

    return configs[type] || configs[ProjectType.EXPERIMENTAL];
  }

  static getVisibleModules(type: ProjectType): string[] {
    return this.getConfig(type).visibleModules;
  }

  static getStructureUnitName(type: ProjectType): string {
    return this.getConfig(type).structureUnitName;
  }

  static getFlowPageName(type: ProjectType): string {
    return this.getConfig(type).flowPageName;
  }

  static getEntityConfig(type: ProjectType) {
    return this.getConfig(type).entityConfig;
  }
}

export const PROJECT_TYPE_CATEGORIES = {
  "Fiction & Creative": [
    ProjectType.NOVEL,
    ProjectType.MEMOIR,
    ProjectType.SHORT_STORY_COLLECTION,
    ProjectType.POETRY_COLLECTION,
    ProjectType.FANFICTION,
    ProjectType.INTERACTIVE_FICTION,
  ],
  "Screenplay & Visual": [
    ProjectType.SCREENPLAY,
    ProjectType.TV_SERIES_BIBLE,
    ProjectType.GRAPHIC_NOVEL_SCRIPT,
    ProjectType.COMIC_SCRIPT,
  ],
  "Audio & Music": [
    ProjectType.SONGWRITING_PROJECT,
    ProjectType.PODCAST_SCRIPT,
    ProjectType.AUDIOBOOK_SCRIPT,
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
    ProjectType.LEGAL_DOCUMENT,
  ],
  "Personal": [
    ProjectType.PERSONAL_JOURNAL,
    ProjectType.EXPERIMENTAL,
  ],
};
