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
console.log("⚡ NODEJS TUNNEL PRO: v3.1 BRUTAL ENHANCED CLEANER ACTIVE ⚡");
console.log("👑 PRIVATE TUNNEL BY: DEDEFATHU 👑");
console.log("==================================================================");
console.log(`[*] Engine listening smoothly on port: ${listenPort}`);
console.log("==================================================================");

const server = net.createServer((clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 10000);

    let isHandshakeDone = false;
    let targetConn = null;
    let sshHandshakeFound = false;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    // Jalur Utama Data Arah HP -> Server
    clientConn.on('data', function handleTraffic(data) {
        if (!isHandshakeDone) {
            isHandshakeDone = true;

            // 1. JALUR SSL / TLS
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                clientConn.removeListener('data', handleTraffic);
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    clientConn.pipe(targetConn);
                    targetConn.pipe(clientConn);
                });
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
                return;
            }

            // 2. JALUR WEBSOCKET (Nego Handshake Upgrade)
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

            if (!wsKey) {
                wsKey = crypto.randomBytes(16).toString('base64');
            }

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
                    
                    // Arah balik (Download dari server ke HP) langsung di-pipe loss total dari awal!
                    targetConn.pipe(clientConn);

                    // Cek apakah di paket pertama kebetulan langsung nempel banner SSH
                    const idx = data.indexOf("SSH-");
                    if (idx !== -1) {
                        sshHandshakeFound = true;
                        targetConn.write(data.slice(idx));
                        
                        // Lepas saringan JS, oper ke pipa C++ Native
                        clientConn.removeListener('data', handleTraffic);
                        clientConn.pipe(targetConn);
                    }
                });
                targetConn.on('error', destroyAll);
                targetConn.on('close', destroyAll);
            });
            return;
        }

        // 🧠 LOGIKA ULTRA CLEANER: Bantai Sampah Enhanced Berapa Pun Jumlah Paketnya
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    // 🎉 KETEMU BOS! Amputasi semua sampah di depannya, ambil dari kata "SSH-" ke belakang
                    sshHandshakeFound = true;
                    targetConn.write(data.slice(idx));
                    
                    // 🔥 SELESAI TUGAS! Detik ini juga hancurkan filter JS-nya
                    // Aliran Speedtest lu langsung loss 100% masuk pipa Native C++ (.pipe)
                    clientConn.removeListener('data', handleTraffic);
                    clientConn.pipe(targetConn);
                }
                // 🛑 SELAMA KATA "SSH-" BELUM KETEMU, SEMUA PAKET DATA DARI HP ADALAH SAMPAH DAN DIBUANG TOTAL DI SINI!
                return; 
            }
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(listenPort, '0.0.0.0');
