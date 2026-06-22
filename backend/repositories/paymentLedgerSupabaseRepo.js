const { firestore } = require('../../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_payment_ledger_records';

const usersCol = firestore.collection('users');
const universeReferralLedgerCol = firestore.collection('universeReferralLedger');

function nowIso() {
    return new Date().toISOString();
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

function roundMoney(value = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
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
    const record = normalizeLedgerIdPart(sourceRecordId || String(Date.now()));
    return ('pay_' + division + '_' + feature + '_' + record).slice(0, 240);
}

function buildPayoutRecordId(receiverUid = '', sourceRecordId = '') {
    const receiver = normalizeLedgerIdPart(receiverUid || 'receiver');
    const record = normalizeLedgerIdPart(
        sourceRecordId || String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8)
    );

    return ('payout_' + receiver + '_' + record).slice(0, 240);
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
        return clean.slice(0, 2) + '***';
    }

    return clean.slice(0, visibleStart) + '***' + clean.slice(-visibleEnd);
}

function toIso(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    return cleanText(value);
}

function rowData(row = {}) {
    return row && row.data && typeof row.data === 'object' ? row.data : {};
}

function collectionPathForRecordType(recordType = '') {
    if (recordType === 'payout') return 'yhPayoutLedger';
    if (recordType === 'universe_referral_commission') return 'universeReferralCommissionLedger';
    return 'yhPaymentLedger';
}

function sourceDocumentPathFor(recordType = '', id = '') {
    return collectionPathForRecordType(recordType) + '/' + cleanText(id);
}

function mapPaymentDataFromInput(input = {}, existing = {}) {
    const now = nowIso();

    return {
        ...existing,

        id: cleanText(input.id || existing.id),
        sourceDivision: cleanText(input.sourceDivision ?? existing.sourceDivision),
        sourceFeature: cleanText(input.sourceFeature ?? existing.sourceFeature),
        sourceRecordId: cleanText(input.sourceRecordId ?? existing.sourceRecordId),

        payerUid: cleanText(input.payerUid ?? existing.payerUid),
        payerEmail: cleanText(input.payerEmail ?? existing.payerEmail).toLowerCase(),
        payerName: cleanText(input.payerName ?? existing.payerName),

        provider: normalizePaymentProvider(input.provider ?? existing.provider ?? 'unselected'),
        providerOptions: Array.isArray(input.providerOptions)
            ? input.providerOptions.map(normalizePaymentProvider).filter((item) => item !== 'unselected')
            : Array.isArray(existing.providerOptions)
                ? existing.providerOptions
                : ['stripe', 'oxapay', 'manual'],
        providerPaymentId: cleanText(input.providerPaymentId ?? existing.providerPaymentId),
        providerCheckoutUrl: cleanText(input.providerCheckoutUrl ?? existing.providerCheckoutUrl),
        providerStatus: cleanText(input.providerStatus ?? existing.providerStatus),

        amount: toNumber(input.amount ?? existing.amount, 0),
        currency: normalizeCurrency(input.currency ?? existing.currency ?? 'USD'),

        cryptoAmount: toNumber(input.cryptoAmount ?? existing.cryptoAmount, 0),
        cryptoCurrency: cleanText(input.cryptoCurrency ?? existing.cryptoCurrency).toUpperCase(),
        cryptoNetwork: cleanText(input.cryptoNetwork ?? existing.cryptoNetwork),

        status: normalizePaymentStatus(input.status ?? existing.status ?? 'draft'),
        paymentMethod: cleanText(input.paymentMethod ?? existing.paymentMethod ?? 'unselected'),

        platformCommissionAmount: toNumber(input.platformCommissionAmount ?? existing.platformCommissionAmount, 0),
        operatorPayoutAmount: toNumber(input.operatorPayoutAmount ?? existing.operatorPayoutAmount, 0),

        metadata: {
            ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
            ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})
        },

        createdAt: toIso(existing.createdAt) || toIso(input.createdAt) || now,
        updatedAt: now,

        paidAt: input.paidAt !== undefined
            ? toIso(input.paidAt)
            : normalizePaymentStatus(input.status ?? existing.status) === 'paid'
                ? (toIso(existing.paidAt) || now)
                : toIso(existing.paidAt),

        expiresAt: toIso(input.expiresAt ?? existing.expiresAt)
    };
}

function mapPayoutDataFromInput(input = {}, existing = {}) {
    const now = nowIso();

    const rawAccountNumber = cleanText(input.accountNumber);
    const rawWalletAddress = cleanText(input.walletAddress);

    return {
        ...existing,

        id: cleanText(input.id || existing.id),

        receiverUid: cleanText(input.receiverUid ?? existing.receiverUid),
        receiverEmail: cleanText(input.receiverEmail ?? existing.receiverEmail).toLowerCase(),
        receiverName: cleanText(input.receiverName ?? existing.receiverName),

        sourceDivision: cleanText(input.sourceDivision ?? existing.sourceDivision ?? 'academy'),
        sourceFeature: cleanText(input.sourceFeature ?? existing.sourceFeature),
        sourcePaymentId: cleanText(input.sourcePaymentId ?? existing.sourcePaymentId),
        sourceRecordId: cleanText(input.sourceRecordId ?? existing.sourceRecordId),

        method: normalizePayoutMethod(input.method ?? existing.method),
        provider: normalizePaymentProvider(input.provider ?? existing.provider ?? 'manual'),
        providerPaymentId: cleanText(
            input.providerPaymentId ??
            input.transferReference ??
            input.adminDisbursementReference ??
            existing.providerPaymentId
        ),
        providerStatus: cleanText(input.providerStatus ?? input.disbursementStatus ?? existing.providerStatus),

        amount: toNumber(input.amount ?? existing.amount, 0),
        currency: normalizeCurrency(input.currency ?? existing.currency ?? 'USD'),

        bankCountry: cleanText(input.bankCountry ?? existing.bankCountry),
        bankName: cleanText(input.bankName ?? existing.bankName),
        accountName: cleanText(input.accountName ?? existing.accountName),
        accountNumberMasked: rawAccountNumber
            ? maskMiddle(rawAccountNumber, 2, 3)
            : cleanText(input.accountNumberMasked ?? existing.accountNumberMasked),

        cardLast4: cleanText(input.cardLast4 || input.cardNumber || existing.cardLast4).slice(-4),

        cryptoCurrency: cleanText(input.cryptoCurrency ?? existing.cryptoCurrency).toUpperCase().slice(0, 20),
        cryptoNetwork: cleanText(input.cryptoNetwork ?? existing.cryptoNetwork).slice(0, 80),
        walletAddressMasked: rawWalletAddress
            ? maskMiddle(rawWalletAddress, 6, 6)
            : cleanText(input.walletAddressMasked ?? existing.walletAddressMasked),

        status: normalizePayoutStatus(input.status ?? existing.status ?? 'pending_review'),
        adminNote: cleanText(input.adminNote ?? existing.adminNote),

        metadata: {
            ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
            ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})
        },

        createdAt: toIso(existing.createdAt) || toIso(input.createdAt) || now,
        approvedAt: toIso(existing.approvedAt),
        processingAt: toIso(existing.processingAt),
        paidAt: toIso(existing.paidAt),
        rejectedAt: toIso(existing.rejectedAt),
        failedAt: toIso(existing.failedAt),
        updatedAt: now
    };
}

function mapPaymentRecordFromData(data = {}, fallbackId = '') {
    return {
        id: cleanText(data.id || fallbackId),

        sourceDivision: cleanText(data.sourceDivision),
        sourceFeature: cleanText(data.sourceFeature),
        sourceRecordId: cleanText(data.sourceRecordId),

        payerUid: cleanText(data.payerUid),
        payerEmail: cleanText(data.payerEmail).toLowerCase(),
        payerName: cleanText(data.payerName),

        provider: normalizePaymentProvider(data.provider),
        providerOptions: Array.isArray(data.providerOptions)
            ? data.providerOptions.map(normalizePaymentProvider).filter((item) => item !== 'unselected')
            : ['stripe', 'oxapay', 'manual'],
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

function mapPayoutRecordFromData(data = {}, fallbackId = '') {
    return {
        id: cleanText(data.id || fallbackId),

        receiverUid: cleanText(data.receiverUid),
        receiverEmail: cleanText(data.receiverEmail).toLowerCase(),
        receiverName: cleanText(data.receiverName),

        sourceDivision: cleanText(data.sourceDivision || 'academy'),
        sourceFeature: cleanText(data.sourceFeature || ''),
        sourcePaymentId: cleanText(data.sourcePaymentId),
        sourceRecordId: cleanText(data.sourceRecordId),

        method: normalizePayoutMethod(data.method),
        provider: normalizePaymentProvider(data.provider || 'manual'),
        providerPaymentId: cleanText(data.providerPaymentId),
        providerStatus: cleanText(data.providerStatus),

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

function mapCommissionRecordFromData(data = {}, fallbackId = '') {
    return {
        id: cleanText(data.id || fallbackId),
        type: 'universe_referral_commission',

        referrerUid: cleanText(data.referrerUid),
        referrerEmail: cleanText(data.referrerEmail).toLowerCase(),
        referrerName: cleanText(data.referrerName),
        referrerUsername: cleanText(data.referrerUsername),

        referredUid: cleanText(data.referredUid),
        referredEmail: cleanText(data.referredEmail).toLowerCase(),
        referredName: cleanText(data.referredName),
        referredUsername: cleanText(data.referredUsername),

        referralCode: cleanText(data.referralCode),
        referralLedgerId: cleanText(data.referralLedgerId),

        sourceDivision: cleanText(data.sourceDivision),
        sourceFeature: cleanText(data.sourceFeature),
        sourceRecordId: cleanText(data.sourceRecordId),
        sourcePaymentId: cleanText(data.sourcePaymentId),

        provider: normalizePaymentProvider(data.provider),
        providerPaymentId: cleanText(data.providerPaymentId),

        paymentAmount: toNumber(data.paymentAmount, 0),
        grossAmount: toNumber(data.grossAmount, 0),
        commissionRatePercent: toNumber(data.commissionRatePercent, 0),
        commissionRate: toNumber(data.commissionRate, 0),
        commissionAmount: toNumber(data.commissionAmount || data.amount, 0),
        amount: toNumber(data.amount || data.commissionAmount, 0),
        currency: normalizeCurrency(data.currency),

        status: cleanText(data.status || 'available'),
        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},

        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt)
    };
}

function mapPaymentRecordRow(row = {}) {
    return mapPaymentRecordFromData(rowData(row), row.source_document_id);
}

function mapPayoutRecordRow(row = {}) {
    return mapPayoutRecordFromData(rowData(row), row.source_document_id);
}

function mapPaymentRecordDoc(docSnap) {
    return mapPaymentRecordFromData(docSnap.data() || {}, docSnap.id);
}

function mapPayoutRecordDoc(docSnap) {
    return mapPayoutRecordFromData(docSnap.data() || {}, docSnap.id);
}

async function getRow(recordType = '', id = '') {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .eq('source_document_id', cleanText(id))
        .maybeSingle();

    if (error) throw new Error('Payment ledger Supabase get failed: ' + error.message);
    return data || null;
}

async function listRows(recordType = '', limit = 300) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 300));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Payment ledger Supabase list failed: ' + error.message);
    return Array.isArray(data) ? data : [];
}

async function upsertLedgerRow(recordType = '', id = '', data = {}) {
    const cleanId = cleanText(id);
    const collectionPath = collectionPathForRecordType(recordType);
    const documentPath = sourceDocumentPathFor(recordType, cleanId);
    const now = nowIso();

    const row = {
        firebase_app: 'supabase',
        source_collection_path: collectionPath,
        source_collection_root: collectionPath,
        source_document_id: cleanId,
        source_document_path: documentPath,
        record_type: recordType,

        user_id: cleanText(
            data.payerUid ||
            data.receiverUid ||
            data.referrerUid ||
            data.referredUid ||
            data.userId ||
            ''
        ),

        payer_uid: cleanText(data.payerUid),
        receiver_uid: cleanText(data.receiverUid),
        referrer_uid: cleanText(data.referrerUid),
        referred_uid: cleanText(data.referredUid),

        source_division: cleanLower(data.sourceDivision),
        source_feature: cleanLower(data.sourceFeature),
        source_record_id: cleanText(data.sourceRecordId),
        source_payment_id: cleanText(data.sourcePaymentId),

        provider: normalizePaymentProvider(data.provider),
        provider_payment_id: cleanText(data.providerPaymentId),
        provider_status: cleanText(data.providerStatus),

        status: cleanLower(data.status),
        method: cleanLower(data.method),
        payment_method: cleanText(data.paymentMethod),

        amount: toNumber(data.amount, 0),
        currency: normalizeCurrency(data.currency),

        platform_commission_amount: toNumber(data.platformCommissionAmount, 0),
        operator_payout_amount: toNumber(data.operatorPayoutAmount, 0),
        commission_amount: toNumber(data.commissionAmount || data.amount, 0),

        data,

        created_at_source: toIso(data.createdAt) || now,
        updated_at_source: toIso(data.updatedAt) || now,
        paid_at_source: toIso(data.paidAt) || null,
        updated_at: now
    };

    const { data: saved, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, { onConflict: 'source_document_path' })
        .select('*')
        .single();

    if (error) throw new Error('Payment ledger Supabase upsert failed: ' + error.message);
    return saved;
}

async function upsertPaymentRecord(input = {}) {
    const id = cleanText(input.id) || buildPaymentRecordId(
        input.sourceDivision,
        input.sourceFeature,
        input.sourceRecordId
    );

    const existingRow = await getRow('payment', id).catch(() => null);
    const existingData = rowData(existingRow);

    const data = mapPaymentDataFromInput(
        {
            ...input,
            id
        },
        existingData
    );

    const saved = await upsertLedgerRow('payment', id, data);
    const payment = mapPaymentRecordRow(saved);

    if (payment.status === 'paid') {
        await maybeCreateUniverseReferralCommissionForPayment(payment);
    }

    return payment;
}

async function getPaymentRecordById(paymentId = '') {
    const cleanId = cleanText(paymentId);

    if (!cleanId) {
        throw new Error('Missing payment id.');
    }

    const row = await getRow('payment', cleanId);

    if (!row) {
        const error = new Error('Payment record not found.');
        error.statusCode = 404;
        throw error;
    }

    return mapPaymentRecordRow(row);
}

async function updatePaymentRecordStatus(paymentId = '', input = {}) {
    const cleanId = cleanText(paymentId);

    if (!cleanId) {
        throw new Error('Missing payment id.');
    }

    const row = await getRow('payment', cleanId);

    if (!row) {
        const error = new Error('Payment record not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = rowData(row);
    const nextInput = {
        ...input,
        id: cleanId,
        status: input.status || current.status || 'draft'
    };

    const data = mapPaymentDataFromInput(nextInput, current);

    const saved = await upsertLedgerRow('payment', cleanId, data);
    const payment = mapPaymentRecordRow(saved);

    if (payment.status === 'paid') {
        await maybeCreateUniverseReferralCommissionForPayment(payment);
    }

    return payment;
}

async function listPaymentsForUser(uid = '', limit = 80) {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return [];

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 80));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'payment')
        .eq('payer_uid', cleanUid)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Payment ledger Supabase user list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapPaymentRecordRow)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function listAdminPaymentRecords(limit = 300) {
    const rows = await listRows('payment', limit);

    return rows
        .map(mapPaymentRecordRow)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function createPayoutRequest(input = {}) {
    const id = cleanText(input.id) || buildPayoutRecordId(input.receiverUid, input.sourceRecordId);
    const existingRow = await getRow('payout', id).catch(() => null);
    const existingData = rowData(existingRow);

    const data = mapPayoutDataFromInput(
        {
            ...input,
            id
        },
        existingData
    );

    const saved = await upsertLedgerRow('payout', id, data);
    return mapPayoutRecordRow(saved);
}

async function listPayoutsForUser(uid = '', limit = 80) {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return [];

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 80));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'payout')
        .eq('receiver_uid', cleanUid)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Payment ledger Supabase payout user list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapPayoutRecordRow)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function listAdminPayoutRecords(limit = 300) {
    const rows = await listRows('payout', limit);

    return rows
        .map(mapPayoutRecordRow)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function updatePayoutRecordStatus(payoutId = '', input = {}) {
    const cleanId = cleanText(payoutId);

    if (!cleanId) {
        throw new Error('Missing payout id.');
    }

    const row = await getRow('payout', cleanId);

    if (!row) {
        const error = new Error('Payout request not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = rowData(row);
    const now = nowIso();
    const status = normalizePayoutStatus(input.status || current.status || 'pending_review');

    const patch = {
        ...input,
        id: cleanId,
        status,
        method: input.method ? normalizePayoutMethod(input.method) : normalizePayoutMethod(current.method),
        provider: input.provider ? normalizePaymentProvider(input.provider) : normalizePaymentProvider(current.provider || 'manual'),
        providerPaymentId: cleanText(
            input.providerPaymentId ||
            input.transferReference ||
            input.adminDisbursementReference ||
            current.providerPaymentId ||
            ''
        ),
        providerStatus: cleanText(input.providerStatus || input.disbursementStatus || current.providerStatus || ''),
        adminNote: cleanText(input.adminNote || current.adminNote || ''),
        metadata: {
            ...(current.metadata && typeof current.metadata === 'object' ? current.metadata : {}),
            ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
            adminDisbursementReference: cleanText(
                input.providerPaymentId ||
                input.transferReference ||
                input.adminDisbursementReference ||
                current.providerPaymentId ||
                ''
            ),
            adminDisbursementUpdatedAt: now
        }
    };

    if (status === 'approved') patch.approvedAt = current.approvedAt || now;
    if (status === 'processing') patch.processingAt = current.processingAt || now;
    if (status === 'paid') patch.paidAt = current.paidAt || now;
    if (status === 'rejected') patch.rejectedAt = current.rejectedAt || now;
    if (status === 'failed') patch.failedAt = current.failedAt || now;

    const data = mapPayoutDataFromInput(patch, current);
    data.approvedAt = toIso(patch.approvedAt || current.approvedAt);
    data.processingAt = toIso(patch.processingAt || current.processingAt);
    data.paidAt = toIso(patch.paidAt || current.paidAt);
    data.rejectedAt = toIso(patch.rejectedAt || current.rejectedAt);
    data.failedAt = toIso(patch.failedAt || current.failedAt);

    const saved = await upsertLedgerRow('payout', cleanId, data);
    return mapPayoutRecordRow(saved);
}

function normalizeUniverseReferralCode(value = '') {
    return cleanText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9_-]+/g, '')
        .slice(0, 48);
}

function isInactiveUniverseReferralAccount(userData = {}) {
    const accountStatus = cleanLower(
        userData.accountStatus ||
        userData.userStatus ||
        userData.status ||
        ''
    );

    const referralStatus = cleanLower(
        userData.universeReferral?.status ||
        userData.referralStatus ||
        'active'
    );

    const blockedStatuses = new Set([
        'deleted',
        'deactivated',
        'disabled',
        'suspended',
        'banned',
        'blocked',
        'inactive'
    ]);

    return blockedStatuses.has(accountStatus) || blockedStatuses.has(referralStatus);
}

function buildUniverseReferralCommissionId(paymentId = '') {
    const cleanPaymentId = normalizeLedgerIdPart(paymentId || String(Date.now()));
    return ('universe_ref_comm_' + cleanPaymentId).slice(0, 240);
}

const UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT = Math.max(
    0,
    toNumber(process.env.UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT || 2.81, 2.81)
);
const UNIVERSE_REFERRAL_COMMISSION_RATE = UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT / 100;

async function resolveUniverseReferralAttributionForPayer(payment = {}) {
    const payerUid = cleanText(payment.payerUid);
    const payerEmail = cleanText(payment.payerEmail).toLowerCase();

    if (!payerUid) return null;

    const payerSnap = await usersCol.doc(payerUid).get().catch(() => null);
    const payerData = payerSnap?.exists ? (payerSnap.data() || {}) : {};
    const referredBy = payerData.referredBy && typeof payerData.referredBy === 'object'
        ? payerData.referredBy
        : {};

    let referrerUid = cleanText(referredBy.referrerUid || referredBy.uid || referredBy.id);
    let referralCode = normalizeUniverseReferralCode(referredBy.code || referredBy.referralCode);
    let referralLedgerId = '';

    if (!referrerUid) {
        const fallbackSnap = await universeReferralLedgerCol
            .where('referredUid', '==', payerUid)
            .limit(1)
            .get()
            .catch(() => null);

        const fallbackDoc = fallbackSnap && !fallbackSnap.empty ? fallbackSnap.docs[0] : null;
        const fallbackData = fallbackDoc?.data?.() || {};

        referrerUid = cleanText(fallbackData.referrerUid);
        referralCode = normalizeUniverseReferralCode(fallbackData.referralCode || referralCode);
        referralLedgerId = cleanText(fallbackDoc?.id || '');
    }

    if (!referrerUid || referrerUid === payerUid) return null;

    const referrerSnap = await usersCol.doc(referrerUid).get().catch(() => null);
    if (!referrerSnap?.exists) return null;

    const referrerData = referrerSnap.data() || {};
    const referrerEmail = cleanText(referrerData.email).toLowerCase();

    if (referrerEmail && payerEmail && referrerEmail === payerEmail) return null;
    if (isInactiveUniverseReferralAccount(referrerData)) return null;

    if (!referralLedgerId) {
        referralLedgerId = 'universe_ref_' + referrerUid + '_' + payerUid;
    }

    return {
        referrerUid,
        referrerEmail,
        referrerName: cleanText(
            referrerData.fullName ||
            referrerData.displayName ||
            referrerData.name ||
            referrerData.username ||
            referredBy.referrerName ||
            'YH Member'
        ),
        referrerUsername: cleanText(referrerData.username || referredBy.referrerUsername),
        referredUid: payerUid,
        referredEmail: payerEmail,
        referredName: cleanText(payment.payerName || payerData.fullName || payerData.displayName || payerData.name || payerData.username),
        referredUsername: cleanText(payerData.username),
        referralCode,
        referralLedgerId
    };
}

async function maybeCreateUniverseReferralCommissionForPayment(payment = {}) {
    try {
        const paymentId = cleanText(payment.id);
        const paymentStatus = normalizePaymentStatus(payment.status);
        const paymentAmount = Math.max(0, toNumber(payment.amount, 0));
        const sourceDivision = cleanLower(payment.sourceDivision || 'unknown');
        const sourceFeature = cleanLower(payment.sourceFeature || 'general');

        if (!paymentId || paymentStatus !== 'paid' || paymentAmount <= 0) return null;
        if (sourceDivision === 'wallet' || sourceFeature.includes('withdrawal')) return null;
        if (sourceDivision === 'universe' && sourceFeature === 'referral_commission') return null;

        const commissionId = buildUniverseReferralCommissionId(paymentId);
        const existing = await getRow('universe_referral_commission', commissionId).catch(() => null);

        if (existing) {
            return mapCommissionRecordFromData(rowData(existing), existing.source_document_id);
        }

        const attribution = await resolveUniverseReferralAttributionForPayer(payment);
        if (!attribution?.referrerUid) return null;

        const commissionAmount = roundMoney(paymentAmount * UNIVERSE_REFERRAL_COMMISSION_RATE);
        if (commissionAmount <= 0) return null;

        const now = nowIso();
        const currency = normalizeCurrency(payment.currency || 'USD');

        const commissionPayload = {
            id: commissionId,
            type: 'universe_referral_commission',

            referrerUid: attribution.referrerUid,
            referrerEmail: attribution.referrerEmail,
            referrerName: attribution.referrerName,
            referrerUsername: attribution.referrerUsername,

            referredUid: attribution.referredUid,
            referredEmail: attribution.referredEmail,
            referredName: attribution.referredName,
            referredUsername: attribution.referredUsername,

            referralCode: attribution.referralCode,
            referralLedgerId: attribution.referralLedgerId,

            sourceDivision,
            sourceFeature,
            sourceRecordId: cleanText(payment.sourceRecordId),
            sourcePaymentId: paymentId,

            provider: normalizePaymentProvider(payment.provider),
            providerPaymentId: cleanText(payment.providerPaymentId),

            paymentAmount: roundMoney(paymentAmount),
            grossAmount: roundMoney(paymentAmount),
            commissionRatePercent: roundMoney(UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT),
            commissionRate: UNIVERSE_REFERRAL_COMMISSION_RATE,
            commissionAmount,
            amount: commissionAmount,
            currency,

            status: 'available',
            metadata: {
                paymentLedgerId: paymentId,
                sourceDivision,
                sourceFeature
            },

            createdAt: now,
            updatedAt: now
        };

        const saved = await upsertLedgerRow(
            'universe_referral_commission',
            commissionId,
            commissionPayload
        );

        return mapCommissionRecordFromData(rowData(saved), saved.source_document_id);
    } catch (error) {
        console.error('maybe create universe referral commission error:', error);
        return null;
    }
}

module.exports = {
    upsertPaymentRecord,
    getPaymentRecordById,
    updatePaymentRecordStatus,
    listPaymentsForUser,
    listAdminPaymentRecords,
    createPayoutRequest,
    listPayoutsForUser,
    listAdminPayoutRecords,
    updatePayoutRecordStatus,
    maybeCreateUniverseReferralCommissionForPayment,
    mapPaymentRecordDoc,
    mapPayoutRecordDoc
};
