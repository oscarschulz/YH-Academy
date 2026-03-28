function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function normalizeHost(hostname = '') {
    return sanitize(hostname).toLowerCase().replace(/^www\./, '');
}

function normalizeText(input = '') {
    return sanitize(input)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(input = '') {
    const stopwords = new Set([
        'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'your', 'you',
        'into', 'about', 'will', 'they', 'them', 'their', 'then', 'than', 'just',
        'over', 'under', 'when', 'where', 'what', 'which', 'been', 'being', 'were',
        'was', 'are', 'but', 'not', 'too', 'can', 'could', 'should', 'would', 'more',
        'some', 'such', 'very', 'only', 'also', 'each', 'much', 'many', 'most',
        'how', 'why', 'who', 'our', 'out', 'off', 'all', 'any', 'per', 'its',
        'his', 'her', 'she', 'him', 'has', 'had', 'did', 'does', 'doing', 'because'
    ]);

    return [...new Set(
        normalizeText(input)
            .split(' ')
            .map((item) => item.trim())
            .filter((item) => item.length >= 3 && !stopwords.has(item))
    )];
}

function overlapScore(aText = '', bText = '') {
    const a = tokenize(aText);
    const b = tokenize(bText);

    if (!a.length || !b.length) return 0;

    const bSet = new Set(b);
    let hits = 0;

    for (const token of a) {
        if (bSet.has(token)) hits += 1;
    }

    return Number((hits / Math.max(a.length, b.length)).toFixed(2));
}

function hostMatches(hostname = '', pattern = '') {
    const host = normalizeHost(hostname);
    const needle = normalizeHost(pattern);

    if (!host || !needle) return false;
    return host === needle || host.endsWith(`.${needle}`);
}

function evaluateDomainTrust(hostname = '', settings = {}) {
    const host = normalizeHost(hostname);
    const blockedDomains = Array.isArray(settings?.blockedDomains) ? settings.blockedDomains : [];
    const allowedDomains = Array.isArray(settings?.allowedDomains) ? settings.allowedDomains : [];

    if (!host) {
        return {
            domainVerdict: 'caution',
            domainTrustScore: 0.35,
            blocked: false,
            reason: 'Missing hostname.'
        };
    }

    if (blockedDomains.some((item) => hostMatches(host, item))) {
        return {
            domainVerdict: 'blocked',
            domainTrustScore: 0,
            blocked: true,
            reason: 'Domain is explicitly blocked.'
        };
    }

    if (allowedDomains.length && allowedDomains.some((item) => hostMatches(host, item))) {
        return {
            domainVerdict: 'trusted',
            domainTrustScore: 0.9,
            blocked: false,
            reason: 'Domain is explicitly allowlisted.'
        };
    }

    if (/\.(gov|edu)$/i.test(host) || /\.gov\./i.test(host) || /\.edu\./i.test(host)) {
        return {
            domainVerdict: 'trusted',
            domainTrustScore: 0.85,
            blocked: false,
            reason: 'Institutional domain.'
        };
    }

    if (/wikipedia\.org|github\.com|openai\.com|google\.com|deepmind\.google/i.test(host)) {
        return {
            domainVerdict: 'trusted',
            domainTrustScore: 0.74,
            blocked: false,
            reason: 'High-signal reference domain.'
        };
    }

    if (/substack\.com|medium\.com|gumroad\.com/i.test(host)) {
        return {
            domainVerdict: 'neutral',
            domainTrustScore: 0.52,
            blocked: false,
            reason: 'Content platform. Review carefully.'
        };
    }

    if (/facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|reddit\.com/i.test(host)) {
        return {
            domainVerdict: 'caution',
            domainTrustScore: 0.36,
            blocked: false,
            reason: 'Social platform. Lower reliability by default.'
        };
    }

    return {
        domainVerdict: 'neutral',
        domainTrustScore: 0.58,
        blocked: false,
        reason: 'No strong trust or block signal found.'
    };
}

function evaluateDuplicateAgainstLibrary(source = {}, snapshot = {}, libraryItems = []) {
    const sourceTitle = sanitize(source.title || source.canonicalUrl || source.originalUrl);
    const sourceText = [
        sourceTitle,
        sanitize(source.description),
        sanitize(snapshot.excerpt),
        sanitize(snapshot.cleanText).slice(0, 2500)
    ].filter(Boolean).join('\n\n');

    let topMatch = null;
    let topScore = 0;

    for (const item of Array.isArray(libraryItems) ? libraryItems : []) {
        const candidateText = [
            sanitize(item.title),
            sanitize(item.summary),
            ...(Array.isArray(item.usableRules) ? item.usableRules : [])
        ].filter(Boolean).join('\n\n');

        const titleScore = overlapScore(sourceTitle, item.title || '');
        const bodyScore = overlapScore(sourceText, candidateText);
        const score = Number((titleScore * 0.55 + bodyScore * 0.45).toFixed(2));

        if (score > topScore) {
            topScore = score;
            topMatch = {
                id: item.id,
                title: sanitize(item.title),
                sourceUrl: sanitize(item.sourceUrl),
                category: sanitize(item.category),
                score
            };
        }
    }

    return {
        duplicateScore: Number(topScore.toFixed(2)),
        duplicateTopMatch: topMatch,
        isNearDuplicate: topScore >= 0.86,
        isLikelyDuplicate: topScore >= 0.72
    };
}

function parseDateValue(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function evaluateStaleness(snapshot = {}, category = 'general', settings = {}) {
    const staleDaysDefault = Number(settings?.staleDaysDefault || 540);
    const staleDaysByCategory = settings?.staleDaysByCategory && typeof settings.staleDaysByCategory === 'object'
        ? settings.staleDaysByCategory
        : {
            wealth: 365,
            health: 730,
            discipline: 730,
            mindset: 1095,
            communication: 730,
            general: staleDaysDefault
        };

    const normalizedCategory = sanitize(category || 'general').toLowerCase() || 'general';
    const maxFreshDays = Number(staleDaysByCategory[normalizedCategory] || staleDaysByCategory.general || staleDaysDefault);

    const referenceDate = parseDateValue(snapshot.modifiedAt || snapshot.publishedAt);
    if (!referenceDate) {
        return {
            staleVerdict: 'unknown',
            freshnessScore: 0.55,
            ageDays: null,
            excludeFromPlanner: false,
            reason: 'No publish or update date was found.'
        };
    }

    const ageDays = Math.max(
        0,
        Math.floor((Date.now() - referenceDate.getTime()) / (24 * 60 * 60 * 1000))
    );

    if (ageDays <= maxFreshDays) {
        return {
            staleVerdict: 'fresh',
            freshnessScore: 1,
            ageDays,
            excludeFromPlanner: false,
            reason: 'Source is within freshness window.'
        };
    }

    if (ageDays <= Math.floor(maxFreshDays * 1.75)) {
        return {
            staleVerdict: 'aging',
            freshnessScore: 0.62,
            ageDays,
            excludeFromPlanner: false,
            reason: 'Source is aging and should be used carefully.'
        };
    }

    if (ageDays <= Math.floor(maxFreshDays * 3)) {
        return {
            staleVerdict: 'stale',
            freshnessScore: 0.32,
            ageDays,
            excludeFromPlanner: false,
            reason: 'Source is stale and should not dominate planning.'
        };
    }

    return {
        staleVerdict: 'expired',
        freshnessScore: 0.08,
        ageDays,
        excludeFromPlanner: true,
        reason: 'Source is too old for planner use.'
    };
}

function incrementBucketCount(counterMap, key) {
    counterMap.set(key, (counterMap.get(key) || 0) + 1);
}

function canPush(counterMap, key, maxPerCategory) {
    return (counterMap.get(key) || 0) < maxPerCategory;
}

function scoreContextCandidate({ category = '', tags = [], rules = [], examples = [], redFlags = [] }, categoryHints = [], tagHints = []) {
    const normalizedCategory = normalizeText(category);
    const normalizedTags = (Array.isArray(tags) ? tags : []).map((item) => normalizeText(item)).filter(Boolean);
    const haystack = [
        normalizedCategory,
        ...normalizedTags,
        ...(Array.isArray(rules) ? rules : []),
        ...(Array.isArray(examples) ? examples : []),
        ...(Array.isArray(redFlags) ? redFlags : [])
    ].map((item) => normalizeText(item)).join(' ');

    let score = 0;

    for (const hint of categoryHints) {
        const cleanHint = normalizeText(hint);
        if (!cleanHint) continue;
        if (normalizedCategory === cleanHint) score += 6;
        else if (haystack.includes(cleanHint)) score += 3;
    }

    for (const hint of tagHints) {
        const cleanHint = normalizeText(hint);
        if (!cleanHint) continue;
        if (haystack.includes(cleanHint)) score += 2;
    }

    score += Math.min(3, Math.floor((Array.isArray(rules) ? rules.length : 0) / 2));
    score += Math.min(2, Math.floor((Array.isArray(examples) ? examples.length : 0) / 2));

    return score;
}

function selectContextFromAssets({
    packs = [],
    libraryItems = [],
    memoryCards = [],
    categoryHints = [],
    tagHints = [],
    limits = {}
} = {}) {
    const config = {
        maxRulesTotal: Number(limits?.maxRulesTotal || 10),
        maxExamplesTotal: Number(limits?.maxExamplesTotal || 6),
        maxRedFlagsTotal: Number(limits?.maxRedFlagsTotal || 8),
        maxRulesPerCategory: Number(limits?.maxRulesPerCategory || 4),
        maxExamplesPerCategory: Number(limits?.maxExamplesPerCategory || 2),
        maxRedFlagsPerCategory: Number(limits?.maxRedFlagsPerCategory || 3)
    };

    const scoredPacks = (Array.isArray(packs) ? packs : [])
        .map((pack) => ({
            ...pack,
            _score: scoreContextCandidate(pack, categoryHints, tagHints)
        }))
        .sort((a, b) => b._score - a._score || String(a.category || '').localeCompare(String(b.category || '')));

    const selectedPacks = scoredPacks.filter((item) => item._score > 0).slice(0, 4);
    const selectedPackCategories = new Set(selectedPacks.map((item) => normalizeText(item.category)));

    const scoredCards = (Array.isArray(memoryCards) ? memoryCards : [])
        .map((card) => {
            const category = normalizeText(card.category || '');
            const content = normalizeText(card.content || '');
            let score = Number(card.priority || 0);

            if (selectedPackCategories.has(category)) score += 5;

            for (const hint of categoryHints) {
                const cleanHint = normalizeText(hint);
                if (category === cleanHint) score += 4;
                else if (content.includes(cleanHint)) score += 2;
            }

            for (const hint of tagHints) {
                const cleanHint = normalizeText(hint);
                if (content.includes(cleanHint)) score += 1.5;
            }

            return {
                ...card,
                _score: score
            };
        })
        .sort((a, b) => b._score - a._score);

    const scoredLibrary = (Array.isArray(libraryItems) ? libraryItems : [])
        .map((item) => {
            const category = normalizeText(item.category || '');
            const summary = normalizeText(item.summary || '');
            const tags = (Array.isArray(item.retrievalTags) ? item.retrievalTags : []).map((tag) => normalizeText(tag)).join(' ');
            let score = Number(item.confidence || 0) * 10;

            if (selectedPackCategories.has(category)) score += 4;

            for (const hint of categoryHints) {
                const cleanHint = normalizeText(hint);
                if (category === cleanHint) score += 4;
                else if (summary.includes(cleanHint) || tags.includes(cleanHint)) score += 2;
            }

            for (const hint of tagHints) {
                const cleanHint = normalizeText(hint);
                if (summary.includes(cleanHint) || tags.includes(cleanHint)) score += 1.5;
            }

            return {
                ...item,
                _score: score
            };
        })
        .sort((a, b) => b._score - a._score);

    const rules = [];
    const examples = [];
    const redFlags = [];
    const priorityThemes = [];
    const ruleCountByCategory = new Map();
    const exampleCountByCategory = new Map();
    const redFlagCountByCategory = new Map();

    const tryPushRule = (category, value) => {
        const key = normalizeText(category || 'general') || 'general';
        if (!value || rules.includes(value)) return;
        if (rules.length >= config.maxRulesTotal) return;
        if (!canPush(ruleCountByCategory, key, config.maxRulesPerCategory)) return;
        rules.push(value);
        incrementBucketCount(ruleCountByCategory, key);
    };

    const tryPushExample = (category, value) => {
        const key = normalizeText(category || 'general') || 'general';
        if (!value || examples.includes(value)) return;
        if (examples.length >= config.maxExamplesTotal) return;
        if (!canPush(exampleCountByCategory, key, config.maxExamplesPerCategory)) return;
        examples.push(value);
        incrementBucketCount(exampleCountByCategory, key);
    };

    const tryPushRedFlag = (category, value) => {
        const key = normalizeText(category || 'general') || 'general';
        if (!value || redFlags.includes(value)) return;
        if (redFlags.length >= config.maxRedFlagsTotal) return;
        if (!canPush(redFlagCountByCategory, key, config.maxRedFlagsPerCategory)) return;
        redFlags.push(value);
        incrementBucketCount(redFlagCountByCategory, key);
    };

    for (const pack of selectedPacks) {
        if (pack.category && !priorityThemes.includes(pack.category)) {
            priorityThemes.push(pack.category);
        }

        for (const rule of Array.isArray(pack.rules) ? pack.rules : []) {
            tryPushRule(pack.category, rule);
        }

        for (const example of Array.isArray(pack.examples) ? pack.examples : []) {
            tryPushExample(pack.category, example);
        }

        for (const flag of Array.isArray(pack.redFlags) ? pack.redFlags : []) {
            tryPushRedFlag(pack.category, flag);
        }
    }

    for (const card of scoredCards) {
        tryPushRule(card.category, card.content);
        if (rules.length >= config.maxRulesTotal) break;
    }

    for (const item of scoredLibrary) {
        if (item.category && !priorityThemes.includes(item.category)) {
            priorityThemes.push(item.category);
        }

        tryPushExample(item.category, item.summary);

        for (const flag of Array.isArray(item.doNotUseWhen) ? item.doNotUseWhen : []) {
            tryPushRedFlag(item.category, flag);
        }

        if (examples.length >= config.maxExamplesTotal && redFlags.length >= config.maxRedFlagsTotal) {
            break;
        }
    }

    return {
        rules: rules.slice(0, config.maxRulesTotal),
        examples: examples.slice(0, config.maxExamplesTotal),
        redFlags: redFlags.slice(0, config.maxRedFlagsTotal),
        priorityThemes: [...new Set(priorityThemes.filter(Boolean))].slice(0, 6),
        selectedPackKeys: selectedPacks.map((item) => item.key || item.category).filter(Boolean)
    };
}

module.exports = {
    evaluateDomainTrust,
    evaluateDuplicateAgainstLibrary,
    evaluateStaleness,
    selectContextFromAssets
};