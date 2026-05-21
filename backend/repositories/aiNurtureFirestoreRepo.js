const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const aiNurturePolicy = require('../services/aiNurturePolicy');

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
const jobsCol = () => firestore.collection('aiNurtureJobs');
const batchesCol = () => firestore.collection('aiNurtureBatches');
const userOverlaysCol = () => firestore.collection('aiNurtureUserOverlays');
const snapshotsCol = (sourceId) => sourcesCol().doc(sanitize(sourceId)).collection('snapshots');
const chunksCol = (sourceId) => sourcesCol().doc(sanitize(sourceId)).collection('chunks');

function toTimestamp(value) {
    if (!value) return nowTs();
    if (value instanceof Date) return Timestamp.fromDate(value);
    if (typeof value?.toDate === 'function') return value;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? Timestamp.fromDate(parsed) : nowTs();
}

function toDocKey(value, fallback = 'general') {
    const cleaned = sanitize(value)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return cleaned || fallback;
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
        staleDaysDefault: 540,
        staleDaysByCategory: {
            wealth: 365,
            health: 730,
            discipline: 730,
            mindset: 1095,
            communication: 730,
            general: 540
        },
        plannerPackLimits: {
            maxRulesTotal: 10,
            maxExamplesTotal: 6,
            maxRedFlagsTotal: 8,
            maxRulesPerCategory: 4,
            maxExamplesPerCategory: 2,
            maxRedFlagsPerCategory: 3
        },
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
        batchId: sanitize(payload.batchId),
        batchTitle: sanitize(payload.batchTitle),
        batchMentorKey: sanitize(payload.batchMentorKey),
        batchMentorName: sanitize(payload.batchMentorName),
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
        publishedAt: sanitize(payload.publishedAt),
        modifiedAt: sanitize(payload.modifiedAt),
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
            domainVerdict: sanitize(payload.domainVerdict || 'neutral'),
            domainTrustScore: Number(toNumber(payload.domainTrustScore, 0).toFixed(2)),
            duplicateScore: Number(toNumber(payload.duplicateScore, 0).toFixed(2)),
            duplicateTopMatch: payload.duplicateTopMatch && typeof payload.duplicateTopMatch === 'object'
                ? serializeValue(payload.duplicateTopMatch)
                : null,
            duplicateMatches: Array.isArray(payload.duplicateMatches)
                ? payload.duplicateMatches.slice(0, 5).map((item) => serializeValue(item))
                : [],
            duplicateMethod: sanitize(payload.duplicateMethod || 'heuristic'),
            staleVerdict: sanitize(payload.staleVerdict || 'unknown'),
            freshnessScore: Number(toNumber(payload.freshnessScore, 0.55).toFixed(2)),
            ageDays: payload.ageDays === null || payload.ageDays === undefined ? null : toNumber(payload.ageDays, 0),
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
async function appendReviewNote(sourceId, payload = {}) {
    const normalizedSourceId = sanitize(sourceId);
    if (!normalizedSourceId) {
        throw new Error('Source ID is required.');
    }

    const note = sanitize(payload.note);
    if (!note) {
        throw new Error('Review note is required.');
    }

    const ref = reviewsCol().doc(normalizedSourceId);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() || {}) : {};
    const manualNotes = Array.isArray(existing.manualNotes) ? existing.manualNotes : [];

    const noteEntry = {
        id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        note,
        labels: Array.isArray(payload.labels) ? payload.labels.map((item) => sanitize(item)).filter(Boolean) : [],
        author: sanitize(payload.author || 'internal-operator'),
        noteType: sanitize(payload.noteType || 'review'),
        createdAt: new Date().toISOString()
    };

    await ref.set(
        {
            sourceId: normalizedSourceId,
            manualNotes: [...manualNotes, noteEntry].slice(-50),
            lastManualNoteAt: nowTs(),
            updatedAt: nowTs()
        },
        { merge: true }
    );

    return mapDoc(await ref.get());
}

async function getUserOverlay(userId) {
    const normalizedUserId = sanitize(userId);
    if (!normalizedUserId) return null;

    const snap = await userOverlaysCol().doc(normalizedUserId).get();
    if (!snap.exists) return null;

    return mapDoc(snap);
}

async function upsertUserOverlay(userId, payload = {}) {
    const normalizedUserId = sanitize(userId);
    if (!normalizedUserId) {
        throw new Error('User ID is required.');
    }

    const ref = userOverlaysCol().doc(normalizedUserId);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() || {}) : {};
    const ts = nowTs();

    const nextDoc = {
        userId: normalizedUserId,
        note: payload.note !== undefined
            ? sanitize(payload.note)
            : sanitize(existing.note),
        rules: Array.isArray(payload.rules)
            ? payload.rules.map((item) => sanitize(item)).filter(Boolean)
            : (Array.isArray(existing.rules) ? existing.rules : []),
        redFlags: Array.isArray(payload.redFlags)
            ? payload.redFlags.map((item) => sanitize(item)).filter(Boolean)
            : (Array.isArray(existing.redFlags) ? existing.redFlags : []),
        focusThemes: Array.isArray(payload.focusThemes)
            ? payload.focusThemes.map((item) => sanitize(item)).filter(Boolean)
            : (Array.isArray(existing.focusThemes) ? existing.focusThemes : []),
        tags: Array.isArray(payload.tags)
            ? payload.tags.map((item) => sanitize(item)).filter(Boolean)
            : (Array.isArray(existing.tags) ? existing.tags : []),
        isActive: payload.isActive !== undefined
            ? payload.isActive === true
            : (existing.isActive !== false),
        updatedBy: sanitize(payload.updatedBy || existing.updatedBy || 'internal-operator'),
        updatedAt: ts,
        createdAt: existing.createdAt || ts
    };

    await ref.set(nextDoc, { merge: true });
    return mapDoc(await ref.get());
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
        staleVerdict: sanitize(payload.staleVerdict || 'unknown'),
        freshnessScore: Number(toNumber(payload.freshnessScore, 0.55).toFixed(2)),
        ageDays: payload.ageDays === null || payload.ageDays === undefined ? null : toNumber(payload.ageDays, 0),
        publishedAt: sanitize(payload.publishedAt),
        modifiedAt: sanitize(payload.modifiedAt),
        excludedFromPlanner: payload.excludedFromPlanner === true,
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
    const items = (await listLibrary(140)).filter((item) => item.excludedFromPlanner !== true);
    const excludedSourceIds = new Set(
        (await listLibrary(140))
            .filter((item) => item.excludedFromPlanner === true)
            .map((item) => sanitize(item.sourceId))
            .filter(Boolean)
    );

    const cards = (await listMemoryCards(220)).filter((card) => !excludedSourceIds.has(sanitize(card.sourceId)));

    const grouped = new Map();

    for (const item of items) {
        const category = sanitize(item.category || 'general') || 'general';
        if (!grouped.has(category)) {
            grouped.set(category, {
                category,
                tags: new Set(),
                rules: [],
                examples: [],
                redFlags: []
            });
        }

        const bucket = grouped.get(category);
        (Array.isArray(item.retrievalTags) ? item.retrievalTags : []).forEach((tag) => bucket.tags.add(sanitize(tag)));
        (Array.isArray(item.usableRules) ? item.usableRules : []).forEach((rule) => {
            if (rule && !bucket.rules.includes(rule)) bucket.rules.push(rule);
        });
        if (item.summary && !bucket.examples.includes(item.summary)) bucket.examples.push(item.summary);
        (Array.isArray(item.doNotUseWhen) ? item.doNotUseWhen : []).forEach((flag) => {
            if (flag && !bucket.redFlags.includes(flag)) bucket.redFlags.push(flag);
        });
    }

    for (const card of cards) {
        const category = sanitize(card.category || 'general') || 'general';
        if (!grouped.has(category)) {
            grouped.set(category, {
                category,
                tags: new Set(),
                rules: [],
                examples: [],
                redFlags: []
            });
        }

        const bucket = grouped.get(category);
        if (card.content && !bucket.rules.includes(card.content)) bucket.rules.push(card.content);
    }

    const existing = await contextPacksCol().get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();

    const packs = [];

    for (const [category, bucket] of grouped.entries()) {
        const key = toDocKey(category, 'general');
        const ref = contextPacksCol().doc(key);

        const pack = {
            key,
            title: `${category} planner pack`,
            category,
            tags: [...bucket.tags].filter(Boolean).slice(0, 16),
            rules: bucket.rules.slice(0, 14),
            examples: bucket.examples.slice(0, 8),
            redFlags: bucket.redFlags.slice(0, 10),
            strength: Number(Math.min(1, (bucket.rules.length * 0.08) + (bucket.examples.length * 0.05)).toFixed(2)),
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
    const snapshot = await getLatestSnapshot(sourceId);

    if (!source) throw new Error('Source not found.');
    if (!review) throw new Error('Review not found.');

    const rules = Array.isArray(review.absorbWhat) && review.absorbWhat.length
        ? review.absorbWhat
        : [review.summaryShort || review.summaryLong].filter(Boolean);

    const excludedFromPlanner =
        sanitize(review.staleVerdict) === 'expired' ||
        sanitize(review.domainVerdict) === 'blocked';

    const libraryEntry = await createLibraryEntry({
        sourceId: source.id,
        title: source.title || source.canonicalUrl,
        category: review.recommendedCategory || 'general',
        knowledgeType: review.recommendedKnowledgeType || 'framework',
        summary: review.summaryShort || review.summaryLong || '',
        usableRules: rules,
        doNotUseWhen: [
            ...(review.doNotAbsorbWhat || []),
            ...(review.staleVerdict === 'stale' ? ['Use only as a secondary reference because the source is stale.'] : [])
        ],
        sourceUrl: source.canonicalUrl,
        sourceTitle: source.title || source.canonicalUrl,
        confidence: review?.scores?.relevance || 0,
        retrievalTags: [
            ...(source.manualTags || []),
            ...(source.topicHints || []),
            sanitize(review.recommendedCategory)
        ].filter(Boolean),
        status: 'active',
        staleVerdict: review.staleVerdict || 'unknown',
        freshnessScore: review.freshnessScore,
        ageDays: review.ageDays,
        publishedAt: snapshot?.publishedAt || '',
        modifiedAt: snapshot?.modifiedAt || '',
        excludedFromPlanner
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
        rejectionReason: '',
        staleVerdict: review.staleVerdict || 'unknown',
        freshnessScore: review.freshnessScore,
        ageDays: review.ageDays
    });

    const contextPacks = await rebuildContextPacks();

    return {
        libraryEntry,
        cards,
        contextPacks
    };
}

function normalizeMentorKnowledgeKey(value = '') {
    return sanitize(value)
        .toLowerCase()
        .replace(/[\u2019']/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
}

function toCleanStringList(values = [], limit = 24, maxChars = 360) {
    const source = Array.isArray(values) ? values : [values];
    const out = [];

    for (const value of source) {
        const clean = sanitize(value).replace(/\s+/g, ' ').trim().slice(0, maxChars);
        if (!clean) continue;
        if (!out.includes(clean)) out.push(clean);
        if (out.length >= limit) break;
    }

    return out;
}

function dedupeAiNurtureTags(values = [], limit = 32) {
    const out = [];

    for (const value of Array.isArray(values) ? values : []) {
        const clean = sanitize(value)
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);

        if (!clean) continue;
        if (!out.includes(clean)) out.push(clean);
        if (out.length >= limit) break;
    }

    return out;
}

function buildMentorKnowledgeRules(payload = {}) {
    const rules = [];

    toCleanStringList(payload.coreIdeas, 12, 260).forEach((item) => {
        rules.push(`Core idea: ${item}`);
    });

    toCleanStringList(payload.businessFrameworks, 12, 300).forEach((item) => {
        rules.push(`Business framework: ${item}`);
    });

    toCleanStringList(payload.practicalLessons, 12, 320).forEach((item) => {
        rules.push(`Practical lesson: ${item}`);
    });

    toCleanStringList(payload.academyUse, 12, 360).forEach((item) => {
        rules.push(`Academy AI Coach use: ${item}`);
    });

    const leadershipStyle = sanitize(payload.leadershipStyle).replace(/\s+/g, ' ').trim();
    const communicationStyle = sanitize(payload.communicationStyle).replace(/\s+/g, ' ').trim();
    const decisionMakingStyle = sanitize(payload.decisionMakingStyle).replace(/\s+/g, ' ').trim();

    if (leadershipStyle) {
        rules.push(`Leadership style lens: ${leadershipStyle.slice(0, 360)}`);
    }

    if (communicationStyle) {
        rules.push(`Communication style lens: ${communicationStyle.slice(0, 360)}`);
    }

    if (decisionMakingStyle) {
        rules.push(`Decision-making style lens: ${decisionMakingStyle.slice(0, 360)}`);
    }

    return toCleanStringList(rules, 36, 420);
}

async function createMentorKnowledgePack(payload = {}) {
    const mentorKey = normalizeMentorKnowledgeKey(payload.mentorKey || payload.mentorName);
    const mentorName = sanitize(payload.mentorName || mentorKey.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim();

    if (!mentorKey || !mentorName) {
        throw new Error('Mentor key and mentor name are required.');
    }

    const rules = buildMentorKnowledgeRules(payload);
    if (!rules.length) {
        throw new Error('At least one mentor knowledge rule is required.');
    }

    const sourceTitle = sanitize(payload.sourceTitle || `${mentorName} Mentor Knowledge Pack`);
    const sourceUrl = sanitize(payload.sourceUrl);
    const sourceId = `mentor_${mentorKey}_${Date.now()}`;

    const category = sanitize(payload.category || mentorName.toLowerCase());
    const doNotUseWhen = toCleanStringList(payload.doNot || payload.doNotUseWhen, 18, 300);

    const retrievalTags = dedupeAiNurtureTags([
        mentorKey,
        mentorKey.replace(/_/g, ' '),
        mentorName,
        'mentor',
        'learn from',
        'academy ai coach',
        ...(Array.isArray(payload.tags) ? payload.tags : []),
        category
    ]);

    const summaryParts = [
        ...toCleanStringList(payload.coreIdeas, 4, 220),
        ...toCleanStringList(payload.businessFrameworks, 3, 220),
        ...toCleanStringList(payload.practicalLessons, 3, 220)
    ];

    const libraryEntry = await createLibraryEntry({
        sourceId,
        title: sourceTitle,
        category,
        subCategory: mentorKey,
        knowledgeType: 'mentor_pack',
        summary: summaryParts.join(' ').slice(0, 900) || `${mentorName} mentor knowledge pack for Academy AI Coach.`,
        usableRules: rules,
        doNotUseWhen,
        sourceUrl,
        sourceTitle,
        confidence: 0.9,
        retrievalTags,
        status: payload.approveNow === false ? 'draft' : 'active',
        staleVerdict: 'fresh',
        freshnessScore: 0.86,
        ageDays: 0,
        excludedFromPlanner: payload.approveNow === false
    });

    const cards = await createMemoryCards(sourceId, rules, {
        knowledgeId: libraryEntry.id,
        title: sourceTitle,
        category,
        priority: 8
    });

    const contextPacks = payload.approveNow === false
        ? []
        : await rebuildContextPacks();

    return {
        libraryEntry,
        cards,
        contextPacks
    };
}

async function deleteMentorKnowledgePack(libraryId = '') {
    const cleanLibraryId = sanitize(libraryId);

    if (!cleanLibraryId) {
        throw new Error('Mentor pack ID is required.');
    }

    const libraryRef = libraryCol().doc(cleanLibraryId);
    const librarySnap = await libraryRef.get();

    if (!librarySnap.exists) {
        throw new Error('Mentor pack not found.');
    }

    const libraryEntry = mapDoc(librarySnap);

    if (sanitize(libraryEntry.knowledgeType).toLowerCase() !== 'mentor_pack') {
        throw new Error('Only mentor knowledge packs can be deleted from this endpoint.');
    }

    const sourceId = sanitize(libraryEntry.sourceId);
    const refsToDelete = new Map();

    const byKnowledgeSnap = await memoryCardsCol()
        .where('knowledgeId', '==', cleanLibraryId)
        .limit(300)
        .get();

    byKnowledgeSnap.docs.forEach((doc) => {
        refsToDelete.set(doc.ref.path, doc.ref);
    });

    if (sourceId) {
        const bySourceSnap = await memoryCardsCol()
            .where('sourceId', '==', sourceId)
            .limit(300)
            .get();

        bySourceSnap.docs.forEach((doc) => {
            refsToDelete.set(doc.ref.path, doc.ref);
        });
    }

    const batch = firestore.batch();
    refsToDelete.forEach((ref) => {
        batch.delete(ref);
    });
    batch.delete(libraryRef);

    await batch.commit();

    const contextPacks = await rebuildContextPacks();

    return {
        deletedLibraryId: cleanLibraryId,
        deletedSourceId: sourceId,
        deletedCardCount: refsToDelete.size,
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
    const settings = await getSettings();

    const categoryHints = Array.isArray(filters.categoryHints)
        ? filters.categoryHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];
    const tagHints = Array.isArray(filters.tagHints)
        ? filters.tagHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];

    const allLibraryItems = await listLibrary(80);
    const excludedSourceIds = new Set(
        allLibraryItems
            .filter((item) => item.excludedFromPlanner === true)
            .map((item) => sanitize(item.sourceId))
            .filter(Boolean)
    );

    const libraryItems = allLibraryItems.filter((item) => item.excludedFromPlanner !== true);
    const packs = await listContextPacks(40);
    const memoryCards = (await listMemoryCards(140)).filter((card) => !excludedSourceIds.has(sanitize(card.sourceId)));
    const overlayKnowledge = filters.userId ? await getUserOverlay(filters.userId) : null;

    return aiNurturePolicy.selectContextFromAssets({
        packs,
        libraryItems,
        memoryCards,
        categoryHints,
        tagHints,
        limits: settings?.plannerPackLimits || {},
        overlayKnowledge
    });
}
async function listMemoryCards(limit = 160) {
    const snap = await memoryCardsCol()
        .limit(Math.max(1, Math.min(300, toNumber(limit, 160))))
        .get();

    return snap.docs
        .map(mapDoc)
        .filter((item) => item.isActive === true);
}

async function listContextPacks(limit = 60) {
    const snap = await contextPacksCol()
        .limit(Math.max(1, Math.min(120, toNumber(limit, 60))))
        .get();

    return snap.docs
        .map(mapDoc)
        .filter((item) => item.isActive === true);
}

async function getLibraryForDuplicateCheck(limit = 150) {
    return listLibrary(limit);
}

async function createBatchRun(payload = {}) {
    const ref = batchesCol().doc();
    const requestedUrls = Array.isArray(payload.requestedUrls)
        ? payload.requestedUrls.map((item) => sanitize(item)).filter(Boolean).slice(0, 120)
        : [];

    const doc = {
        title: sanitize(payload.title || 'AI Nurture Batch'),
        mentorKey: sanitize(payload.mentorKey),
        mentorName: sanitize(payload.mentorName),
        titlePrefix: sanitize(payload.titlePrefix),
        requestedCount: toNumber(payload.requestedCount, requestedUrls.length),
        createdCount: 0,
        jobCount: 0,
        failedCount: 0,
        approvedCount: 0,
        processedCount: 0,
        sourceIds: [],
        jobIds: [],
        failed: [],
        requestedUrls,
        queueJobs: payload.queueJobs !== false,
        queuePriority: toNumber(payload.queuePriority, 3),
        status: 'created',
        createdAt: nowTs(),
        updatedAt: nowTs()
    };

    await ref.set(doc);
    return mapDoc(await ref.get());
}

async function updateBatchRun(batchId, payload = {}) {
    const ref = batchesCol().doc(sanitize(batchId));

    await ref.set(
        stripUndefined({
            ...payload,
            updatedAt: nowTs()
        }),
        { merge: true }
    );

    return mapDoc(await ref.get());
}

async function listBatchRuns(limit = 30) {
    const snap = await batchesCol()
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(1, Math.min(60, toNumber(limit, 30))))
        .get();

    return snap.docs.map(mapDoc);
}

async function getBatchRunById(batchId) {
    const cleanBatchId = sanitize(batchId);
    if (!cleanBatchId) return null;

    const snap = await batchesCol().doc(cleanBatchId).get();
    if (!snap.exists) return null;

    return mapDoc(snap);
}

async function listJobsByBatch(batchId, limit = 200) {
    const cleanBatchId = sanitize(batchId);
    if (!cleanBatchId) return [];

    const snap = await jobsCol()
        .where('batchId', '==', cleanBatchId)
        .limit(Math.max(1, Math.min(300, toNumber(limit, 200))))
        .get();

    return snap.docs.map(mapDoc);
}

async function createJob(payload = {}) {
    const ref = jobsCol().doc();
    const doc = {
        type: sanitize(payload.type || 'process-source'),
        sourceId: sanitize(payload.sourceId),
        status: sanitize(payload.status || 'queued'),
        priority: toNumber(payload.priority, 3),
        reason: sanitize(payload.reason),
        batchId: sanitize(payload.batchId),
        batchTitle: sanitize(payload.batchTitle),
        batchMentorKey: sanitize(payload.batchMentorKey),
        batchMentorName: sanitize(payload.batchMentorName),
        runAfterAt: toTimestamp(payload.runAfterAt),
        attempts: toNumber(payload.attempts, 0),
        lastError: sanitize(payload.lastError),
        createdAt: nowTs(),
        updatedAt: nowTs(),
        startedAt: null,
        completedAt: null,
        failedAt: null
    };

    await ref.set(doc);
    return mapDoc(await ref.get());
}

async function listJobs(limit = 50) {
    const snap = await jobsCol()
        .orderBy('updatedAt', 'desc')
        .limit(Math.max(1, Math.min(100, toNumber(limit, 50))))
        .get();

    return snap.docs.map(mapDoc);
}

async function claimNextQueuedJob() {
    const snap = await jobsCol()
        .where('status', '==', 'queued')
        .limit(20)
        .get();

    if (snap.empty) return null;

    const candidates = snap.docs
        .map(mapDoc)
        .filter((job) => {
            const runAfter = job.runAfterAt ? new Date(job.runAfterAt).getTime() : 0;
            return !runAfter || runAfter <= Date.now();
        })
        .sort((a, b) => {
            const priorityDiff = toNumber(b.priority, 0) - toNumber(a.priority, 0);
            if (priorityDiff !== 0) return priorityDiff;
            return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });

    for (const candidate of candidates) {
        const ref = jobsCol().doc(candidate.id);

        const claimed = await firestore.runTransaction(async (tx) => {
            const liveSnap = await tx.get(ref);
            if (!liveSnap.exists) return false;

            const live = liveSnap.data() || {};
            const runAfter = live.runAfterAt && typeof live.runAfterAt.toDate === 'function'
                ? live.runAfterAt.toDate().getTime()
                : live.runAfterAt
                    ? new Date(live.runAfterAt).getTime()
                    : 0;

            if ((live.status || '') !== 'queued') return false;
            if (runAfter && runAfter > Date.now()) return false;

            tx.set(ref, {
                status: 'running',
                startedAt: nowTs(),
                updatedAt: nowTs()
            }, { merge: true });

            return true;
        });

        if (claimed) {
            return mapDoc(await ref.get());
        }
    }

    return null;
}

async function completeJob(jobId, payload = {}) {
    const ref = jobsCol().doc(sanitize(jobId));
    await ref.set(
        {
            status: 'completed',
            completedAt: nowTs(),
            updatedAt: nowTs(),
            lastError: '',
            resultSourceId: sanitize(payload.resultSourceId)
        },
        { merge: true }
    );

    return mapDoc(await ref.get());
}

async function failJob(jobId, error, payload = {}) {
    const ref = jobsCol().doc(sanitize(jobId));
    const attempts = toNumber(payload.attempts, 0);

    await ref.set(
        {
            status: sanitize(payload.status || 'failed'),
            failedAt: nowTs(),
            updatedAt: nowTs(),
            attempts,
            lastError: sanitize(error?.message || error || 'Job failed.'),
            runAfterAt: payload.runAfterAt ? toTimestamp(payload.runAfterAt) : undefined
        },
        { merge: true }
    );

    return mapDoc(await ref.get());
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
    appendReviewNote,
    getUserOverlay,
    upsertUserOverlay,
    approveSource,
    createMentorKnowledgePack,
    deleteMentorKnowledgePack,
    rejectSource,
    listLibrary,
    buildActiveKnowledgeContext,
    rebuildContextPacks,
    listMemoryCards,
    listContextPacks,
    getLibraryForDuplicateCheck,
    createBatchRun,
    updateBatchRun,
    listBatchRuns,
    getBatchRunById,
    listJobsByBatch,
    createJob,
    listJobs,
    claimNextQueuedJob,
    completeJob,
    failJob,
};