# Visual Guide: Cloudflare Dashboard Configuration

## Step-by-Step with Screenshots Reference

### Step 1: Access Cloudflare Zero Trust Dashboard

**URL**: https://one.dash.cloudflare.com/

**What you'll see**:
- Cloudflare Zero Trust dashboard
- Left sidebar with navigation

**Action**: Click **"Networks"** in the left sidebar

---

### Step 2: Navigate to Tunnels

**What you'll see**:
- Networks submenu expands
- Options: Tunnels, Routes, etc.

**Action**: Click **"Tunnels"**

---

### Step 3: Find Your Tunnel

**What you'll see**:
- List of your tunnels
- Status indicators (green = healthy)
- Your tunnel should show as "HEALTHY" with 4 connectors

**Action**: Click on your tunnel name (likely something like `ai-finance-agent-oss` or similar)

---

### Step 4: Go to Public Hostname Tab

**What you'll see**:
- Tunnel details page
- Tabs at the top: Overview, Configure, Logs, Public Hostname, etc.

**Action**: Click the **"Public Hostname"** tab

---

### Step 5: Add Public Hostname

**What you'll see**:
- List of existing public hostnames (if any)
- Button: "Add a public hostname"

**Action**: Click **"Add a public hostname"**

---

### Step 6: Fill in the Form

You'll see a form with these fields:

```
┌─────────────────────────────────────────────────┐
│ 1. Public hostname                              │
│                                                 │
│    Subdomain: [assistant        ]              │
│    Domain:    [ledger-mind.org  ▼]             │
│    Path:      [                 ]              │
│                                                 │
│    (Leave Path empty)                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 2. Service                                      │
│                                                 │
│    Type: [HTTP              ▼]                 │
│    URL:  [deploy-nginx-1:80    ]               │
│                                                 │
│    ⚠️  CRITICAL:                                │
│    - Must be: deploy-nginx-1:80                │
│    - NOT: localhost:8080                        │
│    - NOT: 127.0.0.1:8080                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 3. Additional application settings (Optional)   │
│                                                 │
│    [▼ Additional application settings]          │
│                                                 │
│    (Leave collapsed/default)                    │
└─────────────────────────────────────────────────┘
```

**Fill in exactly**:
1. **Subdomain**: `assistant`
2. **Domain**: Select `ledger-mind.org` from dropdown
3. **Path**: Leave empty
4. **Type**: Select `HTTP` from dropdown
5. **URL**: Type `deploy-nginx-1:80`

---

### Step 7: Save the Configuration

**What you'll see**:
- A "Save" or "Save hostname" button at the bottom

**Action**: Click **"Save hostname"**

---

### Step 8: Verify Configuration

**What you'll see after saving**:
- The new hostname appears in the list
- Status shows as active/enabled
- Something like:
  ```
  ✅ assistant.ledger-mind.org → HTTP://deploy-nginx-1:80
  ```

**Action**: Wait 30 seconds for propagation

---

### Step 9: Test the Connection

Open PowerShell and run:

```powershell
# Go to project directory
cd d:\leo-portfolio

# Run test script
.\test-tunnel.ps1
```

**Expected output**:
```
🎉 FULL SUCCESS!
   Local:  http://localhost:8080 ✅
   Public: https://assistant.ledger-mind.org ✅
```

---

## Alternative Service URLs (If `deploy-nginx-1:80` Doesn't Work)

Try these alternatives in order:

### Option 1: Use Container IP
```
URL: 172.19.0.2:80
```

To find the IP:
```powershell
docker inspect deploy-nginx-1 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

### Option 2: Use Fully Qualified Name
```
URL: deploy-nginx-1.deploy_default:80
```

### Option 3: Use Existing Nginx as Proxy
```
URL: ai-finance-agent-oss-clean-nginx-1:80
```

(This requires adding a proxy rule to the ai-finance-agent nginx config)

---

## Common Mistakes to Avoid

❌ **Wrong Port**
```
deploy-nginx-1:8080  ← WRONG (external port)
```
✅ **Correct Port**
```
deploy-nginx-1:80    ← CORRECT (internal port)
```

❌ **Using localhost**
```
localhost:8080       ← WRONG (not in Docker network)
127.0.0.1:8080      ← WRONG (not in Docker network)
```

❌ **Using External Address**
```
host.docker.internal:8080  ← WRONG
```

✅ **Using Docker Container Name**
```
deploy-nginx-1:80    ← CORRECT
```

---

## Troubleshooting Dashboard Configuration

### Can't Find the Tunnel

**Problem**: No tunnels shown in dashboard

**Solution**:
1. Make sure you're logged into the right Cloudflare account
2. Check if tunnel is running: `docker ps --filter name=cloudflared`
3. The tunnel might be in a different account/team

### Domain Not in Dropdown

**Problem**: `ledger-mind.org` doesn't appear in domain dropdown

**Solution**:
1. Make sure the domain is added to your Cloudflare account
2. Go to Cloudflare main dashboard → Add the domain if needed
3. Wait a few minutes for it to propagate to Zero Trust

### Save Button Disabled

**Problem**: Can't click Save

**Solution**:
- Make sure all required fields are filled
- Check that subdomain doesn't conflict with existing hostname
- Try a different subdomain temporarily to test (e.g., `test-assistant`)

### Configuration Saved but Site Still Unreachable

**Problem**: Added hostname but getting error 530 or 502

**Solutions**:

1. **Wait 1-2 minutes** for configuration to propagate

2. **Check service URL format**:
   - Should be: `deploy-nginx-1:80`
   - NOT: `http://deploy-nginx-1:80` (no http://)

3. **Verify tunnel is running**:
   ```powershell
   docker logs ai-finance-agent-oss-clean-cloudflared-1 --tail=20
   ```

4. **Restart tunnel**:
   ```powershell
   docker restart ai-finance-agent-oss-clean-cloudflared-1
   Start-Sleep -Seconds 30
   .\test-tunnel.ps1
   ```

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────┐
│ CLOUDFLARE TUNNEL CONFIGURATION                  │
├──────────────────────────────────────────────────┤
│ URL: https://one.dash.cloudflare.com/           │
│                                                  │
│ Navigation:                                      │
│   Networks → Tunnels → [Your Tunnel]            │
│   → Public Hostname → Add                        │
│                                                  │
│ Configuration:                                   │
│   Subdomain: assistant                          │
│   Domain:    ledger-mind.org                    │
│   Type:      HTTP                                │
│   URL:       deploy-nginx-1:80                  │
│                                                  │
│ Test:                                            │
│   .\test-tunnel.ps1                             │
└──────────────────────────────────────────────────┘
```

---

## Video Tutorial (If Needed)

If you're stuck, Cloudflare has official tutorials:

**Cloudflare Tunnel Setup**:
- https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/

**Public Hostname Configuration**:
- https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/

---

## Still Need Help?

Run diagnostics:

```powershell
# Full diagnostic
.\test-tunnel.ps1

# Check what Cloudflare sees
nslookup assistant.ledger-mind.org

# Check tunnel logs
docker logs ai-finance-agent-oss-clean-cloudflared-1 --tail=50

# Check nginx logs
docker logs deploy-nginx-1 --tail=50
```

---

**Ready?** Head to https://one.dash.cloudflare.com/ and follow the steps above! 🚀
