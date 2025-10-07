# 🚀 Production Deployment - Quick Reference

**Pre-flight:** 5 minutes | **Deploy:** 2 minutes | **Verify:** 30 seconds

---

## ⚡ Fast Pre-Deploy Check

```bash
# 1. Run critical E2E tests (3-4s)
npx playwright test tests/e2e/typography.spec.ts --project=chromium
npx playwright test tests/e2e/calendly*.spec.ts --project=chromium

# 2. Build frontend
npm run build

# 3. Copy booking page
cp book.html dist/book.html
cp public/assets/js/calendly.js dist/assets/js/calendly.js

# 4. Verify build artifacts
ls -lh dist/index.html dist/book.html dist/assets/js/calendly.js
```

**Expected:** All tests green, build successful, files present.

---

## 🔧 Server Environment Variables

```bash
# Required
export ADMIN_TOKEN="your-secure-random-token"
export RAG_DB="/path/to/rag.sqlite"
export PROJECTS_JSON="/path/to/projects.json"

# Optional
export OPENAI_API_KEY="sk-..."      # Fallback LLM
export DISABLE_PRIMARY="0"           # 0=Ollama, 1=OpenAI
export ALLOW_UNSAFE="0"              # 0=enforce guardrails
```

**Verify:**
```bash
echo $ADMIN_TOKEN $RAG_DB $PROJECTS_JSON
```

---

## 📦 Deploy Commands

### Docker Compose
```bash
# Pull latest images
docker-compose pull

# Deploy with zero downtime
docker-compose up -d

# Check logs
docker-compose logs -f assistant-api
```

### Systemd Service
```bash
# Restart backend
sudo systemctl restart assistant-api

# Check status
sudo systemctl status assistant-api

# Watch logs
journalctl -u assistant-api -f
```

### Static Frontend (Nginx/Apache)
```bash
# Sync dist folder
rsync -av --delete dist/ /var/www/portfolio/

# Or with SCP
scp -r dist/* user@server:/var/www/portfolio/

# Reload Nginx
sudo nginx -t && sudo nginx -s reload
```

---

## ✅ 30-Second Smoke Test

### Automated (Recommended)
```bash
# Bash
./scripts/smoke-test.sh https://your-domain.com $ADMIN_TOKEN

# PowerShell
.\scripts\smoke-test.ps1 -Host "https://your-domain.com" -AdminToken $env:ADMIN_TOKEN
```

### Manual Verification
```bash
# 1. Backend health
curl https://your-domain.com/ready
# ✓ Should return: {"status":"ready"}

# 2. RAG online
curl -H "X-Admin-Token: $TOKEN" https://your-domain.com/api/rag/diag/rag | jq '.env.user_version, .files.rag_db.exists'
# ✓ Should return: "4", true

# 3. Calendly button present
curl -s https://your-domain.com/ | grep -i 'data-calendly-url'
# ✓ Should find: data-calendly-url="https://calendly.com/..."

# 4. Booking page
curl -I https://your-domain.com/book.html
# ✓ Should return: HTTP/1.1 200 OK

# 5. Helper script
curl -I https://your-domain.com/assets/js/calendly.js
# ✓ Should return: HTTP/1.1 200 OK
```

---

## 🎯 Browser Checks (1 minute)

Open in browser: `https://your-domain.com`

1. **Homepage loads** ✓
2. **"Book a call" button visible** ✓ (top-right or in nav)
3. **Click button → Calendly popup opens** ✓
4. **Open `/book.html`** ✓
5. **Inline Calendly widget loads** ✓
6. **No CSP errors in console** ✓ (F12 → Console)
7. **Theme toggle works** ✓ (if applicable)

**Quick console check:**
```javascript
// Check helper loaded
window.__calendlyHelperLoaded  // → true

// Check analytics stub
window.__analyticsEvents        // → []

// Test popup (will fail if already open)
document.getElementById('book-call').click()
```

---

## 🔍 CSP Verification

```bash
# Check CSP headers
curl -I https://your-domain.com/book.html | grep -i content-security

# Should include:
# - script-src: 'self' https://assets.calendly.com
# - frame-src: https://calendly.com https://*.calendly.com
# - style-src: 'self' 'unsafe-inline' https://assets.calendly.com
```

**If missing:** Add to `book.html` `<head>`:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://assets.calendly.com;
  style-src 'self' 'unsafe-inline' https://assets.calendly.com;
  img-src 'self' data: https://*.calendly.com;
  frame-src https://calendly.com https://*.calendly.com;
  connect-src 'self' https://calendly.com https://*.calendly.com;
  font-src 'self' https://fonts.gstatic.com;">
```

---

## 🚨 Rollback Procedure

If issues arise:

```bash
# 1. Quick rollback to previous version
git revert HEAD
git push origin main

# 2. Or Docker rollback
docker-compose down
docker-compose up -d --force-recreate

# 3. Verify rollback worked
curl https://your-domain.com/ready
npx playwright test calendly --project=chromium
```

---

## 📊 Monitoring Commands

```bash
# Backend logs (last 50 lines)
journalctl -u assistant-api -n 50

# Follow backend logs live
journalctl -u assistant-api -f

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx errors
tail -f /var/log/nginx/error.log

# Filter Calendly requests
tail -f /var/log/nginx/access.log | grep -i calendly

# Docker logs
docker-compose logs -f assistant-api
```

---

## 🎨 Common Fixes

### Calendly widget not appearing
```bash
# Check CSP
curl -I https://your-domain.com/book.html | grep -i content-security

# Check script loads
curl -I https://your-domain.com/assets/js/calendly.js

# Browser: F12 → Console → Check for errors
```

### Analytics not firing
```javascript
// Browser console:
window.__analyticsEvents  // Check if empty
window.gtag              // Check if defined
window.dataLayer         // Check if array
```

### Theme not working
```javascript
// Browser console:
document.documentElement.className        // Check for 'dark' class
document.documentElement.dataset.theme    // Check data-theme attribute
getComputedStyle(document.body).backgroundColor  // Check actual color
```

### RAG queries failing
```bash
# Check database exists
ls -lh /path/to/rag.sqlite

# Check backend can read it
curl -H "X-Admin-Token: $TOKEN" https://your-domain.com/api/rag/diag/rag

# Check embeddings count
sqlite3 /path/to/rag.sqlite "SELECT COUNT(*) FROM embeddings;"
```

---

## 📈 Success Criteria

Before declaring victory:

- [x] Backend `/ready` returns 200
- [x] RAG diagnostics show `user_version: "4"`, `rag_db.exists: true`
- [x] Homepage loads with Calendly button
- [x] Popup opens when button clicked
- [x] `/book.html` loads with inline widget
- [x] No CSP violations in browser console
- [x] Typography tests pass (8/8)
- [x] Calendly tests pass (12/12)
- [x] Smoke tests pass (11/11 checks)

---

## 📞 Emergency Contacts

**If things go wrong:**

1. **Check logs first:** `journalctl -u assistant-api -n 100`
2. **Verify environment:** `echo $ADMIN_TOKEN $RAG_DB`
3. **Test locally:** `npm run dev` + open `http://localhost:5173`
4. **Rollback if needed:** See "Rollback Procedure" above
5. **Re-run tests:** `npx playwright test calendly --project=chromium`

**Useful Links:**
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Full deployment guide
- [CALENDLY_COMPLETE_SUMMARY.md](./CALENDLY_COMPLETE_SUMMARY.md) - Feature overview
- [OPERATIONS.md](../OPERATIONS.md) - Operations guide

---

## 🎯 Next Steps After Deploy

1. **Monitor for 24 hours**
   - Check error rates in Nginx logs
   - Verify no CSP violations in browser
   - Test Calendly widget opens/loads
   - Check analytics events firing

2. **Set up alerts** (optional)
   ```bash
   # Example: Alert if backend down
   */5 * * * * curl -f https://your-domain.com/ready || mail -s "Backend down" you@email.com
   ```

3. **Track metrics**
   - Calendly popup opens (`calendly_open` events)
   - Booking page visits (`/book.html` access logs)
   - Actual bookings completed (Calendly dashboard)
   - Page load times (Google Analytics)

4. **Iterate**
   - Review analytics to see which UTM sources work best
   - A/B test button placements/copy
   - Add more CTAs if conversion is good
   - Consider custom fields for better lead qualification

---

**Deployment Time:** ~7 minutes total
**Rollback Time:** ~2 minutes
**Verification Time:** 30 seconds

🚀 **You're ready to ship!**
