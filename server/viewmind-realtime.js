'use strict';

const QUIZ_DURATION_MS = 60_000;
const QUIZ_LAST5_MS = 5_000;
const quizRooms = new Map();

function cleanUser(user = {}) {
  return {
    uid: String(user.uid || '').slice(0, 128),
    name: String(user.name || 'Player').slice(0, 80),
    photo: user.photo ? String(user.photo).slice(0, 1000) : null
  };
}

function install(io) {
  io.__viewmindRealtimeInstalled = true;
  io.on('connection', socket => {
    socket.__viewmindRooms = new Set();
    socket.on('presence:register', user => {
      const u = cleanUser(user);
      if (u.uid) socket.data.viewmindUser = u;
    });
    const trackRoom = p => {
      const roomId = String(p?.roomId || '').toUpperCase();
      const uid = String(p?.user?.uid || p?.uid || socket.data?.viewmindUser?.uid || '');
      if (roomId && uid) {
        socket.__viewmindRooms.add(roomId);
        socket.data.viewmindUser = cleanUser(p?.user || socket.data.viewmindUser || { uid });
      }
    };
    socket.on('room:create', trackRoom);
    socket.on('room:join', trackRoom);
    socket.on('room:leave', p => socket.__viewmindRooms.delete(String(p?.roomId || '').toUpperCase()));
    socket.on('quiz:start', p => startQuiz(io, socket, p));
    socket.on('quiz:answer', p => answerQuiz(io, socket, p));
    socket.on('quiz:state', p => sendQuizState(io, socket, p?.roomId));
    socket.on('quiz:request-state', p => sendQuizState(io, socket, p?.roomId));
    socket.on('quiz:finish', p => finishQuiz(io, socket, p?.roomId, 'host-finished'));
    socket.on('disconnect', () => {
      for (const roomId of socket.__viewmindRooms || []) {
        const q = quizRooms.get(roomId);
        if (!q) continue;
        const uid = socket.data?.viewmindUser?.uid;
        if (uid) q.players.delete(uid);
        if (!q.players.size) stopQuiz(roomId); else emitQuizState(io, q);
      }
    });
  });
}

function roomFor(io, socket, roomId) {
  roomId = String(roomId || '').toUpperCase();
  if (!roomId || !socket.__viewmindRooms?.has(roomId)) return null;
  let q = quizRooms.get(roomId);
  if (!q) {
    q = { roomId, hostUid: null, started: false, startAt: 0, endAt: 0, players: new Map(), timer: null, finished: false };
    quizRooms.set(roomId, q);
  }
  const u = cleanUser(socket.data?.viewmindUser || {});
  if (u.uid) q.players.set(u.uid, { ...u, points: Number(q.players.get(u.uid)?.points || 0), answered: false });
  return q;
}

function startQuiz(io, socket, p) {
  const q = roomFor(io, socket, p?.roomId);
  const uid = socket.data?.viewmindUser?.uid;
  if (!q || !uid) return socket.emit('quiz:error', { message: 'Authentication required' });
  if (q.hostUid && q.hostUid !== uid) return socket.emit('quiz:error', { message: 'Only the host can start the quiz' });
  q.hostUid = q.hostUid || uid;
  if (q.started) return sendQuizState(io, socket, q.roomId);
  q.started = true; q.finished = false; q.startAt = Date.now(); q.endAt = q.startAt + QUIZ_DURATION_MS;
  for (const player of q.players.values()) { player.points = 0; player.answered = false; }
  clearTimeout(q.timer);
  q.timer = setTimeout(() => finishQuiz(io, socket, q.roomId, 'time-up'), QUIZ_DURATION_MS + 50);
  emitQuizState(io, q);
  setTimeout(() => emitQuizState(io, q), QUIZ_DURATION_MS - QUIZ_LAST5_MS);
}

function answerQuiz(io, socket, p) {
  const q = roomFor(io, socket, p?.roomId);
  const uid = socket.data?.viewmindUser?.uid;
  if (!q || !uid || !q.started || q.finished) return;
  if (Date.now() >= q.endAt) return finishQuiz(io, socket, q.roomId, 'time-up');
  const player = q.players.get(uid);
  if (!player || player.answered) return;
  player.answered = true;
  if (p?.correct === true) player.points += Math.max(0, Number(p?.points) || 1);
  emitQuizState(io, q);
}

function sendQuizState(io, socket, roomId) {
  const q = roomFor(io, socket, roomId);
  if (q) emitQuizState(io, q, socket);
}

function emitQuizState(io, q, targetSocket) {
  const now = Date.now();
  const payload = {
    roomId: q.roomId, started: q.started, finished: q.finished, serverNow: now,
    startAt: q.startAt, endAt: q.endAt,
    remainingMs: q.started ? Math.max(0, q.endAt - now) : QUIZ_DURATION_MS,
    players: [...q.players.values()].map(p => ({ uid: p.uid, name: p.name, photo: p.photo, points: p.points }))
  };
  if (targetSocket) targetSocket.emit('quiz:state', payload); else io.to(q.roomId).emit('quiz:state', payload);
}

function finishQuiz(io, socket, roomId, reason) {
  const q = quizRooms.get(String(roomId || '').toUpperCase());
  if (!q || q.finished) return;
  const uid = socket.data?.viewmindUser?.uid;
  if (reason === 'host-finished' && uid && q.hostUid !== uid) return;
  q.finished = true; q.started = false; clearTimeout(q.timer);
  const ranking = [...q.players.values()].sort((a, b) => b.points - a.points || a.uid.localeCompare(b.uid))
    .map((p, i) => ({ uid: p.uid, name: p.name, points: p.points, rank: i + 1 }));
  io.to(q.roomId).emit('quiz:result', { roomId: q.roomId, reason, serverNow: Date.now(), ranking });
  emitQuizState(io, q);
}

function stopQuiz(roomId) {
  const q = quizRooms.get(roomId);
  if (!q) return;
  clearTimeout(q.timer); quizRooms.delete(roomId);
}

module.exports = { install, QUIZ_DURATION_MS };
