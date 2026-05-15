const fs = require('fs');
const path = require('path');

function log(msg = '') { console.log(msg); }
function ok(msg = '') { console.log('[OK] ' + msg); }
function warn(msg = '') { console.log('[WARN] ' + msg); }

function findFirst(candidates) {
  for (const file of candidates) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

function backup(file) {
  if (!file || !fs.existsSync(file)) return;
  const backupPath = file + '.bak-20260515-academy-v61-stability';
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

function replaceVersionedAsset(html, assetPath, version) {
  let output = html;
  const token = assetPath + '?v=';
  let cursor = 0;
  let changed = false;

  while (true) {
    const start = output.indexOf(token, cursor);
    if (start < 0) break;

    const quoteEnd = output.indexOf('"', start);
    if (quoteEnd < 0) break;

    output = output.slice(0, start) + token + version + output.slice(quoteEnd);
    cursor = start + token.length + version.length;
    changed = true;
  }

  if (!changed && output.includes(assetPath + '"')) {
    output = output.split(assetPath + '"').join(assetPath + '?v=' + version + '"');
  }

  return output;
}

const academyJsPath = findFirst(['public/js/academy.js', 'js/academy.js', 'academy.js']);
const dashboardJsPath = findFirst(['public/js/dashboard.js', 'js/dashboard.js', 'dashboard.js']);
const runtimePath = findFirst(['public/js/yh-shared-runtime.js', 'js/yh-shared-runtime.js', 'yh-shared-runtime.js']);
const academyHtmlPath = findFirst(['public/academy.html', 'academy.html']);
const styleCssPath = findFirst(['public/css/style.css', 'css/style.css', 'style.css']);

log('');
log('--- FILE DETECTION ---');
if (academyJsPath) ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath)); else warn('academy.js not found');
if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath)); else warn('dashboard.js not found');
if (runtimePath) ok('yh-shared-runtime.js found: ' + path.relative(process.cwd(), runtimePath)); else warn('yh-shared-runtime.js not found');
if (academyHtmlPath) ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath)); else warn('academy.html not found');
if (styleCssPath) ok('style.css found: ' + path.relative(process.cwd(), styleCssPath)); else warn('style.css not found');

[academyJsPath, dashboardJsPath, runtimePath, academyHtmlPath, styleCssPath].filter(Boolean).forEach(backup);

function patchRuntime() {
  if (!runtimePath) return;

  let src = read(runtimePath);
  let changed = false;

  log('');
  log('--- PATCHING yh-shared-runtime.js ---');

  if (!src.includes('let yhTabLoaderForceHideTimer')) {
    src = src.replace(
      'let yhTabLoaderHideTimer = null;',
      'let yhTabLoaderHideTimer = null;\n    let yhTabLoaderForceHideTimer = null;'
    );
    changed = true;
    ok('Added force-hide timer state.');
  }

  const showFn = `function showAcademyTabLoader(label = 'Loading.') {
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
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.style.pointerEvents = 'auto';

        yhTabLoaderVisibleAt = Date.now();

        yhTabLoaderForceHideTimer = setTimeout(() => {
            forceHideAcademyTabLoader();
        }, 7500);
    }`;

  const hideFn = `function hideAcademyTabLoader(options = {}) {
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

  const forceFn = `function forceHideAcademyTabLoader() {
        yhTabLoaderDepth = 0;
        hideAcademyTabLoader({ force: true });
    }`;

  let result = replaceNamedFunction(src, 'showAcademyTabLoader', showFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced showAcademyTabLoader with capped depth and force-hide.');
  } else {
    warn('showAcademyTabLoader not replaced.');
  }

  result = replaceNamedFunction(src, 'hideAcademyTabLoader', hideFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced hideAcademyTabLoader with force-release behavior.');
  } else {
    warn('hideAcademyTabLoader not replaced.');
  }

  if (!src.includes('function forceHideAcademyTabLoader')) {
    const anchor = 'function readDashboardViewState() {';
    if (src.includes(anchor)) {
      src = src.replace(anchor, forceFn + '\n\n    ' + anchor);
      changed = true;
      ok('Added forceHideAcademyTabLoader helper.');
    }
  }

  if (!src.includes('forceHideAcademyTabLoader,')) {
    src = src.replace('hideAcademyTabLoader,', 'hideAcademyTabLoader,\n        forceHideAcademyTabLoader,');
    changed = true;
    ok('Exported forceHideAcademyTabLoader.');
  }

  if (changed) write(runtimePath, src);
}

function patchAcademyJsLike(filePath, label) {
  if (!filePath) return;

  let src = read(filePath);
  let changed = false;

  log('');
  log('--- PATCHING ' + label + ' ---');

  const intervalGuard = `/* PATCH: Academy interval budget guard v6.1 */
(function installAcademyIntervalBudgetGuardV61() {
    if (window.__academyIntervalBudgetGuardV61Installed) return;
    window.__academyIntervalBudgetGuardV61Installed = true;

    const nativeSetInterval = window.setInterval.bind(window);

    function isAcademyPage() {
        const page = document.body && document.body.getAttribute('data-yh-page');
        const path = String(window.location.pathname || '').replace(/\\/+$/, '');
        return page === 'academy' || path === '/academy';
    }

    function shouldThrottle(source) {
        const text = String(source || '');
        return (
            text.indexOf('lockBotToVisibleBottom') >= 0 ||
            text.indexOf('applyManualMessagesTab') >= 0 ||
            text.indexOf('clampBotInsideSidebar') >= 0 ||
            text.indexOf('normalizeSingleBot') >= 0 ||
            text.indexOf('placeBotInAllowedPlayArea') >= 0 ||
            text.indexOf('bootAcademyVoiceLoungeFinalFixes') >= 0 ||
            text.indexOf('bootGroupsInboxFix') >= 0 ||
            text.indexOf('bootMessagesUiPolish') >= 0 ||
            text.indexOf('applyAcademyRealInboxAvatars') >= 0
        );
    }

    window.setInterval = function academyBudgetedSetInterval(callback, delay) {
        const args = Array.prototype.slice.call(arguments, 2);

        if (!isAcademyPage() || typeof callback !== 'function') {
            return nativeSetInterval.apply(window, arguments);
        }

        const source = String(callback || '');
        let safeDelay = Number(delay || 0);

        if (shouldThrottle(source) && safeDelay < 1800) {
            safeDelay = 1800;
        }

        const wrapped = function academyBudgetedIntervalCallback() {
            if (document.hidden) return;
            return callback.apply(this, args);
        };

        return nativeSetInterval(wrapped, safeDelay || delay);
    };
})();
/* END PATCH: Academy interval budget guard v6.1 */

`;

  if (!src.includes('Academy interval budget guard v6.1')) {
    const insertAt = src.indexOf('const {');
    if (insertAt >= 0) {
      src = src.slice(0, insertAt) + intervalGuard + src.slice(insertAt);
    } else {
      src = intervalGuard + src;
    }
    changed = true;
    ok('Inserted interval budget guard v6.1.');
  }

  const hideStartupFn = `function hideAcademyStartupBootOverlay() {
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

  let result = replaceNamedFunction(src, 'hideAcademyStartupBootOverlay', hideStartupFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Hardened startup overlay release.');
  } else {
    warn('hideAcademyStartupBootOverlay not found in ' + label);
  }

  const startupFailSafeFn = `function scheduleAcademyStartupBootFailSafe(delayMs = 7000) {
    if (academyStartupBootFailSafeTimer) {
        clearTimeout(academyStartupBootFailSafeTimer);
    }

    academyStartupBootFailSafeTimer = window.setTimeout(() => {
        hideAcademyStartupBootOverlay();
    }, Math.min(Number(delayMs) || 7000, 5500));
}`;

  result = replaceNamedFunction(src, 'scheduleAcademyStartupBootFailSafe', startupFailSafeFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Reduced startup failsafe maximum to 5.5s.');
  }

  const replacements = [
    ['window.setInterval(lockBotToVisibleBottom, 160);', 'window.setInterval(lockBotToVisibleBottom, 1800);'],
    ['window.setInterval(() => applyManualMessagesTab(readStoredTab()), 240);', 'window.setInterval(() => applyManualMessagesTab(readStoredTab()), 1800);'],
    ['window.setInterval(bootAcademyVoiceLoungeFinalFixes, 900);', 'window.setInterval(bootAcademyVoiceLoungeFinalFixes, 3500);'],
    ['window.setInterval(bootGroupsInboxFix, 1200);', 'window.setInterval(bootGroupsInboxFix, 3500);'],
    ['window.setInterval(bootMessagesUiPolish, 1800);', 'window.setInterval(bootMessagesUiPolish, 3500);'],
    ['window.setInterval(academyBootInlineEditAndBotFix, 3500);', 'window.setInterval(academyBootInlineEditAndBotFix, 5000);'],
    ['window.setInterval(runAcademyPasswordManagerGuard, 2500);', 'window.setInterval(runAcademyPasswordManagerGuard, 5000);']
  ];

  replacements.forEach(([from, to]) => {
    if (src.includes(from)) {
      src = src.split(from).join(to);
      changed = true;
      ok('Throttled interval in ' + label + ': ' + from);
    }
  });

  if (changed) write(filePath, src);
}

function patchHtml() {
  if (!academyHtmlPath) return;

  let html = read(academyHtmlPath);
  let changed = false;
  const version = '20260515-academy-freeze-flicker-v61';

  log('');
  log('--- PATCHING academy.html ---');

  html = replaceVersionedAsset(html, '/css/style.css', version);
  html = replaceVersionedAsset(html, '/js/yh-shared-core.js', version);
  html = replaceVersionedAsset(html, '/js/yh-shared-runtime.js', version);
  html = replaceVersionedAsset(html, '/js/academy.js', version);
  changed = true;
  ok('Updated asset cache-busting versions.');

  const bodyOpen = '<body data-yh-view="academy" data-yh-page="academy">';
  const bodyOpenNew = '<body data-yh-view="academy" data-yh-page="academy" class="academy-startup-booting academy-standalone-shell-pending">';
  if (html.includes(bodyOpen)) {
    html = html.replace(bodyOpen, bodyOpenNew);
    changed = true;
    ok('Added startup shell pending class to body.');
  }

  if (!html.includes('yh_academy_inline_shell_reveal_failsafe_v61')) {
    const marker = '</script>\n\n<div id="toast-notification">';
    const failsafe = `</script>

<script id="yh-academy-inline-shell-failsafe-v61">
  window.setTimeout(function yh_academy_inline_shell_reveal_failsafe_v61() {
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
</script>

<div id="toast-notification">`;

    if (html.includes(marker)) {
      html = html.replace(marker, failsafe);
      changed = true;
      ok('Added inline shell reveal failsafe.');
    } else {
      warn('Inline startup script marker not found; failsafe not inserted.');
    }
  }

  if (changed) write(academyHtmlPath, html);
}

function patchCss() {
  if (!styleCssPath) return;

  let css = read(styleCssPath);
  let changed = false;

  log('');
  log('--- PATCHING style.css ---');

  const patch = `/* PATCH: Academy startup anti-flicker + overlay click release v6.1 */
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
    pointer-events: auto !important;
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
/* END PATCH: Academy startup anti-flicker + overlay click release v6.1 */`;

  let result = replaceMarkerBlock(
    css,
    '/* PATCH: Academy startup anti-flicker + overlay click release v6.1 */',
    '/* END PATCH: Academy startup anti-flicker + overlay click release v6.1 */',
    ''
  );

  if (result.changed) {
    css = result.src;
    changed = true;
    ok('Removed existing v6.1 CSS patch before re-adding.');
  }

  result = replaceMarkerBlock(
    css,
    '/* PATCH: Academy startup anti-flicker + overlay click release v6 */',
    '/* END PATCH: Academy startup anti-flicker + overlay click release v6 */',
    ''
  );

  if (result.changed) {
    css = result.src;
    changed = true;
    ok('Removed old v6 CSS patch.');
  }

  css += '\n\n' + patch + '\n';
  changed = true;
  ok('Added anti-flicker and click-release CSS.');

  if (changed) write(styleCssPath, css);
}

patchRuntime();
patchAcademyJsLike(academyJsPath, 'academy.js');
patchAcademyJsLike(dashboardJsPath, 'dashboard.js');
patchHtml();
patchCss();

log('');
log('==================================================');
log('V6.1 STABILITY PATCH SCRIPT FINISHED');
log('==================================================');
