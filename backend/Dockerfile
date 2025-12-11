FROM node:18-bullseye-slim

# Install required system packages for headless Chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libxss1 \
    libasound2 \
    libgtk-3-0 \
    libpangocairo-1.0-0 \
    libdbus-1-3 \
    libxkbcommon0 \
    wget \
    gnupg \
  && rm -rf /var/lib/apt/lists/*

# Install Chromium (Debian package)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy backend source
COPY backend/ ./

# Create a directory for LocalAuth/session storage and mark as volume
RUN mkdir -p /sessions
VOLUME ["/sessions"]

# Environment variables helpers for whatsapp-web.js / puppeteer
ENV WWEBJS_PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV WWEBJS_LOCAL_AUTH_DIR=/sessions

EXPOSE 3000

CMD ["node", "server.js"]
