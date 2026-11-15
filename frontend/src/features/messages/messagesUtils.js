import { useSyncExternalStore } from 'react'
import { apiFetch } from '../../services/api/apiClient'

// One user-scoped inbox snapshot for the workspace and navigation badge.
const EMPTY_MESSAGES = Object.freeze([])
let inboxOwner = ''
let inboxRooms = EMPTY_MESSAGES
let inboxVersion = 0
let inboxRequest = null
const inboxListeners = new Set()
const messageProfiles = new Map()
const profileRequests = new Map()
const memberSearchCache = new Map()
const memberSearchRequests = new Map()

export function messagesOwner() {
  return JSON.stringify([getCurrentUserId(), getStoredAuthToken()])
}

function ensureMessagesOwner() {
  const owner = messagesOwner()
  if (owner !== inboxOwner) {
    inboxOwner = owner
    inboxRooms = EMPTY_MESSAGES
    inboxVersion += 1
    inboxRequest = null
    messageProfiles.clear()
    profileRequests.clear()
    memberSearchCache.clear()
    memberSearchRequests.clear()
    inboxListeners.forEach(listener => listener())
  }
  return owner
}

export function getMessagesInbox() {
  return inboxOwner === messagesOwner() ? inboxRooms : EMPTY_MESSAGES
}

function subscribeMessagesInbox(listener) {
  inboxListeners.add(listener)
  return () => inboxListeners.delete(listener)
}

export function useMessagesInbox() {
  return useSyncExternalStore(subscribeMessagesInbox, getMessagesInbox, () => EMPTY_MESSAGES)
}

function publishMessagesInbox(rooms) {
  inboxRooms = Object.freeze(rooms.slice())
  inboxListeners.forEach(listener => listener())
}

export function updateMessagesInbox(update) {
  ensureMessagesOwner()
  // A confirmed local mutation invalidates older list responses.
  inboxVersion += 1
  inboxRequest = null
  publishMessagesInbox(typeof update === 'function' ? update(inboxRooms) : update)
}

export function rememberMessageProfile(profile) {
  ensureMessagesOwner()
  const id = getMemberId(profile)
  if (id) messageProfiles.set(id, profile)
}

export function loadMessagesInbox({ force = false } = {}) {
  const owner = ensureMessagesOwner()
  if (inboxRequest && !force) return inboxRequest
  const version = ++inboxVersion
  const request = (async () => {
    try {
      const result = await apiFetch('/api/realtime/rooms', { method: 'GET' })
      if (!Array.isArray(result?.rooms)) throw new Error('Conversation list response was incomplete.')
      if (owner !== messagesOwner() || owner !== inboxOwner || version !== inboxVersion) return getMessagesInbox()
      const rooms = result.rooms
        .filter(room => room && typeof room === 'object' && ['dm', 'group'].includes(String(room?.room_type || room?.roomType || room?.type || 'dm').trim().toLowerCase()))
        .map(room => normalizeRoom(room, messageProfiles.get(normalizeId(room.recipient_id || room.recipientId)) || {}))
        .filter(room => room.id)
        .sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')))
      publishMessagesInbox(rooms)
      return inboxRooms
    } catch (error) {
      if (owner !== messagesOwner() || version !== inboxVersion) return getMessagesInbox()
      throw error
    }
  })()
  inboxRequest = request
  const release = () => { if (inboxRequest === request) inboxRequest = null }
  void request.then(release, release)
  return request
}

export function normalizeMessageAvatar(value = '') {
  const url = String(value || '').trim()
  if (!url || /^(loading|checking|syncing|preparing)(\.\.\.)?$/.test(url)) return ''
  if (/^(blob:|https?:\/\/|\/|data:image\/)/i.test(url)) return url
  return '/' + url.replace(/^\/+/, '')
}

export async function hydrateMessageProfile(roomId) {
  const owner = ensureMessagesOwner()
  const room = inboxRooms.find(item => item.id === roomId)
  if (!room || room.roomType !== 'dm' || !room.recipientId) return null
  const id = room.recipientId
  let profile = messageProfiles.get(id)
  if (!profile) {
    let request = profileRequests.get(id)
    if (!request) {
      request = (async () => {
        const results = await Promise.allSettled([
          apiFetch('/api/academy/community/members/' + encodeURIComponent(id) + '/profile', { method: 'GET' }),
          apiFetch('/api/universe/profile/' + encodeURIComponent(id), { method: 'GET' }),
        ])
        const academy = results[0].status === 'fulfilled' ? results[0].value?.profile || {} : {}
        const universe = results[1].status === 'fulfilled' ? results[1].value?.profile || {} : {}
        if (!getMemberId(academy) && !getMemberId(universe)) throw new Error('Profile not found.')
        const first = (...values) => values.map(value => String(value || '').trim()).find(Boolean) || ''
        return {
          ...universe, ...academy, id,
          displayName: first(academy.displayName, academy.display_name, academy.fullName, academy.full_name, academy.name, universe.displayName, universe.display_name, universe.fullName, universe.full_name, universe.name),
          username: first(academy.username, academy.userName, universe.username, universe.userName),
          avatar: normalizeMessageAvatar(first(academy.avatar, academy.avatar_url, academy.avatarUrl, academy.profile_photo, academy.profilePhoto, academy.photo_url, academy.photoURL, universe.avatar, universe.avatar_url, universe.avatarUrl, universe.profile_photo, universe.profilePhoto, universe.photo_url, universe.photoURL)),
        }
      })()
      profileRequests.set(id, request)
      const release = () => { if (profileRequests.get(id) === request) profileRequests.delete(id) }
      void request.then(release, release)
    }
    profile = await request
    if (owner !== messagesOwner() || owner !== inboxOwner) return null
    messageProfiles.set(id, profile)
  }
  // Enrichment never re-adds a conversation deleted while profile loading.
  const target = inboxRooms.find(item => item.id === roomId)
  if (target) publishMessagesInbox(inboxRooms.map(item => item.id === roomId ? normalizeRoom(item, profile) : item))
  return profile
}

export async function searchMessageMember(query) {
  const text = String(query || '').trim()
  if (!text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null
  const owner = ensureMessagesOwner()
  const key = text.toLowerCase()
  const cached = memberSearchCache.get(key)
  if (cached && Date.now() - cached.at < 15000) return cached.members.find(member => getMemberId(member)) || null
  let request = memberSearchRequests.get(key)
  if (!request) {
    request = apiFetch('/api/academy/community/members?limit=24&query=' + encodeURIComponent(text), { method: 'GET' })
      .then(result => Array.isArray(result?.members) ? result.members : [])
    memberSearchRequests.set(key, request)
    const release = () => { if (memberSearchRequests.get(key) === request) memberSearchRequests.delete(key) }
    void request.then(release, release)
  }
  const members = await request
  if (owner !== messagesOwner() || owner !== inboxOwner) return null
  memberSearchCache.set(key, { at: Date.now(), members })
  return members.find(member => getMemberId(member)) || null
}

export function mergeMessageHistory(history, existing, arrivals, startedAt) {
  const newer = existing.filter(item => (arrivals?.get(item.id || item) || 0) > startedAt)
  const byId = new Map()
  const withoutIds = []
  for (const item of [...history, ...newer]) {
    if (item.id) byId.set(item.id, item)
    else withoutIds.push(item)
  }
  return [...byId.values(), ...withoutIds].sort((a, b) => (Date.parse(a.time || '') || 0) - (Date.parse(b.time || '') || 0))
}

export function messageTimeIso(value = '') {
  const text = String(value || '').trim()
  if (!text) return undefined
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function getStoredValue(...keys) {
  for (const key of keys) {
    try {
      const sessionValue =
        String(
          sessionStorage.getItem(key) || '',
        ).trim()

      if (sessionValue) {
        return sessionValue
      }
    } catch {}

    try {
      const localValue =
        String(
          localStorage.getItem(key) || '',
        ).trim()

      if (localValue) {
        return localValue
      }
    } catch {}
  }

  return ''
}

export function getStoredAuthToken() {
  return getStoredValue(
    'yh_token',
    'token',
  )
}

export function getCurrentUserId() {
  return getStoredValue(
    'yh_user_id',
    'yh_user_uid',
  )
}

export function normalizeId(value = '') {
  return String(value || '').trim()
}

export function getMemberId(member = {}) {
  return normalizeId(member?.id || member?.uid || member?.userId || member?.user_id || member?.firebaseUid || member?.firebase_uid || '')
}

export function normalizeRoom(
    room = {},
    profile = {}
) {
    const safeProfile =
        profile &&
        typeof profile === 'object'
            ? profile
            : {};

    const roomType =
        String(
            room.room_type ||
            room.roomType ||
            room.type ||
            'dm'
        )
            .trim()
            .toLowerCase() === 'group'
            ? 'group'
            : 'dm';

    const recipientId =
        normalizeId(
            safeProfile.id ||
            safeProfile.uid ||
            room.recipient_id ||
            room.recipientId ||
            ''
        );

    const memberNames =
        Array.isArray(room.member_names)
            ? room.member_names
            : Array.isArray(room.memberNames)
                ? room.memberNames
                : Array.isArray(room.participantNames)
                    ? room.participantNames
                    : [];

    const groupFallbackName =
        memberNames.length
            ? memberNames.slice(0, 3).join(', ')
            : 'Group Conversation';

    const name =
        String(
            roomType === 'group'
                ? (
                    room.name ||
                    room.title ||
                    groupFallbackName
                )
                : (
                    safeProfile.displayName ||
                    safeProfile.display_name ||
                    safeProfile.fullName ||
                    safeProfile.full_name ||
                    safeProfile.name ||
                    room.recipient_name ||
                    room.recipientName ||
                    room.name ||
                    'YH Member'
                )
        ).trim() ||
        (
            roomType === 'group'
                ? 'Group Conversation'
                : 'YH Member'
        );

    const username =
        roomType === 'group'
            ? String(
                memberNames.length
                    ? `${memberNames.length} members`
                    : 'Group'
            )
                .trim()
            : String(
                safeProfile.username ||
                safeProfile.userName ||
                room.recipient_username ||
                room.recipientUsername ||
                room.username ||
                ''
            )
                .replace(/^@+/, '')
                .trim();

    const rawAvatar =
        String(
            safeProfile.avatar ||
            safeProfile.avatar_url ||
            safeProfile.avatarUrl ||
            safeProfile.profile_photo ||
            safeProfile.profilePhoto ||
            safeProfile.photo_url ||
            safeProfile.photoURL ||
            room.avatar ||
            room.avatar_url ||
            room.avatarUrl ||
            ''
        ).trim();

    const avatar =
        typeof normalizeMessageAvatar ===
        'function'
            ? String(
                normalizeMessageAvatar(
                    rawAvatar
                ) ||
                ''
            ).trim()
            : rawAvatar;

    return {
        ...room,

        id:
            String(
                room.id ||
                room.roomId ||
                room.room_id ||
                ''
            ).trim(),

        roomType,

        recipientId,
        recipient_id:
            recipientId,

        name,

        recipientName:
            name,

        username,

        avatar,

        memberNames,

        unreadCount:
            Math.max(
                0,
                Number(
                    room.unread_count ??
                    room.unreadCount ??
                    0
                ) || 0
            ),

        lastMessage:
            String(
                room.last_message_text ||
                room.lastMessage ||
                ''
            ).trim(),

        lastMessageAt:
            room.last_message_at ||
            room.lastMessageAt ||
            room.updated_at ||
            room.updatedAt ||
            ''
    };
}

export function normalizeMessage(
    message = {}
) {
    return {
        ...message,

        id:
            String(
                message.id ||
                message.messageId ||
                ''
            ).trim(),

        roomId:
            String(
                message.room ||
                message.roomId ||
                message.room_id ||
                ''
            ).trim(),

        authorId:
            normalizeId(
                message.authorId ||
                message.author_id ||
                message.createdByUserId ||
                message.created_by_user_id ||
                ''
            ),

        author:
            String(
                message.author ||
                'YH Member'
            ).trim(),

        text:
            String(
                message.text ||
                ''
            ),

time:
    message.time ||
    message.created_at ||
    message.createdAt ||
    message.sent_at ||
    message.sentAt ||
    message.timestamp ||
    ''
    };
}

export function formatMessageTime(
  value = '',
) {
  const clean =
    String(value || '').trim()

  if (!clean) return ''

  const date = new Date(clean)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  const now = new Date()

  const sameDay =
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()

  const time =
    new Intl.DateTimeFormat(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
      },
    ).format(date)

  if (sameDay) {
    return time
  }

  const sameYear =
    date.getFullYear() ===
    now.getFullYear()

  const day =
    new Intl.DateTimeFormat(
      undefined,
      sameYear
        ? {
            month: 'short',
            day: 'numeric',
          }
        : {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          },
    ).format(date)

  return `${day}, ${time}`
}

export function isRoomBlocked(
    room = null
) {
    if (
        !room ||
        typeof room !==
            'object'
    ) {
        return false;
    }

    const blockedBy =
        room.blockedBy ||
        room.blocked_by ||
        null;

    if (
        blockedBy &&
        typeof blockedBy ===
            'object' &&
        Object.values(
            blockedBy
        ).some(Boolean)
    ) {
        return true;
    }

    if (
        typeof blockedBy ===
            'string' &&
        blockedBy.trim()
    ) {
        return true;
    }

    return Boolean(
        room.__dashboardBlocked === true ||
        room.blocked === true ||
        room.isBlocked === true ||
        room.is_blocked === true ||
        room.is_blocked_by_me === true ||
        room.blockedByMe === true ||
        room.blocked_by_me === true ||
        room.currentUserBlocked === true ||
        room.current_user_blocked === true ||
        room.currentUserState?.blocked === true ||
        room.current_user_state?.blocked === true ||
        room.memberState?.blocked === true ||
        room.member_state?.blocked === true ||
        room.policy?.blocked === true ||
        room.moderation?.blocked === true
    );
}

export function isRoomRestricted(
    room = null
) {
    if (
        !room ||
        typeof room !==
            'object'
    ) {
        return false;
    }

    const currentUserId =
        getCurrentUserId();

    const restrictedByUserIds =
        Array.isArray(
            room.restricted_by_user_ids
        )
            ? room.restricted_by_user_ids
            : Array.isArray(
                room.restrictedByUserIds
            )
                ? room.restrictedByUserIds
                : [];

    return Boolean(
        room.__dashboardRestricted === true ||
        room.restricted === true ||
        room.isRestricted === true ||
        room.is_restricted === true ||

        room.is_restricted_by_me === true ||
        room.restrictedByMe === true ||
        room.restricted_by_me === true ||

        (
            currentUserId &&
            restrictedByUserIds
                .map(String)
                .includes(
                    String(
                        currentUserId
                    )
                )
        ) ||

        /*
         * Legacy compatibility:
         * users restricted using the previous
         * mute-based frontend still render safely.
         */
        room.muted === true ||
        room.isMuted === true ||
        room.is_muted === true
    );
}
