const { collectionsFirestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const COLLECTION_NAME = 'yhUniverseCollections';

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

function requireCollectionsFirestore() {
    if (!collectionsFirestore) {
        const error = new Error('Collections Firestore is not configured. Missing YH_COLLECTIONS_FIREBASE_SERVICE_ACCOUNT_BASE64.');
        error.statusCode = 503;
        throw error;
    }

    return collectionsFirestore;
}

function collectionRef() {
    return requireCollectionsFirestore().collection(COLLECTION_NAME);
}

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
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
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

function mapCollectionDoc(doc) {
    const data = doc.data() || {};

    return {
        id: doc.id,

        title: cleanText(data.title),
        description: cleanText(data.description),

        resourceType: normalizeResourceType(data.resourceType),
        sourceDivision: normalizeDivision(data.sourceDivision),
        divisionScope: Array.isArray(data.divisionScope) ? data.divisionScope : [],

        category: cleanText(data.category),
        tags: Array.isArray(data.tags) ? data.tags : [],

        resourceUrl: cleanText(data.resourceUrl),
        fileUrl: cleanText(data.fileUrl),
        imageUrl: cleanText(data.imageUrl),

        visibility: cleanText(data.visibility || 'division_members'),
        accessLevel: normalizeAccessLevel(data.accessLevel),

        reviewStatus: normalizeReviewStatus(data.reviewStatus),

        createdByUid: cleanText(data.createdByUid),
        createdByEmail: cleanText(data.createdByEmail),
        createdByName: cleanText(data.createdByName),
        createdByUsername: cleanText(data.createdByUsername),
        createdByAvatar: cleanText(data.createdByAvatar),

        viewCount: Number(data.viewCount || 0),
        saveCount: Number(data.saveCount || 0),
        reportCount: Number(data.reportCount || 0),

        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
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

    const sourceDivision = normalizeDivision(input.sourceDivision || input.division || 'universe');
    const accessLevel = normalizeAccessLevel(input.accessLevel || sourceDivision || 'all_approved_members');
    const now = Timestamp.now();

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

        ...buildCreatorSnapshot(viewer),

        viewCount: 0,
        saveCount: 0,
        reportCount: 0,

        createdAt: now,
        updatedAt: now,
        approvedAt: null,
        approvedByUid: ''
    };

    const ref = await collectionRef().add(payload);
    const snap = await ref.get();

    return mapCollectionDoc(snap);
}

async function listCollections(viewer = {}, filters = {}) {
    const limit = Math.max(1, Math.min(200, Number(filters.limit || 80)));

    const snap = await collectionRef()
        .limit(250)
        .get();

    const sourceDivision = cleanLower(filters.sourceDivision || filters.division || '');
    const resourceType = cleanLower(filters.resourceType || '');
    const statusFilter = cleanLower(filters.reviewStatus || filters.status || '');
    const q = cleanLower(filters.q || filters.search || '');

    return snap.docs
        .map(mapCollectionDoc)
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

    const snap = await collectionRef().doc(cleanId).get();

    if (!snap.exists) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const item = mapCollectionDoc(snap);

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

    const ref = collectionRef().doc(cleanId);
    const snap = await ref.get();

    if (!snap.exists) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = mapCollectionDoc(snap);

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
        updatedAt: Timestamp.now(),
        approvedAt: null,
        approvedByUid: ''
    };

    await ref.set(payload, { merge: true });

    const nextSnap = await ref.get();
    return mapCollectionDoc(nextSnap);
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

    const ref = collectionRef().doc(cleanId);
    const snap = await ref.get();

    if (!snap.exists) {
        const error = new Error('Collection item not found.');
        error.statusCode = 404;
        throw error;
    }

    const current = mapCollectionDoc(snap);

    if (current.createdByUid !== viewerId) {
        const error = new Error('You can only delete your own collection items.');
        error.statusCode = 403;
        throw error;
    }

    await ref.delete();

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
    mapCollectionDoc
};