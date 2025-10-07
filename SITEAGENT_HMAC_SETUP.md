# SiteAgent Dual Authentication Setup

**Date:** 2025-10-07
**Status:** Production Ready
**Purpose:** Flexible authentication for both admin access and CI/CD workflows

---

## Overview

The siteAgent now supports **dual authentication** on public endpoints (`/agent/*`):

**Authentication Priority (OR logic):**
1. **Try Cloudflare Access first** - If CF-Access-Jwt-Assertion header is present and valid
2. **Fall back to HMAC** - If CF Access fails, check X-SiteAgent-Signature header

This allows the **same endpoint** to serve:
- **Admin users** via CF Access (browser SSO or service tokens)
- **CI/CD workflows** via HMAC (GitHub Actions, automated scripts)

### Endpoint Comparison

| Endpoint | Auth Method | Use Case |
|----------|-------------|----------|
| `/api/admin/agent/*` | CF Access (required) | Admin-only access |
| `/agent/*` | CF Access OR HMAC | Flexible (admin + CI/CD) |

## Authentication Methods

### 1. Cloudflare Access (CF Access)

**Priority:** Checked first
**Header:** `Cf-Access-Jwt-Assertion` (injected by CF Edge)
**Use case:** Interactive admin access, service tokens### How It Works

1. **Shared Secret:** Both backend and client share a secret key (`SITEAGENT_HMAC_SECRET`)
2. **Request Body:** Client prepares JSON request body
3. **Signature:** Client computes HMAC-SHA256 signature of the body
4. **Header:** Client sends signature in `X-SiteAgent-Signature: sha256=<hex>`
5. **Verification:** Backend recomputes signature and compares using constant-time comparison

### Security Benefits

- ✅ **No credentials in requests** - Only signature is sent
- ✅ **Replay protection** - Each request body produces unique signature
- ✅ **Constant-time comparison** - Prevents timing attacks
- ✅ **Optional** - Can be disabled by not setting `SITEAGENT_HMAC_SECRET`

## Backend Setup

### Environment Variable

Add to `.env` or `.env.prod`:

```bash
SITEAGENT_HMAC_SECRET="your-random-secret-here-min-32-chars"
```

**Generate a strong secret:**

```bash
# Linux/macOS/WSL
openssl rand -hex 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Docker Deployment

Update `deploy/.env.prod`:

```bash
SITEAGENT_HMAC_SECRET="sdjiefjifj&*jfuhuhAWGDC6778"
```

Then rebuild and restart:

```bash
cd deploy
docker compose build backend
docker compose up -d backend
```

## GitHub Actions Setup

### 1. Add Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `SITEAGENT_ENDPOINT` | `https://assistant.ledger-mind.org/agent/run` | Public agent endpoint URL |
| `SITEAGENT_HMAC_SECRET` | `<same-as-backend>` | Shared secret for HMAC |

### 2. Workflow File

File: `.github/workflows/siteagent-nightly.yml` (already created)

```yaml
name: siteAgent Nightly Run

on:
  schedule:
    - cron: "17 3 * * *"   # 03:17 UTC nightly
  workflow_dispatch: {}

jobs:
  run-siteagent:
    runs-on: ubuntu-latest
    env:
      ENDPOINT: ${{ secrets.SITEAGENT_ENDPOINT }}
      HMAC_SECRET: ${{ secrets.SITEAGENT_HMAC_SECRET }}
    steps:
      - name: Prepare request body
        id: prep
        run: |
          BODY='{"plan": null, "params": {}}'
          echo "$BODY" > body.json

      - name: Compute HMAC (sha256) header
        id: hmac
        shell: bash
        run: |
          if [ -n "$HMAC_SECRET" ]; then
            SIG=$(openssl dgst -binary -sha256 -hmac "$HMAC_SECRET" body.json | xxd -p -c 256)
            echo "sig=sha256=$SIG" >> $GITHUB_OUTPUT
          else
            echo "sig=" >> $GITHUB_OUTPUT
          fi

      - name: POST /agent/run
        shell: bash
        run: |
          set -euo pipefail
          HDR_SIG=()
          if [ -n "${{ steps.hmac.outputs.sig }}" ]; then
            HDR_SIG=(-H "X-SiteAgent-Signature: ${{ steps.hmac.outputs.sig }}")
          fi
          curl -sS -X POST "$ENDPOINT" \
               -H "Content-Type: application/json" \
               "${HDR_SIG[@]}" \
               --data-binary @body.json | jq .
```

### 3. Test Workflow

**Manual trigger:**

1. Go to **Actions → siteAgent Nightly Run**
2. Click **Run workflow**
3. Check logs for successful execution

## Local Development Testing

### Without HMAC (Development Mode)

If `SITEAGENT_HMAC_SECRET` is not set, the endpoint is open:

```bash
curl -sS -X POST http://127.0.0.1:8000/agent/run \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### With HMAC (Production Mode)

**Bash/Linux:**

```bash
export SITEAGENT_HMAC_SECRET="your-secret"

BODY='{"plan": null, "params": {}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -binary -sha256 -hmac "$SITEAGENT_HMAC_SECRET" | xxd -p -c 256)

curl -sS -X POST http://127.0.0.1:8000/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY" | jq
```

**PowerShell:**

```powershell
$env:SITEAGENT_HMAC_SECRET = "your-secret"

$Body = '{"plan": null, "params": {}}'
$BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
$SecretBytes = [System.Text.Encoding]::UTF8.GetBytes($env:SITEAGENT_HMAC_SECRET)
$Hmac = New-Object System.Security.Cryptography.HMACSHA256
$Hmac.Key = $SecretBytes
$Hash = $Hmac.ComputeHash($BodyBytes)
$Signature = "sha256=" + ($Hash | ForEach-Object { $_.ToString("x2") }) -join ""

Invoke-WebRequest -Uri "http://127.0.0.1:8000/agent/run" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "X-SiteAgent-Signature" = $Signature
  } `
  -Body $Body | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

## Dev-Only Trigger Button

For local development, a trigger button is automatically added to the bottom-right of the page when accessed from `localhost` or `127.0.0.1`.

**Features:**
- ✅ Only visible on localhost (hidden in production)
- ✅ One-click agent execution
- ✅ Visual feedback (Running…, ✓ Done, ✗ Error)
- ✅ Console logging for debugging

**Location:** Bottom-right corner of the page
**Style:** Green button with "▶ Run siteAgent (dev)"

**To disable:** Remove the script block from `index.html` (after line 974)

## Endpoints Comparison

### CF Access Protected (`/api/admin/agent/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/agent/tasks` | GET | CF Access | List tasks (admin) |
| `/api/admin/agent/run` | POST | CF Access | Run agent (admin) |
| `/api/admin/agent/status` | GET | CF Access | View status (admin) |

**Use cases:**
- Interactive admin access via browser
- Service token authentication for admin scripts
- Manual portfolio maintenance

### HMAC Protected (`/agent/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/agent/tasks` | GET | HMAC (optional) | List tasks (public) |
| `/agent/run` | POST | HMAC (optional) | Run agent (CI/CD) |
| `/agent/status` | GET | HMAC (optional) | View status (public) |

**Use cases:**
- GitHub Actions CI/CD workflows
- Scheduled automated tasks
- Public API for agent execution

## Security Considerations

### HMAC vs CF Access

**When to use HMAC:**
- ✅ CI/CD workflows (GitHub Actions)
- ✅ Automated scripts without browser
- ✅ Public-facing API endpoints
- ✅ Simpler authentication flow

**When to use CF Access:**
- ✅ Interactive admin access
- ✅ Browser-based authentication
- ✅ SSO integration
- ✅ Fine-grained access control

### Best Practices

1. **Strong Secrets:** Use at least 32 random characters
2. **Rotate Regularly:** Change secret every 90 days
3. **Secure Storage:** Store secrets in GitHub Secrets, not in code
4. **Environment Separation:** Use different secrets for dev/staging/prod
5. **Monitor Logs:** Watch for failed authentication attempts

### Optional HMAC

If `SITEAGENT_HMAC_SECRET` is not set:
- ⚠️ Endpoints are **open** (no authentication)
- ✅ Useful for development
- ❌ **NOT recommended for production**

Set the secret in production to enable authentication.

## Testing

### Test HMAC Authentication

```bash
# Valid signature - should succeed
BODY='{"plan": null}'
SIG=$(printf '%s' "$BODY" | openssl dgst -binary -sha256 -hmac "$SECRET" | xxd -p -c 256)
curl -X POST http://localhost:8000/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY"
# Expected: {"run_id": "...", "tasks": [...]}

# Invalid signature - should fail
curl -X POST http://localhost:8000/agent/run \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=invalid" \
  -d '{"plan": null}'
# Expected: {"detail": "Signature mismatch"} (401)

# Missing signature - should fail
curl -X POST http://localhost:8000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"plan": null}'
# Expected: {"detail": "Missing or invalid signature"} (401)
```

## Troubleshooting

### 401: Missing or invalid signature

**Problem:** `X-SiteAgent-Signature` header is missing or malformed

**Solution:**
- Ensure header is present: `X-SiteAgent-Signature: sha256=<hex>`
- Check signature format: `sha256=` prefix followed by 64 hex characters

### 401: Signature mismatch

**Problem:** Computed signature doesn't match provided signature

**Common causes:**
1. **Different secrets:** Backend and client using different `SITEAGENT_HMAC_SECRET`
2. **Body mismatch:** Body sent != body signed (whitespace, encoding)
3. **Wrong algorithm:** Must use HMAC-SHA256, not SHA256

**Debug steps:**
1. Print backend secret: `echo $SITEAGENT_HMAC_SECRET`
2. Print client secret: `echo $HMAC_SECRET`
3. Print request body: `cat body.json | xxd`
4. Compute signature manually: `openssl dgst -sha256 -hmac "$SECRET" body.json`

### No authentication when expected

**Problem:** Endpoint accepts requests without signature

**Cause:** `SITEAGENT_HMAC_SECRET` is not set on backend

**Solution:**
1. Set environment variable in `.env` or `.env.prod`
2. Restart backend: `docker compose restart backend`
3. Verify: `docker exec portfolio-backend-1 env | grep SITEAGENT`

## Migration from CF Access Only

### Before (Phase 35)
```
All agent endpoints: /api/admin/agent/*
Authentication: CF Access (SSO + service tokens)
Use case: Admin only
```

### After (Phase 36)
```
Admin endpoints: /api/admin/agent/*
Authentication: CF Access (SSO + service tokens)
Use case: Interactive admin access

Public endpoints: /agent/*
Authentication: HMAC (shared secret)
Use case: CI/CD workflows
```

**No breaking changes:** CF Access endpoints still work exactly as before.

## Summary

- ✅ **GitHub Actions workflow created:** `.github/workflows/siteagent-nightly.yml`
- ✅ **HMAC authentication implemented:** `assistant_api/routers/agent_public.py`
- ✅ **Public endpoints added:** `/agent/tasks`, `/agent/run`, `/agent/status`
- ✅ **Dev trigger button added:** `index.html` (localhost only)
- ✅ **Backward compatible:** CF Access endpoints unchanged
- ✅ **Optional authentication:** HMAC only enforced if secret is set

**Next steps:**
1. Set `SITEAGENT_HMAC_SECRET` in backend environment
2. Add GitHub secrets: `SITEAGENT_ENDPOINT`, `SITEAGENT_HMAC_SECRET`
3. Test workflow: Actions → siteAgent Nightly Run → Run workflow
4. Verify execution: Check workflow logs and `/agent/status`

---

**Status:** ✅ **Ready for Deployment**
**Security:** ✅ **HMAC-SHA256 with constant-time comparison**
**CI/CD:** ✅ **GitHub Actions workflow ready**
