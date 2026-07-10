const net = require('net');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");
const WS_TARGET_HOST = "127.0.0.1";
const WS_TARGET_PORT = 8880; 

const TLS_HANDSHAKE_BYTE = 0x16;

console.log(`[mux] Mux Monster Premium Active on Port: ${LISTEN_PORT}`);

const server = net.createServer({
    readableHighWaterMark: 1024 * 1024,
    writableHighWaterMark: 1024 * 1024
}, (clientConn) => {
    clientConn.setNoDelay(true);

    let targetConn = null;
    let isWsJalur = false;
    let firstPacket = true;

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

        if (firstByte[0] === TLS_HANDSHAKE_BYTE) {
            targetHost = SSL_TARGET_HOST;
            targetPort = SSL_TARGET_PORT;
            isWsJalur = false;
        } else {
            targetHost = WS_TARGET_HOST;
            targetPort = WS_TARGET_PORT;
            isWsJalur = true; // Kunci pertanda jalur WebSocket kotor
        }

        targetConn = net.connect({ 
            host: targetHost, 
            port: targetPort,
            readableHighWaterMark: 1024 * 1024,
            writableHighWaterMark: 1024 * 1024
        }, () => {
            targetConn.setNoDelay(true);
            
            // Kirim byte pertama yang lolos seleksi awal
            targetConn.write(firstByte);

            // 🚀 JALUR UTAMA HP -> BACKEND (Dengan Detektor Sampah Enhanced)
            clientConn.on('data', (chunk) => {
                if (isWsJalur) {
                    const chunkStr = chunk.toString('utf8');
                    
                    // Jika terdeteksi ampas bawaan payload Enhanced lu bos
                    if (chunkStr.includes("PATCH") || chunkStr.includes("HTTP/") || chunkStr.includes("BMOVE")) {
                        if (chunkStr.includes("SSH-")) {
                            const idx = chunk.indexOf("SSH-");
                            chunk = chunk.slice(idx); // Ambil bagian SSH nya aja
                        } else {
                            // Murni ampas teks kotoran HTTP Custom -> BAKAR HINGGA HANGUS!
                            return; 
                        }
                    }
                }

                if (targetConn.writable) targetConn.write(chunk);
            });

            // 🚀 JALUR DOWNLOAD BACKEND -> HP (Full Loss Speed Monster)
            targetConn.on('data', (chunk) => {
                if (clientConn.writable) clientConn.write(chunk);
            });
        });

        targetConn.on('error', destroyAll);
        targetConn.on('close', destroyAll);
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
