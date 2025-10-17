# Deploy Portfolio to assistant.ledger-mind.org

## ✅ Build Complete

Your portfolio is built and ready to deploy:
- **Location:** `D:\leo-portfolio\dist-portfolio\`
- **Target Domain:** `https://assistant.ledger-mind.org`
- **Build Date:** October 14, 2025

## 🚀 Deployment Options

### Option A: Cloudflare Pages (Recommended - Easiest)

Cloudflare Pages provides global CDN hosting with automatic HTTPS.

**Steps:**

1. **Open Cloudflare Dashboard**
   ```
   https://dash.cloudflare.com/
   ```

2. **Navigate to Pages**
   - In the left sidebar, click **"Workers & Pages"**
   - Click **"Create application"**
   - Select **"Upload assets"**

3. **Upload Your Built Files**
   - **Project name:** `leo-portfolio` or `assistant-portfolio`
   - **Drag and drop:** The entire `dist-portfolio` folder
   - Or click **"Select from computer"** and choose:
     ```
     D:\leo-portfolio\dist-portfolio\
     ```

4. **Configure Custom Domain**
   - After deployment, go to your project settings
   - Click **"Custom domains"**
   - Click **"Set up a custom domain"**
   - Enter: `assistant.ledger-mind.org`
   - Cloudflare will automatically configure DNS

5. **Verify Deployment**
   ```
   https://assistant.ledger-mind.org
   ```

---

### Option B: Deploy to Your Own Server

If you have a VPS/server behind Cloudflare Tunnel:

**1. Upload Files via SCP**
```bash
scp -r dist-portfolio/* user@your-server:/var/www/portfolio/
```

**2. Deploy Nginx Configuration**
```bash
# Copy nginx config
scp deploy/nginx.portfolio.conf user@your-server:/etc/nginx/sites-available/portfolio.conf

# SSH into server
ssh user@your-server

# Enable the site
sudo ln -s /etc/nginx/sites-available/portfolio.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

**3. Configure SSL (if not already done)**
```bash
# Using certbot for Let's Encrypt
sudo certbot --nginx -d assistant.ledger-mind.org
```

**4. Update Nginx Config SSL Paths**

Edit `/etc/nginx/sites-available/portfolio.conf` and uncomment:
```nginx
ssl_certificate /etc/letsencrypt/live/assistant.ledger-mind.org/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/assistant.ledger-mind.org/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

Then reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

### Option C: Docker Deployment (If Server Has Docker)

**1. Build the Nginx Image**
```bash
cd d:\leo-portfolio
docker build -f deploy/Dockerfile.frontend -t leo-portfolio-frontend .
```

**2. Run Container**
```bash
docker run -d \
  --name portfolio \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  leo-portfolio-frontend
```

---

## 📋 Post-Deployment Checklist

After deploying, verify everything works:

### 1. Test Homepage
```bash
curl -I https://assistant.ledger-mind.org
# Expected: HTTP/2 200
```

### 2. Test Resume PDF
```bash
curl -I https://assistant.ledger-mind.org/resume/Leo_Klemet_Resume.pdf
# Expected: Content-Type: application/pdf
```

### 3. Test API Proxy (if backend is running)
```bash
curl -s https://assistant.ledger-mind.org/api/ready
# Expected: {"status":"ready"}
```

### 4. Browser Tests
Open in browser: `https://assistant.ledger-mind.org`

- [ ] Page loads without errors
- [ ] All assets load (check Network tab - no 404s)
- [ ] Calendly widget displays correctly
- [ ] Resume buttons work:
  - **View Resume (PDF)** opens PDF
  - **Copy for LinkedIn** copies text
- [ ] Assistant chat opens and works
- [ ] Navigation works (About, Projects, Contact)

---

## 🔧 Troubleshooting

### Issue: 404 on Assets

**Problem:** CSS/JS files return 404

**Solution:** Check nginx configuration has asset rules:
```nginx
location ^~ /assets/ {
  try_files $uri =404;
  expires 30d;
  add_header Cache-Control "public, immutable";
}
```

### Issue: Resume PDF Opens Homepage

**Problem:** `/resume/Leo_Klemet_Resume.pdf` returns HTML

**Solution:** Ensure `/resume/` location block is BEFORE SPA fallback:
```nginx
# This should be BEFORE the catch-all location /
location /resume/ {
  proxy_pass https://assistant.ledger-mind.org/resume/;
  # ... or serve static file if in dist-portfolio/resume/
}
```

### Issue: CORS Errors on API Calls

**Problem:** Browser shows CORS errors when calling `/api/chat`

**Solution:** Verify `VITE_AGENT_API_BASE` is empty (same-origin):
```bash
# In .env.production
VITE_AGENT_API_BASE=
```

Then rebuild:
```bash
npm run build:portfolio
```

### Issue: Calendly Widget Clipped

**Problem:** Booking calendar appears cut off

**Solution:** Already fixed in build (height: 760px, overflow: visible)

If still issues, check for CSS overrides in browser DevTools.

---

## 🌐 Cloudflare Configuration

### DNS Settings

For **assistant.ledger-mind.org**:

**If using Cloudflare Pages:**
- DNS is auto-configured when you add custom domain
- Should show CNAME record pointing to Pages

**If using Cloudflare Tunnel:**
- Should have CNAME record pointing to tunnel hostname
- Example: `assistant.ledger-mind.org CNAME xxx.cfargotunnel.com`

### Cache Rules

Recommended Cloudflare Page Rules:

1. **API Endpoints (No Cache)**
   ```
   assistant.ledger-mind.org/api/*
   assistant.ledger-mind.org/chat/*
   assistant.ledger-mind.org/resume/*

   Settings:
   - Cache Level: Bypass
   ```

2. **Static Assets (Cache Everything)**
   ```
   assistant.ledger-mind.org/assets/*

   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: 1 month
   ```

---

## 📦 What Was Built

Your `dist-portfolio` folder contains:

```
dist-portfolio/
├── index.html              # Main page (14 KB)
├── assets/
│   ├── main-*.css         # Styles (11.74 KB)
│   ├── main-*.js          # JavaScript (26.26 KB)
│   └── [images]           # Project images
├── resume/
│   └── Leo_Klemet_Resume.pdf
├── projects.json          # Project data
├── favicon.svg           # Site icon
├── og.png                # Social preview image
└── og.svg                # Social preview SVG
```

**Total Size:** ~170 KB (very lightweight!)

---

## ✅ Environment Configuration

The build used production environment variables:

```bash
VITE_SITE_ORIGIN=https://assistant.ledger-mind.org
VITE_AGENT_API_BASE=                           # Empty = same-origin (no CORS)
VITE_CALENDLY_URL=https://calendly.com/leoklemet-pa
VITE_LAYOUT_ENABLED=1
VITE_ALLOW_DEV_ADMIN=0
```

This ensures:
- ✅ All API calls go through same-origin proxy (no CORS issues)
- ✅ Correct Calendly URL
- ✅ Production security settings

---

## 🎯 Next Steps

1. **Choose deployment method** (Option A recommended)
2. **Deploy the built files**
3. **Configure custom domain** (if using Cloudflare Pages)
4. **Run post-deployment tests**
5. **Verify everything works in browser**

---

## 📞 Support

If you encounter issues:

1. Check browser console for errors (F12)
2. Check Network tab for failed requests
3. Verify nginx configuration (if self-hosting)
4. Check Cloudflare DNS settings
5. Ensure backend API is running (if using assistant features)

---

**Build created:** October 14, 2025
**Target domain:** https://assistant.ledger-mind.org
**Ready to deploy!** 🚀
