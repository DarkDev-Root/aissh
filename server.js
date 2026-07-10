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
console.log(yellow + "⚡ NODEJS TUNNEL PRO: v2.3 ANTI-NYUNGSEB FLOW CONTROL ⚡" + reset);
console.log(magenta + "👑 PRIVATE TUNNEL BY: DEDEFATHU 👑" + reset);
console.log(green + "==================================================================" + reset);
console.log(green + `[*] Engine listening smoothly on port: ${listenPort}` + reset);
console.log(cyan + "==================================================================" + reset);

const server = net.createServer((clientConn) => {
    // 🔥 PERLEBAR UKURAN HIGH WATERMARK KERNEL NODEJS (Biar Pipa Gede tapi Teratur)
    clientConn.setNoDelay(true);
    clientConn.setKeepAlive(true, 10000);

    let isHandshakeDone = false;
    let targetConn = null;
    let sshHandshakeFound = false;

    clientConn.setTimeout(5000);

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.on('data', (data) => {
        if (!isHandshakeDone) {
            isHandshakeDone = true;
            clientConn.setTimeout(0);

            // 1. JALUR SSL
            if (data[0] === TLS_HANDSHAKE_BYTE) {
                targetConn = net.connect({ host: sslTargetHost, port: parseInt(sslTargetPort) }, () => {
                    targetConn.setNoDelay(true);
                    targetConn.write(data);
                    setupSmartPipe(clientConn, targetConn);
                });
                targetConn.on('error', destroyAll);
                return;
            }

            // 2. JALUR WEBSOCKET
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
                        sshHandshakeFound = true;
                        targetConn.write(data.slice(idx));
                    }
                    setupSmartPipe(clientConn, targetConn);
                });
                targetConn.on('error', destroyAll);
            });
            return;
        }

        // 🧠 FILTER SAMPAH ENHANCED DI JALUR A
        if (targetConn && targetConn.writable) {
            if (!sshHandshakeFound) {
                const idx = data.indexOf("SSH-");
                if (idx !== -1) {
                    sshHandshakeFound = true;
                    const cleanData = data.slice(idx);
                    
                    // Kirim dan cek backpressure
                    const ok = targetConn.write(cleanData);
                    if (!ok) clientConn.pause(); 
                }
                return;
            }
            
            // 🔥 SMART WRITE JALUR A (HP -> SERVER): Mencegah RAM Server Meluap
            const ok = targetConn.write(data);
            if (!ok) {
                clientConn.pause(); // Hentikan penerimaan dari HP jika antrean server penuh!
            }
        }
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
    clientConn.on('timeout', destroyAll);
});

// 🔄 KATUP OTOMATIS JALUR DUA ARAH (ANTI BACKPRESSURE)
function setupSmartPipe(client, target) {
    // Kunci Pengaman Jalur A: Buka kembali keran HP jika antrean Server sudah kosong (drain)
    target.on('drain', () => {
        client.resume();
    });

    // Jalur B (SERVER -> HP): Proses Download Brutal
    target.on('data', (data) => {
        if (client.writable) {
            const ok = client.write(data);
            if (!ok) {
                target.pause(); // Hentikan sedotan dari server SSH jika memori HP/jaringan padat!
            }
        }
    });

    // Kunci Pengaman Jalur B: Buka kembali sedotan server jika HP siap menerima
    client.on('drain', () => {
        target.resume();
    });

    target.on('error', () => client.destroy());
    target.on('close', () => client.destroy());
}

server.listen(listenPort, '0.0.0.0');
