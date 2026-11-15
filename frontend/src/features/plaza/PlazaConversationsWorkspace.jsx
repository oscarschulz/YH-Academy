import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../services/api/apiClient'
import {
  createPlazaNotification,
} from './plazaNotifications'
import './PlazaConversationsWorkspace.css'

const LOCAL_CONVERSATIONS_KEY =
  'yhPlazaConversationsCleanV1'

const SEEN_KEY =
  'yhPlazaConversationSeenAtV1'

const SEEN_BOOTSTRAPPED_KEY =
  'yhPlazaConversationSeenBootstrappedV1'

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function storedToken() {
  try {
    return clean(
      sessionStorage.getItem(
        'yh_token',
      ) ||
        localStorage.getItem(
          'yh_token',
        ) ||
        sessionStorage.getItem(
          'token',
        ) ||
        localStorage.getItem(
          'token',
        ),
    )
  } catch {
    return ''
  }
}

function queueRole(
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
    raw === 'system admin' ||
    raw === 'yh system admin'
  ) {
    return 'system-admin'
  }

  return 'personal'
}

function queueLabel(
  value = '',
) {
  const role =
    queueRole(value)

  if (
    role ===
    'project-owner'
  ) {
    return 'Project Owner'
  }

  if (
    role ===
    'project-manager'
  ) {
    return 'Project Manager'
  }

  if (role === 'hr') {
    return 'HR'
  }

  if (
    role === 'plaza-ops'
  ) {
    return 'Plaza Ops'
  }

  if (
    role ===
    'system-admin'
  ) {
    return 'YH System Admin'
  }

  return 'Personal'
}

function normalizeMessage(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `message-${index + 1}`,

    sender:
      clean(item.sender) ||
      'System',

    type:
      clean(item.type) ||
      'message',

    text:
      clean(item.text),

    createdAt:
      clean(item.createdAt) ||
      new Date().toISOString(),
  }
}

function normalizeConversation(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `conversation-${index + 1}`,

    title:
      clean(item.title) ||
      'Plaza conversation',

    queueRole:
      queueRole(
        item.queueRole,
      ),

    linkedRequestId:
      clean(
        item.linkedRequestId,
      ),

    linkedInboxId:
      clean(
        item.linkedInboxId,
      ),

    targetLabel:
      clean(item.targetLabel) ||
      'Plaza',

    contextTitle:
      clean(
        item.contextTitle,
      ),

    contextRoute:
      clean(
        item.contextRoute,
      ) ||
      'Plaza conversation',

    scope:
      clean(item.scope),

    sourceDivision:
      clean(
        item.sourceDivision,
      ),

    targetDivision:
      clean(
        item.targetDivision,
      ),

    businessPurpose:
      clean(
        item.businessPurpose,
      ),

    moderation:
      item.moderation &&
      typeof item.moderation ===
        'object'
        ? item.moderation
        : {},

    blockedBy:
      item.blockedBy &&
      typeof item.blockedBy ===
        'object'
        ? item.blockedBy
        : {},

    participants:
      safeArray(
        item.participants,
      ).map(String),

    status:
      clean(item.status) ||
      'active',

    messages:
      safeArray(
        item.messages,
      ).map(
        normalizeMessage,
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

function readLocalConversations() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          LOCAL_CONVERSATIONS_KEY,
        ) ||
          '[]',
      )

    return safeArray(
      parsed,
    ).map(
      normalizeConversation,
    )
  } catch {
    return []
  }
}

function writeLocalConversations(
  conversations,
) {
  try {
    localStorage.setItem(
      LOCAL_CONVERSATIONS_KEY,
      JSON.stringify(
        conversations,
      ),
    )
  } catch {}
}

function readSeenMap() {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          SEEN_KEY,
        ) ||
          '{}',
      )

    return value &&
      typeof value ===
        'object' &&
      !Array.isArray(value)
      ? value
      : {}
  } catch {
    return {}
  }
}

function writeSeenMap(map) {
  try {
    localStorage.setItem(
      SEEN_KEY,
      JSON.stringify(map),
    )
  } catch {}
}

function bootstrapSeenBaseline(
  conversations = [],
) {
  try {
    if (
      localStorage.getItem(
        SEEN_BOOTSTRAPPED_KEY,
      ) === '1'
    ) {
      return
    }

    if (
      !conversations.length
    ) {
      return
    }

    const seen =
      readSeenMap()

    const now =
      new Date()
        .toISOString()

    conversations.forEach(
      (conversation) => {
        const id =
          clean(
            conversation?.id,
          )

        if (!id) {
          return
        }

        seen[id] =
          now
      },
    )

    writeSeenMap(
      seen,
    )

    localStorage.setItem(
      SEEN_BOOTSTRAPPED_KEY,
      '1',
    )
  } catch {}
}

function latestTimestamp(
  conversation,
) {
  const messages =
    safeArray(
      conversation.messages,
    )

  const last =
    messages[
      messages.length - 1
    ]

  return (
    clean(
      last?.createdAt,
    ) ||
    clean(
      conversation.updatedAt,
    ) ||
    clean(
      conversation.createdAt,
    )
  )
}

function timestamp(
  value = '',
) {
  const result =
    new Date(value).getTime()

  return Number.isFinite(
    result,
  )
    ? result
    : 0
}

function isUnread(
  conversation,
) {
  const seen =
    readSeenMap()

  return (
    timestamp(
      latestTimestamp(
        conversation,
      ),
    ) >
    timestamp(
      seen[
        conversation.id
      ] ||
        '',
    )
  )
}

function markSeen(
  conversation,
) {
  const seen =
    readSeenMap()

  seen[
    conversation.id
  ] =
    latestTimestamp(
      conversation,
    ) ||
    new Date().toISOString()

  writeSeenMap(seen)
}

function formatDate(
  value = '',
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function isLocked(
  conversation = {},
) {
  const status =
    clean(
      conversation.status,
    ).toLowerCase()

  const moderation =
    conversation.moderation ||
    {}

  const blockedBy =
    conversation.blockedBy ||
    {}

  return (
    [
      'closed',
      'archived',
      'blocked',
    ].includes(status) ||
    moderation.closed ===
      true ||
    moderation.blocked ===
      true ||
    Object.values(
      blockedBy,
    ).some(Boolean)
  )
}

function mergeConversations(
  server,
  local,
) {
  const map =
    new Map()

  ;[
    ...local,
    ...server,
  ].forEach(
    (conversation) => {
      const normalized =
        normalizeConversation(
          conversation,
        )

      map.set(
        normalized.id,
        normalized,
      )
    },
  )

  return Array.from(
    map.values(),
  ).sort(
    (a, b) =>
      timestamp(
        latestTimestamp(b),
      ) -
      timestamp(
        latestTimestamp(a),
      ),
  )
}

export default function PlazaConversationsWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const socketRef =
    useRef(null)

  const [
    serverConversations,
    setServerConversations,
  ] = useState([])

  /* YHU_PLAZA_SOCKET_STABLE_LIFECYCLE */
  const serverConversationsRef = useRef(serverConversations)

  useEffect(() => {
    serverConversationsRef.current = serverConversations
  }, [serverConversations])

  const [
    localConversations,
    setLocalConversations,
  ] = useState(() =>
    readLocalConversations(),
  )

  const [
    activeId,
    setActiveId,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    reply,
    setReply,
  ] = useState('')

  const [
    sending,
    setSending,
  ] = useState(false)

  const [
    safetyBusy,
    setSafetyBusy,
  ] = useState('')

  const [
    reportOpen,
    setReportOpen,
  ] = useState(false)

  const [
    reportForm,
    setReportForm,
  ] = useState({
    reason: '',
    details: '',
  })

  const conversations =
    useMemo(
      () =>
        mergeConversations(
          serverConversations,
          localConversations,
        ),
      [
        serverConversations,
        localConversations,
      ],
    )

  useEffect(() => {
    bootstrapSeenBaseline(
      conversations,
    )
  }, [conversations])

  const activeConversation =
    useMemo(
      () =>
        conversations.find(
          (item) =>
            item.id ===
            activeId,
        ) ||
        null,
      [
        conversations,
        activeId,
      ],
    )

  const localIds =
    useMemo(
      () =>
        new Set(
          localConversations.map(
            (item) =>
              item.id,
          ),
        ),
      [localConversations],
    )

  const upsertServer =
    useCallback(
      (
        conversation,
      ) => {
        if (!conversation) {
          return
        }

        const normalized =
          normalizeConversation(
            conversation,
          )

        setServerConversations(
          (current) => [
            normalized,
            ...current.filter(
              (item) =>
                item.id !==
                normalized.id,
            ),
          ],
        )
      },
      [],
    )

  const joinConversation =
    useCallback(
      (
        conversationId,
      ) => {
        const socket =
          socketRef.current

        const id =
          clean(
            conversationId,
          )

        if (
          !socket ||
          !id
        ) {
          return
        }

        socket.emit(
          'joinBusinessChat',
          {
            conversationId:
              id,
          },
          (
            response = {},
          ) => {
            if (
              response?.success &&
              response
                ?.conversation
            ) {
              upsertServer(
                response.conversation,
              )
            }
          },
        )
      },
      [upsertServer],
    )

  const loadConversations =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        try {
          const result =
            await apiFetch(
              '/api/plaza/messages?limit=160',
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          const normalized =
            safeArray(
              result?.conversations,
            ).map(
              normalizeConversation,
            )

          setServerConversations(
            normalized,
          )

          normalized.forEach(
            (conversation) =>
              joinConversation(
                conversation.id,
              ),
          )
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Could not load Plazas messages. Please refresh.',
            'error',
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [
        joinConversation,
        onToast,
      ],
    )

  useEffect(() => {
    const token =
      storedToken()

    const socket =
      io({
        withCredentials:
          true,

        transports: [
          'websocket',
          'polling',
        ],

        auth: token
          ? {
              token,
            }
          : {},
      })

    socketRef.current =
      socket

    socket.on(
      'connect',
      () => {
        serverConversationsRef.current.forEach(
          (
            conversation,
          ) =>
            joinConversation(
              conversation.id,
            ),
        )
      },
    )

    socket.on(
      'businessChatSnapshot',
      (
        payload = {},
      ) => {
        if (
          payload.conversation
        ) {
          upsertServer(
            payload.conversation,
          )
        }
      },
    )

    socket.on(
      'businessChatUpdated',
      (
        payload = {},
      ) => {
        if (
          payload.conversation
        ) {
          upsertServer(
            payload.conversation,
          )
        }
      },
    )

    socket.on(
      'businessChatError',
      (
        payload = {},
      ) => {
        if (
          payload?.message
        ) {
          onToast?.(
            payload.message,
            'error',
          )
        }
      },
    )

    return () => {
      socket.off(
        'connect',
      )

      socket.off(
        'businessChatSnapshot',
      )

      socket.off(
        'businessChatUpdated',
      )

      socket.off(
        'businessChatError',
      )

      socket.disconnect()

      socketRef.current =
        null
    }
  }, [
    joinConversation,
    onToast,
    upsertServer,
  ])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    let id = ''

    try {
      id =
        clean(
          sessionStorage.getItem(
            'yh_plaza_open_conversation_id',
          ),
        )

      sessionStorage.removeItem(
        'yh_plaza_open_conversation_id',
      )
    } catch {}

    if (id) {
      setActiveId(id)
    }
  }, [])

  useEffect(() => {
    if (
      activeConversation
    ) {
      markSeen(
        activeConversation,
      )

      joinConversation(
        activeConversation.id,
      )
    }
  }, [
    activeConversation,
    joinConversation,
  ])

  const unreadCount =
    conversations.filter(
      isUnread,
    ).length

  const openConversation =
    (conversation) => {
      setActiveId(
        conversation.id,
      )

      markSeen(
        conversation,
      )
    }

  const persistLocal =
    (
      next,
    ) => {
      setLocalConversations(
        next,
      )

      writeLocalConversations(
        next,
      )
    }

  /* YHU_PLAZA_PHASE2_SERVER_CONFIRMED_REPLIES */
  const sendReply = async (event) => {
    event.preventDefault()

    const conversation = activeConversation
    const text = clean(reply)

    if (!conversation || !text || sending) return

    if (isLocked(conversation)) {
      onToast?.('Conversation is closed or blocked.', 'error')
      return
    }

    const serverRecord = serverConversations.some(
      item => item.id === conversation.id
    )

    if (!serverRecord) {
      onToast?.(
        'This conversation is browser-only. No reply was sent. Open a server-backed Plaza conversation.',
        'error'
      )
      return
    }

    setSending(true)

    try {
      const result = await apiFetch(
        '/api/plaza/messages/' +
          encodeURIComponent(conversation.id) +
          '/replies',
        {
          method: 'POST',
          body: JSON.stringify({ text })
        }
      )

      if (
        !result?.conversation?.id ||
        String(result.conversation.id) !== String(conversation.id)
      ) {
        throw Error('Backend did not confirm the saved reply.')
      }

      upsertServer(result.conversation)
      setReply('')
      onToast?.('Plaza reply saved to the server.', 'success')
    } catch (error) {
      onToast?.(
        error?.message || 'Could not save Plaza reply.',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  const runSafetyAction =
    async (
      action,
      payload = {},
    ) => {
      const conversation =
        activeConversation

      if (
        !conversation ||
        safetyBusy
      ) {
        return
      }

      if (!serverConversations.some(
        item => item.id === conversation.id
      )) {
        onToast?.(
          'Browser-only conversation: no server report, block, or closure was submitted.',
          'error'
        )
        return
      }

      setSafetyBusy(
        action,
      )

      try {
        const body = {
          ...payload,
        }

        if (
          action ===
            'close' &&
          !body.note
        ) {
          body.note =
            'Closed from Plaza conversation screen.'
        }

        if (
          action ===
          'block'
        ) {
          body.note =
            body.note ||
            'Blocked from Plaza conversation screen.'

          body.scope =
            body.scope ||
            'user'
        }

        const result =
          await apiFetch(
            `/api/plaza/messages/${encodeURIComponent(
              conversation.id,
            )}/${action}`,
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  body,
                ),
            },
          )

        if (
          result?.conversation
        ) {
          upsertServer(
            result.conversation,
          )
        }

        if (
          action ===
          'report'
        ) {
          setReportOpen(
            false,
          )

          setReportForm({
            reason: '',
            details: '',
          })

          onToast?.(
            'Business chat reported for admin review.',
            'success',
          )
        }

        if (
          action ===
          'close'
        ) {
          onToast?.(
            'Business chat closed.',
            'success',
          )
        }

        if (
          action ===
          'block'
        ) {
          onToast?.(
            'Member blocked across future Business Chats.',
            'success',
          )
        }
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            `Could not ${action} this Plaza conversation.`,
          'error',
        )
      } finally {
        setSafetyBusy('')
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-conversations-react-workspace"
      data-yh-dashboard-react-surface="plazas-conversations"
    >
      <div className="yh-plaza-conversations-shell">
        <aside className="yh-plaza-conversation-list-pane">
          <header>
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas
              </span>

              <h1>
                Conversations
              </h1>
            </div>

            <div className="yh-plaza-conversation-header-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  onWorkspaceOpen?.(
                    'business-chats',
                  )
                }
              >
                Open Business Bridge
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={
                  refreshing
                }
                onClick={() =>
                  void loadConversations(
                    true,
                  )
                }
              >
                {refreshing
                  ? '...'
                  : 'Refresh'}
              </button>
            </div>
          </header>

          <div className="yh-plaza-conversation-summary">
            <span>
              {serverConversations.length}{' '}
              server conversations
            </span>

            <span>
              {unreadCount
                ? `${unreadCount} unread`
                : 'All caught up'}
            </span>
          </div>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading
              conversations...
            </div>
          )}

          {!loading &&
            !conversations.length && (
              <div className="yh-plaza-react-state">
                No conversation is
                open yet.
              </div>
            )}

          <div className="yh-plaza-conversation-list">
            {conversations.map(
              (conversation) => {
                const messages =
                  conversation.messages

                const last =
                  messages[
                    messages.length -
                      1
                  ]

                const unread =
                  isUnread(
                    conversation,
                  )

                const business =
                  clean(
                    conversation.scope,
                  ).toLowerCase() ===
                    'cross_division_business' ||
                  clean(
                    conversation.contextRoute,
                  )
                    .toLowerCase()
                    .includes(
                      'cross-division',
                    )

                return (
                  <button
                    type="button"
                    key={
                      conversation.id
                    }
                    className={[
                      'yh-plaza-conversation-list-card',
                      activeId ===
                      conversation.id
                        ? 'is-active'
                        : '',
                      unread
                        ? 'is-unread'
                        : '',
                      business
                        ? 'is-business'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      openConversation(
                        conversation,
                      )
                    }
                  >
                    <div>
                      <span>
                        {queueLabel(
                          conversation.queueRole,
                        )}
                      </span>

                      {unread && (
                        <b>
                          New
                        </b>
                      )}
                    </div>

                    <strong>
                      {
                        conversation.title
                      }
                    </strong>

                    {Boolean(clean(last?.text)) && (
                      <p>{last.text}</p>
                    )}

                    <small>
                      {
                        conversation.targetLabel
                      }
                      {' • '}
                      {conversation.contextRoute ||
                        'Plaza conversation'}
                    </small>
                  </button>
                )
              },
            )}
          </div>
        </aside>

        <main className="yh-plaza-conversation-thread-pane">
          {!activeConversation ? (
            <div className="yh-plaza-conversation-empty">
              <span className="yh-plaza-react-kicker">
                Plaza Messaging
              </span>

              <h2>
                Choose a conversation
              </h2>

              <p>
                Open a thread to
                view its routing
                context and reply.
              </p>
            </div>
          ) : (
            <>
              <header className="yh-plaza-conversation-thread-head">
                <div>
                  <span className="yh-plaza-react-kicker">
                    {queueLabel(
                      activeConversation.queueRole,
                    )}
                  </span>

                  <h2>
                    {
                      activeConversation.title
                    }
                  </h2>

                  <p>
                    {
                      activeConversation.targetLabel
                    }
                    {' • '}
                    {activeConversation.contextRoute}
                  </p>
                </div>

                <div className="yh-plaza-conversation-safety">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      Boolean(
                        safetyBusy,
                      )
                    }
                    onClick={() =>
                      setReportOpen(
                        true,
                      )
                    }
                  >
                    Report
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      Boolean(
                        safetyBusy,
                      ) ||
                      isLocked(
                        activeConversation,
                      )
                    }
                    onClick={() =>
                      void runSafetyAction(
                        'close',
                      )
                    }
                  >
                    {safetyBusy ===
                    'close'
                      ? 'Closing...'
                      : 'Close'}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      Boolean(
                        safetyBusy,
                      ) ||
                      isLocked(
                        activeConversation,
                      )
                    }
                    onClick={() =>
                      void runSafetyAction(
                        'block',
                      )
                    }
                  >
                    {safetyBusy ===
                    'block'
                      ? 'Blocking...'
                      : 'Block'}
                  </button>
                </div>
              </header>

              <div className="yh-plaza-conversation-thread">
                {activeConversation.messages.length ? (
                  activeConversation.messages.map(
                    (
                      message,
                    ) => (
                      <article
                        key={
                          message.id
                        }
                        className={[
                          'yh-plaza-conversation-bubble-react',
                          message.type ===
                          'system'
                            ? 'is-system'
                            : '',
                          message.sender ===
                          'You'
                            ? 'is-self'
                            : '',
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            ' ',
                          )}
                      >
                        <strong>
                          {
                            message.sender
                          }
                        </strong>

                        <p>
                          {
                            message.text
                          }
                        </p>

                        <span>
                          {formatDate(
                            message.createdAt,
                          )}
                        </span>
                      </article>
                    ),
                  )
                ) : (
                  <div className="yh-plaza-react-state">
                    No message
                    exists in this
                    conversation
                    yet.
                  </div>
                )}
              </div>

              <form
                className="yh-plaza-conversation-reply-form"
                onSubmit={
                  sendReply
                }
              >
                <textarea
                  className="input-field"
                  required
                  rows="3"
                  disabled={
                    isLocked(activeConversation) ||
                    sending ||
                    !serverConversations.some(
                      item => item.id === activeConversation.id
                    )
                  }
                  value={
                    reply
                  }
                  placeholder={
                    isLocked(
                      activeConversation,
                    )
                      ? 'This Plaza conversation is closed or blocked.'
                      : 'Write a contextual reply inside Plaza.'
                  }
                  onChange={(
                    event,
                  ) =>
                    setReply(
                      event.target
                        .value,
                    )
                  }
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    sending ||
                    isLocked(activeConversation) ||
                    !serverConversations.some(
                      item => item.id === activeConversation.id
                    )
                  }
                >
                  {sending
                    ? 'Sending...'
                    : 'Send Reply'}
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {reportOpen &&
        activeConversation && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
          >
            <form
              className="modal-content yh-plaza-conversation-report-modal"
              onSubmit={(
                event,
              ) => {
                event.preventDefault()

                if (
                  !clean(
                    reportForm.reason,
                  )
                ) {
                  onToast?.(
                    'Select a report reason.',
                    'error',
                  )

                  return
                }

                void runSafetyAction(
                  'report',
                  reportForm,
                )
              }}
            >
              <span className="yh-plaza-react-kicker">
                Conversation Safety
              </span>

              <h2>
                Report Business Chat
              </h2>

              <label>
                <span>
                  Reason
                </span>

                <select
                  className="input-field"
                  required
                  value={
                    reportForm.reason
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        reason:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Select a reason
                  </option>

                  <option value="Spam or unwanted promotion">
                    Spam or unwanted promotion
                  </option>

                  <option value="Abuse or harassment">
                    Abuse or harassment
                  </option>

                  <option value="Unsafe or inappropriate request">
                    Unsafe or inappropriate request
                  </option>

                  <option value="Fraud, scam, or misleading activity">
                    Fraud, scam, or misleading activity
                  </option>

                  <option value="Other policy or safety concern">
                    Other policy or safety concern
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Optional details
                </span>

                <textarea
                  className="input-field"
                  rows="4"
                  value={
                    reportForm.details
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        details:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <div className="roadmap-mission-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    safetyBusy ===
                    'report'
                  }
                  onClick={() =>
                    setReportOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    safetyBusy ===
                    'report'
                  }
                >
                  {safetyBusy ===
                  'report'
                    ? 'Reporting...'
                    : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        )}
    </section>
  )
}
