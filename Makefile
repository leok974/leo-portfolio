.PHONY: deps test build run audit latency models dev cmddev hyperdev webdev prod-up prod-down prod-logs prod-rebuild tunnel-up tunnel-down env-init

# Lock dependencies from requirements.in
deps:
	./scripts/update-deps.sh

# Run pytest suite
test:
	pytest -q

# Build Docker image
build:
	DOCKER_BUILDKIT=1 docker build -f assistant_api/Dockerfile -t leo-portfolio-backend .

# Run container locally on port 8001 -> internal 8000
run:
	docker run --rm -p 8001:8000 --name leo-portfolio leo-portfolio-backend

# Security audit (ad-hoc)
audit:
	python -m pip install pip-audit && pip-audit --strict

# Quick primary latency probe (direct /models sampling)
latency:
	curl -s "http://127.0.0.1:8001/llm/primary/latency?count=8&warmup=2" | jq '.'

# Pull configured primary model (requires ollama). Override OPENAI_MODEL env if desired.
models:
	@if [ -z "$$OPENAI_MODEL" ]; then echo "OPENAI_MODEL not set; using default gpt-oss:20b"; MODEL=gpt-oss:20b; else MODEL=$$OPENAI_MODEL; fi; \
	echo "Pulling $$MODEL"; \
	ollama pull $$MODEL

# Live-reload dev server (local FastAPI with uvicorn --reload)
# Usage: make dev [PORT=8010] [HOST=127.0.0.1]
# Notes:
#  - Automatically picks up code changes under assistant_api/.
#  - If the port is busy, override with: make dev PORT=8011
#  - On Windows PowerShell: you can also run `python -m uvicorn assistant_api.main:app --reload --host 127.0.0.1 --port 8010` directly.
dev:
	@HOST=$${HOST:-127.0.0.1}; \
	PORT=$${PORT:-8010}; \
	echo "Starting dev server on $$HOST:$$PORT (reload enabled)"; \
	python -m uvicorn assistant_api.main:app --host $$HOST --port $$PORT --reload

# Command-prompt friendly dev (forces selector loop, no reload)
cmddev:
	@HOST=$${HOST:-127.0.0.1}; PORT=$${PORT:-8010}; echo "Starting cmddev on $$HOST:$$PORT"; \
	python assistant_api/run_cmddev.py

# Hypercorn alternative (may avoid uvicorn shell shutdown issue)
hyperdev:
	@HOST=$${HOST:-127.0.0.1}; PORT=$${PORT:-8010}; echo "Starting hypercorn on $$HOST:$$PORT"; \
	hypercorn assistant_api.main:app --bind $$HOST:$$PORT --workers 1 --log-level info

# Frontend static server (separate from API). Requires node + browser-sync.
# Usage: make webdev [PORT=5530]
webdev:
	@PORT=$${PORT:-5530}; echo "Starting static web server on 127.0.0.1:$$PORT"; \
	npx browser-sync start --server --no-ui --no-notify --host 127.0.0.1 --port $$PORT --files "index.html,*.css,main.js,js/**/*.js,projects/**/*.html,assets/**/*,manifest.webmanifest,sw.js,projects.json"

# --- Production stack shortcuts (deploy/docker-compose.prod.yml) ---
prod-up:
	docker compose -f deploy/docker-compose.prod.yml up -d

prod-down:
	docker compose -f deploy/docker-compose.prod.yml down

prod-logs:
	docker compose -f deploy/docker-compose.prod.yml logs -f

prod-rebuild:
	docker compose -f deploy/docker-compose.prod.yml build --pull && \
	  docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate --remove-orphans

# Cloudflare tunnel sidecar (requires deploy/docker-compose.tunnel.override.yml and secrets/cloudflared_token)
tunnel-up:
	@if [ ! -f secrets/cloudflared_token ]; then echo "secrets/cloudflared_token missing"; exit 1; fi; \
	READY=$$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/ready || true); \
	if [ "$$READY" != "200" ]; then echo "Backend not healthy (/ready $$READY). Start stack first: make prod-up"; exit 2; fi; \
	export CLOUDFLARE_TUNNEL_TOKEN=$$(cat secrets/cloudflared_token); \
	echo "Starting cloudflared tunnel (backend healthy)"; \
	docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.override.yml up -d cloudflared

tunnel-down:
	 docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.override.yml rm -sfv cloudflared || true

# Initialize .env from template (idempotent)
env-init:
	@if [ -f .env ]; then echo ".env already exists (skipping)."; else cp .env.deploy.example .env && echo "Created .env from template"; fi
