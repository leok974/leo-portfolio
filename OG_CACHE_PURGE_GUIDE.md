# Cloudflare OG Cache Purge - Quick Reference

## When to Use
Run this if OG image E2E tests still fail after deployment due to cached 404 responses.

## Prerequisites

### Get Cloudflare Credentials

1. **API Token:**
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template: "Edit zone DNS" or create custom with:
     - Permissions: Zone > Cache Purge > Purge
     - Zone Resources: Include > Specific zone > leoklemet.com
   - Copy the token (only shown once!)

2. **Zone ID:**
   - Go to: https://dash.cloudflare.com/
   - Click on leoklemet.com domain
   - Scroll down to "API" section on right sidebar
   - Copy "Zone ID"

## Setup Credentials (Choose One Method)

### Method 1: One-Time Setup (Recommended)
Store credentials persistently so they're available in all future sessions:

```powershell
# Run this once to store credentials permanently
.\scripts\set-cloudflare-credentials.ps1

# Then you can purge cache anytime without setting env vars
.\scripts\purge-og-cache.ps1
```

### Method 2: Per-Session Setup
Set credentials manually in each PowerShell session:

```powershell
# Set for current session only
$env:CLOUDFLARE_API_TOKEN = "your-api-token-here"
$env:CF_ZONE_ID = "your-zone-id-here"

# Run the purge script
.\scripts\purge-og-cache.ps1
```

### Method 3: Load from .env File
If credentials are stored in `.env.cloudflare`:

```powershell
# Load credentials from file
Get-Content .env.cloudflare | ForEach-Object {
  if ($_ -match '^([^=]+)=(.+)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

# Run the purge script
.\scripts\purge-og-cache.ps1
```

## Expected Output

```
Purging Cloudflare cache for 7 OG images...
✅ Cache purged successfully!
Files cleared:
  - https://www.leoklemet.com/og/og.png
  - https://www.leoklemet.com/og/applylens.png
  - https://www.leoklemet.com/og/ai-finance-agent-oss.png
  - https://www.leoklemet.com/og/ai-ops-agent-gke.png
  - https://www.leoklemet.com/og/pixo-banana-suite.png
  - https://www.leoklemet.com/og/adgen-starter-kit.png
  - https://www.leoklemet.com/og/leo-portfolio.png
```

## Verify Cache Cleared

```powershell
# Should return 200 OK with Content-Type: image/png
curl -I https://www.leoklemet.com/og/og.png

# Check all images
@("og", "applylens", "ai-finance-agent-oss", "ai-ops-agent-gke", "pixo-banana-suite", "adgen-starter-kit", "leo-portfolio") | ForEach-Object {
  $response = Invoke-WebRequest -Uri "https://www.leoklemet.com/og/$_.png" -Method Head
  Write-Host "$_.png: $($response.StatusCode) - $($response.Headers['Content-Type'])"
}
```

## Troubleshooting

### Error: "Missing CLOUDFLARE_API_TOKEN env var"
**Solution:** Set the env var first:
```powershell
$env:CLOUDFLARE_API_TOKEN = "your-token-here"
```

### Error: "Cloudflare API returned success=false"
**Causes:**
1. Invalid API token (check permissions)
2. Wrong Zone ID (verify in dashboard)
3. Token expired (regenerate in Cloudflare)

**Fix:** Double-check credentials and try again.

### Images still return 404 after purge
**Possible causes:**
1. Watchtower hasn't updated container yet (wait 5 min)
2. Nginx container needs restart: `docker restart portfolio-nginx`
3. Files missing from Docker image: `docker exec portfolio-nginx ls -la /usr/share/nginx/html/og/`

## Manual Purge via Cloudflare Dashboard

If script fails:

1. Go to: https://dash.cloudflare.com/
2. Select leoklemet.com domain
3. Click "Caching" > "Configuration"
4. Click "Purge Cache"
5. Select "Purge by URL"
6. Paste all 7 URLs:
   ```
   https://www.leoklemet.com/og/og.png
   https://www.leoklemet.com/og/applylens.png
   https://www.leoklemet.com/og/ai-finance-agent-oss.png
   https://www.leoklemet.com/og/ai-ops-agent-gke.png
   https://www.leoklemet.com/og/pixo-banana-suite.png
   https://www.leoklemet.com/og/adgen-starter-kit.png
   https://www.leoklemet.com/og/leo-portfolio.png
   ```
7. Click "Purge"

## Alternative: Wait for Natural Expiration

The nginx config now sets cache to 10 minutes:
```nginx
location /og/ {
  expires 10m;
  add_header Cache-Control "public, max-age=600" always;
}
```

**If not urgent:** Just wait 10 minutes after deployment and cache will clear naturally.

---

**Note:** After E2E tests pass consistently, consider increasing cache back to 1 day for better performance:
```nginx
expires 1d;
add_header Cache-Control "public, max-age=86400" always;
```
