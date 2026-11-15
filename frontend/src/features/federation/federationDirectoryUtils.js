export function clean(value = '') {
  return String(value ?? '').trim()
}

export function safeObject(value) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value
    : {}
}

export function normalizeMember(
  raw = {},
  index = 0,
) {
  const email =
    clean(
      raw.email ||
        raw.emailLower,
    ).toLowerCase()

  return {
    ...raw,

    id:
      clean(
        raw.id ||
          raw.userId ||
          email,
      ) ||
      `fed-member-${index + 1}`,

    userId:
      clean(
        raw.userId ||
          raw.id,
      ),

    email,

    name:
      clean(
        raw.name ||
          raw.fullName ||
          raw.username,
      ) ||
      'Federation Member',

    role:
      clean(
        raw.role ||
          raw.profession,
      ) ||
      'Approved Federation Member',

    badge:
      clean(raw.badge) ||
      'Verified',

    category:
      clean(
        raw.category ||
          raw.primaryCategory,
      ) ||
      'Strategic Operator',

    country:
      clean(raw.country),

    city:
      clean(raw.city),

    company:
      clean(raw.company),

    description:
      clean(
        raw.description ||
          raw.bio,
      ) ||
      'Approved Federation member.',

    avatar:
      clean(
        raw.avatar ||
          raw.profilePhoto ||
          raw.photoURL,
      ),
  }
}

export function buildRedactedName(
  name,
  mode,
) {
  const parts =
    clean(name)
      .split(/\s+/)
      .filter(Boolean)

  if (!parts.length) {
    return 'Private Member'
  }

  if (mode === 'partial') {
    const first =
      parts[0]

    const initial =
      parts[1]
        ? ` ${parts[1]
            .charAt(0)
            .toUpperCase()}.`
        : ''

    return `${first}${initial}`
  }

  return 'Private Member'
}

export function redactMember(
  member,
  mode,
) {
  if (mode === 'full') {
    return {
      ...member,
      __redacted:
        false,
    }
  }

  const partial =
    mode === 'partial'

  return {
    ...member,

    name:
      buildRedactedName(
        member.name,
        mode,
      ),

    role:
      member.category ||
      (partial
        ? 'Approved Member'
        : 'Federation Member'),

    company:
      'Private Organization',

    city:
      partial
        ? member.country ||
          'Regional Cluster'
        : 'Private City',

    description:
      partial
        ? 'Full introductions and operating details unlock after approval.'
        : 'This is a protected preview. Full member details unlock after approval.',

    badge:
      partial
        ? 'Screened'
        : 'Private',

    avatar: '',

    __redacted:
      true,
  }
}

export function getVisibilityMode(
  me = {},
) {
  const approved =
    me?.canEnterFederation ===
      true ||
    clean(
      me?.applicationStatus,
    ).toLowerCase() ===
      'approved'

  if (approved) {
    return 'full'
  }

  const application =
    safeObject(
      me?.application,
    )

  const status =
    clean(
      application.status ||
        me?.applicationStatus,
    ).toLowerCase()

  if (
    application.id ||
    [
      'under review',
      'pending',
      'submitted',
      'reviewing',
    ].includes(status)
  ) {
    return 'partial'
  }

  return 'preview'
}

export function initials(name = '') {
  return clean(name)
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase(),
    )
    .join('') || 'FM'
}
