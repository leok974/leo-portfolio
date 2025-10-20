# Enable backend via api.leoklemet.com → portfolio-api.int:8000

## Summary
Re-enables backend API after fixing 502 Bad Gateway errors caused by proxying to non-existent `assistant.ledger-mind.org` domain.

## Changes
- **Network alias**: Add `portfolio-api.int:8000` to backend service in Docker compose
- **Cloudflare Tunnel**: Route `api.leoklemet.com` → `http://portfolio-api.int:8000`
- **Nginx proxy**: Re-enable `/api/`, `/chat`, `/chat/stream` blocks with internal routing
- **Frontend flag**: Set `VITE_BACKEND_ENABLED=1` in `.env.production`
- **E2E test**: Add minimal `/api/ready` spec to validate same-origin proxy
- **CORS update**: `ALLOWED_ORIGINS=https://www.leoklemet.com,https://api.leoklemet.com`
- **Cleanup docs**: Document obsolete `assistant.*` references for future PR

## Architecture

### Before (Broken)
```
Browser → www.leoklemet.com/api/ready
          ↓ (nginx proxy)
       assistant.ledger-mind.org/api/ready  ❌ DNS fails → 502 Bad Gateway
```

### After (Fixed)
```
Browser → www.leoklemet.com/api/ready
          ↓ (nginx same-origin proxy)
       portfolio-api.int:8000/api/ready  ✅ Internal Docker network

OR

Direct → api.leoklemet.com/api/ready
         ↓ (Cloudflare Tunnel)
       portfolio-api.int:8000/api/ready  ✅ Public backend access
```

## Testing
- ✅ E2E test added: `tests/e2e/api-ready.spec.ts`
- ✅ Local validation: Nginx config syntax verified
- ✅ Smoke test commands (post-merge):
  ```powershell
  # Same-origin proxy (frontend → nginx → backend)
  curl -I https://www.leoklemet.com/api/ready

  # Direct backend (public)
  curl -I https://api.leoklemet.com/api/ready

  # Static site still healthy
  curl -I https://www.leoklemet.com
  ```

## Post-Merge Actions
1. **Restart cloudflared**: `docker restart infra-cloudflared-1` (to pick up new `api.leoklemet.com` ingress)
2. **Run smoke tests** (commands above)
3. **Verify backend live**: Check /api/ready returns 200 OK
4. **Monitor logs** for errors

## Rollback Plan
If anything breaks:
1. Set `VITE_BACKEND_ENABLED=0` in `apps/portfolio-ui/.env.production`
2. Comment out nginx proxy blocks in `deploy/nginx.portfolio-dev.conf`
3. Commit and trigger Agent Refresh workflow
4. Site will revert to static-only (no backend calls)

## Notes
- **Domain cleanup**: ~600 `assistant.ledger-mind.org` references found (mostly docs)
- **Defer to follow-up PR**: Documentation updates, workflow env vars, README examples
- **Worker-based refresh flow**: Kept as-is (out of scope for this PR)
- **Internal alias**: `portfolio-api.int:8000` eliminates external DNS dependencies
