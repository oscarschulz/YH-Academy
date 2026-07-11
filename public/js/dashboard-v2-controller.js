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
        node.removeAttribute('hidden');
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.setProperty('display', display || 'block', 'important');
            node.style.setProperty('visibility', 'visible', 'important');
            node.style.setProperty('opacity', '1', 'important');
            node.style.setProperty('pointer-events', 'auto', 'important');
            return;
        }

        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('opacity', '0', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
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
        const sourceState = (() => {
            try {
                const source = window.yhDivisionAccessSourceOfTruthV1?.getState?.(key);
                if (!source || typeof source !== 'object') return null;

                const rawStatus = String(
                    source.status ||
                    source.rawStatus ||
                    source.state ||
                    ''
                ).trim().toLowerCase().replace(/[_-]+/g, ' ');

                const canEnter =
                    source.canEnter === true ||
                    source.approved === true ||
                    source.hasAccess === true;

                if (canEnter || rawStatus === 'approved' || rawStatus === 'active') {
                    return {
                        approved: true,
                        pending: false,
                        rejected: false,
                        status: 'approved',
                        label: 'Approved'
                    };
                }

                if (
                    rawStatus === 'pending' ||
                    rawStatus === 'under review' ||
                    rawStatus === 'submitted' ||
                    rawStatus === 'in review'
                ) {
                    return {
                        approved: false,
                        pending: true,
                        rejected: false,
                        status: 'pending',
                        label: 'Pending'
                    };
                }

                if (
                    rawStatus === 'rejected' ||
                    rawStatus === 'declined' ||
                    rawStatus === 'denied'
                ) {
                    return {
                        approved: false,
                        pending: false,
                        rejected: true,
                        status: 'rejected',
                        label: 'Rejected'
                    };
                }

                if (rawStatus === 'not applied' || rawStatus === 'not_applied') {
                    return {
                        approved: false,
                        pending: false,
                        rejected: false,
                        status: 'not_applied',
                        label: 'Not Applied'
                    };
                }

                return null;
            } catch (_) {
                return null;
            }
        })();

        if (sourceState) return sourceState;

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

        if (!mount) {
            mount = document.createElement('section');
            mount.id = 'yh-dashboard-v2-parent-shell';
            mount.className = 'yh-dashboard-v2-parent-shell hidden-step';
            mount.setAttribute('aria-hidden', 'true');
        }

        const root = dashboardRoot();
        const safeStage =
            document.querySelector('#universe-hub-view .yh-universe-carousel-shell') ||
            document.querySelector('#universe-hub-view .yh-universe-hub-shell') ||
            document.getElementById('universe-hub-view') ||
            root;

        const firstContent = safeStage?.querySelector?.(
            '.yh-command-dashboard-head, #yh-dashboard-overview-dynamic-access-row-v1, #yh-universe-referral-card, #yh-universe-academy-strip'
        );

        const hiddenAncestor = mount.closest?.(
            '.hidden-step, .yh-universe-stage-nav, .yh-academy-parent-vision-scope, .yh-dashboard-division-intro-v1, #yh-dashboard-division-parent-intro-v1'
        );

        if (!mount.parentNode || hiddenAncestor || !safeStage.contains(mount)) {
            if (firstContent && firstContent.parentNode === safeStage) {
                safeStage.insertBefore(mount, firstContent);
            } else {
                safeStage.prepend(mount);
            }
        }

        mount.classList.remove('hidden-step');
        mount.removeAttribute('hidden');
        mount.setAttribute('aria-hidden', 'false');
        mount.style.setProperty('display', 'block', 'important');
        mount.style.setProperty('visibility', 'visible', 'important');
        mount.style.setProperty('opacity', '1', 'important');
        mount.style.setProperty('pointer-events', 'auto', 'important');

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
        const group =
            document.querySelector(`[data-yh-sidebar-division="${key}"]`) ||
            parent?.closest?.('.sidebar-division, .nav-group, .yh-sidebar-division, li, div');

        const shouldShow = open && approved;

        if (group) {
            group.classList.toggle('is-expanded', shouldShow);
            group.classList.toggle('is-open', shouldShow);
            group.classList.toggle('is-active', open);
            group.classList.toggle('active', open);
            group.classList.toggle('is-manually-collapsed', !shouldShow);
            group.classList.remove('is-manually-expanded');

            if (shouldShow) {
                group.classList.add('is-manually-expanded');
            }

            group.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
            group.setAttribute('data-yh-sidebar-subnav-open', shouldShow ? 'true' : 'false');
            group.setAttribute('data-yh-sidebar-collapsed', shouldShow ? 'false' : 'true');
            group.setAttribute('data-yh-v2-child-access', approved ? 'unlocked' : 'locked');
        }

        if (parent) {
            parent.classList.toggle('is-active', open);
            parent.classList.toggle('active', open);
            parent.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
            parent.setAttribute('aria-selected', open ? 'true' : 'false');
        }

        if (subnav) {
            subnav.classList.toggle('yh-dashboard-v2-gated-subnav', !approved);
            subnav.classList.remove('hidden-step');
            subnav.removeAttribute('hidden');
            subnav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');

            if (shouldShow) {
                subnav.style.setProperty('display', 'grid', 'important');
                subnav.style.setProperty('visibility', 'visible', 'important');
                subnav.style.setProperty('opacity', '1', 'important');
                subnav.style.setProperty('pointer-events', 'auto', 'important');
                subnav.style.setProperty('max-height', 'none', 'important');
                subnav.style.setProperty('overflow', 'visible', 'important');
            } else {
                setVisible(subnav, false, 'block');
            }
        }

        document.querySelectorAll(config.childSelector).forEach((child) => {
            child.classList.toggle('yh-dashboard-v2-gated-child', !approved);

            if (shouldShow) {
                child.classList.remove('hidden-step');
                child.removeAttribute('hidden');
                child.setAttribute('aria-hidden', 'false');
                child.style.setProperty('display', child.tagName === 'BUTTON' ? 'inline-flex' : 'block', 'important');
                child.style.setProperty('visibility', 'visible', 'important');
                child.style.setProperty('opacity', '1', 'important');
                child.style.setProperty('pointer-events', 'auto', 'important');
            } else {
                setVisible(child, false, child.tagName === 'BUTTON' ? 'block' : '');
            }
        });

        if (shouldShow) {
            document.body?.setAttribute('data-yh-active-sidebar-division', key);
        }
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

        if (key === 'federation' && typeof window.yhDashboardOpenFederationApplicationModalDirectV1 === 'function') {
            return window.yhDashboardOpenFederationApplicationModalDirectV1('source-of-truth-apply');
        }

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

        document.body.classList.remove('yh-dashboard-child-workspace-active');
        document.body.classList.remove('yh-dashboard-inline-child-active');
        document.body.classList.remove('yh-dashboard-child-transitioning');
        document.body.removeAttribute('data-yh-dashboard-child-workspace');
        document.body.removeAttribute('data-yh-dashboard-child-target');

        document.body.setAttribute('data-yh-dashboard-v2-active', key);
        document.body.setAttribute('data-yh-unified-workspace', key);
        document.body.setAttribute('data-yh-unified-division', key);
        document.body.setAttribute('data-yh-dashboard-v2-approved', approved ? 'true' : 'false');
        document.body.setAttribute('data-yh-dashboard-v2-status', approved ? 'approved' : state.pending ? 'pending' : state.rejected ? 'rejected' : 'not-applied');

        const existingParentShell = document.getElementById('yh-dashboard-v2-parent-shell');
        if (existingParentShell) {
            existingParentShell.removeAttribute('data-yh-v2-parent-suppressed');
        }

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

    function getDivisionFromChildKeyV2(key = '') {
        const clean = String(key || '').trim().toLowerCase();

        if (clean.startsWith('academy-')) return 'academy';
        if (clean.startsWith('plazas-')) return 'plazas';
        if (clean.startsWith('federation-')) return 'federation';

        return '';
    }

    function forceDashboardChildWorkspaceVisibleV2(target = '') {
        const cleanTarget = String(target || '').trim().toLowerCase();
        const division = getDivisionFromChildKeyV2(cleanTarget);

        if (!cleanTarget || !division) return;

        const previousTarget = String(
            document.body?.getAttribute('data-yh-dashboard-child-workspace') || ''
        ).trim().toLowerCase();

        const isNewTarget = previousTarget !== cleanTarget;

        window.__yhDashboardChildWorkspaceOpenAt = Date.now();
        window.__yhDashboardApprovedParentRenderToken = '';
        window.__yhDashboardActiveChildTargetV2 = cleanTarget;

        if (isNewTarget) {
            document.body?.classList.add('yh-dashboard-child-transitioning');

            window.clearTimeout(window.__yhDashboardChildTransitionReleaseV2);
            window.clearTimeout(window.__yhDashboardChildTransitionReleaseLateV2);

            window.__yhDashboardChildTransitionReleaseV2 = window.setTimeout(() => {
                if (String(document.body?.getAttribute('data-yh-dashboard-child-workspace') || '').trim().toLowerCase() === cleanTarget) {
                    document.body?.classList.remove('yh-dashboard-child-transitioning');
                }
            }, 620);

            window.__yhDashboardChildTransitionReleaseLateV2 = window.setTimeout(() => {
                if (String(document.body?.getAttribute('data-yh-dashboard-child-workspace') || '').trim().toLowerCase() === cleanTarget) {
                    document.body?.classList.remove('yh-dashboard-child-transitioning');
                }
            }, 1400);
        }

        document.body?.removeAttribute('data-yh-dashboard-v2-active');
        document.body?.removeAttribute('data-yh-dashboard-v2-approved');
        document.body?.removeAttribute('data-yh-dashboard-v2-status');
        document.body?.removeAttribute('data-yh-dashboard-v2-lock');

        document.body?.classList.add('yh-dashboard-child-workspace-active');
        document.body?.classList.add('yh-dashboard-inline-child-active');
        document.body?.setAttribute('data-yh-dashboard-child-workspace', cleanTarget);
        document.body?.setAttribute('data-yh-dashboard-child-target', cleanTarget);
        document.body?.setAttribute('data-yh-unified-workspace', cleanTarget);
        document.body?.setAttribute('data-yh-unified-division', division);
        document.body?.setAttribute('data-yh-active-sidebar-division', division);

        const parentShell = document.getElementById('yh-dashboard-v2-parent-shell');

        if (parentShell) {
            parentShell.classList.add('hidden-step');
            parentShell.setAttribute('aria-hidden', 'true');
            parentShell.setAttribute('data-yh-v2-parent-suppressed', 'true');
            parentShell.style.setProperty('display', 'none', 'important');
            parentShell.style.setProperty('visibility', 'hidden', 'important');
            parentShell.style.setProperty('opacity', '0', 'important');
            parentShell.style.setProperty('pointer-events', 'none', 'important');
            parentShell.style.setProperty('max-height', '0', 'important');
            parentShell.style.setProperty('min-height', '0', 'important');
            parentShell.style.setProperty('height', '0', 'important');
            parentShell.style.setProperty('margin', '0', 'important');
            parentShell.style.setProperty('padding', '0', 'important');
            parentShell.style.setProperty('overflow', 'hidden', 'important');
        }

        const launchCard = document.getElementById('yh-universe-workspace-launch-card');
        const frameShell = document.getElementById('yh-universe-workspace-frame-shell');
        const inlineFrame = document.getElementById('yh-universe-workspace-inline-frame');

        setVisible(launchCard, true, 'grid');
        setVisible(frameShell, true, 'block');

        if (inlineFrame) {
            inlineFrame.classList.remove('hidden-step');
            inlineFrame.setAttribute('aria-hidden', 'false');
            inlineFrame.style.setProperty('display', 'block', 'important');
            inlineFrame.style.setProperty('visibility', 'visible', 'important');
            inlineFrame.style.setProperty('opacity', '1', 'important');
            inlineFrame.style.setProperty('pointer-events', 'auto', 'important');
        }

        document.querySelectorAll('[data-yh-sidebar-child]').forEach((node) => {
            const key = String(node.getAttribute('data-yh-sidebar-child') || '').trim().toLowerCase();
            const isActive = key === cleanTarget;

            node.classList.toggle('is-active', isActive);
            node.classList.toggle('active', isActive);
            node.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const parentButton = document.querySelector(`[data-yh-dashboard-shell="${division}"]`);
        const parentGroup = document.querySelector(`[data-yh-sidebar-division="${division}"]`);
        const subnav = document.getElementById(`yh-sidebar-subnav-${division}`);

        if (parentButton) {
            parentButton.classList.add('is-active', 'active');
            parentButton.setAttribute('aria-expanded', 'true');
            parentButton.setAttribute('aria-selected', 'true');
        }

        if (parentGroup) {
            parentGroup.classList.add('is-expanded', 'is-active', 'active');
            parentGroup.classList.remove('is-manually-collapsed');
            parentGroup.classList.add('is-manually-expanded');
            parentGroup.setAttribute('aria-expanded', 'true');
            parentGroup.setAttribute('data-yh-sidebar-subnav-open', 'true');
            parentGroup.setAttribute('data-yh-sidebar-collapsed', 'false');
            parentGroup.setAttribute('data-yh-v2-child-access', 'unlocked');
        }

        if (subnav) {
            subnav.classList.remove('hidden-step', 'yh-dashboard-v2-gated-subnav');
            subnav.setAttribute('aria-hidden', 'false');
            subnav.style.setProperty('display', 'grid', 'important');
            subnav.style.setProperty('visibility', 'visible', 'important');
            subnav.style.setProperty('opacity', '1', 'important');
            subnav.style.setProperty('pointer-events', 'auto', 'important');
            subnav.style.setProperty('max-height', 'none', 'important');
            subnav.style.setProperty('overflow', 'visible', 'important');
        }
    }

    document.addEventListener('click', (event) => {
        const child = event.target?.closest?.(
            '[data-yh-dashboard-v2-child], [data-yh-sidebar-child], [data-yh-mobile-subtab], [data-yh-mobile-subtab-menu-option]'
        );

        if (!child) return;

        const target = String(
            child.getAttribute('data-yh-dashboard-v2-child') ||
            child.getAttribute('data-yh-sidebar-child') ||
            child.getAttribute('data-yh-mobile-subtab') ||
            child.getAttribute('data-yh-mobile-subtab-menu-option') ||
            ''
        ).trim();

        if (!target || !getDivisionFromChildKeyV2(target)) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        window.__yhDashboardChildWorkspaceOpenAt = Date.now();
        window.__yhDashboardApprovedParentRenderToken = '';

        forceDashboardChildWorkspaceVisibleV2(target);

        const activate =
            typeof window.__yhDashboardV2NativeActivateWorkspaceV1 === 'function'
                ? window.__yhDashboardV2NativeActivateWorkspaceV1
                : window.activateDashboardUnifiedWorkspace;

        if (typeof activate === 'function') {
            activate(target, {
                animate: false,
                scroll: true,
                persist: true
            });
        }

        [40, 140, 320, 720, 1400, 2600, 4200, 6500].forEach((delay) => {
            window.setTimeout(() => forceDashboardChildWorkspaceVisibleV2(target), delay);
        });
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
        node.removeAttribute('hidden');
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.setProperty('display', display || 'block', 'important');
            node.style.setProperty('visibility', 'visible', 'important');
            node.style.setProperty('opacity', '1', 'important');
            node.style.setProperty('pointer-events', 'auto', 'important');
            return;
        }

        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('opacity', '0', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
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
            const group = document.querySelector(`[data-yh-sidebar-division="${key}"]`);
            const button = document.querySelector(`[data-yh-dashboard-shell="${key}"]`);
            const subnav = document.getElementById(`yh-sidebar-subnav-${key}`);

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
            }

            if (button) {
                button.classList.remove('active', 'is-active');
                button.setAttribute('aria-expanded', 'false');
                button.setAttribute('aria-selected', 'false');
            }

            if (subnav) {
                setVisible(subnav, false, 'block');
            }

            document.querySelectorAll(`[data-yh-sidebar-child^="${key}-"]`).forEach((child) => {
                child.classList.remove('active', 'is-active');
                child.setAttribute('aria-selected', 'false');
            });
        });
    }

    function forceOpenApprovedSubnav(key = '') {
        const clean = normalizeKey(key);
        if (!isParentKey(clean)) return;

        const state = (() => {
            try {
                return window.yhDivisionAccessSourceOfTruthV1?.getState?.(clean) || null;
            } catch (_) {
                return null;
            }
        })();

        const rawStatus = String(state?.status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
        const approved =
            state?.canEnter === true ||
            state?.approved === true ||
            rawStatus === 'approved' ||
            rawStatus === 'active' ||
            document.body?.getAttribute('data-yh-dashboard-v2-approved') === 'true';

        if (!approved) return;

        const group = document.querySelector(`[data-yh-sidebar-division="${clean}"]`);
        const button = document.querySelector(`[data-yh-dashboard-shell="${clean}"]`);
        const subnav = document.getElementById(`yh-sidebar-subnav-${clean}`);

        document.body?.setAttribute('data-yh-active-sidebar-division', clean);
        document.body?.setAttribute('data-yh-unified-workspace', clean);
        document.body?.setAttribute('data-yh-unified-division', clean);
        document.body?.setAttribute('data-yh-dashboard-v2-approved', 'true');
        document.body?.setAttribute('data-yh-dashboard-v2-status', 'approved');

        document.querySelectorAll('[data-yh-dashboard-shell]').forEach((node) => {
            const nodeKey = normalizeKey(node.getAttribute('data-yh-dashboard-shell') || '');
            const isActive = nodeKey === clean;

            node.classList.toggle('active', isActive);
            node.classList.toggle('is-active', isActive);
            node.setAttribute('aria-selected', isActive ? 'true' : 'false');

            if (nodeKey && nodeKey !== 'overview') {
                node.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            }
        });

        ['academy', 'plazas', 'federation'].forEach((division) => {
            if (division === clean) return;

            const otherGroup = document.querySelector(`[data-yh-sidebar-division="${division}"]`);
            const otherSubnav = document.getElementById(`yh-sidebar-subnav-${division}`);

            if (otherGroup) {
                otherGroup.classList.remove('is-expanded', 'is-open', 'is-active', 'active', 'is-manually-expanded');
                otherGroup.classList.add('is-manually-collapsed');
                otherGroup.setAttribute('aria-expanded', 'false');
                otherGroup.setAttribute('data-yh-sidebar-subnav-open', 'false');
                otherGroup.setAttribute('data-yh-sidebar-collapsed', 'true');
            }

            if (otherSubnav) setVisible(otherSubnav, false, 'block');
        });

        if (group) {
            group.classList.add('is-expanded', 'is-open', 'is-active', 'active', 'is-manually-expanded');
            group.classList.remove('is-manually-collapsed');
            group.setAttribute('aria-expanded', 'true');
            group.setAttribute('data-yh-sidebar-subnav-open', 'true');
            group.setAttribute('data-yh-sidebar-collapsed', 'false');
            group.setAttribute('data-yh-v2-child-access', 'unlocked');
        }

        if (button) {
            button.classList.add('active', 'is-active');
            button.setAttribute('aria-expanded', 'true');
            button.setAttribute('aria-selected', 'true');
        }

        if (subnav) {
            subnav.classList.remove('hidden-step', 'yh-dashboard-v2-gated-subnav');
            subnav.removeAttribute('hidden');
            subnav.setAttribute('aria-hidden', 'false');
            subnav.style.setProperty('display', 'grid', 'important');
            subnav.style.setProperty('visibility', 'visible', 'important');
            subnav.style.setProperty('opacity', '1', 'important');
            subnav.style.setProperty('pointer-events', 'auto', 'important');
            subnav.style.setProperty('max-height', 'none', 'important');
            subnav.style.setProperty('overflow', 'visible', 'important');
        }

        document.querySelectorAll(`[data-yh-sidebar-child^="${clean}-"]`).forEach((child) => {
            child.classList.remove('hidden-step', 'yh-dashboard-v2-gated-child');
            child.setAttribute('aria-hidden', 'false');
            child.style.setProperty('display', 'grid', 'important');
            child.style.setProperty('visibility', 'visible', 'important');
            child.style.setProperty('opacity', '1', 'important');
            child.style.setProperty('pointer-events', 'auto', 'important');
        });
    }

    function showOverviewShell(reason = 'overview') {
        if (!isDashboardPage()) return;

        clearV2ParentAttrs();

        document.body?.setAttribute('data-yh-unified-workspace', 'overview');
        document.body?.setAttribute('data-yh-unified-division', 'overview');
        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');
        document.body?.classList.remove('yh-dashboard-child-transitioning');
        document.body?.removeAttribute('data-yh-dashboard-child-workspace');
        document.body?.removeAttribute('data-yh-dashboard-child-target');

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

        const reasonText = String(reason || '').trim().toLowerCase();
        const currentWorkspace = String(document.body?.getAttribute('data-yh-unified-workspace') || '').trim().toLowerCase();
        const childOpenAt = Number(window.__yhDashboardChildWorkspaceOpenAt || 0);
        const childRecentlyOpened = childOpenAt && Date.now() - childOpenAt < 6500;
        const childWorkspaceActive =
            /^academy-|^plazas-|^federation-/.test(currentWorkspace) ||
            document.body?.classList.contains('yh-dashboard-child-workspace-active') ||
            document.body?.classList.contains('yh-dashboard-inline-child-active');

        const isRealParentRequest =
            reasonText.includes('shell-click') ||
            reasonText.includes('activate-parent') ||
            reasonText.includes('manual-parent') ||
            reasonText.includes('user-parent-click');

        if (childWorkspaceActive && childRecentlyOpened && !isRealParentRequest) {
            const mount = document.getElementById('yh-dashboard-v2-parent-shell');
            setVisible(mount, false, 'block');
            return;
        }

        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');
        document.body?.removeAttribute('data-yh-dashboard-child-workspace');

        document.body?.setAttribute('data-yh-dashboard-v2-active', clean);
        document.body?.setAttribute('data-yh-dashboard-v2-lock', clean);
        document.body?.removeAttribute('data-yh-dashboard-v2-instant-parent');
        document.body?.setAttribute('data-yh-unified-workspace', clean);
        document.body?.setAttribute('data-yh-unified-division', clean);

        const parentShell = document.getElementById('yh-dashboard-v2-parent-shell');
        if (parentShell) {
            parentShell.removeAttribute('data-yh-v2-parent-suppressed');
        }

        setSidebarParentActive(clean);
        forceOpenApprovedSubnav(clean);

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

        forceOpenApprovedSubnav(clean);

        const mount = document.getElementById('yh-dashboard-v2-parent-shell');
        setVisible(mount, true, 'block');

        hideOverviewSurfaces();

        function shouldAbortParentShellRescue() {
            const childOpenAt = Number(window.__yhDashboardChildWorkspaceOpenAt || 0);

            return (
                document.body?.classList.contains('yh-dashboard-child-workspace-active') ||
                document.body?.classList.contains('yh-dashboard-inline-child-active') ||
                (childOpenAt && Date.now() - childOpenAt < 5200)
            );
        }

        window.requestAnimationFrame(() => {
            if (shouldAbortParentShellRescue()) return;

            const freshMount = document.getElementById('yh-dashboard-v2-parent-shell');
            setVisible(freshMount, true, 'block');
            forceOpenApprovedSubnav(clean);
        });

        [80, 240, 520, 1100].forEach((delay) => {
            window.setTimeout(() => {
                if (shouldAbortParentShellRescue()) return;

                const freshMount = document.getElementById('yh-dashboard-v2-parent-shell');
                setVisible(freshMount, true, 'block');
                forceOpenApprovedSubnav(clean);
            }, delay);
        });
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
            const rawKey = String(key || '').trim().toLowerCase();
            const parentKey = normalizeKey(rawKey);
            const childDivision =
                rawKey.startsWith('academy-') ? 'academy' :
                rawKey.startsWith('plazas-') ? 'plazas' :
                rawKey.startsWith('federation-') ? 'federation' :
                '';

            if (rawKey === 'overview' || rawKey === 'dashboard' || rawKey === 'hub' || !rawKey) {
                const result = nativeActivate.call(this, 'overview', options);
                window.setTimeout(() => showOverviewShell('activate-overview'), 0);
                window.setTimeout(() => showOverviewShell('activate-overview-late'), 120);
                return result;
            }

            if (isParentKey(parentKey)) {
                showParentShell(parentKey, 'activate-parent');
                return { key: parentKey, division: parentKey, source: 'dashboard-v2-stable-shell' };
            }

            if (!childDivision) {
                return nativeActivate.apply(this, arguments);
            }

            /*
              Child workspace: let old dashboard.js render it.
              Remove V2 parent lock so child tabs can display real workspace content.
            */
            window.__yhDashboardChildWorkspaceOpenAt = Date.now();
            window.__yhDashboardApprovedParentRenderToken = '';

            clearV2ParentAttrs();

            document.body?.classList.add('yh-dashboard-child-workspace-active');
            document.body?.classList.add('yh-dashboard-inline-child-active');
            document.body?.setAttribute('data-yh-dashboard-child-workspace', rawKey);
            document.body?.setAttribute('data-yh-unified-workspace', rawKey);
            document.body?.setAttribute('data-yh-unified-division', childDivision);

            const suppressParentShell = () => {
                const parentShell = document.getElementById('yh-dashboard-v2-parent-shell');

                if (!parentShell) return;

                parentShell.classList.add('hidden-step');
                parentShell.setAttribute('aria-hidden', 'true');
                parentShell.setAttribute('data-yh-v2-parent-suppressed', 'true');
                parentShell.style.setProperty('display', 'none', 'important');
                parentShell.style.setProperty('visibility', 'hidden', 'important');
                parentShell.style.setProperty('opacity', '0', 'important');
                parentShell.style.setProperty('pointer-events', 'none', 'important');
                parentShell.style.setProperty('max-height', '0', 'important');
                parentShell.style.setProperty('min-height', '0', 'important');
                parentShell.style.setProperty('height', '0', 'important');
                parentShell.style.setProperty('margin', '0', 'important');
                parentShell.style.setProperty('padding', '0', 'important');
                parentShell.style.setProperty('overflow', 'hidden', 'important');
            };

            suppressParentShell();

            const result = nativeActivate.apply(this, arguments);

            const revealChildWorkspace = () => {
                const launchCard = document.getElementById('yh-universe-workspace-launch-card');
                const frameShell = document.getElementById('yh-universe-workspace-frame-shell');
                const inlineFrame = document.getElementById('yh-universe-workspace-inline-frame');

                clearV2ParentAttrs();

                document.body?.classList.add('yh-dashboard-child-workspace-active');
                document.body?.classList.add('yh-dashboard-inline-child-active');
                document.body?.setAttribute('data-yh-dashboard-child-workspace', rawKey);
                document.body?.setAttribute('data-yh-unified-workspace', rawKey);
                document.body?.setAttribute('data-yh-unified-division', childDivision);

                suppressParentShell();

                setVisible(launchCard, true, 'grid');
                setVisible(frameShell, true, 'block');

                if (inlineFrame) {
                    inlineFrame.classList.remove('hidden-step');
                    inlineFrame.setAttribute('aria-hidden', 'false');
                    inlineFrame.style.setProperty('display', 'block', 'important');
                    inlineFrame.style.setProperty('visibility', 'visible', 'important');
                    inlineFrame.style.setProperty('opacity', '1', 'important');
                    inlineFrame.style.setProperty('pointer-events', 'auto', 'important');
                }
            };

            revealChildWorkspace();

            [40, 140, 320, 720, 1400, 2600, 4200, 6500].forEach((delay) => {
                window.setTimeout(revealChildWorkspace, delay);
            });

            return result;
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
            if (typeof window.yhDashboardOpenFederationApplicationModalDirectV1 === 'function') {
                return window.yhDashboardOpenFederationApplicationModalDirectV1('overview-apply-v2');
            }

            const modal = document.getElementById('federation-apply-modal');
            if (modal) {
                modal.classList.remove('hidden-step');
                modal.removeAttribute('hidden');
                modal.setAttribute('aria-hidden', 'false');
                document.body?.classList.add('federation-application-open');
                return true;
            }

            if (typeof window.openFederationApplicationModal === 'function') {
                Promise.resolve(window.openFederationApplicationModal()).catch((error) => {
                    console.error('openFederationApplicationModal error:', error);
                });
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
        node.removeAttribute('hidden');
        node.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (visible) {
            node.style.setProperty('display', display || 'block', 'important');
            node.style.setProperty('visibility', 'visible', 'important');
            node.style.setProperty('opacity', '1', 'important');
            node.style.setProperty('pointer-events', 'auto', 'important');
            return;
        }

        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('opacity', '0', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
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
        const activeParent = String(document.body?.getAttribute('data-yh-dashboard-v2-active') || '').trim().toLowerCase();
        const approvedParentOpenAt = Number(window.__yhDashboardApprovedParentOpenAt || 0);
        const approvedParentRecentlyOpened = approvedParentOpenAt && Date.now() - approvedParentOpenAt < 4200;

        if (hasExplicitChildIntent()) return;

        if (
            approvedParentRecentlyOpened ||
            (current && current !== 'overview') ||
            ['academy', 'plazas', 'federation'].includes(activeParent)
        ) {
            return;
        }

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

        const current = cleanKey(document.body?.getAttribute('data-yh-unified-workspace') || 'overview');
        const activeParent = cleanKey(document.body?.getAttribute('data-yh-dashboard-v2-active') || '');
        const approvedParentOpenAt = Number(window.__yhDashboardApprovedParentOpenAt || 0);
        const approvedParentRecentlyOpened = approvedParentOpenAt && Date.now() - approvedParentOpenAt < 4200;

        if (hasExplicitChildIntent()) return;

        if (
            approvedParentRecentlyOpened ||
            (current && current !== 'overview') ||
            isParentDivision(activeParent)
        ) {
            return;
        }

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


/* PATCH: YHU division access source of truth v1 */
(function installYHUDivisionAccessSourceOfTruthV1() {
    if (window.__yhDivisionAccessSourceOfTruthV1Installed) return;
    window.__yhDivisionAccessSourceOfTruthV1Installed = true;

    const PENDING_BASE_KEY = 'yh_dashboard_division_application_pending_locks_v2';
    const OLD_PENDING_BASE_KEY = 'yh_dashboard_division_application_pending_locks_v1';
    const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 24 * 45;

    const DIVISIONS = {
        academy: {
            label: 'Academy',
            legacyKey: 'yh_academy_membership_status_v1',
            applyFns: ['openAcademyLauncher', 'openAcademyApplicationModal', 'openAcademyApplyModal'],
            postUrls: ['/api/academy/membership-apply'],
            childTarget: 'academy-roadmap',
            backendDivisionKeys: ['academy'],
            topAccessKeys: ['hasAcademyAccess', 'hasRoadmapAccess'],
            topStatusKeys: ['academyApplicationStatus', 'academyMembershipStatus', 'roadmapApplicationStatus']
        },
        plazas: {
            label: 'Plazas',
            legacyKey: 'yh_plaza_access_status_v1',
            applyFns: ['openPlazaApplicationModal'],
            postUrls: ['/api/plaza/application'],
            childTarget: 'plazas-feed',
            backendDivisionKeys: ['plaza', 'plazas'],
            topAccessKeys: ['hasPlazaAccess'],
            topStatusKeys: ['plazaApplicationStatus', 'plazasApplicationStatus']
        },
        federation: {
            label: 'Federation',
            legacyKey: 'yh_federation_access_status_v1',
            applyFns: ['openFederationApplicationModal'],
            postUrls: ['/api/federation/application'],
            childTarget: 'federation-command',
            backendDivisionKeys: ['federation'],
            topAccessKeys: ['hasFederationAccess'],
            topStatusKeys: ['federationApplicationStatus', 'federationMembershipStatus']
        }
    };

    let backendState = {
        loaded: false,
        loading: null,
        updatedAt: 0,
        divisions: makeDefaultState()
    };

    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    const nativeApplyFns = {};

    function makeDefaultState() {
        return Object.fromEntries(
            Object.keys(DIVISIONS).map((key) => [
                key,
                {
                    key,
                    label: DIVISIONS[key].label,
                    status: 'not_applied',
                    source: 'default',
                    canEnter: false,
                    hasApplication: false,
                    application: null
                }
            ])
        );
    }

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

    function labelFor(status = 'not_applied') {
        if (status === 'approved') return 'Approved';
        if (status === 'pending') return 'Pending';
        if (status === 'rejected') return 'Rejected';
        return 'Not Applied';
    }

    function actionFor(status = 'not_applied') {
        if (status === 'approved') return 'enter';
        if (status === 'pending') return 'pending';
        if (status === 'rejected') return 'rejected';
        return 'apply';
    }

    function decodeJwtPayload(token = '') {
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
            return String(
                localStorage.getItem('yh_auth_token') ||
                sessionStorage.getItem('yh_auth_token') ||
                localStorage.getItem('yh_token') ||
                sessionStorage.getItem('yh_token') ||
                localStorage.getItem('token') ||
                sessionStorage.getItem('token') ||
                ''
            ).trim();
        } catch (_) {
            return '';
        }
    }

    function getUserScope() {
        const payload = decodeJwtPayload(getStoredToken());

        const direct = String(
            payload.sub ||
            payload.id ||
            payload.uid ||
            payload.firebaseUid ||
            payload.email ||
            payload.username ||
            ''
        ).trim();

        if (direct) return direct.toLowerCase();

        try {
            return String(
                localStorage.getItem('yh_user_email') ||
                sessionStorage.getItem('yh_user_email') ||
                localStorage.getItem('yh_user_username') ||
                sessionStorage.getItem('yh_user_username') ||
                localStorage.getItem('yh_user_name') ||
                sessionStorage.getItem('yh_user_name') ||
                'default'
            ).trim().toLowerCase() || 'default';
        } catch (_) {
            return 'default';
        }
    }

    function pendingKey(base = PENDING_BASE_KEY) {
        return `${base}:${getUserScope()}`;
    }

    function readJson(key = '', store = localStorage, fallback = null) {
        try {
            const raw = store.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key = '', value = {}, store = localStorage) {
        try {
            store.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function readPendingLocks() {
        const current =
            readJson(pendingKey(PENDING_BASE_KEY), localStorage, null) ||
            readJson(pendingKey(PENDING_BASE_KEY), sessionStorage, null);

        if (current && typeof current === 'object' && !Array.isArray(current)) return current;

        const old =
            readJson(pendingKey(OLD_PENDING_BASE_KEY), localStorage, null) ||
            readJson(pendingKey(OLD_PENDING_BASE_KEY), sessionStorage, null);

        if (old && typeof old === 'object' && !Array.isArray(old)) {
            writePendingLocks(old);
            return old;
        }

        return {};
    }

    function writePendingLocks(locks = {}) {
        writeJson(pendingKey(PENDING_BASE_KEY), locks, localStorage);
        writeJson(pendingKey(PENDING_BASE_KEY), locks, sessionStorage);
    }

    function getPendingLock(division = '') {
        const key = cleanDivision(division);
        const locks = readPendingLocks();
        const lock = locks[key];

        if (!lock || typeof lock !== 'object') return null;

        const submittedAt = Number(lock.submittedAt || 0);
        if (submittedAt && Date.now() - submittedAt > MAX_PENDING_AGE_MS) {
            delete locks[key];
            writePendingLocks(locks);
            return null;
        }

        return lock;
    }

    function markPending(division = '', application = null, source = 'submit') {
        const key = cleanDivision(division);
        if (!key) return;

        const locks = readPendingLocks();
        locks[key] = {
            division: key,
            status: 'pending',
            submittedAt: Date.now(),
            source,
            application: application && typeof application === 'object' ? application : null
        };

        writePendingLocks(locks);
        writeLegacyPending(key, application);
        syncCards();
        syncConsumers();
    }

    function clearPending(division = '') {
        const key = cleanDivision(division);
        if (!key) return;

        const locks = readPendingLocks();
        if (locks[key]) {
            delete locks[key];
            writePendingLocks(locks);
        }
    }

    function writeLegacyPending(division = '', application = null) {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config) return;

        const snapshot = {
            hasApplication: true,
            applicationStatus: 'under review',
            status: 'under review',
            application: application && typeof application === 'object' ? application : null,
            member: null,
            source: 'user-pending-lock'
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

        writeJson(config.legacyKey, snapshot, localStorage);
        writeJson(config.legacyKey, snapshot, sessionStorage);
    }

    function purgeUnsafeSharedAccessCaches() {
        Object.entries(DIVISIONS).forEach(([key, config]) => {
            [localStorage, sessionStorage].forEach((store) => {
                const value = readJson(config.legacyKey, store, null);
                if (!value || typeof value !== 'object') return;

                const status = normalizeStatus(
                    value.applicationStatus ||
                    value.status ||
                    value.membershipStatus ||
                    value.application?.status ||
                    ''
                );

                const approvedFlag =
                    value.canEnter === true ||
                    value.canEnterAcademy === true ||
                    value.canEnterPlaza === true ||
                    value.canEnterFederation === true ||
                    value.hasAcademyAccess === true ||
                    value.hasPlazaAccess === true ||
                    value.hasFederationAccess === true ||
                    status === 'approved';

                const pendingFlag =
                    status === 'pending' ||
                    String(value.source || '').includes('pending') ||
                    Boolean(getPendingLock(key));

                if (approvedFlag || (!pendingFlag && String(value.source || '').includes('admin'))) {
                    try { store.removeItem(config.legacyKey); } catch (_) {}
                }
            });
        });
    }

    function firstTextFrom(source = {}, keys = []) {
        for (const key of keys) {
            const value = String(source?.[key] || '').trim();
            if (value) return value;
        }
        return '';
    }

    function firstBoolFrom(source = {}, keys = []) {
        return keys.some((key) => source?.[key] === true);
    }

    function extractBackendDivision(profile = {}, division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config) return makeDefaultState()[key];

        const divisions = profile?.divisions && typeof profile.divisions === 'object'
            ? profile.divisions
            : {};

        let raw = {};
        for (const backendKey of config.backendDivisionKeys) {
            if (divisions[backendKey] && typeof divisions[backendKey] === 'object') {
                raw = divisions[backendKey];
                break;
            }
        }

        if (!raw || typeof raw !== 'object') raw = {};

        const application =
            raw.application && typeof raw.application === 'object'
                ? raw.application
                : null;

        const statusCandidates = [
            raw.canEnter === true ? 'approved' : '',
            raw.isMember === true ? 'approved' : '',
            raw.hasAccess === true ? 'approved' : '',
            firstBoolFrom(profile, config.topAccessKeys) ? 'approved' : '',
            firstTextFrom(application || {}, ['status', 'reviewStatus']),
            firstTextFrom(raw, ['status', 'applicationStatus', 'membershipStatus', 'accessStatus', 'reviewStatus', 'statusLabel']),
            firstTextFrom(profile, config.topStatusKeys)
        ]
            .map((value) => normalizeStatus(value))
            .filter((value) => value && value !== 'not_applied');

        let status = 'not_applied';

        if (statusCandidates.includes('approved')) {
            status = 'approved';
        } else if (statusCandidates.includes('rejected')) {
            status = 'rejected';
        } else if (statusCandidates.includes('pending')) {
            status = 'pending';
        }

        const canEnter =
            raw.canEnter === true ||
            raw.isMember === true ||
            raw.hasAccess === true ||
            firstBoolFrom(profile, config.topAccessKeys) ||
            status === 'approved';

        if (canEnter) status = 'approved';

        const hasApplication =
            canEnter ||
            raw.hasApplication === true ||
            Boolean(application) ||
            status === 'pending' ||
            status === 'rejected' ||
            status === 'approved';

        return {
            key,
            label: config.label,
            status,
            statusLabel: labelFor(status),
            canEnter,
            hasApplication,
            application,
            raw,
            source: 'backend-profile'
        };
    }

    function applyPendingLockIfNeeded(state = {}) {
        const key = cleanDivision(state.key);
        if (!key) return state;

        if (state.status === 'approved' || state.status === 'rejected') {
            clearPending(key);
            return state;
        }

        const lock = getPendingLock(key);
        if (!lock) return state;

        return {
            ...state,
            status: 'pending',
            statusLabel: 'Pending',
            canEnter: false,
            hasApplication: true,
            application: state.application || lock.application || null,
            source: 'local-pending-lock'
        };
    }

    async function fetchBackendProfile(force = false) {
        if (!isDashboardPage() || !nativeFetch) return backendState;

        const now = Date.now();
        if (!force && backendState.loaded && now - Number(backendState.updatedAt || 0) < 8000) return backendState;
        if (backendState.loading) return backendState.loading;

        backendState.loading = (async () => {
            const token = getStoredToken();
            const headers = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await nativeFetch('/api/universe/profile', {
                method: 'GET',
                credentials: 'include',
                headers
            });

            if (!response.ok) throw new Error(`Universe profile failed: ${response.status}`);

            const result = await response.json().catch(() => ({}));
            const profile =
                result?.profile && typeof result.profile === 'object'
                    ? result.profile
                    : result?.user && typeof result.user === 'object'
                        ? result.user
                        : result && typeof result === 'object'
                            ? result
                            : {};

            const next = {};
            Object.keys(DIVISIONS).forEach((key) => {
                next[key] = applyPendingLockIfNeeded(extractBackendDivision(profile, key));
            });

            backendState = {
                loaded: true,
                loading: null,
                updatedAt: Date.now(),
                profile,
                divisions: next
            };

            purgeUnsafeSharedAccessCaches();
            syncCards();
            syncConsumers();

            return backendState;
        })().catch((error) => {
            console.warn('YHU division access profile sync failed:', error?.message || error);

            const next = {};
            Object.keys(DIVISIONS).forEach((key) => {
                next[key] = applyPendingLockIfNeeded({
                    ...makeDefaultState()[key],
                    source: 'profile-sync-failed'
                });
            });

            backendState = {
                loaded: true,
                loading: null,
                updatedAt: Date.now(),
                divisions: next
            };

            syncCards();
            syncConsumers();

            return backendState;
        });

        return backendState.loading;
    }

    function getState(division = '') {
        const key = cleanDivision(division);
        if (!key) return null;
        const current = backendState.divisions[key] || makeDefaultState()[key];
        return applyPendingLockIfNeeded(current);
    }

    function buildSnapshot(division = '') {
        const key = cleanDivision(division);
        const state = getState(key) || makeDefaultState()[key];

        const snapshot = {
            hasApplication: state.hasApplication === true,
            applicationStatus: state.status,
            status: state.status,
            statusLabel: labelFor(state.status),
            application: state.application || null,
            member: state.canEnter ? { status: 'Active', division: state.label } : null,
            source: state.source || 'yhu-access-source-of-truth-v1'
        };

        if (key === 'academy') {
            snapshot.canEnterAcademy = state.status === 'approved';
            snapshot.hasAcademyAccess = state.status === 'approved';
            snapshot.hasRoadmapAccess = state.status === 'approved';
            snapshot.academyApplicationStatus = state.status;
        }

        if (key === 'plazas') {
            snapshot.canEnterPlaza = state.status === 'approved';
            snapshot.hasPlazaAccess = state.status === 'approved';
            snapshot.plazaApplicationStatus = state.status;
        }

        if (key === 'federation') {
            snapshot.canEnterFederation = state.status === 'approved';
            snapshot.hasFederationAccess = state.status === 'approved';
            snapshot.federationApplicationStatus = state.status;
        }

        return snapshot;
    }

    function overrideSnapshotFns() {
        window.readAcademyMembershipCache = function readAcademyMembershipCacheSourceOfTruthV1() {
            return buildSnapshot('academy');
        };

        window.getPlazaAccessSnapshot = function getPlazaAccessSnapshotSourceOfTruthV1() {
            return buildSnapshot('plazas');
        };
        window.readDashboardPlazaAccessSnapshot = window.getPlazaAccessSnapshot;

        window.getFederationAccessSnapshot = function getFederationAccessSnapshotSourceOfTruthV1() {
            return buildSnapshot('federation');
        };
        window.readDashboardFederationAccessSnapshot = window.getFederationAccessSnapshot;

        window.refreshPlazaAccessStatusFromBackend = async function refreshPlazaAccessStatusFromBackendSourceOfTruthV1(forceFresh = true) {
            await fetchBackendProfile(Boolean(forceFresh));
            return buildSnapshot('plazas');
        };

        window.refreshFederationAccessStatusFromBackend = async function refreshFederationAccessStatusFromBackendSourceOfTruthV1(forceFresh = true) {
            await fetchBackendProfile(Boolean(forceFresh));
            return buildSnapshot('federation');
        };
    }

    function showToastMessage(message = '', type = 'error') {
        if (typeof window.showToast === 'function') window.showToast(message, type);
    }

    function syncCard(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        const state = getState(key);
        if (!config || !state) return;

        const status = normalizeStatus(state.status);
        const action = actionFor(status);
        const card = document.querySelector(`[data-yh-overview-division-card="${key}"]`);
        const statusNode = card?.querySelector?.('.yh-dashboard-overview-access-status-v1');
        const button = card?.querySelector?.('[data-yh-overview-division-action]');

        if (card) {
            card.setAttribute('data-yh-division-access-state', action);
            card.classList.remove('is-apply', 'is-enter', 'is-pending', 'is-rejected', 'is-approved');
            card.classList.add(`is-${action}`);
        }

        if (statusNode) statusNode.textContent = labelFor(status);

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

        syncSubnavAccess(key, status === 'approved');
    }

    function syncCards() {
        if (!isDashboardPage()) return;
        Object.keys(DIVISIONS).forEach(syncCard);
    }

    function syncConsumers() {
        try { window.yhRenderDashboardOverviewDynamicAccessRowV1?.(); } catch (_) {}
        try { /* source-of-truth sync must not rerender full Dashboard overview */ } catch (_) {}
        try { window.renderYHEconomicSnapshot?.(); } catch (_) {}
    }

    function syncSubnavAccess(division = '', approved = false) {
        const key = cleanDivision(division);
        if (!key) return;

        const active = cleanDivision(document.body?.getAttribute('data-yh-dashboard-v2-active') || '') === key;
        const shouldShow = approved && active;

        const group = document.querySelector(`[data-yh-sidebar-division="${key}"]`);
        const parent = document.querySelector(`[data-yh-dashboard-shell="${key}"]`);
        const subnav = document.getElementById(`yh-sidebar-subnav-${key}`);

        if (group) {
            group.classList.toggle('is-expanded', shouldShow);
            group.classList.toggle('is-open', shouldShow);
            group.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
            group.setAttribute('data-yh-sidebar-collapsed', shouldShow ? 'false' : 'true');
        }

        if (parent) parent.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');

        if (subnav) {
            subnav.classList.toggle('hidden-step', !shouldShow);
            subnav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');

            if (shouldShow) {
                subnav.style.removeProperty('display');
                subnav.style.removeProperty('visibility');
                subnav.style.removeProperty('opacity');
                subnav.style.removeProperty('pointer-events');
            } else {
                subnav.style.setProperty('display', 'none', 'important');
                subnav.style.setProperty('visibility', 'hidden', 'important');
                subnav.style.setProperty('opacity', '0', 'important');
                subnav.style.setProperty('pointer-events', 'none', 'important');
            }
        }

        document.querySelectorAll(`[data-yh-sidebar-child^="${key}-"], [data-yh-mobile-subtab-menu-option^="${key}-"]`).forEach((node) => {
            node.classList.toggle('hidden-step', !shouldShow);
            node.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        });
    }

    function openApprovedParent(division = '') {
        const key = cleanDivision(division);
        const state = getState(key);
        if (!key || normalizeStatus(state?.status || '') !== 'approved') return false;

        const parentToken = `${key}:${Date.now()}`;
        window.__yhDashboardApprovedParentOpenAt = Date.now();
        window.__yhDashboardApprovedParentRenderToken = parentToken;

        document.body?.classList.remove('yh-dashboard-child-workspace-active');
        document.body?.classList.remove('yh-dashboard-inline-child-active');
        document.body?.setAttribute('data-yh-dashboard-v2-active', key);
        document.body?.setAttribute('data-yh-dashboard-v2-approved', 'true');
        document.body?.setAttribute('data-yh-dashboard-v2-status', 'approved');
        document.body?.setAttribute('data-yh-dashboard-v2-lock', key);
        document.body?.setAttribute('data-yh-unified-workspace', key);
        document.body?.setAttribute('data-yh-unified-division', key);

        const renderApprovedParent = (reason = 'approved-parent') => {
            if (window.__yhDashboardApprovedParentRenderToken !== parentToken) return;

            const childOpenAt = Number(window.__yhDashboardChildWorkspaceOpenAt || 0);
            if (childOpenAt && Date.now() - childOpenAt < 4200) return;

            document.body?.classList.remove('yh-dashboard-child-workspace-active');
            document.body?.classList.remove('yh-dashboard-inline-child-active');
            document.body?.setAttribute('data-yh-dashboard-v2-active', key);
            document.body?.setAttribute('data-yh-dashboard-v2-approved', 'true');
            document.body?.setAttribute('data-yh-dashboard-v2-status', 'approved');
            document.body?.setAttribute('data-yh-dashboard-v2-lock', key);
            document.body?.setAttribute('data-yh-unified-workspace', key);
            document.body?.setAttribute('data-yh-unified-division', key);

            if (typeof window.yhDashboardV2ShowParentShellV1 === 'function') {
                window.yhDashboardV2ShowParentShellV1(key, reason);
            } else if (typeof window.yhDashboardV2RenderParent === 'function') {
                window.yhDashboardV2RenderParent(key);
            } else if (typeof window.activateDashboardUnifiedWorkspace === 'function') {
                window.activateDashboardUnifiedWorkspace(key, {
                    animate: false,
                    scroll: true,
                    persist: true
                });
            }

            syncSubnavAccess(key, true);
        };

        renderApprovedParent('source-of-truth-approved');

        [60, 180, 420, 900, 1600].forEach((delay) => {
            window.setTimeout(() => renderApprovedParent(`source-of-truth-approved-${delay}`), delay);
        });

        syncCards();

        return true;
    }

    function openApplyModal(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        if (!config) return false;

        const state = getState(key);
        const status = normalizeStatus(state?.status || '');

        if (status === 'pending') {
            showToastMessage(`${config.label} application is still under admin review.`, 'error');
            return false;
        }

        if (status === 'approved') {
            openApprovedParent(key);
            return false;
        }

        for (const fnName of config.applyFns) {
            try {
                if (typeof window[fnName] === 'function') {
                    const result = window[fnName]();
                    if (result && typeof result.then === 'function') result.catch((error) => console.error(`${fnName} failed:`, error));
                    return true;
                }
            } catch (error) {
                console.error(`${fnName} failed:`, error);
            }
        }

        showToastMessage(`${config.label} application form is not ready. Please refresh and try again.`, 'error');
        return false;
    }

    function wrapApplyFns() {
        Object.entries(DIVISIONS).forEach(([key, config]) => {
            config.applyFns.forEach((fnName) => {
                if (nativeApplyFns[fnName]) return;
                if (typeof window[fnName] !== 'function') return;

                nativeApplyFns[fnName] = window[fnName];

                window[fnName] = function pendingAwareApplyFnSourceOfTruthV1() {
                    const state = getState(key);
                    const status = normalizeStatus(state?.status || '');

                    if (status === 'pending') {
                        showToastMessage(`${config.label} application is still under admin review.`, 'error');
                        syncCards();
                        return false;
                    }

                    if (status === 'approved') {
                        openApprovedParent(key);
                        return false;
                    }

                    return nativeApplyFns[fnName].apply(this, arguments);
                };
            });
        });
    }

    function handleLockedDivision(division = '') {
        const key = cleanDivision(division);
        const config = DIVISIONS[key];
        const state = getState(key);
        const status = normalizeStatus(state?.status || '');

        if (!config) return false;

        if (status === 'approved') return openApprovedParent(key);

        if (status === 'pending') {
            showToastMessage(`${config.label} application is still under admin review.`, 'error');
            syncCards();
            return true;
        }

        if (status === 'rejected') {
            showToastMessage(`${config.label} application needs admin follow-up before access can open.`, 'error');
            syncCards();
            return true;
        }

        showToastMessage(`${config.label} access is not approved yet. Please complete your application first.`, 'error');
        window.setTimeout(() => openApplyModal(key), 260);
        return true;
    }

    function handleNavigation(event) {
        if (!isDashboardPage() || !event?.target) return;

        const actionButton = event.target.closest?.('[data-yh-overview-division-action]');
        const parentButton = event.target.closest?.('[data-yh-dashboard-shell="academy"], [data-yh-dashboard-shell="plazas"], [data-yh-dashboard-shell="federation"]');

        const key = actionButton
            ? cleanDivision(actionButton.getAttribute('data-yh-overview-division-action') || '')
            : parentButton
                ? cleanDivision(parentButton.getAttribute('data-yh-dashboard-shell') || '')
                : '';

        if (!key) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        syncCards();
        handleLockedDivision(key);
    }

    function getRequestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return '';
    }

    function getRequestMethod(input, init = {}) {
        if (init && init.method) return String(init.method || 'GET').toUpperCase();
        if (input && typeof input.method === 'string') return String(input.method || 'GET').toUpperCase();
        return 'GET';
    }

    function divisionFromPostUrl(url = '') {
        const clean = String(url || '');
        for (const [key, config] of Object.entries(DIVISIONS)) {
            if (config.postUrls.some((needle) => clean.includes(needle))) return key;
        }
        return '';
    }

    function installFetchObserver() {
        if (!nativeFetch || window.__yhDivisionAccessSourceOfTruthFetchWrappedV1) return;
        window.__yhDivisionAccessSourceOfTruthFetchWrappedV1 = true;

        window.fetch = function yhuAccessSourceOfTruthFetchV1(input, init) {
            const url = getRequestUrl(input);
            const method = getRequestMethod(input, init);
            const division = method === 'POST' ? divisionFromPostUrl(url) : '';

            return nativeFetch.apply(this, arguments).then(async (response) => {
                if (division && response?.ok) {
                    let payload = {};
                    try { payload = await response.clone().json(); } catch (_) {}

                    markPending(division, payload?.application || payload || null, 'application-post-success');

                    [900, 1800, 3200, 5200].forEach((delay) => {
                        window.setTimeout(() => fetchBackendProfile(true).catch(() => null), delay);
                    });
                }

                return response;
            });
        };
    }

    function setDashboardBootstrapLoading(loading = true, reason = '') {
        if (!isDashboardPage()) return;

        document.body?.classList.toggle('yh-dashboard-access-syncing', loading);
        document.body?.setAttribute('data-yh-dashboard-bootstrap-sync', loading ? 'loading' : 'ready');

        const loader = document.getElementById('yh-dashboard-bootstrap-loader');

        if (loading) {
            document.body?.classList.add('yh-dashboard-bootstrapping');

            if (loader) {
                loader.classList.remove('hidden-step');
                loader.setAttribute('aria-hidden', 'false');
            }

            return;
        }

        if (typeof window.__yhDashboardReleaseBootstrapLoader === 'function') {
            window.__yhDashboardReleaseBootstrapLoader(reason || 'backend-profile-ready');
            return;
        }

        document.body?.classList.remove('yh-dashboard-bootstrapping');

        if (loader) {
            loader.classList.add('hidden-step');
            loader.setAttribute('aria-hidden', 'true');
        }
    }

    function setAccessCardsSyncing(syncing = true) {
        if (!isDashboardPage()) return;

        document.body?.classList.toggle('yh-dashboard-access-syncing', syncing);

        document.querySelectorAll('[data-yh-overview-division-card]').forEach((card) => {
            const key = cleanDivision(card.getAttribute('data-yh-overview-division-card') || '');
            if (!key) return;

            const statusNode = card.querySelector('.yh-dashboard-overview-access-status-v1');
            const button = card.querySelector('[data-yh-overview-division-action]');

            if (syncing) {
                card.setAttribute('data-yh-division-access-state', 'syncing');

                if (statusNode) statusNode.textContent = 'Syncing';

                if (button) {
                    button.textContent = 'Checking...';
                    button.disabled = true;
                    button.setAttribute('aria-disabled', 'true');
                    button.setAttribute('data-yh-overview-division-action-kind', 'syncing');
                }

                return;
            }

            card.removeAttribute('data-yh-division-access-state');

            if (button) {
                button.disabled = false;
                button.removeAttribute('aria-disabled');
            }
        });
    }

    function boot() {
        if (!isDashboardPage()) return;

        purgeUnsafeSharedAccessCaches();
        overrideSnapshotFns();
        wrapApplyFns();
        installFetchObserver();

        const firstSync = !backendState.loaded;

        if (firstSync) {
            setDashboardBootstrapLoading(true, 'backend-profile-sync');
        }

        setAccessCardsSyncing(true);

        fetchBackendProfile(true)
            .catch(() => null)
            .finally(() => {
                setAccessCardsSyncing(false);
                syncCards();

                if (firstSync) {
                    setDashboardBootstrapLoading(false, 'backend-profile-ready');
                }
            });

        [240, 700, 1400, 2600, 4200].forEach((delay) => {
            window.setTimeout(() => {
                purgeUnsafeSharedAccessCaches();
                overrideSnapshotFns();
                wrapApplyFns();

                if (backendState.loaded) {
                    setAccessCardsSyncing(false);
                    syncCards();
                    setDashboardBootstrapLoading(false, 'backend-profile-late-ready');
                }
            }, delay);
        });
    }

    window.addEventListener('pointerdown', handleNavigation, true);
    window.addEventListener('click', handleNavigation, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('pageshow', boot);
    window.addEventListener('focus', () => {
        setAccessCardsSyncing(true);

        fetchBackendProfile(true)
            .catch(() => null)
            .finally(() => {
                setAccessCardsSyncing(false);
                syncCards();
            });
    });

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDivisionAccessSourceOfTruthMutationTimerV1);
            window.__yhDivisionAccessSourceOfTruthMutationTimerV1 = window.setTimeout(() => {
                overrideSnapshotFns();
                wrapApplyFns();

                if (backendState.loaded) {
                    syncCards();
                }
            }, 50);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-yh-dashboard-v2-active', 'data-yh-dashboard-v2-approved', 'data-yh-unified-workspace']
        });
    } catch (_) {}

    window.yhDivisionAccessSourceOfTruthV1 = {
        fetchBackendProfile,
        getState,
        buildSnapshot,
        markPending,
        clearPending,
        syncCards,
        openApplyModal,
        openApprovedParent,
        purgeUnsafeSharedAccessCaches
    };
})();
/* END PATCH: YHU division access source of truth v1 */


/* PATCH: Dashboard topbar stability guard v1 */
(function installDashboardTopbarStabilityGuardV1() {
    if (window.__yhDashboardTopbarStabilityGuardV1Installed) return;
    window.__yhDashboardTopbarStabilityGuardV1Installed = true;

    const SELECTORS = [
        '.desktop-user-strip',
        '.desktop-user-strip-inner',
        '.desktop-user-strip-left',
        '.desktop-user-strip-right',
        '.yh-dashboard-top-search',
        '#yh-dashboard-top-search',
        '#yh-dashboard-top-search-btn',
        '#yh-command-top-wallet-chip',
        '#yh-command-top-profile',
        '#notif-bell'
    ];

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function syncDashboardTopbar() {
        if (!isDashboardPage()) return;

        SELECTORS.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;

                node.classList.remove('hidden-step');
                node.removeAttribute('hidden');
                node.setAttribute('aria-hidden', 'false');

                node.style.removeProperty('display');
                node.style.removeProperty('visibility');
                node.style.removeProperty('opacity');
                node.style.removeProperty('pointer-events');

                if (selector.includes('desktop-user-strip-right')) {
                    node.style.display = 'flex';
                }

                if (selector.includes('yh-dashboard-top-search')) {
                    node.style.display = 'grid';
                }
            });
        });
    }

    window.yhDashboardTopbarStabilityGuardV1 = {
        sync: syncDashboardTopbar
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncDashboardTopbar);
    } else {
        syncDashboardTopbar();
    }

    [80, 240, 700, 1400, 2600, 4200, 6500].forEach((delay) => {
        window.setTimeout(syncDashboardTopbar, delay);
    });

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhDashboardTopbarStabilityGuardTimerV1);
            window.__yhDashboardTopbarStabilityGuardTimerV1 = window.setTimeout(syncDashboardTopbar, 40);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
        });
    } catch (_) {}
})();
/* END PATCH: Dashboard topbar stability guard v1 */


/* PATCH: Academy application typeform wizard v1 */
(function installAcademyApplicationTypeformWizardV1() {
    if (window.__yhAcademyApplicationTypeformWizardV1Installed) return;
    window.__yhAcademyApplicationTypeformWizardV1Installed = true;

    const FORM_ID = 'form-academy-apply';
    const MODAL_ID = 'academy-apply-modal';

    const QUESTION_COPY = {
        'app-first-name': 'First Name',
        'app-surname': 'Surname',
        'app-location-country': 'Country of residence',
        'app-city-residence': 'City of residence',
        'app-country-origin': 'Country of origin',
        'app-email': 'Drop your best e-mail address',
        'app-age': 'Age',
        'app-occupation': 'What do you currently do for a living?',
        'app-skills': 'What are you good at? What are your skills?',
        'app-referred-by': 'Who referred you?',
        'app-hear-about': 'How did you hear about us?',
        'app-seriousness': 'How serious are you about being accepted?',
        'app-nonnegotiable': 'What trait or standard makes you a good fit?'
    };

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function getForm() {
        return document.getElementById(FORM_ID);
    }

    function getModal() {
        return document.getElementById(MODAL_ID);
    }

    function getStepControl(step) {
        return step?.querySelector?.('input, select, textarea') || null;
    }

    function getStepTitle(step) {
        const control = getStepControl(step);
        const id = String(control?.id || '').trim();

        if (QUESTION_COPY[id]) return QUESTION_COPY[id];

        const text = String(
            step?.querySelector?.('label')?.textContent ||
            step?.textContent ||
            'Application question'
        )
            .replace(/\s+/g, ' ')
            .trim();

        return text || 'Application question';
    }

    function normalizeOldSingleQuestionState(form) {
        if (!form) return;

        form.classList.remove('yh-one-question-form', 'is-yh-one-question-final');
        delete form.dataset.yhOneQuestionReady;
        delete form.dataset.yhOneQuestionActiveIndex;

        form.querySelectorAll('.yh-one-question-head, .yh-one-question-controls').forEach((node) => {
            node.remove();
        });

        form.querySelectorAll('.is-yh-one-question-active, .is-yh-one-question-section-active').forEach((node) => {
            node.classList.remove('is-yh-one-question-active', 'is-yh-one-question-section-active');
        });

        form.querySelectorAll('[data-yh-step-disabled]').forEach((control) => {
            if (control.dataset.yhOriginalDisabled !== 'true') {
                control.disabled = false;
            }

            delete control.dataset.yhStepDisabled;
        });

        form.querySelectorAll('.form-group, .form-row').forEach((node) => {
            node.hidden = false;
        });
    }

    function collectSteps(form) {
        if (!form) return [];

        const steps = [];

        Array.from(form.children || []).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (child.matches('.yh-academy-typeform-head, .yh-academy-typeform-controls')) return;
            if (child.id === 'btn-submit-ai') return;

            if (child.classList.contains('form-row')) {
                Array.from(child.children || []).forEach((inner) => {
                    if (inner instanceof HTMLElement && inner.classList.contains('form-group')) {
                        steps.push(inner);
                    }
                });
                return;
            }

            if (child.classList.contains('form-group')) {
                steps.push(child);
            }
        });

        return steps.filter((step) => {
            if (!(step instanceof HTMLElement)) return false;
            if (step.closest('.yh-academy-typeform-controls')) return false;
            return Boolean(getStepControl(step));
        });
    }

    function rememberOriginalDisabled(control) {
        if (!control || control.dataset.yhAcademyTypeformOriginalDisabled) return;
        control.dataset.yhAcademyTypeformOriginalDisabled = control.disabled ? 'true' : 'false';
    }

    function setStepEnabled(step, enabled) {
        if (!(step instanceof HTMLElement)) return;

        step.querySelectorAll('input, select, textarea, button').forEach((control) => {
            rememberOriginalDisabled(control);

            if (enabled) {
                if (control.dataset.yhAcademyTypeformOriginalDisabled !== 'true') {
                    control.disabled = false;
                }
                delete control.dataset.yhAcademyTypeformDisabled;
                return;
            }

            if (control.dataset.yhAcademyTypeformOriginalDisabled !== 'true') {
                control.disabled = true;
                control.dataset.yhAcademyTypeformDisabled = 'true';
            }
        });
    }

    function enableAllStepsForSubmit(form) {
        const steps = form.__yhAcademyTypeformSteps || collectSteps(form);

        steps.forEach((step) => {
            step.hidden = false;
            setStepEnabled(step, true);
        });
    }

    function validateStep(step) {
        if (!(step instanceof HTMLElement)) return false;

        const controls = Array.from(step.querySelectorAll('input, select, textarea'));

        for (const control of controls) {
            if (!control || control.disabled) continue;

            if (typeof control.checkValidity === 'function' && !control.checkValidity()) {
                if (typeof control.reportValidity === 'function') {
                    control.reportValidity();
                }

                if (typeof control.focus === 'function') {
                    control.focus({ preventScroll: false });
                }

                return false;
            }
        }

        return true;
    }

    function ensureTypeformShell(form) {
        if (!form) return [];

        normalizeOldSingleQuestionState(form);

        form.querySelectorAll('.yh-academy-typeform-head, .yh-academy-typeform-controls').forEach((node) => {
            node.remove();
        });

        const steps = collectSteps(form);
        if (!steps.length) return [];

        form.classList.add('yh-academy-typeform-form');
        form.dataset.yhAcademyTypeformReady = 'true';
        form.__yhAcademyTypeformSteps = steps;

        steps.forEach((step, index) => {
            step.classList.add('yh-academy-typeform-step');
            step.setAttribute('data-yh-academy-typeform-step', String(index));
        });

        const head = document.createElement('div');
        head.className = 'yh-academy-typeform-head';
        head.innerHTML = `
            <div class="yh-academy-typeform-kicker">Academy Application</div>
            <h3 class="yh-academy-typeform-question" data-yh-academy-typeform-title>Application question</h3>
            <div class="yh-academy-typeform-meta">
                <span data-yh-academy-typeform-count>Question 1 of ${steps.length}</span>
                <span data-yh-academy-typeform-status>Manual admin review after submission</span>
            </div>
            <div class="yh-academy-typeform-progress" aria-hidden="true">
                <span data-yh-academy-typeform-bar></span>
            </div>
        `;

        const controls = document.createElement('div');
        controls.className = 'yh-academy-typeform-controls';
        controls.innerHTML = `
            <button type="button" class="btn-secondary" data-yh-academy-typeform-back>← Back</button>
            <button type="button" class="btn-primary" data-yh-academy-typeform-next>Continue ➔</button>
        `;

        form.prepend(head);

        const submitButton = form.querySelector('#btn-submit-ai');
        if (submitButton?.parentElement) {
            submitButton.parentElement.insertBefore(controls, submitButton);
        } else {
            form.appendChild(controls);
        }

        controls.querySelector('[data-yh-academy-typeform-back]')?.addEventListener('click', () => {
            setActiveStep(form, Number(form.dataset.yhAcademyTypeformIndex || 0) - 1);
        });

        controls.querySelector('[data-yh-academy-typeform-next]')?.addEventListener('click', () => {
            const currentIndex = Number(form.dataset.yhAcademyTypeformIndex || 0);
            const currentStep = form.__yhAcademyTypeformSteps?.[currentIndex];

            if (!validateStep(currentStep)) return;
            setActiveStep(form, currentIndex + 1);
        });

        form.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            if (event.target instanceof HTMLTextAreaElement) return;

            const currentIndex = Number(form.dataset.yhAcademyTypeformIndex || 0);
            const steps = form.__yhAcademyTypeformSteps || [];
            const isFinal = currentIndex >= steps.length - 1;

            if (isFinal) return;

            event.preventDefault();
            const currentStep = steps[currentIndex];
            if (!validateStep(currentStep)) return;
            setActiveStep(form, currentIndex + 1);
        });

        form.addEventListener('submit', (event) => {
            const steps = form.__yhAcademyTypeformSteps || [];
            const currentIndex = Number(form.dataset.yhAcademyTypeformIndex || 0);
            const currentStep = steps[currentIndex];
            const isFinal = currentIndex >= steps.length - 1;

            if (!isFinal) {
                event.preventDefault();
                if (validateStep(currentStep)) {
                    setActiveStep(form, currentIndex + 1);
                }
                return;
            }

            if (!validateStep(currentStep)) {
                event.preventDefault();
                return;
            }

            enableAllStepsForSubmit(form);
        }, true);

        setActiveStep(form, 0, { focus: false });
        return steps;
    }

    function setActiveStep(form, nextIndex = 0, options = {}) {
        if (!form) return;

        const steps = form.__yhAcademyTypeformSteps || collectSteps(form);
        if (!steps.length) return;

        const safeIndex = Math.max(0, Math.min(Number(nextIndex) || 0, steps.length - 1));
        const activeStep = steps[safeIndex];
        const isFinal = safeIndex >= steps.length - 1;

        form.dataset.yhAcademyTypeformIndex = String(safeIndex);
        form.classList.toggle('is-yh-academy-typeform-final', isFinal);

        const rows = new Set();

        steps.forEach((step, index) => {
            const active = index === safeIndex;
            const row = step.closest('.form-row');

            if (row) rows.add(row);

            step.hidden = !active;
            step.classList.toggle('is-yh-academy-typeform-active', active);
            setStepEnabled(step, active);
        });

        rows.forEach((row) => {
            const hasActive = Array.from(row.querySelectorAll('.yh-academy-typeform-step')).some((step) => {
                return step.classList.contains('is-yh-academy-typeform-active');
            });

            row.hidden = !hasActive;
            row.classList.toggle('is-yh-academy-typeform-row-active', hasActive);
        });

        const title = form.querySelector('[data-yh-academy-typeform-title]');
        const count = form.querySelector('[data-yh-academy-typeform-count]');
        const bar = form.querySelector('[data-yh-academy-typeform-bar]');
        const back = form.querySelector('[data-yh-academy-typeform-back]');
        const next = form.querySelector('[data-yh-academy-typeform-next]');
        const submit = form.querySelector('#btn-submit-ai');

        if (title) title.textContent = getStepTitle(activeStep);
        if (count) count.textContent = `Question ${safeIndex + 1} of ${steps.length}`;
        if (bar) bar.style.width = `${Math.round(((safeIndex + 1) / steps.length) * 100)}%`;

        if (back) {
            back.disabled = safeIndex === 0;
            back.setAttribute('aria-disabled', safeIndex === 0 ? 'true' : 'false');
        }

        if (next) {
            next.hidden = isFinal;
            next.disabled = isFinal;
            next.setAttribute('aria-disabled', isFinal ? 'true' : 'false');
        }

        if (submit) {
            submit.hidden = !isFinal;
            submit.disabled = !isFinal;
            submit.setAttribute('aria-disabled', isFinal ? 'false' : 'true');
            submit.classList.toggle('is-yh-academy-typeform-submit-ready', isFinal);
        }

        if (options.focus !== false) {
            window.requestAnimationFrame(() => {
                const focusTarget = activeStep?.querySelector?.('input:not([type="hidden"]), select, textarea, button');
                focusTarget?.focus?.({ preventScroll: false });
            });
        }
    }

    function syncAcademyTypeform(options = {}) {
        if (!isDashboardPage()) return;

        const form = getForm();
        if (!form) return;

        ensureTypeformShell(form);

        if (options.reset) {
            setActiveStep(form, 0, { focus: options.focus !== false });
        }
    }

    const nativeResetSingleQuestion = window.resetSingleQuestionApplicationForm;
    window.resetSingleQuestionApplicationForm = function resetSingleQuestionApplicationFormTypeformSafeV1(formOrId) {
        const form = typeof formOrId === 'string'
            ? document.getElementById(formOrId)
            : formOrId;

        if (form?.id === FORM_ID || String(formOrId || '') === FORM_ID) {
            syncAcademyTypeform({ reset: true, focus: true });
            return;
        }

        if (typeof nativeResetSingleQuestion === 'function') {
            return nativeResetSingleQuestion.apply(this, arguments);
        }
    };

    function wrapAcademyLauncher() {
        if (window.__yhAcademyTypeformOpenAcademyLauncherWrappedV1) return;
        if (typeof window.openAcademyLauncher !== 'function') return;

        window.__yhAcademyTypeformOpenAcademyLauncherWrappedV1 = true;

        const nativeOpenAcademyLauncher = window.openAcademyLauncher;

        window.openAcademyLauncher = function openAcademyLauncherTypeformSafeV1() {
            const result = nativeOpenAcademyLauncher.apply(this, arguments);

            window.setTimeout(() => {
                const modal = getModal();
                const isOpen = modal && !modal.classList.contains('hidden-step');

                syncAcademyTypeform({
                    reset: isOpen,
                    focus: isOpen
                });
            }, 30);

            return result;
        };
    }

    function boot() {
        syncAcademyTypeform({ reset: false, focus: false });
        wrapAcademyLauncher();

        [80, 240, 700, 1400, 2600].forEach((delay) => {
            window.setTimeout(() => {
                syncAcademyTypeform({ reset: false, focus: false });
                wrapAcademyLauncher();
            }, delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    try {
        const observer = new MutationObserver(() => {
            window.clearTimeout(window.__yhAcademyApplicationTypeformWizardTimerV1);
            window.__yhAcademyApplicationTypeformWizardTimerV1 = window.setTimeout(() => {
                syncAcademyTypeform({ reset: false, focus: false });
                wrapAcademyLauncher();
            }, 70);
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
        });
    } catch (_) {}

    window.yhAcademyApplicationTypeformWizardV1 = {
        sync: syncAcademyTypeform,
        setActiveStep,
        collectSteps: () => collectSteps(getForm())
    };
})();
/* END PATCH: Academy application typeform wizard v1 */


/* PATCH: Federation apply direct responder v1 */
(function installFederationApplyDirectResponderV1() {
    if (window.__yhFederationApplyDirectResponderV1Installed) return;
    window.__yhFederationApplyDirectResponderV1Installed = true;

    function isDashboardPage() {
        const path = String(window.location.pathname || '').replace(/\/+$/, '');
        return path === '/dashboard' ||
            document.body?.getAttribute('data-yh-page') === 'dashboard' ||
            document.body?.getAttribute('data-yh-view') === 'hub';
    }

    function getFederationStatus() {
        try {
            const state = window.yhDivisionAccessSourceOfTruthV1?.getState?.('federation');
            return String(state?.status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
        } catch (_) {
            return '';
        }
    }

    function openDirect(reason = 'backup') {
        if (typeof window.yhDashboardOpenFederationApplicationModalDirectV1 === 'function') {
            return window.yhDashboardOpenFederationApplicationModalDirectV1(reason);
        }

        const modal = document.getElementById('federation-apply-modal');
        if (!modal) return false;

        modal.classList.remove('hidden-step');
        modal.removeAttribute('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body?.classList.add('federation-application-open');

        try {
            window.resetSingleQuestionApplicationForm?.('form-federation-apply');
        } catch (_) {}

        return true;
    }

    document.addEventListener('click', (event) => {
        if (!isDashboardPage() || !event?.target) return;

        const button = event.target.closest?.('[data-yh-overview-division-action="federation"]');
        if (!button) return;

        const kind = String(button.getAttribute('data-yh-overview-division-action-kind') || '').trim().toLowerCase();
        if (kind !== 'apply') return;

        const status = getFederationStatus();

        if (status === 'pending' || status === 'under review') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            window.showToast?.('Federation application is still under admin review.', 'error');
            return;
        }

        if (status === 'approved') return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        openDirect('backup-click');
    }, true);
})();
/* END PATCH: Federation apply direct responder v1 */

/* PATCH: Dashboard approved state resolver hardening v1 */
(function installDashboardApprovedStateResolverHardeningV1() {
    if (window.__yhDashboardApprovedStateResolverHardeningV1Installed) return;
    window.__yhDashboardApprovedStateResolverHardeningV1Installed = true;

    window.yhDashboardClearDivisionPendingLockV1 = function yhDashboardClearDivisionPendingLockV1(division = '') {
        const clean = String(division || '').trim().toLowerCase();
        const key = clean === 'plaza' ? 'plazas' : clean;
        const tokenSources = [
            'yh_dashboard_division_application_pending_locks_v1',
            'yh_dashboard_division_application_pending_locks_v2'
        ];

        try {
            const payload = window.YHSharedCore?.getStoredAuthToken?.() || localStorage.getItem('yh_auth_token') || sessionStorage.getItem('yh_auth_token') || '';
            const parts = String(payload || '').split('.');
            let scope = 'default';

            if (parts.length >= 2) {
                const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const parsed = JSON.parse(atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '='))) || {};
                scope = String(parsed.sub || parsed.id || parsed.uid || parsed.email || 'default').toLowerCase();
            }

            tokenSources.forEach((base) => {
                [`${base}:${scope}`, `${base}:default`].forEach((storageKey) => {
                    [localStorage, sessionStorage].forEach((store) => {
                        const raw = store.getItem(storageKey);
                        if (!raw) return;

                        const parsed = JSON.parse(raw);
                        if (parsed && typeof parsed === 'object' && parsed[key]) {
                            delete parsed[key];
                            store.setItem(storageKey, JSON.stringify(parsed));
                        }
                    });
                });
            });
        } catch (_) {}
    };
})();
/* END PATCH: Dashboard approved state resolver hardening v1 */

