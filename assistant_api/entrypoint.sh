#!/usr/bin/env sh
set -eu

MODEL="${PRIMARY_MODEL:-${OPENAI_MODEL:-gpt-oss:20b}}"
TAGS_URL="http://ollama:11434/api/tags"
RESPONSE=""

echo "[entrypoint] waiting for ollama API (${TAGS_URL})"
until RESPONSE=$(curl -sSf "$TAGS_URL" 2>/dev/null); do
  sleep 2
done

echo "[entrypoint] waiting for model: ${MODEL}"
until printf '%s' "$RESPONSE" | grep -q "\"name\":\"${MODEL}\""; do
  sleep 2
  RESPONSE=$(curl -sSf "$TAGS_URL" 2>/dev/null || true)
done

if [ "$#" -eq 0 ]; then
  set -- uvicorn assistant_api.main:app --host 0.0.0.0 --port 8000
fi

echo "[entrypoint] starting backend with model: ${MODEL}"
exec "$@"
