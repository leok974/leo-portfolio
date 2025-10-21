# Nightly Secret Deployment - Setup Complete

## 🎯 Overview

A nightly workflow has been created to automatically verify and maintain production secrets for the Figma integration.

**Workflow**: `.github/workflows/deploy-secrets-nightly.yml`

## ⏰ Schedule

- **Runs**: Daily at 3 AM UTC (11 PM EST / 8 PM PST)
- **Manual Trigger**: Available via GitHub Actions UI
- **Force Deploy**: Optional flag to trigger backend rebuild

## 🔄 What It Does

### Every Night (Automatically):

1. ✅ **Verify Secrets Configured**
   - Checks that `FIGMA_PAT` is set in GitHub Secrets
   - Validates other Figma secrets

2. ✅ **Generate Production Env File**
   - Creates `.env.production` from GitHub Secrets
   - Timestamps the deployment
   - Verifies file integrity

3. ✅ **Deployment Report**
   - Creates detailed deployment report
   - Uploads as artifact (7-day retention)
   - Includes verification steps

4. ✅ **Verify Production**
   - Checks API health (`/ready` endpoint)
   - Tests brand endpoints (if deployed)
   - Reports status

### On Demand (Manual):

- Trigger anytime via GitHub Actions
- Optional "force deploy" to rebuild backend
- Same verification steps

## 🚀 How to Use

### View Scheduled Runs

Visit: https://github.com/leok974/leo-portfolio/actions/workflows/deploy-secrets-nightly.yml

### Manual Trigger

```bash
# Via GitHub CLI
gh workflow run deploy-secrets-nightly.yml

# With force deploy
gh workflow run deploy-secrets-nightly.yml --field force_deploy=true

# Via GitHub UI
# 1. Go to Actions tab
# 2. Click "Deploy Secrets Nightly"
# 3. Click "Run workflow"
# 4. (Optional) Check "Force deployment"
# 5. Click "Run workflow" button
```

### Check Results

```bash
# List recent runs
gh run list --workflow=deploy-secrets-nightly.yml --limit 5

# View latest run
gh run view --workflow=deploy-secrets-nightly.yml

# Download deployment report
gh run download --name deployment-report-<run-id>
```

## 📊 Deployment Report

Each run creates a deployment report with:

- Timestamp and workflow info
- Secrets configuration status
- Deployment verification
- Next steps and verification commands
- Watchtower status notes

**Report Retention**: 7 days

## 🔧 Integration with Watchtower

The nightly job integrates with your existing Cloudflare + Watchtower setup:

```
┌─────────────────────────────────────────┐
│ Nightly Workflow (3 AM UTC)             │
│ - Verifies secrets in GitHub            │
│ - Generates .env.production (ephemeral) │
│ - Validates configuration               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Production Secrets Status               │
│ - FIGMA_PAT: ✅ Verified nightly        │
│ - Available for deployment              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Watchtower (Separate Process)           │
│ - Monitors GHCR for new images          │
│ - Pulls :latest tag automatically       │
│ - Restarts containers with env vars     │
└─────────────────────────────────────────┘
```

## ⚙️ Configuration

### Secrets Required

| Secret Name | Required | Purpose |
|-------------|----------|---------|
| `FIGMA_PAT` | ✅ Yes | Figma API access token |
| `FIGMA_TEAM_ID` | ⚪ Optional | Figma team ID |
| `FIGMA_TEMPLATE_KEY` | ⚪ Optional | Business card template key |

### Workflow Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `force_deploy` | boolean | `false` | Trigger backend rebuild |

## 🔍 Verification

### After Nightly Run

Check the deployment report artifact for:

- ✅ Secrets configured correctly
- ✅ Env file generated successfully
- ✅ API health check passed
- ℹ️  Brand endpoints status

### Production Verification

```bash
# Check if container has the token
docker exec portfolio-backend env | grep FIGMA_PAT

# Test brand endpoints
curl https://api.leoklemet.com/api/agent/brand/templates

# Check Watchtower logs
docker logs watchtower --tail=50
```

## 🚨 Troubleshooting

### Workflow Fails: "FIGMA_PAT secret not configured"

**Fix**: Add the secret to GitHub
```bash
gh secret set FIGMA_PAT --body "figd_YOUR_TOKEN_HERE"
```

### API Health Check Fails

**Likely Causes**:
- Container restarting (normal during Watchtower update)
- Network issues
- Backend service down

**Check**:
```bash
docker ps | grep portfolio-backend
docker logs portfolio-backend --tail=50
```

### Brand Endpoints Not Working

**This is expected** until you deploy `.env.production` to production server.

**Next Step**: Copy `deploy/.env.production` (local) to production and restart:
```bash
docker compose --env-file .env.production -f docker-compose.portfolio-prod.yml up -d
```

## 📋 Deployment Checklist

- [x] ✅ Nightly workflow created
- [x] ✅ GitHub Secrets configured (`FIGMA_PAT`)
- [x] ✅ Workflow will run at 3 AM UTC daily
- [x] ✅ Manual trigger available
- [x] ✅ Deployment reports uploaded
- [x] ✅ Production health verification included
- [ ] ⏳ Deploy `.env.production` to production server (manual step)

## 🎯 What This Solves

### Automatic Verification

- ✅ Secrets stay fresh in GitHub
- ✅ Configuration validated nightly
- ✅ Early detection of issues

### Deployment Readiness

- ✅ Env file always available
- ✅ Secrets never committed to git
- ✅ Easy rollback via GitHub Secrets

### Production Safety

- ✅ Health checks before/after
- ✅ Detailed deployment reports
- ✅ Artifact retention for debugging

## 📚 Related Documentation

- **CLOUDFLARE_WATCHTOWER_DEPLOY.md** - Watchtower setup
- **DEPLOY_FIGMA_TOKEN.md** - Token deployment guide
- **AUTOMATED_SECRET_DEPLOYMENT.md** - On-demand workflow
- **.github/workflows/deploy-secrets.yml** - Manual deployment workflow

## 🔄 Workflow History

View all runs: https://github.com/leok974/leo-portfolio/actions/workflows/deploy-secrets-nightly.yml

## 💡 Pro Tips

### 1. Monitor Nightly Runs

Set up GitHub notifications for workflow failures:
- Settings → Notifications → Actions
- Enable "Workflow run failures"

### 2. Download Reports

Keep deployment reports for auditing:
```bash
# Download last 7 days of reports
for run_id in $(gh run list --workflow=deploy-secrets-nightly.yml --json databaseId --jq '.[].databaseId' --limit 7); do
  gh run download $run_id --name deployment-report-$run_id || true
done
```

### 3. Force Rebuild

If you update `FIGMA_PAT` in GitHub Secrets:
```bash
# Trigger with force deploy to rebuild backend immediately
gh workflow run deploy-secrets-nightly.yml --field force_deploy=true
```

## ✅ Success Criteria

The nightly workflow is successful when:

1. ✅ Runs automatically at 3 AM UTC daily
2. ✅ Verifies all GitHub Secrets configured
3. ✅ Generates valid `.env.production` file
4. ✅ Production API responds to health checks
5. ✅ Deployment report uploaded
6. ✅ No errors in workflow logs

---

**Status**: ✅ Workflow created and ready
**Next Run**: Tonight at 3 AM UTC
**Manual Trigger**: Available now

To trigger the first run manually:
```bash
gh workflow run deploy-secrets-nightly.yml
```
