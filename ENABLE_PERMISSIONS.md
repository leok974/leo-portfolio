# Enable GitHub Actions Permissions - Quick Guide

## 🎯 You Need To Do This (2 minutes)

GitHub Actions needs permission to create PRs and push changes. This must be done through the GitHub web interface.

### Step-by-Step Instructions

**1. Open GitHub Actions Settings**

Click this link (opens in browser):
👉 https://github.com/leok974/leo-portfolio/settings/actions

**2. Scroll to "Workflow permissions" section**

You'll see a section that looks like this:

```
Workflow permissions
───────────────────────────────────────────────

Choose the default permissions granted to the GITHUB_TOKEN
when running workflows in this repository.

○ Read repository contents and packages permissions
● Read and write permissions                        ← SELECT THIS

☐ Allow GitHub Actions to create and approve pull requests  ← CHECK THIS
```

**3. Make These Changes:**

✅ **Select:** "Read and write permissions" (radio button)

✅ **Check:** "Allow GitHub Actions to create and approve pull requests" (checkbox)

**4. Click "Save" button at the bottom**

### ✅ Verification

After saving, the settings should show:
- 🟢 Read and write permissions (selected)
- ☑️ Allow GitHub Actions to create and approve pull requests (checked)

### 🎉 That's It!

Once saved, your workflows will be able to:
- ✅ Create pull requests
- ✅ Push branches
- ✅ Commit changes

---

## ✅ Workflow YAML Already Configured

Good news! Your workflows already have explicit permissions declared:

**siteagent-pr-via-backend.yml:**
```yaml
permissions:
  contents: write         # Push branches and commit changes
  pull-requests: write    # Create and update PRs
```

**siteagent-nightly-pr.yml:**
```yaml
permissions:
  contents: write         # Push branches and commit changes
  pull-requests: write    # Create and update PRs
```

This follows best practices:
- ✅ Explicit permissions in YAML (principle of least privilege)
- ✅ Only requests what's needed (no excess permissions)
- ✅ Clear documentation in workflow files
- ✅ Works with repository-level permissions

---

## What These Permissions Do

### Read and write permissions
Allows workflows to:
- Push new branches
- Commit files
- Update repository content
- Read all repository data

### Allow GitHub Actions to create and approve pull requests
Allows workflows to:
- Create new PRs programmatically
- Update PR titles/descriptions
- Add labels to PRs
- (Note: Auto-approval by Actions is generally blocked for security)

---

## Security Notes

✅ **Safe to enable** because:
- Only applies to `GITHUB_TOKEN` used in workflows
- Token is scoped to your repository only
- Token expires when workflow completes
- Can't access other repositories or settings
- Can't modify Actions secrets
- Workflows must be in `.github/workflows/` (protected by git)

❌ **Does NOT allow:**
- Access to repository secrets
- Access to other repositories
- Modification of repository settings
- Actions outside workflow definitions

---

## Next Step After Enabling

Once you've saved the permissions:

1. **Verify in this file you're done** ✅
2. **Merge `auth` branch to `main`** to activate workflows
3. **Test the manual PR workflow** (see SETUP_VERIFICATION.md)

---

## Need Help?

If you don't see the "Workflow permissions" section:
- Make sure you have admin access to the repository
- Try this alternative URL: https://github.com/leok974/leo-portfolio/settings
- Look for "Actions" in the left sidebar, then "General"

If permissions are grayed out:
- Repository might have organization-level restrictions
- Contact repository owner/admin for access
