export const MAX_ATTACHMENT_BYTES =
  50 * 1024 * 1024

export function clean(value = '') {
  return String(value ?? '').trim()
}

export function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

export function stored(key = '') {
  try {
    return (
      sessionStorage.getItem(key) ||
      localStorage.getItem(key) ||
      ''
    )
  } catch {
    return ''
  }
}

export function authToken() {
  return (
    stored('yh_token') ||
    stored('token')
  )
}

export function viewerId() {
  return clean(
    stored('yh_user_id') ||
      stored('yh_user_uid'),
  )
}

export function viewerName() {
  return clean(
    stored('yh_user_name') ||
      stored('yh_user_username') ||
      'Academy Member',
  )
}

export function viewerAvatar() {
  return clean(
    stored('yh_user_avatar'),
  )
}

export function getRoomId(room = {}) {
  return clean(
    room.id ||
      room.roomId ||
      room.room_id ||
      room.room_key,
  )
}

export function normalizeRoom(room = {}) {
  const id =
    getRoomId(room)

  const type =
    clean(
      room.room_type ||
        room.roomType ||
        room.type ||
        'group',
    ).toLowerCase() ===
    'dm'
      ? 'dm'
      : 'group'

  const memberIds =
    safeArray(
      room.member_ids ||
        room.memberIds,
    )
      .map(clean)
      .filter(Boolean)

  const names =
    safeArray(
      room.participantNames ||
        room.member_names ||
        room.memberNames ||
        room.participants,
    )
      .map(clean)
      .filter(Boolean)

  const me =
    viewerId()

  const recipientId =
    type === 'dm'
      ? memberIds.find(
          (idValue) =>
            idValue &&
            idValue !== me,
        ) || ''
      : ''

  return {
    ...room,

    id,
    roomId: id,
    type,

    name:
      clean(room.name) ||
      (type === 'dm'
        ? 'Direct Message'
        : 'Private Group'),

    memberIds,
    participantNames:
      names,

    recipientId,

    unreadCount:
      Math.max(
        0,
        Number(
          room.unread_count ??
            room.unreadCount ??
            0,
        ) || 0,
      ),

    lastMessage:
      clean(
        room.last_message_text ||
          room.lastMessage,
      ),

    lastMessageAuthor:
      clean(
        room.last_message_author ||
          room.lastMessageAuthor,
      ),

    lastMessageAt:
      clean(
        room.last_message_at ||
          room.lastMessageAt ||
          room.updated_at ||
          room.updatedAt,
      ),

    muted:
      room.is_muted === true ||
      room.isMuted === true,

    isRestrictedByMe:
      room.is_restricted_by_me ===
        true ||
      room.isRestrictedByMe ===
        true,

    isBlockedByMe:
      room.is_blocked_by_me ===
        true ||
      room.isBlockedByMe ===
        true,

    isBlocked:
      room.is_blocked === true ||
      room.isBlocked === true,

    isHidden:
      room.is_hidden === true ||
      room.isHidden === true,

    avatarUrl:
      clean(
        room.avatar ||
          room.avatarUrl ||
          room.avatar_url,
      ),
  }
}

export function getMessageId(message = {}) {
  return clean(
    message.id ||
      message.messageId ||
      message.message_id ||
      message.clientMessageId ||
      message.client_message_id,
  )
}

export function getMessageRoomId(
  message = {},
) {
  return clean(
    message.roomId ||
      message.room_id ||
      message.room ||
      message.room_key,
  )
}

export function getMessageText(
  message = {},
) {
  return clean(
    message.text ||
      message.body ||
      message.message,
  )
}

export function getMessageAuthor(
  message = {},
) {
  return clean(
    message.author ||
      message.displayName ||
      message.display_name ||
      message.fullName ||
      message.full_name ||
      message.username ||
      'Academy Member',
  )
}

export function getMessageAuthorId(
  message = {},
) {
  return clean(
    message.authorId ||
      message.author_id ||
      message.userId ||
      message.user_id ||
      message.createdByUserId ||
      message.created_by_user_id,
  )
}

export function isOwnMessage(
  message = {},
) {
  const me =
    viewerId()

  const author =
    getMessageAuthorId(
      message,
    )

  if (me && author) {
    return me === author
  }

  return (
    getMessageAuthor(message) ===
    viewerName()
  )
}

export function getMessageDate(
  message = {},
) {
  const raw =
    message.createdAt ||
    message.created_at ||
    message.timestamp ||
    message.time ||
    ''

  if (!raw) return ''

  const parsed =
    new Date(raw)

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return clean(raw)
  }

  return parsed.toLocaleString()
}

export function getAttachment(
  message = {},
) {
  const attachment =
    message.attachment

  if (
    attachment &&
    typeof attachment ===
      'object' &&
    attachment.url
  ) {
    return attachment
  }

  const url =
    clean(
      message.attachmentUrl ||
        message.attachment_url ||
        message.fileUrl ||
        message.file_url,
    )

  if (!url) return null

  return {
    url,

    originalName:
      clean(
        message.fileName ||
          message.file_name ||
          'Attachment',
      ),

    mimeType:
      clean(
        message.mimeType ||
          message.mime_type,
      ),
  }
}

export function mergeMessage(
  current = [],
  incoming = {},
) {
  const id =
    getMessageId(
      incoming,
    )

  if (!id) {
    return [
      ...current,
      incoming,
    ]
  }

  const index =
    current.findIndex(
      (message) =>
        getMessageId(
          message,
        ) === id,
    )

  if (index < 0) {
    return [
      ...current,
      incoming,
    ]
  }

  const next =
    [...current]

  next[index] = {
    ...next[index],
    ...incoming,
  }

  return next
}

export function roomTime(room = {}) {
  const raw =
    room.lastMessageAt

  if (!raw) return ''

  const parsed =
    new Date(raw)

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return ''
  }

  return parsed.toLocaleString()
}

export function createClientMessageId(
  roomId = '',
) {
  const random =
    typeof crypto
      ?.randomUUID ===
    'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 10)}`

  return `academy_${clean(
    roomId,
  )}_${random}`
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '_',
    )
    .slice(0, 160)
}
