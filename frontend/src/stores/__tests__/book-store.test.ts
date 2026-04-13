import { act, renderHook } from '@testing-library/react';
import { useBookStore } from '@/stores/book-store';

const makeBook = (id: string, title: string, status = 'draft') => ({
  id,
  title,
  chapter_count: 0,
  word_count: 0,
  status,
  created_at: new Date().toISOString(),
});

const makeEvent = (id: string, title: string) => ({
  id,
  title,
  content: 'Event content',
  is_featured: false,
  order_index: 1,
  created_at: new Date().toISOString(),
});

describe('useBookStore', () => {
  beforeEach(() => {
    useBookStore.setState({
      events: [],
      selectedEvents: new Set(),
      eventFilter: {},
      chapters: [],
      selectedChapter: null,
      books: [],
      selectedBook: null,
    });
    localStorage.clear();
  });

  it('adds and updates a book', () => {
    const { result } = renderHook(() => useBookStore());

    act(() => {
      result.current.addBook(makeBook('book-1', 'First Book'));
    });

    expect(result.current.books).toHaveLength(1);
    expect(result.current.books[0].title).toBe('First Book');

    act(() => {
      result.current.updateBook('book-1', { title: 'Updated Title', status: 'in_progress' });
    });

    expect(result.current.books[0].title).toBe('Updated Title');
    expect(result.current.books[0].status).toBe('in_progress');
  });

  it('selects then clears selected book on removal', () => {
    const { result } = renderHook(() => useBookStore());
    const book = makeBook('book-1', 'Selectable');

    act(() => {
      result.current.addBook(book);
      result.current.selectBook(book);
    });

    expect(result.current.selectedBook?.id).toBe('book-1');

    act(() => {
      result.current.removeBook('book-1');
    });

    expect(result.current.books).toHaveLength(0);
    expect(result.current.selectedBook).toBeNull();
  });

  it('toggles event selection and clears on removal', () => {
    const { result } = renderHook(() => useBookStore());

    act(() => {
      result.current.addEvent(makeEvent('event-1', 'Scene One'));
      result.current.toggleEventSelection('event-1');
    });

    expect(result.current.selectedEvents.has('event-1')).toBe(true);

    act(() => {
      result.current.removeEvent('event-1');
    });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.selectedEvents.has('event-1')).toBe(false);
  });
});
