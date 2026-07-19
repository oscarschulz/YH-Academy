/* public/js/yhu-game-core.js */
/* YHU Game Foundation Core v1 */

(function installYHUGameCoreV1() {
    'use strict';

    if (window.YHUGameCore) return;

    const STORAGE_KEYS = Object.freeze({
        academyHome: 'yh_academy_home',
        academyMembership: 'yh_academy_membership_status_v1',
        academyProgression: 'yh_academy_progression_v1',
        academyLeaderboard: 'yh_academy_leaderboard_weekly_v1',
        plazaAccess: 'yh_plaza_access_status_v1',
        federationAccess: 'yh_federation_access_status_v1',
        squadPreview: 'yh_game_squad_preview_v1'
    });

    function clampScore(value, minimum = 0, maximum = 100) {
        const numericValue = Number(value);

        if (!Number.isFinite(numericValue)) return minimum;

        return Math.max(minimum, Math.min(maximum, numericValue));
    }

    function readJsonStorage(key, fallback = {}) {
        const cleanKey = String(key || '').trim();
        if (!cleanKey) return fallback;

        const stores = [localStorage, sessionStorage];

        for (const store of stores) {
            try {
                const raw = store.getItem(cleanKey);
                if (!raw) continue;

                const parsed = JSON.parse(raw);

                if (parsed !== null && typeof parsed === 'object') {
                    return parsed;
                }
            } catch (_) {}
        }

        return fallback;
    }

        function writeJsonStorage(key, value, storage = sessionStorage) {
        const cleanKey = String(key || '').trim();

        if (!cleanKey) return false;

        try {
            storage.setItem(cleanKey, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }


    function normalizeStatus(value = '') {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
    }

    function getFirstFiniteNumber(values = []) {
        for (const value of values) {
            if (value === null || value === undefined || value === '') {
                continue;
            }

            const numericValue = Number(value);

            if (Number.isFinite(numericValue)) {
                return numericValue;
            }
        }

        return null;
    }

    function normalizeRatioScore(value = null) {
        const numericValue = Number(value);

        if (!Number.isFinite(numericValue)) return null;

        return clampScore(
            numericValue >= 0 && numericValue <= 1
                ? numericValue * 100
                : numericValue
        );
    }

    function isApprovedAccess(snapshot = {}, division = '') {
        const status = normalizeStatus(
            snapshot.applicationStatus ||
            snapshot.status ||
            snapshot.application?.status ||
            ''
        );

        if (division === 'academy') {
            return snapshot.canEnterAcademy === true || status === 'approved';
        }

        if (division === 'plaza') {
            return snapshot.canEnterPlaza === true || status === 'approved';
        }

        if (division === 'federation') {
            return snapshot.canEnterFederation === true || status === 'approved';
        }

        return status === 'approved';
    }

    function resolveAcademyRank(score = 0) {
        const safeScore = clampScore(score);

        if (safeScore >= 90) return 'Master Builder';
        if (safeScore >= 75) return 'Elite Builder';
        if (safeScore >= 55) return 'Mission Operator';
        if (safeScore >= 30) return 'Builder';
        if (safeScore >= 10) return 'Apprentice';

        return 'Initiate';
    }

    function resolvePlazaRank(score = 0) {
        const safeScore = clampScore(score);

        if (safeScore >= 90) return 'Global Connector';
        if (safeScore >= 75) return 'Regional Leader';
        if (safeScore >= 60) return 'Regional Operator';
        if (safeScore >= 40) return 'Deal Builder';
        if (safeScore >= 20) return 'Connector';
        if (safeScore >= 5) return 'Networker';

        return 'Explorer';
    }

    function resolveFederationRank(score = 0, approved = false) {
        const safeScore = clampScore(score);

        if (!approved && safeScore < 20) return 'Candidate';
        if (safeScore >= 90) return 'Architect';
        if (safeScore >= 78) return 'Core Member';
        if (safeScore >= 64) return 'Commander';
        if (safeScore >= 48) return 'Strategist';
        if (safeScore >= 30) return 'Operator';
        if (safeScore >= 15) return 'Contributor';

        return 'Candidate';
    }

    function getAcademySnapshot() {
        const home = readJsonStorage(STORAGE_KEYS.academyHome, {});
        const membership = readJsonStorage(
            STORAGE_KEYS.academyMembership,
            {}
        );

        const progressionCache = readJsonStorage(
            STORAGE_KEYS.academyProgression,
            {}
        );

        const progression =
            progressionCache?.progression &&
            typeof progressionCache.progression === 'object'
                ? progressionCache.progression
                : progressionCache;

        const hasPersistentProgression =
            progression &&
            typeof progression === 'object' &&
            Number.isFinite(Number(progression.totalXp));

        const approved = isApprovedAccess(
            membership,
            'academy'
        );

        if (hasPersistentProgression) {
            const totalXp = Math.max(
                0,
                Number(progression.totalXp) || 0
            );

            const weeklyXp = Math.max(
                0,
                Number(progression.weeklyXp) || 0
            );

            const level = Math.max(
                1,
                Number(progression.level) || 1
            );

            const rankProgress = clampScore(
                progression.rankProgress ?? 0
            );

            const completedCount = Math.max(
                0,
                Number(progression.completedMissions) || 0
            );

            const totalCount = Math.max(
                0,
                Number(progression.totalMissions) || 0
            );

            return {
                division: 'academy',
                score: rankProgress,
                approved,
                hasVerifiedScore: true,
                hasPersistentProgression: true,
                isPreview: false,

                rank:
                    String(progression.rank || '').trim() ||
                    'Initiate',

                level,
                totalXp,
                weeklyXp,

                nextRank:
                    String(progression.nextRank || '').trim() ||
                    'Next Rank',

                nextXp: Math.max(
                    totalXp,
                    Number(progression.nextXp) || totalXp
                ),

                rankProgress,

                completedCount,
                totalCount,

                streakDays: Math.max(
                    0,
                    Number(progression.streakDays) || 0
                ),

                weeklyPosition:
                    Number(progression.weeklyPosition) || null,

                mode: 'Solo Campaign',

                progressionLabel:
                    `${totalXp.toLocaleString()} total XP • ` +
                    `${weeklyXp.toLocaleString()} XP this week`,

                nextObjective:
                    progression.nextRank &&
                    progression.nextRank !== 'Max Rank'
                        ? `Reach ${progression.nextRank}`
                        : 'Maintain Academy Elite status'
            };
        }

        const readiness =
            home?.plazaReadiness &&
            typeof home.plazaReadiness === 'object'
                ? home.plazaReadiness
                : {};

        const completedCount = Math.max(
            0,
            Number(
                readiness.completedCount ??
                home.completedMissionCount ??
                home.completedMissions ??
                0
            ) || 0
        );

        const totalCount = Math.max(
            0,
            Number(
                readiness.totalCount ??
                home.totalMissionCount ??
                home.totalMissions ??
                0
            ) || 0
        );

        const countRatioScore =
            totalCount > 0
                ? clampScore(
                    (completedCount / totalCount) * 100
                )
                : null;

        const missionRatioScore = normalizeRatioScore(
            readiness.missionCompletionRatio ??
            home.missionCompletionRatio
        );

        const rawScore = getFirstFiniteNumber([
            readiness.score,
            home.academyScore,
            readiness.scoreBreakdown?.overallScore,
            readiness.missionExecutionScore,
            readiness.scoreBreakdown?.missionExecutionScore,
            missionRatioScore,
            countRatioScore
        ]);

        const hasVerifiedScore = rawScore !== null;
        const score = clampScore(
            hasVerifiedScore ? rawScore : 0
        );

        return {
            division: 'academy',
            score,
            approved,
            hasVerifiedScore,
            hasPersistentProgression: false,
            isPreview: !hasVerifiedScore,

            rank: hasVerifiedScore
                ? resolveAcademyRank(score)
                : 'Loading Progress',

            level: null,
            totalXp: null,
            weeklyXp: null,
            nextRank: '',
            nextXp: null,
            rankProgress: score,

            mode: 'Solo Campaign',

            progressionLabel:
                hasVerifiedScore
                    ? 'Loading persistent Academy XP'
                    : approved
                        ? 'Syncing Academy progression'
                        : 'Academy access not active',

            completedCount,
            totalCount,

            nextObjective:
                approved
                    ? 'Loading your verified progression'
                    : 'Activate Academy access'
        };
    }


    function getPlazaSnapshot() {
        const access = readJsonStorage(STORAGE_KEYS.plazaAccess, {});
        const academy = getAcademySnapshot();

        const application =
            access.application && typeof access.application === 'object'
                ? access.application
                : {};

        const rawScore = getFirstFiniteNumber([
            access.opportunityScore,
            access.reputationScore,
            access.member?.opportunityScore,
            access.member?.reputationScore,
            application.opportunityScore,
            application.reputationScore
        ]);

        const approved = isApprovedAccess(access, 'plaza');
        const hasVerifiedScore = rawScore !== null;

        const fallbackScore =
            academy.hasVerifiedScore
                ? (
                    approved
                        ? Math.max(20, Math.round(academy.score * 0.72))
                        : Math.round(academy.score * 0.45)
                )
                : 0;

        const score = clampScore(
            hasVerifiedScore ? rawScore : fallbackScore
        );

        const applicationStatus = normalizeStatus(
            access.applicationStatus ||
            application.status ||
            ''
        );

        return {
            division: 'plaza',
            score,
            approved,
            hasVerifiedScore,
            isPreview: !hasVerifiedScore,
            rank:
                hasVerifiedScore || score > 0
                    ? resolvePlazaRank(score)
                    : 'Awaiting Signal',
            mode: 'Open World',
            progressionLabel:
                hasVerifiedScore
                    ? 'Verified opportunity signal'
                    : approved
                        ? 'Preview based on current Academy readiness'
                        : applicationStatus === 'pending'
                            ? 'Application under review'
                            : 'Build your opportunity signal',
            nextObjective:
                approved
                    ? 'Explore a contract or expand your network'
                    : 'Strengthen readiness and apply for Plazas',
            applicationStatus
        };
    }

    function getFederationSnapshot() {
        const access = readJsonStorage(STORAGE_KEYS.federationAccess, {});
        const academy = getAcademySnapshot();
        const plaza = getPlazaSnapshot();

        const application =
            access.application && typeof access.application === 'object'
                ? access.application
                : {};

        const approved = isApprovedAccess(access, 'federation');

        const rawScore = getFirstFiniteNumber([
            access.strategicTrust,
            access.trustScore,
            access.member?.strategicTrust,
            access.member?.trustScore,
            application.strategicTrust,
            application.trustScore
        ]);

        const hasVerifiedScore = rawScore !== null;

        const fallbackScore =
            plaza.score > 0 || academy.score > 0
                ? (
                    approved
                        ? Math.max(
                            25,
                            Math.round(
                                (plaza.score * 0.7) +
                                (academy.score * 0.15)
                            )
                        )
                        : Math.round(plaza.score * 0.35)
                )
                : 0;

        const score = clampScore(
            hasVerifiedScore ? rawScore : fallbackScore
        );

        const applicationStatus = normalizeStatus(
            access.applicationStatus ||
            application.status ||
            ''
        );

        return {
            division: 'federation',
            score,
            approved,
            hasVerifiedScore,
            isPreview: !hasVerifiedScore,
            rank:
                hasVerifiedScore || score > 0
                    ? resolveFederationRank(score, approved)
                    : 'Awaiting Signal',
            mode: 'Strategic Multiplayer',
            progressionLabel:
                hasVerifiedScore
                    ? 'Verified strategic trust signal'
                    : approved
                        ? 'Preview based on current division readiness'
                        : applicationStatus === 'pending'
                            ? 'Clearance under review'
                            : 'Build strategic readiness',
            nextObjective:
                approved
                    ? 'Join a strategic operation'
                    : 'Build Plaza reputation and strategic trust',
            applicationStatus
        };
    }

    function getOperatorRank(averageScore = 0) {
        const score = clampScore(averageScore);

        if (score >= 90) return 'Architect';
        if (score >= 75) return 'Strategist';
        if (score >= 55) return 'Connector';
        if (score >= 35) return 'Operator';
        if (score >= 15) return 'Builder';

        return 'Initiate';
    }

    function getOperatorLevel(score = 0) {
        return Math.max(1, Math.min(50, Math.floor(clampScore(score) / 2) + 1));
    }
    function setAcademyProgressionCache(payload = {}) {
        const progression =
            payload?.progression &&
            typeof payload.progression === 'object'
                ? payload.progression
                : payload;

        if (
            !progression ||
            typeof progression !== 'object'
        ) {
            return false;
        }

        const saved = writeJsonStorage(
            STORAGE_KEYS.academyProgression,
            {
                progression,
                cachedAt: new Date().toISOString()
            },
            sessionStorage
        );

        if (saved) {
            window.dispatchEvent(
                new CustomEvent(
                    'yhu:academy-progression-updated',
                    { detail: progression }
                )
            );
        }

        return saved;
    }

    function setAcademyLeaderboardCache(payload = {}) {
        const leaderboard = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.leaderboard)
                ? payload.leaderboard
                : [];

        const playerPosition =
            Number(payload?.playerPosition) || null;

        const saved = writeJsonStorage(
            STORAGE_KEYS.academyLeaderboard,
            {
                leaderboard,
                playerPosition,
                period: payload?.period || 'weekly',
                cachedAt: new Date().toISOString()
            },
            sessionStorage
        );

        if (saved) {
            const progressionCache = readJsonStorage(
                STORAGE_KEYS.academyProgression,
                {}
            );

            const progression =
                progressionCache?.progression &&
                typeof progressionCache.progression === 'object'
                    ? progressionCache.progression
                    : progressionCache;

            if (
                progression &&
                typeof progression === 'object' &&
                playerPosition
            ) {
                setAcademyProgressionCache({
                    ...progression,
                    weeklyPosition: playerPosition
                });
            }

            window.dispatchEvent(
                new CustomEvent(
                    'yhu:academy-leaderboard-updated',
                    {
                        detail: {
                            leaderboard,
                            playerPosition
                        }
                    }
                )
            );
        }

        return saved;
    }

    function getAcademyLeaderboardSnapshot() {
        return readJsonStorage(
            STORAGE_KEYS.academyLeaderboard,
            {
                leaderboard: [],
                playerPosition: null,
                period: 'weekly'
            }
        );
    }

    /* PATCH: Live Academy Squad cache v1 */
    function setAcademySquadCacheV1(
        payload = {}
    ) {
        const joined =
            payload?.joined === true &&
            payload?.squad &&
            typeof payload.squad ===
                'object';

        const squad =
            joined
                ? payload.squad
                : {};

        const membership =
            payload?.membership &&
            typeof payload.membership ===
                'object'
                ? payload.membership
                : {};

        const members =
            Array.isArray(squad.members)
                ? squad.members
                : [];

        const snapshot = {
            loaded: true,
            joined,

            id:
                String(
                    squad.id ||
                    squad.squadId ||
                    ''
                ).trim(),

            name:
                String(
                    squad.name || ''
                ).trim(),

            description:
                String(
                    squad.description || ''
                ).trim(),

            emblem:
                String(
                    squad.emblem || '⚡'
                ).trim(),

            members:
                Number(
                    squad.memberCount ??
                    members.length ??
                    0
                ),

            memberList: members,

            maxMembers:
                Number(
                    squad.maxMembers || 8
                ),

            rank:
                String(
                    squad.rank ||
                    'Unranked'
                ).trim(),

            totalXp:
                Number(
                    squad.totalXp || 0
                ),

            weeklyXp:
                Number(
                    squad.weeklyXp || 0
                ),

            level:
                Math.max(
                    1,
                    Number(
                        squad.level || 1
                    )
                ),

            nextLevelXp:
                Math.max(
                    100,
                    Number(
                        squad.nextLevelXp ||
                        500
                    )
                ),

            recentContributions:
                Array.isArray(
                    squad.recentContributions
                )
                    ? squad
                        .recentContributions
                        .slice(0, 20)
                    : [],

            weeklyPosition:
                payload
                    ?.weeklyLeaderboard
                    ?.currentSquadPosition ||
                squad.weeklyPosition ||
                null,

            allTimePosition:
                payload
                    ?.allTimeLeaderboard
                    ?.currentSquadPosition ||
                squad.allTimePosition ||
                null,

            weeklyLeaderboard:
                Array.isArray(
                    payload
                        ?.weeklyLeaderboard
                        ?.leaderboard
                )
                    ? payload
                        .weeklyLeaderboard
                        .leaderboard
                        .slice(0, 10)
                    : (
                        Array.isArray(
                            squad.weeklyLeaderboard
                        )
                            ? squad
                                .weeklyLeaderboard
                                .slice(0, 10)
                            : []
                    ),

            allTimeLeaderboard:
                Array.isArray(
                    payload
                        ?.allTimeLeaderboard
                        ?.leaderboard
                )
                    ? payload
                        .allTimeLeaderboard
                        .leaderboard
                        .slice(0, 10)
                    : (
                        Array.isArray(
                            squad.allTimeLeaderboard
                        )
                            ? squad
                                .allTimeLeaderboard
                                .slice(0, 10)
                            : []
                    ),

            weeklyContributors:
                Array.isArray(
                    payload
                        ?.weeklyContributors
                        ?.contributors
                )
                    ? payload
                        .weeklyContributors
                        .contributors
                        .slice(0, 10)
                    : (
                        Array.isArray(
                            squad.weeklyContributors
                        )
                            ? squad
                                .weeklyContributors
                                .slice(0, 10)
                            : []
                    ),

            allTimeContributors:
                Array.isArray(
                    payload
                        ?.allTimeContributors
                        ?.contributors
                )
                    ? payload
                        .allTimeContributors
                        .contributors
                        .slice(0, 10)
                    : (
                        Array.isArray(
                            squad.allTimeContributors
                        )
                            ? squad
                                .allTimeContributors
                                .slice(0, 10)
                            : []
                    ),

            inviteCode:
                String(
                    squad.inviteCode || ''
                ).trim(),

            role:
                String(
                    membership.role ||
                    ''
                ).trim(),

            ownerUserId:
                String(
                    squad.ownerUserId ||
                    ''
                ).trim(),

            updatedAt:
                String(
                    squad.updatedAt ||
                    new Date().toISOString()
                )
        };

        writeJsonStorage(
            STORAGE_KEYS.squadPreview,
            snapshot,
            sessionStorage
        );

        try {
            window.dispatchEvent(
                new CustomEvent(
                    'yhu:academy-squad-updated',
                    {
                        detail: snapshot
                    }
                )
            );
        } catch (_) {}

        return snapshot;
    }

    function getAcademySquadSnapshotV1() {
        return readJsonStorage(
            STORAGE_KEYS.squadPreview,
            {
                loaded: false,
                joined: false,
                id: '',
                name: '',
                description: '',
                emblem: '⚡',
                members: 0,
                memberList: [],
                maxMembers: 8,
                rank: 'Unranked',
                totalXp: 0,
                weeklyXp: 0,
                level: 1,
                nextLevelXp: 500,
                recentContributions: [],
                weeklyPosition: null,
                allTimePosition: null,
                weeklyLeaderboard: [],
                allTimeLeaderboard: [],
                weeklyContributors: [],
                allTimeContributors: [],
                inviteCode: '',
                role: ''
            }
        );
    }
    /* END PATCH: Live Academy Squad cache v1 */

    function getDashboardSnapshot() {
        const academy = getAcademySnapshot();
        const plaza = getPlazaSnapshot();
        const federation = getFederationSnapshot();

        const averageScore = Math.round(
            (academy.score + plaza.score + federation.score) / 3
        );

        const level = getOperatorLevel(averageScore);
        const levelStartScore = Math.max(0, (level - 1) * 2);
        const levelEndScore = Math.min(100, levelStartScore + 2);
        const levelProgress =
            levelEndScore > levelStartScore
                ? clampScore(
                    ((averageScore - levelStartScore) /
                        (levelEndScore - levelStartScore)) *
                        100
                )
                : 100;

        return {
            operator: {
                averageScore,
                level,
                rank: getOperatorRank(averageScore),
                levelProgress
            },
            divisions: {
                academy,
                plaza,
                federation
            },
            squad:
                getAcademySquadSnapshotV1()
        };
    }

    window.YHUGameCore = Object.freeze({
        STORAGE_KEYS,
        clampScore,
        readJsonStorage,
        writeJsonStorage,
        normalizeStatus,

        setAcademyProgressionCache,
        setAcademyLeaderboardCache,
        getAcademyLeaderboardSnapshot,

        setAcademySquadCacheV1,
        getAcademySquadSnapshotV1,

        getAcademySnapshot,
        getPlazaSnapshot,
        getFederationSnapshot,
        getDashboardSnapshot
    });

    window.dispatchEvent(
        new CustomEvent('yhu:game-core-ready', {
            detail: getDashboardSnapshot()
        })
    );
})();