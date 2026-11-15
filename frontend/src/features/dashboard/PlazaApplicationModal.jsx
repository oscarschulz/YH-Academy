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

const PLAZA_SCHEMA_VERSION =
  'plaza-dashboard-typeform-v1'

const PLAZA_DRAFT_KEY =
  'yh_dashboard_plaza_application_draft_v1'

const PLAZA_UNLOCK_SCORE = 60

const FIELD_IDS = {
  membershipType: 'plazaAppMembershipType',
  email: 'plazaAppEmail',
  fullName: 'plazaAppFullName',
  age: 'plazaAppAge',
  currentProject: 'plazaAppCurrentProject',
  resourcesNeeded: 'plazaAppResourcesNeeded',
  joinedAt: 'plazaAppJoinedAt',
  learntSoFar: 'plazaAppLearntSoFar',
  contribution: 'plazaAppContribution',
  strategicRole: 'plazaAppStrategicRole',
  strategicProof: 'plazaAppStrategicProof',
  audienceOrNetwork: 'plazaAppAudienceOrNetwork',
  capitalOrAccess: 'plazaAppCapitalOrAccess',
  highValueReason: 'plazaAppHighValueReason',
  wantsPatron: 'plazaAppWantsPatron',
  patronExpectation: 'plazaAppPatronExpectation',
  leadershipExperience: 'plazaAppLeadershipExperience',
  country: 'plazaAppCountry',
  wantsMarketplace: 'plazaAppWantsMarketplace',
  servicesProducts: 'plazaAppServicesProducts',
  referredBy: 'plazaAppReferredBy',
  howHeard: 'plazaAppHowHeard',
}

const EMPTY_FORM = {
  membershipType: '',
  email: '',
  fullName: '',
  age: '',
  currentProject: '',
  resourcesNeeded: '',
  joinedAt: '',
  learntSoFar: '',
  contribution: '',
  strategicRole: '',
  strategicProof: '',
  audienceOrNetwork: '',
  capitalOrAccess: '',
  highValueReason: '',
  wantsPatron: '',
  patronExpectation: '',
  leadershipExperience: '',
  country: '',
  wantsMarketplace: '',
  servicesProducts: '',
  referredBy: '',
  howHeard: '',
}

const MEMBERSHIP_LABELS = {
  academy: {
    joined:
      'When did you join The Academy approximately?',
    learnt:
      'What have you learnt so far in The Academy?',
    contribution:
      'What can you contribute as an Academy member?',
  },

  federation: {
    joined:
      'When did you join The Federation approximately?',
    learnt:
      'What have you learnt so far in The Federation?',
    contribution:
      'What can you contribute as a Federation member?',
  },

  direct_strategic: {
    joined:
      'What is your current professional or strategic background?',
    learnt:
      'What proof, experience, audience, capital, network, or access do you already have?',
    contribution:
      'What high-value contribution can you bring into the Plazas?',
  },

  not_yet: {
    joined:
      'How long have you been part of Young Hustlers or following the community?',
    learnt:
      'What have you learned or observed from Young Hustlers so far?',
    contribution:
      'What can you contribute to the Plazas as a YH member?',
  },
}

function readJson(key, fallback = {}) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(key) || 'null',
    )

    return parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? parsed
      : fallback
  } catch {
    return fallback
  }
}

function readStoredValue(...keys) {
  const stores = [
    sessionStorage,
    localStorage,
  ]

  for (const key of keys) {
    for (const store of stores) {
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

function isDivisionOverrideActive(
  override = null,
) {
  if (
    !override ||
    typeof override !== 'object'
  ) {
    return false
  }

  const active =
    override.unlocked === true ||
    override.active === true

  if (!active) return false

  const expiresAt = String(
    override.expiresAt || '',
  ).trim()

  if (!expiresAt) return true

  const expiresMs = Date.parse(expiresAt)

  if (!Number.isFinite(expiresMs)) {
    return true
  }

  return expiresMs > Date.now()
}

function getAcademyProgression() {
  const academyHome = readJson(
    'yh_academy_home',
    {},
  )

  const academyAccess = readJson(
    DASHBOARD_ACCESS_CACHE_KEYS.academy,
    {},
  )

  const plazaReadiness =
    academyHome?.plazaReadiness &&
    typeof academyHome.plazaReadiness ===
      'object'
      ? academyHome.plazaReadiness
      : {}

  const score = Math.max(
    0,
    Math.min(
      100,
      Number(plazaReadiness?.score || 0),
    ),
  )

  const status = normalizeAccessStatus(
    academyAccess?.applicationStatus,
  )

  return {
    academyApproved:
      academyAccess?.canEnterAcademy ===
        true || status === 'approved',

    score,

    readinessStatus: String(
      plazaReadiness?.statusLabel || '',
    ).trim(),

    marketplaceReady:
      plazaReadiness?.marketplaceReady ===
      true,

    missionCompletionRatio: Number(
      plazaReadiness?.missionCompletionRatio ||
        0,
    ),

    completedCount: Number(
      plazaReadiness?.completedCount || 0,
    ),

    totalCount: Number(
      plazaReadiness?.totalCount || 0,
    ),

    missionExecutionScore: Number(
      plazaReadiness?.scoreBreakdown
        ?.missionExecutionScore || 0,
    ),
  }
}

function getPlazaProgressionGate() {
  const plazaAccess = readJson(
    DASHBOARD_ACCESS_CACHE_KEYS.plazas,
    {},
  )

  const academyProgression =
    getAcademyProgression()

  const status = normalizeAccessStatus(
    plazaAccess?.applicationStatus,
  )

  const approved =
    plazaAccess?.canEnterPlaza === true ||
    status === 'approved'

  if (approved) {
    return {
      locked: false,
      track: 'approved',
      label: 'Approved Access',
      requiredScore:
        PLAZA_UNLOCK_SCORE,
      currentScore:
        academyProgression.score,
      academyProgression,
      ready: true,
      copy: 'Access is already approved.',
    }
  }

  const override =
    plazaAccess?.divisionOverride ||
    plazaAccess?.application
      ?.divisionOverride ||
    null

  if (isDivisionOverrideActive(override)) {
    return {
      locked: false,
      track: 'admin_override',
      label: 'Admin Override',
      requiredScore:
        PLAZA_UNLOCK_SCORE,
      currentScore:
        academyProgression.score,
      academyProgression,
      ready: true,
      copy:
        String(override?.reason || '').trim() ||
        'Admin manually unlocked your Plaza application gate.',
    }
  }

  if (!academyProgression.academyApproved) {
    return {
      locked: false,
      track: 'direct_strategic',
      label: 'Direct Strategic Review',
      requiredScore:
        PLAZA_UNLOCK_SCORE,
      currentScore:
        academyProgression.score,
      academyProgression,
      ready: false,
      copy:
        'Application is open. This user is not moving through Academy progression yet, so admin should review them as a direct strategic applicant.',
    }
  }

  const ready =
    academyProgression.score >=
    PLAZA_UNLOCK_SCORE

  const label = ready
    ? 'Plazas-ready'
    : 'Building Plazas Signal'

  return {
    locked: false,
    track: 'academy_progression',
    label,
    requiredScore:
      PLAZA_UNLOCK_SCORE,
    currentScore:
      academyProgression.score,
    academyProgression,
    ready,
    copy: ready
      ? `Application is open. Academy Score ${academyProgression.score}/${PLAZA_UNLOCK_SCORE} shows this user is ${label}.`
      : `Application is open anytime. Your Academy Score is ${academyProgression.score}/${PLAZA_UNLOCK_SCORE}; admin will still review your current readiness manually.`,
  }
}

function getRecommendedMembershipType() {
  const academy = readJson(
    DASHBOARD_ACCESS_CACHE_KEYS.academy,
    {},
  )

  const federation = readJson(
    DASHBOARD_ACCESS_CACHE_KEYS.federation,
    {},
  )

  const academyStatus =
    normalizeAccessStatus(
      academy?.applicationStatus,
    )

  if (
    academy?.canEnterAcademy === true ||
    academyStatus === 'approved'
  ) {
    return 'academy'
  }

  const federationStatus =
    normalizeAccessStatus(
      federation?.applicationStatus,
    )

  if (
    federation?.canEnterFederation ===
      true ||
    federationStatus === 'approved'
  ) {
    return 'federation'
  }

  const gate = getPlazaProgressionGate()

  if (gate.track === 'direct_strategic') {
    return 'direct_strategic'
  }

  return ''
}

function buildAcademySeed() {
  const academyHome = readJson(
    'yh_academy_home',
    {},
  )

  const profileSignals =
    academyHome?.profileSignals &&
    typeof academyHome.profileSignals ===
      'object'
      ? academyHome.profileSignals
      : {}

  const plazaReadiness =
    academyHome?.plazaReadiness &&
    typeof academyHome.plazaReadiness ===
      'object'
      ? academyHome.plazaReadiness
      : {}

  const roleTrack = String(
    profileSignals?.roleTrack || '',
  ).trim()

  const lookingFor = normalizeList(
    profileSignals?.lookingFor,
  )

  const canOffer = normalizeList(
    profileSignals?.canOffer,
  )

  const availability = String(
    profileSignals?.availability || '',
  ).trim()

  const workMode = String(
    profileSignals?.workMode || '',
  ).trim()

  const proofFocus = String(
    profileSignals?.proofFocus || '',
  ).trim()

  const readinessScore = Number(
    plazaReadiness?.score || 0,
  )

  const readinessStatus = String(
    plazaReadiness?.statusLabel || '',
  ).trim()

  const marketplaceReady =
    plazaReadiness?.marketplaceReady ===
    true

  const membershipType =
    getRecommendedMembershipType()

  const fullName = readStoredValue(
    'yh_user_full_name',
    'yh_user_display_name',
    'yh_user_name',
  )

  const email = readStoredValue(
    'yh_user_email',
    'email',
  )

  const country = readStoredValue(
    'yh_user_country',
    'yh_user_country_of_residence',
    'yh_user_location_country',
  )

  return {
    membershipType,
    fullName,
    email,
    country,

    currentProject: [
      roleTrack,
      proofFocus,
    ]
      .filter(Boolean)
      .join(' — '),

    resourcesNeeded:
      joinList(lookingFor),

    contribution:
      joinList(canOffer),

    servicesProducts:
      joinList(canOffer),

    wantsMarketplace:
      marketplaceReady ||
      canOffer.length > 0
        ? 'yes'
        : '',

    roleTrack,
    lookingFor,
    canOffer,
    availability,
    workMode,
    proofFocus,

    readinessScore,
    readinessStatus,
    marketplaceReady,

    missionCompletionRatio: Number(
      plazaReadiness?.missionCompletionRatio ||
        0,
    ),

    completedCount: Number(
      plazaReadiness?.completedCount || 0,
    ),

    totalCount: Number(
      plazaReadiness?.totalCount || 0,
    ),

    missionExecutionScore: Number(
      plazaReadiness?.scoreBreakdown
        ?.missionExecutionScore || 0,
    ),
  }
}

function readDraft() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        PLAZA_DRAFT_KEY,
      ) || 'null',
    )

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null
    }

    if (
      parsed.schemaVersion !==
      PLAZA_SCHEMA_VERSION
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function draftToForm(
  baseForm,
  draft,
) {
  if (
    !draft?.values ||
    typeof draft.values !== 'object'
  ) {
    return baseForm
  }

  const next = {
    ...baseForm,
  }

  Object.entries(FIELD_IDS).forEach(
    ([key, id]) => {
      if (
        Object.prototype.hasOwnProperty.call(
          draft.values,
          id,
        )
      ) {
        next[key] = String(
          draft.values[id] || '',
        )
      }
    },
  )

  return next
}

function createInitialForm() {
  const seed = buildAcademySeed()

  return {
    ...EMPTY_FORM,

    membershipType:
      seed.membershipType,

    email:
      seed.email,

    fullName:
      seed.fullName,

    currentProject:
      seed.currentProject,

    resourcesNeeded:
      seed.resourcesNeeded,

    contribution:
      seed.contribution,

    country:
      seed.country,

    wantsMarketplace:
      seed.wantsMarketplace,

    servicesProducts:
      seed.servicesProducts,
  }
}

function getApplicationFlow(form) {
  const flow = [
    'membershipType',
    'email',
  ]

  const validMembership = [
    'academy',
    'federation',
    'direct_strategic',
    'not_yet',
  ].includes(form.membershipType)

  if (!validMembership) {
    return flow
  }

  flow.push(
    'fullName',
    'age',
    'currentProject',
    'resourcesNeeded',
    'joinedAt',
    'learntSoFar',
    'contribution',
  )

  if (
    form.membershipType ===
    'direct_strategic'
  ) {
    flow.push(
      'strategicRole',
      'strategicProof',
      'audienceOrNetwork',
      'capitalOrAccess',
      'highValueReason',
    )
  }

  flow.push('wantsPatron')

  if (form.wantsPatron === 'yes') {
    flow.push(
      'patronExpectation',
      'leadershipExperience',
      'country',
    )
  } else if (
    form.wantsPatron === 'no'
  ) {
    flow.push('country')
  } else {
    return flow
  }

  flow.push('wantsMarketplace')

  if (
    form.wantsMarketplace === 'yes'
  ) {
    flow.push(
      'servicesProducts',
      'referredBy',
    )
  } else if (
    form.wantsMarketplace === 'no'
  ) {
    flow.push('referredBy')
  } else {
    return flow
  }

  if (!form.referredBy.trim()) {
    flow.push('howHeard')
  }

  flow.push('submit')

  return flow
}

function getQuestionCopy(
  step,
  membershipType,
) {
  const labels =
    MEMBERSHIP_LABELS[
      membershipType
    ] ||
    MEMBERSHIP_LABELS.academy

  const map = {
    membershipType:
      'Are you a member of Young Hustlers?',

    email:
      'Drop your best e-mail',

    fullName:
      'Name & Surname',

    age:
      'Age',

    currentProject:
      'What is one project you are currently building or planning?',

    resourcesNeeded:
      'What resources do you need most right now? knowledge, income, network, mentorship, etc.',

    joinedAt:
      labels.joined,

    learntSoFar:
      labels.learnt,

    contribution:
      labels.contribution,

    strategicRole:
      'What is your strongest strategic role, status, or position?',

    strategicProof:
      'What proof can you show that you are already valuable?',

    audienceOrNetwork:
      'Describe your audience, network, or access.',

    capitalOrAccess:
      'Do you have capital, deal flow, hiring power, distribution, or useful access?',

    highValueReason:
      'Why should admin treat your application as high-value?',

    wantsPatron:
      'Are you planning to become a Patrón or a Leader of the Plazas?',

    patronExpectation:
      'What do you expect if you were to become a Patrón of your selected Plazas region?',

    leadershipExperience:
      'Have you built, managed, or led anything before?',

    country:
      'Country of Residence',

    wantsMarketplace:
      'Do you provide any services/products others in the Plazas could buy, use, or request?',

    servicesProducts:
      'What services/products do you provide?',

    referredBy:
      'Who referred you? If nobody, leave this blank.',

    howHeard:
      'If nobody referred you, how did you hear from us?',
  }

  return map[step] || ''
}

function getPlaceholder(step) {
  const map = {
    email:
      'you@example.com',

    fullName:
      'Your full name',

    age:
      'Your age',

    joinedAt:
      'Example: March 2026, last month, 2 weeks ago...',

    strategicRole:
      'Example: founder, investor, lawyer, creator, operator, community leader, connector...',

    strategicProof:
      'Mention achievements, portfolio, audience, company, projects, revenue, network, leadership, or public proof.',

    audienceOrNetwork:
      'Who can you reach? What communities, industries, cities, or high-value people do you have access to?',

    capitalOrAccess:
      'Explain what kind of leverage you can bring into the Plazas.',

    highValueReason:
      'Be specific. Explain why you should bypass the normal Academy progression path.',

    country:
      'Your country',

    referredBy:
      'Leave blank if nobody referred you.',
  }

  return map[step] || ''
}

function formatStatus(value = '') {
  return normalizeAccessStatus(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(' ')
}

export default function PlazaApplicationModal({
  open,
  onClose,
  onSubmitted,
  onToast,
}) {
  const [form, setForm] = useState(
    createInitialForm,
  )
  const draftInitialized = useRef(false)

  const [step, setStep] = useState(
    'membershipType',
  )

  const [submitting, setSubmitting] =
    useState(false)

  const [
    submittedSnapshot,
    setSubmittedSnapshot,
  ] = useState(null)

  const flow = useMemo(
    () => getApplicationFlow(form),
    [form],
  )

  const activeIndex = Math.max(
    flow.indexOf(step),
    0,
  )

  const questionFlow =
    flow.filter(
      (key) => key !== 'submit',
    )

  const questionIndex = Math.max(
    questionFlow.indexOf(step),
    0,
  )

  const progress =
    step === 'submit'
      ? 100
      : Math.min(
          ((questionIndex + 1) /
            Math.max(
              questionFlow.length,
              1,
            )) *
            100,
          100,
        )

  const gate = getPlazaProgressionGate()

  const directStrategic =
    form.membershipType ===
      'direct_strategic' ||
    gate.track === 'direct_strategic'

  const adminOverride =
    gate.track === 'admin_override'

  const heading = directStrategic
    ? {
        kicker:
          'Plazas Strategic Review',
        title:
          'Apply for Plazas Strategic Review',
        copy:
          'This route is for high-value applicants who are not moving through the normal Academy score ladder. Admin will review your proof, network, capital, access, and strategic contribution.',
      }
    : adminOverride
      ? {
          kicker:
            'Plazas Admin Override',
          title:
            'Apply through Admin Override',
          copy:
            'Admin has manually unlocked this application gate. You can submit even before reaching the normal Academy score requirement.',
        }
      : {
          kicker:
            'Plazas Application',
          title:
            'Apply for Plazas Access',
          copy:
            'The Plazas are application-gated. Submit this internal Dashboard form first. Your account stays locked until admin approves your Plazas application.',
        }

  useEffect(() => {
    if (!open) return undefined
    draftInitialized.current = false
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      const base =
        createInitialForm()

      const draft =
        readDraft()

      const nextForm =
        draftToForm(
          base,
          draft,
        )

      const nextFlow =
        getApplicationFlow(
          nextForm,
        )

      const requestedStep =
        String(
          draft?.currentStep || '',
        ).trim()

      const nextStep =
        nextFlow.includes(requestedStep)
          ? requestedStep
          : nextFlow[0] ||
            'membershipType'

      setForm(nextForm)
      setStep(nextStep)
      setSubmitting(false)
      setSubmittedSnapshot(null)
      draftInitialized.current = true
    })

    document.body.classList.add(
      'plaza-application-open',
    )

    /*
     * Legacy behavior refreshes Academy Home
     * in the background so current readiness
     * can prefill the Plazas application.
     */
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

          const freshSeed =
            buildAcademySeed()

          setForm(
            (current) => ({
              ...current,

              membershipType:
                current.membershipType ||
                freshSeed.membershipType,

              email:
                current.email ||
                freshSeed.email,

              fullName:
                current.fullName ||
                freshSeed.fullName,

              currentProject:
                current.currentProject ||
                freshSeed.currentProject,

              resourcesNeeded:
                current.resourcesNeeded ||
                freshSeed.resourcesNeeded,

              contribution:
                current.contribution ||
                freshSeed.contribution,

              country:
                current.country ||
                freshSeed.country,

              wantsMarketplace:
                current.wantsMarketplace ||
                freshSeed.wantsMarketplace,

              servicesProducts:
                current.servicesProducts ||
                freshSeed.servicesProducts,
            }),
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      draftInitialized.current = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (
      event,
    ) => {
      if (
        event.key === 'Escape' &&
        !submitting
      ) {
        onClose?.()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )

      document.body.classList.remove(
        'plaza-application-open',
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

    try {
      const values = {}

      Object.entries(
        FIELD_IDS,
      ).forEach(([key, id]) => {
        values[id] = String(
          form[key] || '',
        ).trim()
      })

      const safeFlow =
        getApplicationFlow(form)

      const safeStep =
        safeFlow.includes(step)
          ? step
          : safeFlow[0] ||
            'membershipType'

      localStorage.setItem(
        PLAZA_DRAFT_KEY,
        JSON.stringify({
          schemaVersion:
            PLAZA_SCHEMA_VERSION,

          currentStep:
            safeStep,

          values,

          savedAt:
            new Date().toISOString(),
        }),
      )
    } catch { /* Noncritical browser storage or optional operation. */ }
  }, [
    form,
    step,
    open,
    submittedSnapshot,
  ])

  if (!open) return null

  const update = (
    key,
    value,
  ) => {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

  const validateStep = () => {
    if (
      step === 'referredBy' ||
      step === 'submit'
    ) {
      return true
    }

    const value = String(
      form[step] || '',
    ).trim()

    if (!value) {
      onToast?.(
        'Please answer this question first.',
        'error',
      )

      return false
    }

    if (
      step === 'email' &&
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

    if (step === 'age') {
      const age =
        Number.parseInt(
          value,
          10,
        )

      if (
        !Number.isFinite(age) ||
        age < 13 ||
        age > 120
      ) {
        onToast?.(
          'Please enter a valid age.',
          'error',
        )

        return false
      }
    }

    return true
  }

  const next = () => {
    if (!validateStep()) return

    const currentFlow =
      getApplicationFlow(form)

    const index =
      currentFlow.indexOf(step)

    const nextStep =
      currentFlow[index + 1] ||
      'submit'

    setStep(nextStep)
  }

  const back = () => {
    const currentFlow =
      getApplicationFlow(form)

    const index =
      currentFlow.indexOf(step)

    if (index <= 0) return

    setStep(
      currentFlow[index - 1] ||
        'membershipType',
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

    const currentGate =
      getPlazaProgressionGate()

    if (currentGate.locked) {
      onToast?.(
        currentGate.copy,
        'error',
      )
      return
    }

    const seed =
      buildAcademySeed()

    const academyProgression =
      currentGate.academyProgression ||
      getAcademyProgression()

    const membershipType =
      form.membershipType ||
      getRecommendedMembershipType() ||
      (currentGate.track ===
      'direct_strategic'
        ? 'direct_strategic'
        : '')

    const applicationTrack =
      membershipType === 'not_yet'
        ? 'general_review'
        : currentGate.track

    const payload = {
      schemaVersion:
        PLAZA_SCHEMA_VERSION,

      source:
        'Dashboard Plaza Application',

      applicationTrack,

      directStrategicApplicant:
        applicationTrack ===
        'direct_strategic',

      academyUnlockRequirement: {
        division: 'plaza',

        requiredScore:
          currentGate.requiredScore,

        currentScore:
          currentGate.currentScore,

        unlocked:
          currentGate.locked !== true,

        label:
          currentGate.label,

        copy:
          currentGate.copy,
      },

      membershipType,

      email:
        form.email.trim(),

      fullName:
        form.fullName.trim(),

      age:
        form.age.trim(),

      currentProject:
        form.currentProject.trim(),

      resourcesNeeded:
        form.resourcesNeeded.trim(),

      joinedAt:
        form.joinedAt.trim(),

      learntSoFar:
        form.learntSoFar.trim(),

      contribution:
        form.contribution.trim(),

      directStrategicProfile: {
        strategicRole:
          form.strategicRole.trim(),

        strategicProof:
          form.strategicProof.trim(),

        audienceOrNetwork:
          form.audienceOrNetwork.trim(),

        capitalOrAccess:
          form.capitalOrAccess.trim(),

        highValueReason:
          form.highValueReason.trim(),
      },

      wantsPatron:
        form.wantsPatron.trim(),

      patronExpectation:
        form.wantsPatron === 'yes'
          ? form.patronExpectation.trim()
          : '',

      leadershipExperience:
        form.wantsPatron === 'yes'
          ? form.leadershipExperience.trim()
          : '',

      country:
        form.country.trim(),

      wantsMarketplace:
        form.wantsMarketplace.trim(),

      servicesProducts:
        form.wantsMarketplace ===
        'yes'
          ? form.servicesProducts.trim()
          : '',

      referredBy:
        form.referredBy.trim(),

      howHeard:
        form.howHeard.trim(),

      academySignalSnapshot: {
        academyApproved:
          academyProgression
            .academyApproved === true,

        readinessScore:
          seed.readinessScore,

        readinessStatus:
          seed.readinessStatus,

        marketplaceReady:
          seed.marketplaceReady === true,

        missionCompletionRatio:
          seed.missionCompletionRatio,

        completedCount:
          seed.completedCount,

        totalCount:
          seed.totalCount,

        missionExecutionScore:
          seed.missionExecutionScore,

        roleTrack:
          seed.roleTrack,

        lookingFor:
          seed.lookingFor,

        canOffer:
          seed.canOffer,

        availability:
          seed.availability,

        workMode:
          seed.workMode,

        proofFocus:
          seed.proofFocus,
      },
    }

    setSubmitting(true)

    try {
      const result =
        await apiFetch(
          '/api/plaza/application',
          {
            method: 'POST',
            body: JSON.stringify(
              payload,
            ),
          },
        )

      const application =
        result?.application &&
        typeof result.application ===
          'object'
          ? result.application
          : payload

      const snapshot = {
        hasApplication: true,

        canEnterPlaza:
          result?.canEnterPlaza ===
          true,

        applicationStatus:
          normalizeAccessStatus(
            result?.applicationStatus ||
              application?.status ||
              'Under Review',
          ),

        application,

        divisionOverride:
          result?.divisionOverride ||
          application
            ?.divisionOverride ||
          null,

        member:
          result?.member || null,

        cachedAt:
          new Date().toISOString(),
      }

      try {
        localStorage.setItem(
          DASHBOARD_ACCESS_CACHE_KEYS.plazas,
          JSON.stringify(snapshot),
        )

        localStorage.removeItem(
          PLAZA_DRAFT_KEY,
        )
      } catch { /* Noncritical browser storage or optional operation. */ }

      setSubmittedSnapshot(
        snapshot,
      )

      onSubmitted?.(snapshot)

      onToast?.(
        'Plazas application submitted successfully.',
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
        error?.academyUnlockRequirement ||
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
            'Reach the required Academy score before applying to Plaza.',
          'error',
        )
      } else {
        onToast?.(
          error?.message ||
            'Failed to submit Plaza application.',
          'error',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = () => {
    if (step === 'submit') {
      return (
        <div
          className="yh-dashboard-plaza-step yh-dashboard-plaza-submit-step is-active"
          data-dashboard-plaza-step="submit"
        >
          <p className="subtitle">
            Review your answers mentally.
            Once submitted, your Plaza
            access remains locked until
            admin approval.
          </p>

          <div className="yh-federation-form-actions yh-dashboard-plaza-step-actions">
            <button
              type="button"
              className="btn-secondary yh-dashboard-plaza-back"
              onClick={back}
            >
              ← Back
            </button>

            <button
              type="submit"
              className="btn-primary"
              id="btn-submit-plaza-application"
            >
              Submit Plaza Application ➔
            </button>
          </div>
        </div>
      )
    }

    const label =
      getQuestionCopy(
        step,
        form.membershipType,
      )

    const id =
      FIELD_IDS[step]

    const value =
      form[step] || ''

    const isTextarea = [
      'currentProject',
      'resourcesNeeded',
      'learntSoFar',
      'contribution',
      'strategicRole',
      'strategicProof',
      'audienceOrNetwork',
      'capitalOrAccess',
      'highValueReason',
      'patronExpectation',
      'leadershipExperience',
      'servicesProducts',
      'howHeard',
    ].includes(step)

    const isSelect = [
      'membershipType',
      'wantsPatron',
      'wantsMarketplace',
    ].includes(step)

    return (
      <div
        className="yh-dashboard-plaza-step is-active"
        data-dashboard-plaza-step={
          step
        }
      >
        <label className="form-group">
          <span>
            {questionIndex + 1}.{' '}
            {label}
          </span>

          {isSelect ? (
            <select
              id={id}
              className="input-field styled-select"
              value={value}
              required
              onChange={(event) =>
                update(
                  step,
                  event.target.value,
                )
              }
            >
              <option value="">
                Select your answer
              </option>

              {step ===
                'membershipType' && (
                <>
                  <option value="academy">
                    Yes, in The Academy
                  </option>

                  <option value="federation">
                    Yes, in The Federation
                  </option>

                  <option value="direct_strategic">
                    Not in Academy yet —
                    apply as a high-value
                    strategic person
                  </option>

                  <option value="not_yet">
                    Not yet, am just looking
                    around
                  </option>
                </>
              )}

              {step ===
                'wantsPatron' && (
                <>
                  <option value="yes">
                    Yes
                  </option>

                  <option value="no">
                    No
                  </option>
                </>
              )}

              {step ===
                'wantsMarketplace' && (
                <>
                  <option value="yes">
                    Yes
                  </option>

                  <option value="no">
                    No
                  </option>
                </>
              )}
            </select>
          ) : isTextarea ? (
            <textarea
              id={id}
              rows={
                step ===
                'howHeard'
                  ? 4
                  : 5
              }
              className="input-field"
              required={
                step !==
                'referredBy'
              }
              placeholder={getPlaceholder(
                step,
              )}
              value={value}
              onChange={(event) =>
                update(
                  step,
                  event.target.value,
                )
              }
            />
          ) : (
            <input
              id={id}
              type={
                step === 'email'
                  ? 'email'
                  : step === 'age'
                    ? 'number'
                    : 'text'
              }
              min={
                step === 'age'
                  ? 13
                  : undefined
              }
              max={
                step === 'age'
                  ? 120
                  : undefined
              }
              className="input-field"
              required={
                step !==
                'referredBy'
              }
              placeholder={getPlaceholder(
                step,
              )}
              value={value}
              onChange={(event) =>
                update(
                  step,
                  event.target.value,
                )
              }
            />
          )}
        </label>

        <div className="yh-federation-form-actions yh-dashboard-plaza-step-actions">
          {activeIndex > 0 && (
            <button
              type="button"
              className="btn-secondary yh-dashboard-plaza-back"
              onClick={back}
            >
              ← Back
            </button>
          )}

          <button
            type="button"
            className="btn-primary yh-dashboard-plaza-next"
            onClick={next}
          >
            Continue ➔
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      id="plaza-apply-modal"
      className={`modal-overlay yh-federation-apply-modal yh-dashboard-division-apply-modal yh-dashboard-plaza-apply-modal ${
        submittedSnapshot
          ? 'is-division-application-submitted'
          : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yh-dashboard-plaza-apply-title"
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
        className={`modal-content hide-scrollbar yh-federation-apply-card yh-dashboard-division-apply-card yh-dashboard-plaza-apply-card ${
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
              Submitting your
              application for review.
            </strong>

            <p className="yh-division-application-submit-copy">
              Please wait while your
              application is securely sent
              for admin review.
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
              aria-label="Close Plazas application confirmation"
              onClick={close}
            >
              ✖
            </button>

            <div className="yh-dashboard-plaza-submitted-kicker">
              Plazas Application
            </div>

            <div
              className="yh-dashboard-plaza-submitted-icon"
              aria-hidden="true"
            >
              ✓
            </div>

            <h2>
              {submittedSnapshot
                .canEnterPlaza === true ||
              normalizeAccessStatus(
                submittedSnapshot
                  .applicationStatus,
              ) === 'approved'
                ? 'Plazas Access Approved'
                : 'Application Submitted for Review'}
            </h2>

            <p className="yh-dashboard-plaza-submitted-lead">
              {submittedSnapshot
                .canEnterPlaza === true
                ? 'Your Plazas application has been approved and your access is now active.'
                : 'Your Plazas application has been received successfully and is now pending admin review.'}
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
              {submittedSnapshot
                .canEnterPlaza === true
                ? 'You can now close this confirmation and enter the Plazas from your Dashboard.'
                : 'Your Plazas access will remain locked until an admin reviews and approves your application. You will receive an update once the review is complete.'}
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
              id="btn-close-plaza-apply"
              type="button"
              className="yh-federation-apply-close"
              aria-label="Close Plazas application"
              onClick={close}
            >
              ✖
            </button>

            <div className="yh-federation-apply-head">
              <div className="yh-dashboard-federation-kicker">
                {heading.kicker}
              </div>

              <h2 id="yh-dashboard-plaza-apply-title">
                {heading.title}
              </h2>

              <p>
                {heading.copy}
              </p>
            </div>

            <form
              className="yh-dashboard-plaza-typeform"
              id="form-plaza-apply"
              noValidate
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
                  step === 'submit'
                ) {
                  return
                }

                event.preventDefault()
                next()
              }}
            >
              <div className="yh-dashboard-plaza-progress">
                <div className="yh-dashboard-plaza-progress-copy">
                  <span id="dashboardPlazaProgressText">
                    {step === 'submit'
                      ? 'Ready to submit'
                      : `Question ${
                          questionIndex + 1
                        } of ${
                          questionFlow.length
                        }`}
                  </span>
                </div>

                <div className="yh-dashboard-plaza-progress-track">
                  <span
                    id="dashboardPlazaProgressBar"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              {renderField()}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
