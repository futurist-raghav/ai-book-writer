# Phase 1 Sprint - Core Manuscript MVP (3-Week Implementation)

**Objective:** Build the switch-worthy manuscript foundation. A serious writer can draft a full manuscript without leaving your app.

**Status:** Ready for implementation  
**Priority:** CRITICAL - this is where product differentiation happens

---

## Sprint 1: Project Type System & Adaptive Workspace (Week 1)

### TASK 1.1: Database Schema Updates
**Est. Time:** 2 hours

What needs to happen:
- [ ] Add `project_type` enum column to `books` table (alembic migration)
- [ ] Add `metadata` JSON column to `books` table for type-specific settings
- [ ] Backfill existing projects with `project_type = 'novel'`

Files to modify:
- `backend/alembic/versions/005_add_project_type.py` (NEW)
- `backend/app/models/book.py`

Quick Checklist:
- [x] Design new schema columns
- [ ] Write migration file
- [ ] Test migration locally
- [ ] Update Book model

---

### TASK 1.2: Project Type Configuration Service
**Est. Time:** 3 hours

Build configuration object mapping `project_type` → UI elements/modules

Create file: `frontend/src/lib/project-types.ts`

Should include:
```typescript
type ProjectType = 'novel' | 'memoir' | 'screenplay' | 'textbook' | 'research_paper' | ...

interface ProjectTypeConfig {
  name: string
  pluralName: string
  structureUnitName: string  // "Chapter", "Scene", "Lesson"
  characterLabel: string     // "Characters", "Personas", "Concepts"
  locationLabel: string      // "Locations", "Concepts", "Settings"
  showModules: {
    characters: boolean
    worldBuilding: boolean
    timeline: boolean
    aiAssistant: boolean
    export: boolean
  }
  aiPersona: string
  defaultExportFormat: string
}
```

Quick Checklist:
- [ ] Define ProjectType enum with 15+ types
- [ ] Create ProjectTypeConfigService with getConfig(type)
- [ ] Map each type to sidebar visibility config
- [ ] Test with existing novel type

---

### TASK 1.3: Project Creation Wizard UI
**Est. Time:** 4 hours

Replace simple "New Project" button with adaptive wizard.

File: `frontend/src/components/project-creation-wizard.tsx` (NEW)

Steps:
1. Basic info (title, description)
2. **Project Type selector** (radio buttons with descriptions)
3. Template selector (if type has templates)
4. Metadata (optional: genres, audience, target word count)
5. Confirmation

Quick Checklist:
- [ ] Create component with multi-step form
- [ ] Show descriptions for each project type
- [ ] Collect `project_type` and `metadata` fields
- [ ] Call API with new fields

---

### TASK 1.4: Adaptive Sidebar Visibility
**Est. Time:** 3 hours

Hide/show sidebar modules based on `project_type`.

Files to modify:
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/components/dashboard-sidebar.tsx` (if exists, or create)

Logic:
```typescript
const config = ProjectTypeConfigService.getConfig(selectedBook.project_type)
const modules = [
  { name: 'Chapters', show: true },
  { name: 'Characters', show: config.showModules.characters },
  { name: 'World Building', show: config.showModules.worldBuilding },
  { name: 'Timeline', show: config.showModules.timeline },
  // ... filter and render
]
```

Quick Checklist:
- [ ] Update sidebar to read from config
- [ ] Test with novel (all modules show)
- [ ] Test with screenplay (hide world building)
- [ ] Test with textbook (rename and show different modules)

---

### TASK 1.5: API Updates
**Est. Time:** 2 hours

Backend needs to accept and return `project_type`.

Files to modify:
- `backend/app/schemas/book.py`
- `backend/app/api/v1/books.py`

Changes:
- [ ] Add `project_type` to BookCreate schema (required)
- [ ] Add `project_type` to BookSchema (response)
- [ ] Update POST /books endpoint to accept project_type
- [ ] Update GET /books to return project_type

Quick Checklist:
- [ ] Add field to Pydantic schemas
- [ ] Handle validation (enum check)
- [ ] Test with curl or Postman

---

## Sprint 2: Template System & Structured Tree (Week 2)

### TASK 2.1: Template Definitions
**Est. Time:** 2 hours

Create template registry.

File: `frontend/src/lib/project-templates.ts` (NEW)

Templates:
- 3-Act Novel
- Hero's Journey
- 5-Chapter Non-Fiction
- Screenplay 3-Act
- Research Paper (Introduction, Literature Review, Methods, Results, Discussion, Conclusion)
- Textbook Outline

Each template specifies:
```typescript
interface ProjectTemplate {
  id: string
  name: string
  projectType: ProjectType
  description: string
  chapterStructure: Array<{ title: string, order: number }>
}
```

Quick Checklist:
- [ ] Define 6-8 templates
- [ ] Map chapters for each template
- [ ] Make extensible (easy to add more)

---

### TASK 2.2: Apply Template API Endpoint
**Est. Time:** 2 hours

Backend endpoint to auto-create chapters from template.

Files to create:
- `backend/app/api/v1/templates.py` (NEW)

Endpoint:
- `POST /books/{id}/apply-template?template_id=3-act-novel`

Logic:
- Retrieve template definition
- Create chapters with pre-filled titles
- Set chapter metadata (optional)

Quick Checklist:
- [ ] Create endpoint
- [ ] Auto-create chapters
- [ ] Return created chapters list

---

### TASK 2.3: Chapter Hierarchy & Drag-Drop
**Est. Time:** 5 hours

Upgrade chapter list to tree view with reordering.

File: `frontend/src/components/chapter-tree.tsx` (NEW)

Features:
- Display hierarchy: Part → Chapter → Scene
- Drag-and-drop reorder
- Context menu (add, delete, edit)
- Live update `display_order`

Libraries:
- Use `react-beautiful-dnd` or `dnd-kit` for drag-drop
- Or simple state management if counts are small

Quick Checklist:
- [ ] Render tree structure
- [ ] Implement drag-drop with reorder
- [ ] Call API to save new `display_order`
- [ ] Show visual feedback during drag

---

### TASK 2.4: Chapter Status Workflow
**Est. Time:** 3 hours

Add workflow status tracking.

Files to modify:
- `backend/app/models/chapter.py` - add `workflow_status` field
- `backend/app/schemas/chapter.py` - add field
- Database migration

Workflow stages:
`idea → outline → draft → revised → proofread → final → locked`

UI:
- Dropdown/badge in chapter list
- Bulk status update
- Filter by status

Quick Checklist:
- [ ] Add `workflow_status` to model
- [ ] Create migration
- [ ] Add API to bulk update status
- [ ] Add UI dropdown/filter

---

### TASK 2.5: Chapter Summary Auto-Generation
**Est. Time:** 3 hours

AI-generated summaries.

File: needs modification in `backend/app/api/v1/chapters.py`

Endpoint:
- `POST /chapters/{id}/generate-summary`

Logic:
- Call Claude to summarize chapter content
- Store in `summary` field
- Display in UI

Quick Checklist:
- [ ] Create endpoint
- [ ] Call Claude with chapter text
- [ ] Store and display result in UI
- [ ] Add "Generate Summary" button

---

## Sprint 3: Exports & Polish (Week 3)

[Continue for Task 3.1-3.5: exports, icons, keyboard shortcuts, loading states, validation]

---

## Implementation Order (MUST FOLLOW)

1. Database schema first (1.1)
2. Project type config (1.2)
3. Project creation wizard (1.3)
4. Sidebar visibility (1.4)
5. API updates (1.5)
6. Templates (2.1-2.2)
7. Chapter tree (2.3)
8. Status workflow (2.4)
9. Exports and polish (3.x)

**Why:** Each layer depends on previous. Schema → UI adapts → Features build on that.

---

## Success Metrics

- [ ] Can create a novel project with all sidebar modules visible
- [ ] Can create a screenplay with AI assistant disabled
- [ ] Can apply "3-Act Novel" template and get 3 pre-made chapters
- [ ] Can drag chapters to reorder
- [ ] Can change chapter status and see it update
- [ ] Can generate summary for a chapter
- [ ] Can export to DOCX, PDF, EPUB
- [ ] No console errors or warnings

---

## Known Blockers

- [ ] Prisma model sync (if using ORM)
- [ ] SQLAlchemy async context issues  
- [ ] Socket.io path verification (check `/api/socket/io`)

---

## Quick Reference: File Locations

**Config/Utils:**
- `/frontend/src/lib/project-types.ts` (NEW)
- `/frontend/src/lib/project-templates.ts` (NEW)

**Components:**
- `/frontend/src/components/project-creation-wizard.tsx` (NEW)
- `/frontend/src/components/chapter-tree.tsx` (NEW)

**Backend:**
- `/backend/alembic/versions/005_add_project_type.py` (NEW)
- `/backend/app/api/v1/templates.py` (NEW)
- Modified: `book.py`, `chapter.py`, `books.py`, `chapters.py` schemas

**Tests:**
- `/frontend/src/components/__tests__/project-creation-wizard.test.tsx`
- `/backend/tests/test_templates.py`

---

## Reference: What Phase 1 Accomplishes

✅ **After Phase 1 Complete:**
- Writers can choose their project type
- Workspace adapts to their genre
- Templates accelerate project start
- Chapter structure is robust and reorderable
- Export is multi-format
- AI is context-aware per project type

✅ **This Makes You Competitive Because:**
- Scrivener doesn't adapt by genre
- Atticus is locked to fiction
- Docs doesn't understand manuscript structure
- You become the "universal writing OS"

