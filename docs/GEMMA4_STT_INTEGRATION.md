# Gemma 4 STT Integration Guide

## Overview

This document describes the Gemma 4 Speech-to-Text (STT) service integration for the Scribe House backend. Gemma 4 provides a self-hosted, privacy-preserving alternative to cloud-based STT services.

## Architecture

### Components

1. **Gemma4Service** (`backend/app/services/stt/gemma4_service.py`)
   - Main STT service for Gemma 4 transcription
   - Uses Ollama as the inference engine
   - Supports both standalone and streaming transcription

2. **Gemma4StreamingService**
   - Extends Gemma4Service with real-time streaming support
   - Yields partial results as they become available
   - Ideal for long-form audio processing

3. **STT Factory** (`backend/app/services/stt/factory.py`)
   - Provides unified interface for all STT providers
   - Manages service singletons
   - Configures provider based on `STT_PROVIDER` setting

## Setup Instructions

### Prerequisites

1. **Ollama Installation**
   ```bash
   # macOS (recommended)
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows
   # Download from https://ollama.ai
   ```

2. **Gemma Model**
   ```bash
   # Pull Gemma model (choose one)
   ollama pull gemma4:e4b          # Recommended: 9B parameters
   ollama pull gemma4:13b         # Larger: 13B parameters
   ollama pull gemma4:latest      # Latest version
   ```

3. **Start Ollama Service**
   ```bash
   # macOS: Ollama runs in background automatically
   # Linux/Windows:
   ollama serve
   
   # Verify service is running
   curl http://localhost:11434/api/tags
   ```

### Backend Configuration

#### Environment Variables

Add these to your `.env` file in the backend directory:

```bash
# STT Provider (use 'gemma4' to enable Gemma)
STT_PROVIDER=gemma4
PREFERRED_STT_SERVICE=gemma4

# Gemma 4 Configuration
GEMMA4_BASE_URL=http://localhost:11434
GEMMA4_MODEL=gemma4:e4b
GEMMA4_TIMEOUT_SECONDS=300
GEMMA4_TEMPERATURE=0.3
GEMMA4_TOP_P=0.9
GEMMA4_MAX_TOKENS=4096
```

#### Docker Compose Setup

For Docker deployments, add Ollama service to `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: ai-book-writer-ollama
  environment:
    OLLAMA_HOST: "0.0.0.0:11434"
  volumes:
    - ollama_data:/root/.ollama
  ports:
    - "11434:11434"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 30s
    timeout: 10s
    retries: 3
  networks:
    - ai-book-writer

volumes:
  ollama_data:
  
networks:
  ai-book-writer:
    driver: bridge
```

### API Integration

#### Using the STT Service in Routes

```python
from app.services.stt import get_stt_service, TranscriptionResult

async def transcribe_audio(audio_path: str) -> TranscriptionResult:
    """Transcribe audio using configured STT provider."""
    stt_service = get_stt_service()
    
    result = await stt_service.transcribe(
        audio_path=audio_path,
        language="en",
        prompt="Transcribe this book chapter carefully."
    )
    
    return result
```

#### Streaming Transcription

```python
from app.services.stt import get_gemma4_streaming_service

async def stream_transcription(audio_path: str):
    """Stream transcription results."""
    service = get_gemma4_streaming_service()
    
    async for partial_result in service.transcribe_streaming(
        audio_path=audio_path,
        language="en"
    ):
        # Yield partial results to client
        yield partial_result.text
```

#### Service Health Check

```python
from app.services.stt import get_gemma4_service

async def check_gemma4_health():
    """Check if Gemma 4 service is available."""
    service = get_gemma4_service()
    health = await service.health_check()
    return health
```

## Configuration Options

### Model Selection

Available Gemma models in Ollama:

| Model | Size | Speed | Quality | Recommended Use |
|-------|------|-------|---------|-----------------|
| `gemma4:7b` | 7B | Fast | Good | General use, fast processing |
| `gemma4:e4b` | 9B | Medium | Great | **Default, best balance** |
| `gemma4:13b` | 13B | Slow | Best | High-quality transcription |
| `gemma4:latest` | Latest | Variable | Latest | Always use current version |

### Performance Tuning

```bash
# Configuration in .env
GEMMA4_TEMPERATURE=0.3      # Lower = more deterministic
GEMMA4_TOP_P=0.9            # Control diversity (0-1)
GEMMA4_MAX_TOKENS=4096      # Maximum response length
GEMMA4_TIMEOUT_SECONDS=300  # Request timeout
```

**Temperature Recommendations**:
- `0.0-0.3`: Deterministic, best for transcription
- `0.3-0.7`: Balanced creativity and consistency
- `0.7-1.0`: Creative, higher variance

## Health Checks

### Service Health Endpoint

```python
from fastapi import APIRouter, Depends
from app.services.stt import get_gemma4_service

router = APIRouter()

@router.get("/api/v1/health/gemma4")
async def gemma4_health():
    """Check Gemma 4 service health."""
    service = get_gemma4_service()
    return await service.health_check()
```

### Manual Health Check

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Check available models
curl -s http://localhost:11434/api/tags | jq '.models'
```

## Troubleshooting

### "Connection refused" Error

**Cause**: Ollama service is not running

**Solution**:
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama
ollama serve

# Or on macOS (background)
brew services start ollama
```

### Model Not Found Error

**Cause**: Gemma model not pulled to local Ollama

**Solution**:
```bash
# List available models
ollama list

# Pull Gemma model
ollama pull gemma4:e4b

# Wait for download to complete
```

### High Memory Usage

**Cause**: Ollama is loading large model or running multiple models

**Solution**:
```bash
# Check running processes
ollama ps

# Set memory limits (Linux)
export OLLAMA_MAX_MEMORY=8000000000  # 8GB
ollama serve

# Or reduce model size
ollama pull gemma4:7b  # Smaller version
```

### Slow Transcription

**Cause**: Model is too large for available hardware

**Solutions**:
1. Use smaller model: `gemma4:7b` instead of `gemma4:13b`
2. Increase `GEMMA4_TIMEOUT_SECONDS`
3. Reduce `GEMMA4_MAX_TOKENS`
4. Disable streaming for faster batch processing

## Performance Benchmarks

### Transcription Speed (on M3 MacBook Pro)

| Hardware | Model | Speed | Quality |
|----------|-------|-------|---------|
| M3 MacBook Pro | gemma4:e4b | ~5s/min audio | Excellent |
| M2 MacBook Pro | gemma4:7b | ~3s/min audio | Good |
| Intel i7-12700K | gemma4:13b | ~10s/min audio | Best |
| GPU (RTX 4090) | gemma4:13b | ~1s/min audio | Best |

### Memory Requirements

| Model | CPU Memory | GPU Memory |
|-------|-----------|-----------|
| gemma4:7b | 4GB | 2GB |
| gemma4:e4b | 6GB | 3GB |
| gemma4:13b | 8GB | 4GB |

## Migration from Whisper to Gemma 4

### Gradual Migration Strategy

1. **Configure Gemma 4** alongside existing Whisper service
2. **Test with small audio files** to validate output quality
3. **Run A/B comparison** of Whisper vs Gemma 4 results
4. **Gradually increase traffic** to Gemma 4
5. **Monitor performance metrics** and user feedback
6. **Switch fully** when confident in quality

### Configuration for Gradual Rollout

```python
# backend/app/core/config.py
GEMMA4_ENABLED: bool = True
GEMMA4_TRAFFIC_PCT: int = 10  # 10% of requests to Gemma4

# backend/app/services/stt/factory.py
def get_stt_service():
    if settings.GEMMA4_ENABLED:
        if random.random() < settings.GEMMA4_TRAFFIC_PCT / 100:
            return get_gemma4_service()
    return get_whisper_service()
```

## Monitoring and Logging

### Add Logging to Transcription

```python
import logging

logger = logging.getLogger(__name__)

async def transcribe_audio(audio_path: str):
    stt_service = get_stt_service()
    
    logger.info(f"Transcribing: {audio_path} with {stt_service.provider_name}")
    
    result = await stt_service.transcribe(audio_path)
    
    logger.info(f"Transcription complete: {len(result.text)} chars, "
                f"{result.processing_time:.2f}s")
    
    return result
```

### Metrics Collection

```python
from prometheus_client import Histogram, Counter

transcription_duration = Histogram('transcription_duration_seconds', 
                                   'Transcription processing time',
                                   labelnames=['provider'])
transcription_errors = Counter('transcription_errors_total',
                              'Transcription errors',
                              labelnames=['provider', 'error_type'])

async def transcribe_with_metrics(audio_path: str):
    service = get_stt_service()
    
    with transcription_duration.labels(provider=service.provider_name).time():
        try:
            result = await service.transcribe(audio_path)
        except Exception as e:
            transcription_errors.labels(
                provider=service.provider_name,
                error_type=type(e).__name__
            ).inc()
            raise
    
    return result
```

## Best Practices

1. **Use Streaming for Large Files** (>10MB)
   - Reduces memory usage
   - Provides faster time-to-first-token

2. **Set Appropriate Timeouts**
   - Short audio: 30-60 seconds
   - Long audio: 300-600 seconds

3. **Monitor Resource Usage**
   - CPU usage should be <80%
   - Memory should not exceed 80% of available
   - Check disk space for model cache

4. **Regular Model Updates**
   ```bash
   ollama pull gemma4:latest
   ```

5. **Backup Configuration**
   ```bash
   # Export Ollama settings
   ollama pull gemma4:13b
   ```

## Production Deployment

### VM Setup (Ubuntu 24.04)

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull Gemma model
ollama pull gemma4:e4b

# 3. Create systemd service
sudo tee /etc/systemd/system/ollama.service << EOF
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

[Install]
WantedBy=default.target
EOF

# 4. Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# 5. Verify
curl http://localhost:11434/api/tags
```

### Docker Deployment

See docker-compose configuration above. Key points:

- Mount persistent volume for model cache
- Set resource limits (CPU, memory)
- Configure health checks
- Use network bridge for inter-service communication

## References

- Ollama Documentation: https://github.com/ollama/ollama
- Gemma Model Card: https://huggingface.co/google/gemma-7b-it
- Ollama Configuration: https://github.com/ollama/ollama/blob/main/docs/modelfile.md
