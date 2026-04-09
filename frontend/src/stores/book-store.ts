import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Event {
  id: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  location?: string;
  people?: string[];
  sentiment?: string;
  is_featured: boolean;
  order_index: number;
  created_at: string;
}

interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  chapter_number: number;
  synopsis?: string;
  compiled_content?: string;
  word_count: number;
  event_count: number;
  created_at: string;
}

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author_name?: string;
  description?: string;
  project_type?: string;
  metadata?: Record<string, unknown>;
  ai_enhancement_enabled?: boolean;
  chapter_count: number;
  word_count: number;
  status: string;
  created_at: string;
}

interface BookState {
  // Events
  events: Event[];
  selectedEvents: Set<string>;
  eventFilter: { category?: string; featured?: boolean };

  // Chapters
  chapters: Chapter[];
  selectedChapter: Chapter | null;

  // Books
  books: Book[];
  selectedBook: Book | null;

  // Event actions
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  removeEvent: (id: string) => void;
  toggleEventSelection: (id: string) => void;
  clearEventSelection: () => void;
  setEventFilter: (filter: { category?: string; featured?: boolean }) => void;

  // Chapter actions
  setChapters: (chapters: Chapter[]) => void;
  addChapter: (chapter: Chapter) => void;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  removeChapter: (id: string) => void;
  selectChapter: (chapter: Chapter | null) => void;

  // Book actions
  setBooks: (books: Book[]) => void;
  addBook: (book: Book) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  removeBook: (id: string) => void;
  selectBook: (book: Book | null) => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      // Initial state
      events: [],
      selectedEvents: new Set(),
      eventFilter: {},
      chapters: [],
      selectedChapter: null,
      books: [],
      selectedBook: null,

      // Event actions
      setEvents: (events) => set({ events }),

      addEvent: (event) =>
        set((state) => ({ events: [...state.events, event] })),

      updateEvent: (id, updates) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      removeEvent: (id) =>
        set((state) => {
          const selectedEvents = new Set<string>();
          state.selectedEvents.forEach((eventId) => {
            if (eventId !== id) {
              selectedEvents.add(eventId);
            }
          });

          return {
            events: state.events.filter((e) => e.id !== id),
            selectedEvents,
          };
        }),

      toggleEventSelection: (id) =>
        set((state) => {
          const newSelected = new Set(state.selectedEvents);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          return { selectedEvents: newSelected };
        }),

      clearEventSelection: () => set({ selectedEvents: new Set() }),

      setEventFilter: (filter) => set({ eventFilter: filter }),

      // Chapter actions
      setChapters: (chapters) => set({ chapters }),

      addChapter: (chapter) =>
        set((state) => ({ chapters: [...state.chapters, chapter] })),

      updateChapter: (id, updates) =>
        set((state) => ({
          chapters: state.chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
          selectedChapter:
            state.selectedChapter?.id === id
              ? { ...state.selectedChapter, ...updates }
              : state.selectedChapter,
        })),

      removeChapter: (id) =>
        set((state) => ({
          chapters: state.chapters.filter((c) => c.id !== id),
          selectedChapter: state.selectedChapter?.id === id ? null : state.selectedChapter,
        })),

      selectChapter: (chapter) => set({ selectedChapter: chapter }),

      // Book actions
      setBooks: (books) => set({ books }),

      addBook: (book) =>
        set((state) => ({ books: [...state.books, book] })),

      updateBook: (id, updates) =>
        set((state) => ({
          books: state.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
          selectedBook:
            state.selectedBook?.id === id
              ? { ...state.selectedBook, ...updates }
              : state.selectedBook,
        })),

      removeBook: (id) =>
        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
          selectedBook: state.selectedBook?.id === id ? null : state.selectedBook,
        })),

      selectBook: (book) => set({ selectedBook: book }),
    }),
    {
      name: 'book-store',
      partialize: (state) => ({
        selectedBook: state.selectedBook,
      }),
    }
  )
);
