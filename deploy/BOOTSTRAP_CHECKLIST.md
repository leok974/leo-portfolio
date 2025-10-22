# Bootstrap Checklist - Watchtower Deployment

**Purpose**: Verify one-time Watchtower setup completed successfully  
**When**: After running `BOOTSTRAP_WATCHTOWER.md` steps

---

## Pre-Deployment

- [ ] Production host access confirmed
- [ ] Docker and docker-compose installed on host
- [ ] Actual token values available (WATCHTOWER_HTTP_API_TOKEN, FIGMA_PAT)
- [ ] Located in `/path/to/deploy/` directory

---

## File Deployment

- [ ] `deploy/docker-compose.portfolio-prod.yml` present on server
  - Contains `watchtower` service definition
  - Backend has label: `com.centurylinklabs.watchtower.enable: "true"`
  
- [ ] `deploy/nginx/nginx.prod.conf` deployed/used by nginx
  - Contains `location /ops/watchtower/update` block
  - Proxies to `http://127.0.0.1:8083/v1/update`
  
- [ ] `deploy/.env.production` created with required secrets
  - Has `WATCHTOWER_HTTP_API_TOKEN=<token>`
  - Has `FIGMA_PAT=<token>`
  - File exists on server (not in git)

---

## Service Deployment

- [ ] Ran: `docker compose -f docker-compose.portfolio-prod.yml pull`
  - All images pulled successfully
  
- [ ] Ran: `docker compose -f docker-compose.portfolio-prod.yml up -d`
  - Services started: backend, nginx, watchtower
  
- [ ] (If nginx on host) Ran: `nginx -t && nginx -s reload`
  - Nginx config test passed
  - Nginx reloaded successfully

---

## Verification - Containers

- [ ] Watchtower container running
  ```bash
  docker ps | grep watchtower
  # Shows: portfolio-watchtower ... Up ... 127.0.0.1:8083->8080/tcp
  ```

- [ ] Watchtower logs healthy
  ```bash
  docker logs portfolio-watchtower --tail=20
  # Shows: "HTTP API enabled on :8080"
  # Shows: "Using label-enable mode"
  ```

- [ ] Backend container running
  ```bash
  docker ps | grep backend
  # Shows: portfolio-backend ... Up ... 127.0.0.1:8001->8001/tcp
  ```

---

## Verification - Endpoints

- [ ] Watchtower endpoint accessible (POST)
  ```bash
  curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
    -H "Authorization: Bearer <REDACTED_TOKEN>" | jq .
  ```
  - **Expected**: HTTP 200/204 with JSON response
  - **NOT**: `{"detail":"Not Found"}` (404)

- [ ] Backend health endpoint working (GET)
  ```bash
  curl -sS https://api.leoklemet.com/api/ready | jq .
  ```
  - **Expected**: HTTP 200 with `{"status":"ready"}` or similar

- [ ] OpenAPI accessible
  ```bash
  curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys | length'
  ```
  - **Expected**: Returns number > 0

---

## Verification - Configuration

- [ ] Backend has Watchtower label
  ```bash
  docker inspect portfolio-backend | jq '.[0].Config.Labels["com.centurylinklabs.watchtower.enable"]'
  ```
  - **Expected**: `"true"`

- [ ] Nginx has Watchtower label
  ```bash
  docker inspect portfolio-nginx | jq '.[0].Config.Labels["com.centurylinklabs.watchtower.enable"]'
  ```
  - **Expected**: `"true"`

- [ ] Environment token loaded
  ```bash
  docker exec portfolio-watchtower env | grep WATCHTOWER_HTTP_API_TOKEN
  ```
  - **Expected**: Shows token value

---

## Post-Bootstrap - GitHub Actions Test

- [ ] GitHub Secrets configured
  - Visit: https://github.com/leok974/leo-portfolio/settings/secrets/actions
  - Verify: `WATCHTOWER_HTTP_API_TOKEN` exists
  - Verify: `WATCHTOWER_UPDATE_URL` exists

- [ ] Trigger deployment workflow
  - Visit: https://github.com/leok974/leo-portfolio/actions
  - Click: "Redeploy Backend via Watchtower"
  - Click: "Run workflow" → "Run workflow"

- [ ] Workflow completes successfully
  - All steps pass with ✅
  - No 404 errors
  - Backend health check passes

---

## Post-Bootstrap - Backend Verification

- [ ] New backend code deployed
  ```bash
  curl -sS https://api.leoklemet.com/api/dev/status | jq .
  ```
  - **Expected**: `{"ok":true,"allowed":false,"mode":"denied",...}`
  - **NOT**: `{"detail":"Not Found"}`

- [ ] Route in OpenAPI schema
  ```bash
  curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | has("/api/dev/status")'
  ```
  - **Expected**: `true`

- [ ] Dev overlay works
  - Visit: https://www.leoklemet.com/?dev_overlay=dev
  - **Expected**: Badge displays and shows status

---

## Troubleshooting References

If any verification fails, see:

- **BOOTSTRAP_WATCHTOWER.md** - Full deployment guide with troubleshooting
- **WATCHTOWER_DEPLOYMENT_EXECUTION.md** - Detailed troubleshooting section
- **DEPLOYMENT_ATTEMPT_404_ANALYSIS.md** - Common error analysis

---

## Success Criteria Summary

**All of these must pass**:

✅ Watchtower container running  
✅ Watchtower logs show "HTTP API enabled"  
✅ `POST /ops/watchtower/update` returns 200/204  
✅ `GET /api/ready` returns 200  
✅ GitHub Action workflow succeeds  
✅ `/api/dev/status` returns 200 (not 404)  
✅ OpenAPI includes `/api/dev/status` route  

---

## What's Next

After all checks pass:

1. ✅ **Production is ready** for GitHub Actions deployments
2. ✅ **No more SSH needed** for backend updates
3. ✅ **One-click deployments** enabled
4. ✅ **Automated updates** every 5 minutes
5. ✅ **Force-pull anytime** via Actions button

---

## Sign-Off

- [ ] All checklist items verified
- [ ] GitHub Action tested successfully
- [ ] `/api/dev/status` endpoint working
- [ ] Documentation handoff complete

**Deployed by**: _________________  
**Date**: _________________  
**Notes**: _________________

---

**Status**: Ready for production use ✅
