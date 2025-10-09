# grafanactl CLI Quick Reference

Quick reference for configuring and using the Grafana CLI (`grafanactl`) tool.

## Quick Setup Script

For interactive setup, use the provided script:

```powershell
# Interactive setup (current session only)
.\scripts\setup-grafanactl.ps1

# Save to PowerShell profile (persistent)
.\scripts\setup-grafanactl.ps1 -Permanent

# Specify server type directly
.\scripts\setup-grafanactl.ps1 -ServerType onprem
.\scripts\setup-grafanactl.ps1 -ServerType cloud
```

Or configure manually using the options below.

## Configuration

### Option A: Environment Variables (Recommended)

**Grafana Cloud:**
```powershell
# PowerShell
$env:GRAFANA_SERVER = "https://<your-stack>.grafana.net"
$env:GRAFANA_STACK_ID = "<your-stack-id>"
$env:GRAFANA_TOKEN = "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify
grafanactl config check
```

```bash
# Bash/Zsh
export GRAFANA_SERVER="https://<your-stack>.grafana.net"
export GRAFANA_STACK_ID="<your-stack-id>"
export GRAFANA_TOKEN="<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify
grafanactl config check
```

**On-Premise Grafana:**
```powershell
# PowerShell
$env:GRAFANA_SERVER = "http://localhost:3000"
$env:GRAFANA_ORG_ID = "1"  # Default org id is usually 1
$env:GRAFANA_TOKEN = "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify
grafanactl config check
```

```bash
# Bash/Zsh
export GRAFANA_SERVER="http://localhost:3000"
export GRAFANA_ORG_ID="1"
export GRAFANA_TOKEN="<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify
grafanactl config check
```

### Option B: Config File

Create `~/.grafana/config.yaml`:

```yaml
# For Grafana Cloud
server: "https://<your-stack>.grafana.net"
stack_id: "<your-stack-id>"
token: "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# For On-Premise Grafana
# server: "http://localhost:3000"
# org_id: 1
# token: "<YOUR_SERVICE_ACCOUNT_TOKEN>"
```

## Authentication

**Important:** `grafanactl` requires service account tokens or API tokens, not passwords.

### Create Service Account Token

1. **Via UI:**
   - Go to: http://localhost:3000/org/serviceaccounts
   - Click "Add service account"
   - Give it a name and role (Editor/Viewer)
   - Click "Add"
   - Click "Add service account token"
   - Copy the token immediately!

2. **Via API:**
   ```bash
   curl -X POST "$GRAFANA_SERVER/api/serviceaccounts" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "grafanactl-cli",
       "role": "Editor"
     }'
   ```

## Common Commands

### Verify Configuration
```bash
grafanactl config check
```

### Dashboard Operations
```bash
# List dashboards
grafanactl dashboard list

# Export dashboard
grafanactl dashboard export <uid> -o dashboard.json

# Import dashboard
grafanactl dashboard import dashboard.json

# Delete dashboard
grafanactl dashboard delete <uid>
```

### Datasource Operations
```bash
# List datasources
grafanactl datasource list

# Get datasource details
grafanactl datasource get <name>

# Create datasource
grafanactl datasource create -f datasource.json
```

### Organization Operations
```bash
# Get current org
grafanactl org current

# List orgs (requires admin)
grafanactl org list

# Switch org
grafanactl org switch <org-id>
```

## Testing Your Setup

### Test Token Manually
```powershell
# PowerShell
.\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN -GrafanaUrl $env:GRAFANA_SERVER
```

```bash
# Bash/Zsh (using curl)
# Health check (no auth)
curl "$GRAFANA_SERVER/api/health"

# Authenticated endpoint
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_SERVER/api/org"
```

### Verify grafanactl Connection
```bash
# Check config
grafanactl config check

# Test with simple query
grafanactl org current
```

## Security Best Practices

✅ **DO:**
- Use service account tokens (not user API keys)
- Store tokens in environment variables or secure vaults
- Use minimal required permissions (Editor/Viewer, not Admin)
- Set token expiration dates
- Rotate tokens periodically

❌ **DON'T:**
- Commit tokens to git repositories
- Share tokens between team members
- Use admin tokens for routine operations
- Store tokens in plain text config files in shared directories

## Troubleshooting

### "Connection failed"
```bash
# Verify Grafana is reachable
curl "$GRAFANA_SERVER/api/health"

# Check token format (should start with glsa_ for service accounts)
echo $GRAFANA_TOKEN | head -c 10
```

### "Unauthorized"
```bash
# Test token authentication
curl -v -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_SERVER/api/org"

# Check if token is expired (via Grafana UI)
# Go to: http://localhost:3000/org/serviceaccounts
```

### "Invalid configuration"
```bash
# Run diagnostic
grafanactl config check

# Verify all required vars are set
echo "Server: $GRAFANA_SERVER"
echo "Org/Stack ID: $GRAFANA_ORG_ID$GRAFANA_STACK_ID"
echo "Token set: $(if [ -n "$GRAFANA_TOKEN" ]; then echo 'Yes'; else echo 'No'; fi)"
```

## Environment Variable Reference

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `GRAFANA_SERVER` | ✅ Yes | Grafana instance URL | `http://localhost:3000` or `https://mystack.grafana.net` |
| `GRAFANA_ORG_ID` | On-prem | Organization ID (default: 1) | `1` |
| `GRAFANA_STACK_ID` | Cloud | Grafana Cloud stack ID | `123456` |
| `GRAFANA_TOKEN` | ✅ Yes | Service account or API token | `glsa_...` or `eyJrIjoi...` |

## Integration with This Project

For the SEO Meta automation dashboard:

```powershell
# Set up environment
$env:GRAFANA_SERVER = "http://localhost:3000"
$env:GRAFANA_ORG_ID = "1"
$env:GRAFANA_TOKEN = "<your-token>"

# Verify setup
.\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN

# Check configuration
grafanactl config check

# Import the SEO Meta dashboard
grafanactl dashboard import grafana/seo-meta-auto-dashboard.json
```

## Documentation

- [Grafana CLI Documentation](https://grafana.com/docs/grafana/latest/cli/)
- [Service Accounts](https://grafana.com/docs/grafana/latest/administration/service-accounts/)
- [API Authentication](https://grafana.com/docs/grafana/latest/developers/http_api/auth/)

---

**Quick Setup Checklist:**
- [ ] Install grafanactl CLI
- [ ] Create service account token in Grafana
- [ ] Set environment variables (SERVER, ORG_ID/STACK_ID, TOKEN)
- [ ] Run `grafanactl config check`
- [ ] Test with `grafanactl org current`
- [ ] Import dashboard: `grafanactl dashboard import grafana/seo-meta-auto-dashboard.json`
