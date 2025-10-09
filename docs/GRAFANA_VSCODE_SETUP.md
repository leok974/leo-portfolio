# Grafana VS Code Extension Setup

## Quick Setup

The Grafana VS Code extension allows you to edit dashboards, queries, and panels directly from VS Code.

### 1. Install Extension

```bash
code --install-extension Grafana.grafana-vscode
```

Or install via VS Code:
- Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
- Search for "Grafana"
- Click Install on "Grafana" by Grafana Labs

### 2. Create a Service Account in Grafana

**Important:** The extension requires a Service Account token (not an API key).

1. Open Grafana: http://localhost:3000/org/serviceaccounts
2. Login (default: admin/admin)
3. Click **"Add service account"**
4. Configure:
   - **Display name**: `VS Code Extension`
   - **Role**: `Editor` (to create/edit dashboards) or `Viewer` (read-only)
5. Click **"Create"**
6. Click **"Add service account token"**
7. Click **"Generate token"**
8. **Copy the token immediately!** (You won't see it again)

### 3. Configure Token in VS Code Settings

**Important:** The token is set via Settings UI (not Command Palette).

1. **Open VS Code Settings:**
   - Windows/Linux: Press `Ctrl+,` (Ctrl + comma)
   - Mac: Press `Cmd+,` (Cmd + comma)
   - Or go to: **File → Preferences → Settings**

2. **Search for Grafana:**
   - In the search box at the top, type: `grafana`
   - You'll see the **Extensions** section with Grafana settings

3. **Set Your Token:**
   - Look for: **"Grafana-vscode: Service Account Token"**
   - Click the button: **"Set your token, securely"**
   - Paste your token in the popup
   - Press **ENTER**

The token is stored securely in your operating system's secret store (not in settings.json or any file).

### 4. Verify Connection

The extension should now be connected. To verify:

1. Look for the **Grafana icon** in the VS Code sidebar (left panel)
2. Click it to browse your dashboards
3. If you see your dashboards, it's working! ✅

## Using Grafana CLI (grafanactl)

If you're using the new `grafanactl` CLI tool for dashboard management, you'll need to configure it with your Grafana server details and a service account token.

### Quick Setup (Interactive)

Use the provided setup script for guided configuration:

```powershell
# Interactive setup
.\scripts\setup-grafanactl.ps1

# Or save to profile (persistent across sessions)
.\scripts\setup-grafanactl.ps1 -Permanent
```

### Configuration via Environment Variables (Recommended)

**For Grafana Cloud:**

```powershell
# PowerShell
$env:GRAFANA_SERVER = "https://<your-stack>.grafana.net"
$env:GRAFANA_STACK_ID = "<your-stack-id>"  # Cloud uses stack-id
$env:GRAFANA_TOKEN = "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify configuration
grafanactl config check
```

```bash
# Bash/Zsh (Linux/Mac)
export GRAFANA_SERVER="https://<your-stack>.grafana.net"
export GRAFANA_STACK_ID="<your-stack-id>"
export GRAFANA_TOKEN="<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify configuration
grafanactl config check
```

**For On-Premise Grafana:**

```powershell
# PowerShell
$env:GRAFANA_SERVER = "http://localhost:3000"
$env:GRAFANA_ORG_ID = "1"  # Default org id is usually 1
$env:GRAFANA_TOKEN = "<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify configuration
grafanactl config check
```

```bash
# Bash/Zsh (Linux/Mac)
export GRAFANA_SERVER="http://localhost:3000"
export GRAFANA_ORG_ID="1"  # Default org id is usually 1
export GRAFANA_TOKEN="<YOUR_SERVICE_ACCOUNT_TOKEN>"

# Verify configuration
grafanactl config check
```

### Configuration via Config File

Alternatively, create a `~/.grafana/config.yaml` file:

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

### Important Notes

- **Use Service Account Tokens**: `grafanactl` requires service account/API tokens, not passwords
- **Token Storage**: For local dev, environment variables work well. For CI/CD, use secrets management
- **Verification**: Always run `grafanactl config check` after configuration
- **Security**: Never commit tokens to version control

### Testing Your Configuration

Use the provided test script to verify your setup:

```powershell
.\scripts\test-grafana-token.ps1 -Token $env:GRAFANA_TOKEN -GrafanaUrl $env:GRAFANA_SERVER
```

Or test manually:

```powershell
# Test health endpoint
curl "$env:GRAFANA_SERVER/api/health"

# Test authenticated endpoint
curl -H "Authorization: Bearer $env:GRAFANA_TOKEN" "$env:GRAFANA_SERVER/api/org"
```

## Using the Extension

Once configured, you can:

- **Browse Dashboards**: View sidebar → Grafana icon
- **Edit Dashboards**: Right-click → "Edit in VS Code"
- **Create Queries**: Use IntelliSense for datasource queries
- **Test Queries**: Run queries directly from VS Code
- **Sync Changes**: Push/pull dashboard changes

## Configuration

The workspace is pre-configured with:

- **Grafana URL**: `http://localhost:3000` (see `.vscode/settings.json`)
- **Extension Recommendation**: Already added to workspace

To change the Grafana URL:
1. Edit `.vscode/settings.json`
2. Update `"grafana-vscode.URL"` value
3. For remote Grafana instances, use: `"https://your-stack.grafana.net"`

## Troubleshooting

**Token setting not showing in Settings:**
- Make sure you've installed the extension: `code --install-extension Grafana.grafana-vscode`
- Reload VS Code window: Press `Ctrl+Shift+P` → type "reload" → select "Developer: Reload Window"
- Check extension is enabled: Press `Ctrl+Shift+X` → search "grafana" → should show "Disable" button (not "Enable")

**Grafana icon not appearing in sidebar:**
- Verify Grafana is running: `curl http://localhost:3000/api/health`
- Check the URL in settings matches your Grafana instance (default: `http://localhost:3000`)
- Ensure you've set the token correctly in Settings (not Command Palette)

**"Connection failed" or "Unauthorized":**
- Verify Grafana is running: `curl http://localhost:3000/api/health`
- Check your service account token is valid (not expired/revoked)
- Try creating a new service account token and updating it in Settings
- Ensure you used a **Service Account token** (not an API key)

**Extension not appearing after installation:**
- Restart VS Code completely (close and reopen)
- Check Extensions view (`Ctrl+Shift+X`) for any error messages
- Try uninstalling and reinstalling: `code --uninstall-extension Grafana.grafana-vscode` then `code --install-extension Grafana.grafana-vscode`

## Security Best Practices

✅ **DO:**
- Store tokens in VS Code secret storage (using Command Palette)
- Use Editor/Viewer roles (not Admin)
- Set token expiration dates
- Rotate tokens periodically

❌ **DON'T:**
- Commit tokens to git
- Put tokens in settings.json
- Share tokens between team members
- Use admin tokens for development

## Documentation

- [Grafana VS Code Extension Docs](https://grafana.com/docs/grafana/latest/developers/plugins/create-a-grafana-plugin/develop-a-plugin/set-up-development-environment/)
- [VS Code Marketplace Page](https://marketplace.visualstudio.com/items?itemName=Grafana.grafana-vscode)

---

**Workspace Configuration**:
- Extension recommendation: ✅ Added to `.vscode/extensions.json`
- Grafana URL: ✅ Configured in `.vscode/settings.json`
- Token storage: ✅ Secure (via Command Palette, not in files)
