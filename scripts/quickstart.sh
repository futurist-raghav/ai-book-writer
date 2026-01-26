#!/bin/bash

# AI Book Writer - Quick Start Script
# This script helps you get started quickly with the project

set -e

echo "================================================"
echo "AI Book Writer - Quick Start Setup"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✅ Docker is installed"

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please update Docker Desktop."
    exit 1
fi

echo "✅ Docker Compose is available"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate a random secret key
    SECRET_KEY=$(openssl rand -hex 32)
    
    # Update the .env file with the generated secret key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-secret-key-here-generate-with-openssl-rand/$SECRET_KEY/" .env
    else
        # Linux
        sed -i "s/your-secret-key-here-generate-with-openssl-rand/$SECRET_KEY/" .env
    fi
    
    echo "✅ .env file created with generated secret key"
    echo ""
    echo "⚠️  IMPORTANT: You need to add your AI API keys to the .env file:"
    echo "   - OPENAI_API_KEY (for Whisper speech-to-text)"
    echo "   - GOOGLE_AI_API_KEY (for Gemini text processing)"
    echo "   - ANTHROPIC_API_KEY (optional, for Claude)"
    echo ""
    read -p "Press Enter to open .env file in your default editor..."
    
    # Open .env in default editor
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open .env
    else
        ${EDITOR:-nano} .env
    fi
    
    echo ""
    read -p "Have you added your API keys? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please add your API keys to .env and run this script again."
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🚀 Starting services with Docker Compose..."
echo ""

# Start services
docker compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if backend is healthy
if docker compose ps | grep -q "aibook-backend.*healthy"; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend is starting up..."
fi

echo ""
echo "📊 Running database migrations..."
docker compose exec -T backend alembic upgrade head

echo ""
echo "================================================"
echo "✅ AI Book Writer is ready!"
echo "================================================"
echo ""
echo "🌐 Access the application:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo ""
echo "📋 Useful commands:"
echo "   View logs:        docker compose logs -f"
echo "   Stop services:    docker compose down"
echo "   Restart:          docker compose restart"
echo "   Run tests:        make test"
echo ""
echo "📚 Documentation:"
echo "   Setup Guide:      docs/SETUP.md"
echo "   API Docs:         docs/API.md"
echo "   Architecture:     docs/ARCHITECTURE.md"
echo "   Deployment:       docs/DEPLOYMENT.md"
echo ""
echo "Happy coding! 🎉"
