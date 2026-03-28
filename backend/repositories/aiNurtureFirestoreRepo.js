const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const nowTs = () => Timestamp.now();

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUrl(value) {
    const raw = sanitize(value);
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        parsed.hash = '';
        return parsed.toString();
    } catch (_) {
        return '';
    }
}

function hostnameFromUrl(value) {
    try {
        return new URL(value).hostname || '';
    } catch (_) {
        return '';
    }
}

const settingsDoc = () => firestore.collection('aiNurtureSettings').doc('main');
const sourcesCol = () => firestore.collection('aiNurtureSources');
const reviewsCol = () => firestore.collection('aiNurtureReviews');
const libraryCol = () => firestore.collection('aiNurtureLibrary');
const memoryCardsCol = () => firestore.collection('aiNurtureMemoryCards');
const contextPacksCol = () => firestore.collection('aiNurtureContextPacks');

function mapDoc(doc) {
    return { id: doc.id, ...(doc.data() || {}) };
}

async function getSettings() {
    const snap = await settingsDoc().get();
    if (!snap.exists) {
        const defaults = {
            featureEnabled: true,
            autoProcess: false,
            autoApprove: false,
            trustThreshold: 0.55,
            relevanceThreshold: 0.65,
            noveltyThreshold: 0.30,
            duplicationThreshold: 0.70,
            maxSummaryLength: 1200,
            blockedDomains: [],
            allowedDomains: [],
            updatedAt: nowTs(),
            createdAt: nowTs()
        };

        await settingsDoc().set(defaults, { merge: true });
        const fresh = await settingsDoc().get();
        return fresh.data() || defaults;
    }

    return snap.data() || {};
}

async function updateSettings(payload = {}) {
    await settingsDoc().set(
        {
            ...payload,
            updatedAt: nowTs()
        },
        { merge: true }
    );

    const snap = await settingsDoc().get();
    return snap.data() || {};
}

async function createSource(payload = {}) {
    const normalizedUrl = normalizeUrl(payload.originalUrl || payload.url);
    if (!normalizedUrl) {
        throw new Error('Valid URL is required.');
    }

    const existing = await sourcesCol()
        .where('canonicalUrl', '==', normalizedUrl)
        .limit(1)
        .get();

    if (!existing.empty) {
        return mapDoc(existing.docs[0]);
    }

    const ref = sourcesCol().doc();
    const doc = {
        sourceType: 'url',
        originalUrl: normalizedUrl,
        canonicalUrl: normalizedUrl,
        hostname: hostnameFromUrl(normalizedUrl),
        title: sanitize(payload.title),
        status: 'queued',
        queuePriority: toNumber(payload.queuePriority, 3),
        manualTags: Array.isArray(payload.manualTags) ? payload.manualTags.map((item) => sanitize(item)).filter(Boolean) : [],
        systemTags: [],
        topicHints: Array.isArray(payload.topicHints) ? payload.topicHints.map((item) => sanitize(item)).filter(Boolean) : [],
        submittedBy: sanitize(payload.submittedBy || 'internal-operator'),
        submittedFrom: sanitize(payload.submittedFrom || 'internal-console'),
        createdAt: nowTs(),
        updatedAt: nowTs(),
        fetchedAt: null,
        analyzedAt: null,
        approvedAt: null,
        absorbedAt: null,
        failedAt: null,
        lastError: '',
        retryCount: 0
    };

    await ref.set(doc);
    const snap = await ref.get();
    return mapDoc(snap);
}

async function listSources(limit = 50) {
    const snap = await sourcesCol()
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(1, Math.min(100, toNumber(limit, 50))))
        .get();

    return snap.docs.map(mapDoc);
}

async function getSourceById(sourceId) {
    const snap = await sourcesCol().doc(sanitize(sourceId)).get();
    if (!snap.exists) return null;
    return mapDoc(snap);
}

async function updateSource(sourceId, payload = {}) {
    const ref = sourcesCol().doc(sanitize(sourceId));
    await ref.set(
        {
            ...payload,
            updatedAt: nowTs()
        },
        { merge: true }
    );

    const snap = await ref.get();
    return snap.exists ? mapDoc(snap) : null;
}

async function createOrReplaceReview(sourceId, payload = {}) {
    const reviewId = sanitize(sourceId);
    const ref = reviewsCol().doc(reviewId);

    await ref.set(
        {
            sourceId: sanitize(sourceId),
            overallDecision: sanitize(payload.overallDecision || 'reference_only'),
            summaryShort: sanitize(payload.summaryShort),
            summaryLong: sanitize(payload.summaryLong),
            absorbWhat: Array.isArray(payload.absorbWhat) ? payload.absorbWhat.map((item) => sanitize(item)).filter(Boolean) : [],
            doNotAbsorbWhat: Array.isArray(payload.doNotAbsorbWhat) ? payload.doNotAbsorbWhat.map((item) => sanitize(item)).filter(Boolean) : [],
            riskNotes: Array.isArray(payload.riskNotes) ? payload.riskNotes.map((item) => sanitize(item)).filter(Boolean) : [],
            recommendedCategory: sanitize(payload.recommendedCategory || 'general'),
            recommendedKnowledgeType: sanitize(payload.recommendedKnowledgeType || 'framework'),
            scores: {
                relevance: toNumber(payload?.scores?.relevance, 0),
                novelty: toNumber(payload?.scores?.novelty, 0),
                trust: toNumber(payload?.scores?.trust, 0),
                duplication: toNumber(payload?.scores?.duplication, 0),
                actionability: toNumber(payload?.scores?.actionability, 0)
            },
            approvedChunkIndexes: Array.isArray(payload.approvedChunkIndexes) ? payload.approvedChunkIndexes : [],
            rejectedChunkIndexes: Array.isArray(payload.rejectedChunkIndexes) ? payload.rejectedChunkIndexes : [],
            createdAt: nowTs(),
            updatedAt: nowTs()
        },
        { merge: true }
    );

    const snap = await ref.get();
    return snap.exists ? mapDoc(snap) : null;
}

async function getReviewBySourceId(sourceId) {
    const snap = await reviewsCol().doc(sanitize(sourceId)).get();
    if (!snap.exists) return null;
    return mapDoc(snap);
}

async function createLibraryEntry(payload = {}) {
    const ref = libraryCol().doc();

    await ref.set({
        sourceId: sanitize(payload.sourceId),
        title: sanitize(payload.title),
        category: sanitize(payload.category || 'general'),
        subCategory: sanitize(payload.subCategory),
        knowledgeType: sanitize(payload.knowledgeType || 'framework'),
        summary: sanitize(payload.summary),
        usableRules: Array.isArray(payload.usableRules) ? payload.usableRules.map((item) => sanitize(item)).filter(Boolean) : [],
        doNotUseWhen: Array.isArray(payload.doNotUseWhen) ? payload.doNotUseWhen.map((item) => sanitize(item)).filter(Boolean) : [],
        sourceUrl: sanitize(payload.sourceUrl),
        sourceTitle: sanitize(payload.sourceTitle),
        confidence: toNumber(payload.confidence, 0),
        retrievalTags: Array.isArray(payload.retrievalTags) ? payload.retrievalTags.map((item) => sanitize(item)).filter(Boolean) : [],
        status: sanitize(payload.status || 'active'),
        createdAt: nowTs(),
        updatedAt: nowTs()
    });

    const snap = await ref.get();
    return mapDoc(snap);
}

async function createMemoryCards(sourceId, rules = [], meta = {}) {
    const created = [];

    for (const rule of Array.isArray(rules) ? rules : []) {
        const cleanRule = sanitize(rule);
        if (!cleanRule) continue;

        const ref = memoryCardsCol().doc();
        const doc = {
            knowledgeId: sanitize(meta.knowledgeId),
            sourceId: sanitize(sourceId),
            title: sanitize(meta.title || cleanRule.slice(0, 80)),
            cardType: 'rule',
            content: cleanRule,
            priority: toNumber(meta.priority, 5),
            category: sanitize(meta.category || 'general'),
            isActive: true,
            createdAt: nowTs()
        };

        await ref.set(doc);
        const snap = await ref.get();
        created.push(mapDoc(snap));
    }

    return created;
}

async function approveSource(sourceId) {
    const source = await getSourceById(sourceId);
    const review = await getReviewBySourceId(sourceId);

    if (!source) throw new Error('Source not found.');
    if (!review) throw new Error('Review not found.');

    const libraryEntry = await createLibraryEntry({
        sourceId: source.id,
        title: source.title || source.canonicalUrl,
        category: review.recommendedCategory || 'general',
        knowledgeType: review.recommendedKnowledgeType || 'framework',
        summary: review.summaryShort || review.summaryLong || '',
        usableRules: review.absorbWhat || [],
        doNotUseWhen: review.doNotAbsorbWhat || [],
        sourceUrl: source.canonicalUrl,
        sourceTitle: source.title || source.canonicalUrl,
        confidence: review?.scores?.relevance || 0,
        retrievalTags: [
            ...(source.manualTags || []),
            ...(source.topicHints || []),
            sanitize(review.recommendedCategory)
        ].filter(Boolean),
        status: 'active'
    });

    const cards = await createMemoryCards(source.id, review.absorbWhat || [], {
        knowledgeId: libraryEntry.id,
        title: libraryEntry.title,
        category: libraryEntry.category,
        priority: 7
    });

    await updateSource(sourceId, {
        status: 'approved',
        approvedAt: nowTs(),
        absorbedAt: nowTs()
    });

    return {
        libraryEntry,
        cards
    };
}

async function rejectSource(sourceId, reason = '') {
    return updateSource(sourceId, {
        status: 'rejected',
        rejectionReason: sanitize(reason),
        updatedAt: nowTs()
    });
}

async function listLibrary(limit = 100) {
    const snap = await libraryCol()
        .where('status', '==', 'active')
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(1, Math.min(200, toNumber(limit, 100))))
        .get();

    return snap.docs.map(mapDoc);
}

async function buildActiveKnowledgeContext(filters = {}) {
    const categoryHints = Array.isArray(filters.categoryHints) ? filters.categoryHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean) : [];
    const tagHints = Array.isArray(filters.tagHints) ? filters.tagHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean) : [];

    const libraryItems = await listLibrary(50);
    const memorySnap = await memoryCardsCol()
        .where('isActive', '==', true)
        .limit(100)
        .get();

    const memoryCards = memorySnap.docs.map(mapDoc);

    const filteredLibrary = categoryHints.length
        ? libraryItems.filter((item) => categoryHints.includes(String(item.category || '').trim().toLowerCase()))
        : libraryItems;

    const filteredCards = (tagHints.length || categoryHints.length)
        ? memoryCards.filter((card) => {
            const category = String(card.category || '').trim().toLowerCase();
            const content = String(card.content || '').trim().toLowerCase();
            return (
                categoryHints.includes(category) ||
                tagHints.some((hint) => content.includes(hint))
            );
        })
        : memoryCards;

    return {
        rules: filteredCards.slice(0, 8).map((item) => sanitize(item.content)).filter(Boolean),
        examples: filteredLibrary.slice(0, 4).map((item) => sanitize(item.summary)).filter(Boolean),
        redFlags: filteredLibrary.slice(0, 4).flatMap((item) => Array.isArray(item.doNotUseWhen) ? item.doNotUseWhen : []).slice(0, 6),
        priorityThemes: [...new Set(filteredLibrary.slice(0, 6).map((item) => sanitize(item.category)).filter(Boolean))]
    };
}

module.exports = {
    getSettings,
    updateSettings,
    createSource,
    listSources,
    getSourceById,
    updateSource,
    createOrReplaceReview,
    getReviewBySourceId,
    approveSource,
    rejectSource,
    listLibrary,
    buildActiveKnowledgeContext
};