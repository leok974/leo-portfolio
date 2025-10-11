# Production URLs Configuration

## Quick Summary

Your production site is now configured with:
- **Frontend**: `https://assistant.ledger-mind.org`
- **API Base**: `https://api.assistant.ledger-mind.org`

These are set as **default values** in the workflow files, so you don't need to configure repository variables unless you want to override them.

## Files Updated

### 1. Orchestrator Workflow (`.github/workflows/orchestrator-nightly.yml`)
```yaml
env:
  API_BASE: ${{ vars.API_BASE || 'https://api.assistant.ledger-mind.org' }}
  SITE_BASE_URL: ${{ vars.SITE_BASE_URL || 'https://assistant.ledger-mind.org' }}
```

### 2. SEO Tune Workflow (`.github/workflows/seo-tune.yml`)
```yaml
env:
  SITE_BASE_URL: https://assistant.ledger-mind.org
```

### 3. Orchestrator Script (`scripts/orchestrator.nightly.mjs`)
```javascript
const API_BASE = process.env.API_BASE || 'https://api.assistant.ledger-mind.org';

const PLAN = [
  {
    task: 'seo.validate',
    env: {
      SITE_BASE_URL: process.env.SITE_BASE_URL || 'https://assistant.ledger-mind.org',
    }
  },
  // ...
];
```

## Local Testing

### Test SEO Tune with Production URLs
```bash
# PowerShell
$env:SITE_BASE_URL = "https://assistant.ledger-mind.org"
npm run seo:tune:dry

# Bash
SITE_BASE_URL="https://assistant.ledger-mind.org" npm run seo:tune:dry
```

### Test Orchestrator with Production URLs
```bash
# PowerShell
$env:API_BASE = "https://api.assistant.ledger-mind.org"
$env:SITE_BASE_URL = "https://assistant.ledger-mind.org"
npm run orchestrator:nightly

# Bash
API_BASE="https://api.assistant.ledger-mind.org" \
SITE_BASE_URL="https://assistant.ledger-mind.org" \
npm run orchestrator:nightly
```

## Smoke Check Examples

### 1. Verify SEO Tune URLs
```bash
# PowerShell
$env:SITE_BASE_URL = "https://assistant.ledger-mind.org"
npm run seo:tune:dry | Select-String -Pattern "assistant.ledger-mind.org"
```

Expected output should show canonical and OG URLs like:
```
<link rel="canonical" href="https://assistant.ledger-mind.org/..." />
<meta property="og:url" content="https://assistant.ledger-mind.org/..." />
```

### 2. Verify API Connection
```bash
# Check API health
curl https://api.assistant.ledger-mind.org/ready

# Check agents tasks endpoint
curl https://api.assistant.ledger-mind.org/agents/tasks/paged?limit=10
```

## GitHub Actions Configuration (Optional)

You don't need to set these unless you want to override the defaults:

### Variables (Settings > Secrets and variables > Actions > Variables)
- `API_BASE` - Override default API URL (optional)
- `SITE_BASE_URL` - Override default site URL (optional)

### Secrets (Settings > Secrets and variables > Actions > Secrets)
- `SLACK_WEBHOOK` - Slack webhook for notifications (required if using webhooks)
- `EMAIL_WEBHOOK` - Email webhook for notifications (required if using webhooks)

## Verification Steps

### 1. Check Workflow Files
```bash
# Verify orchestrator workflow has correct defaults
grep -A 2 "API_BASE:" .github/workflows/orchestrator-nightly.yml

# Verify SEO tune workflow has correct site
grep "SITE_BASE_URL:" .github/workflows/seo-tune.yml
```

### 2. Test SEO Tune Locally
```bash
# Run dry-run with production URL
SITE_BASE_URL="https://assistant.ledger-mind.org" npm run seo:tune:dry
```

Check the output for:
- ✅ Canonical URLs start with `https://assistant.ledger-mind.org`
- ✅ OG URLs start with `https://assistant.ledger-mind.org`
- ✅ No localhost or other domain references

### 3. Test Orchestrator Locally (if API is accessible)
```bash
# Test API connectivity
curl https://api.assistant.ledger-mind.org/ready

# Run orchestrator (will fail gracefully if API not accessible)
API_BASE="https://api.assistant.ledger-mind.org" npm run orchestrator:nightly
```

## Production Checklist

- [x] Updated orchestrator workflow default URLs
- [x] Updated SEO tune workflow default URLs
- [x] Updated orchestrator script default URLs
- [x] Updated documentation with new defaults
- [ ] Verify API endpoint `https://api.assistant.ledger-mind.org` is accessible
- [ ] Run local smoke test: `SITE_BASE_URL="https://assistant.ledger-mind.org" npm run seo:tune:dry`
- [ ] Verify GitHub Actions workflows run successfully
- [ ] Configure Slack/Email webhooks (if needed)

## API Endpoints

Your production API should be accessible at:

- **Health Check**: `https://api.assistant.ledger-mind.org/ready`
- **Agents Tasks**: `https://api.assistant.ledger-mind.org/agents/tasks/`
- **Agents Tasks (Paged)**: `https://api.assistant.ledger-mind.org/agents/tasks/paged`
- **Admin Panel**: `https://assistant.ledger-mind.org/api/admin` (Cloudflare Access protected)

## Troubleshooting

### SEO Tune Shows Wrong URLs
```bash
# Check environment variable
echo $SITE_BASE_URL

# Explicitly set for test
SITE_BASE_URL="https://assistant.ledger-mind.org" npm run seo:tune:dry
```

### Orchestrator Can't Connect to API
```bash
# Test API health
curl https://api.assistant.ledger-mind.org/ready

# Check environment variable
echo $API_BASE

# Test with explicit URL
API_BASE="https://api.assistant.ledger-mind.org" npm run orchestrator:nightly
```

### GitHub Actions Workflow Fails
1. Check workflow logs for actual error
2. Verify repository secrets are set (if using webhooks)
3. Ensure API endpoint is accessible from GitHub Actions runners
4. Check for any CORS or authentication issues

## Next Steps

1. **Run local smoke test**:
   ```bash
   SITE_BASE_URL="https://assistant.ledger-mind.org" npm run seo:tune:dry
   ```

2. **Verify output** shows correct production URLs

3. **Commit and push** changes to trigger GitHub Actions

4. **Monitor first workflow run** to ensure it works with production URLs

5. **Configure webhooks** (optional) if you want Slack/Email notifications
