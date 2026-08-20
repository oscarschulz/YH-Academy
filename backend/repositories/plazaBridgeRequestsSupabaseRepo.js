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

function plazaRequestHttpError(message = '', status = 500) {
    const error = new Error(
        sanitizeText(message) ||
        'Plaza request operation failed.'
    );

    error.status = Number(status) || 500;
    return error;
}

function plazaBridgeHttpError(
    message = '',
    status = 500
) {
    const error = new Error(
        sanitizeText(message) ||
        'Plaza bridge operation failed.'
    );

    error.status = Number(status) || 500;
    return error;
}

function buildDeterministicBridgeId(
    ownerUserId = '',
    clientCreateId = ''
) {
    const owner = sanitizeText(
        ownerUserId
    );

    const createKey = sanitizeText(
        clientCreateId
    );

    if (!owner || !createKey) {
        throw plazaBridgeHttpError(
            'Bridge owner and client create id are required.',
            400
        );
    }

    const digest = crypto
        .createHash('sha256')
        .update(`${owner}:${createKey}`)
        .digest('hex')
        .slice(0, 40);

    return `plaza_bridge_${digest}`;
}

function buildDeterministicRequestId(
    ownerUserId = '',
    clientRequestId = ''
) {
    const owner = sanitizeText(ownerUserId);
    const requestKey = sanitizeText(clientRequestId);

    if (!owner || !requestKey) {
        throw plazaRequestHttpError(
            'Request owner and client request id are required.',
            400
        );
    }

    const digest = crypto
        .createHash('sha256')
        .update(`${owner}:${requestKey}`)
        .digest('hex')
        .slice(0, 40);

    return `plaza_request_${digest}`;
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
function isPublishedStatus(value = '') {
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

const PLAZA_HIDDEN_STATUSES = [
    'deleted',
    'archived',
    'hidden',
    'blocked',
    'removed'
];

function plazaListHttpError(
    message = '',
    status = 500
) {
    const error = new Error(
        sanitizeText(message) ||
        'Plaza list operation failed.'
    );

    error.status = Number(status) || 500;
    return error;
}

function encodeBridgeRequestCursor(
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

function normalizeBridgeRequestCursorTimestamp(
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

function quoteBridgeRequestPostgrestFilterValue(
    value = ''
) {
    const clean = sanitizeText(value);

    return `"${clean
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')}"`;
}

function decodeBridgeRequestCursor(
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
            normalizeBridgeRequestCursorTimestamp(
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
        throw plazaListHttpError(
            'Invalid Plaza pagination cursor.',
            400
        );
    }
}

function applyDescendingBridgeRequestCursor(
    query,
    column = '',
    cursor = null
) {
    if (!cursor) return query;

    const cleanColumn = sanitizeText(
        column
    );

    const timestamp =
        quoteBridgeRequestPostgrestFilterValue(
            cursor.timestamp
        );

    const id =
        quoteBridgeRequestPostgrestFilterValue(
            cursor.id
        );

    return query.or(
        `${cleanColumn}.lt.${timestamp},and(${cleanColumn}.eq.${timestamp},source_document_id.lt.${id})`
    );
}

function buildBridgeRequestPage(
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
                ? encodeBridgeRequestCursor(
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

function comparePlazaRowsDescending(
    left = {},
    right = {},
    column = ''
) {
    const leftTime =
        Date.parse(
            left[column] ||
            left.updated_at ||
            left.created_at ||
            ''
        ) || 0;

    const rightTime =
        Date.parse(
            right[column] ||
            right.updated_at ||
            right.created_at ||
            ''
        ) || 0;

    if (rightTime !== leftTime) {
        return rightTime - leftTime;
    }

    return sanitizeText(
        right.source_document_id ||
        right.id
    ).localeCompare(
        sanitizeText(
            left.source_document_id ||
            left.id
        )
    );
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
        clientCreateId: sanitizeText(input.clientCreateId || ''),
        stage: sanitizeText(input.stage || 'Bridge Path'),
        nextStep: sanitizeText(
            input.nextStep ||
            'Review and decide the next structured move.'
        ),
        action: sanitizeText(input.action || 'Open Bridge Detail'),
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
        clientRequestId: sanitizeText(input.clientRequestId || ''),
        deletedAt: toIso(input.deletedAt),
        deletedBy: sanitizeText(input.deletedBy || ''),
        deletedByName: sanitizeText(input.deletedByName || ''),
        deleteReason: sanitizeText(input.deleteReason || ''),
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
            category: sanitizeText(data.category),
            stage: sanitizeText(data.stage),
            nextStep: sanitizeText(data.nextStep),
            action: sanitizeText(data.action)
        },
        private_meta: {
            authorEmail: sanitizeText(data.authorEmail),
            clientCreateId: sanitizeText(data.clientCreateId)
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
            targetUserId: sanitizeText(data.targetUserId),
            clientRequestId: sanitizeText(data.clientRequestId),
            deletedAt: sanitizeText(data.deletedAt),
            deletedBy: sanitizeText(data.deletedBy)
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

    const origin = sanitizeText(
        data.origin ||
        row.public_meta?.origin ||
        ''
    );

    const destination = sanitizeText(
        data.destination ||
        row.public_meta?.destination ||
        ''
    );

    const description = sanitizeText(
        data.description ||
        row.body ||
        ''
    );

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        title: sanitizeText(data.title || row.title || 'Plaza bridge'),
        name: sanitizeText(data.name || row.public_meta?.name || data.title || row.title || 'Plaza bridge'),
        slug: sanitizeText(data.slug || row.public_meta?.slug || ''),
        description,
        text: description,
        summary: sanitizeText(data.summary || row.summary || ''),
        origin,
        destination,
        left: origin,
        right: destination,
        region: sanitizeText(data.region || row.region || 'Global'),
        category: sanitizeText(data.category || row.category || 'bridge'),
        stage: sanitizeText(
            data.stage ||
            row.public_meta?.stage ||
            'Bridge Path'
        ),
        nextStep: sanitizeText(
            data.nextStep ||
            row.public_meta?.nextStep ||
            'Review and decide the next structured move.'
        ),
        action: sanitizeText(
            data.action ||
            row.public_meta?.action ||
            'Open Bridge Detail'
        ),
        tags: safeArray(data.tags || row.tags),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorEmail: sanitizeText(data.authorEmail || row.private_meta?.authorEmail || '').toLowerCase(),
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


function mapRequestRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        title: sanitizeText(data.title || row.title || 'Plaza request'),
        subject: sanitizeText(data.subject || row.public_meta?.subject || data.title || row.title || ''),
        description: sanitizeText(data.description || row.body || ''),
        message: sanitizeText(data.message || data.description || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),

        requestType: sanitizeText(data.requestType || row.public_meta?.requestType || row.category || 'general'),
        objective: sanitizeText(data.objective || data.requestType || 'Connection request'),
        sourceType: sanitizeText(data.sourceType || data.requestType || 'general'),
        targetId: sanitizeText(data.targetId || ''),
        targetLabel: sanitizeText(data.targetLabel || data.title || row.title || 'General Plaza request'),
        context: sanitizeText(data.context || ''),
        name: sanitizeText(data.name || data.authorName || row.public_meta?.authorName || 'YH Member'),

        providerId: sanitizeText(data.providerId || ''),
        providerName: sanitizeText(data.providerName || ''),
        serviceCategory: sanitizeText(data.serviceCategory || ''),
        serviceTags: safeArray(data.serviceTags),
        serviceProviderType: sanitizeText(data.serviceProviderType || ''),
        servicePriceType: sanitizeText(data.servicePriceType || ''),
        serviceDeliveryTime: sanitizeText(data.serviceDeliveryTime || ''),
        requestIntent: sanitizeText(data.requestIntent || ''),
        requestPriority: sanitizeText(data.requestPriority || data.priority || 'normal'),

        routeKey: sanitizeText(data.routeKey || data.sourceType || 'general'),
        routeLabel: sanitizeText(data.routeLabel || data.targetLabel || data.title || row.title || ''),
        matchingStatus: sanitizeText(data.matchingStatus || ''),
        matchingPriority: sanitizeText(data.matchingPriority || ''),

        routedToPatron: data.routedToPatron === true,
        patronRouteStatus: sanitizeText(data.patronRouteStatus || ''),
        patronRegionId: sanitizeText(data.patronRegionId || ''),
        patronRegion: sanitizeText(data.patronRegion || ''),
        patronUserId: sanitizeText(data.patronUserId || ''),
        patronName: sanitizeText(data.patronName || ''),
        patronRole: sanitizeText(data.patronRole || ''),
        patronInboxRole: sanitizeText(data.patronInboxRole || ''),
        patronHandledAt: toIso(data.patronHandledAt),
        patronHandledBy: sanitizeText(data.patronHandledBy || ''),
        patronActionNote: sanitizeText(data.patronActionNote || ''),

        headline: sanitizeText(data.headline || ''),
        experience: sanitizeText(data.experience || ''),
        portfolioLink: sanitizeText(data.portfolioLink || ''),
        attachmentMeta: safeArray(data.attachmentMeta),
        matchedEntityLabels: safeArray(data.matchedEntityLabels),
        decisionSummary: sanitizeText(data.decisionSummary || ''),
        resolutionSummary: sanitizeText(data.resolutionSummary || ''),
        statusHistory: safeArray(data.statusHistory),

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
        clientRequestId: sanitizeText(data.clientRequestId || row.private_meta?.clientRequestId || ''),

        status: normalizeStatus(data.status || row.status || 'open'),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || 'active'),
        resolvedAt: toIso(data.resolvedAt || ''),
        deletedAt: toIso(data.deletedAt || row.private_meta?.deletedAt || ''),
        deletedBy: sanitizeText(data.deletedBy || row.private_meta?.deletedBy || ''),
        deletedByName: sanitizeText(data.deletedByName || ''),
        deleteReason: sanitizeText(data.deleteReason || ''),
        updatedBy: sanitizeText(data.updatedBy || ''),
        updatedByName: sanitizeText(data.updatedByName || ''),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function toPublicBridge(
    bridge = {}
) {
    const {
        authorId,
        authorEmail,
        clientCreateId,
        ...safeBridge
    } = bridge;

    return {
        ...safeBridge,

        authorName:
            sanitizeText(
                bridge.authorName ||
                'YH Member'
            )
    };
}

function toViewerRequest(
    request = {},
    viewer = {}
) {
    const viewerIds =
        new Set(
            [
                viewer.id,
                viewer.firebaseUid
            ]
                .map(sanitizeText)
                .filter(Boolean)
        );

    const ownerIds =
        [
            request.authorId,
            request.authorFirebaseUid
        ]
            .map(sanitizeText)
            .filter(Boolean);

    const isOwner =
        ownerIds.some(
            (id) =>
                viewerIds.has(id)
        );

    const {
        authorId,
        authorFirebaseUid,
        authorEmail,
        assignedTo,
        targetUserId,
        clientRequestId,
        deletedAt,
        deletedBy,
        deletedByName,
        deleteReason,
        updatedBy,
        patronHandledBy,
        ...safeRequest
    } = request;

    return {
        ...safeRequest,

        /*
         * Only the original request owner needs
         * the browser idempotency key.
         */
        clientRequestId:
            isOwner
                ? sanitizeText(
                    clientRequestId
                )
                : '',

        /*
         * Preserve the useful lifecycle timeline
         * without exposing internal user ids.
         */
        statusHistory:
            safeArray(
                request.statusHistory
            ).map(
                (entry) => ({
                    from:
                        sanitizeText(
                            entry?.from
                        ),

                    to:
                        sanitizeText(
                            entry?.to
                        ),

                    at:
                        toIso(
                            entry?.at
                        ),

                    byName:
                        sanitizeText(
                            entry?.byName
                        )
                })
            ),

        isOwner
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

async function resolveExistingBridgeCreate(
    existing = null,
    ownerUserId = ''
) {
    if (!existing) return null;

    const current = mapBridgeRow(
        existing
    );

    if (
        sanitizeText(
            current.authorId
        ) !==
        sanitizeText(ownerUserId)
    ) {
        throw plazaBridgeHttpError(
            'Bridge idempotency key belongs to another user.',
            409
        );
    }

    return {
        created: false,
        duplicate: true,
        bridge: current
    };
}

async function createBridge(payload = {}) {
    const ownerUserId = sanitizeText(
        payload.authorId
    );

    const clientCreateId = sanitizeText(
        payload.clientCreateId
    ).slice(0, 180);

    const bridgeId =
        buildDeterministicBridgeId(
            ownerUserId,
            clientCreateId
        );

    const existing = await getExisting(
        'bridge_path',
        bridgeId
    );

    const existingResult =
        await resolveExistingBridgeCreate(
            existing,
            ownerUserId
        );

    if (existingResult) {
        return existingResult;
    }

    const row = buildBridgeRow({
        ...payload,
        id: bridgeId,
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
                error.message ||
                ''
            )
        ) {
            const duplicate =
                await getExisting(
                    'bridge_path',
                    bridgeId
                );

            const duplicateResult =
                await resolveExistingBridgeCreate(
                    duplicate,
                    ownerUserId
                );

            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw new Error(
            'Plaza bridge insert failed: ' +
            error.message
        );
    }

    return {
        created: true,
        duplicate: false,
        bridge: mapBridgeRow(data)
    };
}

async function resolveExistingRequestCreate(
    existing = null,
    payload = {},
    context = {}
) {
    if (!existing) return null;

    const ownerUserId = sanitizeText(
        context.ownerUserId
    );

    const clientRequestId = sanitizeText(
        context.clientRequestId
    );

    const requestId = sanitizeText(
        context.requestId
    );

    const current = mapRequestRow(existing);

    if (
        sanitizeText(
            current.authorId ||
            current.authorFirebaseUid
        ) !== ownerUserId
    ) {
        throw plazaRequestHttpError(
            'Request idempotency key belongs to another user.',
            409
        );
    }

    const incomingStatus = normalizeStatus(
        payload.status || 'submitted'
    );

    if (
        current.status === 'draft' &&
        incomingStatus === 'submitted'
    ) {
        const promoted = await updateRequest(
            requestId,
            {
                ...payload,
                id: requestId,
                clientRequestId,
                createdAt: current.createdAt,
                status: 'Submitted'
            },
            {
                expectedUpdatedAt: current.updatedAt
            }
        );

        return {
            created: false,
            duplicate: true,
            promoted: true,
            request: promoted
        };
    }

    return {
        created: false,
        duplicate: true,
        promoted: false,
        request: current
    };
}

async function createRequest(payload = {}) {
    const ownerUserId = sanitizeText(
        payload.authorId ||
        payload.authorFirebaseUid
    );

    const clientRequestId = sanitizeText(
        payload.clientRequestId
    ).slice(0, 180);

    const requestId = buildDeterministicRequestId(
        ownerUserId,
        clientRequestId
    );

    const existing = await getExisting(
        'request',
        requestId
    );

    const existingResult =
        await resolveExistingRequestCreate(
            existing,
            payload,
            {
                requestId,
                ownerUserId,
                clientRequestId
            }
        );

    if (existingResult) {
        return existingResult;
    }

    const row = buildRequestRow({
        ...payload,
        id: requestId,
        clientRequestId,
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
                'request',
                requestId
            );

            const duplicateResult =
                await resolveExistingRequestCreate(
                    duplicate,
                    payload,
                    {
                        requestId,
                        ownerUserId,
                        clientRequestId
                    }
                );

            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw new Error(
            'Plaza request insert failed: ' +
            error.message
        );
    }

    return {
        created: true,
        duplicate: false,
        promoted: false,
        request: mapRequestRow(data)
    };
}

async function listBridge(options = {}) {
    const limit = typeof options === 'number'
        ? options
        : options.limit;

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit || 80),
            160
        )
    );

    const cursor =
        decodeBridgeRequestCursor(
            typeof options === 'number'
                ? ''
                : options.cursor,
            'bridge'
        );

    let query = yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq(
            'record_type',
            'bridge_path'
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
            'updated_at_source',
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
        applyDescendingBridgeRequestCursor(
            query,
            'updated_at_source',
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
            'Plaza bridge list failed: ' +
            error.message
        );
    }

    return buildBridgeRequestPage(
        data,
        {
            limit: safeLimit,
            kind: 'bridge',
            column:
                'updated_at_source',
            mapRow:
                mapBridgeRow
        }
    );
}

async function listRequests(options = {}) {
    const viewerId = sanitizeText(
        typeof options === 'number'
            ? ''
            : options.viewerId
    );

    const limit = typeof options === 'number'
        ? options
        : options.limit;

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit || 100),
            200
        )
    );

    const cursor =
        decodeBridgeRequestCursor(
            typeof options === 'number'
                ? ''
                : options.cursor,
            'requests'
        );

    if (!viewerId) {
        throw plazaListHttpError(
            'Plaza request viewer is required.',
            400
        );
    }

    const makeQuery = () => {
        let query = yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(
                'record_type',
                'request'
            )
            .not(
                'status',
                'in',
                `(${PLAZA_HIDDEN_STATUSES.join(',')})`
            )
            .order(
                'updated_at_source',
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
            applyDescendingBridgeRequestCursor(
                query,
                'updated_at_source',
                cursor
            );

        return query.limit(
            safeLimit + 1
        );
    };

    const results = await Promise.all([
        makeQuery()
            .eq(
                'owner_user_id',
                viewerId
            ),

        makeQuery()
            .eq(
                'target_user_id',
                viewerId
            ),

        makeQuery()
            .contains(
                'data',
                {
                    assignedTo:
                        viewerId
                }
            ),

        makeQuery()
            .contains(
                'data',
                {
                    targetUserId:
                        viewerId
                }
            ),

        makeQuery()
            .contains(
                'data',
                {
                    patronUserId:
                        viewerId
                }
            )
    ]);

    const failed = results.find(
        (result) =>
            result.error
    );

    if (failed?.error) {
        throw new Error(
            'Plaza requests list failed: ' +
            failed.error.message
        );
    }

    const rowsById = new Map();

    results.forEach((result) => {
        (
            Array.isArray(result.data)
                ? result.data
                : []
        ).forEach((row) => {
            const id = sanitizeText(
                row.source_document_id ||
                row.id
            );

            if (!id) return;

            const existing =
                rowsById.get(id);

            if (
                !existing ||
                comparePlazaRowsDescending(
                    row,
                    existing,
                    'updated_at_source'
                ) <= 0
            ) {
                rowsById.set(
                    id,
                    row
                );
            }
        });
    });

    const rows = Array.from(
        rowsById.values()
    )
        .filter((row) =>
            isReadableStatus(
                row.status ||
                row.review_status ||
                'active'
            )
        )
        .sort((left, right) =>
            comparePlazaRowsDescending(
                left,
                right,
                'updated_at_source'
            )
        );

    return buildBridgeRequestPage(
        rows,
        {
            limit: safeLimit,
            kind: 'requests',
            column:
                'updated_at_source',
            mapRow:
                mapRequestRow
        }
    );
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

async function updateRequest(
    id = '',
    patch = {},
    options = {}
) {
    const cleanId = sanitizeText(id);
    const expectedUpdatedAt = toIso(
        options.expectedUpdatedAt ||
        patch.expectedUpdatedAt
    );

    if (!cleanId) {
        throw plazaRequestHttpError(
            'Plaza request id is required.',
            400
        );
    }

    if (!expectedUpdatedAt) {
        throw plazaRequestHttpError(
            'Request version is required. Reload and retry.',
            428
        );
    }

    const existing = await getExisting(
        'request',
        cleanId
    );

    if (!existing) {
        throw plazaRequestHttpError(
            'Plaza request not found.',
            404
        );
    }

    const current =
        existing.data &&
        typeof existing.data === 'object'
            ? existing.data
            : {};

    const currentUpdatedAt = toIso(
        current.updatedAt ||
        existing.updated_at_source ||
        existing.updated_at
    );

    if (
        currentUpdatedAt !==
        expectedUpdatedAt
    ) {
        throw plazaRequestHttpError(
            'This Plaza request changed in another session. Reload and retry.',
            409
        );
    }

    if (
        normalizeStatus(
            current.status ||
            existing.status
        ) === 'deleted'
    ) {
        throw plazaRequestHttpError(
            'This Plaza request has already been deleted.',
            410
        );
    }

    const safePatch = {
        ...patch
    };

    delete safePatch.expectedUpdatedAt;

    const nextUpdatedAt = nowIso();

    const nextData = {
        ...current,
        ...safePatch,
        id: cleanId,
        createdAt:
            toIso(current.createdAt) ||
            toIso(existing.created_at_source) ||
            nextUpdatedAt,
        updatedAt:
            nextUpdatedAt
    };

    const row = buildRequestRow(
        nextData
    );

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(TABLE)
        .update(row)
        .eq('id', existing.id)
        .eq('record_type', 'request')
        .eq('source_document_id', cleanId)
        .eq(
            'updated_at_source',
            expectedUpdatedAt
        )
        .select('*')
        .maybeSingle();

    if (error) {
        throw new Error(
            'Plaza request update failed: ' +
            error.message
        );
    }

    if (!data) {
        throw plazaRequestHttpError(
            'This Plaza request changed in another session. Reload and retry.',
            409
        );
    }

    return mapRequestRow(data);
}

async function advanceRequestStatus(
    id = '',
    status = '',
    options = {}
) {
    return updateRequest(
        id,
        {
            status: sanitizeText(
                status || 'open'
            )
        },
        options
    );
}

async function softDeleteRequest(
    id = '',
    options = {}
) {
    const deletedAt = nowIso();

    return updateRequest(
        id,
        {
            status: 'deleted',
            reviewStatus: 'deleted',
            deletedAt,
            deletedBy: sanitizeText(
                options.deletedBy
            ),
            deletedByName: sanitizeText(
                options.deletedByName
            ),
            deleteReason: sanitizeText(
                options.deleteReason ||
                'Deleted by request owner.'
            ),
            updatedBy: sanitizeText(
                options.deletedBy
            ),
            updatedByName: sanitizeText(
                options.deletedByName
            )
        },
        {
            expectedUpdatedAt:
                options.expectedUpdatedAt
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
    softDeleteRequest,
    deleteRecord,
    mapBridgeRow,
    mapRequestRow,
    toPublicBridge,
    toViewerRequest
};
