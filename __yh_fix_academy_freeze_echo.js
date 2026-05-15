const fs = require('fs');
const path = require('path');

function echo(message = '') {
  console.log(message);
}

function ok(message = '') {
  console.log('[OK] ' + message);
}

function info(message = '') {
  console.log('[INFO] ' + message);
}

function warn(message = '') {
  console.log('[WARN] ' + message);
}

function fail(message = '') {
  console.error('[ERROR] ' + message);
  process.exitCode = 1;
}

function findFirst(candidates = []) {
  for (const file of candidates) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function backup(file) {
  const backupPath = file + '.bak-20260514-freeze-echo-fix';
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

echo('');
echo('--- FILE DETECTION ---');

if (!academyJsPath) fail('academy.js not found.');
else ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath));

if (!academyHtmlPath) fail('academy.html not found.');
else ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath));

if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath));
else warn('dashboard.js not found. Continuing with academy.js only.');

if (process.exitCode) process.exit(1);

backup(academyJsPath);
backup(academyHtmlPath);
if (dashboardJsPath) backup(dashboardJsPath);

const safeSearchPatch = String.raw`/* PATCH: Academy search fields stay empty until user types v2 */
(function installAcademySearchFieldsStayEmptyUntilUserTypesV2() {
    if (window.__academySearchFieldsStayEmptyUntilUserTypesV2Installed) return;
    window.__academySearchFieldsStayEmptyUntilUserTypesV2Installed = true;

    const SEARCH_IDS = [
        'academy-global-search-input',
        'academy-member-browser-search-input'
    ];

    let cleanScheduled = false;

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

    function closeSearchUi() {
        try {
            if (typeof closeAcademySearchResultsPanel === 'function') {
                closeAcademySearchResultsPanel();
            }
        } catch (_) {}

        const panel = document.getElementById('academy-search-results-panel');
        const inner = document.getElementById('academy-search-results-inner');

        if (inner) {
            inner.innerHTML = '<div class="academy-search-result-empty">Start typing to search users, posts, captions, and tags.</div>';
        }

        if (panel) {
            panel.classList.add('hidden-step');
            panel.setAttribute('aria-hidden', 'true');
        }

        document.body?.classList.remove('academy-search-results-open');
    }

    function clearSearchDebounce() {
        try {
            if (typeof academySearchDebounceTimer !== 'undefined' && academySearchDebounceTimer) {
                clearTimeout(academySearchDebounceTimer);
                academySearchDebounceTimer = null;
            }
        } catch (_) {}

        try {
            if (typeof academySearchRequestToken !== 'undefined') {
                academySearchRequestToken += 1;
            }
        } catch (_) {}
    }

    function hardenSearchInput(input) {
        if (!input) return;

        if (input.dataset.academySearchV2Hardened !== '1') {
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
                input.setAttribute('type', 'search');
                input.setAttribute('name', 'academy_search_' + input.id.replace(/[^a-z0-9_-]/gi, '_'));
            }

            input.dataset.academySearchV2Hardened = '1';
        }

        input.removeAttribute('readonly');
        input.removeAttribute('value');
    }

    function clearSearchInput(input, reason = 'system') {
        if (!input) return false;

        hardenSearchInput(input);

        const hadValue = Boolean(safeText(input.value) || safeText(input.defaultValue) || safeText(input.getAttribute('value')));

        input.value = '';
        input.defaultValue = '';
        input.removeAttribute('value');
        input.dataset.academySearchUserTyped = '';
        input.dataset.academyLastSearchClearReason = reason;

        return hadValue;
    }

    function cleanSearchInputs(reason = 'system') {
        let changed = false;

        getSearchInputs().forEach((input) => {
            hardenSearchInput(input);

            const value = safeText(input.value || input.defaultValue || input.getAttribute('value'));

            if (!value) return;

            if (input.dataset.academySearchUserTyped === '1' && !isEmailLike(value)) {
                return;
            }

            if (clearSearchInput(input, reason)) {
                changed = true;
            }
        });

        if (changed) {
            clearSearchDebounce();
            closeSearchUi();
        }

        return changed;
    }

    function scheduleClean(reason = 'scheduled') {
        if (cleanScheduled) return;

        cleanScheduled = true;

        window.requestAnimationFrame(() => {
            cleanScheduled = false;
            bindSearchInputs();
            cleanSearchInputs(reason);
        });
    }

    function markUserTyped(input) {
        if (!input) return;

        hardenSearchInput(input);
        input.dataset.academySearchUserTyped = '1';
    }

    function bindSearchInput(input) {
        if (!input || input.dataset.academySearchV2Bound === '1') return;

        input.dataset.academySearchV2Bound = '1';
        hardenSearchInput(input);

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

                clearSearchInput(input, isEmailLike(value) ? 'email-autofill-blocked' : 'non-user-prefill-blocked');
                clearSearchDebounce();
                closeSearchUi();
            }
        }, true);

        input.addEventListener('change', (event) => {
            const value = safeText(input.value);

            if (isEmailLike(value) || input.dataset.academySearchUserTyped !== '1') {
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();

                clearSearchInput(input, 'change-prefill-blocked');
                clearSearchDebounce();
                closeSearchUi();
            }
        }, true);

        input.addEventListener('blur', () => {
            if (!safeText(input.value)) {
                input.dataset.academySearchUserTyped = '';
            }
        });
    }

    function bindSearchInputs() {
        getSearchInputs().forEach(bindSearchInput);
    }

    function boot() {
        bindSearchInputs();
        cleanSearchInputs('boot');

        [80, 250, 700, 1500].forEach((delay) => {
            window.setTimeout(() => scheduleClean('delayed-' + delay), delay);
        });
    }

    document.addEventListener('focusin', (event) => {
        const input = event.target;

        if (SEARCH_IDS.includes(input?.id)) {
            bindSearchInput(input);
            scheduleClean('focusin');
        }
    }, true);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleClean('visible');
    });

    window.addEventListener('pageshow', () => scheduleClean('pageshow'));
    window.addEventListener('load', () => scheduleClean('load'));

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
})();
/* END PATCH: Academy search fields stay empty until user types v2 */`;

const supersededStrictPatch = `/* PATCH: Academy strict search email autofill hard stop v2
   Superseded by the safer Academy search v2 guard below.
   The old v1 interval/attribute observer was removed to prevent browser freeze.
*/
/* END PATCH: Academy strict search email autofill hard stop v2 */`;

function patchSearchGuardInJs(file) {
  let src = read(file);
  let changed = false;

  const rel = path.relative(process.cwd(), file);
  echo('');
  echo('--- PATCHING SEARCH GUARD IN ' + rel + ' ---');

  const strictRegex = /\/\* PATCH: Academy strict search email autofill hard stop v1 \*\/[\s\S]*?\/\* END PATCH: Academy strict search email autofill hard stop v1 \*\//g;
  if (strictRegex.test(src)) {
    src = src.replace(strictRegex, supersededStrictPatch);
    changed = true;
    ok('Removed old strict email autofill hard-stop v1 block.');
  } else {
    info('No strict email autofill hard-stop v1 block found.');
  }

  const searchRegex = /\/\* PATCH: Academy search fields stay empty until user types v\d+ \*\/[\s\S]*?\/\* END PATCH: Academy search fields stay empty until user types v\d+ \*\//g;
  if (searchRegex.test(src)) {
    src = src.replace(searchRegex, safeSearchPatch);
    changed = true;
    ok('Replaced old search empty-until-user-types block with safe v2.');
  } else if (!src.includes('installAcademySearchFieldsStayEmptyUntilUserTypesV2')) {
    src += '\n\n' + safeSearchPatch + '\n';
    changed = true;
    ok('Appended safe search v2 guard.');
  } else {
    info('Safe search v2 guard already exists.');
  }

  if (changed) write(file, src);
  else info('No search guard changes needed in ' + rel);
}

function patchStartupResolver(file) {
  let src = read(file);

  echo('');
  echo('--- PATCHING STARTUP SECTION PRIORITY IN academy.js ---');

  const replacement = `function resolveAcademyStartupBootSection() {
    let urlSection = '';

    try {
        urlSection = getAcademySectionFromUrl();

        if (urlSection && urlSection !== 'home') {
            try {
                sessionStorage.setItem(YH_ACADEMY_STARTUP_SECTION_KEY, urlSection);
            } catch (_) {}

            return normalizeAcademyStartupSection(urlSection);
        }
    } catch (_) {}

    try {
        const stored = sessionStorage.getItem(YH_ACADEMY_STARTUP_SECTION_KEY);
        if (stored) {
            return normalizeAcademyStartupSection(stored);
        }
    } catch (_) {}

    return normalizeAcademyStartupSection(urlSection || 'home');
}`;

  if (src.includes('function resolveAcademyStartupBootSection()')) {
    const result = replaceNamedFunction(src, 'resolveAcademyStartupBootSection', replacement);
    if (result.changed) {
      write(file, result.source);
      ok('Startup resolver now prioritizes URL section before stale sessionStorage.');
    } else {
      warn('resolveAcademyStartupBootSection was found but could not be replaced.');
    }
  } else {
    warn('resolveAcademyStartupBootSection not found in academy.js.');
  }
}

function patchAcademyHtml(file) {
  let html = read(file);
  let changed = false;

  echo('');
  echo('--- PATCHING academy.html SEARCH INPUTS + SCRIPT VERSION ---');

  const oldInline = /var section = normalizeAcademyStartupSection\(\s*storedSection\s*\|\|\s*urlSection\s*\|\|\s*'home'\s*\);/;
  if (oldInline.test(html)) {
    html = html.replace(oldInline, "var section = normalizeAcademyStartupSection(urlSection || storedSection || 'home');");
    changed = true;
    ok('Inline startup loader now prioritizes URL section.');
  } else {
    info('Inline startup section priority line already fixed or not found.');
  }

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
                                name="academy_community_search"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                data-bwignore="true"
                                data-form-type="other"
                                aria-autocomplete="none">`;

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
                    name="academy_member_search"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    aria-autocomplete="none">`;

  const globalRegex = /<input\b(?=[^>]*\bid="academy-global-search-input")[\s\S]*?>/i;
  if (globalRegex.test(html)) {
    html = html.replace(globalRegex, globalInput);
    changed = true;
    ok('Cleaned academy-global-search-input and removed readonly.');
  } else {
    warn('academy-global-search-input tag not found.');
  }

  const memberRegex = /<input\b(?=[^>]*\bid="academy-member-browser-search-input")[\s\S]*?>/i;
  if (memberRegex.test(html)) {
    html = html.replace(memberRegex, memberInput);
    changed = true;
    ok('Cleaned academy-member-browser-search-input corrupted placeholder and removed readonly.');
  } else {
    warn('academy-member-browser-search-input tag not found.');
  }

  const scriptRegex = /\/js\/academy\.js\?v=[^"]+/g;
  if (scriptRegex.test(html)) {
    html = html.replace(scriptRegex, '/js/academy.js?v=20260514-startup-search-safe-v3');
    changed = true;
    ok('Updated academy.js cache-busting version.');
  } else {
    warn('academy.js script version not found in academy.html.');
  }

  const cssRegex = /\/css\/style\.css\?v=[^"]+/g;
  if (cssRegex.test(html)) {
    html = html.replace(cssRegex, '/css/style.css?v=20260514-startup-search-safe-v3');
    changed = true;
    ok('Updated style.css cache-busting version.');
  } else {
    info('style.css version line not found or not versioned.');
  }

  if (changed) write(file, html);
  else info('No academy.html changes needed.');
}

patchSearchGuardInJs(academyJsPath);
patchStartupResolver(academyJsPath);

if (dashboardJsPath) {
  patchSearchGuardInJs(dashboardJsPath);
}

patchAcademyHtml(academyHtmlPath);

echo('');
echo('==================================================');
echo('PATCH SCRIPT FINISHED');
echo('==================================================');
