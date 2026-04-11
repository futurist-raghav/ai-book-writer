import React from 'react';
import { Stack } from 'expo-router';

/**
 * Book details navigation stack
 */
export default function BookDetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="chapters" />
    </Stack>
  );
}
