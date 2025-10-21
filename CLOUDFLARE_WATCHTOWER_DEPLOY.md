# Cloudflare + Watchtower Deployment Guide

## Overview

This project uses **Watchtower** to automatically pull and deploy new Docker images from GHCR. Secrets are managed via `.env` files that are NOT committed to git.

## Architecture

```
GitHub Actions (CI/CD)
  ↓ builds Docker image
ghcr.io/leok974/leo-portfolio/backend:latest
  ↓ pulled by Watchtower
Production Server (Cloudflare infrastructure)
  ↓ uses docker-compose.portfolio-prod.yml
Backend Container
  ↓ reads environment variables
  - From docker-compose.yml (ALLOWED_ORIGINS, etc.)
  - From deploy/.env.production (FIGMA_PAT, secrets)
  - From assistant_api/.env.prod (base config)
```

## Deployment Workflow

1. **Code Changes** → Push to `main` branch
2. **GitHub Actions** → Builds and pushes `:latest` image to GHCR
3. **Watchtower** → Detects new image, pulls and restarts container
4. **Secrets** → Loaded from `deploy/.env.production` (on server)

## Setting Secrets (Figma Token)

### Step 1: Create the `.env.production` file on your production server

**Location:** `deploy/.env.production` (next to `docker-compose.portfolio-prod.yml`)

**Method 1: Via Cloudflare Dashboard (if you have file upload/editor)**
- Navigate to your Cloudflare deployment
- Create/edit `deploy/.env.production`
- Add the secrets (see template below)

**Method 2: Via CI/CD Secret Deployment**
- Add `FIGMA_PAT` to GitHub Secrets
- Create a workflow to deploy the `.env.production` file
- See example workflow below

**Method 3: Manual one-time setup (if you have any server access)**
- Use Cloudflare Tunnel, serial console, or any available method
- Create the file once
- Watchtower will handle all future deployments

### Step 2: `.env.production` Template

Create this file on your production server:

```bash
# Production Secrets for Docker Compose
# Location: /path/to/deploy/.env.production

# Figma MCP Integration (Phase 51)
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE
FIGMA_TEAM_ID=your_team_id_here
FIGMA_TEMPLATE_KEY=your_template_key_here

# OpenAI Fallback (optional)
# FALLBACK_API_KEY=sk-...

# Cloudflare Access (if using)
# CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com
# CF_ACCESS_AUD=your-aud-value
# ACCESS_ALLOWED_EMAILS=admin@example.com
```

### Step 3: Restart the Backend Container

Watchtower will automatically restart when it pulls a new image. To manually restart:

```bash
# Via docker-compose
cd /path/to/deploy
docker-compose -f docker-compose.portfolio-prod.yml restart backend

# Or via Cloudflare dashboard (if available)
# Look for container restart button
```

### Step 4: Verify the Token is Loaded

Check that the environment variable is set:

```bash
# Method 1: Check container env
docker exec portfolio-backend env | grep FIGMA_PAT

# Method 2: Test the endpoint
curl -sS https://api.leoklemet.com/api/agent/brand/templates | jq .
```

## GitHub Actions Secret Deployment (Advanced)

If you want to automate `.env.production` deployment via CI/CD:

### Add GitHub Secret

1. Go to: `https://github.com/leok974/leo-portfolio/settings/secrets/actions`
2. Add secret: `FIGMA_PAT` = `figd_YOUR_FIGMA_TOKEN_HERE`

### Create Deployment Workflow

**.github/workflows/deploy-secrets.yml**

```yaml
name: Deploy Production Secrets

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  deploy-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy .env.production
        run: |
          # Create the .env file from GitHub Secrets
          cat > .env.production <<EOF
          FIGMA_PAT=${{ secrets.FIGMA_PAT }}
          FIGMA_TEAM_ID=${{ secrets.FIGMA_TEAM_ID }}
          FIGMA_TEMPLATE_KEY=${{ secrets.FIGMA_TEMPLATE_KEY }}
          EOF
          
          # Deploy via your method (rsync, scp, Cloudflare API, etc.)
          # Example: rsync -avz .env.production user@server:/path/to/deploy/
          # Or: curl to Cloudflare API to update environment
          
          echo "Secrets deployed! Restart backend container to apply."
```

## How It Works

1. **Docker Compose** reads `deploy/.env.production` and sets environment variables
2. **Backend container** receives `FIGMA_PAT` as an environment variable
3. **FastAPI app** reads `FIGMA_PAT` from `os.getenv("FIGMA_PAT")`
4. **Brand endpoints** use the token to call Figma API

## Watchtower Configuration

Your `docker-compose.portfolio-prod.yml` already has:

```yaml
labels:
  com.centurylinklabs.watchtower.enable: "true"
```

This means Watchtower will:
- Check GHCR every 5 minutes (default interval)
- Pull new `:latest` images automatically
- Restart containers with new images
- Preserve environment variables from compose file

## Security Notes

✅ **Good:**
- `.env.production` is gitignored (not committed)
- Secrets are only on production server
- GitHub push protection prevents accidental commits

❌ **Never:**
- Commit `.env.production` to git
- Include secrets in `docker-compose.yml` directly
- Share Figma token in public channels

## Troubleshooting

### Token not working?

1. **Check file exists:**
   ```bash
   ls -la /path/to/deploy/.env.production
   ```

2. **Check docker-compose reads it:**
   ```bash
   docker-compose -f docker-compose.portfolio-prod.yml config | grep FIGMA_PAT
   ```

3. **Check container environment:**
   ```bash
   docker exec portfolio-backend env | grep FIGMA
   ```

4. **Check logs:**
   ```bash
   docker logs portfolio-backend | grep -i figma
   ```

### Watchtower not updating?

1. **Check Watchtower logs:**
   ```bash
   docker logs watchtower
   ```

2. **Force update:**
   ```bash
   docker pull ghcr.io/leok974/leo-portfolio/backend:latest
   docker-compose -f docker-compose.portfolio-prod.yml up -d --force-recreate backend
   ```

## Next Steps

1. ✅ Push code changes (commit `759e1db`)
2. ⏳ Wait for CI/CD workflow to build image
3. ⏳ Create `deploy/.env.production` on production server
4. ⏳ Watchtower pulls new image and restarts
5. ⏳ Test: `curl https://api.leoklemet.com/api/agent/brand/templates`
6. ⏳ Test: Dev Overlay → Brand tab → Generate Card

## Reference

- GitHub Repo: https://github.com/leok974/leo-portfolio
- GHCR Images: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fbackend
- Watchtower Docs: https://containrrr.dev/watchtower/
