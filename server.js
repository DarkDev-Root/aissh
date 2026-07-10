const net = require('net');
const crypto = require('crypto');

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const TLS_HANDSHAKE_BYTE = 0x16;

const listenPort = process.env.PORT || "8080";
const sslTargetHost = process.env.SSL_TARGET_HOST || "127.0.0.1";
const sslTargetPort = process.env.SSL_TARGET_PORT || "2443";
const wsTargetHost = process.env.WS_TARGET_HOST || "127.0.0.1";
const wsTargetPort = process.env.WS_TARGET_PORT || "22";

console.log("==================================================================");
console.log("⚡ NODEJS TUNNEL PRO: v3.3 PURE RAW STREAM (LOW-PING LOCK) ⚡");
console.log("👑 PRIVATE TUNNEL BY: DEDEFATHU 👑");
console.log("==================================================================");

const server = net.createServer((clientConn) => {
    // Paksa socket langsung nembak tanpa jeda buffering Nagle's Algorithm
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 5000);

    let isHandshakeDone = false;
    let targetConn = null;
    let sshHandshakeFound = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.on('data', function handleTraffic(data) {
        if (!isHandshakeDone) {
            isHandshakeDone = true;

            // 1. JALUR SSL MURNI
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    
                    // Oper manual direct tanpa .pipe()
                    targetConn.on('data', (tData) => { if (clientConn.writable) clientConn.write(tData); });
                    clientConn.on('data', (cData) => { if (targetConn.writable) targetConn.write(cData); });
                });
                clientConn.removeListener('data', handleTraffic);
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
                return;
            }

            // 2. JALUR WEBSOCKET (ENHANCED)
            const reqStr = data.toString('utf8');
            let wsKey = "";
            const lines = reqStr.split("\r\n");
            for (let line of lines) {
                if (line.toLowerCase().includes("sec-websocket-key")) {
                    const parts = line.split(":");
                    if (parts.length > 1) {
                        wsKey = parts[1].trim();
                        break;
                    }
                }
            }

            if (!wsKey) wsKey = crypto.randomBytes(16).toString('base64');

            const shasum = crypto.createHash('sha1');
            shasum.update(wsKey + WS_MAGIC);
            const acceptKey = shasum.digest('base64');

            const response = "HTTP/1.1 101 Switching Protocols\r\n" +
                             "Upgrade: websocket\r\n" +
                             "Connection: Upgrade\r\n" +
                             "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";

            clientConn.write(response, () => {
                targetConn = net.connect({ host: wsTargetHost, port: parseInt(wsTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    
                    // JALUR BALIK (DOWNLOAD BINER): Direct Manual Oper (Bikin Ping Rata Lantai)
                    targetConn.on('data', (tData) => {
                        if (clientConn.writable) clientConn.write(tData);
                    });

                    const idx = data.indexOf("SSH-");
                    if (idx !== -1) {
                        sshHandshakeFound = true;
                        targetConn.write(data.slice(idx));
                        
                        // Handshake kelar, copot total saringan teks awal
                        clientConn.removeListener('data', handleTraffic);
                        
                        // JALUR UTAMA (UPLOAD BINER): Direct Manual Oper
                        clientConn.on('data', (cData) => {
                            if (targetConn.writable) targetConn.write(cData);
                        });
                    }
                });
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
            });
            return;
        }

        // 🧠 PENYARING SAMPAH ENHANCED (Berjalan sekejap di paket ke-2 atau ke-3)
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    sshHandshakeFound = true;
                    targetConn.write(data.slice(idx));
                    
                    // 🎉 BANNER SSH KETEMU! Detik ini juga hancurkan filter awal
                    clientConn.removeListener('data', handleTraffic);
                    
                    // Kunci jalur biner mentah langsung lempar tanpa birokrasi .pipe()
                    clientConn.on('data', (cData) => {
                        if (targetConn.writable) targetConn.write(cData);
                    });
                }
                return; // Hanguskan sisa kotoran payload enhanced sebelum kata SSH-
            }
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(listenPort, '0.0.0.0');
