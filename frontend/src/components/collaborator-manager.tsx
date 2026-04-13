/**
 * Collaborator Management Component
 * 
 * Manage book collaborators: invite, accept/reject, update roles, remove.
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type CollaboratorRole = 'owner' | 'editor' | 'contributor' | 'reviewer' | 'viewer';

const ROLE_DESCRIPTIONS: Record<CollaboratorRole, string> = {
  owner: 'Full access, can manage collaborators',
  editor: 'Can edit chapters and accept suggestions',
  contributor: 'Can add chapters and make suggestions',
  reviewer: 'Read-only, can comment and suggest',
  viewer: 'Read-only access to chapters',
};

const ROLE_COLORS: Record<CollaboratorRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  editor: 'bg-blue-100 text-blue-800',
  contributor: 'bg-green-100 text-green-800',
  reviewer: 'bg-orange-100 text-orange-800',
  viewer: 'bg-gray-100 text-gray-800',
};

interface Collaborator {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  role: CollaboratorRole;
  status: 'active' | 'invited' | 'rejected';
  created_at: string;
  accepted_at?: string;
}

interface CollaboratorManagerProps {
  bookId: string;
  isOwner: boolean;
}

interface CollaboratorsResponse {
  collaborators: Collaborator[];
}

/**
 * List and manage collaborators for a book
 */
export const CollaboratorManager: React.FC<CollaboratorManagerProps> = ({
  bookId,
  isOwner,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('contributor');

  // Fetch collaborators
  const { data: collaboratorsData, isLoading } = useQuery<CollaboratorsResponse>({
    queryKey: ['collaborators', bookId],
    queryFn: async () => {
      const response = await api.get(`/books/${bookId}/collaborators`);
      return response.data as CollaboratorsResponse;
    },
    enabled: isOwner,
  });

  const collaborators = collaboratorsData?.collaborators ?? [];

  const inviteMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/books/${bookId}/collaborators/invite`, {
        email: inviteEmail,
        role: inviteRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', bookId] });
      setInviteEmail('');
      setInviteRole('contributor');
      setShowInviteForm(false);
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      await api.delete(`/books/${bookId}/collaborators/${collaboratorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', bookId] });
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      collaboratorId,
      role,
    }: {
      collaboratorId: string;
      role: CollaboratorRole;
    }) => {
      await api.patch(`/books/${bookId}/collaborators/${collaboratorId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', bookId] });
    }
  });

  const handleInvite = useCallback(() => {
    if (inviteEmail.trim()) {
      inviteMutation.mutate();
    }
  }, [inviteEmail, inviteMutation]);

  if (!isOwner) {
    return (
      <div className="text-center py-8 text-gray-500">
        Only the book owner can manage collaborators
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading collaborators...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Invite form */}
      {showInviteForm ? (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Invite Collaborator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Email Address</label>
              <Input
                type="email"
                placeholder="collaborator@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)} - {desc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowInviteForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          + Invite Collaborator
        </Button>
      )}

      {/* Collaborators list */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Team Members ({collaborators.length})</h3>

        {collaborators.length === 0 ? (
          <p className="text-gray-500 text-sm">No collaborators yet. Invite someone to get started.</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((collab) => (
              <Card key={collab.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
                        {collab.user_name?.[0] ?? 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{collab.user_name}</p>
                        <p className="text-sm text-gray-500">{collab.user_email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status and role */}
                  <div className="flex items-center gap-3">
                    {collab.status === 'invited' && (
                      <Badge variant="outline" className="bg-yellow-50">
                        Invited
                      </Badge>
                    )}
                    <Badge className={ROLE_COLORS[collab.role]}>
                      {collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}
                    </Badge>
                  </div>

                  {/* Actions */}
                  {collab.user_id !== user?.id && (
                    <div className="flex gap-2">
                      {collab.role !== 'owner' && (
                        <select
                          value={collab.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({
                              collaboratorId: collab.id,
                              role: e.target.value as CollaboratorRole,
                            })
                          }
                          className="text-xs px-2 py-1 border rounded"
                          disabled={updateRoleMutation.isPending}
                        >
                          {Object.keys(ROLE_DESCRIPTIONS).map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeMutation.mutate(collab.id)}
                        disabled={removeMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                {/* Role description */}
                <p className="text-xs text-gray-500 mt-2">
                  {ROLE_DESCRIPTIONS[collab.role]}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h4 className="font-semibold text-sm mb-3">Role Permissions</h4>
        <div className="grid grid-cols-1 gap-2 text-xs">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <div key={role} className="flex items-start gap-2">
              <Badge className={ROLE_COLORS[role as CollaboratorRole]}>
                {role}
              </Badge>
              <span className="text-gray-600 dark:text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollaboratorManager;
