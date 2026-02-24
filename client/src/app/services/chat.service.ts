import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface Message {
  _id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  message: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private http: HttpClient) {}

  getHistory(roomName: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${environment.apiUrl}/rooms/${roomName}/messages`);
  }

  saveMessage(roomName: string, senderIdentity: string, senderName: string, message: string): Observable<Message> {
    return this.http.post<Message>(`${environment.apiUrl}/rooms/${roomName}/messages`, {
      senderIdentity,
      senderName,
      message,
    });
  }
}
