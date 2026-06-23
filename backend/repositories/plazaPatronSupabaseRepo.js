const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_plaza_records';

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return sanitizeText(value, fallback).toLowerCase();
}

function safeArray(value = []) {
    return Array.isArray(value) ? value : [];
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

    return sanitizeText(value);
}

function nowIso() {
    return new Date().toISOString();
}

function buildId(prefix = 'plaza') {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(5).toString('hex');
}

function normalizeStatus(value = '', fallback = 'active') {
    const clean = cleanLower(value || fallback);
    return clean || fallback;
}

function isReadableStatus(value = '') {
    const status = normalizeStatus(value || 'active');

    return ![
        'deleted',
        'archived',
        'hidden',
        'blocked',
        'removed'
    ].includes(status);
}

function normalizeTags(value = []) {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return Array.from(
        new Set(
            raw
                .map((item) => sanitizeText(item).toLowerCase())
                .filter(Boolean)
                .map((item) => item.slice(0, 48))
        )
    ).slice(0, 24);
}

function baseUser(input = {}) {
    return {
        userId: sanitizeText(input.userId || input.firebaseUid || input.uid || input.authorId || input.createdByUid || ''),
        firebaseUid: sanitizeText(input.firebaseUid || input.uid || input.userId || input.authorId || input.createdByUid || ''),
        email: sanitizeText(input.email || input.authorEmail || input.createdByEmail || '').toLowerCase(),
        name: sanitizeText(input.name || input.fullName || input.displayName || input.authorName || input.createdByName || 'YH Member')
    };
}

function normalizeApplication(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_patron_application'));
    const user = baseUser(input);

    const title = sanitizeText(
        input.title ||
        input.subject ||
        `Patron application: ${user.name || user.email || id}`
    );

    const body = sanitizeText(
        input.body ||
        input.reason ||
        input.motivation ||
        input.description ||
        input.message ||
        ''
    );

    return {
        ...input,
        id,
        ...user,
        title,
        body,
        reason: sanitizeText(input.reason || input.motivation || body),
        experience: sanitizeText(input.experience || ''),
        offer: sanitizeText(input.offer || input.valueOffer || ''),
        status: normalizeStatus(input.status || 'pending_review'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'pending_review'),
        reviewedBy: sanitizeText(input.reviewedBy || ''),
        reviewedAt: toIso(input.reviewedAt),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeAnnouncement(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_patron_announcement'));

    const title = sanitizeText(input.title || input.subject || 'Patron announcement');
    const body = sanitizeText(input.body || input.text || input.message || input.description || '');

    return {
        ...input,
        id,
        title,
        body,
        summary: sanitizeText(input.summary || body).slice(0, 600),
        region: sanitizeText(input.region || 'Global') || 'Global',
        category: sanitizeText(input.category || input.type || 'announcement'),
        authorId: sanitizeText(input.authorId || input.createdByUid || ''),
        authorName: sanitizeText(input.authorName || input.createdByName || 'YH Patron'),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeRecommendation(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_patron_recommendation'));

    const title = sanitizeText(input.title || input.subject || 'Federation recommendation');
    const body = sanitizeText(input.body || input.note || input.reason || input.description || input.message || '');

    return {
        ...input,
        id,
        title,
        body,
        summary: sanitizeText(input.summary || body).slice(0, 600),
        requesterId: sanitizeText(input.requesterId || input.userId || input.authorId || input.createdByUid || ''),
        targetUserId: sanitizeText(input.targetUserId || input.recommendedUserId || input.recipientId || ''),
        federationTargetId: sanitizeText(input.federationTargetId || input.federationId || ''),
        patronId: sanitizeText(input.patronId || input.createdByUid || input.authorId || ''),
        patronName: sanitizeText(input.patronName || input.authorName || input.createdByName || 'YH Patron'),
        region: sanitizeText(input.region || 'Global') || 'Global',
        status: normalizeStatus(input.status || 'pending_review'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'pending_review'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeIntroOutcome(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_patron_intro_outcome'));

    const title = sanitizeText(input.title || input.subject || 'Patron intro outcome');
    const body = sanitizeText(input.body || input.outcome || input.note || input.description || '');

    return {
        ...input,
        id,
        title,
        body,
        outcome: sanitizeText(input.outcome || body),
        recommendationId: sanitizeText(input.recommendationId || input.introId || ''),
        requesterId: sanitizeText(input.requesterId || input.userId || ''),
        targetUserId: sanitizeText(input.targetUserId || input.recipientId || ''),
        patronId: sanitizeText(input.patronId || input.authorId || input.createdByUid || ''),
        patronName: sanitizeText(input.patronName || input.authorName || input.createdByName || 'YH Patron'),
        status: normalizeStatus(input.status || 'recorded'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizePayout(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_patron_payout'));

    const amount = Number.isFinite(Number(input.amount || input.total || input.value))
        ? Number(input.amount || input.total || input.value)
        : 0;

    return {
        ...input,
        id,
        patronId: sanitizeText(input.patronId || input.userId || input.authorId || input.createdByUid || ''),
        patronName: sanitizeText(input.patronName || input.authorName || input.createdByName || 'YH Patron'),
        patronEmail: sanitizeText(input.patronEmail || input.email || input.authorEmail || '').toLowerCase(),
        amount,
        currency: sanitizeText(input.currency || 'USD').toUpperCase() || 'USD',
        title: sanitizeText(input.title || `Patron payout ${amount}`),
        note: sanitizeText(input.note || input.description || ''),
        status: normalizeStatus(input.status || 'pending'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'pending'),
        paidAt: toIso(input.paidAt),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildApplicationRow(input = {}) {
    const data = normalizeApplication(input);

    return {
        record_type: 'patron_application',
        source_collection_path: 'plazaPatronApplications',
        source_document_id: data.id,
        source_document_path: 'plazaPatronApplications/' + data.id,
        owner_user_id: sanitizeText(data.userId || data.firebaseUid),
        status: normalizeStatus(data.status || 'pending_review'),
        review_status: normalizeStatus(data.reviewStatus || data.status || 'pending_review'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.reason || data.body).slice(0, 600),
        body: sanitizeText(data.body || data.reason),
        region: '',
        category: 'patron_application',
        tags: normalizeTags(['plaza', 'patron', 'application', data.status]),
        public_meta: {
            name: sanitizeText(data.name),
            status: sanitizeText(data.status),
            reviewedAt: sanitizeText(data.reviewedAt)
        },
        private_meta: {
            email: sanitizeText(data.email),
            firebaseUid: sanitizeText(data.firebaseUid),
            reviewedBy: sanitizeText(data.reviewedBy)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildAnnouncementRow(input = {}) {
    const data = normalizeAnnouncement(input);

    return {
        record_type: 'patron_announcement',
        source_collection_path: 'plazaPatronAnnouncements',
        source_document_id: data.id,
        source_document_path: 'plazaPatronAnnouncements/' + data.id,
        owner_user_id: sanitizeText(data.authorId),
        status: normalizeStatus(data.status || 'active'),
        review_status: normalizeStatus(data.reviewStatus || data.status || 'active'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.summary || data.body).slice(0, 600),
        body: sanitizeText(data.body),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.category || 'announcement'),
        tags: normalizeTags(['plaza', 'patron', 'announcement', data.region, data.category]),
        public_meta: {
            authorName: sanitizeText(data.authorName)
        },
        private_meta: {
            authorEmail: sanitizeText(data.authorEmail)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildRecommendationRow(input = {}) {
    const data = normalizeRecommendation(input);

    return {
        record_type: 'patron_recommendation',
        source_collection_path: 'plazaPatronFederationRecommendations',
        source_document_id: data.id,
        source_document_path: 'plazaPatronFederationRecommendations/' + data.id,
        owner_user_id: sanitizeText(data.patronId || data.requesterId),
        target_user_id: sanitizeText(data.targetUserId),
        status: normalizeStatus(data.status || 'pending_review'),
        review_status: normalizeStatus(data.reviewStatus || data.status || 'pending_review'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.summary || data.body).slice(0, 600),
        body: sanitizeText(data.body),
        region: sanitizeText(data.region || 'Global'),
        category: 'patron_recommendation',
        tags: normalizeTags(['plaza', 'patron', 'recommendation', data.region, data.status]),
        public_meta: {
            patronName: sanitizeText(data.patronName),
            federationTargetId: sanitizeText(data.federationTargetId)
        },
        private_meta: {
            requesterId: sanitizeText(data.requesterId),
            targetUserId: sanitizeText(data.targetUserId),
            patronId: sanitizeText(data.patronId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildIntroOutcomeRow(input = {}) {
    const data = normalizeIntroOutcome(input);

    return {
        record_type: 'patron_intro_outcome',
        source_collection_path: 'plazaPatronIntroOutcomes',
        source_document_id: data.id,
        source_document_path: 'plazaPatronIntroOutcomes/' + data.id,
        owner_user_id: sanitizeText(data.patronId || data.requesterId),
        target_user_id: sanitizeText(data.targetUserId),
        status: normalizeStatus(data.status || 'recorded'),
        review_status: normalizeStatus(data.reviewStatus || data.status || 'active'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.outcome || data.body).slice(0, 600),
        body: sanitizeText(data.body || data.outcome),
        region: '',
        category: 'patron_intro_outcome',
        tags: normalizeTags(['plaza', 'patron', 'intro-outcome', data.status]),
        public_meta: {
            patronName: sanitizeText(data.patronName),
            recommendationId: sanitizeText(data.recommendationId)
        },
        private_meta: {
            requesterId: sanitizeText(data.requesterId),
            targetUserId: sanitizeText(data.targetUserId),
            patronId: sanitizeText(data.patronId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildPayoutRow(input = {}) {
    const data = normalizePayout(input);

    return {
        record_type: 'patron_payout',
        source_collection_path: 'plazaPatronPayouts',
        source_document_id: data.id,
        source_document_path: 'plazaPatronPayouts/' + data.id,
        owner_user_id: sanitizeText(data.patronId),
        status: normalizeStatus(data.status || 'pending'),
        review_status: normalizeStatus(data.reviewStatus || data.status || 'pending'),
        title: sanitizeText(data.title),
        summary: sanitizeText(`${data.currency} ${data.amount}`).slice(0, 600),
        body: sanitizeText(data.note),
        region: '',
        category: 'patron_payout',
        tags: normalizeTags(['plaza', 'patron', 'payout', data.currency, data.status]),
        public_meta: {
            patronName: sanitizeText(data.patronName),
            amount: data.amount,
            currency: sanitizeText(data.currency),
            paidAt: sanitizeText(data.paidAt)
        },
        private_meta: {
            patronEmail: sanitizeText(data.patronEmail),
            patronId: sanitizeText(data.patronId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

async function getExisting(recordType = '', sourceDocumentId = '') {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', sanitizeText(recordType))
        .eq('source_document_id', sanitizeText(sourceDocumentId))
        .maybeSingle();

    if (error) throw new Error('Plaza patron lookup failed: ' + error.message);
    return data || null;
}

async function upsertRecord(row = {}) {
    const existing = await getExisting(row.record_type, row.source_document_id).catch(() => null);

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .update(row)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw new Error('Plaza patron update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza patron insert failed: ' + error.message);
    return data;
}

function mapRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        recordType: sanitizeText(row.record_type || data.recordType),
        title: sanitizeText(data.title || row.title || ''),
        body: sanitizeText(data.body || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        userId: sanitizeText(data.userId || row.owner_user_id || ''),
        firebaseUid: sanitizeText(data.firebaseUid || row.private_meta?.firebaseUid || ''),
        email: sanitizeText(data.email || row.private_meta?.email || '').toLowerCase(),
        name: sanitizeText(data.name || row.public_meta?.name || ''),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorName: sanitizeText(data.authorName || row.public_meta?.authorName || ''),
        requesterId: sanitizeText(data.requesterId || row.private_meta?.requesterId || ''),
        targetUserId: sanitizeText(data.targetUserId || row.target_user_id || row.private_meta?.targetUserId || ''),
        patronId: sanitizeText(data.patronId || row.owner_user_id || row.private_meta?.patronId || ''),
        amount: Number.isFinite(Number(data.amount || row.public_meta?.amount)) ? Number(data.amount || row.public_meta?.amount) : 0,
        currency: sanitizeText(data.currency || row.public_meta?.currency || ''),
        raw: data,
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importApplication(id = '', payload = {}) {
    return mapRow(await upsertRecord(buildApplicationRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    })));
}

async function importAnnouncement(id = '', payload = {}) {
    return mapRow(await upsertRecord(buildAnnouncementRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    })));
}

async function importRecommendation(id = '', payload = {}) {
    return mapRow(await upsertRecord(buildRecommendationRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    })));
}

async function importIntroOutcome(id = '', payload = {}) {
    return mapRow(await upsertRecord(buildIntroOutcomeRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    })));
}

async function importPayout(id = '', payload = {}) {
    return mapRow(await upsertRecord(buildPayoutRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    })));
}

async function createApplication(payload = {}) {
    return importApplication(payload.id || buildId('plaza_patron_application'), payload);
}

async function createAnnouncement(payload = {}) {
    return importAnnouncement(payload.id || buildId('plaza_patron_announcement'), payload);
}

async function createRecommendation(payload = {}) {
    return importRecommendation(payload.id || buildId('plaza_patron_recommendation'), payload);
}

async function createIntroOutcome(payload = {}) {
    return importIntroOutcome(payload.id || buildId('plaza_patron_intro_outcome'), payload);
}

async function createPayout(payload = {}) {
    return importPayout(payload.id || buildId('plaza_patron_payout'), payload);
}

async function listByType(recordType = '', limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 250));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', sanitizeText(recordType))
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error(`Plaza patron list failed for ${recordType}: ${error.message}`);

    return (Array.isArray(data) ? data : [])
        .map(mapRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function listApplications(limit = 100) {
    return listByType('patron_application', limit);
}

async function listAnnouncements(limit = 100) {
    return listByType('patron_announcement', limit);
}

async function listRecommendations(limit = 100) {
    return listByType('patron_recommendation', limit);
}

async function listIntroOutcomes(limit = 100) {
    return listByType('patron_intro_outcome', limit);
}

async function listPayouts(limit = 100) {
    return listByType('patron_payout', limit);
}

async function getApplicationForUser(viewer = {}) {
    const keys = new Set([
        viewer.id,
        viewer.firebaseUid,
        viewer.email
    ].map(sanitizeText).filter(Boolean));

    const applications = await listApplications(250);

    return applications.find((application) => {
        return [
            application.userId,
            application.firebaseUid,
            application.email
        ].map(sanitizeText).some((value) => keys.has(value));
    }) || null;
}

async function updateApplicationStatus(id = '', status = '', extra = {}) {
    const existing = await getExisting('patron_application', id);

    if (!existing) {
        throw new Error('Patron application not found.');
    }

    const current = existing.data && typeof existing.data === 'object' ? existing.data : {};

    return importApplication(id, {
        ...current,
        ...extra,
        id,
        status: sanitizeText(status || current.status || 'pending_review'),
        reviewStatus: sanitizeText(status || current.reviewStatus || 'pending_review'),
        updatedAt: nowIso()
    });
}

async function deleteRecord(recordType = '', id = '') {
    const cleanType = sanitizeText(recordType);
    const cleanId = sanitizeText(id);

    if (!cleanType || !cleanId) return;

    const { error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('record_type', cleanType)
        .eq('source_document_id', cleanId);

    if (error) throw new Error('Plaza patron delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    importApplication,
    importAnnouncement,
    importRecommendation,
    importIntroOutcome,
    importPayout,
    createApplication,
    createAnnouncement,
    createRecommendation,
    createIntroOutcome,
    createPayout,
    listApplications,
    listAnnouncements,
    listRecommendations,
    listIntroOutcomes,
    listPayouts,
    getApplicationForUser,
    updateApplicationStatus,
    deleteRecord
};
