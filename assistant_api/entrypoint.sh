#!/usr/bin/env sh
set -eu

MODEL="${PRIMARY_MODEL:-${OPENAI_MODEL:-gpt-oss:20b}}"
OLLAMA_HOST_VAR="${OLLAMA_HOST:-ollama}"
OLLAMA_PORT_VAR="${OLLAMA_PORT:-11434}"
TAGS_URL="http://${OLLAMA_HOST_VAR}:${OLLAMA_PORT_VAR}/api/tags"
RESPONSE=""
MAX_WAIT="${MODEL_WAIT_MAX_SECONDS:-180}"
START_TS=$(date +%s)

echo "[entrypoint] waiting for ollama API (${TAGS_URL}) (timeout=${MAX_WAIT}s)"
if [ "${DISABLE_PRIMARY:-}" = "1" ]; then
  echo "[entrypoint] DISABLE_PRIMARY=1 set – skipping primary (no wait for model)."
else
  until RESPONSE=$(curl -sSf "$TAGS_URL" 2>/dev/null); do
    sleep 2
    NOW=$(date +%s)
    ELAP=$((NOW-START_TS))
    if [ "$ELAP" -ge "$MAX_WAIT" ]; then
      echo "[entrypoint][warn] ollama API not reachable after ${ELAP}s – continuing (llm.path will be 'down' or 'fallback')."
      break
    fi
  done
fi

if [ -n "$RESPONSE" ] && [ "${DISABLE_PRIMARY:-}" != "1" ]; then
  echo "[entrypoint] checking for model tag: ${MODEL} (timeout=${MAX_WAIT}s)"
  while ! printf '%s' "$RESPONSE" | grep -q "\"name\":\"${MODEL}\""; do
    sleep 3
    NOW=$(date +%s)
    ELAP=$((NOW-START_TS))
    if [ "$ELAP" -ge "$MAX_WAIT" ]; then
      echo "[entrypoint][warn] model ${MODEL} not present after ${ELAP}s – starting anyway (status will show warming/fallback)."
      break
    fi
    RESPONSE=$(curl -sSf "$TAGS_URL" 2>/dev/null || true)
  done
fi

if [ "$#" -eq 0 ]; then
  set -- uvicorn assistant_api.main:app --host 0.0.0.0 --port 8000
fi

echo "[entrypoint] starting backend with model: ${MODEL}"
exec "$@"
