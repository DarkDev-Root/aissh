#!/bin/bash

USER_NAME="${SSH_USER:-dd}"
USER_PASS="${SSH_PASSWORD:-dd}"
PUBLIC_PORT="${PORT:-8080}"
SSL_INTERNAL_PORT="${SSL_INTERNAL_PORT:-2443}"
WS_INTERNAL_PORT="${WS_INTERNAL_PORT:-8880}"

echo "[*] Mengonfigurasi Server Message Dropbear (Banner Pra-Login)..."
cat << 'EOF' > /etc/dropbear_banner
=================================================
                  SELAMAT MENIKMATI
      👑 PREMIUM SSH SERVER DROPBEAR modssh 👑   
=================================================
       Dilarang Torrent / DDOS / Hacking! 
          👑 PRIVATE TUNNEL BY: DEDEFATHU 👑
=================================================
EOF

echo "[*] Mengonfigurasi Respon Server (Pasca-Login)..."
mkdir -p /etc/profile.d
cat << 'EOF' > /etc/profile.d/99-respon-server.sh
#!/bin/bash
clear
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;32m       [✓] BERHASIL TERHUBUNG KE SERVER!         \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;37m Username     : \e[1;33m$USER\e[0m"
echo -e "\e[1;37m Waktu Server : \e[1;33m$(date)\e[0m"
echo -e "\e[1;37m OS           : \e[1;33mUbuntu Linux (Python Async Mode)\e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;31m   TETAP PATUHI RULES SERVER AGAR TIDAK BANNED   \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
EOF
chmod +x /etc/profile.d/99-respon-server.sh

echo "[*] Mengonfigurasi User SSH..."
if ! id "$USER_NAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USER_NAME"
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai Dropbear Server di Port Lokal 22..."
# 🔑 KUNCI SUKSES LU: Parameter -W 65536 dipertahankan total agar buffer loss!
/usr/sbin/dropbear -p 127.0.0.1:22 -b /etc/dropbear_banner -W 65536 -K 10 -I 0 &

# 🔥 TAMBAHAN SSL: Buat Sertifikat SSL Stunnel
echo "[*] Membuat Sertifikat SSL Stunnel..."
mkdir -p /etc/stunnel
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

echo "[*] Menambahkan alias dan auto-start menu ke .bashrc..."
cat <<'EOF'>> ~/.bashrc
clear
alias c='clear'
alias x='exit'
alias +x='chmod +x'
alias cls='clear;ls'

menu
EOF

cat <<'EOF'>> /etc/skel/.bashrc
clear
menu
EOF

echo "[*] Memulai Stunnel (internal, port $SSL_INTERNAL_PORT)..."
stunnel4 /etc/stunnel/stunnel.conf &

if [ -n "$CF_TUNNEL_TOKEN" ]; then
    echo "[*] Menjalankan Cloudflare Tunnel (Argo)..."
    # 🧼 STERILIZER: Membersihkan token otomatis agar tidak pincang akibat spasi gaib
    CLEAN_TOKEN=$(echo -n "$CF_TUNNEL_TOKEN" | tr -cd '[:print:]' | tr -d '[:space:]')
    cloudflared tunnel run --token "$CLEAN_TOKEN" &
    sleep 2
else
    echo "[!] CF_TUNNEL_TOKEN kosong -> Cloudflare Tunnel dilewati."
fi

# 🎨 BANNER STARTUP LOG RAILWAY WARNA-WARNI DITENGAH PRESISI
cyan="\e[1;36m"
yellow="\e[1;33m"
magenta="\e[1;35m"
green="\e[1;32m"
reset="\e[0m"

rawTitle="⚡ PYTHON TUNNEL PRO: UBUNTU + DROPBEAR HYPER-ASYNC ACTIVE ⚡"
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

echo "[*] Memulai PYTHON ASYNC ENGINE di Port PUBLIK $PUBLIC_PORT..."
exec env \
    PORT="$PUBLIC_PORT" \
    SSL_TARGET_HOST="127.0.0.1" \
    SSL_TARGET_PORT="$SSL_INTERNAL_PORT" \
    WS_TARGET_HOST="127.0.0.1" \
    WS_TARGET_PORT="22" \
    python3 /app/main.py
