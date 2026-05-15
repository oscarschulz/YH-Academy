const fs = require('fs');
const path = require('path');

const files = [
  'public/js/academy.js',
  'public/js/dashboard.js'
];

function log(msg = '') {
  console.log(msg);
}

function backup(full, file) {
  const backupPath = full + '.bak-20260514-schedule-search-v54';
  fs.copyFileSync(full, backupPath);
  log('[OK] Backup created: ' + file + '.bak-20260514-schedule-search-v54');
}

const cleanScheduleAcademySearch = `function scheduleAcademySearch(query = '', options = {}) {
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

function replaceScheduleBlock(src, file) {
  const start = src.indexOf('function scheduleAcademySearch');
  if (start < 0) {
    log('[WARN] scheduleAcademySearch not found in ' + file);
    return { src, changed: false };
  }

  const end = src.indexOf('function closeAcademySearchResultsPanel', start);
  if (end < 0) {
    log('[WARN] closeAcademySearchResultsPanel not found after scheduleAcademySearch in ' + file);
    return { src, changed: false };
  }

  const before = src.slice(start, Math.min(end, start + 1200));
  if (before.includes('}) {')) {
    log('[OK] Found broken orphan token `}) {` inside scheduleAcademySearch region in ' + file);
  } else {
    log('[INFO] No visible `}) {` token in scheduleAcademySearch region, but replacing cleanly anyway: ' + file);
  }

  const next = src.slice(0, start) + cleanScheduleAcademySearch + '\n\n' + src.slice(end);
  return { src: next, changed: next !== src };
}

function fixBadEvalWrapper(src, file) {
  const badEval = `eval(name + " = window["" + name + ""]");`;
  const goodEval = `eval(name + ' = window["' + name + '"]');`;

  const count = src.split(badEval).length - 1;
  if (count > 0) {
    log('[OK] Fixed bad eval wrapper count in ' + file + ': ' + count);
    return {
      src: src.split(badEval).join(goodEval),
      changed: true
    };
  }

  log('[INFO] No bad eval wrapper found in ' + file);
  return { src, changed: false };
}

function patchFile(file) {
  const full = path.resolve(process.cwd(), file);

  log('');
  log('--- Repairing: ' + file + ' ---');

  if (!fs.existsSync(full)) {
    log('[SKIP] File not found: ' + file);
    return;
  }

  backup(full, file);

  let src = fs.readFileSync(full, 'utf8');
  let changed = false;

  const scheduleResult = replaceScheduleBlock(src, file);
  src = scheduleResult.src;
  changed = changed || scheduleResult.changed;

  const evalResult = fixBadEvalWrapper(src, file);
  src = evalResult.src;
  changed = changed || evalResult.changed;

  if (changed) {
    fs.writeFileSync(full, src);
    log('[OK] Saved repaired file: ' + file);
  } else {
    log('[WARN] No changes saved for: ' + file);
  }
}

files.forEach(patchFile);

log('');
log('==================================================');
log('V5.4 NODE REPAIR SCRIPT FINISHED');
log('==================================================');
