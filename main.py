import asyncio
import os
import sys

# Ambil Port Lingkungan dari Railway / Default internal
PORT = int(os.environ.get("PORT", 8080))
SSL_HOST = os.environ.get("SSL_TARGET_HOST", "127.0.0.1")
SSL_PORT = int(os.environ.get("SSL_TARGET_PORT", 2443))
WS_HOST = os.environ.get("WS_TARGET_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("WS_TARGET_PORT", 22))

WS_MAGIC = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

async def pipe(reader, writer, is_upload=False):
    """ Jembatan pipa data transparan, loss tanpa rem """
    try:
        first = True
        while True:
            data = await reader.read(65536)
            if not data:
                break
            
            # 🛡️ LOGIKA SUKSES: Saring teks SSH- hanya pada paket pertama upload
            if is_upload and first:
                idx = data.find(b"SSH-")
                if idx != -1:
                    data = data[idx:]
                    first = False
            
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

async def handle_client(client_reader, client_writer):
    # Set TCP No Delay pada socket klien untuk performa instan
    sock = client_writer.get_extra_info('socket')
    if sock:
        import socket
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    try:
        # Mode Sabar otomatis membaca paket handshake awal dari HP
        data = await asyncio.wait_for(client_reader.read(65536), timeout=3.0)
    except Exception:
        client_writer.close()
        return

    if not data:
        client_writer.close()
        return

    # 🛡️ JALUR SSL/TLS DETECTION (Menuju Stunnel)
    if data[0] == 0x16:
        try:
            target_reader, target_writer = await asyncio.open_connection(SSL_HOST, SSL_PORT)
            target_writer.write(data)
            await target_writer.drain()
            
            await asyncio.gather(
                pipe(client_reader, target_writer),
                pipe(target_reader, client_writer)
            )
        except Exception:
            pass
        return

    # 🌐 JALUR WEBSOCKET HANDSHAKE (Menuju Dropbear)
    if b"Upgrade: websocket" in data or b"upgrade: websocket" in data:
        lines = data.split(b"\r\n")
        ws_key = b""
        for line in lines:
            if line.lower().startswith(b"sec-websocket-key:"):
                ws_key = line.split(b":")[1].strip()
                break
        
        if not ws_key:
            import base64, time
            ws_key = base64.b64encode(str(time.time()).encode())

        import hashlib, base64
        hash_obj = hashlib.sha1(ws_key + WS_MAGIC)
        accept_key = base64.b64encode(hash_obj.digest())

        response = (
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\n"
            b"Connection: Upgrade\r\n"
            b"Sec-WebSocket-Accept: " + accept_key + b"\r\n\r\n"
        )
        client_writer.write(response)
        await client_writer.drain()

        try:
            # Hubungkan langsung ke Dropbear lokal port 22
            target_reader, target_writer = await asyncio.open_connection(WS_HOST, WS_PORT)
            
            # Putar pipa data secara asinkron (Jalur HP->SSH disaring, Jalur SSH->HP loss)
            await asyncio.gather(
                pipe(client_reader, target_writer, is_upload=True),
                pipe(target_reader, client_writer, is_upload=False)
            )
        except Exception:
            pass
        return

    client_writer.close()

async def main():
    print("==================================================================")
    print(f"🏎️ PYTHON ASYNC HYPER-ENGINE v1.0 ACTIVE ON PORT {PORT} 🏎️")
    print("==================================================================")
    server = await asyncio.start_server(handle_client, '0.0.0.0', PORT)
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
