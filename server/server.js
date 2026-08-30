const admin = require('firebase-admin');
const io = require('socket.io')(process.env.PORT || 3000, {
cors: { origin: "*" }
});

// Firebase Admin initialization
if (process.env.FIREBASE_CONFIG) {
admin.initializeApp({
credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG))
});
}

io.on('connection', (socket) => {
console.log('New connection');

// User Verification  
socket.on('join-room', async (data) => {  
    // [Existing logic for Ludo/Music sync...]
});

});
