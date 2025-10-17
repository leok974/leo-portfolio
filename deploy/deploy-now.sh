#!/bin/bash
# Portfolio Deployment - Automated Execution
# Usage: ./deploy-now.sh [user@server] [nginx-container-name]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  🚀 PORTFOLIO DEPLOYMENT HELPER${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

# Get server info
if [ -z "$1" ]; then
    read -p "Enter server (user@host): " SERVER_STRING
else
    SERVER_STRING=$1
fi

echo -e "${GREEN}Target server: $SERVER_STRING${NC}\n"

# Get nginx container name
if [ -z "$2" ]; then
    echo -e "${YELLOW}Finding nginx container name on server...${NC}"
    echo -e "${NC}Running: ssh $SERVER_STRING 'docker ps | grep nginx'${NC}\n"

    NGINX_INFO=$(ssh $SERVER_STRING 'docker ps | grep nginx' 2>&1 || true)
    if [ -n "$NGINX_INFO" ]; then
        echo -e "${GREEN}Nginx containers found:${NC}"
        echo "$NGINX_INFO"

        NGINX_CONTAINER=$(echo "$NGINX_INFO" | awk '{print $1}' | head -n1)
        echo -e "\n${GREEN}Using nginx container: $NGINX_CONTAINER${NC}"
        read -p "Is this correct? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            read -p "Enter nginx container name: " NGINX_CONTAINER
        fi
    else
        echo -e "${YELLOW}Could not detect nginx container automatically.${NC}"
        read -p "Enter nginx container name: " NGINX_CONTAINER
    fi
else
    NGINX_CONTAINER=$2
fi

echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  📋 DEPLOYMENT CONFIGURATION${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"
echo -e "Server:          $SERVER_STRING"
echo -e "Nginx Container: $NGINX_CONTAINER\n"

read -p "Proceed with deployment? (y/n): " proceed
if [ "$proceed" != "y" ]; then
    echo -e "\n${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

# STEP 1: Copy and run diagnostics
echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  STEP 1: Run Diagnostics${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Copying diagnostics script to server...${NC}"
scp deploy/diagnose-server.sh $SERVER_STRING:/tmp/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Diagnostics script copied successfully${NC}\n"

    echo -e "${YELLOW}Running diagnostics on server...${NC}\n"
    ssh $SERVER_STRING 'chmod +x /tmp/diagnose-server.sh && bash /tmp/diagnose-server.sh'
    DIAG_EXIT=$?

    if [ $DIAG_EXIT -eq 0 ]; then
        echo -e "\n${GREEN}✅ All diagnostics passed!${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Some diagnostics failed (exit code: $DIAG_EXIT)${NC}"
        echo -e "${NC}This is expected if portfolio container doesn't exist yet.${NC}"
        read -p "Continue with deployment? (y/n): " continue
        if [ "$continue" != "y" ]; then
            echo -e "\n${YELLOW}Deployment stopped. Fix issues and try again.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ Failed to copy diagnostics script${NC}"
    exit 1
fi

# STEP 2: Deploy portfolio container
echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  STEP 2: Deploy Portfolio Container${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

DEPLOY_SCRIPT='
set -e
echo "=== Pulling latest image ==="
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

echo -e "\n=== Stopping old container ==="
docker stop portfolio-ui 2>/dev/null || echo "No existing container"
docker rm portfolio-ui 2>/dev/null || echo "No container to remove"

echo -e "\n=== Starting new container ==="
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

echo -e "\n=== Verifying container ==="
docker ps | grep portfolio-ui
docker logs portfolio-ui --tail=10
'

echo -e "${YELLOW}Deploying portfolio container...${NC}\n"
ssh $SERVER_STRING "$DEPLOY_SCRIPT"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Portfolio container deployed successfully${NC}\n"
else
    echo -e "\n${RED}❌ Failed to deploy portfolio container${NC}"
    exit 1
fi

# STEP 3: Verify nginx connectivity
echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  STEP 3: Verify Nginx → Portfolio${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Restarting nginx...${NC}"
ssh $SERVER_STRING "docker restart $NGINX_CONTAINER"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx restarted${NC}\n"

    sleep 3

    echo -e "${YELLOW}Testing connectivity from nginx to portfolio...${NC}\n"

    TEST_SCRIPT='
echo "[resolve]"
getent hosts portfolio.int
echo "[probe]"
curl -sI http://portfolio.int/ | head -n1
'

    ssh $SERVER_STRING "docker exec $NGINX_CONTAINER sh -lc '$TEST_SCRIPT'"

    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}✅ Nginx can reach portfolio!${NC}"
    else
        echo -e "\n${YELLOW}⚠️  Nginx connectivity test had issues${NC}"
        echo -e "${NC}You may need to connect containers to same network:${NC}"
        echo -e "${NC}  docker network connect infra_net $NGINX_CONTAINER${NC}"
    fi
else
    echo -e "${RED}❌ Failed to restart nginx${NC}"
fi

# STEP 4: Test public URL
echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  STEP 4: Test Public URL${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Testing https://assistant.ledger-mind.org...${NC}\n"
curl -I https://assistant.ledger-mind.org 2>&1 | head -n5

echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ DEPLOYMENT COMPLETE${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}🎯 NEXT STEPS:${NC}\n"
echo -e "1. Open https://assistant.ledger-mind.org in your browser"
echo -e "2. Check browser console (F12) for any errors"
echo -e "3. Verify all assets load correctly"
echo -e "4. Test Calendly widget"
echo -e "\n5. (Optional) Enable Watchtower for auto-updates:"
echo -e "   ssh $SERVER_STRING"
echo -e "   docker run -d --name watchtower --restart unless-stopped \\"
echo -e "     -v /var/run/docker.sock:/var/run/docker.sock \\"
echo -e "     containrrr/watchtower --interval 300 --cleanup portfolio-ui"
echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}\n"

echo -e "${CYAN}📚 For troubleshooting, see:${NC}"
echo -e "   • COMMAND_SHEET.md"
echo -e "   • EXECUTE_DEPLOYMENT.md"
echo -e "   • deploy/DIAGNOSTICS_QUICKREF.md\n"
