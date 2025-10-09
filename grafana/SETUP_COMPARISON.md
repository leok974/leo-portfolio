# Grafana Setup Methods Comparison

Quick comparison of different Grafana setup and configuration approaches for the SEO Meta dashboard.

## Overview Table

| Method | Use Case | Time | Complexity | Persistence |
|--------|----------|------|------------|-------------|
| **Interactive Script** | First-time setup | 2 min | ⭐ Easy | Session or Profile |
| **Manual Env Vars** | Quick testing | 1 min | ⭐⭐ Medium | Session only |
| **Config File** | Long-term use | 3 min | ⭐⭐ Medium | Permanent |
| **VS Code Extension** | Dashboard editing | 5 min | ⭐⭐⭐ Advanced | Permanent |
| **grafanactl CLI** | Automation/CI | 3 min | ⭐⭐ Medium | Session or permanent |

## Method Details

### 1. Interactive Script (Recommended for Getting Started)

**Best for:** First-time users, quick setup

```powershell
# Run interactive setup
.\scripts\setup-grafanactl.ps1

# Or save to profile for persistence
.\scripts\setup-grafanactl.ps1 -Permanent
```

**Pros:**
- ✅ Guided step-by-step process
- ✅ Validates configuration automatically
- ✅ Secure token input (hidden)
- ✅ Tests connection immediately
- ✅ Works for both on-premise and cloud

**Cons:**
- ❌ Requires PowerShell

**Documentation:** See `scripts/setup-grafanactl.ps1`

---

### 2. Manual Environment Variables

**Best for:** Quick testing, temporary sessions

**On-Premise:**
```powershell
$env:GRAFANA_SERVER = "http://localhost:3000"
$env:GRAFANA_ORG_ID = "1"
$env:GRAFANA_TOKEN = "<your-token>"
grafanactl config check
```

**Cloud:**
```powershell
$env:GRAFANA_SERVER = "https://<stack>.grafana.net"
$env:GRAFANA_STACK_ID = "<stack-id>"
$env:GRAFANA_TOKEN = "<your-token>"
grafanactl config check
```

**Pros:**
- ✅ Fast and simple
- ✅ No files needed
- ✅ Easy to change

**Cons:**
- ❌ Not persistent (lost on session close)
- ❌ Manual token copy-paste
- ❌ No validation

**Documentation:** See `grafana/GRAFANACTL_QUICKREF.md`

---

### 3. Config File

**Best for:** Long-term use, shared team settings

Create `~/.grafana/config.yaml`:

```yaml
# On-Premise
server: "http://localhost:3000"
org_id: 1
token: "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Or Cloud
# server: "https://<stack>.grafana.net"
# stack_id: "<stack-id>"
# token: "<YOUR_SERVICE_ACCOUNT_TOKEN>"
```

**Pros:**
- ✅ Persistent across sessions
- ✅ Cleaner environment
- ✅ Can be version-controlled (without token!)

**Cons:**
- ❌ File management required
- ❌ Token in plain text (use .gitignore!)
- ❌ Less flexible for multi-env

**Documentation:** See `grafana/GRAFANACTL_QUICKREF.md`

---

### 4. VS Code Extension

**Best for:** Dashboard development and editing

**Setup:**
1. Install extension: `code --install-extension Grafana.grafana-vscode`
2. Set token via Command Palette: "Grafana: Set your token, securely"
3. Configure URL in `.vscode/settings.json` (already done!)

**Pros:**
- ✅ Visual dashboard editing
- ✅ IntelliSense for queries
- ✅ Token in VS Code secure storage
- ✅ Direct Git integration

**Cons:**
- ❌ VS Code only
- ❌ Requires extension installation
- ❌ More setup steps

**Documentation:** See `docs/GRAFANA_VSCODE_SETUP.md`

---

### 5. grafanactl CLI

**Best for:** Automation, CI/CD, scripting

**Setup:**
```bash
# Set env vars (see methods 1-2)
export GRAFANA_SERVER="http://localhost:3000"
export GRAFANA_ORG_ID="1"
export GRAFANA_TOKEN="<token>"

# Use CLI
grafanactl dashboard list
grafanactl dashboard import grafana/seo-meta-auto-dashboard.json
```

**Pros:**
- ✅ Automation-friendly
- ✅ Scriptable operations
- ✅ Batch operations
- ✅ CI/CD integration

**Cons:**
- ❌ Requires CLI installation
- ❌ Command-line only
- ❌ Steeper learning curve

**Documentation:** See `grafana/GRAFANACTL_QUICKREF.md`

---

## Decision Matrix

### Choose Interactive Script if:
- 🎯 First time setting up Grafana
- 🎯 Want guided, foolproof setup
- 🎯 Need validation and testing
- 🎯 Using PowerShell

### Choose Manual Env Vars if:
- 🎯 Quick one-time testing
- 🎯 Temporary session
- 🎯 Already familiar with Grafana
- 🎯 Don't need persistence

### Choose Config File if:
- 🎯 Long-term production use
- 🎯 Multiple team members
- 🎯 Want clean environment
- 🎯 Can secure the config file

### Choose VS Code Extension if:
- 🎯 Developing dashboards
- 🎯 Need visual editor
- 🎯 Want Git integration
- 🎯 Prefer IDE workflow

### Choose grafanactl CLI if:
- 🎯 Automating workflows
- 🎯 CI/CD pipeline
- 🎯 Batch operations
- 🎯 Scripting tasks

---

## Security Comparison

| Method | Token Storage | Risk Level | Best Practice |
|--------|---------------|------------|---------------|
| Interactive Script | Session env var | 🟡 Medium | Use `-Permanent` cautiously |
| Manual Env Vars | Session env var | 🟡 Medium | Clear after use |
| Config File | Plain text file | 🔴 High | Use .gitignore, file permissions |
| VS Code Extension | VS Code secrets | 🟢 Low | Recommended for dev |
| grafanactl CLI | Env var or file | 🟡 Medium | Use CI secrets for automation |

**Security Best Practices:**
1. ✅ Never commit tokens to git
2. ✅ Use service account tokens (not user API keys)
3. ✅ Set minimal required permissions (Editor/Viewer)
4. ✅ Rotate tokens periodically
5. ✅ Use CI/CD secret management for automation
6. ✅ Clear environment variables after use: `Remove-Item Env:\GRAFANA_TOKEN`

---

## Testing Your Setup

Regardless of method chosen, test with:

```powershell
# Test token connectivity
.\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN

# Or manually
curl -H "Authorization: Bearer $env:GRAFANA_TOKEN" "$env:GRAFANA_SERVER/api/org"

# Or with grafanactl
grafanactl config check
grafanactl org current
```

---

## Migration Path

**Recommended progression:**

1. **Start:** Interactive Script (learn the basics)
2. **Development:** VS Code Extension (edit dashboards)
3. **Production:** Config File or CI Secrets (long-term stability)
4. **Automation:** grafanactl CLI (scripting and CI/CD)

---

## Quick Reference Commands

### Interactive Setup
```powershell
.\scripts\setup-grafanactl.ps1
```

### Test Token
```powershell
.\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN
```

### Manual Config (On-Premise)
```powershell
$env:GRAFANA_SERVER = "http://localhost:3000"
$env:GRAFANA_ORG_ID = "1"
$env:GRAFANA_TOKEN = "<your-token>"
grafanactl config check
```

### Import Dashboard (Any Method)
```bash
grafanactl dashboard import grafana/seo-meta-auto-dashboard.json
```

---

## Documentation Index

- 📖 **Full Setup Guide**: [`docs/GRAFANA_SETUP.md`](../docs/GRAFANA_SETUP.md)
- 🔧 **VS Code Extension**: [`docs/GRAFANA_VSCODE_SETUP.md`](../docs/GRAFANA_VSCODE_SETUP.md)
- ⚡ **Quick Setup (5 min)**: [`grafana/QUICK_SETUP.md`](QUICK_SETUP.md)
- 🛠️ **CLI Reference**: [`grafana/GRAFANACTL_QUICKREF.md`](GRAFANACTL_QUICKREF.md)
- 🎯 **This Comparison**: [`grafana/SETUP_COMPARISON.md`](SETUP_COMPARISON.md)

---

**Last Updated:** 2025-01-08
**Grafana Version:** 9.0+
**Infinity Plugin:** v2.12.2+
