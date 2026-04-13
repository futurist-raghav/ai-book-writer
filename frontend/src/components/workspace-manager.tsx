'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Loader,
  ArrowRight,
  Trash2,
  MoreVertical,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  status: string;
}

interface WorkspaceListResponse {
  workspaces: Workspace[];
}

export function WorkspaceManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch workspaces
  const { data: workspaceResponse, isLoading, refetch } = useQuery<WorkspaceListResponse>({
    queryKey: ['all-workspaces'],
    queryFn: async () => {
      const response = await fetch('/api/v1/workspaces?limit=100');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      return (await response.json()) as WorkspaceListResponse;
    },
  });

  // Create workspace mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
        }),
      });
      if (!response.ok) throw new Error('Failed to create workspace');
      return response.json();
    },
    onSuccess: () => {
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
      refetch();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate();
  };

  const workspaces = workspaceResponse?.workspaces || [];

  if (isLoading) {
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
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Workspaces</h1>
          <p className="text-gray-600 dark:text-gray-400">Organize your books and team</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Workspace
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4"
        >
          <h3 className="font-semibold">Create New Workspace</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                placeholder="e.g., My Publishing Team"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                placeholder="What is this workspace for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || !newName.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {createMutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">No workspaces yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first workspace to start organizing your books.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{workspace.name}</h3>
                    {workspace.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {workspace.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === workspace.id ? null : workspace.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Created {new Date(workspace.created_at).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <a
                  href={`/dashboard/workspaces/${workspace.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Open
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {expandedId === workspace.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <button className="w-full text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete workspace
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {workspaces.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{workspaces.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total workspaces</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">∞</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Books per workspace</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Role levels</p>
          </div>
        </div>
      )}
    </div>
  );
}
