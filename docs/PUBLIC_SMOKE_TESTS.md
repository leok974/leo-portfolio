# Public Smoke Tests

Lightweight smoke tests for the **public production URL** (https://assistant.ledger-mind.org) without requiring local Docker/backend infrastructure.

## Overview

Three complementary approaches for smoke testing the live site:

1. **Playwright E2E Tests** (`tests/e2e/public-smoke.spec.ts`) - Comprehensive API testing
2. **PowerShell Script** (`scripts/smoke-public.ps1`) - Quick command-line validation
3. **CI Workflow** (`.github/workflows/public-smoke.yml`) - Automated monitoring

## 1. Playwright E2E Tests

### File: `tests/e2e/public-smoke.spec.ts`

Tests three critical endpoints:
- ✅ `/ready` - Health check endpoint
- ✅ `/llm/diag` - Diagnostics endpoint
- ✅ `/api/chat` - AI chat endpoint (non-streaming)

### Run Locally

```bash
# Run all public smoke tests
npm run smoke:public

# Or with custom URL
PUBLIC_URL=https://assistant.ledger-mind.org npx playwright test -g "@public-smoke"
```

### Features
- API-only tests (no browser needed)
- 10-15s timeouts with retry logic
- Flexible assertions (handles different response formats)
- Tagged with `@public-smoke` for easy filtering

## 2. PowerShell Script

### File: `scripts/smoke-public.ps1`

Quick validation script with built-in retry logic.

### Run

```powershell
# Default (production URL)
pwsh ./scripts/smoke-public.ps1

# Custom URL
pwsh ./scripts/smoke-public.ps1 -BaseUrl https://assistant.ledger-mind.org

# Custom retries/delays
pwsh ./scripts/smoke-public.ps1 -Retries 3 -DelaySec 3
```

### Features
- Built-in retry logic (5 retries, 2s delay by default)
- JSON validation (detects HTML error pages)
- Clear success/failure output
- Perfect for quick manual checks

## 3. CI Workflow

### File: `.github/workflows/public-smoke.yml`

Automated monitoring with GitHub Actions.

### Triggers
- **Schedule**: Every 30 minutes (`cron: "*/30 * * * *"`)
- **Manual**: Via `workflow_dispatch`
- **PR Changes**: When smoke test files are modified

### Features
- Runs on Ubuntu (no Docker needed)
- 10-minute timeout
- Uploads traces on failure for debugging
- Can wire to Statuspage/Slack for alerting

## Test Coverage

### ✅ Health Check (`/ready`)
```bash
GET /ready
Expected: 200 OK with JSON body
```

### ✅ Diagnostics (`/llm/diag`)
```bash
GET /llm/diag
Expected: 200 OK with non-empty response
```

### ✅ Chat (`/api/chat`)
```bash
POST /api/chat
Body: {"messages":[{"role":"user","content":"Hi"}],"stream":false}
Expected: 2xx with JSON response
```

## Results

### Playwright Output
```
Running 3 tests using 3 workers
  3 passed (9.4s)
```

### PowerShell Output
```
→ Health: https://assistant.ledger-mind.org/ready
OK
→ Diag: https://assistant.ledger-mind.org/llm/diag
OK
→ Chat: https://assistant.ledger-mind.org/api/chat (non-stream)
All public smoke checks passed ✅
```

## Configuration

### Timeouts
- **Playwright GET**: 10s timeout
- **Playwright POST**: 15s timeout
- **PowerShell**: 5 retries × 2s delay = max 10s per endpoint

### URLs
Default: `https://assistant.ledger-mind.org`

Override via:
- Playwright: `PUBLIC_URL` env var
- PowerShell: `-BaseUrl` parameter
- CI: Update workflow env vars

## Guardrails (Optional Enhancements)

### Rate Limiting Protection
Add custom user agent in Playwright config:

```text
// playwright.config.ts
use: {
  extraHTTPHeaders: {
    'User-Agent': 'lm-public-smoke/1.0'
  }
}
```

### Alerting
Wire workflow to Statuspage or Slack:
```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### SLA Monitoring
- Keep timeouts modest (10-15s)
- Use 3-5 retries to handle tunnel hiccups
- Monitor workflow failure rate in GitHub Actions insights

## Troubleshooting

### Test Fails with 404
- Check DNS: `nslookup assistant.ledger-mind.org`
- Verify tunnel running: `docker logs portfolio-tunnel`
- Test locally first: `curl http://localhost:8080/ready`

### Test Fails with Timeout
- Check Cloudflare tunnel status (4 edge connections expected)
- Verify backend running: `curl http://localhost:8000/ready`
- Check nginx container: `docker ps --filter name=portfolio-nginx`

### Chat Endpoint Returns 405
- Ensure using `/api/chat` not `/chat`
- Check POST method is used
- Verify Content-Type header: `application/json`

## CI Integration

### Add to PR Checks
```yaml
# .github/workflows/pr.yml
- name: Public smoke tests
  run: npm run smoke:public
```

### Schedule Regular Checks
Already configured in `.github/workflows/public-smoke.yml` to run every 30 minutes.

### View Results
- GitHub Actions → Workflows → public-smoke
- Check logs for detailed request/response info
- Download trace artifacts if tests fail

## Maintenance

### Update Endpoints
Edit `tests/e2e/public-smoke.spec.ts` and `scripts/smoke-public.ps1` together.

### Adjust Timeouts
```text
// Playwright
const res = await ctx.get(`${BASE}${path}`, { timeout: 10_000 });
```

```text
# PowerShell
Invoke-With-Retry { ... } $Retries $DelaySec
```

### Add New Tests
Follow existing pattern:
```typescript
test('new endpoint', async ({ request }) => {
  const res = await get(request, '/new-endpoint');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toBeTruthy();
});
```
