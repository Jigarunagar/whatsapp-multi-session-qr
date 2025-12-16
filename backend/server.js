const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const dotenv = require("dotenv")
dotenv.config()

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
}

const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

app.use(cors({
    origin: "*",
    methods: "GET,POST,DELETE,PUT",
    allowedHeaders: "Content-Type, Authorization, x-user-id"
}));
app.use(express.json());
const PORT = process.env.PORT || 3000;

let userSessions = new Map();

class SafeLocalAuth extends LocalAuth {
    async logout() {
        try {
            console.log('SafeLocalAuth: Starting logout cleanup...');
            
            if (this.client && this.client.pupBrowser) {
                try {
                    console.log('SafeLocalAuth: Closing browser...');
                    await this.client.pupBrowser.close();
                } catch (e) {
                    console.log('SafeLocalAuth: Error closing browser:', e.message);
                }
            }
            try {
                if (this.options && this.options.dataPath && this.options.clientId) {
                    const authDir = path.join(this.options.dataPath, `session-${this.options.clientId}`);
                    console.log('SafeLocalAuth: Checking auth directory:', authDir);
                    
                    if (fs.existsSync(authDir)) {
                        console.log('SafeLocalAuth: Removing auth directory:', authDir);
                        const files = fs.readdirSync(authDir);
                        for (const file of files) {
                            try {
                                fs.unlinkSync(path.join(authDir, file));
                            } catch (e) {
                                console.log('SafeLocalAuth: Error deleting file:', file, e.message);
                            }
                        }
                        try {
                            fs.rmdirSync(authDir);
                        } catch (e) {
                            console.log('SafeLocalAuth: Error removing directory:', e.message);
                        }
                    } else {
                        console.log('SafeLocalAuth: Auth directory does not exist:', authDir);
                    }
                } else {
                    console.log('SafeLocalAuth: No valid options for cleanup');
                }
            } catch (error) {
                console.log('SafeLocalAuth: Error during cleanup:', error.message);
             
            }
        } catch (error) {
            console.log('SafeLocalAuth: General logout error:', error.message);
            
        }
    }
}

class UserSession {
    constructor(userId, userName = "New User") {
        this.userId = userId;
        this.userName = userName;
        this.client = null;
        this.isReady = false;
        this.qrCodeString = "";
        this.clients = [];
        this.contacts = [];
        this.chats = [];
        this.createDate = new Date();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isInitializing = false;
        this.cleanupTimeout = null;
        this.reconnectTimeout = null;
        this.authStrategy = null;
    }

    sendStatus(msg) {
        this.clients.forEach((res) => {
            try {
                res.write(`data: ${msg}\n\n`);
            } catch (err) {
                this.clients = this.clients.filter((c) => c !== res);
            }
        });
    }

    initializeClient() {
        if (this.isInitializing) {
            console.log(`Already initializing client for user: ${this.userId}`);
            return;
        }

        console.log(`Creating WhatsApp Client for user: ${this.userId}...`);
        this.isInitializing = true;

        this.clearTimeouts();

        this.cleanupClient();

        try {
            this.authStrategy = new SafeLocalAuth({
                clientId: this.userId,
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            });

            this.client = new Client({
                authStrategy: this.authStrategy,
                puppeteer: {
                    headless: true,
                    args: [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-software-rasterizer",
                        "--disable-extensions",
                        "--single-process",
                        "--no-zygote",
                        "--disable-accelerated-2d-canvas",
                        "--disable-web-security"
                    ],
                    timeout: 60000
                },
                takeoverOnConflict: false,
                restartOnAuthFail: false,
                qrMaxRetries: 3
            });

            this.client.authStrategy = this.authStrategy;

            this.client.on("qr", async (qr) => {
                console.log(`QR generated for user: ${this.userId}`);
                this.isReady = false;
                this.isInitializing = false;
                this.qrCodeString = await qrcode.toDataURL(qr);

                this.sendStatus(JSON.stringify({
                    type: "qr-update",
                    qr: this.qrCodeString,
                    userId: this.userId,
                    message: "Scan QR code to connect"
                }));

                console.log(`New QR Generated for user: ${this.userId}!`);
            });

            this.client.on("ready", () => {
                console.log(`Client ready for user: ${this.userId}`);
                this.isReady = true;
                this.isInitializing = false;
                this.qrCodeString = "";
                this.reconnectAttempts = 0;

                const myNumber = this.client.info.wid.user || "Unknown";
                const myName = this.client.info.pushname || this.userName;
                this.userName = myName;

                this.sendStatus(JSON.stringify({
                    type: "user-info",
                    name: myName,
                    number: myNumber
                }));
                this.sendStatus(JSON.stringify({
                    type: "connected",
                    message: "WhatsApp connected successfully"
                }));
                console.log(`Connected as: ${myName} (${myNumber}) for user: ${this.userId}`);
            });

            this.client.on("authenticated", () => {
                console.log(`User ${this.userId} authenticated!`);
                this.reconnectAttempts = 0;
                this.sendStatus(JSON.stringify({
                    type: "authenticated",
                    message: "Authentication successful"
                }));
            });

            this.client.on("auth_failure", (msg) => {
                console.log(`Authentication failed for user ${this.userId}:`, msg);
                this.isInitializing = false;
                this.isReady = false;
                this.reconnectAttempts++;
                
                this.sendStatus(JSON.stringify({
                    type: "auth-failure",
                    message: "Authentication failed",
                    reason: msg
                }));
                
                this.scheduleReconnect();
            });

            this.client.on("disconnected", async (reason) => {
                console.log(`Phone disconnected for user ${this.userId}:`, reason);
                this.isReady = false;
                this.isInitializing = false;
                this.qrCodeString = "";

                this.sendStatus(JSON.stringify({
                    type: "phone-logged-out",
                    reason: reason,
                    userId: this.userId,
                    timestamp: new Date().toISOString(),
                    message: "Phone was logged out. New QR code will be generated."
                }));

                await this.cleanupSession();

                this.reconnectAttempts = 0;

                console.log(`Reinitializing client for ${this.userId} after disconnect...`);
                setTimeout(() => {
                    this.initializeClient();
                }, 2000);
            });

            this.client.on("message", (msg) => {
                this.sendStatus(JSON.stringify({
                    type: "incoming",
                    from: msg.from,
                    body: msg.body,
                    timestamp: new Date().toISOString()
                }));
            });

            this.client.on("loading_screen", (percent, message) => {
                console.log(`Loading screen for ${this.userId}: ${percent}% - ${message}`);
                this.sendStatus(JSON.stringify({
                    type: "loading",
                    percent: percent,
                    message: message
                }));
            });

            this.client.on("error", (error) => {
                console.error(`Client error for ${this.userId}:`, error.message);
                this.sendStatus(JSON.stringify({
                    type: "error",
                    message: error.message
                }));
            });

            this.client.initialize().catch(err => {
                console.error(`Failed to initialize client for ${this.userId}:`, err.message);
                this.isInitializing = false;
                this.isReady = false;
                this.reconnectAttempts++;
                
                this.sendStatus(JSON.stringify({
                    type: "init-error",
                    message: "Failed to initialize client"
                }));
                
                this.scheduleReconnect();
            });

        } catch (error) {
            console.error(`Error creating client for ${this.userId}:`, error.message);
            this.isInitializing = false;
            this.isReady = false;
            this.reconnectAttempts++;
            this.scheduleReconnect();
        }
    }

    async cleanupSession() {
        console.log(`Cleaning up session for user: ${this.userId}`);
        
        try {
            if (this.authStrategy) {
                try {
                    await this.authStrategy.logout();
                } catch (e) {
                    console.log(`Error during auth logout for ${this.userId}:`, e.message);
                }
            }
            this.cleanupClient();
            
            this.authStrategy = null;
            
        } catch (error) {
            console.log(`Error in cleanupSession for ${this.userId}:`, error.message);
        }
    }

    cleanupClient() {
        if (this.client) {
            try {
                console.log(`Cleaning up client for user: ${this.userId}`);
                const clientToCleanup = this.client;

                clientToCleanup.removeAllListeners();

                const cleanupPromise = new Promise((resolve) => {
                    setTimeout(async () => {
                        try {
                            if (clientToCleanup.pupBrowser) {
                                try {
                                    const pages = await clientToCleanup.pupBrowser.pages();
                                    for (const page of pages) {
                                        try {
                                            await page.close();
                                        } catch (e) {
                                            // Ignore page close errors
                                        }
                                    }
                                    await clientToCleanup.pupBrowser.close();
                                    console.log(`Browser closed for ${this.userId}`);
                                } catch (e) {
                                    console.log(`Error closing browser for ${this.userId}:`, e.message);
                                }
                            }

                            try {
                                await clientToCleanup.destroy();
                                console.log(`Client destroyed for ${this.userId}`);
                            } catch (e) {
                                console.log(`Error destroying client for ${this.userId}:`, e.message);
                            }
                        } catch (error) {
                            console.log(`Error in cleanup promise for ${this.userId}:`, error.message);
                        } finally {
                            resolve();
                        }
                    }, 1000);
                });

                this.client = null;

            } catch (err) {
                console.log(`Error in cleanupClient for ${this.userId}:`, err.message);
                this.client = null;
            }
        }
    }

    clearTimeouts() {
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`Max reconnect attempts reached for user: ${this.userId}`);
            this.sendStatus(JSON.stringify({
                type: "max-reconnect",
                message: "Maximum reconnection attempts reached. Please create a new session."
            }));
            return;
        }

        const delay = Math.min(10000, this.reconnectAttempts * 3000);
        console.log(`Scheduling reconnect for user: ${this.userId} in ${delay}ms (Attempt: ${this.reconnectAttempts})`);

        this.clearTimeouts();

        this.reconnectTimeout = setTimeout(() => {
            this.initializeClient();
        }, delay);
    }

    async sendMessage(number, message, filePath = null, quotedId = null) {
        if (!this.isReady) {
            throw new Error("WhatsApp not connected!");
        }

        const finalNumber = number.includes("@c.us") ? number : number + "@c.us";

        try {
            let msgObj;

            if (filePath) {
                const media = MessageMedia.fromFilePath(filePath);
                msgObj = await this.client.sendMessage(finalNumber, media, { caption: message });
            } else {
                if (quotedId) {
                    const quotedMsg = await this.client.getMessageById(quotedId);
                    msgObj = await quotedMsg.reply(message);
                } else {
                    msgObj = await this.client.sendMessage(finalNumber, message);
                }
            }

            this.sendStatus(JSON.stringify({
                type: "outgoing",
                to: finalNumber,
                body: message,
                media: !!filePath,
                id: msgObj.id._serialized,
                timestamp: new Date().toISOString()
            }));

            return { success: true, messageId: msgObj.id._serialized };
        } catch (err) {
            throw new Error("Failed to send message: " + err.message);
        }
    }

    async getContacts() {
        if (!this.isReady) {
            throw new Error("WhatsApp not connected!");
        }

        try {
            const chats = await this.client.getChats();
            const contacts = chats
                .filter(chat => chat.isGroup === false)
                .map(c => ({
                    name: c.name || c.contact?.pushname || c.contact?.number || "Unknown",
                    number: c.id.user,
                    id: c.id._serialized
                }));

            this.contacts = contacts;
            return contacts;
        } catch (err) {
            throw new Error("Failed to get contacts: " + err.message);
        }
    }

    destroy() {
        console.log(`Destroying session for user: ${this.userId}`);

        this.clearTimeouts();

        this.cleanupSession();

        this.clients.forEach(res => {
            try {
                res.end();
            } catch (err) {
                // Ignore errors
            }
        });
        this.clients = [];
    }
}

function generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateUserSession(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    const session = userSessions.get(userId);
    if (!session) {
        return res.status(404).json({ error: "User session not found" });
    }

    req.userSession = session;
    next();
}

app.post("/api/user/create", (req, res) => {
    try {
        const { userName = "New User" } = req.body;
        const userId = generateUserId();

        const newSession = new UserSession(userId, userName);
        userSessions.set(userId, newSession);

        setTimeout(() => {
            newSession.initializeClient();
        }, 100);

        res.json({
            success: true,
            userId,
            userName,
            message: "User session created successfully"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/user/status", validateUserSession, (req, res) => {
    const session = req.userSession;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({
        type: "init",
        status: session.isReady ? "connected" : "disconnected",
        userName: session.userName,
        qrCode: session.qrCodeString,
        userId: session.userId
    })}\n\n`);

    session.clients.push(res);

    req.on("close", () => {
        session.clients = session.clients.filter((c) => c !== res);
        res.end();
    });

    const pingInterval = setInterval(() => {
        try {
            res.write(`data: ${JSON.stringify({ type: "ping", timestamp: Date.now() })}\n\n`);
        } catch (err) {
            clearInterval(pingInterval);
        }
    }, 30000);

    req.on("close", () => {
        clearInterval(pingInterval);
    });
});

app.get("/api/user/qr", validateUserSession, (req, res) => {
    const session = req.userSession;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code - ${session.userName}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
            <div class="container">
                <h2>WhatsApp Status - ${session.userName}</h2>
                <div id="qrContainer">
                    ${!session.isReady && session.qrCodeString ?
            `<img src="${session.qrCodeString}" width="250" height="250" alt="QR Code"/>` :
            `<div class="loading">Loading...</div>`}
                </div>
                <div id="statusText" class="${session.isReady ? 'connected' : 'disconnected'}">
                    ${session.isReady ? "✅ Connected!" : "❌ Disconnected"}
                </div>
                <div class="info">
                    <strong>User ID:</strong> ${session.userId}<br><br>
                    <strong>Instructions:</strong><br>
                    1. Open WhatsApp on your phone<br>
                    2. Tap Menu → Linked Devices → Link a Device<br>
                    3. Scan the QR code above<br>
                    4. Wait for connection confirmation
                </div>
            </div>
            <script>
                const userId = "${session.userId}";
                const eventSource = new EventSource("/api/user/status?userId=" + userId);
                
                eventSource.onmessage = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        const qrContainer = document.getElementById("qrContainer");
                        const statusText = document.getElementById("statusText");
                        
                        switch(data.type) {
                            case "init":
                                if (data.qrCode) {
                                    qrContainer.innerHTML = '<img src="' + data.qrCode + '" width="250" height="250" alt="QR Code"/>';
                                    statusText.textContent = "❌ Disconnected - Scan QR Code";
                                    statusText.className = "disconnected";
                                } else if (data.status === "connected") {
                                    qrContainer.innerHTML = '<div style="font-size: 50px;">✅</div>';
                                    statusText.textContent = "✅ Connected!";
                                    statusText.className = "connected";
                                }
                                break;
                            case "qr-update":
                                qrContainer.innerHTML = '<img src="' + data.qr + '" width="250" height="250" alt="QR Code"/>';
                                statusText.textContent = "❌ Disconnected - Scan QR Code";
                                statusText.className = "disconnected";
                                break;
                            case "connected":
                                qrContainer.innerHTML = '<div style="font-size: 50px;">✅</div>';
                                statusText.textContent = "✅ Connected!";
                                statusText.className = "connected";
                                break;
                            case "phone-logged-out":
                                qrContainer.innerHTML = '<div class="loading">Generating new QR code...</div>';
                                statusText.textContent = "❌ Phone logged out. New QR code will be generated...";
                                statusText.className = "disconnected";
                                break;
                            case "disconnected":
                                qrContainer.innerHTML = '<div style="font-size: 50px;">❌</div>';
                                statusText.textContent = "❌ Disconnected - Reconnecting...";
                                statusText.className = "disconnected";
                                break;
                            case "max-reconnect":
                                qrContainer.innerHTML = '<div style="color: red; padding: 20px;">Max reconnection attempts reached. Please create a new session.</div>';
                                statusText.textContent = "❌ Connection Failed";
                                statusText.className = "disconnected";
                                eventSource.close();
                                break;
                            case "loading":
                                qrContainer.innerHTML = '<div class="loading">Loading... ' + data.percent + '%</div>';
                                break;
                            case "ping":
                                // Keep connection alive
                                break;
                        }
                    } catch (e) {
                        console.error("Error parsing event:", e);
                    }
                };
                
                eventSource.onerror = function(err) {
                    console.error("EventSource failed:", err);
                    document.getElementById("statusText").textContent = "❌ Connection Error - Try refreshing";
                    eventSource.close();
                };
                
                // Clean up on page unload
                window.addEventListener('beforeunload', function() {
                    eventSource.close();
                });
            </script>
        </body>
        </html>
    `);
});

app.post("/api/user/send", upload.single("file"), validateUserSession, async (req, res) => {
    const session = req.userSession;
    const { number, message, quotedId } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!number) {
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { }
        }
        return res.status(400).json({ error: "Number is required" });
    }

    try {
        const result = await session.sendMessage(number, message, filePath, quotedId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.log(`Error deleting file ${filePath}:`, err.message);
            }
        }
    }
});

app.get("/api/user/contacts", validateUserSession, async (req, res) => {
    const session = req.userSession;

    try {
        const contacts = await session.getContacts();
        res.json({ success: true, contacts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/users", (req, res) => {
    const users = Array.from(userSessions.values()).map(session => ({
        userId: session.userId,
        userName: session.userName,
        status: session.isReady ? "Connected" : "Disconnected",
        createDate: session.createDate,
        contactCount: session.contacts.length,
        qrAvailable: !!session.qrCodeString,
        reconnectAttempts: session.reconnectAttempts
    }));

    res.json({ success: true, users });
});

app.delete("/api/user/:userId", (req, res) => {
    const { userId } = req.params;

    const session = userSessions.get(userId);
    if (!session) {
        return res.status(404).json({ error: "User session not found" });
    }

    session.destroy();
    userSessions.delete(userId);

    res.json({
        success: true,
        message: "User session deleted successfully"
    });
});

app.get("/api/user/logout", validateUserSession, (req, res) => {
    const session = req.userSession;

    try {
        session.isReady = false;
        session.qrCodeString = "";
        session.reconnectAttempts = 0;

        session.sendStatus(JSON.stringify({
            type: "logout",
            message: "Logging out..."
        }));

        session.cleanupSession();

        setTimeout(() => {
            session.initializeClient();
        }, 3000);

        res.json({
            success: true,
            message: "Logged out! QR regenerating..."
        });
    } catch (err) {
        res.status(500).json({ error: "Error: " + err.message });
    }
});

app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        activeSessions: userSessions.size
    });
});

setInterval(() => {
    if (fs.existsSync("uploads")) {
        fs.readdirSync("uploads").forEach(file => {
            const filePath = path.join("uploads", file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.mtime < Date.now() - 3600000) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                // Ignore errors
            }
        });
    }
}, 3600000); 

app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Multi-user WhatsApp API ready`);
});

process.on('SIGINT', () => {
    console.log('Shutting down all user sessions...');
    userSessions.forEach(session => session.destroy());
    userSessions.clear();
    setTimeout(() => {
        process.exit(0);
    }, 2000);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down...');
    userSessions.forEach(session => session.destroy());
    userSessions.clear();
    setTimeout(() => {
        process.exit(0);
    }, 2000);
});