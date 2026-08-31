# SonicSync Pro — Firebase Authentication + Realtime Fixed Build

Exact upload filenames:
- index.html
- config.js
- package.json
- server.js
- database.rules.json
- README_SETUP.txt

Authentication wired to Firebase:
- Email/password login + registration
- Google sign-in
- Mobile number OTP + reCAPTCHA
- Password recovery
- Anonymous/Guest sign-in

Each section opens only after its button is pressed. OTP is requested only after Send OTP.

User identity:
- Non-guest accounts receive a stable 10-digit SonicSync public UID.
- Firebase Auth UID is stored separately as authUid.
- Existing matching email records are reused when possible.
- Profile, coins, game counters and history remain associated with the Firebase account.

Admins:
- devanandyt99@gmail.com
- devanandyt88@gmail.com
- devanandyt00@gmail.com
- devanandyt22@gmail.com

Netlify:
- Upload index.html and config.js to repository root.

Render:
- Run server.js with package.json.
- Set FIREBASE_PROJECT_ID=soni-c9410.
- Set CORS_ORIGIN to your exact Netlify HTTPS domain.
- Put the real Render HTTPS URL in config.js as SONICSYNC_SOCKET_URL.

Firebase:
- Keep Email/Password, Google, Phone and Anonymous enabled.
- Add the Netlify domain under Authentication → Settings → Authorized domains.
- Deploy database.rules.json under Realtime Database → Rules.

If the live page still shows auth/api-key-not-valid, the Firebase Web API key itself is invalid/deleted/restricted. Copy the current Web SDK configuration from Firebase Project Settings → Your apps → Web app into config.js; also check Google Cloud API-key restrictions.

Security:
- Firebase Auth controls identity and sessions.
- Realtime Database rules restrict private user profiles by authUid (or administrator).
- Socket.IO requires a valid Firebase ID token.
- Never put a Firebase service-account private key in frontend files.
- Phone OTP remains subject to Firebase SMS quota.

Netlify hosts the static frontend; Render hosts the persistent Socket.IO backend.
