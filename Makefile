.PHONY: deps test build run audit

# Lock dependencies from requirements.in
deps:
	./scripts/update-deps.sh

# Run pytest suite
test:
	pytest -q

# Build Docker image
build:
	DOCKER_BUILDKIT=1 docker build -t leo-portfolio-backend ./assistant_api

# Run container locally on port 8001 -> internal 8000
run:
	docker run --rm -p 8001:8000 --name leo-portfolio leo-portfolio-backend

# Security audit (ad-hoc)
audit:
	python -m pip install pip-audit && pip-audit --strict
