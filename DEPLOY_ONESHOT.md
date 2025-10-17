# One-Shot Deployment Guide

## Quick Deploy to Production

This guide provides the fastest way to deploy your portfolio to your production server with Docker infrastructure.

---

## Prerequisites

✅ **Your server has:**
- Docker and Docker Compose running
- Nginx/Caddy/Traefik container (auto-detected as "infra")
- FastAPI backend container (auto-detected as "api")
- SSH access configured

✅ **Your local machine has:**
- Node.js and npm installed
- rsync available (or WSL on Windows)
- SSH access to your server

---

## Method 1: PowerShell Script (Windows)

### Quick Deploy

```powershell
.\deploy\deploy-oneshot.ps1 -ServerHost YOUR-SERVER-IP -ServerUser root
```

### With Options

```powershell
# Dry run (preview only)
.\deploy\deploy-oneshot.ps1 -ServerHost YOUR-SERVER-IP -ServerUser root -DryRun

# Skip build (use existing dist-portfolio/)
.\deploy\deploy-oneshot.ps1 -ServerHost YOUR-SERVER-IP -ServerUser root -SkipBuild

# Custom user
.\deploy\deploy-oneshot.ps1 -ServerHost your-server.com -ServerUser admin
```

---

## Method 2: Bash Script (Linux/macOS)

### Quick Deploy

```bash
./deploy/deploy-oneshot.sh YOUR-SERVER-IP root
```

### With Options

```bash
# Dry run (preview only)
DRY_RUN=true ./deploy/deploy-oneshot.sh YOUR-SERVER-IP root

# Skip build (use existing dist-portfolio/)
SKIP_BUILD=true ./deploy/deploy-oneshot.sh YOUR-SERVER-IP root

# Custom user
./deploy/deploy-oneshot.sh your-server.com admin
```

---

## Method 3: Manual Steps

If you prefer to run each step manually:

### 1. Build Locally

```bash
npm ci
npm run build:portfolio
```

### 2. Upload to Server

```bash
# Set your server details
SERVER_HOST="YOUR-SERVER-IP"
SERVER_USER="root"

# Upload build
rsync -az --delete dist-portfolio/ "$SERVER_USER@$SERVER_HOST":/tmp/portfolio-dist/
```

### 3. Deploy on Server

SSH into your server and run:

```bash
ssh "$SERVER_USER@$SERVER_HOST"
```

Then on the server:

```bash
# Find containers
INFRA=$(docker ps --format '{{.Names}}' | grep -iE 'infra|nginx|caddy|proxy' | head -n1)
echo "INFRA container: $INFRA"

# Determine web root
WEB_ROOT="/var/www/portfolio"
if docker exec "$INFRA" test -d /usr/share/nginx/html 2>/dev/null; then
  WEB_ROOT="/usr/share/nginx/html"
fi
echo "Web root: $WEB_ROOT"

# Copy files
docker cp /tmp/portfolio-dist/. "$INFRA":"$WEB_ROOT"/
rm -rf /tmp/portfolio-dist

# Reload proxy
docker exec "$INFRA" sh -c 'nginx -t && nginx -s reload'  # for nginx
# OR
docker exec "$INFRA" sh -lc 'caddy reload'                # for caddy

# Test
curl -I http://127.0.0.1/
```

---

## What the Script Does

1. **🏗️ Build** (if not skipped)
   - Runs `npm ci` to install dependencies
   - Runs `npm run build:portfolio`
   - Validates build output

2. **📤 Upload**
   - Uses `rsync` to upload to `/tmp/portfolio-dist/` on server
   - Efficient: only uploads changed files

3. **🔍 Auto-Detect**
   - Finds your infra container (nginx/caddy/traefik)
   - Finds your API container (backend/siteagent)
   - Determines correct web root path

4. **📂 Install**
   - Copies files from `/tmp/` into container web root
   - Uses `docker cp` for reliable transfer

5. **🔄 Reload**
   - Auto-detects proxy type (nginx/caddy/traefik)
   - Runs appropriate reload command
   - Graceful reload (no downtime)

6. **🧪 Test**
   - Tests homepage (200 OK)
   - Tests assets (200/403 OK)
   - Tests chat API (if available)

---

## Configuration

### Production Environment

The build uses `.env.production`:

```bash
VITE_SITE_ORIGIN=https://assistant.ledger-mind.org
VITE_AGENT_API_BASE=                           # Empty = same-origin
VITE_CALENDLY_URL=https://calendly.com/leoklemet-pa
VITE_LAYOUT_ENABLED=0                          # Disabled for now
```

### Container Detection

The script looks for containers with these patterns:

**Infra (reverse proxy):**
- Service names: `infra`, `nginx`, `traefik`, `caddy`, `proxy`
- Container names matching: `*nginx*`, `*caddy*`, `*traefik*`, `*proxy*`

**API (backend):**
- Service names: `api`, `siteagent`, `assistant`, `backend`
- Container names matching: `*api*`, `*backend*`, `*assistant*`

**Web root paths:**
- `/var/www/portfolio` (custom)
- `/usr/share/nginx/html` (nginx default)

---

## Troubleshooting

### rsync not found (Windows)

**Error:** `rsync: The term 'rsync' is not recognized`

**Solutions:**

1. **Use WSL** (recommended):
   ```powershell
   wsl sudo apt install rsync
   ```
   The script will auto-detect and use `wsl rsync`

2. **Install Git for Windows** (includes rsync):
   - Download from: https://git-scm.com/download/win
   - Adds rsync to PATH

3. **Use SCP instead** (slower but works):
   ```powershell
   scp -r dist-portfolio/* user@server:/tmp/portfolio-dist/
   ```

### Container not detected

**Error:** `No infra/nginx container found!`

**Solution:** Manually check containers:
```bash
ssh user@server
docker ps --format '{{.Names}}'
```

Then update the script or manually set:
```bash
INFRA="your-container-name"
docker cp /tmp/portfolio-dist/. "$INFRA":/var/www/portfolio/
```

### Permission denied (docker cp)

**Error:** `permission denied while trying to connect to Docker daemon`

**Solution:** Run with sudo or add user to docker group:
```bash
sudo usermod -aG docker $USER
# Then log out and back in
```

### Smoke tests fail

**Possible causes:**
- Container not fully restarted
- Wrong web root path
- Proxy not reloaded

**Debug:**
```bash
ssh user@server

# Check files are in container
docker exec <infra-container> ls -la /var/www/portfolio/

# Check nginx config
docker exec <infra-container> nginx -t

# Check logs
docker logs <infra-container>
```

---

## Post-Deployment Checklist

After deployment, verify:

- [ ] **Homepage loads:** https://assistant.ledger-mind.org
- [ ] **No console errors** (F12 → Console tab)
- [ ] **Assets load** (CSS, JS, images)
- [ ] **Calendly widget** displays correctly
- [ ] **Resume buttons** work (View PDF, Copy)
- [ ] **Assistant chat** opens and works
- [ ] **Navigation** works (About, Projects, Contact)
- [ ] **Mobile responsive** (test on phone)

---

## Monitoring

### View Logs

```bash
# Nginx/infra logs
ssh user@server
docker logs -f <infra-container>

# Backend API logs
docker logs -f <api-container>

# Follow live
docker logs -f --tail=100 <container>
```

### Check Status

```bash
# Container status
docker ps

# Health checks
docker inspect <container> | jq '.[0].State.Health'

# Resource usage
docker stats
```

---

## Rollback

If something goes wrong:

```bash
# Restore from backup (if you created one)
docker cp /backup/portfolio-dist/. <infra-container>:/var/www/portfolio/

# Or redeploy previous build
cd /path/to/previous/build
rsync -az --delete ./ user@server:/tmp/portfolio-dist/
ssh user@server 'docker cp /tmp/portfolio-dist/. <infra>:/var/www/portfolio/'
```

---

## Advanced: CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Portfolio

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build
        run: |
          npm ci
          npm run build:portfolio

      - name: Deploy
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan $SERVER_HOST >> ~/.ssh/known_hosts

          ./deploy/deploy-oneshot.sh $SERVER_HOST root
```

---

## Security Notes

### SSH Key Authentication

Instead of password auth, use SSH keys:

```bash
# Generate key (if you don't have one)
ssh-keygen -t ed25519 -C "your@email.com"

# Copy to server
ssh-copy-id user@server

# Test
ssh user@server "echo 'SSH key works!'"
```

### Restrict Docker Access

Only allow specific users to run docker commands:

```bash
# On server
sudo groupadd docker
sudo usermod -aG docker deploy-user
# Use deploy-user instead of root
```

---

## Quick Reference

### Deploy Commands

```bash
# PowerShell (Windows)
.\deploy\deploy-oneshot.ps1 -ServerHost SERVER -ServerUser root

# Bash (Linux/macOS)
./deploy/deploy-oneshot.sh SERVER root
```

### Dry Run

```bash
# PowerShell
.\deploy\deploy-oneshot.ps1 -ServerHost SERVER -ServerUser root -DryRun

# Bash
DRY_RUN=true ./deploy/deploy-oneshot.sh SERVER root
```

### Skip Build

```bash
# PowerShell
.\deploy\deploy-oneshot.ps1 -ServerHost SERVER -ServerUser root -SkipBuild

# Bash
SKIP_BUILD=true ./deploy/deploy-oneshot.sh SERVER root
```

---

**Ready to deploy!** 🚀

Run the deployment script with your server details and you'll be live in minutes.
