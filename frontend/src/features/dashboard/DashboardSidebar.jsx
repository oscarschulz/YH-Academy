import { useEffect, useState } from 'react'
import {
  getCachedDivisionAccessState,
  verifyDivisionAccess,
} from './dashboardAccess'
import { getDashboardWorkspace } from './dashboardWorkspaceMap'

const ACADEMY_ITEMS = [
  {
    key: 'academy-roadmap',
    label: 'Roadmap',
    icon: '/assets/academy/icons/academy-icon-roadmap.png',
  },
  {
    key: 'academy-missions',
    label: 'Missions',
    icon: '/assets/academy/icons/academy-icon-missions.png',
  },
  {
    key: 'academy-community',
    label: 'Community Feed',
    icon: '/assets/academy/icons/academy-icon-community-feed-news.png',
  },
  {
    key: 'academy-messages',
    label: 'Messages',
    icon: '/assets/academy/icons/academy-icon-messages.png',
  },
  {
    key: 'academy-voice',
    label: 'Live Voice Lounge',
    icon: '/assets/academy/icons/academy-icon-live-voice-lounge.png',
  },
]

const PLAZA_ITEMS = [
  {
    key: 'plazas-explorer',
    label: 'Home',
    icon: '/assets/academy/plaza%20icons/plaza%20atlas.png',
  },
  {
    key: 'plazas-opportunities',
    label: 'Opportunities',
    icon: '/assets/academy/plaza%20icons/opportunities.png',
  },
  {
    key: 'plazas-directory',
    label: 'Directory',
    icon: '/assets/academy/plaza%20icons/directory.png',
  },
  {
    key: 'plazas-regions',
    label: 'Regions',
    icon: '/assets/academy/plaza%20icons/regions.png',
  },
  {
    key: 'plazas-meetups',
    label: 'Meetups',
    icon: '/assets/academy/plaza%20icons/meetups.png',
  },
  {
    key: 'plazas-conversations',
    label: 'Conversations',
    icon: '/assets/academy/plaza%20icons/conversations.png',
  },
  {
    key: 'plazas-inbox',
    label: 'Inbox',
    icon: '/assets/academy/plaza%20icons/inbox.png',
  },
  {
    key: 'plazas-patron',
    label: 'Patron',
    icon: '/assets/academy/plaza%20icons/patron.png',
  },
]

const FEDERATION_ITEMS = [
  {
    key: 'federation-command',
    label: 'Command',
    icon: '/assets/academy/federation%20icons/command.png',
  },
  {
    key: 'federation-connect',
    label: 'Connect',
    icon: '/assets/academy/federation%20icons/connect.png',
  },
  {
    key: 'federation-deal-rooms',
    label: 'Deal Rooms',
    icon: '/assets/academy/federation%20icons/deal%20rooms.png',
  },
  {
    key: 'federation-directory',
    label: 'Directory',
    icon: '/assets/academy/federation%20icons/directory.png',
  },
  {
    key: 'federation-requests',
    label: 'My Requests',
    icon: '/assets/academy/federation%20icons/my%20requests.png',
  },
  {
    key: 'federation-referrals',
    label: 'Referrals',
    icon: '/assets/academy/federation%20icons/referrals.png',
  },
  {
    key: 'federation-access',
    label: 'My Access',
    icon: '/assets/academy/federation%20icons/my%20access.png',
  },
]

function getStatusLabel(state) {
  if (state?.approved) return ''
  if (state?.pending) return 'Pending'
  return 'Apply'
}

function DivisionGroup({
  division,
  label,
  icon,
  items,
  expanded,
  busy,
  accessState,
  onDivisionClick,
  onChildClick,
}) {
  const statusLabel =
    getStatusLabel(accessState)

  const pendingLocked =
    accessState?.pending === true

  return (
    <div
      className={`yh-sidebar-division-group${expanded ? ' is-expanded' : ''}`}
      data-yh-sidebar-division={division}
    >
      <button
        type="button"
        className="btn-secondary yh-sidebar-command-link yh-sidebar-primary-link"
        aria-expanded={expanded}
        aria-controls={`yh-sidebar-subnav-${division}`}
        aria-disabled={
          busy || pendingLocked ? 'true' : 'false'
        }
        disabled={busy || pendingLocked}
        data-yh-dashboard-shell={division}
        onClick={() =>
          onDivisionClick(division)
        }
      >
        <span className="yh-sidebar-command-icon">
          <img
            src={icon}
            alt=""
            className="yh-sidebar-command-icon-img"
          />
        </span>

        <span>{label}</span>

        {statusLabel && (
          <span
            className="yh-sidebar-division-status-pill"
            data-yh-sidebar-status-pill={
              division
            }
          >
            {statusLabel}
          </span>
        )}
      </button>

      {expanded && (
        <div
          className="yh-sidebar-subnav"
          id={`yh-sidebar-subnav-${division}`}
          aria-hidden="false"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className="yh-sidebar-subnav-link"
              data-yh-sidebar-child={
                item.key
              }
              disabled={busy || pendingLocked}
              onClick={() =>
                onChildClick(item.key)
              }
            >
              <span className="yh-sidebar-subnav-icon">
                <img
                  src={item.icon}
                  alt=""
                  className="yh-sidebar-subnav-icon-img"
                />
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UtilityButton({
  workspaceKey,
  id,
  className = '',
  icon,
  children,
  disabled = false,
  busy = false,
  title = '',
  badge,
  onClick,
}) {
  return (
    <button
      id={id}
      type="button"
      className={`btn-secondary yh-sidebar-command-link yh-sidebar-primary-link ${className}`}
      data-yh-dashboard-shell={
        workspaceKey
      }
      aria-disabled={
        disabled ? 'true' : 'false'
      }
      aria-busy={
        busy ? 'true' : 'false'
      }
      disabled={disabled}
      title={title || undefined}
      onClick={onClick}
    >
      <span className="yh-sidebar-command-icon">
        {icon ? (
          <img
            src={icon}
            alt=""
            className="yh-sidebar-command-icon-img"
          />
        ) : (
          <span aria-hidden="true">
            ◎
          </span>
        )}
      </span>

      <span>{children}</span>

      {badge > 0 && (
        <span className="yh-business-chat-nav-badge">
          {Math.min(
            Number(badge) || 0,
            99,
          )}
        </span>
      )}
    </button>
  )
}

export default function DashboardSidebar({
  onWorkspaceOpen,
  onAccessBlocked,
  onDashboardOpen,
  onUtilityOpen,
  onLogout,
}) {
  const [
    expandedDivision,
    setExpandedDivision,
  ] = useState(null)

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

    setExpandedDivision(
      division,
    )

    onWorkspaceOpen?.({
      key: workspaceKey,
      ...workspace,
    })
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

      if (expandedDivision === division) {
        setExpandedDivision(null)
        return
      }

      await resolveAccess(
        division,
        defaultWorkspace,
      )
    }

  const handleChildClick =
    async (workspaceKey) => {
      const workspace =
        getDashboardWorkspace(
          workspaceKey,
        )

      if (!workspace) return

      await resolveAccess(
        workspace.division,
        workspaceKey,
      )
    }

  const handleDashboardClick =
    () => {
      setExpandedDivision(null)

      onDashboardOpen?.()
    }

  const handleUtilityOpen = (
    key,
  ) => {
    setExpandedDivision(null)

    onUtilityOpen?.(key)
  }

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
    <nav className="yh-top-nav">
      <div className="nav-brand">
        <img
          src="/images/logo.avif"
          alt="YH Logo"
        />

        <span>UNIVERSE</span>
      </div>

      <div className="nav-actions yh-command-sidebar-nav">
        <div className="yh-sidebar-nav-group">
          <div className="yh-sidebar-nav-label">
            Navigation
          </div>

          <button
            type="button"
            className="btn-secondary yh-sidebar-command-link yh-sidebar-primary-link yh-sidebar-command-center-label"
            aria-label="My Dashboard"
            data-yh-dashboard-shell="overview"
            onClick={
              handleDashboardClick
            }
          >
            <span className="yh-sidebar-command-icon">
              <img
                src="/assets/dashboard/dashboard%20icon.png"
                alt=""
                className="yh-sidebar-command-icon-img"
              />
            </span>

            <span>
              My Dashboard
            </span>
          </button>

          <DivisionGroup
            division="academy"
            label="Academy"
            icon="/assets/dashboard/academy.png"
            items={ACADEMY_ITEMS}
            expanded={
              expandedDivision ===
              'academy'
            }
            busy={
              busyDivision ===
              'academy'
            }
            accessState={
              accessStates.academy
            }
            onDivisionClick={
              handleDivisionClick
            }
            onChildClick={
              handleChildClick
            }
          />

          <DivisionGroup
            division="plazas"
            label="Plazas"
            icon="/assets/dashboard/plaza.png"
            items={PLAZA_ITEMS}
            expanded={
              expandedDivision ===
              'plazas'
            }
            busy={
              busyDivision ===
              'plazas'
            }
            accessState={
              accessStates.plazas
            }
            onDivisionClick={
              handleDivisionClick
            }
            onChildClick={
              handleChildClick
            }
          />

          <DivisionGroup
            division="federation"
            label="Federation"
            icon="/assets/dashboard/federation.png"
            items={FEDERATION_ITEMS}
            expanded={
              expandedDivision ===
              'federation'
            }
            busy={
              busyDivision ===
              'federation'
            }
            accessState={
              accessStates.federation
            }
            onDivisionClick={
              handleDivisionClick
            }
            onChildClick={
              handleChildClick
            }
          />
        </div>

        <div className="yh-sidebar-nav-group">
          <div className="yh-sidebar-nav-label">
            Utilities
          </div>

          <UtilityButton
            workspaceKey="wallet"
            id="btn-open-yh-wallet"
            className="yh-wallet-open-btn"
            icon="/assets/dashboard/wallet.png"
            onClick={() =>
              handleUtilityOpen(
                'wallet',
              )
            }
          >
            Wallet
          </UtilityButton>

          <UtilityButton
            workspaceKey="messages"
            id="btn-open-yh-messages"
            className="yh-direct-messages-open-btn"
            icon="/assets/academy/icons/academy-icon-messages.png"
            onClick={() =>
              handleUtilityOpen(
                'messages',
              )
            }
          >
            Messages
          </UtilityButton>

          <UtilityButton
            workspaceKey="business-chats"
            id="btn-open-yh-business-chats"
            className="yh-business-chat-open-btn"
            icon="/assets/dashboard/business-chats.png"
            disabled={
              businessChatsDisabled
            }
            busy={
              plazaAuthorityPending
            }
            title={
              businessChatsTitle
            }
            onClick={() =>
              handleUtilityOpen(
                'business-chats',
              )
            }
          >
            Business Chats
          </UtilityButton>

          <UtilityButton
            workspaceKey="referral"
            icon="/assets/dashboard/referral%20icon.png"
            onClick={() =>
              handleUtilityOpen(
                'referral',
              )
            }
          >
            Referral
          </UtilityButton>

          <UtilityButton
            workspaceKey="my-contacts"
            id="btn-open-dashboard-my-contacts"
            onClick={() =>
              handleUtilityOpen(
                'my-contacts',
              )
            }
          >
            My Contacts
          </UtilityButton>

          <UtilityButton
            workspaceKey="resources"
            id="yh-resources-menu-btn"
            className="yh-resources-menu-btn"
            icon="/assets/dashboard/resources%20icon.png"
            onClick={() =>
              handleUtilityOpen(
                'resources',
              )
            }
          >
            Resources
          </UtilityButton>
        </div>

        <div className="yh-sidebar-nav-group yh-sidebar-system-group">
          <div className="yh-sidebar-nav-label">
            System
          </div>

          <UtilityButton
            workspaceKey="settings"
            id="btn-open-dashboard-settings"
            className="yh-dashboard-settings-btn"
            icon="/assets/dashboard/settings.png"
            onClick={() =>
              handleUtilityOpen(
                'settings',
              )
            }
          >
            Settings
          </UtilityButton>

          <button
            type="button"
            className="btn-logout yh-sidebar-command-link yh-sidebar-primary-link"
            onClick={() =>
              onLogout?.()
            }
          >
            <span className="yh-sidebar-command-icon">
              <img
                src="/assets/dashboard/logout.png"
                alt=""
                className="yh-sidebar-command-icon-img"
              />
            </span>

            <span>
              Log out
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}
