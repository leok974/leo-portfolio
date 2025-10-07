# SiteAgent New Tasks - Quick Reference

This document describes the three new automated tasks added to the SiteAgent system.

## 📸 og.generate - Open Graph Image Generator

**Purpose:** Generates social media preview images (1200×630px) for projects using Playwright.

**Output:** `./assets/og/*.png` (one per project in projects.json)

**Template:** `./public/og/template.html` - Glassmorphic card design with:
- Project title (72px, bold)
- Description subtitle (28px)
- Topics/tags footer
- Dark gradient background

**Script:** `scripts/og-render.mjs` - Headless Chromium screenshot automation

**Manual Run:**
```powershell
# First time: install Playwright chromium
npx playwright install chromium

# Generate OG images
node scripts/og-render.mjs `
  --input ./assets/data/projects.json `
  --out ./assets/og `
  --template ./public/og/template.html
```

**Behavior:**
- ✅ Skips existing images (no regeneration)
- ✅ Falls back gracefully if Node/Playwright unavailable
- ✅ Returns JSON: `{generated: N, existing: N, dir: "..."}`

**Error Handling:**
- Missing script/template → `{skipped: true}`
- Node.js not found → `{skipped: true}` 
- Playwright missing → `{note: "playwright_not_installed"}`
- Script failure → `{error: true, code: N}`

---

## 📰 news.sync - GitHub Activity Aggregator

**Purpose:** Aggregates recent releases and commits from GitHub repositories.

**Output:** `./assets/data/news.json`

**Data Sources:**
1. **Releases** (priority 1): 5 most recent releases via `gh api /repos/{repo}/releases`
2. **Commits** (fallback): 5 most recent commits if no releases exist
3. **Minimal** (fallback): `{note: "gh_not_available"}` if `gh` CLI missing

**Configuration:** 
- Environment variable: `SITEAGENT_REPOS=leok974/ledger-mind,leok974/leo-portfolio`
- Fallback: Uses hardcoded default repos if not set

**Manual Run:**
```powershell
# Requires GitHub CLI authenticated
gh auth status

# Fetch news for configured repos
$env:SITEAGENT_REPOS = "leok974/ledger-mind,leok974/leo-portfolio"
python -c "from assistant_api.agent.tasks import news_sync; print(news_sync('manual', {}))"
```

**Output Format:**
```json
{
  "items": [
    {
      "repo": "leok974/leo-portfolio",
      "type": "release",
      "name": "v1.0.0",
      "tag_name": "v1.0.0",
      "published_at": "2025-10-01T12:00:00Z",
      "html_url": "https://github.com/..."
    },
    {
      "repo": "leok974/ledger-mind",
      "type": "commit",
      "sha": "abc123...",
      "message": "Fix bug in RAG query",
      "date": "2025-09-30T10:00:00Z",
      "html_url": "https://github.com/..."
    }
  ]
}
```

**Error Handling:**
- `gh` CLI missing → Returns minimal metadata
- API rate limit → Falls back to commits
- No releases → Falls back to commits
- All failures → Returns `{type: "info", note: "gh_not_available"}`

---

## 🔗 links.validate - Local Link Checker

**Purpose:** Scans HTML files for broken local links (href/src attributes).

**Output:** `./assets/data/link-check.json`

**Scope:**
- ✅ Validates local file references (`/assets/...`, `./images/...`)
- ✅ Checks implicit directory indexes (`/path/` → `/path/index.html`)
- ❌ Ignores external URLs (`http://`, `https://`, `//...`)
- ❌ Ignores `mailto:` and `data:` URIs
- ❌ Ignores hash fragments (`#section`)

**Manual Run:**
```powershell
# Scan all HTML files in ./ and ./public
python -c "from assistant_api.agent.tasks import links_validate; print(links_validate('manual', {}))"

# Check output
cat ./assets/data/link-check.json | jq
```

**Output Format:**
```json
{
  "checked": 523,
  "html_files": 42,
  "missing": [
    {
      "file": "./index.html",
      "url": "/assets/images/missing.png"
    },
    {
      "file": "./public/projects.html",
      "url": "../data/old-projects.json"
    }
  ]
}
```

**Task Result:**
```json
{
  "file": "./assets/data/link-check.json",
  "missing": 2,
  "checked": 523
}
```

**Error Handling:**
- Missing root directories → Skips gracefully
- Unreadable HTML files → Continues to next file
- Missing links → Emits `warn` event: `links.validate.missing`

---

## 🚀 Agent Execution

All three tasks are now part of the default agent plan:

```python
DEFAULT_PLAN = [
    "projects.sync",       # 1. Fetch GitHub repo metadata
    "sitemap.media.update", # 2. Index media assets
    "og.generate",         # 3. Generate OG images (NEW)
    "news.sync",           # 4. Aggregate releases/commits (NEW)
    "links.validate",      # 5. Check local links (NEW)
    "status.write",        # 6. Write heartbeat JSON
]
```

**Trigger Full Agent:**
```powershell
# Local backend (port 8001)
curl -s -X POST http://127.0.0.1:8001/agent/run `
  -H "Content-Type: application/json" `
  -d "{}" | jq

# Via nginx (port 8080)
$headers = @{
  "CF-Access-Client-Id" = "bcf632e4a22f6a8007d47039038904b7.access"
  "CF-Access-Client-Secret" = "1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"
}
Invoke-RestMethod http://localhost:8080/agent/run -Method Post -Headers $headers
```

**Check Outputs:**
```powershell
# OG images (PNG files)
ls ./assets/og/*.png

# News feed (JSON)
cat ./assets/data/news.json | jq

# Link check results (JSON)
cat ./assets/data/link-check.json | jq
```

---

## 🧪 Testing Individual Tasks

**OG Generator:**
```powershell
# First time setup
npx playwright install chromium

# Test render
node scripts/og-render.mjs `
  --input ./assets/data/projects.json `
  --out ./assets/og `
  --template ./public/og/template.html

# Expected output: {"generated":N,"existing":M,"dir":"./assets/og"}
```

**News Sync:**
```powershell
# Verify gh CLI
gh auth status

# Test fetch
python -c "from assistant_api.agent.tasks import news_sync; import json; print(json.dumps(news_sync('test', {}), indent=2))"

# Expected output: {"count":N,"file":"./assets/data/news.json"}
```

**Links Validator:**
```powershell
# Test scan
python -c "from assistant_api.agent.tasks import links_validate; import json; print(json.dumps(links_validate('test', {}), indent=2))"

# Expected output: {"file":"...","missing":N,"checked":M}

# Review broken links
cat ./assets/data/link-check.json | jq '.missing'
```

---

## 📊 Production Deployment

**Docker Compose:**
The backend container needs:
- Node.js installed (for og.generate)
- `gh` CLI authenticated (for news.sync)
- Playwright chromium browser (for og.generate)

**GitHub Actions:**
The `siteagent-nightly.yml` workflow already has:
- ✅ Node.js installed
- ✅ `gh` CLI authenticated (built-in)
- ⚠️ Playwright chromium needs to be installed

**Add to Workflow:**
```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium
```

**Environment Variables:**
```bash
# .env.prod or docker-compose.yml
SITEAGENT_REPOS=leok974/ledger-mind,leok974/leo-portfolio
```

---

## 🔍 Monitoring & Debugging

**Event Stream:**
All tasks emit events via `emit()`:
- `og.generate.skipped` - Script/template missing
- `og.generate.node_missing` - Node.js not found
- `og.generate.failed` - Playwright error
- `links.validate.missing` - Broken links found

**Status JSON:**
The `status.write` task captures all task results:
```json
{
  "ts": "2025-10-07T12:00:00Z",
  "last_run_id": "abc-123",
  "tasks": ["projects.sync", "og.generate", "news.sync", ...],
  "ok": true
}
```

**Check Agent Logs:**
```powershell
# View recent runs
curl http://localhost:8001/agent/tasks | jq

# View specific run
curl http://localhost:8001/agent/tasks/{run_id} | jq
```

---

## 💡 Tips

1. **OG Images:** First run generates all images, subsequent runs are instant (skips existing)
2. **News Sync:** Caches in JSON, frontend can poll for updates
3. **Link Checker:** Run after build to catch broken asset references
4. **Manual Testing:** All tasks can be imported and run directly in Python REPL
5. **Graceful Degradation:** All tasks handle missing dependencies (Node, gh, Playwright)

---

## 🚨 Troubleshooting

**OG images not generating:**
```powershell
# Check Playwright installation
npx playwright --version

# Reinstall chromium
npx playwright install chromium --with-deps
```

**News sync empty:**
```powershell
# Check gh CLI authentication
gh auth status

# Re-authenticate
gh auth login
```

**Link checker false positives:**
- Check file paths are relative or root-relative
- Verify `index.html` exists in directories
- External links are ignored by design
