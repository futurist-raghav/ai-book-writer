# Development Setup Guide

This guide will help you set up the AI Book Writer development environment on your local machine.

## Prerequisites

### Required Software

- **Python 3.11+**: [Download](https://www.python.org/downloads/)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **PostgreSQL 15+**: [Download](https://www.postgresql.org/download/)
- **Redis**: [Download](https://redis.io/download)
- **Git**: [Download](https://git-scm.com/downloads)

### Optional but Recommended

- **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop)
- **VS Code**: [Download](https://code.visualstudio.com/)
- **Postman** or **Insomnia**: For API testing

### Required API Keys

1. **Google AI Studio Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Anthropic API Key** (optional): Get from [Anthropic Console](https://console.anthropic.com/)
3. **STT Endpoint**: Either a reachable Whisper VM URL (`WHISPER_VM_BASE_URL`) or an OpenAI API key (`OPENAI_API_KEY`)

---

## Quick Start with Docker (Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Clone repository
git clone https://github.com/RAWENTERISLIVE/ai-book-writer.git
cd ai-book-writer

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
nano .env  # or use your preferred editor

# Start all services
docker compose up -d

# Run database migrations
docker compose exec backend alembic upgrade head

# Create a test user (optional)
docker compose exec backend python scripts/create_user.py

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

That's it! Skip to [Testing the Setup](#testing-the-setup) section.

### High-Concurrency Mode (Production Runtime)

For load testing and production-like behavior, use the production compose stack:

```bash
# Uses docker-compose.prod.yml and non-dev runtimes
make start-prod

# Optional: scale API replicas
make scale-backend-prod REPLICAS=4

# View logs
make logs-prod
```

The production stack enables:

- Gunicorn + multiple Uvicorn workers (backend)
- Next.js standalone production server (frontend)
- Tuned PostgreSQL defaults for higher connection concurrency
- Tunable SQLAlchemy pool and Celery worker concurrency through `.env`

---

## Manual Setup (Without Docker)

If you prefer to run services directly on your machine:

### Step 1: Clone Repository

```bash
git clone https://github.com/RAWENTERISLIVE/ai-book-writer.git
cd ai-book-writer
```

### Step 2: Setup PostgreSQL

#### macOS (using Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database and user
psql postgres
```

```sql
CREATE DATABASE aibook;
CREATE USER aibook_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE aibook TO aibook_user;
\q
```

#### Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE aibook;
CREATE USER aibook_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE aibook TO aibook_user;
\q
```

#### Windows

1. Download and install PostgreSQL from [official website](https://www.postgresql.org/download/windows/)
2. Use pgAdmin to create database `aibook` and user `aibook_user`

### Step 3: Setup Redis

#### macOS

```bash
brew install redis
brew services start redis
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### Windows

Download and install from [Redis Windows](https://github.com/microsoftarchive/redis/releases)

### Step 4: Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
# Database
DATABASE_URL=postgresql://aibook_user:your_password@localhost:5432/aibook

# Redis
REDIS_URL=redis://localhost:6379

# AI Services
PREFERRED_STT_SERVICE=whisper_vm
STT_PROVIDER=whisper_vm
WHISPER_TIMEOUT_SECONDS=3600
WHISPER_VM_BASE_URL=http://35.200.193.248:9000
WHISPER_VM_MODEL_NAME=large-v3
WHISPER_VM_DEFAULT_TASK=transcribe
WHISPER_VM_OUTPUT_FORMAT=json
WHISPER_VM_ENCODE=true
WHISPER_VM_WORD_TIMESTAMPS=false

# Optional fallback when STT_PROVIDER=openai
OPENAI_API_KEY=your_openai_key_here
GOOGLE_GEMINI_API_KEY_1=your_google_ai_key_1_here
GOOGLE_GEMINI_API_KEY_2=your_google_ai_key_2_here
GOOGLE_GEMINI_API_KEY_3=your_google_ai_key_3_here
GOOGLE_GEMINI_MODEL=gemini-3-flash-preview
ANTHROPIC_API_KEY=your_anthropic_key_here

# App Configuration
SECRET_KEY=$(openssl rand -hex 32)
ENVIRONMENT=development
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000

# Storage
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage

# Logging
LOG_LEVEL=INFO
EOF

# Run database migrations
alembic upgrade head

# Create initial data (optional)
python scripts/seed_data.py
```

### Step 5: Setup ChromaDB (Vector Database)

```bash
# Install ChromaDB
pip install chromadb

# ChromaDB will automatically create a local database
# when the application starts
```

### Step 6: Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
EOF
```

### Step 7: Start Development Servers

Open 3 terminal windows:

**Terminal 1 - Backend API**:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Celery Worker**:
```bash
cd backend
source venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info
```

**Terminal 3 - Frontend**:
```bash
cd frontend
npm run dev
```

---

## Project Structure

```
ai-book-writer/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── audio.py
│   │   │       ├── events.py
│   │   │       └── ...
│   │   ├── core/              # Core configuration
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/            # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── audio.py
│   │   │   └── ...
│   │   ├── schemas/           # Pydantic schemas
│   │   │   ├── user.py
│   │   │   └── ...
│   │   ├── services/          # Business logic
│   │   │   ├── stt/          # Speech-to-text
│   │   │   ├── llm/          # LLM processing
│   │   │   ├── extraction/   # Event extraction
│   │   │   └── context/      # Context management
│   │   ├── tasks/            # Celery tasks
│   │   │   ├── transcription_tasks.py
│   │   │   └── extraction_tasks.py
│   │   └── utils/            # Utilities
│   ├── alembic/              # Database migrations
│   ├── scripts/              # Utility scripts
│   ├── tests/                # Tests
│   ├── requirements.txt
│   └── main.py
│
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/              # Next.js 14 app router
│   │   │   ├── page.tsx      # Home page
│   │   │   ├── dashboard/
│   │   │   ├── upload/
│   │   │   └── ...
│   │   ├── components/       # React components
│   │   │   ├── ui/          # UI components
│   │   │   ├── AudioUploader.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── ...
│   │   ├── lib/             # Utilities
│   │   │   ├── api.ts       # API client
│   │   │   └── utils.ts
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   └── useAudio.ts
│   │   └── types/           # TypeScript types
│   ├── public/              # Static assets
│   ├── package.json
│   └── next.config.js
│
├── docs/                     # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── SETUP.md
│
├── docker/                   # Docker files
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── Dockerfile.worker
│
├── .env.example             # Environment variables template
├── docker-compose.yml       # Docker Compose configuration
└── README.md               # Project overview
```

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aibook

# Redis
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY_1=AI...
GOOGLE_GEMINI_API_KEY_2=AI...
GOOGLE_GEMINI_API_KEY_3=AI...
GOOGLE_GEMINI_MODEL=gemini-3-flash-preview
ANTHROPIC_API_KEY=sk-ant-...

# App Configuration
SECRET_KEY=your-secret-key-here
ENVIRONMENT=development
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Storage
STORAGE_BACKEND=local  # or gcs, s3
LOCAL_STORAGE_PATH=./storage
GCS_BUCKET_NAME=your-bucket  # if using GCS
AWS_S3_BUCKET=your-bucket    # if using S3

# Logging
LOG_LEVEL=INFO

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# ChromaDB
CHROMA_PERSIST_DIRECTORY=./chroma_data
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

## Testing the Setup

### 1. Test Backend API

```bash
# Check API health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","version":"1.0.0"}

# View API documentation
open http://localhost:8000/docs
```

### 2. Test Database Connection

```bash
cd backend
source venv/bin/activate
python -c "from app.core.database import engine; print('Database connected!' if engine.connect() else 'Connection failed')"
```

### 3. Test Redis Connection

```bash
redis-cli ping
# Expected: PONG
```

### 4. Test Frontend

Open browser to `http://localhost:3000`

You should see the AI Book Writer landing page.

### 5. Create Test User

```bash
cd backend
python scripts/create_user.py \
  --email test@example.com \
  --password testpassword123 \
  --name "Test User"
```

### 6. Test Full Workflow

1. **Login**: Navigate to `/login` and use test credentials
2. **Upload Audio**: Go to `/upload` and upload a test audio file
3. **Check Processing**: Monitor the job status
4. **View Transcription**: Check the transcription page
5. **View Events**: See extracted events
6. **Create Chapter**: Organize events into a chapter
7. **Export**: Try exporting a test book

---

## Development Workflow

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

### Code Formatting

```bash
# Backend (Black + isort)
cd backend
black .
isort .

# Frontend (Prettier)
cd frontend
npm run format
```

### Linting

```bash
# Backend (Flake8)
cd backend
flake8 .

# Frontend (ESLint)
cd frontend
npm run lint
```

### Database Migrations

```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Adding Dependencies

```bash
# Backend
cd backend
pip install package-name
pip freeze > requirements.txt

# Frontend
cd frontend
npm install package-name
```

---

## Common Issues and Solutions

### Issue: Database connection refused

**Solution**:
```bash
# Check if PostgreSQL is running
# macOS:
brew services list
# Linux:
sudo systemctl status postgresql

# Restart PostgreSQL
# macOS:
brew services restart postgresql@15
# Linux:
sudo systemctl restart postgresql
```

### Issue: Redis connection refused

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
# macOS:
brew services start redis
# Linux:
sudo systemctl start redis
```

### Issue: Port already in use

**Solution**:
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
uvicorn app.main:app --port 8001
```

### Issue: Module not found errors

**Solution**:
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: Frontend not connecting to backend

**Solution**:
1. Check `NEXT_PUBLIC_API_URL` in `.env.local`
2. Ensure backend is running on correct port
3. Check CORS settings in backend
4. Clear browser cache

### Issue: Celery worker not processing tasks

**Solution**:
```bash
# Check Redis connection
redis-cli ping

# Restart Celery worker
# Stop with Ctrl+C, then:
celery -A app.tasks.celery_app worker --loglevel=debug

# Check task queue
celery -A app.tasks.celery_app inspect active
```

---

## IDE Setup

### VS Code

Recommended extensions:

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg"
  ]
}
```

Settings (`.vscode/settings.json`):

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Useful Commands

### Backend

```bash
# Start API server
uvicorn app.main:app --reload

# Start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# Start Celery beat (for scheduled tasks)
celery -A app.tasks.celery_app beat --loglevel=info

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Create database migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Format code
black . && isort .

# Lint code
flake8 .

# Type check
mypy .
```

### Frontend

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run type-check
```

### Docker

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Rebuild services
docker compose up -d --build

# Execute command in container
docker compose exec backend python manage.py shell

# Remove all containers and volumes
docker compose down -v
```

---

## Next Steps

1. **Read the Documentation**:
   - [API Documentation](./API.md)
   - [Architecture Overview](./ARCHITECTURE.md)
   - [Deployment Guide](./DEPLOYMENT.md)

2. **Explore the Code**:
   - Start with `backend/app/main.py`
   - Check out `frontend/src/app/page.tsx`
   - Review the API routes in `backend/app/api/v1/`

3. **Try the Features**:
   - Upload an audio file
   - View the transcription
   - Extract events
   - Create a chapter
   - Export a book

4. **Contribute**:
   - Check open issues
   - Submit pull requests
   - Improve documentation

---

## Getting Help

- **Documentation**: Check the `/docs` folder
- **Issues**: Open an issue on GitHub
- **Discussions**: Join GitHub Discussions
- **Email**: support@example.com

Happy coding! 🚀
