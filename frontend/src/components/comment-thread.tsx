/**
 * Comment Thread Component
 * 
 * Displays chapter comments with replies, mentions, and resolution tracking.
 * Can be displayed as:
 * - Inline comments at specific positions in the editor
 * - Side panel showing all comments
 * - Modal for detailed comment view
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Comment {
  id: string;
  chapter_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  position?: number;
  context_text?: string;
  created_at: string;
  updated_at: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  mentions: string[];
  reply_count: number;
  likes: number;
}

interface CommentReply {
  id: string;
  comment_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  created_at: string;
  updated_at: string;
  mentions: string[];
  likes: number;
}

interface CommentsResponse {
  comments: Comment[];
  unresolved_count?: number;
}

interface CommentThreadProps {
  chapterId: string;
  commentId: string;
  expanded?: boolean;
  onResolve?: () => void;
  onUserMention?: (userId: string) => void;
}

/**
 * Single comment with replies thread
 */
export const CommentThread: React.FC<CommentThreadProps> = ({
  chapterId,
  commentId,
  expanded = false,
  onResolve,
  onUserMention,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(expanded);

  // TODO: Fetch single comment with replies
  // const { data: comment } = useQuery(
  //   ['comments', commentId],
  //   () => api.get(`/api/v1/chapters/${chapterId}/comments/${commentId}`)
  // );

  const resolveCommentMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/chapters/${chapterId}/comments/${commentId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', chapterId] });
      onResolve?.();
    }
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/chapters/${chapterId}/comments/${commentId}/reply`, {
        content,
        mentioned_users: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', commentId] });
      setReplyText('');
      setIsReplying(false);
    }
  });

  const handleSubmitReply = useCallback(() => {
    if (replyText.trim()) {
      replyMutation.mutate(replyText);
    }
  }, [replyText, replyMutation]);

  return (
    <Card className="border-l-4 border-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Author avatar */}
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold">
              {/* {comment?.author_name?.[0] ?? 'U'} */}
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{/*comment?.author_name ??*/ 'Author'}</p>
              <p className="text-xs text-gray-500">
                {/*comment?.created_at && formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })*/}
                a few seconds ago
              </p>
            </div>
          </div>

          {/* Comment actions */}
          <div className="flex items-center gap-1">
            {!/*comment?.is_resolved*/ false && user?.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resolveCommentMutation.mutate()}
                className="text-xs"
                disabled={resolveCommentMutation.isPending}
              >
                ✓ Resolve
              </Button>
            )}
            {/*comment?.is_resolved*/ false && (
              <Badge variant="outline" className="text-green-700 border-green-500">
                Resolved
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Comment context (if inline) */}
        {/*comment?.context_text && (
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm italic text-gray-600 dark:text-gray-400 border-l-2 border-gray-400">
            "{comment.context_text}"
          </div>
        )*/}

        {/* Comment content */}
        <p className="text-sm leading-relaxed">
          {/*comment?.content ??*/ 'Comment content'}
        </p>

        {/* Comment metadata */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <button className="hover:text-gray-700 dark:hover:text-gray-300">
            👍 {/*comment?.likes ??*/ 0} Likes
          </button>
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="hover:text-gray-700 dark:hover:text-gray-300"
          >
            💬 {/*comment?.reply_count ??*/ 0} Replies
          </button>
        </div>

        {/* Replies section */}
        {showReplies && (
          <div className="space-y-3 border-t pt-3">
            {/* Reply threads */}
            <div className="space-y-2 ml-4">
              {/* TODO: Map through replies */}
              {/* <div className="text-sm text-gray-500">No replies yet</div> */}
            </div>

            {/* Reply input */}
            {isReplying ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReplying(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitReply}
                    disabled={replyMutation.isPending || !replyText.trim()}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReplying(true)}
                className="mt-2"
              >
                Add Reply
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface CommentsListProps {
  chapterId: string;
  onSelectComment?: (commentId: string, position?: number) => void;
}

/**
 * List of all comments for a chapter, optionally filtered by resolution status
 */
export const CommentsList: React.FC<CommentsListProps> = ({
  chapterId,
  onSelectComment,
}) => {
  const [showResolved, setShowResolved] = useState(false);

  // Fetch comments for chapter
  const { data: commentsData, isLoading } = useQuery<CommentsResponse>({
    queryKey: ['comments', chapterId, { resolved: showResolved }],
    queryFn: async () => {
      const response = await api.get(`/chapters/${chapterId}/comments?resolved_only=${showResolved}`);
      return response.data as CommentsResponse;
    },
  });

  const comments = useMemo<Comment[]>(() => commentsData?.comments ?? [], [commentsData]);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading comments...</div>;
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {showResolved ? 'No resolved comments' : 'No comments yet'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-4 border-b">
        <button
          onClick={() => setShowResolved(false)}
          className={`px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
            !showResolved
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Active ({commentsData?.unresolved_count ?? 0})
        </button>
        <button
          onClick={() => setShowResolved(true)}
          className={`px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
            showResolved
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Comments list */}
      <div className="space-y-3 px-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            onClick={() => onSelectComment?.(comment.id, comment.position)}
            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 p-3 rounded-lg transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{comment.author_name}</p>
                {comment.context_text && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    "{comment.context_text}"
                  </p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mt-1">
                  {comment.content}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span>
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
              {comment.reply_count > 0 && <span>💬 {comment.reply_count}</span>}
              {comment.is_resolved && <Badge variant="outline">Resolved</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface InlineCommentMarkerProps {
  commentId: string;
  position: number;
  onClick?: () => void;
  isResolved?: boolean;
}

/**
 * Visual marker for inline comments in editor
 * Renders as a highlight or badge at the specified position
 */
export const InlineCommentMarker: React.FC<InlineCommentMarkerProps> = ({
  commentId,
  position,
  onClick,
  isResolved = false,
}) => {
  return (
    <span
      onClick={onClick}
      className={`inline-block px-2 py-0.5 mx-1 rounded text-xs font-medium cursor-pointer transition-colors ${
        isResolved
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200'
      }`}
      title={isResolved ? 'Resolved comment' : 'Click to view comment'}
    >
      💬
    </span>
  );
};

interface CommentPanelProps {
  chapterId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectComment?: (commentId: string) => void;
}

/**
 * Side panel for displaying all comments in a chapter
 */
export const CommentPanel: React.FC<CommentPanelProps> = ({
  chapterId,
  isOpen,
  onClose,
  onSelectComment,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-lg flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Comments</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"
        >
          ✕
        </button>
      </div>

      {/* Comments content */}
      <div className="flex-1 overflow-y-auto">
        <CommentsList chapterId={chapterId} onSelectComment={onSelectComment} />
      </div>
    </div>
  );
};

interface CommentNotificationProps {
  notification: {
    id: string;
    type: 'mention' | 'reply' | 'resolved';
    trigger_user_name: string;
    message: string;
    is_read: boolean;
    created_at: string;
  };
  onDismiss?: () => void;
  onClick?: () => void;
}

/**
 * Toast-like notification for comment mentions/replies
 */
export const CommentNotification: React.FC<CommentNotificationProps> = ({
  notification,
  onDismiss,
  onClick,
}) => {
  const icons = {
    mention: '👤',
    reply: '💬',
    resolved: '✓',
  };

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
    >
      <span className="text-xl">{icons[notification.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {notification.trigger_user_name}
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300">{notification.message}</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-blue-400 hover:text-blue-600 flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default CommentThread;
