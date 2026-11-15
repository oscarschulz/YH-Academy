import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../services/api/apiClient'

const TABS = [
  'overview',
  'missions',
  'rankings',
  'members',
  'activity',
]

const numeric = (value) =>
  Math.max(0, Number(value) || 0)

const clean = (value) =>
  String(value ?? '').trim()

const cleanCode = (value) =>
  clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)

function formatSquadHistoryTime(value) {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function DashboardSquad({
  access,
  squadPayload,
  onSquadChange,
}) {
  const approved = access?.approved === true

  const joined =
    approved &&
    squadPayload?.joined === true &&
    Boolean(squadPayload?.squad)

  const squad = joined
    ? squadPayload.squad
    : {}

  const squadRole = clean(
    squadPayload?.membership?.role || squad.role
  ).toLowerCase()

  const isOwner = joined && squadRole === 'owner'

  // YHU_D07_SQUAD_PARITY_SINGLE_OWNER
  const weeklyPosition =
    squadPayload?.weeklyLeaderboard?.currentSquadPosition ||
    squad.weeklyPosition ||
    null

  const allTimePosition =
    squadPayload?.allTimeLeaderboard?.currentSquadPosition ||
    squad.allTimePosition ||
    null

  const squadLevel = Math.max(1, numeric(squad.level) || 1)
  const totalXp = numeric(squad.totalXp)
  const levelStartXp = (squadLevel - 1) * 500
  const nextLevelXp = Math.max(
    squadLevel * 500,
    numeric(squad.nextLevelXp) || squadLevel * 500
  )
  const levelRequired = Math.max(1, nextLevelXp - levelStartXp)
  const levelCurrent = Math.max(0, totalXp - levelStartXp)
  const levelPercent = Math.max(
    0,
    Math.min(100, Math.round(levelCurrent / levelRequired * 100))
  )

  const members = numeric(
    squad.memberCount ??
    (Array.isArray(squad.members)
      ? squad.members.length
      : 0),
  )

  const slots = numeric(squad.maxMembers) || 8

  const [view, setView] = useState('')
  const [tab, setTab] = useState('overview')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  // YHU_D06_SQUAD_MANAGEMENT_SINGLE_OWNER
  const [pendingAction, setPendingAction] = useState(null)
  const [missions, setMissions] = useState(null)
  const [rankings, setRankings] = useState(null)

  // YHU_D08_CONTRIBUTOR_PARITY_SINGLE_OWNER

  // YHU_D05_SQUAD_MISSIONS_SINGLE_OWNER
  const [missionFilter, setMissionFilter] = useState('all')
  const [missionEditor, setMissionEditor] = useState(null)
  const [missionHistory, setMissionHistory] = useState(null)
  const [missionWorking, setMissionWorking] = useState(false)

  const [form, setForm] = useState({
    name: '',
    emblem: '⚡',
    description: '',
    inviteCode: '',
  })

  useEffect(() => {
    if (!view) return undefined

    document.body.classList.add(
      'yh-game-squad-modal-open',
    )

    const onKey = (event) => {
      if (event.key === 'Escape' && !working) {
        if (pendingAction) setPendingAction(null)
        else setView('')
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      document.body.classList.remove(
        'yh-game-squad-modal-open',
      )
      document.removeEventListener('keydown', onKey)
    }
  }, [view, working, pendingAction])

  function open(nextView) {
    setError('')
    setView(nextView)
  }

  function setField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function refreshSquad(fallback) {
    try {
      const payload = await apiFetch(
        '/api/academy/squad',
        { cache: 'no-store' },
      )
      onSquadChange(payload)
    } catch {
      onSquadChange(fallback)
    }
  }

  async function createSquad(event) {
    event.preventDefault()
    if (working || !approved) return

    const payload = {
      name: clean(form.name),
      emblem: clean(form.emblem) || '⚡',
      description: clean(form.description),
    }

    if (payload.name.length < 3) {
      setError(
        'Squad name must contain at least 3 characters.',
      )
      return
    }

    setWorking(true)
    setError('')

    try {
      const result = await apiFetch(
        '/api/academy/squad',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      await refreshSquad(result)
      setView('')
    } catch (cause) {
      setError(
        cause?.message || 'Failed to create squad.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function searchSquad(event) {
    event.preventDefault()
    if (working || !approved) return

    const inviteCode = cleanCode(form.inviteCode)

    if (!inviteCode) {
      setError('Squad invitation code is required.')
      return
    }

    setWorking(true)
    setError('')

    try {
      const result = await apiFetch(
        '/api/academy/squad/search?inviteCode=' +
          encodeURIComponent(inviteCode),
        { cache: 'no-store' },
      )

      setPreview(result?.squad || {})
      setView('preview')
    } catch (cause) {
      setError(
        cause?.message || 'No squad was found.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function joinSquad() {
    if (
      working ||
      !approved ||
      preview?.canJoin === false
    ) return

    setWorking(true)
    setError('')

    try {
      const result = await apiFetch(
        '/api/academy/squad/join',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inviteCode: cleanCode(form.inviteCode),
          }),
        },
      )

      await refreshSquad(result)
      setView('')
    } catch (cause) {
      setError(
        cause?.message || 'Failed to join squad.',
      )
    } finally {
      setWorking(false)
    }
  }

  async function openWorkspace(nextTab = 'overview') {
    if (!approved || !joined) return

    setTab(nextTab)
    setError('')
    setView('workspace')

    if (nextTab === 'missions' && missions === null) {
      try {
        const result = await apiFetch(
          '/api/academy/squad/missions?limit=100',
          { cache: 'no-store' },
        )
        setMissions(result)
      } catch (cause) {
        setError(
          cause?.message ||
            'Squad missions could not be loaded.',
        )
      }
    }

    if (nextTab === 'rankings' && rankings === null) {
      try {
        const [weekly, allTime] = await Promise.all([
          apiFetch(
            '/api/academy/squad/leaderboard?period=weekly&limit=10',
            { cache: 'no-store' },
          ),
          apiFetch(
            '/api/academy/squad/leaderboard?period=all_time&limit=10',
            { cache: 'no-store' },
          ),
        ])

        const [weeklyContributors, allTimeContributors] =
          await Promise.all([
            apiFetch(
              '/api/academy/squad/contributors?period=weekly&limit=10',
              { cache: 'no-store' },
            ).catch(() => ({ contributors: [] })),
            apiFetch(
              '/api/academy/squad/contributors?period=all_time&limit=10',
              { cache: 'no-store' },
            ).catch(() => ({ contributors: [] })),
          ])

        setRankings({
          weekly,
          allTime,
          weeklyContributors,
          allTimeContributors,
        })
      } catch (cause) {
        setError(
          cause?.message ||
            'Squad rankings could not be loaded.',
        )
      }
    }
  }

  async function reloadSquadMissions() {
    try {
      const payload = await apiFetch(
        '/api/academy/squad/missions?limit=100',
        { cache: 'no-store' },
      )
      setMissions(payload)
      setError('')
      return true
    } catch (cause) {
      setError(
        cause?.message ||
        'Squad missions could not be loaded.',
      )
      return false
    }
  }

  async function saveSquadMission(event) {
    event.preventDefault()

    if (
      missionWorking ||
      missions?.canManage !== true ||
      !missionEditor
    ) return

    const data = new FormData(event.currentTarget)
    const title = clean(data.get('title'))

    if (title.length < 3) {
      setError('Mission title must contain at least 3 characters.')
      return
    }

    const rawDeadline = clean(data.get('deadline'))

    const payload = {
      title,
      description: clean(data.get('description')),
      missionType: clean(data.get('missionType')) || 'custom',
      target: Math.max(1, Number(data.get('target')) || 1),
      rewardXp: Math.max(0, Number(data.get('rewardXp')) || 0),
      deadline: rawDeadline
        ? new Date(rawDeadline).toISOString()
        : '',
    }

    setMissionWorking(true)
    setError('')

    try {
      const id = clean(missionEditor.id)

      await apiFetch(
        id
          ? '/api/academy/squad/missions/' + encodeURIComponent(id)
          : '/api/academy/squad/missions',
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      setMissionEditor(null)
      if (!id) setMissionFilter('active')
      await reloadSquadMissions()
    } catch (cause) {
      setError(
        cause?.message || 'Squad mission could not be saved.',
      )
    } finally {
      setMissionWorking(false)
    }
  }

  async function cancelSquadMission(mission) {
    if (
      missionWorking ||
      missions?.canManage !== true ||
      !mission?.id
    ) return

    const confirmed = window.confirm(
      'Cancel Squad mission?\\n' +
      '“' + (mission.title || 'This mission') +
      '” will move to the cancelled history.',
    )

    if (!confirmed) return

    setMissionWorking(true)
    setError('')

    try {
      await apiFetch(
        '/api/academy/squad/missions/' +
          encodeURIComponent(mission.id),
        { method: 'DELETE' },
      )

      await reloadSquadMissions()
    } catch (cause) {
      setError(
        cause?.message ||
        'Squad mission could not be cancelled.',
      )
    } finally {
      setMissionWorking(false)
    }
  }

  async function openSquadMissionHistory(mission) {
    if (!mission?.id) return

    setMissionHistory({
      loading: true,
      mission,
      data: null,
    })
    setError('')

    try {
      const payload = await apiFetch(
        '/api/academy/squad/missions/' +
          encodeURIComponent(mission.id) +
          '/contributions?limit=100',
        { cache: 'no-store' },
      )

      setMissionHistory({
        loading: false,
        mission,
        data: payload,
      })
    } catch (cause) {
      setMissionHistory(null)
      setError(
        cause?.message ||
        'Contribution history could not be loaded.',
      )
    }
  }

  function openMissionEditor(mission = {}) {
    if (missions?.canManage !== true) return

    setError('')
    setMissionHistory(null)
    setMissionEditor({
      id: mission.id || '',
      title: mission.title || '',
      missionType: mission.missionType || 'academy_missions',
      target: mission.target ?? 5,
      rewardXp: mission.rewardXp ?? 100,
      deadline: mission.deadline
        ? String(mission.deadline).slice(0, 16)
        : '',
      description: mission.description || '',
    })
  }

  function askManagementAction(action) {
    if (!joined || working) return
    if (action.ownerOnly && !isOwner) return
    setError('')
    setPendingAction(action)
  }

  async function executeManagementAction() {
    const action = pendingAction
    if (!action || working || !joined) return
    if (action.ownerOnly && !isOwner) return

    setWorking(true)
    setError('')

    try {
      const options = {
        method: action.method,
      }

      if (action.body) {
        options.headers = {
          'Content-Type': 'application/json'
        }
        options.body = JSON.stringify(action.body)
      }

      const result = await apiFetch(action.url, options)

      if (action.clearSquad) {
        onSquadChange?.({
          joined: false,
          squad: null,
          membership: null
        })
        setView('')
      } else {
        await refreshSquad(result)
      }

      setPendingAction(null)
    } catch (cause) {
      setPendingAction(null)
      setError(cause?.message || 'Squad action failed.')
    } finally {
      setWorking(false)
    }
  }

  const modal = view
    ? createPortal(
        <div
          id="yh-game-squad-modal"
          className="yh-game-squad-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Squad System"
        >
          <div
            className={
              'yh-game-squad-modal-card' +
              (view === 'workspace'
                ? ' is-workspace'
                : '')
            }
          >
            <button
              type="button"
              className="yh-game-squad-modal-close"
              aria-label="Close"
              disabled={working}
              onClick={() => setView('')}
            >
              ×
            </button>

            <div
              id="yh-game-squad-modal-content"
              className="yh-game-squad-modal-content"
            >
              {view === 'create' && (
                <>
                  <div className="yh-game-squad-modal-kicker">
                    Squad Foundation
                  </div>
                  <h2>Create Your Squad</h2>
                  <p className="yh-game-squad-modal-copy">
                    Build a small Academy team for future
                    shared missions, operations, and squad
                    rankings.
                  </p>

                  <form onSubmit={createSquad}>
                    <label>
                      <span>Squad Name</span>
                      <input
                        name="name"
                        minLength={3}
                        maxLength={60}
                        required
                        placeholder="Example: Orbit Builders"
                        value={form.name}
                        onChange={(e) =>
                          setField('name', e.target.value)
                        }
                      />
                    </label>

                    <label>
                      <span>Emblem</span>
                      <select
                        name="emblem"
                        value={form.emblem}
                        onChange={(e) =>
                          setField('emblem', e.target.value)
                        }
                      >
                        {[
                          ['⚡', 'Lightning'],
                          ['🚀', 'Rocket'],
                          ['🛡️', 'Shield'],
                          ['🔥', 'Flame'],
                          ['🌐', 'Network'],
                          ['⭐', 'Star'],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {value} {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Description</span>
                      <textarea
                        name="description"
                        maxLength={240}
                        rows={4}
                        placeholder="What is your squad building together?"
                        value={form.description}
                        onChange={(e) =>
                          setField(
                            'description',
                            e.target.value,
                          )
                        }
                      />
                    </label>

                    {error && (
                      <div
                        className="yh-game-squad-form-error"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

                    <div className="yh-game-squad-form-actions">
                      <button
                        type="button"
                        className="yh-game-squad-secondary"
                        onClick={() => open('')}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="yh-game-squad-primary"
                        disabled={working}
                        aria-busy={working}
                      >
                        {working ? 'Creating...' : 'Create Squad'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {view === 'search' && (
                <>
                  <div className="yh-game-squad-modal-kicker">
                    Squad Discovery
                  </div>
                  <h2>Search for Squad</h2>
                  <p className="yh-game-squad-modal-copy">
                    Enter the invitation code shared by the
                    squad owner. You will see the squad
                    details before joining.
                  </p>

                  <form onSubmit={searchSquad}>
                    <label>
                      <span>Squad Invitation Code</span>
                      <input
                        name="inviteCode"
                        maxLength={10}
                        required
                        autoComplete="off"
                        placeholder="Example: A1B2C3D4"
                        value={form.inviteCode}
                        onChange={(e) =>
                          setField(
                            'inviteCode',
                            e.target.value,
                          )
                        }
                      />
                    </label>

                    {error && (
                      <div
                        className="yh-game-squad-form-error"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

                    <div className="yh-game-squad-form-actions">
                      <button
                        type="button"
                        className="yh-game-squad-secondary"
                        onClick={() => open('')}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="yh-game-squad-primary"
                        disabled={working}
                        aria-busy={working}
                      >
                        {working ? 'Searching...' : 'Search Squad'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {view === 'preview' && (
                <>
                  <div className="yh-game-squad-search-preview">
                    <div className="yh-game-squad-detail-emblem">
                      {preview?.emblem || '⚡'}
                    </div>
                    <div>
                      <div className="yh-game-squad-modal-kicker">
                        Squad Found
                      </div>
                      <h2>{preview?.name || 'Academy Squad'}</h2>
                      <p>
                        {preview?.description || 'Academy squad.'}
                      </p>
                    </div>
                  </div>

                  <div className="yh-game-squad-detail-stats">
                    <div>
                      <small>Members</small>
                      <strong>
                        {numeric(preview?.memberCount)}/
                        {numeric(preview?.maxMembers) || 8}
                      </strong>
                    </div>
                    <div>
                      <small>Available Slots</small>
                      <strong>
                        {numeric(preview?.availableSlots)}
                      </strong>
                    </div>
                    <div>
                      <small>Rank</small>
                      <strong>
                        {preview?.rank || 'Unranked'}
                      </strong>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="yh-game-squad-form-error"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <div className="yh-game-squad-form-actions">
                    <button
                      type="button"
                      className="yh-game-squad-secondary"
                      onClick={() => open('search')}
                    >
                      Search Again
                    </button>
                    <button
                      type="button"
                      className="yh-game-squad-primary"
                      disabled={
                        working ||
                        preview?.canJoin === false
                      }
                      aria-busy={working}
                      onClick={joinSquad}
                    >
                      {working ? 'Joining...' : 'Join This Squad'}
                    </button>
                  </div>
                </>
              )}

              {view === 'workspace' && (
                <>
                  <div className="yh-game-squad-detail-head">
                    <div className="yh-game-squad-detail-emblem">
                      {squad.emblem || '⚡'}
                    </div>
                    <div>
                      <div className="yh-game-squad-modal-kicker">
                        Your Squad
                      </div>
                      <h2>{squad.name || 'Academy Squad'}</h2>
                      <p>
                        {squad.description ||
                          'Squad foundation active.'}
                      </p>
                    </div>
                  </div>

                  <nav
                    className="yh-game-squad-workspace-tabs"
                    aria-label="Squad workspace"
                  >
                    {TABS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={
                          tab === name ? 'is-active' : ''
                        }
                        onClick={() =>
                          void openWorkspace(name)
                        }
                      >
                        {name[0].toUpperCase() + name.slice(1)}
                      </button>
                    ))}
                  </nav>

                  {error && (
                    <p
                      className="yh-game-squad-form-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  {tab === 'overview' && (
                    <>
                      <div className="yh-game-squad-detail-stats">
                        <div>
                          <small>Your Role</small>
                          <strong>
                            {squadPayload?.membership?.role ||
                              squad.role ||
                              'member'}
                          </strong>
                        </div>
                        <div>
                          <small>Members</small>
                          <strong>
                            {members}/{slots}
                          </strong>
                        </div>
                        <div>
                          <small>Squad Level</small>
                          <strong>
                            {numeric(squad.level) || 1}
                          </strong>
                        </div>
                      </div>

                      <div className="yh-game-squad-xp-panel">
                        <div className="yh-game-squad-xp-panel-head">
                          <span>Total Squad XP</span>
                          <strong>{totalXp.toLocaleString()}</strong>
                        </div>
                        <div className="yh-game-squad-xp-track">
                          <span style={{ width: levelPercent + '%' }} />
                        </div>
                        <div className="yh-game-squad-xp-panel-foot">
                          <span>
                            {levelCurrent.toLocaleString()}
                            {' / '}
                            {levelRequired.toLocaleString()}
                            {' toward Level '}
                            {squadLevel + 1}
                          </span>
                          <strong>
                            {numeric(squad.weeklyXp).toLocaleString()}
                            {' weekly XP'}
                          </strong>
                        </div>
                      </div>

                      <div className="yh-game-squad-ranking-summary">
                        <div>
                          <small>Weekly Rank</small>
                          <strong>
                            {weeklyPosition?.position
                              ? '#' +
                                weeklyPosition.position
                              : 'Unranked'}
                          </strong>
                        </div>
                        <div>
                          <small>All-Time Rank</small>
                          <strong>
                            {allTimePosition?.position
                              ? '#' +
                                allTimePosition.position
                              : 'Unranked'}
                          </strong>
                        </div>
                      </div>

                      <div className="yh-game-squad-invite-panel">
                        <small>Invitation Code</small>
                        <strong>
                          {squad.inviteCode || 'Unavailable'}
                        </strong>
                        <button
                          type="button"
                          disabled={!squad.inviteCode}
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              squad.inviteCode,
                            )
                          }
                        >
                          Copy Code
                        </button>
                        {isOwner && (
                          <button type="button" disabled={working}
                            onClick={() => askManagementAction({
                              title: 'Regenerate invitation code?',
                              message: 'The old code will stop working.',
                              okText: 'Regenerate',
                              method: 'POST',
                              url: '/api/academy/squad/invite/regenerate',
                              ownerOnly: true
                            })}>
                            Regenerate
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {tab === 'missions' && (
                    <>
                      {missionEditor ? (
                        <>
                          <div className="yh-game-squad-modal-kicker">
                            Shared Squad Mission
                          </div>
                          <h2>
                            {missionEditor.id
                              ? 'Edit Squad Mission'
                              : 'Create Squad Mission'}
                          </h2>
                          <p className="yh-game-squad-modal-copy">
                            Set a shared target that members can complete
                            through verified Academy activity.
                          </p>
                          <form onSubmit={saveSquadMission}>
                            <label>
                              <span>Mission Title</span>
                              <input name="title" required minLength={3}
                                maxLength={100}
                                defaultValue={missionEditor.title}
                                placeholder="Complete 5 Academy Missions" />
                            </label>
                            <label>
                              <span>Mission Type</span>
                              <select name="missionType"
                                defaultValue={missionEditor.missionType}>
                                {[
                                  ['academy_missions', 'Academy Missions'],
                                  ['verified_leads', 'Verified Leads'],
                                  ['daily_checkins', 'Daily Check-ins'],
                                  ['squad_xp', 'Squad XP'],
                                  ['mission_playbooks', 'Mission Playbooks'],
                                  ['custom', 'Custom Mission'],
                                ].map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="yh-game-squad-mission-form-grid">
                              <label>
                                <span>Target</span>
                                <input name="target" type="number"
                                  min="1" max="10000" required
                                  defaultValue={missionEditor.target} />
                              </label>
                              <label>
                                <span>Reward XP</span>
                                <input name="rewardXp" type="number"
                                  min="0" max="500" required
                                  defaultValue={missionEditor.rewardXp} />
                              </label>
                            </div>
                            <label>
                              <span>Deadline</span>
                              <input name="deadline" type="datetime-local"
                                defaultValue={missionEditor.deadline} />
                            </label>
                            <label>
                              <span>Description</span>
                              <textarea name="description" maxLength={500}
                                rows={4}
                                defaultValue={missionEditor.description}
                                placeholder="Describe what the Squad needs to complete." />
                            </label>
                            <div className="yh-game-squad-form-actions">
                              <button type="button"
                                className="yh-game-squad-secondary"
                                onClick={() => {
                                  setMissionEditor(null)
                                  setError('')
                                }}>
                                Back
                              </button>
                              <button type="submit"
                                className="yh-game-squad-primary"
                                disabled={missionWorking}>
                                {missionWorking ? 'Saving...'
                                  : missionEditor.id
                                    ? 'Save Changes' : 'Create Mission'}
                              </button>
                            </div>
                          </form>
                        </>
                      ) : missionHistory ? (
                        <>
                          <div className="yh-game-squad-modal-kicker">
                            Mission Contribution History
                          </div>
                          <h2>{missionHistory.mission.title}</h2>
                          <button type="button"
                            className="yh-game-squad-secondary"
                            onClick={() => setMissionHistory(null)}>
                            ← Back to Missions
                          </button>
                          {missionHistory.loading ? (
                            <p>Loading contribution history...</p>
                          ) : (
                            <>
                              <p>
                                {Array.isArray(
                                  missionHistory.data?.contributions
                                )
                                  ? missionHistory.data.contributions.length
                                  : 0} verified contributions
                              </p>
                              <div className="yh-game-squad-history-summary">
                                <div>
                                  <small>Mission Progress</small>
                                  <strong>
                                    {numeric(
                                      missionHistory.data?.mission?.progress
                                    )}
                                    {' / '}
                                    {Math.max(1, numeric(
                                      missionHistory.data?.mission?.target
                                    ))}
                                  </strong>
                                </div>
                                <div>
                                  <small>Contributors</small>
                                  <strong>
                                    {numeric(
                                      missionHistory.data?.contributorCount ??
                                      missionHistory.data?.contributors?.length
                                    )}
                                  </strong>
                                  <span>Verified members</span>
                                </div>
                                <div>
                                  <small>Contribution Events</small>
                                  <strong>
                                    {numeric(
                                      missionHistory.data?.contributionCount ??
                                      missionHistory.data?.contributions?.length
                                    )}
                                  </strong>
                                  <span>Duplicate-safe actions</span>
                                </div>
                              </div>

                              <section className="yh-game-squad-history-section">
                                <div className="yh-game-squad-history-section-head">
                                  <div>
                                    <small>Top Contributors</small>
                                    <h3>Member Breakdown</h3>
                                  </div>
                                </div>
                                <div className="yh-game-squad-history-contributors">
                                  {(Array.isArray(missionHistory.data?.contributors)
                                    ? missionHistory.data.contributors
                                    : []).map((contributor, index) => (
                                    <div key={contributor.userId || index}
                                      className="yh-game-squad-history-contributor">
                                      <span className="yh-game-squad-history-rank">
                                        {index + 1}
                                      </span>
                                      <div>
                                        <strong>
                                          {contributor.displayName ||
                                            'YH Member'}
                                        </strong>
                                        <small>
                                          {contributor.role || 'member'}
                                          {' • '}
                                          {numeric(contributor.events)}
                                          {' events'}
                                        </small>
                                      </div>
                                      <b>
                                        +{numeric(contributor.amount)
                                          .toLocaleString()}
                                      </b>
                                    </div>
                                  ))}
                                  {!missionHistory.data?.contributors?.length && (
                                    <div className="yh-game-squad-history-empty">
                                      No member contributions yet.
                                    </div>
                                  )}
                                </div>
                              </section>

                              <div className="yh-game-squad-history-section-head">
                                <div>
                                  <small>Verified Activity</small>
                                  <h3>Contribution Timeline</h3>
                                </div>
                              </div>
                              {(missionHistory.data?.contributions || [])
                                .map((entry, index) => (
                                  <article key={entry.id || index}
                                    className="yh-game-squad-history-event">
                                    <span className="yh-game-squad-history-event-mark">
                                      +{numeric(entry.amount).toLocaleString()}
                                    </span>
                                    <div>
                                      <strong>
                                        {entry.contributorName || 'YH Member'}
                                      </strong>
                                      <p>
                                        {entry.label ||
                                          'Squad mission contribution'}
                                      </p>
                                      <small>
                                        {formatSquadHistoryTime(
                                          entry.eventAt || entry.createdAt
                                        )}
                                      </small>
                                    </div>
                                  </article>
                                ))}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="yh-game-squad-modal-kicker">
                            Shared Operations
                          </div>
                          <h2>Missions</h2>
                          <div className="yh-game-squad-missions-toolbar">
                            <div className="yh-game-squad-mission-filters">
                              {['all', 'active', 'completed', 'cancelled']
                                .map((status) => (
                                  <button key={status} type="button"
                                    className={
                                      missionFilter === status
                                        ? 'is-active' : ''
                                    }
                                    onClick={() =>
                                      setMissionFilter(status)
                                    }>
                                    {status[0].toUpperCase() +
                                      status.slice(1)}
                                    {' '}
                                    <span>
                                      {(missions?.missions || [])
                                        .filter((m) =>
                                          status === 'all' ||
                                          (m.status || 'active') === status
                                        ).length}
                                    </span>
                                  </button>
                                ))}
                            </div>
                            {missions?.canManage === true && (
                              <button type="button"
                                className="yh-game-squad-primary"
                                onClick={() => openMissionEditor()}>
                                + Create Mission
                              </button>
                            )}
                          </div>
                          <div className="yh-game-squad-missions-list">
                            {(missions?.missions || [])
                              .filter((m) =>
                                missionFilter === 'all' ||
                                (m.status || 'active') === missionFilter
                              ).map((mission) => (
                                <article key={mission.id}
                                  className={
                                    'yh-game-squad-mission-card is-' +
                                    (mission.status || 'active')
                                  }>
                                  <div className="yh-game-squad-mission-head">
                                    <div>
                                      <small>
                                        {String(mission.missionType || 'custom')
                                          .replaceAll('_', ' ')}
                                      </small>
                                      <h3>
                                        {mission.title || 'Squad Mission'}
                                      </h3>
                                    </div>
                                    <span>{mission.status || 'active'}</span>
                                  </div>
                                  {mission.description && (
                                    <p>{mission.description}</p>
                                  )}
                                  <div className="yh-game-squad-mission-progress-head">
                                    <strong>
                                      {numeric(mission.progress)}
                                      {' / '}
                                      {numeric(mission.target) || 1}
                                    </strong>
                                  </div>
                                  <div className="yh-game-squad-mission-actions">
                                    <button type="button"
                                      className="is-history"
                                      onClick={() =>
                                        void openSquadMissionHistory(mission)
                                      }>
                                      View History
                                    </button>
                                    {missions?.canManage === true &&
                                      (mission.status || 'active') ===
                                        'active' && (
                                        <>
                                          <button type="button"
                                            onClick={() =>
                                              openMissionEditor(mission)
                                            }>
                                            Edit
                                          </button>
                                          <button type="button"
                                            className="is-danger"
                                            disabled={missionWorking}
                                            onClick={() =>
                                              void cancelSquadMission(mission)
                                            }>
                                            Cancel Mission
                                          </button>
                                        </>
                                      )}
                                  </div>
                                </article>
                              ))}
                          </div>
                          {missions === null && (
                            <p>Loading Squad missions...</p>
                          )}
                          {missions?.missions?.length === 0 && (
                            <p>No Squad missions yet.</p>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {tab === 'rankings' && (
                    <>
                      <div className="yh-game-squad-modal-kicker">
                        Rankings
                      </div>
                      <div className="yh-game-squad-ranking-grid">
                        <section>
                          <div className="yh-game-squad-member-list-head">
                            Weekly Top Contributors
                          </div>
                          <div className="yh-game-squad-ranking-list">
                            {(Array.isArray(rankings?.weeklyContributors?.contributors)
                              ? rankings.weeklyContributors.contributors
                              : []).slice(0, 5).map((entry, index) => (
                              <div key={entry.userId || index}
                                className="yh-game-squad-ranking-row">
                                <span>{numeric(entry.position)}</span>
                                <div>
                                  <strong>
                                    {entry.displayName ||
                                      entry.username || 'YH Member'}
                                  </strong>
                                  <small>
                                    {numeric(entry.contributionCount)}
                                    {' contributions'}
                                  </small>
                                </div>
                                <b>{numeric(entry.xp).toLocaleString()} XP</b>
                              </div>
                            ))}
                            {rankings && !rankings.weeklyContributors
                              ?.contributors?.length && (
                              <div className="yh-game-squad-empty-members">
                                No weekly contributors yet.
                              </div>
                            )}
                          </div>
                        </section>
                      </div>
                      {[
                        ['Weekly', rankings?.weekly],
                        ['All-Time', rankings?.allTime],
                      ].map(([label, result]) => (
                        <div key={label}>
                          <h3>{label} Rank</h3>
                          {Array.isArray(result?.leaderboard)
                            ? result.leaderboard.map(
                                (entry, index) => (
                                  <p key={entry.id || index}>
                                    #{entry.position || index + 1}
                                    {' '}
                                    {entry.name ||
                                      entry.squadName ||
                                      'Squad'}
                                    {' · '}
                                    {numeric(entry.xp)} XP
                                  </p>
                                ),
                              )
                            : <p>Loading Squad rankings...</p>}
                        </div>
                      ))}
                    </>
                  )}

                  {tab === 'members' && (
                    <div className="yh-game-squad-member-list">
                      <div className="yh-game-squad-member-list-head">
                        Members
                      </div>
                      {Array.isArray(squad.members) &&
                       squad.members.length ? (
                        squad.members.map((member, index) => {
                          const name = clean(
                            member.displayName || member.username
                          ) || 'YH Member'
                          const owner = member.role === 'owner'
                          const captain = member.role === 'captain'
                          return (
                            <div className="yh-game-squad-member-row"
                              key={member.userId || index}>
                              <span>{name.charAt(0).toUpperCase()}</span>
                              <div>
                                <strong>{name}</strong>
                                <small>{member.role || 'member'}</small>
                              </div>
                              {isOwner && !owner && member.userId && (
                                <div className="yh-game-squad-member-actions">
                                  <button type="button" disabled={working}
                                    onClick={() => askManagementAction({
                                      title: captain
                                        ? 'Demote squad captain?'
                                        : 'Make squad captain?',
                                      message: 'Member role will be updated.',
                                      okText: captain ? 'Demote' : 'Make Captain',
                                      method: 'PATCH',
                                      url: '/api/academy/squad/members/' +
                                        encodeURIComponent(member.userId),
                                      body: {
                                        action: captain ? 'demote' : 'promote'
                                      },
                                      ownerOnly: true
                                    })}>
                                    {captain ? 'Demote' : 'Make Captain'}
                                  </button>
                                  <button type="button" className="is-danger"
                                    disabled={working}
                                    onClick={() => askManagementAction({
                                      title: 'Remove squad member?',
                                      message:
                                        'This member will lose access to the squad.',
                                      okText: 'Remove Member',
                                      method: 'PATCH',
                                      url: '/api/academy/squad/members/' +
                                        encodeURIComponent(member.userId),
                                      body: { action: 'remove' },
                                      ownerOnly: true,
                                      tone: 'danger'
                                    })}>
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="yh-game-squad-empty-members">
                          Member roster will appear here.
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'activity' && (
                    <div className="yh-game-squad-contributions">
                      <h3>Activity</h3>
                      {Array.isArray(squad.recentContributions)
                        ? squad.recentContributions.map(
                            (item, index) => (
                              <p key={item.id || index}>
                                {item.contributorName || 'YH Member'}
                                {' · '}
                                {item.label ||
                                  item.description ||
                                  'Squad contribution'}
                                {' · '}
                                {numeric(item.xp)} XP
                              </p>
                            ),
                          )
                        : (
                          <p>
                            Complete Academy missions and
                            check-ins to start building Squad XP.
                          </p>
                        )}
                    </div>
                  )}
                </>
              )}
              {view === 'workspace' && joined && (
                <div className="yh-game-squad-management-actions">
                  {isOwner ? (
                    <button type="button"
                      className="yh-game-squad-danger"
                      disabled={working}
                      onClick={() => askManagementAction({
                        title: 'Disband this squad?',
                        message:
                          'All members will be removed. This action cannot be reversed.',
                        okText: 'Disband Squad',
                        method: 'DELETE',
                        url: '/api/academy/squad',
                        clearSquad: true,
                        ownerOnly: true,
                        tone: 'danger'
                      })}>
                      Disband Squad
                    </button>
                  ) : (
                    <button type="button"
                      className="yh-game-squad-danger"
                      disabled={working}
                      onClick={() => askManagementAction({
                        title: 'Leave this squad?',
                        message:
                          'You will need a new invitation code to join again.',
                        okText: 'Leave Squad',
                        method: 'POST',
                        url: '/api/academy/squad/leave',
                        clearSquad: true,
                        tone: 'danger'
                      })}>
                      Leave Squad
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  const confirmation = pendingAction
    ? createPortal(
        <div className="yh-confirm-overlay" role="dialog"
          aria-modal="true" aria-labelledby="yh-confirm-title">
          <div className="yh-confirm-card">
            <div className="yh-confirm-header">
              <div id="yh-confirm-title" className="yh-confirm-title">
                {pendingAction.title}
              </div>
              <button type="button" className="yh-confirm-x"
                aria-label="Close" disabled={working}
                onClick={() => setPendingAction(null)}>✕</button>
            </div>
            <div className="yh-confirm-message">
              {pendingAction.message}
            </div>
            <div className="yh-confirm-actions">
              <button type="button"
                className="btn-secondary yh-confirm-cancel"
                disabled={working}
                onClick={() => setPendingAction(null)}>Cancel</button>
              <button type="button"
                className={'btn-primary yh-confirm-ok' +
                  (pendingAction.tone === 'danger' ? ' is-danger' : '')}
                disabled={working}
                onClick={() => void executeManagementAction()}>
                {working ? 'Working...' : pendingAction.okText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <article className="yh-game-side-card yh-game-squad-card">
        <div className="yh-game-side-card-head">
          <div>
            <small>Squad System</small>
            <h3>
              {joined
                ? squad.name
                : !approved
                  ? 'Squad Locked'
                  : squadPayload == null
                    ? 'Loading Squad'
                    : 'No Squad Yet'}
            </h3>
          </div>
          <span className="yh-game-preview-badge">
            {joined
              ? (squadPayload?.membership?.role ||
                  squad.role ||
                  'member')
              : approved ? 'Live' : 'Locked'}
          </span>
        </div>

        <p>
          {joined
            ? `${members} of ${slots} members • ` +
              `${numeric(squad.totalXp).toLocaleString()} XP`
            : 'Create or join a small Academy team for shared missions, contracts, operations, and squad rankings.'}
        </p>

        <div
          className="yh-game-squad-slots"
          aria-label={
            `${members} of ${slots} squad positions filled`
          }
        >
          {Array.from(
            { length: Math.min(slots, 30) },
            (_, index) => (
              <span
                key={index}
                className={
                  joined && index < members
                    ? 'is-filled'
                    : ''
                }
              >
                {joined && index < members ? '●' : '+'}
              </span>
            ),
          )}
        </div>

        {joined && (
          <div className="yh-game-squad-live-meta">
            <div>
              <small>
                Level {numeric(squad.level) || 1}
              </small>
              <strong>
                {numeric(squad.weeklyXp).toLocaleString()}
                {' '}weekly XP
              </strong>
            </div>
            <div>
              <small>Invite Code</small>
              <strong>
                {squad.inviteCode || 'Unavailable'}
              </strong>
            </div>
          </div>
        )}

        {joined ? (
          <button
            type="button"
            className={
              'yh-game-squad-primary ' +
              'yh-game-squad-card-main-action'
            }
            onClick={() => void openWorkspace()}
          >
            Open Squad
          </button>
        ) : (
          <div className="yh-game-squad-card-actions">
            <button
              type="button"
              className="yh-game-squad-primary"
              disabled={!approved}
              onClick={() => open('create')}
            >
              Create Squad
            </button>
            <button
              type="button"
              className="yh-game-squad-secondary"
              disabled={!approved}
              onClick={() => open('search')}
            >
              Search for Squad
            </button>
          </div>
        )}
      </article>
      {modal}
      {confirmation}
    </>
  )
}
