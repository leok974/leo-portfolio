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

