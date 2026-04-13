#!/bin/bash

# Scribe House - Cloud Run Deployment Script
# Usage: ./scripts/deploy-cloud-run.sh <project-id> [region]

set -e

PROJECT_ID=${1:-ai-book-writer-raghav}
REGION=${2:-asia-south1}
SERVICE_NAME="scribe-house"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Scribe House to Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Step 1: Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Install Google Cloud SDK first."
    exit 1
fi

# Step 2: Set project
echo "📋 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 3: Build and push Docker image
echo "🐳 Building Docker image..."
gcloud builds submit \
    --tag ${IMAGE_NAME}:latest \
    --quiet \
    --timeout=3600s

echo "✅ Docker image built: ${IMAGE_NAME}:latest"
echo ""

# Step 4: Create Cloud SQL connection string
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:scribe-house"
echo "🗄️  Using Cloud SQL instance: $INSTANCE_CONNECTION_NAME"
echo ""

# Step 5: Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image ${IMAGE_NAME}:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 100 \
    --min-instances 1 \
    --no-gen2 \
    --set-env-vars="ENVIRONMENT=production,DEBUG=false,ALLOWED_ORIGINS=https://scribe-house-frontend.pages.dev,https://scribehouse.raghavagarwal.com" \
    --cloudsql-instances=$INSTANCE_CONNECTION_NAME \
    --update-env-vars CLOUDSQL_INSTANCE_CONNECTION_NAME=$INSTANCE_CONNECTION_NAME \
    --quiet

# Step 6: Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')

echo ""
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Service URL: $SERVICE_URL"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo ""
echo "📝 Next steps:"
echo "1. Verify the service is running: gcloud run services describe $SERVICE_NAME --region $REGION"
echo "2. View logs: gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"
echo "3. Update frontend/.env:"
echo "   NEXT_PUBLIC_API_URL=$SERVICE_URL/api/v1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
