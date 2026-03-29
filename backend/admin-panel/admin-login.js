const ADMIN_ROUTE_TOKEN = 'Q7vN2kLp8Xr4Ta1M';
const ADMIN_SESSION_KEY = 'yh_admin_session_v1';
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const ADMIN_USERNAME = 'yhsuperadmin';
const ADMIN_PASSWORD = 'YHAdmin#2026!';

const ADMIN_PANEL_PATH = '/admin-panel.html';

function getGateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('gate') || '').trim();
}

function buildAdminPanelUrl() {
  return `${ADMIN_PANEL_PATH}?gate=${encodeURIComponent(ADMIN_ROUTE_TOKEN)}`;
}

function readAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAdminSessionValid(session) {
  if (!session || typeof session !== 'object') return false;
  if (session.routeToken !== ADMIN_ROUTE_TOKEN) return false;
  if (session.username !== ADMIN_USERNAME) return false;
  if (!session.createdAt) return false;

  return (Date.now() - Number(session.createdAt)) < ADMIN_SESSION_MAX_AGE_MS;
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
  const gate = getGateFromUrl();

  if (gate !== ADMIN_ROUTE_TOKEN) {
    disableLoginForm('Invalid secure route token.');
    setMessage('Access denied. This route token is not valid.', 'error');
    return;
  }

  const existingSession = readAdminSession();
  if (isAdminSessionValid(existingSession)) {
    window.location.replace(buildAdminPanelUrl());
    return;
  }

  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = String(document.getElementById('admin-username')?.value || '').trim();
    const password = String(document.getElementById('admin-password')?.value || '');

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      setMessage('Invalid admin credentials.', 'error');
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      username,
      routeToken: ADMIN_ROUTE_TOKEN,
      createdAt: Date.now(),
      role: 'Super Admin'
    }));

    setMessage('Access granted. Redirecting to admin panel...', 'success');
    window.location.replace(buildAdminPanelUrl());
  });
});