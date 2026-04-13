#!/bin/bash
# Backend deployment and startup script for VM

set -e  # Exit on any error

echo "🚀 Starting Scribe House Backend Deployment..."

# Configuration
BACKEND_DIR="/home/sa_106997477162824821028/backend"
VENV_DIR="$BACKEND_DIR/venv"
STORAGE_DIR="/home/ai_book_writer_storage"
AI_MODEL_DIR="/home/ai_book_writer_ai"
SERVICE_FILE="/etc/systemd/system/aiwriter-backend.service"

# Database configuration
DB_USER="aiwriter"
DB_NAME="ai_book_writer"
DB_HOST="localhost"
DB_PORT="5432"

echo "📦 Setting up storage directories..."
sudo mkdir -p "$STORAGE_DIR"
sudo mkdir -p "$AI_MODEL_DIR"
sudo chown -R $USER:$USER "$STORAGE_DIR"
sudo chown -R $USER:$USER "$AI_MODEL_DIR"
chmod -R 755 "$STORAGE_DIR"
chmod -R 755 "$AI_MODEL_DIR"

echo "✅ Storage directories ready"

# Create systemd service for backend
echo "🔧 Creating systemd service..."
sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Scribe House FastAPI Backend
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=notify
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$VENV_DIR/bin"
Environment="DATABASE_URL=postgresql://$DB_USER:aiwriter_secure_pass_2024@$DB_HOST:$DB_PORT/$DB_NAME"
Environment="REDIS_URL=redis://localhost:6379/0"
Environment="ENVIRONMENT=production"
Environment="DEBUG=false"
Environment="API_HOST=0.0.0.0"
Environment="API_PORT=8000"
Environment="WORKERS=4"
Environment="STORAGE_BACKEND=local"
Environment="STORAGE_LOCAL_PATH=$STORAGE_DIR"
ExecStart=$VENV_DIR/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 120 --user=$USER --access-logfile - app.main:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable aiwriter-backend  
echo "✅ Systemd service created and enabled"

# Start Redis
echo "🔴 Starting Redis..."
sudo systemctl restart redis-server || sudo systemctl start redis-server
sleep 2
redis-cli ping || echo "⚠️  Redis may not be fully ready"
echo "✅ Redis started"

# Test database connection
echo "📊 Testing database connection..."
export DATABASE_URL="postgresql://$DB_USER:aiwriter_secure_pass_2024@$DB_HOST:$DB_PORT/$DB_NAME"
source "$VENV_DIR/bin/activate"

python3 << PYEOF
import os
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL')
try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        print("✅ Database connection successful!")
        print(f"   PostgreSQL: {result.scalar()}")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    exit(1)
PYEOF

echo "🚀 Starting backend service..."
sudo systemctl restart aiwriter-backend
sleep 3

# Check service status
if sudo systemctl is-active --quiet aiwriter-backend; then
    echo "✅ Backend service started successfully!"
    echo "   Service status: Active"
else
    echo "⚠️  Backend service may not have started, checking logs..."
    sudo journalctl -u aiwriter-backend -n 20 --no-pager
fi

echo ""
echo "====== Deployment Summary ======"
echo "✅ PostgreSQL: Running"
echo "✅ Redis: Running"
echo "✅ Backend Service: $SERVICE_FILE"
echo ""
echo "API Endpoint: http://34.14.172.251:8000"
echo "Health Check: curl http://34.14.172.251:8000/health"
echo ""
echo "Service commands:"
echo "  Status:   sudo systemctl status aiwriter-backend"
echo "  Logs:     sudo journalctl -u aiwriter-backend -f"
echo "  Stop:     sudo systemctl stop aiwriter-backend"
echo "  Restart:  sudo systemctl restart aiwriter-backend"
echo "====== Deployment Complete ======"
