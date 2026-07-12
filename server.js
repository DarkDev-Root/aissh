const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;
const BUFFER_SIZE = 1024 * 1024; 

console.log(`[monster-mux] ALL-IN-ONE FIXED ELITE v7.6 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

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

// 🔥 Fungsi Unmasking: Mengupas payload WebSocket biner murni saat upload
function decodeWsFrame(buffer) {
    if (buffer.length < 6) return buffer; 
    
    const finOpcode = buffer[0];
    // Hanya proses jika ini adalah frame biner (0x82) atau kelanjutan frame (0x80)
    if ((finOpcode & 0x0f) === 0x02 || (finOpcode & 0x0f) === 0x00 || (finOpcode & 0x0f) === 0x01) {
        const hasMask = (buffer[1] & 0x80) !== 0;
        let payloadLen = buffer[1] & 0x7f;
        let maskOffset = 2;

        if (payloadLen === 126) maskOffset = 4;
        else if (payloadLen === 127) maskOffset = 10;

        if (!hasMask) {
            return buffer.slice(maskOffset);
        }

        const maskKey = buffer.slice(maskOffset, maskOffset + 4);
        const payload = buffer.slice(maskOffset + 4);
        
        // Dekripsi XOR Masking dari Client (Proses krusial saat Upload Speedtest)
        for (let i = 0; i < payload.length; i++) {
            payload[i] = payload[i] ^ maskKey[i % 4];
        }
        return payload;
    }
    return buffer;
}

const server = net.createServer({
    readableHighWaterMark: BUFFER_SIZE,
    writableHighWaterMark: BUFFER_SIZE
}, (clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 30000);

    let targetConn = null;
    let isWsJalur = false;
    let firstPacketRead = false;
    let handshakeDone = false;
    
    let queueBuffers = []; 
    let backendReady = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.on('data', (chunk) => {
        if (!firstPacketRead) {
            firstPacketRead = true;
            
            if (chunk[0] === TLS_HANDSHAKE_BYTE) {
                isWsJalur = false;
                targetConn = net.connect({ 
                    host: SSL_TARGET_HOST, 
                    port: SSL_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(chunk);
                    backendReady = true;
                });
            } else {
                isWsJalur = true;
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

                targetConn = net.connect({ 
                    host: "127.0.0.1", 
                    port: SSH_TARGET_PORT,
                    readableHighWaterMark: BUFFER_SIZE,
                    writableHighWaterMark: BUFFER_SIZE
                }, () => {
                    targetConn.setNoDelay(true);
                    backendReady = true;
                    
                    if (queueBuffers.length > 0) {
                        for (let qChunk of queueBuffers) {
                            if (targetConn.writable) targetConn.write(qChunk);
                        }
                        queueBuffers = [];
                    }
                });
            }

            targetConn.on('data', (bChunk) => {
                // Konversi data dari Dropbear ke format frame WebSocket sebelum dikirim ke HP
                if (isWsJalur) {
                    const wsHeader = Buffer.alloc(2);
                    wsHeader[0] = 0x82; // Binary frame
                    if (bChunk.length <= 125) {
                        wsHeader[1] = bChunk.length;
                        if (clientConn.writable) clientConn.write(Buffer.concat([wsHeader, bChunk]));
                    } else if (bChunk.length <= 65535) {
                        wsHeader[1] = 126;
                        const extLen = Buffer.alloc(2);
                        extLen.writeUInt16BE(bChunk.length, 0);
                        if (clientConn.writable) clientConn.write(Buffer.concat([wsHeader, extLen, bChunk]));
                    } else {
                        wsHeader[1] = 127;
                        const extLen = Buffer.alloc(8);
                        extLen.writeUInt32BE(0, 0);
                        extLen.writeUInt32BE(bChunk.length, 4);
                        if (clientConn.writable) clientConn.write(Buffer.concat([wsHeader, extLen, bChunk]));
                    }
                } else {
                    if (clientConn.writable) clientConn.write(bChunk);
                }
            });
            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);
            return;
        }

        // 🚀 PROSES PENANGANAN DATA DATA LANJUTAN (ANTI-SPEEDTEST DC)
        if (isWsJalur) {
            let cleanChunk = chunk;
            const chunkStr = chunk.toString('utf8');

            // 1. Jalankan saringan enhanced andalan Anda untuk membuang teks HTTP tiruan
            if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                if (chunkStr.includes("SSH-")) {
                    cleanChunk = chunk.slice(chunkStr.indexOf("SSH-"));
                    handshakeDone = true;
                } else if (chunkStr.includes("\x53\x53\x48")) {
                    cleanChunk = chunk.slice(chunk.indexOf(Buffer.from([0x53, 0x53, 0x48])));
                    handshakeDone = true;
                } else {
                    return; // Ampas HTTP murni hangus
                }
            }

            // 2. KUNCI RAHASIA UPLOAD: Jika handshake kelar atau data biner masuk, kupas masking WebSocket-nya!
            if (handshakeDone || chunk[0] === 0x82 || chunk[0] === 0x81 || chunk[0] === 0x80) {
                cleanChunk = decodeWsFrame(cleanChunk);
                handshakeDone = true; // Kunci status jika data biner mulai mengalir
            }

            if (!backendReady) {
                queueBuffers.push(cleanChunk);
            } else {
                if (targetConn.writable) {
                    if (!targetConn.write(cleanChunk)) {
                        clientConn.pause();
                        targetConn.once('drain', () => clientConn.resume());
                    }
                }
            }
        } else {
            if (!backendReady) {
                queueBuffers.push(chunk);
            } else {
                if (targetConn.writable) targetConn.write(chunk);
            }
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
