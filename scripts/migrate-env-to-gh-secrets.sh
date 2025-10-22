#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-leok974/leo-portfolio}"
ENV_NAME="${ENV_NAME:-production}"

# Keys we care about (order matters)
WANTED_KEYS=(
  WATCHTOWER_HTTP_API_TOKEN
  WATCHTOWER_UPDATE_URL
  FIGMA_PAT
  FIGMA_TEMPLATE_KEY
  FIGMA_TEAM_ID
  OPENAI_API_KEY
)

CANDIDATES=(
  ".env.production"
  ".env.prod"
  "deploy/.env.production"
  "deploy/.env.prod"
  "infra/.env.prod"
  "apps/portfolio-ui/.env.production"
  "apps/portfolio-ui/.env"
  "assistant_api/.env.production"
  "assistant_api/.env"
)

# Ensure gh is authenticated
gh auth status >/dev/null

# Find first value of a key across candidate files
get_val () {
  local key="$1"
  local val=""
  for f in "${CANDIDATES[@]}"; do
    [[ -f "$f" ]] || continue
    # Grep key=... (ignore comments), take first match
    line=$(grep -E "^[[:space:]]*$key[[:space:]]*=" "$f" | grep -v '^[[:space:]]*#' | head -n 1 || true)
    if [[ -n "${line:-}" ]]; then
      val="${line#*=}"
      # Trim whitespace
      val="$(echo -n "$val" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
      # Strip surrounding single/double quotes
      val="${val%\"}"; val="${val#\"}"
      val="${val%\'}"; val="${val#\'}"
      if [[ -n "$val" ]]; then
        echo -n "$val"
        return 0
      fi
    fi
  done
  return 1
}

echo "Setting secrets in environment: $ENV_NAME (repo: $REPO_SLUG)"
for key in "${WANTED_KEYS[@]}"; do
  if val="$(get_val "$key")"; then
    # Write without echoing value
    printf "%s" "$val" | gh secret set "$key" --env "$ENV_NAME" --repo "$REPO_SLUG" --body-file -
    echo "✓ $key set"
  else
    echo "• $key not found in any candidate file (skipped)"
  fi
done

echo "Done. Verify with: gh secret list --env $ENV_NAME --repo $REPO_SLUG"
