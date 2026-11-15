import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import federationCssUrl from './FederationShell.css?url'

function FederationLoadingBar({ failed = false }) {
  return (
    <main
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      style={{
        width: '100%',
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(ellipse at center, #102b48 0%, #071629 55%, #050f1d 100%)',
        color: '#eef4ff',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <div
        style={{
          width: 'min(300px, 86vw)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 68,
            height: 68,
            borderRadius: 19,
            border: '1px solid rgba(103,232,249,.25)',
            background: 'rgba(18,47,75,.65)',
            boxShadow:
              '0 0 30px rgba(56,189,248,.12)',
          }}
        >
          <img
            src="/images/logo.avif"
            alt="Young Hustlers"
            width={48}
            height={48}
            style={{
              display: 'block',
              width: 48,
              height: 48,
              maxWidth: 48,
              maxHeight: 48,
              objectFit: 'contain',
            }}
          />
        </div>

        <strong
          style={{
            marginTop: 17,
            color: '#b5e8fa',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.16em',
          }}
        >
          THE FEDERATION
        </strong>

        <p
          style={{
            margin: '10px 0 18px',
            color: '#dcefff',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {failed
            ? 'Unable to load Federation styles.'
            : 'Loading Federation…'}
        </p>

        {!failed && (
          <svg
            viewBox="0 0 300 4"
            width="300"
            height="4"
            role="progressbar"
            aria-label="Loading Federation"
            aria-valuetext="Loading"
            style={{
              display: 'block',
              width: '100%',
              height: 4,
              overflow: 'hidden',
            }}
          >
            <defs>
              <linearGradient
                id="yhu-fed-branded-loader-gradient"
                x1="0" y1="0" x2="1" y2="0"
              >
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="55%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            <rect
              width="300"
              height="4"
              rx="2"
              fill="#24425e"
            />

            <rect
              x="-100"
              width="100"
              height="4"
              rx="2"
              fill="url(#yhu-fed-branded-loader-gradient)"
            >
              <animate
                attributeName="x"
                from="-100"
                to="300"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        )}
      </div>
    </main>
  )
}

const TABS = [
  { id: 'command', label: 'Command', icon: 'command.png', description: 'Your Federation operating layer' },
  { id: 'connect', label: 'Connect', icon: 'connect.png', description: 'Request verified introductions' },
  { id: 'deal-rooms', label: 'Deal Rooms', icon: 'deal rooms.png', description: 'Admin-supervised partnerships and collabs' },
  { id: 'directory', label: 'Directory', icon: 'directory.png', description: 'View approved Federation members' },
  { id: 'requests', label: 'My Requests', icon: 'my requests.png', description: 'Track connection requests' },
  { id: 'referrals', label: 'Referrals', icon: 'referrals.png', description: 'Invite high-value people' },
  { id: 'access', label: 'My Access', icon: 'my access.png', description: 'View member status and profile' },
]

export default function FederationStandaloneShell({ sectionId, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationRef = useRef(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stylesheetState, setStylesheetState] = useState('loading')

  useEffect(() => {
    const body = document.body
    const previousPage = body.getAttribute('data-yh-page')
    const previousView = body.getAttribute('data-yh-view')
    const stylesheet = document.createElement('link')

    stylesheet.rel = 'stylesheet'
    stylesheet.href = federationCssUrl
    stylesheet.setAttribute('data-yhu-federation-css', '1')

    let active = true
    stylesheet.onload = () => {
      if (active) setStylesheetState('ready')
    }

    stylesheet.onerror = () => {
      if (active) setStylesheetState('error')
    }

    body.setAttribute('data-yh-page', 'federation')
    body.setAttribute('data-yh-view', 'federation')
    document.head.appendChild(stylesheet)

    return () => {
      active = false
      stylesheet.onload = null
      stylesheet.onerror = null
      stylesheet.remove()

      if (previousPage === null) body.removeAttribute('data-yh-page')
      else body.setAttribute('data-yh-page', previousPage)

      if (previousView === null) body.removeAttribute('data-yh-view')
      else body.setAttribute('data-yh-view', previousView)
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const closeOnEscape = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    const closeOnOutside = event => {
      if (!navigationRef.current?.contains(event.target)) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutside)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [mobileMenuOpen])

  const goBack = () => {
    const routerHistoryIndex = Number(window.history.state?.idx)
    if (Number.isInteger(routerHistoryIndex) && routerHistoryIndex > 0) navigate(-1)
    else navigate('/dashboard', { replace: true })
  }

  if (stylesheetState !== 'ready') {
    return (
      <FederationLoadingBar
        failed={stylesheetState === 'error'}
      />
    )
  }

  return (
    <div
      className="yhu-fed-spa-shell"
      data-yhu-federation-shell="standalone"
    >
      <header className="yhu-fed-spa-header">
        <div className="yhu-fed-spa-brand">
          <img src="/images/logo.avif" alt="Young Hustlers" />
          <strong>The Federation</strong>
        </div>

        <div
          className="yhu-fed-spa-navigation"
          ref={navigationRef}
          data-mobile-open={mobileMenuOpen ? 'true' : 'false'}
        >


          <button
            type="button"
            className="yhu-fed-spa-menu-toggle"
            aria-controls="yhu-fed-spa-tabs"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(open => !open)}
          >
            <span aria-hidden="true">☰</span>
            <span>More</span>
          </button>

          <nav
            id="yhu-fed-spa-tabs"
            className="yhu-fed-spa-tabs"
            aria-label="Federation sections"
          >
            {TABS.map(item => (
              <Link
                key={item.id}
                to={`/federation/${item.id}`}
                title={item.description}
                className={
                  'yhu-fed-spa-tab' +
                  (sectionId === item.id ? ' is-active' : '')
                }
                aria-current={
                  sectionId === item.id ? 'page' : undefined
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <img
                  className="yhu-fed-spa-tab-icon"
                  src={'/assets/academy/federation%20icons/' + encodeURIComponent(item.icon)}
                  alt=""
                />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <details
          className="yhu-fed-spa-signals"
          key={sectionId}
        >
          <summary>Network Pulse</summary>

          <div className="yhu-fed-spa-signals-panel">
            <section>
              <span>Federation Status</span>
              <strong>Selective Access</strong>
              <p>A private strategic circle for trusted operators, leaders, founders, professionals, and connectors.</p>
            </section>

            <section>
              <span>Core Principle</span>
              <strong>Quality over Volume</strong>
              <p>Applications are manually reviewed for trust, leverage, and long-term strategic value.</p>
            </section>

            <section>
              <span>Account State</span>
              <strong>Server Synced</strong>
              <p>Federation access, applications, approvals, and member state sync automatically from the signed-in YH account.</p>
            </section>

            <section>
              <span>High-Value Cluster</span>
              <p>Focus on strategic categories, regional connectors, and trusted profiles.</p>
            </section>

            <section>
              <span>Priority Regions</span>
              <ul>
                {[
                  'Nigeria',
                  'United Kingdom',
                  'UAE',
                  'Canada',
                  'India',
                  'Philippines',
                ].map(region => (
                  <li key={region}>{region}</li>
                ))}
              </ul>
            </section>

            <section>
              <span>Member Tags</span>
              <div className="yhu-fed-spa-tags">
                {[
                  'Connector',
                  'Investor',
                  'Media',
                  'Legal',
                  'Regional Key',
                  'Operator',
                ].map(tag => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </section>

            <Link
              to="/dashboard"
              className="yhu-fed-spa-universe-link"
            >
              ← Go back to Universe
            </Link>

            <small>Return to the main Universe dashboard</small>
          </div>
        </details>
        <button type="button" className="yhu-fed-spa-dashboard-link" onClick={goBack}>← Back</button>
      </header>

      <main id="fedMain" className="yhu-fed-spa-main">
        {children}
      </main>
    </div>
  )
}
