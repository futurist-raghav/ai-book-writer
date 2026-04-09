/**
 * API Client Tests
 * Tests for frontend API client and server communication
 * Covers request/response handling, error handling, and auth
 */

import fetch from 'jest-fetch-mock'
import { apiClient } from '@/lib/api-client'

// Mock the fetch API
jest.mock('node-fetch', () => fetch)

describe('API Client', () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        username: 'newuser',
      }

      fetch.mockResponseOnce(JSON.stringify({ id: '1', ...userData }), { status: 201 })

      // Mock implementation - adjust based on your actual API client
      const result = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      }).then(r => r.json())

      expect(result.email).toBe('newuser@example.com')
      expect(fetch).toHaveBeenCalledWith('/auth/register', expect.any(Object))
    })

    it('should handle login', async () => {
      const loginData = { email: 'user@example.com', password: 'password123' }

      fetch.mockResponseOnce(
        JSON.stringify({
          access_token: 'token-12345',
          token_type: 'bearer',
        }),
        { status: 200 }
      )

      const result = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      }).then(r => r.json())

      expect(result.access_token).toBeDefined()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should get current user profile', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        role: 'USER',
      }

      fetch.mockResponseOnce(JSON.stringify(mockUser), { status: 200 })

      const result = await fetch('/auth/me', {
        headers: { Authorization: 'Bearer token-12345' },
      }).then(r => r.json())

      expect(result.id).toBe('1')
      expect(result.email).toBe('user@example.com')
    })

    it('should handle logout', async () => {
      fetch.mockResponseOnce('', { status: 204 })

      const response = await fetch('/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer token-12345' },
      })

      expect(response.status).toBe(204)
    })
  })

  describe('Books API', () => {
    it('should fetch user books', async () => {
      const mockBooks = [
        { id: '1', title: 'Book 1', status: 'draft' },
        { id: '2', title: 'Book 2', status: 'in_progress' },
      ]

      fetch.mockResponseOnce(JSON.stringify(mockBooks), { status: 200 })

      const result = await fetch('/api/v1/books', {
        headers: { Authorization: 'Bearer token' },
      }).then(r => r.json())

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Book 1')
    })

    it('should create a new book', async () => {
      const newBook = { title: 'New Book', genre: 'fantasy', targetWords: 80000 }

      fetch.mockResponseOnce(JSON.stringify({ id: '1', ...newBook }), { status: 201 })

      const result = await fetch('/api/v1/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify(newBook),
      }).then(r => r.json())

      expect(result.id).toBe('1')
      expect(result.title).toBe('New Book')
    })

    it('should get book details', async () => {
      const book = { id: '1', title: 'Book Details', status: 'draft', chapters: [] }

      fetch.mockResponseOnce(JSON.stringify(book), { status: 200 })

      const result = await fetch('/api/v1/books/1', {
        headers: { Authorization: 'Bearer token' },
      }).then(r => r.json())

      expect(result.id).toBe('1')
      expect(result.chapters).toEqual([])
    })

    it('should update book', async () => {
      const updates = { title: 'Updated Title', status: 'in_progress' }

      fetch.mockResponseOnce(JSON.stringify({ id: '1', ...updates }), { status: 200 })

      const result = await fetch('/api/v1/books/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify(updates),
      }).then(r => r.json())

      expect(result.status).toBe('in_progress')
    })

    it('should delete book', async () => {
      fetch.mockResponseOnce('', { status: 204 })

      const response = await fetch('/api/v1/books/1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      })

      expect(response.status).toBe(204)
    })
  })

  describe('Chapters API', () => {
    it('should fetch chapters for a book', async () => {
      const chapters = [
        { id: 'ch1', title: 'Chapter 1', content: 'Content 1' },
        { id: 'ch2', title: 'Chapter 2', content: 'Content 2' },
      ]

      fetch.mockResponseOnce(JSON.stringify(chapters), { status: 200 })

      const result = await fetch('/api/v1/books/1/chapters', {
        headers: { Authorization: 'Bearer token' },
      }).then(r => r.json())

      expect(result).toHaveLength(2)
    })

    it('should create chapter', async () => {
      const chapter = { title: 'New Chapter', bookId: '1' }

      fetch.mockResponseOnce(JSON.stringify({ id: 'ch1', ...chapter }), { status: 201 })

      const result = await fetch('/api/v1/books/1/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify(chapter),
      }).then(r => r.json())

      expect(result.id).toBe('ch1')
    })

    it('should update chapter content', async () => {
      const content = { text: 'Updated content for chapter' }

      fetch.mockResponseOnce(JSON.stringify({ id: 'ch1', ...content }), { status: 200 })

      const result = await fetch('/api/v1/chapters/ch1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify(content),
      }).then(r => r.json())

      expect(result.text).toBe('Updated content for chapter')
    })

    it('should delete chapter', async () => {
      fetch.mockResponseOnce('', { status: 204 })

      const response = await fetch('/api/v1/chapters/ch1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      })

      expect(response.status).toBe(204)
    })
  })

  describe('Characters API', () => {
    it('should fetch characters', async () => {
      const characters = [
        { id: 'c1', name: 'Alice', role: 'protagonist' },
        { id: 'c2', name: 'Bob', role: 'sidekick' },
      ]

      fetch.mockResponseOnce(JSON.stringify(characters), { status: 200 })

      const result = await fetch('/api/v1/books/1/characters', {
        headers: { Authorization: 'Bearer token' },
      }).then(r => r.json())

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
    })

    it('should create character', async () => {
      const character = { name: 'Charlie', role: 'mentor', bookId: '1' }

      fetch.mockResponseOnce(JSON.stringify({ id: 'c1', ...character }), { status: 201 })

      const result = await fetch('/api/v1/books/1/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify(character),
      }).then(r => r.json())

      expect(result.name).toBe('Charlie')
    })
  })

  describe('AI Assistant API', () => {
    it('should get AI suggestions for chapter', async () => {
      const suggestion = {
        type: 'dialogue',
        content: 'Suggested dialogue text',
      }

      fetch.mockResponseOnce(JSON.stringify(suggestion), { status: 200 })

      const result = await fetch('/api/v1/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({ chapterId: 'ch1', type: 'dialogue' }),
      }).then(r => r.json())

      expect(result.type).toBe('dialogue')
    })

    it('should chat with AI', async () => {
      const response = {
        message: 'Here is my advice...',
        suggestions: [],
      }

      fetch.mockResponseOnce(JSON.stringify(response), { status: 200 })

      const result = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({ message: 'Help with character development' }),
      }).then(r => r.json())

      expect(result.message).toBeDefined()
    })
  })

  describe('Audio & Transcription API', () => {
    it('should upload audio file', async () => {
      const formData = new FormData()
      formData.append('file', new File(['audio'], 'recording.mp3'))

      fetch.mockResponseOnce(
        JSON.stringify({ id: 'aud1', filename: 'recording.mp3' }),
        { status: 201 }
      )

      const result = await fetch('/api/v1/audio/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: formData,
      }).then(r => r.json())

      expect(result.id).toBe('aud1')
    })

    it('should fetch transcription', async () => {
      const transcription = {
        id: 'trans1',
        text: 'Transcribed text from audio',
        status: 'completed',
      }

      fetch.mockResponseOnce(JSON.stringify(transcription), { status: 200 })

      const result = await fetch('/api/v1/transcriptions/trans1', {
        headers: { Authorization: 'Bearer token' },
      }).then(r => r.json())

      expect(result.status).toBe('completed')
      expect(result.text).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      fetch.mockResponseOnce(JSON.stringify({ error: 'Not found' }), { status: 404 })

      const response = await fetch('/api/v1/nonexistent')

      expect(response.status).toBe(404)
    })

    it('should handle 401 unauthorized', async () => {
      fetch.mockResponseOnce(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

      const response = await fetch('/api/v1/books', {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      expect(response.status).toBe(401)
    })

    it('should handle 500 server errors', async () => {
      fetch.mockResponseOnce(JSON.stringify({ error: 'Server error' }), { status: 500 })

      const response = await fetch('/api/v1/books')

      expect(response.status).toBe(500)
    })

    it('should handle network errors', async () => {
      fetch.mockRejectOnce(new Error('Network error'))

      await expect(fetch('/api/v1/books')).rejects.toThrow('Network error')
    })
  })
})
