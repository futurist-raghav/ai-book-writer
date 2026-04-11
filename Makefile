SHELL := /bin/bash
DC := docker compose

.PHONY: help setup start stop restart logs clean test lint format migrate shell-be shell-fe backup restore build pull status stats verify-services ensure-running reclaim-space start-prod stop-prod restart-prod logs-prod scale-backend-prod test-notifications test-monetization

# Default target
help:
	@echo "AI Book Writer - Available Commands"
	@echo "===================================="
	@echo "setup        - Initial project setup"
	@echo "start        - Start all services"
	@echo "stop         - Stop all services"
	@echo "restart      - Restart all services"
	@echo "logs         - View logs"
	@echo "start-prod   - Start production stack (high-concurrency mode)"
	@echo "stop-prod    - Stop production stack"
	@echo "restart-prod - Restart production stack"
	@echo "logs-prod    - View production logs"
	@echo "scale-backend-prod - Scale backend replicas (usage: make scale-backend-prod REPLICAS=4)"
	@echo "clean        - Clean up containers and volumes"
	@echo "test         - Run tests"
	@echo "test-notifications - Run E2E notification tests"
	@echo "test-monetization  - Run E2E monetization tests (payout, tiers, OAuth)"
	@echo "lint         - Run linters"
	@echo "format       - Format code"
	@echo "migrate      - Run database migrations"
	@echo "shell-be     - Open backend shell"
	@echo "shell-fe     - Open frontend shell"
	@echo "status       - Show service status (all states)"
	@echo "reclaim-space - Reclaim Docker space when start/restart fails"

# Initial setup
setup:
	@echo "Setting up AI Book Writer..."
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

# Run database migrations
migrate:
	@$(MAKE) --no-print-directory ensure-running
	@echo "Running database migrations..."
	$(DC) exec -T backend alembic upgrade head

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
