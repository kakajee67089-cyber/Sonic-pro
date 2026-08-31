'use strict';

// SonicSync Pro - low latency Socket.IO real-time server
// Firebase can remain enabled in the client for legacy persistence.
// This server is intentionally stateless except for live room state.

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { jwtVerify, decodeProtectedHeader } = require('jose');
const { createPublicKey } = require('crypto');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'soni-c9410';
const FIREBASE_CERT_URL = 'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let firebaseCertCache = { expiresAt: 0, keys: new Map() };

async function getFirebaseKey(kid) {
  if (!kid) throw new Error('Missing token key id');
  if (Date.now() >= firebaseCertCache.expiresAt || !firebaseCertCache.keys.has(kid)) {
    const res = await fetch(FIREBASE_CERT_URL);
    if (!res.ok) throw new Error('Unable to fetch Firebase signing certificates');
    const certs = await res.json();
    const keys = new Map();
    for (const [id, cert] of Object.entries(certs)) keys.set(id, createPublicKey(cert));
    const cc = res.headers.get('cache-control') || '';
    const m = cc.match(/max-age=(\d+)/i);
    const ttl = m ? Number(m[1]) * 1000 : 3600000;
    firebaseCertCache = { expiresAt: Date.now() + Math.max(60000, ttl - 60000), keys };
  }
  const key = firebaseCertCache.keys.get(kid);
  if (!key) throw new Error('Unknown Firebase signing key');
  return key;
}

async function verifyFirebaseToken(token) {
  const { kid } = decodeProtectedHeader(token);
  const key = await getFirebaseKey(kid);
  const { payload } = await jwtVerify(token, key, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
  if (payload.sub !== payload.user_id) throw new Error('Invalid Firebase token subject');
  return payload;
}

const allowedOrigins = String(process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    },
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 2e6
});

app.use(express.static(__dirname));
app.get('/', (_req, res) => res.json({ ok:true, service:'SonicSync Socket.IO', project:PROJECT_ID, message:'Realtime server is running' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'SonicSync Socket.IO', now: Date.now() }));

const rooms = new Map();
const CODE_RE = /^[A-Z0-9]{6}$/;

function cleanUser(user = {}) {
  return {
    uid: String(user.uid || '').slice(0, 100),
    name: String(user.name || 'Guest').slice(0, 60),
    photo: user.photo ? String(user.photo).slice(0, 1000) : null
  };
}
function ensureRoom(roomId, data = {}) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      type: data.type || 'music',
      hostUid: data.hostUid || null,
      users: new Map(),
      sockets: new Map(),
      playback: null,
      createdAt: Date.now()
    });
  }
  return rooms.get(roomId);
}
function publicUsers(room) {
  return Object.fromEntries([...room.users.entries()].map(([uid, u]) => [uid, u]));
}
function publicPlayback(room) {
  return room.playback ? { ...room.playback } : null;
}
function removeEmpty(roomId) {
  const room = rooms.get(roomId);
  if (room && room.sockets.size === 0) rooms.delete(roomId);
}
function isMember(socket, roomId) {
  const room = rooms.get(roomId);
  return !!room && room.sockets.has(socket.id);
}
function broadcastUsers(room) {
  io.to(room.roomId).emit('room:users', publicUsers(room));
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Firebase authentication required'));
    socket.user = await verifyFirebaseToken(String(token));
    return next();
  } catch (e) {
    return next(new Error('Invalid Firebase authentication'));
  }
});

io.on('connection', socket => {
  socket.on('time:ping', data => {
    socket.emit('time:pong', {
      clientSentAt: Number(data?.clientSentAt) || 0,
      serverNow: Date.now()
    });
  });

  socket.on('room:create', payload => {
    const roomId = String(payload?.roomId || '').toUpperCase();
    if (!CODE_RE.test(roomId)) return socket.emit('room:error', { message: 'Invalid room code' });
    const user = cleanUser(payload?.user);
    user.authUid = String(socket.user?.user_id || socket.user?.sub || '');
    if (!user.uid || !user.authUid) return socket.emit('room:error', { message: 'Missing authenticated user' });

    const existing = rooms.get(roomId);
    if (existing && existing.sockets.size > 0 && existing.hostUid !== user.uid) {
      return socket.emit('room:error', { message: 'Room already exists' });
    }
    const room = ensureRoom(roomId, { type: payload?.type || 'music', hostUid: user.uid });
    room.hostUid = user.uid;
    room.type = payload?.type || room.type;
    room.users.set(user.uid, user);
    room.sockets.set(socket.id, user.uid);
    socket.join(roomId);
    socket.data.rooms = socket.data.rooms || new Set();
    socket.data.rooms.add(roomId);
    socket.emit('room:state', { roomId, type: room.type, hostUid: room.hostUid, users: publicUsers(room), playback: publicPlayback(room) });
    broadcastUsers(room);
  });

  socket.on('room:join', payload => {
    const roomId = String(payload?.roomId || '').toUpperCase();
    const user = cleanUser(payload?.user);
    user.authUid = String(socket.user?.user_id || socket.user?.sub || '');
    if (!CODE_RE.test(roomId) || !user.uid || !user.authUid) return socket.emit('room:error', { message: 'Invalid room or authentication' });

    const room = rooms.get(roomId) || ensureRoom(roomId, { type: payload?.type || 'music' });
    if (!room.hostUid) room.hostUid = payload?.isHost ? user.uid : null;
    room.users.set(user.uid, user);
    room.sockets.set(socket.id, user.uid);
    socket.join(roomId);
    socket.data.rooms = socket.data.rooms || new Set();
    socket.data.rooms.add(roomId);
    socket.emit('room:state', { roomId, type: room.type, hostUid: room.hostUid, users: publicUsers(room), playback: publicPlayback(room) });
    broadcastUsers(room);
  });

  socket.on('room:leave', payload => {
    const roomId = String(payload?.roomId || '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return;
    const uid = room.sockets.get(socket.id) || String(payload?.uid || '');
    room.sockets.delete(socket.id);
    socket.leave(roomId);
    if (![...room.sockets.values()].includes(uid)) room.users.delete(uid);
    broadcastUsers(room);
    removeEmpty(roomId);
  });

  socket.on('music:event', state => {
    const roomId = String(state?.roomId || '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room || !isMember(socket, roomId)) return;
    const uid = room.sockets.get(socket.id);
    if (uid !== room.hostUid) return; // host-authoritative playback

    const event = {
      roomId,
      hostUid: room.hostUid,
      action: String(state.action || 'state'),
      videoId: state.videoId ? String(state.videoId).slice(0, 64) : null,
      title: String(state.title || '').slice(0, 300),
      ch: String(state.ch || '').slice(0, 200),
      thumb: String(state.thumb || '').slice(0, 1000),
      position: Math.max(0, Number(state.position) || 0),
      playing: !!state.playing,
      serverAt: Date.now(),
      duration: Math.max(0, Number(state.duration) || 0)
    };
    room.playback = event;
    socket.to(roomId).emit('music:event', event);
  });

  socket.on('music:request-state', payload => {
    const roomId = String(payload?.roomId || '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room || !isMember(socket, roomId)) return;
    const hostSocketId = [...room.sockets.entries()].find(([, uid]) => uid === room.hostUid)?.[0];
    if (hostSocketId) io.to(hostSocketId).emit('music:request-state', { roomId, requesterUid: payload?.uid || null });
    if (room.playback) socket.emit('music:state', room.playback);
  });

  socket.on('chat:message', message => {
    const roomId = String(message?.roomId || '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room || !isMember(socket, roomId)) return;
    const uid = room.sockets.get(socket.id);
    const msg = {
      roomId,
      uid,
      name: String(message?.name || 'Guest').slice(0, 60),
      photo: message?.photo ? String(message.photo).slice(0, 1000) : null,
      text: String(message?.text || '').slice(0, 2000),
      time: Date.now(),
      type: message?.type === 'voice' ? 'voice' : 'text',
      audioData: message?.type === 'voice' && message?.audioData ? String(message.audioData).slice(0, 1500000) : undefined
    };
    socket.to(roomId).emit('chat:message', msg);
  });

  socket.on('disconnect', () => {
    const joined = socket.data.rooms ? [...socket.data.rooms] : [];
    for (const roomId of joined) {
      const room = rooms.get(roomId);
      if (!room) continue;
      const uid = room.sockets.get(socket.id);
      room.sockets.delete(socket.id);
      if (uid && ![...room.sockets.values()].includes(uid)) room.users.delete(uid);
      broadcastUsers(room);
      removeEmpty(roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`SonicSync Socket.IO server running on http://localhost:${PORT}`);
});
                                                                                                      
