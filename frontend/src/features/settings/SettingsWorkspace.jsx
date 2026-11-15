import { academyYhaRevenueCatRuntime, academyYhaIsNativeIos, academyYhaIsRevenueCatUserCancelled, academyYhaPackageFromOffering, academyYhaPurchaseWithRevenueCat, academyYhaRestoreWithRevenueCat } from './settingsRevenueCat.js'
import { SUBSCRIPTIONS_ENDPOINT, CHANGE_PASSWORD_ENDPOINT, BADGE_META, cleanText, planDivision, planKey, planCode, planCheckoutEndpoint, planUnsubscribeEndpoint, checkoutPayload, statusLabel, statusTone, formatMoney, formatDate, subscriptionExpiry, getCheckoutUrl, providerConfigured, clearClientAuth } from './settingsUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { createPortal } from 'react-dom'

function SubscriptionCard({
  item,
  busy,
  onSubscribe,
  onUnsubscribe,
  onBadgeAvail,
}) {
  const plan =
    item.plan &&
    typeof item.plan ===
      'object'
      ? item.plan
      : {}

  const badge =
    item.badge &&
    typeof item.badge ===
      'object'
      ? item.badge
      : {}

  const payment =
    item.payment &&
    typeof item.payment ===
      'object'
      ? item.payment
      : {}

  const division =
    planDivision(item)

  const key =
    planKey(item)

  const code =
    planCode(item)

  const title =
    cleanText(
      item.name ||
        plan.publicName ||
        plan.name ||
        '',
    ) ||
    `${code} Badge`

  const amount =
    Number(
      item.amountMonthly ||
        plan.amountMonthly ||
        badge.amountMonthly ||
        0,
    )

  const currency =
    cleanText(
      item.currency ||
        plan.currency ||
        badge.currency ||
        'USD',
    ).toUpperCase() ||
    'USD'

  const interval =
    cleanText(
      item.interval ||
        plan.interval ||
        badge.interval ||
        'month',
    ) || 'month'

  const active =
    item.active === true

  const includedWith =
    cleanText(
      item.includedWith ||
        item
          .includedBySubscription ||
        '',
    )

  const included =
    Boolean(includedWith)

  const unsubscribeEndpoint =
    planUnsubscribeEndpoint(
      item,
    )

  const checkoutEndpoint =
    planCheckoutEndpoint(
      item,
    )

  const verifiedBadge =
    key ===
      'verified_badge' &&
    [
      'academy',
      'federation',
    ].includes(division)

  const canUnsubscribe =
    active &&
    !included &&
    Boolean(
      unsubscribeEndpoint,
    )

  const canSubscribe =
    !active &&
    Boolean(
      checkoutEndpoint,
    )

  const activatedAt =
    formatDate(
      item.activatedAt ||
        badge.activatedAt ||
        badge.approvedAt ||
        '',
    )

  const expiresAt =
    formatDate(
      subscriptionExpiry(
        item,
      ),
    )

  const provider =
    cleanText(
      item.provider ||
        badge.provider ||
        payment.provider ||
        '',
    )

  const paymentStatus =
    cleanText(
      item.paymentStatus ||
        badge.paymentStatus ||
        payment.status ||
        '',
    )

  return (
    <article className="yh-dashboard-settings-subscription-card">
      <div className="yh-dashboard-settings-subscription-main">
        <div className="yh-dashboard-settings-subscription-title-row">
          <div>
            <strong>
              {title}
            </strong>

            <p>
              {formatMoney(
                amount,
                currency,
              )}
              {amount
                ? ` / ${interval}`
                : ''}
            </p>
          </div>

          <span
            className={`yh-dashboard-settings-status is-${statusTone(
              item,
            )}`}
          >
            {statusLabel(
              item,
            )}
          </span>
        </div>

        <div className="yh-dashboard-settings-subscription-meta">
          {division && (
            <span>
              Division:{' '}
              {division}
            </span>
          )}

          {provider && (
            <span>
              Provider:{' '}
              {provider}
            </span>
          )}

          {paymentStatus && (
            <span>
              Payment:{' '}
              {paymentStatus}
            </span>
          )}

          {activatedAt && (
            <span>
              Activated:{' '}
              {activatedAt}
            </span>
          )}

          {expiresAt && (
            <span>
              Active until:{' '}
              {expiresAt}
            </span>
          )}

          {includedWith && (
            <span>
              Included with:{' '}
              {includedWith}
            </span>
          )}
        </div>
      </div>

      <div className="yh-dashboard-settings-subscription-actions">
        {canUnsubscribe ? (
          <button
            type="button"
            className="btn-secondary yh-dashboard-settings-unsubscribe-btn"
            disabled={busy}
            onClick={() =>
              onUnsubscribe(
                item,
              )
            }
          >
            {busy
              ? 'Working...'
              : `Unsubscribe ${code}`}
          </button>
        ) : canSubscribe ? (
          <button
            type="button"
            className="btn-secondary yh-dashboard-settings-subscribe-btn"
            disabled={busy}
            onClick={() =>
              verifiedBadge
                ? onBadgeAvail(
                    item,
                  )
                : onSubscribe(
                    item,
                  )
            }
          >
            {busy
              ? 'Working...'
              : verifiedBadge
                ? `Avail ${code} Badge`
                : item.subscribeCta ||
                  plan.subscribeCta ||
                  `Subscribe ${code}`}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary yh-dashboard-settings-unsubscribe-btn"
            disabled
          >
            {included
              ? 'Managed by YHA'
              : active
                ? 'Active'
                : 'No active subscription'}
          </button>
        )}
      </div>
    </article>
  )
}


/* YHU_REACT_ACADEMY_REVENUECAT_PARITY */

export default function SettingsWorkspace({
  onToast,
  onLogout,
  checkoutOnly = false,
  onCheckoutClose,
}) {
  const [
    snapshot,
    setSnapshot,
  ] = useState({
    paymentPlans: [],
  })

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [busyKey, setBusyKey] =
    useState('')

  const [
    passwordOpen,
    setPasswordOpen,
  ] = useState(false)

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('')

  const [
    newPassword,
    setNewPassword,
  ] = useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('')

  const [
    passwordError,
    setPasswordError,
  ] = useState('')

  const [
    passwordBusy,
    setPasswordBusy,
  ] = useState(false)

  const [
    deleteOpen,
    setDeleteOpen,
  ] = useState(false)

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState('')

  const [
    deleteBusy,
    setDeleteBusy,
  ] = useState(false)

  const [
    badgePlan,
    setBadgePlan,
  ] = useState(() => checkoutOnly
    ? {
        item: { division: 'academy', key: 'verified_badge' },
        ...BADGE_META.academy
      }
    : null)

  const [
    badgeBilling,
    setBadgeBilling,
  ] = useState('monthly')

  const [
    badgeProvider,
    setBadgeProvider,
  ] = useState('stripe')

  const [
    providers,
    setProviders,
  ] = useState([])

  const [
    badgeBusy,
    setBadgeBusy,
  ] = useState(false)

  const [
    nativePrice,
    setNativePrice,
  ] = useState('')

  const nativeIosBadge =
    useMemo(
      () =>
        Boolean(
          badgePlan &&
          [
            'academy',
            'federation',
          ].includes(
            badgePlan.division,
          ) &&
          academyYhaIsNativeIos()
        ),
      [badgePlan],
    )

  const settingsRequestRef =
    useRef(0)

  const passwordDialogRef =
    useRef(null)

  const deleteDialogRef =
    useRef(null)

  const resetPasswordDialog =
    useCallback(() => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    }, [])

  const closePasswordDialog =
    useCallback(() => {
      if (passwordBusy) return

      resetPasswordDialog()
      setPasswordOpen(false)
    }, [
      passwordBusy,
      resetPasswordDialog,
    ])

  const openPasswordDialog =
    useCallback(() => {
      resetPasswordDialog()
      setPasswordOpen(true)
    }, [
      resetPasswordDialog,
    ])

  const closeDeleteDialog =
    useCallback(() => {
      if (deleteBusy) return

      setDeleteConfirmation('')
      setDeleteOpen(false)
    }, [
      deleteBusy,
    ])

  const loadSettings =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        const requestId =
          ++settingsRequestRef.current

        setLoading(true)

        if (!silent) {
          setError('')
        }

        try {
          const result =
            await apiFetch(
              SUBSCRIPTIONS_ENDPOINT,
              {
                method: 'GET',
              },
            )

          if (
            requestId !==
            settingsRequestRef.current
          ) {
            return result
          }

          setSnapshot(
            result &&
            typeof result ===
              'object'
              ? result
              : {
                  paymentPlans: [],
                },
          )

          setError('')

          return result
        } catch (loadError) {
          if (
            requestId !==
            settingsRequestRef.current
          ) {
            return null
          }

          const message =
            loadError?.message ||
            'Failed to load subscriptions and payment plans.'

          setError(message)

          if (!silent) {
            onToast?.(
              message,
              'error',
            )
          }

          throw loadError
        } finally {
          if (
            requestId ===
            settingsRequestRef.current
          ) {
            setLoading(false)
          }
        }
      },
      [onToast],
    )

  const loadProviders =
    useCallback(async () => {
      try {
        const result =
          await apiFetch(
            '/api/payments/options',
            {
              method: 'GET',
            },
          )

        const list =
          Array.isArray(
            result?.paymentProviders,
          )
            ? result.paymentProviders
            : []

        setProviders(list)

        return list
      } catch {
        const fallback = [
          {
            id: 'stripe',
            label:
              'Card / Bank Payment',
            status:
              'active',
            configured:
              true,
          },
          {
            id: 'oxapay',
            label:
              'Crypto Payment',
            status:
              'active',
            configured:
              true,
          },
          {
            id: 'manual',
            label:
              'Manual Admin Payment',
            status:
              'fallback',
            configured:
              true,
          },
        ]

        setProviders(
          fallback,
        )

        return fallback
      }
    }, [])

  useEffect(() => {
    if (!checkoutOnly) {
      loadSettings({ silent: true }).catch(() => {})
    }
    loadProviders()
  }, [checkoutOnly, loadSettings, loadProviders])

  useEffect(() => {
    if (
      checkoutOnly &&
      badgePlan === null &&
      !badgeBusy
    ) {
      onCheckoutClose?.()
    }
  }, [
    checkoutOnly,
    badgePlan,
    badgeBusy,
    onCheckoutClose,
  ])

  useEffect(() => {
    if (
      !nativeIosBadge ||
      !badgePlan?.division
    ) {
      setNativePrice('')
      return undefined
    }

    let cancelled = false

    const revenueCat =
      academyYhaRevenueCatRuntime()

    if (
      !revenueCat ||
      typeof revenueCat.getOfferings !==
        'function'
    ) {
      return undefined
    }

    revenueCat
      .getOfferings()
      .then((offerings) => {
        if (cancelled) return

        const offering =
          offerings?.all?.[
            badgePlan.division ===
            'federation'
              ? 'yhf_offering'
              : 'yha_offering'
          ] ||
          null

        const selectedPackage =
          academyYhaPackageFromOffering(
            offering,
            badgeBilling,
            badgePlan.division,
          )

        setNativePrice(
          cleanText(
            selectedPackage
              ?.product
              ?.priceString ||
            '',
          ),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setNativePrice('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    nativeIosBadge,
    badgePlan?.division,
    badgeBilling,
  ])

  useEffect(
    () => () => {
      settingsRequestRef.current += 1
    },
    [],
  )

  useEffect(() => {
    if (
      !passwordOpen &&
      !deleteOpen
    ) {
      return undefined
    }

    const previousFocus =
      document.activeElement

    const dialog =
      passwordOpen
        ? passwordDialogRef.current
        : deleteDialogRef.current

    const timer =
      window.setTimeout(
        () =>
          dialog
            ?.querySelector(
              'input, button:not([disabled])',
            )
            ?.focus?.(),
        0,
      )

    const onKeyDown =
      (event) => {
        if (
          event.key !==
          'Escape'
        ) {
          return
        }

        if (
          passwordOpen &&
          !passwordBusy
        ) {
          event.preventDefault()
          closePasswordDialog()
          return
        }

        if (
          deleteOpen &&
          !deleteBusy
        ) {
          event.preventDefault()
          closeDeleteDialog()
        }
      }

    document.addEventListener(
      'keydown',
      onKeyDown,
    )

    return () => {
      window.clearTimeout(
        timer,
      )

      document.removeEventListener(
        'keydown',
        onKeyDown,
      )

      previousFocus
        ?.focus?.()
    }
  }, [
    passwordOpen,
    deleteOpen,
    passwordBusy,
    deleteBusy,
    closePasswordDialog,
    closeDeleteDialog,
  ])

  const refreshSettingsAfterMutation =
    useCallback(
      async () => {
        const result =
          await loadSettings({
            silent: true,
          })

        window.dispatchEvent(
          new Event(
            'yh:dashboard-access-refreshed',
          ),
        )

        window.dispatchEvent(
          new Event(
            'yh:profile-updated',
          ),
        )

        return result
      },
      [loadSettings],
    )

  const subscriptionConfirmationText =
    useCallback(
      (
        item,
        action,
      ) => {
        const explanation =
          item?.explanation &&
          typeof item.explanation ===
            'object'
            ? item.explanation
            : {}

        const code =
          planCode(item)

        if (
          action ===
          'unsubscribe'
        ) {
          return [
            `Unsubscribe ${code}?`,
            cleanText(
              explanation
                .cancellationNote,
            ) ||
              'This will cancel this subscription and deactivate the account access connected to it.',
          ].join('\n\n')
        }

        const benefits =
          Array.isArray(
            explanation.benefits,
          )
            ? explanation.benefits
                .map(cleanText)
                .filter(Boolean)
            : []

        return [
          cleanText(
            explanation.title,
          ) ||
            `Continue to ${code} checkout?`,

          cleanText(
            explanation.copy,
          ),

          benefits.length
            ? benefits
                .map(
                  value =>
                    `• ${value}`,
                )
                .join('\n')
            : '',

          cleanText(
            explanation
              .billingNote,
          ),
        ]
          .filter(Boolean)
          .join('\n\n')
      },
      [],
    )

  const plans =
    useMemo(() => {
      const raw =
        Array.isArray(
          snapshot?.paymentPlans,
        )
          ? snapshot.paymentPlans
          : []

      return raw.filter(
        (item) =>
          planKey(item) !==
          'academy_learn_from_access',
      )
    }, [snapshot])

  const subscribe =
    async (item) => {
      const endpoint =
        planCheckoutEndpoint(
          item,
        )

      if (!endpoint) {
        onToast?.(
          'Missing checkout endpoint for this subscription.',
          'error',
        )
        return
      }

      const code =
        planCode(item)

      if (
        !window.confirm(
          subscriptionConfirmationText(
            item,
            'subscribe',
          ),
        )
      ) {
        return
      }

      setBusyKey(
        `subscribe-${planDivision(
          item,
        )}-${planKey(
          item,
        )}`,
      )

      const popup =
        window.open(
          '',
          '_blank',
        )

      try {
        const result =
          await apiFetch(
            endpoint,
            {
              method: 'POST',
              body:
                JSON.stringify({
                  ...checkoutPayload(
                    item,
                  ),
                  returnTo:
                    `${window.location.pathname}${window.location.search}`,
                }),
            },
          )

        const checkoutUrl =
          getCheckoutUrl(
            result,
          )

        if (
          checkoutUrl &&
          popup
        ) {
          popup.opener = null

          popup.location.replace(
            checkoutUrl,
          )

          onToast?.(
            `${code} checkout opened in a new tab.`,
            'success',
          )
        } else {
          popup?.close?.()

          onToast?.(
            result?.message ||
              `${code} payment request created.`,
            'success',
          )
        }

        if (
          result?.snapshot
        ) {
          setSnapshot(
            result.snapshot,
          )
        }

        await refreshSettingsAfterMutation()
      } catch (error) {
        popup?.close?.()

        onToast?.(
          error?.message ||
            'Failed to start checkout.',
          'error',
        )
      } finally {
        setBusyKey('')
      }
    }

  const unsubscribe =
    async (item) => {
      const endpoint =
        planUnsubscribeEndpoint(
          item,
        )

      const code =
        planCode(item)

      if (!endpoint) {
        onToast?.(
          'Missing unsubscribe endpoint for this subscription.',
          'error',
        )
        return
      }

      if (
        !window.confirm(
          subscriptionConfirmationText(
            item,
            'unsubscribe',
          ),
        )
      ) {
        return
      }

      setBusyKey(
        `unsubscribe-${planDivision(
          item,
        )}-${planKey(
          item,
        )}`,
      )

      try {
        const result =
          await apiFetch(
            endpoint,
            {
              method: 'POST',
            },
          )

        if (
          result?.snapshot
        ) {
          setSnapshot(
            result.snapshot,
          )
        }

        await refreshSettingsAfterMutation()

        onToast?.(
          result?.message ||
            `${code} unsubscribed.`,
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to unsubscribe.',
          'error',
        )
      } finally {
        setBusyKey('')
      }
    }

  const openBadge = async (
    item,
  ) => {
    const division =
      planDivision(item) ===
      'federation'
        ? 'federation'
        : 'academy'

    setBadgePlan({
      item,
      ...BADGE_META[
        division
      ],
    })

    const pendingPlan =
      cleanText(
        item.billingPlan ||
          item.accessType ||
          item.badge
            ?.billingPlan ||
          item.badge
            ?.accessType ||
          'monthly',
      ).toLowerCase()

    setBadgeBilling(
      [
        'monthly',
        'one_time',
        'lifetime',
      ].includes(
        pendingPlan,
      )
        ? pendingPlan
        : 'monthly',
    )

    setBadgeProvider(
      'stripe',
    )

    await loadProviders()
  }

  const providerMap =
    useMemo(() => {
      const map = {}

      providers.forEach(
        (provider) => {
          const id =
            cleanText(
              provider.id ||
                provider.provider ||
                '',
            ).toLowerCase()

          if (id) {
            map[id] =
              provider
          }
        },
      )

      if (!map.manual) {
        map.manual = {
          id: 'manual',
          label:
            'Manual Admin Payment',
          status:
            'fallback',
          configured:
            true,
        }
      }

      return map
    }, [providers])

  const badgeProviderAllowed = (
    provider,
  ) => {
    if (
      provider === 'manual'
    ) {
      return true
    }

    const config =
      providerMap[
        provider
      ]

    if (!config) {
      return false
    }

    if (
      provider ===
        'oxapay' &&
      badgeBilling ===
        'monthly'
    ) {
      return false
    }

    return providerConfigured(
      config,
    )
  }

  const restoreVerifiedBadgePurchases =
    async () => {
      const division =
        badgePlan?.division

      if (
        ![
          'academy',
          'federation',
        ].includes(
          division,
        ) ||
        !academyYhaIsNativeIos()
      ) {
        return
      }

      const code =
        division ===
        'federation'
          ? 'YHF'
          : 'YHA'

      setBadgeBusy(true)

      try {
        await academyYhaRestoreWithRevenueCat(
          division,
        )

        await refreshSettingsAfterMutation()

        onToast?.(
          `${code} purchases restored successfully.`,
          'success',
        )

        setBadgePlan(null)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to restore App Store purchases.',
          'error',
        )
      } finally {
        setBadgeBusy(false)
      }
    }

  const startBadgePayment =
    async () => {
      if (!badgePlan) {
        return
      }

      if (nativeIosBadge) {
        const code =
          badgePlan.division ===
          'federation'
            ? 'YHF'
            : 'YHA'

        setBadgeBusy(true)

        try {
          await academyYhaPurchaseWithRevenueCat(
            badgeBilling,
            badgePlan.division,
          )

          await refreshSettingsAfterMutation()

          onToast?.(
            `${code} activated successfully through the App Store.`,
            'success',
          )

          setBadgePlan(null)
        } catch (error) {
          if (
            !academyYhaIsRevenueCatUserCancelled(
              error,
            )
          ) {
            onToast?.(
              error?.message ||
                `Failed to complete the ${code} App Store purchase.`,
              'error',
            )
          }
        } finally {
          setBadgeBusy(false)
        }

        return
      }

      if (
        !badgeProviderAllowed(
          badgeProvider,
        )
      ) {
        onToast?.(
          'Choose an available payment method first.',
          'error',
        )
        return
      }

      const division =
        badgePlan.division

      const provider =
        badgeProvider

      const billingPlan =
        provider ===
          'oxapay' &&
        badgeBilling ===
          'monthly'
          ? 'one_time'
          : badgeBilling

      /* YHU_PHASE5_ACADEMY_PAYMENT_METHOD_PARITY */
      const paymentMethod =
        provider ===
        'oxapay'
          ? 'crypto'
          : provider ===
              'manual'
            ? 'manual'
            : division === 'academy' ? 'card_bank_wallet' : 'card_bank'

      const endpoint =
        provider ===
        'stripe'
          ? `/api/payments/badges/${encodeURIComponent(
              division,
            )}/checkout-session`
          : provider ===
              'oxapay'
            ? `/api/payments/badges/${encodeURIComponent(
                division,
              )}/oxapay-invoice`
            : `/api/payments/badges/${encodeURIComponent(
                division,
              )}/ledger`

      const opensTab =
        provider ===
          'stripe' ||
        provider ===
          'oxapay'

      const popup =
        opensTab
          ? window.open(
              '',
              '_blank',
            )
          : null

      if (
        opensTab &&
        !popup
      ) {
        onToast?.(
          'Your browser blocked the checkout tab. Allow popups and try again.',
          'error',
        )
        return
      }

      setBadgeBusy(true)

      try {
        const result =
          await apiFetch(
            endpoint,
            {
              method: 'POST',

              body:
                JSON.stringify({
                  provider,
                  paymentMethod,
                  billingPlan,

                  /* YHU_PHASE5_YHA_ORIGINAL_RETURN_ROUTE */
returnTo:
                    division === 'academy' && checkoutOnly
                      ? '/academy?section=community'
                      : `${window.location.pathname}${window.location.search}`,
                }),
            },
          )

        const checkoutUrl =
          getCheckoutUrl(
            result,
          )

        if (
          checkoutUrl &&
          popup
        ) {
          popup.opener =
            null

          popup.location.replace(
            checkoutUrl,
          )

          onToast?.(
            `${badgePlan.code} checkout opened in a new tab.`,
            'success',
          )
        } else {
          popup?.close?.()

          onToast?.(
            result?.message ||
              `${badgePlan.code} payment request created.`,
            'success',
          )
        }

        setBadgePlan(null)

        await refreshSettingsAfterMutation()
      } catch (actionError) {
        popup?.close?.()

        onToast?.(
          actionError?.message ||
            'Badge payment request failed.',
          'error',
        )
      } finally {
        setBadgeBusy(false)
      }
    }

  const changePassword =
    async (event) => {
      event.preventDefault()

      setPasswordError('')

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        setPasswordError(
          'Complete all password fields.',
        )

        return
      }

      if (
        newPassword.length <
          8 ||
        newPassword.length >
          128
      ) {
        setPasswordError(
          'New password must be between 8 and 128 characters.',
        )

        return
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setPasswordError(
          'New password and confirmation do not match.',
        )

        return
      }

      if (
        currentPassword ===
        newPassword
      ) {
        setPasswordError(
          'Choose a new password that is different from your current password.',
        )

        return
      }

      setPasswordBusy(true)

      try {
        const result =
          await apiFetch(
            CHANGE_PASSWORD_ENDPOINT,
            {
              method: 'PATCH',

              body:
                JSON.stringify({
                  currentPassword,
                  newPassword,

                  confirmPassword,
                }),
            },
          )

        onToast?.(
          result?.message ||
            'Password changed. Please log in again.',
          'success',
        )

        resetPasswordDialog()
        setPasswordOpen(false)

        window.setTimeout(
          () => {
            if (onLogout) {
              onLogout()
            } else {
              clearClientAuth()

              window.location.replace(
                '/',
              )
            }
          },
          650,
        )
      } catch (actionError) {
        const message =
          actionError?.message ||
          'Failed to change password.'

        setPasswordError(
          message,
        )

        onToast?.(
          message,
          'error',
        )
      } finally {
        setPasswordBusy(
          false,
        )
      }
    }

  const deleteAccount =
    async () => {
      if (
        deleteConfirmation !==
        'DELETE'
      ) {
        onToast?.(
          'Type DELETE to confirm account deletion.',
          'error',
        )

        return
      }

      if (
        !window.confirm(
          'Delete your YH Universe account? Your account will be permanently deleted and you will be logged out.',
        )
      ) {
        return
      }

      setDeleteBusy(true)

      try {
        const result =
          await apiFetch(
            '/api/account?confirmation=DELETE',
            {
              method:
                'DELETE',

              headers: {
                'X-YH-Delete-Confirmation':
                  'DELETE',
              },

              body:
                JSON.stringify({
                  confirmation:
                    'DELETE',

                  deleteConfirmation:
                    'DELETE',
                }),
            },
          )

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.message ||
              'Failed to delete account.',
          )
        }

        clearClientAuth()

        window.location.replace(
          '/?accountDeleted=1',
        )
      } catch (actionError) {
        onToast?.(
          actionError?.message ||
            'Failed to delete account.',
          'error',
        )
      } finally {
        setDeleteBusy(false)
      }
    }

  return (
    <section
      style={checkoutOnly ? { display: 'contents' } : undefined}
      id="yh-dashboard-settings-workspace"
      className="yh-dashboard-system-workspace"
      aria-label="Settings workspace"
      data-yh-dashboard-react-surface="settings"
    >
      <div
        style={checkoutOnly ? { display: 'none' } : undefined}
        id="yh-dashboard-settings-workspace-content"
        className="yh-dashboard-system-workspace-content"
      >
        <div
          id="yh-dashboard-settings-modal"
          className="yh-dashboard-profile-modal yh-dashboard-settings-modal is-dashboard-inline-workspace"
          role="region"
          aria-labelledby="yh-dashboard-settings-title"
        >
          <div className="yh-dashboard-profile-modal-card yh-dashboard-settings-card">
            <div className="yh-dashboard-profile-modal-head">
              <div>
                <div className="yh-dashboard-profile-modal-kicker">
                  Account Settings
                </div>

                <h3 id="yh-dashboard-settings-title">
                  Settings
                </h3>

                <p>
                  Manage your active YH subscriptions, payment plans, and badge access.
                </p>
              </div>
            <div className="yhu-settings-header-refresh">
    <button
                    type="button"
                    className="btn-secondary"
                    disabled={loading}
                    onClick={() =>
                      loadSettings()
                        .then(() =>
                          onToast?.(
                            'Settings refreshed.',
                            'success',
                          ),
                        )
                        .catch(
                          () => {},
                        )
                    }
                  >
                    {loading
                      ? 'Refreshing...'
                      : 'Refresh Settings'}
                  </button>
  </div>
            </div>

            <div className="yh-dashboard-profile-modal-body yh-dashboard-settings-body hide-scrollbar">
              <section className="yh-dashboard-settings-section">
                <div className="yh-dashboard-settings-section-head">
                  <span>
                    Subscriptions & Payment Plans
                  </span>

                  <small>
                    Active subscriptions show an unsubscribe button. Inactive plans are shown for visibility.
                  </small>
                </div>

                <div className="yh-dashboard-settings-subscriptions-list">
                  {loading &&
                  !plans.length ? (
                    <div className="yh-dashboard-settings-loading">
                      Loading subscriptions and payment plans...
                    </div>
                  ) : error ? (
                    <div className="yh-dashboard-settings-loading is-error">
                      {error}
                    </div>
                  ) : !plans.length ? (
                    <div className="yh-dashboard-settings-loading">
                      No subscriptions or payment plans were found for this account.
                    </div>
                  ) : (
                    plans.map(
                      (
                        item,
                        index,
                      ) => {
                        const key =
                          `${
                            planDivision(
                              item,
                            )
                          }-${
                            planKey(
                              item,
                            )
                          }-${index}`

                        return (
                          <SubscriptionCard
                            key={key}
                            item={item}
                            busy={
                              Boolean(
                                busyKey,
                              )
                            }
                            onSubscribe={
                              subscribe
                            }
                            onUnsubscribe={
                              unsubscribe
                            }
                            onBadgeAvail={
                              openBadge
                            }
                          />
                        )
                      },
                    )
                  )}


                </div>
              </section>

              <section className="yh-dashboard-settings-section">
                <div className="yh-dashboard-settings-section-head">
                  <span>
                    Security
                  </span>

                  <small>
                    Update your account password. You will be logged out after the change is completed.
                  </small>
                </div>

                <article className="yh-dashboard-settings-subscription-card">
                  <div className="yh-dashboard-settings-subscription-main">
                    <div className="yh-dashboard-settings-subscription-title-row">
                      <div>
                        <strong>
                          Account Password
                        </strong>

                        <p>
                          Verify your current password before creating a new one.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="yh-dashboard-settings-subscription-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={
                        openPasswordDialog
                      }
                    >
                      Change Password
                    </button>
                  </div>
                </article>

                <article className="yh-dashboard-settings-subscription-card yh-dashboard-settings-danger-card">
                  <div className="yh-dashboard-settings-subscription-main">
                    <div className="yh-dashboard-settings-subscription-title-row">
                      <div>
                        <strong>
                          Delete Account
                        </strong>

                        <p>
                          Permanently delete your YH Universe account and remove your active profile access.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="yh-dashboard-settings-subscription-actions">
                    <button
                      type="button"
                      className="btn-secondary yh-profile-danger-action"
                      onClick={() => {
                        setDeleteConfirmation(
                          '',
                        )

                        setDeleteOpen(
                          true,
                        )
                      }}
                    >
                      Delete Account
                    </button>
                  </div>
                </article>
              </section>
            </div>
          </div>
        </div>
      </div>

      {passwordOpen && (
        <div
          ref={passwordDialogRef}
          className="yh-dashboard-profile-modal yh-dashboard-settings-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Change Password"
          onClick={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePasswordDialog()
            }
          }}
        >
          <div className="yh-dashboard-profile-modal-card yh-dashboard-settings-card">
            <div className="yh-dashboard-profile-modal-head">
              <div>
                <div className="yh-dashboard-profile-modal-kicker">
                  Account Security
                </div>

                <h3>
                  Change Password
                </h3>

                <p>
                  Enter your current password, then create a new password for your YH Universe account.
                </p>
              </div>
            </div>

            <form
              className="yh-dashboard-profile-modal-body yh-dashboard-settings-body"
              onSubmit={
                changePassword
              }
            >
              <label className="form-group">
                <span>
                  Current Password
                </span>

                <input
                  type="password"
                  className="input-field"
                  autoComplete="current-password"
                  value={
                    currentPassword
                  }
                  onChange={(
                    event,
                  ) =>
                    setCurrentPassword(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="form-group">
                <span>
                  New Password
                </span>

                <input
                  type="password"
                  className="input-field"
                  autoComplete="new-password"
                  value={
                    newPassword
                  }
                  onChange={(
                    event,
                  ) =>
                    setNewPassword(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="form-group">
                <span>
                  Confirm New Password
                </span>

                <input
                  type="password"
                  className="input-field"
                  autoComplete="new-password"
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event,
                  ) =>
                    setConfirmPassword(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              {passwordError && (
                <div className="yh-dashboard-settings-loading is-error">
                  {
                    passwordError
                  }
                </div>
              )}

              <div className="yh-dashboard-profile-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    passwordBusy
                  }
                  onClick={
                    closePasswordDialog
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    passwordBusy
                  }
                >
                  {passwordBusy
                    ? 'Changing Password...'
                    : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div
          ref={deleteDialogRef}
          className="yh-dashboard-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Delete YH Universe Account"
          onClick={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteDialog()
            }
          }}
        >
          <div className="yh-dashboard-profile-modal-card yh-dashboard-delete-account-card">
            <div className="yh-dashboard-profile-modal-head">
              <div>
                <div className="yh-dashboard-profile-modal-kicker is-danger">
                  Danger Zone
                </div>

                <h3>
                  Delete YH Universe Account
                </h3>

                <p>
                  This will disable your login account and remove your public profile identity from active use.
                </p>
              </div>
            </div>

            <div className="yh-dashboard-profile-modal-body">
              <div className="yh-dashboard-danger-warning">
                <strong>
                  This action is serious.
                </strong>

                <span>
                  Type DELETE below to confirm account deletion. No password is required for this action.
                </span>
              </div>

              <label className="form-group">
                <span>
                  Type DELETE to confirm
                </span>

                <input
                  type="text"
                  className="input-field"
                  autoComplete="off"
                  placeholder="DELETE"
                  value={
                    deleteConfirmation
                  }
                  onChange={(
                    event,
                  ) =>
                    setDeleteConfirmation(
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-dashboard-profile-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  deleteBusy
                }
                onClick={
                  closeDeleteDialog
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-secondary academy-profile-danger-btn"
                disabled={
                  deleteBusy
                }
                onClick={
                  deleteAccount
                }
              >
                {deleteBusy
                  ? 'Deleting Account...'
                  : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {badgePlan && createPortal(
        <div
          className="yh-badge-avail-modal is-open"
          role="dialog"
          aria-modal="true"
          aria-label={`${badgePlan.code} badge payment`}
        >
          <div
            className="yh-badge-avail-backdrop"
            onClick={() =>
              !badgeBusy &&
              setBadgePlan(null)
            }
          />

          <div className="yh-badge-avail-card">
            <div className="yh-badge-avail-hero">
              <div className="yh-badge-avail-icon-wrap">
                <img
                  src={
                    badgePlan.asset
                  }
                  alt=""
                />
              </div>

              <div>
                <p className="yh-badge-avail-kicker">
                  Optional Verification Add-on
                </p>

                <h3>
                  {
                    badgePlan.name
                  }
                </h3>

                <p>
                  {
                    badgePlan.summary
                  }
                </p>
              </div>
            </div>

            <div className="yh-badge-payment-head">
              <h4>
                Choose billing option
              </h4>
            </div>

            <div className="yh-badge-payment-options yh-badge-billing-options">
              {[
                [
                  'monthly',
                  'Monthly Subscription',
                  nativeIosBadge
                    ? 'Auto-renewing monthly App Store subscription.'
                    : 'Recurring monthly billing. Stripe only.',
                ],
                [
                  'one_time',
                  'One-Time Access',
                  'One payment for 30 days access.',
                ],
                [
                  'lifetime',
                  'Lifetime Access',
                  'One payment for permanent access.',
                ],
              ].map(
                ([
                  key,
                  title,
                  copy,
                ]) => (
                  <button
                    key={key}
                    type="button"
                    className={`yh-badge-payment-option ${
                      badgeBilling ===
                      key
                        ? 'is-selected'
                        : ''
                    }`}
                    aria-pressed={
                      badgeBilling ===
                      key
                    }
                    onClick={() => {
                      setBadgeBilling(
                        key,
                      )

                      if (
                        key ===
                          'monthly' &&
                        badgeProvider ===
                          'oxapay'
                      ) {
                        setBadgeProvider(
                          'stripe',
                        )
                      }
                    }}
                  >
                    <span className="yh-badge-payment-option-main">
                      <strong>
                        {title}
                      </strong>

                      <small>
                        {copy}
                      </small>
                    </span>

                    <span className="yh-badge-payment-status">
                      {nativeIosBadge &&
                      badgeBilling === key &&
                      nativePrice
                        ? nativePrice
                        : '$' +
                          Number(
                            badgePlan[
                              key
                            ],
                          ).toFixed(
                            2,
                          )}
                    </span>
                  </button>
                ),
              )}
            </div>

            <div
              className="yh-badge-payment-head"
              style={
                nativeIosBadge
                  ? {
                      display: 'none',
                    }
                  : undefined
              }
            >
              <h4>
                Choose payment method
              </h4>
            </div>

            <div
              className="yh-badge-payment-options"
              style={
                nativeIosBadge
                  ? {
                      display: 'none',
                    }
                  : undefined
              }
            >
              {[
                [
                  'stripe',
                  'Card / Bank Payment',
                ],
                [
                  'oxapay',
                  'Crypto Payment',
                ],
                [
                  'manual',
                  'Manual Admin Payment',
                ],
              ].map(
                ([
                  provider,
                  label,
                ]) => {
                  const allowed =
                    badgeProviderAllowed(
                      provider,
                    )

                  return (
                    <button
                      key={
                        provider
                      }
                      type="button"
                      className={`yh-badge-payment-option ${
                        badgeProvider ===
                        provider
                          ? 'is-selected'
                          : ''
                      } ${
                        !allowed
                          ? 'is-disabled'
                          : ''
                      }`}
                      disabled={
                        !allowed
                      }
                      aria-pressed={
                        badgeProvider ===
                        provider
                      }
                      onClick={() =>
                        setBadgeProvider(
                          provider,
                        )
                      }
                    >
                      <span className="yh-badge-payment-option-main">
                        <strong>
                          {
                            label
                          }
                        </strong>

                        <small>
                          {provider ===
                            'oxapay' &&
                          badgeBilling ===
                            'monthly'
                            ? 'OxaPay is one-time only.'
                            : provider ===
                                'manual'
                              ? 'Admin-reviewed fallback payment.'
                              : 'Configured provider checkout.'}
                        </small>
                      </span>

                      <span className="yh-badge-payment-status">
                        {allowed
                          ? 'Available'
                          : 'Unavailable'}
                      </span>
                    </button>
                  )
                },
              )}
            </div>

            {nativeIosBadge && (
              <section className="yh-dashboard-settings-section">
                <div className="yh-badge-payment-head">
                  <h4>
                    App Store Purchase
                  </h4>
                </div>

                <p>
                  {badgePlan.code +
                    (
                      badgeBilling ===
                      'monthly'
                        ? ' Monthly is an auto-renewing App Store subscription.'
                        : badgeBilling ===
                            'one_time'
                          ? ' 30-Day Access is a non-renewing App Store purchase.'
                          : ' Lifetime is a one-time App Store purchase.'
                    ) +
                    ' ' +
                    (
                      nativePrice ||
                      'The displayed price'
                    ) +
                    ' will be charged to your Apple Account.'}
                </p>

                {badgeBilling ===
                  'monthly' && (
                  <p>
                    This subscription automatically renews monthly unless canceled at least 24 hours before the end of the current billing period. You can manage or cancel it in your Apple Account settings.
                  </p>
                )}

                <p>
                  <a
                    href="https://www.younghustlersuniverse.com/terms.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms
                  </a>
                  {' · '}
                  <a
                    href="https://www.younghustlersuniverse.com/privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy
                  </a>
                  {' · '}
                  <a
                    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apple Standard EULA
                  </a>
                </p>
              </section>
            )}

            <div className="yh-badge-avail-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  badgeBusy
                }
                onClick={() =>
                  setBadgePlan(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={
                  badgeBusy
                }
                onClick={
                  startBadgePayment
                }
              >
                {badgeBusy
                  ? 'Creating Payment...'
                  : nativeIosBadge
                    ? 'Continue with Apple'
                    : 'Continue to Selected Payment'}
              </button>

            {/* Native iOS restore parity for YHA and YHF. */}
            {nativeIosBadge && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={badgeBusy}
                  onClick={
                    restoreVerifiedBadgePurchases
                  }
                >
                  {badgeBusy
                    ? 'Working...'
                    : 'Restore Purchases'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
