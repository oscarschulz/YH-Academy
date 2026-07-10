/* public/js/dashboard-v2-controller.js */
/*
  Dashboard V2 Controller Foundation
  Goal: dashboard-only ownership for parent division tabs without editing old dashboard.js internals.
  Safe rule: this file controls parent-tab shell only. Existing dashboard.js still owns backend fetches,
  modals, profile, referrals, wallet, application forms, and approved child workspaces.
*/

(function installYHDashboardV2Controller() {
    if (window.__yhDashboardV2ControllerInstalled) return;
    window.__yhDashboardV2ControllerInstalled = true;

    const DIVISIONS = {
        academy: {
            label: 'Academy',
            eyebrow: 'Academy Workspace',
            title: 'The Academy',
            subtitle: 'Execution, roadmap, missions, and self-improvement.',
            copy: 'Use the Academy as your guided execution layer. Apply first, then unlock roadmap, missions, community, messages, and live sessions inside the Dashboard.',
            signalTitle: 'Live Division',
            signalCopy: 'Academy access controls Roadmap, Missions, Community, Messages, and Live Voice Lounge.',
            applyLabel: 'Apply for Academy Access',
            pendingLabel: 'Academy Application Under Review',
            approvedLabel: 'Open Roadmap',
            defaultChild: 'academy-roadmap',
            parentSelector: '[data-yh-dashboard-shell="academy"]',
            subnavId: 'yh-sidebar-subnav-academy',
            childSelector: '[data-yh-sidebar-child^="academy-"], [data-yh-mobile-subtab-menu-option^="academy-"]',
            children: [
                ['Roadmap', 'Build your execution path and next move.', 'academy-roadmap'],
                ['Missions', 'Work through lead missions and task flows.', 'academy-missions'],
                ['Community Feed', 'Post, react, and build your Academy circle.', 'academy-community'],
                ['Messages', 'Continue member conversations.', 'academy-messages'],
                ['Live Voice Lounge', 'Join live execution rooms.', 'academy-voice']
            ],
            applyFns: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal']
        },
        plazas: {
            label: 'Plazas',
            eyebrow: 'Plazas Network',
            title: 'The Plazas',
            subtitle: 'Application-gated movement hub.',
            copy: 'Apply through the Dashboard Plazas application before entering the movement hub. Approval unlocks feed, opportunities, directory, regions, requests, messages, and bridge paths.',
            signalTitle: 'Movement Layer',
            signalCopy: 'Plazas access unlocks networking, opportunities, regional hubs, requests, meetups, and marketplace paths.',
            applyLabel: 'Apply for Plazas Access',
            pendingLabel: 'Plazas Application Under Review',
            approvedLabel: 'Open Feed',
            defaultChild: 'plazas-feed',
            parentSelector: '[data-yh-dashboard-shell="plazas"]',
            subnavId: 'yh-sidebar-subnav-plazas',
            childSelector: '[data-yh-sidebar-child^="plazas-"], [data-yh-mobile-subtab-menu-option^="plazas-"]',
            children: [
                ['Feed', 'See Plaza updates and movement signals.', 'plazas-feed'],
                ['Opportunities', 'Review services, offers, and open paths.', 'plazas-opportunities'],
                ['Directory', 'Find trusted members and operators.', 'plazas-directory'],
                ['Regions', 'Move through regional hubs.', 'plazas-regions'],
                ['Bridge', 'Request strategic introductions.', 'plazas-bridge'],
                ['Requests', 'Track submitted movement requests.', 'plazas-requests']
            ],
            applyFns: ['openPlazaApplicationModal']
        },
        federation: {
            label: 'Federation',
            eyebrow: 'Federation Layer',
            title: 'The Federation',
            subtitle: 'Selective access network layer.',
            copy: 'Request Federation access from the Dashboard. Approval unlocks command, connect, deal rooms, protected directory, referrals, requests, and member access state.',
            signalTitle: 'Strategic Layer',
            signalCopy: 'Federation access controls high-value relationship capital, requests, protected visibility, and deal-room movement.',
            applyLabel: 'Apply for Federation Access',
            pendingLabel: 'Federation Application Under Review',
            approvedLabel: 'Open Command',
            defaultChild: 'federation-command',
            parentSelector: '[data-yh-dashboard-shell="federation"]',
            subnavId: 'yh-sidebar-subnav-federation',
            childSelector: '[data-yh-sidebar-child^="federation-"], [data-yh-mobile-subtab-menu-option^="federation-"]',
            children: [
                ['Command', 'Review Federation access and commands.', 'federation-command'],
                ['Connect', 'Build high-value relationship paths.', 'federation-connect'],
                ['Deal Rooms', 'Track strategic deal-room movement.', 'federation-deal-rooms'],
                ['Directory', 'Explore protected member visibility.', 'federation-directory'],
                ['My Requests', 'Track requests and review status.', 'federation-requests'],
                ['My Access', 'View access state and permissions.', 'federation-access']
            ],
            applyFns: ['openFederationApplicationModal']
        }
    };

    const LEGACY_PARENT_SURFACE_SELECTORS = [
        '.yh-academy-parent-hero-header',
        '.yh-academy-parent-vision-scope',
        '.yh-universe-command-hero',
        '.yh-universe-stage-nav',
        '.yh-universe-dots',
        '#yh-universe-progress-rail',
        '#yh-econ-bridge-card',
        '#yh-universe-feature-kicker'
    ];

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function normalizeKey(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'plaza') return 'plazas';
        return DIVISIONS[raw] ? raw : '';
    }

    function readJsonStorage(key) {
        try {
            const local = localStorage.getItem(key);
            if (local) return JSON.parse(local);
        } catch (_) {}

        try {
            const session = sessionStorage.getItem(key);
            if (session) return JSON.parse(session);
        } catch (_) {}

        return null;
    }

    function getText(node) {
        return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function setVisible(node, visible, display = '') {
        if (!node || !(node instanceof HTMLElement)) return;

        node.classList.toggle('hidden-step', !visible);
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.removeProperty('display');
            if (display) node.style.display = display;
            node.style.removeProperty('visibility');
            node.style.removeProperty('opacity');
            node.style.removeProperty('pointer-events');
            return;
        }

        node.style.display = 'none';
        node.style.visibility = 'hidden';
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
    }

    function statusFromText(rawText) {
        const text = String(rawText || '').toLowerCase();

        if (text.includes('approved') || text.includes('member') || text.includes('active') || text.includes('unlocked')) {
            return { approved: true, pending: false, rejected: false, status: 'approved', label: 'Approved' };
        }

        if (text.includes('pending') || text.includes('review') || text.includes('screening') || text.includes('waitlist')) {
            return { approved: false, pending: true, rejected: false, status: 'pending', label: 'Under Review' };
        }

        if (text.includes('rejected') || text.includes('denied')) {
            return { approved: false, pending: false, rejected: true, status: 'rejected', label: 'Rejected' };
        }

        return null;
    }

    function statusFromObject(raw) {
        const obj = raw && typeof raw === 'object' ? raw : {};
        const status = String(
            obj.status ||
            obj.applicationStatus ||
            obj.accessStatus ||
            obj.membershipStatus ||
            obj.academyApplicationStatus ||
            obj.plazaApplicationStatus ||
            obj.federationApplicationStatus ||
            ''
        ).trim().toLowerCase().replace(/[_-]+/g, ' ');

        const approved =
            obj.isMember === true ||
            obj.canEnter === true ||
            obj.canEnterAcademy === true ||
            obj.canEnterPlaza === true ||
            obj.canEnterFederation === true ||
            obj.canEnterDivision === true ||
            obj.hasAccess === true ||
            obj.hasAcademyAccess === true ||
            obj.hasPlazaAccess === true ||
            obj.hasFederationAccess === true ||
            status === 'approved' ||
            status === 'active' ||
            status === 'member';

        const pending =
            status === 'pending' ||
            status === 'under review' ||
            status === 'pending review' ||
            status === 'screening' ||
            status === 'waitlisted' ||
            status === 'shortlisted' ||
            status === 'new';

        const rejected = status === 'rejected' || status === 'denied' || status === 'not approved';

        return {
            approved,
            pending,
            rejected,
            status: status || (approved ? 'approved' : pending ? 'pending' : rejected ? 'rejected' : 'not_applied'),
            label: approved ? 'Approved' : pending ? 'Under Review' : rejected ? 'Rejected' : 'Not Applied'
        };
    }

    function getVisibleOverviewStatus(key) {
        const config = DIVISIONS[key];
        if (!config) return null;

        const exact = document.querySelector(`[data-yh-overview-division-card="${key}"]`);
        if (exact) {
            const parsed = statusFromText(getText(exact));
            if (parsed) return parsed;
        }

        const candidates = Array.from(document.querySelectorAll('article, section, div, button'))
            .filter((node) => node instanceof HTMLElement)
            .filter((node) => {
                const text = getText(node);
                return text.length > 0 && text.length < 220 && text.toLowerCase().includes(config.label.toLowerCase());
            });

        for (const node of candidates) {
            const parsed = statusFromText(getText(node));
            if (parsed) return parsed;
        }

        return null;
    }

    function getDivisionState(key) {
        const visible = getVisibleOverviewStatus(key);
        if (visible && visible.approved !== true) return visible;

        const storageKeys = [
            'yh_dashboard_self_profile_cache_v1',
            'yh_academy_profile_cache_v1',
            'yh_user_profile_cache_v1',
            'yh_current_user',
            'yh_user'
        ];

        const profiles = [];

        try {
            if (typeof window.dashboardGetSelfProfileCache === 'function') profiles.push(window.dashboardGetSelfProfileCache());
        } catch (_) {}

        try {
            if (typeof window.dashboardGetTopProfileCache === 'function') profiles.push(window.dashboardGetTopProfileCache());
        } catch (_) {}

        storageKeys.forEach((name) => {
            const parsed = readJsonStorage(name);
            if (parsed) profiles.push(parsed);
        });

        for (const profile of profiles) {
            if (!profile || typeof profile !== 'object') continue;

            const divisions = profile.divisions && typeof profile.divisions === 'object' ? profile.divisions : {};
            const direct =
                divisions[key] ||
                divisions[key === 'plazas' ? 'plaza' : key] ||
                profile[key] ||
                profile[`${key}Application`] ||
                profile[key === 'plazas' ? 'plazaApplication' : `${key}Application`];

            if (direct && typeof direct === 'object') {
                const parsed = statusFromObject(direct);
                if (parsed.approved || parsed.pending || parsed.rejected || parsed.status !== 'not_applied') return parsed;
            }
        }

        return visible || { approved: false, pending: false, rejected: false, status: 'not_applied', label: 'Not Applied' };
    }

    function dashboardRoot() {
        return document.querySelector('#universe-hub-view') ||
            document.querySelector('.universe-hub-view') ||
            document.querySelector('.dashboard-main') ||
            document.querySelector('.dashboard-content') ||
            document.querySelector('main') ||
            document.body;
    }

    function ensureMount() {
        let mount = document.getElementById('yh-dashboard-v2-parent-shell');

        if (mount) return mount;

        mount = document.createElement('section');
        mount.id = 'yh-dashboard-v2-parent-shell';
        mount.className = 'yh-dashboard-v2-parent-shell hidden-step';
        mount.setAttribute('aria-hidden', 'true');

        const oldIntro = document.getElementById('yh-dashboard-division-parent-intro-v1');
        if (oldIntro && oldIntro.parentNode) {
            oldIntro.parentNode.insertBefore(mount, oldIntro);
            return mount;
        }

        const root = dashboardRoot();
        const firstContent = root.querySelector?.('.yh-command-dashboard-head, #yh-dashboard-overview-dynamic-access-row-v1, #yh-universe-referral-card, #yh-universe-academy-strip');

        if (firstContent && firstContent.parentNode) {
            firstContent.parentNode.insertBefore(mount, firstContent);
        } else {
            root.appendChild(mount);
        }

        return mount;
    }

    function hideLegacyParentSurfaces() {
        LEGACY_PARENT_SURFACE_SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
                if (selector === '#yh-universe-feature-kicker') {
                    const panel = node.closest('.yh-universe-feature-panel, article, section, div');
                    setVisible(panel || node, false, 'block');
                    return;
                }

                setVisible(node, false, 'block');
            });
        });

        const oldIntro = document.getElementById('yh-dashboard-division-parent-intro-v1');
        if (oldIntro) setVisible(oldIntro, false, 'block');
    }

    function setSubnavState(key, open, approved) {
        const config = DIVISIONS[key];
        if (!config) return;

        const subnav = document.getElementById(config.subnavId);
        const parent = document.querySelector(config.parentSelector);

        if (parent) {
            parent.classList.toggle('is-active', open);
            parent.classList.toggle('active', open);
            parent.setAttribute('aria-expanded', open && approved ? 'true' : 'false');
        }

        if (subnav) {
            subnav.classList.toggle('yh-dashboard-v2-gated-subnav', !approved);
            setVisible(subnav, open && approved, 'block');
        }

        document.querySelectorAll(config.childSelector).forEach((child) => {
            child.classList.toggle('yh-dashboard-v2-gated-child', !approved);
            setVisible(child, open && approved, child.tagName === 'BUTTON' ? 'block' : '');
        });
    }

    function closeOtherSubnavs(activeKey) {
        Object.keys(DIVISIONS).forEach((key) => {
            if (key === activeKey) return;
            setSubnavState(key, false, false);
        });
    }

    function openApplication(key) {
        const config = DIVISIONS[key];
        if (!config) return;

        for (const fnName of config.applyFns) {
            try {
                if (typeof window[fnName] === 'function') {
                    window[fnName]();
                    return;
                }
            } catch (_) {}
        }

        const fallback = document.querySelector(`[data-yh-overview-division-action="${key}"], [data-yh-open-${key}-apply]`);
        if (fallback) {
            fallback.click();
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`${config.label} application form is not available yet.`, 'error');
        }
    }

    function openChildWorkspace(key) {
        const config = DIVISIONS[key];
        if (!config) return;

        if (typeof window.activateDashboardUnifiedWorkspace === 'function') {
            window.activateDashboardUnifiedWorkspace(config.defaultChild, {
                animate: false,
                scroll: true,
                persist: true
            });
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`${config.label} workspace is still loading.`, 'error');
        }
    }

    function renderParent(key) {
        const config = DIVISIONS[key];
        if (!config || !isDashboardPage()) return;

        const state = getDivisionState(key);
        const approved = state.approved === true;

        document.body.setAttribute('data-yh-dashboard-v2-active', key);
        document.body.setAttribute('data-yh-unified-workspace', key);
        document.body.setAttribute('data-yh-unified-division', key);
        document.body.setAttribute('data-yh-dashboard-v2-approved', approved ? 'true' : 'false');
        document.body.setAttribute('data-yh-dashboard-v2-status', approved ? 'approved' : state.pending ? 'pending' : state.rejected ? 'rejected' : 'not-applied');

        closeOtherSubnavs(key);
        setSubnavState(key, true, approved);
        hideLegacyParentSurfaces();

        const mount = ensureMount();
        const ctaText = approved ? `${config.approvedLabel} →` : state.pending ? state.label || config.pendingLabel : `${config.applyLabel} →`;
        const ctaDisabled = state.pending ? ' disabled aria-disabled="true"' : '';
        const statusLabel = approved ? 'Approved Access' : state.pending ? 'Under Review' : state.rejected ? 'Rejected' : 'Application Required';

        mount.innerHTML = `
            <div class="yh-dashboard-v2-intro-card" data-yh-dashboard-v2-division="${key}">
                <div class="yh-dashboard-v2-intro-main">
                    <span class="yh-dashboard-v2-eyebrow">${config.eyebrow}</span>
                    <h1>${config.title}</h1>
                    <h2>${config.subtitle}</h2>
                    <p>${config.copy}</p>

                    <div class="yh-dashboard-v2-action-row">
                        <button type="button" class="yh-dashboard-v2-primary" data-yh-dashboard-v2-action="${key}"${ctaDisabled}>${ctaText}</button>
                        <span class="yh-dashboard-v2-status-pill is-${approved ? 'approved' : state.pending ? 'pending' : state.rejected ? 'rejected' : 'locked'}">${statusLabel}</span>
                    </div>
                </div>

                <aside class="yh-dashboard-v2-signal-card">
                    <div class="yh-dashboard-v2-orb" aria-hidden="true">
                        <img src="/images/logo.avif" alt="">
                    </div>
                    <span>${config.signalTitle}</span>
                    <strong>${config.signalCopy}</strong>
                </aside>
            </div>

            <div class="yh-dashboard-v2-child-grid" data-yh-dashboard-v2-children="${approved ? 'unlocked' : 'locked'}">
                ${approved ? config.children.map(([title, copy, target]) => `
                    <button type="button" class="yh-dashboard-v2-child-card" data-yh-dashboard-v2-child="${target}">
                        <span>${title}</span>
                        <strong>${copy}</strong>
                    </button>
                `).join('') : `
                    <div class="yh-dashboard-v2-locked-card">
                        <span>${config.label} sections are locked</span>
                        <strong>Apply first. Child tabs will appear after admin approval.</strong>
                    </div>
                `}
            </div>
        `;

        setVisible(mount, true, 'block');

        const overviewNodes = [
            document.querySelector('.yh-command-dashboard-head'),
            document.getElementById('yh-dashboard-overview-dynamic-access-row-v1'),
            document.getElementById('yh-universe-referral-card'),
            document.getElementById('yh-universe-academy-strip')
        ];

        overviewNodes.forEach((node) => setVisible(node, false, 'block'));
    }

    function renderOverviewSafety() {
        const key = normalizeKey(document.body.getAttribute('data-yh-dashboard-v2-active'));
        if (!key) {
            const mount = document.getElementById('yh-dashboard-v2-parent-shell');
            if (mount) setVisible(mount, false, 'block');
        }
    }

    document.addEventListener('click', (event) => {
        const parent = event.target?.closest?.('[data-yh-dashboard-shell]');
        const key = normalizeKey(parent?.getAttribute?.('data-yh-dashboard-shell'));

        if (!key) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        renderParent(key);

        window.requestAnimationFrame?.(() => renderParent(key));
        [60, 180, 420].forEach((delay) => window.setTimeout(() => renderParent(key), delay));
    }, true);

    document.addEventListener('click', (event) => {
        const action = event.target?.closest?.('[data-yh-dashboard-v2-action]');
        if (!action) return;

        const key = normalizeKey(action.getAttribute('data-yh-dashboard-v2-action'));
        if (!key) return;

        event.preventDefault();
        event.stopPropagation();

        const state = getDivisionState(key);

        if (state.approved) {
            openChildWorkspace(key);
            return;
        }

        if (state.pending) {
            if (typeof window.showToast === 'function') {
                window.showToast(`${DIVISIONS[key].label} application is still under review.`, 'error');
            }
            return;
        }

        openApplication(key);
    }, true);

    document.addEventListener('click', (event) => {
        const child = event.target?.closest?.('[data-yh-dashboard-v2-child]');
        if (!child) return;

        const target = String(child.getAttribute('data-yh-dashboard-v2-child') || '').trim();
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();

        if (typeof window.activateDashboardUnifiedWorkspace === 'function') {
            window.activateDashboardUnifiedWorkspace(target, {
                animate: false,
                scroll: true,
                persist: true
            });
        }
    }, true);

    document.addEventListener('click', (event) => {
        const dashboardButton = event.target?.closest?.('[data-yh-dashboard-shell="overview"], #nav-dashboard, #btn-dashboard-overview');
        if (!dashboardButton) return;

        document.body.removeAttribute('data-yh-dashboard-v2-active');
        document.body.removeAttribute('data-yh-dashboard-v2-approved');
        document.body.removeAttribute('data-yh-dashboard-v2-status');

        const mount = document.getElementById('yh-dashboard-v2-parent-shell');
        if (mount) setVisible(mount, false, 'block');

        Object.keys(DIVISIONS).forEach((key) => setSubnavState(key, false, false));

        window.setTimeout(renderOverviewSafety, 80);
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderOverviewSafety);
    } else {
        renderOverviewSafety();
    }

    window.yhDashboardV2RenderParent = renderParent;
    window.yhDashboardV2OpenApplication = openApplication;
})();


/* PATCH: Dashboard V2 stable shell owner v1 */
(function installDashboardV2StableShellOwnerV1() {
    if (window.__yhDashboardV2StableShellOwnerV1Installed) return;
    window.__yhDashboardV2StableShellOwnerV1Installed = true;

    const PARENTS = new Set(['academy', 'plazas', 'federation']);

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function normalizeKey(value = '') {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'plaza') return 'plazas';
        return key;
    }

    function isParentKey(value = '') {
        return PARENTS.has(normalizeKey(value));
    }

    function setVisible(node, visible, display = '') {
        if (!node || !(node instanceof HTMLElement)) return;

        node.classList.toggle('hidden-step', !visible);
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.removeProperty('display');
            if (display) node.style.display = display;
            node.style.removeProperty('visibility');
            node.style.removeProperty('opacity');
            node.style.removeProperty('pointer-events');
            return;
        }

        node.style.display = 'none';
        node.style.visibility = 'hidden';
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
    }

    function hideAll(selectors) {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => setVisible(node, false, 'block'));
        });
    }

    function showOne(selector, display = 'block') {
        setVisible(document.querySelector(selector), true, display);
    }

    function clearV2ParentAttrs() {
        document.body?.removeAttribute('data-yh-dashboard-v2-active');
        document.body?.removeAttribute('data-yh-dashboard-v2-approved');
        document.body?.removeAttribute('data-yh-dashboard-v2-status');
        document.body?.removeAttribute('data-yh-dashboard-v2-lock');
        document.body?.removeAttribute('data-yh-dashboard-v2-instant-parent');
    }

    function hideLegacyDivisionSurfaces() {
        hideAll([
            '#yh-command-overview-grid',
            '#yh-universe-carousel',
            '#yh-universe-plaza-strip',
            '#yh-universe-federation-strip',
            '.yh-universe-carousel-column',
            '#yh-dashboard-division-parent-intro-v1',
            '.yh-dashboard-division-intro-v1',
            '.yh-dashboard-division-intro-hero-v1',
            '.yh-dashboard-division-child-grid-v1',
            '.yh-academy-parent-hero-header',
            '.yh-academy-parent-vision-scope',
            '.yh-universe-command-hero',
            '.yh-universe-stage-nav',
            '.yh-universe-dots',
            '#yh-universe-progress-rail',
            '#yh-econ-bridge-card'
        ]);
    }

    function hideOverviewSurfaces() {
        hideAll([
            '.yh-command-dashboard-head',
            '#yh-dashboard-overview-dynamic-access-row-v1',
            '#yh-universe-referral-card',
            '#yh-universe-academy-strip',
            '#yh-command-overview-grid',
            '#yh-universe-carousel',
            '#yh-universe-plaza-strip',
            '#yh-universe-federation-strip',
            '.yh-universe-carousel-column',
            '#yh-dashboard-division-parent-intro-v1',
            '.yh-dashboard-division-intro-v1',
            '.yh-dashboard-division-intro-hero-v1',
            '.yh-dashboard-division-child-grid-v1',
            '.yh-academy-parent-hero-header',
            '.yh-academy-parent-vision-scope',
            '.yh-universe-command-hero',
            '.yh-universe-stage-nav',
            '.yh-universe-dots',
            '#yh-universe-progress-rail',
            '#yh-econ-bridge-card'
        ]);
    }

    function setSidebarParentActive(key = 'overview') {
        document.querySelectorAll('[data-yh-dashboard-shell]').forEach((button) => {
            const buttonKey = normalizeKey(button.getAttribute('data-yh-dashboard-shell') || '');
            const active = buttonKey === key;

            button.classList.toggle('active', active);
            button.classList.toggle('is-active', active);

            if (buttonKey && buttonKey !== 'overview') {
                button.setAttribute('aria-expanded', active ? 'true' : 'false');
            }
        });
    }

    function closeAllSubnavs() {
        ['academy', 'plazas', 'federation'].forEach((key) => {
            const subnav = document.getElementById(`yh-sidebar-subnav-${key}`);
            if (subnav) setVisible(subnav, false, 'block');
        });
    }

    function showOverviewShell(reason = 'overview') {
        if (!isDashboardPage()) return;

        clearV2ParentAttrs();

        document.body?.setAttribute('data-yh-unified-workspace', 'overview');
        document.body?.setAttribute('data-yh-unified-division', 'overview');
        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');

        const mount = document.getElementById('yh-dashboard-v2-parent-shell');
        setVisible(mount, false, 'block');

        setSidebarParentActive('overview');
        closeAllSubnavs();

        showOne('.yh-command-dashboard-head', 'grid');
        showOne('#yh-dashboard-overview-dynamic-access-row-v1', 'grid');
        showOne('#yh-universe-referral-card', 'block');
        showOne('#yh-universe-academy-strip', 'block');

        const live = document.getElementById('yh-universe-academy-strip');
        if (live) live.classList.add('is-active');

        hideLegacyDivisionSurfaces();

        const referral = document.getElementById('yh-universe-referral-card');
        if (referral && live && referral.nextElementSibling !== live) {
            live.parentNode?.insertBefore(referral, live);
        }
    }

    function showParentShell(key = 'academy', reason = 'parent') {
        if (!isDashboardPage()) return;

        const clean = normalizeKey(key);
        if (!isParentKey(clean)) return;

        document.body?.setAttribute('data-yh-dashboard-v2-active', clean);
        document.body?.setAttribute('data-yh-dashboard-v2-lock', clean);
        document.body?.removeAttribute('data-yh-dashboard-v2-instant-parent');
        document.body?.setAttribute('data-yh-unified-workspace', clean);
        document.body?.setAttribute('data-yh-unified-division', clean);
        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');

        setSidebarParentActive(clean);

        /*
          Render first so the stage is never empty.
          The foundation render function owns copy, CTA, access gate, and child-card state.
        */
        if (typeof window.yhDashboardV2RenderParent === 'function') {
            try {
                window.yhDashboardV2RenderParent(clean);
            } catch (error) {
                console.error('Dashboard V2 stable parent render failed:', error);
            }
        }

        const mount = document.getElementById('yh-dashboard-v2-parent-shell');
        setVisible(mount, true, 'block');

        hideOverviewSurfaces();
    }

    function getShellKeyFromTarget(target) {
        const button = target && target.closest ? target.closest('[data-yh-dashboard-shell]') : null;
        if (!button) return '';
        return normalizeKey(button.getAttribute('data-yh-dashboard-shell') || '');
    }

    function interceptShellNavigation(event) {
        const key = getShellKeyFromTarget(event.target);
        if (!key) return;

        /*
          Window capture runs before document-level legacy dashboard listeners.
          This is the important part: the old parent renderer no longer gets the final word.
        */
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();

        if (key === 'overview') {
            if (typeof window.__yhDashboardV2NativeActivateWorkspaceV1 === 'function') {
                try {
                    window.__yhDashboardV2NativeActivateWorkspaceV1('overview', {
                        animate: false,
                        scroll: false,
                        persist: true
                    });
                } catch (_) {}
            }

            showOverviewShell('shell-click');
            [40, 120, 260, 520].forEach((delay) => {
                window.setTimeout(() => showOverviewShell('shell-click-' + delay), delay);
            });
            return;
        }

        if (isParentKey(key)) {
            showParentShell(key, 'shell-click');
            [40, 120, 260, 520].forEach((delay) => {
                window.setTimeout(() => showParentShell(key, 'shell-click-' + delay), delay);
            });
        }
    }

    /*
      Save the original activate function once.
      Parent divisions are handled by V2; approved child workspaces still go through old dashboard.js.
    */
    if (
        typeof window.activateDashboardUnifiedWorkspace === 'function' &&
        window.activateDashboardUnifiedWorkspace.__yhDashboardV2StableShellWrappedV1 !== true
    ) {
        const nativeActivate = window.activateDashboardUnifiedWorkspace;
        window.__yhDashboardV2NativeActivateWorkspaceV1 = nativeActivate;

        const wrappedActivate = function activateDashboardUnifiedWorkspaceStableShellV1(key = 'overview', options = {}) {
            const clean = normalizeKey(key);

            if (clean === 'overview' || clean === 'dashboard' || clean === 'hub' || !clean) {
                const result = nativeActivate.call(this, 'overview', options);
                window.setTimeout(() => showOverviewShell('activate-overview'), 0);
                window.setTimeout(() => showOverviewShell('activate-overview-late'), 120);
                return result;
            }

            if (isParentKey(clean)) {
                showParentShell(clean, 'activate-parent');
                return { key: clean, division: clean, source: 'dashboard-v2-stable-shell' };
            }

            /*
              Child workspace: let old dashboard.js render it.
              Remove V2 parent lock so child tabs can display real workspace content.
            */
            clearV2ParentAttrs();

            const mount = document.getElementById('yh-dashboard-v2-parent-shell');
            setVisible(mount, false, 'block');

            return nativeActivate.apply(this, arguments);
        };

        wrappedActivate.__yhDashboardV2StableShellWrappedV1 = true;
        window.activateDashboardUnifiedWorkspace = wrappedActivate;
    }

    /*
      Also stop old safe overview from becoming the final owner after async profile refresh.
    */
    if (
        typeof window.safeRenderDashboardCommandOverview === 'function' &&
        window.safeRenderDashboardCommandOverview.__yhDashboardV2StableShellWrappedV1 !== true
    ) {
        const nativeOverview = window.safeRenderDashboardCommandOverview;

        const wrappedOverview = function safeRenderDashboardCommandOverviewStableShellV1(reason = 'legacy') {
            const result = nativeOverview.apply(this, arguments);

            const active = normalizeKey(document.body?.getAttribute('data-yh-dashboard-v2-active') || '');
            if (!active) {
                window.setTimeout(() => showOverviewShell('safe-overview'), 0);
                window.setTimeout(() => showOverviewShell('safe-overview-late'), 120);
            }

            return result;
        };

        wrappedOverview.__yhDashboardV2StableShellWrappedV1 = true;
        window.safeRenderDashboardCommandOverview = wrappedOverview;
    }

    /* Dashboard loader gate v2 owns tab navigation now. Stable shell instant interceptors disabled. */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.setTimeout(() => showOverviewShell('dom'), 80);
            window.setTimeout(() => showOverviewShell('dom-late'), 260);
        });
    } else {
        window.setTimeout(() => showOverviewShell('boot'), 80);
        window.setTimeout(() => showOverviewShell('boot-late'), 260);
    }

    window.yhDashboardV2ShowOverviewShellV1 = showOverviewShell;
    window.yhDashboardV2ShowParentShellV1 = showParentShell;
})();
/* END PATCH: Dashboard V2 stable shell owner v1 */
/* PATCH: Dashboard V2 overview polish v1 */
(function installDashboardV2OverviewPolishV1() {
    if (window.__yhDashboardV2OverviewPolishV1Installed) return;
    window.__yhDashboardV2OverviewPolishV1Installed = true;

    let profileFetchStarted = false;

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function normalizeName(value = '') {
        const clean = String(value || '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!clean) return '';

        const lower = clean.toLowerCase();

        if (
            lower === 'hustler' ||
            lower === 'guest' ||
            lower === 'username not set' ||
            lower === 'user' ||
            lower === 'member' ||
            lower === 'profile'
        ) {
            return '';
        }

        if (clean.includes('@')) {
            const local = clean.split('@')[0].replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
            return local && local.toLowerCase() !== 'hustler' ? local : '';
        }

        return clean;
    }

    function readJsonFromStorage(key = '') {
        const cleanKey = String(key || '').trim();
        if (!cleanKey) return null;

        const stores = [localStorage, sessionStorage];

        for (const store of stores) {
            try {
                const raw = store.getItem(cleanKey);
                if (!raw) continue;

                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (_) {}
        }

        return null;
    }

    function pickNameFromObject(obj = {}) {
        if (!obj || typeof obj !== 'object') return '';

        const nestedUser = obj.user && typeof obj.user === 'object' ? obj.user : null;
        const nestedProfile = obj.profile && typeof obj.profile === 'object' ? obj.profile : null;

        const candidates = [
            obj.display_name,
            obj.displayName,
            obj.fullName,
            obj.full_name,
            obj.name,
            obj.firstName && obj.lastName ? `${obj.firstName} ${obj.lastName}` : '',
            obj.first_name && obj.last_name ? `${obj.first_name} ${obj.last_name}` : '',
            nestedProfile ? pickNameFromObject(nestedProfile) : '',
            nestedUser ? pickNameFromObject(nestedUser) : '',
            obj.username,
            obj.userName,
            obj.handle,
            obj.email
        ];

        for (const value of candidates) {
            const clean = normalizeName(value);
            if (clean) return clean;
        }

        return '';
    }

    function resolveDashboardDisplayName() {
        const storageStringKeys = [
            'yh_user_display_name',
            'yh_user_full_name',
            'yh_user_name',
            'yh_user_username',
            'yh_user_email'
        ];

        for (const key of storageStringKeys) {
            try {
                const clean = normalizeName(localStorage.getItem(key) || sessionStorage.getItem(key) || '');
                if (clean) return clean;
            } catch (_) {}
        }

        const storageObjectKeys = [
            'yh_academy_profile_cache_v1',
            'yh_dashboard_self_profile_cache_v1',
            'yh_user_profile_cache_v1',
            'yh_current_user',
            'yh_user',
            'currentUser',
            'user'
        ];

        for (const key of storageObjectKeys) {
            const clean = pickNameFromObject(readJsonFromStorage(key));
            if (clean) return clean;
        }

        const domCandidates = [
            document.getElementById('top-nav-name')?.textContent,
            document.querySelector('[data-yh-profile-name]')?.textContent,
            document.querySelector('.yh-profile-name')?.textContent
        ];

        for (const value of domCandidates) {
            const clean = normalizeName(value);
            if (clean) return clean;
        }

        return '';
    }

    function applyDashboardDisplayName(name = '') {
        const clean = normalizeName(name) || resolveDashboardDisplayName();
        if (!clean) return false;

        const nameNodes = [
            document.getElementById('yh-command-profile-name'),
            document.getElementById('top-nav-name')
        ].filter(Boolean);

        nameNodes.forEach((node) => {
            node.textContent = clean;
        });

        try {
            localStorage.setItem('yh_user_name', clean);
            localStorage.setItem('yh_user_display_name', clean);
            localStorage.setItem('yh_user_full_name', clean);
        } catch (_) {}

        return true;
    }

    async function fetchDashboardDisplayNameOnce() {
        if (profileFetchStarted || !isDashboardPage()) return;
        profileFetchStarted = true;

        const token = (() => {
            try {
                return String(window.YHSharedCore?.getStoredAuthToken?.() || '').trim();
            } catch (_) {
                return '';
            }
        })();

        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const endpoints = [
            '/api/universe/profile',
            '/api/academy/profile'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    credentials: 'include',
                    headers
                });

                if (!response.ok) continue;

                const result = await response.json().catch(() => ({}));
                const profile = result?.profile && typeof result.profile === 'object'
                    ? result.profile
                    : result;

                const name = pickNameFromObject(profile);
                if (!name) continue;

                try {
                    const cached = readJsonFromStorage('yh_academy_profile_cache_v1') || {};
                    localStorage.setItem('yh_academy_profile_cache_v1', JSON.stringify({
                        ...cached,
                        ...profile,
                        display_name: name,
                        displayName: name,
                        fullName: profile.fullName || profile.full_name || name,
                        updatedAt: new Date().toISOString()
                    }));
                } catch (_) {}

                applyDashboardDisplayName(name);
                return;
            } catch (_) {}
        }
    }

    function syncDashboardDisplayName(reason = 'sync') {
        if (!isDashboardPage()) return;

        const currentNode = document.getElementById('yh-command-profile-name');
        const current = normalizeName(currentNode?.textContent || '');

        if (current) return;

        const resolved = resolveDashboardDisplayName();

        if (resolved) {
            applyDashboardDisplayName(resolved);
            return;
        }

        fetchDashboardDisplayNameOnce();
    }

    function compactDashboardOverviewLayout() {
        if (!isDashboardPage()) return;

        const workspace = String(document.body?.getAttribute('data-yh-unified-workspace') || 'overview').trim().toLowerCase();
        const activeParent = String(document.body?.getAttribute('data-yh-dashboard-v2-active') || '').trim();

        if (workspace !== 'overview' || activeParent) return;

        const row = document.getElementById('yh-dashboard-overview-dynamic-access-row-v1');
        const referral = document.getElementById('yh-universe-referral-card');
        const live = document.getElementById('yh-universe-academy-strip');

        if (row && referral && row.nextElementSibling !== referral) {
            row.parentNode?.insertBefore(referral, row.nextSibling);
        }

        if (referral && live && referral.nextElementSibling !== live) {
            referral.parentNode?.insertBefore(live, referral.nextSibling);
        }

        if (row) {
            row.style.marginBottom = 'clamp(14px, 1.4vw, 22px)';
        }

        if (referral) {
            referral.style.marginTop = '0';
            referral.style.marginBottom = 'clamp(16px, 1.6vw, 24px)';
        }
    }

    function closeDashboardTabLoaderIfOpen() {
        try {
            window.yhDashboardV2LoaderGateAuthorityV2?.hideLoader?.();
        } catch (_) {}

        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        document.querySelectorAll('#yh-dashboard-tab-transition-loader-v1, #yh-dashboard-tab-transition-loader-v2').forEach((loader) => {
            loader.classList.remove('is-active');
            loader.classList.add('hidden-step');
            loader.setAttribute('aria-hidden', 'true');
        });
    }

    function openDivisionApplicationModal(division = '') {
        const clean = String(division || '').trim().toLowerCase();

        closeDashboardTabLoaderIfOpen();

        if (clean === 'academy') {
            if (typeof window.openAcademyLauncher === 'function') {
                window.openAcademyLauncher();
                return true;
            }

            if (typeof window.handleAcademyLaunchClick === 'function') {
                Promise.resolve(window.handleAcademyLaunchClick(null)).catch(() => {});
                return true;
            }

            if (typeof window.openDashboardUnifiedWorkspaceLaunch === 'function') {
                Promise.resolve(window.openDashboardUnifiedWorkspaceLaunch('academy-roadmap')).catch(() => {});
                return true;
            }
        }

        if (clean === 'plazas') {
            if (typeof window.openPlazaApplicationModal === 'function') {
                Promise.resolve(window.openPlazaApplicationModal()).catch((error) => {
                    console.error('openPlazaApplicationModal error:', error);
                });
                return true;
            }

            if (typeof window.openDashboardUnifiedWorkspaceLaunch === 'function') {
                Promise.resolve(window.openDashboardUnifiedWorkspaceLaunch('plazas-feed')).catch(() => {});
                return true;
            }
        }

        if (clean === 'federation') {
            if (typeof window.openFederationApplicationModal === 'function') {
                Promise.resolve(window.openFederationApplicationModal()).catch((error) => {
                    console.error('openFederationApplicationModal error:', error);
                });
                return true;
            }

            if (typeof window.openDashboardUnifiedWorkspaceLaunch === 'function') {
                Promise.resolve(window.openDashboardUnifiedWorkspaceLaunch('federation-command')).catch(() => {});
                return true;
            }
        }

        if (typeof window.showToast === 'function') {
            window.showToast('Application form is not ready yet. Please refresh and try again.', 'error');
        }

        return false;
    }

    function interceptOverviewApplyButtons(event) {
        if (!isDashboardPage()) return;

        const button = event.target?.closest?.('[data-yh-overview-division-action]');
        if (!button) return;

        const kind = String(button.getAttribute('data-yh-overview-division-action-kind') || '').trim().toLowerCase();
        const division = String(button.getAttribute('data-yh-overview-division-action') || '').trim().toLowerCase();

        if (kind !== 'apply') return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        openDivisionApplicationModal(division);
    }

    window.addEventListener('click', interceptOverviewApplyButtons, true);
    window.addEventListener('pointerdown', (event) => {
        const button = event.target?.closest?.('[data-yh-overview-division-action]');
        if (!button) return;

        const kind = String(button.getAttribute('data-yh-overview-division-action-kind') || '').trim().toLowerCase();
        if (kind !== 'apply') return;

        /*
          Prevent the loader gate from treating apply as navigation.
          Actual modal opening stays on click so keyboard activation still works.
        */
        event.stopPropagation();
    }, true);

    function syncAll(reason = 'sync') {
        syncDashboardDisplayName(reason);
        compactDashboardOverviewLayout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => syncAll('dom'));
    } else {
        syncAll('boot');
    }

    [40, 120, 300, 700, 1400, 2400, 4200].forEach((delay) => {
        window.setTimeout(() => syncAll('timer-' + delay), delay);
    });

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardOverviewPolishTimerV1);
            window.__yhDashboardOverviewPolishTimerV1 = window.setTimeout(() => {
                syncAll('mutation');
            }, 70);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'class',
                'style',
                'data-yh-unified-workspace',
                'data-yh-dashboard-v2-active'
            ]
        });

        window.__yhDashboardOverviewPolishObserverV1 = observer;
    } catch (_) {}

    window.yhDashboardV2OverviewPolishV1 = {
        sync: syncAll,
        applyName: applyDashboardDisplayName,
        openDivisionApplicationModal,
        compactLayout: compactDashboardOverviewLayout
    };
})();
/* END PATCH: Dashboard V2 overview polish v1 */


/* PATCH: Dashboard overview boot guard v1 */
(function installDashboardOverviewBootGuardV1() {
    if (window.__yhDashboardOverviewBootGuardV1Installed) return;
    window.__yhDashboardOverviewBootGuardV1Installed = true;

    const CHILD_PREFIXES = ['academy-', 'plazas-', 'federation-'];
    const PARENT_KEYS = new Set(['academy', 'plazas', 'federation']);

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function hasExplicitChildIntent() {
        const params = new URLSearchParams(window.location.search || '');
        const raw = String(
            params.get('workspace') ||
            params.get('section') ||
            params.get('tab') ||
            params.get('view') ||
            ''
        ).trim().toLowerCase();

        if (!raw) return false;

        return CHILD_PREFIXES.some((prefix) => raw.startsWith(prefix)) ||
            ['roadmap', 'missions', 'community', 'messages', 'voice', 'feed', 'command', 'connect'].includes(raw);
    }

    function isChildKey(value = '') {
        const clean = String(value || '').trim().toLowerCase();
        return CHILD_PREFIXES.some((prefix) => clean.startsWith(prefix));
    }

    function setVisible(node, visible, display = '') {
        if (!node || !(node instanceof HTMLElement)) return;

        node.classList.toggle('hidden-step', !visible);
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.removeProperty('display');
            if (display) node.style.display = display;
            node.style.removeProperty('visibility');
            node.style.removeProperty('opacity');
            node.style.removeProperty('pointer-events');
            return;
        }

        node.style.display = 'none';
        node.style.visibility = 'hidden';
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
    }

    function clearStaleChildWorkspaceStorage() {
        const keys = [
            'yh_dashboard_view_state_v1',
            'yh_universe_view_state_v1',
            'yh_dashboard_unified_workspace_v1',
            'yh_dashboard_workspace_v1',
            'yh_dashboard_last_workspace_v1'
        ];

        [localStorage, sessionStorage].forEach((store) => {
            keys.forEach((key) => {
                try {
                    const raw = String(store.getItem(key) || '');
                    if (!raw) return;

                    const lower = raw.toLowerCase();
                    const hasChild =
                        lower.includes('academy-roadmap') ||
                        lower.includes('academy-missions') ||
                        lower.includes('academy-community') ||
                        lower.includes('academy-messages') ||
                        lower.includes('academy-voice') ||
                        lower.includes('plazas-') ||
                        lower.includes('federation-');

                    if (hasChild) store.removeItem(key);
                } catch (_) {}
            });
        });
    }

    function closeDivisionSubnavs() {
        ['academy', 'plazas', 'federation'].forEach((division) => {
            const parentButton = document.querySelector(`[data-yh-dashboard-shell="${division}"]`);
            const subnav = document.getElementById(`yh-sidebar-subnav-${division}`);
            const group = document.querySelector(`[data-yh-sidebar-division="${division}"]`);

            if (parentButton) {
                parentButton.classList.remove('active', 'is-active');
                parentButton.setAttribute('aria-expanded', 'false');
            }

            if (group) {
                group.classList.remove('is-open', 'is-active', 'active');
                group.setAttribute('data-yh-sidebar-collapsed', 'true');
            }

            setVisible(subnav, false, 'block');
        });

        document.querySelectorAll('[data-yh-sidebar-child], [data-yh-mobile-subtab-menu-option]').forEach((node) => {
            node.classList.remove('active', 'is-active');
            node.setAttribute('aria-selected', 'false');
        });

        const dashboardButton = document.querySelector('[data-yh-dashboard-shell="overview"]');
        if (dashboardButton) {
            dashboardButton.classList.add('active', 'is-active');
            dashboardButton.setAttribute('aria-selected', 'true');
        }
    }

    function hideWorkspaceLauncher() {
        const card = document.getElementById('yh-universe-workspace-launch-card');
        const button = document.getElementById('yh-universe-workspace-launch-btn');
        const frameShell = document.getElementById('yh-universe-workspace-frame-shell');
        const inlineHost = document.getElementById('yh-universe-workspace-inline-host');
        const frame = document.getElementById('yh-universe-workspace-inline-frame');

        setVisible(card, false, 'block');
        setVisible(frameShell, false, 'block');
        setVisible(inlineHost, false, 'block');

        if (button) button.removeAttribute('data-yh-launch-workspace-key');

        if (frame) {
            frame.removeAttribute('src');
            frame.removeAttribute('data-yh-dashboard-workspace-key');
        }
    }

    function showOverviewPieces() {
        const mount = document.getElementById('yh-dashboard-v2-parent-shell');

        setVisible(mount, false, 'block');
        setVisible(document.querySelector('.yh-command-dashboard-head'), true, 'grid');
        setVisible(document.getElementById('yh-dashboard-overview-dynamic-access-row-v1'), true, 'grid');
        setVisible(document.getElementById('yh-universe-referral-card'), true, 'block');
        setVisible(document.getElementById('yh-universe-academy-strip'), true, 'block');

        [
            '#yh-dashboard-division-parent-intro-v1',
            '.yh-dashboard-division-intro-v1',
            '.yh-dashboard-division-intro-hero-v1',
            '.yh-dashboard-division-child-grid-v1',
            '.yh-academy-parent-hero-header',
            '.yh-academy-parent-vision-scope',
            '.yh-universe-command-hero',
            '.yh-universe-stage-nav',
            '.yh-universe-dots',
            '#yh-universe-progress-rail',
            '#yh-econ-bridge-card',
            '#yh-command-overview-grid',
            '#yh-universe-carousel',
            '#yh-universe-plaza-strip',
            '#yh-universe-federation-strip',
            '.yh-universe-carousel-column'
        ].forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => setVisible(node, false, 'block'));
        });

        const referral = document.getElementById('yh-universe-referral-card');
        const live = document.getElementById('yh-universe-academy-strip');

        if (referral && live && referral.nextElementSibling !== live) {
            referral.parentNode?.insertBefore(live, referral.nextSibling);
        }
    }

    function forceDashboardOverview(reason = 'overview-boot') {
        if (!isDashboardPage()) return;

        const current = String(document.body?.getAttribute('data-yh-unified-workspace') || '').trim().toLowerCase();

        if (hasExplicitChildIntent()) return;

        /*
          Cancel pending old async child callbacks from activateDashboardUnifiedWorkspace().
          This is important because old dashboard.js schedules child launcher restore after 90ms and 420ms.
        */
        window.__yhDashboardWorkspaceActivationSeq = Number(window.__yhDashboardWorkspaceActivationSeq || 0) + 1;

        clearStaleChildWorkspaceStorage();

        document.body?.removeAttribute('data-yh-dashboard-v2-active');
        document.body?.removeAttribute('data-yh-dashboard-v2-approved');
        document.body?.removeAttribute('data-yh-dashboard-v2-status');
        document.body?.removeAttribute('data-yh-dashboard-v2-lock');
        document.body?.removeAttribute('data-yh-dashboard-v2-instant-parent');
        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');

        document.body?.setAttribute('data-yh-unified-workspace', 'overview');
        document.body?.setAttribute('data-yh-unified-division', 'overview');
        document.body?.setAttribute('data-yh-dashboard-overview-guard', 'active');

        closeDivisionSubnavs();
        hideWorkspaceLauncher();
        showOverviewPieces();

        if (typeof window.yhDashboardV2ShowOverviewShellV1 === 'function') {
            try {
                window.yhDashboardV2ShowOverviewShellV1(reason);
            } catch (_) {}
        }
    }

    /*
      Run after old boot restore has had a chance to run, then repeat to beat its delayed 90ms/420ms child callbacks.
    */
    function scheduleOverviewGuard(reason = 'boot') {
        if (!isDashboardPage() || hasExplicitChildIntent()) return;

        [0, 30, 90, 180, 430, 760, 1200, 2200].forEach((delay) => {
            window.setTimeout(() => forceDashboardOverview(`${reason}-${delay}`), delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scheduleOverviewGuard('dom'));
    } else {
        scheduleOverviewGuard('boot');
    }

    window.addEventListener('pageshow', () => scheduleOverviewGuard('pageshow'));

    /*
      If any old renderer tries to put academy-roadmap back while body is overview, remove it immediately.
    */
    try {
        const observer = new MutationObserver(() => {
            if (!isDashboardPage() || hasExplicitChildIntent()) return;

            const workspace = String(document.body?.getAttribute('data-yh-unified-workspace') || '').trim().toLowerCase();
            const selectedDashboard = Boolean(document.querySelector('[data-yh-dashboard-shell="overview"].active, [data-yh-dashboard-shell="overview"].is-active'));

            if (workspace === 'overview' || selectedDashboard) {
                window.clearTimeout(window.__yhDashboardOverviewBootGuardTimerV1);
                window.__yhDashboardOverviewBootGuardTimerV1 = window.setTimeout(() => forceDashboardOverview('mutation'), 35);
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'class',
                'style',
                'aria-hidden',
                'data-yh-unified-workspace',
                'data-yh-dashboard-v2-active'
            ]
        });

        window.__yhDashboardOverviewBootGuardObserverV1 = observer;
    } catch (_) {}

    window.yhDashboardForceOverviewBootGuardV1 = forceDashboardOverview;
})();
/* END PATCH: Dashboard overview boot guard v1 */


/* PATCH: Dashboard parent child access authority v1 */
(function installDashboardParentChildAccessAuthorityV1() {
    if (window.__yhDashboardParentChildAccessAuthorityV1Installed) return;
    window.__yhDashboardParentChildAccessAuthorityV1Installed = true;

    const DIVISIONS = ['academy', 'plazas', 'federation'];
    const CHILD_PREFIXES = ['academy-', 'plazas-', 'federation-'];

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function cleanKey(value = '') {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'plaza') return 'plazas';
        if (key === 'dashboard' || key === 'hub') return 'overview';
        return key || 'overview';
    }

    function isParentDivision(value = '') {
        return DIVISIONS.includes(cleanKey(value));
    }

    function isChildWorkspace(value = '') {
        const key = cleanKey(value);
        return CHILD_PREFIXES.some((prefix) => key.startsWith(prefix));
    }

    function hasExplicitChildIntent() {
        const params = new URLSearchParams(window.location.search || '');
        const raw = cleanKey(
            params.get('workspace') ||
            params.get('section') ||
            params.get('tab') ||
            params.get('view') ||
            ''
        );

        if (!raw || raw === 'overview') return false;

        return isChildWorkspace(raw) ||
            ['roadmap', 'missions', 'community', 'messages', 'voice', 'feed', 'command', 'connect'].includes(raw);
    }

    function forceHide(node) {
        if (!node || !(node instanceof HTMLElement)) return;

        node.classList.add('hidden-step');
        node.classList.remove('is-active', 'active', 'is-open', 'is-expanded');
        node.setAttribute('aria-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('opacity', '0', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
    }

    function forceShow(node, display = 'block') {
        if (!node || !(node instanceof HTMLElement)) return;

        node.classList.remove('hidden-step');
        node.setAttribute('aria-hidden', 'false');
        node.style.removeProperty('display');
        node.style.removeProperty('visibility');
        node.style.removeProperty('opacity');
        node.style.removeProperty('pointer-events');

        if (display) {
            node.style.setProperty('display', display, 'important');
        }
    }

    function closeDivisionSubnavStrict(division = '') {
        const clean = cleanKey(division);
        const group = document.querySelector(`[data-yh-sidebar-division="${clean}"]`);
        const button = document.querySelector(`[data-yh-dashboard-shell="${clean}"]`);
        const subnav = document.getElementById(`yh-sidebar-subnav-${clean}`);

        if (group) {
            group.classList.remove(
                'is-expanded',
                'is-open',
                'is-active',
                'active',
                'is-manually-expanded'
            );
            group.classList.add('is-manually-collapsed');
            group.setAttribute('aria-expanded', 'false');
            group.setAttribute('data-yh-sidebar-subnav-open', 'false');
            group.setAttribute('data-yh-sidebar-collapsed', 'true');
            group.setAttribute('data-yh-v2-child-access', 'locked');
        }

        if (button) {
            button.classList.remove('active', 'is-active');
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-selected', 'false');
        }

        if (subnav) {
            forceHide(subnav);
        }

        document.querySelectorAll(
            `[data-yh-sidebar-child^="${clean}-"], [data-yh-mobile-subtab-menu-option^="${clean}-"]`
        ).forEach((child) => {
            child.classList.remove('active', 'is-active');
            child.setAttribute('aria-selected', 'false');
            child.setAttribute('aria-hidden', 'true');
        });
    }

    function openDivisionSubnavStrict(division = '') {
        const clean = cleanKey(division);
        const group = document.querySelector(`[data-yh-sidebar-division="${clean}"]`);
        const button = document.querySelector(`[data-yh-dashboard-shell="${clean}"]`);
        const subnav = document.getElementById(`yh-sidebar-subnav-${clean}`);

        if (group) {
            group.classList.add('is-expanded', 'is-active');
            group.classList.remove('is-manually-collapsed');
            group.setAttribute('aria-expanded', 'true');
            group.setAttribute('data-yh-sidebar-subnav-open', 'true');
            group.setAttribute('data-yh-sidebar-collapsed', 'false');
            group.setAttribute('data-yh-v2-child-access', 'unlocked');
        }

        if (button) {
            button.classList.add('is-active', 'active');
            button.setAttribute('aria-expanded', 'true');
            button.setAttribute('aria-selected', 'true');
        }

        if (subnav) {
            subnav.classList.remove('yh-dashboard-v2-gated-subnav');
            forceShow(subnav, 'grid');
        }

        document.querySelectorAll(
            `[data-yh-sidebar-child^="${clean}-"], [data-yh-mobile-subtab-menu-option^="${clean}-"]`
        ).forEach((child) => {
            child.classList.remove('hidden-step', 'yh-dashboard-v2-gated-child');
            child.setAttribute('aria-hidden', 'false');
        });
    }

    function closeAllDivisionSubnavsStrict() {
        DIVISIONS.forEach(closeDivisionSubnavStrict);
    }

    function activateDashboardButtonOnly() {
        document.querySelectorAll('[data-yh-dashboard-shell]').forEach((button) => {
            const key = cleanKey(button.getAttribute('data-yh-dashboard-shell') || '');
            const isOverview = key === 'overview';

            button.classList.toggle('is-active', isOverview);
            button.classList.toggle('active', isOverview);
            button.setAttribute('aria-selected', isOverview ? 'true' : 'false');

            if (!isOverview) {
                button.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function clearStaleChildRestoreStorage() {
        const keys = [
            'yh_dashboard_view_state_v1',
            'yh_universe_view_state_v1',
            'yh_dashboard_unified_workspace_v1',
            'yh_dashboard_workspace_v1',
            'yh_dashboard_last_workspace_v1',
            'yh_dashboard_sidebar_open_division_v1',
            'yh_dashboard_active_sidebar_division_v1'
        ];

        [localStorage, sessionStorage].forEach((store) => {
            keys.forEach((key) => {
                try {
                    const raw = String(store.getItem(key) || '').toLowerCase();
                    if (!raw) return;

                    if (
                        raw.includes('academy-') ||
                        raw.includes('plazas-') ||
                        raw.includes('federation-') ||
                        raw.includes('"academy"') ||
                        raw.includes('"plazas"') ||
                        raw.includes('"federation"')
                    ) {
                        store.removeItem(key);
                    }
                } catch (_) {}
            });
        });
    }

    function hideChildWorkspaceSurfaces() {
        [
            '#yh-dashboard-v2-parent-shell',
            '#yh-universe-workspace-launch-card',
            '#yh-universe-workspace-frame-shell',
            '#yh-universe-workspace-inline-host',
            '#yh-dashboard-division-parent-intro-v1',
            '.yh-dashboard-division-intro-v1',
            '.yh-dashboard-division-intro-hero-v1',
            '.yh-dashboard-division-child-grid-v1',
            '.yh-academy-parent-hero-header',
            '.yh-academy-parent-vision-scope',
            '.yh-universe-command-hero',
            '.yh-universe-stage-nav',
            '.yh-universe-dots',
            '#yh-universe-progress-rail',
            '#yh-econ-bridge-card',
            '#yh-command-overview-grid',
            '#yh-universe-carousel',
            '#yh-universe-plaza-strip',
            '#yh-universe-federation-strip',
            '.yh-universe-carousel-column'
        ].forEach((selector) => {
            document.querySelectorAll(selector).forEach(forceHide);
        });
    }

    function showOverviewSurfaces() {
        forceShow(document.querySelector('.yh-command-dashboard-head'), 'grid');
        forceShow(document.getElementById('yh-dashboard-overview-dynamic-access-row-v1'), 'grid');
        forceShow(document.getElementById('yh-universe-referral-card'), 'block');
        forceShow(document.getElementById('yh-universe-academy-strip'), 'block');

        const referral = document.getElementById('yh-universe-referral-card');
        const live = document.getElementById('yh-universe-academy-strip');

        if (referral && live && referral.nextElementSibling !== live) {
            referral.parentNode?.insertBefore(live, referral.nextSibling);
        }
    }

    function forceDashboardOverviewOnly(reason = 'overview') {
        if (!isDashboardPage()) return;
        if (hasExplicitChildIntent()) return;

        window.__yhDashboardWorkspaceActivationSeq = Number(window.__yhDashboardWorkspaceActivationSeq || 0) + 1;

        clearStaleChildRestoreStorage();

        document.body?.removeAttribute('data-yh-dashboard-v2-active');
        document.body?.removeAttribute('data-yh-dashboard-v2-approved');
        document.body?.removeAttribute('data-yh-dashboard-v2-status');
        document.body?.removeAttribute('data-yh-dashboard-v2-lock');
        document.body?.removeAttribute('data-yh-dashboard-v2-instant-parent');
        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');

        document.body?.setAttribute('data-yh-unified-workspace', 'overview');
        document.body?.setAttribute('data-yh-unified-division', 'overview');
        document.body?.setAttribute('data-yh-active-sidebar-division', 'overview');
        document.body?.setAttribute('data-yh-parent-child-authority', 'overview');

        closeAllDivisionSubnavsStrict();
        activateDashboardButtonOnly();
        hideChildWorkspaceSurfaces();
        showOverviewSurfaces();

        if (typeof window.yhDashboardV2ShowOverviewShellV1 === 'function') {
            try {
                window.yhDashboardV2ShowOverviewShellV1(reason);
                closeAllDivisionSubnavsStrict();
                activateDashboardButtonOnly();
            } catch (_) {}
        }
    }

    function enforceParentChildGate(reason = 'gate') {
        if (!isDashboardPage()) return;

        const workspace = cleanKey(document.body?.getAttribute('data-yh-unified-workspace') || 'overview');
        const activeParent = cleanKey(document.body?.getAttribute('data-yh-dashboard-v2-active') || '');

        if (workspace === 'overview' || !workspace || activeParent === 'overview') {
            forceDashboardOverviewOnly(reason);
            return;
        }

        if (!isParentDivision(activeParent) && !isParentDivision(workspace)) {
            return;
        }

        const division = isParentDivision(activeParent) ? activeParent : workspace;
        const approved = String(document.body?.getAttribute('data-yh-dashboard-v2-approved') || '').trim().toLowerCase() === 'true';

        DIVISIONS.forEach((item) => {
            if (item !== division) closeDivisionSubnavStrict(item);
        });

        if (approved) {
            openDivisionSubnavStrict(division);
        } else {
            closeDivisionSubnavStrict(division);

            const parentButton = document.querySelector(`[data-yh-dashboard-shell="${division}"]`);
            if (parentButton) {
                parentButton.classList.add('is-active', 'active');
                parentButton.setAttribute('aria-selected', 'true');
                parentButton.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function scheduleOverviewOnly(reason = 'boot') {
        if (!isDashboardPage() || hasExplicitChildIntent()) return;

        [0, 20, 80, 160, 360, 700, 1200, 2200, 4200].forEach((delay) => {
            window.setTimeout(() => forceDashboardOverviewOnly(`${reason}-${delay}`), delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scheduleOverviewOnly('dom'));
    } else {
        scheduleOverviewOnly('boot');
    }

    window.addEventListener('pageshow', () => scheduleOverviewOnly('pageshow'));

    window.addEventListener('click', (event) => {
        const dashboard = event.target?.closest?.('[data-yh-dashboard-shell="overview"], #nav-dashboard, #btn-dashboard-overview');
        if (!dashboard) return;

        window.setTimeout(() => forceDashboardOverviewOnly('dashboard-click'), 0);
        window.setTimeout(() => forceDashboardOverviewOnly('dashboard-click-late'), 160);
    }, true);

    window.addEventListener('click', (event) => {
        const parent = event.target?.closest?.('[data-yh-dashboard-shell="academy"], [data-yh-dashboard-shell="plazas"], [data-yh-dashboard-shell="federation"]');
        if (!parent) return;

        const division = cleanKey(parent.getAttribute('data-yh-dashboard-shell') || '');
        if (!isParentDivision(division)) return;

        window.setTimeout(() => enforceParentChildGate('parent-click'), 80);
        window.setTimeout(() => enforceParentChildGate('parent-click-late'), 520);
        window.setTimeout(() => enforceParentChildGate('parent-click-final'), 1500);
    }, true);

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardParentChildAccessAuthorityTimerV1);
            window.__yhDashboardParentChildAccessAuthorityTimerV1 = window.setTimeout(() => {
                enforceParentChildGate('mutation');
            }, 35);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'class',
                'style',
                'aria-hidden',
                'aria-expanded',
                'data-yh-unified-workspace',
                'data-yh-dashboard-v2-active',
                'data-yh-dashboard-v2-approved',
                'data-yh-sidebar-subnav-open',
                'data-yh-active-sidebar-division'
            ]
        });

        window.__yhDashboardParentChildAccessAuthorityObserverV1 = observer;
    } catch (_) {}

    window.yhDashboardParentChildAccessAuthorityV1 = {
        forceOverviewOnly: forceDashboardOverviewOnly,
        enforceParentChildGate,
        closeAllDivisionSubnavsStrict,
        closeDivisionSubnavStrict,
        openDivisionSubnavStrict
    };
})();
/* END PATCH: Dashboard parent child access authority v1 */


/* PATCH: Dashboard division state title final v2 */
(function installDashboardDivisionStateTitleFinalV2() {
    if (window.__yhDashboardDivisionStateTitleFinalV2Installed) return;
    window.__yhDashboardDivisionStateTitleFinalV2Installed = true;

    const DIVISIONS = {
        academy: {
            label: 'Academy',
            childTarget: 'academy-roadmap',
            applyFns: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal'],
            refreshFns: ['refreshAcademyMembershipStatus'],
            snapshotFns: ['readAcademyMembershipCache'],
            canEnterKeys: ['canEnterAcademy', 'canEnter', 'hasAccess', 'hasAcademyAccess'],
            statusKeys: ['applicationStatus', 'academyApplicationStatus', 'status', 'accessStatus', 'membershipStatus'],
            hasApplicationKeys: ['hasApplication', 'academyHasApplication']
        },
        plazas: {
            label: 'Plazas',
            childTarget: 'plazas-feed',
            applyFns: ['openPlazaApplicationModal'],
            refreshFns: ['refreshPlazaAccessStatusFromBackend'],
            snapshotFns: ['getPlazaAccessSnapshot', 'readDashboardPlazaAccessSnapshot'],
            canEnterKeys: ['canEnterPlaza', 'canEnter', 'hasAccess', 'hasPlazaAccess'],
            statusKeys: ['applicationStatus', 'plazaApplicationStatus', 'status', 'accessStatus'],
            hasApplicationKeys: ['hasApplication', 'plazaHasApplication']
        },
        federation: {
            label: 'Federation',
            childTarget: 'federation-command',
            applyFns: ['openFederationApplicationModal'],
            refreshFns: ['refreshFederationAccessStatusFromBackend'],
            snapshotFns: ['getFederationAccessSnapshot', 'readDashboardFederationAccessSnapshot'],
            canEnterKeys: ['canEnterFederation', 'canEnter', 'hasAccess', 'hasFederationAccess'],
            statusKeys: ['applicationStatus', 'federationApplicationStatus', 'status', 'accessStatus'],
            hasApplicationKeys: ['hasApplication', 'federationHasApplication']
        }
    };

    let refreshStarted = false;

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function cleanDivision(value = '') {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'plaza') return 'plazas';
        return key;
    }

    function normalizeStatus(value = '') {
        const raw = String(value || '').trim();
        const clean = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

        if (
            !clean ||
            clean === 'loading' ||
            clean === 'loading...' ||
            clean === 'checking' ||
            clean === 'checking...' ||
            clean === 'syncing' ||
            clean === 'syncing...' ||
            clean === 'preparing' ||
            clean === 'preparing...' ||
            clean === 'unknown' ||
            clean === 'n/a'
        ) {
            return 'not_applied';
        }

        if (
            clean === 'approved' ||
            clean === 'active' ||
            clean === 'unlocked' ||
            clean === 'accepted' ||
            clean === 'verified' ||
            clean === 'access granted' ||
            clean === 'member'
        ) {
            return 'approved';
        }

        if (
            clean === 'under review' ||
            clean === 'pending' ||
            clean === 'pending review' ||
            clean === 'new' ||
            clean === 'screening' ||
            clean === 'shortlisted' ||
            clean === 'waitlisted' ||
            clean === 'submitted'
        ) {
            return 'pending';
        }

        if (
            clean === 'rejected' ||
            clean === 'declined' ||
            clean === 'denied' ||
            clean === 'not approved'
        ) {
            return 'rejected';
        }

        if (
            clean === 'not applied' ||
            clean === 'none' ||
            clean === 'guest' ||
            clean === 'locked' ||
            clean === 'plazas first'
        ) {
            return 'not_applied';
        }

        return 'not_applied';
    }

    function stateLabel(status = 'not_applied') {
        if (status === 'approved') return 'Approved';
        if (status === 'pending') return 'Pending';
        if (status === 'rejected') return 'Rejected';
        return 'Not Applied';
    }

    function actionForStatus(status = 'not_applied') {
        if (status === 'approved') return 'enter';
        if (status === 'pending') return 'pending';
        if (status === 'rejected') return 'rejected';
        return 'apply';
    }

    function isTruthy(value) {
        return value === true || String(value || '').trim().toLowerCase() === 'true';
    }

    function readSnapshot(key = '') {
        const config = DIVISIONS[key];
        if (!config) return {};

        for (const fnName of config.snapshotFns) {
            try {
                if (typeof window[fnName] === 'function') {
                    const snapshot = window[fnName]();
                    if (snapshot && typeof snapshot === 'object') return snapshot;
                }
            } catch (_) {}
        }

        return {};
    }

    function pick(obj = {}, keys = []) {
        if (!obj || typeof obj !== 'object') return undefined;

        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                return obj[key];
            }
        }

        return undefined;
    }

    function getCard(key = '') {
        return document.querySelector(`[data-yh-overview-division-card="${key}"]`);
    }

    function getCardDomStatus(key = '') {
        const card = getCard(key);
        return normalizeStatus(card?.querySelector?.('.yh-dashboard-overview-access-status-v1')?.textContent || '');
    }

    function getDivisionStatus(key = '') {
        const clean = cleanDivision(key);
        const config = DIVISIONS[clean];
        if (!config) return 'not_applied';

        const snapshot = readSnapshot(clean);
        const canEnter = config.canEnterKeys.some((field) => isTruthy(snapshot[field]));
        if (canEnter) return 'approved';

        const rawStatus = pick(snapshot, config.statusKeys);
        let status = normalizeStatus(rawStatus);

        const hasApplication = config.hasApplicationKeys.some((field) => isTruthy(snapshot[field]));
        if (status === 'not_applied' && hasApplication) {
            status = 'pending';
        }

        if (status !== 'not_applied') return status;

        return getCardDomStatus(clean);
    }

    function applyCardState(key = '') {
        const clean = cleanDivision(key);
        const config = DIVISIONS[clean];
        const card = getCard(clean);

        if (!config || !card) return;

        const status = getDivisionStatus(clean);
        const action = actionForStatus(status);
        const statusNode = card.querySelector('.yh-dashboard-overview-access-status-v1');
        const button = card.querySelector('[data-yh-overview-division-action]');

        card.setAttribute('data-yh-division-access-state', action);
        card.classList.remove('is-apply', 'is-enter', 'is-pending', 'is-rejected', 'is-approved');
        card.classList.add(`is-${action}`);

        if (statusNode) {
            statusNode.textContent = stateLabel(status);
        }

        if (!button) return;

        button.setAttribute('data-yh-overview-division-action', clean);
        button.setAttribute('data-yh-overview-division-action-kind', action);
        button.setAttribute('data-yh-overview-division-target', action === 'enter' ? config.childTarget : '');

        if (action === 'enter') {
            button.textContent = 'Enter';
            button.disabled = false;
            button.removeAttribute('aria-disabled');
            return;
        }

        if (action === 'pending') {
            button.textContent = 'Pending';
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            return;
        }

        if (action === 'rejected') {
            button.textContent = 'Contact Admin';
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            return;
        }

        button.textContent = 'Apply';
        button.disabled = false;
        button.removeAttribute('aria-disabled');
    }

    function syncCards() {
        if (!isDashboardPage()) return;
        Object.keys(DIVISIONS).forEach(applyCardState);
    }

    async function refreshAccessStateOnce() {
        if (refreshStarted || !isDashboardPage()) return;
        refreshStarted = true;

        for (const [key, config] of Object.entries(DIVISIONS)) {
            for (const fnName of config.refreshFns) {
                try {
                    if (typeof window[fnName] === 'function') {
                        const result = window[fnName](key === 'federation' ? false : true);
                        if (result && typeof result.then === 'function') {
                            await result.catch(() => null);
                        }
                        break;
                    }
                } catch (_) {}
            }

            applyCardState(key);
        }
    }

    function showToastMessage(message = '', type = 'error') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function openApplyModal(key = '') {
        const clean = cleanDivision(key);
        const config = DIVISIONS[clean];

        if (!config) return false;

        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        document.querySelectorAll('#yh-dashboard-tab-transition-loader-v1, #yh-dashboard-tab-transition-loader-v2, #yh-dashboard-tab-transition-loader-v3').forEach((loader) => {
            loader.classList.remove('is-active');
            loader.classList.add('hidden-step');
            loader.setAttribute('aria-hidden', 'true');
        });

        for (const fnName of config.applyFns) {
            try {
                if (typeof window[fnName] === 'function') {
                    const result = window[fnName]();
                    if (result && typeof result.then === 'function') {
                        result.catch((error) => console.error(`${fnName} failed:`, error));
                    }
                    window.setTimeout(cleanAcademyApplyTitle, 80);
                    window.setTimeout(cleanAcademyApplyTitle, 280);
                    return true;
                }
            } catch (error) {
                console.error(`${fnName} failed:`, error);
            }
        }

        showToastMessage(`${config.label} application form is not ready yet. Please refresh and try again.`, 'error');
        return false;
    }

    function cleanAcademyApplyTitle() {
        const title = document.getElementById('yh-dashboard-academy-apply-title');
        if (!title) return;

        title.classList.add('yh-dashboard-academy-apply-title-clean');
        title.setAttribute('aria-label', 'Academy Application');
        title.textContent = '';
    }

    function handleNavigationClick(event) {
        if (!isDashboardPage() || !event?.target) return;

        const actionButton = event.target.closest('[data-yh-overview-division-action]');
        if (actionButton) {
            const key = cleanDivision(actionButton.getAttribute('data-yh-overview-division-action') || '');
            if (!DIVISIONS[key]) return;

            syncCards();

            const status = getDivisionStatus(key);
            const action = actionForStatus(status);

            if (action === 'apply') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();

                showToastMessage(`${DIVISIONS[key].label} access is not approved yet. Please complete your application first.`, 'error');
                window.setTimeout(() => openApplyModal(key), 320);
                return;
            }

            if (action === 'pending') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                showToastMessage(`${DIVISIONS[key].label} application is still under review.`, 'error');
                return;
            }

            return;
        }

        const parent = event.target.closest('[data-yh-dashboard-shell="academy"], [data-yh-dashboard-shell="plazas"], [data-yh-dashboard-shell="federation"]');
        if (!parent) return;

        const key = cleanDivision(parent.getAttribute('data-yh-dashboard-shell') || '');
        if (!DIVISIONS[key]) return;

        syncCards();

        const status = getDivisionStatus(key);
        const action = actionForStatus(status);

        if (action === 'apply') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();

            showToastMessage(`${DIVISIONS[key].label} access is not approved yet. Please complete your application first.`, 'error');
            window.setTimeout(() => openApplyModal(key), 320);
            return;
        }

        if (action === 'pending') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();

            showToastMessage(`${DIVISIONS[key].label} application is still under review.`, 'error');

            if (typeof window.yhDashboardV2ShowParentShellV1 === 'function') {
                window.yhDashboardV2ShowParentShellV1(key, 'pending-parent');
            }
        }
    }

    window.addEventListener('click', handleNavigationClick, true);

    function boot() {
        syncCards();
        cleanAcademyApplyTitle();
        window.setTimeout(syncCards, 60);
        window.setTimeout(syncCards, 220);
        window.setTimeout(syncCards, 700);
        window.setTimeout(refreshAccessStateOnce, 900);
        window.setTimeout(syncCards, 1600);
        window.setTimeout(syncCards, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('pageshow', boot);

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardDivisionStateTitleFinalTimerV2);
            window.__yhDashboardDivisionStateTitleFinalTimerV2 = window.setTimeout(() => {
                syncCards();
                cleanAcademyApplyTitle();
            }, 45);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-yh-unified-workspace', 'data-yh-dashboard-v2-active']
        });

        window.__yhDashboardDivisionStateTitleFinalObserverV2 = observer;
    } catch (_) {}

    window.yhDashboardDivisionStateTitleFinalV2 = {
        syncCards,
        refreshAccessStateOnce,
        getDivisionStatus,
        openApplyModal,
        cleanAcademyApplyTitle
    };
})();
/* END PATCH: Dashboard division state title final v2 */


/* PATCH: Dashboard application pending persistence v1 */
(function installDashboardApplicationPendingPersistenceV1() {
    if (window.__yhDashboardApplicationPendingPersistenceV1Installed) return;
    window.__yhDashboardApplicationPendingPersistenceV1Installed = true;

    const BASE_KEY = 'yh_dashboard_division_application_pending_locks_v1';
    const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 24 * 45;

    const DIVISIONS = {
        academy: {
            label: 'Academy',
            postMatchers: ['/api/academy/membership-apply'],
            statusEndpoint: '/api/academy/membership-status',
            modalFns: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal'],
            legacyStorageKey: 'yh_academy_membership_status_v1',
            formIds: ['form-academy-apply'],
            childTarget: 'academy-roadmap'
        },
        plazas: {
            label: 'Plazas',
            postMatchers: ['/api/plaza/application'],
            statusEndpoint: '/api/plaza/application-status',
            modalFns: ['openPlazaApplicationModal'],
            legacyStorageKey: 'yh_plaza_access_status_v1',
            formIds: ['form-plaza-apply'],
            childTarget: 'plazas-feed'
        },
        federation: {
            label: 'Federation',
            postMatchers: ['/api/federation/application'],
            statusEndpoint: '/api/federation/application-status',
            modalFns: ['openFederationApplicationModal'],
            legacyStorageKey: 'yh_federation_access_status_v1',
            formIds: ['form-federation-apply'],
            childTarget: 'federation-command'
        }
    };

    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    const nativeModalFns = {};

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function cleanDivision(value = '') {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'plaza') return 'plazas';
        return DIVISIONS[key] ? key : '';
    }

    function decodeTokenPayload(token = '') {
        const clean = String(token || '').trim();
        const parts = clean.split('.');
        if (parts.length < 2) return {};

        try {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
            return JSON.parse(atob(padded)) || {};
        } catch (_) {
            return {};
        }
    }

    function getStoredToken() {
        try {
            if (typeof window.YHSharedCore?.getStoredAuthToken === 'function') {
                return String(window.YHSharedCore.getStoredAuthToken() || '').trim();
            }
        } catch (_) {}

        try {
            if (typeof window.getStoredAuthToken === 'function') {
                return String(window.getStoredAuthToken() || '').trim();
            }
        } catch (_) {}

        try {
            return String(localStorage.getItem('yh_auth_token') || sessionStorage.getItem('yh_auth_token') || '').trim();
        } catch (_) {
            return '';
        }
    }

    function getUserScope() {
        const payload = decodeTokenPayload(getStoredToken());
        const direct = String(
            payload.sub ||
            payload.id ||
            payload.uid ||
            payload.email ||
            payload.username ||
            ''
        ).trim();

        if (direct) return direct.toLowerCase();

        try {
            return String(
                localStorage.getItem('yh_user_email') ||
                localStorage.getItem('yh_user_username') ||
                localStorage.getItem('yh_user_name') ||
                'default'
            ).trim().toLowerCase() || 'default';
        } catch (_) {
            return 'default';
        }
    }

    function storageKey() {
        return `${BASE_KEY}:${getUserScope()}`;
    }

    function readJson(key, store = localStorage, fallback = null) {
        try {
            const raw = store.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value, store = localStorage) {
        try {
            store.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function normalizeStatus(value = '') {
        const clean = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ');

        if (
            clean === 'approved' ||
            clean === 'active' ||
            clean === 'member' ||
            clean === 'verified' ||
            clean === 'unlocked' ||
            clean === 'access granted'
        ) return 'approved';

        if (
            clean === 'pending' ||
            clean === 'under review' ||
            clean === 'pending review' ||
            clean === 'review' ||
            clean === 'submitted' ||
            clean === 'new' ||
            clean === 'screening' ||
            clean === 'shortlisted' ||
            clean === 'waitlisted'
        ) return 'pending';

        if (
            clean === 'rejected' ||
            clean === 'declined' ||
            clean === 'denied' ||
            clean === 'not approved'
        ) return 'rejected';

        return 'not_applied';
    }

    function labelForStatus(status = 'not_applied') {
        if (status === 'approved') return 'Approved';
        if (status === 'pending') return 'Pending';
        if (status === 'rejected') return 'Rejected';
        return 'Not Applied';
    }

    function actionForStatus(status = 'not_applied') {
        if (status === 'approved') return 'enter';
        if (status === 'pending') return 'pending';
        if (status === 'rejected') return 'rejected';
        return 'apply';
    }

    function getLocks() {
        const parsed = readJson(storageKey(), localStorage, {});
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }

    function saveLocks(locks = {}) {
        writeJson(storageKey(), locks, localStorage);
        writeJson(storageKey(), locks, sessionStorage);
    }

    function isFreshLock(lock = null) {
        if (!lock || typeof lock !== 'object') return false;
        const submittedAt = Number(lock.submittedAt || 0);
        if (!submittedAt) return true;
        return Date.now() - submittedAt < MAX_PENDING_AGE_MS;
    }

    function getPendingLock(division = '') {
        const key = cleanDivision(division);
        const locks = getLocks();
        const lock = locks[key];

        if (!isFreshLock(lock)) {
            if (lock) {
                delete locks[key];
                saveLocks(locks);
            }
            return null;
        }

        return lock || null;
    }

    function writeLegacyPendingSnapshot(division = '', application = null) {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config?.legacyStorageKey) return;

        const base = {
            hasApplication: true,
            applicationStatus: 'under review',
            status: 'under review',
            application: application && typeof application === 'object' ? application : null,
            member: null,
            source: 'local-pending-persistence'
        };

        if (key === 'academy') {
            base.canEnterAcademy = false;
            base.hasAcademyAccess = false;
            base.hasRoadmapAccess = false;
        }

        if (key === 'plazas') {
            base.canEnterPlaza = false;
            base.hasPlazaAccess = false;
        }

        if (key === 'federation') {
            base.canEnterFederation = false;
            base.hasFederationAccess = false;
        }

        writeJson(config.legacyStorageKey, base, localStorage);
        writeJson(config.legacyStorageKey, base, sessionStorage);
    }

    function clearLegacyPendingSnapshotIfApprovedOrRejected(division = '', status = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config?.legacyStorageKey) return;

        const finalStatus = normalizeStatus(status);
        if (finalStatus !== 'approved' && finalStatus !== 'rejected') return;

        const existing = readJson(config.legacyStorageKey, localStorage, null);
        if (!existing || typeof existing !== 'object') return;

        const existingStatus = normalizeStatus(existing.applicationStatus || existing.status || '');
        if (existingStatus === 'pending') {
            try { localStorage.removeItem(config.legacyStorageKey); } catch (_) {}
            try { sessionStorage.removeItem(config.legacyStorageKey); } catch (_) {}
        }
    }

    function markPending(division = '', application = null, source = 'submit') {
        const key = cleanDivision(division);
        if (!key) return false;

        const locks = getLocks();

        locks[key] = {
            division: key,
            status: 'pending',
            submittedAt: Date.now(),
            source,
            application: application && typeof application === 'object' ? application : null
        };

        saveLocks(locks);
        writeLegacyPendingSnapshot(key, application);

        document.body?.setAttribute(`data-yh-${key}-application-pending`, 'true');

        if (!window.__yhDashboardApplicationPendingPersistenceSyncGuardV2) {
            window.__yhDashboardApplicationPendingPersistenceSyncGuardV2 = true;

            try {
                syncCards();
                syncSnapshotConsumers();
            } finally {
                window.__yhDashboardApplicationPendingPersistenceSyncGuardV2 = false;
            }
        }

        return true;
    }

    function clearPending(division = '', status = '') {
        const key = cleanDivision(division);
        if (!key) return false;

        const locks = getLocks();
        if (locks[key]) {
            delete locks[key];
            saveLocks(locks);
        }

        document.body?.removeAttribute(`data-yh-${key}-application-pending`);
        clearLegacyPendingSnapshotIfApprovedOrRejected(key, status);

        return true;
    }

    function getRequestUrl(input) {
        try {
            if (typeof input === 'string') return input;
            if (input && typeof input.url === 'string') return input.url;
        } catch (_) {}

        return '';
    }

    function getRequestMethod(input, init = {}) {
        try {
            if (init?.method) return String(init.method || 'GET').toUpperCase();
            if (input && typeof input.method === 'string') return String(input.method || 'GET').toUpperCase();
        } catch (_) {}

        return 'GET';
    }

    function divisionFromPostUrl(url = '') {
        const cleanUrl = String(url || '');
        for (const [key, config] of Object.entries(DIVISIONS)) {
            if (config.postMatchers.some((needle) => cleanUrl.includes(needle))) return key;
        }

        return '';
    }

    function parseBackendDivisionResult(division = '', payload = {}) {
        const key = cleanDivision(division);
        const body = payload && typeof payload === 'object' ? payload : {};
        const application = body.application && typeof body.application === 'object'
            ? body.application
            : null;

        let canEnter = false;
        let rawStatus = '';

        if (key === 'academy') {
            canEnter = body.canEnterAcademy === true ||
                body.hasAcademyAccess === true ||
                body.hasRoadmapAccess === true ||
                body.canEnter === true;

            rawStatus =
                body.applicationStatus ||
                body.academyApplicationStatus ||
                body.membershipStatus ||
                body.status ||
                application?.status ||
                '';
        }

        if (key === 'plazas') {
            canEnter = body.canEnterPlaza === true ||
                body.hasPlazaAccess === true ||
                body.canEnter === true;

            rawStatus =
                body.applicationStatus ||
                body.plazaApplicationStatus ||
                body.status ||
                application?.status ||
                '';
        }

        if (key === 'federation') {
            canEnter = body.canEnterFederation === true ||
                body.hasFederationAccess === true ||
                body.canEnter === true;

            rawStatus =
                body.applicationStatus ||
                body.federationApplicationStatus ||
                body.status ||
                application?.status ||
                '';
        }

        let status = normalizeStatus(rawStatus);

        if (canEnter) status = 'approved';

        const hasApplication =
            body.hasApplication === true ||
            Boolean(application) ||
            status === 'pending' ||
            status === 'rejected' ||
            status === 'approved';

        return {
            division: key,
            status,
            canEnter,
            hasApplication,
            application,
            raw: body
        };
    }

    async function fetchBackendStatus(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!nativeFetch || !config) return null;

        const headers = { Accept: 'application/json' };
        const token = getStoredToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        try {
            const response = await nativeFetch(config.statusEndpoint, {
                method: 'GET',
                credentials: 'include',
                headers
            });

            if (!response.ok) return null;

            const payload = await response.json().catch(() => ({}));
            const parsed = parseBackendDivisionResult(key, payload);

            if (parsed.status === 'approved' || parsed.status === 'rejected') {
                clearPending(key, parsed.status);
            }

            if (parsed.status === 'pending') {
                markPending(key, parsed.application || payload.application || null, 'backend-status');
            }

            return parsed;
        } catch (_) {
            return null;
        }
    }

    function getLocalLegacyStatus(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config?.legacyStorageKey) return 'not_applied';

        const existing =
            readJson(config.legacyStorageKey, localStorage, null) ||
            readJson(config.legacyStorageKey, sessionStorage, null);

        if (!existing || typeof existing !== 'object') return 'not_applied';

        const parsed = parseBackendDivisionResult(key, existing);
        return parsed.status;
    }

    function getResolvedStatus(division = '') {
        const key = cleanDivision(division);
        if (!key) return 'not_applied';

        const pendingLock = getPendingLock(key);
        const legacyStatus = getLocalLegacyStatus(key);

        if (legacyStatus === 'approved' || legacyStatus === 'rejected') {
            clearPending(key, legacyStatus);
            return legacyStatus;
        }

        if (legacyStatus === 'pending') {
            return 'pending';
        }

        if (pendingLock) {
            return 'pending';
        }

        return 'not_applied';
    }

    function syncCard(division = '') {
        if (!isDashboardPage()) return;

        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config) return;

        const status = getResolvedStatus(key);
        const action = actionForStatus(status);
        const card = document.querySelector(`[data-yh-overview-division-card="${key}"]`);
        const statusNode = card?.querySelector?.('.yh-dashboard-overview-access-status-v1');
        const button = card?.querySelector?.('[data-yh-overview-division-action]');

        if (card) {
            card.setAttribute('data-yh-division-access-state', action);
            card.classList.remove('is-apply', 'is-enter', 'is-pending', 'is-rejected', 'is-approved');
            card.classList.add(`is-${action}`);
        }

        if (statusNode) {
            statusNode.textContent = labelForStatus(status);
        }

        if (button) {
            button.setAttribute('data-yh-overview-division-action', key);
            button.setAttribute('data-yh-overview-division-action-kind', action);
            button.setAttribute('data-yh-overview-division-target', status === 'approved' ? config.childTarget : '');

            if (status === 'approved') {
                button.textContent = 'Enter';
                button.disabled = false;
                button.removeAttribute('aria-disabled');
            } else if (status === 'pending') {
                button.textContent = 'Pending';
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            } else if (status === 'rejected') {
                button.textContent = 'Contact Admin';
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.textContent = 'Apply';
                button.disabled = false;
                button.removeAttribute('aria-disabled');
            }
        }
    }

    function syncCards() {
        if (!isDashboardPage()) return;
        Object.keys(DIVISIONS).forEach(syncCard);
    }

    function syncSnapshotConsumers() {
        try { window.yhDashboardDivisionStateTitleFinalV2?.syncCards?.(); } catch (_) {}
        try { window.yhDashboardCanonicalDivisionGateV1?.syncCards?.(); } catch (_) {}
        try { window.yhRenderDashboardOverviewDynamicAccessRowV1?.(); } catch (_) {}
        try { window.renderYHEconomicSnapshot?.(); } catch (_) {}
    }

    function pendingSnapshot(division = '', nativeSnapshot = {}) {
        const key = cleanDivision(division);
        const existing = nativeSnapshot && typeof nativeSnapshot === 'object' ? nativeSnapshot : {};
        const status = getResolvedStatus(key);

        if (status !== 'pending') return existing;

        const lock = getPendingLock(key);

        const snapshot = {
            ...existing,
            hasApplication: true,
            applicationStatus: 'under review',
            status: 'under review',
            application: existing.application || lock?.application || null,
            member: null,
            source: 'pending-persistence'
        };

        if (key === 'academy') {
            snapshot.canEnterAcademy = false;
            snapshot.hasAcademyAccess = false;
            snapshot.hasRoadmapAccess = false;
        }

        if (key === 'plazas') {
            snapshot.canEnterPlaza = false;
            snapshot.hasPlazaAccess = false;
        }

        if (key === 'federation') {
            snapshot.canEnterFederation = false;
            snapshot.hasFederationAccess = false;
        }

        return snapshot;
    }

    function wrapSnapshotFns() {
        if (window.__yhDashboardApplicationPendingPersistenceSnapshotFnsWrappedV1) return;
        window.__yhDashboardApplicationPendingPersistenceSnapshotFnsWrappedV1 = true;

        const nativeAcademy = window.readAcademyMembershipCache;
        if (typeof nativeAcademy === 'function') {
            window.readAcademyMembershipCache = function readAcademyMembershipCacheWithPendingV1() {
                return pendingSnapshot('academy', nativeAcademy() || {});
            };
        }

        const nativePlaza = window.getPlazaAccessSnapshot;
        window.getPlazaAccessSnapshot = function getPlazaAccessSnapshotWithPendingV1() {
            return pendingSnapshot('plazas', typeof nativePlaza === 'function' ? (nativePlaza() || {}) : {});
        };
        window.readDashboardPlazaAccessSnapshot = window.getPlazaAccessSnapshot;

        const nativeFederation = window.getFederationAccessSnapshot;
        window.getFederationAccessSnapshot = function getFederationAccessSnapshotWithPendingV1() {
            return pendingSnapshot('federation', typeof nativeFederation === 'function' ? (nativeFederation() || {}) : {});
        };
        window.readDashboardFederationAccessSnapshot = window.getFederationAccessSnapshot;
    }

    function blockPendingModal(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config) return;

        config.modalFns.forEach((fnName) => {
            if (nativeModalFns[fnName]) return;
            if (typeof window[fnName] !== 'function') return;

            nativeModalFns[fnName] = window[fnName];

            window[fnName] = function pendingAwareApplicationModalV1() {
                const status = getResolvedStatus(key);

                if (status === 'pending') {
                    if (typeof window.showToast === 'function') {
                        window.showToast(`${config.label} application is still under admin review.`, 'error');
                    }

                    syncCards();
                    return false;
                }

                return nativeModalFns[fnName].apply(this, arguments);
            };
        });
    }

    function wrapModalFns() {
        Object.keys(DIVISIONS).forEach(blockPendingModal);
    }

    function installFetchObserver() {
        if (!nativeFetch || window.__yhDashboardApplicationPendingFetchObserverV1) return;
        window.__yhDashboardApplicationPendingFetchObserverV1 = true;

        window.fetch = function yhDashboardApplicationPendingFetchV1(input, init) {
            const url = getRequestUrl(input);
            const method = getRequestMethod(input, init);
            const division = method === 'POST' ? divisionFromPostUrl(url) : '';

            return nativeFetch.apply(this, arguments).then(async (response) => {
                if (division && response?.ok) {
                    let payload = {};
                    try {
                        payload = await response.clone().json();
                    } catch (_) {
                        payload = {};
                    }

                    const parsed = parseBackendDivisionResult(division, payload);
                    const app = parsed.application || payload.application || payload || null;

                    if (parsed.status === 'approved') {
                        clearPending(division, 'approved');
                    } else if (parsed.status === 'rejected') {
                        clearPending(division, 'rejected');
                    } else {
                        markPending(division, app, 'fetch-post-success');
                    }

                    [250, 900, 1800, 3200].forEach((delay) => {
                        window.setTimeout(() => fetchBackendStatus(division).then(syncCards), delay);
                    });
                }

                return response;
            });
        };
    }

    function divisionFromFormId(formId = '') {
        const id = String(formId || '').trim();

        for (const [key, config] of Object.entries(DIVISIONS)) {
            if (config.formIds.includes(id)) return key;
        }

        return '';
    }

    function installSubmitFallback() {
        if (window.__yhDashboardApplicationPendingSubmitFallbackV1) return;
        window.__yhDashboardApplicationPendingSubmitFallbackV1 = true;

        document.addEventListener('submit', (event) => {
            const form = event.target;
            const division = divisionFromFormId(form?.id || '');
            if (!division) return;

            if (typeof form.checkValidity === 'function' && !form.checkValidity()) return;

            [1200, 2400, 4200].forEach((delay) => {
                window.setTimeout(() => {
                    const status = getLocalLegacyStatus(division);
                    if (status === 'pending') {
                        markPending(division, null, 'submit-fallback-cache');
                    }

                    syncCards();
                }, delay);
            });
        }, true);
    }

    function interceptPendingNavigation(event) {
        if (!isDashboardPage() || !event?.target) return;

        const actionButton = event.target.closest?.('[data-yh-overview-division-action]');
        const parentButton = event.target.closest?.('[data-yh-dashboard-shell="academy"], [data-yh-dashboard-shell="plazas"], [data-yh-dashboard-shell="federation"]');

        const division = actionButton
            ? cleanDivision(actionButton.getAttribute('data-yh-overview-division-action') || '')
            : parentButton
                ? cleanDivision(parentButton.getAttribute('data-yh-dashboard-shell') || '')
                : '';

        if (!division) return;

        const status = getResolvedStatus(division);

        if (status !== 'pending') return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (typeof window.showToast === 'function') {
            window.showToast(`${DIVISIONS[division].label} application is still under admin review.`, 'error');
        }

        syncCards();
    }

    function refreshAllStatuses() {
        Object.keys(DIVISIONS).forEach((key) => {
            fetchBackendStatus(key).then(syncCards).catch(() => null);
        });
    }

    function boot() {
        if (!isDashboardPage()) return;

        wrapSnapshotFns();
        wrapModalFns();
        installFetchObserver();
        installSubmitFallback();

        Object.keys(DIVISIONS).forEach((key) => {
            if (getPendingLock(key)) {
                writeLegacyPendingSnapshot(key, getPendingLock(key)?.application || null);
            }
        });

        syncCards();
        syncSnapshotConsumers();

        [80, 240, 700, 1400, 2600, 4200].forEach((delay) => {
            window.setTimeout(() => {
                wrapModalFns();
                syncCards();
            }, delay);
        });

        window.setTimeout(refreshAllStatuses, 900);
        window.setTimeout(refreshAllStatuses, 3200);
    }

    window.addEventListener('click', interceptPendingNavigation, true);
    window.addEventListener('pointerdown', interceptPendingNavigation, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('pageshow', boot);
    window.addEventListener('focus', () => {
        syncCards();
        window.setTimeout(refreshAllStatuses, 300);
    });

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardApplicationPendingPersistenceTimerV1);
            window.__yhDashboardApplicationPendingPersistenceTimerV1 = window.setTimeout(() => {
                wrapModalFns();
                syncCards();
            }, 60);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-yh-unified-workspace', 'data-yh-dashboard-v2-active']
        });
    } catch (_) {}

    window.yhDashboardApplicationPendingPersistenceV1 = {
        markPending,
        clearPending,
        getPendingLock,
        getResolvedStatus,
        syncCards,
        refreshAllStatuses
    };
})();
/* END PATCH: Dashboard application pending persistence v1 */


/* PATCH: Dashboard pending recursion emergency apply guard v2 */
(function installDashboardPendingRecursionEmergencyApplyGuardV2() {
    if (window.__yhDashboardPendingRecursionEmergencyApplyGuardV2Installed) return;
    window.__yhDashboardPendingRecursionEmergencyApplyGuardV2Installed = true;

    const APPLY_FNS = {
        academy: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal'],
        plazas: ['openPlazaApplicationModal'],
        federation: ['openFederationApplicationModal']
    };

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function cleanDivision(value = '') {
        const key = String(value || '').trim().toLowerCase();
        if (key === 'plaza') return 'plazas';
        return APPLY_FNS[key] ? key : '';
    }

    function getButtonState(button) {
        return String(button?.getAttribute?.('data-yh-overview-division-action-kind') || '').trim().toLowerCase();
    }

    function showToastMessage(message = '', type = 'error') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function openApply(division = '') {
        const key = cleanDivision(division);
        if (!key) return false;

        const fns = APPLY_FNS[key] || [];

        for (const fnName of fns) {
            try {
                if (typeof window[fnName] === 'function') {
                    const result = window[fnName]();

                    if (result && typeof result.then === 'function') {
                        result.catch((error) => console.error(`${fnName} failed:`, error));
                    }

                    return true;
                }
            } catch (error) {
                console.error(`${fnName} failed:`, error);
            }
        }

        showToastMessage('Application form is not ready yet. Please refresh and try again.', 'error');
        return false;
    }

    document.addEventListener('click', (event) => {
        if (!isDashboardPage() || !event?.target) return;

        const button = event.target.closest?.('[data-yh-overview-division-action]');
        if (!button) return;

        const division = cleanDivision(button.getAttribute('data-yh-overview-division-action') || '');
        if (!division) return;

        const state = getButtonState(button);

        if (state === 'pending') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();

            showToastMessage(`${division === 'academy' ? 'Academy' : division === 'plazas' ? 'Plazas' : 'Federation'} application is still under admin review.`, 'error');
            return;
        }

        if (state === 'apply' || button.textContent.trim().toLowerCase() === 'apply') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();

            window.setTimeout(() => openApply(division), 60);
        }
    }, true);
})();
/* END PATCH: Dashboard pending recursion emergency apply guard v2 */

