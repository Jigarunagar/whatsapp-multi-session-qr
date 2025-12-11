FROM node:18

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libnss3 \
    libxss1 \
    libatk1.0-0 \
    libatk-bridge2.0-0

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

CMD ["node", "server.js"]
