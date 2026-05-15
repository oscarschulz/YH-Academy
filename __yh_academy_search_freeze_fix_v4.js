const fs = require('fs');
const path = require('path');

function echo(message = '') {
  console.log(message);
}

function ok(message = '') {
  console.log('[OK] ' + message);
}

function warn(message = '') {
  console.log('[WARN] ' + message);
}

function fail(message = '') {
  console.error('[ERROR] ' + message);
  process.exit(1);
}

function findFirst(candidates = []) {
  for (const file of candidates) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function backup(file) {
  const backupPath = file + '.bak-20260514-search-freeze-v4';
  fs.copyFileSync(file, backupPath);
  ok('Backup created: ' + path.relative(process.cwd(), backupPath));
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
  ok('Saved: ' + path.relative(process.cwd(), file));
}

function replaceBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    return { source, changed: false };
  }

  const endWithMarker = end + endMarker.length;

  return {
    source: source.slice(0, start) + replacement + source.slice(endWithMarker),
    changed: true
  };
}

function replaceNamedFunction(source, functionName, replacement) {
  const marker = 'function ' + functionName + '(';
  const start = source.indexOf(marker);
  if (start < 0) return { source, changed: false };

  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) return { source, changed: false };

  let depth = 0;
  let end = -1;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];

    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      end = i + 1;
      break;
    }
  }

  if (end < 0) return { source, changed: false };

  return {
    source: source.slice(0, start) + replacement + source.slice(end),
    changed: true
  };
}

const academyJsPath = findFirst([
  'public/js/academy.js',
  'js/academy.js',
  'academy.js'
]);

const dashboardJsPath = findFirst([
  'public/js/dashboard.js',
  'js/dashboard.js',
  'dashboard.js'
]);

const academyHtmlPath = findFirst([
  'public/academy.html',
  'academy.html'
]);

const styleCssPath = findFirst([
  'public/css/style.css',
  'css/style.css',
  'style.css'
]);

echo('');
echo('--- FILE DETECTION ---');

if (!academyJsPath) fail('public/js/academy.js not found.');
ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath));

if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath));
else warn('dashboard.js not found. Continuing.');

if (academyHtmlPath) ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath));
else warn('academy.html not found. Continuing.');

if (styleCssPath) ok('style.css found: ' + path.relative(process.cwd(), styleCssPath));
else warn('style.css not found. Continuing.');

backup(academyJsPath);
if (dashboardJsPath) backup(dashboardJsPath);
if (academyHtmlPath) backup(academyHtmlPath);
if (styleCssPath) backup(styleCssPath);

const modalsOnlyPatch = String.raw`/* PATCH: Academy top action modals v2 */
(function installAcademyTopActionModalsV2() {
    if (window.__academyTopActionModalsV2Installed) return;
    window.__academyTopActionModalsV2Installed = true;

    const NOTIF_OVERLAY_ID = 'academy-notification-modal-overlay';
    const RESOURCES_OVERLAY_ID = 'academy-resources-modal-overlay';

    function ensureOverlay(id, label) {
        let overlay = document.getElementById(id);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'academy-top-action-modal-overlay hidden-step';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('role', 'presentation');
        overlay.setAttribute('data-modal-label', label || 'Academy modal');

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeTopActionModals();
            }
        });

        return overlay;
    }

    function addPanelCloseButton(panel, label = 'Close modal') {
        if (!(panel instanceof HTMLElement)) return;
        if (panel.querySelector(':scope > .academy-top-action-modal-close')) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'academy-top-action-modal-close';
        button.setAttribute('aria-label', label);
        button.textContent = '✕';

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeTopActionModals();
        });

        panel.appendChild(button);
    }

    function closeTopActionModals() {
        const notifOverlay = document.getElementById(NOTIF_OVERLAY_ID);
        const resourcesOverlay = document.getElementById(RESOURCES_OVERLAY_ID);
        const notifPanel = document.getElementById('notif-dropdown');
        const resourcesPanel = document.getElementById('yh-resources-menu-panel');
        const resourcesBtn = document.getElementById('yh-resources-menu-btn');
        const notifBell = document.getElementById('notif-bell');

        notifOverlay?.classList.add('hidden-step');
        notifOverlay?.setAttribute('aria-hidden', 'true');

        resourcesOverlay?.classList.add('hidden-step');
        resourcesOverlay?.setAttribute('aria-hidden', 'true');

        notifPanel?.classList.remove('show', 'academy-top-action-modal-card', 'academy-notification-modal-card');
        notifPanel?.setAttribute('aria-hidden', 'true');

        resourcesPanel?.classList.remove('show', 'academy-top-action-modal-card', 'academy-resources-modal-card');
        resourcesPanel?.setAttribute('aria-hidden', 'true');

        notifBell?.classList.remove('yh-notif-open');
        resourcesBtn?.setAttribute('aria-expanded', 'false');

        document.body?.classList.remove(
            'yh-notif-menu-open',
            'yh-resources-menu-open',
            'academy-top-action-modal-open'
        );
    }

    async function loadNotificationsForModal() {
        try {
            if (typeof loadRealtimeNotifications === 'function') {
                await loadRealtimeNotifications(true);
                return;
            }
        } catch (_) {}

        const list = document.getElementById('notif-list-container');
        if (!list) return;

        try {
            const result = typeof academyAuthedFetch === 'function'
                ? await academyAuthedFetch('/api/realtime/notifications', { method: 'GET' })
                : null;

            const notifications = Array.isArray(result?.notifications) ? result.notifications : [];

            if (typeof renderRealtimeNotifications === 'function') {
                renderRealtimeNotifications(notifications);
                return;
            }

            if (!notifications.length) {
                list.innerHTML = '<li class="notif-empty-state" id="notif-empty-state">No notifications yet.</li>';
            }
        } catch (_) {
            list.innerHTML = '<li class="notif-empty-state" id="notif-empty-state">Failed to load notifications.</li>';
        }
    }

    async function openNotificationsModal() {
        const notifPanel = document.getElementById('notif-dropdown');
        const notifBell = document.getElementById('notif-bell');
        if (!notifPanel) return;

        closeTopActionModals();

        const overlay = ensureOverlay(NOTIF_OVERLAY_ID, 'Notifications');
        overlay.appendChild(notifPanel);
        addPanelCloseButton(notifPanel, 'Close notifications');

        notifPanel.classList.add('show', 'academy-top-action-modal-card', 'academy-notification-modal-card');
        notifPanel.setAttribute('aria-hidden', 'false');
        notifPanel.setAttribute('role', 'dialog');
        notifPanel.setAttribute('aria-modal', 'true');
        notifPanel.setAttribute('aria-label', 'Notifications');

        overlay.classList.remove('hidden-step');
        overlay.setAttribute('aria-hidden', 'false');

        notifBell?.classList.add('yh-notif-open');
        document.body?.classList.add('yh-notif-menu-open', 'academy-top-action-modal-open');

        await loadNotificationsForModal();
    }

    function openResourcesModal() {
        const resourcesPanel = document.getElementById('yh-resources-menu-panel');
        const resourcesBtn = document.getElementById('yh-resources-menu-btn');
        if (!resourcesPanel) return;

        closeTopActionModals();

        const overlay = ensureOverlay(RESOURCES_OVERLAY_ID, 'Partnerships and Resources');
        overlay.appendChild(resourcesPanel);
        addPanelCloseButton(resourcesPanel, 'Close Partnerships and Resources');

        resourcesPanel.classList.add('show', 'academy-top-action-modal-card', 'academy-resources-modal-card');
        resourcesPanel.setAttribute('aria-hidden', 'false');
        resourcesPanel.setAttribute('role', 'dialog');
        resourcesPanel.setAttribute('aria-modal', 'true');
        resourcesPanel.setAttribute('aria-label', 'Partnerships and Resources');

        overlay.classList.remove('hidden-step');
        overlay.setAttribute('aria-hidden', 'false');

        resourcesBtn?.setAttribute('aria-expanded', 'true');
        document.body?.classList.add('yh-resources-menu-open', 'academy-top-action-modal-open');
    }

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (!target) return;

        const notifTarget = target.closest('#notif-bell, #notif-bell *');
        const resourcesTarget = target.closest('#yh-resources-menu-btn, #yh-resources-menu-btn *');

        if (notifTarget && !target.closest('#notif-dropdown')) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            openNotificationsModal();
            return;
        }

        if (resourcesTarget) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            openResourcesModal();
        }
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeTopActionModals();
        }
    });

    window.openAcademyNotificationsModal = openNotificationsModal;
    window.openAcademyResourcesModal = openResourcesModal;
    window.closeAcademyTopActionModals = closeTopActionModals;
})();
/* END PATCH: Academy top action modals v2 */`;

const safeSearchGuardV3 = String.raw`/* PATCH: Academy search autofill blocker + interaction safety v3 */
(function installAcademySearchAutofillBlockerAndInteractionSafetyV3() {
    if (window.__academySearchAutofillBlockerAndInteractionSafetyV3Installed) return;
    window.__academySearchAutofillBlockerAndInteractionSafetyV3Installed = true;

    const SEARCH_IDS = [
        'academy-global-search-input',
        'academy-member-browser-search-input'
    ];

    const SEARCH_INPUT_NAMES = {
        'academy-global-search-input': 'yh_academy_query_field',
        'academy-member-browser-search-input': 'yh_academy_member_query_field'
    };

    let cleanScheduled = false;
    let bootSweepTimer = null;
    let bootSweepCount = 0;

    function safeText(value) {
        return String(value || '').trim();
    }

    function isEmailLike(value = '') {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeText(value));
    }

    function getSearchInputs() {
        return SEARCH_IDS
            .map((id) => document.getElementById(id))
            .filter((input) => input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement);
    }

    function hardenInput(input) {
        if (!input) return;

        if (input.dataset.academySearchV3Hardened !== '1') {
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocapitalize', 'none');
            input.setAttribute('spellcheck', 'false');
            input.setAttribute('inputmode', 'search');
            input.setAttribute('data-lpignore', 'true');
            input.setAttribute('data-1p-ignore', 'true');
            input.setAttribute('data-bwignore', 'true');
            input.setAttribute('data-form-type', 'other');
            input.setAttribute('aria-autocomplete', 'none');

            if (input instanceof HTMLInputElement) {
                input.type = 'search';
                input.name = SEARCH_INPUT_NAMES[input.id] || ('yh_search_' + input.id);
            }

            input.dataset.academySearchV3Hardened = '1';
        }

        input.removeAttribute('readonly');
        input.removeAttribute('value');
    }

    function closeSearchUi() {
        try {
            if (typeof closeAcademySearchResultsPanel === 'function') {
                closeAcademySearchResultsPanel();
            }
        } catch (_) {}

        const panel = document.getElementById('academy-search-results-panel');
        const inner = document.getElementById('academy-search-results-inner');

        if (inner && !safeText(getActiveSearchValue())) {
            inner.innerHTML = '';
        }

        if (panel) {
            panel.classList.add('hidden-step');
            panel.setAttribute('aria-hidden', 'true');
            panel.style.pointerEvents = 'none';
        }

        document.body?.classList.remove('academy-search-results-open');
    }

    function getActiveSearchValue() {
        return getSearchInputs()
            .map((input) => safeText(input.value))
            .find(Boolean) || '';
    }

    function clearSearchDebounce() {
        try {
            if (typeof academySearchDebounceTimer !== 'undefined' && academySearchDebounceTimer) {
                clearTimeout(academySearchDebounceTimer);
                academySearchDebounceTimer = null;
            }
        } catch (_) {}

        try {
            if (typeof academyMemberSearchDebounce !== 'undefined' && academyMemberSearchDebounce) {
                clearTimeout(academyMemberSearchDebounce);
                academyMemberSearchDebounce = null;
            }
        } catch (_) {}

        try {
            if (typeof academySearchRequestToken !== 'undefined') {
                academySearchRequestToken += 1;
            }
        } catch (_) {}
    }

    function clearInput(input, reason = 'system') {
        if (!input) return false;

        hardenInput(input);

        const hadValue = Boolean(
            safeText(input.value) ||
            safeText(input.defaultValue) ||
            safeText(input.getAttribute('value'))
        );

        input.dataset.academySearchSystemClear = '1';
        input.value = '';
        input.defaultValue = '';
        input.removeAttribute('value');
        input.dataset.academySearchUserTyped = '';
        input.dataset.academyLastSearchClearReason = reason;

        window.setTimeout(() => {
            input.dataset.academySearchSystemClear = '';
        }, 0);

        return hadValue;
    }

    function clearAllSearchInputs(reason = 'system') {
        let changed = false;

        getSearchInputs().forEach((input) => {
            if (clearInput(input, reason)) changed = true;
        });

        clearSearchDebounce();
        closeSearchUi();

        return changed;
    }

    function cleanSearchInputs(reason = 'system') {
        let changed = false;

        getSearchInputs().forEach((input) => {
            hardenInput(input);

            const value = safeText(input.value || input.defaultValue || input.getAttribute('value'));

            if (!value) return;

            if (isEmailLike(value)) {
                if (clearInput(input, 'email-autofill-' + reason)) changed = true;
                return;
            }

            if (input.dataset.academySearchUserTyped !== '1') {
                if (clearInput(input, 'non-user-prefill-' + reason)) changed = true;
            }
        });

        if (changed) {
            clearSearchDebounce();
            closeSearchUi();
        }

        if (!safeText(getActiveSearchValue())) {
            closeSearchUi();
        }

        return changed;
    }

    function scheduleClean(reason = 'scheduled') {
        if (cleanScheduled) return;

        cleanScheduled = true;

        window.requestAnimationFrame(() => {
            cleanScheduled = false;
            bindInputs();
            cleanSearchInputs(reason);
            releaseDeadOverlays();
        });
    }

    function markUserTyped(input) {
        if (!input) return;

        hardenInput(input);
        input.dataset.academySearchUserTyped = '1';
    }

    function bindInput(input) {
        if (!input || input.dataset.academySearchV3Bound === '1') return;

        input.dataset.academySearchV3Bound = '1';
        hardenInput(input);

        input.addEventListener('keydown', () => markUserTyped(input), true);
        input.addEventListener('beforeinput', () => markUserTyped(input), true);
        input.addEventListener('paste', () => markUserTyped(input), true);

        input.addEventListener('input', (event) => {
            const value = safeText(input.value);

            if (!value) {
                input.dataset.academySearchUserTyped = '';
                closeSearchUi();
                return;
            }

            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== '1') {
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();

                clearAllSearchInputs(isEmailLike(value) ? 'input-email-blocked' : 'input-prefill-blocked');
            }
        }, true);

        input.addEventListener('change', (event) => {
            const value = safeText(input.value);

            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== '1') {
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();

                clearAllSearchInputs('change-prefill-blocked');
            }
        }, true);
    }

    function bindInputs() {
        getSearchInputs().forEach(bindInput);
    }

    function releaseDeadOverlays() {
        const searchPanel = document.getElementById('academy-search-results-panel');
        const activeSearch = safeText(getActiveSearchValue());

        if (!activeSearch || isEmailLike(activeSearch)) {
            closeSearchUi();
        } else if (searchPanel && !searchPanel.classList.contains('hidden-step')) {
            searchPanel.style.removeProperty('pointer-events');
        }

        const startupLoader = document.getElementById('yh-academy-startup-loader');
        if (
            startupLoader &&
            (
                startupLoader.classList.contains('hidden-step') ||
                startupLoader.classList.contains('is-exiting') ||
                startupLoader.getAttribute('aria-hidden') === 'true'
            )
        ) {
            startupLoader.style.pointerEvents = 'none';
        }

        const tabLoader = document.getElementById('yh-tab-loader');
        if (
            tabLoader &&
            (
                tabLoader.classList.contains('hidden-step') ||
                tabLoader.getAttribute('aria-hidden') === 'true' ||
                tabLoader.hidden === true
            )
        ) {
            tabLoader.style.pointerEvents = 'none';
        }

        const anyBlockingModalOpen =
            Boolean(document.querySelector('.academy-top-action-modal-overlay:not(.hidden-step), .yh-confirm-overlay:not(.hidden-step), .modal-overlay:not(.hidden-step), .academy-lead-modal:not(.hidden-step)'));

        if (!anyBlockingModalOpen && (!startupLoader || startupLoader.classList.contains('hidden-step') || startupLoader.getAttribute('aria-hidden') === 'true')) {
            document.body?.classList.remove('academy-top-action-modal-open');
        }
    }

    function wrapFunction(name = '', wrapperFactory) {
        let original = null;

        try {
            original = window[name];
        } catch (_) {}

        if (typeof original !== 'function') {
            try {
                original = eval(name);
            } catch (_) {
                original = null;
            }
        }

        if (typeof original !== 'function') return;
        if (original.__academySearchV3Wrapped === true) return;

        const wrapped = wrapperFactory(original);
        if (typeof wrapped !== 'function') return;

        wrapped.__academySearchV3Wrapped = true;
        wrapped.__academySearchV3Original = original;

        try {
            window[name] = wrapped;
        } catch (_) {}

        try {
            eval(name + ' = window["' + name + '"]');
        } catch (_) {}
    }

    function installPipelineGuards() {
        wrapFunction('academySyncSearchInputs', (original) => function academySyncSearchInputsV3Guard(value = '', sourceInputId = '') {
            const query = safeText(value);

            if (!query || isEmailLike(query)) {
                if (isEmailLike(query)) clearAllSearchInputs('sync-email-blocked');
                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('scheduleAcademySearch', (original) => function scheduleAcademySearchV3Guard(query = '', options = {}) {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) {
                    clearAllSearchInputs('schedule-email-blocked');
                } else {
                    closeSearchUi();
                }

                clearSearchDebounce();
                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('applyAcademySearch', (original) => function applyAcademySearchV3Guard(query = '', options = {}) {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAllSearchInputs('apply-email-blocked');
                else closeSearchUi();

                return Promise.resolve([]);
            }

            return original.apply(this, arguments);
        });

        wrapFunction('requestAcademyMemberSearch', (original) => function requestAcademyMemberSearchV3Guard(query = '') {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAllSearchInputs('request-email-blocked');
                return Promise.resolve([]);
            }

            return original.apply(this, arguments);
        });

        wrapFunction('renderAcademySearchResultsLoadingPanel', (original) => function renderAcademySearchResultsLoadingPanelV3Guard(query = '') {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAllSearchInputs('render-loading-email-blocked');
                else closeSearchUi();

                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('renderAcademySearchResultsPanel', (original) => function renderAcademySearchResultsPanelV3Guard(members = [], query = '') {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAllSearchInputs('render-results-email-blocked');
                else closeSearchUi();

                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('openAcademyFeedView', (original) => function openAcademyFeedViewV3Guard() {
            clearAllSearchInputs('before-open-feed');
            const result = original.apply(this, arguments);
            window.setTimeout(() => clearAllSearchInputs('after-open-feed'), 80);
            window.setTimeout(() => clearAllSearchInputs('after-open-feed-late'), 420);
            return result;
        });
    }

    function startBootSweep() {
        if (bootSweepTimer) return;

        bootSweepTimer = window.setInterval(() => {
            bootSweepCount += 1;
            scheduleClean('boot-sweep-' + bootSweepCount);

            if (bootSweepCount >= 16) {
                window.clearInterval(bootSweepTimer);
                bootSweepTimer = null;
            }
        }, 250);
    }

    function boot() {
        bindInputs();
        installPipelineGuards();
        cleanSearchInputs('boot');
        releaseDeadOverlays();
        startBootSweep();

        window.setTimeout(() => scheduleClean('late-800'), 800);
        window.setTimeout(() => scheduleClean('late-1600'), 1600);
        window.setTimeout(() => scheduleClean('late-3200'), 3200);
        window.setTimeout(() => scheduleClean('late-5200'), 5200);
    }

    document.addEventListener('focusin', (event) => {
        const input = event.target;
        if (SEARCH_IDS.includes(input?.id)) {
            bindInput(input);
            scheduleClean('focusin');
        }
    }, true);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleClean('visible');
    });

    document.addEventListener('click', () => {
        window.setTimeout(releaseDeadOverlays, 0);
    }, true);

    window.addEventListener('pageshow', boot);
    window.addEventListener('load', boot);

    if (document.body && window.MutationObserver) {
        const observer = new MutationObserver(() => {
            scheduleClean('dom-child-change');
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.academyClearSearchAutofillBug = function academyClearSearchAutofillBug() {
        return clearAllSearchInputs('manual');
    };
})();
/* END PATCH: Academy search autofill blocker + interaction safety v3 */`;

function patchJs(file) {
  let src = read(file);
  let changed = false;
  const rel = path.relative(process.cwd(), file);

  echo('');
  echo('--- PATCHING JS: ' + rel + ' ---');

  const oldTopStart = '/* PATCH: Academy top action modals + search autofill guard v1 */';
  const oldTopEnd = '/* END PATCH: Academy top action modals + search autofill guard v1 */';

  let result = replaceBlock(src, oldTopStart, oldTopEnd, modalsOnlyPatch);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Replaced old top action modals + search guard with modals-only v2.');
  } else {
    if (!src.includes('installAcademyTopActionModalsV2')) {
      warn('Old top action modal/search guard block not found.');
    } else {
      ok('Top action modals v2 already installed.');
    }
  }

  const strictStartV1 = '/* PATCH: Academy strict search email autofill hard stop v1 */';
  const strictEndV1 = '/* END PATCH: Academy strict search email autofill hard stop v1 */';
  result = replaceBlock(src, strictStartV1, strictEndV1, '');
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Removed old strict search email hard-stop v1 block.');
  }

  const strictStartV2 = '/* PATCH: Academy strict search email autofill hard stop v2';
  const strictEndV2 = '/* END PATCH: Academy strict search email autofill hard stop v2 */';
  const strictV2StartIndex = src.indexOf(strictStartV2);
  const strictV2EndIndex = src.indexOf(strictEndV2, strictV2StartIndex);
  if (strictV2StartIndex >= 0 && strictV2EndIndex >= 0) {
    src = src.slice(0, strictV2StartIndex) + src.slice(strictV2EndIndex + strictEndV2.length);
    changed = true;
    ok('Removed superseded strict search hard-stop v2 stub.');
  }

  const searchV1Start = '/* PATCH: Academy search fields stay empty until user types v1 */';
  const searchV1End = '/* END PATCH: Academy search fields stay empty until user types v1 */';
  result = replaceBlock(src, searchV1Start, searchV1End, '');
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Removed old heavy search empty-until-user-types v1 block.');
  }

  const searchV2Start = '/* PATCH: Academy search fields stay empty until user types v2 */';
  const searchV2End = '/* END PATCH: Academy search fields stay empty until user types v2 */';
  result = replaceBlock(src, searchV2Start, searchV2End, safeSearchGuardV3);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Replaced search v2 guard with v3 blocker + interaction safety.');
  } else if (!src.includes('installAcademySearchAutofillBlockerAndInteractionSafetyV3')) {
    src += '\n\n' + safeSearchGuardV3 + '\n';
    changed = true;
    ok('Appended search v3 blocker + interaction safety.');
  } else {
    ok('Search v3 blocker already installed.');
  }

  const syncReplacement = `function academySyncSearchInputs(value = '', sourceInputId = '') {
    const normalizedValue = String(value || '');
    const normalizedTrimmedValue = normalizedValue.trim();
    const isEmailSearchValue = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedTrimmedValue);

    if (!normalizedTrimmedValue || isEmailSearchValue) {
        ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
                input.defaultValue = '';
                input.removeAttribute('value');
            }
        });

        if (typeof closeAcademySearchResultsPanel === 'function') {
            closeAcademySearchResultsPanel();
        }

        document.body?.classList.remove('academy-search-results-open');
        return;
    }

    ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {
        if (id === sourceInputId) return;
        const input = document.getElementById(id);
        if (input && input.value !== normalizedValue) {
            input.value = normalizedValue;
        }
    });
}`;

  result = replaceNamedFunction(src, 'academySyncSearchInputs', syncReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened academySyncSearchInputs against email hydration.');
  } else {
    warn('academySyncSearchInputs not found.');
  }

  const scheduleReplacement = `function scheduleAcademySearch(query = '', options = {}) {
    const normalizedQuery = String(query || '').trim();
    const sourceInputId = String(options.sourceInputId || '').trim();
    const immediate = options.immediate === true;
    const isEmailSearchQuery = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedQuery);

    window.clearTimeout(academySearchDebounceTimer);

    if (!normalizedQuery || isEmailSearchQuery) {
        ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
                input.defaultValue = '';
                input.removeAttribute('value');
                input.dataset.academySearchUserTyped = '';
            }
        });

        if (typeof closeAcademySearchResultsPanel === 'function') {
            closeAcademySearchResultsPanel();
        }

        document.body?.classList.remove('academy-search-results-open');

        try {
            academySearchRequestToken += 1;
        } catch (_) {}

        return;
    }

    academySyncSearchInputs(normalizedQuery, sourceInputId);

    if (normalizedQuery.length < 2) {
        applyAcademySearch('', {
            sourceInputId,
            skipDebounceReset: true
        });
        return;
    }

    renderAcademySearchResultsLoadingPanel(normalizedQuery);

    const requestToken = ++academySearchRequestToken;
    academySearchDebounceTimer = window.setTimeout(() => {
        applyAcademySearch(normalizedQuery, {
            requestToken,
            sourceInputId,
            skipDebounceReset: true
        });
    }, immediate ? 0 : 240);
}`;

  result = replaceNamedFunction(src, 'scheduleAcademySearch', scheduleReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened scheduleAcademySearch against email queries.');
  } else {
    warn('scheduleAcademySearch not found.');
  }

  const requestReplacement = `async function requestAcademyMemberSearch(query = '') {
    const normalizedQuery = String(query || '').trim();
    const isEmailSearchQuery = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedQuery);

    if (!normalizedQuery || isEmailSearchQuery) return [];

    const cacheKey = normalizedQuery.toLowerCase();
    const now = Date.now();
    const CACHE_TTL_MS = 15 * 1000;

    const cached = academyMemberSearchCache.get(cacheKey);
    if (cached && (now - cached.at) < CACHE_TTL_MS && Array.isArray(cached.members)) {
        return cached.members;
    }

    if (academyMemberSearchInFlight && academyMemberSearchInFlight.key === cacheKey) {
        return academyMemberSearchInFlight.promise;
    }

    const promise = academyAuthedFetch(
        \`/api/academy/community/members?limit=24&query=\${encodeURIComponent(normalizedQuery)}\`,
        { method: 'GET' }
    )
        .then((result) => (Array.isArray(result?.members) ? result.members : []))
        .catch(() => [])
        .finally(() => {
            if (academyMemberSearchInFlight && academyMemberSearchInFlight.key === cacheKey) {
                academyMemberSearchInFlight = null;
            }
        });

    academyMemberSearchInFlight = { key: cacheKey, promise };

    const members = await promise;
    academyMemberSearchCache.set(cacheKey, { at: Date.now(), members });
    return members;
}`;

  result = replaceNamedFunction(src, 'requestAcademyMemberSearch', requestReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened requestAcademyMemberSearch against email API calls.');
  } else {
    warn('requestAcademyMemberSearch not found.');
  }

  const closeReplacement = `function closeAcademySearchResultsPanel() {
    const panel = document.getElementById('academy-search-results-panel');
    const inner = document.getElementById('academy-search-results-inner');

    if (inner) inner.innerHTML = '';

    if (panel) {
        panel.classList.add('hidden-step');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.pointerEvents = 'none';
    }

    document.body?.classList.remove('academy-search-results-open');
}`;

  result = replaceNamedFunction(src, 'closeAcademySearchResultsPanel', closeReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened closeAcademySearchResultsPanel to release pointer events.');
  } else {
    warn('closeAcademySearchResultsPanel not found.');
  }

  const showSearchPanelPatterns = [
    "panel.classList.remove('hidden-step');\n    document.body?.classList.add('academy-search-results-open');",
    "panel.classList.remove('hidden-step');\r\n    document.body?.classList.add('academy-search-results-open');"
  ];

  showSearchPanelPatterns.forEach((pattern) => {
    if (src.includes(pattern)) {
      src = src.split(pattern).join(
        "panel.classList.remove('hidden-step');\n    panel.setAttribute('aria-hidden', 'false');\n    panel.style.removeProperty('pointer-events');\n    document.body?.classList.add('academy-search-results-open');"
      );
      changed = true;
      ok('Adjusted search panel open path to restore pointer events only when visible.');
    }
  });

  const intervalOld = 'window.setInterval(normalizePinnedBadges, 500);';
  if (src.includes(intervalOld)) {
    src = src.replace(intervalOld, 'window.setInterval(normalizePinnedBadges, 2500);');
    changed = true;
    ok('Reduced pinned badge interval from 500ms to 2500ms.');
  }

  if (changed) write(file, src);
  else ok('No JS changes needed for ' + rel);
}

function patchHtml(file) {
  let html = read(file);
  let changed = false;

  echo('');
  echo('--- PATCHING HTML: ' + path.relative(process.cwd(), file) + ' ---');

  const globalRegex = /<input\b(?=[^>]*\bid="academy-global-search-input")[\s\S]*?>/i;
  const globalInput = `<input
                                type="search"
                                id="academy-global-search-input"
                                placeholder="Search users, posts, captions, or tags."
                                class="academy-header-search-input"
                                autocomplete="off"
                                autocorrect="off"
                                autocapitalize="none"
                                spellcheck="false"
                                inputmode="search"
                                name="yh_academy_query_field"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                aria-autocomplete="none">`;

  if (globalRegex.test(html)) {
    html = html.replace(globalRegex, globalInput);
    changed = true;
    ok('Rebuilt academy-global-search-input with safe non-email name.');
  } else {
    warn('academy-global-search-input not found.');
  }

  const memberRegex = /<input\b(?=[^>]*\bid="academy-member-browser-search-input")[\s\S]*?>/i;
  const memberInput = `<input
                    type="search"
                    id="academy-member-browser-search-input"
                    class="input-field"
                    placeholder="Search names, usernames, or tags like The Academy, YHA, roadmap."
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="none"
                    spellcheck="false"
                    inputmode="search"
                    name="yh_academy_member_query_field"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    aria-autocomplete="none">`;

  if (memberRegex.test(html)) {
    html = html.replace(memberRegex, memberInput);
    changed = true;
    ok('Rebuilt academy-member-browser-search-input with safe non-email name.');
  } else {
    warn('academy-member-browser-search-input not found.');
  }

  if (/\/js\/academy\.js\?v=[^"]+/g.test(html)) {
    html = html.replace(/\/js\/academy\.js\?v=[^"]+/g, '/js/academy.js?v=20260514-search-freeze-v4');
    changed = true;
    ok('Updated academy.js cache-busting version.');
  }

  if (/\/css\/style\.css\?v=[^"]+/g.test(html)) {
    html = html.replace(/\/css\/style\.css\?v=[^"]+/g, '/css/style.css?v=20260514-search-freeze-v4');
    changed = true;
    ok('Updated style.css cache-busting version.');
  }

  if (changed) write(file, html);
  else ok('No HTML changes needed.');
}

function patchCss(file) {
  let css = read(file);
  let changed = false;

  echo('');
  echo('--- PATCHING CSS: ' + path.relative(process.cwd(), file) + ' ---');

  const cssPatch = String.raw`
/* PATCH: Academy hidden overlay click-through safety v4 */
.yh-academy-startup-loader.hidden-step,
.yh-academy-startup-loader.is-exiting,
.yh-tab-loader.hidden-step,
.academy-top-action-modal-overlay.hidden-step,
#academy-search-results-panel.hidden-step,
#academy-search-results-panel[aria-hidden="true"] {
    pointer-events: none !important;
}

body[data-yh-view="academy"]:not(.academy-search-results-open) #academy-search-results-panel {
    pointer-events: none !important;
}

body[data-yh-view="academy"].academy-search-results-open #academy-search-results-panel:not(.hidden-step):not([aria-hidden="true"]) {
    pointer-events: auto !important;
}
/* END PATCH: Academy hidden overlay click-through safety v4 */`;

  const existingStart = '/* PATCH: Academy hidden overlay click-through safety v4 */';
  const existingEnd = '/* END PATCH: Academy hidden overlay click-through safety v4 */';

  const result = replaceBlock(css, existingStart, existingEnd, cssPatch);
  if (result.changed) {
    css = result.source;
    changed = true;
    ok('Replaced existing hidden overlay click-through safety CSS.');
  } else {
    css += '\n\n' + cssPatch + '\n';
    changed = true;
    ok('Added hidden overlay click-through safety CSS.');
  }

  if (changed) write(file, css);
  else ok('No CSS changes needed.');
}

patchJs(academyJsPath);

if (dashboardJsPath) {
  patchJs(dashboardJsPath);
}

if (academyHtmlPath) {
  patchHtml(academyHtmlPath);
}

if (styleCssPath) {
  patchCss(styleCssPath);
}

echo('');
echo('==================================================');
echo('PATCH SCRIPT COMPLETED');
echo('==================================================');
