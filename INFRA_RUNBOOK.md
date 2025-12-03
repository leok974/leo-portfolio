# Infrastructure Runbook

## Critical Rules

### Cloudflare Tunnel Architecture

**RULE**: All public domains route through **ONE shared Cloudflare Tunnel**.

- **Tunnel UUID**: `08d5feee-f504-47a2-a1f2-b86564900991`
- **Token Location**: `.env.cloudflare` → `CLOUDFLARE_TUNNEL_TOKEN`
- **Managed By**: Cloudflare Zero Trust Dashboard (not config files)

#### Active Domains Routing Through This Tunnel

| Domain                 | Target Service    | Network Alias Required   |
| ---------------------- | ----------------- | ------------------------ |
| `leoklemet.com`        | Portfolio site    | `portfolio.int:80`       |
| `www.leoklemet.com`    | Portfolio site    | `portfolio.int:80`       |
| `api.leoklemet.com`    | Portfolio backend | `portfolio-api.int:8000` |
| `applylens.app`        | ApplyLens site    | `applylens.int:80`       |
| `www.applylens.app`    | ApplyLens site    | `applylens.int:80`       |
| `api.applylens.app`    | ApplyLens API     | `applylens-api.int:8003` |
| `siteagents.app`       | SiteAgents UI     | `siteagent-ui.int:80`    |
| `www.siteagents.app`   | SiteAgents UI     | `siteagent-ui.int:80`    |
| `api.siteagents.app`   | SiteAgents API    | `siteagent-api.int:8000` |
| `agent.siteagents.app` | SiteAgents API    | `siteagent-api.int:8000` |

### Adding New Brands (TasteOS, EvalForge, etc.)

When launching a new brand:

1. **Join the shared network**: All stacks MUST connect to `infra_net`

   ```yaml
   services:
     your-nginx:
       networks:
         - default
         - infra_net
     your-backend:
       networks:
         - default
         - infra_net

   networks:
     infra_net:
       external: true
       name: infra_net
   ```

2. **Define network aliases** matching ingress expectations:

   ```yaml
   services:
     your-nginx:
       networks:
         infra_net:
           aliases:
             - yourbrand.int
     your-backend:
       networks:
         infra_net:
           aliases:
             - yourbrand-api.int
   ```

3. **Update Cloudflare dashboard** ingress rules:
   - Go to [Cloudflare Zero Trust → Tunnels](https://one.dash.cloudflare.com/)
   - Select tunnel `08d5feee-f504-47a2-a1f2-b86564900991`
   - Add Public Hostnames:
     - `yourbrand.com` → `http://yourbrand.int:80`
     - `www.yourbrand.com` → `http://yourbrand.int:80`
     - `api.yourbrand.com` → `http://yourbrand-api.int:8000`

4. **DO NOT** create a new tunnel or rotate the token without coordinating ALL services.

### Token Management

**Source of Truth**: `.env.cloudflare` in repo root

```bash
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiNDMzYzBhZWJkNTczNDMwMjc0NGZmYTk4MjgyMTk1NmUi...
```

**NEVER**:

- Hardcode the token in compose files
- Create per-project token copies
- Rotate without testing all dependent services
- Commit `.env.cloudflare` to git

**Token Rotation Process** (emergency only):

1. Generate new token in Cloudflare dashboard
2. Update `.env.cloudflare`
3. Restart cloudflared: `docker compose -f docker-compose.cloudflared.yml up -d`
4. Verify all domains: `curl -I https://www.leoklemet.com`, `curl -I https://applylens.app`, etc.
5. Monitor for 502 errors across ALL brands

### Deployment Checklist

Before deploying a new service:

- [ ] Service joins `infra_net` network
- [ ] Network aliases defined (`yourbrand.int`, `yourbrand-api.int`)
- [ ] Ingress rules added in Cloudflare dashboard
- [ ] DNS CNAME points to tunnel: `<tunnel-id>.cfargotunnel.com`
- [ ] Test with `curl -I https://yourbrand.com`
- [ ] Verify no 502 errors on existing brands

### Troubleshooting 502 Errors

**Symptom**: Domain returns 502 Bad Gateway

**Root Causes**:

1. **Wrong tunnel UUID**: Service using old/different tunnel token
   - Fix: Update compose file to use `CLOUDFLARE_TUNNEL_TOKEN` from `.env.cloudflare`

2. **Missing network alias**: Ingress rule points to alias that doesn't exist
   - Check: `docker inspect <container> --format '{{range $net, $config := .NetworkSettings.Networks}}{{$net}}: {{range $config.Aliases}}{{.}} {{end}}{{end}}'`
   - Fix: Add alias to compose file under `networks.infra_net.aliases`

3. **Service not on infra_net**: Container can't be reached by cloudflared
   - Check: `docker network inspect infra_net --format '{{range .Containers}}{{println .Name}}{{end}}'`
   - Fix: Add `infra_net` to service's `networks` list

4. **Tunnel disconnected**: Check cloudflared logs
   - `docker logs cloudflared | grep "Registered tunnel connection"`
   - Should see 4 connections: `connIndex=0`, `connIndex=1`, `connIndex=2`, `connIndex=3`

### Current Infrastructure Status

```bash
# Check tunnel is running
docker ps --filter "name=cloudflared"

# Verify connections
docker logs cloudflared 2>&1 | grep "Registered tunnel connection"

# Check network membership
docker network inspect infra_net --format '{{range .Containers}}{{println .Name}}{{end}}'

# Test domain routing
curl -I https://www.leoklemet.com
curl -I https://applylens.app
curl -I https://api.leoklemet.com/ready
```

Expected output:

- 4 registered tunnel connections
- All domains return HTTP 200 (or 301 redirects)
- No "Unauthorized: Invalid tunnel secret" errors

### Files to Check

- `docker-compose.cloudflared.yml` - Main tunnel container config
- `.env.cloudflare` - Tunnel token (gitignored, source of truth)
- `cloudflared/config.yml` - **DEPRECATED** (not used in token mode)
- Each service's compose file - Must include `infra_net` membership

### Emergency Contacts

If tunnel is down and affecting ALL brands:

1. Check Cloudflare status: https://www.cloudflarestatus.com/
2. Verify container is running: `docker ps | grep cloudflared`
3. Restart if needed: `docker compose -f docker-compose.cloudflared.yml restart`
4. Last resort: Rotate token (impacts all services simultaneously)

---

## How to (re)start cloudflared safely

**Problem**: Windows Docker Compose sometimes ignores `env_file` for long base64 tokens, causing silent fallback to stale/empty args. This leads to tunnel UUID mismatches and 502 errors.

**Solution**: Force the token into the process environment before launching. This guarantees the correct tunnel UUID every time.

### Step-by-Step Restart Procedure

```powershell
# 1. Load Tunnel Token into env in this shell
$env:CLOUDFLARE_TUNNEL_TOKEN = (Get-Content .env.cloudflare | Select-String '^CLOUDFLARE_TUNNEL_TOKEN=').Line -replace '^CLOUDFLARE_TUNNEL_TOKEN=',''

# 2. Relaunch cloudflared with correct env
docker compose -f docker-compose.cloudflared.yml down
docker compose -f docker-compose.cloudflared.yml up -d

# 3. Verify tunnel is healthy and pointing at the correct UUID
docker logs cloudflared 2>&1 | Select-String 'Starting tunnel|Registered tunnel'
```

### Expected Output

```
2025-10-30T18:26:24Z INF Starting tunnel tunnelID=08d5feee-f504-47a2-a1f2-b86564900991
2025-10-30T18:26:24Z INF Registered tunnel connection connIndex=0 connection=... protocol=quic
2025-10-30T18:26:25Z INF Registered tunnel connection connIndex=1 connection=... protocol=quic
2025-10-30T18:26:26Z INF Registered tunnel connection connIndex=2 connection=... protocol=quic
2025-10-30T18:26:27Z INF Registered tunnel connection connIndex=3 connection=... protocol=quic
```

**Expected tunnel UUID**: `08d5feee-f504-47a2-a1f2-b86564900991`

⚠️ **If you ever see `db56892d-*` here, that's WRONG** (old tunnel, do NOT use).

### Why This Matters

- **Windows-specific issue**: Docker Compose on Windows can fail to interpolate long base64 strings from `env_file`
- **Silent failures**: Without explicit env loading, container may start with empty `--token`, causing auth failures
- **Prevents regression**: Forces correct token to exist in shell environment at launch time
- **Executable runbook**: Not just documentation—actual commands you can copy/paste

### Verification Checklist

After restart, verify:

- [ ] Tunnel UUID matches `08d5feee-f504-47a2-a1f2-b86564900991`
- [ ] All 4 connections registered (connIndex 0-3)
- [ ] No "Unauthorized: Invalid tunnel secret" errors
- [ ] All domains return HTTP 200:
  ```powershell
  curl -I https://www.leoklemet.com
  curl -I https://leoklemet.com
  curl -I https://api.leoklemet.com/ready
  ```

If any domain returns 502, check:

1. Container is on `infra_net`: `docker network inspect infra_net`
2. Network alias exists: `docker inspect <container> --format '{{range $net, $config := .NetworkSettings.Networks}}{{$net}}: {{range $config.Aliases}}{{.}} {{end}}{{end}}'`
3. Cloudflare dashboard ingress rules match the aliases

---

## Self-Hosted GitHub Actions Runner (prod automations)

**Service name**: `gh-runner` (see `docker-compose.runner.yml`)

**Purpose**:

- Runs GitHub Actions jobs directly on the prod host
- Can call `docker compose`, restart containers, and run smoke checks
- Used by `.github/workflows/infra-smoke.yml` and other production workflows
- Labeled as: `self-hosted`, `prod`, `deploy`, `infra`

### Starting / Registering the Runner

```powershell
# 1. Get fresh token from GitHub
# Go to: GitHub repo → Settings → Actions → Runners → New self-hosted runner
# Copy the token that starts with "A..."

# 2. Load token into environment
$env:GH_RUNNER_TOKEN = "<paste token from GitHub>"

# 3. Start the runner
docker compose -f docker-compose.runner.yml up -d

# 4. Verify it's listening
docker logs gh-runner --tail 80
```

**Healthy output should include**: `✓ Connected to GitHub` and `Listening for Jobs`

### Checking Runner Status

```powershell
# Check if container is running
docker ps --filter "name=gh-runner"

# View recent logs
docker logs gh-runner --tail 50

# Check GitHub registration status
# Go to: repo → Settings → Actions → Runners
# Look for "portfolio-runner" with green dot (online)
```

### Troubleshooting

**Problem**: Runner shows as offline in GitHub

**Solutions**:

1. Check container is running: `docker ps | grep gh-runner`
2. Check logs for errors: `docker logs gh-runner --tail 100`
3. Verify token hasn't expired (tokens expire after a few hours)
4. Re-register with fresh token (see "Starting / Registering" above)

**Problem**: Token expired

**Solution**:

```powershell
# Remove old runner registration in GitHub Settings → Actions → Runners
# Click "New self-hosted runner" and copy new token
$env:GH_RUNNER_TOKEN = "<new token>"
docker compose -f docker-compose.runner.yml down
docker compose -f docker-compose.runner.yml up -d
```

**Problem**: Runner can't access Docker socket

**Check**:

```bash
docker exec gh-runner ls -l /var/run/docker.sock
# Should show: srw-rw---- ... /var/run/docker.sock
```

If permission denied, the runner user needs to be in the `docker` group on the host.

### Automated Health Checks

The runner executes these workflows:

1. **`infra-smoke.yml`** (hourly)
   - Verifies Cloudflare tunnel active (correct UUID)
   - Checks 4 registered tunnel connections
   - Tests `www.leoklemet.com` → 200 OK
   - Tests `api.leoklemet.com/ready` → 200 OK
   - Validates network connectivity (`infra_net`)

2. **`runner-health.yml`** (daily)
   - Simple ping to verify runner is responsive
   - Runs hostname and date check

3. **`smoke-selfhosted.yml`** (on push to main)
   - Docker version and socket access
   - Container listing
   - Network connectivity tests

### Security Notes

- Runner has **full Docker socket access** (can manage all containers)
- Only runs jobs from `main` branch and approved workflows
- Requires `production` environment approval for sensitive operations
- Token is **never committed** (only in environment variable)
- Uses `--replace` flag to prevent runner duplication

### Manual Test

```powershell
# Trigger infra smoke manually
gh workflow run infra-smoke.yml

# Or via GitHub UI:
# Actions → Infra Smoke (Production) → Run workflow
```

Expected result: Green checkmark, all domains returning 200 OK
