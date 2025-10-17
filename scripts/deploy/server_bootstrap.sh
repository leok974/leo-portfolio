#!/usr/bin/env bash
set -euo pipefail

COMPOSE_URL="https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml"

cat <<'EOS'
# === RUN THIS ON YOUR SERVER ===
docker network ls | grep -q infra_net || docker network create infra_net && \
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio && \
curl -fsSLO 'EOS
echo "$COMPOSE_URL"
cat <<'EOS'
' && \
docker compose -f docker-compose.portfolio-ui.yml up -d && \
docker compose -f docker-compose.portfolio-ui.yml ps && \
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower' && \
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
# ===============================
EOS
