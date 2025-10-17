# Make GHCR Image Public - Instructions

## Why Make It Public?

Watchtower currently fails to pull updates from GHCR because the image is private:
```
time="2025-10-15T02:40:37Z" level=warning msg="Reason: registry responded to head request with \"403 Forbidden\", auth: \"not present\""
```

Making the image public allows Watchtower to auto-pull updates without authentication.

## Steps to Make Image Public

### Option 1: Via Web UI (Easiest)

1. **Open the package page** (should be open in your browser now):
   https://github.com/users/leok974/packages/container/package/leo-portfolio%2Fportfolio

2. **Click "Package settings"** (right side of the page)

3. **Scroll down to "Danger Zone"**

4. **Find "Change package visibility"**

5. **Click "Change visibility"**

6. **Select "Public"**

7. **Type the package name to confirm**: `leo-portfolio/portfolio`

8. **Click "I understand, change package visibility"**

### Option 2: Via GitHub CLI

```bash
# Make package public
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /user/packages/container/leo-portfolio%2Fportfolio \
  -f visibility='public'
```

## Verify It Worked

After making it public, test that anonymous pulls work:

```bash
# Pull without authentication (should work now)
docker logout ghcr.io
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
```

Expected output: `Status: Downloaded newer image...` (no auth errors)

## Restart Watchtower

After making the image public, restart Watchtower to clear any cached auth failures:

```bash
docker restart watchtower
```

Check logs:
```bash
docker logs watchtower --tail=20 -f
```

Expected: Next update cycle should succeed without `403 Forbidden` errors.

## Test Auto-Update

1. **Make a small change** to your portfolio (e.g., edit a text file)
2. **Build and push**:
   ```bash
   docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
   docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
   ```
3. **Wait ~5 minutes** for Watchtower to detect and update
4. **Verify**:
   ```bash
   docker logs watchtower --tail=50
   # Should show: Updated container /portfolio-ui
   ```

## Security Note

Making the image public means:
- ✅ Anyone can pull (download) the image
- ✅ Watchtower can auto-update without auth
- ⚠️ Your portfolio HTML/CSS/JS will be visible in the image
- ✅ Only you can push (upload) new versions (requires GitHub auth)

Since this is a public portfolio website anyway, making the image public is safe and recommended.

## Alternative: Keep Private + Add Auth to Watchtower

If you prefer to keep the image private, you can give Watchtower credentials:

```bash
# Stop Watchtower
docker stop watchtower
docker rm watchtower

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin

# Recreate Watchtower with access to Docker config
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json \
  -e DOCKER_CONFIG=/config.json \
  containrrr/watchtower --interval 300 --cleanup portfolio-ui
```

However, **making it public is simpler** and works for public portfolios.

---

**Recommended:** Make it public ✅
