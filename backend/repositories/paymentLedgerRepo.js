const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const paymentLedgerCol = firestore.collection('yhPaymentLedger');
const payoutLedgerCol = firestore.collection('yhPayoutLedger');

function nowTs() {
    return Timestamp.now();
}

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return cleanText(value, fallback).toLowerCase();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toIso(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return cleanText(value);
}

function normalizeCurrency(value = 'USD') {
    return cleanText(value || 'USD').toUpperCase().slice(0, 12) || 'USD';
}

function normalizeLedgerIdPart(value = '') {
    return cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 90);
}

function buildPaymentRecordId(sourceDivision = '', sourceFeature = '', sourceRecordId = '') {
    const division = normalizeLedgerIdPart(sourceDivision || 'unknown');
    const feature = normalizeLedgerIdPart(sourceFeature || 'general');
    const record = normalizeLedgerIdPart(sourceRecordId || `${Date.now()}`);

    return `pay_${division}_${feature}_${record}`.slice(0, 240);
}

function buildPayoutRecordId(receiverUid = '', sourceRecordId = '') {
    const receiver = normalizeLedgerIdPart(receiverUid || 'receiver');
    const record = normalizeLedgerIdPart(sourceRecordId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    return `payout_${receiver}_${record}`.slice(0, 240);
}

function normalizePaymentProvider(value = 'unselected') {
    const raw = cleanLower(value || 'unselected');

    if (raw === 'stripe') return 'stripe';
    if (raw === 'oxapay') return 'oxapay';
    if (raw === 'manual') return 'manual';

    return 'unselected';
}

function normalizePaymentStatus(value = 'draft') {
    const raw = cleanLower(value || 'draft');

    if (raw === 'draft') return 'draft';
    if (raw === 'checkout_started') return 'checkout_started';
    if (raw === 'pending') return 'pending';
    if (raw === 'paid') return 'paid';
    if (raw === 'failed') return 'failed';
    if (raw === 'expired') return 'expired';
    if (raw === 'refunded') return 'refunded';
    if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';

    return 'draft';
}

function normalizePayoutMethod(value = 'local_bank') {
    const raw = cleanLower(value || 'local_bank');

    if (raw === 'local_bank') return 'local_bank';
    if (raw === 'bank' || raw === 'bank_transfer') return 'local_bank';
    if (raw === 'card' || raw === 'credit_card' || raw === 'debit_card') return 'card';
    if (raw === 'crypto' || raw === 'cryptocurrency') return 'crypto';
    if (raw === 'manual') return 'manual';

    return 'local_bank';
}

function normalizePayoutStatus(value = 'pending_review') {
    const raw = cleanLower(value || 'pending_review');

    if (raw === 'pending_review') return 'pending_review';
    if (raw === 'approved') return 'approved';
    if (raw === 'processing') return 'processing';
    if (raw === 'paid') return 'paid';
    if (raw === 'rejected') return 'rejected';
    if (raw === 'failed') return 'failed';

    return 'pending_review';
}

function maskMiddle(value = '', visibleStart = 4, visibleEnd = 4) {
    const clean = cleanText(value);

    if (!clean) return '';
    if (clean.length <= visibleStart + visibleEnd + 2) {
        return `${clean.slice(0, 2)}***`;
    }

    return `${clean.slice(0, visibleStart)}***${clean.slice(-visibleEnd)}`;
}

function mapPaymentRecordDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,

        sourceDivision: cleanText(data.sourceDivision),
        sourceFeature: cleanText(data.sourceFeature),
        sourceRecordId: cleanText(data.sourceRecordId),

        payerUid: cleanText(data.payerUid),
        payerEmail: cleanText(data.payerEmail).toLowerCase(),
        payerName: cleanText(data.payerName),

        provider: normalizePaymentProvider(data.provider),
        providerOptions: Array.isArray(data.providerOptions) ? data.providerOptions : ['stripe', 'oxapay'],
        providerPaymentId: cleanText(data.providerPaymentId),
        providerCheckoutUrl: cleanText(data.providerCheckoutUrl),
        providerStatus: cleanText(data.providerStatus),

        amount: toNumber(data.amount, 0),
        currency: normalizeCurrency(data.currency),

        cryptoAmount: toNumber(data.cryptoAmount, 0),
        cryptoCurrency: cleanText(data.cryptoCurrency).toUpperCase(),
        cryptoNetwork: cleanText(data.cryptoNetwork),

        status: normalizePaymentStatus(data.status),
        paymentMethod: cleanText(data.paymentMethod || 'unselected'),

        platformCommissionAmount: toNumber(data.platformCommissionAmount, 0),
        operatorPayoutAmount: toNumber(data.operatorPayoutAmount, 0),

        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},

        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        paidAt: toIso(data.paidAt),
        expiresAt: toIso(data.expiresAt)
    };
}

function mapPayoutRecordDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,

        receiverUid: cleanText(data.receiverUid),
        receiverEmail: cleanText(data.receiverEmail).toLowerCase(),
        receiverName: cleanText(data.receiverName),

        sourceDivision: cleanText(data.sourceDivision || 'academy'),
        sourceFeature: cleanText(data.sourceFeature || ''),
        sourcePaymentId: cleanText(data.sourcePaymentId),
        sourceRecordId: cleanText(data.sourceRecordId),

        method: normalizePayoutMethod(data.method),
        provider: normalizePaymentProvider(data.provider || 'manual'),

        amount: toNumber(data.amount, 0),
        currency: normalizeCurrency(data.currency),

        bankCountry: cleanText(data.bankCountry),
        bankName: cleanText(data.bankName),
        accountName: cleanText(data.accountName),
        accountNumberMasked: cleanText(data.accountNumberMasked),

        cardLast4: cleanText(data.cardLast4).slice(-4),

        cryptoCurrency: cleanText(data.cryptoCurrency).toUpperCase(),
        cryptoNetwork: cleanText(data.cryptoNetwork),
        walletAddressMasked: cleanText(data.walletAddressMasked),

        status: normalizePayoutStatus(data.status),
        adminNote: cleanText(data.adminNote),

        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},

        createdAt: toIso(data.createdAt),
        approvedAt: toIso(data.approvedAt),
        processingAt: toIso(data.processingAt),
        paidAt: toIso(data.paidAt),
        rejectedAt: toIso(data.rejectedAt),
        failedAt: toIso(data.failedAt),
        updatedAt: toIso(data.updatedAt)
    };
}

async function upsertPaymentRecord(input = {}) {
    const sourceDivision = cleanLower(input.sourceDivision || 'unknown');
    const sourceFeature = cleanLower(input.sourceFeature || 'general');
    const sourceRecordId = cleanText(input.sourceRecordId || input.id || '');

    const id = cleanText(input.id) || buildPaymentRecordId(sourceDivision, sourceFeature, sourceRecordId);
    const ref = paymentLedgerCol.doc(id);
    const snap = await ref.get();
    const now = nowTs();

    const payload = {
        sourceDivision,
        sourceFeature,
        sourceRecordId,

        payerUid: cleanText(input.payerUid),
        payerEmail: cleanText(input.payerEmail).toLowerCase(),
        payerName: cleanText(input.payerName),

        provider: normalizePaymentProvider(input.provider || 'unselected'),
        providerOptions: Array.isArray(input.providerOptions) && input.providerOptions.length
            ? input.providerOptions.map(normalizePaymentProvider).filter((item) => item !== 'unselected')
            : ['stripe', 'oxapay'],
        providerPaymentId: cleanText(input.providerPaymentId),
        providerCheckoutUrl: cleanText(input.providerCheckoutUrl),
        providerStatus: cleanText(input.providerStatus),

        amount: Math.max(0, toNumber(input.amount, 0)),
        currency: normalizeCurrency(input.currency),

        cryptoAmount: Math.max(0, toNumber(input.cryptoAmount, 0)),
        cryptoCurrency: cleanText(input.cryptoCurrency).toUpperCase(),
        cryptoNetwork: cleanText(input.cryptoNetwork),

        status: normalizePaymentStatus(input.status || 'draft'),
        paymentMethod: cleanText(input.paymentMethod || 'unselected'),

        platformCommissionAmount: Math.max(0, toNumber(input.platformCommissionAmount, 0)),
        operatorPayoutAmount: Math.max(0, toNumber(input.operatorPayoutAmount, 0)),

        metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},

        ...(snap.exists ? {} : { createdAt: now }),
        updatedAt: now,
        ...(normalizePaymentStatus(input.status) === 'paid' ? { paidAt: now } : {})
    };

    await ref.set(payload, { merge: true });

    const nextSnap = await ref.get();
    return mapPaymentRecordDoc(nextSnap);
}

async function listPaymentsForUser(uid = '', limit = 80) {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return [];

    const snap = await paymentLedgerCol
        .where('payerUid', '==', cleanUid)
        .limit(Math.max(1, Math.min(200, Number(limit) || 80)))
        .get();

    return snap.docs
        .map(mapPaymentRecordDoc)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function listAdminPaymentRecords(limit = 300) {
    const snap = await paymentLedgerCol
        .limit(Math.max(1, Math.min(500, Number(limit) || 300)))
        .get();

    return snap.docs
        .map(mapPaymentRecordDoc)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function createPayoutRequest(input = {}) {
    const receiverUid = cleanText(input.receiverUid);
    const sourceRecordId = cleanText(input.sourceRecordId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const id = cleanText(input.id) || buildPayoutRecordId(receiverUid, sourceRecordId);
    const ref = payoutLedgerCol.doc(id);
    const snap = await ref.get();
    const now = nowTs();

    const method = normalizePayoutMethod(input.method);
    const rawAccountNumber = cleanText(input.accountNumber);
    const rawWalletAddress = cleanText(input.walletAddress);

    const payload = {
        receiverUid,
        receiverEmail: cleanText(input.receiverEmail).toLowerCase(),
        receiverName: cleanText(input.receiverName),

        sourceDivision: cleanLower(input.sourceDivision || 'academy'),
        sourceFeature: cleanLower(input.sourceFeature || 'member_withdrawal'),
        sourcePaymentId: cleanText(input.sourcePaymentId),
        sourceRecordId,

        method,
        provider: normalizePaymentProvider(input.provider || (method === 'crypto' ? 'oxapay' : 'manual')),

        amount: Math.max(0, toNumber(input.amount, 0)),
        currency: normalizeCurrency(input.currency),

        bankCountry: cleanText(input.bankCountry).slice(0, 120),
        bankName: cleanText(input.bankName).slice(0, 160),
        accountName: cleanText(input.accountName).slice(0, 180),
        accountNumberMasked: rawAccountNumber ? maskMiddle(rawAccountNumber, 2, 3) : cleanText(input.accountNumberMasked),

        cardLast4: cleanText(input.cardLast4 || input.cardNumber).slice(-4),

        cryptoCurrency: cleanText(input.cryptoCurrency).toUpperCase().slice(0, 20),
        cryptoNetwork: cleanText(input.cryptoNetwork).slice(0, 80),
        walletAddressMasked: rawWalletAddress ? maskMiddle(rawWalletAddress, 6, 6) : cleanText(input.walletAddressMasked),

        status: normalizePayoutStatus(input.status || 'pending_review'),
        adminNote: cleanText(input.adminNote),

        metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},

        ...(snap.exists ? {} : { createdAt: now }),
        updatedAt: now
    };

    await ref.set(payload, { merge: true });

    const nextSnap = await ref.get();
    return mapPayoutRecordDoc(nextSnap);
}

async function listPayoutsForUser(uid = '', limit = 80) {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return [];

    const snap = await payoutLedgerCol
        .where('receiverUid', '==', cleanUid)
        .limit(Math.max(1, Math.min(200, Number(limit) || 80)))
        .get();

    return snap.docs
        .map(mapPayoutRecordDoc)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function listAdminPayoutRecords(limit = 300) {
    const snap = await payoutLedgerCol
        .limit(Math.max(1, Math.min(500, Number(limit) || 300)))
        .get();

    return snap.docs
        .map(mapPayoutRecordDoc)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function updatePayoutRecordStatus(payoutId = '', input = {}) {
    const cleanId = cleanText(payoutId);

    if (!cleanId) {
        throw new Error('Missing payout id.');
    }

    const ref = payoutLedgerCol.doc(cleanId);
    const snap = await ref.get();

    if (!snap.exists) {
        const error = new Error('Payout request not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = snap.data() || {};
    const status = normalizePayoutStatus(input.status || current.status || 'pending_review');
    const now = nowTs();

    const payload = {
        status,
        adminNote: cleanText(input.adminNote || current.adminNote || ''),
        updatedAt: now
    };

    if (status === 'approved') {
        payload.approvedAt = current.approvedAt || now;
    }

    if (status === 'processing') {
        payload.processingAt = current.processingAt || now;
    }

    if (status === 'paid') {
        payload.paidAt = current.paidAt || now;
    }

    if (status === 'rejected') {
        payload.rejectedAt = current.rejectedAt || now;
    }

    if (status === 'failed') {
        payload.failedAt = current.failedAt || now;
    }

    await ref.set(payload, { merge: true });

    const nextSnap = await ref.get();
    return mapPayoutRecordDoc(nextSnap);
}

module.exports = {
    upsertPaymentRecord,
    listPaymentsForUser,
    listAdminPaymentRecords,
    createPayoutRequest,
    listPayoutsForUser,
    listAdminPayoutRecords,
    updatePayoutRecordStatus,
    mapPaymentRecordDoc,
    mapPayoutRecordDoc
};