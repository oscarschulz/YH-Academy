// public/js/dashboard-v3.js
(function bootYHDashboardV3() {
    'use strict';

    const ACADEMY_CHILDREN = [
        {
            key: 'academy-roadmap',
            label: 'Roadmap',
            title: 'Build your execution path',
            description: 'Open your Roadmap workspace inside the Academy.',
            url: '/academy-embed?section=roadmap'
        },
        {
            key: 'academy-missions',
            label: 'Missions',
            title: 'Work through mission flows',
            description: 'Open your Missions workspace inside the Academy.',
            url: '/academy-embed?section=missions'
        },
        {
            key: 'academy-community',
            label: 'Community Feed',
            title: 'Post, react, and build your circle',
            description: 'Open the Academy Community Feed.',
            url: '/academy-embed?section=community'
        },
        {
            key: 'academy-messages',
            label: 'Messages',
            title: 'Continue member conversations',
            description: 'Open Academy Messages.',
            url: '/academy-embed?section=messages'
        },
        {
            key: 'academy-voice',
            label: 'Live Voice Lounge',
            title: 'Join execution rooms',
            description: 'Open the Live Voice Lounge.',
            url: '/academy-embed?section=voice'
        }
    ];

    const STATE = {
        route: 'overview',
        profileLoaded: false,
        profile: null,
        access: {
            academy: makeAccess('academy'),
            plazas: makeAccess('plazas'),
            federation: makeAccess('federation')
        },
        referrals: {
            code: '',
            url: '',
            invited: 0,
            earned: '$0.00'
        }
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const ACADEMY_EMBED_LOADER_MIN_MS = 450;
    const ACADEMY_EMBED_LOADER_MAX_MS = 1500;
    let academyEmbedLoaderStartedAt = 0;
    let academyEmbedForceHideTimer = null;

    const YHV3_LOADER_MIN_MS = 450;
    const YHV3_LOADER_MAX_MS = 1500;
    let yhv3BootLoaderStartedAt = 0;
    let yhv3BootLoaderForceTimer = null;

    function getStoredToken() {
        try {
            if (window.YHSharedCore?.getStoredAuthToken) return String(window.YHSharedCore.getStoredAuthToken() || '').trim();
        } catch (_) {}

        try {
            return (
                sessionStorage.getItem('yh_token') ||
                localStorage.getItem('yh_token') ||
                sessionStorage.getItem('token') ||
                localStorage.getItem('token') ||
                sessionStorage.getItem('yh_auth_token') ||
                localStorage.getItem('yh_auth_token') ||
                ''
            ).trim();
        } catch (_) {
            return '';
        }
    }

    function makeAccess(key) {
        return {
            key,
            status: 'syncing',
            label: 'Checking',
            canEnter: false,
            pending: false,
            rejected: false
        };
    }

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

    function normalizeDivisionKey(value = '') {
        const clean = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');

        if (clean === 'academy' || clean === 'yha') return 'academy';
        if (clean === 'plaza' || clean === 'plazas') return 'plazas';
        if (clean === 'federation' || clean === 'yhf') return 'federation';

        return '';
    }

    function normalizeStatus(value = '') {
        const clean = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

        if (['approved', 'active', 'accepted', 'member', 'enabled', 'unlocked'].includes(clean)) return 'approved';
        if (['pending', 'submitted', 'under review', 'in review', 'review'].includes(clean)) return 'pending';
        if (['rejected', 'declined', 'denied'].includes(clean)) return 'rejected';
        if (['not applied', 'not_appplied', 'none', 'new', ''].includes(clean)) return 'not_applied';

        return clean || 'not_applied';
    }

    function normalizeAccess(key, source = {}) {
        const division = normalizeDivisionKey(key);
        const raw = source && typeof source === 'object' ? source : {};

        const status = normalizeStatus(
            raw.status ||
            raw.rawStatus ||
            raw.applicationStatus ||
            raw.membershipStatus ||
            raw.state ||
            ''
        );

        const canEnter =
            raw.canEnter === true ||
            raw.approved === true ||
            raw.hasAccess === true ||
            raw.active === true ||
            status === 'approved';

        if (canEnter) {
            return {
                key: division,
                status: 'approved',
                label: 'Approved',
                canEnter: true,
                pending: false,
                rejected: false
            };
        }

        if (status === 'pending') {
            return {
                key: division,
                status: 'pending',
                label: 'Pending',
                canEnter: false,
                pending: true,
                rejected: false
            };
        }

        if (status === 'rejected') {
            return {
                key: division,
                status: 'rejected',
                label: 'Rejected',
                canEnter: false,
                pending: false,
                rejected: true
            };
        }

        return {
            key: division,
            status: 'not_applied',
            label: 'Not Applied',
            canEnter: false,
            pending: false,
            rejected: false
        };
    }

    function extractProfile(payload = {}) {
        if (payload?.profile && typeof payload.profile === 'object') return payload.profile;
        if (payload?.user && typeof payload.user === 'object') return payload.user;
        return payload && typeof payload === 'object' ? payload : {};
    }

    function deriveAccessFromProfile(profile = {}) {
        const divisions = profile.divisions && typeof profile.divisions === 'object'
            ? profile.divisions
            : {};

        const academySource =
            divisions.academy ||
            profile.academy ||
            profile.academyApplication ||
            {
                status: profile.academyApplicationStatus || profile.academyMembershipStatus,
                canEnter: profile.canEnterAcademy || profile.hasAcademyAccess || profile.hasRoadmapAccess
            };

        const plazasSource =
            divisions.plazas ||
            divisions.plaza ||
            profile.plazas ||
            profile.plazaApplication ||
            {
                status: profile.plazaApplicationStatus || profile.plazasApplicationStatus,
                canEnter: profile.canEnterPlaza || profile.canEnterPlazas || profile.hasPlazaAccess || profile.hasPlazasAccess
            };

        const federationSource =
            divisions.federation ||
            profile.federation ||
            profile.federationApplication ||
            {
                status: profile.federationApplicationStatus || profile.federationMembershipStatus,
                canEnter: profile.canEnterFederation || profile.hasFederationAccess
            };

        STATE.access.academy = normalizeAccess('academy', academySource);
        STATE.access.plazas = normalizeAccess('plazas', plazasSource);
        STATE.access.federation = normalizeAccess('federation', federationSource);
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
        let payload = null;

        try {
            payload = text ? JSON.parse(text) : null;
        } catch (_) {
            payload = { success: false, message: text || 'Invalid JSON response.' };
        }

        if (!response.ok) {
            const message = payload?.message || `Request failed: ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }

        return payload;
    }

    async function syncProfile() {
        setBootText('Syncing profile and access...');

        const payload = await fetchJson('/api/universe/profile');
        const profile = extractProfile(payload);

        STATE.profile = profile;
        STATE.profileLoaded = true;

        deriveAccessFromProfile(profile);
        hydrateTopbar(profile);

        try {
            const referrals = await fetchJson('/api/universe/referrals/me');
            hydrateReferralState(referrals);
        } catch (_) {
            hydrateReferralState({});
        }

        syncAccessPills();
        releaseBootLoader();
    }

    function hydrateReferralState(payload = {}) {
        const data = payload.referral || payload.referrals || payload.data || payload || {};
        const profile = STATE.profile || {};

        const code = cleanText(
            data.referralCode ||
            data.code ||
            profile.referralCode ||
            profile.universeReferralCode ||
            ''
        );

        STATE.referrals.code = code;
        STATE.referrals.url = code
            ? `${window.location.origin}/?ref=${encodeURIComponent(code)}`
            : `${window.location.origin}/`;
        STATE.referrals.invited = Number(data.totalInvited || data.invited || data.signups || 0) || 0;
        STATE.referrals.earned = data.totalEarnedFormatted || data.earnedFormatted || `$${Number(data.totalEarned || data.earned || 0).toFixed(2)}`;
    }

    function hydrateTopbar(profile = {}) {
        const name = cleanText(
            profile.display_name ||
            profile.displayName ||
            profile.full_name ||
            profile.fullName ||
            profile.name ||
            profile.username ||
            'YH Member'
        );

        const avatarText = name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'YH';

        const nameNode = $('#yhv3ProfileName');
        const avatarNode = $('#yhv3ProfileAvatar');

        if (nameNode) nameNode.textContent = name;
        if (avatarNode) avatarNode.textContent = avatarText;
    }

    function setBootText(text = '') {
        const node = $('#yhv3LoaderText');
        if (node) node.textContent = text || 'Loading...';
    }

    function releaseBootLoader() {
        const loader = $('#yhv3BootLoader');
        const elapsed = Date.now() - yhv3BootLoaderStartedAt;
        const waitMs = Math.max(0, YHV3_LOADER_MIN_MS - elapsed);

        window.clearTimeout(yhv3BootLoaderForceTimer);

        window.setTimeout(() => {
            document.body.classList.add('yhv3-ready');

            if (!loader) return;

            loader.setAttribute('aria-hidden', 'true');
            loader.classList.add('is-hidden');
        }, waitMs);
    }

    function showBootLoader() {
        document.body.classList.remove('yhv3-ready');
        yhv3BootLoaderStartedAt = Date.now();

        window.clearTimeout(yhv3BootLoaderForceTimer);

        const loader = $('#yhv3BootLoader');
        if (!loader) return;

        loader.setAttribute('aria-hidden', 'false');
        loader.classList.remove('is-hidden');

        yhv3BootLoaderForceTimer = window.setTimeout(() => {
            document.body.classList.add('yhv3-ready');
            loader.setAttribute('aria-hidden', 'true');
            loader.classList.add('is-hidden');
        }, YHV3_LOADER_MAX_MS);
    }

    function syncAccessPills() {
        ['academy', 'plazas', 'federation'].forEach((key) => {
            const access = STATE.access[key] || makeAccess(key);
            const pill = $(`[data-yhv3-access-pill="${key}"]`);

            if (pill) {
                pill.textContent = access.label;
                pill.setAttribute('data-status', access.status);
            }

            const group = $(`[data-yhv3-division-group="${key}"]`);
            if (group) {
                group.setAttribute('data-access-status', access.status);
                group.classList.toggle('is-approved', access.canEnter);
                group.classList.toggle('is-pending', access.pending);
                group.classList.toggle('is-rejected', access.rejected);
            }
        });
    }

    function setRoute(route = 'overview', options = {}) {
        const cleanRoute = cleanText(route, 'overview').toLowerCase();
        STATE.route = cleanRoute;

        document.body.setAttribute('data-yh-v3-route', cleanRoute);

        $$('.yhv3-nav-btn, .yhv3-subnav button, .yhv3-profile-pill').forEach((node) => {
            const nodeRoute = cleanText(node.getAttribute('data-yhv3-route')).toLowerCase();
            const active = nodeRoute === cleanRoute || (
                cleanRoute.startsWith('academy-') &&
                nodeRoute === 'academy'
            );

            node.classList.toggle('is-active', active);
            node.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        $$('.yhv3-subnav').forEach((subnav) => {
            const division = cleanText(subnav.getAttribute('data-yhv3-subnav')).toLowerCase();
            const open = cleanRoute === division || cleanRoute.startsWith(`${division}-`);

            subnav.classList.toggle('is-open', open);
            subnav.setAttribute('aria-hidden', open ? 'false' : 'true');
        });

        if (!options.skipRender) renderRoute(cleanRoute);
    }

    function renderRoute(route = STATE.route) {
        const stage = $('#yhv3Stage');
        if (!stage) return;

        if (!STATE.profileLoaded) {
            stage.innerHTML = renderLoadingSection('Syncing dashboard...');
            return;
        }

        if (route === 'overview') {
            stage.innerHTML = renderOverview();
            bindStageActions();
            return;
        }

        if (route === 'academy') {
            stage.innerHTML = renderAcademyParent();
            bindStageActions();
            return;
        }

        if (route.startsWith('academy-')) {
            stage.innerHTML = renderAcademyChild(route);
            bindStageActions();
            return;
        }

        if (route === 'plazas') {
            stage.innerHTML = renderDivisionPlaceholder('plazas');
            bindStageActions();
            return;
        }

        if (route === 'federation') {
            stage.innerHTML = renderDivisionPlaceholder('federation');
            bindStageActions();
            return;
        }

        stage.innerHTML = renderUtilityPlaceholder(route);
        bindStageActions();
    }

    function renderLoadingSection(text = 'Loading...') {
        return `
            <section class="yhv3-panel yhv3-loading-section">
                <div class="yhv3-section-kicker">YH Universe</div>
                <h1>${escapeHtml(text)}</h1>
                <p>Please wait while the dashboard synchronizes your access state.</p>
            </section>
        `;
    }

    function renderHero(title = '', subtitle = '') {
        return `
            <section class="yhv3-hero">
                <div>
                    <div class="yhv3-section-kicker">YH Universe Command Center</div>
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
            </section>
        `;
    }

    function getDisplayName() {
        const profile = STATE.profile || {};

        return cleanText(
            profile.display_name ||
            profile.displayName ||
            profile.full_name ||
            profile.fullName ||
            profile.name ||
            profile.username ||
            'YH Member'
        );
    }

    function renderOverview() {
        return `
            ${renderHero(
                `Welcome back, ${getDisplayName()}.`,
                'Your access, progress, and network overview.'
            )}

            <section class="yhv3-card-grid">
                ${renderAccessCard('academy')}
                ${renderAccessCard('plazas')}
                ${renderAccessCard('federation')}
                ${renderStaticCard('Business Chats', '0', 'Open', 'business-chats')}
                ${renderStaticCard('Total Invited', String(STATE.referrals.invited || 0), 'View', 'overview')}
            </section>

            <section class="yhv3-panel yhv3-referral">
                <div class="yhv3-section-kicker">Universe Referral Program</div>
                <h2>Invite members. Earn from their purchases.</h2>
                <p>Share your Universe link. When someone you invited makes a purchase or payment, your commission is tracked inside the wallet system.</p>

                <div class="yhv3-ref-row">
                    <input readonly value="${escapeHtml(STATE.referrals.url)}" aria-label="Referral link" />
                    <button type="button" data-yhv3-copy-referral>Copy Link</button>
                </div>

                <div class="yhv3-mini-grid">
                    <div><span>Referral Code</span><strong>${escapeHtml(STATE.referrals.code || 'Not Set')}</strong></div>
                    <div><span>Total Invited</span><strong>${Number(STATE.referrals.invited || 0)}</strong></div>
                    <div><span>Paying Referrals</span><strong>0</strong></div>
                    <div><span>Total Earned</span><strong>${escapeHtml(STATE.referrals.earned || '$0.00')}</strong></div>
                </div>
            </section>
        `;
    }

    function renderAccessCard(key = '') {
        const access = STATE.access[key] || makeAccess(key);
        const title = key === 'plazas' ? 'Plazas' : key.charAt(0).toUpperCase() + key.slice(1);

        const actionLabel =
            access.canEnter ? 'Enter' :
            access.pending ? 'Pending' :
            access.rejected ? 'Reapply' :
            'Apply';

        return `
            <article class="yhv3-access-card" data-status="${escapeHtml(access.status)}">
                <div class="yhv3-card-icon">${key === 'academy' ? '🎓' : key === 'plazas' ? '🏛️' : '💠'}</div>
                <div>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(access.label)}</p>
                </div>
                <button
                    type="button"
                    data-yhv3-division-action="${escapeHtml(key)}"
                    ${access.pending ? 'disabled aria-disabled="true"' : ''}
                >
                    ${escapeHtml(actionLabel)}
                </button>
            </article>
        `;
    }

    function renderStaticCard(title = '', value = '', action = '', route = '') {
        return `
            <article class="yhv3-access-card">
                <div class="yhv3-card-icon">↗</div>
                <div>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(value)}</p>
                </div>
                <button type="button" data-yhv3-route="${escapeHtml(route)}">${escapeHtml(action)}</button>
            </article>
        `;
    }

    function renderAcademyParent() {
        const access = STATE.access.academy;

        if (!access.canEnter) {
            return renderLockedDivision('academy');
        }

        return `
            <section class="yhv3-parent-hero">
                <div class="yhv3-parent-copy">
                    <div class="yhv3-section-kicker">Academy Workspace</div>
                    <h1>The Academy</h1>
                    <h2>Execution, roadmap, missions, and self-improvement.</h2>
                    <p>Use the Academy as your guided execution layer. Roadmap, missions, community, messages, and live sessions stay inside this clean Dashboard V3 shell.</p>

                    <div class="yhv3-hero-actions">
                        <button type="button" data-yhv3-route="academy-roadmap">Open Roadmap →</button>
                        <span>Approved Access</span>
                    </div>
                </div>

                <aside class="yhv3-parent-status">
                    <img src="/images/logo.avif" alt="" />
                    <strong>Live Division</strong>
                    <p>Academy access controls Roadmap, Missions, Community, Messages, and Live Voice Lounge.</p>
                </aside>
            </section>

            <section class="yhv3-child-card-grid">
                ${ACADEMY_CHILDREN.map((child) => `
                    <button type="button" class="yhv3-child-card" data-yhv3-route="${escapeHtml(child.key)}">
                        <span>${escapeHtml(child.label)}</span>
                        <strong>${escapeHtml(child.title)}</strong>
                        <em>${escapeHtml(child.description)}</em>
                    </button>
                `).join('')}
            </section>
        `;
    }

    function renderAcademyChild(route = '') {
        const access = STATE.access.academy;

        if (!access.canEnter) {
            return renderLockedDivision('academy');
        }

        const child = ACADEMY_CHILDREN.find((item) => item.key === route) || ACADEMY_CHILDREN[0];

        return `
            <section class="yhv3-child-shell yhv3-child-shell--frameless" data-yhv3-child-shell="${escapeHtml(child.key)}">
                <div class="yhv3-frame-wrap yhv3-frame-wrap--full">
                    <div class="yhv3-frame-loader">Preparing ${escapeHtml(child.label)}...</div>
                    <iframe
                        title="${escapeHtml(child.label)}"
                        src="${escapeHtml(child.url)}"
                        loading="eager"
                        referrerpolicy="same-origin"
                        data-yhv3-child-frame
                    ></iframe>
                </div>
            </section>
        `;
    }

    function renderLockedDivision(key = '') {
        const access = STATE.access[key] || makeAccess(key);
        const title = key === 'plazas' ? 'Plazas' : key.charAt(0).toUpperCase() + key.slice(1);

        const message =
            access.pending ? 'Your application is under review. You will get access after admin approval.' :
            access.rejected ? 'Your previous application was rejected. You may reapply from the current application flow.' :
            `${title} is application-gated. Submit your application first from the current application flow.`;

        return `
            <section class="yhv3-panel yhv3-locked-panel">
                <div class="yhv3-section-kicker">${escapeHtml(title)} Access</div>
                <h1>${escapeHtml(access.label)}</h1>
                <p>${escapeHtml(message)}</p>

                <div class="yhv3-hero-actions">
                    ${access.pending ? '<button type="button" disabled>Pending Review</button>' : `<a href="/dashboard" class="yhv3-link-btn">Open Current Application Flow</a>`}
                    <button type="button" data-yhv3-route="overview">Back to Dashboard</button>
                </div>
            </section>
        `;
    }

    function renderDivisionPlaceholder(key = '') {
        const access = STATE.access[key] || makeAccess(key);
        const title = key === 'plazas' ? 'Plazas' : 'Federation';

        if (!access.canEnter) {
            return renderLockedDivision(key);
        }

        const url = key === 'plazas'
            ? '/plaza?embed=dashboard-v3'
            : '/federation?embed=dashboard-v3';

        return `
            <section class="yhv3-child-shell yhv3-child-shell--frameless">
                <div class="yhv3-frame-wrap yhv3-frame-wrap--full">
                    <div class="yhv3-frame-loader">Preparing ${escapeHtml(title)}...</div>
                    <iframe title="${escapeHtml(title)}" src="${escapeHtml(url)}" loading="eager" referrerpolicy="same-origin" data-yhv3-child-frame></iframe>
                </div>
            </section>
        `;
    }

    function renderUtilityPlaceholder(route = '') {
        const title = route
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Dashboard';

        return `
            <section class="yhv3-panel">
                <div class="yhv3-section-kicker">Dashboard V3</div>
                <h1>${escapeHtml(title)}</h1>
                <p>This section is reserved for the next V3 migration pass. No old dashboard controller is loaded here.</p>
                <button type="button" data-yhv3-route="overview">Back to Dashboard</button>
            </section>
        `;
    }

    function bindStageActions() {
        $$('[data-yhv3-route]', $('#yhv3Stage')).forEach((node) => {
            node.addEventListener('click', () => {
                const route = cleanText(node.getAttribute('data-yhv3-route'));
                if (route) setRoute(route);
            });
        });

        $$('[data-yhv3-division-action]').forEach((node) => {
            node.addEventListener('click', () => {
                const key = normalizeDivisionKey(node.getAttribute('data-yhv3-division-action'));
                if (key) handleDivisionAction(key);
            });
        });

        const copyBtn = $('[data-yhv3-copy-referral]');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(STATE.referrals.url || '');
                    showToast('Referral link copied.');
                } catch (_) {
                    showToast('Could not copy referral link.', 'error');
                }
            });
        }

        $$('[data-yhv3-child-frame]').forEach((frame) => {
            const wrap = frame.closest('.yhv3-frame-wrap');
            const startedAt = Date.now();

            const markLoaded = () => {
                if (!wrap || wrap.classList.contains('is-loaded')) return;

                const elapsed = Date.now() - startedAt;
                const waitMs = Math.max(0, YHV3_LOADER_MIN_MS - elapsed);

                window.setTimeout(() => {
                    wrap.classList.add('is-loaded');
                }, waitMs);
            };

            frame.addEventListener('load', markLoaded, { once: true });
            window.setTimeout(markLoaded, YHV3_LOADER_MAX_MS);
        });
    }

    function handleDivisionAction(key = '') {
        const access = STATE.access[key] || makeAccess(key);

        if (access.pending) {
            showToast('Your application is still under review.');
            return;
        }

        if (access.canEnter) {
            setRoute(key);
            return;
        }

        window.location.href = '/dashboard';
    }

    function showToast(message = '', type = 'success') {
        try {
            if (typeof window.YHSharedCore?.showToast === 'function') {
                window.YHSharedCore.showToast(message, type);
                return;
            }
        } catch (_) {}

        const toast = $('#yhv3Toast');
        if (!toast) return;

        toast.textContent = message;
        toast.setAttribute('data-type', type);
        toast.classList.add('is-visible');

        window.clearTimeout(window.__yhv3ToastTimer);
        window.__yhv3ToastTimer = window.setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 2600);
    }

    function bindGlobalNavigation() {
        $$('[data-yhv3-route]').forEach((node) => {
            if (node.closest('#yhv3Stage')) return;

            node.addEventListener('click', () => {
                const route = cleanText(node.getAttribute('data-yhv3-route'));
                if (route) setRoute(route);
            });
        });

        const logout = $('#yhv3LogoutBtn');
        if (logout) {
            logout.addEventListener('click', () => {
                if (typeof window.YHSharedCore?.logoutUser === 'function') {
                    window.YHSharedCore.logoutUser();
                    return;
                }

                window.location.href = '/';
            });
        }
    }

    function enforceAuth() {
        const token = getStoredToken();

        if (token) return true;

        window.location.replace('/?redirect=dashboard-v3');
        return false;
    }

    async function boot() {
        if (!enforceAuth()) return;

        showBootLoader();
        bindGlobalNavigation();
        setRoute('overview', { skipRender: true });
        renderRoute('overview');

        try {
            await syncProfile();
        } catch (error) {
            console.error('Dashboard V3 profile sync failed:', error);
            releaseBootLoader();
            showToast(error?.message || 'Unable to sync dashboard.', 'error');
        }

        renderRoute(STATE.route);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.YHDashboardV3 = {
        state: STATE,
        setRoute,
        syncProfile,
        renderRoute
    };
})();