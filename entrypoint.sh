#!/bin/bash

# =================================================================
# 🚀 ULTRA TURBO KERNEL v2.2 (ALPINE TWEAK MAKSIMAL - PLONG UPLOAD) 🚀
# =================================================================
echo "[*] Mengaktifkan TCP BBR dan Fair Queuing..."
sysctl -w net.core.default_qdisc=fq 2>/dev/null
sysctl -w net.ipv4.tcp_congestion_control=bbr 2>/dev/null

echo "[*] Mengoptimalkan ukuran buffer TCP Kernel (Upload & Download 1MB Default)..."
sysctl -w net.ipv4.tcp_rmem="4096 1048576 16777216" 2>/dev/null
sysctl -w net.ipv4.tcp_wmem="4096 1048576 16777216" 2>/dev/null
sysctl -w net.core.rmem_max=16777216 2>/dev/null
sysctl -w net.core.wmem_max=16777216 2>/dev/null
sysctl -w net.ipv4.tcp_no_metrics_save=1 2>/dev/null
sysctl -w net.ipv4.tcp_moderate_rcvbuf=1 2>/dev/null

# Mengambil environment variables atau menggunakan nilai default dd milik lu bos
USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"

PUBLIC_PORT="${PORT:-8080}"
SSL_INTERNAL_PORT="${SSL_INTERNAL_PORT:-2443}"

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
echo -e "\e[1;37m OS           : \e[1;33mAlpine Linux (All-In-One Pipe Mode)\e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;31m   TETAP PATUHI RULES SERVER AGAR TIDAK BANNED   \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
EOF
chmod +x /etc/profile.d/99-respon-server.sh

echo "[*] Mengonfigurasi User SSH (Gaya Alpine)..."
if ! id "$USER_NAME" &>/dev/null; then
    # -D = Jangan minta password interaktif saat pembuatan user awal
    # -s = Set default shell ke bash
    adduser -D -s /bin/bash "$USER_NAME"
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai Dropbear Server di Port Lokal 22 (Alpine)..."
# Menggunakan biner dropbear bawaan Alpine di /usr/sbin/
/usr/sbin/dropbear -p 127.0.0.1:22 -b /etc/dropbear_banner -W 65536

echo "[*] Membuat konfigurasi Stunnel di Port $SSL_INTERNAL_PORT..."
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
cat <<'EOF'>> /etc/bash.bashrc
clear
alias c='clear'
alias x='exit'
alias cls='clear;ls'
menu
EOF
# Hubungkan bashrc Alpine agar user dd otomatis mengeksekusi script saat login
echo "source /etc/bash.bashrc" >> /home/"$USER_NAME"/.bashrc

echo "[*] Memulai Stunnel (internal, port $SSL_INTERNAL_PORT)..."
stunnel /etc/stunnel/stunnel.conf &

# --- Argo Tunnel (cloudflared) ---
if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel..."
    cloudflared tunnel run --url "http://127.0.0.1:$PUBLIC_PORT" --token "$CF_TUNNEL_TOKEN" &
else
    echo "[!] CF_TUNNEL_TOKEN tidak diset -> Cloudflare Tunnel dilewati."
fi

echo "[*] Memulai All-In-One Node.js Muxer Monster v6.0..."
exec env PORT="$PUBLIC_PORT" SSL_TARGET_HOST="127.0.0.1" SSL_TARGET_PORT="$SSL_INTERNAL_PORT" node /server.js
