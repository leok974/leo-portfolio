# Cloudflare Access - Production Deployment

## ✅ Configuration Ready

Your production configuration is correct:

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

## 🚀 Deployment Steps

### 1. Deploy Backend to Production

Make sure these environment variables are set on your production backend:

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

**Docker Compose:**
```bash
# Deploy with production override
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               up -d --build backend
```

**Verify backend picked up the config:**
```bash
# Check logs for startup
docker-compose logs backend | grep -i "cf_access\|team_domain\|aud"
```

### 2. Authenticate from Your Machine

Use the **application URL** (not the team domain):

```powershell
# Authenticate (opens browser for SSO)
cloudflared access login https://assistant.ledger-mind.org/api/uploads
```

This will:
- Open browser to Cloudflare Access
- Prompt you to sign in with `leoklemet.pa@gmail.com`
- Save authentication token locally

### 3. Get JWT Token

```powershell
# Get a short-lived JWT for the application
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/uploads
```

The token is valid for ~24 hours (based on your CF Access session duration).

### 4. Quick Smoke Test - Whoami Endpoint

```powershell
# Test whoami endpoint (simplest test - returns your email)
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
```

**Expected Result:**
```json
{"ok":true,"email":"leoklemet.pa@gmail.com"}
```

If this works, JWT verification is working correctly! ✅

### 5. Test Upload Endpoint

```powershell
# Test with curl (expect NOT 403)
curl -s -o $null -w "%{http_code}`n" `
  -H "Cf-Access-Jwt-Assertion: $token" `
  https://assistant.ledger-mind.org/api/uploads

# Or with Invoke-WebRequest
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/uploads" `
                      -Headers $headers `
                      -Method GET `
                      -UseBasicParsing
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode"
}
```

**Expected Results:**
- ✅ **405 Method Not Allowed** - JWT verified, but GET not allowed on POST endpoint (SUCCESS!)
- ✅ **400 Bad Request** - JWT verified, but missing required fields (SUCCESS!)
- ❌ **403 Forbidden** - JWT verification failed or missing
- ❌ **401 Unauthorized** - JWT signature invalid

### 6. Test File Upload

```powershell
# Create test file
"Hello World" | Out-File -FilePath test.txt -Encoding utf8

# Upload with JWT
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
$file = Get-Item test.txt

$boundary = [System.Guid]::NewGuid().ToString()
$formData = @"
--$boundary
Content-Disposition: form-data; name="file"; filename="test.txt"
Content-Type: text/plain

$(Get-Content $file -Raw)
--$boundary
Content-Disposition: form-data; name="make_card"

false
--$boundary--
"@

$response = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/uploads" `
                               -Method POST `
                               -Headers @{
                                   "Cf-Access-Jwt-Assertion" = $token
                                   "Content-Type" = "multipart/form-data; boundary=$boundary"
                               } `
                               -Body $formData

$response.Content | ConvertFrom-Json
```

## 🧪 Production Smoke Test Script

Run this complete smoke test:

```powershell
# Full production test
Write-Host "=== Production Smoke Test ===" -ForegroundColor Cyan

# 1. Authenticate
Write-Host "`n1. Authenticating..." -ForegroundColor Yellow
cloudflared access login https://assistant.ledger-mind.org/api/uploads

# 2. Get token
Write-Host "`n2. Getting JWT token..." -ForegroundColor Yellow
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/uploads
Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Gray

# 3. Test uploads endpoint
Write-Host "`n3. Testing /api/uploads..." -ForegroundColor Yellow
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/uploads" `
                      -Headers $headers `
                      -Method GET `
                      -ErrorAction Stop
    Write-Host "✗ Unexpected 200 OK" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 405) {
        Write-Host "✓ 405 Method Not Allowed (JWT verified!)" -ForegroundColor Green
    } elseif ($code -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification failed)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $code" -ForegroundColor Yellow
    }
}

# 4. Test gallery endpoint
Write-Host "`n4. Testing /api/gallery..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/gallery/add" `
                      -Headers $headers `
                      -Method GET `
                      -ErrorAction Stop
    Write-Host "✗ Unexpected 200 OK" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 405) {
        Write-Host "✓ 405 Method Not Allowed (JWT verified!)" -ForegroundColor Green
    } elseif ($code -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification failed)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $code" -ForegroundColor Yellow
    }
}

# 5. Test without token
Write-Host "`n5. Testing without JWT (should fail)..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/uploads" `
                      -Method GET `
                      -ErrorAction Stop
    Write-Host "✗ Unexpected 200 OK (JWT should be required!)" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 403) {
        Write-Host "✓ 403 Forbidden (JWT requirement enforced!)" -ForegroundColor Green
    } else {
        Write-Host "⚠ Status: $code" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
```

Save as `test-production.ps1` and run:
```powershell
.\test-production.ps1
```

## ✅ Success Criteria

Your production deployment is working if:

- ✅ Authentication opens browser and succeeds
- ✅ Token retrieval returns a JWT (xxx.yyy.zzz format)
- ✅ `/api/uploads` with JWT returns **405** (not 403)
- ✅ `/api/gallery/add` with JWT returns **405** (not 403)
- ✅ Requests **without** JWT return **403**
- ✅ Backend logs show JWT verification (check with `docker-compose logs backend`)

## 🔍 Monitoring

### Check Backend Logs

```bash
# View recent logs
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               logs -f backend

# Look for JWT verification
docker-compose logs backend | grep -i "jwt\|cf_access\|cloudflare"
```

### Check Cloudflare Access Logs

1. Go to **Cloudflare Zero Trust** dashboard
2. Navigate to **Logs** → **Access**
3. Filter by application: "Assistant API"
4. Look for authentication attempts from `leoklemet.pa@gmail.com`

## 🐛 Troubleshooting

### Backend Returns 403 with Valid Token

**Check environment variables are set:**
```bash
docker-compose exec backend env | grep CF_ACCESS
```

Should show:
```
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

**If missing, redeploy:**
```bash
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               down

docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               up -d --build backend
```

### Token Expired

**Get a fresh token:**
```powershell
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/uploads
```

### JWKS Endpoint Not Reachable

**Verify from backend container:**
```bash
docker-compose exec backend curl https://ledgermind.cloudflareaccess.com/cdn-cgi/access/certs
```

Should return JSON with public keys.

### Backend Can't Verify JWT Signature

**Check PyJWT is installed:**
```bash
docker-compose exec backend pip list | grep PyJWT
```

Should show: `PyJWT 2.10.1` (or similar)

## 📚 Documentation

- **This Guide**: Production deployment steps
- **Testing**: `docs/CF_ACCESS_TESTING.md`
- **Verification**: `docs/VERIFY_CF_ACCESS.md`
- **Complete Setup**: `docs/CF_ACCESS.md`

## 🎯 Next Steps

After successful deployment:

1. ✅ Test file uploads through browser
2. ✅ Configure frontend attachment button
3. ✅ Set up monitoring/alerting
4. ✅ Document for team members
5. ✅ Consider rate limiting for public exposure
