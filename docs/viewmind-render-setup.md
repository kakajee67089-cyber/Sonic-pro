# ViewMind Render security setup

The Draft branch now contains Firebase Authentication and Socket.IO token verification support.

For production, configure these Render environment variables on the active Socket.IO service:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin service-account JSON, stored only as a Render secret.
- `FIREBASE_AUTH_REQUIRED=true` — require a valid Firebase ID token for realtime connections.
- `VIEWMIND_ADMIN_UIDS` — comma-separated Firebase UIDs allowed to use server-side admin authorization when the admin endpoint is enabled.
- `CORS_ORIGIN` — the exact ViewMind Netlify origin.

Never commit the service-account JSON/private key or an administrator password to GitHub.

Firebase Realtime Database remains the persistent application store for profiles, history, rooms, and analytics. Socket.IO remains the low-latency realtime transport.
