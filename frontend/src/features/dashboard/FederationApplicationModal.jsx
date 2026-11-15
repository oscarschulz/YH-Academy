import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  DASHBOARD_ACCESS_CACHE_KEYS,
  normalizeAccessStatus,
} from './dashboardAccess'

const FEDERATION_UNLOCK_SCORE = 80
const FEDERATION_DRAFT_PREFIX =
  'yh_federation_application_draft_v1'

const FIELD_IDS = {
  fullName: 'fed-app-full-name',
  email: 'fed-app-email',
  telegram: 'fed-app-telegram',
  role: 'fed-app-role',
  country: 'fed-app-country',
  city: 'fed-app-city',
  company: 'fed-app-company',
  profileLink: 'fed-app-profile-link',
  primaryCategory: 'fed-app-primary-category',

  valueBring: 'fed-app-value-bring',
  accessContribution:
    'fed-app-access-contribution',
  regionsOfAccess:
    'fed-app-regions-access',

  directAuthorityProof:
    'fed-app-direct-authority-proof',
  directProofLinks:
    'fed-app-direct-proof-links',
  directNetworkSize:
    'fed-app-direct-network-size',
  directCapitalAccess:
    'fed-app-direct-capital-access',
  directRiskNote:
    'fed-app-direct-risk-note',

  lookingForContact:
    'fed-app-looking-for-contact',
  wantedContactTypes:
    'fed-app-wanted-contact-types',
  wantedContactRegion:
    'fed-app-wanted-contact-region',
  contactUrgency:
    'fed-app-contact-urgency',
  wantedContactReason:
    'fed-app-wanted-contact-reason',

  canProvideContacts:
    'fed-app-can-provide-contacts',
  contactTypesCanProvide:
    'fed-app-contact-types-can-provide',
  supplyRegions:
    'fed-app-supply-regions',
  openToAdminMatching:
    'fed-app-open-admin-matching',

  declarationSelectiveAccess:
    'fed-app-declare-selective',
  declarationAccurateInfo:
    'fed-app-declare-accurate',
  declarationProfessionalUse:
    'fed-app-declare-professional',
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  telegram: '',
  role: '',
  country: '',
  city: '',
  company: '',
  profileLink: '',
  primaryCategory: '',

  valueBring: '',
  accessContribution: '',
  regionsOfAccess: '',

  directAuthorityProof: '',
  directProofLinks: '',
  directNetworkSize: '',
  directCapitalAccess: '',
  directRiskNote: '',

  lookingForContact: '',
  wantedContactTypes: '',
  wantedContactRegion: '',
  contactUrgency: '',
  wantedContactReason: '',

  canProvideContacts: '',
  contactTypesCanProvide: '',
  supplyRegions: '',
  openToAdminMatching: '',

  declarationSelectiveAccess: false,
  declarationAccurateInfo: false,
  declarationProfessionalUse: false,
}

const CATEGORY_OPTIONS = [
  'Lawyers & Legal Strategists',
  'Politicians & Policy Advisors',
  'Entrepreneurs & Investors',
  'Influencers & Media Architects',
  'Cybersecurity Experts',
  'Doctors, Engineers, Athletes & Specialists',
  'Operators Across Industries',
  'Students / Campus Leaders',
  'Other High-Value Contact',
]

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || 'null',
    )

    return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? value
      : fallback
  } catch {
    return fallback
  }
}

function readStoredValue(...keys) {
  for (const store of [
    sessionStorage,
    localStorage,
  ]) {
    for (const key of keys) {
      try {
        const value = String(
          store.getItem(key) || '',
        ).trim()

        if (value) return value
      } catch { /* Noncritical browser storage or optional operation. */ }
    }
  }

  return ''
}

function normalizeList(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(',')

  return Array.from(
    new Set(
      source
        .map((item) =>
          String(item || '').trim(),
        )
        .filter(Boolean),
    ),
  ).slice(0, 8)
}

function joinList(value = []) {
  return normalizeList(value).join(', ')
}

function getIdentity() {
  const name =
    readStoredValue(
      'yh_user_full_name',
      'yh_user_display_name',
      'yh_user_name',
    ) || 'Hustler'

  const parts = name
    .split(/\s+/)
    .filter(Boolean)

  return {
    name,
    firstName:
      parts[0] || 'Hustler',
    surname:
      parts.length > 1
        ? parts.slice(1).join(' ')
        : '',

    username:
      readStoredValue(
        'yh_user_username',
      ),

    email:
      readStoredValue(
        'yh_user_email',
      ).toLowerCase(),

    city:
      readStoredValue(
        'yh_user_city',
        'yh_user_location_city',
      ),

    country:
      readStoredValue(
        'yh_user_country',
        'yh_user_country_of_residence',
        'yh_user_location_country',
      ),
  }
}

function getAcademyProgression() {
  const academyHome =
    readJson(
      'yh_academy_home',
      {},
    )

  const academy =
    readJson(
      DASHBOARD_ACCESS_CACHE_KEYS.academy,
      {},
    )

  const readiness =
    academyHome?.plazaReadiness &&
    typeof academyHome.plazaReadiness ===
      'object'
      ? academyHome.plazaReadiness
      : {}

  const status =
    normalizeAccessStatus(
      academy?.applicationStatus,
    )

  return {
    academyApproved:
      academy?.canEnterAcademy === true ||
      status === 'approved',

    score: Math.max(
      0,
      Math.min(
        100,
        Number(
          readiness?.score || 0,
        ),
      ),
    ),

    readinessStatus: String(
      readiness?.statusLabel || '',
    ).trim(),

    marketplaceReady:
      readiness?.marketplaceReady === true,

    missionCompletionRatio:
      Number(
        readiness
          ?.missionCompletionRatio || 0,
      ),

    completedCount:
      Number(
        readiness?.completedCount || 0,
      ),

    totalCount:
      Number(
        readiness?.totalCount || 0,
      ),

    missionExecutionScore:
      Number(
        readiness?.scoreBreakdown
          ?.missionExecutionScore || 0,
      ),
  }
}

function getFederationGate() {
  const federation =
    readJson(
      DASHBOARD_ACCESS_CACHE_KEYS.federation,
      {},
    )

  const progression =
    getAcademyProgression()

  const status =
    normalizeAccessStatus(
      federation?.applicationStatus,
    )

  if (
    federation?.canEnterFederation ===
      true ||
    status === 'approved'
  ) {
    return {
      locked: false,
      track: 'approved',
      label: 'Approved Access',
      requiredScore:
        FEDERATION_UNLOCK_SCORE,
      currentScore:
        progression.score,
      academyProgression:
        progression,
      ready: true,
      copy:
        'Access is already approved.',
    }
  }

  if (!progression.academyApproved) {
    return {
      locked: false,
      track: 'direct_strategic',
      label:
        'Direct Strategic Review',
      requiredScore:
        FEDERATION_UNLOCK_SCORE,
      currentScore:
        progression.score,
      academyProgression:
        progression,
      ready: false,
      copy:
        'Application is open. This user is not moving through Academy progression yet, so admin should review them as a direct strategic applicant.',
    }
  }

  const ready =
    progression.score >=
    FEDERATION_UNLOCK_SCORE

  const label = ready
    ? 'Federation-ready'
    : 'Building Federation Signal'

  return {
    locked: false,
    track: 'academy_progression',
    label,
    requiredScore:
      FEDERATION_UNLOCK_SCORE,
    currentScore:
      progression.score,
    academyProgression:
      progression,
    ready,
    copy: ready
      ? `Application is open. Academy Score ${progression.score}/${FEDERATION_UNLOCK_SCORE} shows this user is ${label}.`
      : `Application is open anytime. Academy Score ${progression.score}/${FEDERATION_UNLOCK_SCORE} is now only a readiness signal, not an application lock.`,
  }
}

function getPlazaProfileState(
  plaza,
  directory,
) {
  const approved =
    plaza?.canEnterPlaza === true ||
    normalizeAccessStatus(
      plaza?.applicationStatus,
    ) === 'approved'

  if (!approved) {
    return {
      label: 'Locked',
      copy:
        'Access to the Plazas must be approved before a Plazas profile can be seeded.',
    }
  }

  if (directory?.seeded !== true) {
    return {
      label: 'Not Seeded',
      copy:
        'Your Plazas access is approved, but your Plazas profile has not been seeded yet.',
    }
  }

  if (
    directory?.readyForOpportunityFlow ===
    true
  ) {
    return {
      label: 'Ready',
      copy:
        'Your Plazas profile is seeded and ready for opportunity flow.',
    }
  }

  return {
    label: 'Seeded',
    copy:
      'Your Plazas profile exists, but it still needs stronger role/focus/offer signal for opportunity flow.',
  }
}

function getPlazaOpportunityState(
  plaza,
  directory,
) {
  const approved =
    plaza?.canEnterPlaza === true ||
    normalizeAccessStatus(
      plaza?.applicationStatus,
    ) === 'approved'

  if (!approved) {
    return {
      score: 0,
      label: 'Locked',
      copy:
        'Plazas must be approved before opportunity scoring can begin.',
    }
  }

  if (directory?.seeded !== true) {
    return {
      score: 0,
      label: 'Not Seeded',
      copy:
        'Your Plazas profile has not been seeded yet, so opportunity scoring is still blocked.',
    }
  }

  const score = Number(
    directory?.opportunityScore || 0,
  )

  const stage = String(
    directory?.opportunityStage || '',
  ).trim()

  if (stage) {
    return {
      score,
      label: stage,
      copy: String(
        directory?.opportunityCopy ||
          'Your Plazas opportunity score has been calculated.',
      ).trim(),
    }
  }

  if (score >= 85) {
    return {
      score,
      label:
        'Ready for Strategic Escalation',
      copy:
        'Your Plazas profile is strong enough for strategic routing and higher-trust opportunity flow.',
    }
  }

  if (score >= 65) {
    return {
      score,
      label: 'Ready for Matching',
      copy:
        'Your Plazas profile is strong enough for direct matching and opportunity routing.',
    }
  }

  if (score >= 40) {
    return {
      score,
      label: 'Active',
      copy:
        'Your Plazas profile is active, but it still needs stronger signal before it becomes highly matchable.',
    }
  }

  return {
    score,
    label: 'Weak',
    copy:
      'Your Plazas profile exists, but it is still too thin for strong opportunity flow.',
  }
}

function getFederationReadiness(
  plaza,
  federation,
  directory,
) {
  const plazaApproved =
    plaza?.canEnterPlaza === true ||
    normalizeAccessStatus(
      plaza?.applicationStatus,
    ) === 'approved'

  const federationStatus =
    normalizeAccessStatus(
      federation?.applicationStatus,
    )

  const federationApproved =
    federation?.canEnterFederation ===
      true ||
    federationStatus === 'approved'

  const profile =
    getPlazaProfileState(
      plaza,
      directory,
    )

  const opportunity =
    getPlazaOpportunityState(
      plaza,
      directory,
    )

  if (!plazaApproved) {
    return {
      score: 0,
      label: 'Plazas First',
      copy:
        'Federation candidacy starts after Plazas approval and signal-building inside Plazas.',
      connectReady: false,
    }
  }

  if (profile.label === 'Not Seeded') {
    return {
      score: 0,
      label:
        'Seed Plazas Profile',
      copy:
        'Seed your Plazas profile first so the Federation layer can evaluate your signal.',
      connectReady: false,
    }
  }

  if (
    federationStatus === 'rejected'
  ) {
    return {
      score: opportunity.score,
      label: 'Review Rejected',
      copy:
        'Your Federation application was not approved in this cycle. Build stronger Plazas outcomes, trust, and leverage before reapplying.',
      connectReady: false,
    }
  }

  if (
    federationStatus === 'waitlisted'
  ) {
    return {
      score: opportunity.score,
      label: 'Waitlisted',
      copy:
        'Your Federation application has been waitlisted. Strengthen your Plazas signal and strategic proof before the next review cycle.',
      connectReady: false,
    }
  }

  if (
    federationStatus === 'shortlisted'
  ) {
    return {
      score: opportunity.score,
      label: 'Shortlisted',
      copy:
        'Your Federation application has reached shortlist status. You are near final review, but access is not unlocked yet.',
      connectReady: false,
    }
  }

  if (
    federationStatus ===
      'under review' ||
    federationStatus === 'screening'
  ) {
    return {
      score: opportunity.score,
      label:
        federationStatus === 'screening'
          ? 'In Screening'
          : 'In Federation Review',
      copy:
        'Your Federation application is currently in review. Admin is evaluating your candidacy against trust, leverage, and strategic value.',
      connectReady: false,
    }
  }

  const score = Number(
    opportunity.score || 0,
  )

  if (federationApproved) {
    return {
      score,
      label: 'Inside Federation',
      copy:
        'You are inside Federation.',
      connectReady:
        score >= 65,
    }
  }

  if (score >= 85) {
    return {
      score,
      label:
        'Strategic Candidate',
      copy:
        'Your Plazas opportunity score is strong enough to support serious Federation candidacy and high-trust Connect readiness.',
      connectReady: true,
    }
  }

  if (score >= 65) {
    return {
      score,
      label: 'Ready for Review',
      copy:
        'Your Plazas layer is strong enough for Federation review and qualified Connect readiness.',
      connectReady: true,
    }
  }

  if (score >= 40) {
    return {
      score,
      label:
        'Emerging Candidate',
      copy:
        'Your Plazas layer is active, but it still needs stronger outcomes and trust before serious Federation candidacy.',
      connectReady: false,
    }
  }

  return {
    score,
    label: 'Weak Candidate',
    copy:
      'Build a stronger Plazas opportunity score before pushing toward Federation candidacy.',
    connectReady: false,
  }
}

function getStrategicSnapshot() {
  const plaza =
    readJson(
      DASHBOARD_ACCESS_CACHE_KEYS.plazas,
      {},
    )

  const federation =
    readJson(
      DASHBOARD_ACCESS_CACHE_KEYS.federation,
      {},
    )

  const directory =
    readJson(
      'yhPlazaDirectoryStatusV1',
      {},
    )

  const profile =
    getPlazaProfileState(
      plaza,
      directory,
    )

  const opportunity =
    getPlazaOpportunityState(
      plaza,
      directory,
    )

  const readiness =
    getFederationReadiness(
      plaza,
      federation,
      directory,
    )

  const tags =
    normalizeList(directory?.tags)

  const lookingFor =
    normalizeList(
      directory?.lookingFor,
    )

  const canOffer =
    normalizeList(
      directory?.canOffer,
    )

  const score = Number(
    readiness?.score ??
      opportunity?.score ??
      directory?.opportunityScore ??
      0,
  )

  let tier = 'LOW_PRIORITY'

  if (score >= 90) {
    tier = 'CORE'
  } else if (score >= 70) {
    tier = 'OPERATOR'
  } else if (score >= 50) {
    tier = 'CONTRIBUTOR'
  }

  return {
    score,
    tier,

    plazaProfileStatus:
      profile.label || 'Locked',

    opportunityStage:
      opportunity.label || 'Locked',

    opportunityCopy:
      opportunity.copy || '',

    federationReadinessLabel:
      readiness.label ||
      'Plazas First',

    federationReadinessCopy:
      readiness.copy || '',

    connectReady:
      readiness.connectReady === true,

    role: String(
      directory?.role || '',
    ).trim(),

    focus: String(
      directory?.focus || '',
    ).trim(),

    trust: String(
      directory?.trust || '',
    ).trim(),

    region: String(
      directory?.region || '',
    ).trim(),

    availability: String(
      directory?.availability || '',
    ).trim(),

    workMode: String(
      directory?.workMode || '',
    ).trim(),

    marketplaceMode:
      directory?.marketplaceMode ===
      true,

    tags,
    lookingFor,
    canOffer,

    lookingForText:
      joinList(lookingFor),

    canOfferText:
      joinList(canOffer),
  }
}

function createInitialForm() {
  const identity =
    getIdentity()

  const strategic =
    getStrategicSnapshot()

  return {
    ...EMPTY_FORM,

    fullName:
      identity.name,

    email:
      identity.email,

    country:
      identity.country,

    city:
      identity.city,

    role:
      strategic.role,

    valueBring:
      strategic.canOfferText,

    accessContribution:
      strategic.focus ||
      strategic.canOfferText ||
      strategic.federationReadinessCopy,

    regionsOfAccess:
      strategic.region ||
      [
        identity.city,
        identity.country,
      ]
        .filter(Boolean)
        .join(', '),

    wantedContactTypes:
      strategic.lookingForText,

    wantedContactRegion:
      strategic.region,

    wantedContactReason:
      strategic.lookingForText ||
      strategic.federationReadinessCopy,

    contactTypesCanProvide:
      strategic.canOfferText,

    supplyRegions:
      strategic.region,

    lookingForContact:
      strategic.lookingForText
        ? 'Yes'
        : 'Maybe Later',

    canProvideContacts:
      strategic.canOfferText
        ? 'Yes, through my network'
        : 'Not yet',

    openToAdminMatching:
      strategic.connectReady
        ? 'Yes'
        : strategic.score >= 40
          ? 'Only for serious opportunities'
          : 'No',
  }
}

function getDraftKey() {
  const identity =
    getIdentity()

  const owner = String(
    identity.email ||
      identity.username ||
      identity.name ||
      'current-user',
  )
    .trim()
    .toLowerCase()

  return `${FEDERATION_DRAFT_PREFIX}:${encodeURIComponent(
    owner || 'current-user',
  )}`
}

function readDraft() {
  try {
    const draft = JSON.parse(
      localStorage.getItem(
        getDraftKey(),
      ) || 'null',
    )

    return draft &&
      typeof draft === 'object' &&
      !Array.isArray(draft)
      ? draft
      : null
  } catch {
    return null
  }
}

function applyDraft(
  base,
  draft,
) {
  if (
    !draft?.fields ||
    typeof draft.fields !== 'object'
  ) {
    return base
  }

  const next = {
    ...base,
  }

  Object.entries(FIELD_IDS).forEach(
    ([key, id]) => {
      const saved =
        draft.fields[id]

      if (!saved) return

      if (
        key.startsWith(
          'declaration',
        )
      ) {
        next[key] =
          saved.checked === true
      } else {
        next[key] = String(
          saved.value || '',
        )
      }
    },
  )

  return next
}

function getSteps(
  directStrategic,
) {
  const steps = [
    {
      key: 'fullName',
      title: 'Full Name',
      type: 'text',
      required: true,
    },
    {
      key: 'email',
      title: 'Email',
      type: 'email',
      required: true,
    },
    {
      key: 'telegram',
      title:
        'Telegram Username',
      type: 'text',
      required: true,
      placeholder: '@username',
    },
    {
      key: 'role',
      title:
        'Current Role / Title',
      type: 'text',
      required: true,
      placeholder:
        'Founder, student leader, lawyer, operator...',
    },
    {
      key: 'country',
      title:
        'Country of Residence',
      type: 'text',
      required: true,
    },
    {
      key: 'city',
      title:
        'City of Residence',
      type: 'text',
      required: true,
    },
    {
      key: 'company',
      title:
        'Company / Organization',
      type: 'text',
      placeholder: 'Optional',
    },
    {
      key: 'profileLink',
      title:
        'LinkedIn / Website / X Profile',
      type: 'url',
      placeholder:
        'Optional but recommended',
    },
    {
      key: 'primaryCategory',
      title:
        'Primary Federation Category',
      select: CATEGORY_OPTIONS,
      required: true,
    },
    {
      key: 'valueBring',
      title:
        'What makes you valuable to the Federation?',
      textarea: true,
      required: true,
      placeholder:
        'Explain your skills, network, influence, access, region, or experience.',
    },
    {
      key: 'accessContribution',
      title:
        'What kind of access, expertise, influence, or network can you contribute?',
      textarea: true,
      required: true,
    },
    {
      key: 'regionsOfAccess',
      title:
        'What regions, cities, or countries do you have useful access to?',
      type: 'text',
      required: true,
      placeholder:
        'Example: Lagos, Abuja, London, Dubai, Delhi',
    },
  ]

  if (directStrategic) {
    steps.push(
      {
        key:
          'directAuthorityProof',
        title:
          'Why should admin treat you as a direct high-value Federation applicant?',
        textarea: true,
        required: true,
        placeholder:
          'Explain your authority, track record, professional position, network, capital, influence, or strategic relevance.',
      },
      {
        key:
          'directProofLinks',
        title:
          'Proof links or public references',
        textarea: true,
        required: true,
        placeholder:
          'LinkedIn, website, portfolio, X profile, company page, media, or any verifiable proof.',
      },
      {
        key:
          'directNetworkSize',
        title:
          'Audience / Network Size',
        type: 'text',
        required: true,
        placeholder:
          'Example: 5,000 audience, 50 CEOs, campus network, legal network...',
      },
      {
        key:
          'directCapitalAccess',
        title:
          'Capital / Deal / Hiring Access',
        type: 'text',
        required: true,
        placeholder:
          'Example: investor access, hiring power, client pipeline, supplier access...',
      },
      {
        key:
          'directRiskNote',
        title:
          'Any risk, restriction, or verification note admin should know?',
        textarea: true,
        placeholder:
          'Optional but useful for admin review.',
      },
    )
  }

  steps.push(
    {
      key: 'lookingForContact',
      title:
        'Are you currently looking for a specific type of contact?',
      select: [
        'Yes',
        'No',
        'Maybe Later',
      ],
      required: true,
    },
    {
      key: 'wantedContactTypes',
      title:
        'What type of contact are you looking for?',
      type: 'text',
      placeholder:
        'Lawyer, investor, politician, supplier, client...',
    },
    {
      key: 'wantedContactRegion',
      title:
        'Preferred country / city',
      type: 'text',
      placeholder:
        'Example: Marbella, Spain',
    },
    {
      key: 'contactUrgency',
      title: 'Urgency',
      select: [
        'Low',
        'Medium',
        'High',
        'Immediate',
      ],
    },
    {
      key: 'wantedContactReason',
      title:
        'Why do you need this contact?',
      textarea: true,
      placeholder:
        'Explain the purpose of the introduction.',
    },
    {
      key: 'canProvideContacts',
      title:
        'Can you provide access to valuable contacts?',
      select: [
        'Yes, direct contacts',
        'Yes, through my network',
        'Maybe',
        'Not yet',
      ],
      required: true,
    },
    {
      key:
        'contactTypesCanProvide',
      title:
        'What type of contacts can you help provide?',
      type: 'text',
      placeholder:
        'Lawyers, investors, influencers, business owners...',
    },
    {
      key: 'supplyRegions',
      title:
        'Which regions can you help cover?',
      type: 'text',
      placeholder:
        'Cities, countries, regions',
    },
    {
      key: 'openToAdminMatching',
      title:
        'Open to admin matching opportunities?',
      select: [
        'Yes',
        'No',
        'Only for serious opportunities',
      ],
      required: true,
    },
    {
      key: 'declarations',
      title: 'Declaration',
      declarations: true,
      required: true,
    },
  )

  return steps
}

function formatStatus(value = '') {
  return normalizeAccessStatus(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase() +
        part.slice(1),
    )
    .join(' ')
}

export default function FederationApplicationModal({
  open,
  onClose,
  onSubmitted,
  onToast,
}) {
  const gate =
    getFederationGate()

  const directStrategic =
    gate.track ===
    'direct_strategic'

  const steps = useMemo(
    () =>
      getSteps(
        directStrategic,
      ),
    [directStrategic],
  )

  const [form, setForm] =
    useState(createInitialForm)
  const draftInitialized = useRef(false)

  const [stepIndex, setStepIndex] =
    useState(0)

  const [submitting, setSubmitting] =
    useState(false)

  const [
    submittedSnapshot,
    setSubmittedSnapshot,
  ] = useState(null)

  const current =
    steps[
      Math.min(
        stepIndex,
        steps.length - 1,
      )
    ]

  useEffect(() => {
    if (!open) return undefined
    draftInitialized.current = false
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      const draft =
        readDraft()

      setForm(
        applyDraft(
          createInitialForm(),
          draft,
        ),
      )

      setStepIndex(
        Math.max(
          0,
          Math.min(
            Number(
              draft?.activeIndex || 0,
            ),
            steps.length - 1,
          ),
        ),
      )

      setSubmitting(false)
      setSubmittedSnapshot(null)
      draftInitialized.current = true
    })

    document.body.classList.add(
      'federation-application-open',
    )

    apiFetch('/api/academy/home', {
      method: 'GET',
    })
      .then((result) => {
        if (
          result &&
          typeof result === 'object'
        ) {
          try {
            localStorage.setItem(
              'yh_academy_home',
              JSON.stringify(result),
            )
          } catch { /* Noncritical browser storage or optional operation. */ }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      draftInitialized.current = false
    }
  }, [open, steps.length])

  useEffect(() => {
    if (!open) return undefined

    const handler = (event) => {
      if (
        event.key === 'Escape' &&
        !submitting
      ) {
        onClose?.()
      }
    }

    document.addEventListener(
      'keydown',
      handler,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handler,
      )

      document.body.classList.remove(
        'federation-application-open',
      )
    }
  }, [
    open,
    submitting,
    onClose,
  ])

  useEffect(() => {
    if (
      !open ||
      !draftInitialized.current ||
      submittedSnapshot
    ) {
      return
    }

    const fields = {}

    Object.entries(
      FIELD_IDS,
    ).forEach(([key, id]) => {
      const checkbox =
        key.startsWith(
          'declaration',
        )

      fields[id] = {
        value: checkbox
          ? ''
          : String(
              form[key] || '',
            ),

        checked: checkbox
          ? form[key] === true
          : false,
      }
    })

    try {
      localStorage.setItem(
        getDraftKey(),
        JSON.stringify({
          version: 1,
          activeIndex:
            stepIndex,
          fields,
          updatedAt:
            new Date().toISOString(),
        }),
      )
    } catch { /* Noncritical browser storage or optional operation. */ }
  }, [
    form,
    stepIndex,
    open,
    submittedSnapshot,
  ])

  if (!open) return null

  const update = (
    key,
    value,
  ) => {
    setForm(
      (currentForm) => ({
        ...currentForm,
        [key]: value,
      }),
    )
  }

  const validateCurrent = () => {
    if (
      current.declarations
    ) {
      if (
        !form.declarationSelectiveAccess ||
        !form.declarationAccurateInfo ||
        !form.declarationProfessionalUse
      ) {
        onToast?.(
          'Please confirm all Federation declarations.',
          'error',
        )

        return false
      }

      return true
    }

    const value = String(
      form[current.key] || '',
    ).trim()

    if (
      current.required &&
      !value
    ) {
      onToast?.(
        'Please answer this question first.',
        'error',
      )

      return false
    }

    if (
      current.key === 'email' &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value,
      )
    ) {
      onToast?.(
        'Please enter a valid email address.',
        'error',
      )

      return false
    }

    if (
      current.key ===
        'profileLink' &&
      value
    ) {
      try {
        new URL(value)
      } catch {
        onToast?.(
          'Please enter a valid profile URL.',
          'error',
        )

        return false
      }
    }

    return true
  }

  const next = () => {
    if (!validateCurrent()) {
      return
    }

    setStepIndex(
      (index) =>
        Math.min(
          index + 1,
          steps.length - 1,
        ),
    )
  }

  const back = () => {
    setStepIndex(
      (index) =>
        Math.max(
          index - 1,
          0,
        ),
    )
  }

  const close = () => {
    if (submitting) return

    onClose?.()
  }

  const submit = async (
    event,
  ) => {
    event.preventDefault()

    if (!validateCurrent()) {
      return
    }

    const existing =
      readJson(
        DASHBOARD_ACCESS_CACHE_KEYS.federation,
        {},
      )

    const existingStatus =
      normalizeAccessStatus(
        existing?.applicationStatus,
      )

    if (
      existing?.hasApplication ===
        true &&
      existingStatus !==
        'rejected' &&
      existingStatus !==
        'approved'
    ) {
      onToast?.(
        'You already have a Federation application under review.',
        'error',
      )

      close()
      return
    }

    try {
      const academyHome =
        await apiFetch(
          '/api/academy/home',
          {
            method: 'GET',
          },
        )

      if (
        academyHome &&
        typeof academyHome ===
          'object'
      ) {
        localStorage.setItem(
          'yh_academy_home',
          JSON.stringify(
            academyHome,
          ),
        )
      }
    } catch { /* Noncritical browser storage or optional operation. */ }

    const progressionGate =
      getFederationGate()

    if (progressionGate.locked) {
      onToast?.(
        progressionGate.copy,
        'error',
      )
      return
    }

    const identity =
      getIdentity()

    const strategic =
      getStrategicSnapshot()

    const academyProgression =
      progressionGate
        .academyProgression ||
      getAcademyProgression()

    const nowIso =
      new Date().toISOString()

    const wantedContactTypesRaw =
      form.wantedContactTypes.trim()

    const contactTypesCanProvideRaw =
      form.contactTypesCanProvide.trim()

    const federationTags =
      Array.from(
        new Set([
          ...normalizeList(
            contactTypesCanProvideRaw,
          ),
          ...normalizeList(
            wantedContactTypesRaw,
          ),
          ...strategic.tags,
        ]),
      ).slice(0, 8)

    const payload = {
      id: `FED-APP-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      applicationType:
        'federation-access',

      division: 'Federation',

      divisions: [
        'Federation',
      ],

      recommendedDivision:
        'Federation',

      source:
        'Dashboard Federation Application',

      status:
        'Under Review',

      applicationTrack:
        progressionGate.track,

      directStrategicApplicant:
        progressionGate.track ===
        'direct_strategic',

      academyUnlockRequirement: {
        division: 'federation',

        requiredScore:
          progressionGate.requiredScore,

        currentScore:
          progressionGate.currentScore,

        unlocked:
          progressionGate.locked !== true,

        label:
          progressionGate.label,

        copy:
          progressionGate.copy,
      },

      academySignalSnapshot: {
        academyApproved:
          academyProgression
            .academyApproved === true,

        readinessScore:
          academyProgression.score,

        readinessStatus:
          academyProgression
            .readinessStatus,

        marketplaceReady:
          academyProgression
            .marketplaceReady === true,

        missionCompletionRatio:
          academyProgression
            .missionCompletionRatio,

        completedCount:
          academyProgression
            .completedCount,

        totalCount:
          academyProgression
            .totalCount,

        missionExecutionScore:
          academyProgression
            .missionExecutionScore,
      },

      directStrategicProof: {
        authorityProof:
          form.directAuthorityProof.trim(),

        proofLinks:
          form.directProofLinks.trim(),

        networkSize:
          form.directNetworkSize.trim(),

        capitalAccess:
          form.directCapitalAccess.trim(),

        riskNote:
          form.directRiskNote.trim(),
      },

      name:
        form.fullName.trim() ||
        identity.name ||
        'Federation Applicant',

      fullName:
        form.fullName.trim() ||
        identity.name ||
        '',

      username:
        identity.username || '',

      email:
        form.email
          .trim()
          .toLowerCase(),

      telegram:
        form.telegram.trim(),

      role:
        form.role.trim(),

      profession:
        form.role.trim(),

      country:
        form.country.trim(),

      city:
        form.city.trim(),

      region: [
        form.city.trim(),
        form.country.trim(),
      ]
        .filter(Boolean)
        .join(', '),

      company:
        form.company.trim(),

      profileLink:
        form.profileLink.trim(),

      primaryCategory:
        form.primaryCategory.trim(),

      goal:
        form.wantedContactReason.trim() ||
        'Apply for Federation access.',

      background: [
        form.role.trim(),
        form.company.trim(),
        form.primaryCategory.trim(),
        form.city.trim(),
        form.country.trim(),
      ]
        .filter(Boolean)
        .join(' • '),

      networkValue:
        form.valueBring.trim(),

      valueBring:
        form.valueBring.trim(),

      accessContribution:
        form.accessContribution.trim(),

      regionsOfAccess:
        form.regionsOfAccess.trim(),

      lookingForContact:
        form.lookingForContact.trim(),

      wantedContactTypes:
        normalizeList(
          wantedContactTypesRaw,
        ),

      wantedContactTypesRaw,

      wantedContactRegion:
        form.wantedContactRegion.trim(),

      wantedContactReason:
        form.wantedContactReason.trim(),

      contactUrgency:
        form.contactUrgency.trim(),

      canProvideContacts:
        form.canProvideContacts.trim(),

      contactTypesCanProvide:
        normalizeList(
          contactTypesCanProvideRaw,
        ),

      contactTypesCanProvideRaw,

      supplyRegions:
        form.supplyRegions.trim(),

      openToAdminMatching:
        form.openToAdminMatching.trim(),

      declarationSelectiveAccess:
        form.declarationSelectiveAccess ===
        true,

      declarationAccurateInfo:
        form.declarationAccurateInfo ===
        true,

      declarationProfessionalUse:
        form.declarationProfessionalUse ===
        true,

      aiScore:
        strategic.score,

      federationScore:
        strategic.score,

      federationTier:
        strategic.tier,

      federationTags,

      strategicReadinessSnapshot:
        strategic,

      federationProfileMap: {
        role:
          form.role.trim() ||
          strategic.role ||
          '',

        primaryCategory:
          form.primaryCategory.trim(),

        lookingFor:
          form.wantedContactReason.trim() ||
          strategic.lookingForText ||
          '',

        canOffer:
          form.valueBring.trim() ||
          strategic.canOfferText ||
          '',

        wantsAccessTo:
          wantedContactTypesRaw,

        opportunityInsight:
          strategic.federationReadinessCopy ||
          strategic.opportunityCopy ||
          '',

        tags:
          federationTags,

        openTo:
          strategic.connectReady
            ? [
                'admin matching',
                'strategic introductions',
              ]
            : ['review'],

        score:
          strategic.score,

        tier:
          strategic.tier,

        profileVersion: 1,
      },

      createdAt:
        nowIso,

      updatedAt:
        nowIso,

      submittedAt:
        nowIso,

      notes: [
        'Submitted through Dashboard Federation gate.',

        form.lookingForContact ===
        'Yes'
          ? 'Applicant has a Looking for Contact signal.'
          : '',

        form.canProvideContacts &&
        form.canProvideContacts !==
          'Not yet'
          ? 'Applicant may supply contacts.'
          : '',

        strategic
          .federationReadinessLabel
          ? `Strategic readiness: ${strategic.federationReadinessLabel}.`
          : '',

        strategic
          .opportunityStage
          ? `Plaza opportunity stage: ${strategic.opportunityStage}.`
          : '',
      ].filter(Boolean),
    }

    setSubmitting(true)

    try {
      const result =
        await apiFetch(
          '/api/federation/application',
          {
            method: 'POST',
            body: JSON.stringify(
              payload,
            ),
          },
        )

      const savedApplication = result?.application
      if (!savedApplication || typeof savedApplication !== 'object' ||
          Array.isArray(savedApplication) || !String(savedApplication.id || '').trim()) {
        throw new Error('Federation application response was incomplete. Your draft has been kept.')
      }

      const snapshot = {
        hasApplication: true,

        canEnterFederation:
          false,

        applicationStatus:
          'under review',

        application:
          savedApplication,

        member: null,
      }

      try {
        localStorage.setItem(
          DASHBOARD_ACCESS_CACHE_KEYS.federation,
          JSON.stringify(
            snapshot,
          ),
        )

        localStorage.removeItem(
          getDraftKey(),
        )
      } catch { /* Noncritical browser storage or optional operation. */ }

      setSubmittedSnapshot(
        snapshot,
      )

      onSubmitted?.(
        snapshot,
      )

      onToast?.(
        'Federation application submitted successfully.',
        'success',
      )
    } catch (error) {
      const code = String(
        error?.code ||
          error?.data?.code ||
          error?.payload?.code ||
          '',
      )
        .trim()
        .toUpperCase()

      const requirement =
        error
          ?.academyUnlockRequirement ||
        error?.data
          ?.academyUnlockRequirement ||
        error?.payload
          ?.academyUnlockRequirement ||
        null

      if (
        code ===
        'ACADEMY_SCORE_LOCKED'
      ) {
        onToast?.(
          requirement?.copy ||
            error?.message ||
            'Reach the required Academy score before applying to Federation.',
          'error',
        )
      } else {
        onToast?.(
          error?.message ||
            'Failed to submit Federation application.',
          'error',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderCurrentStep = () => {
    if (
      current.declarations
    ) {
      return (
        <div className="yh-federation-form-section yh-federation-declaration-section is-yh-one-question-active">
          <h3>
            Declaration
          </h3>

          <label className="yh-federation-check-row">
            <input
              id="fed-app-declare-selective"
              type="checkbox"
              checked={
                form.declarationSelectiveAccess
              }
              onChange={(event) =>
                update(
                  'declarationSelectiveAccess',
                  event.target.checked,
                )
              }
            />

            <span>
              I understand that Federation access is selective and not guaranteed.
            </span>
          </label>

          <label className="yh-federation-check-row">
            <input
              id="fed-app-declare-accurate"
              type="checkbox"
              checked={
                form.declarationAccurateInfo
              }
              onChange={(event) =>
                update(
                  'declarationAccurateInfo',
                  event.target.checked,
                )
              }
            />

            <span>
              I confirm that the information I provided is accurate.
            </span>
          </label>

          <label className="yh-federation-check-row">
            <input
              id="fed-app-declare-professional"
              type="checkbox"
              checked={
                form.declarationProfessionalUse
              }
              onChange={(event) =>
                update(
                  'declarationProfessionalUse',
                  event.target.checked,
                )
              }
            />

            <span>
              I understand that introductions and contact access must be handled professionally.
            </span>
          </label>
        </div>
      )
    }

    return (
      <div className="form-group is-yh-one-question-active">
        <label>
          {current.title}
        </label>

        {current.select ? (
          <select
            id={
              FIELD_IDS[
                current.key
              ]
            }
            className="input-field styled-select"
            value={
              form[
                current.key
              ]
            }
            required={
              current.required
            }
            onChange={(event) =>
              update(
                current.key,
                event.target.value,
              )
            }
          >
            <option value="">
              Select answer.
            </option>

            {current.select.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ),
            )}
          </select>
        ) : current.textarea ? (
          <textarea
            id={
              FIELD_IDS[
                current.key
              ]
            }
            className="input-field"
            rows="3"
            required={
              current.required
            }
            placeholder={
              current.placeholder ||
              ''
            }
            value={
              form[
                current.key
              ]
            }
            onChange={(event) =>
              update(
                current.key,
                event.target.value,
              )
            }
          />
        ) : (
          <input
            id={
              FIELD_IDS[
                current.key
              ]
            }
            className="input-field"
            type={
              current.type ||
              'text'
            }
            required={
              current.required
            }
            placeholder={
              current.placeholder ||
              ''
            }
            value={
              form[
                current.key
              ]
            }
            onChange={(event) =>
              update(
                current.key,
                event.target.value,
              )
            }
          />
        )}
      </div>
    )
  }

  const approved =
    submittedSnapshot
      ?.canEnterFederation === true ||
    normalizeAccessStatus(
      submittedSnapshot
        ?.applicationStatus,
    ) === 'approved'

  return (
    <div
      id="federation-apply-modal"
      className={`modal-overlay yh-federation-apply-modal yh-dashboard-division-apply-modal ${
        submittedSnapshot
          ? 'is-division-application-submitted'
          : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yh-dashboard-federation-apply-title"
      aria-hidden="false"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !submitting
        ) {
          close()
        }
      }}
    >
      <div
        className={`modal-content hide-scrollbar yh-federation-apply-card yh-dashboard-division-apply-card ${
          submittedSnapshot
            ? 'is-division-application-submitted'
            : ''
        } ${
          submitting
            ? 'is-division-application-submitting'
            : ''
        }`}
      >
        {submitting ? (
          <div
            className="yh-division-application-submit-state"
            role="status"
            aria-live="polite"
          >
            <div
              className="yh-division-application-submit-spinner"
              aria-hidden="true"
            />

            <strong className="yh-division-application-submit-title">
              Submitting your application for review.
            </strong>

            <p className="yh-division-application-submit-copy">
              Please wait while your application is securely sent for admin review.
            </p>
          </div>
        ) : submittedSnapshot ? (
          <div
            className="yh-dashboard-division-submitted-state yh-dashboard-plaza-submitted-state"
            role="status"
            aria-live="polite"
          >
            <button
              type="button"
              className="yh-federation-apply-close yh-dashboard-division-submitted-x"
              aria-label="Close Federation application confirmation"
              onClick={close}
            >
              ✖
            </button>

            <div className="yh-dashboard-plaza-submitted-kicker">
              Federation Application
            </div>

            <div
              className="yh-dashboard-plaza-submitted-icon"
              aria-hidden="true"
            >
              ✓
            </div>

            <h2>
              {approved
                ? 'Federation Access Approved'
                : 'Application Submitted for Review'}
            </h2>

            <p className="yh-dashboard-plaza-submitted-lead">
              {approved
                ? 'Your Federation application has been approved and your access is now active.'
                : 'Your Federation application has been received successfully and is now pending admin review.'}
            </p>

            <div className="yh-dashboard-plaza-submitted-status">
              <span>
                Application Status
              </span>

              <strong>
                {formatStatus(
                  submittedSnapshot
                    .applicationStatus ||
                    'under review',
                )}
              </strong>
            </div>

            <p className="yh-dashboard-plaza-submitted-copy">
              {approved
                ? 'You can now close this confirmation and enter the Federation from your Dashboard.'
                : 'Your Federation access will remain locked until an admin reviews and approves your application. You will receive an update once the review is complete.'}
            </p>

            <button
              type="button"
              className="btn-primary yh-dashboard-plaza-submitted-close yh-dashboard-division-submitted-close"
              onClick={close}
            >
              Close ➔
            </button>
          </div>
        ) : (
          <>
            <button
              id="btn-close-federation-apply"
              type="button"
              className="yh-federation-apply-close"
              aria-label="Close Federation application"
              onClick={close}
            >
              ✖
            </button>

            <div className="yh-federation-apply-head">
              <div className="yh-dashboard-federation-kicker">
                Federation Application
              </div>

              <h2 id="yh-dashboard-federation-apply-title">
                {directStrategic
                  ? 'Apply for Federation Strategic Review'
                  : 'Apply for Federation Access'}
              </h2>

              <p>
                {directStrategic
                  ? 'This route is for high-value applicants who are not moving through the normal Academy score ladder. Admin will review your authority, proof, network, capital, and strategic value.'
                  : 'Apply to enter the private strategic layer of Young Hustlers. Access is reviewed based on trust, leverage, network value, regional relevance, and your ability to contribute or request high-value introductions.'}
              </p>
            </div>

            <form
              id="form-federation-apply"
              className="yh-federation-apply-form yh-one-question-form"
              onSubmit={submit}
              onKeyDown={(event) => {
                if (
                  event.key !==
                    'Enter' ||
                  event.target instanceof
                    HTMLTextAreaElement
                ) {
                  return
                }

                if (
                  stepIndex >=
                  steps.length - 1
                ) {
                  return
                }

                event.preventDefault()
                next()
              }}
            >
              <div className="yh-one-question-head">
                <div className="yh-one-question-meta">
                  <span>
                    Question{' '}
                    {stepIndex + 1}
                  </span>

                  <span>
                    {stepIndex + 1} of{' '}
                    {steps.length}
                  </span>
                </div>

                <div className="yh-one-question-title">
                  {current.title}
                </div>

                <div
                  className="yh-one-question-progress-track"
                  aria-hidden="true"
                >
                  <span
                    className="yh-one-question-progress-bar"
                    style={{
                      width: `${
                        ((stepIndex +
                          1) /
                          steps.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {renderCurrentStep()}

              <div className="yh-one-question-controls">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    stepIndex === 0
                  }
                  onClick={back}
                >
                  ← Back
                </button>

                {stepIndex <
                steps.length - 1 ? (
                  <button
                    type="button"
                    className="btn-primary yh-one-question-next"
                    onClick={next}
                  >
                    Continue ➔
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-primary"
                    id="btn-submit-federation-application"
                  >
                    Submit Federation Application ➔
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
