# Cloudflare Tunnel Setup for Portfolio

## Current Status

- **Existing Tunnel**: `ai-finance-agent-oss-clean-cloudflared-1` (healthy, 4 edge connections)
- **Current Domain**: Routing ai-finance-agent project
- **Target Domain**: `assistant.ledger-mind.org`
- **Local Service**: nginx on port 8080 (127.0.0.1:8080)

## Option 1: Reconfigure Existing Tunnel (Recommended)

This approach reuses the existing healthy tunnel and adds routing for the portfolio site.

### Steps

1. **Access Cloudflare Zero Trust Dashboard**
   - Go to: https://one.dash.cloudflare.com/
   - Navigate to: **Networks** → **Tunnels**
   - Find your existing tunnel (should be named something like `ai-finance-agent-oss`)

2. **Add Public Hostname**
   - Click on the tunnel name
   - Go to **Public Hostname** tab
   - Click **Add a public hostname**
   - Configure:
     - **Subdomain**: `assistant`
     - **Domain**: `ledger-mind.org`
     - **Service**: `http://ai-finance-agent-oss-clean-nginx-1:80`
       - (This routes to the other project's nginx which proxies to our nginx on port 80)
     - OR if you want direct routing:
     - **Service**: `http://deploy-nginx-1:80`
       - (This routes directly to our nginx)

3. **Test the Configuration**
   ```powershell
   # Test from outside your network or use:
   curl https://assistant.ledger-mind.org/ready

   # Should return: {"ok":true,...}
   ```

### Network Configuration

The tunnel needs to access your nginx container. Options:

**A. Route through existing nginx** (easiest):
- Service: `http://ai-finance-agent-oss-clean-nginx-1:80`
- Requires adding proxy config to ai-finance-agent nginx

**B. Connect tunnel to deploy network**:
```powershell
# Connect the existing tunnel to your deploy network
docker network connect deploy_default ai-finance-agent-oss-clean-cloudflared-1

# Then use service: http://deploy-nginx-1:80
```

## Option 2: Create Dedicated Tunnel

If you prefer a separate tunnel for this project:

### 1. Create New Tunnel in Cloudflare Dashboard

1. Go to **Networks** → **Tunnels**
2. Click **Create a tunnel**
3. Choose **Cloudflared**
4. Name it: `leo-portfolio`
5. Save the tunnel token (you'll need this)

### 2. Update docker-compose.cloudflared.yml

```yaml
version: "3.9"
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: ["tunnel","run","--no-autoupdate","--token","${CLOUDFLARE_TUNNEL_TOKEN:?missing}"]
    restart: unless-stopped
    depends_on:
      - nginx
    networks:
      - default
    environment:
      - TUNNEL_LOGLEVEL=warn
```

### 3. Set the Token

Create a `.env` file in the root directory:

```bash
# .env
CLOUDFLARE_TUNNEL_TOKEN=your_tunnel_token_here
```

**IMPORTANT**: Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

### 4. Configure Public Hostname

In Cloudflare Dashboard:
- **Subdomain**: `assistant`
- **Domain**: `ledger-mind.org`
- **Service**: `http://nginx:80`

### 5. Start the Tunnel

```powershell
cd d:\leo-portfolio

# Start nginx + backend + tunnel
docker compose `
  -f deploy/docker-compose.yml `
  -f deploy/docker-compose.shared-ollama.yml `
  -f docker-compose.cloudflared.yml `
  up -d
```

### 6. Test

```powershell
# Wait 30 seconds for tunnel to establish
Start-Sleep -Seconds 30

# Test public URL
curl https://assistant.ledger-mind.org/ready

# Test frontend
curl https://assistant.ledger-mind.org/
```

## Option 3: Nginx Proxy Chain (Simplest for Now)

Use the existing tunnel and nginx from ai-finance-agent, just add a proxy rule.

### 1. Find ai-finance-agent nginx config

```powershell
# Check where the nginx config is
docker exec ai-finance-agent-oss-clean-nginx-1 cat /etc/nginx/conf.d/default.conf
```

### 2. Add proxy rule for assistant.ledger-mind.org

You'll need to add a new `server` block to the ai-finance-agent nginx config:

```nginx
server {
    listen 80;
    server_name assistant.ledger-mind.org;

    location / {
        proxy_pass http://deploy-nginx-1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Connect the networks

```powershell
# Connect ai-finance nginx to deploy network
docker network connect deploy_default ai-finance-agent-oss-clean-nginx-1

# Reload nginx
docker exec ai-finance-agent-oss-clean-nginx-1 nginx -s reload
```

## Recommended Approach

For quickest setup: **Option 1A (Route through existing tunnel + existing nginx)**

1. Connect networks:
   ```powershell
   docker network connect deploy_default ai-finance-agent-oss-clean-nginx-1
   docker network connect deploy_default ai-finance-agent-oss-clean-cloudflared-1
   ```

2. Add public hostname in Cloudflare Dashboard:
   - Service: `http://deploy-nginx-1:80`

3. Test:
   ```powershell
   curl https://assistant.ledger-mind.org/ready
   ```

## Troubleshooting

### Tunnel shows connected but site unreachable

```powershell
# Check tunnel logs
docker logs ai-finance-agent-oss-clean-cloudflared-1 --tail=50

# Check if nginx is accessible from tunnel
docker exec ai-finance-agent-oss-clean-cloudflared-1 wget -O- http://deploy-nginx-1:80/ready
```

### 502 Bad Gateway

```powershell
# Check if containers can communicate
docker exec ai-finance-agent-oss-clean-cloudflared-1 ping deploy-nginx-1

# Check nginx logs
docker logs deploy-nginx-1 --tail=50
```

### DNS not resolving

- Wait 5-10 minutes for DNS propagation
- Clear browser DNS cache (chrome://net-internals/#dns)
- Try incognito/private browsing

## Security Notes

- Tunnel token is sensitive - never commit to git
- Use `.env` files for secrets
- Cloudflare Tunnel provides automatic TLS/SSL
- No need to open firewall ports (tunnel is outbound-only)

## Monitoring

```powershell
# Check tunnel status
docker ps --filter name=cloudflared

# Check tunnel metrics (if exposed)
curl http://localhost:2000/metrics

# Check all services
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.shared-ollama.yml ps
```
