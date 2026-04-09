const academyFirestoreRepo = require('./backend/repositories/academyFirestoreRepo');
const academyPlannerKnowledgeContext = require('./backend/services/academyPlannerKnowledgeContext');
const publicLandingEventsRepo = require('./backend/repositories/publicLandingEventsRepo');
const { firestore } = require('./config/firebaseAdmin');
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

function buildFallbackRoadmap(profile, context = {}) {
    const focusAreas = [];
    const bottlenecks = [];
    const strengths = [];

    let readinessScore = 60;

    const priorityMap = {
        money: 'wealth',
        business: 'wealth',
        discipline: 'discipline',
        health: 'health',
        mindset: 'mindset',
        communication: 'communication'
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

    const missions = [
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
            mainOpportunity,
            strengths: uniqueStrengths
        },
        focusAreas: uniqueFocusAreas,
        roadmap: {
            goal: profile.goals6mo || 'Stabilize structure, improve energy, and create measurable forward movement.',
            coachTone: profile.coachTone || 'balanced',
            weeklyTheme: recentStuck > 0 ? 'Friction Reduction' : 'Execution Structure',
            weeklyTargetOutcome: profile.next30DaysWin || (recentStuck > 0 ? 'Finish blocked work in smaller steps' : 'Create visible forward progress this week'),
            coachBrief: doctrine.coachBrief,
            weeklyOperatingSystem: doctrine.weeklyOperatingSystem,
            recommendedResources: doctrine.recommendedResources,
            days30: {
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
                        whyItMatters: { type: 'string' },
                        frequency: { type: 'string', enum: ['daily', 'weekly', 'one-off'] },
                        dueDate: { type: 'string' },
                        estimatedMinutes: { type: 'integer', minimum: 5, maximum: 180 },
                        sortOrder: { type: 'integer', minimum: 1, maximum: 10 }
                    },
                    required: ['pillar', 'title', 'description', 'whyItMatters', 'frequency', 'dueDate', 'estimatedMinutes', 'sortOrder']
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

    return [
        {
            role: 'system',
            content: [
                'You are the Academy planner for Young Hustlers.',
                'Generate a realistic, hard-nosed, supportive roadmap for the user.',
                'Use the full intake profile, especially age range, reason for joining now, top priority pillar, biggest immediate problem, current routine, preferred work style, accountability style, next-30-days win, extra context, energy, time, seriousness, money reality, and past execution behavior.',
                'Do not produce generic motivation fluff.',
                'Prefer missions that are specific, actionable, measurable, and realistically completable.',
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

function normalizeGeneratedMission(mission = {}, context = {}) {
    const maxDailyMinutes = Math.max(
        15,
        toInt(context?.behaviorProfile?.maxSustainableDailyMinutes, 0) || 45
    );

    return {
        pillar: sanitize(mission.pillar),
        title: sanitize(mission.title),
        description: sanitize(mission.description),
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
            knowledge_for_life: 'Knowledge for Life'
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

function buildAcademyCoachMessages(payload = {}) {
    const compactPayload = buildAcademyCoachCompactPayload(payload);

    return [
        {
            role: 'system',
            content: [
                'You are the Academy AI Coach for Young Hustlers.',
                'Your job is to help the user execute their existing roadmap, not replace it.',
                'Stay grounded in the active roadmap, recent missions, recent check-ins, behavior signals, planner stats, and adaptive planning context.',
                'Be practical, direct, tactical, and execution-focused.',
                'Prioritize what the user should do today or this week.',
                'If the user is stuck, simplify the next action without becoming vague.',
                'If the user has low energy or low time, adapt the advice accordingly.',
                'If a major strategic change is needed, say so and recommend a roadmap refresh instead of silently rewriting the full roadmap in chat.',
                'Do not output generic hype or filler.',
                'Do not contradict the existing roadmap unless there is a clear reason.',
                'Keep answers concise but useful.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify(compactPayload)
        }
    ];
}

function buildLocalAcademyCoachFallback(payload = {}, error = null) {
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

    const replyParts = [
        'I’m using the local Academy Coach fallback right now, so here is the clearest next move based on your saved roadmap.'
    ];

    if (roadmapDirection) {
        replyParts.push(`Main direction: ${roadmapDirection}.`);
    }

    if (energyScore > 0 && energyScore <= 4) {
        replyParts.push('Your energy looks low, so keep the next action light and finish something that takes about 15 to 20 minutes.');
    } else {
        replyParts.push('Pick one concrete task you can fully finish today instead of trying to push the whole roadmap at once.');
    }

    if (nextMission?.title) {
        let nextStep = `Do this next: ${trimCoachText(nextMission.title, 140)}.`;

        if (nextMission?.description) {
            nextStep += ` ${trimCoachText(nextMission.description, 200)}`;
        }

        if (toInt(nextMission?.estimatedMinutes, 0) > 0) {
            nextStep += ` Aim to finish it in about ${toInt(nextMission.estimatedMinutes, 0)} minutes.`;
        }

        replyParts.push(nextStep);
    }

    if (weeklyTarget) {
        replyParts.push(`Make sure the work moves this weekly outcome forward: ${weeklyTarget}.`);
    }

    if (error?.message) {
        replyParts.push('The live Gemini request did not complete, but your conversation is still saved and the coach can continue from here.');
    }

    return replyParts.join(' ').trim();
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

        const grounding = {
            usedRoadmap: true,
            usedMissions: Array.isArray(homePayload?.missions) && homePayload.missions.length > 0,
            usedCheckins: Array.isArray(recentCheckins) && recentCheckins.length > 0,
            usedFallback: aiResult.fallback === true
        };

        await academyFirestoreRepo.createCoachMessage(uid, {
            conversationId,
            role: 'assistant',
            text: aiResult.reply,
            contextHint,
            provider: aiResult.provider,
            model: aiResult.model,
            grounding
        });

        return res.json({
            success: true,
            reply: aiResult.reply,
            conversationId,
            provider: aiResult.provider,
            model: aiResult.model,
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