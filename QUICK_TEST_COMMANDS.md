# Quick Test Commands - October 17, 2025

## Prerequisites

```powershell
# Ensure dependencies are installed
npm install
```

---

## Run Assistant Panel Tests (Against Preview)

```powershell
# Terminal 1: Start preview server
npm run preview -- --port 4173

# Terminal 2: Run tests
$env:PW_BASE_URL = "http://127.0.0.1:4173"
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium --reporter=line --workers=1
```

**Expected Output**:
```
✓ Portfolio Assistant panel > Hide button collapses panel and persists; Alt+P reopens
✓ Portfolio Assistant panel > Escape key hides the panel
✓ Portfolio Assistant panel > Layout panel shows friendly message when layout is null
✓ Portfolio Assistant panel > Layout panel renders JSON when layout exists ← This one!
✓ Portfolio Assistant panel > Hide button has correct type="button" attribute
✓ Portfolio Assistant panel > Panel persists hidden state across multiple reloads
✓ SEO: OG image > og:image is absolute and points to leoklemet.com
✓ SEO: OG image > og:url is absolute and points to leoklemet.com
✓ SEO: OG image > canonical link points to leoklemet.com
✓ SEO: OG image > og:image has width and height meta tags
✓ SEO: OG image > twitter:image points to leoklemet.com
✓ SEO: OG image > JSON-LD structured data has correct URL
```

---

## Test Docker Compose Stack

```powershell
# Build and start
docker compose -f deploy/docker-compose.portfolio-prod.yml up -d --build

# Wait for services to be healthy (30-60 seconds)
Start-Sleep -Seconds 30

# Test nginx
curl -s http://127.0.0.1:8082/healthz
# Expected: OK or 200

# Test backend (if exposed)
curl -s http://127.0.0.1:8001/ready
# Expected: {"status":"ok",...}

# Test dev overlay API
curl -s http://127.0.0.1:8001/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}

# Cleanup
docker compose -f deploy/docker-compose.portfolio-prod.yml down
```

---

## Test Ollama Port Change (CI Stack)

```powershell
# Start CI stack
docker compose -f deploy/docker-compose.ci.yml up -d

# Verify Ollama on NEW port (11435, not 11434)
curl -s http://127.0.0.1:11435/api/tags

# Should NOT conflict with Docker Desktop Ollama
netstat -ano | findstr :11434
# Should show Docker Desktop Ollama (if running)

netstat -ano | findstr :11435
# Should show CI mock-ollama container

# Cleanup
docker compose -f deploy/docker-compose.ci.yml down
```

---

## Debug Failing Tests

### Show Browser (Non-Headless)

```powershell
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium --headed
```

### Show Trace on Failure

```powershell
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium --trace on
npx playwright show-report
```

### Run Single Test

```powershell
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium -g "Layout panel renders JSON"
```

### Debug Mode (Step Through)

```powershell
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium --debug
```

---

## All Tests (Full Suite)

```powershell
# Run all e2e tests
npx playwright test --project=chromium

# Run with UI mode (interactive)
npx playwright test --ui
```

---

## CI Simulation

```powershell
# Set CI environment
$env:CI = "true"

# Run with CI settings (retries, html report)
npx playwright test tests/e2e/assistant-panel.spec.ts --project=chromium

# View HTML report
npx playwright show-report
```

---

## Common Issues

### Port Already in Use

```powershell
# Find process using port 4173
netstat -ano | findstr :4173

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or use different port
npm run preview -- --port 4174
$env:PW_BASE_URL = "http://127.0.0.1:4174"
```

### Service Workers Interfering

**Already fixed** in `playwright.config.ts` with `serviceWorkers: 'block'`

If still issues:
```typescript
// Add to test beforeEach
await context.clearCookies();
await context.clearPermissions();
```

### Route Not Being Intercepted

```typescript
// Add logging to route handler
await page.route('**/*', async (route) => {
  const url = route.request().url();
  console.log('[ROUTE]', url);
  if (url.endsWith('/api/layout')) {
    console.log('[ROUTE] Intercepting /api/layout');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ layout: { grid: 'A/B', weights: { hero: 0.7 } } }),
    });
  }
  return route.continue();
});
```

Run with debug:
```powershell
$env:DEBUG = "pw:api"
npx playwright test ...
```

---

## Production Verification

```powershell
# After deploy, test live site
curl -s https://www.leoklemet.com/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}

# Enable dev overlay
curl -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable

# Visit site
start https://www.leoklemet.com
# Expected: DEV badge in bottom-right corner
```

---

## Quick Checklist

- [ ] Preview server running on 4173
- [ ] Tests pass with `PW_BASE_URL=http://127.0.0.1:4173`
- [ ] Compose stack starts without errors
- [ ] Backend /ready endpoint responds
- [ ] Dev overlay /agent/dev/status returns JSON
- [ ] Ollama uses port 11435 (not 11434)
- [ ] No port conflicts reported

---

**All systems go! 🚀**
