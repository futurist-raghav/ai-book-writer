# Comprehensive Manual Testing Todo List

This is your detailed manual testing checklist for Scribe House. Use this to systematically test each feature and ensure quality. Mark items as complete as you test them.

## Phase 0: Foundation Testing (Current Release)

### 0.1 Authentication & Security

#### User Registration
- [ ] **Register new user**
  - [ ] Fill form with valid credentials
  - [ ] Submit and verify account created
  - [ ] Check email (if required)
  - [ ] Verify can login with new account
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Validate registration inputs**
  - [ ] Try duplicate email - should error
  - [ ] Try weak password - should error
  - [ ] Try empty fields - should error
  - [ ] Try invalid email format - should error
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### User Login
- [ ] **Login with valid credentials**
  - [ ] Navigate to login page
  - [ ] Enter email and password
  - [ ] Click login
  - [ ] Verify redirect to dashboard
  - [ ] Verify JWT token stored
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Login error handling**
  - [ ] Wrong password - verify error message
  - [ ] Non-existent email - verify error message
  - [ ] Empty fields - verify error message
  - [ ] SQL injection attempt - verify no error/safe response
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Logout
- [ ] **Logout functionality**
  - [ ] Click logout button (location: __)
  - [ ] Verify token cleared from storage
  - [ ] Verify redirect to login page
  - [ ] Try accessing protected route - should redirect to login
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Session Security
- [ ] **Token expiration**
  - [ ] Wait for token to expire (expect: __ minutes)
  - [ ] Try accessing protected resource
  - [ ] Verify request fails with 401
  - [ ] Verify redirect to login
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **CORS protection**
  - [ ] Attempt API call from different origin
  - [ ] Verify request blocked
  - [ ] Check CORS headers in response
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 0.2 Dashboard & Navigation

#### Dashboard Load
- [ ] **Dashboard initial load**
  - [ ] Login and navigate to dashboard
  - [ ] Verify page loads within: __ seconds
  - [ ] Verify all UI elements render
  - [ ] Check console for errors: (errors: _)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Navigation
- [ ] **Main navigation (sidebar/header)**
  - [ ] Home/Dashboard link works
  - [ ] Books/Projects link works
  - [ ] New Project button works
  - [ ] User profile dropdown works
  - [ ] Settings link works
  - [ ] Logout link works
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Responsive Navigation
- [ ] **Mobile menu hamburger**
  - [ ] At 375px width, sidebar visible/hidden: __
  - [ ] Hamburger button visible and clickable
  - [ ] Click hamburger - menu opens
  - [ ] Click menu item - navigation works
  - [ ] Menu closes on navigation
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 0.3 Project Creation & Management

#### Create Project
- [ ] **Create new project (Novel)**
  - [ ] Click "New Project"
  - [ ] Verify form appears with fields: (list fields)
  - [ ] Enter: Title="My First Novel", Genre="Fiction", Target=50000
  - [ ] Click Create
  - [ ] Verify redirect to project dashboard
  - [ ] Verify project appears in list
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Create different project types**
  - [ ] Create Memoir project (if available)
  - [ ] Create Screenplay project (if available)
  - [ ] Create Poetry project (if available)
  - [ ] Create Academic paper (if available)
  - [ ] Verify each type creates with correct default settings
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Project Validation
- [ ] **Form validation**
  - [ ] Try create with empty title - error: __
  - [ ] Try create with title > 255 chars - behavior: __
  - [ ] Try create with negative target words - error: __
  - [ ] Try create with 0 target words - behavior: __
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Project List
- [ ] **View all projects**
  - [ ] Verify all created projects visible
  - [ ] Project shows: Title, Type, Status, Word Count, Modified Date
  - [ ] Total project count shown: __
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Filter & Sort
- [ ] **Filter by status**
  - [ ] Active tab shows: __ projects
  - [ ] Drafts tab shows: __ projects
  - [ ] Archive tab shows: __ projects
  - [ ] Completed tab shows (if available): __ projects
  - [ ] Count totals match
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Sort projects**
  - [ ] Sort by date created (oldest first)
  - [ ] Sort by date modified (newest first)
  - [ ] Sort by alphabetical (A-Z)
  - [ ] Sort by word count (ascending)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Search projects**
  - [ ] Search by partial title
  - [ ] Search by full title
  - [ ] Search with special characters
  - [ ] Search with numbers
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Edit Project
- [ ] **Update project details**
  - [ ] Open project settings
  - [ ] Edit title to "My Updated Novel"
  - [ ] Verify title updated in list
  - [ ] Edit description
  - [ ] Verify description saves
  - [ ] Change target words to 100000
  - [ ] Verify target updates
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Status Transitions
- [ ] **Update project status**
  - [ ] Draft → In Progress
  - [ ] In Progress → Review
  - [ ] Review → Completed
  - [ ] Completed → Archive
  - [ ] Any status → Cancel (undo)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Delete Project
- [ ] **Delete project**
  - [ ] Open project
  - [ ] Click delete/remove option
  - [ ] Verify confirmation dialog appears
  - [ ] Click cancel - project still exists
  - [ ] Click confirm delete
  - [ ] Verify removed from all lists
  - [ ] Try access via URL - get 404
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 0.4 Chapter Management

#### Create Chapter
- [ ] **Create first chapter**
  - [ ] Click "New Chapter" in project
  - [ ] Enter title "Chapter 1: The Beginning"
  - [ ] Click Create
  - [ ] Verify chapter appears in sidebar
  - [ ] Verify default order = 1
  - [ ] Verify blank content
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Create multiple chapters**
  - [ ] Create 10 chapters
  - [ ] Verify chapter numbers auto-increment
  - [ ] Verify all appear in sidebar
  - [ ] Verify no duplicates
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Chapter Editor

##### Basic Text Operations
- [ ] **Type and edit text**
  - [ ] Click in editor
  - [ ] Type: "Once upon a time, in a land far away..."
  - [ ] Verify text appears
  - [ ] Select text and replace
  - [ ] Verify word count updates (expected: 17 words)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Copy/Paste operations**
  - [ ] Type some text
  - [ ] Select and copy (Ctrl+C)
  - [ ] Click elsewhere in editor
  - [ ] Paste (Ctrl+V)
  - [ ] Verify text pasted correctly
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Undo/Redo**
  - [ ] Type text
  - [ ] Press Ctrl+Z (Undo)
  - [ ] Verify text removed
  - [ ] Press Ctrl+Shift+Z (Redo)
  - [ ] Verify text restored
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Text Formatting
- [ ] **Bold formatting**
  - [ ] Type "Bold text"
  - [ ] Select "Bold"
  - [ ] Click Bold button (or Ctrl+B)
  - [ ] Verify text is bold
  - [ ] Click again to remove bold
  - [ ] Verify bold removed
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Italic formatting**
  - [ ] Type "Italic text"
  - [ ] Select and apply italic (Ctrl+I)
  - [ ] Verify text is italic
  - [ ] Verify undo/redo works
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Underline formatting**
  - [ ] Type "Underlined text"
  - [ ] Select and apply underline (Ctrl+U)
  - [ ] Verify text is underlined
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Strikethrough (if available)**
  - [ ] Apply strikethrough formatting
  - [ ] Verify display
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Text color (if available)**
  - [ ] Type text
  - [ ] Select text
  - [ ] Open color picker (or button)
  - [ ] Choose red color
  - [ ] Verify text is red
  - [ ] Change to blue
  - [ ] Verify changes
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Heading Styles
- [ ] **Format as headings**
  - [ ] Type "Main Title"
  - [ ] Select text
  - [ ] Click Heading 1 button (or Ctrl+Alt+1)
  - [ ] Verify text is H1 (large, bold)
  - [ ] Verify HTML is `<h1>`

- [ ] **H2, H3, H4**
  - [ ] Create text for each heading level
  - [ ] Apply appropriate heading style
  - [ ] Verify size decreases for lower levels
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Lists
- [ ] **Bullet list**
  - [ ] Type "Item 1"
  - [ ] Press Enter
  - [ ] Type "Item 2"
  - [ ] Type "Item 3"
  - [ ] Verify bulleted list format (•)
  - [ ] Press Enter twice to exit list
  - [ ] Verify normal text continues
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Numbered list**
  - [ ] Type "Step 1"
  - [ ] Press Enter
  - [ ] Type "Step 2"
  - [ ] Type "Step 3"
  - [ ] Verify numbered format (1. 2. 3.)
  - [ ] Numbers auto-increment
  - [ ] Insert item mid-list - verify renumbering
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Nested list**
  - [ ] Create bullet list
  - [ ] Click indent button (or Tab)
  - [ ] Create sub-bullet
  - [ ] Verify indentation
  - [ ] Click outdent (Shift+Tab)
  - [ ] Verify back to main level
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Special Elements
- [ ] **Blockquote**
  - [ ] Type a quote
  - [ ] Select and click Quote button
  - [ ] Verify quote formatting (indent, styling)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Code block**
  - [ ] Type "const hello = 'world'"
  - [ ] Select and click Code Block button
  - [ ] Verify code formatting (monospace, special styling)
  - [ ] Verify syntax highlighting (if available)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Horizontal rule**
  - [ ] Click Horizontal Rule button
  - [ ] Verify line appears dividing content
  - [ ] Verify line separates paragraphs
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Tables
- [ ] **Create table**
  - [ ] Click Table button
  - [ ] Verify table dialog appears (if modal)
  - [ ] Specify 3 rows x 3 columns
  - [ ] Click Create
  - [ ] Verify 3x3 table appears

- [ ] **Edit table**
  - [ ] Add data to cells
  - [ ] Add header row (if not present)
  - [ ] Verify header styling different from data
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Table operations**
  - [ ] Add column - right-click, "Insert column right"
  - [ ] Verify new column added
  - [ ] Add row - right-click, "Insert row below"
  - [ ] Verify new row added
  - [ ] Delete column - verify removed
  - [ ] Delete row - verify removed
  - [ ] Delete entire table - verify removed
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Images
- [ ] **Insert image**
  - [ ] Click Image button in toolbar
  - [ ] Choose image file from device
  - [ ] Verify image appears in editor
  - [ ] Image displays correctly (size, aspect ratio)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Resize image**
  - [ ] Click image to select
  - [ ] Drag corner handle to resize
  - [ ] Verify proportions maintained
  - [ ] Verify word count not affected
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Image caption (if available)**
  - [ ] Add caption below image
  - [ ] Verify caption styling different from text
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Delete image**
  - [ ] Select image
  - [ ] Press Delete key
  - [ ] Verify image removed
  - [ ] Verify text flows properly
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

##### Links
- [ ] **Create link**
  - [ ] Type "Learn more"
  - [ ] Select text
  - [ ] Click Link button (or Ctrl+K)
  - [ ] Enter URL: https://example.com
  - [ ] Click Save/OK
  - [ ] Verify link appears (underlined, colored)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Open link**
  - [ ] Ctrl+Click on link (or Cmd+Click on Mac)
  - [ ] Verify opens in new tab
  - [ ] Verify correct URL visited
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Edit link**
  - [ ] Right-click link → Edit link (or button if UI-based)
  - [ ] Change URL to https://newsite.com
  - [ ] Click Save
  - [ ] Verify URL updated
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Remove link**
  - [ ] Click link or select
  - [ ] Click Remove Link button (or Ctrl+Shift+K)
  - [ ] Verify text remains but no longer a link
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Word Count & Statistics
- [ ] **Word count accuracy**
  - [ ] Type exactly 100 words
  - [ ] Verify count shows 100 (location: __)
  - [ ] Add 50 more words
  - [ ] Verify count now shows 150
  - [ ] Delete 25 words
  - [ ] Verify count shows 125
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Word count edge cases**
  - [ ] Include numbers: "I have 123 apples"
  - [ ] Include punctuation: "Hello, world!"
  - [ ] Include contractions: "It's wonderful"
  - [ ] Verify count accurate (expected: __)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Character count (if available)**
  - [ ] Verify character count shown
  - [ ] Verify updates with text
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Reading time (if available)**
  - [ ] Verify reading time estimated
  - [ ] Add 1000 words
  - [ ] Verify reading time increases
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Auto-Save
- [ ] **Auto-save enabled**
  - [ ] Type content
  - [ ] Verify no manual save button (if enabled)
  - [ ] Wait 10 seconds (or configured interval)
  - [ ] Verify "Saving..." indicator appears
  - [ ] Verify "Saved" indicator appears after
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Auto-save persistence**
  - [ ] Type content
  - [ ] Let auto-save complete
  - [ ] Close tab/browser window
  - [ ] Reopen browser
  - [ ] Navigate back to chapter
  - [ ] Verify content still there and not lost
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Manual save (if available)**
  - [ ] Type content
  - [ ] Click Save button
  - [ ] Verify status shows "Saved"
  - [ ] Refresh page
  - [ ] Verify content persisted
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Focus/Full-Screen Mode (if available)
- [ ] **Enter focus mode**
  - [ ] Click Focus/Full-screen button
  - [ ] Verify sidebar hidden
  - [ ] Verify header/nav hidden
  - [ ] Verify only editor visible
  - [ ] Verify editor fills screen
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Exit focus mode**
  - [ ] Press Escape key
  - [ ] Verify sidebar reappears
  - [ ] Verify nav reappears
  - [ ] Verify normal view restored
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 0.5 AI Assistant Integration

#### Chat Interface
- [ ] **AI assistant panel visible**
  - [ ] Open chapter for editing
  - [ ] Verify AI panel visible (sidebar/popup)
  - [ ] Panel shows: Chat area, Input box, Send button
  - [ ] Assistance type buttons visible: (list types)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### General Assistance
- [ ] **Send to AI assistant**
  - [ ] Type message: "Help me expand this paragraph"
  - [ ] Click Send button
  - [ ] Verify "Sending..." indicator
  - [ ] Verify response appears within 30 seconds
  - [ ] Response is relevant and helpful
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Multiple suggestions**
  - [ ] Request: "Give me 3 ways to start this chapter"
  - [ ] Verify response with 3 suggestions
  - [ ] Verify numbered/formatted suggestions
  - [ ] Each suggestion has Insert button (if available)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Character Assistance
- [ ] **Character mode**
  - [ ] Click "Character" button in AI panel
  - [ ] Request: "Develop Alice's backstory"
  - [ ] Verify response focuses on character
  - [ ] Response considers character context
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### World Building
- [ ] **World building mode**
  - [ ] Click "World" button
  - [ ] Request: "Describe the magic system"
  - [ ] Verify response about world elements
  - [ ] Response considers project theme/genre
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Dialogue Assistance
- [ ] **Dialogue mode**
  - [ ] Click "Dialogue" button
  - [ ] Request: "Improve this conversation"
  - [ ] Verify response about dialogue
  - [ ] Response maintains character voices
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Plot Assistance
- [ ] **Plot mode**
  - [ ] Click "Plot" button
  - [ ] Request: "What happens next?"
  - [ ] Verify response advances story
  - [ ] Response considers current context
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Insert Suggestions
- [ ] **Insert into document**
  - [ ] Get AI suggestion
  - [ ] Click "Insert" button on suggestion
  - [ ] Verify text inserted into editor at cursor
  - [ ] Word count updates
  - [ ] Insertion is undoable (Ctrl+Z works)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Error Handling
- [ ] **Network error**
  - [ ] Simulate offline (DevTools or disconnect)
  - [ ] Try sending message
  - [ ] Verify error message appears
  - [ ] Reconnect to network
  - [ ] Try again - should work
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Server error**
  - [ ] Send very long message (5000+ chars)
  - [ ] Verify error handling appropriate
  - [ ] Try again with shorter message
  - [ ] Should work
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 0.6 Performance & Stability

#### Speed Tests
- [ ] **Page load time**
  - [ ] Measure dashboard load time: __ seconds (target < 2s)
  - [ ] Measure project load time: __ seconds (target < 1s)
  - [ ] Measure chapter load time: __ seconds (target < 500ms)
  - [ ] AI response time: __ seconds (target < 30s)
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Stability
- [ ] **Continuous editing**
  - [ ] Edit same chapter for 1 hour
  - [ ] No crashes, freezes, or lag
  - [ ] Auto-save continues to work
  - [ ] No memory issues
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

- [ ] **Large files**
  - [ ] Create chapter with 50,000+ words
  - [ ] Verify loads without freezing/lag
  - [ ] Verify editing still responsive
  - [ ] Verify save completes without error
  - [ ] Time: __ | Pass: ✅/❌ | Issues: ___

#### Browser Compatibility
- [ ] **Chrome**
  - [ ] All features functional: ✅/❌
  - [ ] No console errors: ✅/❌
  - [ ] Performance acceptable: ✅/❌

- [ ] **Firefox**
  - [ ] All features functional: ✅/❌
  - [ ] No console errors: ✅/❌
  - [ ] Performance acceptable: ✅/❌

- [ ] **Safari**
  - [ ] All features functional: ✅/❌
  - [ ] No console errors: ✅/❌
  - [ ] Performance acceptable: ✅/❌

- [ ] **Edge**
  - [ ] All features functional: ✅/❌
  - [ ] No console errors: ✅/❌
  - [ ] Performance acceptable: ✅/❌

#### Responsive Design
- [ ] **Desktop (1920x1080)**
  - [ ] All features visible: ✅/❌
  - [ ] No horizontal scroll: ✅/❌
  - [ ] UI proportional: ✅/❌

- [ ] **Tablet (768x1024)**
  - [ ] Editor visible/usable: ✅/❌
  - [ ] Sidebar visible or collapsed: ✅/❌
  - [ ] All buttons touchable: ✅/❌

- [ ] **Mobile (375x667)**
  - [ ] Mobile menu works: ✅/❌
  - [ ] Editor readable: ✅/❌
  - [ ] Touch targets > 48px: ✅/❌

---

## Phase 1: MVP Testing (Next Release)

### 1.1 Extended Project Features
- [ ] Project templates
- [ ] Project metadata customization
- [ ] Auto-folder structure
- [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 1.2 Enhanced AI
- [ ] One-click enhancements (expand, tighten, enhance)
- [ ] Tone/style matcher
- [ ] Grammar feedback
- [ ] Prompt templates
- [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 1.3 Characters & World
- [ ] Character creation/management
- [ ] Location management
- [ ] Theme/motif tracker
- [ ] Entity linking to chapters
- [ ] Time: __ | Pass: ✅/❌ | Issues: ___

### 1.4 Export Features
- [ ] Export to PDF
- [ ] Export to EPUB
- [ ] Export to DOCX
- [ ] Custom export settings
- [ ] Time: __ | Pass: ✅/❌ | Issues: ___

---

## Phase 2: Collaboration (Future Release)

- [ ] Invite collaborators
- [ ] Real-time editing
- [ ] Comments & threads
- [ ] Permission management
- [ ] Activity log
- [ ] Time: __ | Pass: ✅/❌ | Issues: ___

---

## Summary

### Tests Completed: __/__ (__%)
### Critical Issues: __
### High Issues: __
### Medium Issues: __
### Low Issues: __

### Overall Status
- ✅ Production Ready
- ⚠️ Ready with Known Issues
- ❌ Not Ready for Release

### Sign-Off
**Tester Name:** __________________  
**Date:** _____________________  
**Signature:** _____________________

---

**Notes & Additional Findings:**

(Record any patterns, edge cases, or recommendations discovered during testing)

```
_____________________________________________________________________________

_____________________________________________________________________________

_____________________________________________________________________________

_____________________________________________________________________________
```
