import { lazy, Suspense } from 'react'
const PlazaExplorerWorkspace = lazy(() => import('./PlazaExplorerWorkspace'))
const PlazaFeedWorkspace = lazy(() => import('./PlazaFeedWorkspace'))
const PlazaOpportunitiesWorkspace = lazy(() => import('./PlazaOpportunitiesWorkspace'))
const PlazaDirectoryWorkspace = lazy(() => import('./PlazaDirectoryWorkspace'))
const PlazaRegionsWorkspace = lazy(() => import('./PlazaRegionsWorkspace'))
const PlazaPatronWorkspace = lazy(() => import('./PlazaPatronWorkspace'))
const PlazaPatronDeskWorkspace = lazy(() => import('./PlazaPatronDeskWorkspace'))
const PlazaMeetupsWorkspace = lazy(() => import('./PlazaMeetupsWorkspace'))
const PlazaConversationsWorkspace = lazy(() => import('./PlazaConversationsWorkspace'))
const PlazaInboxWorkspace = lazy(() => import('./PlazaInboxWorkspace'))
const PlazaNotificationsWorkspace = lazy(() => import('./PlazaNotificationsWorkspace'))
const PlazaBridgeWorkspace = lazy(() => import('./PlazaBridgeWorkspace'))
const PlazaRequestsWorkspace = lazy(() => import('./PlazaRequestsWorkspace'))

function PlazaWorkspaceView({
  workspaceKey = 'plazas-explorer',
  onToast,
  onWorkspaceOpen,
}) {
  if (
    workspaceKey === 'plazas' ||
    workspaceKey === 'plazas-explorer'
  ) {
    return (
      <PlazaExplorerWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-feed') {
    return (
      <PlazaFeedWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-opportunities') {
    return (
      <PlazaOpportunitiesWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-directory') {
    return (
      <PlazaDirectoryWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (
    workspaceKey === 'plazas-regions' ||
    workspaceKey === 'plazas-atlas'
  ) {
    return (
      <PlazaRegionsWorkspace
        workspaceKey={workspaceKey}
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-patron') {
    return <PlazaPatronWorkspace onToast={onToast} />
  }

  if (workspaceKey === 'plazas-patron-desk') {
    return (
      <PlazaPatronDeskWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-meetups') {
    return <PlazaMeetupsWorkspace onToast={onToast} />
  }

  if (workspaceKey === 'plazas-conversations') {
    return (
      <PlazaConversationsWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-notifications') {
    return (
      <PlazaNotificationsWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-inbox') {
    return (
      <PlazaInboxWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-bridge') {
    return (
      <PlazaBridgeWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (workspaceKey === 'plazas-requests') {
    return <PlazaRequestsWorkspace onToast={onToast} onWorkspaceOpen={onWorkspaceOpen} />
  }

  return null
}


/* YHU_PLAZA_PHASE2_REACT_LAZY_WORKSPACES */

const PLAZA_WORKSPACE_LOADING_MESSAGES = Object.freeze({
  plazas: 'Loading Plaza Home...',
  'plazas-explorer': 'Loading Plaza Home...',
  'plazas-feed': 'Loading Feed...',
  'plazas-opportunities': 'Loading Opportunities...',
  'plazas-directory': 'Loading Directory...',
  'plazas-regions': 'Loading Regions...',
  'plazas-atlas': 'Loading Plaza Atlas...',
  'plazas-patron': 'Loading Patron Application...',
  'plazas-patron-desk': 'Loading Patron Desk...',
  'plazas-meetups': 'Loading Meetups...',
  'plazas-conversations': 'Loading Messages...',
  'plazas-inbox': 'Loading Inbox...',
  'plazas-notifications': 'Loading Notifications...',
  'plazas-bridge': 'Loading Bridge...',
  'plazas-requests': 'Loading Requests...',
})

export default function PlazaWorkspace(props) {
  const workspaceKey = props.workspaceKey || 'plazas-explorer'

  return (
    <Suspense
      fallback={
        <div className="yh-plaza-react-state" role="status">
          {PLAZA_WORKSPACE_LOADING_MESSAGES[workspaceKey] || 'Loading Plazas...'}
        </div>
      }
    >
      <PlazaWorkspaceView {...props} />
    </Suspense>
  )
}

/* END YHU_PLAZA_PHASE2_REACT_LAZY_WORKSPACES */
