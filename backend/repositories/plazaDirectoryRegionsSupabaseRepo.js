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

function normalizeDirectoryProfile(input = {}) {
    const now = nowIso();
    const id = sanitizeText(
        input.id ||
        input.sourceDocumentId ||
        input.userId ||
        input.firebaseUid ||
        input.uid ||
        buildId('plaza_directory')
    );

    const name = sanitizeText(
        input.name ||
        input.fullName ||
        input.displayName ||
        input.username ||
        input.email ||
        'YH Member'
    );

    const headline = sanitizeText(
        input.headline ||
        input.title ||
        input.role ||
        input.specialty ||
        'Plaza Member'
    );

    const bio = sanitizeText(
        input.bio ||
        input.about ||
        input.description ||
        input.summary ||
        ''
    );

    return {
        ...input,
        id,
        userId: sanitizeText(input.userId || input.firebaseUid || input.uid || id),
        firebaseUid: sanitizeText(input.firebaseUid || input.uid || input.userId || id),
        email: sanitizeText(input.email || input.authorEmail || '').toLowerCase(),
        username: sanitizeText(input.username || ''),
        name,
        headline,
        bio,
        region: sanitizeText(input.region || input.location || 'Global') || 'Global',
        avatarUrl: sanitizeText(input.avatarUrl || input.photoURL || input.profilePhotoUrl || ''),
        role: sanitizeText(input.role || input.memberRole || ''),
        skills: safeArray(input.skills).map(sanitizeText).filter(Boolean),
        services: safeArray(input.services).map(sanitizeText).filter(Boolean),
        tags: normalizeTags([
            ...(safeArray(input.tags)),
            ...(safeArray(input.skills)),
            ...(safeArray(input.services))
        ]),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeRegion(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || input.slug || buildId('plaza_region'));

    const name = sanitizeText(
        input.name ||
        input.title ||
        input.region ||
        input.label ||
        'Plaza Region'
    );

    const slug = sanitizeText(
        input.slug ||
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    );

    const description = sanitizeText(
        input.description ||
        input.summary ||
        input.body ||
        ''
    );

    return {
        ...input,
        id,
        name,
        slug,
        title: sanitizeText(input.title || name),
        description,
        summary: sanitizeText(input.summary || description).slice(0, 600),
        country: sanitizeText(input.country || ''),
        city: sanitizeText(input.city || ''),
        region: sanitizeText(input.region || name || 'Global') || 'Global',
        memberCount: Number.isFinite(Number(input.memberCount)) ? Number(input.memberCount) : 0,
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        tags: normalizeTags([
            ...(safeArray(input.tags)),
            slug,
            name,
            input.country,
            input.city
        ]),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildDirectoryRow(input = {}) {
    const data = normalizeDirectoryProfile(input);

    return {
        record_type: 'directory_profile',
        source_collection_path: 'plazaDirectoryProfiles',
        source_document_id: data.id,
        source_document_path: 'plazaDirectoryProfiles/' + data.id,
        owner_user_id: sanitizeText(data.userId || data.firebaseUid || data.id),
        target_user_id: sanitizeText(data.userId || data.firebaseUid || data.id),
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.name),
        summary: sanitizeText(data.headline || data.bio).slice(0, 600),
        body: sanitizeText(data.bio),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.role || 'directory_profile'),
        tags: normalizeTags([
            'plaza',
            'directory',
            data.region,
            data.role,
            ...(safeArray(data.tags))
        ]),
        public_meta: {
            name: sanitizeText(data.name),
            headline: sanitizeText(data.headline),
            username: sanitizeText(data.username),
            avatarUrl: sanitizeText(data.avatarUrl),
            role: sanitizeText(data.role),
            skills: safeArray(data.skills),
            services: safeArray(data.services)
        },
        private_meta: {
            email: sanitizeText(data.email),
            firebaseUid: sanitizeText(data.firebaseUid)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildRegionRow(input = {}) {
    const data = normalizeRegion(input);

    return {
        record_type: 'region',
        source_collection_path: 'plazaRegions',
        source_document_id: data.id,
        source_document_path: 'plazaRegions/' + data.id,
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.title || data.name),
        summary: sanitizeText(data.summary || data.description).slice(0, 600),
        body: sanitizeText(data.description),
        region: sanitizeText(data.region || data.name || 'Global'),
        category: 'region',
        tags: normalizeTags([
            'plaza',
            'region',
            data.slug,
            data.name,
            data.country,
            data.city,
            ...(safeArray(data.tags))
        ]),
        public_meta: {
            name: sanitizeText(data.name),
            slug: sanitizeText(data.slug),
            country: sanitizeText(data.country),
            city: sanitizeText(data.city),
            memberCount: Number.isFinite(Number(data.memberCount)) ? Number(data.memberCount) : 0
        },
        private_meta: {},
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

    if (error) throw new Error('Plaza directory/region lookup failed: ' + error.message);
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

        if (error) throw new Error('Plaza directory/region update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza directory/region insert failed: ' + error.message);
    return data;
}

function mapDirectoryRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        userId: sanitizeText(data.userId || row.owner_user_id || ''),
        firebaseUid: sanitizeText(data.firebaseUid || row.target_user_id || ''),
        email: sanitizeText(data.email || row.private_meta?.email || '').toLowerCase(),
        username: sanitizeText(data.username || row.public_meta?.username || ''),
        name: sanitizeText(data.name || row.title || 'YH Member'),
        headline: sanitizeText(data.headline || row.summary || ''),
        bio: sanitizeText(data.bio || row.body || ''),
        region: sanitizeText(data.region || row.region || 'Global'),
        avatarUrl: sanitizeText(data.avatarUrl || row.public_meta?.avatarUrl || ''),
        role: sanitizeText(data.role || row.category || ''),
        skills: safeArray(data.skills || row.public_meta?.skills),
        services: safeArray(data.services || row.public_meta?.services),
        tags: safeArray(data.tags || row.tags),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function mapRegionRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        name: sanitizeText(data.name || row.public_meta?.name || row.title || 'Plaza Region'),
        slug: sanitizeText(data.slug || row.public_meta?.slug || ''),
        title: sanitizeText(data.title || row.title || data.name || 'Plaza Region'),
        description: sanitizeText(data.description || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),
        country: sanitizeText(data.country || row.public_meta?.country || ''),
        city: sanitizeText(data.city || row.public_meta?.city || ''),
        region: sanitizeText(data.region || row.region || data.name || 'Global'),
        memberCount: Number.isFinite(Number(data.memberCount || row.public_meta?.memberCount))
            ? Number(data.memberCount || row.public_meta?.memberCount)
            : 0,
        tags: safeArray(data.tags || row.tags),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importDirectoryProfile(id = '', payload = {}) {
    const row = buildDirectoryRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapDirectoryRow(await upsertRecord(row));
}

async function importRegion(id = '', payload = {}) {
    const row = buildRegionRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapRegionRow(await upsertRecord(row));
}

async function upsertDirectoryProfile(payload = {}) {
    return importDirectoryProfile(
        payload.id || payload.userId || payload.firebaseUid || payload.uid || buildId('plaza_directory'),
        payload
    );
}

async function createRegion(payload = {}) {
    return importRegion(payload.id || payload.slug || buildId('plaza_region'), payload);
}

async function listDirectory(limit = 80) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 80), 160));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'directory_profile')
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza directory list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapDirectoryRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function listRegions(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'region')
        .order('title', { ascending: true, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza regions list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapRegionRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
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

    if (error) throw new Error('Plaza directory/region delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    buildDirectoryRow,
    buildRegionRow,
    importDirectoryProfile,
    importRegion,
    upsertDirectoryProfile,
    createRegion,
    listDirectory,
    listRegions,
    deleteRecord,
    mapDirectoryRow,
    mapRegionRow
};
