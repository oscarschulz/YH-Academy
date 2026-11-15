export const SUBSCRIPTIONS_ENDPOINT =
  '/api/payments/subscriptions'

export const CHANGE_PASSWORD_ENDPOINT =
  '/api/academy/account/password'

export const BADGE_META = {
  academy: {
    division: 'academy',
    code: 'YHA',
    name: 'Academy Verification Badge',
    monthly: 2.81,
    one_time: 2.81,
    lifetime: 28.12,
    asset: '/images/yha%20badge.png',
    summary:
      'For approved Academy members who want the YHA verification symbol on their public YH Universe profile, plus Learn From access inside the Academy AI Coach.',
  },

  federation: {
    division: 'federation',
    code: 'YHF',
    name: 'Federation Verification Badge',
    monthly: 28.12,
    one_time: 28.12,
    lifetime: 281.2,
    asset: '/images/yhf%20badge.png',
    summary:
      'For approved Federation members who want the YHF verification symbol on their public YH Universe profile, plus access to the private Telegram group @younghustlersteam.',
  },
}

export function cleanText(value = '') {
  return String(value || '')
    .trim()
}

export function planDivision(item = {}) {
  return cleanText(
    item.division ||
      item.plan?.division ||
      item.badge?.division ||
      '',
  ).toLowerCase()
}

export function planKey(item = {}) {
  return cleanText(
    item.key ||
      item.product ||
      item.plan?.product ||
      item.plan?.sourceFeature ||
      item.sourceFeature ||
      item.badge?.product ||
      '',
  ).toLowerCase()
}

export function planCode(item = {}) {
  const division =
    planDivision(item)

  return (
    cleanText(
      item.code ||
        item.plan?.code ||
        item.badge?.code ||
        '',
    ) ||
    (division ===
    'federation'
      ? 'YHF'
      : 'YHA')
  )
}

export function planCheckoutEndpoint(
  item = {},
) {
  const direct =
    cleanText(
      item.checkoutEndpoint ||
        item.plan
          ?.checkoutEndpoint ||
        '',
    )

  if (direct) {
    return direct
  }

  const division =
    planDivision(item)

  const key =
    planKey(item)

  if (
    key ===
      'academy_learn_from_access' &&
    item.active !== true
  ) {
    return '/api/payments/badges/academy/checkout-session'
  }

  if (
    key ===
    'academy_learn_from_access'
  ) {
    return '/api/payments/academy/learn-from-access/stripe-checkout-session'
  }

  if (
    key ===
      'verified_badge' &&
    division
  ) {
    return `/api/payments/badges/${encodeURIComponent(
      division,
    )}/checkout-session`
  }

  return ''
}

export function planUnsubscribeEndpoint(
  item = {},
) {
  const direct =
    cleanText(
      item.unsubscribeEndpoint ||
        item.plan
          ?.unsubscribeEndpoint ||
        '',
    )

  if (direct) {
    return direct
  }

  const division =
    planDivision(item)

  const key =
    planKey(item)

  if (
    key ===
    'academy_learn_from_access'
  ) {
    return '/api/payments/academy/learn-from-access/unsubscribe'
  }

  if (division) {
    return `/api/payments/subscriptions/${encodeURIComponent(
      division,
    )}/unsubscribe`
  }

  return ''
}

export function checkoutPayload(
  item = {},
) {
  const direct =
    item.checkoutPayload &&
    typeof item.checkoutPayload ===
      'object'
      ? item.checkoutPayload
      : item.plan
            ?.checkoutPayload &&
          typeof item.plan
            .checkoutPayload ===
            'object'
        ? item.plan
            .checkoutPayload
        : null

  if (direct) {
    return direct
  }

  const key =
    planKey(item)

  if (
    key ===
      'verified_badge' ||
    key ===
      'academy_learn_from_access'
  ) {
    return {
      billingPlan:
        'monthly',
    }
  }

  return {}
}

export function statusLabel(item = {}) {
  const status =
    cleanText(
      item.status ||
        item.badge?.status ||
        '',
    ).toLowerCase()

  if (
    status ===
    'included_with_yha'
  ) {
    return 'Included with YHA'
  }

  if (
    status ===
    'unlocked_by_yha'
  ) {
    return 'Unlock with YHA'
  }

  if (
    item.active === true ||
    status === 'active' ||
    status === 'verified'
  ) {
    return 'Active'
  }

  if (
    status ===
    'pending_payment'
  ) {
    return 'Pending Payment'
  }

  if (
    status ===
    'checkout_started'
  ) {
    return 'Checkout Started'
  }

  if (
    status ===
      'cancelled' ||
    status === 'canceled'
  ) {
    return 'Cancelled'
  }

  if (
    status === 'expired'
  ) {
    return 'Expired'
  }

  if (
    status === 'failed'
  ) {
    return 'Failed'
  }

  return status
    ? status
        .replace(
          /[_-]+/g,
          ' ',
        )
        .replace(
          /\b\w/g,
          (character) =>
            character.toUpperCase(),
        )
    : 'Not Active'
}

export function statusTone(item = {}) {
  const status =
    cleanText(
      item.status ||
        item.badge?.status ||
        '',
    ).toLowerCase()

  if (
    status ===
      'included_with_yha' ||
    item.active === true ||
    status === 'active' ||
    status === 'verified'
  ) {
    return 'active'
  }

  if (
    status ===
      'unlocked_by_yha' ||
    status ===
      'pending_payment' ||
    status ===
      'checkout_started' ||
    status === 'draft'
  ) {
    return 'pending'
  }

  return 'inactive'
}

export function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const value =
    Number(amount || 0)

  const cleanCurrency =
    cleanText(
      currency || 'USD',
    ).toUpperCase() ||
    'USD'

  return `${cleanCurrency} ${
    Number.isFinite(value)
      ? value.toFixed(2)
      : '0.00'
  }`
}

export function formatDate(
  value = '',
) {
  const clean =
    cleanText(value)

  if (!clean) return ''

  const date =
    new Date(clean)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  )
}

export function subscriptionExpiry(
  item = {},
) {
  const plan =
    item.plan || {}

  const badge =
    item.badge || {}

  const payment =
    item.payment || {}

  const metadata =
    payment.metadata || {}

  return cleanText(
    item.expiresAt ||
      item.currentPeriodEnd ||
      item.current_period_end ||
      item.subscriptionEndsAt ||
      item.subscription_ends_at ||
      item.renewsAt ||
      item.renews_at ||
      badge.expiresAt ||
      badge.currentPeriodEnd ||
      badge.current_period_end ||
      plan.expiresAt ||
      payment.expiresAt ||
      payment.currentPeriodEnd ||
      payment.current_period_end ||
      metadata.currentPeriodEnd ||
      metadata.current_period_end ||
      metadata.expiresAt ||
      '',
  )
}

export function getCheckoutUrl(
  result = {},
) {
  return cleanText(
    result?.url ||
      result?.checkoutUrl ||
      result
        ?.providerCheckoutUrl ||
      result?.payment?.url ||
      result?.payment
        ?.checkoutUrl ||
      result?.payment
        ?.providerCheckoutUrl ||
      '',
  )
}

export function providerConfigured(
  provider = {},
) {
  const status =
    cleanText(
      provider.status || '',
    ).toLowerCase()

  return (
    provider.configured ===
      true ||
    [
      'active',
      'enabled',
      'ready',
      'fallback',
      'manual',
    ].includes(status)
  )
}

export function clearClientAuth() {
  try {
    localStorage.clear()
  } catch {}

  try {
    sessionStorage.clear()
  } catch {}
}
