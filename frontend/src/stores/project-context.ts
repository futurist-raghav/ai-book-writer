import { create } from 'zustand';

/**
 * UNIFIED PROJECT CONTEXT
 * This is the single source of truth for all project data.
 * All features (AI, STT, Editor, Events, etc.) use this store to access and update project state.
 * This fixes the "features work in isolation" problem by ensuring deep interconnectedness.
 */

// ==================== TYPE DEFINITIONS ====================

export interface Character {
  id: string;
  name: string;
  role: string;
  description?: string;
  traits?: string[];
  relationships?: { characterId: string; nature: string }[];
  appearances: string[]; // Chapter IDs where character appears
  created_at: string;
}

export interface WorldElement {
  id: string;
  name: string;
  type: 'location' | 'faction' | 'magic_system' | 'culture' | 'technology' | 'other';
  description?: string;
  connections?: { elementId: string; nature: string }[];
  appearances: string[]; // Chapter IDs where element appears created_at: string;
}

export interface ChapterEvent {
  id: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  location?: string;
  people?: string[]; // Character IDs
  world_elements?: string[]; // World element IDs
  sentiment?: 'positive' | 'neutral' | 'negative';
  is_featured: boolean;
  order_index: number;
  created_at: string;
}

export interface AudioNote {
  id: string;
  chapter_id?: string;
  title: string;
  transcription?: string;
  summary?: string;
  keywords?: string[];
  duration: number;
  created_at: string;
}

export interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  chapter_number: number;
  synopsis?: string;
  compiled_content?: string;
  word_count: number;
  event_count: number;
  
  // Connected data
  events: ChapterEvent[];
  audio_notes: AudioNote[];
  characters_involved: string[]; // Character IDs
  world_elements: string[]; // World element IDs
  
  // Editor state
  draft_content?: string;
  editor_state?: Record<string, unknown>; // Tiptap state
  
  created_at: string;
  last_edited: string;
}

export interface ProjectMetadata {
  genres: string[];
  themes: string[];
  book_type: string;
  writing_form: 'narrative' | 'memoir' | 'chronological' | 'descriptive';
  writing_tone: 'neutral' | 'reflective' | 'dramatic' | 'analytical';
  target_audience?: string;
  content_warnings?: string[];
  illustration_plan?: Record<string, unknown>;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author_name?: string;
  description?: string;
  
  // Core metadata
  metadata: ProjectMetadata;
  
  // Table of contents (outline)
  outline?: {
    book_intro?: string;
    table_of_contents?: string;
    sections?: { id: string; title: string; chapter_ids: string[] }[];
  };
  
  // Project state
  chapter_count: number;
  word_count: number;
  status: 'draft' | 'in_progress' | 'review' | 'published' | 'archived';
  
  // Export settings
  export_formats?: ('pdf' | 'epub' | 'mobi' | 'docx')[];
  
  created_at: string;
  last_edited: string;
}

export interface ProjectContextState {
  // Current project
  activeBook: Book | null;
  activeChapter: Chapter | null;
  
  // All project data
  books: Book[];
  chapters: Chapter[];
  characters: Character[];
  worldElements: WorldElement[];
  audioNotes: AudioNote[];
  
  // Selection state
  selectedCharacterIds: Set<string>;
  selectedWorldElementIds: Set<string>;
  selectedEventIds: Set<string>;
  
  // AI context (what context is currently available to AI)
  aiContextMetadata: {
    projectId: string;
    chapterId?: string;
    characterIds?: string[];
    worldElementIds?: string[];
    recentEvents?: string[];
  };
  
  // =========== BOOK ACTIONS ===========
  setActiveBook: (book: Book | null) => void;
  updateBook: (bookId: string, updates: Partial<Book>) => void;
  
  // =========== CHAPTER ACTIONS ===========
  setActiveChapter: (chapter: Chapter | null) => void;
  updateChapter: (chapterId: string, updates: Partial<Chapter>) => void;
  updateChapterContent: (chapterId: string, content: string) => void;
  updateChapterEditorState: (chapterId: string, state: Record<string, unknown>) => void;
  
  // =========== CHARACTER ACTIONS ===========
  addCharacter: (character: Character) => void;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  linkCharacterToChapter: (characterId: string, chapterId: string) => void;
  unlinkCharacterFromChapter: (characterId: string, chapterId: string) => void;
  
  // =========== WORLD BUILDING ACTIONS ===========
  addWorldElement: (element: WorldElement) => void;
  updateWorldElement: (elementId: string, updates: Partial<WorldElement>) => void;
  linkWorldElementToChapter: (elementId: string, chapterId: string) => void;
  unlinkWorldElementFromChapter: (elementId: string, chapterId: string) => void;
  
  // =========== EVENT/TIMELINE ACTIONS ===========
  addEventToChapter: (chapterId: string, event: ChapterEvent) => void;
  updateEvent: (chapterId: string, eventId: string, updates: Partial<ChapterEvent>) => void;
  removeEvent: (chapterId: string, eventId: string) => void;
  linkEventToCharacters: (chapterId: string, eventId: string, characterIds: string[]) => void;
  linkEventToWorldElements: (chapterId: string, eventId: string, elementIds: string[]) => void;
  
  // =========== AUDIO NOTES ACTIONS ===========
  addAudioNote: (note: AudioNote) => void;
  updateAudioNote: (noteId: string, updates: Partial<AudioNote>) => void;
  linkAudioNoteToChapter: (noteId: string, chapterId: string) => void;
  transcribeAudioNote: (noteId: string, transcription: string, summary?: string) => void;
  
  // =========== SELECTION ACTIONS ===========
  toggleCharacterSelection: (characterId: string) => void;
  toggleWorldElementSelection: (elementId: string) => void;
  toggleEventSelection: (eventId: string) => void;
  clearSelections: () => void;
  
  // =========== AI CONTEXT ACTIONS ===========
  updateAiContext: (context: Partial<ProjectContextState['aiContextMetadata']>) => void;
  getAiContextString: () => string; // Generate a context string for AI
  
  // =========== HYDRATION ===========
  hydrateFromApi: (
    book: Book,
    chapters: Chapter[],
    characters: Character[],
    worldElements: WorldElement[],
    audioNotes: AudioNote[]
  ) => void;
}

// ==================== STORE CREATION ====================

export const useProjectContext = create<ProjectContextState>((set, get) => ({
  activeBook: null,
  activeChapter: null,
  books: [],
  chapters: [],
  characters: [],
  worldElements: [],
  audioNotes: [],
  selectedCharacterIds: new Set(),
  selectedWorldElementIds: new Set(),
  selectedEventIds: new Set(),
  aiContextMetadata: {
    projectId: '',
  },
  
  // =========== BOOK ACTIONS ===========
  setActiveBook: (book) => set({ activeBook: book }),
  
  updateBook: (bookId, updates) =>
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? { ...b, ...updates } : b)),
      activeBook: state.activeBook?.id === bookId ? { ...state.activeBook, ...updates } : state.activeBook,
    })),
  
  // =========== CHAPTER ACTIONS ===========
  setActiveChapter: (chapter) => set({ activeChapter: chapter }),
  
  updateChapter: (chapterId, updates) =>
    set((state) => ({
      chapters: state.chapters.map((c) => (c.id === chapterId ? { ...c, ...updates } : c)),
      activeChapter: state.activeChapter?.id === chapterId ? { ...state.activeChapter, ...updates } : state.activeChapter,
    })),
  
  updateChapterContent: (chapterId, content) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId ? { ...c, draft_content: content, last_edited: new Date().toISOString() } : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, draft_content: content, last_edited: new Date().toISOString() }
          : state.activeChapter,
    })),
  
  updateChapterEditorState: (chapterId, state_data) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId ? { ...c, editor_state: state_data } : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, editor_state: state_data }
          : state.activeChapter,
    })),
  
  // =========== CHARACTER ACTIONS ===========
  addCharacter: (character) =>
    set((state) => ({ characters: [...state.characters, character] })),
  
  updateCharacter: (characterId, updates) =>
    set((state) => ({
      characters: state.characters.map((c) => (c.id === characterId ? { ...c, ...updates } : c)),
    })),
  
  linkCharacterToChapter: (characterId, chapterId) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              characters_involved: Array.from(new Set([...c.characters_involved, characterId])),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              characters_involved: Array.from(new Set([...state.activeChapter.characters_involved, characterId])),
            }
          : state.activeChapter,
    })),
  
  unlinkCharacterFromChapter: (characterId, chapterId) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              characters_involved: c.characters_involved.filter((id) => id !== characterId),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              characters_involved: state.activeChapter.characters_involved.filter((id) => id !== characterId),
            }
          : state.activeChapter,
    })),
  
  // =========== WORLD BUILDING ACTIONS ===========
  addWorldElement: (element) =>
    set((state) => ({ worldElements: [...state.worldElements, element] })),
  
  updateWorldElement: (elementId, updates) =>
    set((state) => ({
      worldElements: state.worldElements.map((e) => (e.id === elementId ? { ...e, ...updates } : e)),
    })),
  
  linkWorldElementToChapter: (elementId, chapterId) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              world_elements: Array.from(new Set([...c.world_elements, elementId])),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              world_elements: Array.from(new Set([...state.activeChapter.world_elements, elementId])),
            }
          : state.activeChapter,
    })),
  
  unlinkWorldElementFromChapter: (elementId, chapterId) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              world_elements: c.world_elements.filter((id) => id !== elementId),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              world_elements: state.activeChapter.world_elements.filter((id) => id !== elementId),
            }
          : state.activeChapter,
    })),
  
  // =========== EVENT/TIMELINE ACTIONS ===========
  addEventToChapter: (chapterId, event) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              events: [...c.events, event],
              event_count: c.event_count + 1,
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              events: [...state.activeChapter.events, event],
              event_count: state.activeChapter.event_count + 1,
            }
          : state.activeChapter,
    })),
  
  updateEvent: (chapterId, eventId, updates) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              events: c.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              events: state.activeChapter.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
            }
          : state.activeChapter,
    })),
  
  removeEvent: (chapterId, eventId) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              events: c.events.filter((e) => e.id !== eventId),
              event_count: Math.max(0, c.event_count - 1),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              events: state.activeChapter.events.filter((e) => e.id !== eventId),
              event_count: Math.max(0, state.activeChapter.event_count - 1),
            }
          : state.activeChapter,
    })),
  
  linkEventToCharacters: (chapterId, eventId, characterIds) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              events: c.events.map((e) =>
                e.id === eventId ? { ...e, people: Array.from(new Set([...(e.people || []), ...characterIds])) } : e
              ),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              events: state.activeChapter.events.map((e) =>
                e.id === eventId ? { ...e, people: Array.from(new Set([...(e.people || []), ...characterIds])) } : e
              ),
            }
          : state.activeChapter,
    })),
  
  linkEventToWorldElements: (chapterId, eventId, elementIds) =>
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              events: c.events.map((e) =>
                e.id === eventId ? { ...e, world_elements: Array.from(new Set([...(e.world_elements || []), ...elementIds])) } : e
              ),
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              events: state.activeChapter.events.map((e) =>
                e.id === eventId ? { ...e, world_elements: Array.from(new Set([...(e.world_elements || []), ...elementIds])) } : e
              ),
            }
          : state.activeChapter,
    })),
  
  // =========== AUDIO NOTES ACTIONS ===========
  addAudioNote: (note) =>
    set((state) => ({ audioNotes: [...state.audioNotes, note] })),
  
  updateAudioNote: (noteId, updates) =>
    set((state) => ({
      audioNotes: state.audioNotes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)),
    })),
  
  linkAudioNoteToChapter: (noteId, chapterId) =>
    set((state) => ({
      audioNotes: state.audioNotes.map((n) => (n.id === noteId ? { ...n, chapter_id: chapterId } : n)),
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              audio_notes: [...c.audio_notes, state.audioNotes.find((n) => n.id === noteId)!],
            }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? {
              ...state.activeChapter,
              audio_notes: [...state.activeChapter.audio_notes, state.audioNotes.find((n) => n.id === noteId)!],
            }
          : state.activeChapter,
    })),
  
  transcribeAudioNote: (noteId, transcription, summary) =>
    set((state) => ({
      audioNotes: state.audioNotes.map((n) =>
        n.id === noteId ? { ...n, transcription, summary: summary || n.summary } : n
      ),
    })),
  
  // =========== SELECTION ACTIONS ===========
  toggleCharacterSelection: (characterId) =>
    set((state) => {
      const newSelected = new Set(state.selectedCharacterIds);
      if (newSelected.has(characterId)) {
        newSelected.delete(characterId);
      } else {
        newSelected.add(characterId);
      }
      return { selectedCharacterIds: newSelected };
    }),
  
  toggleWorldElementSelection: (elementId) =>
    set((state) => {
      const newSelected = new Set(state.selectedWorldElementIds);
      if (newSelected.has(elementId)) {
        newSelected.delete(elementId);
      } else {
        newSelected.add(elementId);
      }
      return { selectedWorldElementIds: newSelected };
    }),
  
  toggleEventSelection: (eventId) =>
    set((state) => {
      const newSelected = new Set(state.selectedEventIds);
      if (newSelected.has(eventId)) {
        newSelected.delete(eventId);
      } else {
        newSelected.add(eventId);
      }
      return { selectedEventIds: newSelected };
    }),
  
  clearSelections: () =>
    set({
      selectedCharacterIds: new Set(),
      selectedWorldElementIds: new Set(),
      selectedEventIds: new Set(),
    }),
  
  // =========== AI CONTEXT ACTIONS ===========
  updateAiContext: (context) =>
    set((state) => ({
      aiContextMetadata: { ...state.aiContextMetadata, ...context },
    })),
  
  getAiContextString: () => {
    const state = get();
    if (!state.activeBook || !state.activeChapter) {
      return '';
    }
    
    const chapterCharacters = state.activeChapter.characters_involved
      .map((id) => state.characters.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => `- ${c?.name} (${c?.role}): ${c?.description}`)
      .join('\n');
    
    const chapterWorldElements = state.activeChapter.world_elements
      .map((id) => state.worldElements.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => `- ${e?.name} (${e?.type}): ${e?.description}`)
      .join('\n');
    
    const chapterEvents = state.activeChapter.events
      .slice(0, 5) // Last 5 events for context
      .map((e) => `- ${e.title}: ${e.summary || e.content.substring(0, 100)}`)
      .join('\n');
    
    return `
PROJECT: "${state.activeBook.title}"
CHAPTER: "${state.activeChapter.title}" (#${state.activeChapter.chapter_number})

GENRE: ${state.activeBook.metadata.genres.join(', ')}
WRITING STYLE: ${state.activeBook.metadata.writing_form}
TONE: ${state.activeBook.metadata.writing_tone}

CHAPTER CHARACTERS:
${chapterCharacters || '(no characters yet)'}

WORLD ELEMENTS:
${chapterWorldElements || '(no world elements yet)'}

RECENT EVENTS:
${chapterEvents || '(no events yet)'}

CURRENT SYNOPSIS:
${state.activeChapter.synopsis || '(no synopsis yet)'}
    `.trim();
  },
  
  // =========== HYDRATION ===========
  hydrateFromApi: (book, chapters, characters, worldElements, audioNotes) =>
    set({
      activeBook: book,
      books: [book],
      chapters,
      characters,
      worldElements,
      audioNotes,
    }),
}));
