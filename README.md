# Leo Klemet — Portfolio (HTML/CSS/JS)

[![e2e-mock](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-mock.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-mock.yml)
[![e2e-keywords-mock](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-keywords-mock.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-keywords-mock.yml)
[![Nightly SEO Meta](https://github.com/leok974/leo-portfolio/actions/workflows/siteagent-meta-auto.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/siteagent-meta-auto.yml)
[![SEO JSON-LD](https://github.com/leok974/leo-portfolio/actions/workflows/seo-ld-validate.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/seo-ld-validate.yml)
[![SEO SERP Nightly](https://github.com/leok974/leo-portfolio/actions/workflows/seo-serp-cron.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/seo-serp-cron.yml)

> Nightly auto-PR **skips** when no pages are selected or when all selected pages already meet title/description limits.

[![Release](https://img.shields.io/github/v/release/leok974> _"Copilot, audit the site for WCAG 2.1: focus states, ARIA labels, color contrast, and generate a checklist in `docs/a11y.md`."_

---

## Dev Overlay (Maintenance Panel)

Open your site with `?dev=1` to force the maintenance overlay, e.g.:
```
http://localhost:8080/?dev=1
```
Or persist it:
```js
localStorage.saDevOverlay = '1'
```
The overlay lets you run agent plans, see last actions, and download artifacts (link-apply.json/.diff).

### Playwright E2E

- **Local one-shot** (brings up Docker, waits, runs tests):
  ```bash
  npm run e2e:local
  ```
- **Plain run** (skips backend-dependent tests if the stack isn't up):
  ```bash
  npm run test:e2e
  ```

---

## Metrics & Grafana

- Nightly job writes JSONL metrics to the `metrics` branch and publishes a rolling CSV:
  - `agent/metrics/seo-meta-auto.jsonl`
  - `agent/metrics/seo-meta-auto.csv`
- CSV workflow: **siteagent-metrics-csv** (runs daily + on metrics updates)
- Optional API export: `/agent/metrics/seo-meta-auto.csv?limit_days=180`

**Grafana Dashboard**:
1. Install the **Infinity** datasource (yesoreyeram-infinity-datasource) in Grafana
2. Import `grafana/seo-meta-auto-dashboard.json`
3. Update panel query URLs to your API endpoint or GitHub raw CSV

**Setup Guides**:
- 📖 **Full setup**: [`docs/GRAFANA_SETUP.md`](docs/GRAFANA_SETUP.md)
- ⚡ **Quick setup**: [`grafana/QUICK_SETUP.md`](grafana/QUICK_SETUP.md)
- 🔧 **VS Code extension**: [`docs/GRAFANA_VSCODE_SETUP.md`](docs/GRAFANA_VSCODE_SETUP.md)
- 🛠️ **grafanactl CLI**: [`grafana/GRAFANACTL_QUICKREF.md`](grafana/GRAFANACTL_QUICKREF.md)
- 📊 **Method comparison**: [`grafana/SETUP_COMPARISON.md`](grafana/SETUP_COMPARISON.md)

---

## Backend Diagnostics-portfolio)](https://github.com/leok974/leo-portfolio/releases)
[![CI (Node 18/20)](https://img.shields.io/github/actions/workflow/status/leok974/leo-portfolio/matrix-ci.yml?branch=main)](https://github.com/leok974/leo-portfolio/actions/workflows/matrix-ci.yml)
[![Frontend Fast Tests](https://github.com/leok974/leo-portfolio/actions/workflows/frontend-fast.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/frontend-fast.yml)
[![Assistant Status](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/status.json)](docs/OPERATIONS.md#status-badge)
[![Publish Backend](https://github.com/leok974/leo-portfolio/actions/workflows/publish-backend.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/publish-backend.yml)
[![Smoke](https://github.com/leok974/leo-portfolio/actions/workflows/smoke.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/smoke.yml)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://leok974.github.io/leo-portfolio/)
[![E2E strict (nginx)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/e2e-strict-nginx.json)](./.github/workflows/e2e-strict-nginx.yml)
[![E2E strict (combined)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/e2e-strict-combined.json)](./.github/workflows/e2e-strict-combined.yml)
[![E2E full-stack](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/e2e-fullstack.json)](./.github/workflows/e2e-strict-fullstack-nightly.yml)
[![OpenAPI Drift](https://github.com/leok974/leo-portfolio/actions/workflows/openapi-drift.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/openapi-drift.yml)
[![UI Polish E2E](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-ui-polish.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-ui-polish.yml)

![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/.github/badges/coverage.json)
![Lines](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/.github/badges/lines.json)
![Branches](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/.github/badges/branches.json)
![Functions](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/.github/badges/functions.json)
![Statements](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/status-badge/.github/badges/statements.json)


<sub>
<strong>Assistant status badge legend</strong> —  🟢 <strong>green = ok</strong> (all checks ≤ 5s) · 🟠 <strong>orange = degraded</strong> (any check > 5s) · 🔴 <strong>red = error</strong> (any check > 10s) · ⚪ <strong>lightgrey = partial</strong> (one or more checks missing)
</sub>

<sup>Probe SLO: soft 5s / hard 10s enforced via workflow; see `docs/OPERATIONS.md#slo-gating-implemented` for tuning & baseline extraction.</sup>

<sub>Coverage badges derive from Vitest `coverage-summary.json` published to the shared `status-badge` branch (`scripts/coverage-shield.mjs`).</sub>

A fast, modern, **framework-free** portfolio for **Leo Klemet — AI Engineer · SWE · Generative AI / 3D Artist & Creative Technologist**.

- ✅ Sticky nav + smooth scroll
- ✅ Dark/Light mode (localStorage)
- ✅ Filterable project grid (AI Agents, ML/Analytics, 3D/Art, DevOps)
- ✅ Local `<video>` (WebM/MP4) + YouTube embed (lazy, responsive)
- ✅ Contact form ready for Netlify Forms
- ✅ Accessible: semantic HTML5, labels, alt, caption tracks
- ✅ Performance: lazy-load, captions support, WebP/AVIF friendly
- ✅ Assistant chat automatically retries via JSON when a stream emits zero tokens
 - ✅ Route badge shows the chosen path (rag | faq | chitchat) under replies
 - ✅ Quick thumbs feedback on replies (👍/👎), with Admin Feedback card and CSV export
 - ✅ Guardrails: prompt‑injection detection + secret redaction, with a Shield badge in UI and API `guardrails{}` payload
- ✅ **Gallery with file uploads** — AI assistant can accept image/video attachments and create gallery cards automatically
  - FFmpeg poster generation for videos
  - Agent-callable gallery tools for autonomous content management
  - Sitemap auto-refresh after uploads
- ✅ **Self-improving layout** via Telemetry + Behavior Learning:
  - Frontend tracker collects anonymous section-level signals (views, clicks, dwell).
  - Backend analyzes recent activity, updates per-section weights (EMA + time decay), and reorders sections with a small exploration rate.
  - Endpoints: `/agent/metrics/ingest`, `/agent/analyze/behavior`, `/agent/layout`.

> Built with **plain HTML, CSS (Grid/Flex), and vanilla JS**. Easy to extend into React/Vite/CMS later.

---

## Quickstart (Local)

1) **Clone** and open the folder in VS Code:
```bash
cd leo-portfolio
code .
```

2) **Serve** the static site (pick one):
- VS Code Live Server extension → “Go Live”
- Python: `python -m http.server 5173`
Visit: <http://localhost:5173>

> All assets live under `assets/`. Replace placeholders and posters with your real images/videos (optimized as WebP/AVIF + WebM/MP4).

## Deploy

### Option A — GitHub Pages (recommended)
3. Keep the provided workflow `.github/workflows/deploy.yml` (already included).
   On push to `main`, Pages will publish the site automatically.

- **Forms** work out of the box via `data-netlify="true"`.

### Option C — Vercel

## Monitoring

### Analytics & Metrics
- `/analytics/collect`: lightweight event beacon (no cookies)
- `/metrics`: Prometheus scrape endpoint
- Optional: run Prometheus + Grafana overlay (`deploy/docker-compose.analytics.yml`)
- Dashboards in `docs/analytics.md` (sample Grafana JSON: `docs/grafana-portfolio-analytics.json`)

## Copilot Setup (Instructions + Prompts)

> _“Copilot, split `index.html` into `styles.css` and `main.js`. Move inline `<style>` and `<script>` into those files and update references. Keep behavior identical.”_

**Add new project cards from a JSON file**
> _“Copilot, create `projects.json` with fields: slug, title, summary, tags[], cats[], thumbnail, poster, sources[], links. Generate JS that loads this JSON and renders the cards + filters.”_

**Generate dedicated project pages**
> _“Copilot, scaffold `/projects/<slug>.html` using the modal content. Reuse the layout/header/footer and link the cards to the new pages.”_

**Performance audits**
> _“Copilot, add a simple `npm run optimize` script that uses `sharp` to convert images to WebP/AVIF and `ffmpeg` commands to make WebM/MP4 previews.”_

**Accessibility checks**
> _“Copilot, audit the site for WCAG 2.1: focus states, ARIA labels, color contrast, and generate a checklist in `docs/a11y.md`.”_


## Backend Diagnostics

### Admin Router & Cloudflare Access

All privileged operations (uploads, gallery management, etc.) are now consolidated under `/api/admin/*` with **Cloudflare Access JWT verification**:

- **GET** `/api/admin/whoami` — Returns authenticated principal (email or service token name)
- **POST** `/api/admin/uploads` — Upload images/videos with optional gallery card creation
- **POST** `/api/admin/gallery/add` — Add gallery items with metadata

**Authentication Methods:**

1. **User SSO (Interactive):**
```powershell
# Authenticate
cloudflared access login https://assistant.ledger-mind.org/api/admin

# Get JWT token
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# Test whoami
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"principal":"your-email@example.com"}
```

2. **Service Token (Non-Interactive - for CI/CD):**
```powershell
# Set credentials
$env:CF_ACCESS_CLIENT_ID = "<client-id>"
$env:CF_ACCESS_CLIENT_SECRET = "<client-secret>"

# Test whoami (Cloudflare injects JWT automatically)
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"principal":"service-token-name"}
```

**Documentation:**
- **Service Tokens:** `docs/CF_ACCESS_SERVICE_TOKENS.md` (complete guide)
- **Migration Guide:** `docs/ADMIN_ROUTER_MIGRATION.md`
- **Production Deploy:** `PRODUCTION_DEPLOY_CF_ACCESS_NEW.md`
- **Commands:** `CLOUDFLARE_ACCESS_COMMANDS.md`
- **CI Guard Test:** `tests/test_admin_guard.py` (ensures all admin routes are protected)

**Security:** Single router-level guard prevents accidentally exposing privileged endpoints. CI test fails if any `/api/admin/*` route lacks CF Access protection.

### SiteAgent — Autonomous Portfolio Maintenance 🤖

**Status:** ✅ **Production Ready** | **Tests:** 8/8 Passed | **Deployment:** Live

The SiteAgent MVP provides automated portfolio maintenance through a task-based execution system with dual authentication support.

**Authentication Methods:**

1. **Cloudflare Access** (`/api/admin/agent/*`) - Interactive admin access
   - SSO authentication via browser
   - Service tokens for admin scripts

2. **HMAC Signature** (`/agent/*`) - CI/CD workflows
   - Shared secret authentication
   - GitHub Actions integration
   - No Cloudflare Access required

**Agent Endpoints:**

| Endpoint | Auth | Description |
|----------|------|-------------|
| `/api/admin/agent/tasks` | CF Access | List tasks (admin) |
| `/api/admin/agent/run` | CF Access | Execute agent (admin) |
| `/api/admin/agent/status` | CF Access | View status (admin) |
| `/agent/tasks` | HMAC (optional) | List tasks (public) |
| `/agent/run` | HMAC (optional) | Execute agent (CI/CD) |
| `/agent/status` | HMAC (optional) | View status (public) |

**Available Tasks:**

| Task | Description | Output |
|------|-------------|--------|
| `projects.sync` | Pull GitHub repo metadata | `assets/data/projects.json` |
| `sitemap.media.update` | Scan media assets | `assets/data/media-index.json` |
| `og.generate` | Generate OG images | `assets/og/*.png` |
| `status.write` | Write heartbeat status | `assets/data/siteAgent.json` |

**Quick Test (CF Access):**

```powershell
# Set service token credentials
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "<your-client-secret>"

# List available tasks
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/agent/tasks

# Run agent with default plan
curl -X POST `
     -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     -H "Content-Type: application/json" `
     https://assistant.ledger-mind.org/api/admin/agent/run

# Check agent status
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/agent/status
```

**Quick Test (HMAC):**

```powershell
# Set HMAC secret (same as backend)
$env:SITEAGENT_HMAC_SECRET = "your-secret-here"

# Compute signature
$Body = '{"plan": null, "params": {}}'
$BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
$SecretBytes = [System.Text.Encoding]::UTF8.GetBytes($env:SITEAGENT_HMAC_SECRET)
$Hmac = New-Object System.Security.Cryptography.HMACSHA256
$Hmac.Key = $SecretBytes
$Hash = $Hmac.ComputeHash($BodyBytes)
$Signature = "sha256=" + ($Hash | ForEach-Object { $_.ToString("x2") }) -join ""

# Run agent with HMAC signature
curl -X POST "https://assistant.ledger-mind.org/agent/run" `
     -H "Content-Type: application/json" `
     -H "X-SiteAgent-Signature: $Signature" `
     -d $Body
```

**Comprehensive Testing:**

```powershell
# Run full smoke test suite (8 tests - CF Access)
cd D:\leo-portfolio
.\test-agent-smoke.ps1
# Expected: 🎉 ALL TESTS PASSED! 🎉

# Run HMAC authentication tests
.\test-agent-hmac.ps1
# Tests: Valid signature, invalid signature, missing signature, open access
```

**GitHub Actions Integration (HMAC):**

File: `.github/workflows/siteagent-nightly.yml` (already created)

```yaml
name: siteAgent Nightly Run
on:
  schedule:
    - cron: '17 3 * * *'  # 03:17 UTC nightly
  workflow_dispatch:

jobs:
  run-siteagent:
    runs-on: ubuntu-latest
    env:
      ENDPOINT: ${{ secrets.SITEAGENT_ENDPOINT }}
      HMAC_SECRET: ${{ secrets.SITEAGENT_HMAC_SECRET }}
    steps:
      - name: Compute HMAC signature
        run: |
          BODY='{"plan": null, "params": {}}'
          echo "$BODY" > body.json
          SIG=$(openssl dgst -binary -sha256 -hmac "$HMAC_SECRET" body.json | xxd -p -c 256)
          curl -sS -X POST "$ENDPOINT" \
               -H "Content-Type: application/json" \
               -H "X-SiteAgent-Signature: sha256=$SIG" \
               --data-binary @body.json | jq .
```

**Required GitHub Secrets:**
- `SITEAGENT_ENDPOINT`: `https://assistant.ledger-mind.org/agent/run`
- `SITEAGENT_HMAC_SECRET`: Same as backend `SITEAGENT_HMAC_SECRET` env var

**Dev-Only Trigger Button:**

When accessing the site from `localhost` or `127.0.0.1`, a green button appears in the bottom-right corner for one-click agent execution (no authentication required in dev mode).

```yaml
name: Portfolio Update
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday at midnight
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Run Agent
        run: |
          curl -X POST "https://assistant.ledger-mind.org/api/admin/agent/run" \
            -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
            -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

**Documentation:**
- **Complete Guide:** `SITEAGENT_MVP_COMPLETE.md` (500+ lines)
- **Quick Reference:** `SITEAGENT_QUICKREF.md` (all commands)
- **Success Summary:** `PHASE_35_SUCCESS.md` (deployment report)
- **Agent Manifesto:** `agent.html` (public documentation)

**Architecture:** Task registry pattern with SQLite tracking (`agent_jobs`, `agent_events` tables), sequential execution engine, and comprehensive error handling.

### RAG quickstart

```powershell
$env:RAG_DB="D:/leo-portfolio/data/rag_8023.sqlite"
python -m assistant_api.cli ingest --batch .\docs --project demo
python -m assistant_api.cli rebuild-index
# Query paginated
Invoke-RestMethod -Method POST "http://127.0.0.1:8023/api/rag/query?project_id=demo&limit=10&offset=0" `
   -ContentType application/json -Body '{"question":"ledger reconciliation"}' | ConvertTo-Json -Depth 4
```


Core helper scripts:

- `./scripts/smoke.ps1` – legacy smoke (readiness, metrics, RAG checks).
- `./scripts/smoke-public.ps1` – **public smoke** (tests live site at https://assistant.ledger-mind.org).
- `./scripts/all-green.ps1` – condensed readiness + summary + latency + non-stream + stream (curl) in one pass.
- `./scripts/chat-probe.mjs` – Node SSE probe (streams first ~2KB then truncates).
- `./scripts/chat-stream.ps1` – Pure PowerShell SSE reader (no curl/node dependency).

Pick one for your workflow (daily check → all-green; CI streaming sanity → chat-probe; Windows-native streaming → chat-stream; **production monitoring → smoke-public**).

Quick backend start (local):
- VS Code Tasks: Run "Run FastAPI (assistant_api)" to start at 127.0.0.1:8001, or "Run FastAPI (assistant_api, fallback)" to force OpenAI fallback.
- Manual: `python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001`
- Docs: see `docs/API.md` for endpoints and `assistant_api/README.md` for dev switches.

Environment toggles for resilient local boots:
- `SAFE_LIFESPAN=1` — skip model probing entirely during startup (avoids early exits on Windows/CI).
- `DISABLE_PRIMARY=1` — start in fallback mode without touching the primary provider.
- `DEV_ALLOW_NO_LLM=1` — synthesize minimal replies in `/chat` so tests can run without API keys.
- `GUARDRAILS_MODE=enforce|log` — prompt‑injection guardrails mode (default `enforce`). In `log` mode inputs are flagged but not blocked.
- `ALLOW_UNSAFE=1` — disable guardrails enforcement in dev even if `GUARDRAILS_MODE=enforce`.
- RAG ingestion now opens SQLite in WAL mode, bumps the busy timeout, and retries commits/opens (5× exponential backoff) so concurrent startups no longer crash on `database is locked`.
 - Router v1: lightweight query router chooses between `faq`, `rag`, and `chitchat`.
    * Env: `ROUTER_RAG_MIN` (bm25 score gate, default 7.0), `ROUTER_FAQ_MIN` (cosine threshold, default 0.72), `FAQ_PATH` (default `data/faq.json`).
    * Responses now include `scope` and `memory_preview` (last 2 user/assistant turns) for debugging and UI hints.

> 🆕 Assistant dock now hard-codes requests through the `/api/chat/stream` edge shim and prints `[assistant] chat POST …` plus `[assistant] stream non-200 …` when a response fails. Use DevTools console to confirm the chat submission fires and whether it’s hitting the shim or the direct backend.

Tailwind note (if you add it later): this repo doesn’t ship Tailwind at runtime. If you introduce Tailwind with purge enabled, safelist any arbitrary utility values used by the assistant popover such as `min-w-[280px]` and `max-w-[360px]` to prevent them from being removed.

Grounding UX:
- When the backend applies RAG, the stream `meta` event includes `grounded: true` and optional `sources` (when `include_sources: true` is sent). The UI renders a small "grounded (n)" badge next to the served-by marker.
- If a query can’t be grounded, the assistant avoids fabricated specifics and offers a case study or a short demo instead.

Routing UX:
- A small route badge pill appears under the assistant bubble indicating which path handled the query: rag, faq, or chitchat. It updates during streaming when routing metadata arrives and is available in both streaming and JSON fallback flows. Tests target `[data-testid="route-badge"]`.

Backend quick test (RAG):
```powershell
# Runs a backend-only pytest that ingests a small FS slice and asserts grounded chat
D:/leo-portfolio/.venv/Scripts/python.exe -m pytest -q tests/test_chat_rag_grounded.py
```

### Guardrails (prompt‑injection) quick run

Goal: prove UI badge visibility during streaming and API blocking in enforce mode.

PowerShell (Windows) — one‑time steps in two terminals:
1) Start backend (safe/dev):
```powershell
$env:SAFE_LIFESPAN='1'
$env:DISABLE_PRIMARY='1'
$env:DEV_ALLOW_NO_LLM='1'
Remove-Item Env:RAG_URL -ErrorAction SilentlyContinue
# enforce mode is default; set $env:ALLOW_UNSAFE='1' to see flagged but not blocked
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --log-level warning
```
2) In another terminal: build + serve dist with proxy and run the guardrails spec
```powershell
npm run -s build
npm run -s e2e:guardrails:proxy
```
What it asserts:
- UI shows a shield badge during stream when `meta.guardrails` is present.
- Direct POST to `/chat` returns `guardrails.flagged=true` and, in enforce mode, `blocked=true` with a safe message.

Lightweight readiness probe (RAG chunks present):
```powershell
Invoke-RestMethod 'http://127.0.0.1:8010/api/ready' | ConvertTo-Json -Depth 5

### Feedback capture (local)

Thumbs bar appears under assistant replies. Saved to `data/feedback.jsonl`.

Quick probes:

```powershell
# Post a sample item
Invoke-RestMethod 'http://127.0.0.1:8001/api/feedback' -Method Post -ContentType 'application/json' -Body '{"question":"What is LedgerMind?","answer":"..","score":-1,"served_by":"fallback","grounded":true,"sources_count":2}' | ConvertTo-Json

# Recent summary (JSON)
Invoke-RestMethod 'http://127.0.0.1:8001/api/feedback/recent?limit=10' | ConvertTo-Json -Depth 4

# CSV export
Invoke-WebRequest 'http://127.0.0.1:8001/api/feedback/export.csv' -OutFile feedback.csv
```

Turn 👎 into regression evals:

```powershell
D:/leo-portfolio/.venv/Scripts/python.exe scripts/feedback_to_regress.py
```
```

### Frontend Dev: Assets 404 / CSP Inline Styles
If you see 404s for `/assets/*.css` or fonts and an unstyled page:
1. Ensure the Vite build produced `dist/` (run `npm run build`).
2. For local dev, apply the override: `docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.dev.override.yml up -d --force-recreate nginx`.
3. Use relaxed CSP in `deploy/nginx.dev.conf` (allows inline while you refactor inline styles).
4. `site.webmanifest` served with proper MIME via added `types` block (avoid text/html warning).

Production: revert to strict CSP (no `unsafe-inline`) after moving inline `<style>` into bundled CSS.

Accessibility tip: the sources popover uses `role="dialog"` and is labelled via `aria-labelledby`. Focus returns to the badge on close. For a complete focus trap, switch to `aria-modal="true"` and add a Tab key loop inside the dialog card.

> 🆕 `deploy/Dockerfile.frontend` now runs a post-copy `find ... chmod` sweep so every directory under `/usr/share/nginx/html` keeps its execute bit. Without it, BuildKit 0.17+ would honor `COPY --chmod=0644` recursively and hashed bundles like `/assets/index-*.js` would 404 even though they existed on disk. If you customize the Dockerfile, keep (or regenerate) that normalization step.
> 🆕 Added `entrypoint.d/10-csp-render.sh` to compute inline `<script>` hashes at container start and sync them into nginx’s CSP header. Provide a placeholder (e.g. `__CSP_INLINE_HASHES__`) or let it append after `script-src 'self'` automatically.

### Edge Header-Sensitive Tests (EXPECT_EDGE)
Some Playwright specs (CSP baseline, favicon cache, projects.json cache) only run when one of the environment flags below is set so local ad‑hoc static serving doesn’t produce noisy failures:

```
EXPECT_EDGE=1   # Explicitly assert we are hitting the hardened nginx/edge
NGINX_STRICT=1  # Implicitly set by helper scripts / strict workflows
```

If neither is set, those specs `test.skip()` automatically. See `docs/DEVELOPMENT.md` (Edge Header Gating & Favicon Generation) for details.

Favicon / PWA icons (`leo-avatar-sm.png` 192px, `leo-avatar-md.png` 512px) are auto-generated from the SVG source at build time via `scripts/generate-favicons.mjs` (hooked through `prebuild:prod`). This guarantees non‑zero `Content-Length` and stable manifest install metadata.

### Workflows Summary JSON
An automated workflow (`workflows-summary.yml`) publishes `.github/badges/workflows.json` to the `status-badge` branch every 30 minutes (and on demand). It aggregates latest run metadata for key pipelines: unit-ci, prod-assistant-probe, e2e-prod, publish-backend. Field `overall` is `ok|degraded|empty` based on conclusions. Consume it in dashboards or Shields via a dynamic endpoint.

### Nightly Strict Streaming Badge
Nightly workflow enforces `_served_by` presence in streaming output (strict mode). Badge (replace OWNER/REPO if forked):

![Streaming (strict)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/streaming.json)

### Nightly Fallback Streaming Badge
Ensures fallback path (e.g., OpenAI) continues to emit `_served_by` marker. Skips gracefully if fallback host secret unset.

![Streaming (fallback)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/streaming-fallback.json)

### Combined Streaming Health Badge
Aggregates strict + fallback results (color matrix in `aggregate-streaming.mjs`).

![Streaming (combined)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/leok974/leo-portfolio/main/.github/badges/streaming-combined.json)

For production / day-2 operational procedures (status headers, legacy cutover, integrity drift, CI health workflow), see `OPERATIONS.md` (root) and the extended guide in `docs/OPERATIONS.md`.

---

## Run All Tests (Hermetic)

**Complete end-to-end test suite** that automatically:
- Starts shared infrastructure (D:\infra with Ollama, PostgreSQL, Cloudflare Tunnel)
- Ensures required models are loaded
- Installs dependencies and runs typecheck/lint
- Executes full Playwright test suite with proper environment

### Windows (PowerShell)

```powershell
$env:DOCKER_CONTEXT="desktop-linux"

# Full hermetic run (all stacks)
pwsh .\scripts\test-all.ps1

# Frontend-only mode (CSS/UX + analytics) — fastest loop
pwsh .\scripts\test-all.ps1 -FrontendOnly -Grep "@ui-polish|@analytics-beacons"

# Skip infra startup (if your stack is already up in another terminal)
pwsh .\scripts\test-all.ps1 -SkipInfra -Grep "@backend"

# Update snapshots for a subset
pwsh .\scripts\test-all.ps1 -Grep "@ui-polish" -Baseline

# Filter Playwright by title
pwsh .\scripts\test-all.ps1 -Grep "tooltip visual baseline"
```

### macOS/Linux

```bash
# Full hermetic run
./scripts/test-all.sh

# With baseline update
BASELINE=1 ./scripts/test-all.sh

# Filtered tests
./scripts/test-all.sh "@a11y"
```

### Script Options

- **`-Baseline`**: Update Playwright snapshots (`--update-snapshots`)
- **`-Grep <pattern>`**: Filter tests by title pattern (`-g` in Playwright)
- **`-FrontendOnly`**: Skip backend/infra, only run frontend CSS/UX tests (uses Vite dev server at `localhost:5173`)
- **`-SkipInfra`**: Skip infrastructure startup (assumes services already running)

### What it does

1. **Auto-detects package manager** (pnpm or npm) and uses appropriate commands
2. **Starts shared infra** (`D:\infra`) if present and not skipped
3. **Brings up E2E Postgres** from `docker-compose.e2e.yml` if available
4. **Verifies Ollama models** via `scripts/ensure-models.ps1`
5. **Installs backend dependencies** (skipped in `-FrontendOnly` mode)
6. **Probes backend health** and detects warm/fallback mode
7. **Runs web typecheck and lint**
8. **Installs Playwright browsers** with system dependencies
9. **Executes Playwright tests** from repo root with proper environment

### Environment variables (auto-configured)

- `APP_ENV=dev`
- `ALLOW_DEV_ROUTES=1`
- `DEV_E2E_EMAIL=leoklemet.pa@gmail.com`
- `DEV_E2E_PASSWORD=Superleo3`
- `DEV_SUPERUSER_PIN=946281`
- `E2E_DB_HOST=127.0.0.1`
- `OLLAMA_HOST=http://127.0.0.1:11434`
- `BACKEND_MODE=warm|fallback|unavailable` (detected via health probe)

### npm Wrappers

Convenient shortcuts for common test scenarios:

```bash
# Full hermetic test suite
npm run test:all

# Frontend-only (CSS/UX + analytics) - fastest
npm run test:all:frontend

# Skip infrastructure (assumes running)
npm run test:all:skip-infra

# Update snapshots
npm run test:all:baseline

# Collect diagnostics manually
npm run diag:collect

# Run tests for changed files only
npm run test:changed

# Quarantine: flaky tests (allowed to fail)
npm run test:quarantine

# Non-quarantine: stable tests only
npm run test:non-quarantine

# Parallel sharding (2 shards)
npm run test:shard:1  # Terminal 1
npm run test:shard:2  # Terminal 2
```

#### CI Polish Features

New CI improvements for faster feedback and better debugging:

- **Fail-fast**: Stop on first failure (`--max-failures=1`)
- **Retries in CI**: 2 automatic retries for flaky network/timing issues
- **Rich artifacts**: HTML reports + traces + videos on failure
- **PR annotations**: Test failures shown inline in PRs
- **Quarantine support**: Tag flaky tests with `@quarantine` to prevent blocking
- **Parallel shards**: 4x speed with matrix strategy

See `scripts/CI_POLISH.md` for complete guide.

Quick production health check:
```bash
pwsh ./scripts/tunnel-probe.ps1
# Output: ✅ OK: 142 bytes
```


### Local Configuration Overrides (.env.test)

Create `.env.test` in the repository root for personal overrides (never committed):

```bash
cp .env.test.example .env.test
# Edit with your preferences
```

Example `.env.test`:
```bash
BASE_URL=http://localhost:8080
PLAYWRIGHT_GLOBAL_SETUP_SKIP=1
OLLAMA_HOST=http://192.168.1.100:11434
```

The test script automatically loads these overrides before running.

### Diagnostics Collection

On test failures, collect comprehensive diagnostics:

```powershell
# Manual collection
pwsh .\scripts\collect-diag.ps1

# Or via npm
npm run diag:collect
```

Creates timestamped bundle with:
- Container logs
- Health endpoints
- Metrics snapshots
- Playwright test results
- Environment information

**In CI/CD**: Diagnostics are automatically collected and uploaded as artifacts when tests fail.
- `DEV_SUPERUSER_PIN=946281`
- `E2E_DB_HOST=127.0.0.1`
- `OLLAMA_HOST=http://127.0.0.1:11434`
- `BACKEND_MODE=warm|fallback|unavailable` (detected via health probe)

### CI/CD Integration

Use environment variables to configure the script in GitHub Actions:

```yaml
env:
  PLAYWRIGHT_GLOBAL_SETUP_SKIP: "1"
  BASE_URL: "http://127.0.0.1:5173"
```
- `DEV_SUPERUSER_PIN=946281`
- `E2E_DB_HOST=127.0.0.1` (override with `$env:E2E_DB_HOST` or `export E2E_DB_HOST`)

---

### Playwright Test Modes (Dev vs Strict)

E2E tests are environment‑sensitive to avoid noisy failures during local iteration:

| Script | Command | Behavior |
|--------|---------|----------|
| Dev (default soft) | `npm run test:dev` | Skips CSS immutability + status pill finalization if assets or backend not fully ready. |
| Strict (CI / prod) | `npm run test:strict` | Requires built CSS (200 + immutable), status pill transitions out of "Checking…", and streaming emits `_served_by`. |
| Smoke (assistant only) | `npm run test:smoke` | Minimal single test (assistant.smoke) in soft mode. |
| **Public smoke** | `npm run smoke:public` | **Tests live production site** (https://assistant.ledger-mind.org) - no local backend needed. See [docs/PUBLIC_SMOKE_TESTS.md](docs/PUBLIC_SMOKE_TESTS.md). |
| Assistant UI (mock) | `npm run test:assistant:ui` | Backend-free Playwright harness that mocks `/api/chat/stream`; serve `dist/` via `npm run serve:dist` or set `BASE_URL` to an existing edge host. |
| Assistant fallback guard | `npm run test:assistant:fallback` | Forces `/api/chat/stream` to finish without tokens and asserts the dock falls back to `/api/chat` JSON completions. |
| Fast UI sweep | `npm run test:fast` | Chromium-only slice (`@frontend` + routing smoke) that aborts on first failure; helper `installFastUI(page)` blocks heavy assets and disables animations for deterministic runs. |
| Changed specs | `npm run test:changed` | Chromium-only incremental run leveraging Playwright `--only-changed`; ideal while iterating on frontend specs. |
| Analytics beacons | `npm run test:analytics` | Validates client-side analytics beacons (`page_view`, `scroll_depth`, `link_click`, `dwell`) via route interception; requires static server on port 5173 (`npm run serve` in separate terminal). |

Environment flags:

- `REQUIRE_CSS_200=1` – Enforce at least one `link[rel=stylesheet]` returning 200 + `text/css` with `immutable` cache-control; otherwise test fails. (Soft mode skips if absent.)
- `REQUIRE_STATUS_PILL_STRICT=1` – Poll for status pill text to move beyond "Checking…" and acquire class `ok|warn|err`.
- `PLAYWRIGHT_STRICT_STREAM=1` – Require streaming response to surface `_served_by` token; otherwise only byte count is annotated.

Prerequisites for strict success locally:

1. Build frontend: `npm run build` (serves hashed CSS in `dist/`).
2. Serve built assets via nginx (see `deploy/docker-compose.prod.yml`) or `vite preview` with correct base path.
3. Backend running and exposing `/api/ready` + `/api/status/summary` (e.g. `uvicorn assistant_api.main:app --port 8001` behind the nginx `/api` route or adjust `BASE`).
4. If using custom host/port, export `BASE` (e.g. `BASE=http://localhost:8080`).

Troubleshooting:

- Status pill stuck at Checking…: ensure local `/api` reachable; in dev the script now prioritizes local `/api` before remote domains.
- CSS preflight 404: you are likely serving raw repo root without `dist/`; run the build or relax strict mode.
- Missing `_served_by`: verify streaming backend injects marker; fallback providers may differ.

CI workflows should prefer `test:strict` nightly and `test:dev` for PR gating to minimize flaky failures.

### Fast Playwright (local)

Assumptions (override via env):
- BASE_URL (default http://127.0.0.1:8080; use 5173 if running Vite dev)
- PW_SKIP_WS=1 skips Playwright-managed webServer when you prestart your server(s)
- Default workers: 24 (override with PW_WORKERS)

Commands:

```
pnpm run pw:install
pnpm run pw:fast
```

PowerShell helper:

```
./scripts/run-playwright.ps1 -BaseUrl http://127.0.0.1:8080
# or Vite dev
./scripts/run-playwright.ps1 -BaseUrl http://127.0.0.1:5173
```

Sharding examples:

```
./scripts/run-playwright.ps1 -Shard1
./scripts/run-playwright.ps1 -Shard2
```

---

## Structure

```
.
├── assets/                 # Place images, videos, posters, captions here
│   └── .gitkeep
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages action (no build step needed)
├── .vscode/
│   └── extensions.json     # Suggested VS Code extensions
├── .editorconfig
├── .gitignore
├── LICENSE
├── README.md
└── index.html              # Single-file app (no frameworks required)
```

---

## Customize

- **Branding**: edit meta tags, titles, and `og:image` in `index.html`.
- **Assets**: replace placeholders in `/assets` (optimize to WebP/AVIF, compress videos).
- **Captions**: add `.vtt` files and `<track>` tags for accessibility.
- **Contact**: keep `data-netlify="true"` or wire your own backend later.
- **Detail pages**: either keep modals or add `/projects/<slug>.html` pages.

---

## License

MIT © 2025 Leo Klemet

---

## CI & Node Support
Matrix CI runs on Node 18 and 20:

- Lint (ESM guard forbids `require()` in `.js`)
- Script smoke imports (ensures safe side-effect-free parsing)
- Unit tests (Vitest)
- Coverage badge generation (Node 20 only)

See `.github/workflows/matrix-ci.yml` for the full pipeline.

## Script Entry Pattern
Scripts are ESM-first and safe to import without executing CLI logic.

```js
import { isEntrypoint } from './scripts/_esm-utils.mjs';
export async function main(){ /* ... */ }
if (isEntrypoint(import.meta.url)) {
   await main();
}
```

Unified dispatcher:
```bash
npm run generate:projects
npm run optimize:media
npm run validate:schema
```

---

## Backend Latency Endpoints

Two latency measurement modes are exposed for the primary LLM path:

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /llm/primary/latency` | Direct backend probe hitting the primary `/models` endpoint repeatedly | Returns statistical distribution: `stats` (min/p50/p95/p99/max/avg, count, ok_rate) plus raw statuses. Low overhead. |
| `GET /llm/primary/chat-latency` | (DEPRECATED) Micro chat pipeline latency including minimal message build and provider call | Response adds `deprecated: true` and a `replacement` pointer. Will be removed after comparison period. |

The probe endpoint is preferred for tracking provider/network performance in isolation; the deprecated chat-latency helps differentiate application overhead from provider regression while both coexist.


---

## Windows: Server starts then immediately shuts down

If `uvicorn` or `hypercorn` appears to start and then exits cleanly within a few seconds (no traceback, exit code 0/1):

### Why this happens
It's almost always environmental: an integrated terminal or task wrapper sending an early Ctrl+C/SIGTERM, an aggressive AV/EDR product terminating short‑lived child processes, or a PowerShell profile script that invokes cleanup logic (e.g. `Stop-Process`). The FastAPI app itself is fine—minimal repros show the same pattern.

### Fast fixes (try in order)
1. Use a plain external **Command Prompt (cmd.exe)** instead of the VS Code integrated terminal.
2. Double‑click the provided **`run_dev.bat`** in Explorer (keeps console open, enforces a selector loop policy indirectly via `run_cmddev.py`).
3. Temporarily disable your PowerShell profile:
   - Run `notepad $PROFILE` and comment out custom cleanup / job / process code, or rename the profile file and start a fresh PowerShell.
4. Try the alternate server: `hypercorn assistant_api.main:app --bind 127.0.0.1:8010`.
5. Free a stuck port if reuse messages occur:
   - `netstat -ano | findstr :8010` then `taskkill /PID <PID> /F`.

### Diagnostics
- Check for background subscribers: `Get-EventSubscriber` and running jobs: `Get-Job`.
- Look for short‑lived `python.exe` siblings in Task Manager.
- If on corporate endpoint protection, whitelist Python + repo directory (if policy permits).

### Batch launcher
`run_dev.bat` auto‑detects `.venv` and invokes `assistant_api\run_cmddev.py`. Edit `PORT` or `HOST` inside if needed.

---

## Docker: Export / container I/O errors (Windows)

If a Docker build (especially multi‑stage with Python wheels) fails near the export phase with vague containerd / I/O errors:

### Recovery sequence
```powershell
# 1) Reset WSL & Docker Desktop
wsl --shutdown
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 2) Clean caches & free space
docker system df
docker buildx prune --all --force
docker system prune -a --volumes -f

# 3) Recreate builder (repairs corrupted cache metadata)
docker buildx rm default
docker buildx create --name default --use

# 4) Rebuild with plain progress (more verbose)
$env:DOCKER_BUILDKIT="1"
docker build -f assistant_api/Dockerfile -t leo-portfolio-backend --progress=plain .
```

Check disk headroom; `%LOCALAPPDATA%\Docker\wsl\data\ext4.vhdx` may have grown large. Ensure ≥10–15 GB free on drive `C:`. Security tools can also block the final export—add Docker to allowed applications if possible.

---

## WSL Quick Start (stable dev environment)

Running inside WSL (e.g. Ubuntu) avoids Windows terminal signal quirks and path issues:

```bash
cd /mnt/d/leo-portfolio
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r assistant_api/requirements.txt

# Run the server
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 --log-level info
```

Access from Windows: http://127.0.0.1:8010 (WSL forwards localhost automatically).

---

## Optional Developer Helpers

### PowerShell shim to launch batch dev
```powershell
function Dev-Cmd { Start-Process cmd.exe "/k `"%CD%\run_dev.bat`"" }
```

### Port sanity one-liner (PowerShell)
```powershell
netstat -ano | Select-String ":8010" ; `
  Get-Process -Id (netstat -ano ^| findstr :8010 ^| ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique)
```

---


## Docs Policy

All code changes must be reflected in project documentation:

- Update `README.md` for any usage, quick start, or command changes.
- Update `docs/` (e.g. `ARCHITECTURE.md`, `DEPLOY.md`, `DEVELOPMENT.md`, `SECURITY.md`, `API.md`) for architecture, deployment, security, or endpoint changes.
- Add or adjust endpoint descriptions in both `README.md` and `docs/API.md` when new routes are introduced.
- Record meaningful changes (features, fixes, refactors) in `docs/CHANGELOG.md` using a concise semantic style.
- Note added tests or tooling in `DEVELOPMENT.md`.

Copilot is configured (see `.github/copilot-instructions.md`) to nudge for doc updates whenever code impacts setup, APIs, or deployment. PRs without necessary doc updates may be flagged.

### SEO Meta PRs — Guardrails & Reviewers

The **siteagent-meta-pr** workflow automates SEO meta change PRs with built-in validation:

- **Auto-request reviewers**: Use workflow inputs `reviewers` (comma-separated usernames) and `team_reviewers` (comma-separated team slugs)
  - Example: `reviewers: alice,bob` or `team_reviewers: web,platform`
  - If empty, no reviewers are requested

- **SEO Meta Guardrails**: The **seo-meta-guardrails** check runs automatically on PRs that change `*.apply.json` files
  - Validates: Title ≤ 60 characters, Description ≤ 155 characters
  - Fails PR check with inline annotations if violations found
  - Script: `scripts/seo-meta-guardrails.mjs`
  - No build dependencies — fast validation

**Quick local validation**:
```bash
node scripts/seo-meta-guardrails.mjs agent/artifacts/seo-meta-apply/*.apply.json
```

---



