FROM alpine:3.20

# 1. Tambahkan python3 ke dalam daftar instalasi apk Alpine bos
RUN apk update && apk add --no-cache \
    stunnel \
    openssl \
    sudo \
    curl \
    bash \
    nodejs \
    npm \
    python3 \
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

# 5. Copy file script menu andalan lu ke folder sistem
COPY addssh delssh listssh menu /usr/local/bin/

# Paksa Linux memberikan izin eksekusi (chmod 755) ke semua script menu lu!
RUN chmod 755 /usr/local/bin/addssh /usr/local/bin/delssh /usr/local/bin/listssh /usr/local/bin/menu

# 6. Copy core Javascript Muxer v7.0
COPY server.js /server.js

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
