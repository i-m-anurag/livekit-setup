#!/usr/bin/env bash
# Generate LiveKit API key/secret pair
set -euo pipefail

API_KEY=$(openssl rand -hex 16)
API_SECRET=$(openssl rand -hex 32)

echo ""
echo "=== LiveKit API Credentials ==="
echo ""
echo "API Key:    $API_KEY"
echo "API Secret: $API_SECRET"
echo ""
echo "1. Put these in .env:"
echo "   LIVEKIT_API_KEY=$API_KEY"
echo "   LIVEKIT_API_SECRET=$API_SECRET"
echo ""
echo "2. Update livekit.yaml keys section:"
echo "   keys:"
echo "     $API_KEY: $API_SECRET"
echo ""
echo "3. Use the same key/secret in your app backend for token generation."
echo ""
