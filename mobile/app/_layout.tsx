import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '../lib/react-query';
import { useAuthStore } from '../lib/store';
import { storage } from '../lib/storage';

/**
 * Root layout component
 * Handles auth state hydration and root navigation structure
 */
export default function RootLayout() {
  const { user, setUser, hydrate } = useAuthStore();
  const [isHydrating, setIsHydrating] = React.useState(true);

  // Hydrate auth state on app launch
  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        await hydrate();
      } catch (error) {
        console.error('Failed to hydrate auth:', error);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrateAuth();
  }, [hydrate]);

  if (isHydrating) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {user ? <AuthenticatedStack /> : <UnauthenticatedStack />}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Navigation for authenticated users
 */
function AuthenticatedStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen
        name="(main)"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="modal"
        options={{
          animationEnabled: true,
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

/**
 * Navigation for unauthenticated users
 */
function UnauthenticatedStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="(auth)"
        options={{
          animationEnabled: false,
        }}
      />
    </Stack>
  );
}
