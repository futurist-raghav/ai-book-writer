'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader,
  Mail,
  MoreVertical,
} from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  joined_at: string;
  is_pending: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface WorkspaceDetail {
  id: string;
  name: string;
  description?: string;
}

interface WorkspaceMembersResponse {
  members: Member[];
}

interface WorkspaceSettingsProps {
  workspaceId: string;
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [showSettings, setShowSettings] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');

  // Fetch workspace details
  const { data: workspace, isLoading: workspaceLoading } = useQuery<WorkspaceDetail>({
    queryKey: ['workspace-detail', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch workspace');
      return (await response.json()) as WorkspaceDetail;
    },
  });

  // Fetch members
  const { data: membersResponse, refetch: refetchMembers } = useQuery<WorkspaceMembersResponse>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');
      return (await response.json()) as WorkspaceMembersResponse;
    },
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: inviteRole }),
      });
      if (!response.ok) throw new Error('Failed to invite member');
      return response.json();
    },
    onSuccess: () => {
      setInviteEmail('');
      refetchMembers();
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      refetchMembers();
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      return response.json();
    },
    onSuccess: () => {
      refetchMembers();
    },
  });

  const members = membersResponse?.members || [];

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    // In a real app, you'd look up the user by email first
    // For now, simulating with the email as a placeholder
    inviteMutation.mutate(inviteEmail);
  };

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold dark:text-white">Workspace Settings</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Workspace Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={workspaceName || workspace?.name}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={workspaceDescription || workspace?.description}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Members Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-lg">Team Members</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">({members.length})</span>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-800 dark:text-white"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviteMutation.isPending || !inviteEmail}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              {inviteMutation.isPending ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Invite
            </button>
          </div>
        </form>

        {/* Members List */}
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No members yet. Invite team members to collaborate.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                      {(member.user?.name || member.user?.email)[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.user?.name || member.user?.email}
                    </p>
                    <div className="flex items-center gap-2">
                      {member.is_pending && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({
                        memberId: member.id,
                        role: e.target.value,
                      })
                    }
                    disabled={updateRoleMutation.isPending}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => removeMutation.mutate(member.id)}
                    disabled={removeMutation.isPending}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Role Permissions
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <strong>Viewer:</strong> Read-only access to workspace and books</li>
          <li>• <strong>Editor:</strong> Can create and edit books, manage content</li>
          <li>• <strong>Admin:</strong> Full control over settings, members, and books</li>
        </ul>
      </div>
    </div>
  );
}
