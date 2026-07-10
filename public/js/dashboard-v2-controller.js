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


/* PATCH: Dashboard division apply gate v1 */
(function installDashboardDivisionApplyGateV1() {
    if (window.__yhDashboardDivisionApplyGateV1Installed) return;
    window.__yhDashboardDivisionApplyGateV1Installed = true;

    const NAV_DELAY_MS = 1150;

    const DIVISIONS = {
        academy: {
            label: 'Academy',
            card: 'academy',
            applyLabel: 'Apply',
            enterLabel: 'Enter',
            pendingLabel: 'Pending',
            applyFns: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal'],
            snapshotFns: ['readAcademyMembershipCache'],
            canEnterKeys: ['canEnterAcademy', 'canEnter', 'hasAccess', 'hasAcademyAccess'],
            statusKeys: ['applicationStatus', 'academyApplicationStatus', 'status', 'accessStatus', 'membershipStatus'],
            hasApplicationKeys: ['hasApplication', 'academyHasApplication'],
            childTarget: 'academy-roadmap'
        },
        plazas: {
            label: 'Plazas',
            card: 'plazas',
            applyLabel: 'Apply',
            enterLabel: 'Enter',
            pendingLabel: 'Pending',
            applyFns: ['openPlazaApplicationModal'],
            snapshotFns: ['getPlazaAccessSnapshot', 'readDashboardPlazaAccessSnapshot'],
            canEnterKeys: ['canEnterPlaza', 'canEnter', 'hasAccess', 'hasPlazaAccess'],
            statusKeys: ['applicationStatus', 'plazaApplicationStatus', 'status', 'accessStatus'],
            hasApplicationKeys: ['hasApplication', 'plazaHasApplication'],
            childTarget: 'plazas-feed'
        },
        federation: {
            label: 'Federation',
            card: 'federation',
            applyLabel: 'Apply',
            enterLabel: 'Enter',
            pendingLabel: 'Pending',
            applyFns: ['openFederationApplicationModal'],
            snapshotFns: ['getFederationAccessSnapshot', 'readDashboardFederationAccessSnapshot'],
            canEnterKeys: ['canEnterFederation', 'canEnter', 'hasAccess', 'hasFederationAccess'],
            statusKeys: ['applicationStatus', 'federationApplicationStatus', 'status', 'accessStatus'],
            hasApplicationKeys: ['hasApplication', 'federationHasApplication'],
            childTarget: 'federation-command'
        }
    };

    let transitionTimer = null;
    let pendingTarget = null;

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
        return key;
    }

    function isDivisionKey(value = '') {
        return Boolean(DIVISIONS[cleanKey(value)]);
    }

    function isTruthyValue(value) {
        return value === true || String(value || '').trim().toLowerCase() === 'true';
    }

    function normalizeStatus(value = '', fallback = '') {
        const raw = String(value || fallback || '').trim();
        const clean = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

        if (
            !clean ||
            clean === 'loading' ||
            clean === 'loading...' ||
            clean === 'syncing' ||
            clean === 'checking' ||
            clean === 'checking...' ||
            clean === 'preparing' ||
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
            clean === 'pending' ||
            clean === 'under review' ||
            clean === 'pending review' ||
            clean === 'review' ||
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

    function readJsonStorage(key = '') {
        const stores = [localStorage, sessionStorage];

        for (const store of stores) {
            try {
                const raw = store.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
            } catch (_) {}
        }

        return null;
    }

    function pickFromObject(obj = {}, keys = []) {
        if (!obj || typeof obj !== 'object') return undefined;

        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
        }

        return undefined;
    }

    function readSnapshotFromFunctions(config) {
        for (const fnName of config.snapshotFns) {
            try {
                if (typeof window[fnName] === 'function') {
                    const value = window[fnName]();
                    if (value && typeof value === 'object') return value;
                }
            } catch (_) {}
        }

        return {};
    }

    function readSnapshotFromCaches(key = '') {
        const cacheKeys = [
            'yh_dashboard_self_profile_cache_v1',
            'yh_academy_profile_cache_v1',
            'yh_user_profile_cache_v1',
            'yh_current_user',
            'yh_user'
        ];

        for (const cacheKey of cacheKeys) {
            const profile = readJsonStorage(cacheKey);
            if (!profile || typeof profile !== 'object') continue;

            const divisions = profile.divisions && typeof profile.divisions === 'object' ? profile.divisions : {};
            const candidate =
                divisions[key] ||
                divisions[key === 'plazas' ? 'plaza' : key] ||
                profile[key] ||
                profile[`${key}Application`] ||
                profile[key === 'plazas' ? 'plazaApplication' : `${key}Application`];

            if (candidate && typeof candidate === 'object') return candidate;
        }

        return {};
    }

    function readStatusFromCard(key = '') {
        const card = document.querySelector(`[data-yh-overview-division-card="${key}"]`);
        const statusText = String(card?.querySelector?.('.yh-dashboard-overview-access-status-v1')?.textContent || '').trim();

        return normalizeStatus(statusText);
    }

    function getDivisionState(key = '') {
        const clean = cleanKey(key);
        const config = DIVISIONS[clean];

        if (!config) {
            return { status: 'not_applied', label: 'Not Applied', approved: false, pending: false, rejected: false, action: 'apply' };
        }

        const functionSnapshot = readSnapshotFromFunctions(config);
        const cacheSnapshot = readSnapshotFromCaches(clean);
        const snapshot = {
            ...cacheSnapshot,
            ...functionSnapshot
        };

        const canEnter = config.canEnterKeys.some((field) => isTruthyValue(snapshot[field]));
        const rawStatus = pickFromObject(snapshot, config.statusKeys);
        let status = normalizeStatus(rawStatus);

        const hasApplication = config.hasApplicationKeys.some((field) => isTruthyValue(snapshot[field]));

        if (canEnter) status = 'approved';
        else if (hasApplication && status === 'not_applied') status = 'pending';

        if (status === 'not_applied') {
            const domStatus = readStatusFromCard(clean);
            if (domStatus !== 'not_applied') status = domStatus;
        }

        const approved = status === 'approved';
        const pending = status === 'pending';
        const rejected = status === 'rejected';

        return {
            status,
            approved,
            pending,
            rejected,
            action: approved ? 'enter' : pending ? 'pending' : rejected ? 'rejected' : 'apply',
            label: approved ? 'Approved' : pending ? 'Pending' : rejected ? 'Rejected' : 'Not Applied'
        };
    }

    function setCardClass(card, action) {
        if (!card) return;

        ['is-apply', 'is-enter', 'is-pending', 'is-rejected', 'is-approved'].forEach((name) => {
            card.classList.remove(name);
        });

        card.classList.add(`is-${action}`);
        card.setAttribute('data-yh-division-access-state', action);
    }

    function syncAccessCard(key = '') {
        const clean = cleanKey(key);
        const config = DIVISIONS[clean];
        if (!config) return;

        const card = document.querySelector(`[data-yh-overview-division-card="${clean}"]`);
        if (!card) return;

        const state = getDivisionState(clean);
        const statusNode = card.querySelector('.yh-dashboard-overview-access-status-v1');
        const button = card.querySelector('[data-yh-overview-division-action]');

        setCardClass(card, state.action);

        if (statusNode) {
            statusNode.textContent = state.label;
        }

        if (!button) return;

        button.setAttribute('data-yh-overview-division-action', clean);
        button.setAttribute('data-yh-overview-division-action-kind', state.action);
        button.setAttribute('data-yh-overview-division-target', state.approved ? config.childTarget : '');

        if (state.approved) {
            button.textContent = config.enterLabel;
            button.disabled = false;
            button.removeAttribute('aria-disabled');
            return;
        }

        if (state.pending) {
            button.textContent = config.pendingLabel;
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            return;
        }

        if (state.rejected) {
            button.textContent = 'Contact Admin';
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            return;
        }

        button.textContent = config.applyLabel;
        button.disabled = false;
        button.removeAttribute('aria-disabled');
    }

    function syncAccessCards(reason = 'sync') {
        if (!isDashboardPage()) return;
        Object.keys(DIVISIONS).forEach(syncAccessCard);
    }

    function showToastMessage(message = '', type = 'error') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function closeTransitionLoaders() {
        try {
            window.yhDashboardV2LoaderGateAuthorityV2?.hideLoader?.();
        } catch (_) {}

        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        document.querySelectorAll('#yh-dashboard-tab-transition-loader-v1, #yh-dashboard-tab-transition-loader-v2, #yh-dashboard-tab-transition-loader-v3').forEach((loader) => {
            loader.classList.remove('is-active');
            loader.classList.add('hidden-step');
            loader.setAttribute('aria-hidden', 'true');
        });
    }

    function openDivisionApplication(key = '') {
        const clean = cleanKey(key);
        const config = DIVISIONS[clean];

        if (!config) return false;

        closeTransitionLoaders();

        const polishApi = window.yhDashboardV2OverviewPolishV1;
        if (polishApi && typeof polishApi.openDivisionApplicationModal === 'function') {
            try {
                if (polishApi.openDivisionApplicationModal(clean)) return true;
            } catch (_) {}
        }

        for (const fnName of config.applyFns) {
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

        showToastMessage(`${config.label} application form is not ready yet. Please refresh and try again.`, 'error');
        return false;
    }

    function handleNotApprovedParentClick(key = '') {
        const clean = cleanKey(key);
        const config = DIVISIONS[clean];

        if (!config) return;

        closeTransitionLoaders();

        showToastMessage(`${config.label} access is not approved yet. Please complete your application first.`, 'error');

        window.setTimeout(() => {
            openDivisionApplication(clean);
        }, 420);
    }

    function ensureLoader() {
        let loader = document.getElementById('yh-dashboard-tab-transition-loader-v3');
        if (loader) return loader;

        loader = document.createElement('div');
        loader.id = 'yh-dashboard-tab-transition-loader-v3';
        loader.className = 'yh-dashboard-tab-transition-loader-v3 hidden-step';
        loader.setAttribute('aria-hidden', 'true');
        loader.innerHTML = `
            <div class="yh-dashboard-tab-transition-card-v3">
                <div class="yh-dashboard-tab-transition-orb-v3" aria-hidden="true">
                    <img src="/images/logo.avif" alt="">
                </div>
                <span>SYNCING VIEW</span>
                <strong id="yh-dashboard-tab-transition-title-v3">Opening Dashboard</strong>
                <p>Preparing the selected workspace.</p>
                <div class="yh-dashboard-tab-transition-bar-v3" aria-hidden="true"><i></i></div>
            </div>
        `;

        document.body.appendChild(loader);
        return loader;
    }

    function showLoader(label = 'Opening Dashboard') {
        const loader = ensureLoader();
        const title = document.getElementById('yh-dashboard-tab-transition-title-v3');

        if (title) title.textContent = label;

        document.body?.setAttribute('data-yh-dashboard-tab-transitioning', 'true');

        loader.classList.remove('hidden-step');
        loader.classList.add('is-active');
        loader.setAttribute('aria-hidden', 'false');
    }

    function hideLoader() {
        const loader = document.getElementById('yh-dashboard-tab-transition-loader-v3');

        document.body?.removeAttribute('data-yh-dashboard-tab-transitioning');

        if (!loader) return;

        loader.classList.remove('is-active');
        loader.setAttribute('aria-hidden', 'true');

        window.setTimeout(() => {
            if (!loader.classList.contains('is-active')) loader.classList.add('hidden-step');
        }, 180);
    }

    function runTarget(target) {
        if (!target) return;

        if (target.kind === 'overview') {
            if (typeof window.yhDashboardV2ShowOverviewShellV1 === 'function') {
                window.yhDashboardV2ShowOverviewShellV1('division-apply-gate-v1');
                window.setTimeout(() => window.yhDashboardV2ShowOverviewShellV1('division-apply-gate-v1-late'), 90);
            } else if (typeof window.activateDashboardUnifiedWorkspace === 'function') {
                window.activateDashboardUnifiedWorkspace('overview', { animate: false, scroll: false, persist: true });
            }

            window.setTimeout(syncAccessCards, 120);
            return;
        }

        if (target.kind === 'parent') {
            const state = getDivisionState(target.key);

            if (!state.approved && !state.pending) {
                handleNotApprovedParentClick(target.key);
                return;
            }

            if (typeof window.yhDashboardV2ShowParentShellV1 === 'function') {
                window.yhDashboardV2ShowParentShellV1(target.key, 'division-apply-gate-v1');
                window.setTimeout(() => window.yhDashboardV2ShowParentShellV1(target.key, 'division-apply-gate-v1-late'), 90);
                return;
            }

            if (typeof window.yhDashboardV2RenderParent === 'function') {
                window.yhDashboardV2RenderParent(target.key);
            }

            return;
        }

        if (target.kind === 'child') {
            if (typeof window.activateDashboardUnifiedWorkspace === 'function') {
                window.activateDashboardUnifiedWorkspace(target.key, {
                    animate: false,
                    scroll: true,
                    persist: true
                });
            }
        }
    }

    function queueNavigation(target) {
        if (!target) return;

        syncAccessCards('before-navigation');

        if (target.kind === 'parent') {
            const state = getDivisionState(target.key);

            if (!state.approved && !state.pending) {
                handleNotApprovedParentClick(target.key);
                return;
            }

            if (state.pending) {
                showToastMessage(`${DIVISIONS[target.key].label} application is still under review.`, 'error');
            }
        }

        pendingTarget = target;
        showLoader(target.label || 'Opening Dashboard');

        window.clearTimeout(transitionTimer);
        transitionTimer = window.setTimeout(() => {
            const next = pendingTarget;
            pendingTarget = null;

            runTarget(next);

            window.setTimeout(hideLoader, 180);
        }, NAV_DELAY_MS);
    }

    function getTargetFromEvent(event) {
        if (!event?.target || !isDashboardPage()) return null;

        if (event.target.closest?.('#yh-dashboard-tab-transition-loader-v3, .yh-modal, .modal, [role="dialog"]')) {
            return null;
        }

        const applyButton = event.target.closest?.('[data-yh-overview-division-action]');
        if (applyButton) {
            const division = cleanKey(applyButton.getAttribute('data-yh-overview-division-action') || '');
            const kind = String(applyButton.getAttribute('data-yh-overview-division-action-kind') || '').trim().toLowerCase();

            if (isDivisionKey(division)) {
                if (kind === 'apply') {
                    return { kind: 'apply', key: division, label: `Opening ${DIVISIONS[division].label} Application` };
                }

                if (kind === 'enter') {
                    return { kind: 'child', key: DIVISIONS[division].childTarget, label: `Opening ${DIVISIONS[division].label}` };
                }
            }
        }

        const shell = event.target.closest?.('[data-yh-dashboard-shell]');
        if (shell) {
            const key = cleanKey(shell.getAttribute('data-yh-dashboard-shell') || '');

            if (key === 'overview') {
                return { kind: 'overview', key, label: 'Opening Dashboard' };
            }

            if (isDivisionKey(key)) {
                return { kind: 'parent', key, label: `Opening ${DIVISIONS[key].label}` };
            }
        }

        const child = event.target.closest?.('[data-yh-sidebar-child], [data-yh-mobile-subtab-menu-option], [data-yh-dashboard-v2-child]');
        if (child) {
            const key = (
                child.getAttribute('data-yh-sidebar-child') ||
                child.getAttribute('data-yh-mobile-subtab-menu-option') ||
                child.getAttribute('data-yh-dashboard-v2-child') ||
                ''
            ).trim();

            if (key) return { kind: 'child', key, label: 'Opening section' };
        }

        return null;
    }

    function interceptDashboardNavigation(event) {
        const target = getTargetFromEvent(event);
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (target.kind === 'apply') {
            showToastMessage(`${DIVISIONS[target.key].label} access is not approved yet. Please complete your application first.`, 'error');
            window.setTimeout(() => openDivisionApplication(target.key), 320);
            return;
        }

        queueNavigation(target);
    }

    window.addEventListener('click', interceptDashboardNavigation, true);

    function scheduleSync(reason = 'sync') {
        if (!isDashboardPage()) return;

        [0, 80, 240, 700, 1400, 2600, 4200].forEach((delay) => {
            window.setTimeout(() => syncAccessCards(`${reason}-${delay}`), delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scheduleSync('dom'));
    } else {
        scheduleSync('boot');
    }

    window.addEventListener('pageshow', () => scheduleSync('pageshow'));

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardDivisionApplyGateTimerV1);
            window.__yhDashboardDivisionApplyGateTimerV1 = window.setTimeout(() => {
                syncAccessCards('mutation');
            }, 80);
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

        window.__yhDashboardDivisionApplyGateObserverV1 = observer;
    } catch (_) {}

    window.yhDashboardDivisionApplyGateV1 = {
        syncAccessCards,
        getDivisionState,
        openDivisionApplication,
        handleNotApprovedParentClick,
        queueNavigation
    };
})();
/* END PATCH: Dashboard division apply gate v1 */

