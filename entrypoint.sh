#!/bin/bash

USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"
PUBLIC_PORT="${PORT:-8080}"
SSL_INTERNAL_PORT="${SSL_INTERNAL_PORT:-2443}"

# =====================================================================
# 🔥 SETUP DROPBEAR: Super Ringan, Full Speed, Anti-Lag
# =====================================================================
echo "[*] Membuat direktori kunci Dropbear..."
mkdir -p /etc/dropbear

echo "[*] Menghasilkan Host Keys Dropbear..."
dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key
dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key

echo "[*] Mengonfigurasi Banner Dropbear..."
cat << 'EOF' > /etc/dropbear_banner
=================================================
                  SELAMAT MENIKMATI
      👑 PREMIUM SSH SERVER DROPBEAR modssh 👑   
=================================================
       Dilarang Torrent / DDOS / Hacking! 
          👑 PRIVATE TUNNEL BY: DEDEFATHU 👑
=================================================
EOF

echo "[*] Mengonfigurasi User SSH..."
# Pastikan user terdaftar resmi di sistem Alpine
if ! id "$USER_NAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USER_NAME"
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai DROPBEAR Server di Port Lokal 22..."
# -F = Jalankan di foreground (opsional, tapi di sini kita bg dengan &)
# -p = Binds ke port 127.0.0.1:22 agar aman dari luar
# -b = Tampilkan banner custom
# -a = Izinkan forward koneksi
dropbear -p 127.0.0.1:22 -b /etc/dropbear_banner -a &

# 🔥 TAMBAHAN SSL: Buat Sertifikat SSL Stunnel
echo "[*] Membuat Sertifikat SSL Stunnel..."
openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=RailwaySSH/CN=localhost" \
    -keyout /etc/stunnel/stunnel.pem -out /etc/stunnel/stunnel.pem

echo "[*] Mengonfigurasi Stunnel internal di Port $SSL_INTERNAL_PORT..."
cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
foreground = yes
debug = 4

[ssh-ssl]
accept = 127.0.0.1:$SSL_INTERNAL_PORT
connect = 127.0.0.1:22
cert = /etc/stunnel/stunnel.pem
EOF

echo "[*] Memulai Stunnel (internal, port $SSL_INTERNAL_PORT)..."
stunnel /etc/stunnel/stunnel.conf &

if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel (Argo)..."
    cloudflared tunnel run --token "$CF_TUNNEL_TOKEN" &
fi

# 🎨 BANNER STARTUP LOG RAILWAY WARNA-WARNI DITENGAH
cyan="\e[1;36m"
yellow="\e[1;33m"
magenta="\e[1;35m"
green="\e[1;32m"
reset="\e[0m"

rawTitle="⚡ GOLANG TUNNEL PRO: DROPBEAR ENGINE v5.6 FULL SPEED ACTIVE ⚡"
rawOwner="👑 PRIVATE TUNNEL BY: DEDEFATHU 👑"

paddingTitle=$(( (66 - ${#rawTitle}) / 2 ))
paddingOwner=$(( (66 - ${#rawOwner}) / 2 ))

centerTitle=$(printf "%${paddingTitle}s" "")$rawTitle
centerOwner=$(printf "%${paddingOwner}s" "")$rawOwner

echo -e "${cyan}==================================================================${reset}"
echo -e "${yellow}${centerTitle}${reset}"
echo -e "${magenta}${centerOwner}${reset}"
echo -e "${green}==================================================================${reset}"
echo -e "${green}[*] Engine listening smoothly on port: ${PUBLIC_PORT}${reset}"
echo -e "${cyan}==================================================================${reset}"

exec env \
    PORT="$PUBLIC_PORT" \
    SSL_TARGET_HOST="127.0.0.1" \
    SSL_TARGET_PORT="$SSL_INTERNAL_PORT" \
    WS_TARGET_HOST="127.0.0.1" \
    WS_TARGET_PORT="22" \
    turbo-proxy
