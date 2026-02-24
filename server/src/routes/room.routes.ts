import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { livekitService } from '../services/livekit.service';
import { Message } from '../models/message.model';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const rooms = await livekitService.listRooms();
    res.json(rooms);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Room name is required' });
      return;
    }

    const room = await livekitService.createRoom(name);
    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.get('/:roomName/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;
    const messages = await Message.find({ roomName })
      .sort({ timestamp: 1 })
      .limit(100)
      .lean();
    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/:roomName/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;
    const { senderIdentity, senderName, message } = req.body;

    const msg = new Message({
      roomName,
      senderIdentity: senderIdentity || req.user!.username,
      senderName: senderName || req.user!.username,
      message,
    });
    await msg.save();
    res.status(201).json(msg);
  } catch (err) {
    console.error('Save message error:', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

export default router;
