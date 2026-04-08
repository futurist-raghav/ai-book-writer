# AI Book Writer

> Transform your voice recordings into professionally formatted books using AI

## 📖 Overview

AI Book Writer is an intelligent platform that converts voice recordings of life events, stories, and daily experiences into well-structured book content. Whether you're writing your memoir, documenting your journey, or helping other writers streamline their creative process, this tool leverages cutting-edge AI to handle transcription, context management, and narrative formatting.

### Key Features

- **🧠 Unified Context Model**: Single data store connecting all features - when you update a character, all chapters see it instantly
- **✍️ Professional Writer Canvas**: Tiptap-based rich text editor with tables, images, code blocks, and real-time syncing
- **🤖 Context-Aware AI Assistant**: Claude 3.5 Sonnet with full project awareness - understands your genre, tone, characters, and story world
- **🎙️ Voice-to-Text Processing**: Whisper API transcription with STT auto-organization into chapters
- **🔗 Bidirectional Entity Linking**: Characters, world elements, and events automatically connected across chapters
- **📖 Chapter-Level AI Chat**: Request rewrites, dialogue help, and style guidance while preserving your intent
- **⚡ Auto-Save & Real-Time Updates**: All changes sync instantly to the backend - no manual saving needed
- **🎬 Smart Document Management**: Organize content by events, timelines, themes, and characters
- **📤 Multi-Format Export**: PDF, EPUB, DOCX with professional formatting
- **🎨 Custom Writing Profiles**: Create style presets for different writing voices and contexts

## 🎯 Use Cases

1. **Personal Memoir Writing**: Document your life story (e.g., "My First 18 Years")
2. **Daily Journaling**: Convert voice diary entries into structured narratives
3. **Writer's Tool**: Professional platform for authors who prefer dictation
4. **Story Collection**: Organize random events and anecdotes into coherent books

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Frontend - Next.js"
        STATE["Project Context Store<br/>(useProjectContext)"]
        WC["WriterCanvas<br/>(Tiptap)"]
        AI["AI Assistant<br/>(Claude)"]
        CHARS["Characters"]
        WORLD["World Building"]
        EVENTS["Events"]
        AUDIO["Audio Notes"]
    end
    
    subgraph "Backend - FastAPI"
        API["REST API"]
        AUTH["Auth Service"]
        AIZ["AI Service<br/>(Claude 3.5)"]
        STT["STT Service<br/>(Whisper)"]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
        STORAGE["Cloud Storage"]
    end
    
    STATE -->|writes to| WC
    STATE -->|writes to| AI
    STATE -->|writes to| CHARS
    STATE -->|writes to| WORLD
    STATE -->|writes to| EVENTS
    STATE -->|writes to| AUDIO
    
    WC -->|updates| STATE
    CHARS -->|updates| STATE
    WORLD -->|updates| STATE
    EVENTS -->|updates| STATE
    AUDIO -->|updates| STATE
    
    AI -->|reads context| STATE
    AI -->|calls| AIZ
    AUDIO -->|calls| STT
    
    STATE -->|auto-syncs| API
    API -->|syncs| DB
    AUDIO -->|uploads| STORAGE
    AUTH -->|manages| DB
```

**Key Insight**: All UI features share a single context store. Changes to characters instantly propagate to the AI assistant and all chapters. The backend stays in sync automatically.

## 🚀 Technology Stack

### Frontend Stack
- **Next.js 14+**: React framework with server-side rendering
- **React Query + Zustand**: Server and client state management  
- **Tiptap 3**: Professional rich text editor (ProseMirror-based)
- **Tailwind CSS**: Utility-first styling

### Core AI Services

#### AI Assistant & Writing Support
**Claude 3.5 Sonnet** (Anthropic) ⭐ **PRIMARY**
- **Cost**: $3.00/M input, $15.00/M output tokens
- **Why**: Best prose generation, style adherence, complex reasoning
- **Features**: 
  - Full project context awareness
  - Character and world consistency
  - Dialogue and scene assistance
  - Style guide generation

#### Speech-to-Text (STT)
**Whisper Large V3** (OpenAI)
- **Cost**: $0.006/minute API or free if self-hosted
- **Accuracy**: Best-in-class for multilingual, accents, technical vocabulary
- **Options**: 
  - Use OpenAI API for simplicity
  - Self-host Whisper VM for privacy and cost savings

#### Event Extraction & Processing
**Google Gemini 3 Flash** (optional, for bulk processing)
- **Cost**: $0.50/M input, $3.00/M output tokens
- **Why**: Excellent cost-performance, good for structured extraction

### Backend Stack
- **FastAPI**: Modern Python web framework with async support
- **PostgreSQL 15+**: Relational database for project data
- **Redis**: Caching and job queue
- **SQLAlchemy**: ORM with async support

### Deployment
- **Recommended**: Docker + Google Cloud Run (or any container orchestrator)
- **Database**: Google Cloud SQL or managed PostgreSQL
- **Storage**: Google Cloud Storage (or AWS S3)
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Quick Start (Docker)
```bash
# Clone the repo
git clone https://github.com/futurist-raghav/ai-book-writer.git
cd ai-book-writer

# Copy environment template
cp .env.example .env

# Add your API keys
# - ANTHROPIC_API_KEY (required for Claude)
# - OPENAI_API_KEY or WHISPER_VM_BASE_URL (choose STT method)
nano .env

# Start everything
docker compose up -d

# Run migrations
docker compose exec backend alembic upgrade head

# Access the app
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Deep dive into the unified context model
- **[Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)** - What's built and how to use it
- **[API Documentation](docs/API.md)** - Complete API reference with AI endpoints
- **[Setup Guide](docs/SETUP.md)** - Local development setup
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment options

#### Vector Database
**Primary: ChromaDB (Self-Hosted)**
- **Cost**: Free (self-hosted) or ~$20/month for small VPS
- **Why**: Perfect for development and small-to-medium scale, easy Python integration
- **Use Cases**: Context storage, writing style patterns, event relationships

**Alternative: Qdrant (Self-Hosted)**
- **Cost**: Free (self-hosted)
- **Why**: Better performance at scale, excellent filtering capabilities
- **When to Upgrade**: When user base grows beyond 10K users

### Backend Stack

**Framework: FastAPI (Python)**
- Fast, modern, async support
- Excellent for AI/ML integration
- Auto-generated API documentation
- Type hints and validation

**Database: PostgreSQL**
- Robust relational data storage
- pgvector extension for vector operations (alternative to separate vector DB)
- JSON support for flexible schemas

**File Storage**
- **Development**: Local filesystem
- **Production**: 
  - Google Cloud Storage (integrated with Cloud Run)
  - AWS S3 (if using AWS infrastructure)

**Task Queue: Celery + Redis**
- Async processing for long-running AI tasks
- Reliable job management
- Progress tracking

### Frontend Stack

**Framework: Next.js 14+ (React)**
- Server-side rendering for SEO
- API routes for backend integration
- Excellent developer experience
- Built-in optimization

**UI Components**
- **Styling**: Tailwind CSS (rapid development)
- **Audio Player**: Wavesurfer.js or React-H5-Audio-Player
- **Rich Text Editor**: Tiptap or Lexical
- **PDF Viewer**: react-pdf

**State Management**: Zustand or React Query

### Deployment Options

#### Recommended: Google Cloud Run + Firebase
**Cost**: ~$20-50/month for moderate usage
- **Cloud Run**: Containerized backend, auto-scaling ($0.00002400/vCPU-second)
- **Firebase Hosting**: Frontend static files (free tier: 10GB storage, 360MB/day transfer)
- **Firebase Auth**: User authentication (free tier: unlimited)
- **Cloud Storage**: Audio/document files
- **Why**: Best balance of cost, scalability, and ease of deployment

#### Alternative 1: AWS App Runner + S3
**Cost**: ~$25-60/month
- **App Runner**: Similar to Cloud Run
- **S3**: File storage
- **RDS**: Managed PostgreSQL
- **Why**: Good if already in AWS ecosystem

#### Alternative 2: Self-Hosted (VPS)
**Cost**: ~$20-40/month (Hetzner, DigitalOcean, Linode)
- **Docker Compose**: All services containerized
- **Caddy**: Reverse proxy with auto-SSL
- **Why**: Maximum cost control, full ownership

#### Alternative 3: Hybrid (Vercel + Backend elsewhere)
**Cost**: ~$20-50/month
- **Vercel**: Frontend only (free tier available)
- **Cloud Run/App Runner**: Backend
- **Why**: Excellent frontend performance, separate scaling

## 💰 Cost Optimization Strategy

### For Personal Use (Your Memoir)
- **Estimated Monthly Cost**: $5-15
- Use Whisper API for transcription
- Use Gemini Flash for processing
- Self-host ChromaDB
- Deploy on Cloud Run (likely stays in free tier)
- Store files in Cloud Storage (free tier: 5GB)

### For SaaS Product (100 users, avg 10 hours audio/user/month)
- **Estimated Monthly Cost**: $200-400
- **Breakdown**:
  - Whisper API: ~$360 (100 users × 10 hours × 60 min × $0.006)
  - Gemini Flash: ~$50-100 (processing)
  - Cloud Run: ~$50-100 (compute)
  - Storage: ~$20-30
  - Database: ~$25 (Cloud SQL or managed PostgreSQL)

### Cost Reduction Tips
1. **Batch Processing**: Process multiple files together
2. **Caching**: Cache AI responses for similar queries
3. **Tiered Plans**: Free tier with limited hours, paid for more
4. **User API Keys**: Let power users bring their own API keys
5. **Local Models**: Offer option to use local Whisper for privacy-conscious users

## 🔧 Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis (for task queue)
- Docker (optional, recommended)

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/ai-book-writer.git
cd ai-book-writer

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload

# Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev
```

### High-Concurrency Docker Mode (10K+ users target)

Use the production stack for realistic concurrency/load testing. The default `docker-compose.yml` is development-focused and uses hot reload.

```bash
# 1) Copy and edit environment
cp .env.example .env

# 2) Start production stack
make start-prod

# 3) Scale backend replicas (example: 4 API replicas)
make scale-backend-prod REPLICAS=4

# 4) Watch production logs
make logs-prod
```

Recommended baseline before load testing:

- `WEB_CONCURRENCY=4`
- `DB_POOL_SIZE=20`
- `DB_MAX_OVERFLOW=40`
- `POSTGRES_MAX_CONNECTIONS=600`
- `CELERY_CONCURRENCY=8`

Tune these in `.env` based on CPU/RAM and expected request mix.

### Environment Variables

```bash
# AI Services
OPENAI_API_KEY=your_openai_key
GOOGLE_GEMINI_API_KEY_1=your_google_ai_key_1
GOOGLE_GEMINI_API_KEY_2=your_google_ai_key_2
GOOGLE_GEMINI_API_KEY_3=your_google_ai_key_3
GOOGLE_GEMINI_MODEL=gemini-3-flash-preview
ANTHROPIC_API_KEY=your_anthropic_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aibook
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_BACKEND=local  # or gcs, s3
GCS_BUCKET_NAME=your-bucket
AWS_S3_BUCKET=your-bucket

# App Config
SECRET_KEY=your-secret-key
ENVIRONMENT=development
```

## 📚 Project Structure

```
ai-book-writer/
├── backend/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── core/             # Config, security
│   │   ├── models/           # Database models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   │   ├── stt/          # Speech-to-text
│   │   │   ├── llm/          # LLM processing
│   │   │   ├── extraction/   # Event extraction
│   │   │   └── context/      # Context management
│   │   ├── tasks/            # Celery tasks
│   │   └── utils/            # Utilities
│   ├── alembic/              # DB migrations
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities
│   │   ├── hooks/            # Custom hooks
│   │   └── types/            # TypeScript types
│   ├── public/
│   └── package.json
├── docs/
│   ├── API.md                # API documentation
│   ├── ARCHITECTURE.md       # Architecture details
│   ├── DEPLOYMENT.md         # Deployment guide
│   └── USER_GUIDE.md         # User documentation
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
└── README.md
```

## 🎨 User Workflow

1. **Sign Up & Profile Setup**
   - Create account
   - Configure writing style preferences
   - Set up context (how you narrate, writing format, etc.)

2. **Upload Audio**
   - Upload voice recordings (MP3, WAV, M4A)
   - Add metadata (date, topic, tags)

3. **AI Processing**
   - Automatic transcription
   - Event extraction and categorization
   - Style-based formatting
   - Timeline organization

4. **Review & Edit**
   - View transcription alongside audio
   - Correct any AI errors
   - Refine event categorization
   - Adjust formatting

5. **Organize & Structure**
   - Arrange events chronologically or thematically
   - Create chapters and sections
   - Merge related events

6. **Final Assembly**
   - Combine chapters into complete manuscript
   - Apply consistent formatting
   - Generate table of contents
   - Add metadata (title, author, etc.)

7. **Export & Publish**
   - Export to PDF, EPUB, DOCX
   - Format for specific publishers
   - Download or share

## 🔐 Security & Privacy

- **End-to-end encryption** for audio files in transit
- **User data isolation** - each user's data is completely separate
- **API key security** - user-provided keys are encrypted at rest
- **GDPR compliance** - right to deletion, data export
- **Audio retention policy** - configurable auto-deletion after processing

## 🚢 Deployment Guide

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions for:
- Google Cloud Run + Firebase
- AWS App Runner + S3
- Self-hosted VPS
- Docker Compose

## 📊 Monitoring & Analytics

- **Application Monitoring**: Google Cloud Monitoring / AWS CloudWatch
- **Error Tracking**: Sentry
- **Usage Analytics**: PostHog (self-hosted) or Mixpanel
- **Cost Tracking**: Cloud provider billing alerts

## 🛣️ Roadmap

### Phase 1: MVP (Months 1-2)
- [x] Project setup and architecture
- [x] Basic audio upload and storage
- [x] Whisper integration for STT
- [x] Simple text display and editing
- [x] User authentication

### Phase 2: AI Processing (Months 2-3)
- [x] Event extraction with Gemini
- [ ] Context management system
- [ ] Writing style learning
- [ ] Timeline organization

### Phase 3: Advanced Features (Months 3-4)
- [ ] Interactive editor with audio sync
- [x] Chapter management
- [x] Book assembly and merging
- [x] Multi-format export

### Phase 4: SaaS Features (Months 4-6)
- [x] User settings and preferences
- [ ] Custom API key support
- [ ] Subscription management
- [ ] Collaboration features
- [ ] Template library

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📧 Contact

For questions or support, please open an issue or contact [your-email@example.com]

---

**Built with ❤️ for writers who prefer to speak their stories**
# ai-book-writer
