#!/usr/bin/env bash
# One-shot production deploy on a fresh Ubuntu/Debian server.
#   1. Point DNS first:  app.YOURDOMAIN -> server IP,  api.YOURDOMAIN -> server IP
#   2. Run from the repo root:  sudo bash scripts/deploy-server.sh YOURDOMAIN sk-ant-YOUR-KEY
set -euo pipefail

DOMAIN="${1:?usage: deploy-server.sh <domain> <anthropic-api-key>}"
ANTHROPIC_KEY="${2:?usage: deploy-server.sh <domain> <anthropic-api-key>}"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

say "1/5 Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

say "2/5 Environment (secrets are generated fresh)"
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
S3_SECRET=$(openssl rand -hex 16)
cat > .env <<EOF
API_PUBLIC_URL=https://api.${DOMAIN}
WEB_ORIGIN=https://app.${DOMAIN}
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
S3_ACCESS_KEY=afdip
S3_SECRET_KEY=${S3_SECRET}
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
EOF
chmod 600 .env

say "3/5 Caddy reverse proxy (automatic free HTTPS certificates)"
sed "s/your-domain.com/${DOMAIN}/g" Caddyfile > Caddyfile.local
cat > docker-compose.proxy.yml <<'EOF'
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./Caddyfile.local:/etc/caddy/Caddyfile:ro
      - caddydata:/data
volumes:
  caddydata:
EOF

say "4/5 Build & start the platform"
docker compose -f docker-compose.prod.yml -f docker-compose.proxy.yml --env-file .env up -d --build

say "5/5 Seed the database (roles, agent registry, prompts, rules)"
sleep 15
docker compose -f docker-compose.prod.yml --env-file .env exec -T api npx prisma db seed || true

printf '\n\033[1;32mDONE\033[0m — open: https://app.%s   (API health: https://api.%s/api/v1/health)\n' "$DOMAIN" "$DOMAIN"
