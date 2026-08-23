# SonicSync Pro V9

## Repository layout

- `index.html` — Netlify frontend entry point.
- `config.js` — Socket.IO server URL configuration.
- `netlify.toml` — Netlify publish/redirect configuration.
- `server/server.js` — Node.js + Socket.IO realtime server.
- `server/package.json` — Socket.IO server dependencies and start command.
- `package.json` — optional root project metadata.

## Deployment

1. Deploy the repository root to Netlify. The publish directory is `.` and the entry file is `index.html`.
2. Deploy `server/` as a Node.js service on a host that supports a persistent WebSocket/Socket.IO process.
3. Set `CORS_ORIGIN` on the Socket.IO service to your Netlify site URL (or a comma-aware proxy policy if your host requires it).
4. Put the public HTTPS Socket.IO server URL into `config.js` as `window.SONICSYNC_SOCKET_URL`.
5. Replace `YOUR-SOCKET-SERVER-URL` in `netlify.toml` with the same server origin if you want the proxy routes.

The server provides `/health` for a basic health check.

## Important

Netlify is used for the static frontend. The Socket.IO server must run as a persistent Node.js service; do not expect a normal static Netlify deployment to keep a Node.js Socket.IO process alive.
