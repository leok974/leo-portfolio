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
