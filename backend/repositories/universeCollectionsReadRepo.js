const { collectionsFirestore } = require('../../config/firebaseAdmin');

const INDEX_COLLECTION = 'yhUniverseCollectionIndex';
const RESOURCES_COLLECTION = 'yhUniverseCollections';
const FEDERATION_LEAD_INVENTORY_COLLECTION = 'yhFederationLeadInventory';

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
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return cleanText(value);
}

function requireCollectionsFirestore() {
    if (!collectionsFirestore) {
        const error = new Error('Collections Firestore is not configured. Missing YH_COLLECTIONS_FIREBASE_SERVICE_ACCOUNT_BASE64.');
        error.statusCode = 503;
        throw error;
    }

    return collectionsFirestore;
}

function getViewerId(viewer = {}) {
    return cleanText(viewer.id || viewer.firebaseUid || viewer.uid);
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
    if (clean === 'rejected') return 'rejected';
    if (clean === 'archived') return 'archived';
    if (clean === 'revision_requested') return 'revision_requested';
    return clean || 'pending_review';
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

function mapIndexDoc(doc) {
    const data = doc.data() || {};

    return {
        id: doc.id,
        itemType: cleanLower(data.itemType || 'input'),
        title: cleanText(data.title || 'Untitled collection item'),
        summary: cleanText(data.summary || data.description || ''),

        sourceDivision: cleanLower(data.sourceDivision || 'universe'),
        targetDivision: cleanLower(data.targetDivision || data.accessLevel || data.sourceDivision || 'universe'),
        sourceFeature: cleanLower(data.sourceFeature || 'general'),
        sourceSystem: cleanText(data.sourceSystem || ''),
        sourceRecordId: cleanText(data.sourceRecordId || ''),
        sourceRecordPath: cleanText(data.sourceRecordPath || ''),

        accessLevel: cleanLower(data.accessLevel || 'all_approved_members'),
        visibility: cleanLower(data.visibility || 'division_members'),
        reviewStatus: normalizeStatus(data.reviewStatus),
        listingStatus: normalizeStatus(data.listingStatus),

        category: cleanText(data.category || ''),
        tags: normalizeTags(data.tags),

        createdByUid: cleanText(data.createdByUid || ''),
        createdByEmail: cleanText(data.createdByEmail || ''),
        createdByName: cleanText(data.createdByName || 'YH Member'),
        createdByUsername: cleanText(data.createdByUsername || ''),
        createdByAvatar: cleanText(data.createdByAvatar || ''),

        mirrorTargetCollection: cleanText(data.mirrorTargetCollection || ''),
        mirrorTargetId: cleanText(data.mirrorTargetId || ''),

        publicMeta: data.publicMeta && typeof data.publicMeta === 'object'
            ? data.publicMeta
            : {},

        privateMetaAvailable: data.privateMetaAvailable === true,
        monetized: data.monetized === true,

        resourceUrl: cleanText(data.resourceUrl || data.publicMeta?.resourceUrl || ''),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt || data.lastMirroredAt || data.createdAt),

        source: 'index'
    };
}

function mapResourceDoc(doc) {
    const data = doc.data() || {};

    return {
        id: doc.id,
        itemType: cleanLower(data.resourceType || 'resource'),
        title: cleanText(data.title || 'Untitled resource'),
        summary: cleanText(data.description || ''),

        sourceDivision: cleanLower(data.sourceDivision || 'universe'),
        targetDivision: cleanLower(data.accessLevel || data.sourceDivision || 'universe'),
        sourceFeature: 'resources',
        sourceSystem: 'yh_universe_collections',
        sourceRecordId: doc.id,
        sourceRecordPath: `${RESOURCES_COLLECTION}/${doc.id}`,

        accessLevel: cleanLower(data.accessLevel || 'all_approved_members'),
        visibility: cleanLower(data.visibility || 'division_members'),
        reviewStatus: normalizeStatus(data.reviewStatus),
        listingStatus: normalizeStatus(data.listingStatus || data.reviewStatus),

        category: cleanText(data.category || ''),
        tags: normalizeTags(data.tags),

        createdByUid: cleanText(data.createdByUid || ''),
        createdByEmail: cleanText(data.createdByEmail || ''),
        createdByName: cleanText(data.createdByName || 'YH Member'),
        createdByUsername: cleanText(data.createdByUsername || ''),
        createdByAvatar: cleanText(data.createdByAvatar || ''),

        publicMeta: {
            resourceType: cleanLower(data.resourceType || 'resource'),
            resourceUrl: cleanText(data.resourceUrl || ''),
            fileUrl: cleanText(data.fileUrl || ''),
            imageUrl: cleanText(data.imageUrl || '')
        },

        privateMetaAvailable: false,
        monetized: false,

        resourceUrl: cleanText(data.resourceUrl || ''),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt || data.createdAt),

        source: 'resource'
    };
}

function mapLeadInventoryDoc(doc) {
    const data = doc.data() || {};
    const publicListing = data.publicListing && typeof data.publicListing === 'object'
        ? data.publicListing
        : {};

    return {
        id: doc.id,
        itemType: 'lead',
        title: cleanText(data.title || publicListing.title || 'Federation lead'),
        summary: cleanText(data.summary || publicListing.summary || ''),

        sourceDivision: cleanLower(data.sourceDivision || 'academy'),
        targetDivision: cleanLower(data.targetDivision || 'federation'),
        sourceFeature: cleanLower(data.sourceFeature || 'lead_missions'),
        sourceSystem: cleanText(data.sourceSystem || 'academy_lead_missions'),
        sourceRecordId: cleanText(data.sourceRecordId || ''),
        sourceRecordPath: cleanText(data.sourceRecordPath || ''),

        accessLevel: cleanLower(data.accessLevel || 'federation'),
        visibility: cleanLower(data.visibility || 'admin_only'),
        reviewStatus: normalizeStatus(data.reviewStatus),
        listingStatus: normalizeStatus(data.listingStatus),

        category: 'Federation Lead Marketplace',
        tags: normalizeTags([
            'lead',
            'federation',
            publicListing.tier,
            publicListing.contactRole,
            publicListing.city,
            publicListing.country,
            publicListing.strategicValue
        ]),

        createdByUid: cleanText(data.createdByUid || data.operatorUid || ''),
        createdByEmail: cleanText(data.createdByEmail || data.operatorEmail || ''),
        createdByName: cleanText(data.createdByName || data.operatorName || 'Academy Operator'),
        createdByUsername: cleanText(data.createdByUsername || ''),
        createdByAvatar: cleanText(data.createdByAvatar || ''),

        publicMeta: {
            title: cleanText(publicListing.title || data.title || ''),
            summary: cleanText(publicListing.summary || data.summary || ''),
            tier: cleanText(publicListing.tier || ''),
            contactRole: cleanText(publicListing.contactRole || ''),
            contactType: cleanText(publicListing.contactType || ''),
            industry: cleanText(publicListing.industry || ''),
            city: cleanText(publicListing.city || ''),
            country: cleanText(publicListing.country || ''),
            location: cleanText(publicListing.location || ''),
            strategicValue: cleanText(publicListing.strategicValue || ''),
            priority: cleanText(publicListing.priority || ''),
            pipelineStage: cleanText(publicListing.pipelineStage || ''),
            hasEmail: publicListing.hasEmail === true,
            hasPhone: publicListing.hasPhone === true,
            hasContactName: publicListing.hasContactName === true,
            companyLabel: cleanText(publicListing.companyLabel || ''),
            buyerPriceAmount: toNumber(publicListing.buyerPriceAmount, 0),
            sellerPriceAmount: toNumber(publicListing.sellerPriceAmount, 0),
            currency: cleanText(publicListing.currency || data.pricing?.currency || 'USD').toUpperCase()
        },

        privateMetaAvailable: true,
        monetized: data.saleEnabled === true || toNumber(publicListing.buyerPriceAmount, 0) > 0,

        resourceUrl: '',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt || data.lastMirroredAt || data.createdAt),

        source: 'lead_inventory'
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

async function getCollectionDocs(collectionName, limit = 300) {
    const db = requireCollectionsFirestore();
    const safeLimit = Math.max(1, Math.min(500, Number(limit || 300)));
    const snap = await db.collection(collectionName).limit(safeLimit).get();
    return snap.docs;
}

async function listIndexItems(viewer = {}, filters = {}) {
    const viewerId = getViewerId(viewer);

    const [indexDocs, resourceDocs] = await Promise.all([
        getCollectionDocs(INDEX_COLLECTION, filters.limit || 300).catch(() => []),
        getCollectionDocs(RESOURCES_COLLECTION, filters.limit || 300).catch(() => [])
    ]);

    const merged = [
        ...buildAcademyMissionPlaybookCollectionItems(),
        ...indexDocs.map(mapIndexDoc),
        ...resourceDocs.map(mapResourceDoc)
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
    const docs = await getCollectionDocs(FEDERATION_LEAD_INVENTORY_COLLECTION, filters.limit || 300).catch(() => []);

    return sortNewestFirst(
        docs
            .map(mapLeadInventoryDoc)
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
        stats: buildStats(items, leads)
    };
}

module.exports = {
    getBootstrap,
    listIndexItems,
    listFederationLeadInventory
};