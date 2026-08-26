'use strict';

// ViewMind runtime hardening layer.
// Loaded before server.js so the existing application code remains intact.
// Adds safe HTTP response headers without changing the existing Socket.IO contract.

const http = require('http');
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

require('./server.js');
