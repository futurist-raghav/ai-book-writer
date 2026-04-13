#!/bin/bash

# Scribe House - Backend Deployment Script for VM
# This script is executed on the VM to deploy the latest backend code

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Scribe House Backend Deployment===${NC}\n"

# Configuration
BACKEND_DIR="/tmp/scribe-house-backend"
INSTALL_DIR="/opt/scribe-house"
VENV_DIR="$INSTALL_DIR/venv"
PID_FILE="/tmp/aiwriter-backend.pid"

# Ensure installation directory exists
echo -e "${YELLOW}Step 1: Setting up installation directory...${NC}"
sudo mkdir -p "$INSTALL_DIR"
sudo chown -R $USER:$USER "$INSTALL_DIR"

# Copy new code
echo -e "${YELLOW}Step 2: Copying new backend code...${NC}"
cp -r "$BACKEND_DIR/"* "$INSTALL_DIR/" || true
cd "$INSTALL_DIR"

# Create or activate virtual environment
echo -e "${YELLOW}Step 3: Setting up Python virtual environment...${NC}"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating new virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install dependencies
echo -e "${YELLOW}Step 4: Installing Python dependencies...${NC}"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Run database migrations
echo -e "${YELLOW}Step 5: Running database migrations...${NC}"
if command -v alembic &> /dev/null; then
    alembic upgrade head || echo -e "${YELLOW}⚠️  Migration warning - check DB connection${NC}"
else
    echo -e "${YELLOW}⚠️  alembic not found, skipping migrations${NC}"
fi

# Restart backend service
echo -e "${YELLOW}Step 6: Restarting backend service...${NC}"
if sudo systemctl is-active --quiet aiwriter-backend; then
    echo "Restarting existing service..."
    sudo systemctl restart aiwriter-backend
else
    echo "Starting new service..."
    sudo systemctl start aiwriter-backend
fi

sleep 2

# Verify service is running
echo -e "${YELLOW}Step 7: Verifying deployment...${NC}"
if sudo systemctl is-active --quiet aiwriter-backend; then
    echo -e "${GREEN}✅ Backend service is active${NC}"
    
    # Wait for API to be ready
    echo "Waiting for API to be ready..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API is responding${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${YELLOW}⚠️  API not responding yet, check logs with: sudo journalctl -u aiwriter-backend -f${NC}"
        fi
        sleep 1
    done
else
    echo -e "${RED}❌ Backend service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u aiwriter-backend -f"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Backend deployment complete!${NC}"
echo ""
echo "Service Details:"
echo "  Status: $(sudo systemctl is-active aiwriter-backend)"
echo "  API: http://127.0.0.1:8000"
echo "  Docs: http://127.0.0.1:8000/docs"
echo ""
echo "View logs:"
echo "  sudo journalctl -u aiwriter-backend -f"
echo "  sudo systemctl status aiwriter-backend"
