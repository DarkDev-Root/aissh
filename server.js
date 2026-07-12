const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;

// Buffer besar agar speedtest upload mulus tanpa bottleneck
const BUFFER_SIZE = 1024 * 1024; 

console.log(`[monster-mux] ALL-IN-ONE FIXED ELITE v7.4 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

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
    clientConn.setKeepAlive(true, 30000); // Naikkan ke 30 detik untuk stabilitas

    let targetConn = null;
    let isWsJalur = false;
    let firstPacketRead = false;
    
    // Tanda penunjuk status jabat tangan SSH
    let sshHandshakeDone = false; 

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
                // Saat dropbear mengirim balik banner SSH-2.0..., tandai jabat tangan dimulai
                if (bChunk.toString('utf8').includes("SSH-")) {
                    sshHandshakeDone = true; 
                }
                if (clientConn.writable) clientConn.write(bChunk);
            });
            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);
            return;
        }

        // 🚀 PROSES SARINGAN DATA WEBSOCKET
        if (isWsJalur) {
            let cleanChunk = chunk;

            // Saringan andalan Anda HANYA aktif jika jabat tangan SSH belum selesai
            if (!sshHandshakeDone) {
                const chunkStr = chunk.toString('utf8');

                if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                    if (chunkStr.includes("SSH-")) {
                        const idx = chunkStr.indexOf("SSH-");
                        cleanChunk = chunk.slice(idx);
                        sshHandshakeDone = true; // Kunci status, matikan saringan untuk paket berikutnya
                    } else if (chunkStr.includes("\x53\x53\x48")) {
                        const idx = chunk.indexOf(Buffer.from([0x53, 0x53, 0x48]));
                        cleanChunk = chunk.slice(idx);
                        sshHandshakeDone = true; // Kunci status
                    } else {
                        return; // Ampas HTTP murni dibakar
                    }
                }
            }

            // Kirim langsung data tanpa takut tersaring saat speedtest upload
            if (!backendReady) {
                queueBuffers.push(cleanChunk);
            } else {
                if (targetConn.writable) {
                    // Cek backpressure sederhana tanpa ngerusak pipe
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
