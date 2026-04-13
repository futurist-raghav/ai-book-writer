# Cloud Run Deployment - Completion Guide

## Current Status
✅ Backend deployed to Cloud Run (asia-south1)
✅ Cloud SQL connected (PostgreSQL 18)
✅ Cloud Storage bucket created

## Step 1: Get Cloud Run Service URL

```bash
# Check deployment status
gcloud run services describe ai-book-writer --region asia-south1

# Get the service URL
SERVICE_URL=$(gcloud run services describe ai-book-writer \
  --region asia-south1 \
  --format='value(status.url)')
echo $SERVICE_URL
```

Expected output: `https://ai-book-writer-xxxxx-asia-south1.a.run.app`

## Step 2: Update Frontend Environment

Edit `frontend/.env` and replace the API URL with your Cloud Run service:

```bash
# OLD (pointing to Cloudflare Worker itself - causes circular reference)
NEXT_PUBLIC_API_URL=https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1

# NEW (pointing to Cloud Run backend)
NEXT_PUBLIC_API_URL=https://ai-book-writer-xxxxx-asia-south1.a.run.app/api/v1
```

## Step 3: Update Cloudflare Worker

The Worker (`frontend/src/_worker.ts`) proxies `/api/*` requests to the backend.

Update `frontend/wrangler.json`:

```json
{
  "env": {
    "production": {
      "vars": {
        "BACKEND_URL": "https://ai-book-writer-xxxxx-asia-south1.a.run.app"
      }
    }
  }
}
```

## Step 4: Deploy Frontend Updates

```bash
# Build frontend
npm --prefix frontend run build

# Deploy to Cloudflare Pages
cd frontend && npx wrangler pages deploy .vercel/output/static \
  --project-name ai-book-writer-frontend \
  --branch main
```

Or use:
```bash
make deploy DEPLOY_MODE=cloudflare
```

## Step 5: Verify End-to-End

1. **Test backend health:**
   ```bash
   curl https://ai-book-writer-xxxxx-asia-south1.a.run.app/health
   ```

2. **Test API through worker:**
   ```bash
   curl https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1/health
   ```

3. **Visit frontend:**
   - https://ai-book-writer-frontend.pages.dev
   - https://aibookwriter.raghavagarwal.com

## Troubleshooting

### 500 Error on API Calls
- Check Cloud Run logs: `make cloud-run-logs GCP_PROJECT_ID=ai-book-writer-raghav`
- Verify DATABASE_URL is correct for Cloud SQL
- Ensure Cloud SQL instance is ready

### 400 Bad Request
- Frontend might still be pointing to wrong API URL
- Clear browser cache
- Rebuild and redeploy frontend

### Worker 502 Bad Gateway
- Check if Cloud Run backend is reachable
- Verify BACKEND_URL in wrangler.json is correct
- Check Worker logs in Cloudflare dashboard

## Architecture
```
┌─────────────────────┐
│  User Browser       │
├─────────────────────┤
│  Cloudflare Pages   │ (ai-book-writer-frontend.pages.dev)
│  (Next.js Frontend) │
├─────────────────────┤
│  Cloudflare Worker  │ (Proxies /api/* requests)
│  API Proxy          │
├─────────────────────┤
│  Cloud Run Backend  │ (FastAPI)
│  (asia-south1)      │
├─────────────────────┤
│  Cloud SQL          │ (PostgreSQL 18)
│  Cloud Storage      │
└─────────────────────┘
```

## Environment Variables Checklist

### Backend (Cloud Run)
- [ ] ENVIRONMENT=production
- [ ] DEBUG=false
- [ ] ALLOWED_ORIGINS=https://ai-book-writer-frontend.pages.dev
- [ ] DATABASE_URL=postgresql://... (Cloud SQL)
- [ ] SECRET_KEY=... (production secret)

### Frontend (.env)
- [ ] NEXT_PUBLIC_API_URL=https://ai-book-writer-xxxxx-asia-south1.a.run.app/api/v1
- [ ] NEXT_PUBLIC_APP_NAME=AI Book Writer
- [ ] NEXT_PUBLIC_APP_URL=https://aibookwriter.raghavagarwal.com

### Worker (wrangler.json)
- [ ] BACKEND_URL=https://ai-book-writer-xxxxx-asia-south1.a.run.app
