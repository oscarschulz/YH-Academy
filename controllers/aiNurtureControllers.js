const aiNurtureRepo = require('../backend/repositories/aiNurtureFirestoreRepo');
const urlContentExtractor = require('../backend/services/urlContentExtractor');
const aiNurtureAnalyzer = require('../backend/services/aiNurtureAnalyzer');
const aiNurturePolicy = require('../backend/services/aiNurturePolicy');

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function sendError(res, error, fallbackMessage = 'Something went wrong.', statusCode = 500) {
    const message = sanitize(error?.message, fallbackMessage);
    return res.status(statusCode).json({
        success: false,
        message
    });
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

async function runSourceProcessing(sourceId) {
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
        const review = await aiNurtureRepo.createOrReplaceReview(sourceId, buildBlockedDomainReview(source, domainInfo));
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
            autoApproved: false
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
            description: extraction.description || ''
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
        domainVerdict: analysis.review?.domainVerdict,
        domainTrustScore: analysis.review?.domainTrustScore,
        duplicateScore: analysis.review?.duplicateScore,
        duplicateTopMatchTitle: analysis.review?.duplicateTopMatch?.title || ''
    });

    let autoApproved = false;
    if (settings?.autoApprove === true && analysis.review?.overallDecision === 'approve') {
        await aiNurtureRepo.approveSource(sourceId);
        autoApproved = true;
    }

    return {
        source: updatedSource,
        snapshot,
        review,
        chunks,
        autoApproved
    };
}

exports.bootstrap = async (req, res) => {
    try {
        const settings = await aiNurtureRepo.getSettings();
        return res.json({
            success: true,
            settings,
            gate: sanitize(req.params?.gate),
            app: 'ai-nurture'
        });
    } catch (error) {
        return sendError(res, error, 'Failed to bootstrap AI Nurture.');
    }
};

exports.getSettings = async (req, res) => {
    try {
        const settings = await aiNurtureRepo.getSettings();
        return res.json({ success: true, settings });
    } catch (error) {
        return sendError(res, error, 'Failed to load settings.');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const settings = await aiNurtureRepo.updateSettings({
            featureEnabled: req.body?.featureEnabled,
            autoProcess: req.body?.autoProcess,
            autoApprove: req.body?.autoApprove,
            trustThreshold: req.body?.trustThreshold,
            relevanceThreshold: req.body?.relevanceThreshold,
            noveltyThreshold: req.body?.noveltyThreshold,
            duplicationThreshold: req.body?.duplicationThreshold,
            maxSummaryLength: req.body?.maxSummaryLength,
            blockedDomains: Array.isArray(req.body?.blockedDomains) ? req.body.blockedDomains : undefined,
            allowedDomains: Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains : undefined
        });

        return res.json({ success: true, settings });
    } catch (error) {
        return sendError(res, error, 'Failed to update settings.');
    }
};

exports.createSource = async (req, res) => {
    try {
        const source = await aiNurtureRepo.createSource({
            originalUrl: req.body?.url || req.body?.originalUrl,
            title: req.body?.title,
            queuePriority: req.body?.queuePriority,
            manualTags: req.body?.manualTags,
            topicHints: req.body?.topicHints,
            submittedBy: 'internal-operator',
            submittedFrom: 'internal-console'
        });

        await aiNurtureRepo.createJob({
            type: 'process-source',
            sourceId: source.id,
            priority: Number(source.queuePriority || 3),
            reason: 'initial-submit',
            runAfterAt: new Date().toISOString()
        });

        return res.status(201).json({
            success: true,
            source
        });
    } catch (error) {
        const badRequest = /valid url required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to create source.', badRequest ? 400 : 500);
    }
};

exports.listSources = async (req, res) => {
    try {
        const sources = await aiNurtureRepo.listSources(Number.parseInt(req.query.limit, 10) || 50);
        return res.json({
            success: true,
            sources
        });
    } catch (error) {
        return sendError(res, error, 'Failed to list sources.');
    }
};

exports.getSourceById = async (req, res) => {
    try {
        const detail = await aiNurtureRepo.getSourceDetail(req.params?.id);
        if (!detail?.source) {
            return res.status(404).json({
                success: false,
                message: 'Source not found.'
            });
        }

        return res.json({
            success: true,
            ...detail
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load source.');
    }
};

exports.processSource = async (req, res) => {
    const sourceId = sanitize(req.params?.id);

    try {
        const result = await runSourceProcessing(sourceId);
        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        if (sourceId) {
            const source = await aiNurtureRepo.getSourceById(sourceId).catch(() => null);
            const nextAttempts = Number(source?.retryCount || 0);

            await aiNurtureRepo.updateSource(sourceId, {
                status: 'failed',
                failedAt: new Date().toISOString(),
                lastError: sanitize(error?.message)
            }).catch(() => null);

            if (nextAttempts < 3) {
                const delayMinutes = nextAttempts >= 2 ? 60 : 15;
                const runAfterAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

                await aiNurtureRepo.createJob({
                    type: 'process-source',
                    sourceId,
                    priority: 2,
                    reason: 'auto-reprocess',
                    runAfterAt
                }).catch(() => null);
            }
        }

        return sendError(res, error, 'Failed to process source.');
    }
};

exports.approveSource = async (req, res) => {
    try {
        const result = await aiNurtureRepo.approveSource(req.params?.id);
        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        const notFound = /not found/i.test(error?.message || '');
        return sendError(res, error, 'Failed to approve source.', notFound ? 404 : 500);
    }
};

exports.rejectSource = async (req, res) => {
    try {
        const source = await aiNurtureRepo.rejectSource(req.params?.id, req.body?.reason);
        return res.json({
            success: true,
            source
        });
    } catch (error) {
        return sendError(res, error, 'Failed to reject source.');
    }
};

exports.listLibrary = async (req, res) => {
    try {
        const items = await aiNurtureRepo.listLibrary(Number.parseInt(req.query.limit, 10) || 100);
        return res.json({
            success: true,
            items
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load library.');
    }
};

exports.previewContext = async (req, res) => {
    try {
        const context = await aiNurtureRepo.buildActiveKnowledgeContext({
            categoryHints: req.body?.categoryHints,
            tagHints: req.body?.tagHints
        });

        return res.json({
            success: true,
            context
        });
    } catch (error) {
        return sendError(res, error, 'Failed to preview context.');
    }
};

exports.listJobs = async (req, res) => {
    try {
        const jobs = await aiNurtureRepo.listJobs(Number.parseInt(req.query.limit, 10) || 50);
        return res.json({
            success: true,
            jobs
        });
    } catch (error) {
        return sendError(res, error, 'Failed to list jobs.');
    }
};

exports.runNextJob = async (req, res) => {
    try {
        const job = await aiNurtureRepo.claimNextQueuedJob();
        if (!job) {
            return res.json({
                success: true,
                job: null,
                message: 'No queued job is ready.'
            });
        }

        try {
            let result = null;

            if (job.type === 'process-source' && job.sourceId) {
                result = await runSourceProcessing(job.sourceId);
            } else {
                throw new Error(`Unsupported job type: ${job.type}`);
            }

            await aiNurtureRepo.completeJob(job.id, {
                resultSourceId: job.sourceId
            });

            return res.json({
                success: true,
                jobId: job.id,
                result
            });
        } catch (error) {
            const attempts = Number(job.attempts || 0) + 1;
            const retryable = attempts < 3;
            const runAfterAt = retryable
                ? new Date(Date.now() + (attempts >= 2 ? 60 : 15) * 60 * 1000).toISOString()
                : null;

            await aiNurtureRepo.failJob(job.id, error, {
                attempts,
                status: retryable ? 'queued' : 'failed',
                runAfterAt
            });

            throw error;
        }
    } catch (error) {
        return sendError(res, error, 'Failed to run next nurture job.');
    }
};

exports.rebuildContextPacks = async (req, res) => {
    try {
        const packs = await aiNurtureRepo.rebuildContextPacks();
        return res.json({
            success: true,
            packs
        });
    } catch (error) {
        return sendError(res, error, 'Failed to rebuild context packs.');
    }
};