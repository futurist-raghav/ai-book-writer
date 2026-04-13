#!/bin/bash

# Gemma 4 Setup and Deployment Script
# Automates the installation and configuration of Gemma 4 for STT

set -e  # Exit on error

echo "=================================="
echo "Gemma 4 STT Setup Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="$(uname -s)"

echo -e "${YELLOW}Detected OS: $OS${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Ollama
install_ollama() {
    echo -e "${YELLOW}Installing Ollama...${NC}"
    
    case "$OS" in
        "Darwin")  # macOS
            if command_exists brew; then
                echo "Installing via Homebrew..."
                brew install ollama
            else
                echo "Downloading direct installer..."
                curl -fsSL https://ollama.ai/download/Ollama-darwin.zip -o /tmp/ollama.zip
                unzip -q /tmp/ollama.zip -d /Applications/
                rm /tmp/ollama.zip
            fi
            ;;
        "Linux")
            curl -fsSL https://ollama.ai/install.sh | sh
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Ollama installed successfully${NC}"
}

# Check if Ollama is installed
echo -e "${YELLOW}Checking for Ollama installation...${NC}"
if ! command_exists ollama; then
    echo -e "${YELLOW}Ollama not found. Installing...${NC}"
    install_ollama
else
    echo -e "${GREEN}Ollama is already installed${NC}"
fi

# Start Ollama service
echo -e "${YELLOW}Starting Ollama service...${NC}"

case "$OS" in
    "Darwin")  # macOS
        if ! pgrep -x "ollama" > /dev/null; then
            echo "Launching Ollama in background..."
            launchctl start io.ollama.macOS.launcher 2>/dev/null || \
            nohup ollama serve >/dev/null 2>&1 &
            sleep 2
        fi
        ;;
    "Linux")
        if ! pgrep -x "ollama" > /dev/null; then
            echo "Starting ollama service..."
            sudo systemctl start ollama || \
            nohup ollama serve >/dev/null 2>&1 &
            sleep 2
        fi
        ;;
esac

# Wait for Ollama to be ready
echo -e "${YELLOW}Waiting for Ollama to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}Ollama is ready${NC}"
        break
    fi
    echo "Attempt $i/30..."
    sleep 1
done

# Pull Gemma model
echo -e "${YELLOW}Pulling Gemma model...${NC}"

GEMMA_MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*gemma[^"]*"' | head -1 || true)

if [ -z "$GEMMA_MODELS" ]; then
    echo "No Gemma models found. Pulling gemma4:e4b..."
    
    # Show progress as model is being pulled
    echo "This may take several minutes depending on your internet connection..."
    ollama pull gemma4:e4b
    
    echo -e "${GREEN}Gemma model pulled successfully${NC}"
else
    echo -e "${GREEN}Gemma model already available${NC}"
    echo "Available models:"
    curl -s http://localhost:11434/api/tags | jq '.models[] | select(.name | contains("gemma")) | .name'
fi

# Verify Gemma is available
echo -e "${YELLOW}Verifying Gemma model...${NC}"
MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name')
if echo "$MODELS" | grep -q gemma; then
    echo -e "${GREEN}Gemma model is available:${NC}"
    echo "$MODELS" | grep gemma
else
    echo -e "${RED}Gemma model not found!${NC}"
    exit 1
fi

# Update .env file
echo -e "${YELLOW}Configuring backend environment...${NC}"

ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE..."
    touch "$ENV_FILE"
fi

# Function to update or add environment variable
update_env() {
    local key=$1
    local value=$2
    
    if grep -q "^$key=" "$ENV_FILE"; then
        sed -i.bak "s|^$key=.*|$key=$value|" "$ENV_FILE"
    else
        echo "$key=$value" >> "$ENV_FILE"
    fi
}

# Update Gemma 4 configuration
update_env "STT_PROVIDER" "gemma4"
update_env "PREFERRED_STT_SERVICE" "gemma4"
update_env "GEMMA4_BASE_URL" "http://localhost:11434"
update_env "GEMMA4_MODEL" "gemma4:e4b"
update_env "GEMMA4_TIMEOUT_SECONDS" "300"
update_env "GEMMA4_TEMPERATURE" "0.3"
update_env "GEMMA4_TOP_P" "0.9"
update_env "GEMMA4_MAX_TOKENS" "4096"

echo -e "${GREEN}Environment variables updated${NC}"

# Test Gemma 4 service
echo -e "${YELLOW}Testing Gemma 4 transcription service...${NC}"

TEST_RESULT=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "gemma4:e4b",
  "prompt": "Transcribe the following audio: [Test audio]",
  "stream": false
}' | jq -r '.response' 2>/dev/null || echo "Test failed")

if [ -z "$TEST_RESULT" ] || [ "$TEST_RESULT" = "null" ]; then
    echo -e "${RED}Failed to test Gemma 4 service${NC}"
    exit 1
else
    echo -e "${GREEN}Gemma 4 service test successful${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}=================================="
echo "Setup Complete!"
echo "==================================${NC}"
echo ""
echo "Gemma 4 STT is now configured:"
echo "  Service: Ollama"
echo "  Model: gemma4:e4b"
echo "  URL: http://localhost:11434"
echo ""
echo "Next steps:"
echo "  1. Update backend/.env if needed"
echo "  2. Restart backend service: docker-compose restart backend"
echo "  3. Test STT endpoint: curl http://localhost:8000/api/v1/health/gemma4"
echo ""
echo "Documentation: docs/GEMMA4_STT_INTEGRATION.md"
echo ""
