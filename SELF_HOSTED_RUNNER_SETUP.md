# Self-Hosted GitHub Actions Runner Setup

**Purpose**: Enable Watchtower bootstrap and deployments via GitHub Actions on production server  
**Time**: 10-15 minutes  
**Method**: Dockerized runner (auto-updates, persistent)

---

## Why Self-Hosted Runner?

**Problem**: Can't execute bootstrap commands remotely without SSH  
**Solution**: Self-hosted GitHub Actions runner on production box

**Benefits**:
- ✅ Execute workflows directly on production server
- ✅ Access to Docker socket for container management
- ✅ No SSH needed - everything via GitHub Actions UI
- ✅ Auto-updates runner software
- ✅ Persistent workspace across runs

---

## Prerequisites

- Production server access (one-time setup)
- Docker installed and running
- Sudo/root access for initial setup
- GitHub repo admin access for runner token

---

## Step 1: Generate Runner Registration Token

### Via GitHub UI:
1. Go to: https://github.com/leok974/leo-portfolio/settings/actions/runners/new
2. Select: **Linux x64**
3. Copy the token from the `./config.sh` command
   - Looks like: `BTGQ4IAV55G73KF6ICKNMT3I7ELEO` (expires in 1 hour)

### Via GitHub CLI:
```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/leok974/leo-portfolio/actions/runners/registration-token \
  --jq '.token'
```

**Note**: Save this token immediately - it expires in 1 hour!

---

## Step 2: Create Persistent Workspace

**On production server**:

```bash
# Create directory for runner workspace
sudo mkdir -p /srv/gh-runner

# Set ownership (1000:1000 is typical for first user)
sudo chown 1000:1000 /srv/gh-runner

# Verify
ls -ld /srv/gh-runner
# Should show: drwxr-xr-x ... 1000 1000 ... /srv/gh-runner
```

---

## Step 3: Start Runner Container

**Replace `<NEW_REG_TOKEN>` with the token from Step 1**:

```bash
docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="<NEW_REG_TOKEN>" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest
```

**What this does**:
- Starts runner container in background
- Auto-restarts on failure or reboot
- Mounts Docker socket for container management
- Persistent workspace in `/srv/gh-runner`
- Labels: `self-hosted`, `prod`, `deploy`

---

## Step 4: Verify Runner Started

**Check logs**:
```bash
docker logs -f gh-runner-prod | head -n 60
```

**Look for**:
```
✓ Connected to GitHub
✓ Runner successfully added
✓ Runner connection is good
✓ Listening for Jobs
```

**Press Ctrl+C** to exit log tail once you see "Connected to GitHub"

**Verify in GitHub**:
1. Go to: https://github.com/leok974/leo-portfolio/settings/actions/runners
2. Should see: **prod-runner-1** with status **Idle** (green)

---

## Step 5: Test Runner with Smoke Test

**Trigger smoke test workflow**:

### Via GitHub UI:
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select: **Smoke Test (Self-Hosted)**
3. Click: **Run workflow** → **Run workflow**
4. Watch it execute

### Via CLI:
```bash
gh workflow run smoke-selfhosted.yml
gh run list --workflow="smoke-selfhosted.yml" --limit 1
gh run watch <RUN_ID>
```

**Expected output**:
- ✅ Runner hostname displayed
- ✅ Docker version shown
- ✅ Running containers listed
- ✅ Network connectivity confirmed

**If it succeeds**: Your self-hosted runner is working! ✅

---

## Step 6: Execute Watchtower Bootstrap

**Now run the actual bootstrap**:

### Via GitHub UI:
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select: **Bootstrap Watchtower (Self-Hosted)**
3. Click: **Run workflow**
4. **Type `bootstrap` in the confirmation field**
5. Click: **Run workflow**
6. Watch it execute (~2-3 minutes)

### Via CLI:
```bash
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap
gh run list --workflow="bootstrap-watchtower.yml" --limit 1
gh run watch <RUN_ID>
```

**What the bootstrap does**:
1. ✅ Checks out repository
2. ✅ Creates `deploy/.env.production` with GitHub Secrets
3. ✅ Pulls latest Docker images
4. ✅ Starts Watchtower + Backend + Nginx
5. ✅ Tests Watchtower endpoint (local + public)
6. ✅ Verifies backend health
7. ✅ Confirms bootstrap success

**Expected result**: All steps pass with ✅

---

## Step 7: Verify Watchtower Working

**After bootstrap succeeds**:

```bash
# On production server (or via another workflow)
docker ps | grep watchtower
docker logs portfolio-watchtower --tail=20
```

**Test public endpoint** (from anywhere):
```bash
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer <WATCHTOWER_HTTP_API_TOKEN>"
```

**Expected**: HTTP 200/204 with JSON response

---

## Step 8: Test Force-Pull Workflow

**Trigger the force-pull workflow**:

### Via GitHub UI:
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select: **Redeploy Backend via Watchtower**
3. Click: **Run workflow** → **Run workflow**
4. Watch it execute

**Expected**:
- ✅ Triggers Watchtower update
- ✅ Waits for backend health
- ✅ Verifies routes
- ✅ Tests `/api/dev/status` endpoint

**If successful**: `/api/dev/status` should now return 200! ✅

---

## Troubleshooting

### Runner not connecting

**Check logs**:
```bash
docker logs gh-runner-prod
```

**Common issues**:
- ❌ **Token expired**: Generate new token and recreate container
- ❌ **Network issues**: Check firewall/connectivity to GitHub
- ❌ **Docker socket**: Verify `/var/run/docker.sock` is mounted

**Fix - restart with new token**:
```bash
# Stop and remove old container
docker stop gh-runner-prod
docker rm gh-runner-prod

# Generate new token (Step 1)
# Start new container (Step 3)
```

---

### Smoke test fails

**Check**:
```bash
# Docker access
docker ps

# Docker socket permissions
ls -l /var/run/docker.sock

# Runner logs
docker logs gh-runner-prod --tail=50
```

---

### Bootstrap fails

**Check GitHub Secrets are set**:
```bash
gh secret list | grep -E "WATCHTOWER|FIGMA"
```

**Required secrets**:
- `WATCHTOWER_HTTP_API_TOKEN`
- `FIGMA_PAT`
- `FIGMA_TEAM_ID` (can be empty)
- `FIGMA_TEMPLATE_KEY` (can be empty)

**Check runner can access deploy folder**:
```bash
# Via smoke test or manual docker exec
docker exec gh-runner-prod ls -la /runner/_work/leo-portfolio/leo-portfolio/deploy/
```

---

### Watchtower endpoint returns 404

**Check nginx config deployed**:
```bash
# On production server
grep -A5 "/ops/watchtower/update" deploy/nginx/nginx.prod.conf

# Reload nginx
docker compose -f deploy/docker-compose.portfolio-prod.yml restart nginx
```

---

## Runner Management

### View runner status
```bash
docker ps | grep gh-runner
docker logs gh-runner-prod --tail=20
```

### Restart runner
```bash
docker restart gh-runner-prod
```

### Stop runner
```bash
docker stop gh-runner-prod
```

### Update runner (recreate container)
```bash
# Runner auto-updates, but to force update:
docker stop gh-runner-prod
docker rm gh-runner-prod
# Generate new token
# Run docker run command again (Step 3)
```

### Remove runner completely
```bash
# Stop and remove container
docker stop gh-runner-prod
docker rm gh-runner-prod

# Remove from GitHub
# Go to: Settings → Actions → Runners
# Click "..." next to runner → Remove
```

---

## Security Considerations

### Runner Security
- ✅ Runner has full Docker access (required for deployments)
- ✅ Runs on production server (isolated environment)
- ✅ Only your repository can trigger workflows
- ⚠️  Anyone with repo write access can run workflows
- ✅ Use `runs-on: [self-hosted, prod, deploy]` to target this runner

### Recommendations
1. **Limit workflow trigger permissions**: Only allow workflow_dispatch (manual)
2. **Add approval gates**: Require approvals for production deployments
3. **Monitor runner activity**: Check GitHub Actions logs regularly
4. **Rotate tokens**: Regenerate runner token periodically
5. **Audit workflows**: Review workflow changes before merging

---

## What's Next

After successful bootstrap:

1. ✅ **Runner is live** and listening for jobs
2. ✅ **Watchtower is running** and monitoring containers
3. ✅ **Bootstrap is complete** - `/ops/watchtower/update` works
4. ✅ **Force-pull works** - "Redeploy Backend via Watchtower" workflow
5. ✅ **Backend fix deployed** - `/api/dev/status` returns 200

**Future deployments**:
- Just click "Run workflow" on "Redeploy Backend via Watchtower"
- Or let Watchtower auto-update every 5 minutes
- No SSH needed ever again! 🎉

---

## Summary

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Generate runner token | 1 min | |
| 2 | Create workspace directory | 30 sec | |
| 3 | Start runner container | 1 min | |
| 4 | Verify runner connected | 1 min | |
| 5 | Run smoke test workflow | 2 min | |
| 6 | Run bootstrap workflow | 3 min | |
| 7 | Verify Watchtower | 1 min | |
| 8 | Test force-pull workflow | 2 min | |
| **Total** | **End-to-end setup** | **~10-15 min** | |

---

**Status**: Ready to execute  
**Next**: Generate runner token and start container  
**Result**: Full automation via GitHub Actions 🚀
