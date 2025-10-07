# Deployment Checklist

Fast pre-deploy verification to ensure everything ships solid.

---

## 🚀 Ship Checklist (Fast)

### 1. Environment Variables

Verify these are set on the production server:

```bash
# Required backend environment variables
ADMIN_TOKEN=<your-secure-token>     # For admin endpoints
RAG_DB=/path/to/rag.sqlite          # RAG database location
PROJECTS_JSON=/path/to/projects.json # Projects data file

# Optional: If using OpenAI fallback
OPENAI_API_KEY=<your-key>
DISABLE_PRIMARY=0                    # 0=use Ollama, 1=use OpenAI
```

**Verification:**
```bash
# On server
echo $ADMIN_TOKEN
echo $RAG_DB
echo $PROJECTS_JSON
```

---

### 2. Content Security Policy (CSP)

Ensure Calendly is allowed in both pages:

#### `index.html` (main page)
Should already have CSP via build process. Verify in built file:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://assets.calendly.com;
  style-src 'self' 'unsafe-inline' https://assets.calendly.com;
  img-src 'self' data: https://*.calendly.com;
  frame-src https://calendly.com https://*.calendly.com;
  connect-src 'self' https://calendly.com https://*.calendly.com;
  font-src 'self' https://fonts.gstatic.com;">
```

#### `book.html` (booking page)
✅ Already configured with proper CSP headers.

**Test:**
```bash
curl -s https://<your-host>/book.html | grep -i "Content-Security-Policy"
```

---

### 3. Fonts Configuration

Verify Google Fonts preconnect and links are present:

**Check in `index.html`:**
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

**Check in `book.html`:**
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**Test:**
```bash
# Should load without CORS errors
curl -I https://<your-host>/ | grep -i font
```

---

### 4. Asset Caching

Configure long-lived cache headers for static assets:

**Nginx example:**
```nginx
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";

  # For versioned assets (with hash in filename)
  location ~ \.(js|css|woff2?|jpg|png|webp|svg)$ {
    expires max;
    add_header Cache-Control "public, immutable";
  }
}

# Calendly helper script
location = /assets/js/calendly.js {
  expires 1d;  # Shorter cache for custom script
  add_header Cache-Control "public, must-revalidate";
}
```

**Apache example (.htaccess):**
```apache
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"

  # Calendly helper - shorter cache
  <Files "calendly.js">
    ExpiresDefault "access plus 1 day"
  </Files>
</IfModule>
```

**Test:**
```bash
curl -I https://<your-host>/assets/js/calendly.js | grep -i cache
# Should see: Cache-Control: public, must-revalidate
```

---

## 🧪 CI/CD Guards (Run on Every PR)

Add these commands to your CI pipeline (GitHub Actions, GitLab CI, etc.):

### Typography Tests
```bash
# Must pass on at least Chromium
npx playwright test tests/e2e/typography.spec.ts --project=chromium
```

**Expected output:**
```
✓ 8 passed (typography.spec.ts)
```

### Calendly Tests
```bash
# All Calendly flows: offline (stubbed) + analytics + theme
npx playwright test tests/e2e/calendly*.spec.ts --project=chromium
```

**Expected output:**
```
✓ 4 passed (calendly.spec.ts)
✓ 6 passed (calendly.nice.spec.ts)
✓ 2 passed (calendly.analytics-theme.spec.ts)
Total: 12 passed
```

### Example GitHub Actions Workflow

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main, polish]
  push:
    branches: [main, polish]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Build project
        run: npm run build

      - name: Copy book.html to dist
        run: cp book.html dist/book.html

      - name: Run Typography Tests
        run: npx playwright test tests/e2e/typography.spec.ts --project=chromium

      - name: Run Calendly Tests
        run: npx playwright test tests/e2e/calendly*.spec.ts --project=chromium

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 🔍 Post-Deploy Smoke Tests (30 seconds)

Run these immediately after deployment to verify production health:

### 1. RAG System Health

```bash
# Check RAG is online and database exists
curl -s -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://<your-host>/api/rag/diag/rag | jq '.env.user_version, .files.rag_db.exists'
```

**Expected output:**
```json
"4"
true
```

**Interpretation:**
- `user_version: "4"` = SQLite schema is correct
- `rag_db.exists: true` = Database file found

**If fails:**
- Check `RAG_DB` environment variable
- Verify database file permissions (readable by app user)
- Check backend logs: `journalctl -u your-app -n 50`

---

### 2. Calendly Integration

```bash
# Check popup button is present on homepage
curl -s https://<your-host>/ | grep -i 'data-calendly-url'
```

**Expected output:**
```html
<a id="book-call" ... data-calendly-url="https://calendly.com/leok974/intro-15" ...>
```

**If not found:**
- Check if build completed successfully
- Verify `index.html` was deployed
- Check for JavaScript errors in browser console

---

### 3. Booking Page Inline Widget

```bash
# Check inline widget is configured
curl -s https://<your-host>/book.html | grep -i 'calendly-inline'
```

**Expected output:**
```html
<div id="calendly-inline" data-testid="calendly-inline" data-calendly-url="https://calendly.com/leok974/intro-15" ...></div>
```

---

### 4. Analytics Helper Loaded

```bash
# Check calendly.js is accessible
curl -I https://<your-host>/assets/js/calendly.js
```

**Expected output:**
```
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, must-revalidate
```

---

### 5. Backend API Health

```bash
# Check backend is responding
curl -s https://<your-host>/ready
```

**Expected output:**
```json
{"status":"ready"}
```

---

### 6. Full Stack Integration Test

```bash
# Test chat endpoint with RAG
curl -s -X POST https://<your-host>/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about your projects","stream":false}' | jq '.response'
```

**Expected output:**
```json
"I work on several AI and creative tech projects including..."
```

---

## 📊 Monitoring Setup (Recommended)

### Key Metrics to Track

1. **Calendly Widget Load Time**
```javascript
// Add to analytics tracking
window.addEventListener('calendly:helper-ready', () => {
  if (window.gtag) {
    gtag('event', 'timing_complete', {
      name: 'calendly_helper_load',
      value: performance.now(),
      event_category: 'JS Dependencies'
    });
  }
});
```

2. **RAG Query Performance**
```python
# In assistant_api/main.py
import time

@app.post("/api/rag/query")
async def rag_query(req: RAGQueryRequest):
    start = time.time()
    result = await perform_rag_query(req.query)
    duration = (time.time() - start) * 1000

    logger.info(f"RAG query took {duration:.2f}ms")
    return {"result": result, "duration_ms": duration}
```

3. **Error Rates**
- Track 4xx/5xx responses
- Monitor JavaScript errors via Sentry/similar
- Alert on RAG database connection failures

---

## 🐛 Troubleshooting

### Calendly widget not appearing

**Symptoms:**
- Button visible but clicking does nothing
- Inline widget shows empty container

**Debug steps:**
1. Check browser console for errors
2. Verify CSP allows Calendly domains:
   ```bash
   curl -I https://<your-host>/book.html | grep -i content-security
   ```
3. Test calendly.js loads:
   ```bash
   curl https://<your-host>/assets/js/calendly.js | head -20
   ```
4. Check for ad blockers (uBlock Origin blocks Calendly by default)

**Fix:**
- Add CSP headers as documented above
- Ensure `calendly.js` is deployed to `/assets/js/`
- Ask users to whitelist your domain in ad blockers

---

### RAG queries returning empty results

**Symptoms:**
- Chat responses are generic (not using context)
- `/api/rag/query` returns empty `sources`

**Debug steps:**
1. Check database exists:
   ```bash
   curl -H "X-Admin-Token: $ADMIN_TOKEN" \
     https://<your-host>/api/rag/diag/rag | jq '.files.rag_db'
   ```
2. Verify embeddings table has data:
   ```bash
   sqlite3 $RAG_DB "SELECT COUNT(*) FROM embeddings;"
   ```
3. Check Ollama/OpenAI connectivity

**Fix:**
- Re-run ingestion: `python -m assistant_api.rag.ingest`
- Verify `RAG_DB` path is correct
- Check backend logs for connection errors

---

### Fonts not loading (FOUT/FOIT)

**Symptoms:**
- Text appears in system font briefly
- Console shows CORS errors for fonts

**Debug steps:**
1. Check preconnect is present:
   ```bash
   curl -s https://<your-host>/ | grep fonts.gstatic.com
   ```
2. Test font loads:
   ```bash
   curl -I https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2
   ```

**Fix:**
- Ensure `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` is in `<head>`
- Add `crossorigin` attribute to preconnect
- Consider self-hosting fonts for max performance

---

## 🎯 Success Criteria

Before declaring deployment successful, verify:

- [x] All E2E tests passing (typography + calendly)
- [x] Backend `/ready` returns 200
- [x] RAG database accessible and populated
- [x] Calendly popup opens on homepage button click
- [x] Calendly inline widget loads on `/book.html`
- [x] Analytics events fire (check `window.__analyticsEvents` in console)
- [x] Theme toggle works (if using global theme system)
- [x] Fonts load without CORS errors
- [x] No CSP violations in browser console
- [x] Long cache headers on static assets

---

## 📚 Related Documentation

- [CALENDLY_NICE_TO_HAVES.md](./CALENDLY_NICE_TO_HAVES.md) - Enhanced Calendly features
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [DEPLOY.md](./DEPLOY.md) - Detailed deployment instructions
- [OPERATIONS.md](../OPERATIONS.md) - Production operations guide

---

## 🚨 Emergency Rollback

If critical issues arise post-deploy:

```bash
# 1. Revert to previous working version
git revert <commit-hash>
git push origin main

# 2. Or rollback Docker container
docker pull your-registry/leo-portfolio:previous-tag
docker-compose up -d

# 3. Verify rollback worked
curl https://<your-host>/ready
npx playwright test tests/e2e/calendly*.spec.ts --project=chromium
```

**Incident Response:**
1. Roll back immediately (don't debug in prod)
2. Verify rollback with smoke tests
3. Debug in staging/local environment
4. Fix + test thoroughly
5. Re-deploy with extra verification

---

## 📞 Support Contacts

- **Frontend Issues**: Check browser console, verify CSP
- **Backend Issues**: Check `journalctl -u assistant-api -n 100`
- **RAG Issues**: Verify database + embeddings exist
- **Calendly Issues**: Test without ad blockers, verify CSP allows domains

**Useful commands:**
```bash
# View backend logs
journalctl -u assistant-api -f

# Check nginx access logs
tail -f /var/log/nginx/access.log | grep -i calendly

# Monitor error rates
grep -i error /var/log/nginx/error.log | tail -20
```
