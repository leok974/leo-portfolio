# leoklemet.com Quick Reference Card

## ✅ What's Done

1. ✅ **Nginx routing** - Static + dynamic backend split
2. ✅ **WWW redirect** - leoklemet.com → www.leoklemet.com
3. ✅ **Backend env** - Cookie domain + base URL configured
4. ✅ **Dev overlay** - HMAC-signed authentication endpoints
5. ✅ **Frontend deployed** - Portfolio with dev overlay integration
6. ✅ **Cloudflare cache rules** - Bypass configured via API for /agent/*, /chat, /api/*
7. ✅ **Cache purged** - Dynamic paths cleared

## 🔧 What's Needed

### **1. Cloudflare DNS** (REQUIRED)
Add in leoklemet.com zone:
```
Type: A/CNAME | Name: www | Content: <your-server-ip> | Proxy: ON
Type: A/CNAME | Name: @   | Content: <your-server-ip> | Proxy: ON
```

### **2. Wait for Rule Propagation** (1-2 minutes)
Cache bypass rules take a moment to propagate across Cloudflare's network

## 🧪 Quick Tests

### Before DNS (via Host header):
```bash
curl -H "Host: www.leoklemet.com" https://assistant.ledger-mind.org/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}
```

### After DNS:
```bash
# Status (should return JSON, not HTML!)
curl -s https://www.leoklemet.com/agent/dev/status

# Enable dev overlay
curl -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable

# Apex redirect
curl -I https://leoklemet.com/
# Expected: 301 → https://www.leoklemet.com/
```

## 📁 Key Files

- **Nginx**: `/etc/nginx/conf.d/portfolio-leoklemet.com.conf`
- **Redirect**: `/etc/nginx/conf.d/redirect-leoklemet.com.conf`
- **Backend override**: `C:\ai-finance-agent-oss-clean\docker-compose.override.yml`

## 🔍 Troubleshooting

### Issue: JSON endpoints return HTML
**Fix**: Add Cloudflare cache bypass rules + purge cache

### Issue: Dev badge doesn't appear
**Check**:
1. Cookie set? `curl -i .../agent/dev/enable | grep Set-Cookie`
2. Browser cookies: DevTools → Application → Cookies → `sa_dev`

### Issue: 502 Bad Gateway
**Check**: `docker ps | grep backend` - Is container running?

## 📞 Support Commands

```bash
# Backend logs
docker logs ai-finance-backend-1 --tail 50

# Nginx logs
docker logs applylens-nginx-prod --tail 50

# Test backend directly (bypass nginx)
docker exec applylens-nginx-prod curl -s http://ai-finance-api.int:8000/agent/dev/status

# Restart backend
cd C:\ai-finance-agent-oss-clean && docker-compose restart backend
```

---
**Status**: Infrastructure ready → Configure DNS → Test endpoints → Go live! 🚀
