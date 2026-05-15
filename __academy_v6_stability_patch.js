const fs = require('fs');
const path = require('path');

function log(msg = '') {
  console.log(msg);
}

function ok(msg = '') {
  console.log('[OK] ' + msg);
}

function warn(msg = '') {
  console.log('[WARN] ' + msg);
}

function findFirst(candidates = []) {
  for (const file of candidates) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function backup(full, label) {
  try {
    const backupPath = full + '.bak-20260515-academy-v6-stability';
    fs.copyFileSync(full, backupPath);
    ok('Backup created: ' + path.relative(process.cwd(), backupPath));
  } catch (error) {
    warn('Backup failed for ' + label + ': ' + error.message);
  }
}

function read(full) {
  return fs.readFileSync(full, 'utf8');
}

function write(full, content) {
  fs.writeFileSync(full, content);
  ok('Saved: ' + path.relative(process.cwd(), full));
}

function replaceMarkerBlock(src, startMarker, endMarker, replacement) {
  const start = src.indexOf(startMarker);
  if (start < 0) return { src, changed: false };

  const end = src.indexOf(endMarker, start);
  if (end < 0) return { src, changed: false };

  return {
    src: src.slice(0, start) + replacement + src.slice(end + endMarker.length),
    changed: true
  };
}

function replaceNamedFunction(src, functionName, replacement) {
  const marker = 'function ' + functionName + '(';
  const start = src.indexOf(marker);
  if (start < 0) return { src, changed: false };

  const braceStart = src.indexOf('{', start);
  if (braceStart < 0) return { src, changed: false };

  let depth = 0;
  let quote = '';
  let escaped = false;
  let templateDepth = 0;
  let end = -1;

  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (quote === '`' && ch === '$' && src[i + 1] === '{') {
        templateDepth += 1;
        i += 1;
        continue;
      }

      if (templateDepth > 0) {
        if (ch === '{') templateDepth += 1;
        if (ch === '}') templateDepth -= 1;
        continue;
      }

      if (ch === quote) quote = '';
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '/' && src[i + 1] === '/') {
      const nextLine = src.indexOf('\n', i + 2);
      if (nextLine < 0) break;
      i = nextLine;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      const commentEnd = src.indexOf('*/', i + 2);
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

  if (end < 0) return { src, changed: false };

  return {
    src: src.slice(0, start) + replacement + src.slice(end),
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

const runtimePath = findFirst([
  'public/js/yh-shared-runtime.js',
  'js/yh-shared-runtime.js',
  'yh-shared-runtime.js'
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

log('');
log('--- FILE DETECTION ---');

if (academyJsPath) ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath));
else warn('academy.js not found.');

if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath));
else warn('dashboard.js not found.');

if (runtimePath) ok('yh-shared-runtime.js found: ' + path.relative(process.cwd(), runtimePath));
else warn('yh-shared-runtime.js not found.');

if (academyHtmlPath) ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath));
else warn('academy.html not found.');

if (styleCssPath) ok('style.css found: ' + path.relative(process.cwd(), styleCssPath));
else warn('style.css not found.');

[
  [academyJsPath, 'academy.js'],
  [dashboardJsPath, 'dashboard.js'],
  [runtimePath, 'yh-shared-runtime.js'],
  [academyHtmlPath, 'academy.html'],
  [styleCssPath, 'style.css']
].forEach(([file, label]) => {
  if (file) backup(file, label);
});

const intervalBudgetGuard = `/* PATCH: Academy interval budget guard v6 */
(function installAcademyIntervalBudgetGuardV6() {
    if (window.__academyIntervalBudgetGuardV6Installed) return;
    window.__academyIntervalBudgetGuardV6Installed = true;

    const nativeSetInterval = window.setInterval.bind(window);

    function isAcademyPage() {
        return document.body?.getAttribute('data-yh-page') === 'academy' ||
            String(window.location.pathname || '').replace(/\\/+$/, '') === '/academy';
    }

    function shouldThrottle(source = '') {
        return /lockBotToVisibleBottom|applyManualMessagesTab|clampBotInsideSidebar|normalizeSingleBot|placeBotInAllowedPlayArea|bootAcademyVoiceLoungeFinalFixes|bootGroupsInboxFix|bootMessagesUiPolish|bootAcademyBotAndAvatarFix|applyAcademyRealInboxAvatars|positionAcademyBotBelowActiveMember|academyBootInlineEditAndBotFix/.test(source);
    }

    window.setInterval = function academyBudgetedSetInterval(callback, delay, ...args) {
        if (!isAcademyPage() || typeof callback !== 'function') {
            return nativeSetInterval(callback, delay, ...args);
        }

        const source = String(callback || '');
        let safeDelay = Number(delay || 0);

        if (shouldThrottle(source)) {
            if (safeDelay < 1200) safeDelay = 1200;
            if (/applyManualMessagesTab|lockBotToVisibleBottom|clampBotInsideSidebar/.test(source) && safeDelay < 1800) safeDelay = 1800;
            if (/bootAcademyVoiceLoungeFinalFixes|bootGroupsInboxFix|bootMessagesUiPolish|applyAcademyRealInboxAvatars/.test(source) && safeDelay < 3500) safeDelay = 3500;
        }

        const wrapped = function academyBudgetedIntervalCallback() {
            if (document.hidden) return;
            return callback.apply(this, args);
        };

        return nativeSetInterval(wrapped, safeDelay || delay);
    };
})();
/* END PATCH: Academy interval budget guard v6 */

`;

const searchGuardV6 = `/* PATCH: Academy search autofill blocker + interaction safety v6 */
(function installAcademySearchAutofillBlockerAndInteractionSafetyV6() {
    if (window.__academySearchAutofillBlockerAndInteractionSafetyV6Installed) return;
    window.__academySearchAutofillBlockerAndInteractionSafetyV6Installed = true;

    const SEARCH_IDS = ['academy-global-search-input', 'academy-member-browser-search-input'];
    let cleanScheduled = false;

    function safeText(value) {
        return String(value || '').trim();
    }

    function isEmailLike(value) {
        return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(safeText(value));
    }

    function getInputs() {
        return SEARCH_IDS
            .map((id) => document.getElementById(id))
            .filter((input) => input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement);
    }

    function hardenInput(input) {
        if (!input) return;

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
        input.removeAttribute('readonly');
        input.removeAttribute('value');

        if (input instanceof HTMLInputElement) {
            input.type = 'search';
            input.name = input.id === 'academy-member-browser-search-input'
                ? 'yh_academy_member_query_field'
                : 'yh_academy_query_field';
        }
    }

    function closeSearchUi() {
        try {
            if (typeof closeAcademySearchResultsPanel === 'function') {
                closeAcademySearchResultsPanel();
            }
        } catch (_) {}

        const panel = document.getElementById('academy-search-results-panel');
        const inner = document.getElementById('academy-search-results-inner');

        if (inner) inner.innerHTML = '';

        if (panel) {
            panel.classList.add('hidden-step');
            panel.setAttribute('aria-hidden', 'true');
            panel.style.pointerEvents = 'none';
        }

        document.body?.classList.remove('academy-search-results-open');
    }

    function clearTimers() {
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

    function clearAll(reason = 'system') {
        let changed = false;

        getInputs().forEach((input) => {
            if (clearInput(input, reason)) changed = true;
        });

        clearTimers();
        closeSearchUi();

        return changed;
    }

    function clean(reason = 'clean') {
        let changed = false;

        getInputs().forEach((input) => {
            hardenInput(input);

            const value = safeText(input.value || input.defaultValue || input.getAttribute('value'));
            if (!value) return;

            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== '1') {
                if (clearInput(input, reason)) changed = true;
            }
        });

        if (changed) {
            clearTimers();
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
            clean(reason);
        });
    }

    function markTyped(input) {
        hardenInput(input);
        input.dataset.academySearchUserTyped = '1';
    }

    function bindInput(input) {
        if (!input || input.dataset.academySearchV6Bound === '1') return;

        input.dataset.academySearchV6Bound = '1';
        hardenInput(input);

        input.addEventListener('keydown', () => markTyped(input), true);
        input.addEventListener('beforeinput', () => markTyped(input), true);
        input.addEventListener('paste', () => markTyped(input), true);

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
                clearAll(isEmailLike(value) ? 'email-autofill-blocked' : 'non-user-prefill-blocked');
            }
        }, true);

        input.addEventListener('change', (event) => {
            const value = safeText(input.value);

            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== '1') {
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();
                clearAll('change-prefill-blocked');
            }
        }, true);
    }

    function bindInputs() {
        getInputs().forEach(bindInput);
    }

    function wrapFunction(name, wrapperFactory) {
        let original = null;

        try { original = window[name]; } catch (_) {}

        if (typeof original !== 'function') {
            try { original = eval(name); } catch (_) { original = null; }
        }

        if (typeof original !== 'function' || original.__academySearchV6Wrapped === true) return;

        const wrapped = wrapperFactory(original);
        wrapped.__academySearchV6Wrapped = true;
        wrapped.__academySearchV6Original = original;

        try { window[name] = wrapped; } catch (_) {}
        try { eval(name + ' = window["' + name + '"]'); } catch (_) {}
    }

    function installFunctionGuards() {
        wrapFunction('academySyncSearchInputs', (original) => function guardedAcademySyncSearchInputs(value, sourceInputId) {
            const query = safeText(value);

            if (!query || isEmailLike(query)) {
                if (isEmailLike(query)) clearAll('sync-email-blocked');
                else closeSearchUi();
                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('scheduleAcademySearch', (original) => function guardedScheduleAcademySearch(query, options) {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAll('schedule-email-blocked');
                else closeSearchUi();

                clearTimers();
                return;
            }

            return original.apply(this, arguments);
        });

        wrapFunction('applyAcademySearch', (original) => function guardedApplyAcademySearch(query, options) {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAll('apply-email-blocked');
                else closeSearchUi();

                return Promise.resolve([]);
            }

            return original.apply(this, arguments);
        });

        wrapFunction('requestAcademyMemberSearch', (original) => function guardedRequestAcademyMemberSearch(query) {
            const cleanQuery = safeText(query);

            if (!cleanQuery || isEmailLike(cleanQuery)) {
                if (isEmailLike(cleanQuery)) clearAll('request-email-blocked');
                return Promise.resolve([]);
            }

            return original.apply(this, arguments);
        });
    }

    function boot() {
        bindInputs();
        installFunctionGuards();
        clean('boot');

        [80, 350, 900, 1800].forEach((delay) => {
            window.setTimeout(() => scheduleClean('delayed-' + delay), delay);
        });
    }

    document.addEventListener('focusin', (event) => {
        const input = event.target;

        if (SEARCH_IDS.includes(input?.id)) {
            bindInput(input);
            scheduleClean('focusin');
        }
    }, true);

    window.addEventListener('pageshow', boot);
    window.addEventListener('load', boot);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.academyClearSearchAutofillBug = function academyClearSearchAutofillBug() {
        return clearAll('manual');
    };
})();
/* END PATCH: Academy search autofill blocker + interaction safety v6 */`;

function patchRuntime() {
  if (!runtimePath) return;

  let src = read(runtimePath);
  let changed = false;

  log('');
  log('--- PATCHING yh-shared-runtime.js ---');

  if (!src.includes('let yhTabLoaderForceHideTimer')) {
    src = src.replace(
      'let yhTabLoaderHideTimer = null;',
      'let yhTabLoaderHideTimer = null;\\n    let yhTabLoaderForceHideTimer = null;'
    );
    changed = true;
    ok('Added force-hide timer state.');
  }

  const showReplacement = `function showAcademyTabLoader(label = 'Loading.') {
        const overlay = document.getElementById('yh-tab-loader');
        if (!overlay) return;

        const text = document.getElementById('yh-tab-loader-text');
        if (text) text.textContent = String(label || 'Loading.');

        if (yhTabLoaderHideTimer) {
            clearTimeout(yhTabLoaderHideTimer);
            yhTabLoaderHideTimer = null;
        }

        if (yhTabLoaderForceHideTimer) {
            clearTimeout(yhTabLoaderForceHideTimer);
            yhTabLoaderForceHideTimer = null;
        }

        yhTabLoaderDepth = 1;

        overlay.classList.remove('hidden-step');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.style.pointerEvents = 'auto';

        void overlay.offsetWidth;

        overlay.classList.add('is-active');
        yhTabLoaderVisibleAt = Date.now();

        yhTabLoaderForceHideTimer = setTimeout(() => {
            hideAcademyTabLoader({ force: true });
        }, 7500);
    }`;

  const hideReplacement = `function hideAcademyTabLoader(options = {}) {
        const overlay = document.getElementById('yh-tab-loader');
        if (!overlay) return;

        const force = options && options.force === true;

        yhTabLoaderDepth = force ? 0 : Math.max(0, yhTabLoaderDepth - 1);
        if (!force && yhTabLoaderDepth !== 0) return;

        if (yhTabLoaderForceHideTimer) {
            clearTimeout(yhTabLoaderForceHideTimer);
            yhTabLoaderForceHideTimer = null;
        }

        const elapsed = Date.now() - (yhTabLoaderVisibleAt || 0);
        const delay = force ? 0 : Math.max(0, YH_TAB_LOADER_MIN_MS - elapsed);

        if (yhTabLoaderHideTimer) clearTimeout(yhTabLoaderHideTimer);

        yhTabLoaderHideTimer = setTimeout(() => {
            overlay.classList.remove('is-active');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.pointerEvents = 'none';

            setTimeout(() => {
                overlay.classList.add('hidden-step');
                overlay.style.pointerEvents = 'none';
            }, force ? 0 : 180);
        }, delay);
    }`;

  let result = replaceNamedFunction(src, 'showAcademyTabLoader', showReplacement);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced showAcademyTabLoader with capped depth + force-hide behavior.');
  } else {
    warn('showAcademyTabLoader was not replaced.');
  }

  result = replaceNamedFunction(src, 'hideAcademyTabLoader', hideReplacement);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced hideAcademyTabLoader with force release behavior.');
  } else {
    warn('hideAcademyTabLoader was not replaced.');
  }

  if (!src.includes('function forceHideAcademyTabLoader')) {
    src = src.replace(
      'function readDashboardViewState() {',
      `function forceHideAcademyTabLoader() {
        yhTabLoaderDepth = 0;
        hideAcademyTabLoader({ force: true });
    }

    function readDashboardViewState() {`
    );
    changed = true;
    ok('Added forceHideAcademyTabLoader helper.');
  }

  if (!src.includes('forceHideAcademyTabLoader,')) {
    src = src.replace(
      'hideAcademyTabLoader,',
      'hideAcademyTabLoader,\\n        forceHideAcademyTabLoader,'
    );
    changed = true;
    ok('Exported forceHideAcademyTabLoader.');
  }

  if (changed) write(runtimePath, src);
  else ok('No runtime changes needed.');
}

function patchAcademyJsLike(filePath, label) {
  if (!filePath) return;

  let src = read(filePath);
  let changed = false;

  log('');
  log('--- PATCHING ' + label + ' ---');

  if (!src.includes('Academy interval budget guard v6')) {
    const insertAt = src.indexOf('const {');
    if (insertAt >= 0) {
      src = src.slice(0, insertAt) + intervalBudgetGuard + src.slice(insertAt);
      changed = true;
      ok('Inserted interval budget guard before heavy UI intervals register.');
    } else {
      src = intervalBudgetGuard + src;
      changed = true;
      ok('Prepended interval budget guard.');
    }
  } else {
    ok('Interval budget guard already exists.');
  }

  const searchBlocks = [
    ['/* PATCH: Academy search autofill blocker + interaction safety v5 */', '/* END PATCH: Academy search autofill blocker + interaction safety v5 */'],
    ['/* PATCH: Academy search autofill blocker + interaction safety v6 */', '/* END PATCH: Academy search autofill blocker + interaction safety v6 */']
  ];

  searchBlocks.forEach(([start, end]) => {
    const result = replaceMarkerBlock(src, start, end, '');
    if (result.changed) {
      src = result.src;
      changed = true;
      ok('Removed old/superseded search guard block: ' + start);
    }
  });

  src += '\\n\\n' + searchGuardV6 + '\\n';
  changed = true;
  ok('Added lighter search guard v6.');

  const hideStartupReplacement = `function hideAcademyStartupBootOverlay() {
    const loader = getAcademyStartupBootLoader();

    document.body?.classList.add('academy-shell-ready');
    document.body?.classList.remove('academy-standalone-shell-pending');
    document.body?.classList.remove('academy-startup-booting');

    try {
        if (typeof window.YHSharedRuntime?.forceHideAcademyTabLoader === 'function') {
            window.YHSharedRuntime.forceHideAcademyTabLoader();
        }
    } catch (_) {}

    if (academyStartupBootDismissed) {
        if (loader) {
            loader.classList.add('hidden-step');
            loader.setAttribute('aria-hidden', 'true');
            loader.style.pointerEvents = 'none';
        }
        return;
    }

    academyStartupBootDismissed = true;

    if (academyStartupBootFailSafeTimer) {
        clearTimeout(academyStartupBootFailSafeTimer);
        academyStartupBootFailSafeTimer = null;
    }

    try {
        sessionStorage.removeItem(YH_ACADEMY_STARTUP_BOOT_KEY);
        sessionStorage.removeItem(YH_ACADEMY_STARTUP_SECTION_KEY);
    } catch (_) {}

    if (!loader) return;

    loader.classList.add('is-exiting');
    loader.style.pointerEvents = 'none';

    window.setTimeout(() => {
        loader.classList.add('hidden-step');
        loader.setAttribute('aria-hidden', 'true');
        loader.style.pointerEvents = 'none';
    }, 220);
}`;

  let result = replaceNamedFunction(src, 'hideAcademyStartupBootOverlay', hideStartupReplacement);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Hardened startup overlay release and shell-ready class.');
  } else {
    warn('hideAcademyStartupBootOverlay was not found.');
  }

  const scheduleStartupReplacement = `function scheduleAcademyStartupBootFailSafe(delayMs = 7000) {
    if (academyStartupBootFailSafeTimer) {
        clearTimeout(academyStartupBootFailSafeTimer);
    }

    academyStartupBootFailSafeTimer = window.setTimeout(() => {
        hideAcademyStartupBootOverlay();
    }, Math.min(Number(delayMs) || 7000, 5500));
}`;

  result = replaceNamedFunction(src, 'scheduleAcademyStartupBootFailSafe', scheduleStartupReplacement);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Reduced startup fail-safe maximum to 5.5s.');
  }

  const exactReplacements = [
    ['window.setInterval(lockBotToVisibleBottom, 160);', 'window.setInterval(lockBotToVisibleBottom, 1800);'],
    ['window.setInterval(() => applyManualMessagesTab(readStoredTab()), 240);', 'window.setInterval(() => applyManualMessagesTab(readStoredTab()), 1800);'],
    ['window.setInterval(bootAcademyVoiceLoungeFinalFixes, 900);', 'window.setInterval(bootAcademyVoiceLoungeFinalFixes, 3500);'],
    ['window.setInterval(bootGroupsInboxFix, 1200);', 'window.setInterval(bootGroupsInboxFix, 3500);'],
    ['window.setInterval(bootMessagesUiPolish, 1800);', 'window.setInterval(bootMessagesUiPolish, 3500);'],
    ['window.setInterval(academyBootInlineEditAndBotFix, 3500);', 'window.setInterval(academyBootInlineEditAndBotFix, 5000);'],
    ['window.setInterval(runAcademyPasswordManagerGuard, 2500);', 'window.setInterval(runAcademyPasswordManagerGuard, 5000);']
  ];

  exactReplacements.forEach(([from, to]) => {
    if (src.includes(from)) {
      src = src.split(from).join(to);
      changed = true;
      ok('Throttled interval: ' + from + ' -> ' + to);
    }
  });

  src = src.replace(/window\\.setInterval\\(\\(\\) => \\{\\s*normalizeSingleBot\\(\\);\\s*placeBotInAllowedPlayArea\\(false\\);\\s*\\},\\s*350\\);/g, () => {
    changed = true;
    ok('Throttled normalizeSingleBot/placeBotInAllowedPlayArea interval.');
    return 'window.setInterval(() => {\\n        normalizeSingleBot();\\n        placeBotInAllowedPlayArea(false);\\n    }, 1800);';
  });

  src = src.replace(/window\\.setInterval\\(\\(\\) => \\{\\s*clampBotInsideSidebar\\(false\\);\\s*\\},\\s*220\\);/g, () => {
    changed = true;
    ok('Throttled clampBotInsideSidebar(false) interval.');
    return 'window.setInterval(() => {\\n        clampBotInsideSidebar(false);\\n    }, 1800);';
  });

  src = src.replace(/window\\.setInterval\\(\\(\\) => \\{\\s*applyAcademyRealInboxAvatars\\(\\);\\s*\\},\\s*1800\\);/g, () => {
    changed = true;
    ok('Throttled applyAcademyRealInboxAvatars interval.');
    return 'window.setInterval(() => {\\n        applyAcademyRealInboxAvatars();\\n    }, 3500);';
  });

  if (changed) write(filePath, src);
  else ok('No changes needed for ' + label);
}

function patchHtml() {
  if (!academyHtmlPath) return;

  let html = read(academyHtmlPath);
  let changed = false;

  log('');
  log('--- PATCHING academy.html ---');

  const version = '20260515-academy-freeze-flicker-v6';

  html = html.replace(/\\/css\\/style\\.css\\?v=[^"]+/g, '/css/style.css?v=' + version);
  html = html.replace(/\\/js\\/yh-shared-core\\.js\\?v=[^"]+/g, '/js/yh-shared-core.js?v=' + version);
  html = html.replace(/\\/js\\/yh-shared-runtime\\.js\\?v=[^"]+/g, '/js/yh-shared-runtime.js?v=' + version);
  html = html.replace(/\\/js\\/academy\\.js\\?v=[^"]+/g, '/js/academy.js?v=' + version);
  changed = true;
  ok('Updated CSS/core/runtime/academy cache-busting versions.');

  const oldLine = "document.body.classList.add('academy-startup-booting');";
  const newLines = "document.body.classList.add('academy-startup-booting');\\n      document.body.classList.add('academy-standalone-shell-pending');\\n      document.body.classList.remove('academy-shell-ready');";

  if (html.includes(oldLine) && !html.includes('academy-standalone-shell-pending')) {
    html = html.replace(oldLine, newLines);
    changed = true;
    ok('Added startup pending class before Academy shell reveal.');
  }

  if (!html.includes('yh_academy_inline_boot_failsafe_v6')) {
    html = html.replace(
      "    } catch (_) {\\n      document.body.classList.add('academy-startup-booting');\\n    }\\n  })();",
      `    } catch (_) {
      document.body.classList.add('academy-startup-booting');
      document.body.classList.add('academy-standalone-shell-pending');
      document.body.classList.remove('academy-shell-ready');
    }

    window.setTimeout(function yh_academy_inline_boot_failsafe_v6() {
      try {
        var loader = document.getElementById('yh-academy-startup-loader');
        document.body.classList.add('academy-shell-ready');
        document.body.classList.remove('academy-startup-booting');
        document.body.classList.remove('academy-standalone-shell-pending');

        if (loader) {
          loader.classList.add('hidden-step');
          loader.setAttribute('aria-hidden', 'true');
          loader.style.pointerEvents = 'none';
        }
      } catch (_) {}
    }, 9000);
  })();`
    );
    changed = true;
    ok('Added inline startup fail-safe to prevent permanent hidden shell.');
  }

  if (changed) write(academyHtmlPath, html);
}

function patchCss() {
  if (!styleCssPath) return;

  let css = read(styleCssPath);
  let changed = false;

  log('');
  log('--- PATCHING style.css ---');

  const patch = `/* PATCH: Academy startup anti-flicker + overlay click release v6 */
body[data-yh-page="academy"].academy-startup-booting .dashboard-layout,
body[data-yh-page="academy"].academy-standalone-shell-pending .dashboard-layout,
body[data-yh-page="academy"]:not(.academy-shell-ready) .dashboard-layout {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
}

body[data-yh-page="academy"].academy-shell-ready .dashboard-layout {
    opacity: 1 !important;
    visibility: visible !important;
}

body[data-yh-page="academy"] .yh-academy-startup-loader.hidden-step,
body[data-yh-page="academy"] .yh-academy-startup-loader.is-exiting,
body[data-yh-page="academy"] .yh-academy-startup-loader[aria-hidden="true"],
body[data-yh-page="academy"] .yh-tab-loader.hidden-step,
body[data-yh-page="academy"] .yh-tab-loader[aria-hidden="true"],
body[data-yh-page="academy"] #academy-search-results-panel.hidden-step,
body[data-yh-page="academy"] #academy-search-results-panel[aria-hidden="true"] {
    pointer-events: none !important;
}
/* END PATCH: Academy startup anti-flicker + overlay click release v6 */`;

  const result = replaceMarkerBlock(
    css,
    '/* PATCH: Academy startup anti-flicker + overlay click release v6 */',
    '/* END PATCH: Academy startup anti-flicker + overlay click release v6 */',
    ''
  );

  if (result.changed) {
    css = result.src;
    changed = true;
    ok('Removed existing v6 CSS patch before re-adding.');
  }

  css += '\\n\\n' + patch + '\\n';
  changed = true;
  ok('Added anti-flicker and overlay click-release CSS.');

  if (changed) write(styleCssPath, css);
}

patchRuntime();
patchAcademyJsLike(academyJsPath, 'academy.js');
patchAcademyJsLike(dashboardJsPath, 'dashboard.js');
patchHtml();
patchCss();

log('');
log('==================================================');
log('V6 STABILITY PATCH SCRIPT FINISHED');
log('==================================================');
