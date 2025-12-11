Render deployment instructions — frontend (static) + backend (Docker)

Overview
- This project contains a Vite React frontend in `client/` and a Node backend in `backend/` that uses `whatsapp-web.js` (requires headless Chromium and persistent session storage).
- The `backend/Dockerfile` provided prepares a container with Chromium and Node so it can run on Render as a Docker Web Service.

Backend (Render Web Service - Docker)
1. In Render dashboard, create a new "Web Service".
2. Connect your Git repo and select the `main` branch.
3. For the environment choose "Docker" and set the Dockerfile path to `backend/Dockerfile`.
4. Set the start command to: `node server.js` (the Dockerfile's CMD will also work).
5. Enable a Persistent Disk (important):
   - Mount path: `/sessions`
   - Size: choose appropriate size (e.g., 5-10 GB)
   - Then set the environment variable `WWEBJS_LOCAL_AUTH_DIR` to `/sessions` (the Dockerfile also sets a default).
6. Optional env vars:
   - `NODE_ENV=production`
   - Any API keys or secrets your app needs (set via Environment → Environment Variables).
7. Deploy. After build, Render will give you a service URL like `https://your-backend.onrender.com`.

Notes for backend runtime
- The backend uses `whatsapp-web.js` which requires a Chromium binary. The Dockerfile installs Chromium and points Puppeteer to it.
- Persistent sessions are stored under `/sessions` — make sure the persistent disk is enabled and mounted there, otherwise sessions (LocalAuth) will be lost on redeploy.
- If you run into Chromium launch errors, check the service logs and ensure the installed system packages match Chromium requirements.

Frontend (Render Static Site)
1. In Render, create a new "Static Site".
2. Connect the same Git repo and select `main` branch.
3. Set the Root directory to `client`.
4. Build command:
   ```bash
   npm install && npm run build
   ```
5. Publish directory: `dist`
6. Add an environment variable `VITE_API_URL` (or the env var your client uses) with the backend URL returned by Render (for example `https://your-backend.onrender.com`).
7. Deploy. After building, Render will provide a static site URL.

Client → Backend connection
- Ensure the client uses the Render backend URL for API calls. If your client expects `VITE_API_URL`, set that exact env var in the Render Static Site settings.
- If you prefer relative paths (e.g., `/api/...`) you can set up a proxy or host both behind a custom domain with rewrite rules — otherwise use the full backend URL.

Troubleshooting
- "Failed to create user: Network Error" often indicates the backend wasn't reachable from the client or SSE connections failed. Verify:
  - Backend service is healthy and reachable
  - CORS in `backend/server.js` allows the frontend origin (currently `origin: "*"`)
  - Persistent disk is mounted and `WWEBJS_LOCAL_AUTH_DIR` points to it
- Check Render service logs (Dashboard → Your Service → Logs). Look for Chromium/puppeteer errors and missing system dependencies.

Local testing before deploy
- Build and run backend locally with Docker:
  ```powershell
  cd backend
  docker build -t whatsapp-backend .
  docker run -p 3000:3000 -v ${PWD}/sessions:/sessions whatsapp-backend
  ```
- Build and run client locally:
  ```powershell
  cd client
  npm install
  npm run dev
  ```

If you want, I can:
- Create a `render.yaml` (IaC) for both services (I will draft it but you must verify disk mount syntax in Render docs), or
- Create the Docker setup and I can try to deploy (I cannot run Render commands from here).
