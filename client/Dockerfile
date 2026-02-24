# =============================================================================
# Angular Frontend - Production Dockerfile
# Multi-stage: Build with Node, Serve with Nginx
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for Docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build Angular for production
RUN npx ng build --configuration=production

# --- Stage 2: Serve with Nginx ---
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config for Angular SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from builder
COPY --from=builder /app/dist/client/browser /usr/share/nginx/html

# Non-root user (nginx alpine runs as nginx user)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
