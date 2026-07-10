# ==========================================
# STEP 1: Compile Engine Go v5.7 (Builder)
# ==========================================
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o turbo-proxy main.go

# ==========================================
# STEP 2: Main Runtime Container (Ubuntu + Dropbear)
# ==========================================
FROM ubuntu:22.04

# Cegah prompt interaktif saat instalasi
ENV DEBIAN_FRONTEND=noninteractive

# Install Dropbear, Stunnel, OpenSSL, Curl, dan Bash di Ubuntu
RUN apt-get update && apt-get install -y \
    dropbear \
    stunnel4 \
    openssl \
    curl \
    bash \
    tzdata \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 🚀 DOWNLOAD CLOUDFLARED UNTUK UBUNTU (Linux AMD64)
RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

ENV TZ=Asia/Jakarta
WORKDIR /usr/local/bin

# Ambil binary Go
COPY --from=builder /app/turbo-proxy /usr/local/bin/turbo-proxy
RUN chmod +x /usr/local/bin/turbo-proxy

# Siapkan folder konfigurasi
RUN mkdir -p /etc/dropbear /etc/stunnel /var/run

# Copy entrypoint.sh ke dalam Ubuntu
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
