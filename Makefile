.PHONY: deps test build run audit latency models dev

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
