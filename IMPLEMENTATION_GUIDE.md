# AI Book Writer - Architecture Refactor Implementation Guide

## What's Been Built ✅

### 1. **Shared Project Context System** 
The foundation that fixes "features work in isolation" problem.
- **Location:** `frontend/src/stores/project-context.ts`
- **What it is:** Single Zustand store containing ALL project data
- **Includes:** Books, chapters, characters, world elements, events, audio notes
- **Key feature:** Entities are linked together (e.g., character appears in chapters, events involve characters)
- **AI-ready:** `getAiContextString()` method builds rich context for Claude

### 2. **AI Assistant Component**
Ready-to-use React component with full project awareness.
- **Location:** `frontend/src/components/ai-assistant.tsx`
- **Usage:** Add to chapter workspace as sidebar or panel
- **Features:**
  - 5 assistance types: general, character, world, dialogue, plot
  - Access to full project metadata and context
  - Conversation history
  - Click "Insert" to add suggestions to editor
- **No changes needed** - plug and play

### 3. **AI Assistant Backend API**
Flask/FastAPI endpoints for Claude integration.
- **Location:** `backend/app/api/v1/ai.py`
- **Endpoints:**
  - `POST /api/v1/ai/chat` - Chat with Claude using project context
  - `POST /api/v1/ai/style-guide` - Generate style guides
  - `POST /api/v1/ai/writing-prompts` - Generate writing prompts
- **Set up:** Add `ANTHROPIC_API_KEY` to `.env`

### 4. **Upgraded Writer Canvas**
Professional document editor replacing the old contenteditable div.
- **Location:** `frontend/src/components/writer-canvas-tiptap.tsx`
- **Built with:** Tiptap (ProseMirror-based)
- **Features:**
  - Rich formatting (bold, italic, lists, headings, tables)
  - Images, code blocks with syntax highlighting
  - Auto-save to project context
  - Undo/Redo
  - Word/character count
  - Ready for AI suggestions

---

## Installation Steps

### Step 1: Install Frontend Dependencies

```bash
npm --prefix frontend install \
  @tiptap/react @tiptap/extension-starterkit \
  @tiptap/extension-placeholder @tiptap/extension-character-count \
  @tiptap/extension-link @tiptap/extension-image \
  @tiptap/extension-task-item @tiptap/extension-task-list \
  @tiptap/extension-table @tiptap/extension-table-cell \
  @tiptap/extension-table-header @tiptap/extension-table-row \
  @tiptap/extension-code-block-lowlight @tiptap/extension-highlight \
  @tiptap/extension-text-align @tiptap/extension-subscript \
  @tiptap/extension-superscript lowlight
```

### Step 2: Install Backend Dependencies

```bash
echo "anthropic>=0.38.0" >> backend/requirements.txt
pip install --upgrade anthropic
```

### Step 3: Configure Environment

**Backend `.env`:**
```
ANTHROPIC_API_KEY=sk-ant-...your-claude-key-here...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Step 4: Test AI Endpoint

```bash
# Start the backend
make dev

# In another terminal, test the AI chat endpoint
curl -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Help me write a dialogue"}],
    "system": "You are a writing assistant",
    "chapter_id": "ch-123",
    "assistance_type": "dialogue"
  }'
```

---

## Integration Steps

### Step 5: Integrate WriterCanvas into Chapter Workspace

**File:** `frontend/src/app/dashboard/chapters/[chapterId]/workspace-client.tsx`

Replace the contenteditable section (around line 490-530) with:

```jsx
import { WriterCanvas } from '@/components/writer-canvas-tiptap';
import { AiAssistant } from '@/components/ai-assistant';

// Inside the component JSX, replace the Writer Canvas section:

<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Main Editor - 2/3 width */}
  <div className="lg:col-span-2">
    <WriterCanvas
      chapterId={chapterId}
      initialContent={chapter?.draft_content || ''}
      onSave={async (content) => {
        // Call your backend to save chapter
        await apiClient.chapters.updateDraft(chapterId, {
          draft_content: content
        });
      }}
      onContentChange={(content) => {
        // Sync to context store
        projectContext.updateChapterContent(chapterId, content);
      }}
      showAiAssistant={book?.ai_enhancement_enabled}
    />
  </div>

  {/* AI Assistant Sidebar - 1/3 width */}
  {book?.ai_enhancement_enabled && (
    <div className="lg:col-span-1">
      <AiAssistant
        compact={false}
        assistanceType="general"
        onInsertContent={(content) => {
          // This will be called when user clicks "Insert" on AI suggestion
          // The WriterCanvas will handle the actual insertion
        }}
      />
    </div>
  )}
</div>
```

### Step 6: Connect STT Output to WriterCanvas

When transcription completes, insert into WriterCanvas:

```jsx
// In the transcription completion handler
const handleTranscriptionComplete = (text: string) => {
  // Option 1: Use the WriterCanvas ref directly
  writerCanvasRef.current?.insertContent(text);
  
  // Option 2: Dispatch an event
  window.dispatchEvent(new CustomEvent('insert-transcription', {
    detail: { text }
  }));
  
  // Option 3: Update the project context (auto-syncs to canvas)
  projectContext.updateChapterContent(chapterId, text);
};
```

### Step 7: Add Project Context Provider

Wrap your app with the project context provider (this is already available via Zustand):

```jsx
// In frontend/src/lib/query-provider.tsx or layout
import { useProjectContext } from '@/stores/project-context';

// Use it in components:
const { activeBook, activeChapter, characters } = useProjectContext();
```

---

## Testing Checklist

### ✅ Test 1: AI Chat Works
```bash
# Login and navigate to a chapter
# Open the AI Assistant sidebar
# Type: "Help me write an exciting dialogue between two characters"
# Notice: The AI can see character names, world context, genre, tone
# Should output contextual dialogue suggestions
```

### ✅ Test 2: WriterCanvas Saves
```bash
# Open chapter workspace
# Type some text in WriterCanvas
# Click "Save Chapter" button
# Refresh page
# Text should persist
```

### ✅ Test 3: STT to Editor
```bash
# Go to Audio Notes
# Record or upload an audio file
# Transcription completes
# Text should appear in WriterCanvas (or be insertable via button)
```

### ✅ Test 4: Full Context Flow
```bash
# Create a character in Characters section
# Go to chapter workspace
# Ask AI: "What would [Character Name] say about the events in this chapter?"
# AI should reference the character and recent events
```

### ✅ Test 5: AI Context Visibility
```bash
# Create a book with genre "Fantasy"
# Add theme "Magic System"
# Ask AI: "How should magic work in this scene?"
# AI should reference your genres and themes
```

---

## What Each Component Does

### `useProjectContext` Store
```jsx
const {
  // Data
  activeBook,
  activeChapter,
  characters,
  worldElements,

  // Methods to update data
  updateChapterContent(chapterId, html),
  updateChapterEditorState(chapterId, editorState),
  linkCharacterToChapter(charId, chapterId),
  addEventToChapter(chapterId, event),

  // AI context
  getAiContextString(), // Returns rich context for Claude
  updateAiContext(metadata),
} = useProjectContext();
```

### `<WriterCanvas>` Component
```jsx
<WriterCanvas
  chapterId="ch-123"
  initialContent={chapter.draft_content}
  onSave={async (html) => { /* save to API */ }}
  onContentChange={(html) => { /* update store */ }}
  readOnly={false}
  showAiAssistant={true}
  compactMode={false}
/>
```

### `<AiAssistant>` Component
```jsx
<AiAssistant
  compact={false}  // true = floating button + panel
  onInsertContent={(content) => { /* insert to editor */ }}
  assistanceType="general" // general|character|world|dialogue|plot
/>
```

---

## Architecture: How Data Flows

```
1. USER WRITES IN WRITER CANVAS
   ↓
2. TIPTAP EDITOR UPDATES → useProjectContext
   ↓
3. CONTEXT STORE PROPAGATES TO:
   ├─→ AI ASSISTANT (has full context for rich prompts)
   ├─→ OTHER CHAPTERS (see related characters/events)
   └─→ AUTO-SAVE (syncs to database)
   ↓
4. AI RESPONDS WITH CONTEXT-AWARE SUGGESTIONS
   ↓
5. SUGGESTION INSERTED BACK TO EDITOR
   ↓
6. CYCLE REPEATS
```

---

## What's Left (Future Tasks)

### Still TODO:
1. **Genre-Specific Forms** - Add forms for different book types (GOT-style, Kama Sutra, etc.)
2. **Illustrations Integration** - Connect illustrations to chapters/scenes
3. **Sidebar Reorganization** - Move Project Settings to secondary menu
4. **STT Flow Refinement** - Polish audio capture → transcription → editor integration
5. **Export Enhancements** - EPUB, PDF with proper formatting
6. **Real-time Collaboration** - Multi-user editing support (future)

### Quick Wins:
- [ ] Add "Insert from AI" button to transcription interface
- [ ] Add "Generate Writing Prompt" button to chapter header
- [ ] Show character/world/event suggestions as user types
- [ ] Add progress bar for book compilation

---

## Common Issues & Fixes

### Issue: "AI Assistant requires ANTHROPIC_API_KEY"
**Fix:** Add `ANTHROPIC_API_KEY=your-key` to backend `.env` and restart

### Issue: "WriterCanvas shows blank"
**Fix:** Check that Tiptap dependencies installed. Run:
```bash
npm --prefix frontend ls | grep @tiptap
```

### Issue: "Changes not syncing to project"
**Fix:** Ensure `updateChapterContent()` is called in WriterCanvas `onUpdate` handler

### Issue: "AI returns generic responses"
**Fix:** Check `getAiContextString()` includes chapter data:
```jsx
console.log(projectContext.getAiContextString());
// Should show chapter title, characters, world, events
```

---

## Next Steps to Run Locally

```bash
# 1. Install dependencies
npm --prefix frontend install @tiptap/react ...
pip install anthropic

# 2. Add API key to .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> backend/.env

# 3. Restart backend
make restart

# 4. Test AI endpoint
curl -X POST http://localhost:8000/api/v1/ai/chat ...

# 5. Update chapter workspace to use WriterCanvas
# Edit: frontend/src/app/dashboard/chapters/[chapterId]/workspace-client.tsx

# 6. Test the full flow
# - Write in editor → AI suggests → Insert suggestion → Save chapter
```

---

## File Map

```
frontend/
├── src/
│   ├── stores/project-context.ts        ← Single source of truth
│   └── components/
│       ├── ai-assistant.tsx             ← AI chat component
│       └── writer-canvas-tiptap.tsx     ← Rich editor
│
backend/
├── app/api/v1/
│   ├── ai.py                            ← Claude endpoints
│   └── router.py                        ← AI routes registered
└── .env                                 ← Add ANTHROPIC_API_KEY
```

---

## Success Criteria

When completed, you'll have:

✅ Single source of truth for all project data (no more isolated features)
✅ AI that understands your entire project context
✅ Professional document editor (not just contenteditable)
✅ Audio → Text → Rich Editor → AI Suggestions → Chapter flow
✅ Book Intro, TOC, Export on overview page
✅ Everything integrated and interconnected
