import React from 'react';
import { Stack } from 'expo-router';

/**
 * Chapter detail navigation
 */
export default function ChapterDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="detail" />
    </Stack>
  );
}
