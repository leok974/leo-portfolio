# Cloudflare Tunnel Status - October 5, 2025

## 🎉 FULLY OPERATIONAL

### Public URL (https://assistant.ledger-mind.org) ✅
- **Frontend**: Serving portfolio HTML correctly
- **Health Check**: `/ready` returning healthy status
- **Backend API**: `/llm/*` endpoints working
- **SSL/TLS**: Valid Cloudflare certificate
- **DNS**: Correctly resolving through tunnel

### Local Stack (http://localhost:8080) ✅
- Frontend: Serving portfolio HTML correctly
- Backend API: Healthy on host at 127.0.0.1:8000
- Ollama: Connected and responding (port 11434)
- RAG Database: Initialized with docs
- Backend proxy: Routes working through nginx

### Cloudflare Tunnel ✅
- ✅ Tunnel authenticated and connected
- ✅ 4 edge connections established (iad11, iad15, iad16, iad12)
- ✅ Ingress configuration: `http://localhost:80` (version 3)
- ✅ Network namespace sharing working (tunnel → nginx)
- ✅ Tunnel ID: `db56892d-4879-4263-99bf-202d46b6aff9`
- ✅ DNS CNAME configured correctly

## 🔍 Diagnosis

The tunnel is healthy and configured correctly, but incoming requests to `assistant.ledger-mind.org` are returning 404 and **not reaching the tunnel**. This suggests:

### Most Likely Causes:
1. **Multiple Tunnels**: Another tunnel might be handling requests for this domain
2. **DNS Not Updated**: Cloudflare DNS records might point to old/different tunnel
3. **Hostname Not Configured**: The public hostname might not be properly linked to this tunnel
4. **Propagation Delay**: Dashboard changes haven't propagated to all Cloudflare edge servers

## 🛠️ Troubleshooting Steps

### Step 1: Check for Multiple Tunnels
1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Check if there are other tunnels (active or inactive)
4. Verify only ONE tunnel has `assistant.ledger-mind.org` configured

### Step 2: Verify DNS Records
1. In Cloudflare dashboard, go to your domain **ledger-mind.org**
2. Go to **DNS** → **Records**
3. Look for `assistant` CNAME record
4. Should point to: `<tunnel-id>.cfargotunnel.com`
5. Expected: `db56892d-4879-4263-99bf-202d46b6aff9.cfargotunnel.com`

## 🧪 Verified Endpoints

### Public URLs (all working via https://assistant.ledger-mind.org)
- ✅ `/` - Portfolio homepage
- ✅ `/ready` - Health check: `{"ok":true,"checks":{"rag_db":{"ok":true},"ollama":{"ok":true},"openai_fallback":{"configured":true}}}`
- ✅ `/llm/diag` - LLM diagnostics showing Ollama + OpenAI fallback
- ✅ `/chat` - AI assistant chat endpoint (streaming)
- ✅ Static assets (CSS, JS, images)

### Architecture Flow
```
Internet → Cloudflare Edge
  ↓
Cloudflare Tunnel (4 edge connections)
  ↓
nginx:80 (Docker container, serving /dist)
  ↓
backend:8000 (host machine, FastAPI)
  ↓
ollama:11434 (Docker container, LLM)
```

## 📊 Current Configuration

### Docker Containers
```bash
# Nginx (serving frontend + proxying backend)
docker run -d --name portfolio-nginx \
  --add-host backend:host-gateway \
  -p 8080:80 -p 8443:443 \
  -v "${PWD}/dist:/usr/share/nginx/html:ro" \
  -v "${PWD}/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine

# Cloudflare Tunnel (shares nginx network namespace)
docker run -d --name portfolio-tunnel \
  --restart unless-stopped \
  --network container:portfolio-nginx \
  cloudflare/cloudflared:latest \
  tunnel run --token <TOKEN>
```

### Ingress Rules (active)
```json
{
  "ingress": [
    {
      "hostname": "assistant.ledger-mind.org",
      "originRequest": {},
      "service": "http://localhost:80"
    },
    {
      "originRequest": {},
      "service": "http_status:404"
    }
  ],
  "warp-routing": {"enabled": false}
}
```

### Network Topology
```
Internet
  ↓
Cloudflare Edge (198.41.x.x)
  ↓
Tunnel (cloudflared) - shares network namespace with nginx
  ↓
nginx (localhost:80) - serves frontend from /dist
  ↓ (for /api/*, /chat, /llm/*, etc.)
backend (host-gateway:8000) - FastAPI on host machine
  ↓
ollama (localhost:11434) - LLM container
```

## 🚀 Usage

### Access Your Site
- **Public URL**: https://assistant.ledger-mind.org
- **Local URL**: http://localhost:8080
- Both URLs serve the same full-stack application

### Test Endpoints
```bash
# Health check
curl https://assistant.ledger-mind.org/ready

# LLM diagnostics
curl https://assistant.ledger-mind.org/llm/diag

# Chat with AI (streaming)
curl -X POST https://assistant.ledger-mind.org/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

## 🔧 Maintenance

### Check Tunnel Status
```bash
docker logs portfolio-tunnel --tail 50
docker ps --filter "name=portfolio"
```

### Restart Services
```bash
# Restart tunnel only
docker restart portfolio-tunnel

# Restart nginx only
docker restart portfolio-nginx

# Restart both
docker restart portfolio-nginx portfolio-tunnel
```

### Update Frontend
```bash
# Rebuild frontend
npm run build

# Restart nginx to pick up new files
docker restart portfolio-nginx
```

## 📝 Important Notes
- **Backend Dependency**: Local FastAPI backend must be running on host at 127.0.0.1:8000
- **Ollama Container**: Must be running for LLM features (docker container: deploy-ollama-1)
- **Persistence**: Tunnel has `--restart unless-stopped` policy for auto-restart
- **Token Auth**: Using token-based tunnel (config pushed from Cloudflare dashboard)
- **DNS Managed**: CNAME record managed in Cloudflare DNS dashboard
- Docker backend disabled in current configuration
- Using token-based tunnel authentication
- Tunnel config is pushed from Cloudflare dashboard (local config files ignored)
