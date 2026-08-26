'use strict';

// ViewMind runtime hardening + additive realtime/auth layer.
// Existing server and Socket.IO events remain intact.

const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const realtime = require('./viewmind-realtime');
const { verifyIdToken } = require('./firebase-auth');
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

// Additive Firebase verification endpoint. It never receives or stores a password.
const originalExpress = express;
const wrappedExpress = function viewMindExpress(...args) {
  const app = originalExpress(...args);
  app.post('/auth/verify', originalExpress.json({ limit: '32kb' }), async (req, res) => {
    try {
      const decoded = await verifyIdToken(req.body?.idToken);
      res.json({ ok: true, user: {
        uid: String(decoded.uid),
        email: decoded.email ? String(decoded.email).toLowerCase() : null,
        name: decoded.name ? String(decoded.name).slice(0, 80) : 'Player',
        photo: decoded.picture ? String(decoded.picture).slice(0, 1000) : null
      }});
    } catch (err) {
      res.status(401).json({ ok: false, error: 'Invalid or expired authentication token' });
    }
  });
  return app;
};
Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;

const OriginalServer = socketio.Server;
socketio.Server = class ViewMindServer extends OriginalServer {
  constructor(...args) {
    super(...args);
    realtime.install(this);
  }
};
socketio.Server.prototype = OriginalServer.prototype;

require('./server.js');
