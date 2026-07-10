#!/usr/bin/env python3
"""
GOLANG TUNNEL PRO PLUG-IN -> DEPLOYED AS PYTHON UNIFIED HYPER-ENGINE
100% Gabungan Mutlak Logika Sukses Mux (1 Byte) & WS Proxy (Mega-Complex).
"""

import asyncio
import base64
import hashlib
import logging
import os
import signal
import sys
import secrets
import socket

# =====================================================================
# 🛠️ KONFIGURASI ENVIRONMENT / DEFAULT RAILWAY
# =====================================================================
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = int(os.environ.get("MAIN_MUX_PORT", os.environ.get("PORT", "8080")))

SSL_TARGET_HOST = os.environ.get("SSL_TARGET_HOST", "127.0.0.1")
SSL_TARGET_PORT = int(os.environ.get("SSL_TARGET_PORT", "2443"))  # stunnel internal

WS_TARGET_HOST = os.environ.get("WS_TARGET_HOST", "127.0.0.1")
WS_TARGET_PORT = int(os.environ.get("WS_TARGET_PORT", "22"))     # dropbear internal

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TLS_HANDSHAKE_BYTE = 0x16

logging.basicConfig(
    level=logging.INFO,
    format="[unified-engine] %(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("unified")

# =====================================================================
# 🧩 FUNGSI BANTUAN WS-PROXY (PARSER & KEY GENERATOR)
# =====================================================================
def parse_headers(raw: bytes) -> dict:
    headers = {}
    try:
        header_part = raw.split(b"\r\n\r\n", 1)[0]
        lines = header_part.decode(errors="ignore").split("\r\n")
        for line in lines[1:]:
            if not line:
                continue
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
    except Exception as e:
        log.debug("Gagal analisa header: %s", e)
    return headers

def make_accept_key(ws_key: str) -> str:
    sha1 = hashlib.sha1((ws_key + WS_MAGIC).encode()).digest()
    return base64.b64encode(sha1).decode()

def configure_kernel_socket(writer_spec):
    """5. KERNEL SIGNAL ARMOR + 4. MONSTER BUFFER + 3. TURBO ENGINE"""
    sock = writer_spec.get_extra_info('socket')
    if sock is not None:
        # 3. TURBO OPTIMIZATION: Matikan Algoritma Nagle
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        
        # 4. MONSTER BUFFER CAPACITY: Buka keran transmisi 512 KB
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 524288)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 524288)
        
        # 5. KERNEL SIGNAL ARMOR: Ketahanan Sinyal Drop (Toleransi 2,5 Menit)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 30)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)
            keepcnt_opt = getattr(socket, 'TCP_KEEPCNT', 6)
            sock.setsockopt(socket.IPPROTO_TCP, keepcnt_opt, 12)
        except Exception as e:
            log.debug("Gagal menyuntikkan keepalive kernel Linux: %s", e)

# =====================================================================
# 🏎️ JALUR PIPA TRANSFER MURNI (KHUSUS UNTUK JALUR SSL STUNNEL)
# =====================================================================
async def pure_pipe(src: asyncio.StreamReader, dst: asyncio.StreamWriter):
    try:
        while True:
            data = await src.read(65536)
            if not data:
                break
            dst.write(data)
            await dst.drain()
    except Exception:
        pass
    finally:
        try: dst.close()
        except: pass

# =====================================================================
# 🔄 JALUR PIPA KUSTOM (KHUSUS WEBSOCKET & DROPBEAR)
# =====================================================================
async def pipe_client_to_ssh(src: asyncio.StreamReader, dst: asyncio.StreamWriter):
    """1. ENHANCED PAYLOAD MATCHING: Penyaring fragmentasi & pemotong teks sampah"""
    first_packet = True
    buffer_data = b""
    try:
        while True:
            data = await src.read(65536)
            if not data:
                break
            
            if first_packet:
                buffer_data += data
                # Logika pengumpul buffer fragmentasi asli lu
                if b"SSH-" in buffer_data:
                    idx = buffer_data.find(b"SSH-")
                    clean_data = buffer_data[idx:]
                    
                    dst.write(clean_data)
                    await dst.drain()
                    
                    first_packet = False
                    buffer_data = b""
                else:
                    if len(buffer_data) > 65536: 
                        log.warning("Payload sampah terlalu panjang, mereset buffer...")
                        buffer_data = b""
                    continue
            else:
                dst.write(data)
                await dst.drain()
    except Exception:
        pass
    finally:
        try: dst.close()
        except: pass

async def pipe_ssh_to_client(src: asyncio.StreamReader, dst: asyncio.StreamWriter):
    """6. APPLICATION HEARTBEAT: Menyemburkan frame biner tiap 5 detik"""
    try:
        while True:
            try:
                data = await asyncio.wait_for(src.read(65536), timeout=5.0)
                if not data:
                    break
                dst.write(data)
                await dst.drain()
            except asyncio.TimeoutError:
                # Sinyal drop? Suntik instan bingkai biner WebSocket Ping \x89\x00
                dst.write(b"\x89\x00")
                await dst.drain()
    except Exception:
        pass
    finally:
        try: dst.close()
        except: pass

# =====================================================================
# 🌐 PROSES JABAT TANGAN WEBSOCKET (HANDSHAKE INTERNAL)
# =====================================================================
async def process_websocket_handshake(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, initial_data: bytes):
    try:
        raw_headers = initial_data
        headers = parse_headers(raw_headers)
        raw_text_lower = raw_headers.decode(errors="ignore").lower()

        # Ekstraksi Sec-WebSocket-Key secara berlapis
        ws_key = headers.get("sec-websocket-key")
        if not ws_key and "sec-websocket-key:" in raw_text_lower:
            try:
                for line in raw_headers.decode(errors="ignore").split("\r\n"):
                    if "sec-websocket-key" in line.lower():
                        ws_key = line.split(":", 1)[1].strip()
                        break
            except Exception:
                pass

        # 2. BLIND PREMIUM HANDSHAKE Auto-pilot Key Generator
        if not ws_key:
            ws_key = base64.b64encode(secrets.token_bytes(16)).decode()

        accept_key = make_accept_key(ws_key)
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_key}\r\n"
        )
        if "sec-websocket-protocol" in headers:
            response += f"Sec-WebSocket-Protocol: {headers['sec-websocket-protocol']}\r\n"
        response += "\r\n"
        
        writer.write(response.encode())
        await writer.drain()

        # Hubungkan gerbang ke Dropbear SSH internal port 22
        try:
            target_reader, target_writer = await asyncio.open_connection(WS_TARGET_HOST, WS_TARGET_PORT)
        except Exception as e:
            log.error("Gagal interkoneksi ke Dropbear Backend -> %s", e)
            writer.close()
            return

        # Amankan socket target SSH
        target_sock = target_writer.get_extra_info('socket')
        if target_sock is not None:
            target_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

        # Jalankan pipa asinkron paralel kustom bawaan lu
        await asyncio.gather(
            pipe_client_to_ssh(reader, target_writer),
            pipe_ssh_to_client(target_reader, writer)
        )

    except Exception:
        pass
    finally:
        try: writer.close()
        except: pass

# =====================================================================
# 🚪 GERBANG UTAMA DETEKSI (MUX LOGIC COPIED)
# =====================================================================
async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    configure_kernel_socket(writer) # Terapkan Monster Buffer & Armor Sinyal di gerbang awal
    peer = writer.get_extra_info("peername")
    first_byte = b""

    try:
        # Intip byte pertama dengan batas waktu 0.5 detik (Anti-Stuck Mux Logic)
        try:
            first_byte = await asyncio.wait_for(reader.read(1), timeout=0.5)
        except asyncio.TimeoutError:
            first_byte = b""

        # 🛡️ JALUR KEPUTUSAN SSL / STUNNEL
        if first_byte and first_byte[0] == TLS_HANDSHAKE_BYTE:
            try:
                target_reader, target_writer = await asyncio.open_connection(SSL_TARGET_HOST, SSL_TARGET_PORT)
            except Exception:
                writer.close()
                return

            # Kirim bita pertama yang diintip ke Stunnel
            if first_byte:
                target_writer.write(first_byte)
                await target_writer.drain()

            # Jalankan pipa data dua arah murni untuk SSL
            await asyncio.gather(
                pure_pipe(reader, target_writer),
                pure_pipe(target_reader, writer),
            )
            return

        # 🌐 JALUR WEBSOCKET + ARGO TUNNEL (DROPBEAR JALUR SAKTI LU)
        else:
            # Kumpulkan data sisa untuk membaca header HTTP request secara utuh
            try:
                remaining_data = await asyncio.wait_for(reader.read(8192), timeout=2.5)
                full_request = first_byte + remaining_data
            except Exception:
                full_request = first_byte

            if not full_request:
                writer.close()
                return

            # Lempar full paket header ke mesin Handshake WS Internal
            await process_websocket_handshake(reader, writer, full_request)

    except Exception as e:
        log.debug("Error penanganan client %s: %s", peer, e)
    finally:
        try:
            writer.close()
        except Exception:
            pass

# =====================================================================
# 🚀 MAIN LOOP & INITIALIZATION
# =====================================================================
async def main():
    # Mengunci 'limit=16384' di gerbang depan sesuai kodingan mux.py lu
    server = await asyncio.start_server(handle_client, LISTEN_HOST, LISTEN_PORT, limit=16384)
    log.info("==========================================================================")
    log.info(f"🏎️ PYTHON UNIFIED HYPER-ENGINE v2.0 ACTIVE ON PORT {LISTEN_PORT} 🏎️")
    log.info(f"⚙️ Target Routing Map -> SSL: {SSL_TARGET_PORT} | WS-Dropbear: {WS_TARGET_PORT}")
    log.info("==========================================================================")
    async with server:
        await server.serve_forever()

def handle_sigterm(*_):
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, handle_sigterm)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
