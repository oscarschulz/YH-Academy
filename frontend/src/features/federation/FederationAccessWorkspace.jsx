import FederationBadgePaymentCard from './FederationBadgePaymentCard'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationAccessWorkspace.css'

const ROLE_OPTIONS = [
  'Founder',
  'Business Owner',
  'Investor',
  'Lawyer',
  'Legal Strategist',
  'Politician',
  'Policy Advisor',
  'Influencer',
  'Media Operator',
  'Developer',
  'AI Specialist',
  'Cybersecurity Expert',
  'Sales Operator',
  'Real Estate Operator',
  'Doctor',
  'Engineer',
  'Athlete',
  'High-Level Connector',
]

const PLATFORM_OPTIONS = [
  'LinkedIn',
  'X / Twitter',
  'Instagram',
  'TikTok',
  'YouTube',
  'Telegram',
  'Discord',
  'WhatsApp',
  'Private Network',
]

const OPEN_TO_OPTIONS = [
  'Networking',
  'Partnerships',
  'Investments',
  'Introductions',
  'Mentorship',
  'Deal Flow',
  'Hiring / Recruiting',
  'Private Opportunities',
  'All of the above',
]

const STATUS_STEPS = [
  'Pending',
  'Under Review',
  'Screening',
  'Shortlisted',
  'Approved',
]

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  telegram: '',
  country: '',
  city: '',

  primaryCategory: '',
  roles: [],
  level: '',
  company: '',
  experience: '',

  audienceSize: '',
  activePlatforms: [],
  capitalRange: '',
  teamSize: '',
  skillLevel: '',

  lookingFor: '',
  canOffer: '',
  wantsAccessTo: '',
  openTo: [],

  opportunityInsight: '',
  tenKPlan: '',
  openToFeature: '',

  linkedin: '',
  website: '',
  twitter: '',
  referralCode: '',
  referredBy: '',
  source: '',

  declaration: false,
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function normalizeStatus(value = '') {
  return clean(value) || 'Not Submitted'
}

function normalizedStatusKey(value = '') {
  return clean(value).toLowerCase()
}

function canReapply(status = '') {
  return [
    'rejected',
    'declined',
    'denied',
  ].includes(
    normalizedStatusKey(status),
  )
}

function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(value) ||
      'Not available'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function toggleArrayValue(
  values,
  value,
) {
  const current =
    safeArray(values)

  return current.includes(value)
    ? current.filter(
        (item) =>
          item !== value,
      )
    : [
        ...current,
        value,
      ]
}

function statusClass(
  status,
  step,
  index,
) {
  const current =
    normalizeStatus(status)

  if (
    current ===
    'Rejected'
  ) {
    return index === 0
      ? 'is-complete'
      : ''
  }

  const activeIndex =
    STATUS_STEPS.indexOf(
      current,
    )

  if (
    activeIndex === -1
  ) {
    return step ===
      'Pending'
      ? 'is-current'
      : ''
  }

  if (index < activeIndex) {
    return 'is-complete'
  }

  if (index === activeIndex) {
    return 'is-current'
  }

  return ''
}

function readFederationJsonCache(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function getFederationLadderOutcomeSnapshot() {
  return readFederationJsonCache("yh_federation_ladder_outcome_v1", {}) || {};
}

export function getFederationStrategicReadinessState() {
  const plazaSnapshot = readFederationJsonCache("yh_plaza_access_status_v1", {}) || {};
  const federationSnapshot = readFederationJsonCache("yh_federation_access_status_v1", {}) || {};
  const directorySnapshot = readFederationJsonCache("yhPlazaDirectoryStatusV1", {}) || {};
  const ladderOutcome = getFederationLadderOutcomeSnapshot();

  const plazaApproved =
    plazaSnapshot?.canEnterPlaza === true ||
    String(plazaSnapshot?.applicationStatus || "").trim().toLowerCase() === "approved";

  const federationStatus = String(
    federationSnapshot?.applicationStatus ||
    ladderOutcome?.status ||
    ""
  ).trim().toLowerCase();

  const federationApproved =
    federationSnapshot?.canEnterFederation === true ||
    federationStatus === "approved";

  const score = Number(directorySnapshot?.opportunityScore || ladderOutcome?.score || 0);
  const stage = String(directorySnapshot?.opportunityStage || "").trim();

  if (!plazaApproved) {
    return {
      score: 0,
      label: "Plaza First",
      connectLabel: "Locked",
      copy: "Federation candidacy starts after Plaza approval and signal-building inside Plaza.",
      connectReady: false
    };
  }

  if (!directorySnapshot || directorySnapshot.seeded !== true) {
    return {
      score: 0,
      label: "Seed Plaza Profile",
      connectLabel: "Locked",
      copy: "Seed your Plaza profile first so the Federation layer can evaluate your signal.",
      connectReady: false
    };
  }

  if (federationStatus === "rejected") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Review Rejected",
      connectLabel: "Locked",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application was not approved in this cycle. Build stronger Plaza outcomes, trust, and leverage before reapplying."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "waitlisted") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Waitlisted",
      connectLabel: "Build More Signal",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application has been waitlisted. Strengthen your Plaza signal and strategic proof before the next review cycle."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "shortlisted") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Shortlisted",
      connectLabel: "Near Final Review",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application has reached shortlist status. You are near final review, but access is not unlocked yet."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "under review" || federationStatus === "screening") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: federationStatus === "screening" ? "In Screening" : "In Federation Review",
      connectLabel: "Locked",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application is currently in review. Admin is evaluating your candidacy against trust, leverage, and strategic value."
      ).trim(),
      connectReady: false
    };
  }

  if (federationApproved) {
    if (stage === "Ready for Strategic Escalation" || score >= 85) {
      return {
        score,
        label: "Inside Federation",
        connectLabel: "Ready",
        copy: "Your Plaza layer is strong enough for strategic routing and higher-trust Connect readiness.",
        connectReady: true
      };
    }

    if (stage === "Ready for Matching" || score >= 65) {
      return {
        score,
        label: "Inside Federation",
        connectLabel: "Ready",
        copy: "Your Plaza layer is strong enough for qualified Connect activity.",
        connectReady: true
      };
    }

    return {
      score,
      label: "Inside Federation",
      connectLabel: "Build More Signal",
      copy: "You are already inside Federation, but your Plaza layer still needs stronger signal for higher-trust Connect positioning.",
      connectReady: false
    };
  }

  if (stage === "Ready for Strategic Escalation" || score >= 85) {
    return {
      score,
      label: "Strategic Candidate",
      connectLabel: "Ready",
      copy: "Your Plaza opportunity score is strong enough to support serious Federation candidacy and high-trust Connect readiness.",
      connectReady: true
    };
  }

  if (stage === "Ready for Matching" || score >= 65) {
    return {
      score,
      label: "Ready for Review",
      connectLabel: "Ready",
      copy: "Your Plaza layer is strong enough for Federation review and qualified Connect readiness.",
      connectReady: true
    };
  }

  if (stage === "Active" || score >= 40) {
    return {
      score,
      label: "Emerging Candidate",
      connectLabel: "Build More Signal",
      copy: "Your Plaza layer is active, but it still needs stronger outcomes and trust before serious Federation candidacy.",
      connectReady: false
    };
  }

  return {
    score,
    label: "Weak Candidate",
    connectLabel: "Locked",
    copy: "Build a stronger Plaza opportunity score before pushing toward Federation candidacy.",
    connectReady: false
  };
}

function getFederationTierFromScore(score = 0) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  if (safeScore >= 90) return "CORE";
  if (safeScore >= 70) return "OPERATOR";
  if (safeScore >= 50) return "CONTRIBUTOR";

  return "LOW_PRIORITY";
}

function getFederationApplicationStrategicSnapshot() {
  const directorySnapshot = readFederationJsonCache("yhPlazaDirectoryStatusV1", {}) || {};
  const readiness = getFederationStrategicReadinessState();

  const tags = Array.isArray(directorySnapshot?.tags)
    ? directorySnapshot.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const lookingFor = Array.isArray(directorySnapshot?.lookingFor)
    ? directorySnapshot.lookingFor.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const canOffer = Array.isArray(directorySnapshot?.canOffer)
    ? directorySnapshot.canOffer.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const score = Number(readiness?.score || directorySnapshot?.opportunityScore || 0);

  return {
    score,
    tier: getFederationTierFromScore(score),

    plazaProfileStatus: directorySnapshot?.seeded === true ? "Seeded" : "Locked",
    opportunityStage: String(directorySnapshot?.opportunityStage || "").trim() || "Locked",
    opportunityCopy: String(directorySnapshot?.opportunityCopy || "").trim(),
    federationReadinessLabel: String(readiness?.label || "Plaza First").trim() || "Plaza First",
    federationReadinessCopy: String(readiness?.copy || "").trim(),
    connectReady: readiness?.connectReady === true,

    role: String(directorySnapshot?.role || "").trim(),
    focus: String(directorySnapshot?.focus || "").trim(),
    trust: String(directorySnapshot?.trust || "").trim(),
    region: String(directorySnapshot?.region || "").trim(),
    availability: String(directorySnapshot?.availability || "").trim(),
    workMode: String(directorySnapshot?.workMode || "").trim(),
    marketplaceMode: directorySnapshot?.marketplaceMode === true,

    tags,
    lookingFor,
    canOffer,
    lookingForText: lookingFor.join(", "),
    canOfferText: canOffer.join(", ")
  };
}

export default function FederationAccessWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
  onWorkspaceOpen,
}) {
  const [
    me,
    setMe,
  ] = useState(null)

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
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
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const loadAccess =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const result =
            await apiFetch(
              '/api/federation/me',
              {
                method: 'GET',
                cache: 'no-store',
              },
            )

          setMe(
            result || {},
          )

          setForm(
            (current) => ({
              ...current,

              fullName:
                current.fullName ||
                clean(
                  result?.currentUser
                    ?.name ||
                    result?.member
                      ?.name ||
                    result
                      ?.application
                      ?.fullName,
                ),

              email:
                current.email ||
                clean(
                  result?.currentUser
                    ?.email ||
                    result
                      ?.application
                      ?.email,
                ),

              country:
                current.country ||
                clean(
                  result?.member
                    ?.country ||
                    result
                      ?.application
                      ?.country,
                ),

              city:
                current.city ||
                clean(
                  result?.member
                    ?.city ||
                    result
                      ?.application
                      ?.city,
                ),
            }),
          )
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Federation access state.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadAccess(refreshVersion > 0)
  }, [loadAccess, refreshVersion])

  useEffect(() => {
    try {
      const params =
        new URLSearchParams(
          window.location.search,
        )

      const ref =
        clean(
          params.get('ref'),
        ).toUpperCase()

      if (ref) {
        setForm(
          (current) => ({
            ...current,

            referralCode:
              current.referralCode ||
              ref,
          }),
        )
      }
    } catch {}
  }, [])

  const application =
    me?.application &&
    typeof me.application ===
      'object'
      ? me.application
      : null

  const status =
    normalizeStatus(
      me?.applicationStatus ||
        application?.status,
    )

  const approved =
    me?.canEnterFederation ===
      true ||
    normalizedStatusKey(
      status,
    ) === 'approved'

  const hasApplication =
    Boolean(
      application?.id ||
        (
          status &&
          status !==
            'Not Submitted'
        ),
    )

  const mayApply =
    !approved &&
    (
      !hasApplication ||
      canReapply(
        status,
      )
    )

  const selectedRole =
    form.roles[0] ||
    'Federation Operator'

  const completion =
    useMemo(() => {
      const required = [
        form.fullName,
        form.email,
        form.country,
        form.city,
        form.primaryCategory,
        form.roles.length
          ? 'yes'
          : '',
        form.level,
        form.lookingFor,
        form.canOffer,
        form.openTo.length
          ? 'yes'
          : '',
        form.opportunityInsight,
        form.tenKPlan,
        form.declaration
          ? 'yes'
          : '',
      ]

      return Math.round(
        (
          required.filter(
            Boolean,
          ).length /
          required.length
        ) *
          100,
      )
    }, [form])

  const updateField =
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

  const toggleField =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,

          [field]:
            toggleArrayValue(
              current[field],
              value,
            ),
        }),
      )
    }

  const validate =
    () => {
      if (
        !clean(
          form.fullName,
        ) ||
        !clean(
          form.email,
        ) ||
        !clean(
          form.country,
        ) ||
        !clean(
          form.city,
        ) ||
        !clean(
          form.primaryCategory,
        ) ||
        !form.roles.length ||
        !clean(
          form.level,
        )
      ) {
        return 'Please complete all required Federation application fields.'
      }

      if (
        !clean(
          form.lookingFor,
        )
      ) {
        return 'Explain what you are looking for inside the Federation.'
      }

      if (
        !clean(
          form.canOffer,
        )
      ) {
        return 'Explain what you can offer the Federation network.'
      }

      if (
        !form.openTo.length
      ) {
        return 'Select at least one Federation opportunity you are open to.'
      }

      if (
        !clean(
          form.opportunityInsight,
        )
      ) {
        return 'Add your major opportunity insight.'
      }

      if (
        !clean(
          form.tenKPlan,
        )
      ) {
        return 'Explain what you would build with access to 10,000 high-value people.'
      }

      if (
        !form.declaration
      ) {
        return 'Confirm the Federation application declaration first.'
      }

      return ''
    }

  const submitApplication =
    async (event) => {
      event.preventDefault()

      if (
        submitting ||
        !mayApply
      ) {
        return
      }

      const validation =
        validate()

      if (validation) {
        onToast?.(
          validation,
          'error',
        )
        return
      }

      const profileLink =
        clean(
          form.linkedin ||
            form.website ||
            form.twitter,
        )

      const strategicReadinessSnapshot = getFederationApplicationStrategicSnapshot()
      const payload = {
        contactTypesCanProvideRaw: clean(form.canOffer),
        aiScore: strategicReadinessSnapshot.score,
        strategicReadinessSnapshot,
        fullName:
          clean(
            form.fullName,
          ),

        email:
          clean(
            form.email,
          ),

        phone:
          clean(
            form.phone,
          ),

        telegram:
          clean(
            form.telegram,
          ),

        country:
          clean(
            form.country,
          ),

        city:
          clean(
            form.city,
          ),

        primaryCategory:
          clean(
            form.primaryCategory,
          ),

        roles:
          form.roles,

        role:
          selectedRole,

        profession:
          selectedRole,

        level:
          clean(
            form.level,
          ),

        company:
          clean(
            form.company,
          ),

        experience:
          clean(
            form.experience,
          ),

        audienceSize:
          clean(
            form.audienceSize,
          ),

        activePlatforms:
          form.activePlatforms,

        capitalRange:
          clean(
            form.capitalRange,
          ),

        teamSize:
          clean(
            form.teamSize,
          ),

        skillLevel:
          clean(
            form.skillLevel,
          ),

        lookingFor:
          clean(
            form.lookingFor,
          ),

        canOffer:
          clean(
            form.canOffer,
          ),

        wantsAccessTo:
          clean(
            form.wantsAccessTo,
          ),

        openTo:
          form.openTo,

        opportunityInsight:
          clean(
            form.opportunityInsight,
          ),

        tenKPlan:
          clean(
            form.tenKPlan,
          ),

        openToFeature:
          clean(
            form.openToFeature,
          ),

        linkedin:
          clean(
            form.linkedin,
          ),

        website:
          clean(
            form.website,
          ),

        twitter:
          clean(
            form.twitter,
          ),

        profileLink,

        referralCode:
          clean(
            form.referralCode,
          ).toUpperCase(),

        referralCodeUsed:
          clean(
            form.referralCode,
          ).toUpperCase(),

        referredBy:
          clean(
            form.referredBy,
          ),

        source:
          clean(
            form.source,
          ) ||
          'Dashboard Federation Application',

        whyJoin:
          clean(
            form.lookingFor,
          ),

        valueBring:
          clean(
            form.canOffer,
          ),

        networkValue:
          clean(
            form.canOffer,
          ),

        accessContribution:
          clean(
            form.canOffer,
          ),

        introductions:
          clean(
            form.wantsAccessTo,
          ),

        wantedContactReason:
          clean(
            form.lookingFor,
          ),

        wantedContactTypesRaw:
          clean(
            form.wantsAccessTo,
          ),

        openToAdminMatching:
          form.openTo.length
            ? 'yes'
            : 'limited',
      }

      setSubmitting(true)

      try {
        const result =
          await apiFetch(
            '/api/federation/application',
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
          !result?.application
        ) {
          throw new Error(
            'Federation application response was incomplete.',
          )
        }

        onDataChanged?.()
        onToast?.(
          result.alreadySubmitted
            ? 'Your existing Federation application is already in the review pipeline.'
            : 'Application received. Your Federation profile has been added to the review pipeline.',
          'success',
        )

        await loadAccess(
          true,
        )
      } catch (
        submitError
      ) {
        onToast?.(
          submitError?.message ||
            'Something went wrong while saving your Federation application.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    }

  const readiness = getFederationStrategicReadinessState()
  const accessMember = me?.member || {}
  const accessReferrals = me?.referrals || {}

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-access-react-workspace">
        <div className="yh-federation-access-state">
          Loading Federation
          access...
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-access-react-workspace"
      data-yh-dashboard-react-surface="federation-access"
    >
      <div className="yh-federation-access-scroll">
        <div className="yh-federation-access-shell">
          <header className="yh-federation-access-hero">
            <div>
              <span className="yh-federation-access-kicker">
                Federation /
                Access
              </span>

              <h1>
                Federation Access
              </h1>

              <p>
                Federation access
                is reviewed around
                profile quality,
                category
                relevance, trust,
                leverage,
                regional
                importance, and
                strategic fit.
              </p>
            </div>

            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadAccess(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          {error && (
            <div className="yh-federation-access-state is-error">
              {error}
            </div>
          )}

          <section className="yh-federation-access-status-card">
            <div className="yh-federation-access-status-head">
              <div>
                <span className="yh-federation-access-kicker">
                  Current Access
                  State
                </span>

                <h2>
                  {approved
                    ? 'Federation Member'
                    : hasApplication
                      ? status
                      : 'Not Applied'}
                </h2>
              </div>

              <span
                className={
                  approved
                    ? 'is-approved'
                    : canReapply(
                          status,
                        )
                      ? 'is-rejected'
                      : 'is-pending'
                }
              >
                {approved
                  ? 'Approved'
                  : hasApplication
                    ? status
                    : 'Visitor'}
              </span>
            </div>

            {approved ? (
              <>
                <div className="yh-federation-access-member-grid">
                  <div className="yh-federation-access-member-info">
                    <h3>{clean(accessMember.name || me?.currentUser?.name)}</h3>
                    <p>
                      {[accessMember.category, accessMember.country, accessMember.city, accessMember.badge || 'Approved'].filter(Boolean).join(' · ')}
                    </p>
                    <div className="yh-federation-access-existing-grid">
                      {[
                        ['Role', accessMember.role],
                        ['Organization', accessMember.company || 'Independent'],
                        ['Approved', accessMember.approvedAt ? new Date(accessMember.approvedAt).toLocaleDateString() : 'N/A'],
                        ['Member code', accessMember.referralCode || 'N/A'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <small>{label}</small>
                          <strong>{clean(value) || 'N/A'}</strong>
                        </div>
                      ))}
                    </div>
                    <p>
                      Referral pipeline: {Number(accessReferrals.total || 0)} total, {Number(accessReferrals.pending || 0)} in review, {Number(accessReferrals.approved || 0)} approved.
                    </p>
                    <p>
                  Your Federation
                  access is active.
                  Command,
                  Connect,
                  Directory,
                  Requests,
                  Referrals and
                  Deal Rooms are
                  available based
                  on their existing
                  server
                  permissions.
                </p>

                <div className="yh-federation-access-actions">
                  <button
                    type="button"
                    className="yh-fed-action yh-fed-action-primary"
                    onClick={() =>
                      onWorkspaceOpen?.(
                        'federation-command',
                      )
                    }
                  >
                    Open Command
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
                    Open Connect
                  </button>
                </div>
                  </div>
                  <FederationBadgePaymentCard
                    member={me}
                    onToast={onToast}
                    onDataChanged={onDataChanged}
                  />
                </div>
              </>
            ) : hasApplication ? (
              <>
                <p>
                  {canReapply(
                    status,
                  )
                    ? 'Your previous Federation application was not approved. You may submit a fresh profile below for another review cycle.'
                    : 'Your Federation application is already in the review pipeline. Submission does not guarantee approval.'}
                </p>

                {!canReapply(
                  status,
                ) && (
                  <div className="yh-federation-access-timeline">
                    {STATUS_STEPS.map(
                      (
                        step,
                        index,
                      ) => (
                        <article
                          key={
                            step
                          }
                          className={
                            statusClass(
                              status,
                              step,
                              index,
                            )
                          }
                        >
                          <b>
                            {String(
                              index +
                                1,
                            ).padStart(
                              2,
                              '0',
                            )}
                          </b>

                          <strong>
                            {step}
                          </strong>
                        </article>
                      ),
                    )}
                  </div>
                )}

                <h3>{clean(application?.fullName || application?.name)}</h3>
                <div className="yh-federation-access-existing-grid">
                  {[
                    ['Email', application?.email],
                    ['City', application?.city],
                    ['Role', application?.role],
                    ['Organization', application?.company || 'Independent'],
                    ['Referral', application?.referredBy || 'Direct'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <small>{label}</small>
                      <strong>{clean(value) || 'N/A'}</strong>
                    </div>
                  ))}
                </div>
                <div className="yh-federation-access-existing-grid">
                  <div>
                    <small>
                      Submitted
                    </small>

                    <strong>
                      {formatDate(
                        application
                          ?.submittedAt ||
                          application
                            ?.createdAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Category
                    </small>

                    <strong>
                      {clean(
                        application
                          ?.primaryCategory,
                      ) ||
                        'Not available'}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Country
                    </small>

                    <strong>
                      {clean(
                        application
                          ?.country,
                      ) ||
                        'Not available'}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Review State
                    </small>

                    <strong>
                      {status}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <p>
                You have not
                submitted a
                Federation
                application yet.
                Complete the
                profile below to
                enter the review
                pipeline.
              </p>
            )}
          </section>

          <p role="status">
            Strategic readiness: {readiness.label}.{readiness.score > 0 ? ' Score ' + readiness.score + '.' : ''} {readiness.copy}
          </p>

          {mayApply && (
            <form
              className="yh-federation-access-form"
              onSubmit={
                submitApplication
              }
            >
              <div className="yh-federation-access-form-head">
                <div>
                  <span className="yh-federation-access-kicker">
                    Request Access
                  </span>

                  <h2>
                    Submit
                    Federation
                    Profile
                  </h2>

                  <p>
                    Every
                    application is
                    reviewed.
                    Submission does
                    not guarantee
                    approval.
                  </p>
                </div>

                <div className="yh-federation-access-completion">
                  <strong>
                    {
                      completion
                    }%
                  </strong>

                  <span>
                    required fields
                    complete
                  </span>
                </div>
              </div>

              <div className="yh-federation-access-section-title">
                Personal Details
              </div>

              <div className="yh-federation-access-form-grid">
                <label>
                  <span>
                    Full Name
                  </span>

                  <input
                    className="input-field"
                    required
                    value={
                      form.fullName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'fullName',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Email Address
                  </span>

                  <input
                    className="input-field"
                    type="email"
                    required
                    value={
                      form.email
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'email',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Phone Number
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.phone
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'phone',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Telegram
                    Username
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.telegram
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'telegram',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Country
                  </span>

                  <input
                    className="input-field"
                    required
                    value={
                      form.country
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'country',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    City
                  </span>

                  <input
                    className="input-field"
                    required
                    value={
                      form.city
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'city',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="yh-federation-access-section-title">
                Professional
                Identity
              </div>

              <div className="yh-federation-access-form-grid">
                <label>
                  <span>
                    Primary Category
                  </span>

                  <select
                    className="input-field"
                    required
                    value={
                      form.primaryCategory
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'primaryCategory',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select category
                    </option>

                    <option value="Lawyers & Legal Strategists">
                      Lawyers &
                      Legal
                      Strategists
                    </option>

                    <option value="Politicians & Policy Advisors">
                      Politicians &
                      Policy Advisors
                    </option>

                    <option value="Entrepreneurs & Investors">
                      Entrepreneurs &
                      Investors
                    </option>

                    <option value="Influencers & Media Architects">
                      Influencers &
                      Media Architects
                    </option>

                    <option value="Cybersecurity Experts">
                      Cybersecurity
                      Experts
                    </option>

                    <option value="Operators Across Industries">
                      Operators
                      Across
                      Industries
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Current Level
                  </span>

                  <select
                    className="input-field"
                    required
                    value={
                      form.level
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'level',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select level
                    </option>

                    <option value="Starting / Exploring">
                      Starting /
                      Exploring
                    </option>

                    <option value="Early Stage">
                      Early Stage
                    </option>

                    <option value="1K+ network or income level">
                      1K+ network or
                      income level
                    </option>

                    <option value="10K+ network or income level">
                      10K+ network
                      or income
                      level
                    </option>

                    <option value="50K+ network or income level">
                      50K+ network
                      or income
                      level
                    </option>

                    <option value="Established / High-Level Operator">
                      Established /
                      High-Level
                      Operator
                    </option>

                    <option value="Strong influence or institutional access">
                      Strong
                      influence or
                      institutional
                      access
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Organization /
                    Company
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.company
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'company',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Years of
                    Experience
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.experience
                    }
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
              </div>

              <fieldset className="yh-federation-access-options">
                <legend>
                  Your Roles /
                  Positions
                </legend>

                <div>
                  {ROLE_OPTIONS.map(
                    (role) => (
                      <label
                        key={
                          role
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.roles.includes(
                              role,
                            )
                          }
                          onChange={() =>
                            toggleField(
                              'roles',
                              role,
                            )
                          }
                        />

                        <span>
                          {role}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              <div className="yh-federation-access-section-title">
                Resources &
                Leverage
              </div>

              <div className="yh-federation-access-form-grid">
                <label>
                  <span>
                    Audience Size
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.audienceSize
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'audienceSize',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select audience
                      size
                    </option>
                    <option value="None">
                      None
                    </option>
                    <option value="Under 10K">
                      Under 10K
                    </option>
                    <option value="10K+">
                      10K+
                    </option>
                    <option value="100K+">
                      100K+
                    </option>
                    <option value="1M+">
                      1M+
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Capital Access
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.capitalRange
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'capitalRange',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select capital
                      range
                    </option>
                    <option value="None">
                      None
                    </option>
                    <option value="Under $1K">
                      Under $1K
                    </option>
                    <option value="$1K+">
                      $1K+
                    </option>
                    <option value="$10K+">
                      $10K+
                    </option>
                    <option value="$100K+">
                      $100K+
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Team Size
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.teamSize
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'teamSize',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select team
                      size
                    </option>
                    <option value="Solo">
                      Solo
                    </option>
                    <option value="1-3">
                      1-3
                    </option>
                    <option value="3-10">
                      3-10
                    </option>
                    <option value="10+">
                      10+
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Skill Level
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.skillLevel
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'skillLevel',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select skill
                      level
                    </option>
                    <option value="Beginner">
                      Beginner
                    </option>
                    <option value="Intermediate">
                      Intermediate
                    </option>
                    <option value="Advanced">
                      Advanced
                    </option>
                    <option value="Elite">
                      Elite
                    </option>
                  </select>
                </label>
              </div>

              <fieldset className="yh-federation-access-options">
                <legend>
                  Active Platforms
                </legend>

                <div>
                  {PLATFORM_OPTIONS.map(
                    (platform) => (
                      <label
                        key={
                          platform
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.activePlatforms.includes(
                              platform,
                            )
                          }
                          onChange={() =>
                            toggleField(
                              'activePlatforms',
                              platform,
                            )
                          }
                        />

                        <span>
                          {platform}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              <div className="yh-federation-access-section-title">
                Network Intent
              </div>

              <div className="yh-federation-access-form-grid">
                <label className="is-wide">
                  <span>
                    What are you
                    looking for
                    inside the
                    Federation?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    value={
                      form.lookingFor
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'lookingFor',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    What can you
                    offer the
                    network?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    value={
                      form.canOffer
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'canOffer',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    What kind of
                    people,
                    sectors, or
                    opportunities
                    do you want
                    access to?
                  </span>

                  <textarea
                    className="input-field"
                    rows="4"
                    value={
                      form.wantsAccessTo
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'wantsAccessTo',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <fieldset className="yh-federation-access-options">
                <legend>
                  What are you open
                  to?
                </legend>

                <div>
                  {OPEN_TO_OPTIONS.map(
                    (option) => (
                      <label
                        key={
                          option
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.openTo.includes(
                              option,
                            )
                          }
                          onChange={() =>
                            toggleField(
                              'openTo',
                              option,
                            )
                          }
                        />

                        <span>
                          {option}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              <div className="yh-federation-access-section-title">
                Intelligence
                Filter
              </div>

              <div className="yh-federation-access-form-grid">
                <label className="is-wide">
                  <span>
                    What major
                    opportunity do
                    you see right
                    now that most
                    people are
                    missing?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={2500}
                    value={
                      form.opportunityInsight
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'opportunityInsight',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    If the
                    Federation gave
                    you access to
                    10,000
                    high-value
                    people, what
                    would you
                    build?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={2500}
                    value={
                      form.tenKPlan
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'tenKPlan',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Can we feature
                    your profile
                    internally?
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.openToFeature
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'openToFeature',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select answer
                    </option>
                    <option value="yes">
                      Yes
                    </option>
                    <option value="limited">
                      Limited
                      visibility
                    </option>
                    <option value="no">
                      No
                    </option>
                  </select>
                </label>
              </div>

              <div className="yh-federation-access-section-title">
                Verification &
                Referral
              </div>

              <div className="yh-federation-access-form-grid">
                <label>
                  <span>
                    LinkedIn
                    Profile
                  </span>

                  <input
                    className="input-field"
                    type="url"
                    value={
                      form.linkedin
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'linkedin',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Website /
                    Portfolio
                  </span>

                  <input
                    className="input-field"
                    type="url"
                    value={
                      form.website
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'website',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    X / Twitter
                  </span>

                  <input
                    className="input-field"
                    type="url"
                    value={
                      form.twitter
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'twitter',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Referral Code
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.referralCode
                    }
                    placeholder="Optional member referral code"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'referralCode',
                        event.target
                          .value.toUpperCase(),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Referred By
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.referredBy
                    }
                    placeholder="Optional"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'referredBy',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    How did you hear
                    about the
                    Federation?
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.source
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'source',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <label className="yh-federation-access-declaration">
                <input
                  type="checkbox"
                  checked={
                    form.declaration
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'declaration',
                      event.target
                        .checked,
                    )
                  }
                />

                <span>
                  I understand that
                  submission does
                  not guarantee
                  approval and I
                  confirm that the
                  details I
                  provided are
                  accurate.
                </span>
              </label>

              <div className="yh-federation-access-form-actions">
                <span>
                  Status after
                  submission:
                  Under Review
                </span>

                <button
                  type="submit"
                  className="yh-fed-action yh-fed-action-primary"
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Submit Federation Profile'}
                </button>
              </div>
            </form>
          )}

          <section className="yh-federation-access-review-grid">
            <article>
              <span className="yh-federation-access-kicker">
                Review Logic
              </span>

              <h3>
                What We Look For
              </h3>

              <p>
                Professional
                relevance,
                network value,
                trust, regional
                importance, and
                strategic fit.
              </p>
            </article>

            <article>
              <span className="yh-federation-access-kicker">
                Review Pipeline
              </span>

              <h3>
                Human Approval
              </h3>

              <p>
                Application state
                remains controlled
                by the existing
                Federation review
                backend. This
                screen cannot
                approve itself.
              </p>
            </article>

            <article>
              <span className="yh-federation-access-kicker">
                Directory
              </span>

              <h3>
                Protected Until
                Approved
              </h3>

              <p>
                Full Federation
                member identity and
                operating details
                stay protected
                until approved
                access is active.
              </p>
            </article>
          </section>
        </div>
      </div>
    </section>
  )
}
