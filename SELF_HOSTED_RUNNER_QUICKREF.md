# Self-Hosted Runner Quick Reference

**Status**: Workflows committed and pushed (e5bd00b)
**Next**: Set up runner on production server

---

## Quick Commands

### 1. Generate Runner Token
```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/leok974/leo-portfolio/actions/runners/registration-token \
  --jq '.token'
```
**Or**: https://github.com/leok974/leo-portfolio/settings/actions/runners/new

---

### 2. Start Runner (on production box)
```bash
# Create workspace
sudo mkdir -p /srv/gh-runner && sudo chown 1000:1000 /srv/gh-runner

# Start runner (replace <TOKEN>)
docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="<TOKEN>" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest

# Check logs
docker logs -f gh-runner-prod | head -n 60
# Wait for: "✓ Connected to GitHub"
```

---

### 3. Verify Runner
- **GitHub**: https://github.com/leok974/leo-portfolio/settings/actions/runners
- **Expect**: `prod-runner-1` with status **Idle** (green)

---

### 4. Run Smoke Test
```bash
# Via CLI
gh workflow run smoke-selfhosted.yml
gh run watch $(gh run list --workflow=smoke-selfhosted.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Via UI
# https://github.com/leok974/leo-portfolio/actions
# → "Smoke Test (Self-Hosted)" → Run workflow
```

---

### 5. Execute Bootstrap
```bash
# Via CLI
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap
gh run watch $(gh run list --workflow=bootstrap-watchtower.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Via UI
# https://github.com/leok974/leo-portfolio/actions
# → "Bootstrap Watchtower (Self-Hosted)" → Run workflow
# → Type "bootstrap" in confirmation field
```

---

### 6. Verify Watchtower
```bash
# Test public endpoint
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
# Expect: 200/204
```

---

### 7. Deploy Backend Fix
```bash
# Via CLI
gh workflow run redeploy-backend.yml
gh run watch $(gh run list --workflow=redeploy-backend.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Via UI
# https://github.com/leok974/leo-portfolio/actions
# → "Redeploy Backend via Watchtower" → Run workflow
```

---

### 8. Verify /api/dev/status
```bash
# Check OpenAPI docs
curl https://api.leoklemet.com/openapi.json | jq '.paths | has("/api/dev/status")'
# Expect: true

# Test endpoint (no auth)
curl https://api.leoklemet.com/api/dev/status
# Expect: {"ok":true,"allowed":false,"mode":"denied",...}

# Test endpoint (with auth)
curl -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" \
  https://api.leoklemet.com/api/dev/status
# Expect: {"ok":true,"allowed":true,"mode":"token",...}
```

---

## Troubleshooting

### Runner not connecting
```bash
# Check logs
docker logs gh-runner-prod

# Common: Token expired (regenerate and restart)
docker stop gh-runner-prod && docker rm gh-runner-prod
# Then: Generate new token and run docker run again
```

---

### Bootstrap fails
```bash
# Verify GitHub Secrets
gh secret list | grep -E "WATCHTOWER|FIGMA"

# Check runner logs
docker logs gh-runner-prod --tail=50

# Check runner can access deploy folder
docker exec gh-runner-prod ls -la /runner/_work/leo-portfolio/leo-portfolio/deploy/
```

---

### Watchtower 404
```bash
# On production server - reload nginx
docker compose -f deploy/docker-compose.portfolio-prod.yml restart nginx

# Check config
grep -A5 "/ops/watchtower/update" deploy/nginx/nginx.prod.conf
```

---

## Timeline

| Step | Time | Status |
|------|------|--------|
| Generate token | 1 min | |
| Start runner | 1 min | |
| Verify runner | 1 min | |
| Smoke test | 2 min | |
| Bootstrap | 3 min | |
| Verify Watchtower | 1 min | |
| Deploy backend | 2 min | |
| Verify endpoint | 1 min | |
| **Total** | **~10-15 min** | |

---

## Success Criteria

- ✅ Runner container running (`docker ps | grep gh-runner`)
- ✅ Runner connected in GitHub (settings → actions → runners)
- ✅ Smoke test passes
- ✅ Bootstrap workflow completes
- ✅ Watchtower endpoint returns 200/204
- ✅ Redeploy workflow succeeds (no 404)
- ✅ `/api/dev/status` returns 200

---

## Documentation

- **Full Guide**: SELF_HOSTED_RUNNER_SETUP.md
- **Bootstrap Manual**: deploy/BOOTSTRAP_WATCHTOWER.md
- **Bootstrap Checklist**: deploy/BOOTSTRAP_CHECKLIST.md
- **Handoff Summary**: BOOTSTRAP_HANDOFF_COMPLETE.md

---

**Current Status**: Ready to execute
**Next Step**: Generate runner token and start container
**Commit**: e5bd00b
