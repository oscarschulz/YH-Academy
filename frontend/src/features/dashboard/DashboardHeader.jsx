import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCachedDivisionAccessState,
  verifyDivisionAccess,
} from './dashboardAccess'
import { getDashboardWorkspace } from './dashboardWorkspaceMap'
import { useMessagesInbox, loadMessagesInbox } from '../messages/messagesUtils.js'

/* YHU_DASHBOARD_4A_DIRECT_NAV */
/* YHU_SETTINGS_UNIFIED_20261028 */
export default function DashboardHeader({
  onWorkspaceOpen,
  onAccessBlocked,
  onDashboardOpen,
  onUtilityOpen,
  onLogout,
}) {
  const navigate = useNavigate()
  const messageRooms = useMessagesInbox()
  const messagesUnread = messageRooms.reduce((sum, room) => sum + Math.max(0, Number(room.unreadCount) || 0), 0)

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) void loadMessagesInbox().catch(() => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const [
    busyDivision,
    setBusyDivision,
  ] = useState(null)

  const [
    plazaAuthorityPending,
    setPlazaAuthorityPending,
  ] = useState(() => {
    return !getCachedDivisionAccessState(
      'plazas',
    ).approved
  })

  const [
    accessStates,
    setAccessStates,
  ] = useState(() => ({
    academy:
      getCachedDivisionAccessState(
        'academy',
      ),

    plazas:
      getCachedDivisionAccessState(
        'plazas',
      ),

    federation:
      getCachedDivisionAccessState(
        'federation',
      ),
  }))

  /* SIDEBAR ACCESS LIVE SYNC */
  useEffect(() => {
    let active = true

    Promise.allSettled([
      verifyDivisionAccess(
        'academy',
      ),
      verifyDivisionAccess(
        'plazas',
      ),
      verifyDivisionAccess(
        'federation',
      ),
    ])
      .then((results) => {
        if (!active) return

        setAccessStates(
          (current) => ({
            academy:
              results[0]?.status ===
              'fulfilled'
                ? results[0].value
                : current.academy,

            plazas:
              results[1]?.status ===
              'fulfilled'
                ? results[1].value
                : current.plazas,

            federation:
              results[2]?.status ===
              'fulfilled'
                ? results[2].value
                : current.federation,
          }),
        )
      })
      .finally(() => {
        if (active) {
          setPlazaAuthorityPending(
            false,
          )
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const syncAccessFromVerifiedCache = () => {
      setAccessStates({
        academy: getCachedDivisionAccessState('academy'),
        plazas: getCachedDivisionAccessState('plazas'),
        federation: getCachedDivisionAccessState('federation'),
      })

      setPlazaAuthorityPending(false)
    }

    window.addEventListener(
      'yh:dashboard-access-refreshed',
      syncAccessFromVerifiedCache
    )

    return () => window.removeEventListener(
      'yh:dashboard-access-refreshed',
      syncAccessFromVerifiedCache
    )
  }, [])

  const openApprovedWorkspace = (
    division,
    workspaceKey,
  ) => {
    const workspace =
      getDashboardWorkspace(
        workspaceKey,
      )

    if (!workspace) return

    setMobileOpen(false)

    const destination = {
      academy: '/academy',
      plazas: '/plaza',
      federation: '/federation',
    }[division]

    if (destination) {
      navigate(destination)
    }
  }

  const resolveAccess = async (
    division,
    workspaceKey,
  ) => {
    setBusyDivision(
      division,
    )

    try {
      const state =
        await verifyDivisionAccess(
          division,
        )

      setAccessStates(
        (current) => ({
          ...current,
          [division]: state,
        }),
      )

      if (
        division === 'plazas'
      ) {
        setPlazaAuthorityPending(
          false,
        )
      }

      if (state.approved) {
        openApprovedWorkspace(
          division,
          workspaceKey,
        )

        return
      }

      onAccessBlocked?.({
        division,
        workspaceKey,
        state,
      })
    } finally {
      setBusyDivision(null)
    }
  }

  const handleDivisionClick =
    async (division) => {
      const defaultWorkspace = {
        academy: 'academy',
        plazas: 'plazas',
        federation:
          'federation',
      }[division]

      if (!defaultWorkspace) {
        return
      }

      await resolveAccess(
        division,
        defaultWorkspace,
      )
    }

  const handleDashboardClick =
    () => {
      setMobileOpen(false)

      onDashboardOpen?.()
    }

  const handleUtilityOpen = (
    key,
  ) => {
    setMobileOpen(false)

    onUtilityOpen?.(key)
  }

  const [mobileOpen, setMobileOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setMobileOpen(false)
      } else if (
        event.type === 'pointerdown' &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)

    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [])

  const nav = [
    ['academy', 'Academy'],
    ['plazas', 'Plazas'],
    ['federation', 'Federation'],
  ]

  const businessChatsApproved =
    accessStates.plazas
      ?.approved === true

  const businessChatsDisabled =
    plazaAuthorityPending ||
    !businessChatsApproved

  const businessChatsTitle =
    plazaAuthorityPending
      ? 'Checking Plazas access...'
      : businessChatsApproved
        ? 'Open Business Chats'
        : 'Business Chats unlock after Plazas approval.'


  return (
    <nav
      ref={rootRef}
      className="yhu-global-nav"
      aria-label="YH Universe"
    >
      <button
        type="button"
        className="yhu-nav-brand"
        onClick={handleDashboardClick}
      >
        <img src="/images/logo.avif" alt="" />
        <strong>YH Universe</strong>
      </button>

      <button
        type="button"
        className="yhu-nav-trigger"
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(value => !value)}
      >
        ☰
      </button>

      <div className={
        "yhu-nav-primary" + (mobileOpen ? ' is-open' : '')
      }>
        <button
          type="button"
          className="yhu-nav-link"
          onClick={handleDashboardClick}
        >
          Dashboard
        </button>

        {nav.map(([division, label]) => (
          <button
            type="button"
            key={division}
            className="yhu-nav-link"
            data-yh-dashboard-shell={division}
            disabled={busyDivision === division}
            aria-busy={busyDivision === division}
            onClick={() => handleDivisionClick(division)}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          className="yhu-nav-link"
          onClick={() => navigate('/messages')}
        >
          Messages
          {messagesUnread > 0 && <span className="yh-direct-message-nav-badge" data-yh-direct-message-badge aria-label={messagesUnread + ' unread messages'}>{messagesUnread > 99 ? '99+' : messagesUnread}</span>}
        </button>

        <button
          type="button"
          className="yhu-nav-link"
          disabled={businessChatsDisabled}
          title={businessChatsTitle}
          onClick={async () => {
            try {
              const state = await verifyDivisionAccess('plazas')

              if (state?.approved) {
                navigate('/business-chats')
              } else {
                onAccessBlocked?.({
                  division: 'plazas',
                  workspaceKey: 'business-chats',
                  state
                })
              }
            } catch {
              console.warn('Business Chats access verification unavailable')
            }
          }}
        >
          Business Chats
        </button>

        <button
          type="button"
          className="yhu-nav-link"
          onClick={() => {
            setMobileOpen(false)
            navigate('/settings')
          }}
        >
          Account
        </button>
      </div>
    </nav>
  )
}
