import AdminOperationsView from './AdminOperationsView'
import AdminEconomyReportsView from './AdminEconomyReportsView'
import AdminDivisionViews from './AdminDivisionViews'

const adminViews = {
  academy: {
    title: 'Academy',
    component: AdminDivisionViews
  },
  federation: {
    title: 'Federation',
    component: AdminDivisionViews
  },
  plazas: {
    title: 'Plazas',
    component: AdminDivisionViews
  },
  economy: {
    title: 'Economy',
    component: AdminEconomyReportsView
  },
  'business-chat-reports': {
    title: 'Business Chat Reports',
    component: AdminEconomyReportsView
  },
  communications: {
    title: 'Communications',
    component: AdminOperationsView
  },
  support: {
    title: 'Support',
    component: AdminOperationsView
  },
  settings: {
    title: 'Settings',
    component: AdminOperationsView
  }
}

export const ADMIN_REMAINING_VIEWS = Object.keys(adminViews)

export const ADMIN_REMAINING_LABELS = Object.fromEntries(
  Object.entries(adminViews).map(([key, config]) => [
    key,
    config.title
  ])
)

export default function AdminRemainingViews({
  view,
  state,
  globalSearch = '',
  active = false,
  refresh = () => {}
}) {
  const definition = adminViews[view]

  if (!definition) return null

  const ViewComponent = definition.component

  return (
    <section
      id={'view-' + view}
      className={'view view-' + view + (active ? ' active' : '')}
      data-app-active={active ? '' : undefined}
    >
      {active && (
        <ViewComponent
          view={view}
          state={state}
          search={globalSearch}
          refresh={refresh}
        />
      )}
    </section>
  )
}
