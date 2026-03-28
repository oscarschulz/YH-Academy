const aiNurturePolicy = require('./aiNurturePolicy');

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function safeJsonParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeWhitespace(input = '') {
    return String(input)
        .replace(/\r/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractJsonObject(raw = '') {
    const direct = safeJsonParse(raw, null);
    if (direct) return direct;

    const codeFence = String(raw).match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeFence?.[1]) {
        const parsed = safeJsonParse(codeFence[1].trim(), null);
        if (parsed) return parsed;
    }

    const firstBrace = String(raw).indexOf('{');
    const lastBrace = String(raw).lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return safeJsonParse(String(raw).slice(firstBrace, lastBrace + 1), null);
    }

    return null;
}

function splitIntoChunks(text = '', options = {}) {
    const targetWords = Number.parseInt(options.targetWords, 10) || 220;
    const maxWords = Number.parseInt(options.maxWords, 10) || 320;

    const paragraphs = normalizeWhitespace(text)
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean);

    const chunks = [];
    let current = [];
    let currentCount = 0;

    const pushCurrent = () => {
        if (!current.length) return;
        const joined = current.join('\n\n').trim();
        if (!joined) return;

        chunks.push({
            index: chunks.length + 1,
            sectionTitle: `Chunk ${chunks.length + 1}`,
            text: joined,
            tokenEstimate: Math.ceil(joined.split(/\s+/).length * 1.3)
        });

        current = [];
        currentCount = 0;
    };

    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        const wordCount = words.length;

        if (wordCount > maxWords) {
            pushCurrent();

            for (let i = 0; i < words.length; i += targetWords) {
                const slice = words.slice(i, i + targetWords).join(' ');
                chunks.push({
                    index: chunks.length + 1,
                    sectionTitle: `Chunk ${chunks.length + 1}`,
                    text: slice,
                    tokenEstimate: Math.ceil(slice.split(/\s+/).length * 1.3)
                });
            }

            continue;
        }

        if (currentCount + wordCount > maxWords && current.length) {
            pushCurrent();
        }

        current.push(paragraph);
        currentCount += wordCount;

        if (currentCount >= targetWords) {
            pushCurrent();
        }
    }

    pushCurrent();

    return chunks.slice(0, 24);
}

function computeRelevance(text = '') {
    const lower = sanitize(text).toLowerCase();
    const keywords = [
        'mission', 'discipline', 'routine', 'focus', 'execution', 'habit',
        'wealth', 'income', 'business', 'health', 'energy', 'sleep',
        'mindset', 'stress', 'planning', 'roadmap', 'accountability'
    ];

    const hits = keywords.reduce((sum, item) => sum + (lower.includes(item) ? 1 : 0), 0);
    return clamp(0.24 + hits * 0.055, 0, 0.95);
}

function computeActionability(text = '') {
    const lower = sanitize(text).toLowerCase();
    const markers = [
        'step', 'framework', 'process', 'system', 'do this',
        'start by', 'review', 'track', 'measure', 'daily', 'weekly'
    ];

    const hits = markers.reduce((sum, item) => sum + (lower.includes(item) ? 1 : 0), 0);
    return clamp(0.20 + hits * 0.07, 0, 0.92);
}

function summarizeChunk(chunkText = '') {
    const clean = normalizeWhitespace(chunkText);
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 2).join(' ').slice(0, 260).trim();
}

function heuristicChunkDecision(chunk = {}, hostPolicy = {}, duplicateInfo = {}) {
    const relevance = computeRelevance(chunk.text);
    const actionability = computeActionability(chunk.text);
    const trust = clamp(Number(hostPolicy.domainTrustScore || 0.5), 0, 1);
    const duplication = clamp(Number(duplicateInfo.duplicateScore || 0.1), 0, 1);
    const novelty = clamp(0.62 - duplication * 0.5, 0.08, 0.88);

    let decision = 'reference_only';

    if (duplicateInfo.isNearDuplicate) {
        decision = 'reject';
    } else if (hostPolicy.domainVerdict === 'caution' && trust < 0.4 && actionability < 0.45) {
        decision = 'reject';
    } else if (relevance >= 0.68 && actionability >= 0.58 && duplication <= 0.60) {
        decision = 'absorb';
    } else if (relevance < 0.28 || actionability < 0.20) {
        decision = 'reject';
    }

    return {
        ...chunk,
        relevanceScore: Number(relevance.toFixed(2)),
        noveltyScore: Number(novelty.toFixed(2)),
        trustScore: Number(trust.toFixed(2)),
        duplicationScore: Number(duplication.toFixed(2)),
        actionabilityScore: Number(actionability.toFixed(2)),
        decision,
        reason:
            decision === 'absorb'
                ? 'Operational and reusable for Academy planning.'
                : decision === 'reject'
                    ? duplicateInfo.isNearDuplicate
                        ? 'Near-duplicate of approved knowledge.'
                        : 'Low signal or low trust relative to planning use.'
                    : 'Potentially useful, but best kept as reference until reviewed.',
        keyTakeaways: summarizeChunk(chunk.text) ? [summarizeChunk(chunk.text)] : [],
        redFlags: decision === 'reject'
            ? [duplicateInfo.isNearDuplicate ? 'Near-duplicate content.' : 'Low operational value.']
            : []
    };
}

function buildHeuristicReview({ source = {}, snapshot = {}, settings = {}, existingLibrary = [] } = {}) {
    const hostPolicy = aiNurturePolicy.evaluateDomainTrust(source.hostname || '', settings);
    const duplicateInfo = aiNurturePolicy.evaluateDuplicateAgainstLibrary(source, snapshot, existingLibrary);

    const baseChunks = splitIntoChunks(snapshot.cleanText || '');
    const evaluated = baseChunks.map((chunk) => heuristicChunkDecision(chunk, hostPolicy, duplicateInfo));
    const absorbChunks = evaluated.filter((item) => item.decision === 'absorb');

    const avg = (key) => {
        if (!evaluated.length) return 0;
        return Number(
            (
                evaluated.reduce((sum, item) => sum + Number(item[key] || 0), 0) /
                evaluated.length
            ).toFixed(2)
        );
    };

    const scores = {
        relevance: avg('relevanceScore'),
        novelty: avg('noveltyScore'),
        trust: avg('trustScore'),
        duplication: duplicateInfo.duplicateScore,
        actionability: avg('actionabilityScore')
    };

    let overallDecision = 'reference_only';

    if (duplicateInfo.isNearDuplicate) {
        overallDecision = 'reject';
    } else if (scores.relevance >= Number(settings?.relevanceThreshold ?? 0.65) && scores.actionability >= 0.55 && scores.duplication <= Number(settings?.duplicationThreshold ?? 0.70)) {
        overallDecision = 'approve';
    } else if (scores.relevance < 0.28 || absorbChunks.length === 0) {
        overallDecision = 'reject';
    }

    if (hostPolicy.domainVerdict === 'blocked') {
        overallDecision = 'reject';
    }

    const recommendedCategory =
        /wealth|income|money|business|sales|offer|client|revenue/i.test(`${source.title} ${source.description} ${snapshot.excerpt}`)
            ? 'wealth'
            : /sleep|energy|health|fitness|body|recovery|nutrition/i.test(`${source.title} ${source.description} ${snapshot.excerpt}`)
                ? 'health'
                : /discipline|routine|consisten|focus|habit|execution|procrastin/i.test(`${source.title} ${source.description} ${snapshot.excerpt}`)
                    ? 'discipline'
                    : /mindset|stress|belief|confidence|psychology/i.test(`${source.title} ${source.description} ${snapshot.excerpt}`)
                        ? 'mindset'
                        : /network|communication|persuasion|social/i.test(`${source.title} ${source.description} ${snapshot.excerpt}`)
                            ? 'communication'
                            : 'general';

    const review = {
        overallDecision,
        summaryShort:
            overallDecision === 'approve'
                ? 'Operational content with reusable rules for Academy planning.'
                : overallDecision === 'reject'
                    ? duplicateInfo.isNearDuplicate
                        ? 'Rejected because it overlaps too heavily with already approved knowledge.'
                        : 'Rejected because the source is too weak, too noisy, or too risky for Academy planning.'
                    : 'Some useful material exists, but human review is still recommended.',
        summaryLong: normalizeWhitespace(
            [
                `Source: ${sanitize(source.title || source.canonicalUrl)}`,
                hostPolicy.reason,
                duplicateInfo.duplicateTopMatch
                    ? `Closest approved match: ${duplicateInfo.duplicateTopMatch.title} (${duplicateInfo.duplicateScore}).`
                    : 'No strong duplicate match detected.',
                absorbChunks.length
                    ? `Useful signals: ${absorbChunks.slice(0, 3).map((item) => summarizeChunk(item.text)).filter(Boolean).join(' | ')}`
                    : 'No chunk passed absorb threshold strongly enough.'
            ].join(' ')
        ),
        absorbWhat: absorbChunks
            .flatMap((item) => item.keyTakeaways || [])
            .filter(Boolean)
            .slice(0, 6),
        doNotAbsorbWhat: evaluated
            .filter((item) => item.decision === 'reject')
            .flatMap((item) => item.redFlags || [])
            .filter(Boolean)
            .slice(0, 6),
        riskNotes: [
            hostPolicy.domainVerdict === 'caution' ? 'Source domain needs manual scrutiny.' : '',
            duplicateInfo.isLikelyDuplicate ? 'Possible duplication with approved knowledge.' : ''
        ].filter(Boolean),
        recommendedCategory,
        recommendedKnowledgeType: 'framework',
        domainVerdict: hostPolicy.domainVerdict,
        domainTrustScore: hostPolicy.domainTrustScore,
        duplicateScore: duplicateInfo.duplicateScore,
        duplicateTopMatch: duplicateInfo.duplicateTopMatch,
        scores,
        approvedChunkIndexes: absorbChunks.map((item) => item.index),
        rejectedChunkIndexes: evaluated.filter((item) => item.decision === 'reject').map((item) => item.index)
    };

    return {
        review,
        chunks: evaluated
    };
}

function buildMessages(source = {}, snapshot = {}, chunks = [], context = {}) {
    const compactChunks = chunks.slice(0, 12).map((chunk) => ({
        index: chunk.index,
        text: String(chunk.text || '').slice(0, 1200)
    }));

    return [
        {
            role: 'system',
            content: [
                'You are reviewing external knowledge for an Academy mission planner.',
                'Return JSON only.',
                'Choose overallDecision from approve, reference_only, reject.',
                'Prefer operational frameworks, execution systems, discipline logic, health/recovery logic, and wealth movement logic.',
                'Reject fluff, self-promo, vague inspiration, low-trust noise, or duplicates of already approved knowledge.',
                'Return this exact shape:',
                JSON.stringify({
                    overallDecision: 'approve',
                    summaryShort: '',
                    summaryLong: '',
                    absorbWhat: [''],
                    doNotAbsorbWhat: [''],
                    riskNotes: [''],
                    recommendedCategory: 'general',
                    recommendedKnowledgeType: 'framework',
                    domainVerdict: 'neutral',
                    domainTrustScore: 0.58,
                    duplicateScore: 0.14,
                    duplicateTopMatch: null,
                    scores: {
                        relevance: 0,
                        novelty: 0,
                        trust: 0,
                        duplication: 0,
                        actionability: 0
                    },
                    approvedChunkIndexes: [1],
                    rejectedChunkIndexes: [2],
                    chunkDecisions: [
                        {
                            index: 1,
                            decision: 'absorb',
                            reason: '',
                            keyTakeaways: ['']
                        }
                    ]
                })
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                source: {
                    title: source.title || '',
                    url: source.canonicalUrl || source.originalUrl || '',
                    hostname: source.hostname || '',
                    description: source.description || ''
                },
                snapshot: {
                    excerpt: snapshot.excerpt || '',
                    cleanTextChars: snapshot.cleanTextChars || 0
                },
                policy: {
                    domainVerdict: context.hostPolicy?.domainVerdict || 'neutral',
                    domainTrustScore: context.hostPolicy?.domainTrustScore || 0.5,
                    duplicateScore: context.duplicateInfo?.duplicateScore || 0,
                    duplicateTopMatch: context.duplicateInfo?.duplicateTopMatch || null
                },
                chunks: compactChunks
            })
        }
    ];
}

async function requestOpenAiAnalysis(source = {}, snapshot = {}, chunks = [], context = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || typeof fetch !== 'function') return null;

    const model = sanitize(process.env.OPENAI_NURTURE_MODEL || process.env.OPENAI_PLANNER_FALLBACK_MODEL || 'gpt-5.4');
    const requestBody = {
        model,
        messages: buildMessages(source, snapshot, chunks, context),
        temperature: 0.2
    };

    if (/^(gpt-5|o[13]|o4)/i.test(model)) {
        requestBody.reasoning_effort = sanitize(process.env.OPENAI_NURTURE_REASONING_EFFORT || 'low') || 'low';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'OpenAI nurture analysis failed.');
    }

    return extractJsonObject(data?.choices?.[0]?.message?.content || '');
}

async function requestGeminiAnalysis(source = {}, snapshot = {}, chunks = [], context = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || typeof fetch !== 'function') return null;

    const model = sanitize(process.env.GEMINI_NURTURE_MODEL || process.env.GEMINI_PLANNER_MODEL || 'gemini-2.5-flash');
    const requestBody = {
        model,
        messages: buildMessages(source, snapshot, chunks, context),
        temperature: 0.2
    };

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Gemini nurture analysis failed.');
    }

    return extractJsonObject(data?.choices?.[0]?.message?.content || '');
}

function mergeAiResultWithFallback(aiResult = {}, fallback = {}, baseChunks = []) {
    const fallbackByIndex = new Map((fallback.chunks || []).map((item) => [Number(item.index), item]));
    const aiChunkMap = new Map((Array.isArray(aiResult.chunkDecisions) ? aiResult.chunkDecisions : []).map((item) => [Number(item.index), item]));

    const chunks = baseChunks.map((chunk) => {
        const base = fallbackByIndex.get(Number(chunk.index)) || {
            ...chunk,
            relevanceScore: 0.45,
            noveltyScore: 0.4,
            trustScore: 0.45,
            duplicationScore: 0.15,
            actionabilityScore: 0.4,
            decision: 'reference_only',
            reason: 'Fallback default.',
            keyTakeaways: [],
            redFlags: []
        };

        const aiChunk = aiChunkMap.get(Number(chunk.index));
        if (!aiChunk) return base;

        return {
            ...base,
            decision: sanitize(aiChunk.decision || base.decision),
            reason: sanitize(aiChunk.reason || base.reason),
            keyTakeaways: Array.isArray(aiChunk.keyTakeaways) ? aiChunk.keyTakeaways.map((item) => sanitize(item)).filter(Boolean) : base.keyTakeaways
        };
    });

    const review = {
        overallDecision: sanitize(aiResult.overallDecision || fallback.review?.overallDecision || 'reference_only'),
        summaryShort: sanitize(aiResult.summaryShort || fallback.review?.summaryShort),
        summaryLong: sanitize(aiResult.summaryLong || fallback.review?.summaryLong),
        absorbWhat: Array.isArray(aiResult.absorbWhat) ? aiResult.absorbWhat.map((item) => sanitize(item)).filter(Boolean) : (fallback.review?.absorbWhat || []),
        doNotAbsorbWhat: Array.isArray(aiResult.doNotAbsorbWhat) ? aiResult.doNotAbsorbWhat.map((item) => sanitize(item)).filter(Boolean) : (fallback.review?.doNotAbsorbWhat || []),
        riskNotes: Array.isArray(aiResult.riskNotes) ? aiResult.riskNotes.map((item) => sanitize(item)).filter(Boolean) : (fallback.review?.riskNotes || []),
        recommendedCategory: sanitize(aiResult.recommendedCategory || fallback.review?.recommendedCategory || 'general'),
        recommendedKnowledgeType: sanitize(aiResult.recommendedKnowledgeType || fallback.review?.recommendedKnowledgeType || 'framework'),
        domainVerdict: sanitize(aiResult.domainVerdict || fallback.review?.domainVerdict || 'neutral'),
        domainTrustScore: clamp(Number(aiResult.domainTrustScore ?? fallback.review?.domainTrustScore ?? 0), 0, 1),
        duplicateScore: clamp(Number(aiResult.duplicateScore ?? fallback.review?.duplicateScore ?? 0), 0, 1),
        duplicateTopMatch: aiResult.duplicateTopMatch || fallback.review?.duplicateTopMatch || null,
        scores: {
            relevance: clamp(Number(aiResult?.scores?.relevance ?? fallback.review?.scores?.relevance ?? 0), 0, 1),
            novelty: clamp(Number(aiResult?.scores?.novelty ?? fallback.review?.scores?.novelty ?? 0), 0, 1),
            trust: clamp(Number(aiResult?.scores?.trust ?? fallback.review?.scores?.trust ?? 0), 0, 1),
            duplication: clamp(Number(aiResult?.scores?.duplication ?? fallback.review?.scores?.duplication ?? 0), 0, 1),
            actionability: clamp(Number(aiResult?.scores?.actionability ?? fallback.review?.scores?.actionability ?? 0), 0, 1)
        },
        approvedChunkIndexes: Array.isArray(aiResult.approvedChunkIndexes) ? aiResult.approvedChunkIndexes : (fallback.review?.approvedChunkIndexes || []),
        rejectedChunkIndexes: Array.isArray(aiResult.rejectedChunkIndexes) ? aiResult.rejectedChunkIndexes : (fallback.review?.rejectedChunkIndexes || [])
    };

    return { review, chunks };
}

async function analyzeSource({ source = {}, snapshot = {}, settings = {}, existingLibrary = [] } = {}) {
    const fallback = buildHeuristicReview({ source, snapshot, settings, existingLibrary });
    const baseChunks = splitIntoChunks(snapshot.cleanText || '');

    if (!baseChunks.length) {
        throw new Error('No usable chunks were generated from extracted content.');
    }

    const context = {
        hostPolicy: aiNurturePolicy.evaluateDomainTrust(source.hostname || '', settings),
        duplicateInfo: aiNurturePolicy.evaluateDuplicateAgainstLibrary(source, snapshot, existingLibrary)
    };

    if (context.duplicateInfo.isNearDuplicate) {
        return fallback;
    }

    try {
        const gemini = await requestGeminiAnalysis(source, snapshot, baseChunks, context);
        if (gemini) {
            return mergeAiResultWithFallback(gemini, fallback, baseChunks);
        }
    } catch (error) {
        console.error('Gemini nurture fallback:', error.message);
    }

    try {
        const openai = await requestOpenAiAnalysis(source, snapshot, baseChunks, context);
        if (openai) {
            return mergeAiResultWithFallback(openai, fallback, baseChunks);
        }
    } catch (error) {
        console.error('OpenAI nurture fallback:', error.message);
    }

    return fallback;
}

module.exports = {
    analyzeSource
};