# Production Environment Variables Configuration

## Overview

This guide covers how to set sensitive environment variables in production that cannot be committed to git (like API tokens).

---

## Method 1: Docker Compose Environment Override (Recommended)

Create a `.env` file in the same directory as your `docker-compose.yml`:

```bash
# deploy/.env (NOT committed to git)

# Figma MCP Integration  
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE

# Add other secrets here...
```

Then reference it in your `docker-compose.yml`:

```yaml
services:
  portfolio-backend:
    image: ghcr.io/leok974/leo-portfolio/backend:latest
    env_file:
      - ../assistant_api/.env.prod  # Base config (committed)
      - .env                         # Secrets override (NOT committed)
```

---

## Method 2: Direct Environment Variable

Pass the variable directly when starting the container:

```bash
docker run -d \
  --name portfolio-backend \
  --env-file assistant_api/.env.prod \
  -e FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE \
  ghcr.io/leok974/leo-portfolio/backend:latest
```

Or with docker-compose:

```bash
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE \
docker compose up -d portfolio-backend
```

---

## Method 3: Docker Secrets (Most Secure)

### Step 1: Create Docker secret

```bash
echo "figd_YOUR_FIGMA_TOKEN_HERE" | docker secret create figma_pat -
```

### Step 2: Update docker-compose.yml

```yaml
secrets:
  figma_pat:
    external: true

services:
  portfolio-backend:
    secrets:
      - figma_pat
    environment:
      FIGMA_PAT_FILE: /run/secrets/figma_pat
```

### Step 3: Update entrypoint.sh

```bash
# Load secrets if provided
if [ -f "/run/secrets/figma_pat" ]; then
  export FIGMA_PAT=$(cat /run/secrets/figma_pat)
fi
```

---

## Current Production Setup

**File:** `assistant_api/.env.prod` (committed to git)

Contains all non-sensitive configuration:
- `DEV_OVERLAY_KEY` - OK to commit (dev-only, no production risk)
- `ADMIN_HMAC_KEY` - OK to commit (protected by CF Access in prod)
- `FIGMA_PAT` - **Placeholder only** (set via override method)

**Sensitive variables to set via override:**
- `FIGMA_PAT` - Figma personal access token
- `OPENAI_API_KEY` - OpenAI embedding API key
- `FALLBACK_API_KEY` - OpenAI fallback LLM key
- Any other API tokens/secrets

---

## Quick Deploy Command

SSH to production server and run:

```bash
cd /path/to/deploy

# Create secrets file if not exists
cat > .env << 'EOF'
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE
EOF

# Pull and restart
docker compose -f docker-compose.portfolio-prod.yml pull portfolio-backend
docker compose -f docker-compose.portfolio-prod.yml up -d portfolio-backend

# Verify
docker compose -f docker-compose.portfolio-prod.yml logs portfolio-backend | grep -i figma
```

---

## Verification

Test the dev overlay:

```bash
curl -sS https://api.leoklemet.com/api/dev/status \
  -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" | jq .
```

Expected response:
```json
{
  "allowed": true,
  "mode": "token"
}
```

Test Figma integration:

```bash
curl -sS https://api.leoklemet.com/api/agent/brand/templates | jq .
```

---

## Security Notes

1. **Never commit tokens to git** - Use GitHub's push protection as a safeguard
2. **Use different tokens per environment** - Dev, staging, production
3. **Rotate tokens regularly** - Every 90 days minimum
4. **Restrict token scopes** - Only grant necessary permissions
5. **Monitor token usage** - Check Figma/OpenAI logs for anomalies
6. **Use secrets managers in production** - AWS Secrets Manager, HashiCorp Vault, etc.

---

## References

- GitHub Secret Scanning: https://docs.github.com/code-security/secret-scanning
- Docker Secrets: https://docs.docker.com/engine/swarm/secrets/
- Figma API Tokens: https://www.figma.com/developers/api#access-tokens
