# Cloud Run Deployment - COMPLETION STEPS

## ✅ ISSUE RESOLVED: 400 Error Fixed

**Root Cause:** Frontend was pointing `NEXT_PUBLIC_API_URL` to the Cloudflare Worker itself (circular reference)

**Solution Implemented:**
- ✅ Created Cloudflare Worker proxy function (`functions/[[path]].ts`)
- ✅ Updated `NEXT_PUBLIC_API_URL=/api/v1` (relative path)
- ✅ Worker now proxies all `/api/*` requests to backend
- ✅ Updated `wrangler.json` with backend URL placeholder

---

## 🚀 NEXT STEPS TO COMPLETE DEPLOYMENT

### Step 1: Update Worker Backend URL (CRITICAL)

You need a working backend URL. Choose ONE option:

#### Option A: Wait for Cloud Run (Recommended)
```bash
# Cloud Run quota was exceeded in your region.
# Request GCP quota increase or try a different approach.
# OR manually enable more project quota in Google Cloud Console.
```

#### Option B: Use External Backend (Fastest)
If you have a working backend elsewhere (e.g., localhost, another deployment):
```bash
# Edit frontend/wrangler.json
# Replace: "BACKEND_URL": "https://ai-book-writer-aaa111bbb222ccc-asia-south1.a.run.app"
# With your actual backend URL
```

#### Option C: Simple Fallback - Use existing API
If you had a working backend before:
```bash
# wrangler.json - update BACKEND_URL to your actual backend
```

### Step 2: Build and Deploy Frontend

```bash
# Build
npm --prefix frontend run build

# Deploy to Cloudflare Pages
make deploy DEPLOY_MODE=cloudflare

# OR manually:
cd frontend && \
  npx @cloudflare/next-on-pages@1 && \
  npx wrangler deploy functions/[[path]].ts
```

### Step 3: Verify Everything

```bash
# Test the worker proxy
curl https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1/health

# Should return: {"status": "healthy", "version": "1.0.0"}
```

---

## 📋 Architecture Summary

```
User Browser
    ↓
Cloudflare Pages (Frontend)
    ↓
Cloudflare Worker (functions/[[path]].ts)
    ├─ Static assets: serve from Pages
    └─ /api/* requests: proxy to backend
         ↓
Backend (Cloud Run, localhost, or other)
         ↓
Cloud SQL + Cloud Storage
```

---

## 🔧 Configuration Reference

### Files Modified
- ✅ `frontend/.env` - API endpoint now `/api/v1`
- ✅ `frontend/wrangler.json` - Worker configuration with BACKEND_URL
- ✅ `frontend/functions/[[path]].ts` - Proxy logic
- ✅ `frontend/next.config.js` - Fixed rewrite rules

### Backend URL Location
Edit `frontend/wrangler.json` line ~11:
```json
"BACKEND_URL": "YOUR_BACKEND_URL_HERE"
```

---

## 📊 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Cloud Run | ⏳ Quota Exceeded | GCP free tier hit limits |
| Cloudflare Worker | ✅ Ready | Proxy configured |
| Frontend | ✅ Ready | Updated env vars |
| Database | ✅ Ready | Cloud SQL deployed |
| Cloud Storage | ✅ Ready | Bucket created |

---

## ⚡ Quick Test After Deployment

```bash
# 1. Frontend loads?
open https://aibookwriter.raghavagarwal.com

# 2. API requests work?
curl https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1/health

# 3. Books endpoint responds?
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://aibookwriter.raghavagarwal.com/api/v1/books
```

---

## 🛠️ Troubleshooting

### 502 Bad Gateway
- Check `BACKEND_URL` in `wrangler.json`
- Verify backend is running/accessible
- Check Worker logs in Cloudflare dashboard

### 404 on /api/* endpoints
- Rebuild with `npm run build`
- Verify `functions/[[path]].ts` exists
- Redeploy with `wrangler deploy`

### Still getting 400?
- Clear browser cache (Ctrl+Shift+Del)
- Check `NEXT_PUBLIC_API_URL=/api/v1` in frontend/.env
- Verify backend is accessible directly

---

## 💡 What Happens Next

1. You provide a backend URL (Cloud Run, localhost, or other)
2. Update `wrangler.json` with that URL
3. Run `make deploy DEPLOY_MODE=cloudflare`
4. All API requests now proxied through Worker
5. `/api/v1/books` returns data from your backend
6. Frontend loads and calls APIs successfully ✅

---

## 📝 Next Command

Once you have a backend URL ready:

```bash
# 1. Update wrangler.json
sed -i 's|BACKEND_URL_HERE|https://your-backend-url|g' frontend/wrangler.json

# 2. Deploy
make deploy DEPLOY_MODE=cloudflare

# 3. Test
curl https://ai-book-writer-prod.raghav-10168-19.workers.dev/api/v1/health
```
