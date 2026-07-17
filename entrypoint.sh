#!/bin/bash

# =================================================================
# 🚀 ULTRA TURBO KERNEL v2.8 (FIXED FOR MASSIVE SPEEDTEST UPLOAD) 🚀
# =================================================================
echo "[*] Mengaktifkan TCP BBR dan Fair Queuing..."
sysctl -w net.core.default_qdisc=fq 2>/dev/null
sysctl -w net.ipv4.tcp_congestion_control=bbr 2>/dev/null

echo "[*] Mengoptimalkan ukuran buffer TCP Kernel (BUFFER DITINGKATKAN)..."
# Angka tengah (default) dinaikkan ke 4MB & Maksimal ke 32MB agar tidak overload pas upload
sysctl -w net.ipv4.tcp_rmem="4096 4194304 33554432" 2>/dev/null
sysctl -w net.ipv4.tcp_wmem="4096 4194304 33554432" 2>/dev/null
sysctl -w net.core.rmem_max=33554432 2>/dev/null
sysctl -w net.core.wmem_max=33554432 2>/dev/null
# Tambahan tweaks anti packet loss saat upload deras
sysctl -w net.core.netdev_max_backlog=10000 2>/dev/null
sysctl -w net.ipv4.tcp_max_syn_backlog=8192 2>/dev/null

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

echo "[*] Membuat Banner Rapi untuk OpenSSH..."
cat << 'EOF' > /etc/ssh/ssh_banner
==================================================
              👑 SELAMAT MENIKMATI 👑              
              SSH SERVER RAILWAY MOD              
==================================================
 SPESIFIKASI:                                     
 🔹 MULTIPLEXER : NODE JS ULTRA ENGINE            
 🔹 OS PLATFORM : LINUX ALPINE (RAM MONSTER MODE)  
 🔹 SSH SERVICE : OPENSSH SERVER HIGH COMPAT      
==================================================
          powered by : d e d e f a t h u          
==================================================
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
Banner /etc/ssh/ssh_banner
KexAlgorithms +diffie-hellman-group-exchange-sha1,diffie-hellman-group14-sha1
Ciphers +aes256-ctr,aes128-ctr
MACs +hmac-sha1
EOF

echo "[*] Memulai OpenSSH Server di Port Lokal 22..."
/usr/sbin/sshd

echo "[*] Membuat konfigurasi Stunnel..."
# 🛠 FIX KUNCI: Menghapus chroot agar Stunnel tidak crash saat badai upload
cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
foreground = yes
debug = 4
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
