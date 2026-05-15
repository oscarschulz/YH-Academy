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
  const backupPath = file + '.bak-20260515-academy-v7-tab-interaction';
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

function replaceVersionedAsset(html, assetPath, version) {
  let output = html;
  const token = assetPath + '?v=';
  let cursor = 0;

  while (true) {
    const start = output.indexOf(token, cursor);
    if (start < 0) break;

    const quoteEnd = output.indexOf('"', start);
    if (quoteEnd < 0) break;

    output = output.slice(0, start) + token + version + output.slice(quoteEnd);
    cursor = start + token.length + version.length;
  }

  if (output.includes(assetPath + '"')) {
    output = output.split(assetPath + '"').join(assetPath + '?v=' + version + '"');
  }

  return output;
}

const academyJsPath = findFirst(['public/js/academy.js', 'js/academy.js', 'academy.js']);
const dashboardJsPath = findFirst(['public/js/dashboard.js', 'js/dashboard.js', 'dashboard.js']);
const academyHtmlPath = findFirst(['public/academy.html', 'academy.html']);

log('');
log('--- FILE DETECTION ---');

if (academyJsPath) ok('academy.js found: ' + path.relative(process.cwd(), academyJsPath));
else warn('academy.js not found.');

if (dashboardJsPath) ok('dashboard.js found: ' + path.relative(process.cwd(), dashboardJsPath));
else warn('dashboard.js not found.');

if (academyHtmlPath) ok('academy.html found: ' + path.relative(process.cwd(), academyHtmlPath));
else warn('academy.html not found.');

[academyJsPath, dashboardJsPath, academyHtmlPath].filter(Boolean).forEach(backup);

const helperPatch = `/* PATCH: Academy tab interaction safety v7 */
function academyReleaseTabLoaderHardV7(reason = 'tab') {
    try {
        if (typeof window.YHSharedRuntime?.forceHideAcademyTabLoader === 'function') {
            window.YHSharedRuntime.forceHideAcademyTabLoader();
        }
    } catch (_) {}

    try {
        if (typeof hideAcademyTabLoader === 'function') {
            hideAcademyTabLoader({ force: true });
        }
    } catch (_) {
        try {
            if (typeof hideAcademyTabLoader === 'function') hideAcademyTabLoader();
        } catch (_) {}
    }

    const overlay = document.getElementById('yh-tab-loader');
    if (overlay) {
        overlay.classList.remove('is-active');
        overlay.classList.add('hidden-step');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.pointerEvents = 'none';
    }

    document.body?.classList.add('academy-shell-ready');
    document.body?.classList.remove('academy-startup-booting');
    document.body?.classList.remove('academy-standalone-shell-pending');
    document.body?.removeAttribute('data-academy-tab-loading');

    window.__academyTabSwitchLockedV7 = false;
    window.__academyTabSwitchReasonV7 = '';
}

function academyLockTabSwitchV7(reason = 'tab') {
    const now = Date.now();
    const lastAt = Number(window.__academyLastTabSwitchAtV7 || 0);

    if (window.__academyTabSwitchLockedV7 === true && now - lastAt < 700) {
        return false;
    }

    window.__academyTabSwitchLockedV7 = true;
    window.__academyTabSwitchReasonV7 = reason;
    window.__academyLastTabSwitchAtV7 = now;
    document.body?.setAttribute('data-academy-tab-loading', reason);

    window.clearTimeout(window.__academyTabSwitchFailSafeV7);
    window.__academyTabSwitchFailSafeV7 = window.setTimeout(() => {
        academyReleaseTabLoaderHardV7('failsafe-' + reason);
    }, 2500);

    return true;
}

function academyUnlockTabSwitchSoonV7(reason = 'tab') {
    window.clearTimeout(window.__academyTabSwitchFailSafeV7);
    window.setTimeout(() => academyReleaseTabLoaderHardV7(reason), 80);
    window.setTimeout(() => academyReleaseTabLoaderHardV7(reason + '-late'), 420);
}

function academyAfterPaintV7(callback) {
    window.requestAnimationFrame(() => {
        window.setTimeout(callback, 0);
    });
}

function academyScheduleIdleV7(callback, timeout = 900) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout });
        return;
    }

    window.setTimeout(callback, 120);
}
/* END PATCH: Academy tab interaction safety v7 */

`;

const openMissionsFn = `function openAcademyMissionsView() {
    if (!academyLockTabSwitchV7('missions')) return;

    academyRememberLastNonProfileLocation('lead-missions', { missionPanel: 'hub' });

    showAcademyTabLoader('Loading Missions...');

    academyAfterPaintV7(() => {
        try {
            academyPushFeedFallbackHistory('missions');
            saveAcademyViewState('missions');
            revealAcademyMissionsViewShell();
            setAcademyMissionsPanel('hub');
        } catch (error) {
            console.error('openAcademyMissionsView error:', error);
            showToast(error?.message || 'Failed to open Missions.', 'error');

            try {
                revealAcademyMissionsViewShell();
            } catch (_) {}
        } finally {
            academyUnlockTabSwitchSoonV7('missions');
        }
    });
}`;

const openMessagesFn = `function openAcademyMessagesView() {
    if (!academyLockTabSwitchV7('messages')) return;

    academyRememberLastNonProfileLocation('messages');

    showAcademyTabLoader('Loading Messages...');

    academyAfterPaintV7(() => {
        try {
            academyPushFeedFallbackHistory('messages');
            closeRoadmapIntake();
            academyResetCoachMode();
            hideAcademyViewsForFeed();
            setAcademySidebarActive('nav-messages');
            saveAcademyViewState('messages');
            applyAcademyMessengerMode(true);

            const academyChat = document.getElementById('academy-chat');
            const chatWelcomeBox = document.getElementById('chat-welcome-box');
            const chatPinnedMessage = document.getElementById('chat-pinned-message');

            if (academyChat) {
                academyChat.classList.remove('hidden-step');
                academyChat.classList.add('fade-in');
            }

            academyRestoreMessagesInboxHeader();

            if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
            if (chatPinnedMessage) chatPinnedMessage.style.display = 'none';

            academyResetMessagesThreadState();
            academySetMessagesChatMode('messages');

            const rooms = academyReadMessageRooms();

            academyScheduleIdleV7(() => {
                try {
                    renderAcademyMessagesInboxList();

                    if (rooms.length) {
                        academyRenderMessagesThreadEmpty('Select a conversation from the inbox to open that private thread.');
                    } else {
                        academyRenderMessagesThreadEmpty('No conversations yet. Start a DM or create a group to see it here.');
                    }
                } catch (error) {
                    console.error('render messages shell error:', error);
                }
            }, 300);

            academyScheduleIdleV7(() => {
                academyHydrateMessageRooms(!academyMessagesInboxState.hydratedOnce).catch((error) => {
                    showToast(error?.message || 'Failed to load conversations.', 'error');
                });
            }, 1200);
        } catch (error) {
            console.error('openAcademyMessagesView error:', error);
            showToast(error?.message || 'Failed to open Messages.', 'error');
        } finally {
            academyUnlockTabSwitchSoonV7('messages');
        }
    });
}`;

function patchJsFile(file, label) {
  if (!file) return;

  let src = read(file);
  let changed = false;

  log('');
  log('--- PATCHING ' + label + ' ---');

  let result = replaceMarkerBlock(
    src,
    '/* PATCH: Academy tab interaction safety v7 */',
    '/* END PATCH: Academy tab interaction safety v7 */',
    ''
  );

  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Removed existing v7 helper block before re-adding.');
  }

  const messagesIndex = src.indexOf('function openAcademyMessagesView');
  if (messagesIndex >= 0) {
    src = src.slice(0, messagesIndex) + helperPatch + src.slice(messagesIndex);
    changed = true;
    ok('Inserted v7 tab interaction helper before Messages function.');
  } else {
    src = helperPatch + src;
    changed = true;
    warn('openAcademyMessagesView marker not found before helper insert; prepended helper.');
  }

  result = replaceNamedFunction(src, 'openAcademyMissionsView', openMissionsFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced openAcademyMissionsView with try/finally + hard loader release.');
  } else {
    warn('openAcademyMissionsView not found in ' + label);
  }

  result = replaceNamedFunction(src, 'openAcademyMessagesView', openMessagesFn);
  if (result.changed) {
    src = result.src;
    changed = true;
    ok('Replaced openAcademyMessagesView with deferred render/hydration.');
  } else {
    warn('openAcademyMessagesView not found in ' + label);
  }

  if (changed) write(file, src);
  else ok('No changes needed for ' + label);
}

patchJsFile(academyJsPath, 'academy.js');
patchJsFile(dashboardJsPath, 'dashboard.js');

if (academyHtmlPath) {
  log('');
  log('--- PATCHING academy.html cache version ---');

  let html = read(academyHtmlPath);
  const version = '20260515-academy-tab-debug-v7';

  html = replaceVersionedAsset(html, '/js/academy.js', version);
  html = replaceVersionedAsset(html, '/js/dashboard.js', version);

  write(academyHtmlPath, html);
}

log('');
log('==================================================');
log('V7 TAB INTERACTION PATCH SCRIPT FINISHED');
log('==================================================');
