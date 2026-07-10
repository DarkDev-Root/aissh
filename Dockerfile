# ==========================================
# STEP 1: Compile Engine Go v5.6 (Builder)
# ==========================================
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o turbo-proxy main.go

# ==========================================
# STEP 2: Main Runtime Container (Dropbear + Cloudflared)
# ==========================================
FROM alpine:3.19

# Install tools dasar
RUN apk add --no-cache \
    dropbear \
    stunnel \
    openssl \
    bash \
    tzdata \
    util-linux \
    shadow \
    curl

# 🚀 SUNTIKAN SAKTI: Unduh & Pasang Cloudflared Resmi di Level OS
RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

ENV TZ=Asia/Jakarta
WORKDIR /usr/local/bin

COPY --from=builder /app/turbo-proxy /usr/local/bin/turbo-proxy
RUN chmod +x /usr/local/bin/turbo-proxy

RUN mkdir -p /etc/dropbear /etc/stunnel /var/run

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
