#!/usr/bin/env bash
# =============================================================================
# Generate Production Secrets
# Run this to create cryptographically secure values for .env
# =============================================================================
set -euo pipefail

echo "=============================================="
echo "  Generating Production Secrets"
echo "=============================================="
echo ""

LIVEKIT_API_KEY=$(openssl rand -hex 16)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 64)
MONGO_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)

echo "# Copy these into your .env file:"
echo ""
echo "LIVEKIT_API_KEY=${LIVEKIT_API_KEY}"
echo "LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}"
echo "JWT_SECRET=${JWT_SECRET}"
echo "MONGO_ROOT_PASSWORD=${MONGO_PASSWORD}"
echo ""
echo "=============================================="
echo "  IMPORTANT: Save these values securely!"
echo "  They cannot be recovered once lost."
echo "=============================================="
