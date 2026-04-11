# SESSION: P5.3 Title Page + TOC Builder Slice

Date: 2026-04-11
Status: Completed slice (P5.3 remains in progress)

## What shipped

1. Publishing UI now includes a Title Page + TOC Builder panel.
2. Title page fields are editable and persisted:
   - title
   - subtitle
   - author
   - tagline
3. TOC mode supports:
   - auto (chapter-derived)
   - manual (line format: `Section Title | Page`)
4. Settings persist to `book.project_settings.publishing_layout`.

## Backend preview integration

Compile preview now reads saved publishing layout config:
- `publishing_layout.title_page`
- `publishing_layout.toc`

Behavior updates:
- Adds a Title Page section to preview when title page content exists.
- Uses manual TOC entries when mode is `manual` and entries are present.
- Falls back to chapter-derived TOC when manual entries are absent/invalid.

## Files changed

- backend/app/api/v1/export.py
- frontend/src/app/dashboard/publishing/page.tsx
- docs/TODO.md
- docs/NEXT.md

## Validation

- Backend syntax check: `python3 -m py_compile backend/app/api/v1/export.py` (pass)
- Frontend type check: `npm --prefix frontend run type-check`
  - No new errors in publishing page.
  - Existing repo-wide baseline TypeScript errors remain in unrelated files.

## Remaining P5.3 scope

- Glossary builder (auto/manual)
- Index builder (auto/manual)
- Bibliography builder
- Export parity for all remaining builder sections
