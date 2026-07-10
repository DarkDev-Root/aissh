package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"log"
	"net"
	"os"
	"strings"
	"time"
)

const (
	WS_MAGIC           = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	TLS_HANDSHAKE_BYTE = 0x16
)

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// 🏎️ TUNING HIGH SPEED MAX: Melonggarkan pipa data internal level OS Railway
func turboTune(c net.Conn) {
	if tcp, ok := c.(*net.TCPConn); ok {
		_ = tcp.SetNoDelay(true)
		_ = tcp.SetKeepAlive(true)
		_ = tcp.SetKeepAlivePeriod(15 * time.Second)
		_ = tcp.SetReadBuffer(262144)  // Buffer diperlebar ke 256KB biar download loss!
		_ = tcp.SetWriteBuffer(262144) // Buffer upload diperlebar
	}
}

func main() {
	listenPort := getEnv("PORT", "8080")
	
	// 🎨 BANNER STARTUP LOG RAILWAY WARNA-WARNI DITENGAH PRESISI
	reset := "\033[0m"
	cyan := "\033[36m"
	yellow := "\033[33m"
	magenta := "\033[35m"
	green := "\033[32m"

	rawTitle := "⚡ GOLANG TUNNEL PRO: ENGINE v8.2 ULTRA-RESPONSE ACTIVE ⚡"
	rawOwner := "👑 PRIVATE TUNNEL BY: DEDEFATHU 👑"
	
	paddingTitle := (66 - len(rawTitle)) / 2
	paddingOwner := (66 - len(rawOwner)) / 2
	
	centerTitle := strings.Repeat(" ", paddingTitle) + rawTitle
	centerOwner := strings.Repeat(" ", paddingOwner) + rawOwner

	log.Println(cyan + "==================================================================" + reset)
	log.Println(yellow + centerTitle + reset)
	log.Println(magenta + centerOwner + reset)
	log.Println(green + "==================================================================" + reset)
	log.Printf(green+"[*] Engine listening smoothly on port: %s\n"+reset, listenPort)
	log.Println(cyan + "==================================================================" + reset)
	
	l, err := net.Listen("tcp", ":"+listenPort)
	if err != nil {
		log.Fatalf("Gagal menjalankan listener: %v", err)
	}
	defer l.Close()

	for {
		c, err := l.Accept()
		if err != nil {
			continue
		}
		go handle(c)
	}
}

func handle(c net.Conn) {
	turboTune(c) // Suntikan High Speed
	defer c.Close()
	
	// Mode Sabar 2 detik untuk membaca full tumpukan request payload kotor lu
	c.SetReadDeadline(time.Now().Add(2 * time.Second))
	buf := make([]byte, 65536)
	n, err := c.Read(buf)
	if err != nil || n == 0 {
		return
	}
	c.SetReadDeadline(time.Time{})

	rawPayload := buf[:n]

	// 🛡️ MULTIPLEXING JALUR SSL/TLS MURNI (Stunnel)
	if rawPayload[0] == TLS_HANDSHAKE_BYTE {
		sslTargetHost := getEnv("SSL_TARGET_HOST", "127.0.0.1")
		sslTargetPort := getEnv("SSL_TARGET_PORT", "2443")
		
		targetConn, err := net.Dial("tcp", sslTargetHost+":"+sslTargetPort)
		if err != nil {
			return
		}
		turboTune(targetConn) // Suntikan High Speed ke Stunnel
		defer targetConn.Close()

		_, _ = targetConn.Write(rawPayload)
		
		b1 := make([]byte, 65536)
		b2 := make([]byte, 65536)
		go func() {
			for {
				rn, err := c.Read(b1)
				if err != nil { return }
				_, _ = targetConn.Write(b1[:rn])
			}
		}()
		for {
			rn, err := targetConn.Read(b2)
			if err != nil { return }
			_, _ = c.Write(b2[:rn])
		}
		return
	}

	// 🌐 JALUR WEBSOCKET HANDSHAKE
	req := string(rawPayload)
	wsKey := ""
	
	for _, line := range strings.Split(req, "\r\n") {
		if strings.Contains(strings.ToLower(line), "sec-websocket-key") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				wsKey = strings.TrimSpace(parts[1])
				break
			}
		}
	}
    
	if wsKey == "" {
		wsKey = base64.StdEncoding.EncodeToString([]byte(time.Now().String() + "turbo-salt"))
	}

	h := sha1.New()
	h.Write([]byte(wsKey + WS_MAGIC))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))

	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	_, _ = c.Write([]byte(response))

	// Hubungkan ke Dropbear internal port 22
	wsTargetHost := getEnv("WS_TARGET_HOST", "127.0.0.1")
	wsTargetPort := getEnv("WS_TARGET_PORT", "22")
	ssh, err := net.Dial("tcp", wsTargetHost+":"+wsTargetPort)
	if err != nil {
		return
	}
	turboTune(ssh) // Suntikan High Speed ke Dropbear
	defer ssh.Close()

	go ioCopy(ssh, c, true) // Jalur HP -> SSH (Membawa saringan di putaran pertama)
	ioCopy(c, ssh, false)   // Jalur SSH -> HP (Dengan lem perangko Cloudflare 10 detik)
}

func ioCopy(dst, src net.Conn, filter bool) {
	// 🏎️ MEGA BUFFER: Diperbesar ke 128KB agar tumpukan paket Argo Tunnel muat sekali telan
	b := make([]byte, 131072) 
	first := true

	for {
		if !filter {
			// ✨ SUNTIKAN ANTI-LAG: Pasang deadline membaca yang ketat ke 10 detik pas sepi
			_ = src.SetReadDeadline(time.Now().Add(10 * time.Second))
		}

		n, err := src.Read(b)
		
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() && !filter {
				// Tetap kirim heartbeat 0x89 0x00 agar terowongan Argo tidak menciut
				_, _ = dst.Write([]byte{0x89, 0x00})
				continue
			}
			return
		}
		
		if n == 0 {
			continue
		}

		// 🛡️ PROVEN LOGIC: Saringan "SSH-" di putaran pertama
		if filter && first {
			idx := bytes.Index(b[:n], []byte("SSH-"))
			if idx != -1 { 
				_, _ = dst.Write(b[idx:n]) 
				first = false 
			}
		} else {
			// 🏎️ TURBO WRITE: Langsung tembak tanpa jeda agar ms langsung mengecil rata kanan
			_, err = dst.Write(b[:n])
			if err != nil {
				return
			}
		}
		
		if !filter {
			// Begitu data download mengalir deras, matikan deadline agar speed loss maksimal
			_ = src.SetReadDeadline(time.Time{})
		}
	}
}
