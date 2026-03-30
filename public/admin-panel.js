const STORAGE_KEY = 'yh_admin_panel_state_v3_live';

function getAdminTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const adminIndex = parts.indexOf('admin');

  if (adminIndex === -1) return '';
  return String(parts[adminIndex + 1] || '').trim();
}

function buildAdminLoginUrl() {
  const routeToken = getAdminTokenFromPath();
  return routeToken ? `/admin/${encodeURIComponent(routeToken)}/login` : '/';
}

function enforceAdminPanelAccess() {
  const routeToken = getAdminTokenFromPath();

  if (!routeToken) {
    window.location.replace('/');
    return false;
  }

  return true;
}

async function logoutAdminSession() {
  try {
    const res = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await res.json().catch(() => null);
    window.location.replace(data?.redirectTo || buildAdminLoginUrl());
  } catch {
    window.location.replace(buildAdminLoginUrl());
  }
}
const defaultState = () => ({
  ui: {
    currentView: 'overview',
    globalSearch: ''
  },
  settings: {
    allowAutoApproveAcademy: false,
    requireFederationManualReview: true,
    requirePlazaListingReview: true,
    enableAiNudges: true,
    maintenanceMode: false
  },
  roles: [],
  applications: [],
  members: [],
  academy: [],
  federation: [],
  plazas: [],
  support: [],
  broadcasts: [],
  analytics: {
    finance: {
      totalRevenue: 0,
      monthlyRevenue: 0,
      averageOrderValue: 0,
      profitMargin: 0,
      countriesReached: 0,
      averageReviewDays: 0
    },
    targets: {
      membersGoal: 0,
      federationGoal: 0,
      monthlyRevenueGoal: 0,
      plazasGoal: 0
    },
    monthly: [],
    revenueMix: [],
    regions: []
  }
});

let state = defaultState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return mergeState(defaultState(), parsed);
  } catch {
    return defaultState();
  }
}

async function loadAdminBootstrap() {
  try {
    const res = await fetch('/api/admin/bootstrap', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to load admin bootstrap.');
    }

    state = mergeState(defaultState(), data.state || {});
    saveState();
    renderApp();
  } catch (error) {
    console.error('loadAdminBootstrap error:', error);
    state = loadState();
    renderApp();
  }
}

function mergeState(base, incoming) {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }

  if (base && typeof base === 'object') {
    const output = { ...base };
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    Object.keys(base).forEach(key => {
      output[key] = mergeState(base[key], source[key]);
    });
    return output;
  }

  return incoming === undefined ? base : incoming;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = defaultState();
  saveState();
  renderApp();
  showToast('Demo data reset.');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const isMobile = window.innerWidth <= 980;

  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.right = 'auto';
  toast.style.top = isMobile ? '84px' : '96px';
  toast.style.bottom = 'auto';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '10000';
  toast.style.width = isMobile ? 'calc(100vw - 32px)' : 'min(90vw, 420px)';
  toast.style.maxWidth = isMobile ? '360px' : '420px';
  toast.style.padding = isMobile ? '10px 12px' : '11px 14px';
  toast.style.borderRadius = isMobile ? '10px' : '12px';
  toast.style.fontSize = isMobile ? '0.84rem' : '0.9rem';
  toast.style.lineHeight = '1.35';
  toast.style.textAlign = 'center';
  toast.style.boxSizing = 'border-box';
  toast.style.wordBreak = 'break-word';

  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatBadge(value) {
  const map = {
    New: 'blue',
    'Under Review': 'amber',
    Approved: 'green',
    Rejected: 'red',
    Waitlisted: 'purple',
    'Needs More Info': 'cyan',
    Active: 'green',
    Pending: 'amber',
    Suspended: 'red',
    Flagged: 'red',
    'On Track': 'green',
    'Needs Review': 'amber',
    'At Risk': 'red',
    Candidate: 'blue',
    'Under Vetting': 'amber',
    Verified: 'green',
    Hold: 'gray',
    'Strategic Priority': 'purple',
    'Pending Review': 'amber',
    Archived: 'gray',
    Open: 'blue',
    'In Progress': 'amber',
    'Waiting on User': 'gray',
    Escalated: 'red',
    Resolved: 'green',
    Service: 'cyan',
    Job: 'blue',
    Request: 'purple',
    Low: 'gray',
    Medium: 'amber',
    High: 'red',
    Academy: 'blue',
    Federation: 'purple',
    Plazas: 'cyan',
    Academic: 'blue',
    Financial: 'green',
    Physical: 'cyan',
    Mental: 'purple',
    Access: 'blue',
    Dispute: 'red',
    Profile: 'gray',
    Policy: 'purple',
    Investor: 'green',
    Lawyer: 'blue',
    Operator: 'amber',
    Creator: 'cyan',
    'All Members': 'gray',
    'Pending Applicants': 'amber'
  };
  const tone = map[value] || 'gray';
  return `<span class="badge badge-${tone}">${escapeHtml(value)}</span>`;
}

function findById(collection, id) {
  return state[collection].find(item => item.id === id);
}

function matchesSearch(record, query) {
  if (!query) return true;
  const haystack = JSON.stringify(record).toLowerCase();
  return haystack.includes(query.toLowerCase());
}
function makeCell(label, content, className = '') {
  return `<td data-label="${escapeHtml(label)}"${className ? ` class="${className}"` : ''}>${content}</td>`;
}

function makeEmptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`;
}

function setView(view) {
  state.ui.currentView = view;
  saveState();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(section => {
    const isActive = section.id === `view-${view}`;
    section.classList.toggle('active', isActive);
    section.toggleAttribute('data-app-active', isActive);
  });

  const desktopLabel =
    document.querySelector(`.sidebar .nav-item[data-view="${view}"]`)?.textContent?.trim()
    || document.querySelector(`.app-bottom-nav .nav-item[data-view="${view}"] .app-nav-label`)?.textContent?.trim()
    || 'Overview';

  const title = document.getElementById('page-title');
  if (title) title.textContent = desktopLabel;

  const appTitle = document.getElementById('app-page-title');
  if (appTitle) appTitle.textContent = desktopLabel;

  document.body.dataset.currentView = view;

  if (window.innerWidth <= 980) {
    closeDrawer();
    requestAnimationFrame(() => {
      const mainPanel = document.querySelector('.main-panel');
      if (mainPanel) mainPanel.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function ensureAnalyticsLayout() {
  const analyticsView = document.getElementById('view-analytics');
  if (!analyticsView) return;

  analyticsView.innerHTML = `
    <div class="stats-grid analytics-top-stats" id="analytics-stats"></div>

    <div class="content-grid analytics-grid-main">
      <article class="panel-card analytics-hero-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Overall Performance</p>
            <h3>YH Growth & Revenue Trend</h3>
          </div>
          <div class="analytics-mini-meta" id="analytics-hero-meta"></div>
        </div>
        <div id="analytics-hero-chart" class="line-chart-card"></div>
      </article>

      <article class="panel-card analytics-side-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Goal Tracking</p>
            <h3>Target Progress</h3>
          </div>
        </div>
        <div id="analytics-target-progress" class="stack-list"></div>
      </article>
    </div>

    <div class="content-grid analytics-grid-secondary">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Division Growth</p>
            <h3>Member Distribution</h3>
          </div>
        </div>
        <div id="analytics-division-bars" class="bars-list"></div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Geographic Reach</p>
            <h3>YH Expansion Map</h3>
          </div>
        </div>
        <div id="analytics-regions" class="bars-list"></div>
      </article>
    </div>

    <div class="content-grid analytics-grid-secondary">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Revenue Breakdown</p>
            <h3>Division Revenue Mix</h3>
          </div>
        </div>
        <div id="analytics-revenue-mix" class="bars-list"></div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Operational Ratios</p>
            <h3>Conversion, Activity & User Count</h3>
          </div>
        </div>
        <div id="analytics-ratios" class="stack-list"></div>
      </article>
    </div>
  `;
}

function createLineChartSVG(seriesA, seriesB) {
  const width = 920;
  const height = 270;
  const padding = { top: 24, right: 24, bottom: 40, left: 28 };

  const maxValue = Math.max(
    ...seriesA.map(item => item.revenue),
    ...seriesB.map(item => item.members * 55),
    1
  );

  const xForIndex = (index, total) =>
    padding.left + ((width - padding.left - padding.right) * index) / Math.max(1, total - 1);

  const yForValue = value =>
    height - padding.bottom - ((height - padding.top - padding.bottom) * value) / maxValue;

  const revenuePoints = seriesA
    .map((item, index) => `${xForIndex(index, seriesA.length)},${yForValue(item.revenue)}`)
    .join(' ');

  const memberPoints = seriesB
    .map((item, index) => `${xForIndex(index, seriesB.length)},${yForValue(item.members * 55)}`)
    .join(' ');

  const revenueArea = `${padding.left},${height - padding.bottom} ${revenuePoints} ${xForIndex(seriesA.length - 1, seriesA.length)},${height - padding.bottom}`;
  const memberArea = `${padding.left},${height - padding.bottom} ${memberPoints} ${xForIndex(seriesB.length - 1, seriesB.length)},${height - padding.bottom}`;

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(77,139,255,.42)" />
            <stop offset="100%" stop-color="rgba(77,139,255,0)" />
          </linearGradient>
          <linearGradient id="mem-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(34,211,238,.26)" />
            <stop offset="100%" stop-color="rgba(34,211,238,0)" />
          </linearGradient>
        </defs>

        <polygon points="${revenueArea}" fill="url(#rev-fill)"></polygon>
        <polygon points="${memberArea}" fill="url(#mem-fill)"></polygon>

        <polyline points="${memberPoints}" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <polyline points="${revenuePoints}" fill="none" stroke="#4d8bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>

        ${seriesA.map((item, index) => `
          <circle cx="${xForIndex(index, seriesA.length)}" cy="${yForValue(item.revenue)}" r="4.5" fill="#4d8bff"></circle>
        `).join('')}

        ${seriesB.map((item, index) => `
          <circle cx="${xForIndex(index, seriesB.length)}" cy="${yForValue(item.members * 55)}" r="3.2" fill="#22d3ee"></circle>
        `).join('')}
      </svg>
    </div>

    <div class="chart-axis-labels">
      ${seriesA.map(item => `<span>${escapeHtml(item.month)}</span>`).join('')}
    </div>

    <div class="chart-legend">
      <span class="chart-legend-item">
        <i class="chart-legend-swatch" style="background:#4d8bff"></i>
        Revenue Trend
      </span>
      <span class="chart-legend-item">
        <i class="chart-legend-swatch" style="background:#22d3ee"></i>
        Growth Index
      </span>
    </div>
  `;
}
function getAnalyticsMembershipMetrics() {
  const uniqueUsers = state.members.length;

  const divisionCounts = {
    Academy: state.members.filter(member => member.divisions.includes('Academy')).length,
    Federation: state.members.filter(member => member.divisions.includes('Federation')).length,
    Plazas: state.members.filter(member => member.divisions.includes('Plazas')).length
  };

  const totalMemberships = state.members.reduce((sum, member) => {
    return sum + new Set(member.divisions || []).size;
  }, 0);

  const overlapUsers = state.members.filter(member => new Set(member.divisions || []).size > 1).length;

  return {
    uniqueUsers,
    totalMemberships,
    overlapUsers,
    divisionCounts
  };
}


function getAnalyticsMembershipMetrics() {
  const uniqueUsers = state.members.length;

  const divisionCounts = {
    Academy: state.members.filter(member => member.divisions.includes('Academy')).length,
    Federation: state.members.filter(member => member.divisions.includes('Federation')).length,
    Plazas: state.members.filter(member => member.divisions.includes('Plazas')).length
  };

  const totalMemberships = state.members.reduce((sum, member) => {
    return sum + new Set(member.divisions || []).size;
  }, 0);

  const overlapUsers = state.members.filter(member => new Set(member.divisions || []).size > 1).length;
  const singleDivisionUsers = Math.max(0, uniqueUsers - overlapUsers);
  const avgMembershipsPerUser = uniqueUsers ? (totalMemberships / uniqueUsers) : 0;
  const overlapRate = uniqueUsers ? Math.round((overlapUsers / uniqueUsers) * 100) : 0;
  const singleDivisionRate = uniqueUsers ? Math.round((singleDivisionUsers / uniqueUsers) * 100) : 0;

  const overlapMatrix = {
    academyOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && !d.has('Federation') && !d.has('Plazas');
    }).length,
    federationOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && d.has('Federation') && !d.has('Plazas');
    }).length,
    plazasOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && !d.has('Federation') && d.has('Plazas');
    }).length,
    academyFederation: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && d.has('Federation') && !d.has('Plazas');
    }).length,
    academyPlazas: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && !d.has('Federation') && d.has('Plazas');
    }).length,
    federationPlazas: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && d.has('Federation') && d.has('Plazas');
    }).length,
    allThree: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && d.has('Federation') && d.has('Plazas');
    }).length
  };

  const analytics = state.analytics || defaultState().analytics;
  const rawMonthly = Array.isArray(analytics.monthly) && analytics.monthly.length
    ? analytics.monthly
    : [{ month: 'Now', members: uniqueUsers }];

  const lastRawMembers = rawMonthly[rawMonthly.length - 1]?.members || uniqueUsers || 1;
  const scale = uniqueUsers > 0 ? (uniqueUsers / Math.max(1, lastRawMembers)) : 1;

  const monthlyTrend = rawMonthly.map(item => {
    const scaledUnique = Math.max(0, Math.round((item.members || 0) * scale));
    const scaledMemberships = Math.max(scaledUnique, Math.round(scaledUnique * Math.max(1, avgMembershipsPerUser)));
    return {
      month: item.month,
      uniqueUsers: scaledUnique,
      memberships: scaledMemberships
    };
  });

  if (monthlyTrend.length) {
    monthlyTrend[monthlyTrend.length - 1].uniqueUsers = uniqueUsers;
    monthlyTrend[monthlyTrend.length - 1].memberships = totalMemberships;
  }

  const monthlyGrowth = monthlyTrend.map((item, index) => {
    const prev = monthlyTrend[index - 1];
    return {
      ...item,
      newUsers: index === 0 ? item.uniqueUsers : item.uniqueUsers - prev.uniqueUsers,
      newMemberships: index === 0 ? item.memberships : item.memberships - prev.memberships
    };
  });

  return {
    uniqueUsers,
    totalMemberships,
    divisionCounts,
    overlapUsers,
    singleDivisionUsers,
    avgMembershipsPerUser,
    overlapRate,
    singleDivisionRate,
    overlapMatrix,
    monthlyGrowth
  };
}
function renderOverview() {
  const overviewStatsEl = document.getElementById('overview-stats');
  const priorityActionsEl = document.getElementById('priority-actions');
  const systemAlertsEl = document.getElementById('system-alerts');
  const overviewApplicationsTableEl = document.getElementById('overview-applications-table');
  const divisionSnapshotEl = document.getElementById('division-snapshot');

  const totalMembers = state.members.length;
  const pendingApplications = state.applications.filter(a =>
    ['New', 'Under Review', 'Needs More Info'].includes(a.status)
  ).length;
  const academyActive = state.academy.filter(a => a.status === 'On Track').length;
  const flaggedListings = state.plazas.filter(l => l.status === 'Flagged').length;

  if (overviewStatsEl) {
    overviewStatsEl.innerHTML = [
      {
        label: 'Total Members',
        value: totalMembers,
        foot: `${state.members.filter(m => m.status === 'Active').length} active now`
      },
      {
        label: 'Pending Applications',
        value: pendingApplications,
        foot: 'Needs intake action'
      },
      {
        label: 'Academy On Track',
        value: academyActive,
        foot: `${state.academy.length} roadmap records`
      },
      {
        label: 'Flagged Listings',
        value: flaggedListings,
        foot: `${state.support.filter(t => t.type === 'Dispute').length} related tickets`
      }
    ].map(card => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  if (priorityActionsEl) {
    const actions = [
      `${pendingApplications} applications need review`,
      `${state.support.filter(t => t.status === 'Open').length} support tickets still open`,
      `${state.academy.filter(a => a.status !== 'On Track').length} Academy members need intervention`,
      `${flaggedListings} Plazas listings need moderation`
    ];

    priorityActionsEl.innerHTML = actions.map((text, index) => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>Queue ${index + 1}</strong>
          ${formatBadge(index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low')}
        </div>
        <p>${escapeHtml(text)}</p>
      </div>
    `).join('');
  }

  if (systemAlertsEl) {
    const alerts = [
      state.settings.maintenanceMode
        ? 'Maintenance mode is enabled.'
        : 'System stable. No maintenance mode active.',
      state.settings.requirePlazaListingReview
        ? 'Plazas manual listing review is ON.'
        : 'Plazas listings are auto-publishing.',
      state.settings.requireFederationManualReview
        ? 'Federation manual review is enforced.'
        : 'Federation auto-routing is active.'
    ];

    systemAlertsEl.innerHTML = alerts.map(text => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>System Notice</strong>
          ${formatBadge(text.includes('ON') || text.includes('enforced') ? 'Medium' : 'Active')}
        </div>
        <p>${escapeHtml(text)}</p>
      </div>
    `).join('');
  }

  if (overviewApplicationsTableEl) {
    overviewApplicationsTableEl.innerHTML = state.applications
      .slice()
      .sort((a, b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
      .slice(0, 5)
      .map(app => `
        <tr>
          ${makeCell('Name', `<strong>${escapeHtml(app.name)}</strong><div class="muted mono">${escapeHtml(app.id)}</div>`)}
          ${makeCell('Email', escapeHtml(app.email || ''))}
          ${makeCell('Type', formatBadge(app.recommendedDivision || 'Academy'))}
          ${makeCell('Source', escapeHtml(app.source || ''))}
          ${makeCell('Goal / Background', `<div>${escapeHtml(app.goal || '')}</div><div class="muted">${escapeHtml(app.background || '')}</div>`)}
          ${makeCell('Recommended', formatBadge(app.recommendedDivision || 'Academy'))}
          ${makeCell('Status', formatBadge(app.status || 'Under Review'))}
          ${makeCell('AI Score', `${Number(app.aiScore || 0)}`)}
          ${makeCell('Actions', `<button class="badge-btn" data-open="application" data-id="${app.id}">Open</button>`)}
        </tr>
      `).join('') || makeEmptyRow(9, 'No applications yet.');
  }

  if (divisionSnapshotEl) {
    const divisionCounts = {
      Academy: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Academy')).length,
      Federation: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Federation')).length,
      Plazas: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Plazas')).length
    };

    divisionSnapshotEl.innerHTML = Object.entries(divisionCounts).map(([name, count]) => `
      <div class="snapshot-item">
        <div class="snapshot-item-head">
          <strong>${escapeHtml(name)}</strong>
          ${formatBadge(name)}
        </div>
        <p>${escapeHtml(count)} linked members</p>
      </div>
    `).join('');
  }
}
function renderApplications() {
  const statusFilter = document.getElementById('applications-status-filter').value;
  const divisionFilter = document.getElementById('applications-division-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.applications.filter(app => {
    return (statusFilter === 'all' || app.status === statusFilter)
      && (divisionFilter === 'all' || app.recommendedDivision === divisionFilter)
      && matchesSearch(app, query);
  });

  document.getElementById('applications-table').innerHTML = rows.map(app => {
    const appTypeLabel = String(app.applicationType || 'general')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const appSource = String(app.source || 'Unknown').trim() || 'Unknown';

    const goalAndBackground = [
      String(app.goal || '').trim(),
      String(app.background || '').trim()
    ].filter(Boolean).join(' • ') || 'No summary submitted.';

    return `
      <tr>
        ${makeCell('Name', `<strong>${escapeHtml(app.name)}</strong><div class="muted mono">${escapeHtml(app.id)}</div>`)}
        ${makeCell('Email', escapeHtml(app.email || '—'))}
        ${makeCell('Type', formatBadge(appTypeLabel))}
        ${makeCell('Source', escapeHtml(appSource))}
        ${makeCell('Goal / Background', escapeHtml(goalAndBackground))}
        ${makeCell('Recommended', formatBadge(app.recommendedDivision))}
        ${makeCell('Status', formatBadge(app.status))}
        ${makeCell('AI Score', `${Number(app.aiScore || 0)}`)}
        ${makeCell('Actions', `
          <div class="table-actions">
            <button data-open="application" data-id="${app.id}">View</button>
            <button data-action="approve-application" data-id="${app.id}">Approve</button>
            <button data-action="reject-application" data-id="${app.id}">Reject</button>
            <button data-action="waitlist-application" data-id="${app.id}">Waitlist</button>
          </div>
        `)}
      </tr>
    `;
  }).join('') || makeEmptyRow(9, 'No applications match the current filters.');
}

function renderMembers() {
  const divisionFilter = document.getElementById('members-division-filter').value;
  const statusFilter = document.getElementById('members-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.members.filter(member => {
    return (divisionFilter === 'all' || member.divisions.includes(divisionFilter))
      && (statusFilter === 'all' || member.status === statusFilter)
      && matchesSearch(member, query);
  });

    document.getElementById('members-table').innerHTML = rows.map(member => `
    <tr>
      ${makeCell('Member', `<strong>${escapeHtml(member.name)}</strong><div class="muted mono">${escapeHtml(member.username)}</div>`)}
      ${makeCell('Divisions', member.divisions.map(formatBadge).join(' '))}
      ${makeCell('Status', formatBadge(member.status))}
      ${makeCell('Activity', `${member.activityScore}`)}
      ${makeCell('Roadmap', escapeHtml(member.roadmapStatus))}
      ${makeCell('Last Login', escapeHtml(member.lastLogin))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="member" data-id="${member.id}">Open</button>
          <button data-action="toggle-member-status" data-id="${member.id}">${member.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No members match the current filters.');
}

function renderAcademy() {
  const focusFilter = document.getElementById('academy-focus-filter').value;
  const reviewFilter = document.getElementById('academy-review-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.academy.filter(item => {
    return (focusFilter === 'all' || item.focus === focusFilter)
      && (reviewFilter === 'all' || item.status === reviewFilter)
      && matchesSearch(item, query);
  });

  const stats = [
    { label: 'Roadmap Records', value: state.academy.length, foot: 'Tracked in current system' },
    { label: 'Needs Review', value: state.academy.filter(a => a.status === 'Needs Review').length, foot: 'Records missing a live roadmap' },
    { label: 'At Risk', value: state.academy.filter(a => a.status === 'At Risk').length, foot: 'Low momentum members' }
  ];

  document.getElementById('academy-stats').innerHTML = stats.map(card => `
    <article class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(card.value)}</div>
      <div class="stat-foot">${escapeHtml(card.foot)}</div>
    </article>
  `).join('');

    document.getElementById('academy-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Member', `<strong>${escapeHtml(item.memberName)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Current Phase', escapeHtml(item.phase))}
      ${makeCell('Focus', formatBadge(item.focus))}
      ${makeCell('Completion', `
        <strong>${item.completion}%</strong>
        <div class="progress"><i style="width:${item.completion}%"></i></div>
      `)}
      ${makeCell('Last Check-In', escapeHtml(item.lastCheckIn))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="academy" data-id="${item.id}">Open</button>
          <button data-action="academy-nudge" data-id="${item.id}">Nudge</button>
          <button data-action="academy-track" data-id="${item.id}">Mark On Track</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No Academy records match the current filters.');
}

function renderFederation() {
  const statusFilter = document.getElementById('federation-status-filter').value;
  const tagFilter = document.getElementById('federation-tag-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.federation.filter(item => {
    return (statusFilter === 'all' || item.status === statusFilter)
      && (tagFilter === 'all' || item.tag === tagFilter)
      && matchesSearch(item, query);
  });

    document.getElementById('federation-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Candidate', `<strong>${escapeHtml(item.name)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Profession', escapeHtml(item.profession))}
      ${makeCell('Region', escapeHtml(item.region))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Influence', `${item.influence}`)}
      ${makeCell('Tag', formatBadge(item.tag))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="federation" data-id="${item.id}">Open</button>
          <button data-action="federation-verify" data-id="${item.id}">Verify</button>
          <button data-action="federation-priority" data-id="${item.id}">Priority</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No Federation candidates match the current filters.');
}

function renderPlazas() {
  const typeFilter = document.getElementById('plazas-type-filter').value;
  const statusFilter = document.getElementById('plazas-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.plazas.filter(item => {
    return (typeFilter === 'all' || item.type === typeFilter)
      && (statusFilter === 'all' || item.status === statusFilter)
      && matchesSearch(item, query);
  });

    document.getElementById('plazas-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Listing', `<strong>${escapeHtml(item.title)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Owner', escapeHtml(item.owner))}
      ${makeCell('Type', formatBadge(item.type))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Reports', `${item.reports}`)}
      ${makeCell('Region', escapeHtml(item.region))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="plazas" data-id="${item.id}">Open</button>
          <button data-action="plazas-approve" data-id="${item.id}">Approve</button>
          <button data-action="plazas-feature" data-id="${item.id}">${item.featured ? 'Unfeature' : 'Feature'}</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No Plazas listings match the current filters.');
}

function renderBroadcasts() {
  document.getElementById('broadcast-history').innerHTML = state.broadcasts
    .slice()
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .map(item => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(item.subject)}</strong>
          ${formatBadge(item.audience)}
        </div>
        <p>${escapeHtml(item.message)}</p>
        <p class="muted">Sent: ${escapeHtml(item.sentAt)}</p>
      </div>
    `).join('');
}

function renderSupport() {
  const statusFilter = document.getElementById('support-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.support.filter(item => (statusFilter === 'all' || item.status === statusFilter) && matchesSearch(item, query));

    document.getElementById('support-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Ticket', `<strong>${escapeHtml(item.title)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Reporter', escapeHtml(item.reporter))}
      ${makeCell('Type', formatBadge(item.type))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Priority', formatBadge(item.priority))}
      ${makeCell('Updated', escapeHtml(item.updatedAt))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="support" data-id="${item.id}">Open</button>
          <button data-action="support-progress" data-id="${item.id}">Progress</button>
          <button data-action="support-resolve" data-id="${item.id}">Resolve</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No support items match the current filters.');
}

function renderAnalytics() {
  const analytics = state.analytics || defaultState().analytics;
  const metrics = getAnalyticsMembershipMetrics();

  const approvedApps = state.applications.filter(a => a.status === 'Approved').length;
  const approvalRate = Math.round((approvedApps / Math.max(1, state.applications.length)) * 100);
  const activeMembers = state.members.filter(m => m.status === 'Active').length;
  const activeRate = Math.round((activeMembers / Math.max(1, state.members.length)) * 100);
  const plazasActive = state.plazas.filter(l => l.status === 'Active').length;

  const monthlySeries = Array.isArray(analytics.monthly) && analytics.monthly.length
    ? analytics.monthly
    : [{ month: 'Now', revenue: 0, members: metrics.uniqueUsers || 0 }];

  const revenueMix = Array.isArray(analytics.revenueMix) ? analytics.revenueMix : [];
  const regions = Array.isArray(analytics.regions) ? analytics.regions : [];

  const latestMonthly = monthlySeries[monthlySeries.length - 1] || { month: 'Now', revenue: 0, members: 0 };
  const prevMonthly = monthlySeries[monthlySeries.length - 2] || latestMonthly;

  const revenueDelta = Number(latestMonthly.revenue || 0) - Number(prevMonthly.revenue || 0);
  const growthDelta = Number(latestMonthly.members || 0) - Number(prevMonthly.members || 0);

  const analyticsStatsEl = document.getElementById('analytics-stats');
  if (analyticsStatsEl) {
    analyticsStatsEl.innerHTML = [
      { label: 'Total Revenue', value: formatCurrency(analytics.finance?.totalRevenue || 0), foot: 'All-time YH revenue' },
      { label: 'Monthly Revenue', value: formatCurrency(analytics.finance?.monthlyRevenue || 0), foot: `${revenueDelta >= 0 ? '+' : ''}${formatCurrency(revenueDelta)} vs last month` },
      { label: 'Member Reach', value: latestMonthly.members || 0, foot: `${analytics.finance?.countriesReached || 0} countries reached` },
      { label: 'Overall Unique Users', value: metrics.uniqueUsers, foot: 'Deduplicated overall member count' },
      { label: 'Total Memberships', value: metrics.totalMemberships, foot: 'All division memberships combined' },
      { label: 'Overlap Users', value: metrics.overlapUsers, foot: 'Users inside more than one division' },
      { label: 'Approval Rate', value: `${approvalRate}%`, foot: `${approvedApps}/${state.applications.length} approved` },
      { label: 'Active Member Rate', value: `${activeRate}%`, foot: `${activeMembers}/${state.members.length} active` },
      { label: 'Avg Review Days', value: analytics.finance?.averageReviewDays || 0, foot: `${plazasActive} active listings live` }
    ].map(card => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  const analyticsHeroMetaEl = document.getElementById('analytics-hero-meta');
  if (analyticsHeroMetaEl) {
    analyticsHeroMetaEl.innerHTML = `
      <span class="analytics-mini-pill">Revenue now ${formatCurrency(latestMonthly.revenue || 0)}</span>
      <span class="analytics-mini-pill">Growth ${growthDelta >= 0 ? '+' : ''}${growthDelta} members</span>
      <span class="analytics-mini-pill">${metrics.uniqueUsers} unique users</span>
      <span class="analytics-mini-pill">${analytics.finance?.countriesReached || 0} countries active</span>
    `;
  }

  const analyticsHeroChartEl = document.getElementById('analytics-hero-chart');
  if (analyticsHeroChartEl) {
    analyticsHeroChartEl.innerHTML = createLineChartSVG(monthlySeries, monthlySeries);
  }

  const targetProgress = [
    {
      title: 'Member goal',
      current: latestMonthly.members || 0,
      goal: analytics.targets?.membersGoal || 0,
      sub: 'How close YH is to the next membership milestone'
    },
    {
      title: 'Federation target',
      current: state.federation.length * 18,
      goal: analytics.targets?.federationGoal || 0,
      sub: 'Strategic network build-out'
    },
    {
      title: 'Monthly revenue target',
      current: analytics.finance?.monthlyRevenue || 0,
      goal: analytics.targets?.monthlyRevenueGoal || 0,
      sub: 'Income progress toward monthly target'
    },
    {
      title: 'Plazas activation goal',
      current: state.plazas.length * 28,
      goal: analytics.targets?.plazasGoal || 0,
      sub: 'Marketplace opportunity coverage'
    }
  ];

  const analyticsTargetProgressEl = document.getElementById('analytics-target-progress');
  if (analyticsTargetProgressEl) {
    analyticsTargetProgressEl.innerHTML = targetProgress.map(item => {
      const pct = item.goal > 0 ? Math.min(100, Math.round((item.current / item.goal) * 100)) : 0;

      return `
        <div class="stack-item">
          <div class="stack-item-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${pct}%</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <p>${escapeHtml(item.sub)}</p>
        </div>
      `;
    }).join('');
  }

  const analyticsDivisionBarsEl = document.getElementById('analytics-division-bars');
  if (analyticsDivisionBarsEl) {
    const divisionBars = [
      { label: 'Academy', value: metrics.divisionCounts?.Academy || 0 },
      { label: 'Federation', value: metrics.divisionCounts?.Federation || 0 },
      { label: 'Plazas', value: metrics.divisionCounts?.Plazas || 0 }
    ];

    const maxDivision = Math.max(...divisionBars.map(item => item.value), 1);

    analyticsDivisionBarsEl.innerHTML = divisionBars.map(item => {
      const pct = Math.round((item.value / maxDivision) * 100);
      return `
        <div class="bar-item">
          <div class="bar-item-head">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${item.value}</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
        </div>
      `;
    }).join('');
  }

  const analyticsRegionsEl = document.getElementById('analytics-regions');
  if (analyticsRegionsEl) {
    if (!regions.length) {
      analyticsRegionsEl.innerHTML = `<div class="stack-item"><p class="muted">No regional analytics loaded yet.</p></div>`;
    } else {
      const maxRegionRevenue = Math.max(...regions.map(item => Number(item.revenue || 0)), 1);

      analyticsRegionsEl.innerHTML = regions.map(item => {
        const pct = Math.round((Number(item.revenue || 0) / maxRegionRevenue) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-head">
              <strong>${escapeHtml(item.name || 'Unknown')}</strong>
              <span>${Number(item.members || 0)} members</span>
            </div>
            <div class="progress"><i style="width:${pct}%"></i></div>
          </div>
        `;
      }).join('');
    }
  }

  const analyticsRevenueMixEl = document.getElementById('analytics-revenue-mix');
  if (analyticsRevenueMixEl) {
    if (!revenueMix.length) {
      analyticsRevenueMixEl.innerHTML = `<div class="stack-item"><p class="muted">No revenue mix loaded yet.</p></div>`;
    } else {
      const maxRevenueMix = Math.max(...revenueMix.map(item => Number(item.revenue || 0)), 1);

      analyticsRevenueMixEl.innerHTML = revenueMix.map(item => {
        const pct = Math.round((Number(item.revenue || 0) / maxRevenueMix) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-head">
              <strong>${escapeHtml(item.division || 'Unknown')}</strong>
              <span>${formatCurrency(item.revenue || 0)}</span>
            </div>
            <div class="progress"><i style="width:${pct}%"></i></div>
          </div>
        `;
      }).join('');
    }
  }

  const analyticsRatiosEl = document.getElementById('analytics-ratios');
  if (analyticsRatiosEl) {
    analyticsRatiosEl.innerHTML = [
      { label: 'Average memberships per user', value: metrics.avgMembershipsPerUser?.toFixed?.(2) || '0.00' },
      { label: 'Overlap rate', value: `${metrics.overlapRate || 0}%` },
      { label: 'Single-division rate', value: `${metrics.singleDivisionRate || 0}%` }
    ].map(item => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.value)}</span>
        </div>
      </div>
    `).join('');
  }
}

function renderSettings() {
document.getElementById('roles-list').innerHTML = state.roles.length
  ? state.roles.map(role => `
      <div class="role-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(role.name)}</strong>
          ${formatBadge('Active')}
        </div>
        <p>${escapeHtml((role.permissions || []).join(' • '))}</p>
      </div>
    `).join('')
  : `<div class="stack-item"><p class="muted">No live roles loaded yet.</p></div>`;

  const labels = {
    allowAutoApproveAcademy: 'Allow Academy auto-approval',
    requireFederationManualReview: 'Require Federation manual review',
    requirePlazaListingReview: 'Require Plazas manual listing review',
    enableAiNudges: 'Enable AI nudges',
    maintenanceMode: 'Maintenance mode'
  };

  document.getElementById('settings-form').innerHTML = Object.entries(state.settings).map(([key, value]) => `
    <div class="toggle-item switch-row">
      <div>
        <strong>${escapeHtml(labels[key])}</strong>
        <p>Toggle this operational rule for the current admin environment.</p>
      </div>
      <label class="switch">
        <input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''} />
        <span></span>
      </label>
    </div>
  `).join('');
}

function getDrawerTemplate(type, record) {
  if (!record) return '<div class="drawer-section"><p class="muted">Record not found.</p></div>';

if (type === 'application') {
  const notes = Array.isArray(record.notes) ? record.notes : [record.notes].filter(Boolean);
  const skills = Array.isArray(record.skills) ? record.skills.filter(Boolean) : [];
  const profile = record.academyProfile && typeof record.academyProfile === 'object'
    ? record.academyProfile
    : null;

  const appTypeLabel = String(record.applicationType || 'general')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return `
    <div class="drawer-section">
      <h4>Applicant Summary</h4>
      <div class="kv-grid">
        <div class="kv"><span>Name</span><strong>${escapeHtml(record.name)}</strong></div>
        <div class="kv"><span>Username</span><strong>${escapeHtml(record.username || '—')}</strong></div>
        <div class="kv"><span>Email</span><strong>${escapeHtml(record.email || '—')}</strong></div>
        <div class="kv"><span>Type</span>${formatBadge(appTypeLabel)}</div>
        <div class="kv"><span>Recommended</span>${formatBadge(record.recommendedDivision)}</div>
        <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
        <div class="kv"><span>Source</span><strong>${escapeHtml(record.source || 'Unknown')}</strong></div>
        <div class="kv"><span>Submitted</span><strong>${escapeHtml(record.submittedAt || 'Unknown')}</strong></div>
        <div class="kv"><span>AI Score</span><strong>${Number(record.aiScore || 0)}</strong></div>
        <div class="kv"><span>Country</span><strong>${escapeHtml(record.country || '—')}</strong></div>
      </div>
    </div>

    <div class="drawer-section">
      <h4>Intent</h4>
      <p><strong>Goal:</strong> ${escapeHtml(record.goal || '—')}</p>
      <p><strong>Background:</strong> ${escapeHtml(record.background || '—')}</p>
      <p><strong>Network Value:</strong> ${escapeHtml(record.networkValue || 'Unknown')}</p>
      <p><strong>Skills:</strong> ${escapeHtml(skills.join(', ') || '—')}</p>
    </div>

    ${profile ? `
      <div class="drawer-section">
        <h4>Academy Application Details</h4>
        <div class="kv-grid">
          <div class="kv"><span>Occupation Type</span><strong>${escapeHtml(profile.occupationType || '—')}</strong></div>
          <div class="kv"><span>Current Job / Business</span><strong>${escapeHtml(profile.currentJob || '—')}</strong></div>
          <div class="kv"><span>Industry</span><strong>${escapeHtml(profile.industry || '—')}</strong></div>
          <div class="kv"><span>Income Source</span><strong>${escapeHtml(profile.incomeSource || '—')}</strong></div>
          <div class="kv"><span>Business Stage</span><strong>${escapeHtml(profile.businessStage || '—')}</strong></div>
          <div class="kv"><span>Seriousness</span><strong>${escapeHtml(profile.seriousness || '—')}</strong></div>
          <div class="kv"><span>Weekly Hours</span><strong>${escapeHtml(profile.weeklyHours || '—')}</strong></div>
          <div class="kv"><span>Coach Tone</span><strong>${escapeHtml(profile.coachTone || '—')}</strong></div>
        </div>
        <p><strong>Why join Academy:</strong> ${escapeHtml(profile.joinReason || '—')}</p>
        <p><strong>6-month goals:</strong> ${escapeHtml(profile.goals6mo || '—')}</p>
        <p><strong>Main blocker:</strong> ${escapeHtml(profile.blockerText || '—')}</p>
        <p><strong>Bad habit:</strong> ${escapeHtml(profile.badHabit || '—')}</p>
      </div>
    ` : ''}

    <div class="drawer-section">
      <h4>Internal Notes</h4>
      <div class="stack-list">
        ${notes.length ? notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('') : '<div class="stack-item"><p>No notes yet.</p></div>'}
      </div>
      <div class="inline-actions">
        <button class="badge-btn" data-action="approve-application" data-id="${record.id}">Approve</button>
        <button class="badge-btn" data-action="reject-application" data-id="${record.id}">Reject</button>
        <button class="badge-btn" data-action="waitlist-application" data-id="${record.id}">Waitlist</button>
      </div>
    </div>
  `;
}

  if (type === 'member') {
    return `
      <div class="drawer-section">
        <h4>Member Snapshot</h4>
        <div class="kv-grid">
          <div class="kv"><span>Name</span><strong>${escapeHtml(record.name)}</strong></div>
          <div class="kv"><span>Username</span><strong>${escapeHtml(record.username)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Risk Flag</span>${formatBadge(record.riskFlag)}</div>
          <div class="kv"><span>Divisions</span><div class="list-chips">${record.divisions.map(formatBadge).join('')}</div></div>
          <div class="kv"><span>Activity Score</span><strong>${record.activityScore}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Operational Notes</h4>
        <p><strong>Roadmap:</strong> ${escapeHtml(record.roadmapStatus)}</p>
        <p><strong>Last Login:</strong> ${escapeHtml(record.lastLogin)}</p>
        <p><strong>Joined:</strong> ${escapeHtml(record.joinedAt)}</p>
        <div class="stack-list">${record.notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('')}</div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="toggle-member-status" data-id="${record.id}">${record.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
        </div>
      </div>
    `;
  }

  if (type === 'academy') {
    return `
      <div class="drawer-section">
        <h4>Roadmap Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Member</span><strong>${escapeHtml(record.memberName)}</strong></div>
          <div class="kv"><span>Focus</span>${formatBadge(record.focus)}</div>
          <div class="kv"><span>Phase</span><strong>${escapeHtml(record.phase)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
        </div>
        <div class="progress"><i style="width:${record.completion}%"></i></div>
        <p class="muted">Completion: ${record.completion}%</p>
      </div>
      <div class="drawer-section">
        <h4>Action Path</h4>
        <p><strong>Next Action:</strong> ${escapeHtml(record.nextAction)}</p>
        <p><strong>Last Check-In:</strong> ${escapeHtml(record.lastCheckIn)}</p>
        <div class="stack-list">${record.notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('')}</div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="academy-nudge" data-id="${record.id}">Send Nudge</button>
          <button class="badge-btn" data-action="academy-track" data-id="${record.id}">Mark On Track</button>
        </div>
      </div>
    `;
  }

  if (type === 'federation') {
    return `
      <div class="drawer-section">
        <h4>Candidate Intelligence</h4>
        <div class="kv-grid">
          <div class="kv"><span>Name</span><strong>${escapeHtml(record.name)}</strong></div>
          <div class="kv"><span>Profession</span><strong>${escapeHtml(record.profession)}</strong></div>
          <div class="kv"><span>Region</span><strong>${escapeHtml(record.region)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Tag</span>${formatBadge(record.tag)}</div>
          <div class="kv"><span>Influence</span><strong>${record.influence}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Strategic Notes</h4>
        <p><strong>Referred By:</strong> ${escapeHtml(record.referredBy)}</p>
        <p><strong>Strategic Value:</strong> ${escapeHtml(record.strategicValue)}</p>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="federation-verify" data-id="${record.id}">Verify</button>
          <button class="badge-btn" data-action="federation-priority" data-id="${record.id}">Make Priority</button>
        </div>
      </div>
    `;
  }

  if (type === 'plazas') {
    return `
      <div class="drawer-section">
        <h4>Listing Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Title</span><strong>${escapeHtml(record.title)}</strong></div>
          <div class="kv"><span>Owner</span><strong>${escapeHtml(record.owner)}</strong></div>
          <div class="kv"><span>Type</span>${formatBadge(record.type)}</div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Reports</span><strong>${record.reports}</strong></div>
          <div class="kv"><span>Region</span><strong>${escapeHtml(record.region)}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Moderator Notes</h4>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <p><strong>Featured:</strong> ${record.featured ? 'Yes' : 'No'}</p>
        <div class="inline-actions">
          <button class="badge-btn" data-action="plazas-approve" data-id="${record.id}">Approve</button>
          <button class="badge-btn" data-action="plazas-feature" data-id="${record.id}">${record.featured ? 'Unfeature' : 'Feature'}</button>
        </div>
      </div>
    `;
  }

  if (type === 'support') {
    return `
      <div class="drawer-section">
        <h4>Ticket Snapshot</h4>
        <div class="kv-grid">
          <div class="kv"><span>Ticket</span><strong>${escapeHtml(record.id)}</strong></div>
          <div class="kv"><span>Reporter</span><strong>${escapeHtml(record.reporter)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Priority</span>${formatBadge(record.priority)}</div>
          <div class="kv"><span>Type</span>${formatBadge(record.type)}</div>
          <div class="kv"><span>Updated</span><strong>${escapeHtml(record.updatedAt)}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Ticket Notes</h4>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="support-progress" data-id="${record.id}">Move Progress</button>
          <button class="badge-btn" data-action="support-resolve" data-id="${record.id}">Resolve</button>
        </div>
      </div>
    `;
  }

  return '<div class="drawer-section"><p class="muted">No detail template found.</p></div>';
}

function openDrawer(type, id) {
  const map = {
    application: 'applications',
    member: 'members',
    academy: 'academy',
    federation: 'federation',
    plazas: 'plazas',
    support: 'support'
  };

  const collection = map[type];
  const record = collection ? findById(collection, id) : null;
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  document.getElementById('drawer-type').textContent = type[0].toUpperCase() + type.slice(1);
  document.getElementById('drawer-title').textContent = record?.name || record?.title || record?.memberName || id;
  document.getElementById('drawer-body').innerHTML = getDrawerTemplate(type, record);

  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  if (backdrop) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('show'));
  }

  document.body.classList.add('drawer-open');
}

function closeDrawer() {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  if (backdrop) {
    backdrop.classList.remove('show');
    setTimeout(() => {
      if (!drawer || !drawer.classList.contains('open')) backdrop.hidden = true;
    }, 220);
  }

  document.body.classList.remove('drawer-open');
}

function syncMemberFromApplication(application) {
  const exists = state.members.some(member => member.email && application.email && member.email === application.email);
  if (exists) return;

  const newMemberId = `MEM-${Date.now().toString().slice(-6)}`;
  const isAcademyMembership = String(application.applicationType || '').trim().toLowerCase() === 'academy-membership';

  state.members.unshift({
    id: newMemberId,
    name: application.name,
    username: application.username
      ? `@${String(application.username).replace(/^@+/, '')}`
      : `@${application.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    email: application.email,
    divisions: [application.recommendedDivision],
    status: 'Active',
    activityScore: 50,
    roadmapStatus: isAcademyMembership
      ? 'Ready for roadmap setup'
      : application.recommendedDivision === 'Academy'
        ? 'Roadmap live'
        : 'Not assigned',
    riskFlag: 'Low',
    joinedAt: new Date().toISOString().slice(0, 10),
    lastLogin: 'Just now',
    notes: [
      `Created from ${application.id} approval.`,
      ...(isAcademyMembership ? ['Academy membership approved. User can now generate a roadmap instantly from the Roadmap tab.'] : [])
    ]
  });

  return newMemberId;
}

async function handleAction(action, id) {
  switch (action) {
case 'approve-application': {
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ decision: 'approve' })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to approve application.');
    }

    await loadAdminBootstrap();
    showToast('Application approved.');
  } catch (error) {
    showToast(error.message || 'Failed to approve application.');
  }
  break;
}
case 'reject-application': {
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ decision: 'reject' })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to reject application.');
    }

    await loadAdminBootstrap();
    showToast('Application rejected.');
  } catch (error) {
    showToast(error.message || 'Failed to reject application.');
  }
  break;
}
case 'waitlist-application': {
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ decision: 'waitlist' })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to waitlist application.');
    }

    await loadAdminBootstrap();
    showToast('Application waitlisted.');
  } catch (error) {
    showToast(error.message || 'Failed to waitlist application.');
  }
  break;
}
    case 'toggle-member-status': {
      const member = findById('members', id);
      if (!member) return;
      member.status = member.status === 'Suspended' ? 'Active' : 'Suspended';
      member.notes.unshift(`Status changed to ${member.status}.`);
      saveState();
      renderApp();
      showToast(`${member.name} is now ${member.status}.`);
      break;
    }
    case 'academy-nudge': {
      const record = findById('academy', id);
      if (!record) return;
      record.notes.unshift('Manual nudge sent by admin.');
      record.lastCheckIn = 'Nudge sent';
      state.broadcasts.unshift({
        id: `BC-${Date.now().toString().slice(-6)}`,
        audience: record.memberName,
        subject: 'Manual roadmap nudge',
        message: `Admin sent a roadmap nudge for ${record.focus.toLowerCase()} focus.`,
        sentAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });
      saveState();
      renderApp();
      showToast(`Nudge sent to ${record.memberName}.`);
      break;
    }
    case 'academy-track': {
      const record = findById('academy', id);
      if (!record) return;
      record.status = 'On Track';
      record.notes.unshift('Marked on track by admin.');
      saveState();
      renderApp();
      showToast(`${record.memberName} marked on track.`);
      break;
    }
    case 'federation-verify': {
      const record = findById('federation', id);
      if (!record) return;
      record.status = 'Verified';
      record.notes.unshift('Verified by admin.');
      saveState();
      renderApp();
      showToast(`${record.name} verified.`);
      break;
    }
    case 'federation-priority': {
      const record = findById('federation', id);
      if (!record) return;
      record.status = 'Strategic Priority';
      record.notes.unshift('Elevated to strategic priority.');
      saveState();
      renderApp();
      showToast(`${record.name} is now strategic priority.`);
      break;
    }
    case 'plazas-approve': {
      const record = findById('plazas', id);
      if (!record) return;
      record.status = 'Active';
      record.notes.unshift('Approved by moderator.');
      saveState();
      renderApp();
      showToast(`Listing ${record.title} approved.`);
      break;
    }
    case 'plazas-feature': {
      const record = findById('plazas', id);
      if (!record) return;
      record.featured = !record.featured;
      record.notes.unshift(record.featured ? 'Featured on marketplace.' : 'Removed from featured.');
      saveState();
      renderApp();
      showToast(`${record.title} ${record.featured ? 'featured' : 'unfeatured'}.`);
      break;
    }
    case 'support-progress': {
      const record = findById('support', id);
      if (!record) return;
      record.status = record.status === 'Open' ? 'In Progress' : 'Waiting on User';
      record.updatedAt = 'Just now';
      record.notes.unshift(`Ticket moved to ${record.status}.`);
      saveState();
      renderApp();
      showToast(`Ticket ${record.id} updated.`);
      break;
    }
    case 'support-resolve': {
      const record = findById('support', id);
      if (!record) return;
      record.status = 'Resolved';
      record.updatedAt = 'Just now';
      record.notes.unshift('Resolved by admin.');
      saveState();
      renderApp();
      showToast(`Ticket ${record.id} resolved.`);
      break;
    }
    default:
      break;
  }
}

function renderApp() {
  ensureAnalyticsLayout();
  setView(state.ui.currentView);

    const globalSearch = document.getElementById('global-search');
  if (globalSearch) globalSearch.value = state.ui.globalSearch;

  const globalSearchDesktop = document.getElementById('global-search-desktop');
  if (globalSearchDesktop) globalSearchDesktop.value = state.ui.globalSearch;

  renderOverview();
  renderApplications();
  renderMembers();
  renderAcademy();
  renderFederation();
  renderPlazas();
  renderBroadcasts();
  renderSupport();
  renderAnalytics();
  renderSettings();
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
      saveState();
    });
  });

    ['global-search', 'global-search-desktop'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', (e) => {
      state.ui.globalSearch = e.target.value.trim();
      saveState();
      renderApp();
    });
  });

  [
    'applications-status-filter',
    'applications-division-filter',
    'members-division-filter',
    'members-status-filter',
    'academy-focus-filter',
    'academy-review-filter',
    'federation-status-filter',
    'federation-tag-filter',
    'plazas-type-filter',
    'plazas-status-filter',
    'support-status-filter'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderApp);
  });

  document.body.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open]');
    const actionBtn = e.target.closest('[data-action]');

    if (openBtn) {
      openDrawer(openBtn.dataset.open, openBtn.dataset.id);
      return;
    }

    if (actionBtn) {
      handleAction(actionBtn.dataset.action, actionBtn.dataset.id);
      return;
    }
  });

    const closeDrawerBtn = document.getElementById('close-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeDrawer);
  }

  const drawerBackdrop = document.getElementById('drawer-backdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeDrawer);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

const broadcastTemplate = document.getElementById('broadcast-template');
if (broadcastTemplate) {
  broadcastTemplate.addEventListener('change', () => {
    const subjectEl = document.getElementById('broadcast-subject');
    const messageEl = document.getElementById('broadcast-message');

    if (subjectEl) subjectEl.value = '';
    if (messageEl) messageEl.value = '';
  });
}

  const broadcastForm = document.getElementById('broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const audienceEl = document.getElementById('broadcast-audience');
      const subjectEl = document.getElementById('broadcast-subject');
      const messageEl = document.getElementById('broadcast-message');

      const audience = audienceEl ? audienceEl.value : '';
      const subject = subjectEl ? subjectEl.value.trim() : '';
      const message = messageEl ? messageEl.value.trim() : '';

      if (!subject || !message) return;

      state.broadcasts.unshift({
        id: `BC-${Date.now().toString().slice(-6)}`,
        audience,
        subject,
        message,
        sentAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
      });

      saveState();
      renderBroadcasts();
      broadcastForm.reset();
      showToast(`Broadcast sent to ${audience}.`);
    });
  }

  document.body.addEventListener('change', (e) => {
    const toggle = e.target.closest('[data-setting]');
    if (!toggle) return;

    state.settings[toggle.dataset.setting] = toggle.checked;
    saveState();
    renderOverview();
    showToast('Operational setting updated.');
  });


  ['export-state-btn', 'export-state-btn-desktop'].forEach(id => {
    const exportBtn = document.getElementById(id);
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yh-admin-state.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('State exported.');
      });
    }
  });
  ['admin-logout-btn', 'admin-logout-btn-desktop'].forEach(id => {
  const logoutBtn = document.getElementById(id);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutAdminSession);
  }
});
}

if (enforceAdminPanelAccess()) {
  bindEvents();
  loadAdminBootstrap();
}