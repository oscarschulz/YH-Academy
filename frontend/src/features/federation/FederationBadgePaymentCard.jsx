import {
  useMemo,
  useState,
} from 'react'

import {
  apiFetch,
} from '../../services/api/apiClient'

import './FederationBadgePaymentCard.css'

const PENDING_BADGE_STATUSES =
  new Set([
    'pending',
    'pending_payment',
    'draft',
    'checkout_started',
  ])

function clean(value = '') {
  return String(
    value ?? '',
  )
    .trim()
    .toLowerCase()
}

function getMemberCandidates(
  member,
) {
  return [
    member,
    member?.member,
    member?.currentUser,
    member?.application,
    member?.profile,
  ].filter(
    (value) =>
      value &&
      typeof value ===
        'object',
  )
}

function getFederationBadge(
  member,
) {
  for (
    const candidate of
    getMemberCandidates(
      member,
    )
  ) {
    const badges =
      candidate
        ?.verificationBadges

    if (
      badges &&
      typeof badges ===
        'object' &&
      badges.federation &&
      typeof badges.federation ===
        'object'
    ) {
      return badges.federation
    }
  }

  return null
}

function getBadgeStatus(
  member,
) {
  const badge =
    getFederationBadge(
      member,
    )

  return clean(
    badge?.status,
  )
}

export function badgeIsActive(member) {
  const badge = getFederationBadge(member)
  return Boolean(badge && (badge.active === true || ['active', 'verified'].includes(clean(badge.status))))
}

function revenueCatRuntime() {
  return (
    window
      .YHNativeRuntime
      ?.revenueCat ||
    null
  )
}

function revenueCatAvailable() {
  try {
    return window.YHNativeRuntime?.getPlatform?.() === 'ios' &&
      revenueCatRuntime()?.isAvailable?.() === true
  } catch { return false }
}

function getOfferingPackage(
  offering,
  billingPlan,
) {
  if (!offering) {
    return null
  }

  const packages =
    Array.isArray(
      offering
        .availablePackages,
    )
      ? offering
          .availablePackages
      : []

  if (
    billingPlan ===
    'monthly'
  ) {
    return (
      offering.monthly ||
      packages.find(
        (item) =>
          item?.identifier ===
          '$rc_monthly',
      ) ||
      null
    )
  }

  if (
    billingPlan ===
    'one_time'
  ) {
    return (
      packages.find(
        (item) =>
          item?.identifier ===
          'yhf_30day',
      ) ||
      null
    )
  }

  if (
    billingPlan ===
    'lifetime'
  ) {
    return (
      offering.lifetime ||
      packages.find(
        (item) =>
          item?.identifier ===
          '$rc_lifetime',
      ) ||
      null
    )
  }

  return null
}

function priceForPackage(
  packageItem,
) {
  return String(
    packageItem
      ?.product
      ?.priceString ||
      '',
  ).trim()
}

function purchaseWasCancelled(
  result,
) {
  return (
    result?.userCancelled ===
      true ||
    result?.userCanceled ===
      true
  )
}

export default function FederationBadgePaymentCard({
  member,
  onToast,
  onDataChanged,
}) {
  const [
    busy,
    setBusy,
  ] = useState('')

  const [
    offering,
    setOffering,
  ] = useState(null)

  const [
    billingPlan,
    setBillingPlan,
  ] = useState(
    'monthly',
  )

  const [
    locallyActive,
    setLocallyActive,
  ] = useState(false)

  const nativeApple =
    revenueCatAvailable()

  const active =
    locallyActive ||
    badgeIsActive(
      member,
    )

  const status =
    getBadgeStatus(
      member,
    )

  const pending =
    !active &&
    PENDING_BADGE_STATUSES.has(
      status,
    )

  const packages =
    useMemo(
      () => ({
        monthly:
          getOfferingPackage(
            offering,
            'monthly',
          ),

        one_time:
          getOfferingPackage(
            offering,
            'one_time',
          ),

        lifetime:
          getOfferingPackage(
            offering,
            'lifetime',
          ),
      }),
      [offering],
    )

  const loadOffering =
    async () => {
      const runtime =
        revenueCatRuntime()

      if (
        !runtime ||
        typeof runtime
          .getOfferings !==
          'function'
      ) {
        throw new Error(
          'Apple in-app purchase catalog is unavailable.',
        )
      }

      const result =
        await runtime
          .getOfferings()

      const nextOffering =
        result
          ?.all
          ?.yhf_offering ||
        null

      if (!nextOffering) {
        throw new Error(
          'YHF App Store offering is unavailable.',
        )
      }

      setOffering(
        nextOffering,
      )

      return nextOffering
    }

  const syncRevenueCat =
    async () => {
      const result =
        await apiFetch(
          '/api/payments/badges/federation/revenuecat-sync',
          {
            method: 'POST',

            body:
              JSON.stringify(
                {},
              ),
          },
        )

      if (
        result?.success !==
          true ||
        result?.badge
          ?.active !== true
      ) {
        throw new Error(
          'Apple confirmed the purchase, but YHF badge access could not be verified yet.',
        )
      }

      setLocallyActive(true)
      onDataChanged?.()

      return result
    }

  const handleApplePurchase =
    async () => {
      if (busy) return

      setBusy(
        'apple',
      )

      try {
        const runtime =
          revenueCatRuntime()

        if (!runtime) {
          throw new Error(
            'Apple in-app purchases are unavailable.',
          )
        }

        const currentOffering =
          offering ||
          await loadOffering()

        const packageItem =
          getOfferingPackage(
            currentOffering,
            billingPlan,
          )

        if (!packageItem) {
          throw new Error(
            'The selected YHF App Store product is unavailable.',
          )
        }

        if (
          typeof runtime
            .purchasePackage !==
          'function'
        ) {
          throw new Error(
            'Apple purchase service is unavailable.',
          )
        }

        const result =
          await runtime
            .purchasePackage(
              packageItem,
            )

        if (
          purchaseWasCancelled(
            result,
          )
        ) {
          return
        }

        await syncRevenueCat()

        onToast?.(
          'YHF Badge activated successfully.',
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Could not complete the Apple purchase.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const handleRestore =
    async () => {
      if (busy) return

      setBusy(
        'restore',
      )

      try {
        const runtime =
          revenueCatRuntime()

        if (
          !runtime ||
          typeof runtime
            .restorePurchases !==
            'function'
        ) {
          throw new Error(
            'Restore Purchases is unavailable.',
          )
        }

        await runtime
          .restorePurchases()

        await syncRevenueCat()

        onToast?.(
          'YHF App Store purchase restored successfully.',
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'No active YHF App Store purchase was found to restore.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const handleWebPayment = async provider => {
    if (busy || nativeApple) return
    const cleanProvider = clean(provider)
    const endpoints = {
      stripe: '/api/payments/badges/federation/checkout-session',
      oxapay: '/api/payments/badges/federation/oxapay-invoice',
      manual: '/api/payments/badges/federation/ledger',
    }
    if (!endpoints[cleanProvider]) return
    setBusy(cleanProvider)
    try {
      const result = await apiFetch(endpoints[cleanProvider], {
        method: 'POST',
        body: JSON.stringify({
          provider: cleanProvider,
          paymentMethod: cleanProvider === 'stripe' ? 'card_bank' : cleanProvider === 'oxapay' ? 'crypto' : 'manual',
          returnTo: window.location.pathname + window.location.search,
        }),
      })
      if (cleanProvider === 'manual') {
        if (!result?.payment?.id) throw new Error('YHF badge payment ledger was not returned.')
        onToast?.('YHF badge payment ledger created. Admin will activate it after payment confirmation.', 'success')
        onDataChanged?.()
        setBusy('')
        return
      }
      const url = String(result?.url || '').trim()
      if (!url) throw new Error(cleanProvider === 'stripe' ? 'Stripe checkout URL was not returned.' : 'OxaPay invoice URL was not returned.')
      window.location.href = url
    } catch (error) {
      onToast?.(error?.message || 'Could not start YHF badge payment.', 'error')
      setBusy('')
    }
  }

  if (active) {
    return (
      <section
        className="yh-federation-badge-payment-card is-active"
        data-yh-federation-badge="active"
      >
        <span className="yh-federation-badge-kicker">
          YHF Badge
        </span>

        <strong>
          Federation badge active
        </strong>

        <p>
          Your Federation verification badge is active.
          Private Federation Telegram access is unlocked.
        </p>

        <a
          className="yh-fed-action yh-fed-action-secondary yh-federation-badge-telegram"
          href="https://t.me/younghustlersteam"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open @younghustlersteam
        </a>
      </section>
    )
  }

  return (
    <section
      className="yh-federation-badge-payment-card"
      data-yh-federation-badge={
        pending
          ? 'pending'
          : 'available'
      }
    >
      <span className="yh-federation-badge-kicker">
        YHF Badge
      </span>

      <strong>
        {pending
          ? 'Badge payment pending'
          : 'Federation Verification Badge'}
      </strong>

      <p>
        {nativeApple
          ? 'Choose an App Store plan or restore an existing YHF purchase.'
          : 'Choose Stripe for card or bank payment, OxaPay for crypto, or Manual Review for admin-confirmed payment.'}
      </p>

      {nativeApple ? (
        <>
          <div className="yh-federation-badge-plans">
            {[
              [
                'monthly',
                'Monthly',
              ],
              [
                'one_time',
                '30-Day',
              ],
              [
                'lifetime',
                'Lifetime',
              ],
            ].map(
              ([
                value,
                label,
              ]) => {
                const price =
                  priceForPackage(
                    packages[value],
                  )

                return (
                  <button
                    key={value}
                    type="button"
                    className={
                      billingPlan ===
                      value
                        ? 'yh-fed-action yh-fed-action-primary'
                        : 'yh-fed-action yh-fed-action-secondary'
                    }
                    aria-pressed={
                      billingPlan ===
                      value
                    }
                    onClick={async () => {
                      setBillingPlan(
                        value,
                      )

                      if (!offering) {
                        try {
                          await loadOffering()
                        } catch (error) {
                          onToast?.(
                            error?.message ||
                              'Could not load App Store plans.',
                            'error',
                          )
                        }
                      }
                    }}
                  >
                    {label}
                    {price
                      ? ` · ${price}`
                      : ''}
                  </button>
                )
              },
            )}
          </div>

          {billingPlan ===
            'monthly' && (
            <p className="yh-federation-badge-note">
              Monthly access automatically renews unless
              cancelled through your Apple Account settings.
            </p>
          )}

          <div className="yh-federation-badge-actions">
            <button
              type="button"
              className="yh-fed-action yh-fed-action-primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void handleApplePurchase()
              }
            >
              {busy === 'apple'
                ? 'Opening Apple Purchase...'
                : 'Continue with Apple'}
            </button>

            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                void handleRestore()
              }
            >
              {busy === 'restore'
                ? 'Restoring...'
                : 'Restore Purchases'}
            </button>
          </div>
        </>
      ) : (
        <div className="yh-federation-badge-actions">
          <button
            type="button"
            className="yh-fed-action yh-fed-action-primary"
            disabled={Boolean(busy)}
            onClick={() =>
              void handleWebPayment(
                'stripe',
              )
            }
          >
            {busy === 'stripe'
              ? 'Opening Stripe...'
              : 'Pay with Stripe'}
          </button>

          <button
            type="button"
            className="yh-fed-action yh-fed-action-secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void handleWebPayment(
                'oxapay',
              )
            }
          >
            {busy === 'oxapay'
              ? 'Opening OxaPay...'
              : 'Pay with OxaPay'}
          </button>
          <button type="button" className="yh-fed-action yh-fed-action-secondary"
            disabled={Boolean(busy)} onClick={() => void handleWebPayment('manual')}>
            {busy === 'manual' ? 'Creating Ledger...' : 'Manual Review'}
          </button>
        </div>
      )}

      {nativeApple && (
        <p className="yh-federation-badge-legal">
          By continuing you agree to the YHU Terms,
          Privacy Policy and applicable Apple purchase terms.
        </p>
      )}
    </section>
  )
}
