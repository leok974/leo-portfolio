# Staging Deployment Guide - Admin Authentication

**Date**: October 13, 2025
**Branch**: `chore/portfolio-sweep`
**Commits**: 7 (281e48c → bb31888)

---

## 🚀 Quick Start (5 minutes)

### 1. Generate Secrets

```bash
# Generate HMAC secret (STAGING - different from production!)
python3 -c "import secrets; print('STAGING_SECRET:', secrets.token_urlsafe(32))"

# Save the output - you'll need it for step 2
```

### 2. Set Environment Variables

**Option A: Docker Compose**
```yaml
# docker-compose.staging.yml
services:
  backend:
    environment:
      - ADMIN_HMAC_SECRET=${ADMIN_HMAC_SECRET}
      - ADMIN_EMAILS=leoklemet.pa@gmail.com
      - COOKIE_DOMAIN=.ledger-mind.org
```

**Option B: Kubernetes Secret**
```bash
kubectl create secret generic admin-auth-staging \
  --from-literal=ADMIN_HMAC_SECRET='<your_generated_secret>' \
  --namespace=staging
```

**Option C: Environment File**
```bash
# /etc/systemd/system/portfolio-backend.service.d/override.conf
[Service]
Environment="ADMIN_HMAC_SECRET=<your_generated_secret>"
Environment="ADMIN_EMAILS=leoklemet.pa@gmail.com"
Environment="COOKIE_DOMAIN=.ledger-mind.org"
```

### 3. Deploy Backend

```bash
# Pull latest code
git checkout chore/portfolio-sweep
git pull origin chore/portfolio-sweep

# Install dependencies (if needed)
pip install -r assistant_api/requirements.txt

# Restart service
sudo systemctl restart portfolio-backend
# OR
docker-compose up -d --build backend
# OR
kubectl rollout restart deployment/portfolio-backend -n staging
```

### 4. Verify Deployment

**Quick Smoke Test (30 seconds)**

```bash
# Bash/Linux/Mac
SITE="https://api-staging.ledger-mind.org" \
ADMIN_EMAIL="leoklemet.pa@gmail.com" \
bash scripts/smoke-admin-prod.sh
```

```powershell
# PowerShell/Windows
$env:SITE = "https://api-staging.ledger-mind.org"
$env:ADMIN_EMAIL = "leoklemet.pa@gmail.com"
.\scripts\smoke-admin-prod.ps1
```

Expected output:
```
== Admin login ==
✓ Cookie extracted: eyJlbWFpbCI6Imxlb2tsZW1ldC5wYUBnbWFpbC5jb20i...
== /api/auth/me ==
{"user":{"email":"leoklemet.pa@gmail.com","is_admin":true,"roles":["admin"]},...}
== Protected endpoints (should be 200) ==
200
200
== Protected without cookie (should be 401/403) ==
401
✅ Smoke complete
```

**Manual Verification** (if smoke test not available)

```bash
# Check backend health
curl -s https://api-staging.ledger-mind.org/ready | jq

# Test auth endpoints
curl -i -X POST "https://api-staging.ledger-mind.org/api/auth/admin/login?email=leoklemet.pa@gmail.com"

# Should return 200 with Set-Cookie header
```

### 5. Test Frontend Integration

1. Open browser to `https://assistant-staging.ledger-mind.org`
2. Open DevTools → Network tab
3. In URL bar, add `?admin=1` (dev override if enabled)
4. Or: Login via backend:
   ```bash
   # Get cookie
   curl -i -X POST "https://api-staging.ledger-mind.org/api/auth/admin/login?email=leoklemet.pa@gmail.com"

   # Copy Set-Cookie header value
   # Paste into browser DevTools → Application → Cookies → Add cookie
   ```
5. Refresh page - admin badge should appear
6. Click admin controls (reset, autotune) - should work

---

## 🧪 Staging Verification Checklist

### Backend Tests
- [ ] `/ready` endpoint returns 200
- [ ] `/api/auth/admin/login` returns 200 with Set-Cookie
- [ ] `/api/auth/me` returns correct structure (with cookie)
- [ ] `/api/auth/me` returns `is_admin: false` (without cookie)
- [ ] `/api/layout/reset` returns 401 without cookie
- [ ] `/api/layout/reset` returns 200 with valid cookie

### Frontend Tests
- [ ] Page loads without errors
- [ ] Admin badge appears after login
- [ ] Admin controls visible (reset, autotune buttons)
- [ ] Admin controls work (no console errors)
- [ ] Logout works (badge disappears)

### E2E Tests (Run from Dev Machine)
```bash
# Point tests at staging
export PW_SITE="https://assistant-staging.ledger-mind.org"
export ADMIN_TEST_EMAIL="leoklemet.pa@gmail.com"

pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

Expected: **5/5 tests passing**

---

## 🔍 Troubleshooting

### Issue 1: 401 on /api/auth/me (with cookie)
**Cause**: HMAC secret mismatch or expired token
**Fix**:
```bash
# Check environment variable is set
printenv ADMIN_HMAC_SECRET

# Restart backend to load new secret
sudo systemctl restart portfolio-backend
```

### Issue 2: Cookie not sent from frontend
**Cause**: CORS credentials not allowed
**Fix**: Verify CORS config in `assistant_api/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://assistant-staging.ledger-mind.org"],
    allow_credentials=True,  # REQUIRED
    allow_methods=["*"],
    allow_headers=["*"]
)
```

### Issue 3: Admin badge doesn't appear
**Cause**: Frontend can't reach backend or auth response format wrong
**Debug**:
```bash
# Check frontend → backend communication
curl -s https://api-staging.ledger-mind.org/api/auth/me \
  -H "Cookie: admin_auth=<cookie_value>" | jq

# Expected structure:
{
  "user": {
    "email": "leoklemet.pa@gmail.com",
    "is_admin": true,
    "roles": ["admin"]
  },
  "roles": ["admin"],
  "is_admin": true
}
```

### Issue 4: 403 on protected endpoints
**Cause**: Cookie valid but email not in ADMIN_EMAILS list
**Fix**:
```bash
# Check ADMIN_EMAILS environment variable
printenv ADMIN_EMAILS

# Should be: leoklemet.pa@gmail.com
```

### Issue 5: Instant cookie expiration
**Cause**: Clock skew between frontend and backend
**Solution**: Already handled! Backend has 5-minute tolerance.
**If still failing**: Check server time is synchronized (NTP)

---

## 📊 Monitoring

### Logs to Watch
```bash
# Backend logs (look for auth-related errors)
journalctl -u portfolio-backend -f | grep -i "auth\|admin\|cookie"

# Or for Docker
docker logs -f portfolio-backend | grep -i "auth\|admin\|cookie"

# Expected log lines:
# INFO: 127.0.0.1:12345 - "POST /api/auth/admin/login?email=..." 200 OK
# INFO: 127.0.0.1:12345 - "GET /api/auth/me HTTP/1.1" 200 OK
```

### Metrics to Track (if available)
- Auth endpoint response times (< 100ms typical)
- Login success rate (100% for valid emails)
- 401/403 error rates (should be low)

---

## 🔒 Security Notes

### Staging vs Production Secrets
- **NEVER** use the same HMAC secret in staging and production
- Generate separate secrets for each environment
- Store secrets in secure secret manager (not in git!)

### Cookie Domain
- **Staging**: `COOKIE_DOMAIN=.ledger-mind.org` or `.staging.ledger-mind.org`
- **Production**: `COOKIE_DOMAIN=.ledger-mind.org`
- **Local Dev**: No COOKIE_DOMAIN (unset)

### Email Allowlist
- Staging can use test emails: `test@example.com,admin@staging.local`
- Production should use only real admin emails

---

## 📞 Rollback Plan

If something goes wrong:

```bash
# Quick rollback to previous version
git checkout main
git pull origin main

# Restart backend
sudo systemctl restart portfolio-backend

# Frontend: admin features gracefully degrade (no errors)
```

The frontend is designed to work without the backend auth system, so rollback is safe.

---

## ✅ Success Criteria

Deployment is successful when:

- [x] Backend starts without errors
- [x] `/ready` endpoint returns 200
- [x] Login flow works (cookie issued)
- [x] `/api/auth/me` returns correct structure
- [x] Admin badge appears in frontend
- [x] Protected endpoints return 401 without auth
- [x] Protected endpoints return 200 with auth
- [x] E2E tests pass (5/5)
- [x] No console errors in browser
- [x] Logs show successful auth events

---

## 📅 Next Steps After Staging

1. **Monitor for 24-48 hours**
   - Check logs for unexpected errors
   - Verify auth metrics look normal
   - Test from different browsers/devices

2. **Production Deployment**
   - Generate NEW HMAC secret for production
   - Follow same deployment process
   - Run verification checklist
   - Monitor closely for first hour

3. **Post-Production Tasks**
   - Set up secret rotation schedule (quarterly)
   - Add monitoring/alerting for auth failures
   - Document any production-specific issues
   - Consider rate limiting implementation

---

**Questions?** See `docs/BACKEND_QUICKSTART.md` for detailed troubleshooting.

**Status**: Ready for staging deployment ✅
