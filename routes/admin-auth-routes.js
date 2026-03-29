const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { firestore } = require('../config/firebaseAdmin');
const academyFirestoreRepo = require('../backend/repositories/academyFirestoreRepo');

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
  function requireAdminSession(req, res, next) {
  const session = readSessionFromRequest(req);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'No active admin session.'
    });
  }

  req.adminSession = session;
  next();
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value || null;
}

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function buildAdminBootstrapPayload() {
  const usersSnap = await firestore.collection('users').limit(300).get();

  const users = usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() || {})
  }));

  const members = users.map((user) => {
    const stats = user.stats || {};
    const academyDivisions = [];

    if (user.accessState === 'unlocked' || user.hasAcademyAccess === true) {
      academyDivisions.push('Academy');
    }

    return {
      id: cleanText(user.id),
      name: cleanText(user.fullName || user.name || user.displayName || user.username || 'Unknown User'),
      username: cleanText(user.username ? `@${String(user.username).replace(/^@/, '')}` : ''),
      email: cleanText(user.email || ''),
      divisions: academyDivisions,
      status: cleanText(user.status || 'Active'),
      activityScore: toNumber(stats.repPoints, 0),
      roadmapStatus: academyDivisions.includes('Academy') ? 'Academy access unlocked' : 'Not in Academy',
      riskFlag: 'Low',
      joinedAt: toIso(user.createdAt) || '',
      lastLogin: toIso(user.lastLoginAt || user.updatedAt) || '',
      notes: []
    };
  });

const applications = users.flatMap((user) => {
  const output = [];

  if (user.academyApplication && typeof user.academyApplication === 'object') {
    const app = user.academyApplication;
    output.push({
      id: cleanText(app.id || `APP-${user.id}`),
      name: cleanText(user.fullName || user.name || user.displayName || user.username || 'Unknown User'),
      email: cleanText(user.email || ''),
      goal: cleanText(app.goal || ''),
      background: cleanText(app.background || ''),
      recommendedDivision: cleanText(app.recommendedDivision || 'Academy'),
      status: cleanText(app.status || 'Under Review'),
      aiScore: toNumber(app.aiScore, 0),
      country: cleanText(app.country || ''),
      skills: Array.isArray(app.skills) ? app.skills : [],
      networkValue: cleanText(app.networkValue || ''),
      source: cleanText(app.source || 'Academy Application'),
      submittedAt: toIso(app.submittedAt) || cleanText(app.submittedAt || ''),
      notes: Array.isArray(app.notes) ? app.notes : [],
      applicationType: cleanText(app.applicationType || 'academy-membership'),
      reviewLane: cleanText(app.reviewLane || 'Academy Membership')
    });
  }

  if (user.roadmapApplication && typeof user.roadmapApplication === 'object') {
    const app = user.roadmapApplication;
    output.push({
      id: cleanText(app.id || `RMAP-${user.id}`),
      name: cleanText(user.fullName || user.name || user.displayName || user.username || 'Unknown User'),
      email: cleanText(user.email || ''),
      goal: cleanText(app.goal || ''),
      background: cleanText(app.background || ''),
      recommendedDivision: cleanText(app.recommendedDivision || 'Academy'),
      status: cleanText(app.status || 'Under Review'),
      aiScore: toNumber(app.aiScore, 0),
      country: cleanText(app.country || ''),
      skills: Array.isArray(app.skills) ? app.skills : [],
      networkValue: cleanText(app.networkValue || ''),
      source: cleanText(app.source || 'Roadmap Application'),
      submittedAt: toIso(app.submittedAt) || cleanText(app.submittedAt || ''),
      notes: Array.isArray(app.notes) ? app.notes : [],
      applicationType: cleanText(app.applicationType || 'academy-roadmap'),
      reviewLane: cleanText(app.reviewLane || 'Roadmap Access')
    });
  }

  return output;
});

  const academy = [];
  for (const member of members) {
    if (!Array.isArray(member.divisions) || !member.divisions.includes('Academy')) continue;

    try {
      const activeRoadmap = await academyFirestoreRepo.getActiveRoadmap(member.id);
      const missionProgress = await academyFirestoreRepo.getMissionProgress(member.id);

      academy.push({
        id: cleanText(activeRoadmap?.id || `AC-${member.id}`),
        memberId: cleanText(member.id),
        memberName: cleanText(member.name),
        phase: cleanText(activeRoadmap?.roadmap?.weeklyTheme || activeRoadmap?.summary?.primaryBottleneck || 'Academy Active'),
        focus: cleanText((activeRoadmap?.focusAreas || [])[0] || 'General'),
        completion: toNumber(missionProgress?.completionRate, 0),
        lastCheckIn: toIso(missionProgress?.lastCheckinAt || activeRoadmap?.updatedAt) || '',
        status: cleanText(activeRoadmap ? 'On Track' : 'Needs Review'),
        nextAction: cleanText(activeRoadmap?.roadmap?.weeklyTargetOutcome || 'Review roadmap status'),
        notes: []
      });
    } catch (_) {
      academy.push({
        id: `AC-${member.id}`,
        memberId: cleanText(member.id),
        memberName: cleanText(member.name),
        phase: 'Academy Access',
        focus: 'General',
        completion: 0,
        lastCheckIn: '',
        status: 'Needs Review',
        nextAction: 'Check Academy records',
        notes: []
      });
    }
  }

  return {
    ui: {
      currentView: 'overview',
      globalSearch: ''
    },
    settings: {
      allowAutoApproveAcademy: false,
      requireFederationManualReview: true,
      requirePlazaListingReview: true,
      enableAiNudges: true,
      maintenanceMode: false
    },
    roles: [],
    applications,
    members,
    academy,
    federation: [],
    plazas: [],
    support: [],
    broadcasts: [],
    analytics: {
      finance: {
        totalRevenue: 0,
        monthlyRevenue: 0,
        averageOrderValue: 0,
        profitMargin: 0,
        countriesReached: Array.from(new Set(members.map((m) => m.country).filter(Boolean))).length,
        averageReviewDays: 0
      },
      targets: {
        membersGoal: 0,
        federationGoal: 0,
        monthlyRevenueGoal: 0,
        plazasGoal: 0
      },
      monthly: [],
      revenueMix: [],
      regions: []
    }
  };
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
apiRouter.get('/api/admin/bootstrap', requireAdminSession, async (req, res) => {
  try {
    const state = await buildAdminBootstrapPayload();

    return res.json({
      success: true,
      state,
      user: {
        username: req.adminSession.username,
        role: req.adminSession.role
      }
    });
  } catch (error) {
    console.error('admin bootstrap error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load admin bootstrap data.'
    });
  }
});
apiRouter.post('/api/admin/applications/:id/review', requireAdminSession, async (req, res) => {
  try {
    const applicationId = cleanText(req.params.id);
    const rawDecision = cleanText(req.body?.decision || req.body?.action).toLowerCase();

    const decisionMap = {
      approve: 'Approved',
      approved: 'Approved',
      reject: 'Rejected',
      rejected: 'Rejected',
      waitlist: 'Waitlisted',
      waitlisted: 'Waitlisted'
    };

    const nextStatus = decisionMap[rawDecision];
    if (!applicationId || !nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application review request.'
      });
    }

    const matchSnap = await firestore
      .collection('users')
      .where('academyApplication.id', '==', applicationId)
      .limit(1)
      .get();

    if (matchSnap.empty) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const userDoc = matchSnap.docs[0];
    const userData = userDoc.data() || {};
    const existingApp =
      userData.academyApplication && typeof userData.academyApplication === 'object'
        ? userData.academyApplication
        : null;

    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: 'Application record is missing.'
      });
    }

    const nowIso = new Date().toISOString();
    const isAcademyMembership =
      cleanText(existingApp.applicationType).toLowerCase() === 'academy-membership';

    const reviewNote =
      nextStatus === 'Approved'
        ? 'Academy membership approved by admin.'
        : nextStatus === 'Rejected'
          ? 'Academy membership rejected by admin.'
          : 'Academy membership waitlisted by admin.';

    const updatedApplication = {
      ...existingApp,
      status: nextStatus,
      updatedAt: nowIso,
      reviewedAt: nowIso,
      reviewedBy: req.adminSession.username,
      notes: [
        reviewNote,
        ...(Array.isArray(existingApp.notes) ? existingApp.notes : [])
      ]
    };

    const updatePayload = {
      academyApplication: updatedApplication,
      academyApplicationStatus: nextStatus,
      academyApplicationReviewedAt: nowIso,
      academyApplicationReviewedBy: req.adminSession.username,
      updatedAt: nowIso
    };

    if (isAcademyMembership && nextStatus === 'Approved') {
      updatePayload.hasAcademyAccess = true;
      updatePayload.academyMembershipStatus = 'approved';
      updatePayload.academyMembershipApprovedAt = nowIso;
    }

    await userDoc.ref.set(updatePayload, { merge: true });

    return res.json({
      success: true,
      application: updatedApplication
    });
  } catch (error) {
    console.error('admin application review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to review application.'
    });
  }
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