#!/usr/bin/env bash
#
# Deploy portfolio to production at https://assistant.ledger-mind.org
#
# Usage:
#   ./scripts/deploy-portfolio-prod.sh
#   ./scripts/deploy-portfolio-prod.sh --skip-build
#   ./scripts/deploy-portfolio-prod.sh --server myserver.com --user deploy

set -euo pipefail

# Default configuration
SERVER="${PROD_SERVER:-}"
SSH_USER="${PROD_SSH_USER:-$USER}"
DEPLOY_PATH="/opt/leo-portfolio"
SKIP_BUILD=false
SKIP_BACKUP=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
step() { echo -e "${CYAN}▶${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warning() { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER="$2"
            shift 2
            ;;
        --user)
            SSH_USER="$2"
            shift 2
            ;;
        --deploy-path)
            DEPLOY_PATH="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --server HOST        Production server (default: \$PROD_SERVER)"
            echo "  --user USER          SSH username (default: \$PROD_SSH_USER or \$USER)"
            echo "  --deploy-path PATH   Deploy path on server (default: /opt/leo-portfolio)"
            echo "  --skip-build         Skip local build step"
            echo "  --skip-backup        Skip backup of current deployment"
            echo "  --help               Show this help"
            echo ""
            echo "Environment variables:"
            echo "  PROD_SERVER          Production server hostname"
            echo "  PROD_SSH_USER        SSH username for deployment"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Run with --help for usage"
            exit 1
            ;;
    esac
done

# Banner
echo ""
echo -e "${MAGENTA}🚀 Portfolio Production Deployment${NC}"
echo -e "${MAGENTA}═══════════════════════════════════${NC}"
echo ""

# Validate parameters
if [[ -z "$SERVER" ]]; then
    error "Server not specified. Set \$PROD_SERVER or use --server parameter"
    echo ""
    echo "Example: export PROD_SERVER=your-server.com"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  Server:      $SERVER"
echo "  SSH User:    $SSH_USER"
echo "  Deploy Path: $DEPLOY_PATH"
echo ""

# Step 1: Build frontend
if [[ "$SKIP_BUILD" == "false" ]]; then
    step "Building portfolio frontend..."

    if [[ ! -f package.json ]]; then
        error "Not in project root directory"
        exit 1
    fi

    if ! npm run build:portfolio; then
        error "Build failed"
        exit 1
    fi

    success "Portfolio build complete"

    # Verify build output
    if [[ ! -f dist-portfolio/index.html ]]; then
        error "Build output missing: dist-portfolio/index.html not found"
        exit 1
    fi

    success "Build verified: dist-portfolio/index.html exists"
else
    warning "Skipping build (using existing dist-portfolio/)"

    if [[ ! -f dist-portfolio/index.html ]]; then
        error "dist-portfolio/index.html not found. Run without --skip-build"
        exit 1
    fi
fi

# Step 2: Test SSH connection
step "Testing SSH connection to $SERVER..."

if ! ssh -o ConnectTimeout=10 "$SSH_USER@$SERVER" "echo ok" > /dev/null 2>&1; then
    error "Cannot connect to $SERVER"
    echo ""
    echo "Make sure:"
    echo "  1. Server is reachable"
    echo "  2. SSH keys are configured"
    echo "  3. User $SSH_USER has access"
    exit 1
fi

success "SSH connection successful"

# Step 3: Backup current deployment (on server)
if [[ "$SKIP_BACKUP" == "false" ]]; then
    step "Creating backup on server..."

    BACKUP_NAME="dist-portfolio-backup-$(date +%Y%m%d-%H%M%S)"

    ssh "$SSH_USER@$SERVER" bash <<EOF
cd $DEPLOY_PATH
if [ -d dist-portfolio ]; then
    cp -r dist-portfolio $BACKUP_NAME
    echo "Backup created: $BACKUP_NAME"
else
    echo "No existing dist-portfolio to backup"
fi
EOF

    success "Backup complete (if previous deployment existed)"
else
    warning "Skipping backup"
fi

# Step 4: Upload frontend build
step "Uploading portfolio build to server..."

# Create remote directory if needed
ssh "$SSH_USER@$SERVER" "mkdir -p $DEPLOY_PATH/dist-portfolio"

# Sync dist-portfolio
echo "  Syncing files..."
if ! rsync -avz --delete \
    --progress \
    --exclude='.DS_Store' \
    --exclude='*.map' \
    dist-portfolio/ "$SSH_USER@$SERVER:$DEPLOY_PATH/dist-portfolio/"; then
    error "Upload failed"
    exit 1
fi

success "Upload complete"

# Step 5: Verify uploaded files
step "Verifying uploaded files on server..."

ssh "$SSH_USER@$SERVER" bash <<'EOF'
cd /opt/leo-portfolio/dist-portfolio
if [ ! -f index.html ]; then
    echo "ERROR: index.html not found"
    exit 1
fi
if [ ! -d assets ]; then
    echo "ERROR: assets/ directory not found"
    exit 1
fi
echo "Files verified: index.html and assets/ present"
EOF

success "Files verified on server"

# Step 6: Restart services
step "Restarting portfolio services on server..."

ssh "$SSH_USER@$SERVER" bash <<EOF
cd $DEPLOY_PATH/deploy

echo "Pulling latest backend image..."
docker compose pull backend

echo "Restarting services..."
docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml down nginx backend
docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml up -d

echo "Waiting for services to start..."
sleep 10

echo "Checking health..."
docker compose ps
EOF

success "Services restarted"

# Step 7: Verify deployment
step "Verifying deployment..."

sleep 5

# Test local server health
HEALTH_CHECK=$(ssh "$SSH_USER@$SERVER" "curl -s http://localhost/healthz" || echo "ERROR")
if [[ "$HEALTH_CHECK" != "ok" ]]; then
    warning "Health check returned: $HEALTH_CHECK (expected 'ok')"
else
    success "Local health check passed"
fi

# Test public URL
echo ""
echo "  Testing public URL: https://assistant.ledger-mind.org"

if command -v curl &> /dev/null; then
    if PUBLIC_RESPONSE=$(curl -s -w "\n%{http_code}" "https://assistant.ledger-mind.org/healthz" 2>&1); then
        HTTP_CODE=$(echo "$PUBLIC_RESPONSE" | tail -n1)
        BODY=$(echo "$PUBLIC_RESPONSE" | head -n-1)

        if [[ "$HTTP_CODE" == "200" ]] && [[ "$BODY" == "ok" ]]; then
            success "Public URL health check passed"
        else
            warning "Public URL returned HTTP $HTTP_CODE: $BODY"
        fi
    else
        warning "Could not reach public URL (may need Cloudflare Tunnel restart)"
    fi
else
    warning "curl not available, skipping public URL check"
fi

# Step 8: Summary
echo ""
echo -e "${MAGENTA}═══════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${MAGENTA}═══════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Visit: https://assistant.ledger-mind.org"
echo "  2. Test key features (nav, projects, assistant)"
echo "  3. Check browser console for errors"
echo "  4. Verify CSP and security headers"
echo ""

echo -e "${YELLOW}Monitor logs:${NC}"
echo "  ssh $SSH_USER@$SERVER 'cd $DEPLOY_PATH/deploy && docker compose logs -f nginx --tail=50'"
echo "  ssh $SSH_USER@$SERVER 'cd $DEPLOY_PATH/deploy && docker compose logs -f backend --tail=50'"
echo ""

if [[ "$SKIP_BACKUP" == "false" ]]; then
    echo -e "${YELLOW}Rollback (if needed):${NC}"
    echo "  ssh $SSH_USER@$SERVER 'cd $DEPLOY_PATH && mv dist-portfolio dist-portfolio-broken && mv $BACKUP_NAME dist-portfolio'"
    echo "  ssh $SSH_USER@$SERVER 'cd $DEPLOY_PATH/deploy && docker compose restart nginx'"
    echo ""
fi

success "All done!"
echo ""
