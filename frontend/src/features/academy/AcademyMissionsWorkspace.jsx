import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { ORIGINAL_MISSION_PLAYBOOKS } from './academyMissionPlaybookContent'
import {
  AssignedMissionsPanel,
  LeadDatabasePanel,
  PayoutsPanel,
} from './AcademyMissionsOperations'

/* YHU_ACADEMY_A06_RECRUITMENT_FIELDS_ORIGINAL_PARITY */
const PROFILE_PREFIX =
  'yh_academy_lead_recruitment_profile_v1'

const PLAYBOOKS = [
  {
    key: 'three-handshakes-away',
    iconImage:
      '/assets/academy/icons/handshake-mission.png',
    kicker:
      'Beginner Friendly • Social Outreach',
    title:
      '3-Handshakes-Away Mission',
    copy:
      'Use Instagram/X connection chains to reach valuable people through mutual links, replies, contacts, and directions.',
    meta:
      'Tools: Instagram, X, CRM Sheet, screenshots, optional AI rewriting.',
  },
  {
    key: 'cold-calling',
    iconImage:
      '/assets/academy/icons/call-mission.png',
    kicker:
      'Direct Execution • Company Outreach',
    title:
      'Cold-Calling Mission',
    copy:
      'Call real companies, collect direct contacts, build rapport, and warm leads for future Federation access.',
    meta:
      'Tools: phone number, Google Maps, Google Search, AI research, CRM Sheet, WhatsApp.',
  },
  {
    key: 'expansion-mission',
    iconImage:
      '/assets/academy/icons/academy-icon-expansion-mission.png',
    kicker:
      'Performance Based • Clippers Program',
    title:
      'Expansion Mission',
    copy:
      'Clip Young Hustlers content, grow approved distribution accounts, submit proof after view thresholds, and get paid when admin accepts performance.',
    meta:
      'Tools: editing app, approved YH account, CRM link submission, analytics screenshots, Telegram Gateway / Universe support.',
  },
]


/* YHU_ACADEMY_MISSION_GUIDES_PHASE3 */
const MISSION_DETAIL_SECTIONS = [
  ['Tools Needed', 'tools'],
  ['Step-by-Step Tasks', 'steps'],
  ['Scripts / Templates', 'templates'],
  ['Tracking Requirements', 'tracking'],
  ['Proof / Success Criteria', 'successCriteria'],
  ['Payments & Bonus', 'payment'],
]

function missionGuideAccountScope() {
  let tokenScope = ''
  try {
    const token = getStoredValue('yh_token') || getStoredValue('token')
    const part = token.split('.')[1]
    if (part) {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(base64))
      tokenScope =
        payload.uid ||
        payload.firebaseUid ||
        payload.user_id ||
        payload.id ||
        payload.sub ||
        payload.email ||
        ''
    }
  } catch {}

  const raw = clean(
    tokenScope ||
    getStoredValue('yh_user_id') ||
    getStoredValue('yh_user_email') ||
    getStoredValue('yh_user_username')
  )

  return raw
    ? raw.toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 160)
    : ''
}

function missionGuideStorageKey(missionKey) {
  const scope = missionGuideAccountScope()
  return scope
    ? 'yh_academy_mission_tutorial_v1:' + scope + ':' + missionKey
    : ''
}

function missionGuideWasSeen(missionKey) {
  const key = missionGuideStorageKey(missionKey)
  if (!key) return false
  try {
    return localStorage.getItem(key) === 'completed'
  } catch {
    return false
  }
}

function saveMissionGuideCompletion(missionKey) {
  const key = missionGuideStorageKey(missionKey)
  if (!key) return false
  try {
    localStorage.setItem(key, 'completed')
    return true
  } catch {
    return false
  }
}

const WORKSPACE_TABS = [
  ['readme', 'Read Me'],
  ['database', 'Lead Database'],
  ['opportunities', 'Opportunities'],
  ['assigned', 'Assigned'],
  ['followup', 'Follow-Ups'],
  ['payouts', 'Payouts'],
  ['deals', 'Deals'],
  ['scripts', 'Scripts'],
]

/* YHU_ACADEMY_A05_RECRUITMENT_CHECKBOX_PARITY */
const RECRUITMENT_CHOICE_GROUPS = {
  "targetCategories": {
    "title": "What type of people can you help us find?",
    "required": true,
    "choices": [
      "Lawyers",
      "Politicians",
      "Entrepreneurs",
      "Investors",
      "Influencers",
      "Athletes",
      "Doctors",
      "Engineers",
      "Cybersecurity Experts",
      "Media Personalities",
      "Students / Campus Leaders",
      "Other"
    ]
  },
  "strongestNiches": {
    "title": "Which niche do you understand best?",
    "required": true,
    "choices": [
      "Law and Legal Strategy",
      "Politics and Policy",
      "Business and Entrepreneurship",
      "Investing and Finance",
      "Influencer and Media",
      "Tech and Cybersecurity",
      "Health and Medicine",
      "Campus and Student Networks"
    ]
  },
  "searchPlatforms": {
    "title": "Which platforms can you search on?",
    "required": true,
    "choices": [
      "LinkedIn",
      "Twitter/X",
      "Instagram",
      "TikTok",
      "Facebook",
      "Telegram",
      "WhatsApp Groups",
      "Google Search",
      "Personal Network"
    ]
  },
  "networkTypes": {
    "title": "What type of people are in your current network?",
    "required": false,
    "choices": [
      "Business owners",
      "Professionals",
      "Students",
      "Creators",
      "Government / public sector",
      "Private sector operators"
    ]
  }
}

function RecruitmentChoiceGroup({ name, selected = [] }) {
  const group = RECRUITMENT_CHOICE_GROUPS[name]
  if (!group) return null
  return (
    <div className="form-group academy-lead-form-span-2">
      <label>{group.title}</label>
      <div className="academy-lead-chip-grid" data-required-group={group.required ? name : undefined}>
        {group.choices.map((choice) => (
          <label className="academy-lead-choice" key={choice}>
            <input type="checkbox" name={name} value={choice}
              defaultChecked={selected.includes(choice)} />
            <span>{choice}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
function clean(value = '') {
  return String(value ?? '').trim()
}

function getStoredValue(
  key,
  fallback = '',
) {
  try {
    return (
      localStorage.getItem(key) ||
      sessionStorage.getItem(key) ||
      fallback
    )
  } catch {
    return fallback
  }
}

function getIdentityKey() {
  return clean(
    getStoredValue(
      'yh_user_email',
      '',
    ) ||
      getStoredValue(
        'yh_user_username',
        '',
      ) ||
      getStoredValue(
        'yh_user_name',
        'user',
      ) ||
      'user',
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9@._-]/g,
      '_',
    )
}

function getProfileStorageKey() {
  return `${PROFILE_PREFIX}:${getIdentityKey() || 'user'}`
}

function readLocalProfile() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          getProfileStorageKey(),
        ) || 'null',
      )

    return parsed &&
      typeof parsed === 'object'
      ? parsed
      : null
  } catch {
    return null
  }
}

function writeLocalProfile(
  profile = {},
) {
  const next = {
    ...profile,
    completed: true,
    status:
      profile.status ||
      'active',
    strategicValue:
      profile.strategicValue ||
      'unrated',
    federationReady:
      profile.federationReady ===
      true,
    plazaReady:
      profile.plazaReady === true,
    updatedAt:
      new Date().toISOString(),
    submittedAt:
      profile.submittedAt ||
      new Date().toISOString(),
  }

  try {
    localStorage.setItem(
      getProfileStorageKey(),
      JSON.stringify(next),
    )
  } catch {}

  return next
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

/* Original Academy request timeout parity. */
function resolveAcademyStepAfterTimeout(promise, fallbackValue) {
  let timer = null

  return Promise.race([
    Promise.resolve(promise),
    new Promise(resolve => {
      timer = window.setTimeout(() => resolve(fallbackValue), 9000)
    }),
  ]).finally(() => {
    if (timer !== null) window.clearTimeout(timer)
  })
}

function displayValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return ''
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value)
  }

  if (
    typeof value === 'boolean'
  ) {
    return value
      ? 'Yes'
      : 'No'
  }

  if (Array.isArray(value)) {
    return value
      .map(displayValue)
      .filter(Boolean)
      .join(' • ')
  }

  return ''
}

function pick(
  source = {},
  keys = [],
) {
  for (const key of keys) {
    const value =
      displayValue(
        source?.[key],
      )

    if (value) {
      return value
    }
  }

  return ''
}

function WorkspaceCards({
  items = [],
  emptyText,
}) {
  const rows =
    safeArray(items)

  if (!rows.length) {
    return (
      <div className="academy-profile-empty-state">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="academy-lead-list">
      {rows.map(
        (item, index) => {
          const title =
            pick(item, [
              'companyName',
              'company',
              'personName',
              'contactName',
              'name',
              'title',
              'missionTitle',
              'opportunityTitle',
              'dealName',
            ]) ||
            `Record ${index + 1}`

          const subtitle =
            [
              pick(item, [
                'role',
                'position',
                'category',
                'source',
                'missionType',
              ]),
              pick(item, [
                'city',
                'country',
                'location',
              ]),
            ]
              .filter(Boolean)
              .join(' • ')

          const status =
            pick(item, [
              'status',
              'stage',
              'missionStatus',
              'reviewStatus',
              'payoutStatus',
            ])

          const detail =
            pick(item, [
              'nextAction',
              'missionBrief',
              'academyMissionNeed',
              'description',
              'notes',
              'note',
              'outcome',
              'completionProof',
            ])

          const date =
            pick(item, [
              'followUpDate',
              'dueDate',
              'updatedAt',
              'createdAt',
            ])

          return (
            <article
              className="academy-lead-list-card"
              key={
                clean(
                  item?.id ||
                    item?._id,
                ) ||
                `${title}-${index}`
              }
            >
              <div className="academy-lead-list-main">
                <strong>
                  {title}
                </strong>

                {subtitle && (
                  <span>
                    {subtitle}
                  </span>
                )}

                {detail && (
                  <p>
                    {detail}
                  </p>
                )}
              </div>

              <div className="academy-lead-list-meta">
                {status && (
                  <span>
                    {status}
                  </span>
                )}

                {date && (
                  <small>
                    {date}
                  </small>
                )}
              </div>
            </article>
          )
        },
      )}
    </div>
  )
}

function MetaPanel({
  meta = {},
}) {
  const entries =
    Object.entries(
      meta &&
        typeof meta === 'object'
        ? meta
        : {},
    ).filter(
      ([, value]) =>
        Boolean(
          displayValue(value),
        ),
    )

  if (!entries.length) {
    return (
      <div className="academy-profile-empty-state">
        Mission operator guidance is not available yet.
      </div>
    )
  }

  return (
    <div className="roadmap-transform-stat-list">
      {entries.map(
        ([key, value]) => (
          <div key={key}>
            <span>
              {key
                .replace(
                  /([A-Z])/g,
                  ' $1',
                )
                .replace(
                  /[_-]+/g,
                  ' ',
                )}
            </span>

            <strong>
              {displayValue(
                value,
              )}
            </strong>
          </div>
        ),
      )}
    </div>
  )
}

function ScriptsPanel({
  scripts = {},
}) {
  const entries =
    Object.entries(
      scripts &&
        typeof scripts === 'object'
        ? scripts
        : {},
    )

  if (!entries.length) {
    return (
      <div className="academy-profile-empty-state">
        No operator scripts available yet.
      </div>
    )
  }

  return (
    <div className="academy-mission-playbook-sections-grid">
      {entries.map(
        ([key, value]) => (
          <section
            className="academy-mission-playbook-section"
            key={key}
          >
            <h4>
              {key
                .replace(
                  /([A-Z])/g,
                  ' $1',
                )
                .replace(
                  /[_-]+/g,
                  ' ',
                )}
            </h4>

            <p>
              {displayValue(
                value,
              ) ||
                'No script text available.'}
            </p>
          </section>
        ),
      )}
    </div>
  )
}

export default function AcademyMissionsWorkspace({
  onToast,
}) {
  const [
    mode,
    setMode,
  ] = useState('hub')

  const [
    playbook,
    setPlaybook,
  ] = useState(null)

  const [
    activeTab,
    setActiveTab,
  ] = useState('database')

  const [
    workspace,
    setWorkspace,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    profile,
    setProfile,
  ] = useState(
    () =>
      readLocalProfile(),
  )

  const [
    recruitmentOpen,
    setRecruitmentOpen,
  ] = useState(false)

  const [
    recruitmentBusy,
    setRecruitmentBusy,
  ] = useState(false)

  const recruitmentScrollRef = useRef(0)
  const openRecruitmentPage = () => {
    recruitmentScrollRef.current = document.querySelector(
      '#academy-wrapper > main.yh-main-chat'
    )?.scrollTop || 0
    setRecruitmentOpen(true)
  }
  const closeRecruitmentPage = () => {
    if (recruitmentBusy) return
    setRecruitmentOpen(false)
    window.requestAnimationFrame(() => {
      const main = document.querySelector(
        '#academy-wrapper > main.yh-main-chat'
      )
      if (main) main.scrollTop = recruitmentScrollRef.current
    })
  }

  const [missionGuideKey, setMissionGuideKey] = useState('')
  const [missionGuidePage, setMissionGuidePage] = useState(0)
  const missionGuideDialogRef = useRef(null)

  const missionGuide =
    ORIGINAL_MISSION_PLAYBOOKS.find(
      (item) => item.key === missionGuideKey
    ) || null

  const missionGuidePageCount = MISSION_DETAIL_SECTIONS.length + 1

  useEffect(() => {
    const dialog = missionGuideDialogRef.current
    if (!dialog) return undefined

    if (missionGuideKey && !dialog.open) dialog.showModal()
    if (!missionGuideKey && dialog.open) dialog.close()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [missionGuideKey])

  const finishMissionGuide = () => {
    if (missionGuideKey) saveMissionGuideCompletion(missionGuideKey)
    setMissionGuideKey('')
    setMissionGuidePage(0)
  }

  const openMissionPlaybook = (mission) => {
    setPlaybook(mission)
    setMode('playbook')

    /* YHU_ACADEMY_MISSION_ELIGIBILITY_PHASE4: first-time Academy users only */
    if (
      window.YHDivisionTutorials?.isAcademyMissionGuideEligible?.() === true &&
      !missionGuideWasSeen(mission.key)
    ) {
      setMissionGuidePage(0)
      setMissionGuideKey(mission.key)
    }
  }

  const assignedMissions =
    useMemo(() => {
      if (
        Array.isArray(workspace?.assignedMissions) &&
        workspace.assignedMissions.length > 0
      ) {
        return workspace.assignedMissions
      }

      return safeArray(workspace?.leads).filter(
        item =>
          item?.routedFromAdmin === true ||
          clean(item?.sourceMethod).toLowerCase().startsWith('admin_routed_') ||
          clean(item?.callType).toLowerCase() === 'opportunity_mission' ||
          Boolean(clean(item?.assignmentStatus)),
      )
    }, [workspace])

  const fetchRecruitmentProfile =
    useCallback(async () => {
      const cached =
        readLocalProfile()

      if (
        cached?.completed === true
      ) {
        setProfile(cached)

        return cached
      }

      try {
        const result =
          await resolveAcademyStepAfterTimeout(
            apiFetch(
              '/api/academy/lead-missions/operator-profile',
              {
                method: 'GET',
              },
            ),
            null,
          )

        const remoteProfile =
          result?.success ===
            true &&
          result?.exists ===
            true &&
          result?.profile &&
          typeof result.profile ===
            'object'
            ? result.profile
            : null

        if (
          remoteProfile
            ?.completed === true
        ) {
          const saved =
            writeLocalProfile(
              remoteProfile,
            )

          setProfile(saved)

          return saved
        }
      } catch {}

      return null
    }, [])

  const loadWorkspace =
    useCallback(
      async (
        initialTab =
          'database',
      ) => {
        setLoading(true)
        setError('')

        try {
          const [
            result,
            payoutResult,
            opportunityResult,
          ] =
            await Promise.all([
              resolveAcademyStepAfterTimeout(
                apiFetch(
                  '/api/academy/lead-missions/workspace',
                  {
                    method: 'GET',
                  },
                ),
                { success: false, message: 'Leads workspace request timed out.' },
              ),

              resolveAcademyStepAfterTimeout(
                apiFetch(
                  '/api/payouts/my-ledger',
                  { method: 'GET' },
                ).catch(() => ({ success: false, payouts: [] })),
                { success: false, payouts: [] },
              ),

              resolveAcademyStepAfterTimeout(
                apiFetch(
                  '/api/academy/opportunity-missions',
                  { method: 'GET' },
                ).catch(() => ({
                  success: false,
                  opportunityMissions: [],
                  summary: { total: 0, plaza: 0, federation: 0 },
                })),
                {
                  success: false,
                  opportunityMissions: [],
                  summary: { total: 0, plaza: 0, federation: 0 },
                },
              ),
            ])

          if (
            result?.success !==
            true
          ) {
            throw new Error(
              result?.message ||
                'Unable to load Leads workspace.',
            )
          }

          const next = {
            ...result,

            withdrawalLedger:
              safeArray(
                payoutResult
                  ?.payouts,
              ),

            opportunityMissions:
              safeArray(
                opportunityResult
                  ?.opportunityMissions,
              ),

            opportunityMissionSummary:
              opportunityResult
                ?.summary &&
              typeof opportunityResult
                .summary ===
                'object'
                ? opportunityResult.summary
                : {
                    total: 0,
                    plaza: 0,
                    federation:
                      0,
                  },
          }

          setWorkspace(next)
          setActiveTab(
            initialTab ||
              'database',
          )
          setMode('leads')

          return next
        } catch (loadError) {
          const message =
            loadError?.message ||
            'Failed to load Leads.'

          setError(message)

          onToast?.(
            message,
            'error',
          )

          return null
        } finally {
          setLoading(false)
        }
      },
      [onToast],
    )

  const openOperatorWorkspace =
    async ({
      skipRecruitmentGate =
        false,
      initialTab =
        'database',
    } = {}) => {
      if (
        !skipRecruitmentGate
      ) {
        setLoading(true)

        const ready =
          await fetchRecruitmentProfile()

        setLoading(false)

        if (
          ready?.completed !==
          true
        ) {
          openRecruitmentPage()

          onToast?.(
            'Complete your Leads Recruitment Profile first.',
            'error',
          )

          return
        }
      }

      await loadWorkspace(
        initialTab,
      )
    }

  const leadEditIntentOpenedRef = useRef(false)

  useEffect(() => {
    if (leadEditIntentOpenedRef.current) return

    let targetId = ''
    try {
      targetId = String(
        sessionStorage.getItem('yh_academy_edit_lead_id_v1') || '',
      ).trim()
    } catch {}

    if (!targetId) return

    leadEditIntentOpenedRef.current = true

    void openOperatorWorkspace({
      initialTab: 'database',
    })
  }, [])

  const startPlaybook =
    async () => {
      if (!playbook) {
        onToast?.(
          'Open a mission first.',
          'error',
        )

        return
      }

      if (
        playbook.key ===
        'expansion-mission'
      ) {
        onToast?.(
          'Expansion Mission proof is handled through the Clippers CRM / Telegram Gateway once your account setup is approved.',
          'success',
        )

        return
      }

      onToast?.(
        `Opening tracking workspace for ${playbook.title}.`,
        'success',
      )

      await openOperatorWorkspace({
        skipRecruitmentGate:
          true,
        initialTab:
          'database',
      })
    }

  const submitRecruitment =
    async (event) => {
      event.preventDefault()

      if (
        recruitmentBusy
      ) {
        return
      }

      const form =
        event.currentTarget

      const formData =
        new FormData(form)

      const targetCategories =
        formData.getAll('targetCategories').map(clean).filter(Boolean)

      const strongestNiches =
        formData.getAll('strongestNiches').map(clean).filter(Boolean)

      const searchPlatforms =
        formData.getAll('searchPlatforms').map(clean).filter(Boolean)

      if (
        !targetCategories.length
      ) {
        onToast?.(
          'Select at least one type of person you can help us find.',
          'error',
        )

        return
      }

      if (
        !strongestNiches.length
      ) {
        onToast?.(
          'Select at least one niche you understand best.',
          'error',
        )

        return
      }

      if (
        !searchPlatforms.length
      ) {
        onToast?.(
          'Select at least one platform you can search on.',
          'error',
        )

        return
      }

      const agreements = [
        'qualityAgreement',
        'noFakeLeadsAgreement',
        'noSpamAgreement',
        'accessRiskAgreement',
      ]

      if (
        agreements.some(
          (name) =>
            !form.elements[
              name
            ]?.checked,
        )
      ) {
        onToast?.(
          'You must accept all quality and compliance agreements before accessing Leads.',
          'error',
        )

        return
      }

      const payload = {
        userId:
          getStoredValue(
            'yh_user_id',
            '',
          ) ||
          getStoredValue(
            'yh_user_email',
            '',
          ) ||
          getStoredValue(
            'yh_user_username',
            '',
          ) ||
          getStoredValue(
            'yh_user_name',
            '',
          ),

        fullName:
          clean(
            formData.get(
              'fullName',
            ),
          ),

        email:
          clean(
            formData.get(
              'email',
            ) ||
              getStoredValue(
                'yh_user_email',
                '',
              ),
          ),

        telegram:
          clean(
            formData.get(
              'telegram',
            ),
          ),

        country:
          clean(
            formData.get(
              'country',
            ),
          ),

        city:
          clean(
            formData.get(
              'city',
            ),
          ),

        timezone:
          clean(
            formData.get(
              'timezone',
            ),
          ),

        targetCategories,
        strongestNiches,
        searchPlatforms,

        networkTypes:
          formData.getAll('networkTypes').map(clean).filter(Boolean),

        hasLeadGenExperience:
          clean(
            formData.get(
              'hasLeadGenExperience',
            ),
          ),

        knowsInfluentialPeople:
          clean(
            formData.get(
              'knowsInfluentialPeople',
            ),
          ),

        weeklyLeadCapacity:
          clean(
            formData.get(
              'weeklyLeadCapacity',
            ),
          ),

        coverageRegion:
          clean(
            formData.get(
              'coverageRegion',
            ),
          ),

        motivation:
          clean(
            formData.get(
              'motivation',
            ),
          ),

        strategicValueAnswer:
          clean(
            formData.get(
              'strategicValueAnswer',
            ),
          ),

        followsInstructions:
          clean(
            formData.get(
              'followsInstructions',
            ),
          ),

        interestedInFederation:
          clean(
            formData.get(
              'interestedInFederation',
            ),
          ),

        interestedInPlaza:
          clean(
            formData.get(
              'interestedInPlaza',
            ),
          ),

        qualityAgreement:
          true,
        noFakeLeadsAgreement:
          true,
        noSpamAgreement:
          true,
        accessRiskAgreement:
          true,
      }

      setRecruitmentBusy(
        true,
      )

      try {
        const result =
          await apiFetch(
            '/api/academy/lead-missions/operator-profile',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        if (
          result?.success !==
          true
        ) {
          throw new Error(
            result?.message ||
              'Unable to save Leads Recruitment Profile.',
          )
        }

        const saved =
          writeLocalProfile(
            result?.profile &&
              typeof result.profile ===
                'object'
              ? result.profile
              : payload,
          )

        setProfile(saved)
        setRecruitmentOpen(
          false,
        )

        onToast?.(
          'Leads Recruitment Profile saved.',
          'success',
        )

        await loadWorkspace(
          'database',
        )
      } catch (
        profileError
      ) {
        onToast?.(
          profileError?.message ||
            'Unable to save Leads Recruitment Profile.',
          'error',
        )
      } finally {
        setRecruitmentBusy(
          false,
        )
      }
    }

  const renderWorkspacePanel =
    () => {
      if (
        activeTab ===
        'readme'
      ) {
        return (
          <MetaPanel
            meta={
              workspace?.meta
            }
          />
        )
      }

      if (
        activeTab ===
        'database'
      ) {
        return (
          <LeadDatabasePanel
            items={
              workspace?.leads
            }
            playbook={
              playbook
            }
            loadWorkspace={
              loadWorkspace
            }
            onToast={
              onToast
            }
          />
        )
      }

      if (
        activeTab ===
        'opportunities'
      ) {
        return (
          <WorkspaceCards
            items={
              workspace
                ?.opportunityMissions
            }
            emptyText="No opportunity missions available right now."
          />
        )
      }

      if (
        activeTab ===
        'assigned'
      ) {
        return (
          <AssignedMissionsPanel
            items={
              assignedMissions
            }
            loadWorkspace={
              loadWorkspace
            }
            onToast={
              onToast
            }
          />
        )
      }

      if (
        activeTab ===
        'followup'
      ) {
        return (
          <WorkspaceCards
            items={
              workspace
                ?.followUps
            }
            emptyText="No follow-ups due."
          />
        )
      }

      if (
        activeTab ===
        'payouts'
      ) {
        return (
          <PayoutsPanel
            payouts={
              workspace?.payouts
            }
            ledger={
              workspace?.withdrawalLedger
            }
            deals={workspace?.deals}
            loadWorkspace={
              loadWorkspace
            }
            onToast={
              onToast
            }
          />
        )
      }

      if (
        activeTab ===
        'deals'
      ) {
        return (
          <WorkspaceCards
            items={
              workspace?.deals
            }
            emptyText="No deal records yet."
          />
        )
      }

      return (
        <ScriptsPanel
          scripts={
            workspace?.scripts
          }
        />
      )
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-workspace"
      data-yh-dashboard-react-surface="academy-missions"
    >
      {!recruitmentOpen && <>
      <dialog
        ref={missionGuideDialogRef}
        className="academy-mission-guide-dialog"
        aria-labelledby="academy-mission-guide-title"
        onCancel={(event) => {
          event.preventDefault()
          finishMissionGuide()
        }}
      >
        {missionGuide && (
          <div className="academy-mission-guide-content">
            <span className="academy-profile-card-kicker">
              First-Time Mission Walkthrough
            </span>

            <p className="academy-mission-guide-counter">
              Step {missionGuidePage + 1} of {missionGuidePageCount}
            </p>

            <h2 id="academy-mission-guide-title">
              {missionGuide.title}
            </h2>

            <h3>
              {missionGuidePage === 0
                ? 'Mission Overview'
                : MISSION_DETAIL_SECTIONS[missionGuidePage - 1][0]}
            </h3>

            {missionGuidePage === 0 ? (
              <div>
                <p>{missionGuide.objective}</p>
                <p>{missionGuide.bestFor}</p>
              </div>
            ) : (
              <ol>
                {(missionGuide[
                  MISSION_DETAIL_SECTIONS[missionGuidePage - 1][1]
                ] || []).map((entry, index) => (
                  <li key={index}>{entry}</li>
                ))}
              </ol>
            )}

            <div className="academy-mission-guide-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                onClick={finishMissionGuide}
              >
                Skip tutorial
              </button>

              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={missionGuidePage === 0}
                onClick={() =>
                  setMissionGuidePage((step) => Math.max(0, step - 1))
                }
              >
                Back
              </button>

              <button
                type="button"
                className="academy-ui-button academy-ui-button--primary"
                onClick={() => {
                  if (missionGuidePage + 1 === missionGuidePageCount) {
                    finishMissionGuide()
                  } else {
                    setMissionGuidePage((step) => step + 1)
                  }
                }}
              >
                {missionGuidePage + 1 === missionGuidePageCount
                  ? 'Finish'
                  : 'Next'}
              </button>
            </div>
          </div>
        )}
      </dialog>
      <div className="academy-lead-missions-scroll">
        <div className="academy-lead-missions-shell">
          {mode ===
            'hub' && (
            <section className="academy-lead-missions-hero">
              <div>
                <div className="academy-profile-card-kicker">
                  Mission
                  Playbooks
                </div>

                <h2 className="academy-lead-missions-title">
                  Missions
                </h2>

                <p className="academy-lead-missions-copy">
                  Build useful
                  contacts,
                  open doors,
                  create approved
                  content
                  distribution,
                  track proof,
                  and get paid
                  when accepted
                  mission results
                  are confirmed.
                </p>
              </div>

              <div className="academy-mission-playbook-grid">
                {PLAYBOOKS.map(
                  (mission) => (
                    <button
                      type="button"
                      className="academy-mission-playbook-card"
                      key={
                        mission.key
                      }
                      onClick={() => openMissionPlaybook(mission)}
                    >
                      <span className="academy-mission-playbook-icon">
                        <img
                          src={
                            mission.iconImage
                          }
                          alt=""
                          className="academy-mission-playbook-icon-img"
                        />
                      </span>

                      <span className="academy-mission-playbook-body">
                        <span className="academy-mission-playbook-kicker">
                          {
                            mission.kicker
                          }
                        </span>

                        <span className="academy-mission-playbook-title">
                          {
                            mission.title
                          }
                        </span>

                        <span className="academy-mission-playbook-copy">
                          {
                            mission.copy
                          }
                        </span>

                        <span className="academy-mission-playbook-meta">
                          {
                            mission.meta
                          }
                        </span>
                      </span>

                      <span className="academy-mission-playbook-arrow">
                        Open Mission
                        →
                      </span>
                    </button>
                  ),
                )}
              </div>

              <div className="academy-mission-playbook-footer">
                <div>
                  <strong>
                    Payment
                    logic:
                  </strong>{' '}
                  $9 for
                  Tier/Level 1,
                  $6 for
                  Tier/Level 2,
                  $3 for
                  Tier/Level 3
                  accepted
                  Federation
                  leads.
                </div>

                <div>
                  <strong>
                    Bonus:
                  </strong>{' '}
                  $28.12 when
                  28 accepted
                  Federation
                  leads are
                  completed in
                  one month.
                </div>

                <div>
                  <strong>
                    Expansion
                    payout:
                  </strong>{' '}
                  Clippers
                  submissions
                  are
                  performance-based
                  and require
                  approved CRM
                  proof.
                </div>
              </div>

              <div className="academy-lead-header-actions">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--primary"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    void openOperatorWorkspace()
                  }
                >
                  {loading
                    ? 'Checking Leads Access...'
                    : profile?.completed
                      ? 'Open Operator Workspace'
                      : 'Access Lead Missions'}
                </button>
              </div>
            </section>
          )}

          {mode ===
            'playbook' &&
            playbook && (
              <section className="academy-mission-playbook-detail-shell">
                <div className="academy-mission-playbook-detail-head">
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    onClick={() => {
                      setPlaybook(
                        null,
                      )
                      setMode(
                        'hub',
                      )
                    }}
                  >
                    ← Back to
                    Missions
                  </button>

                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--primary"
                    disabled={
                      loading
                    }
                    onClick={() =>
                      void startPlaybook()
                    }
                  >
                    {loading
                      ? 'Loading...'
                      : 'Start / Track This Mission'}
                  </button>
                </div>

                <article className="academy-mission-playbook-detail-card">
                  <div className="academy-mission-playbook-detail-hero">
                    <div className="academy-mission-playbook-detail-icon">
                      <img
                        src={
                          playbook.iconImage
                        }
                        alt=""
                        className="academy-mission-playbook-detail-icon-img"
                      />
                    </div>

                    <div>
                      <div className="academy-profile-card-kicker">
                        {
                          playbook.kicker
                        }
                      </div>

                      <h2>
                        {
                          playbook.title
                        }
                      </h2>

                      <p>
                        {
                          playbook.copy
                        }
                      </p>

                      <div className="academy-mission-playbook-badges">
                        <span>
                          Mission
                          Playbook
                        </span>

                        <span>
                          Academy
                          Operator
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="academy-mission-playbook-sections-grid">
                    <section className="academy-mission-playbook-section">
                      <h4>
                        Tools /
                        Requirements
                      </h4>

                      <p>
                        {
                          playbook.meta
                        }
                      </p>
                    </section>

                    <section className="academy-mission-playbook-section">
                      <h4>
                        Tracking
                      </h4>

                      <p>
                        Use the
                        operator
                        workspace to
                        record leads,
                        follow-ups,
                        proof,
                        assignments,
                        and results.
                      </p>
                    </section>
                  </div>

                  <div className="academy-mission-playbook-sections-grid">
                    {MISSION_DETAIL_SECTIONS.map(([title, field]) => {
                      const originalDetail = ORIGINAL_MISSION_PLAYBOOKS.find(
                        (item) => item.key === playbook.key
                      )
                      const entries = originalDetail?.[field] || []

                      return entries.length ? (
                        <section className="academy-mission-playbook-section" key={field}>
                          <h4>{title}</h4>
                          <ul>
                            {entries.map((entry, index) => (
                              <li key={index}>{entry}</li>
                            ))}
                          </ul>
                        </section>
                      ) : null
                    })}
                  </div>
                </article>
              </section>
            )}

          {mode ===
            'leads' && (
            <div className="academy-lead-missions-workspace">
              <div className="academy-lead-header-actions">
                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  onClick={() =>
                    setMode(
                      'hub',
                    )
                  }
                >
                  ← Missions
                </button>

                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  onClick={() =>
                    openRecruitmentPage()
                  }
                >
                  Edit
                  Recruitment
                  Profile
                </button>

                <button
                  type="button"
                  className="academy-ui-button academy-ui-button--secondary"
                  disabled={
                    loading
                  }
                  onClick={() =>
                    void loadWorkspace(
                      activeTab,
                    )
                  }
                >
                  {loading
                    ? 'Refreshing...'
                    : 'Refresh'}
                </button>
              </div>

              <section className="academy-lead-missions-hero academy-lead-operator-hero">
                <div>
                  <div className="academy-profile-card-kicker">
                    Operator
                    Workspace
                  </div>

                  <h2 className="academy-lead-missions-title">
                    Lead Database
                  </h2>

                  <p className="academy-lead-missions-copy">
                    Track every
                    contact you
                    collect from
                    the mission
                    playbooks.
                    Keep records
                    clean and
                    ready for
                    admin review.
                  </p>
                </div>

                <div className="academy-lead-operator-focus">
                  <article>
                    <span>
                      1
                    </span>

                    <strong>
                      Add the
                      lead
                    </strong>

                    <small>
                      Company/person,
                      role,
                      location,
                      tier and
                      outcome.
                    </small>
                  </article>

                  <article>
                    <span>
                      2
                    </span>

                    <strong>
                      Keep proof
                      ready
                    </strong>

                    <small>
                      Screenshots,
                      CRM proof,
                      call notes
                      or
                      conversation
                      evidence.
                    </small>
                  </article>

                  <article>
                    <span>
                      3
                    </span>

                    <strong>
                      Update the
                      stage
                    </strong>

                    <small>
                      Identified
                      → nurture
                      → submitted
                      → accepted.
                    </small>
                  </article>
                </div>
              </section>

              <div className="academy-lead-subtabs">
                {WORKSPACE_TABS.map(
                  ([
                    key,
                    label,
                  ]) => (
                    <button
                      type="button"
                      key={key}
                      className={`academy-lead-subtab ${
                        activeTab ===
                        key
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setActiveTab(
                          key,
                        )
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>

              {workspace
                ?.opportunityMissionSummary &&
                activeTab ===
                  'opportunities' && (
                  <div className="roadmap-transform-stat-list">
                    <div>
                      <span>
                        Total
                      </span>
                      <strong>
                        {Number(
                          workspace
                            .opportunityMissionSummary
                            .total ||
                            0,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Plaza
                      </span>
                      <strong>
                        {Number(
                          workspace
                            .opportunityMissionSummary
                            .plaza ||
                            0,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Federation
                      </span>
                      <strong>
                        {Number(
                          workspace
                            .opportunityMissionSummary
                            .federation ||
                            0,
                        )}
                      </strong>
                    </div>
                  </div>
                )}

              {error && (
                <div className="yh-dashboard-settings-loading is-error">
                  {error}
                </div>
              )}

              {!error &&
                renderWorkspacePanel()}
            </div>
          )}
        </div>
      </div>
      </>}

      {recruitmentOpen && (
        <div className="academy-recruitment-page">
          <header className="academy-recruitment-header">
            <button
              type="button"
              className="academy-ui-button academy-ui-button--secondary"
              disabled={recruitmentBusy}
              onClick={closeRecruitmentPage}
            >
              ← Back
            </button>
            <div>
              <span className="academy-profile-card-kicker">
                Leads Access
              </span>
              <h1>
                {profile?.completed
                  ? 'Edit Recruitment Profile'
                  : 'Recruitment Profile'}
              </h1>
              <p>Manage your existing Academy recruitment details.</p>
            </div>
          </header>
          <form
            className="academy-recruitment-form"
            onSubmit={
              submitRecruitment
            }
          >
            <div className="academy-lead-form-span-2 academy-recruitment-intro">
              <div className="academy-profile-card-kicker">
                Leads Access
              </div>

              <h2>
                {profile?.completed
                  ? 'Edit Leads Recruitment Profile'
                  : 'Leads Recruitment Profile'}
              </h2>
              <p className="academy-lead-modal-subtitle">Before accessing Leads, complete your recruitment profile so we can assign missions based on your skills, location, network, and strategic value.</p>
              <div className="academy-lead-required-note">Required before entering Leads.</div>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-full-name">Full Name</label>
              <input id="lead-recruitment-full-name" name="fullName" className="academy-recruitment-input" type="text" required defaultValue={
                profile?.fullName ||
                getStoredValue(
                  'yh_user_name',
                  '',
                )
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-email">Email</label>
              <input id="lead-recruitment-email" name="email" className="academy-recruitment-input" type="email" readOnly defaultValue={
                profile?.email ||
                getStoredValue(
                  'yh_user_email',
                  '',
                )
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-telegram">Telegram Username</label>
              <input id="lead-recruitment-telegram" name="telegram" className="academy-recruitment-input" type="text" required placeholder="@username" defaultValue={
                profile?.telegram ||
                ''
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-country">Country</label>
              <input id="lead-recruitment-country" name="country" className="academy-recruitment-input" type="text" required defaultValue={
                profile?.country ||
                getStoredValue(
                  'yh_user_country',
                  '',
                )
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-city">City</label>
              <input id="lead-recruitment-city" name="city" className="academy-recruitment-input" type="text" required defaultValue={
                profile?.city ||
                getStoredValue(
                  'yh_user_city',
                  '',
                ) ||
                getStoredValue(
                  'yh_user_location_city',
                  '',
                )
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-timezone">Timezone</label>
              <input id="lead-recruitment-timezone" name="timezone" className="academy-recruitment-input" type="text" placeholder="Example: GMT+8" defaultValue={
                profile?.timezone ||
                ''
              } />
            </div>

            <RecruitmentChoiceGroup name="targetCategories" selected={safeArray(profile?.targetCategories)} />

            <RecruitmentChoiceGroup name="strongestNiches" selected={safeArray(profile?.strongestNiches)} />

            <RecruitmentChoiceGroup name="searchPlatforms" selected={safeArray(profile?.searchPlatforms)} />


            <div className="form-group">
              <label htmlFor="lead-recruitment-experience">Do you have lead generation experience?</label>
              <select id="lead-recruitment-experience" name="hasLeadGenExperience" className="academy-recruitment-input" required defaultValue={
                profile?.hasLeadGenExperience ||
                ''
              }>
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="learning">I am still learning</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-influential-network">Do you personally know influential people?</label>
              <select id="lead-recruitment-influential-network" name="knowsInfluentialPeople" className="academy-recruitment-input" required defaultValue={
                profile?.knowsInfluentialPeople ||
                ''
              }>
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="some">Some</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-weekly-capacity">Weekly Lead Capacity</label>
              <select id="lead-recruitment-weekly-capacity" name="weeklyLeadCapacity" className="academy-recruitment-input" required defaultValue={
                profile?.weeklyLeadCapacity ||
                ''
              }>
                <option value="">Select capacity</option>
                <option value="1-5 leads per week">1–5 leads per week</option>
                <option value="6-10 leads per week">6–10 leads per week</option>
                <option value="11-25 leads per week">11–25 leads per week</option>
                <option value="25+ leads per week">25+ leads per week</option>
                <option value="Not sure yet">To Be Determined</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-coverage-region">Which country/region can you help us cover?</label>
              <input id="lead-recruitment-coverage-region" name="coverageRegion" className="academy-recruitment-input" type="text" required defaultValue={
                profile?.coverageRegion ||
                ''
              } />
            </div>

            <RecruitmentChoiceGroup name="networkTypes" selected={safeArray(profile?.networkTypes)} />

            <div className="form-group academy-lead-form-span-2">
              <label htmlFor="lead-recruitment-motivation">Why do you want access to Leads?</label>
              <textarea id="lead-recruitment-motivation" name="motivation" className="academy-recruitment-input" rows={4} required defaultValue={
                profile?.motivation ||
                ''
              } />
            </div>

            <div className="form-group academy-lead-form-span-2">
              <label htmlFor="lead-recruitment-strategic-value">What makes you useful to the YH network?</label>
              <textarea id="lead-recruitment-strategic-value" name="strategicValueAnswer" className="academy-recruitment-input" rows={4} required defaultValue={
                profile?.strategicValueAnswer ||
                ''
              } />
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-instructions">Are you willing to follow structured mission instructions?</label>
              <select id="lead-recruitment-instructions" name="followsInstructions" className="academy-recruitment-input" required defaultValue={
                profile?.followsInstructions ||
                ''
              }>
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-federation">Interested in Federation opportunities later?</label>
              <select id="lead-recruitment-federation" name="interestedInFederation" className="academy-recruitment-input" defaultValue={
                profile?.interestedInFederation ||
                ''
              }>
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="maybe">Maybe</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lead-recruitment-plaza">Interested in opportunities from the Plazas later?</label>
              <select id="lead-recruitment-plaza" name="interestedInPlaza" className="academy-recruitment-input" defaultValue={
                profile?.interestedInPlaza ||
                ''
              }>
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="maybe">Maybe</option>
              </select>
            </div>

            {[
              [
                'qualityAgreement',
                'I agree to submit only real, relevant, and verifiable leads.',
              ],
              [
                'noFakeLeadsAgreement',
                'I agree not to submit fake names, random profiles, or low-quality leads.',
              ],
              [
                'noSpamAgreement',
                'I agree not to harass, spam, or misrepresent YH when contacting people.',
              ],
              [
                'accessRiskAgreement',
                'I understand that bad-quality submissions may remove my Leads access.',
              ],
            ].map(
              ([
                name,
                label,
              ]) => (
                <label
                  key={name}
                >
                  <input
                    type="checkbox"
                    name={name}
                    required
                    defaultChecked={
                      profile?.[
                        name
                      ] ===
                      true
                    }
                  />{' '}
                  {label}
                </label>
              ),
            )}

            <div className="academy-recruitment-actions">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  recruitmentBusy
                }
                onClick={() =>
                  closeRecruitmentPage()
                }
              >
                ← Back
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={
                  recruitmentBusy
                }
                aria-busy={
                  recruitmentBusy
                    ? 'true'
                    : 'false'
                }
              >
                {recruitmentBusy
                  ? 'Saving...'
                  : 'Submit & Unlock Leads'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
