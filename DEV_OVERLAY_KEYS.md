# 🔑 Dev Overlay Secret Keys

**Generated**: October 20, 2025
**Status**: Ready for use

## Quick Copy-Paste

### Backend (.env or environment)

```bash
export DEV_OVERLAY_KEY=a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9
export ADMIN_HMAC_KEY=7c9c56ddfd4ebc3058f0e3c31be642af4a8a7a375e120f82da0be9c26539b42e
```

### Frontend (.env.local for Vite)

```bash
VITE_BACKEND_ENABLED=1
VITE_DEV_OVERLAY_KEY=a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9
VITE_ADMIN_HMAC_KEY=7c9c56ddfd4ebc3058f0e3c31be642af4a8a7a375e120f82da0be9c26539b42e
```

## Key Purposes

| Key | Used By | Purpose |
|-----|---------|---------|
| `DEV_OVERLAY_KEY` | Backend & Frontend | Authenticates `/api/dev/status` requests |
| `ADMIN_HMAC_KEY` | Backend & Frontend | Authenticates admin endpoints (hide/unhide projects) |

## Setup Instructions

### Option 1: Automated Setup (Recommended)

```powershell
.\setup-dev-env.ps1
```

This will:
- Copy `.env.example` to `.env.local` with pre-generated keys
- Show next steps for backend and frontend

### Option 2: Manual Setup

1. **Backend** - Add to `assistant_api/.env` or export in shell:
   ```bash
   cd assistant_api
   echo "DEV_OVERLAY_KEY=a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" >> .env
   echo "ADMIN_HMAC_KEY=7c9c56ddfd4ebc3058f0e3c31be642af4a8a7a375e120f82da0be9c26539b42e" >> .env
   ```

2. **Frontend** - Create `.env.local` in project root:
   ```bash
   cd ..  # back to project root
   cat > .env.local << EOF
   VITE_BACKEND_ENABLED=1
   VITE_DEV_OVERLAY_KEY=a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9
   VITE_ADMIN_HMAC_KEY=7c9c56ddfd4ebc3058f0e3c31be642af4a8a7a375e120f82da0be9c26539b42e
   EOF
   ```

## Testing

### Test Backend Endpoint

```bash
# Start backend
cd assistant_api
uvicorn assistant_api.main:app --reload --port 8001

# In another terminal, test status endpoint
curl http://localhost:8001/api/dev/status \
  -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9"
```

**Expected**: `{"allowed": true, "mode": "token"}`

### Test Frontend Build

```bash
# Build with environment variables
pnpm run build:portfolio
```

**Expected**: Build succeeds, keys are embedded in bundle

### Test Dev Overlay

1. Build and serve frontend
2. Visit with `sa_dev` cookie set
3. Click DEV badge → Should show status
4. Click ⚙️ → Admin panel should show projects with hide/unhide buttons

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env.local` to git (already in `.gitignore`)
- Never expose these keys in client-side code (Vite handles this)
- Rotate keys if compromised
- Use different keys for production

## Regenerating Keys

If you need to regenerate keys:

### PowerShell (Windows)
```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { $_.ToString("x2") })
```

### Bash (Linux/Mac)
```bash
openssl rand -hex 32
```

### Python
```python
import secrets
print(secrets.token_hex(32))
```

## Troubleshooting

### "allowed: false, mode: denied"

**Cause**: Key mismatch between backend and frontend
**Solution**: Ensure both use the exact same `DEV_OVERLAY_KEY`

### "Backend is unreachable"

**Cause**: Backend not running or wrong URL
**Solution**:
- Start backend: `uvicorn assistant_api.main:app --port 8001`
- Or use local override: `?dev_overlay=dev`

### Keys not loading in frontend

**Cause**: `.env.local` not in project root or Vite needs restart
**Solution**:
- Ensure `.env.local` is in `d:\leo-portfolio\`
- Rebuild: `pnpm run build:portfolio`

## Environment Variable Precedence

Vite loads env files in this order (later overrides earlier):
1. `.env` - Base config
2. `.env.local` - Local overrides (gitignored)
3. `.env.[mode]` - Mode-specific (e.g., `.env.production`)
4. `.env.[mode].local` - Local mode overrides

For development, `.env.local` is the right place.

## Production Deployment

For production, set these as **build-time environment variables** in your CI/CD:

```yaml
# GitHub Actions example
env:
  VITE_BACKEND_ENABLED: 1
  VITE_DEV_OVERLAY_KEY: ${{ secrets.DEV_OVERLAY_KEY }}
  VITE_ADMIN_HMAC_KEY: ${{ secrets.ADMIN_HMAC_KEY }}
```

And runtime environment for backend:
```yaml
# Docker/Railway example
environment:
  DEV_OVERLAY_KEY: ${{ secrets.DEV_OVERLAY_KEY }}
  ADMIN_HMAC_KEY: ${{ secrets.ADMIN_HMAC_KEY }}
```
