const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;

const BUFFER_SIZE = 1024 * 1024; // 1MB Buffer Jumbo Optimal

console.log(`[monster-mux] PURE PIPE ENGINE v9.0 ACTIVE 🚀`);

function parseHeaders(rawBuffer) {
    const headers = {};
    try {
        const lines = rawBuffer.toString('utf8').split("\r\n");
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(":")) {
                const parts = line.split(":");
                headers[parts[0].trim().toLowerCase()] = parts.slice(1).join(":").trim();
            }
        }
    } catch (e) {}
    return headers;
}

const server = net.createServer({
    readableHighWaterMark: BUFFER_SIZE,
    writableHighWaterMark: BUFFER_SIZE
}, (clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 60000); // 60 Detik TCP KeepAlive di level socket Node

    let firstPacketRead = false;

    clientConn.on('data', (chunk) => {
        // HANYA CEK PAKET PERTAMA UNTUK FILTER JALUR
        if (!firstPacketRead) {
            firstPacketRead = true;
            
            // Hancurkan listener data kustom agar sistem PIPA murni bekerja full speed tanpa terganggu
            clientConn.removeAllListeners('data'); 

            if (chunk[0] === TLS_HANDSHAKE_BYTE) {
                // === JALUR SSL MURNI ===
                const targetConn = net.connect({ 
                    host: SSL_TARGET_HOST, 
                    port: SSL_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(chunk);
                    
                    // Jembatan pipa otomatis dua arah bawaan C++ Core Node.js (Anti-Rontok Pas Upload)
                    clientConn.pipe(targetConn);
                    targetConn.pipe(clientConn);
                });

                const destroyAll = () => { clientConn.destroy(); targetConn.destroy(); };
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
                clientConn.on('error', destroyAll);
                clientConn.on('close', destroyAll);

            } else {
                // === JALUR WEBSOCKET / PAYLOAD ANEH ===
                const headers = parseHeaders(chunk);
                const rawTextLower = chunk.toString('utf8').toLowerCase();
                const isWsUpgrade = rawTextLower.includes("upgrade: websocket") || headers["upgrade"] === "websocket";

                if (isWsUpgrade) {
                    let wsKey = headers["sec-websocket-key"];
                    if (!wsKey && rawTextLower.includes("sec-websocket-key:")) {
                        try {
                            const lines = chunk.toString('utf8').split("\r\n");
                            for (let line of lines) {
                                if (line.toLowerCase().includes("sec-websocket-key")) {
                                    wsKey = line.split(":")[1].trim();
                                    break;
                                }
                            }
                        } catch (e) {}
                    }
                    if (!wsKey) wsKey = crypto.randomBytes(16).toString('base64');
                    const shasum = crypto.createHash('sha1');
                    shasum.update(wsKey + WS_MAGIC);
                    const acceptKey = shasum.digest('base64');

                    let response = "HTTP/1.1 101 Switching Protocols\r\n" +
                                   "Upgrade: websocket\r\n" +
                                   "Connection: Upgrade\r\n" +
                                   `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`;
                    clientConn.write(Buffer.from(response));
                } else {
                    clientConn.write(Buffer.from(DEFAULT_RESPONSE));
                }

                // Langsung hubungkan ke OpenSSH lokal
                const targetConn = net.connect({ 
                    host: "127.0.0.1", 
                    port: SSH_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    
                    // Aliran data murni byte-by-byte (Sama persis seperti core engine Vless)
                    clientConn.pipe(targetConn);
                    targetConn.pipe(clientConn);
                });

                const destroyAll = () => { clientConn.destroy(); targetConn.destroy(); };
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
                clientConn.on('error', destroyAll);
                clientConn.on('close', destroyAll);
            }
        }
    });
});

server.listen(LISTEN_PORT, '0.0.0.0');
