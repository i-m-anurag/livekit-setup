# LiveKit Integration Guide - ICE over TCP

## What This Infra Gives You

```
Your Existing App                          This Docker Stack
┌──────────────────────┐                  ┌──────────────────────┐
│  Node.js Backend     │───WebSocket────►│  LiveKit Server      │
│  (token generation)  │   :7880         │  (SFU)               │
│                      │                  │                      │
│  Angular Frontend    │───ICE/TCP──────►│  :7881 ICE/TCP       │
│  (livekit-client)    │───TURN/TLS────►│  :5349 TURN/TLS      │
│                      │                  │                      │
│  Node.js Agent       │───WebSocket────►│                      │
│  (@livekit/rtc-node) │   :7880         │  Redis (state store) │
└──────────────────────┘                  └──────────────────────┘
```

Ports exposed (ALL TCP, zero UDP):
- `7880` — WebSocket signaling (proxy behind HTTPS in production)
- `7881` — ICE over TCP media (expose directly, no L7 proxy)
- `5349` — TURN/TLS relay (for firewalls that block 7881 too)

---

## Step 1: Start LiveKit Infrastructure

```bash
cd livekit-infra

# Generate API key/secret
bash generate-keys.sh

# Create .env
cp .env.template .env
# Edit .env with your generated key/secret

# Update livekit.yaml keys section to match .env
# Also update turn.domain if you have a TURN domain

# Start
docker compose up -d

# Verify
docker compose ps
docker compose logs -f livekit-server
```

---

## Step 2: Node.js Backend Integration

### Install

```bash
npm install livekit-server-sdk
```

### Environment Variables (add to your app's .env)

```env
LIVEKIT_API_KEY=<same key from livekit.yaml>
LIVEKIT_API_SECRET=<same secret from livekit.yaml>
LIVEKIT_WS_URL=ws://localhost:7880          # dev
# LIVEKIT_WS_URL=wss://livekit.yourdomain.com  # prod (behind TLS proxy)
```

### Token Generation Endpoint

Create an API endpoint that generates LiveKit tokens for your authenticated users:

```typescript
import { AccessToken } from 'livekit-server-sdk';

// POST /api/livekit/token
// Body: { roomName: string }
// Auth: Your existing auth middleware

async function generateToken(req, res) {
  const { roomName } = req.body;
  const username = req.user.username; // from your auth

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: username,
      name: username,
      ttl: '10m',
    }
  );

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,   // required for chat/data messages
  });

  const token = await at.toJwt();  // async in v2+
  res.json({ token });
}
```

### Room Management (Optional)

```typescript
import { RoomServiceClient } from 'livekit-server-sdk';

const roomService = new RoomServiceClient(
  'http://localhost:7880',   // HTTP, not WS
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// List rooms
const rooms = await roomService.listRooms();

// Create room
const room = await roomService.createRoom({ name: 'my-room', emptyTimeout: 300 });

// List participants
const participants = await roomService.listParticipants('my-room');

// Remove participant
await roomService.removeParticipant('my-room', 'user-identity');
```

---

## Step 3: Angular Frontend Integration

### Install

```bash
npm install livekit-client
```

### Environment Config

```typescript
// environment.ts (dev)
export const environment = {
  livekitWsUrl: 'ws://localhost:7880',
};

// environment.production.ts
export const environment = {
  livekitWsUrl: 'wss://livekit.yourdomain.com',
};
```

### LiveKit Service

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Room, RoomEvent, Participant, ConnectionState } from 'livekit-client';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LivekitService {
  private room: Room | null = null;

  participants$ = new BehaviorSubject<Participant[]>([]);
  connectionState$ = new BehaviorSubject<string>('disconnected');

  constructor(private http: HttpClient) {}

  async connect(roomName: string): Promise<Room> {
    // 1. Get token from YOUR backend
    const { token } = await firstValueFrom(
      this.http.post<{ token: string }>('/api/livekit/token', { roomName })
    );

    // 2. Create room
    this.room = new Room();

    // 3. Listen for events BEFORE connect
    this.room.on(RoomEvent.ParticipantConnected, () => this.refreshParticipants());
    this.room.on(RoomEvent.ParticipantDisconnected, () => this.refreshParticipants());
    this.room.on(RoomEvent.Disconnected, () => this.connectionState$.next('disconnected'));
    this.room.on(RoomEvent.Reconnecting, () => this.connectionState$.next('reconnecting'));
    this.room.on(RoomEvent.Reconnected, () => this.connectionState$.next('connected'));

    // 4. Connect — NO special rtcConfig needed
    //    The server's force_tcp / tcp_port handles transport selection
    await this.room.connect(environment.livekitWsUrl, token);

    this.connectionState$.next('connected');
    this.refreshParticipants();
    return this.room;
  }

  async disconnect(): Promise<void> {
    await this.room?.disconnect();
    this.room = null;
  }

  getRoom(): Room | null {
    return this.room;
  }

  private refreshParticipants(): void {
    if (!this.room) return;
    this.participants$.next([
      this.room.localParticipant,
      ...Array.from(this.room.remoteParticipants.values()),
    ]);
  }
}
```

### Chat via Data Messages

```typescript
// Send
await room.localParticipant.sendChatMessage('Hello!');

// Receive
room.on(RoomEvent.ChatMessage, (msg, participant) => {
  console.log(`${participant?.name}: ${msg.message}`);
});
```

### Audio/Video Publishing (if needed later)

```typescript
// Publish mic
await room.localParticipant.setMicrophoneEnabled(true);

// Publish camera
await room.localParticipant.setCameraEnabled(true);

// Subscribe to remote tracks
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  const element = track.attach(); // returns HTMLMediaElement
  document.getElementById('remote-video').appendChild(element);
});
```

---

## Step 4: Server-Side Agent (Optional - AI Bot)

If you want a bot/agent to join rooms from your Node.js backend:

### Install

```bash
npm install @livekit/rtc-node
```

### Agent Code

```typescript
import { Room, RoomEvent, Participant, ChatMessage, dispose } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';

async function joinAsAgent(roomName: string) {
  // 1. Generate agent token
  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: 'ai-agent',
    name: 'AI Assistant',
    ttl: '1h',
  });
  at.addGrant({
    roomJoin: true, room: roomName,
    canPublish: true, canSubscribe: true, canPublishData: true,
  });
  const token = await at.toJwt();

  // 2. Connect
  const room = new Room();
  await room.connect('ws://localhost:7880', token);

  // 3. Handle chat
  room.on(RoomEvent.ChatMessage, async (msg: ChatMessage, participant?: Participant) => {
    if (!participant) return; // skip own messages
    const reply = `Echo: ${msg.message}`;
    await room.localParticipant!.sendChatMessage(reply);
  });

  // 4. Welcome new participants
  room.on(RoomEvent.ParticipantConnected, async (p: Participant) => {
    await room.localParticipant!.sendChatMessage(`Welcome ${p.name || p.identity}!`);
  });

  return room;
}

// Cleanup on shutdown
process.on('SIGTERM', () => { dispose(); });
```

---

## Production Checklist

### LiveKit Config (`livekit.yaml`)

- [ ] Replace `keys:` with your generated API key/secret
- [ ] Set `turn.domain` to your actual TURN domain
- [ ] Place TLS certs in `ssl/turn/fullchain.pem` and `ssl/turn/privkey.pem`
- [ ] Verify `use_external_ip: true` for cloud VMs

### Reverse Proxy (Nginx/Caddy/Traefik)

Put a TLS-terminating reverse proxy in front of port 7880 so clients connect via `wss://`:

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name livekit.yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

**Caddy example:**
```
livekit.yourdomain.com {
    reverse_proxy localhost:7880
}
```

### Firewall Rules

Open these TCP ports only:
```
443/tcp   — HTTPS (reverse proxy → LiveKit signaling as WSS)
7881/tcp  — ICE over TCP (direct, no proxy)
5349/tcp  — TURN/TLS (relay for most restrictive firewalls)
```

### DNS Records

```
livekit.yourdomain.com  → A → <server-ip>   (signaling)
turn.yourdomain.com     → A → <server-ip>   (TURN/TLS)
```

### Client Connection Flow

```
Browser connects to wss://livekit.yourdomain.com (signaling)
    │
    ├── Tries ICE/TCP on :7881 ──► Direct TCP media ✓
    │
    └── If 7881 blocked, falls back to TURN/TLS on :5349 ──► Relay ✓
```

---

## TURN TLS Certificates

```bash
# Option A: Let's Encrypt (production)
sudo certbot certonly --standalone -d turn.yourdomain.com
sudo cp /etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem ssl/turn/
sudo cp /etc/letsencrypt/live/turn.yourdomain.com/privkey.pem ssl/turn/

# Option B: Self-signed (testing only)
openssl req -x509 -newkey rsa:4096 \
  -keyout ssl/turn/privkey.pem \
  -out ssl/turn/fullchain.pem \
  -days 365 -nodes \
  -subj "/CN=turn.yourdomain.com"
```

---

## Quick Verification

```bash
# 1. Check LiveKit is running
curl http://localhost:7880

# 2. Check ICE/TCP port
nc -zv localhost 7881

# 3. Check TURN/TLS port
nc -zv localhost 5349

# 4. Check from browser (after connecting)
# Open chrome://webrtc-internals/
# Look for ICE candidates — should show only TCP, zero UDP
```
