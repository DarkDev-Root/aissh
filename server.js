const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;

console.log(`[monster-mux] ENHANCED ULTRA CLEANER v6.5 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

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

// SERVER UTAMA (MULTIPLEXER GERBANG DEPAN)
const server = net.createServer({
    readableHighWaterMark: 1024 * 1024,
    writableHighWaterMark: 1024 * 1024
}, (clientConn) => {
    clientConn.setNoDelay(true);

    clientConn.once('data', (firstByte) => {
        if (!firstByte || firstByte.length === 0) {
            clientConn.destroy();
            return;
        }

        // 🛡️ JALUR 1: SSL (STUNNEL)
        if (firstByte[0] === TLS_HANDSHAKE_BYTE) {
            const targetConn = net.connect({ 
                host: SSL_TARGET_HOST, 
                port: SSL_TARGET_PORT,
                readableHighWaterMark: 1024 * 1024,
                writableHighWaterMark: 1024 * 1024
            }, () => {
                targetConn.setNoDelay(true);
                targetConn.write(firstByte);
                clientConn.pipe(targetConn);
                targetConn.pipe(clientConn);
            });

            const destroySSL = () => {
                clientConn.destroy();
                if (targetConn) targetConn.destroy();
            };
            targetConn.on('error', destroySSL);
            targetConn.on('close', destroySSL);
            clientConn.on('error', destroySSL);
            clientConn.on('close', destroySSL);

        // 🛡️ JALUR 2: WEBSOCKET (DENGAN SARINGAN SAPU BERSIH ENHANCED)
        } else {
            let targetConn = null;

            const destroyWS = () => {
                clientConn.destroy();
                if (targetConn) targetConn.destroy();
            };

            // Jabat tangan WebSocket Awal
            const headers = parseHeaders(firstByte);
            const rawTextLower = firstByte.toString('utf8').toLowerCase();
            const isWsUpgrade = rawTextLower.includes("upgrade: websocket") || headers["upgrade"] === "websocket";

            if (isWsUpgrade) {
                let wsKey = headers["sec-websocket-key"];
                if (!wsKey && rawTextLower.includes("sec-websocket-key:")) {
                    try {
                        const lines = firstByte.toString('utf8').split("\r\n");
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

            // Konek ke Dropbear Internal Port 22
            targetConn = net.connect({ 
                host: "127.0.0.1", 
                port: SSH_TARGET_PORT,
                readableHighWaterMark: 1024 * 1024,
                writableHighWaterMark: 1024 * 1024
            }, () => {
                targetConn.setNoDelay(true);

                // 🚀 UPLOAD: Saringan Ketat Abadi Jaminan Steril Dropbear
                clientConn.on('data', (chunk) => {
                    let cleanChunk = chunk;
                    const chunkStr = chunk.toString('utf8');

                    // Bersihkan segala jenis ampas HTTP / Respon palsu bawaan payload Enhanced
                    if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                        if (chunkStr.includes("SSH-")) {
                            const idx = chunkStr.indexOf("SSH-");
                            cleanChunk = chunk.slice(idx);
                        } else if (chunkStr.includes("\x53\x53\x48")) { // Deteksi header biner SSH raw
                            const idx = chunk.indexOf(Buffer.from([0x53, 0x53, 0x48]));
                            cleanChunk = chunk.slice(idx);
                        } else {
                            // Murni sampah HTTP susulan penggembos Dropbear -> BAKAR TOTAL!
                            return;
                        }
                    }

                    if (targetConn.writable) targetConn.write(cleanChunk);
                });

                // 🚀 DOWNLOAD: Pipa langsung loss speed monster
                targetConn.pipe(clientConn);
            });

            targetConn.on('error', destroyWS);
            targetConn.on('close', destroyWS);
            clientConn.on('error', destroyWS);
            clientConn.on('close', destroyWS);
        }
    });
});

server.listen(LISTEN_PORT, '0.0.0.0');
