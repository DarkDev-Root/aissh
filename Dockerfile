FROM alpine:latest

# 🛠️ INSTALL DEPENDENCIES (Termasuk Node.js & SSH Server)
RUN apk add --no-cache \
    openssh \
    stunnel \
    bash \
    openssl \
    shadow \
    curl \
    nodejs \
    npm

# 🌐 DOWNLOAD & INSTALL CLOUDFLARE TUNNEL (cloudflared)
RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# Copy file utama ke dalam root container
COPY entrypoint.sh /entrypoint.sh
COPY server.js /server.js

# Beri izin eksekusi untuk entrypoint
RUN chmod +x /entrypoint.sh

# Port default Railway
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]