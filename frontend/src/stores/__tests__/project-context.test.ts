import { act, renderHook } from '@testing-library/react';
import {
  useProjectContext,
  type Book,
  type Chapter,
  type Character,
  type WorldElement,
  type AudioNote,
  type ChapterEvent,
} from '@/stores/project-context';

const makeBook = (): Book => ({
  id: 'book-1',
  title: 'Project Atlas',
  metadata: {
    genres: ['fantasy'],
    themes: ['identity'],
    book_type: 'novel',
    writing_form: 'narrative',
    writing_tone: 'reflective',
  },
  chapter_count: 1,
  word_count: 1200,
  status: 'in_progress',
  created_at: new Date().toISOString(),
  last_edited: new Date().toISOString(),
});

const makeChapter = (): Chapter => ({
  id: 'chapter-1',
  title: 'Arrival',
  chapter_number: 1,
  synopsis: 'The hero arrives in a strange city.',
  word_count: 1200,
  event_count: 0,
  events: [],
  audio_notes: [],
  characters_involved: [],
  world_elements: [],
  created_at: new Date().toISOString(),
  last_edited: new Date().toISOString(),
});

const makeCharacter = (): Character => ({
  id: 'char-1',
  name: 'Mira',
  role: 'protagonist',
  appearances: [],
  created_at: new Date().toISOString(),
});

const makeWorldElement = (): WorldElement => ({
  id: 'world-1',
  name: 'Glass Harbor',
  type: 'location',
  appearances: [],
});

const makeAudioNote = (): AudioNote => ({
  id: 'note-1',
  title: 'Voice memo',
  duration: 42,
  created_at: new Date().toISOString(),
});

const makeEvent = (): ChapterEvent => ({
  id: 'event-1',
  title: 'Dockside encounter',
  content: 'Mira meets a mysterious courier.',
  is_featured: false,
  order_index: 1,
  created_at: new Date().toISOString(),
});

describe('useProjectContext', () => {
  beforeEach(() => {
    useProjectContext.setState({
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
    });
  });

  it('hydrates state from API payload', () => {
    const { result } = renderHook(() => useProjectContext());

    const book = makeBook();
    const chapter = makeChapter();
    const character = makeCharacter();
    const worldElement = makeWorldElement();
    const note = makeAudioNote();

    act(() => {
      result.current.hydrateFromApi(book, [chapter], [character], [worldElement], [note]);
    });

    expect(result.current.activeBook?.id).toBe(book.id);
    expect(result.current.chapters).toHaveLength(1);
    expect(result.current.characters).toHaveLength(1);
    expect(result.current.worldElements).toHaveLength(1);
    expect(result.current.audioNotes).toHaveLength(1);
  });

  it('links character to chapter', () => {
    const { result } = renderHook(() => useProjectContext());

    const chapter = makeChapter();
    const character = makeCharacter();

    act(() => {
      result.current.hydrateFromApi(makeBook(), [chapter], [character], [], []);
      result.current.linkCharacterToChapter(character.id, chapter.id);
    });

    expect(result.current.chapters[0].characters_involved).toContain(character.id);
  });

  it('generates AI context string with chapter details', () => {
    const { result } = renderHook(() => useProjectContext());

    const book = makeBook();
    const chapter = makeChapter();
    const character = makeCharacter();
    const event = makeEvent();

    act(() => {
      result.current.hydrateFromApi(book, [chapter], [character], [], []);
      result.current.setActiveBook(book);
      result.current.setActiveChapter(chapter);
      result.current.linkCharacterToChapter(character.id, chapter.id);
      result.current.addEventToChapter(chapter.id, event);
    });

    const context = result.current.getAiContextString();
    expect(context).toContain('PROJECT: "Project Atlas"');
    expect(context).toContain('CHAPTER: "Arrival"');
    expect(context).toContain('Dockside encounter');
  });
});
