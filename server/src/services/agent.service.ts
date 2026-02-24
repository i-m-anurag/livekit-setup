import { Room, RoomEvent, Participant, ChatMessage, dispose } from '@livekit/rtc-node';
import { livekitService } from './livekit.service';
import { Message } from '../models/message.model';
import { LIVEKIT_CONFIG } from '../config/livekit';

class AgentService {
  private activeRooms: Map<string, Room> = new Map();

  async joinRoom(roomName: string): Promise<void> {
    if (this.activeRooms.has(roomName)) {
      console.log(`[Agent] Already in room: ${roomName}`);
      return;
    }

    try {
      const token = await livekitService.generateAgentToken(roomName);
      const room = new Room();

      await room.connect(LIVEKIT_CONFIG.wsUrl, token, {
        autoSubscribe: true,
        dynacast: false,
      });

      console.log(`[Agent] Connected to room: ${roomName}`);

      room.on(RoomEvent.ChatMessage, async (msg: ChatMessage, participant?: Participant) => {
        // Ignore our own messages (participant is undefined for local messages)
        if (!participant) return;

        console.log(`[Agent] Message from ${participant.identity}: ${msg.message}`);

        const response = this.generateResponse(msg.message, participant.identity || participant.name || 'User');

        try {
          await room.localParticipant!.sendChatMessage(response);

          // Persist agent response to MongoDB
          await this.persistMessage(roomName, 'ai-agent', 'AI Assistant', response);
        } catch (err) {
          console.error('[Agent] Failed to send response:', err);
        }
      });

      room.on(RoomEvent.ParticipantConnected, async (p: Participant) => {
        console.log(`[Agent] Participant joined: ${p.identity}`);
        try {
          const welcomeMsg = `Welcome to the room, ${p.name || p.identity}! I'm an AI assistant. Feel free to chat with me.`;
          await room.localParticipant!.sendChatMessage(welcomeMsg);
          await this.persistMessage(roomName, 'ai-agent', 'AI Assistant', welcomeMsg);
        } catch (err) {
          console.error('[Agent] Failed to send welcome message:', err);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log(`[Agent] Disconnected from room: ${roomName}`);
        this.activeRooms.delete(roomName);
      });

      this.activeRooms.set(roomName, room);
    } catch (err) {
      console.error(`[Agent] Failed to join room ${roomName}:`, err);
      throw err;
    }
  }

  private generateResponse(userMessage: string, userIdentity: string): string {
    const lower = userMessage.toLowerCase().trim();

    if (lower === '' || lower === ' ') {
      return 'It seems like you sent an empty message. How can I help you?';
    }

    if (/^(hi|hello|hey|greetings|howdy)/.test(lower)) {
      return `Hello ${userIdentity}! How can I help you today?`;
    }

    if (lower.includes('help')) {
      return 'I am a simple AI assistant running as a LiveKit participant. I can respond to your messages in real-time over WebRTC data channels. This POC demonstrates ICE over TCP connectivity - no UDP ports needed!';
    }

    if (lower.includes('how are you')) {
      return "I'm doing great, thanks for asking! I'm running as a server-side LiveKit participant connected via TCP.";
    }

    if (lower.includes('what can you do')) {
      return 'I can chat with you in real-time through LiveKit data channels. This setup uses ICE over TCP, making it compatible with corporate VPNs that block UDP traffic.';
    }

    if (lower.includes('tcp') || lower.includes('udp') || lower.includes('ice')) {
      return 'Great question! This POC uses ICE over TCP (port 7881) instead of the default UDP transport. This means it works even in restrictive network environments like corporate VPNs that block UDP. The LiveKit server is configured with tcp_port: 7881 and the client uses iceTransportPolicy: relay.';
    }

    if (lower.includes('bye') || lower.includes('goodbye')) {
      return `Goodbye ${userIdentity}! It was nice chatting with you.`;
    }

    return `You said: "${userMessage}". I'm a POC chatbot demonstrating LiveKit WebRTC over TCP. Try saying "help" to learn more!`;
  }

  private async persistMessage(roomName: string, senderIdentity: string, senderName: string, message: string): Promise<void> {
    try {
      await new Message({ roomName, senderIdentity, senderName, message }).save();
    } catch (err) {
      console.error('[Agent] Failed to persist message:', err);
    }
  }

  async leaveRoom(roomName: string): Promise<void> {
    const room = this.activeRooms.get(roomName);
    if (room) {
      await room.disconnect();
      this.activeRooms.delete(roomName);
      console.log(`[Agent] Left room: ${roomName}`);
    }
  }

  async shutdown(): Promise<void> {
    console.log('[Agent] Shutting down all rooms...');
    for (const [name, room] of this.activeRooms) {
      try {
        await room.disconnect();
        console.log(`[Agent] Disconnected from room: ${name}`);
      } catch (err) {
        console.error(`[Agent] Error disconnecting from ${name}:`, err);
      }
    }
    this.activeRooms.clear();
    dispose();
  }

  isInRoom(roomName: string): boolean {
    return this.activeRooms.has(roomName);
  }

  getActiveRooms(): string[] {
    return Array.from(this.activeRooms.keys());
  }
}

export const agentService = new AgentService();
