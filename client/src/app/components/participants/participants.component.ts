import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Participant } from 'livekit-client';

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participants.component.html',
  styleUrl: './participants.component.scss',
})
export class ParticipantsComponent {
  @Input() participants: Participant[] = [];

  isAgent(p: Participant): boolean {
    return p.identity === 'ai-agent';
  }

  isLocal(p: Participant): boolean {
    return !('audioTrackPublications' in p && 'getTrack' in p) ||
      p === this.participants[0]; // first participant is always local
  }
}
