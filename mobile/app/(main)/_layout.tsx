import React from 'react';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Main authenticated app navigation using bottom tabs
 */
export default function MainLayout() {
  const colorScheme = useColorScheme();

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
