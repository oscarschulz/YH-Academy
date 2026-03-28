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

function stripUndefined(obj = {}) {
    const out = {};
    for (const [key, value] of Object.entries(obj || {})) {
        if (value !== undefined) out[key] = value;
    }
    return out;
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

function serializeValue(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, serializeValue(nested)])
        );
    }

    return value;
}

function mapDoc(doc) {
    return { id: doc.id, ...serializeValue(doc.data() || {}) };
}

const settingsDoc = () => firestore.collection('aiNurtureSettings').doc('main');
const sourcesCol = () => firestore.collection('aiNurtureSources');
const reviewsCol = () => firestore.collection('aiNurtureReviews');
const libraryCol = () => firestore.collection('aiNurtureLibrary');
const memoryCardsCol = () => firestore.collection('aiNurtureMemoryCards');
const contextPacksCol = () => firestore.collection('aiNurtureContextPacks');
const snapshotsCol = (sourceId) => sourcesCol().doc(sanitize(sourceId)).collection('snapshots');
const chunksCol = (sourceId) => sourcesCol().doc(sanitize(sourceId)).collection('chunks');

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
        return serializeValue(fresh.data() || defaults);
    }

    return serializeValue(snap.data() || {});
}

async function updateSettings(payload = {}) {
    await settingsDoc().set(
        stripUndefined({
            ...payload,
            updatedAt: nowTs()
        }),
        { merge: true }
    );

    const snap = await settingsDoc().get();
    return serializeValue(snap.data() || {});
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
        retryCount: 0,
        rejectionReason: ''
    };

    await ref.set(doc);
    return mapDoc(await ref.get());
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
        stripUndefined({
            ...payload,
            updatedAt: nowTs()
        }),
        { merge: true }
    );

    const snap = await ref.get();
    return snap.exists ? mapDoc(snap) : null;
}

async function saveSnapshot(sourceId, payload = {}) {
    const ref = snapshotsCol(sourceId).doc();

    const doc = {
        fetchStatus: sanitize(payload.fetchStatus || 'success'),
        httpStatus: toNumber(payload.httpStatus, 200),
        contentType: sanitize(payload.contentType),
        finalUrl: sanitize(payload.finalUrl),
        title: sanitize(payload.title),
        description: sanitize(payload.description),
        siteName: sanitize(payload.siteName),
        language: sanitize(payload.language),
        mainImage: sanitize(payload.mainImage),
        rawTextChars: toNumber(payload.rawTextChars, 0),
        cleanTextChars: toNumber(payload.cleanTextChars, 0),
        cleanText: sanitize(payload.cleanText),
        excerpt: sanitize(payload.excerpt),
        capturedAt: nowTs()
    };

    await ref.set(doc);

    await updateSource(sourceId, {
        fetchedAt: nowTs(),
        title: doc.title || undefined,
        canonicalUrl: doc.finalUrl || undefined,
        hostname: doc.finalUrl ? hostnameFromUrl(doc.finalUrl) : undefined,
        status: 'fetched'
    });

    return mapDoc(await ref.get());
}

async function getLatestSnapshot(sourceId) {
    const snap = await snapshotsCol(sourceId)
        .orderBy('capturedAt', 'desc')
        .limit(1)
        .get();

    if (snap.empty) return null;
    return mapDoc(snap.docs[0]);
}

async function replaceChunks(sourceId, chunks = []) {
    const sourceRef = sourcesCol().doc(sanitize(sourceId));
    const existing = await chunksCol(sourceId).get();
    const deleteBatch = firestore.batch();

    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) {
        await deleteBatch.commit();
    }

    const created = [];
    for (const chunk of Array.isArray(chunks) ? chunks : []) {
        const index = Math.max(1, toNumber(chunk.index, created.length + 1));
        const ref = chunksCol(sourceId).doc(String(index).padStart(4, '0'));

        const payload = {
            index,
            text: sanitize(chunk.text),
            tokenEstimate: toNumber(chunk.tokenEstimate, 0),
            sectionTitle: sanitize(chunk.sectionTitle || `Chunk ${index}`),
            relevanceScore: Number(toNumber(chunk.relevanceScore, 0).toFixed(2)),
            noveltyScore: Number(toNumber(chunk.noveltyScore, 0).toFixed(2)),
            trustScore: Number(toNumber(chunk.trustScore, 0).toFixed(2)),
            duplicationScore: Number(toNumber(chunk.duplicationScore, 0).toFixed(2)),
            actionabilityScore: Number(toNumber(chunk.actionabilityScore, 0).toFixed(2)),
            decision: sanitize(chunk.decision || 'reference_only'),
            reason: sanitize(chunk.reason),
            keyTakeaways: Array.isArray(chunk.keyTakeaways) ? chunk.keyTakeaways.map((item) => sanitize(item)).filter(Boolean) : [],
            redFlags: Array.isArray(chunk.redFlags) ? chunk.redFlags.map((item) => sanitize(item)).filter(Boolean) : [],
            createdAt: nowTs()
        };

        await ref.set(payload);
        created.push(mapDoc(await ref.get()));
    }

    return created;
}

async function listSourceChunks(sourceId, limit = 60) {
    const snap = await chunksCol(sourceId)
        .orderBy('index', 'asc')
        .limit(Math.max(1, Math.min(100, toNumber(limit, 60))))
        .get();

    return snap.docs.map(mapDoc);
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
                relevance: Number(toNumber(payload?.scores?.relevance, 0).toFixed(2)),
                novelty: Number(toNumber(payload?.scores?.novelty, 0).toFixed(2)),
                trust: Number(toNumber(payload?.scores?.trust, 0).toFixed(2)),
                duplication: Number(toNumber(payload?.scores?.duplication, 0).toFixed(2)),
                actionability: Number(toNumber(payload?.scores?.actionability, 0).toFixed(2))
            },
            approvedChunkIndexes: Array.isArray(payload.approvedChunkIndexes) ? payload.approvedChunkIndexes : [],
            rejectedChunkIndexes: Array.isArray(payload.rejectedChunkIndexes) ? payload.rejectedChunkIndexes : [],
            createdAt: nowTs(),
            updatedAt: nowTs()
        },
        { merge: true }
    );

    return mapDoc(await ref.get());
}

async function getReviewBySourceId(sourceId) {
    const snap = await reviewsCol().doc(sanitize(sourceId)).get();
    if (!snap.exists) return null;
    return mapDoc(snap);
}

async function getSourceDetail(sourceId) {
    const [source, review, snapshot, chunks] = await Promise.all([
        getSourceById(sourceId),
        getReviewBySourceId(sourceId),
        getLatestSnapshot(sourceId),
        listSourceChunks(sourceId, 60)
    ]);

    return {
        source,
        review,
        snapshot,
        chunks
    };
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
        confidence: Number(toNumber(payload.confidence, 0).toFixed(2)),
        retrievalTags: Array.isArray(payload.retrievalTags) ? payload.retrievalTags.map((item) => sanitize(item)).filter(Boolean) : [],
        status: sanitize(payload.status || 'active'),
        createdAt: nowTs(),
        updatedAt: nowTs()
    });

    return mapDoc(await ref.get());
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
        created.push(mapDoc(await ref.get()));
    }

    return created;
}

async function rebuildContextPacks() {
    const items = await listLibrary(80);

    const grouped = new Map();
    for (const item of items) {
        const category = sanitize(item.category || 'general');
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(item);
    }

    const existing = await contextPacksCol().get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) {
        await deleteBatch.commit();
    }

    const packs = [];
    for (const [category, categoryItems] of grouped.entries()) {
        const ref = contextPacksCol().doc(category);
        const pack = {
            key: category,
            title: `${category} planner pack`,
            category,
            rules: categoryItems.flatMap((item) => Array.isArray(item.usableRules) ? item.usableRules : []).slice(0, 12),
            redFlags: categoryItems.flatMap((item) => Array.isArray(item.doNotUseWhen) ? item.doNotUseWhen : []).slice(0, 8),
            examples: categoryItems.map((item) => item.summary).filter(Boolean).slice(0, 6),
            isActive: true,
            updatedAt: nowTs(),
            createdAt: nowTs()
        };

        await ref.set(pack);
        packs.push(mapDoc(await ref.get()));
    }

    return packs;
}

async function approveSource(sourceId) {
    const source = await getSourceById(sourceId);
    const review = await getReviewBySourceId(sourceId);

    if (!source) throw new Error('Source not found.');
    if (!review) throw new Error('Review not found.');

    const rules = Array.isArray(review.absorbWhat) && review.absorbWhat.length
        ? review.absorbWhat
        : [review.summaryShort || review.summaryLong].filter(Boolean);

    const libraryEntry = await createLibraryEntry({
        sourceId: source.id,
        title: source.title || source.canonicalUrl,
        category: review.recommendedCategory || 'general',
        knowledgeType: review.recommendedKnowledgeType || 'framework',
        summary: review.summaryShort || review.summaryLong || '',
        usableRules: rules,
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

    const cards = await createMemoryCards(source.id, rules, {
        knowledgeId: libraryEntry.id,
        title: libraryEntry.title,
        category: libraryEntry.category,
        priority: 7
    });

    await updateSource(sourceId, {
        status: 'approved',
        approvedAt: nowTs(),
        absorbedAt: nowTs(),
        rejectionReason: ''
    });

    const contextPacks = await rebuildContextPacks();

    return {
        libraryEntry,
        cards,
        contextPacks
    };
}

async function rejectSource(sourceId, reason = '') {
    return updateSource(sourceId, {
        status: 'rejected',
        rejectionReason: sanitize(reason)
    });
}

async function listLibrary(limit = 100) {
    const snap = await libraryCol()
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(1, Math.min(200, toNumber(limit, 100))))
        .get();

    return snap.docs
        .map(mapDoc)
        .filter((item) => sanitize(item.status || 'active') === 'active');
}

async function buildActiveKnowledgeContext(filters = {}) {
    const categoryHints = Array.isArray(filters.categoryHints)
        ? filters.categoryHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];
    const tagHints = Array.isArray(filters.tagHints)
        ? filters.tagHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];

    const libraryItems = await listLibrary(60);
    const memorySnap = await memoryCardsCol().limit(120).get();
    const memoryCards = memorySnap.docs
        .map(mapDoc)
        .filter((item) => item.isActive === true);

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
    saveSnapshot,
    getLatestSnapshot,
    replaceChunks,
    listSourceChunks,
    createOrReplaceReview,
    getReviewBySourceId,
    getSourceDetail,
    approveSource,
    rejectSource,
    listLibrary,
    buildActiveKnowledgeContext,
    rebuildContextPacks
};