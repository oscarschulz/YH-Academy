import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './PlazaPatronDeskWorkspace.css'

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
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

function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return (
      clean(value) ||
      'Just now'
    )
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(date)
}

function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const value =
    Number(
      amount || 0,
    )

  const code =
    clean(currency)
      .toUpperCase() ||
    'USD'

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style:
          'currency',

        currency:
          code,
      },
    ).format(
      Number.isFinite(
        value,
      )
        ? value
        : 0,
    )
  } catch {
    return `${code} ${
      Number.isFinite(
        value,
      )
        ? value.toLocaleString()
        : '0'
    }`
  }
}

function normalizeDesk(
  payload = {},
) {
  return {
    isPatron:
      payload?.isPatron ===
      true,

    patron:
      payload?.patron &&
      typeof payload.patron ===
        'object'
        ? payload.patron
        : null,

    regions:
      safeArray(
        payload?.regions,
      ),

    routedRequests:
      safeArray(
        payload?.routedRequests,
      ),

    recommendations:
      safeArray(
        payload?.recommendations,
      ),

    payouts:
      safeArray(
        payload?.payouts,
      ),

    walletPayouts:
      safeArray(
        payload?.walletPayouts,
      ),

    message:
      clean(
        payload?.message,
      ),
  }
}

export default function PlazaPatronDeskWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const [
    data,
    setData,
  ] = useState(() =>
    normalizeDesk(),
  )

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

  const loadDesk =
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
          /* YHU_PLAZA_PATRON_DESK_SERVER_AUTHORITY_PARITY */
          // The Desk endpoint is authoritative for Patron assignment.
          const result = await apiFetch(
            '/api/plaza/patron/desk',
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

          setApplication(
            result?.application &&
              typeof result.application === 'object'
              ? result.application
              : null,
          )

          setData(normalizeDesk(result))
        } catch (
          error
        ) {
          const message =
            clean(
              error?.message,
            )

          const lower =
            message.toLowerCase()

          const expectedGate =
            lower.includes(
              'only approved plaza patrons',
            ) ||
            lower.includes(
              'patron desk',
            ) ||
            lower.includes(
              'not approved',
            )

          setData(
            normalizeDesk({
              isPatron:
                false,

              message:
                message ||
                'Once admin approves you as a Plaza Patron, your Patron Desk will appear here.',
            }),
          )

          if (
            !expectedGate
          ) {
            onToast?.(
              message ||
                'Could not load Patron Desk.',
              'error',
            )
          }
        } finally {
          setLoading(false)
          setRefreshing(
            false,
          )
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadDesk()
  }, [loadDesk])

  const payouts =
    useMemo(
      () => {
        const seen = new Set()

        return [
          ...data.payouts,
          ...data.walletPayouts,
        ].filter((item) => {
          const recordId = clean(
            item.payoutLedgerId || item.id,
          )

          const key = recordId
            ? `id:${recordId}`
            : `record:${JSON.stringify(item)}`

          if (seen.has(key)) {
            return false
          }

          seen.add(key)
          return true
        })
      },
      [
        data.payouts,
        data.walletPayouts,
      ],
    )

  const applicationStatus =
    clean(
      application?.status,
    ) ||
    'Not approved'

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-patron-desk-react-workspace"
      data-yh-dashboard-react-surface="plazas-patron-desk"
    >
      <div className="yh-plaza-patron-desk-scroll">
        <div className="yh-plaza-patron-desk-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Patron Desk
              </span>

              <h1>
                Patron Desk
              </h1>

              <p>
                Manage regional
                Patron operations,
                routed requests,
                Federation
                recommendations,
                and commission
                payout visibility.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadDesk(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          {loading ? (
            <div className="yh-plaza-react-state">
              Loading Patron
              Desk...
            </div>
          ) : (
            <>
              <div className="yh-plaza-patron-desk-meta">
                <span>
                  {
                    data.regions
                      .length
                  }{' '}
                  assigned Plazas
                </span>

                <span>
                  {
                    data
                      .routedRequests
                      .length
                  }{' '}
                  routed requests
                </span>

                <span>
                  {
                    payouts.length
                  }{' '}
                  payout records
                </span>
              </div>

              <section
                className={[
                  'yh-plaza-patron-desk-status',
                  data.isPatron
                    ? 'is-active'
                    : 'is-locked',
                ]
                  .filter(
                    Boolean,
                  )
                  .join(' ')}
              >
                <span className="yh-plaza-react-kicker">
                  Patron Status
                </span>

                {data.isPatron ? (
                  <>
                    <h2>
                      Active Patron
                      Desk
                    </h2>

                    <p>
                      {clean(
                        data.patron
                          ?.name,
                      ) ||
                        'You'}{' '}
                      currently lead{' '}
                      {
                        data.regions
                          .length
                      }{' '}
                      Plaza region
                      {data.regions
                        .length ===
                      1
                        ? ''
                        : 's'}
                      .
                    </p>
                  </>
                ) : (
                  <>
                    <h2>
                      No active Patron
                      assignment found
                    </h2>

                    <p>
                      {data.message ||
                        'Once admin assigns you as an active Patron for a Plaza, your Desk will appear here.'}
                    </p>

                    <div className="yh-plaza-patron-desk-locked-meta">
                      <span>
                        Application:{' '}
                        {titleCase(
                          applicationStatus,
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        onWorkspaceOpen?.(
                          'plazas-patron',
                        )
                      }
                    >
                      Open Patron Application
                    </button>
                  </>
                )}
              </section>

              <section className="yh-plaza-patron-desk-summary">
                <article>
                  <small>
                    Assigned Plazas
                  </small>

                  <strong>
                    {
                      data.regions
                        .length
                    }
                  </strong>

                  <span>
                    Regions where
                    you are the
                    active Patron
                  </span>
                </article>

                <article>
                  <small>
                    Routed Requests
                  </small>

                  <strong>
                    {
                      data
                        .routedRequests
                        .length
                    }
                  </strong>

                  <span>
                    Requests
                    attached to your
                    Patron region
                  </span>
                </article>

                <article>
                  <small>
                    Recommendations
                  </small>

                  <strong>
                    {
                      data
                        .recommendations
                        .length
                    }
                  </strong>

                  <span>
                    Federation
                    recommendations
                    submitted
                  </span>
                </article>

                <article>
                  <small>
                    Payout Records
                  </small>

                  <strong>
                    {
                      payouts.length
                    }
                  </strong>

                  <span>
                    Commission payout
                    ledger visibility
                  </span>
                </article>
              </section>

              <section className="yh-plaza-patron-desk-section">
                <div className="yh-plaza-patron-desk-section-head">
                  <div>
                    <span className="yh-plaza-react-kicker">
                      Regional Control
                    </span>

                    <h2>
                      Assigned Plazas
                    </h2>
                  </div>
                </div>

                {!data.regions
                  .length ? (
                  <div className="yh-plaza-react-state">
                    No assigned
                    Patron region
                    yet.
                  </div>
                ) : (
                  <div className="yh-plaza-patron-desk-grid">
                    {data.regions.map(
                      (
                        region,
                        index,
                      ) => (
                        <article
                          className="yh-plaza-patron-desk-card"
                          key={
                            clean(
                              region.id,
                            ) ||
                            `${clean(region.region)}-${index}`
                          }
                        >
                          <div className="yh-plaza-patron-desk-card-head">
                            <span>
                              {clean(
                                region.continent ||
                                  region.network,
                              ) ||
                                'Plaza'}
                            </span>

                            <span>
                              {titleCase(
                                region.patronStatus ||
                                  'active',
                              )}
                            </span>
                          </div>

                          <h3>
                            {clean(
                              region.region,
                            ) ||
                              'Assigned Plaza'}
                          </h3>

                          <p>
                            {clean(
                              region.text,
                            ) ||
                              'You are assigned as the Patron / Leader for this Plaza region.'}
                          </p>

                          <div className="yh-plaza-patron-desk-chips">
                            <span>
                              {clean(
                                region.network,
                              ) ||
                                'YH Network'}
                            </span>

                            <span>
                              {Number(
                                region.countryCount ||
                                  safeArray(
                                    region.countries,
                                  ).length ||
                                  0,
                              )}{' '}
                              countries
                            </span>

                            <span>
                              {clean(
                                region.patronRole,
                              ) ||
                                'Regional Patron'}
                            </span>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="yh-plaza-patron-desk-section">
                <div className="yh-plaza-patron-desk-section-head">
                  <div>
                    <span className="yh-plaza-react-kicker">
                      Regional Routing
                    </span>

                    <h2>
                      Routed Requests
                    </h2>
                  </div>
                </div>

                {!data
                  .routedRequests
                  .length ? (
                  <div className="yh-plaza-react-state">
                    No routed regional
                    requests yet.
                  </div>
                ) : (
                  <div className="yh-plaza-patron-desk-list">
                    {data.routedRequests.map(
                      (
                        item,
                        index,
                      ) => (
                        <article
                          className="yh-plaza-patron-desk-card"
                          key={
                            clean(
                              item.id,
                            ) ||
                            `request-${index}`
                          }
                        >
                          <div className="yh-plaza-patron-desk-card-head">
                            <span>
                              {titleCase(
                                item.status ||
                                  'Submitted',
                              )}
                            </span>

                            <span>
                              {clean(
                                item.region ||
                                  item.patronRegion,
                              ) ||
                                'Plaza'}
                            </span>
                          </div>

                          <h3>
                            {clean(
                              item.objective,
                            ) ||
                              'Regional request'}
                          </h3>

                          <strong>
                            {clean(
                              item.targetLabel,
                            ) ||
                              'General Plaza request'}
                          </strong>

                          <p>
                            {clean(
                              item.message,
                            ) ||
                              'No request message available.'}
                          </p>

                          <div className="yh-plaza-patron-desk-note">
                            Route:{' '}
                            {clean(
                              item.routeLabel ||
                                item.patronRouteStatus,
                            ) ||
                              'Patron review'}
                          </div>

                          {clean(
                            item.patronActionNote,
                          ) && (
                            <div className="yh-plaza-patron-desk-note">
                              Patron note:{' '}
                              {
                                item.patronActionNote
                              }
                            </div>
                          )}

                          <div className="yh-plaza-patron-desk-chips">
                            <span>
                              {clean(
                                item.name ||
                                  item.authorName,
                              ) ||
                                'Requester'}
                            </span>

                            <span>
                              {formatDate(
                                item.updatedAt ||
                                  item.createdAt,
                              )}
                            </span>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="yh-plaza-patron-desk-section">
                <div className="yh-plaza-patron-desk-section-head">
                  <div>
                    <span className="yh-plaza-react-kicker">
                      Federation Signal
                    </span>

                    <h2>
                      Recommendations
                    </h2>
                  </div>
                </div>

                {!data
                  .recommendations
                  .length ? (
                  <div className="yh-plaza-react-state">
                    No Federation
                    recommendation
                    has been logged
                    yet.
                  </div>
                ) : (
                  <div className="yh-plaza-patron-desk-list">
                    {data.recommendations.map(
                      (
                        item,
                        index,
                      ) => (
                        <article
                          className="yh-plaza-patron-desk-card"
                          key={
                            clean(
                              item.id,
                            ) ||
                            `recommendation-${index}`
                          }
                        >
                          <div className="yh-plaza-patron-desk-card-head">
                            <span>
                              {titleCase(
                                item.status ||
                                  'pending_admin_review',
                              )}
                            </span>

                            <span>
                              {clean(
                                item.region,
                              ) ||
                                'Plaza'}
                            </span>
                          </div>

                          <h3>
                            {clean(
                              item.memberName ||
                                item.memberId,
                            ) ||
                              'Federation candidate'}
                          </h3>

                          <p>
                            {clean(
                              item.reason,
                            ) ||
                              'No recommendation reason available.'}
                          </p>

                          <div className="yh-plaza-patron-desk-chips">
                            <span>
                              {clean(
                                item.recommendedRole,
                              ) ||
                                'Recommended member'}
                            </span>

                            <span>
                              {formatDate(
                                item.updatedAt ||
                                  item.createdAt,
                              )}
                            </span>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="yh-plaza-patron-desk-section">
                <div className="yh-plaza-patron-desk-section-head">
                  <div>
                    <span className="yh-plaza-react-kicker">
                      Commission Visibility
                    </span>

                    <h2>
                      Payout Records
                    </h2>
                  </div>
                </div>

                {!payouts.length ? (
                  <div className="yh-plaza-react-state">
                    No Patron
                    commission payout
                    record yet.
                  </div>
                ) : (
                  <div className="yh-plaza-patron-desk-list">
                    {payouts.map(
                      (
                        item,
                        index,
                      ) => {
                        const amount =
                          Number(
                            item.commissionAmount ||
                              item.amount ||
                              0,
                          )

                        const currency =
                          clean(
                            item.currency,
                          )
                            .toUpperCase() ||
                          'USD'

                        const status =
                          clean(
                            item.payoutLedgerStatus ||
                              item.status,
                          ) ||
                          'pending_review'

                        return (
                          <article
                            className="yh-plaza-patron-desk-card"
                            key={
                              clean(
                                item.payoutLedgerId ||
                                  item.id,
                              ) ||
                              `payout-${index}`
                            }
                          >
                            <div className="yh-plaza-patron-desk-card-head">
                              <span>
                                {titleCase(
                                  status,
                                )}
                              </span>

                              <span>
                                {clean(
                                  item.region ||
                                    item.sourceDivision,
                                ) ||
                                  'Plaza'}
                              </span>
                            </div>

                            <h3>
                              {formatMoney(
                                amount,
                                currency,
                              )}
                            </h3>

                            <p>
                              {clean(
                                item.adminNote ||
                                  item.metadata
                                    ?.payoutUnlockRule,
                              ) ||
                                'Awaiting admin review / payout processing.'}
                            </p>

                            <div className="yh-plaza-patron-desk-chips">
                              <span>
                                Ledger:{' '}
                                {clean(
                                  item.payoutLedgerId ||
                                    item.id,
                                ) ||
                                  'Pending'}
                              </span>

                              <span>
                                {titleCase(
                                  item.provider ||
                                    'manual',
                                )}
                              </span>

                              <span>
                                {formatDate(
                                  item.updatedAt ||
                                    item.createdAt,
                                )}
                              </span>
                            </div>
                          </article>
                        )
                      },
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
