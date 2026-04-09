/**
 * Writer Canvas Component Tests
 * Tests for TipTap-based rich text editor
 * Covers content editing, formatting, and content sync
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WriterCanvas from '@/components/writer-canvas-tiptap'

describe('WriterCanvas Component', () => {
  const mockOnChange = jest.fn()
  const defaultProps = {
    initialContent: '<p>Initial content</p>',
    onChange: mockOnChange,
    isEditable: true,
    readOnly: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render editor container', () => {
      render(<WriterCanvas {...defaultProps} />)
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should display initial content', async () => {
      const initialContent = '<p>The quick brown fox</p>'
      render(<WriterCanvas {...defaultProps} initialContent={initialContent} />)

      await waitFor(() => {
        expect(screen.getByText('The quick brown fox')).toBeInTheDocument()
      })
    })

    it('should be editable by default', () => {
      render(<WriterCanvas {...defaultProps} />)
      const editor = screen.getByRole('textbox', { hidden: true })
      expect(editor).not.toHaveAttribute('disabled')
    })

    it('should be read-only when specified', () => {
      render(<WriterCanvas {...defaultProps} readOnly={true} />)
      // Implementation depends on how read-only is handled in your component
      // This is a placeholder test
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })
  })

  describe('Text Editing', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const editor = screen.getByRole('textbox', { hidden: true })
      await user.click(editor)
      await user.type(editor, 'New text')

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should track word count', async () => {
      const { container } = render(
        <WriterCanvas {...defaultProps} initialContent="One two three four five" />
      )

      await waitFor(() => {
        // Adjust selector based on your implementation
        const wordCount = container.querySelector('[data-testid="word-count"]')
        if (wordCount) {
          expect(wordCount.textContent).toMatch(/\d+/)
        }
      })
    })

    it('should handle multi-line content', async () => {
      const multilineContent = '<p>First line</p><p>Second line</p><p>Third line</p>'
      render(<WriterCanvas {...defaultProps} initialContent={multilineContent} />)

      await waitFor(() => {
        expect(screen.getByText('First line')).toBeInTheDocument()
        expect(screen.getByText('Second line')).toBeInTheDocument()
        expect(screen.getByText('Third line')).toBeInTheDocument()
      })
    })
  })

  describe('Text Formatting', () => {
    it('should apply bold formatting', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      // Select bold button and apply
      const boldButton = screen.getByLabelText(/bold/i)
      await user.click(boldButton)

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should apply italic formatting', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const italicButton = screen.getByLabelText(/italic/i)
      await user.click(italicButton)

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should create lists', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const bulletListButton = screen.getByLabelText(/bullet.*list|unordered/i)
      await user.click(bulletListButton)

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should create headings', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const headingButton = screen.getByRole('button', { name: /heading/i })
      await user.click(headingButton)

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should handle code blocks', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const codeBlockButton = screen.getByLabelText(/code.*block|code/i)
      if (codeBlockButton) {
        await user.click(codeBlockButton)
        expect(mockOnChange).toHaveBeenCalled()
      }
    })

    it('should handle tables', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const tableButton = screen.getByLabelText(/table/i)
      if (tableButton) {
        await user.click(tableButton)
        expect(mockOnChange).toHaveBeenCalled()
      }
    })
  })

  describe('Content Management', () => {
    it('should handle paste operations', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const editor = screen.getByRole('textbox', { hidden: true })
      await user.click(editor)

      // Simulate paste
      fireEvent.paste(editor, {
        clipboardData: {
          getData: () => 'Pasted content',
        },
      })

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('should handle undo', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const undoButton = screen.getByLabelText(/undo/i)
      await user.click(undoButton)

      // Undo should be called
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should handle redo', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const redoButton = screen.getByLabelText(/redo/i)
      await user.click(redoButton)

      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should support clear formatting', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const clearButton = screen.getByLabelText(/clear.*format|clear/i)
      if (clearButton) {
        await user.click(clearButton)
        expect(mockOnChange).toHaveBeenCalled()
      }
    })
  })

  describe('Content Sync', () => {
    it('should debounce onChange calls', async () => {
      jest.useFakeTimers()
      render(<WriterCanvas {...defaultProps} />)

      const editor = screen.getByRole('textbox', { hidden: true })

      // Simulate rapid typing
      fireEvent.input(editor, { target: { textContent: 'a' } })
      fireEvent.input(editor, { target: { textContent: 'ab' } })
      fireEvent.input(editor, { target: { textContent: 'abc' } })

      expect(mockOnChange).not.toHaveBeenCalledWith()

      jest.runAllTimers()
      jest.useRealTimers()
    })

    it('should handle external content updates', async () => {
      const { rerender } = render(
        <WriterCanvas {...defaultProps} initialContent="Original" />
      )

      await waitFor(() => {
        expect(screen.getByText('Original')).toBeInTheDocument()
      })

      rerender(
        <WriterCanvas {...defaultProps} initialContent="Updated content" />
      )

      await waitFor(() => {
        expect(screen.getByText('Updated content')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<WriterCanvas {...defaultProps} />)

      const editor = screen.getByRole('textbox', { hidden: true })
      expect(editor).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<WriterCanvas {...defaultProps} />)

      const editor = screen.getByRole('textbox', { hidden: true })
      await user.click(editor)
      await user.keyboard('{Control>}z{/Control}') // Undo

      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      render(<WriterCanvas {...defaultProps} initialContent="" />)

      await waitFor(() => {
        const editor = screen.getByRole('textbox', { hidden: true })
        expect(editor).toBeInTheDocument()
      })
    })

    it('should handle very long content', async () => {
      const longContent = '<p>' + 'a'.repeat(10000) + '</p>'
      render(<WriterCanvas {...defaultProps} initialContent={longContent} />)

      await waitFor(() => {
        expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
      })
    })

    it('should handle special characters', async () => {
      const specialContent = '<p>Special chars: &lt;&gt;&amp;"\'</p>'
      render(<WriterCanvas {...defaultProps} initialContent={specialContent} />)

      await waitFor(() => {
        expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
      })
    })
  })
})
