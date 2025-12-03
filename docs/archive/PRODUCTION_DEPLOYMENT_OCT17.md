# Portfolio v0.4.0 - Production Deployment Complete ✅

**Deployed**: October 17, 2025
**Live URL**: https://www.leoklemet.com/
**Hash**: `main-D0fKNExd.js`
**Status**: ✅ 200 OK

---

## Deployment Summary

✅ **Container Updated**: portfolio-ui now running v0.4.0
✅ **Cache Purged**: Cloudflare cache cleared
✅ **Site Live**: New hash verified at https://www.leoklemet.com/
✅ **Auto-Updates**: Watchtower monitoring for future deployments

---

## Infrastructure

- **Server**: Windows + Docker Desktop (C:\Users\pierr\leo-portfolio)
- **Container**: portfolio-ui at 172.23.0.3 (healthy)
- **Routing**: Cloudflare Tunnel → Direct IP (172.23.0.3:80)
- **Watchtower**: Enabled, 60-second polling interval

---

## Key Changes

1. Removed port 80 binding from docker-compose (fixed conflict)
2. Recreated portfolio-ui container with latest image
3. Updated Cloudflare tunnel to route to portfolio-ui IP
4. Purged Cloudflare cache to propagate changes

---

## Known Issues

⚠️ **applylens-nginx-prod crash loop** (non-critical)
- Error: Missing "api" upstream in nginx config
- Workaround: Using direct IP routing to portfolio-ui
- Fix needed: Start missing container or update nginx config

---

## Testing Auto-Updates

```bash
# Push change to trigger auto-deployment
git commit -m "test: automated deployment"
git push origin main

# Watch watchtower on server
docker logs -f watchtower
```

---

**Deployment Complete** - Portfolio v0.4.0 is live! 🎉
