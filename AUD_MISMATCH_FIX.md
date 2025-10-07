# Service Token Issue SOLVED! 🎯

## Root Cause: Audience (AUD) Mismatch

### Error
```
❌ JWT validation failed: Audience doesn't match
```

### What This Means

Cloudflare Access IS working correctly:
- ✅ Service token recognized
- ✅ JWT generated
- ✅ JWT forwarded to backend

BUT: The JWT's `aud` (audience) claim doesn't match what the backend expects.

### Current Configuration

**Backend expects:**
```
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
```

**Cloudflare Access is sending:** (different value - need to check CF dashboard)

### How to Fix

#### Option 1: Update Backend AUD (Recommended)

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Click on the `assistant.ledger-mind.org/api/admin*` application
3. Find the **Application Audience (AUD) Tag** (usually in application settings/overview)
4. Copy the exact AUD value
5. Update `assistant_api/.env.prod`:
   ```env
   CF_ACCESS_AUD=<PASTE_THE_CORRECT_AUD_HERE>
   ```
6. Rebuild and restart:
   ```powershell
   docker compose build backend
   docker compose up -d
   ```

#### Option 2: Update Cloudflare Application

Alternatively, you could change the CF Access application's AUD to match the backend, but Option 1 is easier.

### Next Steps

1. **Get the correct AUD from Cloudflare dashboard**
2. Update `.env.prod` with the correct value
3. Rebuild backend
4. Test again - should get 200 OK!

### Expected Result After Fix

```json
{
  "ok": true,
  "principal": "portfolio-admin-smoke"
}
```

## Commands

### Check Current Backend AUD
```powershell
docker compose exec backend env | Select-String "CF_ACCESS_AUD"
```

### Update and Rebuild
```powershell
# After updating .env.prod with correct AUD:
docker compose build backend
docker compose up -d
Start-Sleep -Seconds 20
.\test-service-token-local.ps1
```

### Get AUD from Cloudflare
1. Dashboard → Zero Trust → Access → Applications
2. Click your application
3. Look for "Application Audience (AUD) Tag" or "Audience"
4. Copy the value (long hex string like: `abc123...`)

---

**We're SO close!** Just need the correct AUD value from Cloudflare! 🚀
