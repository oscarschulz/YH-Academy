import { useEffect, useRef, useState } from 'react'
import DashboardUniverseSearch from './DashboardUniverseSearch'

// Original dashboard.html mobile-shell contract. React owns the event handlers;
// legacy dashboard.js must not be mounted alongside this component.
const DIVISION_TABS = {
  academy: [
    ['academy-roadmap', 'Roadmap'],
    ['academy-missions', 'Missions'],
    ['academy-community', 'Community Feed'],
    ['academy-messages', 'Messages'],
    ['academy-voice', 'Live Voice'],
  ],
  plazas: [
    ['plazas-explorer', 'Home'],
    ['plazas-opportunities', 'Opportunities'],
    ['plazas-directory', 'Directory'],
    ['plazas-regions', 'Regions'],
    ['plazas-meetups', 'Meetups'],
    ['plazas-conversations', 'Conversations'],
    ['plazas-inbox', 'Inbox'],
    ['plazas-patron', 'Patron'],
  ],
  federation: [
    ['federation-command', 'Command'],
    ['federation-connect', 'Connect'],
    ['federation-deal-rooms', 'Deal Rooms'],
    ['federation-directory', 'Directory'],
    ['federation-access', 'My Access'],
    ['federation-requests', 'Requests'],
    ['federation-referrals', 'Referrals'],
  ],
}

const MOBILE_NAV = [
  ['overview', '▦', 'Dashboard'],
  ['academy', '✦', 'Academy'],
  ['command', '◆', 'Command'],
  ['plazas', '◎', 'Plazas'],
  ['federation', '⬡', 'Federation'],
]

const MOBILE_COMMAND = [
  ['wallet', 'Wallet'],
  ['messages', 'Messages'],
  ['business-chats', 'Business Chats'],
  ['referral', 'Referral'],
  ['my-contacts', 'My Contacts'],
  ['resources', 'Resources'],
  ['settings', 'Settings'],
  ['logout', 'Log out'],
]

function getMobileProfileInitial() {
  try {
    const name =
      localStorage.getItem('yh_user_name') ||
      sessionStorage.getItem('yh_user_name') ||
      localStorage.getItem('yh_user_username') ||
      ''
    return String(name).trim().charAt(0).toUpperCase() || 'Y'
  } catch {
    return 'Y'
  }
}

export default function DashboardMobileShell({
  activeWorkspace,
  onNavigate,
  onUtilityOpen,
  onProfileOpen,
}) {
  const division = ['academy', 'plazas', 'federation'].includes(activeWorkspace?.division)
    ? activeWorkspace.division
    : ''
  const workspaceKey = activeWorkspace?.key || 'overview'
  const options = DIVISION_TABS[division] || []
  const currentLabel = options.find(([key]) => key === workspaceKey)?.[1] || 'Section'
  const headerTitle = division
    ? division === 'plazas' ? 'Plazas' : division.charAt(0).toUpperCase() + division.slice(1)
    : 'Dashboard'
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const menuRef = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    setMenuOpen(false)
    setCommandOpen(false)
  }, [workspaceKey])

  useEffect(() => {
    function dismiss(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setCommandOpen(false)
      }
      if (event.type === 'pointerdown' && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', dismiss)
    document.addEventListener('pointerdown', dismiss)
    return () => {
      document.removeEventListener('keydown', dismiss)
      document.removeEventListener('pointerdown', dismiss)
    }
  }, [])

  const navigate = (key) => {
    setMenuOpen(false)
    setCommandOpen(false)
    if (key === 'command') {
      setCommandOpen(true)
      return
    }
    void onNavigate?.(key)
  }

  const runUtility = (key) => {
    setMenuOpen(false)
    setCommandOpen(false)
    onUtilityOpen?.(key)
  }

  return (
    <div className="yh-mobile-app-shell" id="yh-mobile-app-shell" aria-label="YH Universe mobile app navigation">
      <header className="yh-mobile-app-header">
        <div className="yh-mobile-app-brand">
          <img src="/images/logo.avif" alt="" className="yh-mobile-app-logo" aria-hidden="true" />
          <div className="yh-mobile-app-title-wrap">
            <small id="yh-mobile-app-kicker">YH Universe</small>
            <strong id="yh-mobile-app-title">{headerTitle}</strong>
          </div>
        </div>

        <div
          ref={menuRef}
          className={`yh-mobile-app-subtab-menu${menuOpen ? ' is-open' : ''}`}
          id="yh-mobile-app-subtab-menu"
          hidden={!division}
        >
          <button
            type="button"
            className="yh-mobile-app-subtab-menu-btn"
            id="yh-mobile-app-subtab-menu-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open section menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span id="yh-mobile-app-subtab-menu-label">{currentLabel}</span>
            <span className="yh-mobile-app-subtab-menu-arrow" aria-hidden="true">⌄</span>
          </button>
          <div className="yh-mobile-app-subtab-menu-panel" id="yh-mobile-app-subtab-menu-panel" role="menu" aria-label="Section menu">
            {options.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={key === workspaceKey ? 'is-active' : ''}
                data-yh-mobile-subtab-menu-option={key}
                onClick={() => navigate(key)}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="yh-mobile-app-actions">
          <div className="yh-mobile-notification-host" id="yh-mobile-notification-host" aria-label="Notifications" />
          <button type="button" className="yh-mobile-app-profile" id="yh-mobile-app-profile" aria-label="Open profile" onClick={() => onProfileOpen?.('')}>
            <span id="yh-mobile-app-profile-initial">{getMobileProfileInitial()}</span>
          </button>
        </div>
      </header>

      <div className="yh-mobile-dashboard-search" id="yh-mobile-dashboard-search">
        <DashboardUniverseSearch mobile onProfileOpen={onProfileOpen} />
      </div>

      <nav className="yh-mobile-app-subtabs" id="yh-mobile-app-subtabs" aria-label="Section tabs">
        {Object.entries(DIVISION_TABS).map(([name, tabs]) => (
          <div key={name} className="yh-mobile-subnav-group" data-yh-mobile-subnav-group={name}>
            {tabs.map(([key, label]) => (
              <button key={key} type="button" data-yh-mobile-subtab={key} className={workspaceKey === key ? 'is-active' : ''} onClick={() => navigate(key)}>
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <nav className="yh-mobile-bottom-nav" aria-label="Main app navigation">
        {MOBILE_NAV.map(([key, symbol, label]) => (
          <button
            key={key}
            type="button"
            className={`${key === 'command' ? 'yh-mobile-command-orb' : ''}${key === (division || 'overview') ? ' is-active' : ''}`.trim()}
            data-yh-mobile-nav={key}
            aria-label={key === 'command' ? 'Open command' : undefined}
            aria-current={key === (division || 'overview') ? 'page' : undefined}
            onClick={() => navigate(key)}
          >
            <span aria-hidden="true">{symbol}</span><small>{label}</small>
          </button>
        ))}
      </nav>

      <div
        ref={sheetRef}
        className={`yh-mobile-command-sheet${commandOpen ? ' is-open' : ''}`}
        id="yh-mobile-command-sheet"
        aria-hidden={!commandOpen}
        inert={!commandOpen}
      >
        <button type="button" className="yh-mobile-command-backdrop" data-yh-mobile-command-close aria-label="Close command" onClick={() => setCommandOpen(false)} />
        <section className="yh-mobile-command-panel" role="dialog" aria-modal="true" aria-label="Command menu">
          <div className="yh-mobile-command-handle" aria-hidden="true" />
          <div className="yh-mobile-command-head"><small>Command Sheet</small><strong>Utilities &amp; System</strong></div>
          <div className="yh-mobile-command-grid">
            {MOBILE_COMMAND.map(([key, label]) => (
              <button key={key} type="button" data-yh-mobile-command-target={key} onClick={() => runUtility(key)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
