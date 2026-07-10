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
console.log(yellow + "⚡ NODEJS TUNNEL PRO: v1.0 JS FAST-CONNECT ACTIVE ⚡" + reset);
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

    // Timeout pendek 5 detik awal untuk anti-stuck Enhanced
    clientConn.setTimeout(5000);

    clientConn.on('data', (data) => {
        if (!isHandshakeDone) {
            isHandshakeDone = true;
            clientConn.setTimeout(0); // Kembalikan timeout ke normal

            // Jalur SSL
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    pipePure(clientConn, targetConn, false);
                });
                targetConn.on('error', () => clientConn.destroy());
                return;
            }

            // Jalur WebSocket (Proses String Kilat Tanpa Bengong)
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
                    
                    const idx = data.indexOf("SSH-");
                    if (idx !== -1) {
                        targetConn.write(data.slice(idx));
                        sshHandshakeFound = true;
                    }
                    
                    pipePure(clientConn, targetConn, true);
                });
                targetConn.on('error', () => clientConn.destroy());
            });
            return;
        }

        // 🧠 FILTER SAMPAH ENHANCED DI JALUR A
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    sshHandshakeFound = true;
                    targetConn.write(data.slice(idx));
                }
                return; // Sampah HTTP sebelum kata SSH- dibuang instan
            }
            targetConn.write(data);
        }
    });

    clientConn.on('error', () => { if (targetConn) targetConn.destroy(); });
    clientConn.on('close', () => { if (targetConn) targetConn.destroy(); });
    clientConn.on('timeout', () => { clientConn.destroy(); });
});

function pipePure(client, target, isWS) {
    // Jalur B: SSH Server -> HP
    target.on('data', (data) => {
        if (client.writable) {
            client.write(data);
        }
    });

    target.on('error', () => client.destroy());
    target.on('close', () => client.destroy());
}

server.listen(listenPort, '0.0.0.0');
