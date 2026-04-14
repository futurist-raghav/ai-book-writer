# GCP Cloud Run Deployment - Permission Issue & Solution

## Current Status

### What Works ✅
- Frontend deployed to Cloudflare Pages at: `e9a79a97.ai-book-writer-frontend.pages.dev`
- Cloudflare Worker proxy configured and deployed
- Cloud SQL instance created and ready (PostgreSQL 18)
- Cloud Storage bucket created and ready
- Backend Docker image ready for deployment
- GCP gcloud CLI authentication working

### What's Blocked ⛔
- Cloud Run backend deployment failing due to GCP permission issue
- Error: `444228171335-compute@developer.gserviceaccount.com does not have storage.objects.get access`

## Root Cause

When using `gcloud run deploy --source ./backend`, Cloud Run uses Cloud Build to:
1. Upload source code to a GCS bucket
2. Build the Docker image
3. Deploy to Cloud Run

The Compute Engine default service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) lacks permission to read from the Cloud Build staging GCS bucket.

## Solutions

### Solution 1: Fix Permissions via GCP Console (Recommended)

1. Go to GCP Console: https://console.cloud.google.com
2. Select project: `ai-book-writer-raghav`
3. Navigate to: **IAM & Admin > IAM**
4. Find the Compute Engine default service account: `444228171335-compute@developer.gserviceaccount.com`
5. Click and edit the service account
6. Grant the role: **Storage Object Viewer** (or **Storage Admin** for full access)
7. Click Save
8. Grant the role: **Cloud Run Admin** (for deployment management)
9. Click Save

Wait 2-3 minutes for permissions to propagate.

### Solution 2: Use Cloud Build Directly (Alternative)

Create `/gcp-deploy.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID="ai-book-writer-raghav"
REGION="us-central1"
SERVICE_NAME="ai-book-writer"

# Step 1: Build image using Cloud Build
echo "Building Docker image with Cloud Build..."
gcloud builds submit ./backend \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --project=$PROJECT_ID

# Step 2: Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars="ENVIRONMENT=production,DEBUG=false" \
  --set-cloudsql-instances=$PROJECT_ID:$REGION:ai-book-writer \
  --project=$PROJECT_ID

# Step 3: Get service URL
echo "Getting service URL..."
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)' \
  --project=$PROJECT_ID
```

### Solution 3: Enable APIs via Console

If gcloud CLI continues to fail:

1. Go to https://console.cloud.google.com
2. Enable these APIs:
   - Cloud Resource Manager API
   - Cloud SQL Admin API
   - Cloud Build API (should already be enabled)
   - Cloud Run API

Then retry the deployment command.

## Quick Test After Fixing Permissions

```bash
# Test Cloud Run is working
curl https://ai-book-writer-[hash]-us-central1.a.run.app/api/v1/health

# Test through Cloudflare Worker proxy
curl https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1/health
```

## Next Steps After Successful Deployment

1. **Get the Cloud Run service URL:**
   ```bash
   gcloud run services describe ai-book-writer \
     --region us-central1 \
     --format 'value(status.url)' \
     --project ai-book-writer-raghav
   ```
   Expected output: `https://ai-book-writer-xxxxxxxx-us-central1.a.run.app`

2. **Update Cloudflare Worker configuration:**
   Edit `frontend/wrangler.json`:
   ```json
   {
     "env": {
       "production": {
         "vars": {
           "BACKEND_URL": "https://ai-book-writer-xxxxxxxx-us-central1.a.run.app"
         }
       }
     }
   }
   ```

3. **Deploy updated Worker:**
   ```bash
   cd frontend
   npm run deploy
   cd ..
   ```

4. **Verify integration:**
   - Navigate to frontend: `https://e9a79a97.ai-book-writer-frontend.pages.dev`
   - Open browser console (F12)
   - Check that API calls to `/api/v1/books` return data (not 4xx errors)

## Deployment Commands Reference

### Using gcloud directly (after permissions fixed):
```bash
cd /Users/raghav/Projects/AI-Book-Writer
gcloud run deploy ai-book-writer \
  --source ./backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars="ENVIRONMENT=production,DEBUG=false,ALLOWED_ORIGINS=https://ai-book-writer-frontend.pages.dev" \
  --set-cloudsql-instances=ai-book-writer-raghav:us-central1:ai-book-writer \
  --quiet
```

### Or use Makefile:
```bash
make deploy-cloud-run REGION=us-central1
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| `storage.objects.get` denied | Grant Compute Engine SA storage permissions (Solution 1) |
| Project quota exceeded | Use different region or wait 24h for quota reset |
| Cloud Resource Manager API disabled | Enable via GCP Console |
| Service deployment timeout | Check `gcloud run logs ai-book-writer --region us-central1 --limit 50` |

## Architecture After Successful Deployment

```
User Browser
    ↓
Cloudflare Pages (frontend)
    ↓
Cloudflare Worker (API proxy at /api/v1/*)
    ↓
Cloud Run (FastAPI backend)
    ↓
Cloud SQL (PostgreSQL)
Cloud Storage (assets)
```

## Current Project State

| Component | Status | Location |
|-----------|--------|----------|
| Frontend Code | ✅ Built | `frontend/` |
| Frontend Deployment | ✅ Live | `e9a79a97.ai-book-writer-frontend.pages.dev` |
| Backend Code | ✅ Ready | `backend/` |
| Backend Dockerfile | ✅ Ready | `backend/Dockerfile.prod` |
| Cloud SQL | ✅ Running | `ai-book-writer-raghav:us-central1:ai-book-writer` |
| Cloud Storage | ✅ Ready | `ai-book-writer` bucket |
| Cloud Run Service | ⏳ Needs deployment | Waiting for permissions |
| Worker Proxy | ✅ Deployed | Configured, waiting for backend URL |

