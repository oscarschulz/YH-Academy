// public/js/academy-embed.js
(function bootAcademyEmbed() {
    'use strict';

    const SECTION_COPY = {
        roadmap: {
            kicker: 'Academy Roadmap',
            title: 'Roadmap',
            subtitle: 'Build your 28-day foundation and execution path.',
            description: 'Your roadmap is the planning layer for discipline, direction, and consistent execution.'
        },
        missions: {
            kicker: 'Academy Missions',
            title: 'Missions',
            subtitle: 'Work through lead missions and task flows.',
            description: 'Missions are standalone Academy execution tracks: 3-Handshakes-Away, Cold-Calling, and Expansion.'
        },
        community: {
            kicker: 'Academy Community',
            title: 'Community Feed',
            subtitle: 'Post, react, and build your Academy circle.',
            description: 'Use the community feed to share progress, ask questions, and observe other operators.'
        },
        messages: {
            kicker: 'Academy Messages',
            title: 'Messages',
            subtitle: 'Continue Academy conversations.',
            description: 'Messages are for focused communication between members, mentors, and operators.'
        },
        voice: {
            kicker: 'Academy Live',
            title: 'Live Voice Lounge',
            subtitle: 'Join live execution rooms.',
            description: 'The voice lounge is for live rooms, execution check-ins, and guided discussions.'
        }
    };

    const state = {
        section: 'roadmap',
        profile: null,
        access: {
            academy: {
                status: 'syncing',
                canEnter: false
            }
        },
        roadmapHome: null,
        missionsPayload: null,
        playbooksPayload: null,
        roadmapIntakeSubmitted: false,
        roadmapFormBusy: false,
        roadmapGenerationPolling: false,
        roadmapGenerationAttempts: 0,
        lastRoadmapSubmissionResponse: null,
        selectedMissionPlaybook: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const ACADEMY_EMBED_LOADER_MIN_MS = 450;
    const ACADEMY_EMBED_LOADER_MAX_MS = 1500;
    let academyEmbedLoaderStartedAt = 0;
    let academyEmbedForceHideTimer = null;

    function cleanText(value, fallback = '') {
        if (value === null || value === undefined) return fallback;
        const text = String(value).trim();
        return text || fallback;
    }

    function escapeHtml(value = '') {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function numberOr(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function percentOr(value, fallback = 0) {
        const parsed = numberOr(value, fallback);
        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    function readArray(source = {}, keys = []) {
        for (const key of keys) {
            if (Array.isArray(source?.[key])) return source[key];
        }

        return [];
    }

    function readObject(source = {}, keys = []) {
        for (const key of keys) {
            const value = source?.[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        }

        return {};
    }

    function getSectionFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const raw = cleanText(params.get('section'), 'roadmap').toLowerCase();

        if (raw === 'home') return 'roadmap';
        if (raw === 'community-feed') return 'community';
        if (raw === 'live' || raw === 'lounge' || raw === 'live-voice-lounge') return 'voice';

        return SECTION_COPY[raw] ? raw : 'roadmap';
    }

    function getStoredToken() {
        try {
            if (window.YHSharedCore?.getStoredAuthToken) {
                return cleanText(window.YHSharedCore.getStoredAuthToken());
            }
        } catch (_) {}

        try {
            return cleanText(
                sessionStorage.getItem('yh_token') ||
                localStorage.getItem('yh_token') ||
                sessionStorage.getItem('token') ||
                localStorage.getItem('token') ||
                sessionStorage.getItem('yh_auth_token') ||
                localStorage.getItem('yh_auth_token') ||
                ''
            );
        } catch (_) {
            return '';
        }
    }

    async function fetchJson(url, options = {}) {
        const token = getStoredToken();

        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {})
            }
        });

        const text = await response.text();

        let payload = {};
        try {
            payload = text ? JSON.parse(text) : {};
        } catch (_) {
            payload = { success: false, message: text || 'Invalid JSON response.' };
        }

        if (!response.ok) {
            const error = new Error(payload?.message || `Request failed: ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }

        return payload;
    }

    function isAuthExpiredError(error = {}) {
        const message = cleanText(error?.message || error?.payload?.message).toLowerCase();

        return (
            error?.status === 400 && /gate pass|expired|invalid/.test(message)
        ) || (
            error?.status === 401 || error?.status === 403
        );
    }

    function clearStoredAuthTokens() {
        [
            'yh_token',
            'token',
            'yh_auth_token',
            'authToken',
            'jwt',
            'session_token'
        ].forEach((key) => {
            try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            } catch (_) {}
        });
    }

    function renderAuthExpired() {
        const stage = $('#yhaeStage');
        if (!stage) return;

        stage.innerHTML = `
            <section class="yhae-panel yhae-locked">
                <div class="yhae-kicker">Session Expired</div>
                <h1>Please sign in again.</h1>
                <p>Your current Gate Pass is expired, so the Academy cannot load or build your Roadmap yet.</p>
                <div class="yhae-form-actions">
                    <button type="button" class="yhae-small-btn" data-yhae-login-again>Go to Login</button>
                </div>
            </section>
        `;

        bindActions();
    }

    function normalizeStatus(value = '') {
        const clean = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

        if (['approved', 'active', 'accepted', 'member', 'enabled', 'unlocked'].includes(clean)) return 'approved';
        if (['pending', 'submitted', 'under review', 'in review', 'review'].includes(clean)) return 'pending';
        if (['rejected', 'declined', 'denied'].includes(clean)) return 'rejected';

        return 'not_applied';
    }

    function deriveAcademyAccess(profile = {}) {
        const divisions = profile.divisions && typeof profile.divisions === 'object'
            ? profile.divisions
            : {};

        const source =
            divisions.academy ||
            profile.academy ||
            profile.academyApplication ||
            {
                status: profile.academyApplicationStatus || profile.academyMembershipStatus,
                canEnter: profile.canEnterAcademy || profile.hasAcademyAccess || profile.hasRoadmapAccess
            };

        const status = normalizeStatus(
            source.status ||
            source.rawStatus ||
            source.applicationStatus ||
            source.membershipStatus ||
            ''
        );

        const canEnter =
            source.canEnter === true ||
            source.approved === true ||
            source.hasAccess === true ||
            status === 'approved';

        state.access.academy = {
            status: canEnter ? 'approved' : status,
            canEnter
        };
    }

    function showLoader(text = '') {
        const loader = $('#yhaeLoader');
        const loaderText = $('#yhaeLoaderText');

        academyEmbedLoaderStartedAt = Date.now();
        window.clearTimeout(academyEmbedForceHideTimer);

        if (loaderText) loaderText.textContent = text || 'Loading...';

        if (loader) {
            loader.classList.remove('is-hidden');

            academyEmbedForceHideTimer = window.setTimeout(() => {
                loader.classList.add('is-hidden');
            }, ACADEMY_EMBED_LOADER_MAX_MS);
        }
    }

    function hideLoader() {
        const loader = $('#yhaeLoader');
        if (!loader) return;

        const elapsed = Date.now() - academyEmbedLoaderStartedAt;
        const waitMs = Math.max(0, ACADEMY_EMBED_LOADER_MIN_MS - elapsed);

        window.clearTimeout(academyEmbedForceHideTimer);

        window.setTimeout(() => {
            loader.classList.add('is-hidden');
        }, waitMs);
    }

    function getFallbackRoadmapHome(message = '') {
        return {
            success: true,
            emptyRoadmap: true,
            roadmapPending: true,
            message: message || 'Roadmap setup is unlocked. Your first active roadmap is still being prepared.',
            progress: {
                completed: 0,
                total: 0,
                completionRate: 0
            },
            today: {
                missionsCompleted: 0,
                missionsTotal: 0,
                streakDays: 0
            },
            missions: [],
            allMissions: [],
            recentCheckins: [],
            transformationSystem: {
                currentStreak: 0,
                completedMissions: 0,
                totalMissions: 0
            }
        };
    }

    function getRoadmapIntakeStorageKey() {
        const profile = state.profile || {};
        const identity = cleanText(
            profile.email ||
            profile.uid ||
            profile.user_id ||
            profile.id ||
            'guest'
        ).toLowerCase();

        return `yhae_roadmap_intake_submitted_v1_${identity}`;
    }

    function readRoadmapIntakeSubmitted() {
        try {
            return localStorage.getItem(getRoadmapIntakeStorageKey()) === 'true';
        } catch (_) {
            return false;
        }
    }

    function markRoadmapIntakeSubmitted() {
        state.roadmapIntakeSubmitted = true;

        try {
            localStorage.setItem(getRoadmapIntakeStorageKey(), 'true');
        } catch (_) {}
    }

    function clearRoadmapIntakeSubmitted() {
        state.roadmapIntakeSubmitted = false;

        try {
            localStorage.removeItem(getRoadmapIntakeStorageKey());
        } catch (_) {}
    }

    function normalizeRoadmapStepItem(step = {}, index = 0) {
        return {
            id: cleanText(step.id || step.stepId || step.missionId || `roadmap-step-${index + 1}`),
            pillar: cleanText(step.pillar || step.category || step.type || 'roadmap'),
            title: cleanText(step.title || step.name, `Roadmap Step ${index + 1}`),
            description: cleanText(
                step.description ||
                step.summary ||
                step.action ||
                step.task ||
                step.doneLooksLike ||
                step.whyItMatters,
                'Complete this Roadmap step.'
            ),
            whyItMatters: cleanText(step.whyItMatters || step.reflectionPrompt || step.reason || ''),
            frequency: cleanText(step.frequency || step.cadence, 'daily'),
            dueDate: cleanText(step.dueDate || step.date || ''),
            estimatedMinutes: numberOr(step.estimatedMinutes || step.minutes || step.durationMinutes, 0),
            status: cleanText(step.status, 'pending'),
            sortOrder: numberOr(step.sortOrder || step.order, index + 1)
        };
    }

    function buildStepsFromRoadmapObject(roadmapNode = {}) {
        const steps = [];

        const directArrays = [
            roadmapNode.roadmapSteps,
            roadmapNode.steps,
            roadmapNode.missions,
            roadmapNode.days,
            roadmapNode.dailyPlan,
            roadmapNode.plan,
            roadmapNode.phases,
            roadmapNode.weeks
        ];

        directArrays.forEach((value) => {
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (item && typeof item === 'object') steps.push(item);
                });
            }
        });

        const days30 = roadmapNode.days30 && typeof roadmapNode.days30 === 'object'
            ? roadmapNode.days30
            : {};

        Object.entries(days30).forEach(([key, value], index) => {
            const weekNumber = index + 1;
            steps.push({
                id: `roadmap-${key}`,
                pillar: 'roadmap',
                title: `Week ${weekNumber}: ${cleanText(value, `Roadmap Week ${weekNumber}`)}`,
                description: cleanText(value, `Complete Week ${weekNumber} of your Roadmap.`),
                whyItMatters: 'This keeps your Roadmap moving through a clear weekly execution direction.',
                frequency: 'weekly',
                sortOrder: weekNumber
            });
        });

        return steps;
    }

    function extractRoadmapRawSteps(plan = {}) {
        const roadmapNode = readObject(plan, ['roadmap']);

        const directSteps = [
            ...readArray(plan, ['roadmapSteps']),
            ...readArray(plan, ['steps']),
            ...readArray(plan, ['missions']),
            ...readArray(plan, ['days']),
            ...readArray(plan, ['weeks']),
            ...readArray(plan, ['phases']),
            ...readArray(plan, ['dailyPlan']),
            ...buildStepsFromRoadmapObject(roadmapNode)
        ];

        const seen = new Set();

        return directSteps.filter((item, index) => {
            if (!item || typeof item !== 'object') return false;

            const key = cleanText(
                item.id ||
                item.stepId ||
                item.missionId ||
                item.title ||
                item.name ||
                `step-${index}`
            ).toLowerCase();

            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function buildClientRoadmapHomeFromPlan(plan = {}, source = {}) {
        const roadmapNode = readObject(plan, ['roadmap']);
        const summaryNode = readObject(plan, ['summary']);
        const rawSteps = extractRoadmapRawSteps(plan);

        const roadmapSteps = rawSteps.map((step, index) => normalizeRoadmapStepItem(step, index));

        return {
            success: true,
            roadmapId: cleanText(source.roadmapId || plan.roadmapId || ''),
            plannerRunId: cleanText(source.plannerRunId || plan.plannerRunId || ''),
            version: numberOr(source.version || plan.version, 1),
            readinessScore: numberOr(plan.readinessScore || roadmapNode.readinessScore, 0),
            focusAreas: readArray(plan, ['focusAreas']),
            summary: summaryNode,
            roadmap: {
                ...roadmapNode,
                title: cleanText(roadmapNode.title || roadmapNode.weeklyTheme || '28-Day Foundation Roadmap'),
                weeklyTheme: cleanText(roadmapNode.weeklyTheme || roadmapNode.title || 'Execution Foundation'),
                weeklyTargetOutcome: cleanText(
                    roadmapNode.weeklyTargetOutcome ||
                    roadmapNode.targetOutcome ||
                    summaryNode.mainOpportunity ||
                    'Build direction, discipline, and consistent execution.'
                )
            },
            progress: {
                completed: 0,
                total: roadmapSteps.length,
                completionRate: 0
            },
            today: {
                missionsCompleted: 0,
                missionsTotal: roadmapSteps.length,
                streakDays: 0
            },
            roadmapSteps,
            steps: roadmapSteps,
            missions: roadmapSteps,
            allMissions: roadmapSteps,
            recentCheckins: [],
            transformationSystem: {
                currentStreak: 0,
                completedMissions: 0,
                totalMissions: roadmapSteps.length
            },
            createdByModel: cleanText(source.createdByModel || plan.createdByModel || 'academy-roadmap-planner')
        };
    }

    function countRoadmapPayloadSteps(home = {}) {
        if (!home || typeof home !== 'object') return 0;

        const directArrays = [
            home.roadmapSteps,
            home.steps,
            home.todaySteps,
            home.missions,
            home.todayMissions,
            home.allMissions,
            home.generatedMissions
        ];

        const directCount = directArrays.reduce((sum, value) => {
            return sum + (Array.isArray(value) ? value.length : 0);
        }, 0);

        if (directCount > 0) return directCount;

        const roadmap = readObject(home, ['roadmap', 'activeRoadmap', 'generatedRoadmap']);
        return buildStepsFromRoadmapObject(roadmap).length;
    }

    function mergeRoadmapHomeWithPlan(home = {}, source = {}) {
        const plan = source?.plan && typeof source.plan === 'object'
            ? source.plan
            : source?.data?.plan && typeof source.data.plan === 'object'
                ? source.data.plan
                : null;

        if (!plan) return home;

        const planHome = buildClientRoadmapHomeFromPlan(plan, source.data || source);
        const homeStepCount = countRoadmapPayloadSteps(home);
        const planStepCount = countRoadmapPayloadSteps(planHome);

        if (homeStepCount > 0 || planStepCount <= 0) {
            return home;
        }

        return {
            ...home,
            ...planHome,
            success: home.success !== false,
            source: home.source || planHome.source || 'planner-plan-fallback',
            roadmap: {
                ...(planHome.roadmap || {}),
                ...(home.roadmap || {})
            },
            roadmapSteps: planHome.roadmapSteps || [],
            steps: planHome.steps || [],
            missions: planHome.missions || [],
            allMissions: planHome.allMissions || [],
            progress: planHome.progress || home.progress || {},
            today: planHome.today || home.today || {},
            transformationSystem: planHome.transformationSystem || home.transformationSystem || {},
            emptyRoadmap: false,
            roadmapPending: false
        };
    }

    function normalizeRoadmapHomePayload(payload = {}) {
        if (!payload || typeof payload !== 'object') return {};

        if (payload.home && typeof payload.home === 'object') {
            return mergeRoadmapHomeWithPlan(payload.home, payload);
        }

        if (payload.roadmapHome && typeof payload.roadmapHome === 'object') {
            return mergeRoadmapHomeWithPlan(payload.roadmapHome, payload);
        }

        if (payload.data && typeof payload.data === 'object') {
            if (payload.data.home && typeof payload.data.home === 'object') {
                return mergeRoadmapHomeWithPlan(payload.data.home, payload.data);
            }

            if (payload.data.roadmapHome && typeof payload.data.roadmapHome === 'object') {
                return mergeRoadmapHomeWithPlan(payload.data.roadmapHome, payload.data);
            }

            if (payload.data.plan && typeof payload.data.plan === 'object') {
                return buildClientRoadmapHomeFromPlan(payload.data.plan, payload.data);
            }

            if (payload.data.roadmap || payload.data.activeRoadmap || payload.data.generatedRoadmap) {
                return mergeRoadmapHomeWithPlan(payload.data, payload.data);
            }
        }

        if (payload.plan && typeof payload.plan === 'object') {
            return buildClientRoadmapHomeFromPlan(payload.plan, payload);
        }

        return payload;
    }

    function getRoadmapObject(home = {}) {
        const normalizedHome = normalizeRoadmapHomePayload(home);
        return readObject(normalizedHome, ['roadmap', 'activeRoadmap', 'generatedRoadmap']);
    }

    function getRoadmapStepList(home = {}) {
        const normalizedHome = normalizeRoadmapHomePayload(home);
        const direct = readArray(normalizedHome, ['roadmapSteps', 'steps', 'todaySteps', 'missions', 'todayMissions', 'allMissions', 'generatedMissions']);

        if (direct.length) return direct;

        const roadmap = getRoadmapObject(normalizedHome);
        return buildStepsFromRoadmapObject(roadmap).map((step, index) => normalizeRoadmapStepItem(step, index));
    }

    function hasUsableRoadmap(home = {}) {
        const normalizedHome = normalizeRoadmapHomePayload(home);
        const roadmap = getRoadmapObject(normalizedHome);
        const steps = getRoadmapStepList(normalizedHome);

        const hasRoadmapShape = Boolean(
            normalizedHome.roadmapId ||
            normalizedHome.plannerRunId ||
            roadmap.id ||
            roadmap.roadmapId ||
            roadmap.title ||
            roadmap.weeklyTheme ||
            roadmap.targetOutcome ||
            roadmap.weeklyTargetOutcome ||
            roadmap.summary ||
            Array.isArray(roadmap.weeks) && roadmap.weeks.length ||
            Array.isArray(roadmap.days) && roadmap.days.length ||
            Array.isArray(roadmap.steps) && roadmap.steps.length ||
            steps.length
        );

        if (hasRoadmapShape) return true;

        if (normalizedHome.emptyRoadmap === true || normalizedHome.roadmapPending === true) {
            return false;
        }

        return false;
    }

    function isRoadmapGenerationPending(home = {}) {
        const normalizedHome = normalizeRoadmapHomePayload(home);
        const roadmapApplication = readObject(normalizedHome, ['roadmapApplication', 'application']);
        const status = normalizeStatus(
            normalizedHome.roadmapApplicationStatus ||
            normalizedHome.generationStatus ||
            roadmapApplication.status ||
            ''
        );

        return Boolean(
            !hasUsableRoadmap(normalizedHome) &&
            (
                state.roadmapIntakeSubmitted ||
                readRoadmapIntakeSubmitted() ||
                status === 'pending' ||
                normalizedHome.roadmapPending === true
            )
        );
    }

    function shouldShowRoadmapIntake(home = {}) {
        const normalizedHome = normalizeRoadmapHomePayload(home);

        if (hasUsableRoadmap(normalizedHome)) return false;
        if (state.roadmapIntakeSubmitted || readRoadmapIntakeSubmitted()) return false;

        return true;
    }

    async function loadRoadmapData() {
        showLoader('Loading Roadmap data...');

        try {
            const homeResponse = await fetchJson('/api/academy/home');
            state.roadmapHome = normalizeRoadmapHomePayload(homeResponse);
        } catch (error) {
            if (isAuthExpiredError(error)) {
                renderAuthExpired();
                return;
            }

            const message = cleanText(error?.message);
            const noActiveRoadmap =
                /no active academy roadmap yet/i.test(message) ||
                /no active roadmap/i.test(message) ||
                error?.status === 404;

            if (noActiveRoadmap) {
                state.roadmapHome = getFallbackRoadmapHome();
            } else {
                throw error;
            }
        }

        if (hasUsableRoadmap(state.roadmapHome)) {
            renderRoadmap();
            return;
        }

        if (shouldShowRoadmapIntake(state.roadmapHome)) {
            renderRoadmapIntake();
            return;
        }

        if (isRoadmapGenerationPending(state.roadmapHome)) {
            renderRoadmapGenerationPending(state.roadmapHome);
            return;
        }

        renderRoadmapIntake();
    }

    async function loadMissionsData() {
        showLoader('Loading Missions data...');

        const [missionsResult, playbooksResult] = await Promise.allSettled([
            fetchJson('/api/academy/missions?scope=all'),
            fetchJson('/api/academy/mission-playbooks')
        ]);

        state.missionsPayload = missionsResult.status === 'fulfilled'
            ? missionsResult.value
            : {
                success: false,
                message: cleanText(missionsResult.reason?.message, 'Missions could not be loaded.'),
                missions: []
            };

        state.playbooksPayload = playbooksResult.status === 'fulfilled'
            ? playbooksResult.value
            : {
                success: false,
                playbooks: [],
                missionPlaybooks: [],
                message: cleanText(playbooksResult.reason?.message, 'Mission Playbooks could not be loaded.')
            };

        renderMissions();
    }

    async function syncProfile() {
        showLoader('Checking Academy access...');

        const payload = await fetchJson('/api/universe/profile');
        const profile = payload.profile || payload.user || payload || {};

        state.profile = profile;
        deriveAcademyAccess(profile);
    }

    function renderLocked(status = 'not_applied') {
        const stage = $('#yhaeStage');
        if (!stage) return;

        const copy = status === 'pending'
            ? ['Academy Pending', 'Your Academy application is still under admin review.']
            : status === 'rejected'
                ? ['Academy Rejected', 'Your Academy application was not approved. Please return to the Dashboard application flow.']
                : ['Academy Access Required', 'Apply for Academy access from the Dashboard before opening this section.'];

        stage.innerHTML = `
            <section class="yhae-panel yhae-locked">
                <div class="yhae-kicker">Academy Access</div>
                <h1>${escapeHtml(copy[0])}</h1>
                <p>${escapeHtml(copy[1])}</p>
            </section>
        `;
    }

    function renderFallbackSection() {
        const stage = $('#yhaeStage');
        if (!stage) return;

        const section = SECTION_COPY[state.section] || SECTION_COPY.roadmap;

        stage.innerHTML = `
            <section class="yhae-hero">
                <div>
                    <div class="yhae-kicker">${escapeHtml(section.kicker)}</div>
                    <h1>${escapeHtml(section.title)}</h1>
                    <h2>${escapeHtml(section.subtitle)}</h2>
                    <p>${escapeHtml(section.description)}</p>
                </div>

                <aside>
                    <img src="/images/logo.avif" alt="" />
                    <strong>Coming Next</strong>
                    <span>This section will be connected after Roadmap and Missions.</span>
                </aside>
            </section>

            <section class="yhae-panel">
                <div class="yhae-kicker">Migration Status</div>
                <h2>${escapeHtml(section.title)} is ready for the next V3 migration pass.</h2>
                <p>Roadmap and Missions are being connected first because they carry the main execution logic. This page is already isolated from the old Academy shell.</p>
            </section>
        `;
    }

    function renderMetricCard(label = '', value = '', detail = '') {
        return `
            <article class="yhae-metric-card">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
                ${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
            </article>
        `;
    }

    const CORE_MISSION_PLAYBOOKS = [
        {
            key: 'three_handshakes_away',
            title: '3-Handshakes-Away Mission',
            typeLabel: 'Relationship Path Mission',
            difficulty: 'Beginner Friendly',
            summary: 'Reach valuable people online through connection chains, mutual links, replies, contacts, and directions.',
            description: 'This mission teaches users how to reach valuable people without cold starting from zero. The user maps a target person, finds who is connected to that person, then uses warm or semi-warm relationship paths to create a realistic introduction.',
            objective: 'Find a realistic path to a valuable contact through second-degree or third-degree relationships.',
            tools: [
                'Instagram',
                'Twitter/X',
                'Public social profile',
                'Google Sheet or Excel CRM',
                'Screenshots',
                'Optional AI rewriting'
            ],
            trackingFields: [
                'Target name',
                'Target profile URL',
                'Prospect name',
                'Prospect profile URL',
                'Platform',
                'Connection level',
                'Message sent',
                'Reply status',
                'Contact collected',
                'Proof URL',
                'Notes'
            ],
            proofRequired: [
                'Target profile',
                'Prospect profile',
                'Connection level',
                'Message sent',
                'Reply status',
                'Screenshot proof',
                'CRM row proof'
            ],
            rewards: [
                '$9 Level 1',
                '$6 Level 2',
                '$3 Level 3',
                '$28.12 monthly bonus after 28 qualified actions'
            ],
            actionLabel: 'Open Relationship Path Guide'
        },
        {
            key: 'cold_calling',
            title: 'Cold-Calling Mission',
            typeLabel: 'Direct Outreach Mission',
            difficulty: 'Direct Execution',
            summary: 'Call companies, collect direct contacts, build rapport, and warm leads for future Federation access.',
            description: 'This mission is for users who can take direct action. The user finds companies, calls or contacts them, collects decision-maker information, records the result, and prepares the lead for future Federation or deal-room opportunities.',
            objective: 'Build a verified lead pipeline through direct company outreach, calls, follow-ups, and CRM proof.',
            tools: [
                'Phone number',
                'Google Maps',
                'Google Search',
                'Company websites',
                'Optional AI writing assistant',
                'Google Sheet or Excel CRM',
                'WhatsApp',
                'Optional Loom',
                'Optional virtual number app'
            ],
            trackingFields: [
                'Company name',
                'Industry',
                'City',
                'Country',
                'Contact name',
                'Contact role',
                'Lead tier',
                'Contact method',
                'Call result',
                'Follow-up status',
                'Proof URL',
                'Notes'
            ],
            proofRequired: [
                'Company name',
                'Lead name',
                'Lead role',
                'Lead tier',
                'Contact method',
                'Call result',
                'Follow-up status',
                'CRM row proof'
            ],
            rewards: [
                '$9 Tier 1',
                '$6 Tier 2',
                '$3 Tier 3',
                '$28.12 monthly bonus after 28 qualified actions'
            ],
            actionLabel: 'Open Cold-Calling Guide'
        },
        {
            key: 'expansion',
            title: 'Expansion Mission',
            typeLabel: 'Growth Mission',
            difficulty: 'Performance Based',
            summary: 'Performance-based Clippers program: clip Young Hustlers content, submit video links after view thresholds, and get paid when admin approves proof.',
            description: 'This mission is for expanding content and distribution. The user creates clips, posts on approved channels, tracks performance, submits analytics proof, and becomes eligible for payout when the proof passes review.',
            objective: 'Turn Young Hustlers content into measurable distribution output with proof, analytics, and admin approval.',
            tools: [
                'Editing app',
                'Approved Young Hustlers clipping account',
                'TikTok / Reels / Shorts / X',
                'CRM submission link',
                'Analytics screenshots',
                'Telegram Gateway or Universe support group'
            ],
            trackingFields: [
                'Applicant name',
                'Age',
                'Location',
                'Editing experience',
                'Sample links',
                'Device setup',
                'Weekly availability',
                'Approved account handle',
                'Platform',
                'Video URL',
                'View count',
                'Analytics proof URL',
                'Admin approval status',
                'Payout eligibility notes'
            ],
            proofRequired: [
                'Posted video link',
                'Platform handle',
                'View count',
                'Analytics screenshot',
                'Admin approval status',
                'Payout eligibility notes'
            ],
            rewards: [
                'View-based payout',
                'Threshold controlled by admin',
                'Proof required before eligibility',
                'Payout released after approval'
            ],
            actionLabel: 'Open Expansion Guide'
        }
    ];

    const MISSION_KEY_ALIASES = {
        social_outreach: 'three_handshakes_away',
        social_outreach_mission: 'three_handshakes_away',
        three_handshakes: 'three_handshakes_away',
        three_handshakes_away: 'three_handshakes_away',
        three_handshakes_away_mission: 'three_handshakes_away',
        '3_handshakes_away': 'three_handshakes_away',
        '3_handshakes_away_mission': 'three_handshakes_away',

        company_outreach: 'cold_calling',
        company_outreach_mission: 'cold_calling',
        cold_calling: 'cold_calling',
        cold_calling_mission: 'cold_calling',

        content_clipping: 'expansion',
        content_clipping_mission: 'expansion',
        expansion: 'expansion',
        expansion_mission: 'expansion'
    };

    function normalizeMissionKey(value = '') {
        const raw = cleanText(value).toLowerCase();
        return raw
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function getMissionKey(value = '') {
        const key = normalizeMissionKey(value);
        return MISSION_KEY_ALIASES[key] || key;
    }

    function getCoreMissionByKey(value = '') {
        const key = getMissionKey(value);
        return CORE_MISSION_PLAYBOOKS.find((mission) => mission.key === key) || null;
    }

    function renderInlineList(items = []) {
        const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

        if (!safeItems.length) {
            return '<p class="yhae-muted-copy">No details available yet.</p>';
        }

        return `
            <ul class="yhae-detail-list">
                ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
        `;
    }

    function normalizeMissionPlaybooks(rawPlaybooks = []) {
        const byKey = new Map(
            CORE_MISSION_PLAYBOOKS.map((mission) => [mission.key, { ...mission }])
        );

        (Array.isArray(rawPlaybooks) ? rawPlaybooks : []).forEach((playbook) => {
            const sourceKey = getMissionKey(
                playbook.key ||
                playbook.slug ||
                playbook.category ||
                playbook.type ||
                playbook.missionType ||
                playbook.title ||
                playbook.name
            );

            if (!byKey.has(sourceKey)) return;

            const current = byKey.get(sourceKey);

            byKey.set(sourceKey, {
                ...current,
                raw: playbook,
                title: current.title,
                typeLabel: current.typeLabel,
                summary: cleanText(playbook.summary || playbook.shortDescription, current.summary),
                description: cleanText(playbook.description || playbook.summary || playbook.shortDescription, current.description),
                objective: cleanText(playbook.objective || playbook.goal, current.objective),
                tools: Array.isArray(playbook.tools) && playbook.tools.length ? playbook.tools : current.tools,
                trackingFields: Array.isArray(playbook.trackingFields) && playbook.trackingFields.length ? playbook.trackingFields : current.trackingFields,
                proofRequired: Array.isArray(playbook.proofRequired) && playbook.proofRequired.length ? playbook.proofRequired : current.proofRequired
            });
        });

        return CORE_MISSION_PLAYBOOKS.map((mission) => byKey.get(mission.key));
    }


    function renderMissionCard(mission = {}, options = {}) {
        const id = cleanText(mission.id || mission.missionId);
        const sourceTitle = mission.title || mission.name || mission.category || mission.type;
        const title = getAcademyMissionDisplayName(sourceTitle, 'Academy Mission');
        const description = cleanText(
            mission.description || mission.doneLooksLike || mission.whyItMatters,
            'No mission description yet.'
        );
        const status = cleanText(mission.status, 'pending').toLowerCase();
        const typeLabel = getAcademyMissionDisplayName(
            mission.category || mission.type || mission.pillar,
            'Academy Mission'
        );
        const estimatedMinutes = numberOr(mission.estimatedMinutes || mission.minutes, 0);
        const dueDate = cleanText(mission.dueDate || mission.date);
        const completed = status === 'completed' || status === 'done';

        return `
            <article class="yhae-real-card" data-mission-status="${escapeHtml(status)}">
                <div class="yhae-real-card-head">
                    <span>${escapeHtml(typeLabel)}</span>
                    <em>${escapeHtml(getMissionStatusLabel(status))}</em>
                </div>

                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>

                <div class="yhae-card-meta">
                    ${estimatedMinutes ? `<span>${estimatedMinutes} min</span>` : ''}
                    ${dueDate ? `<span>Due ${escapeHtml(dueDate)}</span>` : ''}
                </div>

                ${options.allowComplete && id && !completed ? `
                    <button type="button" class="yhae-inline-action" data-yhae-complete-mission="${escapeHtml(id)}">
                        Mark Complete
                    </button>
                ` : ''}
            </article>
        `;
    }

    function renderMissionPlaybookCard(playbook = {}) {
        const selected = state.selectedMissionPlaybook === playbook.key;

        return `
            <article class="yhae-playbook-card ${selected ? 'is-selected' : ''}">
                <span>${escapeHtml(playbook.typeLabel || 'Mission Playbook')}</span>
                <strong>${escapeHtml(playbook.title || 'Academy Mission')}</strong>
                <p>${escapeHtml(playbook.description || 'Execution guide for Academy missions.')}</p>

                <div class="yhae-playbook-actions">
                    <button type="button" class="yhae-inline-action" data-yhae-open-playbook="${escapeHtml(playbook.key)}">
                        ${selected ? 'Hide Guide' : 'View Mission Guide'}
                    </button>
                </div>

                ${selected ? `
                    <div class="yhae-playbook-detail">
                        <div class="yhae-kicker">Mission Objective</div>
                        <p>${escapeHtml(playbook.objective || 'Follow the mission guide and submit proof when the full workspace is connected.')}</p>
                        <small>Full mission workspace actions will be connected in the next pass.</small>
                    </div>
                ` : ''}
            </article>
        `;
    }

    function renderRoadmapGenerationPending(home = {}) {
        const stage = $('#yhaeStage');
        if (!stage) return;

        const message = cleanText(
            home.message ||
            home.statusMessage ||
            'Your personalized Roadmap is being prepared from your setup answers. This can take a moment.'
        ).replace(/\bGemini\b/gi, 'the Academy planner');

        stage.innerHTML = `
            <section class="yhae-hero yhae-roadmap-ai-pending">
                <div>
                    <div class="yhae-kicker">Roadmap Builder</div>
                    <h1>Your Roadmap is being built</h1>
                    <h2>Your setup has been submitted.</h2>
                    <p>${escapeHtml(message)}</p>
                </div>

                <aside>
                    <img src="/images/logo.avif" alt="" />
                    <strong>Generating</strong>
                    <span>Attempt ${Number(state.roadmapGenerationAttempts || 0)}</span>
                </aside>
            </section>

            <section class="yhae-panel yhae-ai-status-panel">
                <div class="yhae-kicker">Roadmap Generation Status</div>
                <h2>Personalized Roadmap in progress</h2>
                <p>The Academy planner is transforming your answers into a 28-day execution path. Keep this page open, or refresh status after a few seconds.</p>

                <div class="yhae-form-actions">
                    <button type="button" class="yhae-small-btn" data-yhae-refresh-roadmap-generation>Refresh Status</button>
                    <button type="button" class="yhae-small-btn yhae-ghost-action" data-yhae-reset-roadmap-intake>Restart Form</button>
                </div>
            </section>
        `;

        bindActions();
    }

    function wait(ms = 1000) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function pollRoadmapGeneration(maxAttempts = 10, delayMs = 2500) {
        if (state.roadmapGenerationPolling) return false;

        state.roadmapGenerationPolling = true;

        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                state.roadmapGenerationAttempts = attempt;
                showLoader(`Checking Roadmap generation... ${attempt}/${maxAttempts}`);

                await wait(delayMs);

                try {
                    const homeResponse = await fetchJson('/api/academy/home');
                    const home = normalizeRoadmapHomePayload(homeResponse);
                    state.roadmapHome = home;

                    if (hasUsableRoadmap(home)) {
                        renderRoadmap();
                        clearRoadmapIntakeSubmitted();
                        return true;
                    }

                    renderRoadmapGenerationPending(home);
                } catch (_) {
                    renderRoadmapGenerationPending(
                        normalizeRoadmapHomePayload(state.roadmapHome) ||
                        getFallbackRoadmapHome('Still waiting for Roadmap generation status.')
                    );
                }
            }

            renderRoadmapGenerationPending(
                normalizeRoadmapHomePayload(state.roadmapHome) ||
                getFallbackRoadmapHome('Your Roadmap is still being prepared. Please refresh status shortly.')
            );
            return false;
        } finally {
            state.roadmapGenerationPolling = false;
            hideLoader();
        }
    }

    function renderRoadmapIntake() {
        const stage = $('#yhaeStage');
        if (!stage) return;

        stage.innerHTML = `
            <section class="yhae-hero yhae-roadmap-intake-hero">
                <div>
                    <div class="yhae-kicker">Roadmap Creation</div>
                    <h1>Create Your Roadmap</h1>
                    <h2>Build a personalized 28-day execution path.</h2>
                    <p>Answer these setup questions so YH Academy can shape your Roadmap around your current level, focus, time, blockers, and target outcome.</p>
                </div>

                <aside>
                    <img src="/images/logo.avif" alt="" />
                    <strong>One-Time Setup</strong>
                    <span>After this, your Roadmap workspace becomes personalized.</span>
                </aside>
            </section>

            <form class="yhae-roadmap-form" id="yhaeRoadmapIntakeForm">
                <section class="yhae-panel">
                    <div class="yhae-section-head">
                        <div>
                            <div class="yhae-kicker">Step 1</div>
                            <h2>Focus and Target</h2>
                        </div>
                    </div>

                    <div class="yhae-form-grid">
                        <label>
                            <span>Main focus area</span>
                            <select id="roadmap-focus-area" required>
                                <option value="">Select your focus</option>
                                <option value="self_mastery">Self Mastery</option>
                                <option value="business">Business / Money</option>
                                <option value="content">Content / Influence</option>
                                <option value="skill">Skill Building</option>
                                <option value="career">Career / Work</option>
                                <option value="fitness">Fitness / Discipline</option>
                            </select>
                        </label>

                        <label>
                            <span>Current level</span>
                            <select id="roadmap-current-level" required>
                                <option value="">Select your level</option>
                                <option value="beginner">Beginner — I need structure</option>
                                <option value="intermediate">Intermediate — I need consistency</option>
                                <option value="advanced">Advanced — I need execution pressure</option>
                            </select>
                        </label>

                        <label class="yhae-form-wide">
                            <span>What do you want to achieve in 30 days?</span>
                            <textarea id="roadmap-target-30" rows="3" required placeholder="Example: build discipline, launch an offer, finish a project, become consistent..."></textarea>
                        </label>
                    </div>
                </section>

                <section class="yhae-panel">
                    <div class="yhae-kicker">Step 2</div>
                    <h2>Time, Energy, and Blockers</h2>

                    <div class="yhae-form-grid">
                        <label>
                            <span>Daily available time</span>
                            <select id="roadmap-daily-hours" required>
                                <option value="">Select time</option>
                                <option value="30 minutes">30 minutes</option>
                                <option value="1 hour">1 hour</option>
                                <option value="2 hours">2 hours</option>
                                <option value="3+ hours">3+ hours</option>
                            </select>
                        </label>

                        <label>
                            <span>Weekly available time</span>
                            <select id="roadmap-weekly-hours">
                                <option value="">Select weekly time</option>
                                <option value="3-5 hours">3–5 hours</option>
                                <option value="6-10 hours">6–10 hours</option>
                                <option value="11-20 hours">11–20 hours</option>
                                <option value="20+ hours">20+ hours</option>
                            </select>
                        </label>

                        <label>
                            <span>Average sleep</span>
                            <select id="roadmap-sleep-hours">
                                <option value="">Select sleep</option>
                                <option value="less than 5 hours">Less than 5 hours</option>
                                <option value="5-6 hours">5–6 hours</option>
                                <option value="7-8 hours">7–8 hours</option>
                                <option value="8+ hours">8+ hours</option>
                            </select>
                        </label>

                        <label>
                            <span>Energy level</span>
                            <select id="roadmap-energy-level">
                                <option value="">Select energy</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>

                        <label>
                            <span>Stress level</span>
                            <select id="roadmap-stress-level">
                                <option value="">Select stress</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>

                        <label>
                            <span>Coach tone</span>
                            <select id="roadmap-coach-tone">
                                <option value="balanced">Balanced</option>
                                <option value="strict">Strict</option>
                                <option value="supportive">Supportive</option>
                                <option value="direct">Direct</option>
                            </select>
                        </label>

                        <label class="yhae-form-wide">
                            <span>Biggest blocker right now</span>
                            <textarea id="roadmap-blocker-text" rows="3" required placeholder="Example: procrastination, no direction, lack of discipline, too many ideas..."></textarea>
                        </label>

                        <label>
                            <span>Bad habit to reduce</span>
                            <input id="roadmap-bad-habit" type="text" placeholder="Example: scrolling, sleeping late..." />
                        </label>

                        <label>
                            <span>First quick win</span>
                            <input id="roadmap-first-win" type="text" placeholder="Example: finish first task today..." />
                        </label>
                    </div>
                </section>

                <section class="yhae-panel yhae-roadmap-submit-panel">
                    <div>
                        <div class="yhae-kicker">Final Step</div>
                        <h2>Generate your personalized Roadmap</h2>
                        <p>This will submit your setup profile and create your Roadmap access state using the existing Academy backend flow.</p>
                    </div>

                    <div class="yhae-form-actions">
                        <button type="button" class="yhae-small-btn" data-yhae-refresh-roadmap>Refresh Status</button>
                        <button type="submit" class="yhae-primary-action" id="btn-submit-roadmap-intake">Build My Roadmap ➔</button>
                    </div>
                </section>
            </form>
        `;

        bindActions();
    }

    function collectRoadmapIntakePayload() {
        const focusAreaKey = cleanText($('#roadmap-focus-area')?.value);
        const focusLabels = {
            self_mastery: 'Self Mastery',
            business: 'Business / Money',
            content: 'Content / Influence',
            skill: 'Skill Building',
            career: 'Career / Work',
            fitness: 'Fitness / Discipline'
        };

        return {
            focusArea: focusLabels[focusAreaKey] || focusAreaKey,
            focusAreaKey,
            schemaKey: 'dashboard_v3_roadmap_intake',
            intakeVersion: 'dashboard-v3-roadmap-intake-v1',
            currentLevel: cleanText($('#roadmap-current-level')?.value),
            target30Days: cleanText($('#roadmap-target-30')?.value),
            dailyHours: cleanText($('#roadmap-daily-hours')?.value),
            weeklyHours: cleanText($('#roadmap-weekly-hours')?.value),
            sleepHours: cleanText($('#roadmap-sleep-hours')?.value),
            energyLevel: cleanText($('#roadmap-energy-level')?.value),
            stressLevel: cleanText($('#roadmap-stress-level')?.value),
            badHabit: cleanText($('#roadmap-bad-habit')?.value),
            blockerText: cleanText($('#roadmap-blocker-text')?.value),
            coachTone: cleanText($('#roadmap-coach-tone')?.value, 'balanced'),
            firstQuickWin: cleanText($('#roadmap-first-win')?.value),
            scopeAnswers: [],
            submittedAt: new Date().toISOString()
        };
    }

    async function submitRoadmapIntake(event) {
        event?.preventDefault?.();

        if (state.roadmapFormBusy) return;

        const payload = collectRoadmapIntakePayload();

        if (!payload.focusAreaKey || !payload.currentLevel || !payload.target30Days || !payload.dailyHours || !payload.blockerText) {
            renderError('Please complete the required Roadmap setup fields.');
            window.setTimeout(() => renderRoadmapIntake(), 1600);
            return;
        }

        const submitBtn = $('#btn-submit-roadmap-intake');
        state.roadmapFormBusy = true;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Roadmap...';
        }

        showLoader('Sending answers to Roadmap Builder...');

        try {
            const result = await fetchJson('/api/academy/roadmap-apply', {
                method: 'POST',
                body: JSON.stringify({
                    ...payload,
                    source: 'dashboard-v3-academy-embed',
                    requestedGenerator: 'academy-roadmap-planner'
                })
            });

            state.lastRoadmapSubmissionResponse = result;
            markRoadmapIntakeSubmitted();

            const submittedHome = normalizeRoadmapHomePayload(result);

            if (hasUsableRoadmap(submittedHome)) {
                state.roadmapHome = submittedHome;
                renderRoadmap();
                clearRoadmapIntakeSubmitted();
                return;
            }

            if (result?.alreadyExists === true) {
                try {
                    showLoader('Rebuilding existing Roadmap workspace...');
                    const refreshed = await fetchJson('/api/academy/roadmap/refresh', {
                        method: 'POST',
                        body: JSON.stringify({
                            source: 'dashboard-v3-existing-roadmap-rebuild'
                        })
                    });

                    const refreshedHome = normalizeRoadmapHomePayload(refreshed);

                    if (hasUsableRoadmap(refreshedHome)) {
                        state.roadmapHome = refreshedHome;
                        renderRoadmap();
                        clearRoadmapIntakeSubmitted();
                        return;
                    }
                } catch (_) {}
            }

            state.roadmapHome = {
                ...getFallbackRoadmapHome('Your setup answers were submitted. Your personalized Roadmap is being prepared.'),
                ...submittedHome,
                roadmapPending: true
            };

            renderRoadmapGenerationPending(state.roadmapHome);
            await pollRoadmapGeneration(12, 2500);
        } catch (error) {
            if (isAuthExpiredError(error)) {
                renderAuthExpired();
            } else {
                renderError(error?.message || 'Failed to submit Roadmap setup.');
            }
        } finally {
            state.roadmapFormBusy = false;

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Build My Roadmap ➔';
            }

            hideLoader();
        }
    }

    function renderRoadmap() {
        const stage = $('#yhaeStage');
        if (!stage) return;

        const home = normalizeRoadmapHomePayload(state.roadmapHome) || getFallbackRoadmapHome();
        state.roadmapHome = home;
        const progress = readObject(home, ['progress']);
        const today = readObject(home, ['today']);
        const system = readObject(home, ['transformationSystem', 'system']);
        const roadmap = readObject(home, ['roadmap', 'activeRoadmap']);
        const summary = readObject(home, ['summary']);
        const allSteps = getRoadmapStepList(home);
        const missions = allSteps.slice(0, 4);
        const allMissions = allSteps;
        const recentCheckins = readArray(home, ['recentCheckins', 'checkins']).slice(0, 3);

        const completed = numberOr(progress.completed ?? system.completedMissions, 0);
        const total = numberOr(progress.total ?? system.totalMissions ?? allMissions.length, 0);
        const completionRate = percentOr(progress.completionRate ?? progress.percent ?? (total ? (completed / total) * 100 : 0), 0);
        const streakDays = numberOr(today.streakDays ?? system.currentStreak, 0);
        const todayDone = numberOr(today.missionsCompleted, 0);
        const todayTotal = numberOr(today.missionsTotal, missions.length || 0);

        const roadmapTitle = cleanText(
            roadmap.title ||
            roadmap.weeklyTheme ||
            summary.title ||
            '28-Day Foundation Roadmap'
        );

        const roadmapOutcome = cleanText(
            roadmap.weeklyTargetOutcome ||
            roadmap.targetOutcome ||
            summary.targetOutcome ||
            home.message ||
            'Build a simple execution rhythm and keep visible proof of work.'
        );

        stage.innerHTML = `
            <section class="yhae-hero yhae-real-hero">
                <div>
                    <div class="yhae-kicker">Academy Roadmap</div>
                    <h1>Roadmap</h1>
                    <h2>${escapeHtml(roadmapTitle)}</h2>
                    <p>${escapeHtml(roadmapOutcome)}</p>
                </div>

                <aside>
                    <img src="/images/logo.avif" alt="" />
                    <strong>${escapeHtml(home.emptyRoadmap ? 'Setup Pending' : 'Active Roadmap')}</strong>
                    <span>${escapeHtml(home.emptyRoadmap ? 'Your roadmap shell is ready.' : `${completionRate}% complete`)}</span>
                </aside>
            </section>

            ${home.emptyRoadmap || home.roadmapPending ? `
                <section class="yhae-panel yhae-warning-panel">
                    <div class="yhae-kicker">Roadmap Status</div>
                    <h2>Roadmap setup is unlocked.</h2>
                    <p>${escapeHtml(home.message || 'Your first active roadmap is still being prepared.')}</p>
                </section>
            ` : ''}

            <section class="yhae-metric-grid">
                ${renderMetricCard('Overall Progress', `${completionRate}%`, `${completed}/${total} roadmap steps completed`)}
                ${renderMetricCard('Today', `${todayDone}/${todayTotal}`, 'Roadmap steps completed today')}
                ${renderMetricCard('Streak', `${streakDays}`, 'Current execution streak')}
                ${renderMetricCard('Check-ins', `${recentCheckins.length}`, 'Recent accountability logs')}
            </section>

            <section class="yhae-panel">
                <div class="yhae-section-head">
                    <div>
                        <div class="yhae-kicker">Today’s Execution</div>
                        <h2>Roadmap Steps</h2>
                    </div>

                    <button type="button" class="yhae-small-btn" data-yhae-refresh-roadmap>Refresh</button>
                </div>

                ${missions.length ? `
                    <div class="yhae-real-grid">
                        ${missions.map((mission) => renderMissionCard(mission, { allowComplete: true })).join('')}
                    </div>
                ` : `
                    <div class="yhae-empty-state">
                        <strong>No Roadmap steps yet.</strong>
                        <p>Your Roadmap shell exists, but no personalized steps were returned yet. Rebuild the workspace to generate the execution steps.</p>
                        <div class="yhae-form-actions">
                            <button type="button" class="yhae-small-btn" data-yhae-rebuild-roadmap>Rebuild Roadmap</button>
                        </div>
                    </div>
                `}
            </section>

            <section class="yhae-panel">
                <div class="yhae-kicker">Recent Check-ins</div>
                <h2>Accountability Signals</h2>

                ${recentCheckins.length ? `
                    <div class="yhae-checkin-list">
                        ${recentCheckins.map((checkin) => `
                            <article>
                                <span>${escapeHtml(cleanText(checkin.checkinDate || checkin.createdAt, 'Recent Check-in'))}</span>
                                <strong>${escapeHtml(cleanText(checkin.completedSummary || checkin.reflectionText || 'Progress logged.'))}</strong>
                                <p>${escapeHtml(cleanText(checkin.tomorrowFocus || checkin.correctionForTomorrow || checkin.blockerText || 'No extra note.'))}</p>
                            </article>
                        `).join('')}
                    </div>
                ` : `
                    <div class="yhae-empty-state">
                        <strong>No check-ins yet.</strong>
                        <p>Once check-ins are submitted, they will show here as accountability history.</p>
                    </div>
                `}
            </section>
        `;

        bindActions();
    }

    function renderMissionPlaybookCard(playbook = {}) {
        const selected = state.selectedMissionPlaybook === playbook.key;

        return `
            <article class="yhae-playbook-card yhae-mission-track-card ${selected ? 'is-selected' : ''}">
                <div class="yhae-real-card-head">
                    <span>${escapeHtml(playbook.typeLabel || 'Mission Playbook')}</span>
                    <em>${escapeHtml(playbook.difficulty || 'Mission')}</em>
                </div>

                <strong>${escapeHtml(playbook.title || 'Academy Mission')}</strong>
                <p>${escapeHtml(playbook.summary || playbook.description || 'Execution guide for Academy missions.')}</p>

                <div class="yhae-playbook-actions">
                    <button type="button" class="yhae-inline-action" data-yhae-open-playbook="${escapeHtml(playbook.key)}">
                        ${selected ? 'Close Mission Details' : 'Open Mission Details'}
                    </button>
                </div>

                ${selected ? `
                    <div class="yhae-playbook-detail yhae-full-mission-detail">
                        <section>
                            <div class="yhae-kicker">Mission Objective</div>
                            <p>${escapeHtml(playbook.objective || 'Complete the mission requirements and submit proof when the workspace is connected.')}</p>
                        </section>

                        <section>
                            <div class="yhae-kicker">Full Mission Concept</div>
                            <p>${escapeHtml(playbook.description || playbook.summary || '')}</p>
                        </section>

                        <section>
                            <div class="yhae-kicker">Tools Needed</div>
                            ${renderInlineList(playbook.tools)}
                        </section>

                        <section>
                            <div class="yhae-kicker">Tracking Fields</div>
                            ${renderInlineList(playbook.trackingFields)}
                        </section>

                        <section>
                            <div class="yhae-kicker">Proof Required</div>
                            ${renderInlineList(playbook.proofRequired)}
                        </section>

                        <section>
                            <div class="yhae-kicker">Reward / Payout Logic</div>
                            ${renderInlineList(playbook.rewards)}
                        </section>
                    </div>
                ` : ''}
            </article>
        `;
    }

    function renderMissions() {
        const stage = $('#yhaeStage');
        if (!stage) return;

        const playbooksPayload = state.playbooksPayload || {};
        const rawPlaybooks = readArray(playbooksPayload, ['playbooks', 'missionPlaybooks', 'items', 'data']);
        const playbooks = normalizeMissionPlaybooks(rawPlaybooks);

        stage.innerHTML = `
            <section class="yhae-panel yhae-missions-only-panel">
                <div class="yhae-section-head yhae-missions-main-head">
                    <div>
                        <div class="yhae-kicker">Mission Playbooks</div>
                        <h2>Core Mission Tracks</h2>
                        <p>Choose one mission track to view the full guide, tools, proof requirements, tracking fields, and payout logic.</p>
                    </div>

                    <button type="button" class="yhae-small-btn" data-yhae-refresh-missions>Refresh</button>
                </div>

                <div class="yhae-playbook-grid yhae-core-mission-grid">
                    ${playbooks.map((playbook) => renderMissionPlaybookCard(playbook)).join('')}
                </div>
            </section>
        `;

        bindActions();
    }


    async function completeMission(missionId = '') {
        const cleanId = cleanText(missionId);
        if (!cleanId) return;

        showLoader('Updating mission...');

        try {
            await fetchJson(`/api/academy/missions/${encodeURIComponent(cleanId)}/complete`, {
                method: 'POST',
                body: JSON.stringify({
                    completionNote: 'Completed from Dashboard V3 Academy Embed.'
                })
            });

            if (state.section === 'missions') {
                await loadMissionsData();
            } else {
                await loadRoadmapData();
            }
        } catch (error) {
            renderError(error?.message || 'Mission update failed.');
        } finally {
            hideLoader();
        }
    }

    async function rebuildRoadmapWorkspace() {
        showLoader('Rebuilding Roadmap workspace...');

        try {
            const refreshed = await fetchJson('/api/academy/roadmap/refresh', {
                method: 'POST',
                body: JSON.stringify({
                    source: 'dashboard-v3-empty-roadmap-rebuild'
                })
            });

            state.roadmapHome = normalizeRoadmapHomePayload(refreshed);
            renderRoadmap();
            clearRoadmapIntakeSubmitted();
        } catch (error) {
            renderError(error?.message || 'Roadmap rebuild failed.');
        } finally {
            hideLoader();
        }
    }

    function bindActions() {
        const intakeForm = $('#yhaeRoadmapIntakeForm');
        if (intakeForm) {
            intakeForm.addEventListener('submit', submitRoadmapIntake);
        }
        $$('[data-yhae-login-again]').forEach((button) => {
            button.addEventListener('click', () => {
                clearStoredAuthTokens();

                try {
                    window.top.location.href = '/login';
                } catch (_) {
                    window.location.href = '/login';
                }
            });
        });
        $$('[data-yhae-refresh-roadmap], [data-yhae-refresh-roadmap-generation]').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await loadRoadmapData();
                } catch (error) {
                    renderError(error?.message || 'Roadmap refresh failed.');
                } finally {
                    hideLoader();
                }
            });
        });

        $$('[data-yhae-reset-roadmap-intake]').forEach((button) => {
            button.addEventListener('click', () => {
                clearRoadmapIntakeSubmitted();
                state.roadmapHome = getFallbackRoadmapHome();
                renderRoadmapIntake();
            });
        });

        $$('[data-yhae-rebuild-roadmap]').forEach((button) => {
            button.addEventListener('click', rebuildRoadmapWorkspace);
        });

        $$('[data-yhae-refresh-missions]').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await loadMissionsData();
                } catch (error) {
                    renderError(error?.message || 'Missions refresh failed.');
                } finally {
                    hideLoader();
                }
            });
        });

        $$('[data-yhae-open-playbook]').forEach((button) => {
            button.addEventListener('click', () => {
                const key = cleanText(button.getAttribute('data-yhae-open-playbook'));
                state.selectedMissionPlaybook = state.selectedMissionPlaybook === key ? null : key;
                renderMissions();
            });
        });

        $$('[data-yhae-complete-mission]').forEach((button) => {
            button.addEventListener('click', () => {
                completeMission(button.getAttribute('data-yhae-complete-mission'));
            });
        });
    }

    function renderError(message = '') {
        const stage = $('#yhaeStage');
        if (!stage) return;

        stage.innerHTML = `
            <section class="yhae-panel yhae-locked">
                <div class="yhae-kicker">Academy Embed Error</div>
                <h1>Unable to load section.</h1>
                <p>${escapeHtml(message || 'Something went wrong while loading this Academy section.')}</p>
            </section>
        `;
    }

    async function boot() {
        state.section = getSectionFromUrl();

        try {
            await syncProfile();

            if (!state.access.academy.canEnter) {
                renderLocked(state.access.academy.status);
                hideLoader();
                return;
            }

            if (state.section === 'roadmap') {
                await loadRoadmapData();
                hideLoader();
                return;
            }

            if (state.section === 'missions') {
                await loadMissionsData();
                hideLoader();
                return;
            }

            renderFallbackSection();
            hideLoader();
        } catch (error) {
            console.error('Academy embed boot failed:', error);

            if (isAuthExpiredError(error)) {
                renderAuthExpired();
            } else {
                renderError(error?.message || 'Academy section failed to load.');
            }

            hideLoader();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.YHAcademyEmbed = {
        state,
        renderRoadmap,
        renderRoadmapIntake,
        renderRoadmapGenerationPending,
        submitRoadmapIntake,
        pollRoadmapGeneration,
        renderMissions,
        loadRoadmapData,
        loadMissionsData,
        syncProfile
    };
})();