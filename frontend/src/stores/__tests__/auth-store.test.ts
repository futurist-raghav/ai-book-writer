/**
 * Auth Store Tests
 * Tests for authentication state management using Zustand
 * Covers login, logout, user state, and token management
 */

import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/stores/auth-store'

describe('useAuthStore', () => {
  beforeEach(() => {
    // Clear auth store and localStorage before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      token: null,
      isLoading: false,
      error: null,
    })
    localStorage.clear()
  })

  describe('User Authentication', () => {
    it('should initialize with null user and no token', () => {
      const { result } = renderHook(() => useAuthStore())
      
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should set user and token on login', () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER',
      }
      const mockToken = 'test-token-12345'

      act(() => {
        result.current.setUser(mockUser)
        result.current.setToken(mockToken)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.token).toBe(mockToken)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should clear user state on logout', () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = { id: '1', email: 'test@example.com', username: 'testuser' }
      
      act(() => {
        result.current.setUser(mockUser)
        result.current.setToken('token')
      })

      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should handle loading state during auth operations', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('should handle and store errors', () => {
      const { result } = renderHook(() => useAuthStore())
      const errorMessage = 'Invalid credentials'

      act(() => {
        result.current.setError(errorMessage)
      })

      expect(result.current.error).toBe(errorMessage)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('User State Updates', () => {
    it('should update user preferences', () => {
      const { result } = renderHook(() => useAuthStore())
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        preferences: { theme: 'light' },
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      expect(result.current.user?.preferences).toEqual({ theme: 'light' })
    })

    it('should maintain user role information', () => {
      const { result } = renderHook(() => useAuthStore())
      const adminUser = {
        id: '1',
        email: 'admin@example.com',
        username: 'admin',
        role: 'ADMIN',
      }

      act(() => {
        result.current.setUser(adminUser)
      })

      expect(result.current.user?.role).toBe('ADMIN')
    })
  })

  describe('Token Management', () => {
    it('should store token securely', () => {
      const { result } = renderHook(() => useAuthStore())
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

      act(() => {
        result.current.setToken(token)
      })

      expect(result.current.token).toBe(token)
    })

    it('should clear token on logout', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setToken('test-token')
      })

      expect(result.current.token).toBe('test-token')

      act(() => {
        result.current.logout()
      })

      expect(result.current.token).toBeNull()
    })
  })
})
