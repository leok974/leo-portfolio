# Figma Token Deployment Summary

## What We Did

### 1. Updated Docker Compose Configuration ✅
- **File:** `deploy/docker-compose.portfolio-prod.yml`
- **Changes:** Added Figma environment variables to backend service:
  ```yaml
  - FIGMA_PAT=${FIGMA_PAT:-}
  - FIGMA_TEAM_ID=${FIGMA_TEAM_ID:-}
  - FIGMA_TEMPLATE_KEY=${FIGMA_TEMPLATE_KEY:-}
  ```
- **Commit:** `759e1db` - feat: Add Figma token env vars to production compose

### 2. Created .gitignore Rules ✅
- **File:** `.gitignore`
- **Added:** Exclusions for `deploy/.env.production` and related files
- **Purpose:** Prevent accidental commit of production secrets

### 3. Created Deployment Documentation ✅
- **File:** `CLOUDFLARE_WATCHTOWER_DEPLOY.md`
- **Content:** Complete guide for Cloudflare + Watchtower deployment
- **Includes:**
  - Architecture overview
  - Secret deployment methods
  - Troubleshooting guide
  - Verification steps

### 4. Created Helper Script ✅
- **File:** `deploy-secrets.ps1`
- **Purpose:** Assists with deploying `.env.production` file
- **Features:**
  - Creates template file
  - Supports multiple deployment methods
  - Validates content

### 5. Created Local Template ✅
- **File:** `deploy/.env.production` (LOCAL ONLY - not committed)
- **Contains:** Your Figma token and other secrets
- **Status:** Ready to deploy to production server

## Deployment Status

### Code Deployment
- ✅ **Commit `759e1db`** - Docker Compose changes pushed
- ✅ **Commit `5b23909`** - Documentation pushed
- 🔄 **Workflow #18693830892** - Backend image building (in progress)
- ⏳ **Watchtower** - Will auto-pull new image when ready

### Secret Deployment
- ✅ **Local:** `deploy/.env.production` created with real token
- ⏳ **Production:** Need to deploy `.env.production` to server
- ⏳ **Container:** Will read `FIGMA_PAT` after restart

## Next Steps (What YOU Need to Do)

### Option A: Manual Deployment (Recommended if you have any server access)

1. **Copy the file to your server:**
   - **File:** `deploy/.env.production`
   - **Destination:** `/path/to/deploy/.env.production` (next to docker-compose.portfolio-prod.yml)
   - **Method:** Use whatever access you have:
     - Cloudflare dashboard file upload
     - Cloudflare Tunnel + scp
     - Serial console
     - Any other method

2. **Restart the backend container:**
   ```bash
   cd /path/to/deploy
   docker-compose -f docker-compose.portfolio-prod.yml restart backend
   ```

3. **Verify:**
   ```bash
   # Check env var
   docker exec portfolio-backend env | grep FIGMA_PAT
   
   # Test endpoint
   curl https://api.leoklemet.com/api/agent/brand/templates
   ```

### Option B: GitHub Actions Deployment

If you want to automate this:

1. **Add GitHub Secret:**
   - Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
   - Add: `FIGMA_PAT` = `figd_YOUR_FIGMA_TOKEN_HERE`

2. **Create deployment workflow** (I can help with this if needed)

3. **Run workflow to deploy secrets**

### Option C: Cloudflare Dashboard

If Cloudflare provides environment variable management:

1. **Navigate to your deployment settings**
2. **Add environment variables:**
   - `FIGMA_PAT` = `figd_YOUR_FIGMA_TOKEN_HERE`
3. **Restart service**

## How It Works

```
┌─────────────────────────────────────────────────────┐
│ 1. GitHub Actions builds Docker image               │
│    Image: ghcr.io/.../backend:latest                │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 2. Watchtower detects new image                     │
│    Pulls: ghcr.io/.../backend:latest                │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 3. Docker Compose reads .env.production             │
│    Sets: FIGMA_PAT=figd_d2P6J_...                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ 4. Backend container starts with env vars           │
│    FastAPI reads: os.getenv("FIGMA_PAT")            │
└─────────────────────────────────────────────────────┘
```

## Testing the Integration

Once the token is deployed:

### 1. Test Dev Overlay
Visit: `https://www.leoklemet.com/?dev_overlay=dev`

Check:
- ✅ Dev overlay shows `allowed: true`
- ✅ "Brand" tab is visible
- ✅ "Projects" and "Brand" tabs both work

### 2. Test Brand Endpoints

```bash
# List templates
curl https://api.leoklemet.com/api/agent/brand/templates

# Get design tokens
curl https://api.leoklemet.com/api/agent/brand/tokens?file_key=YOUR_FILE_KEY

# Generate business card (requires template setup)
curl -X POST https://api.leoklemet.com/api/agent/brand/card \
  -H "Content-Type: application/json" \
  -d '{"name":"Leo Klement","role":"Full-Stack Developer","email":"leo@example.com"}'
```

### 3. Test Brand Tab UI

1. Open dev overlay
2. Click "Brand" tab
3. Fill in the form:
   - Name: Leo Klement
   - Role: Full-Stack Developer
   - Email: leo@example.com
4. Click "Generate Business Card"
5. Verify:
   - Loading spinner appears
   - Preview displays
   - "Open in Figma" button works
   - Download links work

## Files Reference

### Committed to Git ✅
- ✅ `deploy/docker-compose.portfolio-prod.yml` - Updated with env vars
- ✅ `.gitignore` - Excludes .env.production
- ✅ `CLOUDFLARE_WATCHTOWER_DEPLOY.md` - Deployment guide
- ✅ `deploy-secrets.ps1` - Helper script

### Local Only (NOT in git) ❌
- ❌ `deploy/.env.production` - Contains real secrets
- ❌ `assistant_api/.env` - Local dev secrets

### Production Server (Need to deploy) ⏳
- ⏳ `deploy/.env.production` - Must be copied to server

## Troubleshooting

### "Token not found" errors?
1. Check file exists on server: `ls -la /path/to/deploy/.env.production`
2. Check Docker Compose reads it: `docker-compose config | grep FIGMA`
3. Check container env: `docker exec portfolio-backend env | grep FIGMA`

### Watchtower not updating?
1. Check logs: `docker logs watchtower`
2. Force update: `docker pull ghcr.io/.../backend:latest && docker-compose up -d --force-recreate`

### Still getting 401/403 from Figma API?
1. Verify token is correct in `.env.production`
2. Check token has not expired
3. Verify token has access to the Figma files/team

## Security Notes

✅ **Good:**
- Token stored only in `.env.production` (not in git)
- GitHub push protection prevents accidental commits
- Docker Compose reads from local file (not in image)

❌ **Never:**
- Commit `.env.production` to git
- Include token in docker-compose.yml directly
- Share token in public channels

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Code | ✅ Deployed | Commit `5b23909` |
| Docker Image | 🔄 Building | Workflow #18693830892 |
| Figma Token (local) | ✅ Ready | In `deploy/.env.production` |
| Figma Token (prod) | ⏳ Pending | Need to deploy file |
| Dev Overlay Auth | ✅ Fixed | Deployed in previous commit |
| Brand Endpoints | ⏳ Waiting | Need token to work |

## Questions?

See the full deployment guide: `CLOUDFLARE_WATCHTOWER_DEPLOY.md`

Or let me know how you'd like to deploy the `.env.production` file and I can help with that method!
