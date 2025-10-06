#!/usr/bin/env bash
set -euo pipefail

# ---- Helper functions ----
use_pkg() {
  if command -v pnpm &>/dev/null; then echo "pnpm"; return; fi
  if command -v npm  &>/dev/null; then echo "npm";  return; fi
  echo "Neither pnpm nor npm is installed." >&2
  exit 1
}

run_pkg() {
  local pkg="$(use_pkg)"
  if [[ "$pkg" == "pnpm" ]]; then
    pnpm exec "$@"
  else
    npx "$@"
  fi
}

# ---- Ensure we always execute from repo root ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
ROOT="$REPO_ROOT"

# ---- Load .env.test if present (zero-config local runs) ----
ENV_TEST_FILE="$REPO_ROOT/.env.test"
if [[ -f "$ENV_TEST_FILE" ]]; then
  echo "Loading .env.test..."
  while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    # Trim whitespace
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    # Export variable
    if [[ -n "$key" && -n "$value" ]]; then
      export "$key=$value"
      echo "  $key=$value"
    fi
  done < "$ENV_TEST_FILE"
fi

# ---- Parse options ----
FRONTEND_ONLY=0
SKIP_INFRA=0
BASELINE="${BASELINE:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend-only) FRONTEND_ONLY=1; shift ;;
    --skip-infra) SKIP_INFRA=1; shift ;;
    --baseline) BASELINE=1; shift ;;
    *) break ;;
  esac
done

# ---- Frontend-only mode ----
if [[ "$FRONTEND_ONLY" == "1" ]]; then
  echo "🎨 Frontend-only mode: CSS/UX tests without backend"
  export PLAYWRIGHT_GLOBAL_SETUP_SKIP='1'
  export BASE_URL='http://127.0.0.1:5173'
fi

# ---- Resolve dirs ----
find_dir(){ for d in "$@"; do [[ -d "$d" ]] && { realpath "$d"; return; }; done; }
BACKEND_DIR="$(find_dir apps/backend backend server api assistant_api || true)"
WEB_DIR="$(find_dir apps/web web frontend ui src || true)"
[[ -n "${WEB_DIR:-}" ]] || { echo "web dir not found"; exit 1; }

# ---- Optional shared infra ----
if [[ "$SKIP_INFRA" != "1" && "$FRONTEND_ONLY" != "1" ]]; then
  INFRA_DIR="${INFRA_DIR:-}"
  if [[ -z "$INFRA_DIR" ]]; then
    for g in "/mnt/d/infra" "../../infra" "../infra"; do
      [[ -d "$g" && -f "$g/compose.yml" ]] && { INFRA_DIR="$(realpath "$g")"; break; }
    done
  fi
  if [[ -n "${INFRA_DIR:-}" && -f "$INFRA_DIR/compose.yml" ]]; then
    echo "Starting shared infra at $INFRA_DIR..."
    ( cd "$INFRA_DIR" && docker compose up -d )
  fi
fi

# ---- Project-scoped PG for E2E ----
if [[ "$FRONTEND_ONLY" != "1" && -f "docker-compose.e2e.yml" ]]; then
  echo "Starting E2E Postgres..."
  docker compose -f docker-compose.e2e.yml up -d pg
  for i in {1..60}; do
    if docker compose -f docker-compose.e2e.yml exec -T pg pg_isready -U app -d app_e2e >/dev/null 2>&1; then break; fi
    sleep 2
  done
  echo "E2E Postgres ready"
fi

# ---- Ensure models ----
if [[ "$FRONTEND_ONLY" != "1" ]]; then
  [[ -f scripts/ensure-models.sh ]] && bash scripts/ensure-models.sh || true
  [[ -f scripts/ensure-models.ps1 ]] && pwsh scripts/ensure-models.ps1 || true
fi

# ---- Backend migrate/reset/seed ----
if [[ "$FRONTEND_ONLY" != "1" ]]; then
  E2E_DB_HOST="${E2E_DB_HOST:-127.0.0.1}"
  export DATABASE_URL="postgresql+psycopg://app:app@${E2E_DB_HOST}:5432/app_e2e"
  if [[ -n "${BACKEND_DIR:-}" ]]; then
    echo "Setting up backend at $BACKEND_DIR..."
    pushd "$BACKEND_DIR" >/dev/null
      [[ -f requirements.txt ]] && python -m pip install -r requirements.txt
      # Note: This RAG backend doesn't require migrations or seeding
    popd >/dev/null
  fi

  # ---- Backend readiness probe ----
  if curl -sf "http://127.0.0.1:8080/ready" >/dev/null 2>&1; then
    echo "✅ Backend ready"
    if curl -sf "http://127.0.0.1:8080/api/status/summary" 2>/dev/null | grep -q '"path":"fallback"'; then
      echo "⚠️  LLM backend in fallback mode (warmup/skipping). Tests will continue." >&2
      export BACKEND_MODE="fallback"
    else
      export BACKEND_MODE="warm"
    fi
  else
    echo "⚠️  Health probe failed; proceeding (hermetic flow will surface real failures)." >&2
    export BACKEND_MODE="unavailable"
  fi
fi

# ---- Web: deps + typecheck + lint ----
echo "Setting up web at $WEB_DIR..."
PKG="$(use_pkg)"
echo "Using package manager: $PKG"
pushd "$WEB_DIR" >/dev/null
  echo "Installing dependencies..."
  if [[ "$PKG" == "pnpm" ]]; then pnpm i; else npm install; fi
  echo "Running typecheck..."
  if [[ "$PKG" == "pnpm" ]]; then pnpm run typecheck; else npm run typecheck; fi
  echo "Running lint..."
  if [[ "$PKG" == "pnpm" ]]; then pnpm run lint --if-present; else npm run lint --if-present; fi
popd >/dev/null

# ---- Playwright: install browsers and run tests from project root ----
echo "Installing Playwright browsers..."
run_pkg playwright install --with-deps

export APP_ENV=dev
export ALLOW_DEV_ROUTES=1
export DEV_E2E_EMAIL="leoklemet.pa@gmail.com"
export DEV_E2E_PASSWORD="Superleo3"
export DEV_SUPERUSER_PIN="946281"
export E2E_DB_HOST="${E2E_DB_HOST:-127.0.0.1}"
export OLLAMA_HOST="http://127.0.0.1:11434"

echo "Running Playwright tests..."
if [[ "$BASELINE" == "1" ]]; then
  run_pkg playwright test --update-snapshots "$@"
else
  run_pkg playwright test "$@"
fi

echo "✅ All tests completed."
