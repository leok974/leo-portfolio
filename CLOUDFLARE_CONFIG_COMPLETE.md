# Cloudflare Configuration Complete ✅

**Date**: October 17, 2025
**Domain**: leoklemet.com / www.leoklemet.com
**Zone ID**: Retrieved and configured via API

## What Was Configured

### ✅ Cache Bypass Rules

Rules created via Cloudflare Page Rules API:

1. **Rule 1**: `https://www.leoklemet.com/agent/*`
   - Action: Bypass cache
   - Priority: 1
   - Status: Active

2. **Rule 2**: `https://www.leoklemet.com/chat`
   - Action: Bypass cache
   - Priority: 1
   - Status: Active

3. **Rule 3**: `https://www.leoklemet.com/api/*`
   - Action: Bypass cache
   - Priority: 1
   - Status: Active

### ✅ Cache Purge

Purged cache for:
- `/agent/*`
- `/chat`
- `/api/*`

**Note**: Rules take 1-2 minutes to propagate across Cloudflare's global network.

## API Commands Used

```powershell
# 1. Fetched Zone ID
$zone = Invoke-RestMethod -Headers @{ Authorization="Bearer $token" } `
  -Uri "https://api.cloudflare.com/client/v4/zones?name=leoklemet.com"

# 2. Created Page Rules (3x)
Invoke-RestMethod -Method Post `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/pagerules" `
  -Body '{
    "targets": [{"target":"url","constraint":{"operator":"matches","value":"..."}}],
    "actions": [{"id":"cache_level","value":"bypass"}],
    "priority": 1,
    "status": "active"
  }'

# 3. Purged Cache
Invoke-RestMethod -Method Post `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
  -Body '{"files":["..."]}'
```

## Verification

### Before DNS Propagation

Test via Host header (works immediately):
```bash
curl -H "Host: www.leoklemet.com" https://assistant.ledger-mind.org/agent/dev/status
```

### After DNS Propagation

Once DNS is live (www.leoklemet.com and leoklemet.com resolve):

```bash
# Should return JSON (not HTML!)
curl -s https://www.leoklemet.com/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}

# Enable dev overlay
curl -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable
# Expected: Set-Cookie: sa_dev=...

# Visit site
open https://www.leoklemet.com/
# Expected: Portfolio loads, dev badge appears after enabling

# Apex redirect
curl -I https://leoklemet.com/
# Expected: 301 → https://www.leoklemet.com/
```

## Troubleshooting

### Issue: Endpoints still return HTML instead of JSON

**Possible causes**:
1. ✅ Rules are propagating (wait 1-2 minutes)
2. ❌ DNS not configured yet (test via Host header)
3. ❌ Browser cache (use incognito/private mode)

**Fix**:
```bash
# Force bypass cache in request
curl -H "Cache-Control: no-cache" https://www.leoklemet.com/agent/dev/status

# Or wait and retry
sleep 120; curl -s https://www.leoklemet.com/agent/dev/status
```

### Issue: Dev badge doesn't appear

**Checks**:
```bash
# 1. Verify cookie was set
curl -i -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable | grep -i set-cookie

# 2. Check status
curl -s https://www.leoklemet.com/agent/dev/status

# 3. Verify frontend includes dev-overlay.ts
curl -s https://www.leoklemet.com/ | grep "main-"
```

### Issue: 502 Bad Gateway

**Backend not responding**:
```bash
# Check backend container
docker ps --filter name=ai-finance-backend-1

# Test backend directly
docker exec applylens-nginx-prod curl -s http://ai-finance-api.int:8000/agent/dev/status

# Check logs
docker logs ai-finance-backend-1 --tail 50
```

## Page Rules Limit

Cloudflare Free plan: **3 Page Rules** (all used for this setup)

If you need more rules, consider:
- Upgrading to Pro plan (20 rules)
- Using Cache Rules API (requires Pro+ plan)
- Combining patterns (less granular)

## Next Actions

1. **Configure DNS** in Cloudflare Dashboard:
   - Add A/CNAME: `www.leoklemet.com` → your server IP
   - Add A/CNAME: `leoklemet.com` → your server IP
   - Enable Proxy (orange cloud) for both

2. **Wait 1-2 minutes** for rules to propagate

3. **Test** once DNS is live:
   ```bash
   curl -s https://www.leoklemet.com/agent/dev/status
   ```

4. **Enable dev overlay** in browser:
   ```bash
   curl -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable
   # Then reload https://www.leoklemet.com/ - badge should appear
   ```

## Summary

✅ All Cloudflare configuration complete via API
✅ Cache bypass rules active for dynamic endpoints
✅ Cache purged
⏳ Waiting for DNS configuration
⏳ Waiting for rule propagation (1-2 min)

**Status**: Infrastructure ready for production once DNS is configured! 🚀
