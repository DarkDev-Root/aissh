# ==========================================
# STEP 1: Compile Engine Go v5.6 (Builder)
# ==========================================
FROM golang:1.21-alpine AS builder

# Set working directory internal
WORKDIR /app

# Copy seluruh source code Go ke dalam container
COPY main.go ./

# Compile script Go menjadi file binary tunggal (turbo-proxy)
RUN CGO_ENABLED=0 GOOS=linux go build -o turbo-proxy main.go

# ==========================================
# STEP 2: Main Runtime Container (Dropbear)
# ==========================================
FROM alpine:3.19

# Install tools yang dibutuhkan: Dropbear, Stunnel, OpenSSL, Bash, dan TZData
RUN apk add --no-cache \
    dropbear \
    stunnel \
    openssl \
    bash \
    tzdata \
    util-linux \
    shadow

# Set zona waktu ke Asia/Jakarta agar log server akurat
ENV TZ=Asia/Jakarta

# Buat direktori kerja internal untuk aplikasi
WORKDIR /usr/local/bin

# Ambil file binary Go yang sudah di-compile dari STEP 1
COPY --from=builder /app/turbo-proxy /usr/local/bin/turbo-proxy
RUN chmod +x /usr/local/bin/turbo-proxy

# Buat folder konfigurasi Dropbear dan Stunnel
RUN mkdir -p /etc/dropbear /etc/stunnel /var/run

# Copy script entrypoint.sh lu ke dalam container
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Eksekusi script entrypoint.sh sebagai perintah utama saat container dinyalakan
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
