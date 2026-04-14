// public/js/dashboard.js

// ==========================================
// 1. GLOBAL AUTH, SOCKET & UTILITIES
// ==========================================
const {
    getStoredAuthToken,
    getStoredUserValue,
    yhT,
    yhTText,
    academyFeedEscapeHtml,
    normalizeAcademyFeedId,
    logoutUser,
    openYHConfirmModal,
    showToast,
    updateUserProfile,
    persistKnownUser: sharedPersistKnownUser,
    readKnownUsersCache: sharedReadKnownUsersCache,
    extractAvatarUrlFromToken: sharedExtractAvatarUrlFromToken,
    normalizeAvatarUrl: sharedNormalizeAvatarUrl,
    resolveAcademyFeedAvatarUrl: sharedResolveAcademyFeedAvatarUrl,
    renderAcademyFeedAvatarHtml: sharedRenderAcademyFeedAvatarHtml
} = window.YHSharedCore;

const socket = io({
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: getStoredAuthToken() ? { token: getStoredAuthToken() } : {}
});

const myName = getStoredUserValue('yh_user_name', "Hustler");

const {
    showAcademyTabLoader,
    hideAcademyTabLoader,
    readDashboardViewState,
    writeDashboardViewState,
    saveUniverseViewState,
    saveAcademyViewState,
    academyAuthedFetch,
    normalizeRoomKey,
    getDashboardState,
    getIncomingRoomId,
    moveCustomRoomToTop,
    syncCustomRoomsUI: sharedSyncCustomRoomsUI,
    markCustomRoomAsRead: sharedMarkCustomRoomAsRead,
    touchCustomRoomFromMessage: sharedTouchCustomRoomFromMessage,
    getActiveRoomId: sharedGetActiveRoomId,
    getActiveRoomLabel: sharedGetActiveRoomLabel,
    isMessageForActiveRoom: sharedIsMessageForActiveRoom,
    setActiveCustomRoomState: sharedSetActiveCustomRoomState
} = window.YHSharedRuntime;

function isStandaloneAcademyPage() {
    return (
        document.body?.getAttribute('data-yh-page') === 'academy' ||
        String(window.location.pathname || '').replace(/\/+$/, '') === '/academy'
    );
}

function goToDashboardPage() {
    window.location.href = '/dashboard';
}

function getAcademySectionFromUrl() {
    try {
        const url = new URL(window.location.href);
        const section = String(url.searchParams.get('section') || '').trim().toLowerCase();

    if (['home', 'community', 'messages', 'voice', 'video', 'profile'].includes(section)) {
            return section;
        }

        return 'home';
    } catch (_) {
        return 'home';
    }
}

let currentRoom = "YH-community";      // UI/display label
let currentRoomId = "YH-community";    // backend transport identity
let currentRoomMeta = {
    type: 'main-chat',
    name: 'YH-community',
    roomId: 'YH-community'
};

function getActiveRoomId() {
    return sharedGetActiveRoomId({
        currentRoomMeta,
        currentRoomId,
        currentRoom
    });
}

function getActiveRoomLabel() {
    return sharedGetActiveRoomLabel({
        currentRoomMeta,
        currentRoomId,
        currentRoom
    });
}

function isMessageForActiveRoom(msg) {
    return sharedIsMessageForActiveRoom(msg, {
        currentRoomMeta,
        currentRoomId,
        currentRoom,
        getIncomingRoomId,
        getActiveRoomId: () => sharedGetActiveRoomId({
            currentRoomMeta,
            currentRoomId,
            currentRoom
        })
    });
}

function syncCustomRoomsUI(rooms = []) {
    const result = sharedSyncCustomRoomsUI(rooms, {
        normalizeCustomRoomForRender: typeof normalizeCustomRoomForRender === 'function' ? normalizeCustomRoomForRender : null,
        renderCustomRooms: typeof renderCustomRooms === 'function' ? renderCustomRooms : null,
        renderChatboxRooms: typeof renderChatboxRooms === 'function' ? renderChatboxRooms : null,
        syncCustomRoomNotifications: typeof syncCustomRoomNotifications === 'function' ? syncCustomRoomNotifications : null,
        updateCustomRoomUnreadBadges: typeof updateCustomRoomUnreadBadges === 'function' ? updateCustomRoomUnreadBadges : null
    });

    if (typeof renderAcademyMessagesInboxList === 'function') {
        renderAcademyMessagesInboxList();
    }

    return result;
}

function setActiveCustomRoomState(room = null) {
    return sharedSetActiveCustomRoomState(room, {
        getDashboardState,
        normalizeRoomKey
    });
}

function markCustomRoomAsRead(roomId) {
    const result = sharedMarkCustomRoomAsRead(roomId, {
        normalizeCustomRoomForRender: typeof normalizeCustomRoomForRender === 'function' ? normalizeCustomRoomForRender : null,
        renderCustomRooms: typeof renderCustomRooms === 'function' ? renderCustomRooms : null,
        renderChatboxRooms: typeof renderChatboxRooms === 'function' ? renderChatboxRooms : null,
        syncCustomRoomNotifications: typeof syncCustomRoomNotifications === 'function' ? syncCustomRoomNotifications : null,
        updateCustomRoomUnreadBadges: typeof updateCustomRoomUnreadBadges === 'function' ? updateCustomRoomUnreadBadges : null
    });

    if (typeof renderAcademyMessagesInboxList === 'function') {
        renderAcademyMessagesInboxList();
    }

    return result;
}

function touchCustomRoomFromMessage(msg, options = {}) {
    const result = sharedTouchCustomRoomFromMessage(msg, options, {
        currentRoomMeta,
        getIncomingRoomId,
        moveCustomRoomToTop,
        normalizeCustomRoomForRender: typeof normalizeCustomRoomForRender === 'function' ? normalizeCustomRoomForRender : null,
        renderCustomRooms: typeof renderCustomRooms === 'function' ? renderCustomRooms : null,
        renderChatboxRooms: typeof renderChatboxRooms === 'function' ? renderChatboxRooms : null,
        syncCustomRoomNotifications: typeof syncCustomRoomNotifications === 'function' ? syncCustomRoomNotifications : null,
        updateCustomRoomUnreadBadges: typeof updateCustomRoomUnreadBadges === 'function' ? updateCustomRoomUnreadBadges : null
    });

    if (typeof renderAcademyMessagesInboxList === 'function') {
        renderAcademyMessagesInboxList();
    }

    return result;
}

// shared generic helpers now come from /js/yh-shared-core.js

/* shared tab-loader helpers now come from /js/yh-shared-runtime.js */

function persistKnownUser(user = {}) {
    return sharedPersistKnownUser(user);
}

window.persistKnownUser = persistKnownUser;

function readKnownUsersCache() {
    return sharedReadKnownUsersCache();
}

function extractAvatarUrlFromToken(token = '') {
    return sharedExtractAvatarUrlFromToken(token);
}

function normalizeAvatarUrl(value = '') {
    return sharedNormalizeAvatarUrl(value);
}

function normalizeUserKey(value = '') {
    const normalizedId = normalizeAcademyFeedId(value);
    if (normalizedId) return normalizedId;

    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '');
}

function safeParseArray(value, fallback = []) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (value === null || value === undefined || value === '') {
        return Array.isArray(fallback) ? fallback.slice() : [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : (Array.isArray(fallback) ? fallback.slice() : []);
    } catch (_) {
        return Array.isArray(fallback) ? fallback.slice() : [];
    }
}

function resolveAcademyFeedAvatarUrl(post = {}, displayName = '') {
    return sharedResolveAcademyFeedAvatarUrl(post, displayName, {
        getStoredUserValue,
        currentUserName: myName
    });
}

function renderAcademyFeedAvatarHtml(post = {}, displayName = '') {
    return sharedRenderAcademyFeedAvatarHtml(post, displayName, {
        resolveAcademyFeedAvatarUrl,
        normalizeAcademyFeedId,
        academyFeedEscapeHtml,
        getStoredUserValue,
        currentUserName: myName
    });
}

function sendSystemNotification(title, text, avatarStr, color, target) {
    const notifList = document.getElementById('notif-list-container');
    const bellBadge = document.getElementById('notif-badge-count');
    if (!notifList) return;

    document.getElementById('notif-empty-state')?.remove();

    const li = document.createElement('li');
    li.className = 'unread fade-in';
    if (target) li.setAttribute('data-target', target);

    li.innerHTML = `<div class="notif-img" style="background: ${color};">${avatarStr}</div><div class="notif-text"><strong>${title}</strong> ${text}<span class="notif-time">Just now</span></div>`;

    li.addEventListener('click', () => {
        li.classList.remove('unread');

        const remainingUnread = document.querySelectorAll('#notif-dropdown .notif-list li.unread').length;
        if (bellBadge) {
            if (remainingUnread === 0) {
                bellBadge.style.display = 'none';
                bellBadge.innerText = '0';
            } else {
                bellBadge.style.display = 'flex';
                bellBadge.innerText = String(remainingUnread);
            }
        }

        document.getElementById('notif-dropdown')?.classList.remove('show');

        if (target === 'announcements') document.getElementById('nav-announcements')?.click();
        else if (target === 'main-chat') document.getElementById('nav-chat')?.click();
        else if (target === 'dm') document.getElementById('btn-open-dm-modal')?.click();
        else if (target === 'profile') document.querySelector('.profile-mini')?.click();
    });

    notifList.prepend(li);

    if (bellBadge) {
        const unreadTotal = document.querySelectorAll('#notif-dropdown .notif-list li.unread').length;
        if (unreadTotal > 0) {
            bellBadge.style.display = 'flex';
            bellBadge.innerText = String(unreadTotal);
            if (bellBadge.parentElement) {
                bellBadge.parentElement.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    if (bellBadge.parentElement) bellBadge.parentElement.style.transform = 'scale(1)';
                }, 200);
            }
        } else {
            bellBadge.style.display = 'none';
            bellBadge.innerText = '0';
        }
    }
}

// ==========================================
// MAIN DASHBOARD LOGIC (ON LOAD)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    let currentVaultFolder = null; 
    let selectedVaultIndex = null;
    let pendingTaskToComplete = null;
    let currentProfileUser = null;
    let currentProfileIcon = null;
    let currentProfileBg = null;
    let pendingGroupMembers = [];
    let hasLoadedVaultOnce = false;
    const defaultAcademyWelcomeHtml = document.getElementById('chat-welcome-box')?.innerHTML || '';

    // --- UPDATED NAVIGATION & ROUTING LOGIC ---
const universeFeatureContent = {
    academy: {
        kicker: 'Academy Features',
        title: 'Roadmap execution layer',
        desc: 'Build a daily plan, track your progress, and use the community plus live rooms to stay in motion.',
        chips: ['Daily roadmap', 'Community feed',]
    },
    plazas: {
        kicker: 'Plaza Features',
        title: 'Marketplace and service layer',
        desc: 'Position your skills, discover opportunities, and turn your network into an active business engine.',
        chips: ['Offer services', 'Hire talent', 'Monetize network']
    },
    federation: {
        kicker: 'Federation Features',
        title: 'Strategic network layer',
        desc: 'Map valuable contacts, identify influence gaps, and build stronger access across regions and industries.',
        chips: ['Elite contacts', 'Gap analysis', 'Global expansion']
    }
};

let activeUniverseDivision = 'academy';
const academySearchResultsPanel = document.getElementById('academy-search-results-panel');
if (academySearchResultsPanel && !academySearchResultsPanel.dataset.overlayBound) {
    academySearchResultsPanel.dataset.overlayBound = 'true';

    academySearchResultsPanel.addEventListener('click', (event) => {
        if (event.target === academySearchResultsPanel) {
            closeAcademySearchResultsPanel();
        }
    });
}
function normalizeUniverseDivision(value = 'academy') {
    const allowedDivisions = ['academy', 'plazas', 'federation'];
    const normalized = String(value || '').trim().toLowerCase();
    return allowedDivisions.includes(normalized) ? normalized : 'academy';
}

function syncUniverseFeaturePanel(targetDivision = 'academy') {
    const division = normalizeUniverseDivision(targetDivision);
    const copy = universeFeatureContent[division] || universeFeatureContent.academy;

    const kicker = document.getElementById('yh-universe-feature-kicker');
    const title = document.getElementById('yh-universe-feature-title');
    const desc = document.getElementById('yh-universe-feature-desc');
    const chips = document.getElementById('yh-universe-feature-chips');

    if (kicker) kicker.textContent = copy.kicker;
    if (title) title.textContent = copy.title;
    if (desc) desc.textContent = copy.desc;
    if (chips) {
        chips.innerHTML = copy.chips.map((chip) => `<span class="yh-universe-feature-chip">${chip}</span>`).join('');
    }
}

function setUniverseSlide(targetDivision = 'academy', options = {}) {
    const division = normalizeUniverseDivision(targetDivision);
    const track = document.getElementById('yh-universe-track');
    const slides = Array.from(document.querySelectorAll('.yh-universe-slide'));
    const dots = Array.from(document.querySelectorAll('.yh-universe-dot'));
    const animate = options.animate !== false;

    activeUniverseDivision = division;

    if (!track || !slides.length) {
        syncUniverseFeaturePanel(division);
        return division;
    }

    const slideIndex = Math.max(
        0,
        slides.findIndex((slide) => slide.getAttribute('data-division') === division)
    );

    if (!animate) {
        track.classList.add('no-transition');
    }

    track.style.transform = `translateX(-${slideIndex * 100}%)`;

    slides.forEach((slide, index) => {
        const isActive = index === slideIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    dots.forEach((dot) => {
        dot.classList.toggle('active', dot.getAttribute('data-division') === division);
    });

    if (!animate) {
        requestAnimationFrame(() => {
            track.classList.remove('no-transition');
        });
    }

    syncUniverseFeaturePanel(division);
    return division;
}

function openDivisionPreview(targetDivision = 'plazas') {
    const division = normalizeUniverseDivision(targetDivision);

    const academyWrapper = document.getElementById('academy-wrapper');
    const viewPlazas = document.getElementById('view-plazas');
    const viewFederation = document.getElementById('view-federation');
    const universeHubView = document.getElementById('universe-hub-view');

    if (academyWrapper) academyWrapper.style.display = 'none';
    if (universeHubView) universeHubView.style.display = 'none';
    if (viewPlazas) viewPlazas.classList.add('hidden-step');
    if (viewFederation) viewFederation.classList.add('hidden-step');

    if (division === 'plazas') {
        if (viewPlazas) {
            viewPlazas.classList.remove('hidden-step');
            viewPlazas.classList.remove('fade-in');
            void viewPlazas.offsetWidth;
            viewPlazas.classList.add('fade-in');
        }
        setDashboardViewMode('plazas');
        return;
    }

    if (division === 'federation') {
        if (viewFederation) {
            viewFederation.classList.remove('hidden-step');
            viewFederation.classList.remove('fade-in');
            void viewFederation.offsetWidth;
            viewFederation.classList.add('fade-in');
        }
        setDashboardViewMode('federation');
        return;
    }

    showUniverseHub('academy');
}

function switchServer(targetDivision) {
    const division = normalizeUniverseDivision(targetDivision);

    if (division === 'academy') {
        showUniverseHub('academy');
        return;
    }

    openDivisionPreview(division);
}

function stepUniverseSlide(direction = 1) {
    const divisions = ['academy', 'plazas', 'federation'];
    const currentIndex = divisions.indexOf(activeUniverseDivision);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + (direction < 0 ? -1 : 1) + divisions.length) % divisions.length;
    return setUniverseSlide(divisions[nextIndex]);
}

function bindUniverseSwipe() {
    const viewport = document.getElementById('yh-universe-carousel');
    if (!viewport || viewport.dataset.swipeBound === 'true') return;

    viewport.dataset.swipeBound = 'true';

    let startX = 0;
    let startY = 0;
    let isPointerDown = false;

    const isInteractiveTarget = (target) => {
        const element = target?.nodeType === 1 ? target : target?.parentElement;
        if (!element || typeof element.closest !== 'function') return false;

        return !!element.closest(
            '#btn-open-academy-apply, #yh-universe-prev, #yh-universe-next, button, a, input, textarea, select, label, [role="button"]'
        );
    };

    const onStart = (event) => {
        const point = event.touches ? event.touches[0] : event;
        startX = point.clientX;
        startY = point.clientY;
        isPointerDown = true;
    };

    const onEnd = (event) => {
        if (!isPointerDown) return;
        isPointerDown = false;

        if (isInteractiveTarget(event.target)) return;

        const point = event.changedTouches ? event.changedTouches[0] : event;
        const deltaX = point.clientX - startX;
        const deltaY = point.clientY - startY;

        if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

        if (deltaX < 0) {
            stepUniverseSlide(1);
            return;
        }

        if (deltaX > 0) {
            stepUniverseSlide(-1);
        }
    };

    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchend', onEnd, { passive: true });
    viewport.addEventListener('mousedown', onStart);
    viewport.addEventListener('mouseup', onEnd);
    viewport.addEventListener('mouseleave', () => {
        isPointerDown = false;
    });
}

const serverAcademy = document.getElementById('server-academy');
const serverPlazas = document.getElementById('server-plazas');
const serverFederation = document.getElementById('server-federation');

if (serverAcademy) serverAcademy.addEventListener('click', () => switchServer('academy'));
if (serverPlazas) serverPlazas.addEventListener('click', () => switchServer('plazas'));
if (serverFederation) serverFederation.addEventListener('click', () => switchServer('federation'));

document.querySelectorAll('.yh-universe-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
        setUniverseSlide(dot.getAttribute('data-division') || 'academy');
    });
});
document.getElementById('yh-universe-prev')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    stepUniverseSlide(-1);
});

document.getElementById('yh-universe-next')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    stepUniverseSlide(1);
});
document.querySelectorAll('.yh-universe-slide .portal-card').forEach((card) => {
    card.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, textarea, select, label, [role="button"]')) return;

        const slide = card.closest('.yh-universe-slide');
        if (!slide || !slide.classList.contains('is-active')) return;

        const division = (slide.getAttribute('data-division') || '').trim().toLowerCase();

        if (division === 'academy') {
            handleAcademyLaunchClick(event);
            return;
        }

        if (division === 'plazas') {
            openDivisionPreview('plazas');
            return;
        }

        if (division === 'federation') {
            openDivisionPreview('federation');
        }
    });
});

document.getElementById('btn-open-plazas-preview')?.addEventListener('click', () => {
    openDivisionPreview('plazas');
});

document.getElementById('btn-open-federation-preview')?.addEventListener('click', () => {
    openDivisionPreview('federation');
});

bindUniverseSwipe();

setTimeout(() => {
    refreshAcademyMembershipStatus(true).catch(() => {});
    startAcademyMembershipRealtimeSync();
}, 0); 

function applyAcademyMessengerMode(enabled = false) {
    const chatMessagesWrap = document.getElementById('chat-messages');
    const chatInputArea = document.getElementById('chat-input-area');

    if (chatMessagesWrap) {
        chatMessagesWrap.classList.toggle('yh-messenger-thread', !!enabled);
    }

    if (chatInputArea) {
        chatInputArea.classList.toggle('yh-messenger-composer', !!enabled);
    }
}

function openRoom(type, element) {
    document.querySelectorAll('.channel-link').forEach(link => link.classList.remove('active'));
    if (element && !element.classList.contains('room-entry')) {
        element.classList.add('active');
    } else {
        const navVoice = document.getElementById('nav-voice');
        const navVideo = document.getElementById('nav-video');
        if (type === 'voice-lobby' || (element && element.closest('#lounge-grid') && navVoice)) navVoice.classList.add('active');
        else if (type === 'video' || (element && element.closest('#video-grid') && navVideo)) navVideo.classList.add('active');
    }

    const views = {
        'academy-feed-view': document.getElementById('academy-feed-view'),
        'academy-chat': document.getElementById('academy-chat'),
        'academy-profile-view': document.getElementById('academy-profile-view'),
        'center-stage-view': document.getElementById('center-stage-view'),
        'announcements-view': document.getElementById('announcements-view'),
        'voice-lobby-view': document.getElementById('voice-lobby-view'),
        'video-lobby-view': document.getElementById('video-lobby-view'),
        'vault-view': document.getElementById('vault-view')
    };

    const shouldTabLoad =
        (type === 'voice-lobby' && views['voice-lobby-view']) ||
        (type === 'video' && views['video-lobby-view']);

    if (shouldTabLoad) {
        showAcademyTabLoader(type === 'voice-lobby' ? 'Loading Voice Lounge...' : 'Loading Video Lounge...');
    }

    Object.values(views).forEach(view => { if (view) view.classList.add('hidden-step'); });

    closeAcademyProfileEditorModal?.();
    closeAcademySearchResultsPanel?.();
    document.getElementById('academy-member-browser-modal')?.classList.add('hidden-step');

    if (type === 'voice-lobby' && views['voice-lobby-view']) {
        views['voice-lobby-view'].classList.remove('hidden-step');
        views['voice-lobby-view'].classList.remove('fade-in');
        void views['voice-lobby-view'].offsetWidth;
        views['voice-lobby-view'].classList.add('fade-in');

        saveAcademyViewState('voice'); // persistence (PATCH 5C)

        Promise.resolve()
            .then(() => loadAcademyVoiceRooms(true))
            .catch((error) => {
                console.error('loadAcademyVoiceRooms error:', error);
                showToast(error?.message || 'Failed to load live voice rooms.', 'error');
            })
            .finally(() => {
                if (shouldTabLoad) hideAcademyTabLoader();
            });

        return;
    }

if (type === 'video' && views['video-lobby-view']) {
    views['video-lobby-view'].classList.remove('hidden-step');
    views['video-lobby-view'].classList.remove('fade-in');
    void views['video-lobby-view'].offsetWidth;
    views['video-lobby-view'].classList.add('fade-in');

    Promise.resolve()
        .then(() => loadAcademyVideoRooms(true))
        .catch((err) => {
            console.error(err);
            showToast('Failed to load video rooms.', 'error');
        })
        .finally(() => {
            if (shouldTabLoad) hideAcademyTabLoader();
        });

    saveAcademyViewState('video'); // persistence

    return;
}

    if (type === 'announcements' && views['announcements-view']) {
        views['announcements-view'].classList.remove('hidden-step');
        views['announcements-view'].classList.remove('fade-in');
        void views['announcements-view'].offsetWidth;
        views['announcements-view'].classList.add('fade-in');
        return;
    }

    if (type === 'vault' && views['vault-view']) {
        views['vault-view'].classList.remove('hidden-step');
        views['vault-view'].classList.remove('fade-in');
        void views['vault-view'].offsetWidth;
        views['vault-view'].classList.add('fade-in');

        Promise.resolve()
            .then(() => ensureVaultLoaded())
            .catch((error) => {
                console.error('ensureVaultLoaded error:', error);
                showToast(error?.message || 'Failed to load Vault.', 'error');
            });

        return;
    }

    if (views['academy-chat']) views['academy-chat'].classList.remove('hidden-step');

    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderTopic = document.getElementById('chat-header-topic');
    const chatWelcomeBox = document.getElementById('chat-welcome-box');
    const chatPinnedMessage = document.getElementById('chat-pinned-message');
    const chatInputBox = document.getElementById('chat-input');
    const chatInputArea = document.getElementById('chat-input-area');
    const dynamicChatContainer = document.getElementById('dynamic-chat-history');

    applyAcademyMessengerMode(type === 'dm' || type === 'group');

    if (chatInputArea) {
        const shouldShowComposer = type === 'dm' || type === 'group';
        chatInputArea.classList.toggle('hidden-step', !shouldShowComposer);

        if (shouldShowComposer) {
            chatInputArea.style.removeProperty('display');
            chatInputArea.setAttribute('aria-hidden', 'false');
        } else {
            chatInputArea.style.setProperty('display', 'none', 'important');
            chatInputArea.setAttribute('aria-hidden', 'true');
        }
    }

    if (type === 'main-chat') {
    if(chatHeaderIcon) chatHeaderIcon.innerHTML = `💬`;
    if(chatHeaderTitle) chatHeaderTitle.innerText = "YH-community";
    if(chatHeaderTopic) chatHeaderTopic.innerText = yhT('dashboard.chatWelcomeTopic');
    if(chatWelcomeBox) chatWelcomeBox.style.display = "block";
    if(chatPinnedMessage) chatPinnedMessage.style.display = "flex";
    if(chatInputBox) {
        chatInputBox.placeholder = yhT('type a message...', { room: 'YH-community' });
        chatInputBox.setAttribute('data-active-room-id', 'YH-community');
        chatInputBox.setAttribute('data-active-room-name', 'YH-community');
        chatInputBox.setAttribute('data-active-room-type', 'main-chat');
    }
    if (chatInputArea) {
        chatInputArea.classList.add('hidden-step');
        chatInputArea.style.setProperty('display', 'none', 'important');
        chatInputArea.setAttribute('aria-hidden', 'true');
    }
    if(dynamicChatContainer) dynamicChatContainer.innerHTML = '';

    currentRoom = "YH-community";
    currentRoomId = "YH-community";
    currentRoomMeta = {
        type: 'main-chat',
        name: 'YH-community',
        roomId: 'YH-community'
    };

    setActiveCustomRoomState(null);
    socket.emit('joinRoom', currentRoomId);
} 
else if (type === 'dm' || type === 'group') {
    const name = element.getAttribute('data-name') || 'Private Room';
    const icon = element.getAttribute('data-icon') || '💬';
    const color = element.getAttribute('data-color') || 'var(--neon-blue)';
    const roomId =
        element.getAttribute('data-room-id') ||
        element.dataset.roomId ||
        element.getAttribute('data-id') ||
        name;

    const participantNames = Array.from(new Set(
        safeParseArray(
            element.getAttribute('data-room-participants') ||
            element.getAttribute('data-room-member-names') ||
            element.dataset.roomParticipants ||
            '[]',
            type === 'dm' ? [myName, name] : [myName]
        )
    )).filter(Boolean);

    const memberIds = Array.from(new Set(
        safeParseArray(
            element.getAttribute('data-room-member-ids') ||
            element.dataset.roomMemberIds ||
            '[]',
            []
        ).map((value) => normalizeUserKey(value)).filter(Boolean)
    ));

    const recipientName = String(
        element.getAttribute('data-room-recipient') ||
        (type === 'dm' ? name : '')
    ).trim();

    const recipientId = String(
        element.getAttribute('data-room-recipient-id') ||
        (recipientName ? normalizeUserKey(recipientName) : '')
    ).trim();

    let avatarStyle = icon.includes('url')
        ? `background-image: ${icon}; background-size: cover; background-color: transparent;`
        : `background: ${color};`;
    let avatarText = icon.includes('url') ? '' : icon;

    if(chatHeaderIcon) chatHeaderIcon.innerHTML = `<div class="member-avatar" style="${avatarStyle} width: 30px; height: 30px; font-size: 0.9rem;">${avatarText}</div>`;
    if(chatHeaderTitle) chatHeaderTitle.innerText = name;
    if(chatHeaderTopic) {
        chatHeaderTopic.innerText = type === 'group'
            ? 'Group thread'
            : `Private messages with ${name}`;
    }
    if(chatWelcomeBox) chatWelcomeBox.style.display = "none";
    if(chatPinnedMessage) chatPinnedMessage.style.display = "none";
    if(chatInputBox) {
        chatInputBox.placeholder = yhT('type a message...', { room: name });
        chatInputBox.setAttribute('data-active-room-id', roomId);
        chatInputBox.setAttribute('data-active-room-name', name);
        chatInputBox.setAttribute('data-active-room-type', type);
    }
    if (chatInputArea) {
        chatInputArea.classList.remove('hidden-step');
        chatInputArea.style.removeProperty('display');
        chatInputArea.setAttribute('aria-hidden', 'false');
    }

    currentRoom = name;
    currentRoomId = roomId;
    currentRoomMeta = {
        type,
        name,
        roomId,
        icon,
        color,
        privacy: 'private',
        recipientName,
        recipientId,
        participants: participantNames,
        memberNames: participantNames,
        memberIds
    };

    setActiveCustomRoomState({
        id: roomId,
        name,
        type,
        icon,
        color,
        privacy: 'private',
        topic: type === 'group' ? 'Private Brainstorming Group' : 'Direct Message'
    });

    academySetMessagesChatMode('thread');
    academyRenderMessagesThreadHeader(
        academyResolveMessageRoomById(roomId) || {
            type,
            name,
            roomId,
            recipientName,
            recipientId,
            participantNames,
            memberIds,
            icon,
            color
        }
    );

    markCustomRoomAsRead(roomId);
    socket.emit('joinRoom', currentRoomId);
}

    if (views['academy-chat']) {
        views['academy-chat'].classList.remove('fade-in');
        void views['academy-chat'].offsetWidth;
        views['academy-chat'].classList.add('fade-in');
    }
}
document.getElementById('nav-chat')?.addEventListener('click', function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    setAcademySidebarActive('nav-chat');
    openAcademyFeedView();
});

document.getElementById('nav-messages')?.addEventListener('click', function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    setAcademySidebarActive('nav-messages');
    openAcademyMessagesView();
});

document.getElementById('nav-voice')?.addEventListener('click', function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    setAcademySidebarActive('nav-voice');
    openRoom('voice-lobby', this);
});

document.getElementById('nav-profile')?.addEventListener('click', function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    openAcademyProfileView();
});

document.getElementById('nav-missions')?.addEventListener('click', async function(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    await handleAcademyRoadmapTabIntent();
});
function safeParseJson(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return fallback;

    const trimmed = value.trim();
    if (!trimmed) return fallback;

    try {
        return JSON.parse(trimmed);
    } catch (_) {
        return fallback;
    }
}
const academyMobileNavToggle = document.getElementById('academy-mobile-nav-toggle');
const academyMobileNavMenu = document.getElementById('academy-mobile-nav-menu');
const academyMobileBottomNav = document.getElementById('academy-mobile-bottom-nav');

function closeAcademyMobileMenu() {
    if (!academyMobileNavMenu || !academyMobileNavToggle) return;
    academyMobileNavMenu.classList.add('hidden-step');
    academyMobileNavToggle.setAttribute('aria-expanded', 'false');
}

function toggleAcademyMobileMenu() {
    if (!academyMobileNavMenu || !academyMobileNavToggle) return;
    const isHidden = academyMobileNavMenu.classList.contains('hidden-step');

    if (isHidden) {
        academyMobileNavMenu.classList.remove('hidden-step');
        academyMobileNavToggle.setAttribute('aria-expanded', 'true');
        return;
    }

    closeAcademyMobileMenu();
}

function initAcademyMobileBottomNavAutoHide() {
    if (!academyMobileBottomNav) return;

    let lastScrollY = window.scrollY || 0;
    let ticking = false;

    const applyState = () => {
        const isPhone = window.innerWidth <= 768;
        const currentY = window.scrollY || 0;
        const isThreadOpen = document.body?.classList.contains('academy-messages-thread-open');

        if (!isPhone || isThreadOpen) {
            academyMobileBottomNav.classList.remove('academy-mobile-bottom-nav-hidden');
            lastScrollY = currentY;
            ticking = false;
            return;
        }

        if (currentY <= 16) {
            academyMobileBottomNav.classList.remove('academy-mobile-bottom-nav-hidden');
            lastScrollY = currentY;
            ticking = false;
            return;
        }

        const delta = currentY - lastScrollY;

        if (delta > 8) {
            academyMobileBottomNav.classList.add('academy-mobile-bottom-nav-hidden');
        } else if (delta < -8) {
            academyMobileBottomNav.classList.remove('academy-mobile-bottom-nav-hidden');
        }

        lastScrollY = currentY;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (window.innerWidth > 768) return;
        if (ticking) return;

        ticking = true;
        window.requestAnimationFrame(applyState);
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            academyMobileBottomNav.classList.remove('academy-mobile-bottom-nav-hidden');
        }
    });
}

academyMobileNavToggle?.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    toggleAcademyMobileMenu();
});

document.querySelectorAll('.academy-mobile-nav-item').forEach((button) => {
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetId = String(button.getAttribute('data-academy-target') || '').trim();

        if (targetId === 'nav-chat') {
            openAcademyFeedView();
        } else if (targetId === 'nav-missions') {
            await handleAcademyRoadmapTabIntent();
        } else if (targetId === 'nav-messages') {
            setAcademySidebarActive('nav-messages');
            openAcademyMessagesView();
        } else if (targetId === 'nav-voice') {
            setAcademySidebarActive('nav-voice');
            openRoom('voice-lobby', document.getElementById('nav-voice'));
        } else if (targetId === 'nav-profile') {
            openAcademyProfileView();
        } else if (targetId === 'back-universe') {
            try { stopAcademyLiveMediaStream?.(); } catch (_) {}
            showUniverseHub('academy');
        }

        requestAnimationFrame(() => {
            closeAcademyMobileMenu();
        });
    });
});
document.addEventListener('click', (event) => {
    if (!academyMobileNavMenu || !academyMobileNavToggle) return;

    const clickedInsideMenu = academyMobileNavMenu.contains(event.target);
    const clickedToggle = academyMobileNavToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
        closeAcademyMobileMenu();
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeAcademyMobileMenu();
        academyMobileBottomNav?.classList.remove('academy-mobile-bottom-nav-hidden');
    }
});
initAcademyMobileBottomNavAutoHide();
document.querySelector('.profile-mini')?.addEventListener('click', () => {
    if (document.body?.getAttribute('data-yh-view') === 'academy') {
        openAcademyProfileView();
    }
});

    // ==========================================
    // ⚡ REAL-TIME CHAT LOGIC (SOCKET.IO)
    // ==========================================
socket.on('chatHistory', (history) => {
    const activeRoomType = String(currentRoomMeta?.type || '').trim();

    if (/^live-/.test(activeRoomType)) {
        renderStageChatHistory(history);
        return;
    }

    const container = document.getElementById('dynamic-chat-history');
    const chatScrollArea = document.getElementById('chat-messages');
    if(!container) return;
    container.innerHTML = '';

    const activeLabel = getActiveRoomLabel();
    const activeRoomId = getActiveRoomId();

    if (activeRoomId && activeRoomId !== "YH-community") {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 2rem; margin-bottom: 2rem; font-size: 0.9rem;">This is the beginning of your private history with <strong>${activeLabel}</strong>.</div>`;
    }

    history.forEach(msg => appendMessageToUI(msg));
    setTimeout(() => { if(chatScrollArea) chatScrollArea.scrollTop = chatScrollArea.scrollHeight; }, 100);
});

    socket.on('receiveMessage', (msg) => {
    const isActiveRoomMessage = isMessageForActiveRoom(msg);
    const incomingRoomId = String(getIncomingRoomId(msg) || '');

    if (incomingRoomId && incomingRoomId !== 'YH-community') {
        touchCustomRoomFromMessage(msg, {
            createIfMissing: true,
            incrementUnread: !isActiveRoomMessage && msg.author !== myName,
            resetUnread: isActiveRoomMessage
        });
    }

    if (isActiveRoomMessage) {
        const activeRoomType = String(currentRoomMeta?.type || '').trim();

        if (/^live-/.test(activeRoomType)) {
            appendStageChatMessage(msg);
        } else {
            appendMessageToUI(msg);
            const chatScrollArea = document.getElementById('chat-messages');
            setTimeout(() => { if(chatScrollArea) chatScrollArea.scrollTop = chatScrollArea.scrollHeight; }, 100);
        }
    } else {
        const participants = Array.isArray(msg?.participants)
            ? msg.participants.map(p => String(p))
            : [];

        const isMyPrivateMessage =
            msg.author !== myName &&
            (
                participants.includes(String(myName)) ||
                incomingRoomId.includes(String(myName))
            );

        if (isMyPrivateMessage) {
            sendSystemNotification(
                "New Private Message",
                `${msg.author} sent you a message.`,
                msg.initial,
                "var(--neon-blue)",
                "dm"
            );
        }
    }
});

    socket.on('messageUpvoted', (msgId) => {
        const upvoteBtn = document.querySelector(`.chat-bubble[data-dbid="${msgId}"] .upvote-count`);
        if (upvoteBtn) upvoteBtn.innerText = parseInt(upvoteBtn.innerText) + 1;
    });

    socket.on('messageDeleted', (msgId) => {
        const bubble = document.querySelector(`.chat-bubble[data-dbid="${msgId}"]`);
        if(bubble) bubble.remove();
    });

    function formatAcademyMessageTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return 'Just now';
        if (/^today at /i.test(raw)) return raw;

        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return raw;

        const now = new Date();
        const isSameDay =
            now.getFullYear() === date.getFullYear() &&
            now.getMonth() === date.getMonth() &&
            now.getDate() === date.getDate();

        if (isSameDay) {
            return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }

        return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    function appendMessageToUI(msg) {
        const container = document.getElementById('dynamic-chat-history');
        if (!container) return;

        const isMe = msg.author === myName;
        const bubbleClass = isMe ? 'chat-bubble mine' : 'chat-bubble';

        const safeAuthor = academyFeedEscapeHtml(msg.author || 'Hustler');
        const safeText = academyFeedEscapeHtml(msg.text || '').replace(/\n/g, '<br>');
        const safeTime = academyFeedEscapeHtml(formatAcademyMessageTime(msg.time));
        const safeAvatarUrl = academyFeedEscapeHtml(msg.avatar || '');

        let avatarStyle = `background: var(--neon-blue);`;
        let avatarContent = academyFeedEscapeHtml(msg.initial || '');
        let bubbleStyle = '';
        let authorColor = '';
        let roleBadge = '';

        if (msg.author === 'Agent') {
            avatarStyle = `background: #8b5cf6;`;
            avatarContent = '🤖';
            bubbleStyle = `style="background: transparent;"`;
            authorColor = `style="color: #c4b5fd;"`;
            roleBadge = `<span class="role-badge bot" style="margin-left:5px;">AI</span>`;
        } else if (safeAvatarUrl) {
            avatarStyle = `background-image: url('${safeAvatarUrl}'); background-size: cover; background-position: center;`;
            avatarContent = '';
        }

        const showCommunityActions = getActiveRoomId() === 'YH-community';

        const msgHTML = `
            <div class="${bubbleClass} fade-in" data-dbid="${academyFeedEscapeHtml(msg.id || '')}" ${bubbleStyle}>
                ${isMe ? `<button class="delete-msg-btn" title="Delete Message">🗑️</button>` : ''}
                <div class="bubble-header">
                    <div class="bubble-avatar interactive-avatar" data-user="${safeAuthor}" data-role="Hustler" style="${avatarStyle} cursor:pointer;">${avatarContent}</div>
                    <span class="bubble-author interactive-avatar" data-user="${safeAuthor}" data-role="Hustler" style="cursor:pointer;"><span ${authorColor}>${safeAuthor}</span> ${roleBadge}</span>
                    <span class="bubble-time">${safeTime}</span>
                </div>
                <div class="bubble-body">${safeText}</div>
                ${showCommunityActions ? `<div class="chat-actions"><button class="upvote-btn" data-id="${academyFeedEscapeHtml(msg.id || '')}" title="Agree with this">🔥 <span class="upvote-count">${msg.upvotes || 0}</span></button></div>` : ''}
            </div>
        `;

        container.insertAdjacentHTML('beforeend', msgHTML);
    }

let academyCoachModeActive = false;
    let academyCoachConversationId = 'coach_main';

    function normalizeAcademyCoachPillarKey(value = '') {
        const raw = String(value || '').trim().toLowerCase();
        const map = {
            money: 'wealth',
            wealth: 'wealth',
            business: 'wealth',
            'money, wealth & business': 'wealth',

            discipline: 'discipline',

            health: 'health',
            fitness: 'health',
            'fitness & health': 'health',

            mindset: 'mindset',
            psychology: 'mindset',
            'mindset & psychology': 'mindset',

            communication: 'communication',
            networking: 'communication',
            'communication & networking': 'communication',

            knowledge: 'knowledge',
            'knowledge for life': 'knowledge',

            politics: 'politics',
            politics_2030_agenda: 'politics',
            'politics & the 2030 agenda': 'politics',

            philosophy: 'philosophy'
        };

        return map[raw] || raw || 'general';
    }

    function getAcademyCoachUiMeta(value = '') {
        const key = normalizeAcademyCoachPillarKey(value);

        const metaMap = {
            politics: {
                key,
                title: 'Political Analyst Coach',
                icon: '🏛️',
                topic: 'Break down political issues through actors, incentives, narratives, timelines, and strategic consequences.',
                placeholder: 'Ask your Political Analyst Coach about your roadmap, issue maps, source comparisons, or weekly political brief.',
                emptyTitle: 'Political Analyst Coach',
                emptyCopy: 'Ask about your political roadmap, issue mapping, actor incentives, source comparison, weekly brief, or how to break down a confusing political pattern clearly.',
                chips: ['Issue-map aware', 'Narrative aware', 'Roadmap grounded'],
                quickPrompts: [
                    'Break down this political issue.',
                    'Map the actors and incentives here.',
                    'Compare the competing narratives on this topic.',
                    'Turn this into a short weekly political brief.'
                ],
                bubbleBackground: 'rgba(244, 63, 94, 0.12)',
                borderColor: '#f43f5e',
                textColor: '#fda4af',
                avatarBackground: 'linear-gradient(135deg, rgba(244,63,94,0.95), rgba(190,24,93,0.95))'
            },
            philosophy: {
                key,
                title: 'Reasoning & Reflection Mentor',
                icon: '🏺',
                topic: 'Sharpen your reasoning through definitions, assumptions, argument maps, reflections, and worldview clarity.',
                placeholder: 'Ask your Reasoning Mentor about your roadmap, argument maps, reflections, concepts, or next philosophical exercise.',
                emptyTitle: 'Reasoning & Reflection Mentor',
                emptyCopy: 'Ask about your philosophy roadmap, concept definitions, argument mapping, reflection prompts, objections, worldview tension, or how to turn abstract ideas into clear thinking.',
                chips: ['Argument aware', 'Reflection aware', 'Roadmap grounded'],
                quickPrompts: [
                    'Map this argument.',
                    'Challenge this assumption.',
                    'Define the key terms clearly.',
                    'Turn this into a short reflection.'
                ],
                bubbleBackground: 'rgba(168, 85, 247, 0.12)',
                borderColor: '#a855f7',
                textColor: '#d8b4fe',
                avatarBackground: 'linear-gradient(135deg, rgba(168,85,247,0.95), rgba(107,33,168,0.95))'
            },
            general: {
                key: 'general',
                title: 'Academy AI Coach',
                icon: '🤖',
                topic: 'Ask about today’s focus, blocked missions, roadmap execution, or low-energy adaptation.',
                placeholder: 'Ask your AI Coach about your roadmap, missions, or check-ins.',
                emptyTitle: 'Academy AI Coach',
                emptyCopy: 'Ask about your roadmap, today’s focus, blocked missions, missed tasks, low-energy execution, or how to simplify your next move.',
                chips: ['Roadmap grounded', 'Mission aware', 'Check-in aware'],
                quickPrompts: [
                    'What should I focus on today?',
                    'Simplify my next mission.',
                    'Help me recover after missed tasks.',
                    'What is the clearest next move?'
                ],
                bubbleBackground: 'rgba(139, 92, 246, 0.15)',
                borderColor: '#8b5cf6',
                textColor: '#c4b5fd',
                avatarBackground: '#8b5cf6'
            }
        };

        return metaMap[key] || metaMap.general;
    }

    let academyCoachUiMeta = getAcademyCoachUiMeta('general');

    function applyAcademyCoachPillarUi(value = '') {
        academyCoachUiMeta = getAcademyCoachUiMeta(value);
        return academyCoachUiMeta;
    }

    function academySetChatInputPlaceholder(text = '') {
        const input = document.getElementById('chat-input');
        if (input) {
            input.placeholder = text || 'Type a message.';
        }
    }

function academyResetCoachMode() {
        academyCoachModeActive = false;
        academyCoachConversationId = 'coach_main';
        academyCoachUiMeta = getAcademyCoachUiMeta('general');
        academySetChatInputPlaceholder('Type a message.');

        const pinned = document.getElementById('chat-pinned-message');
        if (pinned) {
            pinned.innerHTML = '';
            pinned.style.display = 'none';
        }
    }

    function academyCoachTimeLabel(value) {
        if (!value) return 'Just now';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Just now';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

function academyCoachEscapeHtml(value) {
        return academyFeedEscapeHtml(value);
    }

    function academyCoachFormatStructuredTextHtml(text = '', meta = academyCoachUiMeta || getAcademyCoachUiMeta('general')) {
        const raw = String(text || '').replace(/\r\n/g, '\n').trim();
        if (!raw) return '';

        const structuredLabels = [
            'Actors',
            'Incentives',
            'Narrative',
            'Claim',
            'Assumption',
            'Objection',
            'Reflection',
            'Next move',
            'Main direction'
        ];

        const lines = raw
            .split('\n')
            .map((line) => String(line || '').trim())
            .filter(Boolean);

        return lines.map((line) => {
            const matchedLabel = structuredLabels.find((label) => {
                const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i');
                return pattern.test(line);
            });

            if (matchedLabel) {
                const pattern = new RegExp(`^(${matchedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*:\\s*`, 'i');
                const value = line.replace(pattern, '');
                return `
                    <div style="margin-top:8px;">
                        <span style="display:inline-block;font-weight:700;color:${meta.textColor};">${academyCoachEscapeHtml(matchedLabel)}:</span>
                        <span style="color:#e5e7eb;"> ${academyCoachEscapeHtml(value)}</span>
                    </div>
                `;
            }

            return `
                <div style="margin-top:8px;color:#e5e7eb;">
                    ${academyCoachEscapeHtml(line)}
                </div>
            `;
        }).join('');
    }

function academyBuildCoachBubbleHtml(message = {}) {
        const isUser = String(message.role || '').trim().toLowerCase() === 'user';
        const meta = academyCoachUiMeta || getAcademyCoachUiMeta('general');
        const author = isUser ? myName : meta.title;
        const bubbleClass = isUser ? 'chat-bubble mine' : 'chat-bubble';
        const savedUserAvatar = String(message.avatar || localStorage.getItem('yh_user_avatar') || '').trim();

        let avatarStyle = `background: ${meta.avatarBackground};`;
        let avatarContent = meta.icon || '🤖';

        if (isUser) {
            if (savedUserAvatar) {
                avatarStyle = `background-image: url(${savedUserAvatar}); background-size: cover; background-position: center;`;
                avatarContent = '';
            } else {
                avatarStyle = `background: var(--neon-blue);`;
                avatarContent = myName.charAt(0).toUpperCase();
            }
        }

        const authorColor = isUser ? '' : `style="color:${meta.textColor};"`;
        const roleBadge = isUser
            ? ''
            : `<span class="role-badge bot" style="margin-left:5px;">AI</span>`;
        const bubbleStyle = isUser
            ? ''
            : `style="background: ${meta.bubbleBackground}; border-left: 3px solid ${meta.borderColor};"`;

        const bubbleBodyHtml = isUser
            ? academyCoachEscapeHtml(message.text || '').replace(/\n/g, '<br>')
            : academyCoachFormatStructuredTextHtml(message.text || '', meta);

        return `
            <div class="${bubbleClass} fade-in" ${bubbleStyle}>
                <div class="bubble-header">
                    <div class="bubble-avatar" style="${avatarStyle}">${academyCoachEscapeHtml(avatarContent)}</div>
                    <span class="bubble-author"><span ${authorColor}>${academyCoachEscapeHtml(author)}</span> ${roleBadge}</span>
                    <span class="bubble-time">${academyCoachEscapeHtml(academyCoachTimeLabel(message.createdAt))}</span>
                </div>
                <div class="bubble-body" style="white-space:normal;line-height:1.7;">${bubbleBodyHtml}</div>
            </div>
        `;
    }

function academyBuildCoachQuickPromptsHtml(meta = academyCoachUiMeta || getAcademyCoachUiMeta('general')) {
        const prompts = Array.isArray(meta?.quickPrompts) ? meta.quickPrompts.filter(Boolean) : [];
        if (!prompts.length) return '';

        return prompts.map((prompt) => `
            <button
                type="button"
                class="yh-universe-feature-chip"
                data-prompt="${academyCoachEscapeHtml(prompt)}"
                onclick="academySendCoachMessage(this.dataset.prompt)"
                style="
                    cursor:pointer;
                    border:1px solid rgba(255,255,255,0.12);
                    background:rgba(255,255,255,0.045);
                    color:var(--text-main);
                    transition:transform 0.18s ease, opacity 0.18s ease;
                "
            >
                ${academyCoachEscapeHtml(prompt)}
            </button>
        `).join('');
    }

    function academyRenderCoachPinnedPrompts(target, meta = academyCoachUiMeta || getAcademyCoachUiMeta('general')) {
        if (!target) return;

        const promptsHtml = academyBuildCoachQuickPromptsHtml(meta);
        if (!promptsHtml) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        target.style.display = 'block';
        target.innerHTML = `
            <div class="academy-home-panel" style="margin-bottom:0;">
                <div class="academy-home-panel-label">Suggested Prompts</div>
                <div class="academy-home-chip-row">
                    ${promptsHtml}
                </div>
            </div>
        `;
    }

function academyBuildCoachQuickPromptsHtml(meta = academyCoachUiMeta || getAcademyCoachUiMeta('general')) {
        const prompts = Array.isArray(meta?.quickPrompts) ? meta.quickPrompts.filter(Boolean) : [];
        if (!prompts.length) return '';

        return prompts.map((prompt) => `
            <button
                type="button"
                class="yh-universe-feature-chip"
                data-prompt="${academyCoachEscapeHtml(prompt)}"
                onclick="academySendCoachMessage(this.dataset.prompt)"
                style="
                    cursor:pointer;
                    border:1px solid rgba(255,255,255,0.12);
                    background:rgba(255,255,255,0.045);
                    color:var(--text-main);
                    transition:transform 0.18s ease, opacity 0.18s ease;
                "
            >
                ${academyCoachEscapeHtml(prompt)}
            </button>
        `).join('');
    }

    function academyRenderCoachPinnedPrompts(target, meta = academyCoachUiMeta || getAcademyCoachUiMeta('general')) {
        if (!target) return;

        const promptsHtml = academyBuildCoachQuickPromptsHtml(meta);
        if (!promptsHtml) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        target.style.display = 'block';
        target.innerHTML = `
            <div class="academy-home-panel" style="margin-bottom:0;">
                <div class="academy-home-panel-label">Suggested Prompts</div>
                <div class="academy-home-chip-row">
                    ${promptsHtml}
                </div>
            </div>
        `;
    }

function academyRenderCoachConversation(messages = []) {
        const container = document.getElementById('dynamic-chat-history');
        if (!container) return;

        const meta = academyCoachUiMeta || getAcademyCoachUiMeta('general');
        const quickPromptsHtml = academyBuildCoachQuickPromptsHtml(meta);

        if (!Array.isArray(messages) || !messages.length) {
            container.innerHTML = `
                <div class="academy-home-stack">
                    <section class="academy-home-panel">
                        <div class="academy-home-panel-label">${academyCoachEscapeHtml(meta.emptyTitle)}</div>
                        <div class="academy-home-panel-copy">
                            ${academyCoachEscapeHtml(meta.emptyCopy)}
                        </div>
                        <div class="academy-home-chip-row">
                            ${(Array.isArray(meta.chips) ? meta.chips : [])
                                .map((item) => `<span class="yh-universe-feature-chip">${academyCoachEscapeHtml(item)}</span>`)
                                .join('')}
                        </div>

                        ${quickPromptsHtml ? `
                            <div class="academy-home-panel-label" style="margin-top:16px;">Try one now</div>
                            <div class="academy-home-chip-row">
                                ${quickPromptsHtml}
                            </div>
                        ` : ''}
                    </section>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map((message) => academyBuildCoachBubbleHtml(message)).join('');
        container.scrollTop = container.scrollHeight;
    }

    async function academyLoadCoachConversation(forceRefresh = false) {
        const container = document.getElementById('dynamic-chat-history');
        if (!container) return [];

        if (forceRefresh) {
            container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem;">Loading AI Coach.</div>`;
        }

        const result = await academyAuthedFetch(`/api/academy/assistant/messages?conversationId=${encodeURIComponent(academyCoachConversationId)}`, {
            method: 'GET'
        });

        const messages = Array.isArray(result?.messages) ? result.messages : [];
        academyRenderCoachConversation(messages);
        return messages;
    }

async function openAcademyCoachView(forceRefresh = true) {
        hideAcademyViewsForFeed();

        const academyChat = document.getElementById('academy-chat');
        const chatHeaderIcon = document.getElementById('chat-header-icon');
        const chatHeaderTitle = document.getElementById('chat-header-title');
        const chatHeaderTopic = document.getElementById('chat-header-topic');
        const chatWelcomeBox = document.getElementById('chat-welcome-box');
        const chatPinnedMessage = document.getElementById('chat-pinned-message');
        const chatInputArea = document.getElementById('chat-input-area');
        const meta = academyCoachUiMeta || getAcademyCoachUiMeta('general');

        if (academyChat) {
            academyChat.classList.remove('hidden-step');
            academyChat.classList.remove('fade-in');
            void academyChat.offsetWidth;
            academyChat.classList.add('fade-in');
        }

        setAcademySidebarActive('nav-missions');

        if (chatHeaderIcon) chatHeaderIcon.innerHTML = meta.icon || '🤖';
        if (chatHeaderTitle) chatHeaderTitle.innerText = meta.title || 'Academy AI Coach';
        if (chatHeaderTopic) chatHeaderTopic.innerText = meta.topic || 'Ask about today’s focus, blocked missions, roadmap execution, or low-energy adaptation.';
        if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
        academyRenderCoachPinnedPrompts(chatPinnedMessage, meta);
        if (chatInputArea) chatInputArea.style.display = 'flex';

        academyCoachModeActive = true;
        academySetChatInputPlaceholder(meta.placeholder || 'Ask your AI Coach about your roadmap, missions, or check-ins.');
        currentRoom = null;
        currentRoomId = null;
        currentRoomMeta = null;

        await academyLoadCoachConversation(forceRefresh);
        document.getElementById('chat-input')?.focus();
    }

    async function academySendCoachMessage(customText = null) {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');

        if (!input && customText === null) return;

        const rawText = customText !== null ? String(customText) : String(input?.value || '');
        const text = rawText.trim();

        if (!text) return;

        try {
            if (sendBtn) sendBtn.disabled = true;
            if (input) input.disabled = true;

            if (input) input.value = '';

            const currentMessages = document.getElementById('dynamic-chat-history')?.innerHTML?.trim();
            if (!currentMessages) {
                academyRenderCoachConversation([]);
            }

            const optimisticMessages = await academyLoadCoachConversation(false).catch(() => []);
            academyRenderCoachConversation([
                ...optimisticMessages,
                {
                    role: 'user',
                    text,
                    createdAt: new Date().toISOString()
                }
            ]);

            const result = await academyAuthedFetch('/api/academy/assistant/chat', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: academyCoachConversationId,
                    message: text,
                    contextHint: 'academy_chat'
                })
            });

            const refreshed = await academyLoadCoachConversation(true).catch(() => []);
            if (!refreshed.length && result?.reply) {
                academyRenderCoachConversation([
                    {
                        role: 'user',
                        text,
                        createdAt: new Date().toISOString()
                    },
                    {
                        role: 'assistant',
                        text: result.reply,
                        createdAt: new Date().toISOString(),
                        replyFormat: result.replyFormat || 'general',
                        coachModeKey: result.coachModeKey || 'general',
                        responseStyleVersion: result.responseStyleVersion || 'coach-format-v1'
                    }
                ]);
            }
        } catch (error) {
            showToast(error.message || 'Failed to get AI Coach reply.', 'error');
            await academyLoadCoachConversation(true).catch(() => {});
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.disabled = false;
            input?.focus();
        }
    }

    function sendMessage(customText = null) {
        if (academyCoachModeActive) {
            academySendCoachMessage(customText);
            return;
        }

        const chatInputArea = document.getElementById('chat-input');
        if(!chatInputArea && customText === null) return;

        let rawText = customText !== null ? customText : chatInputArea.value;
        let text = rawText.trim();
        if (!text && !rawText.includes("chat-attachment")) return;

        let initial = myName.charAt(0).toUpperCase();
        let savedAvatar = localStorage.getItem('yh_user_avatar') || "";
        const timeString = 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const activeRoomId = getActiveRoomId();
const activeRoomLabel = getActiveRoomLabel();

if (!activeRoomId) {
    showToast("Choose a room first.", "error");
    return;
}

const activeRoomParticipants = Array.from(new Set(
    safeParseArray(
        currentRoomMeta?.memberNames ||
        currentRoomMeta?.participants ||
        [],
        currentRoomMeta?.type === 'dm'
            ? [myName, activeRoomLabel]
            : [myName]
    )
)).filter(Boolean);

const activeRoomMemberIds = Array.from(new Set(
    safeParseArray(
        currentRoomMeta?.memberIds || [],
        []
    ).map((value) => normalizeUserKey(value)).filter(Boolean)
));

const outboundMessage = {
    roomId: activeRoomId,
    room: activeRoomId,
    roomName: activeRoomLabel,
    text: text,
    author: myName,
    initial: initial,
    avatar: savedAvatar,
    time: timeString,
    type: currentRoomMeta?.type || (activeRoomId === 'YH-community' ? 'main-chat' : 'dm'),
    privacy: currentRoomMeta?.privacy || (activeRoomId === 'YH-community' ? 'public' : 'private'),
    participants: activeRoomParticipants,
    memberNames: activeRoomParticipants,
    memberIds: activeRoomMemberIds,
    recipientName: currentRoomMeta?.recipientName || (currentRoomMeta?.type === 'dm' ? activeRoomLabel : ''),
    recipientId: currentRoomMeta?.recipientId || normalizeUserKey(
        currentRoomMeta?.recipientName || (currentRoomMeta?.type === 'dm' ? activeRoomLabel : '')
    )
};

socket.emit('sendMessage', outboundMessage);

if (activeRoomId && activeRoomId !== 'YH-community') {
    touchCustomRoomFromMessage(outboundMessage, {
        createIfMissing: true,
        resetUnread: true
    });
}

if (chatInputArea) chatInputArea.value = '';

if ((currentRoom || "").includes("Agent")) {
    setTimeout(() => {
        let aiReply = "";
        const userMsg = rawText.toLowerCase();

        if (userMsg.includes("hi") || userMsg.includes("hey")) {
            aiReply = "Hello Hustler. How can I assist your execution today?";
        } else if (userMsg.includes("chat-attachment")) {
            aiReply = "I have received your file. It has been securely logged in my temporary memory buffer.";
        } else {
            const aiResponses = [
                "That is a solid strategy. Stay disciplined.",
                "I have logged your query.",
                "Hustle recognized. Keep executing."
            ];
            aiReply = aiResponses[Math.floor(Math.random() * aiResponses.length)];
        }

        const aiMessage = {
            roomId: activeRoomId,
            room: activeRoomId,
            roomName: activeRoomLabel,
            author: "Agent",
            initial: "🤖",
            avatar: "",
            text: aiReply,
            time: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.emit('sendMessage', aiMessage);

        if (activeRoomId && activeRoomId !== 'YH-community') {
            touchCustomRoomFromMessage(aiMessage, {
                createIfMissing: true,
                resetUnread: true
            });
        }
    }, 1500);
}
    }

    // --- LEAVE / END CALL LOGIC ---
const btnLeaveStage = document.getElementById('btn-leave-stage');
    const btnEndLiveStage = document.getElementById('btn-end-live-stage');

    if (btnLeaveStage) {
        btnLeaveStage.addEventListener('click', async () => {
            const activeRoom = academyActiveLiveRoom || {};
            const roomId = normalizeAcademyLiveRoomId(activeRoom?.id || activeRoom?.roomId || activeRoom?.room_id);
            const roomType = getAcademyLiveRoomType(activeRoom);
            const navId = getAcademyLiveLobbyNavId(roomType);
            const isHost = isAcademyLiveRoomHost(activeRoom);

            stopAcademyLiveMediaStream();

            if (!roomId) {
                document.getElementById(navId)?.click();
                showToast(isHost ? 'Returned to the live lounge.' : 'You left the stage.', 'success');
                return;
            }

            if (isHost) {
                document.getElementById(navId)?.click();
                showToast('Returned to the live lounge. Your live is still active.', 'success');
                return;
            }

            const confirmed = await openYHConfirmModal({
                title: `Leave Live ${roomType.toUpperCase()}`,
                message: `Leave this live ${roomType} session?`,
                okText: 'Leave',
                cancelText: 'Stay',
                tone: 'danger'
            });

            if (!confirmed) return;

            try {
                await academyAuthedFetch(`/api/realtime/live-rooms/${encodeURIComponent(roomId)}/leave`, {
                    method: 'POST'
                });

                academyActiveLiveRoom = null;

                if (roomType === 'video') {
                    await loadAcademyVideoRooms(true);
                } else {
                    await loadAcademyVoiceRooms(true);
                }

                document.getElementById(navId)?.click();
                showToast('You left the stage.', 'success');
            } catch (error) {
                console.error('leave live room error:', error);
                showToast(error?.message || 'Failed to leave the live room.', 'error');
            }
        });
    }

    if (btnEndLiveStage) {
        btnEndLiveStage.addEventListener('click', async () => {
            const activeRoom = academyActiveLiveRoom || {};
            const roomId = normalizeAcademyLiveRoomId(activeRoom?.id || activeRoom?.roomId || activeRoom?.room_id);
            const roomType = getAcademyLiveRoomType(activeRoom);
            const navId = getAcademyLiveLobbyNavId(roomType);

            if (!roomId) {
                showToast('No active live room to end.', 'error');
                return;
            }

            if (!isAcademyLiveRoomHost(activeRoom)) {
                showToast('Only the live creator can end this session.', 'error');
                return;
            }

            const confirmed = await openYHConfirmModal({
                title: `End Live ${roomType.toUpperCase()}`,
                message: `End this live ${roomType} session for everyone?`,
                okText: 'End Live',
                cancelText: 'Cancel',
                tone: 'danger'
            });
            if (!confirmed) return;

            try {
                await academyAuthedFetch(`/api/realtime/live-rooms/${encodeURIComponent(roomId)}/end`, {
                    method: 'POST'
                });

                stopAcademyLiveMediaStream();
                academyActiveLiveRoom = null;

                if (roomType === 'video') {
                    await loadAcademyVideoRooms(true);
                } else {
                    await loadAcademyVoiceRooms(true);
                }

                document.getElementById(navId)?.click();
                showToast(`Live ${roomType} session ended.`, 'success');
            } catch (error) {
                console.error('end live room error:', error);
                showToast(error?.message || 'Failed to end the live room.', 'error');
            }
        });
    }

    // --- EMOJI, GIF, GIFT LOGIC ---
    const btnGift = document.querySelector('span[title="Send Gift"]');
    const btnGif = document.querySelector('span[title="Open GIF picker"]');
    const btnEmoji = document.querySelector('span[title="Select emoji"]');

    if(btnGift) { btnGift.addEventListener('click', () => { document.getElementById('gift-modal').classList.remove('hidden-step'); }); }

    const closeGiftModal = document.getElementById('close-gift-modal');
    const giftModal = document.getElementById('gift-modal');
    if(closeGiftModal && giftModal) {
        closeGiftModal.addEventListener('click', () => giftModal.classList.add('hidden-step'));
        giftModal.addEventListener('click', (e) => { if(e.target === giftModal) giftModal.classList.add('hidden-step'); });
    }

    const giftItems = document.querySelectorAll('#gift-modal .modal-body > div > div'); 
    giftItems.forEach(giftBox => {
        giftBox.addEventListener('click', () => {
            showToast("Connecting to Payment Gateway...", "success");
            setTimeout(() => {
                showToast("Gift sent successfully! +XP added to target.", "success");
                giftModal.classList.add('hidden-step');
            }, 1500);
        });
    });

    if(btnGif) { btnGif.addEventListener('click', () => { showToast("GIF API (Tenor/Giphy) requires Backend connection.", "error"); }); }

    if (btnEmoji) {
        btnEmoji.addEventListener('click', () => {
            if (typeof picmoPopup !== 'undefined') {
                if(!window.emojiPicker) {
                    window.emojiPicker = picmoPopup.createPopup({ animate: true, theme: 'dark' }, { triggerElement: btnEmoji, referenceElement: btnEmoji, position: 'top-end' });
                    window.emojiPicker.addEventListener('emoji:select', (selection) => {
                        if(chatInputArea) { chatInputArea.value += selection.emoji; chatInputArea.focus(); }
                    });
                }
                window.emojiPicker.toggle();
            } else {
                showToast("Emoji Library is loading... please wait.", "error");
            }
        });
    }

    // --- STAGE CONTROLS, WEBRTC & INVITE ---
    let localStream = null;
    const btnToggleMic = document.getElementById('btn-toggle-mic');
    const btnToggleCam = document.getElementById('btn-toggle-cam');
    const btnToggleScreen = document.getElementById('btn-toggle-screen');

    async function toggleCamera() {
        try {
            const mySpeakerCard = document.querySelector('.speaker-card.active-speaker'); 
            const hostAvatarEl = document.getElementById('host-avatar');
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if(btnToggleCam) btnToggleCam.classList.remove('toggled-off');
                if(mySpeakerCard) mySpeakerCard.classList.remove('is-offcam');
                showToast("Camera & Mic Active", "success");
            } else {
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = !track.enabled;
                    if (!track.enabled) {
                        if(btnToggleCam) btnToggleCam.classList.add('toggled-off');
                        if(mySpeakerCard) mySpeakerCard.classList.add('is-offcam');
                        if(hostAvatarEl) { hostAvatarEl.innerText = "🚫"; hostAvatarEl.style.background = "#1a1f2e"; }
                        showToast("Camera disabled", "success");
                    } else {
                        if(btnToggleCam) btnToggleCam.classList.remove('toggled-off');
                        if(mySpeakerCard) mySpeakerCard.classList.remove('is-offcam');
                        if(hostAvatarEl) { hostAvatarEl.innerText = localStorage.getItem('yh_user_name')?.charAt(0).toUpperCase() || "Y"; hostAvatarEl.style.background = "var(--neon-blue)"; }
                        showToast("Camera active", "success");
                    }
                });
            }
        } catch (err) { showToast("Camera/Mic permission denied by browser.", "error"); }
    }

    if(btnToggleCam) btnToggleCam.addEventListener('click', toggleCamera);

    if(btnToggleMic) {
        btnToggleMic.addEventListener('click', () => {
            const mySpeakerCard = document.querySelector('.speaker-card.active-speaker'); 
            const hostMicIcon = document.getElementById('host-mic');
            btnToggleMic.classList.toggle('toggled-off');
            const isMuted = btnToggleMic.classList.contains('toggled-off');
            
            if(mySpeakerCard) {
                if(isMuted) mySpeakerCard.classList.add('is-muted');
                else mySpeakerCard.classList.remove('is-muted');
            }
            if(hostMicIcon) {
                hostMicIcon.innerText = isMuted ? "🔇" : "🎤";
                hostMicIcon.style.color = isMuted ? "#ef4444" : "";
            }

            if(localStream) { localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; }); }
            showToast(isMuted ? "Microphone muted." : "Microphone active.", isMuted ? "error" : "success");
        });
    }

    if(btnToggleScreen) {
        btnToggleScreen.addEventListener('click', async () => {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                btnToggleScreen.classList.add('toggled-on');
                showToast("Screen sharing started!", "success");
                screenStream.getVideoTracks()[0].onended = () => {
                    btnToggleScreen.classList.remove('toggled-on');
                    showToast("Screen share stopped.", "error");
                };
            } catch (err) { showToast("Screen sharing cancelled.", "error"); }
        });
    }

const stageChatInput = document.getElementById('stage-chat-input');
const stageChatHistory = document.getElementById('stage-chat-history');
const stageChatSendBtn = document.getElementById('stage-chat-send-btn');

function renderStageChatHistory(messages = []) {
    if (!stageChatHistory) return;

    if (!Array.isArray(messages) || !messages.length) {
        stageChatHistory.innerHTML = `<div class="stage-chat-welcome">Welcome to the live stage chat!</div>`;
        return;
    }

    stageChatHistory.innerHTML = messages.map((msg) => {
        const author = academyFeedEscapeHtml(msg?.author || 'Hustler');
        const text = academyFeedEscapeHtml(msg?.text || '');
        return `<div class="stage-chat-msg fade-in"><strong>${author}:</strong> ${text}</div>`;
    }).join('');

    stageChatHistory.scrollTop = stageChatHistory.scrollHeight;
}

function appendStageChatMessage(msg = {}) {
    if (!stageChatHistory) return;

    const author = academyFeedEscapeHtml(msg?.author || 'Hustler');
    const text = academyFeedEscapeHtml(msg?.text || '');

    const welcome = stageChatHistory.querySelector('.stage-chat-welcome');
    if (welcome) {
        welcome.remove();
    }

    stageChatHistory.insertAdjacentHTML(
        'beforeend',
        `<div class="stage-chat-msg fade-in"><strong>${author}:</strong> ${text}</div>`
    );

    stageChatHistory.scrollTop = stageChatHistory.scrollHeight;
}

function sendStageChat() {
    const activeRoomId = getActiveRoomId();
    const activeRoomType = String(currentRoomMeta?.type || '').trim();

    if (!stageChatInput || !activeRoomId || !/^live-/.test(activeRoomType)) return;
    if (stageChatInput.value.trim() === '') return;

    const outboundMessage = {
        roomId: activeRoomId,
        room: activeRoomId,
        roomName: getActiveRoomLabel(),
        author: getStoredUserValue('yh_user_name', "Hustler"),
        initial: String(getStoredUserValue('yh_user_name', "Hustler") || 'H').charAt(0).toUpperCase(),
        avatar: "",
        text: stageChatInput.value.trim(),
        time: new Date().toISOString()
    };

    socket.emit('sendMessage', outboundMessage);
    stageChatInput.value = '';
}

if (stageChatInput && stageChatHistory) {
    stageChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendStageChat();
        }
    });
}

if (stageChatSendBtn) {
    stageChatSendBtn.addEventListener('click', sendStageChat);
}

    const btnInviteStage = document.getElementById('btn-invite-to-stage');
    if (btnInviteStage) {
        btnInviteStage.addEventListener('click', () => {
            const stageTitle = document.getElementById('stage-title')?.innerText || "Live Mastermind";
            const simpleLinkHTML = `Hey! I'm LIVE NOW hosting <strong>${stageTitle}</strong>. <a href="#" onclick="document.getElementById('nav-voice').click(); return false;" style="color: var(--neon-blue); font-weight: bold; text-decoration: underline;">Click here to join my room!</a>`;
            
            const shareModal = document.getElementById('share-select-modal');
            const destList = document.getElementById('share-destinations-list');
            if (shareModal && destList) {
    const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});

    window.pendingShareHTML = simpleLinkHTML;

    const normalizeRoom = (room, index = 0) => ({
        id: room.id || room._id || room.roomId || room.room_id || `custom-room-${index + 1}`,
        name: room.name || room.title || room.roomName || room.room_name || `Room ${index + 1}`,
        icon: room.icon || room.emoji || room.avatar || room.image || '💬',
        type: room.type || room.roomType || room.room_type || 'dm',
        privacy: room.privacy || room.visibility || (room.isPrivate ? 'private' : 'public') || 'public',
        isPrivate: typeof room.isPrivate === 'boolean'
            ? room.isPrivate
            : (room.privacy === 'private' || room.visibility === 'private')
    });

    let stateRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

    let cachedRooms = [];
    try {
        const cached = JSON.parse(localStorage.getItem('yh_custom_rooms_cache') || 'null');
        cachedRooms = Array.isArray(cached?.rooms) ? cached.rooms : [];
    } catch (_) {}

    let legacyRooms = [];
    try {
        const rawLegacy = JSON.parse(localStorage.getItem('yh_custom_rooms') || '[]');
        legacyRooms = Array.isArray(rawLegacy) ? rawLegacy : [];
    } catch (_) {}

    const mergedRooms = [...stateRooms, ...cachedRooms, ...legacyRooms]
        .map((room, index) => normalizeRoom(room, index))
        .filter((room, index, arr) => {
            return arr.findIndex((candidate) => {
                const sameId = candidate.id && room.id && String(candidate.id) === String(room.id);
                const sameName = String(candidate.name || '').trim().toLowerCase() === String(room.name || '').trim().toLowerCase();
                const sameType = String(candidate.type || '').trim().toLowerCase() === String(room.type || '').trim().toLowerCase();
                return sameId || (sameName && sameType);
            }) === index;
        });

    destList.innerHTML = `
        <button
            class="btn-secondary share-dest-btn"
            data-target="main-chat"
            data-room-id="main-chat"
            data-room-type="main-chat"
            data-room-privacy="public"
            style="padding: 10px; text-align: left;"
        >💬 YH-community (Public)</button>
    `;

    mergedRooms.forEach((room) => {
        destList.insertAdjacentHTML('beforeend', `
            <button
                class="btn-secondary share-dest-btn"
                data-target="${room.name}"
                data-room-id="${room.id || ''}"
                data-room-type="${room.type || 'dm'}"
                data-room-privacy="${room.privacy || (room.isPrivate ? 'private' : 'public')}"
                style="padding: 10px; text-align: left;"
            >${room.icon || '💬'} ${room.name}</button>
        `);
    });

    shareModal.classList.remove('hidden-step');
}
        });
    }

    // --- THE VAULT & UPLOADS ---
function formatVaultFileSize(bytes = 0) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return 'Unknown';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

async function syncVaultCacheFromBackend() {
    const result = await academyAuthedFetch('/api/realtime/vault', {
        method: 'GET'
    });

    const rawItems = Array.isArray(result?.items) ? result.items : [];
    localStorage.setItem('yh_vault_items_backend', JSON.stringify(rawItems));
    return rawItems;
}

function readVaultCache() {
    try {
        return JSON.parse(localStorage.getItem('yh_vault_items_backend') || '[]');
    } catch (_) {
        return [];
    }
}

async function saveVaultItemObj(itemObj) {
    if (!itemObj || itemObj.type !== 'folder') return;

    await academyAuthedFetch('/api/realtime/vault/folder', {
        method: 'POST',
        body: JSON.stringify({
            name: String(itemObj.name || '').trim(),
            parentId: currentVaultFolder || ''
        })
    });

    await syncVaultCacheFromBackend();
    await loadVault();
}

async function saveFileToVault(file, origin) {
    await academyAuthedFetch('/api/realtime/vault/file', {
        method: 'POST',
        body: JSON.stringify({
            name: file.name,
            parentId: currentVaultFolder || '',
            filePath: '',
            mimeType: file.type || 'application/octet-stream',
            fileSize: Number(file.size || 0),
            origin: origin || 'Direct Upload'
        })
    });

    await syncVaultCacheFromBackend();
    await loadVault();
}

async function loadVault() {
    const grid = document.getElementById('vault-dynamic-grid');
    if (!grid) return;

    grid.innerHTML = '';

    let vaultItems = [];
    try {
        vaultItems = await syncVaultCacheFromBackend();
    } catch (_) {
        vaultItems = readVaultCache();
    }

    const currentFolder = currentVaultFolder
        ? vaultItems.find((item) => String(item.id) === String(currentVaultFolder))
        : null;

    const visibleItems = vaultItems.filter((item) => {
        return String(item.parent_id || '') === String(currentVaultFolder || '');
    });

    if (currentVaultFolder && currentFolder) {
        grid.innerHTML = `
            <div class="vault-folder-header" id="btn-vault-back">
                <span>⬅ Back to All Files</span>
                <span style="color: #fff;">📂 ${currentFolder.name}</span>
            </div>
        `;
        document.getElementById('btn-vault-back').addEventListener('click', () => {
            currentVaultFolder = currentFolder.parent_id || null;
            loadVault();
        });
    }

    if (visibleItems.length === 0) {
        grid.insertAdjacentHTML('beforeend', `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">
                This location is empty. Upload a file or create a folder.
            </div>
        `);
        return;
    }

    visibleItems
        .slice()
        .sort((a, b) => {
            const aFolder = a.item_type === 'folder' ? 0 : 1;
            const bFolder = b.item_type === 'folder' ? 0 : 1;
            if (aFolder !== bFolder) return aFolder - bFolder;
            return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .forEach((item) => {
            const isFolder = item.item_type === 'folder';
            const visualContent = isFolder
                ? `<div class="vault-icon">📁</div>`
                : `<div class="vault-icon">📄</div>`;

            const actionText = isFolder ? 'Open Folder' : 'Share to Chat';

            grid.insertAdjacentHTML('beforeend', `
                <div
                    class="vault-card fade-in ${isFolder ? 'vault-folder' : ''}"
                    data-id="${item.id}"
                    data-name="${item.name}"
                    data-type="${item.item_type}"
                >
                    ${visualContent}
                    <div class="vault-filename" title="${item.name}">${item.name}</div>
                    <div class="vault-meta">${isFolder ? 'Folder' : formatVaultFileSize(item.file_size)}</div>
                    <div class="vault-origin">From: ${item.file_path ? 'Uploaded Path' : 'Server Metadata'}</div>
                    <button class="btn-vault-action action-vault-btn">${actionText}</button>
                </div>
            `);
        });

    document.querySelectorAll('.action-vault-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.vault-card');
            const itemId = card.getAttribute('data-id');
            const itemType = card.getAttribute('data-type');
            const itemName = card.getAttribute('data-name');

            if (itemType === 'folder') {
                currentVaultFolder = itemId;
                showToast(`Opening folder: ${itemName}`, 'success');
                loadVault();
                return;
            }

            const fullItem = vaultItems.find((item) => String(item.id) === String(itemId));
            const downloadLink = fullItem?.file_path
                ? `<a href="${fullItem.file_path}" target="_blank" rel="noopener noreferrer" style="color: var(--neon-blue);">⬇ Open File</a>`
                : `<span style="color: var(--text-muted);">Metadata only</span>`;

            const shareModal = document.getElementById('share-select-modal');
            const destList = document.getElementById('share-destinations-list');

            if (shareModal && destList) {
                const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});

                window.pendingShareHTML = `
                    <div class="chat-attachment" style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-top: 5px;">
                        <div style="font-size: 2rem; margin-bottom: 8px;">📄</div>
                        <div>
                            <strong>${itemName}</strong><br>
                            ${downloadLink}
                        </div>
                    </div>
                `;

                const normalizeRoom = (room, index = 0) => ({
                    id: room.id || room._id || room.roomId || room.room_id || `custom-room-${index + 1}`,
                    name: room.name || room.title || room.roomName || room.room_name || `Room ${index + 1}`,
                    icon: room.icon || room.emoji || room.avatar || room.image || '💬',
                    type: room.type || room.roomType || room.room_type || 'dm',
                    privacy: room.privacy || room.visibility || (room.isPrivate ? 'private' : 'public') || 'public',
                    isPrivate: typeof room.isPrivate === 'boolean'
                        ? room.isPrivate
                        : (room.privacy === 'private' || room.visibility === 'private')
                });

                let stateRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

                let cachedRooms = [];
                try {
                    const cached = JSON.parse(localStorage.getItem('yh_custom_rooms_cache') || 'null');
                    cachedRooms = Array.isArray(cached?.rooms) ? cached.rooms : [];
                } catch (_) {}

                let legacyRooms = [];
                try {
                    const rawLegacy = JSON.parse(localStorage.getItem('yh_custom_rooms') || '[]');
                    legacyRooms = Array.isArray(rawLegacy) ? rawLegacy : [];
                } catch (_) {}

                const mergedRooms = [...stateRooms, ...cachedRooms, ...legacyRooms]
                    .map((room, index) => normalizeRoom(room, index))
                    .filter((room, index, arr) => {
                        return arr.findIndex((candidate) => {
                            const sameId = candidate.id && room.id && String(candidate.id) === String(room.id);
                            const sameName = String(candidate.name || '').trim().toLowerCase() === String(room.name || '').trim().toLowerCase();
                            const sameType = String(candidate.type || '').trim().toLowerCase() === String(room.type || '').trim().toLowerCase();
                            return sameId || (sameName && sameType);
                        }) === index;
                    });

                destList.innerHTML = `
                    <button
                        class="btn-secondary share-dest-btn"
                        data-target="main-chat"
                        data-room-id="main-chat"
                        data-room-type="main-chat"
                        data-room-privacy="public"
                        style="padding: 10px; text-align: left;"
                    >💬 YH-community (Public)</button>
                `;

                mergedRooms.forEach((room) => {
                    destList.insertAdjacentHTML('beforeend', `
                        <button
                            class="btn-secondary share-dest-btn"
                            data-target="${room.name}"
                            data-room-id="${room.id || ''}"
                            data-room-type="${room.type || 'dm'}"
                            data-room-privacy="${room.privacy || (room.isPrivate ? 'private' : 'public')}"
                            style="padding: 10px; text-align: left;"
                        >${room.icon || '💬'} ${room.name}</button>
                    `);
                });

                shareModal.classList.remove('hidden-step');
            }
        });
    });

    const contextMenu = document.getElementById('vault-context-menu');
    document.querySelectorAll('.vault-card').forEach((card) => {
        const showContext = (pageX, pageY) => {
            selectedVaultIndex = card.getAttribute('data-id');
            contextMenu.style.left = `${pageX}px`;
            contextMenu.style.top = `${pageY}px`;
            contextMenu.classList.remove('hidden-step');
        };

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContext(e.pageX, e.pageY);
        });
    });
}
async function ensureVaultLoaded(force = false) {
    if (hasLoadedVaultOnce && !force) return;

    await loadVault();
    hasLoadedVaultOnce = true;
}
    const btnCreateFolder = document.getElementById('btn-create-folder');
    if (btnCreateFolder) {
        btnCreateFolder.addEventListener('click', async () => {
            const name = document.getElementById('folder-name-input').value.trim();
            if (!name) return;

            try {
                await saveVaultItemObj({
                    type: 'folder',
                    name
                });

                document.getElementById('folder-modal').classList.add('hidden-step');
                document.getElementById('folder-name-input').value = '';
                showToast(`Folder '${name}' created!`, "success");
            } catch (error) {
                showToast(error.message || 'Failed to create folder.', 'error');
            }
        });
    }

    const btnVaultUpload = document.getElementById('btn-vault-upload-trigger');
    const vaultFileInput = document.getElementById('vault-file-input');

    if (btnVaultUpload && vaultFileInput) {
        btnVaultUpload.addEventListener('click', () => vaultFileInput.click());

        vaultFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                await saveFileToVault(file, "Direct Upload");
                showToast(`${file.name} saved to The Vault.`, "success");
            } catch (error) {
                showToast(error.message || 'Failed to save vault file metadata.', 'error');
            } finally {
                vaultFileInput.value = '';
            }
        });
    }

    let academyDmSelectedMemberId = '';
    let academyDmDirectoryMembers = [];
    let academyGroupDirectoryMembers = [];
    let academyDmDirectoryToken = 0;
    let academyGroupDirectoryToken = 0;

    function academyNormalizeMessagingMember(member = {}) {
        const id = normalizeAcademyFeedId(member?.id || member?.userId || member?.uid);
        if (!id) return null;

        const displayName =
            String(
                member?.display_name ||
                member?.displayName ||
                member?.fullName ||
                member?.name ||
                member?.username ||
                'Academy Member'
            ).trim() || 'Academy Member';

        const username = String(member?.username || '').trim().replace(/^@+/, '');
        const roleLabel =
            String(member?.role_label || member?.roleLabel || member?.role || 'Academy Member').trim() ||
            'Academy Member';
        const avatar = String(member?.avatar || member?.profilePhoto || member?.photoURL || '').trim();

        return {
            id,
            displayName,
            fullName: String(member?.fullName || displayName).trim() || displayName,
            username,
            roleLabel,
            avatar,
            followersCount: Number(member?.followers_count || 0)
        };
    }

    async function academyFetchMessagingMembers(query = '', limit = 40) {
        const normalizedQuery = String(query || '').trim();

        const result = await academyAuthedFetch(
            `/api/academy/community/members?limit=${encodeURIComponent(limit)}&query=${encodeURIComponent(normalizedQuery)}`,
            { method: 'GET' }
        );

        const members = Array.isArray(result?.members) ? result.members : [];
        return members.map(academyNormalizeMessagingMember).filter(Boolean);
    }

    function academyCreatePrivateGroupRoomElement(roomEntry = {}) {
        const element = document.createElement('div');
        const roomId = String(roomEntry.roomId || roomEntry.id || '').trim();
        const roomName = String(roomEntry.name || 'Private Group').trim() || 'Private Group';
        const icon = roomEntry.icon || '👥';
        const color = roomEntry.color || '#0ea5e9';
        const participantNames = Array.isArray(roomEntry.participantNames) ? roomEntry.participantNames : [];
        const memberIds = Array.isArray(roomEntry.memberIds) ? roomEntry.memberIds : [];

        element.className = 'room-entry';
        element.setAttribute('data-type', 'group');
        element.setAttribute('data-id', roomId);
        element.setAttribute('data-room-id', roomId);
        element.setAttribute('data-name', roomName);
        element.setAttribute('data-icon', icon);
        element.setAttribute('data-color', color);
        element.setAttribute(
            'data-room-participants',
            JSON.stringify(participantNames)
        );
        element.setAttribute(
            'data-room-member-names',
            JSON.stringify(participantNames)
        );
        element.setAttribute(
            'data-room-member-ids',
            JSON.stringify(memberIds)
        );
        return element;
    }

    function academyFindMessagingMemberById(collection = [], memberId = '') {
        const normalizedMemberId = normalizeAcademyFeedId(memberId);
        if (!normalizedMemberId) return null;

        return (Array.isArray(collection) ? collection : []).find((member) => {
            return normalizeAcademyFeedId(member?.id) === normalizedMemberId;
        }) || null;
    }

    function academyIsPendingGroupMember(memberId = '') {
        const normalizedMemberId = normalizeAcademyFeedId(memberId);
        if (!normalizedMemberId) return false;

        return pendingGroupMembers.some((member) => {
            return normalizeAcademyFeedId(member?.id) === normalizedMemberId;
        });
    }

    function resetDmModalSelection() {
        academyDmSelectedMemberId = '';
        syncDmStartButtonState();
    }

    function syncDmStartButtonState() {
        const btnStartDm = document.getElementById('btn-start-dm');
        if (!btnStartDm) return false;

        const selectedMember = academyFindMessagingMemberById(
            academyDmDirectoryMembers,
            academyDmSelectedMemberId
        );

        const isReady = Boolean(selectedMember);

        btnStartDm.disabled = !isReady;
        btnStartDm.setAttribute('aria-disabled', isReady ? 'false' : 'true');
        btnStartDm.style.opacity = isReady ? '1' : '0.5';
        btnStartDm.style.cursor = isReady ? 'pointer' : 'not-allowed';
        btnStartDm.innerText = isReady
            ? `Start DM with ${selectedMember.displayName}`
            : 'Select a member to chat';

        return isReady;
    }

    function renderPendingGroupMembers() {
        const wrap = document.getElementById('group-selected-members');
        if (!wrap) return;

        if (!Array.isArray(pendingGroupMembers) || !pendingGroupMembers.length) {
            wrap.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted);">No members selected yet.</div>`;
            return;
        }

        wrap.innerHTML = pendingGroupMembers.map((member) => {
            const memberId = academyFeedEscapeHtml(String(member.id || '').trim());
            const label = academyFeedEscapeHtml(String(member.displayName || member.fullName || member.username || 'Member').trim());
            return `
                <button
                    type="button"
                    data-remove-group-member-id="${memberId}"
                    style="border:none; cursor:pointer; display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:rgba(14,165,233,0.16); color:#e0f2fe; font-size:0.82rem;"
                >
                    <span>${label}</span>
                    <span aria-hidden="true">✕</span>
                </button>
            `;
        }).join('');
    }

    function syncGroupCreateButtonState() {
        const btnCreateGroup = document.getElementById('btn-create-group');
        const groupNameInput = document.getElementById('group-name-input');

        if (!btnCreateGroup || !groupNameInput) return false;

        const hasGroupName = String(groupNameInput.value || '').trim().length > 0;
        const hasMembers = Array.isArray(pendingGroupMembers) && pendingGroupMembers.length > 0;
        const isReady = hasGroupName && hasMembers;

        btnCreateGroup.disabled = !isReady;
        btnCreateGroup.setAttribute('aria-disabled', isReady ? 'false' : 'true');
        btnCreateGroup.style.opacity = isReady ? '1' : '0.6';
        btnCreateGroup.style.cursor = isReady ? 'pointer' : 'not-allowed';
        btnCreateGroup.innerText = !hasMembers
            ? 'Select members to create group'
            : !hasGroupName
                ? 'Enter group name to create'
                : `Create Group (${pendingGroupMembers.length + 1} members)`;

        return isReady;
    }

    async function renderDmModalDirectory(searchTerm = '', options = {}) {
        const directory = document.getElementById('dm-modal-directory');
        const summary = document.getElementById('dm-modal-summary');
        if (!directory) return;

        const requestToken = ++academyDmDirectoryToken;
        const normalizedSearchTerm = String(searchTerm || '').trim();

        if (!Array.isArray(options.preloadedMembers)) {
            directory.innerHTML = `<div style="font-size:0.9rem; color:var(--text-muted);">Loading members...</div>`;
        }

        const members = Array.isArray(options.preloadedMembers)
            ? options.preloadedMembers
            : await academyFetchMessagingMembers(normalizedSearchTerm, 40).catch(() => []);

        if (requestToken !== academyDmDirectoryToken) return;

        academyDmDirectoryMembers = members;

        if (summary) {
            summary.innerText = normalizedSearchTerm
                ? `Showing Academy member matches for “${normalizedSearchTerm}”.`
                : 'Showing Academy members. Type above to search by name, username, or role.';
        }

        if (!members.length) {
            directory.innerHTML = `<div style="font-size:0.9rem; color:var(--text-muted);">No Academy members matched your search.</div>`;
            syncDmStartButtonState();
            return;
        }

        directory.innerHTML = members.map((member) => {
            const isSelected = normalizeAcademyFeedId(member.id) === normalizeAcademyFeedId(academyDmSelectedMemberId);
            const safeId = academyFeedEscapeHtml(member.id);
            const safeName = academyFeedEscapeHtml(member.displayName);
            const safeRole = academyFeedEscapeHtml(member.roleLabel || 'Academy Member');
            const safeUsername = academyFeedEscapeHtml(member.username || '');
            const avatarMarkup = member.avatar
                ? `<span class="member-avatar dm-avatar-preview" style="width:40px; height:40px; flex-shrink:0; background-image:url('${academyFeedEscapeHtml(member.avatar)}'); background-size:cover; background-position:center;"></span>`
                : `<span class="member-avatar dm-avatar-preview" style="width:40px; height:40px; flex-shrink:0; background:#0ea5e9;">${academyFeedEscapeHtml((member.displayName || 'A').charAt(0).toUpperCase())}</span>`;

            return `
                <label
                    class="modal-user-item"
                    data-user-id="${safeId}"
                    style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid ${isSelected ? 'rgba(14,165,233,0.55)' : 'rgba(255,255,255,0.08)'}; border-radius:14px; cursor:pointer; background:${isSelected ? 'rgba(14,165,233,0.08)' : 'rgba(255,255,255,0.02)'};"
                >
                    <input
                        type="radio"
                        name="selected-dm-user"
                        class="dm-radio"
                        style="accent-color:#0ea5e9;"
                        ${isSelected ? 'checked' : ''}
                    >
                    ${avatarMarkup}
                    <span style="display:flex; flex-direction:column; min-width:0; flex:1;">
                        <span class="member-name dm-name-preview" style="font-weight:600;">${safeName}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">
                            ${safeRole}${safeUsername ? ` • @${safeUsername}` : ''}
                        </span>
                    </span>
                </label>
            `;
        }).join('');

        syncDmStartButtonState();
    }

    async function renderGroupModalDirectory(searchTerm = '', options = {}) {
        const directory = document.getElementById('group-modal-directory');
        const summary = document.getElementById('group-modal-summary');
        if (!directory) return;

        const requestToken = ++academyGroupDirectoryToken;
        const normalizedSearchTerm = String(searchTerm || '').trim();

        if (!Array.isArray(options.preloadedMembers)) {
            directory.innerHTML = `<div style="font-size:0.9rem; color:var(--text-muted);">Loading members...</div>`;
        }

        const members = Array.isArray(options.preloadedMembers)
            ? options.preloadedMembers
            : await academyFetchMessagingMembers(normalizedSearchTerm, 50).catch(() => []);

        if (requestToken !== academyGroupDirectoryToken) return;

        academyGroupDirectoryMembers = members;

        if (summary) {
            summary.innerText = normalizedSearchTerm
                ? `Showing Academy member matches for “${normalizedSearchTerm}”.`
                : 'Showing Academy members. Select multiple members to build your private group.';
        }

        if (!members.length) {
            directory.innerHTML = `<div style="font-size:0.9rem; color:var(--text-muted);">No Academy members matched your search.</div>`;
            syncGroupCreateButtonState();
            return;
        }

        directory.innerHTML = members.map((member) => {
            const isSelected = academyIsPendingGroupMember(member.id);
            const safeId = academyFeedEscapeHtml(member.id);
            const safeName = academyFeedEscapeHtml(member.displayName);
            const safeRole = academyFeedEscapeHtml(member.roleLabel || 'Academy Member');
            const safeUsername = academyFeedEscapeHtml(member.username || '');
            const avatarMarkup = member.avatar
                ? `<span class="member-avatar" style="width:40px; height:40px; flex-shrink:0; background-image:url('${academyFeedEscapeHtml(member.avatar)}'); background-size:cover; background-position:center;"></span>`
                : `<span class="member-avatar" style="width:40px; height:40px; flex-shrink:0; background:#0ea5e9;">${academyFeedEscapeHtml((member.displayName || 'A').charAt(0).toUpperCase())}</span>`;

            return `
                <div
                    class="modal-user-item"
                    data-group-member-id="${safeId}"
                    style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid ${isSelected ? 'rgba(14,165,233,0.55)' : 'rgba(255,255,255,0.08)'}; border-radius:14px; background:${isSelected ? 'rgba(14,165,233,0.08)' : 'rgba(255,255,255,0.02)'};"
                >
                    ${avatarMarkup}
                    <span style="display:flex; flex-direction:column; min-width:0; flex:1;">
                        <span class="member-name" style="font-weight:600;">${safeName}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">
                            ${safeRole}${safeUsername ? ` • @${safeUsername}` : ''}
                        </span>
                    </span>

                    <button
                        type="button"
                        data-toggle-group-member-id="${safeId}"
                        class="${isSelected ? 'btn-primary' : 'btn-secondary'}"
                        style="min-width:86px;"
                    >${isSelected ? 'Selected' : 'Add'}</button>
                </div>
            `;
        }).join('');

        syncGroupCreateButtonState();
    }

    function academyOpenDmModal() {
        const modal = document.getElementById('dm-modal');
        const searchInput = document.getElementById('dm-modal-search-input');
        if (!modal) return;

        academyDmSelectedMemberId = '';
        academyDmDirectoryMembers = [];
        modal.classList.remove('hidden-step');

        if (searchInput) {
            searchInput.value = '';
        }

        syncDmStartButtonState();
        renderDmModalDirectory('').catch(() => {});
        window.setTimeout(() => searchInput?.focus(), 0);
    }

    function academyCloseDmModal() {
        document.getElementById('dm-modal')?.classList.add('hidden-step');
        academyDmSelectedMemberId = '';
        academyDmDirectoryMembers = [];
        syncDmStartButtonState();
    }

    function academyOpenGroupModal() {
        const modal = document.getElementById('group-modal');
        const groupNameInput = document.getElementById('group-name-input');
        const searchInput = document.getElementById('group-member-search-input');
        if (!modal) return;

        pendingGroupMembers = [];
        academyGroupDirectoryMembers = [];
        modal.classList.remove('hidden-step');

        if (groupNameInput) {
            groupNameInput.value = '';
        }

        if (searchInput) {
            searchInput.value = '';
        }

        renderPendingGroupMembers();
        syncGroupCreateButtonState();
        renderGroupModalDirectory('').catch(() => {});
        window.setTimeout(() => groupNameInput?.focus(), 0);
    }

    function academyCloseGroupModal() {
        document.getElementById('group-modal')?.classList.add('hidden-step');
        pendingGroupMembers = [];
        academyGroupDirectoryMembers = [];
        renderPendingGroupMembers();
        syncGroupCreateButtonState();
    }

    document.getElementById('btn-open-dm-modal')?.addEventListener('click', academyOpenDmModal);
    document.getElementById('btn-open-group-modal')?.addEventListener('click', academyOpenGroupModal);

    document.getElementById('close-dm-modal')?.addEventListener('click', academyCloseDmModal);
    document.getElementById('close-group-modal')?.addEventListener('click', academyCloseGroupModal);

    document.getElementById('dm-modal')?.addEventListener('click', (event) => {
        if (event.target?.id === 'dm-modal') {
            academyCloseDmModal();
        }
    });

    document.getElementById('group-modal')?.addEventListener('click', (event) => {
        if (event.target?.id === 'group-modal') {
            academyCloseGroupModal();
        }
    });

    document.getElementById('dm-modal-search-input')?.addEventListener('input', (event) => {
        renderDmModalDirectory(event.currentTarget?.value || '').catch(() => {});
    });

    document.getElementById('group-member-search-input')?.addEventListener('input', (event) => {
        renderGroupModalDirectory(event.currentTarget?.value || '').catch(() => {});
    });

    document.getElementById('dm-modal-directory')?.addEventListener('click', (event) => {
        const targetItem = event.target?.closest?.('[data-user-id]');
        if (!targetItem) return;

        academyDmSelectedMemberId = normalizeAcademyFeedId(targetItem.getAttribute('data-user-id'));
        renderDmModalDirectory(
            document.getElementById('dm-modal-search-input')?.value || '',
            { preloadedMembers: academyDmDirectoryMembers }
        ).catch(() => {});
    });

    document.getElementById('group-modal-directory')?.addEventListener('click', (event) => {
        const toggleBtn = event.target?.closest?.('[data-toggle-group-member-id]');
        if (!toggleBtn) return;

        const memberId = normalizeAcademyFeedId(toggleBtn.getAttribute('data-toggle-group-member-id'));
        if (!memberId) return;

        const existingIndex = pendingGroupMembers.findIndex((member) => {
            return normalizeAcademyFeedId(member?.id) === memberId;
        });

        if (existingIndex >= 0) {
            pendingGroupMembers.splice(existingIndex, 1);
        } else {
            const member = academyFindMessagingMemberById(academyGroupDirectoryMembers, memberId);
            if (member) {
                pendingGroupMembers.push(member);
            }
        }

        renderPendingGroupMembers();
        renderGroupModalDirectory(
            document.getElementById('group-member-search-input')?.value || '',
            { preloadedMembers: academyGroupDirectoryMembers }
        ).catch(() => {});
        syncGroupCreateButtonState();
    });

    document.getElementById('group-selected-members')?.addEventListener('click', (event) => {
        const removeBtn = event.target?.closest?.('[data-remove-group-member-id]');
        if (!removeBtn) return;

        const memberId = normalizeAcademyFeedId(removeBtn.getAttribute('data-remove-group-member-id'));
        if (!memberId) return;

        pendingGroupMembers = pendingGroupMembers.filter((member) => {
            return normalizeAcademyFeedId(member?.id) !== memberId;
        });

        renderPendingGroupMembers();
        renderGroupModalDirectory(
            document.getElementById('group-member-search-input')?.value || '',
            { preloadedMembers: academyGroupDirectoryMembers }
        ).catch(() => {});
        syncGroupCreateButtonState();
    });

    const groupNameInput = document.getElementById('group-name-input');
    if (groupNameInput) {
        groupNameInput.addEventListener('input', () => {
            syncGroupCreateButtonState();
        });
    }

    const btnStartDm = document.getElementById('btn-start-dm');
    if (btnStartDm) {
        btnStartDm.addEventListener('click', async () => {
            const selectedMember = academyFindMessagingMemberById(
                academyDmDirectoryMembers,
                academyDmSelectedMemberId
            );

            if (!selectedMember) return;

            await runDashboardButtonAction(btnStartDm, 'Opening DM.', async () => {
                const result = await academyAuthedFetch('/api/realtime/rooms', {
                    method: 'POST',
                    body: JSON.stringify({
                        roomType: 'dm',
                        targetUserId: selectedMember.id
                    })
                });

                const room = result?.room || null;
                if (!room?.id) {
                    throw new Error('Failed to create direct message room.');
                }

                persistKnownUser({
                    name: selectedMember.displayName
                });

                const roomEntry = academyBuildDirectMessageRoomEntry(room, {
                    id: selectedMember.id,
                    displayName: selectedMember.displayName,
                    fullName: selectedMember.fullName,
                    avatar: selectedMember.avatar
                });

                const state = getDashboardState();
                const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

                const nextRooms = [
                    roomEntry,
                    ...currentRooms.filter((item) => {
                        const existingId = normalizeRoomKey(item?.id || item?.roomId || item?.room_key);
                        const nextId = normalizeRoomKey(roomEntry.id || roomEntry.roomId);
                        return existingId !== nextId;
                    })
                ];

                syncCustomRoomsUI(nextRooms);
                academyCloseDmModal();

                const transientRoomElement = academyCreateDirectMessageRoomElement(roomEntry);
                openRoom('dm', transientRoomElement);
                academySetMessagesChatMode('thread');
                academyRefreshMessagesInboxSelection();
                markCustomRoomAsRead(roomEntry.roomId || roomEntry.id);
                pulseAcademyRoomEntry(roomEntry.roomId || roomEntry.id);
                focusAcademyChatComposer();

                showToast(`DM ready with ${selectedMember.displayName}.`, 'success');
            });
        });
    }

    const btnCreateGroup = document.getElementById('btn-create-group');
    if (btnCreateGroup && groupNameInput) {
        btnCreateGroup.addEventListener('click', async () => {
            const chatName = String(groupNameInput.value || '').trim();
            const selectedMembers = Array.isArray(pendingGroupMembers)
                ? pendingGroupMembers.filter((member) => normalizeAcademyFeedId(member?.id))
                : [];

            if (!chatName || !selectedMembers.length) return;

            await runDashboardButtonAction(btnCreateGroup, 'Creating Group.', async () => {
                const memberUserIds = selectedMembers
                    .map((member) => normalizeAcademyFeedId(member?.id))
                    .filter(Boolean);

                const result = await academyAuthedFetch('/api/realtime/rooms', {
                    method: 'POST',
                    body: JSON.stringify({
                        roomType: 'group',
                        name: chatName,
                        memberUserIds
                    })
                });

                const room = result?.room || null;
                if (!room?.id) {
                    throw new Error('Failed to create private group.');
                }

                selectedMembers.forEach((member) => {
                    persistKnownUser({ name: member.displayName });
                });

                const currentUserId =
                    normalizeAcademyFeedId(getStoredUserValue('yh_user_id', '')) ||
                    normalizeAcademyFeedId(getStoredUserValue('yh_user_uid', ''));

                const participantNames = Array.from(new Set(
                    [myName, ...selectedMembers.map((member) => member.displayName)]
                        .map((value) => String(value || '').trim())
                        .filter(Boolean)
                ));

                const roomEntry = {
                    id: String(room.id || room.roomId || '').trim(),
                    roomId: String(room.id || room.roomId || '').trim(),
                    type: 'group',
                    name: String(room.name || chatName).trim() || chatName,
                    icon: '👥',
                    color: '#0ea5e9',
                    privacy: 'private',
                    isPrivate: true,
                    participantNames,
                    memberIds: Array.from(new Set([currentUserId, ...memberUserIds].filter(Boolean))),
                    unreadCount: 0,
                    lastMessage: '',
                    lastMessageAuthor: '',
                    lastMessageAt: ''
                };

                const state = getDashboardState();
                const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

                const nextRooms = [
                    roomEntry,
                    ...currentRooms.filter((item) => {
                        const existingId = normalizeRoomKey(item?.id || item?.roomId || item?.room_key);
                        const nextId = normalizeRoomKey(roomEntry.id || roomEntry.roomId);
                        return existingId !== nextId;
                    })
                ];

                syncCustomRoomsUI(nextRooms);
                academyCloseGroupModal();

                const transientRoomElement = academyCreatePrivateGroupRoomElement(roomEntry);
                openRoom('group', transientRoomElement);
                academySetMessagesChatMode('thread');
                academyRefreshMessagesInboxSelection();
                markCustomRoomAsRead(roomEntry.roomId || roomEntry.id);
                pulseAcademyRoomEntry(roomEntry.roomId || roomEntry.id);
                focusAcademyChatComposer();

                showToast(`Private group '${roomEntry.name}' created.`, 'success');
            });
        });

        syncGroupCreateButtonState();
    }

    const btnSendTicket = document.getElementById('btn-send-ticket');
    if(btnSendTicket) {
        btnSendTicket.addEventListener('click', () => {
            const subject = document.getElementById('ticket-subject').value; const desc = document.getElementById('ticket-desc').value;
            if(!subject || !desc) { showToast("Please fill out both subject and description.", "error"); return; }
            btnSendTicket.innerText = "Submitting..."; setTimeout(() => { showToast("Ticket successfully sent to support@younghustlers.net", "success"); btnSendTicket.innerText = "Submit Ticket ➔"; document.getElementById('ticket-subject').value = ''; document.getElementById('ticket-desc').value = ''; document.getElementById('ticket-modal').classList.add('hidden-step'); }, 1000);
        });
    }

    const btnSaveSettings = document.getElementById('btn-save-settings'); const inputDisplayName = document.getElementById('setting-display-name'); const btnSettings = document.getElementById('btn-settings');
    const avatarInput = document.getElementById('setting-avatar-input'); const avatarWrapper = document.getElementById('settings-avatar-wrapper'); const avatarPreview = document.getElementById('settings-avatar-preview');
    let tempAvatarData = null;
    if(btnSaveSettings && inputDisplayName && btnSettings) {
        btnSettings.addEventListener('click', () => {
            const savedName = localStorage.getItem('yh_user_name') || ''; const savedAvatar = localStorage.getItem('yh_user_avatar'); inputDisplayName.value = savedName;
            if (savedAvatar) { avatarPreview.innerText = ''; avatarPreview.style.backgroundImage = `url(${savedAvatar})`; tempAvatarData = savedAvatar; } 
            else { avatarPreview.innerText = savedName ? savedName.charAt(0).toUpperCase() : 'Y'; avatarPreview.style.backgroundImage = 'none'; tempAvatarData = null; }
        });
        if (avatarWrapper && avatarInput) {
            avatarWrapper.addEventListener('click', () => { avatarInput.click(); });
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        showToast("Image too large. Max 2MB allowed.", "error");
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        tempAvatarData = event.target.result;
                        avatarPreview.innerText = '';
                        avatarPreview.style.backgroundImage = `url(${tempAvatarData})`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        btnSaveSettings.addEventListener('click', () => {
            const newName = inputDisplayName.value.trim();
            if (!newName) {
                showToast("Display name cannot be empty.", "error");
                return;
            }

            localStorage.setItem('yh_user_name', newName);
            if (tempAvatarData) {
                localStorage.setItem('yh_user_avatar', tempAvatarData);
            }

            updateUserProfile(newName, tempAvatarData);
            showToast("Profile settings saved!", "success");
            document.getElementById('settings-modal').classList.add('hidden-step');
        });
    }

    const academySidebar = document.getElementById('academy-sidebar');

    document.querySelectorAll('.btn-focus-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            const dashboardCoreWrapper = document.getElementById('academy-wrapper');
            if (!dashboardCoreWrapper) return;

            dashboardCoreWrapper.classList.toggle('in-focus-mode');

            if (dashboardCoreWrapper.classList.contains('in-focus-mode')) {
                btn.innerHTML = yhTText('🔴 Exit Focus Mode');
                btn.style.background = 'rgba(239, 68, 68, 0.2)';
                btn.style.color = '#ef4444';
                btn.style.borderColor = '#ef4444';
                showToast("Focus Mode Activated: Distractions Hidden", "success");
            } else {
                btn.innerHTML = yhTText('👁️ Focus Mode');
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.color = '#fff';
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                showToast("Focus Mode Deactivated", "success");
            }
        });
    });

    const pollOptions = document.querySelectorAll('.poll-option');
    if (pollOptions.length > 0) {
        const savedVote = localStorage.getItem('yh_poll_vote');

        if (savedVote) {
            const selectedOpt = document.querySelector(`.poll-option[data-vote="${savedVote}"]`);
            if (selectedOpt) selectedOpt.classList.add('voted');

            const votesLabel = document.getElementById('poll-total-votes');
            if (votesLabel) votesLabel.innerText = yhTText('1,249 Votes');
        }

        pollOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                if (localStorage.getItem('yh_poll_vote')) {
                    showToast("You have already voted!", "error");
                    return;
                }

                opt.classList.add('voted');
                localStorage.setItem('yh_poll_vote', opt.getAttribute('data-vote'));
                showToast("Vote cast successfully!", "success");

                const votesLabel = document.getElementById('poll-total-votes');
                if (votesLabel) votesLabel.innerText = yhTText('1,249 Votes');

                const bg = opt.querySelector('.poll-option-bg');
                const percent = opt.querySelector('.poll-percent');
                if (bg) bg.style.width = "55%";
                if (percent) percent.innerText = "55%";
            });
        });
    }

const notifBell = document.getElementById('notif-bell');
const notifDropdown = document.getElementById('notif-dropdown');
const markAllRead = document.getElementById('mark-all-read');
const notifListContainer = document.getElementById('notif-list-container');
const notifBadge = document.getElementById('notif-badge-count');

const escapeNotificationHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const notificationTimeLabel = (value) => {
    if (!value) return yhTText('Just now');

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return yhTText('Just now');

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMin < 1) return yhTText('Just now');
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString();
};

const getNotificationUnreadCount = (notifications = []) =>
    (Array.isArray(notifications) ? notifications : []).filter((item) => {
        return !(
            item?.isRead === true ||
            item?.read === true ||
            item?.read_at ||
            item?.readAt
        );
    }).length;

const updateNotificationBadgeUi = (notifications = []) => {
    if (!notifBadge) return;

    const unreadCount = getNotificationUnreadCount(notifications);

    if (unreadCount <= 0) {
        notifBadge.style.display = 'none';
        notifBadge.innerText = '0';
        return;
    }

    notifBadge.style.display = 'flex';
    notifBadge.innerText = String(unreadCount);
};

const openNotificationTarget = (target = '') => {
    const normalized = String(target || '').trim().toLowerCase();

    if (normalized === 'announcements') {
        document.getElementById('nav-announcements')?.click();
        return;
    }

    if (normalized === 'main-chat' || normalized === 'chat') {
        document.getElementById('nav-chat')?.click();
        return;
    }

    if (normalized === 'dm') {
        document.getElementById('btn-open-dm-modal')?.click();
        return;
    }

    if (normalized === 'profile') {
        document.querySelector('.profile-mini')?.click();
    }
};

const renderRealtimeNotifications = (notifications = []) => {
    if (!notifListContainer) return;

    const list = Array.isArray(notifications) ? notifications : [];
    notifListContainer.innerHTML = '';

    if (!list.length) {
        notifListContainer.innerHTML = `
            <li class="notif-empty-state" id="notif-empty-state">No notifications yet.</li>
        `;
        updateNotificationBadgeUi([]);
        return;
    }

    list.forEach((notification) => {
        const notificationId = String(notification?.id || notification?.notificationId || '').trim();
        const title = String(notification?.title || 'Notification').trim();
        const text = String(
            notification?.text ||
            notification?.message ||
            notification?.body ||
            ''
        ).trim();
        const avatarStr = String(
            notification?.avatarStr ||
            notification?.initial ||
            title.charAt(0).toUpperCase() ||
            'N'
        ).trim();
        const color = String(notification?.color || 'var(--neon-blue)').trim();
        const target = String(notification?.target || '').trim();
        const createdAt =
            notification?.createdAt ||
            notification?.created_at ||
            notification?.time ||
            '';
        const isRead =
            notification?.isRead === true ||
            notification?.read === true ||
            !!notification?.readAt ||
            !!notification?.read_at;

        const li = document.createElement('li');
        li.className = `fade-in${isRead ? '' : ' unread'}`;
        if (notificationId) li.setAttribute('data-notification-id', notificationId);
        if (target) li.setAttribute('data-target', target);

        li.innerHTML = `
            <div class="notif-img" style="background: ${escapeNotificationHtml(color)};">
                ${escapeNotificationHtml(avatarStr)}
            </div>
            <div class="notif-text">
                <strong>${escapeNotificationHtml(title)}</strong>
                ${text ? ` ${escapeNotificationHtml(text)}` : ''}
                <span class="notif-time">${escapeNotificationHtml(notificationTimeLabel(createdAt))}</span>
            </div>
        `;

        li.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (notificationId && !isRead) {
                await markRealtimeNotificationRead(notificationId, false);
            }

            notifDropdown?.classList.remove('show');
            openNotificationTarget(target);
        });

        notifListContainer.appendChild(li);
    });

    updateNotificationBadgeUi(list);
};

async function loadRealtimeNotifications(forceFresh = false) {
    if (!notifListContainer) return [];

    const state = getDashboardState();

    if (!forceFresh && Array.isArray(state.realtimeNotifications)) {
        renderRealtimeNotifications(state.realtimeNotifications);
        return state.realtimeNotifications;
    }

    try {
        const result = await academyAuthedFetch('/api/realtime/notifications', {
            method: 'GET'
        });

        const notifications = Array.isArray(result?.notifications) ? result.notifications : [];
        state.realtimeNotifications = notifications;
        renderRealtimeNotifications(notifications);
        return notifications;
    } catch (error) {
        console.error('loadRealtimeNotifications error:', error);

        notifListContainer.innerHTML = `
            <li class="notif-empty-state" id="notif-empty-state">Failed to load notifications.</li>
        `;
        updateNotificationBadgeUi([]);
        return [];
    }
}

async function markRealtimeNotificationRead(notificationId, rerender = true) {
    const normalizedId = String(notificationId || '').trim();
    if (!normalizedId) return;

    const state = getDashboardState();

    try {
        await academyAuthedFetch(`/api/realtime/notifications/${encodeURIComponent(normalizedId)}/read`, {
            method: 'POST'
        });

        const current = Array.isArray(state.realtimeNotifications) ? state.realtimeNotifications : [];
        state.realtimeNotifications = current.map((item) => {
            const itemId = String(item?.id || item?.notificationId || '').trim();
            if (itemId !== normalizedId) return item;

            return {
                ...item,
                isRead: true,
                read: true,
                readAt: new Date().toISOString()
            };
        });

        if (rerender) {
            renderRealtimeNotifications(state.realtimeNotifications);
        } else {
            updateNotificationBadgeUi(state.realtimeNotifications);
        }
    } catch (error) {
        console.error('markRealtimeNotificationRead error:', error);
    }
}

async function markAllRealtimeNotificationsRead() {
    const state = getDashboardState();

    try {
        await academyAuthedFetch('/api/realtime/notifications/read-all', {
            method: 'POST'
        });

        const current = Array.isArray(state.realtimeNotifications) ? state.realtimeNotifications : [];
        state.realtimeNotifications = current.map((item) => ({
            ...item,
            isRead: true,
            read: true,
            readAt: new Date().toISOString()
        }));

        renderRealtimeNotifications(state.realtimeNotifications);
        showToast('All notifications marked as read.', 'success');
    } catch (error) {
        console.error('markAllRealtimeNotificationsRead error:', error);
        showToast(error.message || 'Failed to mark notifications as read.', 'error');
    }
}

if (notifBell && notifDropdown) {
    notifBell.addEventListener('click', async (e) => {
        if (e.target === markAllRead) return;
        if (e.target.closest('.notif-list li')) return;

        notifDropdown.classList.toggle('show');

        if (notifDropdown.classList.contains('show')) {
            await loadRealtimeNotifications(true);
        }
    });

    document.addEventListener('click', (e) => {
        if (!notifBell.contains(e.target)) {
            notifDropdown.classList.remove('show');
        }
    });

    if (markAllRead) {
        markAllRead.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await markAllRealtimeNotificationsRead();
        });
    }

    loadRealtimeNotifications(false);
}

const resourcesMenu = document.getElementById('yh-resources-menu');
const resourcesMenuBtn = document.getElementById('yh-resources-menu-btn');
const resourcesMenuPanel = document.getElementById('yh-resources-menu-panel');

if (resourcesMenu && resourcesMenuBtn && resourcesMenuPanel) {
    const closeResourcesMenu = () => {
        resourcesMenuPanel.classList.remove('show');
        resourcesMenuBtn.setAttribute('aria-expanded', 'false');
    };

    resourcesMenuBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const willOpen = !resourcesMenuPanel.classList.contains('show');
        resourcesMenuPanel.classList.toggle('show', willOpen);
        resourcesMenuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    resourcesMenuPanel.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
        if (!resourcesMenu.contains(event.target)) {
            closeResourcesMenu();
        }
    });
}

    const closeMiniProfileBtn = document.getElementById('close-mini-profile'); const miniProfileModal = document.getElementById('mini-profile-modal');
    if(closeMiniProfileBtn && miniProfileModal) { closeMiniProfileBtn.addEventListener('click', () => miniProfileModal.classList.add('hidden-step')); miniProfileModal.addEventListener('click', (e) => { if(e.target === miniProfileModal) miniProfileModal.classList.add('hidden-step'); }); }

    // ==========================================
    // INITIALIZATION RUNNER
    // ==========================================
if (getStoredUserValue('yh_user_loggedIn') === 'true') {
    const savedName = getStoredUserValue('yh_user_name', myName);
    const savedAvatar = getStoredUserValue('yh_user_avatar', '');
    const savedUsername = getStoredUserValue('yh_user_username', '');

    updateUserProfile(savedName, savedAvatar);

    const academyProfileUsername = document.getElementById('academy-profile-username');
    if (academyProfileUsername) {
        academyProfileUsername.innerText = savedUsername
            ? `@${String(savedUsername).replace(/^@+/, '')}`
            : '@yhmember';
    }

    persistKnownUser({
        name: savedName || myName,
        role: 'Hustler',
        avatarToken: savedAvatar ? `url(${savedAvatar})` : (savedName || myName).charAt(0).toUpperCase(),
        avatarBg: 'var(--neon-blue)'
    });

    if (typeof bindCommunicationsSearch === 'function') {
        bindCommunicationsSearch();
    }

    if (typeof renderDmModalDirectory === 'function') {
        renderDmModalDirectory('');
    }

    if (typeof renderPendingGroupMembers === 'function') {
        renderPendingGroupMembers();
    }

    if (typeof loadCustomRooms === 'function') {
        loadCustomRooms();
    }

    if (typeof loadBlueprintProgress === 'function') {
        loadBlueprintProgress();
    }

    if (typeof loadVoiceLounges === 'function') {
        loadVoiceLounges();
    }

    if (typeof loadVideoLounges === 'function') {
        loadVideoLounges();
    }

    if (typeof renderLeaderboard === 'function') {
        renderLeaderboard();
    }

    // Keep Vault loading lazy.
    // First live backend fetch now happens only when the Vault view is actually opened.

    if (typeof resolveAcademyAccessState === 'function') {
        resolveAcademyAccessState().catch(() => {});
    }

    if (typeof refreshAcademyMembershipStatus === 'function') {
        refreshAcademyMembershipStatus(true).catch(() => {});
    }
}

    // ==========================================
    // 🌌 YH UNIVERSE ACCESS & AI SCREENING LOGIC
    // ==========================================
const universeHubView = document.getElementById('universe-hub-view');
const academyWrapper = document.getElementById('academy-wrapper');
const leftSidebar = document.getElementById('academy-sidebar');
const rightSidebar = document.querySelector('.yh-right-sidebar');

function persistAcademyHome(homeData) {
    if (!homeData || typeof homeData !== 'object') return;
    localStorage.setItem('yh_academy_home', JSON.stringify(homeData));
}

function readAcademyHomeCache() {
    try {
        const raw = localStorage.getItem('yh_academy_home');
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function persistAcademyAccessState(unlocked, homeData = null) {
    if (unlocked) {
        localStorage.setItem('yh_academy_access', 'true');
        if (homeData && typeof homeData === 'object') {
            persistAcademyHome(homeData);
        }
        return true;
    }

    localStorage.removeItem('yh_academy_access');
    localStorage.removeItem('yh_academy_home');
    return false;
}

let academyAccessResolvePromise = null;

async function resolveAcademyAccessState(force = false) {
    const cached = readAcademyMembershipCache();
    return cached?.hasRoadmapAccess === true;
}

function buildAcademyMissionSignalSnapshot() {
    const cachedHome = readAcademyHomeCache() || {};
    const missions = Array.isArray(cachedHome?.missions) ? cachedHome.missions : [];

    return missions.reduce((summary, mission) => {
        const status = String(mission?.status || 'pending').trim().toLowerCase() || 'pending';

        summary.total += 1;

        if (status === 'completed') summary.completed += 1;
        else if (status === 'skipped') summary.skipped += 1;
        else if (status === 'stuck') summary.stuck += 1;
        else summary.pending += 1;

        return summary;
    }, {
        total: 0,
        completed: 0,
        skipped: 0,
        stuck: 0,
        pending: 0
    });
}

function applyAcademyHomeRuntimePatch(runtime = {}) {
    const cachedHome = readAcademyHomeCache() || {};
    const nextHome = {
        ...cachedHome
    };

    const cachedBehaviorProfile =
        cachedHome?.behaviorProfile && typeof cachedHome.behaviorProfile === 'object'
            ? cachedHome.behaviorProfile
            : null;

    const cachedPreviousBehaviorProfile =
        cachedHome?.previousBehaviorProfile && typeof cachedHome.previousBehaviorProfile === 'object'
            ? cachedHome.previousBehaviorProfile
            : null;

    if (runtime?.behaviorProfile && typeof runtime.behaviorProfile === 'object') {
        nextHome.previousBehaviorProfile = runtime?.previousBehaviorProfile || cachedBehaviorProfile || cachedPreviousBehaviorProfile || {};
        nextHome.behaviorProfile = runtime.behaviorProfile;
    }

    if (runtime?.plannerStats && typeof runtime.plannerStats === 'object') {
        nextHome.plannerStats = runtime.plannerStats;
    }

    if (runtime?.adaptivePlanning && typeof runtime.adaptivePlanning === 'object') {
        nextHome.adaptivePlanning = runtime.adaptivePlanning;
    }

    if (runtime?.todayProgress && typeof runtime.todayProgress === 'object') {
    nextHome.today = {
                ...(cachedHome.today || {}),
                missionsCompleted: runtime.missionsCompleted ?? cachedHome.today?.missionsCompleted ?? 0,
                missionsTotal: runtime.missionsTotal ?? cachedHome.today?.missionsTotal ?? 0,
                streak: runtime.streak ?? cachedHome.today?.streak ?? 0,
                readinessScore: runtime.readinessScore ?? cachedHome.today?.readinessScore ?? cachedHome.readinessScore ?? '--',
                lastCheckin: runtime.lastCheckin ?? cachedHome.today?.lastCheckin ?? null
            };
    }

    if (runtime?.missionId && Array.isArray(cachedHome.missions)) {
        const normalizedMissionId = String(runtime.missionId).trim();

        nextHome.missions = cachedHome.missions.map((mission) => {
            if (String(mission?.id || '').trim() !== normalizedMissionId) return mission;

            return {
                ...mission,
                status: String(runtime.status || mission.status || 'pending').trim().toLowerCase(),
                completionNote: runtime.note !== undefined
                    ? String(runtime.note || '')
                    : String(mission?.completionNote || '')
            };
        });
    }

    persistAcademyHome(nextHome);
    renderAcademyHome(nextHome);
    return nextHome;
}
/* shared academyAuthedFetch now comes from /js/yh-shared-runtime.js */

async function academyRefreshRoadmap() {
    try {
        showToast("Refreshing roadmap...", "success");
        const result = await academyAuthedFetch('/api/academy/roadmap/refresh', {
            method: 'POST',
            body: JSON.stringify({})
        });

        const nextHome = result.home || readAcademyHomeCache();
        if (nextHome) {
            persistAcademyHome(nextHome);
            renderAcademyHome(nextHome);
        }
        showToast("Roadmap refreshed.", "success");
    } catch (error) {
        showToast(error.message || "Roadmap refresh failed.", "error");
    }
}

async function academyUpdateMissionStatus(missionId, status, note = '') {
    try {
        const result = await academyAuthedFetch(`/api/academy/missions/${missionId}/status`, {
            method: 'POST',
            body: JSON.stringify({
                status,
                note
            })
        });

        applyAcademyHomeRuntimePatch({
            missionId,
            status,
            note,
            todayProgress: result?.todayProgress,
            behaviorProfile: result?.behaviorProfile,
            previousBehaviorProfile: result?.previousBehaviorProfile,
            plannerStats: result?.plannerStats,
            adaptivePlanning: result?.adaptivePlanning
        });

        await loadAcademyHome(true);
        showToast(`Mission marked as ${status}.`, "success");
    } catch (error) {
        showToast(error.message || "Mission update failed.", "error");
    }
}
async function academyCompleteMission(missionId) {
    try {
        const result = await academyAuthedFetch(`/api/academy/missions/${missionId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                completionNote: ''
            })
        });

        applyAcademyHomeRuntimePatch({
            missionId,
            status: 'completed',
            note: '',
            todayProgress: result?.todayProgress,
            behaviorProfile: result?.behaviorProfile,
            previousBehaviorProfile: result?.previousBehaviorProfile,
            plannerStats: result?.plannerStats,
            adaptivePlanning: result?.adaptivePlanning
        });

        await loadAcademyHome(true);
        showToast("Mission completed.", "success");
        return true;
    } catch (error) {
        showToast(error.message || "Mission completion failed.", "error");
        return false;
    }
}

let academyMissionActionState = {
    missionId: '',
    status: '',
    title: ''
};

function academyResetMissionActionModal() {
    academyMissionActionState = {
        missionId: '',
        status: '',
        title: ''
    };
    const titleEl = document.getElementById('academy-mission-action-title');
    const contextEl = document.getElementById('academy-mission-action-context');
    const labelEl = document.getElementById('academy-mission-action-label');
    const noteEl = document.getElementById('academy-mission-action-note');
    const submitBtn = document.getElementById('btn-submit-mission-action');

    if (titleEl) titleEl.innerText = 'Update Mission';
    if (contextEl) contextEl.innerText = 'Add a short note before updating this mission.';
    if (labelEl) labelEl.innerText = 'Note';
    if (noteEl) {
        noteEl.value = '';
        noteEl.placeholder = 'Write a short note.';
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.innerText = 'Save Update';
    }
}

function academyCloseMissionActionModal() {
    document.getElementById('academy-mission-action-modal')?.classList.add('hidden-step');
}

function academyOpenMissionActionModal(missionId, status, missionTitle = '') {
    academyResetMissionActionModal();

    academyMissionActionState = {
        missionId: String(missionId || '').trim(),
        status: String(status || '').trim().toLowerCase(),
        title: String(missionTitle || '').trim()
    };

    const titleEl = document.getElementById('academy-mission-action-title');
    const contextEl = document.getElementById('academy-mission-action-context');
    const labelEl = document.getElementById('academy-mission-action-label');
    const noteEl = document.getElementById('academy-mission-action-note');
    const submitBtn = document.getElementById('btn-submit-mission-action');
    const safeTitle = academyMissionActionState.title || 'this mission';

    if (academyMissionActionState.status === 'skipped') {
        if (titleEl) titleEl.innerText = 'Skip Mission';
        if (contextEl) contextEl.innerText = `Add a short reason for why you are skipping "${safeTitle}".`;
        if (labelEl) labelEl.innerText = 'Why are you skipping it?';
        if (noteEl) noteEl.placeholder = 'Example: This is not aligned with today’s priority, or I need to move it to tomorrow.';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.innerText = 'Skip Mission';
        }
    } else {
        if (titleEl) titleEl.innerText = 'Mark as Stuck';
        if (contextEl) contextEl.innerText = `Add a short reason for why you are stuck on "${safeTitle}".`;
        if (labelEl) labelEl.innerText = 'What is blocking you?';
        if (noteEl) noteEl.placeholder = 'Example: I am missing clarity, time, energy, or the next step.';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.innerText = 'Mark as Stuck';
        }
    }

    document.getElementById('academy-mission-action-modal')?.classList.remove('hidden-step');
}

async function academySubmitMissionAction(event) {
    event.preventDefault();

    const missionId = String(academyMissionActionState.missionId || '').trim();
    const status = String(academyMissionActionState.status || '').trim().toLowerCase();
    const noteEl = document.getElementById('academy-mission-action-note');
    const submitBtn = document.getElementById('btn-submit-mission-action');
    const note = String(noteEl?.value || '').trim();

    if (!missionId || !status) {
        showToast('Mission action is missing required data.', 'error');
        return;
    }

    if (!note) {
        showToast('Please add a short note before continuing.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-busy', 'true');
            submitBtn.innerText = status === 'skipped'
                ? 'Skipping...'
                : 'Marking as Stuck...';
        }

        await academyUpdateMissionStatus(missionId, status, note);
        academyCloseMissionActionModal();
    } catch (error) {
        showToast(error.message || 'Mission update failed.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.innerText = status === 'skipped'
                ? 'Skip Mission'
                : 'Mark as Stuck';
        }
    }
}

function academyDelay(ms = 0) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
}

function academySetCheckinButtonLabel(button, label) {
    if (!button) return;
    const labelNode = button.querySelector('.yh-btn-label');
    if (labelNode) {
        labelNode.textContent = String(label || '').trim();
        return;
    }
    button.textContent = String(label || '').trim();
}

function academySetCheckinStatus(message = '', tone = 'neutral') {
    const statusEl = document.getElementById('academy-checkin-status');
    if (!statusEl) return;

    const safeMessage = String(message || '').trim();
    statusEl.textContent = safeMessage;
    statusEl.classList.remove('is-hidden', 'is-neutral', 'is-loading', 'is-success', 'is-error');

    if (!safeMessage) {
        statusEl.classList.add('is-hidden');
        return;
    }

    if (tone === 'loading' || tone === 'success' || tone === 'error') {
        statusEl.classList.add(`is-${tone}`);
    } else {
        statusEl.classList.add('is-neutral');
    }
}

function academySetCheckinUiState(state = 'idle') {
    const modal = document.getElementById('academy-checkin-modal');
    const submitBtn = document.getElementById('btn-submit-checkin');
    const cancelBtn = document.getElementById('btn-cancel-checkin');
    const closeBtn = document.getElementById('close-checkin-modal');

    const normalizedState = String(state || 'idle').trim().toLowerCase();
    const isSaving = normalizedState === 'saving';
    const isSaved = normalizedState === 'saved';
    const isBusy = isSaving || isSaved;

    if (modal) {
        modal.classList.remove('is-saving', 'is-saved');
        if (isSaving) modal.classList.add('is-saving');
        if (isSaved) modal.classList.add('is-saved');
    }

    if (submitBtn) {
        const idleLabel = String(submitBtn.dataset.idleLabel || 'Save Check-In').trim();
        const loadingLabel = String(submitBtn.dataset.loadingLabel || 'Saving Check-In...').trim();
        const savedLabel = String(submitBtn.dataset.savedLabel || 'Saved ✓').trim();

        submitBtn.dataset.loading = isSaving ? 'true' : 'false';
        submitBtn.disabled = isBusy;
        submitBtn.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
        submitBtn.setAttribute('aria-busy', isSaving ? 'true' : 'false');
        submitBtn.style.pointerEvents = isBusy ? 'none' : '';

        if (isSaving) {
            academySetCheckinButtonLabel(submitBtn, loadingLabel);
        } else if (isSaved) {
            academySetCheckinButtonLabel(submitBtn, savedLabel);
        } else {
            academySetCheckinButtonLabel(submitBtn, idleLabel);
        }
    }

    if (cancelBtn) {
        cancelBtn.disabled = isBusy;
        cancelBtn.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
        cancelBtn.style.pointerEvents = isBusy ? 'none' : '';
    }

    if (closeBtn) {
        closeBtn.disabled = isBusy;
        closeBtn.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
        closeBtn.style.pointerEvents = isBusy ? 'none' : '';
    }

    if (isSaving) {
        academySetCheckinStatus('Saving your check-in...', 'loading');
    } else if (isSaved) {
        academySetCheckinStatus('Saved. Updating your Academy Home...', 'success');
    } else {
        academySetCheckinStatus('', 'neutral');
    }
}

function academyResetCheckinModal() {
    const form = document.getElementById('academy-checkin-form');
    if (form) form.reset();

    const energyInput = document.getElementById('academy-checkin-energy');
    const moodInput = document.getElementById('academy-checkin-mood');
    const submitBtn = document.getElementById('btn-submit-checkin');

    if (energyInput) energyInput.value = '7';
    if (moodInput) moodInput.value = '7';

    if (submitBtn) {
        submitBtn.dataset.idleLabel = submitBtn.dataset.idleLabel || 'Save Check-In';
        submitBtn.dataset.loadingLabel = submitBtn.dataset.loadingLabel || 'Saving Check-In...';
        submitBtn.dataset.savedLabel = submitBtn.dataset.savedLabel || 'Saved ✓';
    }

    academySetCheckinUiState('idle');
}

function academyCloseCheckinModal() {
    document.getElementById('academy-checkin-modal')?.classList.add('hidden-step');
}

function academyOpenCheckin() {
    academyResetCheckinModal();
    document.getElementById('academy-checkin-modal')?.classList.remove('hidden-step');
}

async function academySubmitCheckin(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('btn-submit-checkin');
    const energyInput = document.getElementById('academy-checkin-energy');
    const moodInput = document.getElementById('academy-checkin-mood');
    const completedInput = document.getElementById('academy-checkin-completed');
    const blockersInput = document.getElementById('academy-checkin-blockers');
    const focusInput = document.getElementById('academy-checkin-focus');

    if (submitBtn?.dataset?.loading === 'true') {
        return;
    }

    const energyScore = String(energyInput?.value || '').trim();
    const moodScore = String(moodInput?.value || '').trim();
    const completedSummary = String(completedInput?.value || '').trim();
    const blockerText = String(blockersInput?.value || '').trim();
    const tomorrowFocus = String(focusInput?.value || '').trim();

    if (!energyScore || !moodScore || !completedSummary || !tomorrowFocus) {
        showToast('Please complete the required check-in fields.', 'error');
        return;
    }

    let didSucceed = false;

    try {
        academySetCheckinUiState('saving');

        const result = await academyAuthedFetch('/api/academy/checkin', {
            method: 'POST',
            body: JSON.stringify({
                energyScore,
                moodScore,
                completedSummary,
                blockerText,
                tomorrowFocus,
                missionSignals: buildAcademyMissionSignalSnapshot()
            })
        });

        applyAcademyHomeRuntimePatch({
            behaviorProfile: result?.behaviorProfile,
            previousBehaviorProfile: result?.previousBehaviorProfile,
            plannerStats: result?.plannerStats,
            adaptivePlanning: result?.adaptivePlanning
        });

        didSucceed = true;
        academySetCheckinUiState('saved');

        await academyDelay(520);

        academyCloseCheckinModal();
        await loadAcademyHome(true);
        showToast('Check-in saved.', 'success');
    } catch (error) {
        academySetCheckinStatus(error.message || 'Check-in failed.', 'error');
        showToast(error.message || 'Check-in failed.', 'error');
    } finally {
        if (!didSucceed) {
            academySetCheckinUiState('idle');
        }
    }
}
function academyBehaviorTrendRank(mode, value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (mode === 'recovery-risk') {
        if (normalized === 'high') return 0;
        if (normalized === 'normal') return 1;
        if (normalized === 'low') return 2;
        return null;
    }

    if (mode === 'accountability-risk') {
        if (normalized === 'high') return 0;
        if (normalized === 'moderate') return 1;
        if (normalized === 'low') return 2;
        return null;
    }

    if (mode === 'pressure-response') {
        if (normalized === 'low') return 0;
        if (normalized === 'moderate') return 1;
        if (normalized === 'high') return 2;
        return null;
    }

    return null;
}

function academyGetTrendMeta(currentValue, previousValue, mode = 'ratio-good') {
    const neutral = {
        direction: 'stable',
        label: 'Stable',
        icon: '→',
        text: '#cbd5e1',
        border: 'rgba(148,163,184,0.22)',
        background: 'rgba(148,163,184,0.08)'
    };

    if (
        previousValue === null ||
        previousValue === undefined ||
        previousValue === '' ||
        (typeof previousValue === 'number' && !Number.isFinite(previousValue))
    ) {
        return null;
    }

    let score = 0;

    if (mode === 'ratio-good' || mode === 'ratio-risk' || mode === 'minutes-good') {
        const currentNum = Number(currentValue);
        const previousNum = Number(previousValue);

        if (!Number.isFinite(currentNum) || !Number.isFinite(previousNum)) {
            return null;
        }

        const delta = currentNum - previousNum;
        const threshold = mode === 'minutes-good' ? 5 : 0.05;

        if (Math.abs(delta) < threshold) {
            return neutral;
        }

        if (mode === 'ratio-good' || mode === 'minutes-good') {
            score = delta > 0 ? 1 : -1;
        } else {
            score = delta < 0 ? 1 : -1;
        }
    } else {
        const currentRank = academyBehaviorTrendRank(mode, currentValue);
        const previousRank = academyBehaviorTrendRank(mode, previousValue);

        if (currentRank === null || previousRank === null) {
            return null;
        }

        if (currentRank === previousRank) {
            return neutral;
        }

        score = currentRank > previousRank ? 1 : -1;
    }

    if (score > 0) {
        return {
            direction: 'improving',
            label: 'Improving',
            icon: '↗',
            text: '#86efac',
            border: 'rgba(34,197,94,0.25)',
            background: 'rgba(34,197,94,0.10)'
        };
    }

    return {
        direction: 'declining',
        label: 'Declining',
        icon: '↘',
        text: '#fca5a5',
        border: 'rgba(239,68,68,0.25)',
        background: 'rgba(239,68,68,0.10)'
    };
}
function renderAcademyHome(homeData = null) {
    const safeHtml = (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const prettyLabel = (value) => {
        return safeHtml(
            String(value || '')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase())
        );
    };

    const toNumberSafe = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const clampRatio = (value) => {
        const parsed = toNumberSafe(value, 0);
        return Math.max(0, Math.min(parsed, 1));
    };

    const buildTone = (kind, value) => {
        const normalized = String(value || '').trim().toLowerCase();
        const neutral = {
            text: '#cbd5e1',
            border: 'rgba(148,163,184,0.25)',
            background: 'rgba(148,163,184,0.08)'
        };

        if (kind === 'ratio-good') {
            const ratio = clampRatio(value);
            if (ratio >= 0.7) {
                return {
                    text: '#86efac',
                    border: 'rgba(34,197,94,0.35)',
                    background: 'rgba(34,197,94,0.12)'
                };
            }
            if (ratio >= 0.45) {
                return {
                    text: '#fcd34d',
                    border: 'rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.12)'
                };
            }
            return {
                text: '#fca5a5',
                border: 'rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.12)'
            };
        }

        if (kind === 'ratio-risk') {
            const ratio = clampRatio(value);
            if (ratio <= 0.35) {
                return {
                    text: '#86efac',
                    border: 'rgba(34,197,94,0.35)',
                    background: 'rgba(34,197,94,0.12)'
                };
            }
            if (ratio <= 0.6) {
                return {
                    text: '#fcd34d',
                    border: 'rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.12)'
                };
            }
            return {
                text: '#fca5a5',
                border: 'rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.12)'
            };
        }

        if (kind === 'recovery') {
            if (normalized === 'high') {
                return {
                    text: '#fca5a5',
                    border: 'rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.12)'
                };
            }
            if (normalized === 'normal' || normalized === 'low') {
                return {
                    text: '#86efac',
                    border: 'rgba(34,197,94,0.35)',
                    background: 'rgba(34,197,94,0.12)'
                };
            }
            return neutral;
        }

        if (kind === 'accountability') {
            if (normalized === 'high') {
                return {
                    text: '#93c5fd',
                    border: 'rgba(59,130,246,0.35)',
                    background: 'rgba(59,130,246,0.12)'
                };
            }
            if (normalized === 'moderate') {
                return {
                    text: '#fcd34d',
                    border: 'rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.12)'
                };
            }
            return neutral;
        }

        if (kind === 'pressure') {
            if (normalized === 'low') {
                return {
                    text: '#fca5a5',
                    border: 'rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.12)'
                };
            }
            if (normalized === 'moderate' || normalized === 'high') {
                return {
                    text: '#86efac',
                    border: 'rgba(34,197,94,0.35)',
                    background: 'rgba(34,197,94,0.12)'
                };
            }
            return neutral;
        }

        return neutral;
    };

    const renderMiniStatCard = (label, value, toneKind = 'neutral', trendMeta = null) => {
        const tone = buildTone(toneKind, value);

        return `
            <div style="padding:12px 14px;border-radius:14px;border:1px solid ${tone.border};background:${tone.background};">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                    <div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);">
                        ${safeHtml(label)}
                    </div>
                    ${trendMeta ? `
                        <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;border:1px solid ${trendMeta.border};background:${trendMeta.background};color:${trendMeta.text};font-size:0.72rem;font-weight:600;white-space:nowrap;">
                            ${safeHtml(trendMeta.icon)} ${safeHtml(trendMeta.label)}
                        </span>
                    ` : ''}
                </div>
                <div style="margin-top:8px;font-size:1.2rem;font-weight:700;color:${tone.text};">
                    ${safeHtml(value)}
                </div>
            </div>
        `;
    };

    const renderSignalPill = (label, value, toneKind = 'neutral', trendMeta = null) => {
        const tone = buildTone(toneKind, value);

        return `
            <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid ${tone.border};background:${tone.background};color:${tone.text};font-size:0.82rem;flex-wrap:wrap;">
                <strong style="font-weight:600;color:#fff;">${safeHtml(label)}:</strong>
                <span>${safeHtml(value)}</span>
                ${trendMeta ? `
                    <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;border:1px solid ${trendMeta.border};background:${trendMeta.background};color:${trendMeta.text};font-size:0.72rem;font-weight:600;">
                        ${safeHtml(trendMeta.icon)} ${safeHtml(trendMeta.label)}
                    </span>
                ` : ''}
            </span>
        `;
    };

    setAcademySidebarActive('nav-missions');

    const views = {
        'academy-feed-view': document.getElementById('academy-feed-view'),
        'academy-chat': document.getElementById('academy-chat'),
        'center-stage-view': document.getElementById('center-stage-view'),
        'announcements-view': document.getElementById('announcements-view'),
        'voice-lobby-view': document.getElementById('voice-lobby-view'),
        'video-lobby-view': document.getElementById('video-lobby-view'),
        'vault-view': document.getElementById('vault-view')
    };

    Object.values(views).forEach((view) => {
        if (view) view.classList.add('hidden-step');
    });
    if (views['academy-chat']) views['academy-chat'].classList.remove('hidden-step');

    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderTopic = document.getElementById('chat-header-topic');
    const chatWelcomeBox = document.getElementById('chat-welcome-box');
    const chatPinnedMessage = document.getElementById('chat-pinned-message');
    const chatInputArea = document.getElementById('chat-input-area');
    const dynamicChatContainer = document.getElementById('dynamic-chat-history');

    const roadmap = homeData?.roadmap || {};
    const summary = roadmap.summary || {};
    const focusAreas = Array.isArray(roadmap.focusAreas) ? roadmap.focusAreas : [];
    const today = homeData?.today || {};
    const missions = Array.isArray(homeData?.missions) ? homeData.missions : [];
    const weeklyCheckpoint = homeData?.weeklyCheckpoint || {};
    const behaviorProfile = homeData?.behaviorProfile && typeof homeData?.behaviorProfile === 'object'
        ? homeData.behaviorProfile
        : {};
    const previousBehaviorProfile = homeData?.previousBehaviorProfile && typeof homeData?.previousBehaviorProfile === 'object'
        ? homeData.previousBehaviorProfile
        : {};
    const plannerStats = homeData?.plannerStats && typeof homeData?.plannerStats === 'object'
        ? homeData.plannerStats
        : {};
    const adaptivePlanning = homeData?.adaptivePlanning && typeof homeData?.adaptivePlanning === 'object'
        ? homeData.adaptivePlanning
        : {};
    const createdByModel = safeHtml(homeData?.createdByModel || '');

    const readinessScore = toNumberSafe(roadmap.readinessScore, 0);
    const missionsCompleted = toNumberSafe(today.missionsCompleted, 0);
    const missionsTotal = toNumberSafe(today.missionsTotal, missions.length || 0);
    const streakDays = toNumberSafe(today.streakDays, 0);

    const executionReliability = clampRatio(behaviorProfile.executionReliability);
    const frictionSensitivity = clampRatio(behaviorProfile.frictionSensitivity);
    const maxSustainableDailyMinutes = toNumberSafe(behaviorProfile.maxSustainableDailyMinutes, 0);
    const bestExecutionWindow = String(behaviorProfile.bestExecutionWindow || '').trim();
    const accountabilityNeed = String(behaviorProfile.accountabilityNeed || '').trim();
    const recoveryRisk = String(behaviorProfile.recoveryRisk || '').trim();
    const pressureResponse = String(behaviorProfile.pressureResponse || '').trim();
    const preferredMissionTypes = Array.isArray(behaviorProfile.preferredMissionTypes)
        ? behaviorProfile.preferredMissionTypes
        : [];

    const executionReliabilityTrend = academyGetTrendMeta(
        executionReliability,
        previousBehaviorProfile.executionReliability,
        'ratio-good'
    );

    const frictionSensitivityTrend = academyGetTrendMeta(
        frictionSensitivity,
        previousBehaviorProfile.frictionSensitivity,
        'ratio-risk'
    );

    const sustainableLoadTrend = academyGetTrendMeta(
        maxSustainableDailyMinutes,
        previousBehaviorProfile.maxSustainableDailyMinutes,
        'minutes-good'
    );

    const recoveryRiskTrend = academyGetTrendMeta(
        recoveryRisk,
        previousBehaviorProfile.recoveryRisk,
        'recovery-risk'
    );

    const accountabilityTrend = academyGetTrendMeta(
        accountabilityNeed,
        previousBehaviorProfile.accountabilityNeed,
        'accountability-risk'
    );

    const pressureResponseTrend = academyGetTrendMeta(
        pressureResponse,
        previousBehaviorProfile.pressureResponse,
        'pressure-response'
    );

    const totalGeneratedMissions = toNumberSafe(plannerStats.totalGeneratedMissions, 0);
    const totalCompletedMissions = toNumberSafe(plannerStats.totalCompletedMissions, 0);
    const totalSkippedMissions = toNumberSafe(plannerStats.totalSkippedMissions, 0);
    const totalStuckMissions = toNumberSafe(plannerStats.totalStuckMissions, 0);
    const averageCompletionLagHours = toNumberSafe(plannerStats.averageCompletionLagHours, 0);
    const averageDifficultyScore = toNumberSafe(plannerStats.averageDifficultyScore, 0);
    const averageUsefulnessScore = toNumberSafe(plannerStats.averageUsefulnessScore, 0);
    const planningMode = prettyLabel(adaptivePlanning.mode || 'weekly_recalibration');
    const challengeLevel = prettyLabel(adaptivePlanning.challengeLevel || 'steady');
    const missionCountCap = toNumberSafe(adaptivePlanning.missionCountCap, 0);
    const dailyLoadCap = toNumberSafe(adaptivePlanning.dailyLoadCap, 0);
    const adaptationReason = safeHtml(
        adaptivePlanning.reason || 'The planner is still calibrating the right workload and challenge for this cycle.'
    );
    const adaptiveTrendSummary = adaptivePlanning.trendSummary && typeof adaptivePlanning.trendSummary === 'object'
        ? adaptivePlanning.trendSummary
        : {};
const normalizeRoadmapUiPillarKey = (value = '') => {
        const raw = String(value || '').trim().toLowerCase();
        const map = {
            money: 'wealth',
            wealth: 'wealth',
            business: 'wealth',
            'money, wealth & business': 'wealth',

            discipline: 'discipline',

            health: 'health',
            fitness: 'health',
            'fitness & health': 'health',

            mindset: 'mindset',
            psychology: 'mindset',
            'mindset & psychology': 'mindset',

            communication: 'communication',
            networking: 'communication',
            'communication & networking': 'communication',

            knowledge: 'knowledge',
            'knowledge for life': 'knowledge',

            politics: 'politics',
            politics_2030_agenda: 'politics',
            'politics & the 2030 agenda': 'politics',

            philosophy: 'philosophy'
        };
        return map[raw] || raw || 'general';
    };

    const getRoadmapPillarUiMeta = (value = '') => {
        const key = normalizeRoadmapUiPillarKey(value);

        const metaMap = {
            wealth: {
                key,
                label: 'Money, Wealth & Business',
                icon: '💸',
                background: 'rgba(34, 197, 94, 0.14)',
                border: 'rgba(34, 197, 94, 0.34)',
                text: '#86efac',
                summaryTitle: 'Roadmap Summary',
                primaryLabel: 'Primary Bottleneck',
                secondaryLabel: 'Secondary Bottleneck',
                opportunityLabel: 'Main Opportunity',
                weeklyLabel: 'Weekly Checkpoint',
                themeLabel: 'Theme',
                targetLabel: 'Target Outcome',
                missionPanelLabel: 'Today’s Missions',
                homeTopic: 'Wealth execution, missions, and AI feedback loop'
            },
            discipline: {
                key,
                label: 'Discipline',
                icon: '⏱️',
                background: 'rgba(148, 163, 184, 0.14)',
                border: 'rgba(148, 163, 184, 0.32)',
                text: '#cbd5e1',
                summaryTitle: 'Roadmap Summary',
                primaryLabel: 'Primary Bottleneck',
                secondaryLabel: 'Secondary Bottleneck',
                opportunityLabel: 'Main Opportunity',
                weeklyLabel: 'Weekly Checkpoint',
                themeLabel: 'Theme',
                targetLabel: 'Target Outcome',
                missionPanelLabel: 'Today’s Missions',
                homeTopic: 'Execution structure, missions, and AI feedback loop'
            },
            health: {
                key,
                label: 'Fitness & Health',
                icon: '💪',
                background: 'rgba(16, 185, 129, 0.14)',
                border: 'rgba(16, 185, 129, 0.34)',
                text: '#6ee7b7',
                summaryTitle: 'Health Roadmap Summary',
                primaryLabel: 'Health Bottleneck',
                secondaryLabel: 'Secondary Strain',
                opportunityLabel: 'Main Opportunity',
                weeklyLabel: 'Weekly Health Checkpoint',
                themeLabel: 'Training Theme',
                targetLabel: 'Health Target',
                missionPanelLabel: 'Today’s Health Missions',
                homeTopic: 'Health consistency, missions, and AI feedback loop'
            },
            mindset: {
                key,
                label: 'Mindset & Psychology',
                icon: '🧠',
                background: 'rgba(139, 92, 246, 0.14)',
                border: 'rgba(139, 92, 246, 0.32)',
                text: '#c4b5fd',
                summaryTitle: 'Mindset Summary',
                primaryLabel: 'Main Mental Bottleneck',
                secondaryLabel: 'Secondary Friction',
                opportunityLabel: 'Main Opportunity',
                weeklyLabel: 'Weekly Mindset Checkpoint',
                themeLabel: 'Mental Theme',
                targetLabel: 'Target Outcome',
                missionPanelLabel: 'Today’s Mindset Missions',
                homeTopic: 'Mindset work, missions, and AI feedback loop'
            },
            communication: {
                key,
                label: 'Communication & Networking',
                icon: '🗣️',
                background: 'rgba(59, 130, 246, 0.14)',
                border: 'rgba(59, 130, 246, 0.32)',
                text: '#93c5fd',
                summaryTitle: 'Communication Summary',
                primaryLabel: 'Main Social Bottleneck',
                secondaryLabel: 'Secondary Friction',
                opportunityLabel: 'Connection Opportunity',
                weeklyLabel: 'Weekly Communication Checkpoint',
                themeLabel: 'Communication Theme',
                targetLabel: 'Target Outcome',
                missionPanelLabel: 'Today’s Communication Missions',
                homeTopic: 'Communication growth, missions, and AI feedback loop'
            },
            knowledge: {
                key,
                label: 'Knowledge for Life',
                icon: '📚',
                background: 'rgba(245, 158, 11, 0.14)',
                border: 'rgba(245, 158, 11, 0.32)',
                text: '#fcd34d',
                summaryTitle: 'Knowledge Summary',
                primaryLabel: 'Main Knowledge Gap',
                secondaryLabel: 'Secondary Blind Spot',
                opportunityLabel: 'Main Learning Opportunity',
                weeklyLabel: 'Weekly Learning Checkpoint',
                themeLabel: 'Learning Theme',
                targetLabel: 'Learning Outcome',
                missionPanelLabel: 'Today’s Learning Missions',
                homeTopic: 'Learning depth, missions, and AI feedback loop'
            },
            politics: {
                key,
                label: 'Politics & the 2030 Agenda',
                icon: '🏛️',
                background: 'rgba(244, 63, 94, 0.14)',
                border: 'rgba(244, 63, 94, 0.34)',
                text: '#fda4af',
                summaryTitle: 'Political Clarity Summary',
                primaryLabel: 'Main Analysis Gap',
                secondaryLabel: 'Secondary Blind Spot',
                opportunityLabel: 'Main Strategic Opportunity',
                weeklyLabel: 'Weekly Political Focus',
                themeLabel: 'Political Theme',
                targetLabel: 'Political Outcome',
                missionPanelLabel: 'Today’s Political Missions',
                homeTopic: 'Political analysis, missions, and AI feedback loop'
            },
            philosophy: {
                key,
                label: 'Philosophy',
                icon: '🏺',
                background: 'rgba(168, 85, 247, 0.14)',
                border: 'rgba(168, 85, 247, 0.34)',
                text: '#d8b4fe',
                summaryTitle: 'Philosophical Clarity Summary',
                primaryLabel: 'Main Conceptual Gap',
                secondaryLabel: 'Secondary Tension',
                opportunityLabel: 'Main Perspective Opportunity',
                weeklyLabel: 'Weekly Reflection Track',
                themeLabel: 'Reflection Theme',
                targetLabel: 'Perspective Outcome',
                missionPanelLabel: 'Today’s Philosophy Missions',
                homeTopic: 'Reasoning, reflection, missions, and AI feedback loop'
            },
            general: {
                key: 'general',
                label: 'General',
                icon: '🧭',
                background: 'rgba(148, 163, 184, 0.14)',
                border: 'rgba(148, 163, 184, 0.32)',
                text: '#cbd5e1',
                summaryTitle: 'Roadmap Summary',
                primaryLabel: 'Primary Bottleneck',
                secondaryLabel: 'Secondary Bottleneck',
                opportunityLabel: 'Main Opportunity',
                weeklyLabel: 'Weekly Checkpoint',
                themeLabel: 'Theme',
                targetLabel: 'Target Outcome',
                missionPanelLabel: 'Today’s Missions',
                homeTopic: 'Roadmap, missions, and AI feedback loop'
            }
        };

        return metaMap[key] || metaMap.general;
    };

    const renderRoadmapPillarChip = (value = '') => {
        const meta = getRoadmapPillarUiMeta(value);

        return `
            <span
                class="academy-home-chip"
                style="
                    display:inline-flex;
                    align-items:center;
                    gap:8px;
                    padding:8px 12px;
                    border-radius:999px;
                    border:1px solid ${meta.border};
                    background:${meta.background};
                    color:${meta.text};
                    box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02);
                "
            >
                <span aria-hidden="true">${meta.icon}</span>
                <span>${safeHtml(meta.label)}</span>
            </span>
        `;
    };

const roadmapPrimaryPillarMeta = getRoadmapPillarUiMeta(focusAreas[0] || 'general');
    applyAcademyCoachPillarUi(roadmapPrimaryPillarMeta.key);

    const focusHtml = focusAreas.length
        ? focusAreas.map((item) => renderRoadmapPillarChip(item)).join('')
        : `<span class="academy-home-chip academy-home-chip-muted">No focus areas yet</span>`;

    const preferredMissionTypeHtml = preferredMissionTypes.length
        ? preferredMissionTypes
            .map((item) => renderSignalPill('Prefers', prettyLabel(item), 'neutral'))
            .join('')
        : renderSignalPill('Prefers', 'Still learning your style', 'neutral');

    const behaviorSignalsHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
            ${renderMiniStatCard(
                'Execution Reliability',
                `${Math.round(executionReliability * 100)}%`,
                'ratio-good',
                executionReliabilityTrend
            )}
            ${renderMiniStatCard(
                'Friction Sensitivity',
                `${Math.round(frictionSensitivity * 100)}%`,
                'ratio-risk',
                frictionSensitivityTrend
            )}
            ${renderMiniStatCard(
                'Sustainable Load',
                maxSustainableDailyMinutes > 0 ? `${maxSustainableDailyMinutes} mins` : 'Not learned yet',
                'neutral',
                sustainableLoadTrend
            )}
        </div>

        <div class="academy-home-chip-row" style="margin-top:12px;">
            ${renderSignalPill(
                'Recovery Risk',
                recoveryRisk ? prettyLabel(recoveryRisk) : 'Not learned yet',
                'recovery',
                recoveryRiskTrend
            )}
            ${renderSignalPill(
                'Accountability',
                accountabilityNeed ? prettyLabel(accountabilityNeed) : 'Not learned yet',
                'accountability',
                accountabilityTrend
            )}
            ${renderSignalPill(
                'Pressure Response',
                pressureResponse ? prettyLabel(pressureResponse) : 'Not learned yet',
                'pressure',
                pressureResponseTrend
            )}
            ${bestExecutionWindow
                ? renderSignalPill('Best Window', prettyLabel(bestExecutionWindow), 'neutral')
                : renderSignalPill('Best Window', 'Still learning', 'neutral')}
            ${preferredMissionTypeHtml}
        </div>
    `;

    const plannerSignalsHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
            ${renderMiniStatCard('Generated', totalGeneratedMissions, 'neutral')}
            ${renderMiniStatCard('Completed', totalCompletedMissions, 'ratio-good')}
            ${renderMiniStatCard('Skipped', totalSkippedMissions, totalSkippedMissions > 0 ? 'ratio-risk' : 'neutral')}
            ${renderMiniStatCard('Stuck', totalStuckMissions, totalStuckMissions > 0 ? 'ratio-risk' : 'neutral')}
        </div>

        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
            ${renderMiniStatCard('Avg Completion Lag', averageCompletionLagHours > 0 ? `${averageCompletionLagHours} hrs` : 'Not enough data', 'neutral')}
            ${renderMiniStatCard('Avg Difficulty', averageDifficultyScore > 0 ? `${averageDifficultyScore}/10` : 'Not enough data', 'neutral')}
            ${renderMiniStatCard('Avg Usefulness', averageUsefulnessScore > 0 ? `${averageUsefulnessScore}/10` : 'Not enough data', 'ratio-good')}
        </div>
    `;
    const adaptivePlanningHtml = `
        <section class="academy-home-panel">
            <div class="academy-home-panel-label">Adaptive Planner Engine</div>
            <div class="academy-home-panel-copy">
                <strong>Mode:</strong> ${planningMode}<br>
                <strong>Challenge:</strong> ${challengeLevel}<br>
                <strong>Mission Cap:</strong> ${missionCountCap > 0 ? safeHtml(missionCountCap) : 'Not learned yet'}<br>
                <strong>Daily Load Cap:</strong> ${dailyLoadCap > 0 ? `${safeHtml(dailyLoadCap)} mins` : 'Not learned yet'}
            </div>

            <div style="margin-top:12px;font-size:0.9rem;line-height:1.6;color:#d1d5db;">
                <strong style="color:#fff;">Why this cycle looks like this:</strong> ${adaptationReason}
            </div>

            <div class="academy-home-chip-row" style="margin-top:12px;">
                ${renderSignalPill('Reliability Trend', prettyLabel(adaptiveTrendSummary.executionReliability || 'stable'), 'neutral')}
                ${renderSignalPill('Friction Trend', prettyLabel(adaptiveTrendSummary.frictionSensitivity || 'stable'), 'neutral')}
                ${renderSignalPill('Recovery Trend', prettyLabel(adaptiveTrendSummary.recoveryRisk || 'stable'), 'neutral')}
                ${renderSignalPill('Accountability Trend', prettyLabel(adaptiveTrendSummary.accountabilityNeed || 'stable'), 'neutral')}
            </div>
        </section>
    `;
const missionsHtml = missions.length
        ? missions.map((mission, index) => {
            const missionId = safeHtml(mission.id || '');
            const pillarMeta = getRoadmapPillarUiMeta(mission.pillar || roadmapPrimaryPillarMeta.key);
            const pillar = safeHtml(pillarMeta.label);
            const pillarIcon = safeHtml(pillarMeta.icon);
            const title = safeHtml(mission.title || `Mission ${index + 1}`);
            const statusRaw = String(mission.status || 'pending').trim().toLowerCase();
            const status = safeHtml(statusRaw || 'pending');
            const dueDate = safeHtml(mission.dueDate || 'Not set');
            const estimatedMinutes = safeHtml(mission.estimatedMinutes || 0);
            const description = safeHtml(
                mission.description || 'Do the core action described by this mission and produce one concrete output.'
            );
            const doneLooksLike = safeHtml(
                mission.doneLooksLike || 'A concrete output is finished and ready to review, use, or submit.'
            );
            const whyItMatters = safeHtml(mission.whyItMatters || '');
            const isCompleted = statusRaw === 'completed';

            const statusMeta =
                statusRaw === 'completed'
                    ? {
                        color: '#22c55e',
                        border: 'rgba(34,197,94,0.35)',
                        background: 'rgba(34,197,94,0.12)',
                        label: 'Completed'
                    }
                    : statusRaw === 'skipped'
                    ? {
                        color: '#f59e0b',
                        border: 'rgba(245,158,11,0.35)',
                        background: 'rgba(245,158,11,0.12)',
                        label: 'Skipped'
                    }
                    : statusRaw === 'stuck'
                    ? {
                        color: '#ef4444',
                        border: 'rgba(239,68,68,0.35)',
                        background: 'rgba(239,68,68,0.12)',
                        label: 'Stuck'
                    }
                    : {
                        color: '#94a3b8',
                        border: 'rgba(148,163,184,0.28)',
                        background: 'rgba(148,163,184,0.10)',
                        label: 'Pending'
                    };

            const taskLabel = 'Task';
            const whatToDoLabel = 'What to do';
            const doneLooksLikeLabel = 'Done looks like';
            const whyLabel =
                pillarMeta.key === 'politics'
                    ? 'Why this matters politically'
                    : pillarMeta.key === 'philosophy'
                    ? 'Why this matters philosophically'
                    : 'Why this matters';

            return `
                <div style="
                    padding:14px 16px;
                    border-radius:16px;
                    background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025));
                    border:1px solid ${pillarMeta.border};
                    box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02);
                ">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                        <div style="min-width:0;flex:1;">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span
                                    style="
                                        display:inline-flex;
                                        align-items:center;
                                        gap:7px;
                                        padding:5px 10px;
                                        border-radius:999px;
                                        border:1px solid ${pillarMeta.border};
                                        background:${pillarMeta.background};
                                        color:${pillarMeta.text};
                                        font-size:0.76rem;
                                        letter-spacing:0.06em;
                                        text-transform:uppercase;
                                        font-weight:600;
                                    "
                                >
                                    <span aria-hidden="true">${pillarIcon}</span>
                                    <span>${pillar}</span>
                                </span>

                                <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">
                                    Mission ${index + 1}
                                </span>
                            </div>

                            <div style="margin-top:8px;font-size:1rem;font-weight:600;color:#fff;line-height:1.45;">
                                ${title}
                            </div>
                        </div>

                        <div
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:6px;
                                padding:6px 10px;
                                border-radius:999px;
                                border:1px solid ${statusMeta.border};
                                background:${statusMeta.background};
                                color:${statusMeta.color};
                                font-size:0.78rem;
                                font-weight:600;
                                text-transform:capitalize;
                            "
                        >
                            ${safeHtml(statusMeta.label)}
                        </div>
                    </div>

                    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                        <span
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:6px;
                                padding:6px 10px;
                                border-radius:999px;
                                border:1px solid rgba(255,255,255,0.08);
                                background:rgba(255,255,255,0.03);
                                color:var(--text-muted);
                                font-size:0.84rem;
                            "
                        >
                            📅 Due: ${dueDate}
                        </span>
                        <span
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:6px;
                                padding:6px 10px;
                                border-radius:999px;
                                border:1px solid rgba(255,255,255,0.08);
                                background:rgba(255,255,255,0.03);
                                color:var(--text-muted);
                                font-size:0.84rem;
                            "
                        >
                            ⏱️ ${estimatedMinutes} mins
                        </span>
                    </div>

                    <div style="margin-top:12px;display:grid;gap:10px;">
    <div style="
        padding:10px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.07);
        background:rgba(255,255,255,0.025);
        font-size:0.88rem;
        line-height:1.65;
        color:#d1d5db;
    ">
        <strong style="color:#fff;">${safeHtml(taskLabel)}:</strong> ${title}
    </div>

    <div style="
        padding:10px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.07);
        background:rgba(255,255,255,0.025);
        font-size:0.88rem;
        line-height:1.65;
        color:#d1d5db;
    ">
        <strong style="color:#fff;">${safeHtml(whatToDoLabel)}:</strong> ${description}
    </div>

    <div style="
        padding:10px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.07);
        background:rgba(255,255,255,0.025);
        font-size:0.88rem;
        line-height:1.65;
        color:#d1d5db;
    ">
        <strong style="color:#fff;">${safeHtml(doneLooksLikeLabel)}:</strong> ${doneLooksLike}
    </div>

        ${whyItMatters ? `
            <div style="
                padding:10px 12px;
                border-radius:12px;
                border:1px solid rgba(255,255,255,0.07);
                background:rgba(255,255,255,0.025);
                font-size:0.88rem;
                line-height:1.65;
                color:#d1d5db;
            ">
                <strong style="color:#fff;">${safeHtml(whyLabel)}:</strong> ${whyItMatters}
            </div>
        ` : ''}
    </div>

                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" data-academy-action="complete" data-mission-id="${missionId}" data-mission-title="${title}" class="btn-primary" style="width:auto;padding:8px 12px;" ${isCompleted ? 'disabled' : ''}>Complete</button>
                        <button type="button" data-academy-action="skip" data-mission-id="${missionId}" data-mission-title="${title}" class="btn-secondary" style="width:auto;padding:8px 12px;">Skip</button>
                        <button type="button" data-academy-action="stuck" data-mission-id="${missionId}" data-mission-title="${title}" class="btn-secondary" style="width:auto;padding:8px 12px;">Stuck</button>
                    </div>
                </div>
            `;
        }).join('')
        : `
            <div style="padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);">
                No missions loaded yet. Refresh the roadmap to generate a new plan.
            </div>
        `;

    if (chatHeaderIcon) chatHeaderIcon.innerHTML = `🧠`;
    if (chatHeaderTitle) chatHeaderTitle.innerText = "Academy Home";
    if (chatHeaderTopic) chatHeaderTopic.innerText = roadmapPrimaryPillarMeta.homeTopic;
    if (chatPinnedMessage) chatPinnedMessage.style.display = "none";
    if (typeof chatInputArea !== 'undefined' && chatInputArea) {
    chatInputArea.style.display = "none";
    }

    if (chatWelcomeBox) {
        chatWelcomeBox.style.display = "block";
        chatWelcomeBox.innerHTML = `
            <section class="academy-home-hero">
                <div class="academy-home-hero-copy">
                    <div class="academy-home-eyebrow">Academy Home</div>
                    <h2 class="academy-home-title">Welcome back, ${safeHtml(myName)}</h2>
                    <p class="academy-home-copy">
                        This is your roadmap-first Academy landing. Act on missions, send check-ins, and watch how the AI adjusts to your execution pattern.
                    </p>
                </div>

                <div class="academy-home-actions">
                    <button id="academy-home-refresh-roadmap" type="button" class="btn-primary academy-home-action-btn">Refresh Roadmap</button>
                    <button id="academy-home-open-checkin" type="button" class="btn-secondary academy-home-action-btn">Daily Check-In</button>
                    <button id="academy-home-open-coach" type="button" class="btn-secondary academy-home-action-btn">Ask AI Coach</button>
                    <button id="academy-home-enter-chat" type="button" class="btn-secondary academy-home-action-btn">Open Community</button>
                </div>
            </section>

            <section class="academy-home-stats">
                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">Readiness</div>
                    <div class="academy-home-stat-value">${readinessScore ? safeHtml(readinessScore) : '—'}<span> / 100</span></div>
                </div>

                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">Completed</div>
                    <div class="academy-home-stat-value">${safeHtml(missionsCompleted)}<span> / ${safeHtml(missionsTotal)}</span></div>
                </div>

                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">7-Day Streak</div>
                    <div class="academy-home-stat-value">${safeHtml(streakDays)}</div>
                </div>

                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">Sustainable Load</div>
                    <div class="academy-home-stat-value">${maxSustainableDailyMinutes > 0 ? safeHtml(maxSustainableDailyMinutes) : '—'}<span>${maxSustainableDailyMinutes > 0 ? ' mins' : ''}</span></div>
                </div>
            </section>
        `;
    }

if (dynamicChatContainer) {
        dynamicChatContainer.innerHTML = `
            <div class="academy-home-stack">
                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">${safeHtml(roadmapPrimaryPillarMeta.summaryTitle)}</div>
                    <div class="academy-home-panel-copy">
                        <strong>${safeHtml(roadmapPrimaryPillarMeta.primaryLabel)}:</strong> ${safeHtml(summary.primaryBottleneck || 'Not available')}<br>
                        <strong>${safeHtml(roadmapPrimaryPillarMeta.secondaryLabel)}:</strong> ${safeHtml(summary.secondaryBottleneck || 'Not available')}<br>
                        <strong>${safeHtml(roadmapPrimaryPillarMeta.opportunityLabel)}:</strong> ${safeHtml(summary.mainOpportunity || 'Not available')}
                    </div>
                </section>

                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">Focus Areas</div>
                    <div class="academy-home-chip-row">
                        ${focusHtml}
                    </div>
                </section>

                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">${safeHtml(roadmapPrimaryPillarMeta.weeklyLabel)}</div>
                    <div class="academy-home-panel-copy">
                        <strong>${safeHtml(roadmapPrimaryPillarMeta.themeLabel)}:</strong> ${safeHtml(weeklyCheckpoint.theme || 'Not available')}<br>
                        <strong>${safeHtml(roadmapPrimaryPillarMeta.targetLabel)}:</strong> ${safeHtml(weeklyCheckpoint.targetOutcome || 'Not available')}
                    </div>
                </section>

                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">Behavior Signals</div>
                    ${behaviorSignalsHtml}
                </section>

                <section class="academy-home-panel">
                <div class="academy-home-panel-label">Planner Intelligence</div>
                ${plannerSignalsHtml}
            </section>

            ${adaptivePlanningHtml}

            <section class="academy-home-panel">
                <div class="academy-home-panel-label">${safeHtml(roadmapPrimaryPillarMeta.missionPanelLabel)}</div>
                <div class="academy-home-missions">
                    ${missionsHtml}
                </div>
            </section>
            </div>
        `;
    }

    document.getElementById('academy-home-enter-chat')?.addEventListener('click', () => {
        document.getElementById('nav-chat')?.click();
    });

    document.getElementById('academy-home-open-voice')?.addEventListener('click', () => {
        document.getElementById('nav-voice')?.click();
    });

    document.getElementById('academy-home-refresh-roadmap')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;

        await runDashboardButtonAction(button, 'Refreshing Roadmap...', async () => {
            await academyRefreshRoadmap();
        });
    });

    document.getElementById('academy-home-open-checkin')?.addEventListener('click', () => {
        academyOpenCheckin();
    });

    document.getElementById('academy-home-open-coach')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;

        await runDashboardButtonAction(button, 'Opening AI Coach...', async () => {
            await openAcademyCoachView(true);
        });
    });

document.querySelectorAll('[data-academy-action="complete"]').forEach((button) => {
    button.addEventListener('click', async () => {
        const missionId = String(button.getAttribute('data-mission-id') || '').trim();
        if (!missionId) return;

        const ok = await runDashboardButtonAction(button, 'Completing...', async () => {
            return await academyCompleteMission(missionId);
        });

        // If success, permanently lock the button so user sees it's synced
        if (ok && button && button.isConnected) {
            button.dataset.loading = 'false';
            button.dataset.idleLabel = 'Completed';
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
            button.setAttribute('aria-busy', 'false');
            button.textContent = 'Completed';
        }
    });
});

document.querySelectorAll('[data-academy-action="skip"]').forEach((button) => {
    button.addEventListener('click', () => {
        if (button?.dataset?.loading === 'true') return;

        const missionId = String(button.getAttribute('data-mission-id') || '').trim();
        const missionTitle = String(button.getAttribute('data-mission-title') || '').trim();
        if (!missionId) return;

        setDashboardButtonLoadingState(button, true, 'Opening...');
        academyOpenMissionActionModal(missionId, 'skipped', missionTitle);

        window.setTimeout(() => {
            if (button.isConnected) setDashboardButtonLoadingState(button, false);
        }, 260);
    });
});

document.querySelectorAll('[data-academy-action="stuck"]').forEach((button) => {
    button.addEventListener('click', () => {
        if (button?.dataset?.loading === 'true') return;

        const missionId = String(button.getAttribute('data-mission-id') || '').trim();
        const missionTitle = String(button.getAttribute('data-mission-title') || '').trim();
        if (!missionId) return;

        setDashboardButtonLoadingState(button, true, 'Opening...');
        academyOpenMissionActionModal(missionId, 'stuck', missionTitle);

        window.setTimeout(() => {
            if (button.isConnected) setDashboardButtonLoadingState(button, false);
        }, 260);
    });
});

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    if (views['academy-chat']) {
        views['academy-chat'].classList.remove('fade-in');
        void views['academy-chat'].offsetWidth;
        views['academy-chat'].classList.add('fade-in');
    }
}
function academyFeedEscapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeAcademyFeedId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function getAcademyHiddenPostsStorageKey() {
    const username = String(getStoredUserValue('yh_user_username', '') || '').trim().toLowerCase();
    const email = String(getStoredUserValue('yh_user_email', '') || '').trim().toLowerCase();
    const fallbackName = String(getStoredUserValue('yh_user_name', 'guest') || 'guest').trim().toLowerCase();
    const scopeKey = username || email || fallbackName || 'guest';
    return `yh_academy_hidden_posts::${scopeKey}`;
}

function readAcademyHiddenPostIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(getAcademyHiddenPostsStorageKey()) || '[]');
        return Array.isArray(parsed)
            ? parsed.map((item) => normalizeAcademyFeedId(item)).filter(Boolean)
            : [];
    } catch (_) {
        return [];
    }
}

function writeAcademyHiddenPostIds(ids = []) {
    const normalized = Array.from(new Set(
        (Array.isArray(ids) ? ids : [])
            .map((item) => normalizeAcademyFeedId(item))
            .filter(Boolean)
    ));

    localStorage.setItem(getAcademyHiddenPostsStorageKey(), JSON.stringify(normalized));
    return normalized;
}

function academyFeedTimeLabel(value) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString();
}

function hideAcademyViewsForFeed() {
    [
        'academy-feed-view',
        'academy-chat',
        'academy-profile-view',
        'center-stage-view',
        'announcements-view',
        'voice-lobby-view',
        'video-lobby-view',
        'vault-view'
    ].forEach((id) => {
        document.getElementById(id)?.classList.add('hidden-step');
    });
}

function showAcademyRoadmapLoadingShell() {
    closeRoadmapIntake();
    academyResetCoachMode();
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-missions');
    academySetMessagesChatMode('home');

    const academyChat = document.getElementById('academy-chat');
    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderTopic = document.getElementById('chat-header-topic');
    const chatWelcomeBox = document.getElementById('chat-welcome-box');
    const chatPinnedMessage = document.getElementById('chat-pinned-message');
    const dynamicChatContainer = document.getElementById('dynamic-chat-history');

    if (academyChat) {
        academyChat.classList.remove('hidden-step');
        academyChat.classList.remove('fade-in');
    }

    if (chatHeaderIcon) chatHeaderIcon.innerHTML = '🧠';
    if (chatHeaderTitle) chatHeaderTitle.innerText = 'Academy Home';
    if (chatHeaderTopic) chatHeaderTopic.innerText = 'Loading your roadmap, missions, and access state.';
    if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
    if (chatPinnedMessage) chatPinnedMessage.style.display = 'none';

    if (dynamicChatContainer) {
        dynamicChatContainer.innerHTML = `
            <div class="academy-home-stack">
                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">Roadmap</div>
                    <div class="academy-home-panel-copy">
                        Loading your Academy roadmap view...
                    </div>
                </section>
            </div>
        `;
    }

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;
}

function openAcademyFeedView(forceReload = false) {
    showAcademyTabLoader('Loading Community Feed.');
    closeRoadmapIntake();
    academyResetCoachMode();
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-chat');
    saveAcademyViewState('messages');
    applyAcademyMessengerMode(false);

    const feedView = document.getElementById('academy-feed-view');
    if (feedView) {
        feedView.classList.remove('hidden-step');
        feedView.classList.remove('fade-in');
        void feedView.offsetWidth;
        feedView.classList.add('fade-in');
    }

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    Promise.resolve(loadAcademyFeed(forceReload))
        .catch((error) => {
            console.error('loadAcademyFeed error:', error);
            showToast(error?.message || 'Failed to load Academy feed.', 'error');
        })
        .finally(() => {
            hideAcademyTabLoader();
        });
}
function openAcademyMessagesView() {
    showAcademyTabLoader('Loading Messages.');
    closeRoadmapIntake();
    academyResetCoachMode();
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-messages');
    saveAcademyViewState('messages');
    applyAcademyMessengerMode(true);

    const academyChat = document.getElementById('academy-chat');
    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderTopic = document.getElementById('chat-header-topic');
    const chatWelcomeBox = document.getElementById('chat-welcome-box');
    const chatPinnedMessage = document.getElementById('chat-pinned-message');
    const chatInputArea = document.getElementById('chat-input-area');
    const chatInputBox = document.getElementById('chat-input');

    if (academyChat) {
        academyChat.classList.remove('hidden-step');
        academyChat.classList.remove('fade-in');
        void academyChat.offsetWidth;
        academyChat.classList.add('fade-in');
    }

    if (chatHeaderIcon) chatHeaderIcon.innerHTML = '💬';
    if (chatHeaderTitle) chatHeaderTitle.innerText = 'Messages';
    if (chatHeaderTopic) chatHeaderTopic.innerText = 'Open direct messages, continue group chats, and keep each conversation in its own inbox thread.';
    if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
    if (chatPinnedMessage) chatPinnedMessage.style.display = 'none';

    academyResetMessagesThreadState();

    academySetMessagesChatMode('messages');
    renderAcademyMessagesInboxList();

    academyHydrateMessageRooms(!academyMessagesInboxState.hydratedOnce).catch((error) => {
        showToast(error?.message || 'Failed to load conversations.', 'error');
    });

    const rooms = academyReadMessageRooms();
    if (rooms.length) {
        academyRenderMessagesThreadEmpty('Select a conversation from the inbox to open that private thread.');
    } else {
        academyRenderMessagesThreadEmpty('No conversations yet. Start a DM or create a group to see it here.');
    }

    hideAcademyTabLoader();
}
function openAcademyRoadmapView(forceFresh = false) {
    showAcademyTabLoader('Loading Roadmap.');
    academyResetCoachMode();
    hideAcademyViewsForFeed();
    saveAcademyViewState('home');
    applyAcademyMessengerMode(false);
    academySetMessagesChatMode('home');

    const academyChat = document.getElementById('academy-chat');
    if (academyChat) {
        academyChat.classList.remove('hidden-step');
        academyChat.classList.remove('fade-in');
        void academyChat.offsetWidth;
        academyChat.classList.add('fade-in');
    }

    setAcademySidebarActive('nav-missions');

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    Promise.resolve(loadAcademyHome(forceFresh))
        .catch((error) => {
            console.error('loadAcademyHome error:', error);
            showToast(error?.message || 'Failed to load roadmap.', 'error');
        })
        .finally(() => {
            hideAcademyTabLoader();
        });
}

let academyProfileViewState = {
    mode: 'self',
    memberId: '',
    profile: null
};

let academyProfileEditorState = {
    bound: false,
    cropperBound: false,
    tempAvatarData: '',
    tempCoverData: '',
    tempAvatarBlob: null,
    tempCoverBlob: null,
    tempAvatarUploadName: '',
    tempCoverUploadName: '',
    cropper: {
        kind: '',
        objectUrl: '',
        naturalWidth: 0,
        naturalHeight: 0,
        scale: 1,
        minScale: 1,
        maxScale: 4,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        pointerId: null,
        dragStartX: 0,
        dragStartY: 0,
        startOffsetX: 0,
        startOffsetY: 0
    }
};

const ACADEMY_PROFILE_CACHE_KEY = 'yh_academy_profile_cache_v1';

function academyNormalizeProfileAssetUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (
        /^https?:\/\//i.test(raw) ||
        /^data:/i.test(raw) ||
        /^blob:/i.test(raw)
    ) {
        return raw;
    }

    if (raw.startsWith('/uploads/academy/profile/')) {
        return raw.replace('/uploads/academy/profile/', '/uploads/academy-profile/');
    }

    if (raw.startsWith('/')) {
        return raw;
    }

    if (/^[a-z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/i.test(raw)) {
        return `/uploads/academy-profile/${raw}`;
    }

    return raw;
}

function readAcademyProfileCache() {
    try {
        const parsed = JSON.parse(localStorage.getItem(ACADEMY_PROFILE_CACHE_KEY) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function persistAcademyProfileCache(profile = null) {
    if (!profile || typeof profile !== 'object') {
        localStorage.removeItem(ACADEMY_PROFILE_CACHE_KEY);
        return null;
    }

    const normalized = {
        id: String(profile.id || '').trim(),
        full_name: String(
            profile.full_name ||
            profile.fullName ||
            profile.display_name ||
            profile.displayName ||
            ''
        ).trim(),
        display_name: String(profile.display_name || profile.displayName || '').trim(),
        username: String(profile.username || '').trim().replace(/^@/, ''),
        avatar: academyNormalizeProfileAssetUrl(profile.avatar || ''),
        cover_photo: academyNormalizeProfileAssetUrl(profile.cover_photo || profile.coverPhoto || ''),
        role_label: String(profile.role_label || profile.roleLabel || 'Academy Member').trim(),
        bio: String(profile.bio || '').trim(),
        search_tags: Array.isArray(profile.search_tags)
            ? profile.search_tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 8)
            : []
    };

    localStorage.setItem(ACADEMY_PROFILE_CACHE_KEY, JSON.stringify(normalized));
    return normalized;
}
function academyResolveMemberAvatarUrl(member = {}) {
    const directAvatar = academyNormalizeProfileAssetUrl(
        member.avatar ||
        member.avatarUrl ||
        member.profilePhoto ||
        member.photoURL ||
        ''
    );

    if (directAvatar) return directAvatar;

    const memberId = normalizeAcademyFeedId(member.id || member.user_id || member.uid || '');
    if (memberId && typeof readKnownUsersCache === 'function') {
        const cache = readKnownUsersCache();
        const known = cache && typeof cache === 'object' ? cache[memberId] : null;

        const knownAvatar = academyNormalizeProfileAssetUrl(
            known?.avatar ||
            known?.avatarUrl ||
            known?.profilePhoto ||
            known?.photoURL ||
            ''
        );

        if (knownAvatar) return knownAvatar;
    }

    return '';
}
function syncAcademyProfileLocalMirrors(profile = null) {
    if (!profile || typeof profile !== 'object') return null;

    const displayName =
        String(profile.display_name || profile.displayName || '').trim() ||
        'Hustler';

    const username =
        sanitizeAcademyProfileUsername(
            profile.username || displayName.toLowerCase().replace(/\s+/g, ''),
            displayName
        );

    const avatar = academyNormalizeProfileAssetUrl(
        profile.avatar ||
        profile.profilePhoto ||
        profile.photoURL ||
        getStoredUserValue('yh_user_avatar', '')
    );

    const coverPhoto = academyNormalizeProfileAssetUrl(
        profile.cover_photo ||
        profile.coverPhoto ||
        getAcademyProfileStoredCover()
    );

    const bio =
        String(profile.bio || '').trim() ||
        'Focused on execution, consistency, and long-term growth inside The Academy.';

    const tags = Array.isArray(profile.search_tags)
        ? profile.search_tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 8)
        : Array.isArray(profile.searchTags)
            ? profile.searchTags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 8)
            : [];

    const userId =
        normalizeAcademyFeedId(
            profile.id ||
            profile.user_id ||
            getStoredUserValue('yh_user_id', '') ||
            getStoredUserValue('yh_user_uid', '')
        ) || '';

    localStorage.setItem('yh_user_name', displayName);
    localStorage.setItem('yh_user_username', username);
    localStorage.setItem('yh_user_profile_bio', bio);

    if (avatar) {
        localStorage.setItem('yh_user_avatar', avatar);
    } else {
        localStorage.removeItem('yh_user_avatar');
    }

    if (coverPhoto) {
        localStorage.setItem('yh_user_cover', coverPhoto);
    } else {
        localStorage.removeItem('yh_user_cover');
    }

    writeAcademyProfileTags(tags);

    if (typeof updateUserProfile === 'function') {
        updateUserProfile(displayName, avatar || '');
    }

    if (typeof persistKnownUser === 'function') {
        persistKnownUser({
            id: userId,
            userId,
            uid: userId,
            firebaseUid: userId,
            name: displayName,
            displayName,
            username,
            avatar,
            avatarUrl: avatar,
            photoURL: avatar,
            profilePhoto: avatar
        });
    }

    return persistAcademyProfileCache({
        ...(profile && typeof profile === 'object' ? profile : {}),
        id: userId || String(profile.id || '').trim(),
        display_name: displayName,
        username,
        avatar,
        cover_photo: coverPhoto,
        bio,
        search_tags: tags
    });
}

async function fetchCurrentAcademyProfile(options = {}) {
    const allowCachedFallback = options.allowCachedFallback !== false;
    const cachedProfile = readAcademyProfileCache();

    try {
        const result = await academyAuthedFetch('/api/academy/profile', {
            method: 'GET'
        });

        const profile =
            result?.profile && typeof result.profile === 'object'
                ? result.profile
                : null;

        if (!profile) {
            throw new Error('Profile payload was empty.');
        }

        syncAcademyProfileLocalMirrors(profile);
        return profile;
    } catch (error) {
        if (allowCachedFallback && cachedProfile) {
            return cachedProfile;
        }
        throw error;
    }
}

function readAcademyProfileTags() {
    try {
        const parsed = JSON.parse(localStorage.getItem('yh_user_profile_tags') || '[]');
        return Array.isArray(parsed)
            ? parsed.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];
    } catch (_) {
        return [];
    }
}

function writeAcademyProfileTags(tags = []) {
    const normalized = Array.from(new Set(
        (Array.isArray(tags) ? tags : [])
            .map((tag) => String(tag || '').trim().replace(/^#/, ''))
            .filter(Boolean)
    )).slice(0, 8);

    localStorage.setItem('yh_user_profile_tags', JSON.stringify(normalized));
    return normalized;
}

function getAcademyProfileStoredBio() {
    return String(getStoredUserValue('yh_user_profile_bio', '')).trim();
}

function getAcademyProfileStoredCover() {
    return String(getStoredUserValue('yh_user_cover', '')).trim();
}

function sanitizeAcademyProfileUsername(value = '') {
    const cleaned = String(value || '')
        .trim()
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '');

    return cleaned.slice(0, 32);
}

function updateAcademyProfileEditorPreviewAvatar(value = '', displayName = 'Hustler') {
    const avatarPreview = document.getElementById('academy-profile-editor-avatar-preview');
    if (!avatarPreview) return;

    if (value) {
        avatarPreview.innerText = '';
        avatarPreview.style.backgroundImage = `url(${value})`;
        avatarPreview.style.backgroundSize = 'cover';
        avatarPreview.style.backgroundPosition = 'center';
    } else {
        avatarPreview.style.backgroundImage = 'none';
        avatarPreview.innerText = String(displayName || 'H').trim().charAt(0).toUpperCase() || 'H';
    }
}

function updateAcademyProfileEditorPreviewCover(value = '') {
    const coverPreview = document.getElementById('academy-profile-editor-cover-preview');
    if (!coverPreview) return;

    if (value) {
        coverPreview.style.backgroundImage = `url(${value})`;
        coverPreview.style.backgroundSize = 'cover';
        coverPreview.style.backgroundPosition = 'center';
    } else {
        coverPreview.style.backgroundImage = 'none';
    }
}

function academyProfileRevokeObjectUrl(value = '') {
    const url = String(value || '').trim();
    if (!url || !/^blob:/i.test(url)) return;

    try {
        URL.revokeObjectURL(url);
    } catch (_) {}
}

function academyProfileBuildUploadName(kind = 'avatar', sourceName = '') {
    const rawName = String(sourceName || `${kind}.jpg`).trim() || `${kind}.jpg`;
    const normalized = rawName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (/\.(jpg|jpeg|png|webp)$/i.test(normalized)) {
        return normalized;
    }

    const baseName = normalized.replace(/\.+$/g, '') || kind;
    return `${baseName}.jpg`;
}

function academyProfileSetTempAsset(kind = 'avatar', options = {}) {
    const previewUrl = String(options.previewUrl || '').trim();
    const blob = options.blob instanceof Blob ? options.blob : null;
    const uploadName = String(options.uploadName || '').trim();

    if (kind === 'cover') {
        if (academyProfileEditorState.tempCoverData && academyProfileEditorState.tempCoverData !== previewUrl) {
            academyProfileRevokeObjectUrl(academyProfileEditorState.tempCoverData);
        }

        academyProfileEditorState.tempCoverData = previewUrl;
        academyProfileEditorState.tempCoverBlob = blob;
        academyProfileEditorState.tempCoverUploadName = uploadName;
        return;
    }

    if (academyProfileEditorState.tempAvatarData && academyProfileEditorState.tempAvatarData !== previewUrl) {
        academyProfileRevokeObjectUrl(academyProfileEditorState.tempAvatarData);
    }

    academyProfileEditorState.tempAvatarData = previewUrl;
    academyProfileEditorState.tempAvatarBlob = blob;
    academyProfileEditorState.tempAvatarUploadName = uploadName;
}

async function academyProfileUploadAsset(blob, originalName = 'profile.jpg', assetKind = 'avatar') {
    if (!(blob instanceof Blob)) {
        throw new Error('Missing cropped image data.');
    }

    const token = getStoredAuthToken();
    const mimeType = String(blob.type || 'image/jpeg').trim() || 'image/jpeg';

    const response = await fetch('/api/academy/profile/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': mimeType,
            'X-File-Name': encodeURIComponent(academyProfileBuildUploadName(assetKind, originalName)),
            'X-File-Mime': mimeType,
            'X-Asset-Kind': assetKind
        },
        body: blob
    });

    const responseType = String(response.headers.get('content-type') || '').toLowerCase();

    let result = {};
    if (responseType.includes('application/json')) {
        result = await response.json().catch(() => ({}));
    } else {
        const text = await response.text().catch(() => '');
        result = {
            success: false,
            message: text || 'Upload failed.'
        };
    }

    if (response.status === 401) {
        showToast('Your session expired. Please log in again.', 'error');
        window.location.href = '/';
        throw new Error(result.message || 'Session expired.');
    }

    if (!response.ok || result?.success === false || !result?.media?.url) {
        throw new Error(result?.message || 'Failed to upload profile image.');
    }

    return result.media;
}

function academyProfileGetCropperElements() {
    return {
        overlay: document.getElementById('academy-profile-cropper-overlay'),
        stage: document.getElementById('academy-profile-cropper-stage'),
        image: document.getElementById('academy-profile-cropper-image'),
        zoom: document.getElementById('academy-profile-cropper-zoom'),
        note: document.getElementById('academy-profile-cropper-note'),
        title: document.getElementById('academy-profile-cropper-title'),
        applyBtn: document.getElementById('academy-profile-cropper-apply')
    };
}

function academyProfileGetCropTargetSize(kind = 'avatar') {
    return kind === 'cover'
        ? { width: 1600, height: 600 }
        : { width: 512, height: 512 };
}

function academyProfileClampCropOffsets() {
    const { stage } = academyProfileGetCropperElements();
    const cropper = academyProfileEditorState.cropper;

    if (!stage || !cropper.naturalWidth || !cropper.naturalHeight) return;

    const stageRect = stage.getBoundingClientRect();
    const stageWidth = Math.max(1, stageRect.width || 0);
    const stageHeight = Math.max(1, stageRect.height || 0);
    const scaledWidth = cropper.naturalWidth * cropper.scale;
    const scaledHeight = cropper.naturalHeight * cropper.scale;

    const maxOffsetX = Math.max(0, (scaledWidth - stageWidth) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - stageHeight) / 2);

    cropper.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, cropper.offsetX));
    cropper.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, cropper.offsetY));
}

function academyProfileRenderCropper() {
    const { overlay, stage, image, zoom, note, title } = academyProfileGetCropperElements();
    const cropper = academyProfileEditorState.cropper;

    if (!overlay || !stage || !image || !cropper.kind) return;

    overlay.setAttribute('data-crop-kind', cropper.kind);

    if (title) {
        title.innerText = cropper.kind === 'cover'
            ? 'Crop your cover photo'
            : 'Crop your profile photo';
    }

    if (note) {
        note.innerText = cropper.kind === 'cover'
            ? 'Drag and zoom until the wide crop looks right, then apply it.'
            : 'Drag and zoom until the square crop looks right, then apply it.';
    }

    if (zoom) {
        zoom.min = String(cropper.minScale || 1);
        zoom.max = String(cropper.maxScale || 3);
        zoom.step = '0.01';
        zoom.value = String(cropper.scale || cropper.minScale || 1);
    }

    image.style.width = `${cropper.naturalWidth}px`;
    image.style.height = `${cropper.naturalHeight}px`;
    image.style.transform = `translate(calc(-50% + ${cropper.offsetX}px), calc(-50% + ${cropper.offsetY}px)) scale(${cropper.scale})`;
}

function academyProfileCloseCropperModal() {
    const { overlay, stage, image, zoom } = academyProfileGetCropperElements();
    const cropper = academyProfileEditorState.cropper;

    if (stage && cropper.pointerId !== null) {
        try {
            stage.releasePointerCapture(cropper.pointerId);
        } catch (_) {}
    }

    if (overlay) {
        overlay.classList.add('hidden-step');
        overlay.setAttribute('data-crop-kind', 'avatar');
    }

    if (stage) {
        stage.classList.remove('is-dragging');
    }

    if (image) {
        image.removeAttribute('src');
        image.style.width = '';
        image.style.height = '';
        image.style.transform = '';
    }

    if (zoom) {
        zoom.min = '1';
        zoom.max = '3';
        zoom.value = '1';
    }

    if (cropper.objectUrl) {
        academyProfileRevokeObjectUrl(cropper.objectUrl);
    }

    academyProfileEditorState.cropper = {
        kind: '',
        objectUrl: '',
        naturalWidth: 0,
        naturalHeight: 0,
        scale: 1,
        minScale: 1,
        maxScale: 4,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        pointerId: null,
        dragStartX: 0,
        dragStartY: 0,
        startOffsetX: 0,
        startOffsetY: 0
    };
}

function academyProfileOpenCropper(file, kind = 'avatar') {
    const { overlay, stage, image } = academyProfileGetCropperElements();
    if (!overlay || !stage || !image) return;

    academyProfileCloseCropperModal();

    const cropperKind = kind === 'cover' ? 'cover' : 'avatar';
    const cropper = academyProfileEditorState.cropper;
    cropper.kind = cropperKind;
    cropper.objectUrl = URL.createObjectURL(file);

    overlay.classList.remove('hidden-step');
    overlay.setAttribute('data-crop-kind', cropperKind);

    image.onload = () => {
        cropper.naturalWidth = Math.max(1, image.naturalWidth || 1);
        cropper.naturalHeight = Math.max(1, image.naturalHeight || 1);

        window.requestAnimationFrame(() => {
            const stageRect = stage.getBoundingClientRect();
            const stageWidth = Math.max(1, stageRect.width || 0);
            const stageHeight = Math.max(1, stageRect.height || 0);

            cropper.minScale = Math.max(
                stageWidth / cropper.naturalWidth,
                stageHeight / cropper.naturalHeight
            );
            cropper.maxScale = Math.max(cropper.minScale * 4, cropper.minScale + 0.25);
            cropper.scale = cropper.minScale;
            cropper.offsetX = 0;
            cropper.offsetY = 0;

            academyProfileRenderCropper();
        });
    };

    image.src = cropper.objectUrl;
}

async function academyProfileApplyCrop() {
    const { stage, image } = academyProfileGetCropperElements();
    const cropper = academyProfileEditorState.cropper;

    if (!stage || !image || !cropper.kind || !cropper.naturalWidth || !cropper.naturalHeight) {
        throw new Error('Cropper is not ready yet.');
    }

    const stageRect = stage.getBoundingClientRect();
    const stageWidth = Math.max(1, stageRect.width || 0);
    const stageHeight = Math.max(1, stageRect.height || 0);

    const sourceWidth = stageWidth / cropper.scale;
    const sourceHeight = stageHeight / cropper.scale;

    let sourceX = (cropper.naturalWidth / 2) - (sourceWidth / 2) - (cropper.offsetX / cropper.scale);
    let sourceY = (cropper.naturalHeight / 2) - (sourceHeight / 2) - (cropper.offsetY / cropper.scale);

    sourceX = Math.max(0, Math.min(cropper.naturalWidth - sourceWidth, sourceX));
    sourceY = Math.max(0, Math.min(cropper.naturalHeight - sourceHeight, sourceY));

    const targetSize = academyProfileGetCropTargetSize(cropper.kind);
    const canvas = document.createElement('canvas');
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to prepare cropped image.');
    }

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetSize.width,
        targetSize.height
    );

    const croppedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }

                reject(new Error('Failed to generate cropped image.'));
            },
            'image/jpeg',
            0.92
        );
    });

    const previewUrl = URL.createObjectURL(croppedBlob);
    const uploadName = academyProfileBuildUploadName(cropper.kind, `${cropper.kind}.jpg`);

    if (cropper.kind === 'cover') {
        academyProfileSetTempAsset('cover', {
            previewUrl,
            blob: croppedBlob,
            uploadName
        });
        updateAcademyProfileEditorPreviewCover(previewUrl);
    } else {
        academyProfileSetTempAsset('avatar', {
            previewUrl,
            blob: croppedBlob,
            uploadName
        });

        const displayName =
            String(document.getElementById('academy-profile-edit-display-name')?.value || 'Hustler').trim() ||
            'Hustler';

        updateAcademyProfileEditorPreviewAvatar(previewUrl, displayName);
    }

    academyProfileCloseCropperModal();
    showToast(
        cropper.kind === 'cover'
            ? 'Cover photo ready. Save profile to publish it.'
            : 'Avatar ready. Save profile to publish it.',
        'success'
    );
}

function ensureAcademyProfileCropperBindings() {
    if (academyProfileEditorState.cropperBound) return;
    academyProfileEditorState.cropperBound = true;

    const overlay = document.getElementById('academy-profile-cropper-overlay');
    const closeBtn = document.getElementById('academy-profile-cropper-close');
    const cancelBtn = document.getElementById('academy-profile-cropper-cancel');
    const applyBtn = document.getElementById('academy-profile-cropper-apply');
    const zoomInput = document.getElementById('academy-profile-cropper-zoom');
    const stage = document.getElementById('academy-profile-cropper-stage');

    closeBtn?.addEventListener('click', () => {
        academyProfileCloseCropperModal();
    });

    cancelBtn?.addEventListener('click', () => {
        academyProfileCloseCropperModal();
    });

    overlay?.addEventListener('click', (event) => {
        if (event.target === overlay) {
            academyProfileCloseCropperModal();
        }
    });

    applyBtn?.addEventListener('click', () => {
        runDashboardButtonAction(applyBtn, 'Applying Crop.', async () => {
            await academyProfileApplyCrop();
        });
    });

    zoomInput?.addEventListener('input', (event) => {
        const cropper = academyProfileEditorState.cropper;
        if (!cropper.kind) return;

        const nextScale = Number.parseFloat(event.target.value);
        cropper.scale = Number.isFinite(nextScale)
            ? Math.max(cropper.minScale, Math.min(cropper.maxScale, nextScale))
            : cropper.minScale;

        academyProfileClampCropOffsets();
        academyProfileRenderCropper();
    });

    stage?.addEventListener('pointerdown', (event) => {
        const cropper = academyProfileEditorState.cropper;
        if (!cropper.kind) return;

        event.preventDefault();

        cropper.dragging = true;
        cropper.pointerId = event.pointerId;
        cropper.dragStartX = event.clientX;
        cropper.dragStartY = event.clientY;
        cropper.startOffsetX = cropper.offsetX;
        cropper.startOffsetY = cropper.offsetY;

        stage.classList.add('is-dragging');

        try {
            stage.setPointerCapture(event.pointerId);
        } catch (_) {}
    });

    stage?.addEventListener('pointermove', (event) => {
        const cropper = academyProfileEditorState.cropper;
        if (!cropper.dragging || cropper.pointerId !== event.pointerId) return;

        event.preventDefault();

        cropper.offsetX = cropper.startOffsetX + (event.clientX - cropper.dragStartX);
        cropper.offsetY = cropper.startOffsetY + (event.clientY - cropper.dragStartY);

        academyProfileClampCropOffsets();
        academyProfileRenderCropper();
    });

    const endCropDrag = (event) => {
        const cropper = academyProfileEditorState.cropper;
        if (!cropper.dragging) return;
        if (event?.pointerId !== undefined && cropper.pointerId !== event.pointerId) return;

        cropper.dragging = false;
        cropper.pointerId = null;
        stage?.classList.remove('is-dragging');
    };

    stage?.addEventListener('pointerup', endCropDrag);
    stage?.addEventListener('pointercancel', endCropDrag);

    window.addEventListener('resize', () => {
        const cropper = academyProfileEditorState.cropper;
        if (!cropper.kind || overlay?.classList.contains('hidden-step')) return;

        const { image } = academyProfileGetCropperElements();
        if (!image) return;

        window.requestAnimationFrame(() => {
            const stageRect = stage?.getBoundingClientRect();
            const stageWidth = Math.max(1, stageRect?.width || 0);
            const stageHeight = Math.max(1, stageRect?.height || 0);

            cropper.minScale = Math.max(
                stageWidth / cropper.naturalWidth,
                stageHeight / cropper.naturalHeight
            );
            cropper.maxScale = Math.max(cropper.minScale * 4, cropper.minScale + 0.25);
            cropper.scale = Math.max(cropper.minScale, Math.min(cropper.maxScale, cropper.scale));

            academyProfileClampCropOffsets();
            academyProfileRenderCropper();
        });
    });
}

function closeAcademyProfileEditorModal() {
    academyProfileCloseCropperModal();
    academyProfileSetTempAsset('avatar', { previewUrl: '' });
    academyProfileSetTempAsset('cover', { previewUrl: '' });
    document.getElementById('academy-profile-editor-overlay')?.classList.add('hidden-step');
}

function openAcademyProfileEditorModal() {
    if (academyProfileViewState?.mode !== 'self') return;

    academyProfileCloseCropperModal();

    const activeProfile =
        academyProfileViewState?.profile && typeof academyProfileViewState.profile === 'object'
            ? academyProfileViewState.profile
            : buildAcademySelfProfilePayload();

    const displayName =
        String(activeProfile.display_name || getStoredUserValue('yh_user_name', 'Hustler')).trim() || 'Hustler';
    const username =
        sanitizeAcademyProfileUsername(
            activeProfile.username || getStoredUserValue('yh_user_username', ''),
            displayName
        );
    const bio =
        String(activeProfile.bio || getAcademyProfileStoredBio()).trim() ||
        'Focused on execution, consistency, and long-term growth inside The Academy.';
    const avatar = String(activeProfile.avatar || getStoredUserValue('yh_user_avatar', '')).trim();
    const cover = String(activeProfile.cover_photo || getAcademyProfileStoredCover()).trim();
    const tags = Array.isArray(activeProfile.searchTags)
        ? activeProfile.searchTags
        : Array.isArray(activeProfile.search_tags)
            ? activeProfile.search_tags
            : readAcademyProfileTags();

    academyProfileSetTempAsset('avatar', {
        previewUrl: avatar,
        blob: null,
        uploadName: ''
    });

    academyProfileSetTempAsset('cover', {
        previewUrl: cover,
        blob: null,
        uploadName: ''
    });

    const displayNameInput = document.getElementById('academy-profile-edit-display-name');
    const usernameInput = document.getElementById('academy-profile-edit-username');
    const bioInput = document.getElementById('academy-profile-edit-bio');
    const tagsInput = document.getElementById('academy-profile-edit-tags');

    if (displayNameInput) displayNameInput.value = displayName;
    if (usernameInput) usernameInput.value = username;
    if (bioInput) bioInput.value = bio;
    if (tagsInput) tagsInput.value = tags.join(', ');

    updateAcademyProfileEditorPreviewAvatar(avatar, displayName);
    updateAcademyProfileEditorPreviewCover(cover);

    document.getElementById('academy-profile-editor-overlay')?.classList.remove('hidden-step');
}

function ensureAcademyProfileEditorBindings() {
    if (academyProfileEditorState.bound) return;
    academyProfileEditorState.bound = true;

    ensureAcademyProfileCropperBindings();

    document.addEventListener('click', (event) => {
        const openBtn = event.target.closest('#academy-profile-open-editor-btn');
        if (openBtn) {
            openAcademyProfileEditorModal();
            return;
        }

        const closeBtn = event.target.closest('#academy-profile-editor-close, #academy-profile-editor-cancel');
        if (closeBtn) {
            closeAcademyProfileEditorModal();
            return;
        }

        const overlay = event.target.closest('#academy-profile-editor-overlay');
        if (overlay && event.target === overlay) {
            closeAcademyProfileEditorModal();
            return;
        }

        const avatarTrigger = event.target.closest('#academy-profile-editor-avatar-trigger');
        if (avatarTrigger) {
            document.getElementById('academy-profile-editor-avatar-input')?.click();
            return;
        }

        const coverTrigger = event.target.closest('#academy-profile-editor-cover-trigger');
        if (coverTrigger) {
            document.getElementById('academy-profile-editor-cover-input')?.click();
            return;
        }

        const saveBtn = event.target.closest('#academy-profile-editor-save');
        if (saveBtn) {
            const displayNameInput = document.getElementById('academy-profile-edit-display-name');
            const usernameInput = document.getElementById('academy-profile-edit-username');
            const bioInput = document.getElementById('academy-profile-edit-bio');
            const tagsInput = document.getElementById('academy-profile-edit-tags');

            const nextDisplayName = String(displayNameInput?.value || '').trim();
            const nextUsername = sanitizeAcademyProfileUsername(usernameInput?.value || '');
            const nextBio = String(bioInput?.value || '').trim();
            const nextTags = String(tagsInput?.value || '')
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);

            if (!nextDisplayName) {
                showToast('Display name cannot be empty.', 'error');
                return;
            }

            if (!nextUsername) {
                showToast('Username cannot be empty.', 'error');
                return;
            }

            runDashboardButtonAction(saveBtn, 'Saving Profile.', async () => {
                let nextAvatarUrl = String(academyProfileEditorState.tempAvatarData || '').trim();
                let nextCoverUrl = String(academyProfileEditorState.tempCoverData || '').trim();

                if (academyProfileEditorState.tempAvatarBlob) {
                    const uploadedAvatar = await academyProfileUploadAsset(
                        academyProfileEditorState.tempAvatarBlob,
                        academyProfileEditorState.tempAvatarUploadName || 'avatar.jpg',
                        'avatar'
                    );
                    nextAvatarUrl = String(uploadedAvatar?.url || '').trim();
                }

                if (academyProfileEditorState.tempCoverBlob) {
                    const uploadedCover = await academyProfileUploadAsset(
                        academyProfileEditorState.tempCoverBlob,
                        academyProfileEditorState.tempCoverUploadName || 'cover.jpg',
                        'cover'
                    );
                    nextCoverUrl = String(uploadedCover?.url || '').trim();
                }

                const result = await academyAuthedFetch('/api/academy/profile', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        display_name: nextDisplayName,
                        username: nextUsername,
                        bio: nextBio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
                        search_tags: nextTags,
                        avatar: nextAvatarUrl,
                        cover_photo: nextCoverUrl
                    })
                });

                const savedProfile =
                    result?.profile && typeof result.profile === 'object'
                        ? result.profile
                        : null;

                if (!savedProfile) {
                    throw new Error('Profile save succeeded but no profile was returned.');
                }

                academyProfileSetTempAsset('avatar', {
                    previewUrl: String(savedProfile.avatar || '').trim(),
                    blob: null,
                    uploadName: ''
                });

                academyProfileSetTempAsset('cover', {
                    previewUrl: String(savedProfile.cover_photo || '').trim(),
                    blob: null,
                    uploadName: ''
                });

                syncAcademyProfileLocalMirrors(savedProfile);
                academyProfileViewState.profile = normalizeAcademyProfilePayload(
                    buildAcademySelfProfilePayload(savedProfile),
                    { mode: 'self' }
                );

                closeAcademyProfileEditorModal();
                renderAcademyProfileView(academyProfileViewState.profile, { mode: 'self' });
                showToast('Profile updated successfully.', 'success');
            });

            return;
        }
    });

    const avatarInput = document.getElementById('academy-profile-editor-avatar-input');
    const coverInput = document.getElementById('academy-profile-editor-cover-input');
    const displayNameInput = document.getElementById('academy-profile-edit-display-name');

    if (displayNameInput) {
        displayNameInput.addEventListener('input', () => {
            const nextDisplayName = String(displayNameInput.value || '').trim() || 'Hustler';
            if (!String(academyProfileEditorState.tempAvatarData || '').trim()) {
                updateAcademyProfileEditorPreviewAvatar('', nextDisplayName);
            }
        });
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;

            if (!String(file.type || '').toLowerCase().startsWith('image/')) {
                showToast('Please choose an image file for your avatar.', 'error');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('Avatar image too large. Max 10MB allowed.', 'error');
                return;
            }

            academyProfileOpenCropper(file, 'avatar');
        });
    }

    if (coverInput) {
        coverInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;

            if (!String(file.type || '').toLowerCase().startsWith('image/')) {
                showToast('Please choose an image file for your cover photo.', 'error');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('Cover image too large. Max 10MB allowed.', 'error');
                return;
            }

            academyProfileOpenCropper(file, 'cover');
        });
    }
}

function buildAcademySelfProfilePayload(profileSource = null) {
    const cachedHome = readAcademyHomeCache() || {};
    const cachedProfile =
        profileSource && typeof profileSource === 'object'
            ? profileSource
            : (readAcademyProfileCache() || {});

    const displayName =
        String(
            cachedProfile.display_name ||
            localStorage.getItem('yh_user_name') ||
            'Hustler'
        ).trim() || 'Hustler';

    const usernameRaw =
        sanitizeAcademyProfileUsername(
            cachedProfile.username ||
            getStoredUserValue('yh_user_username', '') ||
            displayName.toLowerCase().replace(/\s+/g, ''),
            displayName
        );

    const savedAvatar =
        String(cachedProfile.avatar || getStoredUserValue('yh_user_avatar', '')).trim();
    const savedCover =
        String(cachedProfile.cover_photo || getAcademyProfileStoredCover()).trim();
    const savedBio =
        String(cachedProfile.bio || getAcademyProfileStoredBio()).trim();
    const savedTags =
        Array.isArray(cachedProfile.search_tags) && cachedProfile.search_tags.length
            ? cachedProfile.search_tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 8)
            : readAcademyProfileTags();

    const hiddenPosts = readAcademyHiddenPostIds();

    const readinessValue =
        cachedHome?.roadmap?.readinessScore ??
        cachedHome?.readinessScore ??
        cachedHome?.summary?.readinessScore ??
        '—';

    const roadmapStatus =
        cachedHome?.roadmap?.status ||
        cachedHome?.roadmapStatus ||
        'Not loaded';

    const progressText =
        document.getElementById('progress-text')?.innerText ||
        '0% Daily Progress';

    const cachedPosts = readAcademyFeedCachePosts()
        .filter((post) => {
            const postName =
                String(post?.display_name || post?.fullName || post?.username || '').trim().toLowerCase();
            const postUsername = String(post?.username || '').trim().toLowerCase();

            return (
                postName === displayName.toLowerCase() ||
                postUsername === usernameRaw.toLowerCase()
            );
        })
        .sort((a, b) => {
            const left = new Date(a?.created_at || a?.createdAt || 0).getTime();
            const right = new Date(b?.created_at || b?.createdAt || 0).getTime();
            return right - left;
        });

    return {
        mode: 'self',
        id:
            String(cachedProfile.id || '').trim() ||
            String(getStoredUserValue('yh_user_id', '')).trim() ||
            String(getStoredUserValue('yh_user_uid', '')).trim(),
        full_name:
            String(cachedProfile.full_name || cachedProfile.fullName || '').trim() ||
            displayName,
        display_name: displayName,
        username: usernameRaw,
        avatar: savedAvatar,
        cover_photo: savedCover,
        role_label: String(cachedProfile.role_label || 'Academy Member').trim() || 'Academy Member',
        bio: savedBio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
        readiness: String(readinessValue),
        progress: progressText.replace(' Daily Progress', ''),
        roadmap_status: String(roadmapStatus),
        followers_count:
            cachedProfile.followers_count !== undefined && cachedProfile.followers_count !== null
                ? cachedProfile.followers_count
                : '—',
        post_count: cachedPosts.length,
        hidden_count: hiddenPosts.length,
        status: String(cachedProfile.status || 'Active').trim() || 'Active',
        search_tags: savedTags,
        recent_posts: cachedPosts.slice(0, 6)
    };
}

function normalizeAcademyProfilePayload(profile = {}, options = {}) {
    const fullName =
        String(
            profile?.full_name ||
            profile?.fullName ||
            profile?.display_name ||
            profile?.displayName ||
            profile?.username ||
            'Academy Member'
        ).trim() || 'Academy Member';

    const usernameRaw = String(profile?.username || '').trim().replace(/^@/, '');
    const recentPostsInput = Array.isArray(profile?.recent_posts)
        ? profile.recent_posts
        : Array.isArray(profile?.recentPosts)
        ? profile.recentPosts
        : [];

    const searchTags = Array.isArray(profile?.search_tags)
        ? profile.search_tags
            .map((tag) => String(tag || '').trim().replace(/^#/, ''))
            .filter(Boolean)
        : [];

    return {
        mode: String(options?.mode || profile?.mode || 'self').trim().toLowerCase() === 'visited' ? 'visited' : 'self',
        id: String(profile?.id || profile?.user_id || '').trim(),
        fullName,
        displayName: fullName,
        usernameRaw,
        username: usernameRaw ? `@${usernameRaw}` : '@academy-member',
        avatar: String(profile?.avatar || '').trim(),
        roleLabel: String(profile?.role_label || 'Academy Member').trim() || 'Academy Member',
        bio:
            String(
                profile?.bio ||
                'Focused on execution, consistency, and long-term growth inside The Academy.'
            ).trim(),
        readiness: String(profile?.readiness ?? profile?.readinessScore ?? '—'),
        progress: String(profile?.progress ?? profile?.daily_progress ?? '—').replace(' Daily Progress', ''),
        roadmap: String(profile?.roadmap_status || profile?.roadmap || '—'),
        followersCount: profile?.followers_count ?? profile?.followerCount ?? '—',
        postCount: Number.isFinite(Number(profile?.post_count))
            ? Number(profile.post_count)
            : recentPostsInput.length,
        hiddenCount: profile?.hidden_count ?? '—',
        status: String(profile?.status || 'Active').trim() || 'Active',
        followedByMe: profile?.followed_by_me === true || profile?.followed_by_me === 1,
        isFriend: profile?.is_friend === true || profile?.is_friend === 1,
        outgoingFriendRequestPending:
            profile?.outgoing_friend_request_pending === true ||
            profile?.outgoing_friend_request_pending === 1,
        incomingFriendRequestPending:
            profile?.incoming_friend_request_pending === true ||
            profile?.incoming_friend_request_pending === 1,
        incomingFriendRequestId: String(profile?.incoming_friend_request_id || '').trim(),
        mutualFriendCount: Number(profile?.mutual_friend_count || 0),
        searchTags,
        recentPosts: recentPostsInput.filter(Boolean)
    };
}

function renderAcademyProfileRecentPosts(posts = [], options = {}) {
    const list = document.getElementById('academy-profile-recent-posts');
    if (!list) return;

    const isSelf = options?.isSelf === true;

    if (!Array.isArray(posts) || posts.length === 0) {
        list.innerHTML = `
            <div class="academy-profile-empty-state">
                ${isSelf
                    ? 'You have no recent Academy post activity yet.'
                    : 'This member has no recent public Academy activity yet.'}
            </div>
        `;
        return;
    }

    list.innerHTML = posts.map((post) => {
        const postId = normalizeAcademyFeedId(post?.id);
        const body = String(post?.body || post?.text || '').trim();
        const preview = body
            ? body.slice(0, 220)
            : (post?.share ? 'Shared a post from the Academy feed.' : 'Activity update');

        const createdLabel = academyFeedTimeLabel(post?.created_at || post?.createdAt || null);
        const likeCount = Number(post?.like_count || 0);
        const commentCount = Number(post?.comment_count || 0);

        return `
            <article
                class="academy-profile-post-card"
                data-profile-post-id="${academyFeedEscapeHtml(postId)}"
                style="${postId ? 'cursor:pointer;' : ''}"
            >
                <div class="academy-profile-post-meta">${academyFeedEscapeHtml(createdLabel)}</div>
                <div class="academy-profile-post-body">${academyFeedEscapeHtml(preview)}</div>
                <div class="academy-profile-post-stats">${likeCount} likes • ${commentCount} comments</div>
                ${
                    postId
                        ? `
                            <div style="margin-top:12px;display:flex;justify-content:flex-end;">
                                <button
                                    type="button"
                                    class="btn-secondary"
                                    data-profile-post-id="${academyFeedEscapeHtml(postId)}"
                                    style="width:auto;min-width:132px;"
                                >Open in Feed</button>
                            </div>
                        `
                        : ''
                }
            </article>
        `;
    }).join('');
}

function renderAcademyProfileView(profilePayload = null, options = {}) {
    const normalized = normalizeAcademyProfilePayload(
        profilePayload || buildAcademySelfProfilePayload(),
        { mode: options?.mode || (profilePayload ? 'visited' : 'self') }
    );

    academyProfileViewState = {
        mode: normalized.mode,
        memberId: normalized.id,
        profile: normalized
    };

    const isSelf = normalized.mode === 'self';
    const relationshipState = isSelf
        ? 'self'
        : normalized.isFriend
            ? 'friends'
            : normalized.incomingFriendRequestPending
                ? 'incoming-request'
                : normalized.outgoingFriendRequestPending
                    ? 'outgoing-request'
                    : normalized.followedByMe
                        ? 'following'
                        : 'neutral';

    const profileViewRoot = document.getElementById('academy-profile-view');
    const profileHeaderTitle = document.getElementById('academy-profile-header-title');
    const profileHeaderTopic = document.getElementById('academy-profile-header-topic');
    const profileAvatar = document.getElementById('academy-profile-avatar');
    const profileName = document.getElementById('academy-profile-name');
    const profileUsername = document.getElementById('academy-profile-username');
    const profileRole = document.getElementById('academy-profile-role');
    const profileBio = document.getElementById('academy-profile-bio');
    const profileReadiness = document.getElementById('academy-profile-readiness');
    const profileProgress = document.getElementById('academy-profile-progress');
    const profileRoadmap = document.getElementById('academy-profile-roadmap');
    const profilePostCount = document.getElementById('academy-profile-post-count');
    const profileFollowerCount = document.getElementById('academy-profile-follower-count');
    const profileHiddenCount = document.getElementById('academy-profile-hidden-count');
    const profileStatus = document.getElementById('academy-profile-status');
    const profileMutualCount = document.getElementById('academy-profile-mutual-count');
    const profileFollowersMeta = document.getElementById('academy-profile-followers-meta');
    const profilePostsMeta = document.getElementById('academy-profile-posts-meta');
    const profileStatusMeta = document.getElementById('academy-profile-status-meta');
    const profileMutualsMeta = document.getElementById('academy-profile-mutuals-meta');
    const profileStatusStat = document.getElementById('academy-profile-status-stat');
    const profileMutualStat = document.getElementById('academy-profile-mutual-stat');
    const profileTagList = document.getElementById('academy-profile-tag-list');
    const profileMemberId = document.getElementById('academy-profile-member-id');
    const profileVisitNote = document.getElementById('academy-profile-visit-note');
    const profileViewMode = document.getElementById('academy-profile-view-mode');
    const profileIntroKicker = document.getElementById('academy-profile-intro-kicker');
    const profileIntroTitle = document.getElementById('academy-profile-intro-title');
    const profileContextKicker = document.getElementById('academy-profile-context-kicker');
    const profileContextTitle = document.getElementById('academy-profile-context-title');
    const profileRecentKicker = document.getElementById('academy-profile-recent-kicker');
    const profileRecentTitle = document.getElementById('academy-profile-recent-title');
    const profileIntroVisibilityBadge = document.getElementById('academy-profile-intro-visibility-badge');
    const profileVisitNoteTitle = document.getElementById('academy-profile-visit-note-title');
    const profileIntroRole = document.getElementById('academy-profile-intro-role');
    const profileIntroUsername = document.getElementById('academy-profile-intro-username');
    const profileIntroMode = document.getElementById('academy-profile-intro-mode');
    const profileContextSummary = document.getElementById('academy-profile-context-summary');
    const profileRelationshipSummary = document.getElementById('academy-profile-relationship-summary');
    const profileContextNote = document.getElementById('academy-profile-context-note');
    const profileCoverBand = document.getElementById('academy-profile-view')?.querySelector('.academy-profile-cover-band');
    const profileSettingsSummary = document.getElementById('academy-profile-settings-summary');
    const profileSettingsCoverMini = document.getElementById('academy-profile-settings-cover-mini');
    const profileSettingsAvatarMini = document.getElementById('academy-profile-settings-avatar-mini');
    const profileOpenEditorBtn = document.getElementById('academy-profile-open-editor-btn');
    const primaryAction = document.getElementById('academy-profile-primary-action');
    const secondaryAction = document.getElementById('academy-profile-secondary-action');
    const tertiaryAction = document.getElementById('academy-profile-tertiary-action');

    if (profileViewRoot) {
        profileViewRoot.setAttribute('data-profile-layout', isSelf ? 'self' : 'visited');
        profileViewRoot.setAttribute('data-profile-relationship-state', relationshipState);

        if (normalized.id) {
            profileViewRoot.setAttribute('data-profile-member-id', normalized.id);
        } else {
            profileViewRoot.removeAttribute('data-profile-member-id');
        }
    }

    if (profileAvatar) {
        if (normalized.avatar) {
            profileAvatar.innerText = '';
            profileAvatar.style.backgroundImage = `url(${normalized.avatar})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
        } else {
            profileAvatar.innerText = normalized.displayName.charAt(0).toUpperCase();
            profileAvatar.style.backgroundImage = 'none';
        }
    }

    const resolvedCoverPhoto = isSelf
        ? getAcademyProfileStoredCover()
        : String(normalized.cover_photo || normalized.coverPhoto || '').trim();

    if (profileCoverBand) {
        if (resolvedCoverPhoto) {
            profileCoverBand.style.backgroundImage = `
                linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(15, 23, 42, 0.1)),
                url(${resolvedCoverPhoto})
            `;
            profileCoverBand.style.backgroundSize = 'cover';
            profileCoverBand.style.backgroundPosition = 'center';
        } else {
            profileCoverBand.style.backgroundImage = '';
            profileCoverBand.style.backgroundSize = '';
            profileCoverBand.style.backgroundPosition = '';
        }
    }

    if (profileHeaderTitle) {
        profileHeaderTitle.innerText = isSelf
            ? 'My Profile'
            : `${normalized.displayName}'s Profile`;
    }

    if (profileHeaderTopic) {
        profileHeaderTopic.innerText = isSelf
            ? 'Your Academy profile, execution visibility, and public-facing identity hub.'
            : `Viewing ${normalized.displayName}'s Academy profile, public activity, and connection options.`;
    }

    if (profileName) profileName.innerText = normalized.displayName;
    if (profileUsername) profileUsername.innerText = normalized.username;
    if (profileRole) profileRole.innerText = normalized.roleLabel;
    if (profileBio) profileBio.innerText = normalized.bio;
    if (profileReadiness) profileReadiness.innerText = isSelf ? normalized.readiness : '—';
    if (profileProgress) profileProgress.innerText = isSelf ? normalized.progress : '—';
    if (profileRoadmap) profileRoadmap.innerText = isSelf ? normalized.roadmap : 'Public view';
    const parsedFollowerCount = Number(normalized.followersCount);
    const parsedPostCount = Number(normalized.postCount);
    const parsedMutualCount = Number(normalized.mutualFriendCount || 0);

    const followerCountValue = Number.isFinite(parsedFollowerCount) ? parsedFollowerCount : null;
    const postCountValue = Number.isFinite(parsedPostCount) ? parsedPostCount : 0;
    const mutualCountValue = Number.isFinite(parsedMutualCount) ? parsedMutualCount : 0;

    if (profilePostCount) profilePostCount.innerText = String(normalized.postCount);
    if (profileFollowerCount) profileFollowerCount.innerText = String(normalized.followersCount);
    if (profileHiddenCount) profileHiddenCount.innerText = isSelf ? String(normalized.hiddenCount) : '—';

    let resolvedStatusText = normalized.status;
    let resolvedStatusTone = isSelf ? 'self' : 'active';

    if (!isSelf && normalized.isFriend) {
        resolvedStatusText = 'Friends';
        resolvedStatusTone = 'friends';
    } else if (!isSelf && normalized.incomingFriendRequestPending) {
        resolvedStatusText = 'Incoming Request';
        resolvedStatusTone = 'incoming-request';
    } else if (!isSelf && normalized.outgoingFriendRequestPending) {
        resolvedStatusText = 'Request Sent';
        resolvedStatusTone = 'outgoing-request';
    } else if (!isSelf && normalized.followedByMe) {
        resolvedStatusText = normalized.status;
        resolvedStatusTone = 'following';
    }

    if (profileStatus) {
        profileStatus.innerText = resolvedStatusText;
    }

    if (profileMutualCount) {
        profileMutualCount.innerText = isSelf
            ? '—'
            : String(mutualCountValue);
    }

    if (profileFollowersMeta) {
        profileFollowersMeta.innerText = isSelf
            ? 'Community audience'
            : followerCountValue === null
                ? 'Public audience'
                : followerCountValue === 1
                    ? 'Public follower'
                    : 'Public followers';
    }

    if (profilePostsMeta) {
        profilePostsMeta.innerText = isSelf
            ? 'Your visible profile posts'
            : postCountValue === 1
                ? 'Public profile post'
                : 'Public profile posts';
    }

    if (profileStatusMeta) {
        profileStatusMeta.innerText = isSelf
            ? 'Your current Academy presence'
            : resolvedStatusTone === 'friends'
                ? 'Already connected inside Academy'
                : resolvedStatusTone === 'incoming-request'
                    ? 'This member wants to connect with you'
                    : resolvedStatusTone === 'outgoing-request'
                        ? 'Waiting for this member to respond'
                        : resolvedStatusTone === 'following'
                            ? 'You already follow this member'
                            : 'Public Academy member';
    }

    if (profileMutualsMeta) {
        profileMutualsMeta.innerText = isSelf
            ? 'Shared network visibility'
            : mutualCountValue === 0
                ? 'No shared Academy connections yet'
                : mutualCountValue === 1
                    ? '1 shared Academy connection'
                    : `${mutualCountValue} shared Academy connections`;
    }

    if (profileStatusStat) {
        profileStatusStat.setAttribute('data-status-tone', resolvedStatusTone);
    }

    if (profileMutualStat) {
        profileMutualStat.setAttribute(
            'data-has-mutuals',
            !isSelf && mutualCountValue > 0 ? 'true' : 'false'
        );
    }

    if (profileMemberId) {
        profileMemberId.innerText = normalized.id || 'Not available yet';
    }

const resolvedVisitNoteTitle = isSelf
    ? 'Profile summary'
    : 'Why this profile is visible';

const resolvedVisitNoteText = isSelf
    ? 'This is your personal Academy control view. Track your own execution, visibility, and public profile from here.'
    : 'You are viewing this member through the Academy social layer. This panel helps you quickly judge who they are before you follow, connect, or message.';

const resolvedRelationshipSummary = isSelf
    ? 'This is your own profile'
    : resolvedStatusTone === 'friends'
        ? 'Already connected inside Academy'
        : resolvedStatusTone === 'incoming-request'
            ? 'This member sent you a request'
            : resolvedStatusTone === 'outgoing-request'
                ? 'Your connection request is pending'
                : resolvedStatusTone === 'following'
                    ? 'You already follow this member'
                    : 'Not connected yet';

const resolvedContextSummary = isSelf
    ? 'This panel is about your own profile control, execution visibility, and personal Academy presence.'
    : 'This panel gives a fast public-facing read on the member and your current relationship state inside Academy.';

const resolvedContextNote = isSelf
    ? 'Visible inside your Academy profile shell'
    : mutualCountValue > 0
        ? `${mutualCountValue} shared Academy connection${mutualCountValue === 1 ? '' : 's'}`
        : 'Visible in Academy directory and social search';

const safeResolvedRelationshipSummary =
    typeof resolvedRelationshipSummary === 'string' && resolvedRelationshipSummary.trim()
        ? resolvedRelationshipSummary
        : (isSelf ? 'This is your own profile' : 'Not connected yet');

const safeResolvedContextSummary =
    typeof resolvedContextSummary === 'string' && resolvedContextSummary.trim()
        ? resolvedContextSummary
        : (isSelf
            ? 'This panel is about your own profile control, execution visibility, and personal Academy presence.'
            : 'This panel gives a fast public-facing read on the member and your current relationship state inside Academy.');

const safeResolvedContextNote =
    typeof resolvedContextNote === 'string' && resolvedContextNote.trim()
        ? resolvedContextNote
        : (isSelf
            ? 'Visible inside your Academy profile shell'
            : 'Visible in Academy directory and social search');

const resolvedIntroMode = isSelf
    ? 'Own profile'
    : 'Visited member profile';

const resolvedIntroVisibilityBadge = isSelf
    ? 'Own profile'
    : 'Public member view';

    if (profileVisitNoteTitle) {
        profileVisitNoteTitle.innerText = resolvedVisitNoteTitle;
    }

    if (profileVisitNote) {
        profileVisitNote.innerText = resolvedVisitNoteText;
    }

    if (profileViewMode) {
        profileViewMode.innerText = isSelf
            ? 'Own profile'
            : 'Visited profile';
    }

    if (profileIntroKicker) {
        profileIntroKicker.innerText = isSelf ? 'About You' : 'About Member';
    }

    if (profileIntroTitle) {
        profileIntroTitle.innerText = isSelf
            ? 'Your Academy identity'
            : 'Public member introduction';
    }

    if (profileIntroVisibilityBadge) {
        profileIntroVisibilityBadge.innerText = resolvedIntroVisibilityBadge;
    }

    if (profileIntroRole) {
        profileIntroRole.innerText = normalized.roleLabel || 'Academy Member';
    }

    if (profileIntroUsername) {
        profileIntroUsername.innerText = normalized.username || '@academy-member';
    }

    if (profileIntroMode) {
        profileIntroMode.innerText = resolvedIntroMode;
    }

    if (profileContextKicker) {
        profileContextKicker.innerText = isSelf
            ? 'Profile Context'
            : 'Connection Context';
    }

    if (profileContextTitle) {
        profileContextTitle.innerText = isSelf
            ? 'Control & identity details'
            : 'Identity & connection details';
    }

    if (profileContextSummary) {
        profileContextSummary.innerText = safeResolvedContextSummary;
    }

    if (profileRelationshipSummary) {
        profileRelationshipSummary.innerText = safeResolvedRelationshipSummary;
    }

    if (profileContextNote) {
        profileContextNote.innerText = safeResolvedContextNote;
    }

    if (profileRecentKicker) {
        profileRecentKicker.innerText = isSelf
            ? 'Recent Activity'
            : 'Public Activity';
    }

    if (profileRecentTitle) {
        profileRecentTitle.innerText = isSelf
            ? 'Your latest profile posts'
            : `${normalized.displayName}'s latest public posts`;
    }

    if (profileSettingsSummary) {
        const tagCount = Array.isArray(normalized.searchTags) ? normalized.searchTags.length : 0;
        profileSettingsSummary.innerText = isSelf
            ? `Edit your display name, username, bio, ${tagCount > 0 ? `${tagCount} tag${tagCount === 1 ? '' : 's'}` : 'profile tags'}, avatar, and cover photo.`
            : 'Profile customization is only available on your own profile.';
    }

    if (profileSettingsCoverMini) {
        if (resolvedCoverPhoto) {
            profileSettingsCoverMini.style.backgroundImage = `url(${resolvedCoverPhoto})`;
            profileSettingsCoverMini.style.backgroundSize = 'cover';
            profileSettingsCoverMini.style.backgroundPosition = 'center';
        } else {
            profileSettingsCoverMini.style.backgroundImage = '';
            profileSettingsCoverMini.style.backgroundSize = '';
            profileSettingsCoverMini.style.backgroundPosition = '';
        }
    }

    if (profileSettingsCoverMini) {
        const normalizedCoverUrl = academyNormalizeProfileAssetUrl(resolvedCoverPhoto);

        if (normalizedCoverUrl) {
            profileSettingsCoverMini.style.backgroundImage = `url(${normalizedCoverUrl})`;
            profileSettingsCoverMini.style.backgroundSize = 'cover';
            profileSettingsCoverMini.style.backgroundPosition = 'center';
        } else {
            profileSettingsCoverMini.style.backgroundImage = '';
            profileSettingsCoverMini.style.backgroundSize = '';
            profileSettingsCoverMini.style.backgroundPosition = '';
        }
    }

    if (profileOpenEditorBtn) {
        profileOpenEditorBtn.disabled = !isSelf;
    }

    if (profileTagList) {
        if (normalized.searchTags.length) {
            profileTagList.innerHTML = normalized.searchTags
                .slice(0, 8)
                .map((tag) => `<span class="academy-profile-tag-chip">#${academyFeedEscapeHtml(String(tag).replace(/^#/, ''))}</span>`)
                .join('');
        } else {
            profileTagList.innerHTML = `
                <span class="academy-profile-tag-chip academy-profile-tag-chip-muted">
                    ${isSelf ? 'Your profile tags will appear here.' : 'No profile tags yet.'}
                </span>
            `;
        }
    }

    if (primaryAction) {
        primaryAction.classList.remove('hidden-step', 'is-following');
        primaryAction.classList.toggle('btn-primary', isSelf);
        primaryAction.classList.toggle('btn-secondary', !isSelf);
        primaryAction.disabled = false;
        delete primaryAction.dataset.memberProfileId;
        delete primaryAction.dataset.friendRequestId;
        primaryAction.dataset.actionRank = isSelf ? 'own-primary-community' : 'visited-secondary-follow';

        if (isSelf) {
            primaryAction.innerText = 'Open Community';
            primaryAction.dataset.profileAction = 'open-community';
            primaryAction.setAttribute('aria-label', 'Open Community');
        } else {
            primaryAction.innerText = normalized.followedByMe ? 'Following' : 'Follow';
            primaryAction.dataset.profileAction = 'toggle-follow';
            primaryAction.dataset.memberProfileId = normalized.id;
            primaryAction.classList.toggle('is-following', normalized.followedByMe);
            primaryAction.setAttribute(
                'aria-label',
                normalized.followedByMe ? `Following ${normalized.displayName}` : `Follow ${normalized.displayName}`
            );
        }
    }

    if (secondaryAction) {
        secondaryAction.classList.remove('hidden-step', 'is-following');
        secondaryAction.classList.remove('btn-primary');
        secondaryAction.classList.add('btn-secondary');
        secondaryAction.disabled = false;
        delete secondaryAction.dataset.memberProfileId;
        delete secondaryAction.dataset.friendRequestId;
        secondaryAction.dataset.actionRank = isSelf ? 'own-secondary-roadmap' : 'visited-secondary-friend';

        if (isSelf) {
            secondaryAction.innerText = 'Open Roadmap';
            secondaryAction.dataset.profileAction = 'open-roadmap';
            secondaryAction.setAttribute('aria-label', 'Open Roadmap');
        } else if (normalized.isFriend) {
            secondaryAction.innerText = 'Friends';
            secondaryAction.dataset.profileAction = 'friend-state';
            secondaryAction.disabled = true;
            secondaryAction.classList.add('is-following');
            secondaryAction.setAttribute('aria-label', `You and ${normalized.displayName} are friends`);
        } else if (normalized.incomingFriendRequestPending) {
            secondaryAction.innerText = 'Accept Request';
            secondaryAction.dataset.profileAction = 'accept-friend-request';
            secondaryAction.dataset.friendRequestId = normalized.incomingFriendRequestId;
            secondaryAction.setAttribute('aria-label', `Accept friend request from ${normalized.displayName}`);
        } else if (normalized.outgoingFriendRequestPending) {
            secondaryAction.innerText = 'Request Sent';
            secondaryAction.dataset.profileAction = 'friend-state';
            secondaryAction.disabled = true;
            secondaryAction.classList.add('is-following');
            secondaryAction.setAttribute('aria-label', `Friend request sent to ${normalized.displayName}`);
        } else {
            secondaryAction.innerText = 'Add Friend';
            secondaryAction.dataset.profileAction = 'send-friend-request';
            secondaryAction.dataset.memberProfileId = normalized.id;
            secondaryAction.setAttribute('aria-label', `Add ${normalized.displayName} as a friend`);
        }
    }

    if (tertiaryAction) {
        tertiaryAction.classList.remove('hidden-step', 'is-following');
        tertiaryAction.classList.remove('btn-secondary');
        tertiaryAction.classList.add('btn-primary');
        tertiaryAction.disabled = false;
        delete tertiaryAction.dataset.memberProfileId;
        delete tertiaryAction.dataset.friendRequestId;
        tertiaryAction.dataset.actionRank = isSelf ? 'own-hidden-message' : 'visited-primary-message';

        if (isSelf) {
            tertiaryAction.innerText = 'Message';
            tertiaryAction.dataset.profileAction = 'open-community';
            tertiaryAction.disabled = true;
            tertiaryAction.classList.add('is-following');
            tertiaryAction.setAttribute('aria-label', 'Message is disabled on your own profile');
        } else {
            tertiaryAction.innerText = normalized.isFriend ? 'Message Friend' : 'Message';
            tertiaryAction.dataset.profileAction = 'open-direct-message';
            tertiaryAction.dataset.memberProfileId = normalized.id;
            tertiaryAction.setAttribute('aria-label', `Message ${normalized.displayName}`);
        }
    }

    ensureAcademyProfileEditorBindings();
    renderAcademyProfileRecentPosts(normalized.recentPosts, { isSelf });
}

function revealAcademyProfileView() {
    const profileView = document.getElementById('academy-profile-view');
    if (!profileView) return;

    profileView.classList.remove('hidden-step');
    profileView.classList.remove('fade-in');
    void profileView.offsetWidth;
    profileView.classList.add('fade-in');
}

async function fetchAcademyMemberProfile(memberId = '') {
    const normalizedMemberId = normalizeAcademyFeedId(memberId);
    if (!normalizedMemberId) {
        throw new Error('Missing member id.');
    }

    const result = await academyAuthedFetch(
        `/api/academy/community/members/${encodeURIComponent(normalizedMemberId)}/profile`,
        { method: 'GET' }
    );

    if (!result?.profile) {
        throw new Error('Profile not found.');
    }

    return result.profile;
}

function academyBuildDirectMessageRoomEntry(room = {}, profile = {}) {
    const roomId = String(room?.id || room?.roomId || '').trim();
    const recipientId = normalizeAcademyFeedId(profile?.id || '');
    const displayName =
        String(profile?.displayName || profile?.fullName || room?.name || 'Direct Message').trim() ||
        'Direct Message';
    const avatarUrl = String(profile?.avatar || '').trim();

    const currentUserId =
        normalizeAcademyFeedId(getStoredUserValue('yh_user_id', '')) ||
        normalizeAcademyFeedId(getStoredUserValue('yh_user_uid', ''));

    const memberIds = [currentUserId, recipientId].filter((value, index, array) => {
        return value && array.indexOf(value) === index;
    });

    const participantNames = [myName, displayName].filter((value, index, array) => {
        return value && array.indexOf(value) === index;
    });

    return {
        id: roomId,
        roomId,
        type: 'dm',
        name: displayName,
        icon: '💬',
        avatarUrl,
        color: 'var(--neon-blue)',
        privacy: 'private',
        isPrivate: true,
        recipientId,
        recipientName: displayName,
        participantNames,
        memberIds,
        unreadCount: 0,
        lastMessage: '',
        lastMessageAuthor: '',
        lastMessageAt: ''
    };
}

function academyCreateDirectMessageRoomElement(roomEntry = {}) {
    const element = document.createElement('div');
    const visualIcon = roomEntry.avatarUrl
        ? `url("${roomEntry.avatarUrl}")`
        : (roomEntry.icon || '💬');

    element.className = 'room-entry';
    element.setAttribute('data-type', 'dm');
    element.setAttribute('data-id', roomEntry.id || roomEntry.roomId || '');
    element.setAttribute('data-room-id', roomEntry.roomId || roomEntry.id || '');
    element.setAttribute('data-name', roomEntry.name || 'Direct Message');
    element.setAttribute('data-icon', visualIcon);
    element.setAttribute('data-color', roomEntry.color || 'var(--neon-blue)');
    element.setAttribute('data-room-recipient', roomEntry.recipientName || roomEntry.name || '');
    element.setAttribute('data-room-recipient-id', roomEntry.recipientId || '');
    element.setAttribute(
        'data-room-participants',
        JSON.stringify(Array.isArray(roomEntry.participantNames) ? roomEntry.participantNames : [])
    );
    element.setAttribute(
        'data-room-member-names',
        JSON.stringify(Array.isArray(roomEntry.participantNames) ? roomEntry.participantNames : [])
    );
    element.setAttribute(
        'data-room-member-ids',
        JSON.stringify(Array.isArray(roomEntry.memberIds) ? roomEntry.memberIds : [])
    );

    return element;
}

function setAcademyProfileMessageOpeningState(isOpening = false, options = {}) {
    const profileView = document.getElementById('academy-profile-view');
    const messageBtn = document.getElementById('academy-profile-tertiary-action');
    const followBtn = document.getElementById('academy-profile-primary-action');
    const friendBtn = document.getElementById('academy-profile-secondary-action');
    const phase = String(options.phase || '').trim();

    profileView?.classList.toggle('is-opening-message', !!isOpening);

    if (messageBtn) {
        messageBtn.disabled = !!isOpening;

        if (isOpening) {
            messageBtn.setAttribute('aria-busy', 'true');

            if (!messageBtn.dataset.originalText) {
                messageBtn.dataset.originalText = messageBtn.innerText;
            }

            messageBtn.innerText =
                phase === 'room'
                    ? 'Preparing room...'
                    : phase === 'opening'
                    ? 'Opening chat...'
                    : 'Opening...';
        } else {
            messageBtn.removeAttribute('aria-busy');

            if (messageBtn.dataset.originalText) {
                messageBtn.innerText = messageBtn.dataset.originalText;
                delete messageBtn.dataset.originalText;
            }
        }
    }

    if (followBtn) {
        followBtn.disabled = !!isOpening;
        followBtn.setAttribute('aria-disabled', isOpening ? 'true' : 'false');
    }

    if (friendBtn) {
        friendBtn.disabled = !!isOpening;
        friendBtn.setAttribute('aria-disabled', isOpening ? 'true' : 'false');
    }
}

function pulseAcademyRoomEntry(roomId = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId) return;

    const target = document.querySelector(
        `.room-entry[data-room-id="${CSS.escape(normalizedRoomId)}"], .room-entry[data-id="${CSS.escape(normalizedRoomId)}"]`
    );

    if (!target) return;

    target.classList.remove('yh-room-entry-pulse');
    void target.offsetWidth;
    target.classList.add('yh-room-entry-pulse');

    window.setTimeout(() => {
        target.classList.remove('yh-room-entry-pulse');
    }, 1800);
}

function focusAcademyChatComposer() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    window.requestAnimationFrame(() => {
        try {
            input.focus({ preventScroll: true });
        } catch (_) {
            input.focus();
        }

        const value = String(input.value || '');
        input.setSelectionRange(value.length, value.length);
    });
}
function sendAcademyThreadMessage(customText = null) {
    const input = document.getElementById('chat-input');
    const activeRoomId = getActiveRoomId();
    const activeRoomLabel = getActiveRoomLabel();
    const activeRoomType = String(currentRoomMeta?.type || '').trim().toLowerCase();

    if (!input || !activeRoomId) return;
    if (activeRoomType !== 'dm' && activeRoomType !== 'group') return;

    const rawText = customText !== null ? String(customText) : String(input.value || '');
    const text = rawText.trim();
    if (!text) return;

    const outboundMessage = {
        roomId: activeRoomId,
        room: activeRoomId,
        roomName: activeRoomLabel,
        author: getStoredUserValue('yh_user_name', 'Hustler'),
        initial: String(getStoredUserValue('yh_user_name', 'Hustler') || 'H').charAt(0).toUpperCase(),
        avatar: '',
        text,
        time: new Date().toISOString(),
        type: activeRoomType,
        privacy: 'private',
        recipientName: currentRoomMeta?.recipientName || (activeRoomType === 'dm' ? activeRoomLabel : ''),
        recipientId: currentRoomMeta?.recipientId || ''
    };

    socket.emit('sendMessage', outboundMessage);

    touchCustomRoomFromMessage(outboundMessage, {
        createIfMissing: true,
        resetUnread: true
    });

    input.value = '';
}

function sendAcademyComposerMessage(customText = null) {
    if (academyCoachModeActive) {
        academySendCoachMessage(customText);
        return;
    }

    const activeRoomType = String(currentRoomMeta?.type || '').trim().toLowerCase();

    if (activeRoomType === 'dm' || activeRoomType === 'group') {
        sendAcademyThreadMessage(customText);
        return;
    }

    sendMessage(customText);
}

function bindAcademyMessagesComposer() {
    if (window.__yhAcademyMessagesComposerBound) return;
    window.__yhAcademyMessagesComposerBound = true;

    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

    chatInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendAcademyComposerMessage();
        }
    });

    chatSendBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        sendAcademyComposerMessage();
    });
}

bindAcademyMessagesComposer();

const academyMessagesInboxState = {
    activeRoomId: '',
    loading: false,
    hydratedOnce: false,
    openMenuRoomId: ''
};
function academyResetMessagesThreadState() {
    academyMessagesInboxState.activeRoomId = '';
    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    setActiveCustomRoomState(null);

    const { chatInputArea, dynamicChatHistory } = academyGetMessagesInboxElements();
    const chatInput = document.getElementById('chat-input');

    if (chatInput) {
        chatInput.value = '';
        chatInput.removeAttribute('data-active-room-id');
        chatInput.removeAttribute('data-active-room-name');
        chatInput.removeAttribute('data-active-room-type');
    }

    if (dynamicChatHistory) {
        dynamicChatHistory.innerHTML = '';
    }

    if (chatInputArea) {
        chatInputArea.classList.add('hidden-step');
        chatInputArea.style.setProperty('display', 'none', 'important');
        chatInputArea.setAttribute('aria-hidden', 'true');
    }
}

function academyGetMessagesInboxElements() {
    return {
        academyChat: document.getElementById('academy-chat'),
        inbox: document.getElementById('academy-messages-inbox'),
        sidebar: document.getElementById('academy-messages-inbox-sidebar'),
        list: document.getElementById('academy-messages-inbox-list'),
        dynamicChatHistory: document.getElementById('dynamic-chat-history'),
        chatInputArea: document.getElementById('chat-input-area'),
        welcomeBox: document.getElementById('chat-welcome-box'),
        threadHeader: document.getElementById('academy-messages-thread-header'),
        threadAvatar: document.getElementById('academy-messages-thread-avatar'),
        threadTitle: document.getElementById('academy-messages-thread-title'),
        threadMeta: document.getElementById('academy-messages-thread-meta'),
        threadRoomtype: document.getElementById('academy-messages-thread-roomtype'),
        threadBackBtn: document.getElementById('academy-messages-thread-back-btn'),
        threadRefreshBtn: document.getElementById('academy-messages-thread-refresh-btn')
    };
}

function academySetMessagesChatMode(mode = 'home') {
    const normalizedMode = ['home', 'messages', 'thread'].includes(String(mode || '').trim())
        ? String(mode || '').trim()
        : 'home';

    const { academyChat, inbox, sidebar, chatInputArea, threadHeader } = academyGetMessagesInboxElements();

    if (academyChat) {
        academyChat.setAttribute('data-chat-mode', normalizedMode);
    }

    document.body?.classList.toggle('academy-messages-thread-open', normalizedMode === 'thread');

    if (inbox) {
        inbox.setAttribute('data-mode', normalizedMode);
    }

    if (sidebar) {
        sidebar.classList.toggle('hidden-step', normalizedMode === 'home');
    }

    if (threadHeader && normalizedMode !== 'thread') {
        threadHeader.classList.add('hidden-step');
    }

    if (chatInputArea) {
        const shouldShowComposer = normalizedMode === 'thread';
        chatInputArea.classList.toggle('hidden-step', !shouldShowComposer);

        if (shouldShowComposer) {
            chatInputArea.style.removeProperty('display');
            chatInputArea.setAttribute('aria-hidden', 'false');
        } else {
            chatInputArea.style.setProperty('display', 'none', 'important');
            chatInputArea.setAttribute('aria-hidden', 'true');
        }
    }
}

function academyFormatInboxTime(value = '') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = now.toDateString() === date.toDateString();

    if (sameDay) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function academyBuildInboxPreview(room = {}) {
    const author = String(room?.lastMessageAuthor || '').trim();
    const text = String(room?.lastMessage || '').trim();

    if (!text) {
        return room?.type === 'group'
            ? 'Private group chat ready.'
            : 'Direct message ready.';
    }

    return author ? `${author}: ${text}` : text;
}

function academyReadMessageRooms() {
    const state = getDashboardState();
    const rooms = Array.isArray(state?.customRooms) ? state.customRooms : [];

    return rooms
        .filter((room) => {
            const type = String(room?.type || '').trim().toLowerCase();
            if (type !== 'dm' && type !== 'group') return false;
            if (room?.isHidden === true) return false;
            if (room?.isBlocked === true) return false;
            return true;
        })
        .slice()
        .sort((a, b) => {
            const aUnread = Number.parseInt(a?.unreadCount, 10);
            const bUnread = Number.parseInt(b?.unreadCount, 10);

            const safeAUnread = Number.isFinite(aUnread) ? aUnread : 0;
            const safeBUnread = Number.isFinite(bUnread) ? bUnread : 0;

            if (safeAUnread !== safeBUnread) {
                return safeBUnread - safeAUnread;
            }

            const aTime = new Date(String(a?.lastMessageAt || '') || 0).getTime();
            const bTime = new Date(String(b?.lastMessageAt || '') || 0).getTime();

            if (aTime !== bTime) {
                return bTime - aTime;
            }

            return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
}
function academyNormalizeRealtimeRoomEntry(room = {}) {
    const roomId = String(room?.id || room?.roomId || room?.room_key || '').trim();
    const roomType = String(room?.room_type || room?.type || 'group').trim().toLowerCase() === 'dm' ? 'dm' : 'group';
    const roomName =
        String(room?.name || (roomType === 'group' ? 'Private Group' : 'Direct Message')).trim() ||
        (roomType === 'group' ? 'Private Group' : 'Direct Message');

    const memberIds = Array.isArray(room?.member_ids)
        ? room.member_ids.map((value) => normalizeAcademyFeedId(value)).filter(Boolean)
        : Array.isArray(room?.memberIds)
            ? room.memberIds.map((value) => normalizeAcademyFeedId(value)).filter(Boolean)
            : [];

    const participantNames = Array.isArray(room?.participantNames)
        ? room.participantNames.filter(Boolean)
        : Array.isArray(room?.member_names)
            ? room.member_names.filter(Boolean)
            : Array.isArray(room?.participants)
                ? room.participants.filter(Boolean)
                : [];

    const unreadRaw = Number.parseInt(
        room?.unread_count ?? room?.unreadCount ?? 0,
        10
    );
    const unreadCount = Number.isFinite(unreadRaw) && unreadRaw > 0 ? unreadRaw : 0;

    const avatarUrl = String(room?.avatar || room?.avatarUrl || '').trim();
    const currentUserId =
        normalizeAcademyFeedId(getStoredUserValue('yh_user_id', '')) ||
        normalizeAcademyFeedId(getStoredUserValue('yh_user_uid', ''));

    let recipientId = '';
    if (roomType === 'dm' && memberIds.length) {
        recipientId = memberIds.find((memberId) => memberId && memberId !== currentUserId) || '';
    }

    return {
        id: roomId,
        roomId,
        room_key: String(room?.room_key || roomId).trim(),
        type: roomType,
        name: roomName,
        recipientId,
        recipientName: roomType === 'dm' ? roomName : '',
        participantNames,
        memberIds,
        avatarUrl,
        unreadCount,
        muted: room?.is_muted === true || room?.isMuted === true,
        isHidden: room?.is_hidden === true || room?.isHidden === true,
        isBlocked: room?.is_blocked === true || room?.isBlocked === true,
        lastMessage: String(room?.last_message_text || room?.lastMessage || '').trim(),
        lastMessageAuthor: String(room?.last_message_author || room?.lastMessageAuthor || '').trim(),
        lastMessageAt: String(room?.last_message_at || room?.lastMessageAt || room?.updated_at || room?.updatedAt || '').trim(),
        createdAt: String(room?.created_at || room?.createdAt || '').trim(),
        updatedAt: String(room?.updated_at || room?.updatedAt || '').trim(),
        icon: roomType === 'dm' ? '💬' : '👥',
        color: 'var(--neon-blue)'
    };
}

function academyRenderMessagesSidebarBadge() {
    const target = document.getElementById('nav-messages');
    if (!target) return;

    let badge = target.querySelector('.academy-sidebar-unread-badge');
    const rooms = academyReadMessageRooms();
    const totalUnread = rooms.reduce((sum, room) => {
        const value = Number.parseInt(room?.unreadCount, 10);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);

    if (totalUnread <= 0) {
        badge?.remove();
        return;
    }

    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'academy-sidebar-unread-badge';
        target.appendChild(badge);
    }

    badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
}

async function academyHydrateMessageRooms(forceFresh = false) {
    if (academyMessagesInboxState.loading) return academyReadMessageRooms();

    academyMessagesInboxState.loading = true;

    try {
        if (forceFresh) {
            const { list } = academyGetMessagesInboxElements();
            if (list) {
                list.innerHTML = `<div class="academy-messages-inbox-empty">Loading conversations.</div>`;
            }
        }

        const result = await academyAuthedFetch('/api/realtime/rooms', {
            method: 'GET'
        });

        const roomsRaw = Array.isArray(result?.rooms) ? result.rooms : [];
        const normalizedRooms = roomsRaw
            .map((room) => academyNormalizeRealtimeRoomEntry(room))
            .filter((room) => !!normalizeRoomKey(room?.roomId || room?.id));

        syncCustomRoomsUI(normalizedRooms);
        academyMessagesInboxState.hydratedOnce = true;
        academyRenderMessagesSidebarBadge();

        const activeRoomId = normalizeRoomKey(academyMessagesInboxState.activeRoomId);
        if (activeRoomId) {
            const stillExists = normalizedRooms.some((room) => {
                return normalizeRoomKey(room?.roomId || room?.id) === activeRoomId;
            });

            if (!stillExists) {
                academyMessagesInboxState.activeRoomId = '';
            }
        }

        renderAcademyMessagesInboxList();
        return normalizedRooms;
    } catch (error) {
        renderAcademyMessagesInboxList();
        academyRenderMessagesSidebarBadge();
        throw error;
    } finally {
        academyMessagesInboxState.loading = false;
    }
}

function academyCloseInboxRoomMenu() {
    academyMessagesInboxState.openMenuRoomId = '';
    document.querySelectorAll('.academy-messages-inbox-menu.is-open').forEach((menu) => {
        menu.classList.remove('is-open');
    });
}

function academyToggleInboxRoomMenu(roomId = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId) return;

    const nextOpenId =
        academyMessagesInboxState.openMenuRoomId === normalizedRoomId
            ? ''
            : normalizedRoomId;

    academyMessagesInboxState.openMenuRoomId = nextOpenId;

    document.querySelectorAll('.academy-messages-inbox-menu').forEach((menu) => {
        const menuRoomId = normalizeRoomKey(menu.getAttribute('data-room-menu-id'));
        menu.classList.toggle('is-open', !!nextOpenId && menuRoomId === nextOpenId);
    });
}

async function academyApplyInboxRoomAction(roomId = '', action = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    const normalizedAction = String(action || '').trim().toLowerCase();

    if (!normalizedRoomId || !normalizedAction) return;

    const endpointMap = {
        mute: `/api/realtime/rooms/${encodeURIComponent(normalizedRoomId)}/mute`,
        hide: `/api/realtime/rooms/${encodeURIComponent(normalizedRoomId)}/hide`,
        block: `/api/realtime/rooms/${encodeURIComponent(normalizedRoomId)}/block`
    };

    const endpoint = endpointMap[normalizedAction];
    if (!endpoint) return;

    const body =
        normalizedAction === 'mute'
            ? { muted: true }
            : normalizedAction === 'block'
                ? { blocked: true }
                : {};

    const labelMap = {
        mute: 'Conversation muted.',
        hide: 'Conversation removed from your inbox.',
        block: 'Conversation blocked.'
    };

    await academyAuthedFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });

    if (normalizedAction === 'hide' || normalizedAction === 'block') {
        const activeRoomId = normalizeRoomKey(academyMessagesInboxState.activeRoomId);
        if (activeRoomId && activeRoomId === normalizedRoomId) {
            academyReturnToMessagesInboxHome();
        }
    }

    academyCloseInboxRoomMenu();
    await academyHydrateMessageRooms(true);
    showToast(labelMap[normalizedAction] || 'Conversation updated.');
}

function academyResolveMessageRoomById(roomId = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId) return null;

    return academyReadMessageRooms().find((room) => {
        return normalizeRoomKey(room?.roomId || room?.id) === normalizedRoomId;
    }) || null;
}

function academyGetMessageRoomMemberCount(room = {}) {
    const participantNames = Array.isArray(room?.participantNames)
        ? room.participantNames.filter(Boolean)
        : Array.isArray(room?.participants)
            ? room.participants.filter(Boolean)
            : Array.isArray(room?.memberNames)
                ? room.memberNames.filter(Boolean)
                : [];

    const memberIds = Array.isArray(room?.memberIds) ? room.memberIds.filter(Boolean) : [];
    const countFromNames = participantNames.length;
    const countFromIds = memberIds.length;
    const fallbackCount = String(room?.type || '').trim().toLowerCase() === 'dm' ? 2 : 1;

    return Math.max(countFromNames, countFromIds, fallbackCount);
}

function academyClearMessagesThreadHeader() {
    const {
        threadHeader,
        threadAvatar,
        threadTitle,
        threadMeta,
        threadRoomtype
    } = academyGetMessagesInboxElements();

    if (threadHeader) {
        threadHeader.classList.add('hidden-step');
    }

    if (threadAvatar) {
        threadAvatar.style.backgroundImage = 'none';
        threadAvatar.innerText = '💬';
    }

    if (threadTitle) {
        threadTitle.innerText = 'Conversation';
    }

    if (threadMeta) {
        threadMeta.innerText = 'Select a conversation to view thread details.';
    }

    if (threadRoomtype) {
        threadRoomtype.innerText = 'DM';
    }
}

function academyRenderMessagesThreadHeader(room = {}) {
    const {
        threadHeader,
        threadAvatar,
        threadTitle,
        threadMeta,
        threadRoomtype
    } = academyGetMessagesInboxElements();

    if (!threadHeader || !threadAvatar || !threadTitle || !threadMeta || !threadRoomtype) return;

    const roomType = String(room?.type || '').trim().toLowerCase() === 'group' ? 'group' : 'dm';
    const roomName =
        String(
            room?.name ||
            room?.recipientName ||
            (roomType === 'group' ? 'Private Group' : 'Direct Message')
        ).trim() || (roomType === 'group' ? 'Private Group' : 'Direct Message');

    const memberCount = academyGetMessageRoomMemberCount(room);
    const memberLabel = `${memberCount} member${memberCount === 1 ? '' : 's'}`;
    const roomTypeLabel = roomType === 'group' ? 'Group chat' : 'Direct message';

    const avatarUrl = String(room?.avatarUrl || room?.avatar || '').trim();
    const avatarFallback = roomType === 'group'
        ? '👥'
        : roomName.charAt(0).toUpperCase();

    if (avatarUrl) {
        threadAvatar.style.backgroundImage = `url('${academyFeedEscapeHtml(avatarUrl)}')`;
        threadAvatar.innerText = '';
    } else {
        threadAvatar.style.backgroundImage = 'none';
        threadAvatar.innerText = avatarFallback;
    }

    threadTitle.innerText = roomName;
    threadMeta.innerText = `${roomTypeLabel} • ${memberLabel}`;
    threadRoomtype.innerText = roomType === 'group' ? 'GROUP' : 'DM';
    threadHeader.classList.remove('hidden-step');
}

function academyReturnToMessagesInboxHome() {
    academyResetMessagesThreadState();
    renderAcademyMessagesInboxList();
    academyRenderMessagesThreadEmpty('Select a conversation from the inbox to open that private thread.');
}

function academyRefreshActiveMessagesThread() {
    const activeRoomId =
        normalizeRoomKey(academyMessagesInboxState.activeRoomId) ||
        normalizeRoomKey(getActiveRoomId());

    if (!activeRoomId) {
        academyRenderMessagesThreadEmpty('Select a conversation from the inbox to open that private thread.');
        return;
    }

    academyOpenInboxRoomById(activeRoomId);
}

function academyRenderMessagesThreadEmpty(message = 'Select a conversation to open its private thread.') {
    const { dynamicChatHistory, welcomeBox } = academyGetMessagesInboxElements();
    if (!dynamicChatHistory) return;

    academyResetMessagesThreadState();
    academyClearMessagesThreadHeader();
    academySetMessagesChatMode('messages');

    if (welcomeBox) {
        welcomeBox.style.display = 'none';
    }

    dynamicChatHistory.innerHTML = `
        <div class="academy-messages-thread-empty">
            <div>
                <strong style="display:block;font-size:1rem;color:#f8fafc;margin-bottom:8px;">Messages Inbox</strong>
                <span>${academyFeedEscapeHtml(message)}</span>
            </div>
        </div>
    `;
}

function academyBuildGenericInboxRoomElement(roomEntry = {}) {
    const element = document.createElement('div');
    const roomId = String(roomEntry.roomId || roomEntry.id || '').trim();
    const roomType = String(roomEntry.type || 'group').trim().toLowerCase() === 'dm' ? 'dm' : 'group';

    element.className = 'room-entry';
    element.setAttribute('data-type', roomType);
    element.setAttribute('data-id', roomId);
    element.setAttribute('data-room-id', roomId);
    element.setAttribute('data-name', roomEntry.name || (roomType === 'dm' ? 'Direct Message' : 'Private Group'));
    element.setAttribute('data-icon', roomEntry.icon || (roomType === 'dm' ? '💬' : '👥'));
    element.setAttribute('data-color', roomEntry.color || 'var(--neon-blue)');

    if (roomType === 'dm') {
        element.setAttribute('data-room-recipient', roomEntry.recipientName || roomEntry.name || 'Direct Message');
        element.setAttribute('data-room-recipient-id', roomEntry.recipientId || '');
    }

    element.setAttribute(
        'data-room-participants',
        JSON.stringify(Array.isArray(roomEntry.participantNames) ? roomEntry.participantNames : [])
    );
    element.setAttribute(
        'data-room-member-names',
        JSON.stringify(Array.isArray(roomEntry.participantNames) ? roomEntry.participantNames : [])
    );
    element.setAttribute(
        'data-room-member-ids',
        JSON.stringify(Array.isArray(roomEntry.memberIds) ? roomEntry.memberIds : [])
    );

    return element;
}

function academyOpenInboxRoomById(roomId = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId) return;

    const rooms = academyReadMessageRooms();
    const roomEntry = rooms.find((room) => {
        return normalizeRoomKey(room?.roomId || room?.id) === normalizedRoomId;
    });

    if (!roomEntry) return;

    academyMessagesInboxState.activeRoomId = normalizedRoomId;
    academySetMessagesChatMode('thread');
    saveAcademyViewState('messages');
    setAcademySidebarActive('nav-messages');

    const transientRoomElement =
        roomEntry.type === 'dm' && typeof academyCreateDirectMessageRoomElement === 'function'
            ? academyCreateDirectMessageRoomElement(roomEntry)
            : academyBuildGenericInboxRoomElement(roomEntry);

    openRoom(roomEntry.type === 'dm' ? 'dm' : 'group', transientRoomElement);
    academySetMessagesChatMode('thread');
    markCustomRoomAsRead(roomEntry.roomId || roomEntry.id);
    renderAcademyMessagesInboxList();
    focusAcademyChatComposer();
}

function academyRefreshMessagesInboxSelection() {
    const activeRoomId = normalizeRoomKey(getActiveRoomId());

    if (activeRoomId && activeRoomId !== normalizeRoomKey('YH-community')) {
        academyMessagesInboxState.activeRoomId = activeRoomId;
    }

    renderAcademyMessagesInboxList();
}

function renderAcademyMessagesInboxList() {
    const { list } = academyGetMessagesInboxElements();
    if (!list) return;

    const runtimeActiveRoomId = normalizeRoomKey(getActiveRoomId());
    const hasExplicitInboxSelection = normalizeRoomKey(academyMessagesInboxState.activeRoomId);
    const runtimeRoomType = String(currentRoomMeta?.type || '').trim().toLowerCase();
    const hasLivePrivateThread =
        runtimeActiveRoomId &&
        runtimeActiveRoomId !== normalizeRoomKey('YH-community') &&
        (runtimeRoomType === 'dm' || runtimeRoomType === 'group');

    if (!hasExplicitInboxSelection && hasLivePrivateThread) {
        academyMessagesInboxState.activeRoomId = runtimeActiveRoomId;
    }

    const rooms = academyReadMessageRooms();
    academyRenderMessagesSidebarBadge();

    if (!rooms.length) {
        list.innerHTML = `<div class="academy-messages-inbox-empty">No direct messages or group chats yet.</div>`;
        return;
    }

    const activeRoomId = normalizeRoomKey(academyMessagesInboxState.activeRoomId);

    list.innerHTML = rooms.map((room) => {
        const roomId = String(room?.roomId || room?.id || '').trim();
        const normalizedRoomId = normalizeRoomKey(roomId);
        const roomName = String(room?.name || (room?.type === 'group' ? 'Private Group' : 'Direct Message')).trim() || 'Conversation';
        const preview = academyBuildInboxPreview(room);
        const unreadCount = Number.parseInt(room?.unreadCount, 10);
        const unread = Number.isFinite(unreadCount) && unreadCount > 0 ? unreadCount : 0;
        const isActive = activeRoomId && activeRoomId === normalizedRoomId;
        const roomTypeLabel = String(room?.type || '').trim().toLowerCase() === 'group' ? 'Group' : 'DM';
        const timeLabel = academyFormatInboxTime(room?.lastMessageAt || '');
        const isMuted = room?.muted === true;

        let avatarHtml = '';
        const avatarUrl = academyResolveMemberAvatarUrl(room);

        if (avatarUrl) {
            avatarHtml = `<span class="academy-messages-inbox-avatar" style="background-image:url('${academyFeedEscapeHtml(avatarUrl)}');"></span>`;
        } else {
            avatarHtml = `<span class="academy-messages-inbox-avatar">${academyFeedEscapeHtml(roomName.charAt(0).toUpperCase())}</span>`;
        }

        return `
            <div class="academy-messages-inbox-card ${isActive ? 'is-active' : ''}" data-room-card-id="${academyFeedEscapeHtml(roomId)}">
                <button
                    type="button"
                    class="academy-messages-inbox-item ${isActive ? 'is-active' : ''}"
                    data-inbox-room-id="${academyFeedEscapeHtml(roomId)}"
                >
                    ${avatarHtml}

                    <span class="academy-messages-inbox-copy">
                        <span class="academy-messages-inbox-topline">
                            <span class="academy-messages-inbox-name">${academyFeedEscapeHtml(roomName)}</span>
                            <span class="academy-messages-inbox-time">${academyFeedEscapeHtml(timeLabel)}</span>
                        </span>

                        <span class="academy-messages-inbox-preview">${academyFeedEscapeHtml(preview)}</span>

                        <span class="academy-messages-inbox-meta">
                            <span class="academy-messages-inbox-roomtype">${academyFeedEscapeHtml(roomTypeLabel)}</span>
                            ${isMuted ? `<span class="academy-messages-inbox-muted">Muted</span>` : ''}
                            ${unread > 0 ? `<span class="academy-messages-inbox-badge">${academyFeedEscapeHtml(String(unread))}</span>` : ''}
                        </span>
                    </span>
                </button>

                <div class="academy-messages-inbox-actions">
                    <button
                        type="button"
                        class="academy-messages-inbox-menu-trigger"
                        data-room-menu-trigger="${academyFeedEscapeHtml(roomId)}"
                        aria-label="Conversation options"
                        title="Conversation options"
                    >⋯</button>

                    <div
                        class="academy-messages-inbox-menu ${academyMessagesInboxState.openMenuRoomId === normalizedRoomId ? 'is-open' : ''}"
                        data-room-menu-id="${academyFeedEscapeHtml(roomId)}"
                    >
                        <button type="button" data-room-action="mute" data-room-id="${academyFeedEscapeHtml(roomId)}">Mute</button>
                        <button type="button" data-room-action="hide" data-room-id="${academyFeedEscapeHtml(roomId)}">Delete conversation</button>
                        <button type="button" data-room-action="block" data-room-id="${academyFeedEscapeHtml(roomId)}">Block</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function bindAcademyMessagesInbox() {
    if (window.__yhAcademyMessagesInboxBound) return;
    window.__yhAcademyMessagesInboxBound = true;

    const inboxList = document.getElementById('academy-messages-inbox-list');

    inboxList?.addEventListener('click', async (event) => {
        const actionBtn = event.target?.closest?.('[data-room-action]');
        if (actionBtn) {
            event.preventDefault();
            event.stopPropagation();

            const roomId = actionBtn.getAttribute('data-room-id');
            const action = actionBtn.getAttribute('data-room-action');
            await academyApplyInboxRoomAction(roomId, action);
            return;
        }

        const menuTrigger = event.target?.closest?.('[data-room-menu-trigger]');
        if (menuTrigger) {
            event.preventDefault();
            event.stopPropagation();

            academyToggleInboxRoomMenu(menuTrigger.getAttribute('data-room-menu-trigger'));
            return;
        }

        const trigger = event.target?.closest?.('[data-inbox-room-id]');
        if (!trigger) {
            academyCloseInboxRoomMenu();
            return;
        }

        academyCloseInboxRoomMenu();
        academyOpenInboxRoomById(trigger.getAttribute('data-inbox-room-id'));
    });

    document.addEventListener('click', (event) => {
        const insideMenu = event.target?.closest?.('.academy-messages-inbox-actions');
        if (!insideMenu) {
            academyCloseInboxRoomMenu();
        }
    });

    document.getElementById('academy-messages-inbox-refresh')?.addEventListener('click', async () => {
        await academyHydrateMessageRooms(true);
    });

    document.getElementById('academy-messages-thread-back-btn')?.addEventListener('click', () => {
        academyReturnToMessagesInboxHome();
    });

    document.getElementById('academy-messages-thread-refresh-btn')?.addEventListener('click', () => {
        academyRefreshActiveMessagesThread();
    });
}

bindAcademyMessagesInbox();

async function academyOpenDirectMessageFromProfile(memberId = '') {
    const targetUserId =
        normalizeAcademyFeedId(memberId) ||
        normalizeAcademyFeedId(academyProfileViewState?.memberId);

    if (!targetUserId) {
        throw new Error('Missing member id.');
    }

    showAcademyTabLoader('Preparing direct messages...');
    setAcademyProfileMessageOpeningState(true, { phase: 'room' });

    try {
        const activeProfile =
            academyProfileViewState?.profile &&
            normalizeAcademyFeedId(academyProfileViewState.profile.id) === targetUserId
                ? academyProfileViewState.profile
                : await fetchAcademyMemberProfile(targetUserId);

        const result = await academyAuthedFetch('/api/realtime/rooms', {
            method: 'POST',
            body: JSON.stringify({
                roomType: 'dm',
                targetUserId
            })
        });

        const room = result?.room || null;
        if (!room?.id) {
            throw new Error('Failed to create direct message room.');
        }

        setAcademyProfileMessageOpeningState(true, { phase: 'opening' });

        const roomEntry = academyBuildDirectMessageRoomEntry(room, activeProfile);
        const state = getDashboardState();
        const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];
        const nextId = normalizeRoomKey(roomEntry.id || roomEntry.roomId);

        const nextRooms = [
            roomEntry,
            ...currentRooms.filter((item) => {
                const existingId = normalizeRoomKey(item?.id || item?.roomId || item?.room_key);
                return existingId !== nextId;
            })
        ];

        syncCustomRoomsUI(nextRooms);
        academyMessagesInboxState.activeRoomId = normalizeRoomKey(roomEntry.roomId || roomEntry.id);
        saveAcademyViewState('messages');
        setAcademySidebarActive('nav-messages');

        const transientRoomElement = academyCreateDirectMessageRoomElement(roomEntry);
        academyRefreshMessagesInboxSelection();
        openRoom('dm', transientRoomElement);
        academySetMessagesChatMode('thread');
        markCustomRoomAsRead(roomEntry.roomId || roomEntry.id);
        pulseAcademyRoomEntry(roomEntry.roomId || roomEntry.id);
        academyRefreshMessagesInboxSelection();
        academyRenderMessagesSidebarBadge();
        academyHydrateMessageRooms(false).catch(() => {});
        focusAcademyChatComposer();
    } finally {
        setAcademyProfileMessageOpeningState(false);
        hideAcademyTabLoader();
    }
}

async function academyProfileSendFriendRequest(memberId = '') {
    const normalizedMemberId = normalizeAcademyFeedId(memberId);
    if (!normalizedMemberId) {
        throw new Error('Missing member id.');
    }

    const result = await academyAuthedFetch('/api/academy/feed/friend-requests', {
        method: 'POST',
        body: JSON.stringify({
            receiverId: normalizedMemberId
        })
    });

    return result?.request || result;
}

async function academyProfileRespondToFriendRequest(requestId = '', action = 'accept') {
    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) {
        throw new Error('Missing friend request id.');
    }

    const result = await academyAuthedFetch(
        `/api/academy/feed/friend-requests/${encodeURIComponent(normalizedRequestId)}/respond`,
        {
            method: 'POST',
            body: JSON.stringify({ action })
        }
    );

    return result?.result || result;
}

async function openAcademyProfilePostInFeed(postId = '') {
    const normalizedPostId = normalizeAcademyFeedId(postId);
    if (!normalizedPostId) return;

    openAcademyFeedView();
    await loadAcademyFeed(true);

    window.requestAnimationFrame(() => {
        const target = Array.from(
            document.querySelectorAll('.academy-feed-card[data-post-id]')
        ).find((node) => {
            return normalizeAcademyFeedId(node.getAttribute('data-post-id')) === normalizedPostId;
        });

        if (!target) {
            showToast('Post not found in the current feed view.', 'error');
            return;
        }

        target.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        const previousOutline = target.style.outline;
        const previousBoxShadow = target.style.boxShadow;

        target.style.outline = '2px solid rgba(56,189,248,0.95)';
        target.style.boxShadow = '0 0 0 4px rgba(56,189,248,0.16)';

        window.setTimeout(() => {
            target.style.outline = previousOutline;
            target.style.boxShadow = previousBoxShadow;
        }, 1800);
    });
}
async function openAcademyProfileView(forceFresh = false) {
    saveAcademyViewState('profile');
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-profile');
    revealAcademyProfileView();

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    showAcademyTabLoader('Loading Profile.');

    try {
        const profile = await fetchCurrentAcademyProfile({
            allowCachedFallback: !forceFresh
        });

        const selfPayload = buildAcademySelfProfilePayload(profile);
        renderAcademyProfileView(selfPayload, { mode: 'self' });
    } catch (error) {
        console.error('openAcademyProfileView error:', error);

        const fallbackPayload = buildAcademySelfProfilePayload();
        renderAcademyProfileView(fallbackPayload, { mode: 'self' });

        showToast(error?.message || 'Failed to load Academy profile.', 'error');
    } finally {
        hideAcademyTabLoader();
    }
}

async function openAcademyMemberProfileView(memberId = '') {
    const normalizedMemberId = normalizeAcademyFeedId(memberId);
    if (!normalizedMemberId) return;

    showAcademyTabLoader('Loading Profile...');

    try {
        const profile = await fetchAcademyMemberProfile(normalizedMemberId);

        hideAcademyViewsForFeed();
        setAcademySidebarActive('');
        revealAcademyProfileView();

        currentRoom = null;
        currentRoomId = null;
        currentRoomMeta = null;

        closeAcademySearchResultsPanel();
        document.getElementById('academy-member-browser-modal')?.classList.add('hidden-step');

        renderAcademyProfileView(profile, { mode: 'visited' });
    } catch (error) {
        console.error('openAcademyMemberProfileView error:', error);
        showToast(error?.message || 'Failed to load member profile.', 'error');
    } finally {
        hideAcademyTabLoader();
    }
}
function openAcademyFeedAuthorProfile(memberId = '') {
    const normalizedMemberId = normalizeAcademyFeedId(memberId);
    if (!normalizedMemberId) return;

    const selfId =
        normalizeAcademyFeedId(getStoredUserValue('yh_user_id', '')) ||
        normalizeAcademyFeedId(getStoredUserValue('yh_user_uid', ''));

    if (selfId && normalizedMemberId === selfId) {
        openAcademyProfileView();
        return;
    }

    openAcademyMemberProfileView(normalizedMemberId);
}

function readAcademyFeedCachePosts() {
    try {
        const parsed = JSON.parse(localStorage.getItem('yh_academy_feed_cache') || '{}');
        return Array.isArray(parsed?.posts) ? parsed.posts : [];
    } catch (_) {
        return [];
    }
}

function normalizeAcademySearchValue(value) {
    return String(value || '').trim().toLowerCase();
}

function isAcademyHashtagSearch(value = '') {
    return /^#[a-z0-9_][a-z0-9_-]*$/i.test(String(value || '').trim());
}

function academySearchAliasesFor(query = '') {
    const normalizedQuery = normalizeAcademySearchValue(query);
    const aliases = new Set([normalizedQuery]);

    Object.entries(ACADEMY_TAG_SEARCH_ALIASES).forEach(([key, values]) => {
        const normalizedValues = [key, ...(Array.isArray(values) ? values : [])]
            .map((entry) => normalizeAcademySearchValue(entry))
            .filter(Boolean);

        if (normalizedValues.includes(normalizedQuery)) {
            normalizedValues.forEach((entry) => aliases.add(entry));
        }
    });

    return Array.from(aliases).filter(Boolean);
}

function academyPostMatchesSearch(post = {}, query = '') {
    const normalizedQuery = normalizeAcademySearchValue(query);
    if (!normalizedQuery) return true;

    if (isAcademyHashtagSearch(normalizedQuery)) {
        const needle = normalizedQuery.replace(/^#/, '');
        const matches = String(post?.body || '')
            .toLowerCase()
            .match(/#[a-z0-9_][a-z0-9_-]*/g) || [];

        const hashtags = matches
            .map((tag) => String(tag).replace(/^#/, '').trim())
            .filter(Boolean);

        return hashtags.includes(needle);
    }

    const aliases = academySearchAliasesFor(normalizedQuery);
    if (!aliases.length) return true;

    const haystack = [
        post?.body,
        post?.display_name,
        post?.fullName,
        post?.username,
        post?.role_label
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .join(' ');

    return aliases.some((alias) => haystack.includes(alias));
}

function academyRenderMemberBrowserList(members = [], query = '') {
    const list = document.getElementById('academy-member-browser-list');
    const summary = document.getElementById('academy-member-browser-summary');
    if (!list) return;

    const normalizedQuery = normalizeAcademySearchValue(query);
    const hashtagSearch = isAcademyHashtagSearch(normalizedQuery);

    if (summary) {
        summary.innerText = hashtagSearch
            ? `Showing profiles whose posts contain “${query.trim()}”.`
            : normalizedQuery
            ? `Showing members matching “${query.trim()}”.`
            : 'Browse members from the Academy database.';
    }

    if (!Array.isArray(members) || members.length === 0) {
        list.innerHTML = `<div class="academy-member-browser-empty">${
            hashtagSearch
                ? `No profiles have posted ${academyFeedEscapeHtml(query.trim())} yet.`
                : normalizedQuery
                ? 'No members matched that search yet.'
                : 'No members available right now.'
        }</div>`;
        return;
    }

    list.innerHTML = members.map((member) => {
        const displayName =
            member.display_name ||
            member.fullName ||
            member.username ||
            'Academy Member';

        const username = String(member.username || '').trim();
        const followerCount = Number(member.followers_count || 0);
        const isFollowing = member.followed_by_me === true || member.followed_by_me === 1;
        const avatar = academyResolveMemberAvatarUrl(member);

        const tagLine = hashtagSearch
            ? (Array.isArray(member.matched_hashtags) && member.matched_hashtags.length
                ? member.matched_hashtags.slice(0, 4).map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' • ')
                : academyFeedEscapeHtml(query.trim()))
            : (Array.isArray(member.search_tags) && member.search_tags.length
                ? member.search_tags.slice(0, 4).map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' • ')
                : '');

        const preview = hashtagSearch
            ? String(member.matched_post_preview || '').trim()
            : '';

        const countLabel = hashtagSearch
            ? `${Number(member.matched_posts_count || 0)} matching post${Number(member.matched_posts_count || 0) === 1 ? '' : 's'}`
            : `${followerCount} followers`;

        return `
            <article class="academy-member-card" data-member-id="${academyFeedEscapeHtml(member.id)}">
                <div class="academy-member-card-left">
                    <div
                        class="academy-member-card-avatar"
                        style="${avatar ? `background-image:url('${academyFeedEscapeHtml(avatar)}');` : ''}"
                    >${avatar ? '' : academyFeedEscapeHtml((displayName || 'A').charAt(0).toUpperCase())}</div>

                    <div class="academy-member-card-copy">
                        <div class="academy-member-card-name">${academyFeedEscapeHtml(displayName)}</div>
                        <div class="academy-member-card-meta">
                            ${academyFeedEscapeHtml(member.role_label || 'Academy Member')}
                            ${username ? ` • @${academyFeedEscapeHtml(username)}` : ''}
                            • ${academyFeedEscapeHtml(String(countLabel))}
                        </div>
                        ${tagLine ? `<div class="academy-member-card-meta">${academyFeedEscapeHtml(tagLine)}</div>` : ''}
                        ${preview ? `
                            <div class="academy-member-card-meta" style="margin-top:8px;line-height:1.55;color:#d1d5db;">
                                ${academyFeedEscapeHtml(preview)}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="academy-member-card-actions">
                    <button
                        type="button"
                        class="btn-primary academy-member-card-visit"
                        data-member-profile-id="${academyFeedEscapeHtml(member.id)}"
                    >Visit Profile</button>

                    <button
                        type="button"
                        class="btn-secondary academy-member-card-follow ${isFollowing ? 'is-following' : ''}"
                        data-member-follow-id="${academyFeedEscapeHtml(member.id)}"
                    >${isFollowing ? 'Following' : 'Follow'}</button>
                </div>
            </article>
        `;
    }).join('');
}

let academySearchDebounceTimer = null;
let academySearchRequestToken = 0;

async function requestAcademyMemberSearch(query = '') {
    const normalizedQuery = String(query || '').trim();
    const cacheKey = normalizedQuery.toLowerCase();
    const now = Date.now();
    const CACHE_TTL_MS = 15 * 1000;

    if (!normalizedQuery) return [];

    const cached = academyMemberSearchCache.get(cacheKey);
    if (cached && (now - cached.at) < CACHE_TTL_MS && Array.isArray(cached.members)) {
        return cached.members;
    }

    if (academyMemberSearchInFlight && academyMemberSearchInFlight.key === cacheKey) {
        return academyMemberSearchInFlight.promise;
    }

    const promise = academyAuthedFetch(
        `/api/academy/community/members?limit=24&query=${encodeURIComponent(normalizedQuery)}`,
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
}

function academySyncSearchInputs(value = '', sourceInputId = '') {
    const normalizedValue = String(value || '');
    ['academy-global-search-input', 'academy-member-browser-search-input'].forEach((id) => {
        if (id === sourceInputId) return;
        const input = document.getElementById(id);
        if (input && input.value !== normalizedValue) {
            input.value = normalizedValue;
        }
    });
}

function renderAcademySearchResultsLoadingPanel(query = '') {
    const panel = document.getElementById('academy-search-results-panel');
    const inner = document.getElementById('academy-search-results-inner');
    if (!panel || !inner) return;

    const safeQuery = academyFeedEscapeHtml(String(query || '').trim());

    panel.classList.remove('hidden-step');
    document.body?.classList.add('academy-search-results-open');

    inner.innerHTML = `
        <section class="academy-search-result-summary academy-search-result-summary-loading">
            <div class="academy-search-result-kicker">Academy Search</div>
            <h3 class="academy-search-result-heading">Searching for “${safeQuery}”</h3>
            <p class="academy-search-result-copy">Looking through matching member profiles and related post signals.</p>
        </section>

        <div class="academy-search-loading-grid">
            <div class="academy-search-loading-card">
                <div class="academy-search-loading-line academy-search-loading-line-lg"></div>
                <div class="academy-search-loading-line academy-search-loading-line-md"></div>
                <div class="academy-search-loading-line academy-search-loading-line-sm"></div>
            </div>
            <div class="academy-search-loading-card">
                <div class="academy-search-loading-line academy-search-loading-line-lg"></div>
                <div class="academy-search-loading-line academy-search-loading-line-md"></div>
                <div class="academy-search-loading-line academy-search-loading-line-sm"></div>
            </div>
        </div>
    `;
}

function scheduleAcademySearch(query = '', options = {}) {
    const normalizedQuery = String(query || '').trim();
    const sourceInputId = String(options.sourceInputId || '').trim();
    const immediate = options.immediate === true;

    academySyncSearchInputs(normalizedQuery, sourceInputId);
    window.clearTimeout(academySearchDebounceTimer);

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
}

function closeAcademySearchResultsPanel() {
    const panel = document.getElementById('academy-search-results-panel');
    const inner = document.getElementById('academy-search-results-inner');
    if (inner) inner.innerHTML = '';
    panel?.classList.add('hidden-step');
    document.body?.classList.remove('academy-search-results-open');
}

function resolveAcademyTagFromQuery(query = '') {
    const normalizedQuery = normalizeAcademySearchValue(query);
    if (!normalizedQuery) return '';

    for (const [key, values] of Object.entries(ACADEMY_TAG_SEARCH_ALIASES || {})) {
        const normalizedValues = [key, ...(Array.isArray(values) ? values : [])]
            .map((entry) => normalizeAcademySearchValue(entry))
            .filter(Boolean);

        if (normalizedValues.includes(normalizedQuery)) {
            return key;
        }
    }

    return '';
}

function renderAcademySearchResultsPanel(members = [], query = '') {
    const panel = document.getElementById('academy-search-results-panel');
    const inner = document.getElementById('academy-search-results-inner');
    if (!panel || !inner) return;

    const normalizedQuery = String(query || '').trim();
    const hashtagSearch = isAcademyHashtagSearch(normalizedQuery);
    const safeQuery = academyFeedEscapeHtml(normalizedQuery);

    if (!normalizedQuery) {
        closeAcademySearchResultsPanel();
        return;
    }

    panel.classList.remove('hidden-step');
    document.body?.classList.add('academy-search-results-open');

    if (!Array.isArray(members) || members.length === 0) {
        inner.innerHTML = `
            <section class="academy-search-result-summary">
                <div class="academy-search-result-kicker">Academy Search</div>
                <h3 class="academy-search-result-heading">
                    ${hashtagSearch ? `Profiles posting ${safeQuery}` : `Search results for “${safeQuery}”`}
                </h3>
                <p class="academy-search-result-copy">
                    ${hashtagSearch
                        ? `No profiles have posted ${safeQuery} yet.`
                        : `No members matched “${safeQuery}”.`}
                </p>
            </section>

            <section class="academy-search-result-empty-card">
                <div class="academy-search-result-empty-icon">🔎</div>
                <div class="academy-search-result-empty-title">Nothing matched yet</div>
                <div class="academy-search-result-empty-copy">
                    Try a different name, username, or hashtag. The search runs automatically while you type.
                </div>
            </section>
        `;
        return;
    }

    inner.innerHTML = `
        <section class="academy-search-result-summary">
            <div class="academy-search-result-kicker">Academy Search</div>
            <h3 class="academy-search-result-heading">
                ${hashtagSearch ? `Profiles posting ${safeQuery}` : `Search results for “${safeQuery}”`}
            </h3>
            <p class="academy-search-result-copy">
                ${hashtagSearch
                    ? `These profiles have actual community posts containing ${safeQuery}.`
                    : `Matching member profiles are shown below.`}
            </p>
            <div class="academy-search-result-count">
                ${members.length} ${members.length === 1 ? 'profile' : 'profiles'} found
            </div>
        </section>

        <div class="academy-search-result-list">
            ${members.map((member) => {
                const displayName =
                    member.display_name ||
                    member.fullName ||
                    member.username ||
                    'Academy Member';

                const username = String(member.username || '').trim();
                const followerCount = Number(member.followers_count || 0);
                const isFollowing = member.followed_by_me === true || member.followed_by_me === 1;
                const avatar = academyResolveMemberAvatarUrl(member);

                const tagLine = hashtagSearch
                    ? (Array.isArray(member.matched_hashtags) && member.matched_hashtags.length
                        ? member.matched_hashtags.slice(0, 4).map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' • ')
                        : normalizedQuery)
                    : (Array.isArray(member.search_tags) && member.search_tags.length
                        ? member.search_tags.slice(0, 4).map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' • ')
                        : '');

                const preview = hashtagSearch ? String(member.matched_post_preview || '').trim() : '';
                const countLine = hashtagSearch
                    ? `${Number(member.matched_posts_count || 0)} matching post${Number(member.matched_posts_count || 0) === 1 ? '' : 's'}`
                    : `${followerCount} followers`;

                return `
                    <article class="academy-search-result-card">
                        <div class="academy-search-result-main">
                            <div
                                class="academy-search-result-avatar"
                                style="${avatar ? `background-image:url('${academyFeedEscapeHtml(avatar)}');background-size:cover;background-position:center;` : ''}"
                            >${avatar ? '' : academyFeedEscapeHtml((displayName || 'A').charAt(0).toUpperCase())}</div>

                            <div class="academy-search-result-copy-wrap">
                                <div class="academy-search-result-name">${academyFeedEscapeHtml(displayName)}</div>
                                <div class="academy-search-result-meta">
                                    ${academyFeedEscapeHtml(member.role_label || 'Academy Member')}
                                    ${username ? ` • @${academyFeedEscapeHtml(username)}` : ''}
                                    • ${academyFeedEscapeHtml(countLine)}
                                </div>
                                ${tagLine ? `<div class="academy-search-result-tags">${academyFeedEscapeHtml(tagLine)}</div>` : ''}
                                ${preview ? `<div class="academy-search-result-preview">${academyFeedEscapeHtml(preview)}</div>` : ''}
                            </div>
                        </div>

                        <div class="academy-search-result-actions">
                            <button
                                type="button"
                                class="btn-primary academy-member-card-visit"
                                data-member-profile-id="${academyFeedEscapeHtml(member.id)}"
                            >Visit Profile</button>

                            <button
                                type="button"
                                class="btn-secondary academy-member-card-follow ${isFollowing ? 'is-following' : ''}"
                                data-member-follow-id="${academyFeedEscapeHtml(member.id)}"
                            >${isFollowing ? 'Following' : 'Follow'}</button>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}
async function loadAcademyMemberBrowser(query = '') {
    const list = document.getElementById('academy-member-browser-list');
    const modal = document.getElementById('academy-member-browser-modal');
    if (!list || !modal) return;

    const normalizedQuery = String(query || '').trim();

    modal.classList.remove('hidden-step');
    list.innerHTML = `<div class="academy-member-browser-empty">Loading members...</div>`;

    const members = normalizedQuery
        ? await requestAcademyMemberSearch(normalizedQuery)
        : await academyAuthedFetch(`/api/academy/community/members?limit=24&query=`, { method: 'GET' })
            .then((result) => (Array.isArray(result?.members) ? result.members : []))
            .catch(() => []);

    academyRenderMemberBrowserList(members, normalizedQuery);
}

async function applyAcademySearch(query = '', options = {}) {
    const normalizedQuery = String(query || '').trim();
    const sourceInputId = String(options.sourceInputId || '').trim();
    const requestToken = Number(options.requestToken || ++academySearchRequestToken);

    if (!options.skipDebounceReset) {
        window.clearTimeout(academySearchDebounceTimer);
    }

    academySyncSearchInputs(normalizedQuery, sourceInputId);

    const shouldRun = normalizedQuery.length >= 2;

    if (!document.getElementById('academy-feed-view')?.classList.contains('hidden-step')) {
        if (!shouldRun) {
            renderAcademyFeed(readAcademyFeedCachePosts());
        } else {
            const filteredPosts = readAcademyFeedCachePosts().filter((post) =>
                academyPostMatchesSearch(post, normalizedQuery)
            );
            renderAcademyFeed(filteredPosts);
        }
    }

    if (!shouldRun) {
        closeAcademySearchResultsPanel();

        const modal = document.getElementById('academy-member-browser-modal');
        if (modal && !modal.classList.contains('hidden-step') && normalizedQuery.length === 0) {
            loadAcademyMemberBrowser('').catch(() => {});
        }
        return;
    }

    const members = await requestAcademyMemberSearch(normalizedQuery);

    if (requestToken !== academySearchRequestToken) {
        return;
    }

    renderAcademySearchResultsPanel(members, normalizedQuery);

    const modal = document.getElementById('academy-member-browser-modal');
    if (modal && !modal.classList.contains('hidden-step')) {
        academyRenderMemberBrowserList(members, normalizedQuery);
    }
}

function normalizeAcademyLiveRoomId(value = '') {
    return String(value || '').trim();
}

function getAcademyLiveRoomType(room = {}) {
    const rawType = String(
        room?.room_type ||
        room?.roomType ||
        room?.type ||
        room?.room_type ||
        ''
    ).trim().toLowerCase();

    return rawType === 'video' ? 'video' : 'voice';
}

function getAcademyLiveLobbyNavId(roomOrType = {}) {
    const type = typeof roomOrType === 'string'
        ? String(roomOrType || '').trim().toLowerCase()
        : getAcademyLiveRoomType(roomOrType);

    return type === 'video' ? 'nav-video' : 'nav-voice';
}

function stopAcademyLiveMediaStream() {
    try {
        if (academyActiveMediaStream && typeof academyActiveMediaStream.getTracks === 'function') {
            academyActiveMediaStream.getTracks().forEach((track) => {
                try { track.stop(); } catch (_) {}
            });
        }
    } catch (_) {}

    academyActiveMediaStream = null;
}

function getAcademyLivePermissionToast(error, roomType = 'video') {
    const kindLabel = roomType === 'voice' ? 'microphone' : 'camera/microphone';
    const name = String(error?.name || '').trim();
    const message = String(error?.message || '').trim();

    if (/NotAllowedError|PermissionDeniedError/i.test(name)) {
        return `Permission denied. Please allow ${kindLabel} access in your browser site settings and try again.`;
    }
    if (/NotFoundError|DevicesNotFoundError/i.test(name)) {
        return `No ${kindLabel} device detected. Please connect a device and try again.`;
    }
    if (/NotReadableError|TrackStartError/i.test(name)) {
        return `Your ${kindLabel} is currently in use by another app. Close other apps and try again.`;
    }
    if (/OverconstrainedError/i.test(name)) {
        return `Your device cannot satisfy the requested ${kindLabel} settings. Try another device.`;
    }
    if (/SecurityError/i.test(name)) {
        return `Browser blocked ${kindLabel} access. Make sure you're on HTTPS and try again.`;
    }

    return message || `Failed to request ${kindLabel} permission.`;
}

async function ensureAcademyLiveMediaPermissions(roomType = 'video') {
    const normalized = String(roomType || '').trim().toLowerCase() === 'voice' ? 'voice' : 'video';
    const constraints = normalized === 'voice'
        ? { audio: true, video: false }
        : { audio: true, video: true };

    if (!navigator?.mediaDevices?.getUserMedia) {
        showToast('Your browser does not support camera/microphone access.', 'error');
        return null;
    }

    try {
        stopAcademyLiveMediaStream();
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        academyActiveMediaStream = stream;
        return stream;
    } catch (error) {
        console.warn('ensureAcademyLiveMediaPermissions error:', error);
        showToast(getAcademyLivePermissionToast(error, normalized), 'error');
        return null;
    }
}

function isAcademyLiveRoomHost(room = {}) {
    const hostName = String(room?.host_user_name || '').trim().toLowerCase();
    const currentName = String(myName || '').trim().toLowerCase();

    if (!hostName || !currentName) return false;
    return hostName === currentName;
}

function syncAcademyStageActionButtons(room = {}) {
    const leaveBtn = document.getElementById('btn-leave-stage');
    const endBtn = document.getElementById('btn-end-live-stage');
    const isHost = isAcademyLiveRoomHost(room);

    if (leaveBtn) {
        leaveBtn.textContent = isHost ? '⬅ Back to Lounge' : '📞 Leave Call';
    }

    if (endBtn) {
        endBtn.classList.toggle('hidden-step', !isHost);
    }
}

function renderAcademyStageFromRoom(room = {}, options = {}) {
    hideAcademyViewsForFeed();

    const roomType = getAcademyLiveRoomType(room);
    setAcademySidebarActive(getAcademyLiveLobbyNavId(roomType));

    const stageView = document.getElementById('center-stage-view');
    if (stageView) {
        stageView.classList.remove('hidden-step');

        if (options.animate === false) {
            stageView.classList.remove('fade-in');
        } else {
            stageView.classList.remove('fade-in');
            void stageView.offsetWidth;
            stageView.classList.add('fade-in');
        }
    }

    const defaultTitle = roomType === 'video' ? 'Live Video Room' : 'Live Voice Lounge';
    const defaultTopic = roomType === 'video'
        ? 'Live Academy video networking'
        : 'Live Academy networking';

    const roomTitle = String(room.title || defaultTitle).trim() || defaultTitle;
    const roomTopic = String(room.topic || defaultTopic).trim() || defaultTopic;
    const hostName = String(room.host_user_name || myName || 'Host').trim() || 'Host';

    const stageTitle = document.getElementById('stage-title');
    const hostNameEl = document.getElementById('host-name');
    const hostAvatar = document.getElementById('host-avatar');
    const stageTopic = document.querySelector('#center-stage-view .header-topic');
    const stageIcon = document.getElementById('stage-icon');

    if (stageTitle) stageTitle.innerText = roomTitle;
    if (hostNameEl) hostNameEl.innerText = hostName;
    if (hostAvatar) hostAvatar.innerText = hostName.charAt(0).toUpperCase();
    if (stageTopic) stageTopic.innerText = roomTopic;
    if (stageIcon) stageIcon.innerText = roomType === 'video' ? '📹' : '🎙️';

    const normalizedLiveRoomId = normalizeAcademyLiveRoomId(room?.id || room?.roomId || room?.room_id);

    currentRoom = roomTitle;
    currentRoomId = normalizedLiveRoomId || roomTitle;
    currentRoomMeta = {
        type: roomType === 'video' ? 'live-video' : 'live-voice',
        name: roomTitle,
        roomId: normalizedLiveRoomId || roomTitle,
        topic: roomTopic,
        hostName
    };

    if (stageChatInput) {
        stageChatInput.placeholder = `Message everyone in ${roomTitle}.`;
    }

    academyActiveLiveRoom = room;
    syncAcademyStageActionButtons(room);
}

async function openAcademyStageFromRoom(room = {}) {
    const roomId = normalizeAcademyLiveRoomId(room?.id || room?.roomId || room?.room_id);
    const roomType = getAcademyLiveRoomType(room);

    renderAcademyStageFromRoom(room);

    // Video rooms need camera + mic permissions. Voice can be listen-first.
    if (roomType === 'video') {
        await ensureAcademyLiveMediaPermissions('video');
    }

    if (!roomId) {
        academyActiveLiveRoom = room;
        return room;
    }

    try {
        const result = await academyAuthedFetch(`/api/realtime/live-rooms/${encodeURIComponent(roomId)}/join`, {
            method: 'POST'
        });

        const joinedRoom = result?.room && typeof result.room === 'object'
            ? result.room
            : room;

        const joinedType = getAcademyLiveRoomType(joinedRoom);

        academyActiveLiveRoom = joinedRoom;
        renderAcademyStageFromRoom(joinedRoom, { animate: false });
        socket.emit('joinRoom', currentRoomId);
        if (joinedType === 'video') {
            await loadAcademyVideoRooms(true);
        } else {
            await loadAcademyVoiceRooms(true);
        }

        return joinedRoom;
    } catch (error) {
        console.error('openAcademyStageFromRoom join error:', error);
        showToast(error?.message || 'Failed to join live room.', 'error');
        throw error;
    }
}

function renderAcademyVoiceRooms(rooms = []) {
    const grid = document.getElementById('lounge-grid');
    if (!grid) return;

    if (!Array.isArray(rooms) || rooms.length === 0) {
        grid.innerHTML = `<div class="academy-member-browser-empty" style="padding: 20px 0;">No live lounges yet. Start the first one.</div>`;
        return;
    }

    grid.innerHTML = rooms.map((room) => {
        const roomId = String(room.id || '').trim();
        const title = String(room.title || 'Live Voice Lounge').trim();
        const topic = String(room.topic || 'Live Academy networking').trim();
        const hostName = String(room.host_user_name || 'Host').trim();
        const participantCount = Number(room.participant_count || 0);

        return `
            <article
                class="academy-feed-card"
                data-live-room-id="${academyFeedEscapeHtml(roomId)}"
                style="padding:16px;border-radius:18px;"
            >
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.78rem;color:var(--neon-blue);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Live now</div>
                        <h4 style="margin-top:6px;color:#fff;font-size:1rem;line-height:1.3;">${academyFeedEscapeHtml(title)}</h4>
                        <p style="margin-top:8px;color:var(--text-muted);line-height:1.5;font-size:0.9rem;">${academyFeedEscapeHtml(topic)}</p>
                    </div>
                    <div style="padding:6px 10px;border-radius:999px;background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.25);color:var(--neon-blue);font-size:0.76rem;font-weight:700;">
                        ${academyFeedEscapeHtml(String(participantCount || 1))} live
                    </div>
                </div>

                <div style="margin-top:12px;color:var(--text-muted);font-size:0.82rem;">
                    Hosted by ${academyFeedEscapeHtml(hostName)}
                </div>

                <div style="margin-top:14px;display:flex;justify-content:flex-end;">
                    <button
                        type="button"
                        class="btn-primary academy-join-live-room-btn"
                        data-live-room-id="${academyFeedEscapeHtml(roomId)}"
                        style="width:auto;padding:10px 14px;"
                    >Join Stage</button>
                </div>
            </article>
        `;
    }).join('');
}

async function loadAcademyVoiceRooms(forceFresh = false) {
    const grid = document.getElementById('lounge-grid');
    if (!grid) return [];

    if (!forceFresh && Array.isArray(academyVoiceRoomsCache) && academyVoiceRoomsCache.length) {
        renderAcademyVoiceRooms(academyVoiceRoomsCache);
    } else if (forceFresh) {
        grid.innerHTML = `<div class="academy-member-browser-empty" style="padding: 20px 0;">Loading live lounges...</div>`;
    }

const result = await academyAuthedFetch('/api/realtime/live-rooms', { method: 'GET' });
    const roomsRaw = Array.isArray(result?.rooms) ? result.rooms : [];
    const rooms = roomsRaw.filter((room) => getAcademyLiveRoomType(room) === 'voice');

    academyVoiceRoomsCache = rooms;
    renderAcademyVoiceRooms(rooms);
    return rooms;
}

function renderAcademyVideoRooms(rooms = []) {
    const grid = document.getElementById('video-grid');
    if (!grid) return;

    if (!Array.isArray(rooms) || rooms.length === 0) {
        grid.innerHTML = `<div class="academy-member-browser-empty" style="padding: 20px 0;">No live video rooms yet. Start the first one.</div>`;
        return;
    }

    grid.innerHTML = rooms.map((room) => {
        const roomId = String(room.id || '').trim();
        const title = String(room.title || 'Live Video Room').trim();
        const topic = String(room.topic || 'Live Academy video networking').trim();
        const hostName = String(room.host_user_name || 'Host').trim();
        const participantCount = Number(room.participant_count || 0);

        return `
            <article
                class="academy-feed-card"
                data-live-room-id="${academyFeedEscapeHtml(roomId)}"
                style="padding:16px;border-radius:18px;"
            >
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.78rem;color:var(--neon-blue);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Live now</div>
                        <h4 style="margin-top:6px;color:#fff;font-size:1rem;line-height:1.3;">${academyFeedEscapeHtml(title)}</h4>
                        <p style="margin-top:8px;color:var(--text-muted);line-height:1.5;font-size:0.9rem;">${academyFeedEscapeHtml(topic)}</p>
                    </div>
                    <div style="padding:6px 10px;border-radius:999px;background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.25);color:var(--neon-blue);font-size:0.76rem;font-weight:700;">
                        ${academyFeedEscapeHtml(String(participantCount || 1))} live
                    </div>
                </div>

                <div style="margin-top:12px;color:var(--text-muted);font-size:0.82rem;">
                    Hosted by ${academyFeedEscapeHtml(hostName)}
                </div>

                <div style="margin-top:14px;display:flex;justify-content:flex-end;">
                    <button
                        type="button"
                        class="btn-primary academy-join-video-room-btn"
                        data-live-room-id="${academyFeedEscapeHtml(roomId)}"
                        style="width:auto;padding:10px 14px;"
                    >Join Room</button>
                </div>
            </article>
        `;
    }).join('');
}

async function loadAcademyVideoRooms(forceFresh = false) {
    const grid = document.getElementById('video-grid');
    if (!grid) return [];

    if (!forceFresh && Array.isArray(academyVideoRoomsCache) && academyVideoRoomsCache.length) {
        renderAcademyVideoRooms(academyVideoRoomsCache);
    } else if (forceFresh) {
        grid.innerHTML = `<div class="academy-member-browser-empty" style="padding: 20px 0;">Loading live video rooms...</div>`;
    }

    const result = await academyAuthedFetch('/api/realtime/live-rooms', { method: 'GET' });
    const roomsRaw = Array.isArray(result?.rooms) ? result.rooms : [];
    const rooms = roomsRaw.filter((room) => getAcademyLiveRoomType(room) === 'video');

    academyVideoRoomsCache = rooms;
    renderAcademyVideoRooms(rooms);
    return rooms;
}

/**
 * Forever fix: Join Room stays clickable even after leaving / re-rendering video cards.
 * Uses event delegation on #video-grid and binds only once.
 */
function bindAcademyVideoRoomJoinButtons() {
    if (window.__yhAcademyVideoJoinBound) return;
    window.__yhAcademyVideoJoinBound = true;

    const grid = document.getElementById('video-grid');
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
        const target = event?.target;
        const joinBtn = target?.closest?.('.academy-join-video-room-btn');
        if (!joinBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const roomId = normalizeAcademyLiveRoomId(joinBtn.getAttribute('data-live-room-id'));
        if (!roomId) return;

        await runDashboardButtonAction(joinBtn, 'Joining Video Room.', async () => {
            let room = (Array.isArray(academyVideoRoomsCache) ? academyVideoRoomsCache : [])
                .find((item) => normalizeAcademyLiveRoomId(item?.id) === roomId);

            if (!room) {
                const rooms = await loadAcademyVideoRooms(true);
                room = (Array.isArray(rooms) ? rooms : [])
                    .find((item) => normalizeAcademyLiveRoomId(item?.id) === roomId);
            }

            if (!room) {
                throw new Error('Live room not found.');
            }

            await openAcademyStageFromRoom(room);
        });
    });
}

bindAcademyVideoRoomJoinButtons();

async function createAcademyVideoRoom(title = '', topic = '') {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
        throw new Error('Room title is required.');
    }

    const cleanTopic = String(topic || '').trim();

    const result = await academyAuthedFetch('/api/realtime/live-rooms', {
        method: 'POST',
        body: JSON.stringify({
            roomType: 'video',
            title: cleanTitle,
            topic: cleanTopic
        })
    });

    const room = result?.room && typeof result.room === 'object'
        ? result.room
        : {
            title: cleanTitle,
            topic: cleanTopic,
            host_user_name: myName,
            room_type: 'video'
        };

    showToast('Live video room started.', 'success');
    await loadAcademyVideoRooms(true);
    openAcademyStageFromRoom(room);
}

/**
 * Forever fix: Join Stage stays clickable even after leaving / re-rendering lounge cards.
 * Uses event delegation on #lounge-grid and binds only once.
 */
function bindAcademyVoiceRoomJoinButtons() {
    if (window.__yhAcademyVoiceJoinBound) return;
    window.__yhAcademyVoiceJoinBound = true;

    const grid = document.getElementById('lounge-grid');
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
        const target = event?.target;
        const joinBtn = target?.closest?.('.academy-join-live-room-btn');
        if (!joinBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const roomId = normalizeAcademyLiveRoomId(joinBtn.getAttribute('data-live-room-id'));
        if (!roomId) return;

        await runDashboardButtonAction(joinBtn, 'Joining Stage.', async () => {
            let room = (Array.isArray(academyVoiceRoomsCache) ? academyVoiceRoomsCache : [])
                .find((item) => normalizeAcademyLiveRoomId(item?.id) === roomId);

            if (!room) {
                const rooms = await loadAcademyVoiceRooms(true);
                room = (Array.isArray(rooms) ? rooms : [])
                    .find((item) => normalizeAcademyLiveRoomId(item?.id) === roomId);
            }

            if (!room) {
                throw new Error('Live room not found.');
            }

            await openAcademyStageFromRoom(room);
        });
    });
}

bindAcademyVoiceRoomJoinButtons();
// (Removed duplicate VIDEO LOUNGE SYSTEM block – using the event-delegation implementation above.)
async function createAcademyVoiceRoom(title = '', topic = '') {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
        throw new Error('Room title is required.');
    }

    const cleanTopic = String(topic || '').trim();

    const result = await academyAuthedFetch('/api/realtime/live-rooms', {
        method: 'POST',
        body: JSON.stringify({
            roomType: 'voice',
            title: cleanTitle,
            topic: cleanTopic
        })
    });

    const room = result?.room && typeof result.room === 'object'
        ? result.room
        : {
            title: cleanTitle,
            topic: cleanTopic,
            host_user_name: myName
        };

    showToast('Live voice lounge started.', 'success');
    await loadAcademyVoiceRooms(true);
    openAcademyStageFromRoom(room);
}

function openAcademyLoungeCreateModal(roomType = 'voice') {
    const modal = document.getElementById('lounge-modal');
    const titleInput = document.getElementById('lounge-title-input');
    const topicInput = document.getElementById('lounge-topic-input');
    const submitBtn = document.getElementById('btn-create-lounge');

    const normalizedType = String(roomType || 'voice').trim().toLowerCase() === 'video' ? 'video' : 'voice';

    if (!modal) return;

    modal.setAttribute('data-room-type', normalizedType);

    if (titleInput) titleInput.value = '';

    if (topicInput) {
        topicInput.value = normalizedType === 'video'
            ? 'Live video networking inside The Academy'
            : 'Live networking inside The Academy';
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
        submitBtn.textContent = normalizedType === 'video' ? 'Start Video Call' : 'Start Lounge';
    }

    modal.classList.remove('hidden-step');
    setTimeout(() => titleInput?.focus(), 0);
}

function closeAcademyLoungeCreateModal() {
    const modal = document.getElementById('lounge-modal');
    if (modal) {
        modal.classList.add('hidden-step');
        modal.removeAttribute('data-room-type');
    }
}

function syncAcademyLoungeCreateModalState() {
    const titleInput = document.getElementById('lounge-title-input');
    const submitBtn = document.getElementById('btn-create-lounge');
    if (!submitBtn) return;

    const hasTitle = String(titleInput?.value || '').trim().length > 0;

    submitBtn.disabled = !hasTitle;
    submitBtn.classList.toggle('btn-disabled', !hasTitle);
}

async function submitAcademyLoungeCreateModal() {
    const modal = document.getElementById('lounge-modal');
    const submitBtn = document.getElementById('btn-create-lounge');
    const titleInput = document.getElementById('lounge-title-input');
    const topicInput = document.getElementById('lounge-topic-input');

    const roomType = String(modal?.getAttribute('data-room-type') || 'voice').trim().toLowerCase() === 'video'
        ? 'video'
        : 'voice';

    const title = String(titleInput?.value || '').trim();
    const topic = String(topicInput?.value || '').trim();

    if (!title) {
        showToast('Room title is required.', 'error');
        syncAcademyLoungeCreateModalState();
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
        submitBtn.textContent = 'Starting...';
    }

    try {
        if (roomType === 'video') {
            await createAcademyVideoRoom(title, topic);
        } else {
            await createAcademyVoiceRoom(title, topic);
        }
        closeAcademyLoungeCreateModal();
    } catch (error) {
        showToast(error.message || 'Failed to start live lounge.', 'error');
    } finally {
        if (submitBtn) submitBtn.textContent = roomType === 'video' ? 'Start Video Call' : 'Start Lounge';
        syncAcademyLoungeCreateModalState();
    }
}

async function loadAcademyFeed(forceReload = false) {
    const list = document.getElementById('academy-feed-list');
    if (!list) return;

    if (!forceReload) {
        const cached = localStorage.getItem('yh_academy_feed_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed?.posts)) {
                    renderAcademyFeed(parsed.posts);
                }
            } catch (error) {
                console.warn('Failed to parse Academy feed cache:', error);
            }
        }
    } else {
        list.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem;">Refreshing feed...</div>`;
    }

    try {
        const result = await academyAuthedFetch('/api/academy/feed?limit=20', { method: 'GET' });
        const posts = Array.isArray(result?.posts) ? result.posts : [];
        localStorage.setItem('yh_academy_feed_cache', JSON.stringify({ posts }));
        renderAcademyFeed(posts);

        const activeSearch = String(document.getElementById('academy-global-search-input')?.value || '').trim();
        if (activeSearch) {
            applyAcademySearch(activeSearch);
        }
    } catch (error) {
        if (!list.innerHTML.trim()) {
            list.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem;">Failed to load YHA feed.</div>`;
        }
        showToast(error.message || 'Failed to load YHA feed.', 'error');
    }
}

function renderAcademyFeed(posts = []) {
    const list = document.getElementById('academy-feed-list');
    if (!list) return;

    if (!Array.isArray(posts) || posts.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:2rem;">No posts yet. Be the first to post in YHA.</div>`;
        return;
    }

    list.innerHTML = posts.map((post) => {
        const displayName =
            post.display_name ||
            post.fullName ||
            post.username ||
            'Academy Member';

        const roleLabel = post.role_label || 'Academy Member';

        // FB-style shared post parsing:
        // body format is created by buildAcademyFeedSharePayload():
        // [caption?]\n\nShared from NAME (ROLE)\n\n“original body”
        const rawBodyText = String(post.body || '');
        const isSharedPost = /Shared from /i.test(rawBodyText);

        let sharedCaptionText = '';
        let sharedFromName = '';
        let sharedFromRole = '';
        let sharedOriginalBody = '';

        if (isSharedPost) {
            const parts = rawBodyText
                .split(/\n\s*\n/)
                .map((p) => p.trim())
                .filter(Boolean);

            const shareIdx = parts.findIndex((p) => /^Shared from\s+/i.test(p));
            if (shareIdx >= 0) {
                sharedCaptionText = parts.slice(0, shareIdx).join('\n\n').trim();

                const sharedLineRaw = parts[shareIdx] || '';
                const sharedLine = sharedLineRaw.replace(/^Shared from\s+/i, '').trim();

                const match = sharedLine.match(/^(.*?)(?:\s*\(([^)]+)\))?\s*$/);
                sharedFromName = (match ? match[1] : sharedLine).trim();
                sharedFromRole = (match && match[2] ? match[2] : '').trim();

                const tail = parts.slice(shareIdx + 1).join('\n\n').trim();
                sharedOriginalBody = tail
                    .replace(/^["“]+/, '')
                    .replace(/["”]+$/, '')
                    .trim();
            }
        }

        // Main body shows only the sharer's caption (not the "Shared from..." line)
        const mainBodyText = isSharedPost ? sharedCaptionText : rawBodyText;
        const bodyHtml = academyFeedEscapeHtml(mainBodyText || '').replace(/\n/g, '<br>');
        const hasMainBody = String(mainBodyText || '').trim().length > 0;

        const bodyBlockHtml = hasMainBody
            ? `<div style="margin-top:8px;color:#e5e7eb;line-height:1.45;font-size:0.92rem;">${bodyHtml}</div>`
            : '';

        // Media goes inside the embed card for shared posts (FB style)
        const resolvedMediaUrl = String(
            post.media_url ||
            post.image_url ||
            post.video_url ||
            ''
        ).trim();

        const resolvedMediaKind = String(
            post.media_kind ||
            (String(post.video_url || '').trim() ? 'video' : resolvedMediaUrl ? 'image' : '')
        ).trim().toLowerCase();

        const outerMediaHtml = resolvedMediaUrl
            ? (
                resolvedMediaKind === 'video'
                    ? `<video src="${academyFeedEscapeHtml(resolvedMediaUrl)}" controls preload="metadata" style="width:100%;max-width:100%;border-radius:14px;margin-top:12px;border:1px solid rgba(255,255,255,0.06);background:#020617;"></video>`
                    : `<img src="${academyFeedEscapeHtml(resolvedMediaUrl)}" alt="Post image" style="width:100%;max-width:100%;border-radius:14px;margin-top:12px;border:1px solid rgba(255,255,255,0.06);">`
            )
            : '';

        const embedMediaHtml = resolvedMediaUrl
            ? (
                resolvedMediaKind === 'video'
                    ? `<video src="${academyFeedEscapeHtml(resolvedMediaUrl)}" controls preload="metadata" style="width:100%;max-width:100%;border-radius:12px;margin-top:10px;border:1px solid rgba(255,255,255,0.06);background:#020617;"></video>`
                    : `<img src="${academyFeedEscapeHtml(resolvedMediaUrl)}" alt="Shared post image" style="width:100%;max-width:100%;border-radius:12px;margin-top:10px;border:1px solid rgba(255,255,255,0.06);">`
            )
            : '';

        const sharedEmbedHtml =
            isSharedPost && (sharedFromName || sharedOriginalBody || resolvedMediaUrl)
                ? `
                    <div class="academy-feed-share-embed">
                        <div class="academy-feed-share-embed-header">
                            <div class="academy-feed-share-embed-label">Shared post</div>
                            <div class="academy-feed-share-embed-meta">
                                <span class="academy-feed-share-embed-name">${academyFeedEscapeHtml(sharedFromName || 'Academy Member')}</span>
                                ${
                                    sharedFromRole
                                        ? `<span class="academy-feed-share-embed-role">${academyFeedEscapeHtml(sharedFromRole)}</span>`
                                        : ``
                                }
                            </div>
                        </div>
                        ${
                            sharedOriginalBody
                                ? `<div class="academy-feed-share-embed-body">${academyFeedEscapeHtml(sharedOriginalBody).replace(/\n/g, '<br>')}</div>`
                                : ``
                        }
                        ${embedMediaHtml}
                    </div>
                `
                : '';

        const mediaHtml = isSharedPost ? '' : outerMediaHtml;
        const avatarHtml = renderAcademyFeedAvatarHtml(post, displayName);

        const isOwner = Boolean(Number(post.owned_by_me || 0));
        const hiddenPosts = readAcademyHiddenPostIds();
        const normalizedPostId = normalizeAcademyFeedId(post.id);

        if (hiddenPosts.includes(normalizedPostId)) {
            return '';
        }

        return `
            <article class="academy-feed-card academy-feed-post-compact" data-post-id="${post.id}" data-author-id="${post.user_id}">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    ${avatarHtml}

                    <div style="min-width:0;flex:1;">
                        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                            <div>
                                <button
                                    type="button"
                                    class="academy-feed-author-trigger academy-feed-author-name"
                                    data-member-profile-id="${academyFeedEscapeHtml(normalizeAcademyFeedId(post.user_id))}"
                                    style="font-weight:700;color:#fff;line-height:1.15;"
                                >${academyFeedEscapeHtml(displayName)}</button>

                                <div style="font-size:0.76rem;color:var(--text-muted);line-height:1.2;margin-top:2px;">${academyFeedEscapeHtml(roleLabel)} • ${academyFeedTimeLabel(post.created_at)}</div>
                            </div>

                            <div style="position:relative;">
                                <button
                                    type="button"
                                    class="btn-secondary academy-feed-post-menu-btn"
                                    data-post-id="${post.id}"
                                    style="width:auto;padding:4px 10px;min-height:auto;border-radius:999px;"
                                >•••</button>

                                <div class="academy-feed-post-menu hidden-step" id="academy-feed-post-menu-${post.id}" style="position:absolute;top:calc(100% + 6px);right:0;min-width:160px;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px;display:grid;gap:6px;z-index:20;">
                                    <button type="button" class="btn-secondary academy-feed-hide-btn" data-post-id="${post.id}" style="width:100%;padding:8px 10px;">Hide from My Feed</button>
                                    ${
                                        isOwner
                                            ? `<button type="button" class="btn-secondary academy-feed-delete-btn" data-post-id="${post.id}" style="width:100%;padding:8px 10px;">${isSharedPost ? 'Delete Shared Post' : 'Delete Post'}</button>`
                                            : ``
                                    }
                                </div>
                            </div>
                        </div>

                        ${bodyBlockHtml}
                        ${sharedEmbedHtml}
                        ${mediaHtml}

                        <div class="academy-feed-post-actions-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:6px;margin-top:10px;">
                            <button
                                type="button"
                                class="btn-secondary academy-feed-like-btn"
                                data-post-id="${post.id}"
                                style="width:100%;padding:7px 8px;min-height:40px;"
                            >🤍 Like (${Number(post.like_count || 0)})</button>

                            <button
                                type="button"
                                class="btn-secondary academy-feed-comments-toggle-btn"
                                data-post-id="${post.id}"
                                style="width:100%;padding:7px 8px;min-height:40px;"
                            >💬 Comment (${Number(post.comment_count || 0)})</button>

                            <button
                                type="button"
                                class="btn-secondary academy-feed-share-btn"
                                data-post-id="${post.id}"
                                style="width:100%;padding:7px 8px;min-height:40px;"
                            >↗ Share</button>
                        </div>

                        <div class="academy-feed-comments-wrap hidden-step" id="academy-feed-comments-${post.id}" style="margin-top:10px;">
                            <div class="academy-feed-comments-list" id="academy-feed-comments-list-${post.id}" style="display:grid;gap:8px;margin-bottom:10px;"></div>
                            <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;">
                                <textarea
                                    id="academy-feed-comment-input-${post.id}"
                                    class="chat-text-input"
                                    rows="2"
                                    placeholder="Write a comment."
                                    style="flex:1;min-width:220px;border-radius:12px;padding:10px;"
                                ></textarea>
                                <button
                                    type="button"
                                    class="btn-secondary academy-feed-comment-submit-btn"
                                    data-post-id="${post.id}"
                                    style="width:100%;padding:7px 8px;min-height:40px;"
                                >💬 Comment</button>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}
function buildAcademyFeedSharePayload(post, caption = '') {
    const displayName =
        post?.display_name ||
        post?.fullName ||
        post?.username ||
        'Academy Member';

    const roleLabel = post?.role_label || 'Academy Member';
    const originalBody = String(post?.body || '').trim();
    const cleanCaption = String(caption || '').trim();

    const mediaUrl = String(
        post?.media_url ||
        post?.image_url ||
        post?.video_url ||
        ''
    ).trim();

    const mediaKind = String(
        post?.media_kind ||
        (String(post?.video_url || '').trim() ? 'video' : mediaUrl ? 'image' : '')
    ).trim().toLowerCase();

    const bodyParts = [];

    if (cleanCaption) bodyParts.push(cleanCaption);
    bodyParts.push(`Shared from ${displayName} (${roleLabel})`);
    if (originalBody) bodyParts.push(`“${originalBody}”`);

    return {
        body: bodyParts.join(`\n\n`),
        imageUrl: mediaKind === 'image' ? mediaUrl : '',
        mediaUrl,
        mediaKind,
        mediaType: String(post?.media_type || '').trim(),
        mediaSize: Number(post?.media_size || 0) || 0
    };
}

let academyFeedDeleteTargetPostId = '';
let academyMemberSearchDebounce = null;
let academyMemberSearchCache = new Map();
let academyMemberSearchInFlight = null;
let academyVoiceRoomsCache = [];
let academyVideoRoomsCache = [];
let academyActiveLiveRoom = null;
let academyActiveMediaStream = null;

const ACADEMY_TAG_SEARCH_ALIASES = {
    academy: ['academy', 'the academy', 'yha'],
    roadmap: ['roadmap', 'mission', 'missions', 'execution hub'],
    community: ['community', 'community feed', 'feed', 'academy community'],
    voice: ['voice', 'voice lounge', 'live voice', 'lounge', 'stage']
};

function academyFeedCloseShareModal() {
    const modal = document.getElementById('academy-feed-share-modal');
    const captionInput = document.getElementById('academy-feed-share-caption');
    const preview = document.getElementById('academy-feed-share-preview');

    academyFeedShareTargetPost = null;

    if (captionInput) captionInput.value = '';
    if (preview) preview.innerHTML = '';
    if (modal) modal.classList.add('hidden-step');
    document.body?.classList.remove('academy-feed-share-open');
}

async function academyFeedOpenDeleteModal(postId) {
    const normalizedPostId = normalizeAcademyFeedId(postId);
    academyFeedDeleteTargetPostId = normalizedPostId;
    if (!normalizedPostId) return;

    const confirmed = await openYHConfirmModal({
        title: 'Delete this post?',
        message: 'This action will remove the post from the community feed.',
        okText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger'
    });

    if (!confirmed) return;

    try {
        await academyAuthedFetch(`/api/academy/feed/posts/${normalizedPostId}`, {
            method: 'DELETE'
        });

        showToast('Post deleted successfully.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Delete endpoint is not wired yet.', 'error');
    }
}

function academyFeedCloseDeleteModal() {
    // kept for backward compatibility (old UI used a dedicated delete modal)
    academyFeedDeleteTargetPostId = '';
    document.getElementById('academy-feed-delete-modal')?.classList.add('hidden-step');
}

function academyFeedOpenShareModal(postId) {
    const normalizedPostId = normalizeAcademyFeedId(postId);
    const cacheRaw = localStorage.getItem('yh_academy_feed_cache');
    let cachedPosts = [];

    if (cacheRaw) {
        try {
            const parsed = JSON.parse(cacheRaw);
            cachedPosts = Array.isArray(parsed?.posts) ? parsed.posts : [];
        } catch (error) {
            cachedPosts = [];
        }
    }

    const targetPost = cachedPosts.find((post) => normalizeAcademyFeedId(post?.id) === normalizedPostId);
    if (!targetPost) {
        showToast('Post not found for sharing.', 'error');
        return;
    }

    academyFeedShareTargetPost = targetPost;

    const modal = document.getElementById('academy-feed-share-modal');
    const preview = document.getElementById('academy-feed-share-preview');

    if (preview) {
        const author = academyFeedEscapeHtml(
            targetPost.display_name ||
            targetPost.fullName ||
            targetPost.username ||
            'Academy Member'
        );
        const body = academyFeedEscapeHtml(String(targetPost.body || '')).replace(/\n/g, '<br>');

        const previewMediaUrl = String(
            targetPost.media_url ||
            targetPost.image_url ||
            targetPost.video_url ||
            ''
        ).trim();

        const previewMediaKind = String(
            targetPost.media_kind ||
            (String(targetPost.video_url || '').trim() ? 'video' : previewMediaUrl ? 'image' : '')
        ).trim().toLowerCase();

        const media = previewMediaUrl
            ? (
                previewMediaKind === 'video'
                    ? `<video src="${academyFeedEscapeHtml(previewMediaUrl)}" controls preload="metadata" class="academy-feed-share-preview-image" style="background:#020617;"></video>`
                    : `<img src="${academyFeedEscapeHtml(previewMediaUrl)}" alt="Shared post image" class="academy-feed-share-preview-image">`
            )
            : '';

        preview.innerHTML = `
            <div class="academy-feed-share-preview-author">${author}</div>
            <div class="academy-feed-share-preview-body">${body}</div>
            ${media}
        `;
    }

    modal?.classList.remove('hidden-step');
    document.body?.classList.add('academy-feed-share-open');
    document.getElementById('academy-feed-share-caption')?.focus();
}

async function academyFeedSubmitShare() {
    if (!academyFeedShareTargetPost) {
        showToast('No post selected for sharing.', 'error');
        return;
    }

    const captionInput = document.getElementById('academy-feed-share-caption');
    const caption = String(captionInput?.value || '').trim();
    const payload = buildAcademyFeedSharePayload(academyFeedShareTargetPost, caption);

    try {
        await academyAuthedFetch('/api/academy/feed/posts', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        academyFeedCloseShareModal();
        showToast('Post shared to community.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to share post.', 'error');
    }
}
let academyFeedComposerUploadInFlight = false;

function academyFeedGetComposerMediaState() {
    const mediaDataInput = document.getElementById('academy-feed-image-data');
    const mediaUrl = String(mediaDataInput?.value || '').trim();
    const mediaKind = String(mediaDataInput?.dataset?.mediaKind || '').trim().toLowerCase();
    const mediaType = String(mediaDataInput?.dataset?.mediaType || '').trim();
    const mediaSize = Number(mediaDataInput?.dataset?.mediaSize || 0) || 0;

    if (!mediaUrl) {
        return {
            url: '',
            kind: '',
            type: '',
            size: 0
        };
    }

    return {
        url: mediaUrl,
        kind: mediaKind === 'video' ? 'video' : 'image',
        type: mediaType,
        size: mediaSize
    };
}

function academyFeedSetComposerMediaState(media = null) {
    const mediaDataInput = document.getElementById('academy-feed-image-data');
    if (!mediaDataInput) return;

    if (!media || !media.url) {
        mediaDataInput.value = '';
        delete mediaDataInput.dataset.mediaKind;
        delete mediaDataInput.dataset.mediaType;
        delete mediaDataInput.dataset.mediaSize;
        return;
    }

    mediaDataInput.value = String(media.url || '').trim();
    mediaDataInput.dataset.mediaKind = String(media.kind || '').trim().toLowerCase();
    mediaDataInput.dataset.mediaType = String(media.mimeType || media.type || '').trim();
    mediaDataInput.dataset.mediaSize = String(Number(media.sizeBytes ?? media.size ?? 0) || 0);
}

function academyFeedClearComposerMedia() {
    const imageFileInput = document.getElementById('academy-feed-image-file');
    if (imageFileInput) imageFileInput.value = '';

    academyFeedSetComposerMediaState(null);
    academyFeedRenderComposerPreview(null);
}

window.academyFeedClearComposerMedia = academyFeedClearComposerMedia;

function academyFeedRenderComposerPreview(media = null) {
    const previewWrap = document.getElementById('academy-feed-image-preview-wrap');
    if (!previewWrap) return;

    if (!media || !media.url) {
        previewWrap.innerHTML = '';
        previewWrap.classList.add('hidden-step');
        return;
    }

    const safeUrl = academyFeedEscapeHtml(String(media.url || '').trim());
    const mediaKind = String(media.kind || '').trim().toLowerCase() === 'video' ? 'video' : 'image';

    const mediaHtml = mediaKind === 'video'
        ? `<video src="${safeUrl}" controls preload="metadata" style="width:100%;max-width:100%;display:block;border-radius:14px;border:1px solid rgba(255,255,255,0.06);background:#020617;"></video>`
        : `<img id="academy-feed-image-preview" src="${safeUrl}" alt="Selected upload preview" style="width:100%;max-width:100%;display:block;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">`;

    previewWrap.innerHTML = `
        <div style="position:relative;margin-top:12px;">
            <button
                type="button"
                onclick="academyFeedClearComposerMedia()"
                aria-label="Remove selected media"
                title="Remove media"
                style="position:absolute;top:10px;right:10px;z-index:3;width:34px;height:34px;border:none;border-radius:999px;background:rgba(2,6,23,0.88);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,0.35);"
            >×</button>
            ${mediaHtml}
        </div>
    `;

    previewWrap.classList.remove('hidden-step');
}
async function academyFeedUploadComposerMedia(file) {
    if (!file || typeof file.size === 'undefined') {
        throw new Error('Please select a valid file.');
    }

    const token = getStoredAuthToken();
    const mimeType = String(file.type || '').trim();
    const mediaKind = mimeType.toLowerCase().startsWith('video/')
        ? 'video'
        : 'image';

    const response = await fetch('/api/academy/feed/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': mimeType || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'upload'),
            'X-File-Size': String(Number(file.size || 0)),
            'X-Media-Kind': mediaKind,
            'X-File-Mime': mimeType || ''
        },
        body: file
    });

    const responseType = String(response.headers.get('content-type') || '').toLowerCase();

    let result = {};
    if (responseType.includes('application/json')) {
        result = await response.json().catch(() => ({}));
    } else {
        const text = await response.text().catch(() => '');
        result = {
            success: false,
            message: text || 'Upload failed.'
        };
    }

    if (response.status === 401) {
        showToast('Your session expired. Please log in again.', 'error');
        window.location.href = '/';
        throw new Error(result.message || 'Session expired.');
    }

    if (!response.ok || result?.success === false || !result?.media?.url) {
        throw new Error(result?.message || 'Failed to upload media.');
    }

    return result.media;
}

async function academyFeedSubmitPost() {
    const input = document.getElementById('academy-feed-composer-input');
    const submitBtn = document.getElementById('academy-feed-post-btn');

    if (!input) return;

    if (academyFeedComposerUploadInFlight) {
        showToast('Please wait for the upload to finish first.', 'error');
        return;
    }

    const body = String(input.value || '').trim();
    const media = academyFeedGetComposerMediaState();

    if (!body && !media.url) {
        showToast('Write something or attach a photo/video before posting.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Posting...';
        }

        await academyAuthedFetch('/api/academy/feed/posts', {
            method: 'POST',
            body: JSON.stringify({
                body,
                imageUrl: media.kind === 'image' ? media.url : '',
                mediaUrl: media.url,
                mediaKind: media.kind,
                mediaType: media.type,
                mediaSize: media.size
            })
        });

        resetAcademyFeedComposer();
        showToast('Posted to YHA Community.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to create post.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Post';
        }
    }
}

async function academyFeedToggleLike(postId) {
    try {
        await academyAuthedFetch(`/api/academy/feed/posts/${postId}/like`, {
            method: 'POST'
        });
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to toggle like.', 'error');
    }
}

async function academyFeedLoadComments(postId, forceOpen = false) {
    const wrap = document.getElementById(`academy-feed-comments-${postId}`);
    const list = document.getElementById(`academy-feed-comments-list-${postId}`);
    if (!wrap || !list) return;

    if (!forceOpen && !wrap.classList.contains('hidden-step')) {
        wrap.classList.add('hidden-step');
        return;
    }

    wrap.classList.remove('hidden-step');
    list.innerHTML = `<div style="color:var(--text-muted);">Loading comments...</div>`;

    try {
        const result = await academyAuthedFetch(`/api/academy/feed/posts/${postId}/comments`, {
            method: 'GET'
        });

        const comments = Array.isArray(result?.comments) ? result.comments : [];

        if (!comments.length) {
            list.innerHTML = `<div style="color:var(--text-muted);">No comments yet.</div>`;
            return;
        }

        list.innerHTML = comments.map((comment) => {
            const displayName =
                comment.display_name ||
                comment.fullName ||
                comment.username ||
                'Academy Member';

            return `
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;">
                    <div style="font-weight:600;color:#fff;">${academyFeedEscapeHtml(displayName)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${academyFeedTimeLabel(comment.created_at)}</div>
                    <div style="margin-top:8px;color:#e5e7eb;line-height:1.55;">${academyFeedEscapeHtml(comment.body || '').replace(/\n/g, '<br>')}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        list.innerHTML = `<div style="color:var(--text-muted);">Failed to load comments.</div>`;
    }
}

async function academyFeedSubmitComment(postId) {
    const input = document.getElementById(`academy-feed-comment-input-${postId}`);
    const body = String(input?.value || '').trim();

    if (!body) {
        showToast('Comment cannot be empty.', 'error');
        return;
    }

    try {
        await academyAuthedFetch(`/api/academy/feed/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body })
        });

        if (input) input.value = '';
        await academyFeedLoadComments(postId, true);
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to post comment.', 'error');
    }
}

async function academyFeedToggleFollow(targetUserId) {
    const normalizedTargetUserId = normalizeAcademyFeedId(targetUserId);

    if (!normalizedTargetUserId) {
        showToast('Invalid user target.', 'error');
        return;
    }

    try {
        const result = await academyAuthedFetch(`/api/academy/community/members/${encodeURIComponent(normalizedTargetUserId)}/follow`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        showToast(result?.following ? 'User followed.' : 'User unfollowed.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to update follow status.', 'error');
    }
}
async function academyFeedSendFriendRequest(targetUserId) {
    try {
        await academyAuthedFetch('/api/academy/feed/friend-requests', {
            method: 'POST',
            body: JSON.stringify({ targetUserId })
        });

        showToast('Friend request sent.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to send friend request.', 'error');
    }
}
async function loadAcademyHome(forceFresh = false) {
    let cachedHome = null;

    if (!forceFresh) {
        cachedHome = readAcademyHomeCache();
        if (cachedHome) {
            renderAcademyHome(cachedHome);
        }
    }

    try {
        const result = await academyAuthedFetch('/api/academy/home', {
            method: 'GET'
        });

        persistAcademyHome(result);
        renderAcademyHome(result);
        return result;
    } catch (error) {
        if (!cachedHome) {
            renderAcademyHome();
            showToast(error.message || "Failed to load Academy home.", "error");
        }
        return null;
    }
}

function hideDivisionViews() {
    document.getElementById('view-plazas')?.classList.add('hidden-step');
    document.getElementById('view-federation')?.classList.add('hidden-step');
    if (academyWrapper) academyWrapper.style.display = 'none';
    if (universeHubView) universeHubView.style.display = 'none';
}

function setDashboardViewMode(mode = 'hub') {
    document.body?.setAttribute('data-yh-view', mode);
}

/* shared dashboard view-state helpers now come from /js/yh-shared-runtime.js */

function restoreDashboardViewState() {
    const state = readDashboardViewState();

    const canEnterAcademy =
        localStorage.getItem('yh_academy_access') === 'true' ||
        (typeof readAcademyMembershipCache === 'function' && readAcademyMembershipCache()?.canEnterAcademy === true);

    if (!canEnterAcademy) {
        goToDashboardPage();
        return;
    }

    const requestedSection = getAcademySectionFromUrl();
    const savedSection = String(state.academySection || 'home').trim().toLowerCase();
    const targetSection = requestedSection !== 'home' ? requestedSection : savedSection;

    enterAcademyWorld('home');

    if (targetSection === 'profile') {
        window.requestAnimationFrame(() => {
            openAcademyProfileView();
        });
        return;
    }

    if (targetSection === 'messages') {
        window.requestAnimationFrame(() => {
            openAcademyMessagesView();
        });
        return;
    }

    if (targetSection === 'voice') {
        window.requestAnimationFrame(() => {
            setAcademySidebarActive('nav-voice');
            openRoom('voice-lobby', document.getElementById('nav-voice'));
        });
        return;
    }

    if (targetSection === 'video') {
        window.requestAnimationFrame(() => {
            setAcademySidebarActive('nav-voice');
            openRoom('video', document.getElementById('nav-voice'));
        });
        return;
    }

    if (targetSection === 'community') {
        window.requestAnimationFrame(() => {
            openAcademyFeedView();
        });
        return;
    }
}

function setAcademySidebarActive(activeId = '') {
    document.querySelectorAll('.channel-link').forEach((link) => {
        link.classList.remove('active');
    });

    document.querySelectorAll('.academy-mobile-nav-item[data-academy-target], .academy-mobile-bottom-nav-item[data-academy-target]').forEach((item) => {
        item.classList.remove('is-active');
        item.removeAttribute('aria-current');
    });

    if (activeId) {
        document.getElementById(activeId)?.classList.add('active');

        document
            .querySelectorAll(`.academy-mobile-nav-item[data-academy-target="${activeId}"], .academy-mobile-bottom-nav-item[data-academy-target="${activeId}"]`)
            .forEach((item) => {
                item.classList.add('is-active');
                item.setAttribute('aria-current', 'page');
            });
    }
}

function syncAcademyShellForViewport() {
    if (!leftSidebar || !rightSidebar || !academyWrapper) return;

    const isTabletOrSmaller = window.innerWidth <= 1024;
    const isPhone = window.innerWidth <= 768;
    const viewMode = document.body?.getAttribute('data-yh-view');

    if (viewMode === 'academy') {
        academyWrapper.style.display = 'flex';
        academyWrapper.classList.toggle('academy-mobile-shell', isPhone);
        leftSidebar.style.display = isPhone ? 'none' : 'flex';
        rightSidebar.style.display = isTabletOrSmaller ? 'none' : 'flex';
        return;
    }

    academyWrapper.classList.remove('academy-mobile-shell');
}

function showUniverseHub(activeDivision = 'academy', options = {}) {
    saveUniverseViewState(activeDivision);
    goToDashboardPage();
}

function enterAcademyWorld(defaultSection = 'home') {
    showAcademyTabLoader('Entering Academy...');
    try {
        hideDivisionViews();
        closeAcademyLauncher();

        if (academyWrapper) {
            academyWrapper.style.display = 'flex';
            academyWrapper.classList.remove('fade-in');
            void academyWrapper.offsetWidth;
            academyWrapper.classList.add('fade-in');
        }

        activeUniverseDivision = 'academy';
        syncUniverseFeaturePanel('academy');
        setDashboardViewMode('academy');
        syncAcademyShellForViewport();

        if (defaultSection === 'community') {
            openAcademyFeedView();
            return;
        }

        if (defaultSection === 'messages') {
            openAcademyMessagesView();
            return;
        }

        if (defaultSection === 'voice') {
            setAcademySidebarActive('nav-voice');
            openRoom('voice-lobby', document.getElementById('nav-voice'));
            return;
        }

        if (defaultSection === 'video') {
            setAcademySidebarActive('nav-voice'); // fallback since wala pang nav-video
            openRoom('video', document.getElementById('nav-voice'));
            return;
        }

        const membership = (typeof readAcademyMembershipCache === 'function')
            ? readAcademyMembershipCache()
            : null;

        const hasRoadmapAccess = membership?.hasRoadmapAccess === true;

        if (hasRoadmapAccess) {
            openAcademyRoadmapView();
            return;
        }

        openAcademyFeedView();
    } finally {
        // IMPORTANT:
        // - This “hide” only releases the entry-loader depth.
        // - Your tab loaders (Roadmap/Feed/Voice/Video) still control the final hide.
        hideAcademyTabLoader();
    }
}
window.enterAcademyWorld = enterAcademyWorld;
document.getElementById('btn-academy-back-universe')?.addEventListener('click', (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    try { stopAcademyLiveMediaStream?.(); } catch (_) {}
    saveUniverseViewState('academy');
    goToDashboardPage();
});
window.addEventListener('resize', () => {
    syncAcademyShellForViewport();

    if (document.body?.getAttribute('data-yh-view') === 'hub') {
        setUniverseSlide(activeUniverseDivision, { animate: false });
    }
});

document.getElementById('academy-feed-post-btn')?.addEventListener('click', () => {
    academyFeedSubmitPost();
});

function resetAcademyFeedComposer() {
    const input = document.getElementById('academy-feed-composer-input');
    if (input) input.value = '';

    academyFeedClearComposerMedia();
}

document.getElementById('academy-feed-refresh-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;

    await runDashboardButtonAction(button, 'Refreshing Feed...', async () => {
        await loadAcademyFeed(true);
    });
});

document.getElementById('academy-feed-upload-btn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('academy-feed-image-file');
    if (fileInput) {
        fileInput.setAttribute('accept', 'image/*,video/*');
        fileInput.click();
    }
});

document.getElementById('academy-feed-image-file')?.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0];
    const uploadBtn = document.getElementById('academy-feed-upload-btn');
    const submitBtn = document.getElementById('academy-feed-post-btn');

    if (!file) {
        return;
    }

    const mimeType = String(file.type || '').toLowerCase();
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const maxBytes = isVideo ? (100 * 1024 * 1024) : (10 * 1024 * 1024);

    if (!isImage && !isVideo) {
        showToast('Please select a valid image or video file.', 'error');
        event.target.value = '';
        return;
    }

    if (Number(file.size || 0) > maxBytes) {
        showToast(
            isVideo
                ? 'Please select a video smaller than 100MB.'
                : 'Please select an image smaller than 10MB.',
            'error'
        );
        event.target.value = '';
        return;
    }

    const previousUploadLabel = uploadBtn ? uploadBtn.innerHTML : '';
    const previousSubmitLabel = submitBtn ? submitBtn.innerText : '';

    try {
        academyFeedComposerUploadInFlight = true;

        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerText = 'Uploading...';
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Uploading...';
        }

        const media = await academyFeedUploadComposerMedia(file);

        if (!media?.url) {
            throw new Error('Upload finished without a usable media URL.');
        }

        academyFeedSetComposerMediaState(media);
        academyFeedRenderComposerPreview(media);

        showToast(
            isVideo ? 'Video uploaded. Ready to post.' : 'Image uploaded. Ready to post.',
            'success'
        );
    } catch (error) {
        showToast(error.message || 'Failed to upload media.', 'error');
    } finally {
        academyFeedComposerUploadInFlight = false;

        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = previousUploadLabel;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = previousSubmitLabel || 'Post';
        }

        event.target.value = '';
    }
});

document.getElementById('academy-feed-composer-input')?.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        academyFeedSubmitPost();
    }
});

document.getElementById('btn-start-lounge')?.addEventListener('click', () => {
    openAcademyLoungeCreateModal('voice');
});

document.getElementById('btn-start-video')?.addEventListener('click', () => {
    openAcademyLoungeCreateModal('video');
});

document.getElementById('close-lounge-modal')?.addEventListener('click', () => {
    closeAcademyLoungeCreateModal();
});

document.getElementById('lounge-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'lounge-modal') {
        closeAcademyLoungeCreateModal();
    }
});

document.getElementById('lounge-title-input')?.addEventListener('input', syncAcademyLoungeCreateModalState);
document.getElementById('lounge-topic-input')?.addEventListener('input', syncAcademyLoungeCreateModalState);

document.getElementById('btn-create-lounge')?.addEventListener('click', () => {
    submitAcademyLoungeCreateModal();
});

document.getElementById('academy-search-results-close')?.addEventListener('click', () => {
    closeAcademySearchResultsPanel();
    const input = document.getElementById('academy-global-search-input');
    if (input) input.blur();
});

document.getElementById('academy-search-open-directory')?.addEventListener('click', () => {
    const q = String(document.getElementById('academy-global-search-input')?.value || '').trim();
    loadAcademyMemberBrowser(q).catch(() => {});
});
const academyGlobalSearchInput = document.getElementById('academy-global-search-input');
academyGlobalSearchInput?.addEventListener('input', (event) => {
    scheduleAcademySearch(event.currentTarget?.value || '', {
        sourceInputId: 'academy-global-search-input'
    });
});

academyGlobalSearchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    scheduleAcademySearch(event.currentTarget?.value || '', {
        sourceInputId: 'academy-global-search-input',
        immediate: true
    });
});

document.getElementById('academy-member-browser-search-input')?.addEventListener('input', (event) => {
    scheduleAcademySearch(event.currentTarget?.value || '', {
        sourceInputId: 'academy-member-browser-search-input'
    });
});

document.getElementById('academy-member-browser-search-input')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    scheduleAcademySearch(event.currentTarget?.value || '', {
        sourceInputId: 'academy-member-browser-search-input',
        immediate: true
    });
});

// Follow/unfollow inside search dropdown or member browser modal.
document.getElementById('academy-search-results-panel')?.addEventListener('click', (event) => {
    const profileBtn = event.target.closest('[data-member-profile-id]');
    if (profileBtn) {
        const targetUserId = normalizeAcademyFeedId(profileBtn.getAttribute('data-member-profile-id'));
        if (targetUserId) {
            openAcademyMemberProfileView(targetUserId);
        }
        return;
    }

    const followBtn = event.target.closest('[data-member-follow-id]');
    if (!followBtn) return;

    const targetUserId = normalizeAcademyFeedId(followBtn.getAttribute('data-member-follow-id'));
    if (!targetUserId) return;

    academyFeedToggleFollow(targetUserId).then(() => {
        const activeSearch = String(document.getElementById('academy-global-search-input')?.value || '').trim();
        if (activeSearch.length >= 2) {
            requestAcademyMemberSearch(activeSearch).then((members) => {
                renderAcademySearchResultsPanel(members, activeSearch);
            });
        }
    });
});

document.getElementById('academy-member-browser-modal')?.addEventListener('click', (event) => {
    const profileBtn = event.target.closest('[data-member-profile-id]');
    if (profileBtn) {
        const targetUserId = normalizeAcademyFeedId(profileBtn.getAttribute('data-member-profile-id'));
        if (targetUserId) {
            openAcademyMemberProfileView(targetUserId);
        }
        return;
    }

    const followBtn = event.target.closest('[data-member-follow-id]');
    if (!followBtn) return;

    const targetUserId = normalizeAcademyFeedId(followBtn.getAttribute('data-member-follow-id'));
    if (!targetUserId) return;

    academyFeedToggleFollow(targetUserId).then(() => {
        const activeSearch = String(document.getElementById('academy-member-browser-search-input')?.value || '').trim();
        loadAcademyMemberBrowser(activeSearch).catch(() => {});
    });
});
document.getElementById('academy-profile-view')?.addEventListener('click', async (event) => {
    const actionBtn = event.target.closest('[data-profile-action]');
    if (!actionBtn) return;

    const action = String(actionBtn.getAttribute('data-profile-action') || '').trim();

    if (action === 'open-community') {
        openAcademyFeedView();
        return;
    }

    if (action === 'open-roadmap') {
        await handleAcademyRoadmapTabIntent();
        return;
    }

    if (action === 'back-self') {
        openAcademyProfileView();
        return;
    }

    if (action === 'open-direct-message') {
        const targetUserId =
            normalizeAcademyFeedId(actionBtn.getAttribute('data-member-profile-id')) ||
            normalizeAcademyFeedId(academyProfileViewState?.memberId);

        if (!targetUserId) return;

        setAcademyProfileMessageOpeningState(true);

        academyOpenDirectMessageFromProfile(targetUserId)
            .catch((error) => {
                console.error('academyOpenDirectMessageFromProfile error:', error);
                showToast(error?.message || 'Failed to open direct messages.', 'error');
            })
            .finally(() => {
                setAcademyProfileMessageOpeningState(false);
            });

        return;
    }

    if (action === 'accept-friend-request') {
        const requestId = String(actionBtn.getAttribute('data-friend-request-id') || '').trim();
        const targetUserId = normalizeAcademyFeedId(academyProfileViewState?.memberId);

        if (!requestId || !targetUserId) return;

        const previousText = actionBtn.innerText;
        actionBtn.disabled = true;
        actionBtn.innerText = 'Accepting.';

        academyProfileRespondToFriendRequest(requestId, 'accept')
            .then(() => openAcademyMemberProfileView(targetUserId))
            .catch((error) => {
                console.error('academy profile accept friend request error:', error);
                showToast(error?.message || 'Failed to accept friend request.', 'error');
            })
            .finally(() => {
                if (actionBtn.isConnected) {
                    actionBtn.disabled = false;
                    actionBtn.innerText = previousText;
                }
            });

        return;
    }

    if (action === 'send-friend-request') {
        const targetUserId =
            normalizeAcademyFeedId(actionBtn.getAttribute('data-member-profile-id')) ||
            normalizeAcademyFeedId(academyProfileViewState?.memberId);

        if (!targetUserId) return;

        const previousText = actionBtn.innerText;
        actionBtn.disabled = true;
        actionBtn.innerText = 'Sending.';

        academyProfileSendFriendRequest(targetUserId)
            .then(() => openAcademyMemberProfileView(targetUserId))
            .catch((error) => {
                console.error('academy profile send friend request error:', error);
                showToast(error?.message || 'Failed to send friend request.', 'error');
            })
            .finally(() => {
                if (actionBtn.isConnected) {
                    actionBtn.disabled = false;
                    actionBtn.innerText = previousText;
                }
            });

        return;
    }

    if (action === 'friend-state') {
        return;
    }

    if (action === 'toggle-follow') {
        const targetUserId =
            normalizeAcademyFeedId(actionBtn.getAttribute('data-member-profile-id')) ||
            normalizeAcademyFeedId(academyProfileViewState?.memberId);

        if (!targetUserId) return;

        const previousText = actionBtn.innerText;
        actionBtn.disabled = true;
        actionBtn.innerText = 'Updating.';

        academyFeedToggleFollow(targetUserId)
            .then(() => openAcademyMemberProfileView(targetUserId))
            .catch((error) => {
                console.error('academy profile follow toggle error:', error);
                showToast(error?.message || 'Failed to update follow state.', 'error');
            })
            .finally(() => {
                if (actionBtn.isConnected) {
                    actionBtn.disabled = false;
                    actionBtn.innerText = previousText;
                }
            });
    }
});
document.getElementById('academy-profile-view')?.addEventListener('click', (event) => {
    const postBtn = event.target.closest('[data-profile-post-id]');
    if (!postBtn) return;

    const postId = normalizeAcademyFeedId(postBtn.getAttribute('data-profile-post-id'));
    if (!postId) return;

    openAcademyProfilePostInFeed(postId).catch((error) => {
        console.error('openAcademyProfilePostInFeed error:', error);
        showToast(error?.message || 'Failed to open profile post.', 'error');
    });
});
document.getElementById('academy-search-results-panel')?.addEventListener('click', (event) => {
    const tagBtn = event.target.closest('[data-academy-tag-jump]');
    if (!tagBtn) return;

    const key = String(tagBtn.getAttribute('data-academy-tag-jump') || '').trim();
    if (!key) return;

    closeAcademySearchResultsPanel();

    const map = {
        roadmap: 'nav-missions',
        community: 'nav-chat',
        voice: 'nav-voice',
        academy: 'nav-chat'
    };

    const navId = map[key] || '';
    if (navId) {
        document.getElementById(navId)?.click();
    }
});

document.getElementById('academy-member-browser-close')?.addEventListener('click', () => {
    document.getElementById('academy-member-browser-modal')?.classList.add('hidden-step');
});

document.getElementById('academy-member-browser-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'academy-member-browser-modal') {
        document.getElementById('academy-member-browser-modal')?.classList.add('hidden-step');
    }
});

document.getElementById('academy-member-browser-search-input')?.addEventListener('input', (event) => {
    const nextValue = String(event.target?.value || '');
    const academySearchInput = document.getElementById('academy-global-search-input');

    if (academySearchInput && academySearchInput.value !== nextValue) {
        academySearchInput.value = nextValue;
    }

    clearTimeout(academyMemberSearchDebounce);
    academyMemberSearchDebounce = setTimeout(() => {
        applyAcademySearch(nextValue);
    }, 320);
});

document.getElementById('academy-global-search-input')?.addEventListener('input', (event) => {
    const nextValue = String(event.target?.value || '');
    const browserInput = document.getElementById('academy-member-browser-search-input');

    if (browserInput && browserInput.value !== nextValue) {
        browserInput.value = nextValue;
    }

    clearTimeout(academyMemberSearchDebounce);
    academyMemberSearchDebounce = setTimeout(() => {
        applyAcademySearch(nextValue);
    }, 320);
});
document.getElementById('academy-feed-share-cancel')?.addEventListener('click', () => {
    document.getElementById('academy-feed-share-modal')?.classList.add('hidden-step');
});

document.getElementById('academy-feed-share-close')?.addEventListener('click', () => {
    document.getElementById('academy-feed-share-modal')?.classList.add('hidden-step');
});

/* Share submit is wired once below via academyFeedSubmitShare. */
document.getElementById('academy-feed-share-close')?.addEventListener('click', academyFeedCloseShareModal);
document.getElementById('academy-feed-share-cancel')?.addEventListener('click', academyFeedCloseShareModal);
document.getElementById('academy-feed-share-submit')?.addEventListener('click', academyFeedSubmitShare);

document.getElementById('academy-feed-share-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'academy-feed-share-modal') {
        academyFeedCloseShareModal();
    }
});
document.getElementById('close-checkin-modal')?.addEventListener('click', () => {
    academyCloseCheckinModal();
});

document.getElementById('btn-cancel-checkin')?.addEventListener('click', () => {
    academyCloseCheckinModal();
});

document.getElementById('academy-checkin-form')?.addEventListener('submit', academySubmitCheckin);

document.getElementById('academy-checkin-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'academy-checkin-modal') {
        academyCloseCheckinModal();
    }
});
document.getElementById('academy-feed-list')?.addEventListener('click', async (event) => {
    const authorTrigger = event.target.closest('.academy-feed-author-trigger');
    if (authorTrigger) {
        const memberId = normalizeAcademyFeedId(authorTrigger.getAttribute('data-member-profile-id'));
        if (memberId) {
            openAcademyFeedAuthorProfile(memberId);
        }
        return;
    }

    const likeBtn = event.target.closest('.academy-feed-like-btn');
    if (likeBtn) {
        const postId = normalizeAcademyFeedId(likeBtn.getAttribute('data-post-id'));
        if (postId) academyFeedToggleLike(postId);
        return;
    }

    const commentsToggleBtn = event.target.closest('.academy-feed-comments-toggle-btn');
    if (commentsToggleBtn) {
        const postId = normalizeAcademyFeedId(commentsToggleBtn.getAttribute('data-post-id'));
        if (postId) academyFeedLoadComments(postId);
        return;
    }

    const shareBtn = event.target.closest('.academy-feed-share-btn');
    if (shareBtn) {
        const postId = normalizeAcademyFeedId(shareBtn.getAttribute('data-post-id'));
        if (!postId) return;

        academyFeedOpenShareModal(postId);
        return;
    }

    const menuBtn = event.target.closest('.academy-feed-post-menu-btn');
    if (menuBtn) {
        const postId = normalizeAcademyFeedId(menuBtn.getAttribute('data-post-id'));
        if (!postId) return;
        const menu = document.getElementById(`academy-feed-post-menu-${postId}`);
        if (menu) menu.classList.toggle('hidden-step');
        return;
    }

    const hideBtn = event.target.closest('.academy-feed-hide-btn');
    if (hideBtn) {
        const postId = normalizeAcademyFeedId(hideBtn.getAttribute('data-post-id'));
        if (!postId) return;

        const hiddenPosts = readAcademyHiddenPostIds();
        if (!hiddenPosts.includes(postId)) {
            hiddenPosts.push(postId);
            writeAcademyHiddenPostIds(hiddenPosts);
        }

        showToast('Post hidden only for your account.', 'success');
        loadAcademyFeed(true);
        return;
    }

    const deleteBtn = event.target.closest('.academy-feed-delete-btn');
    if (deleteBtn) {
        const postId = normalizeAcademyFeedId(deleteBtn.getAttribute('data-post-id'));
        if (!postId) return;

        academyFeedOpenDeleteModal(postId);
        return;
    }

    const commentSubmitBtn = event.target.closest('.academy-feed-comment-submit-btn');
    if (commentSubmitBtn) {
        const postId = normalizeAcademyFeedId(commentSubmitBtn.getAttribute('data-post-id'));
        if (postId) academyFeedSubmitComment(postId);
    }

    const followMemberBtn = event.target.closest('[data-member-follow-id]');
    if (followMemberBtn) {
        const targetUserId = normalizeAcademyFeedId(followMemberBtn.getAttribute('data-member-follow-id'));
        if (targetUserId) {
            academyFeedToggleFollow(targetUserId).then(() => {
                const activeSearch = String(document.getElementById('academy-global-search-input')?.value || '').trim();
                if (activeSearch) {
                    loadAcademyMemberBrowser(activeSearch);
                }
            });
        }
        return;
    }

    const joinLiveRoomBtn = event.target.closest('.academy-join-live-room-btn');
    if (joinLiveRoomBtn) {
        const roomId = normalizeAcademyFeedId(joinLiveRoomBtn.getAttribute('data-live-room-id'));
        const targetRoom = academyVoiceRoomsCache.find((room) => normalizeAcademyFeedId(room?.id) === roomId);

        if (targetRoom) {
            openAcademyStageFromRoom(targetRoom);
        }
    }
});
const btnOpenApply = document.getElementById('btn-open-academy-apply');
const applyModal = document.getElementById('academy-apply-modal');
const closeApplyBtn = document.getElementById('close-academy-apply');

const roadmapModal = document.getElementById('academy-roadmap-modal');
const closeRoadmapBtn = document.getElementById('close-academy-roadmap');
const academyEntryWrap = btnOpenApply?.closest('.academy-entry-cta-wrap') || null;
const academyEntryShell = document.querySelector('.academy-entry-button-shell');
const academyEntryVisual = document.getElementById('academy-entry-button-visual');

const YH_POST_AUTH_APP_KEY = 'yh_force_academy_application_after_auth';
const YH_ROADMAP_PROFILE_KEY = 'yh_academy_roadmap_profile_v1';
const YH_ROADMAP_LOCK_KEY = 'yh_academy_roadmap_locked_v1';

function resolveEventElementTarget(event) {
    const rawTarget = event?.target || null;
    if (rawTarget && rawTarget.nodeType === 3) {
        return rawTarget.parentElement;
    }
    return rawTarget;
}

function setDashboardButtonLabel(button, label = '') {
    if (!button) return;

    const safeLabel = String(label || '').trim();
    const labelEl = button.querySelector('.yh-btn-label');
    const visualLabelEl =
        button.id === 'btn-open-academy-apply'
            ? document.getElementById('academy-entry-button-visual')
            : null;

    if (safeLabel) {
        button.setAttribute('aria-label', safeLabel);
        button.dataset.label = safeLabel;
    }

    if (visualLabelEl) {
        visualLabelEl.textContent = safeLabel;
    }

    if (labelEl) {
        labelEl.textContent = safeLabel;
        return;
    }

    if (button.id === 'btn-open-academy-apply') {
        button.textContent = '';
        return;
    }

    button.textContent = safeLabel;
}

function setDashboardButtonLoadingState(button, isLoading = false, loadingLabel = 'Loading...') {
    if (!button) return;

    const idleLabel = String(
        button.dataset.idleLabel ||
        button.getAttribute('aria-label') ||
        button.textContent ||
        ''
    ).trim();

    if (idleLabel) {
        button.dataset.idleLabel = idleLabel;
    }

    if (isLoading) {
        button.dataset.loading = 'true';
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-busy', 'true');
        button.style.cursor = 'wait';
        button.style.opacity = '0.92';
        setDashboardButtonLabel(button, loadingLabel);
        return;
    }

    button.dataset.loading = 'false';
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('aria-busy', 'false');
    button.style.cursor = 'pointer';
    button.style.opacity = '1';
    setDashboardButtonLabel(button, button.dataset.idleLabel || idleLabel);
}

async function runDashboardButtonAction(button, loadingLabel, action) {
    if (!button) {
        return await action();
    }

    if (button.dataset.loading === 'true') return false;

    setDashboardButtonLoadingState(button, true, loadingLabel);

    try {
        return await action();
    } finally {
        if (button.isConnected) {
            setDashboardButtonLoadingState(button, false);
        }
    }
}

function resolveAcademyLaunchTarget(event) {
    const target = resolveEventElementTarget(event);
    if (!target) return null;

    const direct = target.closest?.('#btn-open-academy-apply');
    if (direct) return direct;

    if (target.closest?.('.academy-entry-button-shell, .academy-entry-cta-wrap, .academy-entry-button-visual')) {
        return btnOpenApply || null;
    }

    return null;
}

function setDashboardButtonLoadingState(button, isLoading = false, loadingLabel = 'Loading.') {
    if (!button) return;

    const idleLabel = String(
        button.dataset.idleLabel ||
        button.getAttribute('aria-label') ||
        button.dataset.label ||
        button.textContent ||
        ''
    ).trim();

    if (idleLabel) {
        button.dataset.idleLabel = idleLabel;
    }

    if (isLoading) {
        button.dataset.loading = 'true';
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-busy', 'true');
        button.style.cursor = 'wait';
        button.style.opacity = '0.92';
        setDashboardButtonLabel(button, loadingLabel);
        return;
    }

    button.dataset.loading = 'false';
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('aria-busy', 'false');
    button.style.cursor = 'pointer';
    button.style.opacity = '1';
    setDashboardButtonLabel(button, button.dataset.idleLabel || idleLabel);
}


function syncAcademyEntryButton(snapshot = null) {
    if (!btnOpenApply) return;

    const stateBadge = document.getElementById('academy-entry-state-badge');
    const entryWrap = academyEntryWrap || btnOpenApply.closest('.academy-entry-cta-wrap');

    const membershipStatus = String(
        snapshot?.applicationStatus ||
        readAcademyMembershipCache()?.applicationStatus ||
        ''
    ).trim().toLowerCase();

    if (entryWrap) {
        entryWrap.style.width = '100%';
        entryWrap.style.pointerEvents = 'auto';
        entryWrap.style.position = 'relative';
        entryWrap.style.zIndex = '3';
    }

    if (academyEntryShell) {
        academyEntryShell.style.pointerEvents = 'auto';
        academyEntryShell.style.position = 'relative';
        academyEntryShell.style.zIndex = '3';
        academyEntryShell.style.cursor = 'pointer';
        academyEntryShell.style.touchAction = 'manipulation';
        academyEntryShell.setAttribute('role', 'button');
        academyEntryShell.setAttribute('tabindex', '0');
    }

    if (academyEntryVisual) {
        academyEntryVisual.style.pointerEvents = 'none';
        academyEntryVisual.style.userSelect = 'none';
        academyEntryVisual.style.webkitUserSelect = 'none';
        academyEntryVisual.style.caretColor = 'transparent';
    }

    btnOpenApply.classList.remove('btn-secondary');
    btnOpenApply.setAttribute('type', 'button');
    btnOpenApply.setAttribute('tabindex', '-1');
    btnOpenApply.setAttribute('aria-hidden', 'true');
    btnOpenApply.style.position = 'absolute';
    btnOpenApply.style.inset = '0';
    btnOpenApply.style.width = '100%';
    btnOpenApply.style.height = '100%';
    btnOpenApply.style.minHeight = '52px';
    btnOpenApply.style.margin = '0';
    btnOpenApply.style.padding = '0';
    btnOpenApply.style.display = 'block';
    btnOpenApply.style.boxSizing = 'border-box';
    btnOpenApply.style.background = 'transparent';
    btnOpenApply.style.border = 'none';
    btnOpenApply.style.opacity = '0';
    btnOpenApply.style.pointerEvents = 'auto';
    btnOpenApply.style.touchAction = 'manipulation';
    btnOpenApply.style.cursor = 'pointer';
    btnOpenApply.style.zIndex = '5';
    btnOpenApply.style.color = 'transparent';
    btnOpenApply.style.fontSize = '0';
    btnOpenApply.style.lineHeight = '0';
    btnOpenApply.style.webkitTapHighlightColor = 'transparent';
    btnOpenApply.style.appearance = 'none';
    btnOpenApply.style.webkitAppearance = 'none';
    btnOpenApply.style.caretColor = 'transparent';
    btnOpenApply.textContent = '';
    if (stateBadge) {
        stateBadge.classList.add('is-hidden');
        stateBadge.classList.remove('is-pending', 'is-approved', 'is-waitlisted', 'is-rejected');
        stateBadge.textContent = '';
        stateBadge.style.pointerEvents = 'none';
    }

    if (membershipStatus === 'approved') {
        btnOpenApply.dataset.idleLabel = 'Enter the Academy ➔';
        btnOpenApply.dataset.loadingLabel = 'Opening Academy...';
        btnOpenApply.setAttribute('data-academy-state', 'approved');
        setDashboardButtonLoadingState(btnOpenApply, false);

        if (stateBadge) {
            if (hasSeenAcademyApprovalBadge(snapshot)) {
                stateBadge.classList.add('is-hidden');
                stateBadge.textContent = '';
                stateBadge.style.opacity = '';
                stateBadge.style.transform = '';
                stateBadge.style.transition = '';
            } else {
                stateBadge.textContent = 'Academy Access Approved';
                stateBadge.classList.remove('is-hidden');
                stateBadge.classList.add('is-approved');
                fadeOutAcademyApprovalBadge(stateBadge, snapshot);
            }
        }
        return;
    }

    if (membershipStatus === 'under review' || membershipStatus === 'new') {
        btnOpenApply.dataset.idleLabel = 'Application Pending';
        btnOpenApply.dataset.loadingLabel = 'Checking status...';
        btnOpenApply.setAttribute('data-academy-state', 'pending');
        setDashboardButtonLoadingState(btnOpenApply, false);

        if (stateBadge) {
            stateBadge.innerHTML = `
                <span>Your Academy application is under review</span>
                <span class="academy-entry-state-note">You will get an answer within the next 24 hours, check your email for updates.</span>
            `;
            stateBadge.classList.remove('is-hidden');
            stateBadge.classList.add('is-pending');
        }
        return;
    }
    if (membershipStatus === 'waitlisted') {
        btnOpenApply.dataset.idleLabel = 'Application Waitlisted';
        btnOpenApply.dataset.loadingLabel = 'Checking status...';
        btnOpenApply.setAttribute('data-academy-state', 'waitlisted');
        setDashboardButtonLoadingState(btnOpenApply, false);

        if (stateBadge) {
            stateBadge.textContent = 'Your Academy application is waitlisted';
            stateBadge.classList.remove('is-hidden');
            stateBadge.classList.add('is-waitlisted');
        }
        return;
    }

    if (membershipStatus === 'rejected') {
        btnOpenApply.dataset.idleLabel = 'Application Reviewed';
        btnOpenApply.dataset.loadingLabel = 'Checking status...';
        btnOpenApply.setAttribute('data-academy-state', 'rejected');
        setDashboardButtonLoadingState(btnOpenApply, false);

        if (stateBadge) {
            stateBadge.textContent = 'Your Academy application has been reviewed';
            stateBadge.classList.remove('is-hidden');
            stateBadge.classList.add('is-rejected');
        }
        return;
    }

    btnOpenApply.dataset.idleLabel = 'Apply for the Academy ➔';
    btnOpenApply.dataset.loadingLabel = 'Opening...';
    btnOpenApply.setAttribute('data-academy-state', 'apply');
    setDashboardButtonLoadingState(btnOpenApply, false);
}

function hasAcademyApplicationAlreadyBeenFilled() {
    const cached = readAcademyMembershipCache();
    if (cached?.hasApplication) return true;
    return Boolean(findCurrentAcademyMembershipApplication());
}

function readRoadmapProfileCache() {
    try {
        const raw = localStorage.getItem(YH_ROADMAP_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function hasRoadmapIntakeAlreadyBeenFilled() {
    const cached = readAcademyMembershipCache();

    if (cached?.hasRoadmapAccess) return true;

    const roadmapStatus = String(cached?.roadmapApplicationStatus || '').trim().toLowerCase();
    if (roadmapStatus) return true;

    if (localStorage.getItem(YH_ROADMAP_LOCK_KEY) === 'true') return true;
    return false;
}

function syncRoadmapTabIndicator(snapshot = null) {
    const badges = [
        document.getElementById('roadmap-tab-state-badge'),
        document.getElementById('roadmap-tab-state-badge-mobile')
    ].filter(Boolean);

    if (!badges.length) return;

    const membership = snapshot && typeof snapshot === 'object'
        ? snapshot
        : (readAcademyMembershipCache() || {});

    const membershipStatus = String(
        membership?.applicationStatus || ''
    ).trim().toLowerCase();

    const roadmapStatus = String(
        membership?.roadmapApplicationStatus || ''
    ).trim().toLowerCase();

    const hasRoadmapAccess = membership?.hasRoadmapAccess === true;

    badges.forEach((badge) => {
        badge.classList.remove('is-pending', 'is-unlocked', 'is-hidden');

        if (membershipStatus !== 'approved') {
            badge.textContent = 'Locked';
            return;
        }

        if (hasRoadmapAccess) {
            badge.textContent = 'Unlocked';
            badge.classList.add('is-unlocked');
            return;
        }

        if (
            roadmapStatus === 'under review' ||
            roadmapStatus === 'new' ||
            localStorage.getItem(YH_ROADMAP_LOCK_KEY) === 'true'
        ) {
            badge.textContent = 'Pending Review';
            badge.classList.add('is-pending');
            return;
        }

        badge.textContent = 'Apply for Access';
    });
}

const ROADMAP_SCOPE_CONFIG = {
    money_business: {
        label: 'Money, Wealth & Business',
        schemaKey: 'money_business_v1',
        sectionTitle: 'Money, Wealth & Business Questions',
        sectionCopy: 'Learn ways and strategies to build and grow your financial future. Answer these so the AI can understand your business direction, constraints, and income goals.',
        fields: [
            {
                key: 'businessGoalType',
                label: 'What type of business would you like to start or grow?',
                type: 'select',
                required: true,
                options: [
                    { value: 'service', label: 'Service business' },
                    { value: 'agency', label: 'Agency' },
                    { value: 'ecommerce', label: 'E-commerce' },
                    { value: 'saas', label: 'SaaS' },
                    { value: 'content', label: 'Content / Personal brand' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                key: 'businessModelWanted',
                label: 'Which business model are you most interested in?',
                type: 'text',
                required: true,
                placeholder: 'e.g. AI automation agency, dropshipping, freelance design'
            },
            {
                key: 'pastBusinessExperience',
                label: 'What experiences do you already have in business?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'Describe any experience, even if small.'
            },
            {
                key: 'haveMadeMoneyOnline',
                label: 'Have you made money online already?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'onlineIncomeRange',
                label: 'What is your current online income level?',
                type: 'select',
                required: false,
                options: [
                    { value: '0', label: 'None yet' },
                    { value: '1_100', label: '$1 - $100' },
                    { value: '100_1000', label: '$100 - $1,000' },
                    { value: '1000_5000', label: '$1,000 - $5,000' },
                    { value: '5000_plus', label: '$5,000+' }
                ]
            },
            {
                key: 'capitalAvailable',
                label: 'How much starting capital do you realistically have?',
                type: 'select',
                required: false,
                options: [
                    { value: '0_100', label: '$0 - $100' },
                    { value: '100_500', label: '$100 - $500' },
                    { value: '500_2000', label: '$500 - $2,000' },
                    { value: '2000_plus', label: '$2,000+' }
                ]
            },
            {
                key: 'salesExperienceLevel',
                label: 'How strong are your sales skills right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'No experience' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'preferredBusinessChannel',
                label: 'Which channel do you want to focus on first?',
                type: 'text',
                required: false,
                placeholder: 'e.g. X, Instagram, email, cold outreach, paid ads'
            },
            {
                key: 'biggestMoneyBlocker',
                label: 'What is your biggest money or business blocker right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What keeps stopping you from making real progress?'
            }
        ]
    },

    mindset_psychology: {
        label: 'Mindset & Psychology',
        schemaKey: 'mindset_psychology_v1',
        sectionTitle: 'Mindset & Psychology Questions',
        sectionCopy: 'Develop the mental toughness and clarity that drives success. Answer these so the AI can understand your internal patterns, struggles, and mindset priorities.',
        fields: [
            {
                key: 'mainInternalProblem',
                label: 'What is your biggest internal struggle right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. inconsistency, low confidence, fear, laziness'
            },
            {
                key: 'disciplineLevel',
                label: 'How would you rate your discipline right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'confidenceLevel',
                label: 'How would you rate your confidence right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'overthinkingLevel',
                label: 'How much do you struggle with overthinking?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'sometimes', label: 'Sometimes' },
                    { value: 'often', label: 'Often' },
                    { value: 'constantly', label: 'Constantly' }
                ]
            },
            {
                key: 'stressTriggerPattern',
                label: 'What usually triggers your stress?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe the main triggers.'
            },
            {
                key: 'selfSabotagePattern',
                label: 'What self-sabotage pattern do you notice most?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'e.g. delaying action, quitting early, distractions'
            },
            {
                key: 'desiredMentalShift',
                label: 'What mental shift do you want the AI to help you build first?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What mindset change matters most right now?'
            }
        ]
    },

    fitness_health: {
        label: 'Fitness & Health',
        schemaKey: 'fitness_health_v1',
        sectionTitle: 'Fitness & Health Questions',
        sectionCopy: 'Unlock your full potential with tips on living a strong, healthy lifestyle. Answer these so the AI can build a roadmap around your body goal, training style, and current condition.',
        fields: [
            {
                key: 'bodyGoal',
                label: 'What would you like to achieve?',
                type: 'select',
                required: true,
                options: [
                    { value: 'cut_weight', label: 'Cut weight' },
                    { value: 'gain_weight', label: 'Gain weight' },
                    { value: 'build_muscle', label: 'Build muscle' },
                    { value: 'improve_conditioning', label: 'Improve conditioning' }
                ]
            },
            {
                key: 'trainingExperienceMonths',
                label: 'How long have you been training already?',
                type: 'number',
                required: true,
                placeholder: 'e.g. 2'
            },
            {
                key: 'trainingStyle',
                label: 'How do you want to train?',
                type: 'select',
                required: true,
                options: [
                    { value: 'gym', label: 'Gym' },
                    { value: 'calisthenics', label: 'Calisthenics' },
                    { value: 'martial_arts', label: 'Martial arts' },
                    { value: 'home_workouts', label: 'Home workouts' }
                ]
            },
            {
                key: 'dietStyle',
                label: 'What kind of eating style are you following now?',
                type: 'text',
                required: false,
                placeholder: 'e.g. high protein, anything available, intermittent fasting'
            },
            {
                key: 'gymAccess',
                label: 'Do you currently have gym access?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'currentWeightRange',
                label: 'What is your current weight range?',
                type: 'text',
                required: false,
                placeholder: 'e.g. 80 - 90kg'
            },
            {
                key: 'targetWeightRange',
                label: 'What is your target weight range?',
                type: 'text',
                required: false,
                placeholder: 'e.g. 70 - 75kg'
            },
            {
                key: 'injuryOrLimitation',
                label: 'Do you have any injury or physical limitation?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Leave blank if none.'
            },
            {
                key: 'fitnessConsistencyBlocker',
                label: 'What usually ruins your consistency?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. sleep schedule, distractions, lack of discipline'
            }
        ]
    },

    communication_networking: {
        label: 'Communication & Networking',
        schemaKey: 'communication_networking_v1',
        sectionTitle: 'Communication & Networking Questions',
        sectionCopy: 'Master the art of connecting with others and building valuable relationships. Answer these so the AI can shape your roadmap around speaking, confidence, and social leverage.',
        fields: [
            {
                key: 'mainCommunicationGoal',
                label: 'What is your main communication goal right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. speak with confidence, get better at cold outreach, network with high-value people'
            },
            {
                key: 'publicSpeakingLevel',
                label: 'What is your current public speaking level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'No experience' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'coldOutreachExperience',
                label: 'Have you done cold outreach before?',
                type: 'select',
                required: true,
                options: [
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' }
                ]
            },
            {
                key: 'networkingConfidence',
                label: 'How confident are you when networking?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'socialFearLevel',
                label: 'How much social fear do you currently deal with?',
                type: 'select',
                required: true,
                options: [
                    { value: 'very_low', label: 'Very low' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'persuasionGoal',
                label: 'What do you want to get better at persuading people to do?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe the communication outcome you want.'
            },
            {
                key: 'currentEnvironmentQuality',
                label: 'Is your current environment helping or hurting your communication growth?',
                type: 'textarea',
                required: false,
                rows: 2,
                placeholder: 'Describe your current environment.'
            }
        ]
    },

    knowledge_for_life: {
        label: 'Knowledge for Life',
        schemaKey: 'knowledge_for_life_v1',
        sectionTitle: 'Knowledge for Life Questions',
        sectionCopy: 'Explore key insights that can make a real difference in your personal and professional life. Answer these so the AI can guide what to study, how to think, and how deeply to learn.',
        fields: [
            {
                key: 'mainKnowledgeGoal',
                label: 'What do you mainly want to understand better right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What do you want to become sharper at?'
            },
            {
                key: 'topicsOfInterest',
                label: 'Which topics are you most interested in?',
                type: 'text',
                required: true,
                placeholder: 'e.g. politics, banking, tax systems, world trends'
            },
            {
                key: 'readingFrequency',
                label: 'How often do you currently read or study deeply?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'weekly', label: 'A few times a week' },
                    { value: 'daily', label: 'Daily' }
                ]
            },
            {
                key: 'contentConsumptionStyle',
                label: 'How do you prefer to consume information?',
                type: 'select',
                required: true,
                options: [
                    { value: 'books', label: 'Books' },
                    { value: 'videos', label: 'Videos' },
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'audio', label: 'Audio' }
                ]
            },
            {
                key: 'criticalThinkingLevel',
                label: 'How strong is your critical thinking right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'researchDepthPreference',
                label: 'Do you prefer fast summaries or deep research?',
                type: 'select',
                required: true,
                options: [
                    { value: 'fast_summaries', label: 'Fast summaries' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'deep_research', label: 'Deep research' }
                ]
            }
        ]
    },

    politics_2030_agenda: {
        label: 'Politics & the 2030 Agenda',
        schemaKey: 'politics_2030_agenda_v1',
        sectionTitle: 'Politics & the 2030 Agenda Questions',
        sectionCopy: 'Stay informed on global issues that shape the world. Answer these so the AI can tailor your roadmap around geopolitics, policy, power structures, and the 2030 Agenda topics you want to understand.',
        fields: [
            {
                key: 'mainPoliticalGoal',
                label: 'What do you want to understand better in politics right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. geopolitics, power structures, policy, media narratives, 2030 Agenda'
            },
            {
                key: 'politicalAwarenessLevel',
                label: 'How would you rate your current awareness level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'topicCluster',
                label: 'Which area do you want to focus on first?',
                type: 'select',
                required: true,
                options: [
                    { value: 'geopolitics', label: 'Geopolitics' },
                    { value: 'governance_policy', label: 'Governance / Policy' },
                    { value: 'economics_power', label: 'Economics / Power structures' },
                    { value: 'agenda_2030', label: '2030 Agenda' },
                    { value: 'media_narratives', label: 'Media narratives' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'regionsOfInterest',
                label: 'Which countries, regions, or institutions matter most to you?',
                type: 'text',
                required: false,
                placeholder: 'e.g. US, EU, BRICS, Africa, UN'
            },
            {
                key: 'newsConsumptionStyle',
                label: 'How do you currently follow political information?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'summaries', label: 'Mostly summaries' },
                    { value: 'daily_news', label: 'Daily news' },
                    { value: 'long_form', label: 'Long-form analysis' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'politicalDiscussionConfidence',
                label: 'How confident are you discussing political issues critically?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'biggestPoliticalConfusion',
                label: 'What political issue or pattern confuses you most right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What do you want the AI to help you break down clearly?'
            }
        ]
    },

    philosophy: {
        label: 'Philosophy',
        schemaKey: 'philosophy_v1',
        sectionTitle: 'Philosophy Questions',
        sectionCopy: 'Deepen your understanding of life’s big questions to sharpen your perspective. Answer these so the AI can shape a roadmap around truth, meaning, logic, ethics, and self-mastery.',
        fields: [
            {
                key: 'mainPhilosophyQuestion',
                label: 'What is the main philosophical question you care about right now?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'e.g. meaning, truth, ethics, discipline, purpose, reality'
            },
            {
                key: 'philosophyArea',
                label: 'Which area of philosophy pulls you most right now?',
                type: 'select',
                required: true,
                options: [
                    { value: 'ethics', label: 'Ethics' },
                    { value: 'meaning_purpose', label: 'Meaning / Purpose' },
                    { value: 'logic_reasoning', label: 'Logic / Reasoning' },
                    { value: 'self_mastery', label: 'Self-mastery' },
                    { value: 'truth_reality', label: 'Truth / Reality' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'readingExperience',
                label: 'What is your current philosophy reading level?',
                type: 'select',
                required: true,
                options: [
                    { value: 'none', label: 'None yet' },
                    { value: 'basic', label: 'Basic' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                ]
            },
            {
                key: 'preferredLearningStyle',
                label: 'How do you prefer to explore philosophy?',
                type: 'select',
                required: true,
                options: [
                    { value: 'books', label: 'Books' },
                    { value: 'lectures', label: 'Lectures' },
                    { value: 'conversations', label: 'Conversations' },
                    { value: 'writing', label: 'Writing / journaling' },
                    { value: 'mixed', label: 'Mixed' }
                ]
            },
            {
                key: 'reflectionHabit',
                label: 'How often do you reflect deeply on ideas or life questions?',
                type: 'select',
                required: true,
                options: [
                    { value: 'rarely', label: 'Rarely' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'daily', label: 'Daily' }
                ]
            },
            {
                key: 'argumentConfidence',
                label: 'How confident are you in breaking down arguments and ideas logically?',
                type: 'select',
                required: true,
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                ]
            },
            {
                key: 'desiredPhilosophicalShift',
                label: 'What change in perspective do you want the AI to help you build first?',
                type: 'textarea',
                required: true,
                rows: 2,
                placeholder: 'What deeper shift in perspective matters most right now?'
            }
        ]
    }
};

function escapeRoadmapHtml(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRoadmapScopeConfig(scopeKey = '') {
    return ROADMAP_SCOPE_CONFIG[String(scopeKey || '').trim()] || null;
}

function renderRoadmapScopeField(field = {}) {
    const fieldId = `roadmap-scope-answer-${field.key}`;
    const requiredAttr = field.required ? 'required' : '';
    const placeholderAttr = field.placeholder
        ? `placeholder="${escapeRoadmapHtml(field.placeholder)}"`
        : '';

    if (field.type === 'textarea') {
        return `
            <div class="form-group mb-small">
                <label>${escapeRoadmapHtml(field.label || '')}</label>
                <textarea
                    id="${escapeRoadmapHtml(fieldId)}"
                    class="input-field"
                    rows="${Number(field.rows || 2)}"
                    ${requiredAttr}
                    ${placeholderAttr}
                ></textarea>
            </div>
        `;
    }

    if (field.type === 'select') {
        const options = Array.isArray(field.options) ? field.options : [];
        const optionMarkup = options
            .map((option) => {
                const value = typeof option === 'object' ? option.value : option;
                const label = typeof option === 'object' ? option.label : option;
                return `<option value="${escapeRoadmapHtml(value)}">${escapeRoadmapHtml(label)}</option>`;
            })
            .join('');

        return `
            <div class="form-group mb-small">
                <label>${escapeRoadmapHtml(field.label || '')}</label>
                <select id="${escapeRoadmapHtml(fieldId)}" class="input-field styled-select" ${requiredAttr}>
                    <option value="" disabled selected>Select option.</option>
                    ${optionMarkup}
                </select>
            </div>
        `;
    }

    const inputType = field.type === 'number' ? 'number' : 'text';

    return `
        <div class="form-group mb-small">
            <label>${escapeRoadmapHtml(field.label || '')}</label>
            <input
                type="${escapeRoadmapHtml(inputType)}"
                id="${escapeRoadmapHtml(fieldId)}"
                class="input-field"
                ${requiredAttr}
                ${placeholderAttr}
            >
        </div>
    `;
}

function renderRoadmapScopeQuestions(scopeKey = '') {
    const container = document.getElementById('roadmap-scope-questions');
    const heading = document.getElementById('roadmap-scope-heading');
    const help = document.getElementById('roadmap-scope-help');
    const chip = document.getElementById('roadmap-selected-scope-label');
    const config = getRoadmapScopeConfig(scopeKey);

    if (!container) return;

    if (!config) {
        container.innerHTML = '';
        if (heading) heading.textContent = 'AI intake questions';
        if (help) help.textContent = 'Answer the questions below so the AI can build a more accurate roadmap for you.';
        if (chip) chip.textContent = 'No scope selected';
        return;
    }

    if (heading) heading.textContent = config.sectionTitle;
    if (help) help.textContent = config.sectionCopy;
    if (chip) chip.textContent = config.label;

    container.innerHTML = `
        <div class="roadmap-scope-block">
            <div class="roadmap-scope-block-head">
                <div class="roadmap-scope-block-kicker">Scope-specific intake</div>
                <div class="roadmap-scope-block-copy">${escapeRoadmapHtml(config.sectionCopy)}</div>
            </div>
            ${config.fields.map((field) => renderRoadmapScopeField(field)).join('')}
        </div>
    `;
}

function collectRoadmapScopeAnswers(scopeKey = '') {
    const config = getRoadmapScopeConfig(scopeKey);
    if (!config) return {};

    return config.fields.reduce((acc, field) => {
        const fieldId = `roadmap-scope-answer-${field.key}`;
        const el = document.getElementById(fieldId);
        if (!el) return acc;

        acc[field.key] = String(el.value || '').trim();
        return acc;
    }, {});
}

function setRoadmapIntakePhase(step = 1) {
    const phase1 = document.getElementById('roadmap-phase-1');
    const phase2 = document.getElementById('roadmap-phase-2');

    if (step === 2) {
        phase1?.classList.add('hidden-step');
        phase2?.classList.remove('hidden-step');
        return;
    }

    phase2?.classList.add('hidden-step');
    phase1?.classList.remove('hidden-step');
}

function resetRoadmapIntakeModalState() {
    // Avoid TDZ on roadmapForm (it is declared later in the file)
    const form = document.getElementById('form-academy-roadmap');
    if (form) form.reset();

    const focusKeyEl = document.getElementById('roadmap-focus-area-key');
    if (focusKeyEl) focusKeyEl.value = '';

    const schemaEl = document.getElementById('roadmap-schema-key');
    if (schemaEl) schemaEl.value = '';

    const versionEl = document.getElementById('roadmap-intake-version');
    if (versionEl) versionEl.value = '2';

    renderRoadmapScopeQuestions('');
    setRoadmapIntakePhase(1);

    const submitBtn = document.getElementById('btn-submit-roadmap-intake');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Build My AI Roadmap ➔';
    }
}

function openRoadmapIntake() {
    if (!roadmapModal) return;
    closeAcademyLauncher();
    resetRoadmapIntakeModalState();
    roadmapModal.classList.remove('hidden-step');
    document.body?.classList.add('academy-launcher-open');
    document.getElementById('roadmap-focus-area')?.focus();
}

function closeRoadmapIntake() {
    if (!roadmapModal) return;
    roadmapModal.classList.add('hidden-step');
    document.body?.classList.remove('academy-launcher-open');
    resetRoadmapIntakeModalState();
}

function maybeOpenPostAuthAcademyApplication() {
    const shouldOpen = sessionStorage.getItem(YH_POST_AUTH_APP_KEY) === 'true';
    if (!shouldOpen) return;

    sessionStorage.removeItem(YH_POST_AUTH_APP_KEY);

    if (hasAcademyApplicationAlreadyBeenFilled()) return;
    openAcademyLauncher();
}

function maybeOpenRoadmapIntakeOnce() {
    // Roadmap intake should no longer auto-open on Academy entry.
    // It should only open when the user explicitly clicks Apply for Access inside the Roadmap tab.
}
async function handleAcademyRoadmapTabIntent() {
    showAcademyTabLoader('Loading roadmap...');
    try {
        closeRoadmapIntake();
        showAcademyRoadmapLoadingShell();

        let membershipSnapshot = null;

        try {
            membershipSnapshot = await refreshAcademyMembershipStatus(true);
        } catch (error) {
            console.error('handleAcademyRoadmapTabIntent refresh error:', error);
            openAcademyRoadmapAccessGate(readAcademyMembershipCache() || {});
            showToast(error?.message || 'Failed to load roadmap state.', 'error');
            return;
        }

        const membershipStatus = String(
            membershipSnapshot?.applicationStatus || ''
        ).trim().toLowerCase();

        const hasRoadmapAccess = membershipSnapshot?.hasRoadmapAccess === true;

        if (membershipStatus !== 'approved') {
            openAcademyRoadmapAccessGate(membershipSnapshot);
            return;
        }

        if (hasRoadmapAccess) {
            openAcademyRoadmapView(true);
            return;
        }

        openRoadmapIntake();
    } finally {
        hideAcademyTabLoader();
    }
}
function stopAcademyMembershipRealtimeSync() {
    if (academyMembershipRealtimeTimer) {
        clearInterval(academyMembershipRealtimeTimer);
        academyMembershipRealtimeTimer = null;
    }
}

function startAcademyMembershipRealtimeSync() {
    if (academyMembershipRealtimeTimer) return;
    if (!getStoredAuthToken()) return;

    const cached = readAcademyMembershipCache();
    if (!shouldKeepAcademyMembershipRealtimeSync(cached)) return;

    academyMembershipRealtimeTimer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;

        if (!getStoredAuthToken()) {
            stopAcademyMembershipRealtimeSync();
            return;
        }

        if (!shouldKeepAcademyMembershipRealtimeSync()) {
            stopAcademyMembershipRealtimeSync();
            return;
        }

        requestAcademyMembershipRefresh('interval').catch(() => {});
    }, ACADEMY_MEMBERSHIP_POLL_MS);
}

window.addEventListener('focus', () => {
    requestAcademyMembershipRefresh('focus').catch(() => {});
});

window.addEventListener('pageshow', () => {
    requestAcademyMembershipRefresh('pageshow').catch(() => {});
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestAcademyMembershipRefresh('visibilitychange').catch(() => {});
    }
});

window.addEventListener('beforeunload', stopAcademyMembershipRealtimeSync);
function openAcademyRoadmapAccessGate(snapshot = null) {
    hideAcademyViewsForFeed();

    const academyChat = document.getElementById('academy-chat');
    if (academyChat) {
        academyChat.classList.remove('hidden-step');
        academyChat.classList.remove('fade-in');
        void academyChat.offsetWidth;
        academyChat.classList.add('fade-in');
    }

    setAcademySidebarActive('nav-missions');

    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderTopic = document.getElementById('chat-header-topic');
    const chatWelcomeBox = document.getElementById('chat-welcome-box');
    const chatPinnedMessage = document.getElementById('chat-pinned-message');
    const dynamicChatContainer = document.getElementById('dynamic-chat-history');

    if (chatHeaderIcon) chatHeaderIcon.innerHTML = '🧠';
    if (chatHeaderTitle) chatHeaderTitle.innerText = 'Roadmap Setup';
    if (chatHeaderTopic) chatHeaderTopic.innerText = 'Complete the roadmap form to let the AI generate your personalized roadmap instantly.';
    if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
    if (chatPinnedMessage) chatPinnedMessage.style.display = 'none';

    const membership = snapshot && typeof snapshot === 'object'
        ? snapshot
        : (readAcademyMembershipCache() || {});

    const membershipStatus = String(
        membership?.applicationStatus || ''
    ).trim().toLowerCase();

    const roadmapStatus = String(
        membership?.roadmapApplicationStatus || ''
    ).trim().toLowerCase();

    const hasRoadmapAccess = membership?.hasRoadmapAccess === true;

    let gateBadge = 'Create Roadmap';
    let gateBadgeClass = '';
    let gateTitle = 'Generate Your AI Roadmap';
    let gateCopy = 'Complete the one-time roadmap setup form and the AI will build your roadmap immediately.';
    let ctaHtml = `
        <button
            id="academy-roadmap-apply-access-btn"
            type="button"
            class="btn-primary academy-home-action-btn academy-roadmap-gate-cta"
        >
            Create My Roadmap
        </button>
    `;

    if (membershipStatus !== 'approved') {
        gateBadge = 'Academy Approval Required';
        gateBadgeClass = 'is-pending';
        gateTitle = 'Academy membership must be approved first';
        gateCopy = 'You need Academy approval before you can request Roadmap access.';
        ctaHtml = '';
    } else if (hasRoadmapAccess) {
        openAcademyRoadmapView();
        return;
    } else if (
        roadmapStatus === 'approved'
    ) {
        openAcademyRoadmapView(true);
        return;
    }

    if (dynamicChatContainer) {
        dynamicChatContainer.innerHTML = `
            <div class="academy-home-stack">
                <section class="academy-home-panel academy-roadmap-gate-panel">
                    <div class="academy-home-panel-label">Roadmap Access</div>
                    <div class="academy-roadmap-gate-badge ${gateBadgeClass}">${gateBadge}</div>
                    <div class="academy-home-panel-copy">
                        <strong>${gateTitle}</strong><br>
                        ${gateCopy}
                    </div>
                    <div class="academy-home-chip-row">
                        <span class="yh-universe-feature-chip">Personalized plan</span>
                        <span class="yh-universe-feature-chip">Admin-reviewed</span>
                        <span class="yh-universe-feature-chip">AI-built roadmap</span>
                    </div>
                    <div class="academy-home-actions academy-roadmap-gate-actions">
                        ${ctaHtml}
                        <button
                            id="academy-roadmap-back-community-btn"
                            type="button"
                            class="btn-secondary academy-home-action-btn"
                        >
                            Back to Community
                        </button>
                    </div>
                </section>
            </div>
        `;
    }

    document.getElementById('academy-roadmap-apply-access-btn')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;

        await runDashboardButtonAction(button, 'Opening Roadmap Form...', async () => {
            openRoadmapIntake();
        });
    });

    document.getElementById('academy-roadmap-back-community-btn')?.addEventListener('click', () => {
        openAcademyFeedView();
    });

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;
}

function resetAcademyLauncherState() {
    document.getElementById('ai-form-phase')?.classList.remove('hidden-step');
    document.getElementById('ai-spinner-phase')?.classList.add('hidden-step');
    document.getElementById('ai-verdict-phase')?.classList.add('hidden-step');

    const verdictBtn = document.getElementById('btn-enter-academy-chat');
    if (verdictBtn) {
        verdictBtn.style.display = 'none';
        verdictBtn.innerText = yhT('dashboard.openAcademy');
        verdictBtn.onclick = null;
    }
}

function openAcademyLauncher() {
    if (!applyModal) return;
    resetAcademyLauncherState();
    applyAcademyIdentityPrefill();
    syncAcademyOccupationField();
    syncAcademyReferralFields();
    applyModal.classList.remove('hidden-step');
    document.body?.classList.add('academy-launcher-open');
}

function closeAcademyLauncher() {
    if (!applyModal) return;
    applyModal.classList.add('hidden-step');
    document.body?.classList.remove('academy-launcher-open');
}

window.openAcademyLauncher = openAcademyLauncher;
window.closeAcademyLauncher = closeAcademyLauncher;
const YH_ADMIN_PANEL_STORAGE_KEY = 'yh_admin_panel_state_v2';
const YH_ACADEMY_MEMBERSHIP_CACHE_KEY = 'yh_academy_membership_status_v1';
const YH_ACADEMY_APPROVAL_TOAST_SEEN_KEY = 'yh_academy_approval_toast_seen_v1';
const YH_ACADEMY_APPROVAL_BADGE_SEEN_KEY = 'yh_academy_approval_badge_seen_v1';
const YH_ACADEMY_COMMUNITY_APPROVAL_TOAST_SEEN_KEY = 'yh_academy_community_approval_toast_seen_v1';

function getAcademyApprovalMarker(snapshot = null) {
    const application =
        snapshot?.application && typeof snapshot.application === 'object'
            ? snapshot.application
            : {};

    return String(
        application.approvedAt ||
        application.reviewedAt ||
        application.updatedAt ||
        application.id ||
        snapshot?.applicationStatus ||
        ''
    ).trim();
}

function readAcademySeenMarker(storageKey) {
    try {
        return String(localStorage.getItem(storageKey) || '').trim();
    } catch (_) {
        return '';
    }
}

function writeAcademySeenMarker(storageKey, marker = '') {
    try {
        const cleanMarker = String(marker || '').trim();
        if (!cleanMarker) {
            localStorage.removeItem(storageKey);
            return;
        }
        localStorage.setItem(storageKey, cleanMarker);
    } catch (_) {}
}

function hasSeenAcademyApprovalToast(snapshot = null) {
    const marker = getAcademyApprovalMarker(snapshot);
    if (!marker) return false;
    return readAcademySeenMarker(YH_ACADEMY_APPROVAL_TOAST_SEEN_KEY) === marker;
}

function markAcademyApprovalToastSeen(snapshot = null) {
    writeAcademySeenMarker(
        YH_ACADEMY_APPROVAL_TOAST_SEEN_KEY,
        getAcademyApprovalMarker(snapshot)
    );
}

function hasSeenAcademyApprovalBadge(snapshot = null) {
    const marker = getAcademyApprovalMarker(snapshot);
    if (!marker) return false;
    return readAcademySeenMarker(YH_ACADEMY_APPROVAL_BADGE_SEEN_KEY) === marker;
}

function markAcademyApprovalBadgeSeen(snapshot = null) {
    writeAcademySeenMarker(
        YH_ACADEMY_APPROVAL_BADGE_SEEN_KEY,
        getAcademyApprovalMarker(snapshot)
    );
}

function hasSeenAcademyCommunityApprovalToast(snapshot = null) {
    const marker = getAcademyApprovalMarker(snapshot);
    if (!marker) return false;
    return readAcademySeenMarker(YH_ACADEMY_COMMUNITY_APPROVAL_TOAST_SEEN_KEY) === marker;
}

function markAcademyCommunityApprovalToastSeen(snapshot = null) {
    writeAcademySeenMarker(
        YH_ACADEMY_COMMUNITY_APPROVAL_TOAST_SEEN_KEY,
        getAcademyApprovalMarker(snapshot)
    );
}

function fadeOutAcademyApprovalBadge(stateBadge, snapshot = null) {
    if (!stateBadge) return;

    const marker = getAcademyApprovalMarker(snapshot);
    if (!marker) return;

    if (hasSeenAcademyApprovalBadge(snapshot)) {
        stateBadge.classList.add('is-hidden');
        stateBadge.textContent = '';
        stateBadge.style.opacity = '';
        stateBadge.style.transform = '';
        stateBadge.style.transition = '';
        return;
    }

    if (stateBadge.dataset.fadeMarker === marker) return;
    stateBadge.dataset.fadeMarker = marker;

    if (stateBadge._academyFadeTimer) {
        clearTimeout(stateBadge._academyFadeTimer);
    }

    if (stateBadge._academyHideTimer) {
        clearTimeout(stateBadge._academyHideTimer);
    }

    stateBadge.style.opacity = '1';
    stateBadge.style.transform = 'translateY(0)';
    stateBadge.style.transition = 'opacity 0.45s ease, transform 0.45s ease';

    stateBadge._academyFadeTimer = setTimeout(() => {
        stateBadge.style.opacity = '0';
        stateBadge.style.transform = 'translateY(-8px)';

        stateBadge._academyHideTimer = setTimeout(() => {
            stateBadge.classList.add('is-hidden');
            stateBadge.textContent = '';
            stateBadge.style.opacity = '';
            stateBadge.style.transform = '';
            stateBadge.style.transition = '';
            markAcademyApprovalBadgeSeen(snapshot);
        }, 460);
    }, 2600);
}

function readYhAdminPanelState() {
    try {
        const raw = localStorage.getItem(YH_ADMIN_PANEL_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writeYhAdminPanelState(nextState = {}) {
    localStorage.setItem(YH_ADMIN_PANEL_STORAGE_KEY, JSON.stringify(nextState));
}
function readAcademyMembershipCache() {
    try {
        const raw = localStorage.getItem(YH_ACADEMY_MEMBERSHIP_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function writeAcademyMembershipCache(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') {
        localStorage.removeItem(YH_ACADEMY_MEMBERSHIP_CACHE_KEY);
        return;
    }

    localStorage.setItem(YH_ACADEMY_MEMBERSHIP_CACHE_KEY, JSON.stringify(snapshot));
}
var academyMembershipRefreshPromise = null;
var academyMembershipRealtimeTimer = null;
var academyMembershipLastNotifiedStatus = '';
var academyMembershipLastFetchAt = 0;
var ACADEMY_MEMBERSHIP_POLL_MS = 60000;
var ACADEMY_MEMBERSHIP_MIN_REFRESH_GAP_MS = 30000;

function getAcademyMembershipFallbackSnapshot() {
    return {
        hasApplication: false,
        applicationStatus: '',
        hasRoadmapAccess: false,
        canEnterAcademy: false,
        application: null,
        roadmapApplication: null,
        roadmapApplicationStatus: ''
    };
}

function isTerminalAcademyMembershipStatus(status = '') {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === 'approved' || normalized === 'waitlisted' || normalized === 'rejected';
}

function shouldKeepAcademyMembershipRealtimeSync(snapshot = null) {
    if (!getStoredAuthToken()) return false;

    const membership = snapshot && typeof snapshot === 'object'
        ? snapshot
        : (readAcademyMembershipCache() || null);

    if (!membership || typeof membership !== 'object') return true;

    return !isTerminalAcademyMembershipStatus(membership.applicationStatus);
}

async function refreshAcademyMembershipStatus(force = false) {
    const cached = readAcademyMembershipCache();

    if (!force && cached && typeof cached === 'object') {
        syncAcademyEntryButton(cached);
        syncRoadmapTabIndicator(cached);
        return cached;
    }

    if (academyMembershipRefreshPromise) {
        return academyMembershipRefreshPromise;
    }

    academyMembershipLastFetchAt = Date.now();

    academyMembershipRefreshPromise = (async () => {
        try {
            const result = await academyAuthedFetch('/api/academy/membership-status', {
                method: 'GET'
            });

            const snapshot = {
                hasApplication: Boolean(result?.hasApplication),
                applicationStatus: String(result?.applicationStatus || '').trim().toLowerCase(),
                hasRoadmapAccess: result?.hasRoadmapAccess === true,
                canEnterAcademy: result?.canEnterAcademy === true,
                application: result?.application && typeof result.application === 'object'
                    ? result.application
                    : null,
                roadmapApplication: result?.roadmapApplication && typeof result.roadmapApplication === 'object'
                    ? result.roadmapApplication
                    : null,
                roadmapApplicationStatus: String(result?.roadmapApplicationStatus || '').trim().toLowerCase()
            };

            const previousStatus = String(cached?.applicationStatus || '').trim().toLowerCase();
            const nextStatus = String(snapshot?.applicationStatus || '').trim().toLowerCase();

            writeAcademyMembershipCache(snapshot);
            syncAcademyEntryButton(snapshot);
            syncRoadmapTabIndicator(snapshot);

    if (snapshot.application) {
        const currentAdminState = readYhAdminPanelState() || {};
        const currentApplications = Array.isArray(currentAdminState?.applications)
            ? currentAdminState.applications
            : [];

        writeYhAdminPanelState({
            ...currentAdminState,
            applications: [
                snapshot.application,
                ...currentApplications.filter((app) => app?.id !== snapshot.application.id)
            ]
        });
    }

            if (
                nextStatus &&
                nextStatus !== previousStatus &&
                nextStatus !== academyMembershipLastNotifiedStatus
            ) {
                academyMembershipLastNotifiedStatus = nextStatus;

                if (nextStatus === 'approved') {
                    if (!hasSeenAcademyApprovalToast(snapshot)) {
                        showToast('Academy approved. You can now enter.', 'success');
                        markAcademyApprovalToastSeen(snapshot);
                    }
                } else if (nextStatus === 'waitlisted') {
                    showToast('Your Academy application is now waitlisted.', 'error');
                } else if (nextStatus === 'rejected') {
                    showToast('Your Academy application has been reviewed.', 'error');
                }
            }

            if (!shouldKeepAcademyMembershipRealtimeSync(snapshot)) {
                stopAcademyMembershipRealtimeSync();
            }

            return snapshot;
        } catch (_) {
            const fallback = cached || getAcademyMembershipFallbackSnapshot();

            syncAcademyEntryButton(fallback);
            syncRoadmapTabIndicator(fallback);
            return fallback;
        } finally {
            academyMembershipRefreshPromise = null;
        }
    })();

    return academyMembershipRefreshPromise;
}

function requestAcademyMembershipRefresh(reason = '', force = false) {
    const cached = readAcademyMembershipCache();

    if (!getStoredAuthToken()) {
        return Promise.resolve(cached || getAcademyMembershipFallbackSnapshot());
    }

    if (academyMembershipRefreshPromise) {
        return academyMembershipRefreshPromise;
    }

    const now = Date.now();
    const hasFreshEnoughWindow =
        academyMembershipLastFetchAt > 0 &&
        (now - academyMembershipLastFetchAt) < ACADEMY_MEMBERSHIP_MIN_REFRESH_GAP_MS;

    if (!force && hasFreshEnoughWindow && cached && typeof cached === 'object') {
        syncAcademyEntryButton(cached);
        syncRoadmapTabIndicator(cached);
        return Promise.resolve(cached);
    }

    return refreshAcademyMembershipStatus(true).then((snapshot) => {
        if (!shouldKeepAcademyMembershipRealtimeSync(snapshot)) {
            stopAcademyMembershipRealtimeSync();
        }
        return snapshot;
    });
}
function getCurrentAcademyApplicantIdentity() {
    const rawDisplayName = String(getStoredUserValue('yh_user_name', 'Hustler')).trim();
    const nameParts = rawDisplayName.split(/\s+/).filter(Boolean);

    const firstName = readAcademyUserField(
        'yh_user_first_name',
        'yh_user_firstname'
    ) || nameParts[0] || 'Hustler';

    const surname = readAcademyUserField(
        'yh_user_surname',
        'yh_user_last_name',
        'yh_user_lastname'
    ) || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    const city = readAcademyUserField(
        'yh_user_city',
        'yh_user_location_city'
    );

    const country = readAcademyUserField(
        'yh_user_country',
        'yh_user_country_of_residence',
        'yh_user_location_country'
    );

    const countryOfOrigin = readAcademyUserField(
        'yh_user_country_of_origin'
    );

    const locationCountry = [city, country].filter(Boolean).join(', ') || country;

    return {
        name: rawDisplayName || [firstName, surname].filter(Boolean).join(' ').trim() || 'Hustler',
        firstName,
        surname,
        username: String(getStoredUserValue('yh_user_username', '') || '').trim(),
        email: String(getStoredUserValue('yh_user_email', '') || '').trim().toLowerCase(),
        city,
        country,
        countryOfOrigin,
        locationCountry
    };
}

function findCurrentAcademyMembershipApplication() {
    const identity = getCurrentAcademyApplicantIdentity();
    const adminState = readYhAdminPanelState();
    const applications = Array.isArray(adminState?.applications) ? adminState.applications : [];

    return applications.find((app) => {
        const appType = String(app?.applicationType || '').trim().toLowerCase();
        if (appType !== 'academy-membership') return false;

        const appEmail = String(app?.email || '').trim().toLowerCase();
        const appUsername = String(app?.username || '').trim().toLowerCase();

        if (identity.email && appEmail && appEmail === identity.email) return true;
        if (identity.username && appUsername && appUsername === identity.username.toLowerCase()) return true;

        return false;
    }) || null;
}

function getCurrentAcademyMembershipStatus() {
    const cached = readAcademyMembershipCache();
    if (cached?.applicationStatus) {
        return String(cached.applicationStatus).trim().toLowerCase();
    }

    return String(findCurrentAcademyMembershipApplication()?.status || '').trim().toLowerCase();
}

function queueAcademyMembershipApplication(payload = {}, serverApplication = null) {
    const identity = getCurrentAcademyApplicantIdentity();
    const adminState = readYhAdminPanelState();
    const applications = Array.isArray(adminState?.applications) ? adminState.applications : [];
    const existing = findCurrentAcademyMembershipApplication();
    const persisted = serverApplication && typeof serverApplication === 'object' ? serverApplication : null;

    const fullName = String(
        payload.fullName ||
        [payload.firstName || '', payload.surname || ''].filter(Boolean).join(' ') ||
        identity.name ||
        'Hustler'
    ).trim();

    const topSkills = String(payload.skills || '')
        .split(/[,;\n/|]+/g)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6);

    const background = [
        payload.skills || '',
        payload.hearAboutUs || (payload.referredByUsername ? `Referred by @${payload.referredByUsername}` : ''),
        payload.nonNegotiable || ''
    ].filter(Boolean).join(' • ');

    const fallbackProfile = {
        firstName: String(payload.firstName || '').trim(),
        surname: String(payload.surname || '').trim(),
        fullName,
        email: String(payload.email || identity.email || '').trim().toLowerCase(),
        age: String(payload.age || '').trim(),
        occupationAtAge: String(payload.occupationAtAge || '').trim(),
        skills: String(payload.skills || '').trim(),
        topSkills,
        referredByUsername: String(payload.referredByUsername || '').trim().replace(/^@+/, ''),
        hearAboutUs: String(payload.hearAboutUs || '').trim(),
        cityOfResidence: String(payload.cityOfResidence || identity.city || '').trim(),
        countryOfResidence: String(payload.countryOfResidence || identity.country || '').trim(),
        countryOfOrigin: String(payload.countryOfOrigin || identity.countryOfOrigin || '').trim(),
        locationCountry: String(
            payload.locationCountry ||
            [payload.cityOfResidence || identity.city || '', payload.countryOfResidence || identity.country || '']
                .filter(Boolean)
                .join(', ') ||
            payload.countryOfResidence ||
            identity.country ||
            ''
        ).trim(),
        seriousness: String(payload.seriousness || '').trim(),
        nonNegotiable: String(payload.nonNegotiable || '').trim(),

        whyNow: String(payload.whyNow || '').trim(),
        mainGoal: String(payload.mainGoal || '').trim(),
        proofWork: String(payload.proofWork || '').trim(),
        sacrifice: String(payload.sacrifice || '').trim(),
        weeklyHours: String(payload.weeklyHours || '').trim(),
        adminNote: String(payload.adminNote || '').trim()
    };

    const nextRecord = {
        id: persisted?.id || existing?.id || `APP-${Date.now().toString().slice(-6)}`,
        name: persisted?.name || persisted?.fullName || fullName,
        fullName: persisted?.fullName || fullName,
        firstName: persisted?.firstName || fallbackProfile.firstName,
        surname: persisted?.surname || fallbackProfile.surname,
        username: persisted?.username || identity.username || '',
        email: persisted?.email || fallbackProfile.email,
        age: persisted?.age || fallbackProfile.age,
        occupationAtAge: persisted?.occupationAtAge || fallbackProfile.occupationAtAge,
        referredByUsername: persisted?.referredByUsername || fallbackProfile.referredByUsername,
        hearAboutUs: persisted?.hearAboutUs || fallbackProfile.hearAboutUs,
        cityOfResidence: persisted?.cityOfResidence || fallbackProfile.cityOfResidence,
        countryOfResidence: persisted?.countryOfResidence || fallbackProfile.countryOfResidence,
        countryOfOrigin: persisted?.countryOfOrigin || fallbackProfile.countryOfOrigin,
        locationCountry: persisted?.locationCountry || fallbackProfile.locationCountry,
        goal: persisted?.goal || fallbackProfile.occupationAtAge || 'Academy membership application',
        background: persisted?.background || background || 'No background summary submitted.',
        recommendedDivision: persisted?.recommendedDivision || 'Academy',
        applicationType: persisted?.applicationType || 'academy-membership',
        reviewLane: persisted?.reviewLane || 'Academy Membership',
        status: persisted?.status || (
            existing?.status && !['rejected', 'waitlisted'].includes(String(existing.status).toLowerCase())
                ? existing.status
                : 'Under Review'
        ),
        aiScore: Number(
            persisted?.aiScore ??
            existing?.aiScore ??
            0
        ),
        country: persisted?.country || fallbackProfile.countryOfResidence || '',
        skills: Array.isArray(persisted?.skills) && persisted.skills.length
            ? persisted.skills
            : topSkills,
        seriousness: persisted?.seriousness || fallbackProfile.seriousness,
        nonNegotiable: persisted?.nonNegotiable || fallbackProfile.nonNegotiable,
        networkValue: persisted?.networkValue || existing?.networkValue || 'Unknown',
        source: persisted?.source || 'Academy Dashboard',
        submittedAt: persisted?.submittedAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
        notes: Array.isArray(persisted?.notes)
            ? persisted.notes
            : [
                'Submitted from dashboard Academy membership flow.',
                ...(Array.isArray(existing?.notes) ? existing.notes : [])
            ].filter(Boolean),
        academyProfile:
            persisted?.academyProfile && typeof persisted.academyProfile === 'object'
                ? persisted.academyProfile
                : fallbackProfile
    };

    const nextApplications = existing
        ? applications.map((app) => app?.id === existing.id ? nextRecord : app)
        : [nextRecord, ...applications];

    writeYhAdminPanelState({
        ...adminState,
        applications: nextApplications
    });

    return nextRecord;
}
var academySuppressClickUntil = 0;

async function handleAcademyLaunchClick(event) {
    const eventType = event?.type || '';
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();

    if (eventType === 'click' && now < academySuppressClickUntil) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return false;
    }

    if (eventType === 'touchend' || eventType === 'pointerup') {
        academySuppressClickUntil = now + 700;
    }

    if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    showAcademyTabLoader('Entering Academy...');
    try {
        let membershipSnapshot = null;

        try {
            membershipSnapshot = await refreshAcademyMembershipStatus(true);
        } catch (error) {
            console.error('handleAcademyLaunchClick refresh error:', error);
            showToast(error?.message || 'Failed to load Academy membership status.', 'error');
            return false;
        }

        const membershipStatus = String(
            membershipSnapshot?.applicationStatus || ''
        ).trim().toLowerCase();

        syncAcademyEntryButton(membershipSnapshot);

        if (membershipStatus === 'approved') {
            const hasRoadmapAccess = membershipSnapshot?.hasRoadmapAccess === true;

            if (!hasSeenAcademyCommunityApprovalToast(membershipSnapshot)) {
                showToast(
                    hasRoadmapAccess
                        ? 'Academy membership approved. Opening Roadmap.'
                        : 'Academy membership approved. Opening Community Feed.',
                    'success'
                );
                markAcademyCommunityApprovalToastSeen(membershipSnapshot);
            }

            // default on entry: roadmap if unlocked, otherwise community
            enterAcademyWorld('home');
            return false;
        }

        if (membershipStatus === 'under review' || membershipStatus === 'new') {
            showToast('Your Academy application is already under review.', 'error');
            return false;
        }

        if (membershipStatus === 'waitlisted') {
            showToast('Your Academy application is waitlisted. Contact admin for the next step.', 'error');
            return false;
        }

        if (membershipStatus === 'rejected') {
            showToast('Your Academy application has already been reviewed. Only admin can reopen it.', 'error');
            return false;
        }

        if (hasAcademyApplicationAlreadyBeenFilled()) {
            showToast('You already filled the Academy application. Please wait for admin review.', 'error');
            return false;
        }

        openAcademyLauncher();
        return false;
    } finally {
        hideAcademyTabLoader();
    }
}
window.handleAcademyLaunchClick = handleAcademyLaunchClick;

var academyLaunchLock = false;

async function runAcademyLaunch(event) {
    const launchTarget = resolveAcademyLaunchTarget(event);
    if (!launchTarget) return false;

    if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
    }

    if (!btnOpenApply) return false;
    if (btnOpenApply.dataset.loading === 'true') return false;
    if (academyLaunchLock) return false;

    academyLaunchLock = true;
    setDashboardButtonLoadingState(
        btnOpenApply,
        true,
        btnOpenApply.dataset.loadingLabel || 'Opening...'
    );

    try {
        return await handleAcademyLaunchClick(event);
    } finally {
        requestAnimationFrame(() => {
            academyLaunchLock = false;

            if (btnOpenApply) {
                setDashboardButtonLoadingState(btnOpenApply, false);
            }
        });
    }
}

function bindAcademyLaunchTarget(target) {
    if (!target || target.dataset.launchBound === 'true') return;

    target.dataset.launchBound = 'true';
    target.style.pointerEvents = 'auto';
    target.style.touchAction = 'manipulation';
    target.style.cursor = 'pointer';

    target.addEventListener('click', runAcademyLaunch);

    target.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            runAcademyLaunch(event);
        }
    });
}

if (academyEntryWrap) {
    academyEntryWrap.style.pointerEvents = 'auto';
}

if (academyEntryShell) {
    academyEntryShell.style.pointerEvents = 'auto';
    academyEntryShell.style.touchAction = 'manipulation';
    academyEntryShell.style.cursor = 'pointer';
    academyEntryShell.setAttribute('role', 'button');
    academyEntryShell.setAttribute('tabindex', '0');
    bindAcademyLaunchTarget(academyEntryShell);
}

if (btnOpenApply) {
    btnOpenApply.setAttribute('type', 'button');
    btnOpenApply.setAttribute('tabindex', '-1');
    btnOpenApply.setAttribute('aria-hidden', 'true');
}

if (academyEntryVisual) {
    academyEntryVisual.style.pointerEvents = 'none';
    academyEntryVisual.style.userSelect = 'none';
    academyEntryVisual.style.webkitUserSelect = 'none';
}

if (btnOpenApply) {
    btnOpenApply.setAttribute('type', 'button');
    btnOpenApply.setAttribute('tabindex', '-1');
    btnOpenApply.style.pointerEvents = 'auto';
    btnOpenApply.style.touchAction = 'manipulation';
    btnOpenApply.style.cursor = 'pointer';
    bindAcademyLaunchTarget(btnOpenApply);
}

closeApplyBtn?.addEventListener('click', closeAcademyLauncher);

// Delete post confirmation is handled inside academyFeedOpenDeleteModal via openYHConfirmModal.

applyModal?.addEventListener('click', (event) => {
    if (event.target === applyModal) {
        closeAcademyLauncher();
    }
});

document.getElementById('academy-feed-delete-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'academy-feed-delete-modal') {
        academyFeedCloseDeleteModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && applyModal && !applyModal.classList.contains('hidden-step')) {
        closeAcademyLauncher();
    }
});

if (isStandaloneAcademyPage()) {
    writeDashboardViewState({
        view: 'academy',
        division: 'academy',
        academySection: getAcademySectionFromUrl()
    });
}

// Restore last UI location after refresh/reload
restoreDashboardViewState();

const formApply = document.getElementById('form-academy-apply');

function readAcademyUserField(keys) {
    for (const key of keys) {
        const value = getStoredUserValue(key, '');
        if (String(value || '').trim()) {
            return String(value).trim();
        }
    }
    return '';
}

function applyAcademyIdentityPrefill() {
    const identity = getCurrentAcademyApplicantIdentity();

    const prefillMap = [
        ['app-first-name', identity.firstName],
        ['app-surname', identity.surname],
        ['app-location-country', identity.country],
        ['app-city-residence', identity.city],
        ['app-country-origin', identity.countryOfOrigin],
        ['app-email', identity.email]
    ];

    prefillMap.forEach(([fieldId, fieldValue]) => {
        const input = document.getElementById(fieldId);
        if (!input) return;

        const cleanValue = String(fieldValue || '').trim();
        const hasPrefill = Boolean(cleanValue);

        if (hasPrefill) {
            input.value = cleanValue;
            input.defaultValue = cleanValue;
            input.readOnly = true;
            input.dataset.prefilled = 'true';
        } else {
            input.value = '';
            input.defaultValue = '';
            input.readOnly = false;
            input.dataset.prefilled = 'false';
        }
    });
}

function syncAcademyOccupationField() {
    const ageInput = document.getElementById('app-age');
    const occupationLabel = document.getElementById('app-occupation-label');
    const occupationInput = document.getElementById('app-occupation');

    if (!occupationLabel || !occupationInput) return;

    const ageValue = String(ageInput?.value || '').trim();

    occupationLabel.innerText = ageValue
        ? `What do you do for a living at the age of ${ageValue}?`
        : 'What do you do for a living at the age of your answer above?';

    occupationInput.placeholder = ageValue
        ? `Tell us what you do for a living at age ${ageValue}.`
        : 'What do you currently do for a living at your age right now?';
}

function syncAcademyReferralFields() {
    const referrerInput = document.getElementById('app-referred-by');
    const hearAboutInput = document.getElementById('app-hear-about');
    const hearAboutLabel = document.getElementById('app-hear-about-label');

    if (!hearAboutInput || !hearAboutLabel) return;

    const hasReferrer = Boolean(String(referrerInput?.value || '').trim());

    hearAboutInput.required = !hasReferrer;
    hearAboutLabel.innerText = hasReferrer
        ? 'In case the referrer username is incorrect, how did you hear from us?'
        : 'In case no one referred you, how did you hear from us?';
}

document.getElementById('app-age')?.addEventListener('input', syncAcademyOccupationField);
document.getElementById('app-referred-by')?.addEventListener('input', syncAcademyReferralFields);

applyAcademyIdentityPrefill();
syncAcademyOccupationField();
syncAcademyReferralFields();

const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

if (formApply) {
    formApply.addEventListener('submit', async (e) => {
        e.preventDefault();

// Let the backend decide whether the application already exists.
// Do not hard-block here based only on stale local browser state.

        const token = getStoredAuthToken();
        if (!token) {
            showToast("Your session expired. Please log in again.", "error");
            return;
        }

        const aiFormPhase = document.getElementById('ai-form-phase');
        const aiSpinnerPhase = document.getElementById('ai-spinner-phase');
        const aiVerdictPhase = document.getElementById('ai-verdict-phase');

        const vIcon = document.getElementById('ai-verdict-icon');
        const vTitle = document.getElementById('ai-verdict-title');
        const vDesc = document.getElementById('ai-verdict-desc');
        const btnEnter = document.getElementById('btn-enter-academy-chat');

        aiFormPhase?.classList.add('hidden-step');
        aiVerdictPhase?.classList.add('hidden-step');
        aiSpinnerPhase?.classList.remove('hidden-step');

const applicantIdentity = getCurrentAcademyApplicantIdentity();

const referrerUsername = String(
    document.getElementById('app-referred-by')?.value || ''
).trim().replace(/^@+/, '');

const hearAboutUs = String(
    document.getElementById('app-hear-about')?.value || ''
).trim();

if (!referrerUsername && !hearAboutUs) {
    aiSpinnerPhase?.classList.add('hidden-step');
    aiVerdictPhase?.classList.add('hidden-step');
    aiFormPhase?.classList.remove('hidden-step');
    showToast("Please enter a referrer username or tell us how you heard about The Academy.", "error");
    return;
}

const firstName = document.getElementById('app-first-name')?.value?.trim() || '';
const surname = document.getElementById('app-surname')?.value?.trim() || '';
const countryOfResidence = document.getElementById('app-location-country')?.value?.trim() || '';
const cityOfResidence = document.getElementById('app-city-residence')?.value?.trim() || '';
const countryOfOrigin = document.getElementById('app-country-origin')?.value?.trim() || '';
const locationCountry = [cityOfResidence, countryOfResidence].filter(Boolean).join(', ') || countryOfResidence;
const email = document.getElementById('app-email')?.value?.trim().toLowerCase() || '';
const age = document.getElementById('app-age')?.value?.trim() || '';
const occupationAtAge = document.getElementById('app-occupation')?.value?.trim() || '';
const skills = document.getElementById('app-skills')?.value?.trim() || '';
const seriousness = document.getElementById('app-seriousness')?.value?.trim() || '';
const nonNegotiable = document.getElementById('app-nonnegotiable')?.value?.trim() || '';

const fullName = [firstName, surname].filter(Boolean).join(' ').trim();

const payload = {
    applicationType: 'academy-membership',
    name: fullName || applicantIdentity.name || 'Hustler',
    firstName,
    surname,
    fullName: fullName || applicantIdentity.name || '',
    username: applicantIdentity.username || '',
    email,
    age,
    occupationAtAge,
    skills,
    referredByUsername: referrerUsername,
    hearAboutUs,
    cityOfResidence,
    countryOfResidence,
    countryOfOrigin,
    locationCountry,
    seriousness,
    nonNegotiable,

    // Compatibility bridge for any old Academy backend logic
    whyNow: hearAboutUs || `Referred by @${referrerUsername}`,
    mainGoal: occupationAtAge,
    proofWork: skills,
    sacrifice: '',
    weeklyHours: '',
    adminNote: ''
};

try {
    const result = await academyAuthedFetch('/api/academy/membership-apply', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    const savedApplication =
        result?.application && typeof result.application === 'object'
            ? result.application
            : null;

    queueAcademyMembershipApplication(payload, savedApplication);
    writeAcademyMembershipCache({
        hasApplication: true,
        applicationStatus: String(savedApplication?.status || 'Under Review').trim().toLowerCase(),
        hasRoadmapAccess: false,
        canEnterAcademy: false,
        application: savedApplication
    });
    localStorage.setItem(
        'yh_academy_application_profile',
        JSON.stringify(savedApplication?.academyProfile || payload)
    );

    aiSpinnerPhase?.classList.add('hidden-step');
    aiVerdictPhase?.classList.remove('hidden-step');

            if (vIcon) vIcon.innerText = "📝";
            if (vTitle) {
                vTitle.innerText = "Application Submitted for Review";
                vTitle.style.color = "var(--neon-blue)";
            }
            if (vDesc) {
                vDesc.innerHTML = `
                    Your Academy membership application is now pending manual admin review.
                    <br><br>
                    You will get an answer within the next 24 hours, check your email for updates.
                    <br><br>
                    Once approved, you will be able to enter the Academy community.
                    <br><br>
                    Roadmap access will remain separate.
                `;
            }

            if (btnEnter) {
                btnEnter.style.display = 'block';
                btnEnter.innerText = "Close ➔";
                btnEnter.onclick = () => {
                    closeAcademyLauncher();
                    aiVerdictPhase?.classList.add('hidden-step');
                    aiFormPhase?.classList.remove('hidden-step');
                };
            }

            formApply.reset();
            applyAcademyIdentityPrefill();
            syncAcademyOccupationField();
            syncAcademyReferralFields();
        } catch (error) {
            aiSpinnerPhase?.classList.add('hidden-step');
            aiFormPhase?.classList.remove('hidden-step');
            showToast("Failed to submit Academy application.", "error");
        }
    });
}

const roadmapForm = document.getElementById('form-academy-roadmap');
const roadmapContinueBtn = document.getElementById('btn-roadmap-continue');
const roadmapBackBtn = document.getElementById('btn-roadmap-back');

closeRoadmapBtn?.addEventListener('click', closeRoadmapIntake);

roadmapModal?.addEventListener('click', (event) => {
    if (event.target === roadmapModal) {
        closeRoadmapIntake();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && roadmapModal && !roadmapModal.classList.contains('hidden-step')) {
        closeRoadmapIntake();
    }
});

roadmapContinueBtn?.addEventListener('click', () => {
    const focusAreaSelect = document.getElementById('roadmap-focus-area');
    const selectedScopeKey = String(focusAreaSelect?.value || '').trim();
    const config = getRoadmapScopeConfig(selectedScopeKey);

    if (!selectedScopeKey || !config) {
        showToast('Choose your roadmap focus first.', 'error');
        focusAreaSelect?.focus();
        return;
    }

    document.getElementById('roadmap-focus-area-key').value = selectedScopeKey;
    document.getElementById('roadmap-schema-key').value = config.schemaKey;
    document.getElementById('roadmap-intake-version').value = '2';

    renderRoadmapScopeQuestions(selectedScopeKey);
    setRoadmapIntakePhase(2);
    document.querySelector('#roadmap-scope-questions .input-field')?.focus();
});

roadmapBackBtn?.addEventListener('click', () => {
    setRoadmapIntakePhase(1);
    document.getElementById('roadmap-focus-area')?.focus();
});

if (roadmapForm) {
    roadmapForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (hasRoadmapIntakeAlreadyBeenFilled()) {
            showToast('Roadmap setup has already been completed.', 'error');
            closeRoadmapIntake();
            return;
        }

        const phase2 = document.getElementById('roadmap-phase-2');
        if (phase2?.classList.contains('hidden-step')) {
            showToast('Choose your roadmap focus first.', 'error');
            document.getElementById('roadmap-focus-area')?.focus();
            return;
        }

        if (!roadmapForm.reportValidity()) {
            return;
        }

        const submitBtn = document.getElementById('btn-submit-roadmap-intake');
        const focusAreaKey = document.getElementById('roadmap-focus-area-key')?.value?.trim() || '';
        const schemaKey = document.getElementById('roadmap-schema-key')?.value?.trim() || '';
        const intakeVersion = Number(document.getElementById('roadmap-intake-version')?.value || '2') || 2;
        const scopeConfig = getRoadmapScopeConfig(focusAreaKey);

        if (!scopeConfig) {
            showToast('Choose your roadmap focus first.', 'error');
            setRoadmapIntakePhase(1);
            document.getElementById('roadmap-focus-area')?.focus();
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Creating Roadmap...';
        }

        const payload = {
            focusArea: scopeConfig.label,
            focusAreaKey,
            schemaKey,
            intakeVersion,
            currentLevel: document.getElementById('roadmap-current-level')?.value?.trim() || '',
            target30Days: document.getElementById('roadmap-target-30')?.value?.trim() || '',
            dailyHours: document.getElementById('roadmap-daily-hours')?.value?.trim() || '',
            weeklyHours: document.getElementById('roadmap-weekly-hours')?.value?.trim() || '',
            sleepHours: document.getElementById('roadmap-sleep-hours')?.value?.trim() || '',
            energyLevel: document.getElementById('roadmap-energy-level')?.value?.trim() || '',
            stressLevel: document.getElementById('roadmap-stress-level')?.value?.trim() || '',
            badHabit: document.getElementById('roadmap-bad-habit')?.value?.trim() || '',
            blockerText: document.getElementById('roadmap-blocker-text')?.value?.trim() || '',
            coachTone: document.getElementById('roadmap-coach-tone')?.value?.trim() || 'balanced',
            firstQuickWin: document.getElementById('roadmap-first-win')?.value?.trim() || '',
            scopeAnswers: collectRoadmapScopeAnswers(focusAreaKey),
            submittedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(YH_ROADMAP_PROFILE_KEY, JSON.stringify(payload));

            const result = await academyAuthedFetch('/api/academy/roadmap-apply', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const roadmapApplication =
                result?.roadmapApplication && typeof result.roadmapApplication === 'object'
                    ? result.roadmapApplication
                    : null;

            const nextSnapshot = {
                ...(readAcademyMembershipCache() || {}),
                roadmapApplication,
                roadmapApplicationStatus: String(
                    roadmapApplication?.status || 'Approved'
                ).trim().toLowerCase(),
                hasRoadmapAccess: result?.hasRoadmapAccess === true || true
            };

            writeAcademyMembershipCache(nextSnapshot);
            localStorage.removeItem(YH_ROADMAP_LOCK_KEY);

            closeRoadmapIntake();
            syncRoadmapTabIndicator(nextSnapshot);
            openAcademyRoadmapView(true);

            showToast('Your AI roadmap is ready.', 'success');
        } catch (error) {
            localStorage.removeItem(YH_ROADMAP_LOCK_KEY);

            showToast(
                error.message || 'Failed to submit roadmap application.',
                'error'
            );
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = yhT('dashboard.roadmapSubmit');
            }
        }
    });
}

// ✅ Close DOMContentLoaded wrapper
});