// public/js/yh-shared-runtime.js
(function () {
    const {
        getStoredAuthToken,
        showToast
    } = window.YHSharedCore || {};

    const YH_DASHBOARD_VIEW_STATE_KEY = 'yh_dashboard_view_state_v1';
    const YH_TAB_LOADER_MIN_MS = 240;

    let yhTabLoaderDepth = 0;
    let yhTabLoaderVisibleAt = 0;
    let yhTabLoaderHideTimer = null;

    function showAcademyTabLoader(label = 'Loading.') {
        const overlay = document.getElementById('yh-tab-loader');
        if (!overlay) return;

        const text = document.getElementById('yh-tab-loader-text');
        if (text) text.textContent = String(label || 'Loading.');

        yhTabLoaderDepth += 1;

        if (yhTabLoaderHideTimer) {
            clearTimeout(yhTabLoaderHideTimer);
            yhTabLoaderHideTimer = null;
        }

        if (overlay.classList.contains('is-active')) {
            return;
        }

        overlay.classList.remove('hidden-step');
        void overlay.offsetWidth;
        overlay.classList.add('is-active');
        yhTabLoaderVisibleAt = Date.now();
    }

    function hideAcademyTabLoader() {
        const overlay = document.getElementById('yh-tab-loader');
        if (!overlay) return;

        yhTabLoaderDepth = Math.max(0, yhTabLoaderDepth - 1);
        if (yhTabLoaderDepth !== 0) return;

        const elapsed = Date.now() - (yhTabLoaderVisibleAt || 0);
        const delay = Math.max(0, YH_TAB_LOADER_MIN_MS - elapsed);

        if (yhTabLoaderHideTimer) clearTimeout(yhTabLoaderHideTimer);

        yhTabLoaderHideTimer = setTimeout(() => {
            overlay.classList.remove('is-active');
            setTimeout(() => overlay.classList.add('hidden-step'), 180);
        }, delay);
    }

    function readDashboardViewState() {
        try {
            const raw = localStorage.getItem(YH_DASHBOARD_VIEW_STATE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || typeof parsed !== 'object') throw new Error('bad state');

            const view = parsed.view === 'academy' ? 'academy' : 'hub';
            const division = ['academy', 'plazas', 'federation'].includes(parsed.division) ? parsed.division : 'academy';

            const sectionRaw = String(parsed.academySection || 'home').toLowerCase().trim();
            const academySection = ['home', 'community', 'voice', 'video', 'profile'].includes(sectionRaw) ? sectionRaw : 'home';

            return { view, division, academySection };
        } catch (_) {
            return { view: 'hub', division: 'academy', academySection: 'home' };
        }
    }

    function writeDashboardViewState(next = {}) {
        const base = readDashboardViewState();
        const merged = {
            ...base,
            ...(next && typeof next === 'object' ? next : {})
        };

        const finalState = {
            view: merged.view === 'academy' ? 'academy' : 'hub',
            division: ['academy', 'plazas', 'federation'].includes(merged.division) ? merged.division : 'academy',
            academySection: ['home', 'community', 'voice', 'video', 'profile'].includes(String(merged.academySection || '').toLowerCase())
                ? String(merged.academySection).toLowerCase()
                : 'home',
            updatedAt: Date.now()
        };

        localStorage.setItem(YH_DASHBOARD_VIEW_STATE_KEY, JSON.stringify(finalState));
        return finalState;
    }

    function saveUniverseViewState(division = 'academy') {
        return writeDashboardViewState({ view: 'hub', division });
    }

    function saveAcademyViewState(section = 'home') {
        return writeDashboardViewState({ view: 'academy', division: 'academy', academySection: section });
    }

    async function academyAuthedFetch(url, options = {}) {
        const token = typeof getStoredAuthToken === 'function' ? getStoredAuthToken() : '';

        const headers = {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
            if (typeof showToast === 'function') {
                showToast('Your session expired. Please log in again.', 'error');
            }
            window.location.href = '/';
            throw new Error(result.message || 'Session expired.');
        }

        if (response.status === 400) {
            throw new Error(result.message || 'Request failed.');
        }

        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Request failed.');
        }

        return result;
    }

    function normalizeRoomKey(value) {
        return String(value ?? '').trim();
    }

    function getDashboardState() {
        return window.dashboardState || window.yhDashboardState || (window.dashboardState = {});
    }

    function getIncomingRoomId(msg) {
        const roomId = msg?.roomId || msg?.room || msg?.roomName || null;
        return roomId ? normalizeRoomKey(roomId) : null;
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

    function syncCustomRoomsUI(rooms = [], deps = {}) {
        const state = getDashboardState();

        const normalizeFn =
            typeof deps.normalizeCustomRoomForRender === 'function'
                ? deps.normalizeCustomRoomForRender
                : (typeof window.normalizeCustomRoomForRender === 'function'
                    ? window.normalizeCustomRoomForRender
                    : null);

        const normalizedRooms = (Array.isArray(rooms) ? rooms : [])
            .map((room, index) => {
                if (normalizeFn) {
                    return normalizeFn(room, index);
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

        const renderCustomRoomsFn =
            typeof deps.renderCustomRooms === 'function'
                ? deps.renderCustomRooms
                : window.renderCustomRooms;

        const renderChatboxRoomsFn =
            typeof deps.renderChatboxRooms === 'function'
                ? deps.renderChatboxRooms
                : window.renderChatboxRooms;

        const syncCustomRoomNotificationsFn =
            typeof deps.syncCustomRoomNotifications === 'function'
                ? deps.syncCustomRoomNotifications
                : window.syncCustomRoomNotifications;

        const updateCustomRoomUnreadBadgesFn =
            typeof deps.updateCustomRoomUnreadBadges === 'function'
                ? deps.updateCustomRoomUnreadBadges
                : window.updateCustomRoomUnreadBadges;

        if (typeof renderCustomRoomsFn === 'function') {
            renderCustomRoomsFn(normalizedRooms);
        }

        if (typeof renderChatboxRoomsFn === 'function') {
            renderChatboxRoomsFn(normalizedRooms);
        }

        if (typeof syncCustomRoomNotificationsFn === 'function') {
            syncCustomRoomNotificationsFn(normalizedRooms);
        }

        if (typeof updateCustomRoomUnreadBadgesFn === 'function') {
            updateCustomRoomUnreadBadgesFn(normalizedRooms);
        }

        return normalizedRooms;
    }

    function markCustomRoomAsRead(roomId, deps = {}) {
        const normalizedRoomId = normalizeRoomKey(roomId);
        if (!normalizedRoomId || normalizedRoomId === 'YH-community') return;

        const state = getDashboardState();
        const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];
        const normalizeFn =
            typeof deps.normalizeCustomRoomForRender === 'function'
                ? deps.normalizeCustomRoomForRender
                : (typeof window.normalizeCustomRoomForRender === 'function'
                    ? window.normalizeCustomRoomForRender
                    : null);

        let changed = false;

        const nextRooms = currentRooms.map((room, index) => {
            const normalizedRoom = normalizeFn ? normalizeFn(room, index) : room;

            const existingRoomId = normalizeRoomKey(
                normalizedRoom?.id || normalizedRoom?.roomId || normalizedRoom?.room_id
            );

            if (existingRoomId !== normalizedRoomId) return normalizedRoom;

            const currentUnread = Number(normalizedRoom?.unreadCount || normalizedRoom?.unread_count || 0);
            if (currentUnread === 0) return normalizedRoom;

            changed = true;

            return normalizeFn
                ? normalizeFn({
                    ...normalizedRoom,
                    unreadCount: 0
                }, index)
                : {
                    ...normalizedRoom,
                    unreadCount: 0
                };
        });

        if (changed) {
            syncCustomRoomsUI(nextRooms, deps);
        }
    }

    function touchCustomRoomFromMessage(msg, options = {}, deps = {}) {
        const getIncomingRoomIdFn =
            typeof deps.getIncomingRoomId === 'function'
                ? deps.getIncomingRoomId
                : getIncomingRoomId;

        const roomId = getIncomingRoomIdFn(msg);
        if (!roomId || roomId === 'YH-community') return null;

        const state = getDashboardState();
        const currentRooms = Array.isArray(state.customRooms) ? state.customRooms : [];

        const normalizeFn =
            typeof deps.normalizeCustomRoomForRender === 'function'
                ? deps.normalizeCustomRoomForRender
                : (typeof window.normalizeCustomRoomForRender === 'function'
                    ? window.normalizeCustomRoomForRender
                    : null);

        const moveToTopFn =
            typeof deps.moveCustomRoomToTop === 'function'
                ? deps.moveCustomRoomToTop
                : moveCustomRoomToTop;

        const currentRoomMeta = deps.currentRoomMeta || null;

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
            const normalizedRoom = normalizeFn ? normalizeFn(room, index) : room;

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

            return normalizeFn
                ? normalizeFn(touchedRoom, index)
                : touchedRoom;
        });

        if (!found && options.createIfMissing) {
            touchedRoom = normalizeFn
                ? normalizeFn({
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

        const reorderedRooms = moveToTopFn(nextRooms, roomId);
        syncCustomRoomsUI(reorderedRooms, deps);

        return touchedRoom;
    }

    function getActiveRoomId(deps = {}) {
        const currentRoomMeta = deps.currentRoomMeta || null;
        const currentRoomId = deps.currentRoomId ?? null;
        const currentRoom = deps.currentRoom ?? null;

        const roomId = currentRoomMeta?.roomId || currentRoomId || currentRoom || null;
        return roomId ? normalizeRoomKey(roomId) : null;
    }

    function getActiveRoomLabel(deps = {}) {
        const currentRoomMeta = deps.currentRoomMeta || null;
        const currentRoomId = deps.currentRoomId ?? null;
        const currentRoom = deps.currentRoom ?? null;

        return currentRoomMeta?.name || currentRoom || currentRoomId || 'this room';
    }

    function isMessageForActiveRoom(msg, deps = {}) {
        const getIncomingRoomIdFn =
            typeof deps.getIncomingRoomId === 'function'
                ? deps.getIncomingRoomId
                : getIncomingRoomId;

        const getActiveRoomIdFn =
            typeof deps.getActiveRoomId === 'function'
                ? deps.getActiveRoomId
                : getActiveRoomId;

        const incomingRoomId = getIncomingRoomIdFn(msg);
        const activeRoomId = getActiveRoomIdFn(deps);

        if (!incomingRoomId || !activeRoomId) return false;
        return incomingRoomId === activeRoomId;
    }

    function setActiveCustomRoomState(room = null, deps = {}) {
        const getDashboardStateFn =
            typeof deps.getDashboardState === 'function'
                ? deps.getDashboardState
                : getDashboardState;

        const normalizeRoomKeyFn =
            typeof deps.normalizeRoomKey === 'function'
                ? deps.normalizeRoomKey
                : normalizeRoomKey;

        const state = getDashboardStateFn();
        const roomId = normalizeRoomKeyFn(room?.id || room?.roomId || room?.room_id);

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

    const api = {
        YH_DASHBOARD_VIEW_STATE_KEY,
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
        syncCustomRoomsUI,
        markCustomRoomAsRead,
        touchCustomRoomFromMessage,
        getActiveRoomId,
        getActiveRoomLabel,
        isMessageForActiveRoom,
        setActiveCustomRoomState
    };

    window.YHSharedRuntime = api;
})();