# Common developer commands. Run `make help`.
.PHONY: help owner e2e setup backend-setup frontend-setup migrate api worker web test lint up down

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-16s %s\n", $$1, $$2}'

setup: backend-setup frontend-setup ## Install backend and frontend dependencies

backend-setup: ## Create the Python venv and install the backend
	cd backend && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -e ".[dev]"

frontend-setup: ## Install frontend dependencies
	cd frontend && npm ci

migrate: ## Apply database migrations
	cd backend && .venv/bin/alembic upgrade head

owner: ## Create the owner login (prompts for email and password)
	@read -p "Owner email: " email; cd backend && .venv/bin/python -m app.cli create-owner --email "$$email"

e2e: ## Browser test of the running dashboard (needs E2E_EMAIL, E2E_PASSWORD; dev data only)
	node frontend/e2e/dashboard.e2e.cjs

api: ## Run the API with auto-reload on :8000
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

worker: ## Run a Celery worker
	cd backend && .venv/bin/celery -A app.worker.celery_app worker -l info --concurrency 2

web: ## Run the admin dashboard on :3000
	cd frontend && npm run dev

test: ## Run all automated tests
	cd backend && .venv/bin/pytest -q
	cd frontend && npm run typecheck && npm test

lint: ## Lint and format-check the backend
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .

up: ## Start the full stack in Docker
	docker compose up --build -d

down: ## Stop the Docker stack (data volumes are kept)
	docker compose down
