const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');
const aiNurturePolicy = require('../services/aiNurturePolicy');

const TABLE_NAME = 'yhu_ai_nurture_records';

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
    return new Date().toISOString();
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

function toDocKey(value, fallback = 'general') {
    const cleaned = sanitize(value)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return cleaned || fallback;
}

function buildId(prefix = 'ain') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function toIso(value, fallback = '') {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    return sanitize(value, fallback);
}

function toCleanStringList(value = [], limit = 20, maxLength = 240) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/\n|,/);

    return raw
        .map((item) => sanitize(item))
        .filter(Boolean)
        .map((item) => item.slice(0, maxLength))
        .slice(0, limit);
}

function dedupeAiNurtureTags(values = []) {
    return Array.from(
        new Set(
            toCleanStringList(values, 40, 80)
                .map((item) => item.toLowerCase())
                .filter(Boolean)
        )
    ).slice(0, 24);
}

function sanitizeEvidenceItems(items = [], limit = 8) {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return { claim: sanitize(item).slice(0, 500) };
            }

            return {
                claim: sanitize(item.claim || item.text || item.summary).slice(0, 800),
                sourceUrl: sanitize(item.sourceUrl || item.url),
                sourceTitle: sanitize(item.sourceTitle || item.title),
                timestampLabel: sanitize(item.timestampLabel || item.timestamp),
                chunkIndex: item.chunkIndex === null || item.chunkIndex === undefined
                    ? null
                    : toNumber(item.chunkIndex, 0)
            };
        })
        .filter((item) => item.claim || item.sourceUrl || item.sourceTitle)
        .slice(0, limit);
}

function recordPathFor(recordType, id, parentSourceId = '') {
    const cleanId = sanitize(id);

    if (recordType === 'settings') return `aiNurtureSettings/${cleanId || 'main'}`;
    if (recordType === 'source') return `aiNurtureSources/${cleanId}`;
    if (recordType === 'snapshot') return `aiNurtureSources/${sanitize(parentSourceId)}/snapshots/${cleanId}`;
    if (recordType === 'chunk') return `aiNurtureSources/${sanitize(parentSourceId)}/chunks/${cleanId}`;
    if (recordType === 'review') return `aiNurtureReviews/${cleanId}`;
    if (recordType === 'library') return `aiNurtureLibrary/${cleanId}`;
    if (recordType === 'memory_card') return `aiNurtureMemoryCards/${cleanId}`;
    if (recordType === 'context_pack') return `aiNurtureContextPacks/${cleanId}`;
    if (recordType === 'job') return `aiNurtureJobs/${cleanId}`;
    if (recordType === 'batch') return `aiNurtureBatches/${cleanId}`;
    if (recordType === 'user_overlay') return `aiNurtureUserOverlays/${cleanId}`;

    return `aiNurture/${recordType}/${cleanId}`;
}

function collectionPathFor(recordType, parentSourceId = '') {
    if (recordType === 'settings') return 'aiNurtureSettings';
    if (recordType === 'source') return 'aiNurtureSources';
    if (recordType === 'snapshot') return `aiNurtureSources/${sanitize(parentSourceId)}/snapshots`;
    if (recordType === 'chunk') return `aiNurtureSources/${sanitize(parentSourceId)}/chunks`;
    if (recordType === 'review') return 'aiNurtureReviews';
    if (recordType === 'library') return 'aiNurtureLibrary';
    if (recordType === 'memory_card') return 'aiNurtureMemoryCards';
    if (recordType === 'context_pack') return 'aiNurtureContextPacks';
    if (recordType === 'job') return 'aiNurtureJobs';
    if (recordType === 'batch') return 'aiNurtureBatches';
    if (recordType === 'user_overlay') return 'aiNurtureUserOverlays';

    return `aiNurture/${recordType}`;
}

function deriveMeta(recordType, id, data = {}, options = {}) {
    const sourceId =
        recordType === 'source'
            ? id
            : sanitize(data.sourceId || data.resultSourceId || options.sourceId);

    const parentSourceId =
        recordType === 'snapshot' || recordType === 'chunk'
            ? sanitize(options.parentSourceId || data.sourceId || data.parentSourceId)
            : sanitize(data.parentSourceId || sourceId);

    return {
        record_type: recordType,
        source_collection_path: collectionPathFor(recordType, parentSourceId),
        source_document_id: id,
        source_document_path: recordPathFor(recordType, id, parentSourceId),

        parent_source_id: parentSourceId || null,
        source_id: sourceId || null,

        title: sanitize(data.title || data.batchTitle || data.sectionTitle || data.name) || null,
        status: sanitize(data.status || data.fetchStatus).toLowerCase() || null,
        decision: sanitize(data.overallDecision || data.decision || data.domainVerdict).toLowerCase() || null,
        category: sanitize(data.recommendedCategory || data.category || data.mentorKey).toLowerCase() || null,
        knowledge_type: sanitize(data.recommendedKnowledgeType || data.knowledgeType || data.type).toLowerCase() || null,

        original_url: sanitize(data.originalUrl || data.url) || null,
        canonical_url: sanitize(data.canonicalUrl || data.finalUrl) || null,
        hostname: sanitize(data.hostname || hostnameFromUrl(data.canonicalUrl || data.finalUrl || data.originalUrl || data.url)) || null,

        priority:
            data.queuePriority !== undefined || data.priority !== undefined
                ? toNumber(data.queuePriority ?? data.priority, 0)
                : null,

        batch_id: sanitize(data.batchId) || null,
        job_type: sanitize(data.type) || null,

        created_at_source: toIso(data.createdAt, null),
        updated_at_source: toIso(data.updatedAt || data.lastUpdatedAt || data.completedAt || data.failedAt || data.startedAt || data.capturedAt || data.createdAt, nowIso()),
        captured_at_source: toIso(data.capturedAt || data.fetchedAt, null),
        run_after_at_source: toIso(data.runAfterAt, null),

        data
    };
}

function mapRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitize(row.source_document_id || row.id),
        ...data,

        sourceId: data.sourceId || row.source_id || '',
        parentSourceId: data.parentSourceId || row.parent_source_id || '',
        title: data.title || row.title || '',
        status: data.status || row.status || '',
        category: data.category || row.category || '',
        knowledgeType: data.knowledgeType || row.knowledge_type || '',
        originalUrl: data.originalUrl || row.original_url || '',
        canonicalUrl: data.canonicalUrl || row.canonical_url || '',
        hostname: data.hostname || row.hostname || '',
        queuePriority: data.queuePriority ?? row.priority ?? 0,
        priority: data.priority ?? row.priority ?? 0,
        batchId: data.batchId || row.batch_id || '',

        createdAt: data.createdAt || row.created_at_source || row.created_at || '',
        updatedAt: data.updatedAt || row.updated_at_source || row.updated_at || ''
    };
}

async function upsertRecord(recordType, id, data = {}, options = {}) {
    const cleanId = sanitize(id) || buildId(recordType);
    const now = nowIso();

    const nextData = {
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now
    };

    const row = deriveMeta(recordType, cleanId, nextData, options);

    const { data: saved, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .upsert(row, { onConflict: 'source_document_path' })
        .select('*')
        .single();

    if (error) {
        throw new Error(`AI Nurture Supabase upsert failed (${recordType}/${cleanId}): ${error.message}`);
    }

    return mapRow(saved);
}

async function getRecord(recordType, id) {
    const cleanId = sanitize(id);

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', recordType)
        .eq('source_document_id', cleanId)
        .maybeSingle();

    if (error) {
        throw new Error(`AI Nurture Supabase lookup failed (${recordType}/${cleanId}): ${error.message}`);
    }

    return data ? mapRow(data) : null;
}

async function listRecords(recordType, limit = 100, filters = {}) {
    let query = yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', recordType)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(Math.max(1, Math.min(500, toNumber(limit, 100))));

    if (filters.sourceId) query = query.eq('source_id', sanitize(filters.sourceId));
    if (filters.parentSourceId) query = query.eq('parent_source_id', sanitize(filters.parentSourceId));
    if (filters.batchId) query = query.eq('batch_id', sanitize(filters.batchId));
    if (filters.status) query = query.eq('status', sanitize(filters.status).toLowerCase());

    const { data, error } = await query;

    if (error) {
        throw new Error(`AI Nurture Supabase list failed (${recordType}): ${error.message}`);
    }

    return (Array.isArray(data) ? data : []).map(mapRow);
}

const DEFAULT_SETTINGS = {
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
    }
};

async function getSettings() {
    const existing = await getRecord('settings', 'main');
    if (existing) return existing;

    return upsertRecord('settings', 'main', {
        ...DEFAULT_SETTINGS,
        createdAt: nowIso(),
        updatedAt: nowIso()
    });
}

async function updateSettings(payload = {}) {
    const current = await getSettings();

    return upsertRecord('settings', 'main', {
        ...current,
        ...stripUndefined(payload),
        updatedAt: nowIso()
    });
}

async function createSource(payload = {}) {
    const normalizedUrl = normalizeUrl(payload.originalUrl || payload.url);

    if (!normalizedUrl) {
        throw new Error('Valid URL is required.');
    }

    const { data: existing, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', 'source')
        .eq('canonical_url', normalizedUrl)
        .limit(1);

    if (error) {
        throw new Error(`AI Nurture source duplicate check failed: ${error.message}`);
    }

    if (Array.isArray(existing) && existing[0]) {
        return mapRow(existing[0]);
    }

    const id = buildId('src');

    return upsertRecord('source', id, {
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
        createdAt: nowIso(),
        updatedAt: nowIso(),
        fetchedAt: null,
        analyzedAt: null,
        approvedAt: null,
        absorbedAt: null,
        failedAt: null,
        lastError: '',
        retryCount: 0,
        rejectionReason: ''
    });
}

async function listSources(limit = 50) {
    return listRecords('source', limit);
}

async function getSourceById(sourceId) {
    return getRecord('source', sourceId);
}

async function updateSource(sourceId, payload = {}) {
    const current = await getSourceById(sourceId);

    return upsertRecord('source', sourceId, {
        ...(current || {}),
        ...stripUndefined(payload),
        updatedAt: nowIso()
    });
}

async function saveSnapshot(sourceId, payload = {}) {
    const id = buildId('snap');

    const doc = {
        sourceId: sanitize(sourceId),
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
        capturedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso()
    };

    const saved = await upsertRecord('snapshot', id, doc, { parentSourceId: sourceId });

    await updateSource(sourceId, {
        fetchedAt: nowIso(),
        title: doc.title || undefined,
        canonicalUrl: doc.finalUrl || undefined,
        hostname: doc.finalUrl ? hostnameFromUrl(doc.finalUrl) : undefined,
        status: 'fetched'
    });

    return saved;
}

async function getLatestSnapshot(sourceId) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', 'snapshot')
        .eq('parent_source_id', sanitize(sourceId))
        .order('captured_at_source', { ascending: false, nullsFirst: false })
        .limit(1);

    if (error) {
        throw new Error(`AI Nurture latest snapshot lookup failed: ${error.message}`);
    }

    return Array.isArray(data) && data[0] ? mapRow(data[0]) : null;
}

async function replaceChunks(sourceId, chunks = []) {
    const cleanSourceId = sanitize(sourceId);

    const { error: deleteError } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .delete()
        .eq('record_type', 'chunk')
        .eq('parent_source_id', cleanSourceId);

    if (deleteError) {
        throw new Error(`AI Nurture chunk cleanup failed: ${deleteError.message}`);
    }

    const created = [];

    for (const chunk of Array.isArray(chunks) ? chunks : []) {
        const index = Math.max(1, toNumber(chunk.index, created.length + 1));
        const id = String(index).padStart(4, '0');

        const payload = {
            sourceId: cleanSourceId,
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
            keyTakeaways: toCleanStringList(chunk.keyTakeaways, 8, 260),
            redFlags: toCleanStringList(chunk.redFlags, 8, 260),
            evidenceItems: sanitizeEvidenceItems(chunk.evidenceItems, 4),
            createdAt: nowIso(),
            updatedAt: nowIso()
        };

        created.push(await upsertRecord('chunk', id, payload, { parentSourceId: cleanSourceId }));
    }

    return created;
}

async function listSourceChunks(sourceId, limit = 60) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', 'chunk')
        .eq('parent_source_id', sanitize(sourceId))
        .order('source_document_id', { ascending: true })
        .limit(Math.max(1, Math.min(100, toNumber(limit, 60))));

    if (error) {
        throw new Error(`AI Nurture chunks lookup failed: ${error.message}`);
    }

    return (Array.isArray(data) ? data : []).map(mapRow);
}

async function createOrReplaceReview(sourceId, payload = {}) {
    const reviewId = sanitize(sourceId);

    return upsertRecord('review', reviewId, {
        sourceId: reviewId,
        overallDecision: sanitize(payload.overallDecision || 'reference_only'),
        summaryShort: sanitize(payload.summaryShort),
        summaryLong: sanitize(payload.summaryLong),
        absorbWhat: toCleanStringList(payload.absorbWhat, 16, 400),
        doNotAbsorbWhat: toCleanStringList(payload.doNotAbsorbWhat, 16, 400),
        riskNotes: toCleanStringList(payload.riskNotes, 16, 400),
        recommendedCategory: sanitize(payload.recommendedCategory || 'general'),
        recommendedKnowledgeType: sanitize(payload.recommendedKnowledgeType || 'framework'),
        domainVerdict: sanitize(payload.domainVerdict || 'neutral'),
        domainTrustScore: Number(toNumber(payload.domainTrustScore, 0).toFixed(2)),
        duplicateScore: Number(toNumber(payload.duplicateScore, 0).toFixed(2)),
        duplicateTopMatch: payload.duplicateTopMatch && typeof payload.duplicateTopMatch === 'object'
            ? payload.duplicateTopMatch
            : null,
        duplicateMatches: Array.isArray(payload.duplicateMatches) ? payload.duplicateMatches.slice(0, 5) : [],
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
        evidenceItems: sanitizeEvidenceItems(payload.evidenceItems, 8),
        evidenceCount: sanitizeEvidenceItems(payload.evidenceItems, 8).length,
        reviewNotes: Array.isArray(payload.reviewNotes) ? payload.reviewNotes : [],
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso()
    });
}

async function getReviewBySourceId(sourceId) {
    return getRecord('review', sourceId);
}

async function getSourceDetail(sourceId) {
    const [source, review, snapshot, chunks] = await Promise.all([
        getSourceById(sourceId),
        getReviewBySourceId(sourceId),
        getLatestSnapshot(sourceId),
        listSourceChunks(sourceId, 80)
    ]);

    if (!source) return null;

    return {
        ...source,
        review,
        latestSnapshot: snapshot,
        chunks
    };
}

async function appendReviewNote(sourceId, note = {}) {
    const review = await getReviewBySourceId(sourceId);
    const notes = Array.isArray(review?.reviewNotes) ? review.reviewNotes : [];

    const nextNote = {
        text: sanitize(note.text || note.note),
        author: sanitize(note.author || 'internal-operator'),
        createdAt: nowIso()
    };

    return createOrReplaceReview(sourceId, {
        ...(review || {}),
        reviewNotes: [...notes, nextNote]
    });
}

async function getUserOverlay(userId) {
    const existing = await getRecord('user_overlay', userId);

    return existing || {
        id: sanitize(userId),
        userId: sanitize(userId),
        rules: [],
        examples: [],
        redFlags: [],
        updatedAt: ''
    };
}

async function upsertUserOverlay(userId, payload = {}) {
    const cleanUserId = sanitize(userId);

    return upsertRecord('user_overlay', cleanUserId, {
        userId: cleanUserId,
        rules: toCleanStringList(payload.rules, 80, 420),
        examples: toCleanStringList(payload.examples, 60, 500),
        redFlags: toCleanStringList(payload.redFlags, 60, 420),
        notes: sanitize(payload.notes),
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso()
    });
}

async function createLibraryEntry(payload = {}) {
    const id = payload.id ? sanitize(payload.id) : buildId('lib');

    return upsertRecord('library', id, {
        sourceId: sanitize(payload.sourceId),
        title: sanitize(payload.title),
        category: sanitize(payload.category || 'general'),
        subCategory: sanitize(payload.subCategory),
        knowledgeType: sanitize(payload.knowledgeType || 'framework'),
        summary: sanitize(payload.summary),
        usableRules: toCleanStringList(payload.usableRules, 36, 420),
        doNotUseWhen: toCleanStringList(payload.doNotUseWhen, 18, 300),
        sourceUrl: sanitize(payload.sourceUrl),
        sourceTitle: sanitize(payload.sourceTitle),
        evidenceItems: sanitizeEvidenceItems(payload.evidenceItems, 8),
        evidenceCount: sanitizeEvidenceItems(payload.evidenceItems, 8).length,
        confidence: Number(toNumber(payload.confidence, 0).toFixed(2)),
        retrievalTags: dedupeAiNurtureTags(payload.retrievalTags),
        status: sanitize(payload.status || 'active'),
        staleVerdict: sanitize(payload.staleVerdict || 'unknown'),
        freshnessScore: Number(toNumber(payload.freshnessScore, 0.55).toFixed(2)),
        ageDays: payload.ageDays === null || payload.ageDays === undefined ? null : toNumber(payload.ageDays, 0),
        publishedAt: sanitize(payload.publishedAt),
        modifiedAt: sanitize(payload.modifiedAt),
        excludedFromPlanner: payload.excludedFromPlanner === true,
        createdAt: payload.createdAt || nowIso(),
        updatedAt: nowIso()
    });
}

async function createMemoryCards(sourceId, rules = [], meta = {}) {
    const created = [];

    for (const rule of Array.isArray(rules) ? rules : []) {
        const cleanRule = sanitize(rule);
        if (!cleanRule) continue;

        const id = buildId('card');

        created.push(await upsertRecord('memory_card', id, {
            knowledgeId: sanitize(meta.knowledgeId),
            sourceId: sanitize(sourceId),
            title: sanitize(meta.title || cleanRule.slice(0, 80)),
            cardType: 'rule',
            content: cleanRule,
            evidenceItems: sanitizeEvidenceItems(meta.evidenceItems, 4),
            priority: toNumber(meta.priority, 5),
            category: sanitize(meta.category || 'general'),
            isActive: true,
            createdAt: nowIso(),
            updatedAt: nowIso()
        }));
    }

    return created;
}

async function approveSource(sourceId, payload = {}) {
    const source = await getSourceById(sourceId);
    const review = await getReviewBySourceId(sourceId);

    if (!source) {
        throw new Error('Source not found.');
    }

    const rules = [
        ...toCleanStringList(review?.absorbWhat, 12, 420),
        ...toCleanStringList(payload.rules, 12, 420)
    ];

    const libraryEntry = await createLibraryEntry({
        sourceId,
        title: review?.summaryShort || source.title || source.canonicalUrl || 'AI Nurture Knowledge',
        category: review?.recommendedCategory || payload.category || 'general',
        knowledgeType: review?.recommendedKnowledgeType || 'framework',
        summary: review?.summaryLong || review?.summaryShort || source.title || source.canonicalUrl || '',
        usableRules: rules,
        doNotUseWhen: review?.doNotAbsorbWhat || [],
        sourceUrl: source.canonicalUrl || source.originalUrl || '',
        sourceTitle: source.title || '',
        confidence: review?.scores?.trust || review?.domainTrustScore || 0.72,
        retrievalTags: dedupeAiNurtureTags([
            ...(source.manualTags || []),
            ...(source.topicHints || []),
            review?.recommendedCategory,
            review?.recommendedKnowledgeType
        ]),
        status: 'active',
        staleVerdict: review?.staleVerdict || 'unknown',
        freshnessScore: review?.freshnessScore ?? 0.55,
        ageDays: review?.ageDays,
        evidenceItems: review?.evidenceItems || []
    });

    const cards = await createMemoryCards(sourceId, rules, {
        knowledgeId: libraryEntry.id,
        title: libraryEntry.title,
        category: libraryEntry.category,
        priority: 6,
        evidenceItems: libraryEntry.evidenceItems
    });

    const updatedSource = await updateSource(sourceId, {
        status: 'approved',
        approvedAt: nowIso(),
        absorbedAt: nowIso(),
        rejectionReason: ''
    });

    const contextPacks = await rebuildContextPacks();

    return {
        source: updatedSource,
        review,
        libraryEntry,
        cards,
        contextPacks
    };
}

async function rejectSource(sourceId, reason = '') {
    return updateSource(sourceId, {
        status: 'rejected',
        rejectionReason: sanitize(reason),
        updatedAt: nowIso()
    });
}

async function listLibrary(limit = 100) {
    const items = await listRecords('library', Math.max(1, Math.min(200, toNumber(limit, 100))));
    return items.filter((item) => sanitize(item.status || 'active') === 'active');
}

async function listMemoryCards(limit = 160) {
    const items = await listRecords('memory_card', Math.max(1, Math.min(300, toNumber(limit, 160))));
    return items.filter((item) => item.isActive === true);
}

async function listContextPacks(limit = 60) {
    const items = await listRecords('context_pack', Math.max(1, Math.min(120, toNumber(limit, 60))));
    return items.filter((item) => item.isActive === true || sanitize(item.status || 'active') === 'active');
}

async function getLibraryForDuplicateCheck(limit = 150) {
    return listLibrary(limit);
}

function collectAiNurtureEvidenceForContext(libraryItems = [], filters = {}) {
    const categoryHints = Array.isArray(filters.categoryHints)
        ? filters.categoryHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];

    const tagHints = Array.isArray(filters.tagHints)
        ? filters.tagHints.map((item) => sanitize(item).toLowerCase()).filter(Boolean)
        : [];

    const scored = (Array.isArray(libraryItems) ? libraryItems : [])
        .map((item) => {
            const summary = [
                item.title,
                item.summary,
                item.category,
                item.knowledgeType,
                ...(Array.isArray(item.retrievalTags) ? item.retrievalTags : [])
            ].join(' ').toLowerCase();

            let score = 0;
            for (const hint of categoryHints) if (summary.includes(hint)) score += 2;
            for (const hint of tagHints) if (summary.includes(hint)) score += 3;

            return {
                ...item,
                _evidenceScore: score
            };
        })
        .sort((a, b) => b._evidenceScore - a._evidenceScore);

    const evidence = [];
    const seen = new Set();

    for (const item of scored) {
        for (const evidenceItem of sanitizeEvidenceItems(item.evidenceItems, 4)) {
            const key = [
                evidenceItem.sourceUrl,
                evidenceItem.timestampLabel,
                evidenceItem.chunkIndex,
                evidenceItem.claim
            ].join('|');

            if (seen.has(key)) continue;
            seen.add(key);

            evidence.push({
                ...evidenceItem,
                knowledgeId: sanitize(item.id),
                knowledgeTitle: sanitize(item.title),
                category: sanitize(item.category)
            });

            if (evidence.length >= 8) return evidence;
        }
    }

    return evidence;
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

    const selectedContext = aiNurturePolicy.selectContextFromAssets({
        packs,
        libraryItems,
        memoryCards,
        categoryHints,
        tagHints,
        limits: settings?.plannerPackLimits || {},
        overlayKnowledge
    });

    return {
        ...selectedContext,
        evidenceItems: collectAiNurtureEvidenceForContext(libraryItems, {
            categoryHints,
            tagHints
        })
    };
}

async function rebuildContextPacks() {
    const [libraryItems, memoryCards] = await Promise.all([
        listLibrary(250),
        listMemoryCards(300)
    ]);

    const grouped = new Map();

    for (const item of [...libraryItems, ...memoryCards]) {
        const category = sanitize(item.category || 'general').toLowerCase() || 'general';
        if (!grouped.has(category)) {
            grouped.set(category, {
                rules: [],
                examples: [],
                redFlags: [],
                sourceIds: new Set(),
                evidenceItems: []
            });
        }

        const group = grouped.get(category);

        if (Array.isArray(item.usableRules)) group.rules.push(...item.usableRules);
        if (item.content) group.rules.push(item.content);
        if (Array.isArray(item.examples)) group.examples.push(...item.examples);
        if (Array.isArray(item.redFlags)) group.redFlags.push(...item.redFlags);
        if (item.sourceId) group.sourceIds.add(item.sourceId);
        if (Array.isArray(item.evidenceItems)) group.evidenceItems.push(...item.evidenceItems);
    }

    const packs = [];

    for (const [category, group] of grouped.entries()) {
        const id = toDocKey(category, 'general');

        packs.push(await upsertRecord('context_pack', id, {
            category,
            title: `${category.replace(/_/g, ' ')} context pack`,
            rules: toCleanStringList(group.rules, 40, 420),
            examples: toCleanStringList(group.examples, 20, 500),
            redFlags: toCleanStringList(group.redFlags, 25, 420),
            sourceIds: Array.from(group.sourceIds).slice(0, 60),
            evidenceItems: sanitizeEvidenceItems(group.evidenceItems, 10),
            isActive: true,
            status: 'active',
            rebuiltAt: nowIso(),
            createdAt: nowIso(),
            updatedAt: nowIso()
        }));
    }

    return packs;
}

function normalizeMentorKnowledgeKey(value = '') {
    return toDocKey(value, '');
}

function buildMentorKnowledgeRules(payload = {}) {
    const rules = [];

    rules.push(...toCleanStringList(payload.rules || payload.usableRules, 36, 420));
    rules.push(...toCleanStringList(payload.coreIdeas, 8, 420));
    rules.push(...toCleanStringList(payload.businessFrameworks, 8, 420));
    rules.push(...toCleanStringList(payload.practicalLessons, 8, 420));

    const leadershipStyle = sanitize(payload.leadershipStyle);
    const communicationStyle = sanitize(payload.communicationStyle);
    const decisionMakingStyle = sanitize(payload.decisionMakingStyle);

    if (leadershipStyle) rules.push(`Leadership style lens: ${leadershipStyle.slice(0, 360)}`);
    if (communicationStyle) rules.push(`Communication style lens: ${communicationStyle.slice(0, 360)}`);
    if (decisionMakingStyle) rules.push(`Decision-making style lens: ${decisionMakingStyle.slice(0, 360)}`);

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

    const contextPacks = payload.approveNow === false ? [] : await rebuildContextPacks();

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

    const libraryEntry = await getRecord('library', cleanLibraryId);

    if (!libraryEntry) {
        throw new Error('Mentor pack not found.');
    }

    if (sanitize(libraryEntry.knowledgeType).toLowerCase() !== 'mentor_pack') {
        throw new Error('Only mentor knowledge packs can be deleted from this endpoint.');
    }

    const sourceId = sanitize(libraryEntry.sourceId);

    const { data: cards, error: cardsError } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', 'memory_card')
        .or(`source_id.eq.${sourceId},data->>knowledgeId.eq.${cleanLibraryId}`);

    if (cardsError) {
        throw new Error(`Mentor card lookup failed: ${cardsError.message}`);
    }

    const cardRows = Array.isArray(cards) ? cards : [];
    const deletePaths = [
        libraryEntry.source_document_path || recordPathFor('library', cleanLibraryId),
        ...cardRows.map((row) => row.source_document_path).filter(Boolean)
    ];

    const { error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .delete()
        .in('source_document_path', deletePaths);

    if (error) {
        throw new Error(`Mentor pack delete failed: ${error.message}`);
    }

    const contextPacks = await rebuildContextPacks();

    return {
        deletedLibraryId: cleanLibraryId,
        deletedSourceId: sourceId,
        deletedCardCount: cardRows.length,
        contextPacks
    };
}

async function createBatchRun(payload = {}) {
    const id = buildId('batch');
    const requestedUrls = Array.isArray(payload.requestedUrls)
        ? payload.requestedUrls.map((item) => sanitize(item)).filter(Boolean).slice(0, 120)
        : [];

    return upsertRecord('batch', id, {
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
        createdAt: nowIso(),
        updatedAt: nowIso()
    });
}

async function updateBatchRun(batchId, payload = {}) {
    const current = await getBatchRunById(batchId);

    return upsertRecord('batch', batchId, {
        ...(current || {}),
        ...stripUndefined(payload),
        updatedAt: nowIso()
    });
}

async function listBatchRuns(limit = 40) {
    return listRecords('batch', Math.max(1, Math.min(100, toNumber(limit, 40))));
}

async function getBatchRunById(batchId = '') {
    return getRecord('batch', batchId);
}

async function listJobsByBatch(batchId = '', limit = 300) {
    return listRecords('job', Math.max(1, Math.min(500, toNumber(limit, 300))), {
        batchId: sanitize(batchId)
    });
}

async function createJob(payload = {}) {
    const id = buildId('job');

    return upsertRecord('job', id, {
        type: sanitize(payload.type || 'process-source'),
        sourceId: sanitize(payload.sourceId),
        priority: toNumber(payload.priority, 3),
        reason: sanitize(payload.reason),
        batchId: sanitize(payload.batchId),
        batchTitle: sanitize(payload.batchTitle),
        batchMentorKey: sanitize(payload.batchMentorKey),
        batchMentorName: sanitize(payload.batchMentorName),
        status: 'queued',
        attempts: 0,
        runAfterAt: toIso(payload.runAfterAt || nowIso()),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        startedAt: '',
        completedAt: '',
        failedAt: '',
        lastError: '',
        resultSourceId: ''
    });
}

async function listJobs(limit = 100) {
    return listRecords('job', Math.max(1, Math.min(500, toNumber(limit, 100))));
}

async function claimNextQueuedJob() {
    const now = nowIso();

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('record_type', 'job')
        .eq('status', 'queued')
        .or(`run_after_at_source.is.null,run_after_at_source.lte.${now}`)
        .order('priority', { ascending: false, nullsFirst: false })
        .order('created_at_source', { ascending: true, nullsFirst: false })
        .limit(10);

    if (error) {
        throw new Error(`AI Nurture queued job lookup failed: ${error.message}`);
    }

    const candidates = Array.isArray(data) ? data : [];

    for (const candidate of candidates) {
        const job = mapRow(candidate);

        const nextJob = {
            ...job,
            status: 'running',
            startedAt: nowIso(),
            updatedAt: nowIso()
        };

        const { data: updated, error: updateError } = await yhuSupabaseAdmin
            .from(TABLE_NAME)
            .update(deriveMeta('job', job.id, nextJob))
            .eq('source_document_path', candidate.source_document_path)
            .eq('status', 'queued')
            .select('*')
            .maybeSingle();

        if (updateError) {
            throw new Error(`AI Nurture queued job claim failed: ${updateError.message}`);
        }

        if (updated) return mapRow(updated);
    }

    return null;
}

async function completeJob(jobId, payload = {}) {
    const current = await getRecord('job', jobId);

    return upsertRecord('job', jobId, {
        ...(current || {}),
        status: 'completed',
        completedAt: nowIso(),
        updatedAt: nowIso(),
        lastError: '',
        resultSourceId: sanitize(payload.resultSourceId)
    });
}

async function failJob(jobId, error, payload = {}) {
    const current = await getRecord('job', jobId);
    const attempts = toNumber(payload.attempts ?? current?.attempts, 0);

    return upsertRecord('job', jobId, {
        ...(current || {}),
        status: sanitize(payload.status || 'failed'),
        failedAt: nowIso(),
        updatedAt: nowIso(),
        attempts,
        lastError: sanitize(error?.message || error || 'Job failed.'),
        runAfterAt: payload.runAfterAt ? toIso(payload.runAfterAt) : current?.runAfterAt || ''
    });
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
    failJob
};
