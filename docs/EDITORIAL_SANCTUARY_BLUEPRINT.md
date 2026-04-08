# Editorial Sanctuary - Audit And Improvement Blueprint

## 1) Status Snapshot

This blueprint translates the product audit into an implementation plan for the existing routes and code structure.

Current route mapping in this codebase:
- Projects: `/dashboard/books`
- Overview: `/dashboard`
- Chapters list: `/dashboard/chapters`
- Chapter workspace: `/dashboard/chapters/[chapterId]`
- Characters: `/dashboard/characters`
- World notes: `/dashboard/world`
- Audio notes: `/dashboard/audio`
- Event spine (current event area): `/dashboard/events`
- Illustrations: `/dashboard/illustrations`
- Project settings: `/dashboard/project-settings`

## 2) P0 - Ship Stopper (Done)

### Objective
Restore chapter editor stability and dependency consistency.

### Completed
- Aligned TipTap stack to major version 3 for editor wrapper packages:
  - `@tiptap/react@3.22.2`
  - `@tiptap/starter-kit@3.22.2`
- Verified required extensions are installed:
  - `@tiptap/extension-link`
  - `@tiptap/extension-text-align`
  - `@tiptap/extension-highlight`
  - `@tiptap/extension-subscript`
- Standardized Next.js to latest 14.x in this project:
  - `next@14.2.35`
  - `eslint-config-next@14.2.35`

### Validation
- Frontend production build passes.
- Chapter route compiles in app build output.

## 3) Product Foundation Decisions (Must Be Locked First)

These decisions unblock all adaptive UX requests:

1. Project Type Taxonomy
- Required enum baseline:
  - novel, short_story, novella, screenplay, stage_play, poetry_collection, academic_paper,
    technical_manual, blog_series, song_album, lyrics, personal_journal,
    childrens_book, graphic_novel, rpg_game_writing, custom

2. Adaptive Terminology Rules
- Examples:
  - "Chapter" => Scene/Act/Module/Track where applicable
  - "Book Introduction" => Preface/Abstract/Logline depending on project type
  - "World Building" => Research Hub / Knowledge Base for non-fiction tracks

3. Workflow Priority
- Source of truth ordering:
  - Project metadata and type
  - Chapter structure model
  - AI context model
  - UI adaptation and templates

## 4) P1 - Data Model And API Enhancements

## 4.1 Database Additions

### Books / Projects
Add fields:
- `project_type` (enum)
- `genre` (string)
- `target_word_count` (int)
- `current_word_count` (int, computed or cached)
- `deadline_at` (datetime)
- `cover_image_url` (string)
- `cover_color` (string)
- `labels` (json array)
- `is_pinned` (bool)

### Chapters
Add fields:
- `chapter_type` (enum)
- `workflow_status` (idea, outline, draft, revision, final)
- `summary` (string)
- `pov_character_id` (nullable fk)
- `word_count_target` (int)
- `timeline_position` (string)
- `display_order` (int)

### Supporting Entities
Add/expand:
- `project_collaborators`
- `chapter_versions`
- `project_snapshots`
- `project_labels`
- `project_assets` relation metadata (link illustrations to chapter positions)

## 4.2 API Endpoints (New/Updated)

- `GET /books`:
  - sorting/filtering by project_type, genre, status, modified, word_count
- `PATCH /books/{id}`:
  - pin, cover, labels, target_word_count, deadline, type metadata
- `POST /books/{id}/duplicate`
- `POST /books/{id}/archive`
- `POST /books/{id}/restore`

- `GET /chapters`:
  - include chapter_type, workflow_status, summary, progress fields
- `PATCH /chapters/{id}/reorder`
- `POST /chapters/bulk`
  - bulk status, bulk delete, bulk export
- `POST /chapters/{id}/split`
- `POST /chapters/{id}/merge`
- `GET /chapters/{id}/versions`
- `POST /chapters/{id}/versions/{versionId}/restore`

## 5) P2 - UI And UX Delivery Plan

## 5.1 Projects Page (`/dashboard/books`)

### Must Add
- project type/genre chip
- target word count and progress bar
- labels with colors
- pin badge
- cover color/image presentation
- sort/filter controls
- card quick actions: duplicate/export/archive

### Should Add
- grid/list toggle
- collaborators avatar strip (feature-flagged)
- reading time and streak stat badges

### Copy Changes
- replace "ARCHIVE PAGE" with "Archive This Project"
- replace archive checkbox with explicit segmented filters

## 5.2 Overview (`/dashboard`)

### Must Add
- writing dashboard metrics (today/week/month words, streak, daily goal)
- deadline countdown and words-per-day requirement
- continue-writing button (jump to last edited chapter)
- inline project metadata editor (type, subtitle, audience, etc.)

### Should Add
- adaptive context brief sections by project type
- synopsis generation action
- export presets and expanded formats pipeline

## 5.3 Chapters (`/dashboard/chapters`)

### Must Add
- chapter type selector
- status pipeline chips
- summary line
- word target mini-progress
- drag-and-drop reorder
- template picker for new chapter

### Should Add
- bulk actions
- POV/timeline tags
- split/merge actions
- chapter versions and notes panel

## 5.4 Chapter Workspace (`/dashboard/chapters/[chapterId]`)

### Must Add
- stable TipTap v3 configuration and extension registry
- focus mode
- AI inline action menu scaffold (rewrite/expand/shorten/tone)
- chapter context side panel (outline/notes/research)

### Should Add
- typewriter mode
- readability panel
- regex find/replace
- citations/math/table enhancements

## 6) P3 - Adaptive Domain Pages

## 6.1 Characters (`/dashboard/characters`)
- role-based profile schema
- relationship graph data model
- voice samples for AI style conditioning

## 6.2 World (`/dashboard/world`)
- optional mode switch: World Building vs Research Hub
- glossary model with linkbacks to chapters
- timeline and board views

## 6.3 Audio (`/dashboard/audio`)
- direct record + transcribe + summarize
- insert transcript to chapter flow
- chapter/tag organization controls

## 6.4 Events (`/dashboard/events`)
- evolve into event spine with timeline tracks
- chapter-event mapping
- structure templates (three-act, hero journey, etc.)

## 6.5 Illustrations (`/dashboard/illustrations`)
- chapter linkage + placement metadata
- caption + alt text
- export placement support

## 6.6 Project Settings (`/dashboard/project-settings`)
- project type selector as primary control
- writing style profile
- AI persona profile
- language/dialect settings
- autosave/backup/export template settings

## 7) Cross-Cutting Platform Features

## 7.1 Search And Navigation
- command palette
- global search index across chapters/characters/world/events
- keyboard shortcuts baseline map

## 7.2 History And Snapshots
- named snapshots
- chapter/project diff + restore
- archive compare workflow

## 7.3 AI System Features
- centralized AI coach panel
- context-aware prompting from project metadata + chapter state
- continuity checks and style consistency checks

## 8) Execution Plan (Suggested Sprints)

Sprint 1
- finalize project/chapter schema and migrations
- API updates for projects/chapters sorting, filtering, status, reorder
- projects page chips/progress/pin/archive rename

Sprint 2
- overview metrics and deadline logic
- chapter list status pipeline + template picker + dnd reorder
- first version of chapter notes/version APIs

Sprint 3
- chapter workspace AI inline actions scaffold
- focus mode + side panels (outline/research/notes)
- global command palette and search index foundation

Sprint 4
- adaptive labels by project type across dashboard
- world/characters/events page model upgrades
- snapshot and history UX

## 9) Acceptance Gates

Gate A - Stability
- frontend build green
- chapter editor route stable after refresh and navigation

Gate B - Adaptive Core
- selecting project type changes labels and templates in at least 4 major screens

Gate C - Workflow Completeness
- user can create project with goal/deadline, reorder chapters, write in workspace, export manuscript

Gate D - Editorial Depth
- chapter history restore, AI inline rewrite flow, and global search are all functional

## 10) Risks And Mitigations

Risk: Feature scope too broad for one release
- Mitigation: enforce P0 -> P1 -> P2 -> P3 release gates

Risk: AI behavior becomes generic and non-contextual
- Mitigation: require project metadata + chapter context in all prompt builders

Risk: Performance degradation with richer cards and dashboards
- Mitigation: pagination, server filtering, selective eager-loading, cached aggregates

Risk: Data inconsistency for computed stats
- Mitigation: background recompute jobs and cache invalidation on chapter updates

---

This document is intended as the implementation baseline for the Editorial Sanctuary direction and should be revised as schema/API decisions are finalized.
