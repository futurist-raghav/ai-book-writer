'use client';

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotifications, PushNotification } from '@/mobile/lib/notifications-service';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

/**
 * NotificationBadge - Shows unread count for tab bar
 */
export function NotificationBadge() {
  const { unreadCount } = useNotifications();

  if (unreadCount === 0) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{Math.min(unreadCount, 99)}</Text>
    </View>
  );
}

/**
 * NotificationItem - Individual notification in list
 */
function NotificationItemComponent({
  notification,
  onPress,
  onDismiss,
}: {
  notification: PushNotification;
  onPress: (notification: PushNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const getIconName = (type: PushNotification['type']) => {
    switch (type) {
      case 'chapter_update':
        return 'book-open-variant';
      case 'collaboration':
        return 'account-multiple';
      case 'assignment':
        return 'clipboard-list';
      case 'milestone':
        return 'trophy-variant';
      default:
        return 'bell';
    }
  };

  const getTypeColor = (type: PushNotification['type']) => {
    switch (type) {
      case 'chapter_update':
        return '#3b82f6';
      case 'collaboration':
        return '#8b5cf6';
      case 'assignment':
        return '#ec4899';
      case 'milestone':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.notificationItem, !notification.read && styles.notificationItemUnread]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBg, { borderColor: getTypeColor(notification.type) }]}>
        <MaterialCommunityIcons
          name={getIconName(notification.type)}
          size={20}
          color={getTypeColor(notification.type)}
        />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.timestamp}>
          {format(new Date(notification.timestamp), 'MMM d, h:mm a')}
        </Text>
      </View>

      <TouchableOpacity onPress={() => onDismiss(notification.id)} style={styles.dismissButton}>
        <MaterialCommunityIcons name="close" size={18} color="#9ca3af" />
      </TouchableOpacity>

      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

/**
 * NotificationCenter - Full notification list and management
 */
export function NotificationCenter({
  onNotificationPress,
}: {
  onNotificationPress?: (notification: PushNotification) => void;
}) {
  const { notifications, markAsRead, deleteNotification, markAllAsRead } = useNotifications();

  const handleNotificationPress = (notification: PushNotification) => {
    markAsRead(notification.id);
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="bell-outline" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>No notifications yet</Text>
        <Text style={styles.emptySubtext}>You'll see them here when you get updates</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some((n) => !n.read) && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllButton}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItemComponent
            notification={item}
            onPress={handleNotificationPress}
            onDismiss={deleteNotification}
          />
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },

  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  markAllButton: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },

  listContent: {
    paddingVertical: 8,
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notificationItemUnread: {
    backgroundColor: '#f0f9ff',
  },

  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: 12,
    backgroundColor: '#f9fafb',
  },

  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
  },

  dismissButton: {
    padding: 8,
    marginLeft: 8,
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
    marginLeft: 8,
  },
});

/**
 * Default export - NotificationCenter screen
 */
export default function NotificationsPage() {
  return <NotificationCenter />;
}
