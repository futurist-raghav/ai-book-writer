## ✅ Scribe House - Cloud Run Deployment Checklist

### Phase 1: Backend Deployment to Cloud Run ⏳ IN PROGRESS

**Status**: Deploying FastAPI backend to Google Cloud Run (asia-south1)

Command running:
```bash
gcloud run deploy scribe-house \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --set-cloudsql-instances=ai-book-writer-raghav:asia-south1:scribe-house
```

**Expected completion**: 5-15 minutes for Docker build + deployment

Terminal Monitor: Check `gcloud run services list --region asia-south1`

---

### Phase 2: Get Cloud Run URL (AFTER DEPLOYMENT)

Once deployment completes, run:

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe scribe-house \
  --region asia-south1 \
  --format='value(status.url)')

echo "Backend URL: $SERVICE_URL"
```

**Example output**: `https://scribe-house-xxxxx-asia-south1.a.run.app`

---

### Phase 3: Update Frontend Configuration

**File**: `frontend/.env`

Replace the placeholder with your actual Cloud Run URL:

```bash
# BEFORE (currently set)
NEXT_PUBLIC_API_URL=https://scribe-house-xxxxx-asia-south1.a.run.app/api/v1

# Copy the actual URL from Phase 2
# Then save the file
```

---

### Phase 4: Update Cloudflare Worker Proxy

**File**: `frontend/wrangler.json`

Update the BACKEND_URL with your Cloud Run service:

```json
{
  "env": {
    "production": {
      "vars": {
        "BACKEND_URL": "https://scribe-house-xxxxx-asia-south1.a.run.app"
      }
    }
  }
}
```

---

### Phase 5: Deploy Frontend to Cloudflare Pages

After updating `.env` and `wrangler.json`:

```bash
# Build frontend
npm --prefix frontend run build

# Deploy to Cloudflare Pages
make deploy DEPLOY_MODE=cloudflare

# OR manually:
cd frontend && \
  npx @cloudflare/next-on-pages@1 && \
  npx wrangler pages deploy .vercel/output/static \
    --project-name scribe-house-frontend \
    --branch main
```

---

### Phase 6: Verify End-to-End Integration

Once everything is deployed:

```bash
# 1. Test backend health
curl https://scribe-house-xxxxx-asia-south1.a.run.app/health

# 2. Test API through Worker/Pages
curl https://scribe-house-prod.raghav-10168-19.workers.dev/api/v1/health

# 3. Visit frontend apps
# - https://scribe-house-frontend.pages.dev
# - https://scribehouse.raghavagarwal.com
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
└────────────┬────────────────────────────────┬──────────┘
             │                                │
    ┌────────▼─────────┐           ┌─────────▼────────┐
    │ Cloudflare Pages │           │ Custom Domain    │
    │ (ai-book-writer- │           │ aibookwriter.    │
    │ frontend.       │           │ raghavagarwal.   │
    │ pages.dev)      │           │ com              │
    └────────┬─────────┘           └─────────┬────────┘
             │                                │
             └────────────┬───────────────────┘
                          │
                   ┌──────▼──────┐
                   │ Cloudflare  │
                   │ Worker (API │
                   │ Proxy)      │
                   │ (_worker.ts)│
                   └──────┬──────┘
                          │
                          │ Proxies to
                          │
            ┌─────────────▼──────────────┐
            │   Google Cloud Run         │
            │   (FastAPI Backend)        │
            │   asia-south1              │
            │   ai-book-writer          │
            └──────────┬────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼──────┐  ┌───▼────────┐  ┌─▼──────────┐
    │ Cloud SQL │  │  Cloud     │  │   Redis   │
    │PostgreSQL │  │  Storage   │  │  (if used)│
    │ (Primary) │  │  (Backup)  │  │           │
    └───────────┘  └────────────┘  └───────────┘
```

---

## Files Created/Modified

✅ **Created:**
- `/cloudbuild.yaml` - Cloud Build configuration
- `/scripts/deploy-cloud-run.sh` - Deployment helper script
- `/frontend/wrangler.json` - Cloudflare Worker config
- `/frontend/src/_worker.ts` - Worker proxy code
- `/docs/CLOUD_RUN_DEPLOYMENT_GUIDE.md` - Detailed guide

✅ **Modified:**
- `/frontend/.env` - Updated with Cloud Run placeholder
- `/Makefile` - Added Cloud Run deployment targets

---

## Monitoring & Troubleshooting

### View Cloud Run Logs
```bash
make cloud-run-logs GCP_PROJECT_ID=ai-book-writer-raghav
# or
gcloud run services logs read scribe-house --region asia-south1 --limit 100 --follow
```

### Check Service Status
```bash
make cloud-run-describe GCP_PROJECT_ID=ai-book-writer-raghav
# or
gcloud run services describe scribe-house --region asia-south1
```

### Common Issues

**❌ `/api/v1/books` returns 400**
- Verify `NEXT_PUBLIC_API_URL` is correct in `frontend/.env`
- Check that Worker proxy is properly forwarding requests
- Verify backend is running: `curl https://[service-url]/health`

**❌ Worker returns 502 Bad Gateway**
- Check Cloud Run backend is healthy
- Verify `BACKEND_URL` in `wrangler.json` is correct
- Check Worker logs in Cloudflare dashboard

**❌ Can't connect to database**
- Verify Cloud SQL instance is running
- Check connection string in Cloud Run environment
- Ensure service account has Cloud SQL permission

---

## Environment Variables Summary

### Cloud Run Backend
```
ENVIRONMENT=production
DEBUG=false
ALLOWED_ORIGINS=https://scribe-house-frontend.pages.dev
DATABASE_URL=postgresql://[user]:[pass]@[cloudsql-ip]:5432/aibook
CLOUDSQL_INSTANCE_CONNECTION_NAME=ai-book-writer-raghav:asia-south1:scribe-house
```

### Frontend
```
NEXT_PUBLIC_API_URL=https://scribe-house-xxxxx-asia-south1.a.run.app/api/v1
NEXT_PUBLIC_APP_NAME=Scribe House
NEXT_PUBLIC_APP_URL=https://scribehouse.raghavagarwal.com
```

### Cloudflare Worker
```
BACKEND_URL=https://scribe-house-xxxxx-asia-south1.a.run.app
```

---

## Timeline

1. ⏳ **Phase 1**: Cloud Run deployment (5-15 min) - IN PROGRESS
2. ⏳ **Phase 2**: Get Cloud Run URL (<1 min)
3. ⏳ **Phase 3**: Update frontend .env (<1 min)
4. ⏳ **Phase 4**: Update Worker config (<1 min)
5. ⏳ **Phase 5**: Deploy frontend (2-5 min)
6. ⏳ **Phase 6**: Verify all systems (1-2 min)

**Total estimated time**: 15-30 minutes

---

## Next Immediate Action

**Monitor Cloud Run deployment completion:**

```bash
# Check every 30 seconds until service appears
while true; do
  gcloud run services list --region asia-south1 | grep scribe-house && break
  echo "Still deploying..."; sleep 30
done

# When it appears, get the URL
gcloud run services describe scribe-house --region asia-south1 --format='value(status.url)'
```

Once you see the URL, update `frontend/.env` and proceed to Phase 5.
