
/* Native-only YHU maintenance guard. */
(function () {
  'use strict';

  if (window.YHMaintenanceGuard) return;

  const SERVER = 'https://www.younghustlersuniverse.com';
  const STORAGE_KEY = 'yh_native_maintenance_active';
  const CHECK_INTERVAL_MS = 6000;
  const boundSockets = new WeakSet();

  let checking = false;
  let navigating = false;
  let active = false;

  try {
    active = sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {}

  function isLandingPage() {
    const pathname =
      window.location.pathname.replace(/\/+$/, '') || '/';

    return [
      '/',
      '/index.html',
      '/apply',
      '/apply.html',
      '/apply/index.html'
    ].includes(pathname);
  }

  function showMaintenanceModal() {
    if (document.getElementById('yh-native-maintenance-cover')) {
      return;
    }

    if (!document.body) {
      document.addEventListener(
        'DOMContentLoaded',
        showMaintenanceModal,
        { once: true }
      );
      return;
    }

    const style = document.createElement('style');
    style.id = 'yh-native-maintenance-style';

    style.textContent = `
      html.yh-native-maintenance,
      html.yh-native-maintenance body {
        overflow: hidden !important;
      }

      html.yh-native-maintenance
      body > :not(#yh-native-maintenance-cover) {
        pointer-events: none !important;
      }

      #yh-native-maintenance-cover {
        position: fixed;
        inset: 0;
        z-index: 2147483647;

        display: grid;
        place-items: center;

        padding:
          max(20px, env(safe-area-inset-top))
          18px
          max(20px, env(safe-area-inset-bottom));

        background: rgba(2, 6, 23, 0.77);

        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);

        font-family:
          Poppins,
          system-ui,
          sans-serif;

        color: #f8fafc;
        text-align: center;
        touch-action: none;
      }

      #yh-native-maintenance-cover .yh-m-card {
        width: min(100%, 480px);

        padding: 38px 26px;

        border: 1px solid rgba(125, 180, 255, 0.28);
        border-radius: 26px;

        background: rgba(9, 18, 35, 0.97);

        box-shadow:
          0 30px 90px rgba(0, 0, 0, 0.65);
      }

      #yh-native-maintenance-cover img {
        display: block;

        width: 66px;
        height: 66px;

        object-fit: contain;

        margin: 0 auto;
      }

      #yh-native-maintenance-cover h1 {
        margin: 20px 0 12px;

        font-size: clamp(26px, 6vw, 38px);
        line-height: 1.2;
      }

      #yh-native-maintenance-cover p {
        margin: 0;

        color: #b9c8dd;

        font-size: 14px;
        line-height: 1.7;
      }

      #yh-native-maintenance-cover .yh-m-status {
        display: inline-block;

        margin-top: 24px;
        padding: 10px 16px;

        border: 1px solid rgba(77, 139, 255, 0.3);
        border-radius: 99px;

        color: #c5dcff;
        font-size: 12px;
      }
    `;

    const cover = document.createElement('div');

    cover.id = 'yh-native-maintenance-cover';

    cover.setAttribute('role', 'dialog');
    cover.setAttribute('aria-modal', 'true');
    cover.setAttribute(
      'aria-labelledby',
      'yh-native-maintenance-title'
    );

    cover.innerHTML = `
      <div class="yh-m-card">

        <img
          src="/images/logo.avif"
          alt="Young Hustlers Universe"
        >

        <h1 id="yh-native-maintenance-title">
          We're under maintenance
        </h1>

        <p>
          Young Hustlers Universe is temporarily
          unavailable while we improve the platform.
          We'll be back soon.
        </p>

        <span class="yh-m-status" role="status">
          Maintenance in progress
        </span>

      </div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(cover);

    document.documentElement.classList.add(
      'yh-native-maintenance'
    );

    if (
      document.documentElement.getAttribute(
        'data-yh-native-session'
      ) === 'checking'
    ) {
      document.documentElement.setAttribute(
        'data-yh-native-session',
        'maintenance'
      );
    }

    Promise.resolve(
      window.YHNativeRuntime?.hideNativeSplashScreen?.(
        'maintenance'
      )
    ).catch(() => {});
  }

  function goToLanding() {
    try {
      if (
        window.top &&
        window.top !== window &&
        window.top.location.origin === window.location.origin
      ) {
        window.top.location.replace('/index.html');
        return;
      }
    } catch (_) {
      // Restricted iframe: navigate its own window.
    }

    window.location.replace('/index.html');
  }

  function enableMaintenance() {
    active = true;

    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}

    if (navigating) return;

    if (!isLandingPage()) {
      navigating = true;

      document.documentElement.style.pointerEvents = 'none';

      goToLanding();
      return;
    }

    showMaintenanceModal();
  }

  function disableMaintenance() {
    if (!active || navigating) return;

    active = false;

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    navigating = true;

    goToLanding();
  }

  function attachSocket(socket) {
    if (
      !socket ||
      typeof socket.on !== 'function' ||
      boundSockets.has(socket)
    ) {
      return false;
    }

    boundSockets.add(socket);

    socket.on('maintenanceMode', function (payload) {
      if (payload?.enabled === true) {
        enableMaintenance();
      }

      if (payload?.enabled === false) {
        void checkStatus();
      }
    });

    return true;
  }

  async function checkStatus() {
    if (
      checking ||
      navigating ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    checking = true;

    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(),
      8000
    );

    try {
      const response = await fetch(
        `${SERVER}/?yh_maintenance_probe=${Date.now()}`,
        {
          method: 'HEAD',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (response.status === 503) {
        const confirmation = await fetch(
          `${SERVER}/api/__yh_maintenance_probe`,
          {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,

            headers: {
              Accept: 'application/json'
            }
          }
        );

        const payload = await confirmation
          .json()
          .catch(() => null);

        if (
          confirmation.status === 503 &&
          payload?.code === 'maintenance_mode' &&
          payload?.maintenanceMode === true
        ) {
          enableMaintenance();
        }
      } else if (response.ok) {
        disableMaintenance();
      }
    } catch (_) {
      // A network error alone does not prove maintenance mode.
    } finally {
      window.clearTimeout(timeout);
      checking = false;
    }
  }

  window.YHMaintenanceGuard = Object.freeze({
    attachSocket,
    checkStatus
  });

  if (active) {
    enableMaintenance();
  }

  window.setInterval(
    checkStatus,
    CHECK_INTERVAL_MS
  );

  window.addEventListener(
    'pageshow',
    checkStatus
  );

  window.addEventListener(
    'online',
    checkStatus
  );

  document.addEventListener(
    'visibilitychange',
    function () {
      if (document.visibilityState === 'visible') {
        void checkStatus();
      }
    }
  );

  void checkStatus();
})();
