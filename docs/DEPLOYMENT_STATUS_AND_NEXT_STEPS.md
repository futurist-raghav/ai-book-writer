# Cloud Run Deployment - Current Status & Next Steps

## ✅ What's Ready
- **Frontend**: Live at `https://e9a79a97.ai-book-writer-frontend.pages.dev`
- **Cloudflare Worker**: Deployed and configured (waiting for backend URL)
- **Cloud SQL**: PostgreSQL 18 instance ready in us-central1
- **Cloud Storage**: Bucket created and ready
- **Docker Image**: `backend/Dockerfile.prod` ready for deployment
- **Deployment Scripts**: Created (`gcp-deploy.sh` and Cloud Build config)

## ⛔ Current Blocker: GCP Permissions

The Cloud Run deployment script is blocked by a **Compute Engine service account permission issue**:

```
Error: 444228171335-compute@developer.gserviceaccount.com does not have storage.objects.get access
```

This prevents Cloud Build from reading build artifacts from GCS during the build process.

## 🚀 Solution: 5-Minute Fixfor User

You need to grant the Compute Engine service account permission to read from Cloud Storage:

### Option A: GCP Console (Easiest)
1. Go to https://console.cloud.google.com
2. Project: `ai-book-writer-raghav`
3. IAM & Admin > IAM
4. Find and click: `444228171335-compute@developer.gserviceaccount.com`
5. Click "Edit principal" (pencil icon)
6. Click "+ Add another role"
7. Search for and select: `Storage Object Viewer`
8. Click "Save"
9. Wait 2-3 minutes for permissions to propagate

Then run:
```bash
cd /Users/raghav/Projects/AI-Book-Writer
bash gcp-deploy.sh
```

### Option B: Using Makefile (After permissions fixed)
```bash
cd /Users/raghav/Projects/AI-Book-Writer
make deploy-cloud-run REGION=us-central1
```

## What the Deployment Script Does

`gcp-deploy.sh` performs these steps automatically:
1. **Build**: Submits code to Cloud Build → creates Docker image
2. **Push**: Pushes image to Google Container Registry
3. **Deploy**: Deploys image to Cloud Run
4. **Configure**: Updates `frontend/wrangler.json` with Cloud Run service URL
5. **Verify**: Redeploys Cloudflare Worker with new backend URL
6. **Test**: Verifies health endpoint is working

## Expected Outcome (After deployment)

```
User Browser
    ↓
Cloudflare Pages Frontend
    ↓
Cloudflare Worker Proxy
(interceptsAPI calls at /api/v1/*)
    ↓
Cloud Run Backend (FastAPI)
    ↓
Cloud SQL (PostgreSQL)
```

API calls like `GET /api/v1/books` will:
1. Frontend → `fetch('/api/v1/books')`
2. Worker → sees `/api/v1`, proxies to Cloud Run
3. Cloud Run → FastAPI handler
4. Database → Cloud SQL query
5. Response flows back through the chain

## Verification Steps (After deployment succeeds)

1. **Check Cloud Run deployment:**
   ```bash
   gcloud run services describe ai-book-writer \
     --region us-central1 \
     --format 'value(status.url)'
   ```

2. **Test backend directly:**
   ```bash
   curl https://ai-book-writer-XXXXX-us-central1.a.run.app/api/v1/health
   ```

3. **Test through Worker proxy:**
   ```bash
   curl https://e9a79a97.ai-book-writer-frontend.pages.dev/api/v1/health
   ```

4. **Test browser:**
   - Visit frontend URL
   - Open DevTools (F12)
   - Network tab
   - Trigger any API call
   - Should see `/api/v1/*` requests succeeding

## Files / Scripts Created

- ✅ `/gcp-deploy.sh` - Complete automated deployment script
- ✅ `/backend/cloudbuild.yaml` - Cloud Build configuration
- ✅ `/GCP_DEPLOYMENT_ISSUE_AND_SOLUTION.md` - Detailed troubleshooting guide 
- ✅ `frontend/functions/[[path]].ts` - Worker proxy (already deployed)
- ✅ `frontend/wrangler.json` - Worker config (ready to update)

## Timeline

**Typical deployment takes:**
- Cloud Build image build: 10-15 minutes
- Cloud Run deployment: 2-3 minutes
- Worker redeployment: 1-2 minutes
- **Total: 15-20 minutes after permissions are fixed**

## Troubleshooting

If anything fails after you grant permissions:

1. **Check Cloud Build status:**
   ```bash
   gcloud builds list --project ai-book-writer-raghav --limit 5
   ```

2. **View build logs:**
   ```bash
   gcloud builds log BUILD_ID --stream=false
   ```

3. **Check Cloud Run status:**
   ```bash
   gcloud run services describe ai-book-writer --region us-central1
   ```

4. **View Cloud Run logs:**
   ```bash
   gcloud run logs read ai-book-writer --region us-central1 --limit 50
   ```

## Summary

The infrastructure and code are all ready. You just need to grant one GCP permission to the Compute Engine service account, then run `bash gcp-deploy.sh`. This is a one-time 5-minute fix in the GCP Console that will complete the entire deployment.
