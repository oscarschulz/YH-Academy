const STORAGE_KEY = 'yh_admin_panel_state_v2';

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
  roles: [
    { id: 'r1', name: 'Super Admin', permissions: ['all access', 'member control', 'system settings'] },
    { id: 'r2', name: 'Operations Admin', permissions: ['applications', 'members', 'support', 'communications'] },
    { id: 'r3', name: 'Academy Admin', permissions: ['academy monitoring', 'roadmap override', 'nudges'] },
    { id: 'r4', name: 'Federation Admin', permissions: ['vetting', 'strategic tags', 'network notes'] },
    { id: 'r5', name: 'Plazas Admin', permissions: ['listing moderation', 'disputes', 'market safety'] }
  ],
  applications: [
    {
      id: 'APP-1001',
      name: 'Jerwin M.',
      email: 'jerwin@yhmail.com',
      goal: 'Needs clear roadmap for self-improvement and business focus.',
      background: 'Student entrepreneur with discipline and learning goals.',
      recommendedDivision: 'Academy',
      status: 'New',
      aiScore: 91,
      country: 'Philippines',
      skills: ['Sales', 'Research'],
      networkValue: 'Medium',
      source: 'Website Apply',
      submittedAt: '2026-03-21 10:23',
      notes: ['Strong fit for Academy onboarding.']
    },
    {
      id: 'APP-1002',
      name: 'Amina Kolade',
      email: 'amina@outlook.com',
      goal: 'Wants strategic introductions for cross-border trade and policy visibility.',
      background: 'Public sector advisor with Africa trade network.',
      recommendedDivision: 'Federation',
      status: 'Under Review',
      aiScore: 88,
      country: 'Nigeria',
      skills: ['Policy', 'Trade'],
      networkValue: 'High',
      source: 'Referral',
      submittedAt: '2026-03-21 14:40',
      notes: ['Potential strategic priority. Needs manual vetting.']
    },
    {
      id: 'APP-1003',
      name: 'Diego Ramos',
      email: 'diego@proton.me',
      goal: 'Wants to offer creative automation services and hire SDR talent.',
      background: 'Automation operator with small team.',
      recommendedDivision: 'Plazas',
      status: 'Waitlisted',
      aiScore: 79,
      country: 'Spain',
      skills: ['Automation', 'Ops'],
      networkValue: 'Medium',
      source: 'X Community',
      submittedAt: '2026-03-20 17:20',
      notes: ['Good Plazas fit after basic qualification.']
    },
    {
      id: 'APP-1004',
      name: 'Maya Chen',
      email: 'maya@signalmail.com',
      goal: 'Wants accountability system for academic and physical growth.',
      background: 'Engineering student with strong consistency issue.',
      recommendedDivision: 'Academy',
      status: 'Approved',
      aiScore: 86,
      country: 'Singapore',
      skills: ['Design', 'Engineering'],
      networkValue: 'Low',
      source: 'Landing Page',
      submittedAt: '2026-03-20 12:10',
      notes: ['Approved for phase 1 roadmap.']
    },
    {
      id: 'APP-1005',
      name: 'Tunde Afolabi',
      email: 'tunde@rise.net',
      goal: 'Wants access but submitted incomplete strategic background.',
      background: 'Introduced as investor but low proof provided.',
      recommendedDivision: 'Federation',
      status: 'Needs More Info',
      aiScore: 71,
      country: 'Nigeria',
      skills: ['Investment'],
      networkValue: 'High',
      source: 'Manual Invite',
      submittedAt: '2026-03-19 08:56',
      notes: ['Needs stronger verification.']
    }
  ],
  members: [
    {
      id: 'MEM-2001',
      name: 'Maya Chen',
      username: '@mayabuilds',
      email: 'maya@signalmail.com',
      divisions: ['Academy'],
      status: 'Active',
      activityScore: 82,
      roadmapStatus: 'Phase 1 active',
      riskFlag: 'Low',
      joinedAt: '2026-03-20',
      lastLogin: '2 hours ago',
      notes: ['Daily check-ins consistent.']
    },
    {
      id: 'MEM-2002',
      name: 'Amina Kolade',
      username: '@aminak',
      email: 'amina@outlook.com',
      divisions: ['Federation'],
      status: 'Pending',
      activityScore: 61,
      roadmapStatus: 'Not assigned',
      riskFlag: 'Medium',
      joinedAt: '2026-03-21',
      lastLogin: 'Yesterday',
      notes: ['Federation file in review.']
    },
    {
      id: 'MEM-2003',
      name: 'Diego Ramos',
      username: '@diegor',
      email: 'diego@proton.me',
      divisions: ['Plazas'],
      status: 'Flagged',
      activityScore: 74,
      roadmapStatus: 'N/A',
      riskFlag: 'Medium',
      joinedAt: '2026-03-18',
      lastLogin: '6 hours ago',
      notes: ['One listing reported for duplicate offer.']
    },
    {
      id: 'MEM-2004',
      name: 'Jerwin M.',
      username: '@jerwin',
      email: 'jerwin@yhmail.com',
      divisions: ['Academy', 'Plazas'],
      status: 'Active',
      activityScore: 68,
      roadmapStatus: 'Intake pending setup',
      riskFlag: 'Low',
      joinedAt: '2026-03-21',
      lastLogin: 'Just now',
      notes: ['Ready for roadmap initialization.']
    }
  ],
  academy: [
    {
      id: 'AC-3001',
      memberId: 'MEM-2001',
      memberName: 'Maya Chen',
      phase: 'Foundation Sprint',
      focus: 'Academic',
      completion: 74,
      lastCheckIn: 'Today',
      status: 'On Track',
      nextAction: 'Trigger week 2 roadmap.',
      notes: ['Responds well to AI nudges.']
    },
    {
      id: 'AC-3002',
      memberId: 'MEM-2004',
      memberName: 'Jerwin M.',
      phase: 'Assessment',
      focus: 'Financial',
      completion: 28,
      lastCheckIn: 'Yesterday',
      status: 'Needs Review',
      nextAction: 'Human review for multi-focus roadmap.',
      notes: ['Needs mental + financial track combination.']
    },
    {
      id: 'AC-3003',
      memberId: 'MEM-2010',
      memberName: 'Lina Yusuf',
      phase: 'Consistency Loop',
      focus: 'Physical',
      completion: 39,
      lastCheckIn: '3 days ago',
      status: 'At Risk',
      nextAction: 'Send accountability reminder.',
      notes: ['Check-in streak dropped.']
    }
  ],
  federation: [
    {
      id: 'FED-4001',
      name: 'Amina Kolade',
      profession: 'Policy Advisor',
      region: 'Nigeria',
      status: 'Under Vetting',
      influence: 84,
      tag: 'Policy',
      referredBy: 'Direct Referral',
      notes: ['Strong policy trade contacts.'],
      strategicValue: 'High'
    },
    {
      id: 'FED-4002',
      name: 'Michael Rios',
      profession: 'Angel Investor',
      region: 'UAE',
      status: 'Strategic Priority',
      influence: 93,
      tag: 'Investor',
      referredBy: 'Member Invite',
      notes: ['Fast-track relationship building.'],
      strategicValue: 'Very High'
    },
    {
      id: 'FED-4003',
      name: 'Chioma Eze',
      profession: 'Corporate Lawyer',
      region: 'Nigeria',
      status: 'Candidate',
      influence: 77,
      tag: 'Lawyer',
      referredBy: 'LinkedIn Outreach',
      notes: ['Needs deeper verification.'],
      strategicValue: 'High'
    }
  ],
  plazas: [
    {
      id: 'PLZ-5001',
      title: 'AI Outreach System Setup',
      owner: 'Diego Ramos',
      type: 'Service',
      status: 'Flagged',
      reports: 2,
      region: 'Spain',
      notes: ['Possible duplicate service language.'],
      featured: false
    },
    {
      id: 'PLZ-5002',
      title: 'Need appointment setter for wealth brand',
      owner: 'Jerwin M.',
      type: 'Job',
      status: 'Pending Review',
      reports: 0,
      region: 'Philippines',
      notes: ['Good demand-side post.'],
      featured: false
    },
    {
      id: 'PLZ-5003',
      title: 'Offer: UI/UX design for startups',
      owner: 'Lina Yusuf',
      type: 'Service',
      status: 'Active',
      reports: 0,
      region: 'Nigeria',
      notes: ['Strong portfolio attached.'],
      featured: true
    },
    {
      id: 'PLZ-5004',
      title: 'Looking for legal advisory partner',
      owner: 'Amina Kolade',
      type: 'Request',
      status: 'Active',
      reports: 0,
      region: 'Nigeria',
      notes: ['Federation crossover opportunity.'],
      featured: false
    }
  ],
  support: [
    {
      id: 'SUP-6001',
      title: 'Cannot access Academy roadmap',
      reporter: 'Jerwin M.',
      type: 'Access',
      status: 'Open',
      priority: 'High',
      updatedAt: '15 min ago',
      notes: ['Likely onboarding sync issue.']
    },
    {
      id: 'SUP-6002',
      title: 'Plazas listing was unfairly flagged',
      reporter: 'Diego Ramos',
      type: 'Dispute',
      status: 'In Progress',
      priority: 'Medium',
      updatedAt: '1 hour ago',
      notes: ['Needs marketplace admin review.']
    },
    {
      id: 'SUP-6003',
      title: 'Need to update Federation bio',
      reporter: 'Amina Kolade',
      type: 'Profile',
      status: 'Waiting on User',
      priority: 'Low',
      updatedAt: 'Yesterday',
      notes: ['Requested additional profile data.']
    }
  ],
  broadcasts: [
    {
      id: 'BC-7001',
      audience: 'Academy',
      subject: 'Complete today’s check-in',
      message: 'Your roadmap momentum matters. Complete your check-in before midnight.',
      sentAt: '2026-03-21 19:20'
    },
    {
      id: 'BC-7002',
      audience: 'All Members',
      subject: 'Universe update',
      message: 'We are refining division access and improving the YH experience.',
      sentAt: '2026-03-20 09:10'
    }
  ],
  analytics: {
    finance: {
      totalRevenue: 184500,
      monthlyRevenue: 28120,
      averageOrderValue: 468,
      profitMargin: 32.8,
      countriesReached: 18,
      averageReviewDays: 3.4
    },
    targets: {
      membersGoal: 1000,
      federationGoal: 120,
      monthlyRevenueGoal: 50000,
      plazasGoal: 240
    },
    monthly: [
      { month: 'Jan', revenue: 8200, members: 44 },
      { month: 'Feb', revenue: 11400, members: 79 },
      { month: 'Mar', revenue: 13200, members: 121 },
      { month: 'Apr', revenue: 15900, members: 172 },
      { month: 'May', revenue: 18750, members: 248 },
      { month: 'Jun', revenue: 20400, members: 311 },
      { month: 'Jul', revenue: 23600, members: 398 },
      { month: 'Aug', revenue: 25280, members: 463 },
      { month: 'Sep', revenue: 28120, members: 542 },
      { month: 'Oct', revenue: 30900, members: 614 },
      { month: 'Nov', revenue: 33100, members: 689 },
      { month: 'Dec', revenue: 35600, members: 754 }
    ],
    revenueMix: [
      { division: 'Academy', revenue: 86400, share: 46.8 },
      { division: 'Federation', revenue: 60300, share: 32.7 },
      { division: 'Plazas', revenue: 37800, share: 20.5 }
    ],
    regions: [
      { name: 'Nigeria', members: 214, revenue: 58200 },
      { name: 'Philippines', members: 142, revenue: 33100 },
      { name: 'UAE', members: 88, revenue: 27600 },
      { name: 'UK', members: 76, revenue: 24400 },
      { name: 'Spain', members: 53, revenue: 15800 },
      { name: 'Singapore', members: 41, revenue: 11400 }
    ]
  }
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('yh_admin_panel_state_v1');
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return mergeState(defaultState(), parsed);
  } catch {
    return defaultState();
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
  toast.textContent = message;
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
  const totalMembers = state.members.length;
  const pendingApplications = state.applications.filter(a => ['New', 'Under Review', 'Needs More Info'].includes(a.status)).length;
  const academyActive = state.academy.filter(a => a.status === 'On Track').length;
  const flaggedListings = state.plazas.filter(l => l.status === 'Flagged').length;

  document.getElementById('overview-stats').innerHTML = [
    { label: 'Total Members', value: totalMembers, foot: `${state.members.filter(m => m.status === 'Active').length} active now` },
    { label: 'Pending Applications', value: pendingApplications, foot: 'Needs intake action' },
    { label: 'Academy On Track', value: academyActive, foot: `${state.academy.length} roadmap records` },
    { label: 'Flagged Listings', value: flaggedListings, foot: `${state.support.filter(t => t.type === 'Dispute').length} related tickets` }
  ].map(card => `
    <article class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(card.value)}</div>
      <div class="stat-foot">${escapeHtml(card.foot)}</div>
    </article>
  `).join('');

  const actions = [
    `${pendingApplications} applications need review`,
    `${state.support.filter(t => t.status === 'Open').length} support tickets still open`,
    `${state.academy.filter(a => a.status !== 'On Track').length} Academy members need intervention`,
    `${flaggedListings} Plazas listings need moderation`
  ];

  document.getElementById('priority-actions').innerHTML = actions.map((text, index) => `
    <div class="stack-item">
      <div class="stack-item-head">
        <strong>Queue ${index + 1}</strong>
        ${formatBadge(index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low')}
      </div>
      <p>${escapeHtml(text)}</p>
    </div>
  `).join('');

  const alerts = [
    state.settings.maintenanceMode ? 'Maintenance mode is enabled.' : 'System stable. No maintenance mode active.',
    state.settings.requirePlazaListingReview ? 'Plazas manual listing review is ON.' : 'Plazas listings are auto-publishing.',
    state.settings.requireFederationManualReview ? 'Federation manual review is enforced.' : 'Federation auto-routing is active.'
  ];

  document.getElementById('system-alerts').innerHTML = alerts.map(text => `
    <div class="stack-item">
      <div class="stack-item-head">
        <strong>System Notice</strong>
        ${formatBadge(text.includes('ON') || text.includes('enforced') ? 'Medium' : 'Active')}
      </div>
      <p>${escapeHtml(text)}</p>
    </div>
  `).join('');

  document.getElementById('overview-applications-table').innerHTML = state.applications
    .slice()
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5)
        .map(app => `
      <tr>
        ${makeCell('Name', `<strong>${escapeHtml(app.name)}</strong><div class="muted mono">${escapeHtml(app.id)}</div>`)}
        ${makeCell('Recommended', formatBadge(app.recommendedDivision))}
        ${makeCell('Status', formatBadge(app.status))}
        ${makeCell('AI Score', `${app.aiScore}`)}
        ${makeCell('Actions', `<button class="badge-btn" data-open="application" data-id="${app.id}">Open</button>`)}
      </tr>
    `).join('');

  const divisionCounts = {
    Academy: state.members.filter(m => m.divisions.includes('Academy')).length,
    Federation: state.members.filter(m => m.divisions.includes('Federation')).length,
    Plazas: state.members.filter(m => m.divisions.includes('Plazas')).length
  };

  document.getElementById('division-snapshot').innerHTML = Object.entries(divisionCounts).map(([name, count]) => `
    <div class="snapshot-item">
      <div class="snapshot-item-head">
        <strong>${escapeHtml(name)}</strong>
        <span>${count} members</span>
      </div>
      <p>${name === 'Academy' ? 'AI-guided self-improvement lane' : name === 'Federation' ? 'Strategic network lane' : 'Marketplace and opportunities lane'}</p>
      <div class="progress"><i style="width:${Math.max(10, count * 18)}%"></i></div>
    </div>
  `).join('');
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
    { label: 'Needs Review', value: state.academy.filter(a => a.status === 'Needs Review').length, foot: 'Human intervention queue' },
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

  const latestMonthly = analytics.monthly[analytics.monthly.length - 1];
  const prevMonthly = analytics.monthly[analytics.monthly.length - 2] || latestMonthly;
  const revenueDelta = latestMonthly.revenue - prevMonthly.revenue;
  const growthDelta = latestMonthly.members - prevMonthly.members;

  document.getElementById('analytics-stats').innerHTML = [
    { label: 'Total Revenue', value: formatCurrency(analytics.finance.totalRevenue), foot: 'All-time YH revenue' },
    { label: 'Monthly Revenue', value: formatCurrency(analytics.finance.monthlyRevenue), foot: `${revenueDelta >= 0 ? '+' : ''}${formatCurrency(revenueDelta)} vs last month` },
    { label: 'Member Reach', value: latestMonthly.members, foot: `${analytics.finance.countriesReached} countries reached` },
    { label: 'Overall Unique Users', value: metrics.uniqueUsers, foot: 'Deduplicated overall member count' },
    { label: 'Total Memberships', value: metrics.totalMemberships, foot: 'All division memberships combined' },
    { label: 'Overlap Users', value: metrics.overlapUsers, foot: 'Users inside more than one division' },
    { label: 'Approval Rate', value: `${approvalRate}%`, foot: `${approvedApps}/${state.applications.length} approved` },
    { label: 'Active Member Rate', value: `${activeRate}%`, foot: `${activeMembers}/${state.members.length} active` },
    { label: 'Avg Review Days', value: analytics.finance.averageReviewDays, foot: `${plazasActive} active listings live` }
  ].map(card => `
    <article class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(card.value)}</div>
      <div class="stat-foot">${escapeHtml(card.foot)}</div>
    </article>
  `).join('');

  document.getElementById('analytics-hero-meta').innerHTML = `
    <span class="analytics-mini-pill">Revenue now ${formatCurrency(latestMonthly.revenue)}</span>
    <span class="analytics-mini-pill">Growth ${growthDelta >= 0 ? '+' : ''}${growthDelta} members</span>
    <span class="analytics-mini-pill">${metrics.uniqueUsers} unique users</span>
    <span class="analytics-mini-pill">${analytics.finance.countriesReached} countries active</span>
  `;

  document.getElementById('analytics-hero-chart').innerHTML = createLineChartSVG(analytics.monthly, analytics.monthly);

  const targetProgress = [
    {
      title: 'Member goal',
      current: analytics.monthly[analytics.monthly.length - 1].members,
      goal: analytics.targets.membersGoal,
      sub: 'How close YH is to the next membership milestone'
    },
    {
      title: 'Federation target',
      current: state.federation.length * 18,
      goal: analytics.targets.federationGoal,
      sub: 'Strategic network build-out'
    },
    {
      title: 'Monthly revenue target',
      current: analytics.finance.monthlyRevenue,
      goal: analytics.targets.monthlyRevenueGoal,
      sub: 'Income progress toward monthly target'
    },
    {
      title: 'Plazas activation goal',
      current: state.plazas.length * 28,
      goal: analytics.targets.plazasGoal,
      sub: 'Marketplace opportunity coverage'
    }
  ];

  document.getElementById('analytics-target-progress').innerHTML = targetProgress.map(item => {
    const pct = Math.min(100, Math.round((item.current / Math.max(1, item.goal)) * 100));
    return `
      <div class="stack-item analytics-progress-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${pct}%</span>
        </div>
        <p>${escapeHtml(item.sub)}</p>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="analytics-progress-meta">
          <span>${typeof item.current === 'number' && item.title.toLowerCase().includes('revenue') ? formatCurrency(item.current) : escapeHtml(item.current)}</span>
          <span>Goal ${typeof item.goal === 'number' && item.title.toLowerCase().includes('revenue') ? formatCurrency(item.goal) : escapeHtml(item.goal)}</span>
        </div>
      </div>
    `;
  }).join('');

  const maxCount = Math.max(...Object.values(metrics.divisionCounts), 1);
  document.getElementById('analytics-division-bars').innerHTML = Object.entries(metrics.divisionCounts).map(([name, count]) => `
    <div class="bar-item">
      <div class="bar-meta">
        <strong>${escapeHtml(name)}</strong>
        <span>${count} division memberships</span>
      </div>
      <div class="progress"><i class="bar-fill" style="width:${(count / maxCount) * 100}%"></i></div>
    </div>
  `).join('');

  const maxRegionMembers = Math.max(...analytics.regions.map(r => r.members), 1);
  document.getElementById('analytics-regions').innerHTML = analytics.regions.map(region => `
    <div class="bar-item region-card">
      <div class="region-head">
        <strong>${escapeHtml(region.name)}</strong>
        <span>${region.members} members</span>
      </div>
      <div class="progress"><i style="width:${(region.members / maxRegionMembers) * 100}%"></i></div>
      <div class="region-sub">${formatCurrency(region.revenue)} revenue contribution</div>
    </div>
  `).join('');

  const maxRevenueMix = Math.max(...analytics.revenueMix.map(r => r.revenue), 1);
  document.getElementById('analytics-revenue-mix').innerHTML = analytics.revenueMix.map(item => `
    <div class="bar-item mix-card">
      <div class="mix-head">
        <strong>${escapeHtml(item.division)}</strong>
        <span>${item.share}%</span>
      </div>
      <div class="progress"><i style="width:${(item.revenue / maxRevenueMix) * 100}%"></i></div>
      <div class="mix-sub">${formatCurrency(item.revenue)} generated</div>
    </div>
  `).join('');

  const ratios = [
    { title: 'Overall unique user count', text: `${metrics.uniqueUsers} overall users are counted once only, even if they belong to multiple divisions.` },
    { title: 'Total memberships', text: `${metrics.totalMemberships} total memberships are currently distributed across Academy, Federation, and Plazas.` },
    { title: 'Overlap users', text: `${metrics.overlapUsers} users currently belong to more than one division.` },
    { title: 'Academy intervention load', text: `${state.academy.filter(a => a.status !== 'On Track').length} members need human attention.` },
    { title: 'Federation strategic pool', text: `${state.federation.filter(f => ['Strategic Priority', 'Under Vetting'].includes(f.status)).length} high-attention candidates in the queue.` },
    { title: 'Trust and safety load', text: `${state.plazas.filter(p => p.status === 'Flagged').length} listings are flagged and ${state.support.filter(s => s.type === 'Dispute').length} support disputes are open.` },
    { title: 'Revenue momentum', text: `${revenueDelta >= 0 ? 'Up' : 'Down'} ${formatCurrency(Math.abs(revenueDelta))} from the previous month with ${growthDelta >= 0 ? '+' : ''}${growthDelta} member growth.` }
  ];

  document.getElementById('analytics-ratios').innerHTML = ratios.map(item => `
    <div class="stack-item">
      <div class="stack-item-head">
        <strong>${escapeHtml(item.title)}</strong>
      </div>
      <p>${escapeHtml(item.text)}</p>
    </div>
  `).join('');
}

function renderSettings() {
  document.getElementById('roles-list').innerHTML = state.roles.map(role => `
    <div class="role-item">
      <div class="stack-item-head">
        <strong>${escapeHtml(role.name)}</strong>
        ${formatBadge('Active')}
      </div>
      <p>${escapeHtml(role.permissions.join(' • '))}</p>
    </div>
  `).join('');

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
      ? 'Awaiting roadmap application'
      : application.recommendedDivision === 'Academy'
        ? 'Intake pending setup'
        : 'Not assigned',
    riskFlag: 'Low',
    joinedAt: new Date().toISOString().slice(0, 10),
    lastLogin: 'Just now',
    notes: [
      `Created from ${application.id} approval.`,
      ...(isAcademyMembership ? ['Academy membership approved. Roadmap still requires separate access approval.'] : [])
    ]
  });

  return newMemberId;
}

function handleAction(action, id) {
  switch (action) {
case 'approve-application': {
  const app = findById('applications', id);
  if (!app) return;

  const isAcademyMembership = String(app.applicationType || '').trim().toLowerCase() === 'academy-membership';

  app.status = 'Approved';
  app.notes.unshift(
    isAcademyMembership
      ? 'Academy membership approved by admin. Roadmap access remains separate.'
      : 'Approved by admin.'
  );

  const newMemberId = syncMemberFromApplication(app);

  if (
    app.recommendedDivision === 'Academy' &&
    !isAcademyMembership &&
    !state.academy.some(a => a.memberName === app.name)
  ) {
    state.academy.unshift({
      id: `AC-${Date.now().toString().slice(-6)}`,
      memberId: newMemberId || state.members.find(m => m.email === app.email)?.id || '',
      memberName: app.name,
      phase: 'Assessment',
      focus: 'Financial',
      completion: 10,
      lastCheckIn: 'Pending',
      status: 'Needs Review',
      nextAction: 'Initialize Academy roadmap.',
      notes: ['Created after application approval.']
    });
  }

  saveState();
  renderApp();
  showToast(
    isAcademyMembership
      ? `${app.name} approved for Academy membership.`
      : `${app.name} approved.`
  );
  break;
}
    case 'reject-application': {
      const app = findById('applications', id);
      if (!app) return;
      app.status = 'Rejected';
      app.notes.unshift('Rejected by admin.');
      saveState();
      renderApp();
      showToast(`${app.name} rejected.`);
      break;
    }
    case 'waitlist-application': {
      const app = findById('applications', id);
      if (!app) return;
      app.status = 'Waitlisted';
      app.notes.unshift('Moved to waitlist.');
      saveState();
      renderApp();
      showToast(`${app.name} moved to waitlist.`);
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
    broadcastTemplate.addEventListener('change', (e) => {
      const templates = {
        'Roadmap Reminder': {
          subject: 'Complete your roadmap checkpoint',
          message: 'Stay consistent. Your roadmap only works if you act on it today.'
        },
        'Review Update': {
          subject: 'Your review status has changed',
          message: 'Your application or profile review has been updated. Check your dashboard for the latest status.'
        },
        'Listing Approved': {
          subject: 'Your Plazas listing is live',
          message: 'Your listing passed moderation and is now visible in the marketplace.'
        },
        'System Announcement': {
          subject: 'YH system update',
          message: 'We have rolled out operational improvements across the YH Universe.'
        }
      };

      const selected = templates[e.target.value];
      if (!selected) return;

      const subjectEl = document.getElementById('broadcast-subject');
      const messageEl = document.getElementById('broadcast-message');

      if (subjectEl) subjectEl.value = selected.subject;
      if (messageEl) messageEl.value = selected.message;
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

    ['seed-demo-btn', 'seed-demo-btn-desktop'].forEach(id => {
    const seedBtn = document.getElementById(id);
    if (seedBtn) {
      seedBtn.addEventListener('click', resetState);
    }
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
  renderApp();
}