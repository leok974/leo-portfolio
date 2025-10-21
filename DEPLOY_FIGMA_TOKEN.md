# 🚀 Deploy Figma Token - Quick Reference

## ✅ Pre-Deployment Status

- ✅ **Code deployed**: Commit `4127200` (all Phase 51 code)
- ✅ **Docker image built**: Workflow #18693948454 completed successfully
- ✅ **Watchtower ready**: Will auto-pull `:latest` tag
- ✅ **Local secrets file**: `deploy/.env.production` ready with token
- ✅ **Protected from git**: `.gitignore` prevents accidental commits

## 📦 What You Need to Deploy

**File:** `deploy/.env.production`

**Contents:**
```bash
# Figma MCP Integration (Phase 51)
FIGMA_PAT=figd_*************************
FIGMA_TEAM_ID=123456789012345678
FIGMA_TEMPLATE_KEY=AbCdEfGhIjKlMnOp
```

**Destination:** Same directory as `docker-compose.portfolio-prod.yml` on production server

## 🎯 Deployment Steps

### Option A: Deploy via Docker Compose (Recommended)

1. **Copy `.env.production` to your production server**
   - Use Cloudflare dashboard, tunnel, or any access method you have
   - Place next to `docker-compose.portfolio-prod.yml`

2. **Run with env file:**
   ```bash
   docker compose --env-file .env.production -f docker-compose.portfolio-prod.yml up -d
   ```

3. **Watchtower will handle future updates automatically**
   - Detects new images
   - Pulls `:latest` tag
   - Restarts with existing env vars

### Option B: Set Environment Variables Directly

If you prefer setting env vars through your Cloudflare/orchestration dashboard:

```bash
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE
FIGMA_TEAM_ID=123456789012345678
FIGMA_TEMPLATE_KEY=AbCdEfGhIjKlMnOp
```

Then restart the backend container.

## ✅ Verification

### 1. Check Environment Variable Loaded
```bash
docker exec portfolio-backend env | grep FIGMA_PAT
```

**Expected output:**
```
FIGMA_PAT=figd_YOUR_TOKEN_HERE
```

### 2. Test Brand Endpoints
```bash
# List templates
curl -sS https://api.leoklemet.com/api/agent/brand/templates | jq .

# Get design tokens (replace FILE_KEY)
curl -sS "https://api.leoklemet.com/api/agent/brand/tokens?file_key=YOUR_FILE_KEY" | jq .
```

**Expected:** JSON response with Figma data (not 401/403 auth errors)

### 3. Test Dev Overlay
Visit: `https://www.leoklemet.com/?dev_overlay=dev`

**Check:**
- ✅ Dev overlay shows `allowed: true`
- ✅ "Brand" tab visible in admin panel
- ✅ Can switch between "Projects" and "Brand" tabs

### 4. Test Business Card Generation

1. Open dev overlay → Brand tab
2. Fill in form:
   - Name: Your Name
   - Role: Your Role
   - Email: your@email.com
3. Click "Generate Business Card"
4. Verify:
   - No auth errors
   - Preview displays
   - Download links work
   - "Open in Figma" button works

## 🔧 Troubleshooting

### Token Not Found?

```bash
# Check file exists
ls -la /path/to/deploy/.env.production

# Check Docker Compose reads it
docker compose -f docker-compose.portfolio-prod.yml config | grep FIGMA_PAT

# Check container env
docker exec portfolio-backend env | grep FIGMA
```

### Still Getting 401/403 Errors?

1. **Verify token is correct** in `.env.production`
2. **Check token hasn't expired** in Figma settings
3. **Verify token permissions** - needs access to files/team
4. **Check logs:**
   ```bash
   docker logs portfolio-backend | grep -i figma
   ```

### Watchtower Not Updating?

```bash
# Check Watchtower logs
docker logs watchtower

# Force pull new image
docker pull ghcr.io/leok974/leo-portfolio/backend:latest

# Force recreate container
docker compose -f docker-compose.portfolio-prod.yml up -d --force-recreate backend
```

## 📊 Current Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| Phase 51 Code | ✅ Deployed | Commit `4127200` |
| Docker Image | ✅ Built | ghcr.io/.../backend:latest |
| Watchtower | ✅ Ready | Auto-pulls new images |
| Local Token File | ✅ Ready | `deploy/.env.production` |
| Production Token | ⏳ Pending | **← YOU ARE HERE** |
| Brand Endpoints | ⏳ Waiting | Need token to work |

## 🎯 Next Steps After Deployment

1. **Set Figma Team ID** (optional, for team features)
2. **Create Business Card Template** in Figma
3. **Set Template Key** in `.env.production`
4. **Test end-to-end workflow**
5. **Generate your first business card!** 🎉

## 📚 Documentation

- **Full Deployment Guide**: `CLOUDFLARE_WATCHTOWER_DEPLOY.md`
- **Detailed Summary**: `FIGMA_TOKEN_DEPLOYMENT.md`
- **API Documentation**: `docs/FigmaIntegration.md`
- **Phase 51 Summary**: `PHASE_51_SCAFFOLD_COMPLETE.md`

## 🔐 Security Reminder

✅ **Safe:**
- Token in `.env.production` (gitignored, not committed)
- Docker env vars (not in image)
- Cloudflare Access protecting endpoints

❌ **Never:**
- Commit `.env.production` to git
- Include token in docker-compose.yml
- Share token publicly

---

**Ready to deploy?** Just copy `deploy/.env.production` to your production server and restart the backend container. Watchtower will handle everything else! 🚀
