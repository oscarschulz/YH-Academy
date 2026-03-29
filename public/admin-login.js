function getAdminTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const adminIndex = parts.indexOf('admin');

  if (adminIndex === -1) return '';
  return String(parts[adminIndex + 1] || '').trim();
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

document.addEventListener('DOMContentLoaded', () => {
  const routeToken = getAdminTokenFromPath();
  const form = document.getElementById('admin-login-form');
  const routeStatus = document.getElementById('admin-auth-route-status');
  const submitEl = document.getElementById('admin-login-submit');

  if (!routeToken) {
    disableLoginForm('Invalid secure route token.');
    setMessage('Access denied. This route token is not valid.', 'error');
    return;
  }

  if (routeStatus) {
    routeStatus.textContent = 'Secure route token detected.';
  }

  if (!form) return;

  form.method = 'post';
  form.action = window.location.pathname;

  form.addEventListener('submit', () => {
    if (submitEl) {
      submitEl.disabled = true;
      submitEl.textContent = 'Verifying...';
    }

    setMessage('Verifying admin credentials...', '');
  });
});