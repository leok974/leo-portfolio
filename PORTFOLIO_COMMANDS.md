# Portfolio Content Pipeline - Quick Reference

## 🔄 One-Time Setup

```powershell
# Set GitHub token (for API rate limits)
$env:GITHUB_TOKEN="ghp_your_token_here"

# Or add to .env file
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env.local
```

## 📦 Content Sync Commands

### Sync GitHub Projects
```powershell
# Fetch repos and write to data/projects.json
pnpm projects:sync

# Or run directly
node scripts/projects-sync.mjs
```

**Output**: `data/projects.json` (list of filtered repos with metadata)

### Generate OG Images
```powershell
# Generate 1200×630 PNG images for all projects
pnpm og:gen

# Or run directly
node scripts/og-generate.mjs
```

**Output**: `public/og/*.png` (homepage + per-project images)

### Full Content Build
```powershell
# Sync + OG + Build in one command
pnpm content:build
```

## 🧪 Testing Commands

### Local Preview Tests
```powershell
# 1. Build portfolio
pnpm build:portfolio

# 2. Start preview server
pnpm preview:portfolio

# 3. Run tests (in new terminal)
$env:PW_BASE_URL="http://127.0.0.1:4173"
$env:PW_SKIP_WS="1"
npx playwright test --config=playwright.portfolio.config.ts
```

### Production Tests
```powershell
# Test against live site (no local server needed)
$env:PW_BASE_URL="https://www.leoklemet.com"
$env:PW_SKIP_WS="1"
npx playwright test --config=playwright.portfolio.config.ts
```

### Tagged Tests
```powershell
# OG meta tags only
npx playwright test --grep @og --config=playwright.portfolio.config.ts

# Projects display only
npx playwright test --grep @projects --config=playwright.portfolio.config.ts

# Resume endpoint only
npx playwright test --grep @resume --config=playwright.portfolio.config.ts

# All responsive tests
npx playwright test --grep @responsive --config=playwright.portfolio.config.ts

# All UI tests
npx playwright test --grep @ui --config=playwright.portfolio.config.ts
```

### Debug Mode
```powershell
# Run with Playwright UI
npx playwright test --config=playwright.portfolio.config.ts --ui

# Run specific test file
npx playwright test tests/e2e/portfolio/og.spec.ts

# Run with headed browser
npx playwright test --headed --config=playwright.portfolio.config.ts
```

## 🚀 Deployment Commands

### Manual CI Trigger
```bash
# Trigger GitHub Actions workflow
gh workflow run portfolio-ci.yml

# Check status
gh run list --workflow=portfolio-ci.yml --limit 5

# View logs
gh run view --log
```

### Verify Content
```powershell
# Check projects data
cat data/projects.json | jq '.[0:3]'

# Check OG images
ls public/og/

# Count projects
cat data/projects.json | jq 'length'
```

### Verify Backend
```powershell
# Test resume endpoint locally
curl http://localhost:8001/resume/generate.md

# Test production
curl https://api.leoklemet.com/resume/generate.md
```

## 📊 Monitoring Commands

### Check Build Status
```powershell
# GitHub Actions
gh run list --workflow=portfolio-ci.yml

# Docker images
docker images | grep portfolio

# Latest GHCR image
curl -s "https://ghcr.io/v2/leok974/leo-portfolio/portfolio/tags/list" | jq
```

### View Logs
```powershell
# GitHub Actions logs
gh run view <run-id> --log

# Local E2E logs
cat playwright-report/index.html

# Backend logs (if running locally)
tail -f assistant_api/logs/*.log
```

## 🔧 Troubleshooting

### Sync Issues
```powershell
# Check GitHub rate limit
curl -H "Authorization: Bearer $env:GITHUB_TOKEN" https://api.github.com/rate_limit

# Verify config
cat projects.config.json | jq

# Test single repo fetch
node -e "console.log(await fetch('https://api.github.com/repos/leok974/leo-portfolio').then(r => r.json()))"
```

### OG Generation Issues
```powershell
# Check if Playwright browsers installed
npx playwright install chromium

# Test template rendering
node scripts/og-generate.mjs

# Verify output
ls -la public/og/
```

### E2E Test Failures
```powershell
# Clear Playwright cache
npx playwright cache clean

# Reinstall browsers
npx playwright install --with-deps chromium

# Run single test with trace
npx playwright test tests/e2e/portfolio/og.spec.ts --trace on

# View trace
npx playwright show-trace trace.zip
```

## 📁 File Locations

### Configuration
- `projects.config.json` - GitHub sync filter rules
- `playwright.portfolio.config.ts` - E2E test configuration
- `.github/workflows/portfolio-ci.yml` - CI/CD pipeline

### Scripts
- `scripts/projects-sync.mjs` - GitHub API sync
- `scripts/og-generate.mjs` - OG image generation

### Data & Output
- `data/projects.json` - Synced projects (input for OG)
- `public/og/*.png` - Generated OG images
- `dist-portfolio/` - Built frontend

### Tests
- `tests/e2e/portfolio/og.spec.ts` - OG meta tests
- `tests/e2e/portfolio/projects.spec.ts` - Project cards tests
- `tests/e2e/portfolio/resume.spec.ts` - Resume endpoint tests

### Backend
- `assistant_api/routers/resume_public.py` - Resume generation
- `assistant_api/routes/resume.py` - Additional resume routes

## ⏰ Scheduled Tasks

### Nightly (3:17 AM UTC)
- Sync GitHub projects
- Regenerate OG images
- Build and push Docker image
- Run E2E tests against production

### On Demand
- Manual workflow trigger via GitHub Actions UI
- Or: `gh workflow run portfolio-ci.yml`

## 🔗 Quick Links

- **Production**: https://www.leoklemet.com
- **Resume**: https://api.leoklemet.com/resume/generate.md
- **GitHub Repo**: https://github.com/leok974/leo-portfolio
- **GHCR Images**: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- **Actions**: https://github.com/leok974/leo-portfolio/actions/workflows/portfolio-ci.yml

---

**Tip**: Bookmark this file for quick command reference! 🔖
