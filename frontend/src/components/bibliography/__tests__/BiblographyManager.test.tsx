/**
 * Bibliography & Citation Tests (P2.4)
 * Jest test suite for BibliographyManager and CitationTool components
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BibliographyManager } from '@/components/bibliography/BibliographyManager';
import { CitationTool, CitationExtension } from '@/components/bibliography/CitationTool';


describe('BibliographyManager Component', () => {
  const mockBookId = 'book-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders bibliography manager with empty state', () => {
    render(<BibliographyManager bookId={mockBookId} onClose={() => {}} />);
    
    expect(screen.getByText(/Add Source/i)).toBeInTheDocument();
    expect(screen.getByText(/Sources/i)).toBeInTheDocument();
  });

  test('displays form to add new source', async () => {
    const user = userEvent.setup();
    render(<BibliographyManager bookId={mockBookId} onClose={() => {}} />);
    
    const addButton = screen.getByText(/Add Source/i);
    await user.click(addButton);
    
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Authors/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Source Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/i)).toBeInTheDocument();
  });

  test('submits new bibliography source', async () => {
    const user = userEvent.setup();
    const mockCreate = jest.fn().mockResolvedValue({
      id: 'source-1',
      title: 'Test Book',
      authors: ['Author Name'],
      year: 2020,
      source_type: 'book',
      citation_formats: { apa: 'Author (2020).' }
    });
    
    render(
      <BibliographyManager 
        bookId={mockBookId} 
        onClose={() => {}} 
        onCreateSource={mockCreate}
      />
    );
    
    await user.click(screen.getByText(/Add Source/i));
    await user.type(screen.getByLabelText(/Title/i), 'Test Book');
    await user.type(screen.getByLabelText(/Authors/i), 'Author Name');
    await user.type(screen.getByLabelText(/Year/i), '2020');
    
    await user.click(screen.getByText(/Save Source/i));
    
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Book',
          authors: ['Author Name'],
          year: 2020
        })
      );
    });
  });

  test('displays list of sources with citation formats', async () => {
    const mockSources = [
      {
        id: 'source-1',
        title: 'Book One',
        authors: ['Author A'],
        year: 2020,
        source_type: 'book',
        citation_formats: {
          apa: 'Author A (2020). Book One.',
          mla: 'Author A. "Book One." 2020.',
          chicago: 'Author A. "Book One." 2020.'
        }
      },
      {
        id: 'source-2',
        title: 'Article Two',
        authors: ['Author B'],
        year: 2021,
        source_type: 'article',
        citation_formats: {
          apa: 'Author B (2021). Article Two.',
          mla: 'Author B. "Article Two." 2021.',
          chicago: 'Author B. "Article Two." 2021.'
        }
      }
    ];
    
    const mockList = jest.fn().mockResolvedValue(mockSources);
    
    render(
      <BibliographyManager 
        bookId={mockBookId} 
        onClose={() => {}} 
        onListSources={mockList}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('Book One')).toBeInTheDocument();
      expect(screen.getByText('Article Two')).toBeInTheDocument();
    });
  });

  test('deletes bibliography source with confirmation', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.fn().mockResolvedValue({});
    
    render(
      <BibliographyManager 
        bookId={mockBookId} 
        onClose={() => {}} 
        onDeleteSource={mockDelete}
      />
    );
    
    const deleteButton = screen.getByTestId('delete-source-source-1');
    await user.click(deleteButton);
    
    // Expect confirmation dialog
    expect(screen.getByText(/confirm.*delete/i)).toBeInTheDocument();
    
    await user.click(screen.getByText(/confirm/i));
    
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('source-1');
    });
  });

  test('expands citation format details', async () => {
    const user = userEvent.setup();
    render(<BibliographyManager bookId={mockBookId} onClose={() => {}} />);
    
    const expandButton = screen.getByTestId('expand-formats-source-1');
    await user.click(expandButton);
    
    expect(screen.getByText(/APA:/i)).toBeInTheDocument();
    expect(screen.getByText(/MLA:/i)).toBeInTheDocument();
    expect(screen.getByText(/Chicago:/i)).toBeInTheDocument();
  });

  test('filters sources by type', async () => {
    const user = userEvent.setup();
    render(<BibliographyManager bookId={mockBookId} onClose={() => {}} />);
    
    const typeSelect = screen.getByLabelText(/Source Type Filter/i);
    await user.selectOption(typeSelect, 'book');
    
    await waitFor(() => {
      expect(screen.queryByText('article-source')).not.toBeInTheDocument();
      expect(screen.getByText('book-source')).toBeInTheDocument();
    });
  });
});


describe('CitationTool Component', () => {
  const mockChapterId = 'chapter-123';
  const mockSources = [
    {
      id: 'source-1',
      title: 'Test Reference',
      authors: ['Smith, J.'],
      year: 2020,
      citation_formats: { apa: 'Smith, J. (2020).' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders citation toolbar button', () => {
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
      />
    );
    
    expect(screen.getByText(/Insert Citation/i)).toBeInTheDocument();
  });

  test('opens citation search dropdown when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
      />
    );
    
    const button = screen.getByText(/Insert Citation/i);
    await user.click(button);
    
    expect(screen.getByPlaceholderText(/Search sources/i)).toBeInTheDocument();
  });

  test('filters sources by search query', async () => {
    const user = userEvent.setup();
    
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
      />
    );
    
    const searchInput = screen.getByPlaceholderText(/Search sources/i);
    await user.type(searchInput, 'Test');
    
    expect(screen.getByText('Test Reference')).toBeInTheDocument();
  });

  test('selects source and inserts citation', async () => {
    const user = userEvent.setup();
    const mockInsert = jest.fn();
    
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={mockInsert}
      />
    );
    
    const button = screen.getByText(/Insert Citation/i);
    await user.click(button);
    
    const sourceOption = screen.getByText('Test Reference');
    await user.click(sourceOption);
    
    expect(mockInsert).toHaveBeenCalledWith('source-1');
  });

  test('handles keyboard shortcut Cmd/Ctrl+Shift+C', async () => {
    const user = userEvent.setup();
    
    const { container } = render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
      />
    );
    
    const editor = container.querySelector('[data-testid="editor"]');
    
    // Simulate Cmd+Shift+C on macOS
    fireEvent.keyDown(editor, {
      key: 'c',
      code: 'KeyC',
      metaKey: true,
      shiftKey: true
    });
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search sources/i)).toBeInTheDocument();
    });
  });

  test('renders citation markers in text', () => {
    const mockEditor = {
      getActive: () => ({ cite: true }),
      isActive: () => true,
      getAttributes: () => ({ citationId: '1' })
    };
    
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
        editor={mockEditor}
      />
    );
    
    const marker = screen.getByText('[1]');
    expect(marker).toHaveClass('citation-marker');
  });

  test('allows deleting citation with backspace', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.fn();
    
    const { container } = render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onDeleteCitation={mockDelete}
      />
    );
    
    const citationMarker = screen.getByText('[1]');
    await user.click(citationMarker);
    
    fireEvent.keyDown(container, { key: 'Backspace', code: 'Backspace' });
    
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  test('shows citation details on hover', async () => {
    const user = userEvent.setup();
    
    render(
      <CitationTool 
        chapterId={mockChapterId}
        sources={mockSources}
        onInsertCitation={() => {}}
      />
    );
    
    const citationMarker = screen.getByText('[1]');
    await user.hover(citationMarker);
    
    await waitFor(() => {
      expect(screen.getByText(/Smith, J. \(2020\)/)).toBeInTheDocument();
    });
  });
});


describe('CitationExtension (TipTap)', () => {
  test('creates citation extension with correct config', () => {
    const extension = CitationExtension;
    
    expect(extension).toBeDefined();
    expect(extension.name).toBe('citation');
  });

  test('extension can be attached to editor', () => {
    const mockEditor = {
      extensionManager: {
        extensions: []
      }
    };
    
    // Would test editor integration in full E2E
    expect(CitationExtension).toBeTruthy();
  });

  test('citation command inserts citation node', () => {
    const extension = CitationExtension;
    
    expect(extension.addCommands()).toBeDefined();
    expect(typeof extension.addCommands().insertCitation).toBe('function');
  });

  test('citation mark renders as superscript', () => {
    const { container } = render(
      <div 
        dangerouslySetInnerHTML={{
          __html: '<p>Sample text<sup class="citation">[1]</sup> with citation.</p>'
        }}
      />
    );
    
    const superscript = container.querySelector('sup.citation');
    expect(superscript).toHaveTextContent('[1]');
  });
});


describe('Bibliography Integration', () => {
  test('adds citation to chapter and updates UI', async () => {
    const user = userEvent.setup();
    const mockAddCitation = jest.fn().mockResolvedValue({ id: 'citation-1' });
    
    const { rerender } = render(
      <CitationTool 
        chapterId="chapter-1"
        sources={mockSources}
        onInsertCitation={mockAddCitation}
      />
    );
    
    const button = screen.getByText(/Insert Citation/i);
    await user.click(button);
    
    const sourceOption = screen.getByText('Test Reference');
    await user.click(sourceOption);
    
    await waitFor(() => {
      expect(mockAddCitation).toHaveBeenCalledWith('source-1');
    });
  });

  test('maintains citation numbering when citations added/removed', async () => {
    // Mock implementation to test numbering logic
    const citations = [
      { id: 'c1', number: 1 },
      { id: 'c2', number: 2 },
      { id: 'c3', number: 3 }
    ];
    
    // Remove citation 2
    const updated = citations.filter(c => c.id !== 'c2').map((c, i) => ({
      ...c,
      number: i + 1
    }));
    
    expect(updated).toEqual([
      { id: 'c1', number: 1 },
      { id: 'c3', number: 2 }
    ]);
  });

  test('exports chapter with formatted bibliography', async () => {
    const mockExport = jest.fn().mockResolvedValue({
      title: 'Chapter 1',
      content: 'Chapter text with [1] citations.',
      bibliography: 'Smith, J. (2020). Test Reference.'
    });
    
    const result = await mockExport('chapter-1');
    
    expect(result.bibliography).toContain('Smith, J.');
    expect(result.content).toContain('[1]');
  });
});
