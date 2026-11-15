import { useEffect, useState } from 'react'
import { adminFetchJson, getAdminBootstrap } from './adminApi'

const list = value => Array.isArray(value) ? value : []

const display = value =>
  String(value ?? '').trim() || '—'

async function submitVerified(url, payload, verify, refresh) {
  const response = await adminFetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  let verified = false

  try {
    const snapshot = await getAdminBootstrap()
    verified = verify(snapshot.state, response) === true
  } finally {
    refresh()
  }

  if (!verified) {
    throw new Error(
      'The server accepted the operation, but refreshed data could not confirm it. Inspect the original Admin Panel before retrying.'
    )
  }

  return response
}

function SupportOperations({ state, search, refresh }) {
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const selected = list(state.support).find(
    item => String(item.id) === selectedId
  ) || null

  useEffect(() => {
    if (!selectedId) return undefined

    document.body.classList.add('drawer-open')

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setSelectedId('')
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('drawer-open')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedId])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const rows = list(state.support).filter(item => {
    const matchStatus = filter === 'all' || item.status === filter
    const matchSearch = !search.trim() ||
      JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase())

    return matchStatus && matchSearch
  })

  async function changeStatus(ticket, decision) {
    if (busy || !ticket.id || ticket.status === 'Resolved') return

    const nextStatus = decision === 'resolve'
      ? 'Resolved'
      : ticket.status === 'Open'
        ? 'In Progress'
        : ticket.status === 'In Progress'
          ? 'Waiting on User'
          : 'In Progress'

    if (!window.confirm(
      `Change ticket ${ticket.id} to ${nextStatus}?`
    )) return

    setBusy(String(ticket.id))
    setMessage('')

    try {
      await submitVerified(
        `/api/admin/support/${encodeURIComponent(ticket.id)}/status`,
        {
          status: nextStatus,
          adminNote: decision === 'resolve'
            ? 'Resolved by admin.'
            : `Ticket moved to ${nextStatus}.`
        },
        snapshot => list(snapshot.support).some(item =>
          String(item.id) === String(ticket.id) &&
          item.status === nextStatus
        ),
        refresh
      )

      setMessage(
        decision === 'resolve'
          ? `Ticket ${ticket.id} resolved.`
          : `Ticket ${ticket.id} updated.`
      )
    } catch (error) {
      setMessage(error.message || 'Failed to update support ticket.')
    } finally {
      setBusy('')
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-head wrap-head">
        <div>
          <p className="eyebrow">Support Desk</p>
          <h3>Tickets & Reports</h3>
        </div>

        <div className="toolbar">
          <select
            id="support-status-filter"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            {[
              ['all', 'All Statuses'],
              ['Open', 'Open'],
              ['In Progress', 'In Progress'],
              ['Waiting on User', 'Waiting on User'],
              ['Escalated', 'Escalated'],
              ['Resolved', 'Resolved']
            ].map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {message && <p role="status">{message}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                'Ticket', 'Reporter', 'Type', 'Status',
                'Priority', 'Updated', 'Actions'
              ].map(label => <th key={label}>{label}</th>)}
            </tr>
          </thead>

          <tbody id="support-table">
            {rows.map((item, index) => (
              <tr key={item.id || index}>
                <td data-label="Ticket">
                  <strong>{display(item.title)}</strong>
                  <div className="muted mono">{display(item.id)}</div>
                </td>
                <td data-label="Reporter">{display(item.reporter)}</td>
                <td data-label="Type">{display(item.type)}</td>
                <td data-label="Status">{display(item.status)}</td>
                <td data-label="Priority">{display(item.priority)}</td>
                <td data-label="Updated">{display(item.updatedAt)}</td>

                <td data-label="Actions">
                  <div className="table-actions">
                    <button type="button" onClick={() => setSelectedId(String(item.id))}>
                      Open
                    </button>

                    {item.status === 'Resolved' ? (
                      <span className="muted">Resolved</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => changeStatus(item, 'progress')}
                        >
                          Progress
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => changeStatus(item, 'resolve')}
                        >
                          Resolve
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  No support items match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div
            className="drawer-backdrop show"
            role="presentation"
            onClick={() => setSelectedId('')}
          />
          <aside
            className="detail-drawer open"
            role="dialog"
            aria-modal="true"
            aria-label="Support ticket"
          >
            <div className="drawer-head">
              <h3>{display(selected.title)}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedId('')}
                aria-label="Close support ticket"
              >
                ✕
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <h4>Ticket Snapshot</h4>

                <div className="kv-grid">
                  {[
                    ['Ticket', selected.id],
                    ['Reporter', selected.reporter],
                    ['Status', selected.status],
                    ['Priority', selected.priority],
                    ['Type', selected.type],
                    ['Updated', selected.updatedAt]
                  ].map(([label, value]) => (
                    <div className="kv" key={label}>
                      <span>{label}</span>
                      <strong>{display(value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-section">
                <h4>Ticket Notes</h4>

                <div className="stack-list">
                  <div className="stack-item">
                    <p>
                      {display(
                        Array.isArray(selected.notes)
                          ? selected.notes[0]
                          : selected.notes
                      )}
                    </p>
                  </div>
                </div>

                <div className="inline-actions">
                  {selected.status === 'Resolved' ? (
                    <span className="muted">
                      This ticket is resolved. No further status actions are available.
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="badge-btn"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          changeStatus(selected, 'progress')
                        }
                      >
                        Move Progress
                      </button>

                      <button
                        type="button"
                        className="badge-btn"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          changeStatus(selected, 'resolve')
                        }
                      >
                        Resolve
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </article>
  )
}

function CommunicationsOperations({ state, refresh }) {
  const [audience, setAudience] = useState('Academy')
  const [template, setTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event) {
    event.preventDefault()

    if (busy || !subject.trim() || !message.trim()) return

    if (!window.confirm(
      `Submit this broadcast for ${audience}?`
    )) return

    setBusy(true)
    setFeedback('')

    try {
      await submitVerified(
        '/api/admin/broadcasts',
        {
          audience,
          subject: subject.trim(),
          message: message.trim()
        },
        (snapshot, response) => list(snapshot.broadcasts).some(item =>
          String(item.id) === String(response.broadcast?.id)
        ),
        refresh
      )

      setFeedback(`Broadcast sent to ${audience}.`)
      setAudience('Academy')
      setTemplate('')
      setSubject('')
      setMessage('')
    } catch (error) {
      setFeedback(error.message || 'Failed to send broadcast.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-comms-layout">
      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Broadcast Center</p>
            <h3>Create Announcement</h3>
          </div>
        </div>

        <form id="broadcast-form" className="form-grid" onSubmit={submit}>
          <label>
            Audience
            <select
              id="broadcast-audience"
              value={audience}
              onChange={event => setAudience(event.target.value)}
              required
            >
              {[
                'Academy', 'Federation', 'Plazas',
                'All Members', 'Pending Applicants'
              ].map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <label>
            Template
            <select
              id="broadcast-template"
              value={template}
              onChange={event => {
                setTemplate(event.target.value)
                setSubject('')
                setMessage('')
              }}
            >
              {[
                'Custom Message', 'Roadmap Reminder',
                'Review Update', 'Listing Approved',
                'System Announcement'
              ].map((label, index) => (
                <option
                  key={label}
                  value={index === 0 ? '' : label}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="full-span">
            Subject
            <input
              id="broadcast-subject"
              type="text"
              placeholder="Enter subject"
              value={subject}
              onChange={event => setSubject(event.target.value)}
              required
            />
          </label>

          <label className="full-span">
            Message
            <textarea
              id="broadcast-message"
              rows={8}
              placeholder="Write your message here..."
              value={message}
              onChange={event => setMessage(event.target.value)}
              required
            />
          </label>

          <div className="full-span form-actions">
            <button type="submit" className="primary-btn" disabled={busy}>
              {busy ? 'Processing...' : 'Send Broadcast'}
            </button>
          </div>

          {feedback && <p className="full-span" role="status">{feedback}</p>}
        </form>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Delivery Log</p>
            <h3>Recent Broadcasts</h3>
          </div>
        </div>

        <div
          id="broadcast-history"
          className="admin-broadcast-list"
        >
          {list(state.broadcasts)
            .slice()
            .sort((a, b) =>
              String(b.sentAt || '').localeCompare(
                String(a.sentAt || '')
              )
            )
            .map((item, index) => (
              <article
                className="admin-broadcast-record"
                key={item.id || index}
              >
                <header className="admin-broadcast-head">
                  <div>
                    <h4>{display(item.subject)}</h4>
                    <span className="muted">
                      Sent: {display(item.sentAt)}
                    </span>
                  </div>
                  <span className="badge">
                    {display(item.audience)}
                  </span>
                </header>

                <p className="admin-broadcast-excerpt">
                  {display(item.message)}
                </p>

                <details className="admin-broadcast-details">
                  <summary>Read full message</summary>
                  <p>{display(item.message)}</p>
                </details>
              </article>
            ))}
        </div>
      </article>
    </div>
  )
}

const settingMeta = {
  requireFederationManualReview: {
    label: 'Require Federation manual review',
    active: false,
    copy: 'Backend enforcement is not active yet. This control will be enabled in the next settings patches.'
  },
  requirePlazaListingReview: {
    label: 'Require Plazas manual listing review',
    active: false,
    copy: 'Backend enforcement is not active yet. This control will be enabled in the next settings patches.'
  },
  enableAiNudges: {
    label: 'Enable AI nudges',
    active: false,
    copy: 'Backend enforcement is not active yet. This control will be enabled in the next settings patches.'
  }
}

function SettingsOperations({ state, refresh }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [maintenanceUnverified, setMaintenanceUnverified] = useState(false)

  const maintenance = state.settings?.maintenanceMode
  const known =
    typeof maintenance === 'boolean' &&
    !maintenanceUnverified

  const enabled = maintenance === true

  const maintenanceStatus = !known
    ? 'Status unavailable'
    : enabled
      ? 'Maintenance in progress'
      : 'Platform operational'

  const maintenanceDescription = !known
    ? 'Cannot verify live settings. Maintenance switch is locked until the connection recovers.'
    : enabled
      ? 'Members see the maintenance notice; the secure Admin Panel remains accessible.'
      : 'Visitors and members can access the platform normally.'

  async function changeMaintenance(nextValue) {
    if (busy || !known || nextValue === enabled) return

    const warning = nextValue
      ? 'Enable Maintenance Mode? All member pages and APIs will be temporarily unavailable. Admin access remains active.'
      : 'Disable Maintenance Mode and restore public/member access to Young Hustlers Universe?'

    if (!window.confirm(warning)) return

    setBusy(true)
    setMessage('')

    try {
      await submitVerified(
        '/api/admin/settings/maintenance-mode',
        { enabled: nextValue },
        snapshot => snapshot.settings?.maintenanceMode === nextValue,
        refresh
      )

      setMaintenanceUnverified(false)

      setMessage(
        nextValue
          ? 'Maintenance mode enabled.'
          : 'Maintenance mode disabled.'
      )
    } catch (error) {
      if (error?.status !== 423) {
        setMaintenanceUnverified(true)
      }

      setMessage(
        (error.message || 'Failed to update maintenance mode.') +
        (error?.status === 423
          ? ''
          : ' Reload to verify the live status.')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <article
        className="panel-card admin-maintenance-card"
        id="admin-maintenance-card"
        data-active={known ? String(enabled) : 'unknown'}
      >
        <div className="admin-maintenance-main">
          <div className="admin-maintenance-copy">
            <p className="eyebrow">Platform-wide access</p>
            <h3>Platform Maintenance</h3>

            <p>
              Temporarily show visitors and members a read-only
              maintenance notice while keeping the secure
              Admin Panel available.
            </p>

            <div
              className="admin-maintenance-meta"
              aria-live="polite"
            >
              <span
                className="admin-maintenance-indicator"
                aria-hidden="true"
              />
              <strong id="admin-maintenance-status">
                {maintenanceStatus}
              </strong>
            </div>

            <p
              className="admin-maintenance-detail"
              id="admin-maintenance-description"
            >
              {maintenanceDescription}
            </p>
          </div>

          <div className="admin-maintenance-action">
            <span className="admin-maintenance-switch-label">
              Maintenance Mode
            </span>

            <label
              className="switch"
              title="Toggle platform maintenance mode"
            >
              <input
                type="checkbox"
                id="admin-maintenance-toggle"
                aria-label="Enable or disable platform maintenance mode"
                checked={enabled}
                disabled={!known || busy}
                onChange={event =>
                  changeMaintenance(event.target.checked)
                }
              />
              <span aria-hidden="true" />
            </label>
          </div>
        </div>

        {message && <p role="status">{message}</p>}
      </article>

      <div className="content-grid two-col">
      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Access Control</p>
            <h3>Roles & Permissions</h3>
          </div>
        </div>
        <div id="roles-list" className="stack-list">
          {list(state.roles).length
            ? state.roles.map((role, index) => (
              <div className="role-item" key={role.id || index}>
                <div className="stack-item-head">
                  <strong>{display(role.name)}</strong>
                  <span className="badge">Active</span>
                </div>
                <p>{list(role.permissions).join(' • ')}</p>
              </div>
            ))
            : (
              <div className="stack-item">
                <p className="muted">No live roles loaded yet.</p>
              </div>
            )}
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">System Controls</p>
            <h3>Operational Toggles</h3>
          </div>
        </div>
        <div id="settings-form" className="stack-list">
          {Object.entries(state.settings || {})
            .filter(([key]) => key !== 'maintenanceMode')
            .map(([key, value]) => {
            const meta = settingMeta[key] || {
              label: key,
              active: false,
              copy: 'This setting is not currently available.'
            }

            return (
              <div className="toggle-item switch-row" key={key}>
                <div>
                  <strong>{meta.label}</strong>
                  <p>{meta.copy}</p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={value === true}
                    disabled
                  />
                  <span />
                </label>
              </div>
            )
          })}
        </div>
      </article>
    </div>
    </>
  )
}

export default function AdminOperationsView({
  view,
  state,
  search = '',
  refresh
}) {
  switch (view) {
    case 'support':
      return (
        <SupportOperations
          state={state}
          search={search}
          refresh={refresh}
        />
      )
    case 'communications':
      return (
        <CommunicationsOperations
          state={state}
          refresh={refresh}
        />
      )
    case 'settings':
      return (
        <SettingsOperations
          state={state}
          refresh={refresh}
        />
      )
    default:
      return null
  }
}
