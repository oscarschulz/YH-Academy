const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const academyFirestoreRepo = require('./backend/repositories/academyFirestoreRepo');
const academyCommunityRepo = require('./backend/repositories/academyCommunityFirestoreRepo');
const academyPlannerKnowledgeContext = require('./backend/services/academyPlannerKnowledgeContext');
const publicLandingEventsRepo = require('./backend/repositories/publicLandingEventsRepo');
const { firestore } = require('./config/firebaseAdmin');

const ACADEMY_UPLOADS_ROOT = path.resolve(
    String(process.env.PERSISTENT_UPLOADS_DIR || '').trim() || path.join(__dirname, 'public', 'uploads')
);
const ACADEMY_PROFILE_UPLOAD_DIR = path.join(ACADEMY_UPLOADS_ROOT, 'academy-profile');
const sanitize = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
};

const toInt = (value, fallback = 0) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeJsonParse = (value, fallback = null) => {
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
};

const dedupeStrings = (values, limit = 3) => {
    const out = [];
    for (const value of Array.isArray(values) ? values : []) {
        const clean = sanitize(value);
        if (!clean) continue;
        if (!out.includes(clean)) out.push(clean);
        if (out.length >= limit) break;
    }
    return out;
};

function mapAcademyOpportunityTimestamp(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return sanitize(value);
}

function normalizeAcademyOpportunityStatus(value = '') {
    const raw = sanitize(value).toLowerCase();

    if (raw === 'active' || raw === 'approved') return 'active';
    if (raw === 'in_discussion' || raw === 'discussion') return 'in_discussion';
    if (raw === 'commission_due') return 'commission_due';
    if (raw === 'commission_paid') return 'commission_paid';
    if (raw === 'closed') return 'closed';
    if (raw === 'rejected') return 'rejected';

    return raw || 'pending_review';
}

function mapPlazaOpportunityToAcademyMission(docSnap) {
    const data = docSnap.data() || {};

    const budgetMin = toFloat(data.budgetMin, 0);
    const budgetMax = toFloat(data.budgetMax, 0);
    const commissionRate = toFloat(data.commissionRate, 0);

    return {
        id: `plaza_${docSnap.id}`,
        sourceId: docSnap.id,
        sourceDivision: 'plaza',
        sourceFeature: 'opportunities',
        title: sanitize(data.title || 'Plaza opportunity'),
        type: sanitize(data.type || 'Opportunity'),
        status: normalizeAcademyOpportunityStatus(data.status || data.reviewStatus || 'active'),
        description: sanitize(data.text || data.description || ''),
        ownerName: sanitize(data.authorName || data.member || data.ownerName || 'Plaza Member'),
        ownerUid: sanitize(data.authorId || data.createdByUserId || data.ownerUid),
        region: sanitize(data.region || 'Global'),
        economyMode: sanitize(data.economyMode || data.compensationType || 'not_sure'),
        currency: sanitize(data.currency || 'USD').toUpperCase() || 'USD',
        budgetMin,
        budgetMax,
        commissionRate,
        federationEscalation: sanitize(data.federationEscalation || 'none'),
        academyMissionNeed: sanitize(data.academyMissionNeed || data.operatorNeed || data.monetizationNote || ''),
        createdAt: mapAcademyOpportunityTimestamp(data.createdAt),
        updatedAt: mapAcademyOpportunityTimestamp(data.updatedAt)
    };
}

function mapFederationDealRoomToAcademyMission(docSnap) {
    const data = docSnap.data() || {};

    const expectedValueAmount = toFloat(data.expectedValueAmount, 0);
    const platformCommissionRate = toFloat(data.platformCommissionRate, 20);
    const platformCommissionAmount = toFloat(
        data.platformCommissionAmount,
        expectedValueAmount > 0 ? Math.round((expectedValueAmount * platformCommissionRate) / 100) : 0
    );

    return {
        id: `federation_${docSnap.id}`,
        sourceId: docSnap.id,
        sourceDivision: 'federation',
        sourceFeature: 'deal_rooms',
        title: sanitize(data.title || 'Federation Deal Room'),
        type: sanitize(data.roomType || data.type || 'partnership'),
        status: normalizeAcademyOpportunityStatus(data.adminStatus || data.dealStatus || 'pending_admin_review'),
        description: sanitize(data.description || ''),
        ownerName: sanitize(data.creatorName || 'Federation Member'),
        ownerUid: sanitize(data.creatorUid),
        region: 'Federation',
        economyMode: 'deal_room',
        currency: sanitize(data.currency || 'USD').toUpperCase() || 'USD',
        expectedValueAmount,
        platformCommissionRate,
        platformCommissionAmount,
        partnerNeed: sanitize(data.partnerNeed || ''),
        academyMissionNeed: sanitize(data.academyMissionNeed || ''),
        createdAt: mapAcademyOpportunityTimestamp(data.createdAt),
        updatedAt: mapAcademyOpportunityTimestamp(data.updatedAt)
    };
}

const FOUNDER_DOCTRINE = {
    principles: [
        'Build the body, discipline, and energy needed to carry bigger responsibilities.',
        'Discipline comes before expansion.',
        'Operate in weekly cycles: start on Sunday, review honestly on Saturday.',
        'If a low-value task keeps repeating, delegate it, automate it, or remove it.',
        'Protect time for health, focus, and self-mastery.'
    ],
    operatingSystem: {
        weekStartsOn: 'Sunday',
        weeklyReviewDay: 'Saturday',
        reviewInstruction: 'Review everything completed and missed this week. Identify what moved life forward, what wasted time, and what must be corrected immediately.',
        delegationRule: 'If a low-value task repeats multiple times, delegate it, automate it, or remove it.'
    },
    resources: [
        {
            key: 'facemax',
            title: 'The FaceMax Protocol',
            url: 'https://oscarschulzz.gumroad.com/l/thefacemaxprotocol',
            description: 'A founder-created resource for improving physical standards, confidence, and discipline.',
            useWhen: [
                'health is a bottleneck',
                'physical discipline is weak',
                'energy is low',
                'appearance confidence is a blocker'
            ]
        }
    ]
};

function buildDoctrineContext(profile, context = {}) {
    const recentSkipped = (context.recentMissions || []).filter((item) => item.status === 'skipped').length;
    const recentStuck = (context.recentMissions || []).filter((item) => item.status === 'stuck').length;

    const weakStructure =
        /no routine|very inconsistent/i.test(profile.currentRoutine || '') ||
        recentSkipped > 1 ||
        recentStuck > 0;

    const healthIsBottleneck =
        (profile.energyScore > 0 && profile.energyScore <= 4) ||
        (profile.sleepHours > 0 && profile.sleepHours < 6) ||
        /health|body|fitness|appearance|confidence/i.test(profile.topPriorityPillar || '') ||
        /health|body|fitness|appearance|confidence|shape|energy/i.test(profile.biggestImmediateProblem || '') ||
        /health|body|appearance|confidence|energy/i.test(profile.blockerText || '');

    const coachBrief = healthIsBottleneck
        ? 'Your body and energy are not side issues. They are part of the mission. Fix the physical base first so you can carry harder responsibilities with consistency.'
        : weakStructure
            ? 'You do not need more noise. You need a tighter operating system. Start the week on Sunday, review it on Saturday, and remove repetition that steals time from your real priorities.'
            : 'The goal is not to stay busy. The goal is to build a version of you that can execute with discipline, protect health, and create visible forward movement every week.';

    const recommendedResources = [];
    if (healthIsBottleneck) {
        recommendedResources.push({
            title: FOUNDER_DOCTRINE.resources[0].title,
            url: FOUNDER_DOCTRINE.resources[0].url,
            reason: 'Recommended because your current bottleneck includes low energy, weak physical discipline, health inconsistency, or appearance-related confidence.'
        });
    }

    return {
        coachBrief,
        weeklyOperatingSystem: { ...FOUNDER_DOCTRINE.operatingSystem },
        recommendedResources
    };
}
const normalizeProfile = (rawProfile = {}) => ({
    city: sanitize(rawProfile.city),
    country: sanitize(rawProfile.country),
    occupationType: sanitize(rawProfile.occupationType || rawProfile.occupation_type),
    currentJob: sanitize(rawProfile.currentJob || rawProfile.current_job),
    industry: sanitize(rawProfile.industry),
    monthlyIncomeRange: sanitize(rawProfile.monthlyIncomeRange || rawProfile.monthly_income_range),
    savingsRange: sanitize(rawProfile.savingsRange || rawProfile.savings_range),
    incomeSource: sanitize(rawProfile.incomeSource || rawProfile.income_source),
    businessStage: sanitize(rawProfile.businessStage || rawProfile.business_stage),
    sleepHours: toFloat(rawProfile.sleepHours || rawProfile.sleep_hours, 0),
    energyScore: toInt(rawProfile.energyScore || rawProfile.energy_score, 0),
    exerciseFrequency: sanitize(rawProfile.exerciseFrequency || rawProfile.exercise_frequency),
    stressScore: toInt(rawProfile.stressScore || rawProfile.stress_score, 0),
    badHabit: sanitize(rawProfile.badHabit || rawProfile.bad_habit),
    seriousness: sanitize(rawProfile.seriousness),
    weeklyHours: toInt(rawProfile.weeklyHours || rawProfile.weekly_hours, 0),
    goals6mo: sanitize(rawProfile.goals6mo || rawProfile.goals_6mo),
    blockerText: sanitize(rawProfile.blockerText || rawProfile.blocker_text),
    coachTone: sanitize(rawProfile.coachTone || rawProfile.coach_tone || 'balanced')
});

function getPriorityPillarKey(profile = {}) {
    const raw = sanitize(
        profile.focusAreaKey ||
        profile?.pillarContext?.key ||
        profile.topPriorityPillar ||
        ''
    ).toLowerCase();

    const map = {
        money: 'wealth',
        wealth: 'wealth',
        business: 'wealth',
        'money, wealth & business': 'wealth',

        discipline: 'discipline',

        health: 'health',
        fitness: 'health',
        'fitness & health': 'health',

        mindset: 'mindset',
        psychology: 'mindset',
        'mindset & psychology': 'mindset',

        communication: 'communication',
        networking: 'communication',
        'communication & networking': 'communication',

        knowledge: 'knowledge',
        'knowledge for life': 'knowledge',

        politics: 'politics',
        'politics & the 2030 agenda': 'politics',
        politics_2030_agenda: 'politics',

        philosophy: 'philosophy'
    };

    return map[raw] || raw || '';
}

function getPlannerPillarFlavor(profile = {}, context = {}) {
    const pillarKey = getPriorityPillarKey(profile);
    const answers =
        profile?.pillarContext?.answers && typeof profile.pillarContext.answers === 'object'
            ? profile.pillarContext.answers
            : (profile?.scopeAnswers && typeof profile.scopeAnswers === 'object'
                ? profile.scopeAnswers
                : {});

    if (pillarKey === 'politics') {
        return {
            pillarKey,
            systemGuidance: [
                'Politics roadmap mode is active.',
                'Treat this pillar as analytical political literacy and geopolitical pattern-recognition, not vague opinion posting.',
                'Use the user politics intake answers to decide the first study lane, especially mainPoliticalGoal, topicCluster, biggestPoliticalConfusion, regionsOfInterest, and newsConsumptionStyle.',
                'Prefer missions that make the user map actors, incentives, institutions, narratives, policy tradeoffs, timelines, and second-order effects.',
                'Do not generate generic tasks like "stay informed" unless they are made concrete with exact outputs.',
                'The roadmap should help the user think more clearly, compare sources, and break down live issues with structure.'
            ].join(' '),
            missionDesignRules: [
                'For politics roadmaps, at least three missions should be explicitly politics-native.',
                'Good politics-native missions include issue maps, actor maps, source-comparison notes, timeline breakdowns, structured summaries, policy consequence analysis, and discussion-prep briefs.',
                `Political intake answers: ${JSON.stringify(answers)}`
            ].join(' ')
        };
    }

    if (pillarKey === 'philosophy') {
        return {
            pillarKey,
            systemGuidance: [
                'Philosophy roadmap mode is active.',
                'Treat this pillar as disciplined thinking, argument analysis, reflection, and perspective-sharpening, not empty inspirational quotes.',
                'Use the philosophy intake answers to decide the first study lane, especially mainPhilosophyQuestion, philosophyArea, readingExperience, preferredLearningStyle, reflectionHabit, argumentConfidence, and desiredPhilosophicalShift.',
                'Prefer missions that make the user define terms, examine assumptions, compare viewpoints, map arguments, journal reflections, and apply ideas to real decisions.',
                'Do not generate generic tasks like "think deeply" unless they are attached to an exact structure and output.',
                'The roadmap should sharpen reasoning, reflection, and worldview formation in a practical way.'
            ].join(' '),
            missionDesignRules: [
                'For philosophy roadmaps, at least three missions should be explicitly philosophy-native.',
                'Good philosophy-native missions include concept definitions, argument maps, objection-and-reply exercises, short reflections, reading notes, personal principle building, and idea application to real life.',
                `Philosophy intake answers: ${JSON.stringify(answers)}`
            ].join(' ')
        };
    }

    return {
        pillarKey,
        systemGuidance: 'Use the selected pillar as the operational center of gravity unless health or discipline is clearly the bigger blocker.',
        missionDesignRules: 'Keep the roadmap grounded, measurable, and execution-friendly.'
    };
}

function getFallbackRoadmapPillarTemplate(profile = {}, context = {}, mappedPriority = '') {
    const pillarKey = getPriorityPillarKey(profile) || mappedPriority;
    const scope =
        profile?.pillarContext?.answers && typeof profile.pillarContext.answers === 'object'
            ? profile.pillarContext.answers
            : (profile?.scopeAnswers && typeof profile.scopeAnswers === 'object'
                ? profile.scopeAnswers
                : {});

    const recentStuck = (context.recentMissions || []).filter((item) => item.status === 'stuck').length;
    const recentSkipped = (context.recentMissions || []).filter((item) => item.status === 'skipped').length;

    const workStyleMinutes =
        /short daily tasks/i.test(profile.preferredWorkStyle || '') ? [12, 18, 30, 22, 28] :
        /deep work blocks/i.test(profile.preferredWorkStyle || '') ? [20, 30, 60, 35, 45] :
        /aggressive challenge mode/i.test(profile.preferredWorkStyle || '') ? [20, 35, 75, 40, 50] :
        [15, 20, 45, 30, 35];

    if (pillarKey === 'politics') {
        const topicClusterMap = {
            geopolitics: 'geopolitics',
            governance_policy: 'governance and policy',
            economics_power: 'economics and power structures',
            agenda_2030: 'the 2030 Agenda',
            media_narratives: 'media narratives',
            mixed: 'politics'
        };

        const topicCluster = sanitize(scope.topicCluster || 'mixed').toLowerCase();
        const topicLabel = topicClusterMap[topicCluster] || 'politics';
        const mainPoliticalGoal = sanitize(
            scope.mainPoliticalGoal ||
            profile.goals6mo ||
            'Build a clearer understanding of political forces and how they shape real outcomes.'
        );
        const biggestConfusion = sanitize(
            scope.biggestPoliticalConfusion ||
            profile.biggestImmediateProblem ||
            profile.blockerText ||
            'Unclear political patterns and moving parts'
        );
        const regions = sanitize(scope.regionsOfInterest || '');
        const sourceStyle = sanitize(scope.newsConsumptionStyle || '');

        return {
            focusAreas: ['politics', 'knowledge', recentSkipped > 1 || recentStuck > 0 ? 'discipline' : 'communication'],
            mainOpportunity: `Build a structured lens for understanding ${topicLabel} instead of consuming politics as scattered noise.`,
            roadmap: {
                goal: mainPoliticalGoal,
                weeklyTheme: 'Political Clarity',
                weeklyTargetOutcome: `Produce one clear political breakdown around ${topicLabel} that you can explain without confusion.`,
                days30: {
                    week1: 'Choose one political lane and build a simple issue map',
                    week2: 'Compare sources, narratives, and incentives',
                    week3: 'Turn raw information into structured explanations',
                    week4: 'Review your framework and sharpen your independent judgment'
                }
            },
            missions: [
                {
                    pillar: 'politics',
                    title: 'Map one live political issue clearly',
                    description: `Choose one issue in ${topicLabel} and write a one-page breakdown of the main actors, their incentives, the timeline, and the likely next development.${regions ? ` Focus especially on: ${regions}.` : ''}`,
                    whyItMatters: 'Political clarity improves when you stop consuming fragments and start mapping the full structure.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[0],
                    sortOrder: 1
                },
                {
                    pillar: 'knowledge',
                    title: 'Compare two different sources on the same issue',
                    description: `Pick one live topic and compare how two different sources frame it.${sourceStyle ? ` Your current source style is: ${sourceStyle}.` : ''} Note what each source emphasizes, ignores, or distorts.`,
                    whyItMatters: 'This trains source awareness instead of passive agreement with the first narrative you see.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[1],
                    sortOrder: 2
                },
                {
                    pillar: 'politics',
                    title: 'Build a short actor and incentive sheet',
                    description: `For the issue you chose, list the institutions, leaders, groups, or blocs involved and explain what each one wants, fears, or stands to gain.`,
                    whyItMatters: 'Politics becomes easier to understand when incentives become visible.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[2],
                    sortOrder: 3
                },
                {
                    pillar: recentStuck > 0 ? 'discipline' : 'politics',
                    title: recentStuck > 0
                        ? 'Shrink your political analysis task until it becomes easy to start'
                        : 'Turn confusion into one clear weekly political brief',
                    description: recentStuck > 0
                        ? `Take the political topic that feels mentally heavy and reduce it to one easier next output: 5 bullet points, one source comparison, or one actor map.`
                        : `Write one short weekly brief answering this: ${biggestConfusion}. Keep it structured, not emotional.`,
                    whyItMatters: recentStuck > 0
                        ? 'A smaller entry point restores momentum.'
                        : 'A weekly brief forces clarity and reveals where your thinking is still weak.',
                    frequency: 'weekly',
                    dueDate: addDaysISO(3),
                    estimatedMinutes: workStyleMinutes[3],
                    sortOrder: 4
                },
                {
                    pillar: recentSkipped > 1 ? 'discipline' : 'communication',
                    title: recentSkipped > 1
                        ? 'Remove one information-consumption friction point'
                        : 'Explain one issue out loud in simple language',
                    description: recentSkipped > 1
                        ? 'Reduce one friction point that keeps you consuming random political content without structure. Simplify your inputs and keep one main note trail.'
                        : `Record or write a plain-language explanation of one topic in ${topicLabel} as if teaching someone new to it.`,
                    whyItMatters: recentSkipped > 1
                        ? 'Better systems beat information overload.'
                        : 'You understand politics better when you can explain it clearly.',
                    frequency: 'weekly',
                    dueDate: addDaysISO(5),
                    estimatedMinutes: workStyleMinutes[4],
                    sortOrder: 5
                }
            ]
        };
    }

    if (pillarKey === 'philosophy') {
        const philosophyAreaMap = {
            ethics: 'ethics',
            meaning_purpose: 'meaning and purpose',
            logic_reasoning: 'logic and reasoning',
            self_mastery: 'self-mastery',
            truth_reality: 'truth and reality',
            mixed: 'philosophy'
        };

        const philosophyArea = sanitize(scope.philosophyArea || 'mixed').toLowerCase();
        const philosophyLabel = philosophyAreaMap[philosophyArea] || 'philosophy';
        const mainQuestion = sanitize(
            scope.mainPhilosophyQuestion ||
            profile.goals6mo ||
            'Sharpen how you think about truth, meaning, discipline, and real life decisions.'
        );
        const desiredShift = sanitize(
            scope.desiredPhilosophicalShift ||
            profile.biggestImmediateProblem ||
            profile.blockerText ||
            'A stronger and clearer way of thinking'
        );
        const learningStyle = sanitize(scope.preferredLearningStyle || 'mixed');

        return {
            focusAreas: ['philosophy', 'knowledge', recentSkipped > 1 || recentStuck > 0 ? 'discipline' : 'mindset'],
            mainOpportunity: `Turn philosophy from abstract interest into sharper reasoning, clearer principles, and better judgment in real life.`,
            roadmap: {
                goal: mainQuestion,
                weeklyTheme: 'Philosophical Clarity',
                weeklyTargetOutcome: 'Produce one clear written reflection or argument map that sharpens your perspective this week.',
                days30: {
                    week1: 'Clarify the core question and define the key terms',
                    week2: 'Compare viewpoints and test assumptions',
                    week3: 'Apply the ideas to your own decisions and habits',
                    week4: 'Refine your principles and sharpen your reasoning'
                }
            },
            missions: [
                {
                    pillar: 'philosophy',
                    title: 'Define the exact question you are trying to answer',
                    description: `Write the core philosophical question in one sentence, then define the key terms inside it.${philosophyLabel ? ` Current area: ${philosophyLabel}.` : ''}`,
                    whyItMatters: 'Philosophy gets sharper when the question and its terms become precise.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[0],
                    sortOrder: 1
                },
                {
                    pillar: 'knowledge',
                    title: 'Study one idea and extract the central claim',
                    description: `Use your preferred style (${learningStyle}) to engage one short philosophy source, then write the main claim, the reason behind it, and one objection to it.`,
                    whyItMatters: 'This trains active thinking instead of passive inspiration.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[1],
                    sortOrder: 2
                },
                {
                    pillar: 'philosophy',
                    title: 'Map one argument step by step',
                    description: `Take one belief, quote, or idea related to "${mainQuestion}" and break it into claim, reasons, assumptions, and possible counterarguments.`,
                    whyItMatters: 'Argument mapping strengthens logic and reduces vague thinking.',
                    frequency: 'daily',
                    dueDate: todayISO(),
                    estimatedMinutes: workStyleMinutes[2],
                    sortOrder: 3
                },
                {
                    pillar: recentStuck > 0 ? 'discipline' : 'mindset',
                    title: recentStuck > 0
                        ? 'Reduce your reflection task to one simple written output'
                        : 'Apply one philosophical idea to a real decision this week',
                    description: recentStuck > 0
                        ? 'If the thinking task feels too abstract, reduce it to five sentences: what the idea is, why it matters, and what you will do with it.'
                        : `Write how one idea changes the way you should act, choose, or judge in real life. Target shift: ${desiredShift}.`,
                    whyItMatters: recentStuck > 0
                        ? 'Smaller reflection keeps the pillar practical.'
                        : 'Philosophy matters when it changes perception and conduct.',
                    frequency: 'weekly',
                    dueDate: addDaysISO(3),
                    estimatedMinutes: workStyleMinutes[3],
                    sortOrder: 4
                },
                {
                    pillar: recentSkipped > 1 ? 'discipline' : 'philosophy',
                    title: recentSkipped > 1
                        ? 'Remove one friction point blocking your thinking habit'
                        : 'Write one weekly philosophical reflection',
                    description: recentSkipped > 1
                        ? 'Remove one pattern that keeps reflection, reading, or argument practice from happening consistently.'
                        : `Write one short reflection on this question: ${mainQuestion}. Keep it clear, honest, and structured.`,
                    whyItMatters: recentSkipped > 1
                        ? 'Consistency is what turns philosophy into an actual practice.'
                        : 'A weekly reflection turns ideas into a personal operating lens.',
                    frequency: 'weekly',
                    dueDate: addDaysISO(5),
                    estimatedMinutes: workStyleMinutes[4],
                    sortOrder: 5
                }
            ]
        };
    }

    return null;
}

function buildFallbackRoadmap(profile, context = {}) {
    const focusAreas = [];
    const bottlenecks = [];
    const strengths = [];

    let readinessScore = 60;

    const priorityMap = {
        money: 'wealth',
        wealth: 'wealth',
        business: 'wealth',
        'money, wealth & business': 'wealth',

        discipline: 'discipline',

        health: 'health',
        fitness: 'health',
        'fitness & health': 'health',

        mindset: 'mindset',
        psychology: 'mindset',
        'mindset & psychology': 'mindset',

        communication: 'communication',
        networking: 'communication',
        'communication & networking': 'communication',

        knowledge: 'knowledge',
        'knowledge for life': 'knowledge',

        politics: 'politics',
        'politics & the 2030 agenda': 'politics',

        philosophy: 'philosophy'
    };

    const mappedPriority = priorityMap[(profile.topPriorityPillar || '').toLowerCase()] || '';

    if (profile.energyScore <= 4 || profile.sleepHours < 6) {
        focusAreas.push('health');
        bottlenecks.push('Low energy and weak recovery');
        readinessScore -= 8;
    } else {
        strengths.push('Usable energy base');
        readinessScore += 4;
    }

    if (profile.weeklyHours >= 10) {
        strengths.push('Good weekly time commitment');
        readinessScore += 8;
    } else {
        bottlenecks.push('Limited weekly execution time');
        readinessScore -= 5;
    }

    if (/very serious/i.test(profile.seriousness || '')) {
        strengths.push('High seriousness');
        readinessScore += 10;
    } else if (/curious/i.test(profile.seriousness || '')) {
        bottlenecks.push('Low commitment signal');
        readinessScore -= 8;
    }

    if (profile.currentRoutine && /no routine|very inconsistent/i.test(profile.currentRoutine)) {
        focusAreas.push('discipline');
        bottlenecks.push('Weak daily structure');
        readinessScore -= 6;
    }

    if (profile.blockerText && profile.blockerText.length > 6) {
        focusAreas.push('discipline');
        bottlenecks.push('Execution inconsistency');
    }

    if (profile.biggestImmediateProblem) {
        bottlenecks.push(profile.biggestImmediateProblem);
    }

    if (profile.monthlyIncomeRange && /0|none|below|under/i.test(profile.monthlyIncomeRange)) {
        focusAreas.push('wealth');
        bottlenecks.push('Weak current income base');
        readinessScore -= 6;
    } else {
        focusAreas.push('wealth');
    }

    if (mappedPriority) {
        focusAreas.unshift(mappedPriority);
    }

    if (!focusAreas.includes('discipline')) focusAreas.push('discipline');

    const uniqueFocusAreas = [...new Set(focusAreas)].slice(0, 3);
    const uniqueBottlenecks = [...new Set(bottlenecks)].slice(0, 3);
    const uniqueStrengths = [...new Set(strengths)].slice(0, 3);

    readinessScore = clamp(readinessScore, 45, 95);

    const primaryBottleneck = uniqueBottlenecks[0] || 'Lack of clear execution structure';
    const secondaryBottleneck = uniqueBottlenecks[1] || 'Scattered effort across too many goals';
    const mainOpportunity = profile.next30DaysWin
        ? `Turn the next 30-day win into a measurable execution plan: ${profile.next30DaysWin}`
        : uniqueFocusAreas.includes('wealth')
            ? 'Build a small but consistent income system around your current skills'
            : 'Stabilize routine first, then scale execution';

    const recentStuck = (context.recentMissions || []).filter((item) => item.status === 'stuck').length;
    const recentSkipped = (context.recentMissions || []).filter((item) => item.status === 'skipped').length;

    const workStyleMinutes =
        /short daily tasks/i.test(profile.preferredWorkStyle || '') ? [10, 15, 30, 15, 20] :
        /deep work blocks/i.test(profile.preferredWorkStyle || '') ? [20, 25, 90, 30, 45] :
        /aggressive challenge mode/i.test(profile.preferredWorkStyle || '') ? [20, 30, 90, 35, 45] :
        [15, 20, 60, 25, 30];

    const accountabilityTone =
        /strict|hard/i.test(profile.accountabilityStyle || '')
            ? 'This needs a clear deadline and no excuses.'
            : /encouragement|simple wins/i.test(profile.accountabilityStyle || '')
                ? 'Keep the task simple enough to complete today.'
                : 'Make the task clear and easy to track.';

const doctrine = buildDoctrineContext(profile, context);
const specializedTemplate = getFallbackRoadmapPillarTemplate(profile, context, mappedPriority);

const missions = specializedTemplate?.missions || [
    {
        pillar: uniqueFocusAreas[0] || 'discipline',
        title: mappedPriority === 'wealth'
            ? 'Do one income-moving task today'
            : 'Set a hard start time for your main work block',
        description: mappedPriority === 'wealth'
            ? 'Choose one exact task tied to outreach, selling, client work, or offer building and complete it today.'
            : 'Choose one exact time window every day for focused execution.',
        whyItMatters: accountabilityTone,
        frequency: 'daily',
        dueDate: todayISO(),
        estimatedMinutes: workStyleMinutes[0],
        sortOrder: 1
    },
    {
        pillar: 'health',
        title: 'Protect energy and reduce avoidable drain',
        description: profile.sleepHours < 6
            ? 'Create a shut-down routine tonight and protect your sleep window.'
            : 'Remove one habit today that keeps draining your energy or attention.',
        whyItMatters: 'Your energy determines the quality of your decisions.',
        frequency: 'daily',
        dueDate: todayISO(),
        estimatedMinutes: workStyleMinutes[1],
        sortOrder: 2
    },
    {
        pillar: mappedPriority || 'wealth',
        title: profile.next30DaysWin
            ? 'Take one action toward your 30-day win'
            : 'Work on one high-value forward task',
        description: profile.next30DaysWin
            ? `Do one concrete action that directly moves this result forward: ${profile.next30DaysWin}`
            : 'Spend one block on the most valuable task available to you today.',
        whyItMatters: 'The roadmap has to create visible movement, not just intention.',
        frequency: 'daily',
        dueDate: todayISO(),
        estimatedMinutes: workStyleMinutes[2],
        sortOrder: 3
    },
    {
        pillar: recentStuck > 0 ? 'discipline' : (mappedPriority || 'discipline'),
        title: recentStuck > 0
            ? 'Simplify the task you kept getting stuck on'
            : 'Define the clearest weekly target',
        description: recentStuck > 0
            ? 'Break your hardest blocked task into one smaller, easier next action.'
            : 'Write the exact target for this week and the action that creates it.',
        whyItMatters: recentStuck > 0
            ? 'Momentum returns when the task becomes easier to start.'
            : 'Clear targets convert effort into direction.',
        frequency: 'weekly',
        dueDate: addDaysISO(3),
        estimatedMinutes: workStyleMinutes[3],
        sortOrder: 4
    },
    {
        pillar: recentSkipped > 1 ? 'discipline' : (mappedPriority || 'wealth'),
        title: recentSkipped > 1
            ? 'Remove one major execution friction point'
            : 'Review your blocker and remove one friction point',
        description: recentSkipped > 1
            ? 'Identify one environmental or behavioral pattern that keeps causing skips and remove it.'
            : `Fix one thing that keeps making you delay action.${profile.biggestImmediateProblem ? ` Main problem: ${profile.biggestImmediateProblem}.` : ''}`,
        whyItMatters: 'Execution improves when friction is reduced.',
        frequency: 'weekly',
        dueDate: addDaysISO(5),
        estimatedMinutes: workStyleMinutes[4],
        sortOrder: 5
    }
];

return {
    readinessScore,
    summary: {
        primaryBottleneck,
        secondaryBottleneck,
        mainOpportunity: specializedTemplate?.mainOpportunity || mainOpportunity,
        strengths: uniqueStrengths
    },
    focusAreas: Array.isArray(specializedTemplate?.focusAreas) && specializedTemplate.focusAreas.length
        ? specializedTemplate.focusAreas
        : uniqueFocusAreas,
    roadmap: {
        goal: specializedTemplate?.roadmap?.goal || profile.goals6mo || 'Stabilize structure, improve energy, and create measurable forward movement.',
        coachTone: profile.coachTone || 'balanced',
        weeklyTheme: specializedTemplate?.roadmap?.weeklyTheme || (recentStuck > 0 ? 'Friction Reduction' : 'Execution Structure'),
        weeklyTargetOutcome: specializedTemplate?.roadmap?.weeklyTargetOutcome || profile.next30DaysWin || (recentStuck > 0 ? 'Finish blocked work in smaller steps' : 'Create visible forward progress this week'),
        coachBrief: doctrine.coachBrief,
        weeklyOperatingSystem: doctrine.weeklyOperatingSystem,
        recommendedResources: doctrine.recommendedResources,
        days30: specializedTemplate?.roadmap?.days30 || {
            week1: 'Reset structure and reduce friction',
            week2: 'Build consistency and protect energy',
            week3: 'Increase output on your highest-priority pillar',
            week4: 'Review progress and tighten execution'
        }
    },
    missions
};
}

function normalizeMission(rawMission = {}, index = 0) {
    const fallbackPillar = index === 0 ? 'discipline' : index === 1 ? 'health' : 'wealth';
    const frequency = sanitize(rawMission.frequency || 'daily').toLowerCase();
    const safeFrequency = ['daily', 'weekly', 'one-off'].includes(frequency) ? frequency : 'daily';
    return {
        pillar: sanitize(rawMission.pillar || fallbackPillar).toLowerCase() || fallbackPillar,
        title: sanitize(rawMission.title || `Mission ${index + 1}`),
        description: sanitize(rawMission.description || ''),
        whyItMatters: sanitize(rawMission.whyItMatters || rawMission.why_it_matters || ''),
        frequency: safeFrequency,
        dueDate: sanitize(rawMission.dueDate || rawMission.due_date || (safeFrequency === 'daily' ? todayISO() : addDaysISO(index + 1))),
        estimatedMinutes: clamp(toInt(rawMission.estimatedMinutes || rawMission.estimated_minutes, 25), 5, 180),
        sortOrder: toInt(rawMission.sortOrder || rawMission.sort_order, index + 1)
    };
}

function normalizePlan(rawPlan, profile, context = {}) {
    const fallback = buildFallbackRoadmap(profile, context);
    const doctrine = buildDoctrineContext(profile, context);
    const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
    const roadmapNode = plan.roadmap && typeof plan.roadmap === 'object' ? plan.roadmap : {};
    const summaryNode = roadmapNode.summary && typeof roadmapNode.summary === 'object'
        ? roadmapNode.summary
        : (plan.summary && typeof plan.summary === 'object' ? plan.summary : {});

    const missionsSource = Array.isArray(plan.missions) && plan.missions.length ? plan.missions : fallback.missions;
    const normalizedMissions = missionsSource.slice(0, 5).map((mission, index) => normalizeMission(mission, index));

    const weeklyOperatingSystemNode =
        roadmapNode.weeklyOperatingSystem && typeof roadmapNode.weeklyOperatingSystem === 'object'
            ? roadmapNode.weeklyOperatingSystem
            : {};

    const recommendedResourcesNode = Array.isArray(roadmapNode.recommendedResources)
        ? roadmapNode.recommendedResources
        : fallback.roadmap.recommendedResources;

    return {
        readinessScore: clamp(
            toInt(roadmapNode.readinessScore ?? plan.readinessScore, fallback.readinessScore),
            35,
            99
        ),
        summary: {
            primaryBottleneck: sanitize(summaryNode.primaryBottleneck || fallback.summary.primaryBottleneck),
            secondaryBottleneck: sanitize(summaryNode.secondaryBottleneck || fallback.summary.secondaryBottleneck),
            mainOpportunity: sanitize(summaryNode.mainOpportunity || fallback.summary.mainOpportunity),
            strengths: dedupeStrings(summaryNode.strengths || fallback.summary.strengths, 4)
        },
        focusAreas: dedupeStrings(roadmapNode.focusAreas || plan.focusAreas || fallback.focusAreas, 3),
        roadmap: {
            goal: sanitize(roadmapNode.goal || fallback.roadmap.goal),
            coachTone: sanitize(roadmapNode.coachTone || profile.coachTone || fallback.roadmap.coachTone || 'balanced') || 'balanced',
            weeklyTheme: sanitize(roadmapNode.weeklyTheme || fallback.roadmap.weeklyTheme || ''),
            weeklyTargetOutcome: sanitize(roadmapNode.weeklyTargetOutcome || fallback.roadmap.weeklyTargetOutcome || ''),
            coachBrief: sanitize(roadmapNode.coachBrief || fallback.roadmap.coachBrief || doctrine.coachBrief),
            weeklyOperatingSystem: {
                weekStartsOn: sanitize(weeklyOperatingSystemNode.weekStartsOn || fallback.roadmap.weeklyOperatingSystem.weekStartsOn || doctrine.weeklyOperatingSystem.weekStartsOn),
                weeklyReviewDay: sanitize(weeklyOperatingSystemNode.weeklyReviewDay || fallback.roadmap.weeklyOperatingSystem.weeklyReviewDay || doctrine.weeklyOperatingSystem.weeklyReviewDay),
                reviewInstruction: sanitize(weeklyOperatingSystemNode.reviewInstruction || fallback.roadmap.weeklyOperatingSystem.reviewInstruction || doctrine.weeklyOperatingSystem.reviewInstruction),
                delegationRule: sanitize(weeklyOperatingSystemNode.delegationRule || fallback.roadmap.weeklyOperatingSystem.delegationRule || doctrine.weeklyOperatingSystem.delegationRule)
            },
            recommendedResources: (Array.isArray(recommendedResourcesNode) ? recommendedResourcesNode : [])
                .slice(0, 3)
                .map((item) => ({
                    title: sanitize(item?.title || ''),
                    url: sanitize(item?.url || ''),
                    reason: sanitize(item?.reason || '')
                }))
                .filter((item) => item.title && item.url),
            days30: {
                week1: sanitize((roadmapNode.days30 || {}).week1 || fallback.roadmap.days30.week1),
                week2: sanitize((roadmapNode.days30 || {}).week2 || fallback.roadmap.days30.week2),
                week3: sanitize((roadmapNode.days30 || {}).week3 || fallback.roadmap.days30.week3),
                week4: sanitize((roadmapNode.days30 || {}).week4 || fallback.roadmap.days30.week4)
            }
        },
        missions: normalizedMissions.length ? normalizedMissions : fallback.missions
    };
}

function buildPlannerSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            roadmap: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    readinessScore: { type: 'integer', minimum: 35, maximum: 99 },
                    focusAreas: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 3,
                        items: { type: 'string' }
                    },
                    summary: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            primaryBottleneck: { type: 'string' },
                            secondaryBottleneck: { type: 'string' },
                            mainOpportunity: { type: 'string' },
                            strengths: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        },
                        required: ['primaryBottleneck', 'secondaryBottleneck', 'mainOpportunity', 'strengths']
                    },
                    goal: { type: 'string' },
                    coachTone: { type: 'string' },
                    weeklyTheme: { type: 'string' },
                    weeklyTargetOutcome: { type: 'string' },
                    coachBrief: { type: 'string' },
                    weeklyOperatingSystem: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            weekStartsOn: { type: 'string' },
                            weeklyReviewDay: { type: 'string' },
                            reviewInstruction: { type: 'string' },
                            delegationRule: { type: 'string' }
                        },
                        required: ['weekStartsOn', 'weeklyReviewDay', 'reviewInstruction', 'delegationRule']
                    },
                    recommendedResources: {
                        type: 'array',
                        maxItems: 3,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                title: { type: 'string' },
                                url: { type: 'string' },
                                reason: { type: 'string' }
                            },
                            required: ['title', 'url', 'reason']
                        }
                    },
                    days30: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            week1: { type: 'string' },
                            week2: { type: 'string' },
                            week3: { type: 'string' },
                            week4: { type: 'string' }
                        },
                        required: ['week1', 'week2', 'week3', 'week4']
                    }
                },
                required: [
                    'readinessScore',
                    'focusAreas',
                    'summary',
                    'goal',
                    'coachTone',
                    'weeklyTheme',
                    'weeklyTargetOutcome',
                    'coachBrief',
                    'weeklyOperatingSystem',
                    'recommendedResources',
                    'days30'
                ]
            },
            missions: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: {
                    type: 'object',
                    additionalProperties: false,
                properties: {
                    pillar: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    doneLooksLike: { type: 'string' },
                    whyItMatters: { type: 'string' },
                    frequency: { type: 'string', enum: ['daily', 'weekly', 'one-off'] },
                    dueDate: { type: 'string' },
                    estimatedMinutes: { type: 'integer', minimum: 5, maximum: 180 },
                    sortOrder: { type: 'integer', minimum: 1, maximum: 10 }
                },
                required: ['pillar', 'title', 'description', 'doneLooksLike', 'whyItMatters', 'frequency', 'dueDate', 'estimatedMinutes', 'sortOrder']
                }
            }
        },
        required: ['roadmap', 'missions']
    };
}

function buildPlannerMessages(profile, context = {}) {
    const recentMissions = (context.recentMissions || []).map((mission) => ({
        pillar: sanitize(mission.pillar),
        title: sanitize(mission.title),
        status: sanitize(mission.status),
        note: sanitize(mission.completionNote || mission.completion_note || ''),
        dueDate: sanitize(mission.dueDate || mission.due_date || ''),
        estimatedMinutes: toInt(mission.estimatedMinutes || mission.estimated_minutes, 0),
        selectionReason: sanitize(mission.selectionReason || ''),
        outcomeMetrics: mission?.outcomeMetrics && typeof mission.outcomeMetrics === 'object'
            ? mission.outcomeMetrics
            : {}
    }));

    const recentCheckins = (context.recentCheckins || []).map((checkin) => {
        const missionSignals =
            checkin?.aiFeedback && typeof checkin.aiFeedback === 'object' &&
            checkin.aiFeedback.missionSignals && typeof checkin.aiFeedback.missionSignals === 'object'
                ? checkin.aiFeedback.missionSignals
                : {};

        return {
            energyScore: toInt(checkin.energyScore || checkin.energy_score, 0),
            moodScore: toInt(checkin.moodScore || checkin.mood_score, 0),
            completedSummary: sanitize(checkin.completedSummary || checkin.completed_summary || ''),
            blockerText: sanitize(checkin.blockerText || checkin.blocker_text || ''),
            tomorrowFocus: sanitize(checkin.tomorrowFocus || checkin.tomorrow_focus || ''),
            missionSignals: {
                total: toInt(missionSignals.total, 0),
                completed: toInt(missionSignals.completed, 0),
                pending: toInt(missionSignals.pending, 0),
                skipped: toInt(missionSignals.skipped, 0),
                stuck: toInt(missionSignals.stuck, 0)
            }
        };
    });

    const activeRoadmap = context.activeRoadmap || null;
    const adaptivePlanning = context.adaptivePlanning && typeof context.adaptivePlanning === 'object'
        ? context.adaptivePlanning
        : {};
    const previousBehaviorProfile = context.previousBehaviorProfile && typeof context.previousBehaviorProfile === 'object'
        ? context.previousBehaviorProfile
        : {};
    const plannerStats = context.plannerStats && typeof context.plannerStats === 'object'
        ? context.plannerStats
        : {};
    const pillarFlavor = getPlannerPillarFlavor(profile, context);

    return [
        {
            role: 'system',
            content: [
                'You are the Academy planner for Young Hustlers.',
                'Generate a realistic, hard-nosed, supportive roadmap for the user.',
                'Use the full intake profile, especially age range, reason for joining now, top priority pillar, biggest immediate problem, current routine, preferred work style, accountability style, next-30-days win, extra context, energy, time, seriousness, money reality, and past execution behavior.',
                'Do not produce generic motivation fluff.',
                'Prefer missions that are specific, actionable, measurable, and realistically completable.',
                'Write description as the exact execution instructions for the user.',
                'Start every description with an imperative action verb when possible, such as Write, List, Compare, Record, Draft, Map, Define, Review, Build, Identify, or Explain.',
                'Do not start description with vague phrasing like "Your task is to", "The task is to", "This mission is to", "Your goal is to", or "Focus on".',
                'Keep description operational and step-like. Sentence one should tell the user exactly what to do. Sentence two may add scope, constraint, or context if needed.',
                'Every mission must include doneLooksLike that states the concrete finish condition or visible output.',
                'Make doneLooksLike externally visible and easy to judge. It should sound like something a reviewer could verify.',
                'The planner is adaptive. Use the planning context and trend summary to decide whether to reduce, stabilize, or raise challenge.',
                'If recovery risk is high, simplify the workload, reduce friction, and include health or discipline stabilizers.',
                'If execution reliability is improving and friction is low, you may raise challenge in a controlled way.',
                'If the user has repeated skips or stuck missions, reduce complexity before increasing ambition.',
                'Bias the roadmap toward the user priority pillar unless health or discipline is clearly the bigger blocker.',
                'At least one mission should support wealth or income movement when appropriate.',
                'Match the mission style to the user work style and accountability preference.',
                'Respect the adaptive minute cap and mission count cap unless there is a very strong reason not to.',
                'Apply the founder doctrine when relevant.',
                'Apply nurtureKnowledge when it contains usable rules, examples, red flags, or priority themes relevant to the current user state.',
                `Planner pillar mode: ${pillarFlavor.pillarKey || 'general'}.`,
                pillarFlavor.systemGuidance,
                pillarFlavor.missionDesignRules,
                `Founder doctrine principles: ${FOUNDER_DOCTRINE.principles.join(' | ')}`,
                'The doctrine is an operating standard, not generic hype.',
                'Always return a short founder-style coachBrief for the week.',
                'Always return weeklyOperatingSystem with the exact week structure and weekly review standard.',
                'Recommend founder resources only when clearly justified by the user bottleneck.',
                'If health, physical discipline, energy, or appearance-confidence is a real blocker, you may recommend The FaceMax Protocol.',
                `If you recommend The FaceMax Protocol, use this exact URL: ${FOUNDER_DOCTRINE.resources[0].url}`,
                'Do not recommend founder resources randomly or in every plan.',
                'Every recommended resource must include a concrete reason tied to the profile or recent execution behavior.',
                'Keep the missions operational. Put the philosophy in coachBrief and weeklyOperatingSystem, not as long speeches inside every mission.',
                'Return only schema-valid data.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                trigger: sanitize(context.trigger || 'manual'),
                mode: sanitize(context.mode || 'initial'),
                profile,
                activeRoadmap,
                recentMissions,
                recentCheckins,
                behaviorProfile: context.behaviorProfile || {},
                previousBehaviorProfile,
                plannerStats,
                adaptivePlanning,
                founderDoctrine: FOUNDER_DOCTRINE,
                nurtureKnowledge: context.nurtureKnowledge || {}
            })
        }
    ];
}

function extractPlannerResult(data, profile, context, provider, model) {
    const message = data?.choices?.[0]?.message;
    if (!message) {
        throw new Error(`${provider} planner returned no message.`);
    }

    if (message.refusal) {
        throw new Error(`${provider} planner refused: ${message.refusal}`);
    }

    const rawContent = typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
            ? message.content.map((part) => part.text || '').join('')
            : '';

    const parsed = safeJsonParse(rawContent, null);
    if (!parsed) {
        throw new Error(`${provider} planner returned invalid JSON.`);
    }

    return {
        plan: normalizePlan(parsed, profile, context),
        model,
        provider
    };
}

async function requestGeminiRoadmap(profile, context = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || typeof fetch !== 'function') {
        return null;
    }

    const model = sanitize(
        process.env.GEMINI_PLANNER_MODEL ||
        process.env.ACADEMY_PLANNER_MODEL ||
        'gemini-2.5-flash'
    ) || 'gemini-2.5-flash';

    const requestBody = {
        model,
        messages: buildPlannerMessages(profile, context),
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: 'academy_plan',
                strict: true,
                schema: buildPlannerSchema()
            }
        },
        temperature: 0.4
    };

    requestBody.reasoning_effort = sanitize(
        process.env.GEMINI_PLANNER_REASONING_EFFORT ||
        process.env.ACADEMY_PLANNER_REASONING_EFFORT ||
        'medium'
    ) || 'medium';

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
        throw new Error(data?.error?.message || 'Gemini planner request failed.');
    }

    return extractPlannerResult(data, profile, context, 'gemini', model);
}

async function requestOpenAiRoadmap(profile, context = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || typeof fetch !== 'function') {
        return null;
    }

    const model = sanitize(process.env.OPENAI_PLANNER_FALLBACK_MODEL || 'gpt-5.4') || 'gpt-5.4';

    const requestBody = {
        model,
        messages: buildPlannerMessages(profile, context),
        response_format: {
            type: 'json_schema',
            json_schema: {
                name: 'academy_plan',
                strict: true,
                schema: buildPlannerSchema()
            }
        },
        temperature: 0.4
    };

    if (/^(gpt-5|o[13]|o4)/i.test(model)) {
        requestBody.reasoning_effort = sanitize(
            process.env.OPENAI_PLANNER_REASONING_EFFORT ||
            process.env.ACADEMY_PLANNER_REASONING_EFFORT ||
            'medium'
        ) || 'medium';
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
        throw new Error(data?.error?.message || 'OpenAI planner request failed.');
    }

    return extractPlannerResult(data, profile, context, 'openai', model);
}

async function requestAiRoadmap(profile, context = {}) {
    try {
        const geminiResult = await requestGeminiRoadmap(profile, context);
        if (geminiResult?.plan) {
            return geminiResult;
        }
    } catch (error) {
        console.error('Gemini Planner Fallback:', error.message);
    }

    try {
        const openAiResult = await requestOpenAiRoadmap(profile, context);
        if (openAiResult?.plan) {
            return openAiResult;
        }
    } catch (error) {
        console.error('OpenAI Planner Fallback:', error.message);
    }

    return null;
}

function getAcademyAuthUid(req) {
    return sanitize(req.user?.firebaseUid || req.user?.id);
}

function normalizeAcademyProfileTags(values = []) {
    const source = Array.isArray(values)
        ? values
        : String(values || '').split(',');

    const seen = new Set();
    const out = [];

    for (const value of source) {
        const clean = sanitize(value)
            .toLowerCase()
            .replace(/^#/, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 32);

        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean);

        if (out.length >= 8) break;
    }

    return out;
}

function academyProfileAssetExists(assetPath = '') {
    const clean = sanitize(assetPath);
    if (!clean) return false;

    const withoutQuery = clean.split('?')[0].split('#')[0];
    const normalized =
        withoutQuery.startsWith('/uploads/academy/profile/')
            ? withoutQuery.replace('/uploads/academy/profile/', '/uploads/academy-profile/')
            : withoutQuery;

    if (!normalized.startsWith('/uploads/academy-profile/')) {
        return true;
    }

    const fileName = path.basename(normalized);
    if (!fileName) return false;

    try {
        return fs.existsSync(path.join(ACADEMY_PROFILE_UPLOAD_DIR, fileName));
    } catch (_) {
        return false;
    }
}

function sanitizeAcademyProfileAsset(value = '') {
    const clean = sanitize(value);
    if (!clean) return '';

    if (/^data:/i.test(clean)) return '';

    let normalized = '';

    if (/^https?:\/\//i.test(clean)) {
        try {
            const parsed = new URL(clean);
            const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;

            if (candidate.startsWith('/uploads/academy/profile/')) {
                normalized = candidate.replace('/uploads/academy/profile/', '/uploads/academy-profile/');
            } else if (candidate.startsWith('/uploads/academy-profile/')) {
                normalized = candidate;
            } else {
                return clean.slice(0, 2048);
            }
        } catch (_) {
            return clean.slice(0, 2048);
        }
    } else if (clean.startsWith('/uploads/academy/profile/')) {
        normalized = clean.replace('/uploads/academy/profile/', '/uploads/academy-profile/');
    } else if (clean.startsWith('uploads/academy/profile/')) {
        normalized = `/${clean.replace('uploads/academy/profile/', 'uploads/academy-profile/')}`;
    } else if (clean.startsWith('uploads/academy-profile/')) {
        normalized = `/${clean}`;
    } else if (/^[a-z0-9._-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(clean)) {
        normalized = `/uploads/academy-profile/${clean}`;
    } else {
        normalized = clean.startsWith('/') ? clean : `/${clean}`;
    }

    normalized = normalized.slice(0, 2048);

    if (normalized.startsWith('/uploads/academy-profile/') && !academyProfileAssetExists(normalized)) {
        return '';
    }

    return normalized;
}

function normalizeAcademyProfileUsername(value = '', fallback = 'hustler') {
    const cleaned = sanitize(value)
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 32);

    if (cleaned) return cleaned;

    const fallbackClean = sanitize(fallback)
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 32);

    return fallbackClean || 'hustler';
}

function buildAcademyProfileResponse(uid, userData = {}, storedProfile = {}) {
    const displayName =
        sanitize(
            storedProfile.display_name ||
            storedProfile.displayName ||
            userData.displayName ||
            userData.fullName ||
            userData.name ||
            userData.username ||
            'Hustler'
        ) || 'Hustler';

    const canonicalFullName =
        sanitize(
            userData.fullName ||
            userData.name ||
            storedProfile.full_name ||
            storedProfile.fullName ||
            storedProfile.name ||
            displayName
        ) || displayName;

    const username = normalizeAcademyProfileUsername(
        storedProfile.username || userData.username || '',
        displayName
    );

    return {
        id: sanitize(uid),
        full_name: canonicalFullName,
        fullName: canonicalFullName,
        display_name: displayName,
        username,
        avatar: sanitizeAcademyProfileAsset(
            storedProfile.avatar ||
            userData.avatar ||
            userData.profilePhoto ||
            userData.photoURL
        ),
        cover_photo: sanitizeAcademyProfileAsset(
            storedProfile.cover_photo ||
            storedProfile.coverPhoto ||
            userData.coverPhoto
        ),
        role_label: sanitize(
            storedProfile.role_label ||
            storedProfile.roleLabel ||
            userData.roleLabel ||
            userData.role ||
            'Academy Member'
        ) || 'Academy Member',
        bio: sanitize(
            storedProfile.bio ||
            userData.bio ||
            userData.profileBio ||
            userData.about ||
            userData.description ||
            'Focused on execution, consistency, and long-term growth inside The Academy.'
        ) || 'Focused on execution, consistency, and long-term growth inside The Academy.',
        search_tags: normalizeAcademyProfileTags(
            storedProfile.search_tags ||
            storedProfile.searchTags ||
            userData.searchTags
        )
    };
}

async function getAcademyUserAccessSnapshot(uid) {
    const userRef = firestore.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};

    const academyApplication =
        userData.academyApplication && typeof userData.academyApplication === 'object'
            ? userData.academyApplication
            : null;

    const academyMembershipStatus = sanitize(
        userData.academyMembershipStatus ||
        userData.academyApplicationStatus ||
        academyApplication?.status ||
        'none'
    ).toLowerCase() || 'none';

    let accessState = null;
    try {
        accessState = await academyFirestoreRepo.getAccessState(uid);
    } catch (_) {
        accessState = null;
    }

    const hasRoadmapAccess = accessState?.accessState === 'unlocked';

    return {
        userData,
        academyApplication,
        academyMembershipStatus,
        hasRoadmapAccess
    };
}

async function requireApprovedAcademyMembership(uid, res) {
    const snapshot = await getAcademyUserAccessSnapshot(uid);

    if (snapshot.academyMembershipStatus !== 'approved') {
        res.status(403).json({
            success: false,
            message: 'Academy membership not approved.'
        });
        return null;
    }

    return snapshot;
}

async function requireApprovedRoadmapAccess(uid, res) {
    const snapshot = await requireApprovedAcademyMembership(uid, res);
    if (!snapshot) return null;

    if (!snapshot.hasRoadmapAccess) {
        res.status(403).json({
            success: false,
            message: 'Roadmap access not approved yet.'
        });
        return null;
    }

    return snapshot;
}

function getAdaptiveTrendDirection(currentValue, previousValue, mode = 'higher') {
    if (
        previousValue === null ||
        previousValue === undefined ||
        previousValue === ''
    ) {
        return 'stable';
    }

    if (mode === 'higher' || mode === 'lower' || mode === 'minutes-higher') {
        const currentNum = Number(currentValue);
        const previousNum = Number(previousValue);

        if (!Number.isFinite(currentNum) || !Number.isFinite(previousNum)) {
            return 'stable';
        }

        const threshold = mode === 'minutes-higher' ? 5 : 0.05;
        const delta = currentNum - previousNum;

        if (Math.abs(delta) < threshold) return 'stable';

        if (mode === 'higher' || mode === 'minutes-higher') {
            return delta > 0 ? 'improving' : 'declining';
        }

        return delta < 0 ? 'improving' : 'declining';
    }

    const getRank = (value, rankMode) => {
        const normalized = sanitize(value).toLowerCase();

        if (rankMode === 'recovery-risk') {
            if (normalized === 'high') return 0;
            if (normalized === 'normal') return 1;
            if (normalized === 'low') return 2;
            return null;
        }

        if (rankMode === 'accountability-risk') {
            if (normalized === 'high') return 0;
            if (normalized === 'moderate') return 1;
            if (normalized === 'low') return 2;
            return null;
        }

        if (rankMode === 'pressure-response') {
            if (normalized === 'low') return 0;
            if (normalized === 'moderate') return 1;
            if (normalized === 'high') return 2;
            return null;
        }

        return null;
    };

    const currentRank = getRank(currentValue, mode);
    const previousRank = getRank(previousValue, mode);

    if (currentRank === null || previousRank === null) {
        return 'stable';
    }

    if (currentRank === previousRank) {
        return 'stable';
    }

    return currentRank > previousRank ? 'improving' : 'declining';
}

function buildAdaptivePlanningContext(profile = {}, context = {}) {
    const recentMissions = Array.isArray(context.recentMissions) ? context.recentMissions : [];
    const recentCheckins = Array.isArray(context.recentCheckins) ? context.recentCheckins : [];
    const behaviorProfile = context.behaviorProfile && typeof context.behaviorProfile === 'object'
        ? context.behaviorProfile
        : {};
    const previousBehaviorProfile = context.previousBehaviorProfile && typeof context.previousBehaviorProfile === 'object'
        ? context.previousBehaviorProfile
        : {};
    const plannerStats = context.plannerStats && typeof context.plannerStats === 'object'
        ? context.plannerStats
        : {};

    const completedCount = recentMissions.filter((item) => item.status === 'completed').length;
    const skippedCount = recentMissions.filter((item) => item.status === 'skipped').length;
    const stuckCount = recentMissions.filter((item) => item.status === 'stuck').length;

    const executionReliability = Math.max(0, Math.min(toFloat(behaviorProfile.executionReliability, 0), 1));
    const frictionSensitivity = Math.max(0, Math.min(toFloat(behaviorProfile.frictionSensitivity, 0), 1));
    const maxSustainableDailyMinutes = Math.max(
        15,
        toInt(
            behaviorProfile.maxSustainableDailyMinutes,
            toInt(profile.weeklyHours, 0) > 0
                ? Math.round((toInt(profile.weeklyHours, 0) * 60) / 7)
                : 30
        )
    );

    const avgEnergy = recentCheckins.length
        ? Number((
            recentCheckins.reduce((sum, item) => sum + toInt(item.energyScore, 0), 0) / recentCheckins.length
        ).toFixed(2))
        : toInt(profile.energyScore, 0);

    const avgDifficulty = toFloat(plannerStats.averageDifficultyScore, 0);
    const avgUsefulness = toFloat(plannerStats.averageUsefulnessScore, 0);

    const executionTrend = getAdaptiveTrendDirection(
        executionReliability,
        previousBehaviorProfile.executionReliability,
        'higher'
    );

    const frictionTrend = getAdaptiveTrendDirection(
        frictionSensitivity,
        previousBehaviorProfile.frictionSensitivity,
        'lower'
    );

    const sustainableLoadTrend = getAdaptiveTrendDirection(
        maxSustainableDailyMinutes,
        previousBehaviorProfile.maxSustainableDailyMinutes,
        'minutes-higher'
    );

    const recoveryTrend = getAdaptiveTrendDirection(
        behaviorProfile.recoveryRisk,
        previousBehaviorProfile.recoveryRisk,
        'recovery-risk'
    );

    const accountabilityTrend = getAdaptiveTrendDirection(
        behaviorProfile.accountabilityNeed,
        previousBehaviorProfile.accountabilityNeed,
        'accountability-risk'
    );

    const pressureTrend = getAdaptiveTrendDirection(
        behaviorProfile.pressureResponse,
        previousBehaviorProfile.pressureResponse,
        'pressure-response'
    );

    let mode = 'weekly_recalibration';
    let challengeLevel = 'steady';
    let missionCountCap = 4;
    let dailyLoadCap = Math.min(maxSustainableDailyMinutes, 45);
    let coachToneOverride = sanitize(profile.coachTone || 'balanced') || 'balanced';

    const reasons = [];
    const adjustments = [];

    if (!recentMissions.length) {
        mode = 'initial';
        missionCountCap = 4;
        dailyLoadCap = Math.min(maxSustainableDailyMinutes, 45);
        reasons.push('No prior mission history yet, so the planner is starting with a calibration week.');
        adjustments.push('Calibrated first-cycle workload.');
    }

    if (
        avgEnergy <= 4 ||
        sanitize(behaviorProfile.recoveryRisk).toLowerCase() === 'high' ||
        executionReliability <= 0.35 ||
        frictionSensitivity >= 0.6 ||
        stuckCount >= 1
    ) {
        mode = 'recovery';
        challengeLevel = 'reduced';
        missionCountCap = 3;
        dailyLoadCap = Math.min(maxSustainableDailyMinutes, 30);
        coachToneOverride = 'supportive';
        reasons.push('Recovery risk or execution friction is high, so the planner is reducing load and complexity.');
        adjustments.push('Reduced mission count.');
        adjustments.push('Lowered daily minute cap.');
    } else if (
        frictionTrend === 'declining' ||
        accountabilityTrend === 'declining' ||
        avgDifficulty >= 7 ||
        skippedCount >= 2
    ) {
        mode = 'stabilize';
        challengeLevel = 'reduced';
        missionCountCap = 3;
        dailyLoadCap = Math.min(maxSustainableDailyMinutes, 35);
        coachToneOverride = 'supportive';
        reasons.push('Recent friction suggests the user needs a smaller, cleaner execution cycle before scaling.');
        adjustments.push('Stabilized workload.');
    } else if (
        executionTrend === 'improving' &&
        sustainableLoadTrend !== 'declining' &&
        executionReliability >= 0.65 &&
        frictionSensitivity <= 0.35 &&
        sanitize(behaviorProfile.accountabilityNeed).toLowerCase() !== 'high'
    ) {
        mode = 'acceleration';
        challengeLevel = 'raised';
        missionCountCap = 5;
        dailyLoadCap = Math.min(Math.max(maxSustainableDailyMinutes + 10, 45), 90);
        coachToneOverride = 'direct';
        reasons.push('Execution reliability is improving, so the planner can raise challenge in a controlled way.');
        adjustments.push('Raised mission count.');
        adjustments.push('Expanded daily minute cap.');
    }

    const priorityPillars = dedupeStrings([
        ...(Array.isArray(behaviorProfile.preferredMissionTypes) ? behaviorProfile.preferredMissionTypes : []),
        sanitize(profile.topPriorityPillar),
        sanitize(profile.blockerText)
    ], 3);

    const weeklyThemeHint =
        mode === 'recovery'
            ? 'Stabilize energy and remove execution friction'
            : mode === 'stabilize'
                ? 'Rebuild consistency with smaller wins'
                : mode === 'acceleration'
                    ? 'Increase output without losing control'
                    : mode === 'initial'
                        ? 'Build a usable execution baseline'
                        : 'Tighten execution around the highest-leverage tasks';

    const targetOutcomeHint =
        mode === 'recovery'
            ? 'Complete 3 low-friction missions and finish the week with fewer skipped or stuck moments.'
            : mode === 'stabilize'
                ? 'Finish a smaller set of missions cleanly and restore momentum.'
                : mode === 'acceleration'
                    ? 'Complete a heavier but controlled week with at least one wealth-moving task.'
                    : mode === 'initial'
                        ? 'Learn the right workload and execution rhythm for the next cycle.'
                        : 'Complete the critical tasks with better consistency than the previous cycle.';

    const requireRecoveryMission =
        mode === 'recovery' ||
        sanitize(behaviorProfile.recoveryRisk).toLowerCase() === 'high';

    const requireWealthMission =
        /wealth|money|business/i.test(sanitize(profile.topPriorityPillar)) ||
        /income|money|cash|client|business/i.test(sanitize(profile.biggestImmediateProblem));

    return {
        mode,
        challengeLevel,
        missionCountCap,
        dailyLoadCap,
        coachToneOverride,
        requireRecoveryMission,
        requireWealthMission,
        priorityPillars,
        weeklyThemeHint,
        targetOutcomeHint,
        trendSummary: {
            executionReliability: executionTrend,
            frictionSensitivity: frictionTrend,
            sustainableLoad: sustainableLoadTrend,
            recoveryRisk: recoveryTrend,
            accountabilityNeed: accountabilityTrend,
            pressureResponse: pressureTrend
        },
        reason: sanitize(reasons.join(' ')),
        adjustments,
        telemetry: {
            completedCount,
            skippedCount,
            stuckCount,
            avgEnergy,
            avgDifficulty,
            avgUsefulness,
            executionReliability,
            frictionSensitivity,
            maxSustainableDailyMinutes
        }
    };
}

function buildAdaptiveMissionSelectionReason(mission = {}, adaptivePlanning = {}) {
    const pillar = sanitize(mission.pillar).toLowerCase();
    const reasons = [];

    if ((adaptivePlanning.priorityPillars || []).some((item) => sanitize(item).toLowerCase() === pillar)) {
        reasons.push('Aligned with current priority pillar.');
    }

    if (adaptivePlanning.requireRecoveryMission && /health|discipline/i.test(pillar)) {
        reasons.push('Included to reduce recovery risk and execution friction.');
    }

    if (adaptivePlanning.requireWealthMission && /wealth|money|business/i.test(pillar)) {
        reasons.push('Included because current planning cycle still needs income movement.');
    }

    if (sanitize(adaptivePlanning.challengeLevel) === 'reduced') {
        reasons.push('Scoped smaller to improve completion reliability.');
    } else if (sanitize(adaptivePlanning.challengeLevel) === 'raised') {
        reasons.push('Slightly raised because recent execution signals improved.');
    }

    return sanitize(reasons.join(' ') || adaptivePlanning.reason || 'Selected for this planning cycle.');
}

function selectPlanningMode(profile = {}, behaviorProfile = {}, context = {}) {
    return buildAdaptivePlanningContext(profile, {
        ...context,
        behaviorProfile
    }).mode;
}

function scoreMissionQuality(mission = {}, context = {}) {
    const title = sanitize(mission.title);
    const description = sanitize(mission.description);
    const whyItMatters = sanitize(mission.whyItMatters);
    const estimatedMinutes = toInt(mission.estimatedMinutes, 0);
    const maxDailyMinutes = toInt(context?.behaviorProfile?.maxSustainableDailyMinutes, 0);

    const specificity = title && description ? 4 : 1;
    const measurability = estimatedMinutes > 0 ? 4 : 1;
    const realism = maxDailyMinutes > 0 && estimatedMinutes > maxDailyMinutes ? 2 : 4;
    const bottleneckFit = whyItMatters ? 4 : 2;
    const timeFit = estimatedMinutes > 0 ? 4 : 2;

    const passed =
        specificity >= 3 &&
        measurability >= 3 &&
        realism >= 3 &&
        bottleneckFit >= 3 &&
        timeFit >= 3;

    return {
        specificity,
        measurability,
        realism,
        bottleneckFit,
        timeFit,
        passed
    };
}

function normalizeMissionText(value = '') {
    return sanitize(value).replace(/\s+/g, ' ').trim();
}

function ensureMissionSentence(value = '') {
    const clean = normalizeMissionText(value);
    if (!clean) return '';
    return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function startsWithImperativeMissionVerb(value = '') {
    const clean = normalizeMissionText(value);
    return /^(write|list|compare|record|draft|map|define|review|build|create|identify|explain|outline|summarize|analyze|study|read|track|collect|prepare|choose|set|rank|plan|schedule|break down|reduce|send|note)\b/i.test(clean);
}

function coerceMissionDescription(description = '', title = '') {
    const safeTitle = normalizeMissionText(title);

    let next = normalizeMissionText(description)
        .replace(/^(your task is to|the task is to|this mission is to|your goal is to|the goal is to|goal:|objective:)\s*/i, '')
        .replace(/^focus on identifying\b/i, 'Identify')
        .replace(/^focus on listing\b/i, 'List')
        .replace(/^focus on comparing\b/i, 'Compare')
        .replace(/^focus on recording\b/i, 'Record')
        .replace(/^focus on drafting\b/i, 'Draft')
        .replace(/^focus on mapping\b/i, 'Map')
        .replace(/^focus on defining\b/i, 'Define')
        .replace(/^focus on reviewing\b/i, 'Review')
        .replace(/^focus on building\b/i, 'Build')
        .replace(/^focus on creating\b/i, 'Create')
        .replace(/^focus on analyzing\b/i, 'Analyze')
        .replace(/^focus on\b\s*/i, '');

    if (!next && safeTitle) {
        next = safeTitle;
    }

    if (!startsWithImperativeMissionVerb(next) && startsWithImperativeMissionVerb(safeTitle)) {
        const titleSentence = safeTitle.replace(/[.!?]+$/g, '');
        const detailSentence = next.replace(/[.!?]+$/g, '');

        next = detailSentence && detailSentence.toLowerCase() !== titleSentence.toLowerCase()
            ? `${titleSentence}. ${detailSentence}`
            : titleSentence;
    }

    if (!startsWithImperativeMissionVerb(next) && safeTitle) {
        next = startsWithImperativeMissionVerb(safeTitle)
            ? safeTitle
            : `Complete this task: ${safeTitle}`;
    }

    return ensureMissionSentence(next);
}

function coerceMissionDoneLooksLike(doneLooksLike = '', title = '', description = '') {
    const cleanDone = normalizeMissionText(doneLooksLike);
    if (cleanDone) {
        return ensureMissionSentence(cleanDone);
    }

    const safeTitle = normalizeMissionText(title);
    const safeDescription = normalizeMissionText(description);

    if (safeTitle) {
        return ensureMissionSentence(`A concrete output for "${safeTitle}" is finished and ready to review`);
    }

    if (safeDescription) {
        return ensureMissionSentence('A concrete output is finished, written down, and ready to review');
    }

    return 'A concrete output is finished and ready to review.';
}

function normalizeGeneratedMission(mission = {}, context = {}) {
    const maxDailyMinutes = Math.max(
        15,
        toInt(context?.behaviorProfile?.maxSustainableDailyMinutes, 0) || 45
    );

    const normalizedTitle = sanitize(mission.title);
    const normalizedDescription = coerceMissionDescription(mission.description, normalizedTitle);

    return {
        pillar: sanitize(mission.pillar),
        title: normalizedTitle,
        description: normalizedDescription,
        doneLooksLike: coerceMissionDoneLooksLike(
            mission.doneLooksLike,
            normalizedTitle,
            normalizedDescription
        ),
        whyItMatters: sanitize(mission.whyItMatters),
        frequency: sanitize(mission.frequency || 'daily'),
        dueDate: sanitize(mission.dueDate),
        estimatedMinutes: Math.min(
            maxDailyMinutes,
            Math.max(10, toInt(mission.estimatedMinutes, 20))
        ),
        sortOrder: Math.max(1, toInt(mission.sortOrder, 1))
    };
}

async function refreshBehaviorState(uid) {
    const behaviorProfile = await academyFirestoreRepo.computeBehaviorProfile(uid);
    const savedProfileDoc = await academyFirestoreRepo.saveBehaviorProfile(uid, behaviorProfile);

    const plannerStats = await academyFirestoreRepo.computePlannerStats(uid);
    await academyFirestoreRepo.savePlannerStats(uid, plannerStats);

    return {
        behaviorProfile: savedProfileDoc?.behaviorProfile || behaviorProfile,
        previousBehaviorProfile:
            savedProfileDoc?.previousBehaviorProfile &&
            typeof savedProfileDoc.previousBehaviorProfile === 'object'
                ? savedProfileDoc.previousBehaviorProfile
                : {},
        plannerStats
    };
}
async function generateAndPersistPlanFirestore(uid, profile, options = {}) {
    const activeRoadmap = options.activeRoadmap || await academyFirestoreRepo.getActiveRoadmap(uid);
    const recentMissions = activeRoadmap
        ? await academyFirestoreRepo.listRecentMissions(uid, activeRoadmap.id, 8)
        : [];
    const recentCheckins = activeRoadmap
        ? await academyFirestoreRepo.listRecentCheckins(uid, activeRoadmap.id, 5)
        : [];

    const profileDoc = await academyFirestoreRepo.getCurrentProfile(uid);
    const behaviorProfile =
        profileDoc?.behaviorProfile && typeof profileDoc.behaviorProfile === 'object'
            ? profileDoc.behaviorProfile
            : {};
    const previousBehaviorProfile =
        profileDoc?.previousBehaviorProfile && typeof profileDoc.previousBehaviorProfile === 'object'
            ? profileDoc.previousBehaviorProfile
            : {};
    const plannerStats =
        profileDoc?.plannerStats && typeof profileDoc.plannerStats === 'object'
            ? profileDoc.plannerStats
            : {};

    const trigger = sanitize(options.mode || options.trigger || (!activeRoadmap ? 'initial' : 'refresh')) || 'manual';

    const adaptivePlanning = buildAdaptivePlanningContext(profile, {
        activeRoadmap,
        recentMissions,
        recentCheckins,
        behaviorProfile,
        previousBehaviorProfile,
        plannerStats
    });

    const planningMode = adaptivePlanning.mode;

    const nurtureKnowledge = await academyPlannerKnowledgeContext.buildPlanningContext({
        uid,
        profile,
        activeRoadmap,
        recentMissions,
        recentCheckins,
        behaviorProfile,
        previousBehaviorProfile,
        plannerStats,
        trigger
    });

    const context = {
        trigger,
        mode: planningMode,
        planningMode,
        adaptivePlanning,
        activeRoadmap,
        recentMissions,
        recentCheckins,
        behaviorProfile,
        previousBehaviorProfile,
        plannerStats,
        nurtureKnowledge
    };

    let plan = null;
    let createdByModel = 'academy-rule-engine-v1';
    let plannerProvider = 'rule';
    let plannerModel = 'academy-rule-engine-v1';

    try {
        const aiResult = await requestAiRoadmap(profile, context);
        if (aiResult?.plan) {
            plan = aiResult.plan;
            plannerProvider = sanitize(aiResult.provider || 'gemini') || 'gemini';
            plannerModel = sanitize(aiResult.model || '') || 'unknown';
            createdByModel = `${plannerProvider}-${plannerModel}`;
        }
    } catch (error) {
        console.error('Academy Planner Fallback:', error.message);
    }

    if (!plan) {
        plan = buildFallbackRoadmap(profile, context);
    }

    const normalizedPlan = normalizePlan(plan, profile, context);
    const fallbackPlan = buildFallbackRoadmap(profile, context);

    let adaptedMissions = Array.isArray(normalizedPlan.missions) ? [...normalizedPlan.missions] : [];

    adaptedMissions = adaptedMissions
        .slice(0, adaptivePlanning.missionCountCap)
        .map((mission, index) => {
            const cappedMinutes = Math.min(
                adaptivePlanning.dailyLoadCap,
                Math.max(10, toInt(mission.estimatedMinutes, 20))
            );

            return {
                ...mission,
                estimatedMinutes: cappedMinutes,
                sortOrder: index + 1,
                selectionReason: buildAdaptiveMissionSelectionReason(mission, adaptivePlanning)
            };
        });

    if (
        adaptivePlanning.requireRecoveryMission &&
        !adaptedMissions.some((mission) => /health|discipline/i.test(sanitize(mission.pillar)))
    ) {
        const recoveryMission = (fallbackPlan.missions || []).find((mission) => /health|discipline/i.test(sanitize(mission.pillar)));
        if (recoveryMission) {
            adaptedMissions[adaptedMissions.length - 1] = {
                ...recoveryMission,
                estimatedMinutes: Math.min(
                    adaptivePlanning.dailyLoadCap,
                    Math.max(10, toInt(recoveryMission.estimatedMinutes, 15))
                ),
                sortOrder: adaptedMissions.length,
                selectionReason: 'Forced in by adaptive planner to reduce recovery risk and execution friction.'
            };
        }
    }

    if (
        adaptivePlanning.requireWealthMission &&
        !adaptedMissions.some((mission) => /wealth|money|business/i.test(sanitize(mission.pillar)))
    ) {
        const wealthMission = (fallbackPlan.missions || []).find((mission) => /wealth|money|business/i.test(sanitize(mission.pillar)));
        if (wealthMission) {
            adaptedMissions[Math.max(0, adaptedMissions.length - 1)] = {
                ...wealthMission,
                estimatedMinutes: Math.min(
                    adaptivePlanning.dailyLoadCap,
                    Math.max(10, toInt(wealthMission.estimatedMinutes, 15))
                ),
                sortOrder: adaptedMissions.length || 1,
                selectionReason: 'Forced in by adaptive planner to keep wealth or income movement active.'
            };
        }
    }

    normalizedPlan.roadmap = {
        ...(normalizedPlan.roadmap || {}),
        coachTone: sanitize(adaptivePlanning.coachToneOverride || normalizedPlan?.roadmap?.coachTone || profile.coachTone || 'balanced') || 'balanced',
        weeklyTheme: sanitize(adaptivePlanning.weeklyThemeHint || normalizedPlan?.roadmap?.weeklyTheme),
        weeklyTargetOutcome: sanitize(adaptivePlanning.targetOutcomeHint || normalizedPlan?.roadmap?.weeklyTargetOutcome),
        coachBrief: sanitize(
            `${adaptivePlanning.reason ? `Adaptive focus: ${adaptivePlanning.reason} ` : ''}${normalizedPlan?.roadmap?.coachBrief || ''}`
        )
    };

    normalizedPlan.adaptivePlanning = {
        mode: planningMode,
        challengeLevel: adaptivePlanning.challengeLevel,
        missionCountCap: adaptivePlanning.missionCountCap,
        dailyLoadCap: adaptivePlanning.dailyLoadCap,
        reason: adaptivePlanning.reason,
        adjustments: adaptivePlanning.adjustments,
        trendSummary: adaptivePlanning.trendSummary,
        trigger
    };

    normalizedPlan.nurtureTelemetry =
        context.nurtureKnowledge?.telemetry && typeof context.nurtureKnowledge.telemetry === 'object'
            ? context.nurtureKnowledge.telemetry
            : {
                selectedPackKeys: [],
                injectedRuleCount: 0,
                injectedExampleCount: 0,
                injectedRedFlagCount: 0,
                injectedRules: [],
                injectedExamples: [],
                injectedRedFlags: [],
                overlayApplied: false,
                overlayRuleCount: 0,
                overlayRedFlagCount: 0,
                overlayThemes: []
            };

    normalizedPlan.missions = adaptedMissions.map((mission) => {
        const cleanedMission = normalizeGeneratedMission(mission, {
            ...context,
            behaviorProfile: {
                ...behaviorProfile,
                maxSustainableDailyMinutes: adaptivePlanning.dailyLoadCap
            }
        });

        const qualityScores = scoreMissionQuality(cleanedMission, {
            ...context,
            behaviorProfile: {
                ...behaviorProfile,
                maxSustainableDailyMinutes: adaptivePlanning.dailyLoadCap
            }
        });

        return {
            ...cleanedMission,
            qualityScores,
            selectionReason: sanitize(mission.selectionReason || adaptivePlanning.reason),
            primaryBottleneck: sanitize(profile.blockerText || profile.topPriorityPillar),
            energyAdjustmentApplied: toInt(profile.energyScore, 0) <= 4 || adaptivePlanning.mode === 'recovery',
            timeAdjustmentApplied: true,
            generatedByProvider: plannerProvider,
            generatedByModel: plannerModel,
            promptVersion: 'planner_v2',
            schemaVersion: 'academy_plan_v1',
            generationMode: planningMode,
            outcomeMetrics: {
                skipCount: 0,
                stuckCount: 0,
                rescheduleCount: 0,
                completionLagHours: 0,
                userDifficultyScore: 0,
                userUsefulnessScore: 0,
                lastSkipReasonCategory: ''
            }
        };
    });

    const plannerRun = await academyFirestoreRepo.createPlannerRun(uid, {
        provider: plannerProvider,
        model: plannerModel,
        promptVersion: 'planner_v2',
        schemaVersion: 'academy_plan_v1',
        mode: planningMode,
        inputSnapshot: {
            trigger,
            energyScore: toInt(profile.energyScore, 0),
            sleepHours: toFloat(profile.sleepHours, 0),
            topPriorityPillar: sanitize(profile.topPriorityPillar),
            recentCompletedCount: recentMissions.filter((item) => item.status === 'completed').length,
            recentSkippedCount: recentMissions.filter((item) => item.status === 'skipped').length,
            recentStuckCount: recentMissions.filter((item) => item.status === 'stuck').length,
            averageDifficultyScore: toFloat(plannerStats.averageDifficultyScore, 0),
            averageUsefulnessScore: toFloat(plannerStats.averageUsefulnessScore, 0)
        },
        behaviorProfileSnapshot: behaviorProfile,
        decisionTrace: {
            primaryBottleneck: sanitize(profile.blockerText || profile.topPriorityPillar),
            planningMode,
            challengeLevel: adaptivePlanning.challengeLevel,
            missionCountCap: adaptivePlanning.missionCountCap,
            dailyLoadCap: adaptivePlanning.dailyLoadCap,
            usedRecoveryMode: planningMode === 'recovery',
            reducedMissionIntensity: adaptivePlanning.challengeLevel === 'reduced',
            trendSummary: adaptivePlanning.trendSummary,
            reason: adaptivePlanning.reason
        },
        nurtureTelemetry: normalizedPlan.nurtureTelemetry,
        outputSummary: {
            roadmapId: '',
            missionCount: Array.isArray(normalizedPlan.missions) ? normalizedPlan.missions.length : 0,
            weeklyTheme: sanitize(normalizedPlan?.roadmap?.weeklyTheme),
            targetOutcome: sanitize(normalizedPlan?.roadmap?.weeklyTargetOutcome),
            planningMode,
            challengeLevel: adaptivePlanning.challengeLevel,
            totalEstimatedMinutes: (Array.isArray(normalizedPlan.missions) ? normalizedPlan.missions : [])
                .reduce((sum, item) => sum + toInt(item.estimatedMinutes, 0), 0)
        }
    });

        const persistResult = await academyFirestoreRepo.persistRoadmapBundle(
            uid,
            profile,
            {
                ...normalizedPlan,
                plannerRunId: plannerRun.id,
                promptVersion: 'planner_v2',
                schemaVersion: 'academy_plan_v1',
                generationMode: planningMode,
                generatedByProvider: plannerProvider,
                generatedByModel: plannerModel,
                adaptivePlanning: normalizedPlan.adaptivePlanning,
                nurtureTelemetry: normalizedPlan.nurtureTelemetry
            },
            createdByModel
        );

    const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, persistResult.roadmapId);

    await academyFirestoreRepo.updatePlannerRunResult(uid, plannerRun.id, {
        completionRateAfter72h: 0,
        averageDifficultyScore: 0,
        averageUsefulnessScore: 0
    });

    return {
        roadmapId: persistResult.roadmapId,
        version: persistResult.version,
        createdByModel,
        plannerRunId: plannerRun.id,
        plan: normalizedPlan,
        homePayload
    };
}
exports.getAcademyHome = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid);

        if (!homePayload) {
            return res.status(404).json({
                success: false,
                message: 'No active Academy roadmap yet.'
            });
        }

        return res.json(homePayload);
    } catch (error) {
        console.error('Academy Home Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading Academy home.'
        });
    }
};

exports.getActiveRoadmap = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const roadmap = await academyFirestoreRepo.getActiveRoadmap(uid);

        if (!roadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found.'
            });
        }

        return res.json({
            success: true,
            roadmapId: roadmap.id,
            plannerRunId: roadmap.plannerRunId || '',
            version: roadmap.version,
            readinessScore: roadmap.readinessScore,
            focusAreas: Array.isArray(roadmap.focusAreas) ? roadmap.focusAreas : [],
            summary: roadmap.summary || {},
            roadmap: roadmap.roadmap || {},
            adaptivePlanning: roadmap.adaptivePlanning || {},
            nurtureTelemetry: roadmap.nurtureTelemetry || {},
            createdByModel: roadmap.createdByModel || 'academy-rule-engine-v1',
            createdAt: roadmap.createdAt || null
        });
    } catch (error) {
        console.error('Active Roadmap Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading active roadmap.'
        });
    }
};

exports.getMissions = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);
        const scope = sanitize(req.query.scope || 'today').toLowerCase();
        const status = sanitize(req.query.status || '').toLowerCase();

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const activeRoadmap = await academyFirestoreRepo.getActiveRoadmap(uid);

        if (!activeRoadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found for missions.'
            });
        }

        let missions = await academyFirestoreRepo.listAllMissionsByRoadmap(uid, activeRoadmap.id);

        if (status) {
            missions = missions.filter((mission) => sanitize(mission.status).toLowerCase() === status);
        }

        if (scope === 'today') {
            const today = todayISO();
            missions = missions.filter((mission) => {
                const dueDate = sanitize(mission.dueDate);
                return !dueDate || dueDate <= today;
            });
        }

        missions = missions
            .slice()
            .sort((a, b) => {
                const sortA = toInt(a.sortOrder, 0);
                const sortB = toInt(b.sortOrder, 0);
                if (sortA !== sortB) return sortA - sortB;
                return String(a.id || '').localeCompare(String(b.id || ''));
            })
            .map((mission) => ({
                id: mission.id,
                pillar: mission.pillar || '',
                title: mission.title || '',
                description: mission.description || '',
                doneLooksLike: mission.doneLooksLike || '',
                whyItMatters: mission.whyItMatters || '',
                frequency: mission.frequency || '',
                dueDate: mission.dueDate || '',
                estimatedMinutes: toInt(mission.estimatedMinutes, 0),
                status: mission.status || 'pending',
                completionNote: mission.completionNote || ''
            }));

        return res.json({ success: true, missions });
    } catch (error) {
        console.error('Get Missions Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading missions.'
        });
    }
};

exports.completeMission = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);
        const missionId = sanitize(req.params.id || '');
        const completionNote = sanitize(req.body.completionNote || '');

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        if (!missionId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mission id.'
            });
        }

        const mission = await academyFirestoreRepo.getMissionById(uid, missionId);

        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission not found.'
            });
        }

        const completedMission = await academyFirestoreRepo.updateMissionCompletion(uid, missionId, completionNote);

        const missionCompletedAt = completedMission?.completedAt;
        const missionCreatedAt = completedMission?.createdAt;

        let completionLagHours = 0;
        if (missionCompletedAt && missionCreatedAt) {
            const completedMs = typeof missionCompletedAt.toDate === 'function'
                ? missionCompletedAt.toDate().getTime()
                : new Date(missionCompletedAt).getTime();

            const createdMs = typeof missionCreatedAt.toDate === 'function'
                ? missionCreatedAt.toDate().getTime()
                : new Date(missionCreatedAt).getTime();

            if (Number.isFinite(completedMs) && Number.isFinite(createdMs) && completedMs >= createdMs) {
                completionLagHours = Number(((completedMs - createdMs) / (1000 * 60 * 60)).toFixed(2));
            }
        }

        await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
            completionLagHours
        });

        try {
            await publicLandingEventsRepo.createEventForUser(uid, {
                type: 'academy_mission_completed',
                slot: 'academy',
                category: 'academy',
                message: 'Mission completed from {location}.',
                feedText: `{name} completed "${sanitize(completedMission?.title || mission?.title || 'an Academy mission')}".`,
                labelPrefix: 'Mission Complete',
                color: '#22c55e',
                altitude: 0.2,
                ttlSeconds: 1500,
                coreColor: 'rgba(220, 252, 231, 0.98)',
                coreAltitude: 0.012,
                coreRadius: 0.17,
                ringAltitude: 0.0031,
                ringColor: [
                    'rgba(220, 252, 231, 0.98)',
                    'rgba(34, 197, 94, 0.46)',
                    'rgba(34, 197, 94, 0)'
                ],
                ringMaxRadius: 5.1,
                ringPropagationSpeed: 1.9,
                ringRepeatPeriod: 700
            });
        } catch (glowError) {
            console.warn('completeMission public landing event skipped:', glowError?.message || glowError);
        }

const behaviorState = await refreshBehaviorState(uid);
const progress = await academyFirestoreRepo.getMissionProgress(uid, mission.roadmapId);
const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, mission.roadmapId);

return res.json({
    success: true,
    missionId,
    status: String(completedMission?.status || 'completed').trim().toLowerCase(),
    note: String(completedMission?.completionNote || completionNote || ''),
    todayProgress: {
        completed: progress.completed || 0,
        total: progress.total || 0,
        percent: progress.percent || 0
    },
    behaviorProfile: behaviorState.behaviorProfile,
    previousBehaviorProfile: behaviorState.previousBehaviorProfile,
    plannerStats: behaviorState.plannerStats,
    adaptivePlanning: homePayload?.adaptivePlanning || {}
});
    } catch (error) {
        console.error('Complete Mission Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while completing mission.'
        });
    }
};
exports.updateMissionStatus = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const missionId = sanitize(req.params?.id || '');
        const requestedStatus = sanitize(req.body?.status || '').toLowerCase();
        const completionNote = sanitize(req.body?.note || req.body?.completionNote || '');

        if (!missionId) {
            return res.status(400).json({
                success: false,
                message: 'Mission id is required.'
            });
        }

        if (!['pending', 'completed', 'skipped', 'stuck'].includes(requestedStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mission status.'
            });
        }

        const mission = await academyFirestoreRepo.getMissionById(uid, missionId);

        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission not found.'
            });
        }

        if (requestedStatus === 'completed') {
            const completedMission = await academyFirestoreRepo.completeMission(uid, missionId, completionNote);

            let completionLagHours = 0;
            const missionCompletedAt = completedMission?.completedAt || completedMission?.completed_at || new Date().toISOString();
            const missionCreatedAt = mission?.createdAt || mission?.created_at || mission?.assignedAt || mission?.assigned_at;

            if (missionCreatedAt && missionCompletedAt) {
                const completedMs = typeof missionCompletedAt?.toDate === 'function'
                    ? missionCompletedAt.toDate().getTime()
                    : new Date(missionCompletedAt).getTime();

                const createdMs = typeof missionCreatedAt?.toDate === 'function'
                    ? missionCreatedAt.toDate().getTime()
                    : new Date(missionCreatedAt).getTime();

                if (Number.isFinite(completedMs) && Number.isFinite(createdMs) && completedMs >= createdMs) {
                    completionLagHours = Number(((completedMs - createdMs) / (1000 * 60 * 60)).toFixed(2));
                }
            }

            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                completionLagHours
            });
            // handled by the unified status-based public landing event block below

        try {
            if (status === 'completed') {
                await publicLandingEventsRepo.createEventForUser(uid, {
                    type: 'academy_mission_completed',
                    slot: 'academy',
                    category: 'academy',
                    message: 'Mission completed from {location}.',
                    feedText: `{name} completed "${sanitize(updatedMission?.title || mission?.title || 'an Academy mission')}".`,
                    labelPrefix: 'Mission Complete',
                    color: '#22c55e',
                    altitude: 0.2,
                    ttlSeconds: 1500,
                    coreColor: 'rgba(220, 252, 231, 0.98)',
                    coreAltitude: 0.012,
                    coreRadius: 0.17,
                    ringAltitude: 0.0031,
                    ringColor: [
                        'rgba(220, 252, 231, 0.98)',
                        'rgba(34, 197, 94, 0.46)',
                        'rgba(34, 197, 94, 0)'
                    ],
                    ringMaxRadius: 5.1,
                    ringPropagationSpeed: 1.9,
                    ringRepeatPeriod: 700
                });
            } else if (status === 'skipped') {
                await publicLandingEventsRepo.createEventForUser(uid, {
                    type: 'academy_mission_skipped',
                    slot: 'academy',
                    category: 'academy',
                    message: 'Mission skipped from {location}.',
                    feedText: `{name} skipped "${sanitize(updatedMission?.title || mission?.title || 'an Academy mission')}".`,
                    labelPrefix: 'Mission Skipped',
                    color: '#f59e0b',
                    altitude: 0.18,
                    ttlSeconds: 1350,
                    coreColor: 'rgba(254, 243, 199, 0.98)',
                    coreAltitude: 0.0115,
                    coreRadius: 0.165,
                    ringAltitude: 0.003,
                    ringColor: [
                        'rgba(254, 243, 199, 0.98)',
                        'rgba(245, 158, 11, 0.46)',
                        'rgba(245, 158, 11, 0)'
                    ],
                    ringMaxRadius: 4.8,
                    ringPropagationSpeed: 1.76,
                    ringRepeatPeriod: 760
                });
            } else if (status === 'stuck') {
                await publicLandingEventsRepo.createEventForUser(uid, {
                    type: 'academy_mission_stuck',
                    slot: 'academy',
                    category: 'academy',
                    message: 'Mission blocked from {location}.',
                    feedText: `{name} marked "${sanitize(updatedMission?.title || mission?.title || 'an Academy mission')}" as stuck.`,
                    labelPrefix: 'Mission Stuck',
                    color: '#fb7185',
                    altitude: 0.18,
                    ttlSeconds: 1350,
                    coreColor: 'rgba(255, 228, 230, 0.98)',
                    coreAltitude: 0.0115,
                    coreRadius: 0.165,
                    ringAltitude: 0.003,
                    ringColor: [
                        'rgba(255, 228, 230, 0.98)',
                        'rgba(251, 113, 133, 0.46)',
                        'rgba(251, 113, 133, 0)'
                    ],
                    ringMaxRadius: 4.9,
                    ringPropagationSpeed: 1.72,
                    ringRepeatPeriod: 780
                });
            }
        } catch (glowError) {
            console.warn('updateMissionStatus public landing event skipped:', glowError?.message || glowError);
        }

        const behaviorState = await refreshBehaviorState(uid);
        const progress = await academyFirestoreRepo.getMissionProgress(uid, mission.roadmapId);

const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, mission.roadmapId);

return res.json({
    success: true,
    missionId,
    status,
    note,
    todayProgress: {
        completed: progress.completed || 0,
        total: progress.total || 0,
        percent: progress.percent || 0
    },
    behaviorProfile: behaviorState.behaviorProfile,
    previousBehaviorProfile: behaviorState.previousBehaviorProfile,
    plannerStats: behaviorState.plannerStats,
    adaptivePlanning: homePayload?.adaptivePlanning || {}
});
        }

        const statusPayload = {
            status: requestedStatus,
            updatedAt: new Date().toISOString()
        };

        if (requestedStatus === 'pending') {
            statusPayload.completedAt = null;
            statusPayload.completionNote = '';
        }

        if (requestedStatus === 'skipped') {
            const existingSkipCount = toInt(mission?.outcomeMetrics?.skipCount, 0);
            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                skipCount: existingSkipCount + 1
            });
        }

        if (requestedStatus === 'stuck') {
            const existingStuckCount = toInt(mission?.outcomeMetrics?.stuckCount, 0);
            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                stuckCount: existingStuckCount + 1
            });
        }

        await academyFirestoreRepo.updateMission(uid, missionId, statusPayload);

        const behaviorState = await refreshBehaviorState(uid);
        const progress = await academyFirestoreRepo.getMissionProgress(uid, mission.roadmapId);
        const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, mission.roadmapId);

        return res.json({
            success: true,
            missionId,
            status: requestedStatus,
            note: '',
            todayProgress: {
                completed: progress.completed || 0,
                total: progress.total || 0,
                percent: progress.percent || 0
            },
            behaviorProfile: behaviorState.behaviorProfile,
            previousBehaviorProfile: behaviorState.previousBehaviorProfile,
            plannerStats: behaviorState.plannerStats,
            adaptivePlanning: homePayload?.adaptivePlanning || {}
        });
    } catch (error) {
        console.error('Update Mission Status Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while updating mission status.'
        });
    }
};
exports.submitCheckin = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const activeRoadmap = await academyFirestoreRepo.getActiveRoadmap(uid);

        if (!activeRoadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found for check-in.'
            });
        }

        const energyScore = clamp(toInt(req.body.energyScore, 0), 0, 10);
        const moodScore = clamp(toInt(req.body.moodScore, 0), 0, 10);
        const completedSummary = sanitize(req.body.completedSummary || '');
        const blockerText = sanitize(req.body.blockerText || '');
        const tomorrowFocus = sanitize(req.body.tomorrowFocus || '');
        const rawMissionSignals = req.body?.missionSignals && typeof req.body.missionSignals === 'object'
            ? req.body.missionSignals
            : {};
        const missionSignals = {
            total: Math.max(0, toInt(rawMissionSignals.total, 0)),
            completed: Math.max(0, toInt(rawMissionSignals.completed, 0)),
            pending: Math.max(0, toInt(rawMissionSignals.pending, 0)),
            skipped: Math.max(0, toInt(rawMissionSignals.skipped, 0)),
            stuck: Math.max(0, toInt(rawMissionSignals.stuck, 0))
        };

        await academyFirestoreRepo.createCheckin(uid, activeRoadmap.id, {
            energyScore,
            moodScore,
            completedSummary,
            blockerText,
            tomorrowFocus,
            aiFeedback: {
                type: 'daily_checkin',
                missionSignals
            }
        });

        const completedMissionIds = Array.isArray(req.body?.completedMissionIds)
            ? req.body.completedMissionIds
            : [];

        const skippedMissionIds = Array.isArray(req.body?.skippedMissionIds)
            ? req.body.skippedMissionIds
            : [];

        const stuckMissionIds = Array.isArray(req.body?.stuckMissionIds)
            ? req.body.stuckMissionIds
            : [];

        for (const missionId of completedMissionIds) {
            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                userDifficultyScore: clamp(toInt(req.body?.difficultyToday, 0), 0, 10),
                userUsefulnessScore: clamp(toInt(req.body?.usefulnessToday, 0), 0, 10)
            });
        }

        for (const missionId of skippedMissionIds) {
            const mission = await academyFirestoreRepo.getMissionById(uid, missionId);
            const existingSkipCount = toInt(mission?.outcomeMetrics?.skipCount, 0);

            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                skipCount: existingSkipCount + 1,
                lastSkipReasonCategory: sanitize(req.body?.skipReasonCategory || 'time_overload')
            });
        }

        for (const missionId of stuckMissionIds) {
            const mission = await academyFirestoreRepo.getMissionById(uid, missionId);
            const existingStuckCount = toInt(mission?.outcomeMetrics?.stuckCount, 0);

            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                stuckCount: existingStuckCount + 1
            });
        }

        const behaviorState = await refreshBehaviorState(uid);
        const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, activeRoadmap.id);

        return res.json({
            success: true,
            message: 'Check-in saved.',
            behaviorProfile: behaviorState.behaviorProfile,
            previousBehaviorProfile: behaviorState.previousBehaviorProfile,
            plannerStats: behaviorState.plannerStats,
            adaptivePlanning: homePayload?.adaptivePlanning || {}
        });
    } catch (error) {
        console.error('Submit Check-in Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving check-in.'
        });
    }
};
exports.submitMembershipApplication = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};

        const existingApplication =
            userData.academyApplication && typeof userData.academyApplication === 'object'
                ? userData.academyApplication
                : null;

        const existingStatus = sanitize(existingApplication?.status).toLowerCase();

        if (existingApplication) {
            return res.json({
                success: true,
                alreadyExists: true,
                application: existingApplication,
                applicationStatus: existingStatus || 'under review'
            });
        }

        const baseDisplayName = sanitize(
            req.user?.name ||
            req.user?.fullName ||
            userData.fullName ||
            userData.name ||
            req.user?.username ||
            userData.username ||
            'Hustler'
        );

        const baseNameParts = baseDisplayName.split(/\s+/).filter(Boolean);

        const firstName = sanitize(
            req.body?.firstName ||
            userData.firstName ||
            baseNameParts[0] ||
            ''
        );

        const surname = sanitize(
            req.body?.surname ||
            userData.surname ||
            (baseNameParts.length > 1 ? baseNameParts.slice(1).join(' ') : '')
        );

        const displayName = sanitize(
            [firstName, surname].filter(Boolean).join(' ') ||
            baseDisplayName ||
            'Hustler'
        );

        const username = sanitize(
            req.body?.username ||
            req.user?.username ||
            userData.username ||
            ''
        ).replace(/^@+/, '');

        const email = sanitize(
            req.body?.email ||
            req.user?.email ||
            userData.email ||
            ''
        ).toLowerCase();

        const submittedLocationCountry = sanitize(
            req.body?.locationCountry ||
            req.body?.countryOfResidence ||
            ''
        );

        const locationParts = submittedLocationCountry
            .split(',')
            .map((part) => sanitize(part))
            .filter(Boolean);

        const city = sanitize(
            req.body?.city ||
            userData.city ||
            (locationParts.length > 1 ? locationParts.slice(0, -1).join(', ') : '')
        );

        const country = sanitize(
            req.body?.country ||
            userData.country ||
            (locationParts.length ? locationParts[locationParts.length - 1] : '')
        );

        const countryCode = sanitize(userData.countryCode || '');

        const locationCountry = sanitize(
            submittedLocationCountry ||
            [city, country].filter(Boolean).join(', ') ||
            country
        );

        const ageNumber = toInt(req.body?.age, 0);
        const age = ageNumber > 0 ? String(ageNumber) : '';

        const occupationAtAge = sanitize(
            req.body?.occupationAtAge ||
            req.body?.mainGoal ||
            ''
        );

        const skillsText = sanitize(
            req.body?.skills ||
            req.body?.proofWork ||
            ''
        );

        const referredByUsername = sanitize(
            req.body?.referredByUsername || ''
        ).replace(/^@+/, '');

        const hearAboutUs = sanitize(
            req.body?.hearAboutUs ||
            req.body?.whyNow ||
            ''
        );

        const seriousness = sanitize(req.body?.seriousness || '');
        const nonNegotiable = sanitize(req.body?.nonNegotiable || '');

        if (!email || !age || ageNumber < 13 || ageNumber > 120) {
            return res.status(400).json({
                success: false,
                message: 'A valid age and email address are required.'
            });
        }

        if (!occupationAtAge || !skillsText || !seriousness || !nonNegotiable) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all required Academy application fields.'
            });
        }

        if (!referredByUsername && !hearAboutUs) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a referrer username or tell us how you heard about The Academy.'
            });
        }

        const topSkills = dedupeStrings(
            skillsText.split(/[,;\n/|]+/g),
            6
        );

        const referrerSummary = referredByUsername
            ? `Referred by @${referredByUsername}`
            : '';

        const background = [
            skillsText,
            hearAboutUs || referrerSummary,
            nonNegotiable
        ].filter(Boolean).join(' • ');

        const nowIso = new Date().toISOString();

        const academyProfile = {
            firstName,
            surname,
            fullName: displayName,
            email,
            age,
            occupationAtAge,
            skills: skillsText,
            topSkills,
            referredByUsername,
            hearAboutUs,
            locationCountry,
            seriousness,
            nonNegotiable,

            // Compatibility bridge for older readers
            whyNow: hearAboutUs || referrerSummary,
            mainGoal: occupationAtAge,
            proofWork: skillsText,
            sacrifice: '',
            weeklyHours: '',
            adminNote: ''
        };

        const application = {
            id: sanitize(`APP-${Date.now().toString().slice(-8)}`),
            applicationType: 'academy-membership',
            reviewLane: 'Academy Membership',
            status: 'Under Review',
            recommendedDivision: 'Academy',
            source: 'Academy Dashboard',
            name: displayName,
            fullName: displayName,
            firstName,
            surname,
            username,
            email,
            age,
            occupationAtAge,
            referredByUsername,
            hearAboutUs,
            city,
            country,
            countryCode,
            locationCountry,
            goal: occupationAtAge || 'Academy membership application',
            background: background || 'No background summary submitted.',
            aiScore: 0,
            skills: topSkills,
            networkValue: sanitize(existingApplication?.networkValue || 'Unknown'),
            seriousness,
            nonNegotiable,
            submittedAt: nowIso,
            updatedAt: nowIso,
            notes: [
                'Submitted from dashboard Academy membership flow.'
            ],
            academyProfile
        };

        await userRef.set(
            {
                ...(displayName ? { fullName: displayName } : {}),
                ...(firstName ? { firstName } : {}),
                ...(surname ? { surname } : {}),
                ...(email ? { email } : {}),
                ...(username ? { username } : {}),
                ...(city ? { city } : {}),
                ...(country ? { country } : {}),
                ...(countryCode ? { countryCode } : {}),
                ...(locationCountry ? { locationCountry } : {}),
                academyApplication: application,
                academyApplicationStatus: application.status,
                academyApplicationSubmittedAt: application.submittedAt,
                updatedAt: nowIso
            },
            { merge: true }
        );

        try {
            await publicLandingEventsRepo.createEventForUser(uid, {
                type: 'academy_membership_application',
                slot: 'academy',
                category: 'academy',
                message: 'Academy application submitted from {location}.',
                feedText: '{name} sent an application for the Academy.',
                labelPrefix: 'Academy Application',
                color: '#7dd3fc',
                altitude: 0.2,
                ttlSeconds: 1800,
                coreColor: 'rgba(191, 219, 254, 0.98)',
                coreAltitude: 0.013,
                coreRadius: 0.19,
                ringAltitude: 0.0034,
                ringColor: [
                    'rgba(191, 219, 254, 0.98)',
                    'rgba(125, 211, 252, 0.48)',
                    'rgba(125, 211, 252, 0)'
                ],
                ringMaxRadius: 5.8,
                ringPropagationSpeed: 1.84,
                ringRepeatPeriod: 760
            });
        } catch (glowError) {
            console.warn('submitMembershipApplication public landing event skipped:', glowError?.message || glowError);
        }

        return res.status(201).json({
            success: true,
            alreadyExists: false,
            application
        });
    } catch (error) {
        console.error('submitMembershipApplication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Academy membership application.'
        });
    }
};
function normalizeUniverseDivisionStatus(value = '', fallback = 'not_applied') {
    const raw = sanitize(value).toLowerCase();

    if (!raw || raw === 'none' || raw === 'not applied' || raw === 'not_applied') return fallback;
    if (raw === 'approved' || raw === 'active' || raw === 'member') return 'approved';
    if (raw === 'under review' || raw === 'pending' || raw === 'pending review' || raw === 'review') return 'under_review';
    if (raw === 'screening' || raw === 'in screening') return 'screening';
    if (raw === 'shortlisted' || raw === 'shortlist') return 'shortlisted';
    if (raw === 'waitlisted' || raw === 'waitlist') return 'waitlisted';
    if (raw === 'rejected' || raw === 'denied' || raw === 'not approved') return 'rejected';

    return raw.replace(/\s+/g, '_');
}

function getUniverseStatusLabel(status = '') {
    const normalized = normalizeUniverseDivisionStatus(status);

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'under_review') return 'Under Review';
    if (normalized === 'screening') return 'Screening';
    if (normalized === 'shortlisted') return 'Shortlisted';
    if (normalized === 'waitlisted') return 'Waitlisted';
    if (normalized === 'rejected') return 'Rejected';

    return 'Not Applied';
}

function getUniverseDivisionMembershipLabel(divisionName = '', state = {}) {
    const cleanDivisionName = sanitize(divisionName || 'Division');
    const statusLabel = getUniverseStatusLabel(state.status);

    if (state.isMember === true) {
        return `${cleanDivisionName} member`;
    }

    if (state.hasApplication === true) {
        if (state.status === 'rejected') {
            return `Not a ${cleanDivisionName} member — application rejected`;
        }

        return `Not a ${cleanDivisionName} member — application ${statusLabel.toLowerCase()}`;
    }

    return `Not a ${cleanDivisionName} member`;
}

function normalizeUniverseSignalList(value = [], limit = 8) {
    const source = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    const seen = new Set();
    const out = [];

    for (const item of source) {
        const clean = sanitize(item);
        if (!clean) continue;

        const key = clean.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        out.push(clean);

        if (out.length >= limit) break;
    }

    return out;
}

function normalizeUniverseAvatar(value = '') {
    return sanitizeAcademyProfileAsset(value);
}

function buildUniversePlazaDirectoryProfile(rawProfile = null) {
    if (!rawProfile || typeof rawProfile !== 'object') return null;

    return {
        role: sanitize(rawProfile.role || rawProfile.title || ''),
        region: sanitize(rawProfile.region || rawProfile.country || ''),
        division: sanitize(rawProfile.division || ''),
        trust: sanitize(rawProfile.trust || rawProfile.trustLevel || ''),
        focus: sanitize(rawProfile.focus || rawProfile.profileFocus || ''),
        tags: normalizeUniverseSignalList(rawProfile.tags || rawProfile.searchTags),
        lookingFor: normalizeUniverseSignalList(rawProfile.lookingFor || rawProfile.looking_for),
        canOffer: normalizeUniverseSignalList(rawProfile.canOffer || rawProfile.can_offer),
        availability: sanitize(rawProfile.availability || ''),
        workMode: sanitize(rawProfile.workMode || rawProfile.work_mode || ''),
        marketplaceMode: sanitize(rawProfile.marketplaceMode || rawProfile.marketplace_mode || ''),
        updatedAt: rawProfile.updatedAt || ''
    };
}

function buildUniverseFederationMemberProfile(uid = '', userData = {}) {
    return {
        id: sanitize(uid),
        name: sanitize(
            userData.fullName ||
            userData.name ||
            userData.displayName ||
            userData.username ||
            'Federation Member'
        ),
        username: sanitize(userData.username || ''),
        email: sanitize(userData.email || '').toLowerCase(),
        role: sanitize(
            userData.federationRole ||
            userData.role ||
            userData.occupation ||
            ''
        ),
        category: sanitize(
            userData.federationCategory ||
            userData.category ||
            userData.industry ||
            'Strategic Network'
        ),
        country: sanitize(userData.country || ''),
        city: sanitize(userData.city || ''),
        company: sanitize(userData.company || userData.companyName || ''),
        referralCode: sanitize(userData.federationReferralCode || ''),
        approvedAt: userData.federationApprovedAt || ''
    };
}

function buildUniverseMembershipSummary(divisions = {}) {
    const divisionLabels = {
        academy: 'The Academy',
        plaza: 'The Plaza',
        federation: 'The Federation'
    };

    const memberDivisions = Object.entries(divisions)
        .filter(([, state]) => state?.isMember === true)
        .map(([key]) => ({
            key,
            label: divisionLabels[key] || key
        }));

    const nonMemberDivisions = Object.entries(divisions)
        .filter(([, state]) => state?.isMember !== true)
        .map(([key]) => ({
            key,
            label: divisionLabels[key] || key,
            status: state?.status || 'not_applied',
            statusLabel: state?.statusLabel || 'Not Applied',
            hasApplication: state?.hasApplication === true
        }));

    const memberLabels = memberDivisions.map((item) => item.label);
    let primaryMembershipLabel = 'Not a member of any YH Universe division yet.';

    if (memberLabels.length === 1) {
        primaryMembershipLabel = `Member of ${memberLabels[0]} only.`;
    } else if (memberLabels.length === 2) {
        primaryMembershipLabel = `Member of ${memberLabels[0]} and ${memberLabels[1]}.`;
    } else if (memberLabels.length >= 3) {
        primaryMembershipLabel = 'Member of all YH Universe divisions.';
    }

    return {
        isMemberAnywhere: memberDivisions.length > 0,
        primaryMembershipLabel,
        memberDivisions,
        nonMemberDivisions
    };
}

function getUniverseTrustTier(divisions = {}) {
    if (divisions.federation?.isMember === true) return 'Strategic';
    if (divisions.plaza?.isMember === true) return 'Active Connector';
    if (divisions.academy?.isMember === true) return 'Builder';
    return 'Guest';
}

async function getUniverseSafeDoc(collectionName = '', docId = '') {
    const cleanCollectionName = sanitize(collectionName);
    const cleanDocId = sanitize(docId);

    if (!cleanCollectionName || !cleanDocId) return null;

    try {
        const snap = await firestore.collection(cleanCollectionName).doc(cleanDocId).get();
        return snap.exists ? (snap.data() || {}) : null;
    } catch (_) {
        return null;
    }
}

exports.getUniverseProfile = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnapshot.data() || {};
        const storedAcademyProfile = await academyFirestoreRepo.getCurrentProfile(uid).catch(() => null) || {};
        const academyProfile = buildAcademyProfileResponse(uid, userData, storedAcademyProfile);

        try {
            const socialProfile = await academyCommunityRepo.getMemberProfile({
                viewerId: uid,
                targetUserId: uid
            });

            academyProfile.followers_count = socialProfile?.followers_count ?? academyProfile.followers_count ?? '—';
            academyProfile.following_count = socialProfile?.following_count ?? academyProfile.following_count ?? '—';
            academyProfile.friends_count = socialProfile?.friends_count ?? socialProfile?.friend_count ?? academyProfile.friends_count ?? '—';
            academyProfile.friend_count = academyProfile.friends_count;

            if (Number.isFinite(Number(socialProfile?.post_count))) {
                academyProfile.post_count = Number(socialProfile.post_count);
            }

            if (Array.isArray(socialProfile?.recent_posts)) {
                academyProfile.recent_posts = socialProfile.recent_posts;
            }
        } catch (_) {}

        let academyAccessState = null;
        try {
            academyAccessState = await academyFirestoreRepo.getAccessState(uid);
        } catch (_) {
            academyAccessState = null;
        }

        const academyApplication =
            userData.academyApplication && typeof userData.academyApplication === 'object'
                ? userData.academyApplication
                : null;

        const plazaApplication =
            userData.plazaApplication && typeof userData.plazaApplication === 'object'
                ? userData.plazaApplication
                : null;

        const federationApplication =
            userData.federationApplication && typeof userData.federationApplication === 'object'
                ? userData.federationApplication
                : null;

        const academyStatus = normalizeUniverseDivisionStatus(
            userData.academyMembershipStatus ||
            userData.academyApplicationStatus ||
            academyApplication?.status ||
            ''
        );

        const plazaStatus = normalizeUniverseDivisionStatus(
            userData.plazaAccessStatus ||
            userData.plazaMembershipStatus ||
            userData.plazaApplicationStatus ||
            plazaApplication?.status ||
            ''
        );

        const federationStatus = normalizeUniverseDivisionStatus(
            userData.federationMembershipStatus ||
            userData.federationApplicationStatus ||
            federationApplication?.status ||
            ''
        );

        const isAcademyMember =
            userData.hasAcademyAccess === true ||
            userData.canEnterAcademy === true ||
            academyStatus === 'approved' ||
            academyAccessState?.accessState === 'unlocked';

        const isPlazaMember =
            userData.hasPlazaAccess === true ||
            plazaStatus === 'approved';

        const isFederationMember =
            userData.hasFederationAccess === true ||
            federationStatus === 'approved';

        const plazaDirectoryProfile = await getUniverseSafeDoc('plazaDirectoryProfiles', uid);

        const divisions = {
            academy: {
                key: 'academy',
                label: 'The Academy',
                isMember: isAcademyMember,
                hasApplication: Boolean(academyApplication || academyStatus !== 'not_applied'),
                status: isAcademyMember ? 'approved' : academyStatus,
                statusLabel: getUniverseStatusLabel(isAcademyMember ? 'approved' : academyStatus),
                membershipLabel: '',
                canEnter: isAcademyMember,
                application: academyApplication,
                profile: academyProfile,
                accessState: academyAccessState || null
            },
            plaza: {
                key: 'plaza',
                label: 'The Plaza',
                isMember: isPlazaMember,
                hasApplication: Boolean(plazaApplication || plazaStatus !== 'not_applied'),
                status: isPlazaMember ? 'approved' : plazaStatus,
                statusLabel: getUniverseStatusLabel(isPlazaMember ? 'approved' : plazaStatus),
                membershipLabel: '',
                canEnter: isPlazaMember,
                application: plazaApplication,
                profile: buildUniversePlazaDirectoryProfile(plazaDirectoryProfile)
            },
            federation: {
                key: 'federation',
                label: 'The Federation',
                isMember: isFederationMember,
                hasApplication: Boolean(federationApplication || federationStatus !== 'not_applied'),
                status: isFederationMember ? 'approved' : federationStatus,
                statusLabel: getUniverseStatusLabel(isFederationMember ? 'approved' : federationStatus),
                membershipLabel: '',
                canEnter: isFederationMember,
                application: federationApplication,
                profile: isFederationMember ? buildUniverseFederationMemberProfile(uid, userData) : null
            }
        };

        divisions.academy.membershipLabel = getUniverseDivisionMembershipLabel('The Academy', divisions.academy);
        divisions.plaza.membershipLabel = getUniverseDivisionMembershipLabel('The Plaza', divisions.plaza);
        divisions.federation.membershipLabel = getUniverseDivisionMembershipLabel('The Federation', divisions.federation);

        const membershipSummary = buildUniverseMembershipSummary(divisions);
        const trustTier = getUniverseTrustTier(divisions);

        const fullName =
            sanitize(
                academyProfile.fullName ||
                academyProfile.full_name ||
                userData.fullName ||
                userData.name ||
                userData.displayName ||
                userData.username ||
                req.user?.name ||
                'Hustler'
            ) || 'Hustler';

        const username = normalizeAcademyProfileUsername(
            academyProfile.username ||
            userData.username ||
            '',
            fullName
        );

        const avatar = normalizeUniverseAvatar(
            academyProfile.avatar ||
            userData.avatar ||
            userData.profilePhoto ||
            userData.photoURL ||
            ''
        );

        const coverPhoto = normalizeUniverseAvatar(
            academyProfile.cover_photo ||
            academyProfile.coverPhoto ||
            userData.coverPhoto ||
            ''
        );

        const signals = {
            lookingFor: normalizeUniverseSignalList(
                academyProfile.looking_for ||
                academyProfile.lookingFor ||
                userData.lookingFor ||
                plazaDirectoryProfile?.lookingFor
            ),
            canOffer: normalizeUniverseSignalList(
                academyProfile.can_offer ||
                academyProfile.canOffer ||
                userData.canOffer ||
                plazaDirectoryProfile?.canOffer
            ),
            availability: sanitize(
                academyProfile.availability ||
                userData.availability ||
                plazaDirectoryProfile?.availability ||
                ''
            ),
            workMode: sanitize(
                academyProfile.work_mode ||
                academyProfile.workMode ||
                userData.workMode ||
                plazaDirectoryProfile?.workMode ||
                ''
            ),
            marketplaceReady:
                academyProfile.marketplace_ready === true ||
                academyProfile.marketplaceReady === true ||
                userData.marketplaceReady === true,
            tags: normalizeUniverseSignalList(
                academyProfile.search_tags ||
                academyProfile.searchTags ||
                userData.searchTags ||
                plazaDirectoryProfile?.tags
            )
        };

        return res.json({
            success: true,
            profile: {
                id: uid,
                uid,
                firebaseUid: uid,
                email: sanitize(userData.email || req.user?.email || '').toLowerCase(),
                fullName,
                displayName: fullName,
                username,
                avatar,
                profilePhoto: avatar,
                photoURL: avatar,
                coverPhoto,
                bio: sanitize(
                    academyProfile.bio ||
                    userData.bio ||
                    userData.profileBio ||
                    'Focused on execution, consistency, and long-term growth inside YH Universe.'
                ),
                city: sanitize(userData.city || ''),
                country: sanitize(userData.country || ''),
                trustTier,
                membershipSummary,
                divisions,
                signals,
                source: 'universe-profile-v1'
            }
        });
    } catch (error) {
        console.error('getUniverseProfile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load YH Universe profile.'
        });
    }
};

function normalizeUniverseProfileStatus(value = '', fallback = 'not_applied') {
    const raw = sanitize(value).toLowerCase();

    if (!raw || raw === 'none' || raw === 'not applied' || raw === 'not_applied') return fallback;
    if (raw === 'approved' || raw === 'active' || raw === 'member') return 'approved';
    if (raw === 'under review' || raw === 'pending' || raw === 'pending review' || raw === 'review') return 'under_review';
    if (raw === 'screening' || raw === 'in screening') return 'screening';
    if (raw === 'shortlisted' || raw === 'shortlist') return 'shortlisted';
    if (raw === 'waitlisted' || raw === 'waitlist') return 'waitlisted';
    if (raw === 'rejected' || raw === 'denied' || raw === 'not approved') return 'rejected';

    return raw.replace(/\s+/g, '_');
}

function getUniverseProfileStatusLabel(status = '') {
    const normalized = normalizeUniverseProfileStatus(status);

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'under_review') return 'Under Review';
    if (normalized === 'screening') return 'Screening';
    if (normalized === 'shortlisted') return 'Shortlisted';
    if (normalized === 'waitlisted') return 'Waitlisted';
    if (normalized === 'rejected') return 'Rejected';

    return 'Not Applied';
}

function buildUniverseDivisionState({
    key = '',
    label = '',
    isMember = false,
    status = '',
    application = null,
    canEnter = false,
    profile = null,
    extra = {}
} = {}) {
    const normalizedStatus = isMember
        ? 'approved'
        : normalizeUniverseProfileStatus(status);

    const hasApplication = Boolean(
        application ||
        (normalizedStatus && normalizedStatus !== 'not_applied')
    );

    let membershipLabel = `Not a member of ${label}`;

    if (isMember) {
        membershipLabel = `Member of ${label}`;
    } else if (hasApplication) {
        membershipLabel = `Not a member of ${label} — application ${getUniverseProfileStatusLabel(normalizedStatus).toLowerCase()}`;
    }

    return {
        key,
        label,
        isMember: isMember === true,
        hasApplication,
        status: normalizedStatus,
        statusLabel: getUniverseProfileStatusLabel(normalizedStatus),
        membershipLabel,
        canEnter: canEnter === true || isMember === true,
        application,
        profile,
        ...extra
    };
}

function buildUniverseMembershipSummary(divisions = {}) {
    const entries = Object.entries(divisions);

    const memberDivisions = entries
        .filter(([, state]) => state?.isMember === true)
        .map(([key, state]) => ({
            key,
            label: state.label
        }));

    const nonMemberDivisions = entries
        .filter(([, state]) => state?.isMember !== true)
        .map(([key, state]) => ({
            key,
            label: state.label,
            status: state.status || 'not_applied',
            statusLabel: state.statusLabel || 'Not Applied',
            hasApplication: state.hasApplication === true
        }));

    const labels = memberDivisions.map((item) => item.label);

    let primaryMembershipLabel = 'Not a member of any YH Universe division yet.';

    if (labels.length === 1) {
        primaryMembershipLabel = `Member of ${labels[0]} only.`;
    } else if (labels.length === 2) {
        primaryMembershipLabel = `Member of ${labels[0]} and ${labels[1]}.`;
    } else if (labels.length >= 3) {
        primaryMembershipLabel = 'Member of all YH Universe divisions.';
    }

    return {
        isMemberAnywhere: memberDivisions.length > 0,
        primaryMembershipLabel,
        memberDivisions,
        nonMemberDivisions
    };
}

function getUniverseTrustTier(divisions = {}) {
    if (divisions.federation?.isMember === true) return 'Strategic';
    if (divisions.plaza?.isMember === true) return 'Active Connector';
    if (divisions.academy?.isMember === true) return 'Builder';
    return 'Guest';
}

function normalizeUniverseSignalList(value = [], limit = 8) {
    const source = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    const seen = new Set();
    const out = [];

    for (const item of source) {
        const clean = sanitize(item);
        if (!clean) continue;

        const key = clean.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        out.push(clean);

        if (out.length >= limit) break;
    }

    return out;
}

function mapUniversePlazaDirectoryProfile(raw = null) {
    if (!raw || typeof raw !== 'object') return null;

    return {
        role: sanitize(raw.role || raw.title || ''),
        region: sanitize(raw.region || raw.country || ''),
        division: sanitize(raw.division || ''),
        trust: sanitize(raw.trust || raw.trustLevel || ''),
        focus: sanitize(raw.focus || raw.profileFocus || ''),
        tags: normalizeUniverseSignalList(raw.tags || raw.searchTags),
        lookingFor: normalizeUniverseSignalList(raw.lookingFor || raw.looking_for),
        canOffer: normalizeUniverseSignalList(raw.canOffer || raw.can_offer),
        availability: sanitize(raw.availability || ''),
        workMode: sanitize(raw.workMode || raw.work_mode || ''),
        marketplaceMode: sanitize(raw.marketplaceMode || raw.marketplace_mode || ''),
        updatedAt: raw.updatedAt || ''
    };
}

function mapUniverseFederationProfile(uid = '', userData = {}) {
    return {
        id: sanitize(uid),
        name: sanitize(
            userData.fullName ||
            userData.name ||
            userData.displayName ||
            userData.username ||
            'Federation Member'
        ),
        username: sanitize(userData.username || ''),
        email: sanitize(userData.email || '').toLowerCase(),
        role: sanitize(
            userData.federationRole ||
            userData.role ||
            userData.occupation ||
            ''
        ),
        category: sanitize(
            userData.federationCategory ||
            userData.category ||
            userData.industry ||
            'Strategic Network'
        ),
        country: sanitize(userData.country || ''),
        city: sanitize(userData.city || ''),
        company: sanitize(userData.company || userData.companyName || ''),
        referralCode: sanitize(userData.federationReferralCode || ''),
        approvedAt: userData.federationApprovedAt || ''
    };
}

async function getUniverseSafeDoc(collectionName = '', docId = '') {
    const cleanCollectionName = sanitize(collectionName);
    const cleanDocId = sanitize(docId);

    if (!cleanCollectionName || !cleanDocId) return null;

    try {
        const snap = await firestore.collection(cleanCollectionName).doc(cleanDocId).get();
        return snap.exists ? (snap.data() || {}) : null;
    } catch (_) {
        return null;
    }
}

exports.getUniverseProfile = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnapshot.data() || {};

        const storedAcademyProfile = await academyFirestoreRepo
            .getCurrentProfile(uid)
            .catch(() => null) || {};

        const academyProfile = buildAcademyProfileResponse(uid, userData, storedAcademyProfile);

        try {
            const socialProfile = await academyCommunityRepo.getMemberProfile({
                viewerId: uid,
                targetUserId: uid
            });

            academyProfile.followers_count = socialProfile?.followers_count ?? academyProfile.followers_count ?? '—';
            academyProfile.following_count = socialProfile?.following_count ?? academyProfile.following_count ?? '—';
            academyProfile.friends_count = socialProfile?.friends_count ?? socialProfile?.friend_count ?? academyProfile.friends_count ?? '—';
            academyProfile.friend_count = academyProfile.friends_count;

            if (Number.isFinite(Number(socialProfile?.post_count))) {
                academyProfile.post_count = Number(socialProfile.post_count);
            }

            if (Array.isArray(socialProfile?.recent_posts)) {
                academyProfile.recent_posts = socialProfile.recent_posts;
            }
        } catch (_) {}

        const academyApplication =
            userData.academyApplication && typeof userData.academyApplication === 'object'
                ? userData.academyApplication
                : null;

        const plazaApplication =
            userData.plazaApplication && typeof userData.plazaApplication === 'object'
                ? userData.plazaApplication
                : null;

        const federationApplication =
            userData.federationApplication && typeof userData.federationApplication === 'object'
                ? userData.federationApplication
                : null;

        let academyAccessState = null;
        try {
            academyAccessState = await academyFirestoreRepo.getAccessState(uid);
        } catch (_) {
            academyAccessState = null;
        }

        const rawAcademyStatus =
            userData.academyMembershipStatus ||
            userData.academyApplicationStatus ||
            academyApplication?.status ||
            '';

        const rawPlazaStatus =
            userData.plazaAccessStatus ||
            userData.plazaMembershipStatus ||
            userData.plazaApplicationStatus ||
            plazaApplication?.status ||
            '';

        const rawFederationStatus =
            userData.federationMembershipStatus ||
            userData.federationApplicationStatus ||
            federationApplication?.status ||
            '';

        const academyStatus = normalizeUniverseProfileStatus(rawAcademyStatus);
        const plazaStatus = normalizeUniverseProfileStatus(rawPlazaStatus);
        const federationStatus = normalizeUniverseProfileStatus(rawFederationStatus);

        const isAcademyMember =
            userData.hasAcademyAccess === true ||
            userData.canEnterAcademy === true ||
            academyStatus === 'approved' ||
            academyAccessState?.accessState === 'unlocked';

        const isPlazaMember =
            userData.hasPlazaAccess === true ||
            plazaStatus === 'approved';

        const isFederationMember =
            userData.hasFederationAccess === true ||
            federationStatus === 'approved';

        const plazaDirectoryRaw = await getUniverseSafeDoc('plazaDirectoryProfiles', uid);

        const divisions = {
            academy: buildUniverseDivisionState({
                key: 'academy',
                label: 'The Academy',
                isMember: isAcademyMember,
                status: academyStatus,
                application: academyApplication,
                canEnter: isAcademyMember,
                profile: academyProfile,
                extra: {
                    accessState: academyAccessState || null
                }
            }),
            plaza: buildUniverseDivisionState({
                key: 'plaza',
                label: 'The Plaza',
                isMember: isPlazaMember,
                status: plazaStatus,
                application: plazaApplication,
                canEnter: isPlazaMember,
                profile: mapUniversePlazaDirectoryProfile(plazaDirectoryRaw)
            }),
            federation: buildUniverseDivisionState({
                key: 'federation',
                label: 'The Federation',
                isMember: isFederationMember,
                status: federationStatus,
                application: federationApplication,
                canEnter: isFederationMember,
                profile: isFederationMember ? mapUniverseFederationProfile(uid, userData) : null
            })
        };

        const membershipSummary = buildUniverseMembershipSummary(divisions);
        const trustTier = getUniverseTrustTier(divisions);

        const fullName = sanitize(
            academyProfile.fullName ||
            academyProfile.full_name ||
            userData.fullName ||
            userData.name ||
            userData.displayName ||
            userData.username ||
            req.user?.name ||
            'Hustler'
        ) || 'Hustler';

        const username = normalizeAcademyProfileUsername(
            academyProfile.username ||
            userData.username ||
            '',
            fullName
        );

        const avatar = sanitize(
            academyProfile.avatar ||
            userData.avatar ||
            userData.profilePhoto ||
            userData.photoURL ||
            ''
        );

        const coverPhoto = sanitize(
            academyProfile.cover_photo ||
            academyProfile.coverPhoto ||
            userData.coverPhoto ||
            ''
        );

        const signals = {
            lookingFor: normalizeUniverseSignalList(
                userData.lookingFor ||
                storedAcademyProfile.looking_for ||
                storedAcademyProfile.lookingFor ||
                plazaDirectoryRaw?.lookingFor ||
                plazaDirectoryRaw?.looking_for
            ),
            canOffer: normalizeUniverseSignalList(
                userData.canOffer ||
                storedAcademyProfile.can_offer ||
                storedAcademyProfile.canOffer ||
                plazaDirectoryRaw?.canOffer ||
                plazaDirectoryRaw?.can_offer
            ),
            availability: sanitize(
                userData.availability ||
                storedAcademyProfile.availability ||
                plazaDirectoryRaw?.availability ||
                ''
            ),
            workMode: sanitize(
                userData.workMode ||
                storedAcademyProfile.work_mode ||
                storedAcademyProfile.workMode ||
                plazaDirectoryRaw?.workMode ||
                plazaDirectoryRaw?.work_mode ||
                ''
            ),
            marketplaceReady:
                userData.marketplaceReady === true ||
                storedAcademyProfile.marketplace_ready === true ||
                storedAcademyProfile.marketplaceReady === true,
            tags: normalizeUniverseSignalList(
                userData.searchTags ||
                academyProfile.search_tags ||
                storedAcademyProfile.search_tags ||
                plazaDirectoryRaw?.tags
            )
        };

        return res.json({
            success: true,
            profile: {
                id: uid,
                uid,
                firebaseUid: uid,
                email: sanitize(userData.email || req.user?.email || '').toLowerCase(),
                fullName,
                displayName: fullName,
                username,
                avatar,
                profilePhoto: avatar,
                photoURL: avatar,
                coverPhoto,
                bio: sanitize(
                    academyProfile.bio ||
                    userData.bio ||
                    userData.profileBio ||
                    'Focused on execution, consistency, and long-term growth inside YH Universe.'
                ),
                city: sanitize(userData.city || ''),
                country: sanitize(userData.country || ''),
                trustTier,
                membershipSummary,
                divisions,
                signals,
                source: 'universe-profile-v1'
            }
        });
    } catch (error) {
        console.error('getUniverseProfile error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to load YH Universe profile.'
        });
    }
};

exports.getCurrentProfile = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};
            const storedProfile = await academyFirestoreRepo.getCurrentProfile(uid) || {};
            const profileResponse = buildAcademyProfileResponse(uid, userData, storedProfile);

            try {
                const socialProfile = await academyCommunityRepo.getMemberProfile({
                    viewerId: uid,
                    targetUserId: uid
                });

                profileResponse.followers_count = socialProfile?.followers_count ?? profileResponse.followers_count ?? '—';
                profileResponse.following_count = socialProfile?.following_count ?? profileResponse.following_count ?? '—';
                profileResponse.friends_count = socialProfile?.friends_count ?? socialProfile?.friend_count ?? profileResponse.friends_count ?? '—';
                profileResponse.friend_count = profileResponse.friends_count;
                profileResponse.mutual_friend_count = 0;

                if (Number.isFinite(Number(socialProfile?.post_count))) {
                    profileResponse.post_count = Number(socialProfile.post_count);
                }

                if (Array.isArray(socialProfile?.recent_posts)) {
                    profileResponse.recent_posts = socialProfile.recent_posts;
                }
            } catch (socialError) {
                console.warn('getCurrentProfile social stats fallback:', socialError?.message || socialError);
            }

            return res.json({
                success: true,
                profile: profileResponse
            });
    } catch (error) {
        console.error('getCurrentProfile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Academy profile.'
        });
    }
};

exports.updateCurrentProfile = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};
        const storedProfile = await academyFirestoreRepo.getCurrentProfile(uid) || {};
        const currentProfile = buildAcademyProfileResponse(uid, userData, storedProfile);

        const hasSearchTagsField =
            Object.prototype.hasOwnProperty.call(req.body || {}, 'search_tags') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'searchTags') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'tags');

        const hasAvatarField =
            Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'profilePhoto') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'photoURL');

        const hasCoverField =
            Object.prototype.hasOwnProperty.call(req.body || {}, 'cover_photo') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'coverPhoto');

        const nextDisplayName = sanitize(
            req.body?.display_name ||
            req.body?.displayName ||
            req.body?.fullName ||
            req.body?.name ||
            currentProfile.display_name ||
            'Hustler'
        ).slice(0, 60);

        const nextUsername = normalizeAcademyProfileUsername(
            req.body?.username || currentProfile.username,
            nextDisplayName
        );

        const nextBio = sanitize(
            req.body?.bio ||
            req.body?.profileBio ||
            currentProfile.bio ||
            'Focused on execution, consistency, and long-term growth inside The Academy.'
        ).slice(0, 280);

        if (!nextDisplayName) {
            return res.status(400).json({
                success: false,
                message: 'Display name is required.'
            });
        }

        if (!nextUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username is required.'
            });
        }

        const payload = {
            display_name: nextDisplayName,
            username: nextUsername,
            role_label: 'Academy Member',
            bio: nextBio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
            avatar: hasAvatarField
                ? sanitizeAcademyProfileAsset(
                    req.body?.avatar ||
                    req.body?.profilePhoto ||
                    req.body?.photoURL
                )
                : currentProfile.avatar,
            cover_photo: hasCoverField
                ? sanitizeAcademyProfileAsset(
                    req.body?.cover_photo ||
                    req.body?.coverPhoto
                )
                : currentProfile.cover_photo,
            search_tags: hasSearchTagsField
                ? normalizeAcademyProfileTags(
                    req.body?.search_tags ??
                    req.body?.searchTags ??
                    req.body?.tags
                )
                : normalizeAcademyProfileTags(currentProfile.search_tags)
        };

        const savedProfile = await academyFirestoreRepo.setCurrentProfile(uid, payload);
        const refreshedUserSnapshot = await userRef.get();
        const refreshedUserData = refreshedUserSnapshot.exists ? (refreshedUserSnapshot.data() || {}) : {};

        return res.json({
            success: true,
            profile: buildAcademyProfileResponse(uid, refreshedUserData, savedProfile || payload)
        });
    } catch (error) {
        console.error('updateCurrentProfile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Academy profile.'
        });
    }
};
exports.changeCurrentPassword = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const currentPassword = String(
            req.body?.currentPassword ||
            req.body?.password ||
            ''
        );

        const newPassword = String(
            req.body?.newPassword ||
            ''
        );

        const confirmPassword = String(
            req.body?.confirmPassword ||
            req.body?.passwordConfirmation ||
            ''
        );

        if (!currentPassword.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required.'
            });
        }

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters.'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password confirmation does not match.'
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from your current password.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnapshot.data() || {};
        const passwordHash = String(userData.password || userData.passwordHash || '');

        if (!passwordHash) {
            return res.status(400).json({
                success: false,
                message: 'This account does not have a password configured.'
            });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, passwordHash).catch(() => false);

        if (!passwordMatches) {
            return res.status(403).json({
                success: false,
                message: 'Incorrect current password.'
            });
        }

        const newPasswordMatchesOld = await bcrypt.compare(newPassword, passwordHash).catch(() => false);

        if (newPasswordMatchesOld) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from your current password.'
            });
        }

        const nextPasswordHash = await bcrypt.hash(newPassword, 10);
        const nowIso = new Date().toISOString();

        const updatePayload = {
            password: nextPasswordHash,
            passwordUpdatedAt: nowIso,
            updatedAt: nowIso
        };

        if (userData.passwordHash) {
            updatePayload.passwordHash = nextPasswordHash;
        }

        await userRef.update(updatePayload);

        return res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        console.error('changeCurrentPassword error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to change password.'
        });
    }
};
exports.deleteCurrentProfile = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const password = String(
            req.body?.password ||
            req.body?.currentPassword ||
            ''
        );

        if (!password.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Account password is required.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnapshot.data() || {};
        const passwordHash = String(userData.password || '');

        if (!passwordHash) {
            return res.status(400).json({
                success: false,
                message: 'This account does not have a password configured.'
            });
        }

        const passwordMatches = await bcrypt.compare(password, passwordHash).catch(() => false);

        if (!passwordMatches) {
            return res.status(403).json({
                success: false,
                message: 'Incorrect account password.'
            });
        }

        await academyFirestoreRepo.deleteCurrentProfile(uid);

        const refreshedUserSnapshot = await userRef.get();
        const refreshedUserData = refreshedUserSnapshot.exists
            ? (refreshedUserSnapshot.data() || {})
            : {};

        const storedProfile = await academyFirestoreRepo.getCurrentProfile(uid) || {};
        const profileResponse = buildAcademyProfileResponse(uid, refreshedUserData, storedProfile);

        return res.json({
            success: true,
            deleted: true,
            profile: {
                ...profileResponse,
                avatar: '',
                cover_photo: '',
                bio: profileResponse.bio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
                search_tags: []
            }
        });
    } catch (error) {
        console.error('deleteCurrentProfile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Academy profile.'
        });
    }
};
exports.getMembershipStatus = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};

        const application =
            userData.academyApplication && typeof userData.academyApplication === 'object'
                ? userData.academyApplication
                : null;

        const roadmapApplication =
            userData.roadmapApplication && typeof userData.roadmapApplication === 'object'
                ? userData.roadmapApplication
                : null;
        const applicationStatus = application
            ? sanitize(application?.status).toLowerCase()
            : 'none';
        const roadmapApplicationStatus = sanitize(roadmapApplication?.status).toLowerCase();

        let hasRoadmapAccess = false;
        try {
            const accessState = await academyFirestoreRepo.getAccessState(uid);
            hasRoadmapAccess = accessState?.accessState === 'unlocked';
        } catch (_) {
            hasRoadmapAccess = false;
        }

        const canEnterAcademy = applicationStatus === 'approved';

        return res.json({
            success: true,
            hasApplication: Boolean(application),
            application,
            applicationStatus,
            roadmapApplication,
            roadmapApplicationStatus,
            hasRoadmapAccess,
            canEnterAcademy
        });
    } catch (error) {
        console.error('getMembershipStatus error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Academy membership status.'
        });
    }
};
exports.submitCheckin = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const activeRoadmap = await academyFirestoreRepo.getActiveRoadmap(uid);

        if (!activeRoadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found for check-in.'
            });
        }

        const energyScore = clamp(toInt(req.body.energyScore, 0), 0, 10);
        const moodScore = clamp(toInt(req.body.moodScore, 0), 0, 10);
        const completedSummary = sanitize(req.body.completedSummary || '');
        const blockerText = sanitize(req.body.blockerText || '');
        const tomorrowFocus = sanitize(req.body.tomorrowFocus || '');
        const rawMissionSignals = req.body?.missionSignals && typeof req.body.missionSignals === 'object'
            ? req.body.missionSignals
            : {};
        const missionSignals = {
            total: Math.max(0, toInt(rawMissionSignals.total, 0)),
            completed: Math.max(0, toInt(rawMissionSignals.completed, 0)),
            pending: Math.max(0, toInt(rawMissionSignals.pending, 0)),
            skipped: Math.max(0, toInt(rawMissionSignals.skipped, 0)),
            stuck: Math.max(0, toInt(rawMissionSignals.stuck, 0))
        };

        await academyFirestoreRepo.createCheckin(uid, activeRoadmap.id, {
            energyScore,
            moodScore,
            completedSummary,
            blockerText,
            tomorrowFocus,
            aiFeedback: {
                type: 'daily_checkin',
                missionSignals
            }
        });

        const completedMissionIds = Array.isArray(req.body?.completedMissionIds)
            ? req.body.completedMissionIds
            : [];

        const skippedMissionIds = Array.isArray(req.body?.skippedMissionIds)
            ? req.body.skippedMissionIds
            : [];

        const stuckMissionIds = Array.isArray(req.body?.stuckMissionIds)
            ? req.body.stuckMissionIds
            : [];

        for (const missionId of completedMissionIds) {
            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                userDifficultyScore: clamp(toInt(req.body?.difficultyToday, 0), 0, 10),
                userUsefulnessScore: clamp(toInt(req.body?.usefulnessToday, 0), 0, 10)
            });
        }

        for (const missionId of skippedMissionIds) {
            const mission = await academyFirestoreRepo.getMissionById(uid, missionId);
            const existingSkipCount = toInt(mission?.outcomeMetrics?.skipCount, 0);

            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                skipCount: existingSkipCount + 1,
                lastSkipReasonCategory: sanitize(req.body?.skipReasonCategory || 'time_overload')
            });
        }

        for (const missionId of stuckMissionIds) {
            const mission = await academyFirestoreRepo.getMissionById(uid, missionId);
            const existingStuckCount = toInt(mission?.outcomeMetrics?.stuckCount, 0);

            await academyFirestoreRepo.updateMissionOutcomeMetrics(uid, missionId, {
                stuckCount: existingStuckCount + 1
            });
        }

        try {
            await publicLandingEventsRepo.createEventForUser(uid, {
                type: 'academy_checkin_saved',
                slot: 'academy',
                category: 'academy',
                message: 'Daily Academy check-in submitted from {location}.',
                feedText: '{name} submitted an Academy check-in.',
                labelPrefix: 'Academy Check-In',
                color: '#a78bfa',
                altitude: 0.19,
                ttlSeconds: 1200,
                coreColor: 'rgba(237, 233, 254, 0.98)',
                coreAltitude: 0.012,
                coreRadius: 0.17,
                ringAltitude: 0.0031,
                ringColor: [
                    'rgba(237, 233, 254, 0.98)',
                    'rgba(167, 139, 250, 0.46)',
                    'rgba(167, 139, 250, 0)'
                ],
                ringMaxRadius: 5.0,
                ringPropagationSpeed: 1.86,
                ringRepeatPeriod: 720
            });
        } catch (glowError) {
            console.warn('submitCheckin public landing event skipped:', glowError?.message || glowError);
        }

        const behaviorState = await refreshBehaviorState(uid);
        const homePayload = await academyFirestoreRepo.buildAcademyHomePayload(uid, activeRoadmap.id);

        return res.json({
            success: true,
            message: 'Check-in saved.',
            behaviorProfile: behaviorState.behaviorProfile,
            previousBehaviorProfile: behaviorState.previousBehaviorProfile,
            plannerStats: behaviorState.plannerStats,
            adaptivePlanning: homePayload?.adaptivePlanning || {}
        });
    } catch (error) {
        console.error('Submit Check-in Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving check-in.'
        });
    }
};
exports.getInternalRoadmapTelemetry = async (req, res) => {
    try {
        const uid = sanitize(req.params?.uid || req.query?.uid);
        const roadmapId = sanitize(req.query?.roadmapId);

        if (!uid) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required.'
            });
        }

        const payload = await academyFirestoreRepo.buildRoadmapTelemetryInspector(uid, roadmapId);

        if (!payload) {
            return res.status(404).json({
                success: false,
                message: 'No roadmap telemetry found for that user.'
            });
        }

        return res.json({
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('Internal Roadmap Telemetry Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while loading roadmap telemetry.'
        });
    }
};
exports.submitRoadmapApplication = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(uid);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.exists ? (userSnapshot.data() || {}) : {};

        const academyApplication =
            userData.academyApplication && typeof userData.academyApplication === 'object'
                ? userData.academyApplication
                : null;

        const academyStatus = sanitize(academyApplication?.status).toLowerCase();

        if (academyStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: 'Academy membership must be approved before roadmap application.'
            });
        }

        const existingRoadmapApplication =
            userData.roadmapApplication && typeof userData.roadmapApplication === 'object'
                ? userData.roadmapApplication
                : null;

        if (existingRoadmapApplication) {
            return res.json({
                success: true,
                alreadyExists: true,
                roadmapApplication: existingRoadmapApplication
            });
        }

        const scopeLabelByKey = {
            money_business: 'Money, Wealth & Business',
            mindset_psychology: 'Mindset & Psychology',
            fitness_health: 'Fitness & Health',
            communication_networking: 'Communication & Networking',
            knowledge_for_life: 'Knowledge for Life',
            politics_2030_agenda: 'Politics & the 2030 Agenda',
            philosophy: 'Philosophy'
        };

        const scopeKeyByLabel = Object.entries(scopeLabelByKey).reduce((acc, [key, label]) => {
            acc[label.toLowerCase()] = key;
            return acc;
        }, {});

        const sanitizeNestedScopeAnswers = (value) => {
            if (Array.isArray(value)) {
                return value
                    .map((item) => sanitize(item))
                    .filter(Boolean);
            }

            if (!value || typeof value !== 'object') {
                return {};
            }

            return Object.entries(value).reduce((acc, [key, rawValue]) => {
                const cleanKey = sanitize(key);
                if (!cleanKey) return acc;

                if (Array.isArray(rawValue)) {
                    acc[cleanKey] = rawValue
                        .map((item) => sanitize(item))
                        .filter(Boolean);
                    return acc;
                }

                if (rawValue && typeof rawValue === 'object') {
                    acc[cleanKey] = Object.entries(rawValue).reduce((inner, [innerKey, innerValue]) => {
                        const cleanInnerKey = sanitize(innerKey);
                        if (!cleanInnerKey) return inner;
                        inner[cleanInnerKey] = sanitize(innerValue);
                        return inner;
                    }, {});
                    return acc;
                }

                acc[cleanKey] = sanitize(rawValue);
                return acc;
            }, {});
        };

        const requestedFocusArea = sanitize(req.body?.focusArea || '');
        const requestedFocusAreaKey = sanitize(req.body?.focusAreaKey || '').toLowerCase();

        let resolvedFocusAreaKey = scopeLabelByKey[requestedFocusAreaKey]
            ? requestedFocusAreaKey
            : scopeKeyByLabel[requestedFocusArea.toLowerCase()] || '';

        if (!resolvedFocusAreaKey && requestedFocusArea) {
            const inferredKey = requestedFocusArea
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');

            if (scopeLabelByKey[inferredKey]) {
                resolvedFocusAreaKey = inferredKey;
            }
        }

        const resolvedFocusArea = sanitize(
            requestedFocusArea || scopeLabelByKey[resolvedFocusAreaKey] || ''
        );

        const rawScopeAnswers =
            req.body?.scopeAnswers && typeof req.body.scopeAnswers === 'object'
                ? req.body.scopeAnswers
                : safeJsonParse(req.body?.scopeAnswers, {});

        const roadmapIntake = {
            focusArea: resolvedFocusArea,
            focusAreaKey: sanitize(resolvedFocusAreaKey),
            schemaKey: sanitize(
                req.body?.schemaKey ||
                (resolvedFocusAreaKey ? `${resolvedFocusAreaKey}_v1` : '')
            ),
            intakeVersion: toInt(req.body?.intakeVersion, 2) || 2,
            currentLevel: sanitize(req.body?.currentLevel || ''),
            target30Days: sanitize(req.body?.target30Days || ''),
            dailyMinutes: sanitize(req.body?.dailyMinutes || ''),
            weeklyHours: sanitize(req.body?.weeklyHours || ''),
            sleepHours: sanitize(req.body?.sleepHours || ''),
            energyScore: sanitize(req.body?.energyScore || ''),
            stressScore: sanitize(req.body?.stressScore || ''),
            badHabit: sanitize(req.body?.badHabit || ''),
            blockerText: sanitize(req.body?.blockerText || ''),
            coachTone: sanitize(req.body?.coachTone || 'balanced'),
            firstQuickWin: sanitize(req.body?.firstQuickWin || ''),
            scopeAnswers: sanitizeNestedScopeAnswers(rawScopeAnswers),
            submittedAt: sanitize(req.body?.submittedAt || new Date().toISOString())
        };

        const storedProfile = await academyFirestoreRepo.getCurrentProfile(uid) || {};

        const mergedProfile = {
            id: 'roadmap-application',
            uid,
            ...storedProfile,
            ...normalizeProfile({
                ...storedProfile,
                sleepHours: roadmapIntake.sleepHours,
                energyScore: roadmapIntake.energyScore,
                stressScore: roadmapIntake.stressScore,
                badHabit: roadmapIntake.badHabit,
                weeklyHours: roadmapIntake.weeklyHours,
                blockerText: roadmapIntake.blockerText,
                coachTone: roadmapIntake.coachTone,
                goals6mo: roadmapIntake.target30Days
            }),
            topPriorityPillar: roadmapIntake.focusArea,
            focusAreaKey: roadmapIntake.focusAreaKey,
            roadmapSchemaKey: roadmapIntake.schemaKey,
            roadmapIntakeVersion: roadmapIntake.intakeVersion,
            scopeAnswers: roadmapIntake.scopeAnswers,
            dynamicIntake: {
                focusArea: roadmapIntake.focusArea,
                focusAreaKey: roadmapIntake.focusAreaKey,
                schemaKey: roadmapIntake.schemaKey,
                intakeVersion: roadmapIntake.intakeVersion,
                currentLevel: roadmapIntake.currentLevel,
                scopeAnswers: roadmapIntake.scopeAnswers
            },
            pillarContext: roadmapIntake.focusAreaKey
                ? {
                    key: roadmapIntake.focusAreaKey,
                    label: roadmapIntake.focusArea,
                    schemaKey: roadmapIntake.schemaKey,
                    answers: roadmapIntake.scopeAnswers
                }
                : {},
            biggestImmediateProblem: roadmapIntake.blockerText,
            next30DaysWin: roadmapIntake.target30Days,
            preferredWorkStyle: roadmapIntake.currentLevel,
            accountabilityStyle: roadmapIntake.coachTone,
            firstQuickWin: roadmapIntake.firstQuickWin,
            seriousness: sanitize(
                storedProfile?.seriousness ||
                academyApplication?.academyProfile?.seriousness ||
                ''
            )
        };

        const plannerResult = await generateAndPersistPlanFirestore(uid, mergedProfile, {
            mode: 'roadmap_application_auto_unlock',
            trigger: 'roadmap_application'
        });

        const nowIso = new Date().toISOString();

        await academyFirestoreRepo.setAccessUnlocked(uid);

        const roadmapApplication = {
            id: `RMAP-${Date.now().toString().slice(-8)}`,
            applicationType: 'academy-roadmap',
            reviewLane: 'Roadmap Auto Build',
            status: 'Approved',
            recommendedDivision: 'Academy',
            source: 'Roadmap Tab',
            name: sanitize(userData.fullName || userData.name || userData.displayName || userData.username || 'Hustler'),
            username: sanitize(userData.username || ''),
            email: sanitize(userData.email || '').toLowerCase(),
            goal: roadmapIntake.target30Days || roadmapIntake.focusArea || 'Roadmap application',
            background: [
                roadmapIntake.currentLevel,
                roadmapIntake.blockerText,
                roadmapIntake.firstQuickWin
            ].filter(Boolean).join(' • ') || 'No roadmap summary submitted.',
            aiScore: 0,
            country: sanitize(storedProfile?.country || ''),
            skills: [
                roadmapIntake.focusArea,
                roadmapIntake.currentLevel,
                roadmapIntake.coachTone
            ].filter(Boolean),
            networkValue: 'Unknown',
            submittedAt: nowIso,
            updatedAt: nowIso,
            reviewedAt: nowIso,
            reviewedBy: 'system:auto-ai',
            notes: [
                'Submitted from Roadmap tab.',
                'AI roadmap generated automatically from the roadmap application.',
                'Roadmap access unlocked automatically after successful AI build.'
            ],
            roadmapIntake,
            roadmapId: plannerResult?.roadmapId || '',
            createdByModel: plannerResult?.createdByModel || ''
        };

        await userRef.set(
            {
                roadmapApplication,
                roadmapApplicationStatus: roadmapApplication.status,
                roadmapApplicationSubmittedAt: roadmapApplication.submittedAt,
                roadmapApplicationReviewedAt: roadmapApplication.reviewedAt,
                roadmapApplicationReviewedBy: roadmapApplication.reviewedBy,
                updatedAt: nowIso
            },
            { merge: true }
        );

        try {
            await publicLandingEventsRepo.createEventForUser(uid, {
                type: 'academy_roadmap_application',
                slot: 'academy',
                category: 'academy',
                message: 'Academy roadmap unlocked from {location}.',
                feedText: '{name} unlocked Academy roadmap access.',
                labelPrefix: 'Roadmap Unlock',
                color: '#38bdf8',
                altitude: 0.21,
                ttlSeconds: 1800,
                coreColor: 'rgba(191, 219, 254, 0.98)',
                coreAltitude: 0.0125,
                coreRadius: 0.18,
                ringAltitude: 0.0032,
                ringColor: [
                    'rgba(191, 219, 254, 0.98)',
                    'rgba(56, 189, 248, 0.46)',
                    'rgba(56, 189, 248, 0)'
                ],
                ringMaxRadius: 5.5,
                ringPropagationSpeed: 1.8,
                ringRepeatPeriod: 740
            });
        } catch (glowError) {
            console.warn('submitRoadmapApplication public landing event skipped:', glowError?.message || glowError);
        }

        return res.status(201).json({
            success: true,
            alreadyExists: false,
            roadmapApplication,
            hasRoadmapAccess: true,
            roadmapId: plannerResult?.roadmapId || '',
            createdByModel: plannerResult?.createdByModel || '',
            home: plannerResult?.homePayload || null
        });
    } catch (error) {
        console.error('submitRoadmapApplication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit roadmap application.'
        });
    }
};
exports.refreshRoadmap = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const storedProfile = await academyFirestoreRepo.getCurrentProfile(uid);

        if (!storedProfile) {
            return res.status(404).json({
                success: false,
                message: 'No Academy profile found yet.'
            });
        }

        const profile = {
            id: 'current',
            uid,
            ...normalizeProfile(storedProfile)
        };

        const plannerResult = await generateAndPersistPlanFirestore(uid, profile, { mode: 'refresh' });

        try {
            await publicLandingEventsRepo.createEventForUser(uid, {
                type: 'academy_roadmap_refresh',
                slot: 'academy',
                category: 'academy',
                message: 'Academy roadmap refreshed from {location}.',
                feedText: '{name} refreshed their Academy roadmap.',
                labelPrefix: 'Roadmap Refresh',
                color: '#38bdf8',
                altitude: 0.21,
                ttlSeconds: 1500,
                coreColor: 'rgba(191, 219, 254, 0.98)',
                coreAltitude: 0.0125,
                coreRadius: 0.18,
                ringAltitude: 0.0032,
                ringColor: [
                    'rgba(191, 219, 254, 0.98)',
                    'rgba(56, 189, 248, 0.46)',
                    'rgba(56, 189, 248, 0)'
                ],
                ringMaxRadius: 5.5,
                ringPropagationSpeed: 1.8,
                ringRepeatPeriod: 740
            });
        } catch (glowError) {
            console.warn('refreshRoadmap public landing event skipped:', glowError?.message || glowError);
        }

        return res.json({
            success: true,
            roadmapId: plannerResult.roadmapId,
            createdByModel: plannerResult.createdByModel,
            home: plannerResult.homePayload
        });
    } catch (error) {
        console.error('Refresh Roadmap Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while refreshing roadmap.'
        });
    }
};

function trimCoachText(value, max = 220) {
    return sanitize(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildAcademyCoachCompactPayload(payload = {}) {
    const history = (Array.isArray(payload.previousMessages) ? payload.previousMessages : [])
        .slice(-6)
        .map((item) => ({
            role: sanitize(item?.role) === 'assistant' ? 'assistant' : 'user',
            text: trimCoachText(item?.text, 220)
        }))
        .filter((item) => item.text);

    const missions = (Array.isArray(payload.missions) ? payload.missions : [])
        .slice(0, 5)
        .map((item) => ({
            title: trimCoachText(item?.title, 140),
            description: trimCoachText(item?.description, 220),
            pillar: trimCoachText(item?.pillar, 80),
            status: trimCoachText(item?.status, 40),
            dueDate: trimCoachText(item?.dueDate, 40),
            estimatedMinutes: toInt(item?.estimatedMinutes, 0)
        }))
        .filter((item) => item.title || item.description);

    const recentCheckins = (Array.isArray(payload.recentCheckins) ? payload.recentCheckins : [])
        .slice(-4)
        .map((item) => ({
            energyScore: toInt(item?.energyScore, 0),
            focusScore: toInt(item?.focusScore, 0),
            confidenceScore: toInt(item?.confidenceScore, 0),
            blockerText: trimCoachText(item?.blockerText, 180),
            winText: trimCoachText(item?.winText, 180),
            createdAt: sanitize(item?.createdAt || '')
        }));

    return {
        contextHint: sanitize(payload.contextHint || ''),
        userMessage: trimCoachText(payload.message || '', 800),
        profile: {
            topPriorityPillar: trimCoachText(payload?.profile?.topPriorityPillar, 120),
            next30DaysWin: trimCoachText(payload?.profile?.next30DaysWin, 220),
            biggestImmediateProblem: trimCoachText(payload?.profile?.biggestImmediateProblem, 220),
            preferredWorkStyle: trimCoachText(payload?.profile?.preferredWorkStyle, 120),
            accountabilityStyle: trimCoachText(payload?.profile?.accountabilityStyle, 120),
            firstQuickWin: trimCoachText(payload?.profile?.firstQuickWin, 220),
            energyScore: toInt(payload?.profile?.energyScore, 0),
            weeklyHours: toInt(payload?.profile?.weeklyHours, 0)
        },
        roadmap: {
            id: sanitize(payload?.roadmap?.id || ''),
            goal: trimCoachText(payload?.roadmap?.goal, 220),
            summary: trimCoachText(payload?.roadmap?.summary, 320),
            coachBrief: trimCoachText(payload?.roadmap?.coachBrief, 320),
            focusAreas: Array.isArray(payload?.roadmap?.focusAreas)
                ? payload.roadmap.focusAreas.map((item) => trimCoachText(item, 80)).filter(Boolean).slice(0, 5)
                : []
        },
        weeklyCheckpoint: {
            theme: trimCoachText(payload?.weeklyCheckpoint?.theme, 140),
            targetOutcome: trimCoachText(payload?.weeklyCheckpoint?.targetOutcome, 220)
        },
        missions,
        recentCheckins,
        behaviorProfile: {
            executionReliability: toFloat(payload?.behaviorProfile?.executionReliability, 0),
            frictionSensitivity: toFloat(payload?.behaviorProfile?.frictionSensitivity, 0),
            maxSustainableDailyMinutes: toInt(payload?.behaviorProfile?.maxSustainableDailyMinutes, 0),
            pressureResponse: trimCoachText(payload?.behaviorProfile?.pressureResponse, 40),
            accountabilityNeed: trimCoachText(payload?.behaviorProfile?.accountabilityNeed, 40),
            recoveryRisk: trimCoachText(payload?.behaviorProfile?.recoveryRisk, 40)
        },
        previousBehaviorProfile: {
            executionReliability: toFloat(payload?.previousBehaviorProfile?.executionReliability, 0),
            frictionSensitivity: toFloat(payload?.previousBehaviorProfile?.frictionSensitivity, 0),
            maxSustainableDailyMinutes: toInt(payload?.previousBehaviorProfile?.maxSustainableDailyMinutes, 0),
            pressureResponse: trimCoachText(payload?.previousBehaviorProfile?.pressureResponse, 40),
            accountabilityNeed: trimCoachText(payload?.previousBehaviorProfile?.accountabilityNeed, 40),
            recoveryRisk: trimCoachText(payload?.previousBehaviorProfile?.recoveryRisk, 40)
        },
        plannerStats: payload?.plannerStats && typeof payload.plannerStats === 'object'
            ? payload.plannerStats
            : {},
        adaptivePlanning: payload?.adaptivePlanning && typeof payload.adaptivePlanning === 'object'
            ? payload.adaptivePlanning
            : {},
        plannerRun: payload?.plannerRun && typeof payload.plannerRun === 'object'
            ? payload.plannerRun
            : {},
        conversationHistory: history
    };
}

function getAcademyCoachModeMeta(payload = {}) {
    const focusCandidate = sanitize(
        payload?.roadmap?.focusAreas?.[0] ||
        payload?.profile?.topPriorityPillar ||
        ''
    ).toLowerCase();

    const map = {
        politics: 'politics',
        politics_2030_agenda: 'politics',
        'politics & the 2030 agenda': 'politics',
        philosophy: 'philosophy'
    };

    const key = map[focusCandidate] || 'general';

    if (key === 'politics') {
        return {
            key,
            title: 'Political Analyst Coach',
            systemGuidance: [
                'Coach mode is Political Analyst Coach.',
                'Speak like a sharp political analyst and execution mentor, not like a generic productivity bot.',
                'Help the user think through actors, incentives, institutions, narratives, timelines, source quality, policy tradeoffs, and second-order effects.',
                'When the user asks about a political topic in their roadmap, guide them toward structure, clarity, comparison, and political reasoning.',
                'Do not drift into vague motivational talk or partisan ranting.',
                'Keep the advice tied to the existing roadmap, missions, weekly checkpoint, and current execution constraints.'
            ].join(' '),
            replyStructureInstruction: 'When it materially improves clarity, format the answer in 4 to 5 short labeled lines using this style: Actors: ... Incentives: ... Narrative: ... Next move: ... You may also include Main direction: ... before those labels when useful.',
            fallbackPrefix: 'I’m using the local Political Analyst Coach fallback right now, so here is the clearest next move based on your saved roadmap.',
            lowEnergyLine: 'Your energy looks low, so keep the next action light: do one short issue map, source comparison, or actor breakdown in about 15 to 20 minutes.',
            standardLine: 'Approach the next step like an analyst: choose one concrete issue, break it into actors, incentives, timeline, and competing narratives, then finish that small output today.',
            weeklyLinePrefix: 'Make sure the work sharpens this political outcome'
        };
    }

    if (key === 'philosophy') {
        return {
            key,
            title: 'Reasoning & Reflection Mentor',
            systemGuidance: [
                'Coach mode is Reasoning and Reflection Mentor.',
                'Speak like a clear reasoning mentor who helps the user define terms, test assumptions, map arguments, reflect carefully, and apply ideas to life.',
                'When the user asks about a philosophy topic in their roadmap, guide them toward conceptual precision, argument clarity, and reflective application.',
                'Do not drift into empty inspiration, vague wisdom, or generic self-help talk.',
                'Keep the advice tied to the existing roadmap, missions, weekly checkpoint, and current execution constraints.'
            ].join(' '),
            replyStructureInstruction: 'When it materially improves clarity, format the answer in 4 to 5 short labeled lines using this style: Claim: ... Assumption: ... Objection: ... Reflection: ... Next move: ... You may also include Main direction: ... before those labels when useful.',
            fallbackPrefix: 'I’m using the local Reasoning and Reflection Mentor fallback right now, so here is the clearest next move based on your saved roadmap.',
            lowEnergyLine: 'Your energy looks low, so keep the next action light: do one short concept definition, argument sketch, or reflection in about 15 to 20 minutes.',
            standardLine: 'Approach the next step like a reasoning exercise: define the core question, isolate one claim, test its assumptions, and finish one clear written output today.',
            weeklyLinePrefix: 'Make sure the work sharpens this perspective outcome'
        };
    }

    return {
        key: 'general',
        title: 'Academy AI Coach',
        systemGuidance: 'Stay practical, direct, tactical, and roadmap-grounded.',
        replyStructureInstruction: 'Only use a labeled mini-structure when it genuinely improves clarity. Otherwise reply normally.',
        fallbackPrefix: 'I’m using the local Academy Coach fallback right now, so here is the clearest next move based on your saved roadmap.',
        lowEnergyLine: 'Your energy looks low, so keep the next action light and finish something that takes about 15 to 20 minutes.',
        standardLine: 'Pick one concrete task you can fully finish today instead of trying to push the whole roadmap at once.',
        weeklyLinePrefix: 'Make sure the work moves this weekly outcome forward'
    };
}

function detectAcademyCoachReplyFormat(payload = {}, reply = '') {
    const coachMode = getAcademyCoachModeMeta(payload);
    const text = sanitize(reply || '');

    const hasPoliticsStructure =
        /(^|\n)\s*Actors\s*:/i.test(text) ||
        /(^|\n)\s*Incentives\s*:/i.test(text) ||
        /(^|\n)\s*Narrative\s*:/i.test(text);

    const hasPhilosophyStructure =
        /(^|\n)\s*Claim\s*:/i.test(text) ||
        /(^|\n)\s*Assumption\s*:/i.test(text) ||
        /(^|\n)\s*Objection\s*:/i.test(text) ||
        /(^|\n)\s*Reflection\s*:/i.test(text);

    if (coachMode.key === 'politics' && hasPoliticsStructure) {
        return 'politics_structured';
    }

    if (coachMode.key === 'philosophy' && hasPhilosophyStructure) {
        return 'philosophy_structured';
    }

    return 'general';
}

function buildAcademyCoachMessages(payload = {}) {
    const compactPayload = buildAcademyCoachCompactPayload(payload);
    const coachMode = getAcademyCoachModeMeta(payload);

    return [
        {
            role: 'system',
            content: [
                `You are the ${coachMode.title} for Young Hustlers.`,
                'Your job is to help the user execute their existing roadmap, not replace it.',
                'Stay grounded in the active roadmap, recent missions, recent check-ins, behavior signals, planner stats, and adaptive planning context.',
                coachMode.systemGuidance,
                coachMode.replyStructureInstruction,
                'Be practical, direct, tactical, and execution-focused.',
                'Prioritize what the user should do today or this week.',
                'If the user is stuck, simplify the next action without becoming vague.',
                'If the user has low energy or low time, adapt the advice accordingly.',
                'If a major strategic change is needed, say so and recommend a roadmap refresh instead of silently rewriting the full roadmap in chat.',
                'Do not output generic hype or filler.',
                'Do not contradict the existing roadmap unless there is a clear reason.',
                'Keep answers concise but useful.',
                'Keep any labeled structure short, readable, and directly tied to the current roadmap or mission context.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                ...compactPayload,
                coachMode: {
                    key: coachMode.key,
                    title: coachMode.title
                }
            })
        }
    ];
}

function buildLocalAcademyCoachFallback(payload = {}, error = null) {
    const coachMode = getAcademyCoachModeMeta(payload);
    const missions = Array.isArray(payload.missions) ? payload.missions : [];
    const nextMission =
        missions.find((item) => sanitize(item?.status).toLowerCase() !== 'completed') ||
        missions[0] ||
        null;

    const recentCheckins = Array.isArray(payload.recentCheckins) ? payload.recentCheckins : [];
    const latestCheckin = recentCheckins[recentCheckins.length - 1] || recentCheckins[0] || {};
    const energyScore = toInt(
        latestCheckin?.energyScore ?? payload?.profile?.energyScore,
        0
    );

    const roadmapDirection = trimCoachText(
        payload?.roadmap?.goal ||
        payload?.roadmap?.summary ||
        payload?.roadmap?.coachBrief,
        240
    );

    const weeklyTarget = trimCoachText(
        payload?.weeklyCheckpoint?.targetOutcome,
        180
    );

    const nextMissionTitle = trimCoachText(nextMission?.title, 140);
    const nextMissionDescription = trimCoachText(nextMission?.description, 200);
    const nextMissionMinutes = toInt(nextMission?.estimatedMinutes, 0);

    const replyLines = [coachMode.fallbackPrefix];

    if (coachMode.key === 'politics') {
        if (roadmapDirection) {
            replyLines.push(`Main direction: ${roadmapDirection}.`);
        }

        replyLines.push(
            `Actors: ${nextMissionTitle || 'Identify the main actors tied to the current political issue or mission.'}`
        );

        replyLines.push(
            energyScore > 0 && energyScore <= 4
                ? 'Incentives: Keep it light today. Focus on one short issue map, source comparison, or actor breakdown only.'
                : 'Incentives: Look for what each actor, bloc, institution, or source stands to gain, protect, or avoid.'
        );

        replyLines.push(
            `Narrative: ${nextMissionDescription || 'Compare the competing frames around the issue and note what each side emphasizes or hides.'}`
        );

        let nextMoveLine = 'Next move: Finish one short political output today.';
        if (nextMissionTitle) {
            nextMoveLine = `Next move: ${nextMissionTitle}.`;
            if (nextMissionMinutes > 0) {
                nextMoveLine += ` Aim to finish it in about ${nextMissionMinutes} minutes.`;
            }
        }
        replyLines.push(nextMoveLine);

        if (weeklyTarget) {
            replyLines.push(`${coachMode.weeklyLinePrefix}: ${weeklyTarget}.`);
        }
    } else if (coachMode.key === 'philosophy') {
        if (roadmapDirection) {
            replyLines.push(`Main direction: ${roadmapDirection}.`);
        }

        replyLines.push(
            `Claim: ${nextMissionTitle || 'State the core idea, question, or position you are trying to examine.'}`
        );

        replyLines.push(
            energyScore > 0 && energyScore <= 4
                ? 'Assumption: Keep it light today. Pick one assumption only and test it in a very short note.'
                : 'Assumption: Ask what belief, definition, or hidden premise the claim depends on.'
        );

        replyLines.push(
            `Objection: ${nextMissionDescription || 'Name one reasonable challenge, weakness, counterexample, or alternative view.'}`
        );

        replyLines.push(
            weeklyTarget
                ? `Reflection: Relate the idea back to this perspective outcome — ${weeklyTarget}.`
                : 'Reflection: Write what this changes in the way you think, judge, or act.'
        );

        let nextMoveLine = 'Next move: Finish one short philosophy output today.';
        if (nextMissionTitle) {
            nextMoveLine = `Next move: ${nextMissionTitle}.`;
            if (nextMissionMinutes > 0) {
                nextMoveLine += ` Aim to finish it in about ${nextMissionMinutes} minutes.`;
            }
        }
        replyLines.push(nextMoveLine);
    } else {
        if (roadmapDirection) {
            replyLines.push(`Main direction: ${roadmapDirection}.`);
        }

        replyLines.push(
            energyScore > 0 && energyScore <= 4
                ? coachMode.lowEnergyLine
                : coachMode.standardLine
        );

        if (nextMissionTitle) {
            let nextStep = `Next move: ${nextMissionTitle}.`;

            if (nextMissionDescription) {
                nextStep += ` ${nextMissionDescription}`;
            }

            if (nextMissionMinutes > 0) {
                nextStep += ` Aim to finish it in about ${nextMissionMinutes} minutes.`;
            }

            replyLines.push(nextStep);
        }

        if (weeklyTarget) {
            replyLines.push(`${coachMode.weeklyLinePrefix}: ${weeklyTarget}.`);
        }
    }

    if (error?.message) {
        replyLines.push('The live Gemini request did not complete, but your conversation is still saved and the coach can continue from here.');
    }

    return replyLines.join('\n').trim();
}

async function requestGeminiAcademyCoach(payload = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || typeof fetch !== 'function') {
        throw new Error('Gemini AI Coach is not configured.');
    }

    const model = sanitize(
        process.env.GEMINI_COACH_MODEL ||
        process.env.GEMINI_PLANNER_MODEL ||
        process.env.ACADEMY_PLANNER_MODEL ||
        'gemini-2.5-flash'
    ) || 'gemini-2.5-flash';

    const requestBody = {
        model,
        messages: buildAcademyCoachMessages(payload),
        temperature: 0.5
    };

    const reasoningEffort = sanitize(
        process.env.GEMINI_COACH_REASONING_EFFORT ||
        process.env.GEMINI_PLANNER_REASONING_EFFORT ||
        process.env.ACADEMY_PLANNER_REASONING_EFFORT ||
        ''
    );

    if (reasoningEffort) {
        requestBody.reasoning_effort = reasoningEffort;
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    const rawBody = await response.text();
    const data = safeJsonParse(rawBody, {});

    if (!response.ok) {
        throw new Error(
            trimCoachText(
                data?.error?.message || rawBody || 'Gemini AI Coach request failed.',
                400
            )
        );
    }

    const message = data?.choices?.[0]?.message;
    if (!message) {
        throw new Error('Gemini AI Coach returned no message.');
    }

    const rawContent = typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
            ? message.content.map((part) => part?.text || '').join('')
            : '';

    const reply = sanitize(rawContent || '').trim();

    if (!reply) {
        throw new Error('Gemini AI Coach returned an empty reply.');
    }

    return {
        reply,
        provider: 'gemini',
        model
    };
}

exports.getAcademyCoachMessages = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const conversationId = sanitize(req.query?.conversationId || 'coach_main') || 'coach_main';
        const messages = await academyFirestoreRepo.listCoachMessages(uid, conversationId, 30);

        return res.json({
            success: true,
            conversationId,
            messages
        });
    } catch (error) {
        console.error('getAcademyCoachMessages error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Academy AI Coach messages.'
        });
    }
};

exports.chatWithAcademyCoach = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const access = await requireApprovedRoadmapAccess(uid, res);
        if (!access) return;

        const conversationId = sanitize(req.body?.conversationId || 'coach_main') || 'coach_main';
        const message = sanitize(req.body?.message || '');
        const contextHint = sanitize(req.body?.contextHint || '');

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required.'
            });
        }

        const [profileDoc, homePayload, plannerRun, history] = await Promise.all([
            academyFirestoreRepo.getCurrentProfile(uid),
            academyFirestoreRepo.buildAcademyHomePayload(uid),
            academyFirestoreRepo.getLatestPlannerRun(uid),
            academyFirestoreRepo.listCoachMessages(uid, conversationId, 12)
        ]);

        if (!homePayload?.roadmap?.id) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found for Academy AI Coach.'
            });
        }

        const recentCheckins = await academyFirestoreRepo.listRecentCheckins(uid, homePayload.roadmap.id, 4);

        await academyFirestoreRepo.createCoachMessage(uid, {
            conversationId,
            role: 'user',
            text: message,
            contextHint
        });

        const coachPayload = {
            message,
            contextHint,
            previousMessages: history,
            profile: profileDoc && typeof profileDoc === 'object'
                ? {
                    ...normalizeProfile(profileDoc),
                    topPriorityPillar: sanitize(profileDoc?.topPriorityPillar || ''),
                    next30DaysWin: sanitize(profileDoc?.next30DaysWin || ''),
                    biggestImmediateProblem: sanitize(profileDoc?.biggestImmediateProblem || ''),
                    preferredWorkStyle: sanitize(profileDoc?.preferredWorkStyle || ''),
                    accountabilityStyle: sanitize(profileDoc?.accountabilityStyle || ''),
                    firstQuickWin: sanitize(profileDoc?.firstQuickWin || '')
                }
                : {},
            roadmap: homePayload?.roadmap || {},
            weeklyCheckpoint: homePayload?.weeklyCheckpoint || {},
            missions: Array.isArray(homePayload?.missions) ? homePayload.missions : [],
            recentCheckins,
            behaviorProfile: homePayload?.behaviorProfile || {},
            previousBehaviorProfile: homePayload?.previousBehaviorProfile || {},
            plannerStats: homePayload?.plannerStats || {},
            adaptivePlanning: homePayload?.adaptivePlanning || {},
            plannerRun: plannerRun
                ? {
                    id: plannerRun.id,
                    provider: plannerRun.provider,
                    model: plannerRun.model,
                    mode: plannerRun.mode,
                    outputSummary: plannerRun.outputSummary || {},
                    resultMetrics: plannerRun.resultMetrics || {}
                }
                : {}
        };

        let aiResult;
        try {
            aiResult = await requestGeminiAcademyCoach(coachPayload);
        } catch (coachError) {
            console.error('requestGeminiAcademyCoach error:', coachError);
            aiResult = {
                reply: buildLocalAcademyCoachFallback(coachPayload, coachError),
                provider: 'academy-fallback',
                model: 'rule-based-coach-v1',
                fallback: true
            };
        }

        const coachMode = getAcademyCoachModeMeta(coachPayload);
        const replyFormat = detectAcademyCoachReplyFormat(coachPayload, aiResult.reply);

        const grounding = {
            usedRoadmap: true,
            usedMissions: Array.isArray(homePayload?.missions) && homePayload.missions.length > 0,
            usedCheckins: Array.isArray(recentCheckins) && recentCheckins.length > 0,
            usedFallback: aiResult.fallback === true,
            coachModeKey: coachMode.key || 'general',
            replyFormat
        };

        await academyFirestoreRepo.createCoachMessage(uid, {
            conversationId,
            role: 'assistant',
            text: aiResult.reply,
            contextHint,
            provider: aiResult.provider,
            model: aiResult.model,
            replyFormat,
            coachModeKey: coachMode.key || 'general',
            responseStyleVersion: 'coach-format-v1',
            grounding
        });

        return res.json({
            success: true,
            reply: aiResult.reply,
            conversationId,
            provider: aiResult.provider,
            model: aiResult.model,
            replyFormat,
            coachModeKey: coachMode.key || 'general',
            responseStyleVersion: 'coach-format-v1',
            grounding,
            fallback: aiResult.fallback === true
        });
    } catch (error) {
        console.error('chatWithAcademyCoach error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to get Academy AI Coach reply.'
        });
    }
};
function normalizeLeadMissionPayload(body = {}) {
    const sellerPriceAmount = Math.max(0, toFloat(body.sellerPriceAmount, 0));
    const universeCommissionRate = Math.max(0, Math.min(100, toFloat(body.universeCommissionRate, 20)));
    const saleEnabledRaw = sanitize(body.saleEnabled).toLowerCase();

    return {
        tier: sanitize(body.tier),
        companyName: sanitize(body.companyName),
        companyWebsite: sanitize(body.companyWebsite),
        contactName: sanitize(body.contactName),
        contactRole: sanitize(body.contactRole),
        contactType: sanitize(body.contactType || 'unknown'),
        email: sanitize(body.email),
        phone: sanitize(body.phone),
        city: sanitize(body.city),
        country: sanitize(body.country),
        sourceMethod: sanitize(body.sourceMethod),
        callOutcome: sanitize(body.callOutcome),
        interestLevel: sanitize(body.interestLevel),
        rapportLevel: sanitize(body.rapportLevel),
        pipelineStage: sanitize(body.pipelineStage),
        priority: sanitize(body.priority),
        nextAction: sanitize(body.nextAction),
        channel: sanitize(body.channel),
        taskStatus: sanitize(body.taskStatus),
        callType: sanitize(body.callType),
        objection: sanitize(body.objection),
        notes: sanitize(body.notes),
        followUpDueDate: sanitize(body.followUpDueDate),

        sellerPriceAmount,
        currency: sanitize(body.currency || 'USD').toUpperCase() || 'USD',
        universeCommissionRate,
        saleEnabled:
            saleEnabledRaw === 'true' ||
            saleEnabledRaw === 'on' ||
            sellerPriceAmount > 0
    };
}

exports.listAcademyOpportunityMissions = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const [plazaSnap, federationSnap] = await Promise.all([
            firestore.collection('plazaOpportunities').limit(150).get(),
            firestore.collection('federationDealRooms').limit(150).get()
        ]);

        const plazaOpportunities = plazaSnap.docs
            .map((docSnap) => mapPlazaOpportunityToAcademyMission(docSnap))
            .filter((item) => {
                const status = String(item.status || '').trim().toLowerCase();
                const type = String(item.type || '').trim().toLowerCase();

                const isActive = status === 'active';
                const isJobLike = [
                    'job opportunity',
                    'hire talent',
                    'operator bounty',
                    'hiring',
                    'service request',
                    'project opening',
                    'collaboration',
                    'partnership'
                ].includes(type);

                return isActive && isJobLike;
            });

        const federationTasks = federationSnap.docs
            .map((docSnap) => mapFederationDealRoomToAcademyMission(docSnap))
            .filter((item) => {
                const status = String(item.status || '').trim().toLowerCase();
                const hasAcademyNeed = Boolean(String(item.academyMissionNeed || '').trim());

                return hasAcademyNeed && ['approved', 'in_discussion', 'commission_due'].includes(status);
            });

        const opportunityMissions = [...plazaOpportunities, ...federationTasks]
            .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

        return res.json({
            success: true,
            opportunityMissions,
            summary: {
                total: opportunityMissions.length,
                plaza: plazaOpportunities.length,
                federation: federationTasks.length
            }
        });
    } catch (error) {
        console.error('listAcademyOpportunityMissions error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Academy Opportunity Missions.'
        });
    }
};
exports.getLeadMissionsWorkspace = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const [leads, followUps, payouts, deals, scripts] = await Promise.all([
            academyFirestoreRepo.listLeadMissionLeads(uid),
            academyFirestoreRepo.listLeadMissionFollowUps(uid),
            academyFirestoreRepo.listLeadMissionPayouts(uid),
            academyFirestoreRepo.listLeadMissionDeals(uid),
            academyFirestoreRepo.getLeadMissionScripts(uid)
        ]);

        return res.json({
            success: true,
            meta: {
                operatorName: sanitize(req.user?.name || req.user?.username || 'Operator'),
                readmeNote: 'Your Lead Missions records are private to you and admin.'
            },
            leads,
            followUps,
            payouts,
            deals,
            scripts
        });
    } catch (error) {
        console.error('getLeadMissionsWorkspace error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Lead Missions workspace.'
        });
    }
};
exports.submitRoutedLeadMission = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);
        const leadId = sanitize(req.params?.id);
        const body = req.body || {};

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        if (!leadId) {
            return res.status(400).json({
                success: false,
                message: 'Mission id is required.'
            });
        }

        const existingLead = await academyFirestoreRepo.getLeadMissionLeadById(uid, leadId);

        if (!existingLead) {
            return res.status(404).json({
                success: false,
                message: 'Assigned mission not found.'
            });
        }

        const isRoutedMission =
            existingLead.routedFromAdmin === true ||
            String(existingLead.sourceMethod || '').trim().toLowerCase().startsWith('admin_routed_') ||
            String(existingLead.callType || '').trim().toLowerCase() === 'opportunity_mission' ||
            Boolean(String(existingLead.assignmentStatus || '').trim());

        if (!isRoutedMission) {
            return res.status(400).json({
                success: false,
                message: 'Only admin-routed Academy missions can be submitted here.'
            });
        }

        const completionProof = sanitize(body.completionProof || body.proof || body.note).slice(0, 2500);

        if (!completionProof) {
            return res.status(400).json({
                success: false,
                message: 'Completion proof is required.'
            });
        }

        const now = new Date().toISOString();

        const currentNotes = sanitize(existingLead.notes || '');
        const nextNotes = [
            currentNotes,
            `Submission proof (${now}):\n${completionProof}`
        ].filter(Boolean).join('\n\n');

        const updatedLead = await academyFirestoreRepo.updateLeadMissionLead(uid, leadId, {
            taskStatus: 'submitted',
            pipelineStage: 'submitted',
            callOutcome: 'Submitted for admin review',
            nextAction: 'Waiting for admin review',
            notes: nextNotes,
            status: 'active'
        });

        await firestore
            .collection('users')
            .doc(uid)
            .collection('academyLeadMissions')
            .doc(leadId)
            .set({
                assignmentStatus: 'submitted',
                reviewStatus: 'pending_review',
                completionProof,
                submittedAt: Timestamp.now(),
                submittedByUid: uid,
                submittedByName: sanitize(req.user?.name || req.user?.username || 'Operator'),
                updatedAt: Timestamp.now()
            }, { merge: true });

        return res.json({
            success: true,
            message: 'Mission submitted for admin review.',
            lead: updatedLead
        });
    } catch (error) {
        console.error('submitRoutedLeadMission error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit assigned mission.'
        });
    }
};
exports.listMyLeadMissionsLeads = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const leads = await academyFirestoreRepo.listLeadMissionLeads(uid);

        return res.json({
            success: true,
            leads
        });
    } catch (error) {
        console.error('listMyLeadMissionsLeads error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load leads.'
        });
    }
};

exports.createLeadMissionLead = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const payload = normalizeLeadMissionPayload(req.body || {});

        if (!payload.tier || !payload.companyName) {
            return res.status(400).json({
                success: false,
                message: 'Tier and company name are required.'
            });
        }

        const lead = await academyFirestoreRepo.createLeadMissionLead(uid, payload);

        return res.status(201).json({
            success: true,
            lead
        });
    } catch (error) {
        console.error('createLeadMissionLead error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create lead.'
        });
    }
};

exports.getMyLeadMissionLeadById = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);
        const leadId = sanitize(req.params?.id);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const lead = await academyFirestoreRepo.getLeadMissionLeadById(uid, leadId);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found.'
            });
        }

        return res.json({
            success: true,
            lead
        });
    } catch (error) {
        console.error('getMyLeadMissionLeadById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load lead.'
        });
    }
};

exports.updateMyLeadMissionLead = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);
        const leadId = sanitize(req.params?.id);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const payload = normalizeLeadMissionPayload(req.body || {});
        const lead = await academyFirestoreRepo.updateLeadMissionLead(uid, leadId, payload);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found.'
            });
        }

        return res.json({
            success: true,
            lead
        });
    } catch (error) {
        console.error('updateMyLeadMissionLead error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update lead.'
        });
    }
};

exports.listMyLeadMissionsFollowUps = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const followUps = await academyFirestoreRepo.listLeadMissionFollowUps(uid);

        return res.json({
            success: true,
            followUps
        });
    } catch (error) {
        console.error('listMyLeadMissionsFollowUps error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load follow-ups.'
        });
    }
};

exports.listMyLeadMissionPayouts = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const payouts = await academyFirestoreRepo.listLeadMissionPayouts(uid);

        return res.json({
            success: true,
            payouts
        });
    } catch (error) {
        console.error('listMyLeadMissionPayouts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load payouts.'
        });
    }
};

exports.listMyLeadMissionDeals = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const deals = await academyFirestoreRepo.listLeadMissionDeals(uid);

        return res.json({
            success: true,
            deals
        });
    } catch (error) {
        console.error('listMyLeadMissionDeals error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load deals.'
        });
    }
};

exports.getLeadMissionScripts = async (req, res) => {
    try {
        const uid = getAcademyAuthUid(req);

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const scripts = await academyFirestoreRepo.getLeadMissionScripts(uid);

        return res.json({
            success: true,
            scripts
        });
    } catch (error) {
        console.error('getLeadMissionScripts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load scripts.'
        });
    }
};