# SiteAgent vhost Fix - October 11, 2025

## Problem

Public `https://siteagents.app/` was serving **LedgerMind** content instead of **SiteAgent UI**.

### Root Cause

**Docker network alias conflict**: Both `portfolio-nginx-1` (SiteAgent UI) and `ai-finance-nginx-1` (LedgerMind) had the `siteagent-ui.int` alias on the `infra_net` network.

When Cloudflare tunnel tried to reach `http://siteagent-ui.int:80`, Docker DNS was resolving to **ai-finance-nginx** (LedgerMind) instead of **portfolio-nginx** (SiteAgent).

### Discovery

```bash
# Found duplicate alias
$ docker ps --format "{{.Names}}" | ForEach-Object {
    $name = $_;
    $aliases = docker inspect $name --format '{{range $net, $conf := .NetworkSettings.Networks}}{{range $conf.Aliases}}{{.}} {{end}}{{end}}' 2>$null;
    if ($aliases -like "*siteagent-ui.int*") {
        Write-Host "$name : $aliases"
    }
}

# Output:
portfolio-nginx-1 : portfolio-nginx-1 nginx siteagent-ui.int portfolio.int
ai-finance-nginx-1 : ai-finance-nginx-1 nginx siteagent-ui.int ai-finance.int  # ← CONFLICT!
```

Testing confirmed wrong content:
```bash
$ docker exec ai-finance-nginx-1 wget -qO- --header="Host: siteagents.app" http://siteagent-ui.int/ | grep title
<title>LedgerMind</title>  # ← WRONG!
```

## Solution

### 1. Remove conflicting alias

**File**: `c:\ai-finance-agent-oss-clean\docker-compose.yml`

**BEFORE** (lines 110-116):
```yaml
    networks:
      default:
      infra_net:
        aliases:
          - ai-finance.int          # LedgerMind UI (existing)
          - siteagent-ui.int        # SiteAgent UI (added Oct 11, 2025) ← REMOVED
```

**AFTER**:
```yaml
    networks:
      default:
      infra_net:
        aliases:
          - ai-finance.int          # LedgerMind UI (existing)
```

**Diff**:
```diff
     networks:
       default:
       infra_net:
         aliases:
           - ai-finance.int
-          - siteagent-ui.int
```

### 2. Restart ai-finance nginx

```powershell
cd C:\ai-finance-agent-oss-clean
docker compose stop nginx
docker compose rm -f nginx
docker compose up -d nginx
```

**Result**:
```bash
$ docker inspect ai-finance-nginx-1 --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}: {{range $conf.Aliases}}{{.}} {{end}}{{end}}'

# Output:
infra_net: ai-finance-nginx-1 nginx ai-finance.int  # ✅ siteagent-ui.int GONE
```

### 3. Verify fix

```bash
$ docker exec ai-finance-nginx-1 wget -qO- --header="Host: siteagents.app" http://siteagent-ui.int/ | grep title

# Output:
<title>SiteAgent — Your AI Site Assistant</title>  # ✅ CORRECT!
```

## Cloudflare Configuration

**DNS Records** (already correct, no changes):
- `siteagents.app` → CNAME to tunnel (proxied ☁️)
- `www.siteagents.app` → CNAME to tunnel (proxied ☁️)
- `api.siteagents.app` → CNAME to tunnel (proxied ☁️)
- `agent.siteagents.app` → CNAME to tunnel (proxied ☁️)

**Tunnel Routes** (already correct):
```json
{
  "siteagents.app": "http://siteagent-ui.int:80",
  "www.siteagents.app": "http://siteagent-ui.int:80",
  "api.siteagents.app": "http://siteagent-api.int:8000",
  "agent.siteagents.app": "http://siteagent-api.int:8000"
}
```

## Nginx Configuration

**Portfolio nginx** (`portfolio-nginx-1`) at `siteagent-ui.int`:

**File**: Mounted at `/etc/nginx/conf.d/default.conf` (from `deploy/nginx.siteagent.conf`)

**Server block**:
```nginx
server {
  listen 80;
  server_name _;  # Catch-all (fine for single-purpose container)

  root /usr/share/nginx/html;
  index index.html;

  # Security headers
  add_header X-Config "v4-siteagent" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

  # CSP for SiteAgent (brand-correct)
  set $csp_policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.siteagents.app https://agent.siteagents.app; font-src 'self' data:; frame-ancestors 'none'; upgrade-insecure-requests;";
  add_header Content-Security-Policy "$csp_policy" always;

  # SPA routing
  location / {
    add_header Cache-Control "no-cache" always;
    try_files $uri $uri/ /index.html;
  }

  # Static assets (long cache)
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }
}
```

**CORS map** (for backend):
```nginx
map $http_origin $cors_ok {
  default 0;
  '~^https://siteagents\.app$' 1;
  '~^https://www\.siteagents\.app$' 1;
}
```

## Verification (Public Smoke Tests)

### 1. Headers ✅
```bash
$ curl -k -I https://siteagents.app/ | head -15

HTTP/1.1 200 OK
Date: Sun, 12 Oct 2025 01:03:29 GMT
Content-Type: text/html
Connection: keep-alive
Cache-Control: no-cache
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.siteagents.app https://agent.siteagents.app; font-src 'self' data:; frame-ancestors 'none'; upgrade-insecure-requests;
X-Config: v4-siteagent
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Server: cloudflare
```

✅ **CSP** points to `https://api.siteagents.app` (brand-correct)
✅ **X-Config** shows `v4-siteagent`
✅ Security headers present

### 2. Content ✅
```bash
$ curl -k -s https://siteagents.app/ | grep -E 'SiteAgent|LedgerMind' | head -5

<title>SiteAgent — Your AI Site Assistant</title>
<meta name="description" content="SiteAgent: Intelligent AI assistant for website management..." />
<link rel="canonical" href="https://siteagents.app/" />
<meta property="og:title" content="SiteAgent — Your AI Site Assistant" />
<meta property="og:url" content="https://siteagents.app/" />
```

✅ Shows **SiteAgent** content
✅ **NO** "LedgerMind" mentions

### 3. API Health ✅
```bash
$ curl -k https://api.siteagents.app/ready

{"ok":true,"db":{"ok":true,"error":null},"migrations":{"ok":true,"current":"20251005_mch_unique_idx","head":"20251005_mch_unique_idx","error":null}}
```

✅ API responds with `200 OK`

### 4. CORS Preflight ✅
```bash
$ curl -k -I https://api.siteagents.app/chat -H "Origin: https://siteagents.app" -H "Access-Control-Request-Method: POST" | grep access-control

access-control-allow-credentials: true
access-control-allow-origin: https://siteagents.app
access-control-expose-headers: Content-Disposition
```

✅ CORS returns correct origin

### 5. Static Files ✅
```bash
$ curl -k -I https://siteagents.app/robots.txt
HTTP/1.1 200 OK

$ curl -k -I https://siteagents.app/sitemap.xml
HTTP/1.1 200 OK
```

✅ Both files accessible

## Summary

### Before
- `siteagents.app` → Cloudflare tunnel → `siteagent-ui.int` → **ai-finance-nginx** (LedgerMind) ❌
- Public site showed: `<title>LedgerMind</title>`

### After
- `siteagents.app` → Cloudflare tunnel → `siteagent-ui.int` → **portfolio-nginx** (SiteAgent) ✅
- Public site shows: `<title>SiteAgent — Your AI Site Assistant</title>`

### Changes Made
1. **Removed** `siteagent-ui.int` alias from `ai-finance-nginx-1` (LedgerMind)
2. **Restarted** ai-finance nginx to apply alias removal
3. **Verified** `siteagent-ui.int` now uniquely resolves to `portfolio-nginx-1` (SiteAgent)

### No Changes Needed
- ✅ DNS records (already correct CNAMEs to tunnel)
- ✅ Cloudflare tunnel routes (already correct)
- ✅ Nginx config (`deploy/nginx.siteagent.conf` already brand-correct)
- ✅ SiteAgent UI build (already compiled with correct env vars)

## Network Topology

```
Cloudflare Edge
    │
    └─→ Tunnel (applylens)
            │
            ├─→ siteagents.app ──→ infra_net:siteagent-ui.int ──→ portfolio-nginx-1 ──→ /usr/share/nginx/html (SiteAgent UI)
            │
            ├─→ api.siteagents.app ──→ infra_net:siteagent-api.int ──→ portfolio-backend-1:8000 (FastAPI)
            │
            └─→ ai-finance.int ──→ infra_net:ai-finance.int ──→ ai-finance-nginx-1 ──→ (LedgerMind UI)
```

## Aliases After Fix

### portfolio-nginx-1 (SiteAgent)
```
infra_net:
  - portfolio-nginx-1
  - nginx
  - siteagent-ui.int  ← Unique now!
  - portfolio.int
```

### ai-finance-nginx-1 (LedgerMind)
```
infra_net:
  - ai-finance-nginx-1
  - nginx
  - ai-finance.int    ← No conflict
```

## Conclusion

✅ **Issue resolved**: Public `https://siteagents.app/` now correctly serves **SiteAgent UI**
✅ **No LedgerMind leakage**: Content and branding are brand-correct
✅ **CSP correct**: Points to `https://api.siteagents.app`
✅ **CORS working**: API allows `https://siteagents.app` origin
✅ **All smoke tests pass**

The fix was simple: **remove the duplicate network alias** that was causing Docker DNS to resolve `siteagent-ui.int` to the wrong container.
