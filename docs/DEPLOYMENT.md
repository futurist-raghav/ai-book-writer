# Deployment Guide

This guide covers deploying AI Book Writer to various platforms. Choose the deployment option that best fits your needs and budget.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud Run + Firebase](#option-1-google-cloud-run--firebase-recommended)
3. [AWS App Runner + S3](#option-2-aws-app-runner--s3)
4. [Self-Hosted VPS](#option-3-self-hosted-vps)
5. [Docker Compose (Local/Development)](#option-4-docker-compose-localdevelopment)

---

## Prerequisites

### Required Accounts
- GitHub account (for code repository)
- Domain name (optional but recommended)
- AI Service API keys:
  - **Anthropic API key** (for Claude 3.5 Sonnet - REQUIRED)
  - OpenAI API key (for Whisper STT, optional if using Whisper VM)
  - Google AI Studio API key (for Gemini event extraction, optional)

### Required Tools
- Docker and Docker Compose
- Git
- Node.js 18+ (for frontend build)
- Python 3.11+ (for backend)

---

## Option 1: Google Cloud Run + Firebase (Recommended)

**Best for**: Low to medium traffic, easy scaling, minimal ops
**Estimated cost**: $20-50/month for moderate usage

### Step 1: Setup Google Cloud Project

```bash
# Install Google Cloud SDK
# macOS
brew install google-cloud-sdk

# Initialize gcloud
gcloud init

# Create new project
gcloud projects create ai-book-writer-prod --name="AI Book Writer"

# Set project
gcloud config set project ai-book-writer-prod

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage-api.googleapis.com \
  firebase.googleapis.com
```

### Step 2: Setup Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create aibook-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create aibook --instance=aibook-db

# Create user
gcloud sql users create aibook_user \
  --instance=aibook-db \
  --password=YOUR_USER_PASSWORD
```

### Step 3: Setup Cloud Storage

```bash
# Create bucket for audio files
gsutil mb -l us-central1 gs://ai-book-writer-audio

# Create bucket for exports
gsutil mb -l us-central1 gs://ai-book-writer-exports

# Set CORS for audio bucket
cat > cors.json << EOF
[
  {
    "origin": ["https://your-domain.com"],
    "method": ["GET", "HEAD", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://ai-book-writer-audio
```

### Step 4: Setup Redis (Memorystore)

```bash
# Create Redis instance
gcloud redis instances create aibook-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

### Step 5: Build and Deploy Backend

```bash
# Navigate to backend directory
cd backend

# Create .env.production
cat > .env.production << EOF
DATABASE_URL=postgresql://aibook_user:YOUR_USER_PASSWORD@/aibook?host=/cloudsql/ai-book-writer-prod:us-central1:aibook-db
REDIS_URL=redis://REDIS_IP:6379

# AI Services - Claude (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# STT Service (choose one approach)
# Option 1: Whisper VM
PREFERRED_STT_SERVICE=whisper_vm
WHISPER_VM_BASE_URL=http://whisper-ai-vm:9000
WHISPER_VM_MODEL_NAME=large-v3

# Option 2: OpenAI Whisper API
OPENAI_API_KEY=your_openai_key

# Optional: Google Gemini for event processing
GOOGLE_GEMINI_API_KEY_1=your_google_ai_key_1
GOOGLE_GEMINI_API_KEY_2=your_google_ai_key_2
GOOGLE_GEMINI_API_KEY_3=your_google_ai_key_3
GOOGLE_GEMINI_MODEL=gemini-3-flash-preview

# App Configuration
SECRET_KEY=$(openssl rand -hex 32)
ENVIRONMENT=production
GCS_BUCKET_NAME=ai-book-writer-audio
STORAGE_BACKEND=gcs
EOF

# Build and deploy to Cloud Run
gcloud run deploy aibook-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars-file .env.production \
  --add-cloudsql-instances ai-book-writer-prod:us-central1:aibook-db \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10

# Get backend URL
gcloud run services describe aibook-backend --region us-central1 --format 'value(status.url)'
```

### Step 6: Deploy Celery Workers

Create `Dockerfile.worker`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "app.tasks.celery_app", "worker", "--loglevel=info"]
```

Deploy worker:

```bash
gcloud run deploy aibook-worker \
  --source . \
  --dockerfile Dockerfile.worker \
  --platform managed \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars-file .env.production \
  --add-cloudsql-instances ai-book-writer-prod:us-central1:aibook-db \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 5
```

### Step 7: Setup Firebase

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project root
cd ..
firebase init

# Select:
# - Hosting
# - Use existing project: ai-book-writer-prod

# Configure firebase.json
cat > firebase.json << EOF
{
  "hosting": {
    "public": "frontend/out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "aibook-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
```

### Step 8: Build and Deploy Frontend

```bash
cd frontend

# Create .env.production
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://aibook-backend-xxxxx-uc.a.run.app/api/v1
NEXT_PUBLIC_WS_URL=wss://aibook-backend-xxxxx-uc.a.run.app/ws
EOF

# Build frontend
npm install
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

### Step 9: Setup Custom Domain (Optional)

```bash
# Add custom domain in Firebase Console
# Or use gcloud:
firebase hosting:channel:deploy production --expires 30d

# Configure DNS:
# Add A record: @ -> Firebase IP
# Add CNAME record: www -> your-app.web.app
```

### Step 10: Run Database Migrations

```bash
# Connect to Cloud SQL
gcloud sql connect aibook-db --user=aibook_user

# Or use Cloud SQL Proxy
cloud_sql_proxy -instances=ai-book-writer-prod:us-central1:aibook-db=tcp:5432

# Run migrations
cd backend
alembic upgrade head
```

---

## Option 2: AWS App Runner + S3

**Best for**: AWS ecosystem users
**Estimated cost**: $25-60/month

### Step 1: Setup AWS Resources

```bash
# Install AWS CLI
brew install awscli

# Configure AWS
aws configure

# Create S3 buckets
aws s3 mb s3://ai-book-writer-audio --region us-east-1
aws s3 mb s3://ai-book-writer-exports --region us-east-1

# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier aibook-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username aibook_admin \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --region us-east-1

# Create ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id aibook-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --region us-east-1
```

### Step 2: Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository --repository-name ai-book-writer-backend

# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### Step 3: Build and Push Docker Image

```bash
cd backend

# Build image
docker build -t ai-book-writer-backend .

# Tag image
docker tag ai-book-writer-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ai-book-writer-backend:latest

# Push image
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ai-book-writer-backend:latest
```

### Step 4: Create App Runner Service

```bash
# Create apprunner.yaml
cat > apprunner.yaml << EOF
version: 1.0
runtime: python311
build:
  commands:
    build:
      - pip install -r requirements.txt
run:
  command: uvicorn app.main:app --host 0.0.0.0 --port 8080
  network:
    port: 8080
  env:
    - name: DATABASE_URL
      value: postgresql://aibook_admin:YOUR_PASSWORD@aibook-db.xxxxx.us-east-1.rds.amazonaws.com:5432/aibook
    - name: REDIS_URL
      value: redis://aibook-redis.xxxxx.cache.amazonaws.com:6379
    - name: AWS_S3_BUCKET
      value: ai-book-writer-audio
    - name: STORAGE_BACKEND
      value: s3
EOF

# Create service
aws apprunner create-service \
  --service-name aibook-backend \
  --source-configuration file://apprunner.yaml \
  --instance-configuration Cpu=1024,Memory=2048 \
  --region us-east-1
```

### Step 5: Deploy Frontend to Vercel/Netlify

```bash
# Using Vercel
cd frontend
npm install -g vercel
vercel --prod

# Or using Netlify
npm install -g netlify-cli
netlify deploy --prod
```

---

## Option 3: Self-Hosted VPS

**Best for**: Maximum control, cost optimization
**Estimated cost**: $20-40/month (Hetzner, DigitalOcean, Linode)

### Step 1: Provision VPS

- Recommended specs: 4 vCPU, 8GB RAM, 160GB SSD
- Ubuntu 22.04 LTS
- Providers: Hetzner ($20/mo), DigitalOcean ($48/mo), Linode ($36/mo)

### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app user
adduser aibook
usermod -aG docker aibook
su - aibook
```

### Step 3: Clone Repository

```bash
cd ~
git clone https://github.com/yourusername/ai-book-writer.git
cd ai-book-writer
```

### Step 4: Configure Environment

```bash
# Create .env file
cat > .env << EOF
# Database
POSTGRES_USER=aibook
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=aibook
DATABASE_URL=postgresql://aibook:${POSTGRES_PASSWORD}@postgres:5432/aibook

# Redis
REDIS_URL=redis://redis:6379

# AI Services
OPENAI_API_KEY=your_openai_key
GOOGLE_GEMINI_API_KEY_1=your_google_ai_key_1
GOOGLE_GEMINI_API_KEY_2=your_google_ai_key_2
GOOGLE_GEMINI_API_KEY_3=your_google_ai_key_3
GOOGLE_GEMINI_MODEL=gemini-3-flash-preview
ANTHROPIC_API_KEY=your_anthropic_key

# App
SECRET_KEY=$(openssl rand -hex 32)
ENVIRONMENT=production
STORAGE_BACKEND=local
ALLOWED_ORIGINS=https://your-domain.com

# Frontend
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
EOF
```

### Step 5: Create Docker Compose File

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  chromadb:
    image: chromadb/chroma:latest
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    depends_on:
      - postgres
      - redis
      - chromadb
    volumes:
      - ./storage:/app/storage
    restart: unless-stopped

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    env_file: .env
    depends_on:
      - postgres
      - redis
      - chromadb
    volumes:
      - ./storage:/app/storage
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    env_file: .env
    depends_on:
      - backend
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  postgres_data:
  chroma_data:
  caddy_data:
  caddy_config:
```

### Step 6: Create Caddyfile

```caddyfile
your-domain.com {
    # Frontend
    reverse_proxy frontend:3000

    # Backend API
    handle /api/* {
        reverse_proxy backend:8000
    }

    # WebSocket
    handle /ws {
        reverse_proxy backend:8000
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
    }

    # Gzip compression
    encode gzip

    # Logs
    log {
        output file /var/log/caddy/access.log
    }
}
```

### Step 7: Deploy

```bash
# Build and start services
docker compose up -d

# Run migrations
docker compose exec backend alembic upgrade head

# Check logs
docker compose logs -f

# Check status
docker compose ps
```

### Step 8: Setup Backups

```bash
# Create backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker compose exec -T postgres pg_dump -U aibook aibook | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup storage
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz ./storage

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup.sh") | crontab -
```

---

## Option 4: Docker Compose (Local/Development)

**Best for**: Development, testing
**Estimated cost**: $0 (runs on your machine)

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/ai-book-writer.git
cd ai-book-writer

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
nano .env

# Start all services
docker compose up -d

# Run migrations
docker compose exec backend alembic upgrade head

# View logs
docker compose logs -f

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Development Workflow

```bash
# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View specific service logs
docker compose logs -f backend

# Execute commands in container
docker compose exec backend python manage.py shell

# Reset database
docker compose down -v
docker compose up -d
docker compose exec backend alembic upgrade head
```

---

## Option 5: Docker Compose (Production Runtime, High Concurrency)

**Best for**: Single-host production, staging, realistic load tests
**Estimated cost**: Infrastructure-dependent

This mode uses `docker-compose.prod.yml`, which switches backend/frontend from dev mode to production runtimes and enables tunable DB/worker concurrency.

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/ai-book-writer.git
cd ai-book-writer

# Copy environment file
cp .env.example .env

# Edit .env (especially concurrency and DB settings)
nano .env

# Start high-concurrency stack
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Optional: scale backend replicas
docker compose -f docker-compose.prod.yml up -d --scale backend=4
```

### Recommended Baseline for 10K user target

- `WEB_CONCURRENCY=4`
- `DB_POOL_SIZE=20`
- `DB_MAX_OVERFLOW=40`
- `POSTGRES_MAX_CONNECTIONS=600`
- `CELERY_CONCURRENCY=8`

Adjust these based on host CPU/RAM and request profile.

---

## Post-Deployment Checklist

- [ ] Test user registration and login
- [ ] Upload test audio file
- [ ] Verify transcription works
- [ ] Check event extraction
- [ ] Test book export
- [ ] Configure monitoring and alerts
- [ ] Setup automated backups
- [ ] Configure custom domain and SSL
- [ ] Test all API endpoints
- [ ] Load test with expected traffic
- [ ] Setup error tracking (Sentry)
- [ ] Configure analytics
- [ ] Document deployment process
- [ ] Create runbook for common issues

## Monitoring

### Google Cloud

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# View metrics
gcloud monitoring dashboards list
```

### Self-Hosted

```bash
# View container logs
docker compose logs -f

# Monitor resource usage
docker stats

# Check disk usage
df -h
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
docker compose exec backend python -c "from app.core.database import engine; print(engine.connect())"

# Check database logs
docker compose logs postgres
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose logs worker

# Check Redis connection
docker compose exec backend python -c "import redis; r = redis.from_url('redis://redis:6379'); print(r.ping())"

# Restart worker
docker compose restart worker
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
# Add under service:
#   deploy:
#     resources:
#       limits:
#         memory: 4G
```

## Scaling

### Horizontal Scaling (Cloud Run/App Runner)

- Automatically scales based on traffic
- Configure min/max instances
- Monitor costs and adjust

### Vertical Scaling (Self-Hosted)

```bash
# Upgrade VPS plan
# Or add more resources to docker-compose.yml

# Increase worker concurrency
# In docker-compose.yml:
# command: celery -A app.tasks.celery_app worker --concurrency=8
```

## Security Hardening

1. **Enable firewall**:
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

2. **Setup fail2ban**:
```bash
apt install fail2ban
systemctl enable fail2ban
```

3. **Regular updates**:
```bash
apt update && apt upgrade -y
docker compose pull
docker compose up -d
```

4. **Secrets management**:
- Use cloud secret managers (Google Secret Manager, AWS Secrets Manager)
- Never commit secrets to git
- Rotate API keys regularly

## Cost Optimization

1. **Use cheaper AI models** for non-critical tasks
2. **Enable caching** for repeated requests
3. **Auto-scale down** during low traffic
4. **Use spot instances** for workers
5. **Compress and archive** old data
6. **Monitor and alert** on unusual spending

---

For questions or issues, please open an issue on GitHub or contact support.
