import { Router, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { LIVEKIT_CONFIG } from '../config/livekit';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res.status(400).json({ error: 'roomName is required' });
      return;
    }

    const participantName = req.user!.username;

    const at = new AccessToken(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({ token });
  } catch (err) {
    console.error('Token generation error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

export default router;
