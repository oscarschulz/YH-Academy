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

function normalizeBridge(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || input.slug || buildId('plaza_bridge'));

    const title = sanitizeText(
        input.title ||
        input.name ||
        input.label ||
        'Plaza bridge'
    );

    const description = sanitizeText(
        input.description ||
        input.summary ||
        input.body ||
        input.text ||
        ''
    );

    return {
        ...input,
        id,
        title,
        name: sanitizeText(input.name || title),
        slug: sanitizeText(input.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')),
        description,
        summary: sanitizeText(input.summary || description).slice(0, 600),
        origin: sanitizeText(input.origin || input.from || input.source || ''),
        destination: sanitizeText(input.destination || input.to || input.target || ''),
        region: sanitizeText(input.region || 'Global') || 'Global',
        category: sanitizeText(input.category || input.type || 'bridge'),
        tags: normalizeTags([...(safeArray(input.tags)), input.region, input.category, input.type]),
        authorId: sanitizeText(input.authorId || input.createdByUid || input.ownerUid || ''),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || input.createdByName || 'YH Member'),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeRequest(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_request'));

    const title = sanitizeText(
        input.title ||
        input.subject ||
        input.name ||
        'Plaza request'
    );

    const description = sanitizeText(
        input.description ||
        input.summary ||
        input.body ||
        input.text ||
        input.message ||
        ''
    );

    return {
        ...input,
        id,
        title,
        subject: sanitizeText(input.subject || title),
        description,
        summary: sanitizeText(input.summary || description).slice(0, 600),
        requestType: sanitizeText(input.requestType || input.type || 'general'),
        priority: sanitizeText(input.priority || 'normal'),
        region: sanitizeText(input.region || 'Global') || 'Global',
        category: sanitizeText(input.category || input.requestType || input.type || 'request'),
        tags: normalizeTags([...(safeArray(input.tags)), input.region, input.category, input.requestType, input.priority]),
        authorId: sanitizeText(input.authorId || input.createdByUid || input.ownerUid || ''),
        authorFirebaseUid: sanitizeText(input.authorFirebaseUid || input.firebaseUid || ''),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || input.createdByName || 'YH Member'),
        assignedTo: sanitizeText(input.assignedTo || input.assigneeId || ''),
        targetUserId: sanitizeText(input.targetUserId || input.recipientId || ''),
        status: normalizeStatus(input.status || 'open'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildBridgeRow(input = {}) {
    const data = normalizeBridge(input);

    return {
        record_type: 'bridge_path',
        source_collection_path: 'plazaBridgePaths',
        source_document_id: data.id,
        source_document_path: 'plazaBridgePaths/' + data.id,
        owner_user_id: sanitizeText(data.authorId),
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.summary || data.description).slice(0, 600),
        body: sanitizeText(data.description),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.category || 'bridge'),
        tags: normalizeTags(['plaza', 'bridge', data.region, data.category, ...(safeArray(data.tags))]),
        public_meta: {
            name: sanitizeText(data.name),
            slug: sanitizeText(data.slug),
            origin: sanitizeText(data.origin),
            destination: sanitizeText(data.destination),
            category: sanitizeText(data.category)
        },
        private_meta: {
            authorEmail: sanitizeText(data.authorEmail)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildRequestRow(input = {}) {
    const data = normalizeRequest(input);

    return {
        record_type: 'request',
        source_collection_path: 'plazaRequests',
        source_document_id: data.id,
        source_document_path: 'plazaRequests/' + data.id,
        owner_user_id: sanitizeText(data.authorId || data.authorFirebaseUid),
        target_user_id: sanitizeText(data.targetUserId || data.assignedTo),
        status: normalizeStatus(data.status || 'open'),
        review_status: normalizeStatus(data.reviewStatus || 'active'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.summary || data.description).slice(0, 600),
        body: sanitizeText(data.description),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.category || data.requestType || 'request'),
        tags: normalizeTags(['plaza', 'request', data.region, data.category, data.requestType, data.priority, ...(safeArray(data.tags))]),
        public_meta: {
            subject: sanitizeText(data.subject),
            requestType: sanitizeText(data.requestType),
            priority: sanitizeText(data.priority),
            authorName: sanitizeText(data.authorName)
        },
        private_meta: {
            authorEmail: sanitizeText(data.authorEmail),
            authorFirebaseUid: sanitizeText(data.authorFirebaseUid),
            assignedTo: sanitizeText(data.assignedTo),
            targetUserId: sanitizeText(data.targetUserId)
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

    if (error) throw new Error('Plaza bridge/request lookup failed: ' + error.message);
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

        if (error) throw new Error('Plaza bridge/request update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza bridge/request insert failed: ' + error.message);
    return data;
}

function mapBridgeRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        title: sanitizeText(data.title || row.title || 'Plaza bridge'),
        name: sanitizeText(data.name || row.public_meta?.name || data.title || row.title || 'Plaza bridge'),
        slug: sanitizeText(data.slug || row.public_meta?.slug || ''),
        description: sanitizeText(data.description || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),
        origin: sanitizeText(data.origin || row.public_meta?.origin || ''),
        destination: sanitizeText(data.destination || row.public_meta?.destination || ''),
        region: sanitizeText(data.region || row.region || 'Global'),
        category: sanitizeText(data.category || row.category || 'bridge'),
        tags: safeArray(data.tags || row.tags),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorEmail: sanitizeText(data.authorEmail || row.private_meta?.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || 'YH Member'),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function mapRequestRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        title: sanitizeText(data.title || row.title || 'Plaza request'),
        subject: sanitizeText(data.subject || row.public_meta?.subject || data.title || row.title || ''),
        description: sanitizeText(data.description || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),
        requestType: sanitizeText(data.requestType || row.public_meta?.requestType || row.category || 'general'),
        priority: sanitizeText(data.priority || row.public_meta?.priority || 'normal'),
        region: sanitizeText(data.region || row.region || 'Global'),
        category: sanitizeText(data.category || row.category || 'request'),
        tags: safeArray(data.tags || row.tags),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorFirebaseUid: sanitizeText(data.authorFirebaseUid || row.private_meta?.authorFirebaseUid || ''),
        authorEmail: sanitizeText(data.authorEmail || row.private_meta?.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || row.public_meta?.authorName || 'YH Member'),
        assignedTo: sanitizeText(data.assignedTo || row.private_meta?.assignedTo || ''),
        targetUserId: sanitizeText(data.targetUserId || row.private_meta?.targetUserId || row.target_user_id || ''),
        status: normalizeStatus(data.status || row.status || 'open'),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || 'active'),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importBridge(id = '', payload = {}) {
    const row = buildBridgeRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapBridgeRow(await upsertRecord(row));
}

async function importRequest(id = '', payload = {}) {
    const row = buildRequestRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapRequestRow(await upsertRecord(row));
}

async function createBridge(payload = {}) {
    return importBridge(payload.id || payload.slug || buildId('plaza_bridge'), payload);
}

async function createRequest(payload = {}) {
    return importRequest(payload.id || buildId('plaza_request'), payload);
}

async function listBridge(limit = 80) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 80), 160));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'bridge_path')
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza bridge list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapBridgeRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function listRequests(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'request')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza requests list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapRequestRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function getRequestById(id = '') {
    const cleanId = sanitizeText(id);

    if (!cleanId) return null;

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'request')
        .eq('source_document_id', cleanId)
        .maybeSingle();

    if (error) throw new Error('Plaza request get failed: ' + error.message);

    return data ? mapRequestRow(data) : null;
}

async function updateRequest(id = '', patch = {}) {
    const existing = await getExisting('request', id);

    if (!existing) {
        throw new Error('Plaza request not found.');
    }

    const current = existing.data && typeof existing.data === 'object' ? existing.data : {};
    const nextData = {
        ...current,
        ...patch,
        id: sanitizeText(id),
        updatedAt: nowIso()
    };

    return importRequest(id, nextData);
}

async function advanceRequestStatus(id = '', status = '') {
    return updateRequest(id, {
        status: sanitizeText(status || 'open')
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

    if (error) throw new Error('Plaza bridge/request delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    buildBridgeRow,
    buildRequestRow,
    importBridge,
    importRequest,
    createBridge,
    createRequest,
    listBridge,
    listRequests,
    getRequestById,
    updateRequest,
    advanceRequestStatus,
    deleteRecord,
    mapBridgeRow,
    mapRequestRow
};
