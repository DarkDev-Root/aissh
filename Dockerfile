# =====================================================================
# STAGE 1: Gunakan image Ubuntu yang bersih untuk setup environment
# =====================================================================
FROM ubuntu:22.04

# Mengunci sistem agar berjalan murni IPv4 & Mematikan DNS Cache gembrot Ubuntu
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    AI_DISABLE_IPV6=1 \
    GAI_CTR_CACHE=0

# Mengoptimasi repository apt agar mengunduh via IPv4 murni (-o Acquire::ForceIPv4=true)
RUN apt-get update -o Acquire::ForceIPv4=true && apt-get install -y -o Acquire::ForceIPv4=true \
    python3 \
    dropbear \
    stunnel4 \
    openssl \
    curl \
    bash \
    tzdata \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Mengunduh cloudflared versi Linux AMD64 resmi
RUN curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# Set zona waktu ke WIB Jakarta
ENV TZ=Asia/Jakarta
WORKDIR /app

# Salin script Python tunggal main.py dan entrypoint.sh
COPY main.py /app/main.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Beri izin eksekusi penuh pada file entrypoint
RUN chmod +x /usr/local/bin/entrypoint.sh

# Jalankan entrypoint utama
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
