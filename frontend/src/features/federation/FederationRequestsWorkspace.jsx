import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationRequestsWorkspace.css'

const STATUS_OPTIONS = [
  ['all', 'All Requests'],
  ['pending_admin_match', 'Pending Admin Match'],
  ['pending_review', 'Pending Review'],
  ['matched', 'Matched'],
  ['pricing_sent', 'Pricing Sent'],
  ['paid', 'Paid'],
  ['intro_delivered', 'Introduction Delivered'],
  ['completed', 'Completed'],
  ['rejected', 'Rejected'],
]

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function enumLabel(value = '') {
  const raw =
    clean(value)
      .replace(/[_-]+/g, ' ')
      .trim()

  if (!raw) {
    return ''
  }

  return raw
    .split(/\s+/)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase(),
    )
    .join(' ')
}

function statusLabel(value = '') {
  const labels = {
    pending_admin_match:
      'Pending Admin Match',

    pending_review:
      'Pending Review',

    matched:
      'Matched',

    pricing_sent:
      'Pricing Sent',

    paid:
      'Paid',

    intro_delivered:
      'Introduction Delivered',

    completed:
      'Completed',

    rejected:
      'Rejected',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    enumLabel(value) ||
    'Pending Admin Match'
  )
}

function budgetLabel(value = '') {
  const labels = {
    not_sure:
      'Not Sure Yet',

    under_500:
      'Under $500',

    '500_1500':
      '$500 - $1,500',

    '1500_5000':
      '$1,500 - $5,000',

    '5000_plus':
      '$5,000+',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    'Not Sure Yet'
  )
}

function urgencyLabel(value = '') {
  const labels = {
    normal:
      'Normal',

    this_week:
      'This Week',

    urgent:
      'Urgent',

    exploring:
      'Exploring',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    'Normal'
  )
}

function introTypeLabel(value = '') {
  const labels = {
    admin_brokered:
      'Admin-Brokered Introduction',

    operator_intro:
      'Operator Warm Introduction',

    contact_package:
      'Contact Package After Approval',

    not_sure:
      'Not Sure Yet',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    enumLabel(value) ||
    'Admin-Brokered Introduction'
  )
}

function paymentStatusLabel(value = '') {
  const labels = {
    not_started:
      'Not Started',

    provider_selected:
      'Payment Method Selected',

    checkout_started:
      'Checkout Started',

    pending:
      'Pending',

    pending_payment:
      'Pending Payment',

    processing:
      'Processing',

    paid:
      'Paid',

    failed:
      'Payment Failed',

    cancelled:
      'Cancelled',

    refunded:
      'Refunded',
  }

  return (
    labels[
      clean(
        value ||
          'not_started',
      ).toLowerCase()
    ] ||
    enumLabel(value) ||
    'Not Started'
  )
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
    return `${code} ${numeric.toLocaleString()}`
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
    return (
      clean(value) ||
      'Pending'
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

function normalizeRequest(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(raw.id) ||
      `federation-request-${index + 1}`,

    requesterUid:
      clean(
        raw.requesterUid,
      ),

    ownerUid:
      clean(
        raw.ownerUid,
      ),

    leadId:
      clean(
        raw.leadId,
      ),

    opportunityTitle:
      clean(
        raw.opportunityTitle ||
          raw.title,
      ) ||
      'Connection request',

    status:
      clean(
        raw.status,
      ) ||
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
      clean(
        raw.urgency,
      ) ||
      'normal',

    preferredIntroType:
      clean(
        raw.preferredIntroType,
      ) ||
      'admin_brokered',

    requestReason:
      clean(
        raw.requestReason,
      ),

    intendedUse:
      clean(
        raw.intendedUse,
      ),

    notes:
      clean(
        raw.notes,
      ),

    pricingAmount:
      Number(
        raw.pricingAmount ||
          raw.dealPackage
            ?.pricingAmount ||
          0,
      ),

    currency:
      clean(
        raw.currency ||
          raw.dealPackage
            ?.currency,
      )
        .toUpperCase() ||
      'USD',

    platformCommissionAmount:
      Number(
        raw.platformCommissionAmount ||
          0,
      ),

    operatorPayoutAmount:
      Number(
        raw.operatorPayoutAmount ||
          0,
      ),

    paymentStatus:
      clean(
        raw.paymentStatus,
      ) ||
      'not_started',

    payoutStatus:
      clean(
        raw.payoutStatus,
      ) ||
      'not_started',

    commissionStatus:
      clean(
        raw.commissionStatus,
      ) ||
      'not_started',

    dealNotes:
      clean(
        raw.dealNotes,
      ),

    paymentLedgerId:
      clean(
        raw.paymentLedgerId,
      ),

    paymentLedgerStatus:
      clean(
        raw.paymentLedgerStatus,
      ),

    selectedPaymentProvider:
      clean(
        raw.selectedPaymentProvider,
      ).toLowerCase(),

    paymentProviderLabel:
      clean(
        raw.paymentProviderLabel,
      ),

    paymentProviderOptions:
      safeArray(
        raw.paymentProviderOptions,
      ).length
        ? safeArray(
            raw.paymentProviderOptions,
          )
        : [
            'stripe',
            'oxapay',
          ],

    leadAccessGrantId:
      clean(
        raw.leadAccessGrantId,
      ),

    leadAccessStatus:
      clean(
        raw.leadAccessStatus,
      ),

    createdAt:
      clean(
        raw.createdAt,
      ),

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

function hasDealPackage(
  request,
) {
  const payment =
    clean(
      request.paymentStatus,
    ).toLowerCase()

  const payout =
    clean(
      request.payoutStatus,
    ).toLowerCase()

  const commission =
    clean(
      request.commissionStatus,
    ).toLowerCase()

  return (
    Number(
      request.pricingAmount ||
        0,
    ) > 0 ||
    Number(
      request.platformCommissionAmount ||
        0,
    ) > 0 ||
    Number(
      request.operatorPayoutAmount ||
        0,
    ) > 0 ||
    (payment &&
      ![
        'none',
        'not_started',
      ].includes(
        payment,
      )) ||
    (payout &&
      ![
        'none',
        'not_started',
      ].includes(
        payout,
      )) ||
    (commission &&
      ![
        'none',
        'not_started',
      ].includes(
        commission,
      )) ||
    Boolean(
      request.dealNotes,
    )
  )
}

function isPaid(
  request,
) {
  const status =
    clean(
      request.status,
    ).toLowerCase()

  const payment =
    clean(
      request.paymentStatus,
    ).toLowerCase()

  return (
    [
      'paid',
      'intro_delivered',
      'completed',
    ].includes(
      status,
    ) ||
    payment ===
      'paid'
  )
}

function paymentBlockReason(
  request,
  keys,
) {
  if (
    request.ownerUid &&
    keys.has(
      request.ownerUid,
    )
  ) {
    return 'You cannot purchase your own Federation lead.'
  }

  const amount =
    Number(
      request.pricingAmount ||
        0,
    )

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    return 'This Federation lead does not have a payable price yet.'
  }

  if (
    clean(
      request.paymentStatus,
    ).toLowerCase() ===
    'paid'
  ) {
    return 'This Federation lead has already been paid.'
  }

  if (
    [
      'paid',
      'intro_delivered',
      'completed',
      'rejected',
    ].includes(
      clean(
        request.status,
      ).toLowerCase(),
    )
  ) {
    return 'This Federation request is no longer available for payment.'
  }

  return ''
}

export default function FederationRequestsWorkspace({
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
    filter,
    setFilter,
  ] = useState('all')

  const checkoutHandledRef = useRef(false)
  const [checkoutNotice, setCheckoutNotice] = useState(null)

  const [
    busy,
    setBusy,
  ] = useState({})

  const [
    unlocked,
    setUnlocked,
  ] = useState({})

  const [
    actionErrors,
    setActionErrors,
  ] = useState({})

  const loadRequests =
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

          setMe(
            meResult || {},
          )

          const approved =
            meResult
              ?.canEnterFederation ===
              true ||
            clean(
              meResult
                ?.applicationStatus,
            ).toLowerCase() ===
              'approved'

          if (!approved) {
            setRequests([])
            return
          }

          const result =
            await apiFetch(
              '/api/federation/connect/my-requests',
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            )

          const normalizedRequests = safeArray(
            result?.requests,
          ).map(normalizeRequest)
          setRequests(normalizedRequests)
          return normalizedRequests
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Could not load Federation requests.',
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
    void loadRequests(refreshVersion > 0)
  }, [loadRequests, refreshVersion])

  useEffect(() => {
    if (checkoutHandledRef.current) return

    const url = new URL(window.location.href)
    const checkout = String(
      url.searchParams.get('checkout') || ''
    ).toLowerCase()
    const requestId = String(
      url.searchParams.get('request') || ''
    ).trim()

    const isStripe = [
      'success', 'cancelled', 'canceled'
    ].includes(checkout)

    const isOxaPay = [
      'oxapay-success',
      'oxapay-cancelled',
      'oxapay-canceled'
    ].includes(checkout)

    if (!requestId || (!isStripe && !isOxaPay)) return

    checkoutHandledRef.current = true

    const provider = isOxaPay ? 'OxaPay' : 'Stripe'
    const cancelled = [
      'cancelled', 'canceled',
      'oxapay-cancelled', 'oxapay-canceled'
    ].includes(checkout)

    url.searchParams.delete('checkout')
    url.searchParams.delete('request')
    url.searchParams.delete('session_id')

    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search + url.hash
    )

    if (cancelled) {
      setCheckoutNotice({
        type: 'error',
        message: 'Checkout was cancelled. Your lead purchase was not completed.'
      })
      return
    }

    setCheckoutNotice({
      type: 'success',
      message: 'Checking payment confirmation and refreshing your lead purchase request...'
    })

    const refresh = async () => {
      try {
        const fresh = await loadRequests(true)
        const request = Array.isArray(fresh)
          ? fresh.find(item => String(item.id) === requestId)
          : null

        if (!request) {
          setCheckoutNotice({
            type: 'error',
            message: 'Checkout returned, but this request was not found in your request list yet. Refresh My Requests in a moment.'
          })
          return
        }

        if (!isPaid(request)) {
          setCheckoutNotice({
            type: 'success',
            message: isOxaPay
              ? 'OxaPay invoice opened successfully. If you already paid, the crypto confirmation may still be processing. Wait a moment, then refresh My Requests.'
              : 'Stripe checkout returned, but payment confirmation has not reached the server yet. Wait a moment, then refresh My Requests.'
          })
          return
        }

        onDataChanged?.()
        setCheckoutNotice({
          type: 'success',
          message: 'Payment confirmed. Full lead details are now ready to unlock for this buyer account.'
        })

        try {
          const result = await apiFetch(
            '/api/federation/connect/requests/' +
              encodeURIComponent(requestId) +
              '/unlocked-lead',
            { method: 'GET', cache: 'no-store' }
          )

          if (result?.lead) {
            setUnlocked(current => ({
              ...current,
              [requestId]: result.lead
            }))

            setRequests(current => current.map(item =>
              item.id === requestId
                ? {
                    ...item,
                    leadAccessGrantId:
                      result.grant?.id || item.leadAccessGrantId,
                    leadAccessStatus:
                      result.grant?.accessStatus || 'unlocked'
                  }
                : item
            ))
          }
        } catch (error) {
          console.error(
            'Federation post-checkout auto unlock error:',
            error
          )
        }
      } catch (error) {
        setCheckoutNotice({
          type: 'error',
          message: error?.message ||
            provider + ' checkout returned, but the request could not be refreshed.'
        })
      }
    }

    void refresh()
  }, [loadRequests])

  const approved =
    me?.canEnterFederation ===
      true ||
    clean(
      me?.applicationStatus,
    ).toLowerCase() ===
      'approved'

  const currentKeys =
    useMemo(
      () =>
        identityKeys(
          me || {},
        ),
      [me],
    )

  const filtered =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            filter ===
              'all' ||
            clean(
              request.status,
            ).toLowerCase() ===
              filter,
        ),
      [
        requests,
        filter,
      ],
    )

  const paidCount =
    useMemo(
      () =>
        requests.filter(
          isPaid,
        ).length,
      [requests],
    )

  const payableCount =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            !paymentBlockReason(
              request,
              currentKeys,
            ),
        ).length,
      [
        requests,
        currentKeys,
      ],
    )

  const updateRequest =
    (
      id,
      patch,
    ) => {
      onDataChanged?.()
      setRequests(
        (current) =>
          current.map(
            (item) =>
              item.id === id
                ? normalizeRequest({
                    ...item,
                    ...patch,
                  })
                : item,
          ),
      )
    }

  const setBusyFor =
    (
      id,
      value,
    ) => {
      setBusy(
        (current) => ({
          ...current,
          [id]: value,
        }),
      )
    }

  const setErrorFor =
    (
      id,
      value,
    ) => {
      setActionErrors(
        (current) => ({
          ...current,
          [id]: value,
        }),
      )
    }

  const chooseProvider =
    async (
      request,
      provider,
    ) => {
      const block =
        paymentBlockReason(
          request,
          currentKeys,
        )

      if (block) {
        onToast?.(
          block,
          'error',
        )
        return
      }

      setBusyFor(
        request.id,
        `provider:${provider}`,
      )

      setErrorFor(
        request.id,
        '',
      )

      try {
        const result =
          await apiFetch(
            `/api/federation/connect/requests/${encodeURIComponent(
              request.id,
            )}/payment-provider`,
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  provider,
                }),
            },
          )

        if (
          !result?.payment
            ?.id
        ) {
          throw new Error(
            'Payment ledger was not returned.',
          )
        }

        updateRequest(
          request.id,
          {
            paymentLedgerId:
              result.payment
                .id,

            paymentLedgerStatus:
              result.payment
                .status,

            selectedPaymentProvider:
              result.provider ||
              provider,

            paymentProviderLabel:
              result.providerLabel ||
              (provider ===
              'stripe'
                ? 'Stripe'
                : 'OxaPay'),

            paymentProviderOptions:
              result.payment
                .providerOptions ||
              [
                'stripe',
                'oxapay',
              ],

            paymentStatus:
              'provider_selected',
          },
        )

        onToast?.(
          `${
            result.providerLabel ||
            (provider ===
            'stripe'
              ? 'Stripe'
              : 'OxaPay')
          } selected.`,
          'success',
        )
      } catch (
        error
      ) {
        const message =
          error?.message ||
          'Failed to select payment provider.'

        setErrorFor(
          request.id,
          message,
        )

        onToast?.(
          message,
          'error',
        )
      } finally {
        setBusyFor(
          request.id,
          '',
        )
      }
    }

  const startCheckout =
    async (
      request,
      provider,
    ) => {
      const block =
        paymentBlockReason(
          request,
          currentKeys,
        )

      if (block) {
        onToast?.(
          block,
          'error',
        )
        return
      }

      const endpoint =
        provider ===
        'oxapay'
          ? `/api/federation/connect/requests/${encodeURIComponent(
              request.id,
            )}/oxapay-invoice`
          : `/api/federation/connect/requests/${encodeURIComponent(
              request.id,
            )}/checkout-session`

      setBusyFor(
        request.id,
        `checkout:${provider}`,
      )

      setErrorFor(
        request.id,
        '',
      )

      try {
        const result =
          await apiFetch(
            endpoint,
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  provider,
                }),
            },
          )

        if (!result?.url) {
          throw new Error(
            provider ===
            'oxapay'
              ? 'OxaPay invoice URL was not returned.'
              : 'Stripe checkout URL was not returned.',
          )
        }

        updateRequest(
          request.id,
          {
            selectedPaymentProvider:
              provider,

            paymentProviderLabel:
              provider ===
              'oxapay'
                ? 'OxaPay'
                : 'Stripe',

            paymentLedgerId:
              result.paymentLedgerId ||
              request.paymentLedgerId,

            paymentLedgerStatus:
              'checkout_started',

            paymentStatus:
              'checkout_started',
          },
        )

        window.location.href =
          result.url
      } catch (
        error
      ) {
        const message =
          error?.message ||
          'Could not open payment checkout.'

        setErrorFor(
          request.id,
          message,
        )

        onToast?.(
          message,
          'error',
        )
      } finally {
        setBusyFor(
          request.id,
          '',
        )
      }
    }

  const unlockLead =
    async (
      request,
    ) => {
      if (
        !request.id ||
        !request.ownerUid ||
        !request.leadId ||
        !isPaid(
          request,
        )
      ) {
        onToast?.(
          'This request is not ready to unlock lead details yet.',
          'error',
        )

        return
      }

      setBusyFor(
        request.id,
        'unlock',
      )

      setErrorFor(
        request.id,
        '',
      )

      try {
        const result =
          await apiFetch(
            `/api/federation/connect/requests/${encodeURIComponent(
              request.id,
            )}/unlocked-lead`,
            {
              method:
                'GET',

              cache:
                'no-store',
            },
          )

        if (
          !result?.lead
        ) {
          throw new Error(
            'Unlocked lead details were not returned.',
          )
        }

        setUnlocked(
          (current) => ({
            ...current,

            [request.id]:
              result.lead,
          }),
        )

        updateRequest(
          request.id,
          {
            leadAccessGrantId:
              result.grant
                ?.id ||
              request.leadAccessGrantId,

            leadAccessStatus:
              result.grant
                ?.accessStatus ||
              'unlocked',
          },
        )

        onToast?.(
          'Lead details unlocked for this paid request.',
          'success',
        )
      } catch (
        error
      ) {
        const message =
          error?.message ||
          'Failed to unlock lead details.'

        setErrorFor(
          request.id,
          message,
        )

        onToast?.(
          message,
          'error',
        )
      } finally {
        setBusyFor(
          request.id,
          '',
        )
      }
    }

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-requests-react-workspace">
        <div className="yh-federation-requests-state">
          Loading your
          Federation requests...
        </div>
      </section>
    )
  }

  if (!approved) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-requests-react-workspace">
        <div className="yh-federation-requests-state">
          <span className="yh-federation-requests-kicker">
            Federation Requests
          </span>

          <h1>
            Federation approval
            required
          </h1>

          <p>
            Your connection
            request pipeline
            unlocks after
            Federation access is
            approved.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-requests-react-workspace"
      data-yh-dashboard-react-surface="federation-requests"
    >
      <div className="yh-federation-requests-scroll">
        <div className="yh-federation-requests-shell">
          <header className="yh-federation-requests-hero">
            <div>
              <span className="yh-federation-requests-kicker">
                Federation /
                My Requests
              </span>

              <h1>
                Connection
                Requests
              </h1>

              <p>
                Track admin
                matching,
                pricing,
                payment,
                introduction
                delivery, and
                paid lead access.
              </p>
            </div>

            <div className="yh-federation-requests-hero-actions">
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

              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                disabled={
                  refreshing
                }
                onClick={() =>
                  void loadRequests(
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

          {checkoutNotice && (
            <div
              className={
                'yh-federation-requests-state' +
                (checkoutNotice.type === 'error' ? ' is-error' : '')
              }
              role={checkoutNotice.type === 'error' ? 'alert' : 'status'}
            >
              {checkoutNotice.message}
            </div>
          )}

          <section className="yh-federation-requests-summary">
            <article>
              <small>
                Total Requests
              </small>

              <strong>
                {
                  requests.length
                }
              </strong>
            </article>

            <article>
              <small>
                Awaiting Review
              </small>

              <strong>
                {
                  requests.filter(
                    (request) =>
                      [
                        'pending_admin_match',
                        'pending_review',
                      ].includes(
                        clean(
                          request.status,
                        ).toLowerCase(),
                      ),
                  ).length
                }
              </strong>
            </article>

            <article>
              <small>
                Payable Leads
              </small>

              <strong>
                {
                  payableCount
                }
              </strong>
            </article>

            <article>
              <small>
                Paid / Delivered
              </small>

              <strong>
                {
                  paidCount
                }
              </strong>
            </article>
          </section>

          <section className="yh-federation-requests-toolbar">
            <label>
              <span>
                Status
              </span>

              <select
                className="input-field"
                value={
                  filter
                }
                onChange={(
                  event,
                ) =>
                  setFilter(
                    event.target
                      .value,
                  )
                }
              >
                {STATUS_OPTIONS.map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </section>

          {!filtered.length ? (
            <div className="yh-federation-requests-state">
              <strong>
                No matching
                connection
                requests yet.
              </strong>

              <span>
                Requests submitted
                through Connect
                appear here with
                admin review,
                pricing,
                delivery and
                completion state.
              </span>
            </div>
          ) : (
            <div className="yh-federation-requests-list">
              {filtered.map(
                (request) => {
                  const block =
                    paymentBlockReason(
                      request,
                      currentKeys,
                    )

                  const ownLead =
                    Boolean(
                      request.ownerUid &&
                        currentKeys.has(
                          request.ownerUid,
                        ),
                    )

                  const paid =
                    isPaid(
                      request,
                    )

                  const lead =
                    unlocked[
                      request.id
                    ]

                  const selectedProvider =
                    request.selectedPaymentProvider

                  const currentBusy =
                    busy[
                      request.id
                    ] ||
                    ''

                  return (
                    <article
                      className="yh-federation-request-card"
                      key={
                        request.id
                      }
                    >
                      <div className="yh-federation-request-card-head">
                        <div>
                          <span className="yh-federation-requests-kicker">
                            {statusLabel(
                              request.status,
                            )}
                          </span>

                          <h3>
                            {
                              request.opportunityTitle
                            }
                          </h3>
                        </div>

                        <b>
                          {statusLabel(
                            request.status,
                          )}
                        </b>
                      </div>

                      <p>
                        {request.requestReason ||
                          'No request reason stored.'}
                      </p>

                      <div className="yh-federation-request-metrics">
                        <div>
                          <strong>
                            {budgetLabel(
                              request.budgetRange,
                            )}
                          </strong>

                          <small>
                            Budget
                            range
                          </small>
                        </div>

                        <div>
                          <strong>
                            {urgencyLabel(
                              request.urgency,
                            )}
                          </strong>

                          <small>
                            Urgency
                          </small>
                        </div>

                        <div>
                          <strong>
                            {introTypeLabel(
                              request.preferredIntroType,
                            )}
                          </strong>

                          <small>
                            Intro type
                          </small>
                        </div>

                        <div>
                          <strong>
                            {formatDate(
                              request.createdAt,
                            )}
                          </strong>

                          <small>
                            Submitted
                          </small>
                        </div>
                      </div>

                      {request.intendedUse && (
                        <div className="yh-federation-request-note">
                          <strong>
                            Intended use
                          </strong>

                          <span>
                            {
                              request.intendedUse
                            }
                          </span>
                        </div>
                      )}

                      {hasDealPackage(
                        request,
                      ) && (
                        <section className="yh-federation-request-deal">
                          <div className="yh-federation-request-deal-grid">
                            <div>
                              <strong>
                                {formatMoney(
                                  request.pricingAmount,
                                  request.currency,
                                )}
                              </strong>

                              <small>
                                Total
                                access
                                price
                              </small>
                            </div>

                            <div>
                              <strong>
                                {paymentStatusLabel(
                                  request.paymentStatus,
                                )}
                              </strong>

                              <small>
                                Payment
                              </small>
                            </div>

                            <div>
                              <strong>
                                {formatMoney(
                                  request.platformCommissionAmount,
                                  request.currency,
                                )}
                              </strong>

                              <small>
                                Universe
                                commission
                              </small>
                            </div>

                            <div>
                              <strong>
                                {formatMoney(
                                  request.operatorPayoutAmount,
                                  request.currency,
                                )}
                              </strong>

                              <small>
                                Operator
                                payout
                              </small>
                            </div>
                          </div>

                          {request.dealNotes && (
                            <p>
                              {
                                request.dealNotes
                              }
                            </p>
                          )}
                        </section>
                      )}

                      {ownLead ? (
                        <section className="yh-federation-request-payment-panel">
                          <span className="yh-federation-requests-kicker">
                            Own Lead
                          </span>

                          <h4>
                            Purchase
                            unavailable
                          </h4>

                          <p>
                            This
                            Federation
                            lead belongs
                            to your own
                            account. You
                            cannot
                            purchase or
                            unlock your
                            own lead.
                          </p>

                          <button
                            type="button"
                            className="yh-fed-action yh-fed-action-secondary"
                            disabled
                          >
                            Your Lead —
                            Not
                            Purchasable
                          </button>
                        </section>
                      ) : !block ? (
                        <section className="yh-federation-request-payment-panel">
                          <span className="yh-federation-requests-kicker">
                            Choose
                            Payment
                            Method
                          </span>

                          <h4>
                            Pay with
                            Stripe or
                            OxaPay
                          </h4>

                          <p>
                            Payment
                            unlocks
                            lifetime
                            access for
                            your account
                            only.
                          </p>

                          <div className="yh-federation-request-payment-actions">
                            <button
                              type="button"
                              className={
                                selectedProvider ===
                                'stripe'
                                  ? 'yh-fed-action yh-fed-action-primary'
                                  : 'yh-fed-action yh-fed-action-secondary'
                              }
                              disabled={
                                Boolean(
                                  currentBusy,
                                )
                              }
                              onClick={() =>
                                void chooseProvider(
                                  request,
                                  'stripe',
                                )
                              }
                            >
                              {currentBusy ===
                              'provider:stripe'
                                ? 'Selecting...'
                                : 'Stripe: Card / Bank / Wallet'}
                            </button>

                            <button
                              type="button"
                              className={
                                selectedProvider ===
                                'oxapay'
                                  ? 'yh-fed-action yh-fed-action-primary'
                                  : 'yh-fed-action yh-fed-action-secondary'
                              }
                              disabled={
                                Boolean(
                                  currentBusy,
                                )
                              }
                              onClick={() =>
                                void chooseProvider(
                                  request,
                                  'oxapay',
                                )
                              }
                            >
                              {currentBusy ===
                              'provider:oxapay'
                                ? 'Selecting...'
                                : 'OxaPay: Crypto'}
                            </button>
                          </div>

                          {selectedProvider ===
                            'stripe' && (
                            <button
                              type="button"
                              className="yh-fed-action yh-fed-action-primary"
                              disabled={
                                Boolean(
                                  currentBusy,
                                )
                              }
                              onClick={() =>
                                void startCheckout(
                                  request,
                                  'stripe',
                                )
                              }
                            >
                              {currentBusy ===
                              'checkout:stripe'
                                ? 'Opening Stripe...'
                                : 'Continue to Stripe Checkout'}
                            </button>
                          )}

                          {selectedProvider ===
                            'oxapay' && (
                            <button
                              type="button"
                              className="yh-fed-action yh-fed-action-primary"
                              disabled={
                                Boolean(
                                  currentBusy,
                                )
                              }
                              onClick={() =>
                                void startCheckout(
                                  request,
                                  'oxapay',
                                )
                              }
                            >
                              {currentBusy ===
                              'checkout:oxapay'
                                ? 'Opening OxaPay...'
                                : 'Continue to OxaPay Crypto Invoice'}
                            </button>
                          )}
                        </section>
                      ) : paid &&
                        request.ownerUid &&
                        request.leadId ? (
                        <section className="yh-federation-request-payment-panel">
                          <span className="yh-federation-requests-kicker">
                            Paid Lead
                          </span>

                          <h4>
                            Lead access
                            available
                          </h4>

                          <p>
                            Payment is
                            confirmed.
                            Full lead
                            details can
                            now be
                            unlocked for
                            this buyer
                            only.
                          </p>

                          {!lead && (
                            <button
                              type="button"
                              className="yh-fed-action yh-fed-action-primary"
                              disabled={
                                Boolean(
                                  currentBusy,
                                )
                              }
                              onClick={() =>
                                void unlockLead(
                                  request,
                                )
                              }
                            >
                              {currentBusy ===
                              'unlock'
                                ? 'Unlocking Lead...'
                                : 'View Lead Details'}
                            </button>
                          )}
                        </section>
                      ) : null}

                      {lead && (
                        <section className="yh-federation-unlocked-lead">
                          <span className="yh-federation-requests-kicker">
                            Unlocked
                            Lead Details
                          </span>

                          <h4>
                            {clean(
                              lead.companyName ||
                                lead.contactName,
                            ) ||
                              'Purchased Lead'}
                          </h4>

                          <div className="yh-federation-unlocked-grid">
                            {[
                              [
                                'Contact',
                                lead.contactName,
                              ],
                              [
                                'Role',
                                lead.contactRole,
                              ],
                              [
                                'Company',
                                lead.companyName,
                              ],
                              [
                                'Website',
                                lead.companyWebsite,
                              ],
                              [
                                'Email',
                                lead.email,
                              ],
                              [
                                'Phone',
                                lead.phone,
                              ],
                              [
                                'Location',
                                [
                                  lead.city,
                                  lead.country,
                                ]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    ', ',
                                  ),
                              ],
                              [
                                'Source',
                                enumLabel(
                                  lead.sourceMethod,
                                ),
                              ],
                              [
                                'Next Action',
                                enumLabel(
                                  lead.nextAction,
                                ),
                              ],
                            ]
                              .filter(
                                ([
                                  ,
                                  value,
                                ]) =>
                                  clean(
                                    value,
                                  ),
                              )
                              .map(
                                ([
                                  label,
                                  value,
                                ]) => (
                                  <div
                                    key={
                                      label
                                    }
                                  >
                                    <small>
                                      {label}
                                    </small>

                                    <strong>
                                      {value}
                                    </strong>
                                  </div>
                                ),
                              )}
                          </div>

                          {lead.notes && (
                            <p>
                              {
                                lead.notes
                              }
                            </p>
                          )}
                        </section>
                      )}

                      {actionErrors[
                        request.id
                      ] && (
                        <div className="yh-federation-request-error">
                          {
                            actionErrors[
                              request.id
                            ]
                          }
                        </div>
                      )}
                    </article>
                  )
                },
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
