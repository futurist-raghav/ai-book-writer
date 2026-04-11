'use client';

/**
 * CollaborationPresenceBar Component
 * 
 * Shows active collaborators in a chapter with their status and cursor positions.
 * Displays avatars, names, and typing indicators.
 */

import { useState, useMemo } from 'react';

interface PresenceUser {
  user_id: string;
  name: string;
  avatar?: string;
  cursor_pos: number;
  selection?: { from: number; to: number };
  last_activity: string;
  status: string;
}

interface CollaborationPresenceBarProps {
  users: PresenceUser[];
  currentUserId?: string;
  isConnected: boolean;
  typingUsers?: Set<string>;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getColorForUserId = (userId: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-cyan-500',
  ];
  const hash = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return colors[hash % colors.length];
};

export function CollaborationPresenceBar({
  users,
  currentUserId,
  isConnected,
  typingUsers = new Set(),
}: CollaborationPresenceBarProps) {
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  // Filter out current user from display
  const otherUsers = useMemo(
    () => users.filter((u) => u.user_id !== currentUserId),
    [users, currentUserId]
  );

  if (!isConnected && otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Divider */}
      {otherUsers.length > 0 && (
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
      )}

      {/* Active users */}
      <div className="flex items-center gap-2">
        {otherUsers.length > 0 && (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {otherUsers.length} editing
          </span>
        )}

        <div className="flex -space-x-2">
          {otherUsers.map((user) => (
            <div
              key={user.user_id}
              className="relative"
              onMouseEnter={() => setHoveredUserId(user.user_id)}
              onMouseLeave={() => setHoveredUserId(null)}
              title={`${user.name}${typingUsers.has(user.user_id) ? ' (typing)' : ''}`}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 object-cover cursor-pointer hover:ring-2 hover:ring-blue-400"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-semibold text-white ${getColorForUserId(user.user_id)} hover:ring-2 hover:ring-blue-400`}
                >
                  {getInitials(user.name)}
                </div>
              )}

              {/* Typing indicator */}
              {typingUsers.has(user.user_id) && (
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
              )}

              {/* Active indicator */}
              {user.status === 'active' && (
                <div className="absolute inset-0 rounded-full border border-green-400 opacity-50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Users count if more than 3 */}
      {otherUsers.length > 3 && (
        <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">
          +{otherUsers.length - 3}
        </span>
      )}
    </div>
  );
}
