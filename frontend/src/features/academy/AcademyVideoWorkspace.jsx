import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  apiFetch,
} from '../../services/api/apiClient'
import { io } from 'socket.io-client'


const VIDEO_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

function VideoPeer({ peer }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const node = videoRef.current
    if (!node) return
    node.srcObject = peer.stream
    void node.play().catch(() => {})
    return () => { node.srcObject = null }
  }, [peer.stream])

  return (
    <div style={{
      position: 'relative',
      background: '#020617',
      borderRadius: 14,
      overflow: 'hidden',
      aspectRatio: '16 / 9',
    }}>
      <video ref={videoRef} autoPlay playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <span style={{
        position: 'absolute', left: 10, bottom: 10,
        color: '#fff', background: '#0009', padding: '4px 8px',
      }}>
        {peer.name || 'Academy Member'}
      </span>
      <button type="button" className="btn-secondary"
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={() => {
          void videoRef.current?.play().catch(() => {})
        }}>
        Play audio
      </button>
    </div>
  )
}

function VideoRtcSession({ room, ensureMedia, onToast, onRoomEnded }) {
  const id = roomId(room)
  const roomEndedRef = useRef(onRoomEnded)
  const socketRef = useRef(null)
  const localRef = useRef(null)
  const peerMap = useRef(new Map())
  const iceMap = useRef(new Map())
  const toastRef = useRef(onToast)

  const [peers, setPeers] = useState([])
  const [connected, setConnected] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  useEffect(() => {
    toastRef.current = onToast
  }, [onToast])

  useEffect(() => {
    roomEndedRef.current = onRoomEnded
  }, [onRoomEnded])

  useEffect(() => {
    let cancelled = false
    let socket = null

    function closePeers() {
      for (const pc of peerMap.current.values()) {
        pc.ontrack = null
        pc.onicecandidate = null
        pc.onconnectionstatechange = null
        pc.close()
      }
      peerMap.current.clear()
      iceMap.current.clear()
    }

    function dropPeer(peerId) {
      const pc = peerMap.current.get(peerId)
      if (pc) {
        pc.ontrack = null
        pc.onicecandidate = null
        pc.onconnectionstatechange = null
        pc.close()
        peerMap.current.delete(peerId)
      }
      iceMap.current.delete(peerId)
      if (!cancelled) {
        setPeers(items => items.filter(item => item.id !== peerId))
      }
    }

    function createPeer(peerId, name = '') {
      if (cancelled || !localRef.current || !peerId) return null

      if (peerMap.current.has(peerId)) {
        return peerMap.current.get(peerId)
      }

      const pc = new RTCPeerConnection(VIDEO_ICE_CONFIG)
      peerMap.current.set(peerId, pc)

      for (const track of localRef.current.getTracks()) {
        pc.addTrack(track, localRef.current)
      }

      pc.ontrack = event => {
        if (cancelled || peerMap.current.get(peerId) !== pc) return
        const stream = event.streams?.[0]
        if (!stream) return

        setPeers(items => [
          ...items.filter(item => item.id !== peerId),
          { id: peerId, name, stream },
        ])
      }

      pc.onicecandidate = event => {
        if (!event.candidate || !socket?.connected || cancelled) return

        socket.emit('academyVoice:ice', {
          roomId: id,
          targetSocketId: peerId,
          candidate: event.candidate,
        })
      }

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) {
          dropPeer(peerId)
        }
      }

      return pc
    }

    async function flushIce(peerId, pc) {
      const pending = iceMap.current.get(peerId) || []
      iceMap.current.delete(peerId)

      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(candidate)
        } catch (error) {
          console.warn('Video ICE candidate:', error)
        }
      }
    }

    async function start() {
      try {
        const stream = await ensureMedia()
        if (cancelled) return
        localRef.current = stream

        const token =
          stored('yh_token') || stored('token')

        socket = io({
          autoConnect: false,
          withCredentials: true,
          transports: ['websocket', 'polling'],
          auth: token ? { token } : {},
        })

        socketRef.current = socket

        socket.on('connect', () => {
          socket.timeout(12000).emit('academyVoice:join', {
            roomId: id,
            displayName: stored('yh_user_name') || 'YH Member',
          }, (error, reply) => {
            if (cancelled) return
            if (error || !reply?.success) {
              setConnected(false)
              toastRef.current?.(
                reply?.message || 'Video signaling failed.',
                'error'
              )
            } else {
              setConnected(true)
            }
          })
        })

        socket.on('disconnect', () => {
          if (cancelled) return
          setConnected(false)
          closePeers()
          setPeers([])
        })

        socket.on('academyVoice:peers', async payload => {
          if (cancelled || clean(payload?.roomId) !== id) return

          for (const peer of Array.isArray(payload.peers) ? payload.peers : []) {
            const peerId = clean(peer.socketId)
            if (!peerId || peerId === socket.id || peerMap.current.has(peerId)) {
              continue
            }

            try {
              const pc = createPeer(peerId, clean(peer.displayName))
              if (!pc) continue

              await pc.setLocalDescription(await pc.createOffer())

              if (cancelled || !socket.connected) {
                dropPeer(peerId)
                continue
              }

              socket.emit('academyVoice:offer', {
                roomId: id,
                targetSocketId: peerId,
                offer: pc.localDescription,
              })
            } catch (error) {
              dropPeer(peerId)
              console.warn('Video offer:', error)
            }
          }
        })

        socket.on('academyVoice:offer', async payload => {
          if (cancelled || clean(payload?.roomId) !== id || !payload.offer) {
            return
          }

          const peerId = clean(payload.fromSocketId)
          if (!peerId) return

          try {
            const pc = createPeer(peerId, clean(payload.fromDisplayName))
            if (!pc) return

            await pc.setRemoteDescription(payload.offer)
            await flushIce(peerId, pc)
            await pc.setLocalDescription(await pc.createAnswer())

            if (!cancelled && socket.connected) {
              socket.emit('academyVoice:answer', {
                roomId: id,
                targetSocketId: peerId,
                answer: pc.localDescription,
              })
            }
          } catch (error) {
            dropPeer(peerId)
            console.warn('Video answer:', error)
          }
        })

        socket.on('academyVoice:answer', async payload => {
          if (cancelled || clean(payload?.roomId) !== id || !payload.answer) {
            return
          }

          const peerId = clean(payload.fromSocketId)
          const pc = peerMap.current.get(peerId)
          if (!pc) return

          try {
            await pc.setRemoteDescription(payload.answer)
            await flushIce(peerId, pc)
          } catch (error) {
            console.warn('Video remote answer:', error)
          }
        })

        socket.on('academyVoice:ice', async payload => {
          if (cancelled || clean(payload?.roomId) !== id || !payload.candidate) {
            return
          }

          const peerId = clean(payload.fromSocketId)
          if (!peerId) return

          const pc = peerMap.current.get(peerId)

          if (!pc?.remoteDescription) {
            const pending = iceMap.current.get(peerId) || []
            iceMap.current.set(peerId, [...pending, payload.candidate])
            return
          }

          try {
            await pc.addIceCandidate(payload.candidate)
          } catch (error) {
            console.warn('Video ICE:', error)
          }
        })

        socket.on('academyVoice:peerLeft', payload => {
          if (clean(payload?.roomId) === id) {
            dropPeer(clean(payload.socketId))
          }
        })

        socket.on('academyVoice:roomEnded', payload => {
          if (cancelled || clean(payload?.roomId) !== id) return
          roomEndedRef.current?.()
        })

        socket.on('academyVoice:error', payload => {
          if (cancelled) return
          if (payload?.roomId && clean(payload.roomId) !== id) return

          toastRef.current?.(
            payload?.message || 'Video signaling error.',
            'error'
          )
        })

        socket.on('connect_error', error => {
          if (!cancelled) {
            toastRef.current?.(
              error?.message || 'Video connection failed.',
              'error'
            )
          }
        })

        socket.connect()
      } catch (error) {
        if (!cancelled) {
          toastRef.current?.(
            error?.message || 'Could not initialize video.',
            'error'
          )
        }
      }
    }

    void start()

    return () => {
      cancelled = true

      if (socket?.connected) {
        socket.emit('academyVoice:leave', { roomId: id })
      }

      socket?.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      closePeers()
      localRef.current = null
    }
  }, [id, ensureMedia])

  function toggle(kind) {
    const stream = localRef.current
    if (!stream) return

    const tracks = kind === 'video'
      ? stream.getVideoTracks()
      : stream.getAudioTracks()

    if (!tracks.length) return

    const enabled = !tracks.some(track => track.enabled)
    tracks.forEach(track => { track.enabled = enabled })

    if (kind === 'video') {
      setCameraOn(enabled)
    } else {
      setMicOn(enabled)
      socketRef.current?.emit('academyVoice:mute', {
        roomId: id,
        muted: !enabled,
      })
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        gap: 12,
      }}>
        {peers.map(peer => (
          <VideoPeer key={peer.id} peer={peer} />
        ))}
      </div>

      <div className="roadmap-mission-actions"
        style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary"
          onClick={() => toggle('video')}>
          {cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        </button>
        <button type="button" className="btn-secondary"
          onClick={() => toggle('audio')}>
          {micOn ? 'Mute Microphone' : 'Unmute Microphone'}
        </button>
        <span role="status">
          {connected ? 'Signaling connected' : 'Connecting...'}
          {' · '}
          {peers.length + 1} participant(s)
        </span>
      </div>
    </div>
  )
}

const MAX_ROOM_AGE_MS =
  24 * 60 * 60 * 1000

function clean(value = '') {
  return String(
    value ?? '',
  ).trim()
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

function currentUserId() {
  return clean(
    stored('yh_user_id') ||
      stored('yh_user_uid') ||
      stored('userId'),
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
      '',
  ).toLowerCase()
}

function roomStatus(room = {}) {
  return clean(
    room.status ||
      room.room_status ||
      'live',
  ).toLowerCase()
}

function startedAt(room = {}) {
  const raw =
    room.started_at ||
    room.startedAt ||
    room.created_at ||
    room.createdAt ||
    ''

  const value =
    new Date(raw).getTime()

  return Number.isFinite(
    value,
  )
    ? value
    : 0
}

function isJoinable(
  room = {},
) {
  if (
    roomType(room) !==
    'video'
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
    startedAt(room)

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

export default function AcademyVideoWorkspace({
  onToast,
}) {
  const streamRef =
    useRef(null)

  /* YHU_ACADEMY_A10_VIDEO_CAPTURE_LIFECYCLE_GUARD */
  const mediaRequestRef = useRef(null)
  const mediaGenerationRef = useRef(0)
  const mediaMountedRef = useRef(true)

  const previewRef =
    useRef(null)

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    activeRoom,
    setActiveRoom,
  ] = useState(null)

  const [
    busyRoomId,
    setBusyRoomId,
  ] = useState('')

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false)

  const [
    createBusy,
    setCreateBusy,
  ] = useState(false)

  const [
    ending,
    setEnding,
  ] = useState(false)

  const [
    leaving,
    setLeaving,
  ] = useState(false)

  const [
    title,
    setTitle,
  ] = useState('')

  const [
    topic,
    setTopic,
  ] = useState('')

  const isHost =
    useMemo(
      () =>
        Boolean(
          currentUserId() &&
            hostId(
              activeRoom || {},
            ) &&
            currentUserId() ===
              hostId(
                activeRoom || {},
              ),
        ),
      [activeRoom],
    )

  const stopMedia =
    useCallback(() => {
      mediaGenerationRef.current += 1
      mediaRequestRef.current = null

      const stream =
        streamRef.current

      stream
        ?.getTracks?.()
        .forEach(
          (track) => {
            try {
              track.stop()
            } catch { /* Ignore media track stop failures. */ }
          },
        )

      streamRef.current =
        null

      if (
        previewRef.current
      ) {
        previewRef.current.srcObject =
          null
      }
    }, [])

  useEffect(() => {
    mediaMountedRef.current = true

    return () => {
      mediaMountedRef.current = false
      stopMedia()
    }
  }, [stopMedia])

  const ensureMedia =
    useCallback(async () => {
      const current = streamRef.current

      if (
        current?.getTracks?.().some(
          (track) => track.readyState === 'live',
        )
      ) {
        return current
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera and microphone are not supported on this device.',
        )
      }

      if (mediaRequestRef.current) {
        return mediaRequestRef.current
      }

      const generation = mediaGenerationRef.current

      const request = navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      }).then((stream) => {
        if (
          !mediaMountedRef.current ||
          mediaGenerationRef.current !== generation
        ) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop()
            } catch {}
          })

          throw new Error(
            'Camera and microphone request was cancelled.',
          )
        }

        streamRef.current = stream
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

  useEffect(() => {
    const node =
      previewRef.current

    const stream =
      streamRef.current

    if (
      !node ||
      !stream ||
      !activeRoom
    ) {
      return
    }

    node.srcObject =
      stream

    node
      .play()
      .catch(() => {})
  }, [activeRoom])

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
            Array.isArray(
              result?.rooms,
            )
              ? result.rooms.filter(
                  isJoinable,
                )
              : []

          setRooms(
            nextRooms,
          )

          return nextRooms
        } catch (
          error
        ) {
          if (!silent) {
            onToast?.(
              error?.message ||
                'Failed to load live video rooms.',
              'error',
            )
          }

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
    const initialLoadTimer = window.setTimeout(() => {
      void loadRooms()
    }, 0)

    const timer =
      window.setInterval(
        () => {
          void loadRooms(
            true,
          )
        },
        30000,
      )

    return () => {
      window.clearTimeout(initialLoadTimer)
      window.clearInterval(
        timer,
      )

    }
  }, [
    loadRooms,
  ])

  const handleRemoteRoomEnded = useCallback(() => {
    stopMedia()
    setActiveRoom(null)
    onToast?.('This video room has ended.', 'success')
    void loadRooms(true)
  }, [loadRooms, onToast, stopMedia])

  const joinRoom =
    async (room) => {
      const id =
        roomId(room)

      if (!id) return

      setBusyRoomId(id)

      try {
        await ensureMedia()

        const result =
          await apiFetch(
            '/api/realtime/live-rooms/' +
              encodeURIComponent(
                id,
              ) +
              '/join',
            {
              method:
                'POST',
            },
          )

        const joined =
          result?.room &&
          typeof result.room ===
            'object'
            ? result.room
            : room

        setActiveRoom(
          joined,
        )

        onToast?.(
          'Live video room opened.',
          'success',
        )

        void loadRooms(
          true,
        )
      } catch (
        error
      ) {
        stopMedia()

        onToast?.(
          error?.message ||
            'Failed to join live video room.',
          'error',
        )
      } finally {
        setBusyRoomId('')
      }
    }

  const leaveRoom =
    async () => {
      const id =
        roomId(
          activeRoom || {},
        )

      if (!id) return

      setLeaving(true)

      try {
        try {
          await apiFetch(
            '/api/realtime/live-rooms/' +
              encodeURIComponent(
                id,
              ) +
              '/leave',
            {
              method:
                'POST',
            },
          )
        } catch { /* Continue local cleanup if the leave request fails. */ }

        stopMedia()

        setActiveRoom(
          null,
        )

        onToast?.(
          'You left the video room.',
          'success',
        )

        await loadRooms()
      } finally {
        setLeaving(false)
      }
    }

  const endRoom =
    async () => {
      const id =
        roomId(
          activeRoom || {},
        )

      if (!id) return

      if (
        !window.confirm(
          'End this video room for everyone?',
        )
      ) {
        return
      }

      setEnding(true)

      try {
        await apiFetch(
          '/api/realtime/live-rooms/' +
            encodeURIComponent(
              id,
            ) +
            '/end',
          {
            method:
              'POST',
          },
        )

        stopMedia()

        setActiveRoom(
          null,
        )

        onToast?.(
          'Video room ended.',
          'success',
        )

        await loadRooms()
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Failed to end video room.',
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

      if (!cleanTitle) {
        onToast?.(
          'Room title is required.',
          'error',
        )
        return
      }

      setCreateBusy(true)

      try {
        await ensureMedia()

        const result =
          await apiFetch(
            '/api/realtime/live-rooms',
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  roomType:
                    'video',
                  title:
                    cleanTitle,
                  topic:
                    clean(topic),
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
            'Failed to start live video room.',
          )
        }

        setCreateOpen(false)
        setTitle('')
        setTopic('')

        onToast?.(
          'Live video room started.',
          'success',
        )

        await joinRoom(
          created,
        )
      } catch (
        error
      ) {
        stopMedia()

        onToast?.(
          error?.message ||
            'Failed to start live video room.',
          'error',
        )
      } finally {
        setCreateBusy(false)
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-workspace"
      data-yh-dashboard-react-surface="academy-video"
    >
      {!activeRoom ? (
        <div className="academy-lead-missions-scroll">
          <div className="academy-lead-missions-shell">
            <section className="academy-lead-missions-hero">
              <div>
                <div className="academy-profile-card-kicker">
                  Live Video
                </div>

                <h2 className="academy-lead-missions-title">
                  Video Lounge
                </h2>

                <p className="academy-lead-missions-copy">
                  Join live video networking rooms and breakdown sessions with Academy members.
                </p>
              </div>

              <div className="academy-lead-header-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loading}
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
                  className="btn-primary"
                  onClick={() =>
                    setCreateOpen(
                      true,
                    )
                  }
                >
                  + Start Video Call
                </button>
              </div>
            </section>

            {loading &&
              !rooms.length && (
                <div className="academy-profile-empty-state">
                  Loading live video rooms...
                </div>
              )}

            {!loading &&
              !rooms.length && (
                <div className="academy-profile-empty-state">
                  No live video rooms yet.
                </div>
              )}

            <div className="academy-mission-playbook-grid">
              {rooms.map(
                (room) => {
                  const id =
                    roomId(room)

                  return (
                    <article
                      key={id}
                      className="academy-mission-playbook-card"
                    >
                      <span className="academy-mission-playbook-icon">
                        📹
                      </span>

                      <span className="academy-mission-playbook-body">
                        <span className="academy-mission-playbook-kicker">
                          Live now
                        </span>

                        <span className="academy-mission-playbook-title">
                          {clean(
                            room.title ||
                              'Video Lounge',
                          )}
                        </span>

                        <span className="academy-mission-playbook-copy">
                          {clean(
                            room.topic ||
                              'Live Academy video networking',
                          )}
                        </span>

                        <span className="academy-mission-playbook-meta">
                          Hosted by{' '}
                          {hostName(room)}
                          {' • '}
                          {participantCount(
                            room,
                          )}{' '}
                          live
                        </span>
                      </span>

                      <button
                        type="button"
                        className="btn-primary"
                        disabled={
                          busyRoomId ===
                          id
                        }
                        onClick={() =>
                          void joinRoom(
                            room,
                          )
                        }
                      >
                        {busyRoomId ===
                        id
                          ? 'Joining...'
                          : 'Join Room'}
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
                  Live Video Room
                </div>

                <h2 className="academy-lead-missions-title">
                  {clean(
                    activeRoom.title ||
                      'Video Lounge',
                  )}
                </h2>

                <p className="academy-lead-missions-copy">
                  {clean(
                    activeRoom.topic ||
                      'Live Academy video networking',
                  )}
                </p>
              </div>

              <div className="academy-lead-header-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={leaving}
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
                    className="btn-primary"
                    disabled={ending}
                    onClick={() =>
                      void endRoom()
                    }
                  >
                    {ending
                      ? 'Ending...'
                      : 'End Live'}
                  </button>
                )}
              </div>
            </section>

            <section className="academy-mission-playbook-detail-card">
              <div
                style={{
                  width:
                    '100%',
                  overflow:
                    'hidden',
                  borderRadius:
                    '18px',
                  background:
                    '#020617',
                  aspectRatio:
                    '16 / 9',
                }}
              >
                <video
                  ref={previewRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    display:
                      'block',
                    width:
                      '100%',
                    height:
                      '100%',
                    objectFit:
                      'cover',
                  }}
                />
              </div>

              <VideoRtcSession
                room={activeRoom}
                ensureMedia={ensureMedia}
                onToast={onToast}
                onRoomEnded={handleRemoteRoomEnded}
              />
              <div className="academy-mission-playbook-badges">
                <span>
                  📹 Camera controls
                </span>

                <span>
                  🎤 Microphone controls
                </span>

                <span>
                  {participantCount(
                    activeRoom,
                  )}{' '}
                  live
                </span>

                {isHost && (
                  <span>
                    Host
                  </span>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {createOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Start Video Call"
        >
          <form
            className="modal-content academy-lead-form-grid"
            onSubmit={
              createRoom
            }
          >
            <div className="academy-lead-form-span-2">
              <div className="academy-profile-card-kicker">
                Live Video
              </div>

              <h2>
                Start Video Call
              </h2>
            </div>

            <label className="form-group academy-lead-form-span-2">
              <span>
                Room Title
              </span>

              <input
                className="input-field"
                required
                value={title}
                onChange={(
                  event,
                ) =>
                  setTitle(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label className="form-group academy-lead-form-span-2">
              <span>
                Topic
              </span>

              <textarea
                className="input-field"
                rows="4"
                value={topic}
                onChange={(
                  event,
                ) =>
                  setTopic(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <div className="roadmap-mission-actions academy-lead-form-span-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={createBusy}
                onClick={() =>
                  setCreateOpen(
                    false,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={createBusy}
              >
                {createBusy
                  ? 'Starting...'
                  : 'Start Video Call'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
