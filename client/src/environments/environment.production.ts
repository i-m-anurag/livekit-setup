export const environment = {
  production: true,
  // In production, Angular and API are on the same domain (Caddy routes /api/* to Express)
  apiUrl: '/api',
  // LiveKit signaling via secure WebSocket through Caddy
  livekitWsUrl: 'wss://livekit.example.com',
};
