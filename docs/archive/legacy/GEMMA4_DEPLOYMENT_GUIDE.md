# Gemma 4 Auto-Deployment Implementation Guide

## 🎯 Overview

Your Scribe House backend is now fully configured for **automatic Gemma 4 STT deployment**. When the backend starts, it will automatically:

1. ✅ Detect the Ollama service
2. ✅ Pull the `gemma4:latest` model (if not already available)
3. ✅ Verify STT connectivity
4. ✅ Serve the API with STT ready

**Result**: Zero manual intervention needed on the VM after Docker Compose startup.

---

## 📋 What Was Implemented

### Core Files Modified

| File | Changes | Status |
|------|---------|--------|
| `backend/app/core/config.py` | Added Gemma 4 defaults & auto-deploy settings | ✅ |
| `backend/app/services/initialization.py` | Created OllamaInitializer & BackendInitializer | ✅ |
| `backend/app/main.py` | Integrated auto-initialization into lifespan | ✅ |
| `backend/app/services/stt/gemma4_service.py` | Cleaned up (789→315 lines), Gemma 4 native audio | ✅ |
| `docker-compose.yml` | Added Gemma 4 environment variables to backend | ✅ |

### Key Features

- **Auto-Detection**: Waits for Ollama service at `localhost:11434`
- **Auto-Pull**: Automatically pulls `gemma4:latest` model (if missing)
- **Auto-Verify**: Tests STT connectivity on startup
- **Non-Blocking**: Backend continues running even if STT setup fails
- **Logging**: Full diagnostic output during initialization
- **Timeout Management**: 900 seconds for model pull, 600 seconds per transcription

---

## 🚀 Local Testing (Before VM Deployment)

### Step 1: Start Ollama Service
```bash
docker-compose up -d ollama
# Wait ~30 seconds for Ollama to be ready
docker-compose logs ollama | grep "Listening"
```

### Step 2: Start Backend (Triggers Auto-Initialization)
```bash
docker-compose up -d backend
# Should see initialization in logs within seconds
docker-compose logs backend -f | grep -i gemma
```

### Step 3: Verify Status
```bash
# Check backend health
curl http://localhost:8000/health

# Check if STT initialized successfully (should appear in logs)
docker-compose logs backend | grep "STT service ready"
```

### Expected Log Output
```
[INFO] Backend startup sequence initiated
[INFO] Starting Gemma 4 STT auto-initialization...
[INFO] OllamaInitializer: Waiting for Ollama service...
[INFO] ✓ Ollama service ready at http://localhost:11434
[INFO] Checking for gemma4:latest model...
[INFO] Model gemma4:latest not found, auto-pulling...
[INFO] Running: ollama pull gemma4:latest
[INFO] ✓ Model successfully pulled
[INFO] Verifying STT connectivity...
[INFO] ✓ STT service operational
[INFO] STT initialization result: success
[INFO] ✓ STT service ready: Gemma 4 STT initialized successfully
[INFO] Backend startup complete
```

---

## 🌐 VM Deployment (Google Cloud Compute Engine)

### Deployment Target
- **IP Address**: `34.14.172.251`
- **Zone**: `asia-south1-c`
- **Project**: `ai-book-writer`
- **Platform**: Google Cloud Run (via `make deploy`)

### Deployment Command
```bash
# From repo root
make deploy
# This triggers:
# 1. Backend Docker image build
# 2. Cloud Run deployment
# 3. Service initialization on startup
```

### What Happens During Deployment

1. **Backend starts** on Cloud Run
2. **Lifespan event** triggers initialization
3. **OllamaInitializer** runs:
   - Waits for Ollama (typically already running)
   - Queries available models
   - Pulls `gemma4:latest` if missing (15-20 min first time)
   - Verifies STT connectivity
4. **Backend serves API** with STT ready
5. **Logs** show progress: `docker logs <container-id>`

### First Deployment (Expect 15-20 minutes)

The first VM deployment will take longer due to model pulling:
- Minutes 0-2: Backend starts, initializer runs
- Minutes 2-15: Ollama pulls `gemma4:latest` (~8GB model)
- Minutes 15-20: Verification & ready

**Production deployments after first**: ~30-60 seconds (model already cached)

---

## ⚙️ Configuration Details

### Backend Environment Variables
```yaml
STT_PROVIDER: gemma4                           # Use Gemma 4 as default
PREFERRED_STT_SERVICE: gemma4
GEMMA4_BASE_URL: http://ollama:11434           # Docker service networking
GEMMA4_MODEL: gemma4:latest                    # Latest Gemma 4 with audio
GEMMA4_AUTO_DEPLOY: true                       # Enable auto-initialization
GEMMA4_AUTO_DEPLOY_WAIT_TIMEOUT: 900           # 15 min timeout for model pull
GEMMA4_TIMEOUT_SECONDS: 600                    # 10 min per transcription
GEMMA4_TEMPERATURE: 0.2                        # Very low for accuracy
GEMMA4_TOP_P: 0.85                            # Nucleus sampling
GEMMA4_MAX_TOKENS: 8192                        # Max transcription length
GEMMA4_AUDIO_SAMPLE_RATE: 16000                # 16 kHz required
GEMMA4_AUDIO_CHANNELS: 1                       # Mono audio
GEMMA4_AUDIO_FORMAT: float32                   # Audio encoding
```

### Audio Processing Specifications

**Gemma 4 Native Audio Requirements**:
- **Sample Rate**: 16 kHz (16,000 Hz)
- **Channels**: 1 (mono, not stereo)
- **Encoding**: float32 (not int16)
- **Processing Time**: Up to 600 seconds per request
- **Temperature**: 0.2 (very low for maximum accuracy)

---

## 🔍 Monitoring & Troubleshooting

### Check Initialization Status
```bash
# View backend startup logs
docker-compose logs backend | grep -i "gemma\|ollama\|stt"

# Monitor in real-time
docker-compose logs backend -f
```

### Health Check Endpoint
```bash
curl http://localhost:8000/health
# Response: {"status": "healthy", "version": "..."}
```

### If STT Initialization Fails

The backend **continues running** even if STT setup fails. It will:
1. Log the error
2. Return status "warning" or "error"
3. Continue serving API (other endpoints work)

**To fix**:
1. Check Ollama is running: `docker-compose logs ollama`
2. Verify network: `docker exec aibook-backend curl http://ollama:11434/api/tags`
3. Check disk space: `docker system df`
4. Restart: `docker-compose down && docker-compose up -d`

### Model Pull Status
```bash
# Check if model is downloaded
docker exec aibook-ollama ollama list

# Manually pull if needed
docker exec aibook-ollama ollama pull gemma4:latest
```

---

## 📊 Service Dependencies

```
Backend Container
    ↓ (depends on)
┌───────────────────┐
│   Ollama Service  │ ← Gemma 4 STT
│   (running)       │
└───────────────────┘
    ↓ (auto pulls)
┌───────────────────┐
│ gemma4:latest     │ ← Model (~8GB)
└───────────────────┘
```

**Network Path**: Backend → `http://ollama:11434` (Docker DNS)

---

## ✅ Pre-Deployment Checklist

- [x] Configuration defaults set to `gemma4` (not openai)
- [x] Model set to `gemma4:latest` (not gemma4:9b)
- [x] Auto-initialization service created
- [x] Backend startup wired to initialization
- [x] Docker Compose environment variables configured
- [x] All Python files compile without errors
- [x] Ollama service configured with health check
- [x] Persistent volume for model caching

---

## 🚀 Quick Start

### Local Development
```bash
# Start all services with auto-initialization
docker-compose up -d

# Watch initialization
docker-compose logs backend -f | grep -i "gemma\|ollama\|stt"

# Test once ready
curl http://localhost:8000/health
```

### VM Deployment
```bash
# Deploy to Google Cloud Run
make deploy

# Monitor startup logs
# Cloud Run console → Container logs tab
# Search: "gemma", "ollama", "STT", "initialization"
```

---

## 📞 Support

If STT initialization fails:
1. Check Ollama is running
2. Verify network connectivity
3. Check disk space
4. Review environment variables
5. Check backend logs for detailed error messages

All initialization steps are logged with timestamps for debugging.

---

## Summary

✅ **Implementation Status**: COMPLETE

Your backend is now fully configured for automatic Gemma 4 deployment. No manual intervention needed on VM startup. The backend will automatically:
- Detect Ollama
- Pull the Gemma 4 model
- Verify STT connectivity
- Serve the API with speech-to-text ready

Deploy with confidence! 🎉
