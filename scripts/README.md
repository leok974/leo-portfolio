# Scripts Directory

Utility scripts for portfolio project management, deployment, and operations.

## 🔐 Cloudflare Management

### `set-cloudflare-credentials.ps1`
**Purpose:** Store Cloudflare API credentials persistently in Windows environment variables

**Usage:**
```powershell
.\scripts\set-cloudflare-credentials.ps1
```

**What it does:**
- Stores `CLOUDFLARE_API_TOKEN` and `CF_ZONE_ID` at user level
- Credentials persist across PowerShell sessions
- Available in all future terminal windows

**To remove credentials:**
```powershell
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $null, [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("CF_ZONE_ID", $null, [System.EnvironmentVariableTarget]::User)
```

### `purge-og-cache.ps1`
**Purpose:** Clear stale Cloudflare cache for OG social media images

**Prerequisites:** Run `set-cloudflare-credentials.ps1` first OR set env vars manually

**Usage:**
```powershell
.\scripts\purge-og-cache.ps1
```

**What it does:**
- Purges Cloudflare cache for all 7 OG images
- Uses Cloudflare API to force cache refresh
- Useful after deploying new OG images

**When to use:**
- After deploying OG image changes
- When E2E tests fail due to cached 404s
- After fixing nginx /og/ location config

---

## 📝 Other Scripts

### `infra-guard.sh`
**Purpose:** Verify Docker+Cloudflare Tunnel production setup

**Usage:**
```bash
wsl bash /mnt/d/leo-portfolio/scripts/infra-guard.sh
```

**What it checks:**
- Cloudflare Tunnel on infra_net
- portfolio-nginx network configuration
- DNS alias resolution (portfolio.int)
- Production headers (Cloudflare + x-config)

---

## 🔧 Configuration Files

### `.env.cloudflare`
**Location:** `D:\leo-portfolio\.env.cloudflare`  
**Purpose:** Backup storage for Cloudflare credentials  
**Security:** Listed in `.gitignore` - NEVER commit this file

**Contents:**
```env
CLOUDFLARE_API_TOKEN=...
CF_ZONE_ID=...
CF_DOMAIN=leoklemet.com
```

**Load credentials from file:**
```powershell
Get-Content .env.cloudflare | ForEach-Object {
  if ($_ -match '^([^=]+)=(.+)$') {
    $env:$($matches[1]) = $matches[2]
  }
}
```

---

## 📚 Related Documentation

- **OG_CACHE_PURGE_GUIDE.md** - Detailed guide for Cloudflare cache purging
- **DEPLOYMENT_SOURCE_OF_TRUTH.md** - Production deployment architecture
- **E2E_FIXES_COMPLETE.md** - E2E test improvements and deterministic waits

---

## 🛡️ Security Notes

1. **API Tokens:** Never commit to git, always use env vars or .env files
2. **Zone IDs:** Not secret but should be in .env for consistency
3. **Windows Environment Variables:** Stored at user level, not machine level
4. **PowerShell Session Vars:** Lost when session closes (use persistent setup)

---

## 🚀 Quick Start

```powershell
# 1. Store credentials once
.\scripts\set-cloudflare-credentials.ps1

# 2. Verify they're set
Write-Host $env:CLOUDFLARE_API_TOKEN.Substring(0,10)
Write-Host $env:CF_ZONE_ID

# 3. Use them in scripts
.\scripts\purge-og-cache.ps1

# 4. Verify production setup (WSL)
wsl bash /mnt/d/leo-portfolio/scripts/infra-guard.sh
```
