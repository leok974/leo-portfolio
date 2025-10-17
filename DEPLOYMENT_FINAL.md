# Automated Deployment - Final Instructions

**Goal**: One-time SSH setup → then push-to-deploy forever

---

## 1) One-time bootstrap on the server (last SSH you'll need)

SSH into the prod box and run:

```bash
# create a working dir and pull the compose file with watchtower + portfolio-ui
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml

# (only if GHCR is private)
# echo <YOUR_GHCR_TOKEN> | docker login ghcr.io -u leok974 --password-stdin

# start portfolio-ui + watchtower
docker compose -f docker-compose.portfolio-ui.yml up -d
```

**What this does**:

- Runs `portfolio-ui` from `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- Runs **Watchtower** (checks every 60s; pulls `:latest`; restarts container; cleans old images)
- Limits updates to the labeled service only (`com.centurylinklabs.watchtower.enable=true`)

**If your nginx/ingress isn't pointing at portfolio-ui yet**, update it to proxy to the container on port 80 (inside your `infra_net`).

---

## 2) CI is already set up to build & push on every main

**Workflow**: `.github/workflows/deploy-docker.yml`

Builds with `VITE_LAYOUT_ENABLED=1`, then pushes:
- `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- `ghcr.io/leok974/leo-portfolio/portfolio:v{version}`
- `ghcr.io/leok974/leo-portfolio/portfolio:{sha}`

Optional Cloudflare purge if you add `CF_API_TOKEN` + `CF_ZONE_ID` repo secrets.

**Deploy flow now**: push → CI builds image → Watchtower pulls → site updates. **No SSH**.

---

## 3) Verify (after your next push to main)

```bash
# On your local machine:
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
```

You should see the new hashed bundle. If you enabled the optional purge in CI, it shows immediately; otherwise Cloudflare may serve the previous index.html for a short time (hashed JS files are fine).

---

## 4) Rollback (no SSH)

Retag an older version as `:latest` and push; Watchtower will roll you back automatically:

```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 ghcr.io/leok974/leo-portfolio/portfolio:latest
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

## Quick checklist

- [ ] One-time SSH → run the compose above
- [ ] Ensure nginx/ingress routes to `portfolio-ui` (port 80)
- [ ] (Optional) Add `CF_API_TOKEN` + `CF_ZONE_ID` in GitHub → CI auto-purges cache
- [ ] Push to main → wait ~3–4 min → verify new bundle hash on live site

---

## Current Status

**Production**: `https://leoklemet.com/`
- Current hash: `main-QESHvkic.js` (old)
- Target hash: `main-D0fKNExd.js` (new, in v0.4.0)

**Image ready**: `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
- Digest: `sha256:d9cc0f44c3afac593b0263c6c6e5b15a22671a772dc9c6d058b02362bf06bcda`
- ✅ Already pushed to GHCR

**Workflow**: `.github/workflows/deploy-docker.yml`
- ✅ Configured and ready
- Triggers on push to `main` branch

---

## After Bootstrap

Future deploys are just:

```bash
git add .
git commit -m "feat: update portfolio"
git push origin main
# Wait 3-4 minutes... done! ✅
```

**Timeline**:
- T+0:00 → Push to GitHub
- T+2:30 → CI builds & pushes image
- T+3:30 → Watchtower deploys
- **Total: ~3-4 minutes** 🚀

---

**Ready to deploy? SSH to your server and run the commands in section 1!**
