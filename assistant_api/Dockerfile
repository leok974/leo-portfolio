## syntax=docker/dockerfile:1.7

# ===========================
# Stage 1: Build wheels
# ===========================
FROM python:3.11-bookworm AS wheels
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc rustc cargo curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY requirements.in ./requirements.in
COPY requirements.txt ./requirements.txt
# Build wheels with persistent pip & wheels cache for faster rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
  --mount=type=cache,target=/wheels/cache \
  PIP_NO_CACHE_DIR=off \
  PIP_ONLY_BINARY=":all:" \
  pip wheel --prefer-binary --wheel-dir /wheels/dist -r requirements.txt

# ===========================
# Stage 2: Runtime (slim)
# ===========================
FROM python:3.11-slim AS runtime
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 APP_PORT=8000 HEALTH_URL=http://127.0.0.1:8000/ready
WORKDIR /app

# Minimal runtime deps (extend only if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install wheels (fast, reproducible)
COPY --from=wheels /wheels/dist /tmp/wheels
COPY requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
  PIP_NO_CACHE_DIR=off \
  pip install --no-index --find-links /tmp/wheels -r requirements.txt && \
  pip cache purge && \
  rm -rf /tmp/wheels

# Copy only necessary source (exclude tests, docs, etc.)
COPY . ./assistant_api
COPY entrypoint.sh ./entrypoint.sh

# Create non-root user and adjust ownership (minimal privileges)
RUN useradd --system --create-home --uid 1001 appuser && \
  mkdir -p /app/data && \
  chown -R appuser:appuser /app && \
  chmod +x /app/entrypoint.sh

EXPOSE 8000

# Container-level healthcheck using existing script
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s --retries=3 CMD python assistant_api/healthcheck.py

USER appuser

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "assistant_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
