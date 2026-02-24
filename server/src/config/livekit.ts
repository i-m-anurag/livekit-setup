export const LIVEKIT_CONFIG = {
  apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  apiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
  wsUrl: process.env.LIVEKIT_WS_URL || 'ws://localhost:7880',
};
