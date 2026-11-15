import { useLocation, useNavigate } from 'react-router-dom'
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
import './PlazaOpportunitiesWorkspace.css'

const QUEST_FILTERS = [
  ['all', 'All Quests'],
  ['available', 'Available'],
  ['contract', 'Contracts'],
  ['collaboration', 'Collaborations'],
  ['paid', 'Paid'],
  ['regional', 'Regional'],
  ['my-activity', 'My Activity'],
]

const OPPORTUNITY_TYPES = [
  'Opportunity',
  'Job Opportunity',
  'Hire Talent',
  'Get Hired',
  'Operator Bounty',
  'Hiring',
  'Collaboration',
  'Partnership',
  'Introduction',
  'Service Listing',
  'Service Request',
  'Project Opening',
  'Regional Support',
]

const ECONOMY_OPTIONS = [
  ['not_sure', 'Not sure yet'],
  ['free', 'Free / signal only'],
  ['paid', 'Paid'],
  ['commission', 'Commission'],
  ['revenue_share', 'Revenue share'],
  ['bounty', 'Bounty'],
  ['equity', 'Equity'],
]

const ESCALATION_OPTIONS = [
  ['none', 'No escalation yet'],
  [
    'academy_payout_signal',
    'Academy payout signal',
  ],
  [
    'federation_candidate',
    'Federation candidate',
  ],
  [
    'federation_paid_intro',
    'Federation paid intro',
  ],
]

const PRICE_TYPES = [
  ['custom_quote', 'Custom quote'],
  ['fixed', 'Fixed price'],
  ['hourly', 'Hourly'],
  ['package', 'Package'],
  ['commission', 'Commission'],
]

const PROVIDER_TYPES = [
  ['plaza_provider', 'Plaza Provider'],
  ['academy_member', 'Academy Member'],
  ['federation_member', 'Federation Member'],
  ['agency_team', 'Agency / Team'],
]

const INITIAL_FORM = {
  type: 'Opportunity',
  region: '',
  economyMode: 'not_sure',
  currency: 'USD',
  budgetMin: '',
  budgetMax: '',
  commissionRate: '',
  federationEscalation: 'none',
  serviceCategory: '',
  servicePriceType: 'custom_quote',
  serviceDeliveryTime: '',
  serviceProviderType: 'plaza_provider',
  serviceTags: '',
  serviceOutcome: '',
  serviceRequirements: '',
  title: '',
  text: '',
  monetizationNote: '',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function money(value) {
  const parsed =
    Number(value || 0)

  return Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : 0
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

function createClientId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return `plaza_opportunity_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function currentUserId() {
  const keys = [
    'yh_user_id',
    'yh_uid',
    'user_id',
    'uid',
  ]

  for (const key of keys) {
    try {
      const value =
        sessionStorage.getItem(
          key,
        ) ||
        localStorage.getItem(
          key,
        ) ||
        ''

      if (clean(value)) {
        return clean(value)
      }
    } catch {}
  }

  return ''
}

function normalizeOpportunity(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `plaza-opportunity-${index}`,

    type:
      clean(item.type) ||
      'Opportunity',

    region:
      clean(item.region) ||
      'Global',

    title:
      clean(item.title) ||
      'Plaza opportunity',

    text:
      clean(
        item.text ||
          item.description,
      ),

    economyMode:
      clean(
        item.economyMode ||
          item.compensationType,
      ) ||
      'not_sure',

    currency:
      clean(item.currency)
        .toUpperCase() ||
      'USD',

    budgetMin:
      money(item.budgetMin),

    budgetMax:
      money(item.budgetMax),

    commissionRate:
      money(
        item.commissionRate,
      ),

    federationEscalation:
      clean(
        item.federationEscalation,
      ) ||
      'none',

    monetizationNote:
      clean(
        item.monetizationNote,
      ),

    serviceCategory:
      clean(
        item.serviceCategory,
      ),

    serviceTags:
      safeArray(
        item.serviceTags,
      ),

    servicePriceType:
      clean(
        item.servicePriceType,
      ) ||
      'custom_quote',

    serviceDeliveryTime:
      clean(
        item.serviceDeliveryTime,
      ),

    serviceProviderType:
      clean(
        item.serviceProviderType,
      ),

    serviceRequirements:
      clean(
        item.serviceRequirements,
      ),

    serviceOutcome:
      clean(
        item.serviceOutcome,
      ),

    userId:
      clean(
        item.userId ||
          item.authorId ||
          item.ownerUid ||
          item.createdByUserId,
      ),

    authorName:
      clean(
        item.authorName ||
          item.ownerName,
      ) ||
      'Plaza Member',

    authorAvatar:
      clean(
        item.authorAvatar ||
          item.avatar ||
          item.profilePhoto ||
          item.photoURL ||
          item.ownerAvatar,
      ),

    pricingAmount:
      money(
        item.pricingAmount ||
          item.amount ||
          item.price,
      ),

    paymentLedgerId:
      clean(
        item.paymentLedgerId,
      ),

    paymentLedgerStatus:
      clean(
        item.paymentLedgerStatus,
      ),

    paymentStatus:
      clean(
        item.paymentStatus,
      ),

    dealStatus:
      clean(item.dealStatus),

    platformCommissionAmount:
      money(
        item.platformCommissionAmount,
      ),

    operatorPayoutAmount:
      money(
        item.operatorPayoutAmount,
      ),

    paymentProviderOptions:
      safeArray(
        item.paymentProviderOptions,
      ),

    status:
      clean(
        item.status ||
          item.opportunityStatus,
      ),

    deadline:
      clean(
        item.deadline ||
          item.dueDate ||
          item.expiresAt,
      ),

    requiredSkills:
      safeArray(
        item.requiredSkills ||
          item.skills ||
          item.serviceTags,
      ),

    expectedOutput:
      clean(
        item.expectedOutput ||
          item.serviceOutcome,
      ),

    applicantsCount:
      money(
        item.applicantsCount ||
          item.applicationCount,
      ),
  }
}

function questClass(
  item = {},
) {
  const type =
    clean(item.type)
      .toLowerCase()

  const escalation =
    clean(
      item.federationEscalation,
    ).toLowerCase()

  if (
    type.includes('service')
  ) {
    return 'Service Quest'
  }

  if (
    type.includes(
      'collaboration',
    ) ||
    type.includes(
      'partnership',
    )
  ) {
    return 'Collaboration Quest'
  }

  if (
    type.includes(
      'introduction',
    ) ||
    escalation.includes(
      'federation',
    )
  ) {
    return 'Connector Quest'
  }

  if (
    type.includes('regional')
  ) {
    return 'Regional Quest'
  }

  if (
    type.includes('project')
  ) {
    return 'Project Quest'
  }

  if (
    type.includes('job') ||
    type.includes('hire') ||
    type.includes('hiring') ||
    type.includes('bounty') ||
    type.includes('operator')
  ) {
    return 'Contract Quest'
  }

  return 'Opportunity Quest'
}

function questState(
  item = {},
) {
  const joined = [
    item.status,
    item.dealStatus,
    item.paymentStatus,
    item.paymentLedgerStatus,
  ]
    .map((value) =>
      clean(value)
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(' ')

  if (
    /expired/.test(joined)
  ) {
    return 'Expired'
  }

  if (
    /cancel|closed|rejected|declined/.test(
      joined,
    )
  ) {
    return 'Closed'
  }

  if (
    /complete|completed|settled|released|paid/.test(
      joined,
    )
  ) {
    return 'Completed'
  }

  if (
    /active|in.progress|engaged|accepted/.test(
      joined,
    )
  ) {
    return 'Active Deal'
  }

  if (
    /payment|transaction|ledger|funding|escrow/.test(
      joined,
    ) &&
    /pending|draft|created|processing/.test(
      joined,
    )
  ) {
    return 'Transaction Pending'
  }

  if (
    /discussion|conversation|contacted|matched/.test(
      joined,
    )
  ) {
    return 'In Discussion'
  }

  if (
    /review|pending|submitted|screening/.test(
      joined,
    )
  ) {
    return 'Reviewing'
  }

  return 'Available'
}

function moneyRange(
  item = {},
) {
  const min =
    money(item.budgetMin)

  const max =
    money(item.budgetMax)

  const currency =
    clean(item.currency)
      .toUpperCase() ||
    'USD'

  if (min && max) {
    return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`
  }

  if (min || max) {
    return `${currency} ${(min || max).toLocaleString()}`
  }

  return ''
}

function questDifficulty(
  item = {},
) {
  const type =
    clean(item.type)
      .toLowerCase()

  const economy =
    clean(
      item.economyMode,
    ).toLowerCase()

  const escalation =
    clean(
      item.federationEscalation,
    ).toLowerCase()

  const value =
    Math.max(
      money(item.budgetMin),
      money(item.budgetMax),
      money(
        item.pricingAmount,
      ),
    )

  if (
    escalation ===
      'federation_paid_intro' ||
    escalation ===
      'federation_candidate' ||
    economy === 'equity' ||
    value >= 5000
  ) {
    return 'Elite'
  }

  if (
    [
      'paid',
      'commission',
      'revenue_share',
      'bounty',
    ].includes(
      economy,
    ) ||
    type.includes('project') ||
    type.includes('hiring') ||
    type.includes(
      'partnership',
    ) ||
    value >= 500
  ) {
    return 'Advanced'
  }

  return 'Standard'
}

function questReward(
  item = {},
) {
  const range =
    moneyRange(item)

  if (range) {
    return range
  }

  const rate =
    money(
      item.commissionRate,
    )

  if (rate) {
    return `${rate}% commission`
  }

  const economy =
    clean(
      item.economyMode,
    ).toLowerCase()

  if (economy === 'free') {
    return 'Signal / relationship value'
  }

  if (
    economy === 'equity'
  ) {
    return 'Equity discussion'
  }

  if (
    economy ===
    'revenue_share'
  ) {
    return 'Revenue-share terms pending'
  }

  return 'Reward details pending'
}

function questRequirement(
  item = {},
) {
  if (
    clean(
      item.serviceRequirements,
    )
  ) {
    return clean(
      item.serviceRequirements,
    )
  }

  const skills =
    safeArray(
      item.requiredSkills,
    )
      .map(clean)
      .filter(Boolean)

  if (skills.length) {
    return skills
      .slice(0, 4)
      .join(', ')
  }

  if (
    clean(
      item.serviceCategory,
    )
  ) {
    return clean(
      item.serviceCategory,
    )
  }

  if (
    clean(
      item.serviceProviderType,
    )
  ) {
    return titleCase(
      item.serviceProviderType,
    )
  }

  return 'Open requirement'
}

function isPaidQuest(
  item = {},
) {
  const economy =
    clean(
      item.economyMode,
    ).toLowerCase()

  return (
    [
      'paid',
      'commission',
      'revenue_share',
      'bounty',
      'equity',
    ].includes(
      economy,
    ) ||
    Boolean(
      moneyRange(item),
    ) ||
    money(
      item.pricingAmount,
    ) > 0
  )
}

function isMine(
  item = {},
) {
  const me =
    currentUserId()

  if (!me) {
    return false
  }

  return [
    item.userId,
    item.authorId,
    item.ownerUid,
    item.createdByUserId,
  ].some(
    (value) =>
      clean(value) === me,
  )
}

function matchesFilter(
  item,
  filter,
) {
  if (
    filter === 'available'
  ) {
    return (
      questState(item) ===
      'Available'
    )
  }

  if (
    filter === 'contract'
  ) {
    return (
      questClass(item) ===
      'Contract Quest'
    )
  }

  if (
    filter ===
    'collaboration'
  ) {
    return (
      questClass(item) ===
      'Collaboration Quest'
    )
  }

  if (filter === 'paid') {
    return isPaidQuest(
      item,
    )
  }

  if (
    filter === 'regional'
  ) {
    const region =
      clean(item.region)
        .toLowerCase()

    return (
      questClass(item) ===
        'Regional Quest' ||
      Boolean(
        region &&
          ![
            'global',
            'unknown region',
          ].includes(region),
      )
    )
  }

  if (
    filter ===
    'my-activity'
  ) {
    return isMine(item)
  }

  return true
}

function grossAmount(
  item = {},
) {
  return money(
    item.pricingAmount ||
      item.amount ||
      item.price ||
      item.budgetAmount ||
      item.budgetMax ||
      item.budgetMin,
  )
}

function commissionAmount(
  item = {},
) {
  const explicit =
    money(
      item.platformCommissionAmount,
    )

  if (explicit) {
    return explicit
  }

  const gross =
    grossAmount(item)

  const rate =
    Number(
      item.commissionRate ||
        0,
    )

  if (
    !gross ||
    !rate
  ) {
    return 0
  }

  const normalizedRate =
    rate > 1
      ? rate / 100
      : rate

  return (
    Math.round(
      gross *
        normalizedRate *
        100,
    ) / 100
  )
}

function operatorPayout(
  item = {},
) {
  const explicit =
    money(
      item.operatorPayoutAmount,
    )

  if (explicit) {
    return explicit
  }

  return Math.max(
    0,
    Math.round(
      (grossAmount(item) -
        commissionAmount(
          item,
        )) *
        100,
    ) / 100,
  )
}

function paymentStatus(
  item = {},
) {
  const status =
    clean(
      item.paymentStatus,
    ).toLowerCase()

  const ledger =
    clean(
      item.paymentLedgerStatus,
    ).toLowerCase()

  if (
    status === 'paid' ||
    ledger === 'paid'
  ) {
    return 'Paid'
  }

  if (
    ledger === 'draft'
  ) {
    return 'Ledger Draft'
  }

  if (
    item.paymentLedgerId
  ) {
    return 'Ledger Created'
  }

  return 'Not Started'
}

function opportunityObjective(
  item = {},
) {
  const escalation =
    clean(
      item.federationEscalation,
    ).toLowerCase()

  const type =
    clean(
      item.type ||
        item.tag,
    ).toLowerCase()

  if (
    type ===
    'service listing'
  ) {
    return 'Service Request'
  }

  if (
    escalation ===
    'federation_paid_intro'
  ) {
    return 'Introduction'
  }

  if (
    escalation ===
    'federation_candidate'
  ) {
    return 'Access'
  }

  if (
    escalation ===
    'academy_payout_signal'
  ) {
    return 'Project request'
  }

  if (
    type.includes('intro')
  ) {
    return 'Introduction'
  }

  if (
    type.includes('collab')
  ) {
    return 'Collaboration'
  }

  if (
    type.includes('partner')
  ) {
    return 'Partnership'
  }

  if (
    type.includes('access')
  ) {
    return 'Access'
  }

  if (
    type.includes('hir') ||
    type.includes('job')
  ) {
    return 'Hiring'
  }

  if (
    type.includes('support')
  ) {
    return 'Support'
  }

  if (
    type.includes('project')
  ) {
    return 'Project request'
  }

  if (
    type.includes('region')
  ) {
    return 'Regional connection'
  }

  if (
    type.includes('bridge')
  ) {
    return 'Bridge request'
  }

  if (
    type ===
    'service request'
  ) {
    return 'Service Request'
  }

  return 'Connection request'
}

function opportunitySourceType(
  item = {},
) {
  const escalation =
    clean(
      item.federationEscalation,
    ).toLowerCase()

  if (
    escalation ===
      'federation_paid_intro' ||
    escalation ===
      'federation_candidate'
  ) {
    return 'federation-escalation'
  }

  return 'opportunity'
}

function opportunityPrimaryLabel(
  item = {},
) {
  const escalation =
    clean(
      item.federationEscalation,
    ).toLowerCase()

  const economy =
    clean(
      item.economyMode,
    ).toLowerCase()

  const objective =
    opportunityObjective(
      item,
    )

  const type =
    clean(
      item.type,
    ).toLowerCase()

  if (
    type ===
    'service listing'
  ) {
    return 'Request Service'
  }

  if (
    escalation ===
    'federation_paid_intro'
  ) {
    return 'Request Federation Paid Intro'
  }

  if (
    escalation ===
    'federation_candidate'
  ) {
    return 'Request Federation Screening'
  }

  if (
    escalation ===
    'academy_payout_signal'
  ) {
    return 'Open Academy Payout Path'
  }

  if (
    objective ===
    'Hiring'
  ) {
    return 'Apply Through Plaza'
  }

  if (
    economy ===
    'paid'
  ) {
    return 'Open Paid Opportunity'
  }

  if (
    economy ===
    'commission'
  ) {
    return 'Request Commission Deal'
  }

  if (
    economy ===
    'revenue_share'
  ) {
    return 'Request Revenue Share Path'
  }

  if (
    economy ===
    'bounty'
  ) {
    return 'Claim Bounty Path'
  }

  if (
    economy ===
    'equity'
  ) {
    return 'Request Equity Discussion'
  }

  return (
    clean(item.action) ||
    'Open Request'
  )
}

function opportunityRequestPrefill(
  item = {},
) {
  const objective =
    opportunityObjective(
      item,
    )

  const sourceType =
    opportunitySourceType(
      item,
    )

  const serviceTags =
    safeArray(
      item.serviceTags,
    )
      .map(clean)
      .filter(Boolean)

  const providerId =
    clean(
      item.authorId ||
        item.userId ||
        item.ownerUid ||
        item.createdByUserId,
    )

  const providerName =
    clean(
      item.authorName ||
        item.ownerName ||
        item.member ||
        item.name,
    )

  const serviceCategory =
    clean(
      item.serviceCategory,
    )

  const isService =
    clean(
      item.type,
    ).toLowerCase() ===
      'service listing' ||
    objective ===
      'Service Request'

  const routeKey =
    isService
      ? 'service_request'
      : sourceType ===
          'federation-escalation'
        ? 'federation_escalation'
        : objective ===
            'Hiring'
          ? 'plaza_hiring'
          : objective ===
              'Regional connection'
            ? 'regional_connection'
            : objective ===
                'Bridge request'
              ? 'bridge_request'
              : 'plaza_request'

  const routeLabel =
    isService
      ? 'Service request • ' +
        (serviceCategory ||
          item.title ||
          'Plaza service')
      : sourceType ===
          'federation-escalation'
        ? 'Federation escalation • ' +
          (item.title ||
            'Opportunity')
        : objective ===
            'Hiring'
          ? 'Hiring route • ' +
            (item.title ||
              'Opportunity')
          : objective +
            ' • ' +
            (item.title ||
              'Plaza request')

  const economyContext =
    [
      clean(
        item.economyMode,
      )
        ? 'Economy: ' +
          clean(
            item.economyMode,
          )
        : '',

      moneyRange(item)
        ? 'Budget/price: ' +
          moneyRange(item)
        : '',

      money(
        item.commissionRate,
      )
        ? 'Commission: ' +
          money(
            item.commissionRate,
          ) +
          '%'
        : '',

      clean(
        item.federationEscalation,
      ) &&
      clean(
        item.federationEscalation,
      ) !== 'none'
        ? 'Escalation: ' +
          clean(
            item.federationEscalation,
          )
        : '',

      serviceCategory
        ? 'Service category: ' +
          serviceCategory
        : '',
    ]
      .filter(Boolean)
      .join(' • ')

  const title =
    clean(
      item.title,
    ) ||
    'this opportunity'

  const type =
    clean(
      item.type ||
        item.tag,
    ) ||
    'opportunity'

  const message =
    [
      clean(
        item.type,
      ).toLowerCase() ===
      'service listing'
        ? 'I want to request this service inside Plaza: ' +
          title +
          '.'
        : 'I want to respond to this ' +
          type.toLowerCase() +
          ' inside Plaza: ' +
          title +
          '.',

      clean(
        item.region,
      )
        ? 'Region: ' +
          clean(
            item.region,
          ) +
          '.'
        : '',

      economyContext
        ? 'Economy context: ' +
          economyContext +
          '.'
        : '',

      clean(
        item.serviceOutcome,
      )
        ? 'Expected outcome: ' +
          clean(
            item.serviceOutcome,
          ) +
          '.'
        : '',

      clean(
        item.serviceRequirements,
      )
        ? 'Provider requirements: ' +
          clean(
            item.serviceRequirements,
          ) +
          '.'
        : '',

      clean(
        item.monetizationNote,
      )
        ? 'Monetization note: ' +
          clean(
            item.monetizationNote,
          )
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')

  return {
    objective,
    sourceType,

    targetId:
      clean(
        item.id,
      ),

    targetLabel:
      title,

    region:
      clean(
        item.region,
      ),

    context:
      [
        type,
        economyContext,
      ]
        .filter(Boolean)
        .join(' • '),

    message,

    providerId,
    providerName,

    serviceCategory,

    serviceTags:
      serviceTags.join(
        ', ',
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

    requestIntent:
      isService
        ? 'request_service'
        : 'respond_to_opportunity',

    requestPriority:
      sourceType ===
      'federation-escalation'
        ? 'high'
        : 'normal',

    routeKey,
    routeLabel,

    matchingStatus:
      'queued_for_review',

    matchingPriority:
      sourceType ===
      'federation-escalation'
        ? 'high'
        : 'normal',

    applicationMode:
      objective ===
      'Hiring',
  }
}

export default function PlazaOpportunitiesWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const routeLocation = useLocation()
  const routeNavigate = useNavigate()

  const createIdRef =
    useRef('')

  const [
    items,
    setItems,
  ] = useState([])

  const [
    filter,
    setFilter,
  ] = useState(
    () =>
      clean(
        readPlazaUiState()
          .questFilter,
      ) || 'all',
  )

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
    error,
    setError,
  ] = useState('')

  const [
    posting,
    setPosting,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState(
    INITIAL_FORM,
  )

  const [
    briefing,
    setBriefing,
  ] = useState(null)

  const [
    ledger,
    setLedger,
  ] = useState(null)

  const [
    ledgerForm,
    setLedgerForm,
  ] = useState({
    amount: '',
    currency: 'USD',
    commissionRate: '20',
  })

  const [
    ledgerBusy,
    setLedgerBusy,
  ] = useState(false)

  const loadOpportunities =
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
              `/api/plaza/opportunities?${params.toString()}`,
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.opportunities,
            ).map(
              normalizeOpportunity,
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
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Plaza opportunities. Please refresh.'

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
    void loadOpportunities()
  }, [loadOpportunities])

  useEffect(() => {
    let prefill =
      null

    try {
      const raw =
        sessionStorage.getItem(
          'yh_plaza_opportunity_briefing',
        )

      if (raw) {
        prefill =
          JSON.parse(raw)
      }

      sessionStorage.removeItem(
        'yh_plaza_opportunity_briefing',
      )
    } catch {}

    if (
      prefill &&
      typeof prefill ===
        'object'
    ) {
      setBriefing(
        normalizeOpportunity({
          ...prefill,

          type:
            prefill.type ||
            'Opportunity',

          title:
            prefill.title ||
            'Plaza Opportunity',

          region:
            prefill.region ||
            'Global',

          text:
            prefill.text ||
            '',
        }),
      )
    }
  }, [])

  useEffect(() => {
    const previous = routeLocation.state?.plazaReopenModal

    if (previous?.type !== 'opportunity' || !previous.item) return

    setBriefing(normalizeOpportunity(previous.item))

    routeNavigate(routeLocation.pathname + routeLocation.search, {
      replace: true,
      state: null,
    })
  }, [routeLocation, routeNavigate])

  const visibleItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            matchesFilter(
              item,
              filter,
            ),
        ),
      [items, filter],
    )

  /* YHU_PLAZA_QUEST_FILTER_COUNTS_PARITY */
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        QUEST_FILTERS.map(([key]) => [
          key,
          key === 'all'
            ? items.length
            : items.filter((item) =>
                matchesFilter(item, key)
              ).length,
        ]),
      ),
    [items],
  )

  const summary =
    useMemo(
      () => ({
        all: items.length,

        available:
          items.filter(
            (item) =>
              questState(
                item,
              ) ===
              'Available',
          ).length,

        paid:
          items.filter(
            isPaidQuest,
          ).length,

        regional:
          items.filter(
            (item) =>
              matchesFilter(
                item,
                'regional',
              ),
          ).length,
      }),
      [items],
    )

  const openOpportunityRequest =
    (item) => {
      if (!item) {
        return
      }

      const prefill =
        opportunityRequestPrefill(
          item,
        )

      try {
        sessionStorage.setItem(
          'yh_plaza_request_prefill',
          JSON.stringify(
            prefill,
          ),
        )
      } catch {}

      setBriefing(null)

      onWorkspaceOpen?.('plazas-requests', {
        state: {
          plazaReturn: {
            workspaceKey: 'plazas-opportunities',
            modal: 'briefing',
            item,
          },
        },
      })
    }

  const updateForm =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]:
            value,
        }),
      )
    }

  const submitOpportunity =
    async (event) => {
      event.preventDefault()

      if (posting) return

      const payload = {
        type:
          clean(form.type) ||
          'Opportunity',

        region:
          clean(
            form.region,
          ) ||
          'Global',

        title:
          clean(
            form.title,
          ),

        text:
          clean(
            form.text,
          ),

        economyMode:
          clean(
            form.economyMode,
          ) ||
          'not_sure',

        currency:
          clean(
            form.currency,
          )
            .toUpperCase() ||
          'USD',

        budgetMin:
          money(
            form.budgetMin,
          ),

        budgetMax:
          money(
            form.budgetMax,
          ),

        commissionRate:
          money(
            form.commissionRate,
          ),

        federationEscalation:
          clean(
            form.federationEscalation,
          ) ||
          'none',

        monetizationNote:
          clean(
            form.monetizationNote,
          ),

        serviceCategory:
          clean(
            form.serviceCategory,
          ),

        serviceTags:
          clean(
            form.serviceTags,
          ),

        servicePriceType:
          clean(
            form.servicePriceType,
          ) ||
          'custom_quote',

        serviceDeliveryTime:
          clean(
            form.serviceDeliveryTime,
          ),

        serviceProviderType:
          clean(
            form.serviceProviderType,
          ) ||
          'plaza_provider',

        serviceRequirements:
          clean(
            form.serviceRequirements,
          ),

        serviceOutcome:
          clean(
            form.serviceOutcome,
          ),
      }

      if (!payload.title) {
        onToast?.(
          'Add an opportunity title first.',
          'error',
        )
        return
      }

      if (!payload.text) {
        onToast?.(
          'Describe the opportunity first.',
          'error',
        )
        return
      }

      if (
        !createIdRef.current
      ) {
        createIdRef.current =
          createClientId()
      }

      setPosting(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/opportunities',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  ...payload,

                  clientCreateId:
                    createIdRef.current,
                }),
            },
          )

        const opportunity =
          result?.opportunity
            ? normalizeOpportunity(
                result.opportunity,
              )
            : null

        if (!opportunity) {
          throw new Error(
            'Plaza opportunity response was incomplete. Retry the same submission.',
          )
        }

        if (
          result?.published ===
          true
        ) {
          setItems(
            (current) => [
              opportunity,
              ...current.filter(
                (item) =>
                  item.id !==
                  opportunity.id,
              ),
            ],
          )
        }

        setForm(
          INITIAL_FORM,
        )

        createIdRef.current =
          ''

        onToast?.(
          result?.published ===
          true
            ? 'Plaza opportunity published.'
            : 'Plaza opportunity submitted for admin review.',
          'success',
        )
      } catch (
        postError
      ) {
        onToast?.(
          postError?.message ||
            'Could not post Plaza opportunity.',
          'error',
        )
      } finally {
        setPosting(false)
      }
    }

  const openLedger =
    (item) => {
      const amount =
        grossAmount(
          item,
        )

      const rawRate =
        Number(
          item.commissionRate ||
            0.2,
        )

      const displayRate =
        rawRate > 1
          ? rawRate
          : rawRate * 100

      setLedger(item)

      setLedgerForm({
        amount:
          amount
            ? String(amount)
            : '',

        currency:
          clean(
            item.currency,
          )
            .toUpperCase() ||
          'USD',

        commissionRate:
          String(
            displayRate ||
              20,
          ),
      })
    }

  const submitLedger =
    async (event) => {
      event.preventDefault()

      if (
        !ledger ||
        ledgerBusy
      ) {
        return
      }

      const amount =
        Number(
          ledgerForm.amount ||
            0,
        )

      const commissionInput =
        Number(
          ledgerForm.commissionRate ||
            20,
        )

      const commissionRate =
        commissionInput > 1
          ? commissionInput /
            100
          : commissionInput

      if (
        !amount ||
        amount <= 0
      ) {
        onToast?.(
          'Enter a valid Plaza deal amount.',
          'error',
        )

        return
      }

      setLedgerBusy(true)

      try {
        const result =
          await apiFetch(
            `/api/payments/plaza/opportunities/${encodeURIComponent(
              ledger.id,
            )}/ledger`,
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  amount,

                  currency:
                    clean(
                      ledgerForm.currency,
                    )
                      .toUpperCase() ||
                    'USD',

                  commissionRate,

                  provider:
                    'unselected',

                  paymentMethod:
                    'unselected',

                  paymentStatus:
                    'draft',

                  markPaid:
                    false,

                  settleNow:
                    false,
                }),
            },
          )

        if (
          result?.opportunity
        ) {
          const updated =
            normalizeOpportunity(
              {
                ...ledger,
                ...result.opportunity,
                id:
                  ledger.id,
              },
            )

          setItems(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  ledger.id
                    ? updated
                    : item,
              ),
          )
        }

        setLedger(null)

        try {
          localStorage.setItem(
            'yh_wallet_needs_refresh_v1',
            JSON.stringify({
              source:
                'plaza',

              reason:
                'plaza_opportunity_payment',

              updatedAt:
                new Date()
                  .toISOString(),
            }),
          )
        } catch {}

        if (
          typeof window
            .refreshYHWalletSnapshot ===
          'function'
        ) {
          void window
            .refreshYHWalletSnapshot(
              true,
            )
            .catch(
              () => {},
            )
        }

        onToast?.(
          'Plaza payment ledger created. Admin must mark it paid before payout is unlocked.',
          'success',
        )

        await loadOpportunities({
          refresh: true,
        })
      } catch (
        ledgerError
      ) {
        onToast?.(
          ledgerError?.message ||
            'Could not create Plaza payment ledger.',
          'error',
        )
      } finally {
        setLedgerBusy(false)
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-opportunities-react-workspace"
      data-yh-dashboard-react-surface="plazas-opportunities"
    >
      <div className="yh-plaza-opportunities-react-scroll">
        <div className="yh-plaza-opportunities-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Opportunities
              </span>

              <h1>
                Opportunity Quests
              </h1>

              <p>
                Jobs, services,
                collaborations,
                bounties,
                partnerships and
                monetized Plaza
                movement.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadOpportunities({
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
            className="yh-plaza-opportunity-composer"
            onSubmit={
              submitOpportunity
            }
          >
            <div className="yh-plaza-opportunity-form-grid">
              <label>
                <span>
                  Type
                </span>

                <select
                  className="input-field"
                  value={
                    form.type
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'type',
                      event.target
                        .value,
                    )
                  }
                >
                  {OPPORTUNITY_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
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
                  Economy
                </span>

                <select
                  className="input-field"
                  value={
                    form.economyMode
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'economyMode',
                      event.target
                        .value,
                    )
                  }
                >
                  {ECONOMY_OPTIONS.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Currency
                </span>

                <input
                  className="input-field"
                  maxLength={8}
                  value={
                    form.currency
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'currency',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Budget / Price Min
                </span>

                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.budgetMin
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'budgetMin',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Budget / Price Max
                </span>

                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.budgetMax
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'budgetMax',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Commission %
                </span>

                <input
                  className="input-field"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    form.commissionRate
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'commissionRate',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Escalation
                </span>

                <select
                  className="input-field"
                  value={
                    form.federationEscalation
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'federationEscalation',
                      event.target
                        .value,
                    )
                  }
                >
                  {ESCALATION_OPTIONS.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Service Category
                </span>

                <input
                  className="input-field"
                  maxLength={120}
                  value={
                    form.serviceCategory
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceCategory',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Price Type
                </span>

                <select
                  className="input-field"
                  value={
                    form.servicePriceType
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'servicePriceType',
                      event.target
                        .value,
                    )
                  }
                >
                  {PRICE_TYPES.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Delivery Time
                </span>

                <input
                  className="input-field"
                  maxLength={120}
                  value={
                    form.serviceDeliveryTime
                  }
                  placeholder="24 hours, 3 days, 1 week..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceDeliveryTime',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Provider Type
                </span>

                <select
                  className="input-field"
                  value={
                    form.serviceProviderType
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceProviderType',
                      event.target
                        .value,
                    )
                  }
                >
                  {PROVIDER_TYPES.map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="is-wide">
                <span>
                  Service Tags
                </span>

                <input
                  className="input-field"
                  maxLength={240}
                  value={
                    form.serviceTags
                  }
                  placeholder="automation, design, leads..."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceTags',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Service Outcome
                </span>

                <textarea
                  className="input-field"
                  rows="3"
                  maxLength={1000}
                  value={
                    form.serviceOutcome
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceOutcome',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Requirements From Seeker
                </span>

                <textarea
                  className="input-field"
                  rows="3"
                  maxLength={1000}
                  value={
                    form.serviceRequirements
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'serviceRequirements',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Title
                </span>

                <input
                  className="input-field"
                  maxLength={140}
                  required
                  value={
                    form.title
                  }
                  placeholder="Short opportunity title"
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'title',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Details
                </span>

                <textarea
                  className="input-field"
                  rows="4"
                  maxLength={1600}
                  required
                  value={
                    form.text
                  }
                  placeholder="Describe the opportunity, who it is for, and what the next step should be."
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'text',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Monetization Note
                </span>

                <textarea
                  className="input-field"
                  rows="3"
                  maxLength={1000}
                  value={
                    form.monetizationNote
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'monetizationNote',
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-plaza-opportunity-form-actions">
              <small>
                Plaza access and
                publication rules
                remain enforced by
                the existing backend.
              </small>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  posting
                }
              >
                {posting
                  ? 'Posting...'
                  : 'Post Opportunity'}
              </button>
            </div>
          </form>

          <section className="yh-plaza-opportunity-summary">
            <article>
              <small>
                Visible Quests
              </small>
              <strong>
                {summary.all}
              </strong>
            </article>

            <article>
              <small>
                Available
              </small>
              <strong>
                {summary.available}
              </strong>
            </article>

            <article>
              <small>
                Paid Paths
              </small>
              <strong>
                {summary.paid}
              </strong>
            </article>

            <article>
              <small>
                Regional
              </small>
              <strong>
                {summary.regional}
              </strong>
            </article>
          </section>

          <div
            id="plazaQuestFilterBarV1"
            className="yh-plaza-opportunity-filters"
            aria-label="Opportunity Quest filters"
          >
            {QUEST_FILTERS.map(
              ([
                key,
                label,
              ]) => (
                <button
                  type="button"
                  key={key}
                  data-plaza-quest-filter={key}
                  className={
                    filter ===
                    key
                      ? 'is-active'
                      : ''
                  }
                  onClick={() => {
                    setFilter(
                      key,
                    )

                    updatePlazaUiState({
                      questFilter:
                        key,
                    })
                  }}
                >
                  <span>{label}</span>
                  <b data-plaza-quest-filter-count={key}>
                    {filterCounts[key] ?? 0}
                  </b>
                </button>
              ),
            )}
          </div>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              opportunities...
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
                No opportunity
                quests match this
                filter.
              </div>
            )}

          <div className="yh-plaza-opportunity-grid">
            {visibleItems.map(
              (item) => {
                const state =
                  questState(
                    item,
                  )

                const payment =
                  paymentStatus(
                    item,
                  )

                return (
                  <article
                    className="yh-plaza-opportunity-card-react"
                    key={
                      item.id
                    }
                  >
                    <div className="yh-plaza-opportunity-card-top">
                      <span>
                        {questClass(
                          item,
                        )}
                      </span>

                      <span>
                        {state}
                      </span>
                    </div>

                    <div className="yh-plaza-feed-react-author">
                      <div className="yh-plaza-feed-react-avatar">
                        {item.authorAvatar ? (
                          <img
                            src={
                              item.authorAvatar
                            }
                            alt=""
                          />
                        ) : (
                          <span>
                            {item.authorName
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            item.authorName
                          }
                        </strong>

                        <small>
                          {
                            item.region
                          }
                        </small>
                      </div>
                    </div>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.text}
                    </p>

                    <div className="yh-plaza-opportunity-facts">
                      <div>
                        <small>
                          Zone
                        </small>

                        <strong>
                          {
                            item.region
                          }
                        </strong>
                      </div>

                      <div>
                        <small>
                          Difficulty
                        </small>

                        <strong>
                          {questDifficulty(
                            item,
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Reward
                        </small>

                        <strong>
                          {questReward(
                            item,
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Availability
                        </small>

                        <strong>
                          {item.deadline ||
                            'Open availability'}
                        </strong>
                      </div>
                    </div>

                    <div className="yh-plaza-opportunity-requirement">
                      <small>
                        Required Operator Profile
                      </small>

                      <strong>
                        {questRequirement(
                          item,
                        )}
                      </strong>
                    </div>

                    {(item.paymentLedgerId ||
                      grossAmount(
                        item,
                      ) >
                        0) && (
                      <div className="yh-plaza-opportunity-payment">
                        <strong>
                          {payment}
                        </strong>

                        <span>
                          Gross:{' '}
                          {
                            item.currency
                          }{' '}
                          {grossAmount(
                            item,
                          ).toLocaleString()}
                        </span>

                        <span>
                          YH Commission:{' '}
                          {
                            item.currency
                          }{' '}
                          {commissionAmount(
                            item,
                          ).toLocaleString()}
                        </span>

                        <span>
                          Operator Payout:{' '}
                          {
                            item.currency
                          }{' '}
                          {operatorPayout(
                            item,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="yh-plaza-opportunity-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setBriefing(
                            item,
                          )
                        }
                      >
                        View Quest Briefing
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        disabled={
                          payment ===
                          'Paid'
                        }
                        onClick={() =>
                          openLedger(
                            item,
                          )
                        }
                      >
                        {payment ===
                        'Paid'
                          ? 'Paid'
                          : item.paymentLedgerId
                            ? 'Update Internal Ledger'
                            : 'Start Internal Transaction'}
                      </button>
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
                    void loadOpportunities({
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

      {briefing && (
        <div
          className="modal-overlay yh-plaza-quest-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setBriefing(
                null,
              )
            }
          }}
        >
          <div className="modal-content yh-plaza-opportunity-modal">
            <span className="yh-plaza-react-kicker">
              {questClass(
                briefing,
              )}
            </span>

            <h2>
              {briefing.title}
            </h2>

            <p>
              {briefing.text}
            </p>

            <div className="yh-plaza-opportunity-facts">
              <div>
                <small>
                  State
                </small>

                <strong>
                  {questState(
                    briefing,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Difficulty
                </small>

                <strong>
                  {questDifficulty(
                    briefing,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Reward
                </small>

                <strong>
                  {questReward(
                    briefing,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Region
                </small>

                <strong>
                  {
                    briefing.region
                  }
                </strong>
              </div>
            </div>

            <div className="yh-plaza-opportunity-modal-block">
              <small>
                Required Operator Profile
              </small>

              <strong>
                {questRequirement(
                  briefing,
                )}
              </strong>
            </div>

            <div className="yh-plaza-opportunity-modal-block">
              <small>
                Expected Output
              </small>

              <strong>
                {briefing.expectedOutput ||
                  briefing.serviceOutcome ||
                  'Expected output not specified'}
              </strong>
            </div>

            {briefing.monetizationNote && (
              <div className="yh-plaza-opportunity-modal-block">
                <small>
                  Monetization
                </small>

                <strong>
                  {
                    briefing.monetizationNote
                  }
                </strong>
              </div>
            )}

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  openOpportunityRequest(
                    briefing,
                  )
                }
              >
                {opportunityPrimaryLabel(
                  briefing,
                )}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setBriefing(
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

      {ledger && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <form
            className="modal-content yh-plaza-opportunity-modal"
            onSubmit={
              submitLedger
            }
          >
            <span className="yh-plaza-react-kicker">
              Plaza Payment Ledger
            </span>

            <h2>
              Create payment ledger
            </h2>

            <p>
              This creates an
              internal Plaza
              transaction record.
              Admin must verify
              payment before payout
              is unlocked.
            </p>

            <label>
              <span>
                Deal Amount
              </span>

              <input
                className="input-field"
                type="number"
                min="1"
                step="0.01"
                required
                value={
                  ledgerForm.amount
                }
                onChange={(
                  event,
                ) =>
                  setLedgerForm(
                    (current) => ({
                      ...current,
                      amount:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              <span>
                Currency
              </span>

              <select
                className="input-field"
                value={
                  ledgerForm.currency
                }
                onChange={(
                  event,
                ) =>
                  setLedgerForm(
                    (current) => ({
                      ...current,
                      currency:
                        event.target
                          .value,
                    }),
                  )
                }
              >
                {[
                  'USD',
                  'EUR',
                  'NGN',
                  'PHP',
                  'INR',
                ].map(
                  (currency) => (
                    <option
                      key={
                        currency
                      }
                      value={
                        currency
                      }
                    >
                      {currency}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                YH Commission Rate %
              </span>

              <input
                className="input-field"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={
                  ledgerForm.commissionRate
                }
                onChange={(
                  event,
                ) =>
                  setLedgerForm(
                    (current) => ({
                      ...current,
                      commissionRate:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <div className="yh-plaza-opportunity-warning">
              <strong>
                Transaction Safety Reminder:
              </strong>{' '}
              For user flexibility,
              parties may arrange
              transactions outside
              YH Universe. However,
              off-platform
              transactions are not
              verified, protected,
              or settled by YH
              Universe. Any loss,
              fraud, failed
              delivery, illegal
              activity, chargeback,
              or dispute arising
              from an external
              arrangement remains
              the sole
              responsibility of
              the parties involved.
              For safer
              recordkeeping, use
              the internal Plaza
              ledger and admin
              verification flow
              whenever possible.
            </div>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  ledgerBusy
                }
                onClick={() =>
                  setLedger(null)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  ledgerBusy
                }
              >
                {ledgerBusy
                  ? 'Creating Ledger...'
                  : 'Create Payment Ledger'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
