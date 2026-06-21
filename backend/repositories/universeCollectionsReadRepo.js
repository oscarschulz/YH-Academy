const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE_NAME = 'yhu_universe_collection_catalog';

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
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return cleanText(value);
}

function normalizeTags(value = []) {
    if (Array.isArray(value)) {
        return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 16);
    }

    return String(value || '')
        .split(',')
        .map((item) => cleanText(item))
        .filter(Boolean)
        .slice(0, 16);
}

function normalizeStatus(value = '') {
    const clean = cleanLower(value || '');
    if (clean === 'approved') return 'approved';
    if (clean === 'listed') return 'listed';
    if (clean === 'pending_review') return 'pending_review';
    if (clean === 'pending_admin_review') return 'pending_admin_review';
    if (clean === 'pending') return 'pending_review';
    if (clean === 'rejected') return 'rejected';
    if (clean === 'archived') return 'archived';
    if (clean === 'revision_requested') return 'revision_requested';
    return clean || 'pending_review';
}

function getViewerId(viewer = {}) {
    return cleanText(viewer.id || viewer.firebaseUid || viewer.uid);
}

function canViewerSeeItem(item = {}, viewer = {}) {
    const viewerId = getViewerId(viewer);
    const ownerId = cleanText(item.createdByUid || item.operatorUid || '');
    const isOwner = viewerId && ownerId && viewerId === ownerId;

    if (isOwner) return true;

    const visibility = cleanLower(item.visibility || '');
    if (visibility === 'admin_only') return false;

    const reviewStatus = normalizeStatus(item.reviewStatus);
    const listingStatus = normalizeStatus(item.listingStatus);

    return (
        reviewStatus === 'approved' ||
        listingStatus === 'listed' ||
        listingStatus === 'approved'
    );
}

function mapCatalogRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const publicMeta = row.public_meta && typeof row.public_meta === 'object'
        ? row.public_meta
        : data.publicMeta && typeof data.publicMeta === 'object'
            ? data.publicMeta
            : {};

    return {
        id: cleanText(row.source_document_id || row.id),
        itemType: cleanLower(row.item_type || data.itemType || data.resourceType || 'input'),
        title: cleanText(row.title || data.title || publicMeta.title || 'Untitled collection item'),
        summary: cleanText(row.summary || data.summary || data.description || publicMeta.summary || ''),

        sourceDivision: cleanLower(row.source_division || data.sourceDivision || 'universe'),
        targetDivision: cleanLower(row.target_division || data.targetDivision || data.accessLevel || data.sourceDivision || 'universe'),
        sourceFeature: cleanLower(row.source_feature || data.sourceFeature || 'general'),
        sourceSystem: cleanText(row.source_system || data.sourceSystem || ''),
        sourceRecordId: cleanText(row.source_record_id || data.sourceRecordId || ''),
        sourceRecordPath: cleanText(row.source_record_path || data.sourceRecordPath || row.source_document_path || ''),

        accessLevel: cleanLower(row.access_level || data.accessLevel || 'all_approved_members'),
        visibility: cleanLower(row.visibility || data.visibility || 'division_members'),
        reviewStatus: normalizeStatus(row.review_status || data.reviewStatus),
        listingStatus: normalizeStatus(row.listing_status || data.listingStatus || data.reviewStatus),

        category: cleanText(row.category || data.category || ''),
        tags: normalizeTags(row.tags || data.tags),

        createdByUid: cleanText(row.created_by_uid || data.createdByUid || data.operatorUid || ''),
        createdByEmail: cleanText(row.created_by_email || data.createdByEmail || data.operatorEmail || ''),
        createdByName: cleanText(row.created_by_name || data.createdByName || data.operatorName || 'YH Member'),
        createdByUsername: cleanText(row.created_by_username || data.createdByUsername || ''),
        createdByAvatar: cleanText(row.created_by_avatar || data.createdByAvatar || ''),

        mirrorTargetCollection: cleanText(row.mirror_target_collection || data.mirrorTargetCollection || ''),
        mirrorTargetId: cleanText(row.mirror_target_id || data.mirrorTargetId || ''),

        publicMeta,
        privateMetaAvailable: row.private_meta_available === true || data.privateMetaAvailable === true,
        monetized: row.monetized === true || data.monetized === true || data.saleEnabled === true,

        resourceUrl: cleanText(row.resource_url || data.resourceUrl || publicMeta.resourceUrl || ''),
        fileUrl: cleanText(row.file_url || data.fileUrl || publicMeta.fileUrl || ''),
        imageUrl: cleanText(row.image_url || data.imageUrl || publicMeta.imageUrl || ''),

        buyerPriceAmount: toNumber(row.buyer_price_amount ?? publicMeta.buyerPriceAmount, 0),
        sellerPriceAmount: toNumber(row.seller_price_amount ?? publicMeta.sellerPriceAmount, 0),
        currency: cleanText(row.currency || publicMeta.currency || data.currency || 'USD').toUpperCase(),

        createdAt: toIso(row.created_at_source || data.createdAt || row.created_at),
        updatedAt: toIso(row.updated_at_source || data.updatedAt || data.lastMirroredAt || row.updated_at || row.created_at_source),

        source: cleanText(row.record_source || 'index')
    };
}

function matchesFilters(item = {}, filters = {}) {
    const mode = cleanLower(filters.mode || 'all');
    const q = cleanLower(filters.q || filters.search || '');
    const division = cleanLower(filters.division || '');
    const type = cleanLower(filters.type || '');
    const status = cleanLower(filters.status || '');

    if (mode === 'resources' && item.itemType === 'lead') return false;
    if (mode === 'leads' && item.itemType !== 'lead') return false;
    if (mode === 'opportunities' && item.itemType !== 'opportunity') return false;
    if (mode === 'mine' && cleanText(item.createdByUid) !== cleanText(filters.viewerId)) return false;
    if (mode === 'pending' && item.reviewStatus !== 'pending_review') return false;

    if (division && division !== 'all') {
        if (item.sourceDivision !== division && item.targetDivision !== division && item.accessLevel !== division) {
            return false;
        }
    }

    if (type && type !== 'all' && item.itemType !== type) return false;
    if (status && status !== 'all' && item.reviewStatus !== status && item.listingStatus !== status) return false;

    if (q) {
        const haystack = [
            item.title,
            item.summary,
            item.itemType,
            item.sourceDivision,
            item.targetDivision,
            item.category,
            item.createdByName,
            ...(Array.isArray(item.tags) ? item.tags : [])
        ].join(' ').toLowerCase();

        if (!haystack.includes(q)) return false;
    }

    return true;
}

function sortNewestFirst(items = []) {
    return [...items].sort((a, b) => {
        const left = String(b.updatedAt || b.createdAt || '');
        const right = String(a.updatedAt || a.createdAt || '');
        return left.localeCompare(right);
    });
}

function buildStats(items = [], leads = []) {
    return {
        totalItems: items.length,
        totalLeads: leads.length,
        pendingItems: items.filter((item) => item.reviewStatus === 'pending_review').length,
        approvedItems: items.filter((item) => item.reviewStatus === 'approved' || item.listingStatus === 'listed').length,
        monetizedItems: items.filter((item) => item.monetized === true).length,
        missionPlaybooks: items.filter((item) => item.itemType === 'mission_playbook').length
    };
}

function buildAcademyMissionPlaybookCollectionItems() {
    const nowIso = '2026-04-18T00:00:00.000Z';

    return [
        {
            id: 'academy_mission_playbook_three_handshakes_away',
            itemType: 'mission_playbook',
            title: '3-Handshakes-Away Mission',
            summary: 'A social outreach playbook for finding valuable contacts through Instagram/X connection chains, mutual links, replies, and directions.',
            sourceDivision: 'academy',
            targetDivision: 'academy',
            sourceFeature: 'missions',
            sourceSystem: 'academy_mission_playbooks',
            sourceRecordId: 'three-handshakes-away',
            sourceRecordPath: 'academy/mission-playbooks/three-handshakes-away',
            accessLevel: 'academy',
            visibility: 'division_members',
            reviewStatus: 'approved',
            listingStatus: 'listed',
            category: 'Academy Mission Playbook',
            tags: ['academy', 'missions', 'outreach', 'social', 'federation leads'],
            createdByUid: 'system',
            createdByEmail: '',
            createdByName: 'YH System',
            createdByUsername: 'system',
            createdByAvatar: '',
            publicMeta: {
                missionKey: 'three-handshakes-away',
                reward: '$9/$6/$3 per accepted Federation lead',
                bonus: '$28.12 for 28 accepted leads in one month'
            },
            privateMetaAvailable: false,
            monetized: false,
            resourceUrl: '',
            createdAt: nowIso,
            updatedAt: nowIso,
            source: 'mission_playbook'
        },
        {
            id: 'academy_mission_playbook_cold_calling',
            itemType: 'mission_playbook',
            title: 'Cold-Calling Mission',
            summary: 'A direct outreach playbook for calling companies, collecting direct contacts, building rapport, and warming Federation leads.',
            sourceDivision: 'academy',
            targetDivision: 'academy',
            sourceFeature: 'missions',
            sourceSystem: 'academy_mission_playbooks',
            sourceRecordId: 'cold-calling',
            sourceRecordPath: 'academy/mission-playbooks/cold-calling',
            accessLevel: 'academy',
            visibility: 'division_members',
            reviewStatus: 'approved',
            listingStatus: 'listed',
            category: 'Academy Mission Playbook',
            tags: ['academy', 'missions', 'cold calling', 'company outreach', 'federation leads'],
            createdByUid: 'system',
            createdByEmail: '',
            createdByName: 'YH System',
            createdByUsername: 'system',
            createdByAvatar: '',
            publicMeta: {
                missionKey: 'cold-calling',
                reward: '$9/$6/$3 per accepted Federation lead',
                bonus: '$28.12 for 28 accepted leads in one month'
            },
            privateMetaAvailable: false,
            monetized: false,
            resourceUrl: '',
            createdAt: nowIso,
            updatedAt: nowIso,
            source: 'mission_playbook'
        }
    ];
}

async function fetchCatalogRows(recordSources = [], limit = 300) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit || 300)));

    let query = yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (Array.isArray(recordSources) && recordSources.length) {
        query = query.in('record_source', recordSources);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Supabase Universe collections read failed: ${error.message}`);
    }

    return Array.isArray(data) ? data : [];
}

async function listIndexItems(viewer = {}, filters = {}) {
    const viewerId = getViewerId(viewer);
    const rows = await fetchCatalogRows(['index', 'resource'], filters.limit || 300);

    const merged = [
        ...buildAcademyMissionPlaybookCollectionItems(),
        ...rows.map(mapCatalogRow)
    ];

    const deduped = Array.from(
        new Map(merged.map((item) => [`${item.source}:${item.id}`, item])).values()
    );

    return sortNewestFirst(
        deduped
            .filter((item) => canViewerSeeItem(item, viewer))
            .filter((item) => matchesFilters(item, { ...filters, viewerId }))
    ).slice(0, Math.max(1, Math.min(200, Number(filters.limit || 120))));
}

async function listFederationLeadInventory(viewer = {}, filters = {}) {
    const viewerId = getViewerId(viewer);
    const rows = await fetchCatalogRows(['lead_inventory'], filters.limit || 300);

    return sortNewestFirst(
        rows
            .map(mapCatalogRow)
            .filter((item) => canViewerSeeItem(item, viewer))
            .filter((item) => matchesFilters(item, { ...filters, mode: 'leads', viewerId }))
    ).slice(0, Math.max(1, Math.min(200, Number(filters.limit || 80))));
}

async function getBootstrap(viewer = {}, filters = {}) {
    const [items, leads] = await Promise.all([
        listIndexItems(viewer, filters),
        listFederationLeadInventory(viewer, filters)
    ]);

    return {
        items,
        leads,
        stats: buildStats(items, leads),
        source: 'supabase'
    };
}

module.exports = {
    getBootstrap,
    listIndexItems,
    listFederationLeadInventory
};
