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
        estimatedMinutes: toInt(mission.estimatedMinutes || mission.estimated_minutes, 0)
    }));

    const recentCheckins = (context.recentCheckins || []).map((checkin) => ({
        energyScore: toInt(checkin.energyScore || checkin.energy_score, 0),
        moodScore: toInt(checkin.moodScore || checkin.mood_score, 0),
        completedSummary: sanitize(checkin.completedSummary || checkin.completed_summary || ''),
        blockerText: sanitize(checkin.blockerText || checkin.blocker_text || ''),
        tomorrowFocus: sanitize(checkin.tomorrowFocus || checkin.tomorrow_focus || '')
    }));

    const activeRoadmap = context.activeRoadmap || null;

    return [
        {
            role: 'system',
            content: [
                'You are the Academy planner for Young Hustlers.',
                'Generate a realistic, hard-nosed, supportive roadmap for the user.',
                'Use the full intake profile, especially age range, reason for joining now, top priority pillar, biggest immediate problem, current routine, preferred work style, accountability style, next-30-days win, extra context, energy, time, seriousness, money reality, and past execution behavior.',
                'Do not produce generic motivation fluff.',
                'Prefer missions that are specific, actionable, measurable, and realistically completable.',
                'If the user has low energy or low time, simplify the workload.',
                'If the user has repeated skips or stuck missions, reduce complexity and remove friction before increasing ambition.',
                'If the user names a top priority pillar, bias the roadmap and missions toward that pillar unless health or discipline is clearly the bigger blocker.',
                'At least one mission should support wealth or income movement when appropriate.',
                'Match the mission style to the user work style and accountability preference.',
                'Apply the founder doctrine when relevant.',
                `Founder doctrine principles: ${FOUNDER_DOCTRINE.principles.join(' | ')}`,
                'The doctrine is an operating standard, not generic hype.',
                'Always return a short founder-style coachBrief for the week.',
                'Always return weeklyOperatingSystem with the exact week structure and weekly review standard.',
                'Recommend founder resources only when clearly justified by the user bottleneck.',
                'If health, physical discipline, energy, or appearance-confidence is a real blocker, you may recommend The FaceMax Protocol.',
                `If you recommend The FaceMax Protocol, use this exact URL: ${FOUNDER_DOCTRINE.resources[0].url}`,
                'Do not recommend founder resources randomly or in every plan.',
                'If the user lacks structure, execution rhythm, or weekly review habits, reflect the 2812-style weekly operating system: week starts on Sunday, week review happens on Saturday, and repeating low-value tasks should be delegated, automated, or removed.',
                'Every recommended resource must include a concrete reason tied to the profile or recent execution behavior.',
                'Keep the missions operational. Put the philosophy in coachBrief and weeklyOperatingSystem, not as long speeches inside every mission.',
                'Return only schema-valid data.'
            ].join(' ')
        },
        {
            role: 'user',
            content: JSON.stringify({
                mode: sanitize(context.mode || 'initial'),
                profile,
                activeRoadmap,
                recentMissions,
                recentCheckins,
                founderDoctrine: FOUNDER_DOCTRINE
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

async function getLatestProfile(db, userId) {
    const row = await db.get(
        `SELECT *
         FROM academy_profiles
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [userId]
    );

    if (!row) return null;

    return {
        id: row.id,
        userId: row.user_id,
        ...normalizeProfile(row)
    };
}

async function getActiveRoadmapRecord(db, userId) {
    const row = await db.get(
        `SELECT id, profile_id, version, readiness_score, summary_json, roadmap_json, created_by_model, created_at
         FROM academy_roadmaps
         WHERE user_id = ? AND status = 'active'
         ORDER BY id DESC
         LIMIT 1`,
        [userId]
    );

    if (!row) return null;

    return {
        id: row.id,
        profileId: row.profile_id,
        version: row.version,
        readinessScore: row.readiness_score,
        summary: safeJsonParse(row.summary_json, {}),
        roadmap: safeJsonParse(row.roadmap_json, {}),
        createdByModel: row.created_by_model,
        createdAt: row.created_at
    };
}

async function getRecentMissionHistory(db, userId, roadmapId, limit = 8) {
    return db.all(
        `SELECT
            id, pillar, title, status,
            due_date AS dueDate,
            estimated_minutes AS estimatedMinutes,
            completion_note AS completionNote,
            completed_at AS completedAt
         FROM academy_missions
         WHERE user_id = ? AND roadmap_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [userId, roadmapId, limit]
    );
}

async function getRecentCheckins(db, userId, roadmapId, limit = 5) {
    return db.all(
        `SELECT
            energy_score AS energyScore,
            mood_score AS moodScore,
            completed_summary AS completedSummary,
            blocker_text AS blockerText,
            tomorrow_focus AS tomorrowFocus,
            created_at AS createdAt
         FROM academy_checkins
         WHERE user_id = ? AND roadmap_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [userId, roadmapId, limit]
    );
}

async function persistRoadmap(db, userId, profileId, plan, createdByModel) {
    const currentVersionRow = await db.get(
        `SELECT COALESCE(MAX(version), 0) AS maxVersion
         FROM academy_roadmaps
         WHERE user_id = ?`,
        [userId]
    );

    const nextVersion = toInt(currentVersionRow?.maxVersion, 0) + 1;

    await db.run(
        `UPDATE academy_roadmaps
         SET status = 'archived'
         WHERE user_id = ? AND status = 'active'`,
        [userId]
    );

    const roadmapInsert = await db.run(
        `INSERT INTO academy_roadmaps (
            user_id, profile_id, version, status, readiness_score, summary_json, roadmap_json, created_by_model
         ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
        [
            userId,
            profileId,
            nextVersion,
            plan.readinessScore,
            JSON.stringify({
                ...plan.summary,
                focusAreas: plan.focusAreas
            }),
            JSON.stringify(plan.roadmap),
            createdByModel
        ]
    );

    const roadmapId = roadmapInsert.lastID;

    for (const mission of plan.missions) {
        await db.run(
            `INSERT INTO academy_missions (
                user_id, roadmap_id, pillar, title, description, why_it_matters,
                frequency, due_date, estimated_minutes, status, source, sort_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                userId,
                roadmapId,
                mission.pillar,
                mission.title,
                mission.description,
                mission.whyItMatters,
                mission.frequency,
                mission.dueDate,
                mission.estimatedMinutes,
                createdByModel.includes('openai') ? 'ai' : 'rule',
                mission.sortOrder
            ]
        );
    }

    await db.run(
        `INSERT INTO academy_access (user_id, access_state, unlocked_at, last_assessed_at)
         VALUES (?, 'unlocked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
            access_state = 'unlocked',
            unlocked_at = COALESCE(academy_access.unlocked_at, CURRENT_TIMESTAMP),
            last_assessed_at = CURRENT_TIMESTAMP`,
        [userId]
    );

    return roadmapId;
}

async function buildAcademyHomePayload(db, userId, roadmapId = null) {
    const roadmapRow = roadmapId
        ? await db.get(
            `SELECT id, version, readiness_score, summary_json, roadmap_json, created_by_model
             FROM academy_roadmaps
             WHERE user_id = ? AND id = ?
             LIMIT 1`,
            [userId, roadmapId]
        )
        : await db.get(
            `SELECT id, version, readiness_score, summary_json, roadmap_json, created_by_model
             FROM academy_roadmaps
             WHERE user_id = ? AND status = 'active'
             ORDER BY id DESC
             LIMIT 1`,
            [userId]
        );

    if (!roadmapRow) return null;

    const missions = await db.all(
        `SELECT
            id, pillar, title, description,
            why_it_matters AS whyItMatters,
            status, frequency,
            due_date AS dueDate,
            estimated_minutes AS estimatedMinutes,
            completion_note AS completionNote
         FROM academy_missions
         WHERE user_id = ? AND roadmap_id = ?
         ORDER BY sort_order ASC, id ASC
         LIMIT 5`,
        [userId, roadmapRow.id]
    );

    const stats = await db.get(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
         FROM academy_missions
         WHERE user_id = ? AND roadmap_id = ?`,
        [userId, roadmapRow.id]
    );

    const recentCheckins = await db.get(
        `SELECT COUNT(*) AS streakDays
         FROM academy_checkins
         WHERE user_id = ?
           AND created_at >= datetime('now', '-7 day')`,
        [userId]
    );

    const summary = safeJsonParse(roadmapRow.summary_json, {});
    const roadmapJson = safeJsonParse(roadmapRow.roadmap_json, {});
    const weeklyOperatingSystem = roadmapJson.weeklyOperatingSystem && typeof roadmapJson.weeklyOperatingSystem === 'object'
        ? roadmapJson.weeklyOperatingSystem
        : {};
    const recommendedResources = Array.isArray(roadmapJson.recommendedResources)
        ? roadmapJson.recommendedResources
        : [];

    return {
        success: true,
        roadmap: {
            id: roadmapRow.id,
            version: roadmapRow.version,
            readinessScore: roadmapRow.readiness_score,
            focusAreas: summary.focusAreas || [],
            summary: {
                primaryBottleneck: summary.primaryBottleneck || '',
                secondaryBottleneck: summary.secondaryBottleneck || '',
                mainOpportunity: summary.mainOpportunity || '',
                strengths: summary.strengths || []
            },
            goal: roadmapJson.goal || '',
            coachTone: roadmapJson.coachTone || 'balanced',
            coachBrief: roadmapJson.coachBrief || '',
            weeklyOperatingSystem: {
                weekStartsOn: weeklyOperatingSystem.weekStartsOn || '',
                weeklyReviewDay: weeklyOperatingSystem.weeklyReviewDay || '',
                reviewInstruction: weeklyOperatingSystem.reviewInstruction || '',
                delegationRule: weeklyOperatingSystem.delegationRule || ''
            },
            recommendedResources: recommendedResources
        },
        weeklyCheckpoint: {
            theme: roadmapJson.weeklyTheme || '',
            targetOutcome: roadmapJson.weeklyTargetOutcome || ''
        },
        today: {
            missionsCompleted: stats?.completed || 0,
            missionsTotal: stats?.total || 0,
            streakDays: recentCheckins?.streakDays || 0
        },
        missions,
        createdByModel: roadmapRow.created_by_model || 'academy-rule-engine-v1'
    };
}

async function generateAndPersistPlan(db, userId, profile, options = {}) {
    const activeRoadmap = options.activeRoadmap || await getActiveRoadmapRecord(db, userId);
    const recentMissions = activeRoadmap ? await getRecentMissionHistory(db, userId, activeRoadmap.id) : [];
    const recentCheckins = activeRoadmap ? await getRecentCheckins(db, userId, activeRoadmap.id) : [];

    const context = {
        mode: options.mode || 'initial',
        activeRoadmap,
        recentMissions,
        recentCheckins
    };

    let plan = null;
    let createdByModel = 'academy-rule-engine-v1';

    try {
        const aiResult = await requestAiRoadmap(profile, context);
        if (aiResult?.plan) {
            plan = aiResult.plan;
            createdByModel = `${aiResult.provider}-${aiResult.model}`;
        }
    } catch (error) {
        console.error('Academy Planner Fallback:', error.message);
    }

    if (!plan) {
        plan = buildFallbackRoadmap(profile, context);
    }

    const normalizedPlan = normalizePlan(plan, profile, context);
    const roadmapId = await persistRoadmap(db, userId, profile.id, normalizedPlan, createdByModel);
    const homePayload = await buildAcademyHomePayload(db, userId, roadmapId);

    return {
        roadmapId,
        createdByModel,
        plan: normalizedPlan,
        homePayload
    };
}

exports.intakeProfile = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user?.id;

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const payload = normalizeProfile({
            city: req.body.city,
            country: req.body.country,
            occupationType: req.body.occupationType,
            currentJob: req.body.currentJob,
            industry: req.body.industry,
            monthlyIncomeRange: req.body.monthlyIncomeRange,
            savingsRange: req.body.savingsRange,
            incomeSource: req.body.incomeSource,
            businessStage: req.body.businessStage,
            sleepHours: req.body.sleepHours,
            energyScore: req.body.energyScore,
            exerciseFrequency: req.body.exerciseFrequency,
            stressScore: req.body.stressScore,
            badHabit: req.body.badHabit,
            seriousness: req.body.seriousness,
            weeklyHours: req.body.weeklyHours,
            goals6mo: req.body.goals6mo,
            blockerText: req.body.blockerText,
            coachTone: req.body.coachTone
        });

        if (!payload.country || !payload.currentJob || !payload.seriousness || !payload.goals6mo) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields for Academy intake.'
            });
        }

        const profileInsert = await db.run(
            `INSERT INTO academy_profiles (
                user_id, city, country, occupation_type, current_job, industry,
                monthly_income_range, savings_range, income_source, business_stage,
                sleep_hours, energy_score, exercise_frequency, stress_score, bad_habit,
                seriousness, weekly_hours, goals_6mo, blocker_text, coach_tone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                payload.city,
                payload.country,
                payload.occupationType,
                payload.currentJob,
                payload.industry,
                payload.monthlyIncomeRange,
                payload.savingsRange,
                payload.incomeSource,
                payload.businessStage,
                payload.sleepHours,
                payload.energyScore,
                payload.exerciseFrequency,
                payload.stressScore,
                payload.badHabit,
                payload.seriousness,
                payload.weeklyHours,
                payload.goals6mo,
                payload.blockerText,
                payload.coachTone
            ]
        );

        const profile = {
            id: profileInsert.lastID,
            userId,
            ...payload
        };

        const plannerResult = await generateAndPersistPlan(db, userId, profile, { mode: 'initial' });

        return res.json({
            success: true,
            accessState: 'unlocked',
            profileId: profile.id,
            roadmapId: plannerResult.roadmapId,
            readinessScore: plannerResult.plan.readinessScore,
            summary: plannerResult.plan.summary,
            focusAreas: plannerResult.plan.focusAreas,
            todayMissions: plannerResult.homePayload?.missions?.slice(0, 3) || [],
            createdByModel: plannerResult.createdByModel,
            home: plannerResult.homePayload
        });
    } catch (error) {
        console.error('Academy Intake Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while generating Academy roadmap.'
        });
    }
};

exports.getAcademyHome = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user?.id;

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const homePayload = await buildAcademyHomePayload(db, userId);
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
        const db = req.app.locals.db;
        const userId = req.user?.id;

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const roadmap = await getActiveRoadmapRecord(db, userId);

        if (!roadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found.'
            });
        }

        return res.json({
            success: true,
            roadmapId: roadmap.id,
            version: roadmap.version,
            readinessScore: roadmap.readinessScore,
            summary: roadmap.summary,
            roadmap: roadmap.roadmap,
            createdByModel: roadmap.createdByModel,
            createdAt: roadmap.createdAt
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
        const db = req.app.locals.db;
        const userId = req.user?.id;
        const scope = sanitize(req.query.scope || 'today').toLowerCase();
        const status = sanitize(req.query.status || '').toLowerCase();

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const activeRoadmap = await getActiveRoadmapRecord(db, userId);

        if (!activeRoadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active roadmap found for missions.'
            });
        }

        const filters = ['user_id = ?', 'roadmap_id = ?'];
        const params = [userId, activeRoadmap.id];

        if (status) {
            filters.push('status = ?');
            params.push(status);
        }

        if (scope === 'today') {
            filters.push('(due_date IS NULL OR due_date <= ?)');
            params.push(todayISO());
        }

        const missions = await db.all(
            `SELECT
                id, pillar, title, description, why_it_matters AS whyItMatters,
                frequency, due_date AS dueDate, estimated_minutes AS estimatedMinutes,
                status, completion_note AS completionNote
             FROM academy_missions
             WHERE ${filters.join(' AND ')}
             ORDER BY sort_order ASC, id ASC`,
            params
        );

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
        const db = req.app.locals.db;
        const userId = req.user?.id;
        const missionId = toInt(req.params.id, 0);
        const completionNote = sanitize(req.body.completionNote || '');

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const mission = await db.get(
            `SELECT id, roadmap_id
             FROM academy_missions
             WHERE id = ? AND user_id = ?`,
            [missionId, userId]
        );

        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission not found.'
            });
        }

        await db.run(
            `UPDATE academy_missions
             SET status = 'completed',
                 completion_note = ?,
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
            [completionNote, missionId, userId]
        );

        const progress = await db.get(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
             FROM academy_missions
             WHERE user_id = ? AND roadmap_id = ?`,
            [userId, mission.roadmap_id]
        );

        return res.json({
            success: true,
            missionId,
            status: 'completed',
            todayProgress: {
                completed: progress?.completed || 0,
                total: progress?.total || 0,
                percent: progress?.total
                    ? Math.round(((progress.completed || 0) / progress.total) * 100)
                    : 0
            }
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
        const db = req.app.locals.db;
        const userId = req.user?.id;
        const missionId = toInt(req.params.id, 0);
        const status = sanitize(req.body.status || '').toLowerCase();
        const note = sanitize(req.body.note || req.body.completionNote || '');
        const allowedStatuses = ['pending', 'completed', 'skipped', 'stuck'];

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mission status.'
            });
        }

        const mission = await db.get(
            `SELECT id, roadmap_id, title
             FROM academy_missions
             WHERE id = ? AND user_id = ?`,
            [missionId, userId]
        );

        if (!mission) {
            return res.status(404).json({
                success: false,
                message: 'Mission not found.'
            });
        }

        await db.run(
            `UPDATE academy_missions
             SET status = ?,
                 completion_note = ?,
                 completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = ? AND user_id = ?`,
            [status, note, status, missionId, userId]
        );

        if (status === 'skipped' || status === 'stuck') {
            await db.run(
                `INSERT INTO academy_checkins (
                    user_id, roadmap_id, blocker_text, ai_feedback_json
                 ) VALUES (?, ?, ?, ?)`,
                [
                    userId,
                    mission.roadmap_id,
                    status === 'stuck' ? note || `User got stuck on: ${mission.title}` : '',
                    JSON.stringify({
                        type: 'mission_feedback',
                        missionId,
                        status,
                        note
                    })
                ]
            );
        }

        const progress = await db.get(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
             FROM academy_missions
             WHERE user_id = ? AND roadmap_id = ?`,
            [userId, mission.roadmap_id]
        );

        return res.json({
            success: true,
            missionId,
            status,
            note,
            todayProgress: {
                completed: progress?.completed || 0,
                total: progress?.total || 0,
                percent: progress?.total
                    ? Math.round(((progress.completed || 0) / progress.total) * 100)
                    : 0
            }
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
        const db = req.app.locals.db;
        const userId = req.user?.id;

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const activeRoadmap = await getActiveRoadmapRecord(db, userId);
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

        await db.run(
            `INSERT INTO academy_checkins (
                user_id, roadmap_id, energy_score, mood_score,
                completed_summary, blocker_text, tomorrow_focus, ai_feedback_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                activeRoadmap.id,
                energyScore,
                moodScore,
                completedSummary,
                blockerText,
                tomorrowFocus,
                JSON.stringify({ type: 'daily_checkin' })
            ]
        );

        return res.json({
            success: true,
            message: 'Check-in saved.'
        });
    } catch (error) {
        console.error('Submit Check-in Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving check-in.'
        });
    }
};

exports.refreshRoadmap = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user?.id;

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database unavailable.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }

        const profile = await getLatestProfile(db, userId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'No Academy profile found yet.'
            });
        }

        const plannerResult = await generateAndPersistPlan(db, userId, profile, { mode: 'refresh' });

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