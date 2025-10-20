# Dev Overlay Usage Guide

## What is the Dev Overlay?

The Dev Overlay is a floating "DEV" badge that appears on your portfolio website when enabled. It provides quick access to development status and diagnostic information.

## How to Enable

### Method 1: URL Parameter (Easiest)

Visit your website with the `dev_overlay` parameter:

```
https://www.leoklemet.com/?dev_overlay=dev
```

This will:
1. Automatically call the `/agent/dev/enable` endpoint
2. Set the `sa_dev` cookie (valid for 14 days)
3. Reload the page
4. Show the DEV badge in the bottom-right corner

### Method 2: Browser Console

1. Open your website: https://www.leoklemet.com
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run this command:

```javascript
await fetch('/agent/dev/enable', {
  headers: { 'Authorization': 'Bearer dev' }
}).then(() => location.reload());
```

### Method 3: Direct API Call (cURL)

From your terminal:

```bash
curl "https://www.leoklemet.com/agent/dev/enable" \
  -H "Authorization: Bearer dev" \
  -c cookies.txt
```

Then visit the site with the cookie from `cookies.txt`.

## Features

### DEV Badge
- **Location**: Bottom-right corner of the page
- **Appearance**: Black badge with white "DEV" text
- **Behavior**:
  - Hover to scale up slightly
  - Click to show dev status (fetches `/agent/dev/status`)

### What the Badge Shows
When clicked, displays:
- Dev overlay enabled status
- Allowed/authenticated state
- Backend diagnostics

## How to Disable

### Method 1: API Call (Console)

```javascript
await fetch('/agent/dev/disable').then(() => location.reload());
```

### Method 2: Delete Cookie

1. Open DevTools → Application → Cookies
2. Find `sa_dev` cookie
3. Delete it
4. Refresh page

## Technical Details

### Cookie Settings
- **Name**: `sa_dev`
- **Value**: `1`
- **Duration**: 14 days (1,209,600 seconds)
- **Attributes**: `Secure; SameSite=Lax; Path=/`

### Endpoints

- **Enable**: `GET /agent/dev/enable`
  - Requires: `Authorization: Bearer dev` header
  - Returns: `{"ok": true, "enabled": true}`
  - Sets cookie: `sa_dev=1`

- **Disable**: `GET /agent/dev/disable`
  - Returns: `{"ok": true, "enabled": false}`
  - Deletes cookie

- **Status**: `GET /agent/dev/status`
  - Returns: `{"allowed": true/false}`

### Source Files

- **Frontend**: `apps/portfolio-ui/src/dev-overlay.ts`
- **Backend**: `assistant_api/routers/agent_router.py`
- **Mount point**: `apps/portfolio-ui/src/main.ts` (calls `mountDevOverlayIfEnabled()`)

## Troubleshooting

### "Not enabled (no sa_dev cookie found)" in console

**Cause**: Cookie not set or was deleted

**Solutions**:
1. Use URL parameter method: `?dev_overlay=dev`
2. Check if cookie exists in DevTools → Application → Cookies
3. Verify you're on HTTPS (cookie has `Secure` flag)
4. Try hard refresh (Ctrl+Shift+R)

### Badge doesn't appear after enabling

**Cause**: Page didn't reload or JavaScript error

**Solutions**:
1. Hard refresh the page (Ctrl+Shift+R)
2. Check console for errors
3. Verify cookie was set (DevTools → Application → Cookies)
4. Check if JavaScript bundle loaded: Look for `mountDevOverlayIfEnabled` calls in Network tab

### Endpoint returns HTML instead of JSON

**Cause**: Nginx not routing `/agent/*` to backend

**Solution**: Verify nginx config has:
```nginx
location /agent/ {
  proxy_pass http://portfolio-api.int:8000/agent/;
  # ... proxy headers
}
```

## Quick Reference

| Action | Method |
|--------|--------|
| Enable via URL | Visit `?dev_overlay=dev` |
| Enable via Console | `await fetch('/agent/dev/enable', {headers: {'Authorization': 'Bearer dev'}}).then(() => location.reload())` |
| Disable | `await fetch('/agent/dev/disable').then(() => location.reload())` |
| Check Status | Click the DEV badge |
| Manual Check | `await fetch('/agent/dev/status').then(r => r.json())` |

## Notes

- The `dev` token is hardcoded for simplicity (dev environment only)
- Cookie persists for 14 days - you'll stay in dev mode
- The badge doesn't interfere with page functionality
- Z-index is 99999 to ensure it stays on top
- No visual changes to the main site when enabled

---
**Last Updated**: October 20, 2025
**Status**: Deployed and operational
**Deployment**: PR #15 (nginx `/agent/` proxy block added)
