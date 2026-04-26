require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { firestore } = require('./config/firebaseAdmin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const jwt = require('jsonwebtoken');
const publicLandingEventsRepo = require('./backend/repositories/publicLandingEventsRepo');
const realtimeFirestoreRepo = require('./backend/repositories/realtimeFirestoreRepo');
const paymentLedgerRepo = require('./backend/repositories/paymentLedgerRepo');
const academyFirestoreRepo = require('./backend/repositories/academyFirestoreRepo');
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000
});
const publicLandingNamespace = io.of('/public-landing');

async function emitPublicLandingSnapshotToClients(limit = 24) {
    try {
        const payload = await publicLandingEventsRepo.buildPublicLandingSnapshot(limit);
        publicLandingNamespace.emit('landingSnapshot', {
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('emitPublicLandingSnapshotToClients error:', error);
    }
}

global.yhEmitPublicLandingSnapshot = emitPublicLandingSnapshotToClients;

publicLandingNamespace.on('connection', (socket) => {
    console.log('🌍 Public landing socket connected:', socket.id);
    emitPublicLandingSnapshotToClients().catch((error) => {
        console.error('public landing initial snapshot error:', error);
    });

    socket.on('disconnect', () => {
        console.log('🌍 Public landing socket disconnected:', socket.id);
    });
});

const chatMessagesCol = firestore.collection('chatMessages');
const chatRoomsCol = firestore.collection('chatRooms');
const leadMissionOperatorsCol = firestore.collection('leadMissionOperators');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const mapChatTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

const mapFederationConnectTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

function getLeadMissionOwnerUidFromDoc(docSnap) {
    try {
        return sanitizeText(docSnap?.ref?.parent?.parent?.id || '');
    } catch (_) {
        return '';
    }
}

function normalizeFederationConnectBudgetRange(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'not_sure',
        'under_500',
        '500_1500',
        '1500_5000',
        '5000_plus'
    ]);

    return allowed.has(raw) ? raw : 'not_sure';
}

function normalizeFederationConnectUrgency(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'normal',
        'this_week',
        'urgent',
        'exploring'
    ]);

    return allowed.has(raw) ? raw : 'normal';
}

function normalizeFederationConnectIntroType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'admin_brokered',
        'operator_intro',
        'contact_package',
        'not_sure'
    ]);

    return allowed.has(raw) ? raw : 'admin_brokered';
}

function buildFederationConnectOpportunityTitle(lead = {}) {
    const role = sanitizeText(
        lead.contactRole ||
        lead.role ||
        lead.contactType ||
        'strategic contact'
    );

    const location = [lead.city, lead.country]
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .join(', ');

    return location
        ? `Connect with a ${role} in ${location}`
        : `Connect with a ${role}`;
}

function mapFederationConnectOpportunityDoc(docSnap) {
    const lead = docSnap.data() || {};
    const ownerUid = sanitizeText(
        lead.ownerUid ||
        lead.memberId ||
        getLeadMissionOwnerUidFromDoc(docSnap)
    );

    const leadId = sanitizeText(docSnap.id);
    const category = sanitizeText(
        lead.contactType ||
        lead.category ||
        lead.industry ||
        'Strategic Network'
    );

    const contactRole = sanitizeText(
        lead.contactRole ||
        lead.role ||
        category ||
        'Strategic Contact'
    );

    const sellerPriceAmount = Math.max(0, Number(lead.sellerPriceAmount || 0));
    const universeCommissionRate = Math.max(0, Math.min(100, Number(lead.universeCommissionRate || 20)));
    const universeCommissionAmount = sellerPriceAmount > 0
        ? Math.max(0, Number(lead.universeCommissionAmount || ((sellerPriceAmount * universeCommissionRate) / 100)))
        : 0;
    const buyerPriceAmount = sellerPriceAmount > 0
        ? Math.max(0, Number(lead.buyerPriceAmount || (sellerPriceAmount + universeCommissionAmount)))
        : 0;
    const currency = sanitizeText(lead.currency || 'USD').toUpperCase() || 'USD';

    return {
        id: `${ownerUid}_${leadId}`,
        leadId,
        ownerUid,
        title: buildFederationConnectOpportunityTitle(lead),
        category,
        contactRole,
        city: sanitizeText(lead.city),
        country: sanitizeText(lead.country),
        strategicValue: sanitizeText(lead.strategicValue || 'standard'),
        tier: sanitizeText(lead.tier || 'T2'),
        sourceDivision: sanitizeText(lead.sourceDivision || 'academy') || 'academy',
        pipelineStage: sanitizeText(lead.pipelineStage || lead.callOutcome || 'Review'),
        sourceMethod: sanitizeText(lead.sourceMethod || 'Lead Missions'),
        contactType: sanitizeText(lead.contactType || category),
        companyLabel: lead.companyName ? 'Private organization on file' : 'Private organization',
        hasEmail: Boolean(sanitizeText(lead.email)),
        hasPhone: Boolean(sanitizeText(lead.phone)),
        hasDirectContact: Boolean(sanitizeText(lead.email) || sanitizeText(lead.phone)),

        sellerPriceAmount,
        universeCommissionRate,
        universeCommissionAmount,
        buyerPriceAmount,
        currency,
        saleReviewStatus: sanitizeText(lead.saleReviewStatus || 'approved'),
        saleStatus: sanitizeText(lead.saleStatus || 'listed'),
        listingAvailability: sanitizeText(lead.listingAvailability || 'lifetime'),
        unlimitedPurchases: lead.unlimitedPurchases !== false,
        purchaseCount: Math.max(0, Number(lead.purchaseCount || 0)),

        summary: sanitizeText(
            lead.notes ||
            lead.description ||
            'Academy-sourced lead marked as Federation-ready by admin.'
        ).slice(0, 220),
        updatedAt: mapFederationConnectTimestamp(lead.updatedAt || lead.adminNetworkUpdatedAt || lead.createdAt),
        createdAt: mapFederationConnectTimestamp(lead.createdAt)
    };
}

function buildFederationLeadAccessGrantId(requesterUid = '', requestId = '') {
    return `fedlead_${sanitizeText(requesterUid)}_${sanitizeText(requestId)}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .slice(0, 240);
}

function normalizeFederationPaymentProvider(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'stripe') return 'stripe';
    if (raw === 'oxapay') return 'oxapay';

    return '';
}

function getFederationPaymentProviderLabel(provider = '') {
    const normalized = normalizeFederationPaymentProvider(provider);

    if (normalized === 'stripe') return 'Stripe';
    if (normalized === 'oxapay') return 'OxaPay';

    return 'Unselected';
}

function getFederationPaymentMethodLabel(provider = '') {
    const normalized = normalizeFederationPaymentProvider(provider);

    if (normalized === 'stripe') return 'card_bank_wallet';
    if (normalized === 'oxapay') return 'crypto';

    return 'unselected';
}

function getOxaPayMerchantApiKey() {
    const key = sanitizeText(
        process.env.OXAPAY_MERCHANT_API_KEY ||
        process.env.OXAPAY_API_KEY ||
        ''
    );

    if (!key) {
        const error = new Error('OXAPAY_MERCHANT_API_KEY is not configured.');
        error.statusCode = 503;
        throw error;
    }

    return key;
}

function isOxaPaySandboxEnabled() {
    return String(process.env.OXAPAY_SANDBOX || '').trim().toLowerCase() === 'true';
}

function buildFederationLeadPurchaseOrderId(requestId = '') {
    return `yh_fedlead_${sanitizeText(requestId)}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .slice(0, 120);
}

function extractFederationRequestIdFromOrderId(orderId = '') {
    const clean = sanitizeText(orderId).toLowerCase();

    if (!clean.startsWith('yh_fedlead_')) return '';

    return sanitizeText(clean.replace(/^yh_fedlead_/, ''));
}

function verifyOxaPayWebhookSignature(rawBody = Buffer.from(''), hmacHeader = '') {
    const merchantKey = getOxaPayMerchantApiKey();
    const expected = crypto
        .createHmac('sha512', merchantKey)
        .update(rawBody)
        .digest('hex');

    const received = sanitizeText(hmacHeader);

    if (!expected || !received) return false;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(received, 'hex')
        );
    } catch (_) {
        return false;
    }
}

async function callOxaPayInvoiceApi(payload = {}) {
    const response = await fetch('https://api.oxapay.com/v1/payment/invoice', {
        method: 'POST',
        headers: {
            merchant_api_key: getOxaPayMerchantApiKey(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let data = null;

    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }

    if (!response.ok || Number(data?.status || 0) >= 400 || data?.error?.message) {
        const error = new Error(
            data?.error?.message ||
            data?.message ||
            `OxaPay invoice request failed with status ${response.status}.`
        );
        error.statusCode = response.status || 500;
        error.payload = data;
        throw error;
    }

    return data || {};
}

function isFederationLeadPurchasePaid(request = {}) {
    const status = sanitizeText(request.status).toLowerCase();
    const paymentStatus = sanitizeText(request.paymentStatus).toLowerCase();

    return (
        status === 'paid' ||
        status === 'intro_delivered' ||
        status === 'completed' ||
        paymentStatus === 'paid'
    );
}

function mapUnlockedFederationLeadDetails(lead = {}, context = {}) {
    const pricingAmount = Math.max(0, Number(context.pricingAmount || lead.buyerPriceAmount || 0));
    const operatorPayoutAmount = Math.max(0, Number(context.operatorPayoutAmount || lead.sellerPriceAmount || 0));
    const platformCommissionAmount = Math.max(0, Number(context.platformCommissionAmount || lead.universeCommissionAmount || 0));
    const currency = sanitizeText(context.currency || lead.currency || 'USD').toUpperCase() || 'USD';

    return {
        leadId: sanitizeText(context.leadId),
        ownerUid: sanitizeText(context.ownerUid),
        requestId: sanitizeText(context.requestId),

        companyName: sanitizeText(lead.companyName),
        companyWebsite: sanitizeText(lead.companyWebsite),
        contactName: sanitizeText(lead.contactName),
        contactRole: sanitizeText(lead.contactRole),
        contactType: sanitizeText(lead.contactType),
        email: sanitizeText(lead.email).toLowerCase(),
        phone: sanitizeText(lead.phone),
        city: sanitizeText(lead.city),
        country: sanitizeText(lead.country),

        tier: sanitizeText(lead.tier),
        sourceMethod: sanitizeText(lead.sourceMethod),
        pipelineStage: sanitizeText(lead.pipelineStage),
        priority: sanitizeText(lead.priority),
        nextAction: sanitizeText(lead.nextAction),
        channel: sanitizeText(lead.channel),
        callOutcome: sanitizeText(lead.callOutcome),
        interestLevel: sanitizeText(lead.interestLevel),
        rapportLevel: sanitizeText(lead.rapportLevel),
        objection: sanitizeText(lead.objection),
        notes: sanitizeText(lead.notes).slice(0, 2000),
        followUpDueDate: sanitizeText(lead.followUpDueDate),

        pricingAmount,
        operatorPayoutAmount,
        platformCommissionAmount,
        currency,

        unlockedAt: mapFederationConnectTimestamp(Timestamp.now())
    };
}

async function ensureFederationLeadAccessGrant({
    requestId = '',
    requesterUid = '',
    request = {},
    leadSnap = null,
    paymentRecordId = ''
} = {}) {
    const cleanRequestId = sanitizeText(requestId);
    const cleanRequesterUid = sanitizeText(requesterUid);
    const ownerUid = sanitizeText(request.ownerUid);
    const leadId = sanitizeText(request.leadId);

    if (!cleanRequestId || !cleanRequesterUid || !ownerUid || !leadId || !leadSnap?.exists) {
        return null;
    }

    const grantId = buildFederationLeadAccessGrantId(cleanRequesterUid, cleanRequestId);
    const now = Timestamp.now();

    const grantPayload = {
        requestId: cleanRequestId,
        requesterUid: cleanRequesterUid,
        requesterEmail: sanitizeText(request.requesterEmail).toLowerCase(),
        requesterName: sanitizeText(request.requesterName || 'Federation Member'),

        ownerUid,
        leadId,
        leadPath: sanitizeText(leadSnap.ref.path),

        sourceDivision: 'federation',
        sourceFeature: 'lead_purchase',
        accessStatus: 'unlocked',
        paymentStatus: 'paid',
        paymentRecordId: sanitizeText(paymentRecordId || request.paymentLedgerId || ''),
        federationRequestId: cleanRequestId,

        pricingAmount: Math.max(0, Number(request.pricingAmount || 0)),
        currency: sanitizeText(request.currency || 'USD').toUpperCase() || 'USD',
        platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
        operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

        unlockedAt: now,
        updatedAt: now,
        createdAt: now
    };

    const grantRef = firestore.collection('federationLeadAccessGrants').doc(grantId);
    const existingGrant = await grantRef.get();

    await grantRef.set({
        ...grantPayload,
        ...(existingGrant.exists ? { createdAt: existingGrant.data()?.createdAt || now } : {})
    }, { merge: true });

    await firestore.collection('federationConnectionRequests').doc(cleanRequestId).set({
        leadAccessGrantId: grantId,
        leadAccessStatus: 'unlocked',
        leadUnlockedAt: now,
        updatedAt: now
    }, { merge: true });

    await leadSnap.ref.set({
        saleStatus: 'listed',
        federationListingStatus: 'listed',
        listingAvailability: 'lifetime',
        unlimitedPurchases: true,
        lastPurchasedAt: now,
        updatedAt: now,
        ...(!existingGrant.exists ? { purchaseCount: FieldValue.increment(1) } : {})
    }, { merge: true });

    const nextSnap = await grantRef.get();
    const grant = nextSnap.data() || {};

    return {
        id: grantId,
        requestId: sanitizeText(grant.requestId),
        ownerUid: sanitizeText(grant.ownerUid),
        leadId: sanitizeText(grant.leadId),
        requesterUid: sanitizeText(grant.requesterUid),
        accessStatus: sanitizeText(grant.accessStatus || 'unlocked'),
        paymentStatus: sanitizeText(grant.paymentStatus || 'paid'),
        unlockedAt: mapFederationConnectTimestamp(grant.unlockedAt),
        updatedAt: mapFederationConnectTimestamp(grant.updatedAt)
    };
}

const AUTH_COOKIE_NAME = 'yh_auth_token';

let yhStripeClient = null;

function getStripeClient() {
    const secretKey = sanitizeText(process.env.STRIPE_SECRET_KEY);

    if (!secretKey) {
        const error = new Error('STRIPE_SECRET_KEY is not configured.');
        error.statusCode = 503;
        throw error;
    }

    if (!yhStripeClient) {
        const Stripe = require('stripe');
        yhStripeClient = new Stripe(secretKey);
    }

    return yhStripeClient;
}

function resolvePublicBaseUrl(req = null) {
    const envBase = sanitizeText(
        process.env.PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.BASE_URL
    ).replace(/\/+$/, '');

    if (envBase) return envBase;

    const protocol = sanitizeText(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http').split(',')[0];
    const host = sanitizeText(req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:3000').split(',')[0];

    return `${protocol}://${host}`.replace(/\/+$/, '');
}

function isStripeZeroDecimalCurrency(currency = 'USD') {
    const zeroDecimalCurrencies = new Set([
        'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW',
        'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF',
        'XOF', 'XPF'
    ]);

    return zeroDecimalCurrencies.has(String(currency || '').trim().toUpperCase());
}

function toStripeMinorUnit(amount = 0, currency = 'USD') {
    const numeric = Number(amount || 0);

    if (!Number.isFinite(numeric) || numeric <= 0) return 0;

    return isStripeZeroDecimalCurrency(currency)
        ? Math.round(numeric)
        : Math.round(numeric * 100);
}

function isFederationPaidStatus(value = '') {
    const clean = sanitizeText(value).toLowerCase();
    return clean === 'paid' || clean === 'completed' || clean === 'intro_delivered';
}

async function syncStripePaidFederationRequestToAcademyEconomy(request = {}, action = 'stripe_checkout_completed') {
    try {
        const requestId = sanitizeText(request.id);
        const ownerUid = sanitizeText(request.ownerUid);
        const leadId = sanitizeText(request.leadId);

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
        const pricingAmount = Math.max(0, Number(request.pricingAmount || request.dealPackage?.pricingAmount || 0));
        const platformCommissionRate = Math.max(0, Math.min(100, Number(request.platformCommissionRate || request.dealPackage?.platformCommissionRate || 0)));
        const platformCommissionAmount = Math.max(0, Number(request.platformCommissionAmount || request.dealPackage?.platformCommissionAmount || 0));
        const operatorPayoutAmount = Math.max(0, Number(request.operatorPayoutAmount || request.dealPackage?.operatorPayoutAmount || 0));
        const currency = sanitizeText(request.currency || request.dealPackage?.currency || 'USD').toUpperCase() || 'USD';
        const mirrorId = `fedreq_${requestId}`;

        const dealRef = userRef.collection('academyLeadDeals').doc(mirrorId);
        const payoutRef = userRef.collection('academyLeadPayouts').doc(mirrorId);

        const [dealSnap, payoutSnap] = await Promise.all([
            dealRef.get(),
            payoutRef.get()
        ]);

        const adminNote = sanitizeText(
            request.dealNotes ||
            `Stripe payment confirmed for Federation paid introduction via ${action}.`
        ).slice(0, 900);

        await dealRef.set({
            leadId,
            federationRequestId: requestId,
            dealType: 'federation_paid_introduction',
            dealStatus: 'paid',
            grossValue: pricingAmount,
            currency,
            platformCommissionRate,
            platformCommissionAmount,
            operatorPayoutAmount,
            paymentStatus: 'paid',
            payoutStatus: 'approved',
            commissionStatus: 'earned',
            stripeCheckoutSessionId: sanitizeText(request.stripeCheckoutSessionId),
            stripePaymentIntentId: sanitizeText(request.stripePaymentIntentId),
            opportunityTitle: sanitizeText(request.opportunityTitle || 'Federation paid introduction'),
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
                status: 'approved',
                adminNote,
                sourceDivision: 'federation',
                sourceFeature: 'connect',
                dealGrossValue: pricingAmount,
                platformCommissionRate,
                platformCommissionAmount,
                paymentStatus: 'paid',
                commissionStatus: 'earned',
                stripeCheckoutSessionId: sanitizeText(request.stripeCheckoutSessionId),
                stripePaymentIntentId: sanitizeText(request.stripePaymentIntentId),
                ...(payoutSnap.exists ? {} : { createdAt: now }),
                approvedAt: now,
                updatedAt: now
            }, { merge: true });
        }

        await leadRef.set({
            federationRequestId: requestId,
            lastFederationRequestStatus: 'paid',
            lastFederationDealStatus: 'paid',
            lastFederationDealValue: pricingAmount,
            lastFederationOperatorPayout: operatorPayoutAmount,
            lastFederationPaymentStatus: 'paid',
            lastFederationEconomySyncedAt: now,
            updatedAt: now
        }, { merge: true });

        return true;
    } catch (error) {
        console.error('sync stripe paid federation request to academy economy error:', error);
        return false;
    }
}

function parseCookieHeader(raw = '') {
    const out = {};

    String(raw || '').split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;
        out[key] = decodeURIComponent(value);
    });

    return out;
}

function getSocketToken(socket) {
    const handshakeToken = sanitizeText(socket.handshake?.auth?.token);
    if (handshakeToken) return handshakeToken;

    const cookies = parseCookieHeader(socket.handshake?.headers?.cookie || '');
    return sanitizeText(cookies[AUTH_COOKIE_NAME]);
}

function verifySocketUser(socket) {
    const token = getSocketToken(socket);
    if (!token) return null;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: sanitizeText(verified?.id || verified?.firebaseUid),
            firebaseUid: sanitizeText(verified?.firebaseUid || verified?.id),
            email: sanitizeText(verified?.email).toLowerCase(),
            username: sanitizeText(verified?.username),
            name: sanitizeText(verified?.name || verified?.username || 'Hustler')
        };
    } catch (_) {
        return null;
    }
}
function getRequestToken(req) {
    const authHeader = sanitizeText(req.headers?.authorization || '');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return sanitizeText(authHeader.slice(7));
    }

    const headerToken = sanitizeText(req.headers?.['x-auth-token'] || '');
    if (headerToken) return headerToken;

    const cookies = parseCookieHeader(req.headers?.cookie || '');
    return sanitizeText(cookies[AUTH_COOKIE_NAME]);
}

function verifyRequestUser(req) {
    const token = getRequestToken(req);
    if (!token) return null;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: sanitizeText(verified?.id || verified?.firebaseUid),
            firebaseUid: sanitizeText(verified?.firebaseUid || verified?.id),
            email: sanitizeText(verified?.email).toLowerCase(),
            username: sanitizeText(verified?.username),
            name: sanitizeText(verified?.name || verified?.username || 'Hustler')
        };
    } catch (_) {
        return null;
    }
}

function requireApiUser(req, res, next) {
    const user = verifyRequestUser(req);

    if (!user?.id) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized.'
        });
    }

    req.user = user;
    next();
}
function getAcademyVoiceSignalingRoom(roomId = '') {
    return `academy-voice:${sanitizeText(roomId)}`;
}

async function canUserAccessLiveRoom(userId, roomId) {
    const cleanUserId = sanitizeText(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanUserId || !cleanRoomId) return false;

    const snap = await liveRoomsCol.doc(cleanRoomId).get();
    if (!snap.exists) return false;

    const data = snap.data() || {};
    const status = sanitizeText(data.status || 'live').toLowerCase();

    if (status !== 'live') return false;

    const participantIds = Array.isArray(data.participant_ids)
        ? data.participant_ids.map((value) => String(value)).filter(Boolean)
        : [];

    return participantIds.includes(String(cleanUserId));
}

async function canUserAccessRoom(userId, roomId) {
    if (!userId || !roomId) return false;
    if (roomId === 'YH-community' || roomId === 'main-chat') return true;

    const snap = await chatRoomsCol.doc(roomId).get();

    if (!snap.exists) {
        return canUserAccessLiveRoom(userId, roomId);
    }

    const data = snap.data() || {};
    const memberIds = Array.isArray(data.member_ids)
        ? data.member_ids.map((value) => String(value))
        : [];
    const blockedByUserIds = Array.isArray(data.blocked_by_user_ids)
        ? data.blocked_by_user_ids.map((value) => String(value))
        : [];

    if (!memberIds.includes(String(userId))) return false;
    if (blockedByUserIds.includes(String(userId))) return false;

    return true;
}

async function getAcademyProfileAccessBlockStatus(viewerId = '', targetUserId = '') {
    const cleanViewerId = sanitizeText(viewerId);
    const cleanTargetUserId = sanitizeText(targetUserId);

    if (!cleanViewerId || !cleanTargetUserId || cleanViewerId === cleanTargetUserId) {
        return {
            blocked: false,
            roomId: ''
        };
    }

    const roomsSnap = await chatRoomsCol
        .where('member_ids', 'array-contains', cleanViewerId)
        .limit(100)
        .get();

    for (const doc of roomsSnap.docs) {
        const roomData = doc.data() || {};

        const memberIds = Array.isArray(roomData.member_ids)
            ? roomData.member_ids.map((value) => String(value)).filter(Boolean)
            : [];

        if (!memberIds.includes(cleanTargetUserId)) continue;

        const roomType = sanitizeText(roomData.room_type || roomData.type).toLowerCase();
        const isDirectRoom = roomType === 'dm' || memberIds.length === 2;

        if (!isDirectRoom) continue;

        const blockedByUserIds = Array.isArray(roomData.blocked_by_user_ids)
            ? roomData.blocked_by_user_ids.map((value) => String(value)).filter(Boolean)
            : [];

        const blockedByOwnerUserIds = Array.isArray(roomData.blocked_by_owner_user_ids)
            ? roomData.blocked_by_owner_user_ids.map((value) => String(value)).filter(Boolean)
            : [];

        const targetBlockedViewer =
            blockedByUserIds.includes(cleanViewerId) &&
            (
                blockedByOwnerUserIds.includes(cleanTargetUserId) ||
                !blockedByOwnerUserIds.length
            );

        if (targetBlockedViewer) {
            return {
                blocked: true,
                roomId: doc.id
            };
        }
    }

    return {
        blocked: false,
        roomId: ''
    };
}

async function markRoomAsReadForUser(userId, roomId) {
    const cleanUserId = sanitizeText(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanUserId || !cleanRoomId) return false;
    if (cleanRoomId === 'YH-community' || cleanRoomId === 'main-chat') return true;

    const roomRef = chatRoomsCol.doc(cleanRoomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return false;

    const roomData = roomSnap.data() || {};
    const unreadCounts =
        roomData.unread_counts && typeof roomData.unread_counts === 'object'
            ? { ...roomData.unread_counts }
            : {};

    unreadCounts[cleanUserId] = 0;

    await roomRef.set({
        unread_counts: unreadCounts,
        updated_at: Timestamp.now()
    }, { merge: true });

    return true;
}

function getChatRoomStringArray(roomData = {}, key = '') {
    return Array.isArray(roomData?.[key])
        ? roomData[key].map((value) => String(value)).filter(Boolean)
        : [];
}

function getChatRoomMemberIds(roomData = {}) {
    return getChatRoomStringArray(roomData, 'member_ids');
}

function isChatRoomDirectMessage(roomData = {}) {
    const roomType = sanitizeText(roomData.room_type || roomData.type).toLowerCase();
    const memberIds = getChatRoomMemberIds(roomData);

    return roomType === 'dm' || memberIds.length === 2;
}

async function getUserOwnedChatRoomActionContext(userId = '', roomId = '') {
    const cleanUserId = sanitizeText(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanUserId || !cleanRoomId || cleanRoomId === 'YH-community' || cleanRoomId === 'main-chat') {
        return {
            ok: false,
            status: 400,
            message: 'Valid private room is required.'
        };
    }

    const roomRef = chatRoomsCol.doc(cleanRoomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) {
        return {
            ok: false,
            status: 404,
            message: 'Conversation not found.'
        };
    }

    const roomData = roomSnap.data() || {};
    const memberIds = getChatRoomMemberIds(roomData);

    if (!memberIds.includes(String(cleanUserId))) {
        return {
            ok: false,
            status: 403,
            message: 'Access denied for this room.'
        };
    }

    return {
        ok: true,
        roomRef,
        roomSnap,
        roomData,
        memberIds,
        otherMemberIds: memberIds.filter((memberId) => memberId && memberId !== String(cleanUserId))
    };
}

function sendChatRoomActionError(res, context) {
    return res.status(context?.status || 500).json({
        success: false,
        message: context?.message || 'Conversation action failed.'
    });
}
function mapChatMessageDoc(doc) {
    const data = doc.data() || {};
    const authorId = sanitizeText(
        data.created_by_user_id ||
        data.createdByUserId ||
        data.author_id ||
        data.authorId ||
        data.user_id ||
        data.userId
    );

    return {
        id: doc.id,
        room: sanitizeText(data.room),
        author: sanitizeText(data.author),
        authorId,
        author_id: authorId,
        createdByUserId: authorId,
        created_by_user_id: authorId,
        initial: sanitizeText(data.initial),
        avatar: sanitizeText(data.avatar),
        text: sanitizeText(data.text),
        time: sanitizeText(data.time || mapChatTimestamp(data.created_at)),
        upvotes: Number.isFinite(Number(data.upvotes)) ? Number(data.upvotes) : 0
    };
}

function sanitizeLeadMissionTextArray(value, maxItems = 32) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .map((item) => item.slice(0, 120))
        .slice(0, maxItems);
}
function sanitizeFederationTextArray(value, maxItems = 32, maxLength = 140) {
    const source = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[,|\n]/)
            .map((item) => item.trim());

    const seen = new Set();

    return source
        .map((item) => sanitizeText(item).slice(0, maxLength))
        .filter(Boolean)
        .filter((item) => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, maxItems);
}

function getFederationProfileHaystack(profile = {}) {
    return [
        profile.role,
        profile.primaryCategory,
        profile.level,
        profile.audienceSize,
        profile.capitalRange,
        profile.teamSize,
        profile.skillLevel,
        profile.lookingFor,
        profile.canOffer,
        profile.wantsAccessTo,
        profile.opportunityInsight,
        profile.tenKPlan,
        ...(Array.isArray(profile.roles) ? profile.roles : []),
        ...(Array.isArray(profile.activePlatforms) ? profile.activePlatforms : []),
        ...(Array.isArray(profile.openTo) ? profile.openTo : [])
    ]
        .map((item) => sanitizeText(item).toLowerCase())
        .filter(Boolean)
        .join(' ');
}

function federationProfileHas(profile = {}, keywords = []) {
    const haystack = getFederationProfileHaystack(profile);
    return keywords.some((keyword) => haystack.includes(String(keyword || '').toLowerCase()));
}

function inferFederationCategoryFromProfile(profile = {}) {
    if (federationProfileHas(profile, ['lawyer', 'legal', 'attorney', 'solicitor'])) {
        return 'Lawyers & Legal Strategists';
    }

    if (federationProfileHas(profile, ['politician', 'policy', 'government', 'public office', 'advisor'])) {
        return 'Politicians & Policy Advisors';
    }

    if (federationProfileHas(profile, ['founder', 'business owner', 'ceo', 'executive', 'investor', 'capital'])) {
        return 'Entrepreneurs & Investors';
    }

    if (federationProfileHas(profile, ['influencer', 'creator', 'media', 'content', 'audience'])) {
        return 'Influencers & Media Architects';
    }

    if (federationProfileHas(profile, ['cybersecurity', 'security', 'infosec', 'osint'])) {
        return 'Cybersecurity Experts';
    }

    return 'Operators Across Industries';
}

function getFederationTier(score = 0) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

    if (safeScore >= 90) return 'CORE';
    if (safeScore >= 70) return 'OPERATOR';
    if (safeScore >= 50) return 'CONTRIBUTOR';

    return 'LOW_PRIORITY';
}

function calculateFederationScore(profile = {}) {
    let roleScore = 0;
    let levelScore = 0;
    let resourceScore = 0;
    let intentScore = 0;
    let thinkingScore = 0;

    if (federationProfileHas(profile, ['founder', 'business owner', 'ceo', 'executive', 'investor'])) {
        roleScore = 25;
    } else if (
        federationProfileHas(profile, [
            'influencer',
            'creator',
            'developer',
            'engineer',
            'automation',
            'ai specialist',
            'cybersecurity',
            'marketer',
            'growth',
            'lawyer',
            'doctor',
            'politician',
            'real estate',
            'athlete'
        ])
    ) {
        roleScore = 20;
    } else if (sanitizeText(profile.role) || (Array.isArray(profile.roles) && profile.roles.length)) {
        roleScore = 12;
    }

    const level = sanitizeText(profile.level).toLowerCase();

    if (level.includes('50k') || level.includes('high-level') || level.includes('strong influence')) {
        levelScore = 25;
    } else if (level.includes('10k') || level.includes('established')) {
        levelScore = 20;
    } else if (level.includes('1k') || level.includes('growing')) {
        levelScore = 15;
    } else if (level.includes('early')) {
        levelScore = 8;
    } else if (level.includes('starting')) {
        levelScore = 3;
    }

    const audience = sanitizeText(profile.audienceSize).toLowerCase();
    if (audience.includes('1m')) resourceScore += 10;
    else if (audience.includes('100k')) resourceScore += 9;
    else if (audience.includes('10k')) resourceScore += 7;
    else if (audience.includes('<10k') || audience.includes('under 10k')) resourceScore += 3;

    const capital = sanitizeText(profile.capitalRange).toLowerCase();
    if (capital.includes('100k')) resourceScore += 10;
    else if (capital.includes('10k')) resourceScore += 8;
    else if (capital.includes('1k')) resourceScore += 5;
    else if (capital.includes('<$1k') || capital.includes('under')) resourceScore += 2;

    const team = sanitizeText(profile.teamSize).toLowerCase();
    if (team.includes('10+')) resourceScore += 5;
    else if (team.includes('3–10') || team.includes('3-10')) resourceScore += 3;
    else if (team.includes('1–3') || team.includes('1-3')) resourceScore += 1;

    const skill = sanitizeText(profile.skillLevel).toLowerCase();
    if (skill.includes('elite')) resourceScore += 5;
    else if (skill.includes('advanced')) resourceScore += 4;
    else if (skill.includes('intermediate')) resourceScore += 2;

    resourceScore = Math.min(resourceScore, 25);

    const openTo = Array.isArray(profile.openTo) ? profile.openTo.map((item) => sanitizeText(item).toLowerCase()) : [];

    if (openTo.some((item) => item.includes('all'))) {
        intentScore = 15;
    } else if (openTo.length >= 3) {
        intentScore = 12;
    } else if (openTo.length >= 1) {
        intentScore = 7;
    }

    if (sanitizeText(profile.lookingFor).length > 20) intentScore += 3;
    if (sanitizeText(profile.canOffer).length > 20) intentScore += 3;

    intentScore = Math.min(intentScore, 15);

    const opportunityLength = sanitizeText(profile.opportunityInsight).length;
    const tenKLength = sanitizeText(profile.tenKPlan).length;

    if (opportunityLength >= 80 && tenKLength >= 80) {
        thinkingScore = 10;
    } else if (opportunityLength >= 40 && tenKLength >= 40) {
        thinkingScore = 7;
    } else if (opportunityLength >= 20 || tenKLength >= 20) {
        thinkingScore = 4;
    }

    return Math.max(0, Math.min(100, roleScore + levelScore + resourceScore + intentScore + thinkingScore));
}

function deriveFederationTags(profile = {}, score = 0) {
    const tags = new Set();

    const addRoleTag = (role = '') => {
        const clean = sanitizeText(role)
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (clean) tags.add(`ROLE_${clean}`);
    };

    (Array.isArray(profile.roles) ? profile.roles : []).forEach(addRoleTag);

    if (sanitizeText(profile.role)) addRoleTag(profile.role);

    if (federationProfileHas(profile, ['founder', 'business owner', 'ceo'])) tags.add('BUILDER');
    if (federationProfileHas(profile, ['investor', 'capital'])) tags.add('CAPITAL');
    if (federationProfileHas(profile, ['influencer', 'creator', 'audience', 'media'])) tags.add('AUDIENCE');
    if (federationProfileHas(profile, ['developer', 'engineer', 'automation', 'ai', 'cybersecurity'])) tags.add('TECHNICAL_OPERATOR');
    if (federationProfileHas(profile, ['lawyer', 'legal'])) tags.add('LEGAL');
    if (federationProfileHas(profile, ['politician', 'policy', 'government'])) tags.add('POLICY');

    if (sanitizeText(profile.audienceSize) && sanitizeText(profile.audienceSize).toLowerCase() !== 'none') {
        tags.add('HAS_AUDIENCE');
    }

    if (sanitizeText(profile.capitalRange) && sanitizeText(profile.capitalRange).toLowerCase() !== 'none') {
        tags.add('HAS_CAPITAL');
    }

    if (sanitizeText(profile.teamSize) && !['none', 'solo'].includes(sanitizeText(profile.teamSize).toLowerCase())) {
        tags.add('HAS_TEAM');
    }

    const openTo = Array.isArray(profile.openTo) ? profile.openTo : [];

    openTo.forEach((item) => {
        const clean = sanitizeText(item)
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (clean) tags.add(`OPEN_${clean}`);
    });

    tags.add(`TIER_${getFederationTier(score)}`);

    return Array.from(tags).slice(0, 40);
}

function buildFederationProfileMap(body = {}, fallback = {}) {
    const roles = sanitizeFederationTextArray(
        body.roles ||
        body.roleTags ||
        body.currentPositions ||
        body.currentPosition,
        16,
        120
    );

    const role = sanitizeText(body.role || body.profession || roles[0] || fallback.role).slice(0, 180);

    const baseProfile = {
        roles: roles.length ? roles : (role ? [role] : []),
        role,
        primaryCategory: sanitizeText(body.primaryCategory || body.category).slice(0, 180),

        level: sanitizeText(body.level).slice(0, 120),

        audienceSize: sanitizeText(body.audienceSize).slice(0, 120),
        activePlatforms: sanitizeFederationTextArray(body.activePlatforms, 12, 80),
        capitalRange: sanitizeText(body.capitalRange).slice(0, 120),
        teamSize: sanitizeText(body.teamSize).slice(0, 120),
        skillLevel: sanitizeText(body.skillLevel).slice(0, 120),

        lookingFor: sanitizeText(body.lookingFor || body.lookingForContact || body.wantedContactReason).slice(0, 1200),
        canOffer: sanitizeText(body.canOffer || body.valueBring || body.networkValue).slice(0, 1200),
        wantsAccessTo: sanitizeText(body.wantsAccessTo || body.wantedContactTypesRaw || body.introductions).slice(0, 1200),
        openTo: sanitizeFederationTextArray(body.openTo, 12, 80),

        opportunityInsight: sanitizeText(body.opportunityInsight).slice(0, 2500),
        tenKPlan: sanitizeText(body.tenKPlan).slice(0, 2500),
        openToFeature: sanitizeText(body.openToFeature).slice(0, 80),

        profileVersion: 1
    };

    const primaryCategory =
        baseProfile.primaryCategory ||
        inferFederationCategoryFromProfile(baseProfile);

    const profile = {
        ...baseProfile,
        primaryCategory
    };

    const score = calculateFederationScore(profile);
    const tier = getFederationTier(score);
    const tags = deriveFederationTags(profile, score);

    return {
        ...profile,
        score,
        tier,
        tags,
        resources: {
            audienceSize: profile.audienceSize,
            activePlatforms: profile.activePlatforms,
            capitalRange: profile.capitalRange,
            teamSize: profile.teamSize,
            skillLevel: profile.skillLevel
        },
        intent: {
            lookingFor: profile.lookingFor,
            canOffer: profile.canOffer,
            wantsAccessTo: profile.wantsAccessTo,
            openTo: profile.openTo
        },
        thinking: {
            opportunityInsight: profile.opportunityInsight,
            tenKPlan: profile.tenKPlan
        }
    };
}
function mapFirestoreDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
}

function mapLeadMissionOperatorProfileDoc(doc) {
    const data = doc?.data?.() || {};

    return {
        id: doc.id,
        userId: sanitizeText(data.userId || doc.id),
        firebaseUid: sanitizeText(data.firebaseUid),
        email: sanitizeText(data.email),
        username: sanitizeText(data.username),
        fullName: sanitizeText(data.fullName),
        telegram: sanitizeText(data.telegram),
        country: sanitizeText(data.country),
        city: sanitizeText(data.city),
        timezone: sanitizeText(data.timezone),

        targetCategories: Array.isArray(data.targetCategories) ? data.targetCategories : [],
        strongestNiches: Array.isArray(data.strongestNiches) ? data.strongestNiches : [],
        searchPlatforms: Array.isArray(data.searchPlatforms) ? data.searchPlatforms : [],
        networkTypes: Array.isArray(data.networkTypes) ? data.networkTypes : [],

        hasLeadGenExperience: sanitizeText(data.hasLeadGenExperience),
        knowsInfluentialPeople: sanitizeText(data.knowsInfluentialPeople),
        weeklyLeadCapacity: sanitizeText(data.weeklyLeadCapacity),
        coverageRegion: sanitizeText(data.coverageRegion),

        motivation: sanitizeText(data.motivation),
        strategicValueAnswer: sanitizeText(data.strategicValueAnswer),
        followsInstructions: sanitizeText(data.followsInstructions),
        interestedInFederation: sanitizeText(data.interestedInFederation),
        interestedInPlaza: sanitizeText(data.interestedInPlaza),

        qualityAgreement: data.qualityAgreement === true,
        noFakeLeadsAgreement: data.noFakeLeadsAgreement === true,
        noSpamAgreement: data.noSpamAgreement === true,
        accessRiskAgreement: data.accessRiskAgreement === true,

        completed: data.completed === true,
        status: sanitizeText(data.status || 'active'),
        strategicValue: sanitizeText(data.strategicValue || 'unrated'),
        federationReady: data.federationReady === true,
        plazaReady: data.plazaReady === true,

        createdAt: mapFirestoreDate(data.createdAt),
        submittedAt: mapFirestoreDate(data.submittedAt),
        updatedAt: mapFirestoreDate(data.updatedAt)
    };
}

function normalizeLeadMissionOperatorProfilePayload(body = {}, user = {}) {
    const fullName = sanitizeText(body.fullName || user.name).slice(0, 140);
    const email = sanitizeText(user.email || body.email).toLowerCase().slice(0, 180);
    const telegram = sanitizeText(body.telegram).slice(0, 80);
    const country = sanitizeText(body.country).slice(0, 100);
    const city = sanitizeText(body.city).slice(0, 100);
    const timezone = sanitizeText(body.timezone).slice(0, 80);

    const profile = {
        userId: sanitizeText(user.id),
        firebaseUid: sanitizeText(user.firebaseUid || user.id),
        email,
        username: sanitizeText(user.username).slice(0, 80),
        fullName,
        telegram,
        country,
        city,
        timezone,

        targetCategories: sanitizeLeadMissionTextArray(body.targetCategories),
        strongestNiches: sanitizeLeadMissionTextArray(body.strongestNiches),
        searchPlatforms: sanitizeLeadMissionTextArray(body.searchPlatforms),
        networkTypes: sanitizeLeadMissionTextArray(body.networkTypes),

        hasLeadGenExperience: sanitizeText(body.hasLeadGenExperience).slice(0, 40),
        knowsInfluentialPeople: sanitizeText(body.knowsInfluentialPeople).slice(0, 40),
        weeklyLeadCapacity: sanitizeText(body.weeklyLeadCapacity).slice(0, 80),
        coverageRegion: sanitizeText(body.coverageRegion).slice(0, 140),

        motivation: sanitizeText(body.motivation).slice(0, 2500),
        strategicValueAnswer: sanitizeText(body.strategicValueAnswer).slice(0, 2500),
        followsInstructions: sanitizeText(body.followsInstructions).slice(0, 40),
        interestedInFederation: sanitizeText(body.interestedInFederation).slice(0, 40),
        interestedInPlaza: sanitizeText(body.interestedInPlaza).slice(0, 40),

        qualityAgreement: body.qualityAgreement === true,
        noFakeLeadsAgreement: body.noFakeLeadsAgreement === true,
        noSpamAgreement: body.noSpamAgreement === true,
        accessRiskAgreement: body.accessRiskAgreement === true,

        completed: true,
        status: sanitizeText(body.status || 'active').slice(0, 40) || 'active',
        strategicValue: sanitizeText(body.strategicValue || 'unrated').slice(0, 80) || 'unrated',
        federationReady: body.federationReady === true,
        plazaReady: body.plazaReady === true,

        source: 'academy_lead_missions_recruitment_form',
        profileVersion: 1
    };

    const missing = [];

    if (!profile.userId) missing.push('userId');
    if (!profile.fullName) missing.push('fullName');
    if (!profile.email) missing.push('email');
    if (!profile.telegram) missing.push('telegram');
    if (!profile.country) missing.push('country');
    if (!profile.city) missing.push('city');
    if (!profile.targetCategories.length) missing.push('targetCategories');
    if (!profile.strongestNiches.length) missing.push('strongestNiches');
    if (!profile.searchPlatforms.length) missing.push('searchPlatforms');
    if (!profile.hasLeadGenExperience) missing.push('hasLeadGenExperience');
    if (!profile.knowsInfluentialPeople) missing.push('knowsInfluentialPeople');
    if (!profile.weeklyLeadCapacity) missing.push('weeklyLeadCapacity');
    if (!profile.coverageRegion) missing.push('coverageRegion');
    if (!profile.motivation) missing.push('motivation');
    if (!profile.strategicValueAnswer) missing.push('strategicValueAnswer');
    if (!profile.followsInstructions) missing.push('followsInstructions');

    if (!profile.qualityAgreement) missing.push('qualityAgreement');
    if (!profile.noFakeLeadsAgreement) missing.push('noFakeLeadsAgreement');
    if (!profile.noSpamAgreement) missing.push('noSpamAgreement');
    if (!profile.accessRiskAgreement) missing.push('accessRiskAgreement');

    return {
        profile,
        missing
    };
}

// ==========================================
// ⚡ REAL-TIME SOCKET.IO LOGIC
// ==========================================
io.on('connection', (socket) => {
    const socketUser = verifySocketUser(socket);

    if (!socketUser?.id) {
        socket.emit('socketAuthError', { message: 'Unauthorized socket session.' });
        socket.disconnect(true);
        return;
    }

    socket.user = socketUser;
    console.log('⚡ A hustler connected:', socket.id, socket.user.id);

    socket.on('joinRoom', async (room) => {
        try {
            const roomId = sanitizeText(room);
            if (!roomId) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('socketRoomError', { roomId, message: 'Access denied for this room.' });
                return;
            }

            socket.join(roomId);

            const historySnap = await chatMessagesCol
                .where('room', '==', roomId)
                .limit(200)
                .get();

            const history = historySnap.docs
                .map(mapChatMessageDoc)
                .sort((a, b) => {
                    const aTime = new Date(a.time || 0).getTime();
                    const bTime = new Date(b.time || 0).getTime();
                    return aTime - bTime;
                })
                .slice(-50);

            socket.emit('chatHistory', history);
        } catch (error) {
            console.error('joinRoom error:', error);
        }
    });

    socket.on('sendMessage', async (data) => {
        try {
            const roomId = sanitizeText(data?.room);
            const text = sanitizeText(data?.text);

            if (!roomId || !text) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('sendMessageError', {
                    roomId,
                    message: 'You can no longer access this conversation.'
                });
                return;
            }

            const roomRef = chatRoomsCol.doc(roomId);
            const roomSnap = await roomRef.get();
            const roomData = roomSnap.exists ? (roomSnap.data() || {}) : {};
            const memberIds = roomSnap.exists ? getChatRoomMemberIds(roomData) : [];

            if (roomSnap.exists) {
                const blockedByUserIds = getChatRoomStringArray(roomData, 'blocked_by_user_ids');
                if (blockedByUserIds.includes(String(socket.user.id))) {
                    socket.emit('sendMessageError', {
                        roomId,
                        message: 'You can no longer send messages in this conversation.'
                    });
                    return;
                }

                const restrictedByUserIds = getChatRoomStringArray(roomData, 'restricted_by_user_ids');
                const recipientIds = memberIds.filter((memberId) => {
                    return memberId && memberId !== String(socket.user.id);
                });

                const recipientRestrictedSender = recipientIds.some((memberId) => {
                    return restrictedByUserIds.includes(String(memberId));
                });

                if (recipientRestrictedSender) {
                    socket.emit('sendMessageError', {
                        roomId,
                        message: 'This member has restricted messages from you.'
                    });
                    return;
                }
            }

            const authorName = sanitizeText(socket.user.name || socket.user.username || 'Hustler');

            const payload = {
                room: roomId,
                author: authorName,
                initial: authorName.charAt(0).toUpperCase(),
                avatar: '',
                text,
                time: new Date().toISOString(),
                upvotes: 0,
                created_at: Timestamp.now(),
                created_by_user_id: socket.user.id
            };

            const ref = chatMessagesCol.doc();
            await ref.set(payload);

            if (roomSnap.exists) {
                const unreadCounts =
                    roomData.unread_counts && typeof roomData.unread_counts === 'object'
                        ? { ...roomData.unread_counts }
                        : {};

                memberIds.forEach((memberId) => {
                    unreadCounts[memberId] =
                        String(memberId) === String(socket.user.id)
                            ? 0
                            : (Number(unreadCounts[memberId]) || 0) + 1;
                });

                const hiddenForUserIds = getChatRoomStringArray(roomData, 'hidden_for_user_ids');

                const nextHiddenForUserIds = hiddenForUserIds.filter((value) => {
                    return !memberIds.includes(String(value));
                });

                await roomRef.set({
                    last_message_text: text,
                    last_message_author: authorName,
                    last_message_at: Timestamp.now(),
                    unread_counts: unreadCounts,
                    hidden_for_user_ids: nextHiddenForUserIds,
                    updated_at: Timestamp.now()
                }, { merge: true });
            }

            const outgoing = {
                id: ref.id,
                room: payload.room,
                author: payload.author,
                authorId: payload.created_by_user_id,
                author_id: payload.created_by_user_id,
                createdByUserId: payload.created_by_user_id,
                created_by_user_id: payload.created_by_user_id,
                initial: payload.initial,
                avatar: payload.avatar,
                text: payload.text,
                time: payload.time,
                upvotes: 0
            };

            io.to(payload.room).emit('receiveMessage', outgoing);
        } catch (error) {
            console.error('sendMessage error:', error);
        }
    });

    socket.on('upvoteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            const nextUpvotes = (Number(current.upvotes) || 0) + 1;

            await ref.update({
                upvotes: nextUpvotes
            });

            io.to(roomId).emit('messageUpvoted', {
                id: messageId,
                upvotes: nextUpvotes
            });
        } catch (error) {
            console.error('upvoteMessage error:', error);
        }
    });

    socket.on('deleteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const ownerId = sanitizeText(current.created_by_user_id);
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            if (!ownerId || ownerId !== socket.user.id) {
                socket.emit('messageDeleteError', {
                    id: messageId,
                    message: 'Only the original sender can delete this message.'
                });
                return;
            }

            await ref.delete();
            io.to(roomId).emit('messageDeleted', messageId);
        } catch (error) {
            console.error('deleteMessage error:', error);
        }
    });
    function getSocketVoiceDisplayName() {
        return sanitizeText(
            socket.user?.name ||
            socket.user?.fullName ||
            socket.user?.username ||
            'Hustler'
        );
    }

    function leaveAcademyVoiceSignalingRoom(reason = 'left') {
        const roomId = sanitizeText(socket.data?.academyVoiceRoomId || '');
        if (!roomId) return;

        const signalingRoom = getAcademyVoiceSignalingRoom(roomId);

        socket.to(signalingRoom).emit('academyVoice:peerLeft', {
            roomId,
            socketId: socket.id,
            userId: socket.user?.id || '',
            reason
        });

        socket.leave(signalingRoom);
        socket.data.academyVoiceRoomId = '';
    }

    function isTargetSocketInAcademyVoiceRoom(roomId = '', targetSocketId = '') {
        const signalingRoom = getAcademyVoiceSignalingRoom(roomId);
        const roomMembers = io.sockets.adapter.rooms.get(signalingRoom);

        return Boolean(roomMembers && roomMembers.has(targetSocketId));
    }

    socket.on('academyVoice:join', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            if (!roomId) return;

            const allowed = await canUserAccessLiveRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('academyVoice:error', {
                    roomId,
                    message: 'You must join this live room before voice can connect.'
                });
                return;
            }

            const previousRoomId = sanitizeText(socket.data?.academyVoiceRoomId || '');
            if (previousRoomId && previousRoomId !== roomId) {
                leaveAcademyVoiceSignalingRoom('switched-room');
            }

            const signalingRoom = getAcademyVoiceSignalingRoom(roomId);
            const currentSocketIds = Array.from(io.sockets.adapter.rooms.get(signalingRoom) || []);

            const peers = currentSocketIds
                .filter((socketId) => socketId !== socket.id)
                .map((socketId) => {
                    const peerSocket = io.sockets.sockets.get(socketId);
                    return {
                        socketId,
                        userId: sanitizeText(peerSocket?.user?.id),
                        displayName: sanitizeText(
                            peerSocket?.user?.name ||
                            peerSocket?.user?.fullName ||
                            peerSocket?.user?.username ||
                            'Hustler'
                        )
                    };
                })
                .filter((peer) => peer.socketId);

            socket.join(signalingRoom);
            socket.data.academyVoiceRoomId = roomId;

            socket.emit('academyVoice:peers', {
                roomId,
                peers
            });

            socket.to(signalingRoom).emit('academyVoice:peerJoined', {
                roomId,
                socketId: socket.id,
                userId: socket.user.id,
                displayName: getSocketVoiceDisplayName()
            });
        } catch (error) {
            console.error('academyVoice:join error:', error);
            socket.emit('academyVoice:error', {
                message: 'Failed to join voice signaling.'
            });
        }
    });

    socket.on('academyVoice:offer', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const offer = payload.offer;

            if (!roomId || !targetSocketId || !offer) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:offer', {
                roomId,
                fromSocketId: socket.id,
                fromUserId: socket.user.id,
                fromDisplayName: getSocketVoiceDisplayName(),
                offer
            });
        } catch (error) {
            console.error('academyVoice:offer error:', error);
        }
    });

    socket.on('academyVoice:answer', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const answer = payload.answer;

            if (!roomId || !targetSocketId || !answer) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:answer', {
                roomId,
                fromSocketId: socket.id,
                fromUserId: socket.user.id,
                fromDisplayName: getSocketVoiceDisplayName(),
                answer
            });
        } catch (error) {
            console.error('academyVoice:answer error:', error);
        }
    });

    socket.on('academyVoice:ice', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const candidate = payload.candidate;

            if (!roomId || !targetSocketId || !candidate) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:ice', {
                roomId,
                fromSocketId: socket.id,
                candidate
            });
        } catch (error) {
            console.error('academyVoice:ice error:', error);
        }
    });

    socket.on('academyVoice:mute', (payload = {}) => {
        const roomId = sanitizeText(payload.roomId || payload.room_id || socket.data?.academyVoiceRoomId || '');
        if (!roomId) return;

        socket.to(getAcademyVoiceSignalingRoom(roomId)).emit('academyVoice:peerMuted', {
            roomId,
            socketId: socket.id,
            userId: socket.user.id,
            muted: payload.muted === true
        });
    });

    socket.on('academyVoice:leave', () => {
        leaveAcademyVoiceSignalingRoom('left');
    });
    socket.on('disconnect', () => {
        leaveAcademyVoiceSignalingRoom('disconnect');
        console.log('❌ A hustler disconnected:', socket.id);
    });
});

// --- 🛡️ SECURITY PACKAGES ---
const rateLimit = require('express-rate-limit');

const ACADEMY_UPLOADS_ROOT = path.resolve(
    sanitizeText(process.env.PERSISTENT_UPLOADS_DIR) || path.join(__dirname, 'public', 'uploads')
);
const ACADEMY_FEED_UPLOAD_DIR = path.join(ACADEMY_UPLOADS_ROOT, 'academy-feed');
const ACADEMY_PROFILE_UPLOAD_DIR = path.join(ACADEMY_UPLOADS_ROOT, 'academy-profile');
const ACADEMY_FEED_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACADEMY_FEED_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACADEMY_PROFILE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function sanitizeUploadSegment(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'file';
}

function safeDecodeUploadHeaderValue(value = '') {
    const raw = sanitizeText(value);
    if (!raw) return '';
    try {
        return decodeURIComponent(raw);
    } catch (_) {
        return raw;
    }
}

function getUploadExtFromMime(mime = '') {
    const clean = sanitizeText(mime).toLowerCase().split(';')[0];

    const map = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/avif': '.avif',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
        'video/ogg': '.ogv',
        'video/x-matroska': '.mkv'
    };

    return map[clean] || '';
}

function getAcademyUploadKind(mime = '') {
    const clean = sanitizeText(mime).toLowerCase().split(';')[0];
    if (clean.startsWith('image/')) return 'image';
    if (clean.startsWith('video/')) return 'video';
    return '';
}

async function saveAcademyFeedUploadToLocal({ buffer, mimeType = '', originalName = '', userId = '' }) {
    const cleanMimeType = sanitizeText(mimeType).toLowerCase().split(';')[0];
    const safeUserId = sanitizeUploadSegment(userId || 'member');

    const decodedOriginalName = safeDecodeUploadHeaderValue(originalName || 'upload');
    const baseOriginalName = path.basename(decodedOriginalName || 'upload');
    const fileExtFromName = path.extname(baseOriginalName).toLowerCase();
    const safeBaseName = sanitizeUploadSegment(path.basename(baseOriginalName, fileExtFromName) || 'upload');

    const derivedKind = getAcademyUploadKind(cleanMimeType);
    const fileExt =
        fileExtFromName ||
        getUploadExtFromMime(cleanMimeType) ||
        (derivedKind === 'video' ? '.mp4' : '.jpg');

    const fileName = `${Date.now()}_${safeUserId}_${crypto.randomBytes(6).toString('hex')}_${safeBaseName}${fileExt}`;

    await fs.promises.mkdir(ACADEMY_FEED_UPLOAD_DIR, { recursive: true });

    const filePath = path.join(ACADEMY_FEED_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, buffer);

    return {
        url: `/uploads/academy-feed/${fileName}`,
        kind: derivedKind,
        mimeType: cleanMimeType,
        sizeBytes: buffer.length,
        originalName: baseOriginalName
    };
}

async function saveAcademyProfileUploadToLocal({
    buffer,
    mimeType = '',
    originalName = '',
    userId = '',
    assetKind = ''
}) {
    const cleanMimeType = sanitizeText(mimeType).toLowerCase().split(';')[0];
    const safeUserId = sanitizeUploadSegment(userId || 'member');
    const safeAssetKind = sanitizeUploadSegment(assetKind || 'profile');

    const decodedOriginalName = safeDecodeUploadHeaderValue(originalName || 'upload');
    const baseOriginalName = path.basename(decodedOriginalName || 'upload');
    const fileExtFromName = path.extname(baseOriginalName).toLowerCase();
    const safeBaseName = sanitizeUploadSegment(
        path.basename(baseOriginalName, fileExtFromName) || safeAssetKind || 'profile'
    );

    const fileExt =
        fileExtFromName ||
        getUploadExtFromMime(cleanMimeType) ||
        '.jpg';

    const fileName = `${Date.now()}_${safeUserId}_${safeAssetKind}_${crypto.randomBytes(6).toString('hex')}_${safeBaseName}${fileExt}`;

    await fs.promises.mkdir(ACADEMY_PROFILE_UPLOAD_DIR, { recursive: true });

    const filePath = path.join(ACADEMY_PROFILE_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, buffer);

    return {
        url: `/uploads/academy-profile/${fileName}`,
        kind: 'image',
        mimeType: cleanMimeType,
        sizeBytes: buffer.length,
        originalName: baseOriginalName
    };
}

const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event = null;

    try {
        const stripe = getStripeClient();
        const signature = req.headers['stripe-signature'];
        const webhookSecret = sanitizeText(process.env.STRIPE_WEBHOOK_SECRET);

        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
        } else {
            if (process.env.NODE_ENV === 'production') {
                return res.status(500).json({
                    success: false,
                    message: 'STRIPE_WEBHOOK_SECRET is required in production.'
                });
            }

            event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '{}'));
        }
    } catch (error) {
        console.error('stripe webhook signature/parse error:', error);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data?.object || {};
            const metadata = session.metadata || {};

            if (metadata.kind === 'federation_paid_intro' || metadata.kind === 'federation_lead_purchase') {
                const requestId = sanitizeText(metadata.requestId || session.client_reference_id);
                const paymentLedgerId = sanitizeText(metadata.paymentLedgerId);

                if (requestId && session.payment_status === 'paid') {
                    const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
                    const requestSnap = await requestRef.get();

                    if (requestSnap.exists) {
                        const current = requestSnap.data() || {};
                        const now = Timestamp.now();

                        const paymentPatch = {
                            status: 'paid',
                            adminStatus: 'active',
                            paymentStatus: 'paid',
                            paymentLedgerStatus: 'paid',
                            selectedPaymentProvider: 'stripe',
                            paymentProviderLabel: 'Stripe',
                            paymentMethod: 'card_bank_wallet',
                            payoutStatus: sanitizeText(current.payoutStatus).toLowerCase() === 'paid' ? 'paid' : 'approved',
                            commissionStatus: 'earned',
                            stripeCheckoutSessionId: sanitizeText(session.id),
                            stripePaymentIntentId: sanitizeText(session.payment_intent),
                            stripeCustomerId: sanitizeText(session.customer),
                            stripePaymentMode: sanitizeText(session.mode || 'payment'),
                            paidAt: now,
                            updatedAt: now,
                            paymentUpdatedAt: now
                        };
                        await paymentLedgerRepo.upsertPaymentRecord({
                            id: paymentLedgerId || sanitizeText(current.paymentLedgerId),
                            sourceDivision: 'federation',
                            sourceFeature: metadata.kind === 'federation_lead_purchase' ? 'lead_purchase' : 'paid_intro',
                            sourceRecordId: requestId,

                            payerUid: sanitizeText(current.requesterUid || metadata.requesterUid),
                            payerEmail: sanitizeText(current.requesterEmail).toLowerCase(),
                            payerName: sanitizeText(current.requesterName || 'Federation Member'),

                            provider: 'stripe',
                            providerOptions: ['stripe', 'oxapay'],
                            providerPaymentId: sanitizeText(session.payment_intent || session.id),
                            providerCheckoutUrl: '',
                            providerStatus: sanitizeText(session.payment_status || 'paid'),

                            amount: Math.max(0, Number(current.pricingAmount || 0)),
                            currency: sanitizeText(current.currency || 'USD').toUpperCase() || 'USD',

                            status: 'paid',
                            paymentMethod: 'card_bank_wallet',

                            platformCommissionAmount: Math.max(0, Number(current.platformCommissionAmount || 0)),
                            operatorPayoutAmount: Math.max(0, Number(current.operatorPayoutAmount || 0)),

                            metadata: {
                                requestId,
                                ownerUid: sanitizeText(current.ownerUid || metadata.ownerUid),
                                leadId: sanitizeText(current.leadId || metadata.leadId),
                                stripeCheckoutSessionId: sanitizeText(session.id),
                                stripePaymentIntentId: sanitizeText(session.payment_intent),
                                sourcePaymentMode: sanitizeText(current.sourcePaymentMode || 'lead_purchase')
                            }
                        });

                        await requestRef.set(paymentPatch, { merge: true });

                        const syncedRequest = {
                            id: requestId,
                            ...current,
                            ...paymentPatch
                        };

                        const academyEconomySynced =
                            await syncStripePaidFederationRequestToAcademyEconomy(
                                syncedRequest,
                                'stripe_checkout_completed'
                            );

                        await firestore.collection('adminBroadcasts').add({
                            audience: sanitizeText(current.requesterName || current.requesterEmail || 'Federation Member'),
                            subject: 'Federation paid introduction payment confirmed',
                            message: academyEconomySynced
                                ? `Stripe payment confirmed for Federation request ${requestId}. Academy earnings mirror was updated.`
                                : `Stripe payment confirmed for Federation request ${requestId}. Academy mirror is waiting for a matched lead.`,
                            sentAt: new Date().toISOString(),
                            createdBy: 'stripe-webhook'
                        }).catch(() => null);
                    }
                }
            }
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data?.object || {};
            const metadata = session.metadata || {};

            if (metadata.kind === 'federation_paid_intro') {
                const requestId = sanitizeText(metadata.requestId || session.client_reference_id);

                if (requestId) {
                    const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
                    const requestSnap = await requestRef.get();

                    if (requestSnap.exists) {
                        const current = requestSnap.data() || {};
                        const currentPaymentStatus = sanitizeText(current.paymentStatus || 'not_started').toLowerCase();

                        if (currentPaymentStatus !== 'paid') {
                            await requestRef.set({
                                paymentStatus: 'checkout_expired',
                                stripeCheckoutExpiredAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                            }, { merge: true });
                        }
                    }
                }
            }
        }

        return res.json({ received: true });
    } catch (error) {
        console.error('stripe webhook handler error:', error);
        return res.status(500).json({
            success: false,
            message: 'Stripe webhook handling failed.'
        });
    }
});

app.post('/api/oxapay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(String(req.body || ''), 'utf8');

    try {
        const hmacHeader = req.headers.hmac || req.headers.HMAC || req.headers['HMAC'];

        if (!verifyOxaPayWebhookSignature(rawBody, hmacHeader)) {
            return res.status(400).send('Invalid HMAC signature');
        }

        let payload = null;

        try {
            payload = JSON.parse(rawBody.toString('utf8') || '{}');
        } catch (_) {
            return res.status(400).send('Invalid JSON data');
        }

        const oxapayStatus = sanitizeText(payload.status).toLowerCase();
        const oxapayType = sanitizeText(payload.type).toLowerCase();
        const trackId = sanitizeText(payload.track_id);
        const orderId = sanitizeText(payload.order_id);
        const requestIdFromOrder = extractFederationRequestIdFromOrderId(orderId);

        if (oxapayType !== 'invoice') {
            return res.status(200).send('ok');
        }

        let requestSnap = null;
        let requestRef = null;

        if (requestIdFromOrder) {
            requestRef = firestore.collection('federationConnectionRequests').doc(requestIdFromOrder);
            requestSnap = await requestRef.get();
        }

        if ((!requestSnap || !requestSnap.exists) && trackId) {
            const querySnap = await firestore
                .collection('federationConnectionRequests')
                .where('oxapayTrackId', '==', trackId)
                .limit(1)
                .get();

            if (!querySnap.empty) {
                requestSnap = querySnap.docs[0];
                requestRef = requestSnap.ref;
            }
        }

        if (!requestSnap || !requestSnap.exists || !requestRef) {
            return res.status(200).send('ok');
        }

        const requestId = requestSnap.id;
        const current = requestSnap.data() || {};
        const now = Timestamp.now();

        const isPaid = oxapayStatus === 'paid';
        const isPaying = oxapayStatus === 'paying';

        if (isPaid) {
            const paymentPatch = {
                status: 'paid',
                adminStatus: 'active',
                paymentStatus: 'paid',
                paymentLedgerStatus: 'paid',
                selectedPaymentProvider: 'oxapay',
                paymentProviderLabel: 'OxaPay',
                paymentMethod: 'crypto',
                payoutStatus: sanitizeText(current.payoutStatus).toLowerCase() === 'paid' ? 'paid' : 'approved',
                commissionStatus: 'earned',
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayStatus: sanitizeText(payload.status),
                oxapayCurrency: sanitizeText(payload.currency),
                oxapayValue: Number(payload.value || 0),
                oxapaySentValue: Number(payload.sent_value || 0),
                paidAt: now,
                updatedAt: now,
                paymentUpdatedAt: now
            };

            await paymentLedgerRepo.upsertPaymentRecord({
                id: sanitizeText(current.paymentLedgerId),
                sourceDivision: 'federation',
                sourceFeature: 'lead_purchase',
                sourceRecordId: requestId,

                payerUid: sanitizeText(current.requesterUid),
                payerEmail: sanitizeText(current.requesterEmail).toLowerCase(),
                payerName: sanitizeText(current.requesterName || 'Federation Member'),

                provider: 'oxapay',
                providerOptions: ['stripe', 'oxapay'],
                providerPaymentId: trackId,
                providerCheckoutUrl: '',
                providerStatus: sanitizeText(payload.status),

                amount: Math.max(0, Number(current.pricingAmount || payload.amount || 0)),
                currency: sanitizeText(current.currency || 'USD').toUpperCase() || 'USD',

                cryptoAmount: Number(payload.value || payload.sent_value || 0),
                cryptoCurrency: sanitizeText(payload.currency).toUpperCase(),
                cryptoNetwork: sanitizeText(payload.txs?.[0]?.network || ''),

                status: 'paid',
                paymentMethod: 'crypto',

                platformCommissionAmount: Math.max(0, Number(current.platformCommissionAmount || 0)),
                operatorPayoutAmount: Math.max(0, Number(current.operatorPayoutAmount || 0)),

                metadata: {
                    requestId,
                    ownerUid: sanitizeText(current.ownerUid),
                    leadId: sanitizeText(current.leadId),
                    oxapayTrackId: trackId,
                    oxapayOrderId: orderId,
                    oxapayPayload: payload,
                    sourcePaymentMode: sanitizeText(current.sourcePaymentMode || 'lead_purchase')
                }
            });

            await requestRef.set(paymentPatch, { merge: true });

            const syncedRequest = {
                id: requestId,
                ...current,
                ...paymentPatch
            };

            const academyEconomySynced =
                await syncStripePaidFederationRequestToAcademyEconomy(
                    syncedRequest,
                    'oxapay_invoice_paid'
                );

            await firestore.collection('adminBroadcasts').add({
                audience: sanitizeText(current.requesterName || current.requesterEmail || 'Federation Member'),
                subject: 'Federation lead purchase crypto payment confirmed',
                message: academyEconomySynced
                    ? `OxaPay payment confirmed for Federation lead purchase ${requestId}. Academy earnings mirror was updated.`
                    : `OxaPay payment confirmed for Federation lead purchase ${requestId}. Academy mirror is waiting for a matched lead.`,
                sentAt: new Date().toISOString(),
                createdBy: 'oxapay-webhook'
            }).catch(() => null);
        } else if (isPaying) {
            await requestRef.set({
                paymentStatus: 'paying',
                paymentLedgerStatus: 'pending',
                selectedPaymentProvider: 'oxapay',
                paymentProviderLabel: 'OxaPay',
                paymentMethod: 'crypto',
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayStatus: sanitizeText(payload.status),
                updatedAt: now,
                paymentUpdatedAt: now
            }, { merge: true });

            await paymentLedgerRepo.upsertPaymentRecord({
                id: sanitizeText(current.paymentLedgerId),
                sourceDivision: 'federation',
                sourceFeature: 'lead_purchase',
                sourceRecordId: requestId,

                payerUid: sanitizeText(current.requesterUid),
                payerEmail: sanitizeText(current.requesterEmail).toLowerCase(),
                payerName: sanitizeText(current.requesterName || 'Federation Member'),

                provider: 'oxapay',
                providerOptions: ['stripe', 'oxapay'],
                providerPaymentId: trackId,
                providerStatus: sanitizeText(payload.status),

                amount: Math.max(0, Number(current.pricingAmount || payload.amount || 0)),
                currency: sanitizeText(current.currency || 'USD').toUpperCase() || 'USD',

                cryptoAmount: Number(payload.value || payload.sent_value || 0),
                cryptoCurrency: sanitizeText(payload.currency).toUpperCase(),
                cryptoNetwork: sanitizeText(payload.txs?.[0]?.network || ''),

                status: 'pending',
                paymentMethod: 'crypto',

                platformCommissionAmount: Math.max(0, Number(current.platformCommissionAmount || 0)),
                operatorPayoutAmount: Math.max(0, Number(current.operatorPayoutAmount || 0)),

                metadata: {
                    requestId,
                    ownerUid: sanitizeText(current.ownerUid),
                    leadId: sanitizeText(current.leadId),
                    oxapayTrackId: trackId,
                    oxapayOrderId: orderId,
                    oxapayPayload: payload,
                    sourcePaymentMode: sanitizeText(current.sourcePaymentMode || 'lead_purchase')
                }
            });
        }

        return res.status(200).send('ok');
    } catch (error) {
        console.error('oxapay webhook handler error:', error);
        return res.status(500).send('OxaPay webhook handling failed');
    }
});

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use((req, res, next) => {
    const p = String(req.path || '');

// Never cache the dashboard / academy shells and their core scripts.
if (
    p === '/dashboard' ||
    p === '/dashboard/' ||
    p === '/academy' ||
    p === '/academy/' ||
    p === '/plaza' ||
    p === '/plaza/' ||
    p === '/plaza.html' ||
    p === '/js/dashboard.js' ||
    p === '/js/academy.js' ||
    p === '/js/plaza.js' ||
    p === '/css/plaza.css' ||
    p === '/js/dashboard-mobile-fix.js' ||
    p === '/js/yh-shared-core.js' ||
    p === '/js/yh-shared-runtime.js'
) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
}

    next();
});

app.use('/uploads/academy/profile', express.static(ACADEMY_PROFILE_UPLOAD_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use('/uploads/academy-profile', express.static(ACADEMY_PROFILE_UPLOAD_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use('/uploads', express.static(ACADEMY_UPLOADS_ROOT, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use((req, res, next) => {
    const pathName = String(req.path || '').replace(/\/+$/, '') || '/';

    if (pathName !== '/plaza' && pathName !== '/plaza.html') {
        return next();
    }

    const user = verifyRequestUser(req);

    if (!user?.id) {
        return res.redirect('/?redirect=plaza');
    }

    return next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const normalized = String(filePath || '').replace(/\\/g, '/');

        if (
            normalized.endsWith('/public/js/dashboard.js') ||
            normalized.endsWith('/public/js/academy.js') ||
            normalized.endsWith('/public/js/plaza.js') ||
            normalized.endsWith('/public/css/plaza.css') ||
            normalized.endsWith('/public/js/dashboard-mobile-fix.js') ||
            normalized.endsWith('/public/js/yh-shared-core.js') ||
            normalized.endsWith('/public/js/yh-shared-runtime.js') ||
            normalized.endsWith('/public/dashboard.html') ||
            normalized.endsWith('/public/academy.html') ||
            normalized.endsWith('/public/plaza.html')
        ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    }
}));

// Anti-Spam (Rate Limiting)
const AUTH_OTP_RATE_LIMIT_PATHS = new Set([
    '/verify-otp',
    '/resend-otp',
    '/forgot-password',
    '/verify-forgot-otp',
    '/reset-password'
]);

const AUTH_WRITE_RATE_LIMIT_PATHS = new Set([
    '/register',
    '/login'
]);

const PUBLIC_LANDING_RATE_LIMIT_PATHS = new Set([
    '/public/landing-feed'
]);

const authOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const publicLandingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => String(req.method || '').toUpperCase() !== 'GET'
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const path = String(req.path || '').trim().toLowerCase();

        // Do not rate-limit admin routes.
        // Anyone who already knows the secret admin URL and correct credentials
        // should not be blocked by the generic public API limiter.
        if (path === '/admin/login' || path.startsWith('/admin/')) return true;

        // OTP / password recovery routes use their own relaxed limiter.
        if (AUTH_OTP_RATE_LIMIT_PATHS.has(path)) return true;

        // Register/login should not share the same bucket as public polling routes.
        if (AUTH_WRITE_RATE_LIMIT_PATHS.has(path)) return true;

        // Public landing live polling uses its own dedicated limiter.
        if (PUBLIC_LANDING_RATE_LIMIT_PATHS.has(path)) return true;

        // Academy UI reads (feed, member search, membership status) are normal in-app polling.
        // The generic limiter is too aggressive here and causes 429 spam in the console.
        const method = String(req.method || '').trim().toUpperCase();
        if (method === 'GET') {
            if (path === '/academy/membership-status') return true;
            if (path === '/academy/community/members') return true;
            if (path === '/academy/feed' || path.startsWith('/academy/feed/')) return true;
            if (path === '/plaza/feed' || path.startsWith('/plaza/feed/')) return true;
            if (path === '/plaza/opportunities' || path.startsWith('/plaza/opportunities/')) return true;
            if (path === '/plaza/directory' || path.startsWith('/plaza/directory/')) return true;
            if (path === '/plaza/regions' || path.startsWith('/plaza/regions/')) return true;
            if (path === '/plaza/bridge' || path.startsWith('/plaza/bridge/')) return true;
            if (path === '/plaza/requests' || path.startsWith('/plaza/requests/')) return true;
            if (path === '/plaza/messages' || path.startsWith('/plaza/messages/')) return true;
        }

        return false;
    }
});

app.use('/api/verify-otp', authOtpLimiter);
app.use('/api/resend-otp', authOtpLimiter);
app.use('/api/forgot-password', authOtpLimiter);
app.use('/api/verify-forgot-otp', authOtpLimiter);
app.use('/api/reset-password', authOtpLimiter);

app.use('/api/register', authWriteLimiter);
app.use('/api/login', authWriteLimiter);
app.use('/api/public/landing-feed', publicLandingLimiter);

app.use('/api', apiLimiter);

// --- MVC ROUTING ---
const viewRoutes = require('./routes/viewRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { createAdminRouters } = require('./routes/admin-auth-routes');
const { startAiNurtureWorker } = require('./backend/services/aiNurtureWorker');

const { pageRouter: adminPageRouter, apiRouter: adminApiRouter } = createAdminRouters({
    privateAdminDir: path.join(__dirname, 'private', 'admin')
});

app.use(adminApiRouter);
app.use(adminPageRouter);

app.use('/', viewRoutes);

app.post(
    '/api/academy/feed/uploads',
    requireApiUser,
    express.raw({
        type: ['image/*', 'video/*', 'application/octet-stream'],
        limit: '100mb'
    }),
    async (req, res) => {
        try {
            const transportMimeType = sanitizeText(req.headers?.['content-type'])
                .toLowerCase()
                .split(';')[0];

            const declaredMimeType = sanitizeText(req.headers?.['x-file-mime'])
                .toLowerCase()
                .split(';')[0];

            const mimeType = declaredMimeType || transportMimeType;
            const originalName = safeDecodeUploadHeaderValue(req.headers?.['x-file-name'] || 'upload');
            const requestedKind = sanitizeText(req.headers?.['x-media-kind']).toLowerCase();

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : typeof req.body === 'string'
                    ? Buffer.from(req.body)
                    : Buffer.alloc(0);

            const detectedKind = getAcademyUploadKind(mimeType);
            const mediaKind =
                requestedKind === 'video'
                    ? 'video'
                    : requestedKind === 'image'
                        ? 'image'
                        : detectedKind;

            if (!buffer.length) {
                return res.status(400).json({
                    success: false,
                    message: 'No file data received.'
                });
            }

            if (!mediaKind || !['image', 'video'].includes(mediaKind)) {
                return res.status(400).json({
                    success: false,
                    message: 'Only image and video uploads are supported.'
                });
            }

            if (mediaKind === 'image' && !mimeType.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid image upload.'
                });
            }

            if (mediaKind === 'video' && !mimeType.startsWith('video/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid video upload.'
                });
            }

            const maxBytes =
                mediaKind === 'video'
                    ? ACADEMY_FEED_MAX_VIDEO_BYTES
                    : ACADEMY_FEED_MAX_IMAGE_BYTES;

            if (buffer.length > maxBytes) {
                return res.status(400).json({
                    success: false,
                    message:
                        mediaKind === 'video'
                            ? 'Video must be 100MB or smaller.'
                            : 'Image must be 10MB or smaller.'
                });
            }

            const media = await saveAcademyFeedUploadToLocal({
                buffer,
                mimeType,
                originalName,
                userId: req.user.id
            });

            return res.status(201).json({
                success: true,
                media
            });
        } catch (error) {
            console.error('academy feed upload error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload media.'
            });
        }
    }
);

app.post(
    '/api/academy/profile/uploads',
    requireApiUser,
    express.raw({
        type: ['image/*', 'application/octet-stream'],
        limit: '12mb'
    }),
    async (req, res) => {
        try {
            const transportMimeType = sanitizeText(req.headers?.['content-type'])
                .toLowerCase()
                .split(';')[0];

            const declaredMimeType = sanitizeText(req.headers?.['x-file-mime'])
                .toLowerCase()
                .split(';')[0];

            const mimeType = declaredMimeType || transportMimeType;
            const originalName = safeDecodeUploadHeaderValue(req.headers?.['x-file-name'] || 'profile.jpg');
            const assetKind = sanitizeText(req.headers?.['x-asset-kind'] || 'profile').toLowerCase();

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : typeof req.body === 'string'
                    ? Buffer.from(req.body)
                    : Buffer.alloc(0);

            if (!buffer.length) {
                return res.status(400).json({
                    success: false,
                    message: 'No image data received.'
                });
            }

            if (!mimeType.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Only image uploads are supported for profile assets.'
                });
            }

            if (buffer.length > ACADEMY_PROFILE_MAX_IMAGE_BYTES) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile image must be 10MB or smaller.'
                });
            }

            const media = await saveAcademyProfileUploadToLocal({
                buffer,
                mimeType,
                originalName,
                userId: req.user.id,
                assetKind
            });

            return res.status(201).json({
                success: true,
                media
            });
        } catch (error) {
            console.error('academy profile upload error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload profile image.'
            });
        }
    }
);

app.get('/api/realtime/profile-access/:targetUserId', requireApiUser, async (req, res) => {
    try {
        const viewerId = sanitizeText(req.user?.id);
        const targetUserId = sanitizeText(req.params.targetUserId);

        if (!viewerId || !targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Missing profile access target.'
            });
        }

        const access = await getAcademyProfileAccessBlockStatus(viewerId, targetUserId);

        if (access.blocked) {
            return res.status(403).json({
                success: false,
                blocked: true,
                roomId: access.roomId,
                message: 'This profile is not available.'
            });
        }

        return res.json({
            success: true,
            allowed: true,
            blocked: false
        });
    } catch (error) {
        console.error('academy profile access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify profile access.'
        });
    }
});

app.patch('/api/realtime/rooms/:roomId/hide', requireApiUser, async (req, res) => {
    try {
        const roomId = sanitizeText(req.params.roomId);
        const userId = sanitizeText(req.user?.id);
        const context = await getUserOwnedChatRoomActionContext(userId, roomId);

        if (!context.ok) {
            return sendChatRoomActionError(res, context);
        }

        await context.roomRef.set({
            hidden_for_user_ids: FieldValue.arrayUnion(userId),
            deleted_for_user_ids: FieldValue.arrayUnion(userId),
            updated_at: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true,
            roomId,
            hidden: true,
            deletedForCurrentUserOnly: true
        });
    } catch (error) {
        console.error('hide realtime room error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete conversation from your inbox.'
        });
    }
});

app.patch('/api/realtime/rooms/:roomId/restrict', requireApiUser, async (req, res) => {
    try {
        const roomId = sanitizeText(req.params.roomId);
        const userId = sanitizeText(req.user?.id);
        const context = await getUserOwnedChatRoomActionContext(userId, roomId);

        if (!context.ok) {
            return sendChatRoomActionError(res, context);
        }

        if (!isChatRoomDirectMessage(context.roomData)) {
            return res.status(400).json({
                success: false,
                message: 'Restrict is only available for direct messages.'
            });
        }

        const restricted = req.body?.restricted !== false;

        await context.roomRef.set({
            restricted_by_user_ids: restricted
                ? FieldValue.arrayUnion(userId)
                : FieldValue.arrayRemove(userId),
            updated_at: Timestamp.now()
        }, { merge: true });

        io.to(roomId).emit('roomAccessUpdated', {
            roomId,
            action: 'restrict',
            restricted,
            restrictedByUserId: userId
        });

        return res.json({
            success: true,
            roomId,
            restricted
        });
    } catch (error) {
        console.error('restrict realtime room error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to restrict conversation.'
        });
    }
});

app.patch('/api/realtime/rooms/:roomId/block', requireApiUser, async (req, res) => {
    try {
        const roomId = sanitizeText(req.params.roomId);
        const userId = sanitizeText(req.user?.id);
        const context = await getUserOwnedChatRoomActionContext(userId, roomId);

        if (!context.ok) {
            return sendChatRoomActionError(res, context);
        }

        if (!isChatRoomDirectMessage(context.roomData)) {
            return res.status(400).json({
                success: false,
                message: 'Block is only available for direct messages.'
            });
        }

        const blockedUserIds = context.otherMemberIds;

        if (!blockedUserIds.length) {
            return res.status(400).json({
                success: false,
                message: 'No user found to block.'
            });
        }

        const blocked = req.body?.blocked !== false;

        const patch = blocked
            ? {
                blocked_by_user_ids: FieldValue.arrayUnion(...blockedUserIds),
                blocked_by_owner_user_ids: FieldValue.arrayUnion(userId),
                hidden_for_user_ids: FieldValue.arrayRemove(userId),
                updated_at: Timestamp.now()
            }
            : {
                blocked_by_user_ids: FieldValue.arrayRemove(...blockedUserIds),
                blocked_by_owner_user_ids: FieldValue.arrayRemove(userId),
                hidden_for_user_ids: FieldValue.arrayRemove(userId),
                updated_at: Timestamp.now()
            };

        await context.roomRef.set(patch, { merge: true });

        io.to(roomId).emit('roomAccessUpdated', {
            roomId,
            action: blocked ? 'block' : 'unblock',
            blocked,
            blockedByUserId: userId,
            blockedUserIds
        });

        return res.json({
            success: true,
            roomId,
            blocked,
            blockedUserIds
        });
    } catch (error) {
        console.error('block realtime room error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update block status.'
        });
    }
});

app.post('/api/realtime/rooms/:roomId/read', requireApiUser, async (req, res) => {
    try {
        const roomId = sanitizeText(req.params.roomId);
        const userId = sanitizeText(req.user?.id);

        if (!roomId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing room or user.'
            });
        }

        const allowed = await canUserAccessRoom(userId, roomId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'Access denied for this room.'
            });
        }

        await markRoomAsReadForUser(userId, roomId);

        return res.json({
            success: true,
            roomId,
            read: true
        });
    } catch (error) {
        console.error('mark room as read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark room as read.'
        });
    }
});

app.get('/api/academy/lead-missions/operator-profile', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const snap = await leadMissionOperatorsCol.doc(userId).get();

        if (!snap.exists) {
            return res.json({
                success: true,
                exists: false,
                profile: null
            });
        }

        return res.json({
            success: true,
            exists: true,
            profile: mapLeadMissionOperatorProfileDoc(snap)
        });
    } catch (error) {
        console.error('get lead mission operator profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Lead Missions profile.'
        });
    }
});

app.post('/api/academy/lead-missions/operator-profile', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const { profile, missing } = normalizeLeadMissionOperatorProfilePayload(req.body || {}, req.user || {});

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Please complete the required Lead Missions profile fields: ${missing.join(', ')}.`,
                missing
            });
        }

        const ref = leadMissionOperatorsCol.doc(userId);
        const snap = await ref.get();
        const now = Timestamp.now();

        const payload = {
            ...profile,
            createdAt: snap.exists ? (snap.data()?.createdAt || now) : now,
            submittedAt: snap.exists ? (snap.data()?.submittedAt || now) : now,
            updatedAt: now
        };

        await ref.set(payload, { merge: true });

        const savedSnap = await ref.get();

        return res.json({
            success: true,
            exists: true,
            profile: mapLeadMissionOperatorProfileDoc(savedSnap)
        });
    } catch (error) {
        console.error('save lead mission operator profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save Lead Missions profile.'
        });
    }
});
function mapFederationMemberUserDoc(docSnap) {
    const user = docSnap.data() || {};
    const userId = sanitizeText(docSnap.id);

    const application =
        user.federationApplication && typeof user.federationApplication === 'object'
            ? user.federationApplication
            : {};

    const name = sanitizeText(
        application.fullName ||
        application.name ||
        user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Federation Member'
    );

    const role = sanitizeText(
        application.role ||
        application.profession ||
        user.profession ||
        user.role ||
        'Approved Federation Member'
    );

    const category = sanitizeText(
        application.primaryCategory ||
        user.primaryCategory ||
        user.category ||
        'Strategic Operator'
    );

    const country = sanitizeText(application.country || user.country || '');
    const city = sanitizeText(application.city || user.city || '');

    return {
        id: userId,
        userId,
        email: sanitizeText(user.email || application.email || '').toLowerCase(),
        emailLower: sanitizeText(user.email || application.email || '').toLowerCase(),
        name,
        role,
        badge: sanitizeText(user.federationBadge || application.badge || 'Verified'),
        category,
        country,
        city,
        company: sanitizeText(application.company || user.company || ''),
        description: sanitizeText(
            application.networkValue ||
            application.valueBring ||
            application.background ||
            user.bio ||
            'Approved Federation member with verified strategic access.'
        ).slice(0, 240),
        avatar: sanitizeText(
            user.avatar ||
            user.profilePhoto ||
            user.photoURL ||
            application.avatar ||
            application.profilePhoto ||
            application.photoURL ||
            ''
        ),
        profilePhoto: sanitizeText(
            user.profilePhoto ||
            user.avatar ||
            user.photoURL ||
            application.profilePhoto ||
            application.avatar ||
            application.photoURL ||
            ''
        ),
        photoURL: sanitizeText(
            user.photoURL ||
            user.avatar ||
            user.profilePhoto ||
            application.photoURL ||
            application.avatar ||
            application.profilePhoto ||
            ''
        ),
        coverPhoto: sanitizeText(
            user.coverPhoto ||
            user.cover_photo ||
            application.coverPhoto ||
            application.cover_photo ||
            ''
        ),
        approvedAt: mapFederationConnectTimestamp(user.federationApprovedAt || user.updatedAt || application.reviewedAt),
        source: 'server'
    };
}
function normalizePlazaAccessStatus(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (!raw) return '';
    if (raw === 'approved' || raw === 'active') return 'approved';
    if (raw === 'under review' || raw === 'pending' || raw === 'pending review' || raw === 'review') return 'under review';
    if (raw === 'screening' || raw === 'in screening') return 'screening';
    if (raw === 'shortlisted' || raw === 'shortlist') return 'shortlisted';
    if (raw === 'waitlisted' || raw === 'waitlist') return 'waitlisted';
    if (raw === 'rejected' || raw === 'denied' || raw === 'not approved') return 'rejected';

    return raw;
}

function isPlazaApprovedServerUser(user = {}) {
    const status = normalizePlazaAccessStatus(
        user.plazaAccessStatus ||
        user.plazaMembershipStatus ||
        user.plazaApplicationStatus ||
        user.plazaApplication?.status ||
        ''
    );

    return user.hasPlazaAccess === true || status === 'approved';
}

function buildPlazaMemberSnapshot(userId = '', user = {}, requestUser = {}) {
    return {
        id: userId,
        name: sanitizeText(user.fullName || user.name || user.displayName || requestUser.name || 'Plaza Member'),
        email: sanitizeText(user.email || requestUser.email || '').toLowerCase(),
        divisions: ['Plaza'],
        status: 'Active'
    };
}

async function getPlazaAccessSnapshotForUser(userId = '', requestUser = {}) {
    const normalizedUserId = sanitizeText(userId);

    if (!normalizedUserId) {
        return {
            hasApplication: false,
            canEnterPlaza: false,
            applicationStatus: '',
            application: null,
            member: null
        };
    }

    const snap = await firestore.collection('users').doc(normalizedUserId).get();
    const user = snap.exists ? (snap.data() || {}) : {};

    const application =
        user.plazaApplication && typeof user.plazaApplication === 'object'
            ? user.plazaApplication
            : null;

    const status = normalizePlazaAccessStatus(
        user.plazaAccessStatus ||
        user.plazaMembershipStatus ||
        user.plazaApplicationStatus ||
        application?.status ||
        ''
    );

    const approved = isPlazaApprovedServerUser(user);
    const divisionOverride = getUserDivisionOverride(user, 'plaza');

    return {
        hasApplication: Boolean(application || status),
        canEnterPlaza: approved,
        applicationStatus: status,
        application,
        divisionOverride,
        member: approved ? buildPlazaMemberSnapshot(normalizedUserId, user, requestUser) : null
    };
}

async function requirePlazaApiAccess(req, res, next) {
    try {
        const snapshot = await getPlazaAccessSnapshotForUser(req.user?.id, req.user);

        if (snapshot.canEnterPlaza === true) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Plaza access requires admin approval.',
            plazaAccessRequired: true,
            applicationStatus: snapshot.applicationStatus || '',
            hasApplication: snapshot.hasApplication === true
        });
    } catch (error) {
        console.error('requirePlazaApiAccess error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify Plaza access.'
        });
    }
}
function isFederationApprovedServerUser(user = {}) {
    const status = sanitizeText(
        user.federationMembershipStatus ||
        user.federationApplicationStatus ||
        user.federationApplication?.status ||
        ''
    ).toLowerCase();

    return user.hasFederationAccess === true || status === 'approved';
}

function buildFederationReferralCode(userId = '', name = '') {
    const base = sanitizeText(name || userId || 'MEMBER')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 8) || 'MEMBER';

    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `YHF-${base}-${suffix}`;
}

async function getFederationUserState(req) {
    const userId = sanitizeText(req.user?.id);
    const userRef = firestore.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};

    const application =
        user.federationApplication && typeof user.federationApplication === 'object'
            ? user.federationApplication
            : null;

    const approved = isFederationApprovedServerUser(user);
    let member = approved ? mapFederationMemberUserDoc(userSnap) : null;

    if (approved && member && !member.referralCode) {
        const nextCode = buildFederationReferralCode(userId, member.name);

        await userRef.set({
            federationReferralCode: nextCode,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        member = {
            ...member,
            referralCode: nextCode
        };
    }

    return {
        userId,
        userRef,
        user,
        application,
        approved,
        member
    };
}

function mapFederationRequestDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        leadId: sanitizeText(data.leadId),
        ownerUid: sanitizeText(data.ownerUid),
        opportunityTitle: sanitizeText(data.opportunityTitle),
        status: sanitizeText(data.status || 'pending_admin_match'),
        adminStatus: sanitizeText(data.adminStatus || 'pending_review'),
        budgetRange: sanitizeText(data.budgetRange || 'not_sure'),
        urgency: sanitizeText(data.urgency || 'normal'),
        preferredIntroType: sanitizeText(data.preferredIntroType || 'admin_brokered'),
        requestReason: sanitizeText(data.requestReason),
        intendedUse: sanitizeText(data.intendedUse),
        notes: sanitizeText(data.notes),
        createdAt: mapFederationConnectTimestamp(data.createdAt),
        updatedAt: mapFederationConnectTimestamp(data.updatedAt)
    };
}

function normalizeFederationDealRoomType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'partnership') return 'partnership';
    if (raw === 'collaboration' || raw === 'collab') return 'collaboration';
    if (raw === 'joint_venture' || raw === 'joint venture' || raw === 'jv') return 'joint_venture';
    if (raw === 'operator_hiring' || raw === 'operator hiring' || raw === 'hiring') return 'operator_hiring';
    if (raw === 'investment' || raw === 'investor') return 'investment';
    if (raw === 'service_deal' || raw === 'service deal' || raw === 'service') return 'service_deal';

    return 'partnership';
}

function normalizeFederationDealRoomStatus(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'pending_admin_review' || raw === 'pending review' || raw === 'review') return 'pending_admin_review';
    if (raw === 'approved') return 'approved';
    if (raw === 'in_discussion' || raw === 'discussion') return 'in_discussion';
    if (raw === 'commission_due') return 'commission_due';
    if (raw === 'commission_paid') return 'commission_paid';
    if (raw === 'closed') return 'closed';
    if (raw === 'rejected') return 'rejected';

    return 'pending_admin_review';
}

function mapFederationDealRoomDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        title: sanitizeText(data.title || 'Federation Deal Room'),
        roomType: normalizeFederationDealRoomType(data.roomType || data.type),
        description: sanitizeText(data.description || data.text || ''),
        partnerNeed: sanitizeText(data.partnerNeed || ''),
        expectedValueAmount: Math.max(0, Number(data.expectedValueAmount || 0)),
        currency: sanitizeText(data.currency || 'USD').toUpperCase() || 'USD',
        platformCommissionRate: Math.max(0, Math.min(100, Number(data.platformCommissionRate || 20))),
        platformCommissionAmount: Math.max(0, Number(data.platformCommissionAmount || 0)),
        adminStatus: normalizeFederationDealRoomStatus(data.adminStatus),
        dealStatus: sanitizeText(data.dealStatus || 'proposed'),
        commissionStatus: sanitizeText(data.commissionStatus || 'pending'),
        sourceDivision: sanitizeText(data.sourceDivision || 'federation'),
        sourceFeature: sanitizeText(data.sourceFeature || 'deal_rooms'),
        creatorUid: sanitizeText(data.creatorUid),
        creatorName: sanitizeText(data.creatorName || 'Federation Member'),
        creatorEmail: sanitizeText(data.creatorEmail).toLowerCase(),
        participantUids: Array.isArray(data.participantUids)
            ? data.participantUids.map((item) => sanitizeText(item)).filter(Boolean)
            : [],
        linkedPlazaOpportunityId: sanitizeText(data.linkedPlazaOpportunityId),
        academyMissionNeed: sanitizeText(data.academyMissionNeed),
        adminNotes: sanitizeText(data.adminNotes),
        createdAt: mapFederationConnectTimestamp(data.createdAt),
        updatedAt: mapFederationConnectTimestamp(data.updatedAt)
    };
}

async function getFederationReferralSnapshot(member = {}) {
    const referralCode = sanitizeText(member.referralCode).toUpperCase();
    const memberEmail = sanitizeText(member.email).toLowerCase();
    const memberUserId = sanitizeText(member.userId || member.id);

    const usersSnap = await firestore.collection('users').limit(500).get();
    const referredApplications = [];

    usersSnap.forEach((docSnap) => {
        const user = docSnap.data() || {};
        const app =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        if (!app) return;

        const byCode =
            referralCode &&
            sanitizeText(app.referralCodeUsed || app.referredByCode).toUpperCase() === referralCode;

        const byEmail =
            memberEmail &&
            sanitizeText(app.referredByEmail).toLowerCase() === memberEmail;

        const byMemberId =
            memberUserId &&
            sanitizeText(app.referredByMemberId || app.referredByUserId) === memberUserId;

        if (!byCode && !byEmail && !byMemberId) return;

        referredApplications.push({
            id: sanitizeText(app.id || `FED-APP-${docSnap.id}`),
            userId: docSnap.id,
            fullName: sanitizeText(app.fullName || app.name || user.fullName || user.name || 'Federation Applicant'),
            email: sanitizeText(app.email || user.email || '').toLowerCase(),
            role: sanitizeText(app.role || app.profession || ''),
            primaryCategory: sanitizeText(app.primaryCategory || ''),
            country: sanitizeText(app.country || user.country || ''),
            city: sanitizeText(app.city || user.city || ''),
            status: sanitizeText(app.status || user.federationApplicationStatus || 'Under Review'),
            createdAt: mapFederationConnectTimestamp(app.createdAt || app.submittedAt || user.createdAt),
            submittedAt: mapFederationConnectTimestamp(app.submittedAt || app.createdAt)
        });
    });

    referredApplications.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return {
        referralCode,
        inviteUrlPath: `/?ref=${encodeURIComponent(referralCode)}`,
        total: referredApplications.length,
        pending: referredApplications.filter((item) =>
            ['pending', 'under review', 'screening'].includes(String(item.status || '').toLowerCase())
        ).length,
        shortlisted: referredApplications.filter((item) =>
            String(item.status || '').toLowerCase() === 'shortlisted'
        ).length,
        approved: referredApplications.filter((item) =>
            String(item.status || '').toLowerCase() === 'approved'
        ).length,
        recent: referredApplications.slice(0, 10)
    };
}
app.get('/api/federation/me', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);
        const user = fedState.user || {};

        const currentUser = {
            id: fedState.userId,
            email: sanitizeText(user.email || req.user?.email || '').toLowerCase(),
            emailLower: sanitizeText(user.email || req.user?.email || '').toLowerCase(),
            name: sanitizeText(
                user.fullName ||
                user.name ||
                user.displayName ||
                req.user?.name ||
                req.user?.username ||
                'Federation Member'
            ),
            username: sanitizeText(user.username || req.user?.username || '')
        };

        const rawStatus = sanitizeText(
            user.federationMembershipStatus ||
            user.federationApplicationStatus ||
            fedState.application?.status ||
            ''
        );

        const referrals = fedState.member
            ? await getFederationReferralSnapshot(fedState.member)
            : null;

        return res.json({
            success: true,
            currentUser,
            application: fedState.application,
            applications: fedState.application ? [fedState.application] : [],
            applicationStatus: rawStatus,
            canEnterFederation: fedState.approved,
            member: fedState.member,
            divisionOverride: getUserDivisionOverride(user, 'federation'),
            referrals
        });
    } catch (error) {
        console.error('federation me error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation member state.'
        });
    }
});

app.get('/api/federation/directory', requireApiUser, async (req, res) => {
    try {
        const snap = await firestore
            .collection('users')
            .where('hasFederationAccess', '==', true)
            .limit(200)
            .get();

        const members = [];

        snap.forEach((docSnap) => {
            members.push(mapFederationMemberUserDoc(docSnap));
        });

        members.sort((a, b) => {
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('federation directory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation directory.'
        });
    }
});
app.get('/api/federation/command', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const membersSnap = await firestore
            .collection('users')
            .where('hasFederationAccess', '==', true)
            .limit(300)
            .get();

        const members = [];
        membersSnap.forEach((docSnap) => members.push(mapFederationMemberUserDoc(docSnap)));

        let requests = [];

        try {
            const requestsSnap = await firestore
                .collection('federationConnectionRequests')
                .where('requesterUid', '==', fedState.userId)
                .limit(100)
                .get();

            requestsSnap.forEach((docSnap) => requests.push(mapFederationRequestDoc(docSnap)));
        } catch (error) {
            console.error('federation command requests query error:', error);
            requests = [];
        }

        let connectOpportunitiesCount = 0;

        try {
            const connectSnap = await firestore
                .collectionGroup('academyLeadMissions')
                .where('federationReady', '==', true)
                .limit(100)
                .get();

            connectOpportunitiesCount = connectSnap.size;
        } catch (error) {
            console.error('federation command opportunities query error:', error);
            connectOpportunitiesCount = 0;
        }

        const countries = new Set(members.map((member) => member.country).filter(Boolean));
        const categories = new Set(members.map((member) => member.category).filter(Boolean));
        return res.json({
            success: true,
            command: {
                member: fedState.member,
                stats: {
                    approvedMembers: members.length,
                    countriesActive: countries.size,
                    sectorsLive: categories.size,
                    connectOpportunities: connectOpportunitiesCount,
                    myRequests: requests.length,
                    pendingRequests: requests.filter((item) =>
                        ['pending_admin_match', 'pending_review'].includes(String(item.status || '').toLowerCase())
                    ).length,
                    completedRequests: requests.filter((item) =>
                        String(item.status || '').toLowerCase() === 'completed'
                    ).length
                }
            }
        });
    } catch (error) {
        console.error('federation command error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation command.'
        });
    }
});

app.get('/api/federation/referrals', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const referrals = await getFederationReferralSnapshot(fedState.member);

        return res.json({
            success: true,
            referrals
        });
    } catch (error) {
        console.error('federation referrals error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation referrals.'
        });
    }
});

app.get('/api/federation/deal-rooms', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const snap = await firestore
            .collection('federationDealRooms')
            .where('participantUids', 'array-contains', fedState.userId)
            .limit(100)
            .get();

        const rooms = [];
        snap.forEach((docSnap) => rooms.push(mapFederationDealRoomDoc(docSnap)));

        rooms.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        return res.json({
            success: true,
            rooms
        });
    } catch (error) {
        console.error('federation deal rooms list error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation Deal Rooms.'
        });
    }
});

app.post('/api/federation/deal-rooms', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const body = req.body || {};
        const title = sanitizeText(body.title).slice(0, 140);
        const description = sanitizeText(body.description || body.text).slice(0, 1600);

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Deal room title is required.'
            });
        }

        if (!description) {
            return res.status(400).json({
                success: false,
                message: 'Deal room description is required.'
            });
        }

        const expectedValueAmount = Math.max(0, Number(body.expectedValueAmount || 0));
        const platformCommissionRate = Math.max(0, Math.min(100, Number(body.platformCommissionRate || 20)));
        const platformCommissionAmount = expectedValueAmount > 0
            ? Math.round((expectedValueAmount * platformCommissionRate) / 100)
            : 0;

        const now = Timestamp.now();

        const payload = {
            title,
            roomType: normalizeFederationDealRoomType(body.roomType || body.type),
            description,
            partnerNeed: sanitizeText(body.partnerNeed).slice(0, 900),
            expectedValueAmount,
            currency: sanitizeText(body.currency || 'USD').toUpperCase().slice(0, 8) || 'USD',
            platformCommissionRate,
            platformCommissionAmount,

            adminStatus: 'pending_admin_review',
            dealStatus: 'proposed',
            commissionStatus: platformCommissionAmount > 0 ? 'pending' : 'not_priced',

            sourceDivision: 'federation',
            sourceFeature: 'deal_rooms',

            creatorUid: fedState.userId,
            creatorName: sanitizeText(fedState.member?.name || req.user?.name || req.user?.username || 'Federation Member'),
            creatorEmail: sanitizeText(fedState.member?.email || req.user?.email || '').toLowerCase(),
            participantUids: [fedState.userId],

            linkedPlazaOpportunityId: sanitizeText(body.linkedPlazaOpportunityId),
            academyMissionNeed: sanitizeText(body.academyMissionNeed).slice(0, 900),
            adminNotes: '',

            createdAt: now,
            updatedAt: now
        };

        const ref = await firestore.collection('federationDealRooms').add(payload);
        const freshSnap = await ref.get();

        return res.status(201).json({
            success: true,
            room: mapFederationDealRoomDoc(freshSnap)
        });
    } catch (error) {
        console.error('federation deal rooms create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Federation Deal Room.'
        });
    }
});

app.get('/api/federation/requests', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const snap = await firestore
            .collection('federationConnectionRequests')
            .where('requesterUid', '==', fedState.userId)
            .limit(100)
            .get();

        const requests = [];
        snap.forEach((docSnap) => requests.push(mapFederationRequestDoc(docSnap)));

        requests.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('federation requests error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation requests.'
        });
    }
});
app.get('/api/federation/connect/opportunities', requireApiUser, async (req, res) => {
    try {
        let snap = null;

        try {
            snap = await firestore
                .collectionGroup('academyLeadMissions')
                .where('federationReady', '==', true)
                .limit(80)
                .get();
        } catch (queryError) {
            console.error('federation connect opportunities query error:', queryError);

            return res.json({
                success: true,
                opportunities: [],
                warning: 'Federation Connect opportunities are temporarily unavailable.'
            });
        }

        const opportunities = [];

        snap.forEach((docSnap) => {
            try {
                const opportunity = mapFederationConnectOpportunityDoc(docSnap);

                if (opportunity.leadId && opportunity.ownerUid) {
                    opportunities.push(opportunity);
                }
            } catch (mapError) {
                console.error('federation connect opportunity map error:', mapError);
            }
        });

        const strategicRank = {
            strategic: 5,
            high: 4,
            medium: 3,
            watch: 2,
            standard: 1
        };

        opportunities.sort((a, b) => {
            const rankA = strategicRank[String(a.strategicValue || '').toLowerCase()] || 0;
            const rankB = strategicRank[String(b.strategicValue || '').toLowerCase()] || 0;

            if (rankA !== rankB) return rankB - rankA;

            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        });

        return res.json({
            success: true,
            opportunities
        });
    } catch (error) {
        console.error('federation connect opportunities error:', error);

        return res.json({
            success: true,
            opportunities: [],
            warning: 'Federation Connect opportunities could not be loaded.'
        });
    }
});

app.get('/api/federation/connect/requests/:requestId/unlocked-lead', requireApiUser, async (req, res) => {
    try {
        const requestId = sanitizeText(req.params.requestId);
        const requesterUid = sanitizeText(req.user?.id);

        if (!requestId || !requesterUid) {
            return res.status(400).json({
                success: false,
                message: 'Missing Federation request id.'
            });
        }

        const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Federation request not found.'
            });
        }

        const request = requestSnap.data() || {};

        if (sanitizeText(request.requesterUid) !== requesterUid) {
            return res.status(403).json({
                success: false,
                message: 'You can only unlock lead details for your own paid request.'
            });
        }

        if (!isFederationLeadPurchasePaid(request)) {
            return res.status(402).json({
                success: false,
                message: 'Payment must be confirmed before lead details can unlock.'
            });
        }

        const ownerUid = sanitizeText(request.ownerUid);
        const leadId = sanitizeText(request.leadId);

        if (!ownerUid || !leadId) {
            return res.status(400).json({
                success: false,
                message: 'This request is not connected to a specific Academy lead.'
            });
        }

        const leadRef = firestore
            .collection('users')
            .doc(ownerUid)
            .collection('academyLeadMissions')
            .doc(leadId);

        const leadSnap = await leadRef.get();

        if (!leadSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'The purchased lead no longer exists.'
            });
        }

        const lead = leadSnap.data() || {};

        if (lead.federationReady !== true) {
            return res.status(403).json({
                success: false,
                message: 'This lead is no longer Federation-ready.'
            });
        }

        const grant = await ensureFederationLeadAccessGrant({
            requestId,
            requesterUid,
            request,
            leadSnap,
            paymentRecordId: sanitizeText(request.paymentLedgerId || request.stripeCheckoutSessionId || '')
        });

        const unlockedLead = mapUnlockedFederationLeadDetails(lead, {
            requestId,
            ownerUid,
            leadId,
            pricingAmount: request.pricingAmount,
            operatorPayoutAmount: request.operatorPayoutAmount,
            platformCommissionAmount: request.platformCommissionAmount,
            currency: request.currency
        });

        return res.json({
            success: true,
            grant,
            lead: unlockedLead
        });
    } catch (error) {
        console.error('federation unlocked lead details error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to unlock Federation lead details.'
        });
    }
});

app.post('/api/federation/connect/requests/:requestId/payment-provider', requireApiUser, async (req, res) => {
    try {
        const requestId = sanitizeText(req.params.requestId);
        const requesterUid = sanitizeText(req.user?.id);
        const provider = normalizeFederationPaymentProvider(req.body?.provider);

        if (!requestId || !requesterUid) {
            return res.status(400).json({
                success: false,
                message: 'Missing Federation request id.'
            });
        }

        if (!provider) {
            return res.status(400).json({
                success: false,
                message: 'Choose Stripe or OxaPay.'
            });
        }

        const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Federation request not found.'
            });
        }

        const request = requestSnap.data() || {};

        if (sanitizeText(request.requesterUid) !== requesterUid) {
            return res.status(403).json({
                success: false,
                message: 'You can only choose a payment provider for your own request.'
            });
        }

        if (isFederationLeadPurchasePaid(request)) {
            return res.status(400).json({
                success: false,
                message: 'This request is already paid.'
            });
        }

        const pricingAmount = Math.max(0, Number(request.pricingAmount || request.dealPackage?.pricingAmount || 0));
        const currency = sanitizeText(request.currency || request.dealPackage?.currency || 'USD').toUpperCase() || 'USD';

        if (!pricingAmount) {
            return res.status(400).json({
                success: false,
                message: 'This Federation lead has no access price yet.'
            });
        }

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: sanitizeText(request.paymentLedgerId),
            sourceDivision: 'federation',
            sourceFeature: 'lead_purchase',
            sourceRecordId: requestId,

            payerUid: requesterUid,
            payerEmail: sanitizeText(request.requesterEmail || req.user?.email).toLowerCase(),
            payerName: sanitizeText(request.requesterName || req.user?.name || 'Federation Member'),

            provider,
            providerOptions: ['stripe', 'oxapay'],
            status: 'draft',
            paymentMethod: getFederationPaymentMethodLabel(provider),

            amount: pricingAmount,
            currency,

            platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
            operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

            metadata: {
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                requestId,
                opportunityTitle: sanitizeText(request.opportunityTitle || 'Federation lead purchase'),
                listingAvailability: 'lifetime',
                unlimitedPurchases: true
            }
        });

        await requestRef.set({
            paymentLedgerId: payment.id,
            paymentLedgerStatus: payment.status,
            selectedPaymentProvider: provider,
            paymentProviderLabel: getFederationPaymentProviderLabel(provider),
            paymentProviderOptions: ['stripe', 'oxapay'],
            paymentMethod: getFederationPaymentMethodLabel(provider),
            sourcePaymentMode: 'lead_purchase',
            listingAvailability: 'lifetime',
            unlimitedPurchases: true,
            paymentProviderSelectedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true,
            provider,
            providerLabel: getFederationPaymentProviderLabel(provider),
            payment,
            checkoutReady: false,
            nextProviderPatch:
                provider === 'stripe'
                    ? 'Stripe Checkout will be connected to this ledger next.'
                    : 'OxaPay crypto invoice checkout will be connected to this ledger next.'
        });
    } catch (error) {
        console.error('federation payment provider selection error:', error);

        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to select payment provider.'
        });
    }
});

app.post('/api/federation/connect/requests/:requestId/oxapay-invoice', requireApiUser, async (req, res) => {
    try {
        const requestId = sanitizeText(req.params.requestId);
        const requesterUid = sanitizeText(req.user?.id);

        if (!requestId || !requesterUid) {
            return res.status(400).json({
                success: false,
                message: 'Missing Federation request id.'
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

        const request = requestSnap.data() || {};

        if (sanitizeText(request.requesterUid) !== requesterUid) {
            return res.status(403).json({
                success: false,
                message: 'You can only pay for your own Federation request.'
            });
        }

        if (isFederationPaidStatus(request.status) || sanitizeText(request.paymentStatus).toLowerCase() === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This Federation request is already paid.'
            });
        }

        const selectedProvider = normalizeFederationPaymentProvider(request.selectedPaymentProvider);

        if (selectedProvider && selectedProvider !== 'oxapay') {
            return res.status(400).json({
                success: false,
                message: 'This request is currently set to Stripe. Choose OxaPay before opening a crypto invoice.'
            });
        }

        const pricingAmount = Math.max(0, Number(request.pricingAmount || request.dealPackage?.pricingAmount || 0));
        const currency = sanitizeText(request.currency || request.dealPackage?.currency || 'USD').toUpperCase() || 'USD';

        if (!pricingAmount) {
            return res.status(400).json({
                success: false,
                message: 'This Federation lead has no access price yet.'
            });
        }

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: sanitizeText(request.paymentLedgerId),
            sourceDivision: 'federation',
            sourceFeature: 'lead_purchase',
            sourceRecordId: requestId,

            payerUid: requesterUid,
            payerEmail: sanitizeText(request.requesterEmail || req.user?.email).toLowerCase(),
            payerName: sanitizeText(request.requesterName || req.user?.name || 'Federation Member'),

            provider: 'oxapay',
            providerOptions: ['stripe', 'oxapay'],
            status: 'checkout_started',
            paymentMethod: 'crypto',

            amount: pricingAmount,
            currency,

            platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
            operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

            metadata: {
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                requestId,
                opportunityTitle: sanitizeText(request.opportunityTitle || 'Federation lead purchase'),
                listingAvailability: 'lifetime',
                unlimitedPurchases: true
            }
        });

        const baseUrl = resolvePublicBaseUrl(req);
        const orderId = buildFederationLeadPurchaseOrderId(requestId);
        const requesterEmail = sanitizeText(request.requesterEmail || req.user?.email).toLowerCase();
        const title = sanitizeText(request.opportunityTitle || 'Federation lead purchase').slice(0, 120);

        const invoicePayload = {
            amount: Number(pricingAmount.toFixed(2)),
            currency,
            lifetime: Math.max(15, Math.min(2880, Number(process.env.OXAPAY_INVOICE_LIFETIME_MINUTES || 60))),
            fee_paid_by_payer: Number(process.env.OXAPAY_FEE_PAID_BY_PAYER || 1),
            mixed_payment: true,
            callback_url: `${baseUrl}/api/oxapay/webhook`,
            return_url: `${baseUrl}/federation.html?checkout=oxapay-success&request=${encodeURIComponent(requestId)}`,
            email: requesterEmail || undefined,
            order_id: orderId,
            thanks_message: 'Payment received. Return to Federation to unlock your purchased lead.',
            description: `YH Federation Lead Access: ${title}`,
            sandbox: isOxaPaySandboxEnabled()
        };

        const invoiceResult = await callOxaPayInvoiceApi(invoicePayload);
        const invoice = invoiceResult.data || {};

        const trackId = sanitizeText(invoice.track_id);
        const paymentUrl = sanitizeText(invoice.payment_url);

        if (!trackId || !paymentUrl) {
            return res.status(502).json({
                success: false,
                message: 'OxaPay did not return a valid invoice link.'
            });
        }

        await paymentLedgerRepo.upsertPaymentRecord({
            id: payment.id,
            sourceDivision: 'federation',
            sourceFeature: 'lead_purchase',
            sourceRecordId: requestId,

            payerUid: requesterUid,
            payerEmail: requesterEmail,
            payerName: sanitizeText(request.requesterName || req.user?.name || 'Federation Member'),

            provider: 'oxapay',
            providerOptions: ['stripe', 'oxapay'],
            providerPaymentId: trackId,
            providerCheckoutUrl: paymentUrl,
            providerStatus: 'invoice_created',

            amount: pricingAmount,
            currency,

            status: 'checkout_started',
            paymentMethod: 'crypto',

            platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
            operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

            metadata: {
                requestId,
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayInvoicePayload: invoicePayload,
                listingAvailability: 'lifetime',
                unlimitedPurchases: true
            }
        });

        await requestRef.set({
            paymentLedgerId: sanitizeText(payment.id),
            paymentLedgerStatus: 'checkout_started',
            selectedPaymentProvider: 'oxapay',
            paymentProviderLabel: 'OxaPay',
            paymentProviderOptions: ['stripe', 'oxapay'],
            paymentMethod: 'crypto',
            sourcePaymentMode: 'lead_purchase',
            paymentStatus: 'checkout_started',
            oxapayTrackId: trackId,
            oxapayOrderId: orderId,
            oxapayInvoiceUrl: paymentUrl,
            oxapayInvoiceExpiredAt: invoice.expired_at || null,
            oxapayInvoiceCreatedAt: invoice.date || null,
            checkoutStartedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'oxapay',
            providerLabel: 'OxaPay',
            paymentLedgerId: payment.id,
            oxapayTrackId: trackId,
            url: paymentUrl
        });
    } catch (error) {
        console.error('federation lead purchase oxapay invoice error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to start OxaPay crypto invoice for Federation lead purchase.'
        });
    }
});

app.post('/api/federation/connect/requests/:requestId/checkout-session', requireApiUser, async (req, res) => {
    try {
        const requestId = sanitizeText(req.params.requestId);
        const requesterUid = sanitizeText(req.user?.id);

        if (!requestId || !requesterUid) {
            return res.status(400).json({
                success: false,
                message: 'Missing Federation request id.'
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

        const request = requestSnap.data() || {};

        if (sanitizeText(request.requesterUid) !== requesterUid) {
            return res.status(403).json({
                success: false,
                message: 'You can only pay for your own Federation request.'
            });
        }

        if (isFederationPaidStatus(request.status) || sanitizeText(request.paymentStatus).toLowerCase() === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This Federation request is already paid.'
            });
        }

        const selectedProvider = normalizeFederationPaymentProvider(request.selectedPaymentProvider);

        if (selectedProvider && selectedProvider !== 'stripe') {
            return res.status(400).json({
                success: false,
                message: 'This request is currently set to OxaPay. Choose Stripe before opening Stripe Checkout.'
            });
        }

        const pricingAmount = Math.max(0, Number(request.pricingAmount || request.dealPackage?.pricingAmount || 0));
        const currency = sanitizeText(request.currency || request.dealPackage?.currency || 'USD').toUpperCase() || 'USD';
        const unitAmount = toStripeMinorUnit(pricingAmount, currency);

        if (!pricingAmount || !unitAmount) {
            return res.status(400).json({
                success: false,
                message: 'This Federation lead has no access price yet.'
            });
        }

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: sanitizeText(request.paymentLedgerId),
            sourceDivision: 'federation',
            sourceFeature: 'lead_purchase',
            sourceRecordId: requestId,

            payerUid: requesterUid,
            payerEmail: sanitizeText(request.requesterEmail || req.user?.email).toLowerCase(),
            payerName: sanitizeText(request.requesterName || req.user?.name || 'Federation Member'),

            provider: 'stripe',
            providerOptions: ['stripe', 'oxapay'],
            status: 'checkout_started',
            paymentMethod: 'card_bank_wallet',

            amount: pricingAmount,
            currency,

            platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
            operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

            metadata: {
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                requestId,
                opportunityTitle: sanitizeText(request.opportunityTitle || 'Federation lead purchase'),
                listingAvailability: 'lifetime',
                unlimitedPurchases: true
            }
        });

        const stripe = getStripeClient();
        const baseUrl = resolvePublicBaseUrl(req);
        const title = sanitizeText(request.opportunityTitle || 'Federation lead purchase').slice(0, 120);
        const requesterEmail = sanitizeText(request.requesterEmail || req.user?.email).toLowerCase();

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            client_reference_id: requestId,
            customer_email: requesterEmail || undefined,
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: 'YH Federation Lead Access',
                            description: title
                        },
                        unit_amount: unitAmount
                    },
                    quantity: 1
                }
            ],
            success_url: `${baseUrl}/federation.html?checkout=success&request=${encodeURIComponent(requestId)}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/federation.html?checkout=cancelled&request=${encodeURIComponent(requestId)}`,
            metadata: {
                kind: 'federation_lead_purchase',
                requestId,
                requesterUid,
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                paymentLedgerId: sanitizeText(payment.id),
                sourceDivision: 'federation',
                sourceFeature: 'lead_purchase',
                listingAvailability: 'lifetime',
                unlimitedPurchases: 'true'
            },
            payment_intent_data: {
                metadata: {
                    kind: 'federation_lead_purchase',
                    requestId,
                    requesterUid,
                    ownerUid: sanitizeText(request.ownerUid),
                    leadId: sanitizeText(request.leadId),
                    paymentLedgerId: sanitizeText(payment.id)
                }
            }
        });

        await paymentLedgerRepo.upsertPaymentRecord({
            id: payment.id,
            sourceDivision: 'federation',
            sourceFeature: 'lead_purchase',
            sourceRecordId: requestId,

            payerUid: requesterUid,
            payerEmail: requesterEmail,
            payerName: sanitizeText(request.requesterName || req.user?.name || 'Federation Member'),

            provider: 'stripe',
            providerOptions: ['stripe', 'oxapay'],
            providerPaymentId: sanitizeText(session.id),
            providerCheckoutUrl: sanitizeText(session.url),
            providerStatus: 'checkout_started',

            amount: pricingAmount,
            currency,

            status: 'checkout_started',
            paymentMethod: 'card_bank_wallet',

            platformCommissionAmount: Math.max(0, Number(request.platformCommissionAmount || 0)),
            operatorPayoutAmount: Math.max(0, Number(request.operatorPayoutAmount || 0)),

            metadata: {
                requestId,
                ownerUid: sanitizeText(request.ownerUid),
                leadId: sanitizeText(request.leadId),
                stripeCheckoutSessionId: sanitizeText(session.id),
                listingAvailability: 'lifetime',
                unlimitedPurchases: true
            }
        });

        await requestRef.set({
            paymentLedgerId: sanitizeText(payment.id),
            paymentLedgerStatus: 'checkout_started',
            selectedPaymentProvider: 'stripe',
            paymentProviderLabel: 'Stripe',
            paymentProviderOptions: ['stripe', 'oxapay'],
            paymentMethod: 'card_bank_wallet',
            sourcePaymentMode: 'lead_purchase',
            paymentStatus: 'checkout_started',
            stripeCheckoutSessionId: sanitizeText(session.id),
            stripeCheckoutSessionUrl: sanitizeText(session.url),
            checkoutStartedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'stripe',
            providerLabel: 'Stripe',
            paymentLedgerId: payment.id,
            checkoutSessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('federation lead purchase stripe checkout session error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to start Stripe checkout for Federation lead purchase.'
        });
    }
});


app.get('/api/federation/connect/my-requests', requireApiUser, async (req, res) => {
    try {
        const requesterUid = sanitizeText(req.user?.id);

        if (!requesterUid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        let snap = null;

        try {
            snap = await firestore
                .collection('federationConnectionRequests')
                .where('requesterUid', '==', requesterUid)
                .limit(80)
                .get();
        } catch (queryError) {
            console.error('federation connect my requests query error:', queryError);

            return res.json({
                success: true,
                requests: [],
                warning: 'Federation Connect requests are temporarily unavailable.'
            });
        }

        const requests = [];

        snap.forEach((docSnap) => {
            try {
                const data = docSnap.data() || {};

                requests.push({
                    id: docSnap.id,
                    leadId: sanitizeText(data.leadId),
                    ownerUid: sanitizeText(data.ownerUid),
                    leadPath: sanitizeText(data.leadPath),
                    requestMode: sanitizeText(data.requestMode || 'selected_lead'),
                    requestedContact: data.requestedContact && typeof data.requestedContact === 'object'
                        ? data.requestedContact
                        : null,

                    opportunityId: sanitizeText(data.opportunityId),
                    opportunityTitle: sanitizeText(data.opportunityTitle),
                    opportunitySnapshot: data.opportunitySnapshot && typeof data.opportunitySnapshot === 'object'
                        ? data.opportunitySnapshot
                        : null,

                    matchedLeadSnapshot: data.matchedLeadSnapshot && typeof data.matchedLeadSnapshot === 'object'
                        ? data.matchedLeadSnapshot
                        : null,
                    matchedAt: mapFederationConnectTimestamp(data.matchedAt),
                    matchedBy: sanitizeText(data.matchedBy),

                    status: sanitizeText(data.status || 'pending_admin_match'),
                    adminStatus: sanitizeText(data.adminStatus || 'pending_review'),

                    pricingAmount: Number(data.pricingAmount || data.dealPackage?.pricingAmount || 0),
                    currency: sanitizeText(data.currency || data.dealPackage?.currency || 'USD') || 'USD',
                    platformCommissionRate: Number(data.platformCommissionRate || data.dealPackage?.platformCommissionRate || 0),
                    platformCommissionAmount: Number(data.platformCommissionAmount || data.dealPackage?.platformCommissionAmount || 0),
                    operatorPayoutAmount: Number(data.operatorPayoutAmount || data.dealPackage?.operatorPayoutAmount || 0),
                    paymentStatus: sanitizeText(data.paymentStatus || data.dealPackage?.paymentStatus || 'not_started'),
                    payoutStatus: sanitizeText(data.payoutStatus || data.dealPackage?.payoutStatus || 'not_started'),
                    commissionStatus: sanitizeText(data.commissionStatus || data.dealPackage?.commissionStatus || 'not_started'),
                    dealNotes: sanitizeText(data.dealNotes || data.dealPackage?.dealNotes),

                    paymentLedgerId: sanitizeText(data.paymentLedgerId),
                    paymentLedgerStatus: sanitizeText(data.paymentLedgerStatus || 'draft'),
                    selectedPaymentProvider: sanitizeText(data.selectedPaymentProvider),
                    paymentProviderLabel: sanitizeText(data.paymentProviderLabel),
                    paymentProviderOptions: Array.isArray(data.paymentProviderOptions)
                        ? data.paymentProviderOptions
                        : ['stripe', 'oxapay'],
                    sourcePaymentMode: sanitizeText(data.sourcePaymentMode || 'lead_purchase'),

                    leadAccessGrantId: sanitizeText(data.leadAccessGrantId),
                    leadAccessStatus: sanitizeText(data.leadAccessStatus),
                    leadUnlockedAt: mapFederationConnectTimestamp(data.leadUnlockedAt),

                    budgetRange: sanitizeText(data.budgetRange || 'not_sure'),
                    urgency: sanitizeText(data.urgency || 'normal'),
                    preferredIntroType: sanitizeText(data.preferredIntroType || 'admin_brokered'),
                    requestReason: sanitizeText(data.requestReason),
                    intendedUse: sanitizeText(data.intendedUse),
                    createdAt: mapFederationConnectTimestamp(data.createdAt),
                    updatedAt: mapFederationConnectTimestamp(data.updatedAt)
                });
            } catch (mapError) {
                console.error('federation connect request map error:', mapError);
            }
        });

        requests.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('federation connect my requests error:', error);

        return res.json({
            success: true,
            requests: [],
            warning: 'Federation Connect requests could not be loaded.'
        });
    }
});

app.post('/api/federation/connect/requests', requireApiUser, async (req, res) => {
    try {
        const requesterUid = sanitizeText(req.user?.id);
        const requesterEmail = sanitizeText(req.user?.email).toLowerCase();
        const requesterName = sanitizeText(req.user?.name || req.user?.username || 'Federation Member');

        const body = req.body || {};
        const ownerUid = sanitizeText(body.ownerUid);
        const leadId = sanitizeText(body.leadId);
        const hasSelectedLead = Boolean(ownerUid && leadId);

        const requestedContact = {
            companyName: sanitizeText(body.companyName).slice(0, 180),
            companyWebsite: sanitizeText(body.companyWebsite).slice(0, 500),
            contactName: sanitizeText(body.contactName).slice(0, 180),
            contactRole: sanitizeText(body.contactRole).slice(0, 180),
            contactType: sanitizeText(body.contactType).slice(0, 120),
            city: sanitizeText(body.city).slice(0, 120),
            country: sanitizeText(body.country).slice(0, 120),
            sourceMethod: sanitizeText(body.sourceMethod).slice(0, 120),
            channel: sanitizeText(body.channel).slice(0, 120),
            pipelineStage: sanitizeText(body.pipelineStage).slice(0, 120),
            priority: sanitizeText(body.priority).slice(0, 80),
            requestedTier: sanitizeText(body.requestedTier).slice(0, 40)
        };

        if (!requestedContact.contactRole || !requestedContact.contactType || !requestedContact.country) {
            return res.status(400).json({
                success: false,
                message: 'Please add the contact role, contact type, and country.'
            });
        }

        const requestReason = sanitizeText(body.requestReason).slice(0, 1200);

        if (!requestReason || requestReason.length < 12) {
            return res.status(400).json({
                success: false,
                message: 'Please explain why you need this contact.'
            });
        }

        let leadRef = null;
        let opportunity = {
            id: '',
            leadId: '',
            ownerUid: '',
            title: `Looking for ${requestedContact.contactRole} in ${requestedContact.city ? `${requestedContact.city}, ` : ''}${requestedContact.country}`,
            category: requestedContact.contactType || 'Strategic Network',
            contactRole: requestedContact.contactRole,
            city: requestedContact.city,
            country: requestedContact.country,
            strategicValue: 'requested',
            tier: requestedContact.requestedTier || '',
            sourceDivision: 'federation',
            pipelineStage: requestedContact.pipelineStage || '',
            sourceMethod: requestedContact.sourceMethod || '',
            contactType: requestedContact.contactType,
            companyLabel: requestedContact.companyName || 'Requested organization',
            hasEmail: false,
            hasPhone: false,
            hasDirectContact: false,
            summary: requestReason,
            createdAt: null,
            updatedAt: null
        };

        if (hasSelectedLead) {
            leadRef = firestore
                .collection('users')
                .doc(ownerUid)
                .collection('academyLeadMissions')
                .doc(leadId);

            const leadSnap = await leadRef.get();

            if (!leadSnap.exists) {
                return res.status(404).json({
                    success: false,
                    message: 'This Federation Connect opportunity is no longer available.'
                });
            }

            const lead = leadSnap.data() || {};

            if (lead.federationReady !== true) {
                return res.status(403).json({
                    success: false,
                    message: 'This lead has not been approved for Federation Connect.'
                });
            }

            opportunity = mapFederationConnectOpportunityDoc(leadSnap);
        }

        const now = Timestamp.now();

        const selectedLeadHasListedPrice =
            hasSelectedLead &&
            Math.max(0, Number(opportunity.buyerPriceAmount || 0)) > 0;

        const selectedLeadPricingPatch = selectedLeadHasListedPrice
            ? {
                pricingAmount: Math.max(0, Number(opportunity.buyerPriceAmount || 0)),
                currency: sanitizeText(opportunity.currency || 'USD').toUpperCase() || 'USD',
                platformCommissionRate: Math.max(0, Math.min(100, Number(opportunity.universeCommissionRate || 0))),
                platformCommissionAmount: Math.max(0, Number(opportunity.universeCommissionAmount || 0)),
                operatorPayoutAmount: Math.max(0, Number(opportunity.sellerPriceAmount || 0)),
                paymentStatus: 'not_started',
                paymentProviderOptions: ['stripe', 'oxapay'],
                sourcePaymentMode: 'lead_purchase'
            }
            : {};

        const requestPayload = {
            requesterUid,
            requesterEmail,
            requesterName,

            ownerUid: hasSelectedLead ? ownerUid : '',
            leadId: hasSelectedLead ? leadId : '',
            leadPath: hasSelectedLead && leadRef ? leadRef.path : '',
            requestMode: hasSelectedLead ? 'selected_lead' : 'match_request',
            requestedContact,

            sourceDivision: 'federation',
            sourceFeature: 'connect',

            opportunityId: opportunity.id,
            opportunityTitle: opportunity.title,
            opportunitySnapshot: opportunity,

            ...selectedLeadPricingPatch,

            requestReason,
            intendedUse: sanitizeText(body.intendedUse).slice(0, 1200),
            budgetRange: normalizeFederationConnectBudgetRange(body.budgetRange),
            urgency: normalizeFederationConnectUrgency(body.urgency),
            preferredIntroType: normalizeFederationConnectIntroType(body.preferredIntroType),
            notes: sanitizeText(body.notes).slice(0, 1200),

            status: selectedLeadHasListedPrice ? 'pricing_sent' : 'pending_admin_match',
            adminStatus: selectedLeadHasListedPrice ? 'listed_payment_ready' : 'pending_review',
            payoutStatus: 'not_started',
            commissionStatus: 'not_started',

            createdAt: now,
            updatedAt: now
        };

        const ref = await firestore.collection('federationConnectionRequests').add(requestPayload);

        return res.status(201).json({
            success: true,
            request: {
                id: ref.id,
                ...requestPayload,
                createdAt: mapFederationConnectTimestamp(requestPayload.createdAt),
                updatedAt: mapFederationConnectTimestamp(requestPayload.updatedAt)
            }
        });
    } catch (error) {
        console.error('federation connect request create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Federation Connect request.'
        });
    }
});

app.get('/api/federation/application-status', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const snap = await firestore.collection('users').doc(userId).get();
        const user = snap.exists ? (snap.data() || {}) : {};

        const application =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        const status = sanitizeText(
            user.federationApplicationStatus ||
            user.federationMembershipStatus ||
            application?.status ||
            ''
        );

        const approved =
            user.hasFederationAccess === true ||
            status.toLowerCase() === 'approved';

        const divisionOverride = getUserDivisionOverride(user, 'federation');

        return res.json({
            success: true,
            hasApplication: Boolean(application),
            canEnterFederation: approved,
            applicationStatus: status,
            application,
            divisionOverride,
            member: approved
                ? {
                    id: userId,
                    name: sanitizeText(user.fullName || user.name || user.displayName || req.user?.name || 'Federation Member'),
                    email: sanitizeText(user.email || req.user?.email || ''),
                    divisions: ['Federation'],
                    status: 'Active'
                }
                : null
        });
    } catch (error) {
        console.error('federation application status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation application status.'
        });
    }
});

app.post('/api/federation/application', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const body = req.body || {};
        const nowIso = new Date().toISOString();

        const profileMap = buildFederationProfileMap(body, {
            role: body.role || body.profession
        });

        const fullName = sanitizeText(body.fullName || body.name || req.user?.name || 'Federation Applicant').slice(0, 160);
        const email = sanitizeText(body.email || req.user?.email || '').toLowerCase().slice(0, 180);
        const role = sanitizeText(profileMap.role || body.role || body.profession).slice(0, 180);
        const country = sanitizeText(body.country).slice(0, 120);
        const city = sanitizeText(body.city).slice(0, 120);
        const primaryCategory = sanitizeText(profileMap.primaryCategory || body.primaryCategory || body.category).slice(0, 180);

        if (!fullName || !email || !role || !country || !city || !primaryCategory) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all required Federation application fields.'
            });
        }

        const userRef = firestore.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};

        const existingApplication =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        const existingStatus = sanitizeText(
            user.federationApplicationStatus ||
            existingApplication?.status ||
            ''
        ).toLowerCase();

        if (
            existingApplication &&
            existingStatus &&
            existingStatus !== 'rejected' &&
            existingStatus !== 'declined' &&
            existingStatus !== 'denied'
        ) {
            return res.json({
                success: true,
                alreadySubmitted: true,
                application: existingApplication,
                applicationStatus: existingApplication.status || user.federationApplicationStatus || 'Under Review'
            });
        }

        const applicationTrack = resolveServerDivisionApplicationTrack({
            incomingTrack: body.applicationTrack,
            membershipType: body.membershipType,
            user
        });

        const federationGate = await buildServerDivisionGatePayloadForUser({
            userId,
            division: 'federation',
            track: applicationTrack
        });

        if (rejectIfAcademyProgressionLocked(res, federationGate.academyUnlockRequirement)) {
            return;
        }

        const academySignalSnapshot = federationGate.academySignalSnapshot;
        const academyUnlockRequirement = federationGate.academyUnlockRequirement;

        const applicationId =
            sanitizeText(body.id) ||
            `FED-APP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const application = {
            ...body,
            id: applicationId,
            applicationType: 'federation-access',
            division: 'Federation',
            divisions: ['Federation'],
            recommendedDivision: 'Federation',
            reviewLane: 'Federation Access',
            source: sanitizeText(body.source || 'Dashboard Federation Application'),
            status: 'Under Review',

            applicationTrack,
            directStrategicApplicant: applicationTrack === 'direct_strategic',
            academySignalSnapshot,
            academyUnlockRequirement,
            directStrategicProof:
                body.directStrategicProof && typeof body.directStrategicProof === 'object'
                    ? {
                        authorityProof: sanitizeText(body.directStrategicProof.authorityProof).slice(0, 2500),
                        proofLinks: sanitizeText(body.directStrategicProof.proofLinks).slice(0, 1800),
                        networkSize: sanitizeText(body.directStrategicProof.networkSize).slice(0, 900),
                        capitalAccess: sanitizeText(body.directStrategicProof.capitalAccess).slice(0, 900),
                        riskNote: sanitizeText(body.directStrategicProof.riskNote).slice(0, 1200)
                    }
                    : {},

            name: fullName,
            fullName,
            username: sanitizeText(body.username || user.username || req.user?.username || ''),
            email,
            telegram: sanitizeText(body.telegram).slice(0, 120),
            role,
            profession: role,
            country,
            city,
            region: sanitizeText(body.region || [city, country].filter(Boolean).join(', ')),
            company: sanitizeText(body.company).slice(0, 180),
            profileLink: sanitizeText(body.profileLink).slice(0, 500),
            primaryCategory,

            roles: profileMap.roles,
            level: profileMap.level,

            audienceSize: profileMap.audienceSize,
            activePlatforms: profileMap.activePlatforms,
            capitalRange: profileMap.capitalRange,
            teamSize: profileMap.teamSize,
            skillLevel: profileMap.skillLevel,

            lookingFor: profileMap.lookingFor,
            canOffer: profileMap.canOffer,
            wantsAccessTo: profileMap.wantsAccessTo,
            openTo: profileMap.openTo,

            opportunityInsight: profileMap.opportunityInsight,
            tenKPlan: profileMap.tenKPlan,
            openToFeature: profileMap.openToFeature,

            federationProfileMap: profileMap,
            federationTags: profileMap.tags,
            federationScore: profileMap.score,
            federationTier: profileMap.tier,

            goal: sanitizeText(body.goal || body.wantedContactReason || 'Apply for Federation access.').slice(0, 1200),
            background: sanitizeText(body.background || [role, body.company, primaryCategory, city, country].filter(Boolean).join(' • ')).slice(0, 1200),
            networkValue: sanitizeText(body.networkValue || body.valueBring).slice(0, 2500),
            valueBring: sanitizeText(body.valueBring).slice(0, 2500),
            accessContribution: sanitizeText(body.accessContribution).slice(0, 2500),
            regionsOfAccess: sanitizeText(body.regionsOfAccess).slice(0, 1200),

            lookingForContact: sanitizeText(body.lookingForContact).slice(0, 80),
            wantedContactTypes: Array.isArray(body.wantedContactTypes) ? body.wantedContactTypes : [],
            wantedContactTypesRaw: sanitizeText(body.wantedContactTypesRaw).slice(0, 1200),
            wantedContactRegion: sanitizeText(body.wantedContactRegion).slice(0, 1200),
            wantedContactReason: sanitizeText(body.wantedContactReason).slice(0, 2500),
            contactUrgency: sanitizeText(body.contactUrgency).slice(0, 80),

            canProvideContacts: sanitizeText(body.canProvideContacts).slice(0, 80),
            contactTypesCanProvide: Array.isArray(body.contactTypesCanProvide) ? body.contactTypesCanProvide : [],
            contactTypesCanProvideRaw: sanitizeText(body.contactTypesCanProvideRaw).slice(0, 1200),
            supplyRegions: sanitizeText(body.supplyRegions).slice(0, 1200),
            openToAdminMatching: sanitizeText(body.openToAdminMatching).slice(0, 120),

            aiScore: Number(body.aiScore || 0),
            createdAt: existingApplication?.createdAt || nowIso,
            updatedAt: nowIso,
            submittedAt: nowIso,
            reviewedAt: '',
            reviewedBy: '',
            notes: Array.isArray(body.notes)
                ? body.notes
                : ['Submitted through Dashboard Federation gate.']
        };

        await userRef.set({
            federationApplication: application,
            federationProfileMap: profileMap,
            federationTags: profileMap.tags,
            federationScore: profileMap.score,
            federationTier: profileMap.tier,
            federationApplicationStatus: 'Under Review',
            federationMembershipStatus: 'under review',
            hasFederationAccess: false,
            updatedAt: nowIso
        }, { merge: true });

        return res.status(201).json({
            success: true,
            application,
            applicationStatus: 'Under Review'
        });
    } catch (error) {
        console.error('submit federation application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Federation application.'
        });
    }
});

function mapSystemNotificationTimestamp(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return sanitizeText(value);
}

const USER_IN_PRODUCT_NOTIFICATION_LIMIT = 40;

function normalizeUserInProductNotification(item = {}) {
    const createdAt = mapSystemNotificationTimestamp(
        item?.createdAt ||
        item?.created_at ||
        item?.time ||
        ''
    );

    const isRead =
        item?.isRead === true ||
        item?.is_read === true ||
        item?.read === true ||
        sanitizeText(item?.isRead).toLowerCase() === 'true' ||
        sanitizeText(item?.is_read).toLowerCase() === 'true' ||
        sanitizeText(item?.read).toLowerCase() === 'true' ||
        Boolean(item?.readAt) ||
        Boolean(item?.read_at);

    return {
        id: sanitizeText(item?.id || ''),
        title: sanitizeText(item?.title || 'Notification'),
        text: sanitizeText(item?.text || item?.message || item?.body || ''),
        message: sanitizeText(item?.message || item?.text || item?.body || ''),
        body: sanitizeText(item?.body || item?.text || item?.message || ''),
        target: sanitizeText(item?.target || item?.targetType || item?.target_type || ''),
        targetType: sanitizeText(item?.targetType || item?.target_type || item?.target || ''),
        target_type: sanitizeText(item?.target_type || item?.targetType || item?.target || ''),
        targetId: sanitizeText(item?.targetId || item?.target_id || ''),
        target_id: sanitizeText(item?.target_id || item?.targetId || ''),
        color: sanitizeText(item?.color || 'var(--neon-blue)'),
        avatarStr: sanitizeText(item?.avatarStr || item?.initial || 'N'),
        initial: sanitizeText(item?.initial || item?.avatarStr || 'N'),
        source: sanitizeText(item?.source || 'admin-review'),
        notificationType: sanitizeText(item?.notificationType || 'application-review'),
        applicationField: sanitizeText(item?.applicationField || ''),
        applicationStatus: sanitizeText(item?.applicationStatus || ''),
        createdAt,
        created_at: createdAt,
        isRead,
        is_read: isRead,
        read: isRead,
        readAt: mapSystemNotificationTimestamp(item?.readAt || item?.read_at || ''),
        read_at: mapSystemNotificationTimestamp(item?.read_at || item?.readAt || '')
    };
}

function getUserInProductNotifications(user = {}) {
    const notifications = Array.isArray(user?.inProductReviewNotifications)
        ? user.inProductReviewNotifications
        : [];

    return notifications
        .map((item) => normalizeUserInProductNotification(item))
        .filter((item) => item.id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, USER_IN_PRODUCT_NOTIFICATION_LIMIT);
}
function buildInProductReviewNotification({
    title = 'Application Update',
    text = '',
    target = '',
    targetId = '',
    applicationField = '',
    applicationStatus = '',
    color = 'var(--neon-blue)',
    avatarStr = 'A',
    source = 'admin-review',
    notificationType = 'application-review'
} = {}) {
    const nowIso = new Date().toISOString();
    const id = `review_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    return {
        id,
        title: sanitizeText(title || 'Application Update'),
        text: sanitizeText(text),
        message: sanitizeText(text),
        body: sanitizeText(text),
        target: sanitizeText(target),
        targetType: sanitizeText(target),
        target_type: sanitizeText(target),
        targetId: sanitizeText(targetId),
        target_id: sanitizeText(targetId),
        color: sanitizeText(color || 'var(--neon-blue)'),
        avatarStr: sanitizeText(avatarStr || 'A'),
        initial: sanitizeText(avatarStr || 'A'),
        source: sanitizeText(source || 'admin-review'),
        notificationType: sanitizeText(notificationType || 'application-review'),
        applicationField: sanitizeText(applicationField),
        applicationStatus: sanitizeText(applicationStatus),
        createdAt: nowIso,
        created_at: nowIso,
        isRead: false,
        is_read: false,
        read: false,
        readAt: '',
        read_at: ''
    };
}

async function appendUserInProductNotification(userRef, user = {}, notification = {}) {
    const current = getUserInProductNotifications(user);

    const next = [
        normalizeUserInProductNotification(notification),
        ...current.filter((item) => sanitizeText(item?.id) !== sanitizeText(notification?.id))
    ].slice(0, USER_IN_PRODUCT_NOTIFICATION_LIMIT);

    await userRef.set({
        inProductReviewNotifications: next,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    return next;
}

app.get('/api/member/system-notifications', requireApiUser, async (req, res) => {
    try {
        const userRef = firestore.collection('users').doc(req.user.id);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};

        return res.json({
            success: true,
            notifications: getUserInProductNotifications(user)
        });
    } catch (error) {
        console.error('member system notifications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load member notifications.'
        });
    }
});

app.post('/api/member/system-notifications/:id/read', requireApiUser, async (req, res) => {
    try {
        const notificationId = sanitizeText(req.params.id);
        if (!notificationId) {
            return res.status(400).json({
                success: false,
                message: 'Notification id is required.'
            });
        }

        const userRef = firestore.collection('users').doc(req.user.id);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const current = getUserInProductNotifications(user);
        const nowIso = new Date().toISOString();

        const next = current.map((item) => {
            if (sanitizeText(item.id) !== notificationId) return item;

            return {
                ...item,
                isRead: true,
                is_read: true,
                read: true,
                readAt: nowIso,
                read_at: nowIso
            };
        });

        await userRef.set({
            inProductReviewNotifications: next,
            updatedAt: nowIso
        }, { merge: true });

        return res.json({
            success: true,
            notifications: next
        });
    } catch (error) {
        console.error('member system notification read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark member notification as read.'
        });
    }
});

app.post('/api/member/system-notifications/read-all', requireApiUser, async (req, res) => {
    try {
        const userRef = firestore.collection('users').doc(req.user.id);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const current = getUserInProductNotifications(user);
        const nowIso = new Date().toISOString();

        const next = current.map((item) => ({
            ...item,
            isRead: true,
            is_read: true,
            read: true,
            readAt: nowIso,
            read_at: nowIso
        }));

        await userRef.set({
            inProductReviewNotifications: next,
            updatedAt: nowIso
        }, { merge: true });

        return res.json({
            success: true,
            notifications: next
        });
    } catch (error) {
        console.error('member system notifications read-all error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark all member notifications as read.'
        });
    }
});

app.get('/api/plaza/application-status', requireApiUser, async (req, res) => {
    try {
        const snapshot = await getPlazaAccessSnapshotForUser(req.user?.id, req.user);

        return res.json({
            success: true,
            ...snapshot
        });
    } catch (error) {
        console.error('plaza application status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza application status.'
        });
    }
});

function normalizePlazaApplicationShort(value = '', max = 180) {
    return sanitizeText(value).slice(0, max);
}

function normalizePlazaApplicationLong(value = '', max = 1800) {
    return sanitizeText(value).slice(0, max);
}
const YH_PLAZA_ACADEMY_UNLOCK_SCORE = 60;
const YH_FEDERATION_ACADEMY_UNLOCK_SCORE = 80;

function getSafeObject(value = {}) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function isDivisionOverrideActive(override = {}) {
    const data = getSafeObject(override);
    const active = data.unlocked === true || data.active === true;

    if (!active) return false;

    const expiresAt = sanitizeText(data.expiresAt || '');

    if (!expiresAt) return true;

    const expiresMs = Date.parse(expiresAt);

    if (!Number.isFinite(expiresMs)) return true;

    return expiresMs > Date.now();
}

function getUserDivisionOverride(user = {}, division = 'plaza') {
    const normalizedDivision = sanitizeText(division).toLowerCase() === 'federation'
        ? 'federation'
        : 'plaza';

    const overrides = getSafeObject(user.divisionApplicationOverrides);
    const override = getSafeObject(overrides[normalizedDivision]);

    return isDivisionOverrideActive(override) ? override : null;
}

function normalizeDivisionApplicationTrack(value = '', fallback = 'academy_progression') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'direct_strategic' || raw === 'direct strategic' || raw === 'strategic') {
        return 'direct_strategic';
    }

    if (raw === 'academy_progression' || raw === 'academy progression' || raw === 'academy') {
        return 'academy_progression';
    }

    return fallback;
}

function buildServerAcademyUnlockRequirement({
    division = 'plaza',
    track = 'academy_progression',
    academySignalSnapshot = {},
    academyUnlockRequirement = {},
    divisionOverride = null
} = {}) {
    const normalizedDivision = sanitizeText(division).toLowerCase() === 'federation'
        ? 'federation'
        : 'plaza';

    const requirement = getSafeObject(academyUnlockRequirement);
    const signal = getSafeObject(academySignalSnapshot);

    const requiredScore = normalizedDivision === 'federation'
        ? YH_FEDERATION_ACADEMY_UNLOCK_SCORE
        : YH_PLAZA_ACADEMY_UNLOCK_SCORE;

    const currentScore = Math.max(
        0,
        Math.min(
            100,
            Number(
                requirement.currentScore ??
                signal.readinessScore ??
                0
            )
        )
    );

    const normalizedTrack = normalizeDivisionApplicationTrack(track);
    const activeOverride = getSafeObject(divisionOverride);
    const ready = currentScore >= requiredScore;

    if (isDivisionOverrideActive(activeOverride)) {
        return {
            division: normalizedDivision,
            track: 'admin_override',
            requiredScore,
            currentScore,
            unlocked: true,
            ready,
            label: 'Admin Override',
            copy: sanitizeText(activeOverride.reason || '') || `Application is open. Admin override remains recorded as context only.`,
            divisionOverride: activeOverride
        };
    }

    if (normalizedTrack === 'direct_strategic') {
        return {
            division: normalizedDivision,
            track: normalizedTrack,
            requiredScore,
            currentScore,
            unlocked: true,
            ready: false,
            label: 'Direct Strategic Review',
            copy: 'Application is open. This applicant is not moving through Academy progression yet, so admin should review them as direct strategic.'
        };
    }

    const label = normalizedDivision === 'federation'
        ? ready
            ? 'Federation-ready'
            : 'Building Federation Signal'
        : ready
            ? 'Plaza-ready'
            : 'Building Plaza Signal';

    return {
        division: normalizedDivision,
        track: normalizedTrack,
        requiredScore,
        currentScore,
        unlocked: true,
        ready,
        label,
        copy: ready
            ? `Application is open. Academy Score ${currentScore}/${requiredScore} is a strong ${normalizedDivision} readiness signal.`
            : `Application is open anytime. Academy Score ${currentScore}/${requiredScore} is only a readiness signal, not a lock.`
    };
}

function rejectIfAcademyProgressionLocked(res, requirement = {}) {
    return false;
}

function isServerAcademyApprovedUser(user = {}) {
    const academyStatus = sanitizeText(
        user.academyApplicationStatus ||
        user.academyMembershipStatus ||
        user.academyStatus ||
        ''
    ).toLowerCase();

    const divisions = Array.isArray(user.divisions)
        ? user.divisions.map((item) => sanitizeText(item).toLowerCase())
        : [];

    return (
        user.hasAcademyAccess === true ||
        user.canEnterAcademy === true ||
        academyStatus === 'approved' ||
        academyStatus === 'active' ||
        divisions.includes('academy')
    );
}

function resolveServerDivisionApplicationTrack({
    incomingTrack = '',
    membershipType = '',
    user = {}
} = {}) {
    const fallback = membershipType === 'direct_strategic'
        ? 'direct_strategic'
        : 'academy_progression';

    const normalizedTrack = normalizeDivisionApplicationTrack(incomingTrack, fallback);

    if (isServerAcademyApprovedUser(user)) {
        return 'academy_progression';
    }

    return normalizedTrack;
}

async function buildServerDivisionGatePayloadForUser({
    userId = '',
    division = 'plaza',
    track = 'academy_progression'
} = {}) {
    let homePayload = null;
    let userRecord = {};

    try {
        const userSnap = await firestore.collection('users').doc(userId).get();
        userRecord = userSnap.exists ? (userSnap.data() || {}) : {};
    } catch (error) {
        console.error('buildServerDivisionGatePayloadForUser user override error:', error);
        userRecord = {};
    }

    try {
        homePayload = await academyFirestoreRepo.buildAcademyHomePayload(userId);
    } catch (error) {
        console.error('buildServerDivisionGatePayloadForUser academy score error:', error);
        homePayload = null;
    }

    const plazaReadiness =
        homePayload?.plazaReadiness && typeof homePayload.plazaReadiness === 'object'
            ? homePayload.plazaReadiness
            : {};

    const profileSignals =
        homePayload?.profileSignals && typeof homePayload.profileSignals === 'object'
            ? homePayload.profileSignals
            : {};

    const scoreBreakdown =
        plazaReadiness?.scoreBreakdown && typeof plazaReadiness.scoreBreakdown === 'object'
            ? plazaReadiness.scoreBreakdown
            : {};

    const academySignalSnapshot = {
        academyApproved: true,
        readinessScore: Math.max(0, Math.min(100, Number(plazaReadiness.score || 0))),
        readinessStatus: sanitizeText(plazaReadiness.statusLabel || ''),
        marketplaceReady: plazaReadiness.marketplaceReady === true,

        missionCompletionRatio: Number(plazaReadiness.missionCompletionRatio || 0),
        completedCount: Number(plazaReadiness.completedCount || 0),
        totalCount: Number(plazaReadiness.totalCount || 0),
        missionExecutionScore: Number(scoreBreakdown.missionExecutionScore || 0),

        roleTrack: sanitizeText(profileSignals.roleTrack || ''),
        lookingFor: Array.isArray(profileSignals.lookingFor) ? profileSignals.lookingFor : [],
        canOffer: Array.isArray(profileSignals.canOffer) ? profileSignals.canOffer : [],
        availability: sanitizeText(profileSignals.availability || ''),
        workMode: sanitizeText(profileSignals.workMode || ''),
        proofFocus: sanitizeText(profileSignals.proofFocus || '')
    };

    const divisionOverride = getUserDivisionOverride(userRecord, division);

    const academyUnlockRequirement = buildServerAcademyUnlockRequirement({
        division,
        track,
        academySignalSnapshot,
        academyUnlockRequirement: {},
        divisionOverride
    });

    return {
        academySignalSnapshot,
        academyUnlockRequirement,
        divisionOverride
    };
}

function normalizePlazaMembershipType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy') return 'academy';
    if (raw === 'federation') return 'federation';
    if (raw === 'direct_strategic' || raw === 'direct strategic' || raw === 'strategic') return 'direct_strategic';
    if (raw === 'not_yet' || raw === 'not yet') return 'not_yet';

    return '';
}

function normalizePlazaYesNo(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'yes') return 'yes';
    if (raw === 'no') return 'no';

    return '';
}

function getPlazaMembershipDivisionLabel(membershipType = '') {
    if (membershipType === 'academy') return 'The Academy';
    if (membershipType === 'federation') return 'The Federation';
    if (membershipType === 'direct_strategic') return 'Direct Strategic Applicant';
    return 'Young Hustlers';
}

function buildPlazaApplicationTags(application = {}) {
    const tags = [];

    [
        application.membershipType,
        application.country,
        application.wantsPatron === 'yes' ? 'patron-track' : 'member-track',
        application.wantsMarketplace === 'yes' ? 'marketplace' : '',
        application.currentProject,
        application.resourcesNeeded
    ].forEach((value) => {
        const clean = sanitizeText(value).toLowerCase();
        if (clean && !tags.includes(clean)) tags.push(clean);
    });

    return tags.slice(0, 16);
}

app.post(['/api/plaza/application', '/api/plaza/applications'], requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(userId);
        const snap = await userRef.get();
        const user = snap.exists ? (snap.data() || {}) : {};
        const existingSnapshot = await getPlazaAccessSnapshotForUser(userId, req.user);

        if (existingSnapshot.canEnterPlaza === true) {
            return res.json({
                success: true,
                ...existingSnapshot
            });
        }

        const existingApplication =
            user.plazaApplication && typeof user.plazaApplication === 'object'
                ? user.plazaApplication
                : null;

        const existingStatus = normalizePlazaAccessStatus(
            user.plazaApplicationStatus ||
            user.plazaMembershipStatus ||
            existingApplication?.status ||
            ''
        );

        if (existingApplication && existingStatus && existingStatus !== 'rejected') {
            return res.json({
                success: true,
                hasApplication: true,
                canEnterPlaza: false,
                applicationStatus: existingStatus,
                application: existingApplication,
                member: null
            });
        }

        const body = req.body || {};
        const membershipType = normalizePlazaMembershipType(body.membershipType);

        if (membershipType === 'not_yet') {
            return res.status(403).json({
                success: false,
                message: 'There is nothing to check here yet, come back when you are already a member.'
            });
        }

        if (
            membershipType !== 'academy' &&
            membershipType !== 'federation' &&
            membershipType !== 'direct_strategic'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Select whether you are in The Academy, The Federation, or applying as a direct strategic applicant.'
            });
        }

        const applicationTrack = resolveServerDivisionApplicationTrack({
            incomingTrack: body.applicationTrack,
            membershipType,
            user
        });

        const plazaGate = await buildServerDivisionGatePayloadForUser({
            userId,
            division: 'plaza',
            track: applicationTrack
        });

        if (rejectIfAcademyProgressionLocked(res, plazaGate.academyUnlockRequirement)) {
            return;
        }

        const academySignalSnapshot = plazaGate.academySignalSnapshot;
        const academyUnlockRequirement = plazaGate.academyUnlockRequirement;

        const wantsPatron = normalizePlazaYesNo(body.wantsPatron);
        const wantsMarketplace = normalizePlazaYesNo(body.wantsMarketplace);

        const directStrategicProfileSource =
            body.directStrategicProfile && typeof body.directStrategicProfile === 'object'
                ? body.directStrategicProfile
                : {};

        const applicationData = {
            schemaVersion: normalizePlazaApplicationShort(body.schemaVersion || 'plaza-typeform-clone-v1'),
            membershipType,
            membershipDivisionLabel: getPlazaMembershipDivisionLabel(membershipType),

            applicationTrack,
            directStrategicApplicant: applicationTrack === 'direct_strategic',
            academySignalSnapshot,
            academyUnlockRequirement,

            email: normalizePlazaApplicationShort(body.email || user.email || req.user?.email || '', 180).toLowerCase(),
            fullName: normalizePlazaApplicationShort(body.fullName || user.fullName || user.name || user.displayName || req.user?.name || '', 160),
            age: Number.parseInt(body.age, 10),

            currentProject: normalizePlazaApplicationLong(body.currentProject),
            resourcesNeeded: normalizePlazaApplicationLong(body.resourcesNeeded),

            joinedAt: normalizePlazaApplicationShort(body.joinedAt, 160),
            learntSoFar: normalizePlazaApplicationLong(body.learntSoFar),
            contribution: normalizePlazaApplicationLong(body.contribution),

            directStrategicProfile: {
                strategicRole: normalizePlazaApplicationLong(directStrategicProfileSource.strategicRole, 1200),
                strategicProof: normalizePlazaApplicationLong(directStrategicProfileSource.strategicProof, 1800),
                audienceOrNetwork: normalizePlazaApplicationLong(directStrategicProfileSource.audienceOrNetwork, 1800),
                capitalOrAccess: normalizePlazaApplicationLong(directStrategicProfileSource.capitalOrAccess, 1800),
                highValueReason: normalizePlazaApplicationLong(directStrategicProfileSource.highValueReason, 1800)
            },

            wantsPatron,
            patronExpectation: wantsPatron === 'yes'
                ? normalizePlazaApplicationLong(body.patronExpectation)
                : '',
            leadershipExperience: wantsPatron === 'yes'
                ? normalizePlazaApplicationLong(body.leadershipExperience)
                : '',

            country: normalizePlazaApplicationShort(body.country, 160),

            wantsMarketplace,
            servicesProducts: wantsMarketplace === 'yes'
                ? normalizePlazaApplicationLong(body.servicesProducts)
                : '',

            referredBy: normalizePlazaApplicationShort(body.referredBy, 220),
            howHeard: normalizePlazaApplicationLong(body.howHeard, 900)
        };

        const missingFields = [];

        if (!applicationData.email) missingFields.push('Drop your best e-mail');
        if (!applicationData.fullName) missingFields.push('Name & Surname');
        if (!Number.isFinite(applicationData.age) || applicationData.age < 13 || applicationData.age > 120) missingFields.push('Valid age');
        if (!applicationData.currentProject) missingFields.push('Current project');
        if (!applicationData.resourcesNeeded) missingFields.push('Resources needed');
        if (!applicationData.joinedAt) missingFields.push(`When you joined ${applicationData.membershipDivisionLabel}`);
        if (!applicationData.learntSoFar) missingFields.push(`What you have learnt so far in ${applicationData.membershipDivisionLabel}`);
        if (!applicationData.contribution) {
            missingFields.push(
                membershipType === 'direct_strategic'
                    ? 'What high-value contribution you can bring into Plaza'
                    : `What you can contribute as a ${membershipType === 'academy' ? 'Academy' : 'Federation'} member`
            );
        }

        if (membershipType === 'direct_strategic') {
            if (!applicationData.directStrategicProfile.strategicRole) {
                missingFields.push('Strategic role / status');
            }

            if (!applicationData.directStrategicProfile.strategicProof) {
                missingFields.push('Strategic proof');
            }

            if (!applicationData.directStrategicProfile.audienceOrNetwork) {
                missingFields.push('Audience, network, or access');
            }

            if (!applicationData.directStrategicProfile.capitalOrAccess) {
                missingFields.push('Capital, deal flow, hiring power, or useful access');
            }

            if (!applicationData.directStrategicProfile.highValueReason) {
                missingFields.push('Why admin should treat this as high-value');
            }
        }

        if (!applicationData.wantsPatron) missingFields.push('Patrón / Leader answer');
        if (!applicationData.country) missingFields.push('Country of Residence');
        if (!applicationData.wantsMarketplace) missingFields.push('Marketplace answer');

        if (applicationData.wantsPatron === 'yes') {
            if (!applicationData.patronExpectation) missingFields.push('Patrón expectation');
            if (!applicationData.leadershipExperience) missingFields.push('Leadership/building experience');
        }

        if (applicationData.wantsMarketplace === 'yes' && !applicationData.servicesProducts) {
            missingFields.push('Services/products provided');
        }

        if (!applicationData.referredBy && !applicationData.howHeard) {
            missingFields.push('Who referred you or how you heard from us');
        }

        if (missingFields.length) {
            return res.status(400).json({
                success: false,
                message: `Please complete: ${missingFields.join(', ')}.`
            });
        }

        const nowIso = new Date().toISOString();

        const application = {
            id: existingApplication?.id || `plaza_${userId}_${Date.now()}`,
            applicationType: 'plaza-access',
            schemaVersion: applicationData.schemaVersion,
            division: 'Plaza',
            divisions: ['Plaza'],
            recommendedDivision: 'Plaza',
            source: 'Internal Plaza application form',
            status: 'Under Review',

            ...applicationData,

            answers: {
                membership: {
                    question: 'Are you a member of Young Hustlers?',
                    answer: membershipType
                },
                email: {
                    question: 'Drop your best e-mail',
                    answer: applicationData.email
                },
                identity: {
                    nameQuestion: 'Name & Surname',
                    fullName: applicationData.fullName,
                    ageQuestion: 'Age',
                    age: applicationData.age
                },
                project: {
                    question: 'What is one project you are currently building or planning?',
                    answer: applicationData.currentProject
                },
                resources: {
                    question: 'What resources do you need most right now? (knowledge, income, network, mentorship, etc.)',
                    answer: applicationData.resourcesNeeded
                },
                joined: {
                    question: `When did you join ${applicationData.membershipDivisionLabel} approximately?`,
                    answer: applicationData.joinedAt
                },
                learning: {
                    question: `What have you learnt so far in ${applicationData.membershipDivisionLabel}?`,
                    answer: applicationData.learntSoFar
                },
                contribution: {
                    question: membershipType === 'direct_strategic'
                        ? 'What high-value contribution can you bring into Plaza?'
                        : `What can you contribute as a ${membershipType === 'academy' ? 'Academy' : 'Federation'} member?`,
                    answer: applicationData.contribution
                },
                directStrategicProfile: {
                    question: 'Direct strategic applicant proof',
                    strategicRole: applicationData.directStrategicProfile.strategicRole || '',
                    strategicProof: applicationData.directStrategicProfile.strategicProof || '',
                    audienceOrNetwork: applicationData.directStrategicProfile.audienceOrNetwork || '',
                    capitalOrAccess: applicationData.directStrategicProfile.capitalOrAccess || '',
                    highValueReason: applicationData.directStrategicProfile.highValueReason || ''
                },
                patronTrack: {
                    question: 'Are you planning to become a Patrón or a Leader of the Plaza?',
                    answer: applicationData.wantsPatron,
                    expectation: applicationData.patronExpectation,
                    leadershipExperience: applicationData.leadershipExperience
                },
                country: {
                    question: 'Country of Residence',
                    answer: applicationData.country
                },
                marketplace: {
                    question: 'Do you want to promote your services or products inside our marketplace?',
                    answer: applicationData.wantsMarketplace,
                    servicesProducts: applicationData.servicesProducts
                },
                referral: {
                    referredByQuestion: 'Who referred you?',
                    referredBy: applicationData.referredBy,
                    howHeardQuestion: 'In case no one referred you, how did you hear from us?',
                    howHeard: applicationData.howHeard
                }
            },

            tags: buildPlazaApplicationTags(applicationData),
            createdAt: existingApplication?.createdAt || nowIso,
            updatedAt: nowIso,
            submittedAt: nowIso,
            reviewedAt: '',
            reviewedBy: '',
            notes: [
                'Submitted through the internal dynamic Plaza application form.',
                'Questions mirror the Plaza Typeform logic.',
                'Admin approval is required before Plaza access unlocks.'
            ]
        };

        await userRef.set({
            plazaApplication: application,
            plazaApplicationStatus: 'Under Review',
            plazaMembershipStatus: 'under review',
            plazaAccessStatus: 'under review',
            plazaApplicationTags: application.tags,
            hasPlazaAccess: false,
            updatedAt: nowIso
        }, { merge: true });

        return res.status(201).json({
            success: true,
            hasApplication: true,
            canEnterPlaza: false,
            applicationStatus: 'Under Review',
            application,
            member: null
        });
    } catch (error) {
        console.error('submit plaza application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Plaza application.'
        });
    }
});

app.post('/api/plaza/applications', requireApiUser, async (req, res, next) => {
    req.url = '/api/plaza/application';
    next();
});

function parseAdminEmailList(value = '') {
    return String(value || '')
        .split(',')
        .map((item) => sanitizeText(item).toLowerCase())
        .filter(Boolean);
}

async function isPlazaAdminReviewer(req) {
    const requestEmail = sanitizeText(req.user?.email).toLowerCase();
    const requestUserId = sanitizeText(req.user?.id || req.user?.firebaseUid);

    const allowedEmails = new Set([
        ...parseAdminEmailList(process.env.YH_ADMIN_EMAILS),
        ...parseAdminEmailList(process.env.ADMIN_EMAILS),
        ...parseAdminEmailList(process.env.PLAZA_ADMIN_EMAILS)
    ]);

    if (requestEmail && allowedEmails.has(requestEmail)) return true;

    if (!requestUserId) return false;

    try {
        const userSnap = await firestore.collection('users').doc(requestUserId).get();
        if (!userSnap.exists) return false;

        const user = userSnap.data() || {};
        const role = sanitizeText(user.role || user.accountRole || user.userRole).toLowerCase();
        const accountType = sanitizeText(user.accountType || user.type).toLowerCase();

        const permissions = Array.isArray(user.permissions)
            ? user.permissions.map((item) => sanitizeText(item).toLowerCase())
            : [];

        const adminRoles = Array.isArray(user.adminRoles)
            ? user.adminRoles.map((item) => sanitizeText(item).toLowerCase())
            : [];

        return (
            user.isAdmin === true ||
            user.admin === true ||
            role === 'admin' ||
            role === 'superadmin' ||
            accountType === 'admin' ||
            permissions.includes('admin') ||
            permissions.includes('plaza_admin') ||
            permissions.includes('plaza:review') ||
            adminRoles.includes('plaza') ||
            adminRoles.includes('plaza_admin') ||
            adminRoles.includes('superadmin')
        );
    } catch (error) {
        console.error('isPlazaAdminReviewer error:', error);
        return false;
    }
}

async function requirePlazaAdminReviewer(req, res, next) {
    const allowed = await isPlazaAdminReviewer(req);

    if (!allowed) {
        return res.status(403).json({
            success: false,
            message: 'Admin access is required to review Plaza applications.'
        });
    }

    next();
}

function normalizePlazaAdminReviewAction(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'approve' || raw === 'approved') return 'approved';
    if (raw === 'reject' || raw === 'rejected' || raw === 'denied') return 'rejected';
    if (raw === 'screening' || raw === 'in screening') return 'screening';
    if (raw === 'shortlist' || raw === 'shortlisted') return 'shortlisted';
    if (raw === 'waitlist' || raw === 'waitlisted') return 'waitlisted';
    if (raw === 'pending' || raw === 'review' || raw === 'under review' || raw === 'pending review') return 'under review';

    return '';
}

function getPlazaAdminStatusLabel(status = '') {
    const normalized = normalizePlazaAccessStatus(status);

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'screening') return 'Screening';
    if (normalized === 'shortlisted') return 'Shortlisted';
    if (normalized === 'waitlisted') return 'Waitlisted';

    return 'Under Review';
}

function mapPlazaAdminApplicationUserDoc(docSnap) {
    const user = docSnap.data() || {};
    const application =
        user.plazaApplication && typeof user.plazaApplication === 'object'
            ? user.plazaApplication
            : null;

    if (!application) return null;

    const status = normalizePlazaAccessStatus(
        user.plazaApplicationStatus ||
        user.plazaAccessStatus ||
        user.plazaMembershipStatus ||
        application.status ||
        'under review'
    );

    return {
        id: sanitizeText(application.id || `plaza_${docSnap.id}`),
        userId: docSnap.id,
        fullName: sanitizeText(application.fullName || application.name || user.fullName || user.name || 'Plaza Applicant'),
        email: sanitizeText(application.email || user.email || '').toLowerCase(),
        membershipType: sanitizeText(application.membershipType),
        country: sanitizeText(application.country || user.country),
        wantsPatron: sanitizeText(application.wantsPatron),
        wantsMarketplace: sanitizeText(application.wantsMarketplace),
        status: getPlazaAdminStatusLabel(status),
        normalizedStatus: status || 'under review',
        canEnterPlaza: user.hasPlazaAccess === true || status === 'approved',
        tags: Array.isArray(application.tags) ? application.tags : [],
        submittedAt: application.submittedAt || application.createdAt || null,
        updatedAt: application.updatedAt || user.updatedAt || null,
        reviewedAt: application.reviewedAt || '',
        reviewedBy: application.reviewedBy || '',
        application
    };
}

app.get('/api/admin/plaza/applications', requireApiUser, requirePlazaAdminReviewer, async (req, res) => {
    try {
        const usersSnap = await firestore.collection('users').limit(1000).get();
        const applications = [];

        usersSnap.forEach((docSnap) => {
            const mapped = mapPlazaAdminApplicationUserDoc(docSnap);
            if (mapped) applications.push(mapped);
        });

        applications.sort((a, b) => {
            return String(b.submittedAt || b.updatedAt || '').localeCompare(String(a.submittedAt || a.updatedAt || ''));
        });

        return res.json({
            success: true,
            applications,
            stats: {
                total: applications.length,
                pending: applications.filter((item) =>
                    ['under review', 'screening', 'shortlisted', 'waitlisted'].includes(item.normalizedStatus)
                ).length,
                approved: applications.filter((item) => item.normalizedStatus === 'approved').length,
                rejected: applications.filter((item) => item.normalizedStatus === 'rejected').length
            }
        });
    } catch (error) {
        console.error('admin plaza applications list error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza applications.'
        });
    }
});

app.patch('/api/admin/plaza/applications/:id/status', requireApiUser, requirePlazaAdminReviewer, async (req, res) => {
    try {
        const applicationId = sanitizeText(req.params.id);
        const requestedStatus = normalizePlazaAdminReviewAction(req.body?.status || req.body?.action);

        if (!applicationId) {
            return res.status(400).json({
                success: false,
                message: 'Missing Plaza application id.'
            });
        }

        if (!requestedStatus) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Plaza review status.'
            });
        }

        let targetRef = firestore.collection('users').doc(applicationId);
        let targetSnap = await targetRef.get();

        if (!targetSnap.exists || !(targetSnap.data() || {}).plazaApplication) {
            const usersSnap = await firestore.collection('users').limit(1000).get();

            targetRef = null;
            targetSnap = null;

            usersSnap.forEach((docSnap) => {
                if (targetRef) return;

                const user = docSnap.data() || {};
                const application =
                    user.plazaApplication && typeof user.plazaApplication === 'object'
                        ? user.plazaApplication
                        : null;

                if (sanitizeText(application?.id) === applicationId) {
                    targetRef = docSnap.ref;
                    targetSnap = docSnap;
                }
            });
        }

        if (!targetRef || !targetSnap?.exists) {
            return res.status(404).json({
                success: false,
                message: 'Plaza application not found.'
            });
        }

        const user = targetSnap.data() || {};
        const existingApplication =
            user.plazaApplication && typeof user.plazaApplication === 'object'
                ? user.plazaApplication
                : {};

        const nextLabel = getPlazaAdminStatusLabel(requestedStatus);
        const approved = requestedStatus === 'approved';
        const nowIso = new Date().toISOString();

        const reviewNote = sanitizeText(req.body?.note || req.body?.reviewNote).slice(0, 800);
        const previousNotes = Array.isArray(existingApplication.notes)
            ? existingApplication.notes
            : [];

        const updatedApplication = {
            ...existingApplication,
            id: sanitizeText(existingApplication.id || applicationId),
            status: nextLabel,
            reviewedAt: nowIso,
            reviewedBy: sanitizeText(req.user?.email || req.user?.id || 'admin'),
            updatedAt: nowIso,
            notes: [
                ...previousNotes,
                reviewNote || `Admin updated Plaza application status to ${nextLabel}.`
            ]
        };

        const updatePayload = {
            plazaApplication: updatedApplication,
            plazaApplicationStatus: nextLabel,
            plazaMembershipStatus: requestedStatus,
            plazaAccessStatus: requestedStatus,
            hasPlazaAccess: approved,
            updatedAt: nowIso
        };

        if (approved) {
            updatePayload.plazaApprovedAt = nowIso;
            updatePayload.plazaRejectedAt = '';
        }

        if (requestedStatus === 'rejected') {
            updatePayload.plazaRejectedAt = nowIso;
        }

        await targetRef.set(updatePayload, { merge: true });

        const freshSnap = await targetRef.get();
        const freshUser = freshSnap.exists ? (freshSnap.data() || {}) : {};
        const mapped = mapPlazaAdminApplicationUserDoc(freshSnap);

        let plazaReviewText = `Your Plaza application is now ${nextLabel}.`;

        if (requestedStatus === 'approved') {
            plazaReviewText = 'Your Plaza application has been approved. Plaza access is now unlocked.';
        } else if (requestedStatus === 'rejected') {
            plazaReviewText = 'Your Plaza application was not approved. You can review your information and submit a stronger application again.';
        } else if (requestedStatus === 'waitlisted') {
            plazaReviewText = 'Your Plaza application has been waitlisted. Strengthen your signal and try again in the next review cycle.';
        } else if (requestedStatus === 'shortlisted') {
            plazaReviewText = 'Your Plaza application has been shortlisted. You are close to final review, but access is not unlocked yet.';
        } else if (requestedStatus === 'screening') {
            plazaReviewText = 'Your Plaza application is now in screening. Admin is reviewing your fit before final access decision.';
        } else if (requestedStatus === 'under review') {
            plazaReviewText = 'Your Plaza application is under review. Admin approval is still required before entry.';
        }

        await appendUserInProductNotification(
            targetRef,
            freshUser,
            buildInProductReviewNotification({
                title: `Plaza Application ${nextLabel}`,
                text: plazaReviewText,
                target: 'plaza-status',
                targetId: sanitizeText(existingApplication.id || applicationId),
                applicationField: 'plazaApplication',
                applicationStatus: nextLabel,
                color: approved ? 'var(--success)' : requestedStatus === 'rejected' ? 'var(--danger)' : 'var(--neon-blue)',
                avatarStr: 'P'
            })
        );

        return res.json({
            success: true,
            application: mapped,
            hasApplication: true,
            canEnterPlaza: approved,
            applicationStatus: nextLabel,
            member: approved
                ? buildPlazaMemberSnapshot(freshSnap.id, freshUser, req.user)
                : null
        });
    } catch (error) {
        console.error('admin plaza application status update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Plaza application status.'
        });
    }
});

app.post('/api/plaza/application-intent', requireApiUser, async (req, res) => {
    return res.status(410).json({
        success: false,
        message: 'The old Typeform intent flow has been replaced. Please submit the internal Plaza application form.'
    });
});

app.use('/api/plaza', requireApiUser, requirePlazaApiAccess);
app.use('/api', apiRoutes);
app.post('/api/realtime/live-rooms/:roomId/join', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.joinLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('join live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to join live room.'
        });
    }
});

app.post('/api/realtime/live-rooms/:roomId/leave', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.leaveLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('leave live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to leave live room.'
        });
    }
});

app.post('/api/realtime/live-rooms/:roomId/end', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.endLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        const signalingRoom = getAcademyVoiceSignalingRoom(req.params.roomId);

        io.to(signalingRoom).emit('academyVoice:roomEnded', {
            roomId: sanitizeText(req.params.roomId)
        });

        if (typeof io.in(signalingRoom).socketsLeave === 'function') {
            io.in(signalingRoom).socketsLeave(signalingRoom);
        }

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('end live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to end live room.'
        });
    }
});
startAiNurtureWorker();

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 YH Server is running! Open http://localhost:${PORT} in your browser.`);
});