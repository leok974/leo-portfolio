# leoklemet.com Setup Complete ✅

**Date**: October 15, 2025
**Domain**: leoklemet.com (with www.leoklemet.com primary)
**Status**: Infrastructure deployed, Cloudflare configured, awaiting DNS propagation

## Summary

Successfully configured complete infrastructure for leoklemet.com with:
- ✅ Nginx routing (static portfolio + dynamic backend)
- ✅ WWW canonical redirect (apex → www)
- ✅ Backend environment (cookie domain, base URL)
- ✅ Dev overlay endpoints with HMAC authentication
- ✅ **Cloudflare cache bypass rules** (via API)
- ✅ **Cache purged** for dynamic endpoints## Configuration Details

### 1. Nginx Configuration

**Main Server Block**: `/etc/nginx/conf.d/portfolio-leoklemet.com.conf`
```nginx
upstream portfolio_backend { server ai-finance-api.int:8000; keepalive 32; }

server {
  listen 80; listen [::]:80;
  server_name leoklemet.com www.leoklemet.com;

  # Dynamic backend routes
  location /agent/ {
    proxy_pass http://portfolio_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location = /chat {
    proxy_pass http://portfolio_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
  }

  location /api/ {
    proxy_pass http://portfolio_backend;
    proxy_set_header Host $host;
  }

  # Static portfolio
  location / {
    proxy_pass http://portfolio.int:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

**Redirect Block**: `/etc/nginx/conf.d/redirect-leoklemet.com.conf`
```nginx
server {
  listen 80; listen [::]:80;
  server_name leoklemet.com;
  return 301 https://www.leoklemet.com$request_uri;
}
```

### 2. Backend Environment

**File**: `C:\ai-finance-agent-oss-clean\docker-compose.override.yml`
```yaml
services:
  backend:
    environment:
      - COOKIE_DOMAIN=.leoklemet.com
      - COOKIE_SECURE=1
      - COOKIE_SAMESITE=lax
      - SITE_BASE_URL=https://www.leoklemet.com
```

**Effect**:
- Cookies set by backend will be valid for both www.leoklemet.com and leoklemet.com
- Base URL points to canonical www domain

### 3. Deployed Components

#### Frontend (Portfolio)
- **Container**: portfolio-ui
- **Image**: ghcr.io/leok974/leo-portfolio/portfolio:latest
- **Digest**: sha256:baa5d6ef9e376f7b84fc20b1dade1c3eedf1da1716762709cb7bc1b7a53a8a37
- **Features**:
  - Dev overlay bootstrap (`dev-overlay.ts`)
  - Auto-mount on page load when `sa_dev` cookie present
  - Calendly integration (Preact component)
  - Hide button with localStorage persistence
  - Chat backend routing

#### Backend (AI Finance API)
- **Container**: ai-finance-backend-1
- **Endpoints**:
  - `GET /agent/dev/status` - Dev overlay status
  - `GET /agent/dev/enable` - Enable dev overlay (requires `Authorization: Bearer dev`)
  - `GET /agent/dev/disable` - Disable dev overlay
  - `POST /chat` - Chat streaming
  - `GET|POST /api/*` - Various API endpoints

**Dev Overlay Security**:
- HMAC-SHA256 signed cookies
- Authorization header required for enable
- Cookie format: `1.<timestamp>.<signature>`
- 14-day expiration

### 4. Routing Flow

```
User Request → Cloudflare → Nginx (applylens-nginx-prod)
                               ├─ /agent/* → Backend (ai-finance-api.int:8000)
                               ├─ /chat    → Backend (SSE streaming)
                               ├─ /api/*   → Backend
                               └─ /        → Portfolio (portfolio.int:80)
```

**Redirect Flow**:
```
http://leoklemet.com/*  → 301 → https://www.leoklemet.com/*
https://leoklemet.com/* → 301 → https://www.leoklemet.com/*
```

## Testing (Before DNS Live)

Test all routes via Host header:

```bash
# Static portfolio
curl -s -H "Host: www.leoklemet.com" https://assistant.ledger-mind.org/

# Dev overlay status
curl -s -H "Host: www.leoklemet.com" https://assistant.ledger-mind.org/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}

# Enable dev overlay
curl -i -H "Host: www.leoklemet.com" -H "Authorization: Bearer dev" https://assistant.ledger-mind.org/agent/dev/enable
# Expected: Set-Cookie: sa_dev=1.<timestamp>.<signature>; Domain=.leoklemet.com; ...

# Chat endpoint
curl -X POST -H "Host: www.leoklemet.com" -H "Content-Type: application/json" -d '{"message":"test"}' https://assistant.ledger-mind.org/chat
```

## Next Steps (Required)

### 1. Configure Cloudflare DNS ⏳ **REQUIRED**

**In Cloudflare Dashboard for leoklemet.com zone**:

1. Add DNS records:
   ```
   Type: A or CNAME
   Name: www
   Content: <your-server-ip-or-hostname>
   Proxy: Proxied (orange cloud)

   Type: A or CNAME
   Name: @
   Content: <your-server-ip-or-hostname>
   Proxy: Proxied (orange cloud)
   ```

2. Verify DNS propagation:
   ```bash
   nslookup www.leoklemet.com
   nslookup leoklemet.com
   ```

### 2. ~~Configure Cloudflare Cache Bypass~~ ✅ **DONE**

**Status**: Cache bypass rules configured via Cloudflare API

**Rules Created** (via Page Rules API):
- ✅ `www.leoklemet.com/agent/*` → Cache Level: Bypass
- ✅ `www.leoklemet.com/chat` → Cache Level: Bypass
- ✅ `www.leoklemet.com/api/*` → Cache Level: Bypass

**Note**: Rules may take 1-2 minutes to propagate across Cloudflare's network.

### 3. ~~Purge Cloudflare Cache~~ ✅ **DONE**

**Status**: Cache purged for dynamic paths via API

### 4. Test Production Endpoints ⏳ **After DNS**

### 3. ~~Purge Cloudflare Cache~~ ✅ **DONE**

**Status**: Cache purged for dynamic paths via API

After creating cache rules:
```bash
# In Cloudflare Dashboard:
Caching → Configuration → Purge Everything
```

Or via API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 4. Test Production Endpoints

Once DNS is live and cache rules configured:

```bash
# Should return HTML
curl -I https://www.leoklemet.com/

# Should return JSON (not HTML!)
curl -s https://www.leoklemet.com/agent/dev/status

# Should set cookie
curl -i -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable

# Apex should redirect
curl -I https://leoklemet.com/
# Expected: HTTP/1.1 301 Moved Permanently
# Expected: Location: https://www.leoklemet.com/
```

### 5. Enable Dev Overlay in Browser

```bash
# Method 1: Direct API call
curl -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable

# Method 2: URL parameter
# Visit: https://www.leoklemet.com/?dev_overlay=dev

# Verify badge appears
# Navigate to any page on site - "DEV" badge should show bottom-right
```

## Troubleshooting

### Issue: Endpoints return HTML instead of JSON

**Cause**: Cloudflare is caching responses

**Fix**:
1. Verify cache rules are active
2. Purge Cloudflare cache
3. Test with cache-busting header:
   ```bash
   curl -H "Cache-Control: no-cache" https://www.leoklemet.com/agent/dev/status
   ```

### Issue: Dev overlay badge doesn't appear

**Checks**:
1. Verify cookie was set:
   ```bash
   curl -i -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable | grep -i set-cookie
   ```
2. Check browser DevTools → Application → Cookies → `sa_dev`
3. Verify frontend includes dev-overlay.ts:
   ```bash
   curl -s https://www.leoklemet.com/ | grep -i "main-"
   ```

### Issue: 502 Bad Gateway

**Checks**:
1. Verify backend is running:
   ```bash
   docker ps --filter name=ai-finance-backend-1
   ```
2. Test backend directly:
   ```bash
   docker exec applylens-nginx-prod curl -s http://ai-finance-api.int:8000/agent/dev/status
   ```
3. Check nginx logs:
   ```bash
   docker logs applylens-nginx-prod --tail 50
   ```

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare CDN                          │
│  (www.leoklemet.com / leoklemet.com → Proxied)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ DNS Resolution
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                            │
│             (applylens-cloudflared-prod)                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Nginx (applylens-nginx-prod)                  │
│  Port 80 (HTTP) - Cloudflare handles TLS termination           │
│                                                                 │
│  Routes:                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /agent/* → Backend (SSE, 3600s timeout)                 │  │
│  │ /chat    → Backend (SSE streaming)                       │  │
│  │ /api/*   → Backend (JSON API)                            │  │
│  │ /        → Portfolio Static (nginx container)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────┬─────────────────────────┬────────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Backend Container      │  │  Portfolio Container     │
│ ai-finance-backend-1     │  │     portfolio-ui         │
│ (ai-finance-api.int:8000)│  │  (portfolio.int:80)      │
│                          │  │                          │
│ • FastAPI + Uvicorn      │  │ • Nginx static server    │
│ • Dev overlay router     │  │ • Vite build output      │
│ • Chat endpoints         │  │ • Dev overlay frontend   │
│ • Agent orchestration    │  │ • Calendly integration   │
│ • RAG system             │  │ • Assistant dock         │
└──────────────────────────┘  └──────────────────────────┘
```

## Files Modified

### Backend Repository (C:\ai-finance-agent-oss-clean)
- ✅ `apps/backend/app/routers/dev_overlay.py` (created)
- ✅ `apps/backend/app/main.py` (added dev_overlay router import/include)
- ✅ `docker-compose.override.yml` (created - sets COOKIE_DOMAIN, SITE_BASE_URL)

### Portfolio Repository (D:\leo-portfolio)
- ✅ `apps/portfolio-ui/src/dev-overlay.ts` (created - 128 lines)
- ✅ `apps/portfolio-ui/src/main.ts` (added dev overlay integration)
- ✅ `apps/portfolio-ui/tests/dev-overlay.spec.ts` (updated with real endpoint test)
- ✅ `dist-portfolio/` (built with new frontend)

### Nginx Container (applylens-nginx-prod)
- ✅ `/etc/nginx/conf.d/portfolio-leoklemet.com.conf` (created)
- ✅ `/etc/nginx/conf.d/redirect-leoklemet.com.conf` (created)

## Deployment Timeline

1. **Frontend Build** (Oct 15, 14:05): Built portfolio with dev overlay integration
2. **Docker Image** (Oct 15, 14:06): Created new portfolio:latest image
3. **GHCR Push** (Oct 15, 14:06): Pushed image to GitHub Container Registry
4. **Portfolio Container** (Oct 15, 14:07): Restarted with new image
5. **Backend Router** (Oct 15, 14:17): Created dev_overlay.py in backend container
6. **Backend Restart** (Oct 15, 14:19): Loaded dev_overlay router
7. **leoklemet.com Nginx** (Oct 15, 14:50): Created nginx configurations
8. **Backend Override** (Oct 15, 14:47): Updated environment with cookie domain

## Contact

For issues or questions about this setup:
- Backend logs: `docker logs ai-finance-backend-1 --tail 100`
- Nginx logs: `docker logs applylens-nginx-prod --tail 100`
- Frontend: Check browser DevTools console

---

**Status**: ✅ Infrastructure complete, awaiting DNS configuration and Cloudflare cache rules
