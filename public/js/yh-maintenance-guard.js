
/* Central YHU maintenance guard. */
(function () {
  'use strict';

  if (window.YHMaintenanceGuard) return;

  const CHECK_INTERVAL_MS = 6000;
  const boundSockets = new WeakSet();

  let checkPending = false;
  let redirecting = false;

  function showMaintenanceNotice() {
    if (redirecting) return;
    redirecting = true;

    // Prevent interaction while the notice loads.
    document.documentElement.style.pointerEvents = 'none';

    try {
      if (
        window.top &&
        window.top.location.origin === window.location.origin
      ) {
        window.top.location.replace('/');
        return;
      }
    } catch (_) {
      // Restricted iframe: navigate its own window.
    }

    window.location.replace('/');
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
      if (payload && payload.enabled === true) {
        showMaintenanceNotice();
      }
    });

    return true;
  }

  async function checkStatus() {
    if (
      redirecting ||
      checkPending ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    checkPending = true;

    try {
      const response = await fetch('/?yh_maintenance_probe=1', {
        method: 'HEAD',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'text/html'
        }
      });

      // Existing server maintenance response sets Retry-After.
      if (
        response.status === 503 &&
        response.headers.has('Retry-After')
      ) {
        showMaintenanceNotice();
      }
    } catch (_) {
      // Network failure alone does not prove maintenance mode.
    } finally {
      checkPending = false;
    }
  }

  window.YHMaintenanceGuard = Object.freeze({
    attachSocket,
    checkStatus
  });

  window.setInterval(checkStatus, CHECK_INTERVAL_MS);

  window.addEventListener('pageshow', checkStatus);
  window.addEventListener('online', checkStatus);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      checkStatus();
    }
  });

  checkStatus();
})();
