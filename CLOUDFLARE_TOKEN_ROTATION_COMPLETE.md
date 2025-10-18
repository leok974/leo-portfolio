# Cloudflare Token Rotation Complete ✅

## Summary

The Cloudflare API token has been successfully rotated on **October 18, 2025**.

### Old Token (REVOKED)
```
nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye
```
**Status:** ⚠️ Should be revoked in Cloudflare Dashboard (exposed in documentation)

### New Token (ACTIVE)
```
iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK
```
**Status:** ✅ Active and working

## ✅ Completed Steps

1. **Updated local scripts and files:**
   - ✅ `scripts/set-cloudflare-credentials.ps1` - Updated with new token
   - ✅ `.env.cloudflare` - Updated (local only, gitignored)
   - ✅ Documentation updated (CLOUDFLARE_CREDENTIALS_STORED.md, FINAL_HARDENING_COMPLETE.md, HARDENING_SUMMARY.md)

2. **Stored in Windows environment:**
   - ✅ `CLOUDFLARE_API_TOKEN` stored in user-level environment variables
   - ✅ `CF_ZONE_ID` stored in user-level environment variables
   - ✅ Available in all PowerShell sessions

3. **Tested and verified:**
   - ✅ Ran `.\scripts\purge-og-cache.ps1` successfully
   - ✅ Cache purged for all 7 OG images
   - ✅ New token working correctly

4. **Git commit:**
   - ✅ Commit: `78e9001` - "security: rotate Cloudflare API token"
   - ✅ Pushed to `portfolio-polish` branch

## 🔐 Remaining Action Items

### 1. Add Secrets to GitHub Repository

Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions

Click **"New repository secret"** and add:

**Secret 1:**
```
Name: CLOUDFLARE_API_TOKEN
Value: iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK
```

**Secret 2:**
```
Name: CF_ZONE_ID
Value: 3fbdb3802ab36704e7c652ad03ccb390
```

### 2. Revoke Old Token in Cloudflare

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Find token: `nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye`
3. Click **"Revoke"** to invalidate the old token

### 3. Test the Workflow

After adding secrets to GitHub:

1. Go to: https://github.com/leok974/leo-portfolio/actions/workflows/purge-og-cache.yml
2. Click **"Run workflow"**
3. Select branch: `portfolio-polish` (or `main`)
4. Leave input as `all` to purge all 7 images
5. Click **"Run workflow"**
6. Verify it completes successfully

## 📋 Verification Checklist

✅ New token stored locally in Windows environment variables  
✅ New token stored in `.env.cloudflare` (gitignored)  
✅ Scripts updated with new token  
✅ Documentation updated  
✅ Tested locally - cache purge works  
✅ Git commit and push complete  
⏳ **TODO:** Add secrets to GitHub repository  
⏳ **TODO:** Revoke old token in Cloudflare Dashboard  
⏳ **TODO:** Test GitHub Actions workflow  

## 🔍 Token Permissions

The new token has the following permissions:
- **Zone.Cache Purge** - For purging Cloudflare cache
- **Scope:** Zone `leoklemet.com` (ID: 3fbdb3802ab36704e7c652ad03ccb390)

This is the minimum required permission for the purge workflow.

## 📝 Usage

### Local Usage (PowerShell)
```powershell
# Already configured! Just run:
.\scripts\purge-og-cache.ps1
```

### GitHub Actions Usage
```yaml
# In .github/workflows/purge-og-cache.yml
env:
  CF_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CF_ZONE_ID: ${{ secrets.CF_ZONE_ID }}
```

## 🎯 Next Steps

1. **Add GitHub Secrets** (see instructions above)
2. **Revoke old token** in Cloudflare Dashboard
3. **Test workflow** to verify GitHub Actions can purge cache
4. **Merge** `portfolio-polish` → `main` when ready

---

**Token Rotation Date:** October 18, 2025  
**Commit:** 78e9001  
**Branch:** portfolio-polish  
**Status:** ✅ Complete (pending GitHub secrets setup)
