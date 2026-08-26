'use strict';

// Firebase Authentication verifier for ViewMind.
// Production credentials must be supplied through FIREBASE_SERVICE_ACCOUNT_JSON
// (or the standard GOOGLE_APPLICATION_CREDENTIALS mechanism). No credential is
// stored in GitHub or in the frontend.

let admin = null;
let initError = null;

function getAdmin() {
  if (admin || initError) return admin;
  try {
    // Lazy-load so local development can still run the existing server without
    // Firebase credentials configured.
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (raw) {
        const serviceAccount = JSON.parse(raw);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        admin.initializeApp();
      }
    }
  } catch (err) {
    initError = err;
  }
  return admin;
}

async function verifyIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('Missing Firebase ID token');
  const sdk = getAdmin();
  if (!sdk) throw new Error('Firebase Admin is not configured');
  return sdk.auth().verifyIdToken(idToken, true);
}

async function verifySocket(socket) {
  const token = socket.handshake?.auth?.token;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return {
    uid: String(decoded.uid),
    email: decoded.email ? String(decoded.email).toLowerCase() : null,
    name: decoded.name ? String(decoded.name).slice(0, 80) : 'Player',
    photo: decoded.picture ? String(decoded.picture).slice(0, 1000) : null
  };
}

module.exports = { verifyIdToken, verifySocket };
