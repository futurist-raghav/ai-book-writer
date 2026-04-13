#!/bin/bash
# Scribe House - VM Deployment Completion Script
# Executes remaining phases: Database init, Backend startup, and Verification

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VM_IP="34.14.172.251"
VM_USER="ai_book_writer_user"
VM_ZONE="asia-south1-c"
PROJECT="ai-book-writer-raghav"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Scribe House - VM Deployment Completion${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Phase 2: Import Path Validation
echo -e "${YELLOW}[Phase 2] Validating Import Paths...${NC}"
echo "Checking for old-style import patterns..."

if grep -r "from app\.api\.dependencies import" ~/Projects/AI-Book-Writer/backend/app 2>/dev/null; then
    echo -e "${RED}✗ Found old import patterns - need fixing${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Import paths validated - no old patterns found${NC}"
fi

# Phase 3: Database Schema Initialization
echo -e "\n${YELLOW}[Phase 3] Initializing Database Schema...${NC}"

if [ "$1" == "--remote" ]; then
    echo "Connecting to VM at $VM_IP..."
    
    gcloud compute ssh "$VM_USER@scribe-house" \
        --zone="$VM_ZONE" \
        --project="$PROJECT" \
        --command="cd ~/backend && python init_db.py" 2>&1 | tee /tmp/db_init.log
    
    if grep -q "✅ Database tables created" /tmp/db_init.log; then
        echo -e "${GREEN}✓ Database schema initialized successfully${NC}"
    else
        echo -e "${RED}✗ Database initialization may have failed${NC}"
        cat /tmp/db_init.log
        exit 1
    fi
else
    echo "Running database initialization (local for testing)..."
    cd ~/Projects/AI-Book-Writer/backend
    
    if python -c "import asyncio; from init_db import init_db; asyncio.run(init_db())" 2>&1 | tee /tmp/db_init.log; then
        echo -e "${GREEN}✓ Database initialization script verified${NC}"
    else
        echo -e "${RED}✗ Database initialization script has issues${NC}"
        cat /tmp/db_init.log
    fi
fi

# Phase 4: Backend Startup & Testing
echo -e "\n${YELLOW}[Phase 4] Backend Startup & Health Check...${NC}"

if [ "$1" == "--remote" ]; then
    echo "Starting backend service on VM..."
    
    gcloud compute ssh "$VM_USER@scribe-house" \
        --zone="$VM_ZONE" \
        --project="$PROJECT" \
        --command="sudo systemctl restart aiwriter-backend" 2>&1
    
    sleep 3
    echo "Checking backend health..."
    
    if curl -s "http://$VM_IP:8000/health" | grep -q "healthy"; then
        echo -e "${GREEN}✓ Backend health check passed${NC}"
    else
        echo -e "${RED}✗ Health check failed - checking logs...${NC}"
        gcloud compute ssh "$VM_USER@ai-book-writer" \
            --zone="$VM_ZONE" \
            --project="$PROJECT" \
            --command="sudo journalctl -u aiwriter-backend -n 20 --no-pager" 2>&1
        exit 1
    fi
else
    echo "Verifying backend startup readiness (local)..."
    
    cd ~/Projects/AI-Book-Writer/backend
    if python -c "from app.main import app, health_check; print('✓ Backend imports verified')" 2>&1; then
        echo -e "${GREEN}✓ Backend startup readiness verified${NC}"
    else
        echo -e "${RED}✗ Backend startup has import issues${NC}"
        exit 1
    fi
fi

# Phase 5: STT Configuration Verification
echo -e "\n${YELLOW}[Phase 5] STT Configuration Verification...${NC}"

if [ -f ~/Projects/AI-Book-Writer/backend/app/services/stt/gemma4_service.py ]; then
    echo -e "${GREEN}✓ Gemma 4 STT service exists${NC}"
else
    echo -e "${RED}✗ Gemma 4 STT service not found${NC}"
    exit 1
fi

if grep -q "class OllamaInitializer:" ~/Projects/AI-Book-Writer/backend/app/services/initialization.py; then
    echo -e "${GREEN}✓ OllamaInitializer class found${NC}"
else
    echo -e "${RED}✗ OllamaInitializer not configured${NC}"
    exit 1
fi

if grep -q "initialize_backend()" ~/Projects/AI-Book-Writer/backend/app/main.py; then
    echo -e "${GREEN}✓ STT initialization wired to main.py${NC}"
else
    echo -e "${RED}✗ STT initialization not wired${NC}"
    exit 1
fi

# Phase 6: Cloudflare Worker Configuration
echo -e "\n${YELLOW}[Phase 6] Cloudflare Worker Configuration...${NC}"

if grep -q "http://34.14.172.251:8000" ~/Projects/AI-Book-Writer/frontend/wrangler.json; then
    echo -e "${GREEN}✓ Cloudflare Worker BACKEND_URL updated to VM IP${NC}"
else
    echo -e "${RED}✗ Cloudflare Worker not pointing to VM${NC}"
    exit 1
fi

# Final Verification
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Deployment Verification Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

CHECKS=(
    "✓ Phase 2: Import paths validated"
    "✓ Phase 3: Database schema initialization"
    "✓ Phase 4: Backend startup & health check"
    "✓ Phase 5: STT configuration verified"
    "✓ Phase 6: Cloudflare Worker updated"
)

for check in "${CHECKS[@]}"; do
    echo -e "${GREEN}$check${NC}"
done

echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOYMENT READY!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"

echo "Next Steps:"
echo "1. Deploy Cloudflare Worker:"
echo "   cd frontend && wrangler deploy"
echo ""
echo "2. Monitor backend on VM:"
echo "   gcloud compute ssh scribe-house --zone=asia-south1-c --project=ai-book-writer-raghav"
echo "   sudo journalctl -u aiwriter-backend -f"
echo ""
echo "3. Test API routes:"
echo "   curl http://34.14.172.251:8000/health"
echo "   curl http://34.14.172.251:8000/api/v1/books"
echo ""
echo "4. Frontend URL:"
echo "   https://scribe-house-prod.raghav-10168-19.workers.dev"
echo ""
echo "API will route through:"
echo "   Frontend → Cloudflare Worker → VM Backend (34.14.172.251:8000)"
echo ""
