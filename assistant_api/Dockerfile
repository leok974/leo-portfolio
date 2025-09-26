## syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS base

ARG USE_UV=1
ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1 \
        PIP_DISABLE_PIP_VERSION_CHECK=1 \
        UV_LINK_MODE=copy

WORKDIR /app

# --- system deps (minimal; extend as needed) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# --- Dependency install with caching ---
# If USE_UV=1 we install uv to resolve & install faster; fallback to pip otherwise.
RUN --mount=type=cache,target=/root/.cache/pip \
        if [ "$USE_UV" = "1" ]; then \
            pip install --no-cache-dir uv && \
            uv pip install --system -r requirements.txt; \
        else \
            pip install --no-cache-dir -r requirements.txt; \
        fi

# --- App code ---
COPY . .

EXPOSE 8000
CMD ["uvicorn", "assistant_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
