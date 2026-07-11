FROM alpine:3.20

# 1. Install OpenSSH Server dan runtime tools lainnya di Alpine
RUN apk update && apk add --no-cache \
    stunnel \
    openssl \
    sudo \
    curl \
    bash \
    nodejs \
    npm \
    openssh-server \
    openssh-client

# 2. Install cloudflared (Argo Tunnel) untuk Linux AMD64
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# 3. Create necessary application directories
RUN mkdir -p /var/run/sshd /var/run/stunnel /etc/stunnel

# 4. Copy main entrypoint scripting
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 5. Keep your custom operational helper tools
COPY addssh delssh listssh menu /usr/local/bin/
RUN chmod +x /usr/local/bin/addssh /usr/local/bin/delssh /usr/local/bin/listssh /usr/local/bin/menu

# 6. Copy core Javascript Muxer v7.0
COPY server.js /server.js

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
