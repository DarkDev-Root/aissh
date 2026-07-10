import asyncio
import os
import sys
import hashlib
import base64
import time

PORT = int(os.environ.get("PORT", 8080))
SSL_HOST = os.environ.get("SSL_TARGET_HOST", "127.0.0.1")
SSL_PORT = int(os.environ.get("SSL_TARGET_PORT", 2443))
WS_HOST = os.environ.get("WS_TARGET_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("WS_TARGET_PORT", 22))

WS_MAGIC = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

async def pipe(reader, writer, is_upload=False):
    """ Pipa data transparan - Buang kotoran sampai biner SSH keluar """
    try:
        first = True
        while True:
            data = await reader.read(131072) # Buffer 128KB
            if not data:
                break
            
            if is_upload and first:
                idx = data.find(b"SSH-")
                if idx != -1:
                    data = data[idx:]
                    first = False
                    writer.write(data)
                    await writer.drain()
                else:
                    # Buang sampah payload [split] HTTP di awal sampai ketemu biner SSH murni
                    continue
            else:
                writer.write(data)
                await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

async def handle_client(client_reader, client_writer):
    sock = client_writer.get_extra_info('socket')
    if sock:
        import socket
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    try:
        # Mode Sabar 3 detik baca request dari HP
        data = await asyncio.wait_for(client_reader.read(65536), timeout=3.0)
    except Exception:
        try: client_writer.close()
        except: pass
        return

    if not data:
        try: client_writer.close()
        except: pass
        return

    # 🛡️ JALUR SSL/TLS MURNI (Stunnel)
    if data[0] == 0x16:
        try:
            target_reader, target_writer = await asyncio.open_connection(SSL_HOST, SSL_PORT)
            target_writer.write(data)
            await target_writer.drain()
            
            await asyncio.gather(
                pipe(client_reader, target_writer, is_upload=False),
                pipe(target_reader, client_writer, is_upload=False)
            )
        except Exception:
            pass
        return

    # 🌐 JALUR WEBSOCKET HANDSHAKE (Dropbear via Argo)
    if b"upgrade: websocket" in data.lower():
        lines = data.split(b"\r\n")
        ws_key = b""
        for line in lines:
            if line.lower().startswith(b"sec-websocket-key:"):
                ws_key = line.split(b":")[1].strip()
                break
        
        if not ws_key:
            ws_key = base64.b64encode(str(time.time()).encode())

        hash_obj = hashlib.sha1(ws_key + WS_MAGIC)
        accept_key = base64.b64encode(hash_obj.digest())

        # ✨ PERBAIKAN TOTAL: Format HTTP Header dibuat super bersih & standar tanpa modifikasi teks
        response = (
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\n"
            b"Connection: Upgrade\r\n"
            b"Sec-WebSocket-Accept: " + accept_key + b"\r\n\r\n"
        )
        client_writer.write(response)
        await client_writer.drain()

        try:
            # Hubungkan ke Dropbear lokal port 22
            target_reader, target_writer = await asyncio.open_connection(WS_HOST, WS_PORT)
            
            # Jalankan pipa asinkron
            asyncio.create_task(pipe(client_reader, target_writer, is_upload=True))
            await pipe(target_reader, client_writer, is_upload=False)
        except Exception:
            pass
        return

    try: client_writer.close()
    except: pass

async def main():
    print("==================================================================")
    print(f"🏎️ PYTHON ASYNC HYPER-ENGINE v1.3 STERIL CORE ACTIVE ON PORT {PORT} 🏎️")
    print("==================================================================")
    server = await asyncio.start_server(handle_client, '0.0.0.0', PORT)
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
