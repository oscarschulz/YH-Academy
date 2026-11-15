export function clean(value = '') {
  return String(value ?? '').trim()
}

export function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

export function normalizeReferralCode(value = '') {
  return clean(value).toUpperCase()
}

export function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(value) ||
      'Pending'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
    },
  ).format(date)
}

export function statusClass(value = '') {
  const status =
    clean(value)
      .toLowerCase()

  if (
    status === 'approved'
  ) {
    return 'is-approved'
  }

  if (
    status === 'shortlisted'
  ) {
    return 'is-shortlisted'
  }

  if (
    [
      'pending',
      'under review',
      'screening',
    ].includes(status)
  ) {
    return 'is-pending'
  }

  if (
    status === 'rejected'
  ) {
    return 'is-rejected'
  }

  return ''
}

export function normalizeApplication(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(raw.id) ||
      `referral-${index + 1}`,

    userId:
      clean(raw.userId),

    fullName:
      clean(
        raw.fullName ||
          raw.name,
      ) ||
      'Federation Applicant',

    email:
      clean(raw.email),

    role:
      clean(
        raw.role ||
          raw.profession,
      ),

    primaryCategory:
      clean(
        raw.primaryCategory,
      ),

    country:
      clean(raw.country),

    city:
      clean(raw.city),

    status:
      clean(raw.status) ||
      'Under Review',

    createdAt:
      clean(
        raw.createdAt ||
          raw.submittedAt,
      ),
  }
}

export function normalizeSnapshot(
  raw = {},
  member = {},
) {
  return {
    referralCode:
      normalizeReferralCode(
        raw.referralCode ||
          member.referralCode,
      ),

    inviteUrlPath:
      clean(
        raw.inviteUrlPath,
      ),

    total:
      Number(
        raw.total || 0,
      ),

    pending:
      Number(
        raw.pending || 0,
      ),

    shortlisted:
      Number(
        raw.shortlisted || 0,
      ),

    approved:
      Number(
        raw.approved || 0,
      ),

    recent:
      safeArray(
        raw.recent,
      ).map(
        normalizeApplication,
      ),
  }
}

export async function copyText(
  value,
) {
  const text =
    clean(value)

  if (!text) {
    throw new Error(
      'Nothing to copy.',
    )
  }

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text,
    )
    return
  }

  const textarea =
    document.createElement(
      'textarea',
    )

  textarea.value =
    text

  textarea.setAttribute(
    'readonly',
    '',
  )

  textarea.style.position =
    'fixed'

  textarea.style.opacity =
    '0'

  document.body.appendChild(
    textarea,
  )

  textarea.select()

  const copied =
    document.execCommand(
      'copy',
    )

  textarea.remove()

  if (!copied) {
    throw new Error(
      'Copy failed.',
    )
  }
}
