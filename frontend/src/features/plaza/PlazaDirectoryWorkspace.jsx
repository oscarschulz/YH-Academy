import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  readPlazaUiState,
  updatePlazaUiState,
} from './plazaUiState'
import './PlazaDirectoryWorkspace.css'

const INITIAL_FORM = {
  division: 'academy',
  trust: 'verified',
  region: '',
  availability: '',
  workMode: '',
  marketplaceMode: 'no',
  role: '',
  tags: '',
  lookingFor: '',
  canOffer: '',
  focus: '',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (!clean(value)) {
    return []
  }

  return clean(value)
    .split(',')
    .map((entry) =>
      clean(entry),
    )
    .filter(Boolean)
}

function titleCase(value = '') {
  return clean(value)
    .replace(/[-_]+/g, ' ')
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase(),
    )
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

function readLocalArray(
  key,
) {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          key,
        ) || '[]',
      )

    return Array.isArray(
      parsed,
    )
      ? parsed
      : []
  } catch {
    return []
  }
}

function writeLocalArray(
  key,
  value,
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        value,
      ),
    )
  } catch {}
}

function syncDirectoryConversation(
  conversation,
) {
  if (
    !conversation ||
    typeof conversation !==
      'object'
  ) {
    return
  }

  const id =
    clean(
      conversation.id,
    )

  if (!id) {
    return
  }

  const existing =
    readLocalArray(
      'yhPlazaConversationsCleanV1',
    )

  writeLocalArray(
    'yhPlazaConversationsCleanV1',
    [
      conversation,

      ...existing.filter(
        (item) =>
          clean(
            item?.id,
          ) !== id,
      ),
    ],
  )
}

function directoryQueueRole(
  item = {},
) {
  const division =
    clean(
      item.division,
    ).toLowerCase()

  if (
    division ===
      'federation' ||
    division ===
      'both'
  ) {
    return 'plaza-ops'
  }

  return 'personal'
}

function syncDirectoryRequestInbox(
  request,
  member,
  config,
  name,
  message,
) {
  if (
    !request ||
    !request.id
  ) {
    return
  }

  const inbox =
    readLocalArray(
      'yhPlazaInboxCleanV1',
    )

  const linkedId =
    clean(
      request.id,
    )

  const existingIndex =
    inbox.findIndex(
      (item) =>
        clean(
          item?.linkedRequestId,
        ) === linkedId,
    )

  const now =
    new Date()
      .toISOString()

  const queueRole =
    directoryQueueRole(
      member,
    )

  const nextItem = {
    ...(existingIndex >= 0
      ? inbox[
          existingIndex
        ]
      : {}),

    id:
      existingIndex >= 0
        ? inbox[
            existingIndex
          ].id
        : 'incoming-' +
          Date.now(),

    kind:
      'request',

    linkedRequestId:
      linkedId,

    conversationId:
      existingIndex >= 0
        ? clean(
            inbox[
              existingIndex
            ].conversationId,
          )
        : '',

    queueRole,

    title:
      (
        config.objective ||
        'Connection request'
      ) +
      ' for ' +
      (
        config.targetLabel ||
        member.name ||
        'Plaza member'
      ),

    summary:
      message,

    senderName:
      name,

    targetLabel:
      config.targetLabel ||
      member.name ||
      'Plaza member',

    targetId:
      config.targetId ||
      member.id ||
      '',

    sourceType:
      config.sourceType ||
      'member-connection',

    objective:
      config.objective ||
      'Connection request',

    region:
      config.region ||
      member.region ||
      '',

    context:
      config.context ||
      '',

    routeLabel:
      request.routeLabel ||
      (
        config.sourceType ===
        'member-bridge'
          ? 'Bridge escalation routing'
          : config.sourceType ===
              'member-screened'
            ? 'Introduction routing'
            : 'Member connection routing'
      ),

    status:
      request.status ===
      'Under Review'
        ? 'Under Review'
        : request.status ===
            'Matched'
          ? 'Matched'
          : request.status ===
              'Closed'
            ? 'Closed'
            : 'New',

    createdAt:
      existingIndex >= 0
        ? inbox[
            existingIndex
          ].createdAt ||
          now
        : now,

    updatedAt:
      now,
  }

  if (
    existingIndex >= 0
  ) {
    inbox[
      existingIndex
    ] = nextItem
  } else {
    inbox.unshift(
      nextItem,
    )
  }

  writeLocalArray(
    'yhPlazaInboxCleanV1',
    inbox,
  )
}

function currentUserId() {
  return clean(
    stored('yh_user_id') ||
      stored('yh_uid') ||
      stored('user_id') ||
      stored('uid'),
  )
}

function currentUserName() {
  return clean(
    stored('yh_user_name') ||
      stored('yh_user_username') ||
      '',
  )
}

function createClientRequestId() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return `plaza-request-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeDirectoryItem(
  item = {},
  index = 0,
) {
  const userId =
    clean(
      item.userId ||
        item.authorId ||
        item.id,
    )

  return {
    ...item,

    id:
      clean(item.id) ||
      userId ||
      `plaza-member-${index}`,

    userId,

    authorId:
      clean(
        item.authorId ||
          userId,
      ),

    avatar:
      clean(
        item.avatar ||
          item.profilePhoto ||
          item.photoURL ||
          item.authorAvatar,
      ),

    name:
      clean(
        item.name ||
          item.authorName ||
          item.displayName ||
          item.fullName,
      ) ||
      'Plaza Member',

    region:
      clean(item.region) ||
      'Global',

    division:
      clean(item.division) ||
      'academy',

    source:
      clean(
        item.source ||
          item.division,
      ) ||
      'academy',

    trust:
      clean(item.trust) ||
      'verified',

    role:
      clean(item.role) ||
      'Member',

    focus:
      clean(item.focus),

    tags:
      safeArray(
        item.tags,
      ),

    lookingFor:
      safeArray(
        item.lookingFor ||
          item.looking_for,
      ),

    canOffer:
      safeArray(
        item.canOffer ||
          item.can_offer,
      ),

    availability:
      clean(item.availability),

    workMode:
      clean(
        item.workMode ||
          item.work_mode,
      ),

    marketplaceMode:
      clean(
        item.marketplaceMode ||
          item.marketplace_mode,
      ) ||
      'no',

    status:
      clean(item.status) ||
      'active',

    reviewStatus:
      clean(
        item.reviewStatus ||
          item.status,
      ) ||
      'active',

    createdAt:
      clean(item.createdAt),

    updatedAt:
      clean(
        item.updatedAt ||
          item.createdAt,
      ),
  }
}

function normalizeUniverseProfile(
  payload = {},
) {
  const profile =
    payload?.profile &&
    typeof payload.profile ===
      'object'
      ? payload.profile
      : payload

  return {
    ...profile,

    targetUid:
      clean(
        profile.targetUid ||
          profile.uid ||
          profile.id,
      ),

    fullName:
      clean(
        profile.fullName ||
          profile.displayName,
      ) ||
      'YH Member',

    username:
      clean(profile.username),

    avatar:
      clean(
        profile.avatar ||
          profile.profilePhoto ||
          profile.photoURL,
      ),

    coverPhoto:
      clean(
        profile.coverPhoto,
      ),

    bio:
      clean(profile.bio),

    city:
      clean(profile.city),

    country:
      clean(profile.country),

    trustTier:
      clean(
        profile.trustTier,
      ),

    divisions:
      profile.divisions &&
      typeof profile.divisions ===
        'object'
        ? profile.divisions
        : {},

    signals:
      profile.signals &&
      typeof profile.signals ===
        'object'
        ? profile.signals
        : {},
  }
}

function directoryActionLabel(
  item = {},
) {
  if (
    item.division ===
    'federation'
  ) {
    return 'Request Screened Intro'
  }

  if (
    item.division ===
    'both'
  ) {
    return 'Open Bridge Request'
  }

  return 'Request Connection'
}

function requestConfigForMember(
  item = {},
) {
  const isFederation =
    item.division ===
    'federation'

  const isBridge =
    item.division === 'both'

  return {
    sourceType:
      isBridge
        ? 'member-bridge'
        : isFederation
          ? 'member-screened'
          : 'member-connection',

    targetId:
      item.id,

    targetLabel:
      item.name,

    region:
      item.region,

    context:
      `${item.role} • ${item.focus}`,

    objective:
      isBridge
        ? 'Bridge request'
        : isFederation
          ? 'Introduction'
          : 'Connection request',

    message:
      `I found ${item.name} in Plaza and want to make a structured request related to ${item.focus || item.role}.`,
  }
}

export default function PlazaDirectoryWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const requestIdRef =
    useRef('')

  const [
    items,
    setItems,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false)

  const [
    nextCursor,
    setNextCursor,
  ] = useState('')

  const [
    hasMore,
    setHasMore,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    form,
    setForm,
  ] = useState(
    INITIAL_FORM,
  )

  const [
    regionFilter,
    setRegionFilter,
  ] = useState(
    () =>
      clean(
        readPlazaUiState()
          .directoryRegion,
      ) || 'all',
  )

  const [
    divisionFilter,
    setDivisionFilter,
  ] = useState(
    () =>
      clean(
        readPlazaUiState()
          .directoryDivision,
      ) || 'all',
  )

  const [
    trustFilter,
    setTrustFilter,
  ] = useState(
    () =>
      clean(
        readPlazaUiState()
          .directoryTrust,
      ) || 'all',
  )

  const [
    profile,
    setProfile,
  ] = useState(null)

  const [
    profileFallback,
    setProfileFallback,
  ] = useState(null)

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(false)

  const [
    messageBusy,
    setMessageBusy,
  ] = useState('')

  const [
    requestMember,
    setRequestMember,
  ] = useState(null)

  const [
    requestForm,
    setRequestForm,
  ] = useState({
    name:
      currentUserName(),
    message: '',
  })

  const [
    requestBusy,
    setRequestBusy,
  ] = useState(false)

  const loadDirectory =
    useCallback(
      async ({
        refresh = false,
        append = false,
        cursor = '',
      } = {}) => {
        if (append) {
          setLoadingMore(
            true,
          )
        } else if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        if (!append) {
          setError('')
        }

        try {
          const params =
            new URLSearchParams({
              limit: '80',
            })

          if (clean(cursor)) {
            params.set(
              'cursor',
              clean(cursor),
            )
          }

          const result =
            await apiFetch(
              `/api/plaza/directory?${params.toString()}`,
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.directory,
            ).map(
              normalizeDirectoryItem,
            )

          setItems(
            (current) => {
              if (!append) {
                return incoming
              }

              const map =
                new Map()

              ;[
                ...current,
                ...incoming,
              ].forEach(
                (item) => {
                  map.set(
                    item.id,
                    item,
                  )
                },
              )

              return Array.from(
                map.values(),
              )
            },
          )

          const cursorValue =
            clean(
              result?.nextCursor ||
                result?.next_cursor,
            )

          setNextCursor(
            cursorValue,
          )

          setHasMore(
            Boolean(
              cursorValue,
            ) &&
              result?.hasMore !==
                false,
          )

          const me =
            currentUserId()

          if (me) {
            const mine =
              incoming.find(
                (item) =>
                  [
                    item.id,
                    item.userId,
                    item.authorId,
                  ].some(
                    (value) =>
                      clean(
                        value,
                      ) === me,
                  ),
              )

            if (
              mine &&
              !append
            ) {
              setForm({
                division:
                  mine.division ||
                  'academy',

                trust:
                  mine.trust ||
                  'verified',

                region:
                  mine.region ===
                  'Global'
                    ? ''
                    : mine.region,

                availability:
                  mine.availability ||
                  '',

                workMode:
                  mine.workMode ||
                  '',

                marketplaceMode:
                  mine.marketplaceMode ||
                  'no',

                role:
                  mine.role ===
                  'Member'
                    ? ''
                    : mine.role,

                tags:
                  mine.tags.join(
                    ', ',
                  ),

                lookingFor:
                  mine.lookingFor.join(
                    ', ',
                  ),

                canOffer:
                  mine.canOffer.join(
                    ', ',
                  ),

                focus:
                  mine.focus ||
                  '',
              })
            }
          }
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Plaza directory. Please refresh.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  const regions =
    useMemo(
      () =>
        Array.from(
          new Set(
            items
              .map(
                (item) =>
                  clean(
                    item.region,
                  ),
              )
              .filter(Boolean),
          ),
        ).sort(),
      [items],
    )

  const visibleItems =
    useMemo(
      () =>
        items.filter(
          (item) => {
            const regionMatch =
              regionFilter ===
                'all' ||
              item.region ===
                regionFilter

            const divisionMatch =
              divisionFilter ===
                'all' ||
              item.division ===
                divisionFilter

            const trustMatch =
              trustFilter ===
                'all' ||
              item.trust ===
                trustFilter

            return (
              regionMatch &&
              divisionMatch &&
              trustMatch
            )
          },
        ),
      [
        items,
        regionFilter,
        divisionFilter,
        trustFilter,
      ],
    )

  const updateForm =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      )
    }

  const saveProfile =
    async (event) => {
      event.preventDefault()

      if (saving) return

      const payload = {
        division:
          clean(
            form.division,
          ) ||
          'academy',

        trust:
          clean(
            form.trust,
          ) ||
          'verified',

        region:
          clean(
            form.region,
          ) ||
          'Global',

        availability:
          clean(
            form.availability,
          ),

        workMode:
          clean(
            form.workMode,
          ),

        marketplaceMode:
          clean(
            form.marketplaceMode,
          ) ||
          'no',

        role:
          clean(
            form.role,
          ),

        tags:
          clean(
            form.tags,
          ),

        lookingFor:
          clean(
            form.lookingFor,
          ),

        canOffer:
          clean(
            form.canOffer,
          ),

        focus:
          clean(
            form.focus,
          ),
      }

      if (!payload.role) {
        onToast?.(
          'Add your directory role first.',
          'error',
        )
        return
      }

      if (!payload.focus) {
        onToast?.(
          'Add your directory focus first.',
          'error',
        )
        return
      }

      const me =
        currentUserId()

      const currentProfile =
        items.find(
          (item) =>
            [
              item.id,
              item.userId,
              item.authorId,
            ].some(
              (value) =>
                clean(value) ===
                me,
            ),
        ) || null

      setSaving(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/directory/profile',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  ...payload,

                  expectedUpdatedAt:
                    currentProfile
                      ?.updatedAt ||
                    '',
                }),
            },
          )

        const saved =
          result?.profile
            ? normalizeDirectoryItem(
                result.profile,
              )
            : null

        if (!saved) {
          throw new Error(
            'Directory profile response was incomplete.',
          )
        }

        setItems(
          (current) => [
            saved,
            ...current.filter(
              (item) =>
                item.id !==
                saved.id,
            ),
          ],
        )

        onToast?.(
          'Directory profile saved.',
          'success',
        )
      } catch (
        saveError
      ) {
        onToast?.(
          saveError?.message ||
            'Could not save directory profile.',
          'error',
        )
      } finally {
        setSaving(false)
      }
    }

  const openProfile =
    async (item) => {
      const targetUserId =
        clean(
          item.userId ||
            item.authorId ||
            item.id,
        )

      if (!targetUserId) {
        onToast?.(
          'This member profile is missing a user id.',
          'error',
        )
        return
      }

      setProfileFallback(
        item,
      )

      setProfileLoading(
        true,
      )

      setProfile({
        fullName:
          item.name,
      })

      try {
        const result =
          await apiFetch(
            `/api/universe/profile/${encodeURIComponent(
              targetUserId,
            )}`,
            {
              method:
                'GET',
            },
          )

        setProfile(
          normalizeUniverseProfile(
            result,
          ),
        )
      } catch (
        profileError
      ) {
        onToast?.(
          profileError?.message ||
            'Could not load this member profile.',
          'error',
        )

        setProfile(null)
      } finally {
        setProfileLoading(
          false,
        )
      }
    }

  const messageMember =
    async (item) => {
      const targetUserId =
        clean(
          item.userId ||
            item.authorId ||
            item.id,
        )

      if (!targetUserId) {
        onToast?.(
          'This member is missing a user id.',
          'error',
        )
        return
      }

      setMessageBusy(
        item.id,
      )

      try {
        const result =
          await apiFetch(
            `/api/plaza/messages/from-member/${encodeURIComponent(
              targetUserId,
            )}`,
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  message:
                    'I opened this conversation from the Plaza directory.',
                }),
            },
          )

        if (
          !result?.conversation
        ) {
          throw new Error(
            'Plaza conversation response was incomplete.',
          )
        }

        const conversation =
          result.conversation

        const conversationId =
          clean(
            conversation.id,
          )

        if (!conversationId) {
          throw new Error(
            'Plaza conversation id was missing.',
          )
        }

        syncDirectoryConversation(
          conversation,
        )

        try {
          sessionStorage.setItem(
            'yh_plaza_open_conversation_id',
            conversationId,
          )
        } catch {}

        setProfile(null)
        setProfileFallback(
          null,
        )

        onToast?.(
          'Plaza conversation opened.',
          'success',
        )

        onWorkspaceOpen?.(
          'plazas-conversations',
        )
      } catch (
        messageError
      ) {
        onToast?.(
          messageError?.message ||
            'Could not open Plaza message.',
          'error',
        )
      } finally {
        setMessageBusy('')
      }
    }

  const openRequest =
    (item) => {
      const config =
        requestConfigForMember(
          item,
        )

      requestIdRef.current =
        createClientRequestId()

      setRequestMember(
        item,
      )

      setRequestForm({
        name:
          currentUserName(),

        message:
          config.message,
      })
    }

  const submitRequest =
    async (event) => {
      event.preventDefault()

      if (
        !requestMember ||
        requestBusy
      ) {
        return
      }

      const config =
        requestConfigForMember(
          requestMember,
        )

      const name =
        clean(
          requestForm.name,
        )

      const message =
        clean(
          requestForm.message,
        )

      if (!name) {
        onToast?.(
          'Add your name first.',
          'error',
        )
        return
      }

      if (!message) {
        onToast?.(
          'Add a request message first.',
          'error',
        )
        return
      }

      if (
        !requestIdRef.current
      ) {
        requestIdRef.current =
          createClientRequestId()
      }

      setRequestBusy(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/requests',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  ...config,

                  name,

                  message,

                  status:
                    'Submitted',

                  clientRequestId:
                    requestIdRef.current,

                  requestPriority:
                    'normal',
                }),
            },
          )

        if (
          !result?.request
        ) {
          throw new Error(
            'Plaza request response was incomplete. Retry with the same request.',
          )
        }

        syncDirectoryRequestInbox(
          result.request,
          requestMember,
          config,
          name,
          message,
        )

        requestIdRef.current =
          ''

        setRequestMember(
          null,
        )

        setProfile(null)
        setProfileFallback(
          null,
        )

        onToast?.(
          'Plaza request submitted.',
          'success',
        )

        onWorkspaceOpen?.(
          'plazas-requests',
        )
      } catch (
        requestError
      ) {
        onToast?.(
          requestError?.message ||
            'Could not submit Plaza request.',
          'error',
        )
      } finally {
        setRequestBusy(false)
      }
    }

  const profileSignals =
    profile?.signals &&
    typeof profile.signals ===
      'object'
      ? profile.signals
      : {}

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-directory-react-workspace"
      data-yh-dashboard-react-surface="plazas-directory"
    >
      <div className="yh-plaza-directory-react-scroll">
        <div className="yh-plaza-directory-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Directory
              </span>

              <h1>
                Plaza Directory
              </h1>

              <p>
                Find trusted
                builders,
                operators,
                connectors and
                cross-division
                members.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadDirectory({
                  refresh:
                    true,
                })
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <form
            className="yh-plaza-directory-composer"
            onSubmit={
              saveProfile
            }
          >
            <div className="yh-plaza-directory-form-grid">
              <label>
                <span>
                  Division
                </span>

                <select
                  className="input-field"
                  value={
                    form.division
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'division',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="academy">
                    Academy
                  </option>

                  <option value="plaza">
                    Plaza
                  </option>

                  <option value="federation">
                    Federation
                  </option>

                  <option value="both">
                    Cross-Division
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Trust Layer
                </span>

                <select
                  className="input-field"
                  value={
                    form.trust
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'trust',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="verified">
                    Verified
                  </option>

                  <option value="connector">
                    Trusted Connector
                  </option>

                  <option value="leader">
                    Local Leader
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Region
                </span>

                <input
                  className="input-field"
                  value={
                    form.region
                  }
                  placeholder="Global, Lagos, London, Dubai..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'region',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Availability
                </span>

                <select
                  className="input-field"
                  value={
                    form.availability
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'availability',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Select
                  </option>

                  <option value="open-now">
                    Open now
                  </option>

                  <option value="part-time">
                    Part-time
                  </option>

                  <option value="full-time">
                    Full-time
                  </option>

                  <option value="selective">
                    Selective
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Work Mode
                </span>

                <select
                  className="input-field"
                  value={
                    form.workMode
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'workMode',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Select
                  </option>

                  <option value="remote">
                    Remote
                  </option>

                  <option value="local">
                    Local
                  </option>

                  <option value="hybrid">
                    Hybrid
                  </option>

                  <option value="global">
                    Global
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Marketplace Mode
                </span>

                <select
                  className="input-field"
                  value={
                    form.marketplaceMode
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'marketplaceMode',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="no">
                    No
                  </option>

                  <option value="yes">
                    Yes
                  </option>
                </select>
              </label>

              <label className="is-wide">
                <span>
                  Role
                </span>

                <input
                  className="input-field"
                  required
                  maxLength={120}
                  value={
                    form.role
                  }
                  placeholder="Builder, operator, designer, connector..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'role',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Tags
                </span>

                <input
                  className="input-field"
                  maxLength={180}
                  value={
                    form.tags
                  }
                  placeholder="Sales, AI, Design, Legal, Fitness..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'tags',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Looking For
                </span>

                <input
                  className="input-field"
                  maxLength={240}
                  value={
                    form.lookingFor
                  }
                  placeholder="Clients, job, investor, partner..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'lookingFor',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Can Offer
                </span>

                <input
                  className="input-field"
                  maxLength={240}
                  value={
                    form.canOffer
                  }
                  placeholder="Design, AI automation, outreach..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'canOffer',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Focus
                </span>

                <textarea
                  className="input-field"
                  required
                  rows="4"
                  maxLength={500}
                  value={
                    form.focus
                  }
                  placeholder="Explain what you do, what you are building, or what people can connect with you for."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'focus',
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-plaza-directory-form-actions">
              <small>
                Federation-linked
                people remain
                screened inside
                Plaza.
              </small>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  saving
                }
              >
                {saving
                  ? 'Saving...'
                  : 'Save Directory Profile'}
              </button>
            </div>
          </form>

          <div className="yh-plaza-directory-filters">
            <label>
              <span>
                Region
              </span>

              <select
                className="input-field"
                value={
                  regionFilter
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target
                      .value

                  setRegionFilter(
                    value,
                  )

                  updatePlazaUiState({
                    directoryRegion:
                      value,
                  })
                }}
              >
                <option value="all">
                  All Regions
                </option>

                {regions.map(
                  (region) => (
                    <option
                      key={
                        region
                      }
                      value={
                        region
                      }
                    >
                      {region}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                Division
              </span>

              <select
                className="input-field"
                value={
                  divisionFilter
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target
                      .value

                  setDivisionFilter(
                    value,
                  )

                  updatePlazaUiState({
                    directoryDivision:
                      value,
                  })
                }}
              >
                <option value="all">
                  All Divisions
                </option>

                <option value="academy">
                  Academy
                </option>

                <option value="plaza">
                  Plaza
                </option>

                <option value="federation">
                  Federation
                </option>

                <option value="both">
                  Cross-Division
                </option>
              </select>
            </label>

            <label>
              <span>
                Trust
              </span>

              <select
                className="input-field"
                value={
                  trustFilter
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target
                      .value

                  setTrustFilter(
                    value,
                  )

                  updatePlazaUiState({
                    directoryTrust:
                      value,
                  })
                }}
              >
                <option value="all">
                  All Trust Layers
                </option>

                <option value="verified">
                  Verified
                </option>

                <option value="connector">
                  Trusted Connector
                </option>

                <option value="leader">
                  Local Leader
                </option>
              </select>
            </label>
          </div>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              directory...
            </div>
          )}

          {error &&
            !loading && (
              <div className="yh-plaza-react-state is-error">
                {error}
              </div>
            )}

          {!loading &&
            !error &&
            !visibleItems.length && (
              <div className="yh-plaza-react-state">
                No Plaza directory
                members match these
                filters.
              </div>
            )}

          <div className="yh-plaza-directory-grid-react">
            {visibleItems.map(
              (item) => (
                <article
                  className="yh-plaza-directory-card-react"
                  key={
                    item.id
                  }
                >
                  <div className="yh-plaza-directory-card-head-react">
                    <div>
                      <span>
                        {titleCase(
                          item.division,
                        )}
                      </span>

                      <span>
                        {titleCase(
                          item.trust,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="yh-plaza-directory-member-head">
                    <div className="yh-plaza-feed-react-avatar">
                      {item.avatar ? (
                        <img
                          src={
                            item.avatar
                          }
                          alt=""
                        />
                      ) : (
                        <span>
                          {item.name
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <strong>
                        {
                          item.name
                        }
                      </strong>

                      <span>
                        {
                          item.role
                        }{' '}
                        •{' '}
                        {
                          item.region
                        }
                      </span>
                    </div>
                  </div>

                  <p>
                    {item.focus ||
                      'No directory focus added yet.'}
                  </p>

                  {(item.availability ||
                    item.workMode ||
                    item.marketplaceMode ===
                      'yes') && (
                    <div className="yh-plaza-directory-chips">
                      {item.availability && (
                        <span>
                          {titleCase(
                            item.availability,
                          )}
                        </span>
                      )}

                      {item.workMode && (
                        <span>
                          {titleCase(
                            item.workMode,
                          )}
                        </span>
                      )}

                      {item.marketplaceMode ===
                        'yes' && (
                        <span>
                          Marketplace
                        </span>
                      )}
                    </div>
                  )}

                  {item.tags.length >
                    0 && (
                    <div className="yh-plaza-directory-tags">
                      {item.tags.map(
                        (tag) => (
                          <span
                            key={
                              tag
                            }
                          >
                            {tag}
                          </span>
                        ),
                      )}
                    </div>
                  )}

                  {item.lookingFor
                    .length >
                    0 && (
                    <div className="yh-plaza-directory-signal">
                      <small>
                        Looking For
                      </small>

                      <div>
                        {item.lookingFor.map(
                          (
                            entry,
                          ) => (
                            <span
                              key={
                                entry
                              }
                            >
                              {
                                entry
                              }
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {item.canOffer
                    .length >
                    0 && (
                    <div className="yh-plaza-directory-signal">
                      <small>
                        Can Offer
                      </small>

                      <div>
                        {item.canOffer.map(
                          (
                            entry,
                          ) => (
                            <span
                              key={
                                entry
                              }
                            >
                              {
                                entry
                              }
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div className="yh-plaza-directory-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        void openProfile(
                          item,
                        )
                      }
                    >
                      View Profile
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={
                        messageBusy ===
                        item.id
                      }
                      onClick={() =>
                        void messageMember(
                          item,
                        )
                      }
                    >
                      {messageBusy ===
                      item.id
                        ? 'Opening...'
                        : 'Message in Plaza'}
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        openRequest(
                          item,
                        )
                      }
                    >
                      {directoryActionLabel(
                        item,
                      )}
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>

          {hasMore &&
            nextCursor && (
              <div className="yh-plaza-feed-react-load-more">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    loadingMore
                  }
                  onClick={() =>
                    void loadDirectory({
                      append:
                        true,

                      cursor:
                        nextCursor,
                    })
                  }
                >
                  {loadingMore
                    ? 'Loading...'
                    : 'Load More'}
                </button>
              </div>
            )}
        </div>
      </div>

      {(profile ||
        profileLoading) && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !profileLoading
            ) {
              setProfile(null)
              setProfileFallback(
                null,
              )
            }
          }}
        >
          <div className="modal-content yh-plaza-directory-profile-modal">
            {profileLoading ? (
              <div className="yh-plaza-react-state">
                Loading unified
                YH Universe
                profile...
              </div>
            ) : (
              <>
                <div className="yh-plaza-directory-profile-cover">
                  {profile?.coverPhoto && (
                    <img
                      src={
                        profile.coverPhoto
                      }
                      alt=""
                    />
                  )}
                </div>

                <div className="yh-plaza-directory-profile-head">
                  <div className="yh-plaza-directory-profile-avatar">
                    {profile?.avatar ? (
                      <img
                        src={
                          profile.avatar
                        }
                        alt=""
                      />
                    ) : (
                      <span>
                        {clean(
                          profile?.fullName ||
                            profileFallback
                              ?.name ||
                            'Y',
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2>
                      {profile?.fullName ||
                        profileFallback
                          ?.name ||
                        'YH Member'}
                    </h2>

                    <p>
                      {profile?.username
                        ? `@${profile.username}`
                        : profile?.trustTier ||
                          'YH Universe Member'}
                    </p>
                  </div>
                </div>

                <p>
                  {profile?.bio ||
                    profileFallback
                      ?.focus ||
                    'No profile bio added yet.'}
                </p>

                <div className="yh-plaza-directory-chips">
                  {[
                    profile?.city,
                    profile?.country,
                    profile?.trustTier,
                    profileSignals.availability,
                    profileSignals.workMode,
                  ]
                    .filter(Boolean)
                    .map(
                      (entry) => (
                        <span
                          key={
                            entry
                          }
                        >
                          {entry}
                        </span>
                      ),
                    )}
                </div>

                {safeArray(
                  profileSignals.lookingFor,
                ).length >
                  0 && (
                  <div className="yh-plaza-directory-signal">
                    <small>
                      Looking For
                    </small>

                    <div>
                      {safeArray(
                        profileSignals.lookingFor,
                      ).map(
                        (
                          entry,
                        ) => (
                          <span
                            key={
                              entry
                            }
                          >
                            {
                              entry
                            }
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {safeArray(
                  profileSignals.canOffer,
                ).length >
                  0 && (
                  <div className="yh-plaza-directory-signal">
                    <small>
                      Can Offer
                    </small>

                    <div>
                      {safeArray(
                        profileSignals.canOffer,
                      ).map(
                        (
                          entry,
                        ) => (
                          <span
                            key={
                              entry
                            }
                          >
                            {
                              entry
                            }
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <div className="roadmap-mission-actions">
                  {profileFallback && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          messageBusy ===
                          profileFallback.id
                        }
                        onClick={() =>
                          void messageMember(
                            profileFallback,
                          )
                        }
                      >
                        {messageBusy ===
                        profileFallback.id
                          ? 'Opening...'
                          : 'Message in Plaza'}
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setProfile(
                            null,
                          )

                          openRequest(
                            profileFallback,
                          )
                        }}
                      >
                        {directoryActionLabel(
                          profileFallback,
                        )}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setProfile(null)
                      setProfileFallback(
                        null,
                      )
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {requestMember && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <form
            className="modal-content yh-plaza-directory-request-modal"
            onSubmit={
              submitRequest
            }
          >
            <span className="yh-plaza-react-kicker">
              Plaza Request
            </span>

            <h2>
              {directoryActionLabel(
                requestMember,
              )}
            </h2>

            <div className="yh-plaza-directory-request-summary">
              <small>
                Target
              </small>

              <strong>
                {
                  requestMember.name
                }
              </strong>

              <span>
                {
                  requestMember.role
                }{' '}
                •{' '}
                {
                  requestMember.region
                }
              </span>
            </div>

            <label>
              <span>
                Your name
              </span>

              <input
                className="input-field"
                required
                value={
                  requestForm.name
                }
                onChange={(
                  event,
                ) =>
                  setRequestForm(
                    (current) => ({
                      ...current,

                      name:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              <span>
                Request
              </span>

              <textarea
                className="input-field"
                required
                rows="5"
                value={
                  requestForm.message
                }
                onChange={(
                  event,
                ) =>
                  setRequestForm(
                    (current) => ({
                      ...current,

                      message:
                        event.target
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
                  requestBusy
                }
                onClick={() => {
                  setRequestMember(
                    null,
                  )

                  requestIdRef.current =
                    ''
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  requestBusy
                }
              >
                {requestBusy
                  ? 'Submitting...'
                  : directoryActionLabel(
                      requestMember,
                    )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
