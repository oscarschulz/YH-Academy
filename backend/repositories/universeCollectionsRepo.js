const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE_NAME = 'yhu_universe_collection_catalog';

const RESOURCE_TYPES = new Set([
    'link',
    'document',
    'tool',
    'template',
    'script',
    'lead_source',
    'opportunity',
    'contact',
    'playbook',
    'case_study',
    'workflow',
    'other'
]);

const DIVISIONS = new Set([
    'academy',
    'plaza',
    'federation',
    'universe'
]);

const ACCESS_LEVELS = new Set([
    'academy',
    'plaza',
    'federation',
    'all_approved_members',
    'admin_only'
]);

const REVIEW_STATUSES = new Set([
    'pending_review',
    'approved',
    'rejected',
    'archived'
]);

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return cleanText(value, fallback).toLowerCase();
}

function clampText(value, max = 800, fallback = '') {
    return cleanText(value, fallback).slice(0, max);
}

function normalizeResourceType(value = 'link') {
    const clean = cleanLower(value || 'link');
    return RESOURCE_TYPES.has(clean) ? clean : 'other';
}

function normalizeDivision(value = 'universe') {
    const clean = cleanLower(value || 'universe');
    return DIVISIONS.has(clean) ? clean : 'universe';
}

function normalizeAccessLevel(value = 'all_approved_members') {
    const clean = cleanLower(value || 'all_approved_members');
    return ACCESS_LEVELS.has(clean) ? clean : 'all_approved_members';
}

function normalizeReviewStatus(value = 'pending_review') {
    const clean = cleanLower(value || 'pending_review');
    return REVIEW_STATUSES.has(clean) ? clean : 'pending_review';
}

function normalizeTags(value = []) {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return Array.from(
        new Set(
            raw
                .map((item) => cleanLower(item))
                .filter(Boolean)
                .map((item) => item.slice(0, 40))
        )
    ).slice(0, 12);
}

function normalizeDivisionScope(value = [], fallbackDivision = 'universe') {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    const normalized = Array.from(
        new Set(
            raw
                .map((item) => normalizeDivision(item))
                .filter(Boolean)
        )
    ).filter((item) => DIVISIONS.has(item));

    if (normalized.length) return normalized.slice(0, 4);

    const fallback = normalizeDivision(fallbackDivision);
    return fallback === 'universe' ? ['universe'] : [fallback];
}

function toIso(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return cleanText(value);
}

function getViewerId(viewer = {}) {
    return cleanText(viewer.id || viewer.firebaseUid || viewer.uid);
}

function buildCreatorSnapshot(viewer = {}) {
    return {
        createdByUid: getViewerId(viewer),
        createdByEmail: cleanLower(viewer.email),
        createdByName: cleanText(
            viewer.name ||
            viewer.fullName ||
            viewer.displayName ||
            viewer.username ||
            'YH Member'
        ),
        createdByUsername: cleanText(viewer.username),
        createdByAvatar: cleanText(
            viewer.avatar ||
            viewer.profilePhoto ||
            viewer.photoURL ||
            ''
        )
    };
}

function buildId() {
    return `yhc_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function mapCollectionRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: cleanText(row.source_document_id || row.id),

        title: cleanText(row.title || data.title),
        description: cleanText(row.description || data.description || row.summary || data.summary),

        resourceType: normalizeResourceType(row.item_type || data.resourceType),
        sourceDivision: normalizeDivision(row.source_division || data.sourceDivision),
        divisionScope: Array.isArray(data.divisionScope) ? data.divisionScope : [],

        category: cleanText(row.category || data.category),
        tags: Array.isArray(row.tags) ? row.tags : Array.isArray(data.tags) ? data.tags : [],

        resourceUrl: cleanText(row.resource_url || data.resourceUrl),
        fileUrl: cleanText(row.file_url || data.fileUrl),
        imageUrl: cleanText(row.image_url || data.imageUrl),

        visibility: cleanText(row.visibility || data.visibility || 'division_members'),
        accessLevel: normalizeAccessLevel(row.access_level || data.accessLevel),

        reviewStatus: normalizeReviewStatus(row.review_status || data.reviewStatus),

        createdByUid: cleanText(row.created_by_uid || data.createdByUid),
        createdByEmail: cleanText(row.created_by_email || data.createdByEmail),
        createdByName: cleanText(row.created_by_name || data.createdByName),
        createdByUsername: cleanText(row.created_by_username || data.createdByUsername),
        createdByAvatar: cleanText(row.created_by_avatar || data.createdByAvatar),

        viewCount: Number(data.viewCount || 0),
        saveCount: Number(data.saveCount || 0),
        reportCount: Number(data.reportCount || 0),

        createdAt: toIso(row.created_at_source || data.createdAt || row.created_at),
        updatedAt: toIso(row.updated_at_source || data.updatedAt || row.updated_at),
        approvedAt: toIso(data.approvedAt),
        approvedByUid: cleanText(data.approvedByUid)
    };
}

function canViewerSeeItem(item = {}, viewer = {}) {
    const viewerId = getViewerId(viewer);
    const isOwner = viewerId && cleanText(item.createdByUid) === viewerId;
    const status = normalizeReviewStatus(item.reviewStatus);

    if (isOwner) return true;
    if (status !== 'approved') return false;
    if (normalizeAccessLevel(item.accessLevel) === 'admin_only') return false;

    return true;
}

function buildResourceData(payload = {}) {
    return {
        title: payload.title,
        description: payload.description,

        resourceType: payload.resourceType,
        sourceDivision: payload.sourceDivision,
        divisionScope: payload.divisionScope,

        category: payload.category,
        tags: payload.tags,

        resourceUrl: payload.resourceUrl,
        fileUrl: payload.fileUrl,
        imageUrl: payload.imageUrl,

        visibility: payload.visibility,
        accessLevel: payload.accessLevel,

        reviewStatus: payload.reviewStatus,

        createdByUid: payload.createdByUid,
        createdByEmail: payload.createdByEmail,
        createdByName: payload.createdByName,
        createdByUsername: payload.createdByUsername,
        createdByAvatar: payload.createdByAvatar,

        viewCount: payload.viewCount || 0,
        saveCount: payload.saveCount || 0,
        reportCount: payload.reportCount || 0,

        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        approvedAt: payload.approvedAt || '',
        approvedByUid: payload.approvedByUid || ''
    };
}

function buildResourceRow(itemId, payload = {}) {
    const data = buildResourceData(payload);

    return {
        record_source: 'resource',
        source_collection_path: 'yhUniverseCollections',
        source_document_id: itemId,
        source_document_path: `yhUniverseCollections/${itemId}`,

        item_type: payload.resourceType,
        title: payload.title,
        summary: payload.description,
        description: payload.description,

        source_division: payload.sourceDivision,
        target_division: payload.accessLevel || payload.sourceDivision,
        source_feature: 'resources',
        source_system: 'yh_universe_collections',
        source_record_id: itemId,
        source_record_path: `yhUniverseCollections/${itemId}`,

        access_level: payload.accessLevel,
        visibility: payload.visibility,
        review_status: payload.reviewStatus,
        listing_status: payload.reviewStatus,

        category: payload.category,
        tags: payload.tags,

        created_by_uid: payload.createdByUid,
        created_by_email: payload.createdByEmail,
        created_by_name: payload.createdByName,
        created_by_username: payload.createdByUsername,
        created_by_avatar: payload.createdByAvatar,

        public_meta: {
            resourceType: payload.resourceType,
            resourceUrl: payload.resourceUrl,
            fileUrl: payload.fileUrl,
            imageUrl: payload.imageUrl
        },
        private_meta_available: false,
        monetized: false,

        resource_url: payload.resourceUrl,
        file_url: payload.fileUrl,
        image_url: payload.imageUrl,

        buyer_price_amount: 0,
        seller_price_amount: 0,
        currency: 'USD',

        created_at_source: payload.createdAt,
        updated_at_source: payload.updatedAt,

        data
    };
}

async function fetchResourceRowById(itemId = '') {
    const cleanId = cleanText(itemId);

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_source', 'resource')
        .eq('source_document_id', cleanId)
        .maybeSingle();

    if (error) {
        throw new Error(`Supabase collection item lookup failed: ${error.message}`);
    }

    return data || null;
}

async function createCollectionItem(viewer = {}, input = {}) {
    const viewerId = getViewerId(viewer);

    if (!viewerId) {
        const error = new Error('Missing authenticated user.');
        error.statusCode = 401;
        throw error;
    }

    const title = clampText(input.title, 140);
    const description = clampText(input.description, 1600);

    if (!title) {
        const error = new Error('Resource title is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!description) {
        const error = new Error('Resource description is required.');
        error.statusCode = 400;
        throw error;
    }

    const itemId = buildId();
    const sourceDivision = normalizeDivision(input.sourceDivision || input.division || 'universe');
    const accessLevel = normalizeAccessLevel(input.accessLevel || sourceDivision || 'all_approved_members');
    const now = new Date().toISOString();
    const creator = buildCreatorSnapshot(viewer);

    const payload = {
        title,
        description,

        resourceType: normalizeResourceType(input.resourceType),
        sourceDivision,
        divisionScope: normalizeDivisionScope(input.divisionScope, sourceDivision),

        category: clampText(input.category, 80),
        tags: normalizeTags(input.tags),

        resourceUrl: clampText(input.resourceUrl || input.url, 900),
        fileUrl: clampText(input.fileUrl, 900),
        imageUrl: clampText(input.imageUrl, 900),

        visibility: clampText(input.visibility || 'division_members', 80),
        accessLevel,

        reviewStatus: 'pending_review',

        ...creator,

        viewCount: 0,
        saveCount: 0,
        reportCount: 0,

        createdAt: now,
        updatedAt: now,
        approvedAt: '',
        approvedByUid: ''
    };

    const row = buildResourceRow(itemId, payload);

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .insert(row)
        .select('*')
        .single();

    if (error) {
        throw new Error(`Supabase collection item create failed: ${error.message}`);
    }

    return mapCollectionRow(data);
}

async function listCollections(viewer = {}, filters = {}) {
    const limit = Math.max(1, Math.min(200, Number(filters.limit || 80)));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_source', 'resource')
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(250);

    if (error) {
        throw new Error(`Supabase collection list failed: ${error.message}`);
    }

    const sourceDivision = cleanLower(filters.sourceDivision || filters.division || '');
    const resourceType = cleanLower(filters.resourceType || '');
    const statusFilter = cleanLower(filters.reviewStatus || filters.status || '');
    const q = cleanLower(filters.q || filters.search || '');

    return (Array.isArray(data) ? data : [])
        .map(mapCollectionRow)
        .filter((item) => canViewerSeeItem(item, viewer))
        .filter((item) => !sourceDivision || item.sourceDivision === sourceDivision || item.divisionScope.includes(sourceDivision))
        .filter((item) => !resourceType || item.resourceType === resourceType)
        .filter((item) => !statusFilter || item.reviewStatus === statusFilter)
        .filter((item) => {
            if (!q) return true;

            const haystack = [
                item.title,
                item.description,
                item.category,
                item.resourceType,
                item.sourceDivision,
                ...(Array.isArray(item.tags) ? item.tags : [])
            ].join(' ').toLowerCase();

            return haystack.includes(q);
        })
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
        .slice(0, limit);
}

async function getCollectionItemById(viewer = {}, itemId = '') {
    const cleanId = cleanText(itemId);

    if (!cleanId) {
        const error = new Error('Missing collection item id.');
        error.statusCode = 400;
        throw error;
    }

    const row = await fetchResourceRowById(cleanId);

    if (!row) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const item = mapCollectionRow(row);

    if (!canViewerSeeItem(item, viewer)) {
        const error = new Error('You do not have access to this collection item.');
        error.statusCode = 403;
        throw error;
    }

    return item;
}

async function updateMyCollectionItem(viewer = {}, itemId = '', input = {}) {
    const viewerId = getViewerId(viewer);
    const cleanId = cleanText(itemId);

    if (!viewerId) {
        const error = new Error('Missing authenticated user.');
        error.statusCode = 401;
        throw error;
    }

    if (!cleanId) {
        const error = new Error('Missing collection item id.');
        error.statusCode = 400;
        throw error;
    }

    const existingRow = await fetchResourceRowById(cleanId);

    if (!existingRow) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = mapCollectionRow(existingRow);

    if (current.createdByUid !== viewerId) {
        const error = new Error('You can only edit your own collection items.');
        error.statusCode = 403;
        throw error;
    }

    const sourceDivision = normalizeDivision(input.sourceDivision || input.division || current.sourceDivision);
    const accessLevel = normalizeAccessLevel(input.accessLevel || current.accessLevel || sourceDivision);

    const nextTitle = clampText(input.title ?? current.title, 140);
    const nextDescription = clampText(input.description ?? current.description, 1600);

    if (!nextTitle) {
        const error = new Error('Resource title is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!nextDescription) {
        const error = new Error('Resource description is required.');
        error.statusCode = 400;
        throw error;
    }

    const createdAt = current.createdAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const payload = {
        title: nextTitle,
        description: nextDescription,

        resourceType: normalizeResourceType(input.resourceType || current.resourceType),
        sourceDivision,
        divisionScope: normalizeDivisionScope(input.divisionScope || current.divisionScope, sourceDivision),

        category: clampText(input.category ?? current.category, 80),
        tags: normalizeTags(input.tags ?? current.tags),

        resourceUrl: clampText(input.resourceUrl ?? current.resourceUrl, 900),
        fileUrl: clampText(input.fileUrl ?? current.fileUrl, 900),
        imageUrl: clampText(input.imageUrl ?? current.imageUrl, 900),

        visibility: clampText(input.visibility ?? current.visibility ?? 'division_members', 80),
        accessLevel,

        reviewStatus: 'pending_review',

        createdByUid: current.createdByUid,
        createdByEmail: current.createdByEmail,
        createdByName: current.createdByName,
        createdByUsername: current.createdByUsername,
        createdByAvatar: current.createdByAvatar,

        viewCount: current.viewCount || 0,
        saveCount: current.saveCount || 0,
        reportCount: current.reportCount || 0,

        createdAt,
        updatedAt,
        approvedAt: '',
        approvedByUid: ''
    };

    const row = buildResourceRow(cleanId, payload);

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .update(row)
        .eq('record_source', 'resource')
        .eq('source_document_id', cleanId)
        .select('*')
        .single();

    if (error) {
        throw new Error(`Supabase collection item update failed: ${error.message}`);
    }

    return mapCollectionRow(data);
}

async function deleteMyCollectionItem(viewer = {}, itemId = '') {
    const viewerId = getViewerId(viewer);
    const cleanId = cleanText(itemId);

    if (!viewerId) {
        const error = new Error('Missing authenticated user.');
        error.statusCode = 401;
        throw error;
    }

    if (!cleanId) {
        const error = new Error('Missing collection item id.');
        error.statusCode = 400;
        throw error;
    }

    const existingRow = await fetchResourceRowById(cleanId);

    if (!existingRow) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = mapCollectionRow(existingRow);

    if (current.createdByUid !== viewerId) {
        const error = new Error('You can only delete your own collection items.');
        error.statusCode = 403;
        throw error;
    }

    const { error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .delete()
        .eq('record_source', 'resource')
        .eq('source_document_id', cleanId);

    if (error) {
        throw new Error(`Supabase collection item delete failed: ${error.message}`);
    }

    return {
        id: cleanId,
        deleted: true
    };
}

module.exports = {
    createCollectionItem,
    listCollections,
    getCollectionItemById,
    updateMyCollectionItem,
    deleteMyCollectionItem,
    mapCollectionDoc: mapCollectionRow
};
