#!/usr/bin/env bash
# =============================================================================
# Production Deployment Script
# LiveKit MEAN Stack - ICE over TCP
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "  LiveKit MEAN Stack - Production Deployment"
echo "  ICE over TCP / TURN over TLS"
echo "=============================================="
echo ""

# --- Pre-flight Checks ---
echo "[1/7] Pre-flight checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose plugin not found."
    exit 1
fi

echo "  Docker: $(docker --version)"
echo "  Compose: $(docker compose version)"

# Check .env file
if [ ! -f "$PROD_DIR/.env" ]; then
    echo ""
    echo "ERROR: .env file not found in $PROD_DIR"
    echo "  Copy the template: cp .env.production.template .env"
    echo "  Then edit .env with your actual values."
    exit 1
fi

source "$PROD_DIR/.env"

echo "  App Domain:    ${APP_DOMAIN:-NOT SET}"
echo "  LiveKit Domain: ${LIVEKIT_DOMAIN:-NOT SET}"
echo "  TURN Domain:   ${TURN_DOMAIN:-NOT SET}"
echo ""

# --- Validate critical env vars ---
echo "[2/7] Validating configuration..."

if [ "${LIVEKIT_API_KEY:-APIKeyChangeMe}" = "APIKeyChangeMe" ]; then
    echo "WARNING: Using default LIVEKIT_API_KEY. Generate a new one for production!"
    echo "  Run: openssl rand -hex 16"
fi

if [ "${JWT_SECRET:-change_this}" = "change_this_jwt_secret_in_production" ]; then
    echo "WARNING: Using default JWT_SECRET. Generate a new one!"
    echo "  Run: openssl rand -hex 64"
fi

if [ "${MONGO_ROOT_PASSWORD:-changeme}" = "changeme_generate_strong_password" ]; then
    echo "WARNING: Using default MongoDB password. Change it!"
fi

echo ""

# --- Check TURN TLS certificates ---
echo "[3/7] Checking TURN TLS certificates..."

SSL_DIR="$PROD_DIR/ssl/turn"
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
    echo "WARNING: TURN TLS certificates not found in $SSL_DIR/"
    echo "  TURN/TLS will NOT work without valid certificates."
    echo ""
    echo "  To provision certificates with certbot:"
    echo "    sudo certbot certonly --standalone -d ${TURN_DOMAIN:-turn.example.com}"
    echo "    sudo cp /etc/letsencrypt/live/${TURN_DOMAIN:-turn.example.com}/fullchain.pem $SSL_DIR/"
    echo "    sudo cp /etc/letsencrypt/live/${TURN_DOMAIN:-turn.example.com}/privkey.pem $SSL_DIR/"
    echo ""
    echo "  For now, ICE/TCP on port 7881 will still work."
else
    echo "  TURN TLS certificates found."
fi

echo ""

# --- Update livekit-production.yaml with actual values ---
echo "[4/7] Updating LiveKit config with environment values..."

LIVEKIT_CONFIG="$PROD_DIR/livekit-production.yaml"

# Replace TURN domain in config
if [ -n "${TURN_DOMAIN:-}" ]; then
    sed -i.bak "s|domain: turn.example.com|domain: ${TURN_DOMAIN}|g" "$LIVEKIT_CONFIG"
fi

# Replace API key/secret
if [ -n "${LIVEKIT_API_KEY:-}" ] && [ -n "${LIVEKIT_API_SECRET:-}" ]; then
    sed -i.bak "s|APIKeyChangeMe: SecretChangeMe_Generate_With_openssl_rand_hex_32|${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}|g" "$LIVEKIT_CONFIG"
fi

# Clean up sed backup files
rm -f "$LIVEKIT_CONFIG.bak"

echo "  LiveKit config updated."
echo ""

# --- Build Docker images ---
echo "[5/7] Building Docker images..."

cd "$PROD_DIR"
docker compose -f docker-compose.production.yml build --no-cache express-backend angular-frontend

echo ""

# --- Pull latest images ---
echo "[6/7] Pulling latest Docker images..."

docker compose -f docker-compose.production.yml pull livekit-server redis mongodb caddy

echo ""

# --- Deploy ---
echo "[7/7] Starting all services..."

docker compose -f docker-compose.production.yml up -d

echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo ""
echo "  Services:"
echo "    App:      https://${APP_DOMAIN:-app.example.com}"
echo "    LiveKit:  wss://${LIVEKIT_DOMAIN:-livekit.example.com}"
echo "    ICE/TCP:  ${LIVEKIT_DOMAIN:-livekit.example.com}:7881"
echo "    TURN/TLS: ${TURN_DOMAIN:-turn.example.com}:5349"
echo ""
echo "  Check status: docker compose -f docker-compose.production.yml ps"
echo "  View logs:    docker compose -f docker-compose.production.yml logs -f"
echo "  Stop:         docker compose -f docker-compose.production.yml down"
echo ""
