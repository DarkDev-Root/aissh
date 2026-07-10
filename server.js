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
console.log(yellow + "⚡ NODEJS TUNNEL PRO: v2.2 FIX LOW-PING ENGINE ACTIVE ⚡" + reset);
console.log(magenta + "👑 PRIVATE TUNNEL BY: DEDEFATHU 👑" + reset);
console.log(green + "==================================================================" + reset);
console.log(green + `[*] Engine listening smoothly on port: ${listenPort}` + reset);
console.log(cyan + "==================================================================" + reset);

const server = net.createServer((clientConn) => {
    // 🔥 OPTIMASI OPER DATA KILAT
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 10000);

    let isHandshakeDone = false;
    let targetConn = null;
    let sshHandshakeFound = false;

    // Timeout awal 5 detik anti-stuck
    clientConn.setTimeout(5000);

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.on('data', (data) => {
        if (!isHandshakeDone) {
            isHandshakeDone = true;
            clientConn.setTimeout(0); // Reset ke mode loss internetan

            // 1. JALUR SSL
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    pipePure(clientConn, targetConn);
                });
                targetConn.on('error', destroyAll);
                return;
            }

            // 2. JALUR WEBSOCKET (Nego Handshake Kilat)
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
                    
                    // Cek jika paket 1 bawa data banner SSH
                    const idx = data.indexOf("SSH-");
                    if (idx !== -1) {
                        sshHandshakeFound = true;
                        targetConn.write(data.slice(idx));
                    }
                    pipePure(clientConn, targetConn);
                });
                targetConn.on('error', destroyAll);
            });
            return;
        }

        // 🧠 JALUR UTAMA (HP -> SSH): Gunting Sampah Tanpa Mengubah ke String Teks
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    sshHandshakeFound = true;
                    targetConn.write(data.slice(idx)); // Loloskan dari potongan "SSH-"
                }
                return; // Sampah Enhanced sebelum teks "SSH-" dibuang
            }
            // 🔥 RAW WRITE: Langsung dilempar mentah tanpa diconvert ke string biar ping kecil!
            targetConn.write(data);
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
    clientConn.on('timeout', destroyAll);
});

// 🔄 JALUR SEBALIKNYA (SSH -> HP): DOWNLOAD ENGINE LOW-LATENCY
function pipePure(client, target) {
    target.on('data', (data) => {
        if (client.writable) {
            client.write(data); // Langsung teruskan biner mentah ke HP
        }
    });
    target.on('error', () => client.destroy());
    target.on('close', () => client.destroy());
}

server.listen(listenPort, '0.0.0.0');
