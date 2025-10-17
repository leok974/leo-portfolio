# Deploy to leoklemet.com

**Current Status**: Code is committed and pushed to GitHub
**Domain**: https://www.leoklemet.com (and https://leoklemet.com redirects to www)
**Currently Serving**: `main-QESHvkic.js` (old build)
**Need to Deploy**: `main-D0fKNExd.js` (new build with layout enabled)

---

## Deployment Architecture

```
leoklemet.com (DNS via Cloudflare)
    ↓
Cloudflare Proxy (104.21.48.10, 172.67.175.179)
    ↓
Server nginx (applylens-nginx-prod container)
    ├─ /agent/*, /chat, /api/* → ai-finance-backend-1:8000
    └─ /* → portfolio-ui:80
```

The `portfolio-ui:80` container needs to serve the updated `dist-portfolio/` files.

---

## Option 1: Update portfolio-ui Container (Recommended)

### Step 1: SSH to Production Server

```bash
ssh your-server  # Replace with your actual server
```

### Step 2: Locate portfolio-ui Container

```bash
# Find the container serving portfolio
docker ps | grep portfolio-ui

# Or check which container nginx is proxying to
docker exec applylens-nginx-prod cat /etc/nginx/conf.d/portfolio-leoklemet.com.conf | grep proxy_pass
```

### Step 3: Copy New Build to Container

**From your local machine**:

```powershell
# Create tarball of dist-portfolio
cd D:\leo-portfolio
tar -czf dist-portfolio.tar.gz dist-portfolio/

# Copy to server
scp dist-portfolio.tar.gz your-server:/tmp/

# SSH to server and update container
ssh your-server
```

**On the server**:

```bash
# Extract and copy to portfolio-ui container
cd /tmp
tar -xzf dist-portfolio.tar.gz

# Copy files to container (adjust container name as needed)
docker cp dist-portfolio/. portfolio-ui:/usr/share/nginx/html/

# Or if it's a volume mount, copy to the volume location
docker volume inspect portfolio-ui_html  # Find the mountpoint
sudo cp -r dist-portfolio/* /var/lib/docker/volumes/portfolio-ui_html/_data/
```

### Step 4: Verify Deployment

```bash
# Check what's being served
curl -s http://portfolio-ui:80/ | grep "main-"
# Should show: main-D0fKNExd.js

# Test through nginx
docker exec applylens-nginx-prod wget -qO- http://portfolio-ui:80/ | grep "main-"
# Should show: main-D0fKNExd.js
```

### Step 5: Clear Cloudflare Cache

```powershell
# From local machine (or server if CF_API_TOKEN is set there)
$headers = @{ Authorization = "Bearer $env:CF_API_TOKEN" }
$zoneId = $env:CF_ZONE_ID  # Get from CLOUDFLARE_CONFIG_COMPLETE.md

# Purge everything
Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
  -Body '{"purge_everything":true}' `
  -ContentType "application/json"

# Or enable Development Mode for 3 hours
Invoke-RestMethod -Method Patch -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/settings/development_mode" `
  -Body '{"value":"on"}' `
  -ContentType "application/json"
```

### Step 6: Verify Live

```powershell
# Wait 2-3 minutes, then check
curl.exe -k -s https://www.leoklemet.com/ | Select-String "main-D0fKNExd"

# Should see: <script type="module" crossorigin src="/assets/main-D0fKNExd.js"
```

---

## Option 2: Rebuild and Redeploy Container

If `portfolio-ui` is built from a Dockerfile that pulls from GitHub:

### Step 1: SSH to Server

```bash
ssh your-server
```

### Step 2: Pull Latest Code

```bash
cd /path/to/leo-portfolio  # Wherever the repo is cloned on server
git pull origin main
```

### Step 3: Rebuild and Restart Container

```bash
# If using docker-compose
docker-compose -f deploy/docker-compose.portfolio-prod.yml build portfolio-ui
docker-compose -f deploy/docker-compose.portfolio-prod.yml up -d portfolio-ui

# Or rebuild manually
docker build -t portfolio-ui:latest -f deploy/Dockerfile.portfolio .
docker restart portfolio-ui
```

### Step 4: Verify and Clear Cache

Same as Option 1, steps 4-6.

---

## Option 3: GitHub Actions CD (Future Enhancement)

Add a deployment job to `.github/workflows/portfolio.yml`:

```yaml
deploy-production:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  needs: build-and-test
  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 9

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build portfolio
      run: pnpm run build:portfolio

    - name: Deploy to server via SCP
      env:
        SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        SERVER_HOST: ${{ secrets.SERVER_HOST }}
        SERVER_USER: ${{ secrets.SERVER_USER }}
      run: |
        # Setup SSH
        mkdir -p ~/.ssh
        echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H $SERVER_HOST >> ~/.ssh/known_hosts

        # Create tarball and deploy
        tar -czf dist-portfolio.tar.gz dist-portfolio/
        scp dist-portfolio.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

        # Extract on server and update container
        ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
          cd /tmp
          tar -xzf dist-portfolio.tar.gz
          docker cp dist-portfolio/. portfolio-ui:/usr/share/nginx/html/
          rm -rf dist-portfolio dist-portfolio.tar.gz
        ENDSSH

    - name: Clear Cloudflare Cache
      env:
        CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        CF_ZONE_ID: ${{ secrets.CF_ZONE_ID }}
      run: |
        curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
          -H "Authorization: Bearer $CF_API_TOKEN" \
          -H "Content-Type: application/json" \
          --data '{"purge_everything":true}'
```

---

## Quick Verification Commands

### Check Local Build
```powershell
# Verify local dist-portfolio has new bundle
Get-ChildItem dist-portfolio\assets\main-*.js
# Should show: main-D0fKNExd.js
```

### Check What's Live
```powershell
# Check production
curl.exe -k -s https://www.leoklemet.com/ | Select-String 'src="/assets/main-.*\.js"'

# Expected (new): main-D0fKNExd.js
# Current (old): main-QESHvkic.js
```

### Check Backend
```powershell
# Verify backend is reachable
curl.exe -k -s https://www.leoklemet.com/agent/dev/status

# Should return: {"enabled":false,"cookie_present":false}
# Not: <!doctype html> (cached)
```

---

## Cloudflare Cache Commands

### Purge Everything
```powershell
$headers = @{ Authorization = "Bearer $env:CF_API_TOKEN" }
$zoneId = $env:CF_ZONE_ID

Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
  -Body '{"purge_everything":true}' `
  -ContentType "application/json"
```

### Enable Development Mode
```powershell
Invoke-RestMethod -Method Patch -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/settings/development_mode" `
  -Body '{"value":"on"}' `
  -ContentType "application/json"
```

### Check Development Mode Status
```powershell
Invoke-RestMethod -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/settings/development_mode" `
  | Select-Object -ExpandProperty result
```

---

## Troubleshooting

### Issue: Still Serving Old Bundle

**Check 1**: Is the new file in the container?
```bash
docker exec portfolio-ui ls -lh /usr/share/nginx/html/assets/main-*.js
```

**Check 2**: Is Cloudflare caching?
```powershell
curl.exe -k -s -I https://www.leoklemet.com/ | Select-String "cf-cache-status"
# Should show: MISS or BYPASS (not HIT)
```

**Check 3**: Force no-cache
```powershell
curl.exe -k -s -H "Cache-Control: no-cache" https://www.leoklemet.com/ | Select-String "main-"
```

**Fix**: Clear cache and wait 2-3 minutes.

### Issue: Backend Returns HTML Instead of JSON

**Cause**: Cloudflare is caching `/agent/*` paths as HTML.

**Check**: Are Page Rules active?
```powershell
Invoke-RestMethod -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/pagerules" `
  | Select-Object -ExpandProperty result `
  | Where-Object { $_.status -eq "active" }
```

**Fix**: See `CLOUDFLARE_CONFIG_COMPLETE.md` for Page Rule setup.

---

## Summary

**To deploy immediately**:
1. SSH to production server
2. Copy `dist-portfolio/` contents to `portfolio-ui` container
3. Clear Cloudflare cache
4. Wait 2-3 minutes
5. Verify at https://www.leoklemet.com/

**To automate in future**:
- Add GitHub Actions CD job (Option 3 above)
- Set secrets: `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`, `CF_API_TOKEN`, `CF_ZONE_ID`

**Current Status**:
- ✅ Local build updated (`main-D0fKNExd.js` with layout enabled)
- ✅ Code committed and pushed to GitHub
- ✅ Local docker stack running latest
- ⏳ Production `leoklemet.com` still serving old build (`main-QESHvkic.js`)
- ⏳ Need to copy files to production server

---

**Related Docs**:
- `CLOUDFLARE_CONFIG_COMPLETE.md` - Cache rules and Page Rules
- `LEOKLEMET_COM_SUMMARY.md` - Domain and nginx setup
- `FINALIZATION_COMPLETE_OCT17.md` - What was changed in this release
