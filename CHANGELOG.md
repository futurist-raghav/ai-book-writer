# Changelog

All notable changes to AI Book Writer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup and documentation
- Comprehensive README with project overview
- Architecture documentation with diagrams
- API documentation with all endpoints
- Setup and deployment guides
- AI model comparison and recommendations
- Docker Compose configuration
- Environment variable templates
- Quick start script
- Makefile for common tasks
- Chapter summary generation endpoint: `POST /chapters/{id}/generate-summary`
- Chapter outline generation endpoint: `POST /chapters/{id}/generate-outline`
- Chapter route stability test coverage in frontend app tests
- Reusable frontend query error state component with retry action
- Backend export support for `latex` and `fountain` formats
- Dashboard chapter word-count breakdown panel for per-chapter pacing visibility
- Persistent custom export profile templates in Publishing (save/apply/delete)
- Chapter workspace split-view mode with persistent side notes panel
- PWA manifest and service worker for installability and offline caching
- Runtime PWA install prompt + connectivity banner in dashboard layout
- Context-aware Writer Assistant quick-action sets by project type (fiction, non-fiction, screenplay, textbook, songwriting)
- PWA runtime Jest coverage for offline/install prompt flows
- Project catalog collaborator avatar previews (cards + list rows) with overflow indicator
- Collaboration dashboard Jest coverage for project scope switching and scoped comment posting
- Reusable offline draft queue utility for chapter autosave fallback (`offline-draft-queue`)
- Offline draft queue Jest coverage for malformed storage recovery, bounds, and replay selection
- Reusable manuscript health analysis utility for chapter diagnostics (`manuscript-health`)
- Manuscript Health dashboard widget with score/status and issue flags
- Manuscript health Jest coverage for stale/missing-summary/thin-chapter diagnostics
- Manuscript health alias-mismatch diagnostics for fuzzy character-name drift (e.g., `Elena -> Eliana`)

### Changed
- Dashboard pages now use standardized query error + retry patterns
- Chapter management now supports drag-and-drop reorder, bulk updates, and POV tracking
- Auth-expiry redirect flow moved to router-driven event handling in frontend layout
- Publishing workspace now uses supported-format previews, export profile presets, and metadata/front-back matter editors
- Dashboard writing metrics now include live writing streak display sourced from chapter edit history
- Publishing profile presets now merge built-in templates with project-specific saved templates persisted in book settings
- Chapter workspace now supports editor + notes side-by-side composition workflow for split mode
- Chapter workspace autosave now queues draft snapshots offline and syncs queued changes on reconnect
- Writer Assistant quick-action buttons now load dynamically from project type configuration while preserving shared summary/outline actions
- Projects catalog now supports card/list display toggle with persisted user preference
- Project dashboard collaboration lookup now uses book-scoped collaborator endpoint for card/list previews
- Collaboration dashboard now uses explicit project scope selection and book-scoped collaborators/comments/activity endpoints
- Chapter workspace offline autosave now uses shared offline draft queue helpers instead of inline queue storage logic
- Project overview dashboard now surfaces manuscript readiness diagnostics (stale, missing summary, thin chapter risk flags)
- Manuscript health now separates fuzzy alias mismatches from generic undefined-character flags for clearer continuity triage

### Fixed
- "Continue Writing" chapter lookup now respects backend chapter list pagination limit constraints
- Removed frontend debug artifacts and improved non-404 transcription failure handling
- Publishing export action now opens backend download URLs from export responses instead of treating responses as binary payloads
- Writing metrics utility now returns longest streak data and supports word-count fallback for reading level consumers
- Collaboration dashboard actions now match backend route shape (no legacy non-book-scoped collaboration path dependency)

### Documentation
- README.md - Project overview and quick start
- docs/ARCHITECTURE.md - System architecture and design
- docs/API.md - Complete API reference
- docs/SETUP.md - Development setup guide
- docs/DEPLOYMENT.md - Deployment instructions
- docs/AI_MODELS.md - AI model comparison and cost analysis
- CONTRIBUTING.md - Contribution guidelines
- LICENSE - MIT License

### Configuration
- .env.example - Environment variables template
- docker-compose.yml - Multi-service Docker setup
- Dockerfile (backend) - Python FastAPI container
- Dockerfile (frontend) - Next.js container
- requirements.txt - Python dependencies
- package.json - Node.js dependencies
- .gitignore - Git ignore rules
- Makefile - Development commands

## [1.0.0] - TBD

### Planned Features

#### Phase 1: MVP (Months 1-2)
- [ ] User authentication and authorization
- [ ] Audio file upload and storage
- [ ] Speech-to-text integration (Whisper)
- [ ] Basic transcription viewing
- [ ] Simple text editing

#### Phase 2: AI Processing (Months 2-3)
- [ ] Event extraction with Gemini
- [ ] Automatic categorization and tagging
- [ ] Context management system
- [ ] Writing style learning
- [ ] Timeline organization

#### Phase 3: Advanced Features (Months 3-4)
- [ ] Interactive editor with audio sync
- [ ] Chapter management and organization
- [ ] Book assembly and merging
- [ ] Multi-format export (PDF, EPUB, DOCX)
- [ ] Real-time collaboration

#### Phase 4: SaaS Features (Months 4-6)
- [ ] User settings and preferences
- [ ] Custom API key support
- [ ] Subscription management
- [ ] Template library
- [ ] Analytics dashboard

### Technical Improvements
- [ ] Comprehensive test coverage
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Monitoring and logging
- [ ] CI/CD pipeline
- [ ] Automated backups

---

## Version History

### Version Numbering

- **Major version** (X.0.0): Breaking changes
- **Minor version** (0.X.0): New features, backward compatible
- **Patch version** (0.0.X): Bug fixes, backward compatible

### Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

[Unreleased]: https://github.com/yourusername/ai-book-writer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/ai-book-writer/releases/tag/v1.0.0
