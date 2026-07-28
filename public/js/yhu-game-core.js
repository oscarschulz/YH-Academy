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
        plazaReputation: 'yh_plaza_reputation_v1',
        federationAccess: 'yh_federation_access_status_v1',
        federationInfluence: 'yh_federation_influence_v1',
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

        if (safeScore >= 100) return 'World Builder';
        if (safeScore >= 50) return 'Regional Operator';
        if (safeScore >= 20) return 'Connector';
        if (safeScore >= 5) return 'Explorer';

        return 'Newcomer';
    }

    function resolveFederationRank(
        totalInfluence = 0,
        approved = false
    ) {
        const total = Math.max(
            0,
            Number(totalInfluence) || 0
        );

        if (!approved) {
            return {
                key: 'observer',
                label: 'Observer',
                minimum: 0,
                nextLabel: 'Delegate',
                nextAt: 0
            };
        }

        if (total >= 250) {
            return {
                key: 'federation-commander',
                label: 'Federation Commander',
                minimum: 250,
                nextLabel: 'Max Rank',
                nextAt: 250
            };
        }

        if (total >= 100) {
            return {
                key: 'regional-leader',
                label: 'Regional Leader',
                minimum: 100,
                nextLabel: 'Federation Commander',
                nextAt: 250
            };
        }

        if (total >= 50) {
            return {
                key: 'council-member',
                label: 'Council Member',
                minimum: 50,
                nextLabel: 'Regional Leader',
                nextAt: 100
            };
        }

        if (total >= 20) {
            return {
                key: 'strategist',
                label: 'Strategist',
                minimum: 20,
                nextLabel: 'Council Member',
                nextAt: 50
            };
        }

        if (total >= 5) {
            return {
                key: 'representative',
                label: 'Representative',
                minimum: 5,
                nextLabel: 'Strategist',
                nextAt: 20
            };
        }

        return {
            key: 'delegate',
            label: 'Delegate',
            minimum: 0,
            nextLabel: 'Representative',
            nextAt: 5
        };
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


    function normalizePlazaReputationSnapshot(payload = {}) {
        const profile =
            payload?.profile &&
            typeof payload.profile === 'object'
                ? payload.profile
                : payload?.reputation &&
                  typeof payload.reputation === 'object'
                    ? payload.reputation
                    : {};

        const events =
            Array.isArray(payload?.events)
                ? payload.events
                : [];

        const loaded =
            payload?.loaded === true ||
            payload?.success === true ||
            Boolean(
                profile.userId ||
                profile.source ||
                payload?.fetchedAt
            );

        return {
            loaded,

            profile: {
                userId:
                    String(
                        profile.userId ||
                        ''
                    ).trim(),

                division:
                    'plaza',

                totalReputation:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.totalReputation ||
                                0
                            ) || 0
                        )
                    ),

                weeklyReputation:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.weeklyReputation ||
                                0
                            ) || 0
                        )
                    ),

                eventCount:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.eventCount ??
                                payload?.eventCount ??
                                events.length ??
                                0
                            ) || 0
                        )
                    ),

                weekStartAt:
                    String(
                        profile.weekStartAt ||
                        ''
                    ).trim(),

                lastEventAt:
                    String(
                        profile.lastEventAt ||
                        ''
                    ).trim(),

                lastEventType:
                    String(
                        profile.lastEventType ||
                        ''
                    )
                        .trim()
                        .toLowerCase(),

                source:
                    String(
                        profile.source ||
                        'plaza_event_ledger_v1'
                    ).trim(),

                updatedAt:
                    String(
                        profile.updatedAt ||
                        ''
                    ).trim()
            },

            events,

            fetchedAt:
                String(
                    payload?.fetchedAt ||
                    ''
                ).trim()
        };
    }

    function setPlazaReputationCache(payload = {}) {
        const snapshot =
            normalizePlazaReputationSnapshot(
                payload
            );

        const saved =
            writeJsonStorage(
                STORAGE_KEYS.plazaReputation,
                snapshot,
                sessionStorage
            );

        if (saved) {
            window.dispatchEvent(
                new CustomEvent(
                    'yhu:plaza-reputation-updated',
                    {
                        detail:
                            snapshot
                    }
                )
            );
        }

        return saved;
    }

    function getPlazaReputationSnapshot() {
        return normalizePlazaReputationSnapshot(
            readJsonStorage(
                STORAGE_KEYS.plazaReputation,
                {}
            )
        );
    }

    function getPlazaSnapshot() {
        const access =
            readJsonStorage(
                STORAGE_KEYS.plazaAccess,
                {}
            );

        const reputation =
            getPlazaReputationSnapshot();

        const profile =
            reputation.profile ||
            {};

        const application =
            access.application &&
            typeof access.application === 'object'
                ? access.application
                : {};

        const approved =
            isApprovedAccess(
                access,
                'plaza'
            );

        const hasPersistentReputation =
            reputation.loaded === true;

        const totalReputation =
            Math.max(
                0,
                Number(
                    profile.totalReputation ||
                    0
                ) || 0
            );

        const weeklyReputation =
            Math.max(
                0,
                Number(
                    profile.weeklyReputation ||
                    0
                ) || 0
            );

        const eventCount =
            Math.max(
                0,
                Number(
                    profile.eventCount ||
                    reputation.events?.length ||
                    0
                ) || 0
            );

        const score =
            hasPersistentReputation
                ? clampScore(
                    totalReputation
                )
                : 0;

        const applicationStatus =
            normalizeStatus(
                access.applicationStatus ||
                application.status ||
                ''
            );

        const rank =
            hasPersistentReputation
                ? resolvePlazaRank(
                    totalReputation
                )
                : approved
                    ? 'Syncing Ledger'
                    : 'Awaiting Signal';

        const nextObjective =
            !approved
                ? 'Activate Plaza access'
                : !hasPersistentReputation
                    ? 'Sync your canonical Reputation ledger'
                    : totalReputation < 5
                        ? 'Earn your first verified Opportunity approval'
                        : totalReputation < 20
                            ? 'Build toward Connector rank'
                            : totalReputation < 50
                                ? 'Build toward Regional Operator rank'
                                : totalReputation < 100
                                    ? 'Build toward World Builder rank'
                                    : 'Expand your verified Plaza impact';

        return {
            division:
                'plaza',

            score,
            approved,

            hasVerifiedScore:
                hasPersistentReputation,

            hasPersistentReputation,

            isPreview:
                !hasPersistentReputation,

            rank,

            rankProgress:
                score,

            totalReputation,
            weeklyReputation,
            eventCount,

            lastEventAt:
                String(
                    profile.lastEventAt ||
                    ''
                ).trim(),

            lastEventType:
                String(
                    profile.lastEventType ||
                    ''
                )
                    .trim()
                    .toLowerCase(),

            mode:
                'Open World',

            progressionLabel:
                hasPersistentReputation
                    ? `${totalReputation.toLocaleString()} canonical Reputation`
                    : approved
                        ? 'Syncing canonical Plaza Reputation'
                        : applicationStatus === 'pending'
                            ? 'Application under review'
                            : 'Build your opportunity signal',

            nextObjective,
            applicationStatus
        };
    }


    function normalizeFederationInfluenceSnapshot(
        payload = {}
    ) {
        const profile =
            payload?.profile &&
            typeof payload.profile === 'object'
                ? payload.profile
                : payload?.influence &&
                  typeof payload.influence === 'object'
                    ? payload.influence
                    : {};

        const events =
            Array.isArray(payload?.events)
                ? payload.events
                : [];

        const loaded =
            payload?.loaded === true ||
            payload?.success === true ||
            Boolean(
                profile.userId ||
                profile.source ||
                payload?.fetchedAt
            );

        return {
            loaded,

            profile: {
                userId:
                    String(
                        profile.userId ||
                        ''
                    ).trim(),

                division:
                    'federation',

                totalInfluence:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.totalInfluence ||
                                0
                            ) || 0
                        )
                    ),

                weeklyInfluence:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.weeklyInfluence ||
                                0
                            ) || 0
                        )
                    ),

                eventCount:
                    Math.max(
                        0,
                        Math.round(
                            Number(
                                profile.eventCount ??
                                payload?.eventCount ??
                                events.length
                            ) || 0
                        )
                    ),

                weekStartAt:
                    String(
                        profile.weekStartAt ||
                        ''
                    ).trim(),

                lastEventAt:
                    String(
                        profile.lastEventAt ||
                        ''
                    ).trim(),

                lastEventType:
                    String(
                        profile.lastEventType ||
                        ''
                    )
                        .trim()
                        .toLowerCase(),

                source:
                    String(
                        profile.source ||
                        'federation_influence_ledger_v1'
                    ).trim(),

                updatedAt:
                    String(
                        profile.updatedAt ||
                        ''
                    ).trim()
            },

            events,

            fetchedAt:
                String(
                    payload?.fetchedAt ||
                    ''
                ).trim()
        };
    }

    function setFederationInfluenceCache(
        payload = {}
    ) {
        const snapshot =
            normalizeFederationInfluenceSnapshot(
                payload
            );

        const saved =
            writeJsonStorage(
                STORAGE_KEYS.federationInfluence,
                snapshot,
                sessionStorage
            );

        if (saved) {
            window.dispatchEvent(
                new CustomEvent(
                    'yhu:federation-influence-updated',
                    {
                        detail:
                            snapshot
                    }
                )
            );
        }

        return saved;
    }

    function getFederationInfluenceSnapshot() {
        return normalizeFederationInfluenceSnapshot(
            readJsonStorage(
                STORAGE_KEYS.federationInfluence,
                {}
            )
        );
    }

    function getFederationRankProgress(
        rank = {},
        totalInfluence = 0
    ) {
        const total =
            Math.max(
                0,
                Number(totalInfluence) || 0
            );

        const minimum =
            Math.max(
                0,
                Number(rank.minimum) || 0
            );

        const nextAt =
            Math.max(
                minimum,
                Number(rank.nextAt) || minimum
            );

        if (
            rank.nextLabel === 'Max Rank' ||
            nextAt <= minimum
        ) {
            return 100;
        }

        return clampScore(
            (
                (
                    total -
                    minimum
                ) /
                (
                    nextAt -
                    minimum
                )
            ) *
            100
        );
    }

    function getFederationSnapshot() {
        const access =
            readJsonStorage(
                STORAGE_KEYS.federationAccess,
                {}
            );

        const influence =
            getFederationInfluenceSnapshot();

        const profile =
            influence.profile ||
            {};

        const application =
            access.application &&
            typeof access.application === 'object'
                ? access.application
                : {};

        const approved =
            isApprovedAccess(
                access,
                'federation'
            );

        const hasPersistentInfluence =
            influence.loaded === true;

        const totalInfluence =
            Math.max(
                0,
                Number(
                    profile.totalInfluence ||
                    0
                ) || 0
            );

        const weeklyInfluence =
            Math.max(
                0,
                Number(
                    profile.weeklyInfluence ||
                    0
                ) || 0
            );

        const eventCount =
            Math.max(
                0,
                Number(
                    profile.eventCount ||
                    influence.events?.length ||
                    0
                ) || 0
            );

        const rankMeta =
            resolveFederationRank(
                totalInfluence,
                approved
            );

        const rankProgress =
            hasPersistentInfluence
                ? getFederationRankProgress(
                    rankMeta,
                    totalInfluence
                )
                : 0;

        const applicationStatus =
            normalizeStatus(
                access.applicationStatus ||
                application.status ||
                ''
            );

        const rank =
            !approved
                ? 'Observer'
                : hasPersistentInfluence
                    ? rankMeta.label
                    : 'Syncing Ledger';

        const nextObjective =
            !approved
                ? (
                    applicationStatus === 'pending'
                        ? 'Wait for Federation clearance'
                        : 'Activate Federation access'
                )
                : !hasPersistentInfluence
                    ? 'Sync your canonical Influence ledger'
                    : rankMeta.nextLabel === 'Max Rank'
                        ? 'Expand verified Federation impact'
                        : `Reach ${rankMeta.nextLabel} at ${rankMeta.nextAt.toLocaleString()} Influence`;

        return {
            division:
                'federation',

            score:
                rankProgress,

            approved,

            hasVerifiedScore:
                hasPersistentInfluence,

            hasPersistentInfluence,

            isPreview:
                !hasPersistentInfluence,

            rank,

            rankKey:
                rankMeta.key,

            nextRank:
                rankMeta.nextLabel,

            nextRankAt:
                rankMeta.nextAt,

            rankProgress,

            totalInfluence,
            weeklyInfluence,
            eventCount,

            lastEventAt:
                String(
                    profile.lastEventAt ||
                    ''
                ).trim(),

            lastEventType:
                String(
                    profile.lastEventType ||
                    ''
                )
                    .trim()
                    .toLowerCase(),

            mode:
                'Strategic Multiplayer',

            progressionLabel:
                hasPersistentInfluence
                    ? `${totalInfluence.toLocaleString()} canonical Influence`
                    : approved
                        ? 'Syncing canonical Federation Influence'
                        : applicationStatus === 'pending'
                            ? 'Clearance under review'
                            : 'Build strategic readiness',

            nextObjective,
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

        const period =
            String(
                payload?.period ||
                'weekly'
            )
                .trim()
                .toLowerCase() ===
            'all_time'
                ? 'all_time'
                : 'weekly';

        const playerPosition =
            Number(payload?.playerPosition) || null;

        const playerEntry =
            payload?.playerEntry &&
            typeof payload.playerEntry ===
                'object'
                ? payload.playerEntry
                : null;

        const freshness =
            payload?.freshness &&
            typeof payload.freshness ===
                'object'
                ? payload.freshness
                : {};

        const rankingPolicy =
            payload?.rankingPolicy &&
            typeof payload.rankingPolicy ===
                'object'
                ? payload.rankingPolicy
                : {};

        const cachePayload = {
            leaderboard,
            playerPosition,
            playerEntry,

            exactPosition:
                payload?.exactPosition ===
                true,

            totalRanked:
                Math.max(
                    0,
                    Number(
                        payload?.totalRanked ||
                        leaderboard.length ||
                        0
                    ) || 0
                ),

            period,
            freshness,
            rankingPolicy,

            generatedAt:
                String(
                    payload?.generatedAt ||
                    ''
                ).trim(),

            cachedAt:
                new Date().toISOString()
        };

        const saved = writeJsonStorage(
            STORAGE_KEYS.academyLeaderboard,
            cachePayload,
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

                    ...(
                        period === 'all_time'
                            ? {
                                allTimePosition:
                                    playerPosition
                            }
                            : {
                                weeklyPosition:
                                    playerPosition
                            }
                    ),

                    leaderboardFreshness:
                        freshness,

                    leaderboardExactPosition:
                        payload?.exactPosition ===
                        true
                });
            }

            window.dispatchEvent(
                new CustomEvent(
                    'yhu:academy-leaderboard-updated',
                    {
                        detail:
                            cachePayload
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
                playerEntry: null,
                exactPosition: false,
                totalRanked: 0,
                period: 'weekly',
                freshness: {},
                rankingPolicy: {},
                generatedAt: ''
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

        setPlazaReputationCache,
        getPlazaReputationSnapshot,

        setFederationInfluenceCache,
        getFederationInfluenceSnapshot,

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