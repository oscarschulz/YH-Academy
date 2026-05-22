function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function compactText(value = '', maxChars = 320) {
    return sanitize(value)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxChars);
}

function normalizeList(values = [], limit = 8, maxChars = 220) {
    const source = Array.isArray(values) ? values : [values];
    const out = [];

    for (const value of source) {
        const clean = compactText(value, maxChars);
        if (!clean) continue;
        if (!out.includes(clean)) out.push(clean);
        if (out.length >= limit) break;
    }

    return out;
}

function detectTimestampLabel(text = '') {
    const source = sanitize(text);

    const patterns = [
        /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/,
        /\((\d{1,2}:\d{2}(?::\d{2})?)\)/,
        /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match?.[1]) return match[1];
    }

    return '';
}

function timestampLabelToSeconds(label = '') {
    const parts = sanitize(label)
        .split(':')
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item));

    if (parts.length === 2) {
        return (parts[0] * 60) + parts[1];
    }

    if (parts.length === 3) {
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }

    return 0;
}

function isYouTubeUrl(url = '') {
    const clean = sanitize(url).toLowerCase();
    return clean.includes('youtube.com/') || clean.includes('youtu.be/');
}

function buildTimestampUrl(url = '', seconds = 0) {
    const cleanUrl = sanitize(url);
    const cleanSeconds = Number.parseInt(seconds, 10);

    if (!cleanUrl || !Number.isFinite(cleanSeconds) || cleanSeconds <= 0) {
        return cleanUrl;
    }

    try {
        const parsed = new URL(cleanUrl);

        if (isYouTubeUrl(cleanUrl)) {
            parsed.searchParams.set('t', String(cleanSeconds));
            return parsed.toString();
        }

        parsed.hash = `t=${cleanSeconds}`;
        return parsed.toString();
    } catch (_) {
        return cleanUrl;
    }
}

function inferSpeakerName(source = {}) {
    const batchMentorName = sanitize(source.batchMentorName);
    if (batchMentorName) return batchMentorName;

    const tags = [
        ...(Array.isArray(source.manualTags) ? source.manualTags : []),
        ...(Array.isArray(source.topicHints) ? source.topicHints : [])
    ]
        .map((item) => sanitize(item))
        .filter(Boolean);

    const joined = tags.join(' ').toLowerCase();

    if (joined.includes('alex hormozi') || joined.includes('alex_hormozi') || joined.includes('hormozi')) return 'Alex Hormozi';
    if (joined.includes('elon musk') || joined.includes('elon_musk')) return 'Elon Musk';
    if (joined.includes('mark zuckerberg') || joined.includes('mark_zuckerberg')) return 'Mark Zuckerberg';
    if (joined.includes('steve jobs') || joined.includes('steve_jobs')) return 'Steve Jobs';
    if (joined.includes('naval ravikant') || joined.includes('naval_ravikant')) return 'Naval Ravikant';
    if (joined.includes('sam altman') || joined.includes('sam_altman')) return 'Sam Altman';
    if (joined.includes('warren buffett') || joined.includes('warren_buffett')) return 'Warren Buffett';
    if (joined.includes('jeff bezos') || joined.includes('jeff_bezos')) return 'Jeff Bezos';
    if (joined.includes('julius caesar') || joined.includes('julius_caesar')) return 'Julius Caesar';
    if (joined.includes('alexander the great') || joined.includes('alexander_the_great')) return 'Alexander The Great';
    if (joined.includes('marcus aurelius') || joined.includes('marcus_aurelius')) return 'Marcus Aurelius';
    if (joined.includes('seneca')) return 'Seneca';
    if (joined.includes('epictetus')) return 'Epictetus';
    if (joined.includes('socrates')) return 'Socrates';
    if (joined.includes('plato')) return 'Plato';
    if (joined.includes('aristotle')) return 'Aristotle';
    if (joined.includes('confucius')) return 'Confucius';
    if (joined.includes('sun tzu') || joined.includes('sun_tzu')) return 'Sun Tzu';
    if (joined.includes('machiavelli')) return 'Niccolò Machiavelli';

    return '';
}

function getSourceUrl(source = {}, snapshot = {}) {
    return sanitize(
        source.canonicalUrl ||
        source.originalUrl ||
        snapshot.finalUrl ||
        ''
    );
}

function getSourceTitle(source = {}, snapshot = {}) {
    return sanitize(
        source.title ||
        snapshot.title ||
        source.hostname ||
        source.canonicalUrl ||
        source.originalUrl ||
        'Untitled source'
    );
}

function buildEvidenceItems({
    source = {},
    snapshot = {},
    chunks = [],
    review = {}
} = {}) {
    const sourceUrl = getSourceUrl(source, snapshot);
    const sourceTitle = getSourceTitle(source, snapshot);
    const speakerName = inferSpeakerName(source);

    const approvedIndexes = new Set(
        (Array.isArray(review.approvedChunkIndexes) ? review.approvedChunkIndexes : [])
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item))
    );

    const cleanChunks = (Array.isArray(chunks) ? chunks : [])
        .filter((chunk) => sanitize(chunk.text))
        .map((chunk) => ({
            ...chunk,
            index: Number(chunk.index || 0)
        }));

    const selectedChunks = [
        ...cleanChunks.filter((chunk) => approvedIndexes.has(Number(chunk.index))),
        ...cleanChunks.filter((chunk) => sanitize(chunk.decision) === 'absorb'),
        ...cleanChunks
    ];

    const seenIndexes = new Set();
    const uniqueChunks = [];

    for (const chunk of selectedChunks) {
        const index = Number(chunk.index || 0);
        if (!index || seenIndexes.has(index)) continue;
        seenIndexes.add(index);
        uniqueChunks.push(chunk);
        if (uniqueChunks.length >= 6) break;
    }

    const reviewClaims = normalizeList(review.absorbWhat || review.summaryShort || review.summaryLong, 8, 220);
    const evidenceItems = [];

    for (const chunk of uniqueChunks) {
        const chunkText = sanitize(chunk.text);
        const timestampLabel = detectTimestampLabel(chunkText);
        const timestampSeconds = timestampLabelToSeconds(timestampLabel);
        const timestampUrl = buildTimestampUrl(sourceUrl, timestampSeconds);

        const keyTakeaway = Array.isArray(chunk.keyTakeaways) && chunk.keyTakeaways.length
            ? chunk.keyTakeaways[0]
            : '';

        const claim =
            compactText(keyTakeaway, 220) ||
            reviewClaims[evidenceItems.length] ||
            compactText(review.summaryShort || review.summaryLong || '', 220) ||
            'Approved source evidence captured from this source.';

        const excerpt = compactText(chunkText, 360);
        if (!excerpt) continue;

        evidenceItems.push({
            id: `evidence_${sanitize(source.id || 'source')}_${chunk.index || evidenceItems.length + 1}`,
            type: 'source_excerpt',
            speakerName,
            sourceId: sanitize(source.id),
            sourceTitle,
            sourceUrl,
            canonicalUrl: sourceUrl,
            hostname: sanitize(source.hostname || snapshot.siteName || ''),
            chunkIndex: Number(chunk.index || evidenceItems.length + 1),
            timestampLabel,
            timestampSeconds,
            timestampUrl,
            claim,
            evidenceExcerpt: excerpt,
            evidenceNote: timestampLabel
                ? `Evidence captured from source chunk ${chunk.index} around ${timestampLabel}.`
                : `Evidence captured from source chunk ${chunk.index}.`,
            confidence: Number(Number(chunk.relevanceScore || review?.scores?.relevance || 0).toFixed(2)),
            capturedAt: new Date().toISOString()
        });

        if (evidenceItems.length >= 6) break;
    }

    if (!evidenceItems.length && sourceUrl) {
        evidenceItems.push({
            id: `evidence_${sanitize(source.id || 'source')}_source`,
            type: 'source_reference',
            speakerName,
            sourceId: sanitize(source.id),
            sourceTitle,
            sourceUrl,
            canonicalUrl: sourceUrl,
            hostname: sanitize(source.hostname || snapshot.siteName || ''),
            chunkIndex: 0,
            timestampLabel: '',
            timestampSeconds: 0,
            timestampUrl: sourceUrl,
            claim: compactText(review.summaryShort || review.summaryLong || 'Source reference saved for approved knowledge.', 220),
            evidenceExcerpt: compactText(snapshot.excerpt || review.summaryShort || '', 360),
            evidenceNote: 'Source reference saved. No timestamped transcript chunk was detected.',
            confidence: Number(Number(review?.scores?.relevance || 0).toFixed(2)),
            capturedAt: new Date().toISOString()
        });
    }

    return evidenceItems;
}

module.exports = {
    buildEvidenceItems
};