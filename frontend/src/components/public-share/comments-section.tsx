'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MessageCircle, Trash2, Heart, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  share_id: string;
  reader_name: string;
  reader_email: string;
  content: string;
  created_at: string;
  likes: number;
  replies: Comment[];
}

interface CommentsProps {
  shareUrl: string;
  allowComments: boolean;
  isOwner?: boolean;
}

export function CommentSection({ shareUrl, allowComments, isOwner = false }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [readerName, setReaderName] = useState('');
  const [readerEmail, setReaderEmail] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch comments
  const { data: commentsData, isLoading, refetch } = useQuery({
    queryKey: ['comments', shareUrl],
    queryFn: async () => {
      const response = await api.get(`/share/${shareUrl}/comments`);
      return response.data || [];
    },
    enabled: allowComments,
  });

  useEffect(() => {
    if (commentsData) {
      setComments(commentsData);
    }
  }, [commentsData]);

  // Submit comment mutation
  const submitCommentMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/share/${shareUrl}/comments`, {
        reader_name: readerName,
        reader_email: readerEmail,
        content: newComment,
        reply_to: replyingTo || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      setNewComment('');
      setReaderName('');
      setReaderEmail('');
      setReplyingTo(null);
      toast.success('Comment posted!');
      refetch();
    },
    onError: () => {
      toast.error('Failed to post comment');
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`);
    },
    onSuccess: () => {
      toast.success('Comment deleted');
      refetch();
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  // Like comment mutation
  const likeCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await api.post(`/comments/${commentId}/like`);
      return response.data;
    },
    onSuccess: () => {
      refetch();
    },
  });

  if (!allowComments) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-gray-600">Comments are disabled for this book.</p>
      </div>
    );
  }

  const handleSubmitComment = () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    if (!isOwner && !readerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!isOwner && !readerEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }
    submitCommentMutation.mutate();
  };

  const renderComments = (items: Comment[] = []) => {
    return items.map((comment) => (
      <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-gray-900">{comment.reader_name}</p>
            <p className="text-xs text-gray-500 mb-2">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </p>
          </div>
          {isOwner && (
            <Button
              onClick={() => deleteCommentMutation.mutate(comment.id)}
              variant="ghost"
              size="sm"
              disabled={deleteCommentMutation.isPending}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>

        <p className="text-gray-700 mb-3">{comment.content}</p>

        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => likeCommentMutation.mutate(comment.id)}
            disabled={likeCommentMutation.isPending}
            className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
          >
            <Heart className="h-4 w-4" />
            <span>{comment.likes}</span>
          </button>
          {!isOwner && (
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors"
            >
              <Reply className="h-4 w-4" />
              <span>Reply</span>
            </button>
          )}
        </div>

        {/* Nested comments */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {renderComments(comment.replies)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Comment form */}
      {allowComments && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {replyingTo ? 'Add a Reply' : 'Leave a Comment'}
          </h3>

          {!isOwner && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input
                placeholder="Your name"
                value={readerName}
                onChange={(e) => setReaderName(e.target.value)}
                disabled={submitCommentMutation.isPending}
              />
              <Input
                type="email"
                placeholder="Your email"
                value={readerEmail}
                onChange={(e) => setReaderEmail(e.target.value)}
                disabled={submitCommentMutation.isPending}
              />
            </div>
          )}

          <Textarea
            ref={textareaRef}
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitCommentMutation.isPending}
            className="mb-4"
            rows={4}
          />

          <div className="flex items-center justify-between">
            <Button
              onClick={handleSubmitComment}
              disabled={submitCommentMutation.isPending || !newComment.trim()}
            >
              {submitCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </Button>

            {replyingTo && (
              <Button
                onClick={() => {
                  setReplyingTo(null);
                  setNewComment('');
                }}
                variant="outline"
              >
                Cancel Reply
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {comments.length === 0 ? 'No comments yet' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
        </h3>
        {isLoading ? (
          <p className="text-gray-500">Loading comments...</p>
        ) : comments.length > 0 ? (
          <div className="space-y-4">
            {renderComments(comments)}
          </div>
        ) : (
          <p className="text-gray-500">Be the first to comment!</p>
        )}
      </div>
    </div>
  );
}
