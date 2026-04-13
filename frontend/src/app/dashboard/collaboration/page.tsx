'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useProjectContext } from '@/stores/project-context';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';

interface BookOption {
  id: string;
  title: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: string;
  is_accepted?: boolean;
  joined_at: string;
  last_active?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  chapter?: string;
  created_at: string;
  resolved: boolean;
}

interface Activity {
  id: string;
  user: string;
  action: string;
  resource: string;
  timestamp: string;
}

function extractPaginatedItems(payload: unknown): Record<string, unknown>[] {
  const root = (payload || {}) as Record<string, unknown>;
  const nested = (root.data as Record<string, unknown> | undefined) || undefined;

  const rawItems =
    (Array.isArray(root.items) ? root.items : undefined) ||
    (Array.isArray(root.data) ? (root.data as unknown[]) : undefined) ||
    (Array.isArray(nested?.items) ? nested?.items : undefined) ||
    (Array.isArray(nested?.data) ? nested?.data : undefined) ||
    [];

  return rawItems as Record<string, unknown>[];
}

export default function CollaborationPage() {
  const queryClient = useQueryClient();
  const activeBookId = useProjectContext((state) => state.activeBook?.id);

  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer' | 'contributor' | 'viewer'>('reviewer');

  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments' | 'activity'>('collaborators');
  const [selectedBookId, setSelectedBookId] = useState('');

  const {
    data: booksData,
    isLoading: loadingBooks,
    isError: booksError,
    error: booksErrorValue,
    refetch: refetchBooks,
  } = useQuery({
    queryKey: ['collaboration-books'],
    queryFn: () =>
      apiClient.books.list({
        page: 1,
        limit: 100,
        sort_by: 'updated_at',
        sort_order: 'desc',
      }),
  });

  const availableBooks: BookOption[] = extractPaginatedItems(booksData?.data)
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : '';
      if (!id) return null;

      return {
        id,
        title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled project',
      };
    })
    .filter((item): item is BookOption => Boolean(item));

  useEffect(() => {
    if (availableBooks.length === 0) {
      if (selectedBookId) {
        setSelectedBookId('');
      }
      return;
    }

    const selectedBookStillExists = availableBooks.some((book) => book.id === selectedBookId);
    if (selectedBookStillExists) {
      return;
    }

    const activeBookMatch = activeBookId
      ? availableBooks.find((book) => book.id === activeBookId)
      : undefined;
    setSelectedBookId(activeBookMatch?.id || availableBooks[0]?.id || '');
  }, [activeBookId, availableBooks, selectedBookId]);

  // Fetch collaborators
  const {
    data: collaboratorsData,
    isLoading: loadingCollaborators,
    isError: collaboratorsError,
    error: collaboratorsErrorValue,
    refetch: refetchCollaborators,
  } = useQuery({
    queryKey: ['collaborators', selectedBookId],
    queryFn: () => apiClient.collaboration.membersByBook(selectedBookId, { accepted_only: false }),
    enabled: !!selectedBookId,
  });

  // Fetch comments
  const {
    data: commentsData,
    isLoading: loadingComments,
    isError: commentsError,
    error: commentsErrorValue,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['collaboration-comments', selectedBookId],
    queryFn: () => apiClient.collaboration.commentsByBook(selectedBookId),
    enabled: !!selectedBookId,
  });

  // Fetch activity log
  const {
    data: activityData,
    isLoading: loadingActivity,
    isError: activityError,
    error: activityErrorValue,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['collaboration-activity', selectedBookId],
    queryFn: () => apiClient.collaboration.activityByBook(selectedBookId),
    enabled: !!selectedBookId,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: 'editor' | 'reviewer' | 'contributor' | 'viewer' }) =>
      selectedBookId
        ? apiClient.collaboration.inviteByBook(selectedBookId, data)
        : Promise.reject(new Error('No project selected')),
    onSuccess: () => {
      toast.success('Invitation sent');
      queryClient.invalidateQueries({ queryKey: ['collaborators', selectedBookId] });
      queryClient.invalidateQueries({ queryKey: ['collaboration-activity', selectedBookId] });
      setInviteEmail('');
      setInviteMode(false);
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to send invitation'),
  });

  const addCommentMutation = useMutation({
    mutationFn: (data: { content: string; target_type?: string; target_id?: string }) =>
      selectedBookId
        ? apiClient.collaboration.addCommentByBook(selectedBookId, data)
        : Promise.reject(new Error('No project selected')),
    onSuccess: () => {
      toast.success('Comment added');
      queryClient.invalidateQueries({ queryKey: ['collaboration-comments', selectedBookId] });
      queryClient.invalidateQueries({ queryKey: ['collaboration-activity', selectedBookId] });
      setCommentText('');
      setSelectedChapter('');
      setCommentMode(false);
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to add comment'),
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: (id: string) =>
      selectedBookId
        ? apiClient.collaboration.removeMemberByBook(selectedBookId, id)
        : Promise.reject(new Error('No project selected')),
    onSuccess: () => {
      toast.success('Collaborator removed');
      queryClient.invalidateQueries({ queryKey: ['collaborators', selectedBookId] });
      queryClient.invalidateQueries({ queryKey: ['collaboration-activity', selectedBookId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || 'Failed to remove collaborator'),
  });

  const collaborators: Collaborator[] = extractPaginatedItems(collaboratorsData?.data)
    .map((item, index) => {
      const id = typeof item.id === 'string' ? item.id : `collab-${index}`;
      const name =
        (typeof item.user_name === 'string' && item.user_name.trim()) ||
        (typeof item.user_email === 'string' && item.user_email.trim()) ||
        'Unknown collaborator';
      const email =
        (typeof item.user_email === 'string' && item.user_email) ||
        (typeof item.email === 'string' && item.email) ||
        '';
      const role = typeof item.role === 'string' && item.role.trim() ? item.role : 'viewer';
      const invitedAt = typeof item.invited_at === 'string' ? item.invited_at : '';
      const acceptedAt = typeof item.accepted_at === 'string' ? item.accepted_at : undefined;
      const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : undefined;

      return {
        id,
        name,
        email,
        role,
        is_accepted: typeof item.is_accepted === 'boolean' ? item.is_accepted : true,
        joined_at: acceptedAt || invitedAt,
        last_active: updatedAt,
      } as Collaborator;
    })
    .filter((item) => Boolean(item.id));

  const comments: Comment[] = extractPaginatedItems(commentsData?.data)
    .map((item, index) => {
      const id = typeof item.id === 'string' ? item.id : `comment-${index}`;
      const createdAt = typeof item.created_at === 'string' ? item.created_at : '';
      const targetType = typeof item.target_type === 'string' ? item.target_type : '';
      const targetId = typeof item.target_id === 'string' ? item.target_id : '';

      return {
        id,
        author:
          (typeof item.author_name === 'string' && item.author_name.trim()) ||
          'Unknown user',
        content: typeof item.content === 'string' ? item.content : '',
        chapter: targetType === 'chapter' ? targetId : undefined,
        created_at: createdAt,
        resolved: typeof item.is_resolved === 'boolean' ? item.is_resolved : false,
      } as Comment;
    })
    .filter((item) => Boolean(item.id));

  const activities: Activity[] = extractPaginatedItems(activityData?.data)
    .map((item, index) => {
      const id = typeof item.id === 'string' ? item.id : `activity-${index}`;
      const title = typeof item.title === 'string' ? item.title : '';
      const description = typeof item.description === 'string' ? item.description : '';

      return {
        id,
        user: (typeof item.actor_name === 'string' && item.actor_name.trim()) || 'System',
        action: title || 'updated collaboration data',
        resource: description || (typeof item.entity_type === 'string' ? item.entity_type : ''),
        timestamp: typeof item.created_at === 'string' ? item.created_at : '',
      } as Activity;
    })
    .filter((item) => Boolean(item.id));

  const selectedBook = availableBooks.find((book) => book.id === selectedBookId);

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Header */}
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Team Work</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">Collaboration</h2>
          <p className="font-label text-sm text-on-surface-variant mt-4 max-w-2xl">
            Invite team members, manage permissions, and collaborate in real-time. Track changes and comments from your collaborators.
          </p>
        </div>
      </div>

      <div className="elevated-panel mb-8 rounded-xl p-5">
        <label
          htmlFor="collaboration-book-scope"
          className="block font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
        >
          Project Scope
        </label>
        <select
          id="collaboration-book-scope"
          value={selectedBookId}
          onChange={(e) => {
            setSelectedBookId(e.target.value);
            setInviteMode(false);
            setCommentMode(false);
          }}
          disabled={loadingBooks || availableBooks.length === 0}
          className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-label text-on-surface"
        >
          {availableBooks.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
        {selectedBook ? (
          <p className="mt-2 text-xs font-label text-on-surface-variant">
            Managing collaboration for <span className="font-bold text-primary">{selectedBook.title}</span>
          </p>
        ) : null}
      </div>

      {booksError ? (
        <QueryErrorState
          title="Unable to load projects"
          error={booksErrorValue}
          onRetry={() => void refetchBooks()}
        />
      ) : loadingBooks ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : availableBooks.length === 0 ? (
        <div className="elevated-panel rounded-2xl border border-dashed border-outline-variant/45 py-14 text-center">
          <p className="text-sm text-on-surface-variant">Create a project first to manage collaborators, comments, and activity.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-8 flex gap-2 border-b border-outline-variant/20">
            <button
              onClick={() => setActiveTab('collaborators')}
              className={`px-4 py-3 font-label text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'collaborators'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              Team Members
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`px-4 py-3 font-label text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'comments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              Comments & Feedback
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-3 font-label text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              Activity Log
            </button>
          </div>

          {/* Collaborators Tab */}
          {activeTab === 'collaborators' && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-bold text-on-surface">Team Members</h3>
                <button
                  onClick={() => setInviteMode(!inviteMode)}
                  className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 font-label text-sm font-bold text-secondary-foreground shadow-sm transition-all hover:bg-secondary/90"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Invite
                </button>
              </div>

              {inviteMode && (
                <div className="elevated-panel mb-6 rounded-xl p-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="invite-email" className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Email</label>
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="collaborator@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-label text-on-surface"
                      />
                    </div>
                    <div>
                      <label htmlFor="invite-role" className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Role</label>
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'editor' | 'reviewer' | 'contributor' | 'viewer')}
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-label text-on-surface"
                      >
                        <option value="editor">Editor</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                        disabled={inviteMutation.isPending || !inviteEmail.trim()}
                        className="flex-1 rounded-lg bg-primary px-4 py-2 font-label text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => setInviteMode(false)}
                        className="theme-chip flex-1 rounded-lg px-4 py-2 font-label text-sm font-bold text-on-surface hover:bg-surface-container-high"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {collaboratorsError ? (
                  <QueryErrorState
                    title="Unable to load collaborators"
                    error={collaboratorsErrorValue}
                    onRetry={() => void refetchCollaborators()}
                  />
                ) : loadingCollaborators ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : collaborators.length === 0 ? (
                  <div className="elevated-panel rounded-xl border border-dashed border-outline-variant/40 py-12 text-center">
                    <p className="text-on-surface-variant text-sm">No collaborators yet. Invite team members to get started.</p>
                  </div>
                ) : (
                  collaborators.map((collab) => (
                    <div key={collab.id} className="theme-chip flex items-center justify-between rounded-xl p-4">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-on-surface">{collab.name}</p>
                        <p className="text-xs text-on-surface-variant">{collab.email || 'No email available'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="rounded px-2 py-1 text-[10px] font-bold uppercase bg-secondary-container text-on-secondary-container">
                            {collab.role}
                          </span>
                          {collab.is_accepted === false ? (
                            <span className="rounded px-2 py-1 text-[10px] font-bold uppercase bg-warning/20 text-warning">
                              pending
                            </span>
                          ) : null}
                          {collab.last_active ? (
                            <span className="text-[10px] text-on-surface-variant">Last active: {new Date(collab.last_active).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      </div>
                      {collab.role !== 'owner' && (
                        <button
                          onClick={() => removeCollaboratorMutation.mutate(collab.id)}
                          className="theme-chip flex h-9 w-9 items-center justify-center rounded-full text-error hover:bg-error hover:text-on-error"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-bold text-on-surface">Comments & Feedback</h3>
                <button
                  onClick={() => setCommentMode(!commentMode)}
                  className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 font-label text-sm font-bold text-secondary-foreground shadow-sm transition-all hover:bg-secondary/90"
                >
                  <span className="material-symbols-outlined">add_comment</span>
                  Add
                </button>
              </div>

              {commentMode && (
                <div className="elevated-panel mb-6 rounded-xl p-6">
                  <div className="mb-4">
                    <label htmlFor="comment-target" className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Target Chapter/Section (Optional)</label>
                    <input
                      id="comment-target"
                      type="text"
                      placeholder="e.g., Chapter 5"
                      value={selectedChapter}
                      onChange={(e) => setSelectedChapter(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-label text-on-surface"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="comment-text" className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Comment</label>
                    <textarea
                      id="comment-text"
                      placeholder="Add your feedback or comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-24 w-full resize-none rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm font-label text-on-surface"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        addCommentMutation.mutate({
                          content: commentText,
                          target_type: selectedChapter.trim() ? 'chapter' : 'book',
                          target_id: selectedChapter.trim() || undefined,
                        })
                      }
                      disabled={addCommentMutation.isPending || !commentText.trim()}
                      className="rounded-lg bg-primary px-4 py-2 font-label text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Post
                    </button>
                    <button
                      onClick={() => setCommentMode(false)}
                      className="theme-chip rounded-lg px-4 py-2 font-label text-sm font-bold text-on-surface hover:bg-surface-container-high"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {commentsError ? (
                  <QueryErrorState
                    title="Unable to load comments"
                    error={commentsErrorValue}
                    onRetry={() => void refetchComments()}
                  />
                ) : loadingComments ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : comments.length === 0 ? (
                  <div className="elevated-panel rounded-xl border border-dashed border-outline-variant/40 py-12 text-center">
                    <p className="text-on-surface-variant text-sm">No comments yet. Start collaborating!</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`theme-chip border rounded-xl p-4 ${comment.resolved ? 'border-success/30 opacity-70' : 'border-outline-variant/20'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-sm text-on-surface">{comment.author}</p>
                          {comment.chapter ? <p className="text-xs text-on-surface-variant">on {comment.chapter}</p> : null}
                        </div>
                        {comment.resolved ? <span className="text-success text-xs font-bold">RESOLVED</span> : null}
                      </div>
                      <p className="text-sm text-on-surface-variant">{comment.content}</p>
                      <p className="text-xs text-on-surface-variant/50 mt-2">
                        {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              <h3 className="mb-6 text-lg font-bold text-on-surface">Activity Log</h3>
              <div className="space-y-3">
                {activityError ? (
                  <QueryErrorState
                    title="Unable to load activity"
                    error={activityErrorValue}
                    onRetry={() => void refetchActivity()}
                  />
                ) : loadingActivity ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : activities.length === 0 ? (
                  <div className="elevated-panel rounded-xl border border-dashed border-outline-variant/40 py-12 text-center">
                    <p className="text-on-surface-variant text-sm">No activity yet.</p>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="theme-chip flex items-start gap-3 rounded-xl p-4">
                      <span className="material-symbols-outlined text-secondary flex-shrink-0">history</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface-variant">
                          <span className="font-bold text-primary">{activity.user}</span> {activity.action}
                          {activity.resource ? <span className="text-secondary"> {activity.resource}</span> : null}
                        </p>
                        <p className="text-xs text-on-surface-variant/50">
                          {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
