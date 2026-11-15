import { Link as PlazaDashboardLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../services/api/apiClient'
import plazaOriginalCssUrl from './PlazaShell.css?url'

/* YHU_PLAZA_STANDALONE_SHELL_1TO1 */
export function PlazaLoadingBar({ failed = false }) {
  return (
    <main
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(ellipse at center, #102b48 0%, #071629 55%, #050f1d 100%)',
        color: '#eef4ff',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <div style={{
        width: 'min(300px, 86vw)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'grid',
          placeItems: 'center',
          width: 68,
          height: 68,
          borderRadius: 19,
          border: '1px solid rgba(103,232,249,.25)',
          background: 'rgba(18,47,75,.65)',
          boxShadow: '0 0 30px rgba(56,189,248,.12)',
        }}>
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

        <strong style={{
          marginTop: 17,
          color: '#b5e8fa',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.16em',
        }}>
          THE PLAZA
        </strong>

        <p style={{
          margin: '10px 0 18px',
          color: '#dcefff',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {failed
            ? 'Unable to load Plaza styles.'
            : 'Loading Plaza…'}
        </p>

        {!failed && (
          <svg
            viewBox="0 0 300 4"
            width="300"
            height="4"
            role="progressbar"
            aria-label="Loading Plaza"
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
                id="yhu-plaza-loader-gradient"
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
              fill="url(#yhu-plaza-loader-gradient)"
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

const ORIGINAL_PLAZA_TABS = [
  ['explorer', 'Home', 'plazas-explorer', 'plaza atlas.png'],
  ['opportunities', 'Opportunities', 'plazas-opportunities', 'opportunities.png'],
  ['directory', 'Directory', 'plazas-directory', 'directory.png'],
  ['regions', 'Regions', 'plazas-regions', 'regions.png'],
  ['meetups', 'Meetups', 'plazas-meetups', 'meetups.png'],
  ['messages', 'Conversations', 'plazas-conversations', 'conversations.png'],
  ['inbox', 'Inbox', 'plazas-inbox', 'inbox.png'],
  ['patron', 'Patron', 'plazas-patron', 'patron.png'],
]

function PlazaStandaloneShell({ sectionId, onNavigate, children }) {
  const [signals, setSignals] = useState([])
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [signalsError, setSignalsError] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stylesheetState, setStylesheetState] = useState('loading')

  useEffect(() => {
    const body = document.body
    const oldPage = body.getAttribute('data-yh-page')
    const oldView = body.getAttribute('data-yh-view')
    const oldClass = body.classList.contains('yh-plaza-page')

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = plazaOriginalCssUrl
    link.setAttribute('data-yh-plaza-original-css', '1')

    let active = true
    let readyTimer = null
    const startedAt = performance.now()

    link.onload = () => {
      if (!active) return

      const remaining = Math.max(
        0,
        450 - (performance.now() - startedAt)
      )

      readyTimer = window.setTimeout(() => {
        if (active) setStylesheetState('ready')
      }, remaining)
    }

    link.onerror = () => {
      if (active) setStylesheetState('error')
    }

    body.classList.add('yh-plaza-page')
    body.setAttribute('data-yh-page', 'plaza')
    body.setAttribute('data-yh-view', 'plaza')
    document.head.appendChild(link)

    return () => {
      active = false
      if (readyTimer !== null) window.clearTimeout(readyTimer)
      link.onload = null
      link.onerror = null
      link.remove()
      if (!oldClass) body.classList.remove('yh-plaza-page')

      if (oldPage === null) body.removeAttribute('data-yh-page')
      else body.setAttribute('data-yh-page', oldPage)

      if (oldView === null) body.removeAttribute('data-yh-view')
      else body.setAttribute('data-yh-view', oldView)
    }
  }, [])

  /* YHU_PLAZA_PHASE2_LIVE_SIGNALS_REFRESH */
  useEffect(() => {
    let active = true
    let busy = false

    const refreshSignals = async () => {
      if (!active || busy || document.hidden) return

      busy = true

      try {
        const results = await Promise.allSettled([
          apiFetch('/api/plaza/feed?limit=2', {
            method: 'GET',
            cache: 'no-store'
          }),
          apiFetch('/api/plaza/bridge?limit=1', {
            method: 'GET',
            cache: 'no-store'
          })
        ])

        if (!active) return

        const feedOk =
          results[0].status === 'fulfilled' &&
          Array.isArray(results[0].value?.feed)

        const bridgeOk =
          results[1].status === 'fulfilled' &&
          Array.isArray(results[1].value?.bridge)

        setSignalsError(!feedOk || !bridgeOk)

        if (feedOk && bridgeOk) {
          const feed = results[0].value.feed.slice(0, 2)
          const bridge = results[1].value.bridge.slice(0, 1)

          setSignals([
            ...feed.map(item => ({
              title: item.title,
              note: [
                item.member || item.authorName,
                item.region
              ].filter(Boolean).join(' • ')
            })),
            ...bridge.map(item => ({
              title: item.title,
              note: [
                item.stage,
                item.region
              ].filter(Boolean).join(' • ')
            }))
          ])
        }
      } catch {
        if (active) setSignalsError(true)
      } finally {
        if (active) setSignalsLoading(false)
        busy = false
      }
    }

    void refreshSignals()

    const interval = window.setInterval(refreshSignals, 30000)
    window.addEventListener('focus', refreshSignals)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshSignals)
    }
  }, [])

  if (stylesheetState !== 'ready') {
    return <PlazaLoadingBar failed={stylesheetState === 'error'} />
  }

  return (
    <div className="yhu-plaza-spa-shell" data-yh-react-plaza-shell="standalone">
      <header className="yhu-plaza-spa-header">
        <div className="yhu-plaza-spa-brand">
          <img src="/images/logo.avif" alt="" />
          <strong>The Plaza</strong>
        </div>

        <div
          className="yhu-plaza-spa-navigation"
          data-mobile-open={mobileMenuOpen ? 'true' : 'false'}
        >
          <button
            type="button"
            className="yhu-plaza-spa-menu-toggle"
            aria-controls="yhu-plaza-spa-tabs"
            aria-expanded={mobileMenuOpen}
            aria-label="Plaza Menu"
            onClick={() => setMobileMenuOpen(current => !current)}
          >
            <span aria-hidden="true">☰</span>
            <span>Plaza Menu</span>
          </button>

          <div className="yhu-plaza-spa-navigation-panel">
          <nav
            id="yhu-plaza-spa-tabs"
            className="yhu-plaza-spa-tabs"
            aria-label="Plaza Menu"
          >
            {ORIGINAL_PLAZA_TABS.map(([key, title, workspaceKey, icon]) => {
              const active = sectionId === (
                key === 'messages' ? 'conversations' : key
              )

              return (
                <button
                  key={key}
                  type="button"
                  data-nav-tab={key}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'yhu-plaza-spa-tab' +
                    (active ? ' is-active' : '')
                  }
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onNavigate(workspaceKey)
                  }}
                >
                  <img className="yhu-plaza-spa-tab-icon" src={`/assets/academy/plaza icons/${icon}`} alt="" />
                  <span>{title}</span>
                </button>
              )
            })}
          </nav>
          <PlazaDashboardLink
            to="/dashboard"
            className="yhu-plaza-spa-dashboard-link"
            aria-label="Back to Dashboard"
          >
            ← Dashboard
          </PlazaDashboardLink>
          </div>
        </div>

        <details className="yhu-plaza-spa-signals">
          <summary>Plaza Signals</summary>

          <div className="yhu-plaza-spa-signals-panel">
            <div className="yh-plaza-rail-list" id="plazaRailSignals">
              {signalsLoading ? (
                <div className="yh-plaza-empty">Loading signals...</div>
              ) : (
                <>
                  {signalsError && (
                    <div className="yh-plaza-empty" role="status">
                      Plaza Signals could not fully refresh.
                    </div>
                  )}
                  {signals.length ? (
                    signals.map((item, index) => (
                      <article className="yh-plaza-rail-mini" key={index}>
                        <strong>{item.title}</strong>
                        <span>{item.note}</span>
                      </article>
                    ))
                  ) : (
                    <div className="yh-plaza-empty">
                      {signalsError
                        ? 'Plaza Signals unavailable.'
                        : 'No recent signals yet.'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </details>
      </header>

      <main className="yhu-plaza-spa-main">
        <section className="yh-plaza-workspace-card">
          {children}
        </section>
      </main>
    </div>
  )}
/* END YHU_PLAZA_STANDALONE_SHELL_1TO1 */

export default PlazaStandaloneShell
