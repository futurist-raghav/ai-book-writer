SHELL := /bin/bash
DC := docker compose
DEPLOY_MODE ?= vm
DEPLOY_BRANCH ?= main
CF_PAGES_PROJECT ?= scribe-house-frontend
AUTO_COMMIT ?= 1
DEPLOY_COMMIT_MSG ?= chore: deploy scribe house updates
DEPLOY_DRY_RUN ?= 0
CLOUDFLARE_DIRECT ?= 1
GCP_PROJECT_ID ?= ai-book-writer-raghav
VM_INSTANCE_NAME ?= scribe-house
VM_ZONE ?= asia-south1-c
VM_IP ?= 35.200.193.248

# Convenience: allow `make DEPLOY_MODE=cloudflare` (without explicit target)
# to run deployment directly, while keeping plain `make` mapped to help.
ifeq ($(strip $(MAKECMDGOALS)),)
ifneq ($(filter command line environment,$(origin DEPLOY_MODE)),)
.DEFAULT_GOAL := deploy
endif
endif

.PHONY: help setup start stop restart logs clean test lint format migrate db-migrate db-reset db-status db-logs db-shell shell-be shell-fe backup restore build pull status stats verify-services ensure-running reclaim-space start-prod stop-prod restart-prod logs-prod scale-backend-prod test-notifications test-monetization deploy deploy-git deploy-cloudflare deploy-vm deploy-vm-backend deploy-vm-frontend vm-logs vm-status vm-start vm-stop vm-restart vm-shell vm-ssh frontend-build

# Default target
help:
	@echo "Scribe House - Available Commands"
	@echo "===================================="
	@echo ""
	@echo "⚡ QUICK DEPLOYMENT (One Command!):"
	@echo "deploy              - Full auto-deployment (backend + frontend + DB)"
	@echo "                      DEPLOY_MODE=vm (default), git, or cloudflare"
	@echo ""
	@echo "LOCAL DEVELOPMENT:"
	@echo "setup               - Initial project setup"
	@echo "start               - Start all services (Docker)"
	@echo "stop                - Stop all services"
	@echo "restart             - Restart all services"
	@echo "logs                - View logs"
	@echo "build               - Build Docker images"
	@echo "shell-be            - Backend Python shell"
	@echo "shell-fe            - Frontend shell"
	@echo ""
	@echo "DATABASE OPERATIONS:"
	@echo "db-migrate          - Run pending migrations (alembic upgrade head)"
	@echo "db-reset            - Reset database (WARNING: deletes all data!)"
	@echo "db-status           - Show current migration status"
	@echo "db-shell            - Open PostgreSQL shell"
	@echo "db-backup           - Backup database to backups/"
	@echo "db-restore          - Restore from backup"
	@echo ""
	@echo "VM MANAGEMENT (GCP Compute Engine):"
	@echo "vm-start            - Start VM instance"
	@echo "vm-stop             - Stop VM instance"
	@echo "vm-restart          - Restart VM instance"
	@echo "vm-shell            - SSH shell into VM"
	@echo "vm-ssh              - Direct SSH to VM"
	@echo "vm-logs             - View backend logs on VM"
	@echo "vm-status           - Check VM and backend health"
	@echo ""
	@echo "PRODUCTION (Docker Stack):"
	@echo "start-prod          - Start production stack"
	@echo "stop-prod           - Stop production stack"
	@echo "restart-prod        - Restart production stack"
	@echo "logs-prod           - View production logs"
	@echo ""
	@echo "DEVELOPMENT TOOLS:"
	@echo "test                - Run tests"
	@echo "lint                - Run linters"
	@echo "format              - Format code"
	@echo "clean               - Clean up containers/volumes"
	@echo "status              - Show service status"
	@echo "reclaim-space       - Reclaim Docker disk space"
	@echo ""
	@echo "USAGE EXAMPLES:"
	@echo "  # Full stack deployment to VM:"
	@echo "  make deploy GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248"
	@echo ""
	@echo "  # Deploy frontend only:"
	@echo "  make deploy DEPLOY_MODE=cloudflare"
	@echo ""
	@echo "  # Database operations:"
	@echo "  make db-migrate      # Run migrations"
	@echo "  make db-status       # Check status"
	@echo "  make db-backup       # Backup database"
	@echo ""
	@echo "  # VM operations:"
	@echo "  make vm-start GCP_PROJECT_ID=ai-book-writer-raghav"
	@echo "  make vm-stop GCP_PROJECT_ID=ai-book-writer-raghav"
	@echo "  make vm-status GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=35.200.193.248"

# Initial setup
setup:
	@echo "Setting up Scribe House..."
	@cp -n .env.example .env || true
	@echo "Please edit .env file with your configuration"
	@echo "Then run: make start"

# Start all services
start:
	@echo "Starting all services..."
	@$(DC) up -d --wait --wait-timeout 60 || { \
		echo "ERROR: Startup failed."; \
		echo "Tip: run 'make reclaim-space' and retry."; \
		exit 1; \
	}
	@$(MAKE) --no-print-directory verify-services
	@echo "Applying database migrations..."
	@$(DC) exec -T backend alembic upgrade head
	@echo "Services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

# Stop all services
stop:
	@echo "Stopping all services..."
	$(DC) down

# Restart all services
restart:
	@echo "Restarting all services..."
	@$(DC) up -d --force-recreate --wait --wait-timeout 90 || { \
		echo "ERROR: Restart failed."; \
		echo "Tip: run 'make reclaim-space' and retry."; \
		exit 1; \
	}
	@echo "Refreshing frontend runtime..."
	@$(DC) up -d --no-deps --build --force-recreate frontend || { \
		echo "ERROR: Frontend refresh failed."; \
		echo "Tip: run 'make reclaim-space' and retry."; \
		exit 1; \
	}
	@$(MAKE) --no-print-directory verify-services
	@echo "Applying database migrations..."
	@$(DC) exec -T backend alembic upgrade head

# Start production stack (non-dev runtimes + tuned defaults)
start-prod:
	@echo "Starting production stack..."
	@$(DC) -f docker-compose.prod.yml up -d --build --wait --wait-timeout 120 || { \
		echo "ERROR: Production startup failed."; \
		echo "Tip: run 'make reclaim-space' and retry."; \
		exit 1; \
	}
	@echo "Applying database migrations..."
	@$(DC) -f docker-compose.prod.yml exec -T backend alembic upgrade head
	@echo "Production services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"

# Stop production stack
stop-prod:
	@echo "Stopping production stack..."
	$(DC) -f docker-compose.prod.yml down

# Restart production stack
restart-prod:
	@echo "Restarting production stack..."
	@$(DC) -f docker-compose.prod.yml up -d --build --force-recreate --wait --wait-timeout 120 || { \
		echo "ERROR: Production restart failed."; \
		echo "Tip: run 'make reclaim-space' and retry."; \
		exit 1; \
	}
	@echo "Applying database migrations..."
	@$(DC) -f docker-compose.prod.yml exec -T backend alembic upgrade head

# View production logs
logs-prod:
	$(DC) -f docker-compose.prod.yml logs -f

# Scale backend API replicas in production stack
scale-backend-prod:
	@if [ -z "$(REPLICAS)" ]; then \
		echo "Usage: make scale-backend-prod REPLICAS=4"; \
		exit 1; \
	fi
	$(DC) -f docker-compose.prod.yml up -d --scale backend=$(REPLICAS) --no-recreate

# View logs
logs:
	$(DC) logs -f

# Clean up
clean:
	@echo "Cleaning up containers and volumes..."
	$(DC) down -v
	@echo "Cleanup complete!"

# Run tests
test:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Running backend tests..."
	$(DC) exec -T backend pytest
	@echo "Running frontend tests..."
	$(DC) exec -T frontend npm test

# Run E2E notification tests
test-notifications:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Running notification E2E tests..."
	@echo "Note: This requires a bearer token. Get it from:"
	@echo "  1. Login to frontend at http://localhost:3000"
	@echo "  2. Open DevTools and get token from localStorage (auth_token)"
	@echo "  3. Run: make test-notifications TOKEN=your_bearer_token"
	@if [ -z "$(TOKEN)" ]; then \
		echo "ERROR: TOKEN is required"; \
		exit 1; \
	fi
	@python scripts/test_notifications_e2e.py \
		--api-url http://localhost:8000 \
		--token $(TOKEN) \
		--verbose
	@echo "Notification tests complete!"

# Run E2E monetization tests
test-monetization:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Running monetization E2E tests..."
	@echo "Note: This requires a bearer token and book ID. Get them from:"
	@echo "  1. Token: Login to frontend, get from localStorage (auth_token)"
	@echo "  2. Book ID: GET http://localhost:8000/api/v1/books | jq '.items[0].id'"
	@echo "  3. Run: make test-monetization TOKEN=token BOOK_ID=book_id"
	@if [ -z "$(TOKEN)" ]; then \
		echo "ERROR: TOKEN is required"; \
		exit 1; \
	fi
	@if [ -z "$(BOOK_ID)" ]; then \
		echo "ERROR: BOOK_ID is required"; \
		exit 1; \
	fi
	@python scripts/test_monetization_e2e.py \
		--api-url http://localhost:8000 \
		--token $(TOKEN) \
		--book-id $(BOOK_ID)
	@echo "Monetization tests complete!"

# Run linters
lint:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Linting backend..."
	$(DC) exec -T backend flake8 .
	@echo "Linting frontend..."
	$(DC) exec -T frontend npm run lint

# Format code
format:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Formatting backend..."
	$(DC) exec -T backend black .
	$(DC) exec -T backend isort .
	@echo "Formatting frontend..."
	$(DC) exec -T frontend npm run format

# Database management commands
db-migrate:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Running database migrations..."
	$(DC) exec -T backend alembic upgrade head

# Backward compatibility alias
migrate: db-migrate

# Check database migration status
db-status:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Current migration status:"
	$(DC) exec -T backend alembic current

# Reset database (WARNING: Deletes all data!)
db-reset:
	@echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
	@echo -n "Are you sure? Type 'yes' to continue: "; \
	read response; \
	if [ "$$response" = "yes" ]; then \
		echo "Dropping database..."; \
		$(DC) exec -T postgres dropdb -U aibook aibook --if-exists; \
		echo "Creating fresh database..."; \
		$(DC) exec -T postgres createdb -U aibook aibook; \
		echo "Running migrations..."; \
		$(DC) exec -T backend alembic upgrade head; \
		echo "✅ Database reset complete"; \
	else \
		echo "Cancelled."; \
	fi

# PostgreSQL shell
db-shell:
	@$(MAKE) --no-print-directory ensure-running
	$(DC) exec postgres psql -U aibook aibook

# View database logs
db-logs:
	$(DC) logs postgres -f

# Backup database
db-backup: backup

# Restore database
db-restore: restore

# Backend shell
shell-be:
	$(DC) exec backend /bin/bash

# Frontend shell
shell-fe:
	$(DC) exec frontend /bin/sh

# Create database backup
backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	$(DC) exec -T postgres pg_dump -U aibook aibook | gzip > backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup created in backups/"

# Restore database from backup
restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	gunzip < backups/$$backup_file | $(DC) exec -T postgres psql -U aibook aibook

# Build images
build:
	@echo "Building Docker images..."
	$(DC) build

# Build frontend bundle used by deployment flows
frontend-build:
	@echo "Building frontend for deployment..."
	npm --prefix frontend run build

# Deploy website via selected mode
deploy: frontend-build
	@if [ "$(DEPLOY_MODE)" = "vm" ]; then \
		$(MAKE) --no-print-directory deploy-vm-orchestrated; \
	elif [ "$(DEPLOY_MODE)" = "cloudflare" ]; then \
		$(MAKE) --no-print-directory deploy-cloudflare; \
	else \
		$(MAKE) --no-print-directory deploy-git; \
	fi

# Unified VM deployment with auto-commit
deploy-vm-orchestrated:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make deploy DEPLOY_MODE=vm GCP_PROJECT_ID=ai-book-writer-raghav"; \
		exit 1; \
	fi
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set. Usage: make deploy DEPLOY_MODE=vm VM_IP=35.x.x.x"; \
		exit 1; \
	fi
	@echo "🚀 Starting unified Scribe House deployment to VM..."
	@echo ""
	@echo "📝 Step 1: Auto-commit changes..."
	@if [ -n "$$(git status --porcelain)" ]; then \
		if [ "$(AUTO_COMMIT)" = "1" ]; then \
			echo "Auto-committing pending changes..."; \
			git add -A; \
			git commit -m "chore: auto-commit pre-deployment changes"; \
			echo "✅ Changes committed"; \
		else \
			echo "⚠️  Working tree is dirty. Skipping auto-commit."; \
		fi; \
	else \
		echo "✅ Working tree clean"; \
	fi
	@echo ""
	@echo "📦 Step 2: Deploying backend to VM..."
	@$(MAKE) --no-print-directory deploy-vm-backend GCP_PROJECT_ID=$(GCP_PROJECT_ID) VM_IP=$(VM_IP)
	@echo ""
	@echo "🌐 Step 3: Deploying frontend..."
	@$(MAKE) --no-print-directory deploy-vm-frontend VM_IP=$(VM_IP)
	@echo ""
	@echo "✅ Full VM deployment complete!"
	@echo ""
	@echo "Your Scribe House instance is running:"
	@echo "  Backend API: http://$(VM_IP):8000"
	@echo "  API Docs: http://$(VM_IP):8000/docs"
	@echo "  Frontend: https://scribe-house-frontend.pages.dev"
	@echo "  Admin: admin@scribehouse.raghavagarwal.com"

# Deploy through git-integrated hosting (push to branch)
deploy-git:
	@current_branch=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$current_branch" != "$(DEPLOY_BRANCH)" ]; then \
		echo "ERROR: Current branch is '$$current_branch'. Switch to '$(DEPLOY_BRANCH)' or pass DEPLOY_BRANCH=..."; \
		exit 1; \
	fi
	@if [ -n "$$(git status --porcelain)" ]; then \
		if [ "$(DEPLOY_DRY_RUN)" = "1" ]; then \
			echo "DRY RUN: working tree is dirty; would auto-commit with message: $(DEPLOY_COMMIT_MSG)"; \
		elif [ "$(AUTO_COMMIT)" = "1" ]; then \
			echo "Working tree is dirty. Auto-committing changes for deployment..."; \
			git add -A; \
			git commit -m "$(DEPLOY_COMMIT_MSG)"; \
		else \
			echo "WARNING: Working tree is dirty. Pushing current HEAD only (uncommitted changes are not deployed)."; \
		fi; \
	fi
	@echo "Pushing $(DEPLOY_BRANCH) to origin (hosted deploy will trigger automatically)..."
	@if [ "$(DEPLOY_DRY_RUN)" = "1" ]; then \
		echo "DRY RUN: git push origin $(DEPLOY_BRANCH)"; \
	else \
		git push origin $(DEPLOY_BRANCH); \
	fi
	@echo "Deploy trigger complete."

# Direct deploy to Cloudflare Pages using next-on-pages + wrangler
deploy-cloudflare:
	@if [ "$(CLOUDFLARE_DIRECT)" != "1" ]; then \
		echo "Cloudflare direct mode is disabled by default for this dynamic Next.js app."; \
		echo "Falling back to git-integrated deployment trigger..."; \
		$(MAKE) --no-print-directory deploy-git; \
	else \
		if ! command -v node >/dev/null 2>&1; then \
			echo "ERROR: node is required for Cloudflare deployment."; \
			exit 1; \
		fi; \
		echo "Building Cloudflare Pages output with next-on-pages..."; \
		(cd frontend && npx --yes @cloudflare/next-on-pages@1); \
		echo "Deploying to Cloudflare Pages project '$(CF_PAGES_PROJECT)'..."; \
		(cd frontend && npx --yes wrangler pages deploy .vercel/output/static --project-name "$(CF_PAGES_PROJECT)" --branch "$(DEPLOY_BRANCH)"); \
		echo "Cloudflare deployment complete."; \
	fi

# Deploy backend to Google Cloud Run
deploy-cloud-run:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make deploy-cloud-run GCP_PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@if ! command -v gcloud >/dev/null 2>&1; then \
		echo "ERROR: gcloud CLI not found. Install Google Cloud SDK."; \
		exit 1; \
	fi
	@echo "🚀 Deploying Scribe House backend to Cloud Run..."
	@echo "Project ID: $(GCP_PROJECT_ID)"
	@echo "Region: asia-south1"
	@gcloud config set project $(GCP_PROJECT_ID)
	@echo "Building and pushing Docker image..."
	@gcloud builds submit \
		--tag gcr.io/$(GCP_PROJECT_ID)/scribe-house:latest \
		--quiet \
		--timeout=3600s
	@echo "Deploying to Cloud Run..."
	@gcloud run deploy scribe-house \
		--image gcr.io/$(GCP_PROJECT_ID)/scribe-house:latest \
		--platform managed \
		--region asia-south1 \
		--allow-unauthenticated \
		--memory 2Gi \
		--cpu 2 \
		--timeout 3600 \
		--max-instances 100 \
		--min-instances 1 \
		--set-env-vars ENVIRONMENT=production,DEBUG=false,ALLOWED_ORIGINS=https://scribe-house-frontend.pages.dev,https://scribehouse.raghavagarwal.com \
		--cloudsql-instances=$(GCP_PROJECT_ID):asia-south1:scribe-house \
		--quiet
	@SERVICE_URL=$$(gcloud run services describe scribe-house --region asia-south1 --format='value(status.url)'); \
	echo ""; \
	echo "✅ Deployment complete!"; \
	echo "Service URL: $$SERVICE_URL"; \
	echo ""; \
	echo "Next: Update frontend/.env with:"; \
	echo "NEXT_PUBLIC_API_URL=$$SERVICE_URL/api/v1"

##############################################################################
# VM DEPLOYMENT TARGETS
##############################################################################

# Full VM deployment: backend + database migrations + frontend config
deploy-vm:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make deploy-vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x"; \
		exit 1; \
	fi
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set. Usage: make deploy-vm GCP_PROJECT_ID=ai-book-writer-raghav VM_IP=34.x.x.x"; \
		exit 1; \
	fi
	@echo "🚀 Deploying Scribe House to VM..."
	@echo "GCP Project: $(GCP_PROJECT_ID)"
	@echo "VM IP: $(VM_IP)"
	@echo ""
	@$(MAKE) --no-print-directory deploy-vm-backend GCP_PROJECT_ID=$(GCP_PROJECT_ID) VM_IP=$(VM_IP)
	@$(MAKE) --no-print-directory deploy-vm-frontend VM_IP=$(VM_IP)
	@echo ""
	@echo "✅ Full VM deployment complete!"
	@echo ""
	@echo "Your Scribe House instance is now running:"
	@echo "  Backend API: http://$(VM_IP):8000"
	@echo "  API Docs: http://$(VM_IP):8000/docs"
	@echo "  Frontend: https://scribe-house-frontend.pages.dev"

# Deploy only backend code to VM
deploy-vm-backend:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set."; \
		exit 1; \
	fi
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set."; \
		exit 1; \
	fi
	@echo "📦 Deploying backend to VM at $(VM_IP)..."
	@echo "Setting up GCP project..."
	@gcloud config set project $(GCP_PROJECT_ID) --quiet
	@echo ""
	@echo "Creating deployment directory on VM..."
	@gcloud compute ssh scribe-house --zone=asia-south1-c --project=$(GCP_PROJECT_ID) --command="mkdir -p /tmp/scribe-house-backend" 2>&1 | grep -v "WARNING:" || true
	@echo "Uploading deployment script..."
	@gcloud compute scp backend/deploy-vm.sh scribe-house:/tmp/scribe-house-backend/deploy-vm.sh --zone=asia-south1-c --project=$(GCP_PROJECT_ID) 2>&1 | grep -v "WARNING:" || true
	@echo "Uploading requirements file..."
	@gcloud compute scp backend/requirements.txt scribe-house:/tmp/scribe-house-backend/requirements.txt --zone=asia-south1-c --project=$(GCP_PROJECT_ID) 2>&1 | grep -v "WARNING:" || true
	@echo "Uploading migrations..."
	@gcloud compute scp --recurse backend/alembic scribe-house:/tmp/scribe-house-backend/ --zone=asia-south1-c --project=$(GCP_PROJECT_ID) 2>&1 | grep -v "WARNING:" || true
	@echo "Uploading application code..."
	@gcloud compute scp --recurse backend/app scribe-house:/tmp/scribe-house-backend/ --zone=asia-south1-c --project=$(GCP_PROJECT_ID) 2>&1 | grep -v "WARNING:" || true
	@echo ""
	@echo "Running deployment script on VM..."
	@gcloud compute ssh scribe-house --zone=asia-south1-c --project=$(GCP_PROJECT_ID) --command="bash /tmp/scribe-house-backend/deploy-vm.sh" 2>&1
	@echo "✅ Backend deployment complete"

# Deploy only frontend config (connects to existing VM backend)
deploy-vm-frontend:
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set. Provide the VM IP for frontend config."; \
		exit 1; \
	fi
	@echo "🌐 Deploying frontend to Cloudflare Pages..."
	@echo "Backend URL: http://$(VM_IP):8000/api/v1"
	@echo ""
	@echo "Updating frontend environment..."
	@echo "NEXT_PUBLIC_API_URL=http://$(VM_IP):8000/api/v1" > frontend/.env.production
	@echo ""
	@echo "Building frontend..."
	@npm --prefix frontend run build
	@echo ""
	@echo "Deploying to Cloudflare Pages..."
	@(cd frontend && npx --yes @cloudflare/next-on-pages@1)
	@(cd frontend && npx --yes wrangler pages deploy .vercel/output/static --project-name "$(CF_PAGES_PROJECT)" --branch "$(DEPLOY_BRANCH)")
	@echo "✅ Frontend deployment complete"

# View backend logs on VM
vm-logs:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set."; \
		exit 1; \
	fi
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set."; \
		exit 1; \
	fi
	@VM_NAME="scribe-house"
	@gcloud config set project $(GCP_PROJECT_ID) --quiet
	@echo "📋 Backend logs on VM..."
	@gcloud compute ssh $$VM_NAME \
		--zone=asia-south1-c \
		--command="sudo journalctl -u aiwriter-backend -f -n 100"

# Check backend status on VM
vm-status:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set."; \
		exit 1; \
	fi
	@if [ -z "$(VM_IP)" ]; then \
		echo "ERROR: VM_IP not set."; \
		exit 1; \
	fi
	@VM_NAME="scribe-house"
	@gcloud config set project $(GCP_PROJECT_ID) --quiet
	@echo "🔍 Backend status on VM..."
	@gcloud compute ssh $$VM_NAME \
		--zone=asia-south1-c \
		--command="sudo systemctl status aiwriter-backend --no-pager && echo && curl -s http://127.0.0.1:8000/health | jq ."

# Start VM instance
vm-start:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make vm-start GCP_PROJECT_ID=ai-book-writer-raghav"; \
		exit 1; \
	fi
	@VM_NAME="$(VM_INSTANCE_NAME)"
	@echo "▶️  Starting VM instance: $$VM_NAME"
	@gcloud compute instances start $$VM_NAME \
		--zone=$(VM_ZONE) \
		--project=$(GCP_PROJECT_ID) \
		--quiet
	@echo "✅ VM started. Waiting for services to be ready..."
	@sleep 5
	@echo "Instance will be available in a few moments."

# Stop VM instance
vm-stop:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make vm-stop GCP_PROJECT_ID=ai-book-writer-raghav"; \
		exit 1; \
	fi
	@VM_NAME="$(VM_INSTANCE_NAME)"
	@echo "⏹️  Stopping VM instance: $$VM_NAME"
	@gcloud compute instances stop $$VM_NAME \
		--zone=$(VM_ZONE) \
		--project=$(GCP_PROJECT_ID) \
		--quiet
	@echo "✅ VM stopped"

# Restart VM instance
vm-restart:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make vm-restart GCP_PROJECT_ID=ai-book-writer-raghav"; \
		exit 1; \
	fi
	@VM_NAME="$(VM_INSTANCE_NAME)"
	@echo "🔄 Restarting VM instance: $$VM_NAME"
	@gcloud compute instances stop $$VM_NAME \
		--zone=$(VM_ZONE) \
		--project=$(GCP_PROJECT_ID) \
		--quiet
	@sleep 2
	@gcloud compute instances start $$VM_NAME \
		--zone=$(VM_ZONE) \
		--project=$(GCP_PROJECT_ID) \
		--quiet
	@echo "✅ VM restarting. Services will be available shortly."

# SSH into VM instance (interactive shell)
vm-shell: vm-ssh

# SSH into VM instance
vm-ssh:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make vm-ssh GCP_PROJECT_ID=ai-book-writer-raghav"; \
		exit 1; \
	fi
	@VM_NAME="$(VM_INSTANCE_NAME)"
	@echo "🖥️  Connecting to VM: $$VM_NAME..."
	@gcloud compute ssh $$VM_NAME \
		--zone=$(VM_ZONE) \
		--project=$(GCP_PROJECT_ID)

# View Cloud Run service logs
cloud-run-logs:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make cloud-run-logs GCP_PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@gcloud config set project $(GCP_PROJECT_ID)
	@gcloud run services logs read scribe-house --region asia-south1 --limit 100 --follow

# Describe Cloud Run service
cloud-run-describe:
	@if [ -z "$(GCP_PROJECT_ID)" ]; then \
		echo "ERROR: GCP_PROJECT_ID not set. Usage: make cloud-run-describe GCP_PROJECT_ID=your-project-id"; \
		exit 1; \
	fi
	@gcloud config set project $(GCP_PROJECT_ID)
	@gcloud run services describe scribe-house --region asia-south1

# Pull latest images
pull:
	@echo "Pulling latest images..."
	$(DC) pull

# Show service status
status:
	$(DC) ps --all

# View resource usage
stats:
	docker stats

# Verify all services are running and not unhealthy/exited
verify-services:
	@echo "Current service status:"
	@$(DC) ps --all
	@if [ -n "$$($(DC) ps --status exited -q)" ]; then \
		echo "ERROR: One or more services have exited."; \
		echo "Run 'make logs' for details."; \
		exit 1; \
	fi
	@if [ -n "$$($(DC) ps --status restarting -q)" ]; then \
		echo "ERROR: One or more services are restarting continuously."; \
		echo "Run 'make logs' for details."; \
		exit 1; \
	fi
	@if $(DC) ps | grep -qi "unhealthy"; then \
		echo "ERROR: One or more services are unhealthy."; \
		echo "Run 'make logs' for details."; \
		exit 1; \
	fi

# Ensure core services are running before exec commands
ensure-running:
	@if [ -z "$$($(DC) ps --status running -q backend)" ] || [ -z "$$($(DC) ps --status running -q frontend)" ]; then \
		echo "Core services are not running. Starting them now..."; \
		$(MAKE) --no-print-directory start; \
	fi
	@$(MAKE) --no-print-directory verify-services

# Reclaim Docker disk space safely (preserves named volumes/data)
reclaim-space:
	@echo "Reclaiming Docker build cache and unused artifacts..."
	docker builder prune -af
	docker system prune -f
	@echo "Reclaim complete. Run 'make start'."
