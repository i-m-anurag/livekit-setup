import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Participant } from 'livekit-client';
import { LivekitService, ChatMessage } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatComponent } from '../chat/chat.component';
import { ParticipantsComponent } from '../participants/participants.component';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatComponent, ParticipantsComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss',
})
export class RoomComponent implements OnDestroy {
  roomName = '';
  connectionState = 'disconnected';
  messages: ChatMessage[] = [];
  participants: Participant[] = [];
  error = '';
  joining = false;

  private subs: Subscription[] = [];

  constructor(
    private livekitService: LivekitService,
    private authService: AuthService,
    private chatService: ChatService,
    private router: Router
  ) {
    this.subs.push(
      this.livekitService.connectionState$.subscribe((state) => {
        this.connectionState = state;
      }),
      this.livekitService.messages$.subscribe((msgs) => {
        this.messages = msgs;
      }),
      this.livekitService.participants$.subscribe((parts) => {
        this.participants = parts;
      })
    );
  }

  async joinRoom(): Promise<void> {
    if (!this.roomName.trim()) return;

    this.joining = true;
    this.error = '';

    try {
      const username = this.authService.getUsername() || 'user';
      await this.livekitService.connect(this.roomName.trim(), username);
    } catch (err: any) {
      this.error = err?.message || 'Failed to join room';
      console.error('Join room error:', err);
    } finally {
      this.joining = false;
    }
  }

  async onSendMessage(text: string): Promise<void> {
    try {
      await this.livekitService.sendMessage(text);

      // Persist user message to MongoDB
      const username = this.authService.getUsername() || 'user';
      this.chatService.saveMessage(this.roomName, username, username, text).subscribe({
        error: (err) => console.warn('Failed to persist message:', err),
      });
    } catch (err: any) {
      console.error('Send message error:', err);
    }
  }

  async leaveRoom(): Promise<void> {
    await this.livekitService.disconnect();
    this.roomName = '';
  }

  logout(): void {
    this.livekitService.disconnect();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.livekitService.disconnect();
  }
}
