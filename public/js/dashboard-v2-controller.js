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

    window.addEventListener('pointerdown', interceptShellNavigation, true);
    window.addEventListener('mousedown', interceptShellNavigation, true);
    window.addEventListener('touchstart', interceptShellNavigation, true);
    window.addEventListener('click', interceptShellNavigation, true);

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

