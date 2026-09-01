// Your web app's Firebase configuration
// Google, Guest/Anonymous and Email/Password authentication remain enabled.
const firebaseConfig = {
  apiKey: "AIzaSyC4yFUw23s1Wb9ignSPzRdGeSaThNLTiXY",
  authDomain: "sonic-singh.firebaseapp.com",
  databaseURL: "https://sonic-singh-default-rtdb.firebaseio.com",
  projectId: "sonic-singh",
  storageBucket: "sonic-singh.firebasestorage.app",
  messagingSenderId: "668422254722",
  appId: "1:668422254722:web:31394b6c816e6122eb449b",
  measurementId: "G-8NMB6HYKWY"
};

window.SONICSYNC_FIREBASE_CONFIG = firebaseConfig;
// Keep the frontend Socket.IO endpoint aligned with the Netlify proxy.
window.SONICSYNC_SOCKET_URL = window.SONICSYNC_SOCKET_URL || 'https://sonic-pro-qfa9.onrender.com';
