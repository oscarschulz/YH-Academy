const aiNurtureRepo = require('../repositories/aiNurtureFirestoreRepo');
const aiNurturePolicy = require('./aiNurturePolicy');

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function collectHints(profile = {}, behaviorProfile = {}, plannerStats = {}) {
    const categoryHints = [];
    const tagHints = [];

    const priority = sanitize(profile.topPriorityPillar).toLowerCase();
    const blockerText = sanitize(profile.blockerText).toLowerCase();
    const coachTone = sanitize(profile.coachTone).toLowerCase();
    const goals = sanitize(profile.goals6mo).toLowerCase();
    const currentJob = sanitize(profile.currentJob).toLowerCase();

    if (priority) categoryHints.push(priority);

    if (
        /wealth|income|money|business|client|sales|offer|revenue/.test(blockerText) ||
        /wealth|income|business|revenue/.test(goals) ||
        /business|sales/.test(currentJob) ||
        priority === 'wealth' ||
        priority === 'money, wealth & business'
    ) {
        categoryHints.push('wealth');
    }

    if (
        /discipline|routine|consisten|procrastin|execution|habit/.test(blockerText) ||
        priority === 'discipline'
    ) {
        categoryHints.push('discipline');
    }

    if (
        /sleep|energy|health|body|fitness|recovery/.test(blockerText) ||
        priority === 'health' ||
        priority === 'fitness & health'
    ) {
        categoryHints.push('health');
    }

    if (
        /mindset|stress|focus|belief|confidence|psychology/.test(blockerText) ||
        priority === 'mindset' ||
        priority === 'mindset & psychology'
    ) {
        categoryHints.push('mindset');
    }

    if (
        /network|communication|social|persuasion|outreach/.test(blockerText) ||
        priority === 'communication' ||
        priority === 'communication & networking'
    ) {
        categoryHints.push('communication');
    }

    if (
        /knowledge|study|reading|learning|research|banking|tax|world trends|systems/.test(blockerText) ||
        /knowledge|study|research|learning/.test(goals) ||
        priority === 'knowledge' ||
        priority === 'knowledge for life'
    ) {
        categoryHints.push('knowledge');
    }

    if (
        /politic|policy|government|geopolitic|power structure|2030 agenda|global issue|media narrative/.test(blockerText) ||
        /politic|policy|geopolitic|2030 agenda/.test(goals) ||
        priority === 'politics' ||
        priority === 'politics & the 2030 agenda'
    ) {
        categoryHints.push('politics');
    }

    if (
        /philosophy|ethic|meaning|purpose|truth|logic|reality|stoic|existential/.test(blockerText) ||
        /philosophy|ethic|meaning|purpose|logic/.test(goals) ||
        priority === 'philosophy'
    ) {
        categoryHints.push('philosophy');
    }

    if (coachTone) tagHints.push(coachTone);

    if (behaviorProfile && typeof behaviorProfile === 'object') {
        const recoveryRisk = sanitize(behaviorProfile.recoveryRisk).toLowerCase();
        const accountabilityRisk = sanitize(behaviorProfile.accountabilityRisk).toLowerCase();
        const consistencyBand = sanitize(behaviorProfile.consistencyBand).toLowerCase();

        if (recoveryRisk) tagHints.push(recoveryRisk);
        if (accountabilityRisk) tagHints.push(accountabilityRisk);
        if (consistencyBand) tagHints.push(consistencyBand);
    }

    if (plannerStats && typeof plannerStats === 'object') {
        const challengePreference = sanitize(plannerStats.challengePreference).toLowerCase();
        const executionTrend = sanitize(plannerStats.executionTrend).toLowerCase();

        if (challengePreference) tagHints.push(challengePreference);
        if (executionTrend) tagHints.push(executionTrend);
    }

    return {
        categoryHints: [...new Set(categoryHints.filter(Boolean))],
        tagHints: [...new Set(tagHints.filter(Boolean))]
    };
}

async function buildPlanningContext({
    uid = '',
    profile = {},
    behaviorProfile = {},
    plannerStats = {}
} = {}) {
    const hints = collectHints(profile, behaviorProfile, plannerStats);
    const settings = await aiNurtureRepo.getSettings();

    const [packs, libraryItemsRaw, memoryCardsRaw, overlayKnowledgeRaw] = await Promise.all([
        aiNurtureRepo.listContextPacks(40),
        aiNurtureRepo.listLibrary(80),
        aiNurtureRepo.listMemoryCards(160),
        uid ? aiNurtureRepo.getUserOverlay(uid) : null
    ]);

    const libraryItems = libraryItemsRaw.filter((item) => item.excludedFromPlanner !== true);
    const excludedSourceIds = new Set(
        libraryItemsRaw
            .filter((item) => item.excludedFromPlanner === true)
            .map((item) => sanitize(item.sourceId))
            .filter(Boolean)
    );

    const memoryCards = memoryCardsRaw.filter((item) => !excludedSourceIds.has(sanitize(item.sourceId)));

    const overlayKnowledge =
        overlayKnowledgeRaw && overlayKnowledgeRaw.isActive !== false
            ? {
                note: sanitize(overlayKnowledgeRaw.note),
                rules: Array.isArray(overlayKnowledgeRaw.rules) ? overlayKnowledgeRaw.rules : [],
                redFlags: Array.isArray(overlayKnowledgeRaw.redFlags) ? overlayKnowledgeRaw.redFlags : [],
                focusThemes: Array.isArray(overlayKnowledgeRaw.focusThemes) ? overlayKnowledgeRaw.focusThemes : [],
                tags: Array.isArray(overlayKnowledgeRaw.tags) ? overlayKnowledgeRaw.tags : [],
                isActive: true
            }
            : null;

    const selected = aiNurturePolicy.selectContextFromAssets({
        packs,
        libraryItems,
        memoryCards,
        categoryHints: hints.categoryHints,
        tagHints: hints.tagHints,
        limits: settings?.plannerPackLimits || {},
        overlayKnowledge
    });

    return {
        ...selected,
        categoryHints: hints.categoryHints,
        tagHints: hints.tagHints,
        overlayKnowledge
    };
}

module.exports = {
    buildPlanningContext
};