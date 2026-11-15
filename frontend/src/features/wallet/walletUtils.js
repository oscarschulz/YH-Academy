export function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const cleanCurrency =
    String(currency || 'USD')
      .trim()
      .toUpperCase() || 'USD'

  const value =
    Number(amount || 0)

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: 'currency',
        currency: cleanCurrency,
        maximumFractionDigits: 2,
      },
    ).format(
      Number.isFinite(value)
        ? value
        : 0,
    )
  } catch {
    return `${cleanCurrency} ${(
      Number.isFinite(value)
        ? value
        : 0
    ).toFixed(2)}`
  }
}

export function plainLabel(
  value = '',
  fallback = 'Record',
) {
  const clean =
    String(value || '').trim()

  if (!clean) return fallback

  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}

export function statusLabel(value = '') {
  return plainLabel(
    value,
    'Not Set',
  )
}

export function statusTone(value = '') {
  const clean =
    String(value || '')
      .trim()
      .toLowerCase()

  if (
    [
      'active',
      'available',
      'enabled',
      'ready',
      'ledger_ready',
    ].includes(clean)
  ) {
    return 'is-ready'
  }

  if (
    [
      'setup_required',
      'planned',
      'coming_soon',
      'pending',
      'pending_review',
    ].includes(clean)
  ) {
    return 'is-pending'
  }

  if (
    [
      'fallback',
      'manual',
    ].includes(clean)
  ) {
    return 'is-fallback'
  }

  return 'is-neutral'
}

export function methodIcon(method = {}) {
  const id = String(
    method.id ||
      method.provider ||
      method.label ||
      '',
  ).toLowerCase()

  if (
    id.includes('oxapay') ||
    id.includes('crypto')
  ) {
    return '₿'
  }

  if (
    id.includes('stripe') ||
    id.includes('card') ||
    id.includes('bank')
  ) {
    return '💳'
  }

  if (
    id.includes('local') ||
    id.includes('manual')
  ) {
    return '🏦'
  }

  return '↗'
}

export function methodHint(method = {}) {
  const id = String(
    method.id ||
      method.provider ||
      method.label ||
      '',
  ).toLowerCase()

  const status =
    String(
      method.status || '',
    ).toLowerCase()

  if (
    status ===
    'setup_required'
  ) {
    return 'Needs provider setup before users can complete payments through this method.'
  }

  if (id.includes('stripe')) {
    return 'Best for card and bank payments through Stripe.'
  }

  if (
    id.includes('oxapay') ||
    id.includes('crypto')
  ) {
    return 'Best for crypto invoice payments and crypto-friendly users.'
  }

  if (
    id.includes('local_bank')
  ) {
    return 'Admin-reviewed local bank payout route.'
  }

  if (id.includes('card')) {
    return 'Admin-reviewed card payout route.'
  }

  if (id.includes('manual')) {
    return 'Fallback route handled by admin confirmation.'
  }

  return 'Available inside the YH wallet economy layer.'
}

export function providerLabel(value = '') {
  const clean =
    String(value || '')
      .trim()
      .toLowerCase()

  if (
    !clean ||
    clean === 'unselected'
  ) {
    return 'Provider Pending'
  }

  if (clean === 'stripe') {
    return 'Stripe'
  }

  if (clean === 'oxapay') {
    return 'OxaPay'
  }

  if (clean === 'manual') {
    return 'Manual Review'
  }

  if (clean === 'local_bank') {
    return 'Local Bank'
  }

  if (clean === 'card') {
    return 'Card'
  }

  if (clean === 'bank') {
    return 'Bank'
  }

  return plainLabel(
    clean,
    'Provider',
  )
}

export function paymentMethodLabel(
  value = '',
) {
  const clean =
    String(value || '')
      .trim()
      .toLowerCase()

  if (
    !clean ||
    clean === 'unselected'
  ) {
    return 'Payment Method Pending'
  }

  const labels = {
    card_bank_wallet:
      'Card, Bank, or Wallet',
    card: 'Card Payment',
    bank: 'Bank Payment',
    wallet: 'Wallet Payment',
    crypto: 'Crypto Payment',
    local_bank:
      'Local Bank Transfer',
    manual: 'Manual Review',
  }

  return (
    labels[clean] ||
    plainLabel(
      clean,
      'Payment Method',
    )
  )
}

export function divisionLabel(value = '') {
  const clean =
    String(value || '')
      .trim()
      .toLowerCase()

  if (clean === 'academy') {
    return 'Academy'
  }

  if (
    clean === 'plaza' ||
    clean === 'plazas'
  ) {
    return 'Plazas'
  }

  if (
    clean === 'federation'
  ) {
    return 'Federation'
  }

  return plainLabel(
    clean,
    'YH Universe',
  )
}

export function featureLabel(
  value = '',
) {
  const clean =
    String(value || '')
      .trim()
      .toLowerCase()

  const labels = {
    verified_badge:
      'Verified Badge',

    academy_learn_from_access:
      'Academy Learn From Access',

    learn_from_access:
      'Learn From Access',

    academy_badge:
      'Academy Badge',

    federation_badge:
      'Federation Badge',

    plaza_badge:
      'Plazas Badge',
  }

  return (
    labels[clean] ||
    plainLabel(
      clean,
      'Payment Record',
    )
  )
}

export function ledgerTitle(
  record = {},
  type = 'payment',
) {
  const division =
    String(
      record.sourceDivision || '',
    ).trim()

  const feature =
    String(
      record.sourceFeature || '',
    ).trim()

  if (
    division ||
    feature
  ) {
    return `${divisionLabel(
      division,
    )} ${featureLabel(
      feature,
    )}`
      .replace(/\s+/g, ' ')
      .trim()
  }

  return type === 'payment'
    ? 'Payment Record'
    : 'Payout Record'
}

export function ledgerMeta(
  record = {},
  type = 'payment',
) {
  if (type === 'payment') {
    return `${providerLabel(
      record.provider,
    )} · ${paymentMethodLabel(
      record.paymentMethod,
    )}`
  }

  return `${paymentMethodLabel(
    record.method ||
      'local_bank',
  )} · ${providerLabel(
    record.provider ||
      'manual',
  )}`
}
