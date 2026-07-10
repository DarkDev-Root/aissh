const net = require('net');
const crypto = require('crypto');

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const LISTEN_PORT = 8880; 
const TARGET_HOST = process.env.WS_TARGET_HOST || "127.0.0.1";
const TARGET_PORT = parseInt(process.env.WS_TARGET_PORT || "22");
const DEFAULT_RESPONSE = "HTTP/1.1 101 Switching Protocols\r\n\r\n";

console.log(`[ws-proxy] WS proxy jalan di 127.0.0.1:${LISTEN_PORT} -> Dropbear Premium Active`);

function parseHeaders(rawBuffer) {
    const headers = {};
    try {
        const lines = rawBuffer.toString('utf8').split("\r\n");
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(":")) {
                const parts = line.split(":");
                headers[parts[0].trim().toLowerCase()] = parts.slice(1).join(":").trim();
            }
        }
    } catch (e) {}
    return headers;
}

const server = net.createServer((clientConn) => {
    clientConn.setNoDelay(true);
    let targetConn = null;

    const destroyAll = () => {
        clientConn.destroy();
        if (targetConn) targetConn.destroy();
    };

    clientConn.once('data', (rawHeaders) => {
        if (!rawHeaders) {
            clientConn.destroy();
            return;
        }

        const headers = parseHeaders(rawHeaders);
        const rawTextLower = rawHeaders.toString('utf8').toLowerCase();
        const isWsUpgrade = rawTextLower.includes("upgrade: websocket") || headers["upgrade"] === "websocket";

        if (isWsUpgrade) {
            let wsKey = headers["sec-websocket-key"];
            if (!wsKey && rawTextLower.includes("sec-websocket-key:")) {
                try {
                    const lines = rawHeaders.toString('utf8').split("\r\n");
                    for (let line of lines) {
                        if (line.toLowerCase().includes("sec-websocket-key")) {
                            wsKey = line.split(":")[1].trim();
                            break;
                        }
                    }
                } catch (e) {}
            }

            if (!wsKey) wsKey = crypto.randomBytes(16).toString('base64');

            const shasum = crypto.createHash('sha1');
            shasum.update(wsKey + WS_MAGIC);
            const acceptKey = shasum.digest('base64');

            let response = "HTTP/1.1 101 Switching Protocols\r\n" +
                           "Upgrade: websocket\r\n" +
                           "Connection: Upgrade\r\n" +
                           `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`;
            
            clientConn.write(Buffer.from(response));
        } else {
            clientConn.write(Buffer.from(DEFAULT_RESPONSE));
        }

        // Hubungkan ke Dropbear Backend
        targetConn = net.connect({ host: TARGET_HOST, port: TARGET_PORT }, () => {
            targetConn.setNoDelay(true);

            let firstPacket = true;

            // 🚀 FIX JALUR UPLOAD (HP -> DROPBEAR): Direct bypass tanpa pause/resume
            clientConn.on('data', (data) => {
                if (firstPacket) {
                    firstPacket = false;
                    if (data.includes("PATCH") || data.includes("HTTP/")) {
                        if (data.includes("SSH-")) {
                            const idx = data.indexOf("SSH-");
                            data = data.slice(idx);
                        } else {
                            return; 
                        }
                    }
                }
                
                if (targetConn.writable) {
                    targetConn.write(data);
                }
            });

            // 🚀 JALUR DOWNLOAD (DROPBEAR -> HP): Tetap dijaga flow control biar ga jebol RAM
            targetConn.on('data', (data) => {
                if (clientConn.writable) {
                    const flush = clientConn.write(data);
                    if (!flush) {
                        targetConn.pause();
                    }
                }
            });

            clientConn.on('drain', () => {
                if (targetConn) targetConn.resume();
            });
        });

        targetConn.on('error', destroyAll);
        targetConn.on('close', destroyAll);
    });

    clientConn.on('error', destroyAll);
    clientConn.on('close', destroyAll);
});

server.listen(LISTEN_PORT, '127.0.0.1');
