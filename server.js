const net = require('net');
const crypto = require('crypto');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const SSH_TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";
const TLS_HANDSHAKE_BYTE = 0x16;

// Set ukuran buffer optimal (256 KB - 512 KB cukup, 1MB terlalu membebani RAM RAM VPS kecil saat concurent)
const BUFFER_SIZE = 256 * 1024; 

console.log(`[monster-mux] ALL-IN-ONE FIXED MAX-OPTIMIZED v7.2 ACTIVE on Port: ${LISTEN_PORT} 🚀`);

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
    // Matikan algoritma Nagle agar paket langsung dikirim tanpa delay buffering kecil
    clientConn.setNoDelay(true);
    // Berikan keep-alive agar koneksi tidak dianggap mati oleh OS saat beban penuh
    clientConn.setKeepAlive(true, 15000); 

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

    // Fungsi untuk menyambungkan kedua socket secara efisien (mengatasi Backpressure)
    const bridgeConnections = () => {
        backendReady = true;

        // 1. Keluarkan sisa antrean jika ada
        if (queueBuffers.length > 0) {
            for (let qChunk of queueBuffers) {
                if (targetConn.writable) targetConn.write(qChunk);
            }
            queueBuffers = [];
        }

        // 2. Gunakan pipe() bawaan Node.js untuk jalur SSL/data matang (Otomatis mengatur kestabilan upload/download)
        if (!isWsJalur || handshakeDone) {
            clientConn.pipe(targetConn);
            targetConn.pipe(clientConn);
        }
    };

    clientConn.on('data', (chunk) => {
        // Jika sudah handshakeDone dan menggunakan pipe, event 'data' ini idealnya tidak terpanggil lagi
        if (handshakeDone && targetConn && targetConn.writable) {
            if (!targetConn.write(chunk)) {
                clientConn.pause(); // Tahan baca data dari HP jika Dropbear sedang sibuk (Cegah disconnect)
            }
            return;
        }

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
                    targetConn.setKeepAlive(true, 15000);
                    targetConn.write(chunk);
                    bridgeConnections();
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
                    targetConn.setKeepAlive(true, 15000);
                    bridgeConnections();
                });
            }

            targetConn.on('data', (bChunk) => {
                if (!clientConn.write(bChunk)) {
                    targetConn.pause(); // Tahan data dari Dropbear jika HP lambat menerima (Cegah overload)
                }
            });

            // Handle drain event untuk melanjutkan stream yang sempat tertahan (Backpressure Control)
            targetConn.on('drain', () => { clientConn.resume(); });
            clientConn.on('drain', () => { targetConn.resume(); });

            targetConn.on('error', destroyAll);
            targetConn.on('close', destroyAll);
            return;
        }

        // Proses penyaringan awal jabat tangan SSH (Hanya berjalan beberapa mili-detik pertama)
        if (isWsJalur && !handshakeDone) {
            let cleanChunk = chunk;
            const chunkStr = chunk.toString('utf8');

            if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE") || chunkStr.includes("GET ")) {
                if (chunkStr.includes("SSH-")) {
                    cleanChunk = chunk.slice(chunkStr.indexOf("SSH-"));
                    handshakeDone = true;
                } else if (chunkStr.includes("\x53\x53\x48")) {
                    cleanChunk = chunk.slice(chunk.indexOf(Buffer.from([0x53, 0x53, 0x48])));
                    handshakeDone = true; 
                } else {
                    return; 
                }
            } else if (chunkStr.includes("SSH-") || chunk.includes(Buffer.from([0x53, 0x53, 0x48]))) {
                handshakeDone = true;
            }

            if (handshakeDone) {
                // Begitu terdeteksi SSH, langsung buang event 'data' custom dan serahkan ke Native Pipe (Sangat Cepat & Stabil)
                if (targetConn.writable) targetConn.write(cleanChunk);
                clientConn.pipe(targetConn);
                targetConn.pipe(clientConn);
            } else {
                if (!backendReady) queueBuffers.push(cleanChunk);
                else if (targetConn.writable) targetConn.write(cleanChunk);
            }
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
