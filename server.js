const net = require('net');
const crypto = require('crypto');

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const TLS_HANDSHAKE_BYTE = 0x16;

const listenPort = process.env.PORT || "8080";
const sslTargetHost = process.env.SSL_TARGET_HOST || "127.0.0.1";
const sslTargetPort = process.env.SSL_TARGET_PORT || "2443";
const wsTargetHost = process.env.WS_TARGET_HOST || "127.0.0.1";
const wsTargetPort = process.env.WS_TARGET_PORT || "22";

// 🎨 ANSI COLOR
const reset = "\033[0m";
const cyan = "\033[36m";
const yellow = "\033[33m";
const magenta = "\033[35m";
const green = "\033[32m";

console.log(cyan + "==================================================================" + reset);
console.log(yellow + "⚡ NODEJS TUNNEL PRO: v2.1 FIXED LOW-PING ULTRA ACTIVE ⚡" + reset);
console.log(magenta + "👑 PRIVATE TUNNEL BY: DEDEFATHU 👑" + reset);
console.log(green + "==================================================================" + reset);
console.log(green + `[*] Engine listening smoothly on port: ${listenPort}` + reset);
console.log(cyan + "==================================================================" + reset);

const server = net.createServer((clientConn) => {
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 10000);

    let isHandshakeDone = false;
    let targetConn = null;
    let sshHandshakeFound = false;

    // Timeout handshake awal 5 detik biar responsif
    clientConn.setTimeout(5000);

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    // Kita gunakan penamaan fungsi yang jelas agar bisa dicopot total nanti
    clientConn.on('data', function handleTraffic(data) {
        if (!isHandshakeDone) {
            isHandshakeDone = true;
            clientConn.setTimeout(0); // Matikan timeout, masuk mode stabil

            // 1. JALUR SSL
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                clientConn.removeListener('data', handleTraffic); // Lepas kendali JS instan
                
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    
                    // Direct Pipe C++ Native (Low Ping)
                    clientConn.pipe(targetConn);
                    targetConn.pipe(clientConn);
                });
                targetConn.on('error', destroyAll);
                return;
            }

            // 2. JALUR WEBSOCKET (Bypass Awal)
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
                    
                    // Cek jika kebetulan paket 1 langsung bawa banner SSH
                    const idx = data.indexOf("SSH-");
                    if (idx !== -1) {
                        sshHandshakeFound = true;
                        targetConn.write(data.slice(idx));
                        
                        clientConn.removeListener('data', handleTraffic);
                        clientConn.pipe(targetConn);
                        targetConn.pipe(clientConn);
                    }
                });
                targetConn.on('error', destroyAll);
            });
            return;
        }

        // 🧠 FILTER & MONITORED STREAM BERTAHAP (MENJINAKKAN ENHANCED)
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    // 🎉 BANNER SSH KETEMU! Potong sampahnya, loloskan data aslinya
                    sshHandshakeFound = true;
                    targetConn.write(data.slice(idx));
                    
                    // 🔥 SELESAI TUGAS! Copot total fungsi JS ini, alihkan langsung ke Pipa Native C++
                    clientConn.removeListener('data', handleTraffic);
                    clientConn.pipe(targetConn);
                    targetConn.pipe(clientConn);
                }
                // Jika belum ketemu kata "SSH-", semua sisa cicilan sampah Enhanced dibuang di sini
                return;
            }
            targetConn.write(data);
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
    clientConn.on('timeout', destroyAll);
});

function pipePure(client, target) {
    // Jalur B: SSH Server -> HP (Hanya mendengarkan arah balik download)
    target.on('data', (data) => {
        if (client.writable) client.write(data);
    });
    target.on('error', () => client.destroy());
    target.on('close', () => client.destroy());
}

// Handler cadangan untuk arah balik sebelum pipa utama dikunci (.pipe)
server.on('connection', (socket) => {
    socket.on('ready', () => {
        if (socket.remoteAddress) {
            // Memicu kelancaran stream internal Node.js
        }
    });
});

server.listen(listenPort, '0.0.0.0');
