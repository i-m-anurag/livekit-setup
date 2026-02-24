# TURN TLS Certificate Setup

The TURN server requires TLS certificates for the TURN domain (`turn.example.com`).

## Directory Structure

```
ssl/
└── turn/
    ├── fullchain.pem    # Full certificate chain
    └── privkey.pem      # Private key
```

## Option 1: Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot   # Debian/Ubuntu
sudo yum install certbot   # CentOS/RHEL

# Get certificate (must run BEFORE docker compose, port 80 must be free)
sudo certbot certonly --standalone -d turn.example.com

# Copy certs to this directory
sudo cp /etc/letsencrypt/live/turn.example.com/fullchain.pem ./turn/
sudo cp /etc/letsencrypt/live/turn.example.com/privkey.pem ./turn/
sudo chmod 644 ./turn/*.pem
```

## Option 2: Self-Signed (Testing Only)

```bash
openssl req -x509 -newkey rsa:4096 -keyout ./turn/privkey.pem \
  -out ./turn/fullchain.pem -days 365 -nodes \
  -subj "/CN=turn.example.com"
```

**Note:** Self-signed certs will NOT work with most WebRTC clients in production.

## Auto-Renewal

Set up a cron job for Let's Encrypt renewal:

```bash
# Add to crontab: crontab -e
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/turn.example.com/fullchain.pem /path/to/production/ssl/turn/ && \
  cp /etc/letsencrypt/live/turn.example.com/privkey.pem /path/to/production/ssl/turn/ && \
  docker restart livekit-server
```
