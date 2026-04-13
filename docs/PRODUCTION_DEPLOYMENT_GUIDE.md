# Scribe House - Production Deployment Guide

**Updated: April 2026**  
**Production Name**: Scribe House  
**GitHub**: https://github.com/futurist-raghav/scribe-house

---

## 📋 Quick Reference

| Component | Old Name | New Name | Status |
|-----------|----------|----------|--------|
| **GCP Cloud Run Service** | `ai-book-writer` | `scribe-house` | ✅ Updated |
| **GCP Cloud SQL Database** | `ai-book-writer` | `scribe-house` | ✅ Updated |
| **GCP VM Instance** | `ai-book-writer` | `scribe-house` | ✅ Updated |
| **Cloudflare Pages Project** | `ai-book-writer-frontend` | `scribe-house-frontend` | ✅ Updated |
| **Frontend Package** | `ai-book-writer-frontend` | `scribe-house-frontend` | ✅ Updated |
| **Mobile Package** | `ai-book-writer-mobile` | `scribe-house-mobile` | ✅ Updated |
| **Docker Images** | `ai-book-writer` | `scribe-house` | ✅ Updated |

---

## 🚀 Deployment Overview

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  User Browser                                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (scribe-house-frontend)                   │
│  - Next.js frontend                                         │
│  - Static assets & serverless functions                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ API requests to /api/v1/*
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud Run Service (scribe-house)                           │
│  - FastAPI backend                                          │
│  - Region: asia-south1                                      │
│  - Auto-scaling, fully managed                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL queries
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud SQL (scribe-house)                                   │
│  - PostgreSQL 15                                            │
│  - Private connection via Cloud SQL Auth Proxy              │
│  - Automated backups                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Environment Setup

### GCP Resources to Create/Verify
```bash
# Cloud Run Service
gcloud run services describe scribe-house --region asia-south1

# Cloud SQL Instance
gcloud sql instances describe scribe-house --project=ai-book-writer-raghav

# Compute VM
gcloud compute instances describe scribe-house --zone asia-south1-c --project=ai-book-writer-raghav
```

### Cloudflare Resources
```
- Pages Project: scribe-house-frontend
- Custom Domain: scribehouse.raghavagarwal.com
- API endpoints: Rewritten from /api/v1/* to backend CloudRun URL
```

---

## 💾 Admin User Seeding

### For Local Development
```bash
cd backend
source .venv/bin/activate
python seed_admin.py
```

### For Cloud SQL (Deployed Database)
Option 1 - Using DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://aibook_user:PASSWORD@CLOUD_SQL_HOST:5432/aibook"
python seed_admin.py
```

Option 2 - Using command-line arguments:
```bash
python seed_admin.py \
  --remote \
  --db-host=CLOUD_SQL_PUBLIC_IP \
  --db-pass=PASSWORD
```

Option 3 - Cloud SQL Proxy (Recommended for production):
```bash
# Start proxy in background
cloud_sql_proxy -instances=ai-book-writer-raghav:asia-south1:scribe-house=tcp:5433 &

# Run seeding with proxy connection
python seed_admin.py \
  --db-host=localhost \
  --db-port=5433 \
  --db-pass=PASSWORD
```

### Admin Credentials Created
```
Email:    admin@scribehouse.raghavagarwal.com
Password: rytse1-varhIx-cuxboq
Role:     Superuser (highest privilege)
Status:   Active, Verified
```

### Verify Admin Creation
```bash
# Test login via API
curl -X POST https://scribe-house-xxxxx-asia-south1.a.run.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@scribehouse.raghavagarwal.com",
    "password": "rytse1-varhIx-cuxboq"
  }'

# Expected response:
# {
#   "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "token_type": "bearer"
# }
```

---

## 📦 Deployment Steps

### Step 1: Build & Push Docker Image
```bash
# From project root
make build GCP_PROJECT_ID=ai-book-writer-raghav
```

### Step 2: Deploy to Cloud Run
```bash
# All-in-one deployment
make deploy GCP_PROJECT_ID=ai-book-writer-raghav

# Manual deployment
gcloud run deploy scribe-house \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 100 \
  --set-cloudsql-instances=ai-book-writer-raghav:asia-south1:scribe-house \
  --set-env-vars ENVIRONMENT=production,DEBUG=false,ALLOWED_ORIGINS=https://scribe-house-frontend.pages.dev,https://scribehouse.raghavagarwal.com
```

### Step 3: Initialize Database & Seed Admin
```bash
# Option A: From local machine via Cloud SQL Proxy
cloud_sql_proxy -instances=ai-book-writer-raghav:asia-south1:scribe-house=tcp:5433 &
python backend/init_db.py --with-seed --db-host=localhost --db-port=5433

# Option B: SSH into VM and run locally
gcloud compute ssh scribe-house --zone=asia-south1-c --project=ai-book-writer-raghav << 'EOF'
cd ~/backend
python init_db.py --with-seed
EOF
```

### Step 4: Deploy Frontend
```bash
# From frontend directory
wrangler pages deploy .vercel/output/static --project-name scribe-house-frontend

# Or via make
make deploy DEPLOY_MODE=cloudflare
```

### Step 5: Verify All Services
```bash
# Backend health
curl https://scribe-house-xxxxx-asia-south1.a.run.app/health

# Frontend health (through Cloudflare)
curl https://scribehouse.raghavagarwal.com/health

# Test admin login
curl -X POST https://scribehouse.raghavagarwal.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@scribehouse.raghavagarwal.com",
    "password": "rytse1-varhIx-cuxboq"
  }'
```

---

## 🔐 Security Checklist

- [ ] Change admin password immediately after first deployment
- [ ] Enable Cloud SQL SSL/TLS encryption
- [ ] Configure IAM roles (principle of least privilege)
- [ ] Enable Cloud Run request authentication if needed
- [ ] Set up Cloud Monitoring & Logging alerts
- [ ] Enable audit logging for Cloud SQL
- [ ] Rotate database credentials regularly
- [ ] Use Cloud Secret Manager for sensitive values
- [ ] Enable VPC Service Controls
- [ ] Set up DDoS protection in Cloudflare

---

## 📊 Monitoring & Logs

### Cloud Run Logs
```bash
# Live logs
gcloud run services logs read scribe-house --region asia-south1 --follow

# Last 100 lines
gcloud run services logs read scribe-house --region asia-south1 --limit 100

# Last hour of errors
gcloud run services logs read scribe-house --region asia-south1 \
  --limit 1000 | grep ERROR
```

### Cloud SQL Monitoring
```bash
# Connect via proxy and check logs
cloud_sql_proxy -instances=ai-book-writer-raghav:asia-south1:scribe-house=tcp:5433 &
psql -h localhost -p 5433 -U aibook_user -d aibook

# In psql:
\dt  -- list tables
SELECT COUNT(*) from users;  -- check user count
```

### Cloudflare Metrics
- Visit: https://dash.cloudflare.com → scribe-house-frontend
- Check: Page Views, Requests, Error Rates, Cache Hit Ratio

---

## 🚨 Troubleshooting

### Admin Login Fails
```bash
# Verify admin exists
cloud_sql_proxy -instances=ai-book-writer-raghav:asia-south1:scribe-house=tcp:5433 &
psql -h localhost -p 5433 -U aibook_user -d aibook -c "SELECT email, is_superuser FROM users WHERE email='admin@scribehouse.raghavagarwal.com';"

# Re-seed if needed
python backend/seed_admin.py --remote --db-host=localhost --db-port=5433 --db-pass=PASSWORD
```

### Cloud Run Service Timeout
- Increase timeout in Cloud Run console (max 3600s)
- Check for long-running operations in /api/v1/books endpoints
- Review logs for database connection pool exhaustion

### Database Connection Issues
- Verify Cloud SQL instance is running
- Check Cloud SQL Auth Proxy credentials
- Ensure service account has `cloudsql.client` role
- Verify database user permissions: `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aibook_user;`

### Frontend Not Connecting to Backend
- Check `NEXT_PUBLIC_API_URL` in Cloudflare environment
- Verify CORS settings in Cloud Run `ALLOWED_ORIGINS`
- Check Cloudflare Pages function proxy configuration
- Inspect network requests in browser DevTools

---

## 📝 Configuration Files Updated

**Backend**:
- ✅ `backend/.env.example` → APP_NAME=Scribe House
- ✅ `backend/app/core/config.py` → APP_NAME setting
- ✅ `backend/seed_admin.py` → Production-ready seeding script
- ✅ `backend/health_check.py` → Updated service name

**Frontend**:
- ✅ `frontend/.env.example` → NEXT_PUBLIC_APP_NAME
- ✅ `frontend/package.json` → Package name
- ✅ `Makefile` → Cloud Run & Cloudflare config

**Mobile**:
- ✅ `mobile/package.json` → Package name
- ✅ `mobile/app.json` → App slug & Expo config

**Infrastructure**:
- ✅ `cloudbuild.yaml` → Docker image names
- ✅ `Makefile` → Deployment commands
- ✅ `gcp-deploy.sh` → GCP deployment script
- ✅ `scripts/deploy-cloud-run.sh` → Cloud Run deployment
- ✅ `scripts/cleanup-test-data.sh` → Docker volume names

**Documentation**:
- ✅ `docs/DEPLOYMENT_CHECKLIST.md` → URLs & commands
- ✅ `README.md` → Repository references
- ✅ All other deployment docs

---

## 🔄 Migration from Old Names

### For Existing Deployments
1. **Do NOT delete** old `ai-book-writer` resources yet
2. **Create new** `scribe-house` resources in parallel
3. **Test** all functionality on new deployment
4. **Update DNS** custom domains to point to new Cloudflare project
5. **Verify** user data migration if needed
6. **Archive** old resources after 30 days if stable

### Database Migration (if needed)
```bash
# Export from old database
pg_dump --host=OLD_HOST --user=aibook_user --db=aibook > backup.sql

# Import to new database
psql --host=NEW_HOST --user=aibook_user --db=aibook < backup.sql

# Seed admin user
python seed_admin.py --remote --db-host=NEW_HOST --db-pass=PASSWORD
```

---

## 📞 Support & References

- **Repository**: https://github.com/futurist-raghav/scribe-house
- **Documentation**: See `docs/` folder
- **Admin Guide**: `docs/SCRIBE_HOUSE_REBRANDING.md`
- **Deployment Checklist**: `docs/DEPLOYMENT_CHECKLIST.md`

---

**Last Updated**: April 2026  
**Maintained By**: Raghav Agarwal  
**Status**: ✅ Production Ready
