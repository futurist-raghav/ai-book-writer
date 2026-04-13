# Gemma 4 Upgrade - Deployment Guide

## Overview

Gemma 4 is now integrated into the Scribe House backend as an alternative/replacement for OpenAI Whisper for Speech-to-Text (STT). This guide walks through deploying and configuring Gemma 4.

## Quick Start (Development)

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Then run the setup script
bash scripts/setup-gemma4.sh
```

### 2. Start Ollama

```bash
# macOS (runs in background automatically after installation)
# Or manually:
ollama serve

# Linux/Docker
docker-compose up -d ollama
```

### 3. Configure Backend

Copy and edit the environment variables:

```bash
cp backend/.env.gemma4.example backend/.env.local
# Edit backend/.env.local with your settings
```

Key variables:

```bash
STT_PROVIDER=gemma4
GEMMA4_BASE_URL=http://localhost:11434
GEMMA4_MODEL=gemma4:latest
```

### 4. Test Connection

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Test transcription endpoint
curl -X GET http://localhost:8000/api/v1/health/gemma4
```

## Deployment Scenarios

### Scenario 1: Local Development (Recommended for Testing)

**Setup**: Ollama running locally on your machine

```bash
# 1. Install and start Ollama
brew install ollama
ollama serve

# 2. Pull Gemma model
ollama pull gemma4:e4b

# 3. Configure backend
export STT_PROVIDER=gemma4
export GEMMA4_BASE_URL=http://localhost:11434

# 4. Start backend
python -m uvicorn app.main:app --reload
```

**Pros**:

- No Docker overhead
- Fast development iteration
- Full control over model

**Cons**:

- Not production-ready
- Requires local model cache

---

### Scenario 2: Docker Development (Recommended)

**Setup**: Ollama and all services in Docker Compose

```bash
# 1. Start all services
docker-compose up -d

# 2. Pull Gemma model (runs once, then cached)
docker-compose exec ollama ollama pull gemma4:e4b

# 3. Verify setup
curl http://localhost:11434/api/tags
curl http://localhost:8000/api/v1/health/gemma4
```

**Pros**:

- Isolated environment
- Same as production
- Easy to reset/clean

**Cons**:

- Slower than native on macOS
- Uses more resources

---

### Scenario 3: Production Deployment (VM/Cloud Run)

**Setup**: Ollama on VM, Backend on Cloud Run

#### Step 1: Deploy to VM

```bash
# On development machine
gcloud compute ssh ai-book-writer --zone=asia-south1-c --project=ai-book-writer-raghav << 'EOF'

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Create systemd service
sudo tee /etc/systemd/system/ollama.service << 'OLLAMA'
[Unit]
Description=Ollama Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ollama
ExecStart=/usr/bin/ollama serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/home/ollama/.ollama/models"

[Install]
WantedBy=default.target
OLLAMA

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Pull model
ollama pull gemma4:e4b

# Test
curl http://localhost:11434/api/tags

EOF
```

#### Step 2: Configure Firewall

```bash
# Allow Ollama port on VM
gcloud compute firewall-rules create allow-ollama \
  --allow=tcp:11434 \
  --source-ranges=YOUR_IP/32 \
  --target-tags=ai-book-writer
```

#### Step 3: Update Backend Configuration

```bash
# Set environment variables for Cloud Run
gcloud run services update ai-book-writer \
  --set-env-vars="GEMMA4_BASE_URL=http://VM_INTERNAL_IP:11434"
```

Get VM's internal IP:

```bash
gcloud compute instances describe ai-book-writer \
  --zone=asia-south1-c \
  --format='get(networkInterfaces[0].networkIP)'
```

#### Step 4: Deploy Backend

```bash
# Build and deploy
make deploy

# Verify
curl https://your-backend.run.app/api/v1/health/gemma4
```

**Pros**:

- High availability
- Scalable
- Auto-managed

**Cons**:

- Complex setup
- More networking involved
- Cost considerations

---

## Migration Path: Whisper → Gemma 4

### Option A: Gradual Rollout (Recommended)

1. **Deploy both systems** (Whisper + Gemma 4)
2. **Send small % of traffic** to Gemma 4
3. **Monitor quality** and performance
4. **Gradually increase %** as confidence grows
5. **Full migration** when 99%+ working

Configuration:

```bash
# backend/.env
STT_PROVIDER=gemma4  # Primary
WHISPER_VM_BASE_URL=...  # Fallback
STT_ENABLE_FALLBACK=true
STT_FALLBACK_ON_ERROR=true
```

### Option B: Full Switch (For Testing Only)

```bash
# Update STT provider
STT_PROVIDER=gemma4
PREFERRED_STT_SERVICE=gemma4

# Restart backend
docker-compose restart backend

# Run tests
pytest tests/test_stt.py
```

## Configuration Reference

### Environment Variables

```bash
# Core configuration
STT_PROVIDER=gemma4                    # Use Gemma 4
PREFERRED_STT_SERVICE=gemma4           # Fallback default

# Gemma 4 Settings
GEMMA4_BASE_URL=http://localhost:11434 # Ollama URL
GEMMA4_MODEL=gemma4:e4b                 # Model variant
GEMMA4_TIMEOUT_SECONDS=300             # Request timeout
GEMMA4_TEMPERATURE=0.3                 # Output determinism
GEMMA4_TOP_P=0.9                       # Diversity control
GEMMA4_MAX_TOKENS=4096                 # Max response length

# Optional: Fallback to Whisper
OPENAI_API_KEY=sk-...                  # For fallback
WHISPER_VM_BASE_URL=...                # For fallback
```

### Model Selection Matrix

| Use Case         | Model             | Size     | Speed    | Quality  |
| ---------------- | ----------------- | -------- | -------- | -------- |
| Testing          | `gemma4:7b`     | 4.7GB    | ⚡⚡⚡   | ⭐⭐     |
| Production (CPU) | `gemma4:e4b`     | 5.5GB    | ⚡⚡     | ⭐⭐⭐   |
| Production (GPU) | `gemma4:13b`    | 7.4GB    | ⚡       | ⭐⭐⭐⭐ |
| Latest Features  | `gemma4:latest` | Variable | Variable | Latest   |

## Monitoring and Debugging

### Health Checks

```bash
# Check STT service health
curl http://localhost:8000/api/v1/health/stt

# Check Gemma 4 specifically
curl http://localhost:8000/api/v1/health/gemma4

# Check Whisper fallback
curl http://localhost:8000/api/v1/health/whisper
```

### Logs

```bash
# View Ollama logs
docker-compose logs -f ollama

# View backend STT logs
docker-compose logs -f backend | grep -i "transcribe\|stt\|gemma"

# Check Ollama model status
docker-compose exec ollama ollama ps

# List available models
docker-compose exec ollama ollama list
```

### Performance Metrics

```bash
# Monitor Ollama resource usage
docker stats aibook-ollama

# Check model inference speed
time docker-compose exec ollama ollama run gemma4:e4b "Hello, test"

# Memory profiling
docker-compose exec ollama ollama ps -v
```

## Troubleshooting

### Issue: "Connection refused"

**Cause**: Ollama is not running

**Fix**:

```bash
# Check if running
pgrep ollama

# Start Ollama
docker-compose restart ollama

# Wait for startup
sleep 5

# Test connection
curl http://ollama:11434/api/tags
```

---

### Issue: "Model not found"

**Cause**: Gemma model not downloaded

**Fix**:

```bash
# Pull model
docker-compose exec ollama ollama pull gemma4:e4b

# Or use setup script
bash scripts/setup-gemma4.sh
```

---

### Issue: "Timeout after 300 seconds"

**Cause**: Model is too slow or audio is too long

**Fix**:

```bash
# Increase timeout in .env
GEMMA4_TIMEOUT_SECONDS=600

# Or use faster model
GEMMA4_MODEL=gemma4:7b

# Restart backend
docker-compose restart backend
```

---

### Issue: "Out of memory"

**Cause**: Insufficient RAM for model

**Fix**:

```bash
# Use smaller model
GEMMA4_MODEL=gemma4:7b

# Or increase Docker memory
# Edit docker-compose.yml and increase ollama limits:
deploy:
  resources:
    limits:
      memory: 16G
    reservations:
      memory: 8G

# Restart
docker-compose restart ollama
```

---

### Issue: Transcription quality is poor

**Diagnosis**:

```bash
# Test with different models
docker-compose exec ollama ollama run gemma4:13b \
  "Transcribe: [audio metadata]"

# Check temperature setting
echo "Current temp: $GEMMA4_TEMPERATURE"

# Try lower temperature for more consistent output
GEMMA4_TEMPERATURE=0.1
```

## Testing

### Unit Tests

```bash
# Test Gemma 4 service
pytest backend/tests/services/test_gemma4_service.py -v

# Test STT factory
pytest backend/tests/services/test_stt_factory.py -v

# Test health endpoints
pytest backend/tests/api/test_health.py -v
```

### Integration Tests

```bash
# Test full transcription flow
pytest backend/tests/api/test_transcription.py -v

# Test fallback logic
pytest backend/tests/api/test_stt_fallback.py -v
```

### Manual Testing

```bash
# Test simple audio
curl -X POST http://localhost:8000/api/v1/chapters/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio_file_path": "/path/to/audio.wav"}'

# Test with language
curl -X POST http://localhost:8000/api/v1/chapters/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audio_file_path": "/path/to/audio.wav",
    "language": "en"
  }'
```

## Cost Analysis

### Cloud Run + VM Deployment

| Resource                   | Cost/Month | Notes                          |
| -------------------------- | ---------- | ------------------------------ |
| Cloud Run (AI-book-writer) | ~$50       | 2GB mem, 2 CPU                 |
| Compute Engine VM (Ollama) | ~$80       | n2-standard-4, 4 CPU, 16GB RAM |
| Total                      | ~$130      | Approximate                    |

### Compared to Whisper API

- Whisper: $0.006/min = ~$360/month @ 1000 hours
- Gemma 4: $130/month (fixed)
- **Savings**: ~$230/month @ 1000 hours/month

## Next Steps

1. ✅ Install Ollama locally or in Docker
2. ✅ Pull Gemma 2 model (9B recommended)
3. ✅ Configure backend with `STT_PROVIDER=gemma4`
4. ✅ Test health endpoint
5. ✅ Run integration tests
6. ✅ Monitor performance for 1-2 weeks
7. ✅ Gradually increase traffic from Whisper to Gemma 4
8. ✅ Full migration when stable

## Support & Documentation

- Ollama Documentation: https://github.com/ollama/ollama
- Gemma Model Page: https://huggingface.co/google/gemma-2-9b
- Backend STT Service: [backend/app/services/stt/](../backend/app/services/stt/)
- Health Endpoints: [backend/app/api/v1/health.py](../backend/app/api/v1/health.py)
- Integration Guide: [docs/GEMMA4_STT_INTEGRATION.md](./GEMMA4_STT_INTEGRATION.md)
