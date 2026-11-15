import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../services/api/apiClient'

const RTC_CONFIG = {
  iceServers: [
    {
      urls:
        'stun:stun.l.google.com:19302',
    },
    {
      urls:
        'stun:stun1.l.google.com:19302',
    },
  ],
}

const MAX_ROOM_AGE_MS =
  24 * 60 * 60 * 1000

function clean(value = '') {
  return String(
    value ?? '',
  ).trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function stored(key = '') {
  try {
    return (
      sessionStorage.getItem(
        key,
      ) ||
      localStorage.getItem(
        key,
      ) ||
      ''
    )
  } catch {
    return ''
  }
}

function token() {
  return (
    stored('yh_token') ||
    stored('token')
  )
}

function currentUserId() {
  return clean(
    stored('yh_user_id') ||
      stored('yh_user_uid'),
  )
}

function displayName() {
  return clean(
    stored('yh_user_name') ||
      stored('yh_user_username') ||
      'YH Member',
  )
}

function roomId(room = {}) {
  return clean(
    room.id ||
      room.roomId ||
      room.room_id,
  )
}

function roomType(room = {}) {
  return clean(
    room.room_type ||
      room.roomType ||
      room.type ||
      'voice',
  ).toLowerCase()
}

function roomStatus(room = {}) {
  return clean(
    room.status ||
      room.room_status ||
      'live',
  ).toLowerCase()
}

function roomStartedAt(
  room = {},
) {
  const raw =
    room.started_at ||
    room.startedAt ||
    room.created_at ||
    room.createdAt ||
    ''

  const time =
    new Date(raw).getTime()

  return Number.isFinite(
    time,
  )
    ? time
    : 0
}

function isJoinable(
  room = {},
) {
  if (
    roomType(room) !==
    'voice'
  ) {
    return false
  }

  if (
    roomStatus(room) !==
    'live'
  ) {
    return false
  }

  if (
    room.ended_at ||
    room.endedAt
  ) {
    return false
  }

  const started =
    roomStartedAt(room)

  if (
    started &&
    Date.now() -
      started >=
      MAX_ROOM_AGE_MS
  ) {
    return false
  }

  return true
}

function hostId(room = {}) {
  return clean(
    room.host_user_id ||
      room.hostUserId ||
      room.host_id ||
      room.hostId,
  )
}

function hostName(room = {}) {
  return clean(
    room.host_user_name ||
      room.hostUserName ||
      room.host_name ||
      room.hostName ||
      'YH Member',
  )
}

function participantCount(
  room = {},
) {
  return Math.max(
    1,
    Number(
      room.participant_count ??
        room.participantCount ??
        room.participants_count ??
        1,
    ) || 1,
  )
}

/* YHU_ACADEMY_A14_STAGE_CHAT_ORIGINAL_PARITY */
function stageRoomId(message = {}) {
  return clean(message?.roomId || message?.room_id || message?.room)
}

function stageMessageId(message = {}) {
  return clean(message?.id || message?.messageId)
}

function stageClientId(message = {}) {
  return clean(message?.clientMessageId || message?.client_message_id)
}

function mergeStageMessage(existing, next) {
  const id = stageMessageId(next)
  const client = stageClientId(next)
  const index = existing.findIndex((item) =>
    (id && stageMessageId(item) === id) ||
    (client && (
      stageClientId(item) === client ||
      stageMessageId(item) === client
    )) ||
    (id && stageClientId(item) === id)
  )

  if (index < 0) return [...existing, next]
  return existing.map((item, i) =>
    i === index ? { ...item, ...next } : item
  )
}

export default function AcademyVoiceWorkspace({
  onToast,
}) {
  const socketRef =
    useRef(null)

  const streamRef =
    useRef(null)

  /* YHU_ACADEMY_A11_VOICE_MIC_REQUEST_LIFECYCLE_GUARD */
  const mediaRequestRef = useRef(null)
  const mediaGenerationRef = useRef(0)
  const mediaMountedRef = useRef(true)

  const peersRef =
    useRef(new Map())

  const pendingIceRef = useRef(new Map())

  const audioRefs =
    useRef(new Map())

  const peerMutedRef =
    useRef(new Map())

  const audioBankRef =
    useRef(null)

  const activeRoomRef =
    useRef(null)

  const stageEpochRef = useRef(0)
  const stageTimersRef = useRef(new Set())
  const stageHistoryRef = useRef(null)
  const [stageMessages, setStageMessages] = useState([])
  const [stageDraft, setStageDraft] = useState('')
  const [stageSending, setStageSending] = useState(0)

  const mutedRef =
    useRef(false)

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    connected,
    setConnected,
  ] = useState(false)

  const [
    signalingJoined,
    setSignalingJoined,
  ] = useState(false)

  const [
    mutedPeerCount,
    setMutedPeerCount,
  ] = useState(0)

  const [
    activeRoom,
    setActiveRoom,
  ] = useState(null)

  const [
    joiningRoomId,
    setJoiningRoomId,
  ] = useState('')

  const [
    muted,
    setMuted,
  ] = useState(false)

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false)

  const [
    createBusy,
    setCreateBusy,
  ] = useState(false)

  const [
    title,
    setTitle,
  ] = useState('')

  const [
    topic,
    setTopic,
  ] = useState('')

  const [
    ending,
    setEnding,
  ] = useState(false)

  const [
    leaving,
    setLeaving,
  ] = useState(false)

  useEffect(() => {
    const node = stageHistoryRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [stageMessages])

  const resetStageChat = () => {
    stageEpochRef.current += 1
    for (const timer of stageTimersRef.current) {
      window.clearTimeout(timer)
    }
    stageTimersRef.current.clear()
    setStageMessages([])
    setStageDraft('')
    setStageSending(0)
  }

  const isHost =
    useMemo(() => {
      if (!activeRoom) {
        return false
      }

      const me =
        currentUserId()

      const owner =
        hostId(
          activeRoom,
        )

      return Boolean(
        me &&
          owner &&
          me === owner,
      )
    }, [activeRoom])

  const closePeer =
    useCallback(
      (peerSocketId) => {
        const id =
          clean(
            peerSocketId,
          )

        if (!id) return

        pendingIceRef.current.delete(id)

        const pc =
          peersRef.current.get(
            id,
          )

        if (pc) {
          try {
            pc.onicecandidate =
              null

            pc.ontrack =
              null

            pc.onconnectionstatechange =
              null

            pc.close()
          } catch {}

          peersRef.current.delete(
            id,
          )
        }

        const audio =
          audioRefs.current.get(
            id,
          )

        if (audio) {
          try {
            audio.pause()
            audio.srcObject =
              null
            audio.remove()
          } catch {}

          audioRefs.current.delete(
            id,
          )
        }

        if (
          peerMutedRef.current.has(
            id,
          )
        ) {
          peerMutedRef.current.delete(
            id,
          )

          setMutedPeerCount(
            Array.from(
              peerMutedRef.current.values(),
            ).filter(Boolean)
              .length,
          )
        }
      },
      [],
    )

  const stopLocalStream =
    useCallback(() => {
      mediaGenerationRef.current += 1
      mediaRequestRef.current = null

      const stream =
        streamRef.current

      if (stream) {
        safeArray(
          stream.getTracks?.(),
        ).forEach(
          (track) => {
            try {
              track.stop()
            } catch {}
          },
        )
      }

      streamRef.current =
        null
    }, [])

  const cleanupRtc =
    useCallback(
      ({
        emitLeave = false,
      } = {}) => {
        const currentRoom =
          activeRoomRef.current

        const id =
          roomId(
            currentRoom ||
              {},
          )

        if (
          emitLeave &&
          id &&
          socketRef.current
            ?.connected
        ) {
          socketRef.current.emit(
            'academyVoice:leave',
            {
              roomId: id,
            },
          )
        }

        Array.from(
          peersRef.current.keys(),
        ).forEach(
          closePeer,
        )
        pendingIceRef.current.clear()

        stopLocalStream()

        activeRoomRef.current =
          null

        mutedRef.current =
          false

        peerMutedRef.current.clear()

        setMuted(false)

        setMutedPeerCount(0)

        setSignalingJoined(
          false,
        )
      },
      [
        closePeer,
        stopLocalStream,
      ],
    )

  const ensureLocalStream =
    useCallback(async () => {
      const existing = streamRef.current

      if (
        existing?.getAudioTracks?.().some(
          (track) => track.readyState === 'live',
        )
      ) {
        return existing
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone access is not supported on this device.',
        )
      }

      if (mediaRequestRef.current) {
        return mediaRequestRef.current
      }

      const generation = mediaGenerationRef.current

      const request = navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }).then((stream) => {
        if (
          !mediaMountedRef.current ||
          mediaGenerationRef.current !== generation
        ) {
          safeArray(stream.getTracks?.()).forEach((track) => {
            try {
              track.stop()
            } catch {}
          })

          throw new Error(
            'Microphone request was cancelled.',
          )
        }

        streamRef.current = stream

        stream.getAudioTracks().forEach((track) => {
          track.enabled = !mutedRef.current
        })

        return stream
      })

      mediaRequestRef.current = request

      try {
        return await request
      } finally {
        if (mediaRequestRef.current === request) {
          mediaRequestRef.current = null
        }
      }
    }, [])

  const attachRemoteStream =
    useCallback(
      (
        peerSocketId,
        stream,
      ) => {
        const id =
          clean(
            peerSocketId,
          )

        if (
          !id ||
          !stream
        ) {
          return
        }

        let audio =
          audioRefs.current.get(
            id,
          )

        if (!audio) {
          audio =
            document.createElement(
              'audio',
            )

          audio.autoplay =
            true

          audio.playsInline =
            true

          audio.setAttribute(
            'data-academy-voice-peer',
            id,
          )

          audioBankRef.current?.appendChild(
            audio,
          )

          audioRefs.current.set(
            id,
            audio,
          )
        }

        if (
          audio.srcObject !==
          stream
        ) {
          audio.srcObject =
            stream
        }

        audio
          .play()
          .catch(() => {})
      },
      [],
    )

  const createPeer =
    useCallback(
      (peerSocketId) => {
        const id =
          clean(
            peerSocketId,
          )

        if (!id) {
          throw new Error(
            'Missing peer socket id.',
          )
        }

        const existing =
          peersRef.current.get(
            id,
          )

        if (existing) {
          return existing
        }

        const pc =
          new RTCPeerConnection(
            RTC_CONFIG,
          )

        const localStream =
          streamRef.current

        localStream
          ?.getAudioTracks?.()
          .forEach(
            (track) => {
              pc.addTrack(
                track,
                localStream,
              )
            },
          )

        pc.ontrack = (
          event,
        ) => {
          const remoteStream =
            event.streams?.[0]

          if (remoteStream) {
            attachRemoteStream(
              id,
              remoteStream,
            )
          }
        }

        pc.onicecandidate = (
          event,
        ) => {
          if (
            !event.candidate
          ) {
            return
          }

          const active =
            activeRoomRef.current

          const activeId =
            roomId(
              active || {},
            )

          if (!activeId) {
            return
          }

          socketRef.current?.emit(
            'academyVoice:ice',
            {
              roomId:
                activeId,

              targetSocketId:
                id,

              candidate:
                event.candidate,
            },
          )
        }

        pc.onconnectionstatechange =
          () => {
            if (
              [
                'failed',
                'closed',
                'disconnected',
              ].includes(
                pc.connectionState,
              )
            ) {
              closePeer(id)
            }
          }

        peersRef.current.set(
          id,
          pc,
        )

        return pc
      },
      [
        attachRemoteStream,
        closePeer,
      ],
    )

  const flushPendingIce = useCallback(async (peerId, pc) => {
    const queued = pendingIceRef.current.get(peerId) || []
    pendingIceRef.current.delete(peerId)

    for (const candidate of queued) {
      if (peersRef.current.get(peerId) !== pc || !pc.remoteDescription) break
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn('Voice ICE candidate:', error)
      }
    }
  }, [])

  const loadRooms =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setLoading(true)
        }

        try {
          const result =
            await apiFetch(
              '/api/realtime/live-rooms',
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
            ).filter(
              isJoinable,
            )

          setRooms(
            nextRooms,
          )

          return nextRooms
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Failed to load live voice rooms.',
            'error',
          )

          return []
        } finally {
          if (!silent) {
            setLoading(false)
          }
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  useEffect(() => {
    mediaMountedRef.current = true

    const socket =
      io({
        withCredentials:
          true,

        transports: [
          'websocket',
          'polling',
        ],

        auth:
          token()
            ? {
                token:
                  token(),
              }
            : {},
      })

    socketRef.current =
      socket

    const onConnect =
      () => {
        setConnected(true)

        const current =
          activeRoomRef.current

        const id =
          roomId(
            current || {},
          )

        if (id) {
          socket.emit(
            'joinRoom',
            id,
          )

          socket.emit(
            'academyVoice:join',
            {
              roomId: id,
              displayName:
                displayName(),
              attempt: 1,
            },
          )
        }
      }

    const onDisconnect =
      () => {
        setConnected(false)

        setSignalingJoined(
          false,
        )

        Array.from(
          peersRef.current.keys(),
        ).forEach(closePeer)

        pendingIceRef.current.clear()
        peerMutedRef.current.clear()
        setMutedPeerCount(0)
      }

    const onJoined =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        setSignalingJoined(
          true,
        )
      }

    const onPeers =
      async (
        payload = {},
      ) => {
        const current =
          activeRoomRef.current

        const id =
          roomId(
            current || {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        await ensureLocalStream()

        for (
          const peer of
          safeArray(
            payload.peers,
          )
        ) {
          const peerId =
            clean(
              peer?.socketId,
            )

          if (!peerId) {
            continue
          }

          try {
            const pc =
              createPeer(
                peerId,
              )

            const offer =
              await pc.createOffer(
                {
                  offerToReceiveAudio:
                    true,
                  offerToReceiveVideo:
                    false,
                },
              )

            await pc.setLocalDescription(
              offer,
            )

            socket.emit(
              'academyVoice:offer',
              {
                roomId: id,
                targetSocketId:
                  peerId,
                offer:
                  pc.localDescription,
              },
            )
          } catch (
            error
          ) {
            console.error(
              'Voice offer error:',
              error,
            )
          }
        }
      }

    const onPeerJoined =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        onToast?.(
          `${clean(
            payload.displayName ||
              'A member',
          )} joined the voice room.`,
          'success',
        )

        void loadRooms(
          true,
        )
      }

    const onOffer =
      async (
        payload = {},
      ) => {
        const current =
          activeRoomRef.current

        const id =
          roomId(
            current || {},
          )

        const fromId =
          clean(
            payload.fromSocketId,
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id ||
          !fromId ||
          !payload.offer
        ) {
          return
        }

        try {
          await ensureLocalStream()

          const pc =
            createPeer(
              fromId,
            )

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              payload.offer,
            ),
          )
          await flushPendingIce(fromId, pc)

          const answer =
            await pc.createAnswer()

          await pc.setLocalDescription(
            answer,
          )

          socket.emit(
            'academyVoice:answer',
            {
              roomId: id,
              targetSocketId:
                fromId,
              answer:
                pc.localDescription,
            },
          )
        } catch (
          error
        ) {
          onToast?.(
            'Failed to connect voice audio.',
            'error',
          )
        }
      }

    const onAnswer =
      async (
        payload = {},
      ) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        const fromId =
          clean(
            payload.fromSocketId,
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id ||
          !fromId ||
          !payload.answer
        ) {
          return
        }

        try {
          const pc =
            peersRef.current.get(
              fromId,
            )

          if (!pc) return

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              payload.answer,
            ),
          )
          await flushPendingIce(fromId, pc)
        } catch {}
      }

    const onIce =
      async (
        payload = {},
      ) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        const fromId =
          clean(
            payload.fromSocketId,
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id ||
          !fromId ||
          !payload.candidate
        ) {
          return
        }

        try {
          const pc =
            peersRef.current.get(
              fromId,
            )

          if (!pc?.remoteDescription) {
            const queued = pendingIceRef.current.get(fromId) || []
            pendingIceRef.current.set(
              fromId,
              [...queued, payload.candidate].slice(-64),
            )
            return
          }

          await pc.addIceCandidate(
            new RTCIceCandidate(
              payload.candidate,
            ),
          )
        } catch {}
      }

    const onPeerLeft =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        const peerId =
          clean(
            payload.socketId,
          )

        if (peerId) {
          closePeer(
            peerId,
          )
        }

        void loadRooms(
          true,
        )
      }

    const onPeerMuted =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        const socketId =
          clean(
            payload.socketId ||
              payload.peerSocketId ||
              payload.fromSocketId,
          )

        if (!socketId) {
          return
        }

        peerMutedRef.current.set(
          socketId,
          payload.muted === true,
        )

        setMutedPeerCount(
          Array.from(
            peerMutedRef.current.values(),
          ).filter(Boolean)
            .length,
        )
      }

    const onVoiceError =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        const payloadRoomId =
          clean(
            payload.roomId ||
              payload.room_id,
          )

        const message =
          clean(
            payload.message,
          ) ||
          'Voice connection error.'

        const localDev =
          [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
          ].includes(
            clean(
              window.location
                .hostname,
            ),
          )

        /*
         * Preserve the legacy localhost suppression.
         */
        if (
          localDev &&
          /liveRoomsCol is not defined/i.test(
            message,
          )
        ) {
          console.warn(
            'Academy local voice socket error suppressed:',
            message,
          )

          return
        }

        if (
          !payloadRoomId ||
          !id ||
          payloadRoomId === id
        ) {
          setSignalingJoined(
            false,
          )
        }

        onToast?.(
          message,
          'error',
        )
      }

    const onRoomEnded =
      (payload = {}) => {
        const id =
          roomId(
            activeRoomRef.current ||
              {},
          )

        if (
          !id ||
          clean(
            payload.roomId,
          ) !== id
        ) {
          return
        }

        cleanupRtc({
          emitLeave:
            false,
        })

        resetStageChat()
        setActiveRoom(
          null,
        )

        onToast?.(
          'This voice room has ended.',
          'success',
        )

        void loadRooms()
      }

    socket.on(
      'connect',
      onConnect,
    )

    const onStageHistory = (payload = {}) => {
      const activeId = roomId(activeRoomRef.current || {})
      const incomingId = Array.isArray(payload)
        ? ''
        : stageRoomId(payload)

      if (!activeId || (incomingId && incomingId !== activeId)) return

      const history = Array.isArray(payload)
        ? payload
        : safeArray(payload?.messages)

      setStageMessages((current) => {
        const inFlight = current.filter(
          (message) => message._stageStatus === 'sending'
        )
        return history.reduce(
          (list, message) => mergeStageMessage(list, message),
          inFlight
        )
      })
    }

    const onStageMessage = (message = {}) => {
      const activeId = roomId(activeRoomRef.current || {})
      if (!activeId || stageRoomId(message) !== activeId) return

      setStageMessages((current) =>
        mergeStageMessage(current, {
          ...message,
          _stageStatus: 'sent',
        })
      )
    }

    socket.on(
      'disconnect',
      onDisconnect,
    )

    socket.on('chatHistory', onStageHistory)
    socket.on('receiveMessage', onStageMessage)

    socket.on(
      'academyVoice:joined',
      onJoined,
    )

    socket.on(
      'academyVoice:peers',
      onPeers,
    )

    socket.on(
      'academyVoice:peerJoined',
      onPeerJoined,
    )

    socket.on(
      'academyVoice:offer',
      onOffer,
    )

    socket.on(
      'academyVoice:answer',
      onAnswer,
    )

    socket.on(
      'academyVoice:ice',
      onIce,
    )

    socket.on(
      'academyVoice:peerLeft',
      onPeerLeft,
    )

    socket.on(
      'academyVoice:peerMuted',
      onPeerMuted,
    )

    socket.on(
      'academyVoice:error',
      onVoiceError,
    )

    socket.on(
      'academyVoice:roomEnded',
      onRoomEnded,
    )

    return () => {
      mediaMountedRef.current = false

      cleanupRtc({
        emitLeave:
          true,
      })

      socket.off(
        'connect',
        onConnect,
      )

      socket.off(
        'disconnect',
        onDisconnect,
      )

      socket.off('chatHistory', onStageHistory)
      socket.off('receiveMessage', onStageMessage)
      resetStageChat()

      socket.off(
        'academyVoice:joined',
        onJoined,
      )

      socket.off(
        'academyVoice:peers',
        onPeers,
      )

      socket.off(
        'academyVoice:peerJoined',
        onPeerJoined,
      )

      socket.off(
        'academyVoice:offer',
        onOffer,
      )

      socket.off(
        'academyVoice:answer',
        onAnswer,
      )

      socket.off(
        'academyVoice:ice',
        onIce,
      )

      socket.off(
        'academyVoice:peerLeft',
        onPeerLeft,
      )

      socket.off(
        'academyVoice:peerMuted',
        onPeerMuted,
      )

      socket.off(
        'academyVoice:error',
        onVoiceError,
      )

      socket.off(
        'academyVoice:roomEnded',
        onRoomEnded,
      )

      socket.disconnect()

      socketRef.current =
        null
    }
  }, [
    cleanupRtc,
    closePeer,
    createPeer,
    ensureLocalStream,
    flushPendingIce,
    loadRooms,
    onToast,
  ])

  const waitForSocket =
    async () => {
      const socket =
        socketRef.current

      if (!socket) {
        throw new Error(
          'Voice socket is not available. Refresh and try again.',
        )
      }

      if (
        socket.connected
      ) {
        return true
      }

      await new Promise(
        (
          resolve,
          reject,
        ) => {
          let finished =
            false

          const timer =
            window.setTimeout(
              () => {
                if (
                  finished
                ) {
                  return
                }

                finished =
                  true

                reject(
                  new Error(
                    'Voice socket connection timed out.',
                  ),
                )
              },
              4500,
            )

          socket.once(
            'connect',
            () => {
              if (
                finished
              ) {
                return
              }

              finished =
                true

              window.clearTimeout(
                timer,
              )

              resolve(true)
            },
          )
        },
      )

      return true
    }

  const joinSignaling =
    async (id) => {
      const socket =
        socketRef.current

      let lastError =
        null

      for (
        let attempt = 1;
        attempt <= 4;
        attempt += 1
      ) {
        try {
          const ack =
            await new Promise(
              (
                resolve,
                reject,
              ) => {
                let done =
                  false

                const timer =
                  window.setTimeout(
                    () => {
                      if (
                        done
                      ) {
                        return
                      }

                      done =
                        true

                      reject(
                        new Error(
                          'Voice signaling confirmation timed out.',
                        ),
                      )
                    },
                    3200 +
                      attempt *
                        700,
                  )

                socket.emit(
                  'academyVoice:join',
                  {
                    roomId:
                      id,

                    displayName:
                      displayName(),

                    attempt,
                  },
                  (
                    result = {},
                  ) => {
                    if (
                      done
                    ) {
                      return
                    }

                    done =
                      true

                    window.clearTimeout(
                      timer,
                    )

                    if (
                      result?.success ===
                      false
                    ) {
                      reject(
                        new Error(
                          result?.message ||
                            'Failed to join voice signaling.',
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

          return ack
        } catch (
          error
        ) {
          lastError =
            error

          if (
            attempt < 4
          ) {
            await new Promise(
              (resolve) =>
                window.setTimeout(
                  resolve,
                  450 +
                    attempt *
                      250,
                ),
            )
          }
        }
      }

      throw (
        lastError ||
        new Error(
          'Failed to join voice signaling.',
        )
      )
    }

  const joinRoom =
    async (room) => {
      const id =
        roomId(room)

      if (!id) return

      setJoiningRoomId(
        id,
      )

      try {
        await ensureLocalStream()

        await waitForSocket()

        const result =
          await apiFetch(
            `/api/realtime/live-rooms/${encodeURIComponent(
              id,
            )}/join`,
            {
              method:
                'POST',
            },
          )

        const joinedRoom =
          result?.room &&
          typeof result.room ===
            'object'
            ? result.room
            : room

        resetStageChat()
        activeRoomRef.current =
          joinedRoom

        setActiveRoom(
          joinedRoom,
        )

        socketRef.current.emit(
          'joinRoom',
          id,
        )

        await joinSignaling(
          id,
        )

        onToast?.(
          'Voice connected. You can now talk in this room.',
          'success',
        )

        await loadRooms(
          true,
        )
      } catch (
        error
      ) {
        cleanupRtc({
          emitLeave:
            false,
        })

        setActiveRoom(
          null,
        )

        onToast?.(
          error?.message ||
            'Failed to join live voice room.',
          'error',
        )
      } finally {
        setJoiningRoomId('')
      }
    }

  const sendStageChat = () => {
    const id = roomId(activeRoomRef.current || {})
    const socket = socketRef.current
    const text = clean(stageDraft)

    if (!id || !text) return

    if (!socket?.connected) {
      onToast?.('Stage chat is not connected.', 'error')
      return
    }

    const epoch = stageEpochRef.current

    const suffix = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : Date.now() + '_' + Math.random().toString(36).slice(2)

    const clientMessageId = ('academy_' + id + '_' + suffix)
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 160)

    const message = {
      id: clientMessageId,
      roomId: id,
      room: id,

      /* YHU_ACADEMY_A16_STAGE_METADATA_DOM_PARITY */
      roomName: clean(
        activeRoomRef.current?.title ||
        activeRoomRef.current?.name ||
        activeRoomRef.current?.room_name ||
        'Voice Lounge'
      ),

      text,
      type: 'live-voice',
      privacy: 'private',
      author: displayName(),
      authorId: currentUserId(),
      clientMessageId,
      client_message_id: clientMessageId,
      time: new Date().toISOString(),
      _stageStatus: 'sending',
    }

    setStageDraft('')
    setStageMessages((current) =>
      mergeStageMessage(current, message)
    )
    setStageSending((current) => current + 1)

    let finished = false
    let timeoutId = null

    const finish = (error, ack = {}) => {
      if (finished) return
      finished = true

      window.clearTimeout(timeoutId)
      stageTimersRef.current.delete(timeoutId)

      if (
        stageEpochRef.current !== epoch ||
        roomId(activeRoomRef.current || {}) !== id
      ) return

      setStageSending((current) => Math.max(0, current - 1))

      if (error) {
        setStageMessages((current) =>
          mergeStageMessage(current, {
            ...message,
            _stageStatus: 'failed',
          })
        )
        setStageDraft((current) => current.trim() ? current : text)
        onToast?.(
          error.message || 'Stage message failed; draft restored.',
          'error'
        )
      } else {
        const confirmed =
          ack?.message && typeof ack.message === 'object'
            ? ack.message
            : {}

        setStageMessages((current) =>
          mergeStageMessage(current, {
            ...message,
            ...confirmed,
            clientMessageId,
            client_message_id: clientMessageId,
            _stageStatus: 'sent',
          })
        )
      }
    }

    timeoutId = window.setTimeout(
      () => finish(new Error('Stage message timed out; draft restored.')),
      15000
    )

    stageTimersRef.current.add(timeoutId)

    socket.emit('sendMessage', message, (ack = {}) => {
      if (ack?.success !== true) {
        finish(
          new Error(
            clean(ack?.message) || 'Stage message could not be sent.'
          )
        )
      } else {
        finish(null, ack)
      }
    })
  }

  const leaveRoom =
    async () => {
      const room =
        activeRoomRef.current

      const id =
        roomId(room || {})

      if (!id) return

      setLeaving(true)

      try {
        try {
          await apiFetch(
            `/api/realtime/live-rooms/${encodeURIComponent(
              id,
            )}/leave`,
            {
              method:
                'POST',
            },
          )
        } catch {}

        cleanupRtc({
          emitLeave:
            true,
        })

        resetStageChat()
        setActiveRoom(
          null,
        )

        onToast?.(
          'You left the voice room.',
          'success',
        )

        await loadRooms()
      } finally {
        setLeaving(false)
      }
    }

  const toggleMute =
    () => {
      const next =
        !mutedRef.current

      mutedRef.current =
        next

      setMuted(next)

      streamRef.current
        ?.getAudioTracks?.()
        .forEach(
          (track) => {
            track.enabled =
              !next
          },
        )

      const id =
        roomId(
          activeRoomRef.current ||
            {},
        )

      if (
        id &&
        socketRef.current
          ?.connected
      ) {
        socketRef.current.emit(
          'academyVoice:mute',
          {
            roomId: id,
            muted: next,
          },
        )
      }

      onToast?.(
        next
          ? 'Microphone muted.'
          : 'Microphone active.',
        next
          ? 'error'
          : 'success',
      )
    }

  const endRoom =
    async () => {
      const room =
        activeRoomRef.current

      const id =
        roomId(room || {})

      if (!id) return

      if (
        !window.confirm(
          'End this voice room for everyone?',
        )
      ) {
        return
      }

      setEnding(true)

      try {
        await apiFetch(
          `/api/realtime/live-rooms/${encodeURIComponent(
            id,
          )}/end`,
          {
            method:
              'POST',
          },
        )

        cleanupRtc({
          emitLeave:
            false,
        })

        setActiveRoom(
          null,
        )

        onToast?.(
          'Voice room ended.',
          'success',
        )

        await loadRooms()
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Failed to end voice room.',
          'error',
        )
      } finally {
        setEnding(false)
      }
    }

  const createRoom =
    async (event) => {
      event.preventDefault()

      const cleanTitle =
        clean(title)

      const cleanTopic =
        clean(topic)

      if (!cleanTitle) {
        onToast?.(
          'Room title is required.',
          'error',
        )

        return
      }

      setCreateBusy(true)

      try {
        await ensureLocalStream()

        const result =
          await apiFetch(
            '/api/realtime/live-rooms',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  roomType:
                    'voice',

                  title:
                    cleanTitle,

                  topic:
                    cleanTopic,
                }),
            },
          )

        const created =
          result?.room &&
          typeof result.room ===
            'object'
            ? result.room
            : null

        if (
          !created ||
          !roomId(created)
        ) {
          throw new Error(
            'Failed to start live voice lounge.',
          )
        }

        setCreateOpen(false)
        setTitle('')
        setTopic('')

        onToast?.(
          'Live voice lounge started.',
          'success',
        )

        await loadRooms(
          true,
        )

        await joinRoom(
          created,
        )
      } catch (
        error
      ) {
        stopLocalStream()

        onToast?.(
          error?.message ||
            'Failed to start live voice lounge.',
          'error',
        )
      } finally {
        setCreateBusy(false)
      }
    }

  return (
    <section
      id={activeRoom ? 'center-stage-view' : undefined}
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-workspace"
      data-yh-dashboard-react-surface="academy-voice"
    >
      <div
        ref={audioBankRef}
        className="academy-voice-audio-bank"
        aria-hidden="true"
      />

      {!activeRoom ? (
        <div className="academy-lead-missions-scroll">
          <div className="academy-lead-missions-shell">
            <section className="academy-lead-missions-hero">
              <div>
                <div className="academy-profile-card-kicker">
                  Live Audio
                </div>

                <h2 className="academy-lead-missions-title">
                  Voice Lounge
                </h2>

                <p className="academy-lead-missions-copy">
                  Join live
                  conversations
                  with Academy
                  members or start
                  your own room.
                </p>

                <small>
                  {connected
                    ? 'Realtime connected'
                    : 'Connecting realtime...'}
                </small>

                <div className="academy-voice-actions">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    void loadRooms()
                  }
                >
                  {loading
                    ? 'Refreshing...'
                    : 'Refresh'}
                </button>

                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--primary"
                  onClick={() =>
                    setCreateOpen(
                      true,
                    )
                  }
                >
                  + Start Lounge
                </button>
                </div>
              </div>
            </section>

            {loading &&
              !rooms.length && (
                <div className="academy-profile-empty-state">
                  Loading live
                  lounges...
                </div>
              )}

            {!loading &&
              !rooms.length && (
                <div className="academy-profile-empty-state">
                  No live voice
                  rooms yet. Start
                  the first one.
                </div>
              )}

            <div className="academy-mission-playbook-grid">
              {rooms.map(
                (room) => {
                  const id =
                    roomId(room)

                  return (
                    <article
                      className="academy-mission-playbook-card"
                      key={id}
                    >
                      <span className="academy-mission-playbook-icon">
                        🎙️
                      </span>

                      <span className="academy-mission-playbook-body">
                        <span className="academy-mission-playbook-kicker">
                          Live now
                        </span>

                        <span className="academy-mission-playbook-title">
                          {clean(
                            room.title ||
                              'Voice Lounge',
                          )}
                        </span>

                        <span className="academy-mission-playbook-copy">
                          {clean(
                            room.topic ||
                              'Live Academy voice networking',
                          )}
                        </span>

                        <span className="academy-mission-playbook-meta">
                          Hosted by{' '}
                          {hostName(
                            room,
                          )}{' '}
                          •{' '}
                          {participantCount(
                            room,
                          )}{' '}
                          live
                        </span>
                      </span>

                      <button
                        type="button"
                        className="academy-ui-button academy-ui-button--primary"
                        disabled={
                          joiningRoomId ===
                          id
                        }
                        onClick={() =>
                          void joinRoom(
                            room,
                          )
                        }
                      >
                        {joiningRoomId ===
                        id
                          ? 'Joining...'
                          : 'Join Stage'}
                      </button>
                    </article>
                  )
                },
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="academy-lead-missions-scroll">
          <div className="academy-lead-missions-shell">
            <section className="academy-lead-missions-hero">
              <div>
                <div className="academy-profile-card-kicker">
                  Live Voice Room
                </div>

                <h2 className="academy-lead-missions-title">
                  {clean(
                    activeRoom.title ||
                      'Voice Lounge',
                  )}
                </h2>

                <p className="academy-lead-missions-copy">
                  {clean(
                    activeRoom.topic ||
                      'Live Academy voice networking',
                  )}
                </p>
              </div>

              <div className="academy-lead-header-actions">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  onClick={
                    toggleMute
                  }
                >
                  {muted
                    ? '🔇 Unmute'
                    : '🎤 Mute'}
                </button>

                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  disabled={
                    leaving
                  }
                  onClick={() =>
                    void leaveRoom()
                  }
                >
                  {leaving
                    ? 'Leaving...'
                    : 'Leave Room'}
                </button>

                {isHost && (
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--primary"
                    disabled={
                      ending
                    }
                    onClick={() =>
                      void endRoom()
                    }
                  >
                    {ending
                      ? 'Ending...'
                      : 'End Room'}
                  </button>
                )}
              </div>
            </section>

            <div className="stage-layout-wrapper">
              <div className="stage-container">
            <section className="academy-mission-playbook-detail-card">
              <div className="academy-mission-playbook-detail-hero">
                <div className="academy-mission-playbook-detail-icon">
                  🎙️
                </div>

                <div>
                  <div className="academy-profile-card-kicker">
                    Connected
                  </div>

                  <h3>
                    {muted
                      ? 'Microphone muted'
                      : 'Microphone live'}
                  </h3>

                  <p>
                    Hosted by{' '}
                    {hostName(
                      activeRoom,
                    )}
                  </p>

                  <div className="academy-mission-playbook-badges">
                    <span>
                      {participantCount(
                        activeRoom,
                      )}{' '}
                      live
                    </span>

                    <span>
                      {connected
                        ? signalingJoined
                          ? 'Voice signaling joined'
                          : 'Realtime connected · syncing voice'
                        : 'Reconnecting...'}
                    </span>

                    {mutedPeerCount >
                      0 && (
                      <span>
                        {mutedPeerCount}{' '}
                        muted
                      </span>
                    )}

                    {isHost && (
                      <span>
                        Host
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
              </div>

              <aside
                className="stage-chat-panel"
                aria-label="Live Stage Chat"
              >
                <div className="stage-chat-header">
                  💬 Live Stage Chat
                </div>

                <div
                  ref={stageHistoryRef}
                  className="stage-chat-history hide-scrollbar"
                  role="log"
                  aria-live="polite"
                >
                  {stageMessages.length === 0 ? (
                    <div className="stage-chat-welcome">
                      Welcome to the live stage chat!
                    </div>
                  ) : stageMessages.map((message, index) => (
                    <div
                      className="stage-chat-msg fade-in"
                      key={
                        stageClientId(message) ||
                        stageMessageId(message) ||
                        index
                      }
                    >
                      <strong>
                        {clean(message.author) || 'YH Member'}:
                      </strong>{' '}
                      {clean(message.text)}{' '}
                      {message._stageStatus === 'sending' &&
                        <small>Sending…</small>}
                      {message._stageStatus === 'failed' &&
                        <small>Failed</small>}
                    </div>
                  ))}
                </div>

                <form
                  className="stage-chat-input-wrapper"
                  onSubmit={(event) => {
                    event.preventDefault()
                    sendStageChat()
                  }}
                >
                  <input
                    type="text"
                    className="input-field-compact stage-chat-input"
                    value={stageDraft}
                    placeholder={
                      'Message everyone in ' +
                      clean(activeRoom.title || 'this stage') +
                      '.'
                    }
                    onChange={(event) =>
                      setStageDraft(event.target.value)
                    }
                  />

                  <button
                    type="submit"
                    className="stage-chat-send-btn"
                    aria-label="Send message"
                    aria-busy={stageSending > 0}
                    disabled={!connected || !stageDraft.trim()}
                  >
                    ➤
                  </button>
                </form>
              </aside>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          className="academy-voice-create-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !createBusy) {
              setCreateOpen(false)
            }
          }}
        >
          <form
            className="academy-voice-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="academy-voice-create-heading"
            onSubmit={createRoom}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !createBusy) {
                setCreateOpen(false)
              }
            }}
          >
            <header className="academy-voice-create-header">
              <div className="academy-profile-card-kicker">
                Live Audio
              </div>
              <h2 id="academy-voice-create-heading">
                Start Voice Lounge
              </h2>
              <p>
                Give your room a name and a topic before going live.
              </p>
            </header>

            <label className="academy-voice-create-field">
              <span>Room Title</span>
              <input
                className="academy-voice-create-input"
                type="text"
                value={title}
                required
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="academy-voice-create-field">
              <span>Topic</span>
              <textarea
                className="academy-voice-create-input academy-voice-create-topic"
                rows={4}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </label>

            <footer className="academy-voice-create-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={createBusy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={createBusy}
              >
                {createBusy ? 'Starting...' : 'Start Lounge'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  )
}
