import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import tokenRoutes from './routes/token.routes';
import roomRoutes from './routes/room.routes';
import { agentService } from './services/agent.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', activeAgentRooms: agentService.getActiveRooms() });
});

// Agent join endpoint - triggers agent to join a specific room
app.post('/api/agent/join', express.json(), async (req, res) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res.status(400).json({ error: 'roomName is required' });
      return;
    }
    await agentService.joinRoom(roomName);
    res.json({ success: true, message: `Agent joined room: ${roomName}` });
  } catch (err) {
    console.error('Agent join error:', err);
    res.status(500).json({ error: 'Failed to join agent to room' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await agentService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await agentService.shutdown();
  process.exit(0);
});

// Start server
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('LiveKit WS URL:', process.env.LIVEKIT_WS_URL);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
