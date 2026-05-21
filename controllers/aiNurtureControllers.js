const aiNurtureRepo = require('../backend/repositories/aiNurtureFirestoreRepo');
const aiNurtureJobRunner = require('../backend/services/aiNurtureJobRunner');

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
            allowedDomains: Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains : undefined,
            staleDaysDefault: req.body?.staleDaysDefault,
            staleDaysByCategory: req.body?.staleDaysByCategory && typeof req.body.staleDaysByCategory === 'object'
                ? req.body.staleDaysByCategory
                : undefined,
            plannerPackLimits: req.body?.plannerPackLimits && typeof req.body.plannerPackLimits === 'object'
                ? req.body.plannerPackLimits
                : undefined
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

function normalizeBatchSourceUrls(values = []) {
    const rawValues = Array.isArray(values)
        ? values
        : String(values || '').match(/https?:\/\/[^\s,]+/gi) || String(values || '').split(/\n|,/);

    const urls = [];

    for (const value of rawValues) {
        const clean = sanitize(value)
            .replace(/[)\].,;]+$/g, '')
            .trim();

        if (!/^https?:\/\//i.test(clean)) continue;

        try {
            const parsed = new URL(clean);
            parsed.hash = '';
            const normalized = parsed.toString();

            if (!urls.includes(normalized)) {
                urls.push(normalized);
            }
        } catch (_) {}

        if (urls.length >= 100) break;
    }

    return urls;
}

exports.createBatchSources = async (req, res) => {
    try {
        const urls = normalizeBatchSourceUrls(req.body?.urls || req.body?.links || req.body?.bulkUrls);
        const queuePriority = Math.max(1, Math.min(5, Number.parseInt(req.body?.queuePriority, 10) || 3));
        const queueJobs = req.body?.queueJobs !== false;
        const titlePrefix = sanitize(req.body?.titlePrefix || req.body?.sourceTitlePrefix || '');
        const mentorKey = sanitize(req.body?.mentorKey || '').toLowerCase();
        const mentorName = sanitize(req.body?.mentorName || '');

        const manualTags = [
            ...toStringList(req.body?.manualTags || req.body?.tags),
            mentorKey,
            mentorKey.replace(/_/g, ' '),
            mentorName
        ].filter(Boolean);

        const topicHints = [
            ...toStringList(req.body?.topicHints),
            mentorName,
            mentorKey.replace(/_/g, ' ')
        ].filter(Boolean);

        if (!urls.length) {
            return res.status(400).json({
                success: false,
                message: 'At least one valid URL is required.'
            });
        }

        const sources = [];
        const jobs = [];
        const failed = [];

        for (let index = 0; index < urls.length; index += 1) {
            const url = urls[index];

            try {
                const source = await aiNurtureRepo.createSource({
                    originalUrl: url,
                    title: titlePrefix ? `${titlePrefix} ${index + 1}` : '',
                    queuePriority,
                    manualTags,
                    topicHints,
                    submittedBy: 'internal-operator',
                    submittedFrom: 'internal-console-batch'
                });

                sources.push(source);

                if (queueJobs) {
                    const job = await aiNurtureRepo.createJob({
                        type: 'process-source',
                        sourceId: source.id,
                        priority: queuePriority,
                        reason: 'batch-submit',
                        runAfterAt: new Date().toISOString()
                    });

                    jobs.push(job);
                }
            } catch (error) {
                failed.push({
                    url,
                    message: sanitize(error?.message || 'Failed to create source.')
                });
            }
        }

        return res.status(failed.length && !sources.length ? 400 : failed.length ? 207 : 201).json({
            success: sources.length > 0,
            requestedCount: urls.length,
            createdCount: sources.length,
            jobCount: jobs.length,
            failedCount: failed.length,
            mentorKey,
            mentorName,
            sources,
            jobs,
            failed
        });
    } catch (error) {
        return sendError(res, error, 'Failed to create batch sources.');
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
        const result = await aiNurtureJobRunner.processSourceById(sourceId);

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

exports.queueReprocess = async (req, res) => {
    try {
        const sourceId = sanitize(req.params?.id);
        const source = await aiNurtureRepo.getSourceById(sourceId);

        if (!source) {
            return res.status(404).json({
                success: false,
                message: 'Source not found.'
            });
        }

        const job = await aiNurtureRepo.createJob({
            type: 'process-source',
            sourceId,
            priority: 4,
            reason: 'manual-reprocess',
            runAfterAt: new Date().toISOString()
        });

        return res.json({
            success: true,
            job
        });
    } catch (error) {
        return sendError(res, error, 'Failed to queue reprocess.');
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
exports.addReviewNote = async (req, res) => {
    try {
        const review = await aiNurtureRepo.appendReviewNote(req.params?.id, {
            note: req.body?.note,
            labels: req.body?.labels,
            author: req.body?.author || 'internal-operator',
            noteType: req.body?.noteType || 'review'
        });

        return res.json({
            success: true,
            review
        });
    } catch (error) {
        const badRequest = /required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to add review note.', badRequest ? 400 : 500);
    }
};

exports.getUserOverlay = async (req, res) => {
    try {
        const overlay = await aiNurtureRepo.getUserOverlay(req.params?.uid);

        return res.json({
            success: true,
            overlay: overlay || {
                userId: sanitize(req.params?.uid),
                note: '',
                rules: [],
                redFlags: [],
                focusThemes: [],
                tags: [],
                isActive: false
            }
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load user overlay.');
    }
};

exports.updateUserOverlay = async (req, res) => {
    try {
        const overlay = await aiNurtureRepo.upsertUserOverlay(req.params?.uid, {
            note: req.body?.note,
            rules: req.body?.rules,
            redFlags: req.body?.redFlags,
            focusThemes: req.body?.focusThemes,
            tags: req.body?.tags,
            isActive: req.body?.isActive,
            updatedBy: req.body?.updatedBy || 'internal-operator'
        });

        return res.json({
            success: true,
            overlay
        });
    } catch (error) {
        const badRequest = /user id is required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to update user overlay.', badRequest ? 400 : 500);
    }
};
exports.addReviewNote = async (req, res) => {
    try {
        const review = await aiNurtureRepo.appendReviewNote(req.params?.id, {
            note: req.body?.note,
            labels: req.body?.labels,
            author: req.body?.author || 'internal-operator',
            noteType: req.body?.noteType || 'review'
        });

        return res.json({
            success: true,
            review
        });
    } catch (error) {
        const badRequest = /required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to add review note.', badRequest ? 400 : 500);
    }
};

exports.getUserOverlay = async (req, res) => {
    try {
        const overlay = await aiNurtureRepo.getUserOverlay(req.params?.uid);

        return res.json({
            success: true,
            overlay: overlay || {
                userId: sanitize(req.params?.uid),
                note: '',
                rules: [],
                redFlags: [],
                focusThemes: [],
                tags: [],
                isActive: false
            }
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load user overlay.');
    }
};

exports.updateUserOverlay = async (req, res) => {
    try {
        const overlay = await aiNurtureRepo.upsertUserOverlay(req.params?.uid, {
            note: req.body?.note,
            rules: req.body?.rules,
            redFlags: req.body?.redFlags,
            focusThemes: req.body?.focusThemes,
            tags: req.body?.tags,
            isActive: req.body?.isActive,
            updatedBy: req.body?.updatedBy || 'internal-operator'
        });

        return res.json({
            success: true,
            overlay
        });
    } catch (error) {
        const badRequest = /user id is required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to update user overlay.', badRequest ? 400 : 500);
    }
};
function toStringList(values = []) {
    if (Array.isArray(values)) {
        return values.map((item) => sanitize(item)).filter(Boolean);
    }

    return String(values || '')
        .split(/\n|,/)
        .map((item) => sanitize(item))
        .filter(Boolean);
}

exports.createMentorKnowledgePack = async (req, res) => {
    try {
        const result = await aiNurtureRepo.createMentorKnowledgePack({
            mentorKey: req.body?.mentorKey,
            mentorName: req.body?.mentorName,
            sourceTitle: req.body?.sourceTitle,
            sourceUrl: req.body?.sourceUrl,
            coreIdeas: toStringList(req.body?.coreIdeas),
            businessFrameworks: toStringList(req.body?.businessFrameworks),
            practicalLessons: toStringList(req.body?.practicalLessons),
            academyUse: toStringList(req.body?.academyUse),
            leadershipStyle: req.body?.leadershipStyle,
            communicationStyle: req.body?.communicationStyle,
            decisionMakingStyle: req.body?.decisionMakingStyle,
            doNot: toStringList(req.body?.doNot),
            tags: toStringList(req.body?.tags),
            approveNow: req.body?.approveNow !== false
        });

        return res.status(201).json({
            success: true,
            ...result
        });
    } catch (error) {
        const badRequest = /required/i.test(error?.message || '');
        return sendError(res, error, 'Failed to create mentor knowledge pack.', badRequest ? 400 : 500);
    }
};

exports.deleteMentorKnowledgePack = async (req, res) => {
    try {
        const result = await aiNurtureRepo.deleteMentorKnowledgePack(req.params?.id);

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        const notFound = /not found/i.test(error?.message || '');
        const badRequest = /required|only mentor/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to delete mentor knowledge pack.',
            notFound ? 404 : badRequest ? 400 : 500
        );
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

exports.listContextPacks = async (req, res) => {
    try {
        const packs = await aiNurtureRepo.listContextPacks(Number.parseInt(req.query.limit, 10) || 40);
        return res.json({
            success: true,
            packs
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load context packs.');
    }
};

exports.previewContext = async (req, res) => {
    try {
        const context = await aiNurtureRepo.buildActiveKnowledgeContext({
            categoryHints: req.body?.categoryHints,
            tagHints: req.body?.tagHints,
            userId: req.body?.userId
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
        const outcome = await aiNurtureJobRunner.runNextQueuedJob();

        if (!outcome?.job) {
            return res.json({
                success: true,
                job: null,
                message: 'No queued job is ready.'
            });
        }

        return res.json({
            success: true,
            jobId: outcome.job.id,
            result: outcome.result
        });
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