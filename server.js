const server = net.createServer({
    readableHighWaterMark: BUFFER_SIZE,
    writableHighWaterMark: BUFFER_SIZE
}, (clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 30000);

    let targetConn = null;
    let isWsJalur = false;
    let firstPacketRead = false;
    
    // KUNCI UTAMA: Saklar pembersih otomatis
    let isHandshakeDone = false; 

    let queueBuffers = []; 
    let backendReady = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.on('data', (chunk) => {
        if (!firstPacketRead) {
            firstPacketRead = true;
            let connectOptions = {};

            if (chunk[0] === TLS_HANDSHAKE_BYTE) {
                isWsJalur = false;
                connectOptions = { host: SSL_TARGET_HOST, port: SSL_TARGET_PORT };
            } else {
                isWsJalur = true;
                connectOptions = { host: "127.0.0.1", port: SSH_TARGET_PORT };

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
            }

            targetConn = net.connect({
                ...connectOptions,
                readableHighWaterMark: BUFFER_SIZE,
                writableHighWaterMark: BUFFER_SIZE
            });

            targetConn.setNoDelay(true);

            targetConn.on('data', (bChunk) => {
                if (clientConn.writable) {
                    if (!clientConn.write(bChunk)) {
                        targetConn.pause();
                    }
                }
            });

            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);

            targetConn.on('connect', () => {
                backendReady = true;
                if (!isWsJalur) {
                    targetConn.write(chunk); 
                }
                if (queueBuffers.length > 0) {
                    for (let qChunk of queueBuffers) {
                        if (targetConn.writable) targetConn.write(qChunk);
                    }
                    queueBuffers = [];
                }
            });

            // Pasang listener drain global untuk stabilitas buffer
            clientConn.on('drain', () => {
                if (targetConn && !targetConn.destroyed) targetConn.resume();
            });

            return;
        }

        // 🚀 PROSES PEMBERSIH UTAMA (ANTI ILLEGAL PACKET SIZE & ANTI RENEK UPLOAD)
        if (isWsJalur) {
            let cleanChunk = chunk;

            // Jika jabat tangan belum beres, bersihkan ampas HTTP Custom seketat mungkin
            if (!isHandshakeDone) { 
                const chunkStr = chunk.toString('utf8');
                
                // Deteksi apakah paket mengandung identitas SSH asli
                if (chunkStr.includes("SSH-") || chunkStr.includes("\x53\x53\x48")) {
                    const idx = chunkStr.includes("SSH-") ? 
                                chunkStr.indexOf("SSH-") : 
                                chunk.indexOf(Buffer.from([0x53, 0x53, 0x48]));
                    
                    cleanChunk = chunk.slice(idx);
                    isHandshakeDone = true; // Kunci saklar! Jabat tangan beres, pembersih dimatikan selamanya.
                } else if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                    return; // Bakar ampas HTTP murni tanpa sisa agar tidak masuk ke OpenSSH
                }
            }

            if (!backendReady) {
                queueBuffers.push(cleanChunk);
            } else {
                if (targetConn && targetConn.writable) {
                    if (!targetConn.write(cleanChunk)) {
                        clientConn.pause();
                    }
                }
            }
        } else {
            if (!backendReady) {
                queueBuffers.push(chunk);
            } else {
                if (targetConn && targetConn.writable) {
                    if (!targetConn.write(chunk)) {
                        clientConn.pause();
                    }
                }
            }
        }
    });

    // Listener drain untuk menahan badai data upload speedtest
    if (targetConn) {
        targetConn.on('drain', () => {
            if (clientConn && !clientConn.destroyed) clientConn.resume();
        });
    }
});
