# VM Backend Deployment - Quick Reference Guide

## ✅ What's Been Completed

### SQLAlchemy 2.0+ Migration (Phase 1)
```
✓ All 42 model files analyzed
✓ 20 files with old-style Column declarations converted
✓ 891 total columns converted to mapped_column syntax
✓ All Mapped[type] annotations added
✓ Proper imports standardized
```

### Key Changes
- **Before**: `id = Column(String(36), primary_key=True)`
- **After**: `id: Mapped[str] = mapped_column(String(36), primary_key=True)`

**Documentation**: See [SQLALCHEMY_MIGRATION_COMPLETE.md](SQLALCHEMY_MIGRATION_COMPLETE.md)

---

## 📋 Remaining Deployment Steps

### Step 1: Validate Import Paths (5-10 min)
Check if any old import patterns exist:
```bash
ssh ai-book-writer@34.14.172.251 -i ~/.ssh/gcloud_key
grep -r "from app.api.dependencies" ~/backend/app --include="*.py" || echo "✓ No issues found"
```

### Step 2: Initialize Database Schema (10-15 min)
```bash
cd ~/backend

# Option A: Using init script (recommended)
python init_db.py

# Option B: Using Alembic migrations
alembic upgrade head
```

Verify in PostgreSQL:
```bash
psql -U aiwriter -d ai_book_writer -c "\dt"  # List tables
```

### Step 3: Start Backend Service (5 min)
```bash
# Check service status
sudo systemctl status aiwriter-backend

# If not running, start it
sudo systemctl start aiwriter-backend

# Monitor logs
sudo journalctl -u aiwriter-backend -f

# Test health endpoint
curl http://34.14.172.251:8000/health
```

Expected response:
```json
{"status": "ok"}
```

---

## 🔍 Troubleshooting

### If models still fail to import:
```bash
cd ~/backend
python -c "from app.models import book, chapter, user; print('✓ Models loaded')"
```

If error appears, check for:
- Missing imports in specific model file
- Reserved column names (e.g., `metadata` should be `field_metadata`)
- Incorrect type hints

### If database schema doesn't create:
```bash
# Check PostgreSQL connection
psql -U aiwriter -d ai_book_writer -c "SELECT version();"

# Examine specific table
psql -U aiwriter -d ai_book_writer -c "SELECT * FROM books LIMIT 1;"
```

### If health endpoint returns 500:
```bash
# Check backend logs for actual error
sudo tail -100 /var/log/syslog | grep aiwriter
sudo journalctl -u aiwriter-backend -n 50
```

---

## 📊 Deployment Progress

| Phase | Task | Status | Est. Time |
|-------|------|--------|-----------|
| 1 | SQLAlchemy models migration | ✅ DONE | - |
| 2 | Import path validation | ⏳ TODO | 5-10 min |
| 3 | Database schema init | ⏳ TODO | 10-15 min |
| 4 | Backend startup & test | ⏳ TODO | 10-15 min |
| 5 | STT Configuration | ⏳ TODO | 2-3 hours |
| 6 | Cloudflare update | ⏳ TODO | 15 min |

**Total Remaining**: ~3-4 hours

---

## 🎯 Success Criteria

- [ ] `curl http://34.14.172.251:8000/health` → 200 OK
- [ ] PostgreSQL has 40+ tables created
- [ ] Backend logs show clean startup (no errors)
- [ ] Cloudflare Worker routes to correct backend
- [ ] Frontend API calls work end-to-end

---

## 🔑 Key VM Credentials & Paths

```
VM IP: 34.14.172.251
SSH Key: ~/.ssh/gcloud_key
Backend Code: ~/backend
Database: ai_book_writer (user: aiwriter)
Redis: localhost:6379
Service: aiwriter-backend (systemd)
Logs: /var/log/syslog, journalctl -u aiwriter-backend
```

---

## 💡 Tips

1. **Keep one terminal monitoring logs**:
   ```bash
   ssh ai-book-writer@34.14.172.251
   sudo journalctl -u aiwriter-backend -f
   ```

2. **Test before deploying to Cloudflare**:
   ```bash
   curl -H "Content-Type: application/json" \
     http://34.14.172.251:8000/api/v1/books
   ```

3. **If rebuilding frequently**, keep dependencies cached:
   ```bash
   # Reinstall from cached wheels
   cd ~/backend
   pip install -q -r requirements.txt
   ```

---

**Status**: Ready for Phase 2-4 execution
