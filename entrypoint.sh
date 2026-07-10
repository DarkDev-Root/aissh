#!/bin/bash

USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"
PUBLIC_PORT="${PORT:-8080}"
SSL_INTERNAL_PORT="2443"

# 1. Membuat Host Keys Dropbear (Jika belum ada)
echo "[*] Menyiapkan Host Keys Dropbear..."
if [ ! -f /etc/dropbear/dropbear_rsa_host_key ]; then
    dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key
fi

# 2. Membuat User untuk login SSH
echo "[*] Membuat User SSH..."
if ! id "$USER_NAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USER_NAME"
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

# 3. Jalankan Dropbear di Port Lokal 22
# Parameter -R (buat auto-generate hostkey jika ada masalah), -W (buka buffer window)
echo "[*] Memulai Dropbear Server di Port Lokal 22..."
dropbear -p 127.0.0.1:22 -W 65536

# 4. Mengonfigurasi & Menjalankan Stunnel4
echo "[*] Mengonfigurasi Stunnel..."
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=RailwaySSH/CN=localhost" \
    -keyout /etc/stunnel/stunnel.pem -out /etc/stunnel/stunnel.pem

cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
foreground = yes
debug = 4

[ssh-ssl]
accept = 127.0.0.1:$SSL_INTERNAL_PORT
connect = 127.0.0.1:22
cert = /etc/stunnel/stunnel.pem
EOF

stunnel4 /etc/stunnel/stunnel.conf &

# 5. Jalankan Cloudflare Argo Tunnel (jika token ada)
if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel..."
    cloudflared tunnel run --token "$CF_TUNNEL_TOKEN" &
fi

echo "[*] Menjalankan Engine Proxy Node.js..."
# 6. Oper eksekusi utama ke Node.js server.js v3.2 (Fix Anti-Crash)
exec env \
    PORT="$PUBLIC_PORT" \
    SSL_TARGET_HOST="127.0.0.1" \
    SSL_TARGET_PORT="$SSL_INTERNAL_PORT" \
    WS_TARGET_HOST="127.0.0.1" \
    WS_TARGET_PORT="22" \
    node /server.js
