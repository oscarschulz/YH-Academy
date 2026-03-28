const aiNurtureRepo = require('../repositories/aiNurtureFirestoreRepo');

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

    if (priority) categoryHints.push(priority);
    if (/wealth|income|money|business/.test(blockerText) || priority === 'wealth') categoryHints.push('wealth');
    if (/discipline|routine|consisten|procrastin/.test(blockerText) || priority === 'discipline') categoryHints.push('discipline');
    if (/sleep|energy|health|body|fitness/.test(blockerText) || priority === 'health') categoryHints.push('health');
    if (/mindset|stress|focus/.test(blockerText) || priority === 'mindset') categoryHints.push('mindset');

    if (coachTone) tagHints.push(coachTone);
    if (behaviorProfile && typeof behaviorProfile === 'object') {
        const recoveryRisk = sanitize(behaviorProfile.recoveryRisk).toLowerCase();
        const accountabilityRisk = sanitize(behaviorProfile.accountabilityRisk).toLowerCase();
        if (recoveryRisk) tagHints.push(recoveryRisk);
        if (accountabilityRisk) tagHints.push(accountabilityRisk);
    }

    if (plannerStats && typeof plannerStats === 'object') {
        const challengePreference = sanitize(plannerStats.challengePreference).toLowerCase();
        if (challengePreference) tagHints.push(challengePreference);
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

    const context = await aiNurtureRepo.buildActiveKnowledgeContext(hints);

    return {
        ...context,
        categoryHints: hints.categoryHints,
        tagHints: hints.tagHints
    };
}

module.exports = {
    buildPlanningContext
};