# AI Book Writer

> Transform your voice recordings into professionally formatted books using AI

## 📖 Overview

AI Book Writer is an intelligent platform that converts voice recordings of life events, stories, and daily experiences into well-structured book content. Whether you're writing your memoir, documenting your journey, or helping other writers streamline their creative process, this tool leverages cutting-edge AI to handle transcription, context management, and narrative formatting.

### Key Features

- **Voice-to-Text Processing**: Upload audio recordings and let AI transcribe with high accuracy
- **Intelligent Event Extraction**: Automatically identifies and categorizes events, stories, and themes
- **Context-Aware Formatting**: Learns your writing style and narrative preferences
- **Smart Document Management**: Organizes content by events, timelines, and themes
- **Interactive Editor**: Review AI-generated content with synchronized audio playback
- **Human-in-the-Loop**: Easy correction and refinement of AI extractions
- **Book Assembly**: Combine and merge chapters into a final publishable manuscript
- **Multi-Format Export**: Export to various formats (PDF, EPUB, DOCX, etc.)
- **Custom Writing Profiles**: Create presets for different writing styles and contexts

## 🎯 Use Cases

1. **Personal Memoir Writing**: Document your life story (e.g., "My First 18 Years")
2. **Daily Journaling**: Convert voice diary entries into structured narratives
3. **Writer's Tool**: Professional platform for authors who prefer dictation
4. **Story Collection**: Organize random events and anecdotes into coherent books

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Web Interface]
        Editor[Document Editor]
        Audio[Audio Player]
    end
    
    subgraph "Backend Services"
        API[REST API]
        Upload[File Upload Service]
        Queue[Job Queue]
    end
    
    subgraph "AI Processing Pipeline"
        STT[Speech-to-Text]
        LLM[Text Processing & Formatting]
        Extract[Event Extraction]
        Context[Context Manager]
    end
    
    subgraph "Storage Layer"
        Files[File Storage]
        DB[(PostgreSQL)]
        Vector[(Vector DB)]
    end
    
    UI --> API
    Editor --> API
    Audio --> Files
    API --> Upload
    Upload --> Queue
    Queue --> STT
    STT --> LLM
    LLM --> Extract
    Extract --> Context
    Context --> Vector
    API --> DB
    API --> Files
    API --> Vector
```

## 🚀 Technology Stack

### Recommended AI Models & Services

#### Speech-to-Text (STT)
**Primary: OpenAI Whisper API**
- **Cost**: $0.006/minute (standard) or $0.003/minute (GPT-4o Mini)
- **Accuracy**: Industry-leading, especially for multilingual and noisy environments
- **Why**: Best balance of cost, accuracy, and ease of integration
- **Alternative**: Google Cloud Speech-to-Text V2 ($0.016/min, 60 min free/month)

#### Text Generation & Processing
**Primary: Google Gemini 3 Flash**
- **Cost**: $0.50/M input tokens, $3.00/M output tokens
- **Context Window**: Up to 1M tokens
- **Why**: Excellent cost-performance ratio, large context for processing long narratives
- **Use Cases**: Event extraction, text formatting, style learning

**Secondary: Claude 4.5 Sonnet**
- **Cost**: $3.00/M input, $15.00/M output
- **Context Window**: 200K-400K tokens
- **Why**: Superior reasoning for complex narrative structuring and coherence
- **Use Cases**: Final book assembly, quality refinement, complex editing

**Tertiary: GPT-5.2 (Optional)**
- **Cost**: $1.75/M input, $14.00/M output
- **Why**: Best for creative writing and natural narrative flow
- **Use Cases**: Creative enhancement, style adaptation

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

### Environment Variables

```bash
# AI Services
OPENAI_API_KEY=your_openai_key
GOOGLE_AI_API_KEY=your_google_ai_key
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
- [ ] Basic audio upload and storage
- [ ] Whisper integration for STT
- [ ] Simple text display and editing
- [ ] User authentication

### Phase 2: AI Processing (Months 2-3)
- [ ] Event extraction with Gemini
- [ ] Context management system
- [ ] Writing style learning
- [ ] Timeline organization

### Phase 3: Advanced Features (Months 3-4)
- [ ] Interactive editor with audio sync
- [ ] Chapter management
- [ ] Book assembly and merging
- [ ] Multi-format export

### Phase 4: SaaS Features (Months 4-6)
- [ ] User settings and preferences
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
