import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LivekitService } from './services/livekit.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private lk = inject(LivekitService);
  chatContainer = viewChild<ElementRef>('chatContainer');

  roomName = 'test-room';
  identity = '';
  chatText = '';
  connecting = false;

  // Expose signals to template
  connectionState = this.lk.connectionState;
  isConnected = this.lk.isConnected;
  isDisconnected = this.lk.isDisconnected;
  participants = this.lk.participants;
  participantCount = this.lk.participantCount;
  messages = this.lk.messages;
  transport = this.lk.transport;
  isMuted = this.lk.isMuted;

  async connect(): Promise<void> {
    if (!this.roomName.trim() || !this.identity.trim()) return;
    this.connecting = true;
    try {
      await this.lk.connect(this.roomName.trim(), this.identity.trim());
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Failed to connect. Check console for details.');
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    await this.lk.disconnect();
  }

  async toggleMute(): Promise<void> {
    await this.lk.toggleMute();
  }

  async sendChat(): Promise<void> {
    const text = this.chatText.trim();
    if (!text) return;
    await this.lk.sendChat(text);
    this.chatText = '';
    setTimeout(() => {
      const el = this.chatContainer()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
