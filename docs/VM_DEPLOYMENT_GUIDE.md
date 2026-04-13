# Scribe House - VM Deployment Guide

## Architecture Overview

The Scribe House system has been consolidated to a **single VM instance deployment** where all backend components run together:

```
┌─────────────────────────────────────────────────────────┐
│             GCP VM Instance (ai-book-writer)             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  FastAPI Backend (Gunicorn)                       │   │
│  │  - Port 8000: REST API                            │   │
│  │  - /api/v1/* routes                               │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  PostgreSQL 15                                    │   │
│  │  - Port 5432 (internal only)                      │   │
│  │  - Primary data storage                           │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Redis 7                                          │   │
│  │  - Port 6379 (internal only)                      │   │
│  │  - Cache & task queue                             │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Ollama (Gemma 4 Model)                           │   │
│  │  - Port 11434 (internal only)                     │   │
│  │  - LLM inference for STT/content generation       │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  File Storage (/home/ai_book_writer_storage)     │   │
│  │  - Book covers, document uploads, exports         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                   (HTTP:8000 exposed)
                            │
┌─────────────────────────────────────────────────────────┐
│   Cloudflare Pages Frontend (scribe-house-frontend)      │
│  - Next.js static/hybrid rendering                       │
│  - Calls backend at http://VM_IP:8000/api/v1            │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. GCP Setup
- Compute Engine VM instance: `ai-book-writer` in `asia-south1-c` zone
- VM must have:
  - Public IP address (for frontend to reach API)
  - 4+ vCPU, 8GB+ RAM recommended
  - Persistent 50GB+ disk
  - Access via `gcloud compute ssh`

### 2. Install gcloud CLI
```bash
# macOS
brew install google-cloud-sdk

# Linux/WSL
curl https://sdk.cloud.google.com | bash
```

### 3. Authenticate with GCP
```bash
gcloud auth login
gcloud config set project ai-book-writer-raghav
```

### 4. Have Backend Code Ready
```bash
cd /Users/raghav/Projects/AI-Book-Writer
git pull origin main
```

---

## Quick Manual Deployment (If Automated Script Fails)

If `make deploy-vm` encounters GCP authentication errors, use this simpler approach:

```bash
# Step 1: Upload backend code to VM
gcloud compute scp \
  --recurse \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav \
  ./backend \
  ai-book-writer:/tmp/scribe-house-backend

# Step 2: Connect and deploy
gcloud compute ssh ai-book-writer --zone=asia-south1-c --project=ai-book-writer-raghav
# Once connected to VM:
bash /tmp/scribe-house-backend/deploy-vm.sh

# Step 3: Verify (on VM)
curl http://127.0.0.1:8000/health

# Step 4: Deploy frontend (back on your local machine)
make deploy-vm-frontend VM_IP=35.200.193.248
```

**See [MANUAL_DEPLOYMENT.md](../../MANUAL_DEPLOYMENT.md) for detailed troubleshooting.**

---

## Full Stack Deployment (Automated)

Deploy everything in one command:

```bash
make deploy-vm \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

This executes:
1. **Backend** → Code copied to VM, migrations run, service restarted
2. **Frontend** → Built locally, deployed to Cloudflare Pages

**Output:**
```
✅ Full VM deployment complete!

Your Scribe House instance is now running:
  Backend API: http://34.x.x.x:8000
  API Docs: http://34.x.x.x:8000/docs
  Frontend: https://scribe-house-frontend.pages.dev
```

---

## Partial Deployments

### Deploy Backend Only (Code Updates)

When you've made changes to FastAPI code only:

```bash
make deploy-vm-backend \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

This:
- Copies new backend code to VM
- Runs pending migrations
- Restarts the backend service

### Deploy Frontend Only (Connect to Existing VM)

When the backend is already running and you only need to update the frontend:

```bash
make deploy-vm-frontend VM_IP=34.x.x.x
```

This:
- Updates `frontend/.env.production` with VM IP
- Builds Next.js app
- Deploys to Cloudflare Pages

---

## Finding Your VM IP

### Option 1: From GCP Console
```bash
gcloud compute instances list --project=ai-book-writer-raghav
```

Look for the `EXTERNAL_IP` column.

### Option 2: From gcloud CLI
```bash
gcloud compute instances describe ai-book-writer \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## Monitoring & Troubleshooting

### View Backend Logs
```bash
make vm-logs \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

Real-time logs from the backend service.

### Check Backend Health
```bash
make vm-status \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

Shows:
- Service status (Active/Inactive)
- Health check response
- Running processes

### Manual SSH Access
```bash
gcloud compute ssh ai-book-writer \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav
```

Once connected to VM:

```bash
# View backend logs
sudo journalctl -u aiwriter-backend -f

# Check service status
sudo systemctl status aiwriter-backend

# Health check
curl http://127.0.0.1:8000/health | jq

# Database status
sudo -u postgres psql -c "SELECT version();"

# Redis status
redis-cli ping

# Ollama status
curl http://127.0.0.1:11434/api/tags | jq
```

### Common Issues

**Backend won't start:**
```bash
# Check systemd logs
sudo journalctl -u aiwriter-backend -n 50

# Check if port 8000 is in use
sudo lsof -i :8000

# Manual restart
sudo systemctl restart aiwriter-backend
```

**Database connection fails:**
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -l

# Check DATABASE_URL in service file
sudo cat /etc/systemd/system/aiwriter-backend.service | grep DATABASE_URL
```

**Frontend can't reach backend:**
- Verify frontend env: Check `frontend/.env.production` has correct VM IP
- Test connectivity from your machine: `curl http://VM_IP:8000/health`
- Check firewall: GCP VM should allow inbound traffic on port 8000
- Check CORS: Backend ALLOWED_ORIGINS must include Cloudflare Pages domain

---

## Backend Service Management

### Start Backend
```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo systemctl start aiwriter-backend"
```

### Stop Backend
```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo systemctl stop aiwriter-backend"
```

### Restart Backend
```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo systemctl restart aiwriter-backend"
```

### Enable Auto-start on VM Boot
```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo systemctl enable aiwriter-backend"
```

---

## Frontend Configuration

### Environment Variables

The frontend uses `NEXT_PUBLIC_API_URL` to locate the backend:

**Local Development (`frontend/.env`):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**VM Deployment (`frontend/.env.production`):**
```
NEXT_PUBLIC_API_URL=http://34.x.x.x:8000/api/v1
```

**Production with Custom Domain:**
```
NEXT_PUBLIC_API_URL=https://api.scribehouse.raghavagarwal.com/api/v1
```

The `make deploy-vm-frontend` command automatically sets this.

### Deploying to Cloudflare Pages

```bash
# Build locally
npm --prefix frontend run build

# Deploy manually
(cd frontend && npx @cloudflare/next-on-pages)
(cd frontend && npx wrangler pages deploy .vercel/output/static \
  --project-name scribe-house-frontend)
```

---

## Database Migrations

Migrations run automatically during deployment, but you can run them manually:

```bash
# On VM
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="source /opt/scribe-house/venv/bin/activate && \
             cd /opt/scribe-house && \
             alembic upgrade head"
```

---

## Adding Environment Variables

Update the systemd service file on the VM:

```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo nano /etc/systemd/system/aiwriter-backend.service"
```

Edit the `Environment=` lines, then:

```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo systemctl daemon-reload && \
             sudo systemctl restart aiwriter-backend"
```

---

## Backup & Recovery

### Backup Database
```bash
gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo -u postgres pg_dump aibook > /tmp/backup.sql"

gcloud compute scp ai-book-writer:/tmp/backup.sql \
  --zone=asia-south1-c \
  ./backups/db_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
gcloud compute scp ./backups/backup.sql \
  ai-book-writer:/tmp/backup.sql \
  --zone=asia-south1-c

gcloud compute ssh ai-book-writer --zone=asia-south1-c \
  --command="sudo -u postgres psql aibook < /tmp/backup.sql"
```

---

## Scaling Considerations

**Current Setup (Single VM):**
- Suitable for: Small to medium traffic (~1000s of users)
- Benefits: Simplified architecture, lower costs, easier maintenance
- Limitations: Single point of failure, shared resources

**For Higher Traffic:**
1. Increase VM size (memory, CPU)
2. Scale Redis on separate VM
3. Replicate PostgreSQL for HA
4. Load-balance multiple API instances

---

## Cost Optimization

**Current Single VM (~$200-300/month):**
- n1-standard-4 (4 vCPU, 15GB RAM)
- 100GB persistent disk
- Public IP address

**Reduce Costs:**
- Use smaller VM (n1-standard-2) for less traffic: ~$100/month
- Delete snapshots/old disks in GCP console
- Use preemptible VMs for test/staging: ~50% discount

---

## Next Steps

1. **Run full deployment:**
   ```bash
   make deploy-vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x
   ```

2. **Test the API:**
   ```bash
   curl http://34.x.x.x:8000/health
   ```

3. **Visit Cloudflare Pages frontend:**
   ```
   https://scribe-house-frontend.pages.dev
   ```

4. **Create admin account:**
   ```bash
   python backend/seed_admin.py --remote \
     --db-host=34.x.x.x \
     --db-pass=YOUR_DB_PASSWORD
   ```

---

## Support

**Deployment Fails:**
- Check logs: `make vm-logs GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x`
- Verify connectivity: `ping 34.x.x.x`
- Manual SSH: `gcloud compute ssh ai-book-writer --zone=asia-south1-c`

**API Issues:**
- API Docs: `http://34.x.x.x:8000/docs`
- Health Check: `curl http://34.x.x.x:8000/health`
- Logs: `sudo journalctl -u aiwriter-backend -f`

**Frontend Issues:**
- Check env: `cat frontend/.env.production`
- Browser console: DevTools → Network/Console
- Check CORS: Ensure `ALLOWED_ORIGINS` includes Cloudflare domain
