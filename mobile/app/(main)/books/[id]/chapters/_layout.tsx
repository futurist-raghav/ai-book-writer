import React from 'react';
import { Stack } from 'expo-router';

/**
 * Chapters navigation stack for a specific book
 */
export default function ChaptersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]/detail"
        options={{
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'modal',
          animationEnabled: true,
        }}
      />
    </Stack>
  );
}
