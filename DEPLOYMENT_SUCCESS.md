# Portfolio Deployment - Command That Worked

## ✅ Successfully Deployed Locally

Date: October 14, 2025
Container: `portfolio-ui`
Network: `infra_net` with alias `portfolio.int`
Port: `8089:80`

## 🎯 The Exact Command (PowerShell/Bash Compatible)

```bash
docker run -d --name portfolio-ui --restart unless-stopped --network infra_net --network-alias portfolio.int -p 8089:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## ✅ Verification

After running the command:

```bash
# Check container status
docker ps --filter name=portfolio-ui

# Check network configuration
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}Network: {{$net}} | Aliases: {{range $config.Aliases}}{{.}} {{end}}{{"\n"}}{{end}}'

# Test locally
curl http://localhost:8089/

# Check logs
docker logs portfolio-ui --tail=20
```

## 📊 Expected Results

**Container Status:**
- Status: `Up X seconds`
- Network: `infra_net`
- Alias: `portfolio.int`
- Port: `0.0.0.0:8089->80/tcp`

**Test Response:**
- `curl http://localhost:8089/` returns HTTP 200 OK
- HTML contains "Leo Klemet"

## 🚀 Deploy to Production Server

Run the exact same command on your production server (via web console, SSH, or control panel):

```bash
docker run -d --name portfolio-ui --restart unless-stopped --network infra_net --network-alias portfolio.int -p 8089:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## ⚙️ Required: Update Nginx Configuration

Your nginx container must be configured to proxy to `portfolio.int`:

```nginx
location / {
    proxy_pass http://portfolio.int:80;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Reload nginx after updating config:**

```bash
docker exec <nginx-container-name> nginx -t
docker exec <nginx-container-name> nginx -s reload
```

## 🔍 Production Verification

After deploying on production server:

```bash
# 1. Check container running
docker ps | grep portfolio-ui

# 2. Test from server host
curl http://localhost:8089/

# 3. Test from nginx container (DNS resolution)
docker exec <nginx-container> getent hosts portfolio.int

# 4. Test from nginx container (HTTP connectivity)
docker exec <nginx-container> curl -I http://portfolio.int/

# 5. Test public URL
curl -I https://assistant.ledger-mind.org

# 6. Browser test
# Open: https://assistant.ledger-mind.org
# Check F12 console for errors
```

## 🔄 Update Container (Pull New Version)

When you push a new image to GHCR:

```bash
# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Recreate container
docker stop portfolio-ui
docker rm portfolio-ui
docker run -d --name portfolio-ui --restart unless-stopped --network infra_net --network-alias portfolio.int -p 8089:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**OR** use Watchtower for automatic updates:

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  --cleanup \
  portfolio-ui
```

## 🚨 Troubleshooting

### Issue: "Container name already in use"

```bash
docker stop portfolio-ui
docker rm portfolio-ui
# Then re-run the docker run command
```

### Issue: "Network not found"

```bash
# Check if infra_net exists
docker network ls | grep infra

# Create if missing
docker network create infra_net
```

### Issue: nginx can't reach portfolio.int

```bash
# Check both containers are on infra_net
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
docker inspect <nginx-container> --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'

# If nginx not on infra_net, add it
docker network connect infra_net <nginx-container>
docker restart <nginx-container>
```

### Issue: Port 8089 already in use

```bash
# Find what's using the port
docker ps | grep 8089

# Stop the conflicting container or use a different port
docker run -d --name portfolio-ui --restart unless-stopped --network infra_net --network-alias portfolio.int -p 8088:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## 📝 Notes

- **Local Deployment**: Successfully tested on Windows with Docker Desktop
- **Network**: Must use `infra_net` (shared with nginx and cloudflared)
- **Alias**: `portfolio.int` allows nginx to reach it via DNS
- **Port**: `8089` on host, `80` in container
- **Image**: Automatically pulled from GHCR if not present locally

## ✅ Success Checklist

- [x] Image pushed to GHCR
- [x] Container deployed locally with infra_net
- [x] DNS alias `portfolio.int` configured
- [x] Local test successful (http://localhost:8089/)
- [ ] Deploy same command on production server
- [ ] Update nginx config to proxy to portfolio.int
- [ ] Test public URL (https://assistant.ledger-mind.org)
- [ ] Verify in browser (no console errors)
- [ ] (Optional) Set up Watchtower for auto-updates

## 🎯 Current Status

**Local Environment:**
- ✅ Container running
- ✅ Network: infra_net
- ✅ Alias: portfolio.int
- ✅ Port: 8089:80
- ✅ HTTP 200 OK

**Production:**
- ⏳ Awaiting deployment on production server
- Command ready to execute (same as above)
- Requires nginx config update

---

**Last Updated:** October 14, 2025
**Status:** Local deployment successful, ready for production deployment
