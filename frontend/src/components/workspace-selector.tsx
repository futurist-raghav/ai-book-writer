'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Building2, Plus, Settings, ChevronDown, Loader } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  status: string;
  created_at: string;
}

interface WorkspaceSelectorProps {
  currentWorkspaceId?: string;
  onWorkspaceChange?: (workspaceId: string) => void;
}

export function WorkspaceSelector({
  currentWorkspaceId,
  onWorkspaceChange,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user workspaces
  const { data: workspaceResponse, isLoading } = useQuery({
    queryKey: ['workspaces-list'],
    queryFn: async () => {
      const response = await fetch('/api/v1/workspaces?limit=50');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      return response.json();
    },
  });

  // Switch workspace mutation
  const switchWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const response = await fetch('/api/v1/workspaces/user/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to switch workspace');
      return response.json();
    },
    onSuccess: (data, workspaceId) => {
      onWorkspaceChange?.(workspaceId);
      setIsOpen(false);
    },
  });

  const workspaces = workspaceResponse?.workspaces || [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
        <Loader className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {currentWorkspace?.name || 'Select workspace'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="max-h-64 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => switchWorkspaceMutation.mutate(workspace.id)}
                disabled={switchWorkspaceMutation.isPending}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  workspace.id === currentWorkspaceId
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
              >
                <h4 className="font-medium text-gray-900 dark:text-white">{workspace.name}</h4>
                {workspace.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{workspace.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkspaceLinkButton({
  workspaceId,
  label = 'Go to Workspace',
}: {
  workspaceId: string;
  label?: string;
}) {
  return (
    <a
      href={`/dashboard/workspaces/${workspaceId}`}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
    >
      <Building2 className="w-4 h-4" />
      {label}
    </a>
  );
}
