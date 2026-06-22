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

function normalizeMeetup(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_meetup'));

    const title = sanitizeText(
        input.title ||
        input.name ||
        input.subject ||
        'Plaza meetup'
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
        description,
        summary: sanitizeText(input.summary || description).slice(0, 600),

        meetupType: sanitizeText(input.meetupType || input.type || 'community'),
        format: sanitizeText(input.format || input.meetingFormat || 'online'),
        location: sanitizeText(input.location || input.venue || ''),
        meetingUrl: sanitizeText(input.meetingUrl || input.url || input.link || ''),
        region: sanitizeText(input.region || 'Global') || 'Global',

        startAt: toIso(input.startAt || input.startsAt || input.date || input.scheduledAt),
        endAt: toIso(input.endAt || input.endsAt),

        hostId: sanitizeText(input.hostId || input.authorId || input.createdByUid || input.ownerUid || ''),
        hostFirebaseUid: sanitizeText(input.hostFirebaseUid || input.firebaseUid || ''),
        hostEmail: sanitizeText(input.hostEmail || input.authorEmail || input.createdByEmail || '').toLowerCase(),
        hostName: sanitizeText(input.hostName || input.authorName || input.createdByName || 'YH Member'),

        attendees: safeArray(input.attendees),
        attendeeCount: Number.isFinite(Number(input.attendeeCount)) ? Number(input.attendeeCount) : safeArray(input.attendees).length,

        patronStatus: normalizeStatus(input.patronStatus || input.patronReviewStatus || 'none'),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),

        tags: normalizeTags([
            ...(safeArray(input.tags)),
            input.region,
            input.type,
            input.meetupType,
            input.format
        ]),

        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildMeetupRow(input = {}) {
    const data = normalizeMeetup(input);

    return {
        record_type: 'meetup',
        source_collection_path: 'plazaMeetups',
        source_document_id: data.id,
        source_document_path: 'plazaMeetups/' + data.id,

        owner_user_id: sanitizeText(data.hostId || data.hostFirebaseUid),
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),

        title: sanitizeText(data.title),
        summary: sanitizeText(data.summary || data.description).slice(0, 600),
        body: sanitizeText(data.description),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.meetupType || 'meetup'),
        tags: normalizeTags([
            'plaza',
            'meetup',
            data.region,
            data.meetupType,
            data.format,
            ...(safeArray(data.tags))
        ]),

        public_meta: {
            name: sanitizeText(data.name),
            meetupType: sanitizeText(data.meetupType),
            format: sanitizeText(data.format),
            location: sanitizeText(data.location),
            meetingUrl: sanitizeText(data.meetingUrl),
            startAt: sanitizeText(data.startAt),
            endAt: sanitizeText(data.endAt),
            hostName: sanitizeText(data.hostName),
            attendeeCount: Number.isFinite(Number(data.attendeeCount)) ? Number(data.attendeeCount) : 0,
            patronStatus: sanitizeText(data.patronStatus)
        },

        private_meta: {
            hostEmail: sanitizeText(data.hostEmail),
            hostFirebaseUid: sanitizeText(data.hostFirebaseUid),
            attendees: safeArray(data.attendees)
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

    if (error) throw new Error('Plaza meetup lookup failed: ' + error.message);
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

        if (error) throw new Error('Plaza meetup update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza meetup insert failed: ' + error.message);
    return data;
}

function mapMeetupRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        title: sanitizeText(data.title || row.title || 'Plaza meetup'),
        name: sanitizeText(data.name || row.public_meta?.name || data.title || row.title || 'Plaza meetup'),
        description: sanitizeText(data.description || row.body || ''),
        summary: sanitizeText(data.summary || row.summary || ''),

        meetupType: sanitizeText(data.meetupType || row.public_meta?.meetupType || row.category || 'community'),
        format: sanitizeText(data.format || row.public_meta?.format || 'online'),
        location: sanitizeText(data.location || row.public_meta?.location || ''),
        meetingUrl: sanitizeText(data.meetingUrl || row.public_meta?.meetingUrl || ''),
        region: sanitizeText(data.region || row.region || 'Global'),

        startAt: toIso(data.startAt || row.public_meta?.startAt || ''),
        endAt: toIso(data.endAt || row.public_meta?.endAt || ''),

        hostId: sanitizeText(data.hostId || row.owner_user_id || ''),
        hostFirebaseUid: sanitizeText(data.hostFirebaseUid || row.private_meta?.hostFirebaseUid || ''),
        hostEmail: sanitizeText(data.hostEmail || row.private_meta?.hostEmail || '').toLowerCase(),
        hostName: sanitizeText(data.hostName || row.public_meta?.hostName || 'YH Member'),

        attendees: safeArray(data.attendees || row.private_meta?.attendees),
        attendeeCount: Number.isFinite(Number(data.attendeeCount || row.public_meta?.attendeeCount))
            ? Number(data.attendeeCount || row.public_meta?.attendeeCount)
            : safeArray(data.attendees || row.private_meta?.attendees).length,

        patronStatus: normalizeStatus(data.patronStatus || row.public_meta?.patronStatus || 'none'),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status),

        tags: safeArray(data.tags || row.tags),

        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importMeetup(id = '', payload = {}) {
    const row = buildMeetupRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapMeetupRow(await upsertRecord(row));
}

async function createMeetup(payload = {}) {
    return importMeetup(payload.id || buildId('plaza_meetup'), payload);
}

async function listMeetups(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'meetup')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza meetups list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapMeetupRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function updateMeetup(id = '', patch = {}) {
    const existing = await getExisting('meetup', id);

    if (!existing) {
        throw new Error('Plaza meetup not found.');
    }

    const current = existing.data && typeof existing.data === 'object' ? existing.data : {};
    const nextData = {
        ...current,
        ...patch,
        id: sanitizeText(id),
        updatedAt: nowIso()
    };

    return importMeetup(id, nextData);
}

async function updatePatronMeetupStatus(id = '', patronStatus = '', extra = {}) {
    return updateMeetup(id, {
        ...extra,
        patronStatus: sanitizeText(patronStatus || 'none')
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

    if (error) throw new Error('Plaza meetup delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    buildMeetupRow,
    importMeetup,
    createMeetup,
    listMeetups,
    updateMeetup,
    updatePatronMeetupStatus,
    deleteRecord,
    mapMeetupRow
};
