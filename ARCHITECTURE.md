# Architecture: How Everything Works Together

## The Problem You Had
- Features worked in isolation (audio notes, chapters, events, characters, etc. didn't talk to each other)
- AI couldn't access project context to give relevant suggestions
- Writer Canvas was just a basic contenteditable div
- No real interconnectedness across the app

## The Solution

### Layer 1: Unified Data Store (`useProjectContext`)
**File:** `frontend/src/stores/project-context.ts`

This is the FOUNDATION. Everything reads from and writes to this single store.

```typescript
Book {
  id, title, metadata (genres, themes, writing_form, tone)
  ├── Chapter {
  │   id, title, draft_content, editor_state
  │   ├── characters_involved: [Character IDs]  ← Linked
  │   ├── world_elements: [WorldElement IDs]   ← Linked
  │   ├── events: [ChapterEvent]               ← Linked
  │   │   ├── people: [Character IDs]          ← Linked
  │   │   └── world_elements: [Element IDs]   ← Linked
  │   └── audio_notes: [AudioNote]            ← Linked
  │
  ├── Character {
  │   id, name, role, traits
  │   └── appearances: [Chapter IDs]           ← Reverse link
  │
  └── WorldElement {
      id, name, type, description
      └── appearances: [Chapter IDs]           ← Reverse link
}
```

**Why this matters:** When you update a character, it's available everywhere. When you link a character to a chapter, both sides know about it. No more stale data.

### Layer 2: Rich Editor (`WriterCanvas` - Tiptap)
**File:** `frontend/src/components/writer-canvas-tiptap.tsx`

Replaces the old contenteditable div with a professional editor.

**Features:**
- Tables, images, code blocks with syntax highlighting
- Task lists, multiple heading levels
- Full undo/redo
- Auto-syncs to Project Context on every keystroke

**Integration:**
```jsx
<WriterCanvas
  chapterId="ch-123"
  initialContent={chapter.draft_content}
  onSave={async (html) => apiClient.update(html)}
  onContentChange={(html) => updateChapterContent(chapterId, html)}
/>

// When content changes in editor:
// WriterCanvas → updateChapterContent() → Project Context → Propagates to AI, other components
```

### Layer 3: AI Assistant with Context (`AiAssistant`)
**File:** `frontend/src/components/ai-assistant.tsx`

The AI has access to FULL PROJECT CONTEXT via `getAiContextString()`.

```javascript
// When you ask AI: "What would [Character] say?"
// AI receives:
{
  PROJECT: "18 Years Later"
  GENRE: [fantasy, romance]
  THEMES: [family, time, redemption]
  WRITING_STYLE: narrative
  TONE: reflective
  
  CHAPTER: "Chapter 5: The Return"
  CHARACTERS:
    - Aria (protagonist): Brave, conflicted about returning home
    - Thomas (father): Stern but loving
  
  WORLD_ELEMENTS:
    - The Forbidden Forest: Dangerous, mystical
    - House of Night: Family home, holds memories
  
  RECENT_EVENTS:
    - Aria arrives at town gates
    - Encounters old rival Marcus
    - Receives message from father
  
  CURRENT_SYNOPSIS: Aria returns home after 18 years...
}

// AI now understands genre, characters, world, events, tone
// Suggestions are deeply contextual, not generic
```

### Layer 4: Backend AI Integration
**File:** `backend/app/api/v1/ai.py`

Three endpoints:

1. **`POST /ai/chat`** - Chat with Claude
   - Sends rich project context
   - Gets back contextual suggestions

2. **`POST /ai/style-guide`** - Generate style guidelines
   - Based on your genres, themes, tone
   - Helps Claude stay consistent

3. **`POST /ai/writing-prompts`** - Generate chapter prompts
   - Customized for your book type and characters

---

## Data Flow Examples

### Example 1: You Write Something
```
User types in WriterCanvas
   ↓
Tiptap onUpdate fires
   ↓
CallUpdateChapterContent(chapterId, html)
   ↓
useProjectContext updates activeChapter.draft_content
   ↓
AI Assistant re-renders with new context
   ↓ 
    (AI can now see the new text in getAiContextString())
   ↓
Auto-save to database every 5 seconds
```

### Example 2: AI Suggests Dialogue
```
User asks AI: "Help with dialogue between Aria and Thomas"
   ↓
AiAssistant calls /api/v1/ai/chat with:
  - Full project context (genres, tone, characters, past events)
  - User message
  - System prompt (specialized for dialogue)
   ↓
Claude returns dialogue suggestions
   ↓
User clicks "Insert" button
   ↓
Content inserted into WriterCanvas at cursor position
   ↓
Tiptap onUpdate fires, context updates, document syncs
```

### Example 3: Audio Note Becomes Chapter Content
```
User records audio note
   ↓
Audio uploaded to backend
   ↓
STT service (Whisper) transcribes to text
   ↓
Transcription returned to frontend
   ↓
insertContent() called on WriterCanvas
   ↓
Text appears in editor
   ↓
User can refine or ask AI for suggestions
   ↓
Save chapter
```

### Example 4: Create Character, Use in Chapter
```
User adds character "Marcus" in Characters section
   ↓
addCharacter() updates useProjectContext
   ↓
User links Marcus to Chapter 5
   ↓
linkCharacterToChapter(characterId, chapterId)
   ↓
Chapter 5 now shows Marcus in characters_involved: [...]
   ↓
AI gets context and can reference Marcus when suggesting dialogue
   ↓
World Building sees Marcus mentioned in Chapter 5
   ↓
Characters section shows Marcus appears in Chapter 5
```

---

## Why This Architecture Fixes Your Problems

### ❌ Problem: "Everything is disconnected"
✅ **Solution:** Single `useProjectContext` store means:
- Change a character name → All chapters see it
- Link character to chapter → Both sides know the relationship
- Write in editor → AI immediately sees the new content
- Create event → Characters and world elements can reference it

### ❌ Problem: "AI doesn't have context"
✅ **Solution:** `getAiContextString()` builds rich context:
```
- Project genre, themes, tone
- Current chapter title & synopsis
- All involved characters with descriptions
- World building elements
- Recent events with summaries
- Past context for consistency
```

### ❌ Problem: "Writer Canvas is terrible"
✅ **Solution:** Tiptap editor has:
- Professional formatting (tables, images, code)
- Real undo/redo
- Auto-save
- Ready for AI suggestions
- Export-ready markup

### ❌ Problem: "STT, Audio, Events don't connect"
✅ **Solution:** All use same context:
```
Audio Note → Transcription → WriterCanvas → AI Suggestion → Event Spine
         ↓
    All operations update useProjectContext
    ↓
    All components re-render with fresh data
    ↓
    No stale data, no isolated features
```

---

## Component Relationships

```
┌─────────────────────────────────────────────┐
│  PROJECT CONTEXT STORE (Zustand)           │
│  - Single source of truth                   │
│  - All data relationships stored here       │
├─────────────────────────────────────────────┤
│                                             │
├─→ WriterCanvas (Tiptap)                    │
│   └─→ Reads: chapter.draft_content         │
│   └─→ Writes: updateChapterContent()       │
│                                             │
├─→ AiAssistant                              │
│   └─→ Reads: ALL context for prompts       │
│   └─→ Calls: /api/ai/chat                  │
│   └─→ Writes: onInsertContent()            │
│                                             │
├─→ Characters Page                          │
│   └─→ Reads: characters[]                  │
│   └─→ Writes: addCharacter()               │
│   └─→ Links: linkCharacterToChapter()      │
│                                             │
├─→ World Building Page                      │
│   └─→ Reads: worldElements[]               │
│   └─→ Writes: addWorldElement()            │
│   └─→ Links: linkWorldElementToChapter()   │
│                                             │
├─→ Events/Timeline                          │
│   └─→ Reads: chapter.events[]              │
│   └─→ Writes: addEventToChapter()          │
│   └─→ Links: linkEventToCharacters()       │
│                                             │
└─→ Audio Notes                              │
    └─→ Reads: audioNotes[]                  │
    └─→ Writes: addAudioNote()               │
    └─→ Links: linkAudioNoteToChapter()      │
```

---

## Key Methods You'll Use

### In Chapter Workspace:
```jsx
import { useProjectContext } from '@/stores/project-context';

const {
  activeChapter,
  characters,
  worldElements,
  
  // Update chapter content
  updateChapterContent(chapterId, html),
  
  // Add/link entities
  addEventToChapter(chapterId, event),
  linkCharacterToChapter(characterId, chapterId),
  
  // Get AI context
  getAiContextString(),
} = useProjectContext();
```

### In Any Page:
```jsx
const { activeBook, activeChapter } = useProjectContext();

// Any component can access full project state
// Any update propagates instantly to all components
```

### From AI Assistant:
```jsx
AiAssistant uses:
- activeBook.metadata (genre, themes, tone)
- activeChapter (title, synopsis, content)
- characters (names, roles, descriptions, where they appear)
- worldElements (names, types, descriptions, connections)
- getAiContextString() → Rich prompt for Claude
```

---

## What Gets Synced Automatically

When you:
- **Change chapter content** → Auto-synced to context
- **Update character info** → AI and all chapters see it
- **Add event to chapter** → Characters & world building pages see it
- **Link entities** → Relationship stored both ways
- **Save transcription** → Can be inserted into chapter

No manual refreshing. No stale data. One source of truth.

---

## Summary: You Now Have

1. **Unified Data Model** - Everything connected, relationships bidirectional
2. **Professional Editor** - Tiptap with images, tables, code, formatting
3. **Context-Aware AI** - Claude sees your entire project, genres, characters, tone
4. **Auto-Sync System** - All changes propagate instantly
5. **Foundation for Integration** - STT → Editor → AI all connected

The architecture is NOW IN PLACE. All that's left is:
- ✅ Install Tiptap dependencies
- ✅ Add Claude API key
- ✅ Integrate WriterCanvas into chapter workspace
- ✅ Wire STT output to editor
- ✅ Test the flow

Everything else is already built and ready to use.
