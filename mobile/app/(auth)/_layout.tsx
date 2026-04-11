import React from 'react';
import { Stack } from 'expo-router';

/**
 * Auth stack for unauthenticated users
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          animationEnabled: true,
        }}
      />
    </Stack>
  );
}
