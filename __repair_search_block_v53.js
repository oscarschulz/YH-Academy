const fs = require('fs');
const path = require('path');

const files = [
  'public/js/academy.js',
  'public/js/dashboard.js'
];

function log(msg = '') {
  console.log(msg);
}

function backup(full, label) {
  const backupPath = full + '.bak-20260514-search-block-v53';
  fs.copyFileSync(full, backupPath);
  log('[OK] Backup created: ' + label + '.bak-20260514-search-block-v53');
}

function replaceRegion(src, startRegex, endMarker, replacement, label) {
  const match = src.match(startRegex);

  if (!match || typeof match.index !== 'number') {
    return {
      src,
      changed: false,
      message: '[WARN] Start block not found: ' + label
    };
  }

  const start = match.index;
  const end = src.indexOf(endMarker, start);

  if (end < 0) {
    return {
      src,
      changed: false,
      message: '[WARN] End marker not found after start: ' + label
    };
  }

  return {
    src: src.slice(0, start) + replacement + '\n\n' + src.slice(end),
    changed: true,
    message: '[OK] Replaced block: ' + label
  };
}

const cleanRequestAcademyMemberSearch = [
"async function requestAcademyMemberSearch(query = '') {",
"    const normalizedQuery = String(query || '').trim();",
"    const isEmailSearchQuery = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedQuery);",
"",
"    if (!normalizedQuery || isEmailSearchQuery) return [];",
"",
"    const cacheKey = normalizedQuery.toLowerCase();",
"    const now = Date.now();",
"    const CACHE_TTL_MS = 15 * 1000;",
"",
"    try {",
"        if (typeof academyMemberSearchCache !== 'undefined' && academyMemberSearchCache instanceof Map) {",
"            const cached = academyMemberSearchCache.get(cacheKey);",
"            if (cached && (now - cached.at) < CACHE_TTL_MS && Array.isArray(cached.members)) {",
"                return cached.members;",
"            }",
"        }",
"    } catch (_) {}",
"",
"    try {",
"        if (",
"            typeof academyMemberSearchInFlight !== 'undefined' &&",
"            academyMemberSearchInFlight &&",
"            academyMemberSearchInFlight.key === cacheKey",
"        ) {",
"            return academyMemberSearchInFlight.promise;",
"        }",
"    } catch (_) {}",
"",
"    const endpoint = '/api/academy/community/members?limit=24&query=' + encodeURIComponent(normalizedQuery);",
"",
"    const promise = academyAuthedFetch(endpoint, { method: 'GET' })",
"        .then((result) => (Array.isArray(result?.members) ? result.members : []))",
"        .catch(() => [])",
"        .finally(() => {",
"            try {",
"                if (",
"                    typeof academyMemberSearchInFlight !== 'undefined' &&",
"                    academyMemberSearchInFlight &&",
"                    academyMemberSearchInFlight.key === cacheKey",
"                ) {",
"                    academyMemberSearchInFlight = null;",
"                }",
"            } catch (_) {}",
"        });",
"",
"    try {",
"        if (typeof academyMemberSearchInFlight !== 'undefined') {",
"            academyMemberSearchInFlight = { key: cacheKey, promise };",
"        }",
"    } catch (_) {}",
"",
"    const members = await promise;",
"",
"    try {",
"        if (typeof academyMemberSearchCache !== 'undefined' && academyMemberSearchCache instanceof Map) {",
"            academyMemberSearchCache.set(cacheKey, { at: Date.now(), members });",
"        }",
"    } catch (_) {}",
"",
"    return members;",
"}"
].join('\n');

const cleanAcademySyncSearchInputs = [
"function academySyncSearchInputs(value = '', sourceInputId = '') {",
"    const normalizedValue = String(value || '');",
"    const normalizedTrimmedValue = normalizedValue.trim();",
"    const isEmailSearchValue = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedTrimmedValue);",
"",
"    if (!normalizedTrimmedValue || isEmailSearchValue) {",
"        ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {",
"            const input = document.getElementById(id);",
"            if (input) {",
"                input.value = '';",
"                input.defaultValue = '';",
"                input.removeAttribute('value');",
"                input.dataset.academySearchUserTyped = '';",
"            }",
"        });",
"",
"        if (typeof closeAcademySearchResultsPanel === 'function') {",
"            closeAcademySearchResultsPanel();",
"        }",
"",
"        document.body?.classList.remove('academy-search-results-open');",
"        return;",
"    }",
"",
"    ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {",
"        if (id === sourceInputId) return;",
"",
"        const input = document.getElementById(id);",
"        if (input && input.value !== normalizedValue) {",
"            input.value = normalizedValue;",
"        }",
"    });",
"}"
].join('\n');

for (const file of files) {
  const full = path.resolve(process.cwd(), file);

  log('');
  log('--- Repairing: ' + file + ' ---');

  if (!fs.existsSync(full)) {
    log('[SKIP] File not found: ' + file);
    continue;
  }

  backup(full, file);

  let src = fs.readFileSync(full, 'utf8');
  let changed = false;

  let result = replaceRegion(
    src,
    /async\s+function\s+requestAcademyMemberSearch\s*\(\s*query\s*=\s*['"]{2}\s*\)\s*\{/,
    'function academySyncSearchInputs',
    cleanRequestAcademyMemberSearch,
    'requestAcademyMemberSearch'
  );

  log(result.message);
  src = result.src;
  changed = changed || result.changed;

  result = replaceRegion(
    src,
    /function\s+academySyncSearchInputs\s*\(\s*value\s*=\s*['"]{2}\s*,\s*sourceInputId\s*=\s*['"]{2}\s*\)\s*\{/,
    'function renderAcademySearchResultsLoadingPanel',
    cleanAcademySyncSearchInputs,
    'academySyncSearchInputs'
  );

  log(result.message);
  src = result.src;
  changed = changed || result.changed;

  if (changed) {
    fs.writeFileSync(full, src);
    log('[OK] Saved repaired file: ' + file);
  } else {
    log('[WARN] No changes saved for: ' + file);
  }
}

log('');
log('==================================================');
log('V5.3 NODE REPAIR SCRIPT FINISHED');
log('==================================================');
