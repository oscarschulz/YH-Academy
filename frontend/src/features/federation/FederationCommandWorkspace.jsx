import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationCommandWorkspace.css'
import FederationCommandStrategicParity from './FederationCommandStrategicParity'

const RANKS = [
  {
    key: 'observer',
    label: 'Observer',
    at: null,
    note: 'Federation access not yet active.',
  },
  {
    key: 'delegate',
    label: 'Delegate',
    at: 0,
    note: 'Approved member starting rank at 0 Influence.',
  },
  {
    key: 'representative',
    label: 'Representative',
    at: 5,
    note: 'Unlocks at 5 verified Influence.',
  },
  {
    key: 'strategist',
    label: 'Strategist',
    at: 20,
    note: 'Unlocks at 20 verified Influence.',
  },
  {
    key: 'council-member',
    label: 'Council Member',
    at: 50,
    note: 'Unlocks at 50 verified Influence; governance authority remains separate.',
  },
  {
    key: 'regional-leader',
    label: 'Regional Leader',
    at: 100,
    note: 'Unlocks at 100 verified Influence.',
  },
  {
    key: 'federation-commander',
    label: 'Federation Commander',
    at: 250,
    note: 'Unlocks at 250 verified Influence.',
  },
]

const PHASES = [
  [
    '01',
    'Intelligence Gathering',
    'Read the request, opportunity, region, and constraints.',
  ],
  [
    '02',
    'Formation',
    'Identify participants and establish the protected route.',
  ],
  [
    '03',
    'Negotiation',
    'Align terms, expectations, price, and strategic fit.',
  ],
  [
    '04',
    'Execution',
    'Move the active operation through the agreed action.',
  ],
  [
    '05',
    'Review',
    'Validate outcome, settlement, and strategic value.',
  ],
  [
    '06',
    'Completed',
    'Preserve the result for the Influence ledger.',
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

function normalizeStatus(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function isOpenStatus(value = '') {
  return ![
    'completed',
    'closed',
    'cancelled',
    'canceled',
    'rejected',
    'expired',
    'failed',
  ].includes(
    normalizeStatus(value),
  )
}

function operationPhase(value = '') {
  const status =
    normalizeStatus(value)

  if (
    [
      'completed',
      'complete',
      'intro_delivered',
      'settled',
      'paid_completed',
    ].includes(status)
  ) {
    return 'Completed'
  }

  if (
    [
      'closed',
      'cancelled',
      'canceled',
      'rejected',
      'expired',
      'failed',
    ].includes(status)
  ) {
    return 'Closed'
  }

  if (
    [
      'review',
      'reviewing',
      'under_review',
      'pending_admin_review',
      'pending_review',
      'screening',
      'shortlisted',
    ].includes(status)
  ) {
    return 'Review'
  }

  if (
    [
      'active',
      'in_progress',
      'execution',
      'live',
      'paid',
      'approved',
      'intro_in_progress',
    ].includes(status)
  ) {
    return 'Execution'
  }

  if (
    [
      'negotiation',
      'negotiating',
      'pricing_sent',
      'payment_pending',
      'awaiting_payment',
      'terms_pending',
    ].includes(status)
  ) {
    return 'Negotiation'
  }

  if (
    [
      'matched',
      'formation',
      'forming',
      'proposed',
      'accepted',
      'pending_admin_match',
    ].includes(status)
  ) {
    return 'Formation'
  }

  return 'Intelligence Gathering'
}

function operationRisk({
  kind = '',
  status = '',
  valueAmount = 0,
}) {
  const normalized =
    normalizeStatus(status)

  const amount =
    Math.max(
      0,
      Number(valueAmount || 0),
    )

  if (
    [
      'failed',
      'rejected',
      'cancelled',
      'canceled',
      'expired',
    ].includes(normalized)
  ) {
    return 'Closed Risk'
  }

  if (
    amount >= 100000 ||
    [
      'payment_pending',
      'awaiting_payment',
      'negotiation',
    ].includes(normalized)
  ) {
    return 'Elevated'
  }

  if (
    kind ===
      'Connection Opportunity' ||
    kind ===
      'Diplomacy Request'
  ) {
    return 'Protected'
  }

  return 'Controlled'
}

function nextAction(phase = '') {
  return {
    'Intelligence Gathering':
      'Review operation brief',

    Formation:
      'Confirm the protected route',

    Negotiation:
      'Advance terms and alignment',

    Execution:
      'Track the active strategic action',

    Review:
      'Review outcome and next decision',

    Completed:
      'Open completed operation record',

    Closed:
      'Review closed operation context',
  }[phase] || 'Review operation'
}

function normalizeMember(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(
        raw.id ||
          raw.userId ||
          raw.email,
      ) ||
      `federation-member-${index}`,

    userId:
      clean(
        raw.userId ||
          raw.id,
      ),

    name:
      clean(
        raw.name ||
          raw.fullName ||
          raw.displayName,
      ) ||
      'Federation Member',

    city:
      clean(raw.city),

    country:
      clean(raw.country),

    category:
      clean(
        raw.category ||
          raw.sector,
      ),
  }
}

function normalizeDealRoom(
  raw = {},
  index = 0,
) {
  const status =
    clean(
      raw.dealStatus ||
        raw.adminStatus ||
        raw.status,
    ) ||
    'proposed'

  const valueAmount =
    Math.max(
      0,
      Number(
        raw.expectedValueAmount ||
          0,
      ),
    )

  return {
    ...raw,
    alertStatus: clean(raw.adminStatus || raw.dealStatus || raw.status),

    id:
      clean(raw.id) ||
      `deal-room-${index + 1}`,

    title:
      clean(raw.title) ||
      'Federation Deal Room',

    description:
      clean(
        raw.description ||
          raw.text ||
          raw.partnerNeed,
      ) ||
      'Review the supervised strategic work route.',

    status,

    region:
      clean(
        raw.region ||
          raw.country,
      ) ||
      'Cross-network',

    currency:
      clean(raw.currency)
        .toUpperCase() ||
      'USD',

    valueAmount,

    createdAt:
      clean(
        raw.createdAt ||
          raw.updatedAt,
      ),
  }
}

function normalizeRequest(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(raw.id) ||
      `federation-request-${index + 1}`,

    status:
      clean(
        raw.status ||
          raw.reviewStatus,
      ) ||
      'pending_admin_match',

    title:
      clean(
        raw.title ||
          raw.requestTitle ||
          raw.targetTitle ||
          raw.providerName,
      ) ||
      'Federation connection request',

    objective:
      clean(
        raw.message ||
          raw.requestIntent ||
          raw.notes,
      ) ||
      'Track the controlled introduction and admin review route.',

    city:
      clean(raw.city),

    country:
      clean(raw.country),

    budgetRange:
      clean(
        raw.budgetRange,
      ),

    createdAt:
      clean(
        raw.createdAt ||
          raw.updatedAt,
      ),
  }
}

function normalizeOpportunity(
  raw = {},
  index = 0,
) {
  const status =
    clean(
      raw.saleStatus ||
        raw.pipelineStage ||
        raw.status,
    ) ||
    'available'

  const valueAmount =
    Math.max(
      0,
      Number(
        raw.buyerPriceAmount ||
          raw.sellerPriceAmount ||
          0,
      ),
    )

  return {
    ...raw,

    id:
      clean(raw.id) ||
      `connection-opportunity-${index + 1}`,

    title:
      clean(raw.title) ||
      'Strategic connection opportunity',

    summary:
      clean(
        raw.summary ||
          raw.description,
      ) ||
      'Review the protected connection route.',

    status,

    city:
      clean(raw.city),

    country:
      clean(raw.country),

    currency:
      clean(raw.currency)
        .toUpperCase() ||
      'USD',

    valueAmount,

    createdAt:
      clean(
        raw.createdAt ||
          raw.updatedAt,
      ),
  }
}

function influenceCategory(
  eventType = '',
) {
  const value =
    clean(eventType)
      .toLowerCase()

  if (
    /paid|payment|economic|deal|settlement/.test(
      value,
    )
  ) {
    return 'economic'
  }

  if (
    /connect|intro|diplom|handoff/.test(
      value,
    )
  ) {
    return 'diplomatic'
  }

  if (
    /leader|command|mentor/.test(
      value,
    )
  ) {
    return 'leadership'
  }

  if (
    /intelligence|review|risk|research/.test(
      value,
    )
  ) {
    return 'intelligence'
  }

  if (
    /governance|council|proposal|vote/.test(
      value,
    )
  ) {
    return 'governance'
  }

  if (
    /alliance|region|territory/.test(
      value,
    )
  ) {
    return 'alliance'
  }

  return 'intelligence'
}

function resolveRank(
  approved,
  totalInfluence,
) {
  if (!approved) {
    return RANKS[0]
  }

  const total =
    Math.max(
      0,
      Number(
        totalInfluence || 0,
      ),
    )

  if (total >= 250) {
    return RANKS[6]
  }

  if (total >= 100) {
    return RANKS[5]
  }

  if (total >= 50) {
    return RANKS[4]
  }

  if (total >= 20) {
    return RANKS[3]
  }

  if (total >= 5) {
    return RANKS[2]
  }

  return RANKS[1]
}

function buildOperations({
  dealRooms,
  requests,
  opportunities,
}) {
  const dealOperations =
    dealRooms.map(
      (room) => {
        const phase =
          operationPhase(
            room.status,
          )

        return {
          id: room.id,
          kind: 'Deal Room',
          lane: 'deal-rooms',
          title: room.title,
          objective:
            room.description,
          status:
            room.status,
          phase,

          risk:
            operationRisk({
              kind:
                'Deal Room',

              status:
                room.status,

              valueAmount:
                room.valueAmount,
            }),

          region:
            room.region,

          economicContext:
            room.valueAmount >
            0
              ? `${room.currency} ${room.valueAmount.toLocaleString()}`
              : 'Economic value not specified',

          target:
            'federation-deal-rooms',

          createdAt:
            room.createdAt,
        }
      },
    )

  const diplomacyRequests =
    requests.map(
      (request) => {
        const phase =
          operationPhase(
            request.status,
          )

        return {
          id: request.id,
          kind:
            'Diplomacy Request',
          lane:
            'diplomacy',

          title:
            request.title,

          objective:
            request.objective,

          status:
            request.status,

          phase,

          risk:
            operationRisk({
              kind:
                'Diplomacy Request',

              status:
                request.status,
            }),

          region:
            [
              request.city,
              request.country,
            ]
              .filter(Boolean)
              .join(', ') ||
            'Protected network',

          economicContext:
            request.budgetRange ||
            'Budget context protected',

          target:
            'federation-requests',

          createdAt:
            request.createdAt,
        }
      },
    )

  const opportunityOperations =
    opportunities.map(
      (opportunity) => {
        const phase =
          operationPhase(
            opportunity.status,
          )

        return {
          id:
            opportunity.id,

          kind:
            'Connection Opportunity',

          lane:
            'diplomacy',

          title:
            opportunity.title,

          objective:
            opportunity.summary,

          status:
            opportunity.status,

          phase,

          risk:
            operationRisk({
              kind:
                'Connection Opportunity',

              status:
                opportunity.status,

              valueAmount:
                opportunity.valueAmount,
            }),

          region:
            [
              opportunity.city,
              opportunity.country,
            ]
              .filter(Boolean)
              .join(', ') ||
            'Protected region',

          economicContext:
            opportunity.valueAmount >
            0
              ? `${opportunity.currency} ${opportunity.valueAmount.toLocaleString()}`
              : 'Protected connection route',

          target:
            'federation-connect',

          createdAt:
            opportunity.createdAt,
        }
      },
    )

  const phaseOrder = {
    Execution: 0,
    Negotiation: 1,
    Formation: 2,
    Review: 3,
    'Intelligence Gathering': 4,
    Completed: 5,
    Closed: 6,
  }

  return [
    ...dealOperations,
    ...diplomacyRequests,
    ...opportunityOperations,
  ].sort(
    (a, b) => {
      const phaseDiff =
        (phaseOrder[
          a.phase
        ] ?? 9) -
        (phaseOrder[
          b.phase
        ] ?? 9)

      if (phaseDiff) {
        return phaseDiff
      }

      return clean(
        b.createdAt,
      ).localeCompare(
        clean(
          a.createdAt,
        ),
      )
    },
  )
}

function getFederationRegionalLabelV3(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const normalized = normalizeStatus(text);
  if ([
    "cross_network",
    "protected_network",
    "protected_region",
    "network_wide",
    "not_established"
  ].includes(normalized)) {
    return "";
  }

  const parts = text
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.length ? parts[parts.length - 1] : text;
}

function isFederationStrategicHandoffStatusV3(value = "") {
  return [
    "matched",
    "approved",
    "accepted",
    "intro_in_progress",
    "introduction_in_progress",
    "intro_delivered",
    "completed"
  ].includes(normalizeStatus(value));
}

function getFederationCouncilGovernanceSnapshotV3(signals = {}, operations = [], state = {}) {
  const activeProposals = operations.filter((operation) => {
    return (
      operation.kind === "Deal Room" &&
      ["Intelligence Gathering", "Formation", "Review"].includes(operation.phase)
    );
  });

  const strategicSessions = operations.filter((operation) => {
    return ["Negotiation", "Execution"].includes(operation.phase);
  });

  const reviewSignals = operations.filter((operation) => operation.phase === "Review");
  const regionalConcernLabels = new Set();

  operations.forEach((operation) => {
    if (
      operation.phase !== "Review" &&
      !["Elevated", "Closed Risk"].includes(operation.risk)
    ) {
      return;
    }

    const label = getFederationRegionalLabelV3(operation.region);
    if (label) regionalConcernLabels.add(label);
  });

  const referrals = signals.referrals && typeof signals.referrals === "object"
    ? signals.referrals
    : {};

  const regionalConcerns = Math.max(
    regionalConcernLabels.size,
    Number(signals.strategicAlerts || 0)
  );

  return {
    councilStatus: "Wiring pending",
    governanceAuthority: "Wiring pending",
    activeProposals: activeProposals.length,
    strategicSessions: strategicSessions.length,
    regionalConcerns,
    reviewSignals: reviewSignals.length,
    referralSignals: Number(referrals.total || 0),
    concernItems: operations
      .filter((operation) => {
        return operation.phase === "Review" || ["Elevated", "Closed Risk"].includes(operation.risk);
      })
      .slice(0, 5)
  };
}

function getFederationDiplomacySnapshotV3(signals = {}, operations = []) {
  const diplomacyOperations = operations.filter((operation) => operation.lane === "diplomacy");
  const activeIntroductions = diplomacyOperations.filter((operation) => {
    return (
      operation.kind === "Diplomacy Request" &&
      isFederationStrategicHandoffStatusV3(operation.status) &&
      !["Completed", "Closed"].includes(operation.phase)
    );
  });

  const requests = Array.isArray(signals.requests) ? signals.requests : [];
  const pendingDiplomaticRequests = requests.filter((request) => {
    const rawStatus = request.status || request.reviewStatus || "pending_admin_match";
    const phase = operationPhase(rawStatus);
    return (
      !["Completed", "Closed"].includes(phase) &&
      !isFederationStrategicHandoffStatusV3(rawStatus)
    );
  });

  const strategicHandoffs = requests.filter((request) => {
    return isFederationStrategicHandoffStatusV3(
      request.status || request.reviewStatus || request.matchStatus
    );
  });

  const regionalLabels = new Set();
  diplomacyOperations.forEach((operation) => {
    const label = getFederationRegionalLabelV3(operation.region);
    if (label) regionalLabels.add(label);
  });

  return {
    totalSignals: diplomacyOperations.length,
    activeIntroductions: activeIntroductions.length,
    pendingDiplomaticRequests: pendingDiplomaticRequests.length,
    regionalRelationships: regionalLabels.size,
    allianceSignals: Number(signals.countries?.length || 0),
    strategicHandoffs: strategicHandoffs.length,
    items: diplomacyOperations.slice(0, 8)
  };
}

function getFederationRegionalStrategySnapshotV3(signals = {}, operations = [], homeRegion = "Not established") {
  const regionMap = new Map();

  function ensureRegion(label = "") {
    const cleanLabel = getFederationRegionalLabelV3(label);
    if (!cleanLabel) return null;

    if (!regionMap.has(cleanLabel)) {
      regionMap.set(cleanLabel, {
        label: cleanLabel,
        members: 0,
        operations: 0,
        diplomacy: 0,
        concerns: 0,
        isHome: false
      });
    }

    return regionMap.get(cleanLabel);
  }

  (Array.isArray(signals.members) ? signals.members : []).forEach((member) => {
    const entry = ensureRegion(member.country || member.city);
    if (entry) entry.members += 1;
  });

  operations.forEach((operation) => {
    const entry = ensureRegion(operation.region);
    if (!entry) return;

    entry.operations += 1;
    if (operation.lane === "diplomacy") entry.diplomacy += 1;
    if (operation.phase === "Review" || ["Elevated", "Closed Risk"].includes(operation.risk)) {
      entry.concerns += 1;
    }
  });

  const homeLabel = getFederationRegionalLabelV3(homeRegion);
  if (homeLabel) {
    const homeEntry = ensureRegion(homeLabel);
    if (homeEntry) homeEntry.isHome = true;
  }

  const regions = Array.from(regionMap.values())
    .map((region) => ({
      ...region,
      sourceSignals: region.members + region.operations
    }))
    .sort((a, b) => {
      if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
      return b.sourceSignals - a.sourceSignals || a.label.localeCompare(b.label);
    })
    .slice(0, 8);

  let status = "No regional signal";
  if (regions.length >= 4) status = "Multi-region network visible";
  else if (regions.length >= 2) status = "Regional network forming";
  else if (regions.length === 1) status = "Single-region signal";

  const relationshipBase = regions.find((region) => region.isHome) || regions[0] || null;
  const relationships = relationshipBase
    ? regions
        .filter((region) => region.label !== relationshipBase.label)
        .slice(0, 4)
        .map((region) => ({
          from: relationshipBase.label,
          to: region.label,
          signals: relationshipBase.sourceSignals + region.sourceSignals
        }))
    : [];

  return {
    status,
    activeRegions: regions.length,
    homeRegion: homeLabel || "Not established",
    regions,
    relationships
  };
}

export default function FederationCommandWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
  onWorkspaceOpen,
  requestCommandData,
}) {
  const [
    state,
    setState,
  ] = useState({
    currentUser: null,
    approved: false,
    applicationStatus: '',
    member: null,
    members: [],
    command: null,
    referrals: null,
    dealRooms: [],
    influence: null,
    opportunities: [],
    requests: [],
  })

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    operationFilter,
    setOperationFilter,
  ] = useState('all')

  const commandLoadRef = useRef(0)

  const loadCommand =
    useCallback(
      async (
        refresh = false,
      ) => {
        const loadVersion = ++commandLoadRef.current
        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const { me, settled } = await requestCommandData()
          if (loadVersion !== commandLoadRef.current) return

          const approved =
            me?.canEnterFederation ===
              true ||
            clean(
              me?.applicationStatus,
            ).toLowerCase() ===
              'approved'

          const member =
            me?.member &&
            typeof me.member ===
              'object'
              ? normalizeMember(
                  me.member,
                )
              : null

          if (!approved) {
            setState({
              currentUser:
                me?.currentUser ||
                null,

              approved:
                false,

              applicationStatus:
                clean(
                  me?.applicationStatus,
                ),

              member,

              members: [],
              command: null,
              referrals:
                me?.referrals ||
                null,

              dealRooms: [],
              influence: null,
              opportunities: [],
              requests: [],
            })

            return
          }

          /* Shared Federation results supplied above. */

          const valueAt =
            (index) =>
              settled[index]
                ?.status ===
              'fulfilled'
                ? settled[index]
                    .value ||
                  {}
                : {}

          const directory =
            valueAt(0)

          const command =
            valueAt(1)

          const referrals =
            valueAt(2)

          const rooms =
            valueAt(3)

          const influence =
            valueAt(4)

          const opportunities =
            valueAt(5)

          const requests =
            valueAt(6)

          setState({
            currentUser:
              me?.currentUser ||
              null,

            approved:
              true,

            applicationStatus:
              clean(
                me?.applicationStatus,
              ) ||
              'approved',

            member,

            members:
              safeArray(
                directory?.members,
              ).map(
                normalizeMember,
              ),

            command:
              command?.command &&
              typeof command.command ===
                'object'
                ? command.command
                : null,

            referrals:
              referrals?.referrals &&
              typeof referrals.referrals ===
                'object'
                ? referrals.referrals
                : me?.referrals ||
                  null,

            dealRooms:
              safeArray(
                rooms?.rooms,
              ).map(
                normalizeDealRoom,
              ),

            influence:
              influence &&
              typeof influence ===
                'object'
                ? influence
                : null,

            opportunities:
              safeArray(
                opportunities?.opportunities,
              ).map(
                normalizeOpportunity,
              ),

            requests:
              safeArray(
                requests?.requests,
              ).map(
                normalizeRequest,
              ),
          })
        } catch (
          loadError
        ) {
          if (loadVersion !== commandLoadRef.current) return
          const message =
            loadError?.message ||
            'Could not load Federation Command.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          if (loadVersion === commandLoadRef.current) {
            setLoading(false)
            setRefreshing(false)
          }
        }
      },
      [onToast, requestCommandData],
    )

  useEffect(() => {
    void loadCommand(refreshVersion > 0)
  }, [loadCommand, refreshVersion])

  const influenceProfile =
    state.influence
      ?.profile &&
    typeof state.influence
      .profile ===
      'object'
      ? state.influence.profile
      : {}

  const influenceEvents =
    safeArray(
      state.influence
        ?.events,
    )

  const totalInfluence =
    Math.max(
      0,
      Number(
        influenceProfile
          ?.totalInfluence ||
          0,
      ),
    )

  const weeklyInfluence =
    Math.max(
      0,
      Number(
        influenceProfile
          ?.weeklyInfluence ||
          0,
      ),
    )

  const influenceEventCount =
    Math.max(
      0,
      Number(
        influenceProfile
          ?.eventCount ??
          influenceEvents.length,
      ),
    )

  const rank =
    resolveRank(
      state.approved,
      totalInfluence,
    )

  const homeRegion =
    [
      state.member?.city,
      state.member?.country,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Not established'

  const operations =
    useMemo(
      () =>
        buildOperations({
          dealRooms:
            state.dealRooms,

          requests:
            state.requests,

          opportunities:
            state.opportunities,
        }),
      [
        state.dealRooms,
        state.requests,
        state.opportunities,
      ],
    )

  const activeOperations =
    operations.filter(
      (item) =>
        ![
          'Completed',
          'Closed',
        ].includes(
          item.phase,
        ),
    )

  const primaryOperation =
    activeOperations[0] ||
    operations[0] ||
    null

  const strategicAlerts =
    state.requests.filter(
      (request) =>
        [
          'pending',
          'under_review',
          'reviewing',
          'matched',
          'payment_pending',
          'awaiting_payment',
        ].includes(
          normalizeStatus(
            request.status,
          ),
        ),
    ).length +
    state.dealRooms.filter(
      (room) =>
        [
          'pending_admin_review',
          'pending',
          'proposed',
          'reviewing',
        ].includes(
          normalizeStatus(
            room.alertStatus,
          ),
        ),
    ).length

  const countries =
    useMemo(
      () =>
        Array.from(
          new Set(
            state.members
              .map(
                (member) =>
                  clean(
                    member.country,
                  ),
              )
              .filter(Boolean),
          ),
        ),
      [state.members],
    )

  const strategicSignals = { ...state, countries, strategicAlerts };
  const council = getFederationCouncilGovernanceSnapshotV3(strategicSignals, operations, {});
  const diplomacy = getFederationDiplomacySnapshotV3(strategicSignals, operations);
  const regional = getFederationRegionalStrategySnapshotV3(strategicSignals, operations, homeRegion);
  const strategicModel = {
    council, diplomacy,
    totalInfluence, weeklyInfluence, influenceEventCount,
    influenceEvents: influenceEvents.slice(0, 6),
    activeOperations: activeOperations.length,
    activeProposals: council.activeProposals,
    strategicSessions: council.strategicSessions,
    reviewSignals: council.reviewSignals,
    referrals: council.referralSignals,
    diplomacySignals: diplomacy.totalSignals,
    pendingDiplomaticRequests: diplomacy.pendingDiplomaticRequests,
    strategicHandoffs: diplomacy.strategicHandoffs,
    regionalRelationships: diplomacy.regionalRelationships,
    allianceSignals: diplomacy.allianceSignals,
    diplomacyItems: diplomacy.items,
  };

  const filteredOperations =
    operations.filter(
      (item) => {
        if (
          operationFilter ===
          'active'
        ) {
          return ![
            'Completed',
            'Closed',
          ].includes(
            item.phase,
          )
        }

        if (
          operationFilter ===
          'deal-rooms'
        ) {
          return (
            item.lane ===
            'deal-rooms'
          )
        }

        if (
          operationFilter ===
          'diplomacy'
        ) {
          return (
            item.lane ===
            'diplomacy'
          )
        }

        if (
          operationFilter ===
          'review'
        ) {
          return (
            item.phase ===
            'Review'
          )
        }

        return true
      },
    )

  const influencePoints =
    useMemo(() => {
      const totals = {}

      influenceEvents.forEach(
        (event) => {
          const category =
            influenceCategory(
              event?.eventType,
            )

          totals[
            category
          ] =
            (totals[
              category
            ] || 0) +
            Number(
              event?.influencePoints ||
                0,
            )
        },
      )

      return totals
    }, [influenceEvents])

  const influenceFramework = [
    {
      key:
        'diplomatic',
      label:
        'Diplomatic Influence',
      signal:
        state.requests
          .length +
        state.opportunities
          .length,
      note:
        'Verified introductions, connections, and handoffs',
    },
    {
      key:
        'economic',
      label:
        'Economic Influence',
      signal:
        state.dealRooms.filter(
          (room) =>
            room.valueAmount >
            0,
        ).length,
      note:
        'Verified paid connections, settlements, and Deal Room outcomes',
    },
    {
      key:
        'leadership',
      label:
        'Leadership',
      signal:
        state.approved
          ? 1
          : 0,
      note:
        'Verified command, mentoring, and leadership outcomes',
    },
    {
      key:
        'intelligence',
      label:
        'Strategic Intelligence',
      signal:
        strategicAlerts,
      note:
        'Verified strategic review, research, and risk outcomes',
    },
    {
      key:
        'governance',
      label:
        'Governance Contribution',
      signal:
        Number(
          state.referrals
            ?.total ||
            0,
        ),
      note:
        'Verified council and governance contribution events',
    },
    {
      key:
        'alliance',
      label:
        'Alliance Strength',
      signal:
        countries.length,
      note:
        'Verified alliance and regional coordination events',
    },
  ]

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-command-react-workspace">
        <div className="yh-federation-command-state">
          Loading Federation
          Command...
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-command-react-workspace">
        <div className="yh-federation-command-state is-error">
          <strong>
            Federation Command
            could not load.
          </strong>

          <span>
            {error}
          </span>

          <button
            type="button"
            className="yh-fed-action yh-fed-action-secondary"
            onClick={() =>
              void loadCommand(
                true,
              )
            }
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (!state.approved) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-command-react-workspace">
        <div className="yh-federation-command-state">
          <span className="yh-federation-command-kicker">
            Federation Command
          </span>

          <h1>
            Federation approval
            required
          </h1>

          <p>
            Strategic Command
            unlocks after your
            Federation
            application is
            approved.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-command-react-workspace"
      data-yh-dashboard-react-surface="federation-command"
    >
      <div className="yh-federation-command-scroll">
        <div className="yh-federation-command-shell">
          <header className="yh-federation-command-hero">
            <div className="yh-federation-command-hero-copy">
              <span className="yh-federation-command-kicker">
                Federation Command
              </span>

              <h1>
                Your strategic
                operating desk
              </h1>

              <p>
                Review your
                verified member
                position, active
                network signals,
                current requests,
                regional reach,
                and the next
                serious action
                available inside
                the Federation.
              </p>

              <div className="yh-federation-command-actions">
                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-primary"
                  onClick={() =>
                    onWorkspaceOpen?.(
                      'federation-deal-rooms',
                    )
                  }
                >
                  Open Deal Rooms
                </button>

                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-secondary"
                  onClick={() =>
                    onWorkspaceOpen?.(
                      'federation-connect',
                    )
                  }
                >
                  Request Connection
                </button>

                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-secondary"
                  disabled={
                    refreshing
                  }
                  onClick={() =>
                    void loadCommand(
                      true,
                    )
                  }
                >
                  {refreshing
                    ? 'Refreshing...'
                    : 'Refresh'}
                </button>
              </div>
            </div>

            <aside className="yh-federation-strategic-profile">
              <div className="yh-federation-strategic-profile-head">
                <div>
                  <small>
                    Strategic
                    Profile
                  </small>

                  <strong>
                    {
                      rank.label
                    }
                  </strong>
                </div>

                <span>
                  {state.influence
                    ? 'Live Status'
                    : 'Syncing'}
                </span>
              </div>

              <div className="yh-federation-strategic-profile-grid">
                <span>
                  <small>
                    Home Region
                  </small>

                  <b>
                    {homeRegion}
                  </b>
                </span>

                <span>
                  <small>
                    Active
                    Operations
                  </small>

                  <b>
                    {
                      activeOperations.length
                    }
                  </b>
                </span>

                <span>
                  <small>
                    Strategic
                    Alerts
                  </small>

                  <b>
                    {
                      strategicAlerts
                    }
                  </b>
                </span>

                <span>
                  <small>
                    Total
                    Influence
                  </small>

                  <b>
                    {totalInfluence.toLocaleString()}
                  </b>
                </span>
              </div>
            </aside>
          </header>

          <section className="yh-federation-command-metrics">
            <article>
              <small>
                Approved Members
              </small>

              <strong>
                {state.members.length.toLocaleString()}
              </strong>

              <span>
                Verified Federation
                visibility
              </span>
            </article>

            <article>
              <small>
                Active Operations
              </small>

              <strong>
                {activeOperations.length.toLocaleString()}
              </strong>

              <span>
                Current Deal Room
                or Connect movement
              </span>
            </article>

            <article>
              <small>
                Strategic Alerts
              </small>

              <strong>
                {strategicAlerts.toLocaleString()}
              </strong>

              <span>
                Items needing
                review or attention
              </span>
            </article>

            <article>
              <small>
                Countries Active
              </small>

              <strong>
                {countries.length.toLocaleString()}
              </strong>

              <span>
                {homeRegion ===
                'Not established'
                  ? 'No home region established'
                  : `Home: ${homeRegion}`}
              </span>
            </article>
          </section>

          <div className="yh-federation-command-two-col">
            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Active
                    Operation
                  </span>

                  <h2>
                    Current
                    strategic next
                    move
                  </h2>
                </div>

                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-secondary"
                  onClick={() =>
                    onWorkspaceOpen?.(
                      'federation-deal-rooms',
                    )
                  }
                >
                  Open Deal Rooms
                </button>
              </div>

              {primaryOperation ? (
                <article className="yh-federation-primary-operation">
                  <span>
                    {
                      primaryOperation.kind
                    }
                  </span>

                  <h3>
                    {
                      primaryOperation.title
                    }
                  </h3>

                  <p>
                    {
                      primaryOperation.objective
                    }
                  </p>

                  <div>
                    <small>
                      {
                        primaryOperation.region
                      }
                    </small>

                    <small>
                      {
                        primaryOperation.phase
                      }
                    </small>

                    <small>
                      {
                        primaryOperation.economicContext
                      }
                    </small>
                  </div>

                  <button
                    type="button"
                    className="yh-fed-action yh-fed-action-primary"
                    onClick={() =>
                      onWorkspaceOpen?.(
                        primaryOperation.target,
                      )
                    }
                  >
                    Review Strategic Route
                  </button>
                </article>
              ) : (
                <div className="yh-federation-command-empty">
                  <strong>
                    No active
                    operation yet.
                  </strong>

                  <span>
                    Start from Deal
                    Rooms or request
                    a controlled
                    introduction.
                  </span>
                </div>
              )}
            </section>

            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Strategic
                    Network
                  </span>

                  <h2>
                    Regional
                    command signals
                  </h2>
                </div>

                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-secondary"
                  onClick={() =>
                    onWorkspaceOpen?.(
                      'federation-directory',
                    )
                  }
                >
                  Open Directory
                </button>
              </div>

              <p>{regional.status}</p>
              <div className="yh-federation-region-grid">
                {regional.regions.map(region => (
                  <button type="button" key={region.label}
                    className={region.isHome ? 'is-home' : ''}
                    onClick={() => onWorkspaceOpen?.('federation-directory')}>
                    <small>{region.isHome ? 'Home Region' : 'Active Network'}</small>
                    <strong>{region.label}</strong>
                    <span>{region.members} members • {region.operations} operations • {region.diplomacy} diplomacy • {region.concerns} concerns</span>
                  </button>
                ))}
                {!regional.regions.length && (
                  <div className="yh-federation-command-empty">No regional signal</div>
                )}
                {regional.relationships.map(link => (
                  <div key={link.from + ':' + link.to}>
                    <strong>{link.from} → {link.to}</strong>
                    <span> · {link.signals} source signals</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="yh-federation-command-card">
            <div className="yh-federation-command-card-head">
              <div>
                <span>
                  Strategic
                  Operations Board
                </span>

                <h2>
                  Current
                  Federation
                  operation states
                </h2>
              </div>

              <span className="yh-federation-status-chip">
                Status Derived
              </span>
            </div>

            <div className="yh-federation-operation-summary">
              <article>
                <small>
                  Total Signals
                </small>

                <strong>
                  {
                    operations.length
                  }
                </strong>
              </article>

              <article>
                <small>
                  Active
                </small>

                <strong>
                  {
                    activeOperations.length
                  }
                </strong>
              </article>

              <article>
                <small>
                  Execution
                </small>

                <strong>
                  {
                    operations.filter(
                      (item) =>
                        item.phase ===
                        'Execution',
                    ).length
                  }
                </strong>
              </article>

              <article>
                <small>
                  In Review
                </small>

                <strong>
                  {
                    operations.filter(
                      (item) =>
                        item.phase ===
                        'Review',
                    ).length
                  }
                </strong>
              </article>
            </div>

            <div className="yh-federation-operation-filters">
              {[
                ['all', 'All'],
                [
                  'active',
                  'Active',
                ],
                [
                  'deal-rooms',
                  'Deal Rooms',
                ],
                [
                  'diplomacy',
                  'Diplomacy',
                ],
                [
                  'review',
                  'Review',
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <button
                    type="button"
                    key={key}
                    className={
                      operationFilter ===
                      key
                        ? 'is-active'
                        : ''
                    }
                    onClick={() =>
                      setOperationFilter(
                        key,
                      )
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <div className="yh-federation-operation-grid">
              {filteredOperations.length ? (
                filteredOperations
                  .slice(0, 12)
                  .map(
                    (operation) => (
                      <article
                        key={`${operation.kind}-${operation.id}`}
                      >
                        <div className="yh-federation-operation-head">
                          <div>
                            <span>
                              {
                                operation.kind
                              }
                            </span>

                            <h3>
                              {
                                operation.title
                              }
                            </h3>
                          </div>

                          <b>
                            {
                              operation.phase
                            }
                          </b>
                        </div>

                        <p>
                          {
                            operation.objective
                          }
                        </p>

                        <div className="yh-federation-operation-meta">
                          <span>
                            <small>
                              Region
                            </small>

                            <strong>
                              {
                                operation.region
                              }
                            </strong>
                          </span>

                          <span>
                            <small>
                              Risk
                            </small>

                            <strong>
                              {
                                operation.risk
                              }
                            </strong>
                          </span>

                          <span>
                            <small>
                              Economics
                            </small>

                            <strong>
                              {
                                operation.economicContext
                              }
                            </strong>
                          </span>
                        </div>

                        <div className="yh-federation-operation-action">
                          <small>
                            {nextAction(
                              operation.phase,
                            )}
                          </small>

                          <button
                            type="button"
                            className="yh-fed-action yh-fed-action-secondary"
                            onClick={() =>
                              onWorkspaceOpen?.(
                                operation.target,
                              )
                            }
                          >
                            Open Route
                          </button>
                        </div>
                      </article>
                    ),
                  )
              ) : (
                <div className="yh-federation-command-empty">
                  <strong>
                    No operations
                    match this
                    filter.
                  </strong>

                  <span>
                    Select another
                    view or open the
                    existing Deal
                    Room and Connect
                    screens.
                  </span>
                </div>
              )}
            </div>

            <p className="yh-federation-command-disclaimer">
              Operation phases,
              risk labels, and lane
              classifications are
              derived from current
              Deal Room, Connect,
              and request statuses.
              No new operation
              record or influence
              reward is created
              here.
            </p>
          </section>

          <div className="yh-federation-command-two-col">
            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Influence
                    Framework
                  </span>

                  <h2>
                    Strategic
                    capability
                    categories
                  </h2>
                </div>

                <span className="yh-federation-status-chip">
                  {state.influence
                    ? 'Live Status'
                    : 'Syncing Ledger'}
                </span>
              </div>

              <div className="yh-federation-influence-grid">
                {influenceFramework.map(
                  (item) => (
                    <article
                      key={
                        item.key
                      }
                    >
                      <div>
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <small>
                          {
                            item.note
                          }
                        </small>
                      </div>

                      <span>
                        <b>
                          {Number(
                            influencePoints[
                              item.key
                            ] ||
                              0,
                          ).toLocaleString()}
                        </b>

                        <small>
                          Influence
                          pts
                        </small>
                      </span>

                      <em>
                        {Number(
                          item.signal ||
                            0,
                        ).toLocaleString()}{' '}
                        source signals
                      </em>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Operation
                    Lifecycle
                  </span>

                  <h2>
                    Strategic phases
                  </h2>
                </div>
              </div>

              <div className="yh-federation-phase-list">
                {PHASES.map(
                  ([
                    number,
                    label,
                    note,
                  ]) => (
                    <article
                      key={
                        label
                      }
                    >
                      <b>
                        {number}
                      </b>

                      <div>
                        <strong>
                          {label}
                        </strong>

                        <small>
                          {note}
                        </small>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          </div>

          <section className="yh-federation-command-lanes">
            <button
              type="button"
              onClick={() =>
                onWorkspaceOpen?.(
                  'federation-deal-rooms',
                )
              }
            >
              <span>
                Operations Lane
              </span>

              <strong>
                Deal Rooms
              </strong>

              <small>
                Review
                partnerships,
                collaborations,
                and supervised
                strategic work.
              </small>
            </button>

            <button
              type="button"
              onClick={() =>
                onWorkspaceOpen?.(
                  'federation-connect',
                )
              }
            >
              <span>
                Diplomacy Lane
              </span>

              <strong>
                Strategic Connect
              </strong>

              <small>
                Request controlled
                introductions and
                protected network
                access.
              </small>
            </button>

            <button
              type="button"
              onClick={() =>
                onWorkspaceOpen?.(
                  'federation-requests',
                )
              }
            >
              <span>
                Intelligence Lane
              </span>

              <strong>
                Request Pipeline
              </strong>

              <small>
                Track pending,
                reviewed, matched,
                and completed
                network moves.
              </small>
            </button>

            <button
              type="button"
              onClick={() =>
                onWorkspaceOpen?.(
                  'federation-referrals',
                )
              }
            >
              <span>
                Council Lane
              </span>

              <strong>
                Trusted Referrals
              </strong>

              <small>
                Route qualified
                people into the
                Federation review
                pipeline.
              </small>
            </button>
          </section>

          <div className="yh-federation-command-two-col">
            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Federation Rank
                    Path
                  </span>

                  <h2>
                    Leadership
                    progression
                  </h2>
                </div>

                <span className="yh-federation-status-chip">
                  {
                    rank.label
                  }
                </span>
              </div>

              <div className="yh-federation-rank-path">
                {RANKS.map(
                  (
                    item,
                    index,
                  ) => (
                    <article
                      key={
                        item.key
                      }
                      className={
                        item.key ===
                        rank.key
                          ? 'is-current'
                          : ''
                      }
                    >
                      <b>
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          '0',
                        )}
                      </b>

                      <div>
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <small>
                          {
                            item.note
                          }
                        </small>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section className="yh-federation-command-card">
              <div className="yh-federation-command-card-head">
                <div>
                  <span>
                    Command Status
                  </span>

                  <h2>
                    Current
                    strategic
                    readiness
                  </h2>
                </div>
              </div>

              <div className="yh-federation-readiness-grid">
                <article>
                  <span>
                    Influence
                  </span>

                  <strong>
                    {totalInfluence.toLocaleString()}{' '}
                    total
                  </strong>

                  <small>
                    {weeklyInfluence.toLocaleString()}{' '}
                    this week •{' '}
                    {influenceEventCount.toLocaleString()}{' '}
                    verified events
                  </small>
                </article>

                <article>
                  <span>
                    Council Standing
                  </span>

                  <strong>
                    Not active yet
                  </strong>

                  <small>
                    No council role
                    or authority
                    assigned
                  </small>
                </article>

                <article>
                  <span>
                    Alliance Status
                  </span>

                  <strong>
                    {countries.length
                      ? 'Network visible'
                      : 'Not established'}
                  </strong>

                  <small>
                    {
                      countries.length
                    }{' '}
                    active country
                    signals
                  </small>
                </article>

                <article>
                  <span>
                    Command Access
                  </span>

                  <strong>
                    Active
                  </strong>

                  <small>
                    Approved
                    Federation
                    member
                  </small>
                </article>
              </div>
            </section>
          </div>

          <section className="yh-federation-command-card">
            <div className="yh-federation-command-card-head">
              <div>
                <span>
                  Council Chamber
                </span>

                <h2>
                  Governance,
                  diplomacy and
                  regional strategy
                </h2>
              </div>

              <span className="yh-federation-status-chip">
                Authority Unwired
              </span>
            </div>

            <div className="yh-federation-framework-grid">
              <article>
                <small>
                  Governance
                  Authority
                </small>

                <strong>
                  Not active
                </strong>

                <p>
                  No proposal vote,
                  council approval
                  or governance
                  permission is
                  created from
                  Command.
                </p>
              </article>

              <article>
                <small>
                  Diplomacy Signals
                </small>

                <strong>
                  {state.requests.length +
                    state.opportunities.length}
                </strong>

                <p>
                  Controlled
                  requests and
                  protected
                  introduction
                  routes currently
                  visible.
                </p>
              </article>

              <article>
                <small>
                  Regional Reach
                </small>

                <strong>
                  {
                    countries.length
                  }{' '}
                  countries
                </strong>

                <p>
                  Derived from
                  approved
                  Federation
                  directory
                  visibility.
                </p>
              </article>

              <article>
                <small>
                  Active Strategic
                  Work
                </small>

                <strong>
                  {
                    activeOperations.length
                  }
                </strong>

                <p>
                  Derived from Deal
                  Room, Connect, and
                  request state.
                </p>
              </article>
            </div>

            <p className="yh-federation-command-disclaimer">
              Council standing,
              seats, votes,
              decisions,
              alliances, regional
              authority and
              governance
              permissions remain
              separate from this
              read-only command
              surface.
            </p>
          </section>
          <FederationCommandStrategicParity
            model={strategicModel}
            onRefresh={() => void loadCommand(true)}
            onWorkspaceOpen={onWorkspaceOpen}
          />
        </div>
      </div>
    </section>
  )
}
