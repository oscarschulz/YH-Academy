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

    if (/wealth|income|money|business|client|sales|offer|revenue/.test(blockerText) || /wealth|income|business|revenue/.test(goals) || /business|sales/.test(currentJob) || priority === 'wealth') {
        categoryHints.push('wealth');
    }

    if (/discipline|routine|consisten|procrastin|execution|habit/.test(blockerText) || priority === 'discipline') {
        categoryHints.push('discipline');
    }

    if (/sleep|energy|health|body|fitness|recovery/.test(blockerText) || priority === 'health') {
        categoryHints.push('health');
    }

    if (/mindset|stress|focus|belief|confidence/.test(blockerText) || priority === 'mindset') {
        categoryHints.push('mindset');
    }

    if (/network|communication|social|persuasion/.test(blockerText) || priority === 'communication') {
        categoryHints.push('communication');
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
    profile = {},
    behaviorProfile = {},
    plannerStats = {}
} = {}) {
    const hints = collectHints(profile, behaviorProfile, plannerStats);

    const [packs, libraryItems, memoryCards] = await Promise.all([
        aiNurtureRepo.listContextPacks(40),
        aiNurtureRepo.listLibrary(60),
        aiNurtureRepo.listMemoryCards(140)
    ]);

    const selected = aiNurturePolicy.selectContextFromAssets({
        packs,
        libraryItems,
        memoryCards,
        categoryHints: hints.categoryHints,
        tagHints: hints.tagHints
    });

    return {
        ...selected,
        categoryHints: hints.categoryHints,
        tagHints: hints.tagHints
    };
}

module.exports = {
    buildPlanningContext
};