const fs = require('fs');

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log(`PATCHED: ${file}`);
}

function replaceOrSkip(content, find, replace, label, alreadyNeedle = '') {
  if (alreadyNeedle && content.includes(alreadyNeedle)) {
    console.log(`SKIP already patched: ${label}`);
    return content;
  }

  if (!content.includes(find)) {
    console.log(`BLOCK NOT FOUND: ${label}`);
    throw new Error(`Could not find block for: ${label}`);
  }

  console.log(`APPLY: ${label}`);
  return content.replace(find, replace);
}

const academyFile = 'public/js/academy.js';
const dashboardFile = 'public/js/dashboard.js';

let academy = read(academyFile);
let dashboard = read(dashboardFile);

console.log('--- Patching interval budget guard ---');

const oldIntervalGuard = `function shouldThrottle(source) {
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
`;

const newIntervalGuard = `function getAcademyIntervalMinimumDelay(source) {
        const text = String(source || '');

        const heavyBotOrDomSweep = [
            'lockBotToVisibleBottom',
            'clampBotInsideSidebar',
            'normalizeSingleBot',
            'placeBotInAllowedPlayArea',
            'positionAcademyBotBelowActiveMember',
            'academyMoveBotRandomly',
            'getRightSidebar',
            'getActiveNowMemberBottom',
            'normalizePinnedBadges'
        ].some((needle) => text.indexOf(needle) >= 0);

        if (heavyBotOrDomSweep) return 4500;

        const repeatedUiSync = [
            'applyManualMessagesTab',
            'bootAcademyVoiceLoungeFinalFixes',
            'bootGroupsInboxFix',
            'bootMessagesUiPolish',
            'applyAcademyRealInboxAvatars',
            'academyEnhanceMessagesInbox',
            'syncInboxMenuOpenStates',
            'runAcademyPasswordManagerGuard'
        ].some((needle) => text.indexOf(needle) >= 0);

        return repeatedUiSync ? 3000 : 0;
    }
`;

const oldDelayBlock = `        if (shouldThrottle(source) && safeDelay < 1800) {
            safeDelay = 1800;
        }
`;

const newDelayBlock = `        const minimumDelay = getAcademyIntervalMinimumDelay(source);
        if (minimumDelay && safeDelay < minimumDelay) {
            safeDelay = minimumDelay;
        }
`;

academy = replaceOrSkip(
  academy,
  oldIntervalGuard,
  newIntervalGuard,
  'academy interval guard',
  'function getAcademyIntervalMinimumDelay(source)'
);

academy = replaceOrSkip(
  academy,
  oldDelayBlock,
  newDelayBlock,
  'academy interval delay block',
  'const minimumDelay = getAcademyIntervalMinimumDelay(source);'
);

dashboard = replaceOrSkip(
  dashboard,
  oldIntervalGuard,
  newIntervalGuard,
  'dashboard interval guard',
  'function getAcademyIntervalMinimumDelay(source)'
);

dashboard = replaceOrSkip(
  dashboard,
  oldDelayBlock,
  newDelayBlock,
  'dashboard interval delay block',
  'const minimumDelay = getAcademyIntervalMinimumDelay(source);'
);

console.log('');
console.log('--- Patching messages hydrate cache/timeout state ---');

const oldInboxState = `const academyMessagesInboxState = {
    activeRoomId: '',
    loading: false,
    hydratedOnce: false,
    openMenuRoomId: '',
    openThreadMenu: false,
    homeThreadHtml: '',
    actionLoadingRoomId: '',
    actionLoadingType: ''
};
`;

const newInboxState = `const academyMessagesInboxState = {
    activeRoomId: '',
    loading: false,
    hydratedOnce: false,
    lastHydratedAt: 0,
    hydratePromise: null,
    openMenuRoomId: '',
    openThreadMenu: false,
    homeThreadHtml: '',
    actionLoadingRoomId: '',
    actionLoadingType: ''
};

const ACADEMY_MESSAGES_HYDRATE_CACHE_MS = 12000;
const ACADEMY_ASYNC_STEP_TIMEOUT_MS = 9000;

function academyResolveAfterTimeout(promise, timeoutMs = ACADEMY_ASYNC_STEP_TIMEOUT_MS, fallbackValue = null) {
    let timer = null;

    return Promise.race([
        Promise.resolve(promise),
        new Promise((resolve) => {
            timer = window.setTimeout(() => resolve(fallbackValue), Number(timeoutMs) || ACADEMY_ASYNC_STEP_TIMEOUT_MS);
        })
    ]).finally(() => {
        if (timer) window.clearTimeout(timer);
    });
}
`;

academy = replaceOrSkip(
  academy,
  oldInboxState,
  newInboxState,
  'academy messages inbox state + timeout helper',
  'const ACADEMY_MESSAGES_HYDRATE_CACHE_MS = 12000;'
);

console.log('');
console.log('--- Patching academyHydrateMessageRooms ---');

if (
  academy.includes('const cachedRooms = academyReadMessageRooms();') &&
  academy.includes('ACADEMY_MESSAGES_HYDRATE_CACHE_MS')
) {
  console.log('SKIP already patched or cache helper found: academyHydrateMessageRooms');
} else {
  const hydrateStart = academy.indexOf('async function academyHydrateMessageRooms(forceFresh = false) {');
  const hydrateEnd = academy.indexOf('\nfunction academyCloseInboxRoomMenu', hydrateStart);

  if (hydrateStart === -1 || hydrateEnd === -1) {
    throw new Error('Could not locate academyHydrateMessageRooms function.');
  }

  const newHydrateFunction = `async function academyHydrateMessageRooms(forceFresh = false) {
    const now = Date.now();
    const cachedRooms = academyReadMessageRooms();
    const cacheAge = now - Number(academyMessagesInboxState.lastHydratedAt || 0);

    if (
        !forceFresh &&
        academyMessagesInboxState.hydratedOnce &&
        cacheAge >= 0 &&
        cacheAge < ACADEMY_MESSAGES_HYDRATE_CACHE_MS
    ) {
        academyRenderMessagesSidebarBadge();
        renderAcademyMessagesInboxList();
        return cachedRooms;
    }

    if (academyMessagesInboxState.loading && academyMessagesInboxState.hydratePromise) {
        return academyMessagesInboxState.hydratePromise;
    }

    academyMessagesInboxState.loading = true;

    academyMessagesInboxState.hydratePromise = (async () => {
        try {
            if (forceFresh) {
                const { list } = academyGetMessagesInboxElements();
                if (list && !cachedRooms.length) {
                    list.innerHTML = '<div class="academy-messages-inbox-empty">Loading conversations.</div>';
                }
            }

            const result = await academyResolveAfterTimeout(
                academyAuthedFetch('/api/realtime/rooms', { method: 'GET' }),
                ACADEMY_ASYNC_STEP_TIMEOUT_MS,
                { success: false, rooms: cachedRooms, timedOut: true }
            );

            const roomsRaw = Array.isArray(result?.rooms) ? result.rooms : cachedRooms;
            const normalizedRooms = roomsRaw
                .map((room) => academyNormalizeRealtimeRoomEntry(room))
                .filter((room) => !!normalizeRoomKey(room?.roomId || room?.id));

            syncCustomRoomsUI(normalizedRooms);
            academyMessagesInboxState.hydratedOnce = true;
            academyMessagesInboxState.lastHydratedAt = Date.now();
            academyRenderMessagesSidebarBadge();

            renderAcademyMessagesInboxList();
            return normalizedRooms;
        } catch (error) {
            console.error('academyHydrateMessageRooms error:', error);
            renderAcademyMessagesInboxList();
            academyRenderMessagesSidebarBadge();
            return cachedRooms;
        }
    })();

    try {
        return await academyMessagesInboxState.hydratePromise;
    } finally {
        academyMessagesInboxState.loading = false;
        academyMessagesInboxState.hydratePromise = null;
    }
}
`;

  academy = academy.slice(0, hydrateStart) + newHydrateFunction + academy.slice(hydrateEnd);
  console.log('APPLY: academyHydrateMessageRooms');
}

console.log('');
console.log('--- Patching Lead Missions stuck-loader protection ---');

const oldLeadGate = `    if (!skipRecruitmentGate) {
        showAcademyTabLoader('Checking Leads access.');

        const hasRecruitmentProfile = await ensureAcademyLeadRecruitmentProfileLoaded();

        hideAcademyTabLoader();

        if (!hasRecruitmentProfile) {
            revealAcademyMissionsViewShell();
            setAcademyMissionsPanel('hub');
            openAcademyLeadRecruitmentModal();
            showToast('Complete your Leads Recruitment Profile first.', 'error');
            return;
        }
    }
`;

const newLeadGate = `    if (!skipRecruitmentGate) {
        showAcademyTabLoader('Checking Leads access.');

        let hasRecruitmentProfile = false;
        try {
            hasRecruitmentProfile = await academyResolveAfterTimeout(
                ensureAcademyLeadRecruitmentProfileLoaded(),
                ACADEMY_ASYNC_STEP_TIMEOUT_MS,
                false
            );
        } catch (error) {
            console.error('ensureAcademyLeadRecruitmentProfileLoaded error:', error);
            hasRecruitmentProfile = false;
        } finally {
            hideAcademyTabLoader();
        }

        if (!hasRecruitmentProfile) {
            revealAcademyMissionsViewShell();
            setAcademyMissionsPanel('hub');
            openAcademyLeadRecruitmentModal();
            showToast('Complete your Leads Recruitment Profile first.', 'error');
            return;
        }
    }
`;

academy = replaceOrSkip(
  academy,
  oldLeadGate,
  newLeadGate,
  'lead missions recruitment gate timeout',
  'ensureAcademyLeadRecruitmentProfileLoaded(),\n                ACADEMY_ASYNC_STEP_TIMEOUT_MS'
);

console.log('');
console.log('--- Patching Lead Missions workspace timeout protection ---');

const oldWorkspaceFetch = `async function loadAcademyLeadMissionsWorkspace(initialSubtab = 'database') {
    const [result, withdrawalResult, opportunityResult] = await Promise.all([
        academyAuthedFetch('/api/academy/lead-missions/workspace', { method: 'GET' }),
        academyAuthedFetch('/api/payouts/my-ledger', { method: 'GET' }).catch(() => ({ success: false, payouts: [] })),
        academyAuthedFetch('/api/academy/opportunity-missions', { method: 'GET' }).catch(() => ({
            success: false,
            opportunityMissions: [],
            summary: { total: 0, plaza: 0, federation: 0 }
        }))
    ]);
`;

const newWorkspaceFetch = `async function loadAcademyLeadMissionsWorkspace(initialSubtab = 'database') {
    const [result, withdrawalResult, opportunityResult] = await Promise.all([
        academyResolveAfterTimeout(
            academyAuthedFetch('/api/academy/lead-missions/workspace', { method: 'GET' }),
            ACADEMY_ASYNC_STEP_TIMEOUT_MS,
            { success: false, message: 'Leads workspace request timed out.' }
        ),
        academyResolveAfterTimeout(
            academyAuthedFetch('/api/payouts/my-ledger', { method: 'GET' }).catch(() => ({ success: false, payouts: [] })),
            ACADEMY_ASYNC_STEP_TIMEOUT_MS,
            { success: false, payouts: [] }
        ),
        academyResolveAfterTimeout(
            academyAuthedFetch('/api/academy/opportunity-missions', { method: 'GET' }).catch(() => ({
                success: false,
                opportunityMissions: [],
                summary: { total: 0, plaza: 0, federation: 0 }
            })),
            ACADEMY_ASYNC_STEP_TIMEOUT_MS,
            {
                success: false,
                opportunityMissions: [],
                summary: { total: 0, plaza: 0, federation: 0 }
            }
        )
    ]);
`;

academy = replaceOrSkip(
  academy,
  oldWorkspaceFetch,
  newWorkspaceFetch,
  'lead missions workspace request timeout',
  'Leads workspace request timed out.'
);

write(academyFile, academy);
write(dashboardFile, dashboard);

console.log('');
console.log('Patch write completed.');
