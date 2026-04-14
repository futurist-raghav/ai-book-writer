# VM-Only Deployment Configuration - Summary

**Date**: April 13, 2026  
**Status**: ✅ Complete & Ready for Deployment  
**Deployment Model**: Single GCP Compute Engine VM instance with all backend services

---

## What Changed

You requested a shift from distributed Cloud Run + Cloud SQL deployments to a **single VM-based deployment model** where all backend services run together on one instance.

### Updated Architecture

```
┌─────────────────────────────────────────┐
│   GCP VM (ai-book-writer)               │
│  ├─ FastAPI Backend (port 8000)         │
│  ├─ PostgreSQL 15 (port 5432)          │
│  ├─ Redis 7 (port 6379)                │
│  └─ Ollama + Gemma4 Model (port 11434) │
└─────────────────────────────────────────┘
              ↓ HTTP:8000
┌─────────────────────────────────────────┐
│   Cloudflare Pages Frontend              │
│   scribe-house-frontend.pages.dev       │
└─────────────────────────────────────────┘
```

---

## Files Updated/Created

### 1. **Makefile** (Primary Deployment Interface)

**What It Does:**
- Added new `deploy-vm`, `deploy-vm-backend`, `deploy-vm-frontend` targets
- Added new `vm-logs` and `vm-status` monitoring targets
- Updated help section to document VM deployment workflow

**Key Commands:**
```bash
make deploy-vm GCP_PROJECT_ID=... VM_IP=...                    # Full deploy
make deploy-vm-backend GCP_PROJECT_ID=... VM_IP=...            # Backend only
make deploy-vm-frontend VM_IP=...                              # Frontend only
make vm-logs GCP_PROJECT_ID=... VM_IP=...                      # View logs
make vm-status GCP_PROJECT_ID=... VM_IP=...                    # Check status
```

### 2. **backend/deploy-vm.sh** (New)

**What It Does:**
- Executes on the VM to deploy new backend code
- Creates/updates Python virtual environment
- Installs dependencies
- Runs database migrations
- Restarts systemd service (aiwriter-backend)
- Verifies API is responding

**Triggered By:** `make deploy-vm-backend`
**Location on VM:** `/opt/scribe-house/` (installation directory)

### 3. **frontend/.env.example** (Updated)

**What It Does:**
- Documents how to set `NEXT_PUBLIC_API_URL` for different deployment contexts
- Shows examples for local dev, VM deployment, and custom domain

**Key Variables:**
```
NEXT_PUBLIC_API_URL=http://VM_IP:8000/api/v1
```

### 4. **docs/VM_DEPLOYMENT_GUIDE.md** (New - 12KB)

**What It Contains:**
- Complete architecture diagram
- Prerequisites (gcloud CLI, GCP project setup)
- Step-by-step deployment instructions
- Troubleshooting guide
- Backend service management
- Database backup/recovery procedures
- CORS and connectivity debugging
- Cost optimization tips
- Monitoring commands

**This is the primary documentation** - reference this for all VM deployment questions.

### 5. **README.md** (Updated)

**What Changed:**
- Added new "Production Deployment (Single VM)" section
- Linked to VM_DEPLOYMENT_GUIDE.md
- Documented deployment command examples
- Updated deployment documentation links

---

## How to Deploy

### Full Stack (Backend + Frontend)

```bash
# 1. Get your VM IP
gcloud compute instances describe ai-book-writer \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'

# Output: 34.x.x.x

# 2. Deploy everything
make deploy-vm \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x

# Done! ✅
# Backend: http://34.x.x.x:8000
# Frontend: https://scribe-house-frontend.pages.dev
```

### Backend Only

```bash
# Deploy only backend code updates
make deploy-vm-backend \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

### Frontend Only

```bash
# Deploy frontend to Cloudflare (connects to existing VM backend)
make deploy-vm-frontend VM_IP=34.x.x.x
```

---

## Monitoring & Troubleshooting

### View Live Logs
```bash
make vm-logs \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

### Check Service Health
```bash
make vm-status \
  GCP_PROJECT_ID=ai-book-writer-raghav \
  VM_IP=34.x.x.x
```

### Manual SSH Access
```bash
gcloud compute ssh ai-book-writer \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav

# Once connected:
sudo journalctl -u aiwriter-backend -f         # View logs
sudo systemctl status aiwriter-backend         # Service status
curl http://127.0.0.1:8000/health | jq        # Health check
```

---

## What's Different from Cloud Run

### Comparison

| Aspect | Cloud Run | Single VM |
|--------|-----------|-----------|
| **Setup** | Serverless, auto-scaling | Manual, fixed size |
| **Cost** | Pay per request (~$500-1000/mo) | Fixed (~$200-300/mo) |
| **Maintenance** | Minimal (Google manages) | You manage patches, upgrades |
| **Complexity** | Higher (distributed) | Lower (single instance) |
| **Suitable For** | High traffic with spikes | Predictable traffic |

### Why Single VM?
- ✅ Simpler architecture
- ✅ Lower cost
- ✅ Easier debugging
- ✅ All services close (lower latency)
- ✅ Single point of management
- ✅ Complete control over environment

### Limitations
- ⚠️ Single point of failure (no auto-failover)
- ⚠️ Manual scaling required (no auto-scaling)
- ⚠️ You manage OS, packages, security patches
- ⚠️ Limited to VM size (e.g., n1-standard-4)

---

## Backend Services on the VM

All these run on the same VM instance:

### 1. **Scribe House FastAPI Backend**
- Systemd service: `aiwriter-backend`
- Port: `8000` (exposed externally)
- Process: Gunicorn with Uvicorn workers
- Config: `/etc/systemd/system/aiwriter-backend.service`

### 2. **PostgreSQL 15**
- Port: `5432` (internal only)
- Database: `ai_book_writer` (or `aibook`)
- User: `aiwriter`
- Managed by systemd

### 3. **Redis 7**
- Port: `6379` (internal only)
- Purpose: Cache + Celery queue
- Managed by systemd

### 4. **Ollama with Gemma4 Model**
- Port: `11434` (internal only)
- Model: `gemma4:latest` (~7GB)
- Purpose: On-device STT and content generation
- Managed by systemd or Docker

### 5. **File Storage**
- Location: `/home/ai_book_writer_storage`
- Contents: Book covers, uploaded PDFs, generated exports
- Permissions: Read/write by backend service

---

## Environment Variables

The `make deploy-vm` command doesn't prompt for env vars—it uses values from `.env` files. To customize:

```bash
# 1. Edit backend .env values
nano backend/.env.example  # or create backend/.env

# 2. Backend values will be set in systemd service
# 3. Deploy will copy .env values to VM
```

**Important Backend Variables:**
- `DATABASE_URL`: Auto-configured to localhost
- `ALLOWED_ORIGINS`: Auto-set to include Cloudflare domain
- `ENVIRONMENT`: `production`
- `API_HOST` / `API_PORT`: `0.0.0.0` / `8000`

**Frontend Variables:**
- `NEXT_PUBLIC_API_URL`: Auto-set to `http://VM_IP:8000/api/v1`

---

## Next Steps

### 1. Deploy Immediately
```bash
make deploy-vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x
```

### 2. Verify Deployment
```bash
# Check backend is running
make vm-logs GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x

# Visit frontend
# https://scribe-house-frontend.pages.dev

# Test API
curl http://34.x.x.x:8000/health
```

### 3. Create Admin Account
```bash
python backend/seed_admin.py --remote \
  --db-host=34.x.x.x \
  --db-pass=YOUR_DB_PASSWORD
```

### 4. Setup Custom Domain (Optional)
```bash
# If you want https://api.scribehouse.raghavagarwal.com
# 1. Add DNS A record pointing to VM IP
# 2. Set up reverse proxy (nginx) on VM
# 3. Install SSL cert (Let's Encrypt)
# 4. Update NEXT_PUBLIC_API_URL in frontend
```

---

## Troubleshooting Reference

**Backend won't start?**
→ See [VM_DEPLOYMENT_GUIDE.md#troubleshooting](docs/VM_DEPLOYMENT_GUIDE.md#troubleshooting)

**Frontend can't reach backend?**
→ Check CORS, firewall, VM IP in `frontend/.env.production`

**Database migrations failed?**
→ SSH into VM, run: `alembic upgrade head`

**Lost connection to VM?**
→ Check GCP VM console, verify VM is running, check SSH keys

---

## Files Reference

| File | Purpose | Last Updated |
|------|---------|--------------|
| Makefile | Deployment targets | ✅ This session |
| backend/deploy-vm.sh | VM deployment script | ✅ This session |
| frontend/.env.example | Frontend env template | ✅ This session |
| docs/VM_DEPLOYMENT_GUIDE.md | Complete deployment guide | ✅ This session |
| README.md | Project overview | ✅ This session |

---

## Support

For issues:

1. **Check logs first:**
   ```bash
   make vm-logs GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x
   ```

2. **Read the VM deployment guide:**
   → [VM_DEPLOYMENT_GUIDE.md](docs/VM_DEPLOYMENT_GUIDE.md)

3. **Manual SSH debugging:**
   ```bash
   gcloud compute ssh ai-book-writer --zone=asia-south1-c
   sudo journalctl -u aiwriter-backend -f
   ```

---

## Summary

✅ **Makefile** updated with 5 new deployment targets  
✅ **backend/deploy-vm.sh** created for on-VM code deployment  
✅ **frontend/.env.example** updated with VM configuration examples  
✅ **docs/VM_DEPLOYMENT_GUIDE.md** created (12KB comprehensive guide)  
✅ **README.md** updated with VM deployment section  

**Next Action:** Run `make deploy-vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x`
