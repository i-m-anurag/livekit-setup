import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { LIVEKIT_CONFIG } from '../config/livekit';

class LivekitService {
  private roomService: RoomServiceClient;

  constructor() {
    const httpUrl = LIVEKIT_CONFIG.wsUrl
      .replace('ws://', 'http://')
      .replace('wss://', 'https://');
    this.roomService = new RoomServiceClient(httpUrl, LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret);
  }

  async listRooms() {
    return this.roomService.listRooms();
  }

  async createRoom(name: string) {
    return this.roomService.createRoom({ name, emptyTimeout: 600, maxParticipants: 20 });
  }

  async generateAgentToken(roomName: string): Promise<string> {
    const at = new AccessToken(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret, {
      identity: 'ai-agent',
      name: 'AI Assistant',
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return at.toJwt();
  }
}

export const livekitService = new LivekitService();
