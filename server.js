const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;

// Menggunakan ukuran buffer standard MTU tinggi agar I/O seimbang
const BUFFER_SIZE = 512 * 1024; 
const CHUNK_STEP = 16 * 1024; // Potongan internal 16KB untuk kestabilan upload akhir

console.log(`[monster-mux] ALL-IN-ONE HYBRID BOOSTER v7.8 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

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
    clientConn.setKeepAlive(true, 60000); // Naikkan ke 60 detik untuk mencegah timeout akhir

    let targetConn = null;
    let isWsJalur = false;
    let firstPacketRead = false;
    let packetCounter = 0; 
    let queueBuffers = []; 
    let backendReady = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    // LOGIC BARU: Mengirim data secara bertahap (Sub-Chunking) untuk mencegah kemacetan di Dropbear
    const safeWriteToBackend = (dataChunk) => {
        if (!targetConn || !targetConn.writable) return;

        // Jika ukuran paket terlalu besar saat puncak upload, potong kecil-kecil
        if (dataChunk.length > CHUNK_STEP) {
            let offset = 0;
            while (offset < dataChunk.length) {
                const end = Math.min(offset + CHUNK_STEP, dataChunk.length);
                const subChunk = dataChunk.slice(offset, end);
                
                if (!targetConn.write(subChunk)) {
                    clientConn.pause();
                }
                offset += CHUNK_STEP;
            }
        } else {
            if (!targetConn.write(dataChunk)) {
                clientConn.pause();
            }
        }
    };

    clientConn.on('data', (chunk) => {
        packetCounter++;

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
                            safeWriteToBackend(qChunk);
                        }
                        queueBuffers = [];
                    }
                });
            }

            targetConn.on('data', (bChunk) => {
                if (clientConn.writable) {
                    if (!clientConn.write(bChunk)) {
                        targetConn.pause();
                    }
                }
            });

            // Auto-Flush RAM/Buffer saat socket siap menerima data lagi
            targetConn.on('drain', () => { 
                setImmediate(() => clientConn.resume()); 
            });
            clientConn.on('drain', () => { 
                setImmediate(() => targetConn.resume()); 
            });

            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);
            return;
        }

        if (isWsJalur) {
            let cleanChunk = chunk;

            if (packetCounter <= 3) {
                const chunkStr = chunk.toString('utf8');
                if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                    if (chunkStr.includes("SSH-")) {
                        cleanChunk = chunk.slice(chunkStr.indexOf("SSH-"));
                    } else if (chunkStr.includes("\x53\x53\x48")) {
                        cleanChunk = chunk.slice(chunk.indexOf(Buffer.from([0x53, 0x53, 0x48])));
                    } else {
                        return; 
                    }
                }
            }

            if (!backendReady) {
                queueBuffers.push(cleanChunk);
            } else {
                safeWriteToBackend(cleanChunk);
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
