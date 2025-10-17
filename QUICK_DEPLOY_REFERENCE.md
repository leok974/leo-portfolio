# Quick Deployment Reference

## 🚀 Complete Build & Push Process

This is the workflow used on **October 14, 2025** to build and push the portfolio image to GHCR.

### PowerShell Commands (Windows)

```powershell
# Set variables
$env:IMAGE = "ghcr.io/leok974/leo-portfolio/portfolio"
$env:TAG = "prod-$(git rev-parse --short HEAD)"

# Build image (includes UI build inside container)
docker build -f Dockerfile.portfolio -t "${env:IMAGE}:${env:TAG}" .

# Tag as latest
docker tag "${env:IMAGE}:${env:TAG}" "${env:IMAGE}:latest"

# Login to GHCR (using GitHub CLI)
gh auth token | docker login ghcr.io -u leok974 --password-stdin

# Push both tags
docker push "${env:IMAGE}:${env:TAG}"
docker push "${env:IMAGE}:latest"
```

### Bash Commands (Linux/macOS)

```bash
# Set variables
export IMAGE=ghcr.io/leok974/leo-portfolio/portfolio
export TAG=prod-$(git rev-parse --short HEAD)

# Build image
docker build -f Dockerfile.portfolio -t $IMAGE:$TAG .

# Tag as latest
docker tag $IMAGE:$TAG $IMAGE:latest

# Login to GHCR
gh auth token | docker login ghcr.io -u leok974 --password-stdin

# Push both tags
docker push $IMAGE:$TAG
docker push $IMAGE:latest
```

## 📦 Using the Automated Script

```powershell
# Build and push (recommended)
.\deploy\build-and-push.ps1

# Build only (no push)
.\deploy\build-and-push.ps1 -NoPush

# Custom tag
.\deploy\build-and-push.ps1 -Tag "v1.0.0"

# Skip tagging as latest
.\deploy\build-and-push.ps1 -SkipLatest
```

## 🔄 Watchtower Auto-Deployment

### Server Setup (One Time)

Add to your server's `docker-compose.yml`:

```yaml
services:
  # Your portfolio service
  portfolio:
    image: ghcr.io/leok974/leo-portfolio/portfolio:latest
    container_name: portfolio
    restart: unless-stopped
    networks:
      - web
    # ... other config ...

  # Watchtower for auto-updates
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_POLL_INTERVAL=300  # 5 minutes
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_INCLUDE_RESTARTING=true
    command: portfolio  # Only watch portfolio container
```

### How Watchtower Works

1. **You push to GHCR** (locally or via GitHub Actions)
2. **Watchtower polls** GHCR every 5 minutes
3. **Detects new digest** for `:latest` tag
4. **Pulls new image** automatically
5. **Restarts container** with new image
6. **Done!** Zero-downtime deployment ✨

### Verify Watchtower is Working

```bash
# Check Watchtower logs
docker logs watchtower

# You should see:
# "Checking ghcr.io/leok974/leo-portfolio/portfolio:latest"
# "Found new image (digest changed)"
# "Stopping portfolio"
# "Starting portfolio"
```

## 📋 Manual Deployment (No Watchtower)

If you don't have Watchtower, deploy manually:

```bash
# SSH to server
ssh user@your-server

# Navigate to compose directory
cd /path/to/compose

# Pull latest image
docker compose pull portfolio

# Restart container
docker compose up -d portfolio

# Verify
docker compose ps portfolio
docker logs portfolio
```

## 🧪 Test Before Deploying

Always test the image locally before pushing to production:

```bash
# Run test container
docker run -d -p 8889:80 --name portfolio-test \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Wait 2 seconds
sleep 2

# Test endpoints
curl -I http://localhost:8889/
curl -I http://localhost:8889/projects.json
curl -I http://localhost:8889/favicon.svg

# Check logs
docker logs portfolio-test

# Cleanup
docker stop portfolio-test
docker rm portfolio-test
```

## 📊 Image Information

**Registry**: ghcr.io
**Organization**: leok974
**Repository**: leo-portfolio
**Full name**: ghcr.io/leok974/leo-portfolio/portfolio
**Tags**:
- `latest` (auto-deployed)
- `prod-<git-sha>` (for rollback)

**Size**: ~74 MB
**Base**: nginx:1.27-alpine
**Architecture**: Multi-stage (node:20-alpine builder + nginx production)

## 🔐 Authentication

### One-Time Setup

```bash
# Install GitHub CLI (if not already installed)
# Windows: winget install GitHub.cli
# macOS: brew install gh
# Linux: https://github.com/cli/cli#installation

# Login to GitHub
gh auth login

# Add package permissions
gh auth refresh -h github.com -s write:packages,read:packages
```

### Login to GHCR

```bash
# Using GitHub CLI (recommended)
gh auth token | docker login ghcr.io -u leok974 --password-stdin

# Or using Personal Access Token
docker login ghcr.io -u leok974
# Paste token when prompted
```

## 🎯 CI/CD with GitHub Actions

The workflow at `.github/workflows/deploy-portfolio.yml` automatically:

1. **Triggers on:**
   - Push to `main` branch
   - Changes in `apps/portfolio-ui/**`
   - Changes to `Dockerfile.portfolio`
   - Manual workflow dispatch

2. **Process:**
   - Installs dependencies
   - Builds portfolio UI
   - Builds Docker image
   - Pushes to GHCR with tags:
     - `latest`
     - `prod-<commit-sha>`
     - `<branch-name>`

3. **Result:**
   - New image in GHCR
   - Watchtower auto-deploys (if configured)
   - Or manual pull required

## 📝 Common Workflows

### Update Portfolio Content

```bash
# 1. Make changes to portfolio-ui
# 2. Commit and push to main
git add apps/portfolio-ui/
git commit -m "feat: update portfolio content"
git push origin main

# 3. GitHub Actions builds and pushes
# 4. Watchtower deploys (or manual pull)
```

### Quick Fix Deployment

```bash
# 1. Make urgent fix
# 2. Build and push directly
.\deploy\build-and-push.ps1

# 3. Watchtower deploys within 5 minutes
# 4. Or manual pull immediately
```

### Rollback to Previous Version

```bash
# SSH to server
ssh user@server

# List available tags
docker images | grep portfolio

# Or check GHCR:
# https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

# Pull specific version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:prod-abc1234

# Tag as latest
docker tag ghcr.io/leok974/leo-portfolio/portfolio:prod-abc1234 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Restart
docker compose up -d portfolio
```

## 🐛 Troubleshooting

### Build Fails

```bash
# Check Dockerfile exists
test -f Dockerfile.portfolio

# Verify you're in repo root
pwd  # should be /path/to/leo-portfolio

# Try building without cache
docker build --no-cache -f Dockerfile.portfolio -t test .
```

### Push Fails (Permission Denied)

```bash
# Refresh GitHub auth with packages scope
gh auth refresh -h github.com -s write:packages,read:packages

# Re-login to GHCR
gh auth token | docker login ghcr.io -u leok974 --password-stdin
```

### Watchtower Not Updating

```bash
# Check Watchtower logs
docker logs watchtower

# Verify poll interval
docker inspect watchtower | grep POLL_INTERVAL

# Force update manually
docker exec watchtower /watchtower --run-once portfolio
```

### Container Won't Start

```bash
# Check logs
docker logs portfolio

# Test image locally first
docker run --rm -it ghcr.io/leok974/leo-portfolio/portfolio:latest nginx -t

# Check if files exist
docker run --rm -it ghcr.io/leok974/leo-portfolio/portfolio:latest ls -la /usr/share/nginx/html/
```

## 📚 Related Documentation

- **DEPLOYMENT_CHECKLIST.md** - Complete deployment checklist
- **DEPLOY_IMAGE.md** - Comprehensive deployment guide (400+ lines)
- **IMAGE_DEPLOYMENT_COMPLETE.md** - Quick reference summary
- **deploy/nginx.portfolio-reverse-proxy.conf** - Nginx configuration example
- **deploy/docker-compose.portfolio-image.yml** - Service definition

## 🎉 Success Metrics

After deployment, verify:

- [ ] Image pushed to GHCR: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- [ ] Container running: `docker compose ps portfolio`
- [ ] Health check passing: `docker inspect portfolio | grep Health`
- [ ] Site accessible: https://assistant.ledger-mind.org
- [ ] No console errors (F12 in browser)
- [ ] All assets loading correctly
- [ ] Watchtower detecting updates (if configured)

---

**Last Updated**: October 14, 2025
**Current Image**: ghcr.io/leok974/leo-portfolio/portfolio:prod-c02887f
**Status**: ✅ Pushed to GHCR, ready for deployment
