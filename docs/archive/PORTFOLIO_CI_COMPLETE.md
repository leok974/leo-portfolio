# Portfolio CI/CD Pipeline Complete

## ✅ Implementation Summary

Successfully implemented automated content sync, OG image generation, and E2E testing pipeline for the portfolio.

## 🚀 What Was Built

### 1. GitHub Actions Workflow (`.github/workflows/portfolio-ci.yml`)

**Triggers**:
- Push to `main` branch (excluding markdown files)
- Manual workflow dispatch
- Nightly schedule at 3:17 AM (syncs projects and regenerates OG images)

**Jobs**:

#### `content-build`
1. Syncs GitHub repositories → `data/projects.json`
2. Generates OG images (1200×630) for all projects
3. Builds portfolio frontend
4. Builds and pushes Docker image to GHCR

#### `e2e-prod`
1. Runs after `content-build` completes
2. Installs Playwright browsers
3. Runs E2E tests against production (`https://www.leoklemet.com`)
4. Uploads test reports on failure

### 2. Project Sync Script (`scripts/projects-sync.mjs`)

**Functionality**:
- Fetches repos from GitHub API for `leok974` org
- Filters by topics: `portfolio`, `featured`, `ai`, `agents`
- Excludes archived repos and denylist patterns
- Outputs to `data/projects.json`

**Environment**:
- `GITHUB_TOKEN` (optional but recommended for rate limits)

**Output Schema**:
```json
{
  "slug": "repo-name",
  "title": "Repo Name",
  "one_liner": "description",
  "tags": ["topic1", "topic2"],
  "stack": [],
  "url": "homepage or github url",
  "stars": 10,
  "updated_at": "2025-10-17T...",
  "show": true
}
```

### 3. OG Image Generator (`scripts/og-generate.mjs`)

**Functionality**:
- Uses Playwright to render HTML templates as 1200×630 PNG images
- Generates homepage fallback (`public/og/og.png`)
- Generates per-project images (`public/og/{slug}.png`)
- Dark gradient background with logo, title, subtitle, tags

**Template Design**:
- Background: Linear gradient (#0f172a → #1e293b → #334155)
- Title: 72px, bold, white (#E6ECF4)
- Subtitle: 32px, light gray (#A7B4C6)
- Tags: 28px, blue (#60a5fa)
- Logo: 140px circle, gradient blue/purple

### 4. Resume Generation (`assistant_api/routers/resume_public.py`)

**Updated Endpoint**: `/resume/generate.md`

**Functionality**:
- Reads latest projects from `data/projects.json` (fallback to `projects.json`)
- Generates markdown resume with:
  - YAML frontmatter (name, role, email, site, github, timestamp)
  - Summary section
  - Skills list
  - Latest 7 projects with stack
  - Experience section

**Format**:
```markdown
---
name: Leo Klemet
role: AI Engineer / Full-Stack
email: leoklemet.pa@gmail.com
site: https://www.leoklemet.com
github: https://github.com/leok974
generated_at: 2025-10-17T...Z
---

# Leo Klemet
**AI Engineer / Full-Stack**

## Projects (latest)
- **Project Name** — description _(Stack: Python, TypeScript)_
```

### 5. E2E Test Suites

#### `tests/e2e/portfolio/og.spec.ts` (3 tests) - @og
- Homepage OG fallback meta validation
- Image resolution via HEAD request
- OG dimensions (1200×630) and preload link

#### `tests/e2e/portfolio/projects.spec.ts` (4 tests) - @projects
- Project cards render with data-testid
- Card structure (title, description, thumbnail)
- Data attributes for layout system
- Filter functionality

#### `tests/e2e/portfolio/resume.spec.ts` (2 tests) - @resume
- Dynamic resume includes latest projects
- Proper YAML frontmatter with metadata

### 6. Playwright Configuration (`playwright.portfolio.config.ts`)

**Environment Variables**:
- `PW_BASE_URL` - Test target URL (default: `http://127.0.0.1:4173`)
- `PW_SKIP_WS` - Skip local server (`"1"` for production tests)

**Features**:
- Respects baseURL for all tests
- Conditional webServer (only starts local preview when not skipped)
- Chromium project with Desktop Chrome viewport
- Screenshot and video on failure
- Trace on first retry

## 📦 Package Scripts

```json
{
  "projects:sync": "node scripts/projects-sync.mjs",
  "og:gen": "node scripts/og-generate.mjs",
  "content:build": "pnpm projects:sync && pnpm og:gen && pnpm build:portfolio"
}
```

## 🔧 Local Development

### Sync Projects
```powershell
# Set token (optional, avoids rate limits)
$env:GITHUB_TOKEN="ghp_..."

# Run sync
pnpm projects:sync
```

### Generate OG Images
```powershell
pnpm og:gen
```

### Full Content Build
```powershell
pnpm content:build
```

### Run E2E Tests

#### Against Local Preview
```powershell
# Build and preview
pnpm build:portfolio
pnpm preview:portfolio

# Run tests
$env:PW_BASE_URL="http://127.0.0.1:4173"
$env:PW_SKIP_WS="1"
npx playwright test --config=playwright.portfolio.config.ts
```

#### Against Production
```powershell
$env:PW_BASE_URL="https://www.leoklemet.com"
$env:PW_SKIP_WS="1"
npx playwright test --config=playwright.portfolio.config.ts
```

#### Tagged Tests
```powershell
# OG tests only
npx playwright test --grep @og --config=playwright.portfolio.config.ts

# Projects tests only
npx playwright test --grep @projects --config=playwright.portfolio.config.ts

# Resume tests only
npx playwright test --grep @resume --config=playwright.portfolio.config.ts
```

## 🎯 CI/CD Flow

### Manual Trigger
```bash
gh workflow run portfolio-ci.yml
```

### Nightly Schedule (3:17 AM)
1. **Content Sync**:
   - Fetches latest GitHub repos
   - Generates OG images
   - Builds frontend with updated data
   - Pushes Docker image to GHCR

2. **E2E Validation**:
   - Waits for deployment
   - Runs all portfolio tests against production
   - Uploads report if failures occur

### On Push to Main
Same as nightly, but triggered by code changes.

## 📊 Test Coverage

| Test Suite | Tests | Tags | Purpose |
|------------|-------|------|---------|
| OG Meta Tags | 3 | @og | Social sharing meta validation |
| Projects Display | 4 | @projects | Project cards rendering |
| Resume Generation | 2 | @resume | Dynamic resume endpoint |
| Calendly Widget | 3 | @responsive | Booking widget integration |
| Chat Dock | 3 | @ui | Chat interface functionality |
| **Total** | **15** | | |

## 🔐 Security & Environment

### Required Secrets (GitHub Actions)
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Optional Environment Variables
- `VITE_LAYOUT_ENABLED` - Enable layout features in build

### Permissions
```yaml
permissions:
  contents: read    # Read repository
  packages: write   # Push to GHCR
```

## 📝 Configuration Files

### `projects.config.json`
```json
{
  "org": "leok974",
  "include_topics": ["portfolio", "featured", "ai", "agents"],
  "exclude_archived": true,
  "denylist": ["old-experiment", "sandbox-*"],
  "min_stars": 0
}
```

### Output Structure
```
data/
  projects.json          # Synced from GitHub

public/
  og/
    og.png              # Homepage fallback
    {slug}.png          # Per-project images
```

## 🚦 Status Checks

### Verify Pipeline
```powershell
# Check workflow status
gh run list --workflow=portfolio-ci.yml --limit 5

# View logs
gh run view --log
```

### Verify Content
```powershell
# Check projects sync output
cat data/projects.json | jq '.[0:3]'

# Check OG images generated
ls public/og/
```

### Verify Resume
```powershell
# Test locally
curl http://localhost:8001/resume/generate.md

# Test production
curl https://api.leoklemet.com/resume/generate.md
```

## 🎉 Success Metrics

- ✅ Nightly automated project sync from GitHub
- ✅ Automatic OG image regeneration (1200×630)
- ✅ Docker image builds and pushes to GHCR
- ✅ E2E tests run against production
- ✅ 15 tests covering all major features
- ✅ Dynamic resume with latest projects
- ✅ Production-safe test suite (PW_BASE_URL, PW_SKIP_WS)

## 🔮 Future Enhancements

1. **OG Image Variations**:
   - Generate different sizes (1200×630, 600×315, 400×200)
   - Support custom backgrounds per project

2. **Resume PDF**:
   - Add `/resume/generate.pdf` endpoint
   - Use Playwright PDF rendering

3. **Project Analytics**:
   - Track which projects are most viewed
   - Sync GitHub stars/forks metrics

4. **Content Freshness Badge**:
   - Show "Last synced: X hours ago" on frontend
   - Visual indicator when new projects are added

## 📚 Related Documentation

- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [E2E_TESTS_COMPLETE.md](../E2E_TESTS_COMPLETE.md) - Test suite documentation
- [playwright.portfolio.config.ts](../playwright.portfolio.config.ts) - Test configuration
- [.github/workflows/portfolio-ci.yml](../.github/workflows/portfolio-ci.yml) - CI pipeline

---

**Status**: ✅ Complete and deployed
**Last Updated**: October 17, 2025
**Next Review**: Check nightly build logs tomorrow
