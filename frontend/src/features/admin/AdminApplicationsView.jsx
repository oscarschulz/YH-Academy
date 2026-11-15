import AdminFilterMenu from './AdminFilterMenu'
import { useEffect, useMemo, useState } from 'react'
import { adminFetchJson, getAdminBootstrap, copyAdminText } from './adminApi'
import AdminActionModal from './AdminActionModal'

// YHU_ADMIN_PHASE1_INLINE_V1
const finalStatuses = new Set(['approved', 'rejected'])

const tones = {
  New: 'blue',
  'Under Review': 'amber',
  Approved: 'green',
  Rejected: 'red',
  Waitlisted: 'purple',
  'Needs More Info': 'cyan',
  Active: 'green',
  Pending: 'amber',
  Suspended: 'red',
  Flagged: 'red',
  Academy: 'blue',
  Federation: 'purple',
  Plazas: 'cyan',
  'Admin Override': 'purple',
  'Strategic Review': 'purple',
  'Score Locked': 'amber',
  Eligible: 'green',
  Progression: 'blue'
}

const asText = (value, fallback = '—') =>
  String(value ?? '').trim() || fallback

const capWords = value =>
  asText(value, 'general')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())

export function Badge({ value }) {
  const label = asText(value)

  return (
    <span className={`badge badge-${tones[label] || 'gray'}`}>
      {label}
    </span>
  )
}

function federationScore(record) {
  return Number(
    record.federationScore ??
    record.federationProfileMap?.score ??
    record.federationProfileMap?.federationScore ??
    record.aiScore ??
    0
  ) || 0
}

function overrideDivision(record = {}) {
  const raw = String(
    record.recommendedDivision ||
    record.division ||
    record.reviewLane ||
    record.applicationType ||
    ''
  ).trim().toLowerCase()

  if (raw.includes('federation')) return 'federation'
  if (raw.includes('plaza')) return 'plaza'
  return ''
}

function currentDivisionOverride(record = {}) {
  const direct = record.divisionOverride
  if (direct && typeof direct === 'object') return direct

  const nested = record.academyUnlockRequirement?.divisionOverride
  return nested && typeof nested === 'object' ? nested : null
}

function divisionOverrideActive(record = {}) {
  const override = currentDivisionOverride(record)

  if (!override ||
      (override.unlocked !== true && override.active !== true)) {
    return false
  }

  const expires = String(override.expiresAt || '').trim()
  if (!expires) return true

  const timestamp = Date.parse(expires)
  return !Number.isFinite(timestamp) || timestamp > Date.now()
}

function gateFor(record) {
  const requirement =
    record.academyUnlockRequirement &&
    typeof record.academyUnlockRequirement === 'object'
      ? record.academyUnlockRequirement
      : {}

  if (divisionOverrideActive(record)) {
    return { key: 'manual_override', badge: 'Admin Override' }
  }

  const track = String(
    record.applicationTrack || requirement.track || ''
  ).trim().toLowerCase()

  if (
    record.directStrategicApplicant === true ||
    track === 'direct_strategic'
  ) {
    return { key: 'direct_strategic', badge: 'Strategic Review' }
  }

  if (requirement.unlocked === false) {
    return { key: 'score_locked', badge: 'Score Locked' }
  }

  if (
    requirement.unlocked === true &&
    track === 'academy_progression'
  ) {
    return { key: 'eligible_by_score', badge: 'Eligible' }
  }

  if (track === 'academy_progression') {
    return { key: 'academy_progression', badge: 'Progression' }
  }

  if (track === 'approved') {
    return { key: 'approved', badge: 'Approved' }
  }

  return { key: 'not_set', badge: 'Not Set' }
}

export function Gate({ record }) {
  const requirement = record.academyUnlockRequirement || {}
  const signal = record.academySignalSnapshot || {}

  const score = Number(
    signal.readinessScore ??
    requirement.currentScore ??
    record.aiScore ??
    0
  ) || 0

  const target = Number(requirement.requiredScore || 0)

  return (
    <div className="application-gate-cell">
      <div>
        <Badge value={gateFor(record).badge} />
      </div>

      <div className="muted mono" style={{ marginTop: 6 }}>
        {score}{target ? ` / ${target}` : ''}
      </div>
    </div>
  )
}

function Answers({ items }) {
  return (
    <div className="answer-stack">
      {items.map(([label, value]) => (
        <div className="answer-card" key={label}>
          <span className="answer-label">{label}</span>
          <p>{asText(value)}</p>
        </div>
      ))}
    </div>
  )
}

function ReviewActions({ record, onReview, busy = false }) {
  const final = finalStatuses.has(
    String(record.status || '').trim().toLowerCase()
  )

  if (final) {
    return (
      <div className="table-actions application-finished-actions">
        <span className="admin-decision-final">
          {asText(record.status)} • Decision Finalized
        </span>
      </div>
    )
  }

  return (
    <div className="table-actions">
      {[
        ['approve', 'Approve'],
        ['reject', 'Reject'],
        ['waitlist', 'Waitlist']
      ].map(([decision, label]) => (
        <button
          type="button"
          key={decision}
          disabled={busy || (
            decision === 'waitlist' &&
            String(record.status || '').toLowerCase() === 'waitlisted'
          )}
          aria-busy={busy}
          onClick={() => onReview(record, decision)}
        >
          {busy ? 'Processing...' : label}
        </button>
      ))}
    </div>
  )
}

function ApplicationAcademySignal({ record }) {
  const signal = record.academySignalSnapshot || {}
  const gate = record.academyUnlockRequirement || {}

  const hasSignal =
    Object.keys(signal).length ||
    Object.keys(gate).length ||
    record.divisionOverride ||
    record.applicationTrack ||
    record.directStrategicApplicant === true

  if (!hasSignal) return null

  const track = String(
    record.applicationTrack || gate.track || ''
  ).trim().toLowerCase()

  const trackLabel =
    record.directStrategicApplicant === true ||
    track === 'direct_strategic'
      ? 'Direct Strategic Review'
      : track === 'academy_progression'
        ? 'Academy Progression'
        : track === 'approved'
          ? 'Approved Access'
          : track
            ? capWords(track.replaceAll('_', ' '))
            : 'Not Set'

  const score = Number(
    signal.readinessScore ?? gate.currentScore ?? 0
  ) || 0

  const required = Number(gate.requiredScore || 0)
  const completed = Number(signal.completedCount || 0)
  const total = Number(signal.totalCount || 0)

  const fields = [
    ['Track', trackLabel],
    ['Academy Score', required ? score + ' / ' + required : score],
    [
      'Unlock Status',
      gate.unlocked === true
        ? 'Unlocked'
        : gate.unlocked === false
          ? 'Locked'
          : 'Review Needed'
    ],
    ['Academy Status', signal.readinessStatus || gate.label],
    [
      'Roadmap Missions',
      total ? completed + ' / ' + total : completed
    ],
    ['Mission Execution Score', Number(signal.missionExecutionScore || 0)]
  ]

  return (
    <div className="drawer-section">
      <h4>Application Track & Academy Signal</h4>

      <div className="kv-grid application-kv-grid">
        {fields.map(([label, value]) => (
          <div className="kv" key={label}>
            <span>{label}</span>
            <strong>{asText(value)}</strong>
          </div>
        ))}
      </div>

      {gate.copy && <p className="muted">{gate.copy}</p>}
    </div>
  )
}

function ApplicationFederationDetails({ record }) {
  const isFederation =
    String(record.recommendedDivision || record.division || '')
      .trim().toLowerCase() === 'federation' ||
    String(record.applicationType || '')
      .toLowerCase().includes('federation')

  const map = record.federationProfileMap || {}
  const snapshot =
    record.strategicReadinessSnapshot ||
    record.federationStrategicSnapshot ||
    {}

  const profileScore = federationScore(record)

  const tier = String(
    record.federationTier ||
    map.tier ||
    map.federationTier ||
    (
      profileScore >= 90 ? 'CORE'
        : profileScore >= 70 ? 'OPERATOR'
          : profileScore >= 50 ? 'CONTRIBUTOR'
            : 'LOW_PRIORITY'
    )
  )

  const tierLabel = ({
    CORE: 'Core',
    OPERATOR: 'Operator',
    CONTRIBUTOR: 'Contributor',
    LOW_PRIORITY: 'Low Priority'
  })[tier] || tier

  const toValues = value => {
    const entries = (
      Array.isArray(value)
        ? value
        : String(value || '').split(/[,|\n]/)
    ).map(item => String(item || '').trim()).filter(Boolean)

    const seen = new Set()

    return entries.filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 32)
  }

  const profileFields = [
    ['Level', map.level || record.level],
    [
      'Primary Category',
      map.primaryCategory || record.primaryCategory || record.category
    ],
    ['Audience', map.audienceSize || record.audienceSize],
    ['Capital', map.capitalRange || record.capitalRange],
    ['Team', map.teamSize || record.teamSize],
    ['Skill Level', map.skillLevel || record.skillLevel]
  ]

  const profileAnswers = [
    [
      'Roles / Positions',
      toValues(
        map.roles || record.roles || record.roleTags ||
        record.currentPositions || record.currentPosition || record.role
      )
    ],
    ['Active Platforms', toValues(map.activePlatforms || record.activePlatforms)],
    ['Open To', toValues(map.openTo || record.openTo)],
    ['Federation Tags', toValues(map.tags || record.federationTags || record.tags)],
    [
      'Looking For',
      map.lookingFor || record.lookingFor ||
      record.whyJoin || record.wantedContactReason,
      'No answer submitted.'
    ],
    [
      'Can Offer',
      map.canOffer || record.canOffer ||
      record.valueBring || record.networkValue,
      'No answer submitted.'
    ],
    [
      'Wants Access To',
      map.wantsAccessTo || record.wantsAccessTo ||
      record.introductions || record.wantedContactTypesRaw,
      'No answer submitted.'
    ],
    [
      'Opportunity Insight',
      map.opportunityInsight || record.opportunityInsight,
      'No answer submitted.'
    ],
    [
      '10K People Plan',
      map.tenKPlan || record.tenKPlan,
      'No answer submitted.'
    ]
  ]

  const strategicScore = Number(
    snapshot.score ??
    snapshot.opportunityScore ??
    record.federationScore ??
    record.aiScore ??
    0
  ) || 0

  const strategicFields = [
    ['Readiness', snapshot.federationReadinessLabel || snapshot.label],
    ['Opportunity Stage', snapshot.opportunityStage],
    ['Connect Ready', snapshot.connectReady === true ? 'Yes' : 'No'],
    ['Trust', snapshot.trust],
    [
      'Region',
      snapshot.region || record.region ||
      [record.city, record.country].filter(Boolean).join(', ')
    ],
    ['Work Mode', snapshot.workMode]
  ]

  const strategicAnswers = [
    [
      'Snapshot Role',
      snapshot.role || record.role || record.profession,
      'No role carried over.'
    ],
    ['Snapshot Focus', snapshot.focus, 'No focus carried over.'],
    [
      'Snapshot Looking For',
      toValues(snapshot.lookingFor),
      'No looking-for signal carried over.'
    ],
    [
      'Snapshot Can Offer',
      toValues(snapshot.canOffer),
      'No can-offer signal carried over.'
    ],
    [
      'Snapshot Tags',
      toValues(snapshot.tags),
      'No strategic tags carried over.'
    ],
    [
      'Readiness Copy',
      snapshot.federationReadinessCopy ||
      snapshot.copy ||
      snapshot.opportunityCopy,
      'No strategic review copy available.'
    ]
  ]

  const strategicVisible =
    strategicScore > 0 ||
    snapshot.federationReadinessLabel ||
    snapshot.opportunityStage ||
    snapshot.role ||
    snapshot.focus

  const direct =
    record.directStrategicApplicant === true ||
    String(record.applicationTrack || '').trim().toLowerCase() ===
      'direct_strategic'

  const plazaProof = record.directStrategicProfile || {}
  const federationProof = record.directStrategicProof || {}

  const hasPlazaProof = Object.values(plazaProof)
    .some(value => String(value || '').trim())

  const hasFederationProof = Object.values(federationProof)
    .some(value => String(value || '').trim())

  const proofFields = [
    ...(hasPlazaProof ? [
      ['Strategic Role / Status', plazaProof.strategicRole],
      ['Strategic Proof', plazaProof.strategicProof],
      ['Audience / Network / Access', plazaProof.audienceOrNetwork],
      ['Capital / Deal Flow / Hiring Power', plazaProof.capitalOrAccess],
      ['Why High-Value', plazaProof.highValueReason]
    ] : []),
    ...(hasFederationProof ? [
      ['Authority Proof', federationProof.authorityProof],
      ['Proof Links / References', federationProof.proofLinks],
      ['Audience / Network Size', federationProof.networkSize],
      ['Capital / Deal / Hiring Access', federationProof.capitalAccess],
      ['Risk / Verification Note', federationProof.riskNote]
    ] : [])
  ]

  if (!isFederation && !(direct && proofFields.length)) {
    return null
  }

  const detailAnswers = rows => (
    <div className="answer-stack federation-map-stack">
      {rows.map(([label, value, empty = '—']) => (
        <div className="answer-card" key={label}>
          <span className="answer-label">{label}</span>

          {Array.isArray(value) ? (
            value.length ? (
              <div className="admin-chip-list">
                {value.map(item => <span key={item}>{item}</span>)}
              </div>
            ) : (
              <span className="muted">{empty}</span>
            )
          ) : (
            <p>{asText(value, empty)}</p>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {isFederation && (
        <div className="drawer-section federation-profile-map-section">
          <div className="federation-profile-map-head">
            <div>
              <h4>Federation Power Map</h4>
              <p className="muted">
                Internal profile map for score, tier, resources, intent, and matching.
              </p>
            </div>

            <div className="federation-score-lockup">
              <span>Score</span>
              <strong>{profileScore}</strong>
              <span className={
                'badge badge-' + (
                  tier === 'CORE' ? 'purple'
                    : tier === 'OPERATOR' ? 'green'
                      : tier === 'CONTRIBUTOR' ? 'blue'
                        : 'gray'
                )
              }>{tierLabel}</span>
            </div>
          </div>

          <div className="application-meta-grid federation-power-grid">
            {profileFields.map(([label, value]) => (
              <div className="application-meta-item" key={label}>
                <span>{label}</span>
                <strong>{asText(value)}</strong>
              </div>
            ))}
          </div>

          {detailAnswers(profileAnswers)}
        </div>
      )}

      {isFederation && strategicVisible && (
        <div className="drawer-section federation-profile-map-section">
          <div className="federation-profile-map-head">
            <div>
              <h4>Strategic Readiness Snapshot</h4>
              <p className="muted">
                This is the same ladder state sent from Plaza/Federation
                candidacy logic into admin review.
              </p>
            </div>

            <div className="federation-score-lockup">
              <span>Score</span>
              <strong>{strategicScore}</strong>
              <Badge value={
                snapshot.federationReadinessLabel || 'Plaza First'
              } />
            </div>
          </div>

          <div className="application-meta-grid federation-power-grid">
            {strategicFields.map(([label, value]) => (
              <div className="application-meta-item" key={label}>
                <span>{label}</span>
                <strong>{asText(value)}</strong>
              </div>
            ))}
          </div>

          {detailAnswers(strategicAnswers)}
        </div>
      )}

      {direct && proofFields.length > 0 && (
        <div className="drawer-section federation-profile-map-section">
          <h4>Direct Strategic Review Proof</h4>
          <p className="muted">
            Extra proof submitted because this applicant is applying
            outside the normal Academy progression ladder.
          </p>

          {detailAnswers(proofFields)}
        </div>
      )}
    </>
  )
}

function ApplicationDrawer({
  record,
  onClose,
  onReview,
  onManualUnlock,
  onRemoveUnlock,
  busy
}) {
  useEffect(() => {
    document.body.classList.add('drawer-open')

    const onKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('drawer-open')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const [copyFeedback, setCopyFeedback] = useState('')

  async function copyEmail() {
    const copied = await copyAdminText(record.email)

    setCopyFeedback(
      copied
        ? 'Email copied: ' + String(record.email || '').trim()
        : 'Failed to copy email.'
    )
  }

  const profile =
    record.academyProfile &&
    typeof record.academyProfile === 'object'
      ? record.academyProfile
      : null

  const notes = (
    Array.isArray(record.notes)
      ? record.notes
      : [record.notes]
  ).filter(Boolean)

  const skills = Array.isArray(profile?.topSkills)
    ? profile.topSkills
    : Array.isArray(record.skills)
      ? record.skills
      : []

  const city =
    record.cityOfResidence ||
    profile?.cityOfResidence ||
    ''

  const country =
    record.countryOfResidence ||
    profile?.countryOfResidence ||
    record.country ||
    ''

  const origin =
    record.countryOfOrigin ||
    profile?.countryOfOrigin ||
    ''

  const referredBy = String(
    record.referredByUsername ||
    profile?.referredByUsername ||
    ''
  ).replace(/^@+/, '')

  const identity = [
    ['Name', record.name],
    ['Username', record.username],
    ['Email', record.email],
    ['Age', record.age || profile?.age],
    ['Country of residence', country],
    ['City of residence', city],
    ['Country of origin', origin],
    [
      'Legacy combined location',
      record.locationCountry ||
      profile?.locationCountry ||
      [city, country].filter(Boolean).join(', ')
    ],
    ['Recommended Division', record.recommendedDivision || 'Academy'],
    ['Status', record.status || 'Under Review'],
    ['Application Type', capWords(record.applicationType)]
  ]

  return (
    <>
      <div
        className="drawer-backdrop show"
        onClick={onClose}
        role="presentation"
      />

      <aside
        className="detail-drawer open"
        role="dialog"
        aria-modal="true"
        aria-label="Application details"
      >
        <div className="drawer-head">
          <div className="drawer-head-main">
            <div className="drawer-head-copy">
              <p className="eyebrow">Application</p>
              <h3>{asText(record.name, asText(record.id))}</h3>
            </div>
          </div>

          <div className="drawer-head-actions">
            <Badge value={record.status || 'Under Review'} />

            <select
              aria-label="Quick Status"
              value=""
              disabled={
                busy ||
                finalStatuses.has(
                  String(record.status || '').trim().toLowerCase()
                )
              }
              onChange={event => {
                const decision = {
                  'approve-application': 'approve',
                  'reject-application': 'reject',
                  'waitlist-application': 'waitlist'
                }[event.target.value]

                if (decision) onReview(record, decision)
              }}
            >
              <option value="">
                {finalStatuses.has(
                  String(record.status || '').trim().toLowerCase()
                ) ? 'Decision Finalized' : 'Quick Status'}
              </option>

              {!finalStatuses.has(
                String(record.status || '').trim().toLowerCase()
              ) && (
                <>
                  <option value="approve-application">Set Approved</option>
                  <option value="reject-application">Set Rejected</option>
                  <option value="waitlist-application" disabled={String(record.status || '').toLowerCase() === 'waitlisted'}>Set Waitlisted</option>
                </>
              )}
            </select>

            {String(record.email || '').trim() && (
              <button type="button" onClick={copyEmail}>
                Copy Email
              </button>
            )}

            <button
              type="button"
              className="icon-btn"
              aria-label="Close application details"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {copyFeedback && <p role="status">{copyFeedback}</p>}
          <div className="drawer-section application-hero">
            <div className="application-kicker">
              Applicant Intake Reader
            </div>

            <h4>{asText(record.name, 'Unnamed Applicant')}</h4>

            <p className="application-subtitle">
              {asText(record.email, 'No email provided')}
            </p>

            <div className="application-badge-stack">
              <Badge value={record.status || 'Under Review'} />
              <Badge value={record.recommendedDivision || 'Academy'} />
            </div>

            <div className="application-meta-grid">
              {[
                ['Application ID', record.id],
                ['Type', capWords(record.applicationType)],
                ['Source', record.source || 'Unknown'],
                ['Submitted', record.submittedAt || 'Unknown'],
                ['Score / Tier', federationScore(record)],
                ['Country of residence', country],
                ['City of residence', city],
                ['Country of origin', origin]
              ].map(([label, value]) => (
                <div className="application-meta-item" key={label}>
                  <span>{label}</span>
                  <strong>{asText(value)}</strong>
                </div>
              ))}
            </div>
          </div>

          <ApplicationAcademySignal record={record} />
          <ApplicationFederationDetails record={record} />

          <div className="drawer-section">
            <h4>Identity & Routing</h4>

            <div className="kv-grid application-kv-grid">
              {identity.map(([label, value]) => (
                <div className="kv" key={label}>
                  <span>{label}</span>
                  <strong>{asText(value)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <h4>Main Form Answers</h4>

            <Answers items={[
              [
                'What do you do for a living at this age?',
                record.occupationAtAge ||
                profile?.occupationAtAge ||
                record.goal
              ],
              [
                'What are you good at? What are your skills?',
                profile?.skills || record.background
              ],
              [
                'Top Skills',
                skills.filter(Boolean).join(', ')
              ],
              [
                'How serious are you about being accepted?',
                record.seriousness || profile?.seriousness
              ],
              [
                'What is the one trait or standard that makes you a good fit?',
                record.nonNegotiable || profile?.nonNegotiable
              ]
            ]} />
          </div>

          <div className="drawer-section">
            <h4>Referral & Discovery</h4>

            <Answers items={[
              [
                'Who referred you?',
                referredBy ? `@${referredBy}` : '—'
              ],
              [
                'If no one referred you, how did you hear from us?',
                record.hearAboutUs || profile?.hearAboutUs
              ]
            ]} />
          </div>

          {profile && (
            <div className="drawer-section">
              <h4>Stored Academy Profile</h4>

              <div className="kv-grid application-kv-grid">
                {[
                  ['First Name', profile.firstName],
                  ['Surname', profile.surname],
                  ['Full Name', profile.fullName || record.name],
                  ['Email', profile.email || record.email],
                  ['Age', profile.age || record.age],
                  [
                    'Country of residence',
                    profile.countryOfResidence || country
                  ],
                  [
                    'City of residence',
                    profile.cityOfResidence || city
                  ],
                  [
                    'Country of origin',
                    profile.countryOfOrigin || origin
                  ]
                ].map(([label, value]) => (
                  <div className="kv" key={label}>
                    <span>{label}</span>
                    <strong>{asText(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overrideDivision(record) && (
            <div className="drawer-section">
              <div className="table-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onManualUnlock(record)}
                >
                  {divisionOverrideActive(record)
                    ? 'Update Manual Unlock'
                    : 'Manual Unlock'}
                </button>

                {divisionOverrideActive(record) && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveUnlock(record)}
                    >
                      Remove Unlock
                    </button>

                    <span className="admin-decision-final">
                      Admin Override Active
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="drawer-section">
            <h4>Internal Notes</h4>

            <div className="stack-list application-notes">
              {notes.length ? (
                notes.map((note, index) => (
                  <div className="stack-item" key={index}>
                    <p>{String(note)}</p>
                  </div>
                ))
              ) : (
                <div className="stack-item">
                  <p>No notes yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="drawer-section application-review-bar">
            <div className="application-review-copy">
              <div className="application-kicker">
                Decision Panel
              </div>

              <p>
                Review the full intake above, then take action on
                this application.
              </p>
            </div>

            <ReviewActions
              record={record}
              onReview={onReview}
              busy={busy}
            />
          </div>
        </div>
      </aside>
    </>
  )
}

export default function AdminApplicationsView({
  state,
  refresh,
  active = false,
  openApplicationRequest = null,
  globalSearch = ''
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [gateFilter, setGateFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [unverifiedIds, setUnverifiedIds] = useState([])
  const [message, setMessage] = useState('')
  const [manualUnlockId, setManualUnlockId] = useState('')
  const [manualUnlockError, setManualUnlockError] = useState('')

  const applications = Array.isArray(state?.applications)
    ? state.applications
    : []

  const rows = useMemo(() => applications.filter(app =>
    (statusFilter === 'all' || app.status === statusFilter) &&
    (
      divisionFilter === 'all' ||
      (app.recommendedDivision || app.division || 'Academy') ===
      divisionFilter
    ) &&
    (
      gateFilter === 'all' ||
      gateFor(app).key === gateFilter
    ) &&
    (
      !globalSearch.trim() ||
      JSON.stringify(app)
        .toLowerCase()
        .includes(globalSearch.trim().toLowerCase())
    )
  ), [
    applications,
    statusFilter,
    divisionFilter,
    gateFilter,
    globalSearch
  ])

  const selected = applications.find(
    app => String(app.id) === selectedId
  )

  const manualUnlockRecord = applications.find(
    app => String(app.id) === manualUnlockId
  )

  useEffect(() => {
    if (openApplicationRequest?.id) {
      setSelectedId(String(openApplicationRequest.id))
    }
  }, [openApplicationRequest])

  useEffect(() => {
    if (!selected && selectedId) {
      setSelectedId('')
    }
  }, [selected, selectedId])

  async function saveManualUnlock(record, input) {
    const id = String(record?.id || '').trim()
    const division = String(input.division || '').trim().toLowerCase()

    if (!id || pendingId || unverifiedIds.includes(id)) return

    if (!overrideDivision(record) ||
        !['plaza', 'federation'].includes(division)) {
      setManualUnlockError('Division must be plaza or federation.')
      return
    }

    setPendingId(id)
    setManualUnlockError('')
    setMessage('')

    let accepted = false

    try {
      const result = await adminFetchJson(
        '/api/admin/applications/' +
          encodeURIComponent(id) +
          '/division-override',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            division,
            unlocked: input.unlocked === true,
            reason: String(input.reason || '').trim(),
            expiresAt: String(input.expiresAt || '').trim()
          })
        }
      )

      accepted = true

      const live = await getAdminBootstrap()
      const updated = (
        Array.isArray(live.state.applications)
          ? live.state.applications
          : []
      ).find(item => String(item.id) === id)

      const verified = currentDivisionOverride(updated || {})

      refresh()

      if (
        result.override?.unlocked !== (input.unlocked === true) ||
        verified?.unlocked !== (input.unlocked === true) ||
        verified?.division !== division
      ) {
        setUnverifiedIds(old => [...new Set([...old, id])])

        const warning =
          'Backend accepted the manual unlock change, but refreshed data could not verify it. Inspect the original Admin Panel before retrying.'

        setManualUnlockError(warning)
        setMessage(warning)
        return
      }

      setManualUnlockId('')

      setMessage(
        input.unlocked === true
          ? 'Manual application unlock saved.'
          : 'Manual application unlock removed.'
      )
    } catch (error) {
      if (error?.status !== 423) {
        setUnverifiedIds(old => [...new Set([...old, id])])
      }

      const warning =
        error?.status === 423
          ? error.message
          : accepted
            ? 'Backend accepted the manual unlock change, but verification failed. Inspect the original Admin Panel before retrying.'
            : (error?.message || 'Failed to save manual unlock.')

      setManualUnlockError(warning)
      setMessage(warning)
    } finally {
      setPendingId('')
    }
  }

  function removeManualUnlock(record) {
    if (!window.confirm('Remove this manual unlock override?')) {
      return
    }

    saveManualUnlock(record, {
      division: overrideDivision(record),
      unlocked: false,
      reason: 'Manual unlock removed by admin.'
    })
  }

  async function review(record, decision) {
    const id = String(record?.id || '').trim()

    if (
      !id ||
      pendingId ||
      unverifiedIds.includes(id) ||
      finalStatuses.has(
        String(record.status || '').trim().toLowerCase()
      )
    ) {
      return
    }

    setPendingId(id)
    setMessage('')

    let accepted = false

    try {
      const response = await adminFetchJson(
        `/api/admin/applications/${encodeURIComponent(id)}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ decision })
        }
      )

      accepted = true

      const expected = {
        approve: 'approved',
        reject: 'rejected',
        waitlist: 'waitlisted'
      }[decision]

      const live = await getAdminBootstrap()

      const updated = (
        Array.isArray(live.state.applications)
          ? live.state.applications
          : []
      ).find(app =>
        String(app.id || '').trim() === id
      )

      refresh()

      if (
        !updated ||
        String(updated.status || '')
          .trim()
          .toLowerCase() !== expected
      ) {
        setUnverifiedIds(current => [
          ...new Set([...current, id])
        ])

        setMessage(
          'Backend review responded successfully, but the refreshed application status could not be verified. Reload and inspect before taking another action.'
        )
        return
      }

      setMessage(
        decision === 'approve'
          ? response.approvalEmailSent
            ? 'Application approved. Approval email sent.'
            : response.approvalEmailError
              ? `Application approved. Email not sent: ${response.approvalEmailError}`
              : 'Application approved.'
          : decision === 'reject'
            ? 'Application rejected.'
            : 'Application waitlisted.'
      )
    } catch (error) {
      if (error?.status !== 423) {
        setUnverifiedIds(current => [
          ...new Set([...current, id])
        ])
      }

      setMessage(
        error?.status === 423
          ? error.message
          : error?.status === 401
            ? 'Admin session expired. Please sign in again.'
            : accepted
              ? 'Backend accepted review but verification failed. Reload and inspect before retrying.'
              : `${error?.message || 'Review failed.'} Verify the record status before attempting the action again.`
      )
    } finally {
      setPendingId('')
    }
  }

  return (
    <section
      className={`view view-applications${active ? ' active' : ''}`}
      id="view-applications"
      data-app-active={active ? '' : undefined}
    >
      <div className="panel-card">
        <div className="panel-head wrap-head">
          <div>
            <p className="eyebrow">Intake Engine</p>
            <h3>Applications Queue</h3>
          </div>

          <div className="toolbar">
            <AdminFilterMenu>
            <select
              id="applications-status-filter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            >
              {[
                'All Statuses',
                'New',
                'Under Review',
                'Approved',
                'Rejected',
                'Waitlisted'
              ].map((label, index) => (
                <option
                  key={label}
                  value={index ? label : 'all'}
                >
                  {label}
                </option>
              ))}
            </select>

            <select
              id="applications-division-filter"
              value={divisionFilter}
              onChange={event => setDivisionFilter(event.target.value)}
            >
              {[
                'All Divisions',
                'Academy',
                'Federation',
                'Plazas'
              ].map((label, index) => (
                <option
                  key={label}
                  value={index ? label : 'all'}
                >
                  {label}
                </option>
              ))}
            </select>

            <select
              id="applications-gate-filter"
              value={gateFilter}
              onChange={event => setGateFilter(event.target.value)}
            >
              {[
                ['all', 'All Gate States'],
                ['manual_override', 'Manual Override Active'],
                ['score_locked', 'Score Locked'],
                ['direct_strategic', 'Direct Strategic'],
                ['academy_progression', 'Academy Progression'],
                ['eligible_by_score', 'Eligible by Score']
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
                      </AdminFilterMenu>
          </div>
        </div>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  'Name',
                  'Email',
                  'Type',
                  'Source',
                  'Goal / Background',
                  'Recommended',
                  'Status',
                  'Score / Gate',
                  'Actions'
                ].map(label => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>

            <tbody id="applications-table">
              {rows.length ? (
                rows.map((app, index) => (
                  <tr key={app.id || index}>
                    <td data-label="Name">
                      <strong>
                        {asText(app.name, 'Applicant')}
                      </strong>

                      <div className="muted mono">
                        {asText(app.id)}
                      </div>
                    </td>

                    <td data-label="Email">
                      {asText(app.email)}
                    </td>

                    <td data-label="Type">
                      <Badge
                        value={capWords(app.applicationType)}
                      />
                    </td>

                    <td data-label="Source">
                      {asText(app.source, 'Unknown')}
                    </td>

                    <td data-label="Goal / Background">
                      <div className="app-preview">
                        <div className="app-preview-line">
                          <span>Goal</span>
                          <p>
                            {asText(
                              app.goal,
                              'No goal submitted.'
                            )}
                          </p>
                        </div>

                        <div className="app-preview-line">
                          <span>Background</span>
                          <p>
                            {asText(
                              app.background,
                              'No background submitted.'
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td data-label="Recommended">
                      <Badge
                        value={
                          app.recommendedDivision ||
                          'Academy'
                        }
                      />
                    </td>

                    <td data-label="Status">
                      <Badge
                        value={
                          app.status ||
                          'Under Review'
                        }
                      />
                    </td>

                    <td data-label="Score / Gate">
                      <Gate record={app} />
                    </td>

                    <td data-label="Actions">
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId(String(app.id || ''))
                          }
                        >
                          View Form
                        </button>

                        <ReviewActions
                          record={app}
                          onReview={review}
                          busy={
                            pendingId === String(app.id) ||
                            unverifiedIds.includes(
                              String(app.id)
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="muted">
                    No applications match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && active && (
        <ApplicationDrawer
          record={selected}
          onClose={() => setSelectedId('')}
          onReview={review}
          onManualUnlock={record => {
            setManualUnlockError('')
            setManualUnlockId(String(record.id))
          }}
          onRemoveUnlock={removeManualUnlock}
          busy={
            pendingId === String(selected.id) ||
            unverifiedIds.includes(
              String(selected.id)
            )
          }
        />
      )}

      {manualUnlockRecord && active && (
        <AdminActionModal
          key={manualUnlockId}
          title="Manual Division Unlock"
          description="Unlock this application gate even if the Academy score requirement has not been reached."
          submitLabel="Save Unlock"
          busy={pendingId === manualUnlockId}
          error={manualUnlockError}
          onCancel={() => {
            if (!pendingId) {
              setManualUnlockId('')
              setManualUnlockError('')
            }
          }}
          fields={[
            {
              name: 'division',
              label: 'Division',
              value: overrideDivision(manualUnlockRecord),
              required: true
            },
            {
              name: 'adminNote',
              label: 'Override Reason',
              type: 'textarea',
              rows: 5,
              value: 'Manual admin unlock for strategic review.',
              required: true
            },
            {
              name: 'expiresAt',
              label: 'Expiry ISO Date — optional',
              placeholder: 'Example: 2026-12-31T23:59:59.000Z',
              value: ''
            }
          ]}
          onSubmit={values => saveManualUnlock(
            manualUnlockRecord,
            {
              division: values.division,
              unlocked: true,
              reason: values.adminNote,
              expiresAt: values.expiresAt
            }
          )}
        />
      )}
    </section>
  )
}
