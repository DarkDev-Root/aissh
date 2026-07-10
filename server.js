const net = require('net');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const WS_TARGET_HOST = "127.0.0.1";
const WS_TARGET_PORT = 8880; 

const TLS_HANDSHAKE_BYTE = 0x16;

console.log(`[mux] Mux Monster Pipe Active on Port: ${LISTEN_PORT}`);

const server = net.createServer({
    readableHighWaterMark: 1024 * 1024,
    writableHighWaterMark: 1024 * 1024
}, (clientConn) => {
    clientConn.setNoDelay(true);

    let targetConn = null;
    let isWsJalur = false;
    let filterActive = true;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.once('data', (firstByte) => {
        if (!firstByte || firstByte.length === 0) {
            clientConn.destroy();
            return;
        }

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
            targetConn.write(firstByte);

            if (isWsJalur) {
                // 🚀 PROSES PENYARINGAN PAKET AWAL DARI HP
                const onDataFilter = (chunk) => {
                    if (filterActive) {
                        const chunkStr = chunk.toString('utf8');
                        if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE")) {
                            if (chunkStr.includes("SSH-")) {
                                const idx = chunk.indexOf("SSH-");
                                chunk = chunk.slice(idx);
                                filterActive = false;
                                clientConn.removeListener('data', onDataFilter);
                                // 🔥 KETIKU SUDAH STERIL, LANGSUNG GABUNGKAN PIPA UTAMA (ANTI-BEBAN)
                                clientConn.pipe(targetConn);
                                targetConn.write(chunk);
                            } else {
                                return; // Bakar sampah
                            }
                        } else if (chunkStr.includes("SSH-")) {
                            filterActive = false;
                            clientConn.removeListener('data', onDataFilter);
                            clientConn.pipe(targetConn);
                            targetConn.write(chunk);
                        }
                    }
                };
                clientConn.on('data', onDataFilter);
            } else {
                // Jalur SSL langsung pakai pipa murni dari awal
                clientConn.pipe(targetConn);
            }

            // 🚀 JALUR DOWNLOAD (BACKEND -> HP): Langsung bypass pakai pipa murni
            targetConn.pipe(clientConn);
        });

        targetConn.on('error', destroyAll);
        targetConn.on('close', destroyAll);
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
