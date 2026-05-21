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

        const batch = await aiNurtureRepo.createBatchRun({
            title: titlePrefix || `${mentorName || mentorKey || 'AI Nurture'} Batch`,
            mentorKey,
            mentorName,
            titlePrefix,
            requestedUrls: urls,
            requestedCount: urls.length,
            queueJobs,
            queuePriority
        });

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
                    submittedFrom: 'internal-console-batch',
                    batchId: batch.id,
                    batchTitle: batch.title,
                    batchMentorKey: mentorKey,
                    batchMentorName: mentorName
                });

                sources.push(source);

                if (queueJobs) {
                    const job = await aiNurtureRepo.createJob({
                        type: 'process-source',
                        sourceId: source.id,
                        priority: queuePriority,
                        reason: 'batch-submit',
                        batchId: batch.id,
                        batchTitle: batch.title,
                        batchMentorKey: mentorKey,
                        batchMentorName: mentorName,
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

        const updatedBatch = await aiNurtureRepo.updateBatchRun(batch.id, {
            createdCount: sources.length,
            jobCount: jobs.length,
            failedCount: failed.length,
            sourceIds: sources.map((source) => source.id).filter(Boolean),
            jobIds: jobs.map((job) => job.id).filter(Boolean),
            failed,
            status: failed.length && !sources.length
                ? 'failed'
                : failed.length
                    ? 'partial'
                    : queueJobs
                        ? 'queued'
                        : 'created'
        });

        return res.status(failed.length && !sources.length ? 400 : failed.length ? 207 : 201).json({
            success: sources.length > 0,
            message: sources.length
                ? `Batch created with ${sources.length} source(s).`
                : 'Batch could not create any source.',
            batch: updatedBatch,
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

function hostnameFromUrl(value = '') {
    try {
        return new URL(value).hostname || '';
    } catch (_) {
        return '';
    }
}

function sourceKindFromUrl(value = '') {
    const url = String(value || '').toLowerCase();

    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) return 'youtube-video';
    if (url.includes('youtube.com/shorts/')) return 'youtube-short';
    if (url.includes('youtube.com/playlist')) return 'youtube-playlist';
    if (url.includes('youtube.com/@') || url.includes('youtube.com/channel/')) return 'youtube-channel';

    return 'web-page';
}

function normalizeDiscoveredUrl(value = '', baseUrl = '') {
    const raw = sanitize(value)
        .replace(/&amp;/g, '&')
        .replace(/[)\].,;]+$/g, '')
        .trim();

    if (!raw) return '';

    try {
        const parsed = baseUrl
            ? new URL(raw, baseUrl)
            : new URL(raw);

        if (!['http:', 'https:'].includes(parsed.protocol)) return '';

        parsed.hash = '';

        const youtubeVideoId = parsed.hostname.includes('youtube.com')
            ? parsed.searchParams.get('v')
            : '';

        if (youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeVideoId)) {
            return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
        }

        if (parsed.hostname.includes('youtu.be')) {
            const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
            if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
                return `https://www.youtube.com/watch?v=${id}`;
            }
        }

        const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch?.[1]) {
            return `https://www.youtube.com/shorts/${shortsMatch[1]}`;
        }

        return parsed.toString();
    } catch (_) {
        return '';
    }
}

function shouldKeepDiscoveredUrl(value = '') {
    const url = String(value || '').toLowerCase();

    if (!url.startsWith('http')) return false;

    const blockedExtensions = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.svg',
        '.ico',
        '.css',
        '.js',
        '.woff',
        '.woff2',
        '.ttf',
        '.mp4',
        '.mp3'
    ];

    if (blockedExtensions.some((extension) => url.split('?')[0].endsWith(extension))) {
        return false;
    }

    if (url.includes('accounts.google.com')) return false;
    if (url.includes('google.com/sorry')) return false;
    if (url.includes('youtube.com/redirect')) return false;
    if (url.includes('youtube.com/results?search_query=')) return false;

    return true;
}

function extractLinksFromText(value = '', baseUrl = '', maxLinks = 50) {
    const text = String(value || '');
    const discovered = [];
    const seen = new Set();

    function pushUrl(candidate = '') {
        const normalized = normalizeDiscoveredUrl(candidate, baseUrl);

        if (!normalized || !shouldKeepDiscoveredUrl(normalized)) return;
        if (seen.has(normalized)) return;

        seen.add(normalized);
        discovered.push({
            url: normalized,
            hostname: hostnameFromUrl(normalized),
            sourceKind: sourceKindFromUrl(normalized)
        });
    }

    const youtubeWatchIds = [...text.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})/g)]
        .map((match) => match[1]);

    youtubeWatchIds.forEach((id) => pushUrl(`https://www.youtube.com/watch?v=${id}`));

    const youtubeShortIds = [...text.matchAll(/\/shorts\/([a-zA-Z0-9_-]{11})/g)]
        .map((match) => match[1]);

    youtubeShortIds.forEach((id) => pushUrl(`https://www.youtube.com/shorts/${id}`));

    const hrefMatches = [...text.matchAll(/href=["']([^"']+)["']/gi)]
        .map((match) => match[1]);

    hrefMatches.forEach(pushUrl);

    const rawUrlMatches = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    rawUrlMatches.forEach(pushUrl);

    return discovered.slice(0, Math.max(1, Math.min(100, Number.parseInt(maxLinks, 10) || 50)));
}

async function fetchDiscoveryPage(targetUrl = '') {
    const cleanUrl = normalizeDiscoveredUrl(targetUrl);

    if (!cleanUrl) {
        throw new Error('A valid discovery URL is required.');
    }

    if (typeof fetch !== 'function') {
        throw new Error('Server fetch is not available in this Node runtime.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch(cleanUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 AI-Nurture-Link-Discovery/1.0',
                'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5'
            }
        });

        const body = await response.text();

        return {
            finalUrl: response.url || cleanUrl,
            ok: response.ok,
            status: response.status,
            body
        };
    } finally {
        clearTimeout(timeout);
    }
}

exports.discoverSourceLinks = async (req, res) => {
    try {
        const targetUrl = sanitize(req.body?.targetUrl || req.body?.url);
        const rawText = sanitize(req.body?.rawText || req.body?.text);
        const maxLinks = Math.max(1, Math.min(100, Number.parseInt(req.body?.maxLinks, 10) || 50));

        if (!targetUrl && !rawText) {
            return res.status(400).json({
                success: false,
                message: 'Paste a discovery URL or raw text before scanning.'
            });
        }

        let fetched = null;
        let combinedText = rawText;
        let baseUrl = targetUrl;

        if (targetUrl) {
            fetched = await fetchDiscoveryPage(targetUrl);
            combinedText = `${combinedText}\n${fetched.body || ''}`;
            baseUrl = fetched.finalUrl || targetUrl;
        }

        const links = extractLinksFromText(combinedText, baseUrl, maxLinks);

        return res.json({
            success: true,
            message: links.length
                ? `Discovered ${links.length} source link(s).`
                : 'No usable links were discovered from that source.',
            targetUrl,
            finalUrl: fetched?.finalUrl || '',
            fetchStatus: fetched ? fetched.status : null,
            discoveredCount: links.length,
            links
        });
    } catch (error) {
        return sendError(res, error, 'Failed to discover source links.', 500);
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

exports.approveReadySources = async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(50, Number.parseInt(req.body?.limit, 10) || 25));
        const sources = await aiNurtureRepo.listSources(limit);

        const approved = [];
        const skipped = [];
        const failed = [];

        for (const source of sources) {
            const sourceId = sanitize(source?.id);
            const status = sanitize(source?.status).toLowerCase();

            if (!sourceId) continue;

            if (status === 'approved' || status === 'rejected' || status === 'failed' || status === 'queued') {
                skipped.push({
                    sourceId,
                    status,
                    reason: 'Source status is not ready for approval.'
                });
                continue;
            }

            try {
                const review = await aiNurtureRepo.getReviewBySourceId(sourceId);

                if (!review) {
                    skipped.push({
                        sourceId,
                        status,
                        reason: 'No review found yet.'
                    });
                    continue;
                }

                const decision = sanitize(review.overallDecision).toLowerCase();
                const domainVerdict = sanitize(review.domainVerdict).toLowerCase();
                const staleVerdict = sanitize(review.staleVerdict).toLowerCase();

                if (decision === 'reject' || domainVerdict === 'blocked' || staleVerdict === 'expired') {
                    skipped.push({
                        sourceId,
                        status,
                        reason: 'Review is not safe for auto-approval.'
                    });
                    continue;
                }

                const result = await aiNurtureRepo.approveSource(sourceId);
                approved.push({
                    sourceId,
                    libraryId: result?.libraryEntry?.id || '',
                    cardCount: Array.isArray(result?.cards) ? result.cards.length : 0
                });
            } catch (error) {
                failed.push({
                    sourceId,
                    status,
                    message: sanitize(error?.message || 'Approval failed.')
                });
            }
        }

        return res.json({
            success: true,
            inspectedCount: sources.length,
            approvedCount: approved.length,
            skippedCount: skipped.length,
            failedCount: failed.length,
            approved,
            skipped,
            failed
        });
    } catch (error) {
        return sendError(res, error, 'Failed to approve ready sources.');
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
function countByStatus(items = []) {
    return (Array.isArray(items) ? items : []).reduce((acc, item) => {
        const status = sanitize(item?.status || 'unknown').toLowerCase() || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
}

exports.listBatchProgress = async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(40, Number.parseInt(req.query.limit, 10) || 20));
        const batches = await aiNurtureRepo.listBatchRuns(limit);
        const library = await aiNurtureRepo.listLibrary(300);
        const librarySourceIds = new Set(
            (Array.isArray(library) ? library : [])
                .map((item) => sanitize(item?.sourceId))
                .filter(Boolean)
        );

        const enriched = [];

        for (const batch of batches) {
            const sourceIds = Array.isArray(batch.sourceIds)
                ? batch.sourceIds.map((id) => sanitize(id)).filter(Boolean).slice(0, 120)
                : [];

            const [sourcesRaw, jobs] = await Promise.all([
                Promise.all(sourceIds.map((sourceId) => aiNurtureRepo.getSourceById(sourceId).catch(() => null))),
                aiNurtureRepo.listJobsByBatch(batch.id, 250)
            ]);

            const sources = sourcesRaw.filter(Boolean);
            const sourceStatusCounts = countByStatus(sources);
            const jobStatusCounts = countByStatus(jobs);

            const requestedCount = Number(batch.requestedCount || sourceIds.length || sources.length || 0);
            const createdSourceCount = Number(batch.createdCount || sourceIds.length || sources.length || 0);
            const jobCount = jobs.length;
            const queuedJobCount = jobs.filter((job) => sanitize(job?.status).toLowerCase() === 'queued').length;
            const completedJobCount = jobs.filter((job) => sanitize(job?.status).toLowerCase() === 'completed').length;
            const failedJobCount = jobs.filter((job) => sanitize(job?.status).toLowerCase() === 'failed').length;
            const importFailedCount = Number(batch.failedCount || (Array.isArray(batch.failed) ? batch.failed.length : 0) || 0);

            const approvedCount = sources.filter((source) => {
                const status = sanitize(source?.status).toLowerCase();
                return status === 'approved' || librarySourceIds.has(source.id);
            }).length;

            const processedCount = sources.filter((source) => {
                const status = sanitize(source?.status).toLowerCase();
                return ['fetched', 'reviewed', 'approved', 'rejected', 'failed'].includes(status);
            }).length;

            const failedSourceCount = sources.filter((source) => sanitize(source?.status).toLowerCase() === 'failed').length;
            const rejectedCount = sources.filter((source) => sanitize(source?.status).toLowerCase() === 'rejected').length;
            const queuedSourceCount = sources.filter((source) => sanitize(source?.status).toLowerCase() === 'queued').length;
            const failedCount = importFailedCount + failedSourceCount + failedJobCount;
            const handledCount = Math.min(requestedCount || createdSourceCount || 0, processedCount + importFailedCount + failedJobCount);
            const completionBase = Math.max(1, requestedCount || createdSourceCount || sources.length || jobCount || 1);
            const completionPercent = Math.min(
                100,
                Math.round((handledCount / completionBase) * 100)
            );

            enriched.push({
                ...batch,
                progress: {
                    requestedCount,
                    createdSourceCount,
                    sourceCount: sources.length,
                    jobCount,
                    queuedJobCount,
                    completedJobCount,
                    failedJobCount,
                    importFailedCount,
                    approvedCount,
                    processedCount,
                    failedSourceCount,
                    failedCount,
                    rejectedCount,
                    queuedSourceCount,
                    completionPercent,
                    sourceStatusCounts,
                    jobStatusCounts
                }
            });
        }

        return res.json({
            success: true,
            message: `Loaded ${enriched.length} batch history item(s).`,
            batchCount: enriched.length,
            batches: enriched
        });
    } catch (error) {
        return sendError(res, error, 'Failed to list batch progress.');
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

exports.runQueuedJobs = async (req, res) => {
    try {
        const maxRuns = Math.max(1, Math.min(25, Number.parseInt(req.body?.maxRuns, 10) || 10));
        const outcomes = [];
        let stoppedReason = 'max_runs_reached';

        for (let index = 0; index < maxRuns; index += 1) {
            const outcome = await aiNurtureJobRunner.runNextQueuedJob();

            if (!outcome?.job) {
                stoppedReason = 'no_queued_job_ready';
                break;
            }

            outcomes.push({
                jobId: outcome.job.id,
                sourceId: outcome.job.sourceId || '',
                result: outcome.result || {}
            });
        }

        return res.json({
            success: true,
            requestedRuns: maxRuns,
            runCount: outcomes.length,
            stoppedReason,
            outcomes
        });
    } catch (error) {
        return sendError(res, error, 'Failed to run queued nurture jobs.');
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