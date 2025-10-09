# Grafana Setup Documentation Index

Complete guide to Grafana dashboard setup for the SEO Meta automation project.

## 📚 Documentation Suite

### 1. **Getting Started**

Choose your path based on experience level and needs:

| Document | Audience | Time | Purpose |
|----------|----------|------|---------|
| **[Quick Setup](QUICK_SETUP.md)** | Experienced users | 5 min | Express setup with copy-paste commands |
| **[Setup Comparison](SETUP_COMPARISON.md)** | Decision makers | 10 min | Compare methods and choose best approach |
| **[Full Setup Guide](../docs/GRAFANA_SETUP.md)** | All users | 20 min | Comprehensive step-by-step walkthrough |

### 2. **Configuration Methods**

Different ways to configure Grafana access:

| Method | Document | Best For |
|--------|----------|----------|
| **Interactive Script** | [Setup Script](#helper-scripts) | First-time users, guided setup |
| **Manual Environment Variables** | [CLI Quick Reference](GRAFANACTL_QUICKREF.md) | Quick testing, temporary sessions |
| **Config File** | [CLI Quick Reference](GRAFANACTL_QUICKREF.md) | Long-term use, team sharing |
| **VS Code Extension** | [VS Code Setup](../docs/GRAFANA_VSCODE_SETUP.md) | Dashboard development |
| **grafanactl CLI** | [CLI Quick Reference](GRAFANACTL_QUICKREF.md) | Automation, CI/CD |

### 3. **Advanced Topics**

| Document | Topics Covered |
|----------|----------------|
| **[VS Code Setup](../docs/GRAFANA_VSCODE_SETUP.md)** | Extension installation, secure tokens, grafanactl config |
| **[CLI Quick Reference](GRAFANACTL_QUICKREF.md)** | Commands, authentication, troubleshooting, security |
| **[Setup Comparison](SETUP_COMPARISON.md)** | Method comparison, decision matrix, migration path |

## 🛠️ Helper Scripts

Located in `scripts/` directory:

### **setup-grafanactl.ps1** (NEW!)
Interactive guided setup for grafanactl CLI.

```powershell
# Interactive setup
.\scripts\setup-grafanactl.ps1

# Save to PowerShell profile (persistent)
.\scripts\setup-grafanactl.ps1 -Permanent

# Specify server type
.\scripts\setup-grafanactl.ps1 -ServerType onprem
.\scripts\setup-grafanactl.ps1 -ServerType cloud
```

**Features:**
- ✅ Guided step-by-step configuration
- ✅ Supports on-premise and cloud
- ✅ Secure password-style token input
- ✅ Built-in connectivity testing
- ✅ Optional profile persistence

### **test-grafana-token.ps1** (UPDATED)
Test API token connectivity and permissions.

```powershell
# With environment variable
$env:GRAFANA_TOKEN = "your-token"
.\scripts\test-grafana-token.ps1

# Direct token
.\scripts\test-grafana-token.ps1 -Token "your-token"

# Custom server
.\scripts\test-grafana-token.ps1 -Token "your-token" -GrafanaUrl "https://grafana.example.com"
```

**Tests:**
- ✅ Health endpoint (no auth)
- ✅ Organization access
- ✅ Datasources (including Infinity plugin)
- ✅ Dashboards (including SEO Meta)
- ✅ Displays grafanactl setup instructions

## 🚀 Quick Start Paths

### Path 1: Absolute Beginner (Recommended)

1. **Read**: [Setup Comparison](SETUP_COMPARISON.md) to understand options
2. **Run**: `.\scripts\setup-grafanactl.ps1` for guided setup
3. **Test**: Verify with built-in connection test
4. **Import**: Dashboard via Grafana UI

**Time:** ~10 minutes
**Complexity:** ⭐ Easy

---

### Path 2: Experienced User (Fastest)

1. **Follow**: [Quick Setup](QUICK_SETUP.md) (5 minutes)
2. **Set**: Environment variables manually
3. **Import**: `grafana/seo-meta-auto-dashboard.json`
4. **Update**: Panel URLs

**Time:** ~5 minutes
**Complexity:** ⭐⭐ Medium

---

### Path 3: Developer (Most Powerful)

1. **Install**: VS Code Grafana extension
2. **Configure**: Token via Command Palette
3. **Setup**: grafanactl CLI with env vars
4. **Edit**: Dashboards directly in VS Code

**Time:** ~15 minutes
**Complexity:** ⭐⭐⭐ Advanced

**Follow:** [VS Code Setup Guide](../docs/GRAFANA_VSCODE_SETUP.md)

---

### Path 4: Automation/CI/CD

1. **Setup**: grafanactl CLI via config file or env vars
2. **Store**: Token in CI secrets management
3. **Script**: Dashboard import and updates
4. **Monitor**: Use API endpoint for verification

**Time:** ~20 minutes
**Complexity:** ⭐⭐⭐ Advanced

**Follow:** [CLI Quick Reference](GRAFANACTL_QUICKREF.md)

## 📊 Dashboard Details

### SEO Meta Auto Dashboard

**Location:** `grafana/seo-meta-auto-dashboard.json`

**Panels:**
1. **Timeseries** - Pages vs Over-Limit trend (180 days)
2. **Stat Boxes** - Last run metrics (pages, over-limit, skipped)
3. **Table** - Recent 20 runs with PR links

**Data Source:** Infinity plugin (CSV)

**Data Options:**
- **Option A**: API endpoint - `/agent/metrics/seo-meta-auto.csv`
- **Option B**: GitHub raw URL - `https://raw.githubusercontent.com/<owner>/<repo>/metrics/agent/metrics/seo-meta-auto.csv`

## 🔒 Security Best Practices

### Token Management

✅ **DO:**
- Use service account tokens (not user API keys)
- Store in VS Code secret storage or CI secrets
- Set minimal required permissions (Editor/Viewer)
- Rotate tokens periodically
- Use `.gitignore` for config files with tokens
- Clear environment variables after use

❌ **DON'T:**
- Commit tokens to git repositories
- Share tokens between team members
- Use admin tokens for routine operations
- Store tokens in plain text in shared locations
- Hardcode tokens in scripts

### Recommended Token Permissions

| Use Case | Role | Expiration |
|----------|------|------------|
| **Read-only viewing** | Viewer | 90 days |
| **Dashboard editing** | Editor | 90 days |
| **Development** | Editor | 30 days |
| **CI/CD automation** | Editor | No expiration (with rotation plan) |
| **Production operations** | Admin | Avoid if possible |

## 🔧 Troubleshooting

### Common Issues

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| "Connection failed" | Grafana not running | Check with `curl http://localhost:3000/api/health` |
| "Unauthorized" | Invalid/expired token | Create new token and reconfigure |
| "Infinity not found" | Plugin not installed | Follow [Full Setup Guide](../docs/GRAFANA_SETUP.md) Step 1 |
| "No data" in panels | Wrong URL or missing data | Verify metrics exist and URL is correct |
| grafanactl command not found | CLI not installed or not in PATH | Install grafanactl or use test script |

### Diagnostic Steps

1. **Test Grafana connection:**
   ```powershell
   curl http://localhost:3000/api/health
   ```

2. **Test token:**
   ```powershell
   .\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN
   ```

3. **Verify Infinity plugin:**
   - Via Docker: `docker exec grafana ls /var/lib/grafana/plugins/yesoreyeram-infinity-datasource`
   - Via UI: http://localhost:3000/plugins

4. **Check metrics data:**
   - JSONL: Check `metrics` branch for `agent/metrics/seo-meta-auto.jsonl`
   - CSV: Check `metrics` branch for `agent/metrics/seo-meta-auto.csv`
   - API: `curl http://localhost:8001/agent/metrics/seo-meta-auto.csv?limit_days=7`

## 📈 Complete Metrics Pipeline

Understanding the full flow:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Nightly Workflow                                        │
│     (.github/workflows/siteagent-meta-auto.yml)             │
│     - Runs at 03:28 UTC                                     │
│     - Generates metrics JSON                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Metrics JSON → JSONL                                    │
│     - Appends to metrics branch                             │
│     - File: agent/metrics/seo-meta-auto.jsonl               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CSV Generation Workflow                                 │
│     (.github/workflows/siteagent-metrics-csv.yml)           │
│     - Runs daily at 04:12 UTC + on JSONL changes           │
│     - Converts JSONL to CSV (rolling 90 days)              │
│     - File: agent/metrics/seo-meta-auto.csv                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Data Access                                             │
│     Option A: API endpoint                                  │
│       GET /agent/metrics/seo-meta-auto.csv?limit_days=N     │
│     Option B: GitHub raw URL                                │
│       https://raw.githubusercontent.com/.../metrics/...     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Grafana Visualization                                   │
│     - Infinity datasource fetches CSV                       │
│     - 3 panels display metrics                              │
│     - Auto-refresh every 5 minutes                          │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Decision Guide

**Choose your setup method:**

```
Are you setting up for the first time?
├─ Yes → Use setup-grafanactl.ps1 script
└─ No
   └─ Do you need to edit dashboards?
      ├─ Yes → Install VS Code extension
      └─ No
         └─ Do you need CLI automation?
            ├─ Yes → Configure grafanactl
            └─ No → Use Quick Setup (manual)
```

**Need help deciding?** See [Setup Comparison](SETUP_COMPARISON.md)

## 📖 Full Documentation Links

### Primary Guides
- 📘 [Full Setup Guide](../docs/GRAFANA_SETUP.md) - Comprehensive walkthrough
- ⚡ [Quick Setup](QUICK_SETUP.md) - 5-minute express setup
- 🔧 [VS Code Extension Setup](../docs/GRAFANA_VSCODE_SETUP.md) - Dashboard editing
- 🛠️ [grafanactl CLI Reference](GRAFANACTL_QUICKREF.md) - Command-line tools
- 📊 [Setup Method Comparison](SETUP_COMPARISON.md) - Choose best approach

### Helper Scripts
- 🎯 [setup-grafanactl.ps1](../scripts/setup-grafanactl.ps1) - Interactive setup
- 🧪 [test-grafana-token.ps1](../scripts/test-grafana-token.ps1) - Test connectivity

### Project Documentation
- 📄 [README.md](../README.md) - Project overview
- 📝 [OPERATIONS.md](../docs/OPERATIONS.md) - Operational runbook

## 🆘 Getting Help

1. **Check documentation:**
   - Start with [Setup Comparison](SETUP_COMPARISON.md)
   - Review [Troubleshooting](#troubleshooting) section

2. **Run diagnostics:**
   ```powershell
   .\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN
   ```

3. **Verify components:**
   - Grafana running: `curl http://localhost:3000/api/health`
   - Infinity plugin installed: Check Grafana UI
   - Metrics data exists: Check `metrics` branch

4. **Review security:**
   - Token permissions correct?
   - Token not expired?
   - Correct org/stack ID?

## 📝 Notes

- **Grafana Version:** 9.0+ recommended
- **Infinity Plugin:** v2.12.2+ required
- **Metrics Retention:** 90 days by default (configurable)
- **Dashboard Refresh:** Every 5 minutes (configurable)
- **Data Source:** CSV via Infinity plugin (HTTP or GitHub raw)

---

**Last Updated:** 2025-01-08
**Project:** leo-portfolio SEO Meta Automation
**Dashboard:** `grafana/seo-meta-auto-dashboard.json`
**Metrics Branch:** `metrics`
