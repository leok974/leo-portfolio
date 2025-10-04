# Operations Guide (Production)

> Purpose: day-2 ops for readiness, deprecations, header diagnostics, integrity checks, CI tie-ins, and quick triage.

## Status & Readiness Cheatsheet
- **/api/ready** → container + dependencies (DB, model provider) must be reachable.
- **/status/summary** → aggregate view (model presence, fallback state, counts).
- **Header: `X-Status-Path: api|legacy`** appears on status responses to quantify lingering legacy hits.

### Quick probes
```bash
curl -sSL -D - https://<host>/api/ready -o /dev/null | sed -n '1,20p'
curl -s https://<host>/status/summary | jq '.'
```

### Counting legacy usage (rolling sample)
```bash
for i in {1..30}; do
  curl -s -D - https://<host>/status/summary -o /dev/null \
  | grep -i '^X-Status-Path:' || true
  sleep 2
done | sort | uniq -c
```

## Readiness vs. Warming (Callout)
`ready=false` with `llm.path="warming"` is **not** an incident unless it exceeds **X minutes** (set your SLO; typical 5–10m). Treat over-budget warming as a page.

## Deprecation Signals (Dual-Endpoint Cutover)
We expose a temporary **legacy** endpoint during migration. Proceed to removal when:
- 0 legacy header hits for **≥24h** (see header sampling above),
- CI workflow green with **legacy checks enabled**,
- No external monitors read the legacy path,
- Changelog entry prepared.

## Legacy Endpoint Cutover Playbook
1) Observe **0 legacy hits** for N hours (≥24h recommended).
2) Flip CI guard: `FAIL_ON_LEGACY=true` → CI fails on any legacy access.
3) Remove `nginx` `location /status/` (legacy) + any frontend fallback.
4) Re-run **SRI** (if HTML changed): `node scripts/check-integrity.mjs` (see below).
5) Cut a CHANGELOG entry and deploy.
6) Post-deploy: re-verify headers show only `X-Status-Path: api`.

## CI Workflow Tie-In (Status/CORS)
| Check | What it validates | Failure mode |
|------|--------------------|--------------|
| GET /api/ready | deps reachable | exit 1 (red) |
| GET /status/summary | model presence, fallback flags | red + diagnostic dump |
| OPTIONS /chat | CORS allowlist & headers | red: missing `Access-Control-Allow-Origin` |
| Legacy gate (opt-in) | 0 legacy access when `FAIL_ON_LEGACY=true` | red on first occurrence |

## Integrity / SRI Verification (Optional but Recommended)
We maintain `sri-manifest.json` with `{ "path": { "algo": "sha384-…"} }`.

**One-liner view**
```bash
jq -r 'to_entries[] | "\(.key) \(.value.sha384)"' sri-manifest.json
```

**Spot-check (full recompute)**
```bash
node scripts/check-integrity.mjs
```
Exit non-zero on drift. Use before/after HTML changes and in CI.

## Version Correlation (Freshness)
| Field | Where | Use |
|------|-------|-----|
| `build.sha` | `/status/summary` | Match against `docs/CHANGELOG.md` to confirm deploy freshness |

## On-Call Quick Triage (Top Signatures)
<details><summary>Missing CORS</summary>
`OPTIONS /chat` lacks `Access-Control-Allow-Origin` → confirm `ALLOWED_ORIGINS`, edge config, and environment.</details>
<details><summary>Warming persists</summary>
`ready=false, llm.path=warming` beyond X minutes → check model pull, provider health, CPU/memory pressure.</details>
<details><summary>Model missing</summary>
`status.model_present=false` → pull model at startup or bake into image; verify network to provider.</details>
<details><summary>5xx burst</summary>
Spike in `/metrics` + `status.fallback=true` → provider outage; fallback key/path OK? Rate limit? Retries?</details>
<details><summary>Tunnel dead</summary>
Edge 52x via CDN/Tunnel → check tunnel container health, QUIC connections, and origin reachability.</details>

## Optional Metrics Bridging
Export a minimal Prometheus gauge from `/status/summary`:
- `status_ready{service="backend"} 0|1`
Wire into existing dashboards for red/green at a glance.

### Cloudflared Tunnel — Token Mode (Recommended quick setup)

Cloudflared is deployed as a Compose service on the **same network** as `nginx`. Token mode requires the token to be in the **host** environment because Compose interpolates `${VAR}` at parse time.

**Set token (PowerShell):**
```powershell
$Env:CLOUDFLARE_TUNNEL_TOKEN = "<YOUR_TUNNEL_TOKEN>"
# optional (persist):
setx CLOUDFLARE_TUNNEL_TOKEN "<YOUR_TUNNEL_TOKEN>"
```

**Use Compose with overlay:**
```powershell
$FILES = @('-f','docker-compose.prod.yml','-f','docker-compose.prod.override.yml','-f','docker-compose.cloudflared.yml')
docker compose $FILES config | Select-String -Pattern "cloudflared|--token"
docker compose $FILES up -d --force-recreate --no-deps cloudflared
docker compose $FILES logs -f cloudflared
```

Healthy logs: multiple `Registered tunnel connection … protocol=quic` and an ingress config showing `service":"http://nginx:80"`.

**Quick checks:**
```powershell
curl -s -o NUL -w "origin_code=%{http_code}`n" http://127.0.0.1/ready
curl -s -k -D - https://assistant.ledger-mind.org/ready -o NUL | Select-String "HTTP/|cf-ray"
```
Expect HTTP 200/204 locally and a `cf-ray` header on edge.

Notes:
- Origin cert path warning is benign in token mode.
- UDP buffer warnings on Windows Desktop are ignorable.
- If token not rendered in `docker compose config`, the host env wasn’t exported (new shell if you used `setx`).

### Cloudflared Tunnel — Credentials File Mode (Durable alternative)
If avoiding host shell tokens:
1. Download the tunnel credentials JSON (`<UUID>.json`).
2. `cloudflared/config.yml`:
   ```yaml
   tunnel: <UUID>
   credentials-file: /etc/cloudflared/<UUID>.json
   ingress:
     - hostname: assistant.ledger-mind.org
       service: http://nginx:80
     - service: http_status:404
   ```
3. Compose service:
   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:latest
       command: ["tunnel","--config","/etc/cloudflared/config.yml","run"]
       volumes:
         - ./cloudflared/config.yml:/etc/cloudflared/config.yml:ro
         - ./cloudflared/<UUID>.json:/etc/cloudflared/<UUID>.json:ro
       restart: unless-stopped
       depends_on: [nginx]
   ```
This mode persists across shells without exporting a token.

## Windows / WSL2 Docker Stability (Flakiness Mitigation)
Systems running Docker Desktop on Windows with WSL2 occasionally hit the named pipe error:

```
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

### Quick Recovery Function (Admin PowerShell)
```powershell
function Restart-DockerDesktop {
  Write-Host "Stopping com.docker.service..." -ForegroundColor Yellow
  Stop-Service com.docker.service -ErrorAction SilentlyContinue
  wsl --shutdown
  Start-Sleep -Seconds 2
  Write-Host "Starting com.docker.service..." -ForegroundColor Yellow
  Start-Service com.docker.service
  Write-Host "Docker Desktop restarted" -ForegroundColor Green
}
Restart-DockerDesktop  # invoke when pipe errors occur
```

### WSL Resource Budget (%UserProfile%\.wslconfig)
```ini
[wsl2]
memory=10GB
processors=6
swap=2GB
localhostForwarding=true
```
After editing:
```powershell
wsl --shutdown
Restart-DockerDesktop
```

### Pre‑Flight Daemon Health Probe
```powershell
function Test-Docker {
  try { docker version --format '{{.Server.Version}}' 1>$null 2>$null; return $true } catch { return $false }
}
if (-not (Test-Docker)) { Restart-DockerDesktop }
```

## Resilient Stack Bring-Up Script
Script: `scripts/start-prod.ps1` performs:
1. Docker daemon health check (auto restart if down).
2. `docker compose up -d` with remove-orphans.
3. Wait loop for edge `_up` endpoint.
4. Wait loop for `/api/status/summary` 200.
5. Emits final `llm.path` and `primary_model_present`.

Usage:
```powershell
pwsh ./scripts/start-prod.ps1
```

Env overrides:
```powershell
$Env:PRIMARY_POLL_INTERVAL_S=3   # faster warming→primary promotion
$Env:PRIMARY_POLL_MAX_S=900      # extend poll budget
```

## Automatic Primary Model Polling
Implemented in `lifespan.py`:
- Polls `primary_list_models()` every 5s (default) until target model detected or timeout.
- Configurable with `PRIMARY_POLL_INTERVAL_S` and `PRIMARY_POLL_MAX_S`.
- Eliminates manual `/llm/models?refresh=true` calls when large models finish pulling late.

### Verifying Promotion
```powershell
curl http://127.0.0.1:8080/api/status/summary | jq '.llm.path, .llm.primary_model_present'
```
Expect transition: `"warming"` → `"primary"` and `true`.

## UI Fallback Indicator
Frontend badge now displays `fallback (no model)` when primary model absent; shows `Agent — primary` once available.
- Derived fields: `_ui.provider`, `_ui.modelPresent` injected by status poller.
- Aids triage when Ollama pull still in progress or model missing.

## Docker Disk Hygiene & Volume Pruning (Safe Workflow)
Large model images and build layers can accumulate quickly. Use a **review-first** flow to reclaim space without risking critical data.

### 1. Snapshot (Before)
```powershell
docker system df -v
```

### 2. Classify Volumes (In-Use vs Unused)
Script (preferred):
```powershell
pwsh ./scripts/docker-prune-review.ps1
```
Manual approach (PowerShell):
```powershell
$allVols = docker volume ls -q | Where-Object { $_ }
$containerIds = docker ps -aq
$inUse = foreach ($cid in $containerIds) {
  docker inspect $cid --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}'
} | Where-Object { $_ } | Sort-Object -Unique
$candidates = $allVols | Where-Object { $_ -notin $inUse }
```

### 3. Protect Critical Volumes
Keep the consolidated Ollama model volume (e.g. `deploy_ollama-data`). The prune script defaults to protecting:
```
deploy_ollama-data, ollama-data
```
Add more via:
```powershell
pwsh ./scripts/docker-prune-review.ps1 -Protect deploy_ollama-data,postgres-data
```

### 4. Optional: Inspect a Volume Before Deletion
```powershell
pwsh ./scripts/docker-prune-review.ps1
# then inside interactive shell (or manually):
docker run --rm -v <volume>:/v alpine sh -lc "ls -lah /v; du -sh /v || true"
```

### 5. Delete Only Reviewed Unused Volumes
Script (non-interactive, auto-confirm):
```powershell
pwsh ./scripts/docker-prune-review.ps1 -Auto -Force
```
Manual targeted removal:
```powershell
docker volume rm <vol1> <vol2>
```

Avoid `docker volume prune -f` unless certain no detached-but-needed volumes exist.

### 6. (Optional) Prune Build / Image / Network Cache
Within script (add flag):
```powershell
pwsh ./scripts/docker-prune-review.ps1 -IncludeCaches
```
Manually:
```powershell
docker container prune -f
docker network prune -f
docker image prune -a -f
docker builder prune -f
```

### 7. Snapshot (After)
```powershell
docker system df -v
```

### 8. Free WSL Memory Cache (Windows Desktop)
If disk still appears high due to WSL page cache:
```powershell
wsl --shutdown
```
Docker Desktop will restart the VM on next command.

### 9. Sanity Checks Post-Prune
```powershell
curl -s http://127.0.0.1:8080/api/ready
docker compose exec backend curl -sf http://deploy-ollama-1:11434/api/version
```

### RAM Reclamation Without Deleting Models
If only memory pressure (not disk) is a concern:
```powershell
docker exec -it deploy-ollama-1 ollama unload gpt-oss:20b
```
Ensure `OLLAMA_KEEP_ALIVE=5m` (already set) to allow idle model eviction from RAM.

### Script Reference
`scripts/docker-prune-review.ps1` implements:
- Before/after disk snapshots
- Volume classification
- Protected volume list
- Optional volume inspection helper
- Conditional cache pruning
- Non-interactive automation flags: `-Auto -Force -IncludeCaches`

> NOTE: The script intentionally skips volumes still mounted even if they report `0B` usage (often overlay or cert volumes required at runtime).

