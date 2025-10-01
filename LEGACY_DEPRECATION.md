# Legacy Deprecation Checklist

Goal: fully remove the legacy status path after verifying zero usage and CI enforcement.

## Preconditions
- [ ] 0 legacy hits for ≥24h (sample via `X-Status-Path` header loop)
- [ ] `FAIL_ON_LEGACY=true` enabled in CI and green
- [ ] External monitors updated to `/status/summary`

## Actions
- [ ] Remove `location /status/` block (edge/nginx) and any frontend fallbacks
- [ ] Recompute SRI if HTML changed: `node scripts/check-integrity.mjs`
- [ ] `docs/CHANGELOG.md` updated with removal

## Post-Removal
- [ ] Verify only `X-Status-Path: api` observed
- [ ] Close tracking issue / notify on-call & stakeholders

## Notes / Optional
- Consider returning 410 Gone for one release before full removal if external caches are stubborn.
- Add CI job step asserting absence of legacy location in rendered nginx.conf after removal.
- Enable integrity check script in CI before/after cutover to catch accidental asset drift.
