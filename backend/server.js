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

// Ensure uploads directory exists
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

// Fixed SafeLocalAuth class
class SafeLocalAuth extends LocalAuth {
    async logout() {
        try {
            // First try to close browser properly
            if (this.client && this.client.pupBrowser) {
                try {
                    await this.client.pupBrowser.close();
                } catch (e) {
                    console.log('SafeLocalAuth: Error closing browser:', e.message);
                }
            }
            
            // Then try to remove auth directory
            try {
                if (this.options.dataPath) {
                    const authDir = path.join(this.options.dataPath, `session-${this.options.clientId}`);
                    if (fs.existsSync(authDir)) {
                        // Remove all files in directory
                        const files = fs.readdirSync(authDir);
                        for (const file of files) {
                            try {
                                fs.unlinkSync(path.join(authDir, file));
                            } catch (e) {
                                // Ignore file deletion errors
                            }
                        }
                        // Try to remove directory
                        try {
                            fs.rmdirSync(authDir);
                        } catch (e) {
                            // Directory might not be empty, ignore
                        }
                    }
                }
            } catch (error) {
                console.log('SafeLocalAuth: Error during cleanup:', error.message);
                // Don't throw error
            }
        } catch (error) {
            console.log('SafeLocalAuth: General logout error:', error.message);
            // Don't throw error
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
    }

    sendStatus(msg) {
        this.clients.forEach((res) => {
            try {
                res.write(`data: ${msg}\n\n`);
            } catch (err) {
                // Connection closed, remove from clients
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

        // Clear any existing cleanup timeout
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }

        // Clean up old client if exists
        this.cleanupClient();

        try {
            this.client = new Client({
                authStrategy: new SafeLocalAuth({ 
                    clientId: this.userId,
                    dataPath: path.join(process.cwd(), '.wwebjs_auth')
                }),
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

            // QR Event
            this.client.on("qr", async (qr) => {
                this.isReady = false;
                this.isInitializing = false;
                this.qrCodeString = await qrcode.toDataURL(qr);

                this.sendStatus(JSON.stringify({
                    type: "qr-update",
                    qr: this.qrCodeString
                }));

                console.log(`New QR Generated for user: ${this.userId}!`);
            });

            // Ready Event
            this.client.on("ready", () => {
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
                    type: "connected"
                }));
                console.log(`Connected as: ${myName} (${myNumber}) for user: ${this.userId}`);
            });

            // Authenticated Event
            this.client.on("authenticated", () => {
                console.log(`User ${this.userId} authenticated!`);
                this.reconnectAttempts = 0;
            });

            // Authentication Failure Event
            this.client.on("auth_failure", (msg) => {
                console.log(`Authentication failed for user ${this.userId}:`, msg);
                this.isInitializing = false;
                this.reconnectAttempts++;
                this.scheduleReconnect();
            });

            // Disconnected Event
            this.client.on("disconnected", (reason) => {
                console.log(`Phone disconnected for user ${this.userId}:`, reason);
                this.isReady = false;
                this.isInitializing = false;
                this.qrCodeString = "";
                
                this.sendStatus(JSON.stringify({
                    type: "disconnected",
                    reason: reason
                }));
                
                this.reconnectAttempts++;
                this.scheduleReconnect();
            });

            // Message Event
            this.client.on("message", (msg) => {
                this.sendStatus(JSON.stringify({
                    type: "incoming",
                    from: msg.from,
                    body: msg.body,
                    timestamp: new Date().toISOString()
                }));
            });

            // Loading Screen Event
            this.client.on("loading_screen", (percent, message) => {
                console.log(`Loading screen for ${this.userId}: ${percent}% - ${message}`);
            });

            // Initialize client with error handling
            this.client.initialize().catch(err => {
                console.error(`Failed to initialize client for ${this.userId}:`, err.message);
                this.isInitializing = false;
                this.reconnectAttempts++;
                this.scheduleReconnect();
            });

        } catch (error) {
            console.error(`Error creating client for ${this.userId}:`, error.message);
            this.isInitializing = false;
            this.reconnectAttempts++;
            this.scheduleReconnect();
        }
    }

    cleanupClient() {
        if (this.client) {
            try {
                // Store reference to client
                const clientToCleanup = this.client;
                
                // Remove all event listeners
                clientToCleanup.removeAllListeners();
                
                // Create a promise for cleanup
                const cleanupPromise = new Promise((resolve) => {
                    setTimeout(async () => {
                        try {
                            // Check if browser is still open
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
                                } catch (e) {
                                    console.log(`Error closing browser for ${this.userId}:`, e.message);
                                }
                            }
                            
                            // Destroy client instance
                            try {
                                await clientToCleanup.destroy();
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

                // Set client to null immediately
                this.client = null;
                
            } catch (err) {
                console.log(`Error in cleanupClient for ${this.userId}:`, err.message);
                this.client = null;
            }
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

        const delay = Math.min(10000, this.reconnectAttempts * 3000); // Max 10 seconds
        console.log(`Scheduling reconnect for user: ${this.userId} in ${delay}ms (Attempt: ${this.reconnectAttempts})`);

        // Clear any existing timeout
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
        }

        this.cleanupTimeout = setTimeout(() => {
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
        
        // Clear any pending timeouts
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        
        // Clean up client
        this.cleanupClient();
        
        // Close all SSE connections
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

// Routes
app.post("/api/user/create", (req, res) => {
    try {
        const { userName = "New User" } = req.body;
        const userId = generateUserId();

        const newSession = new UserSession(userId, userName);
        userSessions.set(userId, newSession);

        // Delay initialization to ensure session is created
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

    // Send initial status immediately
    res.write(`data: ${JSON.stringify({
        type: "init",
        status: session.isReady ? "connected" : "disconnected",
        userName: session.userName,
        qrCode: session.qrCodeString,
        userId: session.userId
    })}\n\n`);

    // Add client to session
    session.clients.push(res);

    // Remove client on close
    req.on("close", () => {
        session.clients = session.clients.filter((c) => c !== res);
        res.end();
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
        try {
            res.write(`data: ${JSON.stringify({type: "ping", timestamp: Date.now()})}\n\n`);
        } catch (err) {
            clearInterval(pingInterval);
        }
    }, 30000);

    // Clear interval on connection close
    req.on("close", () => {
        clearInterval(pingInterval);
    });
});

// ... [Keep all other routes exactly the same as before: /api/user/qr, /api/user/send, /api/user/contacts, etc.]

app.get("/api/user/qr", validateUserSession, (req, res) => {
    const session = req.userSession;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp QR Code - ${session.userName}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                h2 {
                    color: #333;
                    margin-bottom: 20px;
                }
                #qrContainer {
                    margin: 30px 0;
                    min-height: 250px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                #statusText {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 10px;
                }
                .connected {
                    color: #25D366;
                    background: #e8f7ed;
                }
                .disconnected {
                    color: #dc3545;
                    background: #f8d7da;
                }
                .loading {
                    color: #ffc107;
                    background: #fff3cd;
                }
                .info {
                    font-size: 14px;
                    color: #666;
                    margin-top: 20px;
                }
            </style>
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
                    User ID: ${session.userId}<br>
                    Scan the QR code with WhatsApp to connect
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
                            case "qr-update":
                                if (data.qrCode || data.qr) {
                                    const qr = data.qrCode || data.qr;
                                    qrContainer.innerHTML = '<img src="' + qr + '" width="250" height="250" alt="QR Code"/>';
                                    statusText.textContent = "❌ Disconnected - Scan QR Code";
                                    statusText.className = "disconnected";
                                } else if (data.status === "connected") {
                                    qrContainer.innerHTML = '<div style="font-size: 50px;">✅</div>';
                                    statusText.textContent = "✅ Connected!";
                                    statusText.className = "connected";
                                }
                                break;
                            case "connected":
                                qrContainer.innerHTML = '<div style="font-size: 50px;">✅</div>';
                                statusText.textContent = "✅ Connected!";
                                statusText.className = "connected";
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
            try { fs.unlinkSync(filePath); } catch(e) {}
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

        // Send logout status
        session.sendStatus(JSON.stringify({
            type: "logout",
            message: "Logging out..."
        }));

        // Clean up client
        session.cleanupClient();

        // Reinitialize after delay
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

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        activeSessions: userSessions.size 
    });
});

// Clean up old uploaded files periodically
setInterval(() => {
    if (fs.existsSync("uploads")) {
        fs.readdirSync("uploads").forEach(file => {
            const filePath = path.join("uploads", file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.mtime < Date.now() - 3600000) { // Older than 1 hour
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                // Ignore errors
            }
        });
    }
}, 3600000); // Run every hour

app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Multi-user WhatsApp API ready`);
});

// Graceful shutdown
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