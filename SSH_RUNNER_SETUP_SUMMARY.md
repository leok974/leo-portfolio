# SSH + Runner Setup - Complete Summary

**Date**: October 22, 2025  
**Branch**: `ssh`  
**Status**: ✅ Automation Complete, Ready for Server Execution

---

## 🎯 What Was Automated

### Scripts Created
1. **`scripts/setup-ssh-and-runner.ps1`** (PowerShell)
2. **`scripts/setup-ssh-and-runner.sh`** (Bash)

Both scripts perform identical operations:
- ✅ Auto-fetch Cloudflare account ID
- ✅ Generate tunnel ingress configuration
- ✅ Create/verify DNS CNAME record
- ✅ Create Cloudflare Access SSH application + policy
- ✅ Obtain fresh GitHub runner registration token
- ✅ Generate all server-side commands
- ✅ Provide verification steps

### Generated Artifacts
- **`cloudflared/config-ssh.yml`** - Tunnel ingress config for server
- **Fresh runner token**: `BTGQ4IG5IRZHWG3F5JMGFI3I7E3GM` (expires in ~1 hour)

---

## ✅ Execution Results

### What Worked
- ✓ Cloudflare account ID fetched automatically
- ✓ Tunnel configuration generated
- ✓ Runner token obtained via GitHub API
- ✓ cloudflared client detected (v2025.8.1)
- ✓ All server commands generated

### What Needs Manual Steps
- ⚠ **DNS Record**: API token lacks Zone:DNS Write scope
  - Create manually at: https://dash.cloudflare.com/3fbdb3802ab36704e7c652ad03ccb390/dns/records
  - Type: CNAME
  - Name: `ssh`
  - Target: `db56892d-4879-4263-99bf-202d46b6aff9.cfargotunnel.com`
  - Proxied: Yes

- ⚠ **Access App**: API token lacks Account:Access scopes
  - Create manually at: https://one.dash.cloudflare.com/access/apps
  - Type: SSH
  - Name: `prod-ssh`
  - Domain: `ssh.leoklemet.com`
  - Session: 24h
  - Policy: Allow `leoklemet.pa@gmail.com`

---

## 📋 Server Setup Commands

### 1. Upload Tunnel Configuration

```bash
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
tunnel: db56892d-4879-4263-99bf-202d46b6aff9
credentials-file: /etc/cloudflared/db56892d-4879-4263-99bf-202d46b6aff9.json

ingress:
  - hostname: ssh.leoklemet.com
    service: ssh://localhost:22
  - service: http_status:404
EOF

sudo systemctl restart cloudflared || sudo service cloudflared restart
sudo systemctl status cloudflared --no-pager || true
```

### 2. Install GitHub Runner

```bash
sudo docker rm -f gh-runner-prod 2>/dev/null || true

sudo docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="BTGQ4IG5IRZHWG3F5JMGFI3I7E3GM" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest

sudo docker logs -f gh-runner-prod --tail=50
```

**Expected output**: `"Connected to GitHub"`

---

## 🔧 Local Setup Commands

### 1. Configure SSH Client

```powershell
cloudflared access ssh-config --hostname ssh.leoklemet.com --short-lived-cert >> $env:USERPROFILE\.ssh\config
```

### 2. Test Connection

```powershell
ssh ubuntu@ssh.leoklemet.com
```

First connection will:
1. Open browser automatically
2. Prompt for Cloudflare Access authentication
3. Sign in with `leoklemet.pa@gmail.com`
4. Establish SSH session

---

## ✅ Verification Steps

### 1. DNS Resolution
```powershell
nslookup ssh.leoklemet.com
```
**Expected**: Should resolve to Cloudflare proxy IP

### 2. Runner Status
```powershell
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'
```
**Expected**:
```json
{
  "name": "prod-runner-1",
  "status": "online",
  "labels": ["self-hosted", "prod", "deploy"]
}
```

### 3. Tunnel Status (on server)
```bash
sudo systemctl status cloudflared --no-pager
sudo cloudflared tunnel info db56892d-4879-4263-99bf-202d46b6aff9
```

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| **Access Apps** | https://one.dash.cloudflare.com/access/apps |
| **DNS Records** | https://dash.cloudflare.com/3fbdb3802ab36704e7c652ad03ccb390/dns/records |
| **GitHub Runners** | https://github.com/leok974/leo-portfolio/settings/actions/runners |
| **Tunnel Dashboard** | https://one.dash.cloudflare.com/networks/tunnels |

---

## 📝 Configuration Details

| Setting | Value |
|---------|-------|
| **SSH Hostname** | ssh.leoklemet.com |
| **Tunnel ID** | db56892d-4879-4263-99bf-202d46b6aff9 |
| **Zone ID** | 3fbdb3802ab36704e7c652ad03ccb390 |
| **Allow Email** | leoklemet.pa@gmail.com |
| **Server User** | ubuntu |
| **Repo** | leok974/leo-portfolio |
| **Runner Name** | prod-runner-1 |
| **Runner Labels** | self-hosted,prod,deploy |

---

## 🚨 Important Notes

### Runner Token Expiration
- **Current token**: `BTGQ4IG5IRZHWG3F5JMGFI3I7E3GM`
- **Expires**: ~1 hour from generation (Oct 22, 2025)
- **If expired, regenerate**:
  ```powershell
  gh api -X POST repos/leok974/leo-portfolio/actions/runners/registration-token --jq '.token'
  ```

### API Token Scopes
Current Cloudflare API token is missing:
- `Account:Access:Apps Write`
- `Account:Access:Policies Write`
- `Zone:DNS Write`

To enable full automation, create new token with these scopes at:
https://dash.cloudflare.com/profile/api-tokens

### Security Recommendations
After setup is complete:

1. **Close public SSH port**:
   ```bash
   sudo ufw deny 22/tcp
   sudo ufw status
   ```

2. **Configure GitHub environment protection**:
   - Go to: https://github.com/leok974/leo-portfolio/settings/environments/production
   - Add required reviewer: `leok974`
   - Set deployment branches: `main` only

3. **Verify workflow security**:
   - All deploy workflows use `runs-on: [self-hosted, prod, deploy]`
   - Environment: `production` (requires approval)
   - Policy guard blocks PRs from using self-hosted runners

---

## 🎯 Success Criteria

- [ ] DNS record points `ssh.leoklemet.com` to tunnel
- [ ] Access app created with allow policy
- [ ] Tunnel ingress configured on server
- [ ] Tunnel service running and connected
- [ ] cloudflared installed locally
- [ ] SSH config generated
- [ ] SSH connection works (browser auth successful)
- [ ] GitHub runner container started
- [ ] Runner shows "online" via API
- [ ] Runner has labels: self-hosted, prod, deploy

---

## 🔄 Next Steps

1. **Create DNS record** (dashboard, 1 minute)
2. **Create Access app** (dashboard, 2 minutes)
3. **Access server** (via existing method or console)
4. **Run tunnel config** (copy/paste from above)
5. **Configure local SSH** (one command)
6. **Test SSH** (browser auth)
7. **Install runner** (copy/paste from above)
8. **Verify** (runner shows online)
9. **Continue with deployment**: See `PROD_DEPLOYMENT_EXECUTION.md` Step 6

---

## 📚 Related Documentation

- **Deployment Tracker**: `PROD_DEPLOYMENT_EXECUTION.md`
- **Previous SSH Guide**: `CLOUDFLARE_SSH_ACCESS_GUIDE.md`
- **Prod Runner Security**: `PROD_RUNNER_SECURITY_LOCKDOWN.md`
- **CLI Setup Guide**: `CLI_SETUP_GUIDE.md`

---

## ✨ What's Different From Previous Attempts

1. **Full automation**: One script does everything possible via API
2. **Graceful degradation**: Falls back to manual steps only when necessary
3. **Fresh tokens**: Auto-generates runner token (no hardcoded values)
4. **Environment loading**: Reads from .env files automatically
5. **Better error handling**: Shows exact API errors with remediation steps
6. **Complete output**: Generates all commands needed for server

---

**Status**: Ready for server execution once DNS + Access app are created manually (2-3 minutes in dashboard).
