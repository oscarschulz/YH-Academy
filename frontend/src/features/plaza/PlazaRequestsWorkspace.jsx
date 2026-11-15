import { useLocation } from 'react-router-dom'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  createPlazaNotification,
  getPlazaNotificationRoleLabel,
} from './plazaNotifications'
import './PlazaBridgeWorkspace.css'

const INBOX_KEY =
  'yhPlazaInboxCleanV1'

const STATUS_FLOW = [
  'Draft',
  'Submitted',
  'Under Review',
  'Matched',
  'Closed',
]

const OBJECTIVES = [
  'Connection request',
  'Introduction',
  'Collaboration',
  'Partnership',
  'Access',
  'Hiring',
  'Support',
  'Service Request',
  'Project request',
  'Regional connection',
  'Bridge request',
]

const SOURCES = [
  ['general', 'General'],
  [
    'member-connection',
    'Directory member',
  ],
  [
    'opportunity',
    'Opportunity',
  ],
  ['region', 'Region hub'],
  ['bridge', 'Bridge path'],
  ['project', 'Project'],
  [
    'federation-escalation',
    'Federation escalation',
  ],
]

const EMPTY_FORM = {
  objective:
    'Connection request',

  sourceType:
    'general',

  region: '',
  targetLabel: '',
  targetId: '',
  context: '',
  name: '',
  message: '',

  headline: '',
  experience: '',
  portfolioLink: '',
  attachmentMeta: [],

  providerId: '',
  providerName: '',
  serviceCategory: '',
  serviceTags: '',
  serviceProviderType: '',
  servicePriceType: '',
  serviceDeliveryTime: '',

  requestIntent:
    'manual_plaza_request',

  requestPriority:
    'normal',

  routeKey: '',
  routeLabel: '',

  matchingStatus:
    'queued_for_review',

  matchingPriority:
    'normal',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function buildRequestPayload(
  form = {},
) {
  return {
    objective:
      clean(
        form.objective,
      ) ||
      'Connection request',

    sourceType:
      clean(
        form.sourceType,
      ) ||
      'general',

    region:
      clean(
        form.region,
      ),

    targetId:
      clean(
        form.targetId,
      ),

    targetLabel:
      clean(
        form.targetLabel,
      ) ||
      'General Plaza request',

    context:
      clean(
        form.context,
      ),

    name:
      clean(
        form.name,
      ) ||
      'Unknown requester',

    message:
      clean(
        form.message,
      ),

    headline:
      clean(
        form.headline,
      ),

    experience:
      clean(
        form.experience,
      ),

    portfolioLink:
      clean(
        form.portfolioLink,
      ),

    attachmentMeta:
      safeArray(
        form.attachmentMeta,
      ),

    providerId:
      clean(
        form.providerId,
      ),

    providerName:
      clean(
        form.providerName,
      ),

    serviceCategory:
      clean(
        form.serviceCategory,
      ),

    serviceTags:
      clean(
        form.serviceTags,
      ),

    serviceProviderType:
      clean(
        form.serviceProviderType,
      ),

    servicePriceType:
      clean(
        form.servicePriceType,
      ),

    serviceDeliveryTime:
      clean(
        form.serviceDeliveryTime,
      ),

    requestIntent:
      clean(
        form.requestIntent,
      ) ||
      'manual_plaza_request',

    requestPriority:
      clean(
        form.requestPriority,
      ) ||
      'normal',

    routeKey:
      clean(
        form.routeKey,
      ),

    routeLabel:
      clean(
        form.routeLabel,
      ),

    matchingStatus:
      clean(
        form.matchingStatus,
      ) ||
      'queued_for_review',

    matchingPriority:
      clean(
        form.matchingPriority,
      ) ||
      'normal',
  }
}

function hasMeaningfulDraft(
  payload = {},
) {
  return [
    payload.name,
    payload.message,
    payload.headline,
    payload.experience,
    payload.portfolioLink,
    payload.serviceCategory,
    payload.serviceTags,
    payload.targetId,
    payload.targetLabel,
  ]
    .map(clean)
    .some(Boolean)
}

function removeInboxByRequestId(
  requestId,
) {
  const cleanId =
    clean(
      requestId,
    )

  if (!cleanId) {
    return
  }

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          INBOX_KEY,
        ) || '[]',
      )

    const items =
      Array.isArray(
        parsed,
      )
        ? parsed
        : []

    localStorage.setItem(
      INBOX_KEY,
      JSON.stringify(
        items.filter(
          (item) =>
            clean(
              item?.linkedRequestId,
            ) !== cleanId,
        ),
      ),
    )
  } catch {}
}

function createClientId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `plaza_request_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function normalizeStatus(
  value = '',
) {
  const raw =
    clean(value).toLowerCase()

  if (raw === 'draft') {
    return 'Draft'
  }

  if (
    raw ===
      'under review' ||
    raw ===
      'pending review' ||
    raw === 'review'
  ) {
    return 'Under Review'
  }

  if (
    raw === 'matched'
  ) {
    return 'Matched'
  }

  if (
    raw === 'closed'
  ) {
    return 'Closed'
  }

  return 'Submitted'
}

function normalizeObjective(
  value = '',
) {
  const raw =
    clean(value).toLowerCase()

  if (!raw) {
    return 'Connection request'
  }

  if (
    raw.includes('intro')
  ) {
    return 'Introduction'
  }

  if (
    raw.includes('collab')
  ) {
    return 'Collaboration'
  }

  if (
    raw.includes('partner')
  ) {
    return 'Partnership'
  }

  if (
    raw.includes('access')
  ) {
    return 'Access'
  }

  if (
    raw.includes('hir')
  ) {
    return 'Hiring'
  }

  if (
    raw.includes('support')
  ) {
    return 'Support'
  }

  if (
    raw.includes('service')
  ) {
    return 'Service Request'
  }

  if (
    raw.includes('project')
  ) {
    return 'Project request'
  }

  if (
    raw.includes('regional') ||
    raw.includes('region')
  ) {
    return 'Regional connection'
  }

  if (
    raw.includes('bridge')
  ) {
    return 'Bridge request'
  }

  return 'Connection request'
}

function routeLabel(
  sourceType,
  objective,
) {
  const source =
    clean(
      sourceType,
    ).toLowerCase()

  const normalized =
    normalizeObjective(
      objective,
    )

  if (
    source ===
    'member-connection'
  ) {
    return 'Member connection routing'
  }

  if (
    source ===
    'opportunity'
  ) {
    return 'Opportunity response routing'
  }

  if (
    source ===
      'bridge' ||
    source ===
      'federation-escalation'
  ) {
    return 'Bridge escalation routing'
  }

  if (
    source === 'project'
  ) {
    return 'Project fit routing'
  }

  if (
    source === 'region'
  ) {
    return 'Regional routing'
  }

  if (
    normalized ===
    'Introduction'
  ) {
    return 'Introduction routing'
  }

  if (
    normalized ===
    'Collaboration'
  ) {
    return 'Collaboration routing'
  }

  if (
    normalized ===
    'Partnership'
  ) {
    return 'Partnership routing'
  }

  if (
    normalized ===
    'Access'
  ) {
    return 'Access routing'
  }

  if (
    normalized ===
    'Hiring'
  ) {
    return 'Hiring routing'
  }

  if (
    normalized ===
    'Support'
  ) {
    return 'Support routing'
  }

  if (
    normalized ===
    'Project request'
  ) {
    return 'Project fit routing'
  }

  if (
    normalized ===
    'Regional connection'
  ) {
    return 'Regional routing'
  }

  if (
    normalized ===
      'Bridge request'
  ) {
    return 'Bridge escalation routing'
  }

  return 'General Plaza routing'
}

function statusNote(
  status,
) {
  const value =
    normalizeStatus(
      status,
    )

  if (value === 'Draft') {
    return 'Started but not yet formally sent.'
  }

  if (
    value ===
    'Submitted'
  ) {
    return 'Sent into Plaza and waiting for review logic.'
  }

  if (
    value ===
    'Under Review'
  ) {
    return 'Being screened, evaluated, or routed.'
  }

  if (
    value ===
    'Matched'
  ) {
    return 'A relevant person, lane, or path has been matched.'
  }

  return 'This request flow has been completed or ended.'
}

function normalizeRequest(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `server-request-${index + 1}`,

    clientRequestId:
      clean(
        item.clientRequestId,
      ),

    createdAt:
      clean(item.createdAt),

    updatedAt:
      clean(
        item.updatedAt ||
          item.createdAt,
      ),

    resolvedAt:
      clean(item.resolvedAt),

    status:
      normalizeStatus(
        item.status,
      ),

    sourceType:
      clean(item.sourceType) ||
      'general',

    targetId:
      clean(item.targetId),

    targetLabel:
      clean(
        item.targetLabel,
      ) ||
      'General Plaza request',

    context:
      clean(item.context),

    region:
      clean(item.region),

    name:
      clean(
        item.name ||
          item.authorName,
      ) ||
      'Hustler',

    objective:
      clean(item.objective) ||
      'Connection request',

    message:
      clean(item.message),

    headline:
      clean(
        item.headline,
      ),

    experience:
      clean(
        item.experience,
      ),

    portfolioLink:
      clean(
        item.portfolioLink,
      ),

    attachmentMeta:
      safeArray(
        item.attachmentMeta,
      ),

    providerId:
      clean(
        item.providerId,
      ),

    providerName:
      clean(
        item.providerName,
      ),

    serviceCategory:
      clean(
        item.serviceCategory,
      ),

    serviceTags:
      clean(
        item.serviceTags,
      ),

    serviceProviderType:
      clean(
        item.serviceProviderType,
      ),

    servicePriceType:
      clean(
        item.servicePriceType,
      ),

    serviceDeliveryTime:
      clean(
        item.serviceDeliveryTime,
      ),

    routeKey:
      clean(
        item.routeKey,
      ),

    requestIntent:
      clean(
        item.requestIntent,
      ),

    requestPriority:
      clean(
        item.requestPriority,
      ) ||
      'normal',

    matchingStatus:
      clean(
        item.matchingStatus,
      ),

    matchingPriority:
      clean(
        item.matchingPriority,
      ),

    routeLabel:
      clean(
        item.routeLabel,
      ) ||
      routeLabel(
        item.sourceType,
        item.objective,
      ),

    routedToPatron:
      item.routedToPatron ===
      true,

    patronRegion:
      clean(
        item.patronRegion,
      ),

    patronName:
      clean(
        item.patronName,
      ),

    patronRole:
      clean(
        item.patronRole,
      ),

    patronActionNote:
      clean(
        item.patronActionNote,
      ),

    matchedEntityLabels:
      safeArray(
        item.matchedEntityLabels,
      ),

    decisionSummary:
      clean(
        item.decisionSummary,
      ),

    resolutionSummary:
      clean(
        item.resolutionSummary,
      ),

    statusHistory:
      safeArray(
        item.statusHistory,
      ),
  }
}

function nextStatus(
  status,
) {
  const current =
    STATUS_FLOW.indexOf(
      normalizeStatus(
        status,
      ),
    )

  if (
    current < 0 ||
    current >=
      STATUS_FLOW.length - 1
  ) {
    return ''
  }

  return STATUS_FLOW[
    current + 1
  ]
}

function queueRoleForRequest(
  request,
) {
  const source =
    clean(
      request.sourceType,
    ).toLowerCase()

  const objective =
    normalizeObjective(
      request.objective,
    )

  const context =
    clean(
      request.context,
    ).toLowerCase()

  if (
    objective ===
      'Hiring' ||
    context.includes(
      'hiring',
    )
  ) {
    return 'hr'
  }

  if (
    source === 'project' ||
    objective ===
      'Project request' ||
    objective ===
      'Collaboration'
  ) {
    return 'project-manager'
  }

  if (
    objective ===
      'Partnership' ||
    objective ===
      'Access'
  ) {
    return 'project-owner'
  }

  if (
    [
      'member-screened',
      'member-bridge',
      'bridge',
      'federation-escalation',
    ].includes(source) ||
    objective ===
      'Bridge request' ||
    objective ===
      'Regional connection'
  ) {
    return 'plaza-ops'
  }

  return 'personal'
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
    )
  } catch {
    return []
  }
}

function writeInbox(items) {
  try {
    localStorage.setItem(
      INBOX_KEY,
      JSON.stringify(items),
    )
  } catch {}
}

function syncInbox(
  request,
) {
  if (
    !request ||
    request.status ===
      'Draft'
  ) {
    return
  }

  const inbox =
    readInbox()

  const existingIndex =
    inbox.findIndex(
      (item) =>
        clean(
          item.linkedRequestId,
        ) ===
        request.id,
    )

  const queueRole =
    queueRoleForRequest(
      request,
    )

  const status =
    request.status ===
    'Under Review'
      ? 'Under Review'
      : request.status ===
          'Matched'
        ? 'Matched'
        : request.status ===
            'Closed'
          ? 'Closed'
          : 'New'

  const now =
    new Date().toISOString()

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
        : `incoming-${Date.now()}`,

    kind:
      normalizeObjective(
        request.objective,
      ) === 'Hiring'
        ? 'application'
        : 'request',

    linkedRequestId:
      request.id,

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
      `${normalizeObjective(
        request.objective,
      )} for ${request.targetLabel}`,

    summary:
      request.message,

    senderName:
      request.name,

    targetLabel:
      request.targetLabel,

    targetId:
      request.targetId,

    sourceType:
      request.sourceType,

    objective:
      request.objective,

    region:
      request.region,

    context:
      request.context,

    routeLabel:
      request.routeLabel ||
      routeLabel(
        request.sourceType,
        request.objective,
      ),

    status,

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

  writeInbox(inbox)

  /* PLAZA_REQUEST_NOTIFICATION_PRODUCER */
  if (
    existingIndex < 0
  ) {
    const queueLabel =
      getPlazaNotificationRoleLabel(
        queueRole,
      )

    createPlazaNotification({
      title:
        nextItem.title,

      text:
        `New ${
          nextItem.kind ===
          'application'
            ? 'application'
            : 'incoming request'
        } landed in ${queueLabel}.`,

      audienceRole:
        queueRole,

      relatedType:
        'inbox',

      relatedId:
        nextItem.id,
    })

    createPlazaNotification({
      title:
        'Request submitted',

      text:
        `${nextItem.routeLabel} was sent toward ${queueLabel}.`,

      audienceRole:
        'personal',

      relatedType:
        'request',

      relatedId:
        request.id,
    })
  }
}

export default function PlazaRequestsWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const routeLocation = useLocation()
  const plazaReturn = routeLocation.state?.plazaReturn
  const originKey = String(plazaReturn?.workspaceKey || '')

  const showReturn =
    (
      originKey === 'plazas-opportunities' &&
      plazaReturn?.modal === 'briefing' &&
      plazaReturn?.item
    ) ||
    (
      (originKey === 'plazas-regions' || originKey === 'plazas-atlas') &&
      plazaReturn?.modal === 'region' &&
      plazaReturn?.id
    )

  const returnToOrigin = () => {
    if (!showReturn) return

    onWorkspaceOpen?.(originKey, {
      state: {
        plazaReopenModal:
          originKey === 'plazas-opportunities'
            ? { type: 'opportunity', item: plazaReturn.item }
            : { type: 'region', id: plazaReturn.id },
      },
    })
  }
  const createIdRef =
    useRef('')

  const autosaveTimerRef =
    useRef(null)

  const autosaveBusyRef =
    useRef(false)

  const lastAutosaveSignatureRef =
    useRef('')

  const editorDirtyRef =
    useRef(false)

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
    saving,
    setSaving,
  ] = useState(false)

  const [
    draftStatus,
    setDraftStatus,
  ] = useState('')

  const [
    actionBusy,
    setActionBusy,
  ] = useState('')

  const [
    editingId,
    setEditingId,
  ] = useState('')

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  )

  const [
    selected,
    setSelected,
  ] = useState(null)

  const loadRequests =
    useCallback(
      async ({
        refresh = false,
        append = false,
        cursor = '',
      } = {}) => {
        if (append) {
          setLoadingMore(true)
        } else if (refresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
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
              `/api/plaza/requests?${params.toString()}`,
              {
                method: 'GET',
                cache: 'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.requests,
            ).map(
              normalizeRequest,
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
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Could not load Plaza requests. Please refresh.',
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
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    let prefill =
      null

    try {
      const raw =
        sessionStorage.getItem(
          'yh_plaza_request_prefill',
        )

      if (raw) {
        prefill =
          JSON.parse(raw)
      }

      sessionStorage.removeItem(
        'yh_plaza_request_prefill',
      )
    } catch {}

    if (
      prefill &&
      typeof prefill ===
        'object'
    ) {
      setForm({
        objective:
          clean(
            prefill.objective,
          ) ||
          'Connection request',

        sourceType:
          clean(
            prefill.sourceType,
          ) ||
          'general',

        region:
          clean(
            prefill.region,
          ),

        targetLabel:
          clean(
            prefill.targetLabel,
          ),

        targetId:
          clean(
            prefill.targetId,
          ),

        context:
          clean(
            prefill.context,
          ),

        name:
          clean(
            prefill.name,
          ),

        message:
          clean(
            prefill.message,
          ),

        headline:
          clean(
            prefill.headline,
          ),

        experience:
          clean(
            prefill.experience,
          ),

        portfolioLink:
          clean(
            prefill.portfolioLink,
          ),

        attachmentMeta:
          safeArray(
            prefill.attachmentMeta,
          ),

        providerId:
          clean(
            prefill.providerId,
          ),

        providerName:
          clean(
            prefill.providerName,
          ),

        serviceCategory:
          clean(
            prefill.serviceCategory,
          ),

        serviceTags:
          clean(
            prefill.serviceTags,
          ),

        serviceProviderType:
          clean(
            prefill.serviceProviderType,
          ),

        servicePriceType:
          clean(
            prefill.servicePriceType,
          ),

        serviceDeliveryTime:
          clean(
            prefill.serviceDeliveryTime,
          ),

        requestIntent:
          clean(
            prefill.requestIntent,
          ) ||
          'manual_plaza_request',

        requestPriority:
          clean(
            prefill.requestPriority,
          ) ||
          'normal',

        routeKey:
          clean(
            prefill.routeKey,
          ),

        routeLabel:
          clean(
            prefill.routeLabel,
          ),

        matchingStatus:
          clean(
            prefill.matchingStatus,
          ) ||
          'queued_for_review',

        matchingPriority:
          clean(
            prefill.matchingPriority,
          ) ||
          'normal',
      })
    }
  }, [])

  const sortedItems =
    useMemo(
      () =>
        [...items].sort(
          (a, b) =>
            new Date(
              b.updatedAt ||
                b.createdAt ||
                0,
            ).getTime() -
            new Date(
              a.updatedAt ||
                a.createdAt ||
                0,
            ).getTime(),
        ),
      [items],
    )

  const updateField =
    (
      field,
      value,
    ) => {
      editorDirtyRef.current =
        true

      setDraftStatus('')

      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      )
    }

  const resetEditor =
    () => {
      if (
        autosaveTimerRef.current
      ) {
        clearTimeout(
          autosaveTimerRef.current,
        )

        autosaveTimerRef.current =
          null
      }

      editorDirtyRef.current =
        false

      lastAutosaveSignatureRef.current =
        ''

      setDraftStatus('')
      setEditingId('')

      setForm(
        EMPTY_FORM,
      )
    }

  const beginEdit =
    (item) => {
      editorDirtyRef.current =
        false

      lastAutosaveSignatureRef.current =
        ''

      setDraftStatus('')

      setEditingId(
        item.id,
      )

      setForm({
        objective:
          item.objective,

        sourceType:
          item.sourceType,

        region:
          item.region,

        targetLabel:
          item.targetLabel,

        targetId:
          item.targetId,

        context:
          item.context,

        name:
          item.name,

        message:
          item.message,

        headline:
          item.headline,

        experience:
          item.experience,

        portfolioLink:
          item.portfolioLink,

        attachmentMeta:
          safeArray(
            item.attachmentMeta,
          ),

        providerId:
          item.providerId,

        providerName:
          item.providerName,

        serviceCategory:
          item.serviceCategory,

        serviceTags:
          item.serviceTags,

        serviceProviderType:
          item.serviceProviderType,

        servicePriceType:
          item.servicePriceType,

        serviceDeliveryTime:
          item.serviceDeliveryTime,

        requestIntent:
          item.requestIntent ||
          'manual_plaza_request',

        requestPriority:
          item.requestPriority ||
          'normal',

        routeKey:
          item.routeKey,

        routeLabel:
          item.routeLabel,

        matchingStatus:
          item.matchingStatus ||
          'queued_for_review',

        matchingPriority:
          item.matchingPriority ||
          'normal',
      })

      window.scrollTo({
        top: 0,
        behavior:
          'smooth',
      })
    }

  const persistRequest =
    useCallback(
      async (
        payload,
        mode = 'send',
      ) => {
        const isDraft =
          mode === 'draft'

        let request =
          null

        if (editingId) {
          const current =
            items.find(
              (item) =>
                item.id ===
                editingId,
            )

          if (
            !clean(
              current?.updatedAt,
            )
          ) {
            throw new Error(
              'Request version is missing. Reload My Requests and retry.',
            )
          }

          const targetStatus =
            isDraft
              ? 'Draft'
              : current.status ===
                    'Draft' ||
                  current.status ===
                    'Closed'
                ? 'Submitted'
                : current.status ||
                  'Submitted'

          const result =
            await apiFetch(
              '/api/plaza/requests/' +
                encodeURIComponent(
                  editingId,
                ),
              {
                method: 'PATCH',

                body:
                  JSON.stringify({
                    ...payload,

                    status:
                      targetStatus,

                    expectedUpdatedAt:
                      current.updatedAt,
                  }),
              },
            )

          request =
            result?.request
              ? normalizeRequest(
                  result.request,
                )
              : null
        } else {
          if (
            !createIdRef.current
          ) {
            createIdRef.current =
              createClientId()
          }

          const result =
            await apiFetch(
              '/api/plaza/requests',
              {
                method: 'POST',

                body:
                  JSON.stringify({
                    ...payload,

                    status:
                      isDraft
                        ? 'Draft'
                        : 'Submitted',

                    clientRequestId:
                      createIdRef.current,
                  }),
              },
            )

          request =
            result?.request
              ? normalizeRequest(
                  result.request,
                )
              : null
        }

        if (!request) {
          throw new Error(
            'Plaza request response was incomplete. Retry with the same request.',
          )
        }

        setItems(
          (current) => [
            request,

            ...current.filter(
              (item) =>
                item.id !==
                request.id,
            ),
          ],
        )

        if (
          request.status ===
          'Draft'
        ) {
          removeInboxByRequestId(
            request.id,
          )
        } else {
          syncInbox(
            request,
          )
        }

        return request
      },
      [
        editingId,
        items,
      ],
    )

  const submitRequest =
    async (event) => {
      event.preventDefault()

      if (saving) {
        return
      }

      const submitter =
        event.nativeEvent
          ?.submitter

      const mode =
        submitter?.dataset
          ?.submitMode ===
        'draft'
          ? 'draft'
          : 'send'

      const payload =
        buildRequestPayload(
          form,
        )

      if (
        mode === 'draft'
      ) {
        if (
          !hasMeaningfulDraft(
            payload,
          )
        ) {
          onToast?.(
            'Add something to the request before saving a draft.',
            'error',
          )

          return
        }
      } else if (
        !payload.message
      ) {
        onToast?.(
          'Add a request message first.',
          'error',
        )

        return
      }

      if (
        autosaveTimerRef.current
      ) {
        clearTimeout(
          autosaveTimerRef.current,
        )

        autosaveTimerRef.current =
          null
      }

      setSaving(true)

      try {
        const wasEditing =
          Boolean(
            editingId,
          )

        const request =
          await persistRequest(
            payload,
            mode,
          )

        editorDirtyRef.current =
          false

        lastAutosaveSignatureRef.current =
          JSON.stringify({
            requestId:
              request.id,
            payload,
          })

        if (
          mode === 'draft'
        ) {
          setEditingId(
            request.id,
          )

          setDraftStatus(
            'Draft saved.',
          )

          onToast?.(
            'Draft saved to My Requests.',
            'success',
          )

          return
        }

        createIdRef.current =
          ''

        setDraftStatus('')

        resetEditor()

        onToast?.(
          wasEditing
            ? 'Plaza request updated.'
            : 'Plaza request submitted.',
          'success',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not save Plaza request.',
          'error',
        )
      } finally {
        setSaving(false)
      }
    }

  useEffect(() => {
    if (
      autosaveTimerRef.current
    ) {
      clearTimeout(
        autosaveTimerRef.current,
      )

      autosaveTimerRef.current =
        null
    }

    if (
      !editorDirtyRef.current ||
      saving
    ) {
      return undefined
    }

    const payload =
      buildRequestPayload(
        form,
      )

    if (
      !hasMeaningfulDraft(
        payload,
      )
    ) {
      return undefined
    }

    const signature =
      JSON.stringify({
        requestId:
          editingId,
        payload,
      })

    if (
      signature ===
      lastAutosaveSignatureRef.current
    ) {
      return undefined
    }

    autosaveTimerRef.current =
      window.setTimeout(
        async () => {
          if (
            autosaveBusyRef.current ||
            saving
          ) {
            return
          }

          autosaveBusyRef.current =
            true

          setDraftStatus(
            'Autosaving draft...',
          )

          try {
            const request =
              await persistRequest(
                payload,
                'draft',
              )

            if (
              request?.id
            ) {
              setEditingId(
                request.id,
              )

              editorDirtyRef.current =
                false

              lastAutosaveSignatureRef.current =
                JSON.stringify({
                  requestId:
                    request.id,
                  payload,
                })

              setDraftStatus(
                'Draft autosaved.',
              )
            }
          } catch {
            setDraftStatus(
              'Autosave failed. Use Save as Draft.',
            )
          } finally {
            autosaveBusyRef.current =
              false
          }
        },
        1800,
      )

    return () => {
      if (
        autosaveTimerRef.current
      ) {
        clearTimeout(
          autosaveTimerRef.current,
        )

        autosaveTimerRef.current =
          null
      }
    }
  }, [
    form,
    editingId,
    saving,
    persistRequest,
  ])

  const advanceRequest =
    async (item) => {
      if (
        !item?.id ||
        actionBusy
      ) {
        return
      }

      if (
        !clean(
          item.updatedAt,
        )
      ) {
        onToast?.(
          'Request version is missing. Reload My Requests and retry.',
          'error',
        )
        return
      }

      setActionBusy(
        `advance:${item.id}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/plaza/requests/${encodeURIComponent(
              item.id,
            )}/status`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  expectedUpdatedAt:
                    item.updatedAt,
                }),
            },
          )

        const updated =
          result?.request
            ? normalizeRequest(
                result.request,
              )
            : null

        if (!updated) {
          throw new Error(
            'Updated Plaza request response was incomplete.',
          )
        }

        setItems(
          (current) =>
            current.map(
              (entry) =>
                entry.id ===
                updated.id
                  ? updated
                  : entry,
            ),
        )

        syncInbox(
          updated,
        )

        setSelected(
          (current) =>
            current?.id ===
            updated.id
              ? updated
              : current,
        )

        onToast?.(
          `Request moved to ${updated.status}.`,
          'success',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not advance Plaza request.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const deleteRequest =
    async (item) => {
      if (
        !item?.id ||
        actionBusy
      ) {
        return
      }

      if (
        !clean(
          item.updatedAt,
        )
      ) {
        onToast?.(
          'Request version is missing. Reload My Requests and retry.',
          'error',
        )
        return
      }

      setActionBusy(
        `delete:${item.id}`,
      )

      try {
        await apiFetch(
          `/api/plaza/requests/${encodeURIComponent(
            item.id,
          )}`,
          {
            method:
              'DELETE',

            body:
              JSON.stringify({
                expectedUpdatedAt:
                  item.updatedAt,

                reason:
                  'Deleted from My Requests.',
              }),
          },
        )

        setItems(
          (current) =>
            current.filter(
              (entry) =>
                entry.id !==
                item.id,
            ),
        )

        setSelected(null)

        const inbox =
          readInbox().filter(
            (entry) =>
              clean(
                entry.linkedRequestId,
              ) !== item.id ||
              Boolean(
                clean(
                  entry.conversationId,
                ),
              ),
          )

        writeInbox(inbox)

        onToast?.(
          'Plaza request deleted.',
          'success',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not delete Plaza request.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-requests-react-workspace"
      data-yh-dashboard-react-surface="plazas-requests"
    >
      <div className="yh-plaza-requests-react-scroll">
        <div className="yh-plaza-requests-react-shell">
          {showReturn && (
            <nav
              className="yh-plaza-request-origin-bar"
              aria-label="Return to previous Plaza detail"
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={returnToOrigin}
              >
                {originKey === 'plazas-opportunities'
                  ? 'Back to Quest Briefing'
                  : 'Back to Region Hub'}
              </button>
            </nav>
          )}
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Requests
              </span>

              <h1>
                Structured Plaza Requests
              </h1>

              <p>
                Track intro
                requests,
                opportunity
                requests,
                collaborations,
                regional requests,
                project access and
                Federation
                escalation signals
                from one routing
                layer.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadRequests({
                  refresh: true,
                })
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <form
            className="yh-plaza-request-form"
            onSubmit={
              submitRequest
            }
          >
            <div className="yh-plaza-request-form-grid">
              <label>
                <span>
                  Objective
                </span>

                <select
                  className="input-field"
                  value={
                    form.objective
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'objective',
                      event.target
                        .value,
                    )
                  }
                >
                  {OBJECTIVES.map(
                    (
                      objective,
                    ) => (
                      <option
                        key={
                          objective
                        }
                        value={
                          objective
                        }
                      >
                        {
                          objective
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Source
                </span>

                <select
                  className="input-field"
                  value={
                    form.sourceType
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'sourceType',
                      event.target
                        .value,
                    )
                  }
                >
                  {SOURCES.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Region
                </span>

                <input
                  className="input-field"
                  maxLength={100}
                  value={
                    form.region
                  }
                  placeholder="Global, Lagos, Dubai..."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'region',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Target / Context
                </span>

                <input
                  className="input-field"
                  maxLength={160}
                  value={
                    form.targetLabel
                  }
                  placeholder="Who or what is this request about?"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'targetLabel',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Your name
                </span>

                <input
                  className="input-field"
                  maxLength={140}
                  required
                  value={
                    form.name
                  }
                  placeholder="Your name"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'name',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              {normalizeObjective(
                form.objective,
              ) === 'Hiring' && (
                <>
                  <label>
                    <span>
                      Headline
                    </span>

                    <input
                      className="input-field"
                      required
                      maxLength={180}
                      value={
                        form.headline
                      }
                      placeholder="Short role headline or positioning"
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'headline',
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label className="is-wide">
                    <span>
                      Experience summary
                    </span>

                    <textarea
                      className="input-field"
                      rows="4"
                      required
                      value={
                        form.experience
                      }
                      placeholder="Explain your relevant experience and execution proof"
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'experience',
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Portfolio link
                    </span>

                    <input
                      className="input-field"
                      type="url"
                      value={
                        form.portfolioLink
                      }
                      placeholder="https://your-portfolio-link.com"
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'portfolioLink',
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Resume / CV
                    </span>

                    <input
                      className="input-field"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(
                        event,
                      ) => {
                        const file =
                          event.target
                            .files?.[0]

                        updateField(
                          'attachmentMeta',
                          file
                            ? [
                                {
                                  name:
                                    file.name,

                                  type:
                                    file.type,

                                  size:
                                    file.size,

                                  lastModified:
                                    file.lastModified,

                                  sizeLabel:
                                    file.size >=
                                    1024 * 1024
                                      ? (
                                          file.size /
                                          (1024 *
                                            1024)
                                        ).toFixed(
                                          1,
                                        ) +
                                        ' MB'
                                      : Math.max(
                                          1,
                                          Math.round(
                                            file.size /
                                              1024,
                                          ),
                                        ) +
                                        ' KB',
                                },
                              ]
                            : [],
                        )
                      }}
                    />

                    <small>
                      Resume handling
                      remains
                      metadata-only
                      until backend
                      file storage is
                      connected.
                    </small>
                  </label>
                </>
              )}

              <label className="is-wide">
                <span>
                  {normalizeObjective(
                    form.objective,
                  ) === 'Hiring'
                    ? 'Application note'
                    : 'Message'}
                </span>

                <textarea
                  className="input-field"
                  rows="5"
                  maxLength={1400}
                  required
                  value={
                    form.message
                  }
                  placeholder="Explain the request clearly. What do you need, who should review it, and what outcome do you want?"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'message',
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-plaza-request-form-actions">
              <small>
                {draftStatus ||
                  (editingId
                    ? 'Editing an existing tracked Plaza request.'
                    : routeLabel(
                        form.sourceType,
                        form.objective,
                      ))}
              </small>

              <div>
                {editingId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      saving
                    }
                    onClick={
                      resetEditor
                    }
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  type="submit"
                  className="btn-secondary"
                  data-submit-mode="draft"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Draft'
                      : 'Save as Draft'}
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  data-submit-mode="send"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? 'Saving...'
                    : normalizeObjective(
                          form.objective,
                        ) ===
                        'Hiring'
                      ? editingId
                        ? 'Save Application'
                        : 'Submit Application'
                      : editingId
                        ? 'Save Request'
                        : 'Submit Request'}
                </button>
              </div>
            </div>
          </form>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              requests...
            </div>
          )}

          {!loading &&
            !sortedItems.length && (
              <div className="yh-plaza-react-state">
                No requests yet.
                Create a request
                above or open one
                from another Plaza
                surface.
              </div>
            )}

          <div className="yh-plaza-request-grid-react">
            {sortedItems.map(
              (item) => {
                const next =
                  nextStatus(
                    item.status,
                  )

                return (
                  <article
                    className="yh-plaza-request-card-react"
                    key={
                      item.id
                    }
                  >
                    <div className="yh-plaza-request-card-head">
                      <div>
                        <span>
                          {
                            item.objective
                          }
                        </span>

                        <span>
                          {
                            item.sourceType
                          }
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
                        item.targetLabel
                      }
                    </h3>

                    <p>
                      {item.message ||
                        'No message added.'}
                    </p>

                    <div className="yh-plaza-request-meta">
                      <span>
                        {item.region ||
                          'No region'}
                      </span>

                      <span>
                        {item.routeLabel ||
                          routeLabel(
                            item.sourceType,
                            item.objective,
                          )}
                      </span>

                      {item.routedToPatron && (
                        <span>
                          Patron:{' '}
                          {item.patronName ||
                            item.patronRegion ||
                            'Routed'}
                        </span>
                      )}
                    </div>

                    <div className="yh-plaza-request-flow-react">
                      {STATUS_FLOW.map(
                        (
                          step,
                        ) => {
                          const current =
                            STATUS_FLOW.indexOf(
                              item.status,
                            )

                          const index =
                            STATUS_FLOW.indexOf(
                              step,
                            )

                          return (
                            <span
                              key={
                                step
                              }
                              className={
                                index ===
                                current
                                  ? 'is-current'
                                  : index <
                                      current
                                    ? 'is-complete'
                                    : ''
                              }
                            >
                              {step}
                            </span>
                          )
                        },
                      )}
                    </div>

                    <div className="yh-plaza-request-state-note">
                      <strong>
                        Current state
                      </strong>

                      <span>
                        {statusNote(
                          item.status,
                        )}
                      </span>
                    </div>

                    <div className="yh-plaza-request-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setSelected(
                            item,
                          )
                        }
                      >
                        View Request
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          Boolean(
                            actionBusy,
                          )
                        }
                        onClick={() =>
                          beginEdit(
                            item,
                          )
                        }
                      >
                        {item.status ===
                        'Draft'
                          ? 'Edit Draft'
                          : item.status ===
                              'Closed'
                            ? 'Edit / Reopen'
                            : 'Edit Request'}
                      </button>

                      {next && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={
                            Boolean(
                              actionBusy,
                            )
                          }
                          onClick={() =>
                            void advanceRequest(
                              item,
                            )
                          }
                        >
                          {actionBusy ===
                          `advance:${item.id}`
                            ? 'Updating...'
                            : `Move to ${next}`}
                        </button>
                      )}
                    </div>
                  </article>
                )
              },
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
                    void loadRequests({
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

      {selected && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content yh-plaza-request-detail-modal">
            <span className="yh-plaza-react-kicker">
              {
                selected.objective
              }
            </span>

            <h2>
              {
                selected.targetLabel
              }
            </h2>

            <p>
              {
                selected.message
              }
            </p>

            <div className="yh-plaza-request-detail-grid">
              <div>
                <small>
                  Status
                </small>

                <strong>
                  {
                    selected.status
                  }
                </strong>
              </div>

              <div>
                <small>
                  Route
                </small>

                <strong>
                  {selected.routeLabel ||
                    routeLabel(
                      selected.sourceType,
                      selected.objective,
                    )}
                </strong>
              </div>

              <div>
                <small>
                  Region
                </small>

                <strong>
                  {selected.region ||
                    'No region'}
                </strong>
              </div>

              <div>
                <small>
                  Requester
                </small>

                <strong>
                  {
                    selected.name
                  }
                </strong>
              </div>
            </div>

            {selected.matchedEntityLabels
              .length >
              0 && (
              <div className="yh-plaza-request-detail-block">
                <small>
                  Suggested / Matched
                </small>

                <strong>
                  {selected.matchedEntityLabels.join(
                    ', ',
                  )}
                </strong>
              </div>
            )}

            {selected.decisionSummary && (
              <div className="yh-plaza-request-detail-block">
                <small>
                  Decision
                </small>

                <strong>
                  {
                    selected.decisionSummary
                  }
                </strong>
              </div>
            )}

            {selected.resolutionSummary && (
              <div className="yh-plaza-request-detail-block">
                <small>
                  Resolution
                </small>

                <strong>
                  {
                    selected.resolutionSummary
                  }
                </strong>
              </div>
            )}

            <div className="roadmap-mission-actions">
              {nextStatus(
                selected.status,
              ) && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    Boolean(
                      actionBusy,
                    )
                  }
                  onClick={() =>
                    void advanceRequest(
                      selected,
                    )
                  }
                >
                  {actionBusy ===
                  `advance:${selected.id}`
                    ? 'Updating...'
                    : `Move to ${nextStatus(selected.status)}`}
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                disabled={
                  Boolean(
                    actionBusy,
                  )
                }
                onClick={() =>
                  void deleteRequest(
                    selected,
                  )
                }
              >
                {actionBusy ===
                `delete:${selected.id}`
                  ? 'Deleting...'
                  : 'Delete Request'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
