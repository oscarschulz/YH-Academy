import AdminFilterMenu from './AdminFilterMenu'
import { useEffect, useMemo, useState } from 'react'
import { adminFetchJson, getAdminBootstrap } from './adminApi'
import { Badge } from './AdminApplicationsView'

const list = value => Array.isArray(value) ? value : []

const text = value => {
  const normalized = String(value ?? '').trim()
  return normalized || '—'
}

function MemberStatusAction({
  member,
  onToggle,
  disabled
}) {
  return (
    <button
      type="button"
      disabled={disabled || !member.id}
      aria-busy={disabled}
      onClick={() => onToggle(member)}
    >
      {member.status === 'Suspended' ? 'Activate' : 'Suspend'}
    </button>
  )
}

function MemberDrawer({
  member,
  onClose,
  onToggle,
  disabled
}) {
  const divisions = list(member.divisions)
  const notes = list(member.notes)

  useEffect(() => {
    document.body.classList.add('drawer-open')

    const handleKey = event => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.classList.remove('drawer-open')
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <>
      <div
        className="drawer-backdrop show"
        role="presentation"
        onClick={onClose}
      />

      <aside
        className="detail-drawer open"
        role="dialog"
        aria-modal="true"
        aria-label="Member details"
      >
        <div className="drawer-head">
          <div className="drawer-head-main">
            <div className="drawer-head-copy">
              <p className="eyebrow">Member</p>
              <h3>{text(member.name)}</h3>
            </div>
          </div>

          <div className="drawer-head-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label="Close member details"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <h4>Member Snapshot</h4>

            <div className="kv-grid">
              <div className="kv">
                <span>Name</span>
                <strong>{text(member.name)}</strong>
              </div>

              <div className="kv">
                <span>Username</span>
                <strong>{text(member.username)}</strong>
              </div>

              <div className="kv">
                <span>Status</span>
                <Badge value={member.status} />
              </div>

              <div className="kv">
                <span>Risk Flag</span>
                <Badge value={member.riskFlag} />
              </div>

              <div className="kv">
                <span>Divisions</span>

                <div className="list-chips">
                  {divisions.map(division => (
                    <Badge key={division} value={division} />
                  ))}
                </div>
              </div>

              <div className="kv">
                <span>Activity Score</span>
                <strong>{text(member.activityScore)}</strong>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <h4>Operational Notes</h4>

            <p>
              <strong>Roadmap:</strong> {text(member.roadmapStatus)}
            </p>

            <p>
              <strong>Last Login:</strong> {text(member.lastLogin)}
            </p>

            <p>
              <strong>Joined:</strong> {text(member.joinedAt)}
            </p>

            <div className="stack-list">
              {notes.map((note, index) => (
                <div className="stack-item" key={index}>
                  <p>{String(note)}</p>
                </div>
              ))}
            </div>

            <div className="inline-actions">
              <MemberStatusAction
                member={member}
                onToggle={onToggle}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default function AdminMembersView({
  state,
  refresh,
  globalSearch = '',
  active = false
}) {
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [blockedIds, setBlockedIds] = useState([])
  const [message, setMessage] = useState('')

  const members = list(state?.members)

  const rows = useMemo(() => members.filter(member => {
    const divisions = list(member.divisions)

    const divisionMatch =
      divisionFilter === 'all' ||
      divisions.includes(divisionFilter)

    const statusMatch =
      statusFilter === 'all' ||
      member.status === statusFilter

    const searchMatch =
      !globalSearch.trim() ||
      JSON.stringify(member)
        .toLowerCase()
        .includes(globalSearch.trim().toLowerCase())

    return divisionMatch && statusMatch && searchMatch
  }), [members, divisionFilter, statusFilter, globalSearch])

  const selected = members.find(
    member => String(member.id) === selectedId
  )

  useEffect(() => {
    if (!active) {
      setSelectedId('')
    }
  }, [active])

  async function toggleMemberStatus(member) {
    const id = String(member?.id || '').trim()

    if (!id || pendingId || blockedIds.includes(id)) {
      return
    }

    const nextStatus =
      member.status === 'Suspended' ? 'Active' : 'Suspended'

    setPendingId(id)
    setMessage('')

    try {
      await adminFetchJson(
        `/api/admin/members/${encodeURIComponent(id)}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: nextStatus })
        }
      )

      const snapshot = await getAdminBootstrap()
      const updated = list(snapshot.state.members).find(
        item => String(item.id) === id
      )

      refresh()

      if (!updated || updated.status !== nextStatus) {
        setBlockedIds(current => [...new Set([...current, id])])
        setMessage(
          'Status update was accepted, but the refreshed member status could not be verified. Reload and inspect the member before attempting another update.'
        )
        return
      }

      setMessage(`${member.name} is now ${nextStatus}.`)
    } catch (error) {
      if (error?.status !== 423) {
        setBlockedIds(current => [...new Set([...current, id])])
      }

      setMessage(
        error?.status === 423
          ? error.message
          : error?.status === 401
            ? 'Admin session expired. Please sign in again.'
            : `${error.message || 'Failed to update member status.'} Verify the current status before retrying.`
      )
    } finally {
      setPendingId('')
    }
  }

  return (
    <section
      id="view-members"
      className={`view view-members${active ? ' active' : ''}`}
      data-app-active={active ? '' : undefined}
    >
      <div className="panel-card">
        <div className="panel-head wrap-head">
          <div>
            <p className="eyebrow">Member Database</p>
            <h3>All Members</h3>
          </div>

          <div className="toolbar">
            <AdminFilterMenu>
            <select
              id="members-division-filter"
              value={divisionFilter}
              onChange={event =>
                setDivisionFilter(event.target.value)
              }
            >
              <option value="all">All Divisions</option>
              <option value="Academy">Academy</option>
              <option value="Federation">Federation</option>
              <option value="Plazas">Plazas</option>
            </select>

            <select
              id="members-status-filter"
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
              <option value="Flagged">Flagged</option>
            </select>
                      </AdminFilterMenu>
          </div>
        </div>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  'Member',
                  'Divisions',
                  'Status',
                  'Activity',
                  'Roadmap',
                  'Last Login',
                  'Actions'
                ].map(label => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>

            <tbody id="members-table">
              {rows.length ? rows.map(member => {
                const busy =
                  pendingId === String(member.id) ||
                  blockedIds.includes(String(member.id))

                return (
                  <tr key={member.id}>
                    <td data-label="Member">
                      <strong>{text(member.name)}</strong>
                      <div className="muted mono">
                        {text(member.username)}
                      </div>
                    </td>

                    <td data-label="Divisions">
                      {list(member.divisions).map(division => (
                        <Badge key={division} value={division} />
                      ))}
                    </td>

                    <td data-label="Status">
                      <Badge value={member.status} />
                    </td>

                    <td data-label="Activity">
                      {text(member.activityScore)}
                    </td>

                    <td data-label="Roadmap">
                      {text(member.roadmapStatus)}
                    </td>

                    <td data-label="Last Login">
                      {text(member.lastLogin)}
                    </td>

                    <td data-label="Actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId(String(member.id))
                          }
                        >
                          Open
                        </button>

                        <MemberStatusAction
                          member={member}
                          onToggle={toggleMemberStatus}
                          disabled={busy}
                        />
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="muted">
                    No members match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && active && (
        <MemberDrawer
          member={selected}
          onClose={() => setSelectedId('')}
          onToggle={toggleMemberStatus}
          disabled={
            pendingId === selectedId ||
            blockedIds.includes(selectedId)
          }
        />
      )}
    </section>
  )
}
