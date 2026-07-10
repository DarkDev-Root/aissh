const net = require('net');

const LISTEN_PORT = parseInt(process.env.PORT || "8080");
const SSL_TARGET_HOST = process.env.SSL_TARGET_HOST || "127.0.0.1";
const SSL_TARGET_PORT = parseInt(process.env.SSL_TARGET_PORT || "2443");

// Diarahkan ke ws-proxy internal (Port 8880)
const WS_TARGET_HOST = "127.0.0.1";
const WS_TARGET_PORT = 8880; 

const TLS_HANDSHAKE_BYTE = 0x16;

console.log(`[mux] Mux jalan di 0.0.0.0:${LISTEN_PORT} -> SSL:${SSL_TARGET_PORT} | WS:${WS_TARGET_PORT}`);

const server = net.createServer((clientConn) => {
    clientConn.setNoDelay(true);

    let targetConn = null;
    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    // PLEK KETIPLEK LOGIKA reader.read(1) - Intip 1 byte pertama
    clientConn.once('data', (firstByte) => {
        if (!firstByte || firstByte.length === 0) {
            clientConn.destroy();
            return;
        }

        let targetHost, targetPort, label;

        if (firstByte[0] === TLS_HANDSHAKE_BYTE) {
            targetHost = SSL_TARGET_HOST;
            targetPort = SSL_TARGET_PORT;
            label = "SSL/stunnel";
        } else {
            targetHost = WS_TARGET_HOST;
            targetPort = WS_TARGET_PORT;
            label = "WS";
        }

        // Hubungkan langsung ke backend yang sesuai
        targetConn = net.connect({ host: targetHost, port: targetPort }, () => {
            targetConn.setNoDelay(true);

            // Kirim dulu 1 byte yang tadi diintip
            targetConn.write(firstByte);

            // PURE DIRECT BROADCAST (Sama dengan fungsi pipe di Python lu)
            clientConn.on('data', (chunk) => { if (targetConn.writable) targetConn.write(chunk); });
            targetConn.on('data', (chunk) => { if (clientConn.writable) clientConn.write(chunk); });
        });

        targetConn.on('error', destroyAll);
        targetConn.on('close', destroyAll);
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '0.0.0.0');
