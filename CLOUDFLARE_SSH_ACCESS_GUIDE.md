# Cloudflare Access SSH Setup Guide

**Purpose**: Secure SSH access to production server via Cloudflare Zero Trust  
**Date**: October 22, 2025  
**Status**: Configuration ready, awaiting server upload

---

## ✅ What's Done

1. ✅ Tunnel configuration generated (`cloudflared/config-ssh.yml`)
2. ✅ Setup scripts created (PowerShell + Bash)
3. ✅ Runner registration token obtained: `BTGQ4IBYGBEHZVPCATZTKDDI7EWTO`

---

## ⏳ Manual Steps Required

### Step 1: Create Cloudflare Access Application (Dashboard UI)

**URL**: https://one.dash.cloudflare.com/access/apps

1. Click "Add an application"
2. Select "Self-hosted"
3. Configure:
   - **Application name**: `prod-ssh`
   - **Session duration**: `24h`
   - **Application domain**: `ssh.leoklemet.com`
   - **Application type**: Select "SSH" from dropdown
4. Click "Next"

5. **Create Policy**:
   - **Policy name**: `allow-leo`
   - **Action**: `Allow`
   - **Rule**: Include → Emails → Enter: `leoklemet.pa@gmail.com`
6. Click "Next", then "Add application"

---

### Step 2: Create DNS Record (Dashboard UI)

**URL**: https://dash.cloudflare.com/3fbdb3802ab36704e7c652ad03ccb390/dns/records

1. Click "Add record"
2. Configure:
   - **Type**: `CNAME`
   - **Name**: `ssh`
   - **Target**: `db56892d-4879-4263-99bf-202d46b6aff9.cfargotunnel.com`
   - **Proxy status**: Proxied (orange cloud)
   - **TTL**: Auto
3. Click "Save"

---

### Step 3: Upload Tunnel Config to Server

**How to access your server currently**: (You'll need existing SSH access or console)

Once connected, run:

```bash
# Create cloudflared config
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
tunnel: db56892d-4879-4263-99bf-202d46b6aff9
credentials-file: /etc/cloudflared/db56892d-4879-4263-99bf-202d46b6aff9.json

ingress:
  - hostname: ssh.leoklemet.com
    service: ssh://localhost:22
  - service: http_status:404
EOF

# Restart cloudflared tunnel
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager

# Verify tunnel is connected
sudo cloudflared tunnel info db56892d-4879-4263-99bf-202d46b6aff9
```

**Expected output**: Tunnel should show as "connected" with ingress rules for `ssh.leoklemet.com`

---

### Step 4: Install cloudflared Locally (Your Windows Machine)

```powershell
# Install via winget
winget install Cloudflare.cloudflared

# Verify installation
cloudflared --version
```

---

### Step 5: Configure Local SSH Client

```powershell
# Generate SSH config snippet
cloudflared access ssh-config --hostname ssh.leoklemet.com --short-lived-cert >> $env:USERPROFILE\.ssh\config

# View the generated config
Get-Content $env:USERPROFILE\.ssh\config | Select-String -Context 0,10 "ssh.leoklemet.com"
```

**What this does**:
- Adds `ProxyCommand` using `cloudflared access ssh`
- Enables short-lived certificate authentication
- Browser will open on first connect for Cloudflare Access auth

---

### Step 6: Test SSH Connection

```powershell
# Connect (replace 'ubuntu' with your server username)
ssh ubuntu@ssh.leoklemet.com
```

**First connection**:
1. Browser opens automatically
2. Sign in with `leoklemet.pa@gmail.com`
3. Cloudflare Access authenticates you
4. SSH session established

**Subsequent connections**: No browser required (uses cached token)

---

### Step 7: Start GitHub Actions Runner

Once SSH is working, run on the server:

```bash
# Remove any existing runner
sudo docker rm -f gh-runner-prod

# Start new runner with registration token
sudo docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="BTGQ4IBYGBEHZVPCATZTKDDI7EWTO" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest

# Watch logs
sudo docker logs -f gh-runner-prod
```

**Expected**: `"Connected to GitHub"` message in logs

---

### Step 8: Verify Runner Online

From your Windows machine:

```powershell
# Check runner status
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

---

## 🔒 Security Features

1. **Zero Trust Access**: No public SSH port (port 22 closed to internet)
2. **Browser Authentication**: Cloudflare Access enforces authentication
3. **Email Allowlist**: Only `leoklemet.pa@gmail.com` can connect
4. **Short-Lived Certs**: SSH certificates auto-rotate
5. **Audit Logs**: All connections logged in Cloudflare dashboard
6. **No VPN Required**: Access from anywhere with valid credentials

---

## 🔧 Troubleshooting

### Runner token expired
```bash
# Get new token (from Windows machine)
gh api -X POST repos/leok974/leo-portfolio/actions/runners/registration-token --jq '.token'

# Use new token in docker run command
```

### Tunnel not connecting
```bash
# Check tunnel status
sudo systemctl status cloudflared

# Check logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared
```

### SSH connection hangs
```powershell
# Test with verbose output
ssh -v ubuntu@ssh.leoklemet.com

# Check cloudflared is running locally
Get-Process cloudflared

# Re-run SSH config generation
cloudflared access ssh-config --hostname ssh.leoklemet.com --short-lived-cert
```

### Access denied in browser
- Verify email `leoklemet.pa@gmail.com` is added to allow policy
- Check policy is active in dashboard
- Try incognito/private browsing mode

---

## 📊 Verification Checklist

- [ ] Access app created in Cloudflare dashboard
- [ ] Allow policy configured for `leoklemet.pa@gmail.com`
- [ ] DNS record `ssh.leoklemet.com` points to tunnel
- [ ] Tunnel config uploaded to server
- [ ] Tunnel service restarted and connected
- [ ] `cloudflared` installed locally
- [ ] SSH config generated and appended
- [ ] SSH connection works (browser auth successful)
- [ ] GitHub runner started on server
- [ ] Runner shows "online" via API

---

## 🔗 Quick Links

- **Access Apps**: https://one.dash.cloudflare.com/access/apps
- **DNS Records**: https://dash.cloudflare.com/3fbdb3802ab36704e7c652ad03ccb390/dns/records
- **Tunnel Settings**: https://one.dash.cloudflare.com/networks/tunnels
- **GitHub Runners**: https://github.com/leok974/leo-portfolio/settings/actions/runners

---

## 📝 Notes

- **API Token Limitation**: Current Cloudflare API token doesn't have `Account:Access` scopes, so Access app + policy must be created via dashboard UI
- **Token Rotation**: Runner registration tokens expire after ~1 hour of inactivity; generate new one if needed
- **Tunnel ID**: `db56892d-4879-4263-99bf-202d46b6aff9` (existing tunnel, already configured)
- **Zone ID**: `3fbdb3802ab36704e7c652ad03ccb390` (leoklemet.com)

---

## 🎯 After Setup Complete

Return to `PROD_DEPLOYMENT_EXECUTION.md` and continue with:
- Step 6: Bootstrap Watchtower
- Step 7: Deploy Backend
- Endpoint verification
