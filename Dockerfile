FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Dropbear, Stunnel, Python, dan Node.js sekaligus
RUN apt-get update && apt-get install -y \
    dropbear \
    stunnel4 \
    openssl \
    sudo \
    curl \
    software-properties-common \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared (Argo Tunnel)
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# Buat direktori run untuk dropbear, stunnel, dan node
RUN mkdir -p /var/run/dropbear /var/run/stunnel /etc/dropbear

# Copy script utama ke dalam container
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY server.js /server.js

# Expose port utama Railway
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
