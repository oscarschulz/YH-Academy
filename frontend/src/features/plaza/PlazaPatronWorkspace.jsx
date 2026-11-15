import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { PLAZA_CANONICAL_REGIONS } from './plazaCanonicalRegions'
import './PlazaPatronWorkspace.css'

const STATUS_BENEFITS = [
  'Official Plaza Patron badge',
  'Featured profile inside assigned Plaza',
  'Priority placement in regional directory',
  'Visible leadership title on Atlas and Region Hub',
  'Access stronger members and verified connectors in the assigned Plaza',
  'Recommend high-value members for Federation review',
  'Coordinate with other Patrons across continents',
  'Escalate strong regional opportunities to higher-level network access',
]

const CONTROL_BENEFITS = [
  'Create and lead official Plaza meetups',
  'Host regional Plaza chat and welcome new members',
  'Pin coordination notes, meetup direction, and regional updates',
  'Route local requests, intros, opportunities, and collaboration signals',
]

const MONEY_BENEFITS = [
  'Earn commission from successful regional introductions',
  'Receive bonuses from verified connection outcomes',
  'Monetize official meetups, sponsorships, and premium local events',
  'Qualify for revenue share from paid Plaza features in the assigned region',
]

const ROLE_OPTIONS = [
  'Regional Patron',
  'Plaza Leader',
  'Community Connector',
  'Meetup Coordinator',
]

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function stored(key = '') {
  try {
    return (
      sessionStorage.getItem(key) ||
      localStorage.getItem(key) ||
      ''
    )
  } catch {
    return ''
  }
}

function currentName() {
  return clean(
    stored('yh_user_name') ||
      stored('yh_user_username') ||
      '',
  )
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

function normalizeRegion(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `plaza-region-${index}`,

    region:
      clean(
        item.region ||
          item.name,
      ) ||
      'Plaza Region',

    label:
      clean(
        item.label ||
          item.region ||
          item.name,
      ) ||
      'Region Hub',

    countries:
      safeArray(
        item.countries,
      ),

    patronStatus:
      clean(
        item.patronStatus,
      ),

    patronUserId:
      clean(
        item.patronUserId,
      ),

    patronName:
      clean(
        item.patronName,
      ),
  }
}

function regionKey(
  value = '',
) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9]+/g,
      '',
    )
}

function mergeRegions(
  serverRegions = [],
) {
  const server =
    serverRegions.map(
      normalizeRegion,
    )

  const canonical =
    PLAZA_CANONICAL_REGIONS.map(
      normalizeRegion,
    )

  if (!server.length) {
    return canonical
  }

  const used =
    new Set()

  const merged =
    canonical.map(
      (base) => {
        const match =
          server.find(
            (item) =>
              item.id ===
                base.id ||
              regionKey(
                item.region,
              ) ===
                regionKey(
                  base.region,
                ),
          )

        if (!match) {
          return base
        }

        used.add(
          match.id,
        )

        return normalizeRegion({
          ...base,
          ...match,

          countries:
            match.countries
              .length
              ? match.countries
              : base.countries,
        })
      },
    )

  server.forEach(
    (item) => {
      if (
        !used.has(
          item.id,
        )
      ) {
        merged.push(
          item,
        )
      }
    },
  )

  return merged
}

function isPatronActive(
  region = {},
) {
  return (
    clean(
      region.patronStatus,
    ).toLowerCase() ===
      'active' &&
    Boolean(
      clean(
        region.patronUserId,
      ),
    )
  )
}

const INITIAL_FORM = {
  regionId: '',
  preferredRole:
    'Regional Patron',
  fullName:
    currentName(),
  baseCity: '',
  country: '',
  communicationHandle: '',
  leadershipExperience: '',
  plazaPlan: '',
  meetupPlan: '',
  proofLink: '',
  whyYou: '',
}

export default function PlazaPatronWorkspace({
  onToast,
}) {
  const prefillHandledRef =
    useRef(false)

  const [
    regions,
    setRegions,
  ] = useState([])

  const [
    application,
    setApplication,
  ] = useState(null)

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
    form,
    setForm,
  ] = useState(
    INITIAL_FORM,
  )

  const loadPatron =
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

        try {
          const [
            regionsResult,
            statusResult,
          ] =
            await Promise.allSettled([
              apiFetch(
                '/api/plaza/regions?limit=80',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/patron-application-status',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),
            ])

          if (
            regionsResult.status ===
            'fulfilled'
          ) {
            setRegions(
              mergeRegions(
                safeArray(
                  regionsResult
                    .value
                    ?.regions,
                ),
              ),
            )
          } else {
            setRegions(
              mergeRegions(
                [],
              ),
            )
          }

          if (
            statusResult.status ===
            'fulfilled'
          ) {
            setApplication(
              statusResult.value
                ?.application ||
                null,
            )
          }
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [],
    )

  useEffect(() => {
    void loadPatron()
  }, [loadPatron])

  useEffect(() => {
    if (
      !regions.length ||
      prefillHandledRef.current
    ) {
      return
    }

    prefillHandledRef.current =
      true

    let regionId = ''

    try {
      regionId =
        clean(
          sessionStorage.getItem(
            'yh_plaza_patron_prefill_region_id',
          ),
        )

      sessionStorage.removeItem(
        'yh_plaza_patron_prefill_region_id',
      )
    } catch {}

    if (
      regionId &&
      regions.some(
        (region) =>
          region.id ===
          regionId,
      )
    ) {
      setForm(
        (current) => ({
          ...current,
          regionId,
        }),
      )
    }
  }, [regions])

  const selectedRegion =
    useMemo(
      () =>
        regions.find(
          (region) =>
            region.id ===
            form.regionId,
        ) ||
        null,
      [
        regions,
        form.regionId,
      ],
    )

  const updateField =
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

  const submitApplication =
    async (event) => {
      event.preventDefault()

      if (submitting) {
        return
      }

      const payload = {
        regionId:
          clean(
            form.regionId,
          ),

        preferredRole:
          clean(
            form.preferredRole,
          ) ||
          'Regional Patron',

        fullName:
          clean(
            form.fullName,
          ),

        baseCity:
          clean(
            form.baseCity,
          ),

        country:
          clean(
            form.country,
          ),

        communicationHandle:
          clean(
            form.communicationHandle,
          ),

        leadershipExperience:
          clean(
            form.leadershipExperience,
          ),

        plazaPlan:
          clean(
            form.plazaPlan,
          ),

        meetupPlan:
          clean(
            form.meetupPlan,
          ),

        proofLink:
          clean(
            form.proofLink,
          ),

        whyYou:
          clean(
            form.whyYou,
          ),
      }

      if (
        !payload.regionId
      ) {
        onToast?.(
          'Select the Plaza you want to lead.',
          'error',
        )
        return
      }

      if (
        !payload.fullName
      ) {
        onToast?.(
          'Add your name first.',
          'error',
        )
        return
      }

      if (
        !payload.leadershipExperience
      ) {
        onToast?.(
          'Add your leadership experience first.',
          'error',
        )
        return
      }

      if (
        !payload.plazaPlan
      ) {
        onToast?.(
          'Add your Plaza leadership plan first.',
          'error',
        )
        return
      }

      if (
        !payload.whyYou
      ) {
        onToast?.(
          'Explain why admin should choose you.',
          'error',
        )
        return
      }

      setSubmitting(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/patron-applications',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        setApplication(
          result?.application ||
            null,
        )

        onToast?.(
          'Patron application submitted for admin review.',
          'success',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not submit Patron application.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-patron-react-workspace"
      data-yh-dashboard-react-surface="plazas-patron"
    >
      <div className="yh-plaza-patron-react-scroll">
        <div className="yh-plaza-patron-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Patron / Leader
              </span>

              <h1>
                Become a Plaza Patron
              </h1>

              <p>
                Apply to become the
                approved Patron or
                Leader for a specific
                Plaza. Approved
                Patrons become
                official regional
                operators with
                visibility,
                authority, meetup
                control and
                connection-based
                earning
                opportunities.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadPatron(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <div className="yh-plaza-patron-meta">
            <span>
              Official badge
            </span>

            <span>
              Regional authority
            </span>

            <span>
              Meetup control
            </span>

            <span>
              Commission eligible
            </span>
          </div>

          <section className="yh-plaza-patron-benefit-grid">
            <article>
              <span className="yh-plaza-react-kicker">
                Status Benefits
              </span>

              <div>
                {STATUS_BENEFITS.map(
                  (benefit) => (
                    <p
                      key={
                        benefit
                      }
                    >
                      {benefit}
                    </p>
                  ),
                )}
              </div>
            </article>

            <article>
              <span className="yh-plaza-react-kicker">
                Control Benefits
              </span>

              <div>
                {CONTROL_BENEFITS.map(
                  (benefit) => (
                    <p
                      key={
                        benefit
                      }
                    >
                      {benefit}
                    </p>
                  ),
                )}
              </div>
            </article>

            <article className="is-wide">
              <span className="yh-plaza-react-kicker">
                Money Benefits
              </span>

              <div>
                {MONEY_BENEFITS.map(
                  (benefit) => (
                    <p
                      key={
                        benefit
                      }
                    >
                      {benefit}
                    </p>
                  ),
                )}

                <p>
                  <strong>
                    Connection
                    commission:
                  </strong>{' '}
                  5%–15% on
                  admin-verified
                  successful
                  introductions.
                </p>

                <p>
                  <strong>
                    Revenue Share:
                  </strong>{' '}
                  Eligible for paid
                  meetups,
                  sponsorships and
                  premium regional
                  events.
                </p>

                <p>
                  Final payout rules
                  remain
                  admin-controlled
                  and can vary by
                  deal, event,
                  region and
                  verified outcome.
                </p>
              </div>
            </article>
          </section>

          {application && (
            <section className="yh-plaza-patron-status">
              <span className="yh-plaza-react-kicker">
                Your Application
              </span>

              <h2>
                Patron application{' '}
                {titleCase(
                  application.status ||
                    'Under Review',
                )}
              </h2>

              <p>
                Plaza:{' '}
                <strong>
                  {application.region ||
                    regions.find(
                      (
                        region,
                      ) =>
                        region.id ===
                        application.regionId,
                    )?.region ||
                    'Selected Plaza'}
                </strong>
                {' • '}
                Role:{' '}
                <strong>
                  {application.preferredRole ||
                    'Regional Patron'}
                </strong>
              </p>

              <p>
                If approved, you
                receive official
                Plaza leadership
                status, regional
                coordination
                authority, meetup
                control,
                Federation
                recommendation
                power and
                commission
                eligibility from
                verified connection
                outcomes.
              </p>
            </section>
          )}

          {loading ? (
            <div className="yh-plaza-react-state">
              Loading Patron
              application...
            </div>
          ) : (
            <form
              className="yh-plaza-patron-form"
              onSubmit={
                submitApplication
              }
            >
              <div className="yh-plaza-patron-form-grid">
                <label>
                  <span>
                    Plaza You Want
                    To Lead
                  </span>

                  <select
                    className="input-field"
                    required
                    value={
                      form.regionId
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'regionId',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select Plaza
                    </option>

                    {regions.map(
                      (
                        region,
                      ) => (
                        <option
                          key={
                            region.id
                          }
                          value={
                            region.id
                          }
                        >
                          {
                            region.region
                          }
                          {isPatronActive(
                            region,
                          )
                            ? ` • Current Patron: ${region.patronName}`
                            : ' • Open'}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Preferred Role
                  </span>

                  <select
                    className="input-field"
                    required
                    value={
                      form.preferredRole
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'preferredRole',
                        event.target
                          .value,
                      )
                    }
                  >
                    {ROLE_OPTIONS.map(
                      (role) => (
                        <option
                          key={
                            role
                          }
                          value={
                            role
                          }
                        >
                          {role}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Your Name
                  </span>

                  <input
                    className="input-field"
                    required
                    maxLength={140}
                    value={
                      form.fullName
                    }
                    placeholder="Your full name"
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
                    Base City
                  </span>

                  <input
                    className="input-field"
                    maxLength={100}
                    value={
                      form.baseCity
                    }
                    placeholder="Lagos, Manila, London..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'baseCity',
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
                    maxLength={100}
                    value={
                      form.country
                    }
                    placeholder="Your country"
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
                    Contact Handle
                  </span>

                  <input
                    className="input-field"
                    maxLength={160}
                    value={
                      form.communicationHandle
                    }
                    placeholder="Telegram, email, X, WhatsApp..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'communicationHandle',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Leadership
                    Experience
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={1200}
                    value={
                      form.leadershipExperience
                    }
                    placeholder="What have you led before? Communities, teams, student bodies, events, operations, groups..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'leadershipExperience',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Plaza Leadership
                    Plan
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={1200}
                    value={
                      form.plazaPlan
                    }
                    placeholder="How will you grow, organize, and activate this Plaza?"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'plazaPlan',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Meetup Plan
                  </span>

                  <textarea
                    className="input-field"
                    rows="4"
                    maxLength={900}
                    value={
                      form.meetupPlan
                    }
                    placeholder="How will you set up meetups, local circles, or online calls for this Plaza?"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'meetupPlan',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Proof Link
                  </span>

                  <input
                    className="input-field"
                    type="url"
                    maxLength={260}
                    value={
                      form.proofLink
                    }
                    placeholder="Portfolio, social profile, community proof, event proof..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'proofLink',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Why Should Admin
                    Choose You?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={900}
                    value={
                      form.whyYou
                    }
                    placeholder="Explain why you are the right person to lead this Plaza."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'whyYou',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              {selectedRegion && (
                <div className="yh-plaza-patron-selected-region">
                  <strong>
                    {
                      selectedRegion.region
                    }
                  </strong>

                  <span>
                    {
                      selectedRegion.label
                    }
                    {' • '}
                    {
                      selectedRegion.countries.length
                    }{' '}
                    countries
                  </span>
                </div>
              )}

              <div className="yh-plaza-patron-form-actions">
                <small>
                  Approval
                  automatically
                  upgrades the
                  selected Plaza:
                  the applicant
                  becomes the
                  official Patron /
                  Leader shown in
                  Atlas, Region Hub
                  and regional
                  coordination
                  surfaces.
                </small>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Submit Patron Application'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
