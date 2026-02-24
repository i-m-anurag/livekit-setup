import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import {
  Room,
  RoomEvent,
  Participant,
  ConnectionState,
  ChatMessage as LkChatMessage,
} from 'livekit-client';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id: string;
  message: string;
  timestamp: number;
  senderIdentity: string;
  senderName: string;
  isLocal: boolean;
}

@Injectable({ providedIn: 'root' })
export class LivekitService {
  private room: Room | null = null;

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private participantsSubject = new BehaviorSubject<Participant[]>([]);
  private connectionStateSubject = new BehaviorSubject<string>('disconnected');

  messages$ = this.messagesSubject.asObservable();
  participants$ = this.participantsSubject.asObservable();
  connectionState$ = this.connectionStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  async connect(roomName: string, participantName: string): Promise<void> {
    // 1. Request agent to join the room
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/agent/join`, { roomName })
      );
    } catch (err) {
      console.warn('Agent join request failed (may already be in room):', err);
    }

    // 2. Fetch LiveKit token from Express backend
    const { token } = await firstValueFrom(
      this.http.post<{ token: string }>(`${environment.apiUrl}/token`, {
        roomName,
        participantName,
      })
    );

    // 3. Create Room instance
    this.room = new Room();

    // 4. Set up event listeners BEFORE connecting
    this.setupEventListeners();

    // 5. Connect with ICE/TCP configuration
    await this.room.connect(environment.livekitWsUrl, token);

    this.connectionStateSubject.next('connected');
    this.updateParticipantList();
  }

  private setupEventListeners(): void {
    if (!this.room) return;

    // Chat messages
    this.room.on(RoomEvent.ChatMessage, (payload: LkChatMessage, participant?: Participant) => {
      const current = this.messagesSubject.value;
      this.messagesSubject.next([
        ...current,
        {
          id: payload.id || crypto.randomUUID(),
          message: payload.message,
          timestamp: payload.timestamp || Date.now(),
          senderIdentity: participant?.identity || this.room?.localParticipant?.identity || 'local',
          senderName: participant?.name || this.room?.localParticipant?.name || 'You',
          isLocal: !participant,
        },
      ]);
    });

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, () => this.updateParticipantList());
    this.room.on(RoomEvent.ParticipantDisconnected, () => this.updateParticipantList());

    // Connection state
    this.room.on(RoomEvent.Disconnected, () => {
      this.connectionStateSubject.next('disconnected');
      this.participantsSubject.next([]);
    });
    this.room.on(RoomEvent.Reconnecting, () => {
      this.connectionStateSubject.next('reconnecting');
    });
    this.room.on(RoomEvent.Reconnected, () => {
      this.connectionStateSubject.next('connected');
    });
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.room?.localParticipant) {
      throw new Error('Not connected to a room');
    }
    await (this.room.localParticipant as any).sendChatMessage(text);
  }

  private updateParticipantList(): void {
    if (!this.room) return;
    const participants: Participant[] = [
      this.room.localParticipant,
      ...Array.from(this.room.remoteParticipants.values()),
    ];
    this.participantsSubject.next(participants);
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
      this.messagesSubject.next([]);
      this.participantsSubject.next([]);
      this.connectionStateSubject.next('disconnected');
    }
  }

  isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }
}
