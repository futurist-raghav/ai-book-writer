import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CollaborationPage from '@/app/dashboard/collaboration/page';
import { apiClient } from '@/lib/api-client';
import { useProjectContext } from '@/stores/project-context';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/stores/project-context', () => ({
  useProjectContext: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    books: {
      list: jest.fn(),
    },
    collaboration: {
      membersByBook: jest.fn(),
      commentsByBook: jest.fn(),
      activityByBook: jest.fn(),
      inviteByBook: jest.fn(),
      addCommentByBook: jest.fn(),
      removeMemberByBook: jest.fn(),
    },
  },
}));

type MockedApiClient = {
  books: {
    list: jest.Mock;
  };
  collaboration: {
    membersByBook: jest.Mock;
    commentsByBook: jest.Mock;
    activityByBook: jest.Mock;
    inviteByBook: jest.Mock;
    addCommentByBook: jest.Mock;
    removeMemberByBook: jest.Mock;
  };
};

const mockedApiClient = apiClient as unknown as MockedApiClient;
const mockedUseProjectContext = useProjectContext as unknown as jest.Mock;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CollaborationPage />
    </QueryClientProvider>
  );
}

async function waitForScopeSelectorReady() {
  await waitFor(() => {
    const selector = screen.getByRole('combobox', { name: /Project Scope/i });
    expect(selector).not.toBeDisabled();
  });
}

function setActiveBook(bookId = 'book-2') {
  mockedUseProjectContext.mockImplementation((selector: any) => {
    const state = {
      activeBook: {
        id: bookId,
      },
    };

    return typeof selector === 'function' ? selector(state) : state;
  });
}

function mockQueryResponses() {
  mockedApiClient.books.list.mockResolvedValue({
    data: {
      items: [
        { id: 'book-1', title: 'Project One' },
        { id: 'book-2', title: 'Project Two' },
      ],
    },
  });

  mockedApiClient.collaboration.membersByBook.mockResolvedValue({
    data: {
      data: {
        data: [],
      },
    },
  });

  mockedApiClient.collaboration.commentsByBook.mockResolvedValue({
    data: {
      data: {
        data: [],
      },
    },
  });

  mockedApiClient.collaboration.activityByBook.mockResolvedValue({
    data: {
      data: {
        data: [],
      },
    },
  });

  mockedApiClient.collaboration.inviteByBook.mockResolvedValue({ data: {} });
  mockedApiClient.collaboration.addCommentByBook.mockResolvedValue({ data: {} });
  mockedApiClient.collaboration.removeMemberByBook.mockResolvedValue({ data: {} });
}

describe('CollaborationPage project scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setActiveBook('book-2');
    mockQueryResponses();
  });

  it('uses active project context as default collaboration scope', async () => {
    renderPage();

    await waitForScopeSelectorReady();

    const selector = screen.getByRole('combobox', { name: /Project Scope/i }) as HTMLSelectElement;
    expect(selector.value).toBe('book-2');

    expect(screen.getByText('Managing collaboration for')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project Two' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApiClient.collaboration.membersByBook).toHaveBeenCalledWith('book-2', {
        accepted_only: false,
      });
      expect(mockedApiClient.collaboration.commentsByBook).toHaveBeenCalledWith('book-2');
      expect(mockedApiClient.collaboration.activityByBook).toHaveBeenCalledWith('book-2');
    });
  });

  it('re-queries collaboration data when project scope changes', async () => {
    renderPage();

    await waitForScopeSelectorReady();

    const selector = screen.getByRole('combobox', { name: /Project Scope/i });
    fireEvent.change(selector, { target: { value: 'book-1' } });

    await waitFor(() => {
      expect(mockedApiClient.collaboration.membersByBook).toHaveBeenCalledWith('book-1', {
        accepted_only: false,
      });
      expect(mockedApiClient.collaboration.commentsByBook).toHaveBeenCalledWith('book-1');
      expect(mockedApiClient.collaboration.activityByBook).toHaveBeenCalledWith('book-1');
    });
  });

  it('posts comments through book-scoped collaboration endpoint', async () => {
    renderPage();

    await waitForScopeSelectorReady();

    fireEvent.click(screen.getByRole('button', { name: 'Comments & Feedback' }));
    fireEvent.click(screen.getByRole('button', { name: /Add$/i }));

    fireEvent.change(screen.getByLabelText(/Target Chapter\/Section \(Optional\)/i), {
      target: { value: 'chapter-3' },
    });
    fireEvent.change(screen.getByLabelText(/^Comment$/i), {
      target: { value: 'Tighten this transition.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(mockedApiClient.collaboration.addCommentByBook).toHaveBeenCalledWith('book-2', {
        content: 'Tighten this transition.',
        target_type: 'chapter',
        target_id: 'chapter-3',
      });
    });
  });
});
