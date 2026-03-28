const aiNurtureRepo = require('../repositories/aiNurtureFirestoreRepo');
const urlContentExtractor = require('./urlContentExtractor');
const aiNurtureAnalyzer = require('./aiNurtureAnalyzer');
const aiNurturePolicy = require('./aiNurturePolicy');

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function buildBlockedDomainReview(source = {}, domainInfo = {}) {
    return {
        overallDecision: 'reject',
        summaryShort: 'Rejected before extraction because the source domain is blocked.',
        summaryLong: `Source ${sanitize(source.canonicalUrl || source.originalUrl)} was rejected because ${sanitize(domainInfo.reason || 'the domain is blocked')}.`,
        absorbWhat: [],
        doNotAbsorbWhat: ['Blocked domain.'],
        riskNotes: [sanitize(domainInfo.reason || 'Blocked domain.')],
        recommendedCategory: 'general',
        recommendedKnowledgeType: 'framework',
        domainVerdict: sanitize(domainInfo.domainVerdict || 'blocked'),
        domainTrustScore: Number(domainInfo.domainTrustScore || 0),
        duplicateScore: 0,
        duplicateTopMatch: null,
        staleVerdict: 'unknown',
        freshnessScore: 0.4,
        ageDays: null,
        scores: {
            relevance: 0,
            novelty: 0,
            trust: Number(domainInfo.domainTrustScore || 0),
            duplication: 0,
            actionability: 0
        },
        approvedChunkIndexes: [],
        rejectedChunkIndexes: []
    };
}

async function processSourceById(sourceId) {
    const source = await aiNurtureRepo.getSourceById(sourceId);
    if (!source) {
        throw new Error('Source not found.');
    }

    const settings = await aiNurtureRepo.getSettings();
    const domainInfo = aiNurturePolicy.evaluateDomainTrust(source.hostname || '', settings);

    await aiNurtureRepo.updateSource(sourceId, {
        status: 'processing',
        lastError: '',
        retryCount: Number(source.retryCount || 0) + 1,
        domainVerdict: domainInfo.domainVerdict,
        domainTrustScore: domainInfo.domainTrustScore
    });

    if (domainInfo.blocked) {
        const review = await aiNurtureRepo.createOrReplaceReview(
            sourceId,
            buildBlockedDomainReview(source, domainInfo)
        );

        const updatedSource = await aiNurtureRepo.updateSource(sourceId, {
            status: 'rejected',
            analyzedAt: new Date().toISOString(),
            rejectionReason: domainInfo.reason || 'Blocked domain.'
        });

        return {
            source: updatedSource,
            snapshot: null,
            review,
            chunks: [],
            autoApproved: false,
            approval: null
        };
    }

    const extraction = await urlContentExtractor.extractFromUrl(source.canonicalUrl || source.originalUrl);
    const snapshot = await aiNurtureRepo.saveSnapshot(sourceId, extraction);
    const libraryForDuplicateCheck = await aiNurtureRepo.getLibraryForDuplicateCheck(150);

    const analysis = await aiNurtureAnalyzer.analyzeSource({
        source: {
            ...source,
            canonicalUrl: extraction.finalUrl || source.canonicalUrl,
            hostname: extraction.finalUrl ? new URL(extraction.finalUrl).hostname : source.hostname,
            title: extraction.title || source.title,
            description: extraction.description || '',
            publishedAt: extraction.publishedAt || '',
            modifiedAt: extraction.modifiedAt || ''
        },
        snapshot,
        settings,
        existingLibrary: libraryForDuplicateCheck
    });

    const chunks = await aiNurtureRepo.replaceChunks(sourceId, analysis.chunks || []);
    const review = await aiNurtureRepo.createOrReplaceReview(sourceId, analysis.review || {});

    const updatedSource = await aiNurtureRepo.updateSource(sourceId, {
        status: 'reviewed',
        analyzedAt: new Date().toISOString(),
        title: extraction.title || source.title || source.hostname || source.canonicalUrl,
        canonicalUrl: extraction.finalUrl || source.canonicalUrl,
        hostname: extraction.finalUrl ? new URL(extraction.finalUrl).hostname : source.hostname,
        domainVerdict: review.domainVerdict,
        domainTrustScore: review.domainTrustScore,
        duplicateScore: review.duplicateScore,
        duplicateTopMatchTitle: review?.duplicateTopMatch?.title || '',
        staleVerdict: review.staleVerdict || 'unknown',
        freshnessScore: review.freshnessScore,
        ageDays: review.ageDays
    });

    let approval = null;
    let autoApproved = false;

    if (settings?.autoApprove === true && review?.overallDecision === 'approve') {
        approval = await aiNurtureRepo.approveSource(sourceId);
        autoApproved = true;
    }

    return {
        source: updatedSource,
        snapshot,
        review,
        chunks,
        autoApproved,
        approval
    };
}

async function runNextQueuedJob() {
    const job = await aiNurtureRepo.claimNextQueuedJob();
    if (!job) {
        return {
            job: null,
            result: null
        };
    }

    try {
        let result = null;

        if (job.type === 'process-source' && job.sourceId) {
            result = await processSourceById(job.sourceId);
        } else {
            throw new Error(`Unsupported job type: ${job.type}`);
        }

        await aiNurtureRepo.completeJob(job.id, {
            resultSourceId: job.sourceId
        });

        return { job, result };
    } catch (error) {
        const attempts = Number(job.attempts || 0) + 1;
        const retryable = attempts < 3;
        const delayMinutes = attempts >= 2 ? 60 : 15;
        const runAfterAt = retryable
            ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
            : null;

        await aiNurtureRepo.failJob(job.id, error, {
            attempts,
            status: retryable ? 'queued' : 'failed',
            runAfterAt
        });

        throw error;
    }
}

module.exports = {
    processSourceById,
    runNextQueuedJob
};