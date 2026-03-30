// public/js/dashboard.js

// ==========================================
// 1. GLOBAL AUTH, SOCKET & UTILITIES
// ==========================================
if (localStorage.getItem('yh_user_loggedIn') !== 'true') {
    window.location.href = '/';
}

const socket = io(); 
const myName = localStorage.getItem('yh_user_name') || "Hustler";

let currentRoom = "YH-community";      // UI/display label
let currentRoomId = "YH-community";    // backend transport identity
let currentRoomMeta = {
    type: 'main-chat',
    name: 'YH-community',
    roomId: 'YH-community'
};

function normalizeRoomKey(value) {
    return String(value ?? '').trim();
}

function getDashboardState() {
    return window.dashboardState || window.yhDashboardState || (window.dashboardState = {});
}

function getActiveRoomId() {
    const roomId = currentRoomMeta?.roomId || currentRoomId || currentRoom || null;
    return roomId ? normalizeRoomKey(roomId) : null;
}

function getActiveRoomLabel() {
    return currentRoomMeta?.name || currentRoom || currentRoomId || 'this room';
}

function getIncomingRoomId(msg) {
    const roomId = msg?.roomId || msg?.room || msg?.roomName || null;
    return roomId ? normalizeRoomKey(roomId) : null;
}

function isMessageForActiveRoom(msg) {
    const incomingRoomId = getIncomingRoomId(msg);
    const activeRoomId = getActiveRoomId();
    if (!incomingRoomId || !activeRoomId) return false;
    return incomingRoomId === activeRoomId;
}

function syncCustomRoomsUI(rooms = []) {
    const state = getDashboardState();
    const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
        .map((room, index) => {
            if (typeof normalizeCustomRoomForRender === 'function') {
                return normalizeCustomRoomForRender(room, index);
            }
            return room;
        })
        .filter((room) => normalizeRoomKey(room?.id || room?.roomId || room?.room_id));

    state.customRooms = normalizedRooms;

    try {
        localStorage.setItem('yh_custom_rooms_cache', JSON.stringify({
            savedAt: Date.now(),
            rooms: normalizedRooms
        }));
    } catch (error) {
        console.warn('Failed to sync custom rooms cache:', error);
    }

    try {
        localStorage.setItem('yh_custom_rooms', JSON.stringify(
            normalizedRooms.map((room) => ({
                id: room.id,
                type: room.type,
                name: room.name,
                icon: room.icon,
                color: room.color,
                privacy: room.privacy,
                isPrivate: room.isPrivate,
                unreadCount: Number(room.unreadCount || 0),
                lastMessage: room.lastMessage || '',
                lastMessageAuthor: room.lastMessageAuthor || '',
                lastMessageAt: room.lastMessageAt || ''
            }))
        ));
    } catch (error) {
        console.warn('Failed to sync legacy custom rooms mirror:', error);
    }

    if (typeof renderCustomRooms === 'function') {
        renderCustomRooms(normalizedRooms);
    }

    if (typeof renderChatboxRooms === 'function') {
        renderChatboxRooms(normalizedRooms);
    }

    if (typeof syncCustomRoomNotifications === 'function') {
        syncCustomRoomNotifications(normalizedRooms);
    }

    if (typeof updateCustomRoomUnreadBadges === 'function') {
        updateCustomRoomUnreadBadges(normalizedRooms);
    }

    return normalizedRooms;
}

function setActiveCustomRoomState(room = null) {
    const state = getDashboardState();
    const roomId = normalizeRoomKey(room?.id || room?.roomId || room?.room_id);

    if (!roomId) {
        state.activeCustomRoom = null;
        return null;
    }

    state.activeCustomRoom = {
        id: roomId,
        name: room?.name || room?.roomName || room?.title || 'Private Room',
        type: room?.type || room?.roomType || room?.room_type || 'dm',
        privacy: room?.privacy || room?.visibility || (room?.isPrivate ? 'private' : 'public') || 'private',
        topic: room?.topic || room?.roomTopic || '',
        icon: room?.icon || room?.emoji || '💬',
        color: room?.color || room?.themeColor || room?.theme_color || 'var(--neon-blue)'
    };

    return state.activeCustomRoom;
}

function moveCustomRoomToTop(rooms = [], roomId = '') {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId) return Array.isArray(rooms) ? rooms : [];

    const list = Array.isArray(rooms) ? [...rooms] : [];
    const targetIndex = list.findIndex((room) => {
        return normalizeRoomKey(room?.id || room?.roomId || room?.room_id) === normalizedRoomId;
    });

    if (targetIndex <= 0) return list;

    const [targetRoom] = list.splice(targetIndex, 1);
    list.unshift(targetRoom);
    return list;
}

function markCustomRoomAsRead(roomId) {
    const normalizedRoomId = normalizeRoomKey(roomId);
    if (!normalizedRoomId || normalizedRoomId === 'YH-community') return;

    const state = getDashboardState();
    const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];
    let changed = false;

    const nextRooms = currentRooms.map((room, index) => {
        const normalizedRoom = typeof normalizeCustomRoomForRender === 'function'
            ? normalizeCustomRoomForRender(room, index)
            : room;

        const existingRoomId = normalizeRoomKey(
            normalizedRoom?.id || normalizedRoom?.roomId || normalizedRoom?.room_id
        );

        if (existingRoomId !== normalizedRoomId) return normalizedRoom;

        const currentUnread = Number(normalizedRoom?.unreadCount || normalizedRoom?.unread_count || 0);
        if (currentUnread === 0) return normalizedRoom;

        changed = true;

        return typeof normalizeCustomRoomForRender === 'function'
            ? normalizeCustomRoomForRender({
                ...normalizedRoom,
                unreadCount: 0
            }, index)
            : {
                ...normalizedRoom,
                unreadCount: 0
            };
    });

    if (changed) {
        syncCustomRoomsUI(nextRooms);
    }
}

function touchCustomRoomFromMessage(msg, options = {}) {
    const roomId = getIncomingRoomId(msg);
    if (!roomId || roomId === 'YH-community') return null;

    const state = getDashboardState();
    const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];
    const activeMeta = currentRoomMeta && normalizeRoomKey(currentRoomMeta.roomId) === roomId
        ? currentRoomMeta
        : null;

    const cleanedText = String(msg?.text || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Sent an attachment';

    let touchedRoom = null;
    let found = false;

    const nextRooms = currentRooms.map((room, index) => {
        const normalizedRoom = typeof normalizeCustomRoomForRender === 'function'
            ? normalizeCustomRoomForRender(room, index)
            : room;

        const existingRoomId = normalizeRoomKey(
            normalizedRoom?.id || normalizedRoom?.roomId || normalizedRoom?.room_id
        );

        if (existingRoomId !== roomId) return normalizedRoom;

        found = true;

        const currentUnread = Number(normalizedRoom?.unreadCount || normalizedRoom?.unread_count || 0);
        const nextUnread = options.resetUnread
            ? 0
            : options.incrementUnread
            ? currentUnread + 1
            : currentUnread;

        touchedRoom = {
            ...normalizedRoom,
            id: roomId,
            name: msg?.roomName || activeMeta?.name || normalizedRoom?.name || 'Private Room',
            type: normalizedRoom?.type || activeMeta?.type || 'dm',
            icon: normalizedRoom?.icon || activeMeta?.icon || '💬',
            color: normalizedRoom?.color || activeMeta?.color || 'var(--neon-blue)',
            topic: normalizedRoom?.topic || activeMeta?.topic || ((normalizedRoom?.type || activeMeta?.type) === 'group' ? 'Private Brainstorming Group' : 'Direct Message'),
            lastMessage: cleanedText,
            lastMessageAuthor: msg?.author || normalizedRoom?.lastMessageAuthor || '',
            lastMessageAt: msg?.time || new Date().toISOString(),
            unreadCount: Math.max(0, nextUnread)
        };

        return typeof normalizeCustomRoomForRender === 'function'
            ? normalizeCustomRoomForRender(touchedRoom, index)
            : touchedRoom;
    });

    if (!found && options.createIfMissing) {
        touchedRoom = typeof normalizeCustomRoomForRender === 'function'
            ? normalizeCustomRoomForRender({
                id: roomId,
                name: msg?.roomName || activeMeta?.name || 'Private Room',
                type: activeMeta?.type || 'dm',
                icon: activeMeta?.icon || '💬',
                color: activeMeta?.color || 'var(--neon-blue)',
                privacy: activeMeta?.privacy || 'private',
                isPrivate: true,
                topic: activeMeta?.topic || ((activeMeta?.type || 'dm') === 'group' ? 'Private Brainstorming Group' : 'Direct Message'),
                memberCount: 0,
                unreadCount: options.resetUnread ? 0 : (options.incrementUnread ? 1 : 0),
                lastMessage: cleanedText,
                lastMessageAuthor: msg?.author || '',
                lastMessageAt: msg?.time || new Date().toISOString()
            }, currentRooms.length)
            : {
                id: roomId,
                name: msg?.roomName || activeMeta?.name || 'Private Room',
                type: activeMeta?.type || 'dm',
                icon: activeMeta?.icon || '💬',
                color: activeMeta?.color || 'var(--neon-blue)',
                privacy: activeMeta?.privacy || 'private',
                isPrivate: true,
                topic: activeMeta?.topic || ((activeMeta?.type || 'dm') === 'group' ? 'Private Brainstorming Group' : 'Direct Message'),
                memberCount: 0,
                unreadCount: options.resetUnread ? 0 : (options.incrementUnread ? 1 : 0),
                lastMessage: cleanedText,
                lastMessageAuthor: msg?.author || '',
                lastMessageAt: msg?.time || new Date().toISOString()
            };

        nextRooms.unshift(touchedRoom);
    }

    if (!touchedRoom) return null;

    const reorderedRooms = moveCustomRoomToTop(nextRooms, roomId);
    syncCustomRoomsUI(reorderedRooms);

    return touchedRoom;
}

function logoutUser() {
    localStorage.removeItem('yh_user_loggedIn');
    localStorage.removeItem('yh_user_name');
    localStorage.removeItem('yh_user_username');
    localStorage.removeItem('yh_user_email');
    localStorage.removeItem('yh_user_avatar');
    localStorage.removeItem('yh_academy_access');
    localStorage.removeItem('yh_academy_home');
    localStorage.removeItem('yh_token');

    localStorage.removeItem('yh_academy_membership_status_v1');
    localStorage.removeItem('yh_academy_application_profile');
    localStorage.removeItem('yh_academy_roadmap_profile_v1');
    localStorage.removeItem('yh_academy_roadmap_locked_v1');
    localStorage.removeItem('yh_admin_panel_state_v2');
    localStorage.removeItem('yh_admin_panel_state_v3_live');

    sessionStorage.removeItem('yh_force_academy_application_after_auth');

    window.location.href = '/';
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast || !toastMsg || !toastIcon) return;

    const isMobile = window.innerWidth <= 768;

    toastMsg.innerText = message;

    if (type === "error") {
        toast.classList.add('error-toast');
        toastIcon.innerText = "⚠️";
    } else {
        toast.classList.remove('error-toast');
        toastIcon.innerText = "🎉";
    }

    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.right = 'auto';
    toast.style.top = isMobile ? '84px' : '96px';
    toast.style.bottom = 'auto';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '10000';
    toast.style.width = isMobile ? 'calc(100vw - 32px)' : 'min(92vw, 460px)';
    toast.style.maxWidth = isMobile ? '360px' : '460px';
    toast.style.minWidth = '0';
    toast.style.padding = isMobile ? '9px 12px' : '10px 14px';
    toast.style.borderRadius = isMobile ? '10px' : '12px';
    toast.style.fontSize = isMobile ? '0.84rem' : '0.9rem';
    toast.style.lineHeight = '1.35';
    toast.style.textAlign = 'center';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.gap = '8px';
    toast.style.boxSizing = 'border-box';
    toast.style.wordBreak = 'break-word';

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(window.__yhToastTimer);
    window.__yhToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}
function updateUserProfile(newName, newAvatarData) {
    const safeName = String(newName || '').trim();

    if (safeName) {
        const initial = safeName.charAt(0).toUpperCase();
        const elsName = [
            document.getElementById('top-nav-name'),
            document.getElementById('right-sidebar-name'),
            document.getElementById('stage-user-name')
        ];

        elsName.forEach(el => {
            if (el) {
                el.innerText = safeName;
                el.setAttribute('title', safeName);
            }
        });

        const elsInit = [
            document.getElementById('top-nav-initial'),
            document.getElementById('right-sidebar-initial'),
            document.getElementById('stage-user-initial')
        ];

        elsInit.forEach(el => {
            if (el && !newAvatarData) {
                el.innerText = initial;
                el.style.backgroundImage = 'none';
            }
        });
    }

    if (newAvatarData) {
        const elsAvatar = [
            document.getElementById('top-nav-initial'),
            document.getElementById('right-sidebar-initial'),
            document.getElementById('stage-user-initial'),
            document.getElementById('academy-feed-composer-avatar')
        ];

        elsAvatar.forEach(el => {
            if (el) {
                el.innerText = '';
                el.style.backgroundImage = `url(${newAvatarData})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            }
        });
    } else if (safeName) {
        const composerAvatar = document.getElementById('academy-feed-composer-avatar');
        if (composerAvatar) {
            composerAvatar.innerText = safeName.charAt(0).toUpperCase();
            composerAvatar.style.backgroundImage = 'none';
        }
    }
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
    const defaultAcademyWelcomeHtml = document.getElementById('chat-welcome-box')?.innerHTML || '';

    // --- UPDATED NAVIGATION & ROUTING LOGIC ---
const universeFeatureContent = {
    academy: {
        kicker: 'Academy Features',
        title: 'Roadmap execution layer',
        desc: 'Build a daily plan, track your progress, and use the community plus live rooms to stay in motion.',
        chips: ['Daily roadmap', 'Community feed', 'Voice lounge']
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
refreshAcademyMembershipStatus(true).catch(() => {});
startAcademyMembershipRealtimeSync();

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
        'center-stage-view': document.getElementById('center-stage-view'),
        'announcements-view': document.getElementById('announcements-view'),
        'voice-lobby-view': document.getElementById('voice-lobby-view'),
        'video-lobby-view': document.getElementById('video-lobby-view'),
        'vault-view': document.getElementById('vault-view')
    };

    Object.values(views).forEach(view => { if (view) view.classList.add('hidden-step'); });

    if (type === 'voice-lobby' && views['voice-lobby-view']) {
        views['voice-lobby-view'].classList.remove('hidden-step');
        views['voice-lobby-view'].classList.remove('fade-in');
        void views['voice-lobby-view'].offsetWidth;
        views['voice-lobby-view'].classList.add('fade-in');
        return;
    }

    if (type === 'video' && views['video-lobby-view']) {
        views['video-lobby-view'].classList.remove('hidden-step');
        views['video-lobby-view'].classList.remove('fade-in');
        void views['video-lobby-view'].offsetWidth;
        views['video-lobby-view'].classList.add('fade-in');
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

    if (chatInputArea) chatInputArea.style.display = 'block';

    if (type === 'main-chat') {
    if(chatHeaderIcon) chatHeaderIcon.innerHTML = `💬`;
    if(chatHeaderTitle) chatHeaderTitle.innerText = "YH-community";
    if(chatHeaderTopic) chatHeaderTopic.innerText = "Welcome to The Academy Universe";
    if(chatWelcomeBox) chatWelcomeBox.style.display = "block";
    if(chatPinnedMessage) chatPinnedMessage.style.display = "flex";
    if(chatInputBox) {
        chatInputBox.placeholder = "Message 💬 YH-community.";
        chatInputBox.setAttribute('data-active-room-id', 'YH-community');
        chatInputBox.setAttribute('data-active-room-name', 'YH-community');
        chatInputBox.setAttribute('data-active-room-type', 'main-chat');
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
    if(chatHeaderTopic) chatHeaderTopic.innerText = (type === 'group') ? "Private Brainstorming Group" : "Direct Message";
    if(chatWelcomeBox) chatWelcomeBox.style.display = "none";
    if(chatPinnedMessage) chatPinnedMessage.style.display = "none";
    if(chatInputBox) {
        chatInputBox.placeholder = `Message ${name}.`;
        chatInputBox.setAttribute('data-active-room-id', roomId);
        chatInputBox.setAttribute('data-active-room-name', name);
        chatInputBox.setAttribute('data-active-room-type', type);
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

    markCustomRoomAsRead(roomId);
    socket.emit('joinRoom', currentRoomId);
}

    if (views['academy-chat']) {
        views['academy-chat'].classList.remove('fade-in');
        void views['academy-chat'].offsetWidth;
        views['academy-chat'].classList.add('fade-in');
    }
}
document.getElementById('nav-chat')?.addEventListener('click', function() {
    setAcademySidebarActive('nav-chat');
    openAcademyFeedView();
});

document.getElementById('nav-voice')?.addEventListener('click', function() {
    setAcademySidebarActive('nav-voice');
    openRoom('voice-lobby', this);
});

document.getElementById('nav-profile')?.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    openAcademyProfileView();
});

document.getElementById('nav-missions')?.addEventListener('click', async function(event) {
    event.preventDefault();
    event.stopPropagation();
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

academyMobileNavToggle?.addEventListener('click', function (event) {
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
        } else if (targetId === 'nav-voice') {
            setAcademySidebarActive('nav-voice');
            openRoom('voice-lobby', document.getElementById('nav-voice'));
        } else if (targetId === 'nav-profile') {
            openAcademyProfileView();
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
    }
});

document.querySelector('.profile-mini')?.addEventListener('click', () => {
    if (document.body?.getAttribute('data-yh-view') === 'academy') {
        openAcademyProfileView();
    }
});

    // ==========================================
    // ⚡ REAL-TIME CHAT LOGIC (SOCKET.IO)
    // ==========================================
    socket.on('chatHistory', (history) => {
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
        appendMessageToUI(msg);
        const chatScrollArea = document.getElementById('chat-messages');
        setTimeout(() => { if(chatScrollArea) chatScrollArea.scrollTop = chatScrollArea.scrollHeight; }, 100);
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

    function appendMessageToUI(msg) {
        const container = document.getElementById('dynamic-chat-history');
        if(!container) return;

        const isMe = msg.author === myName;
        const bubbleClass = isMe ? "chat-bubble mine" : "chat-bubble";
        let avatarStyle = `background: var(--neon-blue);`;
        let avatarContent = msg.initial;
        let bubbleStyle = "", authorColor = "", roleBadge = "";

        if (msg.author === "Agent") {
            avatarStyle = `background: #8b5cf6;`; avatarContent = "🤖";
            bubbleStyle = `style="background: rgba(139, 92, 246, 0.15); border-left: 3px solid #8b5cf6;"`;
            authorColor = `style="color: #c4b5fd;"`; roleBadge = `<span class="role-badge bot" style="margin-left:5px;">AI</span>`;
        } else if(msg.avatar) {
            avatarStyle = `background-image: url(${msg.avatar}); background-size: cover; background-position: center;`; avatarContent = '';
        }

        const msgHTML = `
            <div class="${bubbleClass} fade-in" data-dbid="${msg.id}" ${bubbleStyle}>
                ${isMe ? `<button class="delete-msg-btn" title="Delete Message">🗑️</button>` : ''}
                <div class="bubble-header">
                    <div class="bubble-avatar interactive-avatar" data-user="${msg.author}" data-role="Hustler" style="${avatarStyle} cursor:pointer;">${avatarContent}</div>
                    <span class="bubble-author interactive-avatar" data-user="${msg.author}" data-role="Hustler" style="cursor:pointer;"><span ${authorColor}>${msg.author}</span> ${roleBadge}</span>
                    <span class="bubble-time">${msg.time}</span>
                </div>
                <div class="bubble-body">${msg.text}</div>
                ${currentRoom === "YH-community" ? `<div class="chat-actions"><button class="upvote-btn" data-id="${msg.id}" title="Agree with this">🔥 <span class="upvote-count">${msg.upvotes || 0}</span></button></div>` : ''}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
    }

    function sendMessage(customText = null) {
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

    const chatInputArea = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn'); 
    if (chatInputArea) {
        chatInputArea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInputArea.value.trim() !== "") sendMessage(); }
        });
    }
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', function(e) {
            e.preventDefault(); if (chatInputArea.value.trim() !== "") sendMessage();
        });
    }

    // --- LEAVE / END CALL LOGIC ---
    const btnLeaveStage = document.getElementById('btn-leave-stage');
    const endCallModal = document.getElementById('end-call-modal');
    const btnConfirmEndCall = document.getElementById('btn-confirm-end-call');
    const btnCancelEndCall = document.getElementById('btn-cancel-end-call');

    if(btnLeaveStage) {
        btnLeaveStage.addEventListener('click', () => {
            const hostName = document.getElementById('host-name')?.innerText;
            if (myName === hostName && endCallModal) {
                endCallModal.classList.remove('hidden-step'); 
            } else {
                document.getElementById('nav-voice')?.click(); 
                showToast("You left the stage.", "success");
            }
        });
    }

    if (btnConfirmEndCall && btnCancelEndCall) {
        btnCancelEndCall.addEventListener('click', () => endCallModal.classList.add('hidden-step'));
        btnConfirmEndCall.addEventListener('click', () => {
            endCallModal.classList.add('hidden-step');
            showToast("Session Ended. All users disconnected.", "error");
            document.getElementById('nav-voice')?.click();
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

    function sendStageChat() {
        if(stageChatInput.value.trim() !== '') {
            const msg = stageChatInput.value.trim();
            const myName = localStorage.getItem('yh_user_name') || "Hustler";
            const msgHTML = `<div class="stage-chat-msg fade-in"><strong>${myName}:</strong> ${msg}</div>`;
            stageChatHistory.insertAdjacentHTML('beforeend', msgHTML);
            stageChatInput.value = '';
            stageChatHistory.scrollTop = stageChatHistory.scrollHeight;
        }
    }
    if(stageChatInput && stageChatHistory) { stageChatInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') sendStageChat(); }); }
    if(stageChatSendBtn) { stageChatSendBtn.addEventListener('click', sendStageChat); }

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
    function saveVaultItemObj(itemObj) {
        const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || [];
        vaultItems.push(itemObj);
        localStorage.setItem('yh_vault_items', JSON.stringify(vaultItems));
        loadVault();
    }

    function saveFileToVault(file, origin) {
        const isImage = file.type.startsWith('image/');
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (event) => { saveVaultItemObj({ type: 'file', name: file.name, size: fileSize, origin: origin, dataUrl: event.target.result, parentFolder: currentVaultFolder }); };
            reader.readAsDataURL(file);
        } else {
            saveVaultItemObj({ type: 'file', name: file.name, size: fileSize, origin: origin, dataUrl: null, parentFolder: currentVaultFolder });
        }
    }

    function loadVault() {
        const grid = document.getElementById('vault-dynamic-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || [];
        const visibleItems = vaultItems.filter(item => (item.parentFolder || null) === currentVaultFolder);
        
        if (currentVaultFolder) {
            grid.innerHTML = `<div class="vault-folder-header" id="btn-vault-back"><span>⬅ Back to All Files</span><span style="color: #fff;">📂 ${currentVaultFolder}</span></div>`;
            document.getElementById('btn-vault-back').addEventListener('click', () => { currentVaultFolder = null; loadVault(); });
        }
        if (visibleItems.length === 0) { grid.insertAdjacentHTML('beforeend', `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">This location is empty. Upload a file or create a folder.</div>`); return; }
        
        visibleItems.sort((a, b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1));
        visibleItems.forEach((item) => {
            const realIndex = vaultItems.findIndex(v => v === item);
            const isFolder = item.type === 'folder';
            const isImage = item.type === 'file' && item.dataUrl && item.dataUrl.startsWith('data:image/');
            let visualContent = isFolder ? `<div class="vault-icon">📁</div>` : isImage ? `<div style="width: 100%; height: 90px; border-radius: 8px; background-image: url('${item.dataUrl}'); background-size: cover; background-position: center; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);"></div>` : `<div class="vault-icon">📄</div>`;
            const actionText = isFolder ? 'Open Folder' : 'Share to Chat';
            grid.insertAdjacentHTML('beforeend', `<div class="vault-card fade-in ${isFolder ? 'vault-folder' : ''}" data-real-index="${realIndex}" data-name="${item.name}" data-type="${item.type}">${visualContent}<div class="vault-filename" title="${item.name}">${item.name}</div><div class="vault-meta">${isFolder ? 'Folder' : (item.size || 'Unknown')}</div><div class="vault-origin">From: ${item.origin || 'Direct Upload'}</div><button class="btn-vault-action action-vault-btn">${actionText}</button></div>`);
        });

        document.querySelectorAll('.action-vault-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.vault-card'); const itemName = card.getAttribute('data-name'); const itemType = card.getAttribute('data-type');
                if(itemType === 'folder') { currentVaultFolder = itemName; showToast(`Opening folder: ${itemName}`, "success"); loadVault(); } 
                else {
                    const fullItem = vaultItems.find(i => i.name === itemName && i.type === 'file');
                    const isImage = fullItem && fullItem.dataUrl && fullItem.dataUrl.startsWith('data:image/');
                    let visualChatContent = isImage ? `<img src="${fullItem.dataUrl}" style="width: 100%; border-radius: 6px; margin-bottom: 8px;">` : `<div style="font-size: 2rem;">📄</div>`;
                    
                    const shareModal = document.getElementById('share-select-modal');
                    const destList = document.getElementById('share-destinations-list');
                    if (shareModal && destList) {
    const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});

    window.pendingShareHTML = `<div class="chat-attachment" style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-top: 5px;">${visualChatContent}<div><strong>${itemName}</strong><br><a href="${fullItem.dataUrl}" download="${itemName}" style="color: var(--neon-blue);">⬇ Download</a></div></div>`;
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
                }
            });
        });

        const contextMenu = document.getElementById('vault-context-menu');
        document.querySelectorAll('.vault-card').forEach(card => {
            const showContext = (pageX, pageY) => { selectedVaultIndex = card.getAttribute('data-real-index'); contextMenu.style.left = `${pageX}px`; contextMenu.style.top = `${pageY}px`; contextMenu.classList.remove('hidden-step'); };
            card.addEventListener('contextmenu', (e) => { e.preventDefault(); showContext(e.pageX, e.pageY); });
        });
    }
        const shareSelectModal = document.getElementById('share-select-modal');
    const closeShareSelect = document.getElementById('close-share-select');
    
    if (closeShareSelect && shareSelectModal) {
        closeShareSelect.addEventListener('click', () => shareSelectModal.classList.add('hidden-step'));
        shareSelectModal.addEventListener('click', (e) => { if(e.target === shareSelectModal) shareSelectModal.classList.add('hidden-step'); });
    }

    // --- GLOBAL CLICK HANDLER PARA SA UPVOTE AT DELETE ---
    document.body.addEventListener('click', (e) => { 
        const ctxMenu = document.getElementById('vault-context-menu'); 
        if (ctxMenu && !ctxMenu.classList.contains('hidden-step')) ctxMenu.classList.add('hidden-step'); 
        
        if (e.target.classList.contains('share-dest-btn')) {
    const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});
    const shareBtn = e.target.closest('.share-dest-btn') || e.target;
    const targetRoomName = shareBtn.getAttribute('data-target') || 'main-chat';
    const targetRoomId = shareBtn.getAttribute('data-room-id') || '';
    const targetRoomType = shareBtn.getAttribute('data-room-type') || (targetRoomName === 'main-chat' ? 'main-chat' : 'dm');
    const targetRoomPrivacy = shareBtn.getAttribute('data-room-privacy') || (targetRoomType === 'main-chat' ? 'public' : 'private');

    if (targetRoomName === 'main-chat' || targetRoomType === 'main-chat') {
        document.getElementById('nav-chat')?.click();
    } else {
        const roomNodes = Array.from(
            document.querySelectorAll('.dm-room, .room-entry, [data-room-id], [data-custom-room-name], [data-name]')
        );

        const matchedNode = roomNodes.find((node) => {
            const nodeRoomId = node.getAttribute('data-room-id');
            const nodeRoomName = node.getAttribute('data-name') || node.getAttribute('data-custom-room-name');
            return (targetRoomId && nodeRoomId && String(nodeRoomId) === String(targetRoomId)) ||
                (nodeRoomName && String(nodeRoomName).trim().toLowerCase() === String(targetRoomName).trim().toLowerCase());
        });

        if (matchedNode) {
            matchedNode.click();
        } else {
            const virtualNode = document.createElement('div');
            virtualNode.setAttribute('data-room-id', targetRoomId);
            virtualNode.setAttribute('data-name', targetRoomName);
            virtualNode.setAttribute('data-room-type', targetRoomType);
            virtualNode.setAttribute('data-room-privacy', targetRoomPrivacy);
            virtualNode.setAttribute('data-icon', targetRoomType === 'group' ? '👥' : '💬');
            virtualNode.setAttribute('data-color', 'var(--neon-blue)');

            openRoom(targetRoomType === 'group' ? 'group' : 'dm', virtualNode);
        }

        state.pendingSharedDestination = {
            id: targetRoomId || null,
            name: targetRoomName,
            type: targetRoomType,
            privacy: targetRoomPrivacy,
            at: Date.now()
        };
    }

    document.getElementById('share-select-modal')?.classList.add('hidden-step');
    const chatInput = document.getElementById('chat-input');

    if (chatInput && window.pendingShareHTML) {
        const isLinkOnly = window.pendingShareHTML.includes('Click here to join');
        chatInput.value = isLinkOnly
            ? window.pendingShareHTML
            : `Shared a file from Vault:<br>${window.pendingShareHTML}`;

        setTimeout(() => {
            sendMessage();
            showToast(`Shared to ${targetRoomName}!`, "success");
            window.pendingShareHTML = null;
        }, 100);
    }
}

        // UPVOTE CHAT CLICK
        const upvoteBtn = e.target.closest('.upvote-btn');
        if (upvoteBtn) {
            const authorName = upvoteBtn.closest('.chat-bubble').querySelector('.bubble-avatar').getAttribute('data-user');
            if (authorName === myName) { showToast("You cannot agree with your own message!", "error"); return; }
            if (upvoteBtn.classList.contains('liked')) { showToast("You already agreed to this message.", "error"); return; }
            
            const msgId = upvoteBtn.getAttribute('data-id');
            socket.emit('upvoteMessage', msgId); 
            upvoteBtn.classList.add('liked');

            let allStats = JSON.parse(localStorage.getItem('yh_user_stats')) || {};
            if (allStats[authorName]) { allStats[authorName].rep += 5; localStorage.setItem('yh_user_stats', JSON.stringify(allStats)); }
            showToast(`You agreed with ${authorName}. They gained +5 REP!`, "success"); renderLeaderboard(); 
        }

        // DELETE CHAT CLICK
        const deleteMsgBtn = e.target.closest('.delete-msg-btn');
        if (deleteMsgBtn) {
            const bubble = deleteMsgBtn.closest('.chat-bubble');
            const msgId = bubble.getAttribute('data-dbid');
            if(msgId) socket.emit('deleteMessage', msgId); 
            else bubble.remove();
        }
        
        // PROFILE CLICK
        const interactiveEl = e.target.closest('.interactive-avatar');
        if(interactiveEl && !e.target.closest('.upvote-btn') && !e.target.closest('.delete-msg-btn')) {
            const userName = interactiveEl.getAttribute('data-user'); const userRole = interactiveEl.getAttribute('data-role');
            const avatarDiv = interactiveEl.querySelector('.member-avatar') || interactiveEl.querySelector('.bubble-avatar') || interactiveEl;
            let avatarContent = "Y"; let avatarBg = "var(--neon-blue)";
            if(avatarDiv) { avatarContent = (avatarDiv.style.backgroundImage !== 'none' && avatarDiv.style.backgroundImage !== '') ? avatarDiv.style.backgroundImage : avatarDiv.innerText.trim().charAt(0).toUpperCase(); avatarBg = avatarDiv.style.backgroundColor || avatarBg; }
            openMiniProfile(userName, userRole, avatarContent, avatarBg);
        }
    });

    const btnChatUploadArea = document.getElementById('btn-chat-upload');
    const chatFileInputArea = document.getElementById('chat-file-input');
    const attachModalArea = document.getElementById('attachment-preview-modal');
    const attachPreviewArea = document.getElementById('attach-modal-preview');
    const attachCaptionArea = document.getElementById('attach-caption-input');
    const attachTitleArea = document.getElementById('attach-modal-title');
    const btnSendAttachArea = document.getElementById('btn-send-attach'); 
    const btnCancelAttachArea = document.getElementById('btn-cancel-attach');
    let pendingAttachmentObj = null; 

    if(btnChatUploadArea && chatFileInputArea && attachModalArea) {
        btnChatUploadArea.onclick = () => chatFileInputArea.click();
        chatFileInputArea.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const isImage = file.type.startsWith('image/');
            const fileSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
            
            attachTitleArea.innerText = isImage ? "Send an image" : "Send a file";
            attachCaptionArea.value = '';
            attachPreviewArea.innerHTML = '<span style="color: var(--text-muted);">Loading preview...</span>';
            attachModalArea.classList.remove('hidden-step');
            
            const reader = new FileReader();
            reader.onload = (event) => {
                pendingAttachmentObj = { file: file, dataUrl: event.target.result, isImage: isImage, fileSize: fileSize, name: file.name };
                attachPreviewArea.innerHTML = isImage ? `<img src="${event.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">` : `<div style="font-size: 3rem;">📄</div><span style="color: #fff; font-weight: bold;">${file.name}</span>`;
            };
            reader.readAsDataURL(file);
            chatFileInputArea.value = ''; 
        };

        const closeAttachFunc = () => { attachModalArea.classList.add('hidden-step'); pendingAttachmentObj = null; };
        if(btnCancelAttachArea) btnCancelAttachArea.onclick = closeAttachFunc;
        document.getElementById('close-attach-modal').onclick = closeAttachFunc;

        if(btnSendAttachArea) {
            btnSendAttachArea.onclick = () => {
                if(!pendingAttachmentObj) return;
                const activeChat = document.getElementById('chat-header-title').innerText;
                saveFileToVault(pendingAttachmentObj.file, activeChat);
                
                let visualContent = pendingAttachmentObj.isImage ? `<img src="${pendingAttachmentObj.dataUrl}" style="width: 100%; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.1);">` : `<div class="chat-attachment-icon" style="font-size: 2rem; margin-right: 15px;">📄</div>`;
                const attachmentHTML = `<div class="chat-attachment" style="display: flex; flex-direction: ${pendingAttachmentObj.isImage ? 'column' : 'row'}; align-items: ${pendingAttachmentObj.isImage ? 'stretch' : 'center'}; background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; margin-top: 5px; border: 1px solid rgba(255,255,255,0.05); width: 100%; min-width: 250px;">${visualContent}<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; padding-right: 10px;"><span style="font-size: 0.85rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pendingAttachmentObj.name}</span><span style="font-size: 0.7rem; color: var(--text-muted);">${pendingAttachmentObj.fileSize}</span></div><a href="${pendingAttachmentObj.dataUrl}" download="${pendingAttachmentObj.name}" style="background: var(--neon-blue); color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; text-decoration: none; font-weight: bold; white-space: nowrap; box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);">⬇ Download</a></div></div>`;
                
                const captionTextArea = attachCaptionArea.value.trim();
                sendMessage(captionTextArea ? `${captionTextArea}<br>${attachmentHTML}` : attachmentHTML);
                showToast("File uploaded to chat!", "success");
                closeAttachFunc(); 
            };
        }
    }

    // --- LOUNGES (VOICE & VIDEO) ---
    function loadVoiceLounges() {
        const grid = document.getElementById('lounge-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const lounges = JSON.parse(localStorage.getItem('yh_voice_lounges')) || [];
        if (lounges.length === 0) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No active Voice Lounges yet. Be the first to start one!</div>`; return; }

        lounges.forEach((lounge) => {
            const card = document.createElement('div'); card.className = "lounge-card fade-in room-entry";
            let avatarStyle = lounge.hostAvatar ? `background-image: url(${lounge.hostAvatar}); background-size: cover; background-position: center;` : `background: var(--neon-blue);`;
            card.innerHTML = `<div class="lounge-card-header"><span class="live-badge"><div class="pulse-dot"></div> LIVE</span><span class="listener-count">👤 ${lounge.listenerCount} Listening</span></div><h4 class="lounge-topic">${lounge.topic}</h4><p class="lounge-host">Hosted by <strong>${lounge.host}</strong></p><div class="lounge-avatars"><div class="member-avatar interactive-avatar" style="${avatarStyle} border-radius: 50%; z-index: 3;">${lounge.hostAvatar ? '' : lounge.hostInitial}</div><div class="avatar-more" style="border-radius: 50%;">+${Math.max(0, lounge.listenerCount - 1)}</div></div>`;
            card.addEventListener('click', (e) => {
                if(e.target.closest('.interactive-avatar')) return; 
                const voiceLobbyView = document.getElementById('voice-lobby-view'); const centerStageView = document.getElementById('center-stage-view');
                if(voiceLobbyView) voiceLobbyView.classList.add('hidden-step');
                if(centerStageView) {
                    centerStageView.classList.remove('hidden-step');
                    document.getElementById('stage-title').innerText = lounge.topic; document.getElementById('stage-icon').innerText = "🎙️";
                    document.getElementById('host-name').innerText = lounge.host;
                    const hostAvatarEl = document.getElementById('host-avatar');
                    if(lounge.hostAvatar) { hostAvatarEl.innerText = ''; hostAvatarEl.style.backgroundImage = `url(${lounge.hostAvatar})`; } else { hostAvatarEl.innerText = lounge.hostInitial; hostAvatarEl.style.backgroundImage = 'none'; }
                    centerStageView.classList.remove('fade-in'); void centerStageView.offsetWidth; centerStageView.classList.add('fade-in');
                }
            });
            grid.appendChild(card);
        });
    }

    function loadVideoLounges() {
        const grid = document.getElementById('video-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const lounges = JSON.parse(localStorage.getItem('yh_video_lounges')) || [];
        if (lounges.length === 0) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No active Video Rooms yet. Start a video call!</div>`; return; }

        lounges.forEach((lounge) => {
            const card = document.createElement('div'); card.className = "lounge-card fade-in room-entry";
            let avatarStyle = lounge.hostAvatar ? `background-image: url(${lounge.hostAvatar}); background-size: cover; background-position: center;` : `background: var(--neon-blue);`;
            card.innerHTML = `<div class="lounge-card-header"><span class="live-badge"><div class="pulse-dot"></div> LIVE</span><span class="listener-count">👀 ${lounge.listenerCount} Watching</span></div><h4 class="lounge-topic">${lounge.topic}</h4><p class="lounge-host">Hosted by <strong>${lounge.host}</strong></p><div class="lounge-avatars"><div class="member-avatar interactive-avatar" style="${avatarStyle} border-radius: 50%; z-index: 3;">${lounge.hostAvatar ? '' : lounge.hostInitial}</div><div class="avatar-more" style="border-radius: 50%;">+${Math.max(0, lounge.listenerCount - 1)}</div></div>`;
            card.addEventListener('click', (e) => {
                if(e.target.closest('.interactive-avatar')) return; 
                const videoLobbyView = document.getElementById('video-lobby-view'); const centerStageView = document.getElementById('center-stage-view');
                if(videoLobbyView) videoLobbyView.classList.add('hidden-step');
                if(centerStageView) {
                    centerStageView.classList.remove('hidden-step');
                    document.getElementById('stage-title').innerText = lounge.topic; document.getElementById('stage-icon').innerText = "📹";
                    document.getElementById('host-name').innerText = lounge.host;
                    const hostAvatarEl = document.getElementById('host-avatar');
                    if(lounge.hostAvatar) { hostAvatarEl.innerText = ''; hostAvatarEl.style.backgroundImage = `url(${lounge.hostAvatar})`; } else { hostAvatarEl.innerText = lounge.hostInitial; hostAvatarEl.style.backgroundImage = 'none'; }
                    centerStageView.classList.remove('fade-in'); void centerStageView.offsetWidth; centerStageView.classList.add('fade-in');
                }
            });
            grid.appendChild(card);
        });
    }

    window.loungeCreationType = 'voice';
    document.getElementById('btn-start-lounge')?.addEventListener('click', () => {
        window.loungeCreationType = 'voice';
        const h3 = document.querySelector('#lounge-modal h3'); if(h3) h3.innerText = '🎙️ Start Voice Lounge';
    });
    document.getElementById('btn-start-video')?.addEventListener('click', () => {
        window.loungeCreationType = 'video';
        const h3 = document.querySelector('#lounge-modal h3'); if(h3) h3.innerText = '📹 Start Video Lounge';
        document.getElementById('lounge-modal').classList.remove('hidden-step');
    });

    const btnCreateLounge = document.getElementById('btn-create-lounge');
    const loungeTopicInput = document.getElementById('lounge-topic-input');
    if(btnCreateLounge && loungeTopicInput) {
        loungeTopicInput.addEventListener('input', () => {
            if(loungeTopicInput.value.trim().length > 0) { btnCreateLounge.innerText = "Start Room Now"; btnCreateLounge.disabled = false; btnCreateLounge.style.opacity = '1'; } 
            else { btnCreateLounge.innerText = "Enter Topic to Start"; btnCreateLounge.disabled = true; btnCreateLounge.style.opacity = '0.5'; }
        });
        btnCreateLounge.addEventListener('click', () => {
            const topic = loungeTopicInput.value.trim(); if(!topic) return;
            
            if (window.loungeCreationType === 'video') {
                const videos = JSON.parse(localStorage.getItem('yh_video_lounges')) || [];
                                videos.unshift({ topic, host: myName, hostInitial: myName.charAt(0).toUpperCase(), hostAvatar: localStorage.getItem('yh_user_avatar') || "", listenerCount: 1 });
                localStorage.setItem('yh_video_lounges', JSON.stringify(videos));
                loadVideoLounges();
                document.getElementById('video-grid')?.firstElementChild?.click();
            } else {
                const lounges = JSON.parse(localStorage.getItem('yh_voice_lounges')) || [];
                lounges.unshift({ topic, host: myName, hostInitial: myName.charAt(0).toUpperCase(), hostAvatar: localStorage.getItem('yh_user_avatar') || "", listenerCount: 1 });
                localStorage.setItem('yh_voice_lounges', JSON.stringify(lounges));
                loadVoiceLounges(); 
                document.getElementById('lounge-grid')?.firstElementChild?.click();
            }
            
            showToast(`${window.loungeCreationType === 'video' ? 'Video' : 'Voice'} Lounge '${topic}' is now LIVE!`, "success");
            document.getElementById('lounge-modal').classList.add('hidden-step');
            loungeTopicInput.value = ""; btnCreateLounge.innerText = "Enter Topic to Start"; btnCreateLounge.disabled = true; btnCreateLounge.style.opacity = '0.5';
        });
    }

        // --- CUSTOM ROOMS ---
    function getCustomRoomContainers() {
    const selectors = [
        '#custom-dm-list',
        '[data-private-group-list="true"]',
        '.private-group-list'
    ];

    const containers = selectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean);

    return containers.filter((container, index, arr) => arr.indexOf(container) === index);
}
    function renderCustomRooms(rooms = []) {
    const state = getDashboardState();
    const containers = getCustomRoomContainers();

    const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
        .map((room, index) => normalizeCustomRoomForRender(room, index));

    state.customRooms = normalizedRooms;

    const groupRooms = normalizedRooms.filter((room) => {
        return String(room?.type || '').trim().toLowerCase() === 'group';
    });

    if (!containers.length) return groupRooms;

    const activeRoomId = normalizeRoomKey(
        state.activeCustomRoom?.id ||
        currentRoomMeta?.roomId ||
        currentRoomId ||
        ''
    );

    const activeRoomName = String(
        state.activeCustomRoom?.name ||
        currentRoom ||
        ''
    ).trim().toLowerCase();

    const html = groupRooms.length
        ? groupRooms.map((room) => {
            const iconIsImage = typeof room.icon === 'string' && room.icon.includes('url(');
            const avatarStyle = iconIsImage
                ? `background-image: ${room.icon}; background-size: cover; background-position: center; background-color: transparent;`
                : `background: ${room.color};`;
            const avatarText = iconIsImage ? '' : room.icon;
            const roomId = normalizeRoomKey(room.id);
            const hasPreview = Boolean(String(room.lastMessage || '').trim());
            const previewPrefix = hasPreview
                ? `${room.lastMessageAuthor ? (room.lastMessageAuthor === myName ? 'You: ' : `${room.lastMessageAuthor}: `) : ''}`
                : '';
            const secondaryText = hasPreview
                ? `${previewPrefix}${room.lastMessage}`
                : `${room.memberCount || 0} members`;
            const isActive = activeRoomId
                ? activeRoomId === roomId
                : (activeRoomName && activeRoomName === String(room.name).trim().toLowerCase());
            const unreadText = room.unreadCount > 99 ? '99+' : String(room.unreadCount);

            return `
                <button
                    type="button"
                    class="channel-link dm-room custom-room-item private-group-item${isActive ? ' active' : ''}"
                    data-room-id="${escapeCustomRoomHTML(room.id)}"
                    data-name="${escapeCustomRoomHTML(room.name)}"
                    data-icon="${escapeCustomRoomHTML(room.icon)}"
                    data-color="${escapeCustomRoomHTML(room.color)}"
                    data-room-type="${escapeCustomRoomHTML(room.type)}"
                    data-room-privacy="${escapeCustomRoomHTML(room.privacy)}"
                    data-room-topic="${escapeCustomRoomHTML(room.topic)}"
                    style="display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;"
                >
                    <span style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                        <span class="member-avatar" style="${avatarStyle} width: 28px; height: 28px; font-size: 0.85rem; flex-shrink:0;">${avatarText}</span>
                        <span style="display:flex; flex-direction:column; min-width:0; text-align:left; flex:1;">
                            <span style="font-size:0.92rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeCustomRoomHTML(room.name)}</span>
                            <span
                                data-room-preview-id="${escapeCustomRoomHTML(room.id)}"
                                style="font-size:0.72rem; opacity:${hasPreview ? '0.9' : '0.7'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                            >${escapeCustomRoomHTML(secondaryText)}</span>
                        </span>
                    </span>
                    <span
                        class="custom-room-unread${room.unreadCount > 0 ? '' : ' hidden-step'}"
                        data-room-unread-id="${escapeCustomRoomHTML(room.id)}"
                        style="min-width:22px; height:22px; padding:0 6px; border-radius:999px; display:${room.unreadCount > 0 ? 'inline-flex' : 'none'}; align-items:center; justify-content:center; background:rgba(14,165,233,0.18); color:var(--neon-blue); font-size:0.72rem; font-weight:700;"
                    >${unreadText}</span>
                </button>
            `;
        }).join('')
        : `
            <div class="custom-room-empty-state" style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-muted);">
                No private groups yet. Create a group to see it here.
            </div>
        `;

    containers.forEach((container) => {
        container.innerHTML = html;
        container.dataset.hasRenderedRooms = 'true';
        container.dataset.roomCount = String(groupRooms.length);

        container.querySelectorAll('.custom-room-item').forEach((button) => {
            button.addEventListener('click', () => {
                const roomId = button.getAttribute('data-room-id');

                document.querySelectorAll('.custom-room-item').forEach((node) => {
                    const sameId = roomId && node.getAttribute('data-room-id') === roomId;
                    node.classList.toggle('active', Boolean(sameId));
                });

                openRoom('group', button);
            });
        });
    });

    return groupRooms;
}

    function escapeCustomRoomHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeCustomRoomForRender(room = {}, index = 0) {
    const roomType = String(
        room.type ??
        room.roomType ??
        room.room_type ??
        'dm'
    ).trim().toLowerCase();

    const resolvedId = normalizeRoomKey(
        room.id ??
        room._id ??
        room.roomId ??
        room.room_id ??
        `custom-room-${index + 1}`
    );

    const avatarSource =
        room.avatar ??
        room.image ??
        room.coverImage ??
        room.cover_image ??
        '';

    const iconValue =
        room.icon ??
        room.emoji ??
        (avatarSource ? `url(${avatarSource})` : '') ??
        (roomType === 'group' ? '👥' : '💬');

    const privacy =
        room.privacy ??
        room.visibility ??
        (room.isPrivate ? 'private' : null) ??
        ((roomType === 'group' || roomType === 'dm') ? 'private' : 'public');

    const unreadCount = Number(
        room.unreadCount ??
        room.unread_count ??
        room.notifications ??
        0
    );

    const memberCount = Number(
        room.memberCount ??
        room.membersCount ??
        room.member_count ??
        (Array.isArray(room.members) ? room.members.length : 0) ??
        0
    );

    const rawLastMessage =
        room.lastMessage ??
        room.last_message ??
        room.preview ??
        room.snippet ??
        room.lastText ??
        room.message ??
        '';

    const lastMessage = String(rawLastMessage ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const lastMessageAuthor = String(
        room.lastMessageAuthor ??
        room.last_message_author ??
        room.previewAuthor ??
        room.preview_author ??
        room.author ??
        ''
    ).trim();

    const lastMessageAt =
        room.lastMessageAt ??
        room.last_message_at ??
        room.updatedAt ??
        room.updated_at ??
        room.time ??
        room.createdAt ??
        room.created_at ??
        '';

    const recipientName = String(
        room.recipientName ??
        room.recipient_name ??
        (roomType === 'dm' ? (room.name ?? room.title ?? '') : '') ??
        ''
    ).trim();

    const recipientId = String(
        room.recipientId ??
        room.recipient_id ??
        (recipientName ? normalizeUserKey(recipientName) : '') ??
        ''
    ).trim();

    const memberNames = Array.from(new Set(
        safeParseArray(
            room.memberNames ??
            room.member_names ??
            room.participants ??
            room.participantNames ??
            room.members ??
            room.memberList ??
            [],
            roomType === 'dm'
                ? [myName, recipientName || (room.name ?? room.title ?? '')]
                : [myName]
        )
    )).filter(Boolean);

    const memberIds = Array.from(new Set(
        safeParseArray(
            room.memberIds ??
            room.member_ids ??
            [],
            recipientId ? [normalizeUserKey(myName), recipientId] : []
        ).map((value) => normalizeUserKey(value)).filter(Boolean)
    ));

    return {
        id: resolvedId,
        roomId: resolvedId,
        name:
            room.name ??
            room.title ??
            room.roomName ??
            room.room_name ??
            `Room ${index + 1}`,
        icon: iconValue,
        color:
            room.color ??
            room.themeColor ??
            room.theme_color ??
            'var(--neon-blue)',
        type: roomType,
        privacy,
        isPrivate: typeof room.isPrivate === 'boolean'
            ? room.isPrivate
            : privacy === 'private',
        description:
            room.description ??
            room.bio ??
            room.summary ??
            '',
        unreadCount: Number.isFinite(unreadCount) ? unreadCount : 0,
        memberCount: Number.isFinite(memberCount) ? memberCount : 0,
        topic:
            room.topic ??
            room.roomTopic ??
            (roomType === 'group'
                ? 'Private Brainstorming Group'
                : 'Direct Message'),
        lastMessage,
        lastMessageAuthor,
        lastMessageAt: lastMessageAt || '',
        recipientName,
        recipientId,
        memberNames,
        participants: memberNames,
        memberIds
    };
}


    function renderChatboxRooms(rooms = []) {
    const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
        .map((room, index) => normalizeCustomRoomForRender(room, index));

    const dmRooms = normalizedRooms.filter((room) => {
        return String(room?.type || '').trim().toLowerCase() === 'dm';
    });

    const selectors = [
        '#chatbox-room-list',
        '#chatbox-rooms-list',
        '[data-chatbox-rooms-list="dm"]',
        '.chatbox-rooms-list'
    ];

    const containers = selectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .filter((container, index, arr) => arr.indexOf(container) === index);

    if (!containers.length) return dmRooms;

    const activeRoomId = getActiveRoomId();

    const formatRoomTime = (value) => {
        if (!value) return '';

        const stringValue = String(value).trim();
        if (!stringValue) return '';

        const isoDate = new Date(stringValue);
        if (!Number.isNaN(isoDate.getTime())) {
            return isoDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        const todayAtMatch = stringValue.match(/today at\s+(.+)$/i);
        if (todayAtMatch?.[1]) {
            return todayAtMatch[1].trim();
        }

        return stringValue;
    };

    const getPreviewText = (room) => {
        const message = String(room.lastMessage || '').trim();

        if (message) {
            const author = String(room.lastMessageAuthor || '').trim();
            const prefix = author
                ? (author === myName ? 'You: ' : `${author}: `)
                : '';

            return `${prefix}${message}`;
        }

        return 'Direct Message';
    };

    const html = dmRooms.length
        ? dmRooms.map((room) => {
            const roomId = normalizeRoomKey(room.id || room.roomId || room.room_id);
            const isActive = Boolean(activeRoomId && roomId && activeRoomId === roomId);
            const unreadCount = Math.max(0, Number(room.unreadCount || 0));
            const unreadText = unreadCount > 99 ? '99+' : String(unreadCount);
            const previewText = getPreviewText(room);
            const timeText = formatRoomTime(room.lastMessageAt);

            const iconIsImage =
                typeof room.icon === 'string' &&
                room.icon.includes('url(');

            const avatarStyle = iconIsImage
                ? `background-image: ${room.icon}; background-size: cover; background-position: center; background-color: transparent;`
                : `background: ${room.color};`;

            const avatarText = iconIsImage ? '' : room.icon;

            return `
                <button
                    type="button"
                    class="channel-link dm-room chatbox-room-item${isActive ? ' active' : ''}"
                    data-id="${escapeCustomRoomHTML(room.id)}"
                    data-room-id="${escapeCustomRoomHTML(room.id)}"
                    data-name="${escapeCustomRoomHTML(room.name)}"
                    data-icon="${escapeCustomRoomHTML(room.icon)}"
                    data-color="${escapeCustomRoomHTML(room.color)}"
                    data-room-type="${escapeCustomRoomHTML(room.type)}"
                    data-room-privacy="${escapeCustomRoomHTML(room.privacy)}"
                    data-room-topic="${escapeCustomRoomHTML(room.topic)}"
                    style="display:flex; align-items:center; gap:10px; width:100%;"
                >
                    <span
                        class="member-avatar"
                        style="${avatarStyle} width:34px; height:34px; font-size:0.95rem; flex-shrink:0;"
                    >${avatarText}</span>

                    <span style="display:flex; flex-direction:column; min-width:0; flex:1; text-align:left;">
                        <span style="display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0;">
                            <span style="font-size:0.92rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${escapeCustomRoomHTML(room.name)}
                            </span>
                            <span
                                data-room-time-id="${escapeCustomRoomHTML(room.id)}"
                                style="font-size:0.68rem; color:var(--text-muted); flex-shrink:0;"
                            >${escapeCustomRoomHTML(timeText)}</span>
                        </span>

                        <span
                            data-room-preview-id="${escapeCustomRoomHTML(room.id)}"
                            style="font-size:0.74rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                        >${escapeCustomRoomHTML(previewText)}</span>
                    </span>

                    <span
                        class="custom-room-unread${unreadCount > 0 ? '' : ' hidden-step'}"
                        data-room-unread-id="${escapeCustomRoomHTML(room.id)}"
                        style="min-width:22px; height:22px; padding:0 6px; border-radius:999px; display:${unreadCount > 0 ? 'inline-flex' : 'none'}; align-items:center; justify-content:center; background:rgba(14,165,233,0.18); color:var(--neon-blue); font-size:0.72rem; font-weight:700; flex-shrink:0;"
                    >${unreadText}</span>
                </button>
            `;
        }).join('')
        : `
            <div class="custom-room-empty-state" style="padding:10px 12px; font-size:0.85rem; color:var(--text-muted);">
                No private DMs yet. Start a DM to see it here.
            </div>
        `;

    containers.forEach((container) => {
        container.innerHTML = html;
        container.dataset.hasRenderedRooms = 'true';
        container.dataset.roomCount = String(dmRooms.length);

        container.querySelectorAll('.chatbox-room-item').forEach((button) => {
            button.addEventListener('click', () => {
                const clickedRoomId = normalizeRoomKey(
                    button.getAttribute('data-room-id') || ''
                );

                document.querySelectorAll('.chatbox-room-item').forEach((node) => {
                    const nodeRoomId = normalizeRoomKey(
                        node.getAttribute('data-room-id') || ''
                    );
                    node.classList.toggle('active', Boolean(clickedRoomId && nodeRoomId === clickedRoomId));
                });

                openRoom('dm', button);
            });
        });
    });

    return dmRooms;
}
    function syncCustomRoomNotifications(rooms = []) {
        const bellBadge = document.getElementById('notif-badge-count');
        if (!bellBadge) return;

        const totalUnread = (Array.isArray(rooms) ? rooms : []).reduce((sum, room) => {
            return sum + Number(room?.unreadCount || room?.unread_count || 0);
        }, 0);

        bellBadge.dataset.customRoomsUnread = String(totalUnread);
    }

    function updateCustomRoomUnreadBadges(rooms = []) {
        const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
            .map((room, index) => normalizeCustomRoomForRender(room, index));

        normalizedRooms.forEach((room) => {
            const badgeNodes = document.querySelectorAll(`[data-room-unread-id="${CSS.escape(String(room.id))}"]`);
            badgeNodes.forEach((badge) => {
                if (room.unreadCount > 0) {
                    badge.textContent = room.unreadCount > 99 ? '99+' : String(room.unreadCount);
                    badge.style.display = 'inline-flex';
                    badge.classList.remove('hidden-step');
                } else {
                    badge.textContent = '';
                    badge.style.display = 'none';
                    badge.classList.add('hidden-step');
                }
            });
        });
    }

    async function loadCustomRooms(forceRefresh = false) {
    const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});
    const cacheKey = 'yh_custom_rooms_cache';
    const cacheTTL = 60 * 1000;

    const containers = typeof getCustomRoomContainers === 'function'
        ? getCustomRoomContainers()
        : [];

    const setLoadingState = (isLoading) => {
        containers.forEach((container) => {
            container.dataset.loading = isLoading ? 'true' : 'false';

            if (isLoading && !container.dataset.hasRenderedRooms) {
                container.innerHTML = `
                    <div class="custom-room-loading" style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-muted);">
                        Loading custom rooms...
                    </div>
                `;
            }
        });
    };

    const normalizeRoom = (room, index = 0) => {
        if (typeof normalizeCustomRoomForRender === 'function') {
            return normalizeCustomRoomForRender(room, index);
        }

        const roomType = String(
            room?.type ||
            room?.roomType ||
            room?.room_type ||
            'dm'
        ).trim().toLowerCase();

        return {
            id: room?.id || room?._id || room?.roomId || room?.room_id || `custom-room-${index + 1}`,
            name: room?.name || room?.title || room?.roomName || room?.room_name || `Room ${index + 1}`,
            icon: room?.icon || room?.emoji || (roomType === 'group' ? '👥' : '💬'),
            color: room?.color || room?.themeColor || room?.theme_color || 'var(--neon-blue)',
            type: roomType,
            privacy: room?.privacy || room?.visibility || (room?.isPrivate ? 'private' : 'public') || 'public',
            isPrivate: typeof room?.isPrivate === 'boolean' ? room.isPrivate : false,
            description: room?.description || '',
            unreadCount: Number(room?.unreadCount || room?.unread_count || 0),
            memberCount: Number(room?.memberCount || room?.membersCount || room?.member_count || 0),
            topic: room?.topic || (roomType === 'group' ? 'Private Brainstorming Group' : 'Direct Message')
        };
    };

    const readCache = () => {
        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (!cached || !Array.isArray(cached.rooms)) return null;

            const age = Date.now() - Number(cached.savedAt || 0);
            if (forceRefresh || age > cacheTTL) return null;

            return cached.rooms.map((room, index) => normalizeRoom(room, index));
        } catch (error) {
            console.warn('Failed to read custom rooms cache:', error);
            return null;
        }
    };

    const writeCache = (rooms) => {
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                savedAt: Date.now(),
                rooms
            }));
        } catch (error) {
            console.warn('Failed to write custom rooms cache:', error);
        }
    };

    const renderRoomsSafely = (rooms) => {
        const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
            .map((room, index) => normalizeRoom(room, index));

        state.customRooms = normalizedRooms;
        state.customRoomsLoadedAt = Date.now();

        if (typeof renderCustomRooms === 'function') {
            renderCustomRooms(normalizedRooms);
        }

        if (typeof renderChatboxRooms === 'function') {
            renderChatboxRooms(normalizedRooms);
        }

        if (typeof syncCustomRoomNotifications === 'function') {
            syncCustomRoomNotifications(normalizedRooms);
        }

        if (typeof updateCustomRoomUnreadBadges === 'function') {
            updateCustomRoomUnreadBadges(normalizedRooms);
        }

        document.dispatchEvent(new CustomEvent('yh:customRoomsLoaded', {
            detail: { rooms: normalizedRooms }
        }));

        return normalizedRooms;
    };

    const cachedRooms = readCache();
    if (Array.isArray(cachedRooms) && cachedRooms.length && !forceRefresh) {
        renderRoomsSafely(cachedRooms);
    }

    setLoadingState(true);

    try {
        const token =
            localStorage.getItem('yh_token') ||
            localStorage.getItem('token') ||
            sessionStorage.getItem('yh_token') ||
            sessionStorage.getItem('token') ||
            '';

const endpoint = '/api/realtime/rooms';

const response = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
});

if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${endpoint}`);
}

const payload = await response.json().catch(() => null);

if (!payload) {
    throw new Error('Unable to load custom rooms.');
}

const incomingRooms = (
    Array.isArray(payload?.rooms)
        ? payload.rooms
        : Array.isArray(payload)
        ? payload
        : []
).filter((room) => {
    const roomType = String(
        room?.type ||
        room?.roomType ||
        room?.room_type ||
        ''
    ).trim().toLowerCase();

    return roomType === 'dm' || roomType === 'group';
});
        const normalizedRooms = incomingRooms.map((room, index) => normalizeRoom(room, index));

        writeCache(normalizedRooms);
        renderRoomsSafely(normalizedRooms);

        return normalizedRooms;
    } catch (error) {
        console.error('loadCustomRooms failed:', error);

        const fallbackRooms = Array.isArray(state.customRooms) && state.customRooms.length
            ? state.customRooms
            : [];

        renderRoomsSafely(fallbackRooms);

        if (typeof showToast === 'function') {
            showToast('Unable to load custom rooms right now.', 'error');
        }

        return fallbackRooms;
    } finally {
        setLoadingState(false);
    }
}
function normalizeUserKey(value) {
    return String(value ?? '').trim().toLowerCase();
}

function safeParseArray(value, fallback = []) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item ?? '').trim())
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return Array.isArray(fallback) ? [...fallback] : [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => String(item ?? '').trim())
                    .filter(Boolean);
            }
        } catch (_) {}

        return trimmed
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return Array.isArray(fallback) ? [...fallback] : [];
}

function getStoredUserStats() {
    try {
        return JSON.parse(localStorage.getItem('yh_user_stats') || '{}') || {};
    } catch (_) {
        return {};
    }
}

function setStoredUserStats(stats) {
    localStorage.setItem('yh_user_stats', JSON.stringify(stats || {}));
}

function getFollowedUsers() {
    try {
        const raw = JSON.parse(localStorage.getItem('yh_followed_users') || '[]');
        return Array.isArray(raw) ? raw.map((name) => String(name || '').trim()).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function setFollowedUsers(list) {
    const deduped = [];
    (Array.isArray(list) ? list : []).forEach((name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        const exists = deduped.some((entry) => normalizeUserKey(entry) === normalizeUserKey(trimmed));
        if (!exists) deduped.push(trimmed);
    });
    localStorage.setItem('yh_followed_users', JSON.stringify(deduped));
    return deduped;
}

function persistKnownUser(user = {}) {
    const name = String(user.name || '').trim();
    if (!name) return null;

    const allStats = getStoredUserStats();
    const existing = allStats[name] || {};

    const nextEntry = {
        rep: Number(user.rep ?? existing.rep ?? 0),
        followers: Number(user.followers ?? existing.followers ?? 0),
        role: String(user.role || existing.role || 'Hustler').trim(),
        initial: String(
            user.avatarToken ||
            existing.initial ||
            name.charAt(0).toUpperCase()
        ).trim(),
        color: String(
            user.avatarBg ||
            existing.color ||
            'var(--neon-blue)'
        ).trim()
    };

    allStats[name] = nextEntry;
    setStoredUserStats(allStats);

    if (user.followed === true) {
        const followed = getFollowedUsers();
        if (!followed.some((entry) => normalizeUserKey(entry) === normalizeUserKey(name))) {
            setFollowedUsers([...followed, name]);
        }
    } else if (user.followed === false) {
        const followed = getFollowedUsers().filter((entry) => normalizeUserKey(entry) !== normalizeUserKey(name));
        setFollowedUsers(followed);
    }

    return {
        id: normalizeUserKey(name),
        userKey: normalizeUserKey(name),
        name,
        role: nextEntry.role,
        avatarToken: nextEntry.initial,
        avatarBg: nextEntry.color,
        followers: nextEntry.followers,
        rep: nextEntry.rep,
        isFollowed: getFollowedUsers().some((entry) => normalizeUserKey(entry) === normalizeUserKey(name))
    };
}

function getUserDirectoryEntry(name, fallback = {}) {
    const targetName = String(name || '').trim();
    if (!targetName) return null;

    const directory = getKnownUserDirectory();
    const found = directory.find((entry) => normalizeUserKey(entry.name) === normalizeUserKey(targetName));
    if (found) return found;

    return persistKnownUser({
        name: targetName,
        role: fallback.role || 'Hustler',
        avatarToken: fallback.avatarToken || targetName.charAt(0).toUpperCase(),
        avatarBg: fallback.avatarBg || 'var(--neon-blue)',
        followed: fallback.followed
    });
}

function getKnownUserDirectory(searchTerm = '') {
    const allStats = getStoredUserStats();
    const followed = getFollowedUsers();
    const names = new Set();

    Object.keys(allStats).forEach((name) => {
        const trimmed = String(name || '').trim();
        if (trimmed) names.add(trimmed);
    });

    followed.forEach((name) => {
        const trimmed = String(name || '').trim();
        if (trimmed) names.add(trimmed);
    });

    const targetTerm = normalizeUserKey(searchTerm);

    return Array.from(names)
        .filter((name) => normalizeUserKey(name) !== normalizeUserKey(myName))
        .map((name) => {
            const entry = allStats[name] || {};
            return {
                id: normalizeUserKey(name),
                userKey: normalizeUserKey(name),
                name,
                role: entry.role || 'Hustler',
                avatarToken: entry.initial || name.charAt(0).toUpperCase(),
                avatarBg: entry.color || 'var(--neon-blue)',
                followers: Number(entry.followers || 0),
                rep: Number(entry.rep || 0),
                isFollowed: followed.some((item) => normalizeUserKey(item) === normalizeUserKey(name))
            };
        })
        .filter((entry) => {
            if (!targetTerm) return true;
            return normalizeUserKey(entry.name).includes(targetTerm) ||
                normalizeUserKey(entry.role).includes(targetTerm);
        })
        .sort((a, b) => {
            if (Number(b.isFollowed) !== Number(a.isFollowed)) {
                return Number(b.isFollowed) - Number(a.isFollowed);
            }
            return a.name.localeCompare(b.name);
        });
}

function buildDeterministicDmRoomId(userA, userB) {
    const parts = [userA, userB]
        .map((value) => normalizeUserKey(value).replace(/[^a-z0-9]+/g, '-'))
        .filter(Boolean)
        .sort();

    return `dm::${parts.join('__')}`;
}

function buildGroupRoomId(groupName, members = []) {
    const groupSlug = normalizeUserKey(groupName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
    const memberSlug = Array.from(new Set(
        (Array.isArray(members) ? members : [])
            .map((value) => normalizeUserKey(value).replace(/[^a-z0-9]+/g, '-'))
            .filter(Boolean)
    )).join('__');

    return `group::${groupSlug}::${memberSlug || 'members'}::${Date.now()}`;
}

function ensureGroupMemberDraftContainer() {
    const groupModalBody = document.querySelector('#group-modal .modal-body');
    if (!groupModalBody) return null;

    let container = document.getElementById('group-selected-users');
    if (!container) {
        container = document.createElement('div');
        container.id = 'group-selected-users';
        container.style.marginBottom = '12px';
        groupModalBody.insertBefore(container, document.getElementById('group-name-input'));
    }

    return container;
}

function syncGroupCreateButtonState() {
    const btnCreateGroup = document.getElementById('btn-create-group');
    const groupNameInput = document.getElementById('group-name-input');
    if (!btnCreateGroup || !groupNameInput) return;

    const selectedCount = pendingGroupMembers.length;
    const totalMembers = selectedCount + 1;
    const hasName = groupNameInput.value.trim().length > 0;

    if (hasName) {
        btnCreateGroup.disabled = false;
        btnCreateGroup.style.opacity = '1';
        btnCreateGroup.innerText = selectedCount > 0
            ? `Create Brainstorming Group (${totalMembers} members)`
            : 'Create Brainstorming Group';
    } else {
        btnCreateGroup.disabled = true;
        btnCreateGroup.style.opacity = '0.5';
        btnCreateGroup.innerText = selectedCount > 0
            ? `Enter Group Name (${totalMembers} members)`
            : 'Enter Group Name to Create';
    }
}

function renderPendingGroupMembers() {
    const container = ensureGroupMemberDraftContainer();
    if (!container) return;

    if (!pendingGroupMembers.length) {
        container.innerHTML = `
            <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);font-size:0.8rem;color:var(--text-muted);">
                Search a user above communications and tap <strong>Add to Group</strong> to queue members here.
            </div>
        `;
        syncGroupCreateButtonState();
        return;
    }

    container.innerHTML = `
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">
            Selected Members (${pendingGroupMembers.length + 1} total with you)
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${pendingGroupMembers.map((user) => `
                <button
                    type="button"
                    class="group-member-chip"
                    data-remove-group-member="${escapeCustomRoomHTML(user.name)}"
                    style="display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#fff;font-size:0.78rem;cursor:pointer;"
                >
                    <span>${escapeCustomRoomHTML(user.name)}</span>
                    <span style="color:#f87171;">✖</span>
                </button>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('[data-remove-group-member]').forEach((button) => {
        button.addEventListener('click', () => {
            const targetName = button.getAttribute('data-remove-group-member') || '';
            pendingGroupMembers = pendingGroupMembers.filter((user) => {
                return normalizeUserKey(user.name) !== normalizeUserKey(targetName);
            });
            renderPendingGroupMembers();
        });
    });

    syncGroupCreateButtonState();
}

function addPendingGroupMember(user = {}) {
    const name = String(user.name || '').trim();
    if (!name || normalizeUserKey(name) === normalizeUserKey(myName)) return;

    const existing = pendingGroupMembers.some((entry) => normalizeUserKey(entry.name) === normalizeUserKey(name));
    if (existing) {
        document.getElementById('group-modal')?.classList.remove('hidden-step');
        renderPendingGroupMembers();
        return;
    }

    pendingGroupMembers.push({
        name,
        role: user.role || 'Hustler',
        avatarToken: user.avatarToken || name.charAt(0).toUpperCase(),
        avatarBg: user.avatarBg || 'var(--neon-blue)'
    });

    document.getElementById('group-modal')?.classList.remove('hidden-step');
    renderPendingGroupMembers();
}

function ensureCommunicationsSearchResultsContainer() {
    const searchWrapper = document.querySelector('.channel-search-container .search-wrapper');
    if (!searchWrapper) return null;

    searchWrapper.style.position = 'relative';

    let results = document.getElementById('communications-search-results');
    if (!results) {
        results = document.createElement('div');
        results.id = 'communications-search-results';
        results.style.position = 'absolute';
        results.style.top = 'calc(100% + 8px)';
        results.style.left = '0';
        results.style.right = '0';
        results.style.zIndex = '80';
        results.style.display = 'none';
        results.style.maxHeight = '320px';
        results.style.overflowY = 'auto';
        results.style.padding = '8px';
        results.style.borderRadius = '14px';
        results.style.background = 'rgba(11, 15, 25, 0.98)';
        results.style.border = '1px solid rgba(255,255,255,0.08)';
        results.style.boxShadow = '0 18px 40px rgba(0,0,0,0.35)';
        searchWrapper.appendChild(results);
    }

    return results;
}

function closeCommunicationsSearchResults() {
    const results = ensureCommunicationsSearchResultsContainer();
    if (!results) return;
    results.style.display = 'none';
    results.innerHTML = '';
}

function handleCommunicationsSearchAction(action, user) {
    if (!user || !user.name) return;

    if (action === 'chat') {
        createNewRoom('dm', user.name, user.avatarToken, user.avatarBg, {
            recipientName: user.name,
            recipientId: user.userKey,
            memberNames: [myName, user.name],
            memberIds: [normalizeUserKey(myName), user.userKey],
            source: 'communications-search'
        });
        closeCommunicationsSearchResults();
        showToast(`Opening private chat with ${user.name}.`, 'success');
        return;
    }

    if (action === 'group') {
        addPendingGroupMember(user);
        closeCommunicationsSearchResults();
        showToast(`${user.name} added to pending group members.`, 'success');
    }
}

function renderCommunicationsSearchResults(searchTerm = '') {
    const results = ensureCommunicationsSearchResultsContainer();
    if (!results) return;

    const input = document.querySelector('.channel-search');
    const query = String(searchTerm || '').trim();
    const directory = getKnownUserDirectory(query);

    const visibleUsers = query ? directory : directory.slice(0, 8);

    if (!visibleUsers.length) {
        results.style.display = 'block';
        results.innerHTML = `
            <div style="padding:12px 10px;font-size:0.82rem;color:var(--text-muted);">
                No known users found yet. Follow users or open their mini profile first so they appear here.
            </div>
        `;
        return;
    }

    results.style.display = 'block';
    results.innerHTML = visibleUsers.map((user) => {
        const avatarToken = String(user.avatarToken || user.name.charAt(0).toUpperCase());
        const isAvatarImage = avatarToken.includes('url(');
        const avatarStyle = isAvatarImage
            ? `background-image:${avatarToken};background-size:cover;background-position:center;background-color:transparent;`
            : `background:${user.avatarBg};`;

        return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">
                <span class="member-avatar" style="${avatarStyle} width:34px;height:34px;flex-shrink:0;">${isAvatarImage ? '' : escapeCustomRoomHTML(avatarToken.charAt(0).toUpperCase())}</span>
                <span style="display:flex;flex-direction:column;min-width:0;flex:1;">
                    <span style="font-size:0.86rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${escapeCustomRoomHTML(user.name)}
                    </span>
                    <span style="font-size:0.72rem;color:var(--text-muted);">
                        ${escapeCustomRoomHTML(user.role)}${user.isFollowed ? ' • Following' : ''}
                    </span>
                </span>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button
                        type="button"
                        data-search-action="chat"
                        data-search-user="${escapeCustomRoomHTML(user.name)}"
                        class="btn-secondary"
                        style="width:auto;padding:7px 10px;font-size:0.72rem;"
                    >Chat</button>
                    <button
                        type="button"
                        data-search-action="group"
                        data-search-user="${escapeCustomRoomHTML(user.name)}"
                        class="btn-primary"
                        style="width:auto;padding:7px 10px;font-size:0.72rem;"
                    >Add</button>
                </div>
            </div>
        `;
    }).join('');

    results.querySelectorAll('[data-search-action]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-search-action') || '';
            const targetName = button.getAttribute('data-search-user') || '';
            const user = getUserDirectoryEntry(targetName);
            handleCommunicationsSearchAction(action, user);
            if (input) input.blur();
        });
    });
}

function bindCommunicationsSearch() {
    const input = document.querySelector('.channel-search');
    if (!input || input.dataset.boundSearch === 'true') return;

    input.dataset.boundSearch = 'true';

    input.addEventListener('focus', () => {
        renderCommunicationsSearchResults(input.value);
    });

    input.addEventListener('input', () => {
        renderCommunicationsSearchResults(input.value);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            closeCommunicationsSearchResults();
        }, 180);
    });
}

function ensureDmModalDirectoryContainer() {
    const modalBody = document.querySelector('#dm-modal .modal-body');
    if (!modalBody) return null;

    let container = document.getElementById('dm-modal-user-list');
    if (!container) {
        modalBody.querySelectorAll('.modal-user-item').forEach((node) => node.remove());

        container = document.createElement('div');
        container.id = 'dm-modal-user-list';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        modalBody.appendChild(container);
    }

    return container;
}

function resetDmModalSelection() {
    const btnStartDm = document.getElementById('btn-start-dm');
    document.querySelectorAll('.dm-radio').forEach((radio) => { radio.checked = false; });
    if (btnStartDm) {
        btnStartDm.innerText = "Select a user to chat";
        btnStartDm.disabled = true;
        btnStartDm.style.opacity = '0.5';
    }
}

function renderDmModalDirectory(searchTerm = '') {
    const container = ensureDmModalDirectoryContainer();
    if (!container) return;

    const users = getKnownUserDirectory(searchTerm);
    if (!users.length) {
        container.innerHTML = `
            <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);font-size:0.82rem;color:var(--text-muted);">
                No searchable users yet. Follow users or open their mini profile first so they appear here.
            </div>
        `;
        resetDmModalSelection();
        return;
    }

    container.innerHTML = users.map((user) => {
        const avatarToken = String(user.avatarToken || user.name.charAt(0).toUpperCase());
        const isAvatarImage = avatarToken.includes('url(');
        const avatarStyle = isAvatarImage
            ? `background-image:${avatarToken};background-size:cover;background-position:center;background-color:transparent;`
            : `background:${user.avatarBg};`;

        return `
            <label
                class="modal-user-item"
                data-user-name="${escapeCustomRoomHTML(user.name)}"
                data-user-role="${escapeCustomRoomHTML(user.role)}"
                data-user-avatar="${escapeCustomRoomHTML(avatarToken)}"
                data-user-bg="${escapeCustomRoomHTML(user.avatarBg)}"
                style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:14px; cursor:pointer; background:rgba(255,255,255,0.02);"
            >
                <input type="radio" name="selected-dm-user" class="dm-radio" style="accent-color:#0ea5e9;">
                <span class="member-avatar dm-avatar-preview" style="${avatarStyle} width:40px; height:40px; flex-shrink:0;">${isAvatarImage ? '' : escapeCustomRoomHTML(avatarToken.charAt(0).toUpperCase())}</span>
                <span style="display:flex; flex-direction:column; min-width:0; flex:1;">
                    <span class="member-name dm-name-preview" style="font-weight:600;">${escapeCustomRoomHTML(user.name)}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">
                        ${escapeCustomRoomHTML(user.role)}${user.isFollowed ? ' • Following' : ''}
                    </span>
                </span>
            </label>
        `;
    }).join('');

    const btnStartDm = document.getElementById('btn-start-dm');
    container.querySelectorAll('.dm-radio').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (!btnStartDm) return;
            btnStartDm.innerText = "Start Private Chat";
            btnStartDm.disabled = false;
            btnStartDm.style.opacity = '1';
        });
    });
}
    async function createNewRoom(type, name, icon, color, options = {}) {
    const state = window.dashboardState || window.yhDashboardState || (window.dashboardState = {});
    const roomType = String(type || 'custom').trim().toLowerCase();
    const roomName = String(name || '').trim();
    const roomIcon = icon || (roomType === 'group' ? '👥' : '💬');
    const roomColor = color || 'var(--neon-blue)';
    const roomPrivacy = (roomType === 'dm' || roomType === 'group') ? 'private' : 'public';
    const config = (options && typeof options === 'object') ? options : {};

    if (!roomName) {
        showToast('Please enter a room name first.', 'error');
        return null;
    }

    const recipientName = String(
        config.recipientName ||
        config.userName ||
        (roomType === 'dm' ? roomName : '')
    ).trim();

    const recipientId = String(
        config.recipientId ||
        (recipientName ? normalizeUserKey(recipientName) : '')
    ).trim();

    const uniqueMemberNames = Array.from(new Set(
        (roomType === 'group'
            ? [myName, ...safeParseArray(config.memberNames || config.participants || [], [])]
            : [myName, recipientName || roomName]
        )
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const uniqueMemberIds = Array.from(new Set(
        [
            normalizeUserKey(myName),
            ...safeParseArray(config.memberIds || [], []).map((value) => normalizeUserKey(value)),
            ...(recipientId ? [normalizeUserKey(recipientId)] : [])
        ].filter(Boolean)
    ));

    const deterministicRoomId = roomType === 'dm'
        ? buildDeterministicDmRoomId(myName, recipientName || roomName)
        : (String(config.roomId || '').trim() || buildGroupRoomId(roomName, uniqueMemberNames));

    uniqueMemberNames.forEach((memberName) => {
        if (normalizeUserKey(memberName) === normalizeUserKey(myName)) return;
        persistKnownUser({ name: memberName });
    });

    const normalizeRoom = (room, index = 0) => ({
        id: room.id || room._id || room.roomId || room.room_id || deterministicRoomId || `custom-room-${Date.now()}-${index}`,
        roomId: room.roomId || room.room_id || room.id || room._id || deterministicRoomId || `custom-room-${Date.now()}-${index}`,
        type: room.type || room.roomType || room.room_type || roomType,
        name: room.name || room.title || room.roomName || room.room_name || roomName,
        icon: room.icon || room.emoji || room.avatar || room.image || roomIcon,
        color: room.color || room.themeColor || room.theme_color || roomColor,
        privacy: room.privacy || room.visibility || roomPrivacy,
        isPrivate: typeof room.isPrivate === 'boolean' ? room.isPrivate : roomPrivacy === 'private',
        description: room.description || '',
        memberCount: Number(
            room.memberCount ||
            room.membersCount ||
            room.member_count ||
            uniqueMemberNames.length ||
            0
        ),
        unreadCount: Number(room.unreadCount || room.unread_count || 0),
        createdAt: room.createdAt || room.created_at || new Date().toISOString(),
        recipientName: room.recipientName || room.recipient_name || recipientName || '',
        recipientId: room.recipientId || room.recipient_id || recipientId || '',
        memberNames: Array.from(new Set(
            safeParseArray(
                room.memberNames ||
                room.member_names ||
                room.participants ||
                uniqueMemberNames,
                uniqueMemberNames
            )
        )),
        participants: Array.from(new Set(
            safeParseArray(
                room.participants ||
                room.memberNames ||
                uniqueMemberNames,
                uniqueMemberNames
            )
        )),
        memberIds: Array.from(new Set(
            safeParseArray(
                room.memberIds ||
                room.member_ids ||
                uniqueMemberIds,
                uniqueMemberIds
            ).map((value) => normalizeUserKey(value)).filter(Boolean)
        )),
        topic: room.topic || (roomType === 'group' ? 'Private Brainstorming Group' : 'Direct Message'),
        raw: room
    });

    const getKnownRooms = () => {
        const stateRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

        let cacheRooms = [];
        try {
            const cached = JSON.parse(localStorage.getItem('yh_custom_rooms_cache') || 'null');
            cacheRooms = Array.isArray(cached?.rooms) ? cached.rooms : [];
        } catch (_) {}

        let legacyRooms = [];
        try {
            const rawLegacy = JSON.parse(localStorage.getItem('yh_custom_rooms') || '[]');
            legacyRooms = Array.isArray(rawLegacy) ? rawLegacy : [];
        } catch (_) {}

        const merged = [...stateRooms, ...cacheRooms, ...legacyRooms].map((room, index) => normalizeRoom(room, index));

        return merged.filter((room, index, arr) => {
            return arr.findIndex((candidate) => {
                const sameId = candidate.id && room.id && String(candidate.id) === String(room.id);
                const sameName = String(candidate.name || '').trim().toLowerCase() === String(room.name || '').trim().toLowerCase();
                const sameType = String(candidate.type || '').trim().toLowerCase() === String(room.type || '').trim().toLowerCase();
                return sameId || (sameName && sameType);
            }) === index;
        });
    };

    const saveCompatibilityMirrors = (rooms) => {
        try {
            localStorage.setItem('yh_custom_rooms_cache', JSON.stringify({
                savedAt: Date.now(),
                rooms
            }));
        } catch (error) {
            console.warn('Failed to cache custom rooms after creation:', error);
        }

        try {
            localStorage.setItem('yh_custom_rooms', JSON.stringify(
                rooms.map((room) => ({
                    id: room.id,
                    roomId: room.roomId || room.id,
                    type: room.type,
                    name: room.name,
                    icon: room.icon || roomIcon,
                    color: room.color || roomColor,
                    privacy: room.privacy,
                    isPrivate: room.isPrivate,
                    recipientName: room.recipientName || '',
                    recipientId: room.recipientId || '',
                    memberNames: room.memberNames || room.participants || [],
                    memberIds: room.memberIds || []
                }))
            ));
        } catch (error) {
            console.warn('Failed to update legacy custom room mirror:', error);
        }
    };

    const openCreatedRoom = (room) => {
        const roomNodes = Array.from(
            document.querySelectorAll('.dm-room, .room-entry, [data-room-id], [data-custom-room-name], [data-name]')
        );

        const matchedNode = roomNodes.find((node) => {
            const nodeRoomId = node.getAttribute('data-room-id');
            const nodeRoomName = node.getAttribute('data-name') || node.getAttribute('data-custom-room-name');
            return (nodeRoomId && String(nodeRoomId) === String(room.id)) ||
                (nodeRoomName && String(nodeRoomName).trim().toLowerCase() === String(room.name).trim().toLowerCase());
        });

        if (matchedNode) {
            matchedNode.click();
            return;
        }

        const virtualNode = document.createElement('div');
        virtualNode.setAttribute('data-room-id', room.id || '');
        virtualNode.setAttribute('data-name', room.name);
        virtualNode.setAttribute('data-icon', room.icon || (room.type === 'group' ? '👥' : '💬'));
        virtualNode.setAttribute('data-color', room.color || roomColor);
        virtualNode.setAttribute('data-room-type', room.type || roomType);
        virtualNode.setAttribute('data-room-privacy', room.privacy || roomPrivacy);
        virtualNode.setAttribute('data-room-topic', room.topic || (roomType === 'group' ? 'Private Brainstorming Group' : 'Direct Message'));
        virtualNode.setAttribute('data-room-recipient', room.recipientName || recipientName || '');
        virtualNode.setAttribute('data-room-recipient-id', room.recipientId || recipientId || '');
        virtualNode.setAttribute('data-room-participants', JSON.stringify(room.memberNames || room.participants || uniqueMemberNames));
        virtualNode.setAttribute('data-room-member-ids', JSON.stringify(room.memberIds || uniqueMemberIds));

        openRoom(room.type === 'group' ? 'group' : 'dm', virtualNode);
    };

    const existingRoom = getKnownRooms().find((room) => {
        const sameId = deterministicRoomId && room.id && String(room.id) === String(deterministicRoomId);
        const sameName = String(room.name || '').trim().toLowerCase() === roomName.toLowerCase();
        const sameType = String(room.type || '').trim().toLowerCase() === roomType;
        return sameId || (sameName && sameType);
    });

    if (existingRoom) {
        openCreatedRoom(existingRoom);
        showToast(`${roomName} is already in your rooms.`, 'success');
        return existingRoom;
    }

    const token =
        localStorage.getItem('yh_token') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('yh_token') ||
        sessionStorage.getItem('token') ||
        '';

    const requestBody = {
        id: deterministicRoomId,
        roomId: deterministicRoomId,
        type: roomType,
        name: roomName,
        icon: roomIcon,
        color: roomColor,
        privacy: roomPrivacy,
        isPrivate: roomPrivacy === 'private',
        source: config.source || 'dashboard',
        createdBy: myName,
        recipientName: recipientName || '',
        recipientId: recipientId || '',
        participants: uniqueMemberNames,
        memberNames: uniqueMemberNames,
        memberIds: uniqueMemberIds,
        topic: roomType === 'group' ? 'Private Brainstorming Group' : 'Direct Message'
    };

const endpoint = '/api/realtime/rooms';

let createdRoom = null;
let createdViaBackend = false;

try {
    const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && (!result || typeof result !== 'object' || result.success !== false)) {
        const payloadRoom = result.room || result.customRoom || result.data || result;
        createdRoom = normalizeRoom(payloadRoom, 0);
        createdViaBackend = true;
    }
} catch (error) {
    console.warn(`createNewRoom POST failed on ${endpoint}:`, error);
}

    if (createdViaBackend) {
        await loadCustomRooms(true);

        const refreshedRooms = Array.isArray(state.customRooms)
            ? state.customRooms.map((room, index) => normalizeRoom(room, index))
            : [];

        const matchedRoom = refreshedRooms.find((room) => {
            const sameId = createdRoom?.id && room.id && String(room.id) === String(createdRoom.id);
            const sameName = String(room.name || '').trim().toLowerCase() === roomName.toLowerCase();
            const sameType = String(room.type || '').trim().toLowerCase() === roomType;
            return sameId || (sameName && sameType);
        }) || createdRoom;

        const mergedRooms = refreshedRooms.length ? moveCustomRoomToTop(refreshedRooms, matchedRoom.id) : [matchedRoom];
        state.customRooms = mergedRooms;
        syncCustomRoomsUI(mergedRooms);
        saveCompatibilityMirrors(mergedRooms);
        openCreatedRoom(matchedRoom);
        showToast(`${matchedRoom.name} created successfully!`, 'success');
        return matchedRoom;
    }

    const offlineRoom = normalizeRoom({
        ...requestBody,
        id: deterministicRoomId,
        roomId: deterministicRoomId
    }, 0);

    const fallbackRooms = moveCustomRoomToTop([...getKnownRooms(), offlineRoom], offlineRoom.id);
    state.customRooms = fallbackRooms;
    syncCustomRoomsUI(fallbackRooms);
    saveCompatibilityMirrors(fallbackRooms);
    openCreatedRoom(offlineRoom);
    showToast(`${roomName} created locally. Backend sync will follow on refresh.`, 'success');
    return offlineRoom;
}

    // --- PROFILES & LEADERBOARD ---
    function renderLeaderboard() {
        const leaderboardList = document.getElementById('leaderboard-list');
        if(!leaderboardList) return;
        leaderboardList.innerHTML = '';
        let allStats = JSON.parse(localStorage.getItem('yh_user_stats')); if(!allStats) return;
        let rankableUsers = Object.keys(allStats).filter(name => name !== "YH Admin" && name !== "Agent").map(name => ({ name: name, ...allStats[name] }));
        rankableUsers.sort((a, b) => b.rep - a.rep);
        rankableUsers.slice(0, 5).forEach((user, index) => {
            const li = document.createElement('li'); li.className = "interactive-avatar"; li.setAttribute('data-user', user.name); li.setAttribute('data-role', user.role);
            let rankBadge = index === 0 ? `<span class="rank-badge rank-1">🏆 #1</span>` : `<span class="rank-badge">#${index + 1}</span>`;
            let avatarStyle = user.initial.includes('url') ? `background-image: ${user.initial}; background-size: cover; background-color: transparent;` : `background: ${user.color};`;
            li.innerHTML = `<div class="member-avatar" style="${avatarStyle}">${user.initial.includes('url') ? '' : user.initial}</div><div class="member-name" style="flex:1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</div><div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; width: 110px;">${rankBadge}<span style="font-size: 0.7rem; color: var(--neon-blue); font-weight: bold; width: 45px; text-align: right;">${user.rep} XP</span></div>`;
            leaderboardList.appendChild(li);
        });
    }

function openMiniProfile(name, role, avatarContent, avatarBg) {
    const modal = document.getElementById('mini-profile-modal');
    if (!modal) return;

    currentProfileUser = name;
    currentProfileIcon = avatarContent;
    currentProfileBg = avatarBg;

    let allStats = JSON.parse(localStorage.getItem('yh_user_stats') || '{}') || {};
    const myAvatar = localStorage.getItem('yh_user_avatar');

    if (!allStats[myName]) {
        allStats[myName] = {
            rep: 0,
            followers: 0,
            role: "Hustler",
            initial: myAvatar ? `url(${myAvatar})` : myName.charAt(0).toUpperCase(),
            color: "var(--neon-blue)"
        };
    }

    if (!allStats[name]) {
        allStats[name] = {
            rep: 0,
            followers: 0,
            role: role,
            initial: avatarContent.includes('url')
                ? avatarContent
                : avatarContent.trim().charAt(0).toUpperCase(),
            color: avatarBg
        };
    }

    localStorage.setItem('yh_user_stats', JSON.stringify(allStats));

    document.getElementById('mp-name').innerText = name;
    document.getElementById('mp-role').innerHTML =
        role === 'HQ'
            ? `<span class="role-badge founder">HQ</span>`
            : role === 'AI'
            ? `<span class="role-badge bot">AI</span>`
            : role === 'Dev'
            ? `<span class="role-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">DEV</span>`
            : `<span class="role-badge" style="background: rgba(255,255,255,0.1); color:#fff; border: 1px solid rgba(255,255,255,0.2);">Hustler</span>`;

    const avatarEl = document.getElementById('mp-avatar');
    if (avatarEl) {
        if (avatarContent.includes('url')) {
            avatarEl.innerText = '';
            avatarEl.style.backgroundImage = avatarContent;
            avatarEl.style.backgroundColor = 'transparent';
        } else {
            avatarEl.innerText = avatarContent.trim().charAt(0).toUpperCase();
            avatarEl.style.backgroundImage = 'none';
            avatarEl.style.backgroundColor = avatarBg || 'var(--neon-blue)';
        }
    }

    document.getElementById('mp-followers').innerText = allStats[name].followers;
    document.getElementById('mp-rep').innerText = allStats[name].rep;

    const profileStats = document.querySelector('.profile-stats');
    if (profileStats) {
        profileStats.style.display = name === "Agent" ? 'none' : 'flex';
    }

    const btnBrowse = document.getElementById('btn-mp-browse-hustlers');
    if (btnBrowse) {
        btnBrowse.style.display = 'inline-flex';
        btnBrowse.classList.remove('hidden-step');
        btnBrowse.innerText = 'Check out on other Hustlers';
    }

    const topNavName = String(document.getElementById('top-nav-name')?.innerText || '').trim().toLowerCase();
    const localUserName = String(localStorage.getItem('yh_user_name') || '').trim().toLowerCase();
    const clickedName = String(name || '').trim().toLowerCase();

    const isMe =
        clickedName &&
        (
            clickedName === String(myName || '').trim().toLowerCase() ||
            clickedName === topNavName ||
            clickedName === localUserName
        );

    if (isMe) {
        document.getElementById('mp-role').innerHTML += `<br><div class="my-profile-tag">This is you</div>`;
    }

    modal.classList.remove('hidden-step');
}
    const btnFollow = document.getElementById('btn-mp-follow');
if (btnFollow) {
    btnFollow.addEventListener('click', () => {
        if (!currentProfileUser) return;

        const currentEntry = getUserDirectoryEntry(currentProfileUser, {
            role: 'Hustler',
            avatarToken: currentProfileIcon || currentProfileUser.charAt(0).toUpperCase(),
            avatarBg: currentProfileBg || 'var(--neon-blue)'
        });

        let followed = getFollowedUsers();
        let allStats = getStoredUserStats();
        const existingStats = allStats[currentProfileUser] || {
            rep: 0,
            followers: 0,
            role: currentEntry?.role || 'Hustler',
            initial: currentEntry?.avatarToken || currentProfileUser.charAt(0).toUpperCase(),
            color: currentEntry?.avatarBg || 'var(--neon-blue)'
        };

        if (followed.some((name) => normalizeUserKey(name) === normalizeUserKey(currentProfileUser))) {
            followed = followed.filter((name) => normalizeUserKey(name) !== normalizeUserKey(currentProfileUser));
            existingStats.followers = Math.max(0, Number(existingStats.followers || 0) - 1);
            existingStats.rep = Math.max(0, Number(existingStats.rep || 0) - 20);
            btnFollow.innerText = "Follow";
            btnFollow.classList.remove('btn-following');
            persistKnownUser({
                name: currentProfileUser,
                role: existingStats.role,
                avatarToken: existingStats.initial,
                avatarBg: existingStats.color,
                rep: existingStats.rep,
                followers: existingStats.followers,
                followed: false
            });
        } else {
            followed.push(currentProfileUser);
            existingStats.followers = Number(existingStats.followers || 0) + 1;
            existingStats.rep = Number(existingStats.rep || 0) + 20;
            btnFollow.innerText = "Following";
            btnFollow.classList.add('btn-following');
            persistKnownUser({
                name: currentProfileUser,
                role: existingStats.role,
                avatarToken: existingStats.initial,
                avatarBg: existingStats.color,
                rep: existingStats.rep,
                followers: existingStats.followers,
                followed: true
            });
            showToast(`You followed ${currentProfileUser}. They gained +20 REP!`, "success");
        }

        allStats = getStoredUserStats();
        allStats[currentProfileUser] = {
            ...existingStats,
            rep: Number(existingStats.rep || 0),
            followers: Number(existingStats.followers || 0)
        };

        setStoredUserStats(allStats);
        setFollowedUsers(followed);

        document.getElementById('mp-followers').innerText = allStats[currentProfileUser].followers;
        document.getElementById('mp-rep').innerText = allStats[currentProfileUser].rep;

        renderLeaderboard();
        renderDmModalDirectory(document.querySelector('#dm-modal .modal-search')?.value || '');
        renderPendingGroupMembers();

        const communicationsSearchInput = document.querySelector('.channel-search');
        if (communicationsSearchInput && document.activeElement === communicationsSearchInput) {
            renderCommunicationsSearchResults(communicationsSearchInput.value);
        }
    });
}

    const btnMessage = document.getElementById('btn-mp-message');
if(btnMessage) {
    btnMessage.addEventListener('click', async () => {
        if (!currentProfileUser) return;

        let iconData = currentProfileIcon;
        if(!iconData || (iconData.length > 2 && !iconData.includes('url'))) {
            iconData = currentProfileUser.charAt(0).toUpperCase();
        }

        persistKnownUser({
            name: currentProfileUser,
            role: 'Hustler',
            avatarToken: iconData,
            avatarBg: currentProfileBg || 'var(--neon-blue)'
        });

        await createNewRoom('dm', currentProfileUser, iconData, currentProfileBg || 'var(--neon-blue)', {
            recipientName: currentProfileUser,
            recipientId: normalizeUserKey(currentProfileUser),
            memberNames: [myName, currentProfileUser],
            memberIds: [normalizeUserKey(myName), normalizeUserKey(currentProfileUser)],
            source: 'mini-profile'
        });

        showToast(`Private Chat opened with ${currentProfileUser}!`, "success");
        document.getElementById('mini-profile-modal').classList.add('hidden-step');
    });
}
const btnBrowseHustlers = document.getElementById('btn-mp-browse-hustlers');
if (btnBrowseHustlers) {
    btnBrowseHustlers.addEventListener('click', async () => {
        document.getElementById('mini-profile-modal')?.classList.add('hidden-step');
        document.getElementById('academy-member-browser-modal')?.classList.remove('hidden-step');
        await loadAcademyMemberBrowser(true);
    });
}
const academyMemberBrowserModal = document.getElementById('academy-member-browser-modal');
const academyMemberBrowserClose = document.getElementById('academy-member-browser-close');

if (academyMemberBrowserClose) {
    academyMemberBrowserClose.addEventListener('click', () => {
        closeAcademyMemberBrowser();
    });
}

if (academyMemberBrowserModal) {
    academyMemberBrowserModal.addEventListener('click', (event) => {
        if (event.target === academyMemberBrowserModal) {
            closeAcademyMemberBrowser();
        }
    });
}

function closeAcademyMemberBrowser() {
    document.getElementById('academy-member-browser-modal')?.classList.add('hidden-step');
}

function renderAcademyMemberBrowserList(members = []) {
    const list = document.getElementById('academy-member-browser-list');
    if (!list) return;

    if (!Array.isArray(members) || !members.length) {
        list.innerHTML = `<div class="academy-member-browser-empty">No other Academy members found yet.</div>`;
        return;
    }

    list.innerHTML = members.map((member) => {
        const memberId = String(member.id || member.user_id || '').trim();
        const displayName = String(
            member.display_name ||
            member.fullName ||
            member.name ||
            member.username ||
            'Academy Member'
        ).trim();
        const username = String(member.username || '').trim();
        const roleLabel = String(member.role_label || member.role || 'Academy Member').trim();
        const followersCount = Number(member.followers_count || member.followers || 0);
        const followed = member.followed_by_me === true || member.followed === true;
        const avatar = String(member.avatar || member.profile_picture || '').trim();

        const avatarHtml = avatar
            ? `<div class="academy-member-card-avatar" style="background-image:url('${avatar.replace(/'/g, "%27")}'); background-color:transparent;"></div>`
            : `<div class="academy-member-card-avatar">${academyFeedEscapeHtml(displayName.charAt(0).toUpperCase())}</div>`;

        return `
            <div class="academy-member-card" data-member-id="${academyFeedEscapeHtml(memberId)}">
                <div class="academy-member-card-left">
                    ${avatarHtml}
                    <div class="academy-member-card-copy">
                        <div class="academy-member-card-name">${academyFeedEscapeHtml(displayName)}</div>
                        <div class="academy-member-card-meta">
                            ${username ? `@${academyFeedEscapeHtml(username)} • ` : ''}${academyFeedEscapeHtml(roleLabel)} • ${followersCount} follower${followersCount === 1 ? '' : 's'}
                        </div>
                    </div>
                </div>

                <div class="academy-member-card-actions">
                    <button
                        type="button"
                        class="btn-secondary academy-member-card-follow ${followed ? 'is-following' : ''}"
                        data-member-follow-id="${academyFeedEscapeHtml(memberId)}"
                    >${followed ? 'Following' : 'Follow'}</button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadAcademyMemberBrowser(forceFresh = false) {
    const list = document.getElementById('academy-member-browser-list');
    if (!list) return;

    if (!forceFresh && Array.isArray(window.academyMemberBrowserList) && window.academyMemberBrowserList.length) {
        renderAcademyMemberBrowserList(window.academyMemberBrowserList);
        return;
    }

    list.innerHTML = `<div class="academy-member-browser-empty">Loading members...</div>`;

    try {
        const result = await academyAuthedFetch('/api/academy/community/members', {
            method: 'GET'
        });

        window.academyMemberBrowserList = Array.isArray(result?.members) ? result.members : [];
        renderAcademyMemberBrowserList(window.academyMemberBrowserList);
    } catch (error) {
        list.innerHTML = `<div class="academy-member-browser-empty">Failed to load other Hustlers.</div>`;
        showToast(error.message || 'Failed to load other Hustlers.', 'error');
    }
}

async function toggleAcademyMemberBrowserFollow(targetUserId) {
    const normalizedTargetUserId = String(targetUserId || '').trim();
    if (!normalizedTargetUserId) {
        showToast('Invalid member target.', 'error');
        return;
    }

    try {
        const result = await academyAuthedFetch(`/api/academy/community/members/${normalizedTargetUserId}/follow`, {
            method: 'POST'
        });

        const currentList = Array.isArray(window.academyMemberBrowserList) ? window.academyMemberBrowserList : [];

        window.academyMemberBrowserList = currentList.map((member) => {
            const memberId = String(member.id || member.user_id || '').trim();
            if (memberId !== normalizedTargetUserId) return member;

            const currentlyFollowed = member.followed_by_me === true || member.followed === true;
            const nextFollowed =
                typeof result?.followed === 'boolean'
                    ? result.followed
                    : !currentlyFollowed;

            const currentFollowers = Number(member.followers_count || member.followers || 0);
            const nextFollowers =
                typeof result?.followers_count === 'number'
                    ? result.followers_count
                    : Math.max(0, currentFollowers + (nextFollowed ? 1 : -1));

            return {
                ...member,
                followed_by_me: nextFollowed,
                followed: nextFollowed,
                followers_count: nextFollowers,
                followers: nextFollowers
            };
        });

        renderAcademyMemberBrowserList(window.academyMemberBrowserList);
        showToast(result?.message || 'Follow status updated.', 'success');
    } catch (error) {
        showToast(error.message || 'Failed to update follow status.', 'error');
    }
}

const academyMemberBrowserList = document.getElementById('academy-member-browser-list');
if (academyMemberBrowserList && academyMemberBrowserList.dataset.bound !== 'true') {
    academyMemberBrowserList.dataset.bound = 'true';

    academyMemberBrowserList.addEventListener('click', async (event) => {
        const followBtn = event.target.closest('[data-member-follow-id]');
        if (!followBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const memberId = followBtn.getAttribute('data-member-follow-id') || '';
        await toggleAcademyMemberBrowserFollow(memberId);
    });
}

    // --- MISSIONS & BLUEPRINT ---
function checkDailyReset() {
    const today = new Date().toDateString();

    let dailyStats = safeParseJson(localStorage.getItem('yh_daily_stats'), null);
    if (!dailyStats || typeof dailyStats !== 'object') {
        dailyStats = { date: today, completed: 0, total: 0 };
    }

    const customMissions = safeParseJson(localStorage.getItem('yh_custom_missions'), []);
    const missionsList = Array.isArray(customMissions) ? customMissions : [];

    if (dailyStats.date !== today) {
        dailyStats = {
            date: today,
            completed: 0,
            total: missionsList.length
        };
        localStorage.setItem('yh_daily_stats', JSON.stringify(dailyStats));
    }

    return dailyStats;
}

    function loadBlueprintProgress() {
        const container = document.getElementById('blueprint-list');
        if(!container) return;
        container.innerHTML = '';
        checkDailyReset(); 
        const customMissionsRaw = safeParseJson(localStorage.getItem('yh_custom_missions'), []);
const customMissions = Array.isArray(customMissionsRaw) ? customMissionsRaw : [];
        if(customMissions.length === 0) container.innerHTML = `<div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); padding: 10px;">No pending tasks. Add one above!</div>`;
        customMissions.forEach((m, idx) => {
            const div = document.createElement('div'); div.className = `step-item fade-in`; div.setAttribute('data-step', m.id); div.title = m.title;
            div.innerHTML = `<div class="sidebar-icon"><div class="step-circle">${idx + 1}</div></div><span class="sidebar-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</span><button class="delete-task-btn" title="Delete Task">✖</button>`;
            div.addEventListener('click', (e) => { if(e.target.classList.contains('delete-task-btn')) return; pendingTaskToComplete = m.id; document.getElementById('task-confirm-modal').classList.remove('hidden-step'); });
            div.querySelector('.delete-task-btn').addEventListener('click', (e) => {
    e.stopPropagation();

    const missionsRaw = safeParseJson(localStorage.getItem('yh_custom_missions'), []);
    let missions = Array.isArray(missionsRaw) ? missionsRaw : [];
    missions = missions.filter(task => task.id !== m.id);

    localStorage.setItem('yh_custom_missions', JSON.stringify(missions));

    let stats = checkDailyReset();
    stats.total = Math.max(0, stats.total - 1);
    localStorage.setItem('yh_daily_stats', JSON.stringify(stats));

    loadBlueprintProgress();
});
            container.appendChild(div);
        });
        let stats = checkDailyReset(); const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const fill = document.getElementById('progress-bar-fill'); const text = document.getElementById('progress-text');
        if(fill) fill.style.width = percentage + '%'; if(text) text.innerText = percentage + '% Daily Progress';
    }

    const btnConfirmTask = document.getElementById('btn-confirm-task'); const btnCancelTask = document.getElementById('btn-cancel-task');
    if(btnConfirmTask && btnCancelTask) {
        btnCancelTask.addEventListener('click', () => { document.getElementById('task-confirm-modal').classList.add('hidden-step'); pendingTaskToComplete = null; });
        btnConfirmTask.addEventListener('click', () => {
            if(pendingTaskToComplete) {
                let missions = JSON.parse(localStorage.getItem('yh_custom_missions')) || []; missions = missions.filter(m => m.id !== pendingTaskToComplete); localStorage.setItem('yh_custom_missions', JSON.stringify(missions));
                let stats = checkDailyReset(); stats.completed += 1; localStorage.setItem('yh_daily_stats', JSON.stringify(stats)); showToast("Task Completed! Great job.", "success"); loadBlueprintProgress();
            }
            document.getElementById('task-confirm-modal').classList.add('hidden-step');
        });
    }

    const btnSaveMission = document.getElementById('btn-save-mission');
    if(btnSaveMission) {
        btnSaveMission.addEventListener('click', () => {
            const titleInput = document.getElementById('mission-title-input'); const title = titleInput.value.trim(); if(!title) { showToast("Please enter your task.", "error"); return; }
            const customMissions = JSON.parse(localStorage.getItem('yh_custom_missions')) || []; customMissions.push({ id: "task_" + Date.now(), title: title, targetDate: '' }); localStorage.setItem('yh_custom_missions', JSON.stringify(customMissions));
            let stats = checkDailyReset(); stats.total += 1; localStorage.setItem('yh_daily_stats', JSON.stringify(stats));
            loadBlueprintProgress(); document.getElementById('mission-modal').classList.add('hidden-step'); titleInput.value = ''; showToast("Task added! The System will hold you accountable.", "success");
            setTimeout(() => { sendSystemNotification("Accountability Check", `Have you finished '${title}'? Get back to work.`, "🤖", "#8b5cf6", ""); }, 5000); 
        });
    }

    // --- MODALS & EXTRAS ---
    function setupModal(btnId, modalId, closeBtnId) {
        const btn = document.getElementById(btnId); const modal = document.getElementById(modalId); const closeBtn = document.getElementById(closeBtnId);
        if(btn && modal && closeBtn) { btn.addEventListener('click', () => modal.classList.remove('hidden-step')); closeBtn.addEventListener('click', () => modal.classList.add('hidden-step')); modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden-step'); }); }
    }
    setupModal('btn-open-dm-modal', 'dm-modal', 'close-dm-modal'); setupModal('btn-open-group-modal', 'group-modal', 'close-group-modal'); setupModal('btn-support-ticket', 'ticket-modal', 'close-ticket-modal'); setupModal('btn-settings', 'settings-modal', 'close-settings-modal'); setupModal('btn-start-lounge', 'lounge-modal', 'close-lounge-modal'); setupModal('btn-open-mission-modal', 'mission-modal', 'close-mission-modal'); setupModal('btn-open-folder-modal', 'folder-modal', 'close-folder-modal');

    const academyCheckinModal = document.getElementById('academy-checkin-modal');
    const academyCheckinForm = document.getElementById('academy-checkin-form');
    const academyCheckinCloseBtn = document.getElementById('close-checkin-modal');
    const academyCheckinCancelBtn = document.getElementById('btn-cancel-checkin');

    if (academyCheckinCloseBtn) {
        academyCheckinCloseBtn.addEventListener('click', () => {
            academyCloseCheckinModal();
        });
    }

    if (academyCheckinCancelBtn) {
        academyCheckinCancelBtn.addEventListener('click', () => {
            academyCloseCheckinModal();
        });
    }

    if (academyCheckinModal) {
        academyCheckinModal.addEventListener('click', (e) => {
            if (e.target === academyCheckinModal) {
                academyCloseCheckinModal();
            }
        });
    }

    if (academyCheckinForm) {
        academyCheckinForm.addEventListener('submit', academySubmitCheckin);
    }

    const academyMissionActionModal = document.getElementById('academy-mission-action-modal');
    const academyMissionActionForm = document.getElementById('academy-mission-action-form');
    const academyMissionActionCloseBtn = document.getElementById('close-mission-action-modal');
    const academyMissionActionCancelBtn = document.getElementById('btn-cancel-mission-action');

    if (academyMissionActionCloseBtn) {
        academyMissionActionCloseBtn.addEventListener('click', () => {
            academyCloseMissionActionModal();
        });
    }

    if (academyMissionActionCancelBtn) {
        academyMissionActionCancelBtn.addEventListener('click', () => {
            academyCloseMissionActionModal();
        });
    }

    if (academyMissionActionModal) {
        academyMissionActionModal.addEventListener('click', (e) => {
            if (e.target === academyMissionActionModal) {
                academyCloseMissionActionModal();
            }
        });
    }

    if (academyMissionActionForm) {
        academyMissionActionForm.addEventListener('submit', academySubmitMissionAction);
    }

    const btnCreateFolder = document.getElementById('btn-create-folder');
    if(btnCreateFolder) {
        btnCreateFolder.addEventListener('click', () => {
            const name = document.getElementById('folder-name-input').value.trim(); if(!name) return;
            const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || []; vaultItems.push({ type: 'folder', name: name, parentFolder: currentVaultFolder }); localStorage.setItem('yh_vault_items', JSON.stringify(vaultItems));
            loadVault(); document.getElementById('folder-modal').classList.add('hidden-step'); document.getElementById('folder-name-input').value = ''; showToast(`Folder '${name}' created!`, "success");
        });
    }

    const btnVaultUpload = document.getElementById('btn-vault-upload-trigger'); const vaultFileInput = document.getElementById('vault-file-input');
    if(btnVaultUpload && vaultFileInput) {
        btnVaultUpload.addEventListener('click', () => vaultFileInput.click());
        vaultFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if(!file) return; saveFileToVault(file, "Direct Upload"); showToast(`${file.name} uploading to The Vault...`, "success");
        });
    }

    document.querySelectorAll('.modal-search').forEach(input => {
    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const modalBody = e.target.closest('.modal-body');

        if (e.target.closest('#dm-modal')) {
            renderDmModalDirectory(searchTerm);
            return;
        }

        if (modalBody) {
            modalBody.querySelectorAll('.modal-user-item').forEach(item => {
                const name = item.querySelector('.member-name')?.innerText?.toLowerCase() || '';
                item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
            });
        }
    });
});

document.getElementById('btn-open-dm-modal')?.addEventListener('click', () => {
    const modalSearch = document.querySelector('#dm-modal .modal-search');
    if (modalSearch) modalSearch.value = '';
    renderDmModalDirectory('');
    resetDmModalSelection();
});

document.getElementById('btn-open-group-modal')?.addEventListener('click', () => {
    renderPendingGroupMembers();
});

const btnStartDm = document.getElementById('btn-start-dm');
if (btnStartDm) {
    btnStartDm.addEventListener('click', async () => {
        const checkedRadio = document.querySelector('.dm-radio:checked');
        if(!checkedRadio) return;

        const userLabel = checkedRadio.closest('.modal-user-item');
        if (!userLabel) return;

        const chatName = userLabel.getAttribute('data-user-name') || userLabel.querySelector('.dm-name-preview')?.innerText || '';
        const chatRole = userLabel.getAttribute('data-user-role') || 'Hustler';
        const chatAvatar = userLabel.getAttribute('data-user-avatar') || userLabel.querySelector('.dm-avatar-preview')?.innerText || chatName.charAt(0).toUpperCase();
        const chatColor = userLabel.getAttribute('data-user-bg') || userLabel.querySelector('.dm-avatar-preview')?.style.backgroundColor || "var(--neon-blue)";

        if (!chatName) return;

        persistKnownUser({
            name: chatName,
            role: chatRole,
            avatarToken: chatAvatar,
            avatarBg: chatColor
        });

        await createNewRoom('dm', chatName, chatAvatar, chatColor, {
            recipientName: chatName,
            recipientId: normalizeUserKey(chatName),
            memberNames: [myName, chatName],
            memberIds: [normalizeUserKey(myName), normalizeUserKey(chatName)],
            source: 'dm-modal'
        });

        showToast("Private Chat opened successfully!", "success");
        document.getElementById('dm-modal').classList.add('hidden-step');
        resetDmModalSelection();
    });
}

const btnCreateGroup = document.getElementById('btn-create-group');
const groupNameInput = document.getElementById('group-name-input');

if (btnCreateGroup && groupNameInput) {
    groupNameInput.addEventListener('input', () => {
        syncGroupCreateButtonState();
    });

    btnCreateGroup.addEventListener('click', async () => {
        const chatName = groupNameInput.value.trim();
        if(!chatName) return;

        const selectedMemberNames = Array.from(new Set(
            [myName, ...pendingGroupMembers.map((user) => user.name)]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ));

        selectedMemberNames.forEach((memberName) => {
            if (normalizeUserKey(memberName) === normalizeUserKey(myName)) return;
            persistKnownUser({ name: memberName });
        });

        await createNewRoom('group', chatName, "👥", "#0ea5e9", {
            memberNames: selectedMemberNames,
            memberIds: selectedMemberNames.map((name) => normalizeUserKey(name)),
            source: 'group-modal'
        });

        showToast(`Brainstorming Group '${chatName}' created!`, "success");
        document.getElementById('group-modal').classList.add('hidden-step');
        groupNameInput.value = "";
        pendingGroupMembers = [];
        renderPendingGroupMembers();
        syncGroupCreateButtonState();
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
        if(avatarWrapper && avatarInput) {
            avatarWrapper.addEventListener('click', () => { avatarInput.click(); });
            avatarInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(file) { if(file.size > 2 * 1024 * 1024) { showToast("Image too large. Max 2MB allowed.", "error"); return; } const reader = new FileReader(); reader.onload = (event) => { tempAvatarData = event.target.result; avatarPreview.innerText = ''; avatarPreview.style.backgroundImage = `url(${tempAvatarData})`; }; reader.readAsDataURL(file); } });
        }
        btnSaveSettings.addEventListener('click', () => {
            const newName = inputDisplayName.value.trim(); if(!newName) { showToast("Display name cannot be empty.", "error"); return; }
            localStorage.setItem('yh_user_name', newName); if(tempAvatarData) { localStorage.setItem('yh_user_avatar', tempAvatarData); }
            updateUserProfile(newName, tempAvatarData); showToast("Profile settings saved!", "success"); document.getElementById('settings-modal').classList.add('hidden-step');
        });
    }

    const sidebarToggle = document.getElementById('sidebar-toggle'); const academySidebar = document.getElementById('academy-sidebar');
    if(sidebarToggle && academySidebar) { sidebarToggle.addEventListener('click', () => { academySidebar.classList.toggle('collapsed'); sidebarToggle.innerHTML = academySidebar.classList.contains('collapsed') ? '❯' : '❮'; }); }

    document.querySelectorAll('.btn-focus-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            const dashboardCoreWrapper = document.getElementById('academy-wrapper'); if(!dashboardCoreWrapper) return;
            dashboardCoreWrapper.classList.toggle('in-focus-mode');
            if(dashboardCoreWrapper.classList.contains('in-focus-mode')) { btn.innerHTML = '🔴 Exit Focus Mode'; btn.style.background = 'rgba(239, 68, 68, 0.2)'; btn.style.color = '#ef4444'; btn.style.borderColor = '#ef4444'; showToast("Focus Mode Activated: Distractions Hidden", "success"); } 
            else { btn.innerHTML = '👁️ Focus Mode'; btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.color = '#fff'; btn.style.borderColor = 'rgba(255,255,255,0.1)'; showToast("Focus Mode Deactivated", "success"); }
        });
    });

    const pollOptions = document.querySelectorAll('.poll-option');
    if(pollOptions.length > 0) {
        const savedVote = localStorage.getItem('yh_poll_vote');
        if(savedVote) { const selectedOpt = document.querySelector(`.poll-option[data-vote="${savedVote}"]`); if(selectedOpt) selectedOpt.classList.add('voted'); const votesLabel = document.getElementById('poll-total-votes'); if(votesLabel) votesLabel.innerText = "1,249 Votes"; }
        pollOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                if(localStorage.getItem('yh_poll_vote')) { showToast("You have already voted!", "error"); return; }
                opt.classList.add('voted'); localStorage.setItem('yh_poll_vote', opt.getAttribute('data-vote')); showToast("Vote cast successfully!", "success");
                const votesLabel = document.getElementById('poll-total-votes'); if(votesLabel) votesLabel.innerText = "1,249 Votes";
                const bg = opt.querySelector('.poll-option-bg'); const percent = opt.querySelector('.poll-percent');
                if(bg) bg.style.width = "55%"; if(percent) percent.innerText = "55%";
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
    if (!value) return 'Just now';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMin < 1) return 'Just now';
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
if (localStorage.getItem('yh_user_loggedIn') === 'true') {
    const savedName = localStorage.getItem('yh_user_name');
    const savedAvatar = localStorage.getItem('yh_user_avatar');
    updateUserProfile(savedName, savedAvatar);

    persistKnownUser({
        name: savedName || myName,
        role: 'Hustler',
        avatarToken: savedAvatar ? `url(${savedAvatar})` : (savedName || myName).charAt(0).toUpperCase(),
        avatarBg: 'var(--neon-blue)'
    });

    bindCommunicationsSearch();
    renderDmModalDirectory('');
    renderPendingGroupMembers();

    loadCustomRooms(); 
    loadBlueprintProgress();
    loadVoiceLounges(); 
    loadVideoLounges();
    renderLeaderboard();
    loadVault();

    resolveAcademyAccessState().catch(() => {});
    refreshAcademyMembershipStatus(true).catch(() => {});
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
            missionsCompleted: Number(runtime.todayProgress.completed || 0),
            missionsTotal: Number(runtime.todayProgress.total || 0)
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
async function academyAuthedFetch(url, options = {}) {
    const token = localStorage.getItem('yh_token');
    if (!token) {
        showToast("Your session expired. Please log in again.", "error");
        window.location.href = '/';
        throw new Error('Missing auth token');
    }

    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Request failed.');
    }

    return result;
}

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
    } catch (error) {
        showToast(error.message || "Mission completion failed.", "error");
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
        noteEl.placeholder = 'Write a short note...';
    }
    if (submitBtn) {
        submitBtn.disabled = false;
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

    if (academyMissionActionState.status === 'skipped') {
        if (titleEl) titleEl.innerText = 'Skip Mission';
        if (contextEl) contextEl.innerText = `Why are you skipping "${academyMissionActionState.title || 'this mission'}" today?`;
        if (labelEl) labelEl.innerText = 'Reason for skipping';
        if (noteEl) noteEl.placeholder = 'Why are you skipping this mission right now?';
        if (submitBtn) submitBtn.innerText = 'Mark as Skipped';
    } else if (academyMissionActionState.status === 'stuck') {
        if (titleEl) titleEl.innerText = 'Mark Mission as Stuck';
        if (contextEl) contextEl.innerText = `What exactly is blocking progress on "${academyMissionActionState.title || 'this mission'}"?`;
        if (labelEl) labelEl.innerText = 'What are you stuck on?';
        if (noteEl) noteEl.placeholder = 'Describe the blocker clearly...';
        if (submitBtn) submitBtn.innerText = 'Mark as Stuck';
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
            submitBtn.innerText = 'Saving...';
        }

        await academyUpdateMissionStatus(missionId, status, note);
        academyCloseMissionActionModal();
    } catch (error) {
        showToast(error.message || 'Mission update failed.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = status === 'skipped' ? 'Mark as Skipped' : 'Mark as Stuck';
        }
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
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save Check-In';
    }
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

    const energyScore = String(energyInput?.value || '').trim();
    const moodScore = String(moodInput?.value || '').trim();
    const completedSummary = String(completedInput?.value || '').trim();
    const blockerText = String(blockersInput?.value || '').trim();
    const tomorrowFocus = String(focusInput?.value || '').trim();

    if (!energyScore || !moodScore || !completedSummary || !tomorrowFocus) {
        showToast('Please complete the required check-in fields.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Saving...';
        }

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
        academyCloseCheckinModal();
        await loadAcademyHome(true);
        showToast('Check-in saved.', 'success');
    } catch (error) {
        showToast(error.message || 'Check-in failed.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Save Check-In';
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
    const focusHtml = focusAreas.length
        ? focusAreas.map((item) => `<span class="academy-home-chip">${prettyLabel(item)}</span>`).join('')
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
            const pillar = prettyLabel(mission.pillar || 'General');
            const title = safeHtml(mission.title || `Mission ${index + 1}`);
            const statusRaw = String(mission.status || 'pending').trim().toLowerCase();
            const status = safeHtml(statusRaw || 'pending');
            const dueDate = safeHtml(mission.dueDate || 'Not set');
            const estimatedMinutes = safeHtml(mission.estimatedMinutes || 0);
            const whyItMatters = safeHtml(mission.whyItMatters || '');
            const isCompleted = statusRaw === 'completed';

            const statusColor =
                statusRaw === 'completed'
                    ? '#22c55e'
                    : statusRaw === 'skipped'
                    ? '#f59e0b'
                    : statusRaw === 'stuck'
                    ? '#ef4444'
                    : 'var(--text-muted)';

            return `
                <div style="padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                        <div>
                            <div style="font-size:0.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">
                                Mission ${index + 1} • ${pillar}
                            </div>
                            <div style="margin-top:6px;font-size:1rem;font-weight:600;color:#fff;">
                                ${title}
                            </div>
                        </div>
                        <div style="font-size:0.8rem;color:${statusColor};text-transform:capitalize;">
                            ${status}
                        </div>
                    </div>

                    <div style="margin-top:8px;font-size:0.9rem;color:var(--text-muted);">
                        Due: ${dueDate} • ${estimatedMinutes} mins
                    </div>

                    ${whyItMatters ? `
                        <div style="margin-top:8px;font-size:0.88rem;line-height:1.6;color:#d1d5db;">
                            <strong style="color:#fff;">Why this matters:</strong> ${whyItMatters}
                        </div>
                    ` : ''}

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
    if (chatHeaderTopic) chatHeaderTopic.innerText = "Roadmap, missions, and AI feedback loop";
    if (chatPinnedMessage) chatPinnedMessage.style.display = "none";
    if (chatInputArea) chatInputArea.style.display = "none";

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
                    ${createdByModel ? `<div class="academy-home-meta">Planner: ${createdByModel}</div>` : ''}
                </div>

                <div class="academy-home-actions">
                    <button id="academy-home-refresh-roadmap" type="button" class="btn-primary academy-home-action-btn">Refresh Roadmap</button>
                    <button id="academy-home-open-checkin" type="button" class="btn-secondary academy-home-action-btn">Daily Check-In</button>
                    <button id="academy-home-enter-chat" type="button" class="btn-secondary academy-home-action-btn">Open Community</button>
                    <button id="academy-home-open-voice" type="button" class="btn-secondary academy-home-action-btn">Open Voice Lounge</button>
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
                    <div class="academy-home-panel-label">Roadmap Summary</div>
                    <div class="academy-home-panel-copy">
                        <strong>Main Bottleneck:</strong> ${safeHtml(summary.primaryBottleneck || 'Not available')}<br>
                        <strong>Secondary Bottleneck:</strong> ${safeHtml(summary.secondaryBottleneck || 'Not available')}<br>
                        <strong>Main Opportunity:</strong> ${safeHtml(summary.mainOpportunity || 'Not available')}
                    </div>
                </section>

                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">Focus Areas</div>
                    <div class="academy-home-chip-row">
                        ${focusHtml}
                    </div>
                </section>

                <section class="academy-home-panel">
                    <div class="academy-home-panel-label">Weekly Checkpoint</div>
                    <div class="academy-home-panel-copy">
                        <strong>Theme:</strong> ${safeHtml(weeklyCheckpoint.theme || 'Not available')}<br>
                        <strong>Target Outcome:</strong> ${safeHtml(weeklyCheckpoint.targetOutcome || 'Not available')}
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
                <div class="academy-home-panel-label">Today’s Missions</div>
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

    document.getElementById('academy-home-refresh-roadmap')?.addEventListener('click', () => {
        academyRefreshRoadmap();
    });

    document.getElementById('academy-home-open-checkin')?.addEventListener('click', () => {
        academyOpenCheckin();
    });

    document.querySelectorAll('[data-academy-action="complete"]').forEach((button) => {
        button.addEventListener('click', () => {
            const missionId = String(button.getAttribute('data-mission-id') || '').trim();
            if (missionId) academyCompleteMission(missionId);
        });
    });

    document.querySelectorAll('[data-academy-action="skip"]').forEach((button) => {
        button.addEventListener('click', () => {
            const missionId = String(button.getAttribute('data-mission-id') || '').trim();
            const missionTitle = String(button.getAttribute('data-mission-title') || '').trim();
            if (!missionId) return;
            academyOpenMissionActionModal(missionId, 'skipped', missionTitle);
        });
    });

    document.querySelectorAll('[data-academy-action="stuck"]').forEach((button) => {
        button.addEventListener('click', () => {
            const missionId = String(button.getAttribute('data-mission-id') || '').trim();
            const missionTitle = String(button.getAttribute('data-mission-title') || '').trim();
            if (!missionId) return;
            academyOpenMissionActionModal(missionId, 'stuck', missionTitle);
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

function readAcademyHiddenPostIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem('yh_academy_hidden_posts') || '[]');
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

    localStorage.setItem('yh_academy_hidden_posts', JSON.stringify(normalized));
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

function openAcademyFeedView(forceReload = false) {
    closeRoadmapIntake();
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-chat');

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

    loadAcademyFeed(forceReload);
}

function openAcademyRoadmapView(forceFresh = false) {
    hideAcademyViewsForFeed();

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

    loadAcademyHome(forceFresh);
}

function renderAcademyProfileView() {
    const cachedHome = readAcademyHomeCache() || {};
    const displayName = String(localStorage.getItem('yh_user_name') || 'Hustler').trim() || 'Hustler';
    const hiddenPosts = JSON.parse(localStorage.getItem('yh_academy_hidden_posts') || '[]');

    const readinessValue =
        cachedHome?.roadmap?.readinessScore ??
        cachedHome?.readinessScore ??
        cachedHome?.summary?.readinessScore ??
        '--';

    const roadmapStatus =
        cachedHome?.roadmap?.status ||
        cachedHome?.roadmapStatus ||
        'Not loaded';

    const progressText =
        document.getElementById('progress-text')?.innerText ||
        '0% Daily Progress';

    const cachedFeed = JSON.parse(localStorage.getItem('yh_academy_feed_cache') || '{}');
    const cachedPosts = Array.isArray(cachedFeed?.posts) ? cachedFeed.posts : [];
    const myPosts = cachedPosts.filter((post) => {
        const postName =
            String(post?.display_name || post?.fullName || post?.username || '').trim().toLowerCase();
        return postName === displayName.toLowerCase();
    });

    const profileAvatar = document.getElementById('academy-profile-avatar');
    const profileName = document.getElementById('academy-profile-name');
    const profileUsername = document.getElementById('academy-profile-username');
    const profileRole = document.getElementById('academy-profile-role');
    const profileBio = document.getElementById('academy-profile-bio');
    const profileReadiness = document.getElementById('academy-profile-readiness');
    const profileProgress = document.getElementById('academy-profile-progress');
    const profileRoadmap = document.getElementById('academy-profile-roadmap');
    const profilePostCount = document.getElementById('academy-profile-post-count');
    const profileHiddenCount = document.getElementById('academy-profile-hidden-count');
    const profileStatus = document.getElementById('academy-profile-status');

    if (profileAvatar) {
        profileAvatar.innerText = displayName.charAt(0).toUpperCase();
        profileAvatar.style.backgroundImage = 'none';
    }

    if (profileName) profileName.innerText = displayName;
    if (profileUsername) profileUsername.innerText = `@${displayName.toLowerCase().replace(/\s+/g, '')}`;
    if (profileRole) profileRole.innerText = 'Academy Member';
    if (profileBio) profileBio.innerText = 'Focused on execution, consistency, and long-term growth inside YH Academy.';
    if (profileReadiness) profileReadiness.innerText = String(readinessValue);
    if (profileProgress) profileProgress.innerText = progressText.replace(' Daily Progress', '');
    if (profileRoadmap) profileRoadmap.innerText = String(roadmapStatus);
    if (profilePostCount) profilePostCount.innerText = String(myPosts.length);
    if (profileHiddenCount) profileHiddenCount.innerText = String(hiddenPosts.length);
    if (profileStatus) profileStatus.innerText = 'Active';
}

function openAcademyProfileView() {
    hideAcademyViewsForFeed();
    setAcademySidebarActive('nav-profile');

    const profileView = document.getElementById('academy-profile-view');
    if (profileView) {
        profileView.classList.remove('hidden-step');
        profileView.classList.remove('fade-in');
        void profileView.offsetWidth;
        profileView.classList.add('fade-in');
    }

    currentRoom = null;
    currentRoomId = null;
    currentRoomMeta = null;

    renderAcademyProfileView();
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
        const bodyHtml = academyFeedEscapeHtml(post.body || '').replace(/\n/g, '<br>');
        const imageHtml = post.image_url
            ? `<img src="${academyFeedEscapeHtml(post.image_url)}" alt="Post image" style="width:100%;max-width:100%;border-radius:14px;margin-top:12px;border:1px solid rgba(255,255,255,0.06);">`
            : '';


        const isOwner = Boolean(Number(post.owned_by_me || 0));
        const isSharedPost = /Shared from /i.test(String(post.body || ''));
        const hiddenPosts = readAcademyHiddenPostIds();
        const normalizedPostId = normalizeAcademyFeedId(post.id);

        if (hiddenPosts.includes(normalizedPostId)) {
            return '';
        }

        return `
            <article class="academy-feed-card academy-feed-post-compact" data-post-id="${post.id}" data-author-id="${post.user_id}">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    <div class="profile-avatar-mini" style="flex-shrink:0;width:36px;height:36px;font-size:0.9rem;">
                        ${(displayName || 'Y').charAt(0).toUpperCase()}
                    </div>

                    <div style="min-width:0;flex:1;">
                        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                            <div>
                                <div style="font-weight:700;color:#fff;line-height:1.15;">${academyFeedEscapeHtml(displayName)}</div>
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
                                    <button type="button" class="btn-secondary academy-feed-hide-btn" data-post-id="${post.id}" style="width:100%;padding:8px 10px;">Hide Post</button>
                                    ${
                                        isOwner
                                            ? `<button type="button" class="btn-secondary academy-feed-delete-btn" data-post-id="${post.id}" style="width:100%;padding:8px 10px;">${isSharedPost ? 'Delete Shared Post' : 'Delete Post'}</button>`
                                            : ``
                                    }
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:8px;color:#e5e7eb;line-height:1.45;font-size:0.92rem;">${bodyHtml}</div>
                        ${imageHtml}

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

    const bodyParts = [];

    if (cleanCaption) bodyParts.push(cleanCaption);
    bodyParts.push(`Shared from ${displayName} (${roleLabel})`);
    if (originalBody) bodyParts.push(`“${originalBody}”`);

    return {
        body: bodyParts.join(`\n\n`),
        imageUrl: String(post?.image_url || '').trim()
    };
}

let academyFeedDeleteTargetPostId = '';

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

function academyFeedOpenDeleteModal(postId) {
    academyFeedDeleteTargetPostId = normalizeAcademyFeedId(postId);
    if (!academyFeedDeleteTargetPostId) return;
    document.getElementById('academy-feed-delete-modal')?.classList.remove('hidden-step');
}

function academyFeedCloseDeleteModal() {
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
        const image = targetPost.image_url
            ? `<img src="${academyFeedEscapeHtml(targetPost.image_url)}" alt="Shared post image" class="academy-feed-share-preview-image">`
            : '';

        preview.innerHTML = `
            <div class="academy-feed-share-preview-author">${author}</div>
            <div class="academy-feed-share-preview-body">${body}</div>
            ${image}
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
async function academyFeedSubmitPost() {
    const input = document.getElementById('academy-feed-composer-input');
    const imageFileInput = document.getElementById('academy-feed-image-file');
    const imageDataInput = document.getElementById('academy-feed-image-data');
    const previewWrap = document.getElementById('academy-feed-image-preview-wrap');
    const previewImg = document.getElementById('academy-feed-image-preview');

    if (!input) return;

    const body = String(input.value || '').trim();
    const imageUrl = String(imageDataInput?.value || '').trim();

    if (!body) {
        showToast('Write something before posting.', 'error');
        return;
    }

    try {
        await academyAuthedFetch('/api/academy/feed/posts', {
            method: 'POST',
            body: JSON.stringify({
                body,
                imageUrl
            })
        });

        resetAcademyFeedComposer();
        showToast('Posted to YHA Community.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to create post.', 'error');
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

    showToast('Follow is temporarily disabled until realtime user migration is moved to Firestore.', 'error');
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

function setAcademySidebarActive(activeId = '') {
    document.querySelectorAll('.channel-link').forEach((link) => {
        link.classList.remove('active');
    });

    if (activeId) {
        document.getElementById(activeId)?.classList.add('active');
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
        leftSidebar.style.display = 'flex';
        rightSidebar.style.display = isTabletOrSmaller ? 'none' : 'flex';
        return;
    }

    academyWrapper.classList.remove('academy-mobile-shell');
}

function showUniverseHub(activeDivision = 'academy', options = {}) {
    const animate = options.animate !== false;

    hideDivisionViews();
    closeAcademyLauncher();

    if (universeHubView) {
        universeHubView.style.display = 'flex';
        universeHubView.classList.remove('fade-in');
        void universeHubView.offsetWidth;
        universeHubView.classList.add('fade-in');
    }

    if (leftSidebar) leftSidebar.style.display = 'none';
    if (rightSidebar) rightSidebar.style.display = 'none';

    setDashboardViewMode('hub');
    setUniverseSlide(activeDivision, { animate });
}

function enterAcademyWorld(defaultSection = 'home') {
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

    if (defaultSection === 'voice') {
        setAcademySidebarActive('nav-voice');
        openRoom('voice-lobby', document.getElementById('nav-voice'));
        return;
    }

    openAcademyRoadmapView();
}

window.enterAcademyWorld = enterAcademyWorld;

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
    const imageFileInput = document.getElementById('academy-feed-image-file');
    const imageDataInput = document.getElementById('academy-feed-image-data');
    const previewWrap = document.getElementById('academy-feed-image-preview-wrap');
    const previewImg = document.getElementById('academy-feed-image-preview');

    if (input) input.value = '';
    if (imageFileInput) imageFileInput.value = '';
    if (imageDataInput) imageDataInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewWrap) previewWrap.classList.add('hidden-step');
}

document.getElementById('academy-feed-refresh-btn')?.addEventListener('click', () => {
    loadAcademyFeed(true);
});

document.getElementById('academy-feed-upload-btn')?.addEventListener('click', () => {
    document.getElementById('academy-feed-image-file')?.click();
});

document.getElementById('academy-feed-image-file')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    const imageDataInput = document.getElementById('academy-feed-image-data');
    const previewWrap = document.getElementById('academy-feed-image-preview-wrap');
    const previewImg = document.getElementById('academy-feed-image-preview');

    if (!file) {
        if (imageDataInput) imageDataInput.value = '';
        if (previewImg) previewImg.src = '';
        if (previewWrap) previewWrap.classList.add('hidden-step');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (imageDataInput) imageDataInput.value = result;
        if (previewImg) previewImg.src = result;
        if (previewWrap) previewWrap.classList.remove('hidden-step');
    };
    reader.readAsDataURL(file);
});
document.getElementById('academy-feed-share-cancel')?.addEventListener('click', () => {
    document.getElementById('academy-feed-share-modal')?.classList.add('hidden-step');
});

document.getElementById('academy-feed-share-close')?.addEventListener('click', () => {
    document.getElementById('academy-feed-share-modal')?.classList.add('hidden-step');
});

document.getElementById('academy-feed-share-submit')?.addEventListener('click', async () => {
    const originalPost = window.__academySharePost;
    if (!originalPost) return;

    const caption = String(document.getElementById('academy-feed-share-caption')?.value || '').trim();
    const displayName =
        originalPost.display_name ||
        originalPost.fullName ||
        originalPost.username ||
        'Academy Member';

    const roleLabel = originalPost.role_label || 'Academy Member';
    const originalBody = String(originalPost.body || '').trim();

    const parts = [];
    if (caption) parts.push(caption);
    parts.push(`Shared from ${displayName} (${roleLabel})`);
    if (originalBody) parts.push(`“${originalBody}”`);

    try {
        await academyAuthedFetch('/api/academy/feed/posts', {
            method: 'POST',
            body: JSON.stringify({
                body: parts.join('\\n\\n'),
                imageUrl: String(originalPost.image_url || '').trim()
            })
        });

        document.getElementById('academy-feed-share-modal')?.classList.add('hidden-step');
        showToast('Post shared to community.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        showToast(error.message || 'Failed to share post.', 'error');
    }
});
document.getElementById('academy-feed-share-close')?.addEventListener('click', academyFeedCloseShareModal);
document.getElementById('academy-feed-share-cancel')?.addEventListener('click', academyFeedCloseShareModal);
document.getElementById('academy-feed-share-submit')?.addEventListener('click', academyFeedSubmitShare);

document.getElementById('academy-feed-share-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'academy-feed-share-modal') {
        academyFeedCloseShareModal();
    }
});

document.getElementById('academy-feed-list')?.addEventListener('click', async (event) => {
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

        showToast('Post hidden from your feed.', 'success');
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
});
const btnOpenApply = document.getElementById('btn-open-academy-apply');
const applyModal = document.getElementById('academy-apply-modal');
const closeApplyBtn = document.getElementById('close-academy-apply');

const roadmapModal = document.getElementById('academy-roadmap-modal');
const closeRoadmapBtn = document.getElementById('close-academy-roadmap');
const academyEntryWrap = btnOpenApply?.closest('.academy-entry-cta-wrap') || null;

const YH_POST_AUTH_APP_KEY = 'yh_force_academy_application_after_auth';
const YH_ROADMAP_PROFILE_KEY = 'yh_academy_roadmap_profile_v1';
const YH_ROADMAP_LOCK_KEY = 'yh_academy_roadmap_locked_v1';

function setDashboardButtonLoadingState(button, isLoading = false, loadingLabel = 'Loading...') {
    if (!button) return;

    const idleLabel = String(
        button.dataset.idleLabel ||
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
        button.textContent = loadingLabel;
        return;
    }

    button.dataset.loading = 'false';
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('aria-busy', 'false');
    button.style.cursor = 'pointer';
    button.style.opacity = '1';

    if (button.dataset.idleLabel) {
        button.textContent = button.dataset.idleLabel;
    }
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

    btnOpenApply.classList.remove('btn-secondary');
    btnOpenApply.setAttribute('type', 'button');
    btnOpenApply.style.width = '100%';
    btnOpenApply.style.minHeight = '52px';
    btnOpenApply.style.display = 'flex';
    btnOpenApply.style.alignItems = 'center';
    btnOpenApply.style.justifyContent = 'center';
    btnOpenApply.style.boxSizing = 'border-box';
    btnOpenApply.style.pointerEvents = 'auto';
    btnOpenApply.style.touchAction = 'manipulation';
    btnOpenApply.style.cursor = 'pointer';
    btnOpenApply.style.position = 'relative';
    btnOpenApply.style.zIndex = '2';
    btnOpenApply.style.webkitTapHighlightColor = 'transparent';

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
            stateBadge.textContent = 'Academy Access Approved';
            stateBadge.classList.remove('is-hidden');
            stateBadge.classList.add('is-approved');
        }
        return;
    }

    if (membershipStatus === 'under review' || membershipStatus === 'new') {
        btnOpenApply.dataset.idleLabel = 'Application Pending';
        btnOpenApply.dataset.loadingLabel = 'Checking status...';
        btnOpenApply.setAttribute('data-academy-state', 'pending');
        setDashboardButtonLoadingState(btnOpenApply, false);

        if (stateBadge) {
            stateBadge.textContent = 'Your Academy application is under review';
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

function openRoadmapIntake() {
    if (!roadmapModal) return;
    closeAcademyLauncher();
    roadmapModal.classList.remove('hidden-step');
    document.body?.classList.add('academy-launcher-open');
}

function closeRoadmapIntake() {
    if (!roadmapModal) return;
    roadmapModal.classList.add('hidden-step');
    document.body?.classList.remove('academy-launcher-open');
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
    const membershipSnapshot = await refreshAcademyMembershipStatus(true);

    const membershipStatus = String(
        membershipSnapshot?.applicationStatus || ''
    ).trim().toLowerCase();

    const hasRoadmapAccess = membershipSnapshot?.hasRoadmapAccess === true;

    closeRoadmapIntake();

    if (membershipStatus !== 'approved') {
        openAcademyRoadmapAccessGate(membershipSnapshot);
        return;
    }

    if (hasRoadmapAccess) {
        openAcademyRoadmapView(true);
        return;
    }

    openRoadmapIntake();
}
function stopAcademyMembershipRealtimeSync() {
    if (academyMembershipRealtimeTimer) {
        clearInterval(academyMembershipRealtimeTimer);
        academyMembershipRealtimeTimer = null;
    }
}

function startAcademyMembershipRealtimeSync() {
    if (academyMembershipRealtimeTimer) return;

    academyMembershipRealtimeTimer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        if (!localStorage.getItem('yh_token')) return;
        refreshAcademyMembershipStatus(true).catch(() => {});
    }, 5000);
}

window.addEventListener('focus', () => {
    refreshAcademyMembershipStatus(true).catch(() => {});
});

window.addEventListener('pageshow', () => {
    refreshAcademyMembershipStatus(true).catch(() => {});
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        refreshAcademyMembershipStatus(true).catch(() => {});
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
    const chatInputArea = document.getElementById('chat-input-area');
    const dynamicChatContainer = document.getElementById('dynamic-chat-history');

    if (chatHeaderIcon) chatHeaderIcon.innerHTML = '🧠';
    if (chatHeaderTitle) chatHeaderTitle.innerText = 'Roadmap Setup';
    if (chatHeaderTopic) chatHeaderTopic.innerText = 'Complete the roadmap form to let the AI generate your personalized roadmap instantly.';
    if (chatWelcomeBox) chatWelcomeBox.style.display = 'none';
    if (chatPinnedMessage) chatPinnedMessage.style.display = 'none';
    if (chatInputArea) chatInputArea.style.display = 'none';

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

    document.getElementById('academy-roadmap-apply-access-btn')?.addEventListener('click', () => {
        openRoadmapIntake();
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
        verdictBtn.innerText = 'Open YH Academy ➔';
        verdictBtn.onclick = null;
    }
}

function openAcademyLauncher() {
    if (!applyModal) return;
    resetAcademyLauncherState();
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
                writeYhAdminPanelState({
                    ...readYhAdminPanelState(),
                    applications: [
                        snapshot.application,
                        ...(Array.isArray(readYhAdminPanelState()?.applications)
                            ? readYhAdminPanelState().applications.filter(app => app?.id !== snapshot.application.id)
                            : [])
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
                    showToast('Academy approved. You can now enter.', 'success');
                } else if (nextStatus === 'waitlisted') {
                    showToast('Your Academy application is now waitlisted.', 'error');
                } else if (nextStatus === 'rejected') {
                    showToast('Your Academy application has been reviewed.', 'error');
                }
            }

            return snapshot;
        } catch (_) {
            const fallback = cached || {
                hasApplication: false,
                applicationStatus: '',
                hasRoadmapAccess: false,
                canEnterAcademy: false,
                application: null,
                roadmapApplication: null,
                roadmapApplicationStatus: ''
            };

            syncAcademyEntryButton(fallback);
            syncRoadmapTabIndicator(fallback);
            return fallback;
        } finally {
            academyMembershipRefreshPromise = null;
        }
    })();

    return academyMembershipRefreshPromise;
}
function getCurrentAcademyApplicantIdentity() {
    return {
        name: String(localStorage.getItem('yh_user_name') || 'Hustler').trim(),
        username: String(localStorage.getItem('yh_user_username') || '').trim(),
        email: String(localStorage.getItem('yh_user_email') || '').trim().toLowerCase()
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

    const profileSummary = [
        payload.proofWork || '',
        payload.sacrifice || '',
        payload.nonNegotiable || ''
    ].filter(Boolean).join(' • ');

    const nextRecord = {
        id: persisted?.id || existing?.id || `APP-${Date.now().toString().slice(-6)}`,
        name: persisted?.name || identity.name || 'Hustler',
        username: persisted?.username || identity.username || '',
        email: persisted?.email || identity.email || '',
        goal: persisted?.goal || payload.mainGoal || payload.whyNow || 'Academy membership application',
        background: persisted?.background || profileSummary || 'No seriousness summary submitted.',
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
        country: persisted?.country || '',
        skills: Array.isArray(persisted?.skills) && persisted.skills.length
            ? persisted.skills
            : [
                payload.seriousness || '',
                payload.weeklyHours || '',
                payload.nonNegotiable || ''
            ].filter(Boolean),
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
                : payload
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
let academySuppressClickUntil = 0;

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

    const membershipSnapshot = await refreshAcademyMembershipStatus(true);

    const membershipStatus = String(
        membershipSnapshot?.applicationStatus || ''
    ).trim().toLowerCase();

    syncAcademyEntryButton(membershipSnapshot);

    if (membershipStatus === 'approved') {
        showToast('Academy membership approved. Opening Community Feed.', 'success');
        enterAcademyWorld('community');
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
}
window.handleAcademyLaunchClick = handleAcademyLaunchClick;

let academyLaunchLock = false;

async function runAcademyLaunch(event) {
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
            setTimeout(() => {
                setDashboardButtonLoadingState(btnOpenApply, false);
            }, 160);
        });
    }
}

function bindAcademyLaunchTarget(target) {
    if (!target || target.dataset.launchBound === 'true') return;

    target.dataset.launchBound = 'true';
    target.style.pointerEvents = 'auto';
    target.style.touchAction = 'manipulation';

    const stopTapConflict = (event) => {
        event.stopPropagation?.();
    };

    target.addEventListener('touchstart', stopTapConflict, { passive: true });
    target.addEventListener('pointerdown', stopTapConflict);
    target.addEventListener('mousedown', stopTapConflict);

    target.addEventListener('touchend', runAcademyLaunch, { passive: false });
    target.addEventListener('pointerup', runAcademyLaunch);
    target.addEventListener('mouseup', runAcademyLaunch);
    target.addEventListener('click', runAcademyLaunch);

    target.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            runAcademyLaunch(event);
        }
    });
}

if (academyEntryWrap) {
    academyEntryWrap.style.width = '100%';
    academyEntryWrap.style.pointerEvents = 'auto';
    academyEntryWrap.style.position = 'relative';
    academyEntryWrap.style.zIndex = '3';
    bindAcademyLaunchTarget(academyEntryWrap);
}

if (btnOpenApply) {
    btnOpenApply.setAttribute('type', 'button');
    btnOpenApply.style.pointerEvents = 'auto';
    btnOpenApply.style.touchAction = 'manipulation';
    btnOpenApply.style.width = '100%';
    btnOpenApply.style.minHeight = '52px';
    btnOpenApply.style.webkitTapHighlightColor = 'transparent';
    bindAcademyLaunchTarget(btnOpenApply);
}

document.addEventListener('pointerup', async (event) => {
    const academyBtn = event.target.closest('#btn-open-academy-apply');
    if (!academyBtn) return;

    event.preventDefault();
    event.stopPropagation();
    await runAcademyLaunch(event);
}, true);
closeApplyBtn?.addEventListener('click', closeAcademyLauncher);

document.getElementById('academy-feed-delete-cancel-btn')?.addEventListener('click', academyFeedCloseDeleteModal);

document.getElementById('academy-feed-delete-confirm-btn')?.addEventListener('click', async () => {
    const postId = normalizeAcademyFeedId(academyFeedDeleteTargetPostId);
    if (!postId) return;

    try {
        await academyAuthedFetch(`/api/academy/feed/posts/${postId}`, {
            method: 'DELETE'
        });

        academyFeedCloseDeleteModal();
        showToast('Post deleted successfully.', 'success');
        loadAcademyFeed(true);
    } catch (error) {
        academyFeedCloseDeleteModal();
        showToast(error.message || 'Delete endpoint is not wired yet.', 'error');
    }
});

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

// always land on dashboard hub first
setDashboardViewMode('hub');

if (academyWrapper) academyWrapper.style.display = 'none';
if (leftSidebar) leftSidebar.style.display = 'none';
if (rightSidebar) rightSidebar.style.display = 'none';
if (universeHubView) universeHubView.style.display = 'flex';

syncUniverseFeaturePanel('academy');
setUniverseSlide('academy', { animate: false });

const formApply = document.getElementById('form-academy-apply');
function syncAcademyOccupationField() {
    // Academy membership form is now seriousness-based.
    // No occupation/job field remapping is needed here anymore.
}
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

        const token = localStorage.getItem('yh_token');
        if (!token) {
            showToast("Your session expired. Please log in again.", "error");
            window.location.href = '/';
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

const payload = {
    whyNow: document.getElementById('app-why-now')?.value?.trim() || '',
    mainGoal: document.getElementById('app-main-goal')?.value?.trim() || '',
    proofWork: document.getElementById('app-proof-work')?.value?.trim() || '',
    sacrifice: document.getElementById('app-sacrifice')?.value?.trim() || '',
    seriousness: document.getElementById('app-seriousness')?.value?.trim() || '',
    weeklyHours: document.getElementById('app-hours')?.value?.trim() || '',
    nonNegotiable: document.getElementById('app-nonnegotiable')?.value?.trim() || '',
    adminNote: document.getElementById('app-admin-note')?.value?.trim() || ''
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
            syncAcademyOccupationField();
        } catch (error) {
            aiSpinnerPhase?.classList.add('hidden-step');
            aiFormPhase?.classList.remove('hidden-step');
            showToast("Failed to submit Academy application.", "error");
        }
    });
}

const roadmapForm = document.getElementById('form-academy-roadmap');

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

if (roadmapForm) {
    roadmapForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (hasRoadmapIntakeAlreadyBeenFilled()) {
            showToast('Roadmap setup has already been completed.', 'error');
            closeRoadmapIntake();
            return;
        }

        const submitBtn = document.getElementById('btn-submit-roadmap-intake');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Creating Roadmap...';
        }

        const payload = {
            focusArea: document.getElementById('roadmap-focus-area')?.value?.trim() || '',
            currentLevel: document.getElementById('roadmap-current-level')?.value?.trim() || '',
            target30Days: document.getElementById('roadmap-target-30')?.value?.trim() || '',
            dailyMinutes: document.getElementById('roadmap-daily-minutes')?.value?.trim() || '',
            weeklyHours: document.getElementById('roadmap-weekly-hours')?.value?.trim() || '',
            sleepHours: document.getElementById('roadmap-sleep-hours')?.value?.trim() || '',
            energyScore: document.getElementById('roadmap-energy-score')?.value?.trim() || '',
            stressScore: document.getElementById('roadmap-stress-score')?.value?.trim() || '',
            badHabit: document.getElementById('roadmap-bad-habit')?.value?.trim() || '',
            blockerText: document.getElementById('roadmap-blocker-text')?.value?.trim() || '',
            coachTone: document.getElementById('roadmap-coach-tone')?.value?.trim() || 'balanced',
            firstQuickWin: document.getElementById('roadmap-first-win')?.value?.trim() || '',
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
                submitBtn.innerText = 'Submit Roadmap Request ➔';
            }
        }
    });
}

    });
