#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
MAX_TRIES="${MAX_TRIES:-45}"
SLEEP_SECS="${SLEEP_SECS:-2}"
REQUIRE_MODEL="${REQUIRE_MODEL:-true}"

echo "[ci-warmup] Warming backend at $BASE (tries=$MAX_TRIES, sleep=${SLEEP_SECS}s, require_model=$REQUIRE_MODEL)"
for i in $(seq 1 "$MAX_TRIES"); do
  JSON=$(curl -fsS "$BASE/api/status/summary" 2>/dev/null || true)
  if [ -z "$JSON" ]; then
    echo "try $i: no response"; sleep "$SLEEP_SECS"; continue
  fi
  READY=$(jq -r '.ready // false' <<<"$JSON" 2>/dev/null || echo false)
  MODEL=$(jq -r '.primary_model_present // false' <<<"$JSON" 2>/dev/null || echo false)
  PATH=$(jq -r '.llm.path // ""' <<<"$JSON" 2>/dev/null || echo "")
  echo "try $i: ready=$READY model=$MODEL path=$PATH"
  if [ "$READY" = "true" ] && { [ "$REQUIRE_MODEL" != "true" ] || [ "$MODEL" = "true" ]; }; then
    echo "[ci-warmup] Warm ✅"; exit 0
  fi
  sleep "$SLEEP_SECS"
done
echo "[ci-warmup] Backend not warm in time" >&2
exit 1
