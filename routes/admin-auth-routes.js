const path = require('path');
const crypto = require('crypto');
const express = require('express');

const ADMIN_SESSION_COOKIE = 'yh_admin_session';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessions = new Map();

function safeEqualString(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');

  if (aBuf.length !== bBuf.length) return false;

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};

  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;

    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();

    if (!key) return;
    out[key] = decodeURIComponent(value);
  });

  return out;
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const raw = String(storedHash || '');
  const [salt, hash] = raw.split(':');

  if (!salt || !hash) return false;

  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return safeEqualString(derived, hash);
}

function getEnvConfig() {
  return {
    routeToken: String(process.env.ADMIN_ROUTE_TOKEN || '').trim(),
    username: String(process.env.ADMIN_USERNAME || '').trim(),
    passwordHash: String(process.env.ADMIN_PASSWORD_HASH || '').trim(),
    secureCookies: process.env.NODE_ENV === 'production'
  };
}

function setSessionCookie(res, sessionId, secureCookies) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`
  ];

  if (secureCookies) parts.push('Secure');

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res, secureCookies) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0'
  ];

  if (secureCookies) parts.push('Secure');

  res.setHeader('Set-Cookie', parts.join('; '));
}

function readSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[ADMIN_SESSION_COOKIE];

  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > Number(session.expiresAt || 0)) {
    sessions.delete(sessionId);
    return null;
  }

  return {
    id: sessionId,
    ...session
  };
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now > Number(session.expiresAt || 0)) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredSessions, 15 * 60 * 1000).unref();

function createAdminRouters(options = {}) {
  const privateAdminDir =
    options.privateAdminDir || path.join(process.cwd(), 'private', 'admin');

  const pageRouter = express.Router();
  const apiRouter = express.Router();

  apiRouter.use(express.json());

  function requireGateParam(req, res, next) {
    const { routeToken } = getEnvConfig();

    if (!routeToken) {
      return res.status(500).send('ADMIN_ROUTE_TOKEN is missing.');
    }

    if (!safeEqualString(req.params.gate || '', routeToken)) {
      return res.status(404).send('Not found');
    }

    next();
  }

  pageRouter.get('/admin/:gate/login', requireGateParam, (req, res) => {
    return res.sendFile(path.join(privateAdminDir, 'admin-login.html'));
  });

  pageRouter.get('/admin/:gate/panel', requireGateParam, (req, res) => {
    const session = readSessionFromRequest(req);

    if (!session) {
      return res.redirect(`/admin/${req.params.gate}/login`);
    }

    return res.sendFile(path.join(privateAdminDir, 'admin-panel.html'));
  });

  apiRouter.post('/api/admin/login', (req, res) => {
    const { gate, routeToken, username, password } = req.body || {};
    const env = getEnvConfig();
    const incomingGate = String(gate || routeToken || '').trim();

    if (!env.routeToken || !env.username || !env.passwordHash) {
      return res.status(500).json({
        success: false,
        message: 'Admin auth environment variables are incomplete.'
      });
    }

    if (!safeEqualString(incomingGate, env.routeToken)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid route token.'
      });
    }

    if (
      !safeEqualString(username || '', env.username) ||
      !verifyPassword(password || '', env.passwordHash)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.'
      });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');

    sessions.set(sessionId, {
      username: env.username,
      role: 'Super Admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
    });

    setSessionCookie(res, sessionId, env.secureCookies);

    return res.json({
      success: true,
      redirectTo: `/admin/${env.routeToken}/panel`,
      user: {
        username: env.username,
        role: 'Super Admin'
      }
    });
  });

  apiRouter.get('/api/admin/session', (req, res) => {
    const session = readSessionFromRequest(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'No active admin session.'
      });
    }

    return res.json({
      success: true,
      user: {
        username: session.username,
        role: session.role
      }
    });
  });

  apiRouter.post('/api/admin/logout', (req, res) => {
    const env = getEnvConfig();
    const cookies = parseCookies(req);
    const sessionId = cookies[ADMIN_SESSION_COOKIE];

    if (sessionId) {
      sessions.delete(sessionId);
    }

    clearSessionCookie(res, env.secureCookies);

    return res.json({
      success: true,
      redirectTo: env.routeToken ? `/admin/${env.routeToken}/login` : '/'
    });
  });

  return { pageRouter, apiRouter };
}

module.exports = {
  createAdminRouters,
  createPasswordHash
};

if (require.main === module) {
  const password = process.argv[2];

  if (!password) {
    console.error('Usage: node routes/admin-auth-routes.js "YourPasswordHere"');
    process.exit(1);
  }

  console.log(createPasswordHash(password));
}