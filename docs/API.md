# API Documentation

## Base URL

- **Development**: `http://localhost:8000/api/v1`
- **Production**: `https://your-domain.com/api/v1`

## Authentication

All API requests (except auth endpoints) require authentication using JWT tokens.

```http
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Authentication

#### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

**Response (201)**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2026-01-26T12:00:00Z"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200)**:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### User Profile

#### Get Current User

```http
GET /users/me
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "writing_profile": {
    "style": "narrative",
    "tone": "casual",
    "preferences": {}
  },
  "created_at": "2026-01-26T12:00:00Z"
}
```

#### Update Writing Profile

```http
PUT /users/me/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "style": "narrative",
  "tone": "casual",
  "preferences": {
    "tense": "past",
    "person": "first",
    "chapter_length": "medium"
  }
}
```

### Audio Files

#### Upload Audio File

```http
POST /audio/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <audio_file>
metadata: {
  "title": "My First Day at School",
  "date": "2008-09-01",
  "tags": ["childhood", "school"],
  "description": "Story about my first day"
}
```

**Response (201)**:

```json
{
  "id": "uuid",
  "filename": "audio_20260126_120000.mp3",
  "duration": 180.5,
  "size": 2048000,
  "status": "uploaded",
  "metadata": {
    "title": "My First Day at School",
    "date": "2008-09-01",
    "tags": ["childhood", "school"]
  },
  "created_at": "2026-01-26T12:00:00Z"
}
```

#### List Audio Files

```http
GET /audio?page=1&limit=20&tag=childhood
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "items": [
    {
      "id": "uuid",
      "filename": "audio_20260126_120000.mp3",
      "duration": 180.5,
      "status": "processed",
      "metadata": {...},
      "created_at": "2026-01-26T12:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

#### Get Audio File

```http
GET /audio/{audio_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "filename": "audio_20260126_120000.mp3",
  "duration": 180.5,
  "size": 2048000,
  "status": "processed",
  "metadata": {...},
  "transcription_id": "uuid",
  "created_at": "2026-01-26T12:00:00Z",
  "processed_at": "2026-01-26T12:05:00Z"
}
```

#### Delete Audio File

```http
DELETE /audio/{audio_id}
Authorization: Bearer <token>
```

**Response (204)**: No content

### Transcriptions

#### Get Transcription

```http
GET /transcriptions/{transcription_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "audio_id": "uuid",
  "text": "This is the full transcription text...",
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "text": "This is the first segment."
    }
  ],
  "language": "en",
  "confidence": 0.95,
  "created_at": "2026-01-26T12:05:00Z"
}
```

#### Update Transcription

```http
PUT /transcriptions/{transcription_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Corrected transcription text...",
  "segments": [...]
}
```

### Events

Events are extracted narrative units (stories, incidents, experiences).

#### List Events

```http
GET /events?page=1&limit=20&category=childhood
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "First Day at School",
      "content": "Formatted narrative content...",
      "category": "childhood",
      "date": "2008-09-01",
      "tags": ["school", "milestone"],
      "audio_id": "uuid",
      "transcription_id": "uuid",
      "created_at": "2026-01-26T12:10:00Z"
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 20
}
```

#### Get Event

```http
GET /events/{event_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "title": "First Day at School",
  "content": "Formatted narrative content...",
  "raw_content": "Original extracted content...",
  "category": "childhood",
  "date": "2008-09-01",
  "tags": ["school", "milestone"],
  "audio_id": "uuid",
  "transcription_id": "uuid",
  "metadata": {
    "location": "Springfield Elementary",
    "people": ["Mom", "Teacher Mrs. Smith"]
  },
  "created_at": "2026-01-26T12:10:00Z",
  "updated_at": "2026-01-26T12:10:00Z"
}
```

#### Update Event

```http
PUT /events/{event_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content...",
  "category": "childhood",
  "tags": ["school", "milestone", "memories"]
}
```

#### Delete Event

```http
DELETE /events/{event_id}
Authorization: Bearer <token>
```

**Response (204)**: No content

### Chapters

#### Create Chapter

```http
POST /chapters
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Early Years",
  "description": "My childhood from ages 0-10",
  "event_ids": ["uuid1", "uuid2", "uuid3"],
  "order": 1
}
```

**Response (201)**:

```json
{
  "id": "uuid",
  "title": "Early Years",
  "description": "My childhood from ages 0-10",
  "event_count": 3,
  "order": 1,
  "created_at": "2026-01-26T12:15:00Z"
}
```

#### List Chapters

```http
GET /chapters
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Early Years",
      "description": "My childhood from ages 0-10",
      "event_count": 3,
      "order": 1,
      "created_at": "2026-01-26T12:15:00Z"
    }
  ],
  "total": 5
}
```

#### Get Chapter with Events

```http
GET /chapters/{chapter_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "title": "Early Years",
  "description": "My childhood from ages 0-10",
  "events": [
    {
      "id": "uuid",
      "title": "First Day at School",
      "content": "...",
      "order": 1
    }
  ],
  "order": 1,
  "created_at": "2026-01-26T12:15:00Z"
}
```

#### Update Chapter

```http
PUT /chapters/{chapter_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "event_ids": ["uuid1", "uuid2", "uuid3", "uuid4"],
  "order": 1
}
```

#### Reorder Events in Chapter

```http
PUT /chapters/{chapter_id}/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_orders": [
    {"event_id": "uuid1", "order": 1},
    {"event_id": "uuid2", "order": 2}
  ]
}
```

### Books

#### Create Book

```http
POST /books
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My First 18 Years",
  "subtitle": "A Journey Through Childhood",
  "author": "John Doe",
  "description": "My memoir covering...",
  "chapter_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response (201)**:

```json
{
  "id": "uuid",
  "title": "My First 18 Years",
  "subtitle": "A Journey Through Childhood",
  "author": "John Doe",
  "description": "My memoir covering...",
  "chapter_count": 3,
  "status": "draft",
  "created_at": "2026-01-26T12:20:00Z"
}
```

#### List Books

```http
GET /books
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "My First 18 Years",
      "author": "John Doe",
      "chapter_count": 3,
      "status": "draft",
      "created_at": "2026-01-26T12:20:00Z"
    }
  ],
  "total": 2
}
```

#### Get Book

```http
GET /books/{book_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "title": "My First 18 Years",
  "subtitle": "A Journey Through Childhood",
  "author": "John Doe",
  "description": "My memoir covering...",
  "chapters": [
    {
      "id": "uuid",
      "title": "Early Years",
      "order": 1,
      "event_count": 3
    }
  ],
  "status": "draft",
  "created_at": "2026-01-26T12:20:00Z",
  "updated_at": "2026-01-26T12:20:00Z"
}
```

#### Export Book

```http
POST /books/{book_id}/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "format": "pdf",
  "options": {
    "include_toc": true,
    "page_size": "A4",
    "font_size": 12
  }
}
```

**Response (202)**:

```json
{
  "job_id": "uuid",
  "status": "processing",
  "message": "Export job started"
}
```

#### Get Export Status

```http
GET /books/{book_id}/exports/{job_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "job_id": "uuid",
  "status": "completed",
  "format": "pdf",
  "download_url": "https://storage.../export.pdf",
  "expires_at": "2026-01-27T12:20:00Z",
  "created_at": "2026-01-26T12:20:00Z",
  "completed_at": "2026-01-26T12:22:00Z"
}
```

### Processing Jobs

#### Get Job Status

```http
GET /jobs/{job_id}
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "uuid",
  "type": "transcription",
  "status": "processing",
  "progress": 45,
  "result": null,
  "error": null,
  "created_at": "2026-01-26T12:00:00Z",
  "updated_at": "2026-01-26T12:02:00Z"
}
```

**Status Values**: `pending`, `processing`, `completed`, `failed`

### Settings

#### Get API Settings

```http
GET /settings/api-keys
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "openai_key": "sk-...***",
  "google_ai_key": "AI...***",
  "anthropic_key": "sk-ant-...***",
  "preferred_stt_service": "openai",
  "preferred_llm_service": "google"
}
```

#### Update API Settings

```http
PUT /settings/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "openai_key": "sk-...",
  "preferred_stt_service": "openai",
  "preferred_llm_service": "google"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706270400
```

## Webhooks

Configure webhooks to receive notifications about processing events.

### Events

- `audio.uploaded`
- `transcription.completed`
- `transcription.failed`
- `event.extracted`
- `export.completed`

### Webhook Payload

```json
{
  "event": "transcription.completed",
  "data": {
    "id": "uuid",
    "audio_id": "uuid",
    "status": "completed"
  },
  "timestamp": "2026-01-26T12:05:00Z"
}
```

### AI Assistant

#### Chat with AI (Context-Aware)

```http
POST /ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "book_id": "uuid",
  "chapter_id": "uuid",
  "message": "Help me write a compelling dialogue between two characters",
  "assistance_type": "general"
}
```

**Assistance Types:**
- `general` - General writing assistance with full project context
- `character` - Character development and dialogue help
- `world` - World building and setting suggestions
- `dialogue` - Specific dialogue writing help
- `plot` - Plot and narrative structure assistance

**Response (200)**:

```json
{
  "response": "Here's a compelling dialogue...",
  "suggestions": [
    "Consider adding more sensory details...",
    "The character's tone could reflect..."
  ],
  "context_used": {
    "genres": ["fantasy", "romance"],
    "characters": [
      {
        "name": "Aria",
        "role": "protagonist",
        "traits": ["brave", "conflicted"]
      }
    ],
    "tone": "reflective",
    "word_count": 15000
  }
}
```

**Context Sent to AI:**
- Full project metadata (genres, themes, tone, writing_form)
- Current chapter title, title, and content
- All characters involved with their descriptions
- World elements and locations
- Recent events in the story
- Previous editing decisions and style patterns

#### Generate Style Guide

```http
POST /ai/style-guide
Authorization: Bearer <token>
Content-Type: application/json

{
  "book_id": "uuid",
  "samples": ["excerpt 1 of user's writing", "excerpt 2"]
}
```

**Response (200)**:

```json
{
  "style_guide": {
    "narrative_voice": "First Person, Reflective",
    "sentence_structure": "Medium length with varied rhythm",
    "vocabulary_level": "Literary but accessible",
    "common_patterns": [
      "Uses sensory metaphors frequently",
      "Prefers dialogue over narration",
      "Often employs parallel structure"
    ],
    "forbidden_words": ["literally", "very", "suddenly"],
    "tone_descriptors": ["introspective", "lyrical", "honest"]
  }
}
```

#### Generate Writing Prompts

```http
POST /ai/writing-prompts
Authorization: Bearer <token>
Content-Type: application/json

{
  "book_id": "uuid",
  "chapter_id": "uuid",
  "prompt_type": "scene"
}
```

**Prompt Types:**
- `scene` - Scene-writing prompts
- `dialogue` - Dialogue writing prompts
- `description` - Descriptive writing prompts
- `character_development` - Character focused prompts

**Response (200)**:

```json
{
  "prompts": [
    {
      "prompt": "Write the scene where your protagonist first realizes...",
      "context": "This fits naturally after the event where... Consider the character's emotional state...",
      "writing_type": "introspective scene"
    },
    {
      "prompt": "Develop a tense dialogue between two conflicting characters...",
      "context": "Build on the tension established in Chapter 3...",
      "writing_type": "dialogue"
    }
  ]
}
```

## WebSocket API

Real-time updates for processing jobs.

```javascript
const ws = new WebSocket('wss://your-domain.com/ws?token=<jwt_token>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Job update:', data);
};
```

**Message Format**:

```json
{
  "type": "job_update",
  "job_id": "uuid",
  "status": "processing",
  "progress": 45
}
```
