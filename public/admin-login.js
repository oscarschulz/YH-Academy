function getAdminTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const adminIndex = parts.indexOf('admin');

  if (adminIndex === -1) return '';
  return String(parts[adminIndex + 1] || '').trim();
}

function buildAdminPanelUrl(routeToken) {
  return `/admin/${encodeURIComponent(routeToken)}/panel`;
}

function setMessage(text, type = '') {
  const el = document.getElementById('admin-auth-message');
  if (!el) return;
  el.className = `admin-auth-message ${type}`.trim();
  el.textContent = text;
}

function disableLoginForm(message) {
  const userEl = document.getElementById('admin-username');
  const passEl = document.getElementById('admin-password');
  const submitEl = document.getElementById('admin-login-submit');
  const routeStatus = document.getElementById('admin-auth-route-status');

  if (userEl) userEl.disabled = true;
  if (passEl) passEl.disabled = true;
  if (submitEl) submitEl.disabled = true;
  if (routeStatus) routeStatus.textContent = message;
}

async function checkExistingAdminSession(routeToken) {
  try {
    const res = await fetch('/api/admin/session', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => null);
    if (!data?.success) return false;

    window.location.replace(buildAdminPanelUrl(routeToken));
    return true;
  } catch {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const routeToken = getAdminTokenFromPath();
  const form = document.getElementById('admin-login-form');
  const submitEl = document.getElementById('admin-login-submit');
  const routeStatus = document.getElementById('admin-auth-route-status');

  if (!routeToken) {
    disableLoginForm('Invalid secure route token.');
    setMessage('Access denied. This route token is not valid.', 'error');
    return;
  }

  if (routeStatus) {
    routeStatus.textContent = 'Secure route token detected.';
  }

  const alreadyLoggedIn = await checkExistingAdminSession(routeToken);
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
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          gate: routeToken,
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
      window.location.replace(data.redirectTo || buildAdminPanelUrl(routeToken));
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