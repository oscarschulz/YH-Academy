const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

function echo(message = '') {
  console.log(message);
}

function ok(message = '') {
  console.log('[OK] ' + message);
}

function warn(message = '') {
  warnings.push(message);
  console.log('[WARN] ' + message);
}

function error(message = '') {
  errors.push(message);
  console.log('[ERROR] ' + message);
}

function findFirst(candidates = []) {
  for (const file of candidates) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function backup(file) {
  try {
    const backupPath = file + '.bak-20260514-search-freeze-v5';
    fs.copyFileSync(file, backupPath);
    ok('Backup created: ' + path.relative(process.cwd(), backupPath));
  } catch (err) {
    error('Backup failed for ' + file + ': ' + err.message);
  }
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
  ok('Saved: ' + path.relative(process.cwd(), file));
}

function replaceMarkerBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) return { source, changed: false };

  const end = source.indexOf(endMarker, start);
  if (end < 0) return { source, changed: false };

  const finalEnd = end + endMarker.length;

  return {
    source: source.slice(0, start) + replacement + source.slice(finalEnd),
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
  let quote = '';
  let templateDepth = 0;
  let escaped = false;
  let end = -1;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (quote === '`' && ch === '$' && source[i + 1] === '{') {
        templateDepth += 1;
        i += 1;
        continue;
      }

      if (templateDepth > 0) {
        if (ch === '{') templateDepth += 1;
        if (ch === '}') templateDepth -= 1;
        continue;
      }

      if (ch === quote) {
        quote = '';
      }

      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      const nextLine = source.indexOf('\n', i + 2);
      if (nextLine < 0) break;
      i = nextLine;
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      const commentEnd = source.indexOf('*/', i + 2);
      if (commentEnd < 0) break;
      i = commentEnd + 1;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;

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

if (academyJsPath) ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath));
else error('academy.js not found.');

if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath));
else warn('dashboard.js not found. Continuing without dashboard.js.');

if (academyHtmlPath) ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath));
else warn('academy.html not found. Continuing without academy.html.');

if (styleCssPath) ok('style.css found: ' + path.relative(process.cwd(), styleCssPath));
else warn('style.css not found. Continuing without style.css.');

if (!academyJsPath) {
  echo('');
  echo('Patch cannot continue because academy.js was not found.');
} else {
  backup(academyJsPath);
  if (dashboardJsPath) backup(dashboardJsPath);
  if (academyHtmlPath) backup(academyHtmlPath);
  if (styleCssPath) backup(styleCssPath);
}

const modalsOnlyPatch = [
'/* PATCH: Academy top action modals v2 */',
'(function installAcademyTopActionModalsV2() {',
'    if (window.__academyTopActionModalsV2Installed) return;',
'    window.__academyTopActionModalsV2Installed = true;',
'',
'    const NOTIF_OVERLAY_ID = "academy-notification-modal-overlay";',
'    const RESOURCES_OVERLAY_ID = "academy-resources-modal-overlay";',
'',
'    function ensureOverlay(id, label) {',
'        let overlay = document.getElementById(id);',
'        if (overlay) return overlay;',
'',
'        overlay = document.createElement("div");',
'        overlay.id = id;',
'        overlay.className = "academy-top-action-modal-overlay hidden-step";',
'        overlay.setAttribute("aria-hidden", "true");',
'        overlay.setAttribute("role", "presentation");',
'        overlay.setAttribute("data-modal-label", label || "Academy modal");',
'        document.body.appendChild(overlay);',
'',
'        overlay.addEventListener("click", function (event) {',
'            if (event.target === overlay) closeTopActionModals();',
'        });',
'',
'        return overlay;',
'    }',
'',
'    function addPanelCloseButton(panel, label) {',
'        if (!(panel instanceof HTMLElement)) return;',
'        if (panel.querySelector(":scope > .academy-top-action-modal-close")) return;',
'',
'        const button = document.createElement("button");',
'        button.type = "button";',
'        button.className = "academy-top-action-modal-close";',
'        button.setAttribute("aria-label", label || "Close modal");',
'        button.textContent = "✕";',
'',
'        button.addEventListener("click", function (event) {',
'            event.preventDefault();',
'            event.stopPropagation();',
'            closeTopActionModals();',
'        });',
'',
'        panel.appendChild(button);',
'    }',
'',
'    function closeTopActionModals() {',
'        const notifOverlay = document.getElementById(NOTIF_OVERLAY_ID);',
'        const resourcesOverlay = document.getElementById(RESOURCES_OVERLAY_ID);',
'        const notifPanel = document.getElementById("notif-dropdown");',
'        const resourcesPanel = document.getElementById("yh-resources-menu-panel");',
'        const resourcesBtn = document.getElementById("yh-resources-menu-btn");',
'        const notifBell = document.getElementById("notif-bell");',
'',
'        notifOverlay?.classList.add("hidden-step");',
'        notifOverlay?.setAttribute("aria-hidden", "true");',
'        resourcesOverlay?.classList.add("hidden-step");',
'        resourcesOverlay?.setAttribute("aria-hidden", "true");',
'',
'        notifPanel?.classList.remove("show", "academy-top-action-modal-card", "academy-notification-modal-card");',
'        notifPanel?.setAttribute("aria-hidden", "true");',
'        resourcesPanel?.classList.remove("show", "academy-top-action-modal-card", "academy-resources-modal-card");',
'        resourcesPanel?.setAttribute("aria-hidden", "true");',
'',
'        notifBell?.classList.remove("yh-notif-open");',
'        resourcesBtn?.setAttribute("aria-expanded", "false");',
'        document.body?.classList.remove("yh-notif-menu-open", "yh-resources-menu-open", "academy-top-action-modal-open");',
'    }',
'',
'    async function openNotificationsModal() {',
'        const notifPanel = document.getElementById("notif-dropdown");',
'        const notifBell = document.getElementById("notif-bell");',
'        if (!notifPanel) return;',
'',
'        closeTopActionModals();',
'        const overlay = ensureOverlay(NOTIF_OVERLAY_ID, "Notifications");',
'        overlay.appendChild(notifPanel);',
'        addPanelCloseButton(notifPanel, "Close notifications");',
'',
'        notifPanel.classList.add("show", "academy-top-action-modal-card", "academy-notification-modal-card");',
'        notifPanel.setAttribute("aria-hidden", "false");',
'        notifPanel.setAttribute("role", "dialog");',
'        notifPanel.setAttribute("aria-modal", "true");',
'        notifPanel.setAttribute("aria-label", "Notifications");',
'',
'        overlay.classList.remove("hidden-step");',
'        overlay.setAttribute("aria-hidden", "false");',
'        notifBell?.classList.add("yh-notif-open");',
'        document.body?.classList.add("yh-notif-menu-open", "academy-top-action-modal-open");',
'',
'        try {',
'            if (typeof loadRealtimeNotifications === "function") {',
'                await loadRealtimeNotifications(true);',
'            }',
'        } catch (_) {}',
'    }',
'',
'    function openResourcesModal() {',
'        const resourcesPanel = document.getElementById("yh-resources-menu-panel");',
'        const resourcesBtn = document.getElementById("yh-resources-menu-btn");',
'        if (!resourcesPanel) return;',
'',
'        closeTopActionModals();',
'        const overlay = ensureOverlay(RESOURCES_OVERLAY_ID, "Partnerships and Resources");',
'        overlay.appendChild(resourcesPanel);',
'        addPanelCloseButton(resourcesPanel, "Close Partnerships and Resources");',
'',
'        resourcesPanel.classList.add("show", "academy-top-action-modal-card", "academy-resources-modal-card");',
'        resourcesPanel.setAttribute("aria-hidden", "false");',
'        resourcesPanel.setAttribute("role", "dialog");',
'        resourcesPanel.setAttribute("aria-modal", "true");',
'        resourcesPanel.setAttribute("aria-label", "Partnerships and Resources");',
'',
'        overlay.classList.remove("hidden-step");',
'        overlay.setAttribute("aria-hidden", "false");',
'        resourcesBtn?.setAttribute("aria-expanded", "true");',
'        document.body?.classList.add("yh-resources-menu-open", "academy-top-action-modal-open");',
'    }',
'',
'    document.addEventListener("click", function (event) {',
'        const target = event.target instanceof Element ? event.target : event.target?.parentElement;',
'        if (!target) return;',
'',
'        const notifTarget = target.closest("#notif-bell, #notif-bell *");',
'        const resourcesTarget = target.closest("#yh-resources-menu-btn, #yh-resources-menu-btn *");',
'',
'        if (notifTarget && !target.closest("#notif-dropdown")) {',
'            event.preventDefault();',
'            event.stopPropagation();',
'            event.stopImmediatePropagation();',
'            openNotificationsModal();',
'            return;',
'        }',
'',
'        if (resourcesTarget) {',
'            event.preventDefault();',
'            event.stopPropagation();',
'            event.stopImmediatePropagation();',
'            openResourcesModal();',
'        }',
'    }, true);',
'',
'    document.addEventListener("keydown", function (event) {',
'        if (event.key === "Escape") closeTopActionModals();',
'    });',
'',
'    window.openAcademyNotificationsModal = openNotificationsModal;',
'    window.openAcademyResourcesModal = openResourcesModal;',
'    window.closeAcademyTopActionModals = closeTopActionModals;',
'})();',
'/* END PATCH: Academy top action modals v2 */'
].join('\n');

const searchGuardPatch = [
'/* PATCH: Academy search autofill blocker + interaction safety v5 */',
'(function installAcademySearchAutofillBlockerAndInteractionSafetyV5() {',
'    if (window.__academySearchAutofillBlockerAndInteractionSafetyV5Installed) return;',
'    window.__academySearchAutofillBlockerAndInteractionSafetyV5Installed = true;',
'',
'    const SEARCH_IDS = ["academy-global-search-input", "academy-member-browser-search-input"];',
'    let cleanScheduled = false;',
'    let sweepCount = 0;',
'    let sweepTimer = null;',
'',
'    function safeText(value) {',
'        return String(value || "").trim();',
'    }',
'',
'    function isEmailLike(value) {',
'        return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(safeText(value));',
'    }',
'',
'    function getInputs() {',
'        return SEARCH_IDS',
'            .map(function (id) { return document.getElementById(id); })',
'            .filter(function (input) { return input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement; });',
'    }',
'',
'    function hardenInput(input) {',
'        if (!input) return;',
'',
'        input.setAttribute("autocomplete", "off");',
'        input.setAttribute("autocorrect", "off");',
'        input.setAttribute("autocapitalize", "none");',
'        input.setAttribute("spellcheck", "false");',
'        input.setAttribute("inputmode", "search");',
'        input.setAttribute("data-lpignore", "true");',
'        input.setAttribute("data-1p-ignore", "true");',
'        input.setAttribute("data-bwignore", "true");',
'        input.setAttribute("data-form-type", "other");',
'        input.setAttribute("aria-autocomplete", "none");',
'        input.removeAttribute("readonly");',
'        input.removeAttribute("value");',
'',
'        if (input instanceof HTMLInputElement) {',
'            input.type = "search";',
'            input.name = input.id === "academy-member-browser-search-input"',
'                ? "yh_academy_member_query_field"',
'                : "yh_academy_query_field";',
'        }',
'    }',
'',
'    function closeSearchUi() {',
'        try {',
'            if (typeof closeAcademySearchResultsPanel === "function") {',
'                closeAcademySearchResultsPanel();',
'            }',
'        } catch (_) {}',
'',
'        const panel = document.getElementById("academy-search-results-panel");',
'        const inner = document.getElementById("academy-search-results-inner");',
'',
'        if (inner) inner.innerHTML = "";',
'        if (panel) {',
'            panel.classList.add("hidden-step");',
'            panel.setAttribute("aria-hidden", "true");',
'            panel.style.pointerEvents = "none";',
'        }',
'',
'        document.body?.classList.remove("academy-search-results-open");',
'    }',
'',
'    function clearTimers() {',
'        try {',
'            if (typeof academySearchDebounceTimer !== "undefined" && academySearchDebounceTimer) {',
'                clearTimeout(academySearchDebounceTimer);',
'                academySearchDebounceTimer = null;',
'            }',
'        } catch (_) {}',
'',
'        try {',
'            if (typeof academyMemberSearchDebounce !== "undefined" && academyMemberSearchDebounce) {',
'                clearTimeout(academyMemberSearchDebounce);',
'                academyMemberSearchDebounce = null;',
'            }',
'        } catch (_) {}',
'',
'        try {',
'            if (typeof academySearchRequestToken !== "undefined") {',
'                academySearchRequestToken += 1;',
'            }',
'        } catch (_) {}',
'    }',
'',
'    function clearInput(input, reason) {',
'        if (!input) return false;',
'        hardenInput(input);',
'',
'        const hadValue = Boolean(safeText(input.value) || safeText(input.defaultValue) || safeText(input.getAttribute("value")));',
'        input.dataset.academySearchSystemClear = "1";',
'        input.value = "";',
'        input.defaultValue = "";',
'        input.removeAttribute("value");',
'        input.dataset.academySearchUserTyped = "";',
'        input.dataset.academyLastSearchClearReason = reason || "system";',
'',
'        window.setTimeout(function () {',
'            input.dataset.academySearchSystemClear = "";',
'        }, 0);',
'',
'        return hadValue;',
'    }',
'',
'    function clearAll(reason) {',
'        let changed = false;',
'        getInputs().forEach(function (input) {',
'            if (clearInput(input, reason)) changed = true;',
'        });',
'        clearTimers();',
'        closeSearchUi();',
'        return changed;',
'    }',
'',
'    function activeSearchValue() {',
'        return getInputs().map(function (input) { return safeText(input.value); }).find(Boolean) || "";',
'    }',
'',
'    function releaseHiddenBlockers() {',
'        const panel = document.getElementById("academy-search-results-panel");',
'        const startup = document.getElementById("yh-academy-startup-loader");',
'        const tabLoader = document.getElementById("yh-tab-loader");',
'',
'        if (!activeSearchValue() || isEmailLike(activeSearchValue())) {',
'            closeSearchUi();',
'        } else if (panel && !panel.classList.contains("hidden-step")) {',
'            panel.style.removeProperty("pointer-events");',
'            panel.setAttribute("aria-hidden", "false");',
'        }',
'',
'        [startup, tabLoader].forEach(function (node) {',
'            if (!node) return;',
'            if (node.classList.contains("hidden-step") || node.classList.contains("is-exiting") || node.getAttribute("aria-hidden") === "true" || node.hidden === true) {',
'                node.style.pointerEvents = "none";',
'            }',
'        });',
'',
'        const blockingModalOpen = Boolean(document.querySelector(".academy-top-action-modal-overlay:not(.hidden-step), .yh-confirm-overlay:not(.hidden-step), .modal-overlay:not(.hidden-step), .academy-lead-modal:not(.hidden-step)"));',
'        if (!blockingModalOpen && (!startup || startup.classList.contains("hidden-step") || startup.getAttribute("aria-hidden") === "true")) {',
'            document.body?.classList.remove("academy-top-action-modal-open");',
'        }',
'    }',
'',
'    function clean(reason) {',
'        let changed = false;',
'',
'        getInputs().forEach(function (input) {',
'            hardenInput(input);',
'            const value = safeText(input.value || input.defaultValue || input.getAttribute("value"));',
'            if (!value) return;',
'',
'            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== "1") {',
'                if (clearInput(input, reason || "clean")) changed = true;',
'            }',
'        });',
'',
'        if (changed) {',
'            clearTimers();',
'            closeSearchUi();',
'        }',
'',
'        releaseHiddenBlockers();',
'        return changed;',
'    }',
'',
'    function scheduleClean(reason) {',
'        if (cleanScheduled) return;',
'        cleanScheduled = true;',
'',
'        window.requestAnimationFrame(function () {',
'            cleanScheduled = false;',
'            bindInputs();',
'            clean(reason || "scheduled");',
'        });',
'    }',
'',
'    function markTyped(input) {',
'        hardenInput(input);',
'        input.dataset.academySearchUserTyped = "1";',
'    }',
'',
'    function bindInput(input) {',
'        if (!input || input.dataset.academySearchV5Bound === "1") return;',
'        input.dataset.academySearchV5Bound = "1";',
'        hardenInput(input);',
'',
'        input.addEventListener("keydown", function () { markTyped(input); }, true);',
'        input.addEventListener("beforeinput", function () { markTyped(input); }, true);',
'        input.addEventListener("paste", function () { markTyped(input); }, true);',
'',
'        input.addEventListener("input", function (event) {',
'            const value = safeText(input.value);',
'',
'            if (!value) {',
'                input.dataset.academySearchUserTyped = "";',
'                closeSearchUi();',
'                return;',
'            }',
'',
'            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== "1") {',
'                event.preventDefault?.();',
'                event.stopPropagation?.();',
'                event.stopImmediatePropagation?.();',
'                clearAll(isEmailLike(value) ? "email-autofill-blocked" : "non-user-prefill-blocked");',
'            }',
'        }, true);',
'',
'        input.addEventListener("change", function (event) {',
'            const value = safeText(input.value);',
'            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== "1") {',
'                event.preventDefault?.();',
'                event.stopPropagation?.();',
'                event.stopImmediatePropagation?.();',
'                clearAll("change-prefill-blocked");',
'            }',
'        }, true);',
'    }',
'',
'    function bindInputs() {',
'        getInputs().forEach(bindInput);',
'    }',
'',
'    function wrapFunction(name, wrapperFactory) {',
'        let original = null;',
'        try { original = window[name]; } catch (_) {}',
'        if (typeof original !== "function") {',
'            try { original = eval(name); } catch (_) { original = null; }',
'        }',
'        if (typeof original !== "function" || original.__academySearchV5Wrapped === true) return;',
'',
'        const wrapped = wrapperFactory(original);',
'        wrapped.__academySearchV5Wrapped = true;',
'        wrapped.__academySearchV5Original = original;',
'',
'        try { window[name] = wrapped; } catch (_) {}',
'        try { eval(name + " = window[\"" + name + "\"]"); } catch (_) {}',
'    }',
'',
'    function installFunctionGuards() {',
'        wrapFunction("academySyncSearchInputs", function (original) {',
'            return function guardedAcademySyncSearchInputs(value, sourceInputId) {',
'                const query = safeText(value);',
'                if (!query || isEmailLike(query)) {',
'                    if (isEmailLike(query)) clearAll("sync-email-blocked");',
'                    else closeSearchUi();',
'                    return;',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("scheduleAcademySearch", function (original) {',
'            return function guardedScheduleAcademySearch(query, options) {',
'                const cleanQuery = safeText(query);',
'                if (!cleanQuery || isEmailLike(cleanQuery)) {',
'                    if (isEmailLike(cleanQuery)) clearAll("schedule-email-blocked");',
'                    else closeSearchUi();',
'                    clearTimers();',
'                    return;',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("applyAcademySearch", function (original) {',
'            return function guardedApplyAcademySearch(query, options) {',
'                const cleanQuery = safeText(query);',
'                if (!cleanQuery || isEmailLike(cleanQuery)) {',
'                    if (isEmailLike(cleanQuery)) clearAll("apply-email-blocked");',
'                    else closeSearchUi();',
'                    return Promise.resolve([]);',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("requestAcademyMemberSearch", function (original) {',
'            return function guardedRequestAcademyMemberSearch(query) {',
'                const cleanQuery = safeText(query);',
'                if (!cleanQuery || isEmailLike(cleanQuery)) {',
'                    if (isEmailLike(cleanQuery)) clearAll("request-email-blocked");',
'                    return Promise.resolve([]);',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("renderAcademySearchResultsLoadingPanel", function (original) {',
'            return function guardedRenderLoading(query) {',
'                const cleanQuery = safeText(query);',
'                if (!cleanQuery || isEmailLike(cleanQuery)) {',
'                    if (isEmailLike(cleanQuery)) clearAll("render-loading-email-blocked");',
'                    else closeSearchUi();',
'                    return;',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("renderAcademySearchResultsPanel", function (original) {',
'            return function guardedRenderResults(members, query) {',
'                const cleanQuery = safeText(query);',
'                if (!cleanQuery || isEmailLike(cleanQuery)) {',
'                    if (isEmailLike(cleanQuery)) clearAll("render-results-email-blocked");',
'                    else closeSearchUi();',
'                    return;',
'                }',
'                return original.apply(this, arguments);',
'            };',
'        });',
'',
'        wrapFunction("openAcademyFeedView", function (original) {',
'            return function guardedOpenAcademyFeedView() {',
'                clearAll("before-open-feed");',
'                const result = original.apply(this, arguments);',
'                window.setTimeout(function () { clearAll("after-open-feed-80"); }, 80);',
'                window.setTimeout(function () { clearAll("after-open-feed-420"); }, 420);',
'                return result;',
'            };',
'        });',
'    }',
'',
'    function boot() {',
'        bindInputs();',
'        installFunctionGuards();',
'        clean("boot");',
'        releaseHiddenBlockers();',
'',
'        if (!sweepTimer) {',
'            sweepTimer = window.setInterval(function () {',
'                sweepCount += 1;',
'                scheduleClean("boot-sweep-" + sweepCount);',
'                if (sweepCount >= 20) {',
'                    window.clearInterval(sweepTimer);',
'                    sweepTimer = null;',
'                }',
'            }, 250);',
'        }',
'    }',
'',
'    document.addEventListener("focusin", function (event) {',
'        const input = event.target;',
'        if (SEARCH_IDS.includes(input?.id)) {',
'            bindInput(input);',
'            scheduleClean("focusin");',
'        }',
'    }, true);',
'',
'    document.addEventListener("click", function () {',
'        window.setTimeout(releaseHiddenBlockers, 0);',
'    }, true);',
'',
'    document.addEventListener("visibilitychange", function () {',
'        if (!document.hidden) scheduleClean("visible");',
'    });',
'',
'    window.addEventListener("pageshow", boot);',
'    window.addEventListener("load", boot);',
'',
'    if (document.body && window.MutationObserver) {',
'        const observer = new MutationObserver(function () {',
'            scheduleClean("dom-child-change");',
'        });',
'        observer.observe(document.body, { childList: true, subtree: true });',
'    }',
'',
'    if (document.readyState === "loading") {',
'        document.addEventListener("DOMContentLoaded", boot);',
'    } else {',
'        boot();',
'    }',
'',
'    window.academyClearSearchAutofillBug = function () {',
'        return clearAll("manual");',
'    };',
'})();',
'/* END PATCH: Academy search autofill blocker + interaction safety v5 */'
].join('\n');

function patchJs(file) {
  let src = read(file);
  let changed = false;
  const rel = path.relative(process.cwd(), file);

  echo('');
  echo('--- PATCHING JS: ' + rel + ' ---');

  let result = replaceMarkerBlock(
    src,
    '/* PATCH: Academy top action modals + search autofill guard v1 */',
    '/* END PATCH: Academy top action modals + search autofill guard v1 */',
    modalsOnlyPatch
  );

  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Replaced old combined modal/search guard v1 with modals-only v2.');
  } else if (!src.includes('installAcademyTopActionModalsV2')) {
    warn('Old combined modal/search guard v1 not found.');
  } else {
    ok('Modals-only v2 already present.');
  }

  const removeBlocks = [
    ['/* PATCH: Academy strict search email autofill hard stop v1 */', '/* END PATCH: Academy strict search email autofill hard stop v1 */'],
    ['/* PATCH: Academy strict search email autofill hard stop v2', '/* END PATCH: Academy strict search email autofill hard stop v2 */'],
    ['/* PATCH: Academy search fields stay empty until user types v1 */', '/* END PATCH: Academy search fields stay empty until user types v1 */'],
    ['/* PATCH: Academy search fields stay empty until user types v2 */', '/* END PATCH: Academy search fields stay empty until user types v2 */'],
    ['/* PATCH: Academy search autofill blocker + interaction safety v3 */', '/* END PATCH: Academy search autofill blocker + interaction safety v3 */'],
    ['/* PATCH: Academy search autofill blocker + interaction safety v5 */', '/* END PATCH: Academy search autofill blocker + interaction safety v5 */']
  ];

  removeBlocks.forEach(([start, end]) => {
    const removed = replaceMarkerBlock(src, start, end, '');
    if (removed.changed) {
      src = removed.source;
      changed = true;
      ok('Removed old/superseded search block starting: ' + start);
    }
  });

  src += '\n\n' + searchGuardPatch + '\n';
  changed = true;
  ok('Appended search autofill blocker + interaction safety v5.');

  const syncReplacement = [
'function academySyncSearchInputs(value = "", sourceInputId = "") {',
'    const normalizedValue = String(value || "");',
'    const normalizedTrimmedValue = normalizedValue.trim();',
'    const isEmailSearchValue = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedTrimmedValue);',
'',
'    if (!normalizedTrimmedValue || isEmailSearchValue) {',
'        ["academy-global-search-input", "academy-member-browser-search-input"].forEach(function (id) {',
'            const input = document.getElementById(id);',
'            if (input) {',
'                input.value = "";',
'                input.defaultValue = "";',
'                input.removeAttribute("value");',
'            }',
'        });',
'',
'        if (typeof closeAcademySearchResultsPanel === "function") {',
'            closeAcademySearchResultsPanel();',
'        }',
'',
'        document.body?.classList.remove("academy-search-results-open");',
'        return;',
'    }',
'',
'    ["academy-global-search-input", "academy-member-browser-search-input"].forEach(function (id) {',
'        if (id === sourceInputId) return;',
'        const input = document.getElementById(id);',
'        if (input && input.value !== normalizedValue) {',
'            input.value = normalizedValue;',
'        }',
'    });',
'}'
  ].join('\n');

  result = replaceNamedFunction(src, 'academySyncSearchInputs', syncReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened academySyncSearchInputs.');
  } else {
    warn('academySyncSearchInputs not found.');
  }

  const closeReplacement = [
'function closeAcademySearchResultsPanel() {',
'    const panel = document.getElementById("academy-search-results-panel");',
'    const inner = document.getElementById("academy-search-results-inner");',
'    if (inner) inner.innerHTML = "";',
'    if (panel) {',
'        panel.classList.add("hidden-step");',
'        panel.setAttribute("aria-hidden", "true");',
'        panel.style.pointerEvents = "none";',
'    }',
'    document.body?.classList.remove("academy-search-results-open");',
'}'
  ].join('\n');

  result = replaceNamedFunction(src, 'closeAcademySearchResultsPanel', closeReplacement);
  if (result.changed) {
    src = result.source;
    changed = true;
    ok('Hardened closeAcademySearchResultsPanel.');
  } else {
    warn('closeAcademySearchResultsPanel not found.');
  }

  if (src.includes('window.setInterval(normalizePinnedBadges, 500);')) {
    src = src.replace(/window\.setInterval\(normalizePinnedBadges,\s*500\);/g, 'window.setInterval(normalizePinnedBadges, 2500);');
    changed = true;
    ok('Reduced pinned badge interval from 500ms to 2500ms.');
  }

  if (changed) write(file, src);
  else ok('No JS changes needed.');
}

function patchHtml(file) {
  let html = read(file);
  let changed = false;

  echo('');
  echo('--- PATCHING HTML: ' + path.relative(process.cwd(), file) + ' ---');

  const globalInput = [
'<input',
'                                type="search"',
'                                id="academy-global-search-input"',
'                                placeholder="Search users, posts, captions, or tags."',
'                                class="academy-header-search-input"',
'                                autocomplete="off"',
'                                autocorrect="off"',
'                                autocapitalize="none"',
'                                spellcheck="false"',
'                                inputmode="search"',
'                                name="yh_academy_query_field"',
'                                data-lpignore="true"',
'                                data-1p-ignore="true"',
'                                data-bwignore="true"',
'                                data-form-type="other"',
'                                aria-autocomplete="none">'
  ].join('\n');

  const memberInput = [
'<input',
'                    type="search"',
'                    id="academy-member-browser-search-input"',
'                    class="input-field"',
'                    placeholder="Search names, usernames, or tags like The Academy, YHA, roadmap."',
'                    autocomplete="off"',
'                    autocorrect="off"',
'                    autocapitalize="none"',
'                    spellcheck="false"',
'                    inputmode="search"',
'                    name="yh_academy_member_query_field"',
'                    data-lpignore="true"',
'                    data-1p-ignore="true"',
'                    data-bwignore="true"',
'                    data-form-type="other"',
'                    aria-autocomplete="none">'
  ].join('\n');

  if (/<input\b(?=[^>]*\bid="academy-global-search-input")[\s\S]*?>/i.test(html)) {
    html = html.replace(/<input\b(?=[^>]*\bid="academy-global-search-input")[\s\S]*?>/i, globalInput);
    changed = true;
    ok('Rebuilt academy-global-search-input with safe name.');
  } else {
    warn('academy-global-search-input not found.');
  }

  if (/<input\b(?=[^>]*\bid="academy-member-browser-search-input")[\s\S]*?>/i.test(html)) {
    html = html.replace(/<input\b(?=[^>]*\bid="academy-member-browser-search-input")[\s\S]*?>/i, memberInput);
    changed = true;
    ok('Rebuilt academy-member-browser-search-input with safe name.');
  } else {
    warn('academy-member-browser-search-input not found.');
  }

  if (/\/js\/academy\.js\?v=[^"]+/g.test(html)) {
    html = html.replace(/\/js\/academy\.js\?v=[^"]+/g, '/js/academy.js?v=20260514-search-freeze-v5');
    changed = true;
    ok('Updated academy.js cache-busting version.');
  }

  if (/\/css\/style\.css\?v=[^"]+/g.test(html)) {
    html = html.replace(/\/css\/style\.css\?v=[^"]+/g, '/css/style.css?v=20260514-search-freeze-v5');
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

  const cssPatch = [
'/* PATCH: Academy hidden overlay click-through safety v5 */',
'.yh-academy-startup-loader.hidden-step,',
'.yh-academy-startup-loader.is-exiting,',
'.yh-tab-loader.hidden-step,',
'.academy-top-action-modal-overlay.hidden-step,',
'#academy-search-results-panel.hidden-step,',
'#academy-search-results-panel[aria-hidden="true"] {',
'    pointer-events: none !important;',
'}',
'',
'body[data-yh-view="academy"]:not(.academy-search-results-open) #academy-search-results-panel {',
'    pointer-events: none !important;',
'}',
'',
'body[data-yh-view="academy"].academy-search-results-open #academy-search-results-panel:not(.hidden-step):not([aria-hidden="true"]) {',
'    pointer-events: auto !important;',
'}',
'/* END PATCH: Academy hidden overlay click-through safety v5 */'
  ].join('\n');

  const oldV4 = replaceMarkerBlock(
    css,
    '/* PATCH: Academy hidden overlay click-through safety v4 */',
    '/* END PATCH: Academy hidden overlay click-through safety v4 */',
    ''
  );

  if (oldV4.changed) {
    css = oldV4.source;
    changed = true;
    ok('Removed old CSS click-through safety v4.');
  }

  const oldV5 = replaceMarkerBlock(
    css,
    '/* PATCH: Academy hidden overlay click-through safety v5 */',
    '/* END PATCH: Academy hidden overlay click-through safety v5 */',
    ''
  );

  if (oldV5.changed) {
    css = oldV5.source;
    changed = true;
    ok('Removed existing CSS click-through safety v5 before re-adding clean version.');
  }

  css += '\n\n' + cssPatch + '\n';
  changed = true;
  ok('Added hidden overlay click-through safety v5.');

  if (changed) write(file, css);
}

try {
  if (academyJsPath) patchJs(academyJsPath);
  if (dashboardJsPath) patchJs(dashboardJsPath);
  if (academyHtmlPath) patchHtml(academyHtmlPath);
  if (styleCssPath) patchCss(styleCssPath);
} catch (err) {
  error('Patch runtime error: ' + err.message);
}

echo('');
echo('==================================================');
echo('PATCH SUMMARY');
echo('==================================================');
echo('Warnings: ' + warnings.length);
echo('Errors: ' + errors.length);

if (warnings.length) {
  echo('');
  echo('Warnings list:');
  warnings.forEach((item, index) => echo('  ' + (index + 1) + '. ' + item));
}

if (errors.length) {
  echo('');
  echo('Errors list:');
  errors.forEach((item, index) => echo('  ' + (index + 1) + '. ' + item));
}

echo('');
echo('Node patch script finished. Shell should remain open.');
process.exitCode = errors.length ? 1 : 0;
