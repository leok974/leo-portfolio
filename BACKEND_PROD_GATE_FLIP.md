# Backend Production Gate - Enabled

## Summary

✅ **Production `/api/*` gate is now ENABLED**

The `VITE_BACKEND_ENABLED=1` flag enables frontend to make API calls through nginx same-origin proxy.

---

## Configuration Changes

### 1. Frontend Flag (Committed)

**File:** `apps/portfolio-ui/.env.production`

```bash
# Backend API availability - enable in prod when backend is deployed
VITE_BACKEND_ENABLED=1
```

**Effect:**
- Enables `/api/layout`, `/api/auth/me`, and other backend endpoints
- Frontend will attempt to fetch dynamic layout and auth status
- Requires backend to be running and accessible

---

### 2. CORS Allowlist (Backend Configuration Required)

**Backend must have these origins in `ALLOWED_ORIGINS`:**

```bash
# Production
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://www.leoklemet.com

# Development (if testing locally)
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://www.leoklemet.com,http://localhost:8090,http://127.0.0.1:8090
```

**Where to set:**
- Docker compose `.env` file: `assistant_api/.env.prod`
- Or environment variable: `docker compose exec backend printenv ALLOWED_ORIGINS`
- Or systemd service file if running via systemd

---

### 3. Nginx Configuration (Already Configured)

**File:** `deploy/nginx.portfolio.conf`

```nginx
# API proxy - same-origin (no CORS headers needed from nginx)
location /api/ {
  proxy_pass https://assistant.ledger-mind.org/api/;
  proxy_http_version 1.1;
  proxy_set_header Host assistant.ledger-mind.org;
  proxy_ssl_server_name on;
  proxy_set_header Cookie $http_cookie;  # Pass auth cookies
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

✅ **Already configured** - no changes needed

---

## Verification Steps

### 1. Check Backend is Running

```bash
# SSH to production server
curl http://127.0.0.1:8001/api/ready
# Should return: {"status": "ok", "timestamp": "..."}
```

### 2. Verify CORS Origins

```bash
# Check backend environment
docker compose exec backend printenv ALLOWED_ORIGINS
# Should include: https://assistant.ledger-mind.org

# Or check via API
curl https://assistant.ledger-mind.org/status/cors | jq '.allowed_origins'
```

### 3. Test Frontend API Call

```bash
# From browser console at https://assistant.ledger-mind.org:
fetch('/api/ready')
  .then(r => r.json())
  .then(console.log)
# Should return: {status: "ok", timestamp: "..."}
```

### 4. Check for 502 Errors

```bash
# Monitor nginx logs
tail -f /var/log/nginx/assistant-error.log

# If you see 502 errors on /api/*, backend is down or unreachable
```

---

## Rollback Plan

If backend is not ready or causing issues:

### Quick Disable (Frontend Only)

**File:** `apps/portfolio-ui/.env.production`

```bash
VITE_BACKEND_ENABLED=0
```

Then rebuild and redeploy:
```bash
npm run build:portfolio
# Copy dist-portfolio/* to production server
```

### Temporary Nginx Bypass

If backend is down but you need site up:

```nginx
# Comment out /api/ proxy in nginx.portfolio.conf
# location /api/ {
#   return 503;  # Service unavailable
# }
```

Then reload nginx:
```bash
nginx -t && nginx -s reload
```

---

## Security Notes

### CORS Allowlist is Tight ✅

Backend `ALLOWED_ORIGINS` **must not include** wildcards (`*`) in production.

**Good:**
```bash
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://www.leoklemet.com
```

**Bad:**
```bash
ALLOWED_ORIGINS=*  # DO NOT USE - allows any origin!
ALLOWED_ORIGINS=https://*.leoklemet.com  # DO NOT USE - wildcard subdomain
```

### Cookie Security ✅

Admin auth cookies are:
- `HttpOnly` (not accessible via JavaScript)
- `Secure` (HTTPS only in production)
- `SameSite=Lax` (CSRF protection)
- HMAC-signed (tamper-proof)

### Rate Limiting

Consider adding rate limiting at nginx level:

```nginx
limit_req_zone $binary_remote_addr zone=api_rl:10m rate=30r/m;

location /api/ {
  limit_req zone=api_rl burst=5 nodelay;
  # ... proxy config
}
```

---

## Next Steps

1. **Verify backend is running** on production server
2. **Confirm ALLOWED_ORIGINS** includes `https://assistant.ledger-mind.org`
3. **Build and deploy** frontend with `VITE_BACKEND_ENABLED=1`
4. **Monitor logs** for any 502 or CORS errors
5. **Test admin auth** flow if using protected endpoints

---

## Related Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Backend Admin Auth](docs/BACKEND_ADMIN_AUTH.md)
- [Security & CORS](docs/SECURITY.md)
- [Backend Quick Start](docs/BACKEND_QUICKSTART.md)

---

**Status:** ✅ **READY FOR DEPLOYMENT**

Date: October 20, 2025
