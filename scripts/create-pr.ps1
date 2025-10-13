#!/usr/bin/env pwsh
# PR Preparation Script for Portfolio Admin Gating
# Generated: October 13, 2025

Write-Host "🚀 Preparing PR: Portfolio Admin Gating + SEO + CSP" -ForegroundColor Cyan
Write-Host ""

# Step 1: Push to GitHub
Write-Host "📤 Step 1: Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin chore/portfolio-sweep

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Prepare PR body
$PR_BODY = @"
### Summary
- **Admin Gating**: Role-aware admin controls for assistant panel (+ dev override via ``?admin=1``, disabled in prod)
- **nginx**: Proxies ``/api/*`` with cookies; SSE endpoints with no buffering
- **SEO**: JSON-LD Person schema + OG/Twitter meta pointing to ``og.png``
- **CSP**: Build-time nonces for all scripts; dev-aware CSP tests (run only in CI)
- **Tests**: Admin panel visibility, SEO, streaming chat, resume endpoints

### Key Features

#### 🔐 Admin Gating (Layered Security)
- **Dev Override**: ``?admin=1`` (localStorage) - works only when ``VITE_ALLOW_DEV_ADMIN=1``
- **Role-Based Auth**: ``/api/auth/me`` validates admin/owner roles
- **Server-Side Enforcement**: Backend guards all admin endpoints
- **10s Cache**: Reduces auth checks, improves performance
- **Production Safe**: Dev override disabled in production builds

#### 🔒 Security Model
1. **Layer 1**: Dev override (local dev only, env-gated)
2. **Layer 2**: Role check (prod or dev, backend validation)
3. **Layer 3**: Server-side enforcement (all admin endpoints protected)

#### 🎨 UI/UX
- Admin controls hidden by default
- Green "admin" badge when enabled
- Tooltips: "Admin only: Autotune layout"
- Window focus detection (live auth updates)

#### 🧪 Testing
- **4 E2E tests**: Hidden by default, visible with override, disable, styling
- **CSP tests**: Dev-aware (CI-gated)
- **SEO tests**: JSON-LD, OG image, resume endpoints

### Files Changed

**Core Implementation** (885 lines):
- ``apps/portfolio-ui/src/admin.ts`` - Admin gate logic (91 lines)
- ``apps/portfolio-ui/src/main.ts`` - Boot initialization (25 lines)
- ``apps/portfolio-ui/src/assistant.main.tsx`` - UI integration (331 lines)
- ``apps/portfolio-ui/.env.development`` - Dev config (VITE_ALLOW_DEV_ADMIN=1)
- ``apps/portfolio-ui/.env.production`` - Prod config (VITE_ALLOW_DEV_ADMIN=0)
- ``apps/portfolio-ui/portfolio.css`` - Admin badge styling
- ``deploy/nginx.portfolio.conf`` - Cookie forwarding, /api/ proxy
- ``tests/e2e/admin.panel.spec.ts`` - E2E tests (113 lines)

**Documentation**:
- ``docs/ADMIN_CONTROLS.md`` - Comprehensive admin guide
- ``docs/DEPLOYMENT_VERIFICATION.md`` - Verification playbook

### Usage

**Development**:
````bash
# Enable admin mode (persists)
http://127.0.0.1:5174/?admin=1

# Disable admin mode
http://127.0.0.1:5174/?admin=0

# Run admin tests
pnpm run e2e:portfolio -- tests/e2e/admin.panel.spec.ts
````

**Production**:
- Requires authenticated admin user (role-based)
- Dev override disabled (``VITE_ALLOW_DEV_ADMIN=0``)
- Backend enforces auth on all admin endpoints

### Checklist

**Pre-Merge**:
- [ ] All E2E tests passing (local + CI)
- [ ] Admin controls hidden for signed-out users
- [ ] Admin controls visible with ``?admin=1`` in dev
- [ ] Dev override disabled in production build
- [ ] CSP tests passing in CI
- [ ] No CSP violations in browser console

**Post-Deploy (Staging)**:
- [ ] ``/api/auth/me`` returns admin roles for authorized users
- [ ] Admin UI appears for authenticated admins
- [ ] Admin UI hidden for normal visitors
- [ ] Dev override (``?admin=1``) does NOT work in staging
- [ ] Admin endpoints return 401/403 without auth
- [ ] Admin endpoints return 200 with admin auth
- [ ] SSE endpoints streaming correctly
- [ ] Resume endpoints accessible

**Post-Deploy (Production)**:
- [ ] All staging checks passing
- [ ] Performance metrics acceptable
- [ ] No errors in production logs
- [ ] Admin actions working (autotune, reset)

### Security Notes

⚠️ **Critical**: Backend MUST enforce auth on:
- ``POST /api/layout/autotune``
- ``POST /api/layout/reset``

Frontend checks are defense-in-depth only. Never trust client-side validation.

### Documentation

- **Admin Guide**: ``docs/ADMIN_CONTROLS.md``
- **Deployment**: ``docs/DEPLOYMENT_VERIFICATION.md``
- **Architecture**: ``docs/ARCHITECTURE.md``
- **API Reference**: ``docs/API.md``

### Related Issues

Closes #[issue-number] (if applicable)
Refs: User request for admin gating system

### Screenshots

(Add screenshots of admin UI in dev vs prod)

---

**Reviewer Notes**:
- Focus on backend auth guards (most critical)
- Verify ``VITE_ALLOW_DEV_ADMIN=0`` in production builds
- Check nginx Cookie forwarding config
- Validate E2E test coverage
"@

# Step 3: Create PR (if gh CLI available)
Write-Host "📝 Step 2: Creating PR..." -ForegroundColor Yellow

$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if ($ghInstalled) {
    # Save PR body to temp file
    $tempFile = [System.IO.Path]::GetTempFileName()
    $PR_BODY | Out-File -FilePath $tempFile -Encoding UTF8

    # Create PR
    gh pr create `
        --title "Portfolio: admin-gated controls (dev override + role auth), SEO & CSP tests, OG image" `
        --body-file $tempFile `
        --base main

    Remove-Item $tempFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PR created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️ PR creation failed. Create manually with body below:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host $PR_BODY -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️ GitHub CLI not installed. Create PR manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Title:" -ForegroundColor Cyan
    Write-Host "Portfolio: admin-gated controls (dev override + role auth), SEO & CSP tests, OG image" -ForegroundColor White
    Write-Host ""
    Write-Host "Body:" -ForegroundColor Cyan
    Write-Host $PR_BODY -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or install GitHub CLI:" -ForegroundColor Yellow
    Write-Host "  winget install GitHub.cli" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ PR preparation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review PR on GitHub" -ForegroundColor White
Write-Host "  2. Wait for CI to pass" -ForegroundColor White
Write-Host "  3. Merge to main" -ForegroundColor White
Write-Host "  4. Deploy to staging" -ForegroundColor White
Write-Host "  5. Run verification playbook (docs/DEPLOYMENT_VERIFICATION.md)" -ForegroundColor White
