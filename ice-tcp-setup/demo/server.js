const express = require("express");
const path = require("path");
const { AccessToken } = require("livekit-server-sdk");

const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Must match keys in livekit.yaml
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "APIKeyChangeMe";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "APISecretChangeMe";

// LiveKit WebSocket URL
// Local dev:  ws://localhost:7880
// Production: wss://livekit.example.com (behind Nginx/Caddy with TLS)
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || "ws://localhost:7880";

// Serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Token endpoint
app.post("/token", async (req, res) => {
  const { room, identity } = req.body;

  if (!room || !identity) {
    return res.status(400).json({ error: "room and identity are required" });
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: identity,
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();
  res.json({ token: jwt, wsUrl: LIVEKIT_WS_URL });
});

app.listen(3000, () => {
  console.log("Demo server running at http://localhost:3000");
});
