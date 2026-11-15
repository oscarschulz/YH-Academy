import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAcademyAccess } from '../dashboard/dashboardAccess'
import './AcademyShell.css'
import { ACADEMY_NAVIGATION } from './academyNavigation'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../services/api/apiClient'
import SettingsWorkspace from '../settings/SettingsWorkspace'


/* YHU_ACADEMY_UI_SHELL_PARITY_20261025 */
const ITEMS = ACADEMY_NAVIGATION


/* YHU_ACADEMY_A20_LIVE_PROGRESS_PARITY */
function readAcademyShellHome() {
  try {
    const value = JSON.parse(
      localStorage.getItem('yh_academy_home') || 'null'
    )
    return value && typeof value === 'object' &&
      !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function academyShellNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function academyShellPercent(value) {
  const number = academyShellNumber(value)
  return Math.max(0, Math.min(100,
    Math.round(number >= 0 && number <= 1
      ? number * 100 : number)))
}

function academyShellStats(home = {}) {
  const sources = [
    home?.missions,
    home?.roadmap?.missions,
    home?.roadmapMissions,
    home?.today?.missions,
    home?.todayProgress?.missions
  ]

  const missions =
    sources.find(Array.isArray)?.filter(Boolean) || []

  const done = mission => {
    const status = String(
      mission?.status ||
      mission?.missionStatus ||
      mission?.state ||
      'pending'
    ).toLowerCase()

    return ['completed', 'complete', 'done', 'cleared']
      .includes(status) ||
      mission?.completed === true ||
      mission?.isCompleted === true
  }

  const completedFromList = missions.filter(done).length

  const total = academyShellNumber(
    home?.today?.missionsTotal ??
    home?.todayProgress?.missionsTotal ??
    home?.missionsTotal ??
    home?.progress?.total ??
    missions.length
  )

  const completed = academyShellNumber(
    home?.today?.missionsCompleted ??
    home?.todayProgress?.missionsCompleted ??
    home?.missionsCompleted ??
    home?.progress?.completed ??
    completedFromList
  )

  const rawProgress =
    home?.today?.progress ??
    home?.today?.todayProgress ??
    home?.todayProgress?.progress

  let progress = total > 0
    ? academyShellPercent(completed / total)
    : 0

  if (rawProgress != null) {
    progress = academyShellPercent(rawProgress)
  } else if (home?.progress?.completionRate != null) {
    progress = Math.max(0, Math.min(100,
      Math.round(academyShellNumber(home.progress.completionRate))))
  } else if (typeof home?.progress === 'number' ||
    typeof home?.progress === 'string') {
    progress = academyShellPercent(home.progress)
  }

  /* YHU_ACADEMY_SHELL_ORIGINAL_PARITY_FINAL */
  const streak = academyShellNumber(
    home?.streakDays ??
    home?.transformationSystem?.currentStreak ??
    home?.today?.streakDays ??
    home?.today?.streak ??
    home?.streak ??
    home?.todayProgress?.streakDays ??
    home?.todayProgress?.streak
  )

  const readiness =
    home?.today?.readinessScore ??
    home?.readinessScore ??
    home?.plazaReadiness?.score ??
    home?.todayProgress?.readinessScore ??
    '--'

  const next = missions.find(mission => !done(mission)) ||
    missions[0] || null

  const nextSignal = String(
    next?.title ||
    next?.name ||
    next?.label ||
    home?.today?.nextMission ||
    home?.nextMission ||
    'Awaiting first mission'
  ).trim()

  return {
    progress,
    total,
    completed,
    streak,
    readiness: String(readiness),
    nextSignal,
    missions,
    done,
    hasMomentum: Boolean(
      total || completed || streak || missions.length
    )
  }
}

/* YHU_ACADEMY_A21_V2_ORIGINAL_NAV_PARITY */
const ORIGINAL_NAV_IDS = {
  'academy-roadmap': 'nav-missions',
  'academy-missions': 'nav-lead-missions',
  'academy-community': 'nav-chat',
  'academy-messages': 'nav-messages',
  'academy-voice': 'nav-voice',
}

/* YHU_ACADEMY_A25_ROADMAP_BADGE_PARITY */
function readAcademyRoadmapBadge() {
  let membership = {}
  let locked = false

  try {
    membership = JSON.parse(
      localStorage.getItem('yh_academy_membership_status_v1') || '{}'
    ) || {}

    locked =
      localStorage.getItem('yh_academy_roadmap_locked_v1') === 'true'
  } catch {}

  const membershipStatus = String(
    membership.applicationStatus || ''
  ).trim().toLowerCase()

  const roadmapStatus = String(
    membership.roadmapApplicationStatus || ''
  ).trim().toLowerCase()

  if (membershipStatus !== 'approved') {
    return { label: 'Locked', state: '' }
  }

  if (membership.hasRoadmapAccess === true) {
    return { label: 'Unlocked', state: 'is-unlocked' }
  }

  if (
    roadmapStatus === 'under review' ||
    roadmapStatus === 'new' ||
    locked
  ) {
    return { label: 'Pending Review', state: 'is-pending' }
  }

  return { label: 'Apply for Access', state: '' }
}


/* YHU PHASE 3: Single React owner for the Academy rectangular AI Coach. */

const YH_COACH_LEARN_FROM = [
  ['', 'Learn from'],
  ['alex_hormozi', 'Alex Hormozi'],
  ['elon_musk', 'Elon Musk'],
  ['mark_zuckerberg', 'Mark Zuckerberg'],
  ['steve_jobs', 'Steve Jobs'],
  ['naval_ravikant', 'Naval Ravikant'],
  ['sam_altman', 'Sam Altman'],
  ['warren_buffett', 'Warren Buffett'],
  ['jeff_bezos', 'Jeff Bezos'],
  ['julius_caesar', 'Julius Caesar'],
  ['alexander_the_great', 'Alexander The Great'],
  ['marcus_aurelius', 'Marcus Aurelius'],
  ['seneca', 'Seneca'],
  ['epictetus', 'Epictetus'],
  ['socrates', 'Socrates'],
  ['plato', 'Plato'],
  ['aristotle', 'Aristotle'],
  ['confucius', 'Confucius'],
  ['sun_tzu', 'Sun Tzu'],
  ['niccolo_machiavelli', 'Niccolò Machiavelli']
]

const YH_COACH_STORAGE = 'yh_academy_ai_coach_learn_from_v1'

function AcademyAiCoachRectModal({ open, onClose, onBadgeCheckout }) {
  const [history, setHistory] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [badgeActive, setBadgeActive] = useState(false)
  const [badgeChecking, setBadgeChecking] = useState(true)
  const [learnFrom, setLearnFrom] = useState('')
  const [badgeGate, setBadgeGate] = useState(false)
  const messageInput = useRef(null)
  const previousFocus = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => {
    busyRef.current = sending
  }, [sending])

  useEffect(() => {
    if (!open) return undefined

    previousFocus.current = document.activeElement
    document.body.classList.add('academy-ai-coach-rect-open')

    const bottom = document.getElementById('academy-mobile-bottom-nav')
    const previousDisplay = bottom?.style.getPropertyValue('display') || ''
    const previousPriority = bottom?.style.getPropertyPriority('display') || ''

    if (bottom) {
      bottom.setAttribute('data-academy-ai-coach-nav-lock', '1')
      bottom.style.setProperty('display', 'none')
    }

    const escape = event => {
      if (event.key === 'Escape' && !busyRef.current) onClose()
    }

    document.addEventListener('keydown', escape)
    const focusId = window.setTimeout(() => messageInput.current?.focus(), 80)

    return () => {
      document.body.classList.remove('academy-ai-coach-rect-open')
      bottom?.removeAttribute('data-academy-ai-coach-nav-lock')

      if (bottom) {
        if (previousDisplay) {
          bottom.style.setProperty('display', previousDisplay, previousPriority)
        } else {
          bottom.style.removeProperty('display')
        }
      }

      document.removeEventListener('keydown', escape)
      window.clearTimeout(focusId)
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return undefined
    let active = true

    setBadgeChecking(true)
    setBadgeGate(false)

    apiFetch('/api/payments/academy/learn-from-access', { method: 'GET' })
      .then(result => {
        if (!active) return
        const allowed = result?.access?.active === true
        setBadgeActive(allowed)

        let stored = ''
        try {
          stored = localStorage.getItem(YH_COACH_STORAGE) || ''
        } catch {}

        setLearnFrom(
          allowed && YH_COACH_LEARN_FROM.some(([key]) => key === stored)
            ? stored : ''
        )
      })
      .catch(() => {
        if (active) {
          setBadgeActive(false)
          setLearnFrom('')
        }
      })
      .finally(() => {
        if (active) setBadgeChecking(false)
      })

    setLoading(true)
    setError('')

    apiFetch('/api/academy/assistant/messages?conversationId=coach_main', {
      method: 'GET',
      cache: 'no-store'
    })
      .then(result => {
        if (active) {
          setHistory(Array.isArray(result?.messages) ? result.messages : [])
        }
      })
      .catch(err => {
        if (active) setError(err?.message || 'Failed to load AI Coach.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [open])

  const chooseMentor = key => {
    if (!YH_COACH_LEARN_FROM.some(([value]) => value === key)) return

    if (key && !badgeActive) {
      setBadgeGate(true)
      return
    }

    setLearnFrom(key)
    setBadgeGate(false)

    try {
      if (key) localStorage.setItem(YH_COACH_STORAGE, key)
      else localStorage.removeItem(YH_COACH_STORAGE)
    } catch {}
  }

  const send = async (value = draft) => {
    const message = String(value || '').trim()
    if (!message || sending) return

    if (learnFrom && !badgeActive) {
      setBadgeGate(true)
      return
    }

    setSending(true)
    setDraft('')
    setError('')

    const outgoing = {
      role: 'user',
      text: message,
      createdAt: new Date().toISOString()
    }

    setHistory(current => [...current, outgoing])

    try {
      const result = await apiFetch('/api/academy/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'coach_main',
          message,
          contextHint: learnFrom
            ? 'academy_modal_learn_from_' + learnFrom
            : 'academy_modal',
          learnFrom
        })
      })

      const fetched = await apiFetch(
        '/api/academy/assistant/messages?conversationId=coach_main',
        { method: 'GET', cache: 'no-store' }
      ).catch(() => null)

      if (Array.isArray(fetched?.messages) && fetched.messages.length) {
        setHistory(fetched.messages)
      } else if (result?.reply) {
        setHistory(current => [...current, {
          role: 'assistant',
          text: String(result.reply),
          createdAt: new Date().toISOString()
        }])
      }
    } catch (err) {
      setError(err?.message || 'Failed to get AI Coach reply.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div
      id="academy-ai-coach-rect-modal"
      className="academy-ai-coach-rect-modal is-open"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !sending) onClose()
      }}
    >
      <section
        className="academy-ai-coach-rect-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academy-ai-coach-rect-kicker"
      >
        <div className="academy-ai-coach-rect-head">
          <div className="academy-ai-coach-rect-identity">
            <div className="academy-ai-coach-rect-avatar has-ai-robot-image">
              <img
                className="academy-ai-coach-rect-avatar-img"
                src="/assets/yh-ai-robot-avatar.png"
                alt=""
              />
            </div>
            <div>
              <div
                id="academy-ai-coach-rect-kicker"
                className="academy-ai-coach-rect-kicker"
              >
                Academy Assistant
              </div>
            </div>
          </div>

          <button
            type="button"
            className="academy-ai-coach-rect-close"
            aria-label="Close AI Coach"
            disabled={sending}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="academy-ai-coach-rect-prompts">
          <details className="academy-ai-coach-rect-quick-menu">
            <summary className="academy-ai-coach-rect-quick-trigger">
              AI Coach Actions <span>⌄</span>
            </summary>

            <div className="academy-ai-coach-rect-quick-panel">
              <div className="academy-ai-coach-rect-quick-section-label">
                Learn from
              </div>

              <div className="academy-ai-coach-rect-learn-wrap">
                <label>Learn from</label>
                <details
                  className={
                    'academy-ai-coach-learn-menu' +
                    (!badgeActive ? ' is-locked' : '')
                  }
                >
                  <summary
                    className="academy-ai-coach-learn-trigger"
                    aria-label="Choose Learn From mentor"
                  >
                    {YH_COACH_LEARN_FROM.find(
                      ([key]) => key === learnFrom
                    )?.[1] || 'Learn from'}
                    <span>⌄</span>
                  </summary>

                  <div className="academy-ai-coach-learn-options hide-scrollbar">
                    {YH_COACH_LEARN_FROM.map(([key, label]) => (
                      <button
                        key={key || 'default'}
                        type="button"
                        className={
                          'academy-ai-coach-learn-option' +
                          (key === learnFrom ? ' is-selected' : '')
                        }
                        aria-current={key === learnFrom ? 'true' : 'false'}
                        onClick={() => chooseMentor(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>

                {badgeChecking && <small>Checking YHA access...</small>}
              </div>

              <div className="academy-ai-coach-rect-quick-divider" />
              <div className="academy-ai-coach-rect-quick-section-label">
                Quick prompts
              </div>

              {[
                'What should I focus on today?',
                'Simplify my next mission.',
                'Help me recover after missed tasks.'
              ].map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void send(prompt)}
                >
                  {['Today’s focus', 'Simplify mission', 'Recover'][index]}
                  <span>›</span>
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="academy-ai-coach-rect-history hide-scrollbar" aria-live="polite">
          {loading && (
            <div className="academy-ai-coach-rect-loading">
              Loading AI Coach...
            </div>
          )}

          {!loading && !history.length && !error && (
            <div className="academy-ai-coach-rect-empty">
              <strong>Ask your AI Coach anything about execution.</strong>
              <span>Your conversation will appear here.</span>
            </div>
          )}

          {history.map((item, index) => {
            const user = String(
              item.role || item.sender || ''
            ).toLowerCase() === 'user'

            const value = String(
              item.text || item.message || item.content || ''
            ).trim()

            if (!value) return null

            return (
              <div
                className={
                  'academy-ai-coach-rect-bubble ' +
                  (user ? 'is-user' : 'is-bot')
                }
                key={item.id || index}
              >
                <div className="academy-ai-coach-rect-bubble-avatar">
                  {user ? 'Y' : (
                    <img src="/assets/yh-ai-robot-avatar.png" alt="" />
                  )}
                </div>

                <div className="academy-ai-coach-rect-bubble-main">
                  <div className="academy-ai-coach-rect-bubble-meta">
                    <strong>{user ? 'You' : 'AI Coach'}</strong>
                  </div>
                  <div className="academy-ai-coach-rect-bubble-text">
                    {value}
                  </div>
                </div>
              </div>
            )
          })}

          {sending && (
            <div className="academy-ai-coach-rect-loading">
              AI Coach is thinking...
            </div>
          )}

          {error && (
            <div className="academy-ai-coach-rect-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <form
          className="academy-ai-coach-rect-form"
          onSubmit={event => {
            event.preventDefault()
            void send()
          }}
        >
          <textarea
            ref={messageInput}
            rows={1}
            value={draft}
            placeholder="Message AI Coach..."
            disabled={sending}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send AI Coach message"
          >
            ➤
          </button>
        </form>

        {badgeGate && (
          <div className="academy-ai-coach-learn-pay-modal" aria-hidden="false">
            <div className="academy-ai-coach-learn-pay-card">
              <button
                type="button"
                className="academy-ai-coach-learn-pay-close"
                aria-label="Close payment modal"
                onClick={() => setBadgeGate(false)}
              >
                ✕
              </button>
              <div className="academy-ai-coach-learn-pay-kicker">
                Academy / YHA Benefit
              </div>
              <h3>Unlock with the YHA Badge</h3>
              <p>
                Subscribe to the Academy Verification Badge to unlock
                mentor mode and access the full Learn From list inside
                the Academy AI Coach.
              </p>
              <div className="academy-ai-coach-learn-pay-options">
                <button type="button" onClick={() => { setBadgeGate(false); onBadgeCheckout?.() }}>
                  <strong>Avail YHA Badge</strong>
                  <span>Open existing subscription and badge checkout.</span>
                </button>
              </div>
              <div className="academy-ai-coach-learn-pay-status">
                Active YHA Academy Verified Badge is required for Learn From mode.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body
  )
}

export function AcademyLoadingScreen({
  text = 'Loading Academy…',
  embedded = false,
}) {
  return (
    <div role="status" aria-live="polite" style={{
      width: '100%',
      minHeight: embedded ? '100%' : '100dvh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'radial-gradient(ellipse at center, #102b48 0%, #071629 55%, #050f1d 100%)',
      color: '#eef4ff',
      fontFamily: 'Poppins, sans-serif',
    }}>
      <div style={{
        width: 'min(300px, 86vw)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          width: 68,
          height: 68,
          display: 'grid',
          placeItems: 'center',
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
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '.16em',
          color: '#b5e8fa',
        }}>
          THE ACADEMY
        </strong>

        {embedded && (
          <span style={{
            marginTop: 8,
            fontSize: 12,
            color: '#dcefff',
          }}>
            Preparing Academy section
          </span>
        )}

        <p style={{
          margin: '10px 0 18px',
          color: '#dcefff',
          fontSize: 13,
        }}>
          {text}
        </p>

        <svg
          viewBox="0 0 300 4"
          width="300"
          height="4"
          role="progressbar"
          aria-label="Loading Academy"
          aria-valuetext="Loading"
          style={{
            display: 'block',
            width: '100%',
            height: 4,
            overflow: 'hidden',
          }}
        >
          <defs>
            <linearGradient id="academy-loader-gradient"
              x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="55%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          <rect width="300" height="4" rx="2" fill="#24425e" />

          <rect x="-100" width="100" height="4" rx="2"
            fill="url(#academy-loader-gradient)">
            <animate attributeName="x"
              from="-100" to="300" dur="1.2s"
              repeatCount="indefinite" />
          </rect>
        </svg>
      </div>
    </div>
  )
}

export default function AcademyShell({
  activeKey, onNavigate, onBack, onProfileOpen, onToast, children
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [yhaCheckoutOpen, setYhaCheckoutOpen] = useState(false)
  const coachOpening = useRef(false)
  const closeCoach = useCallback(() => setCoachOpen(false), [])
  const [academyHome, setAcademyHome] =
    useState(readAcademyShellHome)
  const [roadmapBadge, setRoadmapBadge] =
    useState(readAcademyRoadmapBadge)
  const membershipLastCheckedAt = useRef(0)
  const [memberName, setMemberName] = useState('Hustler')
  const normalizedKey = activeKey === 'academy'
    ? 'academy-roadmap' : activeKey

  /* YHU_ACADEMY_PROFILE_HEADER_SYNC */
  useEffect(() => {
    const syncMemberName = () => {
      try {
        const name = localStorage.getItem('yh_user_name') ||
          sessionStorage.getItem('yh_user_name') ||
          localStorage.getItem('yh_user_username') ||
          'Hustler'

        setMemberName(String(name).trim() || 'Hustler')
      } catch {}
    }

    const onStorage = event => {
      if (
        event.key === null ||
        event.key === 'yh_user_name' ||
        event.key === 'yh_user_username'
      ) {
        syncMemberName()
      }
    }

    syncMemberName()

    window.addEventListener('yh:profile-updated', syncMemberName)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', syncMemberName)

    return () => {
      window.removeEventListener('yh:profile-updated', syncMemberName)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', syncMemberName)
    }
  }, [])

  useEffect(() => { setMenuOpen(false) }, [activeKey])

  useEffect(() => {
    let mounted = true

    const sync = () => {
      setAcademyHome(readAcademyShellHome())
      setRoadmapBadge(readAcademyRoadmapBadge())
    }

    /* YHU_ACADEMY_SERVER_MEMBERSHIP_REFRESH_V1 */
    const refreshMembership = () => {
      const now = Date.now()

      if (now - membershipLastCheckedAt.current < 30000) return

      membershipLastCheckedAt.current = now

      void fetchAcademyAccess()
        .then(() => {
          if (mounted) sync()
        })
        .catch(() => {
          // Preserve current UI while existing API gates enforce access.
        })
    }

    const onFocus = () => {
      sync()
      refreshMembership()
    }

    const onStorage = event => {
      if (
        event.key === 'yh_academy_home' ||
        event.key === 'yh_academy_membership_status_v1' ||
        event.key === 'yh_academy_roadmap_locked_v1' ||
        event.key === null
      ) sync()
    }

    sync()
    refreshMembership()
    window.addEventListener('yh-academy-home-updated', sync)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)

    return () => {
      mounted = false
      window.removeEventListener('yh-academy-home-updated', sync)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [activeKey])

  const itemButton = (item, mobile = false) => (
    <button
      key={item.key}
      type="button"
      className={mobile
        ? 'academy-mobile-nav-item' +
          (normalizedKey === item.key ? ' is-active' : '')
        : 'academy-react-channel-button'}
      aria-current={normalizedKey === item.key ? 'page' : undefined}
      onClick={() => onNavigate(item.key)}
    >
      <span className={mobile
        ? 'academy-mobile-nav-item-main' : 'sidebar-icon'}>
        <img
          src={item.icon}
          alt=""
          className={mobile
            ? 'academy-ui-icon academy-ui-icon-mobile'
            : 'academy-ui-icon academy-ui-icon-sidebar'}
        />
        {mobile && <span>{item.label}</span>}
      </span>

      {/* YHU_ACADEMY_FINAL_VISUAL_PARITY */}
      {mobile && item.key === 'academy-roadmap' && (
        <span
          id="roadmap-tab-state-badge-mobile"
          className={
            'academy-tab-state-badge academy-tab-state-badge-mobile ' +
            roadmapBadge.state
          }
        >
          {roadmapBadge.label}
        </span>
      )}
      {!mobile && (
        <span className="sidebar-text-group">
          <span className="sidebar-text">{item.label}</span>
          {item.key === 'academy-roadmap' && (
            <span
              id="roadmap-tab-state-badge"
              className={
                'academy-tab-state-badge ' +
                roadmapBadge.state
              }
            >
              {roadmapBadge.label}
            </span>
          )}
        </span>
      )}
    </button>
  )

  const stats = academyShellStats(academyHome || {})
  const openCoach = async () => {
    if (coachOpening.current) return
    coachOpening.current = true

    try {
      const [member, badge] = await Promise.allSettled([
        fetchAcademyAccess(),
        apiFetch('/api/payments/academy/learn-from-access', { method: 'GET' })
      ])

      const membership = member.status === 'fulfilled' ? member.value : null
      const status = String(membership?.applicationStatus || '').toLowerCase()

      /* YHU_PHASE5_COACH_ACCESS_PARITY */
      let legacyAcademyAccess = false
      try {
        legacyAcademyAccess =
          localStorage.getItem('yh_academy_access') === 'true'
      } catch {}

      const isMember = membership?.canEnterAcademy === true ||
        membership?.hasRoadmapAccess === true ||
        legacyAcademyAccess ||
        ['approved', 'active'].includes(status)

      const hasBadge =
        badge.status === 'fulfilled' &&
        badge.value?.access?.active === true

      if (!isMember && !hasBadge) {
        onToast?.(
          'Academy AI Coach is available to active Academy/YHA subscribers only.',
          'error'
        )
        return
      }

      setCoachOpen(true)
    } finally {
      coachOpening.current = false
    }
  }

  const bottom = [ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[3]]

  return (
    <>
      <nav className="yh-top-nav yhu-academy-native-header" aria-label="Academy header">
        <div className="nav-brand">
          <div className="academy-mobile-nav-drawer academy-mobile-nav-drawer-top" id="academy-mobile-nav-drawer">
            <button
              type="button"
              className="academy-mobile-nav-toggle"
              id="academy-mobile-nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="academy-mobile-nav-menu"
              aria-label="Open Academy menu"
              onClick={() => setMenuOpen(current => !current)}
            >☰</button>

            {menuOpen && (
              <div className="academy-mobile-nav-menu"
                id="academy-mobile-nav-menu">
                {ITEMS.map(item => itemButton(item, true))}
                <div className="academy-mobile-nav-divider"
                  aria-hidden="true" />
                <button
                  type="button"
                  className="academy-mobile-nav-item academy-mobile-nav-item-secondary"
                  onClick={onBack}
                >← Go back to Universe</button>
              </div>
            )}
          </div>

          <img src="/images/logo.avif" alt="YH Logo" />
          <span>UNIVERSE</span>
        </div>

        <div className="nav-actions academy-universe-return-actions">
          <button
            type="button"
            className="btn-secondary academy-back-universe-btn academy-top-universe-btn"
            onClick={onBack}
          >← Go back to Universe</button>
        </div>
        <div className="academy-header-tools" aria-label="Academy navigation">
          <div className="channel-content hide-scrollbar">
            <div className="academy-sidebar-shell">
              <div className="academy-sidebar-intro">
                <div className="academy-sidebar-kicker">
                  The Academy
                </div>
                <h3 className="academy-sidebar-title">
                  Execution Hub
                </h3>
                <p className="academy-sidebar-copy">
                  Switch between roadmap, community, messages, and
                  live voice without leaving the Academy.
                </p>
              </div>

              <ul className="channel-list academy-channel-list">
                {ITEMS.map(item => (
                  <li
                    key={item.key}
                    id={ORIGINAL_NAV_IDS[item.key]}
                    className={'channel-link' +
                      (normalizedKey === item.key ? ' active' : '')}
                  >
                    {itemButton(item)}
                  </li>
                ))}
              </ul>

              <AcademyDailyProgress stats={stats}
                onMissionOpen={() => onNavigate('academy-roadmap')} />
            </div>
          </div>
        </div>
      </nav>

      <div className="dashboard-core" id="academy-wrapper">


        <nav className="academy-mobile-bottom-nav"
        id="academy-mobile-bottom-nav"
        aria-label="Academy mobile navigation">
        {bottom.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-current={normalizedKey === item.key
              ? 'page' : undefined}
            className={'academy-mobile-bottom-nav-item academy-mobile-nav-item' +
              (normalizedKey === item.key ? ' is-active' : '')}
          >
            <span className="academy-mobile-bottom-nav-icon">
              <img
                src={item.icon}
                alt=""
                className="academy-ui-icon academy-ui-icon-bottom"
              />
            </span>
            <span className="academy-mobile-bottom-nav-label">
              {item.key === 'academy-community' ? 'Feed' : item.label}
            </span>
          </button>
        ))}
      </nav>

        {children}

        <aside className="yh-right-sidebar hide-scrollbar"
          aria-label="Academy signals">
          <div className="channel-category category-mt fw-bold color-neon">
            ⚡ ACADEMY SIGNALS
          </div>
          <div className="channel-category category-mt">
            MOMENTUM BOARD
          </div>
          <ul
            className="member-list leaderboard-list academy-momentum-board-v96"
            id="leaderboard-list"
            data-yh-momentum-board="v96"
            aria-label="Momentum board"
          >
            <li className={
              'academy-momentum-card-v96 ' +
              (stats.hasMomentum ? 'has-momentum' : 'is-empty')
            }>
              <div className="academy-momentum-head-v96">
                <span className="academy-momentum-kicker-v96">
                  ROADMAP SYNC
                </span>
                <strong>{stats.progress}%</strong>
              </div>
              <div className="academy-momentum-track-v96"
                aria-hidden="true">
                <span style={{ width: `${stats.progress}%` }} />
              </div>
              <div className="academy-momentum-stat-grid-v96">
                <div className="academy-momentum-stat-v96">
                  <span>MISSION</span>
                  <strong>
                    {stats.total
                      ? `${stats.completed}/${stats.total}`
                      : stats.completed}
                  </strong>
                </div>
                <div className="academy-momentum-stat-v96">
                  <span>STREAK</span>
                  <strong>{stats.streak}D</strong>
                </div>
                <div className="academy-momentum-stat-v96">
                  <span>RANK</span>
                  <strong>{stats.readiness}</strong>
                </div>
              </div>
              <div className="academy-momentum-next-v96">
                <span>NEXT SIGNAL</span>
                <strong>{stats.nextSignal}</strong>
              </div>
            </li>
          </ul>

          <div className="channel-category category-mt">
            ACTIVE NOW
          </div>
          <ul className="member-list">
            <li className="interactive-avatar">
              <button
                type="button"
                className="academy-react-member-button"
                onClick={() => onProfileOpen()}
              >
                <span className="member-avatar">
                  {memberName.slice(0, 1).toUpperCase()}
                </span>
                <span className="member-name">{memberName}</span>
              </button>
            </li>
          </ul>

          <button
            type="button"
            className="academy-right-bot-cta academy-single-right-bot academy-right-bot-safe-bounds is-docked academy-ai-coach-bottom-visible"
            onClick={openCoach}
            id="academy-right-sidebar-ai-coach"
            data-yh-single-right-bot="1"
            aria-label="Open Academy AI Coach"
          >
            <span className="academy-right-bot-cta-avatar has-ai-robot-image">
              <img
                src="/assets/yh-ai-robot-avatar.png?v=20260529-lower-right-ai-coach-avatar-v2"
                alt="AI Coach"
                className="academy-right-bot-cta-avatar-img"
              />
            </span>
            <strong>Ask AI Coach</strong>
          </button>
        </aside>
      </div>


      <AcademyAiCoachRectModal
        open={coachOpen}
        onClose={closeCoach}
        onBadgeCheckout={() => {
          setYhaCheckoutOpen(true)
        }}
      />
      {yhaCheckoutOpen && (
        <SettingsWorkspace
          checkoutOnly
          onToast={onToast}
          onCheckoutClose={() => setYhaCheckoutOpen(false)}
        />
      )}
    </>
  )
}


/* YHU_REACT_ACADEMY_STANDALONE_SHELL_PARITY */

function AcademyDailyProgress({ stats, onMissionOpen, loading = false }) {
  return (
    <details className="academy-header-progress">
      <summary>Daily Progress</summary>
      <div className="academy-sidebar-progress">
        <div className="academy-sidebar-progress-head">
          <span>Daily Progress</span>
          <span id="progress-text">
            {loading ? 'Loading progress…' : `${stats.progress}% Daily Progress`}
          </span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" id="progress-bar-fill"
            style={{ width: `${stats.progress}%` }} />
        </div>
        <div className="action-steps-compact" id="blueprint-list">
          {stats.missions.slice(0, 3).map((mission, i) => (
            <button key={mission?.id || i} type="button"
              className="academy-react-progress-link"
              onClick={onMissionOpen}>
              <span>
                {stats.done(mission) ? '✓ ' : '○ '}
                {mission?.title || mission?.name || mission?.label || 'Mission'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </details>
  )
}

export function AcademyStandaloneShell({ sectionId, navigateTo, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [academyHome, setAcademyHome] = useState(readAcademyShellHome)
  const stats = academyShellStats(academyHome || {})

  useEffect(() => {
    const body = document.body
    const oldView = body.getAttribute('data-yh-view')
    const oldPage = body.getAttribute('data-yh-page')
    const hadReady = body.classList.contains('academy-shell-ready')
    body.setAttribute('data-yh-view', 'academy')
    body.setAttribute('data-yh-page', 'academy')
    body.classList.add('academy-shell-ready')
    return () => {
      if (oldView == null) body.removeAttribute('data-yh-view')
      else body.setAttribute('data-yh-view', oldView)
      if (oldPage == null) body.removeAttribute('data-yh-page')
      else body.setAttribute('data-yh-page', oldPage)
      if (!hadReady) body.classList.remove('academy-shell-ready')
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
    let active = true
    const controller = new AbortController()
    const sync = () => setAcademyHome(readAcademyShellHome())
    const onStorage = event => {
      if (event.key === 'yh_academy_home' || event.key === null) sync()
    }
    window.addEventListener('yh-academy-home-updated', sync)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', sync)
    sync()

    if (sectionId !== 'roadmap') {
      void apiFetch('/api/academy/home', {
        method: 'GET',
        signal: controller.signal,
      }).then(result => {
        if (!active || !result || typeof result !== 'object' || Array.isArray(result)) return
        setAcademyHome(result)
        try {
          localStorage.setItem('yh_academy_home', JSON.stringify(result))
          window.dispatchEvent(new Event('yh-academy-home-updated'))
        } catch {}
      }).catch(() => {
        if (active) sync()
      })
    }

    return () => {
      active = false
      controller.abort()
      window.removeEventListener('yh-academy-home-updated', sync)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', sync)
    }
  }, [sectionId])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const onEscape = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [mobileMenuOpen])

  const open = section => {
    setMobileMenuOpen(false)
    navigateTo(section === 'dashboard' ? '/dashboard' : `/academy/${section}`)
  }

  const navItem = (item, location) => {
    const isActive = sectionId === item.section
    const image = <img src={item.icon} alt="" className={`academy-ui-icon academy-ui-icon-${location}`} />

    if (location === 'sidebar') {
      return (
        <li key={item.id} id={item.id} title={item.type} data-type={item.type}
          className={`channel-link${isActive ? ' active' : ''}`}
          role="button" tabIndex={0} aria-current={isActive ? 'page' : undefined}
          onClick={() => open(item.section)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              open(item.section)
            }
          }}>
          <div className="sidebar-icon">{image}</div>
          <span className="sidebar-text-group"><span className="sidebar-text">{item.label}</span></span>
        </li>
      )
    }

    if (location === 'bottom') {
      return (
        <button key={item.id} type="button" onClick={() => open(item.section)}
          data-academy-target={item.id}
          aria-current={isActive ? 'page' : undefined}
          className={`academy-mobile-bottom-nav-item academy-mobile-nav-item${isActive ? ' is-active' : ''}`}>
          <span className="academy-mobile-bottom-nav-icon">{image}</span>
          <span className="academy-mobile-bottom-nav-label">{item.short}</span>
        </button>
      )
    }

    return (
      <button key={item.id} type="button" onClick={() => open(item.section)}
        data-academy-target={item.id} aria-current={isActive ? 'page' : undefined}
        className={`academy-mobile-nav-item${isActive ? ' is-active' : ''}`}>
        <span className="academy-mobile-nav-item-main">{image}<span>{item.label}</span></span>
      </button>
    )
  }

  return (
    <div className="dashboard-layout fade-in yhu-academy-p1" data-yh-react-academy-shell="standalone">
      <nav className="yh-top-nav yhu-academy-native-header" aria-label="Academy header">
        <div className="nav-brand">
          <div className="academy-mobile-nav-drawer academy-mobile-nav-drawer-top" id="academy-mobile-nav-drawer">
            <button type="button" id="academy-mobile-nav-toggle" className="academy-mobile-nav-toggle"
              aria-expanded={mobileMenuOpen} aria-controls="academy-mobile-nav-menu"
              aria-label="Open Academy menu" onClick={() => setMobileMenuOpen(value => !value)}>☰</button>
            <div id="academy-mobile-nav-menu" className={`academy-mobile-nav-menu${mobileMenuOpen ? '' : ' hidden-step'}`}>
              {ACADEMY_NAVIGATION.map(item => navItem(item, 'mobile'))}
              <div className="academy-mobile-nav-divider" aria-hidden="true" />
              <button type="button" className="academy-mobile-nav-item academy-mobile-nav-item-secondary"
                onClick={() => open('dashboard')}>← Go back to Universe</button>
            </div>
          </div>
          <img src="/images/logo.avif" alt="YH Logo" />
          <span>UNIVERSE</span>
        </div>
        <div className="nav-actions academy-universe-return-actions">
          <button type="button" className="btn-secondary academy-back-universe-btn academy-top-universe-btn"
            id="btn-academy-back-universe" onClick={() => open('dashboard')}>← Go back to Universe</button>
        </div>
        <div className="academy-header-tools" aria-label="Academy navigation">
          <div className="channel-content hide-scrollbar">
            <div className="academy-sidebar-shell">
              <div className="academy-sidebar-intro">
                <div className="academy-sidebar-kicker">The Academy</div>
                <h3 className="academy-sidebar-title">Execution Hub</h3>
                <p className="academy-sidebar-copy">Switch between roadmap, community, messages, and live voice without leaving the Academy.</p>
              </div>
              <ul className="channel-list academy-channel-list">
                {ACADEMY_NAVIGATION.map(item => navItem(item, 'sidebar'))}
              </ul>
              <AcademyDailyProgress stats={stats} loading={academyHome == null}
                onMissionOpen={() => open('roadmap')} />
            </div>
          </div>
        </div>
      </nav>
      <div className="dashboard-core" id="academy-wrapper">

        <nav className="academy-mobile-bottom-nav" id="academy-mobile-bottom-nav" aria-label="Academy mobile navigation">
          {ACADEMY_NAVIGATION.slice(0, 4).map(item => navItem(item, 'bottom'))}
        </nav>
        <main
          className="yh-main-chat hide-scrollbar"
          id={sectionId === 'community' ? 'academy-feed-view' : undefined}
          aria-label="Academy content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
/* END YHU_REACT_ACADEMY_STANDALONE_SHELL_PARITY */
