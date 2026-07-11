FROM alpine:3.20

# 1. Install alat tempur runtime di Alpine (Sangat ringan & hemat RAM)
RUN apk update && apk add --no-cache \
    stunnel \
    openssl \
    sudo \
    curl \
    bash \
    nodejs \
    npm \
    dropbear

# Install cloudflared (untuk Argo Tunnel) langsung versi Alpine/Linux AMD64
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# Membuat direktori kerja yang dibutuhkan
RUN mkdir -p /var/run/dropbear /var/run/stunnel /etc/dropbear /etc/stunnel

# Membuat satu sertifikat .pem gabungan yang valid untuk Stunnel di Alpine
RUN openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=RailwaySSH/CN=localhost" \
    -keyout /etc/stunnel/stunnel.pem -out /etc/stunnel/stunnel.pem

# Copy & siapkan script starter utama
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Jaga file menu andalan lu
COPY addssh delssh listssh menu /usr/local/bin/
RUN chmod +x /usr/local/bin/addssh /usr/local/bin/delssh /usr/local/bin/listssh /usr/local/bin/menu

# Pindahkan berkas JavaScript Muxer Monster v6.0 ke Root
COPY server.js /server.js

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
