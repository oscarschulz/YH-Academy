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
        'auth.resendIn': `Resend in ${options?.time || '00:00'}`
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
    const otpStep = document.getElementById('step-2');
    const timerEl = document.getElementById('otp-timer');
    const resendBtn = document.getElementById('btn-resend-otp');

    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.innerText = yhTText(message);

    if (type === "error") {
        toast.classList.add('error-toast');
        toastIcon.innerText = "⚠️";
    } else {
        toast.classList.remove('error-toast');
        toastIcon.innerText = "🎉";
    }

    const otpStepVisible = otpStep && !otpStep.classList.contains('hidden-step');

    // reset/default
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.right = 'auto';
    toast.style.top = '32px';
    toast.style.bottom = 'auto';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '10000';
    toast.style.width = 'min(92vw, 460px)';
    toast.style.maxWidth = '460px';
    toast.style.minWidth = '0';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '0.92rem';
    toast.style.lineHeight = '1.35';
    toast.style.textAlign = 'center';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.gap = '8px';
    toast.style.boxSizing = 'border-box';
    toast.style.wordBreak = 'break-word';

    if (otpStepVisible) {
        const isMobile = window.innerWidth <= 768;

        toast.style.top = 'auto';
        toast.style.left = '50%';
        toast.style.right = 'auto';
        toast.style.transform = 'translateX(-50%)';

        if (isMobile) {
            toast.style.width = 'calc(100vw - 32px)';
            toast.style.maxWidth = '360px';
            toast.style.padding = '9px 12px';
            toast.style.fontSize = '0.84rem';
            toast.style.borderRadius = '10px';
            toast.style.bottom = '92px';
        } else {
            toast.style.width = 'min(78%, 420px)';
            toast.style.maxWidth = '420px';
            toast.style.padding = '10px 14px';
            toast.style.fontSize = '0.88rem';
            toast.style.borderRadius = '12px';

            if (resendBtn) {
                const resendRect = resendBtn.getBoundingClientRect();
                const bottomGap = Math.max(28, window.innerHeight - resendRect.top + 6);
                toast.style.bottom = `${bottomGap}px`;
            } else if (timerEl) {
                const timerRect = timerEl.getBoundingClientRect();
                const bottomGap = Math.max(84, window.innerHeight - timerRect.bottom + 44);
                toast.style.bottom = `${bottomGap}px`;
            } else {
                toast.style.bottom = '110px';
            }
        }
    }

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(window.__yhToastTimer);
    window.__yhToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function clearAcademyClientStateForFreshAuth() {
    localStorage.removeItem('yh_academy_access');
    localStorage.removeItem('yh_academy_home');
    localStorage.removeItem('yh_academy_membership_status_v1');
    localStorage.removeItem('yh_academy_application_profile');
    localStorage.removeItem('yh_academy_roadmap_profile_v1');
    localStorage.removeItem('yh_academy_roadmap_locked_v1');
    localStorage.removeItem('yh_admin_panel_state_v2');
    localStorage.removeItem('yh_admin_panel_state_v3_live');
    sessionStorage.removeItem('yh_force_academy_application_after_auth');
}

function persistClientSession(user, token) {
    const fullName = String(
        user?.fullName ||
        user?.name ||
        user?.displayName ||
        user?.username ||
        'Hustler'
    ).trim();

    const username = String(user?.username || '').trim();
    const email = String(user?.email || '').trim().toLowerCase();
    const existingAvatar = String(
        sessionStorage.getItem('yh_user_avatar') ||
        localStorage.getItem('yh_user_avatar') ||
        sessionStorage.getItem('yh_pending_profile_avatar') ||
        localStorage.getItem('yh_pending_profile_avatar') ||
        ''
    ).trim();

    const avatar = String(
        user?.avatar ||
        user?.profilePhoto ||
        user?.profilePhotoDataUrl ||
        existingAvatar ||
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

        if (avatar) {
            store.setItem('yh_user_avatar', avatar);
            store.removeItem('yh_pending_profile_avatar');
        }
    });
}

const YH_LANDING_FEED_DEFAULTS = [
    {
        id: 'academy_live_placeholder_1',
        pointId: '',
        label: 'Academy Live Activity',
        feedText: 'Waiting for new Academy activity.',
        locationText: '',
        createdAt: ''
    },
    {
        id: 'academy_live_placeholder_2',
        pointId: '',
        label: 'Academy Growth',
        feedText: 'Real Academy events will appear here as they happen.',
        locationText: '',
        createdAt: ''
    },
    {
        id: 'academy_live_placeholder_3',
        pointId: '',
        label: 'Globe Sync',
        feedText: 'Each Academy event lights up its real city and country.',
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
        focusPoint: result.focusPoint || null
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
        focusPoint: result.focusPoint || null
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

    const isDesktopHero = window.innerWidth >= 1101;

    const overscanX = isDesktopHero ? 1.42 : 1;
    const overscanY = isDesktopHero ? 1.24 : 1;

    const nextWidth = Math.max(1, Math.round(mapEl.clientWidth * overscanX));
    const nextHeight = Math.max(1, Math.round(mapEl.clientHeight * overscanY));

    yhLandingMapInstance
        .width(nextWidth)
        .height(nextHeight);

    const renderer = typeof yhLandingMapInstance.renderer === 'function'
        ? yhLandingMapInstance.renderer()
        : null;

    const canvasEl = renderer && renderer.domElement ? renderer.domElement : null;
    if (!canvasEl) return;

    mapEl.style.position = 'absolute';
    mapEl.style.inset = '0';
    mapEl.style.overflow = 'visible';
    mapEl.style.background = 'transparent';
    mapEl.style.border = 'none';
    mapEl.style.outline = 'none';
    mapEl.style.boxShadow = 'none';
    mapEl.style.clipPath = 'none';
    mapEl.style.maskImage = 'none';
    mapEl.style.webkitMaskImage = 'none';

    canvasEl.style.position = 'absolute';
    canvasEl.style.top = '50%';
    canvasEl.style.left = '50%';
    canvasEl.style.right = 'auto';
    canvasEl.style.bottom = 'auto';
    canvasEl.style.width = `${nextWidth}px`;
    canvasEl.style.height = `${nextHeight}px`;
    canvasEl.style.maxWidth = 'none';
    canvasEl.style.maxHeight = 'none';
    canvasEl.style.background = 'transparent';
    canvasEl.style.border = 'none';
    canvasEl.style.outline = 'none';
    canvasEl.style.boxShadow = 'none';
    canvasEl.style.pointerEvents = 'auto';
    canvasEl.style.overflow = 'visible';
    canvasEl.style.clipPath = 'none';
    canvasEl.style.maskImage = 'none';
    canvasEl.style.webkitMaskImage = 'none';
    canvasEl.style.borderRadius = '0';

    canvasEl.style.transform = isDesktopHero
        ? 'translate(-61%, -51%)'
        : 'translate(-50%, -50%)';
}

function bindLandingGlobeResize() {
    if (yhLandingResizeBound) return;
    yhLandingResizeBound = true;

    window.addEventListener('resize', () => {
        syncLandingGlobeSize();
    }, { passive: true });
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

    const membersEl = document.getElementById('yh-stat-members');
    const reachEl = document.getElementById('yh-stat-reach');
    const impressionsEl = document.getElementById('yh-stat-impressions');

    animateLandingStat(membersEl, 1284, 1400);
    animateLandingStat(reachEl, 86, 1200);
    animateLandingStat(impressionsEl, 18492, 1550);

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
        controls.enableZoom = true;
        controls.zoomSpeed = 1.08;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        if (typeof world.getGlobeRadius === 'function') {
            const globeRadius = world.getGlobeRadius();
            controls.minDistance = globeRadius * 0.16;
            controls.maxDistance = Infinity;
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

    const syncZoomGate = (clientX, clientY) => {
        if (!controls) return;
        controls.enableZoom = isPointerOnVisibleGlobe(clientX, clientY);
    };

    const wheelTarget = (
        renderer &&
        renderer.domElement
    ) ? renderer.domElement : mapEl;

    const handleWheelZoomGate = (event) => {
        if (!controls) return;

        const isOnSphere = isPointerOnVisibleGlobe(event.clientX, event.clientY);
        controls.enableZoom = isOnSphere;

        if (!isOnSphere) {
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            } else {
                event.stopPropagation();
            }
            return;
        }

        event.preventDefault();
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

    initLandingMapShell();

    // --- CARD FLIP LOGIC ---
    const flipper = document.getElementById('auth-flipper');
    const btnFlipRegister = document.getElementById('btn-flip-register');
    const btnFlipLogin = document.getElementById('btn-flip-login');
    const triggerArea = document.querySelector('.flip-trigger-area');

    const flipToRegister = () => flipper.classList.add('is-flipped');
    const flipToLogin = () => flipper.classList.remove('is-flipped');

    if (btnFlipRegister) btnFlipRegister.addEventListener('click', flipToRegister);
    if (btnFlipLogin) btnFlipLogin.addEventListener('click', flipToLogin);
    if (triggerArea) {
        triggerArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('auth-stop-propagation')) return;
            flipToRegister();
        });
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

    const identifier = loginEmailInput?.value?.trim() || '';
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

    setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
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

    const scrollToTarget = (target) => {
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const openAuthPanel = () => {
        scrollToTarget(authSection);
    };

    const btnTopbar = document.getElementById('yh-scroll-auth');
    const btnHero = document.getElementById('yh-open-auth-main');
    const btnAcademy = document.getElementById('yh-open-auth-academy');
    const btnDivisions = document.getElementById('yh-scroll-divisions');

    if (btnTopbar) btnTopbar.addEventListener('click', () => openAuthPanel());
    if (btnHero) btnHero.addEventListener('click', () => openAuthPanel());
    if (btnAcademy) btnAcademy.addEventListener('click', () => openAuthPanel());
    if (btnDivisions) btnDivisions.addEventListener('click', () => scrollToTarget(divisionsSection));

    document.querySelectorAll('.yh-coming-soon-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const label = button.getAttribute('data-soon') || 'This division';
            showToast(
                yhTText('{{division}} is coming soon to Young Hustlers Universe.', { division: label }),
                'success'
            );
        });
    });
});