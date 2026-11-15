export const CACHE_KEY = 'yh_business_chats_page_cache_v1'
export const LAST_SEEN_KEY = 'yh_business_chats_page_seen_at_v1'
export const PURPOSE_CACHE_KEY = 'yh_business_chats_selected_purpose_v1'

export const PURPOSES = [
  'Business collaboration',
  'Partnership',
  'Service request',
  'Investment or deal flow',
  'Introduction request',
  'Hiring or project work',
  'Looking for jobs',
]

export const JOB_SEARCH_HINT =
  'jobs hiring work opportunity employment recruiter project role'

export function clean(value = '') {
  return String(value ?? '').trim()
}

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export function getStoredToken() {
  const keys = [
    'yh_token',
    'token',
    'authToken',
    'access_token',
  ]

  const stores = [
    sessionStorage,
    localStorage,
  ]

  for (const store of stores) {
    for (const key of keys) {
      try {
        const value = clean(
          store.getItem(key),
        )

        if (value) {
          return value
        }
      } catch {}
    }
  }

  return ''
}

export function isJobPurpose(value = '') {
  const normalized =
    clean(value).toLowerCase()

  return (
    normalized ===
      'looking for jobs' ||
    normalized ===
      'looking_for_jobs'
  )
}

export function normalizeDivision(value = '') {
  const division =
    clean(value).toLowerCase()

  if (
    [
      'academy',
      'plaza',
      'federation',
    ].includes(division)
  ) {
    return division
  }

  return 'all'
}

export function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(value)
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

export function normalizeMessage(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(raw.id) ||
      `message-${index + 1}`,

    sender:
      clean(raw.sender || raw.authorName || raw.senderName || raw.name) ||
      'Member',

    type:
      clean(raw.type) ||
      'message',

    text:
      clean(raw.text),

    createdAt:
      clean(
        raw.createdAt ||
          raw.created_at,
      ),
  }
}

export function normalizeConversation(
  raw = {},
  index = 0,
) {
  const messages =
    safeArray(
      raw.messages,
    ).map(
      normalizeMessage,
    )

  return {
    ...raw,

    id:
      clean(raw.id) ||
      `business-conversation-${index + 1}`,

    title:
      clean(
        raw.title ||
          raw.targetLabel,
      ) ||
      'Business conversation',

    targetLabel:
      clean(
        raw.targetLabel,
      ),

    contextTitle:
      clean(
        raw.contextTitle,
      ),

    contextRoute:
      clean(
        raw.contextRoute,
      ) ||
      'Plaza business conversation',

    sourceDivision:
      clean(
        raw.sourceDivision,
      ),

    targetDivision:
      clean(
        raw.targetDivision,
      ),

    businessPurpose:
      clean(
        raw.businessPurpose,
      ),

    businessIntent:
      clean(
        raw.businessIntent ||
          raw.intentCategory,
      ),

    jobSearchIntent:
      raw.jobSearchIntent ===
        true ||
      isJobPurpose(
        raw.businessPurpose ||
          raw.businessIntent ||
          raw.intentCategory,
      ),

    status:
      clean(raw.status) ||
      'active',

    moderation:
      raw.moderation &&
      typeof raw.moderation ===
        'object'
        ? raw.moderation
        : {},

    blockedBy:
      raw.blockedBy &&
      typeof raw.blockedBy ===
        'object'
        ? raw.blockedBy
        : {},

    closedBy:
      raw.closedBy &&
      typeof raw.closedBy ===
        'object'
        ? raw.closedBy
        : {},

    businessThreadKey:
      clean(
        raw.businessThreadKey,
      ),

    businessBlock:
      raw.businessBlock &&
      typeof raw.businessBlock ===
        'object'
        ? raw.businessBlock
        : {
            active: false,
            blockedByMe: false,
            blockedMe: false,
            message: '',
          },

    participantIds:
      safeArray(
        raw.participantIds,
      )
        .map(clean)
        .filter(Boolean),

    participants:
      safeArray(
        raw.participants,
      )
        .map(clean)
        .filter(Boolean),

    reports:
      safeArray(
        raw.reports,
      ),

    messages,

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

export function normalizeMember(
  raw = {},
  index = 0,
) {
  const division =
    normalizeDivision(
      raw.division ||
        raw.sourceDivision ||
        raw.membershipType ||
        'plaza',
    )

  const divisionLabel =
    clean(
      raw.divisionLabel,
    ) ||
    (
      division ===
      'academy'
        ? 'Academy'
        : division ===
            'federation'
          ? 'Federation'
          : division ===
              'plaza'
            ? 'Plaza'
            : 'YH Universe'
    )

  return {
    ...raw,

    id:
      clean(
        raw.id ||
          raw.userId ||
          raw.uid ||
          raw.ownerUid,
      ) ||
      `business-member-${index + 1}`,

    name:
      clean(
        raw.name ||
          raw.fullName ||
          raw.displayName ||
          raw.username,
      ) ||
      'YH Member',

    username:
      clean(
        raw.username,
      ).replace(
        /^@+/,
        '',
      ),

    division,
    divisionLabel,

    membershipType:
      clean(
        raw.membershipType,
      ) ||
      division,

    role:
      clean(
        raw.role ||
          raw.roleLabel ||
          raw.title,
      ) ||
      'YH Universe Member',

    location:
      clean(
        raw.location,
      ) ||
      [
        raw.city,
        raw.country,
      ]
        .filter(Boolean)
        .join(', '),

    headline:
      clean(
        raw.headline ||
          raw.bio ||
          raw.about ||
          raw.role,
      ),

    avatar:
      clean(
        raw.avatar ||
          raw.avatarUrl ||
          raw.avatar_url ||
          raw.profilePhoto ||
          raw.photoURL,
      ),
  }
}

export function normalizeBlock(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(
        raw.blockedUserId ||
          raw.otherUserId ||
          raw.targetUserId ||
          raw.userId ||
          raw.id,
      ) ||
      `blocked-member-${index + 1}`,

    name:
      clean(
        raw.blockedUserName ||
          raw.otherUserName ||
          raw.targetUserName ||
          raw.name ||
          raw.displayName,
      ) ||
      'Blocked member',

    role:
      clean(
        raw.role ||
          raw.targetRole ||
          raw.otherUserRole,
      ),

    createdAt:
      clean(
        raw.createdAt ||
          raw.blockedAt,
      ),
  }
}

export function isBlocked(
  conversation = {}, blocks = [],
) {
  const status =
    clean(
      conversation.status,
    ).toLowerCase()

  const moderation =
    conversation.moderation &&
    typeof conversation.moderation ===
      'object'
      ? conversation.moderation
      : {}

  const blockedBy =
    conversation.blockedBy &&
    typeof conversation.blockedBy ===
      'object'
      ? conversation.blockedBy
      : {}

  const businessBlock =
    conversation.businessBlock &&
    typeof conversation.businessBlock ===
      'object'
      ? conversation.businessBlock
      : {}

  return (
    status === 'blocked' ||
    moderation.blocked ===
      true ||
    Object.values(
      blockedBy,
    ).some(Boolean) ||
    businessBlock.active === true ||
    safeArray(blocks).some(block => safeArray(conversation.participantIds).includes(clean(block.blockedUserId || block.otherUserId || block.targetUserId || block.userId || block.id)))
  )
}

export function isClosed(
  conversation = {},
) {
  const status =
    clean(
      conversation.status,
    ).toLowerCase()

  const moderation =
    conversation.moderation &&
    typeof conversation.moderation ===
      'object'
      ? conversation.moderation
      : {}

  return (
    status === 'closed' || status === 'archived' ||
    moderation.closed ===
      true
  )
}

export function isLocked(
  conversation = {}, blocks = [],
) {
  return (
    isBlocked(
      conversation, blocks,
    ) ||
    isClosed(
      conversation,
    )
  )
}

export function conversationUpdatedAt(
  conversation = {},
) {
  const values = [
    conversation.updatedAt,
    conversation.createdAt,
    ...safeArray(
      conversation.messages,
    ).map(
      (message) =>
        message.createdAt,
    ),
  ]

  return values.reduce(
    (
      latest,
      value,
    ) => {
      const time =
        new Date(
          value || 0,
        ).getTime()

      if (
        Number.isFinite(time) &&
        time > latest
      ) {
        return time
      }

      return latest
    },
    0,
  )
}

export function conversationKey(conversation = {}) {
  const ids = Array.from(new Set(safeArray(conversation.participantIds).map(clean).filter(Boolean))).sort()
  if (ids.length >= 2) return 'business_pair_ids_' + JSON.stringify(ids)
  if (clean(conversation.businessThreadKey)) return 'business_thread_key_' + clean(conversation.businessThreadKey)
  // Names are display labels, never proof that two threads have the same participants.
  return 'business_id_' + clean(conversation.id)
}

export function mergeMessages(
  items = [],
) {
  const seen =
    new Set()

  const messages = []

  items.forEach(
    (conversation) => {
      safeArray(
        conversation.messages,
      ).forEach(
        (message) => {
          const key = [
            message.id,
            message.sender,
            message.text,
            message.createdAt,
          ].join('|')

          if (
            seen.has(key)
          ) {
            return
          }

          seen.add(key)
          messages.push(
            message,
          )
        },
      )
    },
  )

  return messages.sort(
    (a, b) =>
      new Date(
        a.createdAt ||
          0,
      ).getTime() -
      new Date(
        b.createdAt ||
          0,
      ).getTime(),
  )
}

export function dedupeConversations(raw = []) {
  const grouped = new Map()
  for (const item of safeArray(raw)) {
    if (!clean(item?.id)) continue
    const next = normalizeConversation(item)
    const key = conversationKey(next)
    const previous = grouped.get(key)
    const aliases = Array.from(new Set([next.id, ...safeArray(next.sourceConversationIds), ...(previous ? [previous.id, ...safeArray(previous.sourceConversationIds)] : [])])).map(clean).filter(Boolean)
    if (!previous) {
      grouped.set(key, { ...next, sourceConversationIds: aliases })
      continue
    }
    const preferred = conversationUpdatedAt(next) > conversationUpdatedAt(previous) || (conversationUpdatedAt(next) === conversationUpdatedAt(previous) && next.id.localeCompare(previous.id) < 0) ? next : previous
    const blocked = [previous, next].find(conversation => isBlocked(conversation))
    grouped.set(key, {
      ...preferred, sourceConversationIds: aliases,
      messages: mergeMessages([previous, next]),
      ...(blocked ? { status: 'blocked', businessBlock: { ...blocked.businessBlock, active: true } } : {}),
    })
  }
  return [...grouped.values()].sort((a, b) => conversationUpdatedAt(b) - conversationUpdatedAt(a))
}

function normalizeSearchText(value = '') {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9@._\s-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

function memberMatchesBusinessDivision(member = {}, division = 'all') {
    const cleanDivision = normalizeDivision(division);
    if (cleanDivision === 'all') return true;

    const fields = [
      member.division,
      member.divisionLabel,
      member.membershipType,
      member.sourceDivision,
      member.role,
      member.headline
    ].map(normalizeSearchText).join(' ');

    return fields.includes(cleanDivision);
  }

function getBusinessMemberSearchNeedle(member = {}) {
    const values = [
      member.id,
      member.name,
      member.username,
      member.role,
      member.location,
      member.division,
      member.divisionLabel,
      member.headline,
      member.bio,
      member.about,
      member.city,
      member.country,
      member.skill,
      member.skills,
      member.tags,
      member.canOffer,
      member.lookingFor
    ];

    return normalizeSearchText(values.flat().join(' '));
  }

function memberMatchesBusinessSearch(member = {}, rawQuery = '', division = 'all') {
    if (!memberMatchesBusinessDivision(member, division)) return false;

    const query = normalizeSearchText(rawQuery);
    if (!query) return true;

    const haystack = getBusinessMemberSearchNeedle(member);
    return query.split(' ').filter(Boolean).every((term) => haystack.includes(term));
  }

export function filterBusinessMembersForSearch(members = [], rawQuery = '', division = 'all') {
    const seen = new Set();

    return members
      .filter((member) => memberMatchesBusinessSearch(member, rawQuery, division))
      .filter((member) => {
        const id = String(member.id || '').trim();
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

export function selectBusinessConversationId(rows, currentId = '', previous = null, requestedId = '') {
  const resolve = id => rows.find(item => item.id === id || safeArray(item.sourceConversationIds).includes(id))
  const chosen = resolve(clean(requestedId)) || resolve(clean(currentId)) ||
    (previous ? rows.find(item => conversationKey(item) === conversationKey(previous)) : null)
  return chosen?.id || rows[0]?.id || ''
}

export function businessChatSessionKey() {
  return getBusinessChatOwnerId() + ':' + getStoredToken()
}

export function conversationMeta(
  conversation = {},
) {
  const purpose =
    isJobPurpose(
      conversation.businessPurpose ||
        conversation.businessIntent,
    )
      ? 'Looking for jobs'
      : conversation.businessPurpose

  return [
    purpose,
    conversation.sourceDivision &&
    conversation.targetDivision
      ? `${conversation.sourceDivision} → ${conversation.targetDivision}`
      : '',
    conversation.contextRoute,
  ]
    .filter(Boolean)
    .join(' • ')
}

export function initials(
  value = '',
) {
  return clean(value)
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase(),
    )
    .join('') || 'YH'
}

/* YHU_BUSINESS_CHAT_ACCOUNT_SCOPED_STORAGE_PARITY */
const ORIGINAL_BUSINESS_CHAT_SEEN_KEY =
  'yh_business_chat_seen_at_v1'


/* YHU_BUSINESS_CHAT_AUTH_ID_FALLBACK_PARITY */
function getBusinessChatOwnerId() {
  // Browser cache partition only; never server authorization.
  let token = ''

  try {
    token = getStoredToken()
  } catch {}

  if (token) {
    try {
      const parts = token.split('.')

      if (parts.length === 3) {
        const encoded = parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/')

        const padded = encoded.padEnd(
          Math.ceil(encoded.length / 4) * 4, '='
        )

        const payload = JSON.parse(atob(padded))

        const id = clean(
          payload.user_id ||
          payload.uid ||
          payload.sub ||
          payload.id ||
          payload.user?.id
        )

        if (id) return id
      }
    } catch {}

    // Do not use a stale stored ID with an unrecognized token.
    return ''
  }

  for (const key of [
    'yh_current_user', 'yh_user', 'currentUser', 'user'
  ]) {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const user = JSON.parse(store.getItem(key) || 'null')
        const id = clean(
          user?.id || user?.uid || user?.user_id || user?.user?.id
        )
        if (id) return id
      } catch {}
    }
  }

  for (const key of [
    'yh_user_id', 'yh_user_uid', 'yh_uid', 'user_id', 'uid'
  ]) {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const id = clean(store.getItem(key))
        if (id) return id
      } catch {}
    }
  }

  return ''
}

function scopedBusinessChatKey(baseKey) {
  const ownerId = getBusinessChatOwnerId()
  return ownerId ? baseKey + ':' + ownerId : ''
}

/* YHU_BUSINESS_CHAT_PURPOSE_SCOPE_PATCH04 */
export function readPurposeCache() {
  try {
    const key = scopedBusinessChatKey(PURPOSE_CACHE_KEY);
    return key ? clean(localStorage.getItem(key)) : '';
  } catch {
    return '';
  }
}

export function writePurposeCache(value) {
  try {
    const key = scopedBusinessChatKey(PURPOSE_CACHE_KEY);
    if (key) localStorage.setItem(key, clean(value));
  } catch {}
}



/* YHU_BUSINESS_CHAT_SEPARATE_SEEN_KEYS_PARITY */
function readBusinessSeen(baseKey) {
  try {
    const key = scopedBusinessChatKey(baseKey)
    return key ? Number(localStorage.getItem(key) || 0) || 0 : 0
  } catch {
    return 0
  }
}

function writeBusinessSeen(baseKey) {
  const at = Date.now()
  try {
    const key = scopedBusinessChatKey(baseKey)
    if (key) localStorage.setItem(key, String(at))
  } catch {}
  return at
}

export function readLastSeen() {
  return readBusinessSeen(LAST_SEEN_KEY)
}

export function writeLastSeen() {
  return writeBusinessSeen(LAST_SEEN_KEY)
}

export function readInlineLastSeen() {
  return readBusinessSeen(ORIGINAL_BUSINESS_CHAT_SEEN_KEY)
}

export function writeInlineLastSeen() {
  writeBusinessSeen(ORIGINAL_BUSINESS_CHAT_SEEN_KEY)
}

export function readCache() {
  try {
    const key = scopedBusinessChatKey(CACHE_KEY)
    if (!key) return {}

    const parsed = JSON.parse(
      localStorage.getItem(key) || '{}'
    )

    return parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
        ? parsed
        : {}
  } catch {
    return {}
  }
}

export function writeCache(conversations) {
  try {
    const key = scopedBusinessChatKey(CACHE_KEY)
    if (!key) return

    localStorage.setItem(
      key,
      JSON.stringify({
        conversations,
        savedAt: Date.now(),
      })
    )
  } catch {}
}
