# Cloudflare Access - Quick Commands

## First Time Setup

```powershell
# 1. Install cloudflared (choose one)
choco install cloudflared              # Chocolatey
winget install cloudflare.cloudflared  # winget

# 2. Authenticate
.\cf-access-login.ps1

# 3. Verify setup
.\verify-cf-access.ps1

# 4. Start backend
.\start-backend.ps1
```

## Daily Development

```powershell
# Start backend (loads .env automatically)
.\start-backend.ps1

# Or manually
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

## Testing

### User SSO (Interactive)

```powershell
# Get token
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# Test whoami (quick smoke test - returns your email)
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"principal":"leoklemet.pa@gmail.com"}

# Test JWT verification
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
Invoke-WebRequest -Uri "http://127.0.0.1:8001/api/admin/uploads" -Headers $headers -Method GET
# Expected: 405 Method Not Allowed (JWT verification passed!)
```

### Service Token (Non-Interactive)

```powershell
# Set service token credentials
$env:CF_ACCESS_CLIENT_ID = "<your-service-token-client-id>"
$env:CF_ACCESS_CLIENT_SECRET = "<your-service-token-secret>"

# Test whoami (Cloudflare injects JWT automatically)
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"principal":"portfolio-admin-smoke"}

# Upload file with service token
curl -X POST `
  -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
  -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
  -F "file=@path/to/image.png" -F "make_card=true" `
  https://assistant.ledger-mind.org/api/admin/uploads
```

## Common Commands

```powershell
# Re-authenticate (if token expired)
.\cf-access-login.ps1

# Check configuration
Get-Content .env

# Check if backend is running
Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue

# View backend logs (if running in background)
Get-Process python | Where-Object { $_.Path -like "*uvicorn*" }

# Kill backend on port 8001
Get-NetTCPConnection -LocalPort 8001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Troubleshooting One-Liners

```powershell
# Check cloudflared installed
cloudflared --version

# Check if authenticated
cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# Check Python environment
python --version
pip list | Select-String -Pattern "PyJWT|cryptography"

# Verify CF Access module loads
python -c "from assistant_api.utils.cf_access import require_cf_access; print('OK')"

# Check JWKS endpoint
Invoke-WebRequest -Uri "https://ledgermind.cloudflareaccess.com/cdn-cgi/access/certs" | Select-Object -ExpandProperty Content

# Load .env manually
Get-Content .env | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.+)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") } }
```

## Configuration Values

```bash
# User SSO
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com

# Service Tokens (optional - for non-interactive automation)
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke

# Upload limits
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

## Scripts

- `.\cf-access-login.ps1` - Authenticate with Cloudflare Access
- `.\verify-cf-access.ps1` - Verify complete setup (JWT, JWKS, backend)
- `.\start-backend.ps1` - Start backend with environment loaded

## Documentation

- `docs/CF_ACCESS_TESTING.md` - Complete testing guide
- `docs/VERIFY_CF_ACCESS.md` - Manual verification steps
- `docs/CF_ACCESS_QUICKSTART.md` - Production deployment guide
- `docs/CF_ACCESS.md` - Full architecture and setup documentation
