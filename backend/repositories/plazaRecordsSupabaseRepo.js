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

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

function plazaRecordHttpError(message = '', status = 500) {
    const error = new Error(
        sanitizeText(message) ||
        'Plaza record operation failed.'
    );

    error.status = Number(status) || 500;
    return error;
}

function buildDeterministicRecordId(
    recordType = '',
    ownerUserId = '',
    clientCreateId = ''
) {
    const cleanType = sanitizeText(recordType);
    const cleanOwner = sanitizeText(ownerUserId);
    const cleanClientId = sanitizeText(clientCreateId);

    if (
        !cleanType ||
        !cleanOwner ||
        !cleanClientId
    ) {
        throw plazaRecordHttpError(
            'Record type, owner, and client create id are required.',
            400
        );
    }

    const prefix = cleanType === 'feed_post'
        ? 'plaza_feed'
        : cleanType === 'opportunity'
            ? 'plaza_opp'
            : 'plaza_record';

    const digest = crypto
        .createHash('sha256')
        .update(`${cleanType}:${cleanOwner}:${cleanClientId}`)
        .digest('hex')
        .slice(0, 40);

    return `${prefix}_${digest}`;
}

function normalizeStatus(value = '', fallback = 'active') {
    const clean = cleanLower(value || fallback);
    return clean || fallback;
}

function isReadablePlazaStatus(value = '') {
    const status = normalizeStatus(value || 'active');

    return ![
        'deleted',
        'archived',
        'hidden',
        'blocked',
        'removed'
    ].includes(status);
}

function isPublishedPlazaStatus(value = '') {
    return [
        'active',
        'approved',
        'published',
        'verified'
    ].includes(
        normalizeStatus(
            value || 'active'
        )
    );
}

const PLAZA_PUBLISHED_STATUSES = [
    'active',
    'approved',
    'published',
    'verified'
];

function encodePlazaRecordCursor(
    kind = '',
    timestamp = '',
    id = ''
) {
    return Buffer
        .from(
            JSON.stringify({
                version: 1,
                kind: sanitizeText(kind),
                timestamp: toIso(timestamp),
                id: sanitizeText(id)
            }),
            'utf8'
        )
        .toString('base64url');
}

function normalizePlazaCursorTimestamp(
    value = ''
) {
    const clean = sanitizeText(value);
    const parsed = Date.parse(clean);

    if (
        !clean ||
        !Number.isFinite(parsed)
    ) {
        return '';
    }

    return new Date(parsed).toISOString();
}

function quotePlazaPostgrestFilterValue(
    value = ''
) {
    const clean = sanitizeText(value);

    return `"${clean
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')}"`;
}

function decodePlazaRecordCursor(
    value = '',
    expectedKind = ''
) {
    const clean = sanitizeText(value);

    if (!clean) return null;

    try {
        const parsed = JSON.parse(
            Buffer
                .from(
                    clean,
                    'base64url'
                )
                .toString('utf8')
        );

        const timestamp =
            normalizePlazaCursorTimestamp(
                parsed?.timestamp
            );

        const id = sanitizeText(
            parsed?.id
        );

        if (
            Number(parsed?.version) !== 1 ||
            sanitizeText(parsed?.kind) !==
                sanitizeText(expectedKind) ||
            !timestamp ||
            !id ||
            id.length > 240
        ) {
            throw new Error(
                'Cursor payload is invalid.'
            );
        }

        return {
            timestamp,
            id
        };
    } catch (_) {
        throw plazaRecordHttpError(
            'Invalid Plaza pagination cursor.',
            400
        );
    }
}

function applyDescendingPlazaRecordCursor(
    query,
    column = '',
    cursor = null
) {
    if (!cursor) return query;

    const cleanColumn = sanitizeText(
        column
    );

    const timestamp =
        quotePlazaPostgrestFilterValue(
            cursor.timestamp
        );

    const id =
        quotePlazaPostgrestFilterValue(
            cursor.id
        );

    return query.or(
        `${cleanColumn}.lt.${timestamp},and(${cleanColumn}.eq.${timestamp},source_document_id.lt.${id})`
    );
}

function buildPlazaRecordPage(
    rows = [],
    options = {}
) {
    const safeRows = Array.isArray(rows)
        ? rows
        : [];

    const limit = Math.max(
        1,
        Number(options.limit || 1)
    );

    const pageRows = safeRows.slice(
        0,
        limit
    );

    const hasMore =
        safeRows.length > limit;

    const lastRow =
        pageRows[
            pageRows.length - 1
        ];

    return {
        items: pageRows.map(
            options.mapRow
        ),
        hasMore,
        nextCursor:
            hasMore &&
            lastRow
                ? encodePlazaRecordCursor(
                    options.kind,
                    lastRow[
                        options.column
                    ] ||
                    lastRow.updated_at ||
                    lastRow.created_at,
                    lastRow.source_document_id ||
                    lastRow.id
                )
                : ''
    };
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
    ).slice(0, 20);
}

function normalizeFeedData(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_feed'));

    return {
        ...input,
        id,
        type: sanitizeText(input.type || 'update'),
        member: sanitizeText(input.member || input.authorName || 'YH Member'),
        source: sanitizeText(input.source || 'plaza'),
        division: sanitizeText(input.division || 'both'),
        region: sanitizeText(input.region || 'Global') || 'Global',
        title: sanitizeText(input.title || input.tag || 'Plaza update'),
        text: sanitizeText(input.text || input.body || input.content || ''),
        tag: sanitizeText(input.tag || input.type || 'Update'),
        action: sanitizeText(input.action || 'Open'),
        authorId: sanitizeText(input.authorId || input.createdByUid || input.ownerUid || ''),
        authorFirebaseUid: sanitizeText(input.authorFirebaseUid || input.firebaseUid || ''),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || input.member || input.createdByName || 'YH Member'),
        clientCreateId: sanitizeText(input.clientCreateId || ''),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeOpportunityData(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_opp'));

    return {
        ...input,
        id,
        type: sanitizeText(input.type || 'Opportunity'),
        region: sanitizeText(input.region || 'Global') || 'Global',
        title: sanitizeText(input.title || 'Plaza opportunity'),
        text: sanitizeText(input.text || input.description || input.body || ''),
        action: sanitizeText(input.action || 'Open Opportunity Detail'),

        economyMode: sanitizeText(input.economyMode || input.compensationType || 'not_sure'),
        currency: sanitizeText(input.currency || 'USD').toUpperCase() || 'USD',
        budgetMin: toNumber(input.budgetMin, 0),
        budgetMax: toNumber(input.budgetMax, 0),
        commissionRate: toNumber(input.commissionRate, 0),
        federationEscalation: sanitizeText(input.federationEscalation || 'none'),
        monetizationNote: sanitizeText(input.monetizationNote || ''),

        marketplaceMode: sanitizeText(input.marketplaceMode || ''),
        serviceCategory: sanitizeText(input.serviceCategory || ''),
        serviceTags: safeArray(input.serviceTags).map(sanitizeText).filter(Boolean),
        servicePriceType: sanitizeText(input.servicePriceType || ''),
        serviceDeliveryTime: sanitizeText(input.serviceDeliveryTime || ''),
        serviceProviderType: sanitizeText(input.serviceProviderType || ''),
        serviceRequirements: sanitizeText(input.serviceRequirements || ''),
        serviceOutcome: sanitizeText(input.serviceOutcome || ''),

        sourceDivision: sanitizeText(input.sourceDivision || 'plaza'),

        authorId: sanitizeText(input.authorId || input.createdByUid || input.ownerUid || ''),
        authorFirebaseUid: sanitizeText(input.authorFirebaseUid || input.firebaseUid || ''),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || input.createdByName || 'YH Member'),
        clientCreateId: sanitizeText(input.clientCreateId || ''),

        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildFeedRow(input = {}) {
    const data = normalizeFeedData(input);

    return {
        record_type: 'feed_post',
        source_collection_path: 'plazaFeedPosts',
        source_document_id: data.id,
        source_document_path: 'plazaFeedPosts/' + data.id,
        owner_user_id: sanitizeText(data.authorId || data.authorFirebaseUid),
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.text).slice(0, 600),
        body: sanitizeText(data.text),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.type || data.tag || 'Update'),
        tags: normalizeTags(['plaza', 'feed', data.type, data.region, data.tag]),
        public_meta: {
            type: sanitizeText(data.type),
            tag: sanitizeText(data.tag),
            action: sanitizeText(data.action),
            member: sanitizeText(data.member)
        },
        private_meta: {
            clientCreateId: sanitizeText(data.clientCreateId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildOpportunityRow(input = {}) {
    const data = normalizeOpportunityData(input);

    return {
        record_type: 'opportunity',
        source_collection_path: 'plazaOpportunities',
        source_document_id: data.id,
        source_document_path: 'plazaOpportunities/' + data.id,
        owner_user_id: sanitizeText(data.authorId || data.authorFirebaseUid),
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.text).slice(0, 600),
        body: sanitizeText(data.text),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.type || 'Opportunity'),
        tags: normalizeTags([
            'plaza',
            'opportunity',
            data.type,
            data.region,
            data.economyMode,
            data.federationEscalation
        ]),
        public_meta: {
            type: sanitizeText(data.type),
            action: sanitizeText(data.action),
            economyMode: sanitizeText(data.economyMode),
            currency: sanitizeText(data.currency),
            budgetMin: toNumber(data.budgetMin, 0),
            budgetMax: toNumber(data.budgetMax, 0),
            commissionRate: toNumber(data.commissionRate, 0),
            federationEscalation: sanitizeText(data.federationEscalation),
            marketplaceMode: sanitizeText(data.marketplaceMode)
        },
        private_meta: {
            clientCreateId: sanitizeText(
                data.clientCreateId
            )
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

    if (error) throw new Error('Plaza record lookup failed: ' + error.message);
    return data || null;
}

async function upsertRecord(row = {}) {
    const existing = await getExisting(
        row.record_type,
        row.source_document_id
    );

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .update(row)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw new Error('Plaza record update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza record insert failed: ' + error.message);
    return data;
}

function mapFeedRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        type: sanitizeText(data.type || row.category || 'update'),
        member: sanitizeText(data.member || data.authorName || 'YH Member'),
        source: sanitizeText(data.source || 'plaza'),
        division: sanitizeText(data.division || 'both'),
        region: sanitizeText(data.region || row.region || 'Global'),
        title: sanitizeText(data.title || row.title || 'Plaza update'),
        text: sanitizeText(data.text || row.body || ''),
        tag: sanitizeText(data.tag || row.category || 'Update'),
        action: sanitizeText(data.action || 'Open'),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorFirebaseUid: sanitizeText(data.authorFirebaseUid || ''),
        authorEmail: sanitizeText(data.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || data.member || 'YH Member'),
        clientCreateId: sanitizeText(
            data.clientCreateId ||
            row.private_meta?.clientCreateId ||
            ''
        ),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function mapOpportunityRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        type: sanitizeText(data.type || row.category || 'Opportunity'),
        region: sanitizeText(data.region || row.region || 'Global'),
        title: sanitizeText(data.title || row.title || 'Plaza opportunity'),
        text: sanitizeText(data.text || row.body || ''),
        action: sanitizeText(data.action || 'Open Opportunity Detail'),

        economyMode: sanitizeText(data.economyMode || 'not_sure'),
        currency: sanitizeText(data.currency || 'USD').toUpperCase() || 'USD',
        budgetMin: toNumber(data.budgetMin, 0),
        budgetMax: toNumber(data.budgetMax, 0),
        commissionRate: toNumber(data.commissionRate, 0),
        federationEscalation: sanitizeText(data.federationEscalation || 'none'),
        monetizationNote: sanitizeText(data.monetizationNote || ''),

        marketplaceMode: sanitizeText(data.marketplaceMode || ''),
        serviceCategory: sanitizeText(data.serviceCategory || ''),
        serviceTags: safeArray(data.serviceTags),
        servicePriceType: sanitizeText(data.servicePriceType || ''),
        serviceDeliveryTime: sanitizeText(data.serviceDeliveryTime || ''),
        serviceProviderType: sanitizeText(data.serviceProviderType || ''),
        serviceRequirements: sanitizeText(data.serviceRequirements || ''),
        serviceOutcome: sanitizeText(data.serviceOutcome || ''),

        sourceDivision: sanitizeText(data.sourceDivision || 'plaza'),

        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorFirebaseUid: sanitizeText(data.authorFirebaseUid || ''),
        authorEmail: sanitizeText(data.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || 'YH Member'),
        clientCreateId: sanitizeText(
            data.clientCreateId ||
            row.private_meta?.clientCreateId ||
            ''
        ),

        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importFeedPost(id = '', payload = {}) {
    const row = buildFeedRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapFeedRow(await upsertRecord(row));
}

async function importOpportunity(id = '', payload = {}) {
    const row = buildOpportunityRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapOpportunityRow(await upsertRecord(row));
}

async function resolveExistingCreate(
    existing = null,
    context = {}
) {
    if (!existing) return null;

    const ownerUserId = sanitizeText(
        context.ownerUserId
    );

    const mapRow = context.mapRow;
    const current = mapRow(existing);

    if (
        sanitizeText(
            current.authorId ||
            current.authorFirebaseUid
        ) !== ownerUserId
    ) {
        throw plazaRecordHttpError(
            'Create idempotency key belongs to another user.',
            409
        );
    }

    return {
        created: false,
        duplicate: true,
        record: current
    };
}

async function createRecordOnce(options = {}) {
    const recordType = sanitizeText(
        options.recordType
    );

    const payload = options.payload || {};
    const buildRow = options.buildRow;
    const mapRow = options.mapRow;

    const ownerUserId = sanitizeText(
        payload.authorId ||
        payload.authorFirebaseUid
    );

    const clientCreateId = sanitizeText(
        payload.clientCreateId
    ).slice(0, 180);

    const recordId = buildDeterministicRecordId(
        recordType,
        ownerUserId,
        clientCreateId
    );

    const existing = await getExisting(
        recordType,
        recordId
    );

    const existingResult =
        await resolveExistingCreate(
            existing,
            {
                ownerUserId,
                mapRow
            }
        );

    if (existingResult) {
        return existingResult;
    }

    const row = buildRow({
        ...payload,
        id: recordId,
        clientCreateId,
        authorId: ownerUserId
    });

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) {
        if (
            error.code === '23505' ||
            /duplicate|unique/i.test(
                error.message || ''
            )
        ) {
            const duplicate = await getExisting(
                recordType,
                recordId
            );

            const duplicateResult =
                await resolveExistingCreate(
                    duplicate,
                    {
                        ownerUserId,
                        mapRow
                    }
                );

            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw new Error(
            'Plaza record insert failed: ' +
            error.message
        );
    }

    return {
        created: true,
        duplicate: false,
        record: mapRow(data)
    };
}

async function createFeedPost(payload = {}) {
    return createRecordOnce({
        recordType: 'feed_post',
        payload,
        buildRow: buildFeedRow,
        mapRow: mapFeedRow
    });
}

async function createOpportunity(payload = {}) {
    return createRecordOnce({
        recordType: 'opportunity',
        payload,
        buildRow: buildOpportunityRow,
        mapRow: mapOpportunityRow
    });
}

async function listFeed(options = {}) {
    const limit = typeof options === 'number'
        ? options
        : options.limit;

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit || 40),
            100
        )
    );

    const cursor =
        decodePlazaRecordCursor(
            typeof options === 'number'
                ? ''
                : options.cursor,
            'feed'
        );

    let query = yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq(
            'record_type',
            'feed_post'
        )
        .in(
            'status',
            PLAZA_PUBLISHED_STATUSES
        )
        .in(
            'review_status',
            PLAZA_PUBLISHED_STATUSES
        )
        .order(
            'created_at_source',
            {
                ascending: false,
                nullsFirst: false
            }
        )
        .order(
            'source_document_id',
            {
                ascending: false
            }
        );

    query =
        applyDescendingPlazaRecordCursor(
            query,
            'created_at_source',
            cursor
        );

    const {
        data,
        error
    } = await query.limit(
        safeLimit + 1
    );

    if (error) {
        throw new Error(
            'Plaza feed list failed: ' +
            error.message
        );
    }

    return buildPlazaRecordPage(
        data,
        {
            limit: safeLimit,
            kind: 'feed',
            column:
                'created_at_source',
            mapRow: mapFeedRow
        }
    );
}

async function listOpportunities(options = {}) {
    const limit = typeof options === 'number'
        ? options
        : options.limit;

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit || 60),
            120
        )
    );

    const cursor =
        decodePlazaRecordCursor(
            typeof options === 'number'
                ? ''
                : options.cursor,
            'opportunities'
        );

    let query = yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq(
            'record_type',
            'opportunity'
        )
        .in(
            'status',
            PLAZA_PUBLISHED_STATUSES
        )
        .in(
            'review_status',
            PLAZA_PUBLISHED_STATUSES
        )
        .order(
            'created_at_source',
            {
                ascending: false,
                nullsFirst: false
            }
        )
        .order(
            'source_document_id',
            {
                ascending: false
            }
        );

    query =
        applyDescendingPlazaRecordCursor(
            query,
            'created_at_source',
            cursor
        );

    const {
        data,
        error
    } = await query.limit(
        safeLimit + 1
    );

    if (error) {
        throw new Error(
            'Plaza opportunities list failed: ' +
            error.message
        );
    }

    return buildPlazaRecordPage(
        data,
        {
            limit: safeLimit,
            kind: 'opportunities',
            column:
                'created_at_source',
            mapRow:
                mapOpportunityRow
        }
    );
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

    if (error) throw new Error('Plaza record delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    buildFeedRow,
    buildOpportunityRow,
    importFeedPost,
    importOpportunity,
    createFeedPost,
    createOpportunity,
    listFeed,
    listOpportunities,
    deleteRecord,
    mapFeedRow,
    mapOpportunityRow
};
