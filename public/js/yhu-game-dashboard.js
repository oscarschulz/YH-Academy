/* public/js/yhu-game-dashboard.js */
/* YHU Dashboard Game Foundation v1 */

(function installYHUDashboardGameFoundationV1() {
    'use strict';

    if (window.__yhuDashboardGameFoundationV1Installed) return;
    window.__yhuDashboardGameFoundationV1Installed = true;

    const ROOT_ID = 'yh-game-foundation-v1';

    let academyProgressionLoadPromise = null;
    let academyProgressionLoaded = false;
    let academySoloModeStateV1 = null;
    let academyQuestAchievementStateV1 = null;
    let plazaExplorerPreviewStateV2 = null;
    let plazaReputationLoadPromiseV1 = null;
    let plazaReputationLoadedV1 = false;
    let federationInfluenceLoadPromiseV1 = null;
    let federationInfluenceLoadedV1 = false;
    let federationStrategicPreviewStateV1 = null;

    /* PATCH: Live Squad UI state v1 */
    let academySquadLoadPromise = null;
    let academySquadLoaded = false;
    let academySquadRequestBusy = false;
    let academySquadRankingLoadPromise = null;
    let academySquadLiveSyncPromise = null;

    let academyGameBootPromiseV1 = null;
    let academyGameLastRefreshAtV1 = 0;

    const academyGameRenderRetryTimersV1 =
        new Set();

    /* PATCH: Shared Squad Missions UI state v1 */
    let academySquadMissionsLoadPromise = null;

    let academySquadMissionsStateV1 = {
        loaded: false,
        loading: false,
        canManage: false,
        role: '',
        filter: 'all',
        missions: []
    };

    /*
     * Squad Mission contribution-history cache.
     * One cache entry and one request promise per mission.
     */
    const academySquadMissionHistoryCacheV1 =
        new Map();

    const academySquadMissionHistoryPromisesV1 =
        new Map();

    const ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1 =
        'yh_academy_squad_mission_celebrations_seen_v1';

    const academySquadMissionCelebrationQueueV1 =
        [];

    let academySquadMissionCelebrationActiveV1 =
        false;

    let academySquadMissionCelebrationCurrentIdV1 =
        '';
    /* END PATCH: Shared Squad Missions UI state v1 */

    /* END PATCH: Live Squad UI state v1 */

    function getStoredAuthToken() {
        try {
            if (
                typeof window.YHSharedCore?.getStoredAuthToken ===
                'function'
            ) {
                return String(
                    window.YHSharedCore.getStoredAuthToken() || ''
                ).trim();
            }
        } catch (_) {}

        try {
            return String(
                sessionStorage.getItem('yh_token') ||
                localStorage.getItem('yh_token') ||
                sessionStorage.getItem('token') ||
                localStorage.getItem('token') ||
                ''
            ).trim();
        } catch (_) {
            return '';
        }
    }

    async function fetchAcademyGameJson(
        url = '',
        options = {}
    ) {
        const token =
            getStoredAuthToken();

        const method =
            String(
                options.method || 'GET'
            ).toUpperCase();

        const headers = {
            Accept: 'application/json',
            ...(
                options.headers &&
                typeof options.headers ===
                    'object'
                    ? options.headers
                    : {}
            )
        };

        if (token) {
            headers.Authorization =
                `Bearer ${token}`;
        }

        let body =
            options.body;

        if (
            body &&
            typeof body === 'object' &&
            !(body instanceof FormData) &&
            !(body instanceof Blob)
        ) {
            headers['Content-Type'] =
                'application/json';

            body =
                JSON.stringify(body);
        }

        const response =
            await fetch(
                url,
                {
                    method,
                    credentials: 'include',
                    headers,
                    body:
                        method === 'GET' ||
                        method === 'HEAD'
                            ? undefined
                            : body,
                    cache: 'no-store'
                }
            );

        const payload =
            await response
                .json()
                .catch(() => ({}));

        if (
            !response.ok ||
            payload?.success === false
        ) {
            const error =
                new Error(
                    payload?.message ||
                    `Academy request failed (${response.status}).`
                );

            error.status =
                response.status;

            throw error;
        }

        return payload;
    }

    async function loadPlazaReputationOnceV1({
        force = false
    } = {}) {
        if (plazaReputationLoadPromiseV1) {
            return plazaReputationLoadPromiseV1;
        }

        if (
            plazaReputationLoadedV1 &&
            !force
        ) {
            return true;
        }

        plazaReputationLoadPromiseV1 =
            fetchAcademyGameJson(
                '/api/plaza/reputation?limit=50',
                {
                    method:
                        'GET'
                }
            )
                .then((payload) => {
                    plazaReputationLoadedV1 =
                        true;

                    window.YHUGameCore
                        ?.setPlazaReputationCache?.(
                            payload || {}
                        );

                    renderDashboardGameFoundation();

                    return true;
                })
                .catch((error) => {
                    console.error(
                        'loadPlazaReputationOnceV1 error:',
                        error
                    );

                    return false;
                })
                .finally(() => {
                    plazaReputationLoadPromiseV1 =
                        null;
                });

        return plazaReputationLoadPromiseV1;
    }

    async function loadFederationInfluenceOnceV1({
        force = false
    } = {}) {
        if (federationInfluenceLoadPromiseV1) {
            return federationInfluenceLoadPromiseV1;
        }

        if (
            federationInfluenceLoadedV1 &&
            !force
        ) {
            return true;
        }

        federationInfluenceLoadPromiseV1 =
            fetchAcademyGameJson(
                '/api/federation/influence?limit=50',
                {
                    method:
                        'GET'
                }
            )
                .then((payload) => {
                    federationInfluenceLoadedV1 =
                        true;

                    window.YHUGameCore
                        ?.setFederationInfluenceCache?.(
                            payload || {}
                        );

                    renderDashboardGameFoundation();

                    return true;
                })
                .catch((error) => {
                    const status =
                        Number(
                            error?.status ||
                            0
                        );

                    if (
                        status !== 401 &&
                        status !== 403
                    ) {
                        console.error(
                            'loadFederationInfluenceOnceV1 error:',
                            error
                        );
                    }

                    return false;
                })
                .finally(() => {
                    federationInfluenceLoadPromiseV1 =
                        null;
                });

        return federationInfluenceLoadPromiseV1;
    }


    /* PATCH: Phase 3C.7B — Dashboard Solo Mode preview v1 */

    function extractAcademySoloModeV1(
        payload = {}
    ) {
        const progression =
            payload?.progression &&
            typeof payload.progression ===
                'object'
                ? payload.progression
                : payload;

        return (
            progression?.soloMode &&
            typeof progression.soloMode ===
                'object'
                ? progression.soloMode
                : null
        );
    }

    function syncAcademySoloModeStateV1(
        payload = {}
    ) {
        const soloMode =
            extractAcademySoloModeV1(
                payload
            );

        if (!soloMode) {
            return null;
        }

        academySoloModeStateV1 = {
            ...soloMode,

            campaign:
                soloMode?.campaign &&
                typeof soloMode.campaign ===
                    'object'
                    ? {
                        ...soloMode.campaign
                    }
                    : {},

            attributes:
                soloMode?.attributes &&
                typeof soloMode.attributes ===
                    'object'
                    ? {
                        ...soloMode.attributes
                    }
                    : {},

            streak:
                soloMode?.streak &&
                typeof soloMode.streak ===
                    'object'
                    ? {
                        ...soloMode.streak
                    }
                    : {},

            campaignMilestones:
                soloMode?.campaignMilestones &&
                typeof soloMode
                    .campaignMilestones ===
                    'object'
                    ? {
                        ...soloMode
                            .campaignMilestones
                    }
                    : {}
        };

        return academySoloModeStateV1;
    }

    function readAcademySoloModeSessionV1() {
        try {
            const parsed =
                JSON.parse(
                    sessionStorage.getItem(
                        'yh_academy_progression_v1'
                    ) || 'null'
                );

            return extractAcademySoloModeV1(
                parsed?.progression ||
                parsed ||
                {}
            );
        } catch (_) {
            return null;
        }
    }

    function buildAcademySoloModePreviewV1() {
        const soloMode =
            academySoloModeStateV1 ||
            readAcademySoloModeSessionV1();

        if (!soloMode) {
            return `
                <div class="yh-game-solo-preview-v1 is-loading">
                    <small>Solo Campaign</small>

                    <strong>
                        Syncing verified progress...
                    </strong>
                </div>
            `;
        }

        const campaign =
            soloMode?.campaign &&
            typeof soloMode.campaign ===
                'object'
                ? soloMode.campaign
                : {};

        const completed =
            Math.max(
                0,
                Math.round(
                    Number(
                        campaign.completed || 0
                    )
                )
            );

        const total =
            Math.max(
                0,
                Math.round(
                    Number(
                        campaign.total || 0
                    )
                )
            );

        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        Number(
                            campaign.percentage || 0
                        )
                    )
                )
            );

        const verifiedMissionCount =
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode
                            ?.verifiedMissionCount ||
                        0
                    )
                )
            );

        const totalGrowthPoints =
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode
                            ?.totalGrowthPoints ||
                        0
                    )
                )
            );

        const strongest =
            soloMode?.strongestGrowthArea &&
            typeof soloMode
                .strongestGrowthArea ===
                'object'
                ? soloMode
                    .strongestGrowthArea
                : null;

        const strongestLabel =
            String(
                strongest?.label ||
                'Not established'
            ).trim();

        const strongestPoints =
            Math.max(
                0,
                Math.round(
                    Number(
                        strongest?.points || 0
                    )
                )
            );

        const streak =
            soloMode?.streak &&
            typeof soloMode.streak ===
                'object'
                ? soloMode.streak
                : {};

        const currentStreak =
            Math.max(
                0,
                Math.round(
                    Number(
                        streak.current || 0
                    )
                )
            );

        const nextStreak =
            Number.isFinite(
                Number(
                    streak.nextMilestone
                )
            )
                ? Math.max(
                    0,
                    Math.round(
                        Number(
                            streak.nextMilestone
                        )
                    )
                )
                : null;

        const campaignMilestones =
            soloMode?.campaignMilestones &&
            typeof soloMode
                .campaignMilestones ===
                'object'
                ? soloMode
                    .campaignMilestones
                : {};

        const latestCampaignMilestone =
            Number.isFinite(
                Number(
                    campaignMilestones.latest
                )
            )
                ? Math.max(
                    0,
                    Math.round(
                        Number(
                            campaignMilestones.latest
                        )
                    )
                )
                : null;

        const nextCampaignMilestone =
            Number.isFinite(
                Number(
                    campaignMilestones.next
                )
            )
                ? Math.max(
                    0,
                    Math.round(
                        Number(
                            campaignMilestones.next
                        )
                    )
                )
                : null;

        return `
            <div class="yh-game-solo-preview-v1">
                <div class="yh-game-solo-preview-head-v1">
                    <div>
                        <small>
                            Solo Campaign
                        </small>

                        <strong>
                            ${
                                escapeHtml(
                                    campaign.goal ||
                                    'Personal Roadmap'
                                )
                            }
                        </strong>
                    </div>

                    <span>
                        ${percentage}%
                    </span>
                </div>

                <div
                    class="yh-game-solo-preview-track-v1"
                    aria-hidden="true"
                >
                    <span
                        style="width:${percentage}%"
                    ></span>
                </div>

                <div class="yh-game-solo-preview-stats-v1">
                    <span>
                        <b>${completed}/${total}</b>
                        Campaign
                    </span>

                    <span>
                        <b>${verifiedMissionCount}</b>
                        Verified
                    </span>

                    <span>
                        <b>${totalGrowthPoints}</b>
                        Growth
                    </span>
                </div>

                <div class="yh-game-solo-preview-strongest-v1">
                    <small>
                        Strongest Growth
                    </small>

                    <strong>
                        ${escapeHtml(strongestLabel)}
                        ${
                            strongestPoints > 0
                                ? `<span>+${strongestPoints}</span>`
                                : ''
                        }
                    </strong>
                </div>

                <div class="yh-game-solo-preview-milestones-v1">
                    <span>
                        <small>Solo Streak</small>
                        <strong>
                            ${currentStreak}
                            ${currentStreak === 1 ? 'day' : 'days'}
                        </strong>
                    </span>

                    <span>
                        <small>Next Streak</small>
                        <strong>
                            ${
                                nextStreak
                                    ? `${nextStreak} days`
                                    : 'Core complete'
                            }
                        </strong>
                    </span>

                    <span>
                        <small>Campaign</small>
                        <strong>
                            ${
                                latestCampaignMilestone
                                    ? `${latestCampaignMilestone}% reached`
                                    : nextCampaignMilestone
                                        ? `Next ${nextCampaignMilestone}%`
                                        : 'Complete'
                            }
                        </strong>
                    </span>
                </div>
            </div>
        `;
    }

    /* PATCH: Academy Quest and Achievement Dashboard preview v1 */

    function extractAcademyQuestAchievementStateV1(
        payload = {}
    ) {
        if (
            payload?.questAchievementState &&
            typeof payload.questAchievementState ===
                'object'
        ) {
            return payload.questAchievementState;
        }

        if (
            payload?.quests &&
            typeof payload.quests === 'object' &&
            payload?.achievements &&
            typeof payload.achievements === 'object'
        ) {
            return {
                version:
                    payload?.questPersistence?.version ||
                    'academy-quest-achievement-v1',

                serverBacked:
                    payload?.questPersistence?.serverBacked ===
                    true,

                persistent:
                    payload?.questPersistence?.persistent ===
                    true,

                quests:
                    payload.quests,

                achievements:
                    payload.achievements
            };
        }

        return null;
    }

    function syncAcademyQuestAchievementStateV1(
        payload = {}
    ) {
        const state =
            extractAcademyQuestAchievementStateV1(
                payload
            );

        if (!state) {
            return null;
        }

        academyQuestAchievementStateV1 = {
            ...state,

            quests:
                state?.quests &&
                typeof state.quests ===
                    'object'
                    ? {
                        ...state.quests,

                        daily:
                            Array.isArray(
                                state.quests.daily
                            )
                                ? state.quests.daily.map(
                                    (quest) => ({
                                        ...quest
                                    })
                                )
                                : [],

                        weekly:
                            Array.isArray(
                                state.quests.weekly
                            )
                                ? state.quests.weekly.map(
                                    (quest) => ({
                                        ...quest
                                    })
                                )
                                : []
                    }
                    : {},

            achievements:
                state?.achievements &&
                typeof state.achievements ===
                    'object'
                    ? {
                        ...state.achievements,

                        unlocked:
                            Array.isArray(
                                state.achievements
                                    .unlocked
                            )
                                ? state.achievements
                                    .unlocked
                                    .map(
                                        (achievement) => ({
                                            ...achievement
                                        })
                                    )
                                : [],

                        primary:
                            state.achievements
                                .primary &&
                            typeof state.achievements
                                .primary ===
                                'object'
                                ? {
                                    ...state.achievements
                                        .primary
                                }
                                : null
                    }
                    : {}
        };

        return academyQuestAchievementStateV1;
    }

    function buildAcademyQuestAchievementPreviewV1() {
        const state =
            academyQuestAchievementStateV1;

        if (!state) {
            return `
                <div class="yh-game-solo-preview-v1 is-loading">
                    <small>Quest Ledger</small>

                    <strong>
                        Syncing server-backed quests...
                    </strong>
                </div>
            `;
        }

        const quests =
            state?.quests &&
            typeof state.quests ===
                'object'
                ? state.quests
                : {};

        const achievements =
            state?.achievements &&
            typeof state.achievements ===
                'object'
                ? state.achievements
                : {};

        const completedUnclaimed =
            Math.max(
                0,
                Math.round(
                    Number(
                        quests.completedUnclaimed ||
                        0
                    )
                )
            );

        const claimed =
            Math.max(
                0,
                Math.round(
                    Number(
                        quests.claimed ||
                        0
                    )
                )
            );

        const unlockedCount =
            Math.max(
                0,
                Math.round(
                    Number(
                        achievements.unlockedCount ||
                        0
                    )
                )
            );

        const totalAvailable =
            Math.max(
                0,
                Math.round(
                    Number(
                        achievements.totalAvailable ||
                        0
                    )
                )
            );

        const primary =
            achievements.primary &&
            typeof achievements.primary ===
                'object'
                ? achievements.primary
                : null;

        const primaryLabel =
            String(
                primary?.label ||
                'No achievement unlocked'
            ).trim();

        const rarity =
            String(
                primary.rarity ||
                'Locked'
            ).trim();

        const helperScore =
            achievements.helperScore &&
            typeof achievements.helperScore ===
                'object'
                ? achievements.helperScore
                : {};

        const helperScoreValue =
            Math.max(
                0,
                Math.round(
                    Number(
                        helperScore.value ||
                        0
                    )
                )
            );

        const helperWeeklyValue =
            Math.max(
                0,
                Math.round(
                    Number(
                        helperScore.weeklyValue ||
                        0
                    )
                )
            );

        const persistenceLabel =
            state.serverBacked === true &&
            state.persistent === true
                ? 'Persistent'
                : 'Server state pending';

        return `
            <div class="yh-game-solo-preview-v1">
                <div class="yh-game-solo-preview-head-v1">
                    <div>
                        <small>
                            Quest Ledger
                        </small>

                        <strong>
                            ${escapeHtml(
                                persistenceLabel
                            )}
                        </strong>
                    </div>

                    <span>
                        ${completedUnclaimed}
                    </span>
                </div>

                <div class="yh-game-solo-preview-stats-v1">
                    <span>
                        <b>${completedUnclaimed}</b>
                        Ready
                    </span>

                    <span>
                        <b>${claimed}</b>
                        Claimed
                    </span>

                    <span>
                        <b>${unlockedCount}/${totalAvailable}</b>
                        Achievements
                    </span>
                </div>

                <div class="yh-game-solo-preview-strongest-v1">
                    <small>
                        Primary Achievement • Helper Score
                    </small>

                    <strong>
                        ${escapeHtml(primaryLabel)}

                        <span>
                            ${escapeHtml(rarity)} •
                            ${helperScoreValue.toLocaleString()} total •
                            ${helperWeeklyValue.toLocaleString()} weekly
                        </span>
                    </strong>
                </div>
            </div>
        `;
    }

    /* END PATCH: Academy Quest and Achievement Dashboard preview v1 */

    /* END PATCH: Phase 3C.7B — Dashboard Solo Mode preview v1 */

    async function loadAcademyProgressionOnce({
        force = false
    } = {}) {
        if (academyProgressionLoadPromise) {
            return academyProgressionLoadPromise;
        }

        if (
            academyProgressionLoaded &&
            !force
        ) {
            return true;
        }

        academyProgressionLoadPromise = (async () => {
            try {
                const progressionPayload =
                    await fetchAcademyGameJson(
                        '/api/academy/progression'
                    );

                syncAcademySoloModeStateV1(
                    progressionPayload
                );

                syncAcademyQuestAchievementStateV1(
                    progressionPayload
                );

                window.YHUGameCore
                    ?.setAcademyProgressionCache?.(
                        progressionPayload
                    );

                renderDashboardGameFoundation();

                /*
                  Leaderboard is intentionally requested after
                  progression so the main Academy card updates first.
                */
                try {
                    const leaderboardPayload =
                        await fetchAcademyGameJson(
                            '/api/academy/leaderboard' +
                            '?period=weekly&limit=5'
                        );

                    window.YHUGameCore
                        ?.setAcademyLeaderboardCache?.(
                            leaderboardPayload
                        );

                    renderDashboardGameFoundation();
                } catch (leaderboardError) {
                    console.warn(
                        'Academy leaderboard preview unavailable:',
                        leaderboardError?.message ||
                        leaderboardError
                    );
                }

                academyProgressionLoaded = true;
                return true;
            } catch (error) {
                /*
                  403 is expected for members without approved
                  Academy access. Preserve the safe local preview.
                */
                if (
                    Number(error?.status) !== 403 &&
                    Number(error?.status) !== 401
                ) {
                    console.warn(
                        'Academy progression unavailable:',
                        error?.message || error
                    );
                }

                return false;
            } finally {
                academyProgressionLoadPromise = null;
            }
        })();

        return academyProgressionLoadPromise;
    }

        /* PATCH: Live Academy Squad Dashboard UI v1 */

    function setSquadButtonBusyV1(
        button,
        busy = false,
        busyLabel = 'Loading...'
    ) {
        if (!(button instanceof HTMLElement)) {
            return;
        }

        if (!button.dataset.idleLabel) {
            button.dataset.idleLabel =
                String(
                    button.textContent || ''
                ).trim();
        }

        button.disabled =
            busy === true;

        button.setAttribute(
            'aria-busy',
            busy ? 'true' : 'false'
        );

        button.textContent =
            busy
                ? busyLabel
                : (
                    button.dataset.idleLabel ||
                    'Continue'
                );
    }

    async function loadAcademySquadV1({
        force = false
    } = {}) {
        if (
            academySquadLoaded &&
            !force
        ) {
            return true;
        }

        if (
            academySquadLoadPromise
        ) {
            return academySquadLoadPromise;
        }

        academySquadLoadPromise =
            (async () => {
                try {
                    const squadPayload =
                        await fetchAcademyGameJson(
                            '/api/academy/squad'
                        );

                    const payload =
                        await loadAcademySquadRankingsV1(
                            squadPayload
                        );

                    window.YHUGameCore
                        ?.setAcademySquadCacheV1?.(
                            payload
                        );

                    academySquadLoaded = true;

                    renderDashboardGameFoundation();

                    return true;
                } catch (error) {
                    if (
                        Number(error?.status) !== 401 &&
                        Number(error?.status) !== 403
                    ) {
                        console.warn(
                            'Academy squad unavailable:',
                            error?.message ||
                            error
                        );
                    }

                    return false;
                } finally {
                    academySquadLoadPromise =
                        null;
                }
            })();

        return academySquadLoadPromise;
    }
async function loadAcademySquadRankingsV1(
    squadPayload = {}
) {
    if (
        !squadPayload?.joined ||
        !squadPayload?.squad
    ) {
        return squadPayload;
    }

    if (
        academySquadRankingLoadPromise
    ) {
        return academySquadRankingLoadPromise;
    }

    academySquadRankingLoadPromise =
        (async () => {
            const [
                weeklyLeaderboard,
                allTimeLeaderboard,
                weeklyContributors,
                allTimeContributors
            ] =
                await Promise.all([
                    fetchAcademyGameJson(
                        '/api/academy/squad/leaderboard' +
                        '?period=weekly&limit=10'
                    ).catch(() => null),

                    fetchAcademyGameJson(
                        '/api/academy/squad/leaderboard' +
                        '?period=all_time&limit=10'
                    ).catch(() => null),

                    fetchAcademyGameJson(
                        '/api/academy/squad/contributors' +
                        '?period=weekly&limit=10'
                    ).catch(() => null),

                    fetchAcademyGameJson(
                        '/api/academy/squad/contributors' +
                        '?period=all_time&limit=10'
                    ).catch(() => null)
                ]);

            return {
                ...squadPayload,

                weeklyLeaderboard:
                    weeklyLeaderboard ||
                    {
                        leaderboard: [],
                        currentSquadPosition:
                            null
                    },

                allTimeLeaderboard:
                    allTimeLeaderboard ||
                    {
                        leaderboard: [],
                        currentSquadPosition:
                            null
                    },

                weeklyContributors:
                    weeklyContributors ||
                    {
                        contributors: []
                    },

                allTimeContributors:
                    allTimeContributors ||
                    {
                        contributors: []
                    }
            };
        })()
            .finally(() => {
                academySquadRankingLoadPromise =
                    null;
            });

    return academySquadRankingLoadPromise;
}
    /* PATCH: Shared Squad Missions API helpers v1 */

    async function loadAcademySquadMissionsV1({
        force = false
    } = {}) {
        if (
            academySquadMissionsStateV1.loaded &&
            !force
        ) {
            return academySquadMissionsStateV1;
        }

        if (
            academySquadMissionsLoadPromise
        ) {
            return academySquadMissionsLoadPromise;
        }

        academySquadMissionsStateV1 = {
            ...academySquadMissionsStateV1,
            loading: true
        };

        academySquadMissionsLoadPromise =
            (async () => {
                try {
                    const payload =
                        await fetchAcademyGameJson(
                            '/api/academy/squad/missions?limit=100'
                        );

                    academySquadMissionsStateV1 = {
                        ...academySquadMissionsStateV1,
                        loaded: true,
                        loading: false,

                        canManage:
                            payload?.canManage === true,

                        role:
                            String(
                                payload?.role || ''
                            )
                                .trim()
                                .toLowerCase(),

                        missions:
                            Array.isArray(
                                payload?.missions
                            )
                                ? payload.missions
                                : []
                    };

                    return academySquadMissionsStateV1;
                } catch (error) {
                    academySquadMissionsStateV1 = {
                        ...academySquadMissionsStateV1,
                        loaded: true,
                        loading: false,
                        missions: []
                    };

                    throw error;
                } finally {
                    academySquadMissionsLoadPromise =
                        null;
                }
            })();

        return academySquadMissionsLoadPromise;
    }

    function normalizeSquadMissionStatusV1(
        value = ''
    ) {
        const clean =
            String(value || '')
                .trim()
                .toLowerCase();

        return [
            'active',
            'completed',
            'cancelled'
        ].includes(clean)
            ? clean
            : 'active';
    }

    function formatSquadMissionTypeV1(
        value = ''
    ) {
        const labels = {
            academy_missions:
                'Academy Missions',

            verified_leads:
                'Verified Leads',

            daily_checkins:
                'Daily Check-ins',

            squad_xp:
                'Squad XP',

            mission_playbooks:
                'Mission Playbooks',

            custom:
                'Custom Mission'
        };

        return (
            labels[
                String(value || '')
                    .trim()
                    .toLowerCase()
            ] ||
            'Custom Mission'
        );
    }

    function formatSquadMissionDeadlineV1(
        value = ''
    ) {
        const clean =
            String(value || '').trim();

        if (!clean) {
            return 'No deadline';
        }

        const date =
            new Date(clean);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return 'No deadline';
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }
        ).format(date);
    }
    async function loadSquadMissionHistoryV1(
        missionId = '',
        {
            force = false
        } = {}
    ) {
        const cleanMissionId =
            String(
                missionId || ''
            ).trim();

        if (!cleanMissionId) {
            throw new Error(
                'Squad mission ID is required.'
            );
        }

        if (
            !force &&
            academySquadMissionHistoryCacheV1
                .has(cleanMissionId)
        ) {
            return academySquadMissionHistoryCacheV1
                .get(cleanMissionId);
        }

        if (
            academySquadMissionHistoryPromisesV1
                .has(cleanMissionId)
        ) {
            return academySquadMissionHistoryPromisesV1
                .get(cleanMissionId);
        }

        const request =
            fetchAcademyGameJson(
                (
                    '/api/academy/squad/missions/' +
                    encodeURIComponent(
                        cleanMissionId
                    ) +
                    '/contributions?limit=100'
                )
            )
                .then((payload) => {
                    academySquadMissionHistoryCacheV1
                        .set(
                            cleanMissionId,
                            payload
                        );

                    return payload;
                })
                .finally(() => {
                    academySquadMissionHistoryPromisesV1
                        .delete(
                            cleanMissionId
                        );
                });

        academySquadMissionHistoryPromisesV1
            .set(
                cleanMissionId,
                request
            );

        return request;
    }

    function formatSquadContributionTimeV1(
        value = ''
    ) {
        const clean =
            String(value || '').trim();

        if (!clean) {
            return 'Time unavailable';
        }

        const date =
            new Date(clean);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return 'Time unavailable';
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }
        ).format(date);
    }

    function getPrimaryActiveSquadMissionV1() {
        const missions =
            Array.isArray(
                academySquadMissionsStateV1
                    .missions
            )
                ? academySquadMissionsStateV1
                    .missions
                : [];

        return (
            missions
                .filter((mission) => {
                    return (
                        normalizeSquadMissionStatusV1(
                            mission.status
                        ) === 'active'
                    );
                })
                .sort((a, b) => {
                    const aDeadline =
                        a.deadline
                            ? new Date(
                                a.deadline
                            ).getTime()
                            : Number.MAX_SAFE_INTEGER;

                    const bDeadline =
                        b.deadline
                            ? new Date(
                                b.deadline
                            ).getTime()
                            : Number.MAX_SAFE_INTEGER;

                    if (
                        aDeadline !==
                        bDeadline
                    ) {
                        return (
                            aDeadline -
                            bDeadline
                        );
                    }

                    return (
                        new Date(
                            a.createdAt || 0
                        ).getTime() -
                        new Date(
                            b.createdAt || 0
                        ).getTime()
                    );
                })[0] ||
            null
        );
    }
    function getSquadMissionProgressV1(
        mission = {}
    ) {
        const target =
            Math.max(
                1,
                Number(
                    mission.target || 1
                )
            );

        const progress =
            Math.max(
                0,
                Math.min(
                    target,
                    Number(
                        mission.progress || 0
                    )
                )
            );

        const percent =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        (
                            progress /
                            target
                        ) * 100
                    )
                )
            );

        return {
            target,
            progress,
            percent
        };
    }

    function buildSquadWorkspaceTabsV1(
        activeTab = 'overview'
    ) {
        return `
            <nav
                class="yh-game-squad-workspace-tabs"
                aria-label="Squad workspace"
            >
                <button
                    type="button"
                    class="${
                        activeTab === 'overview'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-workspace-tab="overview"
                >
                    Overview
                </button>

                <button
                    type="button"
                    class="${
                        activeTab === 'missions'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-workspace-tab="missions"
                >
                    Missions
                </button>

                <button
                    type="button"
                    class="${
                        activeTab === 'rankings'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-workspace-tab="rankings"
                >
                    Rankings
                </button>

                <button
                    type="button"
                    class="${
                        activeTab === 'members'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-workspace-tab="members"
                >
                    Members
                </button>

                <button
                    type="button"
                    class="${
                        activeTab === 'activity'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-workspace-tab="activity"
                >
                    Activity
                </button>
            </nav>
        `;
    }

    /* END PATCH: Shared Squad Missions API helpers v1 */
    function ensureSquadModalV1() {
        let modal =
            document.getElementById(
                'yh-game-squad-modal'
            );

        if (modal) {
            return modal;
        }

        modal =
            document.createElement('div');

        modal.id =
            'yh-game-squad-modal';

        modal.className =
            'yh-game-squad-modal hidden-step';

        modal.setAttribute(
            'role',
            'dialog'
        );

        modal.setAttribute(
            'aria-modal',
            'true'
        );

        modal.setAttribute(
            'aria-hidden',
            'true'
        );

        modal.innerHTML = `
            <div class="yh-game-squad-modal-card">
                <button
                    type="button"
                    class="yh-game-squad-modal-close"
                    data-yh-squad-modal-close
                    aria-label="Close"
                >
                    ×
                </button>

                <div
                    id="yh-game-squad-modal-content"
                    class="yh-game-squad-modal-content"
                ></div>
            </div>
        `;

        document.body.appendChild(
            modal
        );

        modal.addEventListener(
            'click',
            (event) => {
                const closeButton =
                    event.target.closest(
                        '[data-yh-squad-modal-close]'
                    );

                if (closeButton) {
                    closeSquadModalV1();
                    return;
                }

                /*
                 * Backdrop clicks must not close the Squad workspace
                 * because Create/Edit Mission forms may contain
                 * unsaved user input.
                 */
                if (event.target === modal) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        );

        return modal;
    }

function openSquadModalV1(
    html = ''
) {
    const modal =
        ensureSquadModalV1();

    const card =
        modal.querySelector(
            '.yh-game-squad-modal-card'
        );

    const content =
        modal.querySelector(
            '#yh-game-squad-modal-content'
        );

    const cleanHtml =
        String(html || '');

    /*
     * Use the wider workspace layout for:
     * - Overview
     * - Missions
     * - Rankings
     * - Members
     * - Activity
     * - Create/Edit Squad Mission form
     *
     * Keep Create Squad and Search Squad forms compact.
     */
    const workspaceMode =
        cleanHtml.includes(
            'yh-game-squad-workspace-tabs'
        ) ||
        cleanHtml.includes(
            'yh-game-squad-mission-form'
        );

    card?.classList.toggle(
        'is-workspace',
        workspaceMode
    );

    if (content) {
        content.innerHTML =
            cleanHtml;

        content.scrollTop = 0;
    }

    modal.classList.remove(
        'hidden-step'
    );

    modal.setAttribute(
        'aria-hidden',
        'false'
    );

    document.body.classList.add(
        'yh-game-squad-modal-open'
    );
}

    function closeSquadModalV1() {
        const modal =
            document.getElementById(
                'yh-game-squad-modal'
            );

        modal?.classList.add(
            'hidden-step'
        );

        modal?.setAttribute(
            'aria-hidden',
            'true'
        );

        document.body.classList.remove(
            'yh-game-squad-modal-open'
        );
    }

    function openCreateSquadModalV1() {
        openSquadModalV1(`
            <div class="yh-game-squad-modal-kicker">
                Squad Foundation
            </div>

            <h2>Create Your Squad</h2>

            <p class="yh-game-squad-modal-copy">
                Build a small Academy team for future shared missions,
                operations, and squad rankings.
            </p>

            <form id="yh-game-create-squad-form">
                <label>
                    <span>Squad Name</span>

                    <input
                        type="text"
                        name="name"
                        maxlength="60"
                        minlength="3"
                        required
                        placeholder="Example: Orbit Builders"
                    >
                </label>

                <label>
                    <span>Emblem</span>

                    <select name="emblem">
                        <option value="⚡">⚡ Lightning</option>
                        <option value="🚀">🚀 Rocket</option>
                        <option value="🛡️">🛡️ Shield</option>
                        <option value="🔥">🔥 Flame</option>
                        <option value="🌐">🌐 Network</option>
                        <option value="⭐">⭐ Star</option>
                    </select>
                </label>

                <label>
                    <span>Description</span>

                    <textarea
                        name="description"
                        maxlength="240"
                        rows="4"
                        placeholder="What is your squad building together?"
                    ></textarea>
                </label>

                <div
                    class="yh-game-squad-form-error hidden-step"
                    data-yh-squad-form-error
                    role="alert"
                ></div>

                <div class="yh-game-squad-form-actions">
                    <button
                        type="button"
                        class="yh-game-squad-secondary"
                        data-yh-squad-modal-close
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        class="yh-game-squad-primary"
                    >
                        Create Squad
                    </button>
                </div>
            </form>
        `);

        const form =
            document.getElementById(
                'yh-game-create-squad-form'
            );

        form?.addEventListener(
            'submit',
            submitCreateSquadV1
        );

        form?.querySelector(
            'input[name="name"]'
        )?.focus();
    }

function openJoinSquadModalV1() {
    openSquadModalV1(`
        <div class="yh-game-squad-modal-kicker">
            Squad Discovery
        </div>

        <h2>Search for Squad</h2>

        <p class="yh-game-squad-modal-copy">
            Enter the invitation code shared by the squad owner.
            You will see the squad details before joining.
        </p>

        <form id="yh-game-search-squad-form">
            <label>
                <span>Squad Invitation Code</span>

                <input
                    type="text"
                    name="inviteCode"
                    maxlength="10"
                    required
                    autocomplete="off"
                    placeholder="Example: A1B2C3D4"
                >
            </label>

            <div
                class="yh-game-squad-form-error hidden-step"
                data-yh-squad-form-error
                role="alert"
            ></div>

            <div class="yh-game-squad-form-actions">
                <button
                    type="button"
                    class="yh-game-squad-secondary"
                    data-yh-squad-modal-close
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    class="yh-game-squad-primary"
                >
                    Search Squad
                </button>
            </div>
        </form>
    `);

    const form =
        document.getElementById(
            'yh-game-search-squad-form'
        );

    form?.addEventListener(
        'submit',
        submitSearchSquadV1
    );

    form?.querySelector(
        'input[name="inviteCode"]'
    )?.focus();
}

    function setSquadFormErrorV1(
        form,
        message = ''
    ) {
        const box =
            form?.querySelector(
                '[data-yh-squad-form-error]'
            );

        if (!box) return;

        const clean =
            String(message || '').trim();

        box.textContent =
            clean;

        box.classList.toggle(
            'hidden-step',
            !clean
        );
    }

    async function submitCreateSquadV1(
        event
    ) {
        event.preventDefault();

        if (academySquadRequestBusy) {
            return;
        }

        const form =
            event.currentTarget;

        const button =
            form.querySelector(
                'button[type="submit"]'
            );

        const data =
            new FormData(form);

        const payload = {
            name:
                String(
                    data.get('name') || ''
                ).trim(),

            emblem:
                String(
                    data.get('emblem') ||
                    '⚡'
                ).trim(),

            description:
                String(
                    data.get(
                        'description'
                    ) || ''
                ).trim()
        };

        if (
            payload.name.length < 3
        ) {
            setSquadFormErrorV1(
                form,
                'Squad name must contain at least 3 characters.'
            );

            return;
        }

        academySquadRequestBusy = true;

        setSquadFormErrorV1(
            form,
            ''
        );

        setSquadButtonBusyV1(
            button,
            true,
            'Creating...'
        );

        try {
            const result =
                await fetchAcademyGameJson(
                    '/api/academy/squad',
                    {
                        method: 'POST',
                        body: payload
                    }
                );

            window.YHUGameCore
                ?.setAcademySquadCacheV1?.(
                    result
                );

            academySquadLoaded = true;

            closeSquadModalV1();
            renderDashboardGameFoundation();

            window.YHSharedCore
                ?.showToast?.(
                    'Squad created successfully.',
                    'success'
                );
        } catch (error) {
            setSquadFormErrorV1(
                form,
                error?.message ||
                'Failed to create squad.'
            );
        } finally {
            academySquadRequestBusy =
                false;

            setSquadButtonBusyV1(
                button,
                false
            );
        }
    }

    async function submitSearchSquadV1(
    event
) {
    event.preventDefault();

    if (academySquadRequestBusy) {
        return;
    }

    const form =
        event.currentTarget;

    const button =
        form.querySelector(
            'button[type="submit"]'
        );

    const inviteCode =
        String(
            new FormData(form)
                .get('inviteCode') ||
            ''
        )
            .trim()
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ''
            );

    if (!inviteCode) {
        setSquadFormErrorV1(
            form,
            'Squad invitation code is required.'
        );

        return;
    }

    academySquadRequestBusy = true;

    setSquadFormErrorV1(
        form,
        ''
    );

    setSquadButtonBusyV1(
        button,
        true,
        'Searching...'
    );

    try {
        const result =
            await fetchAcademyGameJson(
                (
                    '/api/academy/squad/search' +
                    '?inviteCode=' +
                    encodeURIComponent(
                        inviteCode
                    )
                )
            );

        openSquadSearchResultV1(
            result?.squad || {},
            inviteCode
        );
    } catch (error) {
        setSquadFormErrorV1(
            form,
            error?.message ||
            'No squad was found.'
        );
    } finally {
        academySquadRequestBusy = false;

        setSquadButtonBusyV1(
            button,
            false
        );
    }
}

function openSquadSearchResultV1(
    squad = {},
    inviteCode = ''
) {
    openSquadModalV1(`
        <div class="yh-game-squad-search-preview">
            <div class="yh-game-squad-detail-emblem">
                ${escapeHtml(
                    squad.emblem || '⚡'
                )}
            </div>

            <div>
                <div class="yh-game-squad-modal-kicker">
                    Squad Found
                </div>

                <h2>
                    ${escapeHtml(
                        squad.name ||
                        'Academy Squad'
                    )}
                </h2>

                <p>
                    ${escapeHtml(
                        squad.description ||
                        'Academy squad.'
                    )}
                </p>
            </div>
        </div>

        <div class="yh-game-squad-detail-stats">
            <div>
                <small>Members</small>
                <strong>
                    ${Number(
                        squad.memberCount || 0
                    )}/${Number(
                        squad.maxMembers || 8
                    )}
                </strong>
            </div>

            <div>
                <small>Available Slots</small>
                <strong>
                    ${Number(
                        squad.availableSlots || 0
                    )}
                </strong>
            </div>

            <div>
                <small>Rank</small>
                <strong>
                    ${escapeHtml(
                        squad.rank ||
                        'Unranked'
                    )}
                </strong>
            </div>
        </div>

        <div
            class="yh-game-squad-form-error hidden-step"
            data-yh-squad-form-error
            role="alert"
        ></div>

        <div class="yh-game-squad-form-actions">
            <button
                type="button"
                class="yh-game-squad-secondary"
                data-yh-search-again
            >
                Search Again
            </button>

            <button
                type="button"
                class="yh-game-squad-primary"
                data-yh-confirm-squad-join="${escapeHtml(
                    inviteCode
                )}"
                ${squad.canJoin === false
                    ? 'disabled'
                    : ''}
            >
                Join This Squad
            </button>
        </div>
    `);

    document
        .querySelector(
            '[data-yh-search-again]'
        )
        ?.addEventListener(
            'click',
            openJoinSquadModalV1
        );

    document
        .querySelector(
            '[data-yh-confirm-squad-join]'
        )
        ?.addEventListener(
            'click',
            submitJoinSquadFromPreviewV1
        );
}

async function submitJoinSquadFromPreviewV1(
    event
) {
    if (academySquadRequestBusy) {
        return;
    }

    const button =
        event.currentTarget;

    const inviteCode =
        String(
            button.getAttribute(
                'data-yh-confirm-squad-join'
            ) || ''
        ).trim();

    academySquadRequestBusy = true;

    setSquadButtonBusyV1(
        button,
        true,
        'Joining...'
    );

    try {
        const result =
            await fetchAcademyGameJson(
                '/api/academy/squad/join',
                {
                    method: 'POST',
                    body: {
                        inviteCode
                    }
                }
            );

        window.YHUGameCore
            ?.setAcademySquadCacheV1?.(
                result
            );

        academySquadLoaded = true;

        closeSquadModalV1();
        renderDashboardGameFoundation();

        window.YHSharedCore
            ?.showToast?.(
                'You joined the squad.',
                'success'
            );
    } catch (error) {
        const box =
            document.querySelector(
                '[data-yh-squad-form-error]'
            );

        if (box) {
            box.textContent =
                error?.message ||
                'Failed to join squad.';

            box.classList.remove(
                'hidden-step'
            );
        }
    } finally {
        academySquadRequestBusy = false;

        setSquadButtonBusyV1(
            button,
            false
        );
    }
}

    async function submitJoinSquadV1(
        event
    ) {
        event.preventDefault();

        if (academySquadRequestBusy) {
            return;
        }

        const form =
            event.currentTarget;

        const button =
            form.querySelector(
                'button[type="submit"]'
            );

        const data =
            new FormData(form);

        const inviteCode =
            String(
                data.get('inviteCode') ||
                ''
            )
                .trim()
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]/g,
                    ''
                );

        if (!inviteCode) {
            setSquadFormErrorV1(
                form,
                'Squad invite code is required.'
            );

            return;
        }

        academySquadRequestBusy = true;

        setSquadFormErrorV1(
            form,
            ''
        );

        setSquadButtonBusyV1(
            button,
            true,
            'Joining...'
        );

        try {
            const result =
                await fetchAcademyGameJson(
                    '/api/academy/squad/join',
                    {
                        method: 'POST',
                        body: {
                            inviteCode
                        }
                    }
                );

            window.YHUGameCore
                ?.setAcademySquadCacheV1?.(
                    result
                );

            academySquadLoaded = true;

            closeSquadModalV1();
            renderDashboardGameFoundation();

            window.YHSharedCore
                ?.showToast?.(
                    'You joined the squad.',
                    'success'
                );
        } catch (error) {
            setSquadFormErrorV1(
                form,
                error?.message ||
                'Failed to join squad.'
            );
        } finally {
            academySquadRequestBusy =
                false;

            setSquadButtonBusyV1(
                button,
                false
            );
        }
    }

    async function runSquadManagementActionV1(
    button,
    {
        url = '',
        method = 'POST',
        body = null,
        loadingLabel = 'Working...',
        successMessage = '',
        clearSquad = false
    } = {}
) {
    if (
        academySquadRequestBusy ||
        !url
    ) {
        return;
    }

    academySquadRequestBusy = true;

    setSquadButtonBusyV1(
        button,
        true,
        loadingLabel
    );

    try {
        const result =
            await fetchAcademyGameJson(
                url,
                {
                    method,
                    body
                }
            );

        if (clearSquad) {
            window.YHUGameCore
                ?.setAcademySquadCacheV1?.({
                    joined: false,
                    squad: null,
                    membership: null
                });

            closeSquadModalV1();
        } else {
            window.YHUGameCore
                ?.setAcademySquadCacheV1?.(
                    result
                );

            openSquadDetailsModalV1();
        }

        academySquadLoaded = true;

        renderDashboardGameFoundation();

        window.YHSharedCore
            ?.showToast?.(
                successMessage ||
                'Squad updated.',
                'success'
            );
    } catch (error) {
        window.YHSharedCore
            ?.showToast?.(
                error?.message ||
                'Squad action failed.',
                'error'
            );
    } finally {
        academySquadRequestBusy = false;

        setSquadButtonBusyV1(
            button,
            false
        );
    }
}

function resolveSquadMemberVisibleNameV1(
    member = {}
) {
    const placeholders =
        new Set([
            '',
            'hustler',
            'yh member',
            'academy member',
            'member',
            'user'
        ]);

    const displayName =
        String(
            member.displayName ||
            ''
        ).trim();

    const username =
        String(
            member.username ||
            ''
        )
            .trim()
            .replace(/^@+/, '');

    if (
        displayName &&
        !displayName.includes('@') &&
        !placeholders.has(
            displayName.toLowerCase()
        )
    ) {
        return displayName;
    }

    if (
        username &&
        !username.includes('@') &&
        !placeholders.has(
            username.toLowerCase()
        )
    ) {
        return username;
    }

    return 'YH Member';
}
function buildSquadXpProgressV1(
    squad = {}
) {
    const totalXp =
        Math.max(
            0,
            Number(
                squad.totalXp || 0
            )
        );

    const level =
        Math.max(
            1,
            Number(
                squad.level || 1
            )
        );

    const levelStartXp =
        (level - 1) * 500;

    const nextLevelXp =
        Math.max(
            level * 500,
            Number(
                squad.nextLevelXp ||
                level * 500
            )
        );

    const required =
        Math.max(
            1,
            nextLevelXp -
            levelStartXp
        );

    const current =
        Math.max(
            0,
            totalXp -
            levelStartXp
        );

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    (
                        current /
                        required
                    ) * 100
                )
            )
        );

    return {
        level,
        current,
        required,
        percent,
        nextLevelXp
    };
}
function bindSquadWorkspaceTabsV1() {
    document
        .querySelectorAll(
            '[data-yh-squad-workspace-tab]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    const tab =
                        button.getAttribute(
                            'data-yh-squad-workspace-tab'
                        );

                    if (tab === 'missions') {
                        openSquadMissionsModalV1();
                        return;
                    }

                    if (tab === 'rankings') {
                        openSquadRankingsModalV1();
                        return;
                    }

                    if (tab === 'members') {
                        openSquadMembersModalV1();
                        return;
                    }

                    if (tab === 'activity') {
                        openSquadActivityModalV1();
                        return;
                    }

                    openSquadDetailsModalV1();
                }
            );
        });
}
async function openSquadMissionsModalV1({
    force = false
} = {}) {
    const squad =
        window.YHUGameCore
            ?.getAcademySquadSnapshotV1?.() ||
        {};

    openSquadModalV1(`
        <div class="yh-game-squad-detail-head">
            <div class="yh-game-squad-detail-emblem">
                ${escapeHtml(
                    squad.emblem || '⚡'
                )}
            </div>

            <div>
                <div class="yh-game-squad-modal-kicker">
                    Shared Operations
                </div>

                <h2>
                    ${escapeHtml(
                        squad.name ||
                        'Academy Squad'
                    )}
                </h2>

                <p>
                    Coordinate shared targets and verified
                    Academy contributions.
                </p>
            </div>
        </div>

        ${buildSquadWorkspaceTabsV1(
            'missions'
        )}

        <div class="yh-game-squad-missions-loading">
            <span></span>
            Loading Squad missions...
        </div>
    `);

    bindSquadWorkspaceTabsV1();

    try {
        const state =
            await loadAcademySquadMissionsV1({
                force
            });

        renderSquadMissionsWorkspaceV1(
            state
        );
    } catch (error) {
        const content =
            document.getElementById(
                'yh-game-squad-modal-content'
            );

        if (!content) return;

        content.innerHTML = `
            <div class="yh-game-squad-detail-head">
                <div class="yh-game-squad-detail-emblem">
                    ${escapeHtml(
                        squad.emblem || '⚡'
                    )}
                </div>

                <div>
                    <div class="yh-game-squad-modal-kicker">
                        Shared Operations
                    </div>

                    <h2>
                        ${escapeHtml(
                            squad.name ||
                            'Academy Squad'
                        )}
                    </h2>
                </div>
            </div>

            ${buildSquadWorkspaceTabsV1(
                'missions'
            )}

            <div class="yh-game-squad-missions-error">
                <strong>
                    Squad missions could not be loaded.
                </strong>

                <p>
                    ${escapeHtml(
                        error?.message ||
                        'Please try again.'
                    )}
                </p>

                <button
                    type="button"
                    class="yh-game-squad-primary"
                    data-yh-retry-squad-missions
                >
                    Retry
                </button>
            </div>
        `;

        bindSquadWorkspaceTabsV1();

        content
            .querySelector(
                '[data-yh-retry-squad-missions]'
            )
            ?.addEventListener(
                'click',
                () => {
                    openSquadMissionsModalV1({
                        force: true
                    });
                }
            );
    }
}

function renderSquadMissionsWorkspaceV1(
    state = academySquadMissionsStateV1
) {
    const squad =
        window.YHUGameCore
            ?.getAcademySquadSnapshotV1?.() ||
        {};

    const content =
        document.getElementById(
            'yh-game-squad-modal-content'
        );

    if (!content) return;

    const filter =
        String(
            state.filter || 'all'
        ).toLowerCase();

    const allMissions =
        Array.isArray(
            state.missions
        )
            ? state.missions
            : [];

    const missions =
        filter === 'all'
            ? allMissions
            : allMissions.filter(
                (mission) =>
                    normalizeSquadMissionStatusV1(
                        mission.status
                    ) === filter
            );

    const activeCount =
        allMissions.filter(
            (mission) =>
                normalizeSquadMissionStatusV1(
                    mission.status
                ) === 'active'
        ).length;

    const completedCount =
        allMissions.filter(
            (mission) =>
                normalizeSquadMissionStatusV1(
                    mission.status
                ) === 'completed'
        ).length;

    const cancelledCount =
        allMissions.filter(
            (mission) =>
                normalizeSquadMissionStatusV1(
                    mission.status
                ) === 'cancelled'
        ).length;

    content.innerHTML = `
        <div class="yh-game-squad-detail-head">
            <div class="yh-game-squad-detail-emblem">
                ${escapeHtml(
                    squad.emblem || '⚡'
                )}
            </div>

            <div>
                <div class="yh-game-squad-modal-kicker">
                    Shared Operations
                </div>

                <h2>
                    ${escapeHtml(
                        squad.name ||
                        'Academy Squad'
                    )}
                </h2>

                <p>
                    Complete shared targets through verified
                    member activity.
                </p>
            </div>
        </div>

        ${buildSquadWorkspaceTabsV1(
            'missions'
        )}

        <div class="yh-game-squad-missions-toolbar">
            <div class="yh-game-squad-mission-filters">
                <button
                    type="button"
                    class="${
                        filter === 'all'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-mission-filter="all"
                >
                    All
                    <span>${allMissions.length}</span>
                </button>

                <button
                    type="button"
                    class="${
                        filter === 'active'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-mission-filter="active"
                >
                    Active
                    <span>${activeCount}</span>
                </button>

                <button
                    type="button"
                    class="${
                        filter === 'completed'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-mission-filter="completed"
                >
                    Completed
                    <span>${completedCount}</span>
                </button>

                <button
                    type="button"
                    class="${
                        filter === 'cancelled'
                            ? 'is-active'
                            : ''
                    }"
                    data-yh-squad-mission-filter="cancelled"
                >
                    Cancelled
                    <span>${cancelledCount}</span>
                </button>
            </div>

            ${
                state.canManage
                    ? `
                        <button
                            type="button"
                            class="yh-game-squad-primary"
                            data-yh-create-squad-mission
                        >
                            + Create Mission
                        </button>
                    `
                    : ''
            }
        </div>

        <div class="yh-game-squad-missions-list">
            ${
                missions.length
                    ? missions
                        .map(
                            buildSquadMissionCardV1
                        )
                        .join('')
                    : `
                        <div class="yh-game-squad-missions-empty">
                            <strong>
                                ${
                                    filter === 'all'
                                        ? 'No Squad missions yet'
                                        : `No ${escapeHtml(
                                            filter
                                        )} missions`
                                }
                            </strong>

                            <p>
                                ${
                                    state.canManage &&
                                    filter === 'all'
                                        ? 'Create the first shared target for your Squad.'
                                        : 'There are no missions in this category.'
                                }
                            </p>
                        </div>
                    `
            }
        </div>
    `;

    bindSquadWorkspaceTabsV1();
    bindSquadMissionWorkspaceActionsV1();
}

function buildSquadMissionCardV1(
    mission = {}
) {
    const status =
        normalizeSquadMissionStatusV1(
            mission.status
        );

    const progress =
        getSquadMissionProgressV1(
            mission
        );

    const canManage =
        academySquadMissionsStateV1
            .canManage === true;

    return `
        <article
            class="yh-game-squad-mission-card is-${escapeHtml(
                status
            )}"
            data-yh-squad-mission-id="${escapeHtml(
                mission.id || ''
            )}"
        >
            <div class="yh-game-squad-mission-head">
                <div>
                    <small>
                        ${escapeHtml(
                            formatSquadMissionTypeV1(
                                mission.missionType
                            )
                        )}
                    </small>

                    <h3>
                        ${escapeHtml(
                            mission.title ||
                            'Squad Mission'
                        )}
                    </h3>
                </div>

                <span class="is-${escapeHtml(
                    status
                )}">
                    ${escapeHtml(
                        status
                    )}
                </span>
            </div>

            ${
                mission.description
                    ? `
                        <p class="yh-game-squad-mission-description">
                            ${escapeHtml(
                                mission.description
                            )}
                        </p>
                    `
                    : ''
            }

            <div class="yh-game-squad-mission-progress-head">
                <strong>
                    ${progress.progress.toLocaleString()}
                    / ${progress.target.toLocaleString()}
                </strong>

                <span>
                    ${progress.percent}%
                </span>
            </div>

            <div class="yh-game-squad-mission-progress-track">
                <span
                    style="width:${progress.percent}%"
                ></span>
            </div>

            <div class="yh-game-squad-mission-meta">
                <span>
                    Deadline:
                    <strong>
                        ${escapeHtml(
                            formatSquadMissionDeadlineV1(
                                mission.deadline
                            )
                        )}
                    </strong>
                </span>

                <span>
                    Reward:
                    <strong>
                        ${Number(
                            mission.rewardXp || 0
                        ).toLocaleString()}
                        XP
                    </strong>
                </span>
            </div>

            ${
                mission.id
                    ? `
                        <div class="yh-game-squad-mission-actions">
                            <button
                                type="button"
                                class="is-history"
                                data-yh-view-squad-mission-history="${escapeHtml(
                                    mission.id
                                )}"
                            >
                                View History
                            </button>

                            ${
                                canManage &&
                                status === 'active'
                                    ? `
                                        <button
                                            type="button"
                                            data-yh-edit-squad-mission="${escapeHtml(
                                                mission.id
                                            )}"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            class="is-danger"
                                            data-yh-cancel-squad-mission="${escapeHtml(
                                                mission.id
                                            )}"
                                        >
                                            Cancel Mission
                                        </button>
                                    `
                                    : ''
                            }
                        </div>
                    `
                    : ''
            }
        </article>
    `;
}
async function openSquadMissionHistoryV1(
    missionId = '',
    {
        force = false
    } = {}
) {
    const cleanMissionId =
        String(
            missionId || ''
        ).trim();

    if (!cleanMissionId) {
        return;
    }

    const squad =
        window.YHUGameCore
            ?.getAcademySquadSnapshotV1?.() ||
        {};

    const localMission =
        academySquadMissionsStateV1
            .missions
            .find(
                (mission) =>
                    mission.id ===
                    cleanMissionId
            ) ||
        {};

    openSquadModalV1(`
        <div
            data-yh-squad-mission-history-view="${escapeHtml(
                cleanMissionId
            )}"
        >
            <div class="yh-game-squad-detail-head">
                <div class="yh-game-squad-detail-emblem">
                    ${escapeHtml(
                        squad.emblem || '⚡'
                    )}
                </div>

                <div>
                    <div class="yh-game-squad-modal-kicker">
                        Mission Contribution History
                    </div>

                    <h2>
                        ${escapeHtml(
                            localMission.title ||
                            'Squad Mission'
                        )}
                    </h2>

                    <p>
                        Review verified actions and member
                        contributions for this operation.
                    </p>
                </div>
            </div>

            ${buildSquadWorkspaceTabsV1(
                'missions'
            )}

            <div class="yh-game-squad-history-toolbar">
                <button
                    type="button"
                    class="yh-game-squad-secondary"
                    data-yh-back-to-squad-missions
                >
                    ← Back to Missions
                </button>
            </div>

            <div class="yh-game-squad-missions-loading">
                <span></span>
                Loading contribution history...
            </div>
        </div>
    `);

    bindSquadWorkspaceTabsV1();
    bindSquadMissionHistoryNavigationV1();

    try {
        const payload =
            await loadSquadMissionHistoryV1(
                cleanMissionId,
                {
                    force
                }
            );

        renderSquadMissionHistoryV1(
            payload
        );
    } catch (error) {
        renderSquadMissionHistoryErrorV1(
            cleanMissionId,
            error
        );
    }
}

/* PATCH: Phase 3C.4B notification mission-history bridge v1 */

window.YHUOpenAcademySquadMissionHistoryV1 =
    function (
        missionId = '',
        options = {}
    ) {
        return openSquadMissionHistoryV1(
            missionId,
            {
                force:
                    options?.force !== false
            }
        );
    };

if (
    window
        .__yhuSquadMissionHistoryNotificationBridgeV1 !==
    true
) {
    window
        .__yhuSquadMissionHistoryNotificationBridgeV1 =
        true;

    window.addEventListener(
        'yhu:open-squad-mission-history',
        (event) => {
            const missionId =
                String(
                    event?.detail
                        ?.missionId ||
                    ''
                ).trim();

            if (!missionId) {
                return;
            }

            void openSquadMissionHistoryV1(
                missionId,
                {
                    force: true
                }
            );
        }
    );
}

/* END PATCH: Phase 3C.4B notification mission-history bridge v1 */


function bindSquadMissionHistoryNavigationV1() {
    document
        .querySelectorAll(
            '[data-yh-back-to-squad-missions]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    openSquadMissionsModalV1();
                }
            );
        });
}

function renderSquadMissionHistoryV1(
    payload = {}
) {
    const content =
        document.getElementById(
            'yh-game-squad-modal-content'
        );

    if (!content) {
        return;
    }

    const squad =
        window.YHUGameCore
            ?.getAcademySquadSnapshotV1?.() ||
        {};

    const mission =
        payload?.mission &&
        typeof payload.mission ===
            'object'
            ? payload.mission
            : {};

    const progress =
        getSquadMissionProgressV1(
            mission
        );

    const contributors =
        Array.isArray(
            payload.contributors
        )
            ? payload.contributors
            : [];

    const contributions =
        Array.isArray(
            payload.contributions
        )
            ? payload.contributions
            : [];

    content.innerHTML = `
        <div
            data-yh-squad-mission-history-view="${escapeHtml(
                mission.id || ''
            )}"
        >
            <div class="yh-game-squad-detail-head">
                <div class="yh-game-squad-detail-emblem">
                    ${escapeHtml(
                        squad.emblem || '⚡'
                    )}
                </div>

                <div>
                    <div class="yh-game-squad-modal-kicker">
                        Mission Contribution History
                    </div>

                    <h2>
                        ${escapeHtml(
                            mission.title ||
                            'Squad Mission'
                        )}
                    </h2>

                    <p>
                        ${escapeHtml(
                            formatSquadMissionTypeV1(
                                mission.missionType
                            )
                        )}
                        •
                        ${escapeHtml(
                            normalizeSquadMissionStatusV1(
                                mission.status
                            )
                        )}
                    </p>
                </div>
            </div>

            ${buildSquadWorkspaceTabsV1(
                'missions'
            )}

            <div class="yh-game-squad-history-toolbar">
                <button
                    type="button"
                    class="yh-game-squad-secondary"
                    data-yh-back-to-squad-missions
                >
                    ← Back to Missions
                </button>
            </div>

            <div class="yh-game-squad-history-summary">
                <div>
                    <small>Mission Progress</small>

                    <strong>
                        ${progress.progress.toLocaleString()}
                        /
                        ${progress.target.toLocaleString()}
                    </strong>

                    <span>
                        ${progress.percent}% complete
                    </span>
                </div>

                <div>
                    <small>Contributors</small>

                    <strong>
                        ${Number(
                            payload.contributorCount ||
                            contributors.length ||
                            0
                        ).toLocaleString()}
                    </strong>

                    <span>
                        Verified members
                    </span>
                </div>

                <div>
                    <small>Contribution Events</small>

                    <strong>
                        ${Number(
                            payload.contributionCount ||
                            contributions.length ||
                            0
                        ).toLocaleString()}
                    </strong>

                    <span>
                        Duplicate-safe actions
                    </span>
                </div>
            </div>

            <section class="yh-game-squad-history-section">
                <div class="yh-game-squad-history-section-head">
                    <div>
                        <small>Top Contributors</small>
                        <h3>Member Breakdown</h3>
                    </div>
                </div>

                <div class="yh-game-squad-history-contributors">
                    ${
                        contributors.length
                            ? contributors
                                .map(
                                    (
                                        contributor,
                                        index
                                    ) => `
                                        <div class="yh-game-squad-history-contributor">
                                            <span class="yh-game-squad-history-rank">
                                                ${index + 1}
                                            </span>

                                            <div>
                                                <strong>
                                                    ${escapeHtml(
                                                        contributor.displayName ||
                                                        'YH Member'
                                                    )}
                                                </strong>

                                                <small>
                                                    ${escapeHtml(
                                                        contributor.role ||
                                                        'member'
                                                    )}
                                                    •
                                                    ${Number(
                                                        contributor.events ||
                                                        0
                                                    ).toLocaleString()}
                                                    event${
                                                        Number(
                                                            contributor.events ||
                                                            0
                                                        ) === 1
                                                            ? ''
                                                            : 's'
                                                    }
                                                </small>
                                            </div>

                                            <b>
                                                +${Number(
                                                    contributor.amount ||
                                                    0
                                                ).toLocaleString()}
                                            </b>
                                        </div>
                                    `
                                )
                                .join('')
                            : `
                                <div class="yh-game-squad-history-empty">
                                    No member contributions yet.
                                </div>
                            `
                    }
                </div>
            </section>

            <section class="yh-game-squad-history-section">
                <div class="yh-game-squad-history-section-head">
                    <div>
                        <small>Verified Activity</small>
                        <h3>Contribution Timeline</h3>
                    </div>
                </div>

                <div class="yh-game-squad-history-timeline">
                    ${
                        contributions.length
                            ? contributions
                                .map(
                                    (entry) => `
                                        <article class="yh-game-squad-history-event">
                                            <span class="yh-game-squad-history-event-mark">
                                                +${Number(
                                                    entry.amount ||
                                                    0
                                                ).toLocaleString()}
                                            </span>

                                            <div>
                                                <strong>
                                                    ${escapeHtml(
                                                        entry.contributorName ||
                                                        'YH Member'
                                                    )}
                                                </strong>

                                                <p>
                                                    ${escapeHtml(
                                                        entry.label ||
                                                        'Squad mission contribution'
                                                    )}
                                                </p>

                                                <small>
                                                    ${escapeHtml(
                                                        formatSquadContributionTimeV1(
                                                            entry.eventAt ||
                                                            entry.createdAt
                                                        )
                                                    )}
                                                </small>
                                            </div>
                                        </article>
                                    `
                                )
                                .join('')
                            : `
                                <div class="yh-game-squad-history-empty">
                                    No verified activity has been recorded.
                                </div>
                            `
                    }
                </div>
            </section>
        </div>
    `;

    bindSquadWorkspaceTabsV1();
    bindSquadMissionHistoryNavigationV1();
}

function renderSquadMissionHistoryErrorV1(
    missionId = '',
    error = null
) {
    const content =
        document.getElementById(
            'yh-game-squad-modal-content'
        );

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div
            data-yh-squad-mission-history-view="${escapeHtml(
                missionId
            )}"
        >
            ${buildSquadWorkspaceTabsV1(
                'missions'
            )}

            <div class="yh-game-squad-missions-error">
                <strong>
                    Contribution history could not be loaded.
                </strong>

                <p>
                    ${escapeHtml(
                        error?.message ||
                        'Please try again.'
                    )}
                </p>

                <div class="yh-game-squad-history-error-actions">
                    <button
                        type="button"
                        class="yh-game-squad-secondary"
                        data-yh-back-to-squad-missions
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        class="yh-game-squad-primary"
                        data-yh-retry-squad-mission-history="${escapeHtml(
                            missionId
                        )}"
                    >
                        Retry
                    </button>
                </div>
            </div>
        </div>
    `;

    bindSquadWorkspaceTabsV1();
    bindSquadMissionHistoryNavigationV1();

    content
        .querySelector(
            '[data-yh-retry-squad-mission-history]'
        )
        ?.addEventListener(
            'click',
            () => {
                openSquadMissionHistoryV1(
                    missionId,
                    {
                        force: true
                    }
                );
            }
        );
}

function openSquadMissionFormV1(
    mission = null
) {
    const editing =
        Boolean(mission?.id);

    openSquadModalV1(`
        <div class="yh-game-squad-modal-kicker">
            Shared Squad Mission
        </div>

        <h2>
            ${
                editing
                    ? 'Edit Squad Mission'
                    : 'Create Squad Mission'
            }
        </h2>

        <p class="yh-game-squad-modal-copy">
            Set a shared target that members can complete
            through verified Academy activity.
        </p>

        <form id="yh-game-squad-mission-form">
            <label>
                <span>Mission Title</span>

                <input
                    type="text"
                    name="title"
                    minlength="3"
                    maxlength="100"
                    required
                    value="${escapeHtml(
                        mission?.title || ''
                    )}"
                    placeholder="Complete 5 Academy Missions"
                >
            </label>

            <label>
                <span>Mission Type</span>

                <select name="missionType">
                    ${[
                        [
                            'academy_missions',
                            'Academy Missions'
                        ],
                        [
                            'verified_leads',
                            'Verified Leads'
                        ],
                        [
                            'daily_checkins',
                            'Daily Check-ins'
                        ],
                        [
                            'squad_xp',
                            'Squad XP'
                        ],
                        [
                            'mission_playbooks',
                            'Mission Playbooks'
                        ],
                        [
                            'custom',
                            'Custom Mission'
                        ]
                    ]
                        .map(
                            ([value, label]) => `
                                <option
                                    value="${value}"
                                    ${
                                        (
                                            mission
                                                ?.missionType ||
                                            'academy_missions'
                                        ) === value
                                            ? 'selected'
                                            : ''
                                    }
                                >
                                    ${label}
                                </option>
                            `
                        )
                        .join('')}
                </select>
            </label>

            <div class="yh-game-squad-mission-form-grid">
                <label>
                    <span>Target</span>

                    <input
                        type="number"
                        name="target"
                        min="1"
                        max="10000"
                        required
                        value="${Number(
                            mission?.target || 5
                        )}"
                    >
                </label>

                <label>
                    <span>Reward XP</span>

                    <input
                        type="number"
                        name="rewardXp"
                        min="0"
                        max="500"
                        required
                        value="${Number(
                            mission?.rewardXp || 100
                        )}"
                    >
                </label>
            </div>

            <label>
                <span>Deadline</span>

                <input
                    type="datetime-local"
                    name="deadline"
                    value="${escapeHtml(
                        mission?.deadline
                            ? new Date(
                                mission.deadline
                            )
                                .toISOString()
                                .slice(0, 16)
                            : ''
                    )}"
                >
            </label>

            <label>
                <span>Description</span>

                <textarea
                    name="description"
                    maxlength="500"
                    rows="4"
                    placeholder="Describe what the Squad needs to complete."
                >${escapeHtml(
                    mission?.description || ''
                )}</textarea>
            </label>

            <div
                class="yh-game-squad-form-error hidden-step"
                data-yh-squad-form-error
                role="alert"
            ></div>

            <div class="yh-game-squad-form-actions">
                <button
                    type="button"
                    class="yh-game-squad-secondary"
                    data-yh-back-to-squad-missions
                >
                    Back
                </button>

                <button
                    type="submit"
                    class="yh-game-squad-primary"
                >
                    ${
                        editing
                            ? 'Save Changes'
                            : 'Create Mission'
                    }
                </button>
            </div>
        </form>
    `);

    const form =
        document.getElementById(
            'yh-game-squad-mission-form'
        );

    form?.addEventListener(
        'submit',
        (event) => {
            submitSquadMissionFormV1(
                event,
                mission?.id || ''
            );
        }
    );

    document
        .querySelector(
            '[data-yh-back-to-squad-missions]'
        )
        ?.addEventListener(
            'click',
            () => {
                openSquadMissionsModalV1();
            }
        );

    form
        ?.querySelector(
            'input[name="title"]'
        )
        ?.focus();
}

async function submitSquadMissionFormV1(
    event,
    missionId = ''
) {
    event.preventDefault();

    if (academySquadRequestBusy) {
        return;
    }

    const form =
        event.currentTarget;

    const button =
        form.querySelector(
            'button[type="submit"]'
        );

    const data =
        new FormData(form);

    const title =
        String(
            data.get('title') || ''
        ).trim();

    if (title.length < 3) {
        setSquadFormErrorV1(
            form,
            'Mission title must contain at least 3 characters.'
        );

        return;
    }

    const rawDeadline =
        String(
            data.get('deadline') || ''
        ).trim();

    const payload = {
        title,

        description:
            String(
                data.get('description') ||
                ''
            ).trim(),

        missionType:
            String(
                data.get('missionType') ||
                'custom'
            ).trim(),

        target:
            Math.max(
                1,
                Number(
                    data.get('target') ||
                    1
                )
            ),

        rewardXp:
            Math.max(
                0,
                Number(
                    data.get('rewardXp') ||
                    0
                )
            ),

        deadline:
            rawDeadline
                ? new Date(
                    rawDeadline
                ).toISOString()
                : ''
    };

    academySquadRequestBusy = true;

    setSquadFormErrorV1(
        form,
        ''
    );

    setSquadButtonBusyV1(
        button,
        true,
        missionId
            ? 'Saving...'
            : 'Creating...'
    );

    try {
        await fetchAcademyGameJson(
            missionId
                ? (
                    '/api/academy/squad/missions/' +
                    encodeURIComponent(
                        missionId
                    )
                )
                : '/api/academy/squad/missions',
            {
                method:
                    missionId
                        ? 'PATCH'
                        : 'POST',

                body:
                    payload
            }
        );

        academySquadMissionsStateV1 = {
            ...academySquadMissionsStateV1,

            loaded: false,

            filter:
                missionId
                    ? academySquadMissionsStateV1.filter
                    : 'active'
        };

        window.YHSharedCore
            ?.showToast?.(
                missionId
                    ? 'Squad mission updated.'
                    : 'Squad mission created.',
                'success'
            );

        await openSquadMissionsModalV1({
            force: true
        });
    } catch (error) {
        setSquadFormErrorV1(
            form,
            error?.message ||
            'Squad mission could not be saved.'
        );
    } finally {
        academySquadRequestBusy =
            false;

        setSquadButtonBusyV1(
            button,
            false
        );
    }
}
function bindSquadMissionWorkspaceActionsV1() {
    document
        .querySelectorAll(
            '[data-yh-squad-mission-filter]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    academySquadMissionsStateV1 = {
                        ...academySquadMissionsStateV1,

                        filter:
                            button.getAttribute(
                                'data-yh-squad-mission-filter'
                            ) ||
                            'all'
                    };

                    renderSquadMissionsWorkspaceV1();
                }
            );
        });

    document
        .querySelector(
            '[data-yh-create-squad-mission]'
        )
        ?.addEventListener(
            'click',
            () => {
                openSquadMissionFormV1();
            }
        );
    document
        .querySelectorAll(
            '[data-yh-view-squad-mission-history]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    const missionId =
                        button.getAttribute(
                            'data-yh-view-squad-mission-history'
                        );

                    openSquadMissionHistoryV1(
                        missionId
                    );
                }
            );
        });

    document
        .querySelectorAll(
            '[data-yh-edit-squad-mission]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    const missionId =
                        button.getAttribute(
                            'data-yh-edit-squad-mission'
                        );

                    const mission =
                        academySquadMissionsStateV1
                            .missions
                            .find(
                                (entry) =>
                                    entry.id ===
                                    missionId
                            );

                    if (mission) {
                        openSquadMissionFormV1(
                            mission
                        );
                    }
                }
            );
        });

    document
        .querySelectorAll(
            '[data-yh-cancel-squad-mission]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                async () => {
                    if (
                        academySquadRequestBusy
                    ) {
                        return;
                    }

                    const missionId =
                        button.getAttribute(
                            'data-yh-cancel-squad-mission'
                        );

                    const mission =
                        academySquadMissionsStateV1
                            .missions
                            .find(
                                (entry) =>
                                    entry.id ===
                                    missionId
                            );

                    const confirmed =
                        await window.YHSharedCore
                            ?.openYHConfirmModal?.({
                                title:
                                    'Cancel Squad mission?',

                                message:
                                    `“${
                                        mission?.title ||
                                        'This mission'
                                    }” will move to the cancelled history.`,

                                okText:
                                    'Cancel Mission',

                                cancelText:
                                    'Keep Mission',

                                tone:
                                    'danger'
                            });

                    if (!confirmed) {
                        return;
                    }

                    academySquadRequestBusy =
                        true;

                    setSquadButtonBusyV1(
                        button,
                        true,
                        'Cancelling...'
                    );

                    try {
                        await fetchAcademyGameJson(
                            (
                                '/api/academy/squad/missions/' +
                                encodeURIComponent(
                                    missionId
                                )
                            ),
                            {
                                method:
                                    'DELETE'
                            }
                        );

                        academySquadMissionsStateV1 = {
                            ...academySquadMissionsStateV1,
                            loaded: false
                        };

                        window.YHSharedCore
                            ?.showToast?.(
                                'Squad mission cancelled.',
                                'success'
                            );

                        await openSquadMissionsModalV1({
                            force: true
                        });
                    } catch (error) {
                        window.YHSharedCore
                            ?.showToast?.(
                                error?.message ||
                                'Squad mission could not be cancelled.',
                                'error'
                            );
                    } finally {
                        academySquadRequestBusy =
                            false;

                        setSquadButtonBusyV1(
                            button,
                            false
                        );
                    }
                }
            );
        });
}
function openSquadRankingsModalV1() {
    openSquadDetailsModalV1(
        'rankings'
    );

    window.setTimeout(() => {
        document
            .querySelector(
                '.yh-game-squad-ranking-summary'
            )
            ?.scrollIntoView({
                block: 'start',
                behavior: 'smooth'
            });
    }, 50);
}

function openSquadMembersModalV1() {
    openSquadDetailsModalV1(
        'members'
    );

    window.setTimeout(() => {
        document
            .querySelector(
                '.yh-game-squad-member-list'
            )
            ?.scrollIntoView({
                block: 'start',
                behavior: 'smooth'
            });
    }, 50);
}

function openSquadActivityModalV1() {
    openSquadDetailsModalV1(
        'activity'
    );

    window.setTimeout(() => {
        document
            .querySelector(
                '.yh-game-squad-contributions'
            )
            ?.scrollIntoView({
                block: 'start',
                behavior: 'smooth'
            });
    }, 50);
}

function openSquadDetailsModalV1(
    activeTab = 'overview'
) {
    const squad =
        window.YHUGameCore
            ?.getAcademySquadSnapshotV1?.() ||
        {};

    const members =
        Array.isArray(
            squad.memberList
        )
            ? squad.memberList
            : [];

        const isOwner =
            squad.role === 'owner';

        const squadProgress =
            buildSquadXpProgressV1(
                squad
            );

    const weeklyPosition =
        squad.weeklyPosition &&
        typeof squad.weeklyPosition ===
            'object'
            ? squad.weeklyPosition
            : null;

    const allTimePosition =
        squad.allTimePosition &&
        typeof squad.allTimePosition ===
            'object'
            ? squad.allTimePosition
            : null;

    const weeklyLeaderboard =
        Array.isArray(
            squad.weeklyLeaderboard
        )
            ? squad.weeklyLeaderboard
            : [];

    const weeklyContributors =
        Array.isArray(
            squad.weeklyContributors
        )
            ? squad.weeklyContributors
            : [];

    const recentContributions =
        Array.isArray(
            squad.recentContributions
        )
            ? squad.recentContributions
            : [];

    openSquadModalV1(`
        <div class="yh-game-squad-detail-head">
            <div class="yh-game-squad-detail-emblem">
                ${escapeHtml(
                    squad.emblem || '⚡'
                )}
            </div>

            <div>
                <div class="yh-game-squad-modal-kicker">
                    Your Squad
                </div>

                <h2>
                    ${escapeHtml(
                        squad.name ||
                        'Academy Squad'
                    )}
                </h2>

                <p>
                    ${escapeHtml(
                        squad.description ||
                        'Squad foundation active.'
                    )}
                </p>
            </div>
        </div>

        ${buildSquadWorkspaceTabsV1(
            activeTab
        )}

<div class="yh-game-squad-detail-stats">
    <div>
        <small>Your Role</small>
        <strong>
            ${escapeHtml(
                squad.role ||
                'member'
            )}
        </strong>
    </div>

    <div>
        <small>Members</small>
        <strong>
            ${Number(
                squad.members || 0
            )}/${Number(
                squad.maxMembers || 8
            )}
        </strong>
    </div>

    <div>
        <small>Squad Level</small>
        <strong>
            ${squadProgress.level}
        </strong>
    </div>
</div>

<div class="yh-game-squad-xp-panel">
    <div class="yh-game-squad-xp-panel-head">
        <span>
            Total Squad XP
        </span>

        <strong>
            ${Number(
                squad.totalXp || 0
            ).toLocaleString()}
        </strong>
    </div>

    <div class="yh-game-squad-xp-track">
        <span
            style="width:${squadProgress.percent}%"
        ></span>
    </div>

    <div class="yh-game-squad-xp-panel-foot">
        <span>
            ${squadProgress.current.toLocaleString()}
            / ${squadProgress.required.toLocaleString()}
            toward Level ${squadProgress.level + 1}
        </span>

        <strong>
            ${Number(
                squad.weeklyXp || 0
            ).toLocaleString()}
            weekly XP
        </strong>
    </div>
</div>

<div class="yh-game-squad-ranking-summary">
    <div>
        <small>Weekly Rank</small>

        <strong>
            ${
                weeklyPosition?.position
                    ? (
                        '#' +
                        Number(
                            weeklyPosition.position
                        )
                    )
                    : 'Unranked'
            }
        </strong>

        <span>
            ${Number(
                squad.weeklyXp || 0
            ).toLocaleString()}
            XP this week
        </span>
    </div>

    <div>
        <small>All-Time Rank</small>

        <strong>
            ${
                allTimePosition?.position
                    ? (
                        '#' +
                        Number(
                            allTimePosition.position
                        )
                    )
                    : 'Unranked'
            }
        </strong>

        <span>
            ${Number(
                squad.totalXp || 0
            ).toLocaleString()}
            total XP
        </span>
    </div>
</div>

        ${
            squad.inviteCode
                ? `
                    <div class="yh-game-squad-invite-panel">
                        <small>Invitation Code</small>

                        <strong>
                            ${escapeHtml(
                                squad.inviteCode
                            )}
                        </strong>

                        <div class="yh-game-squad-invite-actions">
                            <button
                                type="button"
                                data-yh-copy-squad-code="${escapeHtml(
                                    squad.inviteCode
                                )}"
                            >
                                Copy Code
                            </button>

                            ${
                                isOwner
                                    ? `
                                        <button
                                            type="button"
                                            data-yh-regenerate-squad-code
                                        >
                                            Regenerate
                                        </button>
                                    `
                                    : ''
                            }
                        </div>
                    </div>
                `
                : ''
        }

        <div class="yh-game-squad-member-list">
            <div class="yh-game-squad-member-list-head">
                Members
            </div>

            ${
                members.length
                    ? members.map(
                        (member) => {
                            const isTargetOwner =
                                member.role ===
                                'owner';

                            return `
                                <div class="yh-game-squad-member-row">
                                    <span>
                                        ${escapeHtml(
                                            resolveSquadMemberVisibleNameV1(
                                                member
                                            )
                                                .charAt(0)
                                                .toUpperCase()
                                        )}
                                    </span>

                                    <div>
                                        <strong>
                                            ${escapeHtml(
                                                resolveSquadMemberVisibleNameV1(
                                                    member
                                                )
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(
                                                member.role ||
                                                'member'
                                            )}
                                        </small>
                                    </div>

                                    ${
                                        isOwner &&
                                        !isTargetOwner
                                            ? `
                                                <div class="yh-game-squad-member-actions">
                                                    <button
                                                        type="button"
                                                        data-yh-squad-member-role="${escapeHtml(
                                                            member.userId
                                                        )}"
                                                        data-yh-next-role-action="${
                                                            member.role ===
                                                            'captain'
                                                                ? 'demote'
                                                                : 'promote'
                                                        }"
                                                    >
                                                        ${
                                                            member.role ===
                                                            'captain'
                                                                ? 'Demote'
                                                                : 'Make Captain'
                                                        }
                                                    </button>

                                                    <button
                                                        type="button"
                                                        class="is-danger"
                                                        data-yh-remove-squad-member="${escapeHtml(
                                                            member.userId
                                                        )}"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            `
                                            : ''
                                    }
                                </div>
                            `;
                        }
                    ).join('')
                    : `
                        <div class="yh-game-squad-empty-members">
                            Member roster will appear here.
                        </div>
                    `
            }
        </div>
                <div class="yh-game-squad-ranking-grid">
            <section>
                <div class="yh-game-squad-member-list-head">
                    Weekly Top Contributors
                </div>

                <div class="yh-game-squad-ranking-list">
                    ${
                        weeklyContributors.length
                            ? weeklyContributors
                                .slice(0, 5)
                                .map(
                                    (entry) => `
                                        <div class="yh-game-squad-ranking-row">
                                            <span>
                                                ${Number(
                                                    entry.position || 0
                                                )}
                                            </span>

                                            <div>
                                                <strong>
                                                    ${escapeHtml(
                                                        entry.displayName ||
                                                        entry.username ||
                                                        'YH Member'
                                                    )}
                                                </strong>

                                                <small>
                                                    ${Number(
                                                        entry.contributionCount ||
                                                        0
                                                    )}
                                                    contributions
                                                </small>
                                            </div>

                                            <b>
                                                ${Number(
                                                    entry.xp || 0
                                                ).toLocaleString()}
                                                XP
                                            </b>
                                        </div>
                                    `
                                )
                                .join('')
                            : `
                                <div class="yh-game-squad-empty-members">
                                    No weekly contributors yet.
                                </div>
                            `
                    }
                </div>
            </section>

            <section>
                <div class="yh-game-squad-member-list-head">
                    Weekly Top Squads
                </div>

                <div class="yh-game-squad-ranking-list">
                    ${
                        weeklyLeaderboard.length
                            ? weeklyLeaderboard
                                .slice(0, 5)
                                .map(
                                    (entry) => `
                                        <div
                                            class="yh-game-squad-ranking-row ${
                                                entry.squadId ===
                                                squad.id
                                                    ? 'is-current'
                                                    : ''
                                            }"
                                        >
                                            <span>
                                                ${Number(
                                                    entry.position || 0
                                                )}
                                            </span>

                                            <div>
                                                <strong>
                                                    ${escapeHtml(
                                                        entry.emblem ||
                                                        '⚡'
                                                    )}
                                                    ${escapeHtml(
                                                        entry.name ||
                                                        'Academy Squad'
                                                    )}
                                                </strong>

                                                <small>
                                                    ${Number(
                                                        entry.memberCount ||
                                                        0
                                                    )}
                                                    members
                                                </small>
                                            </div>

                                            <b>
                                                ${Number(
                                                    entry.xp || 0
                                                ).toLocaleString()}
                                                XP
                                            </b>
                                        </div>
                                    `
                                )
                                .join('')
                            : `
                                <div class="yh-game-squad-empty-members">
                                    No ranked squads yet.
                                </div>
                            `
                    }
                </div>
            </section>
        </div>
        <div class="yh-game-squad-contributions">
            <div class="yh-game-squad-member-list-head">
                Recent Contributions
            </div>

            ${
                recentContributions.length
                    ? recentContributions
                        .slice(0, 8)
                        .map(
                            (entry) => `
                                <div class="yh-game-squad-contribution-row">
                                    <span class="yh-game-squad-contribution-mark">
                                        +
                                    </span>

                                    <div>
                                        <strong>
                                            ${escapeHtml(
                                                entry.contributorName ||
                                                'YH Member'
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(
                                                entry.label ||
                                                'Squad contribution'
                                            )}
                                        </small>
                                    </div>

                                    <b>
                                        +${Number(
                                            entry.xp || 0
                                        ).toLocaleString()}
                                        XP
                                    </b>
                                </div>
                            `
                        )
                        .join('')
                    : `
                        <div class="yh-game-squad-empty-members">
                            Complete Academy missions and check-ins
                            to start building Squad XP.
                        </div>
                    `
            }
        </div>
        <div class="yh-game-squad-management-actions">
            ${
                isOwner
                    ? `
                        <button
                            type="button"
                            class="yh-game-squad-danger"
                            data-yh-disband-squad
                        >
                            Disband Squad
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            class="yh-game-squad-danger"
                            data-yh-leave-squad
                        >
                            Leave Squad
                        </button>
                    `
            }
        </div>
    `);
    bindSquadWorkspaceTabsV1();
    document
        .querySelector(
            '[data-yh-copy-squad-code]'
        )
        ?.addEventListener(
            'click',
            async (event) => {
                const button =
                    event.currentTarget;

                const code =
                    button.getAttribute(
                        'data-yh-copy-squad-code'
                    ) || '';

                try {
                    await navigator.clipboard
                        .writeText(code);

                    button.textContent =
                        'Copied';
                } catch (_) {
                    button.textContent =
                        code;
                }
            }
        );

    document
        .querySelector(
            '[data-yh-regenerate-squad-code]'
        )
        ?.addEventListener(
            'click',
            async (event) => {
                const confirmed =
                    await window.YHSharedCore
                        ?.openYHConfirmModal?.({
                            title:
                                'Regenerate invitation code?',
                            message:
                                'The old code will stop working.',
                            okText:
                                'Regenerate',
                            cancelText:
                                'Cancel'
                        });

                if (!confirmed) return;

                await runSquadManagementActionV1(
                    event.currentTarget,
                    {
                        url:
                            '/api/academy/squad/invite/regenerate',
                        method: 'POST',
                        loadingLabel:
                            'Regenerating...',
                        successMessage:
                            'New invitation code generated.'
                    }
                );
            }
        );

    document
        .querySelectorAll(
            '[data-yh-squad-member-role]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                async () => {
                    const userId =
                        button.getAttribute(
                            'data-yh-squad-member-role'
                        );

                    const action =
                        button.getAttribute(
                            'data-yh-next-role-action'
                        );

                    await runSquadManagementActionV1(
                        button,
                        {
                            url:
                                '/api/academy/squad/members/' +
                                encodeURIComponent(
                                    userId
                                ),
                            method: 'PATCH',
                            body: {
                                action
                            },
                            loadingLabel:
                                action === 'promote'
                                    ? 'Promoting...'
                                    : 'Demoting...',
                            successMessage:
                                'Member role updated.'
                        }
                    );
                }
            );
        });

    document
        .querySelectorAll(
            '[data-yh-remove-squad-member]'
        )
        .forEach((button) => {
            button.addEventListener(
                'click',
                async () => {
                    const confirmed =
                        await window.YHSharedCore
                            ?.openYHConfirmModal?.({
                                title:
                                    'Remove squad member?',
                                message:
                                    'This member will lose access to the squad.',
                                okText:
                                    'Remove Member',
                                cancelText:
                                    'Cancel',
                                tone:
                                    'danger'
                            });

                    if (!confirmed) return;

                    const userId =
                        button.getAttribute(
                            'data-yh-remove-squad-member'
                        );

                    await runSquadManagementActionV1(
                        button,
                        {
                            url:
                                '/api/academy/squad/members/' +
                                encodeURIComponent(
                                    userId
                                ),
                            method: 'PATCH',
                            body: {
                                action: 'remove'
                            },
                            loadingLabel:
                                'Removing...',
                            successMessage:
                                'Member removed.'
                        }
                    );
                }
            );
        });

    document
        .querySelector(
            '[data-yh-leave-squad]'
        )
        ?.addEventListener(
            'click',
            async (event) => {
                const confirmed =
                    await window.YHSharedCore
                        ?.openYHConfirmModal?.({
                            title:
                                'Leave this squad?',
                            message:
                                'You will need a new invitation code to join again.',
                            okText:
                                'Leave Squad',
                            cancelText:
                                'Cancel',
                            tone:
                                'danger'
                        });

                if (!confirmed) return;

                await runSquadManagementActionV1(
                    event.currentTarget,
                    {
                        url:
                            '/api/academy/squad/leave',
                        method: 'POST',
                        loadingLabel:
                            'Leaving...',
                        successMessage:
                            'You left the squad.',
                        clearSquad: true
                    }
                );
            }
        );

    document
        .querySelector(
            '[data-yh-disband-squad]'
        )
        ?.addEventListener(
            'click',
            async (event) => {
                const confirmed =
                    await window.YHSharedCore
                        ?.openYHConfirmModal?.({
                            title:
                                'Disband this squad?',
                            message:
                                'All members will be removed. This action cannot be reversed.',
                            okText:
                                'Disband Squad',
                            cancelText:
                                'Cancel',
                            tone:
                                'danger'
                        });

                if (!confirmed) return;

                await runSquadManagementActionV1(
                    event.currentTarget,
                    {
                        url:
                            '/api/academy/squad',
                        method: 'DELETE',
                        loadingLabel:
                            'Disbanding...',
                        successMessage:
                            'Squad disbanded.',
                        clearSquad: true
                    }
                );
            }
        );
}

    /* END PATCH: Live Academy Squad Dashboard UI v1 */

    function escapeHtml(value = '') {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function resolveDisplayName() {
        const candidates = [
            localStorage.getItem('yh_user_full_name'),
            localStorage.getItem('yh_user_display_name'),
            localStorage.getItem('yh_user_name'),
            sessionStorage.getItem('yh_user_name')
        ];

        return (
            candidates
                .map((value) => String(value || '').trim())
                .find(Boolean) || 'Hustler'
        );
    }

    function getDivisionActionMeta(division = '') {
        const map = {
            academy: {
                selector: '[data-yh-dashboard-shell="academy"]',
                label: 'Enter Academy'
            },
            plaza: {
                selector: '[data-yh-sidebar-child="plazas-explorer"]',
                label: 'Enter Open World'
            },
            federation: {
                selector: '[data-yh-sidebar-child="federation-command"]',
                label: 'Open Strategic Command'
            }
        };

        return map[division] || map.academy;
    }

    function buildProgressBar(score = 0) {
        const safeScore = Math.max(0, Math.min(100, Number(score || 0)));

        return `
            <div class="yh-game-progress-track" aria-hidden="true">
                <span
                    class="yh-game-progress-fill"
                    style="width:${safeScore}%"
                ></span>
            </div>
        `;
    }


    /* PATCH: Phase 3D-FE-3 — Dashboard Explorer profile preview v2 */

    function readPlazaExplorerPreviewV2() {
        if (
            plazaExplorerPreviewStateV2 &&
            typeof plazaExplorerPreviewStateV2 === 'object'
        ) {
            return plazaExplorerPreviewStateV2;
        }

        try {
            const parsed = JSON.parse(
                sessionStorage.getItem(
                    'yhPlazaExplorerPreviewV2'
                ) || 'null'
            );

            if (
                parsed &&
                typeof parsed === 'object'
            ) {
                plazaExplorerPreviewStateV2 = {
                    ...parsed
                };

                return plazaExplorerPreviewStateV2;
            }
        } catch (_) {}

        return null;
    }

    function syncPlazaExplorerPreviewV2(
        payload = {}
    ) {
        if (
            !payload ||
            typeof payload !== 'object'
        ) {
            return null;
        }

        plazaExplorerPreviewStateV2 = {
            ...payload,

            activeQuest:
                payload?.activeQuest &&
                typeof payload.activeQuest ===
                    'object'
                    ? {
                        ...payload.activeQuest
                    }
                    : null
        };

        return plazaExplorerPreviewStateV2;
    }

    function buildPlazaOpenWorldPreviewV1() {
        const preview =
            readPlazaExplorerPreviewV2();

        const canonical =
            window.YHUGameCore
                ?.getPlazaSnapshot?.() ||
            {};

        const reputationLoaded =
            canonical
                .hasPersistentReputation ===
            true;

        const rank =
            String(
                canonical.rank ||
                preview?.rank ||
                'Newcomer'
            ).trim();

        const homeZone =
            String(
                preview?.homeZone ||
                'Not established'
            ).trim();

        const availableQuests =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.availableQuests ||
                        0
                    )
                )
            );

        const visibleRegions =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.visibleRegions ||
                        0
                    )
                )
            );

        const totalReputation =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.totalReputation ||
                        0
                    )
                )
            );

        const weeklyReputation =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.weeklyReputation ||
                        0
                    )
                )
            );

        const eventCount =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.eventCount ||
                        0
                    )
                )
            );

        const activeQuestTitle =
            String(
                preview?.activeQuest?.title ||
                ''
            ).trim();

        return `
            <div class="yh-game-plaza-open-world-preview-v1 yh-game-plaza-explorer-preview-v2">
                <div class="yh-game-plaza-explorer-head-v2">
                    <div>
                        <small>Explorer Profile</small>
                        <strong>${escapeHtml(rank)}</strong>
                    </div>

                    <span>
                        ${
                            reputationLoaded
                                ? 'Live Ledger'
                                : 'Syncing Ledger'
                        }
                    </span>
                </div>

                <div class="yh-game-plaza-explorer-stats-v2">
                    <span>
                        <small>Home Zone</small>
                        <b>${escapeHtml(homeZone)}</b>
                    </span>

                    <span>
                        <small>Available Quests</small>
                        <b>${availableQuests}</b>
                    </span>

                    <span>
                        <small>Visible Regions</small>
                        <b>${visibleRegions}</b>
                    </span>

                    <span>
                        <small>Total Reputation</small>
                        <b>${totalReputation.toLocaleString()}</b>
                    </span>
                </div>

                <div class="yh-game-plaza-explorer-next-v2">
                    <small>Current Next Move</small>
                    <strong>
                        ${
                            activeQuestTitle
                                ? escapeHtml(
                                    activeQuestTitle
                                )
                                : escapeHtml(
                                    canonical.nextObjective ||
                                    'Open Explorer Mode'
                                )
                        }
                    </strong>
                </div>

                <p>
                    ${
                        reputationLoaded
                            ? `${weeklyReputation.toLocaleString()} Reputation this week across ${eventCount.toLocaleString()} immutable verified events.`
                            : 'Syncing the canonical Plaza Reputation ledger. No Academy-readiness fallback is used.'
                    }
                </p>
            </div>
        `;
    }

    /* END PATCH: Phase 3D-FE-3 — Dashboard Explorer profile preview v2 */

    /* PATCH: Phase 3E-FE-1 — Dashboard Federation Strategic preview v1 */

    function readFederationStrategicPreviewV1() {
        if (
            federationStrategicPreviewStateV1 &&
            typeof federationStrategicPreviewStateV1 === 'object'
        ) {
            return federationStrategicPreviewStateV1;
        }

        try {
            const parsed = JSON.parse(
                sessionStorage.getItem(
                    'yhFederationStrategicPreviewV1'
                ) || 'null'
            );

            if (parsed && typeof parsed === 'object') {
                federationStrategicPreviewStateV1 = {
                    ...parsed
                };
                return federationStrategicPreviewStateV1;
            }
        } catch (_) {}

        return null;
    }

    function syncFederationStrategicPreviewV1(payload = {}) {
        if (!payload || typeof payload !== 'object') return null;

        federationStrategicPreviewStateV1 = {
            ...payload,
            governance:
                payload?.governance &&
                typeof payload.governance === 'object'
                    ? { ...payload.governance }
                    : {},
            diplomacy:
                payload?.diplomacy &&
                typeof payload.diplomacy === 'object'
                    ? { ...payload.diplomacy }
                    : {},
            regionalStrategy:
                payload?.regionalStrategy &&
                typeof payload.regionalStrategy === 'object'
                    ? { ...payload.regionalStrategy }
                    : {},
            activeOperation:
                payload?.activeOperation &&
                typeof payload.activeOperation === 'object'
                    ? { ...payload.activeOperation }
                    : null
        };

        return federationStrategicPreviewStateV1;
    }

    function buildFederationStrategicPreviewV1() {
        const preview =
            readFederationStrategicPreviewV1();

        const canonical =
            window.YHUGameCore
                ?.getFederationSnapshot?.() ||
            {};

        const influenceLoaded =
            canonical
                .hasPersistentInfluence ===
            true;

        const rank =
            String(
                canonical.rank ||
                preview?.rank ||
                'Observer'
            ).trim();

        const homeRegion =
            String(
                preview?.homeRegion ||
                'Not established'
            ).trim();

        const activeOperations =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.activeOperations ||
                        0
                    )
                )
            );

        const strategicAlerts =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.strategicAlerts ||
                        0
                    )
                )
            );

        const totalInfluence =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.totalInfluence ||
                        0
                    )
                )
            );

        const weeklyInfluence =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.weeklyInfluence ||
                        0
                    )
                )
            );

        const influenceEventCount =
            Math.max(
                0,
                Math.round(
                    Number(
                        canonical.eventCount ||
                        0
                    )
                )
            );

        const operationTitle =
            String(
                preview?.activeOperation?.title ||
                ''
            ).trim();

        const operationPhase =
            String(
                preview?.activeOperation?.phase ||
                'No active phase'
            ).trim();

        const operationRisk =
            String(
                preview?.activeOperation?.risk ||
                'Not assessed'
            ).trim();

        const councilStatus =
            String(
                preview?.governance?.councilStatus ||
                'Wiring pending'
            ).trim();

        const activeProposals =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.governance
                            ?.activeProposals ||
                        0
                    )
                )
            );

        const diplomaticSignals =
            Math.max(
                0,
                Math.round(
                    Number(
                        preview?.diplomacy
                            ?.totalSignals ||
                        0
                    )
                )
            );

        const regionalStrategyState =
            String(
                preview?.regionalStrategy?.status ||
                'No regional signal'
            ).trim();

        const governanceAuthority =
            String(
                preview?.governance
                    ?.governanceAuthority ||
                'Wiring pending'
            ).trim();

        return `
            <div class="yh-game-federation-strategic-preview-v1">
                <div class="yh-game-federation-strategic-head-v1">
                    <div>
                        <small>Strategic Profile</small>
                        <strong>${escapeHtml(rank)}</strong>
                    </div>

                    <span>
                        ${
                            influenceLoaded
                                ? 'Live Ledger'
                                : 'Syncing Ledger'
                        }
                    </span>
                </div>

                <div class="yh-game-federation-strategic-stats-v1">
                    <span>
                        <small>Home Region</small>
                        <b>${escapeHtml(homeRegion)}</b>
                    </span>

                    <span>
                        <small>Active Operations</small>
                        <b>${activeOperations}</b>
                    </span>

                    <span>
                        <small>Strategic Alerts</small>
                        <b>${strategicAlerts}</b>
                    </span>

                    <span>
                        <small>Total Influence</small>
                        <b>${totalInfluence.toLocaleString()}</b>
                    </span>
                </div>

                <div class="yh-game-federation-strategic-next-v1">
                    <small>Current Next Move</small>
                    <strong>
                        ${
                            operationTitle
                                ? escapeHtml(
                                    operationTitle
                                )
                                : escapeHtml(
                                    canonical.nextObjective ||
                                    'Open Strategic Command'
                                )
                        }
                    </strong>
                </div>

                <div class="yh-game-federation-operation-state-v2">
                    <span>
                        <small>Operation Phase</small>
                        <b>${escapeHtml(operationPhase)}</b>
                    </span>

                    <span>
                        <small>Risk Context</small>
                        <b>${escapeHtml(operationRisk)}</b>
                    </span>

                    <span>
                        <small>Verified Events</small>
                        <b>${influenceEventCount.toLocaleString()}</b>
                    </span>
                </div>

                <div class="yh-game-federation-governance-state-v3">
                    <span>
                        <small>Council Status</small>
                        <b>${escapeHtml(councilStatus)}</b>
                    </span>

                    <span>
                        <small>Active Proposals</small>
                        <b>${activeProposals}</b>
                    </span>

                    <span>
                        <small>Diplomatic Signals</small>
                        <b>${diplomaticSignals}</b>
                    </span>

                    <span>
                        <small>Regional Strategy State</small>
                        <b>${escapeHtml(regionalStrategyState)}</b>
                    </span>
                </div>

                <div class="yh-game-federation-governance-note-v3">
                    <small>Governance</small>
                    <strong>${escapeHtml(governanceAuthority)}</strong>
                </div>

                <p>
                    ${
                        influenceLoaded
                            ? `${weeklyInfluence.toLocaleString()} Influence this week across ${influenceEventCount.toLocaleString()} immutable verified events.`
                            : 'Syncing the canonical Federation Influence ledger. No Academy or Plaza fallback is used.'
                    }
                    Council seats, votes, alliances, and governance authority remain disabled.
                </p>
            </div>
        `;
    }



    /* END PATCH: Phase 3E-FE-1 — Dashboard Federation Strategic preview v1 */

    function buildDivisionCard(snapshot = {}) {
        const division = String(snapshot.division || '').trim();
        const action = getDivisionActionMeta(division);
        const score = Math.round(Number(snapshot.score || 0));
        const isPreview = snapshot.isPreview === true;
        const isPersistentAcademy =
            division === 'academy' &&
            snapshot.hasPersistentProgression === true;

        const isPersistentPlaza =
            division === 'plaza' &&
            snapshot.hasPersistentReputation === true;

        const isPersistentFederation =
            division === 'federation' &&
            snapshot.hasPersistentInfluence === true;

        const title =
            division === 'academy'
                ? 'Academy'
                : division === 'plaza'
                    ? 'Plazas'
                    : 'Federation';

        const kicker =
            division === 'academy'
                ? 'Solo Progression'
                : division === 'plaza'
                    ? 'Open World'
                    : 'Strategic Endgame';

        const icon =
            division === 'academy'
                ? '✦'
                : division === 'plaza'
                    ? '◎'
                    : '⬡';

        return `
            <article
                class="yh-game-division-card"
                data-yh-game-division="${escapeHtml(division)}"
            >
                <div class="yh-game-division-top">
                    <span class="yh-game-division-icon" aria-hidden="true">
                        ${icon}
                    </span>

                    <div class="yh-game-division-heading">
                        <small>${escapeHtml(kicker)}</small>
                        <h3>${escapeHtml(title)}</h3>
                    </div>

                    <span
                        class="yh-game-access-state ${
                            snapshot.approved ? 'is-approved' : ''
                        }"
                    >
                        ${snapshot.approved ? 'Active' : 'Building'}
                    </span>
                </div>

                <div class="yh-game-rank-row">
                    <div>
                        <small>Current Rank</small>
                        <strong>${escapeHtml(snapshot.rank)}</strong>
                    </div>

                    <div class="yh-game-score">
                        <small class="yh-game-score-label">
                            ${
                                isPersistentAcademy
                                    ? 'Rank Progress'
                                    : isPersistentPlaza
                                        ? 'Total Reputation'
                                        : isPersistentFederation
                                            ? 'Total Influence'
                                            : isPreview
                                                ? 'Readiness Preview'
                                                : 'Readiness Signal'
                            }
                        </small>

                        <div>
                            <strong>
                                ${
                                    isPersistentPlaza
                                        ? Number(
                                            snapshot.totalReputation ||
                                            0
                                        ).toLocaleString()
                                        : isPersistentFederation
                                            ? Number(
                                                snapshot.totalInfluence ||
                                                0
                                            ).toLocaleString()
                                            : score
                                }
                            </strong>
                            <span>
                                ${
                                    isPersistentPlaza ||
                                    isPersistentFederation
                                        ? 'pts'
                                        : '/100'
                                }
                            </span>
                        </div>
                    </div>
                </div>

                ${buildProgressBar(score)}

                ${
                    isPersistentAcademy
                        ? `
                            <div class="yh-game-academy-xp-strip">
                                <span>
                                    Level ${Number(snapshot.level || 1)}
                                </span>

                                <strong>
                                    ${Number(snapshot.totalXp || 0).toLocaleString()} XP
                                </strong>

                                <span>
                                    ${Number(snapshot.weeklyXp || 0).toLocaleString()} this week
                                </span>
                            </div>
                        `
                        : ''
                }

                ${
                    division === 'academy'
                        ? (
                            buildAcademySoloModePreviewV1() +
                            buildAcademyQuestAchievementPreviewV1()
                        )
                        : division === 'plaza'
                            ? buildPlazaOpenWorldPreviewV1()
                            : division === 'federation'
                                ? buildFederationStrategicPreviewV1()
                                : ''
                }

                <p class="yh-game-division-status">
                    ${escapeHtml(snapshot.progressionLabel)}
                </p>

                <div class="yh-game-next-objective">
                    <small>Next objective</small>
                    <span>${escapeHtml(snapshot.nextObjective)}</span>
                </div>

                <button
                    type="button"
                    class="yh-game-division-action"
                    data-yh-game-open-selector="${escapeHtml(action.selector)}"
                >
                    ${escapeHtml(action.label)}
                </button>
            </article>
        `;
    }

    function buildSquadActiveMissionPreviewV1() {
        if (
            academySquadMissionsStateV1
                .loading === true ||
            academySquadMissionsStateV1
                .loaded !== true
        ) {
            return `
                <div class="yh-game-squad-active-mission is-loading">
                    <small>
                        Active Squad Mission
                    </small>

                    <div class="yh-game-squad-active-mission-loading">
                        <span></span>
                        Loading operation...
                    </div>
                </div>
            `;
        }

        const mission =
            getPrimaryActiveSquadMissionV1();

        if (!mission) {
            return `
                <div class="yh-game-squad-active-mission is-empty">
                    <small>
                        Active Squad Mission
                    </small>

                    <strong>
                        No active operation
                    </strong>

                    <p>
                        Create a shared Squad mission to begin
                        tracking team progress.
                    </p>

                    <button
                        type="button"
                        data-yh-game-squad-open-missions
                    >
                        Open Missions
                    </button>
                </div>
            `;
        }

        const progress =
            getSquadMissionProgressV1(
                mission
            );

        return `
            <div class="yh-game-squad-active-mission">
                <div class="yh-game-squad-active-mission-head">
                    <div>
                        <small>
                            Active Squad Mission
                        </small>

                        <strong>
                            ${escapeHtml(
                                mission.title ||
                                'Squad Mission'
                            )}
                        </strong>
                    </div>

                    <span>
                        ${progress.percent}%
                    </span>
                </div>

                <div class="yh-game-squad-active-mission-progress">
                    <div>
                        <b>
                            ${progress.progress.toLocaleString()}
                            /
                            ${progress.target.toLocaleString()}
                        </b>

                        <span>
                            ${Number(
                                mission.rewardXp ||
                                0
                            ).toLocaleString()}
                            XP reward
                        </span>
                    </div>

                    <div class="yh-game-squad-mission-progress-track">
                        <span
                            style="width:${progress.percent}%"
                        ></span>
                    </div>
                </div>

                <button
                    type="button"
                    data-yh-game-squad-open-missions
                >
                    Open Mission
                </button>
            </div>
        `;
    }
    function buildSquadCard(
        squad = {}
    ) {
        const loaded =
            squad?.loaded === true;

        const joined =
            squad?.joined === true;

        if (!loaded) {
            return `
                <article class="yh-game-side-card yh-game-squad-card">
                    <div class="yh-game-side-card-head">
                        <div>
                            <small>Squad System</small>
                            <h3>Loading Squad</h3>
                        </div>

                        <span class="yh-game-preview-badge">
                            Live
                        </span>
                    </div>

                    <p>
                        Checking your current Academy squad membership.
                    </p>

                    <div class="yh-game-squad-loading">
                        <span></span>
                        Loading squad...
                    </div>
                </article>
            `;
        }

        return `
            <article class="yh-game-side-card yh-game-squad-card">
                <div class="yh-game-side-card-head">
                    <div>
                        <small>
                            ${joined
                                ? 'Your Squad'
                                : 'Squad System'}
                        </small>

                        <h3>
                            ${
                                joined
                                    ? `
                                        <span class="yh-game-squad-title-emblem">
                                            ${escapeHtml(
                                                squad.emblem ||
                                                '⚡'
                                            )}
                                        </span>

                                        ${escapeHtml(
                                            squad.name ||
                                            'Academy Squad'
                                        )}
                                    `
                                    : 'No Squad Yet'
                            }
                        </h3>
                    </div>

                    <span class="yh-game-preview-badge">
                        ${joined
                            ? escapeHtml(
                                squad.role ||
                                'member'
                            )
                            : 'Live'}
                    </span>
                </div>

                <p>
                    ${
                        joined
                            ? `
                                ${Number(
                                    squad.members || 0
                                )} of ${Number(
                                    squad.maxMembers || 8
                                )} members
                                • ${
                                    squad.weeklyPosition?.position
                                        ? (
                                            'Weekly Rank #' +
                                            Number(
                                                squad
                                                    .weeklyPosition
                                                    .position
                                            )
                                        )
                                        : 'Weekly Rank Unranked'
                                }
                                • ${Number(
                                    squad.totalXp || 0
                                ).toLocaleString()} XP
                            `
                            : `
                                Create or join a small Academy team for
                                shared missions, contracts, operations,
                                and squad rankings.
                            `
                    }
                </p>

                <div
                    class="yh-game-squad-slots"
                    aria-label="${
                        Number(
                            squad.members || 0
                        )
                    } of ${
                        Number(
                            squad.maxMembers || 8
                        )
                    } squad positions filled"
                >
                    ${Array.from({
                        length:
                            Number(
                                squad.maxMembers || 8
                            )
                    })
                        .map((_, index) => {
                            const occupied =
                                joined &&
                                index <
                                    Number(
                                        squad.members || 0
                                    );

                            return `
                                <span class="${
                                    occupied
                                        ? 'is-filled'
                                        : ''
                                }">
                                    ${
                                        occupied
                                            ? '●'
                                            : '+'
                                    }
                                </span>
                            `;
                        })
                        .join('')}
                </div>

                ${
                    joined
                        ? `
                            ${buildSquadActiveMissionPreviewV1()}

                            <div class="yh-game-squad-live-meta">
                            <div>
                                <small>
                                    Level ${Number(
                                        squad.level || 1
                                    )}
                                </small>

                                <strong>
                                    ${Number(
                                        squad.weeklyXp || 0
                                    ).toLocaleString()}
                                    weekly XP
                                </strong>
                            </div>

                            <div>
                                <small>Invite Code</small>
                                    <strong>
                                        ${escapeHtml(
                                            squad.inviteCode ||
                                            'Unavailable'
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <button
                                type="button"
                                class="yh-game-squad-primary yh-game-squad-card-main-action"
                                data-yh-game-squad-open
                            >
                                Open Squad
                            </button>
                        `
                        : `
                            <div class="yh-game-squad-card-actions">
                                <button
                                    type="button"
                                    class="yh-game-squad-primary"
                                    data-yh-game-squad-create
                                >
                                    Create Squad
                                </button>

                                <button
                                    type="button"
                                    class="yh-game-squad-secondary"
                                    data-yh-game-squad-join
                                >
                                    Search for Squad
                                </button>
                            </div>
                        `
                }
            </article>
        `;
    }
/* PATCH: Academy leaderboard visible-name safety v1 */

function resolveAcademyLeaderboardNameV1(
    entry = {}
) {
    const invalidNames =
        new Set([
            '',
            'academy member',
            'yh member',
            'hustler',
            'member',
            'user'
        ]);

    const displayName =
        String(
            entry.displayName ||
            entry.display_name ||
            ''
        ).trim();

    const username =
        String(
            entry.username ||
            ''
        )
            .trim()
            .replace(/^@+/, '');

    if (
        displayName &&
        !displayName.includes('@') &&
        !invalidNames.has(
            displayName.toLowerCase()
        )
    ) {
        return displayName;
    }

    if (
        username &&
        !username.includes('@') &&
        !invalidNames.has(
            username.toLowerCase()
        )
    ) {
        return username;
    }

    return 'YH Member';
}

/* END PATCH: Academy leaderboard visible-name safety v1 */
    function buildProgressSummaryCard(snapshot = {}) {
        const academyLeaderboard =
            window.YHUGameCore
                ?.getAcademyLeaderboardSnapshot?.() || {};

        const leaderboard = Array.isArray(
            academyLeaderboard.leaderboard
        )
            ? academyLeaderboard.leaderboard
            : [];

        const leaderboardFreshnessStatus =
            String(
                academyLeaderboard
                    ?.freshness
                    ?.status ||
                ''
            )
                .trim()
                .toLowerCase();

        const leaderboardFreshnessLabel =
            leaderboardFreshnessStatus ===
            'fresh'
                ? 'Fresh'
                : leaderboardFreshnessStatus ===
                    'mixed_aging'
                    ? 'Some aging'
                    : leaderboardFreshnessStatus ===
                        'mixed_stale'
                        ? 'Some stale'
                        : 'Server ranked';

        if (leaderboard.length) {
            return `
                <article class="yh-game-side-card yh-game-leaderboard-card">
                    <div class="yh-game-side-card-head">
                        <div>
                            <small>Academy Leaderboard</small>
                            <h3>Weekly Top Members</h3>
                        </div>

                        <span class="yh-game-preview-badge">
                            ${
                                academyLeaderboard.playerPosition
                                    ? `You: #${academyLeaderboard.playerPosition} · ${leaderboardFreshnessLabel}`
                                    : `Weekly · ${leaderboardFreshnessLabel}`
                            }
                        </span>
                    </div>

                    <div class="yh-game-leaderboard-list">
                        ${leaderboard
                            .slice(0, 5)
                            .map((entry) => `
                                <div class="yh-game-leaderboard-row">
                                    <span class="yh-game-leaderboard-position">
                                        ${Number(entry.position || 0)}
                                    </span>

                                    <div>
                                        <strong>
                                        ${escapeHtml(
                                            resolveAcademyLeaderboardNameV1(
                                                entry
                                            )
                                        )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(entry.rank || 'Initiate')}
                                            • Level ${Number(entry.level || 1)}
                                            ${
                                                entry.stale
                                                    ? ' • Stale'
                                                    : ''
                                            }
                                        </small>
                                    </div>

                                    <b>
                                        ${Number(entry.xp || 0).toLocaleString()}
                                        <small>XP</small>
                                    </b>
                                </div>
                            `)
                            .join('')}
                    </div>

                    <p class="yh-game-preview-note">
                        Weekly ranking is based on verified Academy
                        mission, check-in, streak, and completion events.
                    </p>
                </article>
            `;
        }

        const entries = [
            {
                key: 'academy',
                label: 'Academy',
                mode: 'Solo',
                data: snapshot.divisions.academy
            },
            {
                key: 'plaza',
                label: 'Plazas',
                mode: 'Open World',
                data: snapshot.divisions.plaza
            },
            {
                key: 'federation',
                label: 'Federation',
                mode: 'Strategic',
                data: snapshot.divisions.federation
            }
        ];

        return `
            <article class="yh-game-side-card yh-game-leaderboard-card">
                <div class="yh-game-side-card-head">
                    <div>
                        <small>Division Progress</small>
                        <h3>Your Current Readiness</h3>
                    </div>

                    <span class="yh-game-preview-badge">
                        Live Summary
                    </span>
                </div>

                <div class="yh-game-leaderboard-list">
                    ${entries.map((entry) => {
                        const score = Math.round(
                            Number(entry.data?.score || 0)
                        );

                        return `
                            <div class="yh-game-leaderboard-row">
                                <span
                                    class="yh-game-division-summary-mark"
                                    data-yh-summary-division="${escapeHtml(entry.key)}"
                                    aria-hidden="true"
                                ></span>

                                <div>
                                    <strong>${escapeHtml(entry.label)}</strong>
                                    <small>
                                        ${escapeHtml(
                                            entry.data?.rank ||
                                            'Awaiting Signal'
                                        )}
                                        • ${escapeHtml(entry.mode)}
                                    </small>
                                </div>

                                <b>
                                    ${score}
                                    <small>
                                        ${
                                            entry.data?.isPreview
                                                ? 'preview'
                                                : 'signal'
                                        }
                                    </small>
                                </b>
                            </div>
                        `;
                    }).join('')}
                </div>

                <p class="yh-game-preview-note">
                    Loading verified Academy progression and rankings.
                </p>
            </article>
        `;
    }


    function buildMarkup(snapshot = {}) {
        const operator = snapshot.operator || {};
        const divisions = snapshot.divisions || {};

        return `
            <section class="yh-game-foundation" id="${ROOT_ID}">
                <header class="yh-game-operator-panel">
                    <div class="yh-game-operator-copy">
                        <small class="yh-game-system-kicker">
                            YHU Operator Progression
                        </small>

                        <h2>
                            ${escapeHtml(resolveDisplayName())}
                        </h2>

                        <p>
                            Three separate progression paths. Build yourself in
                            Academy, expand through the Plazas, and earn strategic
                            influence inside the Federation.
                        </p>
                    </div>

                    <div class="yh-game-operator-rank">
                        <small>Global Operator Rank</small>
                        <strong>${escapeHtml(operator.rank || 'Initiate')}</strong>
                        <span>Level ${Number(operator.level || 1)}</span>
                    </div>

                    <div class="yh-game-operator-progress">
                        <div>
                            <span>Current Readiness</span>
                            <strong>${Math.round(
                                Number(operator.averageScore || 0)
                            )}%</strong>
                        </div>

                        ${buildProgressBar(operator.averageScore)}
                    </div>
                </header>

                <div class="yh-game-division-grid">
                    ${buildDivisionCard(divisions.academy || {})}
                    ${buildDivisionCard(divisions.plaza || {})}
                    ${buildDivisionCard(divisions.federation || {})}
                </div>

                <div class="yh-game-meta-grid">
                    ${buildProgressSummaryCard(snapshot)}
                    ${buildSquadCard(snapshot.squad || {})}
                </div>
            </section>
        `;
    }

    function findInsertionTarget() {
        return (
            document.getElementById('yh-universe-academy-strip') ||
            document.querySelector('.yh-universe-academy-strip') ||
            document.querySelector('.yh-dashboard-main-content') ||
            document.querySelector('main')
        );
    }

    function bindActions(root) {
        if (
            !root ||
            root.dataset.yhGameActionsBound ===
                'true'
        ) {
            return;
        }

        root.dataset.yhGameActionsBound =
            'true';

        root.addEventListener(
            'click',
            (event) => {
                const createButton =
                    event.target.closest(
                        '[data-yh-game-squad-create]'
                    );

                if (createButton) {
                    openCreateSquadModalV1();
                    return;
                }

                const joinButton =
                    event.target.closest(
                        '[data-yh-game-squad-join]'
                    );

                if (joinButton) {
                    openJoinSquadModalV1();
                    return;
                }

                const openMissionsButton =
                    event.target.closest(
                        '[data-yh-game-squad-open-missions]'
                    );

                if (openMissionsButton) {
                    openSquadMissionsModalV1();
                    return;
                }

                const openButton =
                    event.target.closest(
                        '[data-yh-game-squad-open]'
                    );

                if (openButton) {
                    openSquadDetailsModalV1();
                    return;
                }

                const button =
                    event.target.closest(
                        '[data-yh-game-open-selector]'
                    );

                if (!button) return;

                const selector =
                    button.getAttribute(
                        'data-yh-game-open-selector'
                    );

                const target =
                    selector
                        ? document.querySelector(
                            selector
                        )
                        : null;

                if (
                    target instanceof
                    HTMLElement
                ) {
                    target.click();
                }
            }
        );
    }

    function renderDashboardGameFoundation() {
        if (
            document.body?.getAttribute('data-yh-page') !== 'dashboard' ||
            !window.YHUGameCore
        ) {
            return false;
        }

        const insertionTarget = findInsertionTarget();
        if (!insertionTarget?.parentElement) return false;

        const snapshot = window.YHUGameCore.getDashboardSnapshot();
        let root = document.getElementById(ROOT_ID);

        if (!root) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = buildMarkup(snapshot).trim();
            root = wrapper.firstElementChild;

            insertionTarget.parentElement.insertBefore(
                root,
                insertionTarget
            );
        } else {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = buildMarkup(snapshot).trim();

            const replacement = wrapper.firstElementChild;
            root.replaceWith(replacement);
            root = replacement;
        }

        bindActions(root);
        document.body.setAttribute('data-yh-game-foundation', 'ready');

        return true;
    }

    /* PATCH: Squad Mission completion celebration v1 */

    function readSeenSquadMissionCelebrationsV1() {
        try {
            const parsed =
                JSON.parse(
                    sessionStorage.getItem(
                        ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1
                    ) || '[]'
                );

            return new Set(
                Array.isArray(parsed)
                    ? parsed
                        .map((value) =>
                            String(value || '').trim()
                        )
                        .filter(Boolean)
                    : []
            );
        } catch (_) {
            return new Set();
        }
    }

    function markSquadMissionCelebrationSeenV1(
        missionId = ''
    ) {
        const cleanMissionId =
            String(missionId || '').trim();

        if (!cleanMissionId) {
            return;
        }

        try {
            const seen =
                readSeenSquadMissionCelebrationsV1();

            seen.add(cleanMissionId);

            sessionStorage.setItem(
                ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1,
                JSON.stringify(
                    Array.from(seen).slice(-50)
                )
            );
        } catch (_) {}
    }

    function collectCompletedSquadMissionsV1(
        detail = {}
    ) {
        const completedById =
            new Map();

        const visited =
            new Set();

        const roots = [
            detail?.squadMissionProgress,
            detail?.squadXp
                ?.squadMissionProgress
        ];

        const visit = (
            value,
            depth = 0
        ) => {
            if (
                value === null ||
                value === undefined ||
                depth > 7
            ) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    visit(entry, depth + 1);
                });

                return;
            }

            if (
                typeof value !== 'object' ||
                visited.has(value)
            ) {
                return;
            }

            visited.add(value);

            const missionId =
                String(
                    value.missionId ||
                    ''
                ).trim();

            const status =
                String(
                    value.status ||
                    ''
                )
                    .trim()
                    .toLowerCase();

            const completed =
                value.completed === true ||
                status === 'completed';

            if (
                missionId &&
                completed
            ) {
                const localMission =
                    academySquadMissionsStateV1
                        .missions
                        .find((mission) => {
                            return (
                                String(
                                    mission.id ||
                                    ''
                                ).trim() ===
                                missionId
                            );
                        }) ||
                    {};

                const rewardXp =
                    Math.max(
                        0,
                        Number(
                            value.reward
                                ?.awarded ??
                            localMission
                                .rewardXp ??
                            value.rewardXp ??
                            0
                        ) || 0
                    );

                completedById.set(
                    missionId,
                    {
                        missionId,

                        missionTitle:
                            String(
                                value.missionTitle ||
                                localMission.title ||
                                'Squad Mission'
                            ).trim(),

                        missionType:
                            String(
                                localMission.missionType ||
                                value.missionType ||
                                ''
                            ).trim(),

                        progress:
                            Math.max(
                                0,
                                Number(
                                    value.progress ??
                                    localMission.progress ??
                                    0
                                ) || 0
                            ),

                        target:
                            Math.max(
                                1,
                                Number(
                                    value.target ??
                                    localMission.target ??
                                    1
                                ) || 1
                            ),

                        rewardXp,

                        completedAt:
                            String(
                                localMission.completedAt ||
                                detail.occurredAt ||
                                new Date()
                                    .toISOString()
                            ).trim()
                    }
                );
            }

            Object.values(value)
                .forEach((entry) => {
                    visit(entry, depth + 1);
                });
        };

        roots.forEach((root) => {
            visit(root, 0);
        });

        return Array.from(
            completedById.values()
        );
    }

    function ensureSquadMissionCelebrationV1() {
        let overlay =
            document.getElementById(
                'yh-game-squad-celebration'
            );

        if (overlay) {
            return overlay;
        }

        overlay =
            document.createElement('div');

        overlay.id =
            'yh-game-squad-celebration';

        overlay.className =
            'yh-game-squad-celebration hidden-step';

        overlay.setAttribute(
            'role',
            'dialog'
        );

        overlay.setAttribute(
            'aria-modal',
            'true'
        );

        overlay.setAttribute(
            'aria-hidden',
            'true'
        );

        overlay.innerHTML = `
            <div class="yh-game-squad-celebration-card">
                <button
                    type="button"
                    class="yh-game-squad-celebration-close"
                    data-yh-squad-celebration-close
                    aria-label="Close celebration"
                >
                    ×
                </button>

                <div
                    id="yh-game-squad-celebration-content"
                ></div>
            </div>
        `;

        document.body.appendChild(
            overlay
        );

        overlay.addEventListener(
            'click',
            (event) => {
                const closeButton =
                    event.target
                        ?.closest?.(
                            '[data-yh-squad-celebration-close]'
                        );

                if (closeButton) {
                    closeSquadMissionCelebrationV1();
                    return;
                }

                const historyButton =
                    event.target
                        ?.closest?.(
                            '[data-yh-squad-celebration-history]'
                        );

                if (historyButton) {
                    const missionId =
                        String(
                            historyButton.getAttribute(
                                'data-yh-squad-celebration-history'
                            ) || ''
                        ).trim();

                    closeSquadMissionCelebrationV1({
                        advanceQueue: false
                    });

                    if (missionId) {
                        void openSquadMissionHistoryV1(
                            missionId,
                            {
                                force: true
                            }
                        );
                    }

                    return;
                }

                if (event.target === overlay) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        );

        return overlay;
    }

    function closeSquadMissionCelebrationV1({
        advanceQueue = true
    } = {}) {
        const overlay =
            document.getElementById(
                'yh-game-squad-celebration'
            );

        overlay?.classList.add(
            'hidden-step'
        );

        overlay?.setAttribute(
            'aria-hidden',
            'true'
        );

        document.body.classList.remove(
            'yh-game-squad-celebration-open'
        );

        academySquadMissionCelebrationActiveV1 =
            false;

        academySquadMissionCelebrationCurrentIdV1 =
            '';

        if (!advanceQueue) {
            academySquadMissionCelebrationQueueV1
                .splice(0);
            return;
        }

        window.setTimeout(() => {
            void showNextSquadMissionCelebrationV1();
        }, 140);
    }

    function buildSquadCelebrationContributorsV1(
        contributors = []
    ) {
        const list =
            Array.isArray(contributors)
                ? contributors.slice(0, 3)
                : [];

        if (!list.length) {
            return `
                <span class="yh-game-squad-celebration-contributor-empty">
                    Contributor summary will appear in Mission History.
                </span>
            `;
        }

        return list
            .map((contributor) => {
                return `
                    <span class="yh-game-squad-celebration-contributor">
                        <b>
                            ${escapeHtml(
                                contributor.displayName ||
                                'YH Member'
                            )}
                        </b>

                        <small>
                            +${Number(
                                contributor.amount ||
                                0
                            ).toLocaleString()}
                        </small>
                    </span>
                `;
            })
            .join('');
    }

    async function showNextSquadMissionCelebrationV1() {
        if (
            academySquadMissionCelebrationActiveV1 ||
            !academySquadMissionCelebrationQueueV1.length
        ) {
            return;
        }

        const seen =
            readSeenSquadMissionCelebrationsV1();

        let celebration = null;

        while (
            academySquadMissionCelebrationQueueV1.length &&
            !celebration
        ) {
            const candidate =
                academySquadMissionCelebrationQueueV1.shift();

            if (
                candidate?.missionId &&
                !seen.has(candidate.missionId)
            ) {
                celebration =
                    candidate;
            }
        }

        if (!celebration) {
            return;
        }

        const overlay =
            ensureSquadMissionCelebrationV1();

        const content =
            overlay.querySelector(
                '#yh-game-squad-celebration-content'
            );

        const squad =
            window.YHUGameCore
                ?.getAcademySquadSnapshotV1?.() ||
            {};

        academySquadMissionCelebrationActiveV1 =
            true;

        academySquadMissionCelebrationCurrentIdV1 =
            celebration.missionId;

        markSquadMissionCelebrationSeenV1(
            celebration.missionId
        );

        if (content) {
            content.innerHTML = `
                <div
                    class="yh-game-squad-celebration-particles"
                    aria-hidden="true"
                >
                    <i></i><i></i><i></i><i></i>
                    <i></i><i></i><i></i><i></i>
                </div>

                <div class="yh-game-squad-celebration-emblem">
                    <span>${escapeHtml(
                        squad.emblem || '⚡'
                    )}</span>
                </div>

                <div class="yh-game-squad-celebration-kicker">
                    Squad Mission Complete
                </div>

                <h2>
                    ${escapeHtml(
                        celebration.missionTitle ||
                        'Squad Mission'
                    )}
                </h2>

                <p class="yh-game-squad-celebration-copy">
                    ${escapeHtml(
                        squad.name ||
                        'Your Squad'
                    )}
                    reached the shared target through verified member activity.
                </p>

                <div class="yh-game-squad-celebration-reward">
                    <small>Squad Reward</small>

                    <strong>
                        ${
                            celebration.rewardXp > 0
                                ? `+${Number(
                                    celebration.rewardXp
                                ).toLocaleString()}`
                                : 'Complete'
                        }
                    </strong>

                    <span>
                        ${
                            celebration.rewardXp > 0
                                ? 'Squad XP'
                                : 'Mission cleared'
                        }
                    </span>
                </div>

                <div class="yh-game-squad-celebration-stats">
                    <div>
                        <small>Final Progress</small>
                        <strong>
                            ${Number(
                                celebration.progress ||
                                celebration.target ||
                                0
                            ).toLocaleString()}
                            /
                            ${Number(
                                celebration.target ||
                                1
                            ).toLocaleString()}
                        </strong>
                    </div>

                    <div>
                        <small>Completed</small>
                        <strong>
                            ${escapeHtml(
                                formatSquadContributionTimeV1(
                                    celebration.completedAt
                                )
                            )}
                        </strong>
                    </div>
                </div>

                <div class="yh-game-squad-celebration-team">
                    <small>Top Contributors</small>

                    <div
                        class="yh-game-squad-celebration-contributors"
                        data-yh-squad-celebration-contributors
                    >
                        <span class="yh-game-squad-celebration-contributor-empty">
                            Loading contributor summary...
                        </span>
                    </div>
                </div>

                <div class="yh-game-squad-celebration-actions">
                    <button
                        type="button"
                        class="yh-game-squad-celebration-secondary"
                        data-yh-squad-celebration-history="${escapeHtml(
                            celebration.missionId
                        )}"
                    >
                        View Mission History
                    </button>

                    <button
                        type="button"
                        class="yh-game-squad-celebration-primary"
                        data-yh-squad-celebration-close
                    >
                        Continue
                    </button>
                </div>
            `;
        }

        overlay.classList.remove(
            'hidden-step'
        );

        overlay.setAttribute(
            'aria-hidden',
            'false'
        );

        document.body.classList.add(
            'yh-game-squad-celebration-open'
        );

        overlay
            .querySelector(
                '.yh-game-squad-celebration-primary'
            )
            ?.focus();

        try {
            const history =
                await loadSquadMissionHistoryV1(
                    celebration.missionId,
                    {
                        force: true
                    }
                );

            if (
                academySquadMissionCelebrationCurrentIdV1 !==
                celebration.missionId
            ) {
                return;
            }

            const contributorContainer =
                overlay.querySelector(
                    '[data-yh-squad-celebration-contributors]'
                );

            if (contributorContainer) {
                contributorContainer.innerHTML =
                    buildSquadCelebrationContributorsV1(
                        history?.contributors ||
                        []
                    );
            }
        } catch (_) {
            const contributorContainer =
                overlay.querySelector(
                    '[data-yh-squad-celebration-contributors]'
                );

            if (contributorContainer) {
                contributorContainer.innerHTML =
                    buildSquadCelebrationContributorsV1(
                        []
                    );
            }
        }
    }

    function queueSquadMissionCelebrationsV1(
        detail = {}
    ) {
        const seen =
            readSeenSquadMissionCelebrationsV1();

        const completions =
            collectCompletedSquadMissionsV1(
                detail
            );

        completions.forEach((completion) => {
            const alreadyQueued =
                academySquadMissionCelebrationQueueV1
                    .some((entry) => {
                        return (
                            entry.missionId ===
                            completion.missionId
                        );
                    });

            if (
                !completion.missionId ||
                seen.has(completion.missionId) ||
                alreadyQueued ||
                academySquadMissionCelebrationCurrentIdV1 ===
                    completion.missionId
            ) {
                return;
            }

            academySquadMissionCelebrationQueueV1
                .push(completion);
        });

        void showNextSquadMissionCelebrationV1();

        return completions;
    }

    /* END PATCH: Squad Mission completion celebration v1 */

    /* PATCH: Academy Squad live synchronization v1 */

    function getOpenSquadWorkspaceTabV1() {
        const modal =
            document.getElementById(
                'yh-game-squad-modal'
            );

        if (
            !modal ||
            modal.classList.contains(
                'hidden-step'
            ) ||
            modal.getAttribute(
                'aria-hidden'
            ) === 'true'
        ) {
            return '';
        }

        const activeButton =
            modal.querySelector(
                '[data-yh-squad-workspace-tab].is-active'
            );

        return String(
            activeButton?.getAttribute(
                'data-yh-squad-workspace-tab'
            ) || ''
        )
            .trim()
            .toLowerCase();
    }

    function rerenderOpenSquadWorkspaceV1(
        activeTab = ''
    ) {
        const cleanTab =
            String(activeTab || '')
                .trim()
                .toLowerCase();

        if (!cleanTab) {
            return;
        }

        /*
         * Do not destroy unsaved Create/Edit Mission input.
         */
        if (
            document.getElementById(
                'yh-game-squad-mission-form'
            )
        ) {
            return;
        }

        if (cleanTab === 'missions') {
            renderSquadMissionsWorkspaceV1(
                academySquadMissionsStateV1
            );

            return;
        }

        if (cleanTab === 'rankings') {
            openSquadRankingsModalV1();
            return;
        }

        if (cleanTab === 'members') {
            openSquadMembersModalV1();
            return;
        }

        if (cleanTab === 'activity') {
            openSquadActivityModalV1();
            return;
        }

        openSquadDetailsModalV1(
            'overview'
        );
    }

    async function refreshAcademySquadLiveStateV1(
        detail = {}
    ) {
        if (academySquadLiveSyncPromise) {
            return academySquadLiveSyncPromise;
        }

        const activeTab =
            getOpenSquadWorkspaceTabV1();

        const openHistoryMissionId =
            String(
                document
                    .querySelector(
                        '[data-yh-squad-mission-history-view]'
                    )
                    ?.getAttribute(
                        'data-yh-squad-mission-history-view'
                    ) ||
                ''
            ).trim();

        const progression =
            detail?.progression &&
            typeof detail.progression ===
                'object'
                ? detail.progression
                : null;

        if (progression) {
            syncAcademySoloModeStateV1(
                progression
            );

            window.YHUGameCore
                ?.setAcademyProgressionCache?.(
                    progression
                );
        }

        academySquadLiveSyncPromise =
            (async () => {
                /*
                 * Finish an older request first, then issue
                 * a guaranteed post-action refresh.
                 */
                const pendingRequests = [
                    academyProgressionLoadPromise,
                    academySquadLoadPromise,
                    academySquadMissionsLoadPromise
                ].filter(Boolean);

                if (pendingRequests.length) {
                    await Promise.allSettled(
                        pendingRequests
                    );
                }

                academyProgressionLoaded =
                    false;

                academySquadLoaded =
                    false;

                academySquadMissionsStateV1 = {
                    ...academySquadMissionsStateV1,
                    loaded: false,
                    loading: false
                };

                academySquadMissionHistoryCacheV1
                    .clear();

                await Promise.allSettled([
                    loadAcademyProgressionOnce({
                        force: true
                    }),

                    loadAcademySquadV1({
                        force: true
                    }),

                    loadAcademySquadMissionsV1({
                        force: true
                    })
                ]);

                academyGameLastRefreshAtV1 =
                    Date.now();

                renderDashboardGameFoundation();

                if (openHistoryMissionId) {
                    await openSquadMissionHistoryV1(
                        openHistoryMissionId,
                        {
                            force: true
                        }
                    );
                } else {
                    rerenderOpenSquadWorkspaceV1(
                        activeTab
                    );
                }

                return true;
            })()
                .finally(() => {
                    academySquadLiveSyncPromise =
                        null;
                });

        return academySquadLiveSyncPromise;
    }

    window.YHURefreshAcademySquadLiveStateV1 =
        refreshAcademySquadLiveStateV1;

    /* END PATCH: Academy Squad live synchronization v1 */

    function clearAcademyGameRenderRetryTimersV1() {
        academyGameRenderRetryTimersV1
            .forEach((timer) => {
                window.clearTimeout(timer);
            });

        academyGameRenderRetryTimersV1.clear();
    }

    function scheduleAcademyGameRenderRetriesV1() {
        if (academyGameRenderRetryTimersV1.size) {
            return;
        }

        [80, 240, 600, 1200].forEach((delay) => {
            const timer = window.setTimeout(() => {
                academyGameRenderRetryTimersV1
                    .delete(timer);

                const rendered =
                    renderDashboardGameFoundation();

                if (rendered) {
                    clearAcademyGameRenderRetryTimersV1();
                }
            }, delay);

            academyGameRenderRetryTimersV1.add(timer);
        });
    }

    function boot() {
        const rendered =
            renderDashboardGameFoundation();

        if (rendered) {
            clearAcademyGameRenderRetryTimersV1();
        } else {
            scheduleAcademyGameRenderRetriesV1();
        }

        if (academyGameBootPromiseV1) {
            return academyGameBootPromiseV1;
        }

        academyGameBootPromiseV1 =
            Promise.allSettled([
                loadAcademyProgressionOnce(),
                loadAcademySquadV1(),
                loadAcademySquadMissionsV1(),
                loadPlazaReputationOnceV1(),
                loadFederationInfluenceOnceV1()
            ])
                .then(() => {
                    academyGameLastRefreshAtV1 =
                        Date.now();

                    renderDashboardGameFoundation();
                    return true;
                })
                .finally(() => {
                    academyGameBootPromiseV1 = null;
                });

        return academyGameBootPromiseV1;
    }

    window.YHURenderDashboardGameFoundation =
        renderDashboardGameFoundation;

    window.addEventListener('yhu:game-core-ready', boot);

    window.addEventListener('storage', (event) => {
        const watchedKeys = Object.values(
            window.YHUGameCore?.STORAGE_KEYS || {}
        );

        if (watchedKeys.includes(event.key)) {
            renderDashboardGameFoundation();
        }
    });

    window.addEventListener(
        'pageshow',
        (event) => {
            renderDashboardGameFoundation();

            if (academyGameBootPromiseV1) {
                academyGameBootPromiseV1
                    .then(() => {
                        renderDashboardGameFoundation();
                    })
                    .catch(() => {});

                return;
            }

            const stale = Boolean(
                academyGameLastRefreshAtV1 === 0 ||
                Date.now() - academyGameLastRefreshAtV1 >
                    30000
            );

            if (event.persisted !== true && !stale) {
                return;
            }

            window.setTimeout(() => {
                if (document.hidden) return;

                Promise.allSettled([
                    loadAcademyProgressionOnce({
                        force: true
                    }),
                    loadAcademySquadV1({
                        force: true
                    }),
                    loadAcademySquadMissionsV1({
                        force: true
                    }),
                    loadPlazaReputationOnceV1({
                        force: true
                    }),
                    loadFederationInfluenceOnceV1({
                        force: true
                    })
                ]).then(() => {
                    academyGameLastRefreshAtV1 =
                        Date.now();

                    renderDashboardGameFoundation();
                });
            }, 120);
        }
    );

    document.addEventListener(
        'visibilitychange',
        () => {
            if (
                document.hidden ||
                academyGameBootPromiseV1 ||
                academySquadLiveSyncPromise ||
                !academyGameLastRefreshAtV1 ||
                Date.now() - academyGameLastRefreshAtV1 <
                    60000
            ) {
                return;
            }

            Promise.allSettled([
                loadAcademyProgressionOnce({ force: true }),
                loadAcademySquadV1({ force: true }),
                loadAcademySquadMissionsV1({ force: true }),
                loadPlazaReputationOnceV1({ force: true }),
                loadFederationInfluenceOnceV1({ force: true })
            ]).then(() => {
                academyGameLastRefreshAtV1 = Date.now();
                renderDashboardGameFoundation();
            });
        }
    );

    window.addEventListener(
        'yhu:academy-progression-updated',
        (event) => {
            syncAcademySoloModeStateV1(
                event?.detail || {}
            );

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener(
        'yhu:academy-quest-state-updated',
        (event) => {
            syncAcademyQuestAchievementStateV1(
                event?.detail || {}
            );

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener(
        'yhu:academy-squad-updated',
        renderDashboardGameFoundation
    );
/* PATCH: Receive Academy iframe live updates v2 */

window.addEventListener(
    'message',
    (event) => {
        if (
            event.origin !==
            window.location.origin
        ) {
            return;
        }

        const academyFrame =
            document.getElementById(
                'yh-universe-workspace-inline-frame'
            );

        /*
         * Only accept Academy messages from the active
         * same-origin Dashboard workspace iframe.
         */
        if (
            academyFrame?.contentWindow &&
            event.source !==
                academyFrame.contentWindow
        ) {
            return;
        }

        const data =
            event.data &&
            typeof event.data === 'object'
                ? event.data
                : null;

        if (!data) {
            return;
        }

        if (
            data.type ===
            'yhu:academy-progression-updated'
        ) {
            const progression =
                data.progression;

            if (
                progression &&
                typeof progression ===
                    'object'
            ) {
                syncAcademySoloModeStateV1(
                    progression
                );

                window.YHUGameCore
                    ?.setAcademyProgressionCache?.(
                        progression
                    );

                renderDashboardGameFoundation();
            }

            return;
        }

        if (
            data.type ===
            'yhu:academy-quest-state-updated'
        ) {
            syncAcademyQuestAchievementStateV1(
                data.questAchievementState ||
                data.detail ||
                {}
            );

            renderDashboardGameFoundation();
            return;
        }

        if (
            data.type ===
            'yhu:plaza-reputation-updated'
        ) {
            const saved =
                window.YHUGameCore
                    ?.setPlazaReputationCache?.(
                        data.detail ||
                        data.reputation ||
                        {}
                    );

            if (saved !== true) {
                renderDashboardGameFoundation();
            }

            return;
        }

        if (
            data.type ===
            'yhu:federation-influence-updated'
        ) {
            const saved =
                window.YHUGameCore
                    ?.setFederationInfluenceCache?.(
                        data.detail ||
                        data.influence ||
                        {}
                    );

            if (saved !== true) {
                renderDashboardGameFoundation();
            }

            return;
        }

        if (
            data.type ===
            'yhu:federation-strategic-preview-updated'
        ) {
            syncFederationStrategicPreviewV1(
                data.detail || {}
            );

            renderDashboardGameFoundation();
            return;
        }

        if (
            data.type ===
            'yhu:academy-squad-action-completed'
        ) {
            void refreshAcademySquadLiveStateV1(
                data
            )
                .catch(() => false)
                .then(() => {
                    queueSquadMissionCelebrationsV1(
                        data
                    );
                });
        }
    }
);

/* END PATCH: Receive Academy iframe live updates v2 */
    window.addEventListener(
        'yhu:federation-influence-updated',
        () => {
            federationInfluenceLoadedV1 =
                true;

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener(
        'yhu:federation-strategic-preview-updated',
        (event) => {
            syncFederationStrategicPreviewV1(
                event?.detail || {}
            );

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener(
        'yhu:plaza-reputation-updated',
        () => {
            plazaReputationLoadedV1 =
                true;

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener(
        'yhu:plaza-explorer-preview-updated',
        (event) => {
            syncPlazaExplorerPreviewV2(
                event?.detail || {}
            );

            renderDashboardGameFoundation();
        }
    );

    window.addEventListener('pagehide', () => {
        clearAcademyGameRenderRetryTimersV1();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, {
            once: true
        });
    } else {
        boot();
    }
})();