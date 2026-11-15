import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationConnectWorkspace.css'
import { getFederationStrategicReadinessState } from './FederationAccessWorkspace'

const EMPTY_FORM = {
  leadId: '',
  ownerUid: '',
  requestedTier: '',
  companyName: '',
  companyWebsite: '',
  contactName: '',
  contactRole: '',
  contactType: '',
  city: '',
  country: '',
  sourceMethod: '',
  channel: '',
  pipelineStage: '',
  priority: '',
  budgetRange: 'not_sure',
  urgency: 'normal',
  preferredIntroType: 'admin_brokered',
  requestReason: '',
  intendedUse: '',
  notes: '',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function enumLabel(value = '') {
  const raw = clean(value)

  if (!raw) {
    return ''
  }

  if (
    raw.includes(' ') &&
    !raw.includes('_')
  ) {
    return raw
  }

  const acronymMap = {
    ai: 'AI',
    api: 'API',
    dm: 'DM',
    id: 'ID',
    url: 'URL',
    yh: 'YH',
    yhu: 'YHU',
    yhf: 'YHF',
  }

  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      const lower =
        part.toLowerCase()

      return (
        acronymMap[lower] ||
        lower.charAt(0).toUpperCase() +
          lower.slice(1)
      )
    })
    .join(' ')
}

function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const numeric =
    Number(amount || 0)

  const code =
    clean(currency)
      .toUpperCase() ||
    'USD'

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return '—'
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      },
    ).format(numeric)
  } catch {
    return `${code} ${numeric}`
  }
}

function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(value)
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function normalizeOpportunity(
  raw = {},
  index = 0,
) {
  const ownerUid =
    clean(raw.ownerUid)

  const leadId =
    clean(raw.leadId)

  return {
    ...raw,

    id:
      clean(raw.id) ||
      clean(
        `${ownerUid}_${leadId}`,
      ) ||
      `federation-connect-${index + 1}`,

    ownerUid,
    leadId,

    title:
      clean(raw.title) ||
      'Strategic connection opportunity',

    category:
      clean(
        raw.category ||
          raw.contactType,
      ) ||
      'Strategic Network',

    contactRole:
      clean(raw.contactRole) ||
      'Strategic Contact',

    city:
      clean(raw.city),

    country:
      clean(raw.country),

    strategicValue:
      clean(
        raw.strategicValue,
      ).toLowerCase() ||
      'standard',

    tier:
      clean(raw.tier) ||
      'T2',

    sourceDivision:
      clean(
        raw.sourceDivision,
      ) ||
      'academy',

    pipelineStage:
      clean(
        raw.pipelineStage,
      ) ||
      'Review',

    sourceMethod:
      clean(
        raw.sourceMethod,
      ) ||
      'Lead Missions',

    contactType:
      clean(
        raw.contactType ||
          raw.category,
      ) ||
      'Strategic Network',

    companyLabel:
      clean(
        raw.companyLabel,
      ) ||
      'Private organization',

    hasEmail:
      raw.hasEmail === true,

    hasPhone:
      raw.hasPhone === true,

    hasDirectContact:
      raw.hasDirectContact === true ||
      raw.hasEmail === true ||
      raw.hasPhone === true,

    sellerPriceAmount:
      Number(
        raw.sellerPriceAmount ||
          0,
      ),

    universeCommissionRate:
      Number(
        raw.universeCommissionRate ||
          0,
      ),

    universeCommissionAmount:
      Number(
        raw.universeCommissionAmount ||
          0,
      ),

    buyerPriceAmount:
      Number(
        raw.buyerPriceAmount ||
          0,
      ),

    currency:
      clean(raw.currency)
        .toUpperCase() ||
      'USD',

    saleReviewStatus:
      clean(
        raw.saleReviewStatus,
      ) ||
      'approved',

    saleStatus:
      clean(
        raw.saleStatus,
      ) ||
      'listed',

    summary:
      clean(raw.summary) ||
      'Academy-sourced lead marked Federation-ready by admin.',

    updatedAt:
      clean(raw.updatedAt),

    createdAt:
      clean(raw.createdAt),
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

    leadId:
      clean(raw.leadId),

    ownerUid:
      clean(raw.ownerUid),

    opportunityTitle:
      clean(
        raw.opportunityTitle ||
          raw.title,
      ) ||
      'Federation connection request',

    status:
      clean(raw.status) ||
      'pending_admin_match',

    adminStatus:
      clean(
        raw.adminStatus,
      ) ||
      'pending_review',

    budgetRange:
      clean(
        raw.budgetRange,
      ) ||
      'not_sure',

    urgency:
      clean(raw.urgency) ||
      'normal',

    preferredIntroType:
      clean(
        raw.preferredIntroType,
      ) ||
      'admin_brokered',

    requestReason:
      clean(
        raw.requestReason ||
          raw.message,
      ),

    intendedUse:
      clean(
        raw.intendedUse,
      ),

    notes:
      clean(raw.notes),

    contactRole:
      clean(
        raw.contactRole ||
          raw.requestedContact
            ?.contactRole,
      ),

    contactType:
      clean(
        raw.contactType ||
          raw.requestedContact
            ?.contactType,
      ),

    city:
      clean(
        raw.city ||
          raw.requestedContact
            ?.city,
      ),

    country:
      clean(
        raw.country ||
          raw.requestedContact
            ?.country,
      ),

    pricingAmount:
      Number(
        raw.pricingAmount ||
          raw.buyerPriceAmount ||
          0,
      ),

    currency:
      clean(raw.currency)
        .toUpperCase() ||
      'USD',

    paymentStatus:
      clean(
        raw.paymentStatus,
      ) ||
      'not_started',

    leadAccessStatus:
      clean(
        raw.leadAccessStatus,
      ),

    createdAt:
      clean(raw.createdAt),

    updatedAt:
      clean(
        raw.updatedAt ||
          raw.createdAt,
      ),
  }
}

function identityKeys(me = {}) {
  const values = [
    me?.currentUser?.id,
    me?.currentUser?.uid,
    me?.currentUser?.userId,
    me?.member?.id,
    me?.member?.uid,
    me?.member?.userId,
    me?.application?.userId,
    me?.application?.uid,
  ]

  return new Set(
    values
      .map(clean)
      .filter(Boolean),
  )
}

function requestStatusLabel(
  request = {},
) {
  const payment =
    clean(
      request.paymentStatus,
    ).toLowerCase()

  const status =
    clean(
      request.status,
    )

  if (
    [
      'paid',
      'completed',
      'settled',
    ].includes(payment)
  ) {
    return 'Paid'
  }

  if (
    request.leadAccessStatus ===
    'unlocked'
  ) {
    return 'Lead Unlocked'
  }

  return enumLabel(
    status ||
      'pending_admin_match',
  )
}

export default function FederationConnectWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
  onWorkspaceOpen,
}) {
  const formRef =
    useRef(null)

  const [
    me,
    setMe,
  ] = useState(null)

  const [
    opportunities,
    setOpportunities,
  ] = useState([])

  const [
    requests,
    setRequests,
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
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    selectedOpportunity,
    setSelectedOpportunity,
  ] = useState(null)

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    valueFilter,
    setValueFilter,
  ] = useState('all')

  const [
    countryFilter,
    setCountryFilter,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const loadConnect =
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
          const meResult =
            await apiFetch(
              '/api/federation/me',
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          setMe(meResult)

          const approved =
            meResult?.canEnterFederation ===
              true ||
            clean(
              meResult?.applicationStatus,
            ).toLowerCase() ===
              'approved'

          if (!approved) {
            setOpportunities([])
            setRequests([])
            return
          }

          const [
            opportunityResult,
            requestResult,
          ] =
            await Promise.allSettled([
              apiFetch(
                '/api/federation/connect/opportunities',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/federation/connect/my-requests',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),
            ])

          if (
            opportunityResult.status ===
            'fulfilled'
          ) {
            setOpportunities(
              safeArray(
                opportunityResult
                  .value
                  ?.opportunities,
              ).map(
                normalizeOpportunity,
              ),
            )
          } else {
            setOpportunities([])

            const message =
              opportunityResult
                .reason
                ?.message ||
              'Could not load Federation Connect opportunities.'

            setError(message)
          }

          if (
            requestResult.status ===
            'fulfilled'
          ) {
            setRequests(
              safeArray(
                requestResult
                  .value
                  ?.requests,
              ).map(
                normalizeRequest,
              ),
            )
          } else {
            setRequests([])
          }
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Federation Connect.'

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
    void loadConnect(refreshVersion > 0)
  }, [loadConnect, refreshVersion])

  const currentIdentityKeys =
    useMemo(
      () =>
        identityKeys(
          me || {},
        ),
      [me],
    )

  const isOwnLead =
    useCallback(
      (opportunity) =>
        Boolean(
          clean(
            opportunity
              ?.ownerUid,
          ) &&
            currentIdentityKeys.has(
              clean(
                opportunity
                  ?.ownerUid,
              ),
            ),
        ),
      [currentIdentityKeys],
    )

  const countries =
    useMemo(
      () =>
        Array.from(
          new Set(
            opportunities
              .map(
                (item) =>
                  clean(
                    item.country,
                  ),
              )
              .filter(Boolean),
          ),
        ).sort(),
      [opportunities],
    )

  const filteredOpportunities =
    useMemo(
      () => {
        const query =
          clean(search)
            .toLowerCase()

        const country =
          clean(
            countryFilter,
          ).toLowerCase()

        return opportunities.filter(
          (
            opportunity,
          ) => {
            const haystack = [
              opportunity.title,
              opportunity.category,
              opportunity.contactRole,
              opportunity.city,
              opportunity.country,
              opportunity.strategicValue,
              opportunity.tier,
              opportunity.summary,
            ]
              .join(' ')
              .toLowerCase()

            const matchesSearch =
              !query ||
              haystack.includes(
                query,
              )

            const matchesValue =
              valueFilter ===
                'all' ||
              opportunity.strategicValue ===
                valueFilter

            const matchesCountry =
              !country ||
              clean(
                opportunity.country,
              )
                .toLowerCase()
                .includes(
                  country,
                )

            return (
              matchesSearch &&
              matchesValue &&
              matchesCountry
            )
          },
        )
      },
      [
        opportunities,
        search,
        valueFilter,
        countryFilter,
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
          [field]: value,
        }),
      )
    }

  const openRequest =
    (opportunity) => {
      if (
        isOwnLead(
          opportunity,
        )
      ) {
        onToast?.(
          'You cannot request or purchase your own Federation lead.',
          'error',
        )

        return
      }

      setSelectedOpportunity(
        opportunity,
      )

      setForm({
        ...EMPTY_FORM,

        leadId:
          opportunity.leadId,

        ownerUid:
          opportunity.ownerUid,

        requestedTier:
          opportunity.tier,

        contactRole:
          opportunity.contactRole,

        contactType:
          opportunity.contactType,

        city:
          opportunity.city,

        country:
          opportunity.country,

        sourceMethod:
          opportunity.sourceMethod,
      })

      window.setTimeout(
        () => {
          formRef.current?.scrollIntoView(
            {
              behavior:
                'smooth',

              block:
                'start',
            },
          )
        },
        0,
      )
    }

  const clearRequest =
    () => {
      setSelectedOpportunity(
        null,
      )

      setForm(
        EMPTY_FORM,
      )
    }

  const submitRequest =
    async (event) => {
      event.preventDefault()

      if (submitting) {
        return
      }

      const payload = {
        leadId:
          clean(
            form.leadId,
          ),

        ownerUid:
          clean(
            form.ownerUid,
          ),

        requestedTier:
          clean(
            form.requestedTier,
          ),

        companyName:
          clean(
            form.companyName,
          ),

        companyWebsite:
          clean(
            form.companyWebsite,
          ),

        contactName:
          clean(
            form.contactName,
          ),

        contactRole:
          clean(
            form.contactRole,
          ),

        contactType:
          clean(
            form.contactType,
          ),

        city:
          clean(
            form.city,
          ),

        country:
          clean(
            form.country,
          ),

        sourceMethod:
          clean(
            form.sourceMethod,
          ),

        channel:
          clean(
            form.channel,
          ),

        pipelineStage:
          clean(
            form.pipelineStage,
          ),

        priority:
          clean(
            form.priority,
          ),

        budgetRange:
          clean(
            form.budgetRange,
          ) ||
          'not_sure',

        urgency:
          clean(
            form.urgency,
          ) ||
          'normal',

        preferredIntroType:
          clean(
            form.preferredIntroType,
          ) ||
          'admin_brokered',

        requestReason:
          clean(
            form.requestReason,
          ),

        intendedUse:
          clean(
            form.intendedUse,
          ),

        notes:
          clean(
            form.notes,
          ),
      }

      if (
        payload.ownerUid &&
        currentIdentityKeys.has(
          payload.ownerUid,
        )
      ) {
        onToast?.(
          'You cannot request or purchase your own Federation lead.',
          'error',
        )

        return
      }

      if (
        !payload.contactRole
      ) {
        onToast?.(
          'Add the contact role before submitting this request.',
          'error',
        )

        return
      }

      if (
        !payload.contactType
      ) {
        onToast?.(
          'Select the contact type before submitting this request.',
          'error',
        )

        return
      }

      if (!payload.country) {
        onToast?.(
          'Add the country before submitting this request.',
          'error',
        )

        return
      }

      if (
        payload.requestReason
          .length < 12
      ) {
        onToast?.(
          'Explain why you need this contact. Minimum 12 characters.',
          'error',
        )

        return
      }

      setSubmitting(true)

      try {
        const result =
          await apiFetch(
            '/api/federation/connect/requests',
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
          !result?.request
        ) {
          throw new Error(
            'Federation connection request response was incomplete.',
          )
        }

        const request =
          normalizeRequest(
            result.request,
          )

        setRequests(
          (current) => [
            request,

            ...current.filter(
              (item) =>
                item.id !==
                request.id,
            ),
          ],
        )

        onDataChanged?.()
        clearRequest()

        onToast?.(
          'Connection request submitted. Admin will review and match this request.',
          'success',
        )
      } catch (
        submitError
      ) {
        onToast?.(
          submitError?.message ||
            'Failed to submit connection request.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    }

  const approved =
    me?.canEnterFederation ===
      true ||
    clean(
      me?.applicationStatus,
    ).toLowerCase() ===
      'approved'

  const readiness = getFederationStrategicReadinessState()
  const readinessPanel = (
    <section className="yh-federation-connect-requests-section" aria-label="Strategic Readiness">
      <h2>Strategic Readiness</h2>
      <div className="yh-federation-connect-summary">
        <article>
          <small>Candidacy</small>
          <strong>{readiness.score > 0 ? readiness.score + ' · ' + readiness.label : readiness.label}</strong>
        </article>
        <article>
          <small>Connect</small>
          <strong>{readiness.connectLabel}</strong>
        </article>
      </div>
      <p>{readiness.copy}</p>
    </section>
  )

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-connect-react-workspace">
        <div className="yh-federation-connect-state">
          Loading Federation
          Connect...
        </div>
      </section>
    )
  }

  if (!approved) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-connect-react-workspace">
        <div className="yh-federation-connect-state">
          <span className="yh-federation-connect-kicker">
            Federation Connect
          </span>

          <h1>
            Federation approval
            required
          </h1>

          <p>
            Connect opportunities
            unlock after your
            Federation
            application is
            approved.
          </p>
          {readinessPanel}
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-connect-react-workspace"
      data-yh-dashboard-react-surface="federation-connect"
    >
      <div className="yh-federation-connect-scroll">
        <div className="yh-federation-connect-shell">
          <header className="yh-federation-connect-hero">
            <div>
              <span className="yh-federation-connect-kicker">
                Federation / Connect
              </span>

              <h1>
                Strategic Connect
              </h1>

              <p>
                Review
                Federation-ready
                connection
                opportunities and
                request a
                controlled
                introduction
                through the
                existing admin
                matching pipeline.
              </p>
            </div>

            <div className="yh-federation-connect-hero-actions">
              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                onClick={() =>
                  onWorkspaceOpen?.(
                    'federation-requests',
                  )
                }
              >
                Open My Requests
              </button>

              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                disabled={
                  refreshing
                }
                onClick={() =>
                  void loadConnect(
                    true,
                  )
                }
              >
                {refreshing
                  ? 'Refreshing...'
                  : 'Refresh'}
              </button>
            </div>
          </header>

          <section className="yh-federation-connect-summary">
            <article>
              <small>
                Available
                Opportunities
              </small>

              <strong>
                {
                  opportunities.length
                }
              </strong>
            </article>

            <article>
              <small>
                My Requests
              </small>

              <strong>
                {
                  requests.length
                }
              </strong>
            </article>

            <article>
              <small>
                Paid Leads
              </small>

              <strong>
                {
                  opportunities.filter(
                    (item) =>
                      item.buyerPriceAmount >
                      0,
                  ).length
                }
              </strong>
            </article>
          </section>

          {readinessPanel}
          <section className="yh-federation-connect-filter-bar">
            <label>
              <span>
                Search
              </span>

              <input
                className="input-field"
                value={search}
                placeholder="Role, category, city, country..."
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Strategic Value
              </span>

              <select
                className="input-field"
                value={
                  valueFilter
                }
                onChange={(
                  event,
                ) =>
                  setValueFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All Values
                </option>

                <option value="strategic">
                  Strategic
                </option>

                <option value="high">
                  High
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="watch">
                  Watch
                </option>

                <option value="standard">
                  Standard
                </option>

                <option value="requested">
                  Requested
                </option>
              </select>
            </label>

            <label>
              <span>
                Country
              </span>

              <select
                className="input-field"
                value={
                  countryFilter
                }
                onChange={(
                  event,
                ) =>
                  setCountryFilter(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All Countries
                </option>

                {countries.map(
                  (country) => (
                    <option
                      key={
                        country
                      }
                      value={
                        country
                      }
                    >
                      {country}
                    </option>
                  ),
                )}
              </select>
            </label>
          </section>

          {error && (
            <div className="yh-federation-connect-state is-error">
              {error}
            </div>
          )}

          {!error &&
            !filteredOpportunities.length && (
              <div className="yh-federation-connect-state">
                <strong>
                  No
                  Federation-ready
                  leads match this
                  view.
                </strong>

                <span>
                  Once admin marks
                  Academy Lead
                  Mission records
                  Federation-ready,
                  anonymized
                  opportunities
                  appear here.
                </span>
              </div>
            )}

          <div className="yh-federation-connect-grid">
            {filteredOpportunities.map(
              (
                opportunity,
              ) => {
                const own =
                  isOwnLead(
                    opportunity,
                  )

                return (
                  <article
                    className="yh-federation-connect-card"
                    key={
                      opportunity.id
                    }
                  >
                    <div className="yh-federation-connect-card-head">
                      <div>
                        <span className="yh-federation-connect-kicker">
                          {enumLabel(
                            opportunity.sourceDivision,
                          )}{' '}
                          Source
                        </span>

                        <h3>
                          {
                            opportunity.title
                          }
                        </h3>
                      </div>

                      <b>
                        {enumLabel(
                          opportunity.strategicValue,
                        )}
                      </b>
                    </div>

                    <p>
                      {
                        opportunity.summary
                      }
                    </p>

                    <div className="yh-federation-connect-meta">
                      <span>
                        {
                          opportunity.category
                        }
                      </span>

                      <span>
                        {enumLabel(
                          opportunity.tier,
                        )}
                      </span>

                      <span>
                        {[
                          opportunity.city,
                          opportunity.country,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(', ') ||
                          'Private region'}
                      </span>

                      <span>
                        {opportunity.hasDirectContact
                          ? 'Contact on file'
                          : 'Intro required'}
                      </span>

                      <span>
                        {opportunity.buyerPriceAmount >
                        0
                          ? `${formatMoney(
                              opportunity.buyerPriceAmount,
                              opportunity.currency,
                            )} access price`
                          : 'Price set by admin'}
                      </span>
                    </div>

                    <div className="yh-federation-connect-card-foot">
                      <small>
                        {
                          opportunity.companyLabel
                        }
                      </small>

                      <button
                        type="button"
                        className={
                          own
                            ? 'yh-fed-action yh-fed-action-secondary'
                            : 'yh-fed-action yh-fed-action-primary'
                        }
                        disabled={
                          own
                        }
                        title={
                          own
                            ? 'You cannot request or purchase your own Federation lead.'
                            : ''
                        }
                        onClick={() =>
                          openRequest(
                            opportunity,
                          )
                        }
                      >
                        {own
                          ? 'Your Lead'
                          : 'Request Connection'}
                      </button>
                    </div>
                  </article>
                )
              },
            )}
          </div>

          {selectedOpportunity && (
            <form
              ref={formRef}
              className="yh-federation-connect-request-form"
              onSubmit={
                submitRequest
              }
            >
              <div className="yh-federation-connect-request-head">
                <div>
                  <span className="yh-federation-connect-kicker">
                    Request a
                    Strategic
                    Connection
                  </span>

                  <h2>
                    {
                      selectedOpportunity.title
                    }
                  </h2>

                  <p>
                    {selectedOpportunity
                      ? 'Choose a lead, explain the business reason, and admin will review the safest introduction route.'
                      : readiness.connectReady
                        ? 'Fill the request fields below. Admin will match your request against the Federation-ready lead database.'
                        : 'Connect readiness: ' + readiness.connectLabel + '. ' + readiness.copy}
                  </p>
                </div>

                <button
                  type="button"
                  className="yh-fed-action yh-fed-action-secondary"
                  disabled={
                    submitting
                  }
                  onClick={
                    clearRequest
                  }
                >
                  Clear
                </button>
              </div>

              <div className="yh-federation-connect-form-grid">
                <label>
                  <span>
                    Preferred Tier
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.requestedTier
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'requestedTier',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Any tier
                    </option>

                    <option value="T1">
                      T1 - High Value
                    </option>

                    <option value="T2">
                      T2 - Mid Value
                    </option>

                    <option value="T3">
                      T3 - Low Value
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Company /
                    Organization
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.companyName
                    }
                    placeholder="Law firm, investment group, agency..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'companyName',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Company Website
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.companyWebsite
                    }
                    placeholder="Optional"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'companyWebsite',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Contact Name
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.contactName
                    }
                    placeholder="Optional if unknown"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'contactName',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Contact Role
                  </span>

                  <input
                    className="input-field"
                    required
                    value={
                      form.contactRole
                    }
                    placeholder="Founder, lawyer, investor, manager..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'contactRole',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Contact Type
                  </span>

                  <select
                    className="input-field"
                    required
                    value={
                      form.contactType
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'contactType',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select type
                    </option>

                    <option value="employee">
                      Employee
                    </option>

                    <option value="manager">
                      Manager
                    </option>

                    <option value="founder">
                      Founder
                    </option>

                    <option value="owner">
                      Owner
                    </option>

                    <option value="investor">
                      Investor
                    </option>

                    <option value="lawyer">
                      Lawyer
                    </option>

                    <option value="policy">
                      Policy /
                      Government
                    </option>

                    <option value="media">
                      Media /
                      Influence
                    </option>

                    <option value="operator">
                      Operator
                    </option>

                    <option value="unknown">
                      Unknown
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    City
                  </span>

                  <input
                    className="input-field"
                    value={
                      form.city
                    }
                    placeholder="Lagos"
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
                    placeholder="Nigeria"
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
                    Preferred Source
                    Method
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.sourceMethod
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'sourceMethod',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Any source
                    </option>

                    <option value="Google Maps">
                      Google Maps
                    </option>

                    <option value="Search Engine">
                      Search Engine
                    </option>

                    <option value="AI Research">
                      AI Research
                    </option>

                    <option value="Referral">
                      Referral
                    </option>

                    <option value="Website Form">
                      Website Form
                    </option>

                    <option value="Social Media">
                      Social Media
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Preferred Channel
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.channel
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'channel',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Any channel
                    </option>

                    <option value="WhatsApp">
                      WhatsApp
                    </option>

                    <option value="Email">
                      Email
                    </option>

                    <option value="Phone">
                      Phone
                    </option>

                    <option value="Telegram">
                      Telegram
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Minimum Lead
                    Stage
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.pipelineStage
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'pipelineStage',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Any stage
                    </option>

                    <option value="Prospected">
                      Prospected
                    </option>

                    <option value="Called">
                      Called
                    </option>

                    <option value="Contact Identified">
                      Contact Identified
                    </option>

                    <option value="Direct Channel Opened">
                      Direct Channel Opened
                    </option>

                    <option value="Rapport Building">
                      Rapport Building
                    </option>

                    <option value="Applied">
                      Applied
                    </option>

                    <option value="Accepted">
                      Accepted
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Priority
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.priority
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'priority',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="">
                      No preference
                    </option>

                    <option value="High">
                      High
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="Low">
                      Low
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Budget / Deal
                    Range
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.budgetRange
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'budgetRange',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="not_sure">
                      Not sure yet
                    </option>

                    <option value="under_500">
                      Under $500
                    </option>

                    <option value="500_1500">
                      $500 - $1,500
                    </option>

                    <option value="1500_5000">
                      $1,500 - $5,000
                    </option>

                    <option value="5000_plus">
                      $5,000+
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Urgency
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.urgency
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'urgency',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="normal">
                      Normal
                    </option>

                    <option value="this_week">
                      This week
                    </option>

                    <option value="urgent">
                      Urgent
                    </option>

                    <option value="exploring">
                      Exploring
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Preferred Intro
                    Type
                  </span>

                  <select
                    className="input-field"
                    value={
                      form.preferredIntroType
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'preferredIntroType',
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="admin_brokered">
                      Admin-brokered
                      intro
                    </option>

                    <option value="operator_intro">
                      Operator warm
                      intro
                    </option>

                    <option value="contact_package">
                      Contact package
                      after approval
                    </option>

                    <option value="not_sure">
                      Not sure
                    </option>
                  </select>
                </label>

                <label className="is-wide">
                  <span>
                    Why do you need
                    this contact?
                  </span>

                  <textarea
                    className="input-field"
                    required
                    rows="4"
                    maxLength={1200}
                    value={
                      form.requestReason
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'requestReason',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    What will you
                    use the
                    introduction
                    for?
                  </span>

                  <textarea
                    className="input-field"
                    rows="3"
                    maxLength={1200}
                    value={
                      form.intendedUse
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'intendedUse',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Extra notes for
                    admin
                  </span>

                  <textarea
                    className="input-field"
                    rows="3"
                    maxLength={1200}
                    value={
                      form.notes
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'notes',
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="yh-federation-connect-form-actions">
                <small>
                  Admin reviews the
                  request and
                  controls the safe
                  introduction,
                  matching and
                  payment route.
                </small>

                <button
                  type="submit"
                  className="yh-fed-action yh-fed-action-primary"
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? 'Submitting...'
                    : readiness.connectReady
                      ? 'Submit Strategic Contact Request'
                      : 'Submit Contact Request'}
                </button>
              </div>
            </form>
          )}

          <section className="yh-federation-connect-requests-section">
            <div className="yh-federation-connect-section-head">
              <div>
                <span className="yh-federation-connect-kicker">
                  My Requests
                </span>

                <h2>
                  Connection
                  request pipeline
                </h2>
              </div>

              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                onClick={() =>
                  onWorkspaceOpen?.(
                    'federation-requests',
                  )
                }
              >
                Open Full Requests
              </button>
            </div>

            {!requests.length ? (
              <div className="yh-federation-connect-state">
                You have not
                submitted a
                Federation Connect
                request yet.
              </div>
            ) : (
              <div className="yh-federation-connect-request-list">
                {requests
                  .slice(0, 8)
                  .map(
                    (request) => (
                      <article
                        key={
                          request.id
                        }
                      >
                        <div className="yh-federation-connect-request-card-head">
                          <div>
                            <span>
                              {requestStatusLabel(
                                request,
                              )}
                            </span>

                            <h3>
                              {
                                request.opportunityTitle
                              }
                            </h3>
                          </div>

                          <b>
                            {enumLabel(
                              request.urgency,
                            )}
                          </b>
                        </div>

                        <p>
                          {request.requestReason ||
                            'No request reason recorded.'}
                        </p>

                        <div className="yh-federation-connect-meta">
                          {request.contactRole && (
                            <span>
                              {
                                request.contactRole
                              }
                            </span>
                          )}

                          {request.contactType && (
                            <span>
                              {enumLabel(
                                request.contactType,
                              )}
                            </span>
                          )}

                          {request.country && (
                            <span>
                              {[
                                request.city,
                                request.country,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  ', ',
                                )}
                            </span>
                          )}

                          <span>
                            {enumLabel(
                              request.budgetRange,
                            )}
                          </span>

                          {request.pricingAmount >
                            0 && (
                            <span>
                              {formatMoney(
                                request.pricingAmount,
                                request.currency,
                              )}
                            </span>
                          )}
                        </div>

                        <small>
                          Submitted{' '}
                          {formatDate(
                            request.createdAt,
                          )}
                        </small>
                      </article>
                    ),
                  )}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
