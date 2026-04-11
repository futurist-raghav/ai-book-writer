# P7.6 Mobile App - Implementation Guide

This guide covers the current state of the AI Book Writer mobile application and how to continue development.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on device/emulator
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

## Architecture Overview

### Technology Stack

- **Framework:** React Native 0.73 + Expo 50
- **Navigation:** Expo Router v2 (file-based routing)
- **State Management:** Zustand stores + TanStack React Query
- **Local Storage:** WatermelonDB (SQLite offline cache)
- **API Client:** Axios with secure interceptors
- **Security:** Expo SecureStore for encrypted tokens
- **Build:** EAS Build for iOS/Android

### Project Structure

```
mobile/
├── app/                      # Expo Router navigation
│   ├── _layout.tsx          # Root with auth guard
│   ├── (auth)/              # Auth screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   └── (main)/              # Bottom tab navigation
│       ├── books/           # Books list & reader
│       ├── writing/         # Writing dashboard (stub)
│       ├── explore/         # Explore section (stub)
│       └── profile/         # User profile & settings
│
├── lib/                     # Shared utilities
│   ├── api.ts              # API client with auth
│   ├── config.ts           # Environment & logger
│   ├── storage.ts          # Secure storage
│   ├── store.ts            # Zustand stores
│   ├── hooks.ts            # Custom hooks
│   ├── react-query.ts      # Query configuration
│   ├── database.ts         # WatermelonDB schema
│   ├── sync.ts             # Offline sync engine
│   ├── theme.ts            # Design tokens
│   ├── error-handling.ts   # Error utilities
│   ├── notification.ts     # Toast notifications
│   └── components.tsx      # Shared UI components
│
├── app.json                # Expo config
├── eas.json                # EAS Build config
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md
```

## Completion Status

### Phase 1: Foundation (40% → 50%)
✅ **Completed:**
- Expo Router navigation structure with auth guard
- Login/Register/Forgot Password screens
- Bottom tab navigation (Books, Writing, Explore, Profile)
- SecureStore token persistence
- Authentication flow integration

**In Progress:**
- WatermelonDB initialization (schema created, needs migration)
- Offline sync engine (framework built, needs action queue)

### Phase 2: Core Screens (80% → 90%)
✅ **Completed:**
- Books list screen (infinite scroll, pull-to-refresh)
- Profile screen (user info, theme settings, logout)
- Chapter list screen (with pagination)
- Chapter reader screen (with font size controls)
- Theme system with light/dark tokens

**To Do:**
- Quick draft creation screen
- Chapter search/filtering
- Writing dashboard stats

### Phase 3: Offline & Sync (Ready)
**Framework Built, Implementation Next:**
- Database schema defined (5 tables: books, chapters, sessions, syncs, cache)
- Sync engine with action queue and network detection
- Error retry with exponential backoff
- App foreground detection for sync trigger

### Phase 4: Notifications & Polish (Post-MVP)
- Push notifications (Firebase setup needed)
- Advanced error handling
- Performance profiling

## Key Modules

### 1. API Client (`lib/api.ts`)

```typescript
import { api } from '~/lib/api';

// Authentication
await api.login(email, password);
await api.register(email, password, username);
const user = await api.getMe();
await api.logout();

// Books
const books = await api.getBooks({ limit: 50 });
const book = await api.getBook(bookId);
const newBook = await api.createBook({ title, description });

// Chapters
const chapters = await api.getChapters(bookId);
const chapter = await api.getChapter(chapterId);
const newChapter = await api.createChapter(bookId, { title, content });
```

**Features:**
- Auto-injects Bearer token from SecureStore
- Auto-logout on 401 Unauthorized
- Configurable base URL (dev/staging/prod)
- Typed responses

### 2. State Management (`lib/store.ts`)

```typescript
import { useAuthStore, useBooksStore, useUIStore, useSyncStore } from '~/lib/store';

// Auth
const { user, setUser, setAccessToken } = useAuthStore();

// Books
const { books, selectedBook, setBooks, updateBook } = useBooksStore();

// UI
const { theme, setTheme, showNotification } = useUIStore();

// Sync
const { isSyncing, lastSyncTime, pendingActions } = useSyncStore();
```

### 3. Offline Storage & Sync

**Database Setup:**
```typescript
import { initializeDatabase } from '~/lib/database';

const db = await initializeDatabase();
// Database ready for WatermelonDB operations
```

**Sync Engine:**
```typescript
import { useSyncEngine } from '~/lib/sync';

const { addPendingAction, sync, isOnline, getPendingCount } = useSyncEngine();

// Queue a write operation
addPendingAction('action-id', {
  type: 'create',
  resource: 'chapter',
  data: { title: 'New Chapter' },
  timestamp: Date.now(),
});

// Manual sync trigger
await sync();

// Auto-sync runs every 30 seconds in background
```

### 4. Error Handling

```typescript
import { 
  ErrorBoundary, 
  useQueryErrorHandler,
  retryWithBackoff 
} from '~/lib/error-handling';

// Wrap components
<ErrorBoundary onError={handleError}>
  <YourComponent />
</ErrorBoundary>

// Handle query errors
const handleError = useQueryErrorHandler();
query.catch(handleError);

// Retry logic
const result = await retryWithBackoff(() => api.getBooks(), 3);
```

### 5. Notifications

```typescript
import { useNotification } from '~/lib/notification';

const { success, error, info, warning } = useNotification();

success('Book created!');
error('Failed to save chapter');
```

### 6. Custom Hooks

```typescript
import { 
  useNetworkState,
  useDebounce,
  useForm 
} from '~/lib/hooks';

// Network detection
const { isConnected, isWifi } = useNetworkState();

// Debounced search
const debouncedQuery = useDebounce(searchText, 300);

// Form management
const { values, errors, handleChange, handleSubmit } = useForm(
  { email: '', password: '' },
  async (values) => {
    await api.login(values.email, values.password);
  }
);
```

## Development Workflows

### Adding a New Screen

1. Create route file: `app/(main)/new-feature/index.tsx`
2. Add route to layout if needed
3. Use `useQuery` for data fetching
4. Wrap with `ErrorBoundary`
5. Use `useNotification` for feedback

**Example:**
```tsx
import { SafeAreaView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { queryKeys } from '../../../lib/react-query';
import { useNotification } from '../../../lib/notification';

export default function NewFeatureScreen() {
  const { success, error } = useNotification();
  
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.all,
    queryFn: () => api.getBooks(),
  });

  if (queryError) {
    error(queryError.message);
  }

  return <SafeAreaView>{/* ... */}</SafeAreaView>;
}
```

### Implementing Offline Writes

1. Capture user input locally
2. Update local state optimistically
3. Queue action via `useSyncEngine`
4. Sync engine handles retry/send when online

**Example:**
```tsx
const { addPendingAction, isOnline } = useSyncEngine();

const handleCreateChapter = async (data) => {
  // Optimistic update
  const tempId = Date.now().toString();
  setChapters([...chapters, { id: tempId, ...data }]);

  // Queue for sync
  addPendingAction(tempId, {
    type: 'create',
    resource: 'chapter',
    data,
    timestamp: Date.now(),
  });

  if (isOnline) {
    // Attempt immediate sync
    await sync();
  }
};
```

### Theme Integration

```tsx
import { useTheme } from '~/lib/theme';
import { StyleSheet } from 'react-native';

export default function MyComponent() {
  const theme = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    text: {
      color: theme.colors.text,
      fontSize: theme.typography.body1.fontSize,
    },
  });

  return <View style={styles.container}>{/* ... */}</View>;
}
```

## Next Steps (Priority Order)

### 1. WatermelonDB Integration (1-2 hours)
- [ ] Create WatermelonDB model classes (Book, Chapter, etc.)
- [ ] Add database context provider to root layout
- [ ] Integrate database hooks in screens
- [ ] Test schema migration

### 2. Quick Draft Input (1-2 hours)
- [ ] Create chapter creation modal
- [ ] Implement form validation
- [ ] Queue to WatermelonDB on submit
- [ ] Show success notification

### 3. Better Offline UX (2-3 hours)
- [ ] Add offline indicator to app header
- [ ] Show sync status badge
- [ ] Implement retry on user action
- [ ] Cache management

### 4. Writing Dashboard (2-3 hours)
- [ ] Stats screen (word count, streak, goals)
- [ ] Writing history visualization
- [ ] Goals & challenges display
- [ ] Progress tracking

### 5. Testing & Performance (2-3 hours)
- [ ] Unit tests for API client
- [ ] Navigation flow testing
- [ ] Database performance profiling
- [ ] Memory leak detection

## Common Issues & Solutions

### App Won't Start
1. Check Node/Yarn versions (Node 18+, Yarn 3+)
2. Clear cache: `npm start -- --clear`
3. Verify expo account: `expo login`

### Network Requests Fail
1. Check API URL in `lib/config.ts`
2. Verify backend is running
3. Check CORS headers on backend
4. For Android: ensure 10.0.2.2 is used for localhost

### Database Initialization Error
1. Ensure JSI is available (required for WatermelonDB)
2. Check Expo SDK version (50+)
3. Clear app cache and restart

### Build Fails
1. Use EAS Build: `npm run build-ios` / `npm run build-android`
2. Check `eas.json` for profile config
3. Verify Apple/Google account credentials

## Backend Integration Notes

### API Compatibility
- Mobile uses same endpoints as web
- No special mobile API needed
- OAuth flow unchanged
- Database models mirror backend

### CORS Configuration
Mobile running on localhost needs:
- Android: `10.0.2.2:5000` (auto-configured)
- iOS: `localhost:5000` (auto-configured)
- Both configured in `lib/config.ts`

### Authentication
1. Login returns `access_token`
2. Token stored securely in Expo SecureStore
3. All requests auto-inject `Authorization: Bearer {token}`
4. 401 response triggers auto-logout

## Performance Tips

1. **Code Splitting:** Expo Router auto-splits per route
2. **Image Optimization:** Use CachedImage for covers
3. **Query Caching:** Stale time 5 min, cache time 30 min
4. **Lazy Lists:** Use FlatList with pagination
5. **Sync Throttling:** Periodic sync every 30s

## Debugging

### Enable Debug Logging
```typescript
// In lib/config.ts
logger.debug('My message'); // Shows in dev, silenced in prod
```

### Network Inspection
API client logs all requests/responses in development mode.

### State Inspection (Future)
Redux DevTools integration planned for Zustand inspection.

## Contributing

1. Follow TypeScript strict mode
2. Use functional components with hooks
3. Write to shared design tokens
4. Test on both iOS and Android
5. Submit PRs with clear descriptions

## Related Documentation

- Backend API: [docs/API.md](../docs/API.md)
- Architecture: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- Phase 7.6 Plan: [docs/P7.6_MOBILE_APPS_PLAN.md](../docs/P7.6_MOBILE_APPS_PLAN.md)
