/**
 * useRealtimeCollaboration Hook
 * 
 * Manages WebSocket connection for real-time chapter collaboration.
 * Handles presence, cursor positions, text edits, and notifications.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface PresenceUser {
  user_id: string;
  name: string;
  avatar?: string;
  cursor_pos: number;
  selection?: { from: number; to: number };
  last_activity: string;
  status: string;
}

interface CollaborationEvent {
  type:
    | 'presence_update'
    | 'cursor_update'
    | 'text_edit'
    | 'comment_added'
    | 'suggestion_added'
    | 'notification'
    | 'user_typing'
    | 'sync_response'
    | 'pong';
  data?: any;
  users?: PresenceUser[];
  user_id?: string;
  position?: number;
  selection?: any;
  delta?: any;
  is_typing?: boolean;
  content?: string;
  compiled_content?: string;
  last_modified?: string;
  timestamp?: string;
}

interface UseRealtimeCollaborationOptions {
  chapterId: string;
  token: string;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onCursorMove?: (userId: string, position: number, selection?: any) => void;
  onTextEdit?: (delta: any) => void;
  onCommentAdded?: (comment: any) => void;
  onSuggestionAdded?: (suggestion: any) => void;
  onNotification?: (notification: any) => void;
  onUserTyping?: (userId: string, isTyping: boolean) => void;
}

export function useRealtimeCollaboration({
  chapterId,
  token,
  onPresenceUpdate,
  onCursorMove,
  onTextEdit,
  onCommentAdded,
  onSuggestionAdded,
  onNotification,
  onUserTyping,
}: UseRealtimeCollaborationOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  const onCursorMoveRef = useRef(onCursorMove);
  const onTextEditRef = useRef(onTextEdit);
  const onCommentAddedRef = useRef(onCommentAdded);
  const onSuggestionAddedRef = useRef(onSuggestionAdded);
  const onNotificationRef = useRef(onNotification);
  const onUserTypingRef = useRef(onUserTyping);

  useEffect(() => {
    onPresenceUpdateRef.current = onPresenceUpdate;
  }, [onPresenceUpdate]);

  useEffect(() => {
    onCursorMoveRef.current = onCursorMove;
  }, [onCursorMove]);

  useEffect(() => {
    onTextEditRef.current = onTextEdit;
  }, [onTextEdit]);

  useEffect(() => {
    onCommentAddedRef.current = onCommentAdded;
  }, [onCommentAdded]);

  useEffect(() => {
    onSuggestionAddedRef.current = onSuggestionAdded;
  }, [onSuggestionAdded]);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    onUserTypingRef.current = onUserTyping;
  }, [onUserTyping]);

  // Connect to WebSocket
  useEffect(() => {
    if (!chapterId || !token) return;

    const apiBase =
      (process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.host}/api/v1`).replace(/\/$/, '');
    const wsBase = apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const wsUrl = `${wsBase}/ws/chapters/${chapterId}/collaborate?token=${encodeURIComponent(token)}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      toast.success('Connected to chapter collaboration');

      // Send initial sync request
      ws.current?.send(
        JSON.stringify({
          type: 'request_sync',
        })
      );

      // Start heartbeat
      heartbeatInterval.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Every 30 seconds
    };

    ws.current.onmessage = (event) => {
      try {
        const message: CollaborationEvent = JSON.parse(event.data);

        switch (message.type) {
          case 'presence_update':
            setPresenceUsers(message.users || []);
            onPresenceUpdateRef.current?.(message.users || []);
            break;

          case 'cursor_update':
            if (message.user_id && typeof message.position === 'number') {
              onCursorMoveRef.current?.(message.user_id, message.position, message.selection);
            }
            break;

          case 'text_edit':
            onTextEditRef.current?.(message.delta);
            break;

          case 'comment_added':
            onCommentAddedRef.current?.(message.data);
            toast.info(`New comment from ${message.data?.author?.name || 'Someone'}`);
            break;

          case 'suggestion_added':
            onSuggestionAddedRef.current?.(message.data);
            toast.info(`New suggestion: ${message.data?.suggestion_type}`);
            break;

          case 'notification':
            onNotificationRef.current?.(message.data);
            toast.message(message.data?.title || 'Notification', {
              description: message.data?.message,
            });
            break;

          case 'user_typing':
            if (message.user_id) {
              onUserTypingRef.current?.(
                message.user_id,
                message.is_typing ?? message.data?.is_typing ?? false
              );
            }
            break;

          case 'sync_response':
            setLastSyncTime(message.last_modified ?? message.data?.last_modified ?? null);
            toast.success('Synced with server');
            break;

          case 'pong':
            // Heartbeat response, no action needed
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      toast.error('Connection error');
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setPresenceUsers([]);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [chapterId, token]);

  // Send cursor position
  const sendCursorMove = useCallback(
    (position: number, selection?: { from: number; to: number }) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: 'cursor_move',
            position,
            selection,
          })
        );
      }
    },
    []
  );

  // Send text edit
  const sendTextEdit = useCallback((delta: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'text_edit',
          delta,
        })
      );
    }
  }, []);

  // Send comment notification
  const sendCommentAdded = useCallback((commentData: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'comment_added',
          data: commentData,
        })
      );
    }
  }, []);

  // Send suggestion notification
  const sendSuggestionAdded = useCallback((suggestionData: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'suggestion_added',
          data: suggestionData,
        })
      );
    }
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'typing',
          is_typing: isTyping,
        })
      );
    }
  }, []);

  // Request full sync
  const requestSync = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'request_sync' }));
    }
  }, []);

  return {
    isConnected,
    presenceUsers,
    lastSyncTime,
    sendCursorMove,
    sendTextEdit,
    sendCommentAdded,
    sendSuggestionAdded,
    sendTypingIndicator,
    requestSync,
  };
}
