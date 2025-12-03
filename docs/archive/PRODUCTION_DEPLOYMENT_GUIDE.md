# Portfolio Production Deployment Guide

## Overview
Deploy portfolio to **https://assistant.ledger-mind.org** with same-origin API proxy (no CORS).

---

## 1. Production Environment Configuration

**File:** `apps/portfolio-ui/.env.production`

```bash
# Public website domain (used by OG tags, canonical, etc.)
VITE_SITE_ORIGIN=https://assistant.ledger-mind.org

# Disable dev admin override (require real auth)
VITE_ALLOW_DEV_ADMIN=0

# Assistant API - Empty = same-origin (goes through nginx proxy, no CORS)
VITE_AGENT_API_BASE=

# Calendly booking URL (verified working)
VITE_CALENDLY_URL=https://calendly.com/leoklemet-pa

# Enable dynamic layout in production (if API serves /api/layout)
VITE_LAYOUT_ENABLED=1
```

✅ **Key Changes:**
- `VITE_AGENT_API_BASE=""` - Same-origin requests through nginx (no CORS)
- `VITE_SITE_ORIGIN` - Your production domain for meta tags
- `VITE_CALENDLY_URL` - Verified Calendly booking link

---

## 2. Nginx Production Configuration

**File:** `deploy/nginx.portfolio.conf`

### Key Features:
1. **HTTP → HTTPS Redirect**
2. **Same-Origin API Proxy** (no CORS headers needed)
   - `/chat` → `https://assistant.ledger-mind.org/chat`
   - `/chat/stream` → `https://assistant.ledger-mind.org/chat/stream`
   - `/resume/*` → `https://assistant.ledger-mind.org/resume/*`
   - `/api/*` → `https://assistant.ledger-mind.org/api/*`
3. **Static Asset Caching** (30 days for `/assets/`)
4. **SPA Fallback** (after all API routes)
5. **Security Headers** (CSP, X-Frame-Options, etc.)

### SSL Configuration
Update these lines with your actual SSL cert paths:
```nginx
ssl_certificate /etc/letsencrypt/live/assistant.ledger-mind.org/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/assistant.ledger-mind.org/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

---

## 3. Build & Deploy Steps

### Step 1: Install Dependencies
```bash
cd d:\leo-portfolio
npm ci
```

### Step 2: Build Portfolio UI
```bash
npm run build:portfolio
```

**Expected Output:**
```
✓ 11 modules transformed.
../../dist-portfolio/index.html                ~14 kB
../../dist-portfolio/assets/main-*.css         ~12 kB
../../dist-portfolio/assets/main-*.js          ~26 kB
✓ built in ~600ms
```

### Step 3: Deploy to Server

**Option A: rsync (if direct server access)**
```bash
rsync -avz --delete dist-portfolio/ your-server:/var/www/portfolio/
```

**Option B: Docker Image**
```bash
# Build image
docker build -f deploy/Dockerfile.portfolio -t portfolio:latest .

# Push to registry
docker tag portfolio:latest your-registry/portfolio:latest
docker push your-registry/portfolio:latest

# Deploy on server
ssh your-server "docker pull your-registry/portfolio:latest && docker-compose up -d portfolio"
```

**Option C: Manual Copy**
```bash
# Create archive
tar -czf portfolio-dist.tar.gz -C dist-portfolio .

# Copy to server
scp portfolio-dist.tar.gz your-server:/tmp/

# Extract on server
ssh your-server "sudo tar -xzf /tmp/portfolio-dist.tar.gz -C /var/www/portfolio/"
```

### Step 4: Deploy Nginx Configuration
```bash
# Copy nginx config to server
scp deploy/nginx.portfolio.conf your-server:/etc/nginx/sites-available/portfolio.conf

# Create symlink (if needed)
ssh your-server "sudo ln -sf /etc/nginx/sites-available/portfolio.conf /etc/nginx/sites-enabled/portfolio.conf"

# Test nginx configuration
ssh your-server "sudo nginx -t"

# Reload nginx
ssh your-server "sudo systemctl reload nginx"
```

---

## 4. Post-Deployment Smoke Tests

### Test 1: Health Check
```bash
curl https://assistant.ledger-mind.org/healthz
# Expected: ok
```

### Test 2: Static Assets
```bash
curl -I https://assistant.ledger-mind.org/assets/ledgermind-thumb.svg
# Expected: HTTP/2 200, Content-Type: image/svg+xml
```

### Test 3: Resume PDF
```bash
curl -I https://assistant.ledger-mind.org/resume/Leo_Klemet_Resume.pdf
# Expected: HTTP/2 200, Content-Type: application/pdf
# Or HTTP/2 200 if proxying to API for /resume/generate.pdf
```

### Test 4: Projects JSON
```bash
curl https://assistant.ledger-mind.org/projects.json | jq .
# Expected: Valid JSON with project data
```

### Test 5: Assistant Chat (Non-Streaming)
```bash
curl -X POST https://assistant.ledger-mind.org/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
# Expected: HTTP/2 200, JSON response
```

### Test 6: Assistant Chat (Streaming)
```bash
curl -N -X POST https://assistant.ledger-mind.org/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
# Expected: HTTP/2 200, text/event-stream with SSE chunks
```

### Browser Tests

Open **https://assistant.ledger-mind.org** and verify:

1. **Page Loads:**
   - ✅ No console errors
   - ✅ All images/assets load (200 status)
   - ✅ Calendly widget displays fully (height: 760px, no clipping)

2. **Navigation:**
   - ✅ Internal links work (About, Projects, Contact)
   - ✅ SPA routing works without page reload
   - ✅ Direct URL access works (e.g., `/projects`)

3. **Resume Buttons (About Section):**
   - ✅ "View Resume (PDF)" opens PDF in new tab
   - ✅ "Copy for LinkedIn" copies text to clipboard
   - ✅ Shows "✅ Copied!" feedback

4. **Assistant Chat:**
   - ✅ Click assistant icon (bottom right)
   - ✅ Send message
   - ✅ Streaming response appears
   - ✅ No "offline" badge
   - ✅ Network tab: `POST /chat/stream` shows `pending` with `text/event-stream`

5. **Calendly Widget:**
   - ✅ Widget loads without 404
   - ✅ Full booking form visible (760px height)
   - ✅ Date picker dropdown not clipped
   - ✅ Can complete booking flow

6. **Console:**
   - ✅ No CORS errors
   - ✅ No `/api/layout` 404 (or silenced if VITE_LAYOUT_ENABLED=0)
   - ✅ No missing asset 404s

---

## 5. Architecture Diagram

### Production Same-Origin Setup
```
┌─────────────────────────────────────────────────────┐
│ Browser (https://assistant.ledger-mind.org)         │
│                                                      │
│  VITE_AGENT_API_BASE=""                             │
│  fetch("/chat", { method: "POST" })                 │
│         │                                            │
│         └─────────► Same origin, no CORS            │
└─────────────────────────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────┐
│ Nginx (assistant.ledger-mind.org:443)               │
│                                                      │
│  location /chat {                                   │
│    proxy_pass https://assistant.ledger-mind.org;   │
│    proxy_set_header Host assistant.ledger-mind.org;│
│    proxy_ssl_server_name on;                       │
│  }                                                   │
└─────────────────────────────────────────────────────┘
                    │
                    │ HTTPS (self-proxy)
                    ▼
┌─────────────────────────────────────────────────────┐
│ Backend API (assistant.ledger-mind.org)             │
│                                                      │
│  FastAPI /chat, /chat/stream, /resume/*            │
│  Returns: JSON or SSE stream                        │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
1. ✅ No CORS complexity (same origin)
2. ✅ Single SSL cert for entire site
3. ✅ Simplified frontend code
4. ✅ Easy to add auth/caching at nginx layer
5. ✅ Clean separation of concerns

---

## 6. Troubleshooting

### Issue: 502 Bad Gateway on /chat

**Cause:** Nginx can't reach backend API

**Solutions:**
1. Verify backend is running: `curl https://assistant.ledger-mind.org/api/ready`
2. Check DNS resolution in nginx: `docker exec nginx-container nslookup assistant.ledger-mind.org`
3. Verify SSL/TLS: `openssl s_client -connect assistant.ledger-mind.org:443`
4. Check nginx error logs: `tail -f /var/log/nginx/error.log`

### Issue: Resume PDF returns HTML instead

**Cause:** SPA fallback catching `/resume/*` route

**Solution:** Ensure `/resume/` location block is BEFORE the SPA fallback `location /` block in nginx config.

### Issue: Calendly widget clipped/short

**Cause:** Parent container has `overflow: hidden` or insufficient height

**Solution:**
```html
<div style="overflow: visible;">
  <div
    class="calendly-inline-widget"
    style="min-width: 320px; height: 760px; overflow: visible;"
  ></div>
</div>
```

### Issue: CORS errors still appearing

**Cause:** Frontend still using `VITE_AGENT_API_BASE=https://...` (cross-origin)

**Solution:** Set `VITE_AGENT_API_BASE=` (empty) in `.env.production` and rebuild.

### Issue: Assets 404ing

**Cause:** Relative paths instead of absolute paths

**Solution:** Always use leading slash: `/assets/image.png` not `assets/image.png`

---

## 7. Rollback Procedure

If deployment has issues:

### Quick Rollback (Nginx)
```bash
# Restore previous nginx config
ssh your-server "sudo cp /etc/nginx/sites-available/portfolio.conf.bak /etc/nginx/sites-available/portfolio.conf"
ssh your-server "sudo nginx -t && sudo systemctl reload nginx"
```

### Full Rollback (Static Files)
```bash
# Restore previous build
ssh your-server "sudo rm -rf /var/www/portfolio/*"
ssh your-server "sudo tar -xzf /var/www/portfolio-backup.tar.gz -C /var/www/portfolio/"
```

---

## 8. Monitoring & Logs

### Nginx Access Logs
```bash
ssh your-server "tail -f /var/log/nginx/access.log | grep assistant"
```

### Nginx Error Logs
```bash
ssh your-server "tail -f /var/log/nginx/error.log"
```

### Backend API Logs
```bash
ssh your-server "docker logs -f assistant-api"
```

### Key Metrics to Monitor
- **Response Times:** `/chat/stream` should respond < 2s
- **Error Rates:** Watch for 5xx errors
- **SSL Cert Expiry:** Monitor cert renewal (Let's Encrypt auto-renew)
- **Disk Usage:** Portfolio build is ~50 KB

---

## 9. Security Checklist

- ✅ HTTPS enforced (HTTP redirects to HTTPS)
- ✅ SSL/TLS 1.2+ only
- ✅ CSP headers with nonce for inline scripts
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ No sensitive data in frontend code
- ✅ API credentials not exposed
- ✅ Static assets cached (no sensitive data in cache)

---

## 10. Commit Message

```
chore(prod): configure production deployment for assistant.ledger-mind.org

- Add VITE_SITE_ORIGIN for production domain
- Use same-origin proxies for /chat, /chat/stream, /resume, /api (no CORS)
- Configure nginx.portfolio.conf with HTTPS, SSL, and API proxies
- Set VITE_AGENT_API_BASE="" for same-origin API calls
- Update Calendly URL to verified leoklemet-pa slug
- Enable VITE_LAYOUT_ENABLED=1 for production layout API
- Add DNS resolver for nginx HTTPS proxy_pass
- Configure static asset caching (30 days)
- Add SPA fallback after all API routes
- Document build, deploy, and smoke test procedures

Production URL: https://assistant.ledger-mind.org
API Proxy: same-origin (no CORS complexity)
Resume: /resume/Leo_Klemet_Resume.pdf or /resume/generate.pdf (API)
Calendly: https://calendly.com/leoklemet-pa
```

---

## Quick Reference Commands

```bash
# Build
npm run build:portfolio

# Deploy (choose one)
rsync -avz --delete dist-portfolio/ server:/var/www/portfolio/

# Reload nginx
ssh server "sudo nginx -t && sudo systemctl reload nginx"

# Test
curl https://assistant.ledger-mind.org/healthz
curl -I https://assistant.ledger-mind.org/resume/Leo_Klemet_Resume.pdf
curl -X POST https://assistant.ledger-mind.org/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"test"}]}'

# Logs
ssh server "tail -f /var/log/nginx/error.log"
```

---

**Ready to deploy to production!** 🚀
