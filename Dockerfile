FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# --- FIXED LOGIKA: Tetap pakai Dropbear + Stunnel4 + Suntik Node.js v20 Resmi ---
RUN apt-get update && apt-get install -y \
    dropbear \
    stunnel4 \
    openssl \
    sudo \
    curl \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared (untuk Argo Tunnel, jalur WS)
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# Membuat direktori run untuk dropbear dan stunnel
RUN mkdir -p /var/run/dropbear /var/run/stunnel /etc/dropbear

# Membuat satu sertifikat .pem gabungan yang valid untuk Stunnel
RUN openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=RailwaySSH/CN=localhost" \
    -keyout /etc/stunnel/stunnel.pem -out /etc/stunnel/stunnel.pem

# Copy & siapkan script starter utama
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Tetap jaga file menu andalan lu bos jangan sampai ilang
COPY addssh delssh listssh menu /usr/local/bin/
RUN chmod +x /usr/local/bin/addssh /usr/local/bin/delssh /usr/local/bin/listssh /usr/local/bin/menu

# --- STRATEGI MULTI-PROCESS SINKRON: Pindahkan berkas JavaScript ke Root ---
COPY ws-proxy.js /ws-proxy.js
COPY server.js /server.js

# Cukup SATU port publik: server.js (Muxer Node) yang membedakan SSL vs WS secara otomatis
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
