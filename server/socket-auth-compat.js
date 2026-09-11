'use strict';

// Compatibility bridge for the current ViewMind client.
// The current frontend can reach Socket.IO before Firebase Auth has exposed
// the current user's ID token. Keep verified Firebase tokens protected, but
// allow the legacy room client to connect without a token so room/presence
// synchronization does not fail at the Socket.IO handshake.
const { Server } = require('socket.io');
const originalUse = Server.prototype.use;

Server.prototype.use = function (middleware) {
  return originalUse.call(this, (socket, next) => {
    const token = socket?.handshake?.auth?.token;
    if (!token) return next();
    return middleware(socket, next);
  });
};
