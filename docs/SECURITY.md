---
title: SECURITY
---

# Security & Hardening

> Draft – Baseline controls. Extend with org-specific policies.

## Principles
- Least privilege containers (non-root backend)
- No secrets in git history
- Explicit CORS allowlist
- Transport security via external TLS termination or nginx
- Observability of fallback vs primary model usage

## Container Hardening
| Dependencies | Built via wheels stage → slim runtime with only runtime libs |
| Frontend perms | Dockerfile normalizes `/usr/share/nginx/html` to 0755 dirs / 0644 files post-build so nginx can traverse assets without granting write bits. |

## Secrets Handling
- OpenAI fallback key provided at runtime (env or Docker secret `openai_api_key`).
- Never commit `.env.prod`; sample lives outside version control.
- Rotate keys on exposure; update secret mounts & restart backend.

## CORS
Configured allowlist (`ALLOWED_ORIGINS`) includes production domains + localhost dev origins. Deny by default.
Frontend chat submission now always targets `/api/chat/stream`, keeping traffic on the edge proxy where headers and allowlist enforcement live even if the backend advertises alternate direct URLs.
- Zero-token fallback reuses the same origin by issuing a follow-up POST to `/api/chat` only after the guarded stream completes, so CORS policy remains centralized at the edge.
- The sr-only `data-testid="assistant-output"` container introduced for Playwright checks is rendered locally (no fetch) and inherits the same CSP/CORS boundaries; it simply mirrors streamed text for tests.
- Local Playwright fast loops use `installFastUI` to block image/font/media requests and force reduced motion. The route interception lives only in tests so production surface area and CSP remain unchanged while keeping developer browsers from leaking extra asset fetches.

## TLS
Options:
1. Cloudflare Tunnel / CDN termination → Keep compose ports bound to loopback.
2. Native certbot (DNS-01 recommended) → Add 443 server block to edge nginx.

## Headers (Edge nginx)
All primary security headers are now enforced at the edge and duplicated in the specific `location` blocks that need custom caching (because `add_header` in nginx does not inherit through locations once overridden):
```
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "$csp_policy" always;
```
### Current enforced CSP (drift-guarded)
```
default-src 'self';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://api.leoklemet.com;
script-src 'self' 'sha256-agVi37OvPe9UtrYEB/KMHK3iJVAl08ok4xzbm7ry2JE=';
style-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```
Single-line (as it appears on the wire):
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.leoklemet.com; script-src 'self' 'sha256-agVi37OvPe9UtrYEB/KMHK3iJVAl08ok4xzbm7ry2JE='; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
```
Hash maintenance is automated by `entrypoint.d/10-csp-render.sh`, which scans the shipped `index.html` on container startup and either replaces `__CSP_INLINE_HASHES__` placeholders or appends missing hashes after `script-src 'self'`. It installs `openssl` on first run when needed, keeping the hash list synchronized with inline bootstrap changes.
Directive rationale (delta vs earlier draft):
* `connect-src` narrowed to only the assistant API + self (removes broad network egress surface).
* `script-src` uses an explicit hash for the single tiny bootstrap inline (remaining inline event handler was removed — see below). No `'unsafe-inline'` or `'unsafe-eval'`.
* `object-src 'none'` and `frame-ancestors 'none'` block legacy plug-ins & click‑jacking.
* `base-uri 'self'` prevents `<base>` tag hijack.
* `upgrade-insecure-requests` ensures mixed content is auto-upgraded under universal TLS/CDN.

### Recent hardening changes
* Removed former inline stylesheet `onload` handler from `index.html`; logic replaced by a small listener in `main.js` (data attribute `data-media-onload` + script promotion) eliminating the last style-related inline event.
* Normalized icon & manifest paths to root, removing duplicate/404 variants.
* Added Playwright tests for:
	- Security header drift (`security-headers` spec)
	- CSP baseline equality (`csp-baseline.spec.ts`)
	- Favicon availability & caching (`icons-favicon.spec.ts`)
	- Manifest icons enumeration, MIME & long-cache (`manifest-icons.spec.ts`)
* Established caching policy tiers: immutable year for hashed/static assets & icons; 5‑minute short cache for `projects.json`; `no-cache` for HTML shell.

### SRI & Asset Integrity
* Subresource Integrity (SRI) applied to core stylesheets (`styles.*.css`, `assets/site.css`) using SHA-384.
* `scripts/generate-sri.mjs` + postbuild hook keep integrity attributes updated; `sri-manifest.json` records provenance.
* Treat hashed assets as immutable — change content → new hash → new SRI.

### Inline content policy
Goal is zero policy hash exceptions. Remaining hash exists only for a minimal bootstrap inline block; future refactor can externalize it and drop the hash from `script-src` entirely (then move to strict nonce or pure external). Track via TODO list in this file.

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

### CSP Baseline & Regeneration

An authoritative baseline line lives at `scripts/expected-csp.txt` and is enforced by:
* Playwright spec: `tests/e2e/csp-baseline.spec.ts` (fast fail locally/CI)
* Drift workflow: `.github/workflows/csp-drift.yml` (secondary guard)

Regenerate intentionally after policy changes:
```
make csp-baseline   # or: npm run csp:baseline
```
This queries `http://localhost:8080/` (configurable with `--url`) and normalizes whitespace.

### Future Hardening (Status)
1. (Done) Narrowed `connect-src` to explicit required origin(s) only.
2. (Planned) Add `form-action 'self';` once forms introduced.
3. (Done) Add `upgrade-insecure-requests;` since Cloudflare / TLS-only ingress.
4. (Ongoing) Reduce/remediate any remaining inline script hashing by externalizing logic.

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

## Data Store Hardening
- RAG `rag.sqlite` is forced into WAL mode with `busy_timeout=10000` so readers and writers can coexist without blocking the main event loop.
- Connection open/commit paths use a 5× exponential backoff before failing, eliminating crash loops previously triggered by `sqlite3.OperationalError: database is locked` during concurrent warmup + ingest.

## Tools Execution Controls
- Dangerous tools are disabled by default. The exec endpoint (`POST /api/tools/exec`) refuses tools marked as dangerous unless `ALLOW_TOOLS=1`.
- For script execution, `run_script` additionally requires `ALLOW_SCRIPTS` to include the relative script path (comma/semicolon separated). Requests outside the allowlist return `script not in allowlist`.
- All tool file operations resolve against `REPO_ROOT` (default repository root) using a safe-join to prevent path traversal. An audit log is appended to `data/tools_audit.log` for each run (tool name, arguments, timing, exit code or error).
 - Optional pre-flight checks (default-on for dangerous tools): before running, the API queries `git_status`. If the repo is dirty (modified/added/deleted/renamed/untracked) or behind its base (default `origin/main`), execution is blocked with an explicit error. Override with `ALLOW_DIRTY_TOOLS=1` and/or `ALLOW_BEHIND_TOOLS=1` when you intend to proceed.

## Incident Response TODO
- Add runbook: fallback failure vs both-provider outage
- Automate model warm pull at deploy time

## CSP Hash Snapshot (2025-10-02)

Served script hash observed in production build:

`sha256-agVi37OvPe9UtrYEB/KMHK3iJVAl08ok4xzbm7ry2JE=`

Source & workflow:
* Extract with: `npm run csp:hash` (reads `dist/index.html`).
* Sync into nginx only if `__CSP_HASH__` placeholder is present (current deploy config had none; sync script logged no replacement).
* Playwright baseline test guards the full policy string; this section is an audit convenience for quick diffing during security reviews.

Rotation guidance:
1. Change inline bootstrap script → run `npm run build:prod`.
2. Re-run `npm run csp:hash` and update this snapshot (or leave historic entries chronologically).
3. If adding placeholder to `deploy/nginx.conf`, run `npm run csp:sync:deploy` to template in new hash.

Historical Hashes:
* 2025-10-02: `sha256-agVi37OvPe9UtrYEB/KMHK3iJVAl08ok4xzbm7ry2JE=`



## Guardrails (prompt injection + secret redaction)

- Modes: set `GUARDRAILS_MODE=enforce|log` (default: `enforce`). In enforce mode, suspected prompt-injection inputs are blocked with a safe message and `_served_by="guardrails"`.
- Dev override: set `ALLOW_UNSAFE=1` to disable enforcement locally while keeping flagging/logging.
- RAG snippet sanitization: snippets returned from retrieval are sanitized to redact common secret shapes (JWTs, API keys, PEM blocks) server‑side.
- API responses include a `guardrails` object:
	- `{ flagged: boolean, blocked: boolean, reason: string | null, patterns: string[] }`
- UI shows a small shield badge when a reply was flagged/blocked.

Streaming specifics:
- SSE path includes `guardrails` inside the initial `meta` event so the UI can render the badge immediately during streaming.
- In `enforce` mode the streaming handler short‑circuits with a single safe delta and `done` after emitting the `meta` with `blocked: true`.

## Anonymous Analytics

- Analytics are anonymous: `visitor_id` is a client-generated random ID (hashed/local), no emails or PII sent.
- Restrict ingestion via `ANALYTICS_ORIGIN_ALLOWLIST` and standard CORS.
- Raw events are stored as JSONL in `./data/analytics/` and can be rotated or redacted as needed.
- No external tracking services or third-party beacons are used.
- Data retention: Events older than 14 days are not analyzed (can be manually archived/deleted).




