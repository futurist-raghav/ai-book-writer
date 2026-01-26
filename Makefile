.PHONY: help setup start stop restart logs clean test lint format migrate

# Default target
help:
	@echo "AI Book Writer - Available Commands"
	@echo "===================================="
	@echo "setup        - Initial project setup"
	@echo "start        - Start all services"
	@echo "stop         - Stop all services"
	@echo "restart      - Restart all services"
	@echo "logs         - View logs"
	@echo "clean        - Clean up containers and volumes"
	@echo "test         - Run tests"
	@echo "lint         - Run linters"
	@echo "format       - Format code"
	@echo "migrate      - Run database migrations"
	@echo "shell-be     - Open backend shell"
	@echo "shell-fe     - Open frontend shell"

# Initial setup
setup:
	@echo "Setting up AI Book Writer..."
	@cp -n .env.example .env || true
	@echo "Please edit .env file with your configuration"
	@echo "Then run: make start"

# Start all services
start:
	@echo "Starting all services..."
	docker compose up -d
	@echo "Services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

# Stop all services
stop:
	@echo "Stopping all services..."
	docker compose down

# Restart all services
restart:
	@echo "Restarting all services..."
	docker compose restart

# View logs
logs:
	docker compose logs -f

# Clean up
clean:
	@echo "Cleaning up containers and volumes..."
	docker compose down -v
	@echo "Cleanup complete!"

# Run tests
test:
	@echo "Running backend tests..."
	docker compose exec backend pytest
	@echo "Running frontend tests..."
	docker compose exec frontend npm test

# Run linters
lint:
	@echo "Linting backend..."
	docker compose exec backend flake8 .
	@echo "Linting frontend..."
	docker compose exec frontend npm run lint

# Format code
format:
	@echo "Formatting backend..."
	docker compose exec backend black .
	docker compose exec backend isort .
	@echo "Formatting frontend..."
	docker compose exec frontend npm run format

# Run database migrations
migrate:
	@echo "Running database migrations..."
	docker compose exec backend alembic upgrade head

# Backend shell
shell-be:
	docker compose exec backend /bin/bash

# Frontend shell
shell-fe:
	docker compose exec frontend /bin/sh

# Create database backup
backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	docker compose exec -T postgres pg_dump -U aibook aibook | gzip > backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup created in backups/"

# Restore database from backup
restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	gunzip < backups/$$backup_file | docker compose exec -T postgres psql -U aibook aibook

# Build images
build:
	@echo "Building Docker images..."
	docker compose build

# Pull latest images
pull:
	@echo "Pulling latest images..."
	docker compose pull

# Show service status
status:
	docker compose ps

# View resource usage
stats:
	docker stats
