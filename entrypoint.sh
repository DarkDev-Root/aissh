#!/bin/bash

# =================================================================
# 🚀 ULTRA TURBO KERNEL v2.4 (ALPINE COMPATIBLE CRYPTO OPENING) 🚀
# =================================================================
echo "[*] Mengaktifkan TCP BBR dan Fair Queuing..."
sysctl -w net.core.default_qdisc=fq 2>/dev/null
sysctl -w net.ipv4.tcp_congestion_control=bbr 2>/dev/null

echo "[*] Mengoptimalkan ukuran buffer TCP Kernel (Upload/Download Plong)..."
sysctl -w net.ipv4.tcp_rmem="4096 1048576 16777216" 2>/dev/null
sysctl -w net.ipv4.tcp_wmem="4096 1048576 16777216" 2>/dev/null
sysctl -w net.core.rmem_max=16777216 2>/dev/null
sysctl -w net.core.wmem_max=16777216 2>/dev/null

USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"
PUBLIC_PORT="${PORT:-8080}"
SSL_INTERNAL_PORT="${SSL_INTERNAL_PORT:-2443}"

echo "[*] Membuat sertifikat SSL Stunnel dinamis..."
mkdir -p /etc/stunnel /var/run/stunnel
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=RailwaySSH/CN=localhost" \
    -keyout /etc/stunnel/stunnel.pem -out /etc/stunnel/stunnel.pem

# Fix permission agar user stunnel Alpine tidak memicu crash crash/Permission Denied
chown -R stunnel:stunnel /etc/stunnel /var/run/stunnel
chmod 600 /etc/stunnel/stunnel.pem

echo "[*] Mengonfigurasi Server Message Dropbear..."
cat << 'EOF' > /etc/dropbear_banner
=================================================
             PREMIUM SSH SERVER DROPBEAR         
=================================================
       Dilarang Torrent / DDOS / Hacking!        
=================================================
EOF

echo "[*] Mengonfigurasi User SSH (Alpine Mode)..."
if ! id "$USER_NAME" &>/dev/null; then
    adduser -D -s /bin/bash "$USER_NAME"
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai Dropbear Server di Port Lokal 22 (Buka Kunci Algoritma Jadul)..."
mkdir -p /etc/dropbear
# 🔥 MODIFIKASI EMAS: Ditambahkan parameter -A untuk membuka paksa KEX sha1 bawaan HTTP Custom!
/usr/sbin/dropbear -p 127.0.0.1:22 -b /etc/dropbear_banner -W 65536 -A +diffie-hellman-group-exchange-sha1,+diffie-hellman-group14-sha1

echo "[*] Membuat konfigurasi Stunnel..."
cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
foreground = yes
debug = 4
chroot = /var/run/stunnel
setuid = stunnel
setgid = stunnel

[ssh-ssl]
accept = 127.0.0.1:$SSL_INTERNAL_PORT
connect = 127.0.0.1:22
cert = /etc/stunnel/stunnel.pem
EOF

echo "[*] Menambahkan sesuatu di .bashrc..."
cat <<'EOF'>> /etc/bash.bashrc
clear
alias c='clear'
alias x='exit'
alias cls='clear;ls'
menu
EOF
echo "source /etc/bash.bashrc" >> /home/"$USER_NAME"/.bashrc

echo "[*] Memulai Stunnel..."
stunnel /etc/stunnel/stunnel.conf &

# --- Argo Tunnel (cloudflared) ---
if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel..."
    cloudflared tunnel run --url "http://127.0.0.1:$PUBLIC_PORT" --token "$CF_TUNNEL_TOKEN" &
fi

echo "[*] Memulai All-In-One Node.js Muxer Monster v7.0..."
exec env PORT="$PUBLIC_PORT" SSL_TARGET_HOST="127.0.0.1" SSL_TARGET_PORT="$SSL_INTERNAL_PORT" node /server.js
