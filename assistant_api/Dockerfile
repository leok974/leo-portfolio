FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Minimal system deps; add git if you plan server-side ingest
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App + data (if you bake rag.sqlite in the image, uncomment the COPY)
COPY . .
# COPY ../data/rag.sqlite /app/data/rag.sqlite

EXPOSE 8000
CMD ["uvicorn", "assistant_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
