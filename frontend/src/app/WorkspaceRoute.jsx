import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import DashboardPage from '../features/dashboard/DashboardPage'
import AcademyWorkspace from '../features/academy/AcademyWorkspace'
import { AcademyStandaloneShell, AcademyLoadingScreen } from '../features/academy/AcademyShell'
import PlazaWorkspace from '../features/plaza/PlazaWorkspace'
import tutorialScriptUrl from '../features/tutorials/yh-division-tutorials.js?url'
import PlazaStandaloneShell, { PlazaLoadingBar } from '../features/plaza/PlazaStandaloneShell'
import '../features/plaza/PlazaAccessGate.css'
import FederationWorkspace from '../features/federation/FederationWorkspace'
import FederationStandaloneShell from '../features/federation/FederationStandaloneShell'
import BusinessChatsWorkspace from '../features/business-chats/BusinessChatsWorkspace'
import ProfileWorkspace from '../features/profile/ProfileWorkspace'
import WalletWorkspace from '../features/wallet/WalletWorkspace'

import {
  getWorkspace,
  getWorkspaceSection,
} from '../config/workspaceRegistry'

import {
  verifyDivisionAccess,
  fetchPlazaAccess,
  isPlazaApproved,
  normalizeAccessStatus,
} from '../features/dashboard/dashboardAccess'

import {
  getDefaultWorkspacePath,
  getWorkspacePath,
} from './workspaceNavigation'

const SECTION_WORKSPACE_KEYS = {
  academy: {
    roadmap: 'academy-roadmap',
    missions: 'academy-missions',
    community: 'academy-community',
    messages: 'academy-messages',
    voice: 'academy-voice',
    video: 'academy-video',
    announcements: 'academy-announcements',
    profile: 'academy-profile',
  },

  plaza: {
    explorer: 'plazas-explorer',
    feed: 'plazas-feed',
    inbox: 'plazas-inbox',
    notifications: 'plazas-notifications',
    conversations: 'plazas-conversations',
    meetups: 'plazas-meetups',
    opportunities: 'plazas-opportunities',
    directory: 'plazas-directory',
    regions: 'plazas-regions',
    atlas: 'plazas-atlas',
    patron: 'plazas-patron',
    'patron-desk': 'plazas-patron-desk',
    bridge: 'plazas-bridge',
    requests: 'plazas-requests',
  },

  federation: {
    command: 'federation-command',
    connect: 'federation-connect',
    'deal-rooms': 'federation-deal-rooms',
    directory: 'federation-directory',
    requests: 'federation-requests',
    referrals: 'federation-referrals',
    access: 'federation-access',
  },
}

const WORKSPACE_KEY_PATHS = {
  'academy-roadmap': '/academy/roadmap',
  'academy-missions': '/academy/missions',
  'academy-community': '/academy/community',
  'academy-messages': '/academy/messages',
  'academy-voice': '/academy/voice',
  'academy-video': '/academy/video',
  'academy-announcements': '/academy/announcements',
  'academy-profile': '/academy/profile',

  'business-chats': '/business-chats',

  federation: '/federation/command',
  'federation-command': '/federation/command',
  'federation-connect': '/federation/connect',
  'federation-deal-rooms': '/federation/deal-rooms',
  'federation-directory': '/federation/directory',
  'federation-requests': '/federation/requests',
  'federation-referrals': '/federation/referrals',
  'federation-access': '/federation/access',
}

const ACCESS_DIVISION = {
  academy: 'academy',
  plaza: 'plazas',
  federation: 'federation',
}

function RouteToast({ toast }) {
  if (!toast?.message) {
    return null
  }

  return (
    <div
      role={
        toast.type === 'error'
          ? 'alert'
          : 'status'
      }
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 10000,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(20, 20, 24, 0.96)',
        color: '#fff',
        boxShadow:
          '0 12px 36px rgba(0, 0, 0, 0.24)',
        fontSize: '14px',
        lineHeight: 1.4,
      }}
    >
      {toast.message}
    </div>
  )
}

function PlazaAccessGate({ access, onBack }) {
  const status = String(access?.status || '').trim()

  return (
    <main className="yhu-plaza-access-screen">
      <section className="yhu-plaza-access-card">
        <div className="yhu-plaza-access-brand">
          <img src="/images/logo.avif" alt="YH Logo" />
          <span>YH Universe</span>
        </div>

        <div className="yhu-plaza-access-heading">
          <span>Plaza Application</span>
          <h1>The Plaza is application-reviewed.</h1>
          <p>
            Any YH member can apply for Plaza access anytime.
            Your Academy Score, Plaza-ready signal, and profile
            depth will be shown to admin as review context,
            but they no longer block the application.
          </p>
        </div>

        {access?.hasApplication && status !== 'rejected' ? (
          <div className="yhu-plaza-access-status" role="status">
            <strong>
              Your Plaza application is {status || 'under review'}.
            </strong>
            <p>
              Admin approval is required before you can enter
              the Plaza universe. You do not need to submit
              another application right now.
            </p>
          </div>
        ) : status === 'rejected' ? (
          <div className="yhu-plaza-access-status" role="status">
            <strong>
              Your previous Plaza application was not approved.
            </strong>
            <p>
              You may submit a new application with stronger,
              clearer information.
            </p>
          </div>
        ) : null}

        <div className="yhu-plaza-access-stop">
          <strong>Plaza access is locked.</strong>
          <p>
            Go back to the Dashboard to apply or check
            your current application status.
          </p>
          <button type="button" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </section>
    </main>
  )
}

function AccessChecking() {
  return (
    <main
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <p>Checking access…</p>
    </main>
  )
}






export default function WorkspaceRoute({
  workspaceId,
}) {
  const navigate = useNavigate()
  const { sectionId } = useParams()

  const location = useLocation()

  /* YHU ORIGINAL DIVISION TUTORIAL SPA RESTORATION */
  useEffect(() => {
    const supported = [
      'dashboard',
      'academy',
      'plaza',
      'federation',
      'wallet',
    ].includes(workspaceId)

    if (!supported || !document.body) {
      return undefined
    }

    let disposed = false

    const checkCurrent = () => {
      if (!disposed) {
        window.YHDivisionTutorials?.checkCurrent?.()
      }
    }

    const observer = new MutationObserver(checkCurrent)

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        'data-yh-view',
        'data-yh-page',
        'data-yh-unified-division',
        'data-yh-unified-workspace',
      ],
    })

    let script = document.querySelector(
      'script[data-yhu-react-division-tutorial="v1"]'
    )

    if (!window.YHDivisionTutorials && !script) {
      script = document.createElement('script')
      script.src = tutorialScriptUrl
      script.async = true
      script.setAttribute(
        'data-yhu-react-division-tutorial',
        'v1'
      )
      document.head.appendChild(script)
    }

    script?.addEventListener('load', checkCurrent)

    const timer = window.setTimeout(checkCurrent, 120)

    return () => {
      disposed = true
      window.clearTimeout(timer)
      observer.disconnect()
      script?.removeEventListener('load', checkCurrent)
    }
  }, [workspaceId, location.pathname, location.search])
  /* END YHU ORIGINAL DIVISION TUTORIAL SPA RESTORATION */


  const workspace =
    getWorkspace(workspaceId)

  const section =
    workspace?.sections && sectionId
      ? getWorkspaceSection(
          workspaceId,
          sectionId,
        )
      : null

  /* YHU_FEDERATION_SELF_SERVICE_ACCESS_PARITY */
  const accessDivision = workspaceId === 'business-chats'
    ? 'plazas'
    : section && !(workspaceId === 'federation' && sectionId === 'access')
      ? ACCESS_DIVISION[workspaceId] || ''
      : ''

  const [
    accessState,
    setAccessState,
  ] = useState({
    division: accessDivision,
    checking: Boolean(accessDivision),
    approved: !accessDivision,
  })

  const [toast, setToast] =
    useState(null)

  const showToast = useCallback(
    (
      message,
      type = 'success',
    ) => {
      const cleanMessage =
        String(message || '').trim()

      if (!cleanMessage) {
        return
      }

      setToast({
        message: cleanMessage,
        type,
      })
    },
    [],
  )

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeoutId =
      window.setTimeout(
        () => setToast(null),
        3200,
      )

    return () =>
      window.clearTimeout(timeoutId)
  }, [toast])

  const currentAccessState =
    accessState.division === accessDivision
      ? accessState
      : {
          checking: Boolean(accessDivision),
          approved: !accessDivision,
        }

  useEffect(() => {
    let cancelled = false
    if (!accessDivision) return undefined

    const accessTask =
      accessDivision === 'plazas' && workspaceId === 'plaza'
        ? fetchPlazaAccess().then((snapshot) => ({
            approved: isPlazaApproved(snapshot),
            status: normalizeAccessStatus(
              snapshot?.applicationStatus,
            ),
            hasApplication:
              snapshot?.hasApplication === true,
          }))
        : verifyDivisionAccess(accessDivision)

    accessTask
      .then((state) => {
        if (cancelled) {
          return
        }

        setAccessState({
          division: accessDivision,
          checking: false,
          approved:
            state?.approved === true,
          status: state?.status || '',
          hasApplication: state?.hasApplication === true,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setAccessState({
          division: accessDivision,
          checking: false,
          approved: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [accessDivision, workspaceId])

  const handleWorkspaceOpen =
    useCallback(
      (workspaceKey, navigationOptions) => {
        const plazaSection =
          workspaceKey === 'plazas'
            ? 'explorer'
            : typeof workspaceKey === 'string' &&
                workspaceKey.startsWith('plazas-')
              ? workspaceKey.slice('plazas-'.length)
              : ''

        const target =
          plazaSection
            ? getWorkspaceSection('plaza', plazaSection)
              ? getWorkspacePath('plaza', plazaSection)
              : null
            : WORKSPACE_KEY_PATHS[workspaceKey]

        if (!target) {
          showToast(
            'Could not open that workspace.',
            'error',
          )
          return
        }

        navigate(target, navigationOptions)
      },
      [navigate, showToast],
    )

  if (!workspace) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  if (workspace.sections) {
    if (!sectionId) {
      /* YHU_FEDERATION_LEGACY_HASH_PARITY */
      if (workspaceId === 'federation') {
        const params = new URLSearchParams(window.location.search)

        const aliases = {
          command: 'command',
          connect: 'connect',
          'deal-rooms': 'deal-rooms',
          directory: 'directory',
          requests: 'requests',
          referrals: 'referrals',
          status: 'access',
          apply: 'access',
          access: 'access',
        }

        const candidates = [
          params.get('dashboardSection'),
          window.location.hash.slice(1),
          params.get('tab'),
          params.get('screen'),
          params.get('section'),
        ]

        const legacy = candidates.find(value =>
          Object.prototype.hasOwnProperty.call(
            aliases,
            String(value || '').trim().toLowerCase()
          )
        )

        if (legacy) {
          const target = aliases[String(legacy).trim().toLowerCase()]

          for (const key of ['dashboardSection', 'tab', 'screen', 'section']) {
            params.delete(key)
          }

          const rest = params.toString()

          return (
            <Navigate
              to={`/federation/${target}${rest ? '?' + rest : ''}`}
              replace
            />
          )
        }
      }
      /* YHU_PLAZA_LEGACY_URL_PARITY */
      if (workspaceId === 'plaza') {
        const params = new URLSearchParams(window.location.search)
        const key = ['tab', 'screen', 'section']
          .find(name => params.get(name))

        const requested = String(
          key ? params.get(key) : ''
        ).trim().toLowerCase()

        const targets = {
          explorer: 'explorer',
          feed: 'explorer',
          opportunities: 'opportunities',
          directory: 'directory',
          regions: 'regions',
          atlas: 'atlas',
          'plaza-atlas': 'atlas',
          meetups: 'meetups',
          messages: 'conversations',
          conversations: 'conversations',
          inbox: 'inbox',
          requests: 'requests',
          patron: 'patron',
          'patron-desk': 'patron-desk',
          bridge: 'bridge',
          notifications: 'notifications',
        }

        const target = targets[requested]

        if (target) {
          params.delete(key)
          const rest = params.toString()
          return (
            <Navigate
              to={`/plaza/${target}${rest ? '?' + rest : ''}`}
              replace
            />
          )
        }
      }
      if (workspaceId === 'academy') {
        const params = new URLSearchParams(window.location.search)
        const legacy = String(params.get('section') || '')
          .trim().toLowerCase()

        const aliases = {
          home: 'roadmap',
          missions: 'roadmap',
          'lead-missions': 'missions',
          community: 'community',
          messages: 'messages',
          voice: 'voice',
          video: 'video',
          profile: 'profile',
        }

        const target = aliases[legacy]

        if (target) {
          params.delete('section')
          const suffix = params.toString()
          const routePath = '/academy/' + target +
            (suffix ? '?' + suffix : '')

          return <Navigate to={routePath} replace />
        }
      }

      return (
        <Navigate
          to={getDefaultWorkspacePath(
            workspaceId,
          )}
          replace
        />
      )
    }

    if (!section) {
      return (
        <Navigate
          to={getDefaultWorkspacePath(
            workspaceId,
          )}
          replace
        />
      )
    }

    if (currentAccessState.checking) {
      return workspaceId === 'plaza'
        ? <PlazaLoadingBar />
        : workspaceId === 'academy'
          ? <AcademyLoadingScreen text="Checking access…" />
          : <AccessChecking />
    }

    if (!currentAccessState.approved) {
      if (workspaceId === 'federation') {
        return <Navigate to="/federation/access" replace />
      }

      if (workspaceId === 'plaza') {
        return (
          <PlazaAccessGate
            access={currentAccessState}
            onBack={() => navigate('/dashboard')}
          />
        )
      }

      return <Navigate to="/dashboard" replace />
    }

    const workspaceKey =
      SECTION_WORKSPACE_KEYS[
        workspaceId
      ]?.[sectionId]

    if (!workspaceKey) {
      return (
        <Navigate
          to={getDefaultWorkspacePath(
            workspaceId,
          )}
          replace
        />
      )
    }

    if (workspaceId === 'academy') {
      return (
        <AcademyStandaloneShell sectionId={sectionId} navigateTo={navigate}>
          <AcademyWorkspace
            workspaceKey={
              workspaceKey
            }
            onToast={showToast}
            onWorkspaceOpen={
              handleWorkspaceOpen
            }

            onProfileOpen={(memberId) => {
              const id =
                String(
                  memberId || '',
                ).trim()

              if (!id) {
                return
              }

              navigate(
                `/profile?memberId=${encodeURIComponent(
                  id,
                )}`,
              )
            }}
          />

          <RouteToast
            toast={toast}
          />
        </AcademyStandaloneShell>
      )
    }

    if (workspaceId === 'plaza') {
      return (
        <>
          <PlazaStandaloneShell sectionId={sectionId} onNavigate={handleWorkspaceOpen}>
          <PlazaWorkspace
            workspaceKey={
              workspaceKey
            }
            onToast={showToast}
            onWorkspaceOpen={
              handleWorkspaceOpen
            }
          />
          </PlazaStandaloneShell>

          <RouteToast
            toast={toast}
          />
        </>
      )
    }

    if (
      workspaceId ===
      'federation'
    ) {
      return (
        <>
          <FederationStandaloneShell sectionId={sectionId}>
            <FederationWorkspace
              workspaceKey={workspaceKey}
              onToast={showToast}
              onWorkspaceOpen={handleWorkspaceOpen}
            />
          </FederationStandaloneShell>

          <RouteToast toast={toast} />
        </>
      )
    }
  }

  if (workspaceId === 'dashboard' || workspaceId === 'messages') {
    return <DashboardPage />
  }

  if (workspaceId === 'business-chats') {
    if (currentAccessState.checking) {
      return <AccessChecking />
    }

    if (!currentAccessState.approved) {
      return <Navigate to="/dashboard" replace />
    }

    return <DashboardPage />
  }

  /* YHU_PROFILE_DM_ROOM_HANDOFF_PARITY */
  if (workspaceId === 'profile') {
    const targetMemberId =
      new URLSearchParams(
        window.location.search,
      ).get(
        'memberId',
      ) || ''

    return (
      <>
        <ProfileWorkspace
          memberId={
            targetMemberId
          }
          onBack={() => {
            navigate(
              targetMemberId
                ? '/academy/community'
                : '/dashboard',
            )
          }}
          onToast={showToast}
          onOpenMessages={(roomId) =>
            navigate(
              '/dashboard?messagesRoomId=' +
              encodeURIComponent(String(roomId || ''))
            )
          }
        />

        <RouteToast
          toast={toast}
        />
      </>
    )
  }

  if (workspaceId === 'wallet') {
    return (
      <>
        <WalletWorkspace
          onToast={showToast}
          onBack={() => navigate('/dashboard')}
        />

        <RouteToast toast={toast} />
      </>
    )
  }

  if (workspaceId === 'settings') {
    return <DashboardPage />
  }

  return (
    <Navigate
      to="/dashboard"
      replace
    />
  )
}
