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
COPY requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip wheel --no-cache-dir --wheel-dir /wheels/dist -r requirements.txt

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
    pip install --no-cache-dir --no-index --find-links /tmp/wheels -r requirements.txt && \
    rm -rf /tmp/wheels

# Copy only necessary source (exclude tests, docs, etc.)
COPY assistant_api ./assistant_api
COPY assets ./assets
COPY js ./js
COPY index.html ./

EXPOSE 8000

# Container-level healthcheck (no curl dependency required, but curl present if needed)
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s --retries=3 CMD python - <<PY || exit 1
import json, os, sys, urllib.request
url = os.environ.get('HEALTH_URL','http://127.0.0.1:8000/ready')
try:
    with urllib.request.urlopen(url, timeout=5) as r:
        data = json.loads(r.read().decode() or '{}')
    sys.exit(0 if data.get('ok') else 1)
except Exception:
    sys.exit(1)
PY

CMD ["uvicorn", "assistant_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
