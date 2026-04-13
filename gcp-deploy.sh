#!/bin/bash
set -e

PROJECT_ID="ai-book-writer-raghav"
REGION="us-central1"
SERVICE_NAME="ai-book-writer"
DOCKERFILE_PATH="./backend/Dockerfile.prod"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Scribe House - Cloud Run Deployment ===${NC}\n"

# Step 1: Build image using Cloud Build
echo -e "${YELLOW}Step 1: Building Docker image with Cloud Build...${NC}"
gcloud builds submit ./backend \
  --config ./backend/cloudbuild.yaml \
  --project=$PROJECT_ID \
  --quiet

echo -e "${GREEN}✓ Docker image built successfully${NC}\n"

# Step 2: Deploy to Cloud Run
echo -e "${YELLOW}Step 2: Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 100 \
  --set-env-vars="ENVIRONMENT=production,DEBUG=false,ALLOWED_ORIGINS=https://scribe-house-frontend.pages.dev" \
  --set-cloudsql-instances=$PROJECT_ID:$REGION:scribe-house \
  --project=$PROJECT_ID \
  --quiet

echo -e "${GREEN}✓ Cloud Run deployment successful${NC}\n"

# Step 3: Get service URL
echo -e "${YELLOW}Step 3: Retrieving service URL...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)' \
  --project=$PROJECT_ID)

echo -e "${GREEN}✓ Service deployed at: ${SERVICE_URL}${NC}\n"

# Step 4: Update wrangler.json with backend URL
echo -e "${YELLOW}Step 4: Updating Cloudflare Worker configuration...${NC}"
cd frontend

# Create backup
cp wrangler.json wrangler.json.backup

# Update backend URL using node script (more reliable than sed)
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));
if (!config.env) config.env = {};
if (!config.env.production) config.env.production = {};
if (!config.env.production.vars) config.env.production.vars = {};
config.env.production.vars.BACKEND_URL = '$SERVICE_URL';
fs.writeFileSync('wrangler.json', JSON.stringify(config, null, 2));
console.log('Updated BACKEND_URL to:', config.env.production.vars.BACKEND_URL);
"

echo -e "${GREEN}✓ wrangler.json updated${NC}\n"

# Step 5: Deploy updated Worker
echo -e "${YELLOW}Step 5: Deploying Cloudflare Worker with updated backend URL...${NC}"
npm run deploy 2>&1 | tail -10

cd ..

echo -e "${GREEN}✓ Worker deployment complete${NC}\n"

# Step 6: Health check
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
sleep 5

echo -e "${BLUE}Testing Cloud Run service health:${NC}"
curl -s "${SERVICE_URL}/api/v1/health" | head -c 200
echo -e "\n"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "${BLUE}Frontend URL:${NC} https://scribe-house-frontend.pages.dev"
echo -e "${BLUE}Backend URL:${NC} ${SERVICE_URL}"
echo -e "${BLUE}API Endpoint:${NC} ${SERVICE_URL}/api/v1"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit the frontend URL in your browser"
echo "2. Open browser dev tools (F12)"
echo "3. Check Network tab - API calls should go to /api/v1/* and proxy through Worker"
echo "4. Verify no 4xx/5xx errors on API calls"
