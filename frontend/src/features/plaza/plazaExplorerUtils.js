export function clean(value = '') {
  return String(value ?? '').trim()
}

export function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

export function normalizeFeed(item = {}, index = 0) {
  return {
    id:
      clean(item.id) ||
      `plaza-feed-${index}`,

    type:
      clean(item.type) ||
      'introduction',

    authorName:
      clean(
        item.authorName ||
          item.member,
      ) ||
      'Plaza Member',

    region:
      clean(item.region) ||
      'Global',

    title:
      clean(item.title) ||
      'Plaza update',

    text:
      clean(
        item.text ||
          item.body,
      ),

    tag:
      clean(item.tag),
  }
}

export function normalizeOpportunity(
  item = {},
  index = 0,
) {
  return {
    id:
      clean(item.id) ||
      `plaza-opportunity-${index}`,

    title:
      clean(item.title) ||
      'Plaza Opportunity',

    text:
      clean(
        item.text ||
          item.description,
      ),

    region:
      clean(item.region) ||
      'Global',

    type:
      clean(item.type) ||
      'Opportunity',

    status:
      clean(
        item.status ||
          item.opportunityStatus,
      ),

    currency:
      clean(item.currency) ||
      'USD',

    budgetMin:
      Number(
        item.budgetMin || 0,
      ) || 0,

    budgetMax:
      Number(
        item.budgetMax || 0,
      ) || 0,
  }
}

export function normalizeDirectory(
  item = {},
  index = 0,
) {
  return {
    id:
      clean(
        item.id ||
          item.userId ||
          item.authorId,
      ) ||
      `plaza-member-${index}`,

    name:
      clean(
        item.displayName ||
          item.fullName ||
          item.name ||
          item.username,
      ) ||
      'Plaza Member',

    region:
      clean(item.region) ||
      'Global',

    role:
      clean(
        item.roleTrack ||
          item.role ||
          item.headline,
      ) ||
      'Member',

    lookingFor:
      clean(
        item.lookingFor ||
          item.looking_for,
      ),

    canOffer:
      clean(
        item.canOffer ||
          item.can_offer,
      ),
  }
}

export function normalizeRegion(
  item = {},
  index = 0,
) {
  return {
    id:
      clean(item.id) ||
      `plaza-region-${index}`,

    region:
      clean(
        item.region ||
          item.name,
      ) ||
      'Global',

    label:
      clean(
        item.label ||
          item.title ||
          item.name,
      ) ||
      'Region Hub',

    text:
      clean(
        item.text ||
          item.description ||
          item.summary,
      ),

    continent:
      clean(item.continent),

    network:
      clean(item.network),

    count:
      Number(
        item.count ||
          item.memberCount ||
          0,
      ) || 0,

    countries:
      safeArray(
        item.countries,
      ),
  }
}

export function formatBudget(
  opportunity,
) {
  const min =
    Number(
      opportunity.budgetMin ||
        0,
    )

  const max =
    Number(
      opportunity.budgetMax ||
        0,
    )

  if (!min && !max) {
    return 'Budget not specified'
  }

  const currency =
    opportunity.currency ||
    'USD'

  if (min && max) {
    return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`
  }

  return `${currency} ${(max || min).toLocaleString()}`
}


export function normalizePlazaReputation(
  payload = {},
) {
  const profile =
    payload?.profile &&
    typeof payload.profile ===
      'object'
      ? payload.profile
      : {}

  const events =
    safeArray(
      payload?.events,
    ).map(
      (event, index) => ({
        id:
          clean(event?.id) ||
          `plaza-reputation-${index}`,

        eventType:
          clean(
            event?.eventType ||
              event?.type,
          ),

        reputationPoints:
          Number(
            event?.reputationPoints ||
              event?.points ||
              0,
          ) || 0,

        region:
          clean(
            event?.region,
          ) || 'Global',

        occurredAt:
          clean(
            event?.occurredAt ||
              event?.createdAt,
          ),
      }),
    )

  return {
    loaded:
      payload?.loaded !==
      false,

    totalReputation:
      Number(
        profile.totalReputation ||
          0,
      ) || 0,

    weeklyReputation:
      Number(
        profile.weeklyReputation ||
          0,
      ) || 0,

    eventCount:
      Number(
        profile.eventCount ??
          payload?.eventCount ??
          events.length,
      ) || 0,

    lastEventType:
      clean(
        profile.lastEventType,
      ),

    lastEventAt:
      clean(
        profile.lastEventAt,
      ),

    events,
  }
}

export function plazaReputationRank(
  total = 0,
) {
  const score =
    Number(total || 0)

  if (score >= 100) {
    return {
      key: 'world-builder',
      label: 'World Builder',
      nextLabel: 'Max Rank',
      nextAt: 100,
    }
  }

  if (score >= 50) {
    return {
      key: 'regional-operator',
      label:
        'Regional Operator',
      nextLabel:
        'World Builder',
      nextAt: 100,
    }
  }

  if (score >= 20) {
    return {
      key: 'connector',
      label: 'Connector',
      nextLabel:
        'Regional Operator',
      nextAt: 50,
    }
  }

  if (score >= 5) {
    return {
      key: 'explorer',
      label: 'Explorer',
      nextLabel: 'Connector',
      nextAt: 20,
    }
  }

  return {
    key: 'newcomer',
    label: 'Newcomer',
    nextLabel: 'Explorer',
    nextAt: 5,
  }
}

/* YHU_PLAZA_HOME_ZONE_ORIGINAL_PARITY */
export function resolvePlazaExplorerHomeZone(regions = []) {
  const readStoredValue = (keys) => {
    for (const key of keys) {
      try {
        const value = clean(
          sessionStorage.getItem(key) ||
          localStorage.getItem(key)
        )
        if (value) return value
      } catch {}
    }
    return ''
  }

  const country = readStoredValue([
    'yh_user_country',
    'yh_user_country_of_residence',
    'yh_user_location_country',
    'country'
  ])

  const city = readStoredValue([
    'yh_user_city',
    'yh_user_location_city',
    'city'
  ])

  const normalize = value =>
    clean(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

  const aliases = new Map([
    ['usa', 'united states of america'],
    ['united states', 'united states of america'],
    ['uk', 'united kingdom'],
    ['uae', 'united arab emirates']
  ])

  const rawCountry = normalize(country)
  const target = aliases.get(rawCountry) || rawCountry

  const match = target
    ? safeArray(regions).find(region =>
        safeArray(region.countries).some(
          item => normalize(item) === target
        )
      )
    : null

  return {
    established: Boolean(match),
    country,
    city,
    regionId: clean(match?.id),
    region: clean(match?.region),
    network: clean(match?.network || match?.continent),
    label: match
      ? clean(
          match.label ||
          match.region ||
          match.network ||
          country
        )
      : 'Not established'
  }
}

/* YHU_REACT_PLAZA_REPUTATION_PARITY */
