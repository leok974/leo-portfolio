# Cloudflare Access Deployment Quick Reference

**Quick setup guide for deploying upload endpoints with Cloudflare Access authentication.**

## Prerequisites

- Cloudflare account with Zero Trust enabled
- Domain connected to Cloudflare
- Cloudflare Tunnel configured (cloudflared running)

## Step 1: Configure Cloudflare Access Application

### Create Application
1. Go to **Cloudflare Zero Trust** → **Access** → **Applications**
2. Click **Add an application** → **Self-hosted**
3. Fill in details:
   ```
   Application name: Portfolio Upload API
   Session duration: 24 hours
   Application domain: api.yourdomain.com
   Path: /api/uploads, /api/gallery
   ```

### Create Access Policy
1. Under **Add a policy**, configure:
   ```
   Policy name: Allow specific users
   Action: Allow
   Include: Emails → your@email.com, teammate@email.com
   ```
2. Click **Add application**
3. **Note the Application Audience (AUD) tag** from Overview tab

### Find Team Domain
1. Go to **Cloudflare Zero Trust** → **Settings** → **Custom Pages**
2. Your team domain is in the URL: `yourteam.cloudflareaccess.com`

## Step 2: Install Backend Dependency

```bash
cd assistant_api

# Add to requirements.in if not present:
echo "pyjwt[crypto]>=2.9.0" >> requirements.in

# Install dependency
pip install pyjwt[crypto]>=2.9.0

# Or regenerate lock file
pip install -r requirements.in
pip freeze > requirements.txt
```

## Step 3: Configure Environment Variables

### Option A: Docker Compose (.env file)

Create or edit `.env.production`:
```bash
# Cloudflare Access JWT Verification
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=your-application-aud-tag-here
ACCESS_ALLOWED_EMAILS=your@email.com,teammate@email.com  # Optional

# Upload Limits
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

### Option B: Docker Compose Override

Edit `deploy/docker-compose.prod.override.yml`:
```yaml
services:
  backend:
    environment:
      - CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
      - CF_ACCESS_AUD=your-aud-tag-here
      - ACCESS_ALLOWED_EMAILS=your@email.com
      - MAX_IMAGE_MB=30
      - MAX_VIDEO_MB=200
```

### Option C: Direct Environment Variables

```bash
export CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
export CF_ACCESS_AUD=your-aud-tag-here
export ACCESS_ALLOWED_EMAILS=your@email.com
```

## Step 4: Deploy

### Docker Compose
```bash
# Build with new dependency
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               build backend

# Deploy
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               up -d backend
```

### Direct uvicorn
```bash
# Install dependencies
cd assistant_api
pip install -r requirements.txt

# Run with environment variables
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com \
CF_ACCESS_AUD=your-aud-tag \
ACCESS_ALLOWED_EMAILS=your@email.com \
uvicorn assistant_api.main:app --host 0.0.0.0 --port 8000
```

## Step 5: Test

### Via Browser
1. Navigate to `https://api.yourdomain.com/api/uploads`
2. Should redirect to Cloudflare Access login
3. Login with allowed email
4. Should see 405 Method Not Allowed (GET on POST-only endpoint = success!)

### Via curl (will fail without JWT)
```bash
# Should return 403: Cloudflare Access required
curl https://api.yourdomain.com/api/uploads

# Only works through browser with CF Access
```

### Upload Test (Browser)
```javascript
// In browser console after CF Access login
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('make_card', 'true');
formData.append('title', 'Test Upload');

fetch('/api/uploads', {
  method: 'POST',
  body: formData
}).then(r => r.json()).then(console.log);
```

## Verification Checklist

- [ ] Cloudflare Access application created
- [ ] Access policy includes your email
- [ ] AUD tag copied from application overview
- [ ] Team domain identified from Zero Trust settings
- [ ] `pyjwt[crypto]` installed in backend
- [ ] Environment variables configured (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD)
- [ ] Backend restarted with new config
- [ ] Test upload returns 403 without authentication
- [ ] Test upload succeeds after CF Access login
- [ ] Cloudflare Access logs show successful authentication

## Troubleshooting

### "Cloudflare Access required" (403)
- Check that requests go through Cloudflare Tunnel (not direct to origin)
- Verify CF Access application is configured for the domain/path
- Ensure user is authenticated (should have cf-access cookie)

### "Invalid Access token" (401)
- Verify `CF_ACCESS_TEAM_DOMAIN` matches your team domain exactly
- Check `CF_ACCESS_AUD` matches the application AUD tag
- Ensure token hasn't expired (default: 24 hours)
- Try clearing browser cookies and re-authenticating

### "Not allowed" (403 with valid JWT)
- Check email is in `ACCESS_ALLOWED_EMAILS` (case-insensitive)
- Remove `ACCESS_ALLOWED_EMAILS` to rely only on CF Access policy
- Verify email in JWT matches (check Cloudflare Access logs)

### "Module 'jwt' not found" (Import Error)
- Install dependency: `pip install pyjwt[crypto]>=2.9.0`
- Rebuild Docker image if using containers
- Check requirements.txt includes `PyJWT` and `cryptography`

### "Unable to verify Access token (unknown key)" (401)
- Wait 10 minutes for JWKS cache refresh
- Restart backend to clear cache
- Check JWKS endpoint: `https://yourteam.cloudflareaccess.com/cdn-cgi/access/certs`

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CF_ACCESS_TEAM_DOMAIN` | ✅ Yes | None | Your Cloudflare team domain (e.g., `yourteam.cloudflareaccess.com`) |
| `CF_ACCESS_AUD` | ✅ Yes | None | Application Audience tag from CF Access |
| `ACCESS_ALLOWED_EMAILS` | ❌ No | None | Comma-separated email allowlist (optional extra filter) |
| `MAX_IMAGE_MB` | ❌ No | 30 | Maximum image size in megabytes |
| `MAX_VIDEO_MB` | ❌ No | 200 | Maximum video size in megabytes |

## Security Notes

1. **No Direct Origin Access**: Ensure backend is ONLY accessible via Cloudflare Tunnel
2. **JWT Verification**: Backend always verifies JWT signature (never trusts header blindly)
3. **Email Allowlist**: Optional extra layer if CF Access policy isn't sufficient
4. **Audit Logs**: Monitor CF Access logs for authentication attempts
5. **Session Duration**: Configure in CF Access (default: 24 hours)

## Monitoring

### Cloudflare Access Logs
- **Location**: Cloudflare Zero Trust → Logs → Access
- **Shows**: Authentication attempts, allow/deny decisions, user emails, timestamps

### Backend Logs
Add user email logging to track uploads:
```python
@router.post("/api/uploads")
async def upload_file(
    file: UploadFile,
    email: str = Depends(require_cf_access)
):
    logger.info(f"Upload by {email}: {file.filename}")
    # ... process upload
```

## Cost

**Cloudflare Access Pricing:**
- Free: 50 users
- Teams Standard: $7/user/month
- Teams Enterprise: Custom

**For personal portfolio**: Free tier is sufficient

## Documentation

- **Complete Guide**: `docs/CF_ACCESS.md`
- **API Documentation**: `docs/UPLOADS.md`
- **Migration Notes**: `docs/FEATURE_GATING.md`

## Support

Issues with:
- **Cloudflare Access**: Check Zero Trust dashboard logs
- **JWT Verification**: Check backend logs for PyJWT errors
- **Upload Functionality**: Test with direct curl (bypass CF for testing)
- **Configuration**: Verify environment variables with `env | grep CF_ACCESS`
