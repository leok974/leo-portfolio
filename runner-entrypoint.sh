#!/bin/bash
set -euo pipefail

# Debug: Show all env vars
echo "[gh-runner] Environment check:"
env | grep -E "GH_|RUNNER_" | while read -r line; do
  echo "[gh-runner]   $line"
done

if [ -z "${GH_RUNNER_TOKEN:-}" ]; then
  echo "[FATAL] GH_RUNNER_TOKEN is empty. Aborting." >&2
  exit 1
fi

if [ -z "${GH_REPO_URL:-}" ]; then
  echo "[FATAL] GH_REPO_URL is empty. Aborting." >&2
  exit 1
fi

echo "[gh-runner] Registering with GitHub..."
./config.sh \
  --url "$GH_REPO_URL" \
  --token "$GH_RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --work "$RUNNER_WORKDIR" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

cleanup() {
  echo "[gh-runner] Removing runner from GitHub..."
  ./config.sh remove --unattended --token "$GH_RUNNER_TOKEN" || true
}
trap cleanup EXIT SIGTERM

echo "[gh-runner] Starting runner..."
exec ./run.sh
