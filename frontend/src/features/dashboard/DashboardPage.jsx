import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardHeader from './DashboardHeader'
import './DashboardHeader.css'
import DashboardOverview, { DashboardTopStrip } from './DashboardOverview'
import AcademyApplicationModal from './AcademyApplicationModal'
import PlazaApplicationModal from './PlazaApplicationModal'
import FederationApplicationModal from './FederationApplicationModal'
import { getDashboardWorkspace } from './dashboardWorkspaceMap'
import { getCachedDivisionAccessState, verifyDivisionAccess } from './dashboardAccess'
import WalletWorkspace from '../wallet/WalletWorkspace'
import MessagesWorkspace from '../messages/MessagesWorkspace'
import ReferralWorkspace from '../referral/ReferralWorkspace'
import MyContactsWorkspace from '../contacts/MyContactsWorkspace'
import ResourcesWorkspace from '../resources/ResourcesWorkspace'
import DashboardSettingsHub from './DashboardSettingsHub'
import SettingsWorkspace from '../settings/SettingsWorkspace'
import ProfileWorkspace from '../profile/ProfileWorkspace'
import AcademyWorkspace from '../academy/AcademyWorkspace'
import AcademyShell from '../academy/AcademyShell'
import PlazaWorkspace from '../plaza/PlazaWorkspace'
import FederationWorkspace from '../federation/FederationWorkspace'
import BusinessChatsWorkspace from '../business-chats/BusinessChatsWorkspace'
import DashboardAssistant from './DashboardAssistant'


function WorkspaceSurface({ workspace, onToast, onWorkspaceOpen }) {
  if (
    workspace?.division === 'plazas' &&
    getDashboardWorkspace(workspace?.key)?.division === 'plazas'
  ) {
    return (
      <PlazaWorkspace
        workspaceKey={workspace.key}
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (
    workspace?.division === 'federation' &&
    getDashboardWorkspace(workspace?.key)?.division === 'federation'
  ) {
    return (
      <FederationWorkspace
        workspaceKey={workspace.key}
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspace?.key === 'business-chats') {
    return (
      <BusinessChatsWorkspace
        onToast={onToast}
        initialConversationId={workspace.conversationId || ''}
      />
    )
  }


  return null

}

/* YHU_DASHBOARD_PHASE3_CANONICAL_ROUTING */
/* YHU_DASHBOARD_FINISH_V2 */
const DASHBOARD_RESOURCE_KEYS = new Set([
  'wallet', 'messages', 'referral', 'my-contacts',
  'resources', 'profile', 'business-chats',
])

function dashboardResourceState(key, params = new URLSearchParams()) {
  return {
    key,
    division: 'resources',
    url: '',
    ...(key === 'profile'
      ? { memberId: params.get('memberId') || '', messagesReturnRoomId: params.get('messagesReturnRoomId') || '' }
      : {}),
    ...(key === 'messages'
      ? { roomId: params.get('messagesRoomId') || '' }
      : {}),
    ...(key === 'business-chats'
      ? { conversationId: params.get('conversationId') || '' }
      : {}),
  }
}

function SettingsPanelShell({
  activeKey,
  onNavigate,
  onLogout,
  children
}) {
  const isTool = [
    'settings',
    'wallet',
    'referral',
    'my-contacts',
    'resources'
  ].includes(activeKey)

  return isTool
    ? (
      <DashboardSettingsHub
        activeKey={activeKey}
        onNavigate={onNavigate}
        onLogout={onLogout}
      >
        {children}
      </DashboardSettingsHub>
    )
    : children
}

/* YHU_SETTINGS_UNIFIED_20261028 */
export default function DashboardPage() {
  const location = useLocation()
  const navigate = useNavigate()

  /* Original Dashboard: refresh pending approvals every 10 seconds. */
  useEffect(() => {
    if (location.pathname !== '/dashboard') return undefined

    let disposed = false
    let inFlight = false
    const divisions = ['academy', 'plazas', 'federation']

    const refreshPending = async () => {
      if (disposed || inFlight || document.hidden) return

      const pending = divisions.filter(division =>
        getCachedDivisionAccessState(division).pending === true
      )

      if (!pending.length) return

      inFlight = true

      try {
        const before = Object.fromEntries(
          pending.map(division => [
            division,
            getCachedDivisionAccessState(division),
          ])
        )

        const results = await Promise.allSettled(
          pending.map(division => verifyDivisionAccess(division))
        )

        if (disposed) return

        const changed = results.some((result, index) => {
          if (result.status !== 'fulfilled') return false

          const previous = before[pending[index]]
          const current = result.value

          return previous.approved !== current.approved ||
            previous.pending !== current.pending ||
            previous.rejected !== current.rejected ||
            previous.status !== current.status
        })

        if (changed) {
          window.dispatchEvent(
            new Event('yh:dashboard-access-refreshed')
          )
        }
      } finally {
        inFlight = false
      }
    }

    const onVisible = () => {
      if (!document.hidden) void refreshPending()
    }

    const interval = window.setInterval(refreshPending, 10000)

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    void refreshPending()

    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [location.pathname])

  /* YHU_PROFILE_DM_ROOM_HANDOFF_PARITY */

  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    if (window.location.pathname === '/messages') {
      return dashboardResourceState(
        'messages',
        new URLSearchParams(window.location.search)
      )
    }

    if (window.location.pathname === '/business-chats') {
      return dashboardResourceState(
        'business-chats',
        new URLSearchParams(window.location.search)
      )
    }

    if (window.location.pathname === '/settings') {
      return dashboardResourceState('settings')
    }

    const params = new URLSearchParams(window.location.search)
    const roomId = params.get('messagesRoomId')?.trim() || ''

    if (roomId) {
      return dashboardResourceState('messages', params)
    }

    const key = params.get('workspace') || ''

    if (
      DASHBOARD_RESOURCE_KEYS.has(key) &&
      key !== 'business-chats'
    ) {
      return dashboardResourceState(key, params)
    }

    return null
  })

  useEffect(() => {
    let cancelled = false

    if (location.pathname === '/messages') {
      setActiveWorkspace(
        dashboardResourceState(
          'messages',
          new URLSearchParams(location.search)
        )
      )
      return undefined
    }

    if (location.pathname === '/business-chats') {
      setActiveWorkspace(
        dashboardResourceState(
          'business-chats',
          new URLSearchParams(location.search)
        )
      )
      return undefined
    }

    if (location.pathname === '/settings') {
      setActiveWorkspace(current =>
        current?.key === 'settings'
          ? current
          : dashboardResourceState('settings')
      )
      return undefined
    }

    if (location.pathname !== '/dashboard') {
      return undefined
    }

    const params = new URLSearchParams(location.search)
    const roomId = params.get('messagesRoomId')?.trim() || ''

    if (roomId) {
      setActiveWorkspace(dashboardResourceState('messages', params))
      return undefined
    }

    const key = params.get('workspace') || ''

    if (key === 'settings') {
      navigate('/settings', { replace: true })
      return undefined
    }

    if (
      DASHBOARD_RESOURCE_KEYS.has(key) &&
      key !== 'business-chats'
    ) {
      setActiveWorkspace(dashboardResourceState(key, params))
      return undefined
    }

    const destination = getDashboardWorkspace(key)

    const accessDivision = key === 'business-chats'
      ? 'plazas'
      : ['academy', 'plazas', 'federation'].includes(
          destination?.division
        )
          ? destination.division
          : ''

    if (accessDivision) {
      setActiveWorkspace(null)

      verifyDivisionAccess(accessDivision)
        .then(state => {
          if (cancelled) return

          if (state?.approved !== true) {
            navigate('/dashboard', { replace: true })
            return
          }

          setActiveWorkspace(
            key === 'business-chats'
              ? dashboardResourceState(key, params)
              : {
                  key,
                  ...destination,
                  ...(key === 'academy-profile'
                    ? { memberId: params.get('memberId') || '' }
                    : {}),
                }
          )
        })
        .catch(() => {
          if (!cancelled) {
            navigate('/dashboard', { replace: true })
          }
        })

      return () => {
        cancelled = true
      }
    }

    if (params.get('wallet') === '1') {
      setActiveWorkspace(dashboardResourceState('wallet'))
    } else if (params.get('businessChats') === '1') {
      /* Preserve original guarded legacy handoff. */
    } else if (
      params.get('profile') === 'edit' ||
      params.get('open') === 'profile-editor'
    ) {
      setActiveWorkspace(dashboardResourceState('profile'))
    } else {
      setActiveWorkspace(null)
    }

    return undefined
  }, [location.pathname, location.search, navigate])

  const [
    academyApplicationOpen,
    setAcademyApplicationOpen,
  ] = useState(false)

  const [
    plazaApplicationOpen,
    setPlazaApplicationOpen,
  ] = useState(false)

  const [
    federationApplicationOpen,
    setFederationApplicationOpen,
  ] = useState(false)

  const [toast, setToast] =
    useState(null)

  const [
    sidebarRevision,
    setSidebarRevision,
  ] = useState(0)

  /* YHU_WALLET_DEEPLINK_PARITY */
  useEffect(() => {
    let openFromQuery = false
    let openFromSession = false

    try {
      openFromQuery =
        new URLSearchParams(window.location.search)
          .get('wallet') === '1'
    } catch {}

    try {
      openFromSession =
        sessionStorage.getItem(
          'yh_open_wallet_on_dashboard_v1'
        ) === '1'

      sessionStorage.removeItem(
        'yh_open_wallet_on_dashboard_v1'
      )
    } catch {}

    if (!openFromQuery && !openFromSession) return

    setActiveWorkspace(current => {
      if (
        current?.key === 'messages' &&
        current?.roomId
      ) {
        return current
      }

      return {
        key: 'wallet',
        division: 'resources',
        url: '',
      }
    })
  }, [])

  /* YHU_BUSINESS_CHATS_LEGACY_HANDOFF */
  useEffect(() => {
    let shouldOpen = false

    try {
      const params = new URLSearchParams(window.location.search)
      shouldOpen = params.get('businessChats') === '1'
    } catch {}

    try {
      const fromSession =
        sessionStorage.getItem(
          'yh_open_business_chats_on_dashboard_v1'
        ) === '1'

      sessionStorage.removeItem(
        'yh_open_business_chats_on_dashboard_v1'
      )

      shouldOpen = shouldOpen || fromSession
    } catch {}

    if (!shouldOpen) return undefined

    let cancelled = false

    verifyDivisionAccess('plazas')
      .then(state => {
        if (cancelled || state?.approved !== true) return

        setActiveWorkspace(current =>
          current || {
            key: 'business-chats',
            division: 'resources',
            url: '',
          }
        )
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  /* YHU_ORIGINAL_PROFILE_EDITOR_DEEPLINK_PARITY */
  useEffect(() => {
    let requested = false

    try {
      const params = new URLSearchParams(window.location.search)

      requested =
        params.get('profile') === 'edit' ||
        params.get('open') === 'profile-editor' ||
        sessionStorage.getItem(
          'yh_open_dashboard_profile_editor_v1'
        ) === '1'
    } catch {}

    if (!requested) return

    setActiveWorkspace(current => {
      if (current) return current

      return {
        key: 'profile',
        division: 'resources',
        url: '',
        memberId: '',
      }
    })
  }, [])

  useEffect(() => {
    const body =
      document.body

    body.setAttribute(
      'data-yh-view',
      activeWorkspace?.division === 'academy' ? 'academy' : 'hub',
    )

    body.setAttribute(
      'data-yh-page',
      activeWorkspace?.division === 'academy' ? 'academy' : 'dashboard',
    )

    body.classList.toggle('academy-shell-ready', activeWorkspace?.division === 'academy')

    body.setAttribute(
      'data-yh-unified-workspace',
      activeWorkspace?.key ||
        'overview',
    )

    body.setAttribute(
      'data-yh-unified-division',
      activeWorkspace?.division ||
        'overview',
    )

    return () => {
      body.classList.remove('academy-shell-ready')
      body.removeAttribute(
        'data-yh-view',
      )

      body.removeAttribute(
        'data-yh-page',
      )

      body.removeAttribute(
        'data-yh-unified-workspace',
      )

      body.removeAttribute(
        'data-yh-unified-division',
      )
    }
  }, [activeWorkspace])

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeoutId =
      window.setTimeout(() => {
        setToast(null)
      }, 3600)

    return () => {
      window.clearTimeout(
        timeoutId,
      )
    }
  }, [toast])

  const showToast = useCallback((
    message,
    type = 'info',
  ) => {
    const cleanMessage =
      String(
        message || '',
      ).trim()

    if (!cleanMessage) return

    setToast({
      message:
        cleanMessage,

      type,
    })
  }, [])

  const closeApplications = () => {
    setAcademyApplicationOpen(
      false,
    )

    setPlazaApplicationOpen(
      false,
    )

    setFederationApplicationOpen(
      false,
    )
  }

  const handleWorkspaceOpen = (workspace) => {
    closeApplications()

    if (
      workspace?.key &&
      getDashboardWorkspace(workspace.key)
    ) {
      navigate(
        '/dashboard?workspace=' +
        encodeURIComponent(workspace.key)
      )
      return
    }

    setActiveWorkspace(workspace)
  }

  /* YHU_ACADEMY_ORIGINAL_ENTRY_PARITY */
  const resolveAcademyEntryWorkspaceKey = () => {
    try {
      const raw = localStorage.getItem(
        'yh_academy_membership_status_v1'
      )
      const membership = raw ? JSON.parse(raw) : null
      const hasRoadmapAccess = membership?.hasRoadmapAccess === true
      const fallback = hasRoadmapAccess
        ? 'academy-roadmap'
        : 'academy-community'

      const last = JSON.parse(
        sessionStorage.getItem(
          'yh_academy_last_non_profile_view_v2'
        ) || '{}'
      ) || {}

      const saved = {
        roadmap: 'academy-roadmap',
        community: 'academy-community',
        messages: 'academy-messages',
        'lead-missions': 'academy-missions',
        missions: 'academy-missions',
        voice: 'academy-voice',
        video: 'academy-video',
      }[String(last.sourceView || '').trim().toLowerCase()]

      if (saved === 'academy-messages' && last.activeRoomId) {
        sessionStorage.setItem(
          'yh_academy_open_message_room_id',
          String(last.activeRoomId),
        )
      }

      return saved === 'academy-roadmap' && !hasRoadmapAccess
        ? 'academy-community'
        : saved || fallback
    } catch {
      return 'academy-community'
    }
  }

  const handleDivisionAccess = (
    division,
    state,
  ) => {
    closeApplications()

    /*
     * ACADEMY
     */
    if (
      division === 'academy'
    ) {
      if (state?.approved) {
        handleWorkspaceOpen({
          key: resolveAcademyEntryWorkspaceKey(),
          division: 'academy',
        })

        return
      }

      if (state?.pending) {
        showToast(
          'Your Academy application is still under review.',
          'error',
        )

        return
      }

      if (state?.rejected) {
        showToast(
          'Your Academy application has already been reviewed. Contact admin for the next step.',
          'error',
        )

        return
      }

      if (
        state?.hasApplication
      ) {
        showToast(
          'You already filled the Academy application. Please wait for admin review.',
          'error',
        )

        return
      }

      setAcademyApplicationOpen(
        true,
      )

      return
    }

    /*
     * PLAZAS
     */
    if (
      division === 'plazas'
    ) {
      if (state?.approved) {
        handleWorkspaceOpen({
          key: 'plazas',
          division: 'plazas',
        })

        return
      }

      if (state?.pending) {
        showToast(
          'Your Plazas application is still under review.',
          'error',
        )

        return
      }

      if (
        !state?.hasApplication ||
        state?.rejected
      ) {
        setPlazaApplicationOpen(
          true,
        )

        return
      }

      showToast(
        'Your Plazas application is pending approval. Admin approval is required before full access.',
        'error',
      )

      return
    }

    /*
     * FEDERATION
     */
    if (
      division === 'federation'
    ) {
      if (state?.approved) {
        handleWorkspaceOpen({
          key: 'federation',
          division:
            'federation',
        })

        return
      }

      if (state?.pending) {
        showToast(
          'Your Federation application is still under review.',
          'error',
        )

        return
      }

      if (
        !state?.hasApplication ||
        state?.rejected
      ) {
        setFederationApplicationOpen(
          true,
        )

        return
      }

      showToast(
        'Your Federation application is pending approval. Admin approval is required before full access.',
        'error',
      )
    }
  }

  /* The original mobile Dashboard has the same access gates as the sidebar. */
  const handleMobileNavigate = async (workspaceKey) => {
    if (workspaceKey === 'overview') {
      handleDashboardOpen()
      return
    }

    const resolvedWorkspaceKey = workspaceKey === 'academy'
      ? resolveAcademyEntryWorkspaceKey()
      : workspaceKey
    const destination = getDashboardWorkspace(resolvedWorkspaceKey)
    const division = destination?.division
    if (!['academy', 'plazas', 'federation'].includes(division)) {
      showToast('This section is unavailable.', 'error')
      return
    }

    try {
      const state = await verifyDivisionAccess(division)
      if (!state?.approved) {
        handleDivisionAccess(division, state)
        return
      }
      handleWorkspaceOpen({ key: resolvedWorkspaceKey, ...destination })
    } catch {
      showToast('Unable to verify division access. Please try again.', 'error')
    }
  }

  const handleMobileUtilityOpen = async (workspaceKey) => {
    if (workspaceKey === 'logout') {
      handleLogout()
      return
    }
    if (workspaceKey === 'business-chats') {
      try {
        const state = await verifyDivisionAccess('plazas')
        if (!state?.approved) {
          showToast('Business Chats unlock after Plazas approval.', 'error')
          return
        }
      } catch {
        showToast('Unable to verify Plazas access.', 'error')
        return
      }
    }
    handleUtilityOpen(workspaceKey)
  }

  const handleAccessBlocked = (
    payload,
  ) => {
    handleDivisionAccess(
      payload?.division,
      payload?.state,
    )
  }

  const handleDashboardOpen = () => {
    closeApplications()
    setActiveWorkspace(null)

    if (
      location.pathname !== '/dashboard' ||
      location.search
    ) {
      navigate('/dashboard')
    }
  }

  const handleUtilityOpen = (workspaceKey, navigationOptions) => {
    closeApplications()

    if (workspaceKey === 'messages') {
      navigate('/messages', navigationOptions)
      return
    }

    if (workspaceKey === 'business-chats') {
      navigate('/business-chats', navigationOptions)
      return
    }

    if (workspaceKey === 'settings') {
      navigate('/settings', navigationOptions)
      return
    }

    if (
      DASHBOARD_RESOURCE_KEYS.has(workspaceKey) ||
      getDashboardWorkspace(workspaceKey)
    ) {
      navigate(
        '/dashboard?workspace=' +
        encodeURIComponent(workspaceKey),
        navigationOptions
      )
      return
    }

    const label = String(workspaceKey || '').replace(/-/g, ' ')

    showToast(
      'Could not open ' + (label || 'workspace') + '.',
      'error'
    )
  }

  const openVerifiedNotificationWorkspace = async (
    division,
    workspaceKey,
  ) => {
    const state =
      await verifyDivisionAccess(
        division,
      ).catch(() => null)

    if (!state?.approved) {
      showToast(
        `This notification requires approved ${division === 'plazas' ? 'Plazas' : division === 'federation' ? 'Federation' : 'Academy'} access.`,
        'error',
      )

      return
    }

    const workspace =
      getDashboardWorkspace(
        workspaceKey,
      )

    if (!workspace) {
      return
    }


    handleWorkspaceOpen({
      key: workspaceKey,
      ...workspace,
    })
  }

  const handleNotificationTarget = async (
    target = '',
    targetId = '',
  ) => {
    const normalized =
      String(target || '')
        .trim()
        .toLowerCase()

    if (
      normalized === 'wallet' ||
      normalized === 'economy' ||
      normalized === 'payout'
    ) {
      handleUtilityOpen(
        'wallet',
      )
      return
    }

    /* YHU_NOTIFICATION_MESSAGE_HANDOFF_PATCH08 */
    if (
      normalized === 'dm' ||
      normalized === 'messages'
    ) {
      const roomId = String(targetId || '').trim()

      if (roomId) {
        closeApplications()

        navigate(
          '/dashboard?messagesRoomId=' +
          encodeURIComponent(roomId)
        )
      } else {
        handleUtilityOpen('messages')
      }

      return
    }

    if (
      normalized === 'profile'
    ) {
      handleProfileOpen(
        targetId,
      )
      return
    }

    if (
      [
        'business-chats',
        'business_chats',
        'business-chat',
        'business_chat',
        'plaza-business-chat',
        'plaza_business_chat',
      ].includes(
        normalized,
      )
    ) {
      const state =
        await verifyDivisionAccess(
          'plazas',
        ).catch(() => null)

      if (
        !state?.approved
      ) {
        showToast(
          'Business Chats unlock after Plazas approval.',
          'error',
        )

        return
      }

      const conversationId = String(targetId || '').trim()

      navigate(
        '/dashboard?workspace=business-chats' +
        (conversationId
          ? '&conversationId=' + encodeURIComponent(conversationId)
          : '')
      )

      return
    }

    if (
      normalized ===
        'squad-mission-history' ||
      normalized ===
        'squad-mission'
    ) {
      await openVerifiedNotificationWorkspace(
        'academy',
        'academy-missions',
      )

      return
    }

    if (normalized === 'announcements') {
      await openVerifiedNotificationWorkspace(
        'academy',
        'academy-announcements',
      )
      return
    }

    if (
      normalized === 'main-chat' ||
      normalized === 'chat'
    ) {
      await openVerifiedNotificationWorkspace(
        'academy',
        'academy-community',
      )
      return
    }

    if (
      normalized === 'academy'
    ) {
      await openVerifiedNotificationWorkspace(
        'academy',
        'academy',
      )

      return
    }

    if (
      [
        'plaza',
        'plaza-status',
        'plaza_status',
        'plaza-application',
        'plaza_application',
      ].includes(
        normalized,
      )
    ) {
      const state = await verifyDivisionAccess(
        'plazas',
      ).catch(() => null)

      if (!state) {
        showToast(
          'Unable to verify plazas access.',
          'error',
        )
        return
      }

      handleDivisionAccess('plazas', state)

      return
    }

    /* YHU_FEDERATION_REQUEST_NOTIFICATION_PARITY */
    if (
      [
        'federation-requests',
        'federation_requests',
        'federation-request',
        'federation_request',
      ].includes(normalized)
    ) {
      await openVerifiedNotificationWorkspace(
        'federation',
        'federation-requests',
      )

      return
    }

    if (
      [
        'federation',
        'federation-status',
        'federation_status',
        'federation-application',
        'federation_application',
      ].includes(
        normalized,
      )
    ) {
      const state = await verifyDivisionAccess(
        'federation',
      ).catch(() => null)

      if (!state) {
        showToast(
          'Unable to verify federation access.',
          'error',
        )
        return
      }

      handleDivisionAccess('federation', state)

      return
    }

    showToast(
      'Notification opened.',
      'info',
    )
  }

  /* YHU_ACADEMY_NATIVE_PROFILE_ROUTE_PARITY */
  /* YHU_ACADEMY_PROFILE_FULL_RETURN_PARITY */
  const handleProfileOpen = (memberId = '', messagesRoomId = '') => {
    closeApplications()
    const requestedMemberId = String(memberId || '').trim()

    if (requestedMemberId && activeWorkspace?.division === 'academy') {
      const allowed = [
        'academy-roadmap',
        'academy-missions',
        'academy-community',
        'academy-messages',
        'academy-voice',
        'academy-video',
        'academy-announcements',
      ]

      const origin = activeWorkspace.key === 'academy'
        ? 'academy-roadmap'
        : activeWorkspace.key

      const returnKey = allowed.includes(origin)
        ? origin
        : 'academy-community'

      try {
        sessionStorage.setItem(
          'yh_react_academy_profile_return_v1',
          returnKey,
        )
      } catch {}

      setActiveWorkspace({
        key: 'academy-profile',
        division: 'academy',
        url: '',
        memberId: requestedMemberId,
      })
      return
    }

    navigate(
      '/dashboard?workspace=profile' +
      (requestedMemberId
        ? '&memberId=' + encodeURIComponent(requestedMemberId)
        : '') +
      (messagesRoomId ? '&messagesReturnRoomId=' + encodeURIComponent(messagesRoomId) : '')
    )
  }

  const handleProfileMessageOpen = (roomId = '') => {
    const id = String(roomId || '').trim()

    navigate(
      id
        ? '/dashboard?messagesRoomId=' + encodeURIComponent(id)
        : '/dashboard?workspace=messages'
    )
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
    } catch {
      // Preserve ORIGINAL logout fallback.
    }

    const keys = [
      'yh_user_loggedIn',
      'yh_user_name',
      'yh_user_username',
      'yh_user_email',
      'yh_user_avatar',
      'yh_academy_access',
      'yh_academy_home',
      'yh_token',
      'token',
      'authToken',
      'access_token',
      'yh_academy_membership_status_v1',
      'yh_academy_application_profile',
      'yh_academy_roadmap_profile_v1',
      'yh_academy_roadmap_locked_v1',
      'yh_academy_last_non_profile_view_v2',
      'yh_react_academy_profile_return_v1',
      'yh_academy_open_message_room_id',
      'yh_admin_panel_state_v2',
      'yh_admin_panel_state_v3_live'
    ]

    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) {
        try {
          storage.removeItem(key)
        } catch {}
      }
    }

    try {
      sessionStorage.removeItem(
        'yh_force_academy_application_after_auth'
      )
    } catch {}

    window.location.replace('/')
  }

  const refreshSidebarAccess = () => {
    setSidebarRevision(
      (current) =>
        current + 1,
    )
  }

  /* YHU_ACADEMY_PROFILE_FULL_RETURN_PARITY: original saved Academy view */
  useEffect(() => {
    if (
      activeWorkspace?.division !== 'academy' ||
      activeWorkspace?.key === 'academy-profile'
    ) return

    const names = {
      academy: 'roadmap',
      'academy-roadmap': 'roadmap',
      'academy-missions': 'lead-missions',
      'academy-community': 'community',
      'academy-messages': 'messages',
      'academy-voice': 'voice',
      'academy-video': 'video',
    }

    const sourceView = names[activeWorkspace.key]
    if (!sourceView) return

    try {
      const existing = JSON.parse(
        sessionStorage.getItem(
          'yh_academy_last_non_profile_view_v2'
        ) || '{}'
      ) || {}

      sessionStorage.setItem(
        'yh_academy_last_non_profile_view_v2',
        JSON.stringify({
          sourceView,
          activeRoomId:
            sourceView === 'messages' &&
            existing.sourceView === 'messages'
              ? String(existing.activeRoomId || '')
              : '',
          updatedAt: new Date().toISOString(),
        }),
      )
    } catch {}
  }, [activeWorkspace])

  /* YHU_ACADEMY_UI_SHELL_PARITY_20261025 — one workspace owner */
  const isAcademy = activeWorkspace?.division === 'academy'
  /* YHU_ACADEMY_A23_MAIN_VIEW_ID_PARITY
     Restore the original Academy main view selectors.
     The existing React components remain the only render owners.
     Profile already owns academy-profile-view internally.
     Center Stage already owns center-stage-view internally.
  */
  /* YHU_ACADEMY_A24_ORIGINAL_VIEW_SELECTOR_PARITY
     Exact view identifiers from original Academy HTML.
     React workspace remains the sole content owner.
  */
  const academyMainId = !isAcademy
    ? undefined
    : ({
        academy: 'academy-chat',
        'academy-roadmap': 'academy-chat',
        'academy-missions': 'academy-lead-missions-view',
        'academy-community': 'academy-feed-view',
        'academy-messages': 'academy-chat',
        'academy-voice': 'voice-lobby-view',
        'academy-video': 'video-lobby-view',
        'academy-announcements': 'announcements-view',
      })[activeWorkspace?.key]

  const academyChatMode = !isAcademy
    ? undefined
    : ['academy', 'academy-roadmap'].includes(activeWorkspace?.key)
      ? 'home'
      : activeWorkspace?.key === 'academy-messages'
        ? 'messages'
        : undefined

  const workspaceMain = (
    <main
      id={academyMainId}
      data-chat-mode={academyChatMode}
      data-yhu-communication-workspace={
        ['messages', 'business-chats'].includes(activeWorkspace?.key)
          ? activeWorkspace.key
          : undefined
      }
      className={isAcademy
        ? 'yh-main-chat hide-scrollbar fade-in yh-academy-react-main' +
          (['academy-voice', 'academy-video'].includes(activeWorkspace?.key)
            ? ' lounge-main'
            : activeWorkspace?.key === 'academy-announcements'
              ? ' announcements-main'
              : '')
        : "yh-dashboard-react-main"}
    >
            <SettingsPanelShell
              activeKey={activeWorkspace?.key}
              onNavigate={handleMobileUtilityOpen}
              onLogout={handleLogout}
            >
            {activeWorkspace ? (
              activeWorkspace.key === 'wallet' ? (
                <WalletWorkspace
                  onToast={showToast}
                  onBack={handleDashboardOpen}
                />
              ) : activeWorkspace.key === 'messages' ? (
                <MessagesWorkspace
                  initialRoomId={activeWorkspace.roomId || ''}
                  onToast={showToast}
                  onProfileOpen={(room) =>
                    handleProfileOpen(
                      room?.recipientId || '',
                      room?.id || '',
                    )
                  }
                />
              ) : activeWorkspace.key === 'referral' ? (
                <ReferralWorkspace
                  onToast={showToast}
                />
              ) : activeWorkspace.key === 'my-contacts' ? (
                <MyContactsWorkspace
                  onToast={showToast}
                />
              ) : activeWorkspace.key === 'resources' ? (
                <ResourcesWorkspace />
              ) : activeWorkspace.key === 'settings' ? (
    <SettingsWorkspace
      onToast={showToast}
      onLogout={handleLogout}
    />
              ) : activeWorkspace.key === 'profile' ? (
                <ProfileWorkspace
                  memberId={
                    activeWorkspace.memberId || ''
                  }
                  onToast={showToast}
                  backLabel={activeWorkspace.messagesReturnRoomId ? 'Back to Messages' : 'Back'}
                  onBack={() => {
                    if (activeWorkspace.messagesReturnRoomId) {
                      navigate('/messages?messagesRoomId=' + encodeURIComponent(activeWorkspace.messagesReturnRoomId))
                    } else handleDashboardOpen()
                  }}
                  onOpenMessages={(roomId) => {
                    /* YHU_PROFILE_DM_HANDOFF_PATCH09 */
                    handleProfileMessageOpen(roomId)
                  }}
                />
              ) : activeWorkspace?.division === 'academy' ? (
                <AcademyWorkspace
                  workspaceKey={
                    activeWorkspace.key
                  }
                  profileMemberId={activeWorkspace.memberId || ''}
                  onToast={showToast}

                    onProfileOpen={handleProfileOpen}
                  onWorkspaceOpen={handleUtilityOpen}
                  />
              ) : (
                <WorkspaceSurface
                  onToast={showToast}
                  onWorkspaceOpen={handleUtilityOpen}
                  workspace={
                    activeWorkspace
                  }
                />
              )
            ) : (
              <DashboardOverview
                onDivisionOpen={
                  handleDivisionAccess
                }
                onToast={showToast}
              />
            )}
            </SettingsPanelShell>
          </main>
  )

  return (
    <>

    <div className={isAcademy
      ? "dashboard-layout fade-in yh-academy-react-shell yhu-academy-p1"
      : "yhu-dashboard-header-layout fade-in"}>
      {/* ACADEMY_GLOBAL_NAV_REUSE_20261030 */}
      {!isAcademy && (
          <header className="yhu-dashboard-global-header">
            <DashboardHeader
              key={sidebarRevision}
              onWorkspaceOpen={handleWorkspaceOpen}
              onAccessBlocked={handleAccessBlocked}
              onDashboardOpen={handleDashboardOpen}
              onUtilityOpen={handleMobileUtilityOpen}
              onLogout={handleLogout}
            />

            <DashboardTopStrip
              onProfileOpen={handleProfileOpen}
              onNotificationTarget={handleNotificationTarget}
              onToast={showToast}
            />
          </header>
        )}
      {isAcademy ? (
        <AcademyShell
          activeKey={activeWorkspace.key}
          onNavigate={handleUtilityOpen}
          onBack={handleDashboardOpen}
          onProfileOpen={handleProfileOpen}
          onToast={showToast}
        >
          {workspaceMain}
        </AcademyShell>
      ) : (
        <>

          {workspaceMain}
          <DashboardAssistant
                  onToast={showToast}
                />
        </>
      )}

      <AcademyApplicationModal
        open={
          academyApplicationOpen
        }
        onClose={() =>
          setAcademyApplicationOpen(
            false,
          )
        }
        onSubmitted={
          refreshSidebarAccess
        }
        onToast={
          showToast
        }
      />

      <PlazaApplicationModal
        open={
          plazaApplicationOpen
        }
        onClose={() =>
          setPlazaApplicationOpen(
            false,
          )
        }
        onSubmitted={
          refreshSidebarAccess
        }
        onToast={
          showToast
        }
      />

      <FederationApplicationModal
        open={
          federationApplicationOpen
        }
        onClose={() =>
          setFederationApplicationOpen(
            false,
          )
        }
        onSubmitted={
          refreshSidebarAccess
        }
        onToast={
          showToast
        }
      />

      {toast && (
        <div
          id="toast-notification"
          className={`toast-notification show ${
            toast.type || ''
          }`}
          role="status"
          aria-live="polite"
          data-yh-toast
        >
          {toast.message}
        </div>
      )}
    </div>
    </>
  )
}
