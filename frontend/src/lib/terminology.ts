/**
 * Terminology Configuration System for Phase 1 Adaptability
 * 
 * Provides project-type-aware terminology for UI labels across the app.
 * Integrates with ProjectTypeConfigService to enable the same platform
 * to support multiple writing formats:
 * - Novels (Chapters, Characters, Writer Canvas)
 * - Screenplays (Scenes, Characters, Screenplay)
 * - Academic (Sections, Concepts, Paper Editor)
 * - Songwriting (Tracks, Themes, Lyric Editor)
 * - etc.
 */

import { ProjectType } from './project-types';

export interface TerminologyConfig {
  // Editor components
  editorLabel: string; // "Writer Canvas", "Screenplay", "Draft Editor"
  editorPlaceholder: string; // "Start your next chapter", "Write your screenplay"

  // Timeline components  
  timelineLabel: string; // "Story Beats", "Timeline", "Key Moments"
  eventLabel: string; // "Beat", "Event", "Milestone"

  // Action buttons
  continueAction: string; // "Continue Writing", "Next Scene", "Add Content"
  summaryAction: string; // "Generate Summary", "Create Beat", "Extract Key Points"
  saveIndicator: string; // "Last saved" label

  // Dialog labels
  newStructureLabel: string; // "New Chapter", "New Scene"
  editStructureLabel: string; // "Edit Chapter", "Edit Scene"

  // Additional metadata
  description?: string;
  guidelines?: string;
}

// Comprehensive Project Type to Terminology Mapping
const PROJECT_TERMINOLOGY: Record<string, TerminologyConfig> = {
  [ProjectType.NOVEL]: {
    editorLabel: 'Writer Canvas',
    editorPlaceholder: 'Start your next chapter...',
    timelineLabel: 'Story Beats',
    eventLabel: 'Beat',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Multi-chapter fiction narrative',
    guidelines: 'Organize by chapters with character arcs',
  },

  [ProjectType.MEMOIR]: {
    editorLabel: 'Memoir Editor',
    editorPlaceholder: 'Continue your story...',
    timelineLabel: 'Life Timeline',
    eventLabel: 'Memory',
    continueAction: 'Continue Chapter',
    summaryAction: 'Extract Key Points',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Personal narrative chronologically',
    guidelines: 'Organize around important life events',
  },

  [ProjectType.SHORT_STORY_COLLECTION]: {
    editorLabel: 'Story Editor',
    editorPlaceholder: 'Write your story...',
    timelineLabel: 'Story Arc',
    eventLabel: 'Story',
    continueAction: 'Continue Story',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Story',
    editStructureLabel: 'Edit Story',
    description: 'Collection of short stories',
    guidelines: 'Each story is independent',
  },

  [ProjectType.POETRY_COLLECTION]: {
    editorLabel: 'Verse Editor',
    editorPlaceholder: 'Write your poem...',
    timelineLabel: 'Collection Arc',
    eventLabel: 'Poem',
    continueAction: 'Next Verse',
    summaryAction: 'Meter Check',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Poem',
    editStructureLabel: 'Edit Poem',
    description: 'Poetry collection',
    guidelines: 'Organize by theme or style',
  },

  [ProjectType.FANFICTION]: {
    editorLabel: 'Fanfic Editor',
    editorPlaceholder: 'Continue the story...',
    timelineLabel: 'Plot Arc',
    eventLabel: 'Scene',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Fan fiction expanding canon universes',
    guidelines: 'Honor source material while extending',
  },

  [ProjectType.INTERACTIVE_FICTION]: {
    editorLabel: 'Branch Editor',
    editorPlaceholder: 'Write this branch...',
    timelineLabel: 'Story Branches',
    eventLabel: 'Branch',
    continueAction: 'Add Branch',
    summaryAction: 'Map Paths',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Branch',
    editStructureLabel: 'Edit Branch',
    description: 'Interactive fiction with choices',
    guidelines: 'Create branching narratives',
  },

  [ProjectType.SCREENPLAY]: {
    editorLabel: 'Screenplay',
    editorPlaceholder: 'Write your scene...',
    timelineLabel: 'Scene Outline',
    eventLabel: 'Scene',
    continueAction: 'Next Scene',
    summaryAction: 'Format Check',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Scene',
    editStructureLabel: 'Edit Scene',
    description: 'Screenplay with proper formatting',
    guidelines: 'Follow Fountain format conventions',
  },

  [ProjectType.TV_SERIES_BIBLE]: {
    editorLabel: 'Series Bible',
    editorPlaceholder: 'Document your series...',
    timelineLabel: 'Season Arc',
    eventLabel: 'Episode',
    continueAction: 'Add Episode',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Section',
    editStructureLabel: 'Edit Section',
    description: 'TV series bible documentation',
    guidelines: 'Establish series tone and structure',
  },

  [ProjectType.GRAPHIC_NOVEL_SCRIPT]: {
    editorLabel: 'Panel Script',
    editorPlaceholder: 'Write your scene...',
    timelineLabel: 'Story Arc',
    eventLabel: 'Panel',
    continueAction: 'Next Panel',
    summaryAction: 'Visual Map',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Scene',
    editStructureLabel: 'Edit Scene',
    description: 'Graphic novel script with panels',
    guidelines: 'Include visual descriptions',
  },

  [ProjectType.COMIC_SCRIPT]: {
    editorLabel: 'Comic Script',
    editorPlaceholder: 'Write your issue...',
    timelineLabel: 'Issue Arc',
    eventLabel: 'Issue',
    continueAction: 'Next Issue',
    summaryAction: 'Plot Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Issue',
    editStructureLabel: 'Edit Issue',
    description: 'Comic book script',
    guidelines: 'Include panel directions',
  },

  [ProjectType.SONGWRITING_PROJECT]: {
    editorLabel: 'Lyric Editor',
    editorPlaceholder: 'Write your lyrics...',
    timelineLabel: 'Album Arc',
    eventLabel: 'Track',
    continueAction: 'Next Track',
    summaryAction: 'Rhyme Check',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Track',
    editStructureLabel: 'Edit Track',
    description: 'Song composition and lyrics',
    guidelines: 'Organize by album structure',
  },

  [ProjectType.PODCAST_SCRIPT]: {
    editorLabel: 'Episode Script',
    editorPlaceholder: 'Write your episode...',
    timelineLabel: 'Series Arc',
    eventLabel: 'Episode',
    continueAction: 'Next Episode',
    summaryAction: 'Audio Notes',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Episode',
    editStructureLabel: 'Edit Episode',
    description: 'Podcast episode scripts',
    guidelines: 'Include sound direction',
  },

  [ProjectType.AUDIOBOOK_SCRIPT]: {
    editorLabel: 'Audio Script',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Recording Timeline',
    eventLabel: 'Chapter',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Audiobook script with narration notes',
    guidelines: 'Include pacing and tone direction',
  },

  [ProjectType.RESEARCH_PAPER]: {
    editorLabel: 'Paper Editor',
    editorPlaceholder: 'Write your section...',
    timelineLabel: 'Argument Flow',
    eventLabel: 'Point',
    continueAction: 'Expand Section',
    summaryAction: 'Generate Abstract',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Section',
    editStructureLabel: 'Edit Section',
    description: 'Academic research paper',
    guidelines: 'Support claims with citations',
  },

  [ProjectType.THESIS_DISSERTATION]: {
    editorLabel: 'Thesis Editor',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Research Progression',
    eventLabel: 'Finding',
    continueAction: 'Continue Writing',
    summaryAction: 'Extract Findings',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Thesis or dissertation',
    guidelines: 'Follow academic standards',
  },

  [ProjectType.K12_TEXTBOOK]: {
    editorLabel: 'Lesson Editor',
    editorPlaceholder: 'Write your lesson...',
    timelineLabel: 'Learning Flow',
    eventLabel: 'Topic',
    continueAction: 'Next Lesson',
    summaryAction: 'Generate Quiz',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Lesson',
    editStructureLabel: 'Edit Lesson',
    description: 'K-12 educational textbook',
    guidelines: 'Build concepts progressively',
  },

  [ProjectType.COLLEGE_TEXTBOOK]: {
    editorLabel: 'Chapter Editor',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Course Flow',
    eventLabel: 'Chapter',
    continueAction: 'Next Chapter',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'College-level textbook',
    guidelines: 'Include advanced concepts',
  },

  [ProjectType.ACADEMIC_COURSE]: {
    editorLabel: 'Course Editor',
    editorPlaceholder: 'Write course content...',
    timelineLabel: 'Course Outline',
    eventLabel: 'Lesson',
    continueAction: 'Next Lesson',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Lesson',
    editStructureLabel: 'Edit Lesson',
    description: 'Academic course curriculum',
    guidelines: 'Structure learning objectives',
  },

  [ProjectType.TECHNICAL_DOCUMENTATION]: {
    editorLabel: 'Docs Editor',
    editorPlaceholder: 'Document your section...',
    timelineLabel: 'Process Flow',
    eventLabel: 'Step',
    continueAction: 'Next Section',
    summaryAction: 'Generate Index',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Section',
    editStructureLabel: 'Edit Section',
    description: 'Technical documentation',
    guidelines: 'Be clear and precise',
  },

  [ProjectType.BUSINESS_BOOK]: {
    editorLabel: 'Book Editor',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Framework Progression',
    eventLabel: 'Chapter',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Business book with frameworks',
    guidelines: 'Include real-world examples',
  },

  [ProjectType.MANAGEMENT_BOOK]: {
    editorLabel: 'Book Editor',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Content Arc',
    eventLabel: 'Chapter',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Management book',
    guidelines: 'Make it actionable',
  },

  [ProjectType.SELF_HELP_BOOK]: {
    editorLabel: 'Book Editor',
    editorPlaceholder: 'Write your chapter...',
    timelineLabel: 'Transformation Arc',
    eventLabel: 'Chapter',
    continueAction: 'Continue Writing',
    summaryAction: 'Generate Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Chapter',
    editStructureLabel: 'Edit Chapter',
    description: 'Self-help/personal development book',
    guidelines: 'Focus on reader transformation',
  },

  [ProjectType.LEGAL_DOCUMENT]: {
    editorLabel: 'Doc Editor',
    editorPlaceholder: 'Write your section...',
    timelineLabel: 'Document Flow',
    eventLabel: 'Section',
    continueAction: 'Add Section',
    summaryAction: 'Generate Index',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Section',
    editStructureLabel: 'Edit Section',
    description: 'Legal document',
    guidelines: 'Follow legal conventions',
  },

  [ProjectType.PERSONAL_JOURNAL]: {
    editorLabel: 'Journal Entry',
    editorPlaceholder: 'What\'s on your mind today?',
    timelineLabel: 'Timeline',
    eventLabel: 'Entry',
    continueAction: 'Continue Entry',
    summaryAction: 'Extract Themes',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Entry',
    editStructureLabel: 'Edit Entry',
    description: 'Personal journal',
    guidelines: 'Write freely and reflectively',
  },

  [ProjectType.EXPERIMENTAL]: {
    editorLabel: 'Editor',
    editorPlaceholder: 'Start writing...',
    timelineLabel: 'Timeline',
    eventLabel: 'Event',
    continueAction: 'Continue',
    summaryAction: 'Summary',
    saveIndicator: 'Last saved',
    newStructureLabel: 'New Item',
    editStructureLabel: 'Edit Item',
    description: 'Experimental project',
    guidelines: 'Try anything',
  },
};

// Default terminology (fallback)
const DEFAULT_TERMINOLOGY: TerminologyConfig = PROJECT_TERMINOLOGY[ProjectType.NOVEL];

/**
 * Get terminology config for a given project type
 */
export function getTerminology(projectType?: ProjectType | string): TerminologyConfig {
  if (!projectType) {
    return DEFAULT_TERMINOLOGY;
  }
  
  const config = PROJECT_TERMINOLOGY[projectType as keyof typeof PROJECT_TERMINOLOGY];
  return config || DEFAULT_TERMINOLOGY;
}

/**
 * React Hook for using terminology in components
 * Usage: const terms = useTerminology(projectType);
 */
export function useTerminology(projectType?: ProjectType | string) {
  return getTerminology(projectType);
}
