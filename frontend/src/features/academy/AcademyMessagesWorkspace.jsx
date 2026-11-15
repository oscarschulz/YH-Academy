import { MESSAGES_TAB_KEY, readMessagesTab, writeMessagesTab } from './academyMessagesTab.js'
import { MAX_ATTACHMENT_BYTES, clean, safeArray, stored, authToken, viewerId, viewerName, viewerAvatar, getRoomId, normalizeRoom, getMessageId, getMessageRoomId, getMessageText, getMessageAuthor, getMessageAuthorId, isOwnMessage, getMessageDate, getAttachment, mergeMessage, roomTime, createClientMessageId } from './academyMessagesUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../services/api/apiClient'

function MessageAttachment({
  attachment,
}) {
  if (
    !attachment?.url
  ) {
    return null
  }

  const mime =
    clean(
      attachment.mimeType ||
        attachment.type,
    ).toLowerCase()

  if (
    mime.startsWith(
      'image/',
    )
  ) {
    return (
      <img
        className="academy-message-attachment-image"
        src={
          attachment.url
        }
        alt=""
      />
    )
  }

  if (
    mime.startsWith(
      'video/',
    )
  ) {
    return (
      <video
        className="academy-message-attachment-video"
        src={
          attachment.url
        }
        controls
        preload="metadata"
      />
    )
  }

  if (
    mime.startsWith(
      'audio/',
    )
  ) {
    return (
      <audio
        src={
          attachment.url
        }
        controls
      />
    )
  }

  return (
    <a
      href={
        attachment.url
      }
      target="_blank"
      rel="noreferrer"
      className="academy-ui-button academy-ui-button--secondary"
    >
      📎{' '}
      {clean(
        attachment.originalName ||
          attachment.name ||
          'Attachment',
      )}
    </a>
  )
}

export default function AcademyMessagesWorkspace({
  onToast,
}) {
  const socketRef =
    useRef(null)

  const activeRoomRef =
    useRef('')

  /* YHU_ACADEMY_A09_THREAD_LOADING_TIMER_GUARD */
  const threadLoadingTimerRef = useRef(null)

  const sendPendingRoomRef =
    useRef('')

  const bottomRef =
    useRef(null)

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    roomsLoading,
    setRoomsLoading,
  ] = useState(true)

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    () =>
      readMessagesTab(),
  )

  const [
    activeRoomId,
    setActiveRoomId,
  ] = useState('')

  const [
    messages,
    setMessages,
  ] = useState([])

  const [
    threadLoading,
    setThreadLoading,
  ] = useState(false)

  const [
    connected,
    setConnected,
  ] = useState(false)

  const [
    composer,
    setComposer,
  ] = useState('')

  const [
    attachment,
    setAttachment,
  ] = useState(null)

  const [
    uploadBusy,
    setUploadBusy,
  ] = useState(false)

  const [
    sendBusy,
    setSendBusy,
  ] = useState(false)

  const [
    roomActionBusy,
    setRoomActionBusy,
  ] = useState('')

  const [
    messageActionBusy,
    setMessageActionBusy,
  ] = useState('')

  const [
    newMessageOpen,
    setNewMessageOpen,
  ] = useState(false)

  const [
    memberQuery,
    setMemberQuery,
  ] = useState('')

  const [
    memberResults,
    setMemberResults,
  ] = useState([])

  const [
    memberSearchBusy,
    setMemberSearchBusy,
  ] = useState(false)

  const [
    selectedMemberIds,
    setSelectedMemberIds,
  ] = useState([])

  const [
    groupName,
    setGroupName,
  ] = useState('')

  const [
    createRoomBusy,
    setCreateRoomBusy,
  ] = useState(false)

  const filteredRooms =
    useMemo(
      () =>
        rooms.filter(
          (room) =>
            room.type ===
            activeTab,
        ),
      [
        rooms,
        activeTab,
      ],
    )

  const activeRoom =
    useMemo(
      () =>
        rooms.find(
          (room) =>
            room.roomId ===
            activeRoomId,
        ) ||
        null,
      [
        rooms,
        activeRoomId,
      ],
    )

  const loadRooms =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setRoomsLoading(true)
        }

        try {
          const result =
            await apiFetch(
              '/api/realtime/rooms',
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          const nextRooms =
            safeArray(
              result?.rooms,
            )
              .map(
                normalizeRoom,
              )
              .filter(
                (room) =>
                  room.roomId &&
                  !room.isHidden,
              )

          setRooms(
            nextRooms,
          )

          return nextRooms
        } catch (
          roomError
        ) {
          onToast?.(
            roomError?.message ||
              'Failed to load conversations.',
            'error',
          )

          return []
        } finally {
          if (!silent) {
            setRoomsLoading(
              false,
            )
          }
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  useEffect(() => {
    activeRoomRef.current =
      activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    writeMessagesTab(
      activeTab,
    )

    if (
      activeRoom &&
      activeRoom.type !==
        activeTab
    ) {
      activeRoomRef.current =
        ''

      setActiveRoomId('')
      setMessages([])
    }
  }, [
    activeTab,
    activeRoom,
  ])

  useEffect(() => {
    const socket =
      io({
        withCredentials:
          true,

        transports: [
          'websocket',
          'polling',
        ],

        auth:
          authToken()
            ? {
                token:
                  authToken(),
              }
            : {},
      })

    socketRef.current =
      socket

    const handleConnect =
      () => {
        setConnected(true)

        if (
          activeRoomRef.current
        ) {
          socket.emit(
            'joinRoom',
            activeRoomRef.current,
          )
        }
      }

    const handleDisconnect =
      () => {
        setConnected(false)
      }

    const handleHistory =
      (payload = {}) => {
        const incoming =
          Array.isArray(payload)
            ? payload
            : safeArray(
                payload?.messages,
              )

        const payloadRoomId =
          Array.isArray(payload)
            ? activeRoomRef.current
            : getMessageRoomId(
                payload,
              ) ||
              activeRoomRef.current

        if (
          !activeRoomRef.current ||
          (payloadRoomId &&
            payloadRoomId !== activeRoomRef.current)
        ) {
          return
        }

        setMessages(
          incoming,
        )

        setThreadLoading(
          false,
        )
      }

    const handleMessage =
      (message = {}) => {
        const incomingRoomId =
          getMessageRoomId(
            message,
          )

        if (
          incomingRoomId &&
          incomingRoomId ===
            activeRoomRef.current
        ) {
          setMessages(
            (current) =>
              mergeMessage(
                current,
                message,
              ),
          )

          void apiFetch(
            `/api/realtime/rooms/${encodeURIComponent(
              incomingRoomId,
            )}/read`,
            {
              method:
                'POST',
            },
          ).catch(
            () => {},
          )
        }

        void loadRooms(
          true,
        )
      }

    const handleDeleted =
      (payload = {}) => {
        const id =
          clean(
            typeof payload ===
              'string'
              ? payload
              : payload.id ||
                  payload.messageId,
          )

        if (!id) return

        setMessages(
          (current) =>
            current.filter(
              (message) =>
                getMessageId(
                  message,
                ) !== id,
            ),
        )
      }

    const handleEdited =
      (payload = {}) => {
        const id =
          clean(
            payload.id ||
              payload.messageId,
          )

        const text =
          clean(payload.text)

        if (!id || !text) return

        setMessages(
          (current) =>
            current.map(
              (message) =>
                getMessageId(message) === id
                  ? {
                      ...message,
                      text,
                      body: text,
                    }
                  : message,
            ),
        )
      }

    const handleHiddenForMe =
      (payload = {}) => {
        const id =
          clean(
            typeof payload === 'string'
              ? payload
              : payload.id ||
                  payload.messageId,
          )

        if (!id) return

        setMessages(
          (current) =>
            current.filter(
              (message) =>
                getMessageId(message) !== id,
            ),
        )
      }

    const handleSocketRoomError = async (payload = {}) => {
      const deniedRoomId = clean(payload.roomId || payload.room_id)
      if (!deniedRoomId || deniedRoomId !== activeRoomRef.current) return

      if (threadLoadingTimerRef.current !== null) {
        window.clearTimeout(threadLoadingTimerRef.current)
        threadLoadingTimerRef.current = null
      }

      setMessages([])
      setThreadLoading(false)
      setComposer('')
      setAttachment(null)

      const refreshedRooms = await loadRooms(true)
      if (deniedRoomId !== activeRoomRef.current) return

      const currentRoom = refreshedRooms.find(
        room => room.roomId === deniedRoomId,
      )
      if (currentRoom?.isBlockedByMe === true) return

      activeRoomRef.current = ''
      setActiveRoomId('')
      onToast?.(payload.message || 'Failed to load this conversation.', 'error')
    }

    const handleMessageError =
      (payload = {}) => {
        onToast?.(
          payload?.message ||
            'Message action failed.',
          'error',
        )

        setMessageActionBusy('')
      }

    const handleSendMessageError =
      (payload = {}) => {
        const roomId =
          getMessageRoomId(
            payload,
          )

        /*
         * Ack-driven sends already surface their own error.
         * Ignore the matching socket error while that send
         * is still pending.
         */
        if (
          roomId &&
          sendPendingRoomRef.current ===
            roomId
        ) {
          return
        }

        if (
          roomId &&
          activeRoomRef.current &&
          roomId !==
            activeRoomRef.current
        ) {
          return
        }

        setSendBusy(false)

        onToast?.(
          payload?.message ||
            'Message could not be sent.',
          'error',
        )
      }

    const handleRoomStateUpdated =
      async (
        payload = {},
      ) => {
        const id =
          clean(
            payload.roomId ||
              payload.room_id ||
              payload?.room?.id ||
              payload?.room
                ?.roomId,
          )

        if (
          payload?.room &&
          typeof payload.room ===
            'object'
        ) {
          const updated =
            normalizeRoom(
              payload.room,
            )

          if (
            updated.roomId
          ) {
            setRooms(
              (current) => {
                const exists =
                  current.some(
                    (room) =>
                      room.roomId ===
                      updated.roomId,
                  )

                if (!exists) {
                  return [
                    updated,
                    ...current,
                  ]
                }

                return current.map(
                  (room) =>
                    room.roomId ===
                    updated.roomId
                      ? {
                          ...room,
                          ...updated,
                        }
                      : room,
                )
              },
            )
          }
        }

        /*
         * Canonical refresh keeps unread counts,
         * restrictions, blocks and room metadata
         * synchronized with the backend.
         */
        await loadRooms(
          true,
        )

        if (
          id &&
          id ===
            activeRoomRef.current
        ) {
          setThreadLoading(
            false,
          )
        }
      }

    const handleRoomAccessUpdated =
      async (
        payload = {},
      ) => {
        const roomId =
          clean(
            payload.roomId ||
              payload.room_id,
          )

        const blockedUserIds =
          safeArray(
            payload.blockedUserIds ||
              payload.blocked_user_ids,
          )
            .map(clean)
            .filter(Boolean)

        const me =
          viewerId()

        const blockedCurrentUser =
          Boolean(
            payload.blocked === true &&
              me &&
              blockedUserIds.includes(
                me,
              ),
          )

        if (
          blockedCurrentUser &&
          roomId &&
          roomId ===
            activeRoomRef.current
        ) {
          activeRoomRef.current =
            ''

          setActiveRoomId('')
          setMessages([])
          setComposer('')
          setAttachment(null)

          onToast?.(
            'This conversation is no longer available.',
            'error',
          )
        }

        await loadRooms(
          true,
        )
      }

    const handleUpvoted =
      (payload = {}) => {
        const id =
          clean(
            payload.id ||
              payload.messageId,
          )

        if (!id) return

        setMessages(
          (current) =>
            current.map(
              (message) =>
                getMessageId(
                  message,
                ) === id
                  ? {
                      ...message,
                      upvotes:
                        payload.upvotes ??
                        message.upvotes,
                    }
                  : message,
            ),
        )
      }

    socket.on(
      'connect',
      handleConnect,
    )

    socket.on(
      'disconnect',
      handleDisconnect,
    )

    socket.on(
      'chatHistory',
      handleHistory,
    )

    socket.on('socketRoomError', handleSocketRoomError)

    socket.on(
      'receiveMessage',
      handleMessage,
    )

    socket.on(
      'messageDeleted',
      handleDeleted,
    )

    socket.on(
      'messageEdited',
      handleEdited,
    )

    socket.on(
      'messageHiddenForMe',
      handleHiddenForMe,
    )

    socket.on(
      'messageEditError',
      handleMessageError,
    )

    socket.on(
      'messageHideError',
      handleMessageError,
    )

    socket.on(
      'messageDeleteError',
      handleMessageError,
    )

    socket.on(
      'sendMessageError',
      handleSendMessageError,
    )

    socket.on(
      'roomAccessUpdated',
      handleRoomAccessUpdated,
    )

    socket.on(
      'academyRoomStateUpdated',
      handleRoomStateUpdated,
    )

    socket.on(
      'messageUpvoted',
      handleUpvoted,
    )

    return () => {
      socket.off(
        'connect',
        handleConnect,
      )

      socket.off(
        'disconnect',
        handleDisconnect,
      )

      socket.off(
        'chatHistory',
        handleHistory,
      )

      socket.off('socketRoomError', handleSocketRoomError)

      socket.off(
        'receiveMessage',
        handleMessage,
      )

      socket.off(
        'messageDeleted',
        handleDeleted,
      )

      socket.off(
        'messageEdited',
        handleEdited,
      )

      socket.off(
        'messageHiddenForMe',
        handleHiddenForMe,
      )

      socket.off(
        'messageEditError',
        handleMessageError,
      )

      socket.off(
        'messageHideError',
        handleMessageError,
      )

      socket.off(
        'messageDeleteError',
        handleMessageError,
      )

      socket.off(
        'sendMessageError',
        handleSendMessageError,
      )

      socket.off(
        'roomAccessUpdated',
        handleRoomAccessUpdated,
      )

      socket.off(
        'academyRoomStateUpdated',
        handleRoomStateUpdated,
      )

      socket.off(
        'messageUpvoted',
        handleUpvoted,
      )

      socket.disconnect()

      socketRef.current =
        null
    }
  }, [loadRooms])

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        block: 'end',
      })
  }, [messages])

  useEffect(() => {
    const query =
      clean(memberQuery)

    if (
      query.length < 2 ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        query,
      )
    ) {
      setMemberResults([])
      setMemberSearchBusy(
        false,
      )

      return undefined
    }

    /* YHU_ACADEMY_A07_MEMBER_SEARCH_ABORT_GUARD */
    const controller = new AbortController()

    const timer =
      window.setTimeout(
        async () => {
          if (controller.signal.aborted) return

          setMemberSearchBusy(
            true,
          )

          try {
            const result =
              await apiFetch(
                `/api/academy/community/members?limit=24&query=${encodeURIComponent(
                  query,
                )}`,
                {
                  method:
                    'GET',
                  signal: controller.signal,
                },
              )

            if (controller.signal.aborted) return

            setMemberResults(
              safeArray(
                result?.members,
              ),
            )
          } catch {
            if (controller.signal.aborted) return

            setMemberResults(
              [],
            )
          } finally {
            if (!controller.signal.aborted) {
              setMemberSearchBusy(false)
            }
          }
        },
        250,
      )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [memberQuery])

  useEffect(() => {
    return () => {
      if (threadLoadingTimerRef.current !== null) {
        window.clearTimeout(threadLoadingTimerRef.current)
        threadLoadingTimerRef.current = null
      }
    }
  }, [])

  const openRoom =
    async (room) => {
      const id =
        getRoomId(room)

      if (!id) return

      activeRoomRef.current =
        id

      /* YHU_ACADEMY_MESSAGE_THREAD_TAB_PARITY */
      setActiveTab(room.type === 'group' ? 'group' : 'dm')
      setActiveRoomId(id)
      /* YHU_ACADEMY_PROFILE_FULL_RETURN_PARITY: original conversation return */
      try {
        const last = JSON.parse(
          sessionStorage.getItem(
            'yh_academy_last_non_profile_view_v2'
          ) || '{}'
        ) || {}

        sessionStorage.setItem(
          'yh_academy_last_non_profile_view_v2',
          JSON.stringify({
            ...last,
            sourceView: 'messages',
            activeRoomId: id,
            updatedAt: new Date().toISOString(),
          }),
        )
      } catch {}

      setMessages([])
      setThreadLoading(
        true,
      )

      if (threadLoadingTimerRef.current !== null) {
        window.clearTimeout(threadLoadingTimerRef.current)
        threadLoadingTimerRef.current = null
      }

      socketRef.current?.emit(
        'joinRoom',
        id,
      )

      try {
        await apiFetch(
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/read`,
          {
            method:
              'POST',
          },
        )
      } catch {}

      setRooms(
        (current) =>
          current.map(
            (item) =>
              item.roomId ===
              id
                ? {
                    ...item,
                    unreadCount:
                      0,
                  }
                : item,
          ),
      )

      threadLoadingTimerRef.current = window.setTimeout(
        () => {
          threadLoadingTimerRef.current = null
          if (activeRoomRef.current !== id) return
          setThreadLoading(false)
        },
        2500,
      )
    }

  useEffect(() => {
    if (!rooms.length) {
      return
    }

    let targetRoomId = ''

    try {
      targetRoomId =
        sessionStorage.getItem(
          'yh_academy_open_message_room_id',
        ) || ''


    } catch {}

    if (!targetRoomId) {
      return
    }

    const targetRoom =
      rooms.find(
        (room) =>
          room.roomId ===
          targetRoomId,
      )

    if (targetRoom) {
      const timer = window.setTimeout(() => {
        try {
          const currentTarget = sessionStorage.getItem(
            'yh_academy_open_message_room_id',
          )

          if (currentTarget !== targetRoomId) return

          sessionStorage.removeItem(
            'yh_academy_open_message_room_id',
          )
        } catch {
          return
        }

        void openRoom(targetRoom)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [rooms])

  const uploadFile =
    async (file) => {
      if (!file) return

      if (
        file.size >
        MAX_ATTACHMENT_BYTES
      ) {
        onToast?.(
          'File must be 50MB or smaller.',
          'error',
        )

        return
      }

      setUploadBusy(true)

      try {
        const token =
          authToken()

        const response =
          await fetch(
            '/api/academy/messages/uploads',
            {
              method:
                'POST',

              credentials:
                'include',

              headers: {
                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),

                'Content-Type':
                  file.type ||
                  'application/octet-stream',

                'X-File-Name':
                  encodeURIComponent(
                    file.name ||
                      'upload',
                  ),

                'X-File-Mime':
                  file.type ||
                  'application/octet-stream',

                'X-File-Size':
                  String(
                    file.size ||
                      0,
                  ),
              },

              body: file,
            },
          )

        const result =
          await response
            .json()
            .catch(
              () => ({}),
            )

        if (
          !response.ok ||
          result?.success !==
            true ||
          !result?.attachment
            ?.url
        ) {
          throw new Error(
            result?.message ||
              'Failed to upload message file.',
          )
        }

        setAttachment(
          result.attachment,
        )
      } catch (
        uploadError
      ) {
        onToast?.(
          uploadError?.message ||
            'Failed to upload message file.',
          'error',
        )
      } finally {
        setUploadBusy(false)
      }
    }

  const sendMessage =
    async (event) => {
      event?.preventDefault?.()

      if (
        sendBusy ||
        !activeRoom
      ) {
        return
      }

      const text =
        clean(composer)

      const hasAttachment =
        Boolean(
          attachment?.url,
        )

      if (
        !text &&
        !hasAttachment
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
          'Realtime socket is not ready yet. Refresh and try again.',
          'error',
        )

        return
      }

      setSendBusy(true)

      const id =
        activeRoom.roomId

      sendPendingRoomRef.current =
        id

      const clientMessageId =
        createClientMessageId(
          id,
        )

      const names =
        Array.from(
          new Set([
            viewerName(),
            ...safeArray(
              activeRoom.participantNames,
            ),
          ]),
        ).filter(Boolean)

      const memberIds =
        Array.from(
          new Set(
            safeArray(
              activeRoom.memberIds,
            ).filter(Boolean),
          ),
        )

      const payload = {
        roomId: id,
        room: id,

        roomName:
          activeRoom.name,

        text:
          text ||
          (hasAttachment
            ? `📎 ${
                attachment.originalName ||
                'Attachment'
              }`
            : ''),

        attachment:
          hasAttachment
            ? attachment
            : null,

        author:
          viewerName(),

        authorId:
          viewerId(),

        initial:
          viewerName()
            .charAt(0)
            .toUpperCase(),

        avatar:
          viewerAvatar(),

        time:
          `Today at ${new Date().toLocaleTimeString(
            [],
            {
              hour:
                '2-digit',
              minute:
                '2-digit',
            },
          )}`,

        type:
          activeRoom.type,

        privacy:
          'private',

        participants:
          names,

        memberNames:
          names,

        memberIds,

        recipientName:
          activeRoom.type ===
          'dm'
            ? activeRoom.name
            : '',

        recipientId:
          activeRoom.type ===
          'dm'
            ? activeRoom.recipientId
            : '',

        clientMessageId,
        client_message_id:
          clientMessageId,
      }

      try {
        const ack =
          await new Promise(
            (
              resolve,
              reject,
            ) => {
              let settled =
                false

              const timeout =
                window.setTimeout(
                  () => {
                    if (
                      settled
                    ) {
                      return
                    }

                    settled =
                      true

                    reject(
                      new Error(
                        'Message delivery timed out. Your draft was kept.',
                      ),
                    )
                  },
                  15000,
                )

              socket.emit(
                'sendMessage',
                payload,
                (
                  result = {},
                ) => {
                  if (
                    settled
                  ) {
                    return
                  }

                  settled =
                    true

                  window.clearTimeout(
                    timeout,
                  )

                  if (
                    result?.success !==
                    true
                  ) {
                    reject(
                      new Error(
                        result?.message ||
                          'Message could not be sent.',
                      ),
                    )

                    return
                  }

                  resolve(
                    result,
                  )
                },
              )
            },
          )

        const confirmed =
          ack?.message &&
          typeof ack.message ===
            'object'
            ? ack.message
            : payload

        if (activeRoomRef.current === id) {
          setMessages(
            (current) =>
              mergeMessage(
                current,
                confirmed,
              ),
          )

          setComposer('')
          setAttachment(null)
        }

        await loadRooms(
          true,
        )
      } catch (
        sendError
      ) {
        onToast?.(
          sendError?.message ||
            'Message could not be sent.',
          'error',
        )
      } finally {
        if (
          sendPendingRoomRef.current ===
          id
        ) {
          sendPendingRoomRef.current =
            ''
        }

        setSendBusy(false)
      }
    }

  const runMessageAction =
    async (
      action,
      message,
    ) => {
      const id =
        getMessageId(message)

      const socket =
        socketRef.current

      if (!id || !socket?.connected) {
        onToast?.(
          'Realtime socket is not ready yet. Refresh and try again.',
          'error',
        )
        return
      }

      if (action === 'edit') {
        const currentText =
          getMessageText(message)

        const nextRaw =
          window.prompt(
            'Edit message',
            currentText,
          )

        if (nextRaw === null) return

        const nextText =
          clean(nextRaw)

        if (!nextText) {
          onToast?.(
            'Message cannot be empty.',
            'error',
          )
          return
        }

        setMessageActionBusy(
          `edit:${id}`,
        )

        socket.emit(
          'editMessage',
          {
            id,
            text: nextText,
          },
          (ack = {}) => {
            setMessageActionBusy('')

            if (ack?.success === false) {
              onToast?.(
                ack?.message ||
                  'Message edit failed.',
                'error',
              )
              return
            }

            setMessages(
              (current) =>
                current.map(
                  (item) =>
                    getMessageId(item) === id
                      ? {
                          ...item,
                          text: nextText,
                          body: nextText,
                        }
                      : item,
                ),
            )

            onToast?.(
              'Message edited.',
              'success',
            )
          },
        )

        return
      }

      if (action === 'unsend-me') {
        setMessageActionBusy(
          `hide:${id}`,
        )

        socket.emit(
          'hideMessageForMe',
          { id },
          (ack = {}) => {
            setMessageActionBusy('')

            if (ack?.success === false) {
              onToast?.(
                ack?.message ||
                  'Could not unsend this message for you.',
                'error',
              )
              return
            }

            setMessages(
              (current) =>
                current.filter(
                  (item) =>
                    getMessageId(item) !== id,
                ),
            )

            onToast?.(
              'Message removed for you.',
              'success',
            )
          },
        )

        return
      }

      if (action === 'unsend-everyone') {
        if (
          !window.confirm(
            'Unsend this message for everyone? This cannot be undone.',
          )
        ) {
          return
        }

        setMessageActionBusy(
          `delete:${id}`,
        )

        socket.emit(
          'deleteMessage',
          id,
          () => {
            setMessageActionBusy('')
          },
        )
      }
    }

  const applyRoomAction =
    async (
      action,
    ) => {
      if (!activeRoom) {
        return
      }

      const id =
        activeRoom.roomId

      const endpointMap = {
        mute:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/mute`,

        restrict:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/restrict`,

        unrestrict:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/restrict`,

        hide:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/hide`,

        block:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/block`,

        unblock:
          `/api/realtime/rooms/${encodeURIComponent(
            id,
          )}/block`,
      }

      const endpoint =
        endpointMap[action]

      if (!endpoint) return

      const bodyMap = {
        mute: {
          muted: true,
        },

        restrict: {
          restricted:
            true,
        },

        unrestrict: {
          restricted:
            false,
        },

        hide: {},

        block: {
          blocked: true,
        },

        unblock: {
          blocked:
            false,
        },
      }

      if (
        action === 'hide' &&
        !window.confirm(
          'Delete this conversation from your inbox?',
        )
      ) {
        return
      }

      setRoomActionBusy(
        action,
      )

      try {
        await apiFetch(
          endpoint,
          {
            method:
              'PATCH',

            body:
              JSON.stringify(
                bodyMap[
                  action
                ],
              ),
          },
        )

        const labels = {
          mute:
            'Conversation muted.',

          restrict:
            'User restricted. They can no longer send messages to you.',

          unrestrict:
            'User unrestricted. They can message you again.',

          hide:
            'Conversation deleted from your inbox only.',

          block:
            'User blocked. They can no longer contact you.',

          unblock:
            'User unblocked. They can contact you again.',
        }

        onToast?.(
          labels[action] ||
            'Conversation updated.',
          'success',
        )

        if (
          action === 'hide'
        ) {
          activeRoomRef.current =
            ''

          setActiveRoomId('')
          setMessages([])
        }

        await loadRooms()
      } catch (
        actionError
      ) {
        onToast?.(
          actionError?.message ||
            'Failed to update conversation.',
          'error',
        )
      } finally {
        setRoomActionBusy('')
      }
    }

  const createRoom =
    async (
      type,
    ) => {
      const selected =
        memberResults.filter(
          (member) =>
            selectedMemberIds.includes(
              clean(
                member.id ||
                  member.userId ||
                  member.user_id,
              ),
            ),
        )

      if (
        type === 'dm' &&
        selected.length !==
          1
      ) {
        onToast?.(
          'Select one Academy member for a direct message.',
          'error',
        )

        return
      }

      if (
        type === 'group' &&
        selected.length < 2
      ) {
        onToast?.(
          'Select at least two Academy members for a private group.',
          'error',
        )

        return
      }

      if (
        type === 'group' &&
        !clean(groupName)
      ) {
        onToast?.(
          'Enter a group name.',
          'error',
        )

        return
      }

      setCreateRoomBusy(
        true,
      )

      try {
        const payload =
          type === 'dm'
            ? {
                roomType:
                  'dm',

                targetUserId:
                  selectedMemberIds[
                    0
                  ],
              }
            : {
                roomType:
                  'group',

                name:
                  clean(
                    groupName,
                  ),

                memberUserIds:
                  selectedMemberIds,
              }

        const result =
          await apiFetch(
            '/api/realtime/rooms',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        const createdRoom =
          normalizeRoom(
            result?.room ||
              {},
          )

        if (
          !createdRoom.roomId
        ) {
          throw new Error(
            type === 'dm'
              ? 'Failed to create direct message room.'
              : 'Failed to create private group.',
          )
        }

        const nextRooms =
          await loadRooms(
            true,
          )

        const room =
          nextRooms.find(
            (item) =>
              item.roomId ===
              createdRoom.roomId,
          ) ||
          createdRoom

        setNewMessageOpen(
          false,
        )

        setSelectedMemberIds(
          [],
        )

        setMemberQuery('')
        setMemberResults([])
        setGroupName('')

        setActiveTab(
          type === 'group'
            ? 'group'
            : 'dm',
        )

        writeMessagesTab(
          type === 'group'
            ? 'group'
            : 'dm',
        )

        await openRoom(
          room,
        )

        onToast?.(
          type === 'dm'
            ? 'Direct message ready.'
            : 'Private group created.',
          'success',
        )
      } catch (
        createError
      ) {
        onToast?.(
          createError?.message ||
            'Failed to create conversation.',
          'error',
        )
      } finally {
        setCreateRoomBusy(
          false,
        )
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-workspace"
      data-yh-dashboard-react-surface="academy-messages"
    >
      <div className="academy-messages-react-shell">
        <aside className={`academy-messages-react-inbox ${
          activeRoom
            ? 'has-active-room'
            : ''
        }`}>
          <div className="academy-messages-react-inbox-head">
            <div>
              <div className="academy-profile-card-kicker">
                The Academy
              </div>

              <h2>
                Messages
              </h2>

              <small>
                {connected
                  ? 'Realtime connected'
                  : 'Connecting realtime...'}
              </small>
            </div>

            <div className="academy-messages-head-actions">
              <button
                type="button"
                className="academy-messages-icon-button"
                aria-label="New conversation"
                title="New conversation"
                onClick={() =>
                  setNewMessageOpen(
                    true,
                  )
                }
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              </button>

              <button
                type="button"
                className="academy-messages-icon-button"
                aria-label="Refresh conversations"
                title="Refresh conversations"
                disabled={roomsLoading}
                aria-busy={roomsLoading}
                onClick={() =>
                  void loadRooms()
                }
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>
              </button>
            </div>
          </div>

          <div
            className="academy-messages-inbox-tabs"
            role="tablist"
            aria-label="Conversation type"
          >
            <button
              type="button"
              role="tab"
              className={`academy-messages-inbox-tab ${
                activeTab === 'dm'
                  ? 'is-active'
                  : ''
              }`}
              aria-selected={
                activeTab === 'dm'
                  ? 'true'
                  : 'false'
              }
              onClick={() =>
                setActiveTab(
                  'dm',
                )
              }
            >
              DMs
            </button>

            <button
              type="button"
              role="tab"
              className={`academy-messages-inbox-tab ${
                activeTab === 'group'
                  ? 'is-active'
                  : ''
              }`}
              aria-selected={
                activeTab === 'group'
                  ? 'true'
                  : 'false'
              }
              onClick={() =>
                setActiveTab(
                  'group',
                )
              }
            >
              Groups
            </button>
          </div>

          <div
            className="academy-messages-inbox-list"
            data-academy-active-message-tab={
              activeTab
            }
          >
            {roomsLoading &&
              !rooms.length && (
                <div className="academy-profile-empty-state">
                  Loading
                  conversations...
                </div>
              )}

            {!roomsLoading &&
              !filteredRooms.length && (
                <div className="academy-profile-empty-state">
                  {activeTab ===
                  'group'
                    ? 'No group conversations yet. Create a group to see it here.'
                    : 'No direct messages yet. Start a DM to see it here.'}
                </div>
              )}

            {filteredRooms.map(
              (room) => (
                <button
                  type="button"
                  className={`academy-messages-inbox-card ${
                    activeRoomId ===
                    room.roomId
                      ? 'is-active'
                      : ''
                  }`}
                  key={
                    room.roomId
                  }
                  onClick={() =>
                    void openRoom(
                      room,
                    )
                  }
                >
                  <span className="academy-messages-inbox-avatar">
                    {room.avatarUrl ? (
                      <img
                        src={
                          room.avatarUrl
                        }
                        alt=""
                      />
                    ) : (
                      <span>
                        {room.type ===
                        'dm'
                          ? '💬'
                          : '👥'}
                      </span>
                    )}
                  </span>

                  <span className="academy-messages-inbox-copy">
                    <strong>
                      {room.name}
                    </strong>

                    <small>
                      {room.lastMessage
                        ? `${
                            room.lastMessageAuthor
                              ? `${room.lastMessageAuthor}: `
                              : ''
                          }${room.lastMessage}`
                        : room.type ===
                            'dm'
                          ? 'Direct message'
                          : 'Private group'}
                    </small>
                  </span>

                  <span className="academy-messages-inbox-meta">
                    <small>
                      {roomTime(
                        room,
                      )}
                    </small>

                    {room.unreadCount >
                      0 && (
                      <strong className="academy-sidebar-unread-badge">
                        {room.unreadCount >
                        99
                          ? '99+'
                          : room.unreadCount}
                      </strong>
                    )}
                  </span>
                </button>
              ),
            )}
          </div>
        </aside>

        <main className={`academy-messages-react-thread ${
          activeRoom
            ? 'is-open'
            : ''
        }`}>
          {!activeRoom ? (
            <div className="academy-messages-react-empty">
              <h3>
                Your inbox
              </h3>

              <p>
                Select a
                conversation from
                the inbox to open
                that private
                thread.
              </p>
            </div>
          ) : (
            <>
              <header className="academy-messages-thread-head">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary academy-messages-mobile-back"
                  onClick={() => {
                    activeRoomRef.current =
                      ''

                    setActiveRoomId(
                      '',
                    )

                    setMessages([])
                  }}
                >
                  ← Inbox
                </button>

                <div>
                  <strong>
                    {activeRoom.name}
                  </strong>

                  <small>
                    {activeRoom.type ===
                    'dm'
                      ? 'Direct message'
                      : `${
                          activeRoom
                            .memberIds
                            .length ||
                          activeRoom
                            .participantNames
                            .length ||
                          0
                        } members`}
                  </small>
                </div>

                <div className="academy-lead-header-actions">
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    disabled={
                      Boolean(
                        roomActionBusy,
                      )
                    }
                    onClick={() =>
                      void applyRoomAction(
                        activeRoom.isRestrictedByMe
                          ? 'unrestrict'
                          : 'restrict',
                      )
                    }
                  >
                    {activeRoom.isRestrictedByMe
                      ? 'Unrestrict'
                      : 'Restrict'}
                  </button>

                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    disabled={
                      Boolean(
                        roomActionBusy,
                      )
                    }
                    onClick={() =>
                      void applyRoomAction(
                        activeRoom.isBlockedByMe
                          ? 'unblock'
                          : 'block',
                      )
                    }
                  >
                    {activeRoom.isBlockedByMe
                      ? 'Unblock'
                      : 'Block'}
                  </button>

                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    disabled={
                      Boolean(
                        roomActionBusy,
                      )
                    }
                    onClick={() =>
                      void applyRoomAction(
                        'hide',
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </header>

              <div className="academy-messages-thread-history">
                {threadLoading &&
                  !messages.length && (
                    <div className="academy-profile-empty-state">
                      Loading
                      messages...
                    </div>
                  )}

                {!threadLoading &&
                  !messages.length && (
                    <div className="academy-profile-empty-state">
                      This is the
                      beginning of
                      your private
                      history with{' '}
                      <strong>
                        {
                          activeRoom.name
                        }
                      </strong>
                      .
                    </div>
                  )}

                {messages.map(
                  (
                    message,
                    index,
                  ) => {
                    const own =
                      isOwnMessage(
                        message,
                      )

                    const messageAttachment =
                      getAttachment(
                        message,
                      )

                    return (
                      <article
                        className={`academy-message-bubble ${
                          own
                            ? 'is-own'
                            : 'is-other'
                        }`}
                        key={
                          getMessageId(
                            message,
                          ) ||
                          `${activeRoomId}-${index}`
                        }
                      >
                        {!own && (
                          <strong>
                            {getMessageAuthor(
                              message,
                            )}
                          </strong>
                        )}

                        {getMessageText(
                          message,
                        ) && (
                          <p>
                            {getMessageText(
                              message,
                            )}
                          </p>
                        )}

                        <MessageAttachment
                          attachment={
                            messageAttachment
                          }
                        />

                        <small>
                          {getMessageDate(
                            message,
                          )}
                        </small>

                        {own && getMessageId(message) && (
                          <div className="roadmap-mission-actions academy-message-actions">
                            <button
                              type="button"
                              className="academy-ui-button academy-ui-button--secondary"
                              disabled={
                                messageActionBusy ===
                                ('edit:' + getMessageId(message))
                              }
                              onClick={() =>
                                void runMessageAction(
                                  'edit',
                                  message,
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="academy-ui-button academy-ui-button--secondary"
                              disabled={
                                messageActionBusy ===
                                ('hide:' + getMessageId(message))
                              }
                              onClick={() =>
                                void runMessageAction(
                                  'unsend-me',
                                  message,
                                )
                              }
                            >
                              Unsend for Me
                            </button>

                            <button
                              type="button"
                              className="academy-ui-button academy-ui-button--secondary"
                              disabled={
                                messageActionBusy ===
                                ('delete:' + getMessageId(message))
                              }
                              onClick={() =>
                                void runMessageAction(
                                  'unsend-everyone',
                                  message,
                                )
                              }
                            >
                              Unsend for Everyone
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  },
                )}

                <div
                  ref={
                    bottomRef
                  }
                />
              </div>

              <form
                className="academy-messages-thread-composer"
                onSubmit={
                  sendMessage
                }
              >
                {attachment && (
                  <div className="academy-message-upload-preview">
                    <span>
                      📎{' '}
                      {clean(
                        attachment.originalName ||
                          attachment.name ||
                          'Attachment',
                      )}
                    </span>

                    <button
                      type="button"
                      className="academy-ui-button academy-ui-button--secondary"
                      onClick={() =>
                        setAttachment(
                          null,
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="academy-messages-composer-row">
                  <label className="academy-ui-button academy-ui-button--secondary">
                    {uploadBusy
                      ? 'Uploading...'
                      : '＋'}

                    <input
                      type="file"
                      hidden
                      disabled={
                        uploadBusy
                      }
                      onChange={(
                        event,
                      ) => {
                        const file =
                          event.target
                            .files?.[0]

                        if (file) {
                          void uploadFile(
                            file,
                          )
                        }

                        event.target.value =
                          ''
                      }}
                    />
                  </label>

                  <textarea
                    className="input-field"
                    rows="1"
                    value={
                      composer
                    }
                    disabled={
                      activeRoom.isBlocked ||
                      activeRoom.isBlockedByMe
                    }
                    placeholder={
                      activeRoom.isBlocked ||
                      activeRoom.isBlockedByMe
                        ? 'Messaging is unavailable for this conversation.'
                        : 'Message...'
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
                        void sendMessage(
                          event,
                        )
                      }
                    }}
                  />

                  <button
                    type="submit"
                    className="academy-ui-button academy-ui-button--primary"
                    disabled={
                      sendBusy ||
                      uploadBusy ||
                      activeRoom.isBlocked ||
                      activeRoom.isBlockedByMe
                    }
                  >
                    {sendBusy
                      ? 'Sending...'
                      : 'Send'}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>

      {newMessageOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="New Academy Conversation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !createRoomBusy
            ) {
              setNewMessageOpen(
                false,
              )
            }
          }}
        >
          <div className="modal-content academy-messages-new-room-modal">
            <div className="academy-profile-card-kicker">
              Academy
              Messages
            </div>

            <h2>
              New Conversation
            </h2>

            <input
              className="input-field"
              value={
                memberQuery
              }
              placeholder="Search Academy members..."
              onChange={(
                event,
              ) =>
                setMemberQuery(
                  event.target
                    .value,
                )
              }
            />

            <div className="academy-messages-member-picker">
              {memberSearchBusy && (
                <div className="academy-profile-empty-state">
                  Searching...
                </div>
              )}

              {!memberSearchBusy &&
                memberResults.map(
                  (member) => {
                    const id =
                      clean(
                        member.id ||
                          member.userId ||
                          member.user_id,
                      )

                    const selected =
                      selectedMemberIds.includes(
                        id,
                      )

                    return (
                      <button
                        type="button"
                        key={id}
                        className={`academy-member-card ${
                          selected
                            ? 'is-selected'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedMemberIds(
                            (current) =>
                              selected
                                ? current.filter(
                                    (
                                      value,
                                    ) =>
                                      value !==
                                      id,
                                  )
                                : [
                                    ...current,
                                    id,
                                  ],
                          )
                        }
                      >
                        <strong>
                          {clean(
                            member.display_name ||
                              member.displayName ||
                              member.fullName ||
                              member.full_name ||
                              member.username ||
                              'Academy Member',
                          )}
                        </strong>

                        <span>
                          {selected
                            ? 'Selected'
                            : 'Select'}
                        </span>
                      </button>
                    )
                  },
                )}
            </div>

            {selectedMemberIds.length >=
              2 && (
              <input
                className="input-field"
                value={
                  groupName
                }
                placeholder="Private group name"
                onChange={(
                  event,
                ) =>
                  setGroupName(
                    event.target
                      .value,
                  )
                }
              />
            )}

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  createRoomBusy
                }
                onClick={() =>
                  setNewMessageOpen(
                    false,
                  )
                }
              >
                Cancel
              </button>

              {selectedMemberIds.length ===
                1 && (
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--primary"
                  disabled={
                    createRoomBusy
                  }
                  onClick={() =>
                    void createRoom(
                      'dm',
                    )
                  }
                >
                  {createRoomBusy
                    ? 'Opening...'
                    : 'Start DM'}
                </button>
              )}

              {selectedMemberIds.length >=
                2 && (
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--primary"
                  disabled={
                    createRoomBusy
                  }
                  onClick={() =>
                    void createRoom(
                      'group',
                    )
                  }
                >
                  {createRoomBusy
                    ? 'Creating...'
                    : 'Create Private Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
