# Scribe House - App Rebranding & Admin Seeding Guide

## 🎯 Overview

The Scribe House application has been officially rebranded to **Scribe House**. This guide covers:
1. All files and configurations that have been updated with the new name
2. How to seed the admin user account
3. Credential management best practices

---

## ✅ Rebranding Changes

### Files Updated

The following categories of files have been updated from "Scribe House" / "The Editorial Sanctuary" to "Scribe House":

#### Backend Configuration
- `backend/.env.example` - APP_NAME
- `backend/app/core/config.py` - Default APP_NAME setting
- `backend/app/core/project_types.py` - Documentation reference
- `backend/pytest.ini` - Test configuration header

#### Frontend Configuration
- `frontend/.env.example` - NEXT_PUBLIC_APP_NAME
- `frontend/package.json` - Package description
- `frontend/public/manifest.webmanifest` - Web app manifest
- `frontend/src/app/layout.tsx` - Root layout metadata
- `frontend/src/app/dashboard/layout.tsx` - Dashboard title
- `frontend/src/app/login/page.tsx` - Login page description
- `frontend/src/components/layout/header.tsx` - Header branding

#### Mobile App
- `mobile/app.json` - App name
- `mobile/app/(auth)/login.tsx` - Login screen title
- `mobile/package.json` - Package description
- `mobile/README.md` - Mobile app documentation

#### Root Configuration
- `.env.example` - Environment template
- `README.md` - Main project documentation
- `package.json` - Project metadata (if applicable)
- `CHANGELOG.md` - Project history
- `LICENSE` - Copyright information
- `CONTRIBUTING.md` - Contribution guidelines

#### Scripts & Deployment
- `Makefile` - Build commands and help text
- `gcp-deploy.sh` - GCP deployment script
- `DEPLOYMENT_COMPLETION.sh` - Deployment completion script
- `scripts/quickstart.sh` - Quick start script
- `scripts/deploy-vm-backend.sh` - VM backend deployment
- `scripts/deploy-cloud-run.sh` - Cloud Run deployment
- `scripts/cleanup-test-data.sh` - Test data cleanup

#### Documentation
- `IMPLEMENTATION_GUIDE.md` - Architecture guide
- `DEPLOYMENT_EXECUTIVE_SUMMARY.txt` - Deployment summary
- `docs/DEPLOYMENT_README.md` - Deployment docs
- `docs/DEPLOYMENT_CHECKLIST.md` - Deployment checklist
- `docs/AI_MODELS.md` - AI model documentation
- `docs/AI_MODELS.md` - AI models research
- `docs/FIREBASE_SETUP.md` - Firebase configuration
- `docs/TESTING_SUMMARY.md` - Testing documentation
- `docs/DEVELOPMENT.md` - Development guide
- `docs/TESTING_CHECKLIST.md` - Testing checklist
- `docs/P7.9_DRM_COMPLETE.md` - DRM implementation
- `docs/GEMMA4_*.md` - Gemma 4 integration guides
- `docs/P7.1_IMPLEMENTATION_COMPLETE.md` - Phase 7.1 docs
- `docs/P7.6_NOTIFICATIONS_SETUP.md` - Notifications setup
- `docs/PHASE_1_SPRINT_1_COMPLETE.md` - Phase 1 Sprint 1 docs
- `docs/NEXT.md` - Strategic documentation (Editorial Sanctuary references updated)
- `docs/COMPETITION KILLING.md` - Market analysis (Product positioning updated)

**Total: 50+ files updated**

---

## 🔐 Admin User Seeding

### Creating the Admin Account

Two methods are available to seed the admin user:

#### Method 1: Using the Standalone Seed Script

```bash
cd backend
source .venv/bin/activate
python seed_admin.py
```

**Output:**
```
🌱 Scribe House Admin Seeding Script
==================================================
📝 Seeding admin user to database...
   Email: admin@scribehouse.raghavagarwal.com
✅ Admin user created successfully!
   Email: admin@scribehouse.raghavagarwal.com
   Status: Active, Verified, Superuser
   Created: 2026-04-13T10:30:45.123456+00:00
==================================================
✨ Seeding complete!
```

#### Method 2: Using init_db.py with --with-seed Flag

```bash
cd backend
source .venv/bin/activate
python init_db.py --with-seed
```

This will:
1. Create all database tables
2. Seed the admin user account

### Admin Credentials

**⚠️ IMPORTANT: Keep these credentials private and secure!**

```
Email:    admin@scribehouse.raghavagarwal.com
Password: rytse1-varhIx-cuxboq
```

### What Gets Created

When the admin seed script runs, the following user account is created:

| Property | Value |
|----------|-------|
| Email | admin@scribehouse.raghavagarwal.com |
| Full Name | Scribe House Admin |
| Is Active | ✅ Yes |
| Is Verified | ✅ Yes |
| Is Superuser | ✅ Yes (highest privilege level) |
| AI Assist | ✅ Enabled |

---

## 🔑 Security Best Practices

### For Production

1. **Change the default admin password immediately** after first login
2. **Store credentials securely** - Use your organization's credential management system (1Password, Vault, etc.)
3. **Enable MFA** - Set up multi-factor authentication on the admin account
4. **Add RBAC** - Create role-specific accounts instead of sharing admin credentials
5. **Audit logs** - Enable and monitor admin login/action audit trails

### For Development

1. Use this admin account for testing and database seeding
2. Keep a note of these credentials, but don't commit them to version control
3. This seed script will only create the account if it doesn't exist
4. Running the script multiple times is safe - it's idempotent

---

## 🚀 Production Deployment

All production infrastructure has been updated to use "scribe-house":

### GCP & Cloud Resources
- **Cloud Run Service**: `scribe-house` (region: asia-south1)
- **Cloud SQL Instance**: `scribe-house`
- **VM Instance**: `scribe-house` (zone: asia-south1-c)
- **Container Images**: `gcr.io/ai-book-writer-raghav/scribe-house:latest`

### Cloudflare Resources
- **Pages Project**: `scribe-house-frontend`
- **Custom Domain**: `scribehouse.raghavagarwal.com`
- **API Forward**: `/api/v1/*` → Cloud Run backend

### Remote Admin Seeding (Cloud SQL)
The `seed_admin.py` script supports remote database connections:

```bash
# Using Cloud SQL Proxy (recommended)
cloud_sql_proxy -instances=ai-book-writer-raghav:asia-south1:scribe-house=tcp:5433 &
python backend/seed_admin.py --remote --db-host=localhost --db-port=5433 --db-pass=PASSWORD

# Or direct connection
python backend/seed_admin.py \
  --remote \
  --db-host=<CLOUD_SQL_PUBLIC_IP> \
  --db-pass=<DATABASE_PASSWORD>
```

### Quick Deployment Commands
```bash
# Build & deploy to Cloud Run
make deploy GCP_PROJECT_ID=ai-book-writer-raghav

# Deploy frontend to Cloudflare Pages
cd frontend && wrangler pages deploy .vercel/output/static --project-name scribe-house-frontend

# Seed admin in Cloud SQL
python backend/seed_admin.py --remote --db-host=<HOST> --db-pass=<PASS>

# Verify deployment
curl https://scribehouse.raghavagarwal.com/api/v1/health
```

**👉 See [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) for complete deployment instructions.**

---

## 🚀 Next Steps

### After Rebranding

1. ✅ Update environment variables with new app name (already done in example files)
2. ✅ Update branding assets (logos, screenshots, etc.)
3. **Deploy updated frontend** - The UI now shows "Scribe House" throughout
4. **Deploy updated backend** - Server references the new APP_NAME
5. **Update mobile apps** - Push new builds with "Scribe House" branding

### After Admin Seeding

1. ✅ Create superuser account
2. **Test admin login** - Verify credentials work via API
3. **Create regular user accounts** - For testing and team members
4. **Configure role-based access** - Set up different user roles
5. **Enable logging & monitoring** - Track admin activities

---

## 📝 Seed Script Files Created

### New Files
- `backend/seed_admin.py` - Standalone admin seeding script

### Modified Files
- `backend/init_db.py` - Added seeding capability with `--with-seed` flag

---

## 🔧 Troubleshooting

### Admin Already Exists
If you run the seeding script and see:
```
✅ Admin user already exists: admin@scribehouse.raghavagarwal.com
```

This is expected - the script is idempotent and won't create duplicate users.

### Connection Issues
If the script fails with database connection errors:
1. Ensure PostgreSQL is running: `docker compose up -d postgres` (local) or check cloud instance
2. Verify DATABASE_URL in .env file
3. Check that the database user has sufficient permissions

### Password Hash Errors
If you see password validation errors:
- The password must be 8+ characters with uppercase, lowercase, and digits
- The provided password meets all requirements

---

## 📚 Related Documentation

- [Backend Configuration Guide](../docs/DEVELOPMENT.md)
- [Deployment Guide](../docs/DEPLOYMENT_README.md)
- [FIREBASE Setup](../docs/FIREBASE_SETUP.md)

---

## ✨ Summary

The app has been successfully rebranded to **Scribe House** across all components. The admin user account is now available for seeding with the provided credentials. Remember to change the admin password in production and follow security best practices!
