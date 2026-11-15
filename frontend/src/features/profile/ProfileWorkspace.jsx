import { uploadProfileAsset } from './profileApi.js'
import { rememberMessageProfile, updateMessagesInbox, normalizeRoom, messagesOwner } from '../messages/messagesUtils.js'
import { clean, first, firstArray, splitList, getStoredToken, normalizeProfile } from './profileUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { useNavigate } from 'react-router-dom'
import './ProfileWorkspace.css'


function YHUProfileMediaCropper({ file, kind, onApply, onCancel, onToast }) {
  const frameRef = useRef(null)
  const imageRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const previewRef = useRef(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [frame, setFrame] = useState({ w: 300, h: 300 })
  const [zoom, setZoom] = useState(1.2)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const maximum = kind === 'cover' ? 3.5 : 4

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    let active = true

    imageRef.current = null
    setNatural({ w: 0, h: 0 })
    setZoom(1.2)
    setOffset({ x: 0, y: 0 })
    pointers.current.clear()
    gesture.current = null

    image.onload = () => {
      if (!active) return
      imageRef.current = image
      setNatural({
        w: image.naturalWidth,
        h: image.naturalHeight
      })
    }

    image.onerror = () => {
      if (active) {
        onToast?.('Could not load the selected image.', 'error')
      }
    }

    image.src = url

    return () => {
      active = false
      imageRef.current = null
      image.onload = null
      image.onerror = null
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return

    const measure = () => setFrame({
      w: node.clientWidth || 300,
      h: node.clientHeight || 300
    })

    measure()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [kind])

  const scale = natural.w && natural.h
    ? Math.max(frame.w / natural.w, frame.h / natural.h)
    : 1

  const imageWidth = natural.w * scale * zoom
  const imageHeight = natural.h * scale * zoom

  const clamp = (point, targetZoom = zoom) => {
    const x = Math.max(
      0,
      (natural.w * scale * targetZoom - frame.w) / 2
    )
    const y = Math.max(
      0,
      (natural.h * scale * targetZoom - frame.h) / 2
    )

    return {
      x: Math.max(-x, Math.min(x, point.x)),
      y: Math.max(-y, Math.min(y, point.y))
    }
  }

  const updateZoom = value => {
    const nextZoom = Math.max(
      1,
      Math.min(maximum, Number(value) || 1)
    )
    setZoom(nextZoom)
    setOffset(current => clamp(current, nextZoom))
  }

  const pointerDown = event => {
    event.preventDefault()
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    frameRef.current?.setPointerCapture?.(event.pointerId)

    const active = [...pointers.current.values()]

    if (active.length >= 2) {
      gesture.current = {
        type: 'pinch',
        distance: Math.hypot(
          active[1].x - active[0].x,
          active[1].y - active[0].y
        ),
        zoom
      }
    } else {
      gesture.current = {
        type: 'drag',
        x: event.clientX,
        y: event.clientY,
        offset
      }
    }
  }

  const pointerMove = event => {
    if (!pointers.current.has(event.pointerId)) return

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    })

    const active = [...pointers.current.values()]
    const start = gesture.current
    if (!start) return

    if (active.length >= 2 && start.type === 'pinch') {
      const distance = Math.hypot(
        active[1].x - active[0].x,
        active[1].y - active[0].y
      )
      updateZoom(
        start.zoom * distance / Math.max(1, start.distance)
      )
    } else if (active.length === 1 && start.type === 'drag') {
      setOffset(clamp({
        x: start.offset.x + event.clientX - start.x,
        y: start.offset.y + event.clientY - start.y
      }))
    }
  }

  const pointerEnd = event => {
    pointers.current.delete(event.pointerId)
    const active = [...pointers.current.values()]

    if (active.length === 1) {
      gesture.current = {
        type: 'drag',
        x: active[0].x,
        y: active[0].y,
        offset
      }
    } else if (!active.length) {
      gesture.current = null
    }
  }


  /* Single crop geometry for preview and export. */
  const drawCrop = context => {
    const image = imageRef.current
    if (!image || !natural.w || !natural.h ||
        !frame.w || !frame.h) return

    context.drawImage(
      image,
      (frame.w - imageWidth) / 2 + offset.x,
      (frame.h - imageHeight) / 2 + offset.y,
      imageWidth,
      imageHeight
    )
  }

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !imageRef.current ||
        !natural.w || !frame.w) return

    const ratio = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(frame.w * ratio)
    canvas.height = Math.round(frame.h * ratio)

    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, frame.w, frame.h)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    drawCrop(context)
  }, [natural, frame, zoom, offset])

  const apply = () => {
    const img = imageRef.current
    if (!img || !natural.w || !natural.h) return

    const canvas = document.createElement('canvas')
    canvas.width = kind === 'cover' ? 1600 : 512
    canvas.height = kind === 'cover' ? 600 : 512

    const context = canvas.getContext('2d')
    if (!context) {
      onToast?.('Your browser could not prepare the image crop.', 'error')
      return
    }

    context.setTransform(
      canvas.width / frame.w,
      0, 0,
      canvas.height / frame.h,
      0, 0
    )

    drawCrop(context)

    canvas.toBlob(blob => {
      if (!blob) {
        onToast?.('Could not generate cropped image.', 'error')
        return
      }

      onApply(
        new File(
          [blob],
          kind + '-cropped.jpg',
          { type: 'image/jpeg', lastModified: Date.now() }
        ),
        kind
      )
    }, 'image/jpeg', 0.76)
  }

  return (
    <div className="yhu-p2-crop-overlay"
      role="dialog" aria-modal="true" aria-label="Crop Image">
      <div className="yhu-p2-crop-panel">
        <header>
          <div>
            <span>Image Cropper</span>
            <h3>
              {kind === 'cover'
                ? 'Crop Cover Photo'
                : 'Crop Profile Picture'}
            </h3>
            <p>Drag and zoom the image before applying.</p>
          </div>

          <button type="button" aria-label="Close cropper"
            onClick={onCancel}>×</button>
        </header>

        <div
          ref={frameRef}
          className="yhu-p2-crop-frame"
          data-kind={kind}
          onWheel={event => {
            if (event.cancelable) event.preventDefault()
            event.stopPropagation()
            updateZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12))
          }}
          onDoubleClick={() => {
            setZoom(1.2)
            setOffset({ x: 0, y: 0 })
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          <canvas
            className="yhu-p2-crop-canvas"
            ref={previewRef}
            role="img"
            aria-label="Crop preview"
          />
          <div className="yhu-p2-crop-grid" aria-hidden="true" />
        </div>

        <div className="yhu-p2-crop-zoom">
          <span>Zoom / Size</span>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => updateZoom(zoom - 0.12)}>
            −
          </button>
          <input
            type="range" min="1" max={maximum} step="0.01"
            value={zoom} aria-label="Crop zoom"
            onChange={event => updateZoom(event.target.value)}
          />
          <button type="button" onClick={() => updateZoom(zoom + 0.12)}>
            +
          </button>
        </div>

        <p>
          Drag the photo to center the visible crop. Pinch on mobile or
          use the size control on desktop.
        </p>

        <footer>
          <button type="button" className="yhu-profile-button is-quiet"
            onClick={onCancel}>Cancel</button>
          <button type="button" className="yhu-profile-button is-primary"
            disabled={!natural.w || !natural.h}
            onClick={apply}>Apply Crop</button>
        </footer>
      </div>
    </div>
  )
}

export default function ProfileWorkspace({
  memberId = '',
  onBack,
  backLabel = 'Back',
  onToast,
  onOpenMessages,
}) {
  const navigate = useNavigate()
  const isSelf =
    !clean(memberId)

  const [profile, setProfile] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [editing, setEditing] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [followBusy, setFollowBusy] =
    useState(false)

  const [friendBusy, setFriendBusy] =
    useState(false)

  const [messageBusy, setMessageBusy] =
    useState(false)

  const [avatarFile, setAvatarFile] =
    useState(null)

  const [coverFile, setCoverFile] =
    useState(null)

  const [draft, setDraft] =
    useState({})

  const [postBody, setPostBody] = useState('')
  const [postBusy, setPostBusy] = useState(false)

  /* YHU_PROFILE_MEDIA_P2_FIXED */
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [removeCover, setRemoveCover] = useState(false)
  const [cropTarget, setCropTarget] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [coverPreview, setCoverPreview] = useState('')

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('')
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview('')
      return
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  const chooseMedia = (file, kind) => {
    if (!file) return
    const label = kind === 'cover' ? 'Cover photo' : 'Profile picture'

    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      onToast?.(label + ' must be an image file.', 'error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      onToast?.(label + ' is too large. Max 10MB allowed.', 'error')
      return
    }

    setCropTarget({ file, kind })
  }

  const applyMedia = (file, kind) => {
    if (kind === 'cover') {
      setCoverFile(file)
      setRemoveCover(false)
    } else {
      setAvatarFile(file)
      setRemoveAvatar(false)
    }
    setCropTarget(null)
  }

  const clearMedia = kind => {
    if (kind === 'cover') {
      setCoverFile(null)
      setRemoveCover(true)
    } else {
      setAvatarFile(null)
      setRemoveAvatar(true)
    }
  }

  /* YHU_PROFILE_REQUEST_GUARD_PATCH11 */
  const hydrateGenerationRef = useRef(0)

  const hydrate =
    useCallback(async () => {
      const generation = ++hydrateGenerationRef.current
      setLoading(true)
      setError('')

      /* YHU_PROFILE_PROGRESSIVE_HYDRATE_R6 */
      const received = { academy: {}, universe: {} }

      const reveal = (sourceName, request) =>
        request.then(response => {
          const data = response?.profile

          if (
            data &&
            typeof data === 'object' &&
            Object.keys(data).length
          ) {
            received[sourceName] = data

            if (generation === hydrateGenerationRef.current) {
              const updated = normalizeProfile(
                received.academy,
                received.universe,
                isSelf ? 'self' : 'visited'
              )

              setProfile(updated)
              setLoading(false)
            }
          }

          return response
        })

      try {
        let academyResult
        let universeResult

        if (isSelf) {
          ;[
            universeResult,
            academyResult,
          ] =
            await Promise.allSettled([
              reveal(
                'universe',
                apiFetch(
                  '/api/universe/profile',
                  {
                    method: 'GET',
                  },
                ),
              ),

              reveal(
                'academy',
                apiFetch(
                  '/api/academy/profile',
                  {
                    method: 'GET',
                  },
                ),
              ),
            ])
        } else {
          /* YHU_REACT_PROFILE_ACCESS_PARITY */
          const targetId =
            clean(memberId)

          if (!targetId) {
            throw new Error(
              'Missing member id.',
            )
          }

          /*
           * Preserve legacy privacy/block behavior:
           * verify profile visibility before requesting
           * any visited-member profile data.
           */
          await apiFetch(
            `/api/realtime/profile-access/${encodeURIComponent(
              targetId,
            )}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

          const id =
            encodeURIComponent(
              targetId,
            )

          ;[
            academyResult,
            universeResult,
          ] =
            await Promise.allSettled([
              reveal(
                'academy',
                apiFetch(
                  `/api/academy/community/members/${id}/profile`,
                  {
                    method: 'GET',
                  },
                ),
              ),

              reveal(
                'universe',
                apiFetch(
                  `/api/universe/profile/${id}`,
                  {
                    method: 'GET',
                  },
                ),
              ),
            ])
        }

        const academy =
          academyResult?.status ===
            'fulfilled'
            ? academyResult.value
                ?.profile || {}
            : {}

        const universe =
          universeResult?.status ===
            'fulfilled'
            ? universeResult.value
                ?.profile || {}
            : {}

        if (
          !Object.keys(academy)
            .length &&
          !Object.keys(universe)
            .length
        ) {
          throw new Error(
            'Profile not found.',
          )
        }

        const normalized =
          normalizeProfile(
            academy,
            universe,
            isSelf
              ? 'self'
              : 'visited',
          )

        if (generation !== hydrateGenerationRef.current) {
          return null
        }

        setProfile(normalized)

        return normalized
      } catch (loadError) {
        if (generation !== hydrateGenerationRef.current) {
          return null
        }

        const message =
          loadError?.message ||
          'Failed to load profile.'

        setError(message)

        onToast?.(
          message,
          'error',
        )

        return null
      } finally {
        if (generation === hydrateGenerationRef.current) {
          setLoading(false)
        }
      }
    }, [
      isSelf,
      memberId,
      onToast,
    ])

  useEffect(() => {
    void hydrate()

    return () => {
      hydrateGenerationRef.current += 1
    }
  }, [hydrate])

  const openEditor = () => {
    if (!profile) return

    setDraft({
      displayName:
        profile.displayName,
      username:
        profile.username,
      bio: profile.bio,
      tags:
        profile.searchTags.join(
          ', ',
        ),
      roleTrack:
        profile.roleTrack,
      lookingFor:
        profile.lookingFor.join(
          ', ',
        ),
      canOffer:
        profile.canOffer.join(
          ', ',
        ),
      availability:
        profile.availability,
      workMode:
        profile.workMode,
      proofFocus:
        profile.proofFocus,
      marketplaceReady:
        profile.marketplaceReady
          ? 'yes'
          : 'no',
    })

    setAvatarFile(null)
    setCoverFile(null)
    setRemoveAvatar(false)
    setRemoveCover(false)
    setCropTarget(null)
    setEditing(true)
  }

  const editorDeepLinkConsumedRef = useRef(false)

  /* YHU_ACADEMY_PROFILE_EDITOR_ENTRY_PARITY */
  useEffect(() => {
    if (!isSelf || !profile || editorDeepLinkConsumedRef.current) return

    let shouldOpen = false

    try {
      const params = new URLSearchParams(window.location.search)

      const academyHandoff =
        sessionStorage.getItem(
          'yh_react_academy_profile_edit_once_v1'
        ) === '1'

      const originalHandoff =
        sessionStorage.getItem(
          'yh_open_dashboard_profile_editor_v1'
        ) === '1'

      /* YHU_ORIGINAL_PROFILE_EDITOR_DEEPLINK_PARITY */
      shouldOpen =
        academyHandoff ||
        originalHandoff ||
        params.get('profile') === 'edit' ||
        params.get('open') === 'profile-editor'

      if (academyHandoff) {
        sessionStorage.removeItem(
          'yh_react_academy_profile_edit_once_v1'
        )
      }

      if (originalHandoff) {
        sessionStorage.removeItem(
          'yh_open_dashboard_profile_editor_v1'
        )
      }
    } catch {}

    if (shouldOpen) {
      editorDeepLinkConsumedRef.current = true

      try {
        const params = new URLSearchParams(window.location.search)
        let changed = false

        if (params.get('profile') === 'edit') {
          params.delete('profile')
          changed = true
        }

        if (params.get('open') === 'profile-editor') {
          params.delete('open')
          changed = true
        }

        if (changed) {
          if (
            window.location.pathname === '/dashboard' &&
            !params.has('workspace')
          ) {
            params.set('workspace', 'profile')
          }

          const query = params.toString()

          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname +
              (query ? '?' + query : '') +
              window.location.hash,
          )
        }
      } catch {
        /* Keep the editor available when History API is blocked. */
      }

      openEditor()
    }
  }, [isSelf, profile])

  const saveProfile =
    async (event) => {
      event.preventDefault()

      const displayName =
        clean(
          draft.displayName,
        )

      const username =
        clean(
          draft.username,
        ).replace(/^@+/, '')

      if (!displayName) {
        onToast?.(
          'Display name is required.',
          'error',
        )
        return
      }

      if (!username) {
        onToast?.(
          'Username is required.',
          'error',
        )
        return
      }

      setSaving(true)

      try {
        const payload = {
          display_name:
            displayName,

          username,

          bio:
            clean(
              draft.bio,
            ),

          search_tags:
            splitList(
              draft.tags,
            ),

          role_track:
            clean(
              draft.roleTrack,
            ),

          looking_for:
            splitList(
              draft.lookingFor,
            ),

          can_offer:
            splitList(
              draft.canOffer,
            ),

          availability:
            clean(
              draft.availability,
            ),

          work_mode:
            clean(
              draft.workMode,
            ),

          proof_focus:
            clean(
              draft.proofFocus,
            ),

          marketplace_ready:
            String(
              draft.marketplaceReady,
            ).toLowerCase() ===
            'yes',
        }

        if (removeAvatar) payload.remove_avatar = true
        if (removeCover) payload.remove_cover_photo = true

        if (avatarFile) {
          payload.avatar =
            await uploadProfileAsset(
              avatarFile,
              'avatar',
            )
        }

        if (coverFile) {
          payload.cover_photo =
            await uploadProfileAsset(
              coverFile,
              'cover',
            )
        }

        const result =
          await apiFetch(
            '/api/academy/profile',
            {
              method: 'PATCH',
              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        if (!result?.profile) {
          throw new Error(
            result?.message ||
              'Profile save succeeded but no profile was returned.',
          )
        }

        const saved = normalizeProfile(result.profile, {}, 'self')
        const savedName = clean(saved.displayName || displayName)

        const savedAvatar = removeAvatar
          ? ''
          : clean(payload.avatar || saved.avatar || profile?.avatar)

        const savedCover = removeCover
          ? ''
          : clean(payload.cover_photo || saved.coverPhoto || profile?.coverPhoto)

        try {
          let previousCache = {}

          try {
            previousCache = JSON.parse(
              localStorage.getItem('yh_academy_profile_cache_v1') || '{}',
            ) || {}
          } catch {
            /* An invalid cache is safe to replace. */
          }

          localStorage.setItem(
            'yh_academy_profile_cache_v1',
            JSON.stringify({
              ...previousCache,
              ...result.profile,
              display_name: savedName,
              displayName: savedName,
              fullName: savedName,
              name: savedName,
              username,
              avatar: savedAvatar,
              avatarUrl: savedAvatar,
              avatar_url: savedAvatar,
              profilePhoto: savedAvatar,
              photoURL: savedAvatar,
              cover_photo: savedCover,
              coverPhoto: savedCover,
              coverUrl: savedCover,
              profile_avatar_removed:
                removeAvatar ||
                result.profile.profile_avatar_removed === true,
              profile_cover_removed:
                removeCover ||
                result.profile.profile_cover_removed === true,
              updatedAt: new Date().toISOString(),
            }),
          )
        } catch {
          /* Profile save already succeeded; cache is optional. */
        }

        try {
          localStorage.setItem(
            'yh_user_name',
            savedName,
          )
          localStorage.setItem('yh_user_full_name', savedName)
          localStorage.setItem('yh_user_display_name', savedName)

          localStorage.setItem(
            'yh_user_username',
            username,
          )

          localStorage.setItem(
            'yh_user_profile_bio',
            payload.bio,
          )

          if (payload.avatar) {
            localStorage.setItem(
              'yh_user_avatar',
              payload.avatar,
            )
          }

          if (
            payload.cover_photo
          ) {
            localStorage.setItem(
              'yh_user_cover_photo',
              payload.cover_photo,
            )
          }
        } catch {}

        if (removeAvatar || removeCover) {
          try {
            if (removeAvatar) localStorage.removeItem('yh_user_avatar')
            if (removeCover) localStorage.removeItem('yh_user_cover_photo')
          } catch {}
        }

        setEditing(false)

        try {
          window.dispatchEvent(new Event('yh:profile-updated'))
        } catch {
          /* Noncritical in restricted browser runtimes. */
        }

        await hydrate()

        onToast?.(
          'YH Universe profile updated.',
          'success',
        )
      } catch (saveError) {
        onToast?.(
          saveError?.message ||
            'Failed to save profile.',
          'error',
        )
      } finally {
        setSaving(false)
      }
    }

  const submitProfilePost = async event => {
    event.preventDefault()
    if (!isSelf || postBusy) return

    const body = clean(postBody)
    if (!body) return

    setPostBusy(true)
    try {
      await apiFetch('/api/academy/feed/posts', {
        method: 'POST',
        body: JSON.stringify({
          body,
          mediaReceipt: '',
          feedScope: 'global',
          nicheKey: '',
          nicheLabel: '',
          audience: 'global'
        })
      })

      setPostBody('')
      onToast?.('Posted to Global Community.', 'success')
      void hydrate()
    } catch (postError) {
      onToast?.(
        postError?.message || 'Failed to create post.',
        'error'
      )
    } finally {
      setPostBusy(false)
    }
  }

  const toggleFollow =
    async () => {
      if (!profile?.id) return

      setFollowBusy(true)

      try {
        const result =
          await apiFetch(
            `/api/academy/community/members/${encodeURIComponent(
              profile.id,
            )}/follow`,
            {
              method: 'POST',

              body:
                JSON.stringify({
                  following:
                    !profile.followedByMe,
                }),
            },
          )

        const nextFollowing =
          typeof result
            ?.following ===
          'boolean'
            ? result.following
            : !profile.followedByMe

        setProfile(
          (current) => ({
            ...current,

            followedByMe:
              nextFollowing,

            followersCount:
              Number(
                result
                  ?.followersCount ??
                  result
                    ?.followers_count ??
                  current
                    .followersCount,
              ),
          }),
        )

        onToast?.(
          nextFollowing
            ? 'User followed.'
            : 'User unfollowed.',
          'success',
        )
      } catch (followError) {
        onToast?.(
          followError?.message ||
            'Failed to update follow status.',
          'error',
        )
      } finally {
        setFollowBusy(false)
      }
    }

  const addFriend =
    async () => {
      if (!profile?.id) return

      setFriendBusy(true)

      try {
        await apiFetch(
          '/api/academy/feed/friend-requests',
          {
            method: 'POST',

            body:
              JSON.stringify({
                receiverId:
                  profile.id,
              }),
          },
        )

        setProfile(
          (current) => ({
            ...current,

            outgoingFriendRequestPending:
              true,
          }),
        )

        onToast?.(
          'Friend request sent.',
          'success',
        )
      } catch (friendError) {
        onToast?.(
          friendError?.message ||
            'Failed to send friend request.',
          'error',
        )
      } finally {
        setFriendBusy(false)
      }
    }

  const acceptFriendRequest = async () => {
    const requestId = clean(profile?.incomingFriendRequestId)

    if (!requestId) {
      onToast?.('Missing friend request id.', 'error')
      return
    }

    setFriendBusy(true)

    try {
      await apiFetch(
        '/api/academy/feed/friend-requests/' +
          encodeURIComponent(requestId) +
          '/respond',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'accept' }),
        },
      )

      setProfile(current => ({
        ...current,
        isFriend: true,
        incomingFriendRequestPending: false,
        incomingFriendRequestId: '',
        outgoingFriendRequestPending: false,
      }))

      onToast?.('Friend request accepted.', 'success')
      void hydrate()
    } catch (requestError) {
      onToast?.(
        requestError?.message || 'Failed to accept friend request.',
        'error',
      )
    } finally {
      setFriendBusy(false)
    }
  }

  const openMessage =
    async () => {
      if (!profile?.id || messageBusy) return

      setMessageBusy(true)
      const owner = messagesOwner()

      try {
        const result =
          await apiFetch(
            '/api/realtime/rooms',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  roomType: 'dm',

                  targetUserId:
                    profile.id,
                }),
            },
          )

        if (!result?.room?.id) {
          throw new Error(
            'Failed to create direct message room.',
          )
        }

        if (owner !== messagesOwner()) return
        rememberMessageProfile(profile)
        const room = normalizeRoom(result.room, profile)
        updateMessagesInbox(current => [room, ...current.filter(item => item.id !== room.id)])
        onOpenMessages?.(room.id)
      } catch (messageError) {
        onToast?.(
          messageError?.message ||
            'Failed to open direct message.',
          'error',
        )
      } finally {
        setMessageBusy(false)
      }
    }

  const openPostInFeed = (postId = '') => {
    const id = clean(postId)
    if (!id) return

    navigate(
      '/academy/community?postId=' + encodeURIComponent(id),
    )
  }

  const posts =
    useMemo(
      () =>
        Array.isArray(
          profile?.recentPosts,
        )
          ? profile.recentPosts
          : [],
      [profile],
    )

  /* YHU_PROFILE_UI_REDESIGN_20261028 */

  if (loading || error || !profile) {
    return (
      <section className="yhu-profile-workspace" aria-label="YH Universe profile">
        <div className={loading ? "yhu-profile-load-inline" : "yhu-profile-status"} role="status">
          {loading ? (
            <div className="yhu-profile-loading-stack">
              <div className="yhu-profile-loading-emblem">
                <img
                  src="/images/logo.avif"
                  alt="Young Hustlers"
                  width={48}
                  height={48}
                />
              </div>
              <strong>YH UNIVERSE</strong>
              <span>Loading profile...</span>
              <div
                className="yhu-profile-loading-track"
                aria-hidden="true"
              >
                <span />
              </div>
            </div>
          ) : (error || 'Profile not found.')}
          {!loading && (
            <button type="button" className="yhu-profile-button"
              onClick={() => void hydrate()}>
              Try Again
            </button>
          )}
        </div>
      </section>
    )
  }

  const signals = [
    ['Looking For', profile.lookingFor],
    ['Can Offer', profile.canOffer],
    ['Availability', profile.availability],
    ['Work Mode', profile.workMode],
    ['Proof Focus', profile.proofFocus],
  ].filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  )

  const editFields = [
    ['displayName', 'Display Name'],
    ['username', 'Username'],
    ['roleTrack', 'Role Track'],
    ['tags', 'Search Tags'],
    ['lookingFor', 'Looking For'],
    ['canOffer', 'Can Offer'],
    ['availability', 'Availability'],
    ['workMode', 'Work Mode'],
    ['proofFocus', 'Proof Focus'],
  ]

  return (
    <section
      id="yh-dashboard-profile-view-workspace"
      className="yh-dashboard-system-workspace yhu-profile-workspace"
      aria-label="YH Universe profile"
      data-yh-dashboard-react-surface="profile"
    >
      <div
        id="academy-profile-view"
        className="yhu-profile-scroll"
        data-profile-layout={isSelf ? 'self' : 'visited'}
      >
        <div className="yhu-profile-container">
          <header className="yhu-profile-toolbar">
            <div className="yhu-profile-page-heading">
              <span className="yhu-profile-eyebrow">
                YH UNIVERSE / PROFILE
              </span>
              <h1>{isSelf ? 'My Profile' : 'Member Profile'}</h1>
            </div>

            <div className="yhu-profile-toolbar-actions">
              {onBack && <button type="button" className="yhu-profile-button" onClick={onBack}>{backLabel}</button>}


              {isSelf && (
                <button type="button" className="yhu-profile-button is-primary"
                  onClick={openEditor}>
                  Edit Profile
                </button>
              )}
            </div>
          </header>

          {/* YHU_PROFILE_RESUME_FEED_V1 */}
          <div className="yhu-profile-resume-layout">
            <aside className="yhu-profile-resume-sidebar" aria-label="Profile information">
              <section className="yhu-profile-hero" aria-label="Profile overview">
            <div className="yhu-profile-resume-banner">
              {profile.coverPhoto && (
                <img src={profile.coverPhoto} alt="" />
              )}


            </div>

            <div className="yhu-profile-resume-identity">
              <div className="yhu-profile-resume-avatar">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" />
                  : <span>{profile.displayName.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="yhu-profile-resume-identity-copy">
                <h2>{profile.displayName}</h2>
                <p>{profile.username ? '@' + profile.username : '@yh-member'}</p>


              </div>


            </div>



              <div className="yhu-profile-social"
              aria-label="Profile social statistics">
              <div><strong>{profile.followersCount}</strong><span>Followers</span></div>
              <div><strong>{profile.followingCount}</strong><span>Following</span></div>
              <div><strong>{profile.friendsCount}</strong><span>Friends</span></div>
            </div>
            </section>
              <section className="yhu-profile-card yhu-profile-about">
              <div className="yhu-profile-card-heading">
                <span>ABOUT</span>
                <h3>About Me</h3>
              </div>

              <p className="yhu-profile-bio">{profile.bio}</p>

              {profile.roleTrack && (
                <div className="yhu-profile-mini-detail">
                  <span>Role Track</span>
                  <strong>{profile.roleTrack}</strong>
                </div>
              )}

              {profile.searchTags.length > 0 && (
                <div className="yhu-profile-tags">
                  {profile.searchTags.map(tag => (
                    <span key={tag}>{'#' + tag.replace(/^#/, '')}</span>
                  ))}
                </div>
              )}
            </section>

              {/* YHU_PROFILE_IDENTITY_R7 */}
              <section
                className="yhu-profile-card yhu-profile-identity-details"
                aria-label="Membership and profile information"
              >
                <div className="yhu-profile-card-heading">
                  <span>MEMBERSHIP & PROFILE</span>
                  <h3>Profile details</h3>
                </div>

                <div className="yhu-profile-identity-grid">
                  <div className="yhu-profile-identity-item">
                    <span>Member Role</span>
                    <strong>{profile.roleLabel}</strong>
                  </div>

                  <div className="yhu-profile-identity-item">
                    <span>Profile Type</span>
                    <strong>
                      {isSelf ? 'Unified profile' : 'Member profile'}
                    </strong>
                  </div>

                  {profile.marketplaceReady && (
                    <div className="yhu-profile-identity-item">
                      <span>Marketplace</span>
                      <strong>Marketplace Ready</strong>
                    </div>
                  )}
                </div>


                {!isSelf && (
                <div className="yhu-profile-member-actions">
                  <button type="button" className="yhu-profile-button is-primary"
                    disabled={followBusy} onClick={toggleFollow}>
                    {followBusy ? 'Updating...'
                      : profile.followedByMe ? 'Following' : 'Follow'}
                  </button>

                  <button
                    type="button"
                    className="yhu-profile-button"
                    disabled={
                      friendBusy ||
                      profile.isFriend ||
                      (
                        profile.outgoingFriendRequestPending &&
                        !profile.incomingFriendRequestPending
                      )
                    }
                    onClick={
                      profile.incomingFriendRequestPending
                        ? acceptFriendRequest
                        : addFriend
                    }
                  >
                    {profile.isFriend
                      ? 'Friends'
                      : profile.incomingFriendRequestPending
                        ? friendBusy ? 'Accepting...' : 'Accept Request'
                        : profile.outgoingFriendRequestPending
                          ? 'Request Sent'
                          : friendBusy ? 'Sending...' : 'Add Friend'}
                  </button>

                  <button type="button" className="yhu-profile-button"
                    disabled={messageBusy} onClick={openMessage}>
                    {messageBusy ? 'Opening...' : 'Message'}
                  </button>
                </div>
              )}
              </section>
              <section className="yhu-profile-card">
                <div className="yhu-profile-card-heading">
                  <span>PROFILE SIGNALS</span>
                  <h3>Collaboration profile</h3>
                </div>

                {signals.length > 0 ? (
                  <div className="yhu-profile-signal-grid">
                    {signals.map(([label, value]) => (
                      <div key={label} className="yhu-profile-signal">
                        <span>{label}</span>
                        <strong>
                          {Array.isArray(value) ? value.join(', ') : value}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="yhu-profile-muted">
                    No collaboration details added yet.
                  </p>
                )}
              </section>
            </aside>

            <div className="yhu-profile-resume-feed">
              {isSelf && (
                <section className="yhu-profile-card yhu-profile-composer" aria-label="Create a post">
                  <div className="yhu-profile-card-heading">
                    <span>SHARE WITH THE ACADEMY</span>
                    <h3>Create a post</h3>
                  </div>
                  <form onSubmit={submitProfilePost}>
                    <label className="yhu-profile-composer-label" htmlFor="yhu-profile-post-body">What's on your mind?</label>
                    <textarea id="yhu-profile-post-body" rows={3}
                      placeholder="Share an update with the Academy..."
                      value={postBody} disabled={postBusy}
                      onChange={event => setPostBody(event.target.value)} />
                    <div className="yhu-profile-composer-actions">
                      <span>Posting to the Academy global feed</span>
                      <button type="submit" className="yhu-profile-button is-primary"
                        disabled={postBusy || !clean(postBody)}>
                        {postBusy ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </form>
                </section>
              )}
              <section className="yhu-profile-card">
                <div className="yhu-profile-card-heading">
                  <span>POSTS</span>
                  <h3>Posts & shared posts</h3>
                </div>

                {posts.length > 0 ? (
                  <div className="yhu-profile-post-list">
                    {posts.map((post, index) => (
                      <article key={post.id || index} className="yhu-profile-post">
                        <div className="yhu-profile-post-head">
                          <div className="yhu-profile-post-avatar">
                            {profile.avatar ? <img src={profile.avatar} alt="" />
                              : <span>{profile.displayName.charAt(0).toUpperCase()}</span>}
                          </div>
                          <div className="yhu-profile-post-author">
                            <strong>{profile.displayName}</strong>
                            <span>{post.created_at || post.createdAt
                              ? new Date(post.created_at || post.createdAt).toLocaleDateString()
                              : 'Recently'} · {post.share ? 'Shared post' : 'Post'}</span>
                          </div>
                        </div>
                        <p>{clean(post.body || post.text) || (post.share ? 'Shared a post from the Academy feed.' : '')}</p>
                        <div className="yhu-profile-post-engagement">
                          <span>{Number(post.like_count ?? post.likeCount ?? 0)} likes</span>
                          <span>{Number(post.comment_count ?? post.commentCount ?? 0)} comments</span>
                        </div>

                        {post.id && (
                          <button
                            type="button"
                            className="yhu-profile-button"
                            onClick={() => openPostInFeed(post.id)}
                          >
                            Open in Feed
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="yhu-profile-muted">
                    {isSelf
                      ? 'You have not shared any posts yet.'
                      : 'This member has not shared any posts yet.'}
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {cropTarget && (
        <YHUProfileMediaCropper
          file={cropTarget.file}
          kind={cropTarget.kind}
          onApply={applyMedia}
          onCancel={() => setCropTarget(null)}
          onToast={onToast}
        />
      )}

      {editing && (
        <div className="yhu-profile-editor-overlay" role="dialog"
          aria-modal="true" aria-labelledby="yhu-profile-editor-title">
          <div className="yhu-profile-editor-panel">
            <header className="yhu-profile-editor-head">
              <div>
                <span className="yhu-profile-eyebrow">UNIFIED PROFILE</span>
                <h2 id="yhu-profile-editor-title">Edit Profile</h2>
                <p>Update your profile information and photos.</p>
              </div>

              <button aria-label="Close" title="Close" data-yhu-profile-close-compact="true" type="button" className="yhu-profile-button is-quiet"
                disabled={saving} onClick={() => setEditing(false)}>×</button>
            </header>

            <form className="yhu-profile-editor-form" onSubmit={saveProfile}>
              <div className="yhu-profile-editor-fields">

                <div className="yhu-p2-media">
                  <div className="yhu-p2-cover">
                    <div
                      className="yhu-p2-cover-preview"
                      style={
                        !removeCover && (coverPreview || profile?.coverPhoto)
                          ? {
                              backgroundImage: 'url("' +
                                (coverPreview || profile.coverPhoto) + '")'
                            }
                          : undefined
                      }
                    >
                      <span>Cover Photo</span>
                    </div>

                    <div className="yhu-p2-actions">
                      <label className="yhu-profile-button is-quiet">
                        Change Cover
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={event => {
                            chooseMedia(event.target.files?.[0], 'cover')
                            event.target.value = ''
                          }}
                        />
                      </label>

                      <button type="button"
                        className="yhu-profile-button is-quiet"
                        disabled={
                          removeCover ||
                          (!coverFile && !profile?.coverPhoto)
                        }
                        onClick={() => clearMedia('cover')}>
                        Remove Cover
                      </button>
                    </div>
                  </div>

                  <div className="yhu-p2-avatar-row">
                    <div className="yhu-p2-avatar">
                      {!removeAvatar && (avatarPreview || profile?.avatar)
                        ? <img src={avatarPreview || profile.avatar} alt="" />
                        : String(draft.displayName || profile?.displayName || 'Y')
                            .charAt(0).toUpperCase()}
                    </div>

                    <div className="yhu-p2-avatar-controls">
                      <strong>Profile Picture</strong>
                      <div className="yhu-p2-actions">
                        <label className="yhu-profile-button is-quiet">
                          Change Profile Picture
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={event => {
                              chooseMedia(event.target.files?.[0], 'avatar')
                              event.target.value = ''
                            }}
                          />
                        </label>

                        <button type="button"
                          className="yhu-profile-button is-quiet"
                          disabled={
                            removeAvatar ||
                            (!avatarFile && !profile?.avatar)
                          }
                          onClick={() => clearMedia('avatar')}>
                          Remove Profile Picture
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {editFields.map(([key, label]) => (
                  <label key={key} className="yhu-profile-field">
                    <span>{label}</span>
                    <input type="text" value={draft[key] || ''}
                      required={key === 'displayName' || key === 'username'}
                      autoFocus={key === 'displayName'}
                      onChange={event =>
                        setDraft(current => ({
                          ...current,
                          [key]: event.target.value
                        }))
                      }
                    />
                  </label>
                ))}

                <label className="yhu-profile-field is-full">
                  <span>Bio</span>
                  <textarea rows={4} value={draft.bio || ''}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        bio: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="yhu-profile-field">
                  <span>Marketplace Ready</span>
                  <select value={draft.marketplaceReady || 'no'}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        marketplaceReady: event.target.value
                      }))
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>


              </div>

              <footer className="yhu-profile-editor-actions">
                <button type="button" className="yhu-profile-button is-quiet"
                  disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="yhu-profile-button is-primary"
                  disabled={saving}>
                  {saving ? 'Saving Profile...' : 'Save Changes'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  )

}
