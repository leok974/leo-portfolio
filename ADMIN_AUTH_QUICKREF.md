# Admin Authentication - Quick Reference

**Status**: ✅ Complete (Backend + Frontend + E2E Tests)

---

## 🚀 Quick Smoke Test

### Production/Staging Verification (30 seconds)

**Bash/Linux/Mac**:
```bash
SITE="https://assistant.ledger-mind.org" \
ADMIN_EMAIL="leoklemet.pa@gmail.com" \
bash scripts/smoke-admin-prod.sh
```

**PowerShell/Windows**:
```powershell
$env:SITE = "https://assistant.ledger-mind.org"
$env:ADMIN_EMAIL = "leoklemet.pa@gmail.com"
.\scripts\smoke-admin-prod.ps1
```

**Expected Output**:
```
== Admin login ==
✓ Cookie extracted: eyJlbWFpbCI6...
== /api/auth/me ==
{"user":{"email":"leoklemet.pa@gmail.com","is_admin":true},...}
== Protected endpoints (should be 200) ==
200
200
== Protected without cookie (should be 401/403) ==
401
✅ Smoke complete
```

---

## 📚 Documentation

### Implementation Guides
- **[BACKEND_QUICKSTART.md](docs/BACKEND_QUICKSTART.md)** - 15-minute implementation (734 lines)
- **[BACKEND_ADMIN_AUTH.md](docs/BACKEND_ADMIN_AUTH.md)** - Architecture & security
- **[STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md)** - Deployment checklist

### Summary Documents
- **[BACKEND_IMPLEMENTATION_COMPLETE.md](BACKEND_IMPLEMENTATION_COMPLETE.md)** - Full summary
- **[PR_DESCRIPTION_ADMIN_AUTH.md](PR_DESCRIPTION_ADMIN_AUTH.md)** - PR description

---

## 🔑 Environment Variables

### Local Development
```bash
export ADMIN_HMAC_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
export ADMIN_EMAILS="leoklemet.pa@gmail.com"
unset COOKIE_DOMAIN  # local dev doesn't need domain
```

### Production/Staging
```bash
# Generate unique secret for each environment
export ADMIN_HMAC_SECRET="<32+ byte secure random string>"
export ADMIN_EMAILS="leoklemet.pa@gmail.com"
export COOKIE_DOMAIN=".ledger-mind.org"
```

---

## 🧪 Testing

### Unit Tests (Python)
```bash
python test_auth.py        # Auth endpoints (4 tests)
python test_layout.py      # Protected endpoints (4 tests)
```

### E2E Tests (Playwright)
```bash
# Local (with backend running on :8001)
PW_APP=portfolio ADMIN_TEST_EMAIL=leoklemet.pa@gmail.com \
  pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium

# Against staging/production
PW_SITE="https://assistant.ledger-mind.org" \
ADMIN_TEST_EMAIL="leoklemet.pa@gmail.com" \
  pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

**Expected**: 5/5 tests passing

### Frontend Only (No Backend)
```bash
PW_APP=portfolio \
  pnpm exec playwright test tests/e2e/admin.panel.spec.ts --project=chromium
```

**Expected**: 4/4 tests passing

---

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/admin/login?email={email}` - Issue HMAC-signed cookie
- `GET /api/auth/me` - Check authentication status
- `POST /api/auth/admin/logout` - Clear admin cookie

### Protected (Require Admin)
- `POST /api/layout/reset` - Reset layout configuration
- `POST /api/layout/autotune` - Autotune layout parameters

Add `require_admin` dependency to protect any endpoint:
```python
from assistant_api.auth_admin import require_admin
from fastapi import Depends

@app.post("/api/my/endpoint")
def my_endpoint(_admin: dict = Depends(require_admin)):
    return {"ok": True}
```

---

## 🎯 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/portfolio.yml` includes automatic admin E2E testing against staging after each deploy (if `ADMIN_HMAC_SECRET` is configured in GitHub secrets):

```yaml
jobs:
  e2e-admin-staging:
    if: ${{ secrets.ADMIN_HMAC_SECRET != '' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - name: Admin auth E2E (staging)
        env:
          PW_SITE: https://assistant.ledger-mind.org
          ADMIN_TEST_EMAIL: leoklemet.pa@gmail.com
        run: pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

This ensures the backend stays wired and admin authentication continues working after deployments.

---

## 🛠️ Troubleshooting

### Cookie not sent from frontend
**Cause**: CORS credentials not allowed  
**Fix**: Verify `allow_credentials=True` in CORS middleware

### 401 on /api/auth/me (with cookie)
**Cause**: HMAC secret mismatch or expired token  
**Fix**: Check `ADMIN_HMAC_SECRET` env var and restart backend

### Admin badge doesn't appear
**Cause**: Frontend can't reach backend or response format wrong  
**Debug**:
```bash
curl -s https://api.ledger-mind.org/api/auth/me \
  -H "Cookie: admin_auth=<cookie_value>" | jq

# Should return:
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

### 403 on protected endpoints
**Cause**: Cookie valid but email not in ADMIN_EMAILS  
**Fix**: Check `ADMIN_EMAILS` env var includes the email

See **[STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md)** for full troubleshooting section.

---

## 📊 Test Results

```
✅ Backend Unit Tests: 8/8 passing
✅ E2E Tests: 5/5 passing (3.9s)
✅ Frontend Tests: 4/4 passing
✅ Smoke Tests: Production-ready scripts
✅ CI Integration: Automated staging verification
```

---

## 🔐 Security

### Features
- HMAC-SHA256 signed cookies (constant-time validation)
- HttpOnly cookies (XSS protection)
- 5-minute clock skew tolerance
- Smart cookie config (dev vs prod)
- Email normalization (lowercase + trim)

### Best Practices
- ✅ Different secrets for dev/staging/prod
- ✅ Secure cookie attributes in production
- ✅ 401/403 error separation
- ✅ Regular secret rotation (quarterly recommended)

---

## 📞 Support

- **Implementation**: [docs/BACKEND_QUICKSTART.md](docs/BACKEND_QUICKSTART.md)
- **Architecture**: [docs/BACKEND_ADMIN_AUTH.md](docs/BACKEND_ADMIN_AUTH.md)
- **Deployment**: [STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md)
- **Smoke Test**: `scripts/smoke-admin-prod.{sh,ps1}`

---

**Last Updated**: October 13, 2025  
**Version**: 1.0.0  
**Status**: Production-ready ✅
