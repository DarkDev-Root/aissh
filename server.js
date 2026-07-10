const net = require('net');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const WS_TARGET_HOST = "127.0.0.1";
const WS_TARGET_PORT = 8880; 

const TLS_HANDSHAKE_BYTE = 0x16;

console.log(`[mux] Mux Monster Enhanced Fix Active on Port: ${LISTEN_PORT}`);

const server = net.createServer({
    readableHighWaterMark: 1024 * 1024,
    writableHighWaterMark: 1024 * 1024
}, (clientConn) => {
    clientConn.setNoDelay(true);
    let targetConn = null;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.once('data', (firstByte) => {
        if (!firstByte || firstByte.length === 0) {
            clientConn.destroy();
            return;
        }

        let targetHost, targetPort;
        let isWsJalur = false;

        if (firstByte[0] === TLS_HANDSHAKE_BYTE) {
            targetHost = SSL_TARGET_HOST;
            targetPort = SSL_TARGET_PORT;
            isWsJalur = false;
        } else {
            targetHost = WS_TARGET_HOST;
            targetPort = WS_TARGET_PORT;
            isWsJalur = true;
        }

        targetConn = net.connect({ 
            host: targetHost, 
            port: targetPort,
            readableHighWaterMark: 1024 * 1024,
            writableHighWaterMark: 1024 * 1024
        }, () => {
            targetConn.setNoDelay(true);
            
            // Oper paket pertama
            targetConn.write(firstByte);

            if (isWsJalur) {
                // 🚀 JALUR UPLOAD: Saringan Abadi Khusus Sampah Enhanced Susulan
                clientConn.on('data', (chunk) => {
                    let cleanChunk = chunk;
                    const chunkStr = chunk.toString('utf8');

                    // Cegat jika ada sampah Enhanced bawaan HTTP Custom yang nyempil kapan pun
                    if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE")) {
                        if (chunkStr.includes("SSH-")) {
                            // Jika ada data SSH nempel setelah sampah, potong dan ambil SSH-nya aja
                            const idx = chunkStr.indexOf("SSH-");
                            cleanChunk = chunk.slice(idx);
                        } else if (chunkStr.includes("\x53\x53\x48")) { // Cek binary header SSH raw
                            const idx = chunk.indexOf(Buffer.from([0x53, 0x53, 0x48]));
                            cleanChunk = chunk.slice(idx);
                        } else {
                            // Murni teks sampah susulan -> Bakar habis jangan oper ke Dropbear!
                            return; 
                        }
                    }

                    if (targetConn.writable) targetConn.write(cleanChunk);
                });
            } else {
                // Jalur SSL murni langsung pake pipa secepat kilat
                clientConn.pipe(targetConn);
            }

            // 🚀 JALUR DOWNLOAD: Langsung ikat pipa murni tanpa batas speed
            targetConn.pipe(clientConn);
        });

        targetConn.on('error', destroyAll);
        targetConn.on('close', destroyAll);
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
