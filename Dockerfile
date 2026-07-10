FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Python3, Dropbear, Stunnel4, OpenSSL, Curl, dan Bash
RUN apt-get update && apt-get install -y \
    python3 \
    dropbear \
    stunnel4 \
    openssl \
    curl \
    bash \
    tzdata \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Download Cloudflared resmi untuk terowongan Argo
RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

ENV TZ=Asia/Jakarta
WORKDIR /app

# Salin script Python dan entrypoint ke dalam kontainer
COPY main.py /app/main.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
