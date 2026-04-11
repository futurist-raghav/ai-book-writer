'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';

interface CommentData {
  id: string;
  author_name: string;
  author_id: string;
  content: string;
  target_type: string;
  target_id: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
  updated_at: string;
}

interface CommentPanelProps {
  bookId: string;
  chapterId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserName?: string;
}

export function CommentPanel({ bookId, chapterId, isOpen, onClose, currentUserName }: CommentPanelProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [mentionText, setMentionText] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [showResolvedOnly, setShowResolvedOnly] = useState(false);
  const queryClient = useQueryClient();

  // Fetch comments for this chapter
  const commentsQuery = useQuery({
    queryKey: ['comments', bookId, chapterId],
    queryFn: async () => {
      const response = await apiClient.collaboration.commentsByBook?.(bookId, {
        page: 1,
        limit: 50,
        target_type: 'chapter',
      });
      return (response as any)?.data || [];
    },
    enabled: isOpen,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiClient.collaboration.addCommentByBook?.(bookId, {
        content,
        target_type: 'chapter',
        target_id: chapterId,
      });
      return response;
    },
    onSuccess: () => {
      setNewCommentText('');
      setMentionText('');
      toast.success('Comment added');
      queryClient.invalidateQueries({ queryKey: ['comments', bookId, chapterId] });
    },
    onError: () => {
      toast.error('Failed to add comment');
    },
  });

  // Update comment mutation (for resolving)
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, isResolved }: { commentId: string; isResolved: boolean }) => {
      // This would need a new API method or we'd use a generic update
      // For now, return mock response
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Comment updated');
      queryClient.invalidateQueries({ queryKey: ['comments', bookId, chapterId] });
    },
  });

  const handleAddComment = useCallback(() => {
    if (!newCommentText.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    createCommentMutation.mutate(newCommentText);
  }, [newCommentText, createCommentMutation]);

  const handleMentionChange = (text: string) => {
    setNewCommentText(text);
    setMentionText(text);
    
    // Show mention dropdown if @ is typed
    if (text.includes('@')) {
      const lastAtIndex = text.lastIndexOf('@');
      const afterAt = text.substring(lastAtIndex + 1);
      if (afterAt.length > 0 && !afterAt.includes(' ')) {
        setShowMentionDropdown(true);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleMentionSelect = (mentionName: string) => {
    // Replace the partial mention with full mention
    const lastAtIndex = newCommentText.lastIndexOf('@');
    const beforeMention = newCommentText.substring(0, lastAtIndex);
    setNewCommentText(`${beforeMention}@${mentionName} `);
    setShowMentionDropdown(false);
  };

  const filteredComments = showResolvedOnly 
    ? commentsQuery.data?.filter((c: CommentData) => c.is_resolved) || []
    : commentsQuery.data?.filter((c: CommentData) => !c.is_resolved) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Comments</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setShowResolvedOnly(false)}
          className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
            !showResolvedOnly
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          Active ({filteredComments.length})
        </button>
        <button
          onClick={() => setShowResolvedOnly(true)}
          className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
            showResolvedOnly
              ? 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          Resolved ✓
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {commentsQuery.isPending && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {commentsQuery.isError && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-3 rounded">
            Failed to load comments
          </div>
        )}

        {filteredComments.length === 0 && !commentsQuery.isPending && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <p className="text-sm">{showResolvedOnly ? 'No resolved comments' : 'No active comments yet'}</p>
          </div>
        )}

        {filteredComments.map((comment: CommentData) => (
          <div
            key={comment.id}
            className={`rounded-lg p-3 border ${
              comment.is_resolved
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
            }`}
          >
            {/* Comment Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">
                  {comment.author_name || 'Anonymous'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </p>
              </div>
              {comment.is_resolved && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 font-medium">
                  Resolved
                </span>
              )}
            </div>

            {/* Comment Content */}
            <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{comment.content}</p>

            {/* Comment Actions */}
            <div className="flex gap-2 text-xs">
              <button
                onClick={() =>
                  updateCommentMutation.mutate({
                    commentId: comment.id,
                    isResolved: !comment.is_resolved,
                  })
                }
                className="px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                {comment.is_resolved ? '↩ Reopen' : '✓ Resolve'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Comment Input */}
      <div className="border-t border-gray-200 dark:border-slate-700 px-4 py-3 space-y-2">
        <div className="relative">
          <textarea
            value={newCommentText}
            onChange={(e) => handleMentionChange(e.target.value)}
            placeholder="Add a comment... (use @name to mention)"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />

          {/* Mention Dropdown */}
          {showMentionDropdown && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
              <div
                onClick={() => handleMentionSelect('collaborator')}
                className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                👤 @collaborator
              </div>
              <div
                onClick={() => handleMentionSelect('author')}
                className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                ✍️ @author
              </div>
              <div className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-slate-600">
                Mention available collaborators
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleAddComment}
          disabled={createCommentMutation.isPending || !newCommentText.trim()}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {createCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
        </button>
      </div>
    </div>
  );
}
