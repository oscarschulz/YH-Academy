const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Timestamp } = require('firebase-admin/firestore');
const { firestore } = require('../config/firebaseAdmin');
const academyFirestoreRepo = require('../backend/repositories/academyFirestoreRepo');
const paymentLedgerRepo = require('../backend/repositories/paymentLedgerRepo');
const { sendSystemMail } = require('../controllers/authControllers');

const ADMIN_SESSION_COOKIE = 'yh_admin_session';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessions = new Map();

function escapeEmailHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAcademyApprovalEmail({ name = 'Member' } = {}) {
  const safeName = escapeEmailHtml(name || 'Member');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Academy Application Approved</title>
</head>
<body style="margin:0; padding:0; background:#030712; font-family:Arial, Helvetica, sans-serif; color:#e5eef8;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background:#030712; border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:660px; width:100%; border-collapse:collapse;">
          <tr>
            <td style="background:#06111f; border:1px solid #16324c; border-radius:20px 20px 0 0; padding:16px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle" style="width:52px;">
                    <img
                      src="https://younghustlersuniverse.com/images/logo.png"
                      alt="YH Universe"
                      width="40"
                      height="40"
                      style="display:block; width:40px; height:40px; border:0;"
                    />
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-size:14px; line-height:1.2; color:#ffffff; font-weight:800; letter-spacing:0.5px;">
                      Young Hustlers Universe
                    </div>
                    <div style="font-size:11px; line-height:1.4; color:#8fa4bf; text-transform:uppercase; letter-spacing:1.6px;">
                      Academy Review Update
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="display:inline-block; padding:7px 12px; border-radius:999px; border:1px solid rgba(16,185,129,0.35); background:rgba(16,185,129,0.12); color:#34d399; font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">
                      Approved
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#08111f; border-left:1px solid #16324c; border-right:1px solid #16324c; padding:0;">
              <div style="height:4px; line-height:4px; font-size:0; background:#0ea5e9;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td style="background:#070d18; border:1px solid #16324c; border-top:0; border-radius:0 0 20px 20px; padding:36px 26px 24px 26px;">
              <h1 style="margin:0 0 14px 0; font-size:30px; line-height:1.2; color:#ffffff; font-weight:800; text-align:center;">
                Your Academy application is approved
              </h1>

              <p style="margin:0 0 18px 0; font-size:15px; line-height:1.8; color:#9fb0c8; text-align:center;">
                Hello ${safeName},
              </p>

              <p style="margin:0 0 18px 0; font-size:15px; line-height:1.8; color:#9fb0c8; text-align:center;">
                Your application to join the Academy inside YH Universe has been approved.
              </p>

              <p style="margin:0 0 18px 0; font-size:15px; line-height:1.8; color:#9fb0c8; text-align:center;">
                You can now return to your dashboard and enter the Academy.
              </p>

              <div style="margin:24px auto 22px auto; max-width:360px; background:#030712; border:1px solid #1c567f; border-radius:18px; padding:16px 18px; text-align:center;">
                <div style="font-size:11px; line-height:1.4; color:#7dd3fc; letter-spacing:1.8px; text-transform:uppercase; font-weight:700; padding-bottom:8px;">
                  Next step
                </div>
                <div style="font-size:18px; line-height:1.5; color:#e5eef8; font-weight:700;">
                  Log in and click “Enter the Academy”
                </div>
              </div>

              <div style="text-align:center; margin:0 auto 22px auto;">
                <a
                  href="https://younghustlersuniverse.com/"
                  style="display:inline-block; background:#0ea5e9; color:#ffffff; text-decoration:none; font-size:14px; line-height:1.4; font-weight:800; padding:13px 22px; border-radius:999px;"
                >
                  Open Young Hustlers Universe
                </a>
                <div style="font-size:12px; line-height:1.7; color:#7f92ab; margin-top:10px;">
                  younghustlersuniverse.com
                </div>
              </div>

              <p style="margin:0; font-size:13px; line-height:1.8; color:#7f92ab; text-align:center;">
                If this message was unexpected, contact support at support@younghustlers.net
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:16px;">
              <p style="margin:0; font-size:12px; line-height:1.8; color:#667892;">
                © YH Universe. Built for ambitious people, structured for scale.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

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
  const env = getEnvConfig();
  const session = readSessionFromRequest(req);

  if (!session) {
    clearSessionCookie(res, env.secureCookies);

    return res.status(401).json({
      success: false,
      message: 'No active admin session.'
    });
  }

  const refreshedSession = {
    ...session,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
  };

  sessions.set(session.id, refreshedSession);
  setSessionCookie(res, session.id, env.secureCookies);

  req.adminSession = refreshedSession;
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

function normalizeAdminNetworkScopeList(values = []) {
  const source = Array.isArray(values) ? values : [values];

  return Array.from(
    new Set(
      source
        .map((value) => cleanText(value).toLowerCase())
        .filter(Boolean)
        .filter((value) => ['academy', 'federation', 'plazas'].includes(value))
    )
  );
}

function normalizeAdminStrategicValue(value = '') {
  const raw = cleanText(value).toLowerCase();

  const allowed = new Set([
    'standard',
    'watch',
    'medium',
    'high',
    'strategic'
  ]);

  return allowed.has(raw) ? raw : 'standard';
}

function buildNextLeadMissionAccessScopes(existingLead = {}, patch = {}) {
  const existingScopes = normalizeAdminNetworkScopeList(
    existingLead.accessScopes ||
    existingLead.networkScopes ||
    []
  );

  const scopes = new Set(existingScopes.length ? existingScopes : ['academy']);
  scopes.add('academy');

  const nextFederationReady =
    Object.prototype.hasOwnProperty.call(patch, 'federationReady')
      ? patch.federationReady === true
      : existingLead.federationReady === true || scopes.has('federation');

  const nextPlazaReady =
    Object.prototype.hasOwnProperty.call(patch, 'plazaReady')
      ? patch.plazaReady === true
      : existingLead.plazaReady === true || scopes.has('plazas');

  if (nextFederationReady) scopes.add('federation');
  else scopes.delete('federation');

  if (nextPlazaReady) scopes.add('plazas');
  else scopes.delete('plazas');

  return {
    accessScopes: Array.from(scopes),
    federationReady: nextFederationReady,
    plazaReady: nextPlazaReady
  };
}

function normalizeStringList(value) {
  const source = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      source
        .map((item) => cleanText(item).toLowerCase())
        .filter(Boolean)
    )
  );
}

function buildAdminLeadMissionProjection(lead = {}, member = {}, payouts = [], deals = []) {
  const leadId = cleanText(lead.id);
  const relatedPayouts = payouts.filter((item) => cleanText(item.leadId) === leadId);
  const relatedDeals = deals.filter((item) => cleanText(item.leadId) === leadId);

  const accessScopes = normalizeStringList([
    ...(Array.isArray(lead.accessScopes) ? lead.accessScopes : []),
    ...(Array.isArray(lead.networkScopes) ? lead.networkScopes : []),
    'academy',
    lead.federationReady === true ? 'federation' : '',
    lead.plazaReady === true ? 'plazas' : ''
  ]);

  const approvedPayoutTotal = relatedPayouts.reduce((sum, item) => {
    const status = cleanText(item.status).toLowerCase();
    if (status === 'approved' || status === 'paid') {
      return sum + toNumber(item.amount, 0);
    }
    return sum;
  }, 0);

  const grossDealTotal = relatedDeals.reduce((sum, item) => {
    return sum + toNumber(item.grossValue, 0);
  }, 0);

  return {
    id: leadId,
    ownerUid: cleanText(member.id),
    memberId: cleanText(member.id),
    memberName: cleanText(member.name),
    operatorName: cleanText(member.name),
    sourceDivision: cleanText(lead.sourceDivision || 'academy') || 'academy',
    sourceFeature: cleanText(lead.sourceFeature || ''),
    sourceRecordId: cleanText(lead.sourceRecordId || ''),
    sourceRecordPath: cleanText(lead.sourceRecordPath || ''),
    routedFromAdmin: lead.routedFromAdmin === true,
    routedSourceTitle: cleanText(lead.routedSourceTitle || ''),
    assignedByAdmin: cleanText(lead.assignedByAdmin || ''),
    assignedAt: toIso(lead.assignedAt) || cleanText(lead.assignedAt || ''),
    assignmentStatus: cleanText(lead.assignmentStatus || ''),
    missionType: cleanText(lead.missionType || ''),
    missionBrief: cleanText(lead.missionBrief || ''),
    academyMissionNeed: cleanText(lead.academyMissionNeed || ''),
    opportunityOwnerName: cleanText(lead.opportunityOwnerName || ''),
    opportunityValueAmount: toNumber(lead.opportunityValueAmount, 0),
    platformCommissionRate: toNumber(lead.platformCommissionRate, 0),
    platformCommissionAmount: toNumber(lead.platformCommissionAmount, 0),
    operatorPayoutAmount: toNumber(lead.operatorPayoutAmount, 0),

    accessScopes: accessScopes.length ? accessScopes : ['academy'],
    federationReady: accessScopes.includes('federation'),
    plazaReady: accessScopes.includes('plazas'),
    networkTags: normalizeStringList(lead.networkTags || lead.tags || []),
    strategicValue: cleanText(lead.strategicValue || 'standard'),

    tier: cleanText(lead.tier),
    companyName: cleanText(lead.companyName),
    companyWebsite: cleanText(lead.companyWebsite),
    contactName: cleanText(lead.contactName),
    contactRole: cleanText(lead.contactRole),
    contactType: cleanText(lead.contactType || 'unknown'),
    email: cleanText(lead.email),
    phone: cleanText(lead.phone),
    city: cleanText(lead.city),
    country: cleanText(lead.country),
    sourceMethod: cleanText(lead.sourceMethod),
    callOutcome: cleanText(lead.callOutcome),
    interestLevel: cleanText(lead.interestLevel),
    rapportLevel: cleanText(lead.rapportLevel),
    pipelineStage: cleanText(lead.pipelineStage),
    priority: cleanText(lead.priority),
    nextAction: cleanText(lead.nextAction),
    channel: cleanText(lead.channel),
    taskStatus: cleanText(lead.taskStatus),
    callType: cleanText(lead.callType),
    objection: cleanText(lead.objection),
    notes: cleanText(lead.notes),
    followUpDueDate: cleanText(lead.followUpDueDate),
    status: cleanText(lead.status || 'active'),
    createdAt: toIso(lead.createdAt) || cleanText(lead.createdAt || ''),
    updatedAt: toIso(lead.updatedAt) || cleanText(lead.updatedAt || ''),

    payoutCount: relatedPayouts.length,
    dealCount: relatedDeals.length,
    approvedPayoutTotal,
    grossDealTotal
  };
}

function buildAdminEconomySummary(paymentLedger = [], payoutLedger = []) {
  const payments = Array.isArray(paymentLedger) ? paymentLedger : [];
  const payouts = Array.isArray(payoutLedger) ? payoutLedger : [];

  const paidPayments = payments.filter((payment) => {
    return cleanText(payment.status).toLowerCase() === 'paid';
  });

  const pendingPayments = payments.filter((payment) => {
    const status = cleanText(payment.status).toLowerCase();
    return ['draft', 'checkout_started', 'pending'].includes(status);
  });

  const pendingPayouts = payouts.filter((payout) => {
    const status = cleanText(payout.status).toLowerCase();
    return ['pending_review', 'approved', 'processing'].includes(status);
  });

  const paidPayouts = payouts.filter((payout) => {
    return cleanText(payout.status).toLowerCase() === 'paid';
  });

  const sumField = (records = [], field = 'amount') => {
    return records.reduce((total, record) => {
      const amount = toNumber(record?.[field], 0);
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  };

  const providerCounts = payments.reduce((acc, payment) => {
    const provider = cleanText(payment.provider || 'unselected').toLowerCase() || 'unselected';
    acc[provider] = (acc[provider] || 0) + 1;
    return acc;
  }, {});

  return {
    paymentCount: payments.length,
    paidPaymentCount: paidPayments.length,
    pendingPaymentCount: pendingPayments.length,

    payoutCount: payouts.length,
    pendingPayoutCount: pendingPayouts.length,
    paidPayoutCount: paidPayouts.length,

    grossRevenue: sumField(payments, 'amount'),
    paidRevenue: sumField(paidPayments, 'amount'),
    universeCommission: sumField(paidPayments, 'platformCommissionAmount'),
    operatorPayouts: sumField(payments, 'operatorPayoutAmount'),
    paidOperatorPayouts: sumField(paidPayouts, 'amount'),

    providerCounts
  };
}

function mapAdminFederationConnectionRequestDoc(doc) {
  const data = doc.data() || {};
  const snapshot =
    data.opportunitySnapshot && typeof data.opportunitySnapshot === 'object'
      ? data.opportunitySnapshot
      : {};

  const dealPackage =
    data.dealPackage && typeof data.dealPackage === 'object'
      ? data.dealPackage
      : {};

  const pricingAmount = toNumber(dealPackage.pricingAmount || data.pricingAmount, 0);
  const platformCommissionRate = toNumber(dealPackage.platformCommissionRate || data.platformCommissionRate, 0);
  const platformCommissionAmount = toNumber(dealPackage.platformCommissionAmount || data.platformCommissionAmount, 0);
  const operatorPayoutAmount = toNumber(dealPackage.operatorPayoutAmount || data.operatorPayoutAmount, 0);

  return {
    id: cleanText(doc.id),
    requesterUid: cleanText(data.requesterUid),
    requesterName: cleanText(data.requesterName || 'Federation Member'),
    requesterEmail: cleanText(data.requesterEmail),

    ownerUid: cleanText(data.ownerUid || snapshot.ownerUid),
    leadId: cleanText(data.leadId || snapshot.leadId),
    leadPath: cleanText(data.leadPath),

    requestMode: cleanText(data.requestMode || (data.leadId ? 'selected_lead' : 'match_request')),
    requestedContact: data.requestedContact && typeof data.requestedContact === 'object'
      ? data.requestedContact
      : null,

    matchedAt: toIso(data.matchedAt) || cleanText(data.matchedAt || ''),
    matchedBy: cleanText(data.matchedBy || ''),

    opportunityId: cleanText(data.opportunityId || snapshot.id),
    opportunityTitle: cleanText(data.opportunityTitle || snapshot.title || 'Connection request'),

    status: cleanText(data.status || 'pending_admin_match'),
    adminStatus: cleanText(data.adminStatus || 'pending_review'),

    pricingAmount,
    currency: cleanText(dealPackage.currency || data.currency || 'USD').toUpperCase() || 'USD',
    platformCommissionRate,
    platformCommissionAmount,
    operatorPayoutAmount,
    paymentStatus: cleanText(dealPackage.paymentStatus || data.paymentStatus || 'not_started'),
    payoutStatus: cleanText(data.payoutStatus || dealPackage.payoutStatus || 'not_started'),
    commissionStatus: cleanText(data.commissionStatus || dealPackage.commissionStatus || 'not_started'),
    dealNotes: cleanText(dealPackage.dealNotes || data.dealNotes || ''),

    budgetRange: cleanText(data.budgetRange || 'not_sure'),
    urgency: cleanText(data.urgency || 'normal'),
    preferredIntroType: cleanText(data.preferredIntroType || 'admin_brokered'),
    requestReason: cleanText(data.requestReason),
    intendedUse: cleanText(data.intendedUse),
    notes: cleanText(data.notes),

    sourceDivision: cleanText(data.sourceDivision || 'federation'),
    sourceFeature: cleanText(data.sourceFeature || 'connect'),
    category: cleanText(snapshot.category || snapshot.contactType || ''),
    contactRole: cleanText(snapshot.contactRole || ''),
    city: cleanText(snapshot.city || ''),
    country: cleanText(snapshot.country || ''),
    strategicValue: cleanText(snapshot.strategicValue || 'standard'),

    createdAt: toIso(data.createdAt) || cleanText(data.createdAt || ''),
    updatedAt: toIso(data.updatedAt) || cleanText(data.updatedAt || '')
  };
}

function mapAdminFederationDealRoomDoc(doc) {
  const data = doc.data() || {};

  const expectedValueAmount = toNumber(data.expectedValueAmount, 0);
  const platformCommissionRate = Math.max(0, Math.min(100, toNumber(data.platformCommissionRate, 20)));
  const platformCommissionAmount = toNumber(
    data.platformCommissionAmount,
    expectedValueAmount > 0 ? Math.round((expectedValueAmount * platformCommissionRate) / 100) : 0
  );

  return {
    id: cleanText(doc.id),
    title: cleanText(data.title || 'Federation Deal Room'),
    roomType: cleanText(data.roomType || data.type || 'partnership'),
    description: cleanText(data.description || data.text || ''),
    partnerNeed: cleanText(data.partnerNeed || ''),
    expectedValueAmount,
    currency: cleanText(data.currency || 'USD').toUpperCase() || 'USD',
    platformCommissionRate,
    platformCommissionAmount,
    adminStatus: cleanText(data.adminStatus || 'pending_admin_review'),
    dealStatus: cleanText(data.dealStatus || 'proposed'),
    commissionStatus: cleanText(data.commissionStatus || 'pending'),
    sourceDivision: cleanText(data.sourceDivision || 'federation'),
    sourceFeature: cleanText(data.sourceFeature || 'deal_rooms'),
    creatorUid: cleanText(data.creatorUid),
    creatorName: cleanText(data.creatorName || 'Federation Member'),
    creatorEmail: cleanText(data.creatorEmail),
    participantUids: Array.isArray(data.participantUids)
      ? data.participantUids.map((item) => cleanText(item)).filter(Boolean)
      : [],
    linkedPlazaOpportunityId: cleanText(data.linkedPlazaOpportunityId),
    academyMissionNeed: cleanText(data.academyMissionNeed),
    adminNotes: cleanText(data.adminNotes),
    createdAt: toIso(data.createdAt) || cleanText(data.createdAt || ''),
    updatedAt: toIso(data.updatedAt) || cleanText(data.updatedAt || '')
  };
}

function normalizeAdminPlazaStatus(value = '') {
  const raw = cleanText(value || 'pending_review').toLowerCase();

  if (raw === 'active' || raw === 'approved') return 'Active';
  if (raw === 'flagged') return 'Flagged';
  if (raw === 'archived') return 'Archived';
  if (raw === 'pending review' || raw === 'pending_review' || raw === 'review') return 'Pending Review';

  return 'Pending Review';
}

function mapAdminPlazaListingDoc(doc) {
  const data = doc.data() || {};

  const budgetMin = toNumber(data.budgetMin, 0);
  const budgetMax = toNumber(data.budgetMax, 0);
  const commissionRate = toNumber(data.commissionRate, 0);
  const rawStatus = cleanText(data.status || data.reviewStatus || 'pending_review');

  return {
    id: cleanText(doc.id),
    title: cleanText(data.title || 'Plaza opportunity'),
    owner: cleanText(data.authorName || data.member || data.ownerName || 'Plaza Member'),
    ownerUid: cleanText(data.authorId || data.createdByUserId || data.ownerUid),
    ownerEmail: cleanText(data.authorEmail || data.ownerEmail),
    type: cleanText(data.type || 'Opportunity'),
    status: normalizeAdminPlazaStatus(rawStatus),
    rawStatus,
    reports: toNumber(data.reports, 0),
    region: cleanText(data.region || 'Global'),
    featured: data.featured === true,
    text: cleanText(data.text || data.description || ''),
    economyMode: cleanText(data.economyMode || data.compensationType || 'not_sure'),
    currency: cleanText(data.currency || 'USD').toUpperCase() || 'USD',
    budgetMin,
    budgetMax,
    commissionRate,
    federationEscalation: cleanText(data.federationEscalation || 'none'),
    monetizationNote: cleanText(data.monetizationNote || ''),
    sourceDivision: cleanText(data.sourceDivision || 'plaza'),
    sourceFeature: cleanText(data.sourceFeature || 'opportunities'),
    createdAt: toIso(data.createdAt) || cleanText(data.createdAt || ''),
    updatedAt: toIso(data.updatedAt) || cleanText(data.updatedAt || ''),
    notes: Array.isArray(data.notes) ? data.notes : []
  };
}

async function buildAdminBootstrapPayload() {
  const [usersSnap, broadcastsSnap, paymentLedgerResult, payoutLedgerResult] = await Promise.all([
    firestore.collection('users').limit(300).get(),
    firestore.collection('adminBroadcasts').orderBy('sentAt', 'desc').limit(100).get().catch(() => ({ docs: [] })),
    paymentLedgerRepo.listAdminPaymentRecords(500).catch(() => []),
    paymentLedgerRepo.listAdminPayoutRecords(500).catch(() => [])
  ]);

  const users = usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() || {})
  }));

  const broadcasts = Array.isArray(broadcastsSnap.docs)
    ? broadcastsSnap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          audience: cleanText(data.audience),
          subject: cleanText(data.subject),
          message: cleanText(data.message),
          sentAt: toIso(data.sentAt) || cleanText(data.sentAt || '')
        };
      })
    : [];
  const paymentLedger = Array.isArray(paymentLedgerResult) ? paymentLedgerResult : [];
  const payoutLedger = Array.isArray(payoutLedgerResult) ? payoutLedgerResult : [];

  const members = users.map((user) => {
    const stats = user.stats || {};
    const academyDivisions = [];

    const academyMembershipStatus = cleanText(
      user.academyMembershipStatus ||
      user.academyApplicationStatus ||
      user.academyApplication?.status ||
      ''
    ).toLowerCase();

    const roadmapApplicationStatus = cleanText(
      user.roadmapApplicationStatus ||
      user.roadmapApplication?.status ||
      ''
    );

    const hasApprovedAcademyMembership =
      academyMembershipStatus === 'approved' ||
      user.hasAcademyAccess === true;

    const hasRoadmapAccess = user.accessState === 'unlocked';

    if (hasApprovedAcademyMembership) {
      academyDivisions.push('Academy');
    }

    const federationMembershipStatus = cleanText(
      user.federationMembershipStatus ||
      user.federationApplicationStatus ||
      user.federationApplication?.status ||
      ''
    ).toLowerCase();

    const hasApprovedFederationMembership =
      federationMembershipStatus === 'approved' ||
      user.hasFederationAccess === true;

    if (hasApprovedFederationMembership && !academyDivisions.includes('Federation')) {
      academyDivisions.push('Federation');
    }

    const plazaMembershipStatus = cleanText(
      user.plazaMembershipStatus ||
      user.plazaAccessStatus ||
      user.plazaApplicationStatus ||
      user.plazaApplication?.status ||
      ''
    ).toLowerCase();

    const hasApprovedPlazaMembership =
      plazaMembershipStatus === 'approved' ||
      user.hasPlazaAccess === true;

    if (hasApprovedPlazaMembership && !academyDivisions.includes('Plazas')) {
      academyDivisions.push('Plazas');
    }

    let roadmapStatus = 'Not in Academy';

    if (hasApprovedAcademyMembership) {
      if (hasRoadmapAccess) {
        roadmapStatus = 'Roadmap live';
      } else {
        roadmapStatus = 'Ready for roadmap setup';
      }
    }

    return {
      id: cleanText(user.id),
      name: cleanText(user.fullName || user.name || user.displayName || user.username || 'Unknown User'),
      username: cleanText(user.username ? `@${String(user.username).replace(/^@/, '')}` : ''),
      email: cleanText(user.email || ''),
      divisions: academyDivisions,
      status: cleanText(user.status || user.memberStatus || 'Active'),
      activityScore: toNumber(stats.repPoints, 0),
      roadmapStatus,
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
    const profile =
      app.academyProfile && typeof app.academyProfile === 'object'
        ? app.academyProfile
        : {};

    const username = cleanText(
      app.username ||
      user.username ||
      ''
    ).replace(/^@+/, '');

    output.push({
      id: cleanText(app.id || `APP-${user.id}`),
      name: cleanText(
        app.fullName ||
        app.name ||
        profile.fullName ||
        user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Unknown User'
      ),
      username: username ? `@${username}` : '',
      email: cleanText(app.email || user.email || ''),
      goal: cleanText(app.goal || app.occupationAtAge || profile.occupationAtAge || ''),
      background: cleanText(app.background || profile.skills || ''),
      recommendedDivision: cleanText(app.recommendedDivision || 'Academy'),
      status: cleanText(app.status || 'Under Review'),
      aiScore: toNumber(app.aiScore, 0),
      country: cleanText(app.country || profile.locationCountry || user.country || ''),
      locationCountry: cleanText(app.locationCountry || profile.locationCountry || ''),
      skills: Array.isArray(app.skills) && app.skills.length
        ? app.skills
        : (
            Array.isArray(profile.topSkills) && profile.topSkills.length
              ? profile.topSkills
              : []
          ),
      networkValue: cleanText(app.networkValue || ''),
      source: cleanText(app.source || 'Academy Application'),
      submittedAt: toIso(app.submittedAt) || cleanText(app.submittedAt || ''),
      notes: Array.isArray(app.notes) ? app.notes : [],
      applicationType: cleanText(app.applicationType || 'academy-membership'),
      reviewLane: cleanText(app.reviewLane || 'Academy Membership'),

      age: cleanText(app.age || profile.age || ''),
      occupationAtAge: cleanText(app.occupationAtAge || profile.occupationAtAge || ''),
      referredByUsername: cleanText(app.referredByUsername || profile.referredByUsername || ''),
      hearAboutUs: cleanText(app.hearAboutUs || profile.hearAboutUs || ''),
      seriousness: cleanText(app.seriousness || profile.seriousness || ''),
      nonNegotiable: cleanText(app.nonNegotiable || profile.nonNegotiable || ''),
      academyProfile: profile
    });
  }

  if (user.federationApplication && typeof user.federationApplication === 'object') {
    const app = user.federationApplication;

    output.push({
      id: cleanText(app.id || `FED-APP-${user.id}`),
      name: cleanText(
        app.fullName ||
        app.name ||
        user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Unknown Federation Applicant'
      ),
      username: cleanText(app.username || user.username || '').replace(/^@+/, ''),
      email: cleanText(app.email || user.email || ''),
      goal: cleanText(app.goal || app.wantedContactReason || 'Federation access request'),
      background: cleanText(app.background || [app.role, app.company, app.primaryCategory, app.city, app.country].filter(Boolean).join(' • ')),
      recommendedDivision: 'Federation',
      status: cleanText(app.status || user.federationApplicationStatus || 'Under Review'),
      aiScore: toNumber(app.aiScore, 0),
      country: cleanText(app.country || user.country || ''),
      locationCountry: cleanText(app.country || user.country || ''),
      skills: Array.isArray(app.skills) ? app.skills : [],
      networkValue: cleanText(app.networkValue || app.valueBring || ''),
      source: cleanText(app.source || 'Dashboard Federation Application'),
      submittedAt: toIso(app.submittedAt) || cleanText(app.submittedAt || ''),
      notes: Array.isArray(app.notes) ? app.notes : [],
      applicationType: 'federation-access',
      reviewLane: 'Federation Access',

      role: cleanText(app.role || app.profession || ''),
      profession: cleanText(app.profession || app.role || ''),
      city: cleanText(app.city || ''),
      company: cleanText(app.company || ''),
      primaryCategory: cleanText(app.primaryCategory || ''),
      telegram: cleanText(app.telegram || ''),
      profileLink: cleanText(app.profileLink || ''),
      valueBring: cleanText(app.valueBring || ''),
      accessContribution: cleanText(app.accessContribution || ''),
      regionsOfAccess: cleanText(app.regionsOfAccess || ''),
      lookingForContact: cleanText(app.lookingForContact || ''),
      wantedContactTypes: Array.isArray(app.wantedContactTypes) ? app.wantedContactTypes : [],
      wantedContactRegion: cleanText(app.wantedContactRegion || ''),
      wantedContactReason: cleanText(app.wantedContactReason || ''),
      contactUrgency: cleanText(app.contactUrgency || ''),
      canProvideContacts: cleanText(app.canProvideContacts || ''),
      contactTypesCanProvide: Array.isArray(app.contactTypesCanProvide) ? app.contactTypesCanProvide : [],
      supplyRegions: cleanText(app.supplyRegions || ''),
      openToAdminMatching: cleanText(app.openToAdminMatching || '')
    });
  }
  if (user.plazaApplication && typeof user.plazaApplication === 'object') {
    const app = user.plazaApplication;

    output.push({
      id: cleanText(app.id || `PLAZA-APP-${user.id}`),
      name: cleanText(
        app.fullName ||
        app.name ||
        user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Unknown Plaza Applicant'
      ),
      username: cleanText(app.username || user.username || '').replace(/^@+/, ''),
      email: cleanText(app.email || user.email || ''),
      goal: cleanText(app.currentProject || 'Plaza access request'),
      background: cleanText(
        app.resourcesNeeded ||
        app.contribution ||
        [
          app.membershipDivisionLabel,
          app.country,
          app.wantsPatron === 'yes' ? 'Patrón / Leader track' : '',
          app.wantsMarketplace === 'yes' ? 'Marketplace provider' : ''
        ].filter(Boolean).join(' • ')
      ),
      recommendedDivision: 'Plazas',
      status: cleanText(app.status || user.plazaApplicationStatus || 'Under Review'),
      aiScore: toNumber(app.aiScore, 0),
      country: cleanText(app.country || user.country || ''),
      locationCountry: cleanText(app.country || user.country || ''),
      skills: Array.isArray(app.tags) ? app.tags : [],
      networkValue: cleanText(app.contribution || app.resourcesNeeded || ''),
      source: cleanText(app.source || 'Dashboard Plaza Application'),
      submittedAt: toIso(app.submittedAt) || cleanText(app.submittedAt || ''),
      notes: Array.isArray(app.notes) ? app.notes : [],
      applicationType: 'plaza-access',
      reviewLane: 'Plaza Access',

      membershipType: cleanText(app.membershipType || ''),
      membershipDivisionLabel: cleanText(app.membershipDivisionLabel || ''),
      age: cleanText(app.age || ''),
      currentProject: cleanText(app.currentProject || ''),
      resourcesNeeded: cleanText(app.resourcesNeeded || ''),
      joinedAt: cleanText(app.joinedAt || ''),
      learntSoFar: cleanText(app.learntSoFar || ''),
      contribution: cleanText(app.contribution || ''),
      wantsPatron: cleanText(app.wantsPatron || ''),
      patronExpectation: cleanText(app.patronExpectation || ''),
      leadershipExperience: cleanText(app.leadershipExperience || ''),
      wantsMarketplace: cleanText(app.wantsMarketplace || ''),
      servicesProducts: cleanText(app.servicesProducts || ''),
      referredByUsername: cleanText(app.referredBy || ''),
      hearAboutUs: cleanText(app.howHeard || ''),
      occupationAtAge: cleanText(app.currentProject || ''),
      seriousness: cleanText(app.resourcesNeeded || ''),
      nonNegotiable: cleanText(app.contribution || '')
    });
  }
  // Roadmap applications are no longer part of the manual admin review queue.

  return output;
});

  const academy = [];
  const academyLeadMissions = [];
  const academyMembers = members.filter((member) => {
    return Array.isArray(member.divisions) && member.divisions.includes('Academy');
  });

  for (const member of academyMembers) {
    const sourceUser = users.find((u) => cleanText(u.id) === cleanText(member.id)) || {};

    try {
      const activeRoadmap = await academyFirestoreRepo.getActiveRoadmap(member.id);
      const missionProgress = await academyFirestoreRepo.getMissionProgress(member.id);

      let recentCoachMessages = [];
      try {
        recentCoachMessages = await academyFirestoreRepo.listCoachMessages(member.id, 'coach_main', 6);
      } catch (_) {
        recentCoachMessages = [];
      }

      const assistantCoachMessages = recentCoachMessages.filter((message) => {
        return cleanText(message?.role || '').toLowerCase() === 'assistant';
      });

      const latestCoachMessage =
        assistantCoachMessages[assistantCoachMessages.length - 1] ||
        recentCoachMessages[recentCoachMessages.length - 1] ||
        null;

      academy.push({
        id: cleanText(activeRoadmap?.id || `AC-${member.id}`),
        memberId: cleanText(member.id),
        memberName: cleanText(member.name),
        phase: cleanText(activeRoadmap?.roadmap?.weeklyTheme || activeRoadmap?.summary?.primaryBottleneck || 'Academy Active'),
        focus: cleanText((activeRoadmap?.focusAreas || [])[0] || 'General'),
        completion: toNumber(missionProgress?.completionRate, 0),
        lastCheckIn: cleanText(sourceUser?.adminAcademyLastCheckIn) || toIso(missionProgress?.lastCheckinAt || activeRoadmap?.updatedAt) || '',
        status: cleanText(sourceUser?.adminAcademyStatus || (activeRoadmap ? 'On Track' : 'Needs Review')),
        nextAction: cleanText(activeRoadmap?.roadmap?.weeklyTargetOutcome || 'Review roadmap status'),

        recentCoachMessages,
        latestReplyFormat: cleanText(
          latestCoachMessage?.replyFormat ||
          latestCoachMessage?.reply_format ||
          'general'
        ),
        latestCoachModeKey: cleanText(
          latestCoachMessage?.coachModeKey ||
          latestCoachMessage?.coach_mode_key ||
          'general'
        ),
        responseStyleVersion: cleanText(
          latestCoachMessage?.responseStyleVersion ||
          latestCoachMessage?.response_style_version ||
          ''
        ),
        latestCoachReply: cleanText(latestCoachMessage?.text || ''),

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

        recentCoachMessages: [],
        latestReplyFormat: 'general',
        latestCoachModeKey: 'general',
        responseStyleVersion: '',
        latestCoachReply: '',

        notes: []
      });
    }
  }

    for (const member of academyMembers) {
    try {
      const [leads, payouts, deals] = await Promise.all([
        academyFirestoreRepo.listLeadMissionLeads(member.id),
        academyFirestoreRepo.listLeadMissionPayouts(member.id),
        academyFirestoreRepo.listLeadMissionDeals(member.id)
      ]);

      leads.forEach((lead) => {
        academyLeadMissions.push(
          buildAdminLeadMissionProjection(lead, member, payouts, deals)
        );
      });
    } catch (_) {
      // Keep bootstrap resilient even if a member has no lead mission records yet.
    }
  }

  let federationConnectionRequests = [];

  try {
    const requestSnap = await firestore
      .collection('federationConnectionRequests')
      .limit(300)
      .get();

    federationConnectionRequests = requestSnap.docs
      .map((doc) => mapAdminFederationConnectionRequestDoc(doc))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch (_) {
    federationConnectionRequests = [];
  }

  let federationDealRooms = [];

  try {
    const dealRoomsSnap = await firestore
      .collection('federationDealRooms')
      .limit(300)
      .get();

    federationDealRooms = dealRoomsSnap.docs
      .map((doc) => mapAdminFederationDealRoomDoc(doc))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch (_) {
    federationDealRooms = [];
  }

  let plazas = [];

  try {
    const plazaListingsSnap = await firestore
      .collection('plazaOpportunities')
      .limit(300)
      .get();

    plazas = plazaListingsSnap.docs
      .map((doc) => mapAdminPlazaListingDoc(doc))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch (_) {
    plazas = [];
  }

  const federationLeadDatabase = academyLeadMissions
    .filter((lead) => {
      const scopes = Array.isArray(lead.accessScopes) ? lead.accessScopes : [];
      return lead.federationReady === true || scopes.includes('federation');
    })
    .sort((a, b) => {
      const rank = { strategic: 5, high: 4, medium: 3, watch: 2, standard: 1 };
      const aRank = rank[String(a.strategicValue || '').toLowerCase()] || 0;
      const bRank = rank[String(b.strategicValue || '').toLowerCase()] || 0;
      if (aRank !== bRank) return bRank - aRank;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

  const federationCandidates = users
    .filter((user) => user.federationApplication && typeof user.federationApplication === 'object')
    .map((user) => {
      const app = user.federationApplication || {};
      const status = cleanText(app.status || user.federationApplicationStatus || 'Under Review');

      return {
        id: cleanText(app.id || `FED-${user.id}`),
        userId: cleanText(user.id),
        sourceApplicationId: cleanText(app.id || `FED-APP-${user.id}`),
        name: cleanText(app.fullName || app.name || user.fullName || user.name || user.username || 'Federation Applicant'),
        email: cleanText(app.email || user.email || ''),
        profession: cleanText(app.profession || app.role || 'Operator'),
        region: cleanText(app.region || [app.city, app.country].filter(Boolean).join(', ')),
        status,
        influence: toNumber(app.influence, 0),
        tag: cleanText(app.primaryCategory || 'Operator'),
        createdAt: toIso(app.createdAt) || cleanText(app.createdAt || ''),
        updatedAt: toIso(app.updatedAt) || cleanText(app.updatedAt || '')
      };
    });

  const economySummary = buildAdminEconomySummary(paymentLedger, payoutLedger);

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
    academyLeadMissions,
    federationLeadDatabase,
    federationConnectionRequests,
    federationDealRooms,
    paymentLedger,
    payoutLedger,
    economy: economySummary,
    federation: [],
    plazas,
    support: [],
    broadcasts,
    analytics: {
      finance: {
        totalRevenue: economySummary.paidRevenue || 0,
        monthlyRevenue: economySummary.paidRevenue || 0,
        averageOrderValue: economySummary.paidPaymentCount
          ? Math.round((economySummary.paidRevenue || 0) / economySummary.paidPaymentCount)
          : 0,
        profitMargin: economySummary.paidRevenue
          ? Math.round(((economySummary.universeCommission || 0) / economySummary.paidRevenue) * 100)
          : 0,
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

apiRouter.post('/api/admin/economy/payouts/:payoutId/status', requireAdminSession, async (req, res) => {
  try {
    const payoutId = cleanText(req.params.payoutId);
    const status = cleanText(req.body?.status);
    const adminNote = cleanText(req.body?.adminNote || '');

    if (!payoutId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing payout id or status.'
      });
    }

    const updatedPayout = await paymentLedgerRepo.updatePayoutRecordStatus(payoutId, {
      status,
      adminNote
    });

    return res.json({
      success: true,
      payout: updatedPayout
    });
  } catch (error) {
    console.error('admin payout status update error:', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update payout request.'
    });
  }
});

const USER_REVIEW_NOTIFICATION_LIMIT = 40;

function getApplicationReviewNotificationMeta(matchedField = '', nextStatus = '') {
  const field = cleanText(matchedField);
  const status = cleanText(nextStatus).toLowerCase();

  if (field === 'federationApplication') {
    if (status === 'approved') {
      return {
        title: 'Federation application approved',
        text: 'You now have Federation access. Open Federation and activate your strategic layer.',
        target: 'federation-status',
        color: 'var(--green)',
        avatarStr: 'F'
      };
    }

    if (status === 'waitlisted') {
      return {
        title: 'Federation application waitlisted',
        text: 'Your candidacy is still alive, but you need stronger Plaza outcomes and proof before the next review cycle.',
        target: 'federation-status',
        color: 'var(--amber)',
        avatarStr: 'F'
      };
    }

    if (status === 'rejected') {
      return {
        title: 'Federation application not approved',
        text: 'Your current Federation application was not approved. Strengthen your Plaza signal and reapply with stronger leverage.',
        target: 'federation-status',
        color: 'var(--red)',
        avatarStr: 'F'
      };
    }

    return {
      title: 'Federation application updated',
      text: `Your Federation application is now ${cleanText(nextStatus) || 'Under Review'}.`,
      target: 'federation-status',
      color: 'var(--blue)',
      avatarStr: 'F'
    };
  }

  if (field === 'plazaApplication') {
    if (status === 'approved') {
      return {
        title: 'Plaza application approved',
        text: 'You can now enter Plaza. Complete your directory profile and activate your opportunity layer.',
        target: 'plaza-status',
        color: 'var(--green)',
        avatarStr: 'P'
      };
    }

    if (status === 'waitlisted') {
      return {
        title: 'Plaza application waitlisted',
        text: 'Your Plaza application is waitlisted. Improve your Academy profile and economic signal before the next review.',
        target: 'plaza-status',
        color: 'var(--amber)',
        avatarStr: 'P'
      };
    }

    if (status === 'rejected') {
      return {
        title: 'Plaza application not approved',
        text: 'Your Plaza application was not approved. You can submit a stronger application when your signal is clearer.',
        target: 'plaza-status',
        color: 'var(--red)',
        avatarStr: 'P'
      };
    }

    return {
      title: 'Plaza application updated',
      text: `Your Plaza application is now ${cleanText(nextStatus) || 'Under Review'}.`,
      target: 'plaza-status',
      color: 'var(--blue)',
      avatarStr: 'P'
    };
  }

  if (field === 'academyApplication') {
    if (status === 'approved') {
      return {
        title: 'Academy application approved',
        text: 'You now have Academy access. Enter Academy and continue building your roadmap and execution signal.',
        target: 'academy',
        color: 'var(--green)',
        avatarStr: 'A'
      };
    }

    if (status === 'waitlisted') {
      return {
        title: 'Academy application waitlisted',
        text: 'Your Academy application is waitlisted. Refine your entry signal before the next review cycle.',
        target: 'academy',
        color: 'var(--amber)',
        avatarStr: 'A'
      };
    }

    if (status === 'rejected') {
      return {
        title: 'Academy application not approved',
        text: 'Your Academy application was not approved. You can return with a stronger application later.',
        target: 'academy',
        color: 'var(--red)',
        avatarStr: 'A'
      };
    }

    return {
      title: 'Academy application updated',
      text: `Your Academy application is now ${cleanText(nextStatus) || 'Under Review'}.`,
      target: 'academy',
      color: 'var(--blue)',
      avatarStr: 'A'
    };
  }

  return {
    title: 'Application updated',
    text: `Your application is now ${cleanText(nextStatus) || 'Under Review'}.`,
    target: 'dashboard',
    color: 'var(--blue)',
    avatarStr: 'Y'
  };
}

function buildApplicationReviewNotification({ matchedField = '', nextStatus = '', application = {}, nowIso = '' } = {}) {
  const meta = getApplicationReviewNotificationMeta(matchedField, nextStatus);

  return {
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title,
    text: meta.text,
    message: meta.text,
    body: meta.text,
    target: meta.target,
    targetType: meta.target,
    target_type: meta.target,
    targetId: cleanText(application.id || ''),
    target_id: cleanText(application.id || ''),
    color: meta.color,
    avatarStr: meta.avatarStr,
    initial: meta.avatarStr,
    source: 'admin-review',
    notificationType: 'application-review',
    applicationField: cleanText(matchedField),
    applicationStatus: cleanText(nextStatus),
    isRead: false,
    is_read: false,
    read: false,
    createdAt: nowIso,
    created_at: nowIso
  };
}

function prependUserInProductNotification(existing = [], notification = null) {
  const current = Array.isArray(existing) ? existing : [];
  const next = notification && typeof notification === 'object'
    ? [notification, ...current]
    : current;

  return next.slice(0, USER_REVIEW_NOTIFICATION_LIMIT);
}

function getFederationConnectionRequestNotificationMeta(request = {}, action = 'status') {
  const opportunityTitle = cleanText(request.opportunityTitle || 'your connection request');
  const currency = cleanText(request.currency || 'USD').toUpperCase() || 'USD';
  const pricingAmount = toNumber(request.pricingAmount, 0);
  const status = cleanText(request.status).toLowerCase();
  const paymentStatus = cleanText(request.paymentStatus).toLowerCase();

  if (action === 'match') {
    return {
      title: 'Federation request matched',
      text: `Admin matched ${opportunityTitle}. Open My Requests to review the routed opportunity and next step.`,
      color: 'var(--green)',
      avatarStr: 'F'
    };
  }

  if (action === 'deal-package') {
    if (paymentStatus === 'paid' || status === 'paid') {
      return {
        title: 'Federation request marked paid',
        text: `Your deal package for ${opportunityTitle} is marked paid. Open My Requests to continue from the live transaction state.`,
        color: 'var(--green)',
        avatarStr: 'F'
      };
    }

    return {
      title: 'Deal package ready',
      text: `A deal package for ${opportunityTitle} is now ready at ${currency} ${pricingAmount}. Open My Requests to review pricing and next steps.`,
      color: 'var(--blue)',
      avatarStr: 'F'
    };
  }

  if (status === 'matched') {
    return {
      title: 'Federation request matched',
      text: `Your request for ${opportunityTitle} is now matched. Open My Requests to review the routed connection path.`,
      color: 'var(--green)',
      avatarStr: 'F'
    };
  }

  if (status === 'pricing_sent') {
    return {
      title: 'Pricing sent',
      text: `Pricing for ${opportunityTitle} is now live. Open My Requests to review the package and decide your next step.`,
      color: 'var(--blue)',
      avatarStr: 'F'
    };
  }

  if (status === 'paid') {
    return {
      title: 'Payment confirmed',
      text: `Your request for ${opportunityTitle} is marked paid. Open My Requests to track delivery and intro progress.`,
      color: 'var(--green)',
      avatarStr: 'F'
    };
  }

  if (status === 'intro_delivered') {
    return {
      title: 'Introduction delivered',
      text: `The intro for ${opportunityTitle} has been delivered. Open My Requests to review the delivered state.`,
      color: 'var(--green)',
      avatarStr: 'F'
    };
  }

  if (status === 'completed') {
    return {
      title: 'Federation request completed',
      text: `Your request for ${opportunityTitle} has reached completion. Open My Requests to review the final state.`,
      color: 'var(--green)',
      avatarStr: 'F'
    };
  }

  if (status === 'rejected') {
    return {
      title: 'Federation request rejected',
      text: `Your request for ${opportunityTitle} was rejected. Open My Requests to review the final state and prepare a stronger next attempt.`,
      color: 'var(--red)',
      avatarStr: 'F'
    };
  }

  return {
    title: 'Federation request updated',
    text: `Your request for ${opportunityTitle} has been updated. Open My Requests to review the latest state.`,
    color: 'var(--blue)',
    avatarStr: 'F'
  };
}

async function appendFederationConnectionRequestNotificationToRequester(request = {}, action = 'status') {
  const requesterUid = cleanText(request.requesterUid);

  if (!requesterUid) return false;

  const userRef = firestore.collection('users').doc(requesterUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return false;

  const user = userSnap.data() || {};
  const nowIso = new Date().toISOString();
  const meta = getFederationConnectionRequestNotificationMeta(request, action);

  const notification = {
    id: `fedreq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title,
    text: meta.text,
    message: meta.text,
    body: meta.text,
    target: 'federation-requests',
    targetType: 'federation-requests',
    target_type: 'federation-requests',
    targetId: cleanText(request.id || ''),
    target_id: cleanText(request.id || ''),
    color: meta.color,
    avatarStr: meta.avatarStr,
    initial: meta.avatarStr,
    source: 'admin-federation-connect',
    notificationType: 'federation-connect-request',
    requestId: cleanText(request.id || ''),
    requestStatus: cleanText(request.status || ''),
    isRead: false,
    is_read: false,
    read: false,
    createdAt: nowIso,
    created_at: nowIso
  };

  await userRef.set({
    inProductReviewNotifications: prependUserInProductNotification(
      user.inProductReviewNotifications,
      notification
    ),
    updatedAt: nowIso
  }, { merge: true });

  return true;
}

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

    const usersSnap = await firestore.collection('users').limit(300).get();

    let matchedUserDoc = null;
    let matchedField = '';
    let matchedApplication = null;

    usersSnap.docs.some((doc) => {
      const data = doc.data() || {};

      if (data.academyApplication?.id === applicationId) {
        matchedUserDoc = doc;
        matchedField = 'academyApplication';
        matchedApplication = data.academyApplication;
        return true;
      }

      if (data.roadmapApplication?.id === applicationId) {
        matchedUserDoc = doc;
        matchedField = 'roadmapApplication';
        matchedApplication = data.roadmapApplication;
        return true;
      }

      if (data.federationApplication?.id === applicationId) {
        matchedUserDoc = doc;
        matchedField = 'federationApplication';
        matchedApplication = data.federationApplication;
        return true;
      }

      if (data.plazaApplication?.id === applicationId) {
        matchedUserDoc = doc;
        matchedField = 'plazaApplication';
        matchedApplication = data.plazaApplication;
        return true;
      }

      return false;
    });

    if (!matchedUserDoc || !matchedField || !matchedApplication) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    if (matchedField === 'roadmapApplication') {
      return res.status(400).json({
        success: false,
        message: 'Roadmap applications are now generated and unlocked automatically. Manual roadmap review is disabled.'
      });
    }

    const reviewResult = await firestore.runTransaction(async (transaction) => {
      const freshUserSnap = await transaction.get(matchedUserDoc.ref);

      if (!freshUserSnap.exists) {
        const error = new Error('Application owner not found.');
        error.statusCode = 404;
        throw error;
      }

      const freshUser = freshUserSnap.data() || {};
      const currentApplication = freshUser[matchedField] || {};

      if (cleanText(currentApplication.id) !== applicationId) {
        const error = new Error('Application not found.');
        error.statusCode = 404;
        throw error;
      }

      const previousStatus = cleanText(
        currentApplication.status ||
        freshUser[`${matchedField}Status`] ||
        ''
      ).toLowerCase();

      const approvalEmailAlreadySent = Boolean(
        freshUser.academyApprovalEmailSentAt ||
        currentApplication.approvalEmailSentAt
      );

      const approvalEmailAlreadyClaimed = Boolean(
        freshUser.academyApprovalEmailClaimedAt ||
        currentApplication.approvalEmailClaimedAt
      );

      if (previousStatus && previousStatus === nextStatus.toLowerCase()) {
        return {
          alreadyReviewed: true,
          application: currentApplication,
          shouldSendApprovalEmail: false,
          approvalEmailSent: false,
          approvalEmailError: ''
        };
      }

      const nowIso = new Date().toISOString();

      const isFederationApplication = matchedField === 'federationApplication';
      const isPlazaApplication = matchedField === 'plazaApplication';

      const reviewLabel = isFederationApplication
        ? 'Federation access'
        : isPlazaApplication
          ? 'Plaza access'
          : (matchedField === 'roadmapApplication' ? 'Roadmap' : 'Academy membership');

      const updatedApplication = {
        ...currentApplication,
        status: nextStatus,
        updatedAt: nowIso,
        reviewedAt: nowIso,
        reviewedBy: req.adminSession.username,
        notes: [
          `${reviewLabel} ${nextStatus.toLowerCase()} by admin.`,
          ...(Array.isArray(currentApplication.notes) ? currentApplication.notes : [])
        ]
      };

      const updatePayload = {
        updatedAt: nowIso
      };

      if (isFederationApplication) {
        updatePayload.federationApplication = updatedApplication;
        updatePayload.federationApplicationStatus = nextStatus;
        updatePayload.federationApplicationReviewedAt = nowIso;
        updatePayload.federationApplicationReviewedBy = req.adminSession.username;
        updatePayload.federationMembershipStatus = nextStatus.toLowerCase();

        if (nextStatus === 'Approved') {
          updatePayload.hasFederationAccess = true;
          updatePayload.federationApprovedAt = nowIso;
        } else {
          updatePayload.hasFederationAccess = false;
        }
      } else if (isPlazaApplication) {
        updatePayload.plazaApplication = updatedApplication;
        updatePayload.plazaApplicationStatus = nextStatus;
        updatePayload.plazaApplicationReviewedAt = nowIso;
        updatePayload.plazaApplicationReviewedBy = req.adminSession.username;
        updatePayload.plazaMembershipStatus = nextStatus.toLowerCase();
        updatePayload.plazaAccessStatus = nextStatus.toLowerCase();

        if (nextStatus === 'Approved') {
          updatePayload.hasPlazaAccess = true;
          updatePayload.plazaApprovedAt = nowIso;
          updatePayload.plazaRejectedAt = '';
        } else {
          updatePayload.hasPlazaAccess = false;

          if (nextStatus === 'Rejected') {
            updatePayload.plazaRejectedAt = nowIso;
          }
        }
      } else {
        updatePayload.academyApplication = updatedApplication;
        updatePayload.academyApplicationStatus = nextStatus;
        updatePayload.academyApplicationReviewedAt = nowIso;
        updatePayload.academyApplicationReviewedBy = req.adminSession.username;
        updatePayload.academyMembershipStatus = nextStatus.toLowerCase();

        if (nextStatus === 'Approved') {
          updatePayload.hasAcademyAccess = true;
          updatePayload.academyMembershipApprovedAt = nowIso;
        } else {
          updatePayload.hasAcademyAccess = false;
        }
      }

      let shouldSendApprovalEmail = false;
      let recipientEmail = '';
      let recipientName = '';

      if (matchedField === 'academyApplication' && nextStatus === 'Approved') {
        recipientEmail = cleanText(
          updatedApplication.email ||
          freshUser.email ||
          ''
        );

        recipientName = cleanText(
          freshUser.fullName ||
          freshUser.name ||
          freshUser.displayName ||
          updatedApplication.name ||
          freshUser.username ||
          'Member'
        );

        if (!recipientEmail) {
          updatedApplication.approvalEmailError = 'No applicant email found for the approval notification.';
          updatePayload.academyApprovalEmailError = updatedApplication.approvalEmailError;
        } else if (!approvalEmailAlreadySent && !approvalEmailAlreadyClaimed) {
          shouldSendApprovalEmail = true;

          updatedApplication.approvalEmailClaimedAt = nowIso;
          updatedApplication.approvalEmailClaimedBy = req.adminSession.username;

          updatePayload.academyApprovalEmailClaimedAt = nowIso;
          updatePayload.academyApprovalEmailClaimedBy = req.adminSession.username;
        }
      }

      const reviewNotification = buildApplicationReviewNotification({
        matchedField,
        nextStatus,
        application: updatedApplication,
        nowIso
      });

      updatePayload.inProductReviewNotifications = prependUserInProductNotification(
        freshUser.inProductReviewNotifications,
        reviewNotification
      );

      updatePayload[matchedField] = updatedApplication;

      transaction.set(matchedUserDoc.ref, updatePayload, { merge: true });

      return {
        alreadyReviewed: false,
        application: updatedApplication,
        shouldSendApprovalEmail,
        recipientEmail,
        recipientName,
        approvalEmailSent: false,
        approvalEmailError: ''
      };
    });

    let approvalEmailSent = false;
    let approvalEmailError = reviewResult.approvalEmailError || '';
    let responseApplication = reviewResult.application;

    if (reviewResult.shouldSendApprovalEmail) {
      try {
        await sendSystemMail({
          to: reviewResult.recipientEmail,
          subject: 'YH Universe - Academy Application Approved',
          html: renderAcademyApprovalEmail({ name: reviewResult.recipientName })
        });

        const approvalEmailSentAt = new Date().toISOString();

        responseApplication = {
          ...responseApplication,
          approvalEmailSentAt,
          approvalEmailSentTo: reviewResult.recipientEmail,
          approvalEmailError: ''
        };

        await matchedUserDoc.ref.set({
          academyApprovalEmailSentAt: approvalEmailSentAt,
          academyApprovalEmailSentTo: reviewResult.recipientEmail,
          academyApprovalEmailError: '',
          academyApplication: responseApplication
        }, { merge: true });

        approvalEmailSent = true;
      } catch (mailError) {
        approvalEmailError = cleanText(mailError?.message || 'Failed to send approval email.');
        console.error('academy approval email error:', mailError);

        responseApplication = {
          ...responseApplication,
          approvalEmailError
        };

        await matchedUserDoc.ref.set({
          academyApprovalEmailError: approvalEmailError,
          academyApplication: responseApplication
        }, { merge: true }).catch(() => null);
      }
    }

    return res.json({
      success: true,
      application: responseApplication,
      alreadyReviewed: reviewResult.alreadyReviewed === true,
      approvalEmailSent,
      approvalEmailError,
      inProductNotificationQueued: reviewResult.alreadyReviewed !== true
    });
  } catch (error) {
    console.error('admin application review error:', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to review application.'
    });
  }
});
  apiRouter.post('/api/admin/members/:id/status', requireAdminSession, async (req, res) => {
  try {
    const memberId = cleanText(req.params.id);
    const nextStatus = cleanText(req.body?.status);

    if (!memberId || !nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Member id and status are required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    await userRef.set({
      status: nextStatus,
      memberStatus: nextStatus,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({
      success: true,
      status: nextStatus
    });
  } catch (error) {
    console.error('admin member status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update member status.'
    });
  }
});

apiRouter.post('/api/admin/academy/:memberId/nudge', requireAdminSession, async (req, res) => {
  try {
    const memberId = cleanText(req.params.memberId);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member id is required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Academy member not found.'
      });
    }

    const user = userSnap.data() || {};
    const memberName = cleanText(
      user.fullName || user.name || user.displayName || user.username || 'Academy Member'
    );
    const nowIso = new Date().toISOString();

    await userRef.set({
      adminAcademyLastCheckIn: 'Nudge sent',
      updatedAt: nowIso
    }, { merge: true });

    await firestore.collection('adminBroadcasts').add({
      audience: memberName,
      subject: 'Manual roadmap nudge',
      message: `Admin sent a roadmap nudge to ${memberName}.`,
      sentAt: nowIso,
      createdBy: req.adminSession.username
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('admin academy nudge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send academy nudge.'
    });
  }
});

apiRouter.post('/api/admin/academy/:memberId/track', requireAdminSession, async (req, res) => {
  try {
    const memberId = cleanText(req.params.memberId);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member id is required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Academy member not found.'
      });
    }

    await userRef.set({
      adminAcademyStatus: 'On Track',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({ success: true });
  } catch (error) {
    console.error('admin academy track error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update academy status.'
    });
  }
});

apiRouter.post('/api/admin/academy/route-opportunity-mission', requireAdminSession, async (req, res) => {
  try {
    const body = req.body || {};
    const sourceType = cleanText(body.sourceType).toLowerCase();
    const sourceId = cleanText(body.sourceId);
    const memberId = cleanText(body.memberId || body.operatorId);
    const customMissionBrief = cleanText(body.missionBrief);

    if (!sourceType || !sourceId || !memberId) {
      return res.status(400).json({
        success: false,
        message: 'sourceType, sourceId, and memberId are required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Academy operator not found.'
      });
    }

    const operator = userSnap.data() || {};
    const operatorName = cleanText(
      operator.fullName ||
      operator.name ||
      operator.displayName ||
      operator.username ||
      memberId
    );

    let sourceRef = null;
    let sourceSnap = null;
    let sourceData = null;
    let sourceCollection = '';
    let sourceDivision = '';
    let sourceFeature = '';
    let missionType = '';
    let accessScopes = ['academy'];
    let networkTags = ['admin-routed'];
    let title = '';
    let description = '';
    let ownerName = '';
    let sourceStatus = '';
    let currency = 'USD';
    let valueAmount = 0;
    let commissionRate = 0;
    let commissionAmount = 0;
    let operatorPayoutAmount = 0;
    let region = '';
    let typeLabel = '';
    let academyNeed = '';

    if (sourceType === 'plaza' || sourceType === 'plaza_listing' || sourceType === 'plaza-opportunity') {
      sourceCollection = 'plazaOpportunities';
      sourceDivision = 'plaza';
      sourceFeature = 'opportunities';
      missionType = 'plaza_job';
      accessScopes = ['academy', 'plazas'];
      networkTags = ['admin-routed', 'plaza-job'];

      sourceRef = firestore.collection(sourceCollection).doc(sourceId);
      sourceSnap = await sourceRef.get();

      if (!sourceSnap.exists) {
        return res.status(404).json({
          success: false,
          message: 'Plaza opportunity not found.'
        });
      }

      sourceData = sourceSnap.data() || {};
      title = cleanText(sourceData.title || 'Plaza opportunity');
      description = cleanText(sourceData.text || sourceData.description || '');
      ownerName = cleanText(sourceData.authorName || sourceData.ownerName || sourceData.member || 'Plaza Member');
      sourceStatus = cleanText(sourceData.status || sourceData.reviewStatus || '');
      currency = cleanText(sourceData.currency || 'USD').toUpperCase() || 'USD';
      valueAmount = Math.max(
        toNumber(sourceData.budgetMax, 0),
        toNumber(sourceData.budgetMin, 0)
      );
      commissionRate = toNumber(sourceData.commissionRate, 0);
      commissionAmount = valueAmount > 0 && commissionRate > 0
        ? Math.round((valueAmount * commissionRate) / 100)
        : 0;
      region = cleanText(sourceData.region || 'Global');
      typeLabel = cleanText(sourceData.type || 'Plaza Opportunity');
      academyNeed = cleanText(
        sourceData.academyMissionNeed ||
        sourceData.operatorNeed ||
        sourceData.monetizationNote ||
        description
      );
    } else if (sourceType === 'federation' || sourceType === 'federation_deal_room' || sourceType === 'federation-deal-room') {
      sourceCollection = 'federationDealRooms';
      sourceDivision = 'federation';
      sourceFeature = 'deal_rooms';
      missionType = 'federation_task';
      accessScopes = ['academy', 'federation'];
      networkTags = ['admin-routed', 'federation-task'];

      sourceRef = firestore.collection(sourceCollection).doc(sourceId);
      sourceSnap = await sourceRef.get();

      if (!sourceSnap.exists) {
        return res.status(404).json({
          success: false,
          message: 'Federation Deal Room not found.'
        });
      }

      sourceData = sourceSnap.data() || {};
      title = cleanText(sourceData.title || 'Federation Deal Room');
      description = cleanText(sourceData.description || '');
      ownerName = cleanText(sourceData.creatorName || 'Federation Member');
      sourceStatus = cleanText(sourceData.adminStatus || sourceData.dealStatus || '');
      currency = cleanText(sourceData.currency || 'USD').toUpperCase() || 'USD';
      valueAmount = toNumber(sourceData.expectedValueAmount, 0);
      commissionRate = toNumber(sourceData.platformCommissionRate, 0);
      commissionAmount = toNumber(
        sourceData.platformCommissionAmount,
        valueAmount > 0 && commissionRate > 0
          ? Math.round((valueAmount * commissionRate) / 100)
          : 0
      );
      region = 'Federation';
      typeLabel = cleanText(sourceData.roomType || 'Federation Deal Room');
      academyNeed = cleanText(sourceData.academyMissionNeed || sourceData.partnerNeed || description);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid sourceType. Use plaza or federation_deal_room.'
      });
    }

    const missionBrief = customMissionBrief || academyNeed || description || 'Admin-routed Academy operator mission.';
    const now = Timestamp.now();
    const nowIso = new Date().toISOString();

    const createdLead = await academyFirestoreRepo.createLeadMissionLead(memberId, {
      tier: sourceDivision === 'federation' ? 'Strategic Task' : 'Opportunity',
      companyName: title,
      companyWebsite: '',
      contactName: ownerName,
      contactRole: typeLabel,
      contactType: missionType,
      email: '',
      phone: '',
      city: region,
      country: '',
      sourceMethod: `admin_routed_${sourceDivision}`,
      callOutcome: 'Assigned by admin',
      interestLevel: 'high',
      rapportLevel: 'admin-routed',
      pipelineStage: 'assigned',
      priority: sourceDivision === 'federation' ? 'high' : 'medium',
      nextAction: missionBrief,
      channel: 'admin',
      taskStatus: 'assigned',
      callType: 'opportunity_mission',
      objection: '',
      notes: [
        `Source: ${sourceDivision} / ${sourceFeature} / ${sourceId}`,
        description,
        missionBrief
      ].filter(Boolean).join('\n\n'),
      followUpDueDate: '',

      sellerPriceAmount: 0,
      currency,
      universeCommissionRate: commissionRate,
      saleEnabled: false,

      sourceDivision,
      sourceFeature,
      sourceRecordId: sourceId,
      sourceRecordPath: `${sourceCollection}/${sourceId}`,
      routedFromAdmin: true,
      routedSourceTitle: title,
      assignedByAdmin: cleanText(req.adminSession?.username || 'admin'),
      assignedAt: now,
      assignmentStatus: 'assigned',
      missionType,
      missionBrief,
      academyMissionNeed: academyNeed,
      opportunityOwnerName: ownerName,
      opportunityValueAmount: valueAmount,
      platformCommissionRate: commissionRate,
      platformCommissionAmount: commissionAmount,
      operatorPayoutAmount,

      accessScopes,
      federationReady: sourceDivision === 'federation',
      plazaReady: sourceDivision === 'plaza',
      federationListingStatus: sourceDivision === 'federation' ? 'admin_routed' : 'not_listed',
      networkTags,
      strategicValue: sourceDivision === 'federation' ? 'high' : 'medium',
      status: 'active'
    });

    await userRef.collection('academyLeadMissions').doc(createdLead.id).set({
      sourceStatusAtRouting: sourceStatus,
      routedFromAdmin: true,
      assignedByAdmin: cleanText(req.adminSession?.username || 'admin'),
      assignedAt: now,
      updatedAt: now
    }, { merge: true });

    await sourceRef.set({
      routedToAcademy: true,
      lastRoutedAcademyMissionId: createdLead.id,
      lastRoutedAcademyMemberId: memberId,
      lastRoutedAcademyMemberName: operatorName,
      lastRoutedAcademyAt: now,
      lastRoutedAcademyBy: cleanText(req.adminSession?.username || 'admin'),
      updatedAt: now
    }, { merge: true });

    await firestore.collection('adminBroadcasts').add({
      audience: operatorName,
      subject: 'Academy Opportunity Mission routed',
      message: `Admin routed ${title} from ${sourceDivision} to ${operatorName}.`,
      sentAt: nowIso,
      createdBy: cleanText(req.adminSession?.username || 'admin')
    });

    const freshLead = await academyFirestoreRepo.getLeadMissionLeadById(memberId, createdLead.id);

    return res.json({
      success: true,
      message: 'Opportunity routed to Academy Mission.',
      mission: freshLead,
      memberId,
      sourceType: sourceDivision,
      sourceId
    });
  } catch (error) {
    console.error('admin route opportunity mission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to route opportunity to Academy Mission.'
    });
  }
});
apiRouter.post('/api/admin/academy/lead-missions/:memberId/:leadId/review', requireAdminSession, async (req, res) => {
  try {
    const memberId = cleanText(req.params.memberId);
    const leadId = cleanText(req.params.leadId);
    const body = req.body || {};
    const decision = cleanText(body.decision || body.status || '').toLowerCase();

    const allowed = new Set([
      'approved',
      'rejected',
      'revision_requested'
    ]);

    if (!memberId || !leadId || !allowed.has(decision)) {
      return res.status(400).json({
        success: false,
        message: 'memberId, leadId, and a valid review decision are required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Academy operator not found.'
      });
    }

    const leadRef = userRef.collection('academyLeadMissions').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Lead Mission record not found.'
      });
    }

    const lead = leadSnap.data() || {};
    const now = Timestamp.now();
    const nowIso = new Date().toISOString();
    const adminNote = cleanText(body.adminNote || body.note || '').slice(0, 1200);
    const currency = cleanText(lead.currency || body.currency || 'USD').toUpperCase() || 'USD';

    const manualPayoutAmount =
      body.operatorPayoutAmount !== undefined &&
      body.operatorPayoutAmount !== null &&
      body.operatorPayoutAmount !== ''
        ? Math.max(0, toNumber(body.operatorPayoutAmount, 0))
        : null;

    const operatorPayoutAmount = manualPayoutAmount !== null
      ? manualPayoutAmount
      : Math.max(0, toNumber(lead.operatorPayoutAmount, 0));

    const patch = {
      reviewStatus: decision,
      assignmentStatus: decision === 'approved'
        ? 'approved'
        : decision === 'rejected'
          ? 'rejected'
          : 'revision_requested',
      taskStatus: decision === 'approved'
        ? 'completed'
        : decision === 'rejected'
          ? 'rejected'
          : 'revision_requested',
      pipelineStage: decision === 'approved'
        ? 'completed'
        : decision === 'rejected'
          ? 'rejected'
          : 'revision_requested',
      reviewedAt: now,
      reviewedBy: cleanText(req.adminSession?.username || 'admin'),
      adminReviewNote: adminNote,
      updatedAt: now
    };

    if (decision === 'approved') {
      patch.completedAt = now;
      patch.callOutcome = 'Approved by admin';
      patch.nextAction = 'Mission approved. Earnings can be withdrawn when available.';
    }

    if (decision === 'revision_requested') {
      patch.callOutcome = 'Revision requested by admin';
      patch.nextAction = adminNote || 'Admin requested revision.';
    }

    if (decision === 'rejected') {
      patch.callOutcome = 'Rejected by admin';
      patch.nextAction = adminNote || 'Mission rejected.';
    }

    await leadRef.set(patch, { merge: true });

    let earning = null;

    if (decision === 'approved' && operatorPayoutAmount > 0) {
      const payoutRef = userRef.collection('academyLeadPayouts').doc(`earning_${leadId}`);

      const payoutPayload = {
        id: payoutRef.id,
        leadId,
        sourceDivision: cleanText(lead.sourceDivision || 'academy'),
        sourceFeature: cleanText(lead.sourceFeature || 'routed_mission'),
        sourceRecordId: cleanText(lead.sourceRecordId || leadId),
        title: cleanText(lead.routedSourceTitle || lead.companyName || 'Academy routed mission'),
        amount: operatorPayoutAmount,
        currency,
        status: 'approved',
        paymentStatus: 'earned',
        payoutStatus: 'not_requested',
        operatorUid: memberId,
        operatorName: cleanText(userSnap.data()?.fullName || userSnap.data()?.name || userSnap.data()?.username || memberId),
        approvedBy: cleanText(req.adminSession?.username || 'admin'),
        approvedAt: now,
        updatedAt: now,
        createdAt: lead.assignedAt || now,
        metadata: {
          missionType: cleanText(lead.missionType || ''),
          platformCommissionRate: toNumber(lead.platformCommissionRate, 0),
          platformCommissionAmount: toNumber(lead.platformCommissionAmount, 0),
          opportunityValueAmount: toNumber(lead.opportunityValueAmount, 0)
        }
      };

      await payoutRef.set(payoutPayload, { merge: true });
      earning = {
        id: payoutRef.id,
        ...payoutPayload
      };

      await leadRef.set({
        operatorPayoutAmount,
        earningLedgerId: payoutRef.id,
        earningStatus: 'approved',
        earningApprovedAt: now,
        updatedAt: now
      }, { merge: true });
    }

    await firestore.collection('adminBroadcasts').add({
      audience: cleanText(userSnap.data()?.fullName || userSnap.data()?.name || userSnap.data()?.username || memberId),
      subject: 'Academy routed mission reviewed',
      message: `Admin marked Lead Mission ${leadId} as ${decision.replace(/_/g, ' ')}.`,
      sentAt: nowIso,
      createdBy: cleanText(req.adminSession?.username || 'admin')
    });

    const freshSnap = await leadRef.get();

    return res.json({
      success: true,
      lead: {
        id: freshSnap.id,
        ...(freshSnap.data() || {})
      },
      earning
    });
  } catch (error) {
    console.error('admin academy routed mission review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to review Academy routed mission.'
    });
  }
});
apiRouter.post('/api/admin/academy/lead-missions/:memberId/:leadId/network', requireAdminSession, async (req, res) => {
  try {
    const memberId = cleanText(req.params.memberId);
    const leadId = cleanText(req.params.leadId);

    if (!memberId || !leadId) {
      return res.status(400).json({
        success: false,
        message: 'Member id and lead id are required.'
      });
    }

    const userRef = firestore.collection('users').doc(memberId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Academy member not found.'
      });
    }

    const leadRef = userRef.collection('academyLeadMissions').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Lead Mission record not found.'
      });
    }

    const existingLead = leadSnap.data() || {};
    const body = req.body || {};
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, 'federationReady')) {
      patch.federationReady = body.federationReady === true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'plazaReady')) {
      patch.plazaReady = body.plazaReady === true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'strategicValue')) {
      patch.strategicValue = normalizeAdminStrategicValue(body.strategicValue);
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({
        success: false,
        message: 'No valid Lead Mission network fields were provided.'
      });
    }

    const routing = buildNextLeadMissionAccessScopes(existingLead, patch);
    const nowIso = new Date().toISOString();

    const updatePayload = {
      ...routing,
      ...(Object.prototype.hasOwnProperty.call(patch, 'strategicValue')
        ? { strategicValue: patch.strategicValue }
        : {}),
      sourceDivision: cleanText(existingLead.sourceDivision || 'academy') || 'academy',
      adminNetworkUpdatedAt: nowIso,
      adminNetworkUpdatedBy: req.adminSession.username,
      updatedAt: Timestamp.now()
    };

    await leadRef.set(updatePayload, { merge: true });

    await firestore.collection('adminBroadcasts').add({
      audience: cleanText(userSnap.data()?.fullName || userSnap.data()?.name || userSnap.data()?.username || memberId),
      subject: 'Lead Mission network routing updated',
      message: `Admin updated Lead Mission ${leadId}: ${Object.keys(patch).join(', ')}.`,
      sentAt: nowIso,
      createdBy: req.adminSession.username
    });

    const updatedSnap = await leadRef.get();

    return res.json({
      success: true,
      lead: {
        id: updatedSnap.id,
        ...(updatedSnap.data() || {})
      }
    });
  } catch (error) {
    console.error('admin lead mission network update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Lead Mission network routing.'
    });
  }
});
function normalizeAdminDealPackage(body = {}) {
  const pricingAmount = Math.max(0, toNumber(body.pricingAmount, 0));
  const platformCommissionRate = Math.max(0, Math.min(100, toNumber(body.platformCommissionRate, 0)));

  const manualCommission =
    body.platformCommissionAmount !== undefined &&
    body.platformCommissionAmount !== null &&
    body.platformCommissionAmount !== ''
      ? Math.max(0, toNumber(body.platformCommissionAmount, 0))
      : null;

  const platformCommissionAmount = manualCommission !== null
    ? manualCommission
    : Math.round((pricingAmount * platformCommissionRate) / 100);

  const operatorPayoutAmount =
    body.operatorPayoutAmount !== undefined &&
    body.operatorPayoutAmount !== null &&
    body.operatorPayoutAmount !== ''
      ? Math.max(0, toNumber(body.operatorPayoutAmount, 0))
      : Math.max(0, pricingAmount - platformCommissionAmount);

  return {
    pricingAmount,
    currency: cleanText(body.currency || 'USD').toUpperCase() || 'USD',
    platformCommissionRate,
    platformCommissionAmount,
    operatorPayoutAmount,
    paymentStatus: cleanText(body.paymentStatus || 'not_started'),
    payoutStatus: cleanText(body.payoutStatus || 'not_started'),
    commissionStatus: cleanText(body.commissionStatus || 'not_started'),
    dealNotes: cleanText(body.dealNotes || '').slice(0, 2000)
  };
}
function getAcademyMirrorDealStatusFromFederationRequest(request = {}) {
  const status = cleanText(request.status).toLowerCase();
  const paymentStatus = cleanText(request.paymentStatus).toLowerCase();

  if (status === 'completed') return 'completed';
  if (status === 'intro_delivered') return 'intro_delivered';
  if (status === 'paid' || paymentStatus === 'paid') return 'paid';
  if (status === 'pricing_sent') return 'priced';
  if (status === 'matched') return 'matched';

  return 'under_review';
}

function getAcademyMirrorPayoutStatusFromFederationRequest(request = {}) {
  const payoutStatus = cleanText(request.payoutStatus).toLowerCase();
  const paymentStatus = cleanText(request.paymentStatus).toLowerCase();
  const status = cleanText(request.status).toLowerCase();

  if (payoutStatus === 'paid') return 'paid';
  if (payoutStatus === 'approved') return 'approved';
  if (payoutStatus === 'held') return 'held';

  if (status === 'paid' || status === 'intro_delivered' || status === 'completed' || paymentStatus === 'paid') {
    return 'approved';
  }

  return 'pending_review';
}

async function syncFederationRequestToAcademyEconomy(request = {}, action = 'status') {
  try {
    const requestId = cleanText(request.id);
    const ownerUid = cleanText(request.ownerUid);
    const leadId = cleanText(request.leadId);

    if (!requestId || !ownerUid || !leadId) {
      return false;
    }

    const userRef = firestore.collection('users').doc(ownerUid);
    const leadRef = userRef.collection('academyLeadMissions').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return false;
    }

    const now = Timestamp.now();

    const pricingAmount = Math.max(0, toNumber(request.pricingAmount, 0));
    const platformCommissionRate = Math.max(0, Math.min(100, toNumber(request.platformCommissionRate, 0)));
    const platformCommissionAmount = Math.max(0, toNumber(request.platformCommissionAmount, 0));
    const operatorPayoutAmount = Math.max(0, toNumber(request.operatorPayoutAmount, 0));
    const currency = cleanText(request.currency || 'USD').toUpperCase() || 'USD';

    const dealStatus = getAcademyMirrorDealStatusFromFederationRequest(request);
    const payoutStatus = getAcademyMirrorPayoutStatusFromFederationRequest(request);

    const mirrorId = `fedreq_${requestId}`;
    const dealRef = userRef.collection('academyLeadDeals').doc(mirrorId);
    const payoutRef = userRef.collection('academyLeadPayouts').doc(mirrorId);

    const [dealSnap, payoutSnap] = await Promise.all([
      dealRef.get(),
      payoutRef.get()
    ]);

    const opportunityTitle = cleanText(request.opportunityTitle || 'Federation paid introduction');
    const adminNote = cleanText(
      request.dealNotes ||
      request.requestReason ||
      `Federation Connect package synced from ${action}.`
    ).slice(0, 900);

    await dealRef.set({
      leadId,
      federationRequestId: requestId,
      dealType: 'federation_paid_introduction',
      dealStatus,
      grossValue: pricingAmount,
      currency,
      platformCommissionRate,
      platformCommissionAmount,
      operatorPayoutAmount,
      paymentStatus: cleanText(request.paymentStatus || 'not_started'),
      payoutStatus: cleanText(request.payoutStatus || 'not_started'),
      commissionStatus: cleanText(request.commissionStatus || 'not_started'),
      opportunityTitle,
      operatorVisibleNote: adminNote,
      sourceDivision: 'federation',
      sourceFeature: 'connect',
      ...(dealSnap.exists ? {} : { createdAt: now }),
      updatedAt: now
    }, { merge: true });

    if (operatorPayoutAmount > 0 || pricingAmount > 0) {
      await payoutRef.set({
        leadId,
        federationRequestId: requestId,
        basisType: 'federation_paid_introduction',
        amount: operatorPayoutAmount,
        currency,
        status: payoutStatus,
        adminNote,
        sourceDivision: 'federation',
        sourceFeature: 'connect',
        dealGrossValue: pricingAmount,
        platformCommissionRate,
        platformCommissionAmount,
        paymentStatus: cleanText(request.paymentStatus || 'not_started'),
        commissionStatus: cleanText(request.commissionStatus || 'not_started'),
        ...(payoutSnap.exists ? {} : { createdAt: now }),
        ...(['approved', 'paid'].includes(payoutStatus) ? { approvedAt: now } : {}),
        ...(payoutStatus === 'paid' ? { paidAt: now } : {}),
        updatedAt: now
      }, { merge: true });
    }

    await leadRef.set({
      federationRequestId: requestId,
      lastFederationRequestStatus: cleanText(request.status || ''),
      lastFederationDealStatus: dealStatus,
      lastFederationDealValue: pricingAmount,
      lastFederationOperatorPayout: operatorPayoutAmount,
      lastFederationPaymentStatus: cleanText(request.paymentStatus || 'not_started'),
      lastFederationEconomySyncedAt: now,
      updatedAt: now
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('sync federation request to academy economy error:', error);
    return false;
  }
}

function buildAdminMatchedFederationOpportunitySnapshot(lead = {}, ownerUid = '', leadId = '') {
  const contactRole = cleanText(lead.contactRole || lead.role || lead.contactType || 'strategic contact');
  const city = cleanText(lead.city);
  const country = cleanText(lead.country);
  const location = [city, country].filter(Boolean).join(', ');

  return {
    id: `${cleanText(ownerUid)}_${cleanText(leadId)}`,
    ownerUid: cleanText(ownerUid),
    leadId: cleanText(leadId),
    title: location
      ? `Connect with a ${contactRole} in ${location}`
      : `Connect with a ${contactRole}`,
    category: cleanText(lead.contactType || lead.category || lead.industry || 'Strategic Network'),
    contactRole,
    contactType: cleanText(lead.contactType || lead.category || 'Strategic Network'),
    companyName: cleanText(lead.companyName),
    companyWebsite: cleanText(lead.companyWebsite),
    contactName: cleanText(lead.contactName),
    city,
    country,
    strategicValue: cleanText(lead.strategicValue || 'standard'),
    tier: cleanText(lead.tier),
    sourceDivision: cleanText(lead.sourceDivision || 'academy') || 'academy',
    pipelineStage: cleanText(lead.pipelineStage || lead.callOutcome || ''),
    sourceMethod: cleanText(lead.sourceMethod),
    channel: cleanText(lead.channel),
    priority: cleanText(lead.priority),
    hasEmail: Boolean(cleanText(lead.email)),
    hasPhone: Boolean(cleanText(lead.phone)),
    hasDirectContact: Boolean(cleanText(lead.email) || cleanText(lead.phone)),
    companyLabel: lead.companyName ? 'Private organization on file' : 'Private organization',
    summary: cleanText(
      lead.notes ||
      lead.description ||
      'Academy-sourced lead matched by admin.'
    ).slice(0, 260)
  };
}
apiRouter.post('/api/admin/federation/connection-requests/:requestId/match', requireAdminSession, async (req, res) => {
  try {
    const requestId = cleanText(req.params.requestId);
    const ownerUid = cleanText(req.body?.ownerUid || req.body?.memberId);
    const leadId = cleanText(req.body?.leadId);

    if (!requestId || !ownerUid || !leadId) {
      return res.status(400).json({
        success: false,
        message: 'Request id, owner uid, and lead id are required.'
      });
    }

    const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Federation connection request not found.'
      });
    }

    const userRef = firestore.collection('users').doc(ownerUid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Lead owner user not found.'
      });
    }

    const leadRef = userRef.collection('academyLeadMissions').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Selected Lead Mission record not found.'
      });
    }

    const lead = leadSnap.data() || {};

    if (lead.federationReady !== true) {
      return res.status(403).json({
        success: false,
        message: 'Selected lead is not marked Federation-ready.'
      });
    }

    const now = Timestamp.now();
    const opportunitySnapshot = buildAdminMatchedFederationOpportunitySnapshot(lead, ownerUid, leadId);

    await requestRef.set({
      ownerUid,
      leadId,
      leadPath: leadRef.path,
      requestMode: 'matched_by_admin',
      opportunityId: opportunitySnapshot.id,
      opportunityTitle: opportunitySnapshot.title,
      opportunitySnapshot,
      status: 'matched',
      adminStatus: 'matched',
      matchedAt: now,
      matchedBy: req.adminSession.username,
      updatedAt: now,
      adminUpdatedAt: now,
      adminUpdatedBy: req.adminSession.username
    }, { merge: true });

    await firestore.collection('adminBroadcasts').add({
      audience: cleanText(requestSnap.data()?.requesterName || requestSnap.data()?.requesterEmail || 'Federation requester'),
      subject: 'Federation connection request matched',
      message: `Admin matched request ${requestId} to lead ${leadId}.`,
      sentAt: new Date().toISOString(),
      createdBy: req.adminSession.username
    });

    const updatedSnap = await requestRef.get();
    const updatedRequest = mapAdminFederationConnectionRequestDoc(updatedSnap);

    const requesterNotificationQueued =
      await appendFederationConnectionRequestNotificationToRequester(updatedRequest, 'match');

    return res.json({
      success: true,
      request: updatedRequest,
      requesterNotificationQueued
    });
  } catch (error) {
    console.error('admin federation request match error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to match Federation connection request.'
    });
  }
});
apiRouter.post('/api/admin/federation/connection-requests/:requestId/deal-package', requireAdminSession, async (req, res) => {
  try {
    const requestId = cleanText(req.params.requestId);

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Federation request id is required.'
      });
    }

    const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Federation connection request not found.'
      });
    }

    const dealPackage = normalizeAdminDealPackage(req.body || {});
    const now = Timestamp.now();

    const nextStatus =
      dealPackage.paymentStatus === 'paid'
        ? 'paid'
        : 'pricing_sent';

    await requestRef.set({
      dealPackage,
      pricingAmount: dealPackage.pricingAmount,
      currency: dealPackage.currency,
      platformCommissionRate: dealPackage.platformCommissionRate,
      platformCommissionAmount: dealPackage.platformCommissionAmount,
      operatorPayoutAmount: dealPackage.operatorPayoutAmount,
      paymentStatus: dealPackage.paymentStatus,
      payoutStatus: dealPackage.payoutStatus,
      commissionStatus: dealPackage.commissionStatus,
      dealNotes: dealPackage.dealNotes,
      status: nextStatus,
      adminStatus: 'pricing_sent',
      pricingSentAt: now,
      pricingUpdatedAt: now,
      pricingUpdatedBy: req.adminSession.username,
      updatedAt: now,
      adminUpdatedAt: now,
      adminUpdatedBy: req.adminSession.username
    }, { merge: true });

    const updatedSnap = await requestRef.get();
    const updatedRequest = mapAdminFederationConnectionRequestDoc(updatedSnap);

    const academyEconomySynced =
      await syncFederationRequestToAcademyEconomy(updatedRequest, 'deal-package');

    const requesterNotificationQueued =
      await appendFederationConnectionRequestNotificationToRequester(updatedRequest, 'deal-package');

    return res.json({
      success: true,
      request: updatedRequest,
      academyEconomySynced,
      requesterNotificationQueued
    });
  } catch (error) {
    console.error('admin federation deal package update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Federation deal package.'
    });
  }
});

apiRouter.post('/api/admin/federation/deal-rooms/:roomId/status', requireAdminSession, async (req, res) => {
  try {
    const roomId = cleanText(req.params.roomId);
    const nextStatus = cleanText(req.body?.adminStatus || req.body?.status || 'pending_admin_review').toLowerCase();

    const allowed = new Set([
      'pending_admin_review',
      'approved',
      'in_discussion',
      'commission_due',
      'commission_paid',
      'closed',
      'rejected'
    ]);

    if (!roomId || !allowed.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Deal Room status update.'
      });
    }

    const roomRef = firestore.collection('federationDealRooms').doc(roomId);
    const snap = await roomRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Federation Deal Room not found.'
      });
    }

    const commissionStatus =
      nextStatus === 'commission_due'
        ? 'due'
        : nextStatus === 'commission_paid'
          ? 'paid'
          : undefined;

    const patch = {
      adminStatus: nextStatus,
      dealStatus: nextStatus === 'closed'
        ? 'closed'
        : nextStatus === 'rejected'
          ? 'rejected'
          : nextStatus === 'approved'
            ? 'approved'
            : nextStatus === 'in_discussion'
              ? 'in_discussion'
              : snap.data()?.dealStatus || 'proposed',
      updatedAt: Timestamp.now(),
      reviewedBy: cleanText(req.adminSession?.username || 'admin')
    };

    if (commissionStatus) {
      patch.commissionStatus = commissionStatus;
    }

    await roomRef.set(patch, { merge: true });

    const freshSnap = await roomRef.get();

    return res.json({
      success: true,
      room: mapAdminFederationDealRoomDoc(freshSnap)
    });
  } catch (error) {
    console.error('admin federation deal room status update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Federation Deal Room.'
    });
  }
});

apiRouter.post('/api/admin/federation/connection-requests/:requestId/status', requireAdminSession, async (req, res) => {
  try {
    const requestId = cleanText(req.params.requestId);
    const nextStatus = cleanText(req.body?.status).toLowerCase();

    const allowedStatuses = new Set([
      'pending_admin_match',
      'pending_review',
      'matched',
      'pricing_sent',
      'paid',
      'intro_delivered',
      'completed',
      'rejected'
    ]);

    if (!requestId || !allowedStatuses.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Valid request id and status are required.'
      });
    }

    const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Federation connection request not found.'
      });
    }

    const now = Timestamp.now();

    const statusPatch = {
      status: nextStatus,
      adminStatus: nextStatus === 'rejected' ? 'rejected' : 'active',
      updatedAt: now,
      adminUpdatedAt: now,
      adminUpdatedBy: req.adminSession.username
    };

    if (nextStatus === 'paid') {
      statusPatch.paymentStatus = 'paid';
      statusPatch.paidAt = now;
    }

    if (nextStatus === 'intro_delivered') {
      statusPatch.introDeliveredAt = now;
    }

    if (nextStatus === 'completed') {
      statusPatch.completedAt = now;
    }

    await requestRef.set(statusPatch, { merge: true });

    const updatedSnap = await requestRef.get();
    const updatedRequest = mapAdminFederationConnectionRequestDoc(updatedSnap);

    const academyEconomySynced =
      await syncFederationRequestToAcademyEconomy(updatedRequest, 'status');

    const requesterNotificationQueued =
      await appendFederationConnectionRequestNotificationToRequester(updatedRequest, 'status');

    return res.json({
      success: true,
      request: updatedRequest,
      academyEconomySynced,
      requesterNotificationQueued
    });
  } catch (error) {
    console.error('admin federation request status update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Federation connection request.'
    });
  }
});

apiRouter.post('/api/admin/plazas/:listingId/status', requireAdminSession, async (req, res) => {
  try {
    const listingId = cleanText(req.params.listingId);
    const nextStatus = cleanText(req.body?.status || '').toLowerCase();
    const featuredValue = req.body?.featured;

    const allowedStatuses = new Set([
      'pending_review',
      'active',
      'flagged',
      'archived'
    ]);

    if (!listingId) {
      return res.status(400).json({
        success: false,
        message: 'Plaza listing id is required.'
      });
    }

    const listingRef = firestore.collection('plazaOpportunities').doc(listingId);
    const listingSnap = await listingRef.get();

    if (!listingSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Plaza listing not found.'
      });
    }

    const now = Timestamp.now();
    const patch = {
      updatedAt: now,
      reviewedAt: now,
      reviewedBy: cleanText(req.adminSession?.username || 'admin')
    };

    if (nextStatus) {
      if (!allowedStatuses.has(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Plaza listing status.'
        });
      }

      patch.status = nextStatus;
      patch.reviewStatus = nextStatus;
    }

    if (typeof featuredValue === 'boolean') {
      patch.featured = featuredValue;
      patch.featuredAt = featuredValue ? now : null;
    }

    await listingRef.set(patch, { merge: true });

    const freshSnap = await listingRef.get();

    return res.json({
      success: true,
      listing: mapAdminPlazaListingDoc(freshSnap)
    });
  } catch (error) {
    console.error('admin plaza listing status update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Plaza listing.'
    });
  }
});
apiRouter.post('/api/admin/broadcasts', requireAdminSession, async (req, res) => {
  try {
    const audience = cleanText(req.body?.audience);
    const subject = cleanText(req.body?.subject);
    const message = cleanText(req.body?.message);

    if (!audience || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Audience, subject, and message are required.'
      });
    }

    const nowIso = new Date().toISOString();
    const ref = await firestore.collection('adminBroadcasts').add({
      audience,
      subject,
      message,
      sentAt: nowIso,
      createdBy: req.adminSession.username
    });

    return res.status(201).json({
      success: true,
      broadcast: {
        id: ref.id,
        audience,
        subject,
        message,
        sentAt: nowIso
      }
    });
  } catch (error) {
    console.error('admin broadcast error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send broadcast.'
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