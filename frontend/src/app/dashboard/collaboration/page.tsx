'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'reviewer' | 'contributor' | 'viewer';
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

export default function CollaborationPage() {
  const queryClient = useQueryClient();

  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer' | 'contributor' | 'viewer'>('reviewer');

  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments' | 'activity'>('collaborators');

  // Fetch collaborators
  const { data: collaboratorsData, isLoading: loadingCollaborators } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => apiClient.collaboration.members(),
  });

  // Fetch comments
  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ['collaboration-comments'],
    queryFn: () => apiClient.collaboration.comments(),
  });

  // Fetch activity log
  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['collaboration-activity'],
    queryFn: () => apiClient.collaboration.activity(),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: 'editor' | 'reviewer' | 'contributor' | 'viewer' }) =>
      apiClient.collaboration.invite(data),
    onSuccess: () => {
      toast.success('Invitation sent');
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      setInviteEmail('');
      setInviteMode(false);
    },
    onError: () => toast.error('Failed to send invitation'),
  });

  const addCommentMutation = useMutation({
    mutationFn: (data: { chapter_id: string; text: string; position?: number }) =>
      apiClient.collaboration.addComment(data),
    onSuccess: () => {
      toast.success('Comment added');
      queryClient.invalidateQueries({ queryKey: ['collaboration-comments'] });
      setCommentText('');
      setCommentMode(false);
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: (id: string) => apiClient.collaboration.removeMember(id),
    onSuccess: () => {
      toast.success('Collaborator removed');
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
    onError: () => toast.error('Failed to remove collaborator'),
  });

  const collaborators: Collaborator[] = collaboratorsData?.data?.items || [];
  const comments: Comment[] = commentsData?.data?.items || [];
  const activities: Activity[] = activityData?.data?.items || [];

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
            <h3 className="text-lg font-bold text-primary">Team Members</h3>
            <button
              onClick={() => setInviteMode(!inviteMode)}
              className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg font-label font-bold text-sm shadow-sm hover:bg-secondary/90 transition-all"
            >
              <span className="material-symbols-outlined">person_add</span>
              Invite
            </button>
          </div>

          {inviteMode && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/10 mb-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="collaborator@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
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
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg font-label font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => setInviteMode(false)}
                    className="flex-1 bg-surface-container px-4 py-2 rounded-lg font-label font-bold text-sm text-primary hover:bg-surface-container-high"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {loadingCollaborators ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : collaborators.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-lg border border-dashed border-outline-variant/20">
                <p className="text-on-surface-variant text-sm">No collaborators yet. Invite team members to get started.</p>
              </div>
            ) : (
              collaborators.map((collab) => (
                <div key={collab.id} className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-primary">{collab.name}</p>
                    <p className="text-xs text-on-surface-variant">{collab.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded uppercase">
                        {collab.role}
                      </span>
                      {collab.last_active && <span className="text-[10px] text-on-surface-variant">Last active: {new Date(collab.last_active).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {collab.role !== 'owner' && (
                    <button
                      onClick={() => removeCollaboratorMutation.mutate(collab.id)}
                      className="text-error hover:opacity-70 transition-opacity"
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
            <h3 className="text-lg font-bold text-primary">Comments & Feedback</h3>
            <button
              onClick={() => setCommentMode(!commentMode)}
              className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg font-label font-bold text-sm shadow-sm hover:bg-secondary/90 transition-all"
            >
              <span className="material-symbols-outlined">add_comment</span>
              Add
            </button>
          </div>

          {commentMode && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/10 mb-6">
              <div className="mb-4">
                <label className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Chapter/Section (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Chapter 5"
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                />
              </div>
              <div className="mb-4">
                <label className="block font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Comment</label>
                <textarea
                  placeholder="Add your feedback or comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label min-h-24 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addCommentMutation.mutate({ chapter_id: selectedChapter || '', text: commentText })}
                  disabled={addCommentMutation.isPending || !commentText.trim()}
                  className="bg-primary text-white px-4 py-2 rounded-lg font-label font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  Post
                </button>
                <button
                  onClick={() => setCommentMode(false)}
                  className="bg-surface-container px-4 py-2 rounded-lg font-label font-bold text-sm text-primary hover:bg-surface-container-high"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {loadingComments ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-lg border border-dashed border-outline-variant/20">
                <p className="text-on-surface-variant text-sm">No comments yet. Start collaborating!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={`bg-surface-container-lowest border ${comment.resolved ? 'border-success/30 opacity-60' : 'border-outline-variant/10'} rounded-lg p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm text-primary">{comment.author}</p>
                      {comment.chapter && <p className="text-xs text-on-surface-variant">on {comment.chapter}</p>}
                    </div>
                    {comment.resolved && <span className="text-success text-xs font-bold">RESOLVED</span>}
                  </div>
                  <p className="text-sm text-on-surface-variant">{comment.content}</p>
                  <p className="text-xs text-on-surface-variant/50 mt-2">{new Date(comment.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div>
          <h3 className="text-lg font-bold text-primary mb-6">Activity Log</h3>
          <div className="space-y-3">
            {loadingActivity ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12 bg-surface-container-lowest rounded-lg border border-dashed border-outline-variant/20">
                <p className="text-on-surface-variant text-sm">No activity yet.</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary flex-shrink-0">history</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface-variant">
                      <span className="font-bold text-primary">{activity.user}</span> {activity.action}
                      {activity.resource && <span className="text-secondary"> {activity.resource}</span>}
                    </p>
                    <p className="text-xs text-on-surface-variant/50">{new Date(activity.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
