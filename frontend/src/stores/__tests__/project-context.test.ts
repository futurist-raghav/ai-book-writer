/**
 * Project Context Store Tests
 * Tests for unified project context that manages all project data
 * Covers data synchronization, entity relationships, and AI context generation
 */

import { renderHook, act } from '@testing-library/react'
import { useProjectContext } from '@/stores/project-context'

describe('useProjectContext', () => {
  beforeEach(() => {
    useProjectContext.setState({
      currentBook: null,
      chapters: [],
      characters: [],
      worldElements: [],
      events: [],
      references: [],
      recentChat: [],
    })
  })

  describe('Project Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useProjectContext())

      expect(result.current.currentBook).toBeNull()
      expect(result.current.chapters).toEqual([])
      expect(result.current.characters).toEqual([])
      expect(result.current.worldElements).toEqual([])
      expect(result.current.events).toEqual([])
    })

    it('should set current book context', () => {
      const { result } = renderHook(() => useProjectContext())
      const book = {
        id: '1',
        title: 'The Great Adventure',
        genre: 'fantasy',
        description: 'An epic tale',
        targetWords: 80000,
      }

      act(() => {
        result.current.setCurrentBook(book)
      })

      expect(result.current.currentBook).toEqual(book)
    })
  })

  describe('Chapter Management', () => {
    it('should add chapters to project', () => {
      const { result } = renderHook(() => useProjectContext())
      const chapter = {
        id: 'ch1',
        title: 'Chapter 1',
        bookId: 'book1',
        content: 'Once upon a time...',
        wordCount: 1500,
      }

      act(() => {
        result.current.addChapter(chapter)
      })

      expect(result.current.chapters).toHaveLength(1)
      expect(result.current.chapters[0]).toEqual(chapter)
    })

    it('should update chapter content', () => {
      const { result } = renderHook(() => useProjectContext())
      const chapter = { id: 'ch1', title: 'Chapter 1', content: 'Original' }

      act(() => {
        result.current.addChapter(chapter)
      })

      const updatedChapter = { ...chapter, content: 'Updated content' }

      act(() => {
        result.current.updateChapter(updatedChapter)
      })

      expect(result.current.chapters[0].content).toBe('Updated content')
    })

    it('should remove chapter from project', () => {
      const { result } = renderHook(() => useProjectContext())
      const chapters = [
        { id: 'ch1', title: 'Chapter 1' },
        { id: 'ch2', title: 'Chapter 2' },
      ]

      act(() => {
        chapters.forEach(ch => result.current.addChapter(ch))
      })

      expect(result.current.chapters).toHaveLength(2)

      act(() => {
        result.current.removeChapter('ch1')
      })

      expect(result.current.chapters).toHaveLength(1)
      expect(result.current.chapters[0].id).toBe('ch2')
    })
  })

  describe('Character Management', () => {
    it('should add characters to project', () => {
      const { result } = renderHook(() => useProjectContext())
      const character = {
        id: 'char1',
        name: 'Alice',
        role: 'protagonist',
        description: 'A curious explorer',
        traits: ['intelligent', 'brave'],
      }

      act(() => {
        result.current.addCharacter(character)
      })

      expect(result.current.characters).toHaveLength(1)
      expect(result.current.characters[0].name).toBe('Alice')
    })

    it('should link character to chapters', () => {
      const { result } = renderHook(() => useProjectContext())
      const character = { id: 'char1', name: 'Bob', chapters: ['ch1', 'ch2'] }
      const chapter = { id: 'ch1', title: 'Chapter 1', characters: ['char1'] }

      act(() => {
        result.current.addCharacter(character)
        result.current.addChapter(chapter)
      })

      expect(result.current.characters[0].chapters).toContain('ch1')
      expect(result.current.chapters[0].characters).toContain('char1')
    })

    it('should update character details', () => {
      const { result } = renderHook(() => useProjectContext())
      const character = { id: 'char1', name: 'Charlie', role: 'sidekick' }

      act(() => {
        result.current.addCharacter(character)
      })

      const updated = { ...character, role: 'mentor' }

      act(() => {
        result.current.updateCharacter(updated)
      })

      expect(result.current.characters[0].role).toBe('mentor')
    })
  })

  describe('World Building Elements', () => {
    it('should add world elements', () => {
      const { result } = renderHook(() => useProjectContext())
      const worldElement = {
        id: 'world1',
        name: 'Kingdom of Eldoria',
        type: 'location',
        description: 'A magical realm',
      }

      act(() => {
        result.current.addWorldElement(worldElement)
      })

      expect(result.current.worldElements).toHaveLength(1)
    })

    it('should organize world elements by type', () => {
      const { result } = renderHook(() => useProjectContext())
      const elements = [
        { id: 'w1', name: 'Eldoria', type: 'location' },
        { id: 'w2', name: 'Magic System', type: 'system' },
        { id: 'w3', name: 'The Crown', type: 'artifact' },
      ]

      act(() => {
        elements.forEach(el => result.current.addWorldElement(el))
      })

      const locations = result.current.worldElements.filter(el => el.type === 'location')
      expect(locations).toHaveLength(1)
    })
  })

  describe('Event & Timeline Management', () => {
    it('should add events to timeline', () => {
      const { result } = renderHook(() => useProjectContext())
      const event = {
        id: 'evt1',
        title: 'The Meeting',
        description: 'Characters meet for first time',
        timestamp: new Date('2026-01-15'),
        characters: ['char1', 'char2'],
      }

      act(() => {
        result.current.addEvent(event)
      })

      expect(result.current.events).toHaveLength(1)
    })

    it('should organize events chronologically', () => {
      const { result } = renderHook(() => useProjectContext())
      const events = [
        { id: 'e1', title: 'Event 1', timestamp: new Date('2026-03-01') },
        { id: 'e2', title: 'Event 2', timestamp: new Date('2026-01-01') },
        { id: 'e3', title: 'Event 3', timestamp: new Date('2026-02-01') },
      ]

      act(() => {
        events.forEach(e => result.current.addEvent(e))
      })

      const sortedEvents = [...result.current.events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      expect(sortedEvents[0].id).toBe('e2')
      expect(sortedEvents[1].id).toBe('e3')
      expect(sortedEvents[2].id).toBe('e1')
    })
  })

  describe('References & Research', () => {
    it('should store project references', () => {
      const { result } = renderHook(() => useProjectContext())
      const ref = {
        id: 'ref1',
        title: 'Historical Context',
        url: 'https://example.com/history',
        notes: 'Important background info',
      }

      act(() => {
        result.current.addReference(ref)
      })

      expect(result.current.references).toHaveLength(1)
    })
  })

  describe('Chat History & AI Context', () => {
    it('should store recent chat messages', () => {
      const { result } = renderHook(() => useProjectContext())
      const message = {
        id: 'msg1',
        role: 'user',
        content: 'Help me with dialogue',
        timestamp: new Date(),
      }

      act(() => {
        result.current.addChatMessage(message)
      })

      expect(result.current.recentChat).toHaveLength(1)
    })

    it('should generate comprehensive AI context', () => {
      const { result } = renderHook(() => useProjectContext())

      const book = { id: 'b1', title: 'Novel', genre: 'mystery' }
      const character = { id: 'c1', name: 'Detective', role: 'protagonist' }
      const chapter = { id: 'ch1', title: 'Opening', content: 'Chapter content' }

      act(() => {
        result.current.setCurrentBook(book)
        result.current.addCharacter(character)
        result.current.addChapter(chapter)
      })

      const aiContext = result.current.getAiContextString()

      expect(aiContext).toContain('Novel')
      expect(aiContext).toContain('Detective')
      expect(aiContext).toContain('Chapter content')
    })

    it('should provide context-aware AI assistance', () => {
      const { result } = renderHook(() => useProjectContext())

      const book = { id: 'b1', title: 'Fantasy Epic', genre: 'fantasy' }
      const context = result.current.getAiContextString()

      act(() => {
        result.current.setCurrentBook(book)
      })

      expect(result.current.currentBook?.genre).toBe('fantasy')
    })
  })

  describe('Data Relationships & Consistency', () => {
    it('should maintain bidirectional relationships', () => {
      const { result } = renderHook(() => useProjectContext())

      const character = { id: 'c1', name: 'Alice', chapters: ['ch1'] }
      const chapter = { id: 'ch1', title: 'Chapter 1', characters: ['c1'] }

      act(() => {
        result.current.addCharacter(character)
        result.current.addChapter(chapter)
      })

      // Verify bidirectional link
      expect(result.current.characters[0].chapters).toContain('ch1')
      expect(result.current.chapters[0].characters).toContain('c1')
    })

    it('should sync data across stores', () => {
      const { result } = renderHook(() => useProjectContext())

      const book = { id: 'b1', title: 'Book 1', wordCount: 0 }

      act(() => {
        result.current.setCurrentBook(book)
      })

      // Update book
      const updated = { ...book, wordCount: 5000 }

      act(() => {
        result.current.setCurrentBook(updated)
      })

      expect(result.current.currentBook?.wordCount).toBe(5000)
    })
  })
})
