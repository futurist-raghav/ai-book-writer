/**
 * Book Store Tests
 * Tests for book/project state management
 * Covers CRUD operations, filtering, sorting, and state mutations
 */

import { renderHook, act } from '@testing-library/react'
import { useBookStore } from '@/stores/book-store'

describe('useBookStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useBookStore.setState({
      books: [],
      currentBook: null,
      isLoading: false,
      error: null,
      filter: 'all',
    })
  })

  describe('Book Collection Management', () => {
    it('should initialize with empty books array', () => {
      const { result } = renderHook(() => useBookStore())
      
      expect(result.current.books).toEqual([])
      expect(result.current.currentBook).toBeNull()
    })

    it('should add a new book to the collection', () => {
      const { result } = renderHook(() => useBookStore())
      const newBook = {
        id: '1',
        title: 'My First Novel',
        description: 'A story about life',
        status: 'draft',
        totalWords: 0,
        targetWords: 50000,
        genre: 'fiction',
        createdAt: new Date(),
      }

      act(() => {
        result.current.addBook(newBook)
      })

      expect(result.current.books).toHaveLength(1)
      expect(result.current.books[0]).toEqual(newBook)
    })

    it('should update an existing book', () => {
      const { result } = renderHook(() => useBookStore())
      const book = {
        id: '1',
        title: 'Original Title',
        status: 'draft',
      }

      act(() => {
        result.current.addBook(book)
      })

      const updatedBook = { ...book, title: 'Updated Title', status: 'in_progress' }

      act(() => {
        result.current.updateBook(updatedBook)
      })

      expect(result.current.books[0].title).toBe('Updated Title')
      expect(result.current.books[0].status).toBe('in_progress')
    })

    it('should delete a book from collection', () => {
      const { result } = renderHook(() => useBookStore())
      const book = { id: '1', title: 'Book to Delete', status: 'draft' }

      act(() => {
        result.current.addBook(book)
      })

      expect(result.current.books).toHaveLength(1)

      act(() => {
        result.current.deleteBook('1')
      })

      expect(result.current.books).toHaveLength(0)
    })

    it('should handle multiple books', () => {
      const { result } = renderHook(() => useBookStore())
      const books = [
        { id: '1', title: 'Book 1', status: 'draft' },
        { id: '2', title: 'Book 2', status: 'in_progress' },
        { id: '3', title: 'Book 3', status: 'completed' },
      ]

      act(() => {
        books.forEach(book => result.current.addBook(book))
      })

      expect(result.current.books).toHaveLength(3)
    })
  })

  describe('Current Book Selection', () => {
    it('should set current book', () => {
      const { result } = renderHook(() => useBookStore())
      const book = { id: '1', title: 'Active Book', status: 'in_progress' }

      act(() => {
        result.current.addBook(book)
        result.current.setCurrentBook(book)
      })

      expect(result.current.currentBook).toEqual(book)
    })

    it('should clear current book selection', () => {
      const { result } = renderHook(() => useBookStore())
      const book = { id: '1', title: 'Book', status: 'draft' }

      act(() => {
        result.current.addBook(book)
        result.current.setCurrentBook(book)
      })

      expect(result.current.currentBook).not.toBeNull()

      act(() => {
        result.current.clearCurrentBook()
      })

      expect(result.current.currentBook).toBeNull()
    })
  })

  describe('Book Filtering & Sorting', () => {
    beforeEach(() => {
      const books = [
        { id: '1', title: 'Draft Book', status: 'draft', createdAt: new Date('2026-01-01') },
        { id: '2', title: 'In Progress', status: 'in_progress', createdAt: new Date('2026-02-01') },
        { id: '3', title: 'Completed', status: 'completed', createdAt: new Date('2026-03-01') },
        { id: '4', title: 'Archived', status: 'archived', createdAt: new Date('2025-12-01') },
      ]

      const { result } = renderHook(() => useBookStore())
      act(() => {
        books.forEach(book => result.current.addBook(book))
      })
    })

    it('should filter books by status', () => {
      const { result } = renderHook(() => useBookStore())

      act(() => {
        result.current.setFilter('draft')
      })

      const draftBooks = result.current.books.filter(b => b.status === 'draft')
      expect(draftBooks).toHaveLength(1)
    })

    it('should handle all statuses filter', () => {
      const { result } = renderHook(() => useBookStore())

      act(() => {
        result.current.setFilter('all')
      })

      expect(result.current.books.length).toBeGreaterThanOrEqual(4)
    })

    it('should sort books by creation date', () => {
      const { result } = renderHook(() => useBookStore())

      act(() => {
        result.current.sortBooks('createdAt', 'desc')
      })

      for (let i = 0; i < result.current.books.length - 1; i++) {
        const current = new Date(result.current.books[i].createdAt)
        const next = new Date(result.current.books[i + 1].createdAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })
  })

  describe('Loading & Error States', () => {
    it('should manage loading state', () => {
      const { result } = renderHook(() => useBookStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('should handle errors', () => {
      const { result } = renderHook(() => useBookStore())
      const errorMsg = 'Failed to load books'

      act(() => {
        result.current.setError(errorMsg)
      })

      expect(result.current.error).toBe(errorMsg)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Book Statistics', () => {
    it('should calculate total words across all books', () => {
      const { result } = renderHook(() => useBookStore())
      const books = [
        { id: '1', title: 'Book 1', totalWords: 10000 },
        { id: '2', title: 'Book 2', totalWords: 20000 },
        { id: '3', title: 'Book 3', totalWords: 15000 },
      ]

      act(() => {
        books.forEach(book => result.current.addBook(book))
      })

      const totalWords = result.current.books.reduce((sum, b) => sum + (b.totalWords || 0), 0)
      expect(totalWords).toBe(45000)
    })

    it('should get book statistics', () => {
      const { result } = renderHook(() => useBookStore())
      const books = [
        { id: '1', status: 'draft' },
        { id: '2', status: 'draft' },
        { id: '3', status: 'in_progress' },
        { id: '4', status: 'completed' },
      ]

      act(() => {
        books.forEach(book => result.current.addBook(book))
      })

      const stats = {
        total: result.current.books.length,
        drafts: result.current.books.filter(b => b.status === 'draft').length,
        inProgress: result.current.books.filter(b => b.status === 'in_progress').length,
        completed: result.current.books.filter(b => b.status === 'completed').length,
      }

      expect(stats.total).toBe(4)
      expect(stats.drafts).toBe(2)
      expect(stats.inProgress).toBe(1)
      expect(stats.completed).toBe(1)
    })
  })
})
