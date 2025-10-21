# 🚀 Automated Secret Deployment - Setup Guide

## What I Created

I've created a GitHub Actions workflow that can deploy your `.env.production` file using GitHub Secrets.

**Workflow**: `.github/workflows/deploy-secrets.yml`

## ⚙️ Setup Steps (One-Time)

### Step 1: Add Secrets to GitHub

Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions

Click **"New repository secret"** and add these three secrets:

| Secret Name | Value |
|-------------|-------|
| `FIGMA_PAT` | `figd_YOUR_FIGMA_TOKEN_HERE` |
| `FIGMA_TEAM_ID` | (leave empty for now, or add your team ID) |
| `FIGMA_TEMPLATE_KEY` | (leave empty for now, or add your template key) |

### Step 2: Run the Workflow

1. Go to: https://github.com/leok974/leo-portfolio/actions/workflows/deploy-secrets.yml
2. Click **"Run workflow"**
3. Type `deploy` in the confirmation box
4. Click **"Run workflow"** button

### Step 3: Download the Secret File

1. Wait for the workflow to complete (~30 seconds)
2. Click on the workflow run
3. Scroll down to **"Artifacts"** section
4. Download **"production-secrets"** artifact (it will be a .zip file)
5. Extract the `deploy/.env.production` file

### Step 4: Deploy to Production

Copy the `.env.production` file to your production server and restart the backend:

```bash
# Copy .env.production to production server
# Place it next to docker-compose.portfolio-prod.yml

# Then restart the backend
docker compose -f docker-compose.portfolio-prod.yml restart backend
```

Or use the env file directly:

```bash
docker compose --env-file .env.production -f docker-compose.portfolio-prod.yml up -d
```

## ✅ Verification

After deployment, verify the token is loaded:

```bash
# Check environment variable
docker exec portfolio-backend env | grep FIGMA_PAT

# Test brand endpoints
curl https://api.leoklemet.com/api/agent/brand/templates
```

## 🔒 Security Features

- ✅ Secrets stored in GitHub (encrypted)
- ✅ Workflow requires manual confirmation
- ✅ Artifact auto-deletes after 1 day
- ✅ .env.production never committed to git
- ✅ Only authorized users can trigger workflow

## 🎯 Quick Command Reference

```bash
# Add secret via GitHub CLI (alternative to web UI)
gh secret set FIGMA_PAT --body "figd_YOUR_FIGMA_TOKEN_HERE"
gh secret set FIGMA_TEAM_ID --body ""
gh secret set FIGMA_TEMPLATE_KEY --body ""

# Trigger workflow via CLI
gh workflow run deploy-secrets.yml --field confirm=deploy

# List workflow runs
gh run list --workflow=deploy-secrets.yml

# Download latest artifact
gh run download --name production-secrets
```

## 📋 Alternative: Direct Setup (If You Have Server Access)

If you prefer to deploy manually without the workflow:

1. Use the local `deploy/.env.production` file (already created)
2. Copy it to your production server
3. Run the deployment command

The workflow is just a convenience tool to generate the file from GitHub Secrets.

## 🔧 Troubleshooting

### Workflow fails with "confirm != deploy"
- Make sure you typed exactly `deploy` (lowercase) in the confirmation box

### Secrets not found
- Verify secrets are added at the **repository** level (not environment level)
- Check secret names are exactly: `FIGMA_PAT`, `FIGMA_TEAM_ID`, `FIGMA_TEMPLATE_KEY`

### Artifact not appearing
- Wait for workflow to complete (green checkmark)
- Refresh the page
- Check the workflow logs for errors

## 📚 Related Documentation

- **DEPLOY_FIGMA_TOKEN.md** - Quick reference guide
- **CLOUDFLARE_WATCHTOWER_DEPLOY.md** - Full deployment documentation
- **FIGMA_TOKEN_DEPLOYMENT.md** - Step-by-step instructions

---

**Ready?** Follow the setup steps above, or let me know if you'd like me to help with a specific step!
