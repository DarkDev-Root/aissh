#!/bin/bash

# =================================================================
# 🚀 ULTRA TURBO KERNEL v2.6 (ALPINE OPENSSH + BANNER PELANGI ELITE) 🚀
# =================================================================
echo "[*] Mengaktifkan TCP BBR dan Fair Queuing..."
sysctl -w net.core.default_qdisc=fq 2>/dev/null
sysctl -w net.ipv4.tcp_congestion_control=bbr 2>/dev/null

echo "[*] Mengoptimalkan ukuran buffer TCP Kernel (1MB Default)..."
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

chown -R stunnel:stunnel /etc/stunnel /var/run/stunnel
chmod 600 /etc/stunnel/stunnel.pem

echo "[*] Mengonfigurasi User SSH (Alpine Mode)..."
if ! id "$USER_NAME" &>/dev/null; then
    adduser -D -s /bin/bash "$USER_NAME"
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

# 🌈 RACIKAN BANNER PELANGI PREMIUM UNTUK HTTP CUSTOM
echo "[*] Membuat Banner Pelangi untuk OpenSSH..."
# Menggunakan format ANSI color code agar HTTP Custom membaca teks berwarna-warni
cat << 'EOF' > /etc/ssh/ssh_banner
[1;31m==================================================[0m
[1;35m               SELAMAT MENIKMATI 👑               [0m
[1;33m              SSH SERVER RAILWAY MOD              [0m
[1;32m==================================================[0m
[1;36m SPESIFIKASI:                                     [0m
[1;34m 🔹 NODE JS MULTIPLEXER                           [0m
[1;35m 🔹 OS LINUX ALPINE SPEK RAMPING                  [0m
[1;31m 🔹 OPEN SSH SERVER HIGH COMPATIBILITY            [0m
[1;32m==================================================[0m
[1;36m powered by : d e d e f a t h u                 [0m
[1;31m==================================================[0m
EOF

echo "[*] Menyiapkan Host Keys untuk OpenSSH..."
ssh-keygen -A

echo "[*] Membuat konfigurasi khusus OpenSSH..."
cat << 'EOF' > /etc/ssh/sshd_config
Port 22
ListenAddress 127.0.0.1
PermitRootLogin yes
PasswordAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM no
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/ssh/sftp-server

# 🔥 Sambungkan file banner yang barusan kita buat agar muncul pas konek
Banner /etc/ssh/ssh_banner

# Buka paksa algoritma jadul agar HTTP Custom bisa jabat tangan dengan sukses
KexAlgorithms +diffie-hellman-group-exchange-sha1,diffie-hellman-group14-sha1
Ciphers +aes256-ctr,aes128-ctr
MACs +hmac-sha1
EOF

echo "[*] Memulai OpenSSH Server di Port Lokal 22..."
/usr/sbin/sshd

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
