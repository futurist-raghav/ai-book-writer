# Manual Testing Guide

Comprehensive checklist for QA and manual testing of Scribe House features. Use this guide after each major release or feature implementation.

## Table of Contents

1. [Authentication & User Management](#authentication--user-management)
2. [Projects & Books](#projects--books)
3. [Chapter Workspace](#chapter-workspace)
4. [AI Assistant](#ai-assistant)
5. [Characters & World Building](#characters--world-building)
6. [Audio & Transcription](#audio--transcription)
7. [Export & Publishing](#export--publishing)
8. [Collaboration Features](#collaboration-features)
9. [Performance & Stability](#performance--stability)
10. [PWA & Offline](#pwa--offline)
11. [Cross-Browser & Responsive](#cross-browser--responsive)

---

## Authentication & User Management

### Sign Up
- [ ] Navigate to `/register`
- [ ] Enter valid email, username, password
- [ ] Click "Sign Up"
- [ ] Verify account created and redirect to login
- [ ] Check confirmation email (if applicable)
- [ ] Verify user cannot register with:
  - [ ] Duplicate email
  - [ ] Weak password
  - [ ] Missing fields
  - [ ] Invalid email format

### Login
- [ ] Navigate to `/login`
- [ ] Enter correct credentials
- [ ] Click "Login"
- [ ] Verify redirect to dashboard
- [ ] Verify JWT token stored in localStorage
- [ ] Test "Remember me" if available
- [ ] Test login with incorrect credentials - should show error
- [ ] Test login with inactive account - should show appropriate error

### Logout
- [ ] Click "Logout" in header/menu
- [ ] Verify redirect to login page
- [ ] Verify localStorage token cleared
- [ ] Try accessing protected route - should redirect to login

### Profile Management
- [ ] Navigate to settings/profile page
- [ ] Update user information (email, username, profile picture)
- [ ] Verify changes saved
- [ ] Change password:
  - [ ] Enter current password (wrong) - should error
  - [ ] Enter correct current password
  - [ ] Enter new password twice (mismatch) - should error
  - [ ] Enter matching new passwords - should save
  - [ ] Try login with old password - should fail
  - [ ] Try login with new password - should succeed

### Session Management
- [ ] Log in on two different browsers simultaneously
- [ ] Verify both sessions active
- [ ] Log out on one session
- [ ] Verify only one session authenticated
- [ ] Try accessing API with old token - should fail

---

## Projects & Books

### Create Project
- [ ] Click "New Project" on dashboard
- [ ] Test with default values
  - [ ] Title: "My Novel"
  - [ ] Genre: "Fiction"
  - [ ] Target words: 50000
  - [ ] Click Create
  - [ ] Verify project appears in list
  - [ ] Verify book created with status "draft"

- [ ] Test with all project types:
  - [ ] Novel
  - [ ] Memoir
  - [ ] Short Story
  - [ ] Screenplay (if available)
  - [ ] Academic Paper (if available)
  - [ ] Poetry Collection (if available)

- [ ] Test validation:
  - [ ] Missing title - should show error
  - [ ] Extremely long title (500+ chars) - should either truncate or error
  - [ ] Special characters in title - should accept
  - [ ] Negative target words - should error or default to 0

### Browse Projects
- [ ] Verify dashboard shows all projects
- [ ] Test Active tab - shows "draft" and "in_progress" books
- [ ] Test Drafts tab - shows only "draft" books
- [ ] Test Archive tab - shows "archived" books
- [ ] Search projects by title
- [ ] Sort by date created
- [ ] Sort by date modified
- [ ] Filter by genre
- [ ] Pagination (if enabled)
- [ ] Toggle catalog to List view and verify all actions are still available
- [ ] Toggle catalog back to Cards view and verify card layout restores correctly
- [ ] Refresh page and verify selected catalog view preference persists
- [ ] For a project with collaborators, verify avatar initials render on cards and list rows
- [ ] Verify collaborator overflow shows `+N` badge when members exceed visible avatar slots
- [ ] Hover collaborator avatars and verify tooltip identity text appears (name/email)
- [ ] Open an active project overview and verify the Manuscript Health widget is visible
- [ ] Create/update a chapter with empty summary and verify "Missing Summaries" issue count increases
- [ ] Create/update a chapter below 300 words and verify "Thin Chapters" issue count increases
- [ ] Add a known entity name (e.g., Eliana), reference a close variant in chapter text (e.g., Elena), and verify alias mismatch highlighting appears in Manuscript Health

### Edit Project Details
- [ ] Click on project to view details
- [ ] Edit title - verify saves
- [ ] Edit description - verify saves
- [ ] Edit genre - verify saves
- [ ] Edit target word count - verify saves
- [ ] Update status:
  - [ ] draft → in_progress - should save
  - [ ] in_progress → review - should save
  - [ ] review → completed - should save
  - [ ] Any status → archived - should move to archive

### Delete Project
- [ ] Attempt to delete project
- [ ] Verify confirmation dialog appears
- [ ] Cancel deletion - project still exists
- [ ] Confirm deletion - project removed from all lists
- [ ] Verify chapters/content also deleted (check database if needed)
- [ ] Try accessing deleted project URL - should get 404

### Project Settings
- [ ] Click project settings
- [ ] Verify auto-save enabled (check toggle)
- [ ] Verify auto-save interval options (5s, 10s, 30s)
- [ ] Change auto-save interval
- [ ] Verify editor font options:
  - [ ] Serif (Georgia, Times New Roman)
  - [ ] Sans-serif (Arial, Helvetica)
  - [ ] Monospace (Courier, Monaco)
- [ ] Verify font size options (10pt - 20pt)
- [ ] Verify theme options:
  - [ ] Light
  - [ ] Dark
  - [ ] Custom (if available)

---

## Chapter Workspace

### Create Chapter
- [ ] Click "New Chapter" in project
- [ ] Enter chapter title "Chapter 1"
- [ ] Click Create
- [ ] Verify chapter appears in sidebar
- [ ] Verify chapter order = 1
- [ ] Verify empty content

- [ ] Create multiple chapters:
  - [ ] Create 5 chapters
  - [ ] Verify order auto-increments
  - [ ] Verify all appear in sidebar

### Chapter Editor (Writer Canvas)
- [ ] Open chapter for editing
- [ ] Verify TipTap editor loads

#### Text Formatting
- [ ] Type "Hello world"
- [ ] Select "Hello"
- [ ] Click Bold button - verify text is bold
- [ ] Click Italic button - verify text is italic
- [ ] Click Underline button - verify text is underlined
- [ ] Select all text
- [ ] Verify all formatting options in toolbar:
  - [ ] Heading (H1, H2, H3, H4, etc.)
  - [ ] Bullet list
  - [ ] Numbered list
  - [ ] Quote/Blockquote
  - [ ] Code block
  - [ ] Horizontal rule

#### List Management
- [ ] Create bullet list:
  - [ ] Type "Item 1"
  - [ ] Press Enter - auto-create "Item 2"
  - [ ] Add 5 items
  - [ ] Press Enter twice to exit list
  - [ ] Verify formatting maintained

- [ ] Create numbered list:
  - [ ] Repeat bullet list steps
  - [ ] Verify numbers auto-increment
  - [ ] Insert item mid-list - verify renumbering

#### Tables
- [ ] Click table button
- [ ] Verify table creation dialog (if modal appears)
- [ ] Create 3x3 table
- [ ] Add content to cells
- [ ] Test table operations:
  - [ ] Add row
  - [ ] Add column
  - [ ] Delete row
  - [ ] Delete column
  - [ ] Delete table

#### Images & Media
- [ ] Click image button
- [ ] Upload image from device
- [ ] Verify image displays in editor
- [ ] Resize image
- [ ] Add caption (if supported)
- [ ] Delete image
- [ ] Test paste image from clipboard

#### Links
- [ ] Type "Click here"
- [ ] Select text
- [ ] Click link button
- [ ] Enter URL: https://example.com
- [ ] Click Save
- [ ] Verify link appears (underlined, colored)
- [ ] Click link while holding Ctrl/Cmd - should open in new tab
- [ ] Edit link:
  - [ ] Right-click link (or button if UI-based)
  - [ ] Change URL
  - [ ] Verify change

### Text Editing Features
- [ ] Undo: Type text → Ctrl+Z → text disappears
- [ ] Redo: Undo → Ctrl+Shift+Z → text reappears
- [ ] Copy: Select text → Ctrl+C → paste elsewhere
- [ ] Paste: From other document → verify formatting preserved (or stripped based on design)
- [ ] Cut: Ctrl+X → text removed

### Word Count
- [ ] Write 100 words
- [ ] Verify word count shows 100
- [ ] Add more text - verify count increases
- [ ] Delete text - verify count decreases
- [ ] Add special characters (numbers, punctuation) - verify only actual words counted
- [ ] Verify word count visible:
  - [ ] In editor footer
  - [ ] In sidebar chapter list
  - [ ] In project dashboard

### Auto-Save
- [ ] Type content
- [ ] Verify no manual save button exists (if auto-save enabled)
- [ ] Wait for auto-save timer (e.g., 10 seconds)
- [ ] Verify indicator shows "Saving..."
- [ ] Verify indicator shows "Saved" after save completes
- [ ] Close tab without saving - reopen project
- [ ] Verify content still there (persisted via auto-save)

### Manual Save
- [ ] Type content
- [ ] Click Save button (if available)
- [ ] Verify status shows "Saved"
- [ ] Refresh page
- [ ] Verify content persists

### Full-Screen/Focus Mode
- [ ] Click focus/full-screen button
- [ ] Verify:
  - [ ] Sidebar hidden
  - [ ] Other UI hidden
  - [ ] Only editor visible
  - [ ] Editor takes full width
- [ ] Press Escape - exit focus mode
- [ ] Verify sidebar/UI reappears

### Chapter Navigation
- [ ] Create 10 chapters
- [ ] Click on each chapter in sidebar
- [ ] Verify correct chapter content displays
- [ ] Verify chapter title matches
- [ ] Use keyboard shortcuts (if available):
  - [ ] Arrow Up → previous chapter
  - [ ] Arrow Down → next chapter
  - [ ] Cmd/Ctrl+K → search chapters

---

## AI Assistant

### Chat Interface
- [ ] Open chapter workspace
- [ ] Verify AI Assistant panel appears (sidebar or popup)
- [ ] Verify assistance type buttons:
  - [ ] General
  - [ ] Character
  - [ ] World
  - [ ] Dialogue
  - [ ] Plot

### General Assistance
- [ ] Click "General" mode
- [ ] Type: "Help me expand this paragraph"
- [ ] Click Send
- [ ] Verify:
  - [ ] "Sending..." indicator appears
  - [ ] Response appears within reasonable time (< 30s)
  - [ ] Response content is relevant
  - [ ] Multiple suggestion format (if applicable)

- [ ] Test with different prompts:
  - [ ] "Rewrite this scene in a comedic tone"
  - [ ] "Add more sensory details to this description"
  - [ ] "Tighten this dialogue exchange"

### Character Assistance
- [ ] Verify project has characters (create if needed)
- [ ] Click "Character" mode
- [ ] Type: "Develop Alice's backstory"
- [ ] Verify:
  - [ ] Response considers character context
  - [ ] Suggestions are character-specific
  - [ ] Can insert suggestions into editor

- [ ] Test character linking:
  - [ ] Type character name in chapter
  - [ ] Verify character gets tagged/linked
  - [ ] AI uses character context in suggestions

### World Building
- [ ] Click "World" mode
- [ ] Type: "Describe the magic system"
- [ ] Verify response considers world-building context

### Dialogue Assistance
- [ ] Select dialogue text in editor
- [ ] Click "Dialogue" mode
- [ ] Type: "Make this dialogue more natural"
- [ ] Verify:
  - [ ] Suggestions maintain character voices
  - [ ] Suggested dialogue is insertable

### Plot Assistance
- [ ] Click "Plot" mode
- [ ] Type: "What happens next in this scene?"
- [ ] Verify:
  - [ ] Response continues story logically
  - [ ] Suggestions escalate tension or advance plot

### Advanced Consistency Checker
- [ ] Open a chapter workspace and click the "Consistency" action
- [ ] Verify results modal opens with severity badges and issue-type labels
- [ ] Create cross-chapter character spelling drift (e.g., Jon vs John) and verify detection
- [ ] Create terminology drift (e.g., internet vs web) and verify detection with mention counts
- [ ] Create date conflict (e.g., March 12, 1888 vs March 12, 1889) and verify timeline issue detection
- [ ] Create appearance drift (e.g., "Elena had red hair" vs "Elena's hair was blonde") and verify appearance inconsistency detection
- [ ] Verify each issue includes chapter references and suggested fixes
- [ ] Click "Draft AI Fix Prompt" and verify a structured fix prompt is prefilled in assistant chat input
- [ ] For replaceable issue types, use "Fix: X → Y" action and verify writer content updates locally

### Insert Suggestions
- [ ] Get AI suggestions for any text
- [ ] Click "Insert" button on suggestion
- [ ] Verify:
  - [ ] Text inserted into editor at cursor
  - [ ] Formatting preserved
  - [ ] Word count updates
  - [ ] Change is undoable (Ctrl+Z)

### Chat History
- [ ] Send multiple messages in chat
- [ ] Verify all messages visible in chat panel
- [ ] Scroll through chat history
- [ ] Verify context maintained (AI references previous messages)

### Error Handling
- [ ] Send very long prompt (5000+ chars)
- [ ] Get error response (if not supported)
- [ ] Verify appropriate error message
- [ ] Try again with shorter prompt - should work

- [ ] Go offline/disconnect
- [ ] Try sending message
- [ ] Verify error or offline indicator
- [ ] Reconnect
- [ ] Try sending again - should work

---

## Characters & World Building

### Character Management
- [ ] Create new character:
  - [ ] Name: "Alice"
  - [ ] Role: "Protagonist"
  - [ ] Description: "A curious explorer"
  - [ ] Save
  - [ ] Verify appears in characters list

- [ ] Edit character:
  - [ ] Change role to "Antagonist"
  - [ ] Add traits: ["intelligent", "brave"]
  - [ ] Add appearance details
  - [ ] Save
  - [ ] Verify changes persisted

- [ ] Link character to chapters:
  - [ ] Open chapter content
  - [ ] Type character name "Alice"
  - [ ] Verify character gets linked/tagged
  - [ ] Click tag to view character details

- [ ] Delete character:
  - [ ] Select character
  - [ ] Click Delete
  - [ ] Confirm deletion
  - [ ] Verify removed from list
  - [ ] Verify references removed from chapters (or noted as removed)

### World Building Elements
- [ ] Create location:
  - [ ] Name: "Kingdom of Eldoria"
  - [ ] Type: "Location"
  - [ ] Description: "A magical realm with floating islands"
  - [ ] Save

- [ ] Create magic system:
  - [ ] Name: "The Weave"
  - [ ] Type: "System"
  - [ ] Rules: "Magic depletes life force"

- [ ] Create artifact/object:
  - [ ] Name: "The Crown"
  - [ ] Type: "Artifact"
  - [ ] Significance: "Grants immortality"

- [ ] Link world elements to chapters:
  - [ ] Mention location in chapter
  - [ ] Verify linkable/taggable
  - [ ] Click link to view details

---

## Audio & Transcription

### Upload Audio
- [ ] Navigate to Audio/Recording section
- [ ] Click "Upload Audio"
- [ ] Select MP3, WAV, or supported format
- [ ] Verify upload progress indicator
- [ ] Verify file size limit (if applicable)
- [ ] Verify upload completes successfully

### Transcription
- [ ] After upload, verify transcription starts
- [ ] Check transcription status (pending → processing → completed)
- [ ] Verify transcribed text appears
- [ ] Verify transcription accuracy (spot-check for errors)
- [ ] Verify language detected correctly

### Audio Player
- [ ] Verify audio player controls:
  - [ ] Play/Pause
  - [ ] Progress bar (seekable)
  - [ ] Volume control
  - [ ] Playback speed (if available)

### Transcription Editor
- [ ] Verify transcribed text editable
- [ ] Make corrections to transcribed text
- [ ] Save corrections
- [ ] Verify changes persisted

### Audio to Chapter
- [ ] Create new chapter from transcription:
  - [ ] Click "Create Chapter from Transcription"
  - [ ] Verify transcribed text populated
  - [ ] Verify chapter created with correct title/naming
  - [ ] Verify in chapter list

---

## Export & Publishing

### Export to PDF
- [ ] Select project to export
- [ ] Click Export → PDF
- [ ] Verify formatting options:
  - [ ] Include table of contents
  - [ ] Include metadata (title, author, date)
  - [ ] Choose style/template
- [ ] Verify format preview (if available)
- [ ] Click Export
- [ ] Verify file downloads
- [ ] Open downloaded PDF - verify formatting correct

### Export to EPUB
- [ ] Click Export → EPUB
- [ ] Verify settings
- [ ] Export complete
- [ ] Open in e-book reader (Calibre, Apple Books, etc.)
- [ ] Verify:
  - [ ] Text wraps correctly
  - [ ] Images display
  - [ ] Chapters navigate properly
  - [ ] Formatting preserved

### Export to DOCX
- [ ] Click Export → DOCX
- [ ] Export complete
- [ ] Open in Microsoft Word or compatible software
- [ ] Verify:
  - [ ] All formatting preserved
  - [ ] Images embedded
  - [ ] Page breaks between chapters
  - [ ] Table of contents generated

### Export Settings
- [ ] Test with different configurations:
  - [ ] Include/exclude metadata
  - [ ] Include/exclude chapter breaks
  - [ ] Different fonts
  - [ ] Different margins

---

## Collaboration Features

### Project Scope Selector
- [ ] Open `/dashboard/collaboration` and verify the Project Scope dropdown loads available projects
- [ ] Switch between two projects and verify collaborator/comment/activity lists refresh per selected project
- [ ] Add collaborator or comment in Project A, switch to Project B, and verify the new item does not appear there

### Share Project
- [ ] Open project settings
- [ ] Click "Share"
- [ ] Generate share link
- [ ] Set permissions (view/edit/comment)
- [ ] Copy link
- [ ] Share with another user
- [ ] Verify link recipient can access

### Real-Time Collaboration
- [ ] Open project on two different browsers/devices
- [ ] Make edit on Device 1 - verify appears on Device 2 in real-time
- [ ] Make edit on Device 2 - verify appears on Device 1 in real-time
- [ ] Test simultaneous edits on different chapters
- [ ] Test simultaneous edits on same chapter - verify no conflicts

### Comments & Suggestions
- [ ] Select text in chapter
- [ ] Click comment button
- [ ] Type comment: "This needs work"
- [ ] Submit comment
- [ ] Verify comment appears in thread
- [ ] Reply to comment
- [ ] Resolve comment thread
- [ ] Verify resolved threads collapsed/marked

### Activity Log
- [ ] Open project activity/history
- [ ] Verify activity shows:
  - [ ] Who edited what
  - [ ] When changes made
  - [ ] What content changed (diff view if available)

---

## Performance & Stability

### Response Time
- [ ] Save large chapters (10,000+ words) - should be < 2 seconds
- [ ] Loading chapters - should be < 500ms
- [ ] AI suggestions - should be < 30 seconds (reasonable for API call)
- [ ] Project list with 100+ projects - should load quickly

### Memory Usage
- [ ] Leave app open for 1 hour - verify no significant lag
- [ ] Open multiple projects - verify no memory leak
- [ ] Generate multiple suggestions - verify memory doesn't balloon

### Stability
- [ ] Create/edit/delete 50 chapters - should not crash
- [ ] Rapid repeated saves - should handle gracefully
- [ ] Long continuous editing session (8+ hours) - no crashes
- [ ] Network interruption - verify graceful handling and reconnection

### Error Recovery
- [ ] Simulate network loss - verify error message
- [ ] Reconnect network - verify data syncs
- [ ] Close browser mid-edit - verify data saved
- [ ] Reopen browser/project - verify latest content exists

---

## PWA & Offline

### Installability
- [ ] Open dashboard in Chrome/Edge and verify install prompt appears
- [ ] Dismiss prompt and verify it can be triggered again on next eligible visit
- [ ] Accept install prompt and verify app launches in standalone mode

### Connectivity UI
- [ ] Disconnect network and verify offline banner appears in dashboard
- [ ] Reconnect network and verify offline banner is removed

### Offline Chapter Viewing (Read Cache)
- [ ] Open a chapter workspace while online
- [ ] Navigate through chapter content and return to dashboard
- [ ] Disconnect network
- [ ] Reload dashboard and reopen previously visited chapter
- [ ] Verify chapter content is still viewable from cache

### Offline Chapter Editing Queue
- [ ] Open chapter workspace while online, then disconnect network
- [ ] Edit chapter content and wait for autosave debounce window
- [ ] Verify queued autosave indicator appears with queued count
- [ ] Make multiple offline edits and verify the most recent draft is the one replayed after reconnect
- [ ] Reconnect network
- [ ] Verify queued indicator clears after sync and "saved" state appears
- [ ] Refresh chapter and verify offline-edited content persisted to backend

---

## Cross-Browser & Responsive

### Desktop Browsers
- [ ] Chrome (latest)
  - [ ] All features functional
  - [ ] No console errors
  - [ ] Responsive at 1024px width

- [ ] Firefox (latest)
  - [ ] All features functional
  - [ ] No console errors

- [ ] Safari (latest)
  - [ ] All features functional
  - [ ] No console errors

- [ ] Edge (latest)
  - [ ] All features functional

### Mobile Responsiveness
- [ ] Test at 375px (iPhone SE/old)
- [ ] Test at 414px (iPhone standard)
- [ ] Test at 768px (iPad mini)
- [ ] Test at 1024px (iPad)

Verify:
- [ ] Sidebar collapse/menu hamburger
- [ ] Editor readable on small screen
- [ ] Touch targets minimum 48x48px
- [ ] No horizontal scroll (except when needed)
- [ ] Buttons accessible and clickable

### Tablet
- [ ] 2-column layout functional
- [ ] Split-screen editing (if available)
- [ ] Touch gestures work:
  - [ ] Swipe to navigate chapters
  - [ ] Long-press for context menu
  - [ ] Pinch to zoom text

### Dark Mode (if available)
- [ ] Toggle dark mode
- [ ] Verify all text readable
- [ ] Verify no glaring whites
- [ ] Verify UI consistent
- [ ] Verify persists after refresh

---

## Regression Testing Checklist

After each major update, verify:

- [ ] Login/logout works
- [ ] Create project with all types
- [ ] Create and edit chapters
- [ ] Use AI assistant (all modes)
- [ ] Export to PDF/EPUB/DOCX
- [ ] Auto-save functioning
- [ ] Word count accurate
- [ ] Mobile view responsive
- [ ] No console errors
- [ ] Performance acceptable

---

## Bug Reporting Template

When reporting issues found during manual testing:

```
**Title:** [Feature] Issue description

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
What should happen

**Actual Result:**
What actually happened

**Screenshots/Video:**
[Attach if applicable]

**Environment:**
- Browser: [Chrome, Firefox, Safari, Edge]
- OS: [Windows, macOS, Linux]
- Screen Size: [1920x1080, 768x1024, 375x667]

**Priority:**
[Critical, High, Medium, Low]

**Additional Notes:**
[Any other relevant information]
```

---

## Resources

- [Testing Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [Manual Testing Best Practices](https://testing.googleblog.com/2024/01/best-practices-for-manual-testing.html)
- [Accessibility Testing Guide](https://www.w3.org/WAI/test-evaluate/)
- [Performance Testing Tools](https://web.dev/performance-tools/)

---

## Sign-Off

| Feature | Tester | Date | Status |
|---------|--------|------|--------|
| Auth | _ | _ | ✅/❌ |
| Projects | _ | _ | ✅/❌ |
| Chapter Editor | _ | _ | ✅/❌ |
| AI Assistant | _ | _ | ✅/❌ |
| Export | _ | _ | ✅/❌ |
| Performance | _ | _ | ✅/❌ |
| **Overall** | _ | _ | ✅/❌ |

**Release Ready:** ☐ Yes ☐ No

---

Last Updated: 2026-04-09
