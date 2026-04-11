import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '../lib/react-query';
import { useAuthStore, useDBStore } from '../lib/store';
import { storage } from '../lib/storage';
import { initializeDatabase } from '../lib/database';
import { initializeNotifications, cleanupNotifications } from '../lib/notifications-init';

/**
 * Root layout component
 * Handles auth state hydration, database initialization, and notifications setup
 */
export default function RootLayout() {
  const { user, setUser, hydrate } = useAuthStore();
  const { setDatabase, setInitialized } = useDBStore();
  const [isHydrating, setIsHydrating] = React.useState(true);

  // Hydrate auth state, initialize database, and set up notifications on app launch
  useEffect(() => {
    const hydrateApp = async () => {
      try {
        await hydrate();
        // Initialize WatermelonDB
        const database = await initializeDatabase();
        setDatabase(database);
        setInitialized(true);
        
        // Initialize notifications (requires auth)
        await initializeNotifications();
      } catch (error) {
        console.error('Failed to hydrate app:', error);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrateApp();

    // Cleanup on unmount (logout)
    return () => {
      if (!user) {
        cleanupNotifications().catch(console.error);
      }
    };
  }, [hydrate, setDatabase, setInitialized, user]);

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
