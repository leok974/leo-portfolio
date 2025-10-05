# Fix Cloudflare Tunnel Ingress Configuration

## Problem
The tunnel is connecting successfully but returning 404 because the ingress configuration points to `http://nginx:80` instead of `http://localhost:80`.

Since the tunnel container uses `--network container:portfolio-nginx`, it shares the nginx container's network namespace, where nginx is accessible at `localhost:80`, not `nginx:80`.

## Solution
Update the ingress configuration in the Cloudflare Zero Trust Dashboard:

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Find your tunnel (ID: `db56892d-4879-4263-99bf-202d46b6aff9`)
4. Click **Configure**
5. Under **Public Hostname** rules:
   - Find the rule for `assistant.ledger-mind.org`
   - Change **Service** from `http://nginx:80` to `http://localhost:80`
   - Click **Save**

## Verification
After updating, wait ~30 seconds for the tunnel to receive the new config, then test:

```powershell
curl https://assistant.ledger-mind.org/
```

Should return the portfolio HTML (not 404).

## Current Status
- ✅ Tunnel connected (4 edge connections active)
- ✅ Local site working at http://localhost:8080
- ✅ Backend healthy on host at 127.0.0.1:8000
- ❌ Public URL returning timeout/404 due to ingress misconfiguration

## Alternative (if dashboard access unavailable)
If you don't have access to the Cloudflare dashboard, you would need to:
1. Create a new tunnel with `cloudflared tunnel create portfolio`
2. Use cert-based authentication instead of token
3. Provide your own `config.yml` file with correct ingress rules
