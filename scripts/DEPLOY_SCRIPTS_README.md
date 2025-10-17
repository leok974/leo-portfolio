# Portfolio Production Deployment Scripts

Automated deployment scripts for the portfolio website to `https://assistant.ledger-mind.org`.

## Quick Start

### PowerShell (Windows)
```powershell
# Set environment variables (one-time)
$env:PROD_SERVER = "your-server.com"
$env:PROD_SSH_USER = "deploy"

# Deploy
./scripts/deploy-portfolio-prod.ps1
```

### Bash (Linux/macOS/WSL)
```bash
# Set environment variables (one-time)
export PROD_SERVER=your-server.com
export PROD_SSH_USER=deploy

# Deploy
./scripts/deploy-portfolio-prod.sh
```

## What the Scripts Do

1. **Build** - Runs `npm run build:portfolio` to generate `dist-portfolio/`
2. **Backup** - Creates timestamped backup of current deployment on server
3. **Upload** - Syncs `dist-portfolio/` to server using `rsync`
4. **Verify** - Checks uploaded files are present
5. **Restart** - Pulls latest backend image and restarts services
6. **Health Check** - Tests local and public URL health endpoints

## Options

### PowerShell
```powershell
# Skip local build (use existing dist-portfolio/)
./scripts/deploy-portfolio-prod.ps1 -SkipBuild

# Skip backup
./scripts/deploy-portfolio-prod.ps1 -SkipBackup

# Custom server and user
./scripts/deploy-portfolio-prod.ps1 -Server myserver.com -SshUser deploy

# Custom deploy path
./scripts/deploy-portfolio-prod.ps1 -DeployPath /home/user/portfolio
```

### Bash
```bash
# Skip local build
./scripts/deploy-portfolio-prod.sh --skip-build

# Skip backup
./scripts/deploy-portfolio-prod.sh --skip-backup

# Custom server and user
./scripts/deploy-portfolio-prod.sh --server myserver.com --user deploy

# Custom deploy path
./scripts/deploy-portfolio-prod.sh --deploy-path /home/user/portfolio

# Show help
./scripts/deploy-portfolio-prod.sh --help
```

## Prerequisites

### Local Machine
- Node.js and npm installed
- Project dependencies installed (`npm install`)
- SSH access to production server configured

### Production Server
- SSH key authentication set up
- Docker and Docker Compose installed
- Project repository cloned to `$DEPLOY_PATH` (default: `/opt/leo-portfolio`)
- User has permissions to:
  - Write to deploy path
  - Run docker compose commands
  - Restart services

### First-Time Server Setup
```bash
# On production server
cd /opt/leo-portfolio

# Create deploy directory structure
mkdir -p deploy data dist-portfolio

# Copy compose files
cp docker-compose.yml deploy/
cp docker-compose.portfolio-prod.yml deploy/
cp nginx.portfolio.conf deploy/

# Create environment file
cat > deploy/.env.prod <<EOF
ALLOWED_ORIGINS=https://assistant.ledger-mind.org
BACKEND_URL=https://assistant.ledger-mind.org
RAG_DB=./data/rag.sqlite
OPENAI_BASE_URL=http://ollama:11434/v1
# Add other env vars as needed
EOF

# Pull initial images
cd deploy
docker compose pull
```

## Verification After Deployment

### Automated Checks (scripts do this)
- ✓ SSH connection test
- ✓ File upload verification
- ✓ Local health check (`http://localhost/healthz`)
- ✓ Public URL health check (`https://assistant.ledger-mind.org/healthz`)

### Manual Verification
1. **Frontend**: Visit `https://assistant.ledger-mind.org`
   - Homepage loads correctly
   - Navigation works
   - Projects display
   - No console errors

2. **Backend**: Test API endpoints
   ```bash
   curl https://assistant.ledger-mind.org/api/ready
   # Should return: {"status":"ok"}

   curl https://assistant.ledger-mind.org/api/status/summary
   # Should return health info
   ```

3. **Assistant**: Test chat functionality
   - Open assistant panel
   - Send test message
   - Verify streaming response
   - Check sources popover

4. **Security**: Check headers
   ```bash
   curl -I https://assistant.ledger-mind.org
   # Verify:
   # - Content-Security-Policy present
   # - X-Frame-Options: DENY
   # - X-Content-Type-Options: nosniff
   ```

## Monitoring

### View Logs
```bash
# Nginx logs
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose logs -f nginx --tail=50'

# Backend logs
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose logs -f backend --tail=50'

# Ollama logs
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose logs -f ollama --tail=50'

# All services
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose logs -f --tail=50'
```

### Check Service Status
```bash
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose ps'
```

### Resource Usage
```bash
ssh user@server 'docker stats'
```

## Rollback

If deployment fails or causes issues:

### Rollback Frontend
```bash
# On server
cd /opt/leo-portfolio
mv dist-portfolio dist-portfolio-broken
mv dist-portfolio-backup-YYYYMMDD-HHMMSS dist-portfolio
cd deploy
docker compose restart nginx
```

### Rollback Backend
```bash
# On server
cd /opt/leo-portfolio/deploy
docker compose pull backend:previous-tag
docker compose up -d backend
```

### Full Service Restart
```bash
# On server
cd /opt/leo-portfolio/deploy
docker compose down
docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml up -d
```

## Troubleshooting

### Build Fails
```powershell
# Check Node.js version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules
npm install

# Try build again
npm run build:portfolio
```

### SSH Connection Fails
```bash
# Test SSH manually
ssh user@server echo "Connection OK"

# Check SSH config
cat ~/.ssh/config

# Verify SSH key
ssh-add -l
```

### Upload Fails
```bash
# Test rsync manually
rsync --version

# Check server disk space
ssh user@server df -h

# Try manual upload
scp -r dist-portfolio/* user@server:/opt/leo-portfolio/dist-portfolio/
```

### Health Check Fails
```bash
# Check nginx is running
ssh user@server 'docker ps | grep nginx'

# Check nginx config
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose exec nginx nginx -t'

# View nginx logs
ssh user@server 'cd /opt/leo-portfolio/deploy && docker compose logs nginx --tail=100'
```

### Public URL Not Accessible
- Verify Cloudflare Tunnel is running
- Check DNS records point to correct IP
- Verify firewall allows port 80/443
- Check nginx is bound to correct port

## Security Notes

- Scripts use SSH key authentication (no passwords)
- Backups created automatically unless `--skip-backup`
- Uploads use `rsync --delete` to remove old files
- Services restart with latest images
- Health checks verify deployment success

## Related Documentation

- [PORTFOLIO_PRODUCTION_DEPLOY.md](../docs/PORTFOLIO_PRODUCTION_DEPLOY.md) - Comprehensive deployment guide
- [docker-compose.portfolio-prod.yml](../deploy/docker-compose.portfolio-prod.yml) - Production compose config
- [nginx.portfolio.conf](../deploy/nginx.portfolio.conf) - Nginx configuration
- [DEPLOY.md](../docs/DEPLOY.md) - General deployment documentation
