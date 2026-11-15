import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  createPlazaNotification,
} from './plazaNotifications'
import {
  readPlazaUiState,
  updatePlazaUiState,
} from './plazaUiState'
import './PlazaInboxWorkspace.css'

const INBOX_KEY =
  'yhPlazaInboxCleanV1'

const CONVERSATIONS_KEY =
  'yhPlazaConversationsCleanV1'

const ROLES = [
  ['all', 'All queues'],
  ['personal', 'Personal'],
  [
    'project-owner',
    'Project Owner',
  ],
  [
    'project-manager',
    'Project Manager',
  ],
  ['hr', 'HR'],
  ['plaza-ops', 'Plaza Ops'],
  [
    'system-admin',
    'YH System Admin',
  ],
]

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function normalizeRole(
  value = '',
) {
  const raw =
    clean(value).toLowerCase()

  if (
    raw === 'project-owner' ||
    raw === 'project owner'
  ) {
    return 'project-owner'
  }

  if (
    raw === 'project-manager' ||
    raw === 'project manager'
  ) {
    return 'project-manager'
  }

  if (raw === 'hr') {
    return 'hr'
  }

  if (
    raw === 'plaza-ops' ||
    raw === 'plaza ops'
  ) {
    return 'plaza-ops'
  }

  if (
    raw === 'system-admin' ||
    raw === 'system admin'
  ) {
    return 'system-admin'
  }

  return 'personal'
}

function roleLabel(
  role = '',
) {
  return (
    ROLES.find(
      ([key]) =>
        key ===
        normalizeRole(role),
    )?.[1] ||
    'Personal'
  )
}

function normalizeStatus(value = '') {
  const raw = clean(value)
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (raw === 'draft') return 'Draft'
  if (raw === 'submitted' || raw === 'open') return 'Submitted'
  if (raw === 'new') return 'New'

  if (
    raw === 'under review' ||
    raw === 'pending review' ||
    raw === 'review'
  ) return 'Under Review'

  if (raw === 'matched') return 'Matched'

  if (
    raw === 'conversation opened' ||
    raw === 'conversation'
  ) return 'Conversation Opened'

  if (
    raw === 'closed' ||
    raw === 'completed'
  ) return 'Closed'

  return 'New'
}

function normalizeKind(
  value = '',
) {
  const raw =
    clean(value).toLowerCase()

  if (
    raw === 'application'
  ) {
    return 'application'
  }

  if (
    raw ===
      'support-note' ||
    raw ===
      'support note'
  ) {
    return 'support-note'
  }

  return 'request'
}

function kindLabel(
  value = '',
) {
  const kind =
    normalizeKind(value)

  if (
    kind === 'application'
  ) {
    return 'Application'
  }

  if (
    kind ===
    'support-note'
  ) {
    return 'Support Note'
  }

  return 'Incoming Request'
}

function normalizeInboxObjective(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "Connection request";
  if (raw.includes("intro")) return "Introduction";
  if (raw.includes("collab")) return "Collaboration";
  if (raw.includes("partner")) return "Partnership";
  if (raw.includes("access")) return "Access";
  if (raw.includes("hir")) return "Hiring";
  if (raw.includes("support")) return "Support";
  if (raw.includes("project")) return "Project request";
  if (raw.includes("regional") || raw.includes("region")) return "Regional connection";
  if (raw.includes("bridge")) return "Bridge request";

  return "Connection request";
}

function resolveInboxQueueRole(request, extraMeta = {}) {
  if (extraMeta.forceQueueRole) {
    return normalizeRole(extraMeta.forceQueueRole);
  }

  const sourceType = String(request?.sourceType || "").trim().toLowerCase();
  const objective = normalizeInboxObjective(request?.objective || "Connection request");
  const context = String(request?.context || "").trim().toLowerCase();

  if (extraMeta.kind === "support-note") return "personal";
  if (objective === "Hiring" || context.includes("hiring")) return "hr";
  if (sourceType === "project" || objective === "Project request" || objective === "Collaboration") return "project-manager";
  if (objective === "Partnership" || objective === "Access") return "project-owner";
  if (sourceType === "member-screened" || sourceType === "member-bridge" || sourceType === "bridge" || objective === "Bridge request" || objective === "Regional connection") return "plaza-ops";
  if (sourceType === "member-connection" || sourceType === "feed-introduction") return "personal";
  if (sourceType === "general" && !String(request?.targetId || "").trim()) return "plaza-ops";
  return "personal";
}

function normalizeInboxItem(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `incoming-${index + 1}`,

    kind:
      normalizeKind(
        item.kind,
      ),

    linkedRequestId:
      clean(
        item.linkedRequestId,
      ),

    conversationId:
      clean(
        item.conversationId,
      ),

    queueRole:
      normalizeRole(
        item.queueRole,
      ),

    title:
      clean(item.title) ||
      'Incoming Plaza item',

    summary:
      clean(item.summary),

    senderName:
      clean(
        item.senderName,
      ) ||
      'Unknown sender',

    targetLabel:
      clean(
        item.targetLabel,
      ) ||
      'Plaza',

    region:
      clean(item.region),

    routeLabel:
      clean(
        item.routeLabel,
      ),

    status:
      normalizeStatus(
        item.status,
      ),

    attachments:
      safeArray(
        item.attachments,
      ),

    createdAt:
      clean(item.createdAt) ||
      new Date().toISOString(),

    updatedAt:
      clean(
        item.updatedAt ||
          item.createdAt,
      ) ||
      new Date().toISOString(),
  }
}

function readInbox() {
  try {
    return safeArray(
      JSON.parse(
        localStorage.getItem(
          INBOX_KEY,
        ) ||
          '[]',
      ),
    ).map(
      normalizeInboxItem,
    )
  } catch {
    return []
  }
}

function writeInbox(
  items,
) {
  try {
    localStorage.setItem(
      INBOX_KEY,
      JSON.stringify(items),
    )
  } catch {}
}

function readConversations() {
  try {
    return safeArray(
      JSON.parse(
        localStorage.getItem(
          CONVERSATIONS_KEY,
        ) ||
          '[]',
      ),
    )
  } catch {
    return []
  }
}

function writeConversations(
  items,
) {
  try {
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify(items),
    )
  } catch {}
}

function currentLaneNote(item) {
  if (item.status === 'Draft') {
    return 'Draft request. Submit it through Plaza Requests before review.'
  }

  if (item.status === 'New' || item.status === 'Submitted') {
    return item.kind === 'support-note'
      ? 'Delivered but not yet acknowledged or converted to conversation.'
      : 'Submitted and waiting for the assigned operator to review.'
  }

  if (item.status === 'Under Review') {
    return 'A queue owner is reviewing the request.'
  }

  if (item.status === 'Matched') {
    return 'The request is matched and awaiting conversation approval.'
  }

  if (item.status === 'Conversation Opened') {
    return 'The request has progressed to a Plaza conversation.'
  }

  return 'This intake item is closed.'
}

export default function PlazaInboxWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const [items, setItems] = useState(() => readInbox())
  const [serverRequests, setServerRequests] = useState([])
  const [serverError, setServerError] = useState('')
  const [serverLoading, setServerLoading] = useState(true)

  /* PHASE2 — SERVER-AUTHORITATIVE REQUEST INBOX */
  useEffect(() => {
    let active = true
    let pending = false

    const refresh = async () => {
      if (!active || pending || document.hidden) return
      pending = true

      try {
        const result = await apiFetch(
          '/api/plaza/requests?limit=200',
          { method: 'GET', cache: 'no-store' }
        )

        if (
          result?.success !== true ||
          !Array.isArray(result.requests)
        ) {
          throw Error('Invalid Plaza requests response.')
        }

        if (active) {
          setServerRequests(
            result.requests.filter(item => item?.id)
          )
          setServerError('')
        }
      } catch (error) {
        if (active) {
          setServerError(
            error?.message || 'Cannot load saved Plaza requests.'
          )
        }
      } finally {
        pending = false
        if (active) setServerLoading(false)
      }
    }

    void refresh()

    const interval = window.setInterval(refresh, 45000)
    window.addEventListener('focus', refresh)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const serverItems = useMemo(
     () => serverRequests
      .filter(request =>
        clean(request.status).toLowerCase() !== 'draft'
      )
      .map(request =>
      normalizeInboxItem({
        id: 'server:' + request.id,
        storageSource: 'server',
        serverId: String(request.id),
        serverVersion: request.updatedAt,
        linkedRequestId: String(request.id),
        conversationId: request.conversationId || '',
        kind: 'request',
        queueRole: resolveInboxQueueRole(request),
        title: request.title || request.subject,
        summary:
          request.summary ||
          request.description ||
          request.message,
        senderName: request.authorName,
        targetLabel: request.targetLabel,
        region: request.region,
        routeLabel: request.routeLabel,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      })
    ),
    [serverRequests]
  )

  const inboxItems = useMemo(() => {
    const requestIds = new Set(
      serverItems.map(item => item.linkedRequestId)
    )

    return [
      ...serverItems,
      ...items.filter(item =>
        !item.linkedRequestId ||
        !requestIds.has(item.linkedRequestId)
      )
    ]
  }, [items, serverItems])

  const [
    role,
    setRole,
  ] = useState(
    () => {
      const saved =
        clean(
          readPlazaUiState()
            .activeInboxRole,
        )

      return ROLES.some(
        ([key]) =>
          key === saved,
      )
        ? saved
        : 'all'
    },
  )

  const [
    selected,
    setSelected,
  ] = useState(null)

  const [
    busy,
    setBusy,
  ] = useState('')

  useEffect(() => {
    let targetId = ''

    try {
      targetId =
        sessionStorage.getItem(
          'yh_plaza_open_inbox_id',
        ) || ''

      if (targetId) {
        sessionStorage.removeItem(
          'yh_plaza_open_inbox_id',
        )
      }
    } catch {}

    if (!targetId) {
      return
    }

    const target =
      inboxItems.find(
        (item) =>
          item.id ===
          targetId,
      )

    if (target) {
      setSelected(
        target,
      )
    }
  }, [inboxItems])

  const visible =
    useMemo(
      () =>
        inboxItems
          .filter(
            (item) =>
              role ===
                'all' ||
              item.queueRole ===
                role,
          )
          .sort(
            (a, b) =>
              new Date(
                b.updatedAt,
              ).getTime() -
              new Date(
                a.updatedAt,
              ).getTime(),
          ),
      [inboxItems, role],
    )

  const activeCount =
    inboxItems.filter(
      (item) =>
        item.status !==
        'Closed',
    ).length

  const conversationCount =
    inboxItems.filter(
      (item) =>
        Boolean(
          item.conversationId,
        ),
    ).length

  const applicationCount =
    inboxItems.filter(
      (item) =>
        item.kind ===
        'application',
    ).length

  const persistItems =
    (next) => {
      setItems(next)
      writeInbox(next)
    }

  const updateItem =
    (
      id,
      patch,
    ) => {
      const previous =
        items.find(
          (item) =>
            item.id === id,
        ) || null

      const now =
        new Date().toISOString()

      const next =
        items.map(
          (item) =>
            item.id === id
              ? normalizeInboxItem({
                  ...item,
                  ...patch,
                  updatedAt:
                    now,
                })
              : item,
        )

      persistItems(
        next,
      )

      const updated =
        next.find(
          (item) =>
            item.id ===
            id,
        )

      if (
        selected?.id ===
        id
      ) {
        setSelected(
          updated ||
            null,
        )
      }

      /* PLAZA_INBOX_REROUTE_NOTIFICATION */
      if (
        updated &&
        patch?.queueRole &&
        updated.queueRole !==
          previous?.queueRole
      ) {
        createPlazaNotification({
          title:
            'Inbox item rerouted',

          text:
            `${updated.title} moved to ${roleLabel(updated.queueRole)}.`,

          audienceRole:
            updated.queueRole,

          relatedType:
            'inbox',

          relatedId:
            updated.id,
        })
      }

      return updated
    }

  /* PHASE2 — CONFIRMED SUPABASE STATUS TRANSITIONS */
  const updateStatus = async (item, status) => {
    if (!item || busy) return

    if (!item.serverId) {
      updateItem(item.id, { status })
      onToast?.(
        'Updated in this browser only. Not synced to Supabase.',
        'error'
      )
      return
    }

    if (!item.serverVersion) {
      onToast?.(
        'Request version unavailable. Refresh and retry.',
        'error'
      )
      return
    }

    setBusy('status:' + item.id)

    try {
      const result = await apiFetch(
        '/api/plaza/requests/' +
          encodeURIComponent(item.serverId) +
          '/status',
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            expectedUpdatedAt: item.serverVersion
          })
        }
      )

      if (
        result?.success !== true ||
        String(result.request?.id) !== item.serverId
      ) {
        throw Error(
          'Supabase did not confirm the updated request status.'
        )
      }

      setServerRequests(current => current.map(row =>
        String(row.id) === item.serverId
          ? result.request
          : row
      ))

      setSelected(null)
      onToast?.('Request status saved to Supabase.', 'success')
    } catch (error) {
      onToast?.(
        error?.message || 'Could not save request status.',
        'error'
      )
    } finally {
      setBusy('')
    }
  }

  const openConversation =
    (
      conversationId,
    ) => {
      try {
        sessionStorage.setItem(
          'yh_plaza_open_conversation_id',
          conversationId,
        )
      } catch {}

      onWorkspaceOpen?.(
        'plazas-conversations',
      )
    }

  const createConversation =
    async (item) => {
      if (
        item.conversationId
      ) {
        openConversation(
          item.conversationId,
        )
        return
      }

      if (
        item.serverId &&
        item.status !== 'Conversation Opened'
      ) {
        onToast?.(
          'Move the saved request through review and matched to Conversation Opened first.',
          'error'
        )
        return
      }

      if (busy) return

      setBusy(
        `conversation:${item.id}`,
      )

      try {
        /* YHU_PLAZA_PHASE2_CONFIRMED_INBOX_CONVERSATION */
        if (!item.linkedRequestId) {
          throw Error(
            'This Inbox item has no saved Plaza request. No conversation was created.'
          )
        }

        const result = await apiFetch(
          '/api/plaza/messages/from-request/' +
            encodeURIComponent(item.linkedRequestId),
          {
            method: 'POST',
            body: JSON.stringify({})
          }
        )

        const conversation = result?.conversation

        if (!conversation?.id) {
          throw Error(
            'Backend did not confirm the saved conversation.'
          )
        }

        if (item.serverId) {
          setServerRequests(current => current.map(row =>
            String(row.id) === item.serverId
              ? { ...row, conversationId: conversation.id }
              : row
          ))
        } else {
          updateItem(item.id, {
            conversationId: conversation.id,
            status: 'Conversation Opened'
          })
        }

        /* PLAZA_CONVERSATION_OPENED_NOTIFICATION */
        createPlazaNotification({
          title:
            'Conversation opened',

          text:
            `${conversation.title} is now live inside Messages.`,

          audienceRole:
            item.queueRole,

          relatedType:
            'conversation',

          relatedId:
            conversation.id,
        })

        onToast?.(
          'Conversation opened from Plaza intake.',
          'success',
        )

        openConversation(
          conversation.id,
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not open Plaza conversation.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-inbox-react-workspace"
      data-yh-dashboard-react-surface="plazas-inbox"
    >
      <div className="yh-plaza-inbox-react-scroll">
        <div className="yh-plaza-inbox-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Inbox
              </span>

              <h1>
                Incoming Plaza Work
              </h1>

              <p>
                Queue-owned
                applications,
                requests, support
                notes and intake
                items before they
                become structured
                Plaza
                conversations.
              </p>
            </div>
          </header>

          {serverLoading && (
            <div className="yh-plaza-react-state">
              Loading Supabase Plaza requests...
            </div>
          )}

          {serverError && (
            <div
              className="yh-plaza-react-state is-error"
              role="status"
            >
              Supabase requests unavailable: {serverError}.
              Browser-only items are still visible.
            </div>
          )}

          <section className="yh-plaza-inbox-summary">
            <article>
              <small>
                Open Intake
              </small>

              <strong>
                {
                  activeCount
                }
              </strong>
            </article>

            <article>
              <small>
                Applications
              </small>

              <strong>
                {
                  applicationCount
                }
              </strong>
            </article>

            <article>
              <small>
                Conversations
              </small>

              <strong>
                {
                  conversationCount
                }
              </strong>
            </article>
          </section>

          <div className="yh-plaza-inbox-role-row">
            {ROLES.map(
              ([
                key,
                label,
              ]) => {
                const count =
                  key ===
                  'all'
                    ? inboxItems.length
                    : inboxItems.filter(
                        (
                          item,
                        ) =>
                          item.queueRole ===
                          key,
                      ).length

                return (
                  <button
                    type="button"
                    key={key}
                    className={
                      role ===
                      key
                        ? 'is-active'
                        : ''
                    }
                    onClick={() => {
                      setRole(
                        key,
                      )

                      updatePlazaUiState({
                        activeInboxRole:
                          key,
                      })
                    }}
                  >
                    <span>
                      {label}
                    </span>

                    <b>
                      {count}
                    </b>
                  </button>
                )
              },
            )}
          </div>

          {!visible.length && (
            <div className="yh-plaza-react-state">
              No incoming Plaza
              work is visible in
              this lane yet.
            </div>
          )}

          <div className="yh-plaza-inbox-grid-react">
            {visible.map(
              (item) => (
                <article
                  className="yh-plaza-inbox-card-react"
                  key={
                    item.id
                  }
                >
                  <div className="yh-plaza-inbox-card-head-react">
                    <div>
                      <span>
                        {roleLabel(
                          item.queueRole,
                        )}
                      </span>

                      <span>
                        {kindLabel(
                          item.kind,
                        )}
                      </span>
                    </div>

                    <strong>
                      {
                        item.status
                      }
                    </strong>
                  </div>

                  <h3>
                    {
                      item.title
                    }
                  </h3>

                  <p>
                    {item.summary ||
                      'No intake summary added yet.'}
                  </p>

                  <div className="yh-plaza-inbox-meta-react">
                    <span>
                      {
                        item.senderName
                      }
                    </span>

                    <span>
                      {
                        item.targetLabel
                      }
                    </span>

                    <span>
                      {item.region ||
                        'No region'}
                    </span>

                    <span>
                      {item.routeLabel ||
                        'Plaza intake'}
                    </span>
                  </div>

                  <div className="yh-plaza-inbox-lane-note">
                    <strong>
                      Current lane
                    </strong>

                    <span>
                      {currentLaneNote(
                        item,
                      )}
                    </span>
                  </div>

                  <div className="yh-plaza-inbox-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setSelected(
                          item,
                        )
                      }
                    >
                      Open Intake
                    </button>

                    {item.conversationId && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          openConversation(
                            item.conversationId,
                          )
                        }
                      >
                        Open Conversation
                      </button>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content yh-plaza-inbox-detail-modal">
            <span className="yh-plaza-react-kicker">
              {kindLabel(
                selected.kind,
              )}
            </span>

            <h2>
              {
                selected.title
              }
            </h2>

            <p>
              {selected.summary ||
                'No intake summary added yet.'}
            </p>

            <div className="yh-plaza-inbox-detail-meta">
              <span>
                Queue:{' '}
                {roleLabel(
                  selected.queueRole,
                )}
              </span>

              <span>
                Status:{' '}
                {
                  selected.status
                }
              </span>

              <span>
                Target:{' '}
                {
                  selected.targetLabel
                }
              </span>
            </div>

            <label>
              <span>
                Route Queue
              </span>

              <select
                className="input-field"
                value={
                  selected.queueRole
                }
                disabled={
                  Boolean(selected.serverId) || Boolean(busy)
                }
                title={
                  selected.serverId
                    ? 'Queue reassignment requires an authorized server route.'
                    : 'Legacy browser-only routing'
                }
                onChange={(
                  event,
                ) => {
                  const updated =
                    updateItem(
                      selected.id,
                      {
                        queueRole:
                          event
                            .target
                            .value,
                      },
                    )

                  setSelected(
                    updated,
                  )

                  onToast?.(
                    'Browser-only queue change; not saved to Supabase.',
                    'success',
                  )
                }}
              >
                {ROLES.filter(
                  ([key]) =>
                    key !==
                    'all',
                ).map(
                  ([
                    key,
                    label,
                  ]) => (
                    <option
                      key={
                        key
                      }
                      value={
                        key
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="yh-plaza-inbox-modal-actions">
              {['New', 'Submitted'].includes(
                selected.status,
              ) && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateStatus(selected, 'Under Review')
                  }
                >
                  Start Review
                </button>
              )}

              {selected.status === 'Under Review' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateStatus(selected, 'Matched')
                  }
                >
                  Mark Matched
                </button>
              )}

              {selected.status === 'Matched' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateStatus(selected, 'Conversation Opened')
                  }
                >
                  Approve Conversation
                </button>
              )}

              {selected.status !== 'Closed' &&
                (Boolean(selected.conversationId) ||
                  (Boolean(selected.linkedRequestId) &&
                    (!selected.serverId ||
                      selected.status === 'Conversation Opened'))) && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    Boolean(
                      busy,
                    )
                  }
                  onClick={() =>
                    void createConversation(
                      selected,
                    )
                  }
                >
                  {busy ===
                  `conversation:${selected.id}`
                    ? 'Opening...'
                    : selected.conversationId
                      ? 'Open Conversation'
                      : 'Open Conversation'}
                </button>
              )}

              {selected.status !==
                'Closed' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void updateStatus(selected, 'Closed')
                  }
                >
                  Close Intake
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
