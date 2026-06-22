const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const FEED_TABLE = 'yhu_plaza_feed_posts';
const OPPORTUNITIES_TABLE = 'yhu_plaza_opportunities';

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

function safeArray(value = []) {
    return Array.isArray(value) ? value : [];
}

function normalizeStatus(value = '', fallback = 'active') {
    const clean = cleanLower(value || fallback);
    return clean || fallback;
}

function normalizeFeedPayload(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_feed'));

    const data = {
        ...input,
        id,
        type: sanitizeText(input.type || 'update'),
        member: sanitizeText(input.member || input.authorName || 'YH Member'),
        source: sanitizeText(input.source || 'plaza'),
        division: sanitizeText(input.division || 'both'),
        region: sanitizeText(input.region || 'Global'),
        title: sanitizeText(input.title || input.tag || 'Plaza update'),
        text: sanitizeText(input.text || input.body || ''),
        tag: sanitizeText(input.tag || input.type || 'Update'),
        action: sanitizeText(input.action || 'Open'),
        authorId: sanitizeText(input.authorId || input.createdByUid || ''),
        authorFirebaseUid: sanitizeText(input.authorFirebaseUid || input.firebaseUid || ''),
        authorEmail: sanitizeText(input.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || input.member || 'YH Member'),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };

    return data;
}

function normalizeOpportunityPayload(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_opp'));

    const data = {
        ...input,
        id,
        type: sanitizeText(input.type || 'Opportunity'),
        region: sanitizeText(input.region || 'Global'),
        title: sanitizeText(input.title || 'Plaza opportunity'),
        text: sanitizeText(input.text || input.description || ''),
        action: sanitizeText(input.action || 'Open Opportunity Detail'),

        economyMode: sanitizeText(input.economyMode || 'not_sure'),
        currency: sanitizeText(input.currency || 'USD').toUpperCase() || 'USD',
        budgetMin: toNumber(input.budgetMin, 0),
        budgetMax: toNumber(input.budgetMax, 0),
        commissionRate: toNumber(input.commissionRate, 0),
        federationEscalation: sanitizeText(input.federationEscalation || 'none'),
        monetizationNote: sanitizeText(input.monetizationNote || ''),

        marketplaceMode: sanitizeText(input.marketplaceMode || 'marketplace'),
        serviceCategory: sanitizeText(input.serviceCategory || ''),
        serviceTags: safeArray(input.serviceTags).map(sanitizeText).filter(Boolean),
        servicePriceType: sanitizeText(input.servicePriceType || ''),
        serviceDeliveryTime: sanitizeText(input.serviceDeliveryTime || ''),
        serviceProviderType: sanitizeText(input.serviceProviderType || ''),
        serviceRequirements: sanitizeText(input.serviceRequirements || ''),
        serviceOutcome: sanitizeText(input.serviceOutcome || ''),

        sourceDivision: sanitizeText(input.sourceDivision || 'plaza'),

        authorId: sanitizeText(input.authorId || input.createdByUid || ''),
        authorFirebaseUid: sanitizeText(input.authorFirebaseUid || input.firebaseUid || ''),
        authorEmail: sanitizeText(input.authorEmail || '').toLowerCase(),
        authorName: sanitizeText(input.authorName || 'YH Member'),

        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };

    return data;
}

function buildRow(tableType = 'feed', payload = {}) {
    const data = tableType === 'opportunity'
        ? normalizeOpportunityPayload(payload)
        : normalizeFeedPayload(payload);

    const pathRoot = tableType === 'opportunity' ? 'plazaOpportunities' : 'plazaFeedPosts';

    return {
        source_document_id: data.id,
        source_document_path: pathRoot + '/' + data.id,
        status: normalizeStatus(data.status),
        review_status: normalizeStatus(data.reviewStatus || data.status),
        title: sanitizeText(data.title),
        text: sanitizeText(data.text),
        region: sanitizeText(data.region || 'Global'),
        type: sanitizeText(data.type),
        author_id: sanitizeText(data.authorId),
        author_email: sanitizeText(data.authorEmail).toLowerCase(),
        author_name: sanitizeText(data.authorName),
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso(),
        data
    };
}

async function getExistingBySourceId(table, sourceDocumentId = '') {
    const cleanId = sanitizeText(sourceDocumentId);
    if (!cleanId) return null;

    const { data, error } = await yhuSupabaseAdmin
        .from(table)
        .select('*')
        .eq('source_document_id', cleanId)
        .maybeSingle();

    if (error) throw new Error('Plaza Supabase lookup failed: ' + error.message);

    return data || null;
}

async function upsertRow(table, row = {}) {
    const existing = await getExistingBySourceId(table, row.source_document_id).catch(() => null);

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(table)
            .update(row)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw new Error('Plaza Supabase update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(table)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza Supabase insert failed: ' + error.message);
    return data;
}

function mapFeedRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : row;

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        type: sanitizeText(data.type || row.type || 'update'),
        member: sanitizeText(data.member || data.authorName || row.author_name || 'YH Member'),
        source: sanitizeText(data.source || 'plaza'),
        division: sanitizeText(data.division || 'both'),
        region: sanitizeText(data.region || row.region || 'Global'),
        title: sanitizeText(data.title || row.title || data.tag || 'Plaza update'),
        text: sanitizeText(data.text || row.text || ''),
        tag: sanitizeText(data.tag || data.type || 'Update'),
        action: sanitizeText(data.action || 'Open'),
        authorId: sanitizeText(data.authorId || row.author_id || ''),
        authorFirebaseUid: sanitizeText(data.authorFirebaseUid || ''),
        authorEmail: sanitizeText(data.authorEmail || row.author_email || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || row.author_name || data.member || 'YH Member'),
        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || data.status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function mapOpportunityRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : row;

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        type: sanitizeText(data.type || row.type || 'Opportunity'),
        region: sanitizeText(data.region || row.region || 'Global'),
        title: sanitizeText(data.title || row.title || 'Plaza opportunity'),
        text: sanitizeText(data.text || row.text || data.description || ''),
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

        authorId: sanitizeText(data.authorId || row.author_id || ''),
        authorFirebaseUid: sanitizeText(data.authorFirebaseUid || ''),
        authorEmail: sanitizeText(data.authorEmail || row.author_email || '').toLowerCase(),
        authorName: sanitizeText(data.authorName || row.author_name || 'YH Member'),

        status: normalizeStatus(data.status || row.status),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || data.status),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function listFeed(limit = 40) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 40), 80));

    const { data, error } = await yhuSupabaseAdmin
        .from(FEED_TABLE)
        .select('*')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza feed Supabase list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapFeedRow)
        .filter((item) => normalizeStatus(item.status || 'active') === 'active');
}

async function createFeedPost(input = {}) {
    const payload = normalizeFeedPayload({
        ...input,
        id: input.id || buildId('plaza_feed')
    });

    const saved = await upsertRow(FEED_TABLE, buildRow('feed', payload));
    return mapFeedRow(saved);
}

async function importFeedPost(id = '', payload = {}) {
    const normalized = normalizeFeedPayload({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    const saved = await upsertRow(FEED_TABLE, buildRow('feed', normalized));
    return mapFeedRow(saved);
}

async function listOpportunities(limit = 60) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 60), 100));

    const { data, error } = await yhuSupabaseAdmin
        .from(OPPORTUNITIES_TABLE)
        .select('*')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza opportunities Supabase list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapOpportunityRow)
        .filter((item) => normalizeStatus(item.status || 'active') === 'active');
}

async function createOpportunity(input = {}) {
    const payload = normalizeOpportunityPayload({
        ...input,
        id: input.id || buildId('plaza_opp')
    });

    const saved = await upsertRow(OPPORTUNITIES_TABLE, buildRow('opportunity', payload));
    return mapOpportunityRow(saved);
}

async function importOpportunity(id = '', payload = {}) {
    const normalized = normalizeOpportunityPayload({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    const saved = await upsertRow(OPPORTUNITIES_TABLE, buildRow('opportunity', normalized));
    return mapOpportunityRow(saved);
}

async function deleteFeedPost(id = '') {
    const cleanId = sanitizeText(id);
    if (!cleanId) return;

    const { error } = await yhuSupabaseAdmin
        .from(FEED_TABLE)
        .delete()
        .eq('source_document_id', cleanId);

    if (error) throw new Error('Plaza feed Supabase delete failed: ' + error.message);
}

async function deleteOpportunity(id = '') {
    const cleanId = sanitizeText(id);
    if (!cleanId) return;

    const { error } = await yhuSupabaseAdmin
        .from(OPPORTUNITIES_TABLE)
        .delete()
        .eq('source_document_id', cleanId);

    if (error) throw new Error('Plaza opportunity Supabase delete failed: ' + error.message);
}

module.exports = {
    listFeed,
    createFeedPost,
    importFeedPost,
    deleteFeedPost,
    listOpportunities,
    createOpportunity,
    importOpportunity,
    deleteOpportunity,
    mapFeedRow,
    mapOpportunityRow
};
