import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../services/livekit.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Output() messageSent = new EventEmitter<string>();

  @ViewChild('messagesList') private messagesList!: ElementRef;

  newMessage = '';
  private shouldScroll = true;

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
    }
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text) return;
    this.messageSent.emit(text);
    this.newMessage = '';
    this.shouldScroll = true;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      // ignore
    }
  }
}
