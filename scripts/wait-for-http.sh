#!/usr/bin/env bash
set -euo pipefail
URL="${1:-http://localhost:8080}"
TIMEOUT="${2:-60}"
end=$((SECONDS+TIMEOUT))
while true; do
  if curl -fsS -o /dev/null "$URL"; then
    echo "Ready: $URL"
    break
  fi
  if [ $SECONDS -ge $end ]; then
    echo "Timed out waiting for $URL" >&2
    exit 1
  fi
  sleep 1
done
