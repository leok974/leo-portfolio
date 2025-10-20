# Agent Refresh - Quick Command Reference

## 🚀 Deployment Commands

### 1. Authenticate with Cloudflare
```powershell
# Option A: Clear existing token and login via browser
$env:CLOUDFLARE_API_TOKEN = $null
wrangler login

# Option B: Set API token (from Cloudflare dashboard)
$env:CLOUDFLARE_API_TOKEN = "your-token-here"

# Verify authentication
wrangler whoami
```

### 2. Set Worker Secrets
```powershell
cd d:\leo-portfolio\cloudflare-workers

# Set GitHub PAT (paste when prompted)
wrangler secret put GH_PAT

# Set ALLOW_KEY (paste: SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=)
wrangler secret put ALLOW_KEY

# Verify secrets are set
wrangler secret list
```

### 3. Deploy Worker
```powershell
wrangler deploy
```

Save the worker URL from output!

---

## 🧪 Testing Commands

### Quick Status Check
```powershell
$env:VITE_AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="
$env:VITE_AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"

# PowerShell
Invoke-RestMethod -Uri "$env:VITE_AGENT_REFRESH_URL/agent/refresh/status" `
    -Headers @{"x-agent-key"=$env:VITE_AGENT_ALLOW_KEY}

# Or curl
curl -H "x-agent-key: $env:VITE_AGENT_ALLOW_KEY" "$env:VITE_AGENT_REFRESH_URL/agent/refresh/status"
```

### Test Dispatch
```powershell
$body = @{reason="manual-test"; ref="main"} | ConvertTo-Json

Invoke-RestMethod -Uri $env:VITE_AGENT_REFRESH_URL `
    -Method Post `
    -Headers @{"content-type"="application/json"; "x-agent-key"=$env:VITE_AGENT_ALLOW_KEY} `
    -Body $body
```

### Full Smoke Test Suite
```powershell
.\scripts\test-agent-refresh.ps1 `
    -WorkerUrl $env:VITE_AGENT_REFRESH_URL `
    -AllowKey $env:VITE_AGENT_ALLOW_KEY
```

---

## 📊 Monitoring Commands

### GitHub Actions
```powershell
# List recent runs
gh run list --workflow=refresh-content.yml --limit 5

# View latest run
gh run view --workflow=refresh-content.yml

# Watch run in real-time
gh run watch

# View specific run logs
gh run view <RUN_ID> --log
```

### Cloudflare Worker
```powershell
cd d:\leo-portfolio\cloudflare-workers

# Live logs
wrangler tail

# List deployments
wrangler deployments list

# View deployment details
wrangler deployments view <DEPLOYMENT_ID>
```

---

## 🧪 E2E Tests

### Status Endpoint Test
```powershell
$env:AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"
$env:AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

npx playwright test tests/e2e/agent.refresh.status.spec.ts
```

### All Agent Tests
```powershell
npx playwright test tests/e2e/agent.refresh*.spec.ts
```

---

## 🔧 Troubleshooting Commands

### Check Secrets
```powershell
wrangler secret list
# Should show: GH_PAT, ALLOW_KEY
```

### Test GitHub PAT
```powershell
$ghPat = "your-gh-pat-here"
$repo = "leok974/leo-portfolio"

# List workflows
Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/workflows" `
    -Headers @{"Authorization"="Bearer $ghPat"; "Accept"="application/vnd.github+json"}
```

### Check REPO Variable
```powershell
# View wrangler.toml
Get-Content cloudflare-workers\wrangler.toml | Select-String -Pattern "REPO"
```

### Verify Frontend Config
```powershell
Get-Content apps\portfolio-ui\.env.local
```

---

## 🎯 Copy-Paste Ready Commands

### Complete Deployment (After Auth)
```powershell
cd d:\leo-portfolio\cloudflare-workers

# Deploy and set secrets (interactive)
wrangler deploy
wrangler secret put GH_PAT
wrangler secret put ALLOW_KEY
```

### Complete Testing
```powershell
# Set environment
$env:VITE_AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"
$env:VITE_AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

# Test status
Invoke-RestMethod -Uri "$env:VITE_AGENT_REFRESH_URL/agent/refresh/status" `
    -Headers @{"x-agent-key"=$env:VITE_AGENT_ALLOW_KEY}

# Check GitHub runs
gh run list --workflow=refresh-content.yml --limit 3
```

---

## 📝 Key Values Reference

**ALLOW_KEY:**
```
SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=
```

**Worker URL (example):**
```
https://agent-refresh.leoklemet.workers.dev
```

**REPO:**
```
leok974/leo-portfolio
```

**Workflow:**
```
refresh-content.yml
```

---

## ✅ Verification Checklist

Run these in order:

```powershell
# 1. Auth works
wrangler whoami

# 2. Secrets set
wrangler secret list

# 3. Worker responds
curl -H "x-agent-key: SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=" `
    https://agent-refresh.leoklemet.workers.dev/agent/refresh/status

# 4. GitHub Actions accessible
gh run list --workflow=refresh-content.yml --limit 1

# 5. Frontend config exists
Test-Path apps\portfolio-ui\.env.local
```

All should succeed! ✅
