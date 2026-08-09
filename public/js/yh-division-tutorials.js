(function installYHDivisionTutorialsV1() {
    'use strict';

    if (window.__yhDivisionTutorialsV1Installed) return;
    window.__yhDivisionTutorialsV1Installed = true;

    const API_URL = '/api/universe/tutorials';
    const LOCAL_KEY_PREFIX = 'yh_division_tutorials_v1';
    const PARENT_MESSAGE_TYPE = 'yh:division-tutorial-entry-v1';

    const DIVISION_CONFIG = Object.freeze({
        academy: {
            version: 1,
            label: 'The Academy',
            shortLabel: 'Academy',
            defaultWorkspace: 'academy-roadmap',
            slides: [
                {
                    eyebrow: 'Build Your Direction',
                    title: 'Start with your Roadmap',
                    copy: 'Your Roadmap turns goals into a clear execution path. Use it to define your focus, understand your next move, and keep your Academy activity aligned.',
                    image: '/assets/academy/icons/academy-icon-roadmap.png',
                    features: ['Roadmap', 'AI guidance', 'Check-ins']
                },
                {
                    eyebrow: 'Execute and Progress',
                    title: 'Complete Missions that move you forward',
                    copy: 'Missions convert your plan into action. Complete assigned work, track progress, build proof, and improve the signals that unlock wider opportunities.',
                    image: '/assets/academy/icons/academy-icon-missions.png',
                    features: ['Missions', 'Progress', 'Rewards']
                },
                {
                    eyebrow: 'Find Your Community',
                    title: 'Join the right conversations',
                    copy: 'Use the Community Feed and Niches to find relevant people, share useful updates, and build a circle around the work and interests that matter to you.',
                    image: '/assets/academy/icons/academy-icon-community-feed-news.png',
                    features: ['Community Feed', 'Niches', 'Member profiles']
                },
                {
                    eyebrow: 'Connect and Participate',
                    title: 'Message members and enter live rooms',
                    copy: 'Continue relationships through direct messages and groups, then join Live Voice sessions when you want real-time collaboration, learning, or execution.',
                    image: '/assets/academy/icons/academy-icon-messages.png',
                    features: ['Messages', 'Groups', 'Live Voice']
                }
            ]
        },
        plazas: {
            version: 1,
            label: 'The Plazas',
            shortLabel: 'Plazas',
            defaultWorkspace: 'plazas-explorer',
            slides: [
                {
                    eyebrow: 'Explore the Movement Layer',
                    title: 'See what is happening across Plazas',
                    copy: 'Explorer and Feed surface active regions, member signals, projects, wins, and marketplace movement so you can quickly find where you fit.',
                    image: '/assets/academy/plaza%20icons/plaza%20atlas.png',
                    features: ['Explorer', 'Feed', 'World signals']
                },
                {
                    eyebrow: 'Discover Opportunities',
                    title: 'Turn demand into a clear next move',
                    copy: 'Use Opportunity Quests and the Directory to find work, services, collaborators, trusted operators, and structured paths for hiring or getting hired.',
                    image: '/assets/academy/plaza%20icons/opportunities.png',
                    features: ['Opportunities', 'Directory', 'Marketplace']
                },
                {
                    eyebrow: 'Build Real Connections',
                    title: 'Keep every conversation tied to context',
                    copy: 'Inbox, Conversations, Meetups, and Requests keep introductions and collaboration organized around the opportunity, region, or objective that started them.',
                    image: '/assets/academy/plaza%20icons/conversations.png',
                    features: ['Inbox', 'Conversations', 'Meetups']
                },
                {
                    eyebrow: 'Expand Your Reach',
                    title: 'Use Regions, Atlas, Patron, and Bridge',
                    copy: 'Move beyond one transaction by building regional visibility, supporting local coordination, applying for Patron leadership, and creating cross-division bridge paths.',
                    image: '/assets/academy/plaza%20icons/bridge.png',
                    features: ['Regions', 'Patron', 'Bridge']
                }
            ]
        },
        federation: {
            version: 1,
            label: 'The Federation',
            shortLabel: 'Federation',
            defaultWorkspace: 'federation-command',
            slides: [
                {
                    eyebrow: 'Strategic Position',
                    title: 'Read your Federation command layer',
                    copy: 'Command shows your access, readiness, influence, and current strategic position so you can choose the right lane before making a request.',
                    image: '/images/federation%20icon.png?v=20260626-footer-icons-clean-v3',
                    features: ['Command', 'Readiness', 'Influence']
                },
                {
                    eyebrow: 'Trusted Introductions',
                    title: 'Use Connect with a specific objective',
                    copy: 'Connect is for controlled, high-value introductions. State what you need, why the connection matters, and what responsible next step should follow.',
                    image: '/images/federation%20icon.png?v=20260626-footer-icons-clean-v3',
                    features: ['Connect', 'Verified introductions', 'Requests']
                },
                {
                    eyebrow: 'Protected Collaboration',
                    title: 'Enter Deal Rooms with clear intent',
                    copy: 'Deal Rooms organize serious collaborations, partnerships, and commercial discussions while preserving context, trust, and admin supervision where required.',
                    image: '/images/federation%20icon.png?v=20260626-footer-icons-clean-v3',
                    features: ['Deal Rooms', 'Partnerships', 'Confidentiality']
                },
                {
                    eyebrow: 'Operate Strategically',
                    title: 'Build long-term relationship capital',
                    copy: 'Use the Directory, Referrals, My Requests, and My Access to maintain trusted relationships, track outcomes, and contribute value to the network over time.',
                    image: '/images/federation%20icon.png?v=20260626-footer-icons-clean-v3',
                    features: ['Directory', 'Referrals', 'My Access']
                }
            ]
        }
    });

    let tutorialStatePromise = null;
    let tutorialStateCache = null;
    let activeDivision = '';
    let activeSlideIndex = 0;
    let entryTimer = null;
    let standaloneRetryCount = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    function normalizeDivision(value = '') {
        const clean = String(value || '').trim().toLowerCase();
        if (clean === 'plaza' || clean === 'plazas') return 'plazas';
        if (clean === 'academy' || clean === 'federation') return clean;
        return '';
    }

    function getStoredToken() {
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

    function decodeJwtPayload(token = '') {
        const parts = String(token || '').split('.');
        if (parts.length < 2) return {};

        try {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
            return JSON.parse(decodeURIComponent(
                Array.from(atob(padded))
                    .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
                    .join('')
            ));
        } catch (_) {
            return {};
        }
    }

    function getAccountScope() {
        const payload = decodeJwtPayload(getStoredToken());
        const candidates = [
            payload.uid,
            payload.firebaseUid,
            payload.user_id,
            payload.id,
            payload.sub,
            payload.email,
            localStorage.getItem('yh_user_email'),
            sessionStorage.getItem('yh_user_email'),
            localStorage.getItem('yh_user_username'),
            sessionStorage.getItem('yh_user_username')
        ];

        const resolved = candidates
            .map((value) => String(value || '').trim().toLowerCase())
            .find(Boolean) || 'current-user';

        return resolved.replace(/[^a-z0-9@._-]+/g, '_').slice(0, 160);
    }

    function getLocalKey() {
        return `${LOCAL_KEY_PREFIX}:${getAccountScope()}`;
    }

    function buildEmptyState() {
        return {
            academy: {
                completedVersion: 0,
                completedAt: '',
                completionMethod: '',
                approvalToken: ''
            },

            plazas: {
                completedVersion: 0,
                completedAt: '',
                completionMethod: '',
                approvalToken: ''
            },

            federation: {
                completedVersion: 0,
                completedAt: '',
                completionMethod: '',
                approvalToken: ''
            }
        };
    }

    function normalizeStateEntry(
        value = {}
    ) {
        const source =
            value &&
            typeof value === 'object'
                ? value
                : {};

        return {
            completedVersion:
                Math.max(
                    0,
                    Number.parseInt(
                        source
                            .completedVersion ||
                        source.version ||
                        0,
                        10
                    ) || 0
                ),

            completedAt:
                String(
                    source.completedAt || ''
                ).trim(),

            completionMethod:
                String(
                    source
                        .completionMethod ||
                    source.method ||
                    ''
                )
                    .trim()
                    .toLowerCase(),

            approvalToken:
                String(
                    source.approvalToken ||
                    source.approvalCycle ||
                    ''
                ).trim()
        };
    }

    function normalizeState(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const empty = buildEmptyState();

        Object.keys(DIVISION_CONFIG).forEach((division) => {
            empty[division] = normalizeStateEntry(source[division]);
        });

        return empty;
    }

    function readLocalRecord() {
        try {
            const parsed = JSON.parse(localStorage.getItem(getLocalKey()) || '{}');
            return {
                state: normalizeState(parsed?.state || parsed?.tutorials || parsed || {}),
                pending: parsed?.pending && typeof parsed.pending === 'object' ? parsed.pending : {}
            };
        } catch (_) {
            return { state: buildEmptyState(), pending: {} };
        }
    }

    function writeLocalRecord(state, pending = null) {
        const current = readLocalRecord();
        const nextPending = pending && typeof pending === 'object' ? pending : current.pending;

        try {
            localStorage.setItem(getLocalKey(), JSON.stringify({
                state: normalizeState(state),
                pending: nextPending,
                updatedAt: new Date().toISOString()
            }));
        } catch (_) {}
    }

    function mergeStateKeepingNewest(serverState = {}, localState = {}) {
        const server = normalizeState(serverState);
        const local = normalizeState(localState);
        const merged = buildEmptyState();

        Object.keys(DIVISION_CONFIG).forEach((division) => {
            merged[division] = local[division].completedVersion > server[division].completedVersion
                ? local[division]
                : server[division];
        });

        return merged;
    }

    async function tutorialFetch(url, options = {}) {
        const token = getStoredToken();
        const headers = {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };

        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.success === false) {
            const error = new Error(data?.message || `Tutorial request failed (${response.status}).`);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    async function loadTutorialState(force = false) {
        if (tutorialStateCache && !force) return tutorialStateCache;
        if (tutorialStatePromise && !force) return tutorialStatePromise;

        const localRecord = readLocalRecord();
        tutorialStateCache = normalizeState(localRecord.state);

        tutorialStatePromise =
            tutorialFetch(
                API_URL,
                {
                    method: 'GET'
                }
            )
                .then((result) => {
                    /*
                     * The authenticated server state is
                     * canonical. This intentionally replaces
                     * stale local completions created before
                     * approval validation existed.
                     */
                    tutorialStateCache =
                        normalizeState(
                            result?.tutorials ||
                            result?.state ||
                            {}
                        );

                    writeLocalRecord(
                        tutorialStateCache,
                        localRecord.pending
                    );

                    return tutorialStateCache;
                })
            .finally(() => {
                tutorialStatePromise = null;
            });

        return tutorialStatePromise;
    }

    function isDivisionCompleted(division = '', state = tutorialStateCache) {
        const cleanDivision = normalizeDivision(division);
        const config = DIVISION_CONFIG[cleanDivision];
        if (!config) return true;

        const normalized = normalizeState(state || {});
        return normalized[cleanDivision].completedVersion >= config.version;
    }

    function markDivisionCompletedLocally(division = '', method = 'finish') {
        const cleanDivision = normalizeDivision(division);
        const config = DIVISION_CONFIG[cleanDivision];
        if (!config) return;

        const record = readLocalRecord();
        const nextState = normalizeState(tutorialStateCache || record.state);
        const completedAt = new Date().toISOString();

        nextState[cleanDivision] = {
            completedVersion: config.version,
            completedAt,
            completionMethod: method
        };

        const nextPending = {
            ...record.pending,
            [cleanDivision]: {
                completedVersion: config.version,
                completionMethod: method,
                completedAt
            }
        };

        tutorialStateCache = nextState;
        writeLocalRecord(nextState, nextPending);
    }

    async function persistDivisionCompletion(
        division = '',
        method = 'finish'
    ) {
        const cleanDivision =
            normalizeDivision(
                division
            );

        const config =
            DIVISION_CONFIG[
                cleanDivision
            ];

        if (!config) {
            return null;
        }

        try {
            const result =
                await tutorialFetch(
                    `${API_URL}/${encodeURIComponent(cleanDivision)}`,
                    {
                        method: 'PATCH',

                        body:
                            JSON.stringify({
                                completedVersion:
                                    config.version,

                                completionMethod:
                                    method
                            })
                    }
                );

            const record =
                readLocalRecord();

            const nextPending = {
                ...record.pending
            };

            delete nextPending[
                cleanDivision
            ];

            tutorialStateCache =
                normalizeState(
                    result?.tutorials ||
                    result?.state ||
                    {}
                );

            writeLocalRecord(
                tutorialStateCache,
                nextPending
            );

            return result;
        } catch (error) {
            /*
             * When approval is missing or revoked,
             * remove the optimistic local completion.
             */
            if (
                Number(
                    error?.status || 0
                ) === 403
            ) {
                const record =
                    readLocalRecord();

                const nextState =
                    normalizeState(
                        record.state
                    );

                const nextPending = {
                    ...record.pending
                };

                nextState[
                    cleanDivision
                ] =
                    normalizeStateEntry(
                        {}
                    );

                delete nextPending[
                    cleanDivision
                ];

                tutorialStateCache =
                    nextState;

                writeLocalRecord(
                    nextState,
                    nextPending
                );
            }

            throw error;
        }
    }

    function retryPendingCompletions() {
        const record = readLocalRecord();

        Object.entries(record.pending || {}).forEach(([division, pending]) => {
            const cleanDivision = normalizeDivision(division);
            if (!cleanDivision || !pending) return;

            persistDivisionCompletion(
                cleanDivision,
                String(pending.completionMethod || 'finish')
            ).catch(() => {});
        });
    }

    function ensureOverlay() {
        let overlay = document.getElementById('yh-division-tutorial-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'yh-division-tutorial-overlay';
        overlay.className = 'yh-division-tutorial-overlay';
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');

        overlay.innerHTML = `
            <div class="yh-division-tutorial-backdrop" aria-hidden="true"></div>
            <section class="yh-division-tutorial-card" role="dialog" aria-modal="true" aria-labelledby="yh-division-tutorial-title">
                <button type="button" class="yh-division-tutorial-skip" id="yh-division-tutorial-skip">Skip tutorial</button>

                <div class="yh-division-tutorial-layout">
                    <div class="yh-division-tutorial-visual" id="yh-division-tutorial-visual">
                        <div class="yh-division-tutorial-orbit" aria-hidden="true"></div>
                        <div class="yh-division-tutorial-image-shell">
                            <img id="yh-division-tutorial-image" src="" alt="" decoding="async">
                        </div>
                        <div class="yh-division-tutorial-feature-preview" id="yh-division-tutorial-feature-preview"></div>
                    </div>

                    <div class="yh-division-tutorial-content">
                        <div class="yh-division-tutorial-meta">
                            <span id="yh-division-tutorial-division">Division</span>
                            <span id="yh-division-tutorial-count">1 of 4</span>
                        </div>

                        <div class="yh-division-tutorial-eyebrow" id="yh-division-tutorial-eyebrow"></div>
                        <h2 id="yh-division-tutorial-title"></h2>
                        <p id="yh-division-tutorial-copy"></p>

                        <div class="yh-division-tutorial-features" id="yh-division-tutorial-features"></div>
                        <div class="yh-division-tutorial-dots" id="yh-division-tutorial-dots" aria-label="Tutorial progress"></div>

                        <div class="yh-division-tutorial-actions">
                            <button type="button" class="yh-division-tutorial-back" id="yh-division-tutorial-back">Back</button>
                            <button type="button" class="yh-division-tutorial-next" id="yh-division-tutorial-next">Next</button>
                        </div>
                    </div>
                </div>
            </section>
        `;

        document.body.appendChild(overlay);
        bindOverlayEvents(overlay);
        return overlay;
    }

    function escapeHtml(value = '') {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderActiveSlide() {
        const config = DIVISION_CONFIG[activeDivision];
        if (!config) return;

        const slides = config.slides;
        const safeIndex = Math.max(0, Math.min(slides.length - 1, activeSlideIndex));
        const slide = slides[safeIndex];
        activeSlideIndex = safeIndex;

        const overlay = ensureOverlay();
        overlay.setAttribute('data-yh-division', activeDivision);

        const divisionEl = document.getElementById('yh-division-tutorial-division');
        const countEl = document.getElementById('yh-division-tutorial-count');
        const eyebrowEl = document.getElementById('yh-division-tutorial-eyebrow');
        const titleEl = document.getElementById('yh-division-tutorial-title');
        const copyEl = document.getElementById('yh-division-tutorial-copy');
        const imageEl = document.getElementById('yh-division-tutorial-image');
        const previewEl = document.getElementById('yh-division-tutorial-feature-preview');
        const featuresEl = document.getElementById('yh-division-tutorial-features');
        const dotsEl = document.getElementById('yh-division-tutorial-dots');
        const backButton = document.getElementById('yh-division-tutorial-back');
        const nextButton = document.getElementById('yh-division-tutorial-next');

        if (divisionEl) divisionEl.textContent = config.label;
        if (countEl) countEl.textContent = `${safeIndex + 1} of ${slides.length}`;
        if (eyebrowEl) eyebrowEl.textContent = slide.eyebrow;
        if (titleEl) titleEl.textContent = slide.title;
        if (copyEl) copyEl.textContent = slide.copy;

        if (imageEl) {
            imageEl.src = slide.image;
            imageEl.alt = `${config.shortLabel}: ${slide.title}`;
        }

        if (previewEl) {
            previewEl.innerHTML = slide.features
                .map((feature, index) => `<span><b>${String(index + 1).padStart(2, '0')}</b>${escapeHtml(feature)}</span>`)
                .join('');
        }

        if (featuresEl) {
            featuresEl.innerHTML = slide.features
                .map((feature) => `<span>${escapeHtml(feature)}</span>`)
                .join('');
        }

        if (dotsEl) {
            dotsEl.innerHTML = slides.map((_, index) => `
                <button
                    type="button"
                    class="${index === safeIndex ? 'is-active' : ''}"
                    data-yh-tutorial-slide="${index}"
                    aria-label="Go to slide ${index + 1}"
                    aria-current="${index === safeIndex ? 'step' : 'false'}"
                ></button>
            `).join('');
        }

        if (backButton) {
            backButton.disabled = safeIndex === 0;
            backButton.setAttribute('aria-disabled', safeIndex === 0 ? 'true' : 'false');
        }

        if (nextButton) {
            nextButton.textContent = safeIndex === slides.length - 1 ? 'Finish' : 'Next';
        }
    }

    function isEmbeddedChildPage() {
        try {
            return window.parent && window.parent !== window;
        } catch (_) {
            return false;
        }
    }

    function isDashboardPage() {
        return document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub' ||
            String(window.location.pathname || '').replace(/\/+$/, '') === '/dashboard';
    }

    function getCurrentDivision() {
        if (isDashboardPage()) {
            return normalizeDivision(document.body?.getAttribute('data-yh-unified-division') || '');
        }

        return normalizeDivision(
            document.body?.getAttribute('data-yh-page') ||
            document.body?.getAttribute('data-yh-view') ||
            ''
        );
    }

    function getCurrentWorkspace() {
        return String(document.body?.getAttribute('data-yh-unified-workspace') || '').trim().toLowerCase();
    }

    function currentWorkspaceBelongsToDivision(division = '') {
        const cleanDivision = normalizeDivision(division);
        const workspace = getCurrentWorkspace();

        if (!isDashboardPage()) return true;
        if (!workspace) return false;
        if (workspace === cleanDivision) return true;
        return workspace.startsWith(`${cleanDivision}-`);
    }

    function isStandalonePageReady(division = '') {
        if (isDashboardPage()) return true;

        if (division === 'academy') {
            return !document.body?.classList.contains('academy-startup-booting') &&
                !document.body?.classList.contains('academy-standalone-shell-pending');
        }

        if (division === 'plazas') {
            if (document.body?.classList.contains('yh-plaza-access-booting')) return false;

            const gate = document.getElementById('plazaAccessGate');
            if (gate && !gate.hidden) return false;
        }

        return true;
    }

        function normalizeDivisionAccessStatus(
        value = ''
    ) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ');
    }

    function getDivisionAccessEndpoint(
        division = ''
    ) {
        const cleanDivision =
            normalizeDivision(division);

        if (cleanDivision === 'academy') {
            return '/api/academy/membership-status';
        }

        if (cleanDivision === 'plazas') {
            return '/api/plaza/application-status';
        }

        if (cleanDivision === 'federation') {
            return '/api/federation/application-status';
        }

        return '';
    }

    function divisionAccessPayloadIsApproved(
        division = '',
        payload = {}
    ) {
        const cleanDivision =
            normalizeDivision(division);

        const status =
            normalizeDivisionAccessStatus(
                payload?.applicationStatus ||
                payload?.application?.status ||
                payload?.status ||
                ''
            );

        if (cleanDivision === 'academy') {
            return (
                payload?.canEnterAcademy === true ||
                status === 'approved'
            );
        }

        if (cleanDivision === 'plazas') {
            return (
                payload?.canEnterPlaza === true ||
                status === 'approved'
            );
        }

        if (cleanDivision === 'federation') {
            return (
                payload?.canEnterFederation === true ||
                status === 'approved'
            );
        }

        return false;
    }

    async function verifyDivisionAccessApproved(
        division = ''
    ) {
        const cleanDivision =
            normalizeDivision(division);

        const endpoint =
            getDivisionAccessEndpoint(
                cleanDivision
            );

        if (!endpoint) {
            return false;
        }

        try {
            const payload =
                await tutorialFetch(
                    endpoint,
                    {
                        method: 'GET'
                    }
                );

            return divisionAccessPayloadIsApproved(
                cleanDivision,
                payload
            );
        } catch (error) {
            console.warn(
                `${cleanDivision || 'Division'} tutorial access check skipped:`,
                error?.message || error
            );

            return false;
        }
    }

    function requestParentTutorial(division = '') {
        if (!isEmbeddedChildPage()) return false;

        const cleanDivision = normalizeDivision(division);
        if (!cleanDivision) return false;

        const send = () => {
            try {
                window.parent.postMessage({
                    type: PARENT_MESSAGE_TYPE,
                    division: cleanDivision
                }, window.location.origin);
            } catch (_) {}
        };

        send();
        window.setTimeout(send, 240);
        window.setTimeout(send, 800);
        return true;
    }

    function routeDashboardParentToDefault(division = '') {
        if (!isDashboardPage()) return false;

        const cleanDivision = normalizeDivision(division);
        const config = DIVISION_CONFIG[cleanDivision];
        if (!config || getCurrentWorkspace() !== cleanDivision) return false;

        if (typeof window.activateDashboardUnifiedWorkspace !== 'function') return false;

        window.activateDashboardUnifiedWorkspace(config.defaultWorkspace, {
            animate: false,
            scroll: true,
            persist: true,
            ...(cleanDivision === 'federation' ? { federationAccessVerified: true } : {})
        });

        return true;
    }

    async function openTutorial(division = '', options = {}) {
        const cleanDivision = normalizeDivision(division);
        const config = DIVISION_CONFIG[cleanDivision];
        if (!config) return false;

        if (isEmbeddedChildPage()) {
            if (
                !isStandalonePageReady(
                    cleanDivision
                )
            ) {
                return false;
            }

            return requestParentTutorial(
                cleanDivision
            );
        }

        if (
            !currentWorkspaceBelongsToDivision(
                cleanDivision
            ) &&
            options.force !== true
        ) {
            return false;
        }

        const accessApproved =
            await verifyDivisionAccessApproved(
                cleanDivision
            );

        if (!accessApproved) {
            return false;
        }

        let state;

        try {
            state =
                await loadTutorialState(
                    options.force === true ||
                    options.refresh === true
                );
        } catch (error) {
            console.warn('Division tutorial state load skipped:', error?.message || error);

            if (isDashboardPage()) {
                routeDashboardParentToDefault(cleanDivision);
            }

            return false;
        }

        if (options.force !== true && isDivisionCompleted(cleanDivision, state)) {
            routeDashboardParentToDefault(cleanDivision);
            return false;
        }

        activeDivision = cleanDivision;
        activeSlideIndex = Math.max(0, Math.min(config.slides.length - 1, Number(options.slide || 0) || 0));

        const overlay = ensureOverlay();
        renderActiveSlide();

        overlay.hidden = false;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('yh-division-tutorial-open');
        document.body?.classList.add('yh-division-tutorial-open');

        window.setTimeout(() => {
            document.getElementById('yh-division-tutorial-next')?.focus({ preventScroll: true });
        }, 30);

        return true;
    }

    function closeTutorial(method = 'finish') {
        const division = activeDivision;
        const overlay = document.getElementById('yh-division-tutorial-overlay');

        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.hidden = true;
        }

        document.documentElement.classList.remove('yh-division-tutorial-open');
        document.body?.classList.remove('yh-division-tutorial-open');

        activeDivision = '';
        activeSlideIndex = 0;

        if (!division) return;

        markDivisionCompletedLocally(division, method);
        persistDivisionCompletion(division, method).catch((error) => {
            console.warn('Division tutorial completion will retry later:', error?.message || error);
        });

        routeDashboardParentToDefault(division);
    }

    function goToSlide(index) {
        const config = DIVISION_CONFIG[activeDivision];
        if (!config) return;

        activeSlideIndex = Math.max(0, Math.min(config.slides.length - 1, Number(index) || 0));
        renderActiveSlide();
    }

    function goNext() {
        const config = DIVISION_CONFIG[activeDivision];
        if (!config) return;

        if (activeSlideIndex >= config.slides.length - 1) {
            closeTutorial('finish');
            return;
        }

        goToSlide(activeSlideIndex + 1);
    }

    function goBack() {
        if (activeSlideIndex <= 0) return;
        goToSlide(activeSlideIndex - 1);
    }

    function bindOverlayEvents(overlay) {
        if (!overlay || overlay.dataset.yhTutorialBound === 'true') return;
        overlay.dataset.yhTutorialBound = 'true';

        overlay.addEventListener('click', (event) => {
            const slideButton = event.target.closest('[data-yh-tutorial-slide]');
            if (slideButton) {
                goToSlide(Number(slideButton.getAttribute('data-yh-tutorial-slide') || 0));
                return;
            }

            if (event.target.closest('#yh-division-tutorial-skip')) {
                closeTutorial('skip');
                return;
            }

            if (event.target.closest('#yh-division-tutorial-back')) {
                goBack();
                return;
            }

            if (event.target.closest('#yh-division-tutorial-next')) {
                goNext();
            }
        });

        const visual = overlay.querySelector('#yh-division-tutorial-visual');

        visual?.addEventListener('touchstart', (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        visual?.addEventListener('touchend', (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;

            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
            if (deltaX < 0) goNext();
            else goBack();
        }, { passive: true });
    }

    function scheduleCurrentEntry(delay = 260) {
        window.clearTimeout(entryTimer);

        entryTimer = window.setTimeout(async () => {
            const division = getCurrentDivision();
            if (!division || !DIVISION_CONFIG[division]) return;

            if (
                !isStandalonePageReady(
                    division
                )
            ) {
                if (
                    standaloneRetryCount <
                    16
                ) {
                    standaloneRetryCount +=
                        1;

                    scheduleCurrentEntry(
                        420
                    );
                }

                return;
            }

            if (isEmbeddedChildPage()) {
                requestParentTutorial(
                    division
                );

                return;
            }

            if (
                !currentWorkspaceBelongsToDivision(
                    division
                )
            ) {
                return;
            }

            standaloneRetryCount = 0;

            await openTutorial(
                division
            );
        }, Math.max(0, Number(delay) || 0));
    }

    function bindGlobalEvents() {
        window.addEventListener(
            'yh:division-access-status-updated',
            (event) => {
                const division =
                    normalizeDivision(
                        event?.detail
                            ?.division ||
                        ''
                    );

                const snapshot =
                    event?.detail
                        ?.snapshot &&
                    typeof event.detail
                        .snapshot ===
                        'object'
                        ? event.detail
                            .snapshot
                        : {};

                if (
                    !division ||
                    getCurrentDivision() !==
                        division
                ) {
                    return;
                }

                if (
                    !divisionAccessPayloadIsApproved(
                        division,
                        snapshot
                    )
                ) {
                    return;
                }

                /*
                 * Approval may change while the user is
                 * already inside the same workspace.
                 * Recheck immediately without requiring
                 * another tab click.
                 */
                scheduleCurrentEntry(
                    80
                );
            }
        );

        window.addEventListener(
            'focus',
            () => {
                scheduleCurrentEntry(
                    120
                );
            }
        );

        window.addEventListener(
            'pageshow',
            () => {
                scheduleCurrentEntry(
                    120
                );
            }
        );

        document.addEventListener(
            'visibilitychange',
            () => {
                if (!document.hidden) {
                    scheduleCurrentEntry(
                        120
                    );
                }
            }
        );

        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== PARENT_MESSAGE_TYPE) return;

            const division = normalizeDivision(event.data?.division || '');
            if (!division || getCurrentDivision() !== division) return;

            void openTutorial(division);
        });

        document.addEventListener('click', (event) => {
            const replayButton = event.target.closest('[data-yh-replay-division-tutorial]');
            if (!replayButton) return;

            event.preventDefault();

            const division = normalizeDivision(
                replayButton.getAttribute('data-yh-replay-division-tutorial') || ''
            );

            if (division) {
                void openTutorial(division, { force: true });
            }
        });

        document.addEventListener('keydown', (event) => {
            if (!activeDivision) return;

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goNext();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goBack();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeTutorial('skip');
            }
        });

        if (isEmbeddedChildPage() && document.body) {
            let embeddedReadyLast =
                isStandalonePageReady(
                    getCurrentDivision()
                );

            const embeddedObserver =
                new MutationObserver(() => {
                    const division =
                        getCurrentDivision();

                    const ready =
                        Boolean(
                            division &&
                            DIVISION_CONFIG[
                                division
                            ] &&
                            isStandalonePageReady(
                                division
                            )
                        );

                    /*
                     * The child may initially boot while
                     * its access gate or workspace shell
                     * is still resolving.
                     *
                     * Trigger the tutorial request exactly
                     * when that child changes from not-ready
                     * to ready.
                     */
                    if (
                        ready &&
                        !embeddedReadyLast
                    ) {
                        standaloneRetryCount =
                            0;

                        scheduleCurrentEntry(
                            60
                        );
                    }

                    embeddedReadyLast =
                        ready;
                });

            embeddedObserver.observe(
                document.body,
                {
                    attributes: true,
                    subtree: true,
                    attributeFilter: [
                        'class',
                        'hidden',
                        'data-yh-dashboard-child-ready',
                        'data-yh-dashboard-active-screen'
                    ]
                }
            );

            window
                .__yhDivisionTutorialEmbeddedReadyObserverV1 =
                embeddedObserver;
        }

        if (isDashboardPage() && document.body) {
            const observer = new MutationObserver((mutations) => {
                if (mutations.some((mutation) => (
                    mutation.type === 'attributes' &&
                    (
                        mutation.attributeName === 'data-yh-unified-workspace' ||
                        mutation.attributeName === 'data-yh-unified-division'
                    )
                ))) {
                    scheduleCurrentEntry(220);
                }
            });

            observer.observe(document.body, {
                attributes: true,
                attributeFilter: [
                    'data-yh-unified-workspace',
                    'data-yh-unified-division'
                ]
            });

            window.__yhDivisionTutorialWorkspaceObserverV1 = observer;
        }
    }

    function boot() {
        ensureOverlay();
        bindGlobalEvents();
        retryPendingCompletions();

        if (isEmbeddedChildPage()) {
            scheduleCurrentEntry(180);
            return;
        }

        scheduleCurrentEntry(isDashboardPage() ? 420 : 720);
    }

    window.YHDivisionTutorials =
        Object.freeze({
            open:
                (
                    division,
                    options = {}
                ) =>
                    openTutorial(
                        division,
                        options
                    ),

            replay:
                (division) =>
                    openTutorial(
                        division,
                        {
                            force: true
                        }
                    ),

            close:
                (
                    method = 'skip'
                ) =>
                    closeTutorial(
                        method
                    ),

            refreshState:
                () =>
                    loadTutorialState(
                        true
                    ),

            checkCurrent:
                () =>
                    scheduleCurrentEntry(
                        0
                    ),

            getConfig:
                () =>
                    DIVISION_CONFIG
        });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
