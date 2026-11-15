import { useEffect, useState } from 'react'
import AdminApplicationsView from './AdminApplicationsView'
import AdminMembersView from './AdminMembersView'
import AdminAnalyticsView from './AdminAnalyticsView'
import AdminRemainingViews, {
  ADMIN_REMAINING_VIEWS,
  ADMIN_REMAINING_LABELS
} from './AdminRemainingViews'
import {
  AdminPriorityActions,
  AdminNewestApplications
} from './AdminOverviewQueues'
import { useParams } from 'react-router-dom'
import { useAdminBootstrap } from './useAdminBootstrap'

function records(value) {
  return Array.isArray(value) ? value : []
}

/* YHU_ADMIN_REACT_SHELL_PARITY_V1 */

const adminNavigationGroups = [
  {
    label: 'Command',
    items: [
      ['overview', '⌂', 'Overview', 'Daily control room'],
      ['analytics', '▣', 'Analytics', 'Growth, revenue, signals']
    ]
  },
  {
    label: 'People',
    items: [
      ['applications', '☰', 'Applications', 'Approve, reject, waitlist'],
      ['members', '◉', 'Members', 'All users and access']
    ]
  },
  {
    label: 'Divisions',
    items: [
      ['academy', '🧠', 'Academy', 'Roadmaps, missions, leads'],
      ['federation', '♛', 'Federation', 'Connect, deals, requests'],
      ['plazas', '◇', 'Plaza', 'Opportunities and listings']
    ]
  },
  {
    label: 'Money',
    items: [
      ['economy', '₿', 'Economy', 'Payments, payouts, commission']
    ]
  },
  {
    label: 'Comms & System',
    items: [
      ['business-chat-reports', '💬', 'Business Chat Reports', 'Cross-division safety review'],
      ['communications', '✉', 'Communications', 'Broadcasts and updates'],
      ['support', '?', 'Support', 'Tickets and disputes'],
      ['settings', '⚙', 'Settings', 'Roles, toggles, system']
    ]
  }
]

const primaryMobileViews = new Set([
  'overview', 'applications', 'members', 'economy'
])

const mobileMoreViews = [
  ['academy', '🧠', 'Academy', 'Missions and leads'],
  ['federation', '♛', 'Federation', 'Connect and deals'],
  ['plazas', '◇', 'Plaza', 'Listings and opportunities'],
  ['communications', '✉', 'Communications', 'Broadcasts'],
  ['support', '?', 'Support', 'Tickets'],
  ['analytics', '▣', 'Analytics', 'Performance'],
  ['settings', '⚙', 'Settings', 'System controls'],
  ['business-chat-reports', '💬', 'Business Chat Reports', 'Cross-division safety review']
]

function exportAdminState(state, currentView, search) {
  const snapshot = {
    ...state,
    ui: {
      ...(state.ui || {}),
      currentView,
      globalSearch: search.trim()
    }
  }

  const blob = new Blob(
    [JSON.stringify(snapshot, null, 2)],
    { type: 'application/json' }
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'yh-admin-state.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function logoutAdmin(loginPath) {
  try {
    const response = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      throw new Error('Admin logout could not be verified.')
    }

    window.location.replace(loginPath)
  } catch (error) {
    window.alert(
      error.message + ' Session may remain active. Please retry.'
    )
  }
}

export default function AdminOverviewPage() {
  const { adminRouteKey = '' } = useParams()
  const { status, state, user, error, refresh } = useAdminBootstrap()
  const [activeView, setActiveView] = useState('overview')
  const [globalSearch, setGlobalSearch] = useState('')
  const [openApplicationRequest, setOpenApplicationRequest] = useState(null)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  useEffect(() => {
    const previous = document.body.dataset.currentView

    document.body.dataset.currentView = activeView

    return () => {
      if (previous === undefined) {
        delete document.body.dataset.currentView
      } else {
        document.body.dataset.currentView = previous
      }
    }
  }, [activeView])

  const validKey = /^[A-Za-z0-9_-]{32,128}$/.test(adminRouteKey)

  const loginPath = validKey
    ? `/admin/${encodeURIComponent(adminRouteKey)}/login`
    : '/'

  useEffect(() => {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = '/admin-react-panel.css'
    document.head.appendChild(stylesheet)

    const previousTitle = document.title
    document.title = 'YH Admin Panel'

    return () => {
      stylesheet.remove()
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthorized') {
      window.location.replace(loginPath)
    }
  }, [status, loginPath])

  const closeMobileMore = () => {
    const sheet = document.getElementById('admin-mobile-more-sheet')
    const toggle = document.getElementById('admin-mobile-more-toggle')

    if (sheet?.contains(document.activeElement)) {
      toggle?.focus({ preventScroll: true })
    }

    setMobileMoreOpen(false)
  }

  useEffect(() => {
    if (!mobileMoreOpen) return undefined

    const onKeyDown = event => {
      if (event.key === 'Escape') closeMobileMore()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileMoreOpen])

  const goToAdminView = view => {
    setActiveView(view)
    closeMobileMore()

    if (window.innerWidth <= 980) {
      window.requestAnimationFrame(() => {
        document.querySelector('.main-panel')?.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      })
    }
  }

  if (!validKey) {
    return <main role="alert">Invalid admin access route.</main>
  }

  if (status === 'loading' || status === 'unauthorized') {
    return (
      <main
        className="admin-bootstrap-screen"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="admin-bootstrap-card">
          <div className="admin-bootstrap-identity">
            <span className="admin-bootstrap-mark" aria-hidden="true">
              YH
            </span>
            <span>YH Admin</span>
          </div>

          <p className="admin-bootstrap-eyebrow">
            Young Hustlers Universe
          </p>

          <h1>Loading YH Admin...</h1>

          <p className="admin-bootstrap-message">
            Retrieving live dashboard records
          </p>

          <div
            className="admin-bootstrap-track"
            role="progressbar"
            aria-label="Loading Admin records"
          >
            <span className="admin-bootstrap-fill" />
          </div>

          <p className="admin-bootstrap-hint">
            Your dashboard will appear once the records are ready.
          </p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main role="alert" style={{ padding: 24 }}>
        <p>{error}</p>
        <button type="button" onClick={refresh}>Retry</button>
      </main>
    )
  }

  if (
    !state ||
    !Array.isArray(state.members) ||
    !Array.isArray(state.applications) ||
    !Array.isArray(state.academy) ||
    !Array.isArray(state.plazas) ||
    !Array.isArray(state.support)
  ) {
    return (
      <main role="alert">
        The live Admin bootstrap is missing required records.
      </main>
    )
  }

  const members = records(state.members)
  const applications = records(state.applications)
  const academy = records(state.academy)
  const plazas = records(state.plazas)
  const support = records(state.support)

  const pending = applications.filter(item =>
    ['New', 'Under Review', 'Needs More Info'].includes(item.status)
  ).length

  const onTrack = academy.filter(item =>
    item.status === 'On Track'
  ).length

  const flagged = plazas.filter(item =>
    item.status === 'Flagged'
  ).length

  const cards = [
    {
      label: 'Total Members',
      value: members.length,
      foot: `${members.filter(item => item.status === 'Active').length} active now`
    },
    {
      label: 'Pending Applications',
      value: pending,
      foot: 'Needs intake action'
    },
    {
      label: 'Academy On Track',
      value: onTrack,
      foot: `${academy.length} roadmap records`
    },
    {
      label: 'Flagged Listings',
      value: flagged,
      foot: `${support.filter(item => item.type === 'Dispute').length} related tickets`
    }
  ]

  const maintenance = state.settings?.maintenanceMode

  const notices = [
    typeof maintenance !== 'boolean'
      ? 'Maintenance status cannot be verified.'
      : maintenance
        ? 'Maintenance mode is enabled.'
        : 'System stable. No maintenance mode active.',
    'Plazas manual listing review control is pending backend enforcement.',
    'Federation manual review control is pending backend enforcement.'
  ]

  const divisionCounts = [
    ['Academy', members.filter(item => records(item.divisions).includes('Academy')).length],
    ['Federation', members.filter(item => records(item.divisions).includes('Federation')).length],
    ['Plazas', members.filter(item => records(item.divisions).includes('Plazas')).length]
  ]

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <img src="/images/logo.png" alt="Young Hustlers Universe logo" />
          </div>
          <div>
            <h1>YH Admin</h1>
            <p>Universe Control Center</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {adminNavigationGroups.map(group => (
            <div className="admin-nav-group" key={group.label}>
              <div className="admin-nav-group-title">{group.label}</div>
              {group.items.map(([view, icon, title, subtitle]) => (
                <button
                  key={view}
                  type="button"
                  className={`nav-item${activeView === view ? ' active' : ''}`}
                  onClick={() => goToAdminView(view)}
                >
                  <span className="admin-nav-main">
                    <span className="admin-nav-icon">{icon}</span>
                    <span className="admin-nav-copy">
                      <span className="admin-nav-title">{title}</span>
                      <span className="admin-nav-sub">{subtitle}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-card">
            <div className="footer-label">System Status</div>
            <div className="footer-value">
              {typeof maintenance !== 'boolean'
                ? 'Status unavailable'
                : maintenance
                  ? 'Maintenance Mode'
                  : 'Operational'}
            </div>
          </div>
          <div className="footer-card">
            <div className="footer-label">Admin Role</div>
            <div className="footer-value">
              {user?.role || 'Super Admin'}
            </div>
          </div>

          <button
            type="button"
            className="ghost-btn"
            id="admin-logout-btn-desktop"
            onClick={() => logoutAdmin(loginPath)}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="app-topbar">
          <div className="app-topbar-main">
            <div className="app-brand">
              <div className="app-brand-mark">
                <img src="/images/logo.png" alt="Young Hustlers Universe logo" />
              </div>
              <div className="app-brand-copy">
                <p className="eyebrow">Young Hustlers Universe</p>
                <h2 id="app-page-title">
                  {ADMIN_REMAINING_LABELS[activeView] ||
                    ({
                      overview: 'Overview',
                      analytics: 'Analytics',
                      applications: 'Applications',
                      members: 'Members'
                    }[activeView] || 'Overview')}
                </h2>
              </div>
            </div>
            <div className="app-admin-mini">
              <div className="admin-avatar">A</div>
            </div>
          </div>
          <div className="app-topbar-tools">
            <div className="search-box app-search-box">
              <span>⌕</span>
              <input
                id="global-search"
                type="text"
                placeholder="Search applicants, members, listings..."
                value={globalSearch}
                onChange={event => setGlobalSearch(event.target.value)}
              />
            </div>
            <div className="app-topbar-buttons">
              <button type="button" className="primary-btn"
                id="export-state-btn"
                onClick={() => exportAdminState(state, activeView, globalSearch)}>
                Export State
              </button>
            </div>
          </div>
        </header>

        <header className="topbar">
          <div>
            <p className="eyebrow">Young Hustlers Universe</p>
            <h2 id="page-title">
              {ADMIN_REMAINING_LABELS[activeView] ||
                (activeView === 'applications'
                  ? 'Applications'
                  : activeView === 'members'
                    ? 'Members'
                    : activeView === 'analytics'
                      ? 'Analytics'
                      : 'Overview')}
            </h2>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <span>⌕</span>
              <input
                id="global-search-desktop"
                type="text"
                placeholder="Search applicants, members, listings."
                value={globalSearch}
                onChange={event => setGlobalSearch(event.target.value)}
              />
            </div>
            <button type="button"
              className="primary-btn"
              id="export-state-btn-desktop"
              onClick={() => exportAdminState(state, activeView, globalSearch)}>
              Export State
            </button>
            <div className="admin-chip">
              <div className="admin-avatar">A</div>
              <div>
                <strong>Admin</strong>
                <span>Control Room</span>
              </div>
            </div>
          </div>
        </header>

        <section
          className={`view view-overview${activeView === 'overview' ? ' active' : ''}`}
          id="view-overview"
          data-app-active={activeView === 'overview' ? '' : undefined}
        >
          <div className="stats-grid" id="overview-stats">
            {cards.map(card => (
              <article className="stat-card" key={card.label}>
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">{card.value}</div>
                <div className="stat-foot">{card.foot}</div>
              </article>
            ))}
          </div>

          <div className="content-grid admin-overview-primary-grid">
          <AdminPriorityActions
            state={state}
            onNavigate={goToAdminView}
          />
            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">System Alerts</p>
                  <h3>Needs Attention</h3>
                </div>
              </div>
              <div className="stack-list" id="system-alerts">
                {notices.map(notice => (
                  <div className="stack-item" key={notice}>
                    <div className="stack-item-head">
                      <strong>System Notice</strong>
                    </div>
                    <p>{notice}</p>
                  </div>
                ))}
              </div>
            </article>
        </div>

        <div className="content-grid admin-overview-detail-grid">
          <AdminNewestApplications
            state={state}
            onOpenApplication={id => {
              setOpenApplicationRequest(current => ({
                id,
                sequence: (current?.sequence || 0) + 1
              }))
              setActiveView('applications')
            }}
          />
            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Activity</p>
                  <h3>Division Snapshot</h3>
                </div>
              </div>
              <div className="snapshot-list" id="division-snapshot">
                {divisionCounts.map(([name, count]) => (
                  <div className="snapshot-item" key={name}>
                    <div className="snapshot-item-head">
                      <strong>{name}</strong>
                      <span className="badge badge-blue">{name}</span>
                    </div>
                    <p>{count} linked members</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
        <AdminApplicationsView
          state={state}
          refresh={refresh}
          active={activeView === 'applications'}
          openApplicationRequest={openApplicationRequest}
          globalSearch={globalSearch}
        />
        <AdminMembersView
          state={state}
          refresh={refresh}
          globalSearch={globalSearch}
          active={activeView === 'members'}
        />
        <AdminAnalyticsView
          state={state}
          active={activeView === 'analytics'}
        />
        {ADMIN_REMAINING_VIEWS.map(key => (
          <AdminRemainingViews
            key={key}
            view={key}
            state={state}
            globalSearch={globalSearch}
            active={activeView === key}
            refresh={refresh}
          />
        ))}
      </main>

      <nav className="app-bottom-nav" aria-label="App Navigation">
        {[
          ['overview', '⌂', 'Overview'],
          ['applications', '☰', 'Apps'],
          ['members', '◉', 'Members'],
          ['economy', '₿', 'Money']
        ].map(([view, icon, label]) => (
          <button
            key={view}
            type="button"
            className={`nav-item${activeView === view ? ' active' : ''}`}
            onClick={() => goToAdminView(view)}>
            <span className="app-nav-icon">{icon}</span>
            <span className="app-nav-label">{label}</span>
          </button>
        ))}

        <button type="button"
          id="admin-mobile-more-toggle"
          className={`admin-mobile-more-btn${mobileMoreOpen || !primaryMobileViews.has(activeView) ? ' active' : ''}`}
          aria-expanded={mobileMoreOpen}
          aria-controls="admin-mobile-more-sheet"
          onClick={() => {
            if (mobileMoreOpen) closeMobileMore()
            else setMobileMoreOpen(true)
          }}>
          <span className="app-nav-icon">⋯</span>
          <span className="app-nav-label">More</span>
        </button>
      </nav>

      <div
        className="admin-mobile-more-backdrop"
        id="admin-mobile-more-backdrop"
        hidden={!mobileMoreOpen}
        onClick={closeMobileMore}
      />

      <div className="admin-mobile-more-sheet"
        id="admin-mobile-more-sheet"
        hidden={!mobileMoreOpen}
        aria-hidden={!mobileMoreOpen}>
        <div className="admin-mobile-more-head">
          <div>
            <p className="eyebrow">Admin Menu</p>
            <h3>More Controls</h3>
          </div>
          <button type="button" className="icon-btn"
            id="admin-mobile-more-close"
            aria-label="Close menu"
            onClick={closeMobileMore}>
            ✕
          </button>
        </div>

        <div className="admin-mobile-more-grid">
          {mobileMoreViews.map(([view, icon, label, sub]) => (
            <button key={view}
              type="button"
              className={`nav-item${activeView === view ? ' active' : ''}`}
              onClick={() => goToAdminView(view)}>
              <span className="admin-nav-main">
                <span className="admin-nav-icon">{icon}</span>
                <span className="admin-nav-copy">
                  <span className="admin-nav-title">{label}</span>
                  <span className="admin-nav-sub">{sub}</span>
                </span>
              </span>
            </button>
          ))}

          <button
            type="button"
            className="nav-item"
            id="admin-logout-btn"
            onClick={() => logoutAdmin(loginPath)}
          >
            <span className="admin-nav-main">
              <span
                className="admin-nav-icon"
                aria-hidden="true"
              >
                ⇥
              </span>

              <span className="admin-nav-copy">
                <span className="admin-nav-title">
                  Log out
                </span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
