#!/bin/bash

# =================================================================
# 🚀 ULTRA TURBO KERNEL & NETWORK TWEAK (KERUK RAM MAKSIMAL) 🚀
# =================================================================
echo "[*] Mengaktifkan TCP BBR dan Fair Queuing..."
sysctl -w net.core.default_qdisc=fq 2>/dev/null
sysctl -w net.ipv4.tcp_congestion_control=bbr 2>/dev/null

echo "[*] Mengoptimalkan ukuran buffer TCP Kernel (Jebol Batasan Linux)..."
# Memaksa OS membuka pipa memori jaringan dari standar ke batas maksimal 16MB
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216" 2>/dev/null
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216" 2>/dev/null
sysctl -w net.core.rmem_max=16777216 2>/dev/null
sysctl -w net.core.wmem_max=16777216 2>/dev/null
sysctl -w net.ipv4.tcp_no_metrics_save=1 2>/dev/null
sysctl -w net.ipv4.tcp_moderate_rcvbuf=1 2>/dev/null

# Mengambil environment variables atau menggunakan nilai default
USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"

# Port PUBLIK (yang di-arahkan Railway TCP Proxy ke sini)
PUBLIC_PORT="${PORT:-8080}"

# Port INTERNAL, tidak diekspos keluar, hanya dipakai antar-proses di dalam container
SSL_INTERNAL_PORT="${SSL_INTERNAL_PORT:-2443}"
WS_INTERNAL_PORT="${WS_INTERNAL_PORT:-8880}"

echo "[*] Mengonfigurasi Server Message Dropbear (Banner Pra-Login)..."
cat << 'EOF' > /etc/dropbear_banner
=================================================
             PREMIUM SSH SERVER DROPBEAR         
=================================================
       Dilarang Torrent / DDOS / Hacking!        
=================================================
EOF

echo "[*] Mengonfigurasi Respon Server (Pasca-Login)..."
cat << 'EOF' > /etc/profile.d/99-respon-server.sh
#!/bin/bash
clear
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;32m       [✓] BERHASIL TERHUBUNG KE SERVER!         \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;37m Username     : \e[1;33m$USER\e[0m"
echo -e "\e[1;37m Waktu Server : \e[1;33m$(date)\e[0m"
echo -e "\e[1;37m OS           : \e[1;33mUbuntu 22.04 (Node.js Muxer Monster Mode)\e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;31m   TETAP PATUHI RULES SERVER AGAR TIDAK BANNED   \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
EOF
chmod +x /etc/profile.d/99-respon-server.sh

echo "[*] Mengonfigurasi User SSH..."
if ! id "$USER_NAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USER_NAME"
    usermod -aG sudo "$USER_NAME"
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai Dropbear Server di Port Lokal 22..."
# -p 127.0.0.1:22 = Hanya merespon internal (aman lewat proxy)
# -b /etc/dropbear_banner = Memasang banner pra-login
# -W 65536 = Trik premium memaksimalkan buffer size agar speed download ngacir
/usr/sbin/dropbear -p 127.0.0.1:22 -b /etc/dropbear_banner -W 65536

echo "[*] Membuat konfigurasi Stunnel (internal) di Port $SSL_INTERNAL_PORT..."
cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
foreground = yes
debug = 4

[ssh-ssl]
accept = 127.0.0.1:$SSL_INTERNAL_PORT
connect = 127.0.0.1:22
cert = /etc/stunnel/stunnel.pem
EOF

echo "[*] Menambahkan sesuatu di .bashrc..."
cat <<'EOF'>> ~/.bashrc
clear
R='\e[1;31m'
G='\e[1;32m'
C='\e[1;36m'
N='\e[0m'

alias c='clear'
alias x='exit'
alias +x='chmod +x'
alias cls='clear;ls'

menu
EOF

echo "[*] Memulai Stunnel4 (internal, port $SSL_INTERNAL_PORT)..."
stunnel4 /etc/stunnel/stunnel.conf &

echo "[*] Memulai WebSocket Proxy Node.js Spek Monster (internal, port $WS_INTERNAL_PORT)..."
WS_TARGET_HOST="127.0.0.1" WS_TARGET_PORT="22" node /ws-proxy.js &

# --- Argo Tunnel (cloudflared) Jalur Utama Muxer ---
if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel (Argo) langsung ke Gerbang Muxer..."
    cloudflared tunnel run --url "http://127.0.0.1:$PUBLIC_PORT" --token "$CF_TUNNEL_TOKEN" &
else
    echo "[!] CF_TUNNEL_TOKEN tidak diset -> Cloudflare Tunnel dilewati."
fi

echo "[*] Memulai Node.js Multiplexer di Port PUBLIK $PUBLIC_PORT..."
exec env \
    PORT="$PUBLIC_PORT" \
    SSL_TARGET_HOST="127.0.0.1" SSL_TARGET_PORT="$SSL_INTERNAL_PORT" \
    node /server.js
