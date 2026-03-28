const aiNurtureRepo = require('../backend/repositories/aiNurtureFirestoreRepo');

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

function buildStarterReview(source = {}) {
    const url = sanitize(source.canonicalUrl || source.originalUrl);
    const hostname = sanitize(source.hostname || '');

    return {
        overallDecision: 'reference_only',
        summaryShort: `Starter review generated for ${hostname || 'this source'}.`,
        summaryLong: `This is a starter review for ${url}. Real extraction and AI scoring will be connected in the next phase.`,
        absorbWhat: [
            'Keep the operational core if the article contains reusable execution rules.',
            'Prefer concise frameworks over motivational fluff.',
            'Use only knowledge that improves mission selection or adaptive planning.'
        ],
        doNotAbsorbWhat: [
            'Sales copy',
            'Repetitive filler sections',
            'Low-signal generic advice'
        ],
        riskNotes: [
            'This review is placeholder-only until extractor and analyzer are connected.'
        ],
        recommendedCategory: 'general',
        recommendedKnowledgeType: 'framework',
        scores: {
            relevance: 0.55,
            novelty: 0.40,
            trust: 0.50,
            duplication: 0.15,
            actionability: 0.45
        },
        approvedChunkIndexes: [],
        rejectedChunkIndexes: []
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
        const source = await aiNurtureRepo.getSourceById(req.params?.id);
        if (!source) {
            return res.status(404).json({
                success: false,
                message: 'Source not found.'
            });
        }

        const review = await aiNurtureRepo.getReviewBySourceId(source.id);

        return res.json({
            success: true,
            source,
            review
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load source.');
    }
};

exports.processSource = async (req, res) => {
    try {
        const sourceId = sanitize(req.params?.id);
        const source = await aiNurtureRepo.getSourceById(sourceId);

        if (!source) {
            return res.status(404).json({
                success: false,
                message: 'Source not found.'
            });
        }

        await aiNurtureRepo.updateSource(sourceId, {
            status: 'processing',
            lastError: ''
        });

        const review = await aiNurtureRepo.createOrReplaceReview(sourceId, buildStarterReview(source));

        const updatedSource = await aiNurtureRepo.updateSource(sourceId, {
            status: 'reviewed',
            analyzedAt: new Date(),
            title: source.title || source.hostname || source.canonicalUrl
        });

        return res.json({
            success: true,
            source: updatedSource,
            review
        });
    } catch (error) {
        const sourceId = sanitize(req.params?.id);
        if (sourceId) {
            await aiNurtureRepo.updateSource(sourceId, {
                status: 'failed',
                failedAt: new Date(),
                lastError: sanitize(error?.message)
            }).catch(() => null);
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