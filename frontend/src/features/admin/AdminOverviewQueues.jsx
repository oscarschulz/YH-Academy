import { Badge, Gate } from './AdminApplicationsView'

const list = value => Array.isArray(value) ? value : []

function scoreFor(record) {
  return Number(
    record.federationScore ??
    record.federationProfileMap?.score ??
    record.federationProfileMap?.federationScore ??
    record.aiScore ??
    0
  ) || 0
}

export function AdminPriorityActions({
  state,
  onNavigate
}) {
  const applications = list(state.applications)
  const academy = list(state.academy)
  const plazas = list(state.plazas)
  const support = list(state.support)
  const requests = list(state.federationConnectionRequests)
  const payments = list(state.paymentLedger)
  const payouts = list(state.payoutLedger)

  const pendingApplications = applications.filter(item =>
    ['New', 'Under Review', 'Needs More Info'].includes(item.status)
  ).length

  const pendingRequests = requests.filter(item => {
    const status = String(item.status || '').toLowerCase()
    const paymentStatus = String(
      item.paymentStatus || ''
    ).toLowerCase()

    return (
      [
        'pending_admin_match',
        'pending_review',
        'matched',
        'pricing_sent'
      ].includes(status) ||
      [
        'not_started',
        'pending',
        'checkout_started'
      ].includes(paymentStatus)
    )
  }).length

  const pendingPayments = payments.filter(item =>
    ['draft', 'checkout_started', 'pending'].includes(
      String(item.status || '').toLowerCase()
    )
  ).length

  const pendingPayouts = payouts.filter(item =>
    ['pending_review', 'approved', 'processing'].includes(
      String(item.status || '').toLowerCase()
    )
  ).length

  const academyInterventions = academy.filter(
    item => item.status !== 'On Track'
  ).length

  const flaggedListings = plazas.filter(
    item => item.status === 'Flagged'
  ).length

  const openSupportTickets = support.filter(
    item => item.status === 'Open'
  ).length

  const actions = [
    {
      icon: '☰',
      title: 'Review Applications',
      copy: `${pendingApplications} application(s) need intake action.`,
      meta: 'Open Applications',
      view: 'applications',
      badge: 'High'
    },
    {
      icon: '♛',
      title: 'Match Federation Requests',
      copy: `${pendingRequests} Federation request(s) may need matching, pricing, or payment review.`,
      meta: 'Open Federation',
      view: 'federation',
      badge: 'High'
    },
    {
      icon: '🧠',
      title: 'Check Academy Leads',
      copy: `${academyInterventions} Academy record(s) need intervention or review.`,
      meta: 'Open Academy',
      view: 'academy',
      badge: 'Medium'
    },
    {
      icon: '₿',
      title: 'Check Payments & Payouts',
      copy: `${pendingPayments} pending payment(s), ${pendingPayouts} pending payout(s).`,
      meta: 'Open Economy',
      view: 'economy',
      badge: 'High'
    },
    {
      icon: '◇',
      title: 'Review Plaza Listings',
      copy: `${flaggedListings} Plaza listing(s) need moderation.`,
      meta: 'Open Plaza',
      view: 'plazas',
      badge: flaggedListings ? 'Medium' : 'Low'
    },
    {
      icon: '?',
      title: 'Open Support Tickets',
      copy: `${openSupportTickets} support ticket(s) still open.`,
      meta: 'Open Support',
      view: 'support',
      badge: openSupportTickets ? 'Medium' : 'Low'
    }
  ]

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Operations Queue</p>
          <h3>Priority Actions</h3>
        </div>
      </div>

      <div id="priority-actions" className="stack-list">
        <div className="quick-action-grid">
          {actions.map(action => (
            <button
              key={action.view}
              type="button"
              className="quick-action-card"
              onClick={() => onNavigate(action.view)}
            >
              <div className="quick-action-top">
                <span className="quick-action-icon">
                  {action.icon}
                </span>
                <Badge value={action.badge} />
              </div>

              <div className="quick-action-title">
                {action.title}
              </div>

              <p className="quick-action-copy">
                {action.copy}
              </p>

              <span className="quick-action-meta">
                {action.meta} →
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}

export function AdminNewestApplications({
  state,
  onOpenApplication
}) {
  const rows = list(state.applications)
    .slice()
    .sort((a, b) => scoreFor(b) - scoreFor(a))
    .slice(0, 5)

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Incoming</p>
          <h3>Newest Applications</h3>
        </div>
      </div>

      <div className="table-wrap">
        <table className="admin-overview-applications-table">
          <thead>
            <tr>
              {[
                'Name',
                'Email',
                'Type',
                'Source',
                'Goal / Background',
                'Recommended',
                'Status',
                'Score / Tier',
                'Actions'
              ].map(label => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>

          <tbody id="overview-applications-table">
            {rows.length ? rows.map((app, index) => (
              <tr key={app.id || index}>
                <td data-label="Name">
                  <strong>{app.name || 'Applicant'}</strong>
                  <div className="muted mono">
                    {app.id || '—'}
                  </div>
                </td>

                <td data-label="Email">
                  {app.email || '—'}
                </td>

                <td data-label="Type">
                  <Badge
                    value={String(app.applicationType || 'general')
                      .replace(/-/g, ' ')
                      .replace(/\b\w/g, char =>
                        char.toUpperCase()
                      )}
                  />
                </td>

                <td data-label="Source">
                  {app.source || 'Unknown'}
                </td>

                <td data-label="Goal / Background">
                  <div className="app-preview">
                    <div className="app-preview-line">
                      <span>Goal</span>
                      <p>{app.goal || 'No goal submitted.'}</p>
                    </div>
                    <div className="app-preview-line">
                      <span>Background</span>
                      <p>
                        {app.background ||
                          'No background submitted.'}
                      </p>
                    </div>
                  </div>
                </td>

                <td data-label="Recommended">
                  <Badge
                    value={app.recommendedDivision || 'Academy'}
                  />
                </td>

                <td data-label="Status">
                  <Badge
                    value={app.status || 'Under Review'}
                  />
                </td>

                <td data-label="Score / Gate">
                  <Gate record={app} />
                </td>

                <td data-label="Actions">
                  <button
                    type="button"
                    className="badge-btn"
                    disabled={!app.id}
                    onClick={() =>
                      onOpenApplication(String(app.id))
                    }
                  >
                    View Form
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className="muted">
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
