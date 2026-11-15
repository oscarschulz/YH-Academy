import { getStoredAuthToken } from '../../services/api/apiClient'

export const REFERRAL_CACHE_KEY =
  'yh_universe_referral_snapshot_v1'

// YHU_REFERRAL_ACCOUNT_SCOPE_PATCH05
function referralScopedCacheKey() {
  try {
    const token = getStoredAuthToken()

    if (token.split('.').length !== 3) return ''

    const payloadPart = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const padded = payloadPart.padEnd(
      Math.ceil(payloadPart.length / 4) * 4, '='
    )

    const payload = JSON.parse(atob(padded))
    const id = String(
      payload.user_id ||
      payload.uid ||
      payload.sub ||
      payload.id ||
      payload.user?.id ||
      ''
    ).trim()

    return id
      ? REFERRAL_CACHE_KEY + ':' + id
      : ''
  } catch {
    return ''
  }
}

export function readCache() {
  try {
    const key = referralScopedCacheKey()
    if (!key) return null

    const parsed = JSON.parse(
      localStorage.getItem(key) || 'null'
    )

    return parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function writeCache(snapshot) {
  try {
    const key = referralScopedCacheKey()
    if (!key) return

    localStorage.setItem(
      key,
      JSON.stringify(snapshot)
    )
  } catch {}
}

export function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const value =
    Number(amount || 0)

  const cleanCurrency =
    String(currency || 'USD')
      .trim()
      .toUpperCase() ||
    'USD'

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: 'currency',
        currency:
          cleanCurrency,
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

export function formatDate(value = '') {
  const clean =
    String(value || '').trim()

  if (!clean) {
    return 'No date yet'
  }

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  )
}

export function getDisplayName(
  item = {},
) {
  const candidates = [
    item.referredName,

    item.referredUsername
      ? `@${String(
          item.referredUsername,
        ).replace(
          /^@+/,
          '',
        )}`
      : '',

    item.referredEmail,
    item.referredUid,
  ]

  return (
    candidates
      .map((value) =>
        String(
          value || '',
        ).trim(),
      )
      .find(Boolean) ||
    'Referred member'
  )
}

export function getStatusLabel(
  value = '',
  rewardStatus = '',
) {
  const status =
    String(value || '')
      .trim()
      .toLowerCase()

  const reward =
    String(
      rewardStatus || '',
    )
      .trim()
      .toLowerCase()

  if (
    reward ===
      'commission_created' ||
    status ===
      'commission_earned'
  ) {
    return 'Commission Earned'
  }

  if (
    reward === 'created' ||
    status ===
      'reward_created'
  ) {
    return 'Commission Earned'
  }

  if (
    status === 'qualified' ||
    reward === 'qualified'
  ) {
    return 'Paying Referral'
  }

  if (
    status === 'rejected' ||
    reward === 'rejected'
  ) {
    return 'Rejected'
  }

  if (
    reward ===
      'awaiting_payment' ||
    status === 'pending'
  ) {
    return 'Awaiting First Purchase'
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
    : 'Awaiting First Purchase'
}

export function getStatusTone(
  value = '',
  rewardStatus = '',
) {
  const status =
    String(value || '')
      .trim()
      .toLowerCase()

  const reward =
    String(
      rewardStatus || '',
    )
      .trim()
      .toLowerCase()

  if (
    reward ===
      'commission_created' ||
    status ===
      'commission_earned' ||
    reward === 'created' ||
    status ===
      'reward_created'
  ) {
    return 'earned'
  }

  if (
    status === 'qualified' ||
    reward === 'qualified'
  ) {
    return 'qualified'
  }

  if (
    status === 'rejected' ||
    reward === 'rejected'
  ) {
    return 'rejected'
  }

  return 'pending'
}
