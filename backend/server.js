const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());
const PORT = 3000;

let userSessions = new Map();

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
    }

    sendStatus(msg) {
        this.clients.forEach((res) => res.write(`data: ${msg}\n\n`));
    }

    initializeClient() {
        console.log(`Creating WhatsApp Client for user: ${this.userId}...`);

        if (this.client) {
            try {
                this.client.destroy();
            } catch (err) {
                console.log(`Error destroying old client for ${this.userId}:`, err.message);
            }
        }

        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: this.userId }),
            puppeteer: {
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-zygote",
                    "--single-process"
                ]
            },
        });

        this.client.on("qr", async (qr) => {
            this.isReady = false;
            this.qrCodeString = await qrcode.toDataURL(qr);

            this.sendStatus(JSON.stringify({
                type: "qr-update",
                qr: this.qrCodeString
            }));

            console.log(`New QR Generated for user: ${this.userId}!`);
        });



        this.client.on("ready", () => {
            this.isReady = true;
            this.qrCodeString = "";

            const myNumber = this.client.info.wid.user || "Unknown";
            const myName = this.client.info.pushname || this.userName;
            this.userName = myName;

            this.sendStatus(JSON.stringify({
                type: "user-info",
                name: myName,
                number: myNumber
            }));
            this.sendStatus("connected");
            console.log(`Connected as: ${myName} (${myNumber}) for user: ${this.userId}`);
        });

        this.client.on("authenticated", () => {
            console.log(`User ${this.userId} authenticated!`);
        });

        this.client.on("auth_failure", (msg) => {
            console.log(`Authentication failed for user ${this.userId}:`, msg);
            this.safeRegenerateClient();
        });

        this.client.on("disconnected", (reason) => {
            console.log(`Phone disconnected for user ${this.userId}:`, reason);
            this.isReady = false;
            this.qrCodeString = "";
            this.sendStatus("qr");
            this.safeRegenerateClient();
        });

        this.client.on("message", (msg) => {
            this.sendStatus(JSON.stringify({
                type: "incoming",
                from: msg.from,
                body: msg.body
            }));
        });

        this.client.initialize();
    }

    safeRegenerateClient() {
        console.log(`Reinitializing WhatsApp client for user: ${this.userId}...`);

        setTimeout(() => {
            if (this.client) {
                try {
                    this.client.destroy();
                } catch (err) {
                    console.log(`Error destroying client for ${this.userId}:`, err.message);
                }
                this.client = null;
            }
            this.initializeClient();
        }, 5000);
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
                id: msgObj.id._serialized
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
                    number: c.id.user
                }));

            this.contacts = contacts;
            return contacts;
        } catch (err) {
            throw new Error("Failed to get contacts: " + err.message);
        }
    }

    destroy() {
        if (this.client) {
            try {
                this.client.destroy();
            } catch (err) {
                console.log(`Error destroying client for ${this.userId}:`, err.message);
            }
        }
        this.clients.forEach(res => res.end());
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
    const { userName = "New User" } = req.body;
    const userId = generateUserId();

    const newSession = new UserSession(userId, userName);
    userSessions.set(userId, newSession);

    newSession.initializeClient();

    res.json({
        success: true,
        userId,
        userName,
        message: "User session created successfully"
    });
});

app.get("/api/user/status", validateUserSession, (req, res) => {
    const session = req.userSession;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    session.clients.push(res);

    res.write(`data: ${JSON.stringify({
        type: "init",
        status: session.isReady ? "connected" : "disconnected",
        userName: session.userName,
        qrCode: session.qrCodeString
    })}\n\n`);

    req.on("close", () => {
        session.clients = session.clients.filter((c) => c !== res);
    });
});

app.get("/api/user/qr", validateUserSession, (req, res) => {
    const session = req.userSession;

    res.send(`
        <div style="text-align:center; margin-top:40px;">
            <h2>WhatsApp Status - ${session.userName}</h2>
            <div id="qrContainer">
                ${!session.isReady && session.qrCodeString ?
            `<img src="${session.qrCodeString}" width="250"/>` :
            ""}
            </div>
            <h3 id="statusText">${session.isReady ? "Connected!" : "Disconnected"}</h3>
            <script>
                const userId = "${session.userId}";
                const events = new EventSource("/api/user/status?userId=" + userId);
                events.onmessage = function(e) {
                    const data = JSON.parse(e.data);
                    const qrContainer = document.getElementById("qrContainer");
                    const statusText = document.getElementById("statusText");
                    
                    if (data.type === "init") {
                        if (data.status === "connected") {
                            qrContainer.innerHTML = "";
                            statusText.innerText = "Connected!";
                        } else if (data.qrCode) {
                            qrContainer.innerHTML = '<img src="' + data.qrCode + '" width="250"/>';
                        }
                    } else if (data === "connected") {
                        qrContainer.innerHTML = "";
                        statusText.innerText = "Connected!";
                    } else if (data === "qr") {
                        location.reload();
                    }
                };
            </script>
        </div>
    `);
});

app.post("/api/user/send", upload.single("file"), validateUserSession, async (req, res) => {
    const session = req.userSession;
    const { number, message, quotedId } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!number) {
        return res.status(400).json({ error: "Number is required" });
    }

    try {
        const result = await session.sendMessage(number, message, filePath, quotedId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
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
        contactCount: session.contacts.length
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

        if (session.client) {
            session.client.destroy();
            session.client = null;
        }

        session.initializeClient();
        res.json({ success: true, message: "Logged out! QR regenerating..." });
    } catch (err) {
        res.status(500).json({ error: "Error: " + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
    console.log(`Multi-user WhatsApp API ready`);
});

process.on('SIGINT', () => {
    console.log('Shutting down all user sessions...');
    userSessions.forEach(session => session.destroy());
    userSessions.clear();
    process.exit();
});

