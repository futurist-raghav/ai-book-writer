# VM STT Process (Whisper API)

This process keeps speech-to-text fully on your VM and connects both backend API and Celery worker to that endpoint.

## 1. VM Service Baseline

Run Whisper as a persistent Docker container on the VM:

sudo docker run -d \
	--name whisper-api \
	--restart unless-stopped \
	-p 9000:9000 \
	-e ASR_MODEL=large-v3 \
	-e ASR_ENGINE=faster_whisper \
	onerahmet/openai-whisper-asr-webservice:latest

Verify container health:

sudo docker ps
curl -s http://localhost:9000/openapi.json | head

## 2. Network Access

Keep VM firewall open for TCP 9000 only on the intended target tag.

Example GCP firewall rule:

gcloud compute firewall-rules create allow-whisper-api-9000 \
	--allow tcp:9000 \
	--direction=INGRESS \
	--source-ranges=0.0.0.0/0 \
	--target-tags=whisper-api

Attach tag to VM:

gcloud compute instances add-tags whisper-ai \
	--tags=whisper-api \
	--zone=asia-south1-b

## 3. App Configuration

Set these values in backend runtime env for both API and worker:

PREFERRED_STT_SERVICE=whisper_vm
STT_PROVIDER=whisper_vm
WHISPER_VM_BASE_URL=http://35.200.193.248:9000
WHISPER_VM_MODEL_NAME=large-v3
WHISPER_TIMEOUT_SECONDS=3600
WHISPER_VM_DEFAULT_TASK=transcribe
WHISPER_VM_OUTPUT_FORMAT=json
WHISPER_VM_ENCODE=true
WHISPER_VM_WORD_TIMESTAMPS=false

Then restart backend and worker.

## 4. Runtime Validation

Check VM API directly:

curl -s http://35.200.193.248:9000/docs | head

Trigger one transcription in the app, then validate logs:

- Backend should queue transcription successfully.
- Worker should complete transcription task without OpenAI key errors.
- Stored transcription should have stt_service=whisper_vm and stt_model=large-v3.

## 5. Operations Checklist

- Reserve a static external IP for production so endpoint does not change.
- Keep Docker restart policy as unless-stopped.
- Monitor VM disk and memory; Whisper models are large.
- If endpoint changes, update WHISPER_VM_BASE_URL and restart backend + worker.
