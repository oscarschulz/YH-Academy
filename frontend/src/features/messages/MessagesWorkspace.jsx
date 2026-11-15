import { getStoredAuthToken, getCurrentUserId, normalizeId, getMemberId, normalizeRoom, normalizeMessage, formatMessageTime, isRoomBlocked, isRoomRestricted, useMessagesInbox, getMessagesInbox, updateMessagesInbox, loadMessagesInbox, rememberMessageProfile, hydrateMessageProfile, searchMessageMember, mergeMessageHistory, messageTimeIso, messagesOwner } from './messagesUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../services/api/apiClient'

export default function MessagesWorkspace({
  onToast,
  onProfileOpen,
  initialRoomId = '',
}) {
  const rooms = useMessagesInbox()
  const setRooms = updateMessagesInbox

  const [
    activeRoomId,
    setActiveRoomId,
  ] = useState('')

  const [
    messagesByRoom,
    setMessagesByRoom,
  ] = useState({})

  const [
    roomFilter,
    setRoomFilter,
  ] = useState('dm')

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('')

  const [
    loadingRooms,
    setLoadingRooms,
  ] = useState(false)

  const [
    loadingThread,
    setLoadingThread,
  ] = useState(false)

  const [
    sendPending,
    setSendPending,
  ] = useState(false)

  const [composer, setComposer] =
    useState('')

  const [
    actionsOpen,
    setActionsOpen,
  ] = useState(false)

  const socketRef = useRef(null)
  const composerRef = useRef(null)
  const actionsRef = useRef(null)
  const actionBusyRef = useRef(false)
  const [actionPending, setActionPending] = useState('')
  const [failedAvatars, setFailedAvatars] = useState({})
  const roomLoadRef = useRef(0)
  const historyLoadsRef = useRef(new Map())
  const arrivalsRef = useRef(new Map())
  const messageSequenceRef = useRef(0)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      roomLoadRef.current += 1
      historyLoadsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!actionsOpen) return undefined
    const dismiss = event => {
      if (event.key === 'Escape' ||
          (event.type === 'pointerdown' && !actionsRef.current?.contains(event.target))) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('keydown', dismiss)
    document.addEventListener('pointerdown', dismiss)
    return () => {
      document.removeEventListener('keydown', dismiss)
      document.removeEventListener('pointerdown', dismiss)
    }
  }, [actionsOpen])

  const closeThread = () => {
    activeRoomIdRef.current = ''
    setActiveRoomId('')
    setLoadingThread(false)
    setActionsOpen(false)
  }

  const changeRoomFilter = filter => {
    closeThread()
    setRoomFilter(filter)
  }

  const avatarFailed = url => setFailedAvatars(current => ({ ...current, [url]: true }))

  /* YHU_PROFILE_DM_ROOM_HANDOFF_PARITY */
  const initialRoomHandledRef = useRef('')

  const activeRoomIdRef =
    useRef('')

  const messageListRef =
    useRef(null)



  const activeRoom =
    useMemo(
      () =>
        rooms.find(
          (room) =>
            room.id ===
            activeRoomId,
        ) || null,
      [rooms, activeRoomId],
    )

  const activeMessages =
    activeRoomId
      ? messagesByRoom[
          activeRoomId
        ] || []
      : []

  const unreadTotal =
    useMemo(
      () =>
        rooms.reduce(
          (sum, room) =>
            sum +
            Math.max(
              0,
              Number(
                room.unreadCount ||
                  0,
              ),
            ),
          0,
        ),
      [rooms],
    )

  const filteredRooms =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase()

      return rooms.filter(
        (room) => {
          if (
            room.roomType !==
            roomFilter
          ) {
            return false
          }

          if (!query) {
            return true
          }

          return [
            room.name,
            room.username,
            room.lastMessage,
          ]
            .map((value) =>
              String(
                value || '',
              ).toLowerCase(),
            )
            .some((value) =>
              value.includes(
                query,
              ),
            )
        },
      )
    }, [
      rooms,
      roomFilter,
      searchQuery,
    ])

  const loadRooms =
    useCallback(async (force = false) => {
    const version = ++roomLoadRef.current
    if (mountedRef.current) setLoadingRooms(true)
    try {
      return await loadMessagesInbox({ force: force === true })
    } catch (error) {
      if (mountedRef.current && version === roomLoadRef.current) {
        onToast?.(error?.message || 'Failed to load conversations.', 'error')
      }
      return getMessagesInbox()
    } finally {
      if (mountedRef.current && version === roomLoadRef.current) setLoadingRooms(false)
    }
  }, [onToast])

  const markRead =
    useCallback(
      async (roomId) => {
        if (!roomId) return
        const owner = messagesOwner()

        const acknowledged = await apiFetch(
          `/api/realtime/rooms/${encodeURIComponent(
            roomId,
          )}/read`,
          {
            method: 'POST',
            body: JSON.stringify(
              {},
            ),
          },
        ).then(
          (result) => result?.success !== false,
          () => false,
        )

        /* YHU_MESSAGES_READ_ACK_PATCH10 */

        if (!acknowledged || !mountedRef.current || owner !== messagesOwner()) return


        setRooms(
          (current) =>
            current.map(
              (room) =>
                room.id ===
                roomId
                  ? {
                      ...room,
                      unreadCount: 0, unread_count: 0,
                    }
                  : room,
            ),
        )
        void loadMessagesInbox({ force: true }).catch(() => {})
      },
      [],
    )

  const loadHistory =
    useCallback(async roomId => {
    if (!roomId) return
    const ticket = {}
    historyLoadsRef.current.set(roomId, ticket)
    const startedAt = messageSequenceRef.current
    if (activeRoomIdRef.current === roomId) setLoadingThread(true)
    try {
      const result = await apiFetch(
        '/api/realtime/rooms/' + encodeURIComponent(roomId) + '/messages?limit=100',
        { method: 'GET' }
      )
      if (!Array.isArray(result?.messages)) throw new Error('Message history response was incomplete.')
      if (!mountedRef.current || historyLoadsRef.current.get(roomId) !== ticket) return
      const messages = result.messages.map(normalizeMessage)
      setMessagesByRoom(current => ({
        ...current,
        [roomId]: mergeMessageHistory(messages, current[roomId] || [], arrivalsRef.current.get(roomId), startedAt),
      }))
    } catch (error) {
      if (mountedRef.current && historyLoadsRef.current.get(roomId) === ticket) {
        onToast?.(error?.message || 'Failed to load messages.', 'error')
      }
    } finally {
      if (historyLoadsRef.current.get(roomId) === ticket) {
        historyLoadsRef.current.delete(roomId)
        if (mountedRef.current && activeRoomIdRef.current === roomId) setLoadingThread(false)
      }
    }
  }, [onToast])

  const mergeMessage =
    useCallback(
      (message) => {
        const normalized =
          normalizeMessage(
            message,
          )

        if (
          !normalized.roomId
        ) {
          return
        }

        const arrivals = arrivalsRef.current.get(normalized.roomId) || new Map()
        arrivals.set(normalized.id || normalized, ++messageSequenceRef.current)
        arrivalsRef.current.set(normalized.roomId, arrivals)

        setMessagesByRoom(
          (current) => {
            const previous =
              current[
                normalized
                  .roomId
              ] || []

            const exists =
              normalized.id &&
              previous.some(
                (entry) =>
                  entry.id ===
                  normalized.id,
              )

            const next =
              exists
                ? previous.map(
                    (entry) =>
                      entry.id ===
                      normalized.id
                        ? normalized
                        : entry,
                  )
                : [
                    ...previous,
                    normalized,
                  ]

            next.sort(
              (a, b) =>
                (Date.parse(
                  a.time || '',
                ) || 0) -
                (Date.parse(
                  b.time || '',
                ) || 0),
            )

            return {
              ...current,
              [normalized.roomId]:
                next,
            }
          },
        )
      },
      [],
    )

  const selectRoom =
    useCallback(async roomId => {
    const cleanId = normalizeId(roomId)
    if (!cleanId) return
    activeRoomIdRef.current = cleanId
    setActionsOpen(false)
    setActiveRoomId(cleanId)
    const room = getMessagesInbox().find(item => item.id === cleanId)
    if (room) setRoomFilter(room.roomType)
    socketRef.current?.emit('joinRoom', { roomId: cleanId })
    await Promise.all([
      loadHistory(cleanId),
      markRead(cleanId),
      hydrateMessageProfile(cleanId).catch(() => null),
    ])
    if (mountedRef.current && activeRoomIdRef.current === cleanId) {
      requestAnimationFrame(() => {
        if (activeRoomIdRef.current === cleanId) composerRef.current?.focus()
      })
    }
  }, [loadHistory, markRead])

  useEffect(() => {
    const token =
      getStoredAuthToken()

    const socket = io({
      withCredentials: true,

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

    const handleConnect =
      () => {
        if (activeRoomIdRef.current) {
          socket.emit('joinRoom', {
            roomId: activeRoomIdRef.current,
          })
        }
        if (activeRoomIdRef.current) {
          void loadHistory(activeRoomIdRef.current)
          void markRead(activeRoomIdRef.current)
        }
        void loadRooms(true)
      }

    const handleMessage =
      (message = {}) => {
        const normalized =
          normalizeMessage(
            message,
          )

        if (
          !normalized.roomId
        ) {
          return
        }

        if (
          normalized.roomId ===
          activeRoomIdRef.current
        ) {
          mergeMessage(
            normalized,
          )

          void markRead(
            normalized.roomId,
          )
        }

        void loadRooms(true)
      }

    socket.on(
      'connect',
      handleConnect,
    )

    socket.on(
      'receiveMessage',
      handleMessage,
    )

    void loadRooms(true)

    return () => {
      socket.off(
        'connect',
        handleConnect,
      )

      socket.off(
        'receiveMessage',
        handleMessage,
      )

      socket.disconnect()

      socketRef.current =
        null
    }
  }, [
    loadRooms,
    markRead,
    mergeMessage,
    loadHistory,
  ])

  useEffect(() => {
    const requestedRoomId = normalizeId(initialRoomId)

    if (
      !requestedRoomId ||
      initialRoomHandledRef.current === requestedRoomId
    ) return

    initialRoomHandledRef.current = requestedRoomId
    setRoomFilter('dm')
    void selectRoom(requestedRoomId)
  }, [initialRoomId, selectRoom])

  useEffect(() => {
    if (!activeRoom) return
    setRoomFilter(activeRoom.roomType)
    if (activeRoom.roomType === 'dm') void hydrateMessageProfile(activeRoom.id).catch(() => null)
  }, [activeRoom?.id, activeRoom?.recipientId, activeRoom?.roomType])

  useEffect(() => {
    const list =
      messageListRef.current

    if (!list) return

    requestAnimationFrame(
      () => {
        list.scrollTop =
          list.scrollHeight
      },
    )
  }, [
    activeRoomId,
    activeMessages.length,
  ])

  const findMember =
    searchMessageMember

  const startDirectMessage =
    async () => {
      const query =
        window.prompt(
          'Search member name or username to start DM:',
        )

      if (!query) return

      const owner = messagesOwner()
      try {
      const member =
        await findMember(
          query,
        )

      if (owner !== messagesOwner()) return
      const targetUserId =
        getMemberId(member)

      if (!targetUserId) {
        onToast?.(
          'No matching member found.',
          'error',
        )
        return
      }

        const result =
          await apiFetch(
            '/api/realtime/rooms',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  roomType:
                    'dm',

                  targetUserId,
                }),
            },
          )

        if (owner !== messagesOwner()) return
        const room =
          result?.room

        if (!room?.id) {
          throw new Error(
            'Direct message room was not created.',
          )
        }

        rememberMessageProfile(member)
        const normalized =
          normalizeRoom(
            room,
            member,
          )

        setRooms(
          (current) => [
            normalized,
            ...current.filter(
              (entry) =>
                entry.id !==
                normalized.id,
            ),
          ],
        )

        setRoomFilter(
          'dm',
        )

        await selectRoom(
          normalized.id,
        )

        await loadRooms(true)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to start direct message.',
          'error',
        )
      }
    }

  const createGroup =
    async () => {
      const groupName =
        window.prompt(
          'Group name:',
        )

      if (!groupName) {
        return
      }

      const rawMembers =
        window.prompt(
          'Add members by name or username. Separate multiple members with commas:',
        )

      if (!rawMembers) {
        return
      }

      const queries =
        String(
          rawMembers,
        )
          .split(',')
          .map((item) =>
            item.trim(),
          )
          .filter(Boolean)

      if (!queries.length) {
        onToast?.(
          'Add at least one member.',
          'error',
        )
        return
      }

      const owner = messagesOwner()
      try {
        const members =
          await Promise.all(
            queries.map(
              (query) =>
                findMember(
                  query,
                ),
            ),
          )

        if (owner !== messagesOwner()) return
        const memberUserIds =
          Array.from(
            new Set(
              members
                .map(
                  getMemberId,
                )
                .filter(
                  Boolean,
                ),
            ),
          )

        if (
          !memberUserIds.length
        ) {
          throw new Error(
            'No valid group members found.',
          )
        }

        const result =
          await apiFetch(
            '/api/realtime/rooms',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  roomType:
                    'group',

                  name:
                    String(
                      groupName,
                    ).trim(),

                  memberUserIds,
                }),
            },
          )

        if (owner !== messagesOwner()) return
        const room =
          result?.room

        if (!room?.id) {
          throw new Error(
            'Group room was not created.',
          )
        }

        const normalized =
          normalizeRoom(
            room,
          )

        setRooms(
          (current) => [
            normalized,
            ...current.filter(
              (entry) =>
                entry.id !==
                normalized.id,
            ),
          ],
        )

        setRoomFilter(
          'group',
        )

        await selectRoom(
          normalized.id,
        )

        await loadRooms(true)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to create group.',
          'error',
        )
      }
    }

  const sendMessage =
    async (event) => {
      event.preventDefault()

      const owner = messagesOwner()
      const roomId =
        activeRoomIdRef.current

      const text =
        composer.trim()

      if (
        !roomId ||
        !text ||
        sendPending ||
        isRoomBlocked(getMessagesInbox().find(room => room.id === roomId))
      ) {
        return
      }

      const socket =
        socketRef.current

      if (
        !socket ||
        !socket.connected
      ) {
        onToast?.(
          'Messaging connection is unavailable.',
          'error',
        )
        return
      }

      setSendPending(
        true,
      )

      try {
        const result =
          await new Promise(
            (
              resolve,
              reject,
            ) => {
              const timer =
                window.setTimeout(
                  () =>
                    reject(
                      new Error(
                        'Message send timed out.',
                      ),
                    ),
                  12000,
                )

              socket.emit(
                'sendMessage',
                {
                  room:
                    roomId,

                  roomId,

                  text,

                  clientMessageId:
                    `dashboard_dm_${Date.now()}_${Math.random()
                      .toString(
                        36,
                      )
                      .slice(
                        2,
                        8,
                      )}`,
                },
                (
                  response = {},
                ) => {
                  window.clearTimeout(
                    timer,
                  )

                  if (
                    response?.success ===
                    false
                  ) {
                    reject(
                      new Error(
                        response?.message ||
                          'Failed to send message.',
                      ),
                    )

                    return
                  }

                  resolve(
                    response,
                  )
                },
              )
            },
          )

        if (owner !== messagesOwner()) return
        if (
          result?.message
        ) {
          mergeMessage(
            result.message,
          )
        }

        setComposer('')

        await loadRooms(true)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to send message.',
          'error',
        )
      } finally {
        setSendPending(
          false,
        )
      }
    }

  const runAction =
    async (action) => {
      if (
        !activeRoom?.id || actionBusyRef.current
      ) {
        return
      }

      const memberName =
        activeRoom.name ||
        'this user'

      const config = {
        delete: {
          endpoint:
            'hide',

          body: {
            hidden: true,
          },

          message:
            `Delete your conversation with ${memberName}? ` +
            'This will remove the conversation and its current history for you only. The other user will keep their copy.',
        },

        block: {
          endpoint:
            'block',

          body: {
            blocked: true,
          },

          message:
            `Block ${memberName}? Direct messaging between you will be blocked.`,
        },

        restrict: {
          endpoint:
            'restrict',

          body: {
            restricted:
              true,
          },

          message:
            `Restrict ${memberName}? They will no longer be able to send you direct messages while restricted.`,
        },
      }[action]

      if (!config) return

      if (
        !window.confirm(
          config.message,
        )
      ) {
        setActionsOpen(
          false,
        )
        return
      }

      const targetRoomId = activeRoom.id
      const owner = messagesOwner()
      actionBusyRef.current = true
      setActionPending(action)
      try {
        const result =
          await apiFetch(
            `/api/realtime/rooms/${encodeURIComponent(
              targetRoomId,
            )}/${config.endpoint}`,
            {
              method: 'PATCH',

              body:
                JSON.stringify(
                  config.body,
                ),
            },
          )

        if (owner !== messagesOwner()) return
        if (
          action ===
          'delete'
        ) {
          setRooms(
            (current) =>
              current.filter(
                (room) =>
                  room.id !==
                  targetRoomId,
              ),
          )

          setMessagesByRoom(
            (current) => {
              const next = {
                ...current,
              }

              delete next[
                targetRoomId
              ]

              return next
            },
          )

          historyLoadsRef.current.delete(targetRoomId)
          arrivalsRef.current.delete(targetRoomId)
          if (activeRoomIdRef.current === targetRoomId) closeThread()
        }

        if (
          action ===
          'block'
        ) {
          setRooms(
            (current) =>
              current.map(
                (room) =>
                  room.id ===
                  targetRoomId
                    ? {
                        ...room,
                        __dashboardBlocked:
                          true,
                      }
                    : room,
              ),
          )
        }

        if (
          action ===
          'restrict'
        ) {
          setRooms(
            (current) =>
              current.map(
                (room) =>
                  room.id ===
                  targetRoomId
                    ? {
                        ...room,
                        __dashboardRestricted:
                          true,
                      }
                    : room,
              ),
          )
        }

        setActionsOpen(
          false,
        )

        onToast?.(
          result?.message ||
            (action ===
            'delete'
              ? 'Conversation deleted for you.'
              : action ===
                  'block'
                ? `${memberName} has been blocked.`
                : `${memberName} has been restricted.`),
          'success',
        )

        await loadRooms(true)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Conversation action failed.',
          'error',
        )
      } finally {
        actionBusyRef.current = false
        if (mountedRef.current) setActionPending('')
      }
    }

  const composerLocked =
    isRoomBlocked(activeRoom)

  return (
    <section
      id="yh-dashboard-messages-workspace"
      className="yh-dashboard-system-workspace"
      aria-label="Direct Messages workspace"
      data-yh-dm-thread-open={
        activeRoom
          ? 'true'
          : 'false'
      }
    >
      <div className="yh-dashboard-system-workspace-content">
        <section
          className="yh-dashboard-dm-shell"
          aria-label="YH Direct Messages"
        >
          <header className="yh-dashboard-dm-head">
            <div>
              <small>
                YH DIRECT MESSAGES
              </small>

              <h2>
                Messages
              </h2>

              <p>
                Private one-to-one conversations with YH Universe members.
              </p>
            </div>

            <span className="yh-dashboard-dm-unread-summary">
              {unreadTotal > 99
                ? '99+ unread'
                : `${unreadTotal} unread`}
            </span>
          </header>

          <div className="yh-dashboard-dm-layout">
            <aside className="yh-dashboard-dm-inbox">
              <div className="yh-dashboard-dm-inbox-head">
                <div>
                  <small>
                    INBOX
                  </small>

                  <strong>
                    Conversations
                  </strong>
                </div>

                <button
                  type="button"
                  className="yh-dashboard-dm-refresh-btn"
                  aria-label="Refresh conversations"
                  disabled={
                    loadingRooms
                  }
                  onClick={() =>
                    loadRooms()
                  }
                >
                  ↻
                </button>
              </div>

              <div className="yh-dashboard-dm-actions-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={
                    startDirectMessage
                  }
                >
                  <span aria-hidden="true">
                    ✉
                  </span>{' '}
                  Start DM
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={
                    createGroup
                  }
                >
                  <span aria-hidden="true">
                    ◎
                  </span>{' '}
                  Create Group
                </button>
              </div>

              <div className="yh-dashboard-dm-filter-row">
                <button
                  type="button"
                  className={`btn-secondary ${
                    roomFilter ===
                    'dm'
                      ? 'is-active'
                      : ''
                  }`}
                  onClick={() => changeRoomFilter('dm')}
                >
                  DMs
                </button>

                <button
                  type="button"
                  className={`btn-secondary ${
                    roomFilter ===
                    'group'
                      ? 'is-active'
                      : ''
                  }`}
                  onClick={() => changeRoomFilter('group')}
                >
                  Groups
                </button>
              </div>

              <form
                className="yh-dashboard-dm-search"
                role="search"
                onSubmit={(
                  event,
                ) =>
                  event.preventDefault()
                }
              >
                <input
                  type="search"
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  autoComplete="off"
                  value={
                    searchQuery
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchQuery(
                      event.target
                        .value,
                    )
                  }
                />
              </form>

              <div className="yh-dashboard-dm-status">
                {loadingRooms
                  ? 'Loading conversations...'
                  : filteredRooms.length
                    ? `${filteredRooms.length} ${
                        roomFilter ===
                        'group'
                          ? 'group'
                          : 'conversation'
                      }${
                        filteredRooms.length ===
                        1
                          ? ''
                          : 's'
                      }`
                    : searchQuery
                      ? 'No matching conversations.'
                      : roomFilter ===
                          'group'
                        ? 'No groups yet.'
                        : 'No direct messages yet.'}
              </div>

              <div className="yh-dashboard-dm-room-list">
                {filteredRooms.map(
                  (room) => (
                    <button
                      key={
                        room.id
                      }
                      type="button"
                      className={`yh-dashboard-dm-room ${
                        room.id ===
                        activeRoomId
                          ? 'is-active'
                          : ''
                      }`}
                      onClick={() =>
                        selectRoom(
                          room.id,
                        )
                      }
                    >
                      <span className="yh-dashboard-dm-room-avatar">
                        {room.avatar && !failedAvatars[room.avatar] ? (
                          <img
                            src={
                              room.avatar
                            }
                            onError={() => avatarFailed(room.avatar)}
                            alt=""
                          />
                        ) : (
                          String(
                            room.name ||
                              'Y',
                          )
                            .charAt(
                              0,
                            )
                            .toUpperCase()
                        )}
                      </span>

                      <span className="yh-dashboard-dm-room-copy">
                        <strong>
                          {
                            room.name
                          }
                        </strong>

                        <span>
                          {room.lastMessage ||
                            (room.roomType ===
                            'group'
                              ? 'Group conversation'
                              : 'Start the conversation.')}
                        </span>
                      </span>

                      {room.unreadCount >
                        0 && (
                        <span className="yh-dashboard-dm-room-unread">
                          {room.unreadCount >
                          99
                            ? '99+'
                            : room.unreadCount}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            </aside>

            <section
              className="yh-dashboard-dm-thread"
              aria-label="Active direct message"
            >
              {!activeRoom ? (
                <div className="yh-dashboard-dm-empty">
                  <strong>
                    Messages Inbox
                  </strong>

                  <span>
                    Choose a DM or Group from the inbox, or start a new conversation.
                  </span>
                </div>
              ) : (
                <div className="yh-dashboard-dm-active">
                  <header className="yh-dashboard-dm-thread-head">
                    <button
                      type="button"
                      className="btn-secondary yh-dashboard-dm-mobile-back"
                      aria-label="Back to Messages inbox"
                      onClick={closeThread}
                    >
                      ←
                    </button>

                    <div className="yh-dashboard-dm-thread-person">
                      <div className="yh-dashboard-dm-thread-avatar">
                        {activeRoom.avatar && !failedAvatars[activeRoom.avatar] ? (
                          <img
                            src={
                              activeRoom.avatar
                            }
                            onError={() => avatarFailed(activeRoom.avatar)}
                            alt=""
                          />
                        ) : (
                          String(
                            activeRoom.name ||
                              'Y',
                          )
                            .charAt(
                              0,
                            )
                            .toUpperCase()
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            activeRoom.name
                          }
                        </strong>

                        <span>
                          {activeRoom.roomType ===
                          'group'
                            ? activeRoom.username ||
                              'Group conversation'
                            : activeRoom.username
                              ? `@${activeRoom.username}`
                              : 'YH Universe member'}
                        </span>
                      </div>
                    </div>

                    {activeRoom.roomType ===
                      'dm' && (
                      <div className="yh-dashboard-dm-thread-actions">
                        <button
                          type="button"
                          className="btn-secondary yh-dashboard-dm-view-profile-btn"
                          onClick={() =>
                            onProfileOpen?.(
                              activeRoom,
                            )
                          }
                        >
                          View Profile
                        </button>

                        <div ref={actionsRef} className="yh-dashboard-dm-thread-more">
                          <button
                            type="button"
                            className="yh-dashboard-dm-more-toggle"
                            aria-label="Conversation options"
                            aria-haspopup="menu"
                            aria-expanded={
                              actionsOpen
                            }
                            onClick={() =>
                              setActionsOpen(
                                (open) =>
                                  !open,
                              )
                            }
                          >
                            <span aria-hidden="true">
                              •••
                            </span>
                          </button>

                          {actionsOpen && (
                            <div
                              className="yh-dashboard-dm-actions-menu"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="is-danger"
                                disabled={Boolean(actionPending)}
                                onClick={() =>
                                  runAction(
                                    'delete',
                                  )
                                }
                              >
                                Delete conversation
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                className="is-danger"
                                disabled={
                                  Boolean(actionPending) || isRoomBlocked(
                                    activeRoom,
                                  )
                                }
                                onClick={() =>
                                  runAction(
                                    'block',
                                  )
                                }
                              >
                                {isRoomBlocked(
                                  activeRoom,
                                )
                                  ? 'User blocked'
                                  : 'Block user'}
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                disabled={
                                  Boolean(actionPending) || isRoomRestricted(
                                    activeRoom,
                                  ) ||
                                  isRoomBlocked(
                                    activeRoom,
                                  )
                                }
                                onClick={() =>
                                  runAction(
                                    'restrict',
                                  )
                                }
                              >
                                {isRoomRestricted(
                                  activeRoom,
                                )
                                  ? 'User restricted'
                                  : 'Restrict user'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </header>

                  <div
                    ref={
                      messageListRef
                    }
                    className="yh-dashboard-dm-message-list"
                  >
                    {loadingThread ? (
                      <div className="yh-dashboard-dm-status">
                        Loading messages...
                      </div>
                    ) : !activeMessages.length ? (
                      <div className="yh-dashboard-dm-status">
                        This is the beginning of your conversation.
                      </div>
                    ) : (
                      activeMessages.map(
                        (
                          message,
                          index,
                        ) => {
                          const mine =
                            Boolean(
                              getCurrentUserId() &&
                                message.authorId ===
                                  getCurrentUserId(),
                            )

                          return (
                            <article
                              key={
                                message.id ||
                                `${message.roomId}-${index}`
                              }
                              className={`yh-dashboard-dm-message ${
                                mine
                                  ? 'is-mine'
                                  : ''
                              }`}
                            >
                              <p>
                                {
                                  message.text
                                }
                              </p>

                              <small className="yh-dashboard-dm-message-meta">
                                <span className="yh-dashboard-dm-message-author">
                                  {mine
                                    ? 'You'
                                    : message.author ||
                                      activeRoom.name}
                                </span>

                                {formatMessageTime(
                                  message.time,
                                ) && (
                                  <time className="yh-dashboard-dm-message-time" dateTime={messageTimeIso(message.time)}>
                                    {formatMessageTime(
                                      message.time,
                                    )}
                                  </time>
                                )}
                              </small>
                            </article>
                          )
                        },
                      )
                    )}
                  </div>

                  <form
                    className="yh-dashboard-dm-composer"
                    onSubmit={
                      sendMessage
                    }
                  >
                    <textarea
                      ref={composerRef}
                      rows="1"
                      maxLength="1600"
                      placeholder={
                        composerLocked
                          ? 'You blocked this user.'
                          : 'Write a message...'
                      }
                      aria-label="Write a direct message"
                      disabled={
                        composerLocked
                      }
                      value={
                        composer
                      }
                      onChange={(
                        event,
                      ) =>
                        setComposer(
                          event.target
                            .value,
                        )
                      }
                      onKeyDown={(
                        event,
                      ) => {
                        if (
                          event.key ===
                            'Enter' &&
                          !event.shiftKey
                        ) {
                          event.preventDefault()

                          event.currentTarget
                            .form
                            ?.requestSubmit()
                        }
                      }}
                    />

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={
                        sendPending ||
                        composerLocked ||
                        !composer.trim()
                      }
                    >
                      {sendPending
                        ? 'Sending...'
                        : 'Send'}
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </section>
  )
}
