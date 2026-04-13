# Scribe House - VM Deployment Commands Reference

## Overview

All deployment and infrastructure management is now unified in a single `make deploy` command with auto-commit and orchestration capabilities. The Makefile has been enhanced with comprehensive database and VM lifecycle management commands.

## Quick Start

### One-Command Full Stack Deployment

```bash
# Deploy everything to VM (auto-commits code changes, uploads backend, runs migrations, deploys frontend)
make deploy DEPLOY_MODE=vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248 AUTO_COMMIT=1
```

This single command:
1. Auto-commits pending code changes
2. Uploads backend to VM
3. Runs database migrations
4. Builds and deploys frontend to Cloudflare Pages
5. Verifies all services are responsive

### Alternative - Step-by-Step Deployment

If you prefer to control each step:

```bash
# Just backend
make deploy-vm-backend GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248

# Just frontend
make deploy-vm-frontend VM_IP=35.200.193.248
```

## Database Management Commands

### Run Migrations
```bash
make db-migrate
```
Executes pending Alembic migrations on the database.

### Check Migration Status
```bash
make db-status
```
Shows the current migration state of the database.

### Reset Database (DANGEROUS!)
```bash
make db-reset
```
⚠️ **WARNING**: Deletes all data! Useful for development/testing.
- Drops the database
- Recreates a fresh database
- Runs all migrations from scratch

### PostgreSQL Interactive Shell
```bash
make db-shell
```
Opens a `psql` connection to the PostgreSQL database.

### View Database Logs
```bash
make db-logs
```
Streams database logs in real-time (useful for debugging connections).

### Backup Database
```bash
make db-backup
```
Creates a compressed SQL backup in `backups/` directory.

### Restore Database
```bash
make db-restore
```
Restores from a backup file in `backups/` directory (will prompt for file selection).

## VM Lifecycle Management

### Start VM Instance
```bash
make vm-start GCP_PROJECT_ID=ai-book-writer-raghav
```
Starts the stopped VM instance. Services will be available shortly after startup.

### Stop VM Instance
```bash
make vm-stop GCP_PROJECT_ID=ai-book-writer-raghav
```
Gracefully stops the VM instance (useful for cost saving during development).

### Restart VM Instance
```bash
make vm-restart GCP_PROJECT_ID=ai-book-writer-raghav
```
Restarts the VM (stop → start cycle). Useful when services need a hard reset.

### SSH Into VM
```bash
make vm-ssh GCP_PROJECT_ID=ai-book-writer-raghav
```
Opens an interactive SSH shell to the VM for direct system administration.

### View VM Backend Logs
```bash
make vm-logs GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248
```
Streams systemd logs from the backend service on the VM.

### Check VM Health Status
```bash
make vm-status GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248
```
Shows systemd service status and API health check result.

## Default Configuration

The Makefile has sensible defaults configured for the Scribe House project:

```makefile
# Deployment model (vm, cloudflare, or git)
DEPLOY_MODE ?= vm

# GCP Configuration
GCP_PROJECT_ID ?= ai-book-writer-raghav
VM_INSTANCE_NAME ?= scribe-house
VM_ZONE ?= asia-south1-c
VM_IP ?= 35.200.193.248

# Auto-commit pending changes before deployment
AUTO_COMMIT ?= 1
```

You can override these defaults at the command line:

```bash
# Override defaults
make deploy DEPLOY_MODE=cloudflare AUTO_COMMIT=0
make vm-stop GCP_PROJECT_ID=my-other-project
```

## Common Workflows

### Development Workflow
```bash
# Work on code...
# ... make changes ...

# Deploy to VM with auto-commit
make deploy DEPLOY_MODE=vm VM_IP=35.200.193.248

# Check if deployment succeeded
make vm-status GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248
```

### Emergency Database Maintenance
```bash
# Backup before any risky operation
make db-backup

# If something goes wrong, restore
make db-restore
```

### VM Maintenance Window
```bash
# Stop VM to save costs
make vm-stop GCP_PROJECT_ID=ai-book-writer-raghav

# ... Do work ...

# Restart when done
make vm-restart GCP_PROJECT_ID=ai-book-writer-raghav
```

### Fresh Database for Testing
```bash
# Only do this in development!
make db-reset

# Then run any test data seeds if available
```

## Architecture

### Backend Deployment Pipeline
1. **Code Upload**: `gcloud compute scp` uploads backend code to `/tmp/scribe-house-backend`
2. **VM Execution**: `deploy-vm.sh` runs on VM to:
   - Set up Python venv at `/opt/scribe-house`
   - Install dependencies
   - Run Alembic migrations
   - Restart systemd service `aiwriter-backend`
3. **Verification**: Health check confirms API is responding on port 8000

### Frontend Deployment Pipeline
1. **Environment Setup**: Injects VM IP into `.env.production`
2. **Build**: Next.js build with Cloudflare Pages adaptation
3. **Deploy**: Uses Wrangler CLI to push static output to Cloudflare

### Database Deployment
- Uses `alembic upgrade head` to apply pending migrations
- Runs inside backend container/service
- Supports full reset with `db-reset` (dev/test only)

### Ollama/Gemma4 LLM Deployment
- Automatically deployed via Docker Compose on VM
- Runs on port 11434 (internal service)
- Auto-downloads `gemma4:latest` model on first STT request
- Timeout: 600 seconds (10 minutes) for inference operations

## Troubleshooting

### Deployment Fails with SSH Error
```bash
# Verify GCP authentication
gcloud auth list
gcloud auth application-default login

# Test SSH manually
gcloud compute ssh scribe-house --zone=asia-south1-c --project=ai-book-writer-raghav
```

### Database Migration Fails
```bash
# Check current migration state
make db-status

# View database logs for errors
make db-logs

# As last resort (dev/test only), reset DB
make db-reset
```

### Frontend Not Connecting to Backend
Ensure the `NEXT_PUBLIC_API_URL` environment variable matches your VM IP:
```bash
# In deploy-vm-frontend, the URL is set automatically to http://$(VM_IP):8000/api/v1
# If tests show 404 on API calls, verify:
# 1. VM IP is correct: make vm-status GCP_PROJECT_ID=... VM_IP=...
# 2. Backend is running: curl http://VM_IP:8000/health
# 3. Check frontend browser console for actual request URLs being used
```

### Gemma4/LLM Not Responding
```bash
# Check Ollama is running
make vm-ssh GCP_PROJECT_ID=ai-book-writer-raghav
# Then: docker ps | grep ollama

# Check Ollama logs
make vm-ssh GCP_PROJECT_ID=ai-book-writer-raghav
# Then: docker logs aibook-ollama -f

# Note: First request may take 5+ minutes if pulling model
# Gemma4 auto-deploys (downloads) on first use
```

## Command Reference Summary

| Command | Purpose | Parameters |
|---------|---------|------------|
| `make deploy` | Full-stack auto-deployment | DEPLOY_MODE=vm GCP_PROJECT_ID=... VM_IP=... AUTO_COMMIT=1 |
| `make db-migrate` | Run pending migrations | None (runs in Docker) |
| `make db-status` | Show migration state | None |
| `make db-reset` | Delete and recreate DB | None (interactive) |
| `make db-shell` | PostgreSQL prompt | None |
| `make db-logs` | Stream DB logs | None |
| `make db-backup` | Create SQL dump | None |
| `make db-restore` | Restore from backup | None (file selection) |
| `make vm-start` | Start VM | GCP_PROJECT_ID=... |
| `make vm-stop` | Stop VM | GCP_PROJECT_ID=... |
| `make vm-restart` | Restart VM | GCP_PROJECT_ID=... |
| `make vm-ssh` | SSH to VM | GCP_PROJECT_ID=... |
| `make vm-logs` | Backend service logs | GCP_PROJECT_ID=... VM_IP=... |
| `make vm-status` | System and API health | GCP_PROJECT_ID=... VM_IP=... |

## More Information

- **Deployment Guides**: See [MANUAL_DEPLOYMENT.md](MANUAL_DEPLOYMENT.md) for step-by-step instructions
- **Architecture Details**: See [VM_DEPLOYMENT_GUIDE.md](docs/VM_DEPLOYMENT_GUIDE.md)
- **Project Setup**: See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **Troubleshooting**: See [GCP_DEPLOYMENT_ISSUE_AND_SOLUTION.md](docs/GCP_DEPLOYMENT_ISSUE_AND_SOLUTION.md)
