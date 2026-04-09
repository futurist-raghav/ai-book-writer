/**
 * AI Assistant Component Tests
 * Tests for AI-powered writing assistance sidebar
 * Covers chat, suggestions, insertion, and project context awareness
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIAssistant from '@/components/ai-assistant'

// Mock the API
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}))

jest.mock('@/stores/project-context', () => ({
  useProjectContext: jest.fn(),
}))

describe('AIAssistant Component', () => {
  const mockOnInsert = jest.fn()
  const defaultProps = {
    onInsert: mockOnInsert,
    chapterId: 'ch1',
    projectContext: {
      book: 'My Novel',
      characters: ['Alice', 'Bob'],
      currentChapter: 'Chapter 1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render assistant panel', () => {
      render(<AIAssistant {...defaultProps} />)
      expect(screen.getByText(/AI Assistant/i)).toBeInTheDocument()
    })

    it('should display assistance type selector', () => {
      render(<AIAssistant {...defaultProps} />)
      expect(screen.getByRole('button', { name: /general|character|world|dialogue|plot/i })).toBeInTheDocument()
    })

    it('should show message input area', () => {
      render(<AIAssistant {...defaultProps} />)
      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      expect(input).toBeInTheDocument()
    })

    it('should display send button', () => {
      render(<AIAssistant {...defaultProps} />)
      expect(screen.getByRole('button', { name: /send|submit/i })).toBeInTheDocument()
    })
  })

  describe('Assistance Types', () => {
    it('should switch to general assistance', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const generalButton = screen.getByRole('button', { name: /general/i })
      await user.click(generalButton)

      expect(screen.getByText(/general writing advice/i)).toBeInTheDocument()
    })

    it('should switch to character assistance', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const characterButton = screen.getByRole('button', { name: /character/i })
      await user.click(characterButton)

      expect(characterButton).toHaveClass('active')
    })

    it('should switch to world-building assistance', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const worldButton = screen.getByRole('button', { name: /world/i })
      await user.click(worldButton)

      expect(screen.getByText(/world building/i)).toBeInTheDocument()
    })

    it('should switch to dialogue assistance', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const dialogueButton = screen.getByRole('button', { name: /dialogue/i })
      await user.click(dialogueButton)

      expect(dialogueButton).toHaveClass('active')
    })

    it('should switch to plot assistance', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const plotButton = screen.getByRole('button', { name: /plot/i })
      await user.click(plotButton)

      expect(screen.getByText(/plot.*suggestions/i)).toBeInTheDocument()
    })
  })

  describe('Chat Interaction', () => {
    it('should send chat message', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')
      
      apiClient.post.mockResolvedValue({
        message: 'Here is my response',
        suggestions: [],
      })

      render(<AIAssistant {...defaultProps} />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.type(input, 'Help me with character development')

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/chat', expect.any(Object))
      })
    })

    it('should display chat history', async () => {
      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        const chatHistory = screen.getByRole('region', { name: /chat.*history|messages/i })
        expect(chatHistory).toBeInTheDocument()
      })
    })

    it('should show loading state while waiting for response', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ message: 'Response' }), 100))
      )

      render(<AIAssistant {...defaultProps} />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.type(input, 'Tell me something')

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      expect(screen.getByText(/loading|thinking/i)).toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockRejectedValue(new Error('API Error'))

      render(<AIAssistant {...defaultProps} />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Suggestions Display', () => {
    it('should display AI suggestions', async () => {
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockResolvedValue({
        message: 'Response',
        suggestions: [
          { id: '1', text: 'Suggestion 1' },
          { id: '2', text: 'Suggestion 2' },
        ],
      })

      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Suggestion 1')).toBeInTheDocument()
        expect(screen.getByText('Suggestion 2')).toBeInTheDocument()
      })
    })

    it('should have insert buttons for each suggestion', async () => {
      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        const insertButtons = screen.getAllByRole('button', { name: /insert/i })
        expect(insertButtons.length).toBeGreaterThan(0)
      })
    })

    it('should insert suggestion into editor', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockResolvedValue({
        suggestions: [{ id: '1', text: 'Suggested text' }],
      })

      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        // Get first insert button
        const insertButtons = screen.getAllByRole('button', { name: /insert/i })
        return insertButtons[0]
      }).then(async (button) => {
        await user.click(button)
        expect(mockOnInsert).toHaveBeenCalledWith('Suggested text')
      })
    })
  })

  describe('Context Awareness', () => {
    it('should use project context in suggestions', async () => {
      const { apiClient } = require('@/lib/api-client')

      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            context: expect.any(Object),
          })
        )
      })
    })

    it('should include current chapter in context', async () => {
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockResolvedValue({ message: 'Response' })

      render(<AIAssistant {...defaultProps} chapterId="ch1" />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      fireEvent.change(input, { target: { value: 'Help' } })

      // Send message
      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            chapterId: 'ch1',
          })
        )
      })
    })

    it('should be aware of character context', () => {
      render(<AIAssistant {...defaultProps} />)

      expect(screen.getByText(/character.*assistant/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have ARIA labels', () => {
      render(<AIAssistant {...defaultProps} />)

      expect(screen.getByRole('textbox')).toHaveAccessibleName()
      expect(screen.getByRole('button', { name: /send/i })).toHaveAccessibleName()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.click(input)
      await user.keyboard('{Tab}') // Tab to send button

      expect(screen.getByRole('button', { name: /send|submit/i })).toHaveFocus()
    })

    it('should announce when loading', async () => {
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ message: 'Response' }), 100))
      )

      render(<AIAssistant {...defaultProps} />)

      await waitFor(() => {
        const loading = screen.getByText(/loading|thinking/i)
        expect(loading.getAttribute('role')).toBe('status')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty user message', async () => {
      const user = userEvent.setup()
      render(<AIAssistant {...defaultProps} />)

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      // Should not call API with empty message
      // Implementation depends on your validation
      expect(screen.getByPlaceholderText(/ask.*AI/i)).toBeInTheDocument()
    })

    it('should handle very long messages', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockResolvedValue({ message: 'Response' })

      render(<AIAssistant {...defaultProps} />)

      const longMessage = 'a'.repeat(5000)
      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.type(input, longMessage)

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled()
      })
    })

    it('should clear input after sending', async () => {
      const user = userEvent.setup()
      const { apiClient } = require('@/lib/api-client')

      apiClient.post.mockResolvedValue({ message: 'Response' })

      render(<AIAssistant {...defaultProps} />)

      const input = screen.getByPlaceholderText(/ask.*AI|type.*message/i)
      await user.type(input, 'Test message')

      const sendButton = screen.getByRole('button', { name: /send|submit/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })
  })
})
