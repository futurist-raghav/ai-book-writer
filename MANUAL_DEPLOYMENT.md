# Manual Deployment Guide

If `make deploy-vm` encounters GCP authentication errors, use this manual step-by-step guide.

## Your Configuration

- **VM Instance**: `scribe-house`
- **VM IP**: 35.200.193.248
- **GCP Project**: ai-book-writer-raghav
- **Zone**: asia-south1-c
- **Backend Location**: ./backend/

## Step-by-Step Deployment

### Step 1: Upload Backend Code to VM

```bash
gcloud compute scp \
  --recurse \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav \
  ./backend \
  scribe-house:/tmp/scribe-house-backend \
  --quiet
```

**Note:** This uses the cloud VM instance name `scribe-house`, not the IP address.

### Step 2: SSH into the VM and Run Deployment

```bash
# Connect to VM
gcloud compute ssh scribe-house \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav

# Once connected, run the deployment script:
bash /tmp/scribe-house-backend/deploy-vm.sh

# The script will:
# ✓ Create Python virtual environment
# ✓ Install all dependencies
# ✓ Run database migrations
# ✓ Restart the aiwriter-backend service
# ✓ Verify API is responding on port 8000
```

### Step 3: Verify Backend is Running

**While still connected to the VM:**

```bash
# Check service status
sudo systemctl status aiwriter-backend

# View logs
sudo journalctl -u aiwriter-backend -f

# Test the API
curl http://127.0.0.1:8000/health

# Expected output: {"status": "healthy"}
```

### Step 4: Deploy Frontend (Back on Your Machine)

```bash
# Exit VM SSH connection
exit

# On your local machine:
make deploy-vm-frontend VM_IP=35.200.193.248
```

This will:
1. Update `frontend/.env.production` with VM IP
2. Build the Next.js application
3. Deploy to Cloudflare Pages

## Verify Complete Deployment

Once both backend and frontend are deployed:

```bash
# Test backend API
curl http://35.200.193.248:8000/health
curl http://35.200.193.248:8000/docs

# Check frontend
# Visit: https://scribe-house-frontend.pages.dev
```

## If Something Goes Wrong

### SCP Upload Fails

```bash
# Create directory with proper permissions first
gcloud compute ssh scribe-house --zone=asia-south1-c --project=ai-book-writer-raghav \
  --command="sudo mkdir -p /tmp/scribe-house-backend && \
            sudo chown -R \$USER:\$USER /tmp/scribe-house-backend"

# Retry upload
gcloud compute scp \
  --recurse \
  --zone=asia-south1-c \
  --project=ai-book-writer-raghav \
  ./backend \
  scribe-house:/tmp/scribe-house-backend
```

### Deployment Script Fails

```bash
# SSH back into VM
gcloud compute ssh scribe-house --project=ai-book-writer-raghav

# View error logs
sudo journalctl -u aiwriter-backend -n 100

# Check if directories exist
ls -la /opt/scribe-house
ls -la /tmp/scribe-house-backend

# Run script again with debugging
bash -x /tmp/scribe-house-backend/deploy-vm.sh
```

### Database Migrations Failed

```bash
# SSH into VM and manually run migrations
gcloud compute ssh scribe-house --project=ai-book-writer-raghav

# On the VM:
source /opt/scribe-house/venv/bin/activate
cd /opt/scribe-house
alembic upgrade head

# Check current migration status
alembic current
```

### Service Won't Start

```bash
# SSH into VM
gcloud compute ssh scribe-house --project=ai-book-writer-raghav

# Safely restart
sudo systemctl restart aiwriter-backend

# Wait and check status
sleep 3
sudo systemctl status aiwriter-backend

# If still failing, check logs
sudo journalctl -u aiwriter-backend --no-pager -n 50
```

## Alternative: Manual Deployment (No Script)

If the deployment script fails completely, run these commands directly on the VM:

```bash
# SSH into VM first
gcloud compute ssh scribe-house --zone=asia-south1-c --project=ai-book-writer-raghav

# Then on the VM:

# 1. Create installation directory
sudo mkdir -p /opt/scribe-house
sudo chown -R $USER:$USER /opt/scribe-house

# 2. Copy backend code
cp -r /tmp/scribe-house-backend/* /opt/scribe-house/
cd /opt/scribe-house

# 3. Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 5. Run database migrations
alembic upgrade head

# 6. Restart the service
sudo systemctl restart aiwriter-backend

# 7. Verify it's running
sleep 2
curl http://127.0.0.1:8000/health
```

## Monitoring Commands

```bash
# View real-time logs
make vm-logs GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248

# Check service health
make vm-status GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248

# Or manually on the VM:
sudo journalctl -u aiwriter-backend -f
curl -s http://127.0.0.1:8000/health | jq
```

## Success Indicators

After completing all steps:

- ✅ Backend responding at `http://35.200.193.248:8000`
- ✅ API docs available at `http://35.200.193.248:8000/docs`
- ✅ Frontend live at `https://scribe-house-frontend.pages.dev`
- ✅ Health check passes: `curl http://35.200.193.248:8000/health`

## Reference

- Deployment script location: `backend/deploy-vm.sh`
- VM systemd service: `aiwriter-backend` 
- Installation directory on VM: `/opt/scribe-house`
- Temporary upload directory on VM: `/tmp/scribe-house-backend`
