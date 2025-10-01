# Security & Hardening

> Draft – Baseline controls. Extend with org-specific policies.

## Principles
- Least privilege containers (non-root backend)
- No secrets in git history
- Explicit CORS allowlist
- Transport security via external TLS termination or nginx
- Observability of fallback vs primary model usage

## Container Hardening
| Component | Control |
|-----------|---------|
| Backend | Runs as `appuser` (UID 1001) after install phase |
| Edge / Frontend | Read-only static content (consider `readOnlyRootFilesystem` in orchestration) |
| Dependencies | Built via wheels stage → slim runtime with only runtime libs |

## Secrets Handling
- OpenAI fallback key provided at runtime (env or Docker secret `openai_api_key`).
- Never commit `.env.prod`; sample lives outside version control.
- Rotate keys on exposure; update secret mounts & restart backend.

## CORS
Configured allowlist (`ALLOWED_ORIGINS`) includes production domains + localhost dev origins. Deny by default.

## TLS
Options:
1. Cloudflare Tunnel / CDN termination → Keep compose ports bound to loopback.
2. Native certbot (DNS-01 recommended) → Add 443 server block to edge nginx.

## Headers (Edge nginx)
Recommended additions (future PR):
```
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer-when-downgrade always;
add_header Permissions-Policy "geolocation=()" always;
```
Current enforced CSP (after inline style extraction & SRI):
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: http:; script-src 'self'; style-src 'self';
```
Hardening notes:
- Removed `'unsafe-inline'` from both script and style directives.
- Added Subresource Integrity (SRI) for core stylesheets (`styles.*.css`, `assets/site.css`) using SHA-384.
- HTML link tags now include `integrity` + `crossorigin="anonymous"`. Any build pipeline changes that re-hash these assets MUST update integrity strings or the browser will block them.
- Avoid runtime mutation of these files; treat them as immutable versioned artifacts.

### Automated SRI Maintenance
Run manually:
```bash
npm run build:sri         # root HTML + assets (dev / GitHub Pages mode)
npm run build:dist:sri    # after vite build if you serve from dist/
```
or (after a fresh `vite build`) rely on the `postbuild` hook which invokes the same script.

PowerShell helper (custom patterns):
```powershell
./scripts/update-sri.ps1 -Root . -Html "index.html,projects/*.html" -Assets .
```

The Node script (`scripts/generate-sri.mjs`) will:
1. Locate all matching HTML files.
2. Compute SHA-384 over local CSS/JS assets referenced via relative paths.
3. Insert or skip if integrity already present.
4. Add `crossorigin="anonymous"` when missing.
5. Emit `sri-manifest.json` (or `dist/sri-manifest.json`) mapping asset relative path → integrity value for provenance/auditing.

### Dual Status Endpoint (Deprecation)
For migration safety the frontend temporarily attempts legacy `/status/summary` if `/api/status/summary` fails on GitHub Pages. Remove this fallback after confirming all public hostnames route through the patched nginx (tunnel + DNS cutover complete). Audit by grepping for `legacyUrl` in `src/status/status-ui.ts` and `src/agent-status.ts`.

If you rename hashed asset files (e.g., new Vite hash), just rebuild; the script re-computes integrity automatically.

Operational tip: When the build hash changes (e.g., new Vite output), recompute `sha384` of each CSS file and update the link tags. Consider scripting this step in a release task.

## Rate Limiting (Planned)
`limit_req_zone` and `limit_conn_zone` for `/chat` & `/chat/stream` to mitigate burst abuse. Not yet enabled.

## Dependency Audit
Use `pip-audit` in CI:
```bash
pip-audit -r assistant_api/requirements.txt
```
(Optional) Pin transitive upgrades via `pip-compile` regularly.

## Logging / PII
- No user PII persisted; chat context ephemeral
- Consider adding request IDs & provider choice for forensic tracing

## Incident Response TODO
- Add runbook: fallback failure vs both-provider outage
- Automate model warm pull at deploy time

