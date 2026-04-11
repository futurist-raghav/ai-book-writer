# AI Book Writer - Mobile App

React Native mobile application for AI Book Writer built with Expo and TypeScript.

## Technology Stack

- **Framework:** React Native 0.73 + Expo 50
- **Navigation:** Expo Router v2 (file-based routing)
- **State Management:** Zustand + TanStack React Query
- **Offline Storage:** WatermelonDB (local SQLite cache)
- **API Client:** Axios with interceptors
- **Security:** Expo SecureStore (encrypted token storage)
- **Authentication:** OAuth 2.0 (backend FastAPI)
- **Build:** EAS Build (cloud-native iOS/Android)

## Project Structure

```
mobile/
├── app/                           # Expo Router navigation structure
│   ├── _layout.tsx               # Root layout with auth guard
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   └── (main)/                   # Authenticated screens (bottom tabs)
│       ├── _layout.tsx           # Tab navigation
│       ├── books/
│       │   ├── index.tsx         # Books list
│       │   └── [id]/
│       │       └── chapters/
│       │           ├── index.tsx # Chapters list
│       │           └── [id]/
│       │               └── detail.tsx
│       ├── writing/              # Writing dashboard
│       │   └── index.tsx
│       ├── explore/              # Discover section
│       │   └── index.tsx
│       └── profile/              # User profile
│           └── index.tsx
│
├── lib/                          # Shared utilities and hooks
│   ├── api.ts                   # Axios API client with auth
│   ├── config.ts                # Environment configuration
│   ├── storage.ts               # SecureStore + AsyncStorage wrapper
│   ├── store.ts                 # Zustand stores (auth, books, UI, sync)
│   ├── react-query.ts           # TanStack React Query config
│   ├── database.ts              # WatermelonDB setup (WIP)
│   └── sync.ts                  # Offline sync engine (WIP)
│
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build configuration
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18.13+
- Expo CLI: `npm install -g expo-cli`
- Yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Configure environment:**
   - Development: API URL defaults to `localhost:5000` (iOS/Android auto-configured)
   - Staging/Production: Set in `app.json` via `expo.extra.environment`

3. **Start development server:**
   ```bash
   npm start
   ```

4. **Run on device/emulator:**
   - iOS: `npm run ios`
   - Android: `npm run android`
   - Web: `npm run web`

## Architecture

### State Management

**Zustand Stores:**
- `useAuthStore` - User authentication (login, token, user profile)
- `useBooksStore` - Books and chapters list/detail
- `useUIStore` - Theme, notifications
- `useSyncStore` - Offline sync status and pending actions

### Security

- **Token Storage:** Expo SecureStore (encrypted with device keychain)
- **Request Interceptors:** Auto-inject Bearer token on all requests
- **Response Interceptors:** Auto-logout on 401 Unauthorized
- **HTTPS:** All production API calls use SSL

### Offline-First Architecture

1. **Local Cache:** WatermelonDB stores books, chapters, sessions locally
2. **Action Queue:** Failed mutations queued for retry when online
3. **Auto-Sync:** Detects network changes and syncs pending actions
4. **Conflict Resolution:** Server-wins strategy on sync conflicts

### API Integration

All mobile API requests go through `lib/api.ts`, which:
- Wraps axios with auth interceptors
- Manages secure token access
- Handles common errors (401, 403, 5xx)
- Provides typed request/response methods

**Reuse Strategy:** Mobile acts as a thin client consuming existing backend endpoints. No translation layer needed.

## Development Workflows

### Login Flow

1. User enters email/password on login screen
2. API call to POST `/auth/login` returns access token
3. Token stored securely in Expo SecureStore
4. GET `/auth/me` fetches user profile
5. Auth state updated → automatic nav to main app

### Reading a Book

1. User taps book from list (GET `/books` with React Query)
2. Navigate to chapters screen (GET `/books/{id}/chapters`)
3. Chapters cached in WatermelonDB for offline access
4. Tap chapter → detail screen (GET `/chapters/{id}`)
5. Reader displays content, tracks progress

### Offline Reading

1. WatermelonDB caches previously loaded chapters
2. Reader works offline (computed properties only)
3. User writes notes/annotations (stored locally)
4. App detects network → syncs pending actions
5. Changes merged with server (server-wins conflict resolution)

## Building & Deployment

### Local Build Preview

```bash
npm run preview
```

### Build for iOS

```bash
npm run build-ios
# Or submit to TestFlight:
npm run submit
```

### Build for Android

```bash
npm run build-android
```

### EAS Build Configuration

Profiles configured in `eas.json`:
- **Production:** Optimized for app store submission
- **Preview:** Internal testing APK/IPA
- **Development:** Fast iteration with Expo Go

## Testing

### Run type-checking:
```bash
npm run type-check
```

### Run linter:
```bash
npm run lint
```

### Run tests (Jest):
```bash
npm test
```

## Performance Optimization

- **Code Splitting:** Expo Router automatically code-splits per route
- **Image Optimization:** CachedImage component for book covers
- **Query Caching:** 5-minute stale time for fresh data without refetch
- **Lazy Loading:** Chapters list uses pagination (50 items/page)
- **Network Retry:** Exponential backoff for failed requests (max 3 retries)

## Known Limitations & WIP

- [x] Auth screens (Login, Register, Forgot Password structure)
- [x] Books list with pull-to-refresh
- [x] Profile screen with theme/settings
- [ ] Chapters detail reader (layout prepared)
- [ ] WatermelonDB integration (schema in progress)
- [ ] Offline sync engine (action queue implementation)
- [ ] Writing dashboard stats
- [ ] Explore/discover section
- [ ] Comments and collaboration (P4 features)
- [ ] Notifications (real-time updates)

## Debugging

### Enable debug logging:
```typescript
// In lib/config.ts, isDevMode = true
logger.debug('My message');
```

### Inspect network requests:
The API client logs all requests/responses in development mode.

### Redux DevTools (Future):
Can be integrated via `redux-devtools-extension` package for state debugging.

## Contributing

Mobile development follows the same conventions as the main app:
- TypeScript strict mode required
- Functional components with hooks
- Shared design tokens from lib/theme (WIP)
- PR reviews required before merge

## Related Documentation

- [P7.6 Mobile Apps Implementation Plan](../docs/P7.6_MOBILE_APPS_PLAN.md)
- [Backend API Documentation](../docs/API.md)
- [Architecture Overview](../docs/ARCHITECTURE.md)

## License

Same as main project (see root LICENSE file)
