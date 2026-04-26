// public/js/apply.js

function showStep(stepNumber) {
    document.querySelectorAll('.step-container').forEach(el => { el.classList.add('hidden-step'); });
    const targetStep = document.getElementById(`step-${stepNumber}`);
    if(targetStep) {
        targetStep.classList.remove('hidden-step');
        targetStep.classList.remove('fade-in');
        void targetStep.offsetWidth;
        targetStep.classList.add('fade-in');
    }
}

const yhT = (key, options = {}) => {
    if (typeof window.yhT === 'function') {
        return window.yhT(key, options);
    }

    const fallbackMap = {
        'auth.login': 'Login',
        'auth.loading': 'Logging in...',
        'auth.createAccount': 'Create Account',
        'auth.creatingAccount': 'Creating Account...',
        'auth.resendCode': 'Resend Code',
        'auth.sending': 'Sending...',
        'auth.saving': 'Saving...',
        'auth.resendIn': `Resend in ${options?.time || '00:00'}`,
        'auth.verifying': 'Verifying...',
        'auth.verifyCode': 'Verify Code',
        'auth.verifyEnter': 'Verify & Enter Universe ➔',
        'auth.sendRecoveryCode': 'Send Recovery Code',
        'auth.saveNewPassword': 'Save New Password ➔',
        'auth.show': 'Show',
        'auth.hide': 'Hide',
        'auth.choosePhoto': 'Choose profile photo'
    };

    return fallbackMap[key] || key;
};

const yhTText = (text, options = {}) => (
    typeof window.yhTText === 'function' ? window.yhTText(text, options) : text
);

function showToast(message, type = "success") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg || !toastIcon) return;

    const isError = String(type || '').toLowerCase() === 'error';

    toast.classList.toggle('error-toast', isError);
    toast.classList.toggle('success-toast', !isError);

    toastMsg.textContent = yhTText(message);
    toastIcon.textContent = isError ? '⚠️' : '✓';

    Object.assign(toast.style, {
        position: 'fixed',
        left: '50%',
        right: 'auto',
        top: '50%',
        bottom: 'auto',
        zIndex: '12000',
        width: 'max-content',
        inlineSize: 'max-content',
        maxWidth: 'min(calc(100vw - 32px), 360px)',
        minWidth: '0',
        padding: '7px 11px',
        borderRadius: '999px',
        fontSize: '0.82rem',
        lineHeight: '1.15',
        textAlign: 'center',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        wordBreak: 'normal',
        overflowWrap: 'normal',
        overflow: 'hidden',
        pointerEvents: 'auto',
        visibility: 'visible',
        opacity: '0',
        transform: 'translate(-50%, -50%) scale(0.96)'
    });

    Object.assign(toastMsg.style, {
        display: 'inline-block',
        width: 'auto',
        minWidth: '0',
        maxWidth: 'min(calc(100vw - 74px), 290px)',
        lineHeight: '1.15',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        overflowWrap: 'normal',
        wordBreak: 'normal',
        textOverflow: 'ellipsis',
        textAlign: 'center'
    });

    Object.assign(toastIcon.style, {
        display: 'inline-grid',
        placeItems: 'center',
        width: '14px',
        minWidth: '14px',
        maxWidth: '14px',
        height: '14px',
        lineHeight: '1',
        flex: '0 0 14px',
        fontSize: '0.8rem'
    });

    toast.classList.remove('show');
    void toast.offsetWidth;

    toast.classList.add('show');
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    clearTimeout(window.__yhToastTimer);
    window.__yhToastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -50%) scale(0.96)';
        toast.style.pointerEvents = 'none';

        window.setTimeout(() => {
            if (!toast.classList.contains('show')) {
                toast.style.visibility = 'hidden';
            }
        }, 240);
    }, 3000);
}
const YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY = 'yh_post_login_dashboard_bootstrap_v1';

function showPostLoginTransitionLoader(label = 'Syncing your access and preparing your dashboard...') {
    const loader = document.getElementById('yh-post-login-loader');
    const text = document.getElementById('yh-post-login-loader-text');

    if (text) {
        text.textContent = String(label || 'Syncing your access and preparing your dashboard...');
    }

    if (!loader) return;

    loader.classList.remove('hidden-step');
    loader.setAttribute('aria-hidden', 'false');
}
function clearAcademyClientStateForFreshAuth() {
    const keysToClear = [
        'yh_academy_access',
        'yh_academy_home',
        'yh_academy_membership_status_v1',
        'yh_academy_application_profile',
        'yh_academy_roadmap_profile_v1',
        'yh_academy_roadmap_locked_v1',
        'yh_admin_panel_state_v2',
        'yh_admin_panel_state_v3_live',
        'yh_force_academy_application_after_auth',

        // clear old auth/user session artifacts so account switching does not leak old identity
        'yh_user_loggedIn',
        'yh_user_name',
        'yh_user_username',
        'yh_user_email',
        'yh_user_avatar',
        'yh_user_first_name',
        'yh_user_firstname',
        'yh_user_surname',
        'yh_user_last_name',
        'yh_user_lastname',
        'yh_user_city',
        'yh_user_location_city',
        'yh_user_country',
        'yh_user_country_of_residence',
        'yh_user_location_country',
        'yh_token',
        'token',
        'yh_pending_verify_email'
    ];

    [localStorage, sessionStorage].forEach((store) => {
        keysToClear.forEach((key) => store.removeItem(key));
    });
}

function persistClientSession(user, token) {
    const fullName = String(
        user?.fullName ||
        user?.name ||
        user?.displayName ||
        user?.username ||
        'Hustler'
    ).trim();

    const nameParts = fullName.split(/\s+/).filter(Boolean);

    const firstName = String(
        user?.firstName ||
        user?.firstname ||
        nameParts[0] ||
        ''
    ).trim();

    const surname = String(
        user?.surname ||
        user?.lastName ||
        user?.lastname ||
        (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')
    ).trim();

    const username = String(user?.username || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();

    const email = String(user?.email || '').trim().toLowerCase();
    const city = String(user?.city || '').trim();
    const country = String(user?.country || '').trim();
    const locationCountry = [city, country].filter(Boolean).join(', ') || country;

    const pendingAvatar = String(
        sessionStorage.getItem('yh_pending_profile_avatar') ||
        localStorage.getItem('yh_pending_profile_avatar') ||
        ''
    ).trim();

    const avatar = String(
        user?.avatar ||
        user?.profilePhoto ||
        user?.photoURL ||
        user?.profilePhotoDataUrl ||
        pendingAvatar ||
        ''
    ).trim();

    const authToken = String(token || '').trim();

    [sessionStorage, localStorage].forEach((store) => {
        store.setItem('yh_user_loggedIn', 'true');
        store.setItem('yh_user_name', fullName);
        store.setItem('yh_user_username', username);
        store.setItem('yh_user_email', email);
        store.setItem('yh_token', authToken);
        store.setItem('token', authToken);

        if (firstName) {
            store.setItem('yh_user_first_name', firstName);
            store.setItem('yh_user_firstname', firstName);
        } else {
            store.removeItem('yh_user_first_name');
            store.removeItem('yh_user_firstname');
        }

        if (surname) {
            store.setItem('yh_user_surname', surname);
            store.setItem('yh_user_last_name', surname);
            store.setItem('yh_user_lastname', surname);
        } else {
            store.removeItem('yh_user_surname');
            store.removeItem('yh_user_last_name');
            store.removeItem('yh_user_lastname');
        }

        if (city) {
            store.setItem('yh_user_city', city);
            store.setItem('yh_user_location_city', city);
        } else {
            store.removeItem('yh_user_city');
            store.removeItem('yh_user_location_city');
        }

        if (country) {
            store.setItem('yh_user_country', country);
            store.setItem('yh_user_country_of_residence', country);
            store.setItem('yh_user_location_country', country);
        } else {
            store.removeItem('yh_user_country');
            store.removeItem('yh_user_country_of_residence');
            store.removeItem('yh_user_location_country');
        }

        if (locationCountry) {
            store.setItem('yh_user_location_country', locationCountry);
        }

        if (avatar) {
            store.setItem('yh_user_avatar', avatar);
        } else {
            store.removeItem('yh_user_avatar');
        }

        store.removeItem('yh_pending_profile_avatar');
    });
}

const YH_LANDING_FEED_DEFAULTS = [
    {
        id: 'academy_live_placeholder_1',
        pointId: '',
        label: 'Universe Live Activity',
        feedText: 'Waiting for new Universe activity.',
        locationText: '',
        createdAt: ''
    },
    {
        id: 'academy_live_placeholder_2',
        pointId: '',
        label: 'Universe Growth',
        feedText: 'Real Universe events will appear here as they happen.',
        locationText: '',
        createdAt: ''
    },
    {
        id: 'academy_live_placeholder_3',
        pointId: '',
        label: 'Worldmap Sync',
        feedText: 'Each new signup and action can light up its real city and country.',
        locationText: '',
        createdAt: ''
    }
];

const YH_LANDING_MAP_POINTS = [];
const YH_LANDING_MAP_ARCS = [];

let yhLandingPublicFeedTimer = null;
let yhLandingMapInstance = null;
let yhLandingMapSpinRaf = null;
let yhLandingCloudsMesh = null;
let yhLandingResizeBound = false;
let yhLandingLastFocusPointKey = '';
let yhLandingLiveFeedState = YH_LANDING_FEED_DEFAULTS.map((item) => ({ ...item }));

let yhLandingGlobeData = {
    points: [...YH_LANDING_MAP_POINTS],
    arcs: [...YH_LANDING_MAP_ARCS]
};

function animateLandingStat(el, target, duration = 1200) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();

    const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(start + ((target - start) * eased));
        el.textContent = value.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    };

    requestAnimationFrame(tick);
}

function escapeLandingHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatLandingEventMeta(event = {}) {
    const location = String(
        event.locationText ||
        [event.city, event.country].filter(Boolean).join(', ')
    ).trim();

    const rawDate = String(event.createdAt || '').trim();
    let timeText = '';

    if (rawDate) {
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
            timeText = parsed.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    }

    return [location, timeText].filter(Boolean).join(' • ') || 'Academy live sync';
}

function focusLandingFeedEvent(pointId = '') {
    const normalizedId = String(pointId || '').trim();
    if (!normalizedId) return;

    const point = Array.isArray(yhLandingGlobeData.points)
        ? yhLandingGlobeData.points.find((item) => String(item.id || '').trim() === normalizedId)
        : null;

    if (point) {
        focusLandingGlobePoint(point);
    }
}

function renderLandingFeedSections() {
    const streamEl = document.getElementById('yh-landing-activity-stream');
    if (!streamEl) return;

    const items =
        Array.isArray(yhLandingLiveFeedState) && yhLandingLiveFeedState.length
            ? yhLandingLiveFeedState
            : YH_LANDING_FEED_DEFAULTS;

    streamEl.innerHTML = items.map((item, index) => {
        const pointId = String(item.pointId || item.id || '').trim();
        const label = escapeLandingHtml(item.label || 'Academy Activity');
        const feedText = escapeLandingHtml(item.feedText || 'Academy activity.');
        const meta = escapeLandingHtml(formatLandingEventMeta(item));

        return `
            <button
                type="button"
                class="yh-landing-activity-event${index === 0 ? ' is-active' : ''}"
                data-point-id="${escapeLandingHtml(pointId)}"
            >
                <span class="yh-landing-activity-label">${label}</span>
                <strong>${feedText}</strong>
                <span class="yh-landing-activity-meta">${meta}</span>
            </button>
        `;
    }).join('');

    streamEl.querySelectorAll('.yh-landing-activity-event').forEach((button) => {
        button.addEventListener('click', () => {
            focusLandingFeedEvent(button.dataset.pointId || '');
        });
    });
}

function applyLandingFeedSnapshot(events = []) {
    const normalized = (Array.isArray(events) ? events : [])
        .map((item, index) => ({
            id: String(item.id || `academy_live_event_${index + 1}`).trim(),
            pointId: String(item.pointId || item.id || '').trim(),
            label: String(item.label || 'Academy Activity').trim(),
            feedText: String(item.feedText || item.message || 'Academy activity.').trim(),
            locationText: String(item.locationText || '').trim(),
            city: String(item.city || '').trim(),
            country: String(item.country || '').trim(),
            createdAt: String(item.createdAt || '').trim()
        }))
        .filter((item) => item.feedText)
        .slice(0, 6);

    yhLandingLiveFeedState = normalized.length
        ? normalized
        : YH_LANDING_FEED_DEFAULTS.map((item) => ({ ...item }));

    renderLandingFeedSections();
}

function focusLandingGlobePoint(point = null) {
    if (!point || !yhLandingMapInstance || typeof yhLandingMapInstance.pointOfView !== 'function') {
        return;
    }

    const lat = Number(point.lat);
    const lng = Number(point.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
    }

    const focusKey =
        String(point.id || '').trim() ||
        `${lat}:${lng}:${String(point.label || '').trim()}`;

    if (focusKey && focusKey === yhLandingLastFocusPointKey) {
        return;
    }

    yhLandingLastFocusPointKey = focusKey;

    yhLandingMapInstance.pointOfView(
        {
            lat,
            lng,
            altitude: 2.44
        },
        1600
    );
}

function applyLandingServerSnapshot(result = {}) {
    applyLandingFeedSnapshot(
        Array.isArray(result.liveEvents)
            ? result.liveEvents
            : Array.isArray(result.academyEvents)
                ? result.academyEvents
                : []
    );

    window.yhSetLandingGlobeData({
        points: Array.isArray(result.points) ? result.points : [],
        arcs: Array.isArray(result.arcs) ? result.arcs : [],
        focusPoint: result.focusPoint || null,
        stats: result.stats && typeof result.stats === 'object' ? result.stats : null
    });
}

let yhLandingRealtimeSocket = null;
let yhLandingRealtimeConnected = false;
let yhLandingSocketScriptPromise = null;

function applyLandingServerSnapshot(result = {}) {
    applyLandingFeedSnapshot(
        Array.isArray(result.liveEvents)
            ? result.liveEvents
            : Array.isArray(result.academyEvents)
                ? result.academyEvents
                : []
    );

    window.yhSetLandingGlobeData({
        points: Array.isArray(result.points) ? result.points : [],
        arcs: Array.isArray(result.arcs) ? result.arcs : [],
        focusPoint: result.focusPoint || null,
        stats: result.stats && typeof result.stats === 'object' ? result.stats : null
    });
}

function ensureLandingSocketClient() {
    if (typeof window.io === 'function') {
        return Promise.resolve(window.io);
    }

    if (yhLandingSocketScriptPromise) {
        return yhLandingSocketScriptPromise;
    }

    yhLandingSocketScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src="/socket.io/socket.io.js"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.io), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Socket.IO client.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.async = true;
        script.onload = () => resolve(window.io);
        script.onerror = () => reject(new Error('Failed to load Socket.IO client.'));
        document.head.appendChild(script);
    });

    return yhLandingSocketScriptPromise;
}

async function connectLandingRealtimeFeed() {
    if (yhLandingRealtimeSocket) {
        return yhLandingRealtimeSocket;
    }

    const ioClient = await ensureLandingSocketClient();
    if (typeof ioClient !== 'function') {
        throw new Error('Socket.IO client is unavailable.');
    }

    const socket = ioClient('/public-landing', {
        transports: ['websocket', 'polling']
    });

    yhLandingRealtimeSocket = socket;

    socket.on('connect', () => {
        yhLandingRealtimeConnected = true;
    });

    socket.on('disconnect', () => {
        yhLandingRealtimeConnected = false;
    });

    socket.on('landingSnapshot', (payload) => {
        if (!payload?.success) return;
        applyLandingServerSnapshot(payload);
    });

    return socket;
}

async function fetchLandingPublicFeed() {
    try {
        const response = await fetch('/api/public/landing-feed?limit=24', {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Landing feed request failed with ${response.status}`);
        }

        const result = await response.json();
        if (!result?.success) {
            throw new Error(result?.message || 'Public landing feed returned an invalid response.');
        }

        applyLandingServerSnapshot(result);
    } catch (error) {
        console.warn('fetchLandingPublicFeed error:', error?.message || error);
        // keep the last successful live cards and globe points instead of wiping the UI
    }
}

function startLandingFeedRotation() {
    renderLandingFeedSections();

    if (yhLandingPublicFeedTimer) {
        clearInterval(yhLandingPublicFeedTimer);
    }

    fetchLandingPublicFeed();

    connectLandingRealtimeFeed().catch((error) => {
        console.warn('connectLandingRealtimeFeed error:', error?.message || error);
    });

    yhLandingPublicFeedTimer = setInterval(() => {
        if (!yhLandingRealtimeConnected) {
            fetchLandingPublicFeed();
        }
    }, 8000);
}

function renderLandingMapFallback() {
    const mapEl = document.getElementById('yh-world-map');
    if (!mapEl) return;

    mapEl.innerHTML = `
        <div class="yh-world-map-fallback" aria-hidden="true">
            <div class="yh-world-map-fallback-glow"></div>
            <div class="yh-world-map-fallback-grid"></div>
            <div class="yh-world-map-fallback-orb"></div>
            <div class="yh-world-map-fallback-pulse pulse-1"></div>
            <div class="yh-world-map-fallback-pulse pulse-2"></div>
            <div class="yh-world-map-fallback-pulse pulse-3"></div>
            <div class="yh-world-map-fallback-pulse pulse-4"></div>
            <div class="yh-world-map-fallback-pulse pulse-5"></div>
            <div class="yh-world-map-fallback-pulse pulse-6"></div>
        </div>
    `;
}

const YH_GLOBE_LIB_SRCS = [
    'https://cdn.jsdelivr.net/npm/globe.gl',
    'https://unpkg.com/globe.gl'
];

let yhLandingGlobeDepsPromise = null;
let yhLandingThreeModulePromise = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasLandingScript(src) {
    return Array.from(document.querySelectorAll('script[src]')).some(
        (node) => String(node.src || '').trim() === src
    );
}

function loadLandingExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[src]')).find(
            (node) => String(node.src || '').trim() === src
        );

        if (existing) {
            if (existing.dataset.yhLoaded === 'true') {
                resolve();
                return;
            }

            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.dataset.yhLandingScript = 'true';
        script.onload = () => {
            script.dataset.yhLoaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

async function loadLandingScriptFromList(srcList = [], validator = () => false) {
    for (const src of srcList) {
        try {
            if (validator()) return true;
            await loadLandingExternalScript(src);
            await wait(60);

            if (validator()) {
                return true;
            }
        } catch (error) {
            console.warn('Landing script source failed:', src, error?.message || error);
        }
    }

    return validator();
}

async function ensureLandingThreeModule() {
    if (window.THREE) return window.THREE;

    if (!yhLandingThreeModulePromise) {
        yhLandingThreeModulePromise = import('https://esm.sh/three');
    }

    const threeModule = await yhLandingThreeModulePromise;
    const THREE = threeModule?.default || threeModule;

    if (!THREE) {
        throw new Error('Three module import failed.');
    }

    window.THREE = THREE;
    return window.THREE;
}

async function ensureLandingGlobeDeps(options = {}) {
    const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : 5;
    const retryDelay = Number.isFinite(Number(options.retryDelay)) ? Number(options.retryDelay) : 320;

    if (window.Globe && window.THREE) {
        return true;
    }

    if (yhLandingGlobeDepsPromise) {
        return yhLandingGlobeDepsPromise;
    }

    yhLandingGlobeDepsPromise = (async () => {
        for (let attempt = 0; attempt < retries; attempt += 1) {
            if (!window.Globe) {
                await loadLandingScriptFromList(YH_GLOBE_LIB_SRCS, () => !!window.Globe);
            }

            try {
                await ensureLandingThreeModule();
            } catch (error) {
                console.warn('Landing Three module import failed:', error?.message || error);
            }

            await wait(120);

            if (window.Globe && window.THREE) {
                return true;
            }

            if (attempt < retries - 1) {
                await wait(retryDelay);
            }
        }

        return !!(window.Globe && window.THREE);
    })();

    const result = await yhLandingGlobeDepsPromise;
    yhLandingGlobeDepsPromise = null;
    return result;
}

function syncLandingGlobeSize() {
    const mapEl = document.getElementById('yh-world-map');
    if (!mapEl || !yhLandingMapInstance || typeof yhLandingMapInstance.width !== 'function') return;

    const bounds = mapEl.getBoundingClientRect();
    const baseWidth = Math.max(1, Math.round(bounds.width || mapEl.clientWidth || 0));
    const baseHeight = Math.max(1, Math.round(bounds.height || mapEl.clientHeight || 0));

    if (!baseWidth || !baseHeight) return;

    const fitSize = Math.max(1, Math.round(Math.min(baseWidth, baseHeight) * 0.98));

    yhLandingMapInstance
        .width(fitSize)
        .height(fitSize);

    const renderer = typeof yhLandingMapInstance.renderer === 'function'
        ? yhLandingMapInstance.renderer()
        : null;

    const canvasEl = renderer && renderer.domElement ? renderer.domElement : null;
    if (!canvasEl) return;

    mapEl.style.position = 'absolute';
    mapEl.style.inset = '0';
    mapEl.style.overflow = 'hidden';
    mapEl.style.background = 'transparent';
    mapEl.style.border = 'none';
    mapEl.style.outline = 'none';
    mapEl.style.boxShadow = 'none';
    mapEl.style.clipPath = 'none';
    mapEl.style.maskImage = 'none';
    mapEl.style.webkitMaskImage = 'none';
    mapEl.style.borderRadius = 'inherit';

    canvasEl.style.position = 'absolute';
    canvasEl.style.top = '50%';
    canvasEl.style.left = '50%';
    canvasEl.style.right = 'auto';
    canvasEl.style.bottom = 'auto';
    canvasEl.style.width = `${fitSize}px`;
    canvasEl.style.height = `${fitSize}px`;
    canvasEl.style.maxWidth = 'none';
    canvasEl.style.maxHeight = 'none';
    canvasEl.style.background = 'transparent';
    canvasEl.style.border = 'none';
    canvasEl.style.outline = 'none';
    canvasEl.style.boxShadow = 'none';
    canvasEl.style.pointerEvents = 'auto';
    canvasEl.style.overflow = 'hidden';
    canvasEl.style.clipPath = 'none';
    canvasEl.style.maskImage = 'none';
    canvasEl.style.webkitMaskImage = 'none';
    canvasEl.style.borderRadius = 'inherit';
    canvasEl.style.transformOrigin = 'center center';
    canvasEl.style.transform = 'translate(-46%, -50%)';
}
function bindLandingGlobeResize() {
    if (yhLandingResizeBound) return;
    yhLandingResizeBound = true;

    const schedule = () => {
        if (window.__yhLandingResizeRaf) cancelAnimationFrame(window.__yhLandingResizeRaf);
        window.__yhLandingResizeRaf = requestAnimationFrame(() => syncLandingGlobeSize());
    };

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedule, { passive: true });
        window.visualViewport.addEventListener('scroll', schedule, { passive: true });
    }
}

function startLandingCloudSpin() {
    if (yhLandingMapSpinRaf) {
        cancelAnimationFrame(yhLandingMapSpinRaf);
    }

    const CLOUDS_ROTATION_SPEED = -0.006; // deg/frame, aligned with repo example motion

    const tick = () => {
        if (yhLandingCloudsMesh && !document.hidden) {
            yhLandingCloudsMesh.rotation.y += (CLOUDS_ROTATION_SPEED * Math.PI) / 180;
        }

        yhLandingMapSpinRaf = requestAnimationFrame(tick);
    };

    yhLandingMapSpinRaf = requestAnimationFrame(tick);
}

function addLandingGlobeClouds(world) {
    if (
        !world ||
        !window.THREE ||
        typeof world.scene !== 'function' ||
        typeof world.getGlobeRadius !== 'function'
    ) {
        return;
    }

    const CLOUDS_IMG_URL = '/images/clouds.png';
    const CLOUDS_ALT = 0.004;
    const CLOUDS_ROTATION_SPEED = -0.006;

    if (yhLandingMapSpinRaf) {
        cancelAnimationFrame(yhLandingMapSpinRaf);
        yhLandingMapSpinRaf = null;
    }

    if (yhLandingCloudsMesh) {
        const existingScene = world.scene();
        if (existingScene && typeof existingScene.remove === 'function') {
            existingScene.remove(yhLandingCloudsMesh);
        }
        yhLandingCloudsMesh = null;
    }

    const textureLoader = new window.THREE.TextureLoader();
    if (typeof textureLoader.setCrossOrigin === 'function') {
        textureLoader.setCrossOrigin('anonymous');
    }

    textureLoader.load(
        CLOUDS_IMG_URL,
        (cloudsTexture) => {
            if (!yhLandingMapInstance) return;

            const clouds = new window.THREE.Mesh(
                new window.THREE.SphereGeometry(
                    world.getGlobeRadius() * (1 + CLOUDS_ALT),
                    75,
                    75
                ),
                new window.THREE.MeshPhongMaterial({
                    map: cloudsTexture,
                    transparent: true,
                    depthWrite: false
                })
            );

            yhLandingCloudsMesh = clouds;
            world.scene().add(clouds);

            const rotateClouds = () => {
                if (yhLandingCloudsMesh && !document.hidden) {
                    yhLandingCloudsMesh.rotation.y += (CLOUDS_ROTATION_SPEED * Math.PI) / 180;
                }

                yhLandingMapSpinRaf = requestAnimationFrame(rotateClouds);
            };

            yhLandingMapSpinRaf = requestAnimationFrame(rotateClouds);
        },
        undefined,
        (error) => {
            console.warn('Landing clouds texture failed to load:', error);
        }
    );
}

function buildLandingGlowEvents(points = []) {
    return (Array.isArray(points) ? points : [])
        .map((point, index) => {
            const lat = Number(point?.lat);
            const lng = Number(point?.lng);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
            }

            return {
                ...point,
                id: point.id || `yh_glow_${index}_${lat}_${lng}`,
                lat,
                lng,
                coreColor: point.coreColor || point.color || 'rgba(191, 219, 254, 0.96)',
                coreAltitude: Number.isFinite(Number(point.coreAltitude)) ? Number(point.coreAltitude) : 0.012,
                coreRadius: Number.isFinite(Number(point.coreRadius)) ? Number(point.coreRadius) : 0.16,
                ringAltitude: Number.isFinite(Number(point.ringAltitude)) ? Number(point.ringAltitude) : 0.0032,
                ringColor: Array.isArray(point.ringColor) && point.ringColor.length
                    ? point.ringColor
                    : [
                        'rgba(191, 219, 254, 0.96)',
                        'rgba(56, 189, 248, 0.42)',
                        'rgba(56, 189, 248, 0)'
                    ],
                ringMaxRadius: Number.isFinite(Number(point.ringMaxRadius)) ? Number(point.ringMaxRadius) : 4.8,
                ringPropagationSpeed: Number.isFinite(Number(point.ringPropagationSpeed)) ? Number(point.ringPropagationSpeed) : 1.65,
                ringRepeatPeriod: Number.isFinite(Number(point.ringRepeatPeriod)) ? Number(point.ringRepeatPeriod) : 680
            };
        })
        .filter(Boolean);
}

function focusLandingGlowPoint(point = null) {
    if (!point || !yhLandingMapInstance || typeof yhLandingMapInstance.pointOfView !== 'function') return;

    const lat = Number(point.lat);
    const lng = Number(point.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const focusKey =
        String(point.id || '').trim() ||
        `${lat}:${lng}:${String(point.label || '').trim()}`;

    if (focusKey && focusKey === yhLandingLastFocusPointKey) return;
    yhLandingLastFocusPointKey = focusKey;

    yhLandingMapInstance.pointOfView(
        { lat, lng, altitude: 2.12 },
        1600
    );
}

function applyLandingGlobeData() {
    if (!yhLandingMapInstance) return;

    const glowPoints = buildLandingGlowEvents(yhLandingGlobeData.points);
    const globeArcs = Array.isArray(yhLandingGlobeData.arcs) ? yhLandingGlobeData.arcs : [];

    yhLandingMapInstance
        .pointsData(glowPoints)
        .pointLat('lat')
        .pointLng('lng')
        .pointColor((point) => point.coreColor || point.color || 'rgba(191, 219, 254, 0.96)')
        .pointAltitude((point) => point.coreAltitude ?? 0.012)
        .pointRadius((point) => point.coreRadius ?? 0.16)
        .pointLabel((point) => point.label || point.message || 'Academy activity')
        .ringsData(glowPoints)
        .ringLat('lat')
        .ringLng('lng')
        .ringAltitude((point) => point.ringAltitude ?? 0.0032)
        .ringColor((point) => point.ringColor || [
            'rgba(191, 219, 254, 0.96)',
            'rgba(56, 189, 248, 0.42)',
            'rgba(56, 189, 248, 0)'
        ])
        .ringResolution(64)
        .ringMaxRadius((point) => point.ringMaxRadius ?? 4.8)
        .ringPropagationSpeed((point) => point.ringPropagationSpeed ?? 1.65)
        .ringRepeatPeriod((point) => point.ringRepeatPeriod ?? 680)
        .arcsData(globeArcs)
        .arcStartLat('startLat')
        .arcStartLng('startLng')
        .arcEndLat('endLat')
        .arcEndLng('endLng')
        .arcColor((arc) => arc.color || ['rgba(56,189,248,0.92)', 'rgba(56,189,248,0.08)'])
        .arcStroke(0.3)
        .arcDashLength(0.32)
        .arcDashGap(0.16)
        .arcDashAnimateTime(1800);
}

window.yhSetLandingGlobeData = function yhSetLandingGlobeData(next = {}) {
    if (Array.isArray(next.points)) {
        yhLandingGlobeData.points = next.points;
    }

    if (Array.isArray(next.arcs)) {
        yhLandingGlobeData.arcs = next.arcs;
    } else {
        yhLandingGlobeData.arcs = [];
    }

    if (next.stats && typeof next.stats === 'object') {
        const membersEl = document.getElementById('yh-stat-members');
        const reachEl = document.getElementById('yh-stat-reach');
        const impressionsEl = document.getElementById('yh-stat-impressions');

        if (Number.isFinite(next.stats.members)) {
            animateLandingStat(membersEl, next.stats.members, 1200);
        }

        if (Number.isFinite(next.stats.reach)) {
            animateLandingStat(reachEl, next.stats.reach, 1000);
        }

        if (Number.isFinite(next.stats.impressions)) {
            animateLandingStat(impressionsEl, next.stats.impressions, 1350);
        }
    }

    applyLandingGlobeData();

    const focusPoint =
        next.focusPoint ||
        (Array.isArray(next.points) && next.points.length ? next.points[0] : null);

    if (focusPoint) {
        focusLandingGlowPoint(focusPoint);
    }
};

async function initLandingMapShell() {
    const mapEl = document.getElementById('yh-world-map');
    if (!mapEl) return;

    // Prevent browser zoom gesture (ctrl+wheel / trackpad pinch) while hovering the globe.
    // This keeps the globe from shrinking into a distorted-looking speck.
    if (mapEl.dataset.yhZoomGuard !== 'true') {
        mapEl.dataset.yhZoomGuard = 'true';
        mapEl.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    const membersEl = document.getElementById('yh-stat-members');
    const reachEl = document.getElementById('yh-stat-reach');
    const impressionsEl = document.getElementById('yh-stat-impressions');

    if (membersEl) membersEl.textContent = '—';
    if (reachEl) reachEl.textContent = '—';
    if (impressionsEl) impressionsEl.textContent = '—';

    startLandingFeedRotation();

    const depsReady = await ensureLandingGlobeDeps({
        retries: 5,
        retryDelay: 320
    });

    if (!depsReady || !window.Globe || !window.THREE) {
        console.warn('Landing globe bootstrap failed after retries.', {
            hasGlobe: !!window.Globe,
            hasTHREE: !!window.THREE
        });

        renderLandingMapFallback();
        return;
    }

    if (yhLandingMapInstance) {
        syncLandingGlobeSize();
        applyLandingGlobeData();
        return;
    }

    mapEl.innerHTML = '';

    const world = new window.Globe(mapEl, { animateIn: false })
        .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
        .backgroundColor('rgba(0,0,0,0)')
        .showPointerCursor((objType, objData) => {
            return (objType === 'point' || objType === 'ring') && !!objData;
        })
        .onPointClick((point) => {
            focusLandingGlowPoint(point);
            showToast(`${point.label || 'Academy activity'} glow selected`);
        });

    yhLandingMapInstance = world;

    let renderer = null;
    if (typeof world.renderer === 'function') {
        renderer = world.renderer();
        if (renderer && typeof renderer.setClearColor === 'function') {
            renderer.setClearColor(0x000000, 0);
        }
    }

    const controls = typeof world.controls === 'function' ? world.controls() : null;

    if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enablePan = false;
        controls.enableRotate = true;
        controls.enableZoom = false;
        controls.zoomSpeed = 0;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        if (typeof world.getGlobeRadius === 'function') {
            const globeRadius = world.getGlobeRadius();
            controls.maxDistance = globeRadius * 4.6;
        }
    }

    const isPointerOnVisibleGlobe = (clientX, clientY) => {
        if (
            !renderer ||
            !renderer.domElement ||
            !window.THREE ||
            typeof world.camera !== 'function' ||
            typeof world.getGlobeRadius !== 'function'
        ) {
            return false;
        }

        const camera = world.camera();
        if (!camera) return false;

        if (typeof camera.updateMatrixWorld === 'function') {
            camera.updateMatrixWorld();
        }
        if (typeof camera.updateProjectionMatrix === 'function') {
            camera.updateProjectionMatrix();
        }

        const rect = renderer.domElement.getBoundingClientRect();
        if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
        ) {
            return false;
        }

        const projectToScreen = (vector) => {
            const projected = vector.clone().project(camera);
            return {
                x: ((projected.x + 1) * 0.5 * rect.width) + rect.left,
                y: ((-projected.y + 1) * 0.5 * rect.height) + rect.top
            };
        };

        const center = projectToScreen(new window.THREE.Vector3(0, 0, 0));
        const globeRadius = world.getGlobeRadius();

        const edgeX = projectToScreen(new window.THREE.Vector3(globeRadius, 0, 0));
        const edgeY = projectToScreen(new window.THREE.Vector3(0, globeRadius, 0));

        const screenRadius = Math.max(
            Math.hypot(edgeX.x - center.x, edgeX.y - center.y),
            Math.hypot(edgeY.x - center.x, edgeY.y - center.y)
        );

        if (!Number.isFinite(screenRadius) || screenRadius <= 0) return false;

        const pointerDistance = Math.hypot(clientX - center.x, clientY - center.y);
        return pointerDistance <= screenRadius;
    };

    const syncZoomGate = () => {
        if (!controls) return;
        controls.enableZoom = false;
    };

    const wheelTarget = (
        renderer &&
        renderer.domElement
    ) ? renderer.domElement : mapEl;

    const handleWheelZoomGate = () => {
        if (!controls) return;
        controls.enableZoom = false;
    };

    mapEl.addEventListener('pointermove', (event) => {
        syncZoomGate(event.clientX, event.clientY);
    }, { passive: true });

    mapEl.addEventListener('pointerleave', () => {
        if (controls) controls.enableZoom = false;
    }, { passive: true });

    wheelTarget.addEventListener('wheel', handleWheelZoomGate, {
        passive: false,
        capture: true
    });

    mapEl.addEventListener('wheel', handleWheelZoomGate, {
        passive: false,
        capture: true
    });

    world.pointOfView({ lat: 14, lng: 18, altitude: 1.72 }, 0);

    if (controls) {
        if (typeof controls.update === 'function') {
            controls.update();
        }

        if (typeof controls.getDistance === 'function') {
            const currentDistance = controls.getDistance();
            if (Number.isFinite(currentDistance) && currentDistance > 0) {
                controls.minDistance = currentDistance;
            }
        }
    }

    applyLandingGlobeData();

    if (Array.isArray(yhLandingGlobeData.points) && yhLandingGlobeData.points.length) {
        focusLandingGlowPoint(yhLandingGlobeData.points[0]);
    }

    addLandingGlobeClouds(world);
    syncLandingGlobeSize();
    bindLandingGlobeResize();
}

window.addEventListener('load', () => {
    // Prevent landing-page redirect loops caused by stale browser auth flags.
    // The server-side /dashboard cookie gate is now the source of truth.
    localStorage.removeItem('yh_user_loggedIn');
    localStorage.removeItem('yh_token');
    localStorage.removeItem('token');

    const syncLandingMobileGlobePlacement = () => {
        const heroGrid = document.querySelector('.yh-landing-hero-grid');
        const activityPanel = document.querySelector('.yh-landing-activity-panel');
        const heroVisual = document.querySelector('.yh-landing-hero-visual');

        if (!heroGrid || !activityPanel || !heroVisual) return;

        let desktopAnchor = document.getElementById('yh-landing-hero-visual-desktop-anchor');

        if (!desktopAnchor) {
            desktopAnchor = document.createElement('span');
            desktopAnchor.id = 'yh-landing-hero-visual-desktop-anchor';
            desktopAnchor.setAttribute('aria-hidden', 'true');
            desktopAnchor.style.display = 'none';

            if (heroVisual.parentElement) {
                heroVisual.parentElement.insertBefore(desktopAnchor, heroVisual);
            }
        }

        const shouldUseMobilePlacement = window.matchMedia('(max-width: 768px)').matches;

        if (shouldUseMobilePlacement) {
            if (activityPanel.nextElementSibling !== heroVisual) {
                activityPanel.insertAdjacentElement('afterend', heroVisual);
            }
        } else if (desktopAnchor.parentElement && desktopAnchor.nextElementSibling !== heroVisual) {
            desktopAnchor.parentElement.insertBefore(heroVisual, desktopAnchor.nextSibling);
        }

        window.requestAnimationFrame(() => {
            if (typeof syncLandingGlobeSize === 'function') {
                syncLandingGlobeSize();
            }
        });
    };

    syncLandingMobileGlobePlacement();
    initLandingMapShell();

    window.addEventListener('resize', syncLandingMobileGlobePlacement, { passive: true });
    window.addEventListener('orientationchange', syncLandingMobileGlobePlacement, { passive: true });

    // --- CARD FLIP LOGIC ---
    const flipper = document.getElementById('auth-flipper');
    const btnFlipRegister = document.getElementById('btn-flip-register');
    const btnFlipLogin = document.getElementById('btn-flip-login');

    const syncMobileAuthCardHeight = (options = {}) => {
        const animateFace = options.animateFace === true;

        const authSection = document.getElementById('yh-auth-section');
        const authCard = document.querySelector('.yh-auth-card');
        const panelRight = authCard?.querySelector('.panel-right-wrapper');
        const frontFace = authCard?.querySelector('.flip-card-front');
        const backFace = authCard?.querySelector('.flip-card-back');

        if (!authCard || !panelRight || !flipper || !frontFace || !backFace) return;

        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        const clearRuntimeSizing = (node) => {
            if (!node) return;

            [
                'display',
                'height',
                'min-height',
                'max-height',
                'position',
                'inset',
                'overflow',
                'transform',
                'transition',
                'opacity',
                'backface-visibility',
                '-webkit-backface-visibility'
            ].forEach((prop) => {
                node.style.removeProperty(prop);
            });
        };

        if (!isMobile) {
            [authCard, panelRight, flipper, frontFace, backFace].forEach(clearRuntimeSizing);
            return;
        }

        const activeFace = flipper.classList.contains('is-flipped') ? backFace : frontFace;
        const inactiveFace = activeFace === frontFace ? backFace : frontFace;

        const previousHeight = Math.ceil(authCard.getBoundingClientRect().height || 0);

        authCard.style.setProperty('display', 'block', 'important');
        authCard.style.setProperty('height', 'auto', 'important');
        authCard.style.setProperty('min-height', '0px', 'important');
        authCard.style.setProperty('max-height', 'none', 'important');
        authCard.style.setProperty('overflow', 'hidden', 'important');

        panelRight.style.setProperty('width', '100%', 'important');
        panelRight.style.setProperty('height', 'auto', 'important');
        panelRight.style.setProperty('min-height', '0px', 'important');
        panelRight.style.setProperty('max-height', 'none', 'important');
        panelRight.style.setProperty('overflow', 'hidden', 'important');

        flipper.style.setProperty('position', 'relative', 'important');
        flipper.style.setProperty('height', 'auto', 'important');
        flipper.style.setProperty('min-height', '0px', 'important');
        flipper.style.setProperty('max-height', 'none', 'important');
        flipper.style.setProperty('transform', 'none', 'important');
        flipper.style.setProperty('overflow', 'hidden', 'important');

        inactiveFace.style.setProperty('display', 'none', 'important');

        activeFace.style.setProperty('display', 'flex', 'important');
        activeFace.style.setProperty('position', 'relative', 'important');
        activeFace.style.setProperty('inset', 'auto', 'important');
        activeFace.style.setProperty('height', 'auto', 'important');
        activeFace.style.setProperty('min-height', '0px', 'important');
        activeFace.style.setProperty('max-height', 'none', 'important');
        activeFace.style.setProperty('overflow', 'visible', 'important');
        activeFace.style.setProperty('backface-visibility', 'visible', 'important');
        activeFace.style.setProperty('-webkit-backface-visibility', 'visible', 'important');

        if (animateFace) {
            activeFace.style.setProperty('transition', 'none', 'important');
            activeFace.style.setProperty('opacity', '0', 'important');
            activeFace.style.setProperty('transform', 'translateY(10px) scale(0.985)', 'important');
        } else {
            activeFace.style.setProperty('transition', 'none', 'important');
            activeFace.style.setProperty('opacity', '1', 'important');
            activeFace.style.setProperty('transform', 'none', 'important');
        }

        window.requestAnimationFrame(() => {
            const activeHeight = Math.ceil(
                activeFace.scrollHeight ||
                activeFace.getBoundingClientRect().height ||
                0
            );

            const finalHeight = activeHeight + 48;

            if (finalHeight > 120) {
                if (animateFace && previousHeight > 120) {
                    authCard.style.setProperty('height', `${previousHeight}px`, 'important');
                    panelRight.style.setProperty('height', `${previousHeight}px`, 'important');
                    flipper.style.setProperty('height', `${previousHeight}px`, 'important');

                    authCard.style.setProperty(
                        'transition',
                        'height 260ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms ease, box-shadow 220ms ease',
                        'important'
                    );
                    panelRight.style.setProperty(
                        'transition',
                        'height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                        'important'
                    );
                    flipper.style.setProperty(
                        'transition',
                        'height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                        'important'
                    );

                    window.requestAnimationFrame(() => {
                        authCard.style.setProperty('height', `${finalHeight}px`, 'important');
                        panelRight.style.setProperty('height', `${finalHeight}px`, 'important');
                        flipper.style.setProperty('height', `${finalHeight}px`, 'important');
                    });
                } else {
                    authCard.style.setProperty('height', `${finalHeight}px`, 'important');
                    panelRight.style.setProperty('height', `${finalHeight}px`, 'important');
                    flipper.style.setProperty('height', `${finalHeight}px`, 'important');
                }
            }

            if (animateFace) {
                window.requestAnimationFrame(() => {
                    activeFace.style.setProperty(
                        'transition',
                        'opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                        'important'
                    );
                    activeFace.style.setProperty('opacity', '1', 'important');
                    activeFace.style.setProperty('transform', 'translateY(0) scale(1)', 'important');
                });
            }

            if (authSection) {
                authSection.style.setProperty('min-height', 'auto', 'important');
            }
        });
    };

    const flipToRegister = () => {
        if (!flipper) return;
        flipper.classList.add('is-flipped');
        syncMobileAuthCardHeight({ animateFace: true });
    };

    const flipToLogin = () => {
        if (!flipper) return;
        flipper.classList.remove('is-flipped');
        syncMobileAuthCardHeight({ animateFace: true });
    };

    if (btnFlipRegister) btnFlipRegister.addEventListener('click', flipToRegister);
    if (btnFlipLogin) btnFlipLogin.addEventListener('click', flipToLogin);

    syncMobileAuthCardHeight();

    window.addEventListener('resize', () => syncMobileAuthCardHeight(), { passive: true });
    window.addEventListener('orientationchange', () => syncMobileAuthCardHeight(), { passive: true });

    if ('ResizeObserver' in window) {
        const authCardResizeObserver = new ResizeObserver(() => {
            syncMobileAuthCardHeight();
        });

        const frontFace = document.querySelector('.yh-auth-card .flip-card-front');
        const backFace = document.querySelector('.yh-auth-card .flip-card-back');

        if (frontFace) authCardResizeObserver.observe(frontFace);
        if (backFace) authCardResizeObserver.observe(backFace);
    }
    const setPendingVerifyEmail = (email) => {
        if (!email) return;
        sessionStorage.setItem('yh_pending_verify_email', String(email).trim().toLowerCase());
    };

    const getPendingVerifyEmail = () => {
        const fromSession = sessionStorage.getItem('yh_pending_verify_email');
        if (fromSession) return fromSession;

        const regEmailInput = document.getElementById('reg-email');
        return regEmailInput?.value?.trim().toLowerCase() || '';
    };

    const clearPendingVerifyEmail = () => {
        sessionStorage.removeItem('yh_pending_verify_email');
    };
const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const compressImageToDataURL = (file, size = 320, quality = 0.82) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas is not supported.'));
                return;
            }

            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;

            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };

        img.onerror = reject;
        img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const bindPasswordVisibilityToggles = () => {
    document.querySelectorAll('.yh-password-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const shouldShow = input.type === 'password';
            input.type = shouldShow ? 'text' : 'password';
            btn.innerText = shouldShow ? yhT('auth.hide') : yhT('auth.show');
        });
    });
};

const bindRegisterPhotoUpload = () => {
    const input = document.getElementById('reg-profile-photo');
    const label = document.getElementById('reg-profile-photo-label');

    if (!input || !label) return;

    input.addEventListener('change', () => {
        const file = input.files?.[0];

        if (!file) {
            label.innerText = yhT('auth.choosePhoto');
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast('Please choose an image file.', 'error');
            input.value = '';
            label.innerText = yhT('auth.choosePhoto');
            return;
        }

        label.innerText = file.name;
    });
};
    const bootstrapPendingVerification = () => {
        const pendingEmail = getPendingVerifyEmail();
        if (!pendingEmail) return;

        showStep(2);

        const otpInput = document.getElementById('otp-input');
        if (otpInput) otpInput.value = '';

        startOTPTimer();
    };
bootstrapPendingVerification();
bindPasswordVisibilityToggles();
bindRegisterPhotoUpload();
    // --- LOGIN LOGIC ---
const btnLogin = document.getElementById('btn-login');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

async function handleLoginSubmit() {
    if (!btnLogin) return;

    const rawIdentifier = loginEmailInput?.value?.trim() || '';
    const identifier = rawIdentifier.includes('@') && !rawIdentifier.startsWith('@')
        ? rawIdentifier.toLowerCase()
        : rawIdentifier.replace(/^@+/, '').toLowerCase();

    const password = loginPasswordInput?.value || '';

    if (!identifier || !password) {
        showToast("Please enter your email/username and password.", "error");
        return;
    }

    btnLogin.innerText = 'Logging in...';
    btnLogin.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const result = await response.json();

if (result.success) {
    showToast(result.message, "success");
    clearPendingVerifyEmail();
    clearAcademyClientStateForFreshAuth();

    persistClientSession({
        ...result.user,
        email: result.user?.email || identifier
    }, result.token);

    try {
        sessionStorage.setItem(YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY, '1');
    } catch (_) {}

    showPostLoginTransitionLoader('Syncing your access and preparing your dashboard...');

    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 450);

    return;
}

        if (response.status === 403 && result.verificationRequired) {
            const verificationEmail = String(result.email || identifier).trim().toLowerCase();

            if (verificationEmail) {
                setPendingVerifyEmail(verificationEmail);
            }

            document.getElementById('otp-input').value = '';
            showStep(2);
            startOTPTimer();
            showToast(result.message, "error");

            btnLogin.innerText = yhT('auth.login');
            btnLogin.disabled = false;
            return;
        }

        showToast(result.message, "error");
        btnLogin.innerText = yhT('auth.login');
        btnLogin.disabled = false;
    } catch (error) {
        showToast("Server error during login.", "error");
        btnLogin.innerText = yhT('auth.login');
        btnLogin.disabled = false;
    }
}

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        await handleLoginSubmit();
    });
}

[loginEmailInput, loginPasswordInput].forEach((input) => {
    if (!input) return;

    input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await handleLoginSubmit();
    });
});

// --- REGISTER LOGIC (SIMPLE FORM) ---
const formRegisterSimple = document.getElementById('form-register-simple');
if (formRegisterSimple) {
    formRegisterSimple.addEventListener('submit', async function(e) {
        e.preventDefault();

        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const fullName = document.getElementById('reg-fullname').value.trim();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const username = document.getElementById('reg-username').value.trim();
        const city = document.getElementById('reg-city').value.trim();
        const country = document.getElementById('reg-country').value.trim();
        const profilePhotoFile = document.getElementById('reg-profile-photo')?.files?.[0] || null;

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }

        if (!username) {
            showToast("Please enter a username.", "error");
            return;
        }

        if (!city || !country) {
            showToast("Please enter your city and country.", "error");
            return;
        }

        if (!profilePhotoFile) {
            showToast("Profile photo is required.", "error");
            return;
        }

        if (!profilePhotoFile.type.startsWith('image/')) {
            showToast("Please upload a valid image file.", "error");
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerText = yhT('auth.creatingAccount');
        submitBtn.disabled = true;

        try {
            const profilePhotoDataUrl = await compressImageToDataURL(profilePhotoFile, 320, 0.82);

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    email,
                    username,
                    city,
                    country,
                    password,
                    profilePhotoDataUrl
                })
            });

            const result = await response.json();

            if (result.success) {
                sessionStorage.setItem('yh_pending_profile_avatar', profilePhotoDataUrl);
                localStorage.setItem('yh_pending_profile_avatar', profilePhotoDataUrl);

                setPendingVerifyEmail(email);
                showToast(result.message, "success");
                showStep(2);
                startOTPTimer();
            } else {
                showToast(result.message, "error");
                submitBtn.innerText = yhT('auth.createAccount');
                submitBtn.disabled = false;
            }
        } catch (error) {
            showToast("Server error during registration.", "error");
            submitBtn.innerText = yhT('auth.createAccount');
            submitBtn.disabled = false;
        }
    });
}

    // --- OTP LOGIC ---
    let otpTimerInterval;
    function startOTPTimer() {
        clearInterval(otpTimerInterval);
        let timeLeft = 120;
        const timerDisplay = document.getElementById('otp-timer');
        const resendBtn = document.getElementById('btn-resend-otp');
        
        resendBtn.disabled = true; resendBtn.style.opacity = '0.5'; resendBtn.style.cursor = 'not-allowed';
        timerDisplay.style.color = 'var(--neon-blue)';

        otpTimerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
            const timeLabel = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            timerDisplay.innerText = timeLabel;
            resendBtn.innerText = yhT('auth.resendIn', { time: timeLabel });

            if (timeLeft <= 0) {
                clearInterval(otpTimerInterval);
                timerDisplay.innerText = "00:00"; timerDisplay.style.color = "#ef4444";
                resendBtn.innerText = yhT('auth.resendCode'); resendBtn.disabled = false; resendBtn.style.opacity = '1'; resendBtn.style.cursor = 'pointer';
            }
            timeLeft--;
        }, 1000);
    }

    const btnResendOTP = document.getElementById('btn-resend-otp');
    if (btnResendOTP) {
        btnResendOTP.addEventListener('click', async () => {
            const email = getPendingVerifyEmail();
            if (!email) {
                showToast("Missing verification email. Please register again.", "error");
                showStep(1);
                return;
            }

            btnResendOTP.innerText = yhT('auth.sending');
            btnResendOTP.disabled = true;

            try {
                const response = await fetch('/api/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.success) {
                    showToast("A new code has been sent to your email.", "success");
                    document.getElementById('otp-input').value = '';
                    startOTPTimer();
                } else {
                    showToast(result.message, "error");
                    btnResendOTP.innerText = yhT('auth.resendCode');
                    btnResendOTP.disabled = false;
                }
            } catch (error) {
                showToast("Failed to resend code.", "error");
                btnResendOTP.innerText = yhT('auth.resendCode');
                btnResendOTP.disabled = false;
            }
        });
    }

    const formVerifyOTP = document.getElementById('form-verify-otp');
    if (formVerifyOTP) {
        formVerifyOTP.addEventListener('submit', async function(e) {
            e.preventDefault();
            const otpCode = document.getElementById('otp-input').value.trim();
            const email = getPendingVerifyEmail();

            if (!email) {
                showToast("Missing verification email. Please register again.", "error");
                showStep(1);
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerText = yhT('auth.verifying');
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otpCode })
                });
                const result = await response.json();

                if (result.success) {
                    clearInterval(otpTimerInterval);
                    clearPendingVerifyEmail();
                    showToast("Account verified. Welcome to YH Universe.", "success");

                    clearAcademyClientStateForFreshAuth();

                    persistClientSession({
                        ...result.user,
                        email: result.user?.email || email
                    }, result.token);

                    setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
                } else {
                    showToast(result.message, "error");
                    submitBtn.innerText = yhT('auth.verifyEnter');
                    submitBtn.disabled = false;
                }
            } catch (error) {
                showToast("Server error during verification.", "error");
                submitBtn.innerText = yhT('auth.verifyEnter');
                submitBtn.disabled = false;
            }
        });
    }

    // --- FORGOT PASSWORD LOGIC ---
    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) { forgotLink.addEventListener('click', (e) => { e.preventDefault(); showStep(3); }); }

    let forgotTimerInterval; let resetEmailHolder = ""; 
    function startForgotTimer() {
        clearInterval(forgotTimerInterval); let timeLeft = 120;
        const timerDisplay = document.getElementById('forgot-otp-timer');
        timerDisplay.style.color = 'var(--neon-blue)';
        forgotTimerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
            timerDisplay.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            if (timeLeft <= 0) { clearInterval(forgotTimerInterval); timerDisplay.innerText = "00:00"; timerDisplay.style.color = "#ef4444"; }
            timeLeft--;
        }, 1000);
    }

    const formForgotPass = document.getElementById('form-forgot-pass');
    if (formForgotPass) {
        formForgotPass.addEventListener('submit', async (e) => {
            e.preventDefault(); const email = document.getElementById('forgot-email-input').value;
            const submitBtn = document.getElementById('btn-forgot-send'); submitBtn.innerText = yhT('auth.sending'); submitBtn.disabled = true;
            try {
                const response = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                const result = await response.json();
                if (result.success) { resetEmailHolder = email; showStep(4); startForgotTimer(); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = yhT('auth.sendRecoveryCode'); submitBtn.disabled = false; }
        });
    }

    const formForgotOTP = document.getElementById('form-forgot-otp');
    if (formForgotOTP) {
        formForgotOTP.addEventListener('submit', async (e) => {
            e.preventDefault(); const otpCode = document.getElementById('forgot-otp-code').value;
            const submitBtn = document.getElementById('btn-forgot-verify'); submitBtn.innerText = yhT('auth.verifying'); submitBtn.disabled = true;
            try {
                const response = await fetch('/api/verify-forgot-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmailHolder, otpCode }) });
                const result = await response.json();
                if (result.success) { clearInterval(forgotTimerInterval); showStep(5); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = yhT('auth.verifyCode'); submitBtn.disabled = false; }
        });
    }

    const formResetPass = document.getElementById('form-reset-pass');
    if (formResetPass) {
        formResetPass.addEventListener('submit', async (e) => {
            e.preventDefault(); const newPassword = document.getElementById('reset-new-password').value; const confirmPassword = document.getElementById('reset-confirm-password').value;
            if (newPassword !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }
            const submitBtn = document.getElementById('btn-reset-save'); submitBtn.innerText = yhT('auth.saving'); submitBtn.disabled = true;
            try {
                const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmailHolder, newPassword }) });
                const result = await response.json();
                if (result.success) { formResetPass.reset(); resetEmailHolder = ""; showStep(6); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = yhT('auth.saveNewPassword'); submitBtn.disabled = false; }
        });
    }
    const authSection = document.getElementById('yh-auth-section');
    const divisionsSection = document.getElementById('yh-divisions-section');
    const isApplyLanding = document.body?.dataset?.yhPage === 'apply';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const LANDING_SOUND_KEY = 'yh_landing_sound_enabled_v1';

    const landingSoundState = {
        enabled: localStorage.getItem(LANDING_SOUND_KEY) !== '0'
    };

    let landingAudioCtx = null;
    let lastManualScrollSoundAt = 0;
    let lastManualScrollY = window.scrollY;
    let meteorTimer = null;
    let asteroidParallaxFrame = 0;

    const getLandingAudioCtx = async () => {
        if (!isApplyLanding) return null;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        if (!landingAudioCtx) {
            landingAudioCtx = new AudioCtx();
        }

        if (landingAudioCtx.state === 'suspended') {
            try {
                await landingAudioCtx.resume();
            } catch (_) {}
        }

        return landingAudioCtx;
    };

    const canPlayLandingSound = () => (
        isApplyLanding &&
        landingSoundState.enabled &&
        !prefersReducedMotion.matches
    );

    const updateSoundToggleUI = () => {
        const toggle = document.getElementById('yh-sound-toggle');
        if (!toggle) return;

        toggle.classList.toggle('is-muted', !landingSoundState.enabled);
        toggle.setAttribute('aria-pressed', landingSoundState.enabled ? 'true' : 'false');

        const icon = toggle.querySelector('.yh-sound-toggle-icon');
        const label = toggle.querySelector('.yh-sound-toggle-label');

        if (icon) icon.textContent = landingSoundState.enabled ? '🔊' : '🔇';
        if (label) label.textContent = landingSoundState.enabled ? 'Sound On' : 'Sound Off';
    };

    const playLandingTone = async ({
        freq = 220,
        endFreq = null,
        duration = 0.08,
        type = 'sine',
        gain = 0.018,
        attack = 0.003,
        release = 0.05,
        detune = 0
    } = {}) => {
        if (!canPlayLandingSound()) return;

        const ctx = await getLandingAudioCtx();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq && endFreq !== freq) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
        }
        osc.detune.setValueAtTime(detune, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(gain, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + release + 0.02);
    };

    const playUiClick = async () => {
        await playLandingTone({
            freq: 380,
            endFreq: 305,
            duration: 0.06,
            type: 'triangle',
            gain: 0.018,
            attack: 0.002,
            release: 0.045
        });

        await playLandingTone({
            freq: 760,
            endFreq: 645,
            duration: 0.038,
            type: 'sine',
            gain: 0.011,
            attack: 0.0012,
            release: 0.03
        });
    };

    const playFlipWhoosh = async () => {
        await playLandingTone({
            freq: 165,
            endFreq: 460,
            duration: 0.17,
            type: 'triangle',
            gain: 0.016,
            attack: 0.003,
            release: 0.08
        });

        await playLandingTone({
            freq: 520,
            endFreq: 350,
            duration: 0.10,
            type: 'sine',
            gain: 0.007,
            attack: 0.002,
            release: 0.05
        });
    };

    const playScrollWhoosh = async (gain = 0.0135) => {
        await playLandingTone({
            freq: 230,
            endFreq: 138,
            duration: 0.11,
            type: 'sine',
            gain,
            attack: 0.004,
            release: 0.06
        });
    };

    const ensureLandingAmbientLayers = () => {
        if (!isApplyLanding) return;

        const shell = document.querySelector('#step-1.yh-landing-step .yh-landing-shell');
        if (!shell) return;

        if (!shell.querySelector('.yh-space-ambient')) {
            const ambient = document.createElement('div');
            ambient.className = 'yh-space-ambient';
            ambient.setAttribute('aria-hidden', 'true');
            ambient.innerHTML = `
                <div class="yh-space-stars"></div>
                <div class="yh-space-rays"></div>

                <div class="yh-space-asteroid-layer yh-space-asteroid-layer--far">
                    <span class="yh-space-asteroid asteroid-a"></span>
                    <span class="yh-space-asteroid asteroid-b"></span>
                </div>

                <div class="yh-space-asteroid-layer yh-space-asteroid-layer--mid">
                    <span class="yh-space-asteroid asteroid-c"></span>
                    <span class="yh-space-asteroid asteroid-d"></span>
                </div>

                <div class="yh-space-asteroid-layer yh-space-asteroid-layer--near">
                    <span class="yh-space-asteroid asteroid-e"></span>
                </div>

                <div class="yh-space-meteor-layer"></div>
            `;

            const bg = shell.querySelector('.yh-landing-bg');
            if (bg && bg.nextSibling) {
                shell.insertBefore(ambient, bg.nextSibling);
            } else {
                shell.appendChild(ambient);
            }
        }

        const topbar = shell.querySelector('.yh-landing-topbar');
        if (topbar && !topbar.querySelector('#yh-sound-toggle')) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.id = 'yh-sound-toggle';
            toggle.className = 'yh-sound-toggle';
            toggle.setAttribute('aria-label', 'Toggle landing sound effects');
            toggle.innerHTML = `
                <span class="yh-sound-toggle-icon">🔊</span>
                <span class="yh-sound-toggle-label">Sound On</span>
            `;
            topbar.appendChild(toggle);
            updateSoundToggleUI();

            toggle.addEventListener('click', async () => {
                const wasEnabled = landingSoundState.enabled;

                if (wasEnabled) {
                    await getLandingAudioCtx();
                    await playUiClick();
                }

                landingSoundState.enabled = !landingSoundState.enabled;
                localStorage.setItem(LANDING_SOUND_KEY, landingSoundState.enabled ? '1' : '0');
                updateSoundToggleUI();

                if (!wasEnabled && landingSoundState.enabled) {
                    await getLandingAudioCtx();
                    await playUiClick();
                }
            });
        }
    };
    const syncLandingAsteroidParallax = (now = performance.now()) => {
        if (!isApplyLanding || prefersReducedMotion.matches) {
            if (asteroidParallaxFrame) {
                cancelAnimationFrame(asteroidParallaxFrame);
            }
            asteroidParallaxFrame = 0;
            return;
        }

        const shell = document.querySelector('#step-1.yh-landing-step .yh-landing-shell');
        if (!shell) {
            asteroidParallaxFrame = 0;
            return;
        }

        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        const eased = 1 - Math.pow(1 - progress, 2);

        const farLayer = shell.querySelector('.yh-space-asteroid-layer--far');
        const midLayer = shell.querySelector('.yh-space-asteroid-layer--mid');
        const nearLayer = shell.querySelector('.yh-space-asteroid-layer--near');

        const t = now * 0.00024;

        const farX = (-8 + eased * 10) + Math.sin(t * 0.9) * 6;
        const farY = (eased * 18) + Math.cos(t * 0.7) * 5;

        const midX = (eased * 14) + Math.sin(t * 1.1 + 1.4) * 8;
        const midY = (eased * 28) + Math.cos(t * 0.95 + 0.8) * 7;

        const nearX = (-12 + eased * 18) + Math.sin(t * 1.25 + 2.2) * 10;
        const nearY = (eased * 40) + Math.cos(t * 1.05 + 1.6) * 9;

        if (farLayer) {
            farLayer.style.transform = `translate3d(${farX.toFixed(2)}px, ${farY.toFixed(2)}px, 0)`;
        }

        if (midLayer) {
            midLayer.style.transform = `translate3d(${midX.toFixed(2)}px, ${midY.toFixed(2)}px, 0)`;
        }

        if (nearLayer) {
            nearLayer.style.transform = `translate3d(${nearX.toFixed(2)}px, ${nearY.toFixed(2)}px, 0)`;
        }

        asteroidParallaxFrame = 0;
    };

    const startLandingAsteroidParallax = () => {
        if (asteroidParallaxFrame || !isApplyLanding || prefersReducedMotion.matches) return;
        asteroidParallaxFrame = window.requestAnimationFrame(syncLandingAsteroidParallax);
    };
    const spawnMeteor = () => {
        if (!isApplyLanding || prefersReducedMotion.matches) return;

        const layer = document.querySelector('.yh-space-meteor-layer');
        if (!layer) return;

        const meteor = document.createElement('span');
        meteor.className = 'yh-space-meteor';

        const top = 5 + Math.random() * 28;
        const left = 68 + Math.random() * 20;
        const width = 150 + Math.random() * 110;
        const duration = 2.5 + Math.random() * 1.8;

        meteor.style.setProperty('--meteor-top', `${top}%`);
        meteor.style.setProperty('--meteor-left', `${left}%`);
        meteor.style.setProperty('--meteor-width', `${width}px`);
        meteor.style.setProperty('--meteor-duration', `${duration}s`);

        layer.appendChild(meteor);

        window.setTimeout(() => {
            meteor.remove();
        }, Math.ceil((duration + 0.24) * 1000));
    };

    const scheduleNextMeteor = () => {
        if (!isApplyLanding || prefersReducedMotion.matches) return;

        clearTimeout(meteorTimer);
        meteorTimer = window.setTimeout(() => {
            spawnMeteor();
            scheduleNextMeteor();
        }, 4200 + Math.random() * 4200);
    };

    const scrollToTarget = (target, { withSound = false } = {}) => {
        if (!target) return;
        if (withSound) void playScrollWhoosh(0.011);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const openAuthPanel = ({ withSound = false } = {}) => {
        scrollToTarget(authSection, { withSound });
    };

    ensureLandingAmbientLayers();
    startLandingAsteroidParallax();
    scheduleNextMeteor();
    updateSoundToggleUI();

    window.addEventListener('pointerdown', () => {
        void getLandingAudioCtx();
    }, { once: true, passive: true });

    if (isApplyLanding) {
        window.addEventListener('scroll', () => {
            lastManualScrollY = window.scrollY;
            startLandingAsteroidParallax();
        }, { passive: true });

        window.addEventListener('resize', () => {
            if (!asteroidParallaxFrame) {
                startLandingAsteroidParallax();
            }
        }, { passive: true });
    }

    const initLandingSectionReveal = () => {
        if (!isApplyLanding) return;

        const revealTargets = [
            document.querySelector('.yh-landing-hero'),
            document.querySelector('#yh-divisions-section'),
            document.querySelector('#yh-auth-section'),
            ...document.querySelectorAll('.yh-landing-metric-card'),
            document.querySelector('.yh-landing-activity-panel'),
            document.querySelector('.yh-landing-hero-visual'),
            ...document.querySelectorAll('.yh-landing-division-card'),
            document.querySelector('.yh-auth-card')
        ].filter(Boolean);

        revealTargets.forEach((element, index) => {
            element.classList.add('yh-section-reveal');
            element.setAttribute('data-reveal-delay', String(index % 4));
        });

        if (!('IntersectionObserver' in window)) {
            revealTargets.forEach((element) => element.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.14,
            rootMargin: '0px 0px -8% 0px'
        });

        revealTargets.forEach((element) => observer.observe(element));
    };

    const btnTopbar = document.getElementById('yh-scroll-auth');
    const btnHero = document.getElementById('yh-open-auth-main');
    const btnAcademy = document.getElementById('yh-open-auth-academy');
    const btnPlaza = document.getElementById('yh-open-auth-plaza');
    const btnFederation = document.getElementById('yh-open-auth-federation');
    const btnDivisions = document.getElementById('yh-scroll-divisions');

    if (btnTopbar) btnTopbar.addEventListener('click', () => openAuthPanel({ withSound: true }));
    if (btnHero) btnHero.addEventListener('click', () => openAuthPanel({ withSound: true }));
    if (btnAcademy) btnAcademy.addEventListener('click', () => openAuthPanel({ withSound: true }));
    if (btnPlaza) btnPlaza.addEventListener('click', () => openAuthPanel({ withSound: true }));
    if (btnFederation) btnFederation.addEventListener('click', () => openAuthPanel({ withSound: true }));
    if (btnDivisions) btnDivisions.addEventListener('click', () => scrollToTarget(divisionsSection, { withSound: true }));

    if (btnFlipRegister) btnFlipRegister.addEventListener('click', () => { void playFlipWhoosh(); });
    if (btnFlipLogin) btnFlipLogin.addEventListener('click', () => { void playFlipWhoosh(); });

    document.querySelectorAll('body[data-yh-page="apply"] button').forEach((button) => {
        const id = button.id || '';

        if (
            id === 'btn-flip-register' ||
            id === 'btn-flip-login' ||
            id === 'yh-open-auth-main' ||
            id === 'yh-open-auth-academy' ||
            id === 'yh-open-auth-plaza' ||
            id === 'yh-open-auth-federation' ||
            id === 'yh-scroll-divisions' ||
            id === 'yh-sound-toggle'
        ) {
            return;
        }

        button.addEventListener('click', () => {
            void playUiClick();
        });
    });

    initLandingSectionReveal();
});