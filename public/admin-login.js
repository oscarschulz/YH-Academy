function getAdminRouteKeyFromLoginPath() {
  const match =
    window.location.pathname.match(
      /^\/admin\/([A-Za-z0-9_-]{32,128})\/login\/?$/
    );

  return match?.[1] || '';
}

function buildAdminPanelUrl() {
  const routeKey =
    getAdminRouteKeyFromLoginPath();

  if (!routeKey) {
    return '/';
  }

  return `/admin/${encodeURIComponent(routeKey)}/panel`;
}

function buildAdminLoginApiUrl() {
  const routeKey =
    getAdminRouteKeyFromLoginPath();

  if (!routeKey) {
    return '';
  }

  return `/api/admin/${encodeURIComponent(routeKey)}/login`;
}

function buildAdminSessionApiUrl() {
  const routeKey =
    getAdminRouteKeyFromLoginPath();

  if (!routeKey) {
    return '';
  }

  return `/api/admin/${encodeURIComponent(routeKey)}/session`;
}

function setMessage(text, type = '') {
  const el = document.getElementById('admin-auth-message');
  if (!el) return;
  el.className = `admin-auth-message ${type}`.trim();
  el.textContent = text;
}

async function checkExistingAdminSession() {
  try {
    const sessionUrl =
      buildAdminSessionApiUrl();

    if (!sessionUrl) {
      return false;
    }

    const res =
      await fetch(sessionUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    if (!data?.success) return false;

    window.location.replace(buildAdminPanelUrl());
    return true;
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('admin-login-form');
  const submitEl = document.getElementById('admin-login-submit');
  const routeStatus = document.getElementById('admin-auth-route-status');


  if (routeStatus) {
    routeStatus.textContent = 'Secure admin access.';
  }

  const alreadyLoggedIn = await checkExistingAdminSession();
  if (alreadyLoggedIn) return;

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = String(document.getElementById('admin-username')?.value || '').trim();
    const password = String(document.getElementById('admin-password')?.value || '');

    if (!username || !password) {
      setMessage('Enter your admin username and password.', 'error');
      return;
    }

    if (submitEl) {
      submitEl.disabled = true;
      submitEl.textContent = 'Verifying...';
    }

    setMessage('Verifying admin credentials...');

    try {
      const loginUrl =
        buildAdminLoginApiUrl();

      if (!loginUrl) {
        setMessage(
          'Invalid admin access route.',
          'error'
        );

        return;
      }

      const res =
        await fetch(loginUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setMessage(data?.message || 'Unable to sign in to admin panel.', 'error');
        return;
      }

      setMessage('Access granted. Redirecting to admin panel...', 'success');
      window.location.replace(data.redirectTo || buildAdminPanelUrl());
    } catch (error) {
      setMessage('Network error while signing in. Please try again.', 'error');
    } finally {
      if (submitEl) {
        submitEl.disabled = false;
        submitEl.textContent = 'Enter Admin Panel ➔';
      }
    }
  });
});