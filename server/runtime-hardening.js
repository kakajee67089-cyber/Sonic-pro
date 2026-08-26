'use strict';

// ViewMind runtime hardening + additive realtime layer.
// The existing server remains intact; the realtime quiz engine is attached
// as a separate Socket.IO listener so existing music/game events are preserved.

const http = require('http');
const socketio = require('socket.io');
const realtime = require('./viewmind-realtime');
const originalCreateServer = http.createServer;

http.createServer = function createHardenedServer(requestListener, ...args) {
  const wrappedListener = requestListener
    ? (req, res) => {
        const headers = {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Cross-Origin-Resource-Policy': 'same-site'
        };
        for (const [name, value] of Object.entries(headers)) {
          if (!res.headersSent) res.setHeader(name, value);
        }
        return requestListener(req, res);
      }
    : undefined;
  return originalCreateServer.call(http, wrappedListener, ...args);
};

// server.js imports { Server } from socket.io. Wrap that constructor so the
// additive ViewMind realtime layer is installed on the same Socket.IO instance.
const OriginalServer = socketio.Server;
socketio.Server = class ViewMindServer extends OriginalServer {
  constructor(...args) {
    super(...args);
    realtime.install(this);
  }
};
socketio.Server.prototype = OriginalServer.prototype;

require('./server.js');
