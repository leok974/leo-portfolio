# Deploy Portfolio to Your Cloudflare Tunnel Server

## Overview

This guide shows how to deploy the portfolio UI to your **existing server** where you already have:
- ✅ Cloudflare Tunnel configured for `assistant.ledger-mind.org`
- ✅ FastAPI backend running on `http://127.0.0.1:8001`

The portfolio will be served as **static files** with **same-origin API proxies** (no CORS complexity).

---

## Architecture

```
┌─────────────────────────────────────────────┐
│ Browser                                     │
│ https://assistant.ledger-mind.org           │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ Cloudflare Tunnel                           │
│ (tunnels to your server)                    │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ Your Server                                 │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Nginx (127.0.0.1:8080)               │  │
│  │                                      │  │
│  │  Static files: /var/www/portfolio    │  │
│  │  Proxies:                            │  │
│  │    /chat → 127.0.0.1:8001/chat       │  │
│  │    /chat/stream → :8001/chat/stream  │  │
│  │    /resume/ → :8001/resume/          │  │
│  │    /api/ → :8001/api/                │  │
│  └───────────┬──────────────────────────┘  │
│              │                              │
│              ▼                              │
│  ┌──────────────────────────────────────┐  │
│  │ FastAPI Backend (127.0.0.1:8001)     │  │
│  │ assistant_api                        │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Key Benefits:**
- ✅ Same-origin (no CORS errors)
- ✅ Single domain for everything
- ✅ Cloudflare handles SSL/TLS
- ✅ Simple nginx proxy configuration

---

## Prerequisites

1. **SSH access** to your server where Cloudflare Tunnel is running
2. **Nginx** installed on the server
3. **FastAPI backend** running on `127.0.0.1:8001`
4. **Cloudflare Tunnel** forwarding `assistant.ledger-mind.org` to `127.0.0.1:8080`

---

## Quick Deployment

### 1. Build the Portfolio ✅ (Already Done!)

Your portfolio is already built at:
```
D:\leo-portfolio\dist-portfolio\
```

**Build configuration used:**
- ✅ `VITE_SITE_ORIGIN=https://assistant.ledger-mind.org`
- ✅ `VITE_AGENT_API_BASE=` (empty = same-origin)
- ✅ `VITE_CALENDLY_URL=https://calendly.com/leoklemet-pa`
- ✅ `VITE_LAYOUT_ENABLED=0` (disabled until /api/layout available)

If you need to rebuild:
```powershell
npm run build:portfolio
```

### 2. Deploy to Server (Automated)

```powershell
# Dry run first (preview changes)
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root -DryRun

# Actual deployment
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root
```

**What the script does:**
1. ✅ Builds portfolio (or uses existing build)
2. ✅ Uploads files to `/var/www/portfolio/`
3. ✅ Deploys nginx configuration
4. ✅ Tests nginx config validity
5. ✅ Reloads nginx
6. ✅ Runs smoke tests

---

## Manual Deployment (Step by Step)

If you prefer manual deployment:

### Step 1: Upload Files

```bash
# From your Windows machine
rsync -avz --delete dist-portfolio/ user@your-server:/var/www/portfolio/

# Or using scp
scp -r dist-portfolio/* user@your-server:/var/www/portfolio/
```

### Step 2: Deploy Nginx Configuration

```bash
# Upload the config
scp deploy/nginx.assistant-server.conf user@your-server:/etc/nginx/sites-available/assistant.conf

# SSH into your server
ssh user@your-server

# Enable the site
sudo ln -sf /etc/nginx/sites-available/assistant.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 3: Verify Cloudflare Tunnel

Your Cloudflare Tunnel should already be configured to forward:
```
assistant.ledger-mind.org → http://127.0.0.1:8080
```

If not configured, update your tunnel configuration:
```bash
# Example tunnel config (cloudflared config.yml)
ingress:
  - hostname: assistant.ledger-mind.org
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Then restart the tunnel:
```bash
sudo systemctl restart cloudflared
```

---

## Nginx Configuration Explained

The nginx config (`deploy/nginx.assistant-server.conf`) provides:

### Same-Origin API Proxies

```nginx
# Chat endpoint (non-streaming)
location = /chat {
    proxy_pass http://127.0.0.1:8001/chat;
    # ... headers
}

# Chat streaming (SSE)
location = /chat/stream {
    proxy_pass http://127.0.0.1:8001/chat/stream;
    proxy_buffering off;              # Critical for SSE
    proxy_read_timeout 3600s;         # Long timeout for streams
    # ... headers
}

# Resume PDF/TXT generation
location /resume/ {
    proxy_pass http://127.0.0.1:8001/resume/;
    # ... headers
}

# Other API endpoints
location /api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    # ... headers
}
```

### Static Asset Handling

```nginx
# Assets folder (fingerprinted, immutable)
location /assets/ {
    try_files $uri =404;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}
```

### SPA Fallback (Must Be Last!)

```nginx
# Catch-all for SPA routing
location / {
    try_files $uri $uri/ /index.html;
}
```

**Critical:** The SPA fallback must come AFTER all API and asset routes, or it will intercept API calls!

---

## Post-Deployment Testing

### 1. Test from Server (SSH)

```bash
# Homepage
curl -I http://127.0.0.1:8080/
# Expected: HTTP/1.1 200 OK

# Static assets
curl -I http://127.0.0.1:8080/assets/main-*.css
# Expected: HTTP/1.1 200 OK, Cache-Control: immutable

# API proxy
curl -s http://127.0.0.1:8080/api/ready
# Expected: {"status":"ready"} or similar

# Resume PDF (if backend generates it)
curl -I http://127.0.0.1:8080/resume/Leo_Klemet_Resume.pdf
# Expected: HTTP/1.1 200 OK, Content-Type: application/pdf
```

### 2. Test from Browser

Open: `https://assistant.ledger-mind.org`

**Checklist:**
- [ ] Page loads without errors (check Console - F12)
- [ ] All assets load (check Network tab - no 404s)
- [ ] Calendly widget displays correctly (760px height, no clipping)
- [ ] Resume buttons work:
  - [ ] "View Resume (PDF)" opens PDF
  - [ ] "Copy for LinkedIn" copies text with ✅ feedback
- [ ] Assistant chat dock appears (bottom right)
- [ ] Can send chat message and receive streaming response
- [ ] Navigation works (About, Projects, Contact sections)
- [ ] Smooth scroll animations work

### 3. Test API Proxy (Same-Origin)

Open browser DevTools Console (F12) and run:

```javascript
// Test chat endpoint (same-origin, no CORS)
fetch('/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        messages: [{role: 'user', content: 'test'}]
    })
})
.then(r => r.json())
.then(data => console.log('Chat response:', data))
.catch(err => console.error('Error:', err));
```

**Expected:** No CORS errors, successful response from backend

---

## Troubleshooting

### Issue: 502 Bad Gateway

**Problem:** Nginx can't reach backend

**Diagnosis:**
```bash
# Check if backend is running
curl http://127.0.0.1:8001/api/ready

# Check nginx error logs
tail -f /var/log/nginx/assistant-error.log

# Check backend logs
journalctl -u assistant-api -f
```

**Solution:** Ensure FastAPI backend is running on `127.0.0.1:8001`

### Issue: 404 on /chat or /api/*

**Problem:** Nginx routing misconfigured

**Diagnosis:**
```bash
# Test direct to backend (should work)
curl http://127.0.0.1:8001/api/ready

# Test through nginx (if 404, nginx config issue)
curl http://127.0.0.1:8080/api/ready
```

**Solution:** Verify nginx config has proxy blocks BEFORE the SPA fallback location

### Issue: CORS Errors in Browser

**Problem:** Frontend is calling external API URL instead of same-origin

**Diagnosis:** Check browser Network tab - should see requests to `/chat`, not `https://...`

**Solution:**
1. Verify `VITE_AGENT_API_BASE` is empty in `.env.production`
2. Rebuild: `npm run build:portfolio`
3. Re-deploy

### Issue: Assets Return HTML Instead of CSS/JS

**Problem:** SPA fallback is catching asset requests

**Solution:** Ensure asset locations are BEFORE the catch-all location:

```nginx
# This should come BEFORE location /
location /assets/ {
    try_files $uri =404;
}

# This must be last
location / {
    try_files $uri $uri/ /index.html;
}
```

### Issue: Streaming Chat Not Working

**Problem:** Nginx buffering SSE stream

**Diagnosis:**
```bash
# Test streaming directly to backend
curl -N http://127.0.0.1:8001/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

**Solution:** Ensure `/chat/stream` location has:
```nginx
proxy_buffering off;
proxy_request_buffering off;
proxy_read_timeout 3600s;
chunked_transfer_encoding on;
```

### Issue: Cloudflare Shows "Web Server Is Down"

**Problem:** Tunnel can't reach nginx

**Diagnosis:**
```bash
# Check nginx is listening
sudo netstat -tlnp | grep :8080

# Check tunnel is running
sudo systemctl status cloudflared
```

**Solution:**
1. Restart nginx: `sudo systemctl restart nginx`
2. Restart tunnel: `sudo systemctl restart cloudflared`
3. Check tunnel logs: `journalctl -u cloudflared -f`

---

## Monitoring

### Nginx Logs

```bash
# Access logs (HTTP requests)
tail -f /var/log/nginx/assistant-access.log

# Error logs (issues)
tail -f /var/log/nginx/assistant-error.log

# Filter for 404s
tail -f /var/log/nginx/assistant-access.log | grep " 404 "

# Filter for 502s (backend issues)
tail -f /var/log/nginx/assistant-access.log | grep " 502 "
```

### Backend Logs

```bash
# If running as systemd service
journalctl -u assistant-api -f

# If running in Docker
docker logs -f assistant-api

# If running in tmux/screen
# Attach to the session
```

### Cloudflare Tunnel Logs

```bash
# Systemd service
journalctl -u cloudflared -f

# Check tunnel status
cloudflared tunnel info <tunnel-name>
```

---

## Updating the Site

To deploy updates:

```powershell
# 1. Make your changes in apps/portfolio-ui/

# 2. Rebuild
npm run build:portfolio

# 3. Deploy
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root
```

**Zero-downtime deployment:** The rsync `--delete` flag ensures old files are removed, and nginx reload is graceful (no dropped connections).

---

## Rollback Procedure

If something goes wrong:

```bash
# Option 1: Re-deploy previous build
# (Keep old dist-portfolio as dist-portfolio.backup)
rsync -avz --delete dist-portfolio.backup/ user@server:/var/www/portfolio/

# Option 2: Restore nginx config
ssh user@server
sudo cp /etc/nginx/sites-available/assistant.conf.bak /etc/nginx/sites-available/assistant.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## Security Notes

### Current Setup
- ✅ HTTPS handled by Cloudflare (TLS termination)
- ✅ Backend not exposed publicly (127.0.0.1 only)
- ✅ Nginx proxies requests securely
- ✅ Same-origin policy (no CORS vulnerabilities)

### Recommendations
1. **Firewall:** Ensure only Cloudflare IPs can reach your server
2. **Backend auth:** Add authentication to sensitive endpoints
3. **Rate limiting:** Consider nginx rate limiting for `/chat` endpoints
4. **Monitoring:** Set up alerts for 502 errors (backend down)

---

## Next Steps

After successful deployment:

1. ✅ **Test all features** in production
2. ✅ **Monitor logs** for errors
3. ✅ **Set up alerts** (Cloudflare, UptimeRobot, etc.)
4. ✅ **Update DNS** if needed (should already be configured)
5. ✅ **Document** any custom configurations

---

## Quick Reference

### Deploy Command
```powershell
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root
```

### Test URLs
- Homepage: `https://assistant.ledger-mind.org`
- Resume: `https://assistant.ledger-mind.org/resume/Leo_Klemet_Resume.pdf`
- API Health: `https://assistant.ledger-mind.org/api/ready`

### Important Files
- **Build output:** `dist-portfolio/`
- **Nginx config:** `deploy/nginx.assistant-server.conf`
- **Deploy script:** `deploy/deploy-to-server.ps1`
- **Environment:** `apps/portfolio-ui/.env.production`

### Server Paths
- **Static files:** `/var/www/portfolio/`
- **Nginx config:** `/etc/nginx/sites-available/assistant.conf`
- **Nginx enabled:** `/etc/nginx/sites-enabled/assistant.conf`
- **Logs:** `/var/log/nginx/assistant-*.log`

---

**Ready to deploy!** 🚀
