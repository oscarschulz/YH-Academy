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
            domainTrustScore: 0.0,
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

function selectContextFromAssets({ packs = [], libraryItems = [], memoryCards = [], categoryHints = [], tagHints = [] } = {}) {
    const scoredPacks = (Array.isArray(packs) ? packs : [])
        .map((pack) => ({
            ...pack,
            _score: scoreContextCandidate(pack, categoryHints, tagHints)
        }))
        .sort((a, b) => b._score - a._score || String(a.category || '').localeCompare(String(b.category || '')));

    const selectedPacks = scoredPacks.filter((item) => item._score > 0).slice(0, 3);
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

    for (const pack of selectedPacks) {
        if (pack.category) priorityThemes.push(pack.category);
        for (const rule of Array.isArray(pack.rules) ? pack.rules : []) {
            if (rule && !rules.includes(rule)) rules.push(rule);
            if (rules.length >= 10) break;
        }
        for (const example of Array.isArray(pack.examples) ? pack.examples : []) {
            if (example && !examples.includes(example)) examples.push(example);
            if (examples.length >= 6) break;
        }
        for (const flag of Array.isArray(pack.redFlags) ? pack.redFlags : []) {
            if (flag && !redFlags.includes(flag)) redFlags.push(flag);
            if (redFlags.length >= 8) break;
        }
    }

    for (const card of scoredCards) {
        if (card.content && !rules.includes(card.content)) rules.push(card.content);
        if (rules.length >= 10) break;
    }

    for (const item of scoredLibrary) {
        if (item.category && !priorityThemes.includes(item.category)) priorityThemes.push(item.category);
        if (item.summary && !examples.includes(item.summary)) examples.push(item.summary);
        for (const flag of Array.isArray(item.doNotUseWhen) ? item.doNotUseWhen : []) {
            if (flag && !redFlags.includes(flag)) redFlags.push(flag);
            if (redFlags.length >= 8) break;
        }
        if (examples.length >= 6 && redFlags.length >= 8) break;
    }

    return {
        rules: rules.slice(0, 10),
        examples: examples.slice(0, 6),
        redFlags: redFlags.slice(0, 8),
        priorityThemes: [...new Set(priorityThemes.filter(Boolean))].slice(0, 6),
        selectedPackKeys: selectedPacks.map((item) => item.key || item.category).filter(Boolean)
    };
}

module.exports = {
    evaluateDomainTrust,
    evaluateDuplicateAgainstLibrary,
    selectContextFromAssets
};