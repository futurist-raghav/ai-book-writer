import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useNotifications } from '../../lib/notifications-service';

/**
 * Main authenticated app navigation using bottom tabs
 */
export default function MainLayout() {
  const colorScheme = useColorScheme();
  const { unreadCount } = useNotifications();

  // Notification badge component
  const NotificationBadge = () => {
    if (!unreadCount || unreadCount === 0) return null;
    
    return (
      <View
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          backgroundColor: '#ef4444',
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colorScheme === 'dark' ? '#1f2937' : '#fff',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Text>
      </View>
    );
  };

  const tabBarOptions: BottomTabNavigationOptions = {
    headerShown: true,
    tabBarActiveTintColor: colorScheme === 'dark' ? '#0a7ea4' : '#0369a1',
    tabBarInactiveTintColor: colorScheme === 'dark' ? '#999' : '#999',
  };

  return (
    <Tabs screenOptions={tabBarOptions}>
      {/* Books Tab */}
      <Tabs.Screen
        name="books"
        options={{
          title: 'Books',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          ),
          headerTitle: 'My Books',
        }}
      />

      {/* Writing Tab */}
      <Tabs.Screen
        name="writing"
        options={{
          title: 'Writing',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pencil" size={size} color={color} />
          ),
          headerTitle: 'Writing Dashboard',
        }}
      />

      {/* Explore Tab */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
          headerTitle: 'Explore',
        }}
      />

      {/* Notifications Tab */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications" size={size} color={color} />
              <NotificationBadge />
            </View>
          ),
          headerTitle: 'Notifications',
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
          headerTitle: 'My Profile',
        }}
      />
    </Tabs>
  );
}
