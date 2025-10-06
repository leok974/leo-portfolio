# ✅ QUICK START: Cloudflare Tunnel Configuration

## Current Status

🎉 **Network Setup Complete!**

The Cloudflare Tunnel container is now connected to your deployment network:

```
Network: deploy_default (172.19.0.0/16)
├─ deploy-nginx-1: 172.19.0.2 (your portfolio frontend + backend proxy)
├─ deploy-backend-1: 172.19.0.3 (FastAPI with GPT-OSS 20B)
└─ ai-finance-agent-oss-clean-cloudflared-1: 172.19.0.4 (Cloudflare Tunnel)
```

## Next Step: Configure Public Hostname

### 1. Access Cloudflare Zero Trust Dashboard

Go to: **https://one.dash.cloudflare.com/**

### 2. Navigate to Your Tunnel

1. Click **Networks** in the left sidebar
2. Click **Tunnels**
3. Find your existing tunnel (likely named `ai-finance-agent-oss` or similar)
4. Click on the tunnel name

### 3. Add Public Hostname for Portfolio

Click the **Public Hostname** tab, then **Add a public hostname**:

```
┌─────────────────────────────────────────────────────────┐
│ Add a public hostname                                   │
├─────────────────────────────────────────────────────────┤
│ Subdomain:  assistant                                   │
│ Domain:     ledger-mind.org                            │
│ Path:       (leave empty)                               │
├─────────────────────────────────────────────────────────┤
│ Service                                                  │
│ Type:       HTTP                                        │
│ URL:        deploy-nginx-1:80                          │
│                                                          │
│ ⚠️ Important: Use "deploy-nginx-1:80" (container name)  │
│    NOT "localhost:8080" or IP addresses                 │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ Use Docker container name: `deploy-nginx-1`
- ✅ Use internal port: `80` (not `8080`)
- ❌ Don't use `localhost` or `127.0.0.1`
- ❌ Don't use external ports

### 4. Save Configuration

Click **Save hostname**

The configuration will be automatically pushed to your running tunnel within seconds.

### 5. Test Public Access

Wait ~30 seconds for the configuration to propagate, then test:

```powershell
# Test backend health
curl https://assistant.ledger-mind.org/ready

# Expected response:
# {"ok":true,"checks":{"rag_db":{"ok":true},"ollama":{"ok":true},"openai_fallback":{"configured":true}}}

# Test frontend
curl https://assistant.ledger-mind.org/

# Expected: HTML content with "Leo Klemet" in title

# Test in browser
start https://assistant.ledger-mind.org
```

## Alternative Service URLs

If `deploy-nginx-1:80` doesn't work, try these alternatives:

### Option A: Use IP Address
```
URL: 172.19.0.2:80
```

### Option B: Use Full Container Name with Network
```
URL: http://deploy-nginx-1.deploy_default:80
```

### Option C: Route Through Existing Nginx

If you want to use the ai-finance-agent nginx as a reverse proxy:

1. In Cloudflare Dashboard, set:
   ```
   URL: ai-finance-agent-oss-clean-nginx-1:80
   ```

2. Add proxy config to ai-finance-agent nginx (requires editing that project's nginx config)

## Troubleshooting

### "502 Bad Gateway" Error

**Cause**: Tunnel can't reach nginx

**Solutions:**

1. **Verify network connection:**
   ```powershell
   docker network inspect deploy_default
   # Should show cloudflared container
   ```

2. **Check nginx is responding:**
   ```powershell
   curl http://localhost:8080/ready
   # Should return healthy JSON
   ```

3. **Try alternative service URL** (see options above)

### "Unable to reach origin" in Cloudflare Dashboard

**Cause**: Tunnel lost connection to nginx

**Solution:**
```powershell
# Restart tunnel
docker restart ai-finance-agent-oss-clean-cloudflared-1

# Wait 30 seconds
Start-Sleep -Seconds 30

# Check tunnel logs
docker logs ai-finance-agent-oss-clean-cloudflared-1 --tail=20
```

### DNS Not Resolving

**Cause**: DNS propagation delay

**Solution:**
- Wait 5-10 minutes
- Clear browser DNS: `chrome://net-internals/#dns` → Clear host cache
- Try incognito mode
- Test with `nslookup assistant.ledger-mind.org`

### Tunnel Shows "Healthy" but Site Unreachable

**Check:**

1. **Service URL is correct:**
   ```
   ✅ deploy-nginx-1:80
   ❌ deploy-nginx-1:8080
   ❌ localhost:8080
   ❌ 127.0.0.1:8080
   ```

2. **Containers can communicate:**
   ```powershell
   # From backend, test nginx
   docker exec deploy-backend-1 wget -O- http://deploy-nginx-1:80/ready
   ```

3. **Tunnel logs for errors:**
   ```powershell
   docker logs ai-finance-agent-oss-clean-cloudflared-1 | Select-String "error|ERR"
   ```

## Monitoring

### Check Tunnel Status

```powershell
# View tunnel connections
docker logs ai-finance-agent-oss-clean-cloudflared-1 --tail=10 | Select-String "Registered"

# Expected: 4 "Registered tunnel connection" messages

# Check all services
docker ps --filter "name=deploy-"
```

### View Tunnel Metrics

```powershell
# If metrics are exposed on port 2000
curl http://localhost:2000/metrics
```

### Test Full Stack

```powershell
# Test each layer
curl http://localhost:8080/ready              # Nginx → Backend
curl http://localhost:8000/ready              # Backend direct
curl https://assistant.ledger-mind.org/ready  # Public URL → Tunnel → Nginx → Backend
```

## Security Notes

- ✅ Tunnel provides automatic TLS/SSL (HTTPS)
- ✅ No firewall ports need to be opened
- ✅ Tunnel is outbound-only (more secure)
- ✅ Cloudflare DDoS protection included
- ⚠️ Backend runs as non-root user (UID 1001)
- ⚠️ CORS configured for allowed origins

## Success Criteria

When everything works:

```powershell
curl -I https://assistant.ledger-mind.org/ready

# Should show:
# HTTP/2 200
# content-type: application/json
# server: cloudflare
# ...

# And the body:
# {"ok":true,"checks":{...}}
```

---

## Summary

**What's Done:**
1. ✅ Network connected: tunnel ↔ nginx
2. ✅ Both containers on `deploy_default` network
3. ✅ Nginx serving frontend and proxying backend
4. ✅ Backend using GPT-OSS 20B local model

**What You Need to Do:**
1. 🔲 Add public hostname in Cloudflare Dashboard
   - Subdomain: `assistant`
   - Domain: `ledger-mind.org`
   - Service: `http://deploy-nginx-1:80`

2. 🔲 Test: `https://assistant.ledger-mind.org/ready`

**Estimated Time:** 2 minutes

Need the Cloudflare Dashboard link again? **https://one.dash.cloudflare.com/** → Networks → Tunnels
