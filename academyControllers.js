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

function buildRoadmap(profile) {
    const focusAreas = [];
    const bottlenecks = [];
    const strengths = [];

    let readinessScore = 60;

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

    if (profile.blockerText && profile.blockerText.length > 6) {
        focusAreas.push('discipline');
        bottlenecks.push('Execution inconsistency');
    }

    if (profile.monthlyIncomeRange && /0|none|below|under/i.test(profile.monthlyIncomeRange)) {
        focusAreas.push('wealth');
        bottlenecks.push('Weak current income base');
        readinessScore -= 6;
    } else {
        focusAreas.push('wealth');
    }

    if (!focusAreas.includes('discipline')) focusAreas.push('discipline');

    const uniqueFocusAreas = [...new Set(focusAreas)].slice(0, 3);
    const uniqueBottlenecks = [...new Set(bottlenecks)].slice(0, 3);
    const uniqueStrengths = [...new Set(strengths)].slice(0, 3);

    readinessScore = Math.max(45, Math.min(95, readinessScore));

    const primaryBottleneck = uniqueBottlenecks[0] || 'Lack of clear execution structure';
    const secondaryBottleneck = uniqueBottlenecks[1] || 'Scattered effort across too many goals';
    const mainOpportunity =
        uniqueFocusAreas.includes('wealth')
            ? 'Build a small but consistent income system around your current skills'
            : 'Stabilize routine first, then scale execution';

    const missions = [
        {
            pillar: 'discipline',
            title: 'Set a hard start time for your main work block',
            description: 'Choose one exact time window every day for focused execution.',
            whyItMatters: 'Consistency compounds faster than motivation.',
            frequency: 'daily',
            dueDate: todayISO(),
            estimatedMinutes: 15,
            sortOrder: 1
        },
        {
            pillar: 'health',
            title: 'Protect sleep and reduce late-night distractions',
            description: 'Create a shut-down routine and avoid sleep sabotage tonight.',
            whyItMatters: 'Your energy determines the quality of your decisions.',
            frequency: 'daily',
            dueDate: todayISO(),
            estimatedMinutes: 20,
            sortOrder: 2
        },
        {
            pillar: 'wealth',
            title: 'Work on one income-producing task',
            description: 'Spend one block on outreach, sales, client work, or business building.',
            whyItMatters: 'Your roadmap must create real economic movement.',
            frequency: 'daily',
            dueDate: todayISO(),
            estimatedMinutes: 60,
            sortOrder: 3
        },
        {
            pillar: 'discipline',
            title: 'Review your blocker and remove one friction point',
            description: 'Fix one thing that keeps making you delay action.',
            whyItMatters: 'Execution improves when friction is reduced.',
            frequency: 'weekly',
            dueDate: addDaysISO(3),
            estimatedMinutes: 30,
            sortOrder: 4
        },
        {
            pillar: 'wealth',
            title: 'Define one 30-day money target',
            description: 'Write the exact income goal and the activity that will create it.',
            whyItMatters: 'Clear targets convert effort into direction.',
            frequency: 'weekly',
            dueDate: addDaysISO(5),
            estimatedMinutes: 25,
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
            goal: 'Stabilize structure, improve energy, and create measurable forward movement in wealth and discipline.',
            coachTone: profile.coachTone || 'balanced',
            days30: {
                week1: 'Reset structure and reduce friction',
                week2: 'Build consistency and protect energy',
                week3: 'Increase output on wealth tasks',
                week4: 'Review progress and tighten execution'
            }
        },
        missions
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

        const payload = {
            city: sanitize(req.body.city),
            country: sanitize(req.body.country),
            occupationType: sanitize(req.body.occupationType),
            currentJob: sanitize(req.body.currentJob),
            industry: sanitize(req.body.industry),
            monthlyIncomeRange: sanitize(req.body.monthlyIncomeRange),
            savingsRange: sanitize(req.body.savingsRange),
            incomeSource: sanitize(req.body.incomeSource),
            businessStage: sanitize(req.body.businessStage),
            sleepHours: toFloat(req.body.sleepHours, 0),
            energyScore: toInt(req.body.energyScore, 0),
            exerciseFrequency: sanitize(req.body.exerciseFrequency),
            stressScore: toInt(req.body.stressScore, 0),
            badHabit: sanitize(req.body.badHabit),
            seriousness: sanitize(req.body.seriousness),
            weeklyHours: toInt(req.body.weeklyHours, 0),
            goals6mo: sanitize(req.body.goals6mo),
            blockerText: sanitize(req.body.blockerText),
            coachTone: sanitize(req.body.coachTone || 'balanced')
        };

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

        const profileId = profileInsert.lastID;

        const roadmapData = buildRoadmap(payload);

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
                1,
                roadmapData.readinessScore,
                JSON.stringify({
                    ...roadmapData.summary,
                    focusAreas: roadmapData.focusAreas
                }),
                JSON.stringify(roadmapData.roadmap),
                'academy-rule-engine-v1'
            ]
        );

        const roadmapId = roadmapInsert.lastID;

        for (const mission of roadmapData.missions) {
            await db.run(
                `INSERT INTO academy_missions (
                    user_id, roadmap_id, pillar, title, description, why_it_matters,
                    frequency, due_date, estimated_minutes, status, source, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'ai', ?)`,
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

        const todayMissions = await db.all(
            `SELECT id, pillar, title, frequency, due_date AS dueDate, status
             FROM academy_missions
             WHERE user_id = ? AND roadmap_id = ?
             ORDER BY sort_order ASC, id ASC
             LIMIT 3`,
            [userId, roadmapId]
        );

        return res.json({
            success: true,
            accessState: 'unlocked',
            profileId,
            roadmapId,
            readinessScore: roadmapData.readinessScore,
            summary: roadmapData.summary,
            focusAreas: roadmapData.focusAreas,
            todayMissions
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

        const roadmap = await db.get(
            `SELECT id, version, readiness_score, summary_json, roadmap_json
             FROM academy_roadmaps
             WHERE user_id = ? AND status = 'active'
             ORDER BY id DESC
             LIMIT 1`,
            [userId]
        );

        if (!roadmap) {
            return res.status(404).json({
                success: false,
                message: 'No active Academy roadmap yet.'
            });
        }

        const missions = await db.all(
            `SELECT id, pillar, title, status, due_date AS dueDate, estimated_minutes AS estimatedMinutes
             FROM academy_missions
             WHERE user_id = ? AND roadmap_id = ?
             ORDER BY sort_order ASC, id ASC
             LIMIT 3`,
            [userId, roadmap.id]
        );

        const stats = await db.get(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
             FROM academy_missions
             WHERE user_id = ? AND roadmap_id = ?`,
            [userId, roadmap.id]
        );

        const recentCheckins = await db.get(
            `SELECT COUNT(*) AS streakDays
             FROM academy_checkins
             WHERE user_id = ?
               AND created_at >= datetime('now', '-7 day')`,
            [userId]
        );

        const summary = JSON.parse(roadmap.summary_json || '{}');

        return res.json({
            success: true,
            roadmap: {
                id: roadmap.id,
                version: roadmap.version,
                readinessScore: roadmap.readiness_score,
                focusAreas: summary.focusAreas || [],
                summary
            },
            today: {
                missionsCompleted: stats?.completed || 0,
                missionsTotal: stats?.total || 0,
                streakDays: recentCheckins?.streakDays || 0
            },
            missions
        });
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

        const roadmap = await db.get(
            `SELECT id, version, readiness_score, summary_json, roadmap_json, created_by_model, created_at
             FROM academy_roadmaps
             WHERE user_id = ? AND status = 'active'
             ORDER BY id DESC
             LIMIT 1`,
            [userId]
        );

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
            readinessScore: roadmap.readiness_score,
            summary: JSON.parse(roadmap.summary_json || '{}'),
            roadmap: JSON.parse(roadmap.roadmap_json || '{}'),
            createdByModel: roadmap.created_by_model,
            createdAt: roadmap.created_at
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

        const activeRoadmap = await db.get(
            `SELECT id
             FROM academy_roadmaps
             WHERE user_id = ? AND status = 'active'
             ORDER BY id DESC
             LIMIT 1`,
            [userId]
        );

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