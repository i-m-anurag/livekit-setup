import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  Participant,
  ConnectionState,
  ChatMessage as LkChatMessage,
} from 'livekit-client';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  identity: string;
  text: string;
  isSelf: boolean;
  isSystem: boolean;
  timestamp: Date;
}

export interface ParticipantInfo {
  identity: string;
  isSelf: boolean;
  isSpeaking: boolean;
  audioEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class LivekitService {
  private room: Room | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;

  // Signals
  readonly connectionState = signal<string>('disconnected');
  readonly participants = signal<ParticipantInfo[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly transport = signal<string>('—');
  readonly isMuted = signal<boolean>(false);

  // Computed
  readonly isConnected = computed(() => this.connectionState() === 'connected');
  readonly isDisconnected = computed(() => this.connectionState() === 'disconnected');
  readonly participantCount = computed(() => this.participants().length);

  constructor(private http: HttpClient) {}

  async connect(roomName: string, identity: string): Promise<void> {
    const { token, wsUrl } = await firstValueFrom(
      this.http.post<{ token: string; wsUrl: string }>(environment.tokenEndpoint, {
        room: roomName,
        identity,
      })
    );

    this.room = new Room();

    // Connection state
    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      this.connectionState.set(state);
      if (state === ConnectionState.Connected) {
        this.updateParticipants();
        this.startStatsPolling();
      }
    });

    // Remote audio tracks — attach to DOM to hear them
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: Participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = `audio-${track.sid}`;
          document.body.appendChild(el);
        }
        this.updateParticipants();
      }
    );

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((el) => el.remove());
      this.updateParticipants();
    });

    // Chat
    this.room.on(RoomEvent.ChatMessage, (msg: LkChatMessage, participant?: Participant) => {
      const id = participant?.identity ?? 'unknown';
      const isSelf = id === this.room?.localParticipant.identity;
      this.addMessage({ identity: id, text: msg.message, isSelf, isSystem: false, timestamp: new Date() });
    });

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, (p: Participant) => {
      this.addSystemMessage(`${p.identity} joined`);
      this.updateParticipants();
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (p: Participant) => {
      this.addSystemMessage(`${p.identity} left`);
      this.updateParticipants();
    });

    this.room.on(RoomEvent.ActiveSpeakersChanged, () => this.updateParticipants());
    this.room.on(RoomEvent.TrackMuted, () => this.updateParticipants());
    this.room.on(RoomEvent.TrackUnmuted, () => this.updateParticipants());

    this.room.on(RoomEvent.Disconnected, () => {
      this.addSystemMessage('Disconnected from room');
      this.cleanup();
    });

    await this.room.connect(wsUrl, token);

    // Publish microphone
    await this.room.localParticipant.setMicrophoneEnabled(true);
    this.isMuted.set(false);

    this.addSystemMessage(`Connected to room: ${roomName}`);
    this.updateParticipants();
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.cleanup();
  }

  async toggleMute(): Promise<void> {
    if (!this.room) return;
    const current = this.isMuted();
    await this.room.localParticipant.setMicrophoneEnabled(current);
    this.isMuted.set(!current);
    this.updateParticipants();
  }

  async sendChat(text: string): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.sendChatMessage(text);
    this.addMessage({
      identity: this.room.localParticipant.identity ?? 'me',
      text,
      isSelf: true,
      isSystem: false,
      timestamp: new Date(),
    });
  }

  private updateParticipants(): void {
    if (!this.room) return;
    const local = this.room.localParticipant;
    const all: ParticipantInfo[] = [
      {
        identity: local.identity ?? 'me',
        isSelf: true,
        isSpeaking: local.isSpeaking,
        audioEnabled: local.isMicrophoneEnabled,
      },
      ...[...this.room.remoteParticipants.values()].map((p) => ({
        identity: p.identity,
        isSelf: false,
        isSpeaking: p.isSpeaking,
        audioEnabled: [...p.audioTrackPublications.values()].some((t) => !t.isMuted),
      })),
    ];
    this.participants.set(all);
  }

  private addMessage(msg: ChatMessage): void {
    this.messages.update((msgs) => [...msgs, msg]);
  }

  private addSystemMessage(text: string): void {
    this.addMessage({ identity: '', text, isSelf: false, isSystem: true, timestamp: new Date() });
  }

  private startStatsPolling(): void {
    this.stopStatsPolling();
    this.statsInterval = setInterval(async () => {
      if (!this.room || this.room.state !== ConnectionState.Connected) {
        this.stopStatsPolling();
        return;
      }
      try {
        const pc = (this.room.engine as any).subscriber?.pc as RTCPeerConnection | undefined;
        if (!pc) return;
        const stats = await pc.getStats();
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            stats.forEach((s: any) => {
              if (s.type === 'local-candidate' && s.id === report.localCandidateId) {
                this.transport.set((s.protocol || '').toUpperCase());
              }
            });
          }
        });
      } catch {
        // stats not available yet
      }
    }, 2000);
  }

  private stopStatsPolling(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private cleanup(): void {
    this.stopStatsPolling();
    this.connectionState.set('disconnected');
    this.participants.set([]);
    this.transport.set('—');
    this.isMuted.set(false);
  }
}
